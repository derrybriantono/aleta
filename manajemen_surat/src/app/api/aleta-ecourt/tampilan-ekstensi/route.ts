import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { pastikanAdminIstimewa } from "@/server/modules/aleta-ecourt/akses";
import {
  bacaHalamanTampilan,
  cariPegawaiTampilan,
  hapusPenerapan,
  terapkanTampilan,
} from "@/server/modules/aleta-ecourt/tampilan-ekstensi";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ApiError } from "@/server/shared/errors";
import { ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Menerapkan tampilan ekstensi (Lama / Baru / UI Baru + saklar fitur) kepada
 * semua pegawai, satu peran, atau satu orang.
 *
 * Kewenangannya meniru halaman Akses ekstensi: Super Admin dan Admin MEMBACA,
 * hanya Super Admin yang MENERAPKAN dan MENGHAPUS.
 *
 *   GET                 -> halaman lengkap (penerapan, peran, daftar fitur,
 *                          ringkasan siapa mendapat apa)
 *   GET ?cari=<kata>    -> { cari, hasil } pencarian pegawai (min. 2 huruf)
 *   PUT {lingkup, sasaran?, mode, fitur?, catatan?}
 *                       -> halaman lengkap + fiturDibuang
 *   DELETE ?lingkup=&sasaran=  (atau badan JSON yang sama)
 *                       -> halaman lengkap
 */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    const actor = await pastikanAdminIstimewa(db, actorUserId, "melihat tampilan ekstensi yang diterapkan");

    const cari = String(request.nextUrl.searchParams.get("cari") || "").trim();
    if (cari) {
      return ok({ available: true, cari, hasil: await cariPegawaiTampilan(db, cari) });
    }
    return ok(await bacaHalamanTampilan(db, actor));
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "ECOURT_EXTENSION_DISPLAY_READ_FAILED",
      feature: "aleta_ecourt",
    });
  }
}

async function bacaBadan(request: NextRequest): Promise<Record<string, unknown>> {
  try {
    const isi = (await request.json()) as unknown;
    return isi && typeof isi === "object" && !Array.isArray(isi) ? (isi as Record<string, unknown>) : {};
  } catch {
    throw new ApiError(400, "Badan permintaan harus JSON.");
  }
}

export async function PUT(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    const badan = await bacaBadan(request);
    return ok(
      await terapkanTampilan(db, actorUserId, {
        lingkup: badan.lingkup,
        sasaran: badan.sasaran,
        mode: badan.mode,
        fitur: badan.fitur,
        catatan: badan.catatan,
      })
    );
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "ECOURT_EXTENSION_DISPLAY_UPDATE_FAILED",
      feature: "aleta_ecourt",
    });
  }
}

export async function DELETE(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    const q = request.nextUrl.searchParams;
    let lingkup: unknown = q.get("lingkup");
    let sasaran: unknown = q.get("sasaran");
    if (!lingkup) {
      const badan = await bacaBadan(request);
      lingkup = badan.lingkup;
      sasaran = badan.sasaran;
    }
    return ok(await hapusPenerapan(db, actorUserId, { lingkup, sasaran }));
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "ECOURT_EXTENSION_DISPLAY_DELETE_FAILED",
      feature: "aleta_ecourt",
    });
  }
}
