import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import { callAletaBotSippBridge } from "@/server/modules/aleta-sipp/aleta-sipp-datasource";
import { bacaHakBlangko } from "@/server/modules/pengaturan-abt/service";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ok } from "@/server/shared/http";

import { jenisFolderDerry, susunIsian, type Definisi, type Susunan } from "./susun";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const AKAR_DERRY = "derry_briantono";
const UMUR_SINGGAH_MS = 10 * 60 * 1000;
const BATAS_NILAI = 600;

/**
 * ============================================================================
 * BAHAN "PERLU DIISI" BLANGKO ABT BY DERRY BRIANTONO (TAHAP F) - BACA SAJA
 * ============================================================================
 *
 *   GET ?hak=1
 *       (16 Okt malam) saklar Pengaturan SIPP & ABT "Hakim boleh membuka
 *       folder BAS" / "PP boleh membuka folder putusan" + hak per folder Derry
 *       (nama_alias, grup, grup selalu-boleh). Ekstensi membatasi jenis
 *       dokumen per peran dengannya, juga saat admin "Lihat sebagai akun".
 *       Bot tidak menjawab = { ada: false } (ekstensi: saklar dianggap mati).
 *   GET ?indeks=1
 *       folder Derry di server beserta nama berkasnya (bot blangko.pohon,
 *       cadangan blangko.katalog per folder) - ekstensi mencocokkan kelompok
 *       ABT (nama berkas) dengan foldernya.
 *   GET ?folder=<subfolder Derry>&berkas=<nama berkas>[&sebutanP=&sebutanT=]
 *       penanda RTF blangko (bot blangko.baca) x katalog variabel ABT ->
 *       isian tangan sungguhan (lihat susun.ts).
 *   GET ... &perkaraId=<id>[&sidangKe=N][&semua=1]
 *       ditambah nilai per penanda untuk perkara itu dari mesin variabel ABT
 *       di bot (abt.nilaiPenanda: isian tangan abt_data_teks/tanggal ikut
 *       terbaca, status terisi/kosong). Tanpa semua=1 hanya isian tangan dan
 *       pemicu yang dinilai (cepat); semua=1 menilai seluruh penanda untuk
 *       "Lihat semua isi data".
 *
 * Katalog variabel diambil hidup dari ABT (abt.semuaVariabel, disinggahkan 10
 * menit - definisi dapat diubah admin ABT kapan saja), cadangan salinan kamus
 * ALETA. Tidak ada yang ditulis: menyimpan isian tetap lewat rute ABT sendiri
 * (edit_data) dari ekstensi.
 */
type JawabanKatalog = { ada?: boolean; variabel?: Array<{ noVar?: unknown; nama?: unknown; jenis?: unknown; sqlQuery?: unknown; defaultData?: unknown }> };
type JawabanBaca = { ada?: boolean; sebab?: string; berkas?: string; penanda?: string[] };
type JawabanPohon = { ada?: boolean; berkas?: Array<{ jalur?: unknown; folder?: unknown; berkas?: unknown }> };
type JawabanKatalogFolder = { ada?: boolean; set?: Array<{ nama?: unknown }>; blangko?: Array<{ berkas?: unknown }> };
type JawabanNilai = { ok?: boolean; nilai?: Record<string, { status?: string; teks?: string; nama?: string; sebab?: string }> };

const teks = (x: unknown) => String(x ?? "").trim();

let singgahKatalog: { saat: number; sumber: string; peta: Map<string, Definisi> } | null = null;
let singgahIndeks: { saat: number; data: IndeksDerry } | null = null;

type IndeksDerry = { ada: boolean; akar: string; folder: Array<{ nama: string; jenis: string; berkas: string[] }>; sumber: string; sebab: string };

/** Untuk uji: melupakan singgahan. */
export function lupakanSinggahan() {
  singgahKatalog = null;
  singgahIndeks = null;
}

