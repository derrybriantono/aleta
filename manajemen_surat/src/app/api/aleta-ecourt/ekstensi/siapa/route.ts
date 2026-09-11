import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { roles as daftarPeran } from "@/lib/mock-data";
import { DIRILIS_EKSTENSI_TERBARU } from "@/lib/catatan-ekstensi";
import {
  KETERANGAN_KAPABILITAS,
  bolehMenyuntingAkses,
  kapabilitasPengguna,
} from "@/server/modules/aleta-ecourt/akses";
import { susunMenuEkstensi } from "@/server/modules/aleta-ecourt/menu-ekstensi";
import { requireActorUser } from "@/server/modules/organization/service";
import { resolveActorUserId } from "@/server/shared/auth";
import { EKSTENSI_VERSI } from "@/server/shared/ekstensi-berkas";
import { handleRouteError, ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * "Siapa saya, dan saya boleh apa" - untuk panel ekstensi di halaman ALETA.
 *
 * Selalu tentang pemanggilnya sendiri; tidak ada ruas yang menyebut orang
 * lain. Menu pintasannya DISUSUN DI SINI menurut jabatan (lihat
 * menu-ekstensi.ts), supaya aturannya hidup di satu tempat - bukan di berkas
 * ekstensi yang berjalan dalam beberapa versi sekaligus di peramban orang.
 */
export async function GET(request: NextRequest) {
  try {
    const db = await getDatabase();
    const actorUserId = await resolveActorUserId(request);
    const actor = await requireActorUser(db, actorUserId);

    const roleId = String(actor.roleId || "");
    const additionalRoleIds = actor.additionalRoleIds ?? [];
    const peran = daftarPeran.find((x) => x.id === roleId);

    return ok({
      nama: actor.name,
      peran: peran ? peran.name : roleId,
      roleId,
      peranTambahan: additionalRoleIds,
      kapabilitas: await kapabilitasPengguna(db, { id: actor.id, roleId, additionalRoleIds }),
      keterangan: KETERANGAN_KAPABILITAS,
      menu: susunMenuEkstensi(roleId, additionalRoleIds),
      bolehMengatur: bolehMenyuntingAkses(actor),
      versiEkstensi: EKSTENSI_VERSI,
      dirilis: DIRILIS_EKSTENSI_TERBARU,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
