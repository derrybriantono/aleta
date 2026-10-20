"use strict";

/**
 * ============================================================================
 * KUNCI PENETAPAN PER PERKARA - SATU PERKARA, SATU PEKERJAAN PADA SATU WAKTU
 * ============================================================================
 *
 * Penetapan PMH/PPP/PJS/PHS satu perkara dapat dipicu dari beberapa jalan:
 * kartu Penetapan ekstensi (otomatis atau manual), tombol di halaman SIPP,
 * penanda halaman SIPP, antrean jam kerja, dan borang SIPP yang diisi lalu
 * disimpan peramban. Tanpa pagar bersama, dua jalan yang berpapasan membaca
 * keadaan yang sama ("belum ada") dan menulis dua kali, atau yang kedua
 * menimpa pekerjaan yang pertama.
 *
 * Kunci ini adalah SATU pagar untuk semuanya: satu baris per perkara di basis
 * data ALETA (bukan di SIPP, yang tidak boleh memuat jejak ALETA), dengan masa
 * berlaku. Masa berlaku itu penting - peramban yang ditutup di tengah jalan
 * tidak boleh mengunci perkara selamanya.
 *
 * Kunci TIDAK menggantikan pemeriksaan keadaan: pekerjaan yang memegang kunci
 * tetap membaca keadaan SIPP tepat sebelum menulis dan melewati yang sudah ada.
 * Kunci mencegah dua pekerjaan berjalan bersamaan; keadaan mencegah menulis
 * ulang yang sudah tertulis.
 *
 * GAGAL TERTUTUP. Bila basis data ALETA tidak menjawab, kunci tidak dapat
 * diambil dan penulisan DITAHAN (alasan kunci_tidak_tersedia). Menulis ke
 * SIPP tanpa pagar lebih mahal daripada menunggu sebentar.
 *
 * Waktu memakai UTC_TIMESTAMP() basis data (kolom DATETIME ALETA disimpan UTC),
 * bukan jam proses: dua proses dengan jam berbeda tetap sepakat soal kedaluwarsa.
 */

const crypto = require("crypto");

const TABEL = "aleta_bot_kunci_penetapan";
const TTL_BAWAAN_DETIK = 180;
const TTL_TERPENDEK_DETIK = 10;
const TTL_TERPANJANG_DETIK = 900;

const SQL_SKEMA = `
  CREATE TABLE IF NOT EXISTS ${TABEL} (
    perkara_id INT NOT NULL,
    token VARCHAR(64) NOT NULL,
    pemilik VARCHAR(160) NOT NULL DEFAULT '',
    tujuan VARCHAR(80) NOT NULL DEFAULT '',
    diambil DATETIME NOT NULL,
    sampai DATETIME NOT NULL,
    PRIMARY KEY (perkara_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`;

function ttlSah(nilai) {
  const n = Math.round(Number(nilai));
  if (!Number.isFinite(n) || n <= 0) return TTL_BAWAAN_DETIK;
  return Math.min(Math.max(n, TTL_TERPENDEK_DETIK), TTL_TERPANJANG_DETIK);
}

function idSah(perkaraId) {
  const id = Number(perkaraId);
  return Number.isInteger(id) && id > 0 ? id : 0;
}

function potong(nilai, panjang) {
  return String(nilai == null ? "" : nilai).replace(/\s+/g, " ").trim().slice(0, panjang);
}

