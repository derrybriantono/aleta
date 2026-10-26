import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { pastikanAksi } from "@/server/modules/akses/hak-peran";
import { langkahKeduaTerdaftar } from "@/server/modules/keamanan/kait";
import { KATALOG_PENGAMAN, bacaPengaman, kodeAksiBerdampak, simpanPengaman, tegakkanPengaman, type UbahPengaman } from "@/server/modules/keamanan/pengaman-aksi";
import { appendAuditLog } from "@/server/shared/audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ApiError } from "@/server/shared/errors";
import { handleRouteError, ok } from "@/server/shared/http";
import { nextPrefixedId } from "@/server/shared/ids";
import { readJsonBody } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function muatan(db: Awaited<ReturnType<typeof getDatabase>>) {
  return {
    pengaman: await bacaPengaman(db),
    katalog: kodeAksiBerdampak().map((kode) => ({ kode, ...KATALOG_PENGAMAN[kode] })),
    langkahKeduaTersedia: Boolean(langkahKeduaTerdaftar()),
  };
}

/** Pengaman aksi admin (Bagian 6c). Baca = Admin + Super Admin; ubah = Super Admin, dan sendirinya dijaga pengaman bila sudah menyala. */
export async function GET(request: NextRequest) {
  try {
    const db = await getDatabase();
    await pastikanAksi(db, await resolveActorUserId(request), "keamanan.lihat");
    return ok(await muatan(db));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const db = await getDatabase();
    const actor = await pastikanAksi(db, await resolveActorUserId(request), "keamanan.atur");
    const body = await readJsonBody<UbahPengaman>(request).catch(() => ({}) as UbahPengaman);
    const ubah: UbahPengaman = { aktif: body.aktif, aksi: body.aksi, batasHapus: body.batasHapus, langkahKedua: body.langkahKedua };
    // Pengaman yang sedang menyala menjaga dirinya sendiri: mematikannya meminta konfirmasi.
    await tegakkanPengaman(db, request, actor, "pengaman.ubah", { rincian: { aktif: body.aktif ?? null } });
    let baru;
    try {
      baru = await simpanPengaman(db, ubah, actor.id);
    } catch (galat) {
      throw new ApiError(400, galat instanceof Error ? galat.message : "Pengaman aksi tidak tersimpan.");
    }
    await appendAuditLog(db, {
      id: await nextPrefixedId(db, "audit_logs", "adt"),
      actorUserId: actor.id,
      action: "SECURITY_ACTION_GUARD_UPDATE",
      entityType: "security_setting",
      entityId: "pengaman-aksi",
      payload: baru,
    });
    return ok({ ...(await muatan(db)), pengaman: baru });
  } catch (error) {
    return handleRouteError(error);
  }
}
