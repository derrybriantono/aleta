import { type NextRequest } from "next/server";

import { adalahAdmin, adalahSuperAdmin } from "@/lib/matriks-peran";
import { getDatabase } from "@/server/db/client";
import { pastikanAksi } from "@/server/modules/akses/hak-peran";
import { getUserByIdFromDb } from "@/server/modules/organization/service";
import { buatKodeCadangan, hapusAuthenticator } from "@/server/modules/verifikasi/layanan";
import { resolveActorUserId } from "@/server/shared/auth";
import { ApiError } from "@/server/shared/errors";
import { handleRouteError, ok } from "@/server/shared/http";
import { readJsonBody } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Bantuan pengguna yang kehilangan HP (E5) - Admin dan Super Admin (aksi "verifikasi.bantu").
 *   {userId, aksi: "kode-cadangan"} -> 8 kode sekali pakai, ditampilkan SEKALI
 *   {userId, aksi: "reset"}         -> hapus authenticator + cabut semua perangkat tepercaya
 * Admin hanya boleh membantu pengguna biasa; akun Admin/Super Admin hanya oleh
 * Super Admin (kode cadangan untuk akun penguasa tidak boleh dibuat oleh sesama Admin).
 * Tidak dapat dipakai untuk diri sendiri. Tercatat di audit.
 */
export async function POST(request: NextRequest) {
  try {
    const db = await getDatabase();
    const actor = await pastikanAksi(db, await resolveActorUserId(request), "verifikasi.bantu");
    const badan = await readJsonBody<Record<string, unknown>>(request).catch(() => ({}) as Record<string, unknown>);
    const userId = String(badan.userId ?? "").trim();
    const aksi = String(badan.aksi ?? "");
    if (!userId) throw new ApiError(400, "Pilih akun yang dibantu.");
    if (userId === actor.id) throw new ApiError(400, "Bantuan tidak untuk akun sendiri. Gunakan halaman Akun.");
    const target = await getUserByIdFromDb(db, userId);
    if (!target) throw new ApiError(404, "Akun tidak ditemukan.");
    if ((adalahAdmin(target) || adalahSuperAdmin(target)) && !adalahSuperAdmin(actor)) {
      throw new ApiError(403, "Akun Admin atau Super Admin hanya dapat dibantu oleh Super Admin.");
    }
    if (aksi === "kode-cadangan") return ok({ kode: await buatKodeCadangan(db, userId, actor.id), untuk: target.name });
    if (aksi === "reset") {
      await hapusAuthenticator(db, userId, actor.id);
      return ok({ direset: true, untuk: target.name });
    }
    throw new ApiError(400, "Aksi tidak dikenal.");
  } catch (error) {
    return handleRouteError(error);
  }
}
