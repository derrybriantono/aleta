import { EKSTENSI_BERKAS } from "@/server/shared/ekstensi-berkas";

/**
 * Pemasang pembaru otomatis yang diunduh petugas (satu berkas .cmd).
 *
 * ============================================================================
 * KENAPA SATU BERKAS .CMD
 * ============================================================================
 *
 * Petugas hanya perlu KLIK DUA KALI. Berkas .cmd berisi skrip PowerShell biasa
 * (tanpa penyandian) di bawah penanda #PS-MULAI, dan menulis pembantunya ke
 * %LOCALAPPDATA%\ALETA\pembaru serta kunci registri milik pengguna itu sendiri
 * (HKCU) - tanpa hak admin. Pembantu (pembaru-aleta.ps1) tertanam di dalamnya,
 * dari berkas yang sama dengan yang ada di dalam ZIP ekstensi, sehingga tidak
 * ada dua salinan yang dapat berselisih.
 *
 * Disajikan hanya kepada yang sudah masuk portal (rute pemasang), dan membawa
 * dua keterangan dari sisi server: ID ekstensi yang memintanya (supaya Chrome
 * mengizinkan pembantu dipanggil ekstensi itu) dan asal portal yang dilihat
 * petugas (daftar server yang boleh diunduh pembantu).
 */

const BERKAS_PEMASANG = "pembaru/pasang-pembaru-aleta.cmd";
const BERKAS_PEMBANTU = "pembaru/pembaru-aleta.ps1";

/** ID ekstensi Chrome: 32 huruf a-p. */
export const POLA_ID_EKSTENSI = /^[a-p]{32}$/;

/** Asal portal: http, nama/IP, port opsional, satu segmen basePath opsional. */
export const POLA_ASAL_PORTAL = /^http:\/\/[A-Za-z0-9.-]+(?::\d{1,5})?(?:\/[A-Za-z0-9_-]+)?$/;

export function crlf(teks: string): string {
  return teks.replace(/\r?\n/g, "\r\n");
}

export type MasukanPemasang = {
  /** Asal portal seperti dilihat petugas, mis. http://192.168.10.10/aleta. */
  asalPortal: string;
  /** ID ekstensi yang meminta (chrome.runtime.id); kosong = pemasang mencarinya sendiri. */
  idEkstensi?: string;
};

export function susunPemasang(masukan: MasukanPemasang): string {
  const pemasang = EKSTENSI_BERKAS[BERKAS_PEMASANG];
  const pembantu = EKSTENSI_BERKAS[BERKAS_PEMBANTU];
  if (!pemasang || !pembantu) {
    throw new Error("Pemasang pembaru belum tertanam. Jalankan scripts/susun-ekstensi.mjs lalu bangun ulang.");
  }

  const id = String(masukan.idEkstensi || "").trim();
  const asal = String(masukan.asalPortal || "").trim().replace(/\/+$/, "");
  // Nilai ini disisipkan ke dalam string PowerShell ber-kutip tunggal: hanya
  // bentuk yang BAKU yang lolos, sisanya dikosongkan (pemasang lalu memakai
  // daftar bawaan / mencari sendiri).
  const idAman = POLA_ID_EKSTENSI.test(id) ? id : "";
  const asalAman = POLA_ASAL_PORTAL.test(asal) ? asal : "";

  // Pembantu masuk ke here-string ber-kutip tunggal: tidak boleh ada baris yang
  // diawali '@ (penutupnya).
  if (/^'@/m.test(pembantu)) {
    throw new Error("Pembantu memuat baris penutup here-string; tidak dapat ditanam ke pemasang.");
  }

  return crlf(
    pemasang
      .replace("@@ID_DIMINTA@@", idAman)
      .replace("@@ASAL_PORTAL@@", asalAman)
      .replace("@@HOST_PS1@@", () => pembantu.replace(/\r?\n$/, ""))
  );
}
