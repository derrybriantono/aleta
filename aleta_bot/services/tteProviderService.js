"use strict";

/**
 * ============================================================================
 * PENYEDIA TTE (TANDA TANGAN ELEKTRONIK BERSERTIFIKAT) - SAMBUNGAN OPSIONAL
 * (perbaikan 2 Okt 2026, butir 17, kontrak K6)
 * ============================================================================
 *
 * ALETA TIDAK punya layanan TTE sendiri. TTE yang sudah berjalan (1.177.0)
 * dikerjakan e-Court lewat sesi panitera; untuk edoc penetapan, TTE baru
 * terjadi bila satker MENYETEL penyedia yang kompatibel dengan klien BSrE
 * (POST multipart: file, nik, passphrase, tampilan) lewat:
 *
 *   ALETA_TTE_PENETAPAN_URL        alamat penandatanganan PDF
 *   ALETA_TTE_PENETAPAN_PENGGUNA   (opsional) Basic auth penyedia
 *   ALETA_TTE_PENETAPAN_SANDI      (opsional)
 *
 * Tanpa itu tersedia() = false, dan permintaan yang MEMBAWA passphrase
 * ditolak "tte_belum_tersambung" oleh pemanggilnya - tidak diabaikan diam-diam.
 *
 * PASSPHRASE: diteruskan SEKALI di badan permintaan ke penyedia, tidak
 * disimpan, tidak dicatat, dan disapu dari setiap pesan galat yang keluar.
 */

const BATAS_MS = Number(process.env.ALETA_TTE_PENETAPAN_BATAS_MS || 60000);

function alamat() {
  return String(process.env.ALETA_TTE_PENETAPAN_URL || "").trim();
}

function tersedia() {
  return /^https?:\/\//i.test(alamat());
}

/**
 * @param {{pdf: Buffer, passphrase: string, nik?: string}} m
 * @param {{fetchFn?: Function}} [opsi]
 * @returns {Promise<{ok: boolean, pdf?: Buffer, alasan?: string}>}
 */
async function tandatangani({ pdf, passphrase, nik = "" }, { fetchFn = globalThis.fetch } = {}) {
  const sapu = (t) => (passphrase ? String(t || "").split(passphrase).join("***") : String(t || ""));
  if (!tersedia()) return { ok: false, alasan: "tte_belum_tersambung" };
  if (!passphrase) return { ok: false, alasan: "passphrase_kosong" };
  if (!Buffer.isBuffer(pdf) || pdf.subarray(0, 5).toString("latin1") !== "%PDF-") return { ok: false, alasan: "berkas_bukan_pdf" };
  if (!String(nik || "").trim()) return { ok: false, alasan: "nik_penandatangan_kosong" };

  const form = new FormData();
  form.append("file", new Blob([pdf], { type: "application/pdf" }), "dokumen.pdf");
  form.append("nik", String(nik).trim());
  form.append("passphrase", passphrase);
  form.append("tampilan", "invisible");

  const kepala = {};
  const pengguna = process.env.ALETA_TTE_PENETAPAN_PENGGUNA || "";
  if (pengguna) {
    kepala.Authorization =
      "Basic " + Buffer.from(`${pengguna}:${process.env.ALETA_TTE_PENETAPAN_SANDI || ""}`).toString("base64");
  }
  const pengendali = new AbortController();
  const waktu = setTimeout(() => pengendali.abort(), BATAS_MS);
  try {
    const r = await fetchFn(alamat(), { method: "POST", body: form, headers: kepala, signal: pengendali.signal });
    const isi = Buffer.from(await r.arrayBuffer());
    if (!r.ok) return { ok: false, alasan: sapu(`penyedia_tte_menjawab_${r.status}`) };
    if (isi.subarray(0, 5).toString("latin1") !== "%PDF-") return { ok: false, alasan: "jawaban_tte_bukan_pdf" };
    return { ok: true, pdf: isi };
  } catch (galat) {
    return { ok: false, alasan: sapu(`penyedia_tte_tidak_terjangkau: ${(galat && galat.message) || galat}`).slice(0, 200) };
  } finally {
    clearTimeout(waktu);
  }
}

module.exports = { tersedia, tandatangani };
