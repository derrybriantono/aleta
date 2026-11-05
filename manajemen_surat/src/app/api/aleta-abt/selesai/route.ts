import { type NextRequest } from "next/server";

import { ID_LANGKAH, LANGKAH_SELESAI, type IdLangkah, type JenisBerkasSelesai } from "@/lib/aleta-abt-selesai";
import { aktorSuperAdminAlur, bacaBadanJson, catatAlur, type Db } from "@/server/modules/aleta-abt-alur/penjaga";
import { bacaKeadaanSelesai, bacaSaklarTulis, jalankanSelesaikanBerkas, simpanSaklarTulis } from "@/server/modules/aleta-abt-selesai/service";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { ApiError } from "@/server/shared/errors";
import { ok } from "@/server/shared/http";
import { getSearchParam } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Selesaikan berkas ALETA ABT (5 Nov 2026, Tahap 6). HANYA Super Admin, diputuskan di server.
 *
 *   GET  ?perkaraId=&berkasId=                         keadaan tiap langkah + keadaan saklar tulis ke luar
 *   POST {tindakan:"jalankan", perkaraId, berkasId, jenis, nomorPerkara?, sidangKe?}   menjalankan langkah yang belum selesai           [audit]
 *   POST {tindakan:"ulangi", ..., langkah:["edoc-sipp"]}                               mengulang langkah yang disebut saja            [audit]
 *   POST {tindakan:"saklar", "edoc-sipp"?:bool, ecourt?:bool}                          mengubah saklar tulis ke luar (BAWAAN MATI)      [audit]
 *
 * Langkah PDF salinan dan garis Z/nomor halaman tidak menulis ke luar dan berjalan sungguhan. Langkah e-Doc SIPP dan e-Court MENULIS KE
 * SIPP/e-Court lewat rute yang sudah ada dan hanya berjalan bila saklarnya dinyalakan pemilik; bawaan mati, dan kode ini tidak menyalakannya.
 */
const PESAN = "Selesaikan berkas ALETA ABT hanya untuk Super Admin.";
const JENIS: readonly JenisBerkasSelesai[] = ["putusan", "penetapan", "bas", "relaas"];

function masukan(badan: Record<string, unknown>) {
  const perkaraId = String(badan.perkaraId ?? "").trim();
  const berkasId = String(badan.berkasId ?? "").trim();
  if (!/^\d{1,12}$/.test(perkaraId)) throw new ApiError(400, "Pilih perkara.");
  if (!/^[\w.:@-]{1,80}$/.test(berkasId)) throw new ApiError(400, "Pilih blangko dari pustaka.");
  const jenis = String(badan.jenis ?? "putusan") as JenisBerkasSelesai;
  if (!JENIS.includes(jenis)) throw new ApiError(400, "Jenis berkas tidak dikenal.");
  return {
    perkaraId,
    berkasId,
    jenis,
    nomorPerkara: String(badan.nomorPerkara ?? "").trim().slice(0, 80),
    sidangKe: Math.max(0, Math.min(99, Math.trunc(Number(badan.sidangKe) || 0))),
  };
}

export async function GET(request: NextRequest) {
  let db: Db | null = null;
  let actorUserId: string | null = null;
  try {
    const a = await aktorSuperAdminAlur(request, PESAN);
    db = a.db;
    actorUserId = a.actorUserId;
    const saklar = await bacaSaklarTulis(a.db);
    const perkaraId = getSearchParam(request, "perkaraId") ?? "";
    const berkasId = getSearchParam(request, "berkasId") ?? "";
    const langkah = LANGKAH_SELESAI.map((l) => ({ id: l.id, judul: l.judul, keLuar: l.keLuar }));
    if (!perkaraId || !berkasId) return ok({ langkah, saklar }, { headers: { "Cache-Control": "no-store" } });
    if (!/^\d{1,12}$/.test(perkaraId) || !/^[\w.:@-]{1,80}$/.test(berkasId)) throw new ApiError(400, "Perkara atau blangko tidak sah.");
    const k = await bacaKeadaanSelesai(a.db, perkaraId, berkasId);
    return ok({ langkah, saklar, ada: k.ada, keadaan: k.keadaan, jenis: k.jenis, diubahAt: k.diubahAt }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return handleAdminRouteError(error, request, { db, actorUserId, action: "ALETA_ABT_SELESAI_READ_FAILED", feature: "aleta_abt", entityId: "aleta-abt-selesai" });
  }
}

export async function POST(request: NextRequest) {
  let db: Db | null = null;
  let actorUserId: string | null = null;
  try {
    const a = await aktorSuperAdminAlur(request, PESAN);
    db = a.db;
    actorUserId = a.actorUserId;
    const badan = await bacaBadanJson(request);
    const tindakan = String(badan.tindakan ?? "");
    const tak = { "Cache-Control": "no-store" };

    if (tindakan === "saklar") {
      const saklar = await simpanSaklarTulis(a.db, a.aktor, badan);
      await catatAlur(a.db, a.actorUserId, "ALETA_ABT_SELESAI_SAKLAR", "saklar-tulis", { edocSipp: saklar["edoc-sipp"], ecourt: saklar.ecourt });
      return ok({ saklar }, { headers: tak });
    }
    if (tindakan !== "jalankan" && tindakan !== "ulangi") throw new ApiError(400, "Tindakan tidak dikenal.");

    const m = masukan(badan);
    const ulangi: IdLangkah[] = [];
    if (tindakan === "ulangi") {
      const daftar = Array.isArray(badan.langkah) ? badan.langkah.map(String) : [];
      for (const id of daftar) {
        if (!(ID_LANGKAH as readonly string[]).includes(id)) throw new ApiError(400, "Langkah tidak dikenal.");
        ulangi.push(id as IdLangkah);
      }
      if (!ulangi.length) throw new ApiError(400, "Pilih langkah yang diulang.");
    }
    const hasil = await jalankanSelesaikanBerkas(a.db, request, { ...m, ulangi }, a.aktor.name, {});
    await catatAlur(a.db, a.actorUserId, tindakan === "ulangi" ? "ALETA_ABT_SELESAI_ULANGI" : "ALETA_ABT_SELESAI_JALANKAN", m.berkasId, {
      perkaraId: m.perkaraId,
      jenis: m.jenis,
      status: hasil.keadaan.status,
      langkah: Object.fromEntries(ID_LANGKAH.map((i) => [i, hasil.keadaan.langkah[i].status])),
    });
    return ok({ keadaan: hasil.keadaan, saklar: hasil.saklar }, { headers: tak });
  } catch (error) {
    return handleAdminRouteError(error, request, { db, actorUserId, action: "ALETA_ABT_SELESAI_WRITE_FAILED", feature: "aleta_abt", entityId: "aleta-abt-selesai" });
  }
}
