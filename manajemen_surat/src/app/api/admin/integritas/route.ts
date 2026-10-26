import { type NextRequest } from "next/server";

import { bolehAksi } from "@/lib/matriks-peran";
import { getDatabase } from "@/server/db/client";
import { pastikanAksi } from "@/server/modules/akses/hak-peran";
import { daftarTemuan, ringkasIntegritas, sedangMemindai } from "@/server/modules/integritas/layanan";
import { bacaPengaturanIntegritas, simpanPengaturanIntegritas } from "@/server/modules/integritas/pengaturan";
import { appendAuditLog } from "@/server/shared/audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { handleRouteError, ok } from "@/server/shared/http";
import { nextPrefixedId } from "@/server/shared/ids";
import { readJsonBody } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function isi(db: Awaited<ReturnType<typeof getDatabase>>, boleh: boolean) {
  const [ringkas, temuan, pengaturan] = await Promise.all([ringkasIntegritas(db), daftarTemuan(db, { status: "semua", batas: 300 }), bacaPengaturanIntegritas(db, { tanpaSinggah: true })]);
  return {
    ringkas,
    temuan,
    memindai: sedangMemindai(),
    // Daftar jalur folder hanya untuk yang boleh mengaturnya; Admin hanya melihat namanya.
    pengaturan: boleh ? pengaturan : { ...pengaturan, folder: pengaturan.folder.map((f) => ({ ...f, jalur: "(disembunyikan)", unggahan: [] })), halamanPublik: [] },
    boleh,
  };
}

/**
 * Penjaga integritas berkas (E6).
 *   GET   -> Super Admin & Admin ("integritas.lihat"): ringkasan + temuan
 *   POST  -> Super Admin ("integritas.atur"): simpan {aktif, folder, halamanPublik, selangMenit, peringatanWa, lewati}
 * Folder hanya DIBACA oleh ALETA. Mati bawaan.
 */
export async function GET(request: NextRequest) {
  try {
    const db = await getDatabase();
    const actor = await pastikanAksi(db, await resolveActorUserId(request), "integritas.lihat");
    return ok(await isi(db, bolehAksi(actor, "integritas.atur")));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const db = await getDatabase();
    const actor = await pastikanAksi(db, await resolveActorUserId(request), "integritas.atur");
    const badan = await readJsonBody<Record<string, unknown>>(request).catch(() => ({}) as Record<string, unknown>);
    const { sebelum, sesudah } = await simpanPengaturanIntegritas(db, badan, { id: actor.id, nama: actor.name ?? actor.id });
    await appendAuditLog(db, {
      id: await nextPrefixedId(db, "audit_logs", "adt"),
      actorUserId: actor.id,
      action: "UPDATE_PENJAGA_INTEGRITAS",
      entityType: "aleta_ekstensi_setelan",
      entityId: "*sistem*:integritas:pengaturan",
      payload: {
        aktif: [sebelum.aktif, sesudah.aktif],
        folder: sesudah.folder.map((f) => ({ nama: f.nama, jalur: f.jalur, jenis: f.jenis })),
        halamanPublik: sesudah.halamanPublik.length,
        selangMenit: sesudah.selangMenit,
        peringatanWa: sesudah.peringatanWa,
      },
    });
    return ok(await isi(db, true));
  } catch (error) {
    return handleRouteError(error);
  }
}
