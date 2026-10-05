import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { pastikanAdminIstimewa, pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import { callAletaBotSippBridge } from "@/server/modules/aleta-sipp/aleta-sipp-datasource";
import {
  bacaBanyak,
  bacaVariabel,
  riwayatSalin,
  salinKamus,
  statistikKamus,
} from "@/server/modules/aleta-ecourt/kamus-variabel";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { getSearchParam } from "@/server/shared/request";
import { ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Kamus variabel ALETA (Tahap 0 - Kemandirian Blangko).
 *
 *   GET                        keadaan kamus: jumlah, pembagian kelas, penyalinan terakhir
 *   GET ?noVar=0046            satu definisi apa adanya
 *   GET ?riwayat=1             riwayat penyalinan
 *   GET ?jenis=0001,0033,...   data_type banyak variabel sekaligus (1.184.0):
 *                              { jenis: { "0033": "multi_sidang", ... }, sumber }
 *                              - langsung dari ABT lewat jembatan bot, cadangan
 *                              salinan kamus ALETA. Dipakai panel ABT supaya
 *                              hanya data_teks/data_tanggal yang diusulkan.
 *
 *   POST {tindakan:"salin"}    menyalin ulang seluruh definisi dari ABT
 *
 * ============================================================================
 * MEMBACA TERBUKA, MENYALIN TIDAK
 * ============================================================================
 *
 * Arti sebuah penanda pantas dibaca siapa pun yang memakai blangko - panitera
 * yang melihat #6034# tertinggal di naskahnya berhak tahu bahwa yang diminta
 * adalah jabatan panitera, bukan namanya, tanpa harus bertanya kepada admin.
 *
 * Menyalin ulang mengubah kamus yang dipakai SELURUH pengadilan sekaligus, dan
 * itu menuntut admin.
 */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanKapabilitas(db, actorUserId, "panel");

    const daftarJenis = String(getSearchParam(request, "jenis") ?? "")
      .split(",")
      .map((x) => x.trim())
      .filter((x) => /^\d{4,5}$/.test(x))
      .slice(0, 300);
    if (daftarJenis.length > 0) return ok(await jenisBanyak(db, daftarJenis));

    const noVar = String(getSearchParam(request, "noVar") ?? "").trim();
    if (noVar) {
      const butir = await bacaVariabel(db, noVar);
      if (!butir) {
        return ok({
          ada: false,
          sebab: `#${noVar}# tidak ada di kamus. Kalau kamus belum pernah disalin, jalankan penyalinan lebih dulu.`,
        });
      }
      return ok({ ada: true, variabel: butir });
    }

    if (String(getSearchParam(request, "riwayat") ?? "").trim() === "1") {
      return ok({ ada: true, riwayat: await riwayatSalin(db) });
    }

    return ok({ ada: true, statistik: await statistikKamus(db) });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "KAMUS_VARIABEL_BACA_FAILED",
      feature: "aleta_ecourt",
      entityId: "kamus-variabel",
    });
  }
}

/**
 * data_type banyak variabel. ABT yang hidup didahulukan - definisi dapat diubah
 * orang di ABT kapan saja; salinan kamus ALETA hanya cadangan bila jembatan
 * bot tidak menjawab. Yang tidak dikenal keduanya tidak disebut sama sekali,
 * supaya pemanggil tahu tipenya BELUM diketahui (bukan "manual").
 */
async function jenisBanyak(db: Awaited<ReturnType<typeof getDatabase>>, daftar: string[]) {
  const jenis: Record<string, string> = {};
  let sumber = "";
  try {
    type Jawab = { ada?: boolean; variabel?: Array<{ noVar: string; jenis: string }> };
    const jawaban = await callAletaBotSippBridge<Jawab>("abt.namaVariabel", { noVar: daftar }, { timeoutMs: 8000 });
    for (const item of jawaban.data?.variabel ?? []) {
      if (item && item.noVar) jenis[String(item.noVar)] = String(item.jenis || "");
    }
    if (Object.keys(jenis).length > 0) sumber = "abt";
  } catch {
    /* jembatan tidak menjawab - kamus salinan di bawah */
  }
  const sisa = daftar.filter((kode) => !(kode in jenis));
  if (sisa.length > 0) {
    try {
      const salinan = await bacaBanyak(db, sisa);
      for (const [kode, butir] of salinan) jenis[kode] = butir.jenis;
      if (salinan.size > 0) sumber = sumber ? `${sumber}+kamus` : "kamus";
    } catch {
      /* kamus belum pernah disalin */
    }
  }
  return { ada: Object.keys(jenis).length > 0, jenis, sumber };
}

type Masukan = {
  tindakan?: string;
  olehNama?: string;
  /** Berapa kali tiap kode muncul di pustaka blangko, bila sudah dihitung. */
  pemakaian?: Record<string, number>;
};

export async function POST(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanAdminIstimewa(db, actorUserId, "menyalin kamus variabel");

    const masukan = (await request.json()) as Masukan;
    if (String(masukan.tindakan ?? "") !== "salin") {
      return ok({ ok: false, sebab: "Tindakan tidak dikenali." });
    }

    const hasil = await salinKamus(db, {
      oleh: String(masukan.olehNama ?? "") || String(actorUserId ?? ""),
      pemakaian: masukan.pemakaian,
    });
    return ok(hasil);
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "KAMUS_VARIABEL_SALIN_FAILED",
      feature: "aleta_ecourt",
      entityId: "kamus-variabel",
    });
  }
}
