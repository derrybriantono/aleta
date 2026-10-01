"use strict";

/**
 * Aksi e-Court per perkara dari portal (perbaikan 1 Okt 2026, butir E9, E10,
 * E11, 16b; kontrak K5 dan K6).
 *
 *   E9   daftar dokumen e-litigasi perkara + unduh (arsip, atau lewat sesi
 *        pengguna) + VERIFIKASI oleh majelis memakai sesi e-Court HAKIM ITU
 *        SENDIRI.
 *   E10  TTE salinan putusan oleh panitera memakai sesi e-Court PANITERA ITU
 *        SENDIRI. Passphrase diterima, diteruskan ke kolom e-Court, dibuang.
 *   16b  unggah "Dokumen Salinan Putusan" memakai sesi pengguna itu sendiri.
 *   E11  keadaan putusan e-Court (belum diunggah / belum TTE) untuk lencana.
 *
 * ============================================================================
 * PENJAGAAN TULIS
 * ============================================================================
 *
 *   1. konfirmasi === true wajib. Tanpa itu tidak satu pun peramban dibuka.
 *   2. Sesi yang dipakai SELALU milik penggunaId yang diteruskan portal (dari
 *      akun yang login, tidak pernah dari badan permintaan), dan perannya
 *      harus cocok dengan aksinya (PERAN_UNTUK_AKSI). Tidak ada sesi = tolak.
 *      Akun penarik data tidak pernah dipakai untuk menulis.
 *   3. Verifikasi: nama pengguna harus hakim terdaftar DAN duduk pada majelis
 *      perkara itu (penjagaan yang sama dengan jalur WhatsApp/portal lama).
 *   4. Satu aksi per pengguna pada satu waktu, batas aksi per jam per
 *      pengguna, batas peramban serentak - bukan jeda tiruan manusia.
 *   5. Jejak keamanan mencatat siapa, aksi apa, perkara mana, hasilnya.
 *      Passphrase dan sandi tidak pernah ikut (dijaga uji ecourt-aksi-1okt).
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const { normalizeCaseNumber, cleanText } = require("./ecourtTextService");
const sesiPengguna = require("./ecourtSesiPenggunaService");

const BATAS_AKSI_PER_JAM = Number(process.env.ALETA_ECOURT_AKSI_PER_JAM || 30);
const BATAS_PERAMBAN_SERENTAK = Number(process.env.ALETA_ECOURT_AKSI_SERENTAK || 2);
const BATAS_BERKAS_BYTE = Number(process.env.ALETA_ECOURT_AKSI_BATAS_BERKAS || 20 * 1024 * 1024);

function depsBawaan() {
  const botDb = require("./botDbService");
  const sippDb = require("../db_config");
  const store = require("./ecourtStoreService");
  const putusan = require("./putusanEcourtService");
  const verifikasi = require("./ecourtVerificationService");
  const logService = require("./logService");
  return {
    pengemudi: require("./ecourtPerambanAksiService"),
    sesi: sesiPengguna,
    rincianArsip: (nomor) => store.rincianArsipPerkara(nomor),
    putusan,
    identifikasiHakim: (nama) => verifikasi.identifyJudgeByName(nama),
    cekMajelis: (nomor, namaPencarian) => verifikasi.isOnPanel(nomor, namaPencarian),
    catatKeputusan: async ({ documentKey, hakim, keputusan, keterangan }) => {
      const rows = await botDb.query(`SELECT * FROM aleta_bot_ecourt_documents WHERE document_key = ? LIMIT 1`, [
        documentKey,
      ]);
      if (!rows[0]) return;
      try {
        await verifikasi.recordDecision({ dokumen: rows[0], hakim, keputusan, keterangan });
      } catch {
        /* keputusan lama sudah ada - tetap tandai diteruskan di bawah */
      }
      await verifikasi.markForwarded(documentKey, `diteruskan ${keputusan} lewat sesi pribadi`);
    },
    dokumenSatu: async (documentKey) => {
      const rows = await botDb.query(
        `SELECT document_key AS documentKey, nomor_perkara AS nomorPerkara, judul_dokumen AS judulDokumen,
                status_verifikasi AS statusVerifikasi, sumber_url AS sumberUrl
           FROM aleta_bot_ecourt_documents WHERE document_key = ? LIMIT 1`,
        [String(documentKey || "")]
      );
      return rows[0] || null;
    },
    alamatPerkara: async (nomor) => {
      const kunjungan = await botDb
        .query(`SELECT sumber_url AS u FROM aleta_bot_ecourt_kunjungan WHERE nomor_perkara = ? LIMIT 1`, [nomor])
        .catch(() => []);
      if (kunjungan[0] && kunjungan[0].u) return String(kunjungan[0].u);
      const dok = await botDb
        .query(
          `SELECT sumber_url AS u FROM aleta_bot_ecourt_documents
            WHERE nomor_perkara = ? AND sumber_url IS NOT NULL AND sumber_url <> ''
            ORDER BY terakhir_terlihat DESC LIMIT 1`,
          [nomor]
        )
        .catch(() => []);
      return dok[0] && dok[0].u ? String(dok[0].u) : "";
    },
    tanggalPutusanSipp: (daftarNomor) =>
      new Promise((resolve) => {
        if (!daftarNomor.length) return resolve({});
        sippDb.query(
          `SELECT p.nomor_perkara AS nomorPerkara, pu.tanggal_putusan AS tanggalPutusan
             FROM perkara p LEFT JOIN perkara_putusan pu ON pu.perkara_id = p.perkara_id
            WHERE p.nomor_perkara IN (?)`,
          [daftarNomor],
          (galat, rows) => {
            if (galat) return resolve(null);
            const peta = {};
            for (const r of rows || []) {
              peta[normalizeCaseNumber(r.nomorPerkara)] = r.tanggalPutusan ? String(r.tanggalPutusan) : "";
            }
            resolve(peta);
          }
        );
      }),
    catat: (data) => logService.logSecurityEvent(data),
    folderSementara: () => path.join(require("../tools/ecourt-bridge/sesi").sessionRoot(), "pengguna-tmp"),
  };
}

