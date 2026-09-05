import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import {
  catatKehadiranAntrian,
  getGatewayPeranAntrian,
} from "@/server/modules/aleta-bot/whatsapp-gateway-client";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Peran yang dapat hadir - untuk menyusun pilihan di layar pengambilan. */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanKapabilitas(db, actorUserId, "panel");

    const hasil = await getGatewayPeranAntrian();
    if (!hasil.ok) {
      return ok({ available: false, message: hasil.error || "ALETA Bot belum dapat dihubungi.", peran: [] });
    }
    return ok({ available: true, peran: hasil.data?.peran ?? [] });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "ANTRIAN_PERAN_FAILED",
      feature: "antrian",
      entityId: "antrian-peran",
    });
  }
}

/**
 * Mencatat kehadiran satu pihak, lalu mengisi waktu ambil bila masih kosong.
 *
 * ============================================================================
 * YANG MENCATAT PETUGAS, BUKAN PIHAKNYA SENDIRI
 * ============================================================================
 *
 * Layar pengambilan dibuka petugas sidang atau petugas PTSP, dan merekalah
 * yang menekan tombolnya - karena itu rute ini menuntut login beserta
 * kemampuan "panel". Pihak berperkara mengambil antrian lewat WhatsApp, jalur
 * yang sudah ada dan yang identitasnya terbukti dari nomor pengirimnya.
 *
 * Membuka pencatatan ini tanpa login berarti siapa pun yang berada di jaringan
 * pengadilan dapat menyatakan dirinya Penggugat pada perkara mana pun, dan
 * yang lahir dari situ bukan sekadar data keliru - melainkan nomor antrian
 * yang menggeser giliran orang lain.
 */
export async function POST(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    const actor = await pastikanKapabilitas(db, actorUserId, "panel");

    const isi = (await request.json().catch(() => ({}))) as {
      perkaraId?: string;
      nomorPerkara?: string;
      peran?: string;
      urutanPihak?: string;
      sebagaiKuasa?: boolean;
      nama?: string;
      sisi?: string;
      waChatId?: string;
    };

    if (!String(isi.perkaraId || "").trim()) {
      return ok({ available: true, ok: false, alasan: "Perkara belum dipilih." });
    }
    if (!String(isi.peran || "").trim()) {
      return ok({ available: true, ok: false, alasan: "Peran yang hadir belum dipilih." });
    }

    const hasil = await catatKehadiranAntrian({
      perkaraId: String(isi.perkaraId),
      nomorPerkara: String(isi.nomorPerkara || ""),
      peran: String(isi.peran),
      urutanPihak: String(isi.urutanPihak || ""),
      sebagaiKuasa: isi.sebagaiKuasa === true,
      nama: String(isi.nama || ""),
      sisi: String(isi.sisi || ""),
      waChatId: String(isi.waChatId || ""),
      dicatatOleh: actor.name || actor.id,
    });

    if (!hasil.ok) {
      return ok({ available: false, message: hasil.error || "ALETA Bot belum dapat dihubungi." });
    }

    return ok({ available: true, ...hasil.data });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "ANTRIAN_HADIR_FAILED",
      feature: "antrian",
      entityId: "antrian-hadir",
    });
  }
}
