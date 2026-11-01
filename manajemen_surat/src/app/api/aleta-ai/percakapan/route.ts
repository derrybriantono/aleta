import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { pelakuAi } from "@/server/modules/aleta-ai/akses";
import { buatPercakapan, daftarPercakapan } from "@/server/modules/aleta-ai/percakapan";
import { pastikanProyekBolehDipakai, setPilihanPercakapan } from "@/server/modules/aleta-ai/proyek-kelola";
import { resolveActorUserId } from "@/server/shared/auth";
import { handleRouteError, ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ALETA Ai - percakapan milik sendiri.
 *   GET  -> [{id, judul, diperbarui, perkara?}]
 *   POST {judul?, perkara?, proyekId?} -> {id}   (proyekId = proyek kelolaan yang boleh dipakai pengguna; kosong = proyek bawaan)
 */
export async function GET(request: NextRequest) {
  try {
    const db = await getDatabase();
    const pelaku = await pelakuAi(db, await resolveActorUserId(request));
    return ok(await daftarPercakapan(db, pelaku.id));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const db = await getDatabase();
    const pelaku = await pelakuAi(db, await resolveActorUserId(request));
    const badan = (await request.json().catch(() => ({}))) as { judul?: unknown; perkara?: unknown; proyekId?: unknown };
    const proyekId = String(badan.proyekId ?? "");
    // Hak atas proyek diperiksa DULU supaya percakapan tidak tercipta setengah jadi.
    if (proyekId) await pastikanProyekBolehDipakai(db, pelaku, proyekId);
    const hasil = await buatPercakapan(db, pelaku.id, { judul: String(badan.judul ?? ""), perkara: String(badan.perkara ?? "") });
    if (proyekId) await setPilihanPercakapan(db, pelaku, hasil.id, proyekId);
    return ok(hasil, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
