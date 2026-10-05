import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { bersihkanNomor, kalimatAlasan, panggilBot } from "@/server/modules/aleta-ecourt/ecourt-aksi";
import { periksaAkunSippTerbuka } from "@/server/modules/aleta-ecourt/ecourt-akun-pengguna";
import { requireActorUser } from "@/server/modules/organization/service";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export type AkunPutusanEcourt = {
  nama: string;
  peran: string;
  tersambung: boolean;
  sumber: "pribadi" | "bersama";
};

export type SalinanPutusanEcourt = {
  sudahDiunggah: boolean;
  tanggal: string;
  olehNama: string;
  sudahTte?: boolean;
  diperiksaPada?: string;
};

/**
 * KONTRAK K6 (butir 16b): akun e-Court yang sesinya AKAN dipakai untuk
 * mengunggah salinan putusan atas nama pengguna ALETA ini, plus keadaan
 * salinannya di e-Court menurut penarikan terakhir.
 *
 *   GET ?nomor=<nomor perkara>
 *   -> { ok, akun: { nama, peran, tersambung, sumber } | null, alasan, pesan,
 *        salinan: { sudahDiunggah, tanggal, olehNama } | null }
 *
 * Hanya sesi PRIBADI yang dipakai untuk menulis; tidak ada = akun null + alasan.
 * Membaca saja - tidak menyentuh e-Court.
 */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    const actor = await requireActorUser(db, actorUserId);
    const nomor = bersihkanNomor(request.nextUrl.searchParams.get("nomor"));
    // Butir 20: akun SIPP yang terbuka di halaman (dikirim panel ekstensi)
    // tidak boleh milik pengguna ALETA lain - lihat ecourt-akun-pengguna.ts.
    const sipp = await periksaAkunSippTerbuka(db, actor.id, request.nextUrl.searchParams.get("olehUsername"));
    if (!sipp.ok) {
      return ok({ ok: true, akun: null, salinan: null, alasan: sipp.alasan, pesan: kalimatAlasan(sipp.alasan) });
    }
    const q = new URLSearchParams({ penggunaId: actor.id, nomor });
    const hasil = await panggilBot<{
      ok: boolean;
      akun: (AkunPutusanEcourt & { kodePeran?: string }) | null;
      alasan?: string;
      salinan: SalinanPutusanEcourt | null;
    }>(`/ecourt-putusan/akun?${q.toString()}`);
    if (!hasil.ok) {
      return ok({ ok: false, akun: null, salinan: null, alasan: hasil.alasan, pesan: kalimatAlasan(hasil.alasan) });
    }
    const a = hasil.data.akun;
    return ok({
      ok: true,
      akun: a ? { nama: a.nama, peran: a.peran, tersambung: Boolean(a.tersambung), sumber: a.sumber || "pribadi" } : null,
      alasan: String(hasil.data.alasan || ""),
      pesan: kalimatAlasan(hasil.data.alasan),
      salinan: hasil.data.salinan ?? null,
    });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "ECOURT_PUTUSAN_AKUN_READ_FAILED",
      feature: "ecourt_aksi",
      entityId: "putusan-akun",
    });
  }
}
