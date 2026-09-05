import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { requireActorUser } from "@/server/modules/organization/service";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { EKSTENSI_BERKAS } from "@/server/shared/ekstensi-berkas";
import { berkasEkstensi } from "@/server/shared/ekstensi-paket";
import { susunZip, type BerkasZip } from "@/server/shared/zip";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Mengunduh ekstensi peramban sebagai satu berkas ZIP.
 *
 * ============================================================================
 * ISINYA DITANAM, TIDAK DIBACA DARI DISK
 * ============================================================================
 *
 * Portal berjalan di dalam container yang dibangun dari folder manajemen_surat
 * saja. Folder ekstensi-sipp adalah folder sebelahnya - TIDAK ikut ke dalam
 * image. Membacanya dari disk akan berhasil saat pengembangan lalu selalu
 * gagal di server, dan kegagalan yang hanya muncul di produksi adalah
 * kegagalan yang paling mahal ditemukan.
 *
 * Isinya ditanam lewat scripts/susun-ekstensi.mjs, dan ada pengujian yang
 * membandingkannya dengan berkas asli supaya keduanya tidak dapat berbeda
 * tanpa ketahuan.
 *
 * ============================================================================
 * MENUNTUT SESI PORTAL
 * ============================================================================
 *
 * Ekstensi ini hanya berguna bagi petugas pengadilan, dan tidak ada alasan
 * membiarkannya dapat diambil siapa pun yang menebak alamatnya.
 */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await requireActorUser(db, actorUserId);

    // Versi ekstensi yang DISAJIKAN portal, untuk dibandingkan panel dengan
    // versi yang benar-benar terpasang di peramban.
    //
    // Ekstensi yang dimuat unpacked TIDAK PERNAH diperbarui sendiri - Chrome
    // memang tidak menyediakannya. Tanpa pembandingan ini, petugas dapat
    // berhari-hari menjalankan versi lama tanpa satu pun tanda, dan gejalanya
    // akan tampak seperti kerusakan portal. Itu benar-benar terjadi.
    //
    // Dibaca dari manifest yang ditanam, bukan dari angka yang ditulis
    // terpisah - dua tempat pasti berselisih, dan yang kedua pasti terlupa.
    if (request.nextUrl.searchParams.get("info") === "versi") {
      let versi = "";
      try {
        versi = String(JSON.parse(EKSTENSI_BERKAS["manifest.json"] || "{}").version || "");
      } catch {
        versi = "";
      }
      return Response.json(
        { ok: true, versi },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    // Daftar berkasnya disusun di satu tempat bersama paket .crx - dua salinan
    // yang seharusnya sama adalah sumber kekeliruan yang paling mahal di
    // proyek ini.
    const daftar: BerkasZip[] = berkasEkstensi("ekstensi-sipp");

    if (daftar.length === 0) {
      return new Response(
        JSON.stringify({
          ok: false,
          message: "Berkas ekstensi belum tertanam. Jalankan scripts/susun-ekstensi.mjs lalu bangun ulang.",
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const arsip = susunZip(daftar);

    return new Response(new Uint8Array(arsip), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": 'attachment; filename="aleta-ekstensi-sipp.zip"',
        "Content-Length": String(arsip.length),
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "EKSTENSI_DOWNLOAD_FAILED",
      feature: "aleta_ecourt",
      entityId: "ekstensi",
    });
  }
}
