/**
 * ============================================================================
 * PENANDA EKSEPSI & REKONVENSI DARI JAWABAN / DUPLIK TERGUGAT (butir 4, 6 Okt 2026)
 * ============================================================================
 *
 * Penyimpan (singgahan) hasil pembacaan dokumen e-Court jawaban dan duplik
 * Tergugat/Termohon. Yang MEMBACA bukan bot: pdfjs-dist dan tesseract hanya
 * ada di citra portal. Alurnya:
 *
 *   portal  GET  /sipp/penanda-jawaban/antrian   berkas yang belum dibaca
 *   portal  GET  /sipp/penanda-jawaban/berkas    isi satu berkas (per id berkas)
 *   portal       ekstrak teks (lapisan teks PDF / DOCX, OCR bila pindaian),
 *                nilai dengan src/lib/deteksi-eksepsi-rekonvensi.ts
 *   portal  POST /sipp/penanda-jawaban           hasilnya, per berkas
 *   bot     daftarSidang -> petaBanyakPerkara    SATU kueri untuk seluruh daftar
 *
 * Tiap berkas dibaca SEKALI. Kuncinya id baris aleta_bot_ecourt_files, dan
 * baris itu sendiri berkunci document_key + sidik_jari - unggahan ulang
 * berisi lain menjadi baris (dan pembacaan) baru dengan sendirinya.
 *
 * Yang dibaca ulang:
 *   - versi aturan portal lebih baru daripada versi yang tersimpan;
 *   - berkas yang TIDAK TERBACA sehari sebelumnya (OCR belum terpasang,
 *     berkas gagal diambil) - dicoba lagi sekali sehari, bukan tiap muat.
 *
 * Tabelnya milik basis data bot dan dibuat sendiri saat pertama dipakai
 * (CREATE TABLE IF NOT EXISTS), bukan migrasi Drizzle portal. SIPP tidak
 * disentuh sama sekali.
 *
 * TIDAK TERBACA BUKAN "TIDAK ADA": peta per perkara membedakan berkas yang
 * dibaca dan tidak menyebut apa pun (keadaan "") dari berkas yang belum/tidak
 * dapat dibaca (null). Layar hanya menyalakan penanda untuk "ada".
 */

const fs = require("fs");

/** Dokumen yang dibaca: unggahan Tergugat/Termohon berjenis Jawaban atau Duplik. */
const SQL_KANDIDAT = `d.peran_pengunggah = 'Tergugat'
       AND (d.jenis_dokumen IN ('Jawaban', 'Duplik')
            OR LOWER(d.judul_dokumen) REGEXP 'jawab|duplik|eksepsi')`;

const KEADAAN = new Set(["ada", "tidak", ""]);

let skemaJanji = null;

function botDb() {
  return require("./botDbService");
}

