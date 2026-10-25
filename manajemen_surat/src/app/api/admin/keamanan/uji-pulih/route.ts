import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { pastikanAksi } from "@/server/modules/akses/hak-peran";
import {
  bacaPengaturanUjiPulih,
  mulaiUjiPulihLatar,
  pilihCadanganAleta,
  riwayatUjiPulih,
  sedangBerjalan,
  simpanPengaturanUjiPulih,
  type PengaturanUjiPulih,
} from "@/server/modules/keamanan/uji-pulih";
import { appendAuditLog } from "@/server/shared/audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ApiError } from "@/server/shared/errors";
import { handleRouteError, ok } from "@/server/shared/http";
import { nextPrefixedId } from "@/server/shared/ids";
import { readJsonBody } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function muatan(db: Awaited<ReturnType<typeof getDatabase>>) {
  const cadangan = await pilihCadanganAleta().catch(() => null);
  return {
    setelan: await bacaPengaturanUjiPulih(db),
    riwayat: await riwayatUjiPulih(db, 10),
    berjalan: await sedangBerjalan(db),
    // Hanya yang perlu dilayar: tanpa jalur berkas di server.
    cadanganTerbaru: cadangan
      ? { bundel: cadangan.bundel, selesai: cadangan.selesai, nama: cadangan.nama, byte: cadangan.byte, tersandi: cadangan.tersandi, umurJam: Math.round(cadangan.umurJam) }
      : null,
  };
}

type Badan = { aksi?: string } & Partial<PengaturanUjiPulih>;

/**
 * Uji pulih cadangan (Bagian 6d). Baca = Admin + Super Admin; ubah setelan dan
 * "Jalankan uji sekarang" = Super Admin. Pemulihan HANYA ke basis data sementara
 * (server/modules/keamanan/uji-pulih.ts) - rute ini tidak menerima nama basis data.
 */
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
    const body = await readJsonBody<Badan>(request).catch(() => ({}) as Badan);

    if (body.aksi === "jalankan") {
      try {
        await mulaiUjiPulihLatar(db, { pemicu: "manual", olehId: actor.id, olehNama: actor.name });
      } catch (galat) {
        throw new ApiError(409, galat instanceof Error ? galat.message : "Uji pulih belum dapat dimulai.");
      }
      await appendAuditLog(db, {
        id: await nextPrefixedId(db, "audit_logs", "adt"),
        actorUserId: actor.id,
        action: "SECURITY_RESTORE_TEST_START",
        entityType: "security_setting",
        entityId: "uji-pulih",
        payload: { pemicu: "manual" },
      });
      return ok({ ...(await muatan(db)), dimulai: true }, { status: 202 });
    }

    if (body.aksi !== "setelan") throw new ApiError(400, "Aksi uji pulih tidak dikenal.");
    let baru;
    try {
      baru = await simpanPengaturanUjiPulih(db, { aktif: body.aktif, hari: body.hari, jam: body.jam, toleransiPersen: body.toleransiPersen }, actor.id);
    } catch (galat) {
      throw new ApiError(400, galat instanceof Error ? galat.message : "Setelan uji pulih tidak tersimpan.");
    }
    await appendAuditLog(db, {
      id: await nextPrefixedId(db, "audit_logs", "adt"),
      actorUserId: actor.id,
      action: "SECURITY_RESTORE_TEST_SETTINGS_UPDATE",
      entityType: "security_setting",
      entityId: "uji-pulih",
      payload: baru,
    });
    return ok({ ...(await muatan(db)), setelan: baru });
  } catch (error) {
    return handleRouteError(error);
  }
}
