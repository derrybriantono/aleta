import { type NextRequest } from "next/server";

import { gabungkanPdf } from "@/lib/gabung-pdf";
import { getDatabase } from "@/server/db/client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ok } from "@/server/shared/http";
import { readJsonBody } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Menggabung PDF hasil Cetak massal Blangko Derry menjadi satu berkas.
 *
 * Isi putusan, BAS, dan relaas memuat nama, alamat, dan NIK para pihak - rute ini TIDAK menyimpannya (tidak ke basis data,
 * tidak ke disk): menerima, menggabung di memori, memulangkan, lupa. Kewenangannya sama dengan pengubah RTF ke PDF
 * (aleta-bot/abt/pdf): kapabilitas "blangko-abt". Tidak menulis ke SIPP maupun ABT.
 */
const BATAS_BASE64_TOTAL = 28 * 1024 * 1024;
const BATAS_BERKAS = 60;

export async function POST(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanKapabilitas(db, actorUserId, "blangko-abt");

    const body = await readJsonBody<{ pdfBase64?: unknown }>(request).catch(() => ({}) as { pdfBase64?: unknown });
    const daftar = Array.isArray(body.pdfBase64) ? body.pdfBase64.map((x) => String(x || "")).filter(Boolean) : [];
    if (daftar.length === 0) return ok({ available: false, message: "Tidak ada PDF yang dikirim." });
    if (daftar.length > BATAS_BERKAS) return ok({ available: false, message: `Paling banyak ${BATAS_BERKAS} PDF sekali gabung.` });
    if (daftar.reduce((n, x) => n + x.length, 0) > BATAS_BASE64_TOTAL) return ok({ available: false, message: "PDF terlalu besar untuk digabung sekaligus." });

    const hasil = await gabungkanPdf(daftar.map((x) => new Uint8Array(Buffer.from(x, "base64"))));
    return ok({ available: true, message: "", pdfBase64: Buffer.from(hasil.pdf).toString("base64"), halaman: hasil.halaman, gagal: hasil.gagal });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "PDF_GABUNG_FAILED",
      feature: "abt_cetak",
    });
  }
}
