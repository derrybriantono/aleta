import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import {
  getGatewayStatusPutusan,
  postGatewayPutusSidang,
  postGatewayTulisPutusan,
} from "@/server/modules/aleta-bot/whatsapp-gateway-client";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Penulisan putusan akhir ke SIPP.
 *
 * ============================================================================
 * TULISAN PALING BERAT YANG DIKERJAKAN ALETA
 * ============================================================================
 *
 * Yang dicatat di sini dibaca pengadilan tingkat banding, dipakai menyusun akta
 * cerai, dan dikirim ke Direktori Putusan. Penetapan menunjuk siapa yang
 * menyidangkan; penundaan memindahkan tanggal; yang ini mencatat PUTUSAN.
 *
 * Kering sebagai bawaan berlaku sama tegasnya, dan akun SIPP-nya wajib disebut:
 * nama itulah yang muncul pada audit trail, dan ALETA tidak pernah menulis atas
 * nama dirinya sendiri.
 */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanKapabilitas(db, actorUserId, "panel");

    const hasil = await getGatewayStatusPutusan();
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
      action: "SIPP_STATUS_PUTUSAN_READ_FAILED",
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
    await pastikanKapabilitas(db, actorUserId, "panel");

    const badan = (await request.json()) as Record<string, unknown>;

    // ========================================================================
    // DUA JALUR MEMUTUS, DAN KEDUANYA SAH
    // ========================================================================
    //
    // "sidang" adalah borang PANITERA SIDANG: ia mencatat bahwa hari ini
    // perkaranya diputus dan jenis putusannya apa. Amar dan pertimbangan
    // hukumnya tidak ditanyakan - aplikasi antrian sidang satker sendiri
    // mengisi amar dengan "BELUM DIINPUT", sebab naskahnya ditulis hakim
    // beberapa hari kemudian.
    //
    // Tanpa jalur ini, pencatatan putusan tertahan sampai naskahnya jadi -
    // padahal yang dibutuhkan papan antrian, laporan harian, dan akta cerai
    // adalah FAKTA bahwa perkaranya sudah diputus, hari ini.
    if (String(badan.jalur ?? "") === "sidang") {
      const respons = await postGatewayPutusSidang({
        jadwalId: badan.jadwalId,
        perkaraId: badan.perkaraId,
        statusPutusanId: badan.statusPutusanId,
        tanggalPutus: String(badan.tanggalPutus ?? ""),
        verstek: String(badan.verstek ?? ""),
        jamSekarang: String(badan.jamSekarang ?? ""),
        dihadiriOleh: badan.dihadiriOleh,
        ruangId: badan.ruangId,
        operator: actorUserId || "portal",
        kering: badan.kering !== false,
      });
      if (!respons.ok) {
        return ok({ available: false, ok: false, alasan: respons.error || "ALETA Bot belum dapat dihubungi." });
      }
      return ok({ available: true, ...(respons.data as Record<string, unknown>) });
    }

    // Jalur HAKIM - menuntut amar dan pertimbangan, dan memang seharusnya.
    const olehUsername = String(badan.olehUsername || "").trim();
    if (!olehUsername) {
      return ok({
        available: true,
        ok: false,
        alasan: "Akun SIPP yang menuliskannya wajib disebut - audit trail memakai namanya.",
      });
    }

    const hasil = await postGatewayTulisPutusan({
      perkaraId: badan.perkaraId,
      tanggalPutusan: String(badan.tanggalPutusan || ""),
      statusPutusanId: badan.statusPutusanId,
      amarPutusan: String(badan.amarPutusan || ""),
      catatanPutusan: String(badan.catatanPutusan || ""),
      sumberHukumId: String(badan.sumberHukumId || ""),
      verstek: String(badan.verstek || ""),
      pertimbanganHukum: String(badan.pertimbanganHukum || ""),
      olehUsername,
      operator: actorUserId || "portal",
      kering: badan.kering !== false,
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
      action: "SIPP_PUTUSAN_WRITE_FAILED",
      feature: "aleta_ecourt",
    });
  }
}
