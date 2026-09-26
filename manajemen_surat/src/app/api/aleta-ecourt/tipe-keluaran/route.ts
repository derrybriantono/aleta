import { NextResponse, type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { pastikanAdminIstimewa } from "@/server/modules/aleta-ecourt/akses";
import { bacaAdmin, jalankanTindakan } from "@/server/modules/aleta-ecourt/tipe-keluaran";
import { jalankanUkurAtauPratinjau } from "@/server/modules/aleta-ecourt/tipe-keluaran-ukur";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ApiError } from "@/server/shared/errors";
import { getSearchParam, readJsonBody } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Pengaturan tipe keluaran (K4) - layar "Tipe keluaran ekstensi" di halaman
 * admin ALETA E-Court.
 *
 * ============================================================================
 * RUTE INI TIDAK MENYENTUH TABEL
 * ============================================================================
 *
 * Seluruh baca-tulis lewat modul tipe-keluaran.ts (K1): bacaAdmin untuk GET,
 * jalankanTindakan untuk POST. Kewenangan tindakan (sahkan hanya Super Admin
 * atas perintah yang disebut, tolak/matikan/nyalakan dengan alasan) DIPERIKSA
 * DI MODUL, bukan di sini - supaya pintu lain (uji, skrip) tidak dapat
 * melewatinya. Rute hanya menambah satu penjagaan: yang membaca isi layar
 * pengaturan adalah Admin atau Super Admin.
 *
 * ============================================================================
 * TIDAK ADA DELETE
 * ============================================================================
 *
 * Sengaja tidak diekspor, sehingga Next menjawab 405. Kalimat yang pernah
 * dipakai di BAS atau putusan harus tetap dapat ditelusuri: yang ada tolak,
 * matikan, dan ganti.
 */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanAdminIstimewa(db, actorUserId, "membuka pengaturan tipe keluaran");
    const golongan = String(getSearchParam(request, "golongan") ?? "").trim();
    return NextResponse.json(await bacaAdmin(db, golongan));
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "TIPE_KELUARAN_READ_FAILED",
      feature: "aleta_ecourt",
    });
  }
}

export async function POST(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    let badan: Record<string, unknown> | null;
    try {
      badan = await readJsonBody<Record<string, unknown>>(request);
    } catch {
      throw new ApiError(400, "Badan permintaan bukan JSON yang sah.");
    }
    if (!badan || typeof badan !== "object" || Array.isArray(badan)) {
      throw new ApiError(400, "Badan permintaan harus objek JSON.");
    }
    // Dua tindakan Tahap 3 bertanya kepada bot; jawabannya bukan butir
    // tunggal, jadi dijawab dari modulnya sendiri. 'ukur' menyimpan hasil_ukur
    // lewat modul tipe-keluaran.ts (K1); 'pratinjau' tidak mengubah apa pun.
    if (badan.tindakan === "ukur" || badan.tindakan === "pratinjau") {
      return NextResponse.json(await jalankanUkurAtauPratinjau(db, actorUserId, badan));
    }
    const hasil = await jalankanTindakan(db, actorUserId, badan);
    // Penolakan isi (kalimat tidak sah, kembar, batas daftar) bukan galat
    // peladen: dijawab 400 dengan seluruh alasannya, supaya layar dapat
    // menampilkannya satu per satu.
    return NextResponse.json(hasil, { status: hasil.ok ? 200 : 400 });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "TIPE_KELUARAN_ACTION_FAILED",
      feature: "aleta_ecourt",
    });
  }
}
