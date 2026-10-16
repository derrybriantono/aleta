"use strict";

/**
 * ============================================================================
 * PENETAPAN KEMBALI - PMH, PPP, PJS, DAN PHS YANG DIGANTI (6 Okt 2026)
 * ============================================================================
 *
 * Diminta pengguna dari Jadwal Sidang: tombol "Penetapan kembali" untuk
 * mengganti majelis, panitera pengganti, juru sita, atau hari sidang perkara
 * yang SUDAH punya penetapan - satu per satu atau massal, beserta alasannya
 * (cuti tahunan, izin sakit, cuti alasan penting, perjalanan dinas luar,
 * lainnya).
 *
 * Jalur tulisnya BUKAN jalur penetapan awal. SIPP punya empat borang
 * tersendiri untuk ini, dan bentuk tulisannya berbeda dari borang "Tambah":
 *
 *   PMH  addMajelis_c::f_validate_input_penunjukan
 *        -> add_majelis_m::update_perkara_penetapan
 *        halaman "TAMBAH PENETAPAN KEMBALI HAKIM/MAJELIS HAKIM", proses 21
 *   PPP  addPanitera_c::f_validate_input_penunjukan_kembali
 *        -> add_panitera_m::insert_penunjukan_kembali_panitera
 *        halaman "PENUNJUKAN KEMBALI PANITERA/PANITERA PENGGANTI", proses 31
 *   PJS  addJuruSita_c::f_validate_input_penunjukan_kembali
 *        -> add_juru_sita_m::insert_penunjukan_kembali_juru_sita
 *        halaman "PENUNJUKAN KEMBALI JURUSITA/JURUSITA PENGGANTI", proses 41
 *   PHS  addSidangPertama_c::f_validate_input_add (action addpenetapankembali)
 *        -> add_sidang_pertama_m::insert_jadwal_sidang_penetapankembali
 *        halaman "Tambah Penetapan Kembali Sidang Pertama", proses 80 + 81
 *
 * Dibaca dari sumber SIPP setempat (D:\Aplikasi\SIPP, CodeIgniter 2.2) lalu
 * DICOCOKKAN dengan baris sungguhan di sys_audittrail satker (sipp_donggala):
 * PMH perkara 9988 (2 Sep 2026, 499092-499097, "Ketua Majelis cuti"), PPP
 * 9992 (7 Sep 2026, 499826-499829, "mutasi"), PJS 9262 (6 Jan 2026,
 * 453406-453409), PHS 9729 (16 Jul 2026, 489382-489385, "Mediasi Tidak
 * Berhasil"). Jumlah baris audit per tekanan Simpan: PMH 3+n, PPP 4, PJS 4,
 * PHS 4.
 *
 * Yang SENGAJA ditiru walau tampak janggal - semuanya terbukti di basis data:
 *
 *   - PMH kembali menulis perkara_penetapan.jenis_acara = '0' (input jenis_acara
 *     tidak ada pada borang PA; CI menulis FALSE sebagai 0, deskripsi auditnya
 *     kosong) dan TIDAK menyentuh diperbaharui_* tabel itu.
 *   - majelis_hakim_nama pada PMH kembali BERGELAR, hakim_nama baris
 *     perkara_hakim_pn TANPA gelar - kebalikan penetapan awal.
 *   - Baris lama dinonaktifkan dengan SATU UPDATE ... WHERE perkara_id AND
 *     aktif='Y' (tanpa saringan tahapan), satu baris audit "Foreign Key".
 *   - Baris baru tanpa tahapan_id/nomor_sk (bawaan kolom: 10).
 *   - perkara_smartmajelis status 3 + hakim_id2 + keterangan, TANPA tanggal,
 *     tanpa audit.
 *   - PJS kembali tidak menyimpan alasan di mana pun (borangnya punya kotak
 *     keterangan, controllernya membuangnya). Alasannya hanya di jejak ALETA.
 *   - PHS kembali TIDAK memperbarui perkara_penetapan; jadwal terakhir perkara
 *     itu ditandai ditunda='Y' TANPA baris audit; agenda jadwal baru selalu
 *     "Penetapan Kembali Hari Sidang"; keterangan penetapan hari sidang
 *     "Penetapan Kembali Hari Sidang Dengan Alasan <alasan>".
 *   - Riwayat lewat perkara_proses_update: SISIP bila proses itu belum ada,
 *     PERBARUI tanggal bila tanggalnya berbeda, DIAM bila sama - bukan REPLACE.
 *
 * Aturan yang tetap dari jalur penetapan awal (butir 39, keputusan 2 Okt):
 * akun yang tercatat = akun SIPP petugas yang menekan tombolnya; jam = jam
 * basis data SIPP sesudah jeda nyata; tidak ada kata ALETA di SIPP. Pejabat
 * penetap (Ketua/Wakil, Panitera/Plh, ketua majelis) HANYA ke jejak ALETA.
 */

const db = require("../db_config");
const tulis = require("./penetapanTulisService");
const { cleanText } = require("./ecourtTextService");
const { menyebutAleta } = require("./tandaAletaService");

const TAHAPAN_PENETAPAN = { tahapanId: 12, tahapanText: "Penetapan" };

