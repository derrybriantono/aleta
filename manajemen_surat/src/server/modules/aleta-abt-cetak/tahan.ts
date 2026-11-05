import { jenisFolderDerry, kodeUntukNilai, saringIsianBas, susunIsian, type Definisi, type JenisDokumenDerry, type Susunan } from "@/app/api/aleta-ecourt/blangko-derry/susun";
import { terapkanPetunjukS5 } from "@/app/api/aleta-ecourt/blangko-derry/petunjuk-s5";
import { terapkanPetunjukS6 } from "@/app/api/aleta-ecourt/blangko-derry/petunjuk-s6";
import type { PustakaMesin } from "@/lib/aleta-abt-pustaka";
import type { callAletaBotSippBridge } from "@/server/modules/aleta-sipp/aleta-sipp-datasource";

/**
 * Bahan penahan cetak ALETA ABT (keputusan pemilik 6 Nov 2026): susunan isian blangko dengan aturan yang sama dengan panel Blangko ABT by Derry,
 * dari katalog ABT yang ditimpa rumus pustaka ALETA. Hanya membaca. Bila katalog tidak terbaca hasilnya null, dan pemanggil menahan semua isian kosong.
 */

const UMUR_SINGGAH_MS = 10 * 60 * 1000;
let singgah: { saat: number; peta: Map<string, Definisi> } | null = null;

type JawabanKatalog = { ada?: boolean; variabel?: Array<{ noVar?: unknown; nama?: unknown; jenis?: unknown; sqlQuery?: unknown; defaultData?: unknown }> };

async function katalogAbt(panggil: typeof callAletaBotSippBridge): Promise<Map<string, Definisi>> {
  if (singgah && Date.now() - singgah.saat < UMUR_SINGGAH_MS) return singgah.peta;
  const peta = new Map<string, Definisi>();
  const j = await panggil<JawabanKatalog>("abt.semuaVariabel", {}, { timeoutMs: 20000 });
  if (j.ok && j.data?.ada && Array.isArray(j.data.variabel)) {
    for (const v of j.data.variabel) {
      const kode = String(v.noVar ?? "").trim();
      if (kode) peta.set(kode, { kode, nama: String(v.nama ?? "").trim(), jenis: String(v.jenis ?? "").trim(), sql: String(v.sqlQuery ?? ""), bawaan: String(v.defaultData ?? "") });
    }
    if (peta.size) singgah = { saat: Date.now(), peta };
  }
  return peta;
}

/** Katalog ABT, ditimpa baris pustaka ALETA yang sudah ada (rumus yang sama dengan yang dipakai mesin jalur ALETA). */
export function gabungKatalog(abt: ReadonlyMap<string, Definisi>, pustaka: PustakaMesin | null): Map<string, Definisi> {
  const peta = new Map(abt);
  for (const [no, d] of Object.entries(pustaka?.pustaka ?? {})) {
    const lama = peta.get(no);
    peta.set(no, {
      kode: no,
      nama: String(d.nama ?? lama?.nama ?? ""),
      jenis: String(d.data_type ?? lama?.jenis ?? ""),
      sql: String(d.sql_query ?? lama?.sql ?? ""),
      bawaan: String(d.default_data ?? lama?.bawaan ?? ""),
    });
  }
  return peta;
}

/** Penanda angka di blangko, termasuk kode bermakna pustaka yang dipetakan ke nomornya. */
export function penandaBlangko(rtfLatin1: string, alias: Readonly<Record<string, string>>): string[] {
  const hasil: string[] = [];
  for (const m of rtfLatin1.matchAll(/#([A-Za-z][\w.-]{2,63}|\d{3,5})#/g)) {
    const no = /^\d/.test(m[1]) ? m[1] : alias[m[1]];
    if (no && !hasil.includes(no)) hasil.push(no);
  }
  return hasil;
}

export type BahanTahan = { susunan: Susunan; katalog: Map<string, Definisi>; kodeNilai: string[]; jenisCerai: "cg" | "ct" };

export async function bahanTahan(panggil: typeof callAletaBotSippBridge, m: { rtfLatin1: string; folder: string; pustaka: PustakaMesin | null }): Promise<BahanTahan | null> {
  let abt: Map<string, Definisi>;
  try {
    abt = await katalogAbt(panggil);
  } catch {
    return null;
  }
  const katalog = gabungKatalog(abt, m.pustaka);
  if (!katalog.size) return null;
  const jenis = jenisFolderDerry(m.folder);
  const susunan = saringIsianBas(susunIsian(penandaBlangko(m.rtfLatin1, m.pustaka?.alias ?? {}), katalog), jenis as JenisDokumenDerry | "");
  terapkanPetunjukS5(susunan);
  terapkanPetunjukS6(susunan);
  return { susunan, katalog, kodeNilai: kodeUntukNilai(susunan, false), jenisCerai: /\bCT\b/.test(m.folder) ? "ct" : "cg" };
}
