import { type NextRequest } from "next/server";

import { JENIS_BAS_BAKU, saranBasDariKatalog, type ButirKatalogBas, type JenisPemetaan } from "@/lib/pemetaan-blangko";
import { getDatabase } from "@/server/db/client";
import { bacaPemetaanBlangko, simpanPemetaanBlangko } from "@/server/modules/aleta-ecourt/pemetaan-blangko";
import { callAletaBotSippBridge } from "@/server/modules/aleta-sipp/aleta-sipp-datasource";
import { requireActorUser } from "@/server/modules/organization/service";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ApiError } from "@/server/shared/errors";
import { ok } from "@/server/shared/http";

import { kehadiranDiNama, setBasUntukPerkara } from "../bas-massal/susun";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Batas menunggu katalog BAS dari bot - saran hanya pelengkap, layar tidak boleh tertahan. */
const BATAS_KATALOG_MS = 6000;

/**
 * Saran tab BAS (perbaikan 2 Okt sore, butir 6): katalog blangko yang sama
 * dengan yang dibaca BAS massal (bot blangko.katalog, folder set BAS
 * pohon-blangko.ts). Bot mati = tanpa saran, bukan galat.
 */
async function saranBas(jenis: JenisPemetaan) {
  if (jenis !== "bas") return [];
  const set = new Map<string, { folder: string; id: string }>();
  for (const j of JENIS_BAS_BAKU) for (const s of setBasUntukPerkara(j)) set.set(s.folder, { folder: s.folder, id: s.id });
  const katalog: Record<string, { terbaca: boolean; blangko: ButirKatalogBas[] }> = {};
  await Promise.all(
    [...set.keys()].map(async (folder) => {
      try {
        const j = await callAletaBotSippBridge<{ ada?: boolean; blangko?: ButirKatalogBas[] }>(
          "blangko.katalog",
          { folder },
          { timeoutMs: BATAS_KATALOG_MS }
        );
        const ada = j.ok && j.data && j.data.ada !== false && Array.isArray(j.data.blangko);
        katalog[folder] = { terbaca: Boolean(ada), blangko: ada ? (j.data!.blangko as ButirKatalogBas[]) : [] };
      } catch {
        katalog[folder] = { terbaca: false, blangko: [] };
      }
    })
  );
  return saranBasDariKatalog(katalog, (jenisPerkara) => setBasUntukPerkara(jenisPerkara), kehadiranDiNama);
}

/**
 * Pemetaan blangko putusan, relaas, dan pemberitahuan putusan (kontrak K3,
 * butir 16 dan 17 perbaikan 30 September 2026), ditambah BAS (perbaikan 2 Okt
 * sore, butir 6) dan putusan per status putusan (butir 3, kunci
 * "Jenis|Status[|verstek]" - tanpa migrasi).
 *
 *   GET ?jenis=putusan|relaas|pbt|bas   semua pegawai yang masuk
 *     -> { jenis, butir: [{ kunci, sebutan, namaBerkas, catatan, diubahPada,
 *          diubahOleh, sumber }], diubahPada, label, kunciBaku, saran,
 *          bolehMengubah, kapan: { kunci: { dikenal, dipakai } },
 *          statusPutusan?, statusBerverstek? (hanya putusan) }
 *   PUT { jenis, butir: [{ kunci, namaBerkas, catatan?, sebutan? }] }
 *     Super Admin & Admin -> sama dengan GET. namaBerkas kosong = hapus.
 *
 * Tanpa sesi: 401. Hanya menyentuh ALETA (aleta_pemetaan_blangko) - tidak ada
 * tulisan ke SIPP maupun ABT.
 */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    const actor = await requireActorUser(db, actorUserId);
    const jenis = String(request.nextUrl.searchParams.get("jenis") || "putusan").trim();
    return ok(await bacaPemetaanBlangko(db, jenis, actor, saranBas));
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "ECOURT_BLANGKO_MAPPING_READ_FAILED",
      feature: "aleta_ecourt",
    });
  }
}

export async function PUT(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    let badan: Record<string, unknown>;
    try {
      const isi = (await request.json()) as unknown;
      badan = isi && typeof isi === "object" && !Array.isArray(isi) ? (isi as Record<string, unknown>) : {};
    } catch {
      throw new ApiError(400, "Badan permintaan harus JSON.");
    }
    return ok(await simpanPemetaanBlangko(db, actorUserId, { jenis: badan.jenis, butir: badan.butir }, saranBas));
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "ECOURT_BLANGKO_MAPPING_UPDATE_FAILED",
      feature: "aleta_ecourt",
    });
  }
}
