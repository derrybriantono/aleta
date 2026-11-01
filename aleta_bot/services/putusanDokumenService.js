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

  /**
   * P3 (1 Nov 2026) - bahan PENGUKUR DRAF vs putusan akhir untuk BANYAK perkara sekaligus (satu kueri putusan + satu kueri majelis,
   * tanpa N+1): tanggal putusan, status, amar UTUH, pertimbangan hukum UTUH, nama berkas putusan, ketua majelis + majelis.
   * Hanya perkara yang SUDAH diputus dan SUDAH memuat amar yang dikembalikan. Hanya SELECT. Paling banyak 40 perkara per panggilan.
   */
  async function bahanPengukur(daftarId) {
    const ids = [...new Set((Array.isArray(daftarId) ? daftarId : String(daftarId || "").split(",")).map((x) => Number(String(x).trim())).filter((x) => Number.isInteger(x) && x > 0))].slice(0, 40);
    if (!ids.length) return { ok: false, alasan: "perkara_tidak_dikenali" };
    const tanda = ids.map(() => "?").join(", ");
    const putusan = await kueri(
      `SELECT p.perkara_id AS perkaraId, p.nomor_perkara AS nomorPerkara, p.jenis_perkara_nama AS jenisPerkara,
              pu.tanggal_putusan AS tanggalPutusan, pu.status_putusan_id AS statusPutusanId, pu.putusan_verstek AS verstek,
              pu.amar_putusan AS amarPutusan, pu.amar_putusan_dok AS berkas, ph.pertimbangan_hukum AS pertimbanganHukum
         FROM perkara p
         JOIN perkara_putusan pu ON pu.perkara_id = p.perkara_id
         LEFT JOIN perkara_pertimbangan_hukum ph ON ph.perkara_id = p.perkara_id
        WHERE p.perkara_id IN (${tanda}) AND pu.tanggal_putusan IS NOT NULL`,
      ids
    );
    const baris = Array.isArray(putusan) ? putusan : [];
    if (!baris.length) return { ok: true, perkara: [] };
    const majelis = await kueri(
      `SELECT perkara_id AS perkaraId, hakim_nama AS nama, urutan, jabatan_hakim_id AS jabatan
         FROM perkara_hakim_pn WHERE aktif = 'Y' AND perkara_id IN (${tanda}) ORDER BY perkara_id, urutan`,
      ids
    );
    const peta = new Map();
    for (const m of Array.isArray(majelis) ? majelis : []) {
      const k = Number(m.perkaraId);
      if (!peta.has(k)) peta.set(k, []);
      peta.get(k).push({ nama: String(m.nama || "").trim(), urutan: Number(m.urutan) || 0, jabatan: Number(m.jabatan) || 0 });
    }
    const unik = new Map();
    for (const b of baris) {
      const id = Number(b.perkaraId);
      const lama = unik.get(id);
      if (lama && tanggalIso(lama.tanggalPutusan) >= tanggalIso(b.tanggalPutusan)) continue;
      unik.set(id, b);
    }
    return {
      ok: true,
      perkara: [...unik.values()].map((b) => {
        const m = peta.get(Number(b.perkaraId)) || [];
        const ketua = m.find((x) => x.jabatan === 1) || m.find((x) => x.urutan === 1) || m[0];
        const berkas = String(b.berkas || "").trim();
        return {
          perkaraId: Number(b.perkaraId),
          nomorPerkara: String(b.nomorPerkara || ""),
          jenisPerkara: String(b.jenisPerkara || ""),
          tanggalPutusan: tanggalIso(b.tanggalPutusan),
          statusPutusanId: Number(b.statusPutusanId) || 0,
          verstek: String(b.verstek || "") === "Y",
          amarPutusan: String(b.amarPutusan || ""),
          pertimbanganHukum: String(b.pertimbanganHukum || ""),
          adaBerkas: Boolean(berkas),
          hakimKetua: ketua ? ketua.nama : "",
          majelis: m.map((x) => x.nama).filter(Boolean),
        };
      }),
    };
  }

  return { bahanPutusan, bahanPengukur };
}

let bawaan = null;
function layanan() {
  if (!bawaan) bawaan = buatLayanan();
  return bawaan;
}

module.exports = { buatLayanan, layanan };
