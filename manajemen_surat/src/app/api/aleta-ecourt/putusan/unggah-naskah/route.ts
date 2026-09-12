import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import { unggahNaskahPutusan } from "@/server/modules/aleta-ecourt/unggah-naskah-putusan";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Naskah putusan 195 KB; batas ini longgar sepuluh kali lipat. */
const BATAS_UKURAN = 2 * 1024 * 1024;

/**
 * Menerima naskah putusan yang sudah jadi, dan menjadikannya draf ALETA.
 *
 *   POST multipart: berkas, perkaraId, nomorPerkara
 *
 * ============================================================================
 * BERKASNYA TIDAK DISIMPAN, HANYA DIPOTONG
 * ============================================================================
 *
 * Berkas RTF-nya dibaca di memori, dipecah menurut judul bagiannya, lalu
 * dilepas. Yang tersimpan hanya naskah hasil pemotongannya sebagai draf -
 * dan draf itu memang sudah punya tempat, riwayat versi, serta penjagaannya
 * sendiri. Salinan berkas asli di luar SIPP dan e-Court adalah kewajiban
 * penyimpanan baru yang tidak diminta siapa pun.
 *
 * ============================================================================
 * RUTE INI TIDAK MENGISI BORANG SIPP
 * ============================================================================
 *
 * Yang dikembalikannya draf beserta panjang tiap bagiannya. Pengisian borang
 * dikerjakan ekstensi, satu isian satu tombol, sesudah petugas membacanya -
 * dan Simpan tetap ditekan petugas.
 */
export async function POST(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    // Kapabilitas yang sama dengan pengisian borang putusan itu sendiri -
    // yang boleh mengisikannya boleh pula menyiapkan bahannya.
    await pastikanKapabilitas(db, actorUserId, "data-umum");

    const formulir = await request.formData();
    const berkas = formulir.get("berkas");
    if (!(berkas instanceof File)) {
      return ok({ ok: false, sebab: "Berkasnya belum dipilih." });
    }

    // Ukurannya diperiksa SEBELUM dibaca ke memori - memeriksanya sesudah
    // berarti berkas seukuran apa pun sudah terlanjur masuk.
    if (berkas.size > BATAS_UKURAN) {
      return ok({
        ok: false,
        sebab: `Ukuran berkas melampaui ${Math.round(BATAS_UKURAN / 1024 / 1024)} MB. Naskah putusan biasanya di bawah 300 KB; berkas sebesar ini hampir pasti memuat gambar pindaian.`,
      });
    }

    const hasil = await unggahNaskahPutusan(db, String(actorUserId ?? ""), {
      bita: new Uint8Array(await berkas.arrayBuffer()),
      namaBerkas: berkas.name,
      perkaraId: String(formulir.get("perkaraId") ?? ""),
      nomorPerkara: String(formulir.get("nomorPerkara") ?? ""),
      jenisNaskah: String(formulir.get("jenisNaskah") ?? "") || undefined,
    });

    return ok(hasil);
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "PUTUSAN_UNGGAH_NASKAH_GAGAL",
      feature: "aleta_ecourt",
      entityId: "putusan-unggah-naskah",
    });
  }
}
