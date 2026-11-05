import { NextRequest } from "next/server";

import { ApiError } from "@/server/shared/errors";

/**
 * Memanggil RUTE YANG SUDAH ADA di dalam proses dengan sesi yang sama (tanpa menyalin logikanya): rute PDF (LibreOffice, SALINAN,
 * tanda tangan, cap, garis Z, nomor halaman) dan rute PDF SALINAN dari PDF kosong. Dipakai layar cetak (Tahap 5) dan tombol
 * Selesaikan berkas (Tahap 6). Metode rute-rute itu tidak diubah.
 */

export type JawabanRutePdf = {
  available?: boolean;
  kode?: string;
  message?: string;
  pdfBase64?: string;
  byte?: number;
  versiMesin?: string;
  salinan?: unknown;
  zcross?: { diubah?: boolean; halamanZ?: number; jumlahHalamanBukti?: number; nomorBagianBerikut?: number | null; bawaan?: boolean; peringatan?: string[] };
  runut?: { awal?: number; akhir?: number; peringatan?: string[] };
};

export async function panggilRute(request: NextRequest, path: string, rute: (r: NextRequest) => Promise<Response>, badan: Record<string, unknown>): Promise<JawabanRutePdf> {
  const kepala = new Headers(request.headers);
  kepala.set("content-type", "application/json");
  kepala.delete("content-length");
  const dalam = new NextRequest(new URL(path, request.url), { method: "POST", headers: kepala, body: JSON.stringify(badan) });
  const res = await rute(dalam);
  const isi = (await res.json().catch(() => null)) as { ok?: boolean; data?: JawabanRutePdf } | null;
  if (!res.ok || !isi || isi.ok === false) throw new ApiError(res.status || 502, "PDF tidak dapat dibuat.");
  return isi.data ?? {};
}

/** Rute PDF (LibreOffice, SALINAN, tanda tangan, cap, Z, nomor halaman). Metodenya tidak diubah. */
export async function pdfLewatRuteAbt(request: NextRequest, rtf: Buffer, salinan: boolean) {
  const { POST } = await import("@/app/api/aleta-bot/abt/pdf/route");
  return panggilRute(request, "/api/aleta-bot/abt/pdf", POST, { rtfBase64: rtf.toString("base64"), salinan });
}

/** PDF SALINAN dari PDF yang masih kosong (keputusan 215): rute yang sama dengan ekstensi. */
export async function salinanDariPdfLewatRute(request: NextRequest, pdf: Buffer) {
  const { POST } = await import("@/app/api/aleta-ecourt/putusan/salinan-dari-pdf/route");
  return panggilRute(request, "/api/aleta-ecourt/putusan/salinan-dari-pdf", POST, { pdfBase64: pdf.toString("base64") });
}
