import { type NextRequest } from "next/server";

import { dalamJamTenang } from "@/lib/penjaga-server";
import { bolehAksi } from "@/lib/matriks-peran";
import { getDatabase } from "@/server/db/client";
import { pastikanAksi } from "@/server/modules/akses/hak-peran";
import { pastikanAdminIstimewa } from "@/server/modules/aleta-ecourt/akses";
import { bacaLaporanPenjagaHost, bacaPengaturanPenjaga, jalankanPenjaga, riwayatPenjaga, simpanPengaturanPenjaga } from "@/server/modules/penjaga-server/layanan";
import { appendAuditLog } from "@/server/shared/audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ApiError } from "@/server/shared/errors";
import { handleRouteError, ok } from "@/server/shared/http";
import { nextPrefixedId } from "@/server/shared/ids";
import { readJsonBody } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Penjaga server (1 November 2026).
 *
 *   GET   -> pengaturan, kejadian yang berlangsung, riwayat, calon penerima (nama saja, nomor tidak dikirim ke layar).
 *            Super Admin dan Admin (baca saja).
 *   POST  -> {aksi: "simpan", pengaturan: {...}} atau {aksi: "periksa"}. HANYA Super Admin (aksi "kapasitas.atur").
 *
 * Penjaga hanya mengabari; tidak ada aksi di sini yang membersihkan atau mengubah server.
 */
async function isiLayar(db: Awaited<ReturnType<typeof getDatabase>>) {
  const [pengaturan, kejadian, superAdmin, host] = await Promise.all([
    bacaPengaturanPenjaga(db),
    riwayatPenjaga(db),
    db.queryAll<{ id: string; name: string; whatsapp_number: string }>(
      "SELECT id, name, whatsapp_number FROM users WHERE is_active = 1 AND deleted_at IS NULL AND role_id = 'super-admin' ORDER BY name"
    ),
    bacaLaporanPenjagaHost(),
  ]);
  const kini = new Date();
  return {
    pengaturan,
    sedangJamTenang: dalamJamTenang(kini, pengaturan),
    berlangsung: kejadian.berlangsung,
    riwayat: kejadian.riwayat,
    calonPenerima: superAdmin.map((u) => ({ id: u.id, nama: u.name, adaNomor: String(u.whatsapp_number || "").replace(/\D/g, "").length >= 8 })),
    pemantauServer: host ? { dibuat: host.dibuat, intervalMenit: host.intervalMenit } : null,
  };
}

export async function GET(request: NextRequest) {
  try {
    const db = await getDatabase();
    const actor = await pastikanAdminIstimewa(db, await resolveActorUserId(request), "melihat penjaga server");
    return ok({ ...(await isiLayar(db)), bolehAtur: bolehAksi(actor, "kapasitas.atur") });
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
      const hasil = await jalankanPenjaga(db);
      return ok({ ...(await isiLayar(db)), bolehAtur: true, periksa: hasil ? { temuan: hasil.temuan, dikirim: hasil.dikirim, tanpaPenerima: hasil.tanpaPenerima } : null });
    }
    if (aksi !== "simpan") throw new ApiError(400, "Aksi tidak dikenal.");

    const hasil = await simpanPengaturanPenjaga(db, badan.pengaturan);
    await appendAuditLog(db, {
      id: await nextPrefixedId(db, "audit_logs", "adt"),
      actorUserId: actor.id,
      action: "UPDATE_PENJAGA_SERVER_PENGATURAN",
      entityType: "aleta_ekstensi_setelan",
      entityId: "*sistem*:penjaga-server:pengaturan",
      // Hanya jumlah penerima, bukan identitas/nomor.
      payload: { sebelum: { ...hasil.sebelum, penerimaIds: hasil.sebelum.penerimaIds.length }, sesudah: { ...hasil.sesudah, penerimaIds: hasil.sesudah.penerimaIds.length } },
    });
    return ok({ ...(await isiLayar(db)), bolehAtur: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
