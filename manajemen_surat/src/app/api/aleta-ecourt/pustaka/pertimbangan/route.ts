import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { pastikanAdminIstimewa, pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import {
  asalButir,
  bacaButir,
  cariButir,
  gantikanButir,
  periksaRujukan,
  ringkasPustaka,
  rujukanButir,
  sahkanButir,
  serapPertimbangan,
  tolakButir,
  aturLabelButir,
  tambahKalimatPustaka,
  type Butir,
} from "@/server/modules/aleta-ecourt/pustaka-pertimbangan";
import { daftarKamus } from "@/server/modules/aleta-ecourt/kamus-deteksi";
import { usulLabelKalimat } from "@/lib/kamus-deteksi";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { getSearchParam } from "@/server/shared/request";
import { ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Pustaka pertimbangan hukum.
 *
 *   GET                                 ringkasan jumlah butir tiap keadaan
 *   GET ?cari=verstek                   butir yang sudah disahkan
 *   GET ?keadaan=usulan                 butir yang menunggu pengesahan
 *   GET ?butirId=...                    satu butir beserta rujukan dan asalnya
 *
 *   POST {tindakan:"serap", perkaraId}  menyerap pertimbangan satu perkara
 *   POST {tindakan:"periksa", butirId}  memeriksa rujukan terhadap pustaka hukum
 *   POST {tindakan:"sahkan", ...}       mengesahkan, WAJIB menyebut atas perintah siapa
 *   POST {tindakan:"tolak", ...}        menolak, wajib beralasan
 *   POST {tindakan:"ganti", ...}        versi baru menggantikan yang lama
 *
 *   D3 (10 Okt 2026) - label kalimat untuk templat P6/P7:
 *   GET ?bagian=keterangan-saksi&labelAlasan=F&labelKeadaan=pisah-rumah
 *   POST {tindakan:"label", butirId, bagian, labelAlasan[], labelKeadaan[]}
 *   POST {tindakan:"tambah", teks, bagian, jenisPerkara, labelAlasan[], labelKeadaan[]}
 *   POST {tindakan:"usul-label", butirId | teks}  usulan label dari kamus deteksi
 *                                                (tidak disimpan)
 *
 * ============================================================================
 * MEMBACA BOLEH LUAS, MENGUBAH TIDAK
 * ============================================================================
 *
 * Hakim dan panitera membaca pustaka untuk menyusun - itu memang gunanya.
 * Mengubahnya menuntut kewenangan admin: satu butir yang keliru salah di
 * SETIAP putusan yang memakainya, dengan rapi dan tanpa ada yang memeriksanya
 * lagi karena "sudah ada di pustaka".
 */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanKapabilitas(db, actorUserId, "panel");

    const butirId = String(getSearchParam(request, "butirId") ?? "").trim();
    const cari = String(getSearchParam(request, "cari") ?? "").trim();
    const keadaan = String(getSearchParam(request, "keadaan") ?? "").trim();
    const jenisPerkara = String(getSearchParam(request, "jenisPerkara") ?? "").trim();
    const minimal = Number(getSearchParam(request, "minimalPemakaian") ?? "0") || 0;
    const bagian = String(getSearchParam(request, "bagian") ?? "").trim();
    const labelAlasan = String(getSearchParam(request, "labelAlasan") ?? "").trim();
    const labelKeadaan = String(getSearchParam(request, "labelKeadaan") ?? "").trim();

    if (butirId) {
      const butir = await bacaButir(db, butirId);
      if (!butir) return ok({ ada: false, sebab: "Butir tidak ditemukan." });
      return ok({
        ada: true,
        butir,
        rujukan: await rujukanButir(db, butirId),
        asal: await asalButir(db, butirId),
      });
    }

    if (cari || keadaan || jenisPerkara || minimal || bagian || labelAlasan || labelKeadaan) {
      const butir = await cariButir(db, {
        cari,
        jenisPerkara,
        minimalPemakaian: minimal,
        keadaan: (keadaan || "disahkan") as Butir["keadaan"],
        bagian,
        labelAlasan,
        labelKeadaan,
      });
      return ok({ ada: true, jumlah: butir.length, butir });
    }

    return ok({ ada: true, ringkasan: await ringkasPustaka(db) });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "PUSTAKA_PERTIMBANGAN_BACA_FAILED",
      feature: "aleta_ecourt",
      entityId: "pustaka-pertimbangan",
    });
  }
}

