import { type NextRequest } from "next/server";

import { TANDA_DRAF } from "@/lib/templat-hukum";
import { getDatabase } from "@/server/db/client";
import { bolehMenyuntingAkses } from "@/server/modules/aleta-ecourt/akses";
import { bacaTemplat, hapusTemplat, tambahTemplat, ubahTemplat } from "@/server/modules/aleta-ecourt/templat-hukum";
import { requireActorUser } from "@/server/modules/organization/service";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ApiError } from "@/server/shared/errors";
import { ok } from "@/server/shared/http";
import { getSearchParam } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Templat pertimbangan & dasar hukum (kontrak Tahap 6-7 bagian 2).
 *
 *   GET    ?jenis=pertimbangan|pasal   -> { butir: [...], bolehMenyunting, tandaDraf }
 *   POST   {jenis, kunci, judul, isi}  -> { diubah, butir }      (Super Admin)
 *   PUT    {id, sahkan: true|false}    -> { diubah, butir }      (Super Admin)
 *   PUT    {id, judul?, isi?, kunci?}  -> { diubah, butir }      menyunting = kembali DRAF
 *   DELETE ?id=  (atau badan {id})     -> { diubah, butir }      penghapusan lunak
 *
 * Membaca: semua pegawai yang masuk - ekstensi menampilkan butir DRAF pun,
 * bertanda "DRAF - belum disahkan" dengan tombol sisip mati, supaya petugas
 * tahu templatnya ada tetapi belum boleh dipakai. Yang boleh DISISIPKAN hanya
 * butir disahkan: true, dan itu keputusan ekstensi atas medan `disahkan`.
 *
 * Bukan Pustaka pertimbangan (/pustaka/pertimbangan): pustaka menyerap
 * alinea dari putusan yang sudah ada; templat ini kerangka pendek per status
 * putusan dan per huruf alasan perceraian yang disahkan pimpinan.
 */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    const actor = await requireActorUser(db, actorUserId);
    const jenis = getSearchParam(request, "jenis");
    return ok({
      butir: await bacaTemplat(db, jenis),
      bolehMenyunting: bolehMenyuntingAkses(actor),
      tandaDraf: TANDA_DRAF,
    });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "LEGAL_TEMPLATE_READ_FAILED",
      feature: "aleta_ecourt",
      entityId: "templat-hukum",
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
    const badan = await bacaBadan(request);
    const diubah = await tambahTemplat(db, actorUserId, {
      jenis: badan.jenis,
      kunci: badan.kunci,
      judul: badan.judul,
      isi: badan.isi,
    });
    return ok({ diubah, butir: await bacaTemplat(db) });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "LEGAL_TEMPLATE_CREATE_FAILED",
      feature: "aleta_ecourt",
      entityId: "templat-hukum",
    });
  }
}

export async function PUT(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    const badan = await bacaBadan(request);
    const diubah = await ubahTemplat(db, actorUserId, {
      id: badan.id,
      sahkan: badan.sahkan,
      judul: badan.judul,
      isi: badan.isi,
      kunci: badan.kunci,
    });
    return ok({ diubah, butir: await bacaTemplat(db) });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "LEGAL_TEMPLATE_UPDATE_FAILED",
      feature: "aleta_ecourt",
      entityId: "templat-hukum",
    });
  }
}

export async function DELETE(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    let id: unknown = getSearchParam(request, "id");
    if (!id) id = (await bacaBadan(request)).id;
    const diubah = await hapusTemplat(db, actorUserId, id);
    return ok({ diubah, butir: await bacaTemplat(db) });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "LEGAL_TEMPLATE_DELETE_FAILED",
      feature: "aleta_ecourt",
      entityId: "templat-hukum",
    });
  }
}
