/** Kata tampilan riwayat masuk (23 Okt 2026) - dipakai layar admin dan halaman Akun. */

export const LABEL_PERISTIWA: Record<string, string> = {
  MASUK: "Masuk",
  MASUK_GAGAL: "Gagal masuk",
  MASUK_DITOLAK_BATAS_PERANGKAT: "Ditolak: batas perangkat",
  KELUAR: "Keluar",
  SESI_DICABUT: "Dikeluarkan",
  SESI_KEDALUWARSA: "Sesi habis",
  PERANGKAT_BARU: "Perangkat baru",
  IP_BERUBAH: "Alamat berubah",
};

export const LABEL_JALUR: Record<string, string> = {
  email: "Akun ALETA",
  sipp: "Akun SIPP",
  "sipp-sesi": "Sesi SIPP (ekstensi)",
};

export const LABEL_SUMBER_MAC: Record<string, string> = {
  ekstensi: "dari ekstensi di komputer",
  "arp-server": "dari jaringan server",
};

export function labelPeristiwa(p: string) {
  return LABEL_PERISTIWA[p] ?? p;
}

export function labelJalur(j: string) {
  return LABEL_JALUR[j] ?? (j || "-");
}

export function peristiwaGagal(p: string) {
  return p === "MASUK_GAGAL" || p === "MASUK_DITOLAK_BATAS_PERANGKAT";
}

/** "23 Okt 2026 09.14 WITA" - tampilan selalu WITA, penyimpanan ISO UTC. */
export function waktuWita(iso: string | null | undefined) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return `${new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Makassar",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d)} WITA`;
}

export function teksMac(mac: string, sumber: string, catatan: string) {
  if (mac) return `${mac} (${LABEL_SUMBER_MAC[sumber] ?? sumber})`;
  return catatan || "tidak terbaca";
}
