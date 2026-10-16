import { type NextRequest } from "next/server";

import { waktuPengadilan } from "@/lib/waktu-pengadilan";
import { getDatabase } from "@/server/db/client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import { peranBawaan, tentukanPeran } from "@/server/modules/aleta-ecourt/checklist-milestone";
import { faktaBot, faktaPortal, susunPenyatu, type FaktaBot } from "@/server/modules/aleta-ecourt/penyatu";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PESAN: Record<string, string> = {
  nomor_kosong: "Nomor perkara belum terbaca di halaman ini.",
  perkara_tidak_ditemukan: "Perkara ini tidak ditemukan di SIPP.",
  sipp_tidak_terbaca: "SIPP belum dapat dibaca ALETA saat ini.",
  bot_tidak_terjangkau: "ALETA Bot tidak terjangkau.",
  bot_tidak_menjawab_tepat_waktu: "ALETA Bot tidak menjawab tepat waktu.",
  fitur_belum_tersedia_di_server: "Penyatu SIPP-ABT-ALETA belum tersedia di server.",
};

/**
 * ============================================================================
 * PENYATU SIPP - ABT - ALETA SATU PERKARA (TAHAP M2, 16 OKT 2026) - BACA SAJA
 * ============================================================================
 *
 *   GET ?nomor=<nomor perkara>[&perkaraId=<id SIPP>]
 *     -> { ok:true, perkara, blangko[], ringkasBlangko, basBelum[], basLama,
 *          tugas[], selisih[], catatan[], sumber, peran, hariIni }
 *
 * Dibaca kotak penyatu di halaman perkara SIPP (sipp-ide-m2.js). Kewenangannya
 * "panel", sama dengan panel ALETA di SIPP. Tidak menulis apa pun ke SIPP, ABT,
 * maupun ALETA. Isian tangan ABT dibandingkan di sini dan yang diteruskan ke
 * peramban hanya selisihnya. Bot lama (rute belum ada) = 404 "belum tersedia".
 */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    const actor = await pastikanKapabilitas(db, actorUserId, "panel");

    const nomor = String(request.nextUrl.searchParams.get("nomor") ?? "").trim();
    const perkaraId = String(request.nextUrl.searchParams.get("perkaraId") ?? "").trim();
    if (!nomor && !/^\d{1,12}$/.test(perkaraId)) {
      return ok({ ok: false, alasan: "nomor_kosong", pesan: PESAN.nomor_kosong });
    }

    const jawab = await faktaBot({ nomor, perkaraId: /^\d{1,12}$/.test(perkaraId) ? perkaraId : "" });
    if (!jawab.ok) {
      const pesan = PESAN[jawab.alasan] || `Penyatu belum dapat dibaca (${jawab.alasan}).`;
      return ok({ ok: false, alasan: jawab.alasan, pesan }, jawab.tidakAda ? { status: 404 } : undefined);
    }
    const data = jawab.data;
    if (!data || data.ok !== true) {
      const alasan = (data && "alasan" in data && data.alasan) || "bot_menjawab_tidak_sah";
      return ok({ ok: false, alasan, pesan: PESAN[alasan] || `Penyatu belum dapat dibaca (${alasan}).` });
    }
    const fakta = data as FaktaBot;
    const portal = await faktaPortal(db, fakta);
    const tersedia = tentukanPeran(actor, []);
    const utama = peranBawaan(actor, tersedia);
    const peran = utama ? [utama, ...tersedia.filter((p) => p !== utama)] : tersedia;

    return ok(
      susunPenyatu({
        fakta,
        portal,
        peran,
        namaAkun: String(actor?.name || ""),
        hariIni: waktuPengadilan().tanggal,
      })
    );
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "PENYATU_PERKARA_READ_FAILED",
      feature: "aleta_ecourt",
      entityId: "penyatu",
    });
  }
}
