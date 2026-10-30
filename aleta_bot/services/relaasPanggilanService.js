"use strict";

/**
 * ============================================================================
 * TANGGAL RELAAS PANGGILAN PER PIHAK (G1, jawaban pengguna 30 Okt malam butir 50) - HANYA MEMBACA
 * ============================================================================
 *
 * Untuk "Periksa sebelum cetak" Blangko Derry: tanggal panggilan yang tertulis di naskah putusan/BAS dibandingkan dengan tanggal
 * relaas di SIPP. Aturan pengambilan SAMA dengan variabel 11120/11121 paket ABT prodeo-panggilan-29okt (tanggal semua relaas):
 *   perkara_pelaksanaan_relaas pihak itu (pihak pertama = perkara_pihak1, pihak kedua = perkara_pihak2), tanggal berbeda, urut,
 *   bukan sidang ikrar talak, sampai tanggal putusan (bila sudah putus).
 * Satu SELECT, tanpa tulisan apa pun.
 */

const SQL = `
SELECT x.pihak, x.t
FROM (
  SELECT DISTINCT 'P' AS pihak, DATE_FORMAT(r.tanggal_relaas, '%Y-%m-%d') AS t
    FROM perkara_pelaksanaan_relaas r
    JOIN perkara_pihak1 p ON p.perkara_id = r.perkara_id AND p.pihak_id = r.pihak_id
    LEFT JOIN perkara_jadwal_sidang j ON j.id = r.sidang_id
   WHERE r.perkara_id = ? AND r.tanggal_relaas > '1000-01-01' AND IFNULL(j.ikrar_talak, 'T') <> 'Y'
     AND r.tanggal_relaas <= IFNULL((SELECT MAX(pu.tanggal_putusan) FROM perkara_putusan pu WHERE pu.perkara_id = ? AND pu.tanggal_putusan > '1000-01-01'), '9999-12-31')
  UNION
  SELECT DISTINCT 'T' AS pihak, DATE_FORMAT(r.tanggal_relaas, '%Y-%m-%d') AS t
    FROM perkara_pelaksanaan_relaas r
    JOIN perkara_pihak2 p ON p.perkara_id = r.perkara_id AND p.pihak_id = r.pihak_id
    LEFT JOIN perkara_jadwal_sidang j ON j.id = r.sidang_id
   WHERE r.perkara_id = ? AND r.tanggal_relaas > '1000-01-01' AND IFNULL(j.ikrar_talak, 'T') <> 'Y'
     AND r.tanggal_relaas <= IFNULL((SELECT MAX(pu.tanggal_putusan) FROM perkara_putusan pu WHERE pu.perkara_id = ? AND pu.tanggal_putusan > '1000-01-01'), '9999-12-31')
) x
ORDER BY x.pihak, x.t`;

/**
 * kueri(sql, params) -> baris. -> { ada: true, P: ["YYYY-MM-DD", ...], T: [...] } | { ada: false, sebab }
 */
async function tanggalRelaasPerPihak(kueri, perkaraId) {
  const id = String(perkaraId ?? "").trim();
  if (!/^\d+$/.test(id)) return { ada: false, sebab: "perkara_id bukan angka", P: [], T: [] };
  const baris = await kueri(SQL, [id, id, id, id]);
  const hasil = { ada: true, P: [], T: [] };
  for (const b of Array.isArray(baris) ? baris : []) {
    const t = String(b.t || "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) continue;
    if (b.pihak === "P" && !hasil.P.includes(t)) hasil.P.push(t);
    if (b.pihak === "T" && !hasil.T.includes(t)) hasil.T.push(t);
  }
  return hasil;
}

module.exports = { tanggalRelaasPerPihak, SQL };
