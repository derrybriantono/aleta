import { spawn } from "node:child_process";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, mkdtemp, readdir, rm, stat, statfs } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createInterface } from "node:readline";
import { type Readable } from "node:stream";
import { createGunzip } from "node:zlib";

import { Client } from "pg";

import { waktuPengadilan } from "@/lib/waktu-pengadilan";
import { type AletaDatabase, getDatabaseUrl } from "@/server/db/client";
import { laporkanKeKesehatan } from "@/server/modules/keamanan/kait";
import { bacaSetelanAwalan, benar, bulatDalam, tulisSetelan } from "@/server/modules/keamanan/setelan";
import { type ManifestBundel, daftarBundel, direktoriBundel } from "@/server/modules/sinkron/cadangan-db";
import { bacaPengaturan, sandiArsip } from "@/server/modules/sinkron/pengaturan";
import { AKHIRAN_SANDI, bukaSandiBerkas } from "@/server/modules/sinkron/sandi-arsip";

/**
 * ============================================================================
 * UJI PULIH CADANGAN (25 Okt 2026, Bagian 6d) - saklar MATI bawaan
 * ============================================================================
 *
 * Cadangan yang tidak pernah dicoba dipulihkan baru terbukti rusak SAAT dibutuhkan.
 * Sekali seminggu (saran Minggu 03.00 WITA, sesudah pencocokan Cermin 02.00):
 *
 *   1. ambil bundel cadangan ALETA yang terbaru dan SUDAH selesai;
 *   2. periksa sidik SHA-256 berkasnya terhadap manifest;
 *   3. buka sandinya (bila tersandi) dan bongkar arsipnya ke folder sementara;
 *   4. periksa isi SQL: tidak boleh memuat perintah yang berpindah/menyentuh basis
 *      data lain (\connect, CREATE/DROP/ALTER DATABASE, \!);
 *   5. buat basis data SEMENTARA bernama aleta_ujipulih_<waktu>_<acak>, pulihkan ke
 *      sana, periksa migrasi dan jumlah baris tabel penting terhadap produksi;
 *   6. HAPUS basis data sementara dan folder kerja - selalu, juga saat gagal;
 *   7. simpan hasilnya (0109), kirim ke Pusat kesehatan lewat kait, dan bila GAGAL
 *      beri tahu admin lewat lonceng dan WhatsApp.
 *
 * ============================================================================
 * TIDAK PERNAH MENYENTUH BASIS DATA PRODUKSI
 * ============================================================================
 *
 * Tiga lapis: (a) nama sasaran harus cocok pola aleta_ujipulih_* dan tidak boleh
 * sama dengan nama basis data produksi (pastikanSasaranSementara) - dipanggil di
 * SETIAP langkah mesin, bukan sekali; (b) CREATE/DROP DATABASE dijalankan dari
 * basis data pemeliharaan "postgres", tidak pernah dari basis data produksi;
 * (c) psql hanya diberi nama sasaran sementara, dan berkas SQL yang memuat perintah
 * pindah-basis-data ditolak sebelum dijalankan. Pembacaan produksi (jumlah baris,
 * jumlah migrasi) memakai sambungan ALETA yang sudah ada dan hanya SELECT.
 *
 * Bawaan MATI. Jalan manual dari layar ("Jalankan uji sekarang") tidak menunggu saklar.
 */

// ─── Setelan ─────────────────────────────────────────────────────────────────

export type PengaturanUjiPulih = {
  aktif: boolean;
  /** 0 = Minggu ... 6 = Sabtu, menurut jam pengadilan (WITA). */
  hari: number;
  jam: string;
  /** Berapa persen baris tabel penting boleh kurang dari produksi (cadangan lebih tua dari produksi). */
  toleransiPersen: number;
};

export const UJI_PULIH_BAWAAN: PengaturanUjiPulih = { aktif: false, hari: 0, jam: "03:00", toleransiPersen: 30 };

export async function bacaPengaturanUjiPulih(db: AletaDatabase): Promise<PengaturanUjiPulih> {
  const b = await bacaSetelanAwalan(db, "pulih.");
  const d = UJI_PULIH_BAWAAN;
  return {
    aktif: benar(b["pulih.aktif"], d.aktif),
    hari: bulatDalam(b["pulih.hari"], 0, 6, d.hari),
    jam: /^([01]\d|2[0-3]):[0-5]\d$/.test(b["pulih.jam"] ?? "") ? b["pulih.jam"] : d.jam,
    toleransiPersen: bulatDalam(b["pulih.toleransi"], 0, 90, d.toleransiPersen),
  };
}

export async function simpanPengaturanUjiPulih(db: AletaDatabase, ubah: Partial<PengaturanUjiPulih>, olehId: string, kini = new Date()) {
  const pasangan: Array<[string, string]> = [];
  if (ubah.aktif !== undefined) pasangan.push(["pulih.aktif", ubah.aktif ? "1" : "0"]);
  if (ubah.hari !== undefined) {
    const n = Number(ubah.hari);
    if (!Number.isInteger(n) || n < 0 || n > 6) throw new Error("Hari uji pulih harus 0 (Minggu) sampai 6 (Sabtu).");
    pasangan.push(["pulih.hari", String(n)]);
  }
  if (ubah.jam !== undefined) {
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(String(ubah.jam))) throw new Error("Jam uji pulih ditulis JJ:MM, misalnya 03:00.");
    pasangan.push(["pulih.jam", String(ubah.jam)]);
  }
  if (ubah.toleransiPersen !== undefined) {
    const n = Number(ubah.toleransiPersen);
    if (!Number.isInteger(n) || n < 0 || n > 90) throw new Error("Toleransi selisih baris harus bilangan bulat 0-90 persen.");
    pasangan.push(["pulih.toleransi", String(n)]);
  }
  if (pasangan.length) await tulisSetelan(db, pasangan, olehId, kini);
  return bacaPengaturanUjiPulih(db);
}

