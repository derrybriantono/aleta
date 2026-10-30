import { type NextRequest } from "next/server";

import { bolehAksi } from "@/lib/matriks-peran";
import { getDatabase } from "@/server/db/client";
import { pastikanAksi } from "@/server/modules/akses/hak-peran";
import { pastikanAdminIstimewa } from "@/server/modules/aleta-ecourt/akses";
import { bacaKapasitas, catatPembersihanBaru, mintaPeriksaSekarang, simpanSetelanKapasitas } from "@/server/modules/kapasitas/layanan";
import type { PartisiBot } from "@/server/modules/kapasitas/hitung";
import { mintaSumberDayaBot } from "@/server/modules/sumber-daya/gateway";
import { bacaSumberDaya } from "@/server/modules/sumber-daya/layanan";
import { appendAuditLog } from "@/server/shared/audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ApiError } from "@/server/shared/errors";
import { handleRouteError, ok } from "@/server/shared/http";
import { nextPrefixedId } from "@/server/shared/ids";
import { readJsonBody } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Kapasitas penyimpanan server (30 Oktober 2026).
 *
 *   GET   -> pemakaian ruang, setelan, riwayat pembersihan. Super Admin dan Admin (baca saja).
 *   POST  -> {aksi: "simpan", setelan: {...}} atau {aksi: "periksa"}. HANYA Super Admin
 *            (aksi "kapasitas.atur"); perubahan setelan tercatat di audit.
 *
 * Portal tidak menyentuh Docker: angkanya dari laporan yang ditulis cron di
 * server induk ke volume reports; "Periksa sekarang" hanya menaruh berkas
 * pemicu yang dibaca cron itu.
 */
async function partisiDariBot(db: Awaited<ReturnType<typeof getDatabase>>): Promise<PartisiBot[] | null> {
  const h = await bacaSumberDaya(db, () => mintaSumberDayaBot(4000));
  if (!h.ok) return null;
  return h.data.rincian.partisi.map((p) => ({ titik: p.titik, totalByte: p.totalByte, terpakaiByte: p.terpakaiByte, sisaByte: p.sisaByte }));
}

export async function GET(request: NextRequest) {
  try {
    const db = await getDatabase();
    const actor = await pastikanAdminIstimewa(db, await resolveActorUserId(request), "melihat kapasitas penyimpanan server");
    const data = await bacaKapasitas(db, { partisiBot: () => partisiDariBot(db) });
    try {
      await catatPembersihanBaru(db, data.riwayat);
    } catch {
      // Pencatatan audit tidak boleh menggagalkan layar.
    }
    return ok({ ...data, bolehAtur: bolehAksi(actor, "kapasitas.atur") });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const db = await getDatabase();
    const actor = await pastikanAksi(db, await resolveActorUserId(request), "kapasitas.atur");
    const badan = await readJsonBody<Record<string, unknown>>(request).catch(() => ({}) as Record<string, unknown>);
    const aksi = String(badan.aksi ?? "simpan");

    if (aksi === "periksa") {
      return ok({ ...(await mintaPeriksaSekarang()) });
    }
    if (aksi !== "simpan") throw new ApiError(400, "Aksi tidak dikenal.");

    const hasil = await simpanSetelanKapasitas(db, badan.setelan);
    await appendAuditLog(db, {
      id: await nextPrefixedId(db, "audit_logs", "adt"),
      actorUserId: actor.id,
      action: "UPDATE_KAPASITAS_SETELAN",
      entityType: "aleta_ekstensi_setelan",
      entityId: "*sistem*:kapasitas:setelan",
      payload: { sebelum: hasil.sebelum, sesudah: hasil.sesudah },
    });
    const data = await bacaKapasitas(db, { partisiBot: () => partisiDariBot(db) });
    return ok({ ...data, bolehAtur: true, cerminanTertulis: hasil.cerminanTertulis });
  } catch (error) {
    return handleRouteError(error);
  }
}
