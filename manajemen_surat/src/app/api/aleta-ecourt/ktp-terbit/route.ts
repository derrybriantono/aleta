import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import { pastikanAksi } from "@/server/modules/akses/hak-peran";
import { bacaKtpDariBerkas } from "@/server/modules/aleta-ecourt/ktp-ocr";
import { ambilBerkasGateway, getGatewayArsipRincian } from "@/server/modules/aleta-bot/whatsapp-gateway-client";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ============================================================================
 * TANGGAL TERBIT KTP DARI BERKAS KTP e-COURT (5 Okt 2026, butir 2)
 * ============================================================================
 *
 *   GET ?nomor=556/Pdt.G/2026/PA.Dgl
 *     -> { ada, tanggal: "dd/mm/yyyy", nik, sumber: {judul, documentKey},
 *          dicoba, catatan[] }
 *
 * Variabel ABT #2222# "Tanggal KTP P / P1" (dan #0364# "Tgl. KTP #0046#")
 * bertipe data_tanggal dan selama ini diketik petugas dari fotokopi KTP.
 * Berkas KTP pihak sudah diunggah ke e-Court saat pendaftaran; ALETA
 * mengarsipkannya (aleta_bot_ecourt_documents/files). Rute ini membaca PDF
 * KTP perkara itu dengan pembaca KTP yang sama dengan "Isi dari foto KTP"
 * (ktp-ocr.ts: lapisan teks PDF lebih dulu, lalu OCR halaman) dan
 * memulangkan tanggal penerbitannya (blok kanan-bawah KTP-el).
 *
 * Diukur di server 5 Okt: 332 dokumen KTP e-Court tercatat, baru 8 yang
 * berkasnya terunduh (sisanya belum ditarik atau tidak disediakan e-Court).
 * Yang tidak ada berkasnya DISEBUT, bukan ditebak.
 *
 * Hanya membaca - tidak ada yang ditulis ke ABT di sini (penulisnya panel
 * ABT, lewat simpanVariabel, sesudah petugas mencentang).
 */
const POLA_KTP = /\b(ktp|e-?ktp|kartu\s+tanda\s+penduduk)\b/i;
const BATAS_DICOBA = 3;

export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanKapabilitas(db, actorUserId, "panel");
    await pastikanAksi(db, actorUserId, "status.data-pihak"); // 18 Okt 2026: matriks hak akses

    const nomor = String(request.nextUrl.searchParams.get("nomor") || "").trim();
    if (!nomor) return ok({ ada: false, sebab: "Nomor perkara kosong.", catatan: [] });

    const rincian = await getGatewayArsipRincian(nomor);
    if (!rincian.ok) {
      return ok({ ada: false, sebab: "Arsip e-Court perkara ini tidak terbaca dari ALETA Bot.", catatan: [] });
    }
    const semuaKtp = (rincian.data.dokumen || []).filter((d) => POLA_KTP.test(String(d.judulDokumen || "")));
    if (semuaKtp.length === 0) {
      return ok({ ada: false, sebab: "Tidak ada dokumen KTP di arsip e-Court perkara ini.", catatan: [] });
    }
    const adaBerkas = semuaKtp.filter((d) => d.adaPdf);
    if (adaBerkas.length === 0) {
      return ok({
        ada: false,
        sebab: `${semuaKtp.length} dokumen KTP tercatat di e-Court, tetapi berkasnya belum diunduh ALETA (atau tidak disediakan e-Court).`,
        catatan: [],
      });
    }

    const catatan: string[] = [];
    let dicoba = 0;
    for (const d of adaBerkas.slice(0, BATAS_DICOBA)) {
      dicoba += 1;
      const respons = await ambilBerkasGateway(d.documentKey, "pdf");
      if (!respons.ok) {
        catatan.push(`${d.judulDokumen}: berkas tidak terbaca (status ${respons.status}).`);
        continue;
      }
      const buffer = Buffer.from(await respons.arrayBuffer());
      const hasil = await bacaKtpDariBerkas(buffer, "application/pdf");
      if (!hasil.ok || !hasil.medan.tanggalTerbit) {
        catatan.push(`${d.judulDokumen}: tanggal terbit tidak terbaca${hasil.pesan ? ` (${hasil.pesan})` : ""}.`);
        continue;
      }
      return ok({
        ada: true,
        tanggal: hasil.medan.tanggalTerbit,
        kota: hasil.medan.kotaTerbit || "",
        nik: hasil.medan.nik || "",
        nama: hasil.medan.nama || "",
        sumber: { judul: d.judulDokumen, documentKey: d.documentKey, peranPengunggah: d.peranPengunggah, baca: hasil.sumber },
        dicoba,
        catatan,
      });
    }
    return ok({ ada: false, sebab: "Tanggal terbit tidak terbaca dari berkas KTP e-Court.", dicoba, catatan });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "KTP_TERBIT_BACA_FAILED",
      feature: "aleta_ecourt",
      entityId: "ktp-terbit",
    });
  }
}
