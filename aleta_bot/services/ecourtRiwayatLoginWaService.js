"use strict";

/**
 * ============================================================================
 * RIWAYAT LOGIN e-COURT LEWAT WHATSAPP - UNTUK RIWAYAT e-COURT PORTAL (18 Okt 2026)
 * ============================================================================
 *
 * Keputusan pengguna (butir 4): riwayat login e-Court lewat WhatsApp tampil di riwayat
 * e-Court portal, HANYA untuk Super Admin dan Admin.
 *
 * Sumbernya jejak keamanan bot sendiri (aleta_bot_system_logs), yang SUDAH ditulis
 * ecourtLoginService (ecourt_login_berhasil / ecourt_login_gagal, metadata.jalur) dan
 * ecourtPulihService (ecourt_wa_captcha_dikirim / _kedaluwarsa / _dibatalkan):
 *
 *   ecourt_login_*       hanya yang berjalur "whatsapp" (login lewat portal sudah punya
 *                        jejak per pengguna: aksi "sambung");
 *   ecourt_wa_captcha_*  semuanya.
 *
 * Rute ini hanya MEMBACA. Metadata disaring ke kunci yang diketahui aman (jalur, hasil,
 * jalur pendaratan tanpa query, sumber) - sandi, surel, cookie, dan isi captcha tidak
 * pernah ada di jejak itu dan tidak akan keluar dari sini kalau kelak ikut tertulis.
 */

const POLA_PERISTIWA = Object.freeze(["ecourt\\_login\\_%", "ecourt\\_wa\\_captcha\\_%"]);
const KUNCI_AMAN = Object.freeze(["jalur", "berhasil", "jalurMendarat", "lewatGerbang", "sumber", "manual", "slot", "kedaluwarsaMenit"]);
const BATAS_MAKS = 500;
const BATAS_BAWAAN = 200;

function bersih(nilai) {
  return String(nilai === null || nilai === undefined ? "" : nilai).trim();
}

/** Metadata JSON -> objek hanya berkunci aman, nilai skalar dipangkas. Murni. */
function metadataAman(mentah) {
  let objek = mentah;
  if (typeof mentah === "string") {
    try {
      objek = JSON.parse(mentah);
    } catch {
      return {};
    }
  }
  if (!objek || typeof objek !== "object") return {};
  const hasil = {};
  for (const k of KUNCI_AMAN) {
    const v = objek[k];
    if (typeof v === "boolean" || typeof v === "number") hasil[k] = v;
    else if (typeof v === "string") hasil[k] = v.slice(0, 120);
  }
  return hasil;
}

/** Waktu kolom created_at (UTC, "YYYY-MM-DD HH:MM:SS" atau Date) -> ISO UTC. "" bila tak terbaca. Murni. */
function keIsoUtc(nilai) {
  if (nilai instanceof Date) return Number.isNaN(nilai.getTime()) ? "" : nilai.toISOString();
  const teks = bersih(nilai);
  const m = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})/.exec(teks);
  return m ? `${m[1]}T${m[2]}.000Z` : "";
}

/** Waktu ISO -> "YYYY-MM-DD HH:MM:SS" (UTC) untuk pembanding kolom. "" bila tak sah. Murni. */
function keMysqlUtc(iso) {
  const t = new Date(bersih(iso));
  return Number.isNaN(t.getTime()) ? "" : t.toISOString().slice(0, 19).replace("T", " ");
}

/** Satu baris aleta_bot_system_logs -> peristiwa, atau null bila bukan yang dicari. Murni. */
function bentukPeristiwa(baris) {
  const jenis = bersih(baris && baris.event_type);
  if (!/^ecourt_(?:login_|wa_captcha_)/.test(jenis)) return null;
  const metadata = metadataAman(baris.metadata_json);
  // Login lewat portal sudah tercatat per pengguna (aksi "sambung"); di sini hanya yang lewat WhatsApp.
  if (/^ecourt_login_/.test(jenis) && metadata.jalur !== "whatsapp") return null;
  const dibuat = keIsoUtc(baris.created_at);
  if (!dibuat) return null;
  return {
    id: bersih(baris.id).slice(0, 60),
    eventType: jenis,
    severity: bersih(baris.severity).slice(0, 12),
    message: bersih(baris.message).slice(0, 300),
    createdAt: dibuat,
    metadata,
  };
}

/**
 * @param {object} p { botDb, sejak (ISO, opsional), batas }
 * @returns {Promise<{ok:boolean, peristiwa: object[], alasan?: string}>}
 */
async function bacaPeristiwa(p = {}) {
  const botDb = p.botDb;
  if (!botDb || typeof botDb.query !== "function") return { ok: false, peristiwa: [], alasan: "basis_data_bot_tidak_tersedia" };
  const batas = Math.max(1, Math.min(BATAS_MAKS, Math.floor(Number(p.batas)) || BATAS_BAWAAN));
  const sejak = p.sejak ? keMysqlUtc(p.sejak) : "";
  const params = [...POLA_PERISTIWA];
  let sql =
    "SELECT id, event_type, severity, message, metadata_json, created_at FROM aleta_bot_system_logs " +
    "WHERE (event_type LIKE ? OR event_type LIKE ?)";
  if (sejak) {
    sql += " AND created_at >= ?";
    params.push(sejak);
  }
  sql += " ORDER BY created_at DESC LIMIT ?";
  params.push(batas);
  let baris;
  try {
    baris = await botDb.query(sql, params);
  } catch (galat) {
    return { ok: false, peristiwa: [], alasan: `basis_data_bot_galat: ${bersih(galat && galat.message).slice(0, 80)}` };
  }
  const peristiwa = (Array.isArray(baris) ? baris : []).map(bentukPeristiwa).filter(Boolean);
  return { ok: true, peristiwa };
}

module.exports = { POLA_PERISTIWA, KUNCI_AMAN, metadataAman, keIsoUtc, keMysqlUtc, bentukPeristiwa, bacaPeristiwa };
