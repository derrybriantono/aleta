"use strict";

/**
 * ============================================================================
 * e-DOC PENETAPAN IKRAR TALAK - DARI BLANGKO DERRY, ATAS AKUN KETUA MAJELIS IKRAR
 * ============================================================================
 *
 * Permintaan pengguna 18 Okt 2026 (lanjutan ikrarTalakService): sesudah form
 * "Penetapan Ikrar Talak" SIPP terisi, penetapannya disusun dari blangko Derry
 * "[90] / [90a] [Ikrar] Penetapan Ikrar Talak" (folder "1a Perceraian CT", menu
 * Putusan Cerai Talak, proses 80-297) lalu diunggah sebagai e-Doc ikrar.
 *
 * ----------------------------------------------------------------------------
 * BENTUKNYA DISALIN DARI SIPP, BUKAN DITEBAK
 * ----------------------------------------------------------------------------
 *
 *   controllers/fileupload_c.php  validatePost(), cabang from == "penikrar":
 *       $pengenal   = "penetapan_ikrar" . "_" . strtotime(...)
 *       $columnname = "ikrar_talak_dok"
 *       $direktori  = "resources/file/doc/<tahun daftar>/<bulan daftar>"   (tanggal_pendaftaran)
 *       $fileName   = <bagian4>_<bagian3>_<bagian2>_<bagian1>_<pengenal>, spasi -> "_",
 *                     titik dibuang, lalu "." + ekstensi ASLI berkasnya
 *   models/fileupload/fileupload_m.php  update_data(..., "penikrar"):
 *       UPDATE perkara_ikrar_talak SET ikrar_talak_dok = <jalur> WHERE perkara_id = <id>
 *
 * Contoh nyata di data satker (SELECT baca-saja, 18 Okt 2026):
 *   perkara 9988: resources/file/doc/2026/07/PADgl_2026_PdtG_474_penetapan_ikrar_1791343344.rtf
 * (877 dari 1.000 baris perkara_ikrar_talak berisi e-Doc; RTF dan PDF sama-sama ada.)
 *
 * SIPP tidak menulis sys_audittrail untuk unggah e-Doc ikrar (hanya putusan akhir
 * yang diaudit, fileupload_m::update_data), jadi di sini juga tidak. Riwayat
 * perkara dan sys_audittrail milik pengisian FORM ikrar (ikrarTalakService) yang
 * dicatat atas akun ketua majelis ikrar. Pertanggungjawaban unggahan ini ada di
 * jejak ALETA (aleta_bot_jejak_penetapan, jenis "edoc_ikrar"): siapa menekan,
 * atas akun SIPP mana, IP, berkas, jalur - termasuk unggahan yang GAGAL.
 *
 * ----------------------------------------------------------------------------
 * SIAPA, KAPAN, DAN APA YANG TIDAK DIUBAH
 * ----------------------------------------------------------------------------
 *
 *  - Atas akun KETUA MAJELIS ikrar (ikrarTalakService.ketuaMajelisIkrar); akun yang
 *    tidak pasti DITOLAK. Penekan sebenarnya hanya di jejak ALETA.
 *  - Hanya SESUDAH form ikrar terisi (diikrarkan, tanggal = tanggal sidang, amar
 *    lengkap): blangko membaca tanggal dan amar dari form itu. Tanggal substantif
 *    tidak pernah diubah di sini.
 *  - Varian blangko menurut kehadiran sidang ikrar: semua hadir (1) -> [90a],
 *    Pemohon saja (2) -> [90]. Pemohon tidak hadir (3/4) atau kehadiran tak
 *    tercatat DITOLAK - tidak ditebak.
 *  - Naskah yang masih berisi isian kosong ("...") TIDAK diunggah; yang kosong
 *    disebut satu per satu.
 *  - Tanpa kata ALETA: grup tersembunyi dan metadata RTF dibersihkan, ISI naskah
 *    diperiksa penjaga, nama berkas bersih.
 *  - e-Doc yang sudah ada tidak diganti kecuali `ganti`; yang diganti DIPINDAH ke
 *    <folder>/terhapus/ (keputusan 17 Okt butir 44), tidak dihapus.
 *
 * ----------------------------------------------------------------------------
 * TIGA STATUS DAN PDF BERTANDA TANGAN (keputusan P1/P4a/P5b, 28 Okt 2026)
 * ----------------------------------------------------------------------------
 *
 *  - Blangko per status: 1 Diikrarkan [90]/[90a] (kehadiran), 2 Pemohon Tidak
 *    Hadir [91] (kekuatan putusan gugur), 3 Rukun Kembali [92]/[92a] (paket ABT
 *    abt-paket/blangko-ikrar-92-28okt; sebelum paket terpasang: blangko tidak
 *    ditemukan -> dilaporkan, form tetap benar). Syarat "form terisi" = status
 *    form SAMA dengan status yang diminta, bukan lagi selalu status 1.
 *  - PDF ber-TTD gambar yang SUDAH DISAHKAN + cap kantor, mesin yang sama dengan
 *    e-Doc PMH-PHS (penetapanEdocService.bubuhkanPenetapan): penanda tangan dibaca
 *    dari LABEL blok tanda tangan blangko - "Ketua Majelis," pada [90]/[92], "Ketua
 *    <pengadilan>," pada [91] (penetapan Ketua). Cap dikirim portal (tabel cap
 *    portal). Tanpa TTD sah yang cocok nama, atau PDF gagal dibuat: RTF CADANGAN
 *    seperti sebelumnya, sebabnya disebut di `peringatan`.
 */

