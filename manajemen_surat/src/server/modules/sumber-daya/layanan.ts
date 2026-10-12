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
export type AmbangSemua = { ram: Ambang; disk: Ambang; gpu: Ambang; cpu: Ambang };

export type Keping = {
  byte: number | null;
  totalByte: number | null;
  persen: number | null;
  warna: Warna;
  partisi?: string | null;
  sebagian?: boolean;
};
export type KepingGpu = { ada: boolean; persen: number | null; warna: Warna; keterangan: string };
/* === 12OKT-J: CPU === */
/**
 * CPU = laju (selisih dua cuplikan), persen dari SELURUH kapasitas server.
 * persen null = tidak terbaca (kelabu), bukan 0%. beban hanya di sudut pandang server.
 */
export type KepingCpu = {
  persen: number | null;
  warna: Warna;
  inti: number | null;
  intiTerpakai: number | null;
  beban: { m1: number; m5: number; m15: number } | null;
  jendelaDetik: number | null;
  sebagian?: boolean;
};
/* === AKHIR 12OKT-J === */
export type Ringkas = {
  aleta: { ram: Keping; disk: Keping; gpu: KepingGpu; cpu: KepingCpu };
  server: { ram: Keping; disk: Keping; gpu: KepingGpu; cpu: KepingCpu };
};