/** Borang dan riwayat tiap jenis - nama halaman persis tulisan SIPP. */
const JEJAK_KEMBALI = {
  pmh: {
    formulir: "TAMBAH PENETAPAN KEMBALI HAKIM/MAJELIS HAKIM",
    // Alur 8 (pidana singkat dsb.) memakai "...KEMBALI HAKIM" saja.
    formulirAlur: { 8: "TAMBAH PENETAPAN KEMBALI HAKIM" },
    riwayat: [{ prosesId: 21, prosesText: "Penetapan Kembali Majelis Hakim/Hakim", tanggal: "penetapan" }],
  },
  ppp: {
    formulir: "PENUNJUKAN KEMBALI PANITERA/PANITERA PENGGANTI",
    formulirAlur: {},
    riwayat: [{ prosesId: 31, prosesText: "Penunjukan Kembali Panitera Pengganti", tanggal: "penetapan" }],
  },
  pjs: {
    formulir: "PENUNJUKAN KEMBALI JURUSITA/JURUSITA PENGGANTI",
    formulirAlur: {},
    riwayat: [{ prosesId: 41, prosesText: "Penunjukan Kembali Jurusita", tanggal: "penetapan" }],
  },
  phs: {
    formulir: "Tambah Penetapan Kembali Sidang Pertama",
    formulirAlur: { 132: "Tambah Penetapan Kembali Sidang Tertentu" },
    riwayat: [
      { prosesId: 80, prosesText: "Penetapan Hari Sidang Pertama", tanggal: "penetapan" },
      { prosesId: 81, prosesText: "Sidang pertama", tanggal: "sidang" },
    ],
  },
};

const JENIS_KEMBALI = ["pmh", "ppp", "pjs", "phs"];

/** Agenda jadwal yang ditimpa controller pada aksi addpenetapankembali. */
const AGENDA_KEMBALI = "Penetapan Kembali Hari Sidang";
const AWALAN_KETERANGAN_PHS = "Penetapan Kembali Hari Sidang Dengan Alasan ";
/** Kolom keterangan SIPP varchar(500); awalan PHS 44 huruf. */
const PANJANG_ALASAN = 450;

function runQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (error, hasil) => {
      if (error) reject(error);
      else resolve(hasil);
    });
  });
}

function tanggalSah(iso) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(iso || ""));
}

function hariLibur(iso) {
  if (!tanggalSah(iso)) return false;
  const hari = new Date(`${iso}T00:00:00Z`).getUTCDay();
  return hari === 0 || hari === 6;
}

/**
 * Alasan yang boleh dituliskan ke kolom keterangan SIPP.
 *
 * Kosong ditolak (borang PMH dan PHS kembali mewajibkannya). Kata ALETA
 * ditolak - keputusan 2 Okt 2026: tidak ada tanda ALETA di SIPP, termasuk dari
 * isian bebas "Lainnya".
 */
function alasanBersih(nilai) {
  const teks = cleanText(nilai).replace(/\s+/g, " ").trim();
  if (!teks) return { ok: false, alasan: "alasan_kosong" };
  // 17 Okt: bentuk apa pun ("A L E T A", "Aleta", huruf lebar) - sama dengan penolak tunda.
  if (menyebutAleta(teks)) return { ok: false, alasan: "alasan_menyebut_aleta" };
  if (teks.length > PANJANG_ALASAN) return { ok: false, alasan: "alasan_terlalu_panjang" };
  return { ok: true, teks };
}

/** Keadaan penetapan satu perkara - seluruh yang dibutuhkan penyusun rencana. */
async function keadaanKembali(perkaraId) {
  const id = Number(perkaraId);
  if (!Number.isFinite(id) || id <= 0) return null;
  const baris = await runQuery(
    `SELECT p.perkara_id AS perkaraId, p.nomor_perkara AS nomorPerkara,
            p.jenis_perkara_id AS jenisPerkaraId, p.alur_perkara_id AS alurPerkaraId,
            p.tanggal_pendaftaran AS tanggalDaftar,
            pen.perkara_id AS adaPenetapan,
            pen.penetapan_majelis_hakim AS pmh, pen.majelis_hakim_id AS majelisHakimId,
            pen.penetapan_panitera_pengganti AS ppp, pen.panitera_pengganti_id AS pppId,
            pen.penetapan_jurusita AS pjs, pen.jurusita_id AS pjsId,
            pen.penetapan_hari_sidang AS phs, pen.sidang_pertama AS sidangPertama,
            sm.perkara_id AS adaSmartMajelis
       FROM perkara p
       LEFT JOIN perkara_penetapan pen ON pen.perkara_id = p.perkara_id
       LEFT JOIN perkara_smartmajelis sm ON sm.perkara_id = p.perkara_id
      WHERE p.perkara_id = ? LIMIT 1`,
    [id]
  ).catch(() => []);
  return (Array.isArray(baris) && baris[0]) || null;
}

/** Nama halaman SIPP untuk jenis dan alur perkara ini. */
function formulirUntuk(jenis, alurPerkaraId) {
  const j = JEJAK_KEMBALI[jenis];
  return (j.formulirAlur && j.formulirAlur[Number(alurPerkaraId)]) || j.formulir;
}

/**
 * Nama tahapan/proses menurut proses_alur_perkara - yang dibaca SIPP sendiri
 * (riwayat_perkara_m::updateproses). Bila tabelnya tidak menjawab, nama yang
 * terukur di satker (alur 15/16/17) dipakai.
 */
async function prosesAlur(alurPerkaraId, prosesId, cadangan) {
  const baris = await runQuery(
    `SELECT tahapan_id AS tahapanId, tahapan_nama AS tahapanText, proses_id AS prosesId, proses_nama AS prosesText
       FROM proses_alur_perkara WHERE alur_perkara_id = ? AND proses_id = ? LIMIT 1`,
    [Number(alurPerkaraId) || 0, prosesId]
  ).catch(() => []);
  const satu = Array.isArray(baris) && baris[0];
  if (satu && Number(satu.tahapanId) > 0) {
    return {
      tahapanId: Number(satu.tahapanId),
      tahapanText: String(satu.tahapanText || ""),
      prosesId: Number(satu.prosesId),
      prosesText: String(satu.prosesText || ""),
    };
  }
  return { ...TAHAPAN_PENETAPAN, prosesId, prosesText: cadangan };
}

