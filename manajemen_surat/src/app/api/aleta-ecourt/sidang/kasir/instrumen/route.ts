import { NextResponse, type NextRequest } from "next/server";

import { kelompokkanInstrumen, namaBerkasAman, type BarisInstrumen } from "@/lib/kasir-cetak";
import { getDatabase } from "@/server/db/client";
import { buatPdfInstrumen } from "@/server/modules/aleta-ecourt/kasir-cetak-pdf";
import { pastikanHakKasir } from "@/server/modules/aleta-ecourt/kasir-otomatis";
import { panggilBotJadwalSidang } from "@/server/modules/aleta-ecourt/jadwal-sidang-gateway";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* === KASIR PSP-INSTRUMEN 3 Nov === */
/**
 * Instrumen biaya panggilan & PBT per JURUSITA (Kasir 3 Nov 2026) - otomatis dari jurnal keuangan SIPP.
 *
 *   GET ?dari&sampai                                   -> JSON { ok, dari, sampai, kelompok[{kunci, jurusita, baris[], total}] }
 *   GET ?dari&sampai&kunci=js-<id>&bentuk=pdf&kertas   -> PDF SATU jurusita (dicetak terpisah per jurusita)
 *
 * Hak: Kasir (pastikanHakKasir - kasir/bendahara/analis keuangan, panitera, panitera muda, admin).
 */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanHakKasir(db, actorUserId);
    const q = request.nextUrl.searchParams;
    const kueri = new URLSearchParams({ dari: String(q.get("dari") || ""), sampai: String(q.get("sampai") || q.get("dari") || "") });
    const hasil = await panggilBotJadwalSidang<{ ok: boolean; alasan?: string; dari: string; sampai: string; daftar: BarisInstrumen[]; terpotong?: boolean }>(
      `/kasir/instrumen?${kueri.toString()}`,
      { timeoutMs: 30_000 }
    );
    if (!hasil.ok || !hasil.data || hasil.data.ok !== true) {
      const alasan = hasil.ok ? hasil.data?.alasan : "";
      return ok({ available: false, ok: false, alasan: alasan || "Instrumen jurusita belum dapat dibaca dari SIPP. Coba lagi beberapa saat lagi." });
    }
    const { dari, sampai } = hasil.data;
    const kelompok = kelompokkanInstrumen(Array.isArray(hasil.data.daftar) ? hasil.data.daftar : []);
    if (q.get("bentuk") !== "pdf") return ok({ available: true, ok: true, dari, sampai, kelompok, terpotong: Boolean(hasil.data.terpotong) });
    const pilih = kelompok.find((k) => k.kunci === String(q.get("kunci") || ""));
    if (!pilih) return ok({ available: true, ok: false, alasan: "Jurusita itu tidak punya biaya panggilan/PBT pada tanggal ini." });
    const isi = await buatPdfInstrumen(pilih, { dari, sampai, kertas: String(q.get("kertas") || "").toUpperCase() === "F4" ? "F4" : "A4" });
    const nama = namaBerkasAman(`Instrumen ${pilih.jurusita} ${dari}${dari !== sampai ? ` sd ${sampai}` : ""}.pdf`);
    return new NextResponse(Buffer.from(isi), {
      status: 200,
      headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${nama}"`, "Cache-Control": "no-store" },
    });
  } catch (error) {
    return handleAdminRouteError(error, request, { db, actorUserId, action: "SIPP_KASIR_INSTRUMEN_FAILED", feature: "aleta_ecourt" });
  }
}
/* === AKHIR KASIR PSP-INSTRUMEN === */
