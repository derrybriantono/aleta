import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { requireActorUser } from "@/server/modules/organization/service";
import { idPerangkatDariHeader } from "@/server/modules/perangkat/jaringan";
import { cariJejak, daftarPerangkat, sesiAktifAkun } from "@/server/modules/perangkat/laporan";
import { terimaDataEkstensi, type DataEkstensi } from "@/server/modules/perangkat/mac";
import { sesiPemanggil } from "@/server/modules/perangkat/sesi-pemanggil";
import { resolveActorUserId } from "@/server/shared/auth";
import { ApiError } from "@/server/shared/errors";
import { handleRouteError, ok } from "@/server/shared/http";
import { readJsonBody } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Perangkat MILIK PEMANGGIL SENDIRI (halaman Akun, 23 Okt 2026): perangkat
 * yang sedang masuk, semua perangkat yang pernah dipakai, dan 50 peristiwa
 * masuk terakhir. Tidak ada ruas yang menyebut akun lain - riwayat orang lain
 * hanya lewat /api/admin/jejak-masuk.
 */
export async function GET(request: NextRequest) {
  try {
    const db = await getDatabase();
    const actor = await requireActorUser(db, await resolveActorUserId(request));
    const sesi = await sesiPemanggil(request.headers);
    const perangkatIni = idPerangkatDariHeader(request.headers);
    const [aktif, perangkat, riwayat] = await Promise.all([
      sesiAktifAkun(db, actor.id),
      daftarPerangkat(db, { userId: actor.id, batas: 100 }),
      cariJejak(db, { userId: actor.id, perHalaman: 50 }),
    ]);
    return ok({
      perangkatIni,
      sesiAktif: aktif.map(({ sesiRef, ...r }) => ({ ...r, ini: r.perangkatId === perangkatIni, jumlahSesi: sesiRef.length })),
      perangkat: perangkat.map((p) => ({ ...p, ini: p.perangkat_id === perangkatIni })),
      riwayat: riwayat.baris.map(({ rantai_xff: _x, rincian: _r, ...b }) => b),
      sesiDikenal: Boolean(sesi),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

/**
 * Data perangkat dari ekstensi (pekerja latar): nama komputer, MAC, versi
 * Windows rinci. Ditempel ke perangkat & sesi PEMANGGIL; tanpa sesi = 401.
 * Isinya klaim klien - dicatat beserta sumbernya, tidak dipakai untuk izin.
 */
export async function POST(request: NextRequest) {
  try {
    const db = await getDatabase();
    const sesi = await sesiPemanggil(request.headers);
    if (!sesi) throw new ApiError(401, "Masuk ALETA dulu.");
    const perangkatId = idPerangkatDariHeader(request.headers);
    if (!perangkatId) throw new ApiError(400, "Kuki perangkat tidak ada.");
    const data = await readJsonBody<DataEkstensi>(request).catch(() => ({}) as DataEkstensi);
    const hasil = await terimaDataEkstensi(db, { userId: sesi.userId, sessionId: sesi.sessionId, perangkatId, data: data ?? {} });
    return ok(hasil);
  } catch (error) {
    return handleRouteError(error);
  }
}

/** Label buatan pemilik untuk perangkatnya sendiri ("Laptop rumah"). */
export async function PATCH(request: NextRequest) {
  try {
    const db = await getDatabase();
    const actor = await requireActorUser(db, await resolveActorUserId(request));
    const body = await readJsonBody<{ perangkatId?: string; label?: string }>(request).catch(() => ({}) as { perangkatId?: string; label?: string });
    const label = String(body.label ?? "").replace(/[<>]/g, "").trim().slice(0, 60);
    const r = await db.run("UPDATE aleta_perangkat SET label = ? WHERE perangkat_id = ? AND user_id = ?", [label, String(body.perangkatId ?? ""), actor.id]);
    if (!r.changes) throw new ApiError(404, "Perangkat tidak ditemukan pada akun Anda.");
    return ok({ label });
  } catch (error) {
    return handleRouteError(error);
  }
}
