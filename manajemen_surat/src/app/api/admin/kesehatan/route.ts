import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { pastikanAksi } from "@/server/modules/akses/hak-peran";
import {
  bacaPengaturanKesehatan,
  jalankanPemeriksaan,
  riwayatKesehatan,
  simpanPengaturanKesehatan,
} from "@/server/modules/kesehatan/layanan";
import { bolehAksi } from "@/lib/matriks-peran";
import { appendAuditLog } from "@/server/shared/audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { handleRouteError, ok } from "@/server/shared/http";
import { nextPrefixedId } from "@/server/shared/ids";
import { readJsonBody } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Hasil terakhir disinggahkan 15 detik: puluhan tab admin yang menyegarkan tidak menjadi puluhan pemeriksaan. */
const singgah: { pada: number; ping: boolean; hasil: Awaited<ReturnType<typeof jalankanPemeriksaan>> | null } = {
  pada: 0,
  ping: false,
  hasil: null,
};

/**
 * Pusat kesehatan sistem (E2) - Admin dan Super Admin (aksi "kesehatan.lihat").
 *
 *   GET             -> pemeriksaan sekarang (uji sambung SELECT 1 ke SIPP/ABT/antrian ikut bila ?ping=1)
 *   GET ?segarkan=1 -> abaikan singgahan
 *   GET ?riwayat=1  -> riwayat pemeriksaan berkala (24 jam), kosong bila saklar berkala mati
 *   POST            -> pengaturan pemeriksaan berkala + WhatsApp (Super Admin, aksi "kesehatan.atur")
 */
export async function GET(request: NextRequest) {
  try {
    const db = await getDatabase();
    const actor = await pastikanAksi(db, await resolveActorUserId(request), "kesehatan.lihat");
    const ping = request.nextUrl.searchParams.get("ping") === "1";
    const segarkan = request.nextUrl.searchParams.get("segarkan") === "1";
    if (request.nextUrl.searchParams.get("riwayat") === "1") {
      return ok({ riwayat: await riwayatKesehatan(db, 24) });
    }
    const segar = !segarkan && singgah.hasil && Date.now() - singgah.pada < 15_000 && (singgah.ping || !ping);
    if (!segar) {
      singgah.hasil = await jalankanPemeriksaan(db, { ping });
      singgah.pada = Date.now();
      singgah.ping = ping;
    }
    return ok({
      hasil: singgah.hasil,
      pengaturan: await bacaPengaturanKesehatan(db),
      bolehAtur: bolehAksi(actor, "kesehatan.atur"),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const db = await getDatabase();
    const actor = await pastikanAksi(db, await resolveActorUserId(request), "kesehatan.atur");
    const badan = await readJsonBody<Record<string, unknown>>(request).catch(() => ({}) as Record<string, unknown>);
    const baru = await simpanPengaturanKesehatan(db, badan);
    await appendAuditLog(db, {
      id: await nextPrefixedId(db, "audit_logs", "adt"),
      actorUserId: actor.id,
      action: "UPDATE_PENGATURAN_KESEHATAN",
      entityType: "aleta_ekstensi_setelan",
      entityId: "*sistem*:kesehatan:pengaturan",
      payload: baru,
    });
    singgah.hasil = null;
    return ok({ pengaturan: baru });
  } catch (error) {
    return handleRouteError(error);
  }
}