/** Baris riwayat yang sudah ada untuk proses itu - bahan tiruan perkara_proses_update. */
async function riwayatAda(perkaraId, prosesId) {
  const baris = await runQuery(
    `SELECT tanggal FROM perkara_proses WHERE perkara_id = ? AND proses_id = ? LIMIT 1`,
    [perkaraId, prosesId]
  ).catch(() => []);
  const satu = Array.isArray(baris) && baris[0];
  return satu ? { tanggal: tulis.tanggalIso(satu.tanggal) } : null;
}

/**
 * Langkah riwayat menurut CALL perkara_proses_update SIPP:
 *
 *   IF NOT EXISTS (perkara_id, proses_id)            -> INSERT
 *   ELSEIF EXISTS ... AND tanggal <> tanggal baru    -> UPDATE tanggal,
 *                                                       keterangan, diperbaharui_*
 *   (selain itu tidak berbuat apa-apa)
 *
 * Tanpa baris audit - SIPP tidak pernah mengaudit perkara_proses.
 */
function langkahRiwayat({ perkaraId, proses, tanggal, username, saat, ada }) {
  if (!ada) {
    return {
      tabel: "perkara_proses",
      aksi: "INSERT",
      sql:
        `INSERT INTO perkara_proses
           (perkara_id, tahapan_id, tahapan_nama, proses_id, proses_nama, tanggal, keterangan, diinput_oleh, diinput_tanggal)
         VALUES (?,?,?,?,?,?,?,?,?)`,
      params: [perkaraId, proses.tahapanId, proses.tahapanText, proses.prosesId, proses.prosesText, tanggal, "", String(username).slice(0, 30), saat],
      keterangan: `riwayat perkara: ${proses.prosesText}`,
    };
  }
  if (ada.tanggal !== tanggal) {
    return {
      tabel: "perkara_proses",
      aksi: "UPDATE",
      sql:
        `UPDATE perkara_proses SET tanggal = ?, keterangan = ?, diperbaharui_oleh = ?, diperbaharui_tanggal = ?
          WHERE perkara_id = ? AND proses_id = ?`,
      params: [tanggal, "", String(username).slice(0, 30), saat, perkaraId, proses.prosesId],
      keterangan: `riwayat perkara: ${proses.prosesText} bertanggal ${tanggal}`,
    };
  }
  return null;
}

/**
 * ============================================================================
 * RENCANA PENETAPAN KEMBALI - DISUSUN, TIDAK DIJALANKAN
 * ============================================================================
 *
 * Bentuk jawabannya sama dengan susunRencanaTulis, sehingga jalankanRencana
 * (penanda #ID#, id MAX+1, jadwalsidang_id dari langkah sebelumnya) berlaku
 * tanpa perubahan.
 */
