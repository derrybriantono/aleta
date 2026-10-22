import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { bolehMenyuntingAkses, pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import { callAletaBotSippBridge } from "@/server/modules/aleta-sipp/aleta-sipp-datasource";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ApiError } from "@/server/shared/errors";
import { ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type JawabanCari = { ok?: boolean; sebab?: string; perkara?: unknown[] };

/**
 * Tes putusan: mencari perkara MANA PUN di SIPP menurut sebagian nomornya (tidak dibatasi jadwal sidang 90 hari lalu - 45 hari ke
 * depan) untuk dipilih sebagai perkara ACUAN. Super Admin saja; hanya membaca (bot: tes.cariPerkara).
 *
 *   GET ?nomor=<paling sedikit tiga karakter nomor perkara>
 */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    const actor = await pastikanKapabilitas(db, actorUserId, "panel");
    if (!bolehMenyuntingAkses(actor)) throw new ApiError(403, "Tes putusan hanya untuk Super Admin.");

    const nomor = String(request.nextUrl.searchParams.get("nomor") ?? "").trim().slice(0, 60);
    if (nomor.length < 3) return Response.json({ ok: false, alasan: "Ketik paling sedikit tiga karakter nomor perkara." }, { status: 400 });

    const hasil = await callAletaBotSippBridge<JawabanCari>("tes.cariPerkara", { nomorPerkara: nomor, limit: 12 }, { timeoutMs: 20_000 });
    if (!hasil.ok || !hasil.data?.ok) {
      return Response.json({ ok: false, alasan: hasil.data?.sebab ?? hasil.error ?? "Pencarian perkara di SIPP gagal." }, { status: 502 });
    }
    return ok({ nomor, perkara: Array.isArray(hasil.data.perkara) ? hasil.data.perkara : [] }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "BLANGKO_DERRY_TES_CARI_FAILED",
      feature: "aleta_ecourt",
      entityId: "blangko-derry-tes-cari",
    });
  }
}
