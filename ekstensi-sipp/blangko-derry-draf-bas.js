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
 *   "ganti-sidang" perkara dibuka SEBELUM hari sidangnya (sore H-1): panel memilih sidang draf, lalu "buka". Hanya bila
 *                  sidang yang terpilih sudah lewat (bukan hari ini), BAS-nya sudah terunggah, dan tidak ada sidang lain di
 *                  antaranya - supaya petugas yang masih mengerjakan BAS sidang lalu tidak dipindahkan;
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
   * @returns {{aksi: "buka"|"ganti-sidang"|"tidak", indeks?: number, sebab: string}}
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
    const hari = tgl(o.hariIni);
    if (!hari || !tDipilih || !(tDipilih < hari) || !(t > hari)) return { aksi: "tidak", sebab: "sidang terpilih bukan sidang lalu" };
    if (dipilih.adaBas !== true) return { aksi: "tidak", sebab: "BAS sidang lalu belum terunggah" };
    const diantara = sidang.some((s) => s && tgl(s.tanggal) > tDipilih && tgl(s.tanggal) < t);
    if (diantara) return { aksi: "tidak", sebab: "ada sidang lain di antaranya" };
    return { aksi: "ganti-sidang", indeks, sebab: "sidang berikutnya" };
  }

  /** Kabar singkat sesudah blangko draf dibuka (tanpa istilah teknis, tanpa kode). */
  function kalimatBuka(d) {
    if (!d || !d.blangko) return "";
    const label = teks(d.blangko.label) || teks(d.blangko.berkas).replace(/\.rtf$/i, "");
    return `BAS sidang ini sudah disiapkan: ${label}. Periksa isiannya sebelum dicetak; bila keadaan sidang berbeda, pilih blangko lain.`;
  }

  const api = { putuskan, kalimatBuka };
  globalThis.AletaBdDrafBas = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