function buatLayanan(depsMasuk = {}) {
  let depsCache = null;
  const deps = () => {
    // Uji menyuntikkan SELURUH ketergantungan (tiruan e-Court, tiruan SIPP);
    // jalan sungguhan memuat yang asli, malas, saat pertama dipakai.
    if (!depsCache) depsCache = Object.keys(depsMasuk).length ? depsMasuk : depsBawaan();
    return depsCache;
  };

  // ------------------------------------------------------------------------
  // Batas yang sopan - bukan jeda tiruan.
  // ------------------------------------------------------------------------
  const sedangJalan = new Set();
  const riwayatAksi = new Map(); // penggunaId -> [epoch ms]
  let perambanAktif = 0;

  function bolehMulai(penggunaId) {
    if (sedangJalan.has(penggunaId)) return "aksi_lain_masih_berjalan";
    const sejamLalu = Date.now() - 60 * 60 * 1000;
    const daftar = (riwayatAksi.get(penggunaId) || []).filter((t) => t > sejamLalu);
    riwayatAksi.set(penggunaId, daftar);
    if (daftar.length >= BATAS_AKSI_PER_JAM) return "batas_aksi_per_jam";
    if (perambanAktif >= BATAS_PERAMBAN_SERENTAK) return "server_sibuk_coba_sebentar_lagi";
    return "";
  }

  async function jalankanTerjaga(penggunaId, kerja) {
    const tolak = bolehMulai(penggunaId);
    if (tolak) return { ok: false, alasan: tolak };
    sedangJalan.add(penggunaId);
    perambanAktif += 1;
    riwayatAksi.get(penggunaId).push(Date.now());
    try {
      return await kerja();
    } finally {
      sedangJalan.delete(penggunaId);
      perambanAktif -= 1;
    }
  }

  /** Cookie diperbarui atau sesi ditandai habis sesudah tiap aksi. */
  function rawatSesi(penggunaId, peran, hasil) {
    if (hasil && hasil.alasan === "sesi_habis") {
      deps().sesi.tandaiKedaluwarsa(penggunaId, peran);
    } else if (hasil && Array.isArray(hasil.cookies) && hasil.cookies.length) {
      deps().sesi.perbaruiCookies(penggunaId, peran, hasil.cookies);
    }
  }

  function jejak({ aksi, penggunaId, nama, nomorPerkara, hasil, alasan, akun }) {
    try {
      void deps().catat({
        eventType: `ecourt_aksi_${aksi}`,
        severity: hasil === "berhasil" ? "info" : "warning",
        message: `Aksi e-Court "${aksi}" lewat ALETA atas nama ${nama || penggunaId} (${hasil}).`,
        metadata: {
          jalur: "portal-sesi-pribadi",
          lewat: "ALETA",
          penggunaId,
          nama,
          nomorPerkara,
          hasil,
          alasan: String(alasan || "").slice(0, 120),
          akunEcourt: akun ? `${akun.namaAkunEcourt || ""} (${akun.sebutanPeran || akun.peran || ""})` : "",
        },
      });
    } catch {
      /* jejak gagal tidak menggagalkan aksi */
    }
  }

  function akunRingkas(baris) {
    if (!baris) return null;
    return {
      nama: baris.namaAkunEcourt || "(nama akun belum terbaca)",
      peran: baris.sebutanPeran || baris.peran,
      kodePeran: baris.peran,
      tersambung: baris.keadaan === "tersambung",
      sumber: "pribadi",
    };
  }

  async function sudahPutusPeta(daftarNomor) {
    const peta = await deps().tanggalPutusanSipp(daftarNomor).catch(() => null);
    return peta;
  }

  // ------------------------------------------------------------------------
  // E11 - keadaan putusan untuk lencana (banyak sekaligus)
  // ------------------------------------------------------------------------
  async function keadaanPutusanBanyak(daftarMentah = []) {
    const nomor = [...new Set((daftarMentah || []).map((x) => normalizeCaseNumber(x)).filter(Boolean))].slice(0, 300);
    if (!nomor.length) return { ok: true, keadaan: {} };
    const peta = await sudahPutusPeta(nomor);
    if (!peta) return { ok: false, alasan: "sipp_tidak_terbaca", keadaan: {} };
    const hasil = await deps().putusan.keadaanBanyak(nomor.map((n) => ({ nomorPerkara: n, sudahPutus: Boolean(peta[n]) })));
    const keadaan = {};
    for (const n of nomor) {
      const k = hasil[n];
      if (!k) continue;
      keadaan[n] = {
        keadaan: k.keadaan,
        sebutan: k.sebutan,
        perluTindakan: Boolean(k.perluTindakan),
        belumDiunggah: k.keadaan === "salinan_belum_diunggah" || k.keadaan === "putusan_ecourt_error",
        belumTte: k.keadaan === "belum_tte_panitera",
        diperiksaPada: k.ecourt ? k.ecourt.diperiksaPada || "" : "",
      };
    }
    return { ok: true, keadaan };
  }

  // ------------------------------------------------------------------------
  // E9 - ringkasan perkara untuk komponen EcourtAksiPerkara
  // ------------------------------------------------------------------------
  async function ringkasPerkara({ nomorPerkara, penggunaId, nama = "", tanggalSidang = "" } = {}) {
    const nomor = normalizeCaseNumber(nomorPerkara);
    if (!nomor) return { ok: false, alasan: "nomor_perkara_kosong" };
    const id = sesiPengguna.normalkanPengguna(penggunaId);

    const rincian = await deps().rincianArsip(nomor).catch(() => ({ dokumen: [] }));
    const hari = String(tanggalSidang || "").slice(0, 10);
    const dokumen = (rincian.dokumen || [])
      // e-litigasi = dokumen persidangan (punya agenda atau tanggal sidang);
      // berkas pendaftaran tidak mengenal verifikasi majelis.
      .filter((d) => d.agenda || d.tanggalSidang)
      .map((d) => {
        const tgl = d.tanggalSidang ? new Date(d.tanggalSidang) : null;
        const tglTeks =
          tgl && !Number.isNaN(tgl.getTime())
            ? `${tgl.getFullYear()}-${String(tgl.getMonth() + 1).padStart(2, "0")}-${String(tgl.getDate()).padStart(2, "0")}`
            : "";
        return {
          documentKey: d.documentKey,
          judulDokumen: d.judulDokumen,
          jenisDokumen: d.jenisDokumen,
          peranPengunggah: d.peranPengunggah,
          agenda: d.agenda,
          tanggalSidang: tglTeks,
          padaSidangIni: Boolean(hari && tglTeks === hari),
          diunggahPada: d.diunggahPada ? new Date(d.diunggahPada).toISOString() : "",
          statusVerifikasi: d.statusVerifikasi || "belum",
          perluVerifikasi: (d.statusVerifikasi || "belum") === "belum",
          adaPdf: Boolean(d.adaPdf),
          adaWord: Boolean(d.adaWord),
        };
      });

    const putusanPeta = await keadaanPutusanBanyak([nomor]).catch(() => ({ keadaan: {} }));
    const keadaanPutusan = putusanPeta.keadaan[nomor] || null;
    const catatanPutusan = await deps()
      .putusan.catatanBanyak([nomor])
      .then((p) => p[nomor] || null)
      .catch(() => null);

    const sesiMilik = id ? deps().sesi.daftarSesi(id) : [];
    const hakim = nama ? deps().identifikasiHakim(nama) : null;
    let anggotaMajelis = false;
    if (hakim) {
      const panel = await deps().cekMajelis(nomor, hakim.namaPencarian).catch(() => ({ anggota: false }));
      anggotaMajelis = Boolean(panel.anggota);
    }
    const alamat = await deps().alamatPerkara(nomor).catch(() => "");

    return {
      ok: true,
      alasan: "",
      nomorPerkara: nomor,
      elitigasi: dokumen.length > 0 || Boolean(alamat),
      alamatPerkaraDikenal: Boolean(alamat),
      dokumen,
      putusan: keadaanPutusan
        ? {
            ...keadaanPutusan,
            diunggahOleh: catatanPutusan ? catatanPutusan.diunggahOleh : "",
            tanggalUnggahTeks: catatanPutusan ? catatanPutusan.tanggalUnggahTeks : "",
            paniteraNama: catatanPutusan ? catatanPutusan.paniteraNama : "",
            paniteraTanggalTte: catatanPutusan ? catatanPutusan.paniteraTanggalTte : "",
          }
        : null,
      sesi: sesiMilik,
      akunVerifikasi: akunRingkas(deps().sesi.pilihSesi(id, "verifikasi")),
      akunTte: akunRingkas(deps().sesi.pilihSesi(id, "tte")),
      akunUnggah: akunRingkas(deps().sesi.pilihSesi(id, "unggah")),
      bolehVerifikasi: Boolean(hakim && anggotaMajelis),
      alasanTidakBolehVerifikasi: !hakim ? "bukan_hakim_terdaftar" : !anggotaMajelis ? "bukan_anggota_majelis" : "",
    };
  }

  // ------------------------------------------------------------------------
  // E9 - unduh lewat sesi pengguna (arsip dipakai lebih dulu oleh portal)
  // ------------------------------------------------------------------------
  async function unduhLewatSesi({ penggunaId, nama = "", documentKey, format = "pdf" } = {}) {
    const id = sesiPengguna.normalkanPengguna(penggunaId);
    if (!id) return { ok: false, alasan: "pengguna_tidak_sah" };
    const baris = deps().sesi.pilihSesi(id, "baca");
    if (!baris) return { ok: false, alasan: "sesi_pribadi_belum_tersambung" };
    const dokumen = await deps().dokumenSatu(documentKey);
    if (!dokumen) return { ok: false, alasan: "dokumen_tidak_ditemukan" };
    const alamatPerkara = (await deps().alamatPerkara(normalizeCaseNumber(dokumen.nomorPerkara))) || dokumen.sumberUrl;
    if (!alamatPerkara) return { ok: false, alasan: "alamat_perkara_belum_dikenal" };
    const cookies = deps().sesi.ambilCookies(id, baris.peran);
    if (!cookies) return { ok: false, alasan: "sesi_pribadi_belum_tersambung" };

    return jalankanTerjaga(id, async () => {
      const hasil = await deps().pengemudi.unduhDokumen({
        cookies,
        alamatPerkara,
        judulDokumen: dokumen.judulDokumen,
        format: format === "word" ? "word" : "pdf",
      });
      rawatSesi(id, baris.peran, hasil);
      jejak({
        aksi: "unduh",
        penggunaId: id,
        nama,
        nomorPerkara: dokumen.nomorPerkara,
        hasil: hasil.ok ? "berhasil" : "gagal",
        alasan: hasil.alasan,
        akun: baris,
      });
      if (!hasil.ok) return { ok: false, alasan: hasil.alasan };
      return {
        ok: true,
        alasan: "",
        isi: hasil.isi,
        contentType: hasil.contentType || "application/octet-stream",
        namaBerkas: `${cleanText(dokumen.judulDokumen) || "dokumen"}.${format === "word" ? "docx" : "pdf"}`,
      };
    });
  }

  // ------------------------------------------------------------------------
  // E9 - verifikasi oleh majelis, sesi HAKIM ITU SENDIRI
  // ------------------------------------------------------------------------
  async function verifikasi({
    penggunaId,
    nama = "",
    documentKey,
    keputusan,
    keterangan = "",
    konfirmasi = false,
    kering = false,
  } = {}) {
    const id = sesiPengguna.normalkanPengguna(penggunaId);
    if (!id) return { ok: false, alasan: "pengguna_tidak_sah" };
    if (keputusan !== "valid" && keputusan !== "tidak_valid") return { ok: false, alasan: "keputusan_tidak_dikenali" };
    if (konfirmasi !== true) return { ok: false, alasan: "konfirmasi_belum_diberikan" };

    const dokumen = await deps().dokumenSatu(documentKey);
    if (!dokumen) return { ok: false, alasan: "dokumen_tidak_ditemukan" };
    const nomor = normalizeCaseNumber(dokumen.nomorPerkara);

    const hakim = deps().identifikasiHakim(nama);
    if (!hakim) {
      jejak({ aksi: "verifikasi", penggunaId: id, nama, nomorPerkara: nomor, hasil: "ditolak", alasan: "bukan_hakim_terdaftar" });
      return { ok: false, alasan: "bukan_hakim_terdaftar" };
    }
    const panel = await deps().cekMajelis(nomor, hakim.namaPencarian).catch(() => ({ anggota: false, alasan: "sipp_tidak_terbaca" }));
    if (!panel.anggota) {
      jejak({ aksi: "verifikasi", penggunaId: id, nama, nomorPerkara: nomor, hasil: "ditolak", alasan: "bukan_anggota_majelis" });
      return { ok: false, alasan: "bukan_anggota_majelis" };
    }

    const baris = deps().sesi.pilihSesi(id, "verifikasi");
    if (!baris) return { ok: false, alasan: "sesi_hakim_belum_tersambung" };
    const cookies = deps().sesi.ambilCookies(id, baris.peran);
    if (!cookies) return { ok: false, alasan: "sesi_hakim_belum_tersambung" };
    const alamatPerkara = (await deps().alamatPerkara(nomor)) || dokumen.sumberUrl;
    if (!alamatPerkara) return { ok: false, alasan: "alamat_perkara_belum_dikenal" };

    return jalankanTerjaga(id, async () => {
      const hasil = await deps().pengemudi.verifikasi({
        cookies,
        alamatPerkara,
        judulDokumen: dokumen.judulDokumen,
        keputusan,
        keterangan: String(keterangan || "").slice(0, 500),
        kering: kering === true,
      });
      rawatSesi(id, baris.peran, hasil);
      if (hasil.ok && !hasil.kering) {
        await deps()
          .catatKeputusan({ documentKey: dokumen.documentKey, hakim, keputusan, keterangan })
          .catch(() => {});
      }
      jejak({
        aksi: kering === true ? "verifikasi_kering" : "verifikasi",
        penggunaId: id,
        nama,
        nomorPerkara: nomor,
        hasil: hasil.ok ? "berhasil" : "gagal",
        alasan: hasil.alasan,
        akun: baris,
      });
      return {
        ok: Boolean(hasil.ok),
        alasan: hasil.alasan || "",
        kering: Boolean(hasil.kering),
        keputusan,
        judulDokumen: dokumen.judulDokumen,
        nomorPerkara: nomor,
        statusSesudah: hasil.statusSesudah || "",
        akun: akunRingkas(baris),
      };
    });
  }

  // ------------------------------------------------------------------------
  // E10 - TTE salinan putusan oleh panitera
  // ------------------------------------------------------------------------
  async function tte({ penggunaId, nama = "", nomorPerkara, passphrase, konfirmasi = false } = {}) {
    const id = sesiPengguna.normalkanPengguna(penggunaId);
    const nomor = normalizeCaseNumber(nomorPerkara);
    if (!id) return { ok: false, alasan: "pengguna_tidak_sah" };
    if (!nomor) return { ok: false, alasan: "nomor_perkara_kosong" };
    if (konfirmasi !== true) return { ok: false, alasan: "konfirmasi_belum_diberikan" };
    if (!passphrase || typeof passphrase !== "string") return { ok: false, alasan: "passphrase_kosong" };

    const baris = deps().sesi.pilihSesi(id, "tte");
    if (!baris) return { ok: false, alasan: "sesi_panitera_belum_tersambung" };
    const cookies = deps().sesi.ambilCookies(id, baris.peran);
    if (!cookies) return { ok: false, alasan: "sesi_panitera_belum_tersambung" };
    const alamatPerkara = await deps().alamatPerkara(nomor);
    if (!alamatPerkara) return { ok: false, alasan: "alamat_perkara_belum_dikenal" };

    const sapu = (teks) => String(teks || "").split(passphrase).join("***");
    return jalankanTerjaga(id, async () => {
      let hasil;
      try {
        hasil = await deps().pengemudi.tteSalinan({ cookies, alamatPerkara, passphrase });
      } catch (galat) {
        hasil = { ok: false, alasan: `pengemudi_gagal: ${sapu(galat && galat.message).slice(0, 200)}` };
      }
      rawatSesi(id, baris.peran, hasil);
      if (hasil.putusanEcourt) await deps().putusan.simpan(nomor, hasil.putusanEcourt).catch(() => {});
      const alasan = sapu(hasil.alasan);
      jejak({ aksi: "tte", penggunaId: id, nama, nomorPerkara: nomor, hasil: hasil.ok ? "berhasil" : "gagal", alasan, akun: baris });
      return {
        ok: Boolean(hasil.ok),
        alasan,
        pesan: sapu(hasil.pesan),
        nomorPerkara: nomor,
        akun: akunRingkas(baris),
      };
    });
  }

  // ------------------------------------------------------------------------
  // 16b / K6 - akun yang akan mengunggah + unggah salinan putusan
  // ------------------------------------------------------------------------
  async function akunPutusan({ penggunaId, nomorPerkara } = {}) {
    const id = sesiPengguna.normalkanPengguna(penggunaId);
    const nomor = normalizeCaseNumber(nomorPerkara);
    const baris = id ? deps().sesi.pilihSesi(id, "unggah") : null;
    const catatan = nomor
      ? await deps()
          .putusan.catatanBanyak([nomor])
          .then((p) => p[nomor] || null)
          .catch(() => null)
      : null;
    const milik = id ? deps().sesi.daftarSesi(id) : [];
    return {
      ok: true,
      akun: akunRingkas(baris),
      alasan: baris
        ? ""
        : milik.some((b) => b.keadaan === "kedaluwarsa")
          ? "sesi_pribadi_kedaluwarsa"
          : "sesi_pribadi_belum_tersambung",
      salinan: catatan
        ? {
            sudahDiunggah: Boolean(catatan.dokumenAda),
            tanggal: catatan.tanggalUnggahTeks || "",
            olehNama: catatan.diunggahOleh || "",
            sudahTte: Boolean(catatan.paniteraTte),
            diperiksaPada: catatan.diperiksaPada || "",
          }
        : null,
    };
  }

  async function unggahSalinan({ penggunaId, nama = "", nomorPerkara, isi, konfirmasi = false } = {}) {
    const id = sesiPengguna.normalkanPengguna(penggunaId);
    const nomor = normalizeCaseNumber(nomorPerkara);
    if (!id) return { ok: false, alasan: "pengguna_tidak_sah" };
    if (!nomor) return { ok: false, alasan: "nomor_perkara_kosong" };
    if (konfirmasi !== true) return { ok: false, alasan: "konfirmasi_belum_diberikan" };
    const buf = Buffer.isBuffer(isi) ? isi : Buffer.alloc(0);
    if (buf.length < 5 || buf.subarray(0, 5).toString("latin1") !== "%PDF-") return { ok: false, alasan: "berkas_bukan_pdf" };
    if (buf.length > BATAS_BERKAS_BYTE) return { ok: false, alasan: "berkas_terlalu_besar" };

    const baris = deps().sesi.pilihSesi(id, "unggah");
    if (!baris) return { ok: false, alasan: "sesi_pribadi_belum_tersambung" };
    const cookies = deps().sesi.ambilCookies(id, baris.peran);
    if (!cookies) return { ok: false, alasan: "sesi_pribadi_belum_tersambung" };
    const alamatPerkara = await deps().alamatPerkara(nomor);
    if (!alamatPerkara) return { ok: false, alasan: "alamat_perkara_belum_dikenal" };

    return jalankanTerjaga(id, async () => {
      const folder = deps().folderSementara();
      fs.mkdirSync(folder, { recursive: true, mode: 0o700 });
      const jalur = path.join(folder, `salinan-${crypto.randomBytes(6).toString("hex")}.pdf`);
      fs.writeFileSync(jalur, buf, { mode: 0o600 });
      let hasil;
      try {
        hasil = await deps().pengemudi.unggahSalinan({ cookies, alamatPerkara, jalurBerkas: jalur });
      } finally {
        try {
          fs.unlinkSync(jalur);
        } catch {
          /* sudah tidak ada */
        }
      }
      rawatSesi(id, baris.peran, hasil);
      if (hasil.putusanEcourt) await deps().putusan.simpan(nomor, hasil.putusanEcourt).catch(() => {});
      jejak({
        aksi: "unggah_salinan",
        penggunaId: id,
        nama,
        nomorPerkara: nomor,
        hasil: hasil.ok ? "berhasil" : "gagal",
        alasan: hasil.alasan,
        akun: baris,
      });
      const sesudah = await akunPutusan({ penggunaId: id, nomorPerkara: nomor });
      return {
        ok: Boolean(hasil.ok),
        alasan: hasil.alasan || "",
        pesan: hasil.pesan || "",
        akun: akunRingkas(baris) ? { nama: akunRingkas(baris).nama, peran: akunRingkas(baris).peran } : null,
        salinan: sesudah.salinan,
      };
    });
  }

  return {
    akunPutusan,
    keadaanPutusanBanyak,
    ringkasPerkara,
    tte,
    unduhLewatSesi,
    unggahSalinan,
    verifikasi,
    // untuk uji
    _keadaanBatas: () => ({ perambanAktif, sedangJalan: [...sedangJalan] }),
  };
}

const bawaan = buatLayanan();

module.exports = {
  BATAS_AKSI_PER_JAM,
  buatLayanan,
  ...bawaan,
};
