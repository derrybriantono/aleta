import { type NextRequest } from "next/server";

import { buangGrupTersembunyiRtf } from "@/lib/buang-grup-tersembunyi-rtf";
import { getDatabase } from "@/server/db/client";
import { bolehMenyuntingAkses, pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import { callAletaBotSippBridge } from "@/server/modules/aleta-sipp/aleta-sipp-datasource";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ApiError } from "@/server/shared/errors";
import { ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Mesin variabel ABT menjalankan puluhan kueri SIPP per blangko - batas jembatan biasa (10 dtk) terlalu pendek. */
const BATAS_ISI_MS = 90_000;
const AKAR_DERRY = "derry_briantono";
const BATAS_ISIAN = 600;
const BATAS_PANJANG_ISIAN = 20_000;

type HasilIsi = {
  ok?: boolean;
  sebab?: string;
  berkas?: string;
  jumlahTerisi?: number;
  terisi?: string[];
  tersisa?: string[];
  kosong?: Array<{ noVar: string; nama?: string; sebab?: string }>;
  sumber?: Record<string, number>;
  mesinGalat?: string;
  rtfBase64?: string;
};

const teks = (x: unknown) => String(x ?? "").trim();

/**
 * ============================================================================
 * NASKAH "TES PUTUSAN" YANG MEMUAT KETIKAN PETUGAS - HITUNG SAJA, TIDAK MENULIS
 * ============================================================================
 *
 *   POST { perkaraId, sidangKe?, folder, berkas, isian: { "<nomor variabel>": "<ketikan>" } }
 *
 * Super Admin saja. Blangko Derry dibaca dari server (baca saja), semua penandanya diisi mesin variabel ABT di bot dari data perkara
 * ACUAN (sama dengan abt/preview), lalu ketikan petugas diperlakukan SEOLAH sudah tersimpan di ABT - tanpa pernah disimpan:
 * ketikan hanya lewat badan permintaan ini, hidup di memori bot selama satu permintaan, dan tidak ditulis ke basis data ALETA, ABT,
 * SIPP, maupun e-Court (tidak ada pencatatan isi; yang tersisa hanya log teknis tanpa isi bila gagal).
 */
export async function POST(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    const actor = await pastikanKapabilitas(db, actorUserId, "panel");
    if (!bolehMenyuntingAkses(actor)) throw new ApiError(403, "Tes putusan hanya untuk Super Admin.");

    const badan = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!badan || typeof badan !== "object") return Response.json({ ok: false, alasan: "Badan permintaan harus JSON." }, { status: 400 });

    const perkaraId = teks(badan.perkaraId);
    const folder = teks(badan.folder).replace(/^\/+|\/+$/g, "");
    const berkas = teks(badan.berkas);
    const sidangKe = Math.max(0, Math.min(99, Math.trunc(Number(badan.sidangKe) || 0)));
    if (!/^\d+$/.test(perkaraId) || !folder || !berkas) {
      return Response.json({ ok: false, alasan: "Perkara, folder, dan berkas harus disebutkan." }, { status: 400 });
    }
    if (folder.includes("..") || folder.includes("\\") || berkas.includes("/") || berkas.includes("\\") || berkas.includes("..")) {
      return Response.json({ ok: false, alasan: "Nama folder atau berkas tidak sah." }, { status: 400 });
    }

    const isian: Record<string, string> = {};
    const mentah = badan.isian && typeof badan.isian === "object" && !Array.isArray(badan.isian) ? (badan.isian as Record<string, unknown>) : {};
    for (const [kode, nilai] of Object.entries(mentah)) {
      if (!/^\d{3,5}$/.test(kode) || typeof nilai !== "string") continue;
      if (Object.keys(isian).length >= BATAS_ISIAN) break;
      isian[kode] = nilai.slice(0, BATAS_PANJANG_ISIAN);
    }

    const namaBerkas = /\.(rtf|docx?|odt)$/i.test(berkas) ? berkas : `${berkas}.rtf`;
    const jalurFolder = folder.startsWith(`${AKAR_DERRY}/`) || folder === AKAR_DERRY ? folder : `${AKAR_DERRY}/${folder}`;

    const hasil = await callAletaBotSippBridge<HasilIsi>(
      "blangko.isi",
      { folder: jalurFolder, berkas: namaBerkas, perkaraId, sidangKe, nilai: {}, cadangan: {}, tanyaJawabSaksi: {}, tes: true, isianTangan: isian },
      { timeoutMs: BATAS_ISI_MS }
    );
    const data = hasil.data;
    if (!hasil.ok || !data?.ok || !data.rtfBase64) {
      return Response.json({ ok: false, alasan: data?.sebab ?? hasil.error ?? "Blangko tidak dapat diisi." }, { status: 502 });
    }
    const rtf = Buffer.from(buangGrupTersembunyiRtf(Buffer.from(data.rtfBase64, "base64")));
    return ok(
      {
        berkas: data.berkas ?? namaBerkas,
        rtfBase64: rtf.toString("base64"),
        byte: rtf.length,
        jumlahTerisi: data.jumlahTerisi ?? 0,
        tersisa: data.tersisa ?? [],
        kosong: data.kosong ?? [],
        sumber: data.sumber ?? {},
        mesinGalat: data.mesinGalat ?? "",
        ketikanDipakai: Object.keys(isian).length,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "BLANGKO_DERRY_TES_NASKAH_FAILED",
      feature: "aleta_ecourt",
      entityId: "blangko-derry-tes-naskah",
    });
  }
}
