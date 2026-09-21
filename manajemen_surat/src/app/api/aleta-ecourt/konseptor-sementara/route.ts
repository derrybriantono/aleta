import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import {
  bacaKonseptorSementara,
  simpanKonseptorSementara,
} from "@/server/modules/aleta-ecourt/konseptor-sementara";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Konseptor sementara - tunjukan tangan, seluruhnya milik ALETA.
 *
 * ============================================================================
 * SIPP TIDAK PERNAH DITULIS DARI SINI
 * ============================================================================
 *
 * Tunjukan tangan bukan fakta perkara. Menuliskannya ke jejak tahapan SIPP
 * akan membuat penunjukan terbaca sebagai pekerjaan yang sudah dikerjakan -
 * dan jejak itulah yang kemudian dibaca kembali sebagai "konseptornya siapa",
 * sehingga tunjukan yang keliru menjadi kebenaran yang tidak dapat dibantah.
 *
 * Kapabilitasnya sama dengan layar antrian sidang: yang boleh melihat jadwal
 * perkaranya adalah yang boleh menunjuk siapa yang menyusun putusannya.
 */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanKapabilitas(db, actorUserId, "panel");

    const mentah = String(request.nextUrl.searchParams.get("perkaraId") || "");
    const daftar = mentah
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);

    if (daftar.length === 0) return ok({ ada: true, peta: {} });

    return ok({ ada: true, peta: await bacaKonseptorSementara(db, daftar) });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "KONSEPTOR_SEMENTARA_BACA_FAILED",
      feature: "aleta_ecourt",
      entityId: "konseptor-sementara",
    });
  }
}

type Masukan = {
  perkaraId?: string;
  nomorPerkara?: string;
  nama?: string;
  pengguna?: string;
  catatan?: string;
};

export async function POST(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    const aktor = await pastikanKapabilitas(db, actorUserId, "panel");

    const masukan = (await request.json().catch(() => ({}))) as Masukan;

    const hasil = await simpanKonseptorSementara(db, {
      perkaraId: String(masukan.perkaraId ?? ""),
      nomorPerkara: String(masukan.nomorPerkara ?? ""),
      nama: String(masukan.nama ?? ""),
      pengguna: String(masukan.pengguna ?? ""),
      catatan: String(masukan.catatan ?? ""),
      // Dari sesi, tidak dapat diketik - lihat catatan pada simpanKonseptorSementara.
      oleh: aktor.name || String(actorUserId ?? "petugas"),
    });

    return ok(hasil);
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "KONSEPTOR_SEMENTARA_SIMPAN_FAILED",
      feature: "aleta_ecourt",
      entityId: "konseptor-sementara",
    });
  }
}
