import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import { pastikanAksi } from "@/server/modules/akses/hak-peran";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ok } from "@/server/shared/http";
import { susunPanduan } from "@/server/shared/pandu-saksi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Panduan pertanyaan saksi untuk satu perkara (Jadwal Sidang dan Status Perkara).
 *
 * Katalog dan mesinnya adalah milik ekstensi yang sama (server/shared/pandu-saksi.ts);
 * rute ini hanya menjawab PERTANYAAN menurut jenis perkara dan keadaan. Tidak ada
 * data perkara yang dibaca di sini dan tidak ada yang ditulis ke SIPP maupun ABT.
 *
 * Masukan (kueri): jenisPerkaraId, alurPerkaraId, jenisPerkara (nama, cadangan),
 * keadaan (JSON {kunci: nilai|[nilai]}), sensitif=1 (butir sensitif keterangan anak).
 */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanKapabilitas(db, actorUserId, "panel");
    await pastikanAksi(db, actorUserId, "pandu.saksi");

    const kueri = request.nextUrl.searchParams;
    let keadaan: Record<string, unknown> = {};
    const mentah = kueri.get("keadaan");
    if (mentah && mentah.length <= 4000) {
      try {
        const nilai: unknown = JSON.parse(mentah);
        if (nilai && typeof nilai === "object" && !Array.isArray(nilai)) keadaan = nilai as Record<string, unknown>;
      } catch {
        keadaan = {};
      }
    }

    const panduan = susunPanduan({
      jenisPerkaraId: kueri.get("jenisPerkaraId"),
      alurPerkaraId: kueri.get("alurPerkaraId"),
      jenisPerkara: kueri.get("jenisPerkara"),
      keadaan,
      butirSensitif: kueri.get("sensitif") === "1",
    });
    return ok({ panduan });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "PANDU_SAKSI_READ_FAILED",
      feature: "aleta_ecourt",
    });
  }
}
