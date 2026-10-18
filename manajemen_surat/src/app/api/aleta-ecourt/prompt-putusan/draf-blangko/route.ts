import { type NextRequest } from "next/server";

import { bahanDrafH7, bahanDrafPerakit, keteranganDrafBlangko } from "@/lib/draf-blangko-prompt";
import type { DrafBlangkoBahan } from "@/lib/prompt-ai";
import { getDatabase } from "@/server/db/client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import { bacaDrafH7 } from "@/server/modules/aleta-ecourt/agen-h7-putusan";
import { riwayatDraf } from "@/server/modules/aleta-ecourt/perakit-putusan";
import { pastikanAksi } from "@/server/modules/akses/hak-peran";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Draf putusan perkara ini yang masih berbentuk blangko (18 Okt 2026).
 *
 *   GET ?perkaraId=<id SIPP>
 *     -> { ada, draf: [{ sumber, judul, teks, dibuatPada }], keterangan }
 *
 * Membaca saja, dari draf perakit putusan dan draf agen H-7. Draf utuh memuat
 * isian dan ringkasan perkara, jadi hanya pemegang perkara ("blangko-abt") yang
 * membacanya - sama dengan rute draf H-7; yang lain menerima "belum ada draf"
 * beserta sebabnya, bukan galat, supaya penyusun perintah tetap berjalan.
 */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanKapabilitas(db, actorUserId, "panel");
    await pastikanAksi(db, actorUserId, "status.analisa");

    const perkaraId = String(request.nextUrl.searchParams.get("perkaraId") || "").trim();
    if (!perkaraId) return ok({ ada: false, draf: [], keterangan: keteranganDrafBlangko(0, []) });

    try {
      await pastikanKapabilitas(db, actorUserId, "blangko-abt");
    } catch {
      return ok({
        ada: false,
        draf: [],
        keterangan: "belum ada draf blangko yang dapat Anda baca untuk perkara ini",
        tanpaHak: true,
      });
    }

    const draf: DrafBlangkoBahan[] = [];
    const kendala: string[] = [];

    try {
      const perakit = (await riwayatDraf(db, perkaraId))[0];
      const bahan = perakit ? bahanDrafPerakit(perakit) : null;
      if (bahan) draf.push(bahan);
    } catch {
      kendala.push("draf perakit putusan tidak terbaca");
    }

    try {
      const h7 = (await bacaDrafH7(db, [perkaraId]))[perkaraId];
      const bahan = h7 ? bahanDrafH7(h7) : null;
      if (bahan) draf.push(bahan);
    } catch {
      kendala.push("draf agen H-7 tidak terbaca");
    }

    return ok({
      ada: draf.length > 0,
      draf,
      kendala,
      keterangan: keteranganDrafBlangko(draf.length, draf.map((d) => d.sumber)),
    });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "PROMPT_DRAF_BLANGKO_READ_FAILED",
      feature: "aleta_ecourt",
      entityId: "prompt-draf-blangko",
    });
  }
}
