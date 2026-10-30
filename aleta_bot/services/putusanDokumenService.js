"use strict";

/**
 * Bahan pencocokan putusan SIPP vs dokumen putusan yang diunggah (G4 4.3, 30 Okt 2026). HANYA SELECT.
 *
 * Amar dikirim UTUH (bukan amarRingkas 600 huruf milik jadwal sidang) - pencocokan membandingkan seluruh amar.
 * Isi dokumennya diambil portal lewat jalur berkas SIPP yang sudah ada (/sipp/berkas-perkara?jenis=putusan&id=
 * perkara_id), yang membatasi folder dan ekstensi - berkas ini tidak membaca berkas apa pun.
 */

function buatLayanan(d = {}) {
  const kueri =
    d.kueri ||
    ((sql, params = []) =>
      new Promise((selesai, gagal) => {
        require("../db_config").query(sql, params, (galat, hasil) => (galat ? gagal(galat) : selesai(hasil)));
      }));

  const tanggalIso = (nilai) => {
    if (!nilai) return "";
    if (nilai instanceof Date) {
      if (Number.isNaN(nilai.getTime())) return "";
      return `${nilai.getFullYear()}-${String(nilai.getMonth() + 1).padStart(2, "0")}-${String(nilai.getDate()).padStart(2, "0")}`;
    }
    const t = String(nilai);
    return /^\d{4}-\d{2}-\d{2}/.test(t) ? t.slice(0, 10) : "";
  };

  async function bahanPutusan(perkaraId) {
    const id = Number(perkaraId);
    if (!Number.isInteger(id) || id <= 0) return { ok: false, alasan: "perkara_tidak_dikenali" };
    const baris = await kueri(
      `SELECT p.perkara_id AS perkaraId, p.nomor_perkara AS nomorPerkara,
              pu.tanggal_putusan AS tanggalPutusan, pu.amar_putusan AS amarPutusan, pu.amar_putusan_dok AS berkas
         FROM perkara p LEFT JOIN perkara_putusan pu ON pu.perkara_id = p.perkara_id
        WHERE p.perkara_id = ? ORDER BY pu.tanggal_putusan DESC LIMIT 1`,
      [id]
    );
    const b = (Array.isArray(baris) && baris[0]) || null;
    if (!b) return { ok: false, alasan: "perkara_tidak_dikenali" };
    const berkas = String(b.berkas || "").trim();
    return {
      ok: true,
      perkaraId: Number(b.perkaraId),
      nomorPerkara: String(b.nomorPerkara || ""),
      tanggalPutusan: tanggalIso(b.tanggalPutusan),
      amarPutusan: String(b.amarPutusan || ""),
      namaBerkas: berkas ? berkas.split(/[\\/]/).pop() : "",
      adaBerkas: Boolean(berkas),
    };
  }

  return { bahanPutusan };
}

let bawaan = null;
function layanan() {
  if (!bawaan) bawaan = buatLayanan();
  return bawaan;
}

module.exports = { buatLayanan, layanan };
