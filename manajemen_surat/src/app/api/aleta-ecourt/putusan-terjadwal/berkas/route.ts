import { type NextRequest } from "next/server";

import { BATAS } from "@/lib/putusan-terjadwal";
import { getDatabase } from "@/server/db/client";
import { pastikanBolehUnggahPutusan } from "@/server/modules/aleta-ecourt/hak-putusan";
import { buangBerkasTahap, tahapkanBerkas } from "@/server/modules/putusan-terjadwal/layanan";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Berkas putusan untuk unggah terjadwal.
 *
 *   POST multipart: berkas        -> { ok, berkas: { id, nama, bentuk, ukuran, nomorIsi, peringatan[] } }
 *   DELETE ?id=                   -> membuang berkas yang belum dipasang ke jadwal
 *
 * Berkas DIPERIKSA (bentuk dari kepala berkas, nomor perkara dari isi, bukan
 * BAS/PHS/relaas) lalu disimpan di folder penyimpanan yang di-mount - belum
 * ditulis ke SIPP dan belum dijadwalkan. Berkas yang tak pernah dipasang dibuang
 * otomatis sesudah 24 jam. Hak: Super Admin, Admin, Hakim (keputusan 9 Okt).
 */
export async function POST(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    const pelaku = await pastikanBolehUnggahPutusan(db, actorUserId);
    const formulir = await request.formData();
    const berkas = formulir.get("berkas");
    if (!(berkas instanceof File)) return ok({ ok: false, sebab: "Berkasnya belum dipilih." });
    // Ukuran diperiksa SEBELUM dibaca ke memori.
    if (berkas.size > BATAS.ukuranBerkas) {
      return ok({ ok: false, sebab: `Ukuran berkas melampaui ${Math.round(BATAS.ukuranBerkas / 1024 / 1024)} MB.` });
    }
    const hasil = await tahapkanBerkas(db, pelaku, { nama: berkas.name, bita: new Uint8Array(await berkas.arrayBuffer()) });
    return ok(hasil);
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "PUTUSAN_TERJADWAL_BERKAS_GAGAL",
      feature: "aleta_ecourt",
      entityId: "putusan-terjadwal-berkas",
    });
  }
}

export async function DELETE(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    const pelaku = await pastikanBolehUnggahPutusan(db, actorUserId);
    const id = String(request.nextUrl.searchParams.get("id") ?? "").trim();
    if (!id) return ok({ ok: false, sebab: "Berkas belum disebut." });
    return ok(await buangBerkasTahap(db, pelaku, id));
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "PUTUSAN_TERJADWAL_BERKAS_BUANG_GAGAL",
      feature: "aleta_ecourt",
      entityId: "putusan-terjadwal-berkas",
    });
  }
}
