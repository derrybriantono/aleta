import { type NextRequest } from "next/server";

import { FITUR_LIHAT_SEBAGAI } from "@/lib/fitur-satker";
import { getDatabase } from "@/server/db/client";
import { pastikanAksi } from "@/server/modules/akses/hak-peran";
import { akhiriLihatSebagai, lihatSesiBerjalan, mulaiLihatSebagai, pilihanLihatSebagai } from "@/server/modules/lihat-sebagai/layanan";
import { pastikanFiturMenyala } from "@/server/modules/satker/fitur";
import { resolveActorUserId } from "@/server/shared/auth";
import { handleRouteError, ok } from "@/server/shared/http";
import { readJsonBody } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Lihat sebagai akun/peran (E4) - hanya Super Admin (aksi "lihat-sebagai.pakai").
 *   GET     -> pilihan akun/peran + sesi yang sedang berjalan (bila ada) beserta penjelasan menu
 *   POST    -> mulai {userId | roleId, alasan}; alasan wajib, sesi 30 menit, tercatat di audit
 *   DELETE  -> akhiri sesi
 * Pratinjau baca-saja: tidak membuka sesi akun lain dan tidak menyentuh data perkara.
 * Saklar Fitur Satker "lihat-sebagai-pratinjau" MATI bawaan (26 Okt 2026): mati = semua metode menolak (403).
 * Catatan audit lama dan catatan dilihat di halaman Akun (/api/portal/lihat-sebagai/catatan) tetap terbaca.
 */
export async function GET(request: NextRequest) {
  try {
    const db = await getDatabase();
    const actor = await pastikanAksi(db, await resolveActorUserId(request), "lihat-sebagai.pakai");
    await pastikanFiturMenyala(db, FITUR_LIHAT_SEBAGAI);
    const [pilihan, berjalan] = await Promise.all([pilihanLihatSebagai(db, actor.id), lihatSesiBerjalan(db, actor.id)]);
    return ok({ ...pilihan, berjalan });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const db = await getDatabase();
    const actor = await pastikanAksi(db, await resolveActorUserId(request), "lihat-sebagai.pakai");
    await pastikanFiturMenyala(db, FITUR_LIHAT_SEBAGAI);
    const badan = await readJsonBody<Record<string, unknown>>(request).catch(() => ({}) as Record<string, unknown>);
    const hasil = await mulaiLihatSebagai(db, { id: actor.id, nama: actor.name ?? actor.id }, badan);
    return ok({ berjalan: hasil });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const db = await getDatabase();
    const actor = await pastikanAksi(db, await resolveActorUserId(request), "lihat-sebagai.pakai");
    await pastikanFiturMenyala(db, FITUR_LIHAT_SEBAGAI);
    const diakhiri = await akhiriLihatSebagai(db, { id: actor.id });
    return ok({ diakhiri });
  } catch (error) {
    return handleRouteError(error);
  }
}
