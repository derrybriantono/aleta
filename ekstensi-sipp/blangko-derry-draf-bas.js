"use strict";

/**
 * ============================================================================
 * BLANGKO ABT BY DERRY BRIANTONO - BAS SIDANG BERIKUTNYA YANG DISIAPKAN (H-1, 30 Okt 2026)
 * ============================================================================
 *
 * Tiap sore hari kerja portal menyiapkan BAS untuk sidang hari kerja berikutnya (lib/agen-h1-bas.ts): blangko BAS Derry
 * menurut agenda. Berkas ini fungsi murni (tanpa DOM, tanpa jaringan) yang memutuskan apa yang dilakukan panel saat PP
 * membuka perkara itu - tanpa tombol tambahan (arahan pengguna 30 Okt malam):
 *
 *   "buka"         sidang yang terpilih = sidang draf  -> blangko draf langsung dibuka (isi otomatis yang berlaku menyusul);
 *   (30 Okt malam, keputusan 43: TIDAK lagi pindah sendiri ke sidang besok. Sore H-1 panel dan Jadwal Sidang hanya memberi SARAN
 *   kecil "Sidang besok: N perkara - BAS sudah disiapkan" dengan tautan per perkara - lihat ringkasBesok/muatanTautan.)
 *   "tidak"        selain itu (sudah dipakai sekali di halaman ini, sidang lain, data tidak lengkap).
 *
 * Tidak ada yang ditulis ke ABT di sini; blangko dibuka seperti pilihan petugas.
 */
(function () {
  const teks = (x) => String(x == null ? "" : x).trim();
  const tgl = (x) => teks(x).slice(0, 10);

  /**
   * @param {{draf?: {tanggalSidang?: string, blangko?: {berkas?: string}|null}|null, hariIni?: string,
   *          sidang?: Array<{tanggal?: string, adaBas?: boolean|null}>, sidangDipilih?: {tanggal?: string, adaBas?: boolean|null}|null,
   *          sudah?: boolean}} m
   * @returns {{aksi: "buka"|"tidak", indeks?: number, sebab: string}}
   */
  function putuskan(m) {
    const o = m || {};
    const d = o.draf;
    if (!d || !d.blangko || !teks(d.blangko.berkas)) return { aksi: "tidak", sebab: "tanpa draf" };
    if (o.sudah) return { aksi: "tidak", sebab: "sudah dipakai" };
    const t = tgl(d.tanggalSidang);
    const sidang = Array.isArray(o.sidang) ? o.sidang : [];
    const indeks = sidang.findIndex((s) => s && tgl(s.tanggal) === t);
    if (!t || indeks < 0) return { aksi: "tidak", sebab: "sidang draf tidak ada di daftar sidang perkara" };
    const dipilih = o.sidangDipilih || null;
    const tDipilih = dipilih ? tgl(dipilih.tanggal) : "";
    if (tDipilih === t) return { aksi: "buka", indeks, sebab: "sidang draf terpilih" };
    return { aksi: "tidak", sebab: "sidang terpilih bukan sidang draf" };
  }

  /** Kabar singkat sesudah blangko draf dibuka (tanpa istilah teknis, tanpa kode). */
  function kalimatBuka(d) {
    if (!d || !d.blangko) return "";
    const label = teks(d.blangko.label) || teks(d.blangko.berkas).replace(/\.rtf$/i, "");
    return `BAS sidang ini sudah disiapkan: ${label}. Periksa isiannya sebelum dicetak; bila keadaan sidang berbeda, pilih blangko lain.`;
  }

  /**
   * Saran "Sidang besok": draf BAS sesudah hari ini yang berblangko, untuk tanggal sidang terdekat. Murni.
   * @param {Array<{perkaraId?: string, nomorPerkara?: string, tanggalSidang?: string, blangko?: object|null}>} daftar
   * @returns {{tanggal: string, perkara: Array<{perkaraId: string, nomor: string, label: string}>}|null}
   */
  function ringkasBesok(daftar, hariIni) {
    const hari = tgl(hariIni);
    const sah = (Array.isArray(daftar) ? daftar : []).filter((d) => d && d.blangko && teks(d.blangko.berkas) && tgl(d.tanggalSidang) > hari && teks(d.perkaraId));
    if (!sah.length) return null;
    const tanggal = sah.map((d) => tgl(d.tanggalSidang)).sort()[0];
    const perkara = sah
      .filter((d) => tgl(d.tanggalSidang) === tanggal)
      .map((d) => ({ perkaraId: teks(d.perkaraId), nomor: teks(d.nomorPerkara), label: teks(d.blangko.label) || teks(d.blangko.berkas).replace(/\.rtf$/i, "") }))
      .sort((a, b) => a.nomor.localeCompare(b.nomor, "id", { numeric: true }));
    return { tanggal, perkara };
  }

  /** Muatan tautan #bd= (kontrak blangko-derry.js) yang membuka BAS H-1 perkara itu pada sidangnya. */
  function muatanTautan(p, tanggal) {
    const id = teks(p && p.perkaraId);
    return { v: 1, nomor: teks(p && p.nomor), perkaraId: /^\d+$/.test(id) ? Number(id) : id, tanggalSidang: tgl(tanggal), jenis: "bas", draf: "h1" };
  }

  const api = { putuskan, kalimatBuka, ringkasBesok, muatanTautan };
  globalThis.AletaBdDrafBas = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
