import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import {
  getGatewayRubrikPengaturan,
  simpanGatewayRubrikPengaturan,
} from "@/server/modules/aleta-bot/whatsapp-gateway-client";
import { pastikanAdminIstimewa, pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { requireActorUser } from "@/server/modules/organization/service";
import { ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ============================================================================
 * RUBRIK PENILAIAN PERKARA - BOBOT DAN AMBANG PREDIKAT
 * ============================================================================
 *
 * Tercatat sejak 1.31.0 sebagai keterbatasan: "Bobot skor ditetapkan aplikasi
 * dan belum dapat diubah pengadilan." Mesinnya sudah lama dapat membacanya
 * dari pengaturan - yang tidak pernah ada jalan dari portal menuju ke sana.
 *
 * Akibatnya satu-satunya cara mengubah bobot adalah menyunting berkas
 * pengaturan di dalam container, dan itu sama saja dengan tidak dapat diubah.
 *
 * ============================================================================
 * MEMBACA CUKUP "panel", MENGUBAH MENUNTUT ADMIN ISTIMEWA
 * ============================================================================
 *
 * Membacanya keterangan biasa: siapa pun yang melihat nilai perkara berhak
 * tahu bobot apa yang menyusunnya dan pada angka berapa ia disebut "kurang".
 * Angka tanpa aturannya tidak dapat diperiksa siapa pun.
 *
 * Mengubahnya lain sama sekali. Bobot menentukan bagaimana angka tersusun;
 * ambang menentukan perkara SIAPA yang disebut kurang. Satu perubahan angka
 * di sini menggeser penilaian seluruh perkara sekaligus, surut ke belakang,
 * tanpa satu pun berkas berubah. Itu kewenangan pimpinan, bukan kewenangan
 * siapa saja yang kebetulan dapat membuka layarnya.
 */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanKapabilitas(db, actorUserId, "panel");

    const hasil = await getGatewayRubrikPengaturan();
    if (!hasil.ok) {
      return ok({
        available: false,
        ok: false,
        alasan: hasil.error || "ALETA Bot belum dapat dihubungi.",
      });
    }

    return ok({ available: true, ...(hasil.data as Record<string, unknown>) });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "RUBRIK_PENILAIAN_READ_FAILED",
      feature: "aleta_ecourt",
      entityId: "rubrik",
    });
  }
}

export async function POST(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanAdminIstimewa(db, actorUserId, "mengubah rubrik penilaian perkara");

    const badan = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const bobotMentah = (badan.bobot ?? {}) as Record<string, unknown>;

    const bobot: Record<string, number> = {};
    for (const [kunci, nilai] of Object.entries(bobotMentah)) {
      const angka = Number(nilai);
      if (Number.isFinite(angka)) bobot[kunci] = angka;
    }

    // Nama pengubahnya diambil dari sesi, BUKAN dari badan permintaan. Yang
    // dikirim layar dapat ditulis apa saja; yang tercatat harus orang yang
    // benar-benar masuk.
    const aktor = await requireActorUser(db, actorUserId);

    const hasil = await simpanGatewayRubrikPengaturan({
      bulanPenuh: Number(badan.bulanPenuh),
      bulanNol: Number(badan.bulanNol),
      hariMinutasi: Number(badan.hariMinutasi),
      ambangBaik: Number(badan.ambangBaik),
      ambangPerhatian: Number(badan.ambangPerhatian),
      bobot,
      olehSiapa: String(aktor.name || aktor.id || ""),
    });

    if (!hasil.ok) {
      return ok({
        available: false,
        ok: false,
        alasan: hasil.error || "ALETA Bot belum dapat dihubungi.",
      });
    }

    return ok({ available: true, ...(hasil.data as Record<string, unknown>) });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "RUBRIK_PENILAIAN_SIMPAN_FAILED",
      feature: "aleta_ecourt",
      entityId: "rubrik",
    });
  }
}
