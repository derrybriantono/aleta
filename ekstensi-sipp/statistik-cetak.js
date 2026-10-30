"use strict";

/**
 * ============================================================================
 * STATISTIK CETAK BLANGKO - SISI EKSTENSI (30 Okt 2026, G6 butir 6.4)
 * ============================================================================
 *
 * ABT tidak mencatat blangko apa yang dicetak. Setiap kali blangko dicetak dari
 * panel Blangko ABT by Derry (blangko-derry-isian.js), satu laporan kecil
 * dikirim ke portal di server kantor: folder + nama berkas blangko, jenis
 * blangko, jenis perkara, nomor perkara. TANPA isi naskah dan tanpa isian.
 * Dipakai untuk Statistik pemakaian blangko di Pusat Kendali.
 *
 * Tidak menulis ke SIPP/ABT/e-Court dan tidak pernah melempar galat ke
 * pemanggil: gagal mengirim tidak memengaruhi cetak. Tidak ada klik tambahan.
 */
(function () {
  const API = "/aleta/api/aleta-ecourt/statistik-blangko";
  const teks = (x) => String(x == null ? "" : x).trim();

  /** detail: { perkaraId, nomorPerkara, kelompok, berkas, jenisBlangko, jenisPerkara } */
  async function laporCetak(detail) {
    try {
      if (!detail || !teks(detail.perkaraId) || !teks(detail.berkas)) return null;
      const r = await fetch(API, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          aksi: "cetak",
          perkaraId: teks(detail.perkaraId),
          nomorPerkara: teks(detail.nomorPerkara),
          kelompok: teks(detail.kelompok),
          berkas: teks(detail.berkas),
          jenisBlangko: teks(detail.jenisBlangko),
          jenisPerkara: teks(detail.jenisPerkara),
        }),
      });
      return r && r.ok ? true : null;
    } catch {
      return null;
    }
  }

  const api = { laporCetak };
  if (typeof globalThis !== "undefined") globalThis.AletaStatistikCetak = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
