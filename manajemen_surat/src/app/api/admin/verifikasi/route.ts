import { type NextRequest } from "next/server";

import { roles } from "@/lib/mock-data";
import { getDatabase } from "@/server/db/client";
import { pastikanAksi } from "@/server/modules/akses/hak-peran";
import { idPerangkatDariHeader } from "@/server/modules/perangkat/jaringan";
import { catatLolos } from "@/server/modules/verifikasi/layanan";
import {
  MASA_TEPERCAYA_HARI_MAKS,
  aturanBawaanPeran,
  bacaPengaturanVerifikasi,
  saklarMenyala,
  simpanPengaturanVerifikasi,
} from "@/server/modules/verifikasi/pengaturan";
import { appendAuditLog } from "@/server/shared/audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { handleRouteError, ok } from "@/server/shared/http";
import { nextPrefixedId } from "@/server/shared/ids";
import { readJsonBody } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function ringkasan(db: Awaited<ReturnType<typeof getDatabase>>) {
  const p = await bacaPengaturanVerifikasi(db, { tanpaSinggah: true });
  const baris = await db.queryAll<{ role_id: string; n: number | string }>(
    `SELECT u.role_id AS role_id, COUNT(*) AS n FROM aleta_verifikasi_authenticator a JOIN users u ON u.id = a.user_id WHERE a.aktif = 1 AND u.deleted_at IS NULL GROUP BY u.role_id`
  );
  const terdaftar: Record<string, number> = {};
  for (const b of baris) terdaftar[b.role_id] = Number(b.n);
  return {
    pengaturan: p,
    peran: roles.map((r) => ({ id: r.id, nama: r.name ?? r.id, bawaan: aturanBawaanPeran(r.id), terdaftar: terdaftar[r.id] ?? 0 })),
    masaTepercayaMaks: MASA_TEPERCAYA_HARI_MAKS,
  };
}

/**
 * Verifikasi dua langkah (E5) - Super Admin (aksi "verifikasi.atur").
 *   GET   -> pengaturan + aturan bawaan tiap peran + jumlah authenticator terdaftar
 *   POST  -> simpan {otpWhatsapp, authenticator, aturanPeran, subnetKantor, masaTepercayaHari}
 * Saat saklar DINYALAKAN, perangkat Super Admin yang menyalakannya langsung
 * dipercaya (tidak terkunci di luar), dan perubahan tercatat di audit.
 */
export async function GET(request: NextRequest) {
  try {
    const db = await getDatabase();
    await pastikanAksi(db, await resolveActorUserId(request), "verifikasi.atur");
    return ok(await ringkasan(db));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const db = await getDatabase();
    const actor = await pastikanAksi(db, await resolveActorUserId(request), "verifikasi.atur");
    const badan = await readJsonBody<Record<string, unknown>>(request).catch(() => ({}) as Record<string, unknown>);
    const { sebelum, sesudah } = await simpanPengaturanVerifikasi(db, badan, { id: actor.id, nama: actor.name ?? actor.id });
    if (!saklarMenyala(sebelum) && saklarMenyala(sesudah)) {
      const perangkatId = idPerangkatDariHeader(request.headers);
      if (perangkatId) {
        const kini = new Date();
        await catatLolos(db, {
          userId: actor.id,
          perangkatId,
          jenis: "tepercaya",
          metode: "penyalaan",
          sampai: new Date(kini.getTime() + sesudah.masaTepercayaHari * 86_400_000),
          kini,
        });
      }
    }
    await appendAuditLog(db, {
      id: await nextPrefixedId(db, "audit_logs", "adt"),
      actorUserId: actor.id,
      action: "UPDATE_VERIFIKASI_DUA_LANGKAH",
      entityType: "aleta_ekstensi_setelan",
      entityId: "*sistem*:verifikasi:pengaturan",
      payload: {
        otpWhatsapp: [sebelum.otpWhatsapp, sesudah.otpWhatsapp],
        authenticator: [sebelum.authenticator, sesudah.authenticator],
        aturanPeran: sesudah.aturanPeran,
        subnetKantor: sesudah.subnetKantor,
        masaTepercayaHari: sesudah.masaTepercayaHari,
      },
    });
    return ok(await ringkasan(db));
  } catch (error) {
    return handleRouteError(error);
  }
}
