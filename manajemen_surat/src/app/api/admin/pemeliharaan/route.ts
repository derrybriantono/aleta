import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { pastikanAksi } from "@/server/modules/akses/hak-peran";
import { bacaPengaturanPemeliharaan, hitungKeadaan, simpanPengaturanPemeliharaan } from "@/server/modules/pemeliharaan/layanan";
import { appendAuditLog } from "@/server/shared/audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { handleRouteError, ok } from "@/server/shared/http";
import { nextPrefixedId } from "@/server/shared/ids";
import { readJsonBody } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Mode pemeliharaan (E3) - Super Admin (aksi "pemeliharaan.atur").
 *   GET   -> pengaturan tersimpan + keadaan sekarang
 *   POST  -> simpan {aktif, pesan, mulai, selesai, adminBoleh, kabarWa}; tercatat di audit
 * Rute ini termasuk JALUR_TETAP_BEKERJA: Super Admin dapat mematikannya saat mode aktif.
 */
export async function GET(request: NextRequest) {
  try {
    const db = await getDatabase();
    await pastikanAksi(db, await resolveActorUserId(request), "pemeliharaan.atur");
    const pengaturan = await bacaPengaturanPemeliharaan(db, { tanpaSinggah: true });
    return ok({ pengaturan, keadaan: hitungKeadaan(pengaturan, new Date()) });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const db = await getDatabase();
    const actor = await pastikanAksi(db, await resolveActorUserId(request), "pemeliharaan.atur");
    const badan = await readJsonBody<Record<string, unknown>>(request).catch(() => ({}) as Record<string, unknown>);
    const pengaturan = await simpanPengaturanPemeliharaan(db, badan, { id: actor.id, nama: actor.name ?? actor.id });
    await appendAuditLog(db, {
      id: await nextPrefixedId(db, "audit_logs", "adt"),
      actorUserId: actor.id,
      action: "UPDATE_PEMELIHARAAN",
      entityType: "aleta_ekstensi_setelan",
      entityId: "*sistem*:pemeliharaan:pengaturan",
      payload: { aktif: pengaturan.aktif, mulai: pengaturan.mulai, selesai: pengaturan.selesai, adminBoleh: pengaturan.adminBoleh, kabarWa: pengaturan.kabarWa },
    });
    return ok({ pengaturan, keadaan: hitungKeadaan(pengaturan, new Date()) });
  } catch (error) {
    return handleRouteError(error);
  }
}
