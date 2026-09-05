import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { getGatewayPenunjukanUsulan } from "@/server/modules/aleta-bot/whatsapp-gateway-client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import { masukLangkahPerkara } from "@/server/modules/aleta-ecourt/masuk-pejabat";
import { bacaPengaturanPenunjukan } from "@/server/modules/aleta-ecourt/penunjukan-pengaturan";
import { normalisasiUsulan } from "@/server/modules/aleta-ecourt/rencana-penetapan";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Masuk SIPP sebagai pelaksana satu langkah penetapan, lalu membuka SIPP.
 *
 * ============================================================================
 * SATU OPERATOR, TANPA BUKA-TUTUP BANYAK AKUN
 * ============================================================================
 *
 * Inilah yang menggantikan keharusan operator masuk-keluar empat akun SIPP.
 * Halaman yang dikembalikan menutup sesi yang sedang terbuka, masuk sebagai
 * pejabat pelaksana langkah ini, MEMBUKTIKAN pendaratannya benar, lalu
 * meneruskan ke SIPP. Seluruh penjagaan itu ada di masukSebagaiPejabat.
 *
 * Yang menulis penetapan tetap operator - mengisi lewat ekstensi, memeriksa,
 * lalu menekan Simpan sendiri. Rute ini hanya mengurus AKUN mana yang aktif,
 * bukan isian formulirnya.
 *
 * Dikembalikan sebagai HTML, bukan JSON: ia memang halaman jembatan yang
 * dibuka di tab, sama seperti "buka SIPP sebagai diri sendiri".
 */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    const actor = await pastikanKapabilitas(db, actorUserId, "penunjukan-otomatis");

    const jenis = String(request.nextUrl.searchParams.get("jenis") || "").trim();
    const nomor = String(request.nextUrl.searchParams.get("nomor") || "").trim();
    const perkaraId = String(request.nextUrl.searchParams.get("perkaraId") || "").trim();
    if (!jenis || !nomor) {
      return new Response("Jenis penetapan dan nomor perkara wajib diisi.", {
        status: 400,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }

    // Usulan dibutuhkan untuk mengetahui ketua majelis (PHS). Diambil dari bot,
    // dengan pengaturan yang sama seperti papan penunjukan.
    const pengaturan = await bacaPengaturanPenunjukan(db);
    const hasil = await getGatewayPenunjukanUsulan({
      nomorPerkara: nomor,
      pengaturan: {
        aturan: pengaturan.aturan as unknown as Record<string, unknown>,
        hariSidang: pengaturan.hariSidang,
        paniteraMajelis: pengaturan.paniteraMajelis,
      },
    });
    const usulan = hasil.ok ? normalisasiUsulan(hasil.data as Record<string, unknown>) : null;
    if (!usulan) {
      return new Response("Usulan penetapan belum dapat dibaca dari ALETA Bot.", {
        status: 502,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }

    const html = await masukLangkahPerkara(db, {
      actor: {
        id: actor.id,
        name: actor.name,
        isActive: actor.isActive !== false,
        roleId: actor.roleId,
      },
      jenis,
      nomorPerkara: nomor,
      perkaraId,
      usulan,
    });

    return new Response(html, {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
    });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "SIPP_MASUK_LANGKAH_FAILED",
      feature: "penunjukan",
      entityId: "masuk-pejabat",
    });
  }
}
