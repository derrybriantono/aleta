import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { pastikanAdminIstimewa, pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import {
  bacaSumber,
  pelajariKorpus,
  pergeseranBelumDiputus,
  putuskanPergeseran,
  statistikKorpus,
  tarikSeluruhBlangko,
} from "@/server/modules/aleta-ecourt/korpus-blangko";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { getSearchParam } from "@/server/shared/request";
import { ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Korpus blangko (Tahap 1 - Kemandirian Blangko).
 *
 *   GET                        keadaan korpus: berapa blangko, blok, pergeseran
 *   GET ?jalur=...             satu blangko sumber beserta naskah susun ulangnya
 *   GET ?pergeseran=1          pergeseran yang menunggu diputus
 *
 *   POST {tindakan:"pelajari"}  menarik seluruh blangko ABT lalu menyusun korpus
 *   POST {tindakan:"putuskan"}  menetapkan bunyi mana yang berlaku pada satu pergeseran
 *
 * ============================================================================
 * MEMBACA TERBUKA, MEMPELAJARI DAN MEMUTUSKAN TIDAK
 * ============================================================================
 *
 * Isi korpus pantas dibaca siapa pun yang memakai blangko. Mempelajari ulang
 * mengganti korpus yang dipakai seluruh pengadilan, dan memutuskan pergeseran
 * menetapkan BUNYI kalimat hukum - keduanya menuntut kewenangan admin.
 */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanKapabilitas(db, actorUserId, "panel");

    const jalur = String(getSearchParam(request, "jalur") ?? "").trim();
    if (jalur) {
      const sumber = await bacaSumber(db, jalur);
      if (!sumber) return ok({ ada: false, sebab: "Blangko itu belum ada di korpus." });
      return ok({ ada: true, sumber });
    }

    if (String(getSearchParam(request, "pergeseran") ?? "").trim() === "1") {
      return ok({ ada: true, pergeseran: await pergeseranBelumDiputus(db) });
    }

    return ok({ ada: true, statistik: await statistikKorpus(db) });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "KORPUS_BLANGKO_BACA_FAILED",
      feature: "aleta_ecourt",
      entityId: "korpus-blangko",
    });
  }
}

type Masukan = {
  tindakan?: string;
  olehNama?: string;
  id?: string;
  blokTerpilih?: string;
  alasan?: string;
};

export async function POST(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanAdminIstimewa(db, actorUserId, "mengubah korpus blangko");

    const masukan = (await request.json()) as Masukan;
    const oleh = String(masukan.olehNama ?? "") || String(actorUserId ?? "");

    switch (String(masukan.tindakan ?? "")) {
      case "pelajari": {
        const tarikan = await tarikSeluruhBlangko();
        if (!tarikan.ok) return ok({ ok: false, sebab: tarikan.sebab });
        return ok(await pelajariKorpus(db, { berkas: tarikan.berkas, oleh }));
      }

      case "putuskan":
        return ok(
          await putuskanPergeseran(db, {
            id: String(masukan.id ?? ""),
            blokTerpilih: String(masukan.blokTerpilih ?? ""),
            alasan: String(masukan.alasan ?? ""),
            oleh,
          })
        );

      default:
        return ok({ ok: false, sebab: "Tindakan tidak dikenali." });
    }
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "KORPUS_BLANGKO_UBAH_FAILED",
      feature: "aleta_ecourt",
      entityId: "korpus-blangko",
    });
  }
}
