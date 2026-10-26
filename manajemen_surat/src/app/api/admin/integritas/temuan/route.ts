import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { pastikanAksi } from "@/server/modules/akses/hak-peran";
import { tandaiAman, tandaiDitangani } from "@/server/modules/integritas/layanan";
import { resolveActorUserId } from "@/server/shared/auth";
import { ApiError } from "@/server/shared/errors";
import { handleRouteError, ok } from "@/server/shared/http";
import { readJsonBody } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Menandai temuan (E6) - Super Admin ("integritas.atur").
 *   {id, aksi: "ditangani"}              -> sudah diperiksa/dibersihkan manusia
 *   {id, aksi: "aman", alasan}           -> sidik berkas dicatat diketahui aman
 * Tidak menyentuh berkas apa pun.
 */
export async function POST(request: NextRequest) {
  try {
    const db = await getDatabase();
    const actor = await pastikanAksi(db, await resolveActorUserId(request), "integritas.atur");
    const badan = await readJsonBody<Record<string, unknown>>(request).catch(() => ({}) as Record<string, unknown>);
    const id = String(badan.id ?? "");
    const oleh = { id: actor.id, nama: actor.name ?? actor.id };
    if (badan.aksi === "ditangani") return ok({ temuan: await tandaiDitangani(db, id, oleh) });
    if (badan.aksi === "aman") return ok({ temuan: await tandaiAman(db, id, String(badan.alasan ?? ""), oleh) });
    throw new ApiError(400, "Aksi tidak dikenal.");
  } catch (error) {
    return handleRouteError(error);
  }
}
