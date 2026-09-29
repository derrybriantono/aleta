import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import {
  bacaKomentar,
  bolehMenulisKomentar,
  bolehMenyelesaikan,
  tandaiKomentar,
  tulisKomentar,
} from "@/server/modules/aleta-ecourt/bas-komentar";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ApiError } from "@/server/shared/errors";
import { ok } from "@/server/shared/http";
import { getSearchParam } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Komentar hakim atas BAS (kontrak Tahap 6-7 bagian 1).
 *
 *   GET   ?nomor=<nomor perkara>    (atau ?perkaraId=)
 *         -> { komentar: [...], saya: {id, nama, bolehMenulis, bolehMenyelesaikanSemua} }
 *   POST  {nomor, perkaraId?, sidangKe?, bagian, kutipan, isi} -> { komentar }
 *   PATCH {id, selesai: true|false}                           -> { komentar }
 *
 * ============================================================================
 * TIDAK ADA ACC - KOMENTAR TIDAK MENAHAN APA PUN
 * ============================================================================
 *
 * Keputusan pengguna 29 September 2026. Rute ini tidak dibaca oleh satu pun
 * jalur simpan, naskah, atau cetak BAS. "saya" hanya untuk memutuskan tombol
 * apa yang digambar; penjagaannya tetap di modul (bas-komentar.ts).
 *
 * Membaca menuntut kemampuan "panel" - siapa pun yang boleh melihat perkara,
 * sama dengan lembar BAS dan berkas perkara. Menulis: hakim/Ketua/Wakil,
 * Admin, Super Admin. Menandai selesai: panitera pengganti, Admin, Super
 * Admin, penulisnya.
 */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    const aktor = await pastikanKapabilitas(db, actorUserId, "panel");

    const nomor = String(getSearchParam(request, "nomor") ?? "");
    const perkaraId = String(getSearchParam(request, "perkaraId") ?? "");
    const komentar = await bacaKomentar(db, { nomor, perkaraId });

    return ok({
      komentar,
      saya: {
        id: String(aktor.id),
        nama: String(aktor.name ?? ""),
        bolehMenulis: bolehMenulisKomentar(aktor),
        // Penulis selalu boleh menandai komentarnya sendiri; ini untuk yang
        // boleh menandai komentar SIAPA PUN.
        bolehMenyelesaikanSemua: bolehMenyelesaikan(aktor, ""),
      },
    });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "BAS_KOMENTAR_BACA_FAILED",
      feature: "aleta_ecourt",
      entityId: "bas-komentar",
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

export async function POST(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanKapabilitas(db, actorUserId, "panel");
    const badan = await bacaBadan(request);
    return ok({
      komentar: await tulisKomentar(db, actorUserId, {
        nomor: badan.nomor,
        perkaraId: badan.perkaraId,
        sidangKe: badan.sidangKe,
        bagian: badan.bagian,
        kutipan: badan.kutipan,
        isi: badan.isi,
      }),
    });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "BAS_KOMENTAR_TULIS_FAILED",
      feature: "aleta_ecourt",
      entityId: "bas-komentar",
    });
  }
}

export async function PATCH(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanKapabilitas(db, actorUserId, "panel");
    const badan = await bacaBadan(request);
    return ok({ komentar: await tandaiKomentar(db, actorUserId, { id: badan.id, selesai: badan.selesai }) });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "BAS_KOMENTAR_TANDAI_FAILED",
      feature: "aleta_ecourt",
      entityId: "bas-komentar",
    });
  }
}
