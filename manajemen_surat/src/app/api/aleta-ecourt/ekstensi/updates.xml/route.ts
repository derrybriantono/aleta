import { type NextRequest } from "next/server";

import { idEkstensi, naskahUpdatesXml } from "@/server/shared/crx";
import { kunciCrx, versiEkstensi } from "@/server/shared/ekstensi-paket";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Naskah pembaruan yang dibaca Chrome.
 *
 * ============================================================================
 * SENGAJA TANPA SESI
 * ============================================================================
 *
 * Chrome memeriksa pembaruan dari peramban itu sendiri, BUKAN dari halaman
 * yang sedang dibuka - permintaannya tidak membawa kuki siapa pun. Alamat ini
 * karena itu harus dapat diambil tanpa masuk portal. Menuntut sesi di sini
 * berarti pembaruan tidak pernah berjalan, dan diamnya tidak akan pernah
 * terlihat: Chrome tidak melaporkan pemeriksaan yang ditolak.
 *
 * Yang terbuka hanyalah ISI EKSTENSI - berkas yang memang sudah dapat diunduh
 * setiap pegawai. Tidak ada kredensial, tidak ada data perkara. Dan alamatnya
 * hanya terjangkau dari jaringan kantor.
 *
 * ============================================================================
 * ALAMAT UNDUHAN DISUSUN DARI HEADER, BUKAN DARI nextUrl
 * ============================================================================
 *
 * Portal berjalan di balik Apache: dari dalam, request.nextUrl selalu berbunyi
 * http://localhost:3000 dan awalan /aleta sudah dipotong Next sebagai basePath.
 * Memakainya menghasilkan alamat yang benar HANYA bila dibuka dari server itu
 * sendiri - dan Chrome di komputer petugas tidak akan pernah menemukannya.
 *
 * Yang dipakai karena itu header yang memang disetel Apache
 * (X-Forwarded-Host / X-Forwarded-Proto, dengan ProxyPreserveHost On), lalu
 * awalan basePath dipasang kembali. Setelan ALETA_EKSTENSI_ALAMAT_DASAR
 * disediakan untuk pemasangan yang proxy-nya berbeda, dan tidak dipakai selama
 * headernya sudah benar.
 */
function alamatDasar(request: NextRequest): string {
  const setelan = String(process.env.ALETA_EKSTENSI_ALAMAT_DASAR || "").trim();
  if (setelan) return setelan.replace(/\/+$/, "");

  // Header X-Forwarded-* dapat berisi BEBERAPA nilai dipisah koma - Apache di
  // sini menyetelnya sendiri sekaligus menambahkan asal permintaannya, sehingga
  // terbaca "192.168.10.10, 192.168.10.10". Yang berlaku selalu yang PERTAMA,
  // yaitu yang paling dekat dengan pengguna.
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
export async function GET(request: NextRequest) {
  const kunci = kunciCrx();
  const versi = versiEkstensi();

  if (!kunci || !versi) {
    // Dijawab apa adanya, bukan 200 berisi naskah kosong. Chrome yang menerima
    // naskah tanpa isi akan diam saja; galat yang terbaca di log server jauh
    // lebih mudah ditelusuri.
    return new Response(
      `<!-- ALETA: ${!kunci ? "ALETA_EKSTENSI_CRX_KEY belum disetel" : "versi ekstensi tidak terbaca"} -->`,
      { status: 503, headers: { "Content-Type": "application/xml; charset=utf-8" } }
    );
  }

  let id = "";
  try {
    id = idEkstensi(kunci);
  } catch {
    return new Response("<!-- ALETA: kunci .crx tidak dapat dibaca -->", {
      status: 503,
      headers: { "Content-Type": "application/xml; charset=utf-8" },
    });
  }

  const alamatCrx = `${alamatDasar(request)}/api/aleta-ecourt/ekstensi/paket.crx`;

  return new Response(naskahUpdatesXml({ id, versi, alamatCrx }), {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
