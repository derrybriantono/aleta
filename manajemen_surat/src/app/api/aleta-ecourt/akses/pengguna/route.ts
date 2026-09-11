import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import {
  KETERANGAN_KAPABILITAS,
  bacaSemuaPengecualian,
  cariPenggunaUntukPengecualian,
  pastikanAdminIstimewa,
  simpanPengecualianPengguna,
} from "@/server/modules/aleta-ecourt/akses";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ok } from "@/server/shared/http";
import { readJsonBody } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Pengecualian akses ekstensi untuk satu orang.
 *
 * ============================================================================
 * HANYA SUPER ADMIN DAN ADMIN, BAHKAN UNTUK MEMBACANYA
 * ============================================================================
 *
 * Berbeda dari rute akses per peran - yang menjawab "saya boleh apa" kepada
 * siapa saja - rute ini tidak punya jawaban bagi pengguna biasa sama sekali.
 * Daftar siapa yang dikecualikan pada kemampuan apa adalah keterangan
 * kepegawaian: ia menyebut nama orang beserta kewenangan yang berbeda dari
 * rekan sejabatannya, dan tidak ada seorang staf pun yang perlu tahu itu.
 *
 * ============================================================================
 * MENCARI, BUKAN MENDAFTAR SEMUA
 * ============================================================================
 *
 * GET tanpa kata kunci menjawab daftar orang yang SUDAH punya pengecualian -
 * itu yang perlu dibaca administrator ketika membuka halamannya. GET dengan
 * `cari` menjawab hasil pencarian pegawai, dipakai ketika hendak memberi
 * pengecualian baru kepada seseorang.
 */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanAdminIstimewa(db, actorUserId, "melihat pengecualian akses ekstensi");

    const cari = String(request.nextUrl.searchParams.get("cari") || "").trim();

    if (cari) {
      return ok({
        available: true,
        cari,
        hasil: await cariPenggunaUntukPengecualian(db, cari),
        keterangan: KETERANGAN_KAPABILITAS,
      });
    }

    return ok({
      available: true,
      cari: "",
      pengecualian: await bacaSemuaPengecualian(db),
      keterangan: KETERANGAN_KAPABILITAS,
    });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "ECOURT_EXTENSION_USER_ACCESS_READ_FAILED",
      feature: "aleta_ecourt",
    });
  }
}

/**
 * Memberi, mencabut, atau mengembalikan satu pengecualian.
 *
 * `aktif` bernilai true (boleh), false (tidak boleh), atau null (ikut peran
 * kembali). Ketiganya sengaja dilewatkan satu ruas: mengembalikan seseorang ke
 * kewenangan perannya adalah perbuatan yang sama seringnya dengan memberi
 * pengecualian, dan memberinya rute tersendiri hanya menambah tempat yang
 * dapat lupa diperiksa kewenangannya.
 */
export async function PUT(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);

    const body = await readJsonBody<{
      userId?: unknown;
      kapabilitas?: unknown;
      aktif?: unknown;
      alasan?: unknown;
      berlakuSampai?: unknown;
    }>(request);

    // Hanya true, false, dan null yang diterima. Ruas yang tidak dikirim sama
    // sekali TIDAK boleh diam-diam terbaca sebagai "cabut": satu badan
    // permintaan yang salah bentuk akan mencabut pengecualian tanpa diminta.
    const mentah = body.aktif;
    if (mentah !== true && mentah !== false && mentah !== null) {
      return ok({
        available: false,
        message: 'Ruas "aktif" harus true, false, atau null (ikut peran).',
      });
    }

    const pengecualian = await simpanPengecualianPengguna(db, {
      actorUserId: String(actorUserId || ""),
      userId: String(body.userId || ""),
      kapabilitas: String(body.kapabilitas || ""),
      aktif: mentah,
      alasan: String(body.alasan || ""),
      berlakuSampai: body.berlakuSampai ? String(body.berlakuSampai) : null,
    });

    return ok({ available: true, pengecualian, keterangan: KETERANGAN_KAPABILITAS });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "ECOURT_EXTENSION_USER_ACCESS_UPDATE_FAILED",
      feature: "aleta_ecourt",
    });
  }
}
