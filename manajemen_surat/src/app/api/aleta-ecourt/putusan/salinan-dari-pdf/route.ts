import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { ambilGambarTandaTangan, getGatewayTandaTangan } from "@/server/modules/aleta-bot/whatsapp-gateway-client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import { pilihCap } from "@/server/modules/aleta-ecourt/penetapan-edoc";
import { SalinanPdfDitolak, buatSalinanDariPdf } from "@/server/modules/aleta-ecourt/salinan-dari-pdf";
import { ukuranTtdCapBerlaku } from "@/server/modules/aleta-ecourt/ukuran-ttd-cap";
import { ukuranUntukBot } from "@/lib/ukuran-ttd-cap";
import { bacaSatkerAktif } from "@/server/modules/satker/identitas";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ok } from "@/server/shared/http";
import { readJsonBody } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * PDF SALINAN dari PDF yang masih kosong (5 Nov 2026): berkas PDF masuk, PDF SALINAN keluar.
 *
 *   POST JSON { pdfBase64 }
 *   -> { available: true, pdfBase64, byte, salinan: { jenis: "putusan-pdf", salinan, ttdDitambah, ttdSudahAda, namaPanitera,
 *        gambarTtdPanitera, alasanTanpaGambar, capPanitera, blokHalamanBaru } }
 *   -> { available: false, kode, message }  (ditolak dengan sebab bahasa Indonesia; tidak pernah salinan separuh)
 *
 * Satu rute untuk semua pemanggil (ekstensi: Isian SIPP dan Blangko Derry; portal: ALETA ABT) - tanpa bergantung pada kode panel.
 * Masukan lain TIDAK dibutuhkan: nama pengadilan dibaca dari Identitas satker, Panitera pengesah dan gambar tanda tangan serta cap
 * dari tanda tangan sah di bot, ukuran dari pengaturan ukuran tanda tangan. Penjagaan hak SAMA dengan rute PDF (kapabilitas
 * blangko-abt). Tidak menyimpan apa pun: berkas masuk, PDF keluar, dilupakan; tidak ada tulisan ke SIPP/ABT.
 */
const BATAS_BASE64 = 28 * 1024 * 1024;

export async function POST(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanKapabilitas(db, actorUserId, "blangko-abt");

    const body = await readJsonBody<{ pdfBase64?: unknown }>(request).catch(() => ({}) as { pdfBase64?: unknown });
    const pdfBase64 = String(body.pdfBase64 || "");
    if (!pdfBase64) return ok({ available: false, kode: "bukan_pdf", message: "Berkas PDF tidak terkirim." });
    if (pdfBase64.length > BATAS_BASE64) return ok({ available: false, kode: "terlalu_besar", message: "Berkas PDF terlalu besar untuk dijadikan salinan." });

    const aktif = db;
    try {
      const hasil = await buatSalinanDariPdf(new Uint8Array(Buffer.from(pdfBase64, "base64")), {
        namaPengadilan: async () => (await bacaSatkerAktif(aktif)).namaPengadilan,
        daftarTtdSah: async () => {
          const r = (await getGatewayTandaTangan(true)) as { ok?: boolean; baris?: Array<Record<string, unknown>> } | null;
          if (!r || r.ok === false) throw new SalinanPdfDitolak("pengesah_tidak_ada", "Daftar tanda tangan belum dapat dibaca, jadi Panitera pengesah tidak dapat ditentukan dan salinan tidak dibuat.");
          return (r.baris ?? [])
            .filter((b) => b && b.disahkan !== false)
            .map((b) => ({ id: Number(b.id), namaPejabat: String(b.namaPejabat ?? ""), jabatan: String(b.jabatan ?? "") }));
        },
        gambarTtd: async (id) => {
          const respons = await ambilGambarTandaTangan(id);
          return respons.ok ? new Uint8Array(await respons.arrayBuffer()) : null;
        },
        cap: async () => {
          const c = await pilihCap(aktif, "ppp", null);
          return c ? new Uint8Array(c.isi) : null;
        },
        atur: ukuranUntukBot(await ukuranTtdCapBerlaku(aktif)),
      });
      return ok({ available: true, message: "", pdfBase64: Buffer.from(hasil.pdf).toString("base64"), byte: hasil.pdf.length, salinan: hasil.keterangan });
    } catch (galat) {
      if (galat instanceof SalinanPdfDitolak) return ok({ available: false, kode: galat.kode, message: galat.message });
      throw galat;
    }
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "PUTUSAN_SALINAN_DARI_PDF_GAGAL",
      feature: "abt_cetak",
    });
  }
}
