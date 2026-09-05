import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { pastikanAdminIstimewa, pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import {
  asalButir,
  bacaButir,
  cariButir,
  gantikanButir,
  periksaRujukan,
  ringkasPustaka,
  rujukanButir,
  sahkanButir,
  serapPertimbangan,
  tolakButir,
  type Butir,
} from "@/server/modules/aleta-ecourt/pustaka-pertimbangan";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { getSearchParam } from "@/server/shared/request";
import { ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Pustaka pertimbangan hukum.
 *
 *   GET                                 ringkasan jumlah butir tiap keadaan
 *   GET ?cari=verstek                   butir yang sudah disahkan
 *   GET ?keadaan=usulan                 butir yang menunggu pengesahan
 *   GET ?butirId=...                    satu butir beserta rujukan dan asalnya
 *
 *   POST {tindakan:"serap", perkaraId}  menyerap pertimbangan satu perkara
 *   POST {tindakan:"periksa", butirId}  memeriksa rujukan terhadap pustaka hukum
 *   POST {tindakan:"sahkan", ...}       mengesahkan, WAJIB menyebut atas perintah siapa
 *   POST {tindakan:"tolak", ...}        menolak, wajib beralasan
 *   POST {tindakan:"ganti", ...}        versi baru menggantikan yang lama
 *
 * ============================================================================
 * MEMBACA BOLEH LUAS, MENGUBAH TIDAK
 * ============================================================================
 *
 * Hakim dan panitera membaca pustaka untuk menyusun - itu memang gunanya.
 * Mengubahnya menuntut kewenangan admin: satu butir yang keliru salah di
 * SETIAP putusan yang memakainya, dengan rapi dan tanpa ada yang memeriksanya
 * lagi karena "sudah ada di pustaka".
 */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanKapabilitas(db, actorUserId, "panel");

    const butirId = String(getSearchParam(request, "butirId") ?? "").trim();
    const cari = String(getSearchParam(request, "cari") ?? "").trim();
    const keadaan = String(getSearchParam(request, "keadaan") ?? "").trim();
    const jenisPerkara = String(getSearchParam(request, "jenisPerkara") ?? "").trim();
    const minimal = Number(getSearchParam(request, "minimalPemakaian") ?? "0") || 0;

    if (butirId) {
      const butir = await bacaButir(db, butirId);
      if (!butir) return ok({ ada: false, sebab: "Butir tidak ditemukan." });
      return ok({
        ada: true,
        butir,
        rujukan: await rujukanButir(db, butirId),
        asal: await asalButir(db, butirId),
      });
    }

    if (cari || keadaan || jenisPerkara || minimal) {
      const butir = await cariButir(db, {
        cari,
        jenisPerkara,
        minimalPemakaian: minimal,
        keadaan: (keadaan || "disahkan") as Butir["keadaan"],
      });
      return ok({ ada: true, jumlah: butir.length, butir });
    }

    return ok({ ada: true, ringkasan: await ringkasPustaka(db) });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "PUSTAKA_PERTIMBANGAN_BACA_FAILED",
      feature: "aleta_ecourt",
      entityId: "pustaka-pertimbangan",
    });
  }
}

type Masukan = {
  tindakan?: string;
  perkaraId?: string;
  butirId?: string;
  atasPerintah?: string;
  isu?: string;
  syarat?: Record<string, unknown>;
  alasan?: string;
  teksBaru?: string;
};

export async function POST(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanAdminIstimewa(db, actorUserId, "mengubah pustaka pertimbangan");

    const masukan = (await request.json()) as Masukan;
    const aktor = String(actorUserId ?? "");

    switch (String(masukan.tindakan ?? "")) {
      case "serap":
        return ok(await serapPertimbangan(db, aktor, String(masukan.perkaraId ?? "")));

      case "periksa":
        return ok({ ok: true, ...(await periksaRujukan(db, String(masukan.butirId ?? ""))) });

      case "sahkan":
        return ok(
          await sahkanButir(db, aktor, {
            butirId: String(masukan.butirId ?? ""),
            atasPerintah: String(masukan.atasPerintah ?? ""),
            isu: String(masukan.isu ?? ""),
            syarat: masukan.syarat ?? {},
          })
        );

      case "tolak":
        return ok(await tolakButir(db, String(masukan.butirId ?? ""), String(masukan.alasan ?? "")));

      case "ganti":
        return ok(
          await gantikanButir(db, aktor, {
            butirId: String(masukan.butirId ?? ""),
            teksBaru: String(masukan.teksBaru ?? ""),
            atasPerintah: String(masukan.atasPerintah ?? ""),
            isu: String(masukan.isu ?? ""),
            syarat: masukan.syarat,
          })
        );

      default:
        return ok({ ok: false, sebab: "Tindakan tidak dikenali." });
    }
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "PUSTAKA_PERTIMBANGAN_UBAH_FAILED",
      feature: "aleta_ecourt",
      entityId: "pustaka-pertimbangan",
    });
  }
}
