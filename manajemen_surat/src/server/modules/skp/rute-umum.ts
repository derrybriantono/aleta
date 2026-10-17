import { type NextRequest } from "next/server";

import type { UserPersona } from "@/lib/types";
import type { AktorSkp } from "@/lib/skp-jabatan-tipe";
import { getDatabase, type AletaDatabase } from "@/server/db/client";
import { bacaAktorSkp } from "@/server/modules/skp/pegawai";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ApiError } from "@/server/shared/errors";
import { readJsonBody } from "@/server/shared/request";

/** Konteks yang dipegang tiap rute JSON SKP sesudah sesinya sah. */
export type KonteksRuteSkp = {
  db: AletaDatabase;
  actorUserId: string;
  aktor: AktorSkp;
  pengguna: UserPersona;
  request: NextRequest;
};

/**
 * Pembungkus rute JSON SKP: sesi dahulu (401), lalu isi rute; galat apa pun
 * dijawab lewat penjawab galat ALETA dan dicatat sebagai `aksiGagal`.
 */
export async function jalankanRuteSkp(
  request: NextRequest,
  aksiGagal: string,
  isi: (k: KonteksRuteSkp) => Promise<Response>
): Promise<Response> {
  let db: AletaDatabase | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    const { aktor, pengguna } = await bacaAktorSkp(db, actorUserId);
    return await isi({ db, actorUserId: pengguna.id, aktor, pengguna, request });
  } catch (error) {
    return handleAdminRouteError(error, request, { db, actorUserId, action: aksiGagal, feature: "skp" });
  }
}

/** Isi JSON permintaan sebagai objek; selain objek -> 400. */
export async function bacaIsiJson(request: Request): Promise<Record<string, unknown>> {
  let isi: unknown;
  try {
    isi = await readJsonBody<unknown>(request);
  } catch {
    throw new ApiError(400, "Isi permintaan harus JSON yang sah.");
  }
  if (!isi || typeof isi !== "object" || Array.isArray(isi)) throw new ApiError(400, "Isi permintaan harus berupa objek JSON.");
  return isi as Record<string, unknown>;
}
