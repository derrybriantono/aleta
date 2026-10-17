import { type NextRequest } from "next/server";

import { getEffectiveRoleId } from "@/lib/permissions";
import { getDatabase } from "@/server/db/client";
import { requireActorUser } from "@/server/modules/organization/service";
import { daftarAksesTerbaru, penandaGlobalTerpasang } from "@/server/modules/satker/akses-global";
import { bacaLayarFitur, dorongFiturKeBot, simpanPengaturanFitur } from "@/server/modules/satker/fitur";
import { bacaSatkerAktif } from "@/server/modules/satker/identitas";
import { bacaKanal, bacaPusatTerakhir, cekPembaruanPusat, simpanKanal } from "@/server/modules/satker/kanal";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ApiError } from "@/server/shared/errors";
import { ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Fitur satker (banyak satker, Tahap 0) - HANYA Super Admin.
 *
 *   GET                                    saklar fitur + saluran + kanal Pusat + akses super admin global terbaru
 *   POST {tindakan: "simpan-fitur", fitur: {kode: "stabil"|"uji-coba"|"mati"}}
 *   POST {tindakan: "simpan-kanal", saluran?, alamatPusat?}
 *   POST {tindakan: "cek-pusat"}           cek pembaruan ke ALETA Pusat (alamat kosong = belum diatur)
 *   POST {tindakan: "sinkron-bot"}         dorong status fitur ke bot
 *
 * Admin biasa tidak dapat membuka atau mengubah layar ini.
 */
async function aktorSuperAdmin(request: NextRequest) {
  const db = await getDatabase();
  const actorUserId = await resolveActorUserId(request);
  const actor = await requireActorUser(db, actorUserId);
  if (String(getEffectiveRoleId(actor) ?? actor.roleId ?? "") !== "super-admin") {
    throw new ApiError(403, "Hanya Super Admin yang dapat membuka atau mengubah Fitur satker.");
  }
  return { db, actorUserId, aktor: { id: actor.id, name: actor.name } };
}

async function layarLengkap(db: Awaited<ReturnType<typeof getDatabase>>) {
  const [fitur, kanal, satker, terakhir, akses] = await Promise.all([
    bacaLayarFitur(db),
    bacaKanal(db),
    bacaSatkerAktif(db),
    bacaPusatTerakhir(db),
    daftarAksesTerbaru(db, { batas: 20 }).catch(() => []),
  ]);
  return {
    ...fitur,
    satker: { kode: satker.kodeSatker, nama: satker.namaPengadilan, sumber: satker.sumber },
    kanal: { saluran: kanal.saluran, alamatPusat: kanal.alamatPusat, diubahOleh: kanal.diubahOleh, diubahPada: kanal.diubahPada },
    pusatTerakhir: terakhir,
    aksesGlobal: { penandaTerpasang: penandaGlobalTerpasang().length > 0, terbaru: akses },
  };
}

export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    const a = await aktorSuperAdmin(request);
    db = a.db;
    actorUserId = a.actorUserId;
    return ok(await layarLengkap(db));
  } catch (error) {
    return handleAdminRouteError(error, request, { db, actorUserId, action: "FITUR_SATKER_READ_FAILED", feature: "fitur_satker", entityId: "fitur-satker" });
  }
}

export async function POST(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    const a = await aktorSuperAdmin(request);
    db = a.db;
    actorUserId = a.actorUserId;
    let badan: Record<string, unknown> = {};
    try {
      const isi = (await request.json()) as unknown;
      if (isi && typeof isi === "object" && !Array.isArray(isi)) badan = isi as Record<string, unknown>;
    } catch {
      throw new ApiError(400, "Badan permintaan harus JSON.");
    }
    switch (String(badan.tindakan ?? "")) {
      case "simpan-fitur": {
        const hasil = await simpanPengaturanFitur(db, a.aktor, badan);
        return ok({ ...hasil, ...(await layarLengkap(db)) });
      }
      case "simpan-kanal": {
        await simpanKanal(db, a.aktor, badan);
        await dorongFiturKeBot(db);
        return ok(await layarLengkap(db));
      }
      case "cek-pusat": {
        const hasil = await cekPembaruanPusat(db, a.aktor);
        return ok({ hasil, ...(await layarLengkap(db)) });
      }
      case "sinkron-bot":
        return ok({ bot: await dorongFiturKeBot(db) });
      default:
        throw new ApiError(400, "Tindakan tidak dikenal.");
    }
  } catch (error) {
    return handleAdminRouteError(error, request, { db, actorUserId, action: "FITUR_SATKER_WRITE_FAILED", feature: "fitur_satker", entityId: "fitur-satker" });
  }
}
