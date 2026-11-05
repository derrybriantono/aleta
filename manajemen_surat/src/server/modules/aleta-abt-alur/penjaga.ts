import type { NextRequest } from "next/server";

import { getEffectiveRoleId } from "@/lib/permissions";
import { getDatabase } from "@/server/db/client";
import { requireActorUser } from "@/server/modules/organization/service";
import { appendAuditLog } from "@/server/shared/audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ApiError } from "@/server/shared/errors";
import { nextPrefixedId } from "@/server/shared/ids";

/**
 * Penjaga bersama rute alur kerja per peran (Tahap 6) dan berdampingan (Tahap 7): HANYA Super Admin, diputuskan di server pada SETIAP
 * permintaan. Peran lain, termasuk Admin dan peran yang dilihat lewat "lihat sebagai akun", ditolak 403 sebelum layanan apa pun disentuh.
 * "Lihat sebagai peran" di layar Siap diperiksa hanya memilih peran yang DIDAFTARKAN; ia tidak pernah memberi hak kepada akun lain.
 */

export type Db = Awaited<ReturnType<typeof getDatabase>>;

export async function aktorSuperAdminAlur(request: NextRequest, pesan: string) {
  const db = await getDatabase();
  const actorUserId = await resolveActorUserId(request);
  const actor = await requireActorUser(db, actorUserId);
  const roleId = String(getEffectiveRoleId(actor) ?? actor.roleId ?? "");
  if (roleId !== "super-admin") throw new ApiError(403, pesan);
  return { db, actorUserId, actor, aktor: { id: String(actor.id), name: String(actor.name || actor.id) } };
}

export async function bacaBadanJson(request: NextRequest): Promise<Record<string, unknown>> {
  try {
    const isi = (await request.json()) as unknown;
    if (isi && typeof isi === "object" && !Array.isArray(isi)) return isi as Record<string, unknown>;
  } catch {
    /* jatuh ke galat di bawah */
  }
  throw new ApiError(400, "Badan permintaan harus JSON.");
}

/** Audit tanpa isi naskah dan tanpa nama pihak: hanya penanda, angka, dan pilihan. */
export async function catatAlur(db: Db, actorUserId: string, action: string, entityId: string, payload: Record<string, unknown>) {
  await appendAuditLog(db, {
    id: await nextPrefixedId(db, "audit_logs", "adt"),
    actorUserId,
    action,
    entityType: "aleta_abt_alur",
    entityId,
    payload,
  });
}
