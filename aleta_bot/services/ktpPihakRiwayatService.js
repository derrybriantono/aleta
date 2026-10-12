"use strict";

/**
 * ============================================================================
 * HISTORI PENARIKAN TANGGAL KTP PER NOMOR PERKARA (12 Okt 2026, butir 11)
 * ============================================================================
 *
 * Menjawab "apa saja yang sudah ditarik untuk perkara ini": berkas KTP e-Court
 * mana yang sudah dibaca, kapan, hasilnya per pihak, sebab gagal, percobaan
 * ke berapa, dan siapa yang memicunya (penyapu latar, panel ABT, atau tombol
 * Admin).
 *
 * Dua sumber:
 *   - KEADAAN SEKARANG per berkas: tabel aleta_bot_ktp_pihak (ktpPihakService).
 *     Bacaan ulang menimpanya, jadi tabel itu hanya tahu percobaan TERAKHIR.
 *   - RIWAYAT PERCOBAAN: tabel aleta_bot_ktp_pihak_riwayat di berkas ini, satu
 *     baris tiap kali sebuah berkas selesai dibaca (sejak tabel ini ada).
 *
 * KEJUJURAN
 *   - NIK tidak pernah dikirim keluar dari sini, dan nama pada KTP tidak
 *     dimuat di riwayat - cukup kedudukan pihak (Penggugat, Pemohon II, dst.).
 *   - Riwayat sebelum tabel ini ada tidak dapat dipulihkan; layar menyebutnya.
 *   - Mencatat riwayat TIDAK PERNAH menggagalkan penyimpanan hasil bacaan.
 *   - Tidak ada yang ditulis ke SIPP/ABT/e-Court. Tabelnya milik basis data bot.
 */

const DDL_KTP_PIHAK_RIWAYAT = `CREATE TABLE IF NOT EXISTS aleta_bot_ktp_pihak_riwayat (
  id BIGINT NOT NULL AUTO_INCREMENT,
  waktu DATETIME NOT NULL,
  file_id VARCHAR(64) NOT NULL,
  document_key VARCHAR(191) NOT NULL DEFAULT '',
  nomor_perkara VARCHAR(191) NOT NULL DEFAULT '',
  perkara_id BIGINT NULL,
  pemicu VARCHAR(16) NOT NULL DEFAULT '',
  status VARCHAR(16) NOT NULL DEFAULT '',
  sebab VARCHAR(255) NOT NULL DEFAULT '',
  percobaan INT NOT NULL DEFAULT 0,
  sumber_baca VARCHAR(16) NOT NULL DEFAULT '',
  jumlah_ktp INT NOT NULL DEFAULT 0,
  hasil TEXT NULL,
  PRIMARY KEY (id),
  INDEX idx_abkpr_nomor (nomor_perkara, waktu),
  INDEX idx_abkpr_waktu (waktu)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`;

const PEMICU_SAH = new Set(["latar", "panel", "manual", "salinan"]);
/** Riwayat lebih tua dari ini dibuang (hari). */
const SIMPAN_HARI = 400;
const BATAS_RIWAYAT_PER_PERKARA = 100;

let skemaJanji = null;

function botDb() {
  return require("./botDbService");
}

function ktpPihak() {
  return require("./ktpPihakService");
}

async function pastikanSkemaRiwayat() {
  if (!skemaJanji) {
    skemaJanji = (async () => {
      await ktpPihak().pastikanSkema();
      await botDb().query(DDL_KTP_PIHAK_RIWAYAT);
      return true;
    })().catch((galat) => {
      skemaJanji = null;
      throw galat;
    });
  }
  return skemaJanji;
}

function bersih(x, batas = 255) {
  return String(x == null ? "" : x).replace(/\s+/g, " ").trim().slice(0, batas);
}

// ---------------------------------------------------------------------------
// Fungsi murni
// ---------------------------------------------------------------------------

/** "yyyy-mm-dd" -> "dd/mm/yyyy"; selain itu "". */
function dmyDariIso(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ""));
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
}

