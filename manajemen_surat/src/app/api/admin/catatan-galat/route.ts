import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { pastikanAksi } from "@/server/modules/akses/hak-peran";
import { daftarGalat, rincianGalat, tandaiGalat, teksUntukPengembang } from "@/server/modules/kesehatan/galat";
import { appendAuditLog } from "@/server/shared/audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ApiError } from "@/server/shared/errors";
import { handleRouteError, ok } from "@/server/shared/http";
import { nextPrefixedId } from "@/server/shared/ids";
import { readJsonBody } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Catatan galat (E2) - Admin dan Super Admin.
 *   GET ?sumber=server|peramban|ekstensi&status=baru|ditangani   daftar kelompok
 *   GET ?id=<kelompok>                                           rincian + 50 kejadian terakhir + teks untuk pengembang
 *   POST {id, ditangani, catatan}                                tandai ditangani / buka kembali (aksi "galat.kelola")
 */
export async function GET(request: NextRequest) {
  try {
    const db = await getDatabase();
    await pastikanAksi(db, await resolveActorUserId(request), "kesehatan.lihat");
    const id = request.nextUrl.searchParams.get("id");
    if (id) {
      const r = await rincianGalat(db, id);
      if (!r) throw new ApiError(404, "Kelompok galat tidak ditemukan.");
      return ok({ ...r, teks: teksUntukPengembang(r.kelompok, r.kejadian) });
    }
    return ok({
      galat: await daftarGalat(db, {
        sumber: request.nextUrl.searchParams.get("sumber") ?? undefined,
        status: request.nextUrl.searchParams.get("status") ?? undefined,
      }),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const db = await getDatabase();
    const actor = await pastikanAksi(db, await resolveActorUserId(request), "galat.kelola");
    const b = await readJsonBody<{ id?: string; ditangani?: boolean; catatan?: string }>(request).catch(
      () => ({}) as { id?: string; ditangani?: boolean; catatan?: string }
    );
    const id = String(b.id ?? "");
    if (!id) throw new ApiError(400, "Kelompok galat belum dipilih.");
    const berhasil = await tandaiGalat(db, id, { id: actor.id, nama: actor.name ?? actor.id }, b.ditangani !== false, String(b.catatan ?? ""));
    if (!berhasil) throw new ApiError(404, "Kelompok galat tidak ditemukan.");
    await appendAuditLog(db, {
      id: await nextPrefixedId(db, "audit_logs", "adt"),
      actorUserId: actor.id,
      action: b.ditangani !== false ? "TANDAI_GALAT_DITANGANI" : "BUKA_KEMBALI_GALAT",
      entityType: "aleta_catatan_galat",
      entityId: id,
    });
    return ok({ id, ditangani: b.ditangani !== false });
  } catch (error) {
    return handleRouteError(error);
  }
}
