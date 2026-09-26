import { NextResponse, type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import { untukEkstensi } from "@/server/modules/aleta-ecourt/tipe-keluaran";
import { resolveActorUserId } from "@/server/shared/auth";
import { handleRouteError } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Tipe keluaran untuk ekstensi SIPP/ABT (K5).
 *
 * 200 {ok:true, versi, dibuatPada, daftar:{empat daftar ekstensi}} - hanya
 * entri EFEKTIF (bawaan yang menyala + tambahan yang disahkan dan menyala).
 *
 * ============================================================================
 * TABEL TAK TERBACA DIJAWAB 503, BUKAN CERMIN
 * ============================================================================
 *
 * Modul menjatuhkan tabel yang tak terbaca ke cermin kode. Untuk bot dan
 * portal itu benar, tetapi ekstensi punya singgahan (K7): bila portal
 * menjawab "cermin" dengan 200, ekstensi akan menimpa singgahan yang berisi
 * tambahan sah dengan bawaan saja - dan tambahan itu hilang diam-diam dari
 * layar petugas sampai basis data pulih. Dengan 503 ekstensi tetap memakai
 * singgahannya, lalu tertanam.
 */
export async function GET(request: NextRequest) {
  try {
    const db = await getDatabase();
    const actorUserId = await resolveActorUserId(request);
    await pastikanKapabilitas(db, actorUserId, "panel");
    const hasil = await untukEkstensi(db);
    if (hasil.asal !== "basis-data") {
      console.error("[TIPE KELUARAN] Rute ekstensi menjawab 503.", hasil.kabar);
      return NextResponse.json({ ok: false, alasan: "basis_data_tidak_terbaca" }, { status: 503 });
    }
    return NextResponse.json({ ok: true, versi: hasil.versi, dibuatPada: hasil.dibuatPada, daftar: hasil.daftar });
  } catch (error) {
    return handleRouteError(error);
  }
}
