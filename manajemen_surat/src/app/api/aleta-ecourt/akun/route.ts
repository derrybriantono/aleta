import { type NextRequest } from "next/server";

import { isPrivilegedAdmin } from "@/lib/permissions";
import { getDatabase } from "@/server/db/client";
import {
  getGatewayEcourtAkun,
  getGatewayKeadaanAkun,
  hapusGatewayKredensial,
  simpanGatewayKredensial,
  hapusGatewayEcourtAkun,
  simpanGatewayEcourtAkun,
} from "@/server/modules/aleta-bot/whatsapp-gateway-client";
import { requireActorUser } from "@/server/modules/organization/service";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ApiError } from "@/server/shared/errors";
import { ok } from "@/server/shared/http";
import { readJsonBody } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Akun e-Court yang dipakai bergiliran.
 *
 * ============================================================================
 * HANYA SUPER ADMIN DAN ADMIN
 * ============================================================================
 *
 * Daftar ini menyebutkan akun e-Court mana saja yang dimiliki pengadilan dan
 * mana yang sesinya sedang hidup. Itu keterangan pengelolaan, bukan keterangan
 * perkara - dan menghapus satu akun ikut menghapus sesinya, yang berarti
 * seseorang harus login ulang dengan captcha.
 *
 * ============================================================================
 * GET dan POST TIDAK MEMBAWA SANDI. PUT MEMBAWANYA.
 * ============================================================================
 *
 * GET dan POST hanya menyangkut nama slot dan labelnya - tidak ada sandi di
 * sana. PUT lain: ia membawa surel dan sandi e-Court untuk disimpan tersandi
 * di server, supaya formulir login dapat terisi sendiri dan yang tersisa bagi
 * petugas hanyalah captcha.
 *
 * Captcha tetap diisi manusia. Itu tidak berubah, dan memang tidak boleh
 * berubah.
 *
 * Sandi yang masuk lewat PUT tidak pernah dapat dibaca kembali: tidak ada rute
 * yang mengembalikannya, bahkan dalam bentuk tersandi.
 */
async function pastikanAdmin(db: Awaited<ReturnType<typeof getDatabase>>, actorUserId: string | null) {
  const actor = await requireActorUser(db, actorUserId);
  if (!isPrivilegedAdmin(actor)) {
    throw new ApiError(403, "Hanya Super Admin dan Admin yang dapat mengatur akun e-Court.");
  }
  return actor;
}

export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanAdmin(db, actorUserId);

    // ?keadaan=1 meminta keadaan sesi tiap akun, bukan sekadar daftarnya.
    // ?periksa=penuh memaksa pemeriksaan sungguhan - Chrome dinyalakan untuk
    // tiap akun, berurutan. Tanpa itu yang dipakai hasil pemeriksaan terakhir.
    if (request.nextUrl.searchParams.get("keadaan") === "1") {
      const penuh = request.nextUrl.searchParams.get("periksa") === "penuh";
      const keadaan = await getGatewayKeadaanAkun(penuh);
      if (!keadaan.ok) {
        return ok({
          available: false,
          message: keadaan.error || "ALETA Bot belum dapat dihubungi.",
          akun: [],
        });
      }
      return ok({
        available: true,
        akun: keadaan.data?.akun ?? [],
        segarDetik: keadaan.data?.segarDetik ?? 0,
      });
    }

    const hasil = await getGatewayEcourtAkun();
    if (!hasil.ok) {
      return ok({
        available: false,
        message: hasil.error || "ALETA Bot belum dapat dihubungi.",
        akun: [],
      });
    }
    return ok({ available: true, akun: hasil.data?.akun ?? [] });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "ECOURT_AKUN_READ_FAILED",
      feature: "aleta_ecourt",
    });
  }
}

export async function POST(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    const actor = await pastikanAdmin(db, actorUserId);

    const body = await readJsonBody<{
      tindakan?: string;
      slot?: string;
      label?: string;
      aktif?: boolean;
    }>(request);

    const slot = String(body.slot || "").trim();
    if (!slot) return ok({ available: true, ok: false, alasan: "slot_kosong" });

    const hasil =
      String(body.tindakan || "") === "hapus"
        ? await hapusGatewayEcourtAkun({ slot, olehSiapa: actor.name })
        : await simpanGatewayEcourtAkun({
            slot,
            label: String(body.label || slot),
            aktif: body.aktif !== false,
            olehSiapa: actor.name,
          });

    if (!hasil.ok) {
      return ok({
        available: false,
        ok: false,
        message: hasil.error || "ALETA Bot belum dapat dihubungi.",
      });
    }
    return ok({ available: true, ...(hasil.data ?? { ok: false }) });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "ECOURT_AKUN_UPDATE_FAILED",
      feature: "aleta_ecourt",
    });
  }
}

/**
 * Menyimpan surel dan sandi satu akun untuk pengisian otomatis.
 *
 * ============================================================================
 * BADAN PERMINTAAN INI MEMUAT SANDI
 * ============================================================================
 *
 * Tidak ada satu pun bagian badan permintaan yang boleh dicatat: bukan ke log,
 * bukan ke jejak audit, bukan ke pesan galat. Yang dicatat hanya bahwa sandi
 * satu slot diperbarui, dan oleh siapa - itu dikerjakan di dalam bot.
 *
 * Sandi yang sampai ke bot disandi di sana dan tidak pernah dikembalikan.
 * Tidak ada rute yang dapat membacanya kembali.
 */
export async function PUT(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    const actor = await pastikanAdmin(db, actorUserId);

    const body = await readJsonBody<{ slot?: string; email?: string; sandi?: string }>(request);

    const hasil = await simpanGatewayKredensial({
      slot: String(body?.slot || ""),
      email: String(body?.email || ""),
      sandi: String(body?.sandi || ""),
      olehSiapa: `portal:${actor.email || actor.id}`,
    });

    if (!hasil.ok) {
      return ok({ available: false, message: hasil.error || "ALETA Bot belum dapat dihubungi." });
    }
    if (!hasil.data?.ok) {
      return ok({ available: true, ok: false, alasan: String(hasil.data?.alasan || "gagal") });
    }
    return ok({ available: true, ok: true, message: "Surel dan sandi tersimpan." });
  } catch (error) {
    // Galat sengaja TIDAK membawa badan permintaan - lihat catatan di atas.
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "ECOURT_KREDENSIAL_SIMPAN_FAILED",
      feature: "ecourt",
      entityId: "kredensial",
    });
  }
}

/** Menghapus simpanan sandi satu akun. */
export async function DELETE(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    const actor = await pastikanAdmin(db, actorUserId);

    const slot = String(request.nextUrl.searchParams.get("slot") || "").trim();
    const hasil = await hapusGatewayKredensial(slot, `portal:${actor.email || actor.id}`);

    if (!hasil.ok) {
      return ok({ available: false, message: hasil.error || "ALETA Bot belum dapat dihubungi." });
    }
    return ok({
      available: true,
      ok: hasil.data?.ok === true,
      alasan: String(hasil.data?.alasan || ""),
    });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "ECOURT_KREDENSIAL_HAPUS_FAILED",
      feature: "ecourt",
      entityId: "kredensial",
    });
  }
}
