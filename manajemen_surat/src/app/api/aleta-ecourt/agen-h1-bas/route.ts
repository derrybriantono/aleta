import { type NextRequest } from "next/server";

import { keteranganDrafH1, ringkasDrafH1 } from "@/lib/agen-h1-bas";
import { isPrivilegedAdmin } from "@/lib/permissions";
import { waktuPengadilan } from "@/lib/waktu-pengadilan";
import { getDatabase } from "@/server/db/client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import { bacaDrafH1, bacaDrafH1Saya, jalanAgenH1Terakhir, jalankanAgenH1 } from "@/server/modules/aleta-ecourt/agen-h1-bas";
import { pastikanAksi } from "@/server/modules/akses/hak-peran";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * ============================================================================
 * AGEN H-1 BAS SIDANG BERIKUTNYA (G2a 2.4)
 * ============================================================================
 *
 *   GET  ?perkaraId=1,2,3[&ringkas=1]  draf BAS sidang hari ini / hari kerja berikutnya tiap perkara (blangko, alasan,
 *                                     catatan, keadaan saksi). ringkas=1 hanya lencana Jadwal Sidang.
 *   GET  ?saya=1                       draf milik akun (PP/majelis; Super Admin/Admin semua).
 *   GET  ?jalan=1                      sepuluh jalan agen terakhir.
 *   POST { untuk? }                    menjalankan agen sekarang (Admin/Super Admin), selain jadwal sore hari kerja.
 *
 * Hanya MEMBACA SIPP/ABT lewat bot; draf disimpan di memori portal. Tidak ada yang ditulis ke ABT: blangko dibuka di
 * Blangko Derry saat PP membuka perkara pada sidangnya, isiannya diisi jalur isi otomatis yang sudah berlaku.
 */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    const aktor = await pastikanKapabilitas(db, actorUserId, "panel");
    const q = request.nextUrl.searchParams;
    if (q.get("jalan") === "1") return ok({ ada: true, jalan: jalanAgenH1Terakhir() });
    if (q.get("saya") === "1") {
      await pastikanAksi(db, actorUserId, "bas.baca");
      const hasil = await bacaDrafH1Saya({ nama: String(aktor?.name || ""), lihatSemua: isPrivilegedAdmin(aktor) });
      return ok({ ada: true, ...hasil, draf: hasil.draf.map((d) => ({ ...d, keterangan: keteranganDrafH1(d) })) });
    }
    const daftar = String(q.get("perkaraId") || "")
      .split(",")
      .map((x) => x.trim())
      .filter((x) => /^\d+$/.test(x))
      .slice(0, 400);
    if (!daftar.length) return ok({ ada: true, peta: {} });
    const draf = await bacaDrafH1(daftar);
    const hariIni = waktuPengadilan().tanggal;
    if (q.get("ringkas") === "1") return ok({ ada: true, hariIni, peta: Object.fromEntries(Object.entries(draf).map(([pid, d]) => [pid, { ...ringkasDrafH1(d), keterangan: keteranganDrafH1(d) }])) });
    await pastikanAksi(db, actorUserId, "bas.baca");
    return ok({ ada: true, hariIni, peta: Object.fromEntries(Object.entries(draf).map(([pid, d]) => [pid, { ...d, keterangan: keteranganDrafH1(d) }])) });
  } catch (error) {
    return handleAdminRouteError(error, request, { db, actorUserId, action: "AGEN_H1_BAS_BACA_FAILED", feature: "aleta_ecourt", entityId: "agen-h1-bas" });
  }
}

export async function POST(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    const aktor = await pastikanKapabilitas(db, actorUserId, "panel");
    if (!isPrivilegedAdmin(aktor)) return ok({ ada: false, alasan: "Hanya Admin dan Super Admin yang dapat menjalankan penyiapan BAS sekarang." });
    const badan = (await request.json().catch(() => ({}))) as { untuk?: unknown };
    const untuk = /^\d{4}-\d{2}-\d{2}$/.test(String(badan.untuk || "")) ? String(badan.untuk) : undefined;
    const jalan = await jalankanAgenH1({ pemicu: "tangan", untuk });
    return ok({ ada: true, jalan });
  } catch (error) {
    return handleAdminRouteError(error, request, { db, actorUserId, action: "AGEN_H1_BAS_JALAN_FAILED", feature: "aleta_ecourt", entityId: "agen-h1-bas" });
  }
}
