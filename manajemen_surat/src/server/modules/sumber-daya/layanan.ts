import { readFile } from "node:fs/promises";

import type { AletaDatabase } from "@/server/db/client";

/**
 * ============================================================================
 * PEMANTAU SUMBER DAYA SERVER - SISI PORTAL (butir 3, 6 Oktober 2026)
 * ============================================================================
 *
 * Angkanya diukur ALETA Bot (aleta_bot/services/sumberDayaService.js) - bot
 * memakai jaringan host, jadi ia menjangkau netdata dan /proc/meminfo host.
 * Portal hanya:
 *   - menambahkan yang hanya ia ketahui: ukuran database PostgreSQL ALETA
 *     (pg_database_size) dan, bila netdata tidak ada, memori container
 *     portal sendiri (cgroup v1);
 *   - bersinggah 3 detik, supaya puluhan tab yang berdetak tiap 5 detik
 *     tidak menjadi puluhan pengukuran;
 *   - memangkas jawaban untuk widget ekstensi (ringkasan saja).
 *
 * Warna dihitung dari AMBANG yang dikirim bot - satu sumber ambang.
 */

export type Warna = "hijau" | "kuning" | "merah" | "kelabu";
export type Ambang = { kuning: number; merah: number };
export type AmbangSemua = { ram: Ambang; disk: Ambang; gpu: Ambang };

export type Keping = {
  byte: number | null;
  totalByte: number | null;
  persen: number | null;
  warna: Warna;
  partisi?: string | null;
  sebagian?: boolean;
};
export type KepingGpu = { ada: boolean; persen: number | null; warna: Warna; keterangan: string };
export type Ringkas = {
  aleta: { ram: Keping; disk: Keping; gpu: KepingGpu };
  server: { ram: Keping; disk: Keping; gpu: KepingGpu };
};

export type ButirMemori = {
  kunci: string;
  nama: string;
  jenis: "container" | "layanan";
  ramByte: number;
  cacheByte: number;
  swapByte: number;
};
export type Partisi = {
  titik: string;
  totalByte: number;
  terpakaiByte: number;
  sisaByte?: number;
  persen: number | null;
  warna: Warna;
};
export type ButirDisk = {
  kunci: string;
  nama: string;
  byte: number | null;
  dapatDiklaimByte?: number | null;
  jumlah?: number | null;
  berkas?: number;
  tabel?: number | null;
  terpotong?: boolean;
};

export type SumberDaya = {
  diukurPada: string;
  ambang: AmbangSemua;
  sumber: Record<string, string>;
  ringkas: Ringkas;
  rincian: {
    memori: { totalByte: number; tersediaByte: number; terpakaiByte: number; cacheByte: number; swapTotalByte: number; swapTerpakaiByte: number } | null;
    aleta: ButirMemori[];
    lain: ButirMemori[];
    ramLainnyaByte: number | null;
    partisi: Partisi[];
    diskAleta: { byte: number | null; lengkap?: boolean; rincian: ButirDisk[] };
    docker: { dibuat: string } | null;
    folderDiukurPada: string | null;
    gpu: { ada: boolean; persen: number | null; keterangan: string; perangkat: Array<Record<string, unknown>> };
  };
  catatan: string[];
};

export type RingkasWidget = {
  diukurPada: string;
  ringkas: Ringkas;
  bolehRinci: boolean;
  alamatRinci: string;
};

const AMBANG_CADANGAN: AmbangSemua = {
  ram: { kuning: 75, merah: 90 },
  disk: { kuning: 80, merah: 90 },
  gpu: { kuning: 70, merah: 90 },
};

/** Sama persis dengan warnaAmbang di bot - dipakai saat portal menambah angka. */
export function warnaDariAmbang(persen: number | null | undefined, ambang: Ambang | null | undefined): Warna {
  if (persen === null || persen === undefined || !ambang) return "kelabu";
  const p = Number(persen);
  if (!Number.isFinite(p)) return "kelabu";
  if (p >= ambang.merah) return "merah";
  if (p >= ambang.kuning) return "kuning";
  return "hijau";
}

function angkaAtauNull(x: unknown): number | null {
  if (x === null || x === undefined || x === "") return null;
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
}

function warnaSah(x: unknown): Warna {
  return x === "hijau" || x === "kuning" || x === "merah" ? x : "kelabu";
}

function persenDari(bagian: number | null, total: number | null) {
  if (bagian === null || total === null || !(total > 0)) return null;
  return Math.round((bagian / total) * 1000) / 10;
}

function kepingBersih(x: unknown): Keping {
  const k = (x && typeof x === "object" ? x : {}) as Record<string, unknown>;
  return {
    byte: angkaAtauNull(k.byte),
    totalByte: angkaAtauNull(k.totalByte),
    persen: angkaAtauNull(k.persen),
    warna: warnaSah(k.warna),
    ...(k.partisi !== undefined ? { partisi: k.partisi ? String(k.partisi) : null } : {}),
    ...(k.sebagian === true ? { sebagian: true } : {}),
  };
}

