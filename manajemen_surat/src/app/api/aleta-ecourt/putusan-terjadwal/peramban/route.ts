import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { pastikanBolehUnggahPutusan } from "@/server/modules/aleta-ecourt/hak-putusan";
import { depsAsli } from "@/server/modules/putusan-terjadwal/pelaksana";
import { giliranPeramban, klaimPeramban, laporPeramban, lepasPeramban, siapkanDraf, type HasilLaporan } from "@/server/modules/putusan-terjadwal/peramban";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ok } from "@/server/shared/http";
import { readJsonBody } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Sisi peramban unggah putusan terjadwal: ekstensi di SIPP yang terbuka
 * mengambil giliran, memegang satu butir, menyiapkan draf dari berkas yang
 * dipasang, mengisi & menyimpan Putusan Akhir lewat alur Putusan Otomatis,
 * lalu melapor. Hanya penjadwalnya sendiri.
 *
 *   GET  ?akunSipp=        -> { ada, butir?, tautan? } | { ada:false, menunggu, berikutnya, alasan }
 *   POST { aksi: "klaim" | "draf" | "lapor" | "lepas", id, ... }
 */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    const pelaku = await pastikanBolehUnggahPutusan(db, actorUserId);
    const akunSipp = String(request.nextUrl.searchParams.get("akunSipp") ?? "").trim();
    return ok(await giliranPeramban(db, pelaku, { akunSipp }, depsAsli()));
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "PUTUSAN_TERJADWAL_GILIRAN_GAGAL",
      feature: "aleta_ecourt",
      entityId: "putusan-terjadwal-peramban",
    });
  }
}

export async function POST(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    const pelaku = await pastikanBolehUnggahPutusan(db, actorUserId);
    const badan = await readJsonBody<Record<string, unknown>>(request);
    const id = String(badan.id ?? "");
    const deps = depsAsli();
    switch (String(badan.aksi ?? "")) {
      case "klaim":
        return ok(await klaimPeramban(db, pelaku, { id, akunSipp: String(badan.akunSipp ?? "") }, deps));
      case "draf":
        return ok(await siapkanDraf(db, pelaku, { id }, deps));
      case "lapor":
        return ok(await laporPeramban(db, pelaku, { id, hasil: String(badan.hasil ?? "") as HasilLaporan, catatan: String(badan.catatan ?? "") }, deps));
      case "lepas":
        return ok(await lepasPeramban(db, pelaku, { id, tundaDetik: Number(badan.tundaDetik) || undefined, sebab: String(badan.sebab ?? ""), hitung: badan.hitung === true }, deps));
      default:
        return ok({ ok: false, sebab: "Aksi tidak dikenal." });
    }
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "PUTUSAN_TERJADWAL_PERAMBAN_GAGAL",
      feature: "aleta_ecourt",
      entityId: "putusan-terjadwal-peramban",
    });
  }
}
