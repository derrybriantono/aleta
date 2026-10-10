import { NextResponse, type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { bacaRekapKasir, pastikanHakKasir } from "@/server/modules/aleta-ecourt/kasir-otomatis";
import { buatPdfRekapKasir } from "@/server/modules/aleta-ecourt/kasir-rekap-pdf";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Rekap pengeluaran kasir sebagai PDF (1.189.x butir 5).
 *
 *   GET ?periode=...&tanggal=...   application/pdf (unduhan)
 *
 * Penolakan isi (rekap tidak terbaca) dijawab ok({ ok:false, alasan }) seperti
 * rute JSON lain - layar membaca keduanya dari Content-Type.
 */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    const aktor = await pastikanHakKasir(db, actorUserId);
    const q = request.nextUrl.searchParams;
    const hasil = await bacaRekapKasir(String(q.get("periode") || "harian"), String(q.get("tanggal") || ""));
    if (!hasil.ok) return ok({ available: false, ok: false, alasan: hasil.alasan });
    const isi = await buatPdfRekapKasir(hasil.rekap, { dibuat: new Date(), olehNama: String(aktor.name || "") });
    const nama = `Rekap kasir ${hasil.rekap.periode} ${hasil.rekap.dari}${hasil.rekap.dari !== hasil.rekap.sampai ? ` sd ${hasil.rekap.sampai}` : ""}.pdf`;
    return new NextResponse(Buffer.from(isi), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${nama}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "SIPP_KASIR_REKAP_PDF_FAILED",
      feature: "aleta_ecourt",
    });
  }
}
