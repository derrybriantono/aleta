import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import {
  deleteGatewayAgendaRule,
  deleteGatewayEcourtRule,
  getGatewayAgendaSettings,
  getGatewayEcourtSettings,
  resetGatewayNomor,
  saveGatewayAgendaRule,
  saveGatewayEcourtRule,
  saveGatewayEcourtThresholds,
} from "@/server/modules/aleta-bot/whatsapp-gateway-client";
import { requireActorUser } from "@/server/modules/organization/service";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await requireActorUser(db, actorUserId);

    const [hasil, agenda] = await Promise.all([getGatewayEcourtSettings(), getGatewayAgendaSettings()]);
    if (!hasil.ok) {
      return ok({ available: false, message: hasil.error || "ALETA Bot belum dapat dihubungi.", pengaturan: null, agenda: [] });
    }
    return ok({
      available: true,
      message: "",
      pengaturan: hasil.data?.pengaturan ?? null,
      // Padanan agenda dibaca bersamaan supaya tab tidak perlu dua panggilan.
      // Kegagalannya tidak membatalkan apa pun - daftar kosong lebih baik
      // daripada seluruh halaman gagal tampil.
      agenda: agenda.ok ? (agenda.data?.agenda ?? []) : [],
    });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "ECOURT_SETTINGS_READ_FAILED",
      feature: "ecourt",
      entityId: "pengaturan",
    });
  }
}

/**
 * Menyimpan pengaturan e-Court.
 *
 * Nama pelaku SELALU diambil dari akun yang sedang login, tidak pernah dari
 * badan permintaan — jejak siapa yang mengubah aturan pemberitahuan pengadilan
 * tidak boleh bisa ditulis sendiri oleh pemanggil.
 */
export async function POST(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    const actor = await requireActorUser(db, actorUserId);

    const body = (await request.json()) as {
      aksi?: string;
      key?: string;
      patterns?: string[];
      ringkasan?: string;
      tindakan?: string;
      audience?: string;
      notify?: boolean;
      persiapan?: string[];
      ambangMendesakHari?: number;
      tanyaUlangHari?: number;
      nomor?: string;
      namaPihak?: string;
    };

    const olehSiapa = actor.name;
    let hasil;

    switch (body.aksi) {
      case "simpan-aturan":
        hasil = await saveGatewayEcourtRule({
          key: String(body.key || ""),
          patterns: Array.isArray(body.patterns) ? body.patterns : [],
          ringkasan: body.ringkasan,
          tindakan: body.tindakan,
          audience: body.audience,
          notify: body.notify,
          olehSiapa,
        });
        break;
      case "hapus-aturan":
        hasil = await deleteGatewayEcourtRule({ key: String(body.key || ""), olehSiapa });
        break;
      case "simpan-agenda":
        hasil = await saveGatewayAgendaRule({
          key: String(body.key || ""),
          patterns: Array.isArray(body.patterns) ? body.patterns : [],
          persiapan: Array.isArray(body.persiapan) ? body.persiapan : [],
          olehSiapa,
        });
        break;
      case "hapus-agenda":
        hasil = await deleteGatewayAgendaRule({ key: String(body.key || ""), olehSiapa });
        break;
      case "simpan-ambang":
        hasil = await saveGatewayEcourtThresholds({
          ambangMendesakHari: Number(body.ambangMendesakHari),
          tanyaUlangHari: Number(body.tanyaUlangHari),
          olehSiapa,
        });
        break;
      case "tanya-ulang-nomor":
        hasil = await resetGatewayNomor({
          nomor: String(body.nomor || ""),
          namaPihak: String(body.namaPihak || ""),
          olehSiapa,
        });
        break;
      default:
        return ok({ ok: false, alasan: "aksi_tidak_dikenali" });
    }

    if (!hasil.ok) {
      return ok({ ok: false, alasan: hasil.error || "bot_tidak_terjangkau" });
    }
    return ok(hasil.data ?? { ok: false, alasan: "tanpa_jawaban" });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "ECOURT_SETTINGS_WRITE_FAILED",
      feature: "ecourt",
      entityId: "pengaturan",
    });
  }
}