const fs = require("node:fs");
const path = require("node:path");
const penjagaTandaSipp = require("./penjagaTandaSipp");
const kembaranBerkas = require("./kembaranBerkas");
const basUnggah = require("./basUnggahService");
const ikrarTalak = require("./ikrarTalakService");

const FOLDER_BLANGKO_IKRAR = "derry_briantono/1a Perceraian CT";
const BLANGKO_IKRAR = Object.freeze({
  keduanyaHadir: "[90a] [Ikrar] Penetapan Ikrar Talak - P & T Hadir.rtf",
  pTidakHadirT: "[90] [Ikrar] Penetapan Ikrar Talak - P Hadir & T Tidak Hadir.rtf",
  // Status 2 (sudah ada di server, pohon 16 Okt) dan status 3 (paket ABT blangko-ikrar-92-28okt).
  gugur: "[91] [Ikrar Gugur] Penetapan Kekuatan Putusan Gugur - P Tidak Ikrar 6 Bulan.rtf",
  rukunPTidakHadirT: "[92] [Ikrar Rukun] Penetapan Rukun Kembali - P Hadir & T Tidak Hadir.rtf",
  rukunKeduanyaHadir: "[92a] [Ikrar Rukun] Penetapan Rukun Kembali - P & T Hadir.rtf",
});
/** Label penanda tangan per status (penetapanEdocService.PENANDATANGAN). */
const PENANDATANGAN_BLANGKO = Object.freeze({ 1: "ketua_majelis", 2: "ketua", 3: "ketua_majelis" });
const FOLDER_DOC = "resources/file/doc";
const BENTUK_SAH = ["rtf", "pdf", "doc", "docx"];

const PESAN = Object.freeze({
  bukan_sidang_ikrar: "Sidang ini bukan sidang ikrar talak.",
  ikrar_belum_dinyatakan_terlaksana: "Keterangan sidang belum menyatakan ikrar talak terlaksana.",
  form_ikrar_belum_terisi:
    "Form Penetapan Ikrar Talak di SIPP belum terisi (diikrarkan, tanggal ikrar, amar). Isi form ikrar dulu; penetapannya membaca tanggal dan amar dari form itu.",
  pemohon_tidak_hadir: "Pemohon tidak hadir di sidang ikrar - tidak ada penetapan ikrar yang dapat diunggah.",
  kehadiran_ikrar_tidak_jelas:
    "Kehadiran sidang ikrar belum tercatat (semua pihak / Pemohon saja), jadi varian blangko [90] atau [90a] tidak dipilihkan. Lengkapi kehadiran di Jadwal Sidang.",
  blangko_ikrar_masih_kosong: "Blangko penetapan ikrar masih memiliki isian yang kosong - tidak diunggah.",
  rukun_kembali_pemohon_tidak_hadir: "Rukun kembali dicatat bila Pemohon hadir - kehadiran sidang ini Pemohon tidak hadir.",
  status_ikrar_tidak_dikenal: "Status penetapan ikrar tidak dikenal.",
});

