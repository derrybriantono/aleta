import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import { bacaWajibBelajar, catatLaporan, usulSalinSerupa, wajibCetakAktif } from "@/server/modules/aleta-ecourt/wajib-cetak";
import { requireActorUser } from "@/server/modules/organization/service";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ApiError } from "@/server/shared/errors";
import { ok } from "@/server/shared/http";
import { getSearchParam } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ============================================================================
 * DAFTAR WAJIB SEBELUM CETAK DAN SALIN DARI PERKARA SERUPA (25 Okt 2026, rantai D butir D3 = U13)
 * ============================================================================
 *
 *   GET ?bagian=saklar        -> {aktif} (login saja; tidak membuka data apa pun)
 *   GET ?berkas=              -> isian yang BIASANYA sudah terisi saat blangko itu dicetak (kewenangan "blangko-abt")
 *   POST {aksi:"lapor", ...}  -> mencatat keadaan kelengkapan blangko (semua jenis blangko) atau saat dicetak
 *   POST {aksi:"serupa", ...} -> usulan isian dari perkara serupa yang sudah putus (hanya usulan, non-identitas)
 *
 * Saklar Fitur Satker "wajib-sebelum-cetak" bawaan MATI: mati -> {aktif:false}, tidak menulis, tidak mengusulkan.
 * Tidak ada yang ditulis ke SIPP/ABT/e-Court di sini.
 */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    const bagian = String(getSearchParam(request, "bagian") ?? "").trim();
    if (bagian === "saklar") {
      await requireActorUser(db, actorUserId);
      return ok({ aktif: await wajibCetakAktif(db) });
    }
    await pastikanKapabilitas(db, actorUserId, "blangko-abt");
    return ok(await bacaWajibBelajar(db, String(getSearchParam(request, "berkas") ?? "")));
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "WAJIB_CETAK_BACA_FAILED",
      feature: "aleta_ecourt",
      entityId: "wajib-cetak",
    });
  }
}

export async function POST(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    const actor = await pastikanKapabilitas(db, actorUserId, "blangko-abt");
    const badan = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const aksi = String(badan.aksi ?? "").trim();
    if (aksi === "lapor") return ok(await catatLaporan(db, { id: actor.id, nama: actor.name }, badan));
    if (aksi === "serupa") {
      return ok(
        await usulSalinSerupa(db, {
          perkaraId: String(badan.perkaraId ?? ""),
          nomorPerkara: String(badan.nomorPerkara ?? ""),
          jenisPerkara: String(badan.jenisPerkara ?? ""),
          fakta: badan.fakta,
          kode: badan.kode,
        })
      );
    }
    throw new ApiError(400, "Tindakan tidak dikenal.");
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "WAJIB_CETAK_TINDAK_FAILED",
      feature: "aleta_ecourt",
      entityId: "wajib-cetak",
    });
  }
}
