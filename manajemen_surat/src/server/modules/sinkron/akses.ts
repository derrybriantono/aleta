import { isPrivilegedAdmin } from "@/lib/permissions";
import type { AletaDatabase } from "@/server/db/client";
import { requireActorUser } from "@/server/modules/organization/service";
import { appendAuditLog } from "@/server/shared/audit";
import { ApiError } from "@/server/shared/errors";
import { nextPrefixedId } from "@/server/shared/ids";

/**
 * Kewenangan layar Sinkron & cadangan: Admin MELIHAT, hanya Super Admin yang
 * mengubah, menjalankan, menyambungkan Drive, dan membuat token laptop -
 * sama dengan cadangan basis data penuh di layar Backup Sistem.
 */
export async function pastikanAdminSinkron(db: AletaDatabase, actorUserId: string | null, ubah: boolean) {
  const actor = await requireActorUser(db, actorUserId);
  if (!isPrivilegedAdmin(actor)) {
    throw new ApiError(403, "Hanya Admin atau Super Admin yang dapat membuka Sinkron & cadangan.");
  }
  const superAdmin = actor.roleId === "super-admin";
  if (ubah && !superAdmin) {
    throw new ApiError(403, "Hanya Super Admin yang dapat mengubah atau menjalankan Sinkron & cadangan.");
  }
  return { actor, superAdmin };
}

export async function auditSinkron(
  db: AletaDatabase | null,
  aksi: string,
  actorUserId: string | null,
  payload: Record<string, unknown>
) {
  if (!db) return;
  try {
    await appendAuditLog(db, {
      id: await nextPrefixedId(db, "audit_logs", "adt"),
      actorUserId,
      action: aksi,
      entityType: "sinkron",
      entityId: String(payload.entityId ?? "pengaturan"),
      payload,
    });
  } catch {
    /* jejak yang gagal dicatat tidak membatalkan tindakan */
  }
}