/** Waktu "yyyy-mm-dd hh:mm:ss" (UTC) -> ISO 8601 dengan Z; selain itu "". */
function waktuIso(teks) {
  const m = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})/.exec(String(teks || ""));
  return m ? `${m[1]}T${m[2]}.000Z` : "";
}

/**
 * Hasil per pihak untuk satu percobaan, dari baris yang disusun susunBaris.
 * Tanpa NIK dan tanpa nama pada KTP.
 */
function ringkasHasilBaris(baris) {
  return (Array.isArray(baris) ? baris : []).slice(0, 5).map((b) => ({
    peran: bersih(b.peran, 64),
    cabang: b.cabang == null ? null : Number(b.cabang),
    urutan: b.urutan == null ? null : Number(b.urutan),
    tanggalKtp: dmyDariIso(b.tanggalKtpIso),
    yakin: bersih(b.yakin, 8),
    cocok: bersih(b.cocok, 16),
    sebab: bersih(b.sebab, 80),
  }));
}

/** Pola LIKE bagi kolom pencarian nomor perkara. Angka saja = awalan "556/". */
function polaCariNomor(cari) {
  const k = bersih(cari, 80).replace(/[%_\\]/g, (c) => `\\${c}`);
  if (!k) return "";
  return /^\d+$/.test(k) ? `${k}/%` : `%${k}%`;
}

function pemicuSah(p) {
  const x = bersih(p, 16).toLowerCase();
  return PEMICU_SAH.has(x) ? x : "";
}

// ---------------------------------------------------------------------------
// Pencatatan
// ---------------------------------------------------------------------------

/**
 * Catat satu percobaan baca. Dipanggil ktpPihakService.simpan/salinKembaran.
 * Tidak pernah melempar: riwayat adalah catatan, bukan syarat penyimpanan.
 */