function bersih(nilai) {
  return String(nilai === null || nilai === undefined ? "" : nilai).trim();
}

/** Varian blangko menurut status penetapan (bawaan 1) dan kehadiran sidang ikrar. Murni. */
function pilihBlangkoIkrar(dihadiriOleh, statusIkrar = 1) {
  const h = Number(dihadiriOleh);
  const s = Number(statusIkrar) || 1;
  const v = (varian) => ({
    ok: true,
    varian,
    folder: FOLDER_BLANGKO_IKRAR,
    berkas: BLANGKO_IKRAR[varian],
    penandatangan: PENANDATANGAN_BLANGKO[s],
  });
  if (s === 2) return v("gugur"); // penetapan atas ketidakhadiran Pemohon - satu varian
  if (s === 3) {
    if (h === 1) return v("rukunKeduanyaHadir");
    if (h === 2) return v("rukunPTidakHadirT");
    if (h === 3 || h === 4) return { ok: false, alasan: "rukun_kembali_pemohon_tidak_hadir" };
    return { ok: false, alasan: "kehadiran_ikrar_tidak_jelas" };
  }
  if (s !== 1) return { ok: false, alasan: "status_ikrar_tidak_dikenal" };
  if (h === 1) return v("keduanyaHadir");
  if (h === 2) return v("pTidakHadirT");
  if (h === 3 || h === 4) return { ok: false, alasan: "pemohon_tidak_hadir" };
  return { ok: false, alasan: "kehadiran_ikrar_tidak_jelas" };
}

/**
 * [91] memuat "Pada tanggal ......" (penetapan Ketua, diketik tangan). Diisi tanggal
 * penetapan form (= tanggal ikrar SIPP) bila deretan titiknya utuh di RTF; selain itu
 * dibiarkan dan dilaporkan. Murni.
 */
function isiTanggalTitik(rtf, tanggalPanjang) {
  const t = String(tanggalPanjang || "").trim();
  const pola = /(Pada tanggal )\.{5,}/;
  if (!t || !pola.test(String(rtf))) return { rtf, diisi: false };
  return { rtf: String(rtf).replace(pola, `$1${t}`), diisi: true };
}

/**
 * Nama berkas menurut fileupload_c.php. "" bila nomornya tidak berbagian empat.
 *   ("474/Pdt.G/2026/PA.Dgl", 1791343344, "rtf") -> "PADgl_2026_PdtG_474_penetapan_ikrar_1791343344.rtf"
 * Murni.
 */
function namaBerkasIkrar(nomorPerkara, cap, ekstensi) {
  const bagian = String(nomorPerkara || "").split("/");
  if (bagian.length !== 4 || bagian.some((x) => !x.trim())) return "";
  const ext = BENTUK_SAH.includes(String(ekstensi)) ? String(ekstensi) : "";
  if (!ext) return "";
  const dasar = `${bagian[3]}_${bagian[2]}_${bagian[1]}_${bagian[0]}_penetapan_ikrar_${Math.floor(Number(cap) || 0)}`
    .replace(/ /g, "_")
    .replace(/\./g, "");
  return penjagaTandaSipp.namaBerkasBersih(`${dasar}.${ext}`);
}

/** Jalur relatif (tahun/bulan dari tanggal PENDAFTARAN, seperti SIPP). "" bila tak sah. Murni. */
function jalurIkrar(nomorPerkara, tanggalDaftar, cap, ekstensi) {
  const nama = namaBerkasIkrar(nomorPerkara, cap, ekstensi);
  const m = /^(\d{4})-(\d{2})-\d{2}/.exec(String(tanggalDaftar || ""));
  if (!nama || !m || m[1] === "0000") return "";
  return `${FOLDER_DOC}/${m[1]}/${m[2]}/${nama}`;
}

