import { type NextRequest } from "next/server";

import { BAWAAN_HALAMAN, DAFTAR_CIRI, KERTAS, URUTAN_KERTAS } from "@/lib/berkas-perkara";
import { FITUR_BERKAS_PERKARA } from "@/lib/fitur-satker";
import { getDatabase } from "@/server/db/client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import { callAletaBotSippBridge } from "@/server/modules/aleta-sipp/aleta-sipp-datasource";
import { bacaBawaan, bacaSunting, idPerkaraSah, simpanSunting } from "@/server/modules/berkas-perkara/layanan";
import { pastikanFiturMenyala } from "@/server/modules/satker/fitur";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ApiError } from "@/server/shared/errors";
import { ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Membaca dokumen dan berkas perkara (tiap berkas dibaca halamannya) bisa puluhan berkas: batas jembatan biasa terlalu pendek. */
const BATAS_FAKTA_MS = 60_000;

/**
 * ============================================================================
 * SAMPUL DAN DAFTAR ISI BERKAS: BAHAN LAYAR KERJA DAN SIMPAN SUNTING
 * ============================================================================
 *
 *   GET ?perkaraId=<id SIPP>
 *       fakta perkara dari bot (jenis perkara, ciri otomatis, isian khas jenis, dokumen yang ADA beserta halamannya; BACA SAJA di SIPP
 *       dan arsip), digabung dengan sunting petugas yang tersimpan di ALETA dan nilai bawaan halaman. Layar kerja di ekstensi
 *       memadukannya (rancangan bagian 9-10).
 *   PUT { perkaraId, nomor?, susunan?: [...], tag?: {kunci: bool}, isian?: {kunci: teks} }
 *       menyimpan sunting di ALETA (aleta_berkas_susunan, aleta_berkas_sampul). TIDAK ada yang ditulis ke SIPP maupun ABT.
 *
 * Hanya bila saklar Fitur Satker "berkas-perkara-khusus" menyala (bawaan MENYALA sejak 30 Okt 2026).
 */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanKapabilitas(db, actorUserId, "panel");
    await pastikanFiturMenyala(db, FITUR_BERKAS_PERKARA);
    const perkaraId = idPerkaraSah(request.nextUrl.searchParams.get("perkaraId"));
    if (!perkaraId) return Response.json({ ok: false, alasan: "perkaraId harus angka." }, { status: 400 });

    const [fakta, sunting, bawaan] = await Promise.all([
      callAletaBotSippBridge<Record<string, unknown>>("berkas.fakta", { perkaraId }, { timeoutMs: BATAS_FAKTA_MS }),
      bacaSunting(db, perkaraId),
      bacaBawaan(db),
    ]);
    if (!fakta.ok || (fakta.data as { ok?: boolean } | undefined)?.ok === false) {
      const sebab = (fakta.data as { sebab?: string } | undefined)?.sebab ?? (fakta.ok ? "" : fakta.error);
      return Response.json({ ok: false, alasan: sebab || "Bot ALETA tidak dapat membaca bahan berkas perkara ini." }, { status: 502 });
    }
    return ok(
      {
        fakta: fakta.data,
        sunting,
        bawaan: { ...BAWAAN_HALAMAN, ...bawaan },
        kertas: URUTAN_KERTAS.map((k) => ({ kode: k, nama: KERTAS[k].nama, barisRiwayat: KERTAS[k].barisRiwayat })),
        ciri: DAFTAR_CIRI,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "BERKAS_PERKARA_BACA_FAILED",
      feature: "aleta_ecourt",
      entityId: "sampul-berkas",
    });
  }
}

export async function PUT(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    const actor = await pastikanKapabilitas(db, actorUserId, "panel");
    await pastikanFiturMenyala(db, FITUR_BERKAS_PERKARA);
    const badan = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!badan || typeof badan !== "object") throw new ApiError(400, "Badan permintaan harus JSON.");
    const perkaraId = idPerkaraSah(badan.perkaraId);
    if (!perkaraId) throw new ApiError(400, "perkaraId harus angka.");
    const nama = String((actor as { name?: string; username?: string } | null)?.name || (actor as { username?: string } | null)?.username || actorUserId || "");
    const hasil = await simpanSunting(db, {
      perkaraId,
      nomor: typeof badan.nomor === "string" ? badan.nomor : "",
      aktor: nama,
      susunan: Array.isArray(badan.susunan) ? (badan.susunan as never) : null,
      tag: badan.tag && typeof badan.tag === "object" && !Array.isArray(badan.tag) ? (badan.tag as Record<string, unknown>) : null,
      isian: badan.isian && typeof badan.isian === "object" && !Array.isArray(badan.isian) ? (badan.isian as Record<string, unknown>) : null,
    });
    if (!hasil.ok) throw new ApiError(400, hasil.alasan);
    return ok(hasil, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "BERKAS_PERKARA_SIMPAN_FAILED",
      feature: "aleta_ecourt",
      entityId: "sampul-berkas",
    });
  }
}
