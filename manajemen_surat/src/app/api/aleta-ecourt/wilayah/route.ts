import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import { getGatewayWilayahSipp } from "@/server/modules/aleta-bot/whatsapp-gateway-client";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Kode wilayah Kemendagri bertitik: "72", "72.03", "72.03.08", "72.03.08.1020". */
const POLA_KODE = /^\d{2}(?:\.\d{2}(?:\.\d{2}(?:\.\d{4})?)?)?$/;

/**
 * Wilayah SIPP bertingkat - Provinsi > Kabupaten/Kota > Kecamatan > Kelurahan/Desa.
 *
 * Perbaikan 2 Okt 2026 butir 16 (kontrak K5): ekstensi mengisi blangko SIPP
 * "Tambah Referensi Data Pihak" dari foto KTP, dan wilayahnya HARUS wilayah
 * yang ada di basis data SIPP - bukan teks hasil baca yang diketik apa adanya.
 *
 *   GET ?induk=        anak satu wilayah (kosong = daftar provinsi)
 *   GET ?kode=72.03.08 rantai provinsi > ... > kode itu (usulan menurut NIK)
 *
 * Tiap baris: { kode, nama, nilaiSipp } - nilaiSipp adalah nilai <option>
 * bersandi yang SAMA bentuknya dengan yang dicetak SIPP sendiri, null bila
 * penyandi SIPP di bot belum siap (lihat `sandi`). Hanya membaca; tidak ada
 * yang dicatat selain kegagalan.
 */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanKapabilitas(db, actorUserId, "panel");

    const kode = String(request.nextUrl.searchParams.get("kode") || "").trim();
    const induk = String(request.nextUrl.searchParams.get("induk") || "").trim();
    if (kode && !POLA_KODE.test(kode)) {
      return ok({ available: true, ok: false, alasan: "Kode wilayah tidak sah." });
    }
    if (induk && !POLA_KODE.test(induk)) {
      return ok({ available: true, ok: false, alasan: "Kode wilayah induk tidak sah." });
    }

    const hasil = await getGatewayWilayahSipp(kode ? { kode } : { induk });
    if (!hasil.ok) {
      // Bot menjawab dengan penolakan JSON (masukan/SIPP) = tersedia tetapi
      // gagal; tanpa status = bot tidak terjangkau.
      return ok({
        available: hasil.status !== undefined && hasil.status < 500 && Boolean(hasil.kode),
        ok: false,
        alasan: hasil.error || "ALETA Bot belum dapat dihubungi.",
      });
    }
    return ok({ available: true, ...(hasil.data as Record<string, unknown>) });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "SIPP_WILAYAH_READ_FAILED",
      feature: "aleta_ecourt",
    });
  }
}
