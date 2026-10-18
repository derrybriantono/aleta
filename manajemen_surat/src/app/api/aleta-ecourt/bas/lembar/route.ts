import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import { pastikanAksi } from "@/server/modules/akses/hak-peran";
import { daftarLembar, muatLembar, simpanLembar, type MasukanSimpan } from "@/server/modules/aleta-ecourt/bas-lembar";
import { bolehMengacc } from "@/server/modules/aleta-ecourt/bas-acc";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { getSearchParam } from "@/server/shared/request";
import { ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Lembar BAS yang sedang diisi panitera.
 *
 * Tiga bentuk pemakaian:
 *
 *   GET  ?perkaraId=10102                     daftar lembar milik perkara itu
 *   GET  ?perkaraId=10102&kode=A1a&saksiKe=1  satu lembar beserta jawabannya
 *   PUT  {perkaraId, kode, saksiKe, saksi, baris[]}   menyimpan
 *
 * ============================================================================
 * MENYIMPAN SEBAGIAN ITU SAH
 * ============================================================================
 *
 * Sidang berjalan sementara lembarnya diisi, jadi penyimpanan terjadi berkali-
 * kali dalam keadaan setengah jadi. Rute ini tidak menuntut lembar lengkap dan
 * tidak menolak jawaban kosong - yang ditolak hanya lembar tanpa perkara atau
 * tanpa kumpulan pertanyaan, karena keduanya menentukan lembar ini milik siapa.
 */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanKapabilitas(db, actorUserId, "panel");
    await pastikanAksi(db, actorUserId, "bas.baca"); // 18 Okt 2026: matriks hak akses

    const perkaraId = String(getSearchParam(request, "perkaraId") ?? "").trim();
    const kode = String(getSearchParam(request, "kode") ?? "").trim();
    const saksiKe = Number(getSearchParam(request, "saksiKe") ?? "1") || 1;

    if (!perkaraId) return ok({ ada: false, sebab: "Perkara tidak dikenali.", daftar: [] });

    if (!kode) return ok({ ada: true, daftar: await daftarLembar(db, perkaraId) });

    const lembar = await muatLembar(db, { perkaraId, kode, saksiKe });
    // Kewenangan acc ikut dipulangkan supaya layar tidak menggambar tombol
    // yang pasti ditolak. Ini keputusan gambar, BUKAN penjagaan - penjagaannya
    // di bas-acc, yang berjalan di peladen.
    return ok({ ada: Boolean(lembar), lembar, bolehAcc: await bolehMengacc(db, actorUserId) });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "BAS_LEMBAR_BACA_FAILED",
      feature: "aleta_ecourt",
      entityId: "bas-lembar",
    });
  }
}

export async function PUT(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanKapabilitas(db, actorUserId, "panel");
    await pastikanAksi(db, actorUserId, "bas.tulis"); // 18 Okt 2026: matriks hak akses

    const masukan = (await request.json()) as MasukanSimpan;
    const lembar = await simpanLembar(db, String(actorUserId ?? ""), masukan);

    return ok({ ok: true, lembar });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "BAS_LEMBAR_SIMPAN_FAILED",
      feature: "aleta_ecourt",
      entityId: "bas-lembar",
    });
  }
}