function depsBawaan() {
  const sippDb = require("../db_config");
  const skema = require("./sippSkemaService");
  const dokumen = require("./dokumenPenetapanService");
  const abtCetak = require("./abtCetakService");
  return {
    kueri: (sql, params = []) =>
      new Promise((ok, gagal) => sippDb.query(sql, params, (g, h) => (g ? gagal(g) : ok(h)))),
    kolomAda: (t, k) => skema.kolomAda(t, k),
    kenaliDokumen: (b) => abtCetak.kenaliDokumen(b),
    /** Mesin blangko Derry yang sama dengan BAS massal / Blangko ALETA (blangko.isi). */
    isiBlangko: async (params) => {
      const { handleBridgeOperation } = require("./sippReadOnlyBridgeService");
      return handleBridgeOperation("blangko.isi", params);
    },
    ketuaMajelis: (perkaraId) => ikrarTalak.ketuaMajelisIkrar(perkaraId),
    periksaAkar: () => dokumen.periksaAkarSipp(undefined, { relatif: FOLDER_DOC }),
    // Mode kembaran: berkas ditahan di antrean sinkron, bukan ditulis ke folder SIPP (kembaranBerkas).
    tulisBerkas: (penuh, isi, akar) => kembaranBerkas.tulis(penuh, isi, { akar, flag: "wx" }),
    pindahBerkas: (dari, ke, akar) => kembaranBerkas.pindah(dari, ke, { akar }),
    hapusBerkas: (penuh) => {
      try {
        fs.unlinkSync(penuh);
      } catch {
        /* berkas yatim hanya berkas tak terpakai */
      }
    },
    samakanPemilik: (penuh, akar) => dokumen.samakanPemilikSipp(penuh, akar),
    catatJejak: (j) => {
      if (process.env.VITEST) return Promise.resolve(false);
      try {
        return require("./jejakAletaService").catat(j);
      } catch {
        return Promise.resolve(false);
      }
    },
    sekarang: () => new Date(),
    capWaktu: () => Math.floor(Date.now() / 1000),
    // PDF ber-TTD + cap (P5b): mesin e-Doc penetapan, tanda tangan sah, RTF -> PDF.
    bubuhkan: (p) => require("./penetapanEdocService").bubuhkanPenetapan(p),
    ttd: () => require("./tandaTanganService"),
    rtfKePdf: (isi) => abtCetak.rtfKePdf(isi),
  };
}

/**
 * RTF penetapan ikrar -> PDF bertanda tangan + cap. Pulang { ok:true, pdf, ... } atau
 * { ok:false, alasan, peringatan } (pemanggil jatuh ke RTF cadangan). Tidak melempar.
 */
async function pdfBertandaTangan(d, { rtf, penandatangan, cap, atur }) {
  try {
    if (!d.bubuhkan || !d.ttd || !d.rtfKePdf) return { ok: false, alasan: "mesin_pdf_tidak_tersedia", peringatan: [] };
    const t = d.ttd();
    const daftar = await Promise.resolve(t.daftar({ hanyaSah: true })).catch(() => ({ baris: [] }));
    const bubuh = await d.bubuhkan({
      rtf,
      jenis: "ikrar",
      atur: { ...(atur && typeof atur === "object" ? atur : {}), pakaiTtd: true, pakaiCap: true, penandatangan },
      cap: cap && cap.isi && cap.isi.length ? cap : null,
      daftarTtd: (daftar && daftar.baris) || [],
      ambilGambar: (id) => t.gambar(id),
      bakuNama: (n) => t.bakuNama(n),
    });
    if (!bubuh || !bubuh.ok) {
      return { ok: false, alasan: (bubuh && bubuh.alasan) || "tanda_tangan_gagal", peringatan: (bubuh && bubuh.peringatan) || [] };
    }
    if (!bubuh.tandaTangan) {
      return { ok: false, alasan: "tanda_tangan_sah_tidak_ada", peringatan: bubuh.peringatan || [], penandaTangan: bubuh.penandaTangan };
    }
    const pdf = await d.rtfKePdf(Buffer.from(bubuh.rtf, "latin1"));
    if (!pdf || !pdf.ok || !pdf.pdf) return { ok: false, alasan: (pdf && pdf.alasan) || "pdf_gagal", peringatan: bubuh.peringatan || [] };
    return {
      ok: true,
      pdf: pdf.pdf,
      tandaTangan: bubuh.tandaTangan,
      cap: bubuh.cap,
      penandaTangan: bubuh.penandaTangan,
      peringatan: bubuh.peringatan || [],
    };
  } catch (e) {
    return { ok: false, alasan: `pdf_galat: ${String((e && e.message) || e).slice(0, 120)}`, peringatan: [] };
  }
}

