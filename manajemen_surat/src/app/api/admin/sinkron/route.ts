import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { auditSinkron, pastikanAdminSinkron } from "@/server/modules/sinkron/akses";
import { daftarBundel } from "@/server/modules/sinkron/cadangan-db";
import { bacaIndeks } from "@/server/modules/sinkron/drive-berkas";
import { bacaPengaturan, terapkanIsian, tulisPengaturan, untukLayar } from "@/server/modules/sinkron/pengaturan";
import { tugasBerjalan } from "@/server/modules/sinkron/penjadwal";
import { direktoriSinkron } from "@/server/modules/sinkron/penyimpanan";
import { bacaKeadaan, bacaRiwayat } from "@/server/modules/sinkron/riwayat";
import { resolveActorUserId } from "@/server/shared/auth";
import { ApiError } from "@/server/shared/errors";
import { handleRouteError, ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Pengaturan "Sinkron & cadangan" (butir 29 dan 30).
 *   GET  Admin & Super Admin - pengaturan (rahasia hanya ada/tidak), keadaan,
 *        riwayat, bundel cadangan di server, ringkasan sinkron berkas.
 *   PUT  Super Admin - menyimpan isian.
 */

async function gambaran(bolehUbah: boolean) {
  const [p, keadaan, riwayat, bundel, indeks] = await Promise.all([
    bacaPengaturan(),
    bacaKeadaan(),
    bacaRiwayat(),
    daftarBundel(),
    bacaIndeks(),
  ]);
  const perkara = Object.values(indeks.perkara);
  return {
    pengaturan: untukLayar(p),
    bolehUbah,
    keadaan: { ...keadaan, berjalanDiProses: tugasBerjalan() },
    riwayat: riwayat.slice(0, 60),
    bundel: bundel.slice(0, 20),
    berkasPerkara: {
      diperiksa: perkara.length,
      berkas: perkara.reduce((s, x) => s + (x.berkas || 0), 0),
      byte: perkara.reduce((s, x) => s + (x.byte || 0), 0),
      galat: Object.entries(indeks.perkara)
        .filter(([, x]) => x.galat)
        .slice(0, 20)
        .map(([nomor, x]) => ({ nomor, galat: x.galat, diperiksa: x.diperiksa })),
      daftarDiperbarui: indeks.daftarDiperbarui,
    },
    lingkungan: {
      direktori: direktoriSinkron(),
      penjadwal: process.env.ALETA_SINKRON_PENJADWAL === "0" ? "cron host" : "portal",
    },
  };
}

export async function GET(request: NextRequest) {
  try {
    const db = await getDatabase();
    const actorUserId = await resolveActorUserId(request);
    const { superAdmin } = await pastikanAdminSinkron(db, actorUserId, false);
    return ok(await gambaran(superAdmin));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const db = await getDatabase();
    const actorUserId = await resolveActorUserId(request);
    const { actor } = await pastikanAdminSinkron(db, actorUserId, true);
    const isian = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!isian || typeof isian !== "object") throw new ApiError(400, "Isian pengaturan tidak terbaca.");
    let hasil;
    try {
      hasil = terapkanIsian(await bacaPengaturan(), isian, actor.name || actor.id);
    } catch (galat) {
      throw new ApiError(400, (galat as Error).message);
    }
    await tulisPengaturan(hasil.pengaturan);
    // Yang dicatat hanya BAGIAN yang diubah - tidak satu pun nilai rahasia.
    await auditSinkron(db, "SINKRON_PENGATURAN_DIUBAH", actor.id, {
      bagian: Object.keys(isian).filter((k) => !/sandi|secret|json/i.test(k)),
      sandiDiganti: typeof isian.sandiBaru === "string" && isian.sandiBaru.length > 0,
      sandiDihapus: isian.hapusSandi === true,
      rahasiaDriveDiganti: Boolean(isian.clientSecretBaru || isian.akunLayananJsonBaru),
    });
    return ok({ ...(await gambaran(true)), catatan: hasil.catatan });
  } catch (error) {
    return handleRouteError(error);
  }
}
