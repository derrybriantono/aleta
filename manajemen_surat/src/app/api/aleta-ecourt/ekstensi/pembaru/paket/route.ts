import { type NextRequest } from "next/server";

import { sidikPaketEkstensi, zipEkstensiUnduh } from "@/server/shared/ekstensi-paket";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ZIP ekstensi untuk pembantu lokal (bukan untuk diunduh lewat peramban).
 *
 * ============================================================================
 * TANPA SESI, TETAPI MENUNTUT SIDIKNYA
 * ============================================================================
 *
 * Pembantu lokal berjalan di luar Chrome dan tidak membawa kuki. Isi ZIP ini
 * sama dengan paket.crx yang memang terbuka tanpa sesi (berkas ekstensi, tanpa
 * kredensial, hanya terjangkau dari jaringan kantor).
 *
 * Permintaan harus menyebut ?versi= dan ?sha256= yang SAMA dengan paket yang
 * sedang disajikan; selain itu 404. Dengan begitu pembantu tidak pernah
 * menerima paket yang berbeda dari yang diumumkan /pembaru/info, dan alamat ini
 * tidak bisa dipakai menebak-nebak isi.
 */
export async function GET(request: NextRequest) {
  try {
    const sekarang = sidikPaketEkstensi();
    const versi = String(request.nextUrl.searchParams.get("versi") || "");
    const sha = String(request.nextUrl.searchParams.get("sha256") || "").toLowerCase();
    if (!versi || !sha || versi !== sekarang.versi || sha !== sekarang.sha256) {
      return Response.json(
        { ok: false, message: "Paket yang diminta bukan paket yang sedang disajikan." },
        { status: 404, headers: { "Cache-Control": "no-store" } }
      );
    }
    const zip = zipEkstensiUnduh();
    return new Response(new Uint8Array(zip), {
      status: 200,
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="aleta-ekstensi-sipp-${sekarang.versi}.bin"`,
        "Content-Length": String(zip.length),
        "Cache-Control": "no-store",
      },
    });
  } catch (galat) {
    return Response.json(
      { ok: false, message: `Paket tidak dapat disusun: ${galat instanceof Error ? galat.message : "sebab tidak diketahui"}` },
      { status: 503 }
    );
  }
}
