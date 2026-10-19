"use strict";

/**
 * ============================================================================
 * OCR-ECOURT (19 Okt 2026) - ANTRIAN, SIMPANAN, DAN USULAN LAMPIRAN e-COURT
 * ============================================================================
 *
 * Pola KTP-PIHAK (ktpPihakService): bot menyimpan berkas e-Court tetapi tidak membacanya (pdfjs + tesseract hanya ada
 * di citra portal). Jadi:
 *
 *   portal  GET  /sipp/lampiran-ecourt/antrian   berkas lampiran yang belum dibaca (perkara terbaru dulu, satu isi sekali)
 *   portal  GET  /sipp/lampiran-ecourt/berkas    isi satu berkas
 *   portal       lapisan teks PDF, atau OCR per halaman (portal: modules/aleta-ecourt/lampiran-ecourt.ts)
 *   portal  POST /sipp/lampiran-ecourt           teks per halaman -> di sini: jenis, medan, pencocokan pihak
 *   panel   lewat /abt/isi-gugatan               usulan ABT + kalimat salin (kanal "Isi dari SIPP & input ke ABT")
 *
 * HASIL DI-CACHE PER BERKAS (aleta_bot_lampiran_baca + aleta_bot_lampiran_medan): satu berkas dibaca SEKALI per versi
 * aturan (VERSI_LAMPIRAN); berkas berisi sama (sidik_jari) di perkara lain memakai teks yang sama tanpa OCR ulang.
 * TEKS HALAMAN TIDAK DISIMPAN - hanya medan terurai (tanpa NIK). NIK hanya dipakai di memori saat mencocokkan pihak.
 *
 * Tidak ada yang ditulis ke SIPP/ABT/e-Court. Tabelnya milik basis data bot (CREATE TABLE IF NOT EXISTS).
 */

const fs = require("fs");
const L = require("./lampiranEcourtService");

const DDL_BACA = `CREATE TABLE IF NOT EXISTS aleta_bot_lampiran_baca (
  file_id VARCHAR(64) NOT NULL,
  document_key VARCHAR(191) NOT NULL DEFAULT '',
  nomor_perkara VARCHAR(191) NOT NULL DEFAULT '',
  perkara_id BIGINT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'tidak_terbaca',
  sebab VARCHAR(255) NOT NULL DEFAULT '',
  halaman INT NOT NULL DEFAULT 0,
  halaman_ocr INT NOT NULL DEFAULT 0,
  lama_ms INT NOT NULL DEFAULT 0,
  percobaan INT NOT NULL DEFAULT 0,
  versi INT NOT NULL DEFAULT 0,
  dibaca_pada DATETIME NOT NULL,
  PRIMARY KEY (file_id),
  INDEX idx_ablb_nomor (nomor_perkara),
  INDEX idx_ablb_status (status, dibaca_pada)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`;

const DDL_MEDAN = `CREATE TABLE IF NOT EXISTS aleta_bot_lampiran_medan (
  file_id VARCHAR(64) NOT NULL,
  halaman SMALLINT NOT NULL,
  nomor_perkara VARCHAR(191) NOT NULL DEFAULT '',
  perkara_id BIGINT NULL,
  jenis VARCHAR(32) NOT NULL DEFAULT '',
  medan TEXT NOT NULL,
  pihak VARCHAR(255) NOT NULL DEFAULT '',
  sumber VARCHAR(16) NOT NULL DEFAULT '',
  PRIMARY KEY (file_id, halaman),
  INDEX idx_ablm_nomor (nomor_perkara)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`;

/**
 * Judul dokumen e-Court yang dibaca: bukti/lampiran; bukan gugatan, jawab-menjawab, atau KTP (penyapu KTP).
 * Tanpa tanda tanya di SQL: driver mysql membacanya sebagai tempat parameter.
 */
const SQL_JUDUL_LAMPIRAN = `(LOWER(d.judul_dokumen) REGEXP 'bukti|kuasa|akta|akte|buku nikah|kartu keluarga|surat keterangan|keterangan|gaji|penghasilan|domisili|penolakan'
  AND LOWER(d.judul_dokumen) NOT REGEXP 'gugatan|permohonan|jawab|replik|duplik|kesimpulan|eksepsi|rekon[pv]ensi|perbaikan|pencabutan|^ *e{0,1}-{0,1}ktp *$|kartu tanda penduduk')`;

