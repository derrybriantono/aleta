import { pastikanAksi } from "@/server/modules/akses/hak-peran";
import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { pastikanBolehUnggahPutusan } from "@/server/modules/aleta-ecourt/hak-putusan";
import { ringkasanFormBerkas } from "@/server/modules/putusan-terjadwal/layanan";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ok } from "@/server/shared/http";
import { readJsonBody } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Ringkasan pilihan form Putusan Akhir (status putusan, verstek) yang AKAN dipilih
 * ALETA untuk berkas-berkas yang sudah diunggah, supaya diperiksa/diubah petugas
 * sebelum dijadwalkan. Aturannya sama dengan Putusan Otomatis; hasilnya perkiraan
 * (daftar pilihan sesungguhnya ada di formulir SIPP saat dijalankan).
 *
 *   POST { berkas: [{ berkasId, jenisPerkara? }] }
 *   -> { ok, statusTersedia: string[], ringkasan: { [berkasId]: { ada, sebab, status, verstek } } }
 *
 * Hanya membaca; tidak menulis ke SIPP.
 */
export async function POST(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanAksi(db, actorUserId, "putusan.unggah");
    const pelaku = await pastikanBolehUnggahPutusan(db, actorUserId);
    const badan = await readJsonBody<{ berkas?: Array<{ berkasId?: string; jenisPerkara?: string }> }>(request);
    const daftar = (Array.isArray(badan.berkas) ? badan.berkas : []).map((x) => ({ berkasId: String(x?.berkasId ?? ""), jenisPerkara: String(x?.jenisPerkara ?? "") }));
    return ok({ ok: true, ...(await ringkasanFormBerkas(db, pelaku, daftar)) });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "PUTUSAN_TERJADWAL_RINGKASAN_FORM_GAGAL",
      feature: "aleta_ecourt",
      entityId: "putusan-terjadwal-ringkasan-form",
    });
  }
}
