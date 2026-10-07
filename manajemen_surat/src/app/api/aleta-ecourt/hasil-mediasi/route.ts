import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import { bacaBahanHasilMediasi, simpanDrafHasilMediasi } from "@/server/modules/aleta-ecourt/hasil-mediasi";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ok } from "@/server/shared/http";
import { readJsonBody } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Hasil mediasi otomatis (.rtf) - bahan SIPP dan draf pilihan mediator.
 *
 *   GET  ?nomorPerkara=&mediasiId=&pengadilan=  -> { bahan, draf, tidakTerbaca }
 *   POST { nomorPerkara, mediasiId, draf }      -> { tersimpan, diubahPada }
 *
 * Kapabilitas yang sama dengan Jadwal Mediasi ("panel"), LALU pemeriksaan
 * mediator: hanya mediator perkara itu (dicocokkan dari nama di SIPP) dan
 * Super Admin. Naskah .rtf-nya disusun di peramban; rute ini tidak menulis ke
 * SIPP maupun e-Court. Lihat server/modules/aleta-ecourt/hasil-mediasi.ts.
 */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    const aktor = await pastikanKapabilitas(db, actorUserId, "panel");
    const p = request.nextUrl.searchParams;
    const hasil = await bacaBahanHasilMediasi(db, aktor, {
      nomorPerkara: String(p.get("nomorPerkara") || ""),
      mediasiId: String(p.get("mediasiId") || ""),
      namaPengadilan: String(p.get("pengadilan") || ""),
    });
    return ok(hasil);
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "HASIL_MEDIASI_READ_FAILED",
      feature: "aleta_ecourt",
    });
  }
}

export async function POST(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    const aktor = await pastikanKapabilitas(db, actorUserId, "panel");
    const badan = (await readJsonBody(request)) as { nomorPerkara?: unknown; mediasiId?: unknown; draf?: unknown };
    const hasil = await simpanDrafHasilMediasi(db, aktor, {
      nomorPerkara: String(badan?.nomorPerkara ?? ""),
      mediasiId: String(badan?.mediasiId ?? ""),
      draf: badan?.draf,
    });
    return ok(hasil);
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "HASIL_MEDIASI_SAVE_FAILED",
      feature: "aleta_ecourt",
    });
  }
}
