import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { pastikanAksi } from "@/server/modules/akses/hak-peran";
import { pindaiSemua, sedangMemindai } from "@/server/modules/integritas/layanan";
import { bacaPengaturanIntegritas } from "@/server/modules/integritas/pengaturan";
import { appendAuditLog } from "@/server/shared/audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ApiError } from "@/server/shared/errors";
import { handleRouteError, ok } from "@/server/shared/http";
import { nextPrefixedId } from "@/server/shared/ids";
import { readJsonBody } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Pindai sekarang (E6) - Super Admin ("integritas.atur"). Berjalan di latar:
 * jawaban segera {dimulai: true}; layar membaca hasilnya lewat GET /api/admin/integritas.
 * {jenis: "penuh"} menghitung ulang sidik SEMUA berkas. Hanya bila penjaga menyala.
 */
export async function POST(request: NextRequest) {
  try {
    const db = await getDatabase();
    const actor = await pastikanAksi(db, await resolveActorUserId(request), "integritas.atur");
    const badan = await readJsonBody<Record<string, unknown>>(request).catch(() => ({}) as Record<string, unknown>);
    const p = await bacaPengaturanIntegritas(db, { tanpaSinggah: true });
    if (!p.aktif) throw new ApiError(400, "Penjaga integritas sedang mati. Nyalakan dulu sebelum memindai.");
    if (p.folder.length === 0 && p.halamanPublik.length === 0) throw new ApiError(400, "Belum ada folder atau halaman yang didaftarkan.");
    if (sedangMemindai()) throw new ApiError(409, "Pemindaian sedang berjalan.");
    const jenis = badan.jenis === "penuh" ? "penuh" : "otomatis";
    await appendAuditLog(db, {
      id: await nextPrefixedId(db, "audit_logs", "adt"),
      actorUserId: actor.id,
      action: "PINDAI_INTEGRITAS",
      entityType: "aleta_integritas_pindai",
      entityId: jenis,
      payload: { jenis },
    });
    void pindaiSemua(db, { jenis }).catch((e) => console.error("[Integritas] pindai manual gagal:", e instanceof Error ? e.message : e));
    return ok({ dimulai: true, jenis });
  } catch (error) {
    return handleRouteError(error);
  }
}
