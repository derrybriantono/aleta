import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import {
  bacaKehadiran,
  simpanKehadiran,
  type IsianKehadiran,
} from "@/server/modules/aleta-ecourt/kehadiran-mediasi";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ok } from "@/server/shared/http";
import { pastikanAksi } from "@/server/modules/akses/hak-peran";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Kehadiran pertemuan mediasi - milik ALETA, bukan SIPP.
 *
 * ============================================================================
 * KENAPA RUTE TERSENDIRI
 * ============================================================================
 *
 * Jadwal mediasi datang dari SIPP lewat bot dan hanya dibaca. Kehadiran ini
 * ditulis ALETA sendiri, dan menyatukan keduanya dalam satu rute berarti satu
 * kegagalan SIPP ikut menghalangi pencatatan kehadiran yang sebenarnya tidak
 * memerlukan SIPP sama sekali.
 *
 * Kapabilitasnya sama dengan jadwal mediasi: yang boleh melihat pertemuannya
 * adalah yang boleh mencatat kehadirannya.
 */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanKapabilitas(db, actorUserId, "panel");

    const p = request.nextUrl.searchParams;
    const mediasiId = String(p.get("mediasiId") || "").trim();
    const tanggal = String(p.get("tanggal") || "").trim();

    if (!mediasiId) {
      return ok({ ada: false, sebab: "Pertemuan mediasi wajib disebut.", baris: [] });
    }

    const hasil = await bacaKehadiran(db, mediasiId, tanggal);
    return ok({ ada: true, sebab: "", ...hasil });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "KEHADIRAN_MEDIASI_BACA_FAILED",
      feature: "aleta_ecourt",
      entityId: "kehadiran-mediasi",
    });
  }
}

type Masukan = {
  mediasiId?: string;
  perkaraId?: string;
  nomorPerkara?: string;
  tanggalPertemuan?: string;
  isian?: IsianKehadiran[];
};

export async function POST(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    const aktor = await pastikanKapabilitas(db, actorUserId, "panel");
    await pastikanAksi(db, actorUserId, "mediasi.catat"); // HAK-PERAN 12 Okt: matriks peran

    const masukan = (await request.json().catch(() => ({}))) as Masukan;

    const hasil = await simpanKehadiran(db, {
      mediasiId: String(masukan.mediasiId ?? ""),
      perkaraId: String(masukan.perkaraId ?? ""),
      nomorPerkara: String(masukan.nomorPerkara ?? ""),
      tanggalPertemuan: String(masukan.tanggalPertemuan ?? ""),
      // Nama pencatat diambil dari sesi yang sedang berjalan dan TIDAK dapat
      // diketik. Ruas yang dapat diisi sendiri membuat catatannya tidak dapat
      // ditelusuri pada hari kehadiran itu dipersoalkan.
      oleh: aktor.name || String(actorUserId ?? "petugas"),
      isian: Array.isArray(masukan.isian) ? masukan.isian : [],
    });

    return ok(hasil);
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "KEHADIRAN_MEDIASI_SIMPAN_FAILED",
      feature: "aleta_ecourt",
      entityId: "kehadiran-mediasi",
    });
  }
}
