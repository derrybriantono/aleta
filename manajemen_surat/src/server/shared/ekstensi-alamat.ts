import { type NextRequest } from "next/server";

/**
 * Alamat dasar portal (termasuk basePath) seperti yang dilihat KOMPUTER PETUGAS.
 *
 * Dipakai updates.xml (alamat .crx) dan pemasang pembaru otomatis (asal server
 * yang diizinkan pembantu lokal). Isinya dipindah apa adanya dari updates.xml
 * supaya satu aturan melayani dua rute.
 *
 * Portal berjalan di balik Apache: request.nextUrl di dalam selalu
 * http://localhost:3000 dan awalan /aleta sudah dipotong Next sebagai basePath.
 * Yang dipakai karena itu header yang disetel Apache (X-Forwarded-Host /
 * X-Forwarded-Proto, dengan ProxyPreserveHost On), lalu awalan basePath dipasang
 * kembali. ALETA_EKSTENSI_ALAMAT_DASAR disediakan untuk proxy yang berbeda.
 */
export function alamatDasarPortal(request: NextRequest): string {
  const setelan = String(process.env.ALETA_EKSTENSI_ALAMAT_DASAR || "").trim();
  if (setelan) return setelan.replace(/\/+$/, "");

  // X-Forwarded-* dapat berisi BEBERAPA nilai dipisah koma ("192.168.10.10,
  // 192.168.10.10"); yang berlaku yang PERTAMA, yang paling dekat dengan pengguna.
  const pertama = (nilai: string | null) => String(nilai || "").split(",")[0].trim();

  const host =
    pertama(request.headers.get("x-forwarded-host")) ||
    pertama(request.headers.get("host")) ||
    request.nextUrl.host;
  const proto =
    pertama(request.headers.get("x-forwarded-proto")) ||
    request.nextUrl.protocol.replace(":", "") ||
    "http";
  const awalan = String(process.env.NEXT_PUBLIC_BASE_PATH || "").replace(/\/+$/, "");

  return `${proto}://${host}${awalan}`;
}
