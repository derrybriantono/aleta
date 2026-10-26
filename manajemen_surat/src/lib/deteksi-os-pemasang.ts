/**
 * Sistem operasi komputer petugas, untuk memilih pemasang pembaru otomatis
 * (Windows -> .cmd, macOS -> .command). 26 Okt 2026.
 *
 * Urutan petunjuk: navigator.userAgentData.platform (Chrome/Edge), lalu
 * navigator.platform, lalu navigator.userAgent. Tanpa petunjuk sama sekali:
 * "windows" - perilaku sebelum ada pemasang macOS.
 *
 * "lain" = perangkat sentuh (iPhone/iPad/Android) atau ChromeOS: tidak ada
 * pemasangnya. "linux" dipisahkan dari "lain" hanya supaya keterangannya jelas.
 */
export type OsPengguna = "windows" | "mac" | "linux" | "lain";

export type OsPemasang = "windows" | "mac";

export type PetunjukNavigator = {
  userAgentData?: { platform?: string } | null;
  platform?: string;
  userAgent?: string;
  maxTouchPoints?: number;
};

export function deteksiOsPengguna(nav?: PetunjukNavigator | null): OsPengguna {
  if (!nav) return "windows";
  const platformBaru = String(nav.userAgentData?.platform ?? "");
  const teks = `${platformBaru} ${String(nav.platform ?? "")} ${String(nav.userAgent ?? "")}`;
  if (/iPhone|iPad|iPod|Android|CrOS/i.test(teks)) return "lain";
  if (/mac/i.test(teks)) {
    // iPadOS menyamar sebagai Mac (userAgent "Macintosh") tetapi punya layar sentuh.
    return Number(nav.maxTouchPoints ?? 0) > 1 ? "lain" : "mac";
  }
  if (/win/i.test(teks)) return "windows";
  if (/linux|x11/i.test(teks)) return "linux";
  return "windows";
}

export function bisaDipasang(os: OsPengguna): os is OsPemasang {
  return os === "windows" || os === "mac";
}

export const NAMA_BERKAS_PEMASANG_PORTAL: Record<OsPemasang, string> = {
  windows: "pasang-pembaru-aleta.cmd",
  mac: "pasang-pembaru-aleta.command",
};
