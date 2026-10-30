import { type NextRequest } from "next/server";

import { tampilanStatus, statusBotMati, type StatusAkunEcourt } from "@/lib/ecourt-status-akun";
import { isPrivilegedAdmin } from "@/lib/permissions";
import { getDatabase } from "@/server/db/client";
import {
  getGatewayStatusAkunEcourt,
  periksaGatewayStatusAkunEcourt,
} from "@/server/modules/aleta-bot/whatsapp-gateway-client";
import { requireActorUser } from "@/server/modules/organization/service";
import { resolveActorUserId } from "@/server/shared/auth";
import { ApiError } from "@/server/shared/errors";
import { handleRouteError, ok } from "@/server/shared/http";
import { readJsonBody } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ============================================================================
 * STATUS AKUN e-COURT - SATU SUMBER UNTUK SEMUA PENANDA (30 Okt 2026)
 * ============================================================================
 *
 * GET  - siapa pun yang masuk ALETA: ringkasan akun utama (judul, kalimat,
 *        warna). Super Admin & Admin: juga daftar seluruh akun penarik.
 *        Bot diminta memeriksa ulang akun yang buktinya basi DI LATAR.
 * POST - {tindakan:"periksa", slot} Super Admin & Admin: periksa sekarang.
 *
 * Tidak ada sandi, cookie, atau surel di jawaban mana pun.
 */
function susun(data: { akun?: StatusAkunEcourt[]; ringkas?: StatusAkunEcourt; dibaca?: string; utama?: string } | null, admin: boolean) {
  const akun = Array.isArray(data?.akun) ? data!.akun : [];
  return {
    tersedia: Boolean(data),
    dibaca: data?.dibaca || new Date().toISOString(),
    utama: data?.utama || "",
    ringkas: tampilanStatus(data?.ringkas ?? null),
    akun: admin ? akun.map((a) => tampilanStatus(a)) : [],
  };
}

export async function GET(request: NextRequest) {
  try {
    const db = await getDatabase();
    const actor = await requireActorUser(db, await resolveActorUserId(request));
    const admin = isPrivilegedAdmin(actor);
    const hasil = await getGatewayStatusAkunEcourt(true);
    if (!hasil.ok || !hasil.data) {
      return ok({ ...susun(null, admin), ringkas: tampilanStatus(statusBotMati()), pesan: (!hasil.ok && hasil.error) || "ALETA Bot belum dapat dihubungi." });
    }
    return ok(susun(hasil.data, admin));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const db = await getDatabase();
    const actor = await requireActorUser(db, await resolveActorUserId(request));
    if (!isPrivilegedAdmin(actor)) {
      throw new ApiError(403, "Hanya Super Admin dan Admin yang dapat memeriksa akun e-Court pengadilan.");
    }
    const body = await readJsonBody<{ tindakan?: string; slot?: string }>(request);
    if (String(body?.tindakan || "") !== "periksa") throw new ApiError(400, "Tindakan tidak dikenal.");
    const hasil = await periksaGatewayStatusAkunEcourt(String(body?.slot || ""));
    if (!hasil.ok || !hasil.data) {
      return ok({ ...susun(null, true), ringkas: tampilanStatus(statusBotMati()), pesan: (!hasil.ok && hasil.error) || "ALETA Bot belum dapat dihubungi." });
    }
    return ok(susun(hasil.data, true));
  } catch (error) {
    return handleRouteError(error);
  }
}
