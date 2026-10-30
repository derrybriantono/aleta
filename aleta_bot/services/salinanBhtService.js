"use strict";

/**
 * ============================================================================
 * DAFTAR PERKARA YANG BARU BHT (30 Okt 2026) - BACA SAJA
 * ============================================================================
 *
 *   salinan.bht   { sejakHari } -> perkara yang tanggal BHT-nya dalam N hari terakhir (bawaan 14, paling banyak 60), beserta tanggal
 *                 putusan dan apakah berkas putusan sudah ada di SIPP. Dipakai portal untuk mencatat perkara yang salinan putusannya
 *                 perlu diurus. SIPP hanya DIBACA; tidak ada yang ditulis, tidak ada berkas yang disalin.
 */

let dbCadangan = null;
function kueriBawaan(sql, params = []) {
  if (!dbCadangan) dbCadangan = require("../db_config");
  return new Promise((resolve, reject) => {
    dbCadangan.query(sql, params, (galat, baris) => (galat ? reject(galat) : resolve(Array.isArray(baris) ? baris : [])));
  });
}

function iso(t) {
  if (!t) return "";
  if (t instanceof Date) {
    if (Number.isNaN(t.getTime())) return "";
    const z = (n) => String(n).padStart(2, "0");
    return `${t.getFullYear()}-${z(t.getMonth() + 1)}-${z(t.getDate())}`;
  }
  const m = String(t).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : "";
}

async function daftarBht(params = {}, deps = {}) {
  const q = deps.kueri || kueriBawaan;
  const hari = Math.max(1, Math.min(60, Math.round(Number(params.sejakHari) || 14)));
  let baris = [];
  try {
    baris = await q(
      "SELECT p.perkara_id, p.nomor_perkara, pu.tanggal_putusan, pu.tanggal_bht, pu.amar_putusan_dok " +
        "FROM perkara_putusan pu JOIN perkara p ON p.perkara_id = pu.perkara_id " +
        "WHERE pu.tanggal_bht IS NOT NULL AND pu.tanggal_bht >= DATE_SUB(CURDATE(), INTERVAL ? DAY) AND pu.tanggal_bht <= CURDATE() " +
        "ORDER BY pu.tanggal_bht DESC, p.perkara_id DESC LIMIT 200",
      [hari]
    );
  } catch (e) {
    return { ok: false, sebab: "Daftar perkara BHT tidak terbaca dari SIPP." };
  }
  return {
    ok: true,
    sejakHari: hari,
    perkara: baris
      .map((b) => ({
        perkaraId: String(b.perkara_id),
        nomorPerkara: String(b.nomor_perkara || ""),
        tanggalPutusan: iso(b.tanggal_putusan),
        tanggalBht: iso(b.tanggal_bht),
        adaPutusan: String(b.amar_putusan_dok || "").trim() !== "",
      }))
      .filter((b) => b.nomorPerkara && b.tanggalBht),
  };
}

module.exports = { daftarBht };