type Masukan = {
  tindakan?: string;
  perkaraId?: string;
  butirId?: string;
  atasPerintah?: string;
  isu?: string;
  syarat?: Record<string, unknown>;
  alasan?: string;
  teksBaru?: string;
  bagian?: string;
  labelAlasan?: unknown;
  labelKeadaan?: unknown;
  teks?: string;
  jenisPerkara?: string;
};

export async function POST(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanAdminIstimewa(db, actorUserId, "mengubah pustaka pertimbangan");

    const masukan = (await request.json()) as Masukan;
    const aktor = String(actorUserId ?? "");

    switch (String(masukan.tindakan ?? "")) {
      case "serap":
        return ok(await serapPertimbangan(db, aktor, String(masukan.perkaraId ?? "")));

      case "periksa":
        return ok({ ok: true, ...(await periksaRujukan(db, String(masukan.butirId ?? ""))) });

      case "sahkan":
        return ok(
          await sahkanButir(db, aktor, {
            butirId: String(masukan.butirId ?? ""),
            atasPerintah: String(masukan.atasPerintah ?? ""),
            isu: String(masukan.isu ?? ""),
            syarat: masukan.syarat ?? {},
          })
        );

      case "tolak":
        return ok(await tolakButir(db, String(masukan.butirId ?? ""), String(masukan.alasan ?? "")));

      case "ganti":
        return ok(
          await gantikanButir(db, aktor, {
            butirId: String(masukan.butirId ?? ""),
            teksBaru: String(masukan.teksBaru ?? ""),
            atasPerintah: String(masukan.atasPerintah ?? ""),
            isu: String(masukan.isu ?? ""),
            syarat: masukan.syarat,
          })
        );

      /* === KAMUS-DB 10 Okt === D3 */
      case "label":
        return ok(
          await aturLabelButir(db, aktor, {
            butirId: String(masukan.butirId ?? ""),
            bagian: masukan.bagian,
            labelAlasan: masukan.labelAlasan,
            labelKeadaan: masukan.labelKeadaan,
          })
        );

      case "tambah":
        return ok(
          await tambahKalimatPustaka(db, aktor, {
            teks: String(masukan.teks ?? ""),
            bagian: masukan.bagian,
            jenisPerkara: String(masukan.jenisPerkara ?? ""),
            labelAlasan: masukan.labelAlasan,
            labelKeadaan: masukan.labelKeadaan,
          })
        );

      case "usul-label": {
        const butir = masukan.butirId ? await bacaButir(db, String(masukan.butirId)) : null;
        const kalimat = butir?.teks ?? String(masukan.teks ?? "");
        if (!kalimat.trim()) return ok({ ok: false, sebab: "Kalimat tidak ditemukan." });
        const kamus = await daftarKamus(db);
        const pola = kamus.kelompok.flatMap((k) => k.pola.map((p) => ({ ...p, kelompok: k.kelompok })));
        return ok({ ok: true, ...usulLabelKalimat(kalimat, pola) });
      }
      /* === AKHIR KAMUS-DB === */

      default:
        return ok({ ok: false, sebab: "Tindakan tidak dikenali." });
    }
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "PUSTAKA_PERTIMBANGAN_UBAH_FAILED",
      feature: "aleta_ecourt",
      entityId: "pustaka-pertimbangan",
    });
  }
}
