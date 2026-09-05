import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { pastikanAdminIstimewa, pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import {
  AKAR_PERATURAN,
  bagianPeraturan,
  berlakuPada,
  bukaJangkar,
  cabutPeraturan,
  cariPasal,
  daftarPeraturan,
  daftarkanPeraturan,
  peraturanTopik,
  sahkanPeraturan,
  serapNaskah,
  tautkanTopik,
} from "@/server/modules/aleta-ecourt/pustaka-hukum";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { getSearchParam } from "@/server/shared/request";
import { ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Pustaka hukum - peraturan, pasal, keberlakuan, dan topik.
 *
 *   GET                              seluruh peraturan terdaftar
 *   GET ?cari=nafkah                 mencari pasal yang sudah disahkan
 *   GET ?cari=...&semua=1            termasuk yang belum disahkan, untuk diperiksa
 *   GET ?jangkar=uu-1-1974/pasal-39  membuka satu pasal lewat alamat tetapnya
 *   GET ?berlakuPada=2015-06-01      peraturan yang berlaku pada tanggal itu
 *   GET ?topik=cerai-gugat           peraturan yang tertaut pada topik itu
 *   GET ?peraturanId=...&bagian=1    seluruh bagian satu peraturan
 *
 *   POST {tindakan:"daftar", ...}    mendaftarkan peraturan baru
 *   POST {tindakan:"serap", ...}     membaca naskah dari berkas PDF
 *   POST {tindakan:"sahkan", ...}    mengesahkan setelah dibandingkan
 *   POST {tindakan:"cabut", ...}     mencabut, menyebut penggantinya
 *   POST {tindakan:"topik", ...}     menautkan ke topik
 *
 * ============================================================================
 * MENGESAHKAN MENUNTUT KEWENANGAN YANG LEBIH BESAR DARIPADA MEMBACA
 * ============================================================================
 *
 * Membaca pustaka cukup dengan kapabilitas panel - itu keterangan hukum yang
 * memang untuk dibaca. MENGUBAHNYA menuntut kewenangan admin: satu pasal yang
 * keliru masuk pustaka akan salah di setiap putusan yang merujuknya.
 */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanKapabilitas(db, actorUserId, "panel");

    const cari = String(getSearchParam(request, "cari") ?? "").trim();
    const jangkar = String(getSearchParam(request, "jangkar") ?? "").trim();
    const pada = String(getSearchParam(request, "berlakuPada") ?? "").trim();
    const topik = String(getSearchParam(request, "topik") ?? "").trim();
    const peraturanId = String(getSearchParam(request, "peraturanId") ?? "").trim();
    const bagian = String(getSearchParam(request, "bagian") ?? "").trim();
    const semua = String(getSearchParam(request, "semua") ?? "").trim() === "1";

    if (jangkar) {
      const isi = await bukaJangkar(db, jangkar);
      return ok({ ada: Boolean(isi), bagian: isi });
    }

    if (peraturanId && bagian) {
      return ok({ ada: true, bagian: await bagianPeraturan(db, peraturanId) });
    }

    if (cari) {
      return ok({ ada: true, cari, temuan: await cariPasal(db, cari, { hanyaDisahkan: !semua, peraturanId }) });
    }

    if (pada) return ok({ ada: true, tanggal: pada, peraturan: await berlakuPada(db, pada, !semua) });

    if (topik) return ok({ ada: true, topik, peraturan: await peraturanTopik(db, topik, !semua) });

    return ok({ ada: true, peraturan: await daftarPeraturan(db, false) });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "PUSTAKA_HUKUM_BACA_FAILED",
      feature: "aleta_ecourt",
      entityId: "pustaka-hukum",
    });
  }
}

type Masukan = {
  tindakan?: string;
  jenisId?: string;
  judul?: string;
  judulPendek?: string;
  nomor?: string;
  tahun?: number;
  penerbit?: string;
  berlakuSejak?: string;
  diundangkan?: string;
  peraturanId?: string;
  berkas?: string;
  tanggalCabut?: string;
  penggantiId?: string;
  topikId?: string;
  catatan?: string;
};

export async function POST(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    // Mengubah pustaka menuntut kewenangan admin, bukan sekadar panel.
    await pastikanAdminIstimewa(db, actorUserId, "mengubah pustaka hukum");

    const masukan = (await request.json()) as Masukan;
    const aktor = String(actorUserId ?? "");

    switch (String(masukan.tindakan ?? "")) {
      case "daftar":
        return ok({ ok: true, peraturan: await daftarkanPeraturan(db, aktor, masukan as never) });

      case "serap": {
        // Jalur berkas ditentukan di sini, bukan diterima apa adanya dari
        // pemanggil. Menerima jalur bebas berarti rute ini dapat membaca berkas
        // mana pun di dalam wadah, dan itu bukan kewenangan yang diminta.
        const akar = AKAR_PERATURAN;
        const nama = String(masukan.berkas ?? "").trim();
        if (!nama || nama.includes("..") || nama.includes("\0")) {
          return ok({ ok: false, sebab: "Nama berkas tidak sah." });
        }
        return ok(await serapNaskah(db, aktor, String(masukan.peraturanId ?? ""), `${akar}/${nama}`));
      }

      case "sahkan":
        return ok({ ok: await sahkanPeraturan(db, aktor, String(masukan.peraturanId ?? "")) });

      case "cabut":
        return ok({
          ok: await cabutPeraturan(
            db,
            String(masukan.peraturanId ?? ""),
            String(masukan.tanggalCabut ?? ""),
            String(masukan.penggantiId ?? "")
          ),
        });

      case "topik":
        return ok({
          ok: await tautkanTopik(
            db,
            aktor,
            String(masukan.peraturanId ?? ""),
            String(masukan.topikId ?? ""),
            String(masukan.catatan ?? "")
          ),
        });

      default:
        return ok({ ok: false, sebab: "Tindakan tidak dikenali." });
    }
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "PUSTAKA_HUKUM_UBAH_FAILED",
      feature: "aleta_ecourt",
      entityId: "pustaka-hukum",
    });
  }
}
