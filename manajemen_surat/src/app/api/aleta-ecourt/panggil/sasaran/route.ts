import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import { panggilBotPanggil } from "@/server/modules/panggil-petugas/gateway";
import { bacaSasaran, keadaanWhatsApp, untukPeramban } from "@/server/modules/panggil-petugas/service";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ok } from "@/server/shared/http";
import type { GolonganSasaran } from "@/lib/panggil-petugas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GOLONGAN: GolonganSasaran[] = ["majelis", "pp", "js", "mediator", "pihak1", "pihak2"];

/**
 * Siapa yang dapat dipanggil pada satu perkara - isi pop-up nama petugas/pihak.
 *
 *   GET ?perkaraId&tanggal&golongan=majelis,pp,...
 *
 * Nomor dijawab TERSAMAR (0812****789); nomor utuh tidak pernah keluar dari
 * peladen. Ikut dijawab: keadaan bot WhatsApp (dapat mengirim atau tidak,
 * beserta sebabnya) dan riwayat panggilan perkara itu hari ini.
 */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanKapabilitas(db, actorUserId, "panel");
    const url = new URL(request.url);
    const perkaraId = String(url.searchParams.get("perkaraId") ?? "");
    const tanggal = String(url.searchParams.get("tanggal") ?? "").slice(0, 10);
    const diminta = String(url.searchParams.get("golongan") ?? "")
      .split(",")
      .map((x) => x.trim())
      .filter((x): x is GolonganSasaran => (GOLONGAN as string[]).includes(x));

    const [sasaran, wa, riwayat] = await Promise.all([
      bacaSasaran(db, { perkaraId, tanggal }),
      keadaanWhatsApp(db),
      panggilBotPanggil<{ ok: boolean; daftar?: Array<Record<string, unknown>> }>(
        `/riwayat?perkaraId=${encodeURIComponent(perkaraId)}&tanggal=${encodeURIComponent(tanggal)}`
      ),
    ]);
    if (!sasaran.ok) return ok({ available: false, alasan: sasaran.alasan, whatsapp: wa });

    const orang = sasaran.orang
      .filter((o) => diminta.length === 0 || diminta.includes(o.golongan))
      .map(untukPeramban);
    return ok({
      available: true,
      perkara: {
        nomorPerkara: sasaran.perkara.nomorPerkara,
        ruang: sasaran.perkara.ruang,
        agenda: sasaran.perkara.agenda,
      },
      orang,
      tidakTerbaca: sasaran.tidakTerbaca,
      whatsapp: wa,
      riwayat: riwayat.ok && riwayat.data.ok ? (riwayat.data.daftar ?? []).slice(0, 20) : [],
    });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "PANGGIL_SASARAN_READ_FAILED",
      feature: "aleta_ecourt",
    });
  }
}
