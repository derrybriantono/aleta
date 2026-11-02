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
const BERKAS_PEMASANG_MAC = "pembaru/pasang-pembaru-aleta.command";
const BERKAS_PEMBANTU_MAC = "pembaru/pembaru-aleta.sh";

/** Sistem operasi yang pemasangnya tersedia. Linux belum didukung (jalan pengguna diberi keterangan). */
export type OsPemasang = "windows" | "mac";

/**
 * Menormalkan ?os= pada rute pemasang. Kosong = windows (perilaku lama, tidak berubah).
 * Nilai yang bukan windows/mac dikembalikan null (rute menjawab 400).
 */
export function normalisasiOsPemasang(nilai: string | null | undefined): OsPemasang | null {
  const v = String(nilai ?? "").trim().toLowerCase();
  if (v === "" || v === "windows" || v === "win" || v === "win32") return "windows";
  if (v === "mac" || v === "macos" || v === "darwin" || v === "osx") return "mac";
  return null;
}

/** Nama berkas unduhan per sistem. */
export const NAMA_BERKAS_PEMASANG: Record<OsPemasang, string> = {
  windows: "pasang-pembaru-aleta.cmd",
  mac: "pasang-pembaru-aleta.command",
};

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

/** Hanya bentuk baku yang boleh masuk ke string ber-kutip tunggal pada pemasang (Windows maupun macOS). */
function masukanAman(masukan: MasukanPemasang): { idAman: string; asalAman: string } {
  const id = String(masukan.idEkstensi || "").trim();
  const asal = String(masukan.asalPortal || "").trim().replace(/\/+$/, "");
  return {
    idAman: POLA_ID_EKSTENSI.test(id) ? id : "",
    asalAman: POLA_ASAL_PORTAL.test(asal) ? asal : "",
  };
}

/**
 * Pemasang macOS: satu berkas .command (bash) dengan akhir baris LF.
 *
 * Pembantu (pembaru-aleta.sh) tertanam sebagai heredoc ber-kutip tunggal, sehingga tidak ada
 * yang diperluas oleh shell. Berkas ini TIDAK memuat pemasang Windows maupun sebaliknya.
 */
export function susunPemasangMac(masukan: MasukanPemasang): string {
  const pemasang = EKSTENSI_BERKAS[BERKAS_PEMASANG_MAC];
  const pembantu = EKSTENSI_BERKAS[BERKAS_PEMBANTU_MAC];
  if (!pemasang || !pembantu) {
    throw new Error("Pemasang macOS belum tertanam. Jalankan scripts/susun-ekstensi.mjs lalu bangun ulang.");
  }
  const lf = (t: string) => t.replace(/\r\n/g, "\n");
  const host = lf(pembantu).replace(/\n+$/, "");
  if (/^ALETA_AKHIR_HOST\s*$/m.test(host)) {
    throw new Error("Pembantu memuat baris penutup heredoc; tidak dapat ditanam ke pemasang.");
  }
  const { idAman, asalAman } = masukanAman(masukan);
  return lf(pemasang)
    .replace("@@ID_DIMINTA@@", idAman)
    .replace("@@ASAL_PORTAL@@", asalAman)
    .replace("@@HOST_SH@@", () => host);
}

/** Satu pintu untuk rute: isi, nama berkas, dan jenis isi per sistem. */
export function susunPemasangUntuk(os: OsPemasang, masukan: MasukanPemasang): { isi: string; namaBerkas: string } {
  return {
    isi: os === "mac" ? susunPemasangMac(masukan) : susunPemasang(masukan),
    namaBerkas: NAMA_BERKAS_PEMASANG[os],
  };
}

export function susunPemasang(masukan: MasukanPemasang): string {
  const pemasang = EKSTENSI_BERKAS[BERKAS_PEMASANG];
  const pembantu = EKSTENSI_BERKAS[BERKAS_PEMBANTU];
  if (!pemasang || !pembantu) {
    throw new Error("Pemasang pembaru belum tertanam. Jalankan scripts/susun-ekstensi.mjs lalu bangun ulang.");
  }

  // Nilai ini disisipkan ke dalam string PowerShell ber-kutip tunggal: hanya
  // bentuk yang BAKU yang lolos, sisanya dikosongkan (pemasang lalu memakai
  // daftar bawaan / mencari sendiri).
  const { idAman, asalAman } = masukanAman(masukan);

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

// ============================================================================
// PEMASANG SEPAKET (2 Nov 2026): ekstensi + Mode Pengembang + pembaru otomatis
// ============================================================================
//
// Satu berkas .cmd (bukan ZIP, supaya tidak dicegat IDM) yang memasang ekstensi
// ke %USERPROFILE%\.aleta\ekstensi - lokasi TETAP, sebab Chrome mengikat
// ekstensi "Load unpacked" pada alamat foldernya. Berkas ekstensinya TIDAK
// ditanam di dalam .cmd (17 MB): pemasang mengambilnya sendiri dari rute
// /pembaru/info + /pembaru/paket (sidik SHA-256), sama dengan pembaru otomatis.
// Satu-satunya nilai dari server: asal portal yang dilihat petugas.

const BERKAS_PEMASANG_PAKET = "pembaru/pasang-aleta.cmd";
const BERKAS_PENCOPOT = "pembaru/copot-aleta.cmd";

/** ?bentuk= pada rute unduh ekstensi. Kosong / "zip" = ZIP ekstensi (perilaku lama). */
export type BentukUnduhEkstensi = "zip" | "pemasang" | "pencopot";

export function normalisasiBentukUnduh(nilai: string | null | undefined): BentukUnduhEkstensi | null {
  const v = String(nilai ?? "").trim().toLowerCase();
  if (v === "" || v === "zip") return "zip";
  if (v === "pemasang") return "pemasang";
  if (v === "pencopot") return "pencopot";
  return null;
}

export const NAMA_BERKAS_PEMASANG_PAKET = "pasang-aleta.cmd";
export const NAMA_BERKAS_PENCOPOT = "copot-aleta.cmd";

/** Pemasang sepaket untuk Windows: asal portal disisipkan, akhir baris CRLF. */
export function susunPemasangPaket(masukan: { asalPortal: string }): string {
  const pemasang = EKSTENSI_BERKAS[BERKAS_PEMASANG_PAKET];
  if (!pemasang) {
    throw new Error("Pemasang ALETA belum tertanam. Jalankan scripts/susun-ekstensi.mjs lalu bangun ulang.");
  }
  const { asalAman } = masukanAman({ asalPortal: masukan.asalPortal });
  return crlf(pemasang.replace("@@ASAL_PORTAL@@", asalAman));
}

/** Pencopot (tanpa nilai dari server), akhir baris CRLF. */
export function susunPencopot(): string {
  const pencopot = EKSTENSI_BERKAS[BERKAS_PENCOPOT];
  if (!pencopot) {
    throw new Error("Pencopot ALETA belum tertanam. Jalankan scripts/susun-ekstensi.mjs lalu bangun ulang.");
  }
  return crlf(pencopot);
}