async function susunRencanaKembali(minta) {
  const jenis = String((minta && minta.jenis) || "").toLowerCase();
  if (!JENIS_KEMBALI.includes(jenis)) return { ok: false, alasan: "jenis_tidak_didukung", jenis };

  const perkara = await keadaanKembali(minta.perkaraId);
  if (!perkara) return { ok: false, alasan: "perkara_tidak_ketemu" };
  if (!tanggalSah(minta.tanggalPenetapan)) return { ok: false, alasan: "tanggal_penetapan_tidak_sah" };

  const alasan = alasanBersih(minta.alasan);
  if (!alasan.ok) return { ok: false, alasan: alasan.alasan };

  const ip = String(minta.ip || "");
  const akun = await tulis.akunPetugasMasuk(minta.olehUsername, ip);
  if (!akun) return { ok: false, alasan: "akun_sipp_tidak_ketemu", username: String(minta.olehUsername || "") };
  if (akun.ganda) {
    return { ok: false, alasan: "akun_sipp_ganda", username: String(minta.olehUsername || ""), calon: akun.calon };
  }
  const operator = cleanText(minta.operator);
  if (!operator) return { ok: false, alasan: "operator_tidak_disebut" };

  // Jam basis data SIPP SAAT INI (sesudah jeda nyata di rute) - butir 39.
  // Pagar tanggal: tanggal setempat. Jam yang DITULIS: jam SIPP (WIB) - SIPP
  // menulis jamnya dengan PHP Asia/Jakarta, NOW() basis data WITA (13 Okt 2026).
  const hariIni = (await tulis.waktuBasisData()).slice(0, 10);
  const saat = await tulis.waktuSipp();

  // ==========================================================================
  // PAGAR TANGGAL MILIK KEEMPAT CONTROLLER KEMBALI
  // ==========================================================================
  const tgl = minta.tanggalPenetapan;
  if (tanggalSah(hariIni) && tgl > hariIni) {
    return { ok: false, alasan: "tanggal_penetapan_masa_depan", diminta: tgl, hariIni };
  }
  if (hariLibur(tgl)) return { ok: false, alasan: "tanggal_penetapan_hari_libur", diminta: tgl };

  const sebelumnya = {
    pmh: tulis.tanggalIso(perkara.pmh),
    ppp: tulis.tanggalIso(perkara.ppp),
    pjs: tulis.tanggalIso(perkara.pjs),
    phs: tulis.tanggalIso(perkara.phs),
  };
  // Penetapan KEMBALI menuntut penetapan pertamanya ada - tombolnya di SIPP pun
  // hanya muncul pada perkara yang sudah ditetapkan.
  if (!sebelumnya[jenis]) return { ok: false, alasan: `${jenis}_belum_ada` };
  // "Tidak Boleh Kurang dari Tanggal Penetapan/Penunjukan Pertama/Sebelumnya".
  if (tgl < sebelumnya[jenis]) {
    return { ok: false, alasan: "tanggal_kembali_sebelum_penetapan_sebelumnya", seharusnya: sebelumnya[jenis], diminta: tgl };
  }

  const username = akun.username;
  const formulir = formulirUntuk(jenis, perkara.alurPerkaraId);
  const audit = (rincian) => tulis.barisAudit({ username, formulir, ip, saat, ...rincian });
  const langkah = [];
  const catatan = [];
  let ringkas = "";

  // ---- PMH -----------------------------------------------------------------
  if (jenis === "pmh") {
    const idDiminta = (Array.isArray(minta.hakimId) ? minta.hakimId : []).map((x) => Number(x)).filter((x) => x > 0);
    // Borang SIPP: majelis = ketua + dua anggota (+ dua anggota tambahan
    // opsional), atau hakim tunggal.
    if (![1, 3, 4, 5].includes(idDiminta.length)) return { ok: false, alasan: "susunan_hakim_tidak_sah" };
    if (new Set(idDiminta).size !== idDiminta.length) return { ok: false, alasan: "hakim_kembar" };
    const hakim = await tulis.hakimUntuk(idDiminta);
    if (hakim.length !== idDiminta.length) return { ok: false, alasan: "hakim_tidak_ketemu" };
    const idGabung = idDiminta.join(",");
    if (String(perkara.majelisHakimId || "").replace(/\s+/g, "") === idGabung) {
      return { ok: false, alasan: "susunan_sama_dengan_sebelumnya" };
    }

    const tunggal = hakim.length === 1;
    const jabatanUntuk = (i) =>
      i === 0 ? (tunggal ? { id: 3, nama: "Hakim Tunggal" } : { id: 1, nama: "Hakim Ketua" }) : { id: 2, nama: "Hakim Anggota" };
    // update_perkara_penetapan: kode "|", nama BERGELAR "</br>", teks
    // "Hakim Ketua: x</br>Hakim Anggota 1: y".
    const kodeGabung = hakim.map((x) => x.kode || "").join("|");
    const namaGabung = hakim.map((x) => x.nama).join("</br>");
    const teksGabung = hakim
      .map((x, i) => `${i === 0 ? jabatanUntuk(0).nama : `Hakim Anggota ${i}`}: ${x.nama}`)
      .join("</br>");

    const nilaiPenetapan = {
      jenis_acara: "",
      penetapan_majelis_hakim: tgl,
      majelis_hakim_id: idGabung,
      majelis_hakim_kode: kodeGabung,
      majelis_hakim_nama: namaGabung,
      majelis_hakim_text: teksGabung,
    };
    langkah.push({
      tabel: "perkara_penetapan",
      aksi: "UPDATE",
      sql:
        `UPDATE perkara_penetapan SET jenis_acara = ?, penetapan_majelis_hakim = ?, majelis_hakim_id = ?,
           majelis_hakim_kode = ?, majelis_hakim_nama = ?, majelis_hakim_text = ? WHERE perkara_id = ?`,
      // jenis_acara '0': nilai yang tersimpan pada 9988 dan 9262 sesudah
      // penetapan kembali; deskripsi auditnya kosong.
      params: ["0", tgl, idGabung, kodeGabung, namaGabung, teksGabung, perkara.perkaraId],
      keterangan: `penetapan kembali majelis ${kodeGabung} (alasan: ${alasan.teks})`,
    });
    langkah.push(audit({ tabel: "perkara_penetapan", aksi: "UPDATE", nilai: nilaiPenetapan, perkaraId: perkara.perkaraId }));

    const nilaiNonaktif = { aktif: "T", tanggal_tidak_aktif: tgl, diperbaharui_oleh: username, diperbaharui_tanggal: saat };
    langkah.push({
      tabel: "perkara_hakim_pn",
      aksi: "UPDATE",
      sql:
        `UPDATE perkara_hakim_pn SET aktif = ?, tanggal_tidak_aktif = ?, diperbaharui_oleh = ?, diperbaharui_tanggal = ?
          WHERE perkara_id = ? AND aktif = ?`,
      params: ["T", tgl, username, saat, perkara.perkaraId, "Y"],
      keterangan: "majelis sebelumnya dinonaktifkan",
    });
    langkah.push(
      audit({ tabel: "perkara_hakim_pn", aksi: "UPDATE", nilai: nilaiNonaktif, perkaraId: perkara.perkaraId, jenisKunci: "Foreign Key" })
    );

    const nilaiSemua = [];
    const indeks = [];
    hakim.forEach((orang, i) => {
      const jabatan = jabatanUntuk(i);
      const nilai = {
        id: "#ID#",
        perkara_id: perkara.perkaraId,
        tanggal_penetapan: tgl,
        urutan: i + 1,
        jabatan_hakim_id: jabatan.id,
        jabatan_hakim_nama: jabatan.nama,
        hakim_id: idDiminta[i],
        hakim_kode: orang.kode || "",
        hakim_nip: orang.nip || "",
        // update_perkara_penetapan menulis $data_hakim->nama - TANPA gelar.
        hakim_nama: orang.namaPolos || orang.nama,
        aktif: "Y",
        diinput_oleh: username,
        diinput_tanggal: saat,
        keterangan: alasan.teks,
      };
      nilaiSemua.push(nilai);
      const kolom = Object.keys(nilai);
      langkah.push({
        tabel: "perkara_hakim_pn",
        aksi: "INSERT",
        sql: `INSERT INTO perkara_hakim_pn (${kolom.join(", ")}) VALUES (${kolom.map(() => "?").join(",")})`,
        params: kolom.map((k) => (k === "id" ? 0 : nilai[k])),
        idDihitung: { tabel: "perkara_hakim_pn", posisiParam: 0 },
        keterangan: `${i === 0 ? (tunggal ? "hakim tunggal" : "ketua") : `anggota ${i}`}: ${orang.nama}`,
      });
      indeks.push(langkah.length - 1);
    });
    nilaiSemua.forEach((nilai, i) => {
      langkah.push(
        audit({
          tabel: "perkara_hakim_pn",
          aksi: "INSERT",
          nilai,
          perkaraId: perkara.perkaraId,
          jenisKunci: "Foreign Key",
          kunciDariLangkah: { "#ID#": indeks[i] },
        })
      );
    });
    ringkas = `majelis baru ${teksGabung.replace(/<\/br>/g, "; ")}`;
  }

  // ---- PPP dan PJS ---------------------------------------------------------
  if (jenis === "ppp" || jenis === "pjs") {
    const ppp = jenis === "ppp";
    const petugas = await tulis.petugasUntuk(jenis, minta.petugasId);
    if (!petugas) return { ok: false, alasan: "petugas_tidak_ketemu" };
    const idLama = String((ppp ? perkara.pppId : perkara.pjsId) || "").trim();
    // addJuruSita_c: "Tidak Ada Perubahan Nama dengan Penunjukan Sebelumnya".
    // Diberlakukan juga pada PPP - menunjuk kembali orang yang sama bukan
    // penggantian.
    if (idLama === String(petugas.id)) return { ok: false, alasan: "petugas_sama_dengan_sebelumnya" };

    const kolomTanggal = ppp ? "penetapan_panitera_pengganti" : "penetapan_jurusita";
    const kolomId = ppp ? "panitera_pengganti_id" : "jurusita_id";
    const kolomTeks = ppp ? "panitera_pengganti_text" : "jurusita_text";
    // Teksnya berbeda dari penunjukan awal: "Jurusita: x", bukan "Juru Sita
    // Pengganti: x" (terbukti pada 9262).
    const teks = `${ppp ? "Panitera Pengganti" : "Jurusita"}: ${petugas.nama}`;
    const tabelPetugas = ppp ? "perkara_panitera_pn" : "perkara_jurusita";

    const nilaiPenetapan = { [kolomTanggal]: tgl, [kolomId]: String(petugas.id), [kolomTeks]: teks };
    langkah.push({
      tabel: "perkara_penetapan",
      aksi: "UPDATE",
      sql: `UPDATE perkara_penetapan SET ${kolomTanggal} = ?, ${kolomId} = ?, ${kolomTeks} = ? WHERE perkara_id = ?`,
      params: [tgl, String(petugas.id), teks, perkara.perkaraId],
      keterangan: `${teks} (alasan: ${alasan.teks})`,
    });
    langkah.push(audit({ tabel: "perkara_penetapan", aksi: "UPDATE", nilai: nilaiPenetapan, perkaraId: perkara.perkaraId }));

    const nilaiNonaktif = { aktif: "T", tanggal_tidak_aktif: tgl, diperbaharui_oleh: username, diperbaharui_tanggal: saat };
    langkah.push({
      tabel: tabelPetugas,
      aksi: "UPDATE",
      sql:
        `UPDATE ${tabelPetugas} SET aktif = ?, tanggal_tidak_aktif = ?, diperbaharui_oleh = ?, diperbaharui_tanggal = ?
          WHERE perkara_id = ? AND aktif = ?`,
      params: ["T", tgl, username, saat, perkara.perkaraId, "Y"],
      keterangan: `${ppp ? "panitera pengganti" : "juru sita"} sebelumnya dinonaktifkan`,
    });
    langkah.push(
      audit({ tabel: tabelPetugas, aksi: "UPDATE", nilai: nilaiNonaktif, perkaraId: perkara.perkaraId, jenisKunci: "Foreign Key" })
    );

    const nilaiPetugas = ppp
      ? {
          id: "#ID#",
          perkara_id: perkara.perkaraId,
          tanggal_penetapan: tgl,
          urutan: 1,
          panitera_id: String(petugas.id),
          panitera_kode: petugas.kode,
          panitera_nip: petugas.nip,
          panitera_nama: petugas.nama,
          aktif: "Y",
          diinput_oleh: username,
          diinput_tanggal: saat,
          keterangan: alasan.teks,
        }
      : {
          id: "#ID#",
          perkara_id: perkara.perkaraId,
          tanggal_penetapan: tgl,
          urutan: 1,
          jurusita_id: String(petugas.id),
          jurusita_kode: petugas.kode,
          jurusita_nip: petugas.nip,
          // insert_penunjukan_kembali_juru_sita: $data_juru_sita->nama, tanpa gelar.
          jurusita_nama: petugas.namaPolos || petugas.nama,
          aktif: "Y",
          diinput_oleh: username,
          diinput_tanggal: saat,
        };
    const kolom = Object.keys(nilaiPetugas);
    langkah.push({
      tabel: tabelPetugas,
      aksi: "INSERT",
      sql: `INSERT INTO ${tabelPetugas} (${kolom.join(", ")}) VALUES (${kolom.map(() => "?").join(",")})`,
      params: kolom.map((k) => (k === "id" ? 0 : nilaiPetugas[k])),
      idDihitung: { tabel: tabelPetugas, posisiParam: 0 },
      keterangan: `${ppp ? "panitera pengganti" : "juru sita"} baru: ${petugas.nama}`,
    });
    const indeksPetugas = langkah.length - 1;
    langkah.push(
      audit({
        tabel: tabelPetugas,
        aksi: "INSERT",
        nilai: nilaiPetugas,
        perkaraId: perkara.perkaraId,
        jenisKunci: "Foreign Key",
        kunciDariLangkah: { "#ID#": indeksPetugas },
      })
    );
    if (!ppp) {
      catatan.push("Alasan penunjukan kembali juru sita tidak disimpan SIPP (blangkonya membuang kotak keterangan) - alasannya tercatat di riwayat ALETA.");
    }
    ringkas = teks;
  }

  // ---- PHS -----------------------------------------------------------------
  if (jenis === "phs") {
    const tglSidang = String(minta.tanggalSidang || "");
    if (!tanggalSah(tglSidang)) return { ok: false, alasan: "tanggal_sidang_tidak_sah" };
    if (tglSidang < tgl) return { ok: false, alasan: "sidang_mendahului_penetapan" };
    if (Number(perkara.jenisPerkaraId) !== 746 && hariLibur(tglSidang)) {
      return { ok: false, alasan: "tanggal_sidang_hari_libur", diminta: tglSidang };
    }
    // addSidangPertama_c: penetapan hari sidang tidak boleh mendahului
    // penunjukan PP dan JS.
    if ((sebelumnya.ppp && tgl < sebelumnya.ppp) || (sebelumnya.pjs && tgl < sebelumnya.pjs)) {
      return { ok: false, alasan: "tanggal_penetapan_sebelum_penunjukan_pp_js" };
    }
    // cek_perkara_penetapan_hari_sidang: "Sudah Terdapat Penetapan Hari Sidang
    // Setelah Tanggal ...".
    const sesudah = await runQuery(
      `SELECT COUNT(*) AS jumlah FROM perkara_penetapan_hari_sidang WHERE perkara_id = ? AND tanggal_penetapan > ?`,
      [perkara.perkaraId, tgl]
    ).catch(() => []);
    if (Number((Array.isArray(sesudah) && sesudah[0] && sesudah[0].jumlah) || 0) > 0) {
      return { ok: false, alasan: "sudah_ada_phs_sesudah_tanggal_ini" };
    }

    const ruangan = await tulis.ruanganUntuk(minta.ruanganId);
    if (!ruangan) return { ok: false, alasan: "ruangan_tidak_ketemu" };
    const jamMentah = String(minta.jamSidang || "09:00");
    if (!/^\d{2}:\d{2}(:\d{2})?$/.test(jamMentah)) return { ok: false, alasan: "jam_sidang_tidak_sah" };
    // Borang mengirim lima huruf ("09:00") dan begitulah tercetak di audit.
    const jamBorang = jamMentah.slice(0, 5);

    const akhir = await runQuery(
      `SELECT MAX(id) AS id, COALESCE(MAX(urutan), 0) + 1 AS urutan FROM perkara_jadwal_sidang WHERE perkara_id = ?`,
      [perkara.perkaraId]
    ).catch(() => []);
    const idTerakhir = Number((Array.isArray(akhir) && akhir[0] && akhir[0].id) || 0);
    const urutan = Number((Array.isArray(akhir) && akhir[0] && akhir[0].urutan) || 1) || 1;

    // Jadwal terakhir ditandai ditunda - TANPA audit (query mentah di
    // insert_jadwal_sidang_penetapankembali). Terbukti pada 9729: jadwal 19179
    // diperbaharui fahri 09:52:31, nol baris audit untuknya.
    if (idTerakhir > 0) {
      langkah.push({
        tabel: "perkara_jadwal_sidang",
        aksi: "UPDATE",
        sql: `UPDATE perkara_jadwal_sidang SET ditunda = ?, diperbaharui_oleh = ?, diperbaharui_tanggal = ? WHERE id = ?`,
        params: ["Y", username, saat, idTerakhir],
        keterangan: `jadwal sidang terakhir (id ${idTerakhir}) ditandai ditunda`,
      });
    }

    const nilaiJadwal = {
      perkara_id: perkara.perkaraId,
      verzet: "T",
      keberatan: "T",
      tanggal_sidang: tglSidang,
      jam_sidang: jamBorang,
      ruangan: ruangan.nama,
      ruangan_id: ruangan.id,
      agenda: AGENDA_KEMBALI,
      sidang_keliling: ruangan.keliling ? "Y" : "T",
      ditunda: "T",
      id: "#ID#",
      diinput_oleh: username,
      diinput_tanggal: saat,
      urutan,
    };
    const kolomJadwal = Object.keys(nilaiJadwal);
    langkah.push({
      tabel: "perkara_jadwal_sidang",
      aksi: "INSERT",
      sql: `INSERT INTO perkara_jadwal_sidang (${kolomJadwal.join(", ")}) VALUES (${kolomJadwal.map(() => "?").join(",")})`,
      params: kolomJadwal.map((k) => (k === "id" ? 0 : nilaiJadwal[k])),
      idDihitung: { tabel: "perkara_jadwal_sidang", posisiParam: kolomJadwal.indexOf("id") },
      keterangan: `jadwal sidang baru ${tglSidang} ${jamBorang} di ${ruangan.nama}`,
    });
    const indeksJadwal = langkah.length - 1;
    langkah.push(
      audit({
        tabel: "perkara_jadwal_sidang",
        aksi: "INSERT",
        nilai: nilaiJadwal,
        kunciSendiri: "id=#ID#",
        kunciDariLangkah: { "#ID#": indeksJadwal },
      })
    );

    const nilaiHs = {
      perkara_id: perkara.perkaraId,
      tahapan_id: "12",
      tanggal_penetapan: tgl,
      tanggal_sidang: tglSidang,
      id: "#ID#",
      jadwalsidang_id: "#IDJADWAL#",
      diinput_oleh: username,
      diinput_tanggal: saat,
      keterangan: `${AWALAN_KETERANGAN_PHS}${alasan.teks}`,
    };
    const kolomHs = Object.keys(nilaiHs);
    langkah.push({
      tabel: "perkara_penetapan_hari_sidang",
      aksi: "INSERT",
      sql: `INSERT INTO perkara_penetapan_hari_sidang (${kolomHs.join(", ")}) VALUES (${kolomHs.map(() => "?").join(",")})`,
      params: kolomHs.map((k) => (k === "id" ? 0 : k === "jadwalsidang_id" ? null : nilaiHs[k])),
      idDihitung: { tabel: "perkara_penetapan_hari_sidang", posisiParam: kolomHs.indexOf("id") },
      isiDariLangkah: { indeks: indeksJadwal, posisiParam: kolomHs.indexOf("jadwalsidang_id") },
      keterangan: `penetapan kembali hari sidang (alasan: ${alasan.teks})`,
    });
    const indeksHs = langkah.length - 1;
    langkah.push(
      audit({
        tabel: "perkara_penetapan_hari_sidang",
        aksi: "INSERT",
        nilai: nilaiHs,
        kunciSendiri: "id=#ID#",
        kunciDariLangkah: { "#ID#": indeksHs, "#IDJADWAL#": indeksJadwal },
      })
    );
    ringkas = `hari sidang baru ${tglSidang} ${jamBorang}, ${ruangan.nama}`;
  }

  // ---- Riwayat dan tahapan terakhir ----------------------------------------
  let terakhir = await tulis.prosesTerakhirPerkara(perkara.perkaraId);
  for (const r of JEJAK_KEMBALI[jenis].riwayat) {
    const proses = await prosesAlur(perkara.alurPerkaraId, r.prosesId, r.prosesText);
    const tanggal = r.tanggal === "sidang" ? String(minta.tanggalSidang || "") : tgl;
    const satu = langkahRiwayat({
      perkaraId: perkara.perkaraId,
      proses,
      tanggal,
      username,
      saat,
      ada: await riwayatAda(perkara.perkaraId, r.prosesId),
    });
    if (satu) langkah.push(satu);

    terakhir = tulis.prosesTerakhirSesudah(terakhir, proses);
    const nilaiPerkara = {
      tahapan_terakhir_id: terakhir.tahapanId,
      tahapan_terakhir_text: terakhir.tahapanText,
      proses_terakhir_id: terakhir.prosesId,
      proses_terakhir_text: terakhir.prosesText,
      diperbaharui_oleh: username,
      diperbaharui_tanggal: saat,
    };
    langkah.push({
      tabel: "perkara",
      aksi: "UPDATE",
      sql:
        `UPDATE perkara SET tahapan_terakhir_id = ?, tahapan_terakhir_text = ?, proses_terakhir_id = ?, proses_terakhir_text = ?,
           diperbaharui_oleh = ?, diperbaharui_tanggal = ? WHERE perkara_id = ?`,
      params: [terakhir.tahapanId, terakhir.tahapanText, terakhir.prosesId, terakhir.prosesText, username, saat, perkara.perkaraId],
      keterangan: `tahapan terakhir ${terakhir.prosesText}`,
    });
    langkah.push(audit({ tabel: "perkara", aksi: "UPDATE", nilai: nilaiPerkara, perkaraId: perkara.perkaraId }));
  }

  // ---- PMH: catatan Smart Majelis, PALING AKHIR seperti controllernya ------
  if (jenis === "pmh") {
    const idGabung = (minta.hakimId || []).map((x) => Number(x)).filter((x) => x > 0).join(",");
    langkah.push(
      perkara.adaSmartMajelis
        ? {
            tabel: "perkara_smartmajelis",
            aksi: "UPDATE",
            sql: `UPDATE perkara_smartmajelis SET hakim_id2 = ?, status = ?, keterangan = ? WHERE perkara_id = ?`,
            params: [idGabung, "3", alasan.teks, perkara.perkaraId],
            keterangan: "smart majelis: status 3 (penetapan kembali)",
          }
        : {
            tabel: "perkara_smartmajelis",
            aksi: "INSERT",
            sql: `INSERT INTO perkara_smartmajelis (perkara_id, hakim_id2, status, keterangan) VALUES (?,?,?,?)`,
            params: [perkara.perkaraId, idGabung, "3", alasan.teks],
            keterangan: "smart majelis: status 3 (penetapan kembali)",
          }
    );
  }

  const diluar = langkah.filter((x) => !tulis.DAFTAR_TABEL.has(x.tabel));
  if (diluar.length > 0) return { ok: false, alasan: "tabel_di_luar_daftar", tabel: diluar.map((x) => x.tabel) };

  return {
    ok: true,
    jenis,
    kembali: true,
    perkara: { perkaraId: perkara.perkaraId, nomorPerkara: perkara.nomorPerkara },
    atasNama: { username, namaLengkap: akun.fullname },
    operator,
    tanggalPenetapan: tgl,
    alasan: alasan.teks,
    formulir,
    saat,
    ringkas,
    catatan,
    langkah,
    andaian: [],
  };
}

