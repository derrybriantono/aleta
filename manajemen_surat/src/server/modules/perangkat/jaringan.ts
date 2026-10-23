import crypto from "node:crypto";

/**
 * Alamat klien dan kuki perangkat untuk jejak masuk (23 Okt 2026).
 *
 * ============================================================================
 * IP DARI UJUNG X-FORWARDED-FOR, BUKAN PANGKALNYA
 * ============================================================================
 *
 * Apache (mod_proxy_http) MENAMBAHKAN alamat penyambung ke ujung daftar yang
 * sudah ada. Entri pertama dapat dikarang peramban sendiri; yang tidak dapat
 * dipalsukan hanya entri terakhir - lihat juga alamatIpPeramban di
 * server/shared/request.ts. Rantai lengkapnya ikut disimpan apa adanya supaya
 * pemalsuan pun terlihat di riwayat.
 */

function ipSah(teks: string) {
  const bersih = teks.trim().replace(/^::ffff:/i, "").replace(/^\[|\]$/g, "");
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(bersih)) {
    return bersih.split(".").every((x) => Number(x) <= 255) ? bersih : "";
  }
  if (/^[0-9a-f:]+$/i.test(bersih) && bersih.includes(":") && bersih.length <= 45) return bersih.toLowerCase();
  return "";
}

type BawaHeader = { get(nama: string): string | null };

/** IP klien yang benar: entri TERAKHIR X-Forwarded-For, lalu X-Real-IP. */
export function ipKlien(headers: BawaHeader | null | undefined) {
  if (!headers) return "";
  const daftar = String(headers.get("x-forwarded-for") ?? "").split(",");
  return ipSah(daftar[daftar.length - 1] ?? "") || ipSah(String(headers.get("x-real-ip") ?? ""));
}

export function rantaiXff(headers: BawaHeader | null | undefined) {
  return String(headers?.get("x-forwarded-for") ?? "").slice(0, 300);
}

/** 10/8, 172.16/12, 192.168/16, loopback, link-local, ULA IPv6. */
export function ipPribadi(ip: string) {
  const v4 = ip.match(/^(\d+)\.(\d+)\.\d+\.\d+$/);
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])];
    return a === 10 || a === 127 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254);
  }
  const kecil = ip.toLowerCase();
  return kecil === "::1" || kecil.startsWith("fc") || kecil.startsWith("fd") || kecil.startsWith("fe80");
}

/** "192.168.9.121" -> "192.168.9" (subnet /24); IPv6 -> 4 kelompok pertama. */
export function subnetIp(ip: string) {
  if (ip.includes(".")) return ip.split(".").slice(0, 3).join(".");
  return ip.split(":").slice(0, 4).join(":");
}

// ─── Kuki perangkat ──────────────────────────────────────────────────────────

export const NAMA_KUKI_PERANGKAT = "aleta_perangkat";
/**
 * 400 hari, bukan 2 tahun: peramban modern memotong Max-Age di atas 400 hari
 * dan Better Auth menolaknya. Masanya diperbarui proxy tiap halaman dibuka,
 * jadi perangkat yang dipakai tidak pernah kehilangan kukinya.
 */
export const MASA_KUKI_PERANGKAT_DETIK = 400 * 24 * 60 * 60;

export function jalurKukiPerangkat() {
  const dasar = String(process.env.NEXT_PUBLIC_BASE_PATH ?? "").trim().replace(/\/+$/, "");
  return dasar || "/";
}

export function idPerangkatSah(nilai: string | null | undefined) {
  const v = String(nilai ?? "").trim().toLowerCase();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(v) ? v : "";
}

export function idPerangkatDariHeader(headers: BawaHeader | null | undefined) {
  const kuki = String(headers?.get("cookie") ?? "");
  for (const bagian of kuki.split(";")) {
    const [nama, ...sisa] = bagian.trim().split("=");
    if (nama === NAMA_KUKI_PERANGKAT) return idPerangkatSah(decodeURIComponent(sisa.join("=")));
  }
  return "";
}

export function idPerangkatBaru() {
  return crypto.randomUUID();
}

/** Rujukan sesi untuk log: hash pendek, tidak dapat dipakai sebagai token/id. */
export function rujukanSesi(sessionId: string) {
  return crypto.createHash("sha256").update(`aleta-sesi:${sessionId}`).digest("hex").slice(0, 24);
}
