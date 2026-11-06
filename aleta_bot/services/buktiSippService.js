"use strict";

/**
 * ============================================================================
 * DATA SIPP UNTUK PEMERIKSAAN ALAT BUKTI TERTULIS (6 Nov 2026)
 * ============================================================================
 *
 * Nama dan NIK para pihak serta data pernikahan yang tercatat di SIPP, untuk diadu dengan isian bukti KTP dan Kutipan Akta Nikah di
 * Blangko ABT by Derry Briantono dan ALETA ABT. Hanya membaca. NIK utuh berhenti di rute portal: rute itu yang menyamarkannya.
 */

const SQL_PIHAK = `
SELECT 'P' AS sisi, p.urutan AS urutan, p.nama AS nama, ph.nomor_indentitas AS nik
  FROM perkara_pihak1 p
  LEFT JOIN pihak ph ON ph.id = p.pihak_id
 WHERE p.perkara_id = ?
UNION ALL
SELECT 'T' AS sisi, p.urutan AS urutan, p.nama AS nama, ph.nomor_indentitas AS nik
  FROM perkara_pihak2 p
  LEFT JOIN pihak ph ON ph.id = p.pihak_id
 WHERE p.perkara_id = ?
ORDER BY sisi ASC, urutan ASC`;

const SQL_NIKAH = `
SELECT COALESCE(no_kutipan_akta_nikah, '') AS nomor,
       DATE_FORMAT(tgl_kutipan_akta_nikah, '%Y-%m-%d') AS tglKutipan,
       COALESCE(kua_tempat_nikah, '') AS kua,
       DATE_FORMAT(tgl_nikah, '%Y-%m-%d') AS tglNikah
  FROM perkara_data_pernikahan
 WHERE perkara_id = ?
 LIMIT 1`;

const tanggalSah = (t) => {
  const s = String(t || "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && s > "1000-01-01" ? s : "";
};

async function buktiSipp(kueri, perkaraId) {
  const id = String(perkaraId ?? "").trim();
  if (!/^\d+$/.test(id)) return { ada: false, sebab: "perkara_id bukan angka", P: [], T: [], nikah: null };
  const [pihak, nikah] = await Promise.all([kueri(SQL_PIHAK, [id, id]), kueri(SQL_NIKAH, [id])]);
  const hasil = { ada: true, P: [], T: [], nikah: null };
  for (const b of Array.isArray(pihak) ? pihak : []) {
    if (b.sisi !== "P" && b.sisi !== "T") continue;
    hasil[b.sisi].push({ nama: String(b.nama || "").trim(), nik: String(b.nik || "").replace(/\D/g, "") });
  }
  const n = Array.isArray(nikah) ? nikah[0] : null;
  if (n) {
    hasil.nikah = {
      nomor: String(n.nomor || "").trim(),
      tglKutipan: tanggalSah(n.tglKutipan),
      kua: String(n.kua || "").trim(),
      tglNikah: tanggalSah(n.tglNikah),
    };
  }
  return hasil;
}

module.exports = { buktiSipp, SQL_PIHAK, SQL_NIKAH };
