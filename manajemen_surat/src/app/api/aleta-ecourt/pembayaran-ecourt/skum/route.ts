import { NextResponse, type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { getGatewayPembayaranEcourt } from "@/server/modules/aleta-bot/whatsapp-gateway-client";
import { pastikanHakKasir } from "@/server/modules/aleta-ecourt/kasir-otomatis";
import { buatPdfSkumEcourt } from "@/server/modules/aleta-ecourt/skum-ecourt-pdf";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { appendAuditLog } from "@/server/shared/audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { nextPrefixedId } from "@/server/shared/ids";
import { ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* === KASIR REKENING-SKUM 3 Nov === */
/**
 * e-SKUM e-Court satu perkara sebagai PDF utuh (Kasir 3 Nov 2026).
 *
 *   GET ?nomor=1/Pdt.G/2026/PA.Dgl&kertas=A4|F4   application/pdf (unduhan)
 *
 * Isinya sama dengan kotak "Lihat SKUM" e-Court (dibaca jembatan e-Court dari halaman detil pendaftaran),
 * disusun ulang supaya kolom JUMLAH tidak terpotong (skum-ecourt-pdf.ts). Hak: Kasir (pastikanHakKasir -
 * kasir/bendahara/analis keuangan, panitera, panitera muda, Admin, Super Admin); e-SKUM memuat alamat dan
 * telepon pembayar. Belum terbaca = ok({ ok:false, alasan }) berbahasa petugas, seperti rute rekap PDF.
 */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanHakKasir(db, actorUserId);
    const q = request.nextUrl.searchParams;
    const nomor = String(q.get("nomor") || "").trim().slice(0, 80);
    const kertas = String(q.get("kertas") || "").toUpperCase() === "F4" ? "F4" : "A4";
    if (!nomor) return ok({ available: true, ok: false, alasan: "Nomor perkara wajib diisi." });

    const hasil = await getGatewayPembayaranEcourt([nomor]);
    if (!hasil.ok || !hasil.data || hasil.data.ok === false) {
      return ok({ available: false, ok: false, alasan: "e-Court belum dapat dibaca saat ini. Coba lagi beberapa saat lagi." });
    }
    const p = Object.values(hasil.data.perkara || {})[0];
    if (!p || !p.skum || !Array.isArray(p.skum.rincian) || !p.skum.rincian.length) {
      return ok({
        available: true,
        ok: false,
        alasan: p
          ? "e-SKUM perkara ini belum terbaca dari e-Court. Tekan \"Tarik data\" di halaman perkara SIPP, tunggu sebentar, lalu cetak lagi."
          : "Perkara ini belum tercatat membayar lewat e-Court (atau belum ditarik dari e-Court).",
      });
    }
    const isi = await buatPdfSkumEcourt(p.skum, { kertas, nomorPerkara: nomor });
    await appendAuditLog(db, {
      id: await nextPrefixedId(db, "audit_logs", "adt"),
      actorUserId,
      action: "ECOURT_SKUM_DICETAK",
      entityType: "perkara",
      entityId: nomor,
      payload: { nomorPerkara: nomor, kertas },
    }).catch(() => undefined);
    const nama = `e-SKUM ${nomor.replace(/[\\/:*?"<>|]+/g, "-")}.pdf`;
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
      action: "ECOURT_SKUM_PDF_FAILED",
      feature: "aleta_ecourt",
      entityId: "pembayaran-ecourt-skum",
    });
  }
}
/* === AKHIR KASIR REKENING-SKUM === */
