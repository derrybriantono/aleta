import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import { nilaiSippUntukCek, pastikanKamusAwal } from "@/server/modules/aleta-ecourt/kamus-sumber";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ok } from "@/server/shared/http";
import { getSearchParam } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * B1 (10 Okt 2026): nilai SIPP terkini untuk pengingat sebelum CETAK.
 *
 *   GET ?perkaraId=10018&kode=0001,0098,0102,...
 *       -> { perkaraId, butir: [{kode, nama, cermin, label, status, acuan, terbaca, nilaiSipp, sebab}], catatan }
 *
 * HANYA MEMBACA: kamus menunjuk variabel mana yang mencerminkan data inti
 * SIPP, dan nilainya dihitung ulang lewat jembatan bot baca-saja. Ekstensi
 * yang membandingkannya dengan isi halaman ABT - isi halaman tidak dikirim.
 * Pengingat, bukan penahan: CETAK tidak pernah ditahan karena jawaban ini.
 */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanKapabilitas(db, actorUserId, "panel");
    await pastikanKamusAwal(db);
    const hasil = await nilaiSippUntukCek(db, {
      perkaraId: getSearchParam(request, "perkaraId"),
      kode: getSearchParam(request, "kode"),
    });
    return ok({
      ...hasil,
      catatan:
        "Pengingat saja - CETAK tidak ditahan. Nilai SIPP dihitung ulang dengan definisi variabel ABT yang sama; " +
        "isian manual dibandingkan dengan variabel otomatis acuannya.",
    });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "ABT_SIPP_CHECK_FAILED",
      feature: "aleta_ecourt",
      entityId: "abt-cek-sipp",
    });
  }
}
