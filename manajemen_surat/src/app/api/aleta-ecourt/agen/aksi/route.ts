import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { aksiAgen, type AksiAgen } from "@/server/modules/aleta-ecourt/agen";
import { requireActorUser } from "@/server/modules/organization/service";
import { resolveActorUserId } from "@/server/shared/auth";
import { ApiError } from "@/server/shared/errors";
import { handleRouteError, ok } from "@/server/shared/http";
import { alamatIpPeramban } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const AKSI: AksiAgen[] = ["batalkan", "kerjakan", "diketuk", "urungkan"];

/**
 * POST { id, aksi: "batalkan" | "kerjakan" | "diketuk" | "urungkan" }
 *
 * Hanya atas antrean/jejak milik pemanggil. Tindakan hukum (kelas C) tidak
 * dapat "dikerjakan" dari sini - hanya lewat tombol aslinya, lalu ditandai
 * "diketuk". Setiap aksi tercatat di aleta_agen_jejak.
 */
export async function POST(request: NextRequest) {
  try {
    const db = await getDatabase();
    const actorUserId = await resolveActorUserId(request);
    const actor = await requireActorUser(db, actorUserId);
    const body = (await request.json().catch(() => ({}))) as { id?: string; aksi?: string };
    const aksi = String(body.aksi || "") as AksiAgen;
    if (!AKSI.includes(aksi)) throw new ApiError(400, "Aksi agen tidak dikenal.");
    if (!body.id) throw new ApiError(400, "id wajib.");
    try {
      const hasil = await aksiAgen(db, actor, { id: String(body.id), aksi, alamatIp: alamatIpPeramban(request) });
      return ok(hasil);
    } catch (e) {
      if (e instanceof ApiError) throw e;
      const pesan = String((e as Error)?.message ?? e);
      throw new ApiError(/tidak ditemukan/i.test(pesan) ? 404 : 400, pesan);
    }
  } catch (error) {
    return handleRouteError(error);
  }
}
