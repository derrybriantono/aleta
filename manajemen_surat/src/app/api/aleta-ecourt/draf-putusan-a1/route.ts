import { type NextRequest } from "next/server";

import type { StatusVarianH7 } from "@/lib/agen-h7-putusan";
import { ringkasDrafA1 } from "@/lib/draf-putusan-a1";
import { periksaHasilAiA1, susunMasukanAiA1, type KodeFiturA1 } from "@/lib/draf-putusan-a1-ai";
import { bolehDisarankan, periksaNaskah } from "@/lib/rak-peraturan/indeks";
import { getDatabase } from "@/server/db/client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import { bacaDrafH7 } from "@/server/modules/aleta-ecourt/agen-h7-putusan";
import { bolehDrafPutusanA1 } from "@/server/modules/aleta-ecourt/draf-putusan-a1";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ApiError } from "@/server/shared/errors";
import { ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ============================================================================
 * A1 - DRAF PERTIMBANGAN & AMAR OTOMATIS (baca) + PEMERIKSA HASIL ALETA Ai
 * ============================================================================
 *
 *   GET  ?perkaraId=<id>[&varian=dikabulkan|ditolak][&fitur=C1|C2|C3|C4]
 *        draf A1 yang sudah disusun agen (draf H-7, 0068) - tanpa menyusun ulang. Dengan `fitur`: juga bahan MASUKAN
 *        PETUGAS untuk fitur putusan ALETA Ai di panel Blangko Derry (nama pihak dikirim untuk disamarkan mesin).
 *   POST { perkaraId, varian?, teks }
 *        hasil ALETA Ai diperiksa: rujukan di luar rak terverifikasi diberi [PERLU VERIFIKASI], pemeriksa kutipan rak,
 *        kutipan dalil para pihak yang berubah.
 *
 * Hak: hakim, ketua, wakil ketua, Super Admin (sama dengan fitur putusan C1-C4). Tidak ada yang ditulis ke SIPP/ABT.
 */

const VARIAN = new Set<StatusVarianH7>(["dikabulkan", "ditolak"]);
const FITUR = new Set<KodeFiturA1>(["C1", "C2", "C3", "C4"]);

async function drafVarian(db: Awaited<ReturnType<typeof getDatabase>>, perkaraId: string, varian: StatusVarianH7) {
  const peta = await bacaDrafH7(db, [perkaraId]);
  const d = peta[perkaraId];
  if (!d) return null;
  const putusan = varian === "dikabulkan" ? d.putusan : d.varian?.find((v) => v.status === varian)?.putusan;
  return putusan ? { d, putusan } : null;
}

async function pastikanHak(db: Awaited<ReturnType<typeof getDatabase>>, actorUserId: string | null) {
  const aktor = await pastikanKapabilitas(db, actorUserId, "panel");
  if (!bolehDrafPutusanA1(aktor)) throw new ApiError(403, "Draf pertimbangan dan amar hanya untuk hakim, ketua, wakil ketua, dan Super Admin.");
  return aktor;
}

export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanHak(db, actorUserId);
    const q = request.nextUrl.searchParams;
    const perkaraId = String(q.get("perkaraId") ?? "").trim();
    const varian = (VARIAN.has(q.get("varian") as StatusVarianH7) ? q.get("varian") : "dikabulkan") as StatusVarianH7;
    if (!/^\d+$/.test(perkaraId)) return ok({ ada: false, alasan: "Nomor perkara SIPP tidak dikenal." });
    const h = await drafVarian(db, perkaraId, varian);
    if (!h) return ok({ ada: false, alasan: "Draf pertimbangan dan amar belum disusun untuk perkara ini." });
    const fitur = String(q.get("fitur") ?? "").toUpperCase() as KodeFiturA1;
    return ok({
      ada: true,
      nomorPerkara: h.d.nomorPerkara,
      tanggalSidang: h.d.tanggalSidang,
      dibuatPada: h.d.dibuatPada,
      varian,
      draf: h.putusan,
      ringkas: ringkasDrafA1(h.putusan),
      ...(FITUR.has(fitur) ? { ai: susunMasukanAiA1(h.putusan, fitur, h.putusan.namaSamaran ?? []) } : {}),
    });
  } catch (error) {
    return handleAdminRouteError(error, request, { db, actorUserId, action: "DRAF_PUTUSAN_A1_BACA_FAILED", feature: "aleta_ecourt", entityId: "draf-putusan-a1" });
  }
}

export async function POST(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanHak(db, actorUserId);
    const b = (await request.json().catch(() => ({}))) as { perkaraId?: unknown; varian?: unknown; teks?: unknown };
    const perkaraId = String(b.perkaraId ?? "").trim();
    const varian = (VARIAN.has(b.varian as StatusVarianH7) ? b.varian : "dikabulkan") as StatusVarianH7;
    const teks = String(b.teks ?? "").slice(0, 60_000);
    if (!teks.trim()) throw new ApiError(400, "Hasil yang diperiksa kosong.");
    const h = /^\d+$/.test(perkaraId) ? await drafVarian(db, perkaraId, varian) : null;
    const draf = h?.putusan ?? null;
    const hasil = periksaHasilAiA1(teks, draf ?? { dalil: [] } as unknown as NonNullable<typeof draf>, { boleh: bolehDisarankan, periksaNaskah });
    return ok({ ok: true, ...hasil });
  } catch (error) {
    return handleAdminRouteError(error, request, { db, actorUserId, action: "DRAF_PUTUSAN_A1_PERIKSA_FAILED", feature: "aleta_ecourt", entityId: "draf-putusan-a1" });
  }
}
