import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { pastikanAdminIstimewa, pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import {
  jalankanKeajekan,
  perluDijalankan,
  riwayatKeajekan,
} from "@/server/modules/aleta-ecourt/keajekan-berkala";
import {
  bulanDari,
  daftarkanSumber,
  keadaanPagu,
  keberhasilanPustaka,
  rincianBiaya,
  setelPagu,
  sumberTerdaftar,
  temuanSuntingan,
} from "@/server/modules/aleta-ecourt/mutu-dan-biaya";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { getSearchParam } from "@/server/shared/request";
import { ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Mutu, biaya, dan perluasan (K1-K7).
 *
 *   GET ?biaya=1&bulan=2026-09     rincian biaya bulan itu, dipecah per pekerjaan
 *   GET ?pagu=1                    keadaan pagu bulan berjalan
 *   GET ?keberhasilan=1&sejak=..   persentase draf selesai tanpa model
 *   GET ?suntingan=1               butir yang sering ditolak hakim
 *   GET ?sumber=1                  sumber aplikasi yang terdaftar
 *   GET ?keajekan=1                riwayat pemeriksaan keajekan
 *
 *   POST {tindakan:"setelPagu"}    menyetel pagu bulan, WAJIB atas perintah siapa
 *   POST {tindakan:"daftarSumber"} mendaftarkan sumber aplikasi baru
 *   POST {tindakan:"keajekan"}     menjalankan pemeriksaan keajekan
 *
 * ============================================================================
 * MEMBACA TERBUKA, MENGUBAH TIDAK
 * ============================================================================
 *
 * Biaya dan ukuran keberhasilan pantas dibaca siapa pun yang memakai alatnya -
 * hakim yang tahu pagunya tinggal dua puluh persen akan memakainya berbeda,
 * dan itu memang yang diinginkan. Angka yang hanya terlihat admin tidak
 * mengubah perilaku siapa pun.
 *
 * Menyetel pagu dan mendaftarkan sumber baru menuntut admin: keduanya
 * mengenai seluruh pengadilan, bukan satu perkara.
 */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanKapabilitas(db, actorUserId, "panel");

    const bulan = String(getSearchParam(request, "bulan") ?? "").trim() || bulanDari();
    const minta = (nama: string) => String(getSearchParam(request, nama) ?? "").trim() === "1";

    if (minta("biaya")) return ok({ ada: true, rincian: await rincianBiaya(db, bulan) });
    if (minta("pagu")) return ok({ ada: true, bulan, keadaan: await keadaanPagu(db, bulan) });

    if (minta("keberhasilan")) {
      const sejak = String(getSearchParam(request, "sejak") ?? "").trim() || `${bulan}-01T00:00:00.000Z`;
      const sampai = String(getSearchParam(request, "sampai") ?? "").trim() || new Date().toISOString();
      return ok({ ada: true, keberhasilan: await keberhasilanPustaka(db, sejak, sampai) });
    }

    if (minta("suntingan")) return ok({ ada: true, temuan: await temuanSuntingan(db) });
    if (minta("sumber")) return ok({ ada: true, sumber: await sumberTerdaftar(db) });

    if (minta("keajekan")) {
      return ok({
        ada: true,
        riwayat: await riwayatKeajekan(db),
        perlu: await perluDijalankan(db),
      });
    }

    return ok({ ada: false, sebab: "Sebutkan apa yang hendak dibaca." });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "MUTU_BIAYA_BACA_FAILED",
      feature: "aleta_ecourt",
      entityId: "mutu-dan-biaya",
    });
  }
}

type Masukan = {
  tindakan?: string;
  bulan?: string;
  paguRupiah?: number;
  olehNama?: string;
  atasPerintah?: string;
  catatan?: string;
  sumber?: Parameters<typeof daftarkanSumber>[1];
  perkaraId?: string[];
};

export async function POST(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);

    const masukan = (await request.json()) as Masukan;
    const tindakan = String(masukan.tindakan ?? "");
    const aktor = String(actorUserId ?? "");

    // Pemeriksaan keajekan tidak mengubah apa pun kecuali mencatat keadaan -
    // jadi cukup kewenangan panel, sama dengan membaca berkas perkara. Dua
    // tindakan lainnya mengenai seluruh pengadilan.
    if (tindakan === "keajekan") {
      await pastikanKapabilitas(db, actorUserId, "panel");
    } else {
      await pastikanAdminIstimewa(db, actorUserId, "mengubah pagu atau sumber aplikasi");
    }

    switch (tindakan) {
      case "setelPagu":
        return ok(
          await setelPagu(db, {
            bulan: masukan.bulan,
            paguRupiah: Number(masukan.paguRupiah),
            oleh: String(masukan.olehNama ?? "") || aktor,
            atasPerintah: String(masukan.atasPerintah ?? ""),
            catatan: masukan.catatan,
          })
        );

      case "daftarSumber":
        if (!masukan.sumber) return ok({ ok: false, sebab: "Isi sumbernya belum disebut." });
        return ok(await daftarkanSumber(db, masukan.sumber));

      case "keajekan":
        return ok(
          await jalankanKeajekan(db, {
            perkaraId: masukan.perkaraId ?? [],
            oleh: String(masukan.olehNama ?? "") || aktor,
          })
        );

      default:
        return ok({ ok: false, sebab: "Tindakan tidak dikenali." });
    }
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "MUTU_BIAYA_UBAH_FAILED",
      feature: "aleta_ecourt",
      entityId: "mutu-dan-biaya",
    });
  }
}