export type ButirMemori = {
  kunci: string;
  nama: string;
  jenis: "container" | "layanan";
  ramByte: number;
  cacheByte: number;
  swapByte: number;
  /** 12OKT-J: inti yang dipakai (100% = satu inti) dan persennya dari seluruh server; null = tidak terbaca. */
  cpuInti?: number | null;
  cpuPersen?: number | null;
  cpuSumber?: "rata-rata" | "sesaat" | "cgroup" | null;
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
    /** 12OKT-J */
    cpu: { inti: number | null; beban: { m1: number; m5: number; m15: number } | null; jendelaDetik: number | null };
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
  cpu: { kuning: 70, merah: 90 },
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

/* === 12OKT-J: CPU === */
function bebanBersih(x: unknown): KepingCpu["beban"] {
  const b = (x && typeof x === "object" ? x : null) as Record<string, unknown> | null;
  if (!b) return null;
  const [m1, m5, m15] = [angkaAtauNull(b.m1), angkaAtauNull(b.m5), angkaAtauNull(b.m15)];
  return m1 === null || m5 === null || m15 === null ? null : { m1, m5, m15 };
}

/** Jawaban bot lama (tanpa CPU) atau rusak -> "tidak terbaca" (kelabu), tidak pernah 0%. */
function kepingCpuBersih(x: unknown): KepingCpu {
  const k = (x && typeof x === "object" ? x : {}) as Record<string, unknown>;
  return {
    persen: angkaAtauNull(k.persen),
    warna: angkaAtauNull(k.persen) === null ? "kelabu" : warnaSah(k.warna),
    inti: angkaAtauNull(k.inti),
    intiTerpakai: angkaAtauNull(k.intiTerpakai),
    beban: bebanBersih(k.beban),
    jendelaDetik: angkaAtauNull(k.jendelaDetik),
    ...(k.sebagian === true ? { sebagian: true } : {}),
  };
}

function cpuRincianBersih(x: unknown): SumberDaya["rincian"]["cpu"] {
  const k = (x && typeof x === "object" ? x : {}) as Record<string, unknown>;
  return { inti: angkaAtauNull(k.inti), beban: bebanBersih(k.beban), jendelaDetik: angkaAtauNull(k.jendelaDetik) };
}

function butirBersih(x: ButirMemori): ButirMemori {
  const sumber = x.cpuSumber === "rata-rata" || x.cpuSumber === "sesaat" || x.cpuSumber === "cgroup" ? x.cpuSumber : null;
  return { ...x, cpuInti: angkaAtauNull(x.cpuInti), cpuPersen: angkaAtauNull(x.cpuPersen), cpuSumber: sumber };
}
/* === AKHIR 12OKT-J === */

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
    cpu: ambangMentah.cpu && Number.isFinite(ambangMentah.cpu.kuning) ? ambangMentah.cpu : AMBANG_CADANGAN.cpu, // 12OKT-J
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
      aleta: { ram: kepingBersih(r.aleta.ram), disk: kepingBersih(r.aleta.disk), gpu: kepingGpuBersih(r.aleta.gpu), cpu: kepingCpuBersih(r.aleta.cpu) },
      server: { ram: kepingBersih(r.server.ram), disk: kepingBersih(r.server.disk), gpu: kepingGpuBersih(r.server.gpu), cpu: kepingCpuBersih(r.server.cpu) },
    },
    rincian: {
      memori: (rincianMentah.memori as SumberDaya["rincian"]["memori"]) ?? null,
      aleta: daftar<ButirMemori>(rincianMentah.aleta).map(butirBersih),
      lain: daftar<ButirMemori>(rincianMentah.lain).map(butirBersih),
      ramLainnyaByte: angkaAtauNull(rincianMentah.ramLainnyaByte),
      partisi: daftar<Partisi>(rincianMentah.partisi),
      diskAleta: { byte: angkaAtauNull(diskAleta.byte), lengkap: diskAleta.lengkap, rincian: daftar<ButirDisk>(diskAleta.rincian) },
      docker: (rincianMentah.docker as SumberDaya["rincian"]["docker"]) ?? null,
      folderDiukurPada: rincianMentah.folderDiukurPada ? String(rincianMentah.folderDiukurPada) : null,
      cpu: cpuRincianBersih(rincianMentah.cpu), // 12OKT-J
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
  tambahan: {
    postgresByte: number | null;
    /** cpuInti (12OKT-J): inti yang dipakai portal (laju); null/tanpa = belum terukur. */
    portalSendiri: { ramByte: number; cacheByte: number; cpuInti?: number | null } | null;
  }
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
    // Bot belum mengukur apa pun (byte null - mis. panggilan pertama sesudah
    // bot menyala): yang tersisa hanya Postgres, dan itu BUKAN disk ALETA utuh.
    // Tanpa tanda ini 0,3 GB tampil seolah seluruh disk ALETA (U5, 9 Okt 2026).
    if (lama === null) {
      k.sebagian = true;
      hasil.rincian.diskAleta.lengkap = false;
    }
  }
  if (tambahan.portalSendiri && !hasil.rincian.aleta.some((b) => b.kunci === "aleta-portal")) {
    hasil.rincian.aleta.push({
      kunci: "aleta-portal",
      nama: "Portal ALETA (Next.js)",
      jenis: "container",
      ramByte: tambahan.portalSendiri.ramByte,
      cacheByte: tambahan.portalSendiri.cacheByte,
      swapByte: 0,
      ...butirCpuPortal(tambahan.portalSendiri.cpuInti ?? null, hasil.rincian.cpu.inti), // 12OKT-J
    });
    /* === 12OKT-J: CPU portal ikut ALETA (sebagian, karena netdata tidak ada) === */
    const cpuInti = tambahan.portalSendiri.cpuInti ?? null;
    const kc = hasil.ringkas.aleta.cpu;
    if (cpuInti !== null) {
      const total = (kc.intiTerpakai ?? 0) + cpuInti;
      kc.intiTerpakai = Math.round(total * 100) / 100;
      kc.persen = kc.inti && kc.inti > 0 ? Math.min(100, Math.round((total / kc.inti) * 1000) / 10) : null;
      kc.warna = warnaDariAmbang(kc.persen, hasil.ambang.cpu);
    }
    kc.sebagian = true;
    /* === AKHIR 12OKT-J === */
    const k = hasil.ringkas.aleta.ram;
    // Sama seperti disk: RAM ALETA dari bot tidak terbaca -> hanya portal yang
    // terhitung, jadi angkanya sebagian.
    if (k.byte === null) k.sebagian = true;
    k.byte = (k.byte ?? 0) + tambahan.portalSendiri.ramByte;
    k.persen = persenDari(k.byte, k.totalByte);
    k.warna = warnaDariAmbang(k.persen, hasil.ambang.ram);
  }
  return hasil;
}

