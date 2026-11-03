import { NextResponse, type NextRequest } from "next/server";

import { namaBerkasAman, saringRekeningPsp, type DaftarPsp } from "@/lib/kasir-cetak";
import { bolehLihatRekening } from "@/lib/pembayaran-ecourt";
import type { UserPersona } from "@/lib/types";
import { getDatabase } from "@/server/db/client";
import { buatPdfPsp } from "@/server/modules/aleta-ecourt/kasir-cetak-pdf";
import { pastikanHakKasir } from "@/server/modules/aleta-ecourt/kasir-otomatis";
import { panggilBotJadwalSidang } from "@/server/modules/aleta-ecourt/jadwal-sidang-gateway";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { appendAuditLog } from "@/server/shared/audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { nextPrefixedId } from "@/server/shared/ids";
import { ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* === KASIR PSP-INSTRUMEN 3 Nov === */
/**
 * Daftar Pengembalian Sisa Panjar (PSP) pada satu tanggal atau rentang (Kasir 3 Nov 2026).
 *
 *   GET ?dari=YYYY-MM-DD&sampai=YYYY-MM-DD                 -> JSON { ok, dari, sampai, jumlah, total, daftar[] }
 *   GET ?dari&sampai&bentuk=pdf&kertas=A4|F4               -> application/pdf (unduhan)
 *
 * Sumber: jurnal keuangan SIPP (baca saja) lewat bot (kasirCetakService). Hak: Kasir (pastikanHakKasir).
 * Rekening penerima hanya untuk pimpinan, hakim, panitera, kasir, PTSP, admin (bolehLihatRekening,
 * keputusan 171); peran Kasir lain (panitera muda) menerima daftar TANPA rekening.
 */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    const aktor = (await pastikanHakKasir(db, actorUserId)) as UserPersona;
    const q = request.nextUrl.searchParams;
    const kueri = new URLSearchParams({ dari: String(q.get("dari") || ""), sampai: String(q.get("sampai") || q.get("dari") || "") });
    const hasil = await panggilBotJadwalSidang<DaftarPsp & { ok: boolean; alasan?: string }>(`/kasir/psp?${kueri.toString()}`, { timeoutMs: 30_000 });
    if (!hasil.ok || !hasil.data || hasil.data.ok !== true) {
      const alasan = hasil.ok ? hasil.data?.alasan : "";
      return ok({ available: false, ok: false, alasan: alasan || "Daftar pengembalian sisa panjar belum dapat dibaca dari SIPP. Coba lagi beberapa saat lagi." });
    }
    const data = saringRekeningPsp(hasil.data as DaftarPsp, bolehLihatRekening(aktor));
    await appendAuditLog(db, {
      id: await nextPrefixedId(db, "audit_logs", "adt"),
      actorUserId,
      action: "SIPP_KASIR_PSP_DILIHAT",
      entityType: "kasir",
      entityId: `${data.dari}..${data.sampai}`,
      payload: { jumlah: data.jumlah, rekening: !data.rekeningDisembunyikan, pdf: q.get("bentuk") === "pdf" },
    }).catch(() => undefined);
    if (q.get("bentuk") !== "pdf") return ok({ available: true, ...data });
    const isi = await buatPdfPsp(data, { kertas: String(q.get("kertas") || "").toUpperCase() === "F4" ? "F4" : "A4" });
    const nama = namaBerkasAman(`Pengembalian sisa panjar ${data.dari}${data.dari !== data.sampai ? ` sd ${data.sampai}` : ""}.pdf`);
    return new NextResponse(Buffer.from(isi), {
      status: 200,
      headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${nama}"`, "Cache-Control": "no-store" },
    });
  } catch (error) {
    return handleAdminRouteError(error, request, { db, actorUserId, action: "SIPP_KASIR_PSP_FAILED", feature: "aleta_ecourt" });
  }
}
/* === AKHIR KASIR PSP-INSTRUMEN === */
