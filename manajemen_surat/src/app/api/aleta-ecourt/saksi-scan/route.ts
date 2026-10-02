import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ApiError } from "@/server/shared/errors";
import { ok } from "@/server/shared/http";

import { bacaGambar } from "./ocr";
import { uraiTeksIdentitas } from "./urai-ktp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Badan JSON paling besar (data URL base64 gambar ~6 MB + bungkus). */
const BATAS_BADAN = 8_500_000;
/** Gambar sesudah didekode. Foto ponsel 12 MP berkualitas JPEG wajar < 5 MB. */
const BATAS_GAMBAR = 6 * 1024 * 1024;
const BATAS_TEKS = 20_000;

/** JPEG, PNG, WEBP, BMP - dicek dari bait awalnya, bukan dari nama atau tipe kiriman. */
function jenisGambar(b: Buffer): string | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpeg";
  if (b.length >= 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (b.length >= 12 && b.subarray(0, 4).toString("latin1") === "RIFF" && b.subarray(8, 12).toString("latin1") === "WEBP") return "webp";
  if (b.length >= 2 && b[0] === 0x42 && b[1] === 0x4d) return "bmp";
  return null;
}

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

    let teks = "";
    let sumber: "teks" | "ocr" = "teks";
    let mesin = "";

    if (teksMasuk.trim()) {
      teks = teksMasuk.slice(0, BATAS_TEKS);
    } else if (gambarMasuk) {
      const base64 = gambarMasuk.replace(/^data:[^;,]*;base64,/, "");
      if (!/^[A-Za-z0-9+/=\s]+$/.test(base64)) throw new ApiError(400, "Isi gambar tidak sah.");
      gambar = Buffer.from(base64, "base64");
      if (gambar.length > BATAS_GAMBAR) throw new ApiError(413, "Gambar terlalu besar. Kecilkan fotonya (paling besar 6 MB).");
      if (!jenisGambar(gambar)) throw new ApiError(400, "Berkas bukan gambar JPEG/PNG/WEBP/BMP.");

      const hasil = await bacaGambar(gambar);
      if (!hasil.ok) {
        return ok({ available: true, ok: false, alasan: hasil.alasan, pesan: hasil.pesan });
      }
      teks = hasil.teks.slice(0, BATAS_TEKS);
      sumber = "ocr";
      mesin = hasil.mesin;
    } else {
      throw new ApiError(400, "Kirim gambar KTP/blangko atau teksnya.");
    }

    const urai = uraiTeksIdentitas(teks);
    if (!urai.terbaca.length) {
      return ok({
        available: true,
        ok: false,
        alasan: "tidak_terbaca",
        pesan:
          sumber === "ocr"
            ? "Gambar terbaca, tetapi tidak satu pun label KTP/blangko (NIK, Nama, Alamat, ...) ditemukan. Coba foto yang lebih tajam dan lurus, atau ketik teksnya."
            : "Tidak satu pun label KTP/blangko (NIK, Nama, Alamat, ...) ditemukan di teks itu.",
        teks: sumber === "ocr" ? teks.slice(0, 4000) : undefined,
      });
    }
    return ok({
      available: true,
      ok: true,
      sumber,
      mesin: mesin || undefined,
      medan: urai.medan,
      nik: urai.nik,
      catatan: urai.catatan,
      terbaca: urai.terbaca,
      // Teks hasil OCR dipulangkan supaya petugas dapat membetulkan dan
      // membaca ulang - tidak disimpan di mana pun.
      teks: sumber === "ocr" ? teks.slice(0, 4000) : undefined,
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
