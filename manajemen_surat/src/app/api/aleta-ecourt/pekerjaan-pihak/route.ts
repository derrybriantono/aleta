import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import { pastikanAksi } from "@/server/modules/akses/hak-peran";
import { postGatewayPekerjaanTerbaca } from "@/server/modules/aleta-bot/whatsapp-gateway-client";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ============================================================================
 * PEKERJAAN (11 Okt 2026, agen 7): KATEGORI PEKERJAAN PIHAK DARI TEKS SIPP
 * ============================================================================
 *
 *   GET ?teks=ASN Dinas Pendidikan[&teks=...]
 *     -> { tersedia, hasil: [{teks, kunci, label, asal, teksBaku, kalimat, ...}], pesan }
 *
 * Untuk lajur "Pekerjaan terbaca" di blangko Data Pihak SIPP (konten.js, blok
 * PEKERJAAN): bila petugas mengetik pekerjaan bebas yang sebenarnya PNS/PPPK/
 * TNI/POLRI/BUMN/BUMD, lajur mengusulkan teks baku SIPP. Hanya membaca - SIPP
 * diisi ekstensi atas klik petugas, Simpan ditekan petugas. Aturannya kamus
 * pekerjaan.json di bot (sama dengan kueri ABT 8510/8524/8533).
 */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanKapabilitas(db, actorUserId, "panel");
    await pastikanAksi(db, actorUserId, "status.data-pihak"); // 18 Okt 2026: matriks hak akses
    const teks = request.nextUrl.searchParams
      .getAll("teks")
      .map((t) => String(t || "").slice(0, 300))
      .slice(0, 10);
    if (!teks.length) return ok({ tersedia: true, hasil: [], pesan: "Teks pekerjaan kosong." });
    const r = await postGatewayPekerjaanTerbaca({ teks });
    if (!r.ok) return ok({ tersedia: false, hasil: [], pesan: r.error || "ALETA Bot belum dapat dihubungi." });
    return ok({ tersedia: true, hasil: Array.isArray(r.data?.hasil) ? r.data.hasil : [], pesan: "" });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "PEKERJAAN_PIHAK_BACA_FAILED",
      feature: "aleta_ecourt",
      entityId: "pekerjaan-pihak",
    });
  }
}