/**
 * ============================================================================
 * KEADAAN UNTUK POP-UP - SIAPA YANG MENJABAT SEKARANG, DAN PILIHANNYA
 * ============================================================================
 *
 * Satu panggilan untuk seluruh perkara yang dipilih (paling banyak 60), dan
 * daftar pilihan hakim / panitera pengganti / juru sita / ruangan aktif -
 * sama dengan daftar pada borang SIPP (aktif='Y').
 */
async function keadaanUntukLayar({ perkaraId = [], cari = "" } = {}) {
  const id = [...new Set((Array.isArray(perkaraId) ? perkaraId : []).map((x) => Number(x)).filter((x) => x > 0))].slice(0, 60);

  let temuan = [];
  const kata = cleanText(cari).slice(0, 60);
  if (kata.length >= 2) {
    const baris = await runQuery(
      `SELECT perkara_id AS perkaraId, nomor_perkara AS nomorPerkara FROM perkara
        WHERE nomor_perkara LIKE ? ORDER BY perkara_id DESC LIMIT 10`,
      [`%${kata}%`]
    ).catch(() => []);
    temuan = (Array.isArray(baris) ? baris : []).map((x) => ({ perkaraId: Number(x.perkaraId), nomorPerkara: String(x.nomorPerkara || "") }));
  }

  const perkara = [];
  if (id.length > 0) {
    const isian = id.map(() => "?").join(",");
    const [utama, hakim, phs, putus] = await Promise.all([
      runQuery(
        `SELECT p.perkara_id AS perkaraId, p.nomor_perkara AS nomorPerkara, p.jenis_perkara_id AS jenisPerkaraId,
                pen.penetapan_majelis_hakim AS pmh, pen.penetapan_panitera_pengganti AS ppp,
                pen.panitera_pengganti_id AS pppId, pen.panitera_pengganti_text AS pppTeks,
                pen.penetapan_jurusita AS pjs, pen.jurusita_id AS pjsId, pen.jurusita_text AS pjsTeks,
                pen.penetapan_hari_sidang AS phs, pen.sidang_pertama AS sidangPertama
           FROM perkara p LEFT JOIN perkara_penetapan pen ON pen.perkara_id = p.perkara_id
          WHERE p.perkara_id IN (${isian})`,
        id
      ).catch(() => []),
      runQuery(
        `SELECT perkara_id AS perkaraId, hakim_id AS hakimId, hakim_nama AS nama, jabatan_hakim_nama AS jabatan, urutan
           FROM perkara_hakim_pn WHERE perkara_id IN (${isian}) AND aktif = 'Y' AND tahapan_id = 10
          ORDER BY perkara_id, urutan`,
        id
      ).catch(() => []),
      runQuery(
        `SELECT hs.perkara_id AS perkaraId, hs.tanggal_penetapan AS tanggalPenetapan, hs.tanggal_sidang AS tanggalSidang,
                js.jam_sidang AS jam, js.ruangan_id AS ruanganId, js.ruangan AS ruangan
           FROM perkara_penetapan_hari_sidang hs
           LEFT JOIN perkara_jadwal_sidang js ON js.id = hs.jadwalsidang_id
          WHERE hs.perkara_id IN (${isian})
          ORDER BY hs.id DESC`,
        id
      ).catch(() => []),
      runQuery(`SELECT perkara_id AS perkaraId, tanggal_putusan AS tanggalPutusan FROM perkara_putusan WHERE perkara_id IN (${isian})`, id).catch(
        () => []
      ),
    ]);
    for (const p of Array.isArray(utama) ? utama : []) {
      const pid = Number(p.perkaraId);
      const majelis = (Array.isArray(hakim) ? hakim : [])
        .filter((h) => Number(h.perkaraId) === pid)
        .map((h) => ({ hakimId: Number(h.hakimId), nama: String(h.nama || ""), jabatan: String(h.jabatan || "") }));
      const hs = (Array.isArray(phs) ? phs : []).find((x) => Number(x.perkaraId) === pid) || null;
      const pt = (Array.isArray(putus) ? putus : []).find((x) => Number(x.perkaraId) === pid) || null;
      perkara.push({
        perkaraId: pid,
        nomorPerkara: String(p.nomorPerkara || ""),
        jenisPerkaraId: Number(p.jenisPerkaraId) || 0,
        sudahPutus: Boolean(pt && pt.tanggalPutusan),
        pmh: { tanggal: tulis.tanggalIso(p.pmh), majelis },
        ppp: { tanggal: tulis.tanggalIso(p.ppp), id: Number(p.pppId) || 0, teks: String(p.pppTeks || "") },
        pjs: { tanggal: tulis.tanggalIso(p.pjs), id: Number(p.pjsId) || 0, teks: String(p.pjsTeks || "") },
        phs: {
          tanggal: tulis.tanggalIso(hs ? hs.tanggalPenetapan : p.phs),
          tanggalSidang: tulis.tanggalIso(hs ? hs.tanggalSidang : p.sidangPertama),
          jam: hs && hs.jam ? String(hs.jam).slice(0, 5) : "",
          ruanganId: hs ? Number(hs.ruanganId) || 0 : 0,
          ruangan: hs ? String(hs.ruangan || "") : "",
        },
      });
    }
  }

  const [hakimAktif, panitera, jurusita, ruangan] = await Promise.all([
    runQuery(`SELECT id, nama_gelar AS nama FROM hakim_pn WHERE aktif = 'Y' ORDER BY nama_gelar ASC`).catch(() => []),
    runQuery(`SELECT id, nama_gelar AS nama FROM panitera_pn WHERE aktif = 'Y' ORDER BY nama_gelar ASC`).catch(() => []),
    runQuery(`SELECT id, IF(nama_gelar = '', nama, nama_gelar) AS nama FROM jurusita WHERE aktif = 'Y' ORDER BY nama_gelar ASC`).catch(
      () => []
    ),
    tulis.daftarRuangan().catch(() => []),
  ]);
  const daftar = (x) => (Array.isArray(x) ? x : []).map((r) => ({ id: Number(r.id), nama: String(r.nama || "") })).filter((r) => r.id > 0);

  return {
    ok: true,
    perkara,
    temuan,
    referensi: {
      hakim: daftar(hakimAktif),
      panitera: daftar(panitera),
      jurusita: daftar(jurusita),
      ruangan: (Array.isArray(ruangan) ? ruangan : []).map((r) => ({ id: r.id, nama: r.nama })),
    },
  };
}

module.exports = {
  JENIS_KEMBALI,
  JEJAK_KEMBALI,
  AGENDA_KEMBALI,
  AWALAN_KETERANGAN_PHS,
  alasanBersih,
  susunRencanaKembali,
  keadaanUntukLayar,
};
