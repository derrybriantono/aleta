"use strict";

/**
 * Mencari perkara milik sebuah nomor WhatsApp.
 *
 * Ini kebalikan dari publicQaVerificationService: di sana kita bertanya
 * "apakah nomor ini berhak atas perkara X?", di sini kita bertanya
 * "perkara apa saja yang boleh diakses nomor ini?".
 *
 * Arah balik itulah yang memungkinkan menu pilihan: pengguna tidak perlu lagi
 * mengingat dan mengetik nomor perkaranya sendiri — bot yang menyodorkan
 * daftarnya. Aturan aksesnya tetap sama persis, yaitu nomor WhatsApp pengirim
 * harus tercatat sebagai pihak atau kuasa pada perkara tersebut. Menu ini
 * TIDAK menambah kewenangan apa pun; ia hanya menampilkan apa yang memang
 * sudah boleh diakses nomor itu.
 */

const db = require("../db_config");
const { normalizeIndonesianPhoneNumber } = require("../utils/phoneFormatter");

/** Batas wajar; seorang pihak jarang punya perkara sebanyak ini. */
const MAX_CASES_PER_PHONE = 20;
/** Hasil pencarian ditahan sebentar agar menu tidak memukul SIPP berulang. */
const CACHE_TTL_MS = 60 * 1000;

const cache = new Map();

function runQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (error, rows) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(Array.isArray(rows) ? rows : []);
    });
  });
}

/**
 * Nomor telepon di SIPP ditulis dengan berbagai gaya (0812…, 62812…, +62812…,
 * berspasi, bertanda hubung). Pencocokan dilakukan pada digit murni supaya
 * semua gaya itu tetap ketemu.
 */
function phoneMatchKeys(input) {
  const normalized = normalizeIndonesianPhoneNumber(String(input || "").replace(/@c\.us$/i, ""));
  if (!normalized) return [];
  const keys = new Set([normalized]);
  if (normalized.startsWith("62")) {
    keys.add(`0${normalized.slice(2)}`);
    keys.add(`+${normalized}`);
  }
  return [...keys];
}

/** Membandingkan dua nomor tanpa peduli format penulisannya. */
function samePhone(left, right) {
  const a = normalizeIndonesianPhoneNumber(String(left || "").replace(/@c\.us$/i, ""));
  const b = normalizeIndonesianPhoneNumber(String(right || "").replace(/@c\.us$/i, ""));
  return Boolean(a && b && a === b);
}

/**
 * Daftar perkara yang boleh diakses satu nomor WhatsApp.
 *
 * Penyaringan akhir tetap dilakukan di sisi aplikasi memakai samePhone(),
 * bukan hanya mengandalkan pencocokan SQL — data telepon SIPP terlalu beragam
 * formatnya untuk dipercayakan pada perbandingan string mentah.
 */
async function listCasesForPhone(senderNumber) {
  const normalized = normalizeIndonesianPhoneNumber(String(senderNumber || "").replace(/@c\.us$/i, ""));
  if (!normalized) return [];

  const cached = cache.get(normalized);
  if (cached && cached.expiresAt > Date.now()) return cached.cases;

  const keys = phoneMatchKeys(normalized);
  if (keys.length === 0) return [];
  const placeholders = keys.map(() => "?").join(", ");

  // Dua sumber: pihak berperkara dan kuasa hukumnya. Keduanya berhak.
  const sql = `
    SELECT
      c.perkara_id,
      c.nomor_perkara,
      a.nama,
      a.pihak_ke,
      'pihak' AS recipient_type,
      b.telepon
    FROM v_pihak_perkara a
    JOIN perkara c ON c.perkara_id = a.perkara_id
    LEFT JOIN pihak b ON b.id = a.pihak_id
    WHERE REPLACE(REPLACE(REPLACE(IFNULL(b.telepon, ''), ' ', ''), '-', ''), '.', '') IN (${placeholders})
    UNION ALL
    SELECT
      c.perkara_id,
      c.nomor_perkara,
      a.nama,
      a.pihak_ke,
      'kuasa' AS recipient_type,
      b.telepon
    FROM perkara_pengacara a
    JOIN perkara c ON c.perkara_id = a.perkara_id
    LEFT JOIN pihak b ON b.id = a.pengacara_id
    WHERE REPLACE(REPLACE(REPLACE(IFNULL(b.telepon, ''), ' ', ''), '-', ''), '.', '') IN (${placeholders})
  `;

  const rows = await runQuery(sql, [...keys, ...keys]);

  const seen = new Set();
  const cases = [];
  for (const row of rows) {
    // Pengaman kedua: format telepon SIPP terlalu beragam untuk dipercaya
    // hasil pencocokan SQL-nya saja.
    if (!samePhone(normalized, row.telepon)) continue;
    const nomorPerkara = String(row.nomor_perkara || "").trim();
    if (!nomorPerkara || seen.has(nomorPerkara)) continue;
    seen.add(nomorPerkara);
    cases.push({
      perkaraId: row.perkara_id,
      nomorPerkara,
      nama: String(row.nama || "").trim(),
      pihakKe: row.pihak_ke || "",
      recipientType: row.recipient_type === "kuasa" ? "kuasa" : "pihak",
      jenisPerkara: describeCaseType(nomorPerkara),
    });
    if (cases.length >= MAX_CASES_PER_PHONE) break;
  }

  cache.set(normalized, { cases, expiresAt: Date.now() + CACHE_TTL_MS });
  return cases;
}

/** Jenis perkara dibaca dari kode pada nomor perkara, untuk label menu. */
function describeCaseType(nomorPerkara) {
  const raw = String(nomorPerkara || "");
  if (/Pdt\.G\.S/i.test(raw)) return "Gugatan Sederhana";
  if (/Pdt\.G/i.test(raw)) return "Gugatan";
  if (/Pdt\.P/i.test(raw)) return "Permohonan";
  if (/Pid\.Sus-Anak/i.test(raw)) return "Pidana Anak";
  if (/Pid\.Pra/i.test(raw)) return "Praperadilan";
  if (/Pid\.B/i.test(raw)) return "Pidana Biasa";
  if (/Pid\.S/i.test(raw)) return "Pidana Singkat";
  if (/Pid\.C/i.test(raw)) return "Pidana Cepat";
  if (/JN\.Pra/i.test(raw)) return "Jinayat Praperadilan";
  if (/JN/i.test(raw)) return "Jinayat";
  return "Perkara";
}

/** Peran pihak pada perkara, untuk label menu. */
function describeRole(item = {}) {
  if (item.recipientType === "kuasa") return "Kuasa Hukum";
  const jenis = String(item.jenisPerkara || "");
  const ke = String(item.pihakKe || "").toLowerCase();
  if (jenis === "Permohonan") return ke === "2" || ke === "t" ? "Termohon" : "Pemohon";
  if (ke === "2" || ke === "t") return "Tergugat";
  if (ke === "1" || ke === "p") return "Penggugat";
  return "Pihak";
}

/** Membuang cache satu nomor. Dipakai bila data perkaranya baru berubah. */
function forgetPhone(senderNumber) {
  const normalized = normalizeIndonesianPhoneNumber(String(senderNumber || "").replace(/@c\.us$/i, ""));
  if (normalized) cache.delete(normalized);
}

function clearCache() {
  cache.clear();
}

module.exports = {
  MAX_CASES_PER_PHONE,
  clearCache,
  describeCaseType,
  describeRole,
  forgetPhone,
  listCasesForPhone,
  samePhone,
};