async function pastikanSkema() {
  if (!skemaJanji) {
    skemaJanji = (async () => {
      const db = botDb();
      const siap = await db.ensureSchema();
      if (!siap) throw new Error("Basis data bot belum siap.");
      await db.query(`
        CREATE TABLE IF NOT EXISTS aleta_bot_penanda_jawaban (
          file_id VARCHAR(64) PRIMARY KEY,
          document_key VARCHAR(191) NOT NULL DEFAULT '',
          nomor_perkara VARCHAR(191) NOT NULL DEFAULT '',
          terbaca TINYINT(1) NOT NULL DEFAULT 0,
          -- 'teks' (lapisan teks PDF / DOCX) atau 'ocr' (pindaian).
          sumber_teks VARCHAR(16) NOT NULL DEFAULT '',
          panjang_teks INT NOT NULL DEFAULT 0,
          -- 'ada' | 'tidak' | '' (tidak disebut). Tidak terbaca = '' dan terbaca 0.
          eksepsi VARCHAR(8) NOT NULL DEFAULT '',
          kalimat_eksepsi TEXT,
          rekonvensi VARCHAR(8) NOT NULL DEFAULT '',
          kalimat_rekonvensi TEXT,
          sebab VARCHAR(255) NOT NULL DEFAULT '',
          versi INT NOT NULL DEFAULT 0,
          dibaca_pada DATETIME NOT NULL,
          INDEX idx_abpj_perkara (nomor_perkara)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
      return true;
    })().catch((galat) => {
      skemaJanji = null;
      throw galat;
    });
  }
  return skemaJanji;
}

function bersih(x, batas = 500) {
  return String(x == null ? "" : x).replace(/\s+/g, " ").trim().slice(0, batas);
}

function daftarNomor(nomor) {
  return [...new Set((Array.isArray(nomor) ? nomor : []).map((x) => bersih(x, 191)).filter(Boolean))].slice(0, 500);
}

/**
 * Berkas yang perlu dibaca, perkara yang sedang tampil lebih dulu. Satu
 * dokumen dapat punya beberapa berkas (PDF dan Word); portal mengelompokkannya
 * menurut documentKey supaya OCR cukup sekali per dokumen.
 */
async function antrian({ nomor = [], batas = 12, versi = 0 } = {}) {
  await pastikanSkema();
  const utama = daftarNomor(nomor);
  const rows = await botDb().query(
    `SELECT f.id AS fileId, f.document_key AS documentKey, f.format, f.ukuran_byte AS ukuran,
            d.nomor_perkara AS nomorPerkara, d.judul_dokumen AS judul, d.jenis_dokumen AS jenis
       FROM aleta_bot_ecourt_documents d
       JOIN aleta_bot_ecourt_files f
         ON f.document_key = d.document_key AND f.dihapus_retensi IS NULL
       LEFT JOIN aleta_bot_penanda_jawaban p ON p.file_id = f.id
      WHERE ${SQL_KANDIDAT}
        AND (p.file_id IS NULL
             OR p.versi < ?
             OR (p.terbaca = 0 AND p.dibaca_pada < UTC_TIMESTAMP() - INTERVAL 1 DAY))
      ORDER BY (d.nomor_perkara IN (?)) DESC, d.diunggah_pada DESC, f.document_key, f.format
      LIMIT ?`,
    [Number(versi) || 0, utama.length ? utama : [""], Math.min(Math.max(Number(batas) || 12, 1), 50)]
  );
  return (Array.isArray(rows) ? rows : []).map((r) => ({
    fileId: String(r.fileId),
    documentKey: String(r.documentKey),
    format: String(r.format || ""),
    ukuran: Number(r.ukuran) || 0,
    nomorPerkara: bersih(r.nomorPerkara, 191),
    judul: bersih(r.judul, 255),
    jenis: bersih(r.jenis, 64),
  }));
}

/** Isi satu berkas kandidat - hanya berkas jawaban/duplik Tergugat yang boleh diambil lewat jalur ini. */
async function berkas(fileId) {
  const id = bersih(fileId, 64);
  if (!id) return { ok: false, alasan: "file_id_kosong" };
  const rows = await botDb().query(
    `SELECT f.jalur_berkas AS jalur
       FROM aleta_bot_ecourt_files f
       JOIN aleta_bot_ecourt_documents d ON d.document_key = f.document_key
      WHERE f.id = ? AND f.dihapus_retensi IS NULL AND ${SQL_KANDIDAT}
      LIMIT 1`,
    [id]
  );
  const baris = Array.isArray(rows) ? rows[0] : null;
  if (!baris || !baris.jalur) return { ok: false, alasan: "berkas_tidak_ada" };
  const hasil = require("./ecourtDocumentService").describeEcourtDocument(baris.jalur);
  if (!hasil.ok) return { ok: false, alasan: bersih(hasil.reason, 200) };
  try {
    return { ok: true, isi: fs.readFileSync(hasil.absolutePath) };
  } catch (galat) {
    return { ok: false, alasan: `berkas_tidak_terbaca: ${bersih(galat.message, 150)}` };
  }
}

/** Hasil pembacaan dari portal, per berkas. Nilai di luar daftar dibuang, bukan disimpan. */
async function simpan(daftar = []) {
  await pastikanSkema();
  const db = botDb();
  let tersimpan = 0;
  for (const h of (Array.isArray(daftar) ? daftar : []).slice(0, 100)) {
    const fileId = bersih(h && h.fileId, 64);
    if (!fileId) continue;
    const ada = await db.query(
      `SELECT f.document_key AS documentKey, d.nomor_perkara AS nomorPerkara
         FROM aleta_bot_ecourt_files f
         JOIN aleta_bot_ecourt_documents d ON d.document_key = f.document_key
        WHERE f.id = ? AND ${SQL_KANDIDAT} LIMIT 1`,
      [fileId]
    );
    const asal = Array.isArray(ada) ? ada[0] : null;
    if (!asal) continue;
    const terbaca = Boolean(h.terbaca);
    const eksepsi = terbaca && KEADAAN.has(h.eksepsi) ? h.eksepsi : "";
    const rekonvensi = terbaca && KEADAAN.has(h.rekonvensi) ? h.rekonvensi : "";
    const nilai = [
      fileId,
      asal.documentKey,
      asal.nomorPerkara,
      terbaca ? 1 : 0,
      ["teks", "ocr"].includes(h.sumber) ? h.sumber : "",
      Math.max(0, Math.min(Number(h.panjang) || 0, 2147483647)),
      eksepsi,
      eksepsi ? bersih(h.kalimatEksepsi, 400) : "",
      rekonvensi,
      rekonvensi ? bersih(h.kalimatRekonvensi, 400) : "",
      bersih(h.sebab, 255),
      Math.max(0, Number(h.versi) || 0),
    ];
    await db.query(
      `INSERT INTO aleta_bot_penanda_jawaban
         (file_id, document_key, nomor_perkara, terbaca, sumber_teks, panjang_teks,
          eksepsi, kalimat_eksepsi, rekonvensi, kalimat_rekonvensi, sebab, versi, dibaca_pada)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, UTC_TIMESTAMP())
       ON DUPLICATE KEY UPDATE
         document_key = VALUES(document_key), nomor_perkara = VALUES(nomor_perkara),
         terbaca = VALUES(terbaca), sumber_teks = VALUES(sumber_teks), panjang_teks = VALUES(panjang_teks),
         eksepsi = VALUES(eksepsi), kalimat_eksepsi = VALUES(kalimat_eksepsi),
         rekonvensi = VALUES(rekonvensi), kalimat_rekonvensi = VALUES(kalimat_rekonvensi),
         sebab = VALUES(sebab), versi = VALUES(versi), dibaca_pada = VALUES(dibaca_pada)`,
      nilai
    );
    tersimpan += 1;
  }
  return { tersimpan };
}

function tanggalIso(x) {
  if (!x) return "";
  if (x instanceof Date) return Number.isNaN(x.getTime()) ? "" : x.toISOString().slice(0, 10);
  return String(x).slice(0, 10);
}

/**
 * Baris kueri (satu per berkas) -> keadaan per perkara. Murni - diuji tanpa
 * basis data (src/test/penanda-jawaban.test.ts).
 *
 *   eksepsi / rekonvensi:
 *     null                         tidak satu pun berkas terbaca - layar DIAM
 *     { keadaan: "ada", ... }      sekurangnya satu berkas mengajukannya
 *     { keadaan: "tidak", ... }    disangkal tegas, dan tidak ada yang mengajukan
 *     { keadaan: "", ... }         terbaca, tidak disebut
 *   Sumbernya (judul dokumen, jenis, tanggal unggah, kalimat) dari dokumen
 *   TERAWAL yang mengajukannya - di situlah eksepsi/rekonvensi lahir.
 */
function ringkasPerPerkara(rows = []) {
  const peta = {};
  // Driver mysql dapat memulangkan Date maupun teks - keduanya diurut sebagai ISO.
  const waktu = (x) => (x instanceof Date ? (Number.isNaN(x.getTime()) ? "" : x.toISOString()) : String(x || ""));
  const urut = (Array.isArray(rows) ? rows : [])
    .slice()
    .sort((a, b) => waktu(a.diunggahPada).localeCompare(waktu(b.diunggahPada)));
  for (const r of urut) {
    const nomor = bersih(r.nomorPerkara, 191);
    if (!nomor) continue;
    if (!peta[nomor]) {
      peta[nomor] = { dokumen: 0, berkas: 0, dibaca: 0, belumDibaca: 0, tidakTerbaca: 0, eksepsi: null, rekonvensi: null, _dok: new Set() };
    }
    const p = peta[nomor];
    p.berkas += 1;
    p._dok.add(String(r.documentKey || ""));
    if (r.fileIdCache == null) {
      p.belumDibaca += 1;
      continue;
    }
    if (!Number(r.terbaca)) {
      p.tidakTerbaca += 1;
      continue;
    }
    p.dibaca += 1;
    for (const jenis of ["eksepsi", "rekonvensi"]) {
      const keadaan = KEADAAN.has(r[jenis]) ? r[jenis] : "";
      const kini = p[jenis];
      const peringkat = { ada: 3, tidak: 2, "": 1 };
      if (kini && peringkat[kini.keadaan] >= peringkat[keadaan]) continue;
      p[jenis] = {
        keadaan,
        dokumen: bersih(r.judul, 255),
        jenisDokumen: bersih(r.jenis, 64),
        diunggah: tanggalIso(r.diunggahPada),
        kalimat: keadaan ? bersih(jenis === "eksepsi" ? r.kalimatEksepsi : r.kalimatRekonvensi, 400) : "",
        sumber: r.sumberTeks === "ocr" ? "ocr" : "teks",
      };
    }
  }
  for (const p of Object.values(peta)) {
    p.dokumen = p._dok.size;
    delete p._dok;
  }
  return peta;
}

/** Keadaan per perkara untuk daftar sidang - SATU kueri untuk seluruh daftar. */
async function petaBanyakPerkara(daftarNomorPerkara = []) {
  const nomor = daftarNomor(daftarNomorPerkara);
  if (nomor.length === 0) return {};
  await pastikanSkema();
  const rows = await botDb().query(
    `SELECT d.nomor_perkara AS nomorPerkara, d.document_key AS documentKey, d.judul_dokumen AS judul,
            d.jenis_dokumen AS jenis, d.diunggah_pada AS diunggahPada,
            p.file_id AS fileIdCache, p.terbaca, p.sumber_teks AS sumberTeks,
            p.eksepsi, p.kalimat_eksepsi AS kalimatEksepsi,
            p.rekonvensi, p.kalimat_rekonvensi AS kalimatRekonvensi
       FROM aleta_bot_ecourt_documents d
       JOIN aleta_bot_ecourt_files f
         ON f.document_key = d.document_key AND f.dihapus_retensi IS NULL
       LEFT JOIN aleta_bot_penanda_jawaban p ON p.file_id = f.id
      WHERE ${SQL_KANDIDAT}
        AND d.nomor_perkara IN (?)`,
    [nomor]
  );
  return ringkasPerPerkara(rows);
}

module.exports = { antrian, berkas, simpan, petaBanyakPerkara, ringkasPerPerkara, SQL_KANDIDAT };