function kepingGpuBersih(x: unknown): KepingGpu {
  const k = (x && typeof x === "object" ? x : {}) as Record<string, unknown>;
  const ada = k.ada === true;
  const persen = ada ? angkaAtauNull(k.persen) : null;
  return { ada, persen, warna: ada ? warnaSah(k.warna) : "kelabu", keterangan: String(k.keterangan || (ada ? "" : "Tidak ada GPU.")) };
}

/**
 * Jawaban bot -> bentuk yang dipercaya layar. Yang rusak menjadi null /
 * "kelabu", tidak pernah angka karangan. null bila bentuk dasarnya tidak ada.
 */
export function bersihkanJawabanBot(isi: unknown): SumberDaya | null {
  if (!isi || typeof isi !== "object") return null;
  const x = isi as Record<string, unknown>;
  const r = (x.ringkas && typeof x.ringkas === "object" ? x.ringkas : null) as Record<string, Record<string, unknown>> | null;
  if (!r || !r.aleta || !r.server) return null;
  const ambangMentah = (x.ambang && typeof x.ambang === "object" ? x.ambang : {}) as Record<string, Ambang>;
  const ambang: AmbangSemua = {
    ram: ambangMentah.ram && Number.isFinite(ambangMentah.ram.kuning) ? ambangMentah.ram : AMBANG_CADANGAN.ram,
    disk: ambangMentah.disk && Number.isFinite(ambangMentah.disk.kuning) ? ambangMentah.disk : AMBANG_CADANGAN.disk,
    gpu: ambangMentah.gpu && Number.isFinite(ambangMentah.gpu.kuning) ? ambangMentah.gpu : AMBANG_CADANGAN.gpu,
  };
  const rincianMentah = (x.rincian && typeof x.rincian === "object" ? x.rincian : {}) as Record<string, unknown>;
  const daftar = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
  const diskAleta = (rincianMentah.diskAleta && typeof rincianMentah.diskAleta === "object"
    ? rincianMentah.diskAleta
    : { byte: null, rincian: [] }) as SumberDaya["rincian"]["diskAleta"];
  const gpu = (rincianMentah.gpu && typeof rincianMentah.gpu === "object"
    ? rincianMentah.gpu
    : { ada: false, persen: null, keterangan: "GPU tidak terbaca.", perangkat: [] }) as SumberDaya["rincian"]["gpu"];
  return {
    diukurPada: String(x.diukurPada || new Date().toISOString()),
    ambang,
    sumber: (x.sumber && typeof x.sumber === "object" ? x.sumber : {}) as Record<string, string>,
    ringkas: {
      aleta: { ram: kepingBersih(r.aleta.ram), disk: kepingBersih(r.aleta.disk), gpu: kepingGpuBersih(r.aleta.gpu) },
      server: { ram: kepingBersih(r.server.ram), disk: kepingBersih(r.server.disk), gpu: kepingGpuBersih(r.server.gpu) },
    },
    rincian: {
      memori: (rincianMentah.memori as SumberDaya["rincian"]["memori"]) ?? null,
      aleta: daftar<ButirMemori>(rincianMentah.aleta),
      lain: daftar<ButirMemori>(rincianMentah.lain),
      ramLainnyaByte: angkaAtauNull(rincianMentah.ramLainnyaByte),
      partisi: daftar<Partisi>(rincianMentah.partisi),
      diskAleta: { byte: angkaAtauNull(diskAleta.byte), lengkap: diskAleta.lengkap, rincian: daftar<ButirDisk>(diskAleta.rincian) },
      docker: (rincianMentah.docker as SumberDaya["rincian"]["docker"]) ?? null,
      folderDiukurPada: rincianMentah.folderDiukurPada ? String(rincianMentah.folderDiukurPada) : null,
      gpu: { ...gpu, perangkat: daftar<Record<string, unknown>>(gpu.perangkat) },
    },
    catatan: daftar<string>(x.catatan).map(String),
  };
}

/**
 * Tambahan dari portal sendiri:
 *   postgresByte  ukuran database PostgreSQL ALETA - masuk disk ALETA;
 *   portalSendiri memori container portal - HANYA bila bot tidak menyebut
 *                 aleta-portal (netdata tidak ada).
 * Persen dan warna keping yang berubah dihitung ulang dengan ambang bot.
 */
