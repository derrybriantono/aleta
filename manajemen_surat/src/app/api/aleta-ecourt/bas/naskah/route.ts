import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import { susunIsianNaskahBas } from "@/server/modules/aleta-ecourt/bas-isian-naskah";
import { callAletaBotSippBridge } from "@/server/modules/aleta-sipp/aleta-sipp-datasource";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { getSearchParam } from "@/server/shared/request";
import { buangGrupTersembunyiRtf } from "@/lib/buang-grup-tersembunyi-rtf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type HasilIsi = {
  ok?: boolean;
  sebab?: string;
  berkas?: string;
  jumlahTerisi?: number;
  terisi?: string[];
  tersisa?: string[];
  kosong?: Array<{ noVar: string; nama?: string; sebab?: string }>;
  rtfBase64?: string;
};

/** Mesin variabel ABT menjalankan puluhan kueri SIPP per blangko - batas jembatan biasa (10 dtk) terlalu pendek. */
const BATAS_ISI_MS = 90_000;

/**
 * Blangko yang sudah terisi dari berkas perkara, siap diunduh.
 *
 * ============================================================================
 * YANG DIUNDUH ADALAH BLANGKO ASLINYA
 * ============================================================================
 *
 * Bukan naskah yang disusun ulang ALETA. Blangko dibaca apa adanya dan hanya
 * penandanya yang diganti, sehingga tata letak, huruf, penomoran, dan tabel
 * tetap persis seperti bentuk baku yang ditetapkan pedoman Badilag.
 *
 * ============================================================================
 * YANG BELUM TERISI IKUT DILAPORKAN DI KEPALA JAWABAN
 * ============================================================================
 *
 * Sejak 14 Okt 2026 (Q2) tidak ada lagi penanda #NNNN# mentah di naskah:
 * yang ABT pun tidak punya nilainya (isian tangan yang belum diisi di ABT,
 * saksi yang belum tercatat) dicetak "..." BERSOROT kuning, persis tempat ABT
 * mencetak "...". Nomornya disebut di X-Aleta-Tersisa (ekstensi menyebutnya
 * "isian masih kosong, lengkapi di Word") dan namanya di X-Aleta-Kosong -
 * mengetahuinya SEBELUM membuka Word jauh lebih berguna, dan isian kosong di
 * naskah resmi lebih mudah dibereskan sekarang daripada sesudah ditandatangani.
 */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanKapabilitas(db, actorUserId, "panel");

    const perkaraId = String(getSearchParam(request, "perkaraId") ?? "").trim();
    const folder = String(getSearchParam(request, "folder") ?? "").trim();
    const berkas = String(getSearchParam(request, "berkas") ?? "").trim();
    // Blangko "BAS 2" memang untuk sidang ke-2, jadi nomornya datang dari
    // jenjang blangko yang sudah dipilih - tidak perlu ditanyakan lagi.
    const nomorSidang = Number(getSearchParam(request, "sidangKe") ?? "0") || 0;

    if (!perkaraId || !berkas) {
      return Response.json({ ok: false, sebab: "Perkara dan blangko harus disebutkan." }, { status: 400 });
    }

    // Seluruh penanda diisi mesin variabel ABT di bot (katalog abt_variabel
    // dibaca saat berjalan). ALETA mengirim yang diketik hari ini (timpa),
    // bacaannya sendiri sebagai cadangan, dan baris tanya-jawab lembar mentah
    // supaya bot membentuknya persis seperti ABT (tabel tanya kiri, jawab kanan).
    const isian = await susunIsianNaskahBas(db, perkaraId, nomorSidang);

    const hasil = await callAletaBotSippBridge<HasilIsi>(
      "blangko.isi",
      {
        folder,
        berkas,
        perkaraId,
        sidangKe: nomorSidang,
        nilai: isian.timpa,
        cadangan: isian.cadangan,
        tanyaJawabSaksi: isian.tanyaJawabSaksi,
      },
      { timeoutMs: BATAS_ISI_MS }
    );
    const data = hasil.data;

    if (!hasil.ok || !data?.ok || !data.rtfBase64) {
      return Response.json(
        { ok: false, sebab: data?.sebab ?? hasil.error ?? "Blangko tidak dapat diisi." },
        { status: 502 }
      );
    }

    // Audit jejak 18 Okt 2026: unduhan ini dapat diunggah petugas langsung lewat borang
    // SIPP - grup tersembunyi isianasal/aletaasal dibuang lebih dulu.
    const rtf = Buffer.from(buangGrupTersembunyiRtf(Buffer.from(data.rtfBase64, "base64")));
    const namaUnduhan = `${isian.nomorPerkara || perkaraId} - ${data.berkas ?? berkas}`.replace(/[\\/:*?"<>|]/g, "_");

    return new Response(new Uint8Array(rtf), {
      status: 200,
      headers: {
        "Content-Type": "application/rtf",
        "Content-Disposition": `attachment; filename="${namaUnduhan}"`,
        "Content-Length": String(rtf.length),
        "Cache-Control": "no-store",
        "X-Aleta-Terisi": String(data.jumlahTerisi ?? 0),
        // Isian yang KOSONG (dicetak "..." bersorot) - bukan lagi penanda mentah.
        "X-Aleta-Tersisa": (data.tersisa ?? []).join(","),
        "X-Aleta-Kosong": encodeURIComponent(
          (data.kosong ?? []).map((k) => `#${k.noVar}# ${k.nama ?? ""}`.trim()).join("; ")
        ),
      },
    });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "BAS_NASKAH_FAILED",
      feature: "aleta_ecourt",
      entityId: "bas-naskah",
    });
  }
}
