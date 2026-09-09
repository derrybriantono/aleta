import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { accLembar, kembalikanLembar } from "@/server/modules/aleta-ecourt/bas-acc";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ============================================================================
 * ACC HAKIM ATAS BERITA ACARA SIDANG
 * ============================================================================
 *
 * Langkah yang benar-benar ada di kenyataan tetapi tidak pernah ada di ALETA:
 * berita acara yang disusun panitera sidang di-acc hakim sebelum dipakai.
 *
 * Selama langkahnya tidak ada, BAS yang sudah di-acc tidak dapat dibedakan
 * dari yang belum - dan penanda "belum ada BAS" pada jadwal sidang menjawab
 * pertanyaan yang berbeda sama sekali: ia berbicara tentang keberadaan
 * berkasnya, bukan tentang persetujuan atasnya.
 *
 * ============================================================================
 * KEWENANGANNYA DIPERIKSA DI LAPISAN ATURAN, BUKAN DI SINI
 * ============================================================================
 *
 * Rute ini hanya memastikan pemanggilnya berhak membuka panel. Siapa yang
 * boleh meng-acc - hakim, bukan panitera - diperiksa bas-acc, sebab di sanalah
 * alasannya tertulis: acc adalah pemeriksaan oleh ORANG LAIN, dan panitera
 * yang dapat meng-acc berita acaranya sendiri membuat langkah ini menjadi
 * tombol tambahan alih-alih pemeriksaan.
 *
 * Menaruh pemeriksaan itu di rute akan membuatnya hilang begitu ada pemanggil
 * kedua - dan pemanggil kedua selalu datang.
 */
export async function POST(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanKapabilitas(db, actorUserId, "panel");

    const badan = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const lembarId = String(badan.lembarId ?? "").trim();
    const tindakan = String(badan.tindakan ?? "").trim();

    if (!lembarId) {
      return ok({ ok: false, alasan: "Lembar berita acara belum disebutkan." });
    }

    if (tindakan === "acc") {
      const hasil = await accLembar(
        db,
        String(actorUserId),
        lembarId,
        String(badan.catatan ?? "")
      );
      return ok({ ok: true, ...hasil });
    }

    if (tindakan === "kembalikan") {
      const hasil = await kembalikanLembar(
        db,
        String(actorUserId),
        lembarId,
        String(badan.alasan ?? "")
      );
      return ok({ ok: true, ...hasil });
    }

    // Tindakan yang tidak dikenali ditolak apa adanya, bukan diperlakukan
    // sebagai salah satu dari keduanya. Menebak di sini berarti satu salah
    // ketik dapat meng-acc lembar yang sebenarnya hendak dikembalikan.
    return ok({ ok: false, alasan: "Tindakan tidak dikenali - sebutkan acc atau kembalikan." });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "BAS_ACC_FAILED",
      feature: "aleta_ecourt",
      entityId: "bas-acc",
    });
  }
}