async function catatRiwayat({ fileId, documentKey, nomorPerkara, perkaraId, pemicu, status, sebab, percobaan, sumberBaca, baris }) {
  try {
    await pastikanSkemaRiwayat();
    const hasil = ringkasHasilBaris(baris);
    const hasil_ = await botDb().query(
      `INSERT INTO aleta_bot_ktp_pihak_riwayat
         (waktu, file_id, document_key, nomor_perkara, perkara_id, pemicu, status, sebab, percobaan, sumber_baca, jumlah_ktp, hasil)
       VALUES (UTC_TIMESTAMP(), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        bersih(fileId, 64),
        bersih(documentKey, 191),
        bersih(nomorPerkara, 191),
        perkaraId == null ? null : Number(perkaraId),
        pemicuSah(pemicu),
        bersih(status, 16),
        bersih(sebab, 255),
        Math.max(0, Number(percobaan) || 0),
        bersih(sumberBaca, 16),
        hasil.length,
        hasil.length ? JSON.stringify(hasil) : null,
      ]
    );
    // Pangkas sesekali, bukan tiap tulis.
    const id = Number(hasil_ && hasil_.insertId) || 0;
    if (id > 0 && id % 200 === 0) {
      await botDb().query("DELETE FROM aleta_bot_ktp_pihak_riwayat WHERE waktu < UTC_TIMESTAMP() - INTERVAL ? DAY", [SIMPAN_HARI]);
    }
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Pembacaan untuk layar Admin
// ---------------------------------------------------------------------------

/** Angka besar: berapa berkas KTP ada, sudah dibaca, belum, gagal; berapa pihak bertanggal. */
async function ringkasanRiwayat() {
  await pastikanSkemaRiwayat();
  const [kandidat, baca, pihak, riwayat] = await Promise.all([
    botDb().query(
      `SELECT COUNT(DISTINCT d.nomor_perkara) AS perkara, COUNT(DISTINCT f.id) AS berkas
         FROM aleta_bot_ecourt_documents d
         JOIN aleta_bot_ecourt_files f ON f.document_key = d.document_key AND f.dihapus_retensi IS NULL
        WHERE ${ktpPihak().SQL_KANDIDAT}`
    ),
    botDb().query(
      `SELECT k.status AS status, COUNT(DISTINCT k.file_id) AS berkas
         FROM aleta_bot_ktp_pihak k
         JOIN aleta_bot_ecourt_files f ON f.id = k.file_id AND f.dihapus_retensi IS NULL
        GROUP BY k.status`
    ),
    botDb().query(
      `SELECT COUNT(*) AS pihak, COUNT(DISTINCT CONCAT(k.nomor_perkara, '|', k.cabang, '|', k.urutan)) AS pihakUnik,
              DATE_FORMAT(MAX(k.dibaca_pada), '%Y-%m-%d %H:%i:%s') AS terakhir
         FROM aleta_bot_ktp_pihak k
        WHERE k.status = 'terbaca' AND k.cabang IS NOT NULL AND k.tanggal_ktp IS NOT NULL`
    ),
    botDb().query("SELECT COUNT(*) AS n FROM aleta_bot_ktp_pihak_riwayat"),
  ]);
  const k = (Array.isArray(kandidat) && kandidat[0]) || {};
  const per = {};
  for (const r of Array.isArray(baca) ? baca : []) per[String(r.status)] = Number(r.berkas) || 0;
  const p = (Array.isArray(pihak) && pihak[0]) || {};
  const berkas = Number(k.berkas) || 0;
  const terbaca = per.terbaca || 0;
  const tidakTerbaca = per.tidak_terbaca || 0;
  const bukanKtp = per.bukan_ktp || 0;
  return {
    perkara: Number(k.perkara) || 0,
    berkas,
    terbaca,
    tidakTerbaca,
    bukanKtp,
    belumDibaca: Math.max(0, berkas - terbaca - tidakTerbaca - bukanKtp),
    pihakBertanggal: Number(p.pihakUnik) || 0,
    terakhirDibaca: waktuIso(p.terakhir),
    percobaanTercatat: Number((Array.isArray(riwayat) && riwayat[0] && riwayat[0].n) || 0),
  };
}

/**
 * Daftar perkara yang berkas KTP-nya sudah diproses, terbaru dulu.
 * cari: sebagian nomor perkara ("556" = nomor 556/...).
 */
async function daftarPerkara({ cari = "", batas = 30, mulai = 0 } = {}) {
  await pastikanSkemaRiwayat();
  const pola = polaCariNomor(cari);
  const ukuran = Math.min(Math.max(Number(batas) || 30, 1), 100);
  const awal = Math.max(Number(mulai) || 0, 0);
  const rows = await botDb().query(
    `SELECT k.nomor_perkara AS nomor, MAX(k.perkara_id) AS perkaraId,
            COUNT(DISTINCT k.file_id) AS berkas,
            COUNT(DISTINCT CASE WHEN k.status = 'terbaca' THEN k.file_id END) AS terbaca,
            COUNT(DISTINCT CASE WHEN k.status <> 'terbaca' THEN k.file_id END) AS gagal,
            COUNT(DISTINCT CASE WHEN k.status = 'terbaca' AND k.cabang IS NOT NULL AND k.tanggal_ktp IS NOT NULL
                                THEN CONCAT(k.cabang, '|', k.urutan) END) AS pihakBertanggal,
            DATE_FORMAT(MAX(k.dibaca_pada), '%Y-%m-%d %H:%i:%s') AS terakhir
       FROM aleta_bot_ktp_pihak k
      WHERE k.nomor_perkara <> '' ${pola ? "AND k.nomor_perkara LIKE ?" : ""}
      GROUP BY k.nomor_perkara
      ORDER BY MAX(k.dibaca_pada) DESC, k.nomor_perkara
      LIMIT ? OFFSET ?`,
    pola ? [pola, ukuran + 1, awal] : [ukuran + 1, awal]
  );
  const semua = Array.isArray(rows) ? rows : [];
  return {
    perkara: semua.slice(0, ukuran).map((r) => ({
      nomorPerkara: String(r.nomor),
      perkaraId: r.perkaraId == null ? null : Number(r.perkaraId),
      berkas: Number(r.berkas) || 0,
      terbaca: Number(r.terbaca) || 0,
      gagal: Number(r.gagal) || 0,
      pihakBertanggal: Number(r.pihakBertanggal) || 0,
      terakhirDibaca: waktuIso(r.terakhir),
    })),
    adaLagi: semua.length > ukuran,
  };
}

/** Rincian satu perkara: berkas + hasil per pihak, berkas belum dibaca, percobaan terdahulu. */
async function riwayatPerkara(nomorPerkara) {
  await pastikanSkemaRiwayat();
  const nomor = bersih(nomorPerkara, 191);
  if (!nomor) return { ok: false, alasan: "nomor_kosong" };
  const { SQL_KANDIDAT } = ktpPihak();

  const [sekarang, belum, percobaan, jumlahDokumen] = await Promise.all([
    botDb().query(
      `SELECT k.file_id AS fileId, k.urut, k.status, k.sebab, k.peran, k.cabang, k.urutan,
              DATE_FORMAT(k.tanggal_ktp, '%Y-%m-%d') AS tanggalKtp, k.yakin, k.cocok, k.sumber_baca AS sumberBaca,
              k.percobaan, k.versi, DATE_FORMAT(k.dibaca_pada, '%Y-%m-%d %H:%i:%s') AS dibacaPada,
              d.judul_dokumen AS judul, f.format AS format
         FROM aleta_bot_ktp_pihak k
         LEFT JOIN aleta_bot_ecourt_files f ON f.id = k.file_id
         LEFT JOIN aleta_bot_ecourt_documents d ON d.document_key = k.document_key
        WHERE k.nomor_perkara = ?
        ORDER BY k.dibaca_pada DESC, k.file_id, k.urut`,
      [nomor]
    ),
    botDb().query(
      `SELECT f.id AS fileId, d.judul_dokumen AS judul, f.format AS format
         FROM aleta_bot_ecourt_documents d
         JOIN aleta_bot_ecourt_files f ON f.document_key = d.document_key AND f.dihapus_retensi IS NULL
         LEFT JOIN aleta_bot_ktp_pihak k ON k.file_id = f.id AND k.urut = 1
        WHERE ${SQL_KANDIDAT} AND d.nomor_perkara = ? AND k.file_id IS NULL
        ORDER BY f.document_key, f.format`,
      [nomor]
    ),
    botDb().query(
      `SELECT DATE_FORMAT(r.waktu, '%Y-%m-%d %H:%i:%s') AS waktu, r.file_id AS fileId, r.pemicu, r.status, r.sebab,
              r.percobaan, r.sumber_baca AS sumberBaca, r.jumlah_ktp AS jumlahKtp, r.hasil
         FROM aleta_bot_ktp_pihak_riwayat r
        WHERE r.nomor_perkara = ?
        ORDER BY r.waktu DESC, r.id DESC
        LIMIT ?`,
      [nomor, BATAS_RIWAYAT_PER_PERKARA]
    ),
    botDb().query(`SELECT COUNT(*) AS n FROM aleta_bot_ecourt_documents d WHERE ${SQL_KANDIDAT} AND d.nomor_perkara = ?`, [nomor]),
  ]);

  const berkasPeta = new Map();
  for (const r of Array.isArray(sekarang) ? sekarang : []) {
    const id = String(r.fileId);
    let b = berkasPeta.get(id);
    if (!b) {
      b = {
        fileId: id,
        judul: bersih(r.judul, 255),
        format: bersih(r.format, 16),
        status: String(r.status),
        sebab: bersih(r.sebab, 255),
        percobaan: Number(r.percobaan) || 0,
        sumberBaca: bersih(r.sumberBaca, 16),
        versi: Number(r.versi) || 0,
        dibacaPada: waktuIso(r.dibacaPada),
        pihak: [],
      };
      berkasPeta.set(id, b);
    }
    if (r.status === "terbaca") {
      b.pihak.push({
        peran: bersih(r.peran, 64),
        cabang: r.cabang == null ? null : Number(r.cabang),
        urutan: r.urutan == null ? null : Number(r.urutan),
        tanggalKtp: dmyDariIso(r.tanggalKtp),
        yakin: bersih(r.yakin, 8),
        cocok: bersih(r.cocok, 16),
        sebab: bersih(r.sebab, 80),
      });
    }
  }

  return {
    ok: true,
    nomorPerkara: nomor,
    dokumenKtp: Number((Array.isArray(jumlahDokumen) && jumlahDokumen[0] && jumlahDokumen[0].n) || 0),
    berkas: [...berkasPeta.values()],
    belumDibaca: (Array.isArray(belum) ? belum : []).map((r) => ({
      fileId: String(r.fileId),
      judul: bersih(r.judul, 255),
      format: bersih(r.format, 16),
    })),
    percobaan: (Array.isArray(percobaan) ? percobaan : []).map((r) => {
      let hasil = [];
      try {
        const x = r.hasil ? JSON.parse(r.hasil) : [];
        hasil = Array.isArray(x) ? x : [];
      } catch {
        hasil = [];
      }
      return {
        waktu: waktuIso(r.waktu),
        fileId: String(r.fileId),
        pemicu: String(r.pemicu || ""),
        status: String(r.status),
        sebab: bersih(r.sebab, 255),
        percobaan: Number(r.percobaan) || 0,
        sumberBaca: bersih(r.sumberBaca, 16),
        jumlahKtp: Number(r.jumlahKtp) || 0,
        hasil,
      };
    }),
  };
}

/**
 * Minta berkas KTP satu perkara dibaca ULANG, tanpa membuang tanggal yang sudah
 * ada: barisnya ditandai usang (versi 0, percobaan 0, tampak sudah lama) sehingga
 * antrian() mengambilnya lagi; bacaan lama baru diganti bila bacaan baru berhasil
 * ditulis (simpan() menghapus-lalu-menulis per berkas).
 */
async function bacaUlangPerkara(nomorPerkara) {
  await pastikanSkemaRiwayat();
  const nomor = bersih(nomorPerkara, 191);
  if (!nomor) return { ok: false, alasan: "nomor_kosong" };
  const r = await botDb().query(
    `UPDATE aleta_bot_ktp_pihak
        SET versi = 0, percobaan = 0, dibaca_pada = UTC_TIMESTAMP() - INTERVAL 2 DAY
      WHERE nomor_perkara = ?`,
    [nomor]
  );
  const belum = await botDb().query(
    `SELECT COUNT(*) AS n
       FROM aleta_bot_ecourt_documents d
       JOIN aleta_bot_ecourt_files f ON f.document_key = d.document_key AND f.dihapus_retensi IS NULL
       LEFT JOIN aleta_bot_ktp_pihak k ON k.file_id = f.id AND k.urut = 1
      WHERE ${ktpPihak().SQL_KANDIDAT} AND d.nomor_perkara = ? AND k.file_id IS NULL`,
    [nomor]
  );
  return {
    ok: true,
    nomorPerkara: nomor,
    ditandai: Number((r && r.affectedRows) || 0),
    antri: Number((Array.isArray(belum) && belum[0] && belum[0].n) || 0) + Number((r && r.affectedRows) || 0) > 0,
  };
}

module.exports = {
  DDL_KTP_PIHAK_RIWAYAT,
  SIMPAN_HARI,
  pastikanSkemaRiwayat,
  dmyDariIso,
  waktuIso,
  ringkasHasilBaris,
  polaCariNomor,
  pemicuSah,
  catatRiwayat,
  ringkasanRiwayat,
  daftarPerkara,
  riwayatPerkara,
  bacaUlangPerkara,
};
