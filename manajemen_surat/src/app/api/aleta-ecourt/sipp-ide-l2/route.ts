import { type NextRequest } from "next/server";

import { golonganPopup } from "@/lib/golongan-popup";
import { bersihkanNomorIdeL2, kodeIdeL2UntukGolongan, saringPenandaIdeL2 } from "@/lib/sipp-ide-l2";
import { getDatabase } from "@/server/db/client";
import { getGatewayLimaBulanIdeL2, postGatewayPenandaIdeL2 } from "@/server/modules/aleta-bot/whatsapp-gateway-client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ok } from "@/server/shared/http";
import { readJsonBody } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ============================================================================
 * SIPP DENGAN IDE ALETA - GELOMBANG 1 (Tahap L2, 16 Okt 2026)
 * ============================================================================
 *
 *   POST { nomorPerkara: string[] (<= 100) }
 *     -> { tersedia, golongan, boleh: kode[], kini, perkara: {nomor: {perkaraId, penanda}}, terbaca, pesan }
 *   GET  ?info=lima-bulan   (Ketua, Admin, Super Admin)
 *     -> { tersedia, jumlah, daftar: [{nomor, hari, lewat}], dasar }
 *
 * Dipanggil ekstensi-sipp/sipp-ide-l2.js dari halaman SIPP (daftar perkara,
 * Jadwal Sidang, detil perkara). Aturannya di bot; di sini hanya kapabilitas
 * "panel" (sama dengan penanda baris yang sudah ada) dan saringan per golongan.
 * SIPP hanya dibaca.
 */
export async function POST(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    const actor = await pastikanKapabilitas(db, actorUserId, "panel");
    const golongan = golonganPopup(actor as never);
    const boleh = kodeIdeL2UntukGolongan(golongan.semua);
    const body = (await readJsonBody(request)) as { nomorPerkara?: unknown } | null;
    const nomor = bersihkanNomorIdeL2(body?.nomorPerkara);
    if (!nomor.length || !boleh.length) {
      return ok({ tersedia: true, golongan: golongan.kode, boleh, kini: null, perkara: {}, terbaca: {}, pesan: "" });
    }
    const r = await postGatewayPenandaIdeL2(nomor);
    if (!r.ok) {
      return ok({ tersedia: false, golongan: golongan.kode, boleh, kini: null, perkara: {}, terbaca: {}, pesan: r.error || "ALETA Bot belum dapat dihubungi." });
    }
    return ok({
      tersedia: true,
      golongan: golongan.kode,
      boleh,
      kini: r.data?.kini ?? null,
      perkara: saringPenandaIdeL2(r.data?.perkara ?? {}, boleh),
      terbaca: r.data?.terbaca ?? {},
      pesan: "",
    });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "SIPP_IDE_L2_BACA_FAILED",
      feature: "aleta_ecourt",
      entityId: "sipp-ide-l2",
    });
  }
}

export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    const actor = await pastikanKapabilitas(db, actorUserId, "panel");
    const boleh = kodeIdeL2UntukGolongan(golonganPopup(actor as never).semua);
    if (request.nextUrl.searchParams.get("info") !== "lima-bulan" || !boleh.includes("lewat-5-bulan")) {
      return ok({ tersedia: false, jumlah: 0, daftar: [], dasar: "", pesan: "Tidak tersedia untuk peran ini." });
    }
    const r = await getGatewayLimaBulanIdeL2();
    if (!r.ok) return ok({ tersedia: false, jumlah: 0, daftar: [], dasar: "", pesan: r.error || "ALETA Bot belum dapat dihubungi." });
    return ok({ tersedia: true, jumlah: r.data?.jumlah ?? 0, daftar: r.data?.daftar ?? [], dasar: r.data?.dasar ?? "", pesan: "" });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "SIPP_IDE_L2_LIMA_BULAN_FAILED",
      feature: "aleta_ecourt",
      entityId: "sipp-ide-l2",
    });
  }
}