async function katalogVariabel(db: Awaited<ReturnType<typeof getDatabase>>): Promise<{ peta: Map<string, Definisi>; sumber: string }> {
  if (singgahKatalog && Date.now() - singgahKatalog.saat < UMUR_SINGGAH_MS) return { peta: singgahKatalog.peta, sumber: singgahKatalog.sumber };
  const peta = new Map<string, Definisi>();
  let sumber = "";
  try {
    const j = await callAletaBotSippBridge<JawabanKatalog>("abt.semuaVariabel", {}, { timeoutMs: 20000 });
    if (j.ok && j.data?.ada && Array.isArray(j.data.variabel)) {
      for (const v of j.data.variabel) {
        const kode = teks(v.noVar);
        if (kode) peta.set(kode, { kode, nama: teks(v.nama), jenis: teks(v.jenis), sql: String(v.sqlQuery ?? ""), bawaan: String(v.defaultData ?? "") });
      }
      if (peta.size) sumber = "abt";
    }
  } catch {
    /* jembatan tidak menjawab - salinan kamus di bawah */
  }
  if (!peta.size) {
    try {
      const baris = await db.queryAll<Record<string, unknown>>(
        `SELECT no_var, nama, jenis, sql_query, default_data FROM aleta_kamus_variabel`
      );
      for (const b of baris) {
        const kode = teks(b.no_var);
        if (kode) peta.set(kode, { kode, nama: teks(b.nama), jenis: teks(b.jenis), sql: String(b.sql_query ?? ""), bawaan: String(b.default_data ?? "") });
      }
      if (peta.size) sumber = "kamus";
    } catch {
      /* kamus belum pernah disalin */
    }
  }
  if (peta.size) singgahKatalog = { saat: Date.now(), sumber, peta };
  return { peta, sumber };
}

async function indeksDerry(): Promise<IndeksDerry> {
  if (singgahIndeks && Date.now() - singgahIndeks.saat < UMUR_SINGGAH_MS) return singgahIndeks.data;
  const folder = new Map<string, string[]>();
  let sumber = "";
  let sebab = "";
  try {
    const p = await callAletaBotSippBridge<JawabanPohon>("blangko.pohon", {}, { timeoutMs: 30000 });
    if (p.ok && p.data?.ada && Array.isArray(p.data.berkas)) {
      for (const b of p.data.berkas) {
        const jalur = teks(b.jalur);
        const m = jalur.match(/^derry_briantono\/([^/]+)\/([^/]+)$/);
        if (!m) continue;
        if (!folder.has(m[1])) folder.set(m[1], []);
        folder.get(m[1])!.push(m[2]);
      }
      if (folder.size) sumber = "pohon";
    } else if (!p.ok) sebab = teks(p.error);
  } catch (e) {
    sebab = teks((e as Error)?.message);
  }
  if (!folder.size) {
    try {
      const k = await callAletaBotSippBridge<JawabanKatalogFolder>("blangko.katalog", { folder: AKAR_DERRY }, { timeoutMs: 15000 });
      const set = k.ok && k.data?.ada ? (k.data.set ?? []).map((s) => teks(s.nama)).filter(Boolean) : [];
      for (let i = 0; i < set.length; i += 6) {
        const kelompok = set.slice(i, i + 6);
        const jawaban = await Promise.all(
          kelompok.map((nama) => callAletaBotSippBridge<JawabanKatalogFolder>("blangko.katalog", { folder: `${AKAR_DERRY}/${nama}` }, { timeoutMs: 15000 }).catch(() => null))
        );
        jawaban.forEach((j, idx) => {
          const daftar = j && j.ok && j.data?.ada ? (j.data.blangko ?? []).map((b) => teks(b.berkas)).filter(Boolean) : [];
          folder.set(kelompok[idx], daftar);
        });
      }
      if (folder.size) sumber = "katalog";
      else if (!sebab) sebab = k.ok ? teks((k.data as { sebab?: string } | undefined)?.sebab) || "Folder Derry tidak terbaca." : teks(k.error);
    } catch (e) {
      if (!sebab) sebab = teks((e as Error)?.message);
    }
  }
  const data: IndeksDerry = {
    ada: folder.size > 0,
    akar: AKAR_DERRY,
    folder: [...folder.entries()]
      .map(([nama, berkas]) => ({ nama, jenis: jenisFolderDerry(nama), berkas: berkas.slice().sort((a, b) => a.localeCompare(b, "id")) }))
      .sort((a, b) => a.nama.localeCompare(b.nama, "id")),
    sumber,
    sebab: folder.size ? "" : sebab || "Bot ALETA tidak menjawab.",
  };
  if (data.ada) singgahIndeks = { saat: Date.now(), data };
  return data;
}

