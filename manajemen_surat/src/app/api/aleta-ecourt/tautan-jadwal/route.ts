import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import {
  buatTautan,
  cabutTautan,
  daftarTautan,
  jejakTautan,
  setSaklarMati,
} from "@/server/modules/tautan-jadwal/service";
import { resolveActorUserId } from "@/server/shared/auth";
import { ApiError } from "@/server/shared/errors";
import { ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ============================================================================
 * PENGATURAN TAUTAN JADWAL SIDANG (20 Okt 2026) - hanya Super Admin dan Admin
 * ============================================================================
 *
 *   GET                       -> daftar tautan, akun yang dapat diwakili, saklar
 *   GET ?bagian=jejak[&id=]   -> 100 jejak tindakan menulis terakhir
 *   POST {aksi:"buat", nama, bertindakSebagai, berlakuSampai?}
 *                             -> membuat; rahasia asli dijawab SEKALI
 *   POST {aksi:"cabut", id}   -> mencabut
 *   POST {aksi:"saklar", mati}-> mematikan / menyalakan SEMUA tautan
 *
 * Rahasia hanya disimpan sebagai hash; jawaban POST buat adalah satu-satunya
 * kesempatan menyalinnya. Rute ini TIDAK ada di daftar izin tautan, jadi
 * tautan tidak dapat dipakai mengelola tautan.
 */
async function bacaBadan(request: NextRequest): Promise<Record<string, unknown>> {
  try {
    const isi = (await request.json()) as unknown;
    return isi && typeof isi === "object" && !Array.isArray(isi) ? (isi as Record<string, unknown>) : {};
  } catch {
    throw new ApiError(400, "Badan permintaan harus JSON.");
  }
}

export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    if (request.nextUrl.searchParams.get("bagian") === "jejak") {
      const id = String(request.nextUrl.searchParams.get("id") || "");
      return ok({ jejak: await jejakTautan(db, actorUserId, id || undefined) });
    }
    return ok(await daftarTautan(db, actorUserId));
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "TAUTAN_JADWAL_READ_FAILED",
      feature: "aleta_ecourt",
      entityId: "tautan-jadwal",
    });
  }
}

export async function POST(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    const badan = await bacaBadan(request);
    const aksi = String(badan.aksi || "");
    if (aksi === "buat") return ok(await buatTautan(db, actorUserId, badan));
    if (aksi === "cabut") return ok(await cabutTautan(db, actorUserId, badan.id));
    if (aksi === "saklar") return ok(await setSaklarMati(db, actorUserId, badan.mati === true));
    throw new ApiError(400, "Aksi tidak dikenal.");
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "TAUTAN_JADWAL_WRITE_FAILED",
      feature: "aleta_ecourt",
      entityId: "tautan-jadwal",
    });
  }
}