function buatLayanan({ db } = {}) {
  const basis = db || require("./botDbService");
  const q = (sql, params = []) => basis.query(sql, params);
  let skemaSiap = false;

  async function pastikanSkema() {
    if (skemaSiap) return;
    await q(SQL_SKEMA);
    skemaSiap = true;
  }

  const bacaBaris = async (id) => {
    const baris = await q(
      `SELECT perkara_id, token, pemilik, tujuan,
              DATE_FORMAT(diambil, '%Y-%m-%d %H:%i:%s') AS diambil,
              DATE_FORMAT(sampai, '%Y-%m-%d %H:%i:%s') AS sampai,
              (sampai >= UTC_TIMESTAMP()) AS hidup
         FROM ${TABEL} WHERE perkara_id = ? LIMIT 1`,
      [id]
    );
    return (Array.isArray(baris) && baris[0]) || null;
  };

  /**
   * Mengambil kunci satu perkara.
   * Pulang { ok:true, token, sampai } atau
   *        { ok:false, alasan:"sedang_dikerjakan", oleh, tujuan, sampai } atau
   *        { ok:false, alasan:"kunci_tidak_tersedia", pesan }.
   *
   * `tokenLama` yang masih berlaku dan cocok = pemilik yang sama memperpanjang
   * (tidak ditolak oleh dirinya sendiri).
   */
  async function ambil({ perkaraId, pemilik = "", tujuan = "", ttlDetik, tokenLama = "" } = {}) {
    const id = idSah(perkaraId);
    if (!id) return { ok: false, alasan: "perkara_tidak_sah" };
    const ttl = ttlSah(ttlDetik);
    try {
      await pastikanSkema();
      if (tokenLama) {
        const r = await q(
          `UPDATE ${TABEL} SET sampai = DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? SECOND)
            WHERE perkara_id = ? AND token = ? AND sampai >= UTC_TIMESTAMP()`,
          [ttl, id, String(tokenLama)]
        );
        if (Number(r && r.affectedRows) === 1) {
          const baris = await bacaBaris(id);
          return { ok: true, token: String(tokenLama), sampai: baris ? baris.sampai : "", diperpanjang: true };
        }
      }
      // Yang sudah kedaluwarsa dibuang dulu; INSERT berikutnya hanya berhasil
      // bagi SATU pemanggil (kunci utama perkara_id), yang kalah membaca
      // pemegang sebenarnya.
      await q(`DELETE FROM ${TABEL} WHERE perkara_id = ? AND sampai < UTC_TIMESTAMP()`, [id]);
      const token = crypto.randomBytes(16).toString("hex");
      const masuk = await q(
        `INSERT IGNORE INTO ${TABEL} (perkara_id, token, pemilik, tujuan, diambil, sampai)
         VALUES (?,?,?,?, UTC_TIMESTAMP(), DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? SECOND))`,
        [id, token, potong(pemilik, 160), potong(tujuan, 80), ttl]
      );
      if (Number(masuk && masuk.affectedRows) === 1) {
        const baris = await bacaBaris(id);
        return { ok: true, token, sampai: baris ? baris.sampai : "" };
      }
      const ada = await bacaBaris(id);
      return {
        ok: false,
        alasan: "sedang_dikerjakan",
        oleh: ada ? String(ada.pemilik || "") : "",
        tujuan: ada ? String(ada.tujuan || "") : "",
        sampai: ada ? String(ada.sampai || "") : "",
      };
    } catch (galat) {
      return { ok: false, alasan: "kunci_tidak_tersedia", pesan: String((galat && galat.message) || galat).slice(0, 200) };
    }
  }

  /** Memperpanjang kunci yang dipegang (dipanggil tiap langkah panjang). */
  async function perpanjang({ perkaraId, token, ttlDetik } = {}) {
    const id = idSah(perkaraId);
    if (!id || !token) return { ok: false, alasan: "kunci_tidak_sah" };
    try {
      await pastikanSkema();
      const r = await q(
        `UPDATE ${TABEL} SET sampai = DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? SECOND)
          WHERE perkara_id = ? AND token = ? AND sampai >= UTC_TIMESTAMP()`,
        [ttlSah(ttlDetik), id, String(token)]
      );
      return Number(r && r.affectedRows) === 1 ? { ok: true } : { ok: false, alasan: "kunci_hilang" };
    } catch (galat) {
      return { ok: false, alasan: "kunci_tidak_tersedia", pesan: String((galat && galat.message) || galat).slice(0, 200) };
    }
  }

  /** Melepas kunci. Hanya pemegang tokennya; kegagalan melepas tidak dilempar. */
  async function lepas({ perkaraId, token } = {}) {
    const id = idSah(perkaraId);
    if (!id || !token) return { ok: false, alasan: "kunci_tidak_sah" };
    try {
      await pastikanSkema();
      const r = await q(`DELETE FROM ${TABEL} WHERE perkara_id = ? AND token = ?`, [id, String(token)]);
      return { ok: true, dilepas: Number(r && r.affectedRows) === 1 };
    } catch (galat) {
      return { ok: false, alasan: "kunci_tidak_tersedia", pesan: String((galat && galat.message) || galat).slice(0, 200) };
    }
  }

  /** Keadaan kunci untuk layar: { aktif, oleh, tujuan, sampai }. Token TIDAK pernah dikirim. */
  async function lihat(perkaraId) {
    const id = idSah(perkaraId);
    if (!id) return { aktif: false };
    try {
      await pastikanSkema();
      const baris = await bacaBaris(id);
      if (!baris || !Number(baris.hidup)) return { aktif: false };
      return { aktif: true, oleh: String(baris.pemilik || ""), tujuan: String(baris.tujuan || ""), sampai: String(baris.sampai || "") };
    } catch {
      return { aktif: false, tidakTerbaca: true };
    }
  }

  /**
   * Menjalankan `kerja` selagi memegang kunci, lalu melepasnya (juga bila
   * kerjanya melempar). Bila kunci tidak didapat, `kerja` TIDAK dijalankan.
   * `kerja` menerima { token, perpanjang() }.
   */
  async function dengan(minta, kerja) {
    const kunci = await ambil(minta || {});
    if (!kunci.ok) return { dikunci: false, kunci };
    const perkaraId = minta.perkaraId;
    try {
      const hasil = await kerja({
        token: kunci.token,
        perpanjang: () => perpanjang({ perkaraId, token: kunci.token, ttlDetik: minta.ttlDetik }),
      });
      return { dikunci: true, kunci, hasil };
    } finally {
      // Kunci yang hanya diperpanjang (tokenLama dari pemanggil) bukan milik
      // kita untuk dilepas; yang baru diambil di sini dilepas di sini.
      if (!kunci.diperpanjang) await lepas({ perkaraId, token: kunci.token });
    }
  }

  return { pastikanSkema, ambil, perpanjang, lepas, lihat, dengan };
}

let bawaan = null;
function layanan() {
  if (!bawaan) bawaan = buatLayanan();
  return bawaan;
}

module.exports = {
  TABEL,
  SQL_SKEMA,
  TTL_BAWAAN_DETIK,
  buatLayanan,
  layanan,
};
