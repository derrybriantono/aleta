import { type NextRequest } from "next/server";

import { GOLONGAN_BAGI } from "@/lib/kalimat-pribadi";
import { getDatabase } from "@/server/db/client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import { hapusKalimat, kalimatMilik, kalimatUntuk, pakaiKalimat, simpanKalimat } from "@/server/modules/aleta-ecourt/kalimat-pribadi";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ApiError } from "@/server/shared/errors";
import { ok } from "@/server/shared/http";
import { getSearchParam } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ============================================================================
 * PUSTAKA KALIMAT PRIBADI (30 Okt 2026, migrasi 0121)
 * ============================================================================
 *
 *   GET ?jenis=&status=&kode=      kalimat yang berlaku untuk konteks itu (milik sendiri + dibagikan kepada golongan akun), urut kecocokan
 *   GET ?milik=1                   semua kalimat milik akun ini (mengelola)
 *   POST {aksi:"simpan", id?, jenisPerkara, status, kode, judul, teks, dibagikan:[golongan]}
 *   POST {aksi:"pakai", id}        mencatat satu pemakaian (dasar urutan "paling sering dipakai")
 *   POST {aksi:"hapus", id}        hanya pemilik
 *
 * Kewenangan "blangko-abt" (sama dengan menyunting isian). Tidak menulis ke SIPP/ABT.
 */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    const actor = await pastikanKapabilitas(db, actorUserId, "blangko-abt");
    if (getSearchParam(request, "milik") === "1") return ok({ kalimat: await kalimatMilik(db, actor), golonganBagi: GOLONGAN_BAGI });
    const kalimat = await kalimatUntuk(db, actor, {
      jenisPerkara: String(getSearchParam(request, "jenis") ?? ""),
      status: String(getSearchParam(request, "status") ?? ""),
      kode: String(getSearchParam(request, "kode") ?? ""),
    });
    return ok({ kalimat, golonganBagi: GOLONGAN_BAGI });
  } catch (error) {
    return handleAdminRouteError(error, request, { db, actorUserId, action: "KALIMAT_PRIBADI_BACA_FAILED", feature: "aleta_ecourt", entityId: "kalimat-pribadi" });
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
    const aksi = String(badan.aksi ?? "simpan");
    if (aksi === "simpan") return ok({ kalimat: await simpanKalimat(db, actor, badan) });
    if (aksi === "pakai") return ok({ dicatat: await pakaiKalimat(db, actor, String(badan.id ?? "")) });
    if (aksi === "hapus") return ok({ dihapus: await hapusKalimat(db, actor, String(badan.id ?? "")) });
    throw new ApiError(400, "Aksi tidak dikenal.");
  } catch (error) {
    return handleAdminRouteError(error, request, { db, actorUserId, action: "KALIMAT_PRIBADI_TULIS_FAILED", feature: "aleta_ecourt", entityId: "kalimat-pribadi" });
  }
}
