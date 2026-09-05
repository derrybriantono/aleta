import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import {
  ambilBerkasGateway,
  getGatewayArsipRincian,
} from "@/server/modules/aleta-bot/whatsapp-gateway-client";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { susunZip, type BerkasZip } from "@/server/shared/zip";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Seluruh berkas e-Court satu perkara, dalam satu ZIP.
 *
 * ============================================================================
 * KENAPA DIPERLUKAN
 * ============================================================================
 *
 * Majelis yang menyiapkan sidang memerlukan SELURUH berkas perkara, bukan satu
 * per satu. Satu perkara dapat memuat belasan dokumen, dan menekan tombol unduh
 * belasan kali - lalu mencari belasan berkas di folder Downloads yang namanya
 * berdekatan - adalah pekerjaan yang tidak perlu ada.
 *
 * ============================================================================
 * ADA BATASNYA, DAN BATASNYA DISEBUTKAN
 * ============================================================================
 *
 * ZIP disusun di memori. Perkara dengan berkas sangat besar dapat menghabiskan
 * memori portal dan menjatuhkannya bagi SELURUH pengguna - bukan hanya bagi yang
 * menekan tombolnya. Karena itu ada batas jumlah dan batas ukuran, dan berkas
 * yang tidak masuk DISEBUTKAN di dalam ZIP-nya sendiri lewat berkas
 * KETERANGAN.txt - bukan dihilangkan diam-diam.
 *
 * ============================================================================
 * BERKAS DIAMBIL DARI ARSIP, BUKAN DARI e-COURT
 * ============================================================================
 *
 * Yang dikemas adalah berkas yang SUDAH tersimpan di server. Rute ini tidak
 * pernah menyentuh e-Court - menarik belasan berkas dari Mahkamah Agung karena
 * satu orang menekan satu tombol bukan perilaku yang pantas.
 */

/** Batas jumlah berkas dalam satu ZIP. */
const BATAS_BERKAS = 60;

/** Batas jumlah byte seluruh isi ZIP sebelum dipadatkan. */
const BATAS_TOTAL_BYTE = 200 * 1024 * 1024;

/** Membersihkan judul dokumen menjadi nama berkas yang aman di semua sistem. */
function namaAman(teks: string, cadangan: string) {
  const bersih = String(teks || "")
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
  return bersih || cadangan;
}

export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanKapabilitas(db, actorUserId, "berkas");

    const nomor = String(request.nextUrl.searchParams.get("nomor") || "").trim();
    if (!nomor) {
      return Response.json({ ok: false, alasan: "nomor_perkara_kosong" }, { status: 400 });
    }

    const rincian = await getGatewayArsipRincian(nomor);
    if (!rincian.ok) {
      return Response.json(
        { ok: false, alasan: rincian.error || "arsip_belum_dapat_dibaca" },
        { status: 502 }
      );
    }

    const dokumen = rincian.data?.dokumen ?? [];
    if (dokumen.length === 0) {
      return Response.json({ ok: false, alasan: "tidak_ada_dokumen" }, { status: 404 });
    }

    const isiZip: BerkasZip[] = [];
    const dilewati: string[] = [];
    let totalByte = 0;
    let urutan = 0;

    for (const item of dokumen) {
      const format: Array<"pdf" | "word"> = [];
      if (item.adaPdf) format.push("pdf");
      if (item.adaWord) format.push("word");

      if (format.length === 0) {
        dilewati.push(`${item.judulDokumen || item.documentKey}: berkasnya belum tersimpan`);
        continue;
      }

      for (const bentuk of format) {
        if (isiZip.length >= BATAS_BERKAS) {
          dilewati.push(`${item.judulDokumen || item.documentKey}: melewati batas ${BATAS_BERKAS} berkas`);
          continue;
        }

        const respons = await ambilBerkasGateway(item.documentKey, bentuk);
        if (!respons.ok) {
          // Satu berkas gagal tidak menggagalkan seluruh ZIP: yang lain tetap
          // berguna, dan yang gagal disebutkan namanya.
          dilewati.push(`${item.judulDokumen || item.documentKey} (${bentuk}): HTTP ${respons.status}`);
          continue;
        }

        const isi = Buffer.from(await respons.arrayBuffer());
        if (isi.byteLength === 0) {
          dilewati.push(`${item.judulDokumen || item.documentKey} (${bentuk}): berkasnya kosong`);
          continue;
        }

        if (totalByte + isi.byteLength > BATAS_TOTAL_BYTE) {
          dilewati.push(`${item.judulDokumen || item.documentKey} (${bentuk}): melewati batas ukuran ZIP`);
          continue;
        }

        urutan += 1;
        const ekstensi = bentuk === "word" ? "docx" : "pdf";
        const nama = `${String(urutan).padStart(2, "0")} - ${namaAman(item.judulDokumen, item.documentKey)}.${ekstensi}`;

        isiZip.push({ nama, isi });
        totalByte += isi.byteLength;
      }
    }

    if (isiZip.length === 0) {
      return Response.json(
        { ok: false, alasan: "tidak_ada_berkas_tersimpan", keterangan: dilewati.slice(0, 20) },
        { status: 404 }
      );
    }

    // Keterangan SELALU ikut, juga ketika tidak ada yang dilewati - penerima
    // ZIP perlu tahu berapa yang seharusnya ada, bukan hanya berapa yang ada.
    const keterangan = [
      `Arsip berkas e-Court - perkara ${nomor}`,
      `Disusun ${new Date().toISOString()}`,
      `Berkas dalam arsip ini: ${isiZip.length}`,
      `Dokumen tercatat pada perkara: ${dokumen.length}`,
      "",
      dilewati.length > 0 ? "TIDAK IKUT DIKEMAS:" : "Seluruh berkas yang tersimpan ikut dikemas.",
      ...dilewati.map((baris) => `- ${baris}`),
      "",
      "Berkas yang belum tersimpan dapat ditarik dari menu Kendali Berkas di ALETA.",
    ].join("\r\n");

    isiZip.push({ nama: "KETERANGAN.txt", isi: Buffer.from(keterangan, "utf8") });

    const zip = susunZip(isiZip);
    const namaZip = `ecourt-${namaAman(nomor, "perkara").replace(/[^\w.-]+/g, "-")}.zip`;

    return new Response(new Uint8Array(zip), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(namaZip)}"`,
        "Content-Length": String(zip.length),
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "ECOURT_BERKAS_ZIP_FAILED",
      feature: "aleta_ecourt",
    });
  }
}