/** Batas berkas yang dibaca (bita) - lebih besar dari ini dicatat "berkas_terlalu_besar", tidak dibaca. */
const BATAS_BITA = 15 * 1024 * 1024;
const BATAS_PERCOBAAN = 4;
const JEDA_JAM_PER_PERCOBAAN = 12;
const SEBAB_TANPA_OCR = "ocr_belum_tersedia";
const EKSTENSI_GAMBAR = new Set([".jpg", ".jpeg", ".png"]);

let skemaJanji = null;
function botDb() {
  return require("./botDbService");
}
function K() {
  return require("./ktpPihakService");
}

function bersih(x, batas = 255) {
  return String(x == null ? "" : x).replace(/\s+/g, " ").trim().slice(0, batas);
}

async function pastikanSkema() {
  if (!skemaJanji) {
    skemaJanji = (async () => {
      const db = botDb();
      if (!(await db.ensureSchema())) throw new Error("Basis data bot belum siap.");
      await db.query(DDL_BACA);
      await db.query(DDL_MEDAN);
      return true;
    })().catch((galat) => {
      skemaJanji = null;
      throw galat;
    });
  }
  return skemaJanji;
}

/**
 * Berkas yang perlu dibaca: belum pernah, versi aturan lebih lama, atau gagal dan sudah waktunya dicoba lagi.
 * Perkara ?nomor= dulu, lalu perkara terbaru. Isi sama (sidik_jari) cukup sekali.
 */
async function antrian({ nomor = [], batas = 1, versi = L.VERSI_LAMPIRAN } = {}) {
  await pastikanSkema();
  const utama = [...new Set((Array.isArray(nomor) ? nomor : []).map((x) => bersih(x, 191)).filter(Boolean))].slice(0, 50);
  const rows = await botDb().query(
    `SELECT f.id AS fileId, f.format, f.ukuran_byte AS ukuran, f.sidik_jari AS sidikJari, d.nomor_perkara AS nomorPerkara, d.judul_dokumen AS judul
       FROM aleta_bot_ecourt_documents d
       JOIN aleta_bot_ecourt_files f ON f.document_key = d.document_key AND f.dihapus_retensi IS NULL
       LEFT JOIN aleta_bot_lampiran_baca b ON b.file_id = f.id
      WHERE ${SQL_JUDUL_LAMPIRAN} AND f.format <> 'word'
        AND (b.file_id IS NULL
             OR (b.status = 'tidak_terbaca' AND b.sebab = ? AND b.dibaca_pada < UTC_TIMESTAMP() - INTERVAL 1 DAY)
             OR (b.status = 'tidak_terbaca' AND b.sebab <> ? AND b.percobaan < ? AND b.dibaca_pada < UTC_TIMESTAMP() - INTERVAL (b.percobaan * ?) HOUR)
             OR (b.status <> 'tidak_terbaca' AND b.versi < ?))
      ORDER BY (d.nomor_perkara IN (?)) DESC, d.perkara_id DESC, f.document_key
      LIMIT 200`,
    [SEBAB_TANPA_OCR, SEBAB_TANPA_OCR, BATAS_PERCOBAAN, JEDA_JAM_PER_PERCOBAAN, Number(versi) || L.VERSI_LAMPIRAN, utama.length ? utama : [""]]
  );
  const batasAkhir = Math.min(Math.max(Number(batas) || 1, 1), 5);
  const dilihat = new Set();
  const hasil = [];
  for (const r of Array.isArray(rows) ? rows : []) {
    const kunci = String(r.sidikJari || r.fileId);
    if (dilihat.has(kunci)) continue;
    dilihat.add(kunci);
    hasil.push({ fileId: String(r.fileId), format: String(r.format || ""), ukuran: Number(r.ukuran) || 0, nomorPerkara: bersih(r.nomorPerkara, 191), judul: bersih(r.judul, 255) });
    if (hasil.length >= batasAkhir) break;
  }
  return hasil;
}

