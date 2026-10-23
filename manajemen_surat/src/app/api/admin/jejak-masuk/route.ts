import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { pastikanAksi } from "@/server/modules/akses/hak-peran";
import { bacaSetelanJejak } from "@/server/modules/perangkat/jejak";
import { cariJejak, daftarPerangkat, jejakKeCsv, peringatanTerbaru, sesiAktifSemua } from "@/server/modules/perangkat/laporan";
import { resolveActorUserId } from "@/server/shared/auth";
import { handleRouteError, ok } from "@/server/shared/http";
import { getBooleanSearchParam, getNumberSearchParam, getSearchParam, getSearchParamArray } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Riwayat Masuk & Perangkat (23 Okt 2026) - Admin dan Super Admin
 * (AKSI "jejak-masuk.lihat"). ?tab=riwayat|sesi|perangkat|peringatan,
 * ?format=csv untuk riwayat.
 */
export async function GET(request: NextRequest) {
  try {
    const db = await getDatabase();
    const actorUserId = await resolveActorUserId(request);
    await pastikanAksi(db, actorUserId, "jejak-masuk.lihat");
    const tab = getSearchParam(request, "tab") ?? "riwayat";
    const userId = getSearchParam(request, "userId");

    if (tab === "sesi") return ok({ sesi: await sesiAktifSemua(db, { userId }) });
    if (tab === "perangkat") return ok({ perangkat: await daftarPerangkat(db, { userId, batas: 1000 }) });
    if (tab === "peringatan") {
      return ok({ peringatan: await peringatanTerbaru(db, getNumberSearchParam(request, "hari") ?? 7), setelan: await bacaSetelanJejak(db) });
    }

    const csv = getSearchParam(request, "format") === "csv";
    const hasil = await cariJejak(db, {
      dari: getSearchParam(request, "dari"),
      sampai: getSearchParam(request, "sampai"),
      userId,
      peran: getSearchParam(request, "peran"),
      peristiwa: getSearchParamArray(request, "peristiwa"),
      jalur: getSearchParam(request, "jalur"),
      ip: getSearchParam(request, "ip"),
      perangkatId: getSearchParam(request, "perangkatId"),
      hanyaGagal: getBooleanSearchParam(request, "hanyaGagal"),
      halaman: csv ? 1 : getNumberSearchParam(request, "halaman"),
      perHalaman: csv ? 5000 : getNumberSearchParam(request, "perHalaman"),
    });
    if (csv) {
      return new Response(jejakKeCsv(hasil.baris), {
        headers: {
          "content-type": "text/csv; charset=utf-8",
          "content-disposition": `attachment; filename="riwayat-masuk-${new Date().toISOString().slice(0, 10)}.csv"`,
          "cache-control": "no-store",
        },
      });
    }
    return ok(hasil);
  } catch (error) {
    return handleRouteError(error);
  }
}
