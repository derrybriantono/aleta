import { type NextRequest } from "next/server";

import { KELOMPOK_BAKU, ujiPolaAtasTeks } from "@/lib/kamus-deteksi";
import { getDatabase } from "@/server/db/client";
import { pastikanAdminIstimewa } from "@/server/modules/aleta-ecourt/akses";
import {
  AMBANG_CALON,
  HASIL_KOREKSI,
  SUMBER_SAMPEL,
  bacaJejakKoreksi,
  daftarCalon,
  daftarKamus,
  dorongLapisKeBot,
  kembalikanKeBenih,
  petaPolaDikenal,
  ringkasKoreksi,
  simpanPola,
  simpanTemplat,
  susunCalon,
  terimaCalon,
  tolakCalon,
  ubahStatusKamus,
  ujiPolaAtasSampel,
} from "@/server/modules/aleta-ecourt/kamus-deteksi";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ApiError } from "@/server/shared/errors";
import { ok } from "@/server/shared/http";
import { getSearchParam } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Kamus deteksi & kalimat - layar Admin (P9), 10 Okt 2026.
 *
 *   GET                       pola & templat per kelompok (benih + database,
 *                             tanda asal), angka ukur + lapangan, keselarasan
 *                             lapis bot, ringkasan jejak koreksi
 *   GET ?bagian=calon&keadaan=menunggu|diterima|ditolak
 *                             calon dari koreksi berulang (P8) - disusun ulang
 *                             dulu dari jejak koreksi
 *   GET ?bagian=jejak&variabel=&kodePola=&koreksi=1
 *                             jejak koreksi terbaru (D2)
 *
 *   POST {tindakan: "simpan-pola" | "simpan-templat", ...butir}
 *   POST {tindakan: "status", jenis, kode, status}        aktif/draf/nonaktif
 *   POST {tindakan: "kembalikan", jenis, kode}            buang baris penimpa benih
 *   POST {tindakan: "uji", regex, flags, contoh: []}      uji atas contoh diketik
 *   POST {tindakan: "uji-sampel", regex, flags, sumber, batas, noVar}
 *   POST {tindakan: "terima-calon", id, status, ...isian} jadi pola/templat aktif/draf
 *   POST {tindakan: "tolak-calon", id, alasan}
 *   POST {tindakan: "kirim-ke-bot"}                       dorong ulang lapis ke bot
 *
 * HANYA Super Admin dan Admin - termasuk membaca: isinya pola yang menentukan
 * apa yang diusulkan ke blangko, dan uji sampel menampilkan cuplikan
 * keterangan saksi sungguhan.
 *
 * Setiap perubahan langsung didorong ke bot; hasil dorongnya ikut dijawab
 * (gagal dorong tidak membatalkan simpan - instrumentation mengulangnya).
 */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanAdminIstimewa(db, actorUserId, "membuka kamus deteksi & kalimat");
    const bagian = getSearchParam(request, "bagian") ?? "";

    if (bagian === "calon") {
      const kamus = await daftarKamus(db);
      const susun = await susunCalon(db, petaPolaDikenal(kamus.kelompok));
      return ok({ susun, ambang: AMBANG_CALON, calon: await daftarCalon(db, getSearchParam(request, "keadaan") ?? "menunggu") });
    }
    if (bagian === "jejak") {
      return ok({
        jejak: await bacaJejakKoreksi(db, {
          variabel: getSearchParam(request, "variabel") ?? "",
          kodePola: getSearchParam(request, "kodePola") ?? "",
          hanyaKoreksi: getSearchParam(request, "koreksi") === "1",
          batas: Number(getSearchParam(request, "batas") ?? 100),
        }),
        ringkas: await ringkasKoreksi(db),
      });
    }

    const kamus = await daftarKamus(db);
    return ok({
      ...kamus,
      ringkasKoreksi: await ringkasKoreksi(db),
      label: { kelompokBaku: KELOMPOK_BAKU, sumberSampel: SUMBER_SAMPEL, hasilKoreksi: HASIL_KOREKSI },
    });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "KAMUS_DETEKSI_READ_FAILED",
      feature: "aleta_ecourt",
      entityId: "kamus-deteksi",
    });
  }
}

async function bacaBadan(request: NextRequest): Promise<Record<string, unknown>> {
  try {
    const isi = (await request.json()) as unknown;
    return isi && typeof isi === "object" && !Array.isArray(isi) ? (isi as Record<string, unknown>) : {};
  } catch {
    throw new ApiError(400, "Badan permintaan harus JSON.");
  }
}

export async function POST(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanAdminIstimewa(db, actorUserId, "mengubah kamus deteksi & kalimat");
    const badan = await bacaBadan(request);
    const aktor = String(actorUserId ?? "");
    const tindakan = String(badan.tindakan ?? "");

    // Tindakan baca-saja: tidak mengubah apa pun, tidak mendorong.
    if (tindakan === "uji") {
      const contoh = Array.isArray(badan.contoh) ? badan.contoh.map((x) => String(x ?? "")) : String(badan.contoh ?? "").split("\n");
      const hasil = ujiPolaAtasTeks(String(badan.regex ?? ""), badan.flags === undefined ? "i" : String(badan.flags), contoh);
      if (!hasil.ok) throw new ApiError(400, hasil.galat);
      return ok(hasil);
    }
    if (tindakan === "uji-sampel") return ok(await ujiPolaAtasSampel(badan));

    let hasil: unknown;
    switch (tindakan) {
      case "simpan-pola":
        hasil = await simpanPola(db, aktor, badan);
        break;
      case "simpan-templat":
        hasil = await simpanTemplat(db, aktor, badan);
        break;
      case "status":
        hasil = await ubahStatusKamus(db, aktor, {
          jenis: String(badan.jenis ?? ""),
          kode: String(badan.kode ?? ""),
          status: String(badan.status ?? ""),
        });
        break;
      case "kembalikan":
        hasil = await kembalikanKeBenih(db, { jenis: String(badan.jenis ?? ""), kode: String(badan.kode ?? "") });
        break;
      case "terima-calon":
        hasil = await terimaCalon(db, aktor, badan);
        break;
      case "tolak-calon":
        // Menolak tidak mengubah lapis - tidak perlu didorong.
        return ok({ hasil: await tolakCalon(db, aktor, badan) });
      case "kirim-ke-bot":
        hasil = null;
        break;
      default:
        throw new ApiError(400, "Tindakan tidak dikenali.");
    }
    const dorong = await dorongLapisKeBot(db);
    return ok({ hasil, dorong });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "KAMUS_DETEKSI_UPDATE_FAILED",
      feature: "aleta_ecourt",
      entityId: "kamus-deteksi",
    });
  }
}