/** Isi satu berkas lampiran (hanya judul lampiran). */
async function berkas(fileId) {
  const id = bersih(fileId, 64);
  if (!id) return { ok: false, alasan: "file_id_kosong" };
  const rows = await botDb().query(
    `SELECT f.jalur_berkas AS jalur, f.ukuran_byte AS ukuran FROM aleta_bot_ecourt_files f JOIN aleta_bot_ecourt_documents d ON d.document_key = f.document_key
      WHERE f.id = ? AND f.dihapus_retensi IS NULL AND ${SQL_JUDUL_LAMPIRAN} LIMIT 1`,
    [id]
  );
  const b = Array.isArray(rows) ? rows[0] : null;
  if (!b || !b.jalur) return { ok: false, alasan: "berkas_tidak_ada" };
  if (Number(b.ukuran) > BATAS_BITA) return { ok: false, alasan: "berkas_terlalu_besar" };
  const d = require("./ecourtDocumentService").describeEcourtDocument(b.jalur, { batasByte: BATAS_BITA, ekstensiTambahan: EKSTENSI_GAMBAR });
  if (!d.ok) return { ok: false, alasan: bersih(d.reason, 200) };
  try {
    return { ok: true, isi: fs.readFileSync(d.absolutePath) };
  } catch (galat) {
    return { ok: false, alasan: `berkas_tidak_terbaca: ${bersih(galat.message, 150)}` };
  }
}

/** Teks halaman dari portal -> bentuk sah (dipangkas). */
function halamanSah(h) {
  return (Array.isArray(h) ? h : []).slice(0, L.BATAS_HALAMAN).map((x) => ({
    teks: String((x && x.teks) || "").slice(0, L.BATAS_TEKS_HALAMAN),
    sumber: x && x.sumber === "teks-pdf" ? "teks-pdf" : "ocr",
  }));
}

/**
 * Bacaan satu berkas untuk SATU perkara: jenis + medan per halaman, dicocokkan ke pihak SIPP perkara itu.
 * Mengembalikan baris siap simpan (tanpa NIK). Murni bila pihak diberikan.
 */
function barisMedan({ judul, halaman, pihak }) {
  const keluar = [];
  for (const b of L.bacaBerkas({ judul, halaman })) {
    if (["lain", "ktp", "kartu_advokat", "ba_sumpah"].includes(b.jenis)) continue;
    const cocok = L.cocokkanPihak(b, pihak);
    const aman = L.tanpaRahasia(b, pihak);
    if (!Object.keys(aman.medan).length && !cocok.length) continue;
    keluar.push({ halaman: aman.halaman, jenis: aman.jenis, sumber: aman.sumber, medan: aman.medan, pihak: cocok });
  }
  return keluar;
}

async function tulisStatus({ fileId, documentKey, nomorPerkara, perkaraId, status, sebab, halaman, halamanOcr, lamaMs, percobaan, versi }) {
  await botDb().query(
    `REPLACE INTO aleta_bot_lampiran_baca (file_id, document_key, nomor_perkara, perkara_id, status, sebab, halaman, halaman_ocr, lama_ms, percobaan, versi, dibaca_pada)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, UTC_TIMESTAMP())`,
    [fileId, documentKey || "", nomorPerkara || "", perkaraId || null, status, bersih(sebab, 255), halaman || 0, halamanOcr || 0, Math.min(Number(lamaMs) || 0, 2147483647), percobaan || 0, versi || 0]
  );
}

/**
 * Hasil portal, per berkas: { fileId, status: "terbaca"|"tidak_terbaca", sebab, versi, halaman: [{teks, sumber}], lamaMs }
 * Teks halaman dipakai sekali di sini lalu dibuang; yang disimpan hanya medan (tanpa NIK). Berkas berisi sama di perkara
 * lain ikut terisi (dicocokkan ke pihak perkaranya sendiri).
 */
