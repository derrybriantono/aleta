import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { getGatewaySippRingkasanMassal } from "@/server/modules/aleta-bot/whatsapp-gateway-client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ok } from "@/server/shared/http";
import { readJsonBody } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Ringkasan singkat untuk BANYAK perkara sekaligus.
 *
 * Dipakai ekstensi untuk menandai baris pada halaman Daftar Perkara SIPP -
 * mana yang punya dokumen menunggu majelis, mana yang tenggatnya mendesak.
 * Tanpa rute ini, menandai 50 baris berarti 50 permintaan sekaligus dari satu
 * halaman.
 *
 * YANG SENGAJA TIDAK DIKEMBALIKAN
 *
 * Tidak ada nomor telepon, tidak ada nama pihak, tidak ada isi dokumen -
 * hanya angka. Halaman daftar memuat puluhan perkara sekaligus, dan menandai
 * semuanya dengan data pribadi berarti memajangnya di satu layar yang terlihat
 * siapa saja yang lewat.
 *
 * Batasnya dijaga di dua tempat: di sini dan di bot. Pemanggil yang mengirim
 * ribuan nomor tidak menghasilkan kueri raksasa.
 */
const BATAS_NOMOR = 60;

export async function POST(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanKapabilitas(db, actorUserId, "panel");

    const body = await readJsonBody<{ nomorPerkara?: unknown }>(request).catch(
      () => ({}) as { nomorPerkara?: unknown }
    );
    const daftar = Array.isArray(body.nomorPerkara)
      ? body.nomorPerkara
          .map((x: unknown) => String(x || "").trim())
          .filter(Boolean)
          .slice(0, BATAS_NOMOR)
      : [];

    if (daftar.length === 0) {
      return ok({ available: true, message: "", perkara: {}, alasan: "daftar_kosong" });
    }

    const hasil = await getGatewaySippRingkasanMassal(daftar);
    if (!hasil.ok) {
      return ok({
        available: false,
        message: hasil.error || "ALETA Bot belum dapat dihubungi.",
        perkara: {},
      });
    }

    return ok({
      available: true,
      message: "",
      diperiksaPada: hasil.data?.diperiksaPada ?? "",
      ambangMendesakHari: hasil.data?.ambangMendesakHari ?? 3,
      perkara: hasil.data?.perkara ?? {},
    });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "SIPP_RINGKASAN_MASSAL_FAILED",
      feature: "sipp_konteks",
    });
  }
}