/**
 * Apakah jadwal mingguan sudah jatuh tempo: hari ini hari yang dipilih, jam jadwal
 * sudah lewat, dan jalan terakhir yang berasal dari JADWAL dimulai sebelum jam itu.
 * Fungsi murni - diuji.
 */
export function ujiPulihJatuhTempo(p: PengaturanUjiPulih, terakhirJadwalMulai: string | undefined, kini = new Date()) {
  if (!p.aktif) return false;
  const { tanggal, jam } = waktuPengadilan(kini);
  const hari = new Date(`${tanggal}T12:00:00Z`).getUTCDay();
  if (hari !== p.hari) return false;
  if (jam.slice(0, 5) < p.jam) return false;
  if (!terakhirJadwalMulai) return true;
  const t = waktuPengadilan(new Date(terakhirJadwalMulai));
  return `${t.tanggal} ${t.jam.slice(0, 5)}` < `${tanggal} ${p.jam}`;
}

// ─── Penjaga sasaran sementara ───────────────────────────────────────────────

export const POLA_DB_SEMENTARA = /^aleta_ujipulih_\d{14}_[0-9a-f]{4}$/;

export function namaDbSementara(kini = new Date()) {
  const dua = (n: number) => String(n).padStart(2, "0");
  const cap = `${kini.getUTCFullYear()}${dua(kini.getUTCMonth() + 1)}${dua(kini.getUTCDate())}${dua(kini.getUTCHours())}${dua(kini.getUTCMinutes())}${dua(kini.getUTCSeconds())}`;
  return `aleta_ujipulih_${cap}_${randomBytes(2).toString("hex")}`;
}