async function simpan(daftar = []) {
  await pastikanSkema();
  let tersimpan = 0;
  let halamanBermedan = 0;
  for (const h of (Array.isArray(daftar) ? daftar : []).slice(0, 10)) {
    const fileId = bersih(h && h.fileId, 64);
    if (!fileId) continue;
    const asalRows = await botDb().query(
      `SELECT f.document_key AS documentKey, f.sidik_jari AS sidikJari FROM aleta_bot_ecourt_files f JOIN aleta_bot_ecourt_documents d ON d.document_key = f.document_key
        WHERE f.id = ? AND ${SQL_JUDUL_LAMPIRAN} LIMIT 1`,
      [fileId]
    );
    const asal = Array.isArray(asalRows) ? asalRows[0] : null;
    if (!asal) continue;
    const semua = asal.sidikJari
      ? await botDb().query(
          `SELECT f.id AS fileId, f.document_key AS documentKey, d.nomor_perkara AS nomorPerkara, d.perkara_id AS perkaraId, d.judul_dokumen AS judul
             FROM aleta_bot_ecourt_files f JOIN aleta_bot_ecourt_documents d ON d.document_key = f.document_key
            WHERE f.sidik_jari = ? AND f.dihapus_retensi IS NULL AND ${SQL_JUDUL_LAMPIRAN} LIMIT 50`,
          [asal.sidikJari]
        )
      : [];
    const sasaran = Array.isArray(semua) && semua.length ? semua : [{ fileId, documentKey: asal.documentKey, nomorPerkara: "", perkaraId: null, judul: "" }];
    const halaman = halamanSah(h.halaman);
    const versi = Math.max(0, Number(h.versi) || L.VERSI_LAMPIRAN);
    const terbaca = h.status === "terbaca" && halaman.some((x) => x.teks.trim().length >= 40);
    for (const s of sasaran) {
      const sId = String(s.fileId);
      if (!terbaca) {
        const lama = await botDb().query("SELECT percobaan, status FROM aleta_bot_lampiran_baca WHERE file_id = ?", [sId]);
        const l = Array.isArray(lama) ? lama[0] : null;
        // Bacaan ulang yang gagal tidak menghapus bacaan lama yang berhasil.
        if (l && l.status === "terbaca") continue;
        const sebab = bersih(h.sebab || "tidak_terbaca", 255);
        await tulisStatus({ fileId: sId, documentKey: s.documentKey, nomorPerkara: s.nomorPerkara, perkaraId: s.perkaraId, status: "tidak_terbaca", sebab, halaman: 0, halamanOcr: 0, lamaMs: h.lamaMs, percobaan: sebab === SEBAB_TANPA_OCR ? 0 : ((l && Number(l.percobaan)) || 0) + 1, versi });
        tersimpan += 1;
        continue;
      }
      const perkara = await K().cariPerkara({ perkaraId: s.perkaraId || null, nomorPerkara: s.nomorPerkara }).catch(() => null);
      const pihak = perkara ? await K().pihakPerkara(perkara.perkaraId).catch(() => []) : [];
      const baris = barisMedan({ judul: s.judul, halaman, pihak });
      await botDb().query("DELETE FROM aleta_bot_lampiran_medan WHERE file_id = ?", [sId]);
      for (const b of baris) {
        await botDb().query(
          `INSERT INTO aleta_bot_lampiran_medan (file_id, halaman, nomor_perkara, perkara_id, jenis, medan, pihak, sumber) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [sId, b.halaman, perkara ? perkara.nomorPerkara : s.nomorPerkara, perkara ? perkara.perkaraId : s.perkaraId, b.jenis, JSON.stringify(b.medan).slice(0, 60000), JSON.stringify(b.pihak).slice(0, 255), b.sumber]
        );
      }
      halamanBermedan += baris.length;
      await tulisStatus({
        fileId: sId,
        documentKey: s.documentKey,
        nomorPerkara: perkara ? perkara.nomorPerkara : s.nomorPerkara,
        perkaraId: perkara ? perkara.perkaraId : s.perkaraId,
        status: "terbaca",
        sebab: baris.length ? "" : "tanpa_medan",
        halaman: halaman.length,
        halamanOcr: halaman.filter((x) => x.sumber === "ocr").length,
        lamaMs: h.lamaMs,
        percobaan: 0,
        versi,
      });
      tersimpan += 1;
    }
    // Teks halaman dibuang dari memori permintaan.
    for (const x of halaman) x.teks = "";
  }
  return { tersimpan, halamanBermedan };
}

function jsonAman(s, bawaan) {
  try {
    const v = JSON.parse(String(s || ""));
    return v && typeof v === "object" ? v : bawaan;
  } catch {
    return bawaan;
  }
}

/**
 * Usulan ABT + kalimat salin satu perkara dari bacaan yang tersimpan. Tidak pernah melempar ke pemanggil rute
 * isi-gugatan (dibungkus di sana). Mengembalikan juga ringkasan keadaan baca (berapa berkas belum dibaca).
 */
async function usulanPerkara({ nomorPerkara, sebutan = {}, isianLama = {} } = {}) {
  await pastikanSkema();
  const nomor = bersih(nomorPerkara, 191);
  if (!nomor) return { usulan: [], kalimat: [], catatan: [], ringkasan: { berkas: 0, terbaca: 0, belum: 0 } };
  const rows = await botDb().query(
    `SELECT m.file_id AS fileId, m.halaman, m.jenis, m.medan, m.pihak, m.sumber, d.judul_dokumen AS judul, d.peran_pengunggah AS pengunggah
       FROM aleta_bot_lampiran_medan m
       JOIN aleta_bot_ecourt_files f ON f.id = m.file_id
       JOIN aleta_bot_ecourt_documents d ON d.document_key = f.document_key
      WHERE m.nomor_perkara = ? ORDER BY m.file_id, m.halaman LIMIT 200`,
    [nomor]
  );
  const bacaan = (Array.isArray(rows) ? rows : []).map((r) => ({
    fileId: String(r.fileId),
    halaman: Number(r.halaman) || 1,
    jenis: String(r.jenis || ""),
    sumber: String(r.sumber || ""),
    judul: bersih(r.judul, 160),
    pengunggah: bersih(r.pengunggah, 60),
    medan: jsonAman(r.medan, {}),
    pihak: jsonAman(r.pihak, []),
  }));
  const st = await botDb().query(
    `SELECT COUNT(*) AS berkas, SUM(b.status = 'terbaca') AS terbaca, SUM(b.file_id IS NULL) AS belum
       FROM aleta_bot_ecourt_documents d JOIN aleta_bot_ecourt_files f ON f.document_key = d.document_key AND f.dihapus_retensi IS NULL
       LEFT JOIN aleta_bot_lampiran_baca b ON b.file_id = f.id
      WHERE d.nomor_perkara = ? AND ${SQL_JUDUL_LAMPIRAN} AND f.format <> 'word'`,
    [nomor]
  );
  const s0 = (Array.isArray(st) && st[0]) || {};
  const perkara = await K().cariPerkara({ nomorPerkara: nomor }).catch(() => null);
  const hasil = L.susunUsulan({ bacaan, sebutan, isianLama, jenisPerkara: perkara ? String(perkara.jenisPerkaraNama || "") : "" });
  const ringkasan = { berkas: Number(s0.berkas) || 0, terbaca: Number(s0.terbaca) || 0, belum: Number(s0.belum) || 0 };
  if (ringkasan.belum > 0) hasil.catatan.push(`${ringkasan.belum} lampiran e-Court perkara ini belum selesai dibaca (antrean latar) - usulan lampiran dapat bertambah.`);
  return { ...hasil, ringkasan };
}

/** Ringkasan keadaan pembacaan (angka saja) untuk layar Admin/ukur. */
async function ringkasan() {
  await pastikanSkema();
  const r = await botDb().query(
    `SELECT status, sebab, COUNT(*) AS n, SUM(halaman) AS halaman, SUM(halaman_ocr) AS ocr, ROUND(AVG(lama_ms)) AS rerata_ms FROM aleta_bot_lampiran_baca GROUP BY status, sebab`
  );
  const j = await botDb().query(`SELECT jenis, COUNT(*) AS n FROM aleta_bot_lampiran_medan GROUP BY jenis`);
  return { baca: Array.isArray(r) ? r : [], jenis: Array.isArray(j) ? j : [] };
}

module.exports = {
  DDL_BACA,
  DDL_MEDAN,
  SQL_JUDUL_LAMPIRAN,
  BATAS_BITA,
  pastikanSkema,
  antrian,
  berkas,
  barisMedan,
  simpan,
  usulanPerkara,
  ringkasan,
};