function buatLayanan(depsMasuk) {
  let cache = null;
  const deps = () => {
    if (!cache) cache = depsMasuk || depsBawaan();
    return cache;
  };

  /**
   * Menyiapkan (kering) atau mengunggah (kering:false) e-Doc penetapan ikrar.
   * Pulang { ok:true, jalur, nama, blangko, ... } atau { ok:false, alasan, pesan }.
   * Tidak pernah melempar karena masukan.
   *
   * @param {object} p { jadwalId, perkaraId?, operator, ip, kering = true, ganti = false,
   *   statusIkrar = 1, cap?: {isi:Buffer|isiBase64, jenis, id, nama}, atur? }  cap/atur dari portal (P5b).
   */
  async function unggahPenetapanIkrar(p = {}) {
    const d = deps();
    const kering = p.kering !== false;
    const sid = Number(p.jadwalId);
    if (!Number.isInteger(sid) || sid <= 0) return { ok: false, alasan: "sidang_tidak_sah", pesan: "Sidang belum dikenali." };

    const jejakDasar = {
      aksi: "unggah",
      jenis: "edoc_ikrar",
      perkaraId: Number(p.perkaraId) || 0,
      nomorPerkara: "",
      akunSipp: "",
      namaPejabat: "",
      operator: bersih(p.operator).slice(0, 120),
      ip: bersih(p.ip),
      kering,
    };
    const gagal = async (alasan, pesan, ekstra = {}) => {
      await Promise.resolve(d.catatJejak({ ...jejakDasar, berhasil: false, alasan, langkah: [] })).catch(() => false);
      return { ok: false, alasan, pesan: pesan || PESAN[alasan] || alasan, ...ekstra };
    };

    const baris = await d.kueri(
      `SELECT j.id AS jadwal_id, j.perkara_id, DATE_FORMAT(j.tanggal_sidang, '%Y-%m-%d') AS tanggal,
              j.ikrar_talak, j.dihadiri_oleh, j.ditunda, j.alasan_ditunda, j.keterangan, j.urutan,
              p.nomor_perkara, DATE_FORMAT(p.tanggal_pendaftaran, '%Y-%m-%d') AS tanggal_daftar,
              it.perkara_id AS ada_baris, it.status_penetapan_ikrar_talak_id AS status_ikrar,
              it.amar_ikrar_talak AS amar, DATE_FORMAT(it.tgl_ikrar_talak, '%Y-%m-%d') AS tgl_ikrar,
              it.ikrar_talak_dok AS dok
         FROM perkara_jadwal_sidang j
         JOIN perkara p ON p.perkara_id = j.perkara_id
         LEFT JOIN perkara_ikrar_talak it ON it.perkara_id = j.perkara_id
        WHERE j.id = ? LIMIT 1`,
      [sid]
    );
    const r = Array.isArray(baris) ? baris[0] : null;
    if (!r) return gagal("sidang_tidak_ditemukan", "Sidang ini tidak ditemukan di SIPP.");
    const pid = Number(r.perkara_id);
    jejakDasar.perkaraId = pid;
    const nomorSipp = bersih(r.nomor_perkara);
    jejakDasar.nomorPerkara = nomorSipp;
    if (p.perkaraId && Number(p.perkaraId) !== pid) return gagal("perkara_tidak_cocok", "Sidang itu bukan milik perkara tersebut.");

    if (bersih(r.ikrar_talak) !== "Y") return gagal("bukan_sidang_ikrar");
    // Status yang diminta (bawaan 1); tanpa permintaan tegas, status form yang SUDAH tercatat (tombol Isi form ikrar).
    const statusForm = Number(r.status_ikrar) || 0;
    const status = Number(p.statusIkrar) || (statusForm >= 1 && statusForm <= 3 ? statusForm : 1);
    if (![1, 2, 3].includes(status)) return gagal("status_ikrar_tidak_dikenal");
    const terlaksana =
      bersih(r.ditunda) !== "Y" &&
      (status === 1
        ? ikrarTalak.ikrarTerlaksanaMenurutTeks(r.alasan_ditunda) || ikrarTalak.ikrarTerlaksanaMenurutTeks(r.keterangan)
        : ikrarTalak.statusIkrarMenurutTeks(r.alasan_ditunda) === status || ikrarTalak.statusIkrarMenurutTeks(r.keterangan) === status);
    if (!terlaksana) return gagal("ikrar_belum_dinyatakan_terlaksana");
    if (!r.ada_baris) return gagal("penetapan_ikrar_belum_ada", "Baris penetapan ikrar belum ada di SIPP.");

    const formTerisi = statusForm === status && bersih(r.tgl_ikrar) === bersih(r.tanggal) && bersih(r.amar).length >= 50;
    if (!formTerisi) return gagal("form_ikrar_belum_terisi");

    if (!(await d.kolomAda("perkara_ikrar_talak", "ikrar_talak_dok"))) {
      return gagal("kolom_ikrar_talak_dok_tidak_ada", "SIPP ini tidak punya kolom e-Doc ikrar talak.");
    }

    const lama = bersih(r.dok);
    if (lama && p.ganti !== true) {
      return gagal("sudah_ada", `e-Doc penetapan ikrar sudah ada di SIPP (${lama.split("/").pop()}). Tidak diganti.`, {
        jalurLama: lama.split("/").pop(),
        sudahAda: true,
      });
    }

    const pilih = pilihBlangkoIkrar(r.dihadiri_oleh, status);
    if (!pilih.ok) return gagal(pilih.alasan);

    const ketua = await d.ketuaMajelis(pid);
    if (!ketua || !ketua.ok) {
      return gagal(ketua && ketua.alasan ? ketua.alasan : "ketua_majelis_ikrar_tidak_ada", "Ketua majelis ikrar tidak pasti - e-Doc tidak diunggah.", {
        nama: (ketua && ketua.calon) || [],
      });
    }
    jejakDasar.akunSipp = ketua.username;
    jejakDasar.namaPejabat = ketua.fullname || "";

    const capWaktu = d.capWaktu();
    const jalurRencana = jalurIkrar(nomorSipp, r.tanggal_daftar, capWaktu, "rtf");
    if (!jalurRencana) return gagal("nomor_atau_tanggal_daftar_tidak_sah", "Nomor perkara atau tanggal pendaftaran di SIPP tidak berbentuk baku.");
    const capKiriman = p.cap && typeof p.cap === "object"
      ? { ...p.cap, isi: Buffer.isBuffer(p.cap.isi) ? p.cap.isi : p.cap.isiBase64 ? Buffer.from(String(p.cap.isiBase64), "base64") : null }
      : null;

    if (kering) {
      return {
        ok: true,
        kering: true,
        statusIkrar: status,
        blangko: { folder: pilih.folder, berkas: pilih.berkas, varian: pilih.varian },
        atasNama: { username: ketua.username, namaLengkap: ketua.fullname, peran: "ketua majelis ikrar talak" },
        jalurDirencanakan: jalurRencana,
        bentuk: "PDF bertanda tangan + cap bila tanda tangan sah penanda tangan blangko tersedia; selain itu RTF",
        mengganti: lama || "",
      };
    }

    // ---- Menyusun naskah dari blangko Derry (mesin ABT yang sama dengan BAS massal) -----------------
    let isi;
    try {
      // sidangKe = urutan SIDANG IKRAR ini (28 Okt 2026): dengan 0 mesin memakai sidang PERTAMA, sehingga
      // hari/tanggal sidang (#0032#/#0033#, lafal ikrar, hijriah) tercetak tanggal sidang pertama. Terukur
      // perkara 9596: 15 April (sidang pertama) padahal sidang ikrar 17 Juni 2026.
      isi = await d.isiBlangko({ folder: pilih.folder, berkas: pilih.berkas, perkaraId: pid, sidangKe: Number(r.urutan) || 0 });
    } catch (e) {
      return gagal("blangko_tidak_terbaca", `Blangko tidak dapat disusun: ${String((e && e.message) || e).slice(0, 160)}`);
    }
    if (!isi || isi.ok === false || !isi.rtfBase64) {
      return gagal("blangko_tidak_terbaca", bersih(isi && isi.sebab) || "Blangko penetapan ikrar tidak ditemukan atau tidak terbaca.");
    }
    const kosong = Array.isArray(isi.kosong) ? isi.kosong : [];
    if (kosong.length) {
      const daftar = kosong.map((k) => `#${k.noVar}# ${k.nama || ""}`.trim()).slice(0, 12);
      return gagal("blangko_ikrar_masih_kosong", `${PESAN.blangko_ikrar_masih_kosong} Kosong: ${daftar.join("; ")}.`, { kosong: daftar });
    }
    let rtfBita = Buffer.from(isi.rtfBase64, "base64");
    if (d.kenaliDokumen(rtfBita) !== "rtf") return gagal("jawaban_bukan_rtf", "Hasil penyusunan blangko bukan RTF.");
    const peringatan = [];
    if (status === 2) {
      // [91]: "Pada tanggal ......" (penetapan Ketua) = tanggal penetapan form.
      const t = isiTanggalTitik(rtfBita.toString("latin1"), ikrarTalak.tanggalPanjang(r.tgl_ikrar));
      if (t.diisi) rtfBita = Buffer.from(t.rtf, "latin1");
      else if (/Pada tanggal \.{5,}/.test(rtfBita.toString("latin1"))) peringatan.push("tanggal_penetapan_ketua_masih_titik");
    }

    // Penjaga batas: grup tersembunyi & metadata dibersihkan (sistem), ISI diperiksa - ditahan, tidak diubah diam-diam.
    const dariSipp = await penjagaTandaSipp.dataSippMemuatAleta(pid, d.kueri);
    const siap = penjagaTandaSipp.siapkanBerkasSipp(rtfBita, { nama: "Penetapan ikrar talak", dariSipp });
    if (!siap.ok) return gagal(siap.alasan, siap.pesan);

    // P5b: PDF bertanda tangan + cap; RTF bila belum bisa (TTD belum disahkan / PDF gagal).
    let isiUnggah = siap.isi;
    let bentuk = "rtf";
    let ttdPdf = null;
    const pdf = await pdfBertandaTangan(d, {
      rtf: Buffer.isBuffer(siap.isi) ? siap.isi.toString("latin1") : String(siap.isi),
      penandatangan: pilih.penandatangan,
      cap: capKiriman,
      atur: p.atur,
    });
    if (pdf.ok) {
      isiUnggah = pdf.pdf;
      bentuk = "pdf";
      ttdPdf = { tandaTangan: pdf.tandaTangan, cap: pdf.cap, penandaTangan: pdf.penandaTangan };
      peringatan.push(...(pdf.peringatan || []).map((x) => x.kode || String(x)));
    } else {
      peringatan.push(`rtf_cadangan:${pdf.alasan}`);
    }
    const jalurAkhir = bentuk === "pdf" ? jalurIkrar(nomorSipp, r.tanggal_daftar, capWaktu, "pdf") : jalurRencana;

    const keadaanAkar = d.periksaAkar();
    if (!keadaanAkar.dapatDitulis) return gagal(keadaanAkar.alasan || "akar_tidak_dapat_ditulis", keadaanAkar.pesan || "Folder e-Doc SIPP tidak dapat ditulis.");
    const relatif = jalurAkhir;
    const tahan = penjagaTandaSipp.periksaRencana({
      atasNama: { username: ketua.username },
      langkah: [{ tabel: "perkara_ikrar_talak", sql: "UPDATE perkara_ikrar_talak SET ikrar_talak_dok = ? WHERE perkara_id = ?", params: [relatif, pid] }],
    });
    if (!tahan.ok) return gagal(tahan.alasan, tahan.pesan);
    const penuh = path.join(keadaanAkar.akar, relatif);

    // Berkas DAHULU, baris sesudahnya - seperti SIPP (move_uploaded_file lalu update_data).
    try {
      await d.tulisBerkas(penuh, isiUnggah, keadaanAkar.akar);
      d.samakanPemilik(penuh, keadaanAkar.akar);
    } catch (e) {
      return gagal("berkas_tidak_dapat_ditulis", String((e && e.message) || e).slice(0, 200));
    }

    // Bersyarat nilai LAMA: e-Doc yang diisi/diganti orang lain di antara bacaan dan tulisan tidak ditimpa.
    const hasil = await d.kueri(
      lama
        ? "UPDATE perkara_ikrar_talak SET ikrar_talak_dok = ? WHERE perkara_id = ? AND ikrar_talak_dok = ?"
        : "UPDATE perkara_ikrar_talak SET ikrar_talak_dok = ? WHERE perkara_id = ? AND (ikrar_talak_dok IS NULL OR ikrar_talak_dok = '')",
      lama ? [relatif, pid, lama] : [relatif, pid]
    );
    if (Number((hasil && hasil.affectedRows) || 0) < 1) {
      d.hapusBerkas(penuh);
      return gagal("sudah_ada", "Sementara ALETA menyiapkan berkas, e-Doc penetapan ikrar sudah diisi orang lain di SIPP. Tidak diganti - muat ulang lalu ulangi.");
    }

    // Berkas lama yang diganti dipindah ke <folder>/terhapus/ (SESUDAH baris diganti).
    let lamaDipindah = "";
    let peringatanLama = "";
    if (lama) {
      const tujuan = basUnggah.jalurTerhapus(lama, d.sekarang());
      if (!tujuan) peringatanLama = "Jalur berkas ikrar lama tidak baku - berkasnya tidak dipindah.";
      else {
        try {
          const pindah = await d.pindahBerkas(path.join(keadaanAkar.akar, lama), path.join(keadaanAkar.akar, tujuan), keadaanAkar.akar);
          if (pindah === false) peringatanLama = "Berkas ikrar lama tidak ditemukan di folder SIPP - tidak ada yang dipindah.";
          else lamaDipindah = tujuan;
        } catch (e) {
          peringatanLama = `Berkas ikrar lama belum dapat dipindah: ${String((e && e.message) || e).slice(0, 160)}`;
        }
      }
    }

    await Promise.resolve(
      d.catatJejak({
        ...jejakDasar,
        berhasil: true,
        alasan: "",
        langkah: [
          {
            tabel: "perkara_ikrar_talak",
            aksi: "UPDATE",
            keterangan: `ikrar_talak_dok: ${relatif} (blangko ${pilih.berkas}, ${bentuk}${
              ttdPdf && ttdPdf.tandaTangan ? `, ttd ${ttdPdf.tandaTangan.namaPejabat}${ttdPdf.cap ? " + cap" : ""}` : ""
            })${
              lama ? `; mengganti ${lama}${lamaDipindah ? `, dipindah ke ${lamaDipindah}` : `, TIDAK dipindah: ${peringatanLama}`}` : ""
            }`,
          },
        ],
      })
    ).catch(() => false);

    return {
      ok: true,
      jalur: relatif,
      nama: path.basename(relatif),
      statusIkrar: status,
      bentuk,
      tandaTangan: ttdPdf && ttdPdf.tandaTangan ? { namaPejabat: ttdPdf.tandaTangan.namaPejabat, cap: Boolean(ttdPdf.cap) } : null,
      peringatan,
      blangko: { folder: pilih.folder, berkas: pilih.berkas, varian: pilih.varian },
      atasNama: { username: ketua.username, namaLengkap: ketua.fullname, peran: "ketua majelis ikrar talak" },
      diganti: Boolean(lama),
      lamaDipindah,
      peringatanLama,
    };
  }

  return { unggahPenetapanIkrar };
}

const bawaan = buatLayanan();

module.exports = {
  FOLDER_BLANGKO_IKRAR,
  BLANGKO_IKRAR,
  PENANDATANGAN_BLANGKO,
  pilihBlangkoIkrar,
  isiTanggalTitik,
  pdfBertandaTangan,
  namaBerkasIkrar,
  jalurIkrar,
  buatLayanan,
  unggahPenetapanIkrar: (...a) => bawaan.unggahPenetapanIkrar(...a),
};