async function nilaiPenanda(perkaraId: string, sidangKe: number, kode: string[]) {
  const daftar = [...new Set(kode)].slice(0, BATAS_NILAI);
  if (!daftar.length) return { ada: false, nilai: {}, sebab: "" };
  try {
    const j = await callAletaBotSippBridge<JawabanNilai>("abt.nilaiPenanda", { perkaraId, sidangKe, penanda: daftar }, { timeoutMs: 90000 });
    if (!j.ok || !j.data?.ok) return { ada: false, nilai: {}, sebab: j.ok ? "Mesin variabel ABT di bot tidak memulangkan nilai." : teks(j.error) || "Bot ALETA tidak menjawab." };
    const nilai: Record<string, { status: string; teks: string; nama: string; sebab: string }> = {};
    for (const [k, v] of Object.entries(j.data.nilai || {})) {
      nilai[k] = { status: teks(v?.status) || "kosong", teks: String(v?.teks ?? ""), nama: teks(v?.nama), sebab: teks(v?.sebab) };
    }
    return { ada: true, nilai, sebab: "" };
  } catch (e) {
    return { ada: false, nilai: {}, sebab: teks((e as Error)?.message) || "Bot ALETA tidak menjawab." };
  }
}

export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanKapabilitas(db, actorUserId, "panel");
    const q = request.nextUrl.searchParams;

    if (q.get("hak") === "1") {
      try {
        return ok(await bacaHakBlangko());
      } catch (e) {
        return ok({ ada: false, sebab: teks((e as Error)?.message) || "Hak menu ABT tidak terbaca." });
      }
    }
    if (q.get("indeks") === "1") return ok(await indeksDerry());

    const folder = teks(q.get("folder")).replace(/^\/+|\/+$/g, "");
    const berkas = teks(q.get("berkas"));
    if (!folder || !berkas) return Response.json({ ok: false, alasan: "folder dan berkas harus disebutkan." }, { status: 400 });
    if (folder.includes("..") || berkas.includes("/") || berkas.includes("\\")) {
      return Response.json({ ok: false, alasan: "Nama folder atau berkas tidak sah." }, { status: 400 });
    }
    const namaBerkas = /\.(rtf|docx?|odt)$/i.test(berkas) ? berkas : `${berkas}.rtf`;
    const jalurFolder = folder.startsWith(`${AKAR_DERRY}/`) || folder === AKAR_DERRY ? folder : `${AKAR_DERRY}/${folder}`;

    const dibaca = await callAletaBotSippBridge<JawabanBaca>("blangko.baca", { folder: jalurFolder, berkas: namaBerkas }, { timeoutMs: 20000 });
    if (!dibaca.ok || !dibaca.data?.ada) {
      return ok({ ada: false, sebab: (dibaca.ok ? teks(dibaca.data?.sebab) : teks(dibaca.error)) || "Blangko tidak terbaca di server.", folder: jalurFolder, berkas: namaBerkas });
    }
    const penanda = (dibaca.data.penanda ?? []).map(teks).filter((x) => /^\d{3,5}$/.test(x));
    const { peta, sumber } = await katalogVariabel(db);
    const sebutan = {
      P: teks(q.get("sebutanP")) || "Penggugat/Pemohon",
      T: teks(q.get("sebutanT")) || "Tergugat/Termohon",
      gugatan: teks(q.get("sebutanP")) === "Pemohon" ? "permohonan" : teks(q.get("sebutanP")) === "Penggugat" ? "gugatan" : "gugatan/permohonan",
    };
    const susunan: Susunan = susunIsian(penanda, peta, sebutan);

    const perkaraId = teks(q.get("perkaraId"));
    let nilai: Awaited<ReturnType<typeof nilaiPenanda>> | null = null;
    if (perkaraId && /^\d+$/.test(perkaraId)) {
      const sidangKe = Number(q.get("sidangKe") || 0) || 0;
      const semua = q.get("semua") === "1";
      const kode = semua
        ? [...new Set([...susunan.penanda, ...susunan.isian.map((b) => b.kode), ...susunan.otomatis.map((o) => o.kode), ...susunan.pemicu.map((p) => p.kode)])]
        : [...susunan.isian.filter((b) => b.jenis !== "tj").map((b) => b.kode), ...susunan.pemicu.map((p) => p.kode)];
      nilai = await nilaiPenanda(perkaraId, sidangKe, kode);
    }

    return ok({
      ada: true,
      folder: jalurFolder,
      berkas: teks(dibaca.data.berkas) || namaBerkas,
      jumlahPenanda: penanda.length,
      sumberKatalog: sumber,
      katalogTersedia: peta.size > 0,
      ...susunan,
      ...(nilai ? { nilai: nilai.nilai, nilaiAda: nilai.ada, nilaiSebab: nilai.sebab } : {}),
    });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "BLANGKO_DERRY_READ_FAILED",
      feature: "aleta_ecourt",
      entityId: "blangko-derry",
    });
  }
}
