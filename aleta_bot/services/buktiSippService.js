"use strict";

/**
 * ============================================================================
 * DATA SIPP UNTUK PEMERIKSAAN ALAT BUKTI TERTULIS (6 Nov 2026)
 * ============================================================================
 *
 * Nama dan NIK para pihak serta data pernikahan yang tercatat di SIPP, untuk diadu dengan isian bukti KTP dan Kutipan Akta Nikah di
 * Blangko ABT by Derry Briantono dan ALETA ABT. Hanya membaca. NIK utuh berhenti di rute portal: rute itu yang menyamarkannya.
 *
 * agendaPembuktianKe (7 Nov 2026): berapa tanggal sidang yang sudah berjalan (tanggal sah, tidak lewat hari ini) beragenda pembuktian.
 * Agenda di perkara_jadwal_sidang berupa teks bebas; polanya diukur atas salinan uji lokal (10.207 perkara berjadwal, 1.360 bunyi agenda
 * berbeda): kata dasar "bukti" (pembuktian, bukti lanjutan, pengajuan alat bukti, termasuk salah ketik) atau "saksi". Dihitung per tanggal
 * (dua baris sama tanggal = satu sidang), agenda bersyarat ("jika/apabila ... tidak hadir") tidak dihitung karena belum tentu terjadi.
 * Tidak ada agenda yang terbaca sebagai pembuktian, jadwal kosong, atau kueri gagal = null, bukan nol: bunyi agenda yang tidak menyebut
 * pembuktian tidak membuktikan bahwa pembuktian belum pernah ada.
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

const SQL_JADWAL = `
SELECT DATE_FORMAT(tanggal_sidang, '%Y-%m-%d') AS tgl, COALESCE(agenda, '') AS agenda
  FROM perkara_jadwal_sidang
 WHERE perkara_id = ?
 ORDER BY tanggal_sidang ASC, urutan ASC`;

const POLA_PEMBUKTIAN = /bukti|saksi/i;
const POLA_BERSYARAT = /\b(?:jika|apabila|bila)\b/i;

const tanggalSah = (t) => {
  const s = String(t || "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && s > "1000-01-01" ? s : "";
};

const hariIniLokal = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** Jumlah tanggal sidang berjalan yang agendanya pembuktian; null bila tidak terbaca (lihat catatan di kepala berkas). */
function hitungAgendaPembuktian(baris, hariIni) {
  if (!Array.isArray(baris)) return null;
  const batas = tanggalSah(hariIni) || hariIniLokal();
  const tanggal = new Set();
  for (const b of baris) {
    const tgl = tanggalSah(b && b.tgl);
    if (!tgl || tgl > batas) continue;
    const agenda = String((b && b.agenda) || "");
    if (POLA_PEMBUKTIAN.test(agenda) && !POLA_BERSYARAT.test(agenda)) tanggal.add(tgl);
  }
  return tanggal.size > 0 ? tanggal.size : null;
}

async function buktiSipp(kueri, perkaraId, opsi) {
  const id = String(perkaraId ?? "").trim();
  if (!/^\d+$/.test(id)) return { ada: false, sebab: "perkara_id bukan angka", P: [], T: [], nikah: null, agendaPembuktianKe: null };
  const [pihak, nikah, jadwal] = await Promise.all([
    kueri(SQL_PIHAK, [id, id]),
    kueri(SQL_NIKAH, [id]),
    // Jadwal yang gagal terbaca tidak boleh menjatuhkan data pihak dan pernikahan.
    Promise.resolve()
      .then(() => kueri(SQL_JADWAL, [id]))
      .catch(() => null),
  ]);
  const hasil = { ada: true, P: [], T: [], nikah: null, agendaPembuktianKe: hitungAgendaPembuktian(jadwal, opsi && opsi.hariIni) };
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

module.exports = { buktiSipp, hitungAgendaPembuktian, SQL_PIHAK, SQL_NIKAH, SQL_JADWAL };