/** Nama basis data dari URL koneksi (produksi). */
export function namaDbDariUrl(url: string) {
  try {
    return decodeURIComponent(new URL(url).pathname.replace(/^\//, ""));
  } catch {
    return "";
  }
}

/**
 * PENJAGA UTAMA: melempar bila `nama` bukan basis data sementara uji pulih, atau
 * sama dengan basis data produksi. Dipanggil di setiap langkah mesin.
 */
export function pastikanSasaranSementara(nama: string, produksi: string) {
  const n = String(nama ?? "");
  if (!POLA_DB_SEMENTARA.test(n)) throw new Error(`Sasaran pemulihan "${n.slice(0, 60)}" bukan basis data sementara uji pulih; dihentikan.`);
  if (produksi && n.toLowerCase() === produksi.toLowerCase()) throw new Error("Sasaran pemulihan sama dengan basis data produksi; dihentikan.");
  if (/^(postgres|template0|template1)$/i.test(n)) throw new Error("Sasaran pemulihan adalah basis data bawaan server; dihentikan.");
}

/** Perintah SQL yang berpindah atau mengubah basis data lain - berkas yang memuatnya TIDAK dijalankan. */
const POLA_BERBAHAYA = [
  /^\s*\\(connect|c)(\s|$)/i,
  /^\s*\\!/,
  /^\s*\\(i|ir|include|include_relative)\s/i,
  /^\s*(CREATE|DROP|ALTER)\s+DATABASE\b/i,
  /^\s*DROP\s+(ROLE|USER|TABLESPACE)\b/i,
  /^\s*ALTER\s+SYSTEM\b/i,
];

export type HasilPindai = { aman: boolean; baris: number; temuan: string };

/** Memindai berkas SQL baris demi baris, melewati data COPY ... FROM stdin sampai "\.". */
export async function pindaiSqlBerbahaya(jalur: string): Promise<HasilPindai> {
  const aliran = createReadStream(jalur, { encoding: "utf8" });
  const rl = createInterface({ input: aliran, crlfDelay: Infinity });
  let nomor = 0;
  let dalamCopy = false;
  try {
    for await (const baris of rl) {
      nomor += 1;
      if (dalamCopy) {
        if (baris === "\\.") dalamCopy = false;
        continue;
      }
      if (/^\s*COPY\s.+\sFROM\s+stdin\b/i.test(baris)) {
        dalamCopy = true;
        continue;
      }
      for (const p of POLA_BERBAHAYA) {
        if (p.test(baris)) return { aman: false, baris: nomor, temuan: `baris ${nomor}: ${baris.trim().slice(0, 40)}` };
      }
    }
  } finally {
    // Berhenti lebih awal (temuan) tidak menutup aliran di bawahnya: tutup eksplisit supaya berkas dapat dihapus (Windows) dan fd tidak bocor.
    rl.close();
    aliran.destroy();
  }
  return { aman: true, baris: nomor, temuan: "" };
}

// ─── Mesin pemulihan ─────────────────────────────────────────────────────────

export type RingkasanBasisData = { migrasi: number | null; tabel: Record<string, number | null> };

export interface MesinPulih {
  /** Nama basis data produksi - untuk penjaga; mesin menolak menyentuhnya. */
  readonly namaProduksi: string;
  buatDb(nama: string): Promise<void>;
  pulihkan(nama: string, jalurSql: string, batasMs: number): Promise<{ galat: string[] }>;
  ringkas(nama: string, tabel: string[]): Promise<RingkasanBasisData>;
  hapusDb(nama: string): Promise<void>;
}

const NAMA_TABEL_SAH = /^[a-z_][a-z0-9_]*$/;

function sambunganDari(url: string) {
  const u = new URL(url);
  return {
    host: u.hostname,
    port: u.port ? Number(u.port) : 5432,
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
  };
}

/** Mesin sungguhan: PostgreSQL yang sama dengan produksi, basis data lain. */
export function mesinPostgres(urlProduksi = getDatabaseUrl()): MesinPulih {
  const produksi = namaDbDariUrl(urlProduksi);
  const sambungan = sambunganDari(urlProduksi);

  async function klien(database: string) {
    const c = new Client({ ...sambungan, database, connectionTimeoutMillis: 15_000 });
    await c.connect();
    return c;
  }
  async function klienPemeliharaan() {
    // Tidak pernah basis data produksi: CREATE/DROP DATABASE dijalankan dari sini.
    try {
      return await klien("postgres");
    } catch {
      return klien("template1");
    }
  }

  return {
    namaProduksi: produksi,
    async buatDb(nama) {
      pastikanSasaranSementara(nama, produksi);
      const c = await klienPemeliharaan();
      try {
        await c.query(`CREATE DATABASE "${nama}" TEMPLATE template0 ENCODING 'UTF8'`);
      } finally {
        await c.end().catch(() => undefined);
      }
    },
    async pulihkan(nama, jalurSql, batasMs) {
      pastikanSasaranSementara(nama, produksi);
      return new Promise((selesai, gagal) => {
        const anak = spawn(
          "psql",
          ["-X", "-q", "-v", "ON_ERROR_STOP=0", "-h", sambungan.host, "-p", String(sambungan.port), "-U", sambungan.user, "-d", nama, "-f", jalurSql],
          { env: { ...process.env, PGPASSWORD: sambungan.password }, windowsHide: true, stdio: ["ignore", "ignore", "pipe"] }
        );
        const galat: string[] = [];
        let sisa = "";
        anak.stderr.on("data", (b: Buffer) => {
          sisa += b.toString("utf8");
          const baris = sisa.split("\n");
          sisa = baris.pop() ?? "";
          for (const l of baris) if (/ERROR:|FATAL:/.test(l) && galat.length < 200) galat.push(l.slice(0, 200));
        });
        const pewaktu = setTimeout(() => {
          anak.kill();
          gagal(new Error("psql melebihi batas waktu pemulihan"));
        }, batasMs);
        anak.once("error", (e) => {
          clearTimeout(pewaktu);
          gagal(e);
        });
        anak.once("close", () => {
          clearTimeout(pewaktu);
          if (sisa && /ERROR:|FATAL:/.test(sisa)) galat.push(sisa.slice(0, 200));
          selesai({ galat });
        });
      });
    },
    async ringkas(nama, tabel) {
      pastikanSasaranSementara(nama, produksi);
      const c = await klien(nama);
      try {
        const hasil: RingkasanBasisData = { migrasi: null, tabel: {} };
        const adaMigrasi = await c.query("SELECT to_regclass('drizzle.__drizzle_migrations') AS t");
        if (adaMigrasi.rows[0]?.t) hasil.migrasi = Number((await c.query("SELECT COUNT(*)::int AS n FROM drizzle.__drizzle_migrations")).rows[0].n);
        for (const t of tabel) {
          if (!NAMA_TABEL_SAH.test(t)) continue;
          const ada = await c.query("SELECT to_regclass($1) AS t", [`public.${t}`]);
          hasil.tabel[t] = ada.rows[0]?.t ? Number((await c.query(`SELECT COUNT(*)::int AS n FROM public."${t}"`)).rows[0].n) : null;
        }
        return hasil;
      } finally {
        await c.end().catch(() => undefined);
      }
    },
    async hapusDb(nama) {
      pastikanSasaranSementara(nama, produksi);
      const c = await klienPemeliharaan();
      try {
        await c.query("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()", [nama]);
        await c.query(`DROP DATABASE IF EXISTS "${nama}"`);
      } finally {
        await c.end().catch(() => undefined);
      }
    },
  };
}

// ─── Berkas cadangan ─────────────────────────────────────────────────────────

/** Tabel penting yang dihitung barisnya: hanya yang ada di produksi dan berisi. */
export const TABEL_PENTING = [
  "users",
  "roles",
  "positions",
  "accounts",
  "letters",
  "dispositions",
  "audit_logs",
  "institution_identity",
  "panel_settings",
  "aleta_jejak_masuk",
  "aleta_isian_perkara",
  "aleta_keterangan_perkara",
] as const;

export type CadanganDipilih = { bundel: string; selesai: string; nama: string; jalur: string; byte: number; sha256: string; tersandi: boolean; umurJam: number };

/** Bundel terbaru yang SUDAH selesai dan memuat arsip ALETA yang berkasnya ada. */
export async function pilihCadanganAleta(sekarang = new Date()): Promise<CadanganDipilih | null> {
  const semua: ManifestBundel[] = await daftarBundel();
  for (const m of semua) {
    if (!m.selesai) continue;
    const b = m.berkas.find((x) => x.sumber === "aleta");
    if (!b || path.basename(b.nama) !== b.nama) continue;
    const jalur = path.join(direktoriBundel(m.bundel), b.nama);
    const info = await stat(jalur).catch(() => null);
    if (!info?.isFile()) continue;
    return {
      bundel: m.bundel,
      selesai: m.selesai,
      nama: b.nama,
      jalur,
      byte: info.size,
      sha256: b.sha256,
      tersandi: b.tersandi,
      umurJam: Math.max(0, (sekarang.getTime() - Date.parse(m.selesai)) / 3_600_000),
    };
  }
  return null;
}

async function sidikBerkas(jalur: string) {
  const h = createHash("sha256");
  for await (const potong of createReadStream(jalur)) h.update(potong as Buffer);
  return h.digest("hex");
}

function jalankanProgram(program: string, argumen: string[], opsi: { cwd?: string } = {}): Promise<void> {
  return new Promise((selesai, gagal) => {
    const anak = spawn(program, argumen, { cwd: opsi.cwd, windowsHide: true, stdio: ["ignore", "ignore", "pipe"] });
    const galat: Buffer[] = [];
    anak.stderr.on("data", (b: Buffer) => galat.push(b));
    anak.once("error", gagal);
    anak.once("close", (kode) => (kode === 0 ? selesai() : gagal(new Error(Buffer.concat(galat).toString("utf8").slice(0, 300) || `${program} keluar dengan kode ${kode}`))));
  });
}

/**
 * Membaca aliran tar (ustar) dan menulis HANYA berkas *.sql ke `tujuan`. Berkas lain
 * dilewati tanpa disimpan. Nama berkas diambil dari basename saja (tanpa jalur) agar
 * tidak ada yang keluar dari folder kerja.
 */
export async function ekstrakSqlDariTar(sumber: Readable, tujuan: string): Promise<string[]> {
  await mkdir(tujuan, { recursive: true });
  const hasil: string[] = [];
  let penyangga: Buffer = Buffer.alloc(0);
  let sisaIsi = 0;
  let sisaPadding = 0;
  let keluaran: ReturnType<typeof createWriteStream> | null = null;
  let selesaiKeluaran: Promise<void> | null = null;

  const tutupKeluaran = async () => {
    if (keluaran) {
      keluaran.end();
      await selesaiKeluaran;
      keluaran = null;
      selesaiKeluaran = null;
    }
  };

  for await (const potong of sumber) {
    penyangga = penyangga.length ? Buffer.concat([penyangga, potong as Buffer]) : (potong as Buffer);
    for (;;) {
      if (sisaIsi > 0) {
        if (!penyangga.length) break;
        const ambil = Math.min(sisaIsi, penyangga.length);
        if (keluaran) keluaran.write(penyangga.subarray(0, ambil));
        penyangga = penyangga.subarray(ambil);
        sisaIsi -= ambil;
        if (sisaIsi === 0) await tutupKeluaran();
        continue;
      }
      if (sisaPadding > 0) {
        if (!penyangga.length) break;
        const ambil = Math.min(sisaPadding, penyangga.length);
        penyangga = penyangga.subarray(ambil);
        sisaPadding -= ambil;
        continue;
      }
      if (penyangga.length < 512) break;
      const kepala = penyangga.subarray(0, 512);
      penyangga = penyangga.subarray(512);
      if (kepala.every((b) => b === 0)) continue; // blok penutup
      const nama = kepala.subarray(0, 100).toString("utf8").replace(/\0[\s\S]*$/, "");
      const awalan = kepala.subarray(345, 500).toString("utf8").replace(/\0[\s\S]*$/, "");
      const ukuran = parseInt(kepala.subarray(124, 136).toString("ascii").replace(/\0[\s\S]*$/, "").trim() || "0", 8) || 0;
      const jenis = String.fromCharCode(kepala[156] || 48);
      const penuh = awalan ? `${awalan}/${nama}` : nama;
      const dasar = path.basename(penuh.replace(/\\/g, "/"));
      sisaIsi = ukuran;
      sisaPadding = (512 - (ukuran % 512)) % 512;
      if ((jenis === "0" || jenis === "\0") && /\.sql$/i.test(dasar) && /^[\w.\-]+$/.test(dasar)) {
        const jalur = path.join(tujuan, dasar);
        keluaran = createWriteStream(jalur);
        selesaiKeluaran = new Promise<void>((ok, gagal) => {
          keluaran!.once("finish", ok);
          keluaran!.once("error", gagal);
        });
        hasil.push(jalur);
        if (ukuran === 0) await tutupKeluaran();
      }
    }
  }
  await tutupKeluaran();
  return hasil;
}

async function cariSql(akar: string): Promise<string[]> {
  const hasil: string[] = [];
  for (const e of await readdir(akar, { withFileTypes: true })) {
    const penuh = path.join(akar, e.name);
    if (e.isDirectory()) hasil.push(...(await cariSql(penuh)));
    else if (e.isFile() && /\.sql$/i.test(e.name)) hasil.push(penuh);
  }
  return hasil;
}

/** Membongkar arsip ke folder kerja dan memulangkan berkas SQL polos (preferensi: aleta-postgres-*.sql). */
export async function bongkarKeSql(jalurArsip: string, namaAsli: string, kerja: string): Promise<string> {
  const nama = (namaAsli.endsWith(AKHIRAN_SANDI) ? namaAsli.slice(0, -AKHIRAN_SANDI.length) : namaAsli).toLowerCase();
  const tujuan = path.join(kerja, "isi");
  await mkdir(tujuan, { recursive: true });
  if (/\.(tar\.gz|tgz)$/.test(nama)) {
    await ekstrakSqlDariTar(createReadStream(jalurArsip).pipe(createGunzip()), tujuan);
  } else if (/\.tar\.xz$/.test(nama)) {
    const anak = spawn("xz", ["-dc", jalurArsip], { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    const galat: Buffer[] = [];
    anak.stderr.on("data", (b: Buffer) => galat.push(b));
    const tanggung = new Promise<void>((selesai, gagal) => {
      anak.once("error", gagal);
      anak.once("close", (kode) => (kode === 0 ? selesai() : gagal(new Error(Buffer.concat(galat).toString("utf8").slice(0, 300) || `xz keluar dengan kode ${kode}`))));
    });
    await Promise.all([ekstrakSqlDariTar(anak.stdout, tujuan), tanggung]);
  } else if (/\.(7z|rar|zip)$/.test(nama)) {
    await jalankanProgram("7z", ["x", "-y", "-bd", `-o${tujuan}`, jalurArsip, "-r", "-i!*.sql"]);
  } else {
    throw new Error(`Format arsip "${nama.split(".").slice(-2).join(".")}" tidak dikenali.`);
  }
  const daftar = await cariSql(tujuan);
  if (!daftar.length) throw new Error("Arsip tidak memuat berkas SQL polos (hanya format kustom?). Uji pulih memerlukan SQL polos.");
  daftar.sort((a, b) => Number(/postgres/i.test(path.basename(b))) - Number(/postgres/i.test(path.basename(a))) || a.localeCompare(b));
  return daftar[0];
}

// ─── Hasil ───────────────────────────────────────────────────────────────────

export type LangkahUji = { nama: string; ok: boolean; ms: number; catatan: string };
export type BarisTabel = { nama: string; pulih: number | null; produksi: number; selisihPersen: number; lulus: boolean };

export type RincianUjiPulih = {
  langkah: LangkahUji[];
  berkas: { nama: string; byte: number; tersandi: boolean; sha256Cocok: boolean | null; umurJam: number } | null;
  migrasi: { pulih: number | null; produksi: number | null; lulus: boolean | null };
  tabel: BarisTabel[];
  galatPsql: number;
  contohGalatPsql: string[];
  dbSementara: string;
};

export type BarisUjiPulih = {
  id: string;
  mulaiPada: string;
  selesaiPada: string;
  pemicu: "jadwal" | "manual";
  oleh: string;
  status: "berjalan" | "berhasil" | "gagal";
  tingkat: "baik" | "peringatan" | "gagal" | "";
  bundel: string;
  berkas: string;
  pesan: string;
  durasiMs: number;
  dibersihkan: boolean;
  rincian: RincianUjiPulih | null;
};

type BarisDb = {
  id: string; mulai_pada: string; selesai_pada: string; pemicu: string; oleh: string; status: string; tingkat: string;
  bundel: string; berkas: string; pesan: string; durasi_ms: number; dibersihkan: number; rincian: string;
};

function dariDb(b: BarisDb): BarisUjiPulih {
  let rincian: RincianUjiPulih | null = null;
  try {
    rincian = JSON.parse(b.rincian || "null") as RincianUjiPulih | null;
  } catch {
    rincian = null;
  }
  return {
    id: b.id,
    mulaiPada: b.mulai_pada,
    selesaiPada: b.selesai_pada,
    pemicu: b.pemicu === "jadwal" ? "jadwal" : "manual",
    oleh: b.oleh,
    status: b.status === "berhasil" ? "berhasil" : b.status === "berjalan" ? "berjalan" : "gagal",
    tingkat: (["baik", "peringatan", "gagal"].includes(b.tingkat) ? b.tingkat : "") as BarisUjiPulih["tingkat"],
    bundel: b.bundel,
    berkas: b.berkas,
    pesan: b.pesan,
    durasiMs: Number(b.durasi_ms ?? 0),
    dibersihkan: Number(b.dibersihkan ?? 0) === 1,
    rincian,
  };
}

export async function riwayatUjiPulih(db: AletaDatabase, batas = 10): Promise<BarisUjiPulih[]> {
  try {
    const baris = await db.queryAll<BarisDb>("SELECT * FROM aleta_uji_pulih ORDER BY mulai_pada DESC, id DESC LIMIT ?", [Math.max(1, Math.min(100, batas))]);
    return baris.map(dariDb);
  } catch {
    return [];
  }
}

/** Berjalan tetapi sudah lewat 3 jam = proses terputus (server mati di tengah); tidak lagi dihitung berjalan. */
export const BATAS_BERJALAN_MS = 3 * 60 * 60 * 1000;

export async function sedangBerjalan(db: AletaDatabase, kini = new Date()) {
  if (flag().berjalan) return true;
  try {
    const b = await db.queryOne<{ mulai_pada: string }>("SELECT mulai_pada FROM aleta_uji_pulih WHERE status = 'berjalan' ORDER BY mulai_pada DESC LIMIT 1");
    return Boolean(b && kini.getTime() - Date.parse(b.mulai_pada) < BATAS_BERJALAN_MS);
  } catch {
    return false;
  }
}

const G = globalThis as unknown as { __aletaUjiPulih?: { berjalan: boolean; pewaktu: NodeJS.Timeout | null; janji: Promise<unknown> | null } };
function flag() {
  G.__aletaUjiPulih ??= { berjalan: false, pewaktu: null, janji: null };
  return G.__aletaUjiPulih;
}

// ─── Menjalankan ─────────────────────────────────────────────────────────────

export type OpsiUjiPulih = {
  pemicu: "jadwal" | "manual";
  olehId?: string;
  olehNama?: string;
  /** Uji: mesin pengganti (tanpa PostgreSQL sungguhan). */
  mesin?: MesinPulih;
  sekarang?: Date;
  /** Uji: folder kerja induk. Bawaan: <tmp>. */
  direktoriKerja?: string;
  /** Uji: pengganti pengirim WhatsApp ke admin. */
  kirimWa?: (m: { nomor: string; nama: string; pesan: string; kunci: string }) => Promise<void>;
  batasPsqlMs?: number;
  /** Uji: pengganti pembacaan produksi (jumlah migrasi dan baris tabel penting). */
  bacaProduksi?: (db: AletaDatabase, tabel: readonly string[]) => Promise<{ migrasi: number | null; tabel: Record<string, number> }>;
};

const ID = (p: string) => `${p}-${randomUUID()}`;

async function hitungProduksi(db: AletaDatabase, tabel: readonly string[]): Promise<{ migrasi: number | null; tabel: Record<string, number> }> {
  const hasil: { migrasi: number | null; tabel: Record<string, number> } = { migrasi: null, tabel: {} };
  try {
    const ada = await db.queryOne<{ t: string | null }>("SELECT to_regclass('drizzle.__drizzle_migrations') AS t");
    if (ada?.t) hasil.migrasi = Number((await db.queryOne<{ n: number }>("SELECT COUNT(*)::int AS n FROM drizzle.__drizzle_migrations"))?.n ?? 0);
  } catch {
    hasil.migrasi = null;
  }
  for (const t of tabel) {
    if (!NAMA_TABEL_SAH.test(t)) continue;
    try {
      const n = Number((await db.queryOne<{ n: number }>(`SELECT COUNT(*)::int AS n FROM ${t}`))?.n ?? 0);
      hasil.tabel[t] = n;
    } catch {
      /* tabel tidak ada di produksi: tidak diperiksa */
    }
  }
  return hasil;
}

/** Bandingkan hitungan; fungsi murni. */
export function bandingkanTabel(produksi: Record<string, number>, pulih: Record<string, number | null>, toleransiPersen: number): BarisTabel[] {
  const hasil: BarisTabel[] = [];
  for (const [nama, p] of Object.entries(produksi)) {
    if (p <= 0) continue; // tabel kosong di produksi: tidak ada yang dibuktikan
    const r = pulih[nama] ?? null;
    const selisih = r === null ? 100 : Math.round(((p - r) / p) * 1000) / 10;
    const lulus = r !== null && r > 0 && selisih <= toleransiPersen;
    hasil.push({ nama, pulih: r, produksi: p, selisihPersen: selisih, lulus });
  }
  return hasil;
}

export async function jalankanUjiPulih(db: AletaDatabase, opsi: OpsiUjiPulih): Promise<BarisUjiPulih> {
  const f = flag();
  if (f.berjalan) throw new Error("Uji pulih sedang berjalan. Tunggu sampai selesai.");
  f.berjalan = true;
  const mulai = opsi.sekarang ?? new Date();
  const mulaiMs = Date.now();
  const id = ID("pulih");
  const p = await bacaPengaturanUjiPulih(db);
  const langkah: LangkahUji[] = [];
  const rincian: RincianUjiPulih = {
    langkah,
    berkas: null,
    migrasi: { pulih: null, produksi: null, lulus: null },
    tabel: [],
    galatPsql: 0,
    contohGalatPsql: [],
    dbSementara: "",
  };
  let status: "berhasil" | "gagal" = "gagal";
  let tingkat: BarisUjiPulih["tingkat"] = "gagal";
  let pesan = "";
  let bundel = "";
  let berkasNama = "";
  let dibersihkan = true;
  let kerja = "";
  let dbSementara = "";
  let dibuat = false;
  const mesin = opsi.mesin ?? mesinPostgres();

  try {
    await db
      .prepare(
        `INSERT INTO aleta_uji_pulih (id, mulai_pada, selesai_pada, pemicu, oleh, status, tingkat, bundel, berkas, pesan, durasi_ms, dibersihkan, rincian)
         VALUES (?, ?, '', ?, ?, 'berjalan', '', '', '', '', 0, 0, '{}')`
      )
      .run(id, mulai.toISOString(), opsi.pemicu, opsi.olehNama ?? opsi.olehId ?? (opsi.pemicu === "jadwal" ? "Jadwal mingguan" : ""));
  } catch (galat) {
    f.berjalan = false;
    throw new Error(`Tabel hasil uji pulih belum ada (migrasi 0109 belum jalan?): ${galat instanceof Error ? galat.message.slice(0, 120) : "tidak diketahui"}`);
  }

  const jalan = async <T>(nama: string, kerjaan: () => Promise<T>, catatan?: (hasil: T) => string): Promise<T> => {
    const t0 = Date.now();
    try {
      const hasil = await kerjaan();
      langkah.push({ nama, ok: true, ms: Date.now() - t0, catatan: catatan ? catatan(hasil) : "" });
      return hasil;
    } catch (galat) {
      langkah.push({ nama, ok: false, ms: Date.now() - t0, catatan: (galat instanceof Error ? galat.message : "gagal").slice(0, 300) });
      throw galat;
    }
  };

  try {
    // 1. cadangan terbaru
    const cad = await jalan(
      "Cari cadangan ALETA terbaru",
      async () => {
        const c = await pilihCadanganAleta(mulai);
        if (!c) throw new Error("Belum ada cadangan ALETA yang selesai di server. Nyalakan Sinkron & cadangan atau jalankan cadangan dulu.");
        return c;
      },
      (c) => `bundel ${c.bundel}, ${(c.byte / 1024 ** 2).toFixed(1)} MB, umur ${c.umurJam.toFixed(0)} jam`
    );
    bundel = cad.bundel;
    berkasNama = cad.nama;
    rincian.berkas = { nama: cad.nama, byte: cad.byte, tersandi: cad.tersandi, sha256Cocok: null, umurJam: Math.round(cad.umurJam) };

    // 2. sidik
    const cocok = await jalan("Periksa sidik SHA-256", async () => (await sidikBerkas(cad.jalur)) === cad.sha256);
    rincian.berkas.sha256Cocok = cocok;
    if (!cocok) throw new Error("Sidik SHA-256 berkas cadangan tidak cocok dengan manifest: berkas rusak atau berubah.");

    // 3. folder kerja + ruang disk
    const induk = opsi.direktoriKerja ?? os.tmpdir();
    await mkdir(induk, { recursive: true });
    kerja = await mkdtemp(path.join(induk, "aleta-ujipulih-"));
    await jalan(
      "Periksa ruang disk",
      async () => {
        const s = await statfs(kerja).catch(() => null);
        if (!s) return -1;
        const bebas = Number(s.bavail) * Number(s.bsize);
        const butuh = Math.max(2 * 1024 ** 3, cad.byte * 8);
        if (bebas < butuh) throw new Error(`Ruang disk kerja tinggal ${(bebas / 1024 ** 3).toFixed(1)} GB, perlu sekitar ${(butuh / 1024 ** 3).toFixed(1)} GB.`);
        return bebas;
      },
      (b) => (b < 0 ? "tidak terbaca" : `${(b / 1024 ** 3).toFixed(1)} GB bebas`)
    );

    // 4. buka sandi
    let jalurArsip = cad.jalur;
    if (cad.tersandi || cad.nama.endsWith(AKHIRAN_SANDI)) {
      jalurArsip = await jalan("Buka sandi arsip", async () => {
        const sandi = sandiArsip(await bacaPengaturan());
        if (!sandi) throw new Error("Arsip tersandi tetapi kata sandi arsip tidak terbaca (kunci server berganti?). Isi ulang kata sandi arsip di Sinkron & cadangan.");
        const keluar = path.join(kerja, "arsip.dekripsi");
        await bukaSandiBerkas(cad.jalur, keluar, sandi);
        return keluar;
      });
    }

    // 5. bongkar
    const sql = await jalan(
      "Bongkar arsip dan ambil SQL",
      () => bongkarKeSql(jalurArsip, cad.nama, kerja),
      (j) => path.basename(j)
    );

    // 6. pindai SQL
    await jalan(
      "Periksa perintah di dalam SQL",
      async () => {
        const hasil = await pindaiSqlBerbahaya(sql);
        if (!hasil.aman) throw new Error(`SQL memuat perintah yang menyentuh basis data lain (${hasil.temuan}). Tidak dijalankan.`);
        return hasil;
      },
      (h) => `${h.baris} baris, aman`
    );

    // 7. basis data sementara
    dbSementara = namaDbSementara(mulai);
    pastikanSasaranSementara(dbSementara, mesin.namaProduksi);
    rincian.dbSementara = dbSementara;
    dibersihkan = false;
    await jalan("Buat basis data sementara", () => mesin.buatDb(dbSementara), () => dbSementara);
    dibuat = true;

    // 8. pulihkan
    const pulih = await jalan(
      "Pulihkan ke basis data sementara",
      () => mesin.pulihkan(dbSementara, sql, opsi.batasPsqlMs ?? Number(process.env.ALETA_UJI_PULIH_BATAS_MENIT || 30) * 60_000),
      (h) => `${h.galat.length} baris kesalahan dari psql`
    );
    rincian.galatPsql = pulih.galat.length;
    rincian.contohGalatPsql = pulih.galat.slice(0, 5);

    // 9. bandingkan
    const prod = await jalan("Hitung tabel produksi (hanya baca)", () => (opsi.bacaProduksi ?? hitungProduksi)(db, TABEL_PENTING));
    const ring = await jalan("Hitung tabel hasil pulih", () => mesin.ringkas(dbSementara, Object.keys(prod.tabel)));
    rincian.tabel = bandingkanTabel(prod.tabel, ring.tabel, p.toleransiPersen);
    rincian.migrasi = {
      pulih: ring.migrasi,
      produksi: prod.migrasi,
      // Produksi tanpa catatan migrasi (null/0: skema dibuat ensureAletaSchema, bukan drizzle) -> tidak ada yang dibandingkan.
      lulus: !prod.migrasi ? null : ring.migrasi !== null && ring.migrasi > 0 && ring.migrasi <= prod.migrasi,
    };
    await jalan(
      "Nilai hasil",
      async () => {
        if (rincian.migrasi.lulus === false) {
          throw new Error(`Jumlah migrasi hasil pulih (${rincian.migrasi.pulih ?? "tidak ada"}) tidak masuk akal terhadap produksi (${rincian.migrasi.produksi}).`);
        }
        const gagal = rincian.tabel.filter((t) => !t.lulus);
        if (gagal.length) {
          throw new Error(`Tabel tidak cocok: ${gagal.map((t) => `${t.nama} (${t.pulih ?? "tidak ada"} dari ${t.produksi})`).join(", ")}.`);
        }
        if (!rincian.tabel.length) throw new Error("Tidak ada tabel penting yang dapat dibandingkan.");
        return true;
      },
      () => `${rincian.tabel.length} tabel cocok`
    );
    status = "berhasil";
    tingkat = cad.umurJam > 48 ? "peringatan" : "baik";
    pesan =
      tingkat === "peringatan"
        ? `Cadangan dapat dipulihkan, tetapi cadangan terbarunya sudah ${Math.round(cad.umurJam)} jam. Periksa jadwal cadangan harian.`
        : `Cadangan ${cad.bundel} berhasil dipulihkan ke basis data sementara dan cocok (${rincian.tabel.length} tabel diperiksa).`;
  } catch (galat) {
    status = "gagal";
    tingkat = "gagal";
    pesan = (galat instanceof Error ? galat.message : "Uji pulih gagal.").slice(0, 400);
  } finally {
    // SELALU bersihkan: basis data sementara dulu, lalu folder kerja.
    if (dbSementara) {
      try {
        await mesin.hapusDb(dbSementara);
        dibersihkan = true;
        langkah.push({ nama: "Hapus basis data sementara", ok: true, ms: 0, catatan: dbSementara });
      } catch (galat) {
        if (dibuat) {
          dibersihkan = false;
          langkah.push({ nama: "Hapus basis data sementara", ok: false, ms: 0, catatan: (galat instanceof Error ? galat.message : "gagal").slice(0, 200) });
          status = "gagal";
          tingkat = "gagal";
          pesan = `${pesan ? `${pesan} ` : ""}Basis data sementara ${dbSementara} GAGAL dihapus; hapus manual (DROP DATABASE).`.trim();
        } else {
          // Tidak pernah berhasil dibuat: tidak ada yang perlu dihapus, galat pembersihan bukan temuan.
          dibersihkan = true;
        }
      }
    }
    if (kerja) await rm(kerja, { recursive: true, force: true }).catch(() => undefined);
    f.berjalan = false;
  }

  const selesai = new Date();
  await db
    .prepare(
      `UPDATE aleta_uji_pulih SET selesai_pada = ?, status = ?, tingkat = ?, bundel = ?, berkas = ?, pesan = ?, durasi_ms = ?, dibersihkan = ?, rincian = ? WHERE id = ?`
    )
    .run(selesai.toISOString(), status, tingkat, bundel, berkasNama, pesan, Date.now() - mulaiMs, dibersihkan ? 1 : 0, JSON.stringify(rincian).slice(0, 60_000), id);

  const baris: BarisUjiPulih = {
    id,
    mulaiPada: mulai.toISOString(),
    selesaiPada: selesai.toISOString(),
    pemicu: opsi.pemicu,
    oleh: opsi.olehNama ?? opsi.olehId ?? (opsi.pemicu === "jadwal" ? "Jadwal mingguan" : ""),
    status,
    tingkat,
    bundel,
    berkas: berkasNama,
    pesan,
    durasiMs: Date.now() - mulaiMs,
    dibersihkan,
    rincian,
  };
  await laporkan(db, baris, opsi).catch((e) => console.warn("[UJI PULIH] laporan:", e instanceof Error ? e.message : "tidak diketahui"));
  return baris;
}

/**
 * Memulai uji di latar (tombol "Jalankan uji sekarang"): pulang segera, hasilnya dibaca
 * dari riwayat. Melempar bila sedang berjalan atau tabel hasil belum ada.
 */
export async function mulaiUjiPulihLatar(db: AletaDatabase, opsi: OpsiUjiPulih) {
  if (await sedangBerjalan(db)) throw new Error("Uji pulih sedang berjalan. Tunggu sampai selesai.");
  // Tabel hasil harus ada SEBELUM kita menjawab "dimulai".
  await db.queryOne("SELECT 1 FROM aleta_uji_pulih LIMIT 1").catch(() => {
    throw new Error("Tabel hasil uji pulih belum ada (migrasi 0109 belum jalan).");
  });
  const janji = jalankanUjiPulih(db, opsi).catch((galat) => console.warn("[UJI PULIH] latar:", galat instanceof Error ? galat.message : "tidak diketahui"));
  flag().janji = janji;
}

/** Hanya untuk uji: menunggu uji latar terakhir selesai. */
export async function __tungguUjiPulihLatarUntukUji() {
  await flag().janji;
}

// ─── Laporan ─────────────────────────────────────────────────────────────────

async function laporkan(db: AletaDatabase, b: BarisUjiPulih, opsi: OpsiUjiPulih) {
  await laporkanKeKesehatan(db, {
    sumber: "uji-pulih-cadangan",
    tingkat: b.tingkat === "baik" ? "baik" : b.tingkat === "peringatan" ? "peringatan" : "gagal",
    judul: b.status === "berhasil" ? "Uji pulih cadangan berhasil" : "Uji pulih cadangan GAGAL",
    rincian: b.pesan,
    waktu: b.selesaiPada,
    data: { id: b.id, bundel: b.bundel, berkas: b.berkas, durasiMs: b.durasiMs, dibersihkan: b.dibersihkan },
  });
  if (b.status !== "gagal") return;
  const kirim = opsi.kirimWa ?? kirimWaPortal;
  const admin = await db
    .queryAll<{ id: string; name: string; whatsapp_number: string }>(
      `SELECT id, name, whatsapp_number FROM users
        WHERE deleted_at IS NULL AND is_active = 1 AND role_id IN ('admin', 'super-admin') AND COALESCE(whatsapp_number, '') <> ''`
    )
    .catch(() => []);
  const tanggal = b.mulaiPada.slice(0, 10);
  for (const a of admin) {
    try {
      await kirim({
        nomor: a.whatsapp_number,
        nama: a.name,
        kunci: `uji-pulih-${tanggal}-${b.id}`,
        pesan: `Uji pulih cadangan GAGAL (${tanggal}).\n${b.pesan}\nBuka Pusat Kendali > Pengaturan Keamanan > Uji pulih cadangan untuk rinciannya.`,
      });
    } catch (galat) {
      console.warn("[UJI PULIH] WhatsApp admin gagal:", galat instanceof Error ? galat.message : "tidak diketahui");
    }
  }
}

async function kirimWaPortal(m: { nomor: string; nama: string; pesan: string; kunci: string }) {
  const { sendPortalWhatsappMessage } = await import("@/server/modules/whatsapp/portal-whatsapp-sender");
  await sendPortalWhatsappMessage({
    sourceFeature: "uji-pulih-cadangan",
    entityType: "uji_pulih",
    entityId: m.kunci,
    eventType: "gagal",
    recipientNumber: m.nomor,
    recipientName: m.nama,
    message: m.pesan,
    category: "system",
    priority: 3,
  });
}

/** Pemberitahuan lonceng untuk Admin/Super Admin: uji pulih terakhir (7 hari) yang GAGAL. */
export async function pemberitahuanUjiPulih(db: AletaDatabase, kini = new Date()) {
  const [terakhir] = await riwayatUjiPulih(db, 1);
  if (!terakhir || terakhir.status !== "gagal") return [];
  if (kini.getTime() - Date.parse(terakhir.selesaiPada || terakhir.mulaiPada) > 7 * 86_400_000) return [];
  return [
    {
      id: `uji_pulih_${terakhir.id}`,
      judul: "Uji pulih cadangan gagal",
      uraian: terakhir.pesan,
      waktu: terakhir.selesaiPada || terakhir.mulaiPada,
    },
  ];
}

// ─── Penjadwal ───────────────────────────────────────────────────────────────

/** Satu detak: menjalankan uji bila jatuh tempo. Dipisah dari pewaktu agar dapat diuji. */
export async function detakUjiPulih(db: AletaDatabase, kini = new Date(), opsi: Partial<OpsiUjiPulih> = {}) {
  const p = await bacaPengaturanUjiPulih(db);
  if (!p.aktif) return null;
  if (await sedangBerjalan(db, kini)) return null;
  let terakhir: string | undefined;
  try {
    terakhir = (await db.queryOne<{ mulai_pada: string }>("SELECT mulai_pada FROM aleta_uji_pulih WHERE pemicu = 'jadwal' ORDER BY mulai_pada DESC LIMIT 1"))?.mulai_pada;
  } catch {
    return null; // tabel belum ada
  }
  if (!ujiPulihJatuhTempo(p, terakhir, kini)) return null;
  // Jangan bertabrakan dengan cadangan/sinkron yang sedang menulis bundel baru: coba lagi pada detak berikutnya.
  try {
    const { tugasBerjalan } = await import("@/server/modules/sinkron/penjadwal");
    if (tugasBerjalan()) return null;
  } catch {
    /* penjadwal sinkron tidak dimuat: lanjut */
  }
  return jalankanUjiPulih(db, { ...opsi, pemicu: "jadwal", sekarang: kini });
}

/** Detak 5 menit; dinyalakan instrumentation.ts. Matikan seluruhnya dengan ALETA_UJI_PULIH=0. */
export function mulaiUjiPulihBerkala(ambilDb: () => Promise<AletaDatabase>, jedaMs = 5 * 60 * 1000) {
  const f = flag();
  if (f.pewaktu) return;
  const detak = async () => {
    try {
      await detakUjiPulih(await ambilDb());
    } catch (galat) {
      console.warn("[UJI PULIH] detak:", galat instanceof Error ? galat.message : "tidak diketahui");
    }
  };
  f.pewaktu = setInterval(() => void detak(), jedaMs);
  f.pewaktu.unref?.();
}

export function hentikanUjiPulihBerkala() {
  const f = flag();
  if (f.pewaktu) clearInterval(f.pewaktu);
  f.pewaktu = null;
}

export function __setelUlangUjiPulihUntukUji() {
  hentikanUjiPulihBerkala();
  flag().berjalan = false;
  flag().janji = null;
}
