import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import { pastikanAksi } from "@/server/modules/akses/hak-peran";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ApiError } from "@/server/shared/errors";
import { ok } from "@/server/shared/http";

import { bacaKtpDariBerkas, jenisBerkasKtp } from "@/server/modules/aleta-ecourt/ktp-ocr";

import { uraiTeksIdentitas } from "./urai-ktp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Badan JSON paling besar (data URL base64 gambar/PDF ~6 MB + bungkus). */
const BATAS_BADAN = 8_500_000;
/** Gambar/PDF sesudah didekode. Foto ponsel 12 MP berkualitas JPEG wajar < 5 MB. */
const BATAS_GAMBAR = 6 * 1024 * 1024;
const BATAS_TEKS = 20_000;

/**
 * Isi data saksi/pihak dari foto KTP atau blangko (perbaikan 2 Okt 2026 butir
 * 16, kontrak K5).
 *
 *   POST { gambar: "data:image/jpeg;base64,..." }   -> OCR di server (bila ada)
 *   POST { teks: "NIK : ...\nNama : ..." }           -> diurai langsung
 *
 * Jawabannya USULAN medan untuk DITINJAU petugas di ekstensi; rute ini tidak
 * menulis ke SIPP, tidak menulis ke basis data ALETA, dan tidak mencatat isi
 * apa pun. FOTO KTP TIDAK DISIMPAN: bufer gambar hanya hidup selama
 * permintaan ini, dialirkan ke OCR lewat stdin, lalu ditimpa nol.
 *
 * Tanpa mesin OCR di server (keadaan 2 Okt 2026 - lihat ocr.ts) jawabannya
 * terus terang { ok:false, alasan:"ocr_belum_tersedia" } - tidak ada tebakan.
 */
export async function POST(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  let gambar: Buffer | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanKapabilitas(db, actorUserId, "panel");
    await pastikanAksi(db, actorUserId, "status.data-pihak"); // 18 Okt 2026: matriks hak akses

    const mentah = await request.text();
    if (mentah.length > BATAS_BADAN) throw new ApiError(413, "Gambar terlalu besar. Kecilkan fotonya (paling besar 6 MB).");
    let badan: Record<string, unknown>;
    try {
      badan = JSON.parse(mentah || "{}") as Record<string, unknown>;
    } catch {
      throw new ApiError(400, "Permintaan tidak dapat dibaca.");
    }

    const teksMasuk = typeof badan.teks === "string" ? badan.teks : "";
    const gambarMasuk = typeof badan.gambar === "string" ? badan.gambar : "";

    if (teksMasuk.trim()) {
      const teks = teksMasuk.slice(0, BATAS_TEKS);
      const urai = uraiTeksIdentitas(teks);
      if (!urai.terbaca.length) {
        return ok({
          available: true,
          ok: false,
          alasan: "tidak_terbaca",
          pesan: "Tidak satu pun label KTP/blangko (NIK, Nama, Alamat, ...) ditemukan di teks itu.",
        });
      }
      return ok({ available: true, ok: true, sumber: "teks", medan: urai.medan, nik: urai.nik, catatan: urai.catatan, terbaca: urai.terbaca });
    }
    if (!gambarMasuk) throw new ApiError(400, "Kirim gambar/PDF KTP atau blangko, atau teksnya.");

    const base64 = gambarMasuk.replace(/^data:[^;,]*;base64,/, "");
    if (!/^[A-Za-z0-9+/=\s]+$/.test(base64)) throw new ApiError(400, "Isi berkas tidak sah.");
    gambar = Buffer.from(base64, "base64");
    if (gambar.length > BATAS_GAMBAR) throw new ApiError(413, "Berkas terlalu besar. Kecilkan fotonya (paling besar 6 MB).");
    const bentuk = jenisBerkasKtp(gambar);
    if (!bentuk) throw new ApiError(400, "Berkas bukan gambar JPEG/PNG/WEBP/BMP atau PDF.");

    const hasil = await bacaKtpDariBerkas(gambar, bentuk);
    if (hasil.alasan === "pdf_rusak") throw new ApiError(400, hasil.pesan || "Berkas PDF tidak dapat dibuka.");
    const teks = hasil.teks.slice(0, 4000);
    if (!hasil.ok) {
      return ok({
        available: true,
        ok: false,
        alasan: hasil.alasan,
        pesan: hasil.pesan,
        teks: teks || undefined,
      });
    }
    return ok({
      available: true,
      ok: true,
      sumber: hasil.sumber,
      mesin: hasil.mesin || undefined,
      medan: hasil.medan,
      nik: hasil.nik,
      catatan: hasil.catatan,
      terbaca: hasil.terbaca,
      // Teks hasil baca dipulangkan supaya petugas dapat membetulkan dan
      // membaca ulang - tidak disimpan di mana pun.
      teks,
    });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "SAKSI_SCAN_FAILED",
      feature: "aleta_ecourt",
    });
  } finally {
    // Foto KTP tidak boleh hidup lebih lama dari permintaannya.
    if (gambar) gambar.fill(0);
    gambar = null;
  }
}
