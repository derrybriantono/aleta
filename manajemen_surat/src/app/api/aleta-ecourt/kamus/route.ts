import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { pastikanAdminIstimewa, pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import {
  bacaVariabel,
  riwayatSalin,
  salinKamus,
  statistikKamus,
} from "@/server/modules/aleta-ecourt/kamus-variabel";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { getSearchParam } from "@/server/shared/request";
import { ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Kamus variabel ALETA (Tahap 0 - Kemandirian Blangko).
 *
 *   GET                        keadaan kamus: jumlah, pembagian kelas, penyalinan terakhir
 *   GET ?noVar=0046            satu definisi apa adanya
 *   GET ?riwayat=1             riwayat penyalinan
 *
 *   POST {tindakan:"salin"}    menyalin ulang seluruh definisi dari ABT
 *
 * ============================================================================
 * MEMBACA TERBUKA, MENYALIN TIDAK
 * ============================================================================
 *
 * Arti sebuah penanda pantas dibaca siapa pun yang memakai blangko - panitera
 * yang melihat #6034# tertinggal di naskahnya berhak tahu bahwa yang diminta
 * adalah jabatan panitera, bukan namanya, tanpa harus bertanya kepada admin.
 *
 * Menyalin ulang mengubah kamus yang dipakai SELURUH pengadilan sekaligus, dan
 * itu menuntut admin.
 */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanKapabilitas(db, actorUserId, "panel");

    const noVar = String(getSearchParam(request, "noVar") ?? "").trim();
    if (noVar) {
      const butir = await bacaVariabel(db, noVar);
      if (!butir) {
        return ok({
          ada: false,
          sebab: `#${noVar}# tidak ada di kamus. Kalau kamus belum pernah disalin, jalankan penyalinan lebih dulu.`,
        });
      }
      return ok({ ada: true, variabel: butir });
    }

    if (String(getSearchParam(request, "riwayat") ?? "").trim() === "1") {
      return ok({ ada: true, riwayat: await riwayatSalin(db) });
    }

    return ok({ ada: true, statistik: await statistikKamus(db) });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "KAMUS_VARIABEL_BACA_FAILED",
      feature: "aleta_ecourt",
      entityId: "kamus-variabel",
    });
  }
}

type Masukan = {
  tindakan?: string;
  olehNama?: string;
  /** Berapa kali tiap kode muncul di pustaka blangko, bila sudah dihitung. */
  pemakaian?: Record<string, number>;
};

export async function POST(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanAdminIstimewa(db, actorUserId, "menyalin kamus variabel");

    const masukan = (await request.json()) as Masukan;
    if (String(masukan.tindakan ?? "") !== "salin") {
      return ok({ ok: false, sebab: "Tindakan tidak dikenali." });
    }

    const hasil = await salinKamus(db, {
      oleh: String(masukan.olehNama ?? "") || String(actorUserId ?? ""),
      pemakaian: masukan.pemakaian,
    });
    return ok(hasil);
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "KAMUS_VARIABEL_SALIN_FAILED",
      feature: "aleta_ecourt",
      entityId: "kamus-variabel",
    });
  }
}
