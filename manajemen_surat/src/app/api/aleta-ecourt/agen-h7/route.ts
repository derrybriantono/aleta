import { type NextRequest } from "next/server";

import { teksLaporanH7 } from "@/lib/agen-h7-putusan";
import { getDatabase } from "@/server/db/client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import {
  bacaDrafH7,
  bacaJalanTerakhir,
  bacaRingkasDrafH7,
  jalankanAgenH7,
} from "@/server/modules/aleta-ecourt/agen-h7-putusan";
import { pastikanAksi } from "@/server/modules/akses/hak-peran";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Satu jalan agen dapat memakan beberapa menit (puluhan perkara lewat jembatan bot).
export const maxDuration = 600;

/**
 * ============================================================================
 * AGEN H-7 DRAF PUTUSAN (F4.2)
 * ============================================================================
 *
 *   GET  ?perkaraId=1,2,3[&ringkas=1]
 *        draf H-7 tiap perkara (Hari Putusan terdekat ke depan): blangko,
 *        golongan isian, ringkasan, kesiapan, laporan kalimat. ringkas=1
 *        hanya lencana (Jadwal Sidang, checklist konseptor, widget).
 *   GET  ?jalan=1
 *        sepuluh jalan agen terakhir.
 *   POST { hariIni? }
 *        menjalankan agen sekarang (selain jadwal harian 06.00 WITA). Hanya
 *        penyusun draf putusan (majelis & PP) serta Admin/Super Admin.
 *
 * Membaca saja dari SIPP/ABT; yang ditulis hanya basis data ALETA (0068).
 */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanKapabilitas(db, actorUserId, "panel");
    const q = request.nextUrl.searchParams;
    if (q.get("jalan") === "1") return ok({ ada: true, jalan: await bacaJalanTerakhir(db) });
    const daftar = String(q.get("perkaraId") || "")
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);
    if (daftar.length === 0) return ok({ ada: true, peta: {} });
    if (q.get("ringkas") === "1") return ok({ ada: true, peta: await bacaRingkasDrafH7(db, daftar) });
    const draf = await bacaDrafH7(db, daftar);
    const peta = Object.fromEntries(Object.entries(draf).map(([pid, d]) => [pid, { ...d, laporan: teksLaporanH7(d) }]));
    return ok({ ada: true, peta });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "AGEN_H7_BACA_FAILED",
      feature: "aleta_ecourt",
      entityId: "agen-h7",
    });
  }
}

export async function POST(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    const aktor = await pastikanKapabilitas(db, actorUserId, "panel");
    await pastikanAksi(db, actorUserId, "putusan.draf");
    const masukan = (await request.json().catch(() => ({}))) as { hariIni?: string };
    const hariIni = /^\d{4}-\d{2}-\d{2}$/.test(String(masukan.hariIni ?? "")) ? String(masukan.hariIni) : undefined;
    const hasil = await jalankanAgenH7(db, { pemicu: "tangan", oleh: aktor.name || String(actorUserId ?? ""), hariIni });
    return ok({ ok: !hasil.galat || hasil.diperiksa > 0, ...hasil });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "AGEN_H7_JALAN_FAILED",
      feature: "aleta_ecourt",
      entityId: "agen-h7",
    });
  }
}
