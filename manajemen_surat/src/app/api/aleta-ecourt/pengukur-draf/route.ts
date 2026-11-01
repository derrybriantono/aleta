import { type NextRequest } from "next/server";

import { namaAdaDi } from "@/lib/perkara-sendiri";
import { getEffectiveRoleId } from "@/lib/permissions";
import { getDatabase } from "@/server/db/client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import { bolehDrafPutusanA1 } from "@/server/modules/aleta-ecourt/draf-putusan-a1";
import {
  bacaPelabuhanMemori,
  bacaUsulan,
  jalankanPengukur,
  susunLaporan,
  teruskanUsulan,
  tolakUsulan,
} from "@/server/modules/aleta-ecourt/pengukur-draf";
import { DEPS_PENGUKUR_BAWAAN } from "@/server/modules/aleta-ecourt/pengukur-draf-bawaan";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ApiError } from "@/server/shared/errors";
import { ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ============================================================================
 * P3 - PENGUKUR DRAF vs PUTUSAN AKHIR (laporan untuk hakim dan Super Admin)
 * ============================================================================
 *
 *   GET                                  laporan kecocokan draf per bulan, koreksi tersering, pola berulang;
 *                                        hakim: hanya perkara majelisnya; Super Admin / ketua / wakil ketua: semua hakim.
 *                                        Usulan memori proyek ALETA Ai hanya dikirim ke Super Admin.
 *   POST { aksi: "ukur" }                Super Admin: jalankan lintasan sekarang (tanpa menunggu jadwal malam).
 *   POST { aksi: "proyek" }              Super Admin: daftar proyek ALETA Ai tujuan memori (bila modul proyek terpasang).
 *   POST { aksi: "teruskan", proyekId, ids[] }   Super Admin: usulan terpilih -> memori proyek (di sana tetap menunggu persetujuan).
 *   POST { aksi: "tolak", id }           Super Admin: usulan tidak diteruskan.
 *
 * Tidak ada yang ditulis ke SIPP/ABT; pengukurannya aturan murni (tanpa AI).
 */

const teks = (x: unknown) => String(x ?? "").trim();

function peranAktor(aktor: { roleId?: unknown; additionalRoleIds?: unknown } & Parameters<typeof getEffectiveRoleId>[0]): string[] {
  const tambahan = Array.isArray(aktor.additionalRoleIds) ? (aktor.additionalRoleIds as unknown[]).map(teks) : [];
  return [teks(getEffectiveRoleId(aktor)), teks(aktor.roleId), ...tambahan].filter(Boolean);
}

async function pastikanHak(db: Awaited<ReturnType<typeof getDatabase>>, actorUserId: string | null) {
  const aktor = await pastikanKapabilitas(db, actorUserId, "panel");
  if (!bolehDrafPutusanA1(aktor)) throw new ApiError(403, "Laporan kecocokan draf hanya untuk hakim, ketua, wakil ketua, dan Super Admin.");
  const peran = peranAktor(aktor);
  return {
    aktor,
    superAdmin: peran.includes("super-admin"),
    lihatSemua: peran.some((p) => ["super-admin", "ketua", "wakil-ketua"].includes(p)),
  };
}

export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    const hak = await pastikanHak(db, actorUserId);
    const nama = teks(hak.aktor?.name);
    const laporan = await susunLaporan(db, {
      lihatSemua: hak.lihatSemua,
      milikSaya: (hakim, majelis) => Boolean(nama) && (namaAdaDi(nama, hakim) || namaAdaDi(nama, majelis)),
    });
    return ok({
      ...laporan,
      superAdmin: hak.superAdmin,
      memoriTersedia: Boolean(bacaPelabuhanMemori()),
      usulan: hak.superAdmin ? await bacaUsulan(db) : [],
    });
  } catch (error) {
    return handleAdminRouteError(error, request, { db, actorUserId, action: "PENGUKUR_DRAF_BACA_FAILED", feature: "aleta_ecourt", entityId: "pengukur-draf" });
  }
}

export async function POST(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    const hak = await pastikanHak(db, actorUserId);
    if (!hak.superAdmin) throw new ApiError(403, "Hanya Super Admin yang boleh menjalankan pengukuran atau memutuskan usulan memori.");
    const badan = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const aksi = teks(badan.aksi);
    const oleh = teks(hak.aktor?.name) || teks(actorUserId);
    if (aksi === "ukur") {
      const hasil = await jalankanPengukur(db, DEPS_PENGUKUR_BAWAAN, "tangan");
      return ok({ hasil, pesan: hasil ? (hasil.galat ? `Belum seluruhnya terbaca: ${hasil.galat}` : `${hasil.diukur} putusan diukur, ${hasil.sama} tidak berubah.`) : "Pengukuran sedang berjalan." });
    }
    if (aksi === "proyek") {
      const p = bacaPelabuhanMemori();
      return ok({ tersedia: Boolean(p), proyek: p ? await p.daftarProyek(db) : [] });
    }
    if (aksi === "teruskan") {
      const ids = Array.isArray(badan.ids) ? (badan.ids as unknown[]).map(teks) : [];
      const hasil = await teruskanUsulan(db, { proyekId: teks(badan.proyekId), ids, oleh });
      return ok({ ...hasil, usulan: await bacaUsulan(db) });
    }
    if (aksi === "tolak") {
      const berhasil = await tolakUsulan(db, teks(badan.id), oleh);
      return ok({ ok: berhasil, usulan: await bacaUsulan(db) });
    }
    throw new ApiError(400, "Tindakan tidak dikenal.");
  } catch (error) {
    return handleAdminRouteError(error, request, { db, actorUserId, action: "PENGUKUR_DRAF_TULIS_FAILED", feature: "aleta_ecourt", entityId: "pengukur-draf" });
  }
}