/** 12OKT-J: butir CPU untuk container portal sendiri. */
function butirCpuPortal(cpuInti: number | null, intiServer: number | null): Pick<ButirMemori, "cpuInti" | "cpuPersen" | "cpuSumber"> {
  if (cpuInti === null) return { cpuInti: null, cpuPersen: null, cpuSumber: null };
  return {
    cpuInti: Math.round(cpuInti * 100) / 100,
    cpuPersen: intiServer && intiServer > 0 ? Math.min(100, Math.round((cpuInti / intiServer) * 1000) / 10) : null,
    cpuSumber: "cgroup",
  };
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

/* === 12OKT-J: CPU container portal sendiri === */
/**
 * Penghitung CPU cgroup -> nanodetik kumulatif. v1: cpuacct.usage (satu
 * bilangan); v2: cpu.stat "usage_usec" (mikrodetik). cpu.stat v1 tidak memuat
 * usage_usec, jadi tidak salah dibaca.
 */
export function uraiCpuUsageNs(teks: string): number | null {
  const s = String(teks || "");
  const v2 = /^usage_usec\s+(\d+)\s*$/m.exec(s);
  if (v2) return Number(v2[1]) * 1000;
  const v1 = /^\s*(\d+)\s*$/.exec(s);
  return v1 ? Number(v1[1]) : null;
}

/** Inti yang dipakai dari dua cuplikan penghitung (ns) dan waktunya (ms); null bila tak masuk akal. */
export function intiDariCuplikan(awal: { ns: number; t: number }, akhir: { ns: number; t: number }): number | null {
  const dt = akhir.t - awal.t;
  const dns = akhir.ns - awal.ns;
  if (!(dt > 0) || !(dns >= 0)) return null;
  return Math.round((dns / (dt * 1e6)) * 100) / 100;
}

const BERKAS_CPU_CGROUP = [
  "/sys/fs/cgroup/cpu.stat",
  "/sys/fs/cgroup/cpuacct/cpuacct.usage",
  "/sys/fs/cgroup/cpu,cpuacct/cpuacct.usage",
  "/sys/fs/cgroup/cpu/cpuacct.usage",
];
const CPU_DASAR_MIN_MS = 500;
const CPU_DASAR_BASI_MS = 60 * 1000;
/* === AKHIR 12OKT-J === */

// ─── Pembacaan bersinggah ────────────────────────────────────────────────────

const SINGGAH_MS = 3000;
const SINGGAH_POSTGRES_MS = 10 * 60 * 1000;

const singgah: {
  data: SumberDaya | null;
  pada: number;
  jalan: Promise<HasilBaca> | null;
  postgres: number | null;
  postgresPada: number;
  /** 12OKT-J: cuplikan dasar CPU portal dan hasil terakhirnya. */
  cpuDasar: { ns: number; t: number } | null;
  cpuTerakhir: number | null;
} = { data: null, pada: 0, jalan: null, postgres: null, postgresPada: 0, cpuDasar: null, cpuTerakhir: null };

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

/**
 * 12OKT-J: CPU container portal = selisih penghitung cgroup antara dua
 * pembacaan (3-5 dtk, karena layar berdetak tiap 5 dtk). Pembacaan pertama
 * hanya menaruh dasar: null (belum terukur), bukan 0.
 */
export async function cpuPortalSendiri(baca: (berkas: string) => Promise<string> = (b) => readFile(b, "utf8"), sekarang: () => number = Date.now): Promise<number | null> {
  let ns: number | null = null;
  for (const berkas of BERKAS_CPU_CGROUP) {
    try {
      ns = uraiCpuUsageNs(await baca(berkas));
    } catch {
      ns = null;
    }
    if (ns !== null) break;
  }
  if (ns === null) return null;
  const sekarangMs = sekarang();
  const dasar = singgah.cpuDasar;
  if (dasar && sekarangMs - dasar.t < CPU_DASAR_MIN_MS) return singgah.cpuTerakhir;
  singgah.cpuDasar = { ns, t: sekarangMs };
  if (!dasar || sekarangMs - dasar.t > CPU_DASAR_BASI_MS) {
    singgah.cpuTerakhir = null;
    return null;
  }
  singgah.cpuTerakhir = intiDariCuplikan(dasar, { ns, t: sekarangMs });
  return singgah.cpuTerakhir;
}

export async function bacaSumberDaya(db: AletaDatabase | null, panggilBot: PemanggilBot): Promise<HasilBaca> {
  if (singgah.data && Date.now() - singgah.pada < SINGGAH_MS) return { ok: true, data: singgah.data };
  if (singgah.jalan) return singgah.jalan;
  singgah.jalan = (async (): Promise<HasilBaca> => {
    const [jawaban, postgresByte, memoriPortal, cpuPortal] = await Promise.all([
      panggilBot(),
      ukuranPostgres(db),
      memoriPortalSendiri(),
      cpuPortalSendiri(), // 12OKT-J
    ]);
    const portalSendiri = memoriPortal ? { ...memoriPortal, cpuInti: cpuPortal } : null;
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
  singgah.cpuDasar = null; // 12OKT-J
  singgah.cpuTerakhir = null;
}