export function gabungTambahanPortal(
  data: SumberDaya,
  tambahan: { postgresByte: number | null; portalSendiri: { ramByte: number; cacheByte: number } | null }
): SumberDaya {
  const hasil: SumberDaya = JSON.parse(JSON.stringify(data));
  if (tambahan.postgresByte !== null && tambahan.postgresByte >= 0) {
    hasil.rincian.diskAleta.rincian.push({ kunci: "postgres", nama: "Database PostgreSQL ALETA", byte: tambahan.postgresByte });
    const lama = hasil.rincian.diskAleta.byte;
    hasil.rincian.diskAleta.byte = (lama ?? 0) + tambahan.postgresByte;
    const k = hasil.ringkas.aleta.disk;
    k.byte = hasil.rincian.diskAleta.byte;
    k.persen = persenDari(k.byte, k.totalByte);
    k.warna = warnaDariAmbang(k.persen, hasil.ambang.disk);
  }
  if (tambahan.portalSendiri && !hasil.rincian.aleta.some((b) => b.kunci === "aleta-portal")) {
    hasil.rincian.aleta.push({
      kunci: "aleta-portal",
      nama: "Portal ALETA (Next.js)",
      jenis: "container",
      ramByte: tambahan.portalSendiri.ramByte,
      cacheByte: tambahan.portalSendiri.cacheByte,
      swapByte: 0,
    });
    const k = hasil.ringkas.aleta.ram;
    k.byte = (k.byte ?? 0) + tambahan.portalSendiri.ramByte;
    k.persen = persenDari(k.byte, k.totalByte);
    k.warna = warnaDariAmbang(k.persen, hasil.ambang.ram);
  }
  return hasil;
}

/** Ringkasan untuk widget: TANPA rincian per layanan (peta host hanya untuk Admin). */
export function ringkasUntukWidget(data: SumberDaya, bolehRinci: boolean): RingkasWidget {
  return {
    diukurPada: data.diukurPada,
    ringkas: data.ringkas,
    bolehRinci,
    alamatRinci: "/admin/sumber-daya",
  };
}

/** memory.stat cgroup v1 -> rss/cache (total_* didahulukan). */
export function uraiMemoryStat(teks: string): { ramByte: number; cacheByte: number } | null {
  const nilai: Record<string, number> = {};
  for (const baris of String(teks || "").split(/\r?\n/)) {
    const m = /^(\w+)\s+(\d+)\s*$/.exec(baris.trim());
    if (m) nilai[m[1]] = Number(m[2]);
  }
  const ambil = (k: string) => (nilai[`total_${k}`] !== undefined ? nilai[`total_${k}`] : nilai[k]);
  if (ambil("rss") === undefined) return null;
  return { ramByte: ambil("rss") || 0, cacheByte: ambil("cache") || 0 };
}

// ─── Pembacaan bersinggah ────────────────────────────────────────────────────

const SINGGAH_MS = 3000;
const SINGGAH_POSTGRES_MS = 10 * 60 * 1000;

const singgah: {
  data: SumberDaya | null;
  pada: number;
  jalan: Promise<HasilBaca> | null;
  postgres: number | null;
  postgresPada: number;
} = { data: null, pada: 0, jalan: null, postgres: null, postgresPada: 0 };

export type HasilBaca = { ok: true; data: SumberDaya } | { ok: false; error: string };

type PemanggilBot = () => Promise<{ ok: true; data: unknown } | { ok: false; error: string }>;

async function ukuranPostgres(db: AletaDatabase | null) {
  if (!db) return null;
  if (singgah.postgresPada && Date.now() - singgah.postgresPada < SINGGAH_POSTGRES_MS) return singgah.postgres;
  try {
    const baris = await db.queryOne<{ b: string | number }>("SELECT pg_database_size(current_database()) AS b");
    singgah.postgres = angkaAtauNull(baris?.b);
  } catch {
    // Mode cadangan (bukan PostgreSQL sungguhan) tidak punya fungsinya.
    singgah.postgres = null;
  }
  singgah.postgresPada = Date.now();
  return singgah.postgres;
}

async function memoriPortalSendiri() {
  try {
    return uraiMemoryStat(await readFile("/sys/fs/cgroup/memory/memory.stat", "utf8"));
  } catch {
    return null;
  }
}

export async function bacaSumberDaya(db: AletaDatabase | null, panggilBot: PemanggilBot): Promise<HasilBaca> {
  if (singgah.data && Date.now() - singgah.pada < SINGGAH_MS) return { ok: true, data: singgah.data };
  if (singgah.jalan) return singgah.jalan;
  singgah.jalan = (async (): Promise<HasilBaca> => {
    const [jawaban, postgresByte, portalSendiri] = await Promise.all([panggilBot(), ukuranPostgres(db), memoriPortalSendiri()]);
    if (!jawaban.ok) return { ok: false, error: jawaban.error };
    const bersih = bersihkanJawabanBot(jawaban.data);
    if (!bersih) return { ok: false, error: "Jawaban ALETA Bot tentang sumber daya tidak dapat dibaca." };
    const data = gabungTambahanPortal(bersih, { postgresByte, portalSendiri });
    singgah.data = data;
    singgah.pada = Date.now();
    return { ok: true, data };
  })().finally(() => {
    singgah.jalan = null;
  });
  return singgah.jalan;
}

/** Hanya untuk uji. */
export function kosongkanSinggahSumberDaya() {
  singgah.data = null;
  singgah.pada = 0;
  singgah.jalan = null;
  singgah.postgres = null;
  singgah.postgresPada = 0;
}
