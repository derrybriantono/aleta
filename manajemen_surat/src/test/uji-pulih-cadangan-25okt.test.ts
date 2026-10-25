// @vitest-environment node
import { readFileSync } from "node:fs";
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
import { Readable } from "node:stream";

import { NextRequest } from "next/server";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * ============================================================================
 * UJI PULIH CADANGAN (Bagian 6d, 25 Okt 2026) - perilaku nyata
 * ============================================================================
 *
 * Tanpa PostgreSQL sungguhan: arsip cadangan DIBUAT sungguhan di folder uji (tar.gz,
 * tersandi atau tidak), manifest dan sidik sungguhan, dibongkar dan dipindai kode
 * produksi; hanya "mesin" (CREATE/psql/COUNT/DROP) yang diganti tiruan yang mencatat
 * setiap operasi. Dibuktikan:
 *
 *   1. migrasi 0109 = DDL_UJI_PULIH;
 *   2. nama sasaran SELALU basis data sementara dan BUKAN produksi - di pipeline dan di
 *      setiap metode mesin sungguhan (ditolak sebelum menyambung ke mana pun);
 *   3. SQL berbahaya ditolak sebelum dijalankan; tar tidak bisa menulis keluar folder kerja;
 *   4. alur penuh berhasil/gagal, pembersihan SELALU terjadi (juga saat gagal);
 *   5. laporan ke Pusat kesehatan (kait), WhatsApp admin, lonceng; jadwal mingguan; rute.
 */

const k = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/server/db/client", async (asli) => {
  const m = await asli<typeof import("@/server/db/client")>();
  return { ...m, getDatabase: async () => k.db };
});
vi.mock("@/server/modules/aleta-bot/service", async (asli) => ({
  ...(await asli<Record<string, unknown>>()),
  syncAletaBotRuntimeConfigFromDb: async () => undefined,
}));

type Db = import("@/server/db/client").AletaDatabase;
type MesinPulih = import("@/server/modules/keamanan/uji-pulih").MesinPulih;
let db: Db;
let akar = "";
const ASAL = "http://localhost:3000";
const PRODUKSI = "aleta";
const SQL_BAIK = [
  "-- ALETA database backup (rekaan)",
  "SET statement_timeout = 0;",
  "CREATE TABLE public.users (id text primary key);",
  "COPY public.users (id) FROM stdin;",
  "usr-1",
  "\\connect lookalike-di-dalam-data",
  "\\.",
  "",
].join("\n");

beforeAll(async () => {
  const { createAletaDatabase } = await import("@/server/db/client");
  db = await createAletaDatabase({ useInMemory: true, seed: true });
  k.db = db;
  akar = await mkdtemp(path.join(process.env.TMP ?? process.env.TEMP ?? ".", "ujipulih-"));
  process.env.ALETA_SINKRON_DIR = path.join(akar, "sinkron");
  process.env.WHATSAPP_RUNTIME_MODE = "disabled";
}, 120_000);

afterAll(async () => {
  await db?.close();
  delete process.env.ALETA_SINKRON_DIR;
  if (akar) await rm(akar, { recursive: true, force: true }).catch(() => undefined);
});

beforeEach(async () => {
  await db.run("DELETE FROM aleta_uji_pulih", []);
  await db.run("DELETE FROM aleta_setelan_keamanan", []);
  await rm(path.join(akar, "sinkron"), { recursive: true, force: true });
  await rm(path.join(akar, "kerja"), { recursive: true, force: true });
  await mkdir(path.join(akar, "kerja"), { recursive: true });
  const { __setelUlangUjiPulihUntukUji } = await import("@/server/modules/keamanan/uji-pulih");
  __setelUlangUjiPulihUntukUji();
});

afterEach(async () => {
  const { __setelUlangKaitUntukUji } = await import("@/server/modules/keamanan/kait");
  __setelUlangKaitUntukUji();
});

// ─── bahan: arsip cadangan sungguhan ────────────────────────────────────────

async function susunTarGz(isi: Record<string, string | Buffer>) {
  const { susunTar } = await import("@/server/modules/backups/arsip");
  const dir = await mkdtemp(path.join(akar, "bahan-"));
  for (const [nama, teks] of Object.entries(isi)) {
    const jalur = path.join(dir, nama);
    await mkdir(path.dirname(jalur), { recursive: true });
    await writeFile(jalur, teks);
  }
  const { tar } = await susunTar(dir, Object.keys(isi).sort());
  await rm(dir, { recursive: true, force: true });
  return gzipSync(tar);
}

async function buatBundel(
  bundel: string,
  o: { sql?: string; selesai?: string; sandi?: string; rusakSidik?: boolean; isi?: Record<string, string | Buffer>; tanpaBerkas?: boolean } = {}
) {
  const dir = path.join(akar, "sinkron", "arsip", bundel);
  await mkdir(dir, { recursive: true });
  const tgz = await susunTarGz(o.isi ?? { [`aleta-database-x/aleta-postgres-${bundel}.sql`]: o.sql ?? SQL_BAIK, [`aleta-database-x/aleta-postgres-${bundel}.dump`]: "PGDMP-rekaan" });
  let nama = `aleta-database-${bundel}.tar.gz`;
  let isiBerkas: Buffer = tgz;
  if (o.sandi) {
    const { sandikanBuffer } = await import("@/server/modules/sinkron/sandi-arsip");
    isiBerkas = sandikanBuffer(tgz, o.sandi);
    nama += ".aleta-enc";
  }
  if (!o.tanpaBerkas) await writeFile(path.join(dir, nama), isiBerkas);
  const sha = createHash("sha256").update(isiBerkas).digest("hex");
  const selesai = o.selesai ?? new Date().toISOString();
  await writeFile(
    path.join(dir, "MANIFEST.json"),
    JSON.stringify({
      bundel,
      dibuat: selesai,
      selesai: o.selesai === "" ? "" : selesai,
      versiAplikasi: "uji",
      tersandi: Boolean(o.sandi),
      petunjukSandi: "",
      berkas: [{ nama, sumber: "aleta", byte: isiBerkas.length, sha256: o.rusakSidik ? "0".repeat(64) : sha, tersandi: Boolean(o.sandi), keterangan: "uji" }],
      gagal: [],
    })
  );
  return { dir, nama };
}

async function pasangSandiArsip(sandi: string) {
  const { encryptCredentialSecret } = await import("@/server/shared/security");
  const { tulisJson, jalurSinkron } = await import("@/server/modules/sinkron/penyimpanan");
  const { pengaturanBawaan } = await import("@/server/modules/sinkron/pengaturan");
  const p = pengaturanBawaan();
  p.enkripsi.sandiTersandi = encryptCredentialSecret(sandi);
  await tulisJson(jalurSinkron.pengaturan(), p);
}

// ─── mesin tiruan yang mencatat setiap operasi ──────────────────────────────

function mesinTiruan(o: { ringkas?: (tabel: string[]) => { migrasi: number | null; tabel: Record<string, number | null> }; pulihkanGalat?: boolean; hapusGalat?: boolean } = {}) {
  const operasi: Array<{ op: string; nama: string }> = [];
  const sqlDibaca: string[] = [];
  const mesin: MesinPulih = {
    namaProduksi: PRODUKSI,
    async buatDb(nama) {
      operasi.push({ op: "buat", nama });
    },
    async pulihkan(nama, jalurSql) {
      operasi.push({ op: "pulihkan", nama });
      sqlDibaca.push(readFileSync(jalurSql, "utf8"));
      if (o.pulihkanGalat) throw new Error("psql runtuh");
      return { galat: [] };
    },
    async ringkas(nama, tabel) {
      operasi.push({ op: "ringkas", nama });
      if (o.ringkas) return o.ringkas(tabel);
      const hasil: Record<string, number | null> = {};
      for (const t of tabel) hasil[t] = Number((await db.queryOne<{ n: number }>(`SELECT COUNT(*)::int AS n FROM ${t}`))?.n ?? 0);
      return { migrasi: null, tabel: hasil };
    },
    async hapusDb(nama) {
      operasi.push({ op: "hapus", nama });
      if (o.hapusGalat) throw new Error("tidak boleh menghapus");
    },
  };
  return { mesin, operasi, sqlDibaca };
}

const kerja = () => path.join(akar, "kerja");
const jalan = async (opsi: Partial<import("@/server/modules/keamanan/uji-pulih").OpsiUjiPulih> & { mesin: MesinPulih }) => {
  const { jalankanUjiPulih } = await import("@/server/modules/keamanan/uji-pulih");
  return jalankanUjiPulih(db, { pemicu: "manual", olehNama: "Uji", direktoriKerja: kerja(), kirimWa: async () => undefined, ...opsi });
};

const pernyataan = (sql: string) =>
  sql
    .split(/\r?\n/)
    .map((b) => b.replace(/--.*$/, ""))
    .join("\n")
    .split(";")
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter(Boolean);

// ─── 1. migrasi ─────────────────────────────────────────────────────────────

describe("migrasi 0109", () => {
  it("jurnal tanpa lubang; berkas = DDL_UJI_PULIH; jalan di pg-mem; terdaftar di cadangan; tanpa FK/CHECK", async () => {
    const j = JSON.parse(readFileSync(path.join(process.cwd(), "drizzle/meta/_journal.json"), "utf8")) as { entries: Array<{ idx: number; tag: string; when: number }> };
    expect(j.entries.map((e) => e.idx)).toEqual(j.entries.map((_, i) => i));
    const ini = j.entries.filter((e) => e.tag === "0109_aleta_uji_pulih");
    expect(ini).toHaveLength(1);
    expect(ini[0].when).toBeGreaterThan(j.entries[ini[0].idx - 1].when);
    const { DDL_UJI_PULIH } = await import("@/server/db/schema");
    const { IN_MEMORY_TABLE_PERSISTENCE_ORDER } = await import("@/server/db/client");
    const teks = readFileSync(path.join(process.cwd(), "drizzle/0109_aleta_uji_pulih.sql"), "utf8");
    expect(pernyataan(teks)).toEqual([...DDL_UJI_PULIH.tabel, ...DDL_UJI_PULIH.indeks].map((s) => pernyataan(s)[0]));
    const { newDb } = await import("pg-mem");
    const kosong = newDb();
    kosong.public.none(teks);
    expect(kosong.public.many("SELECT * FROM aleta_uji_pulih")).toEqual([]);
    expect(IN_MEMORY_TABLE_PERSISTENCE_ORDER).toContain("aleta_uji_pulih");
    expect(/REFERENCES|FOREIGN KEY|CHECK\s*\(/i.test(teks.replace(/--.*$/gm, ""))).toBe(false);
  });
});

// ─── 2. sasaran bukan produksi ──────────────────────────────────────────────

describe("sasaran pemulihan SELALU sementara dan bukan produksi", () => {
  it("nama dibangkitkan berpola aleta_ujipulih_<waktu>_<acak> dan berbeda tiap kali", async () => {
    const { namaDbSementara, POLA_DB_SEMENTARA } = await import("@/server/modules/keamanan/uji-pulih");
    const a = namaDbSementara(new Date("2026-10-25T19:00:00Z"));
    expect(a).toMatch(POLA_DB_SEMENTARA);
    expect(a.startsWith("aleta_ujipulih_20261025190000_")).toBe(true);
    expect(namaDbSementara()).not.toBe(namaDbSementara());
  });

  it("penjaga menolak nama produksi, bawaan server, dan apa pun yang bukan pola sementara", async () => {
    const { pastikanSasaranSementara, namaDbDariUrl } = await import("@/server/modules/keamanan/uji-pulih");
    expect(namaDbDariUrl("postgres://u:p@h:5432/aleta")).toBe("aleta");
    for (const buruk of ["aleta", "postgres", "template0", "template1", "", "aleta_ujipulih", "aleta_ujipulih_20261025190000", "aleta_ujipulih_20261025190000_zzzz", "x; DROP DATABASE aleta", "aleta_ujipulih_20261025190000_ab12; DROP DATABASE aleta"]) {
      expect(() => pastikanSasaranSementara(buruk, "aleta"), buruk).toThrow(/dihentikan/);
    }
    // sama dengan produksi -> ditolak walau berpola
    expect(() => pastikanSasaranSementara("aleta_ujipulih_20261025190000_ab12", "ALETA_UJIPULIH_20261025190000_AB12")).toThrow(/sama dengan basis data produksi/);
    expect(() => pastikanSasaranSementara("aleta_ujipulih_20261025190000_ab12", "aleta")).not.toThrow();
  });

  it("mesin sungguhan menolak SETIAP metode atas basis data produksi SEBELUM menyambung ke mana pun", async () => {
    const { mesinPostgres } = await import("@/server/modules/keamanan/uji-pulih");
    // port 1 tidak melayani: bila ada yang mencoba menyambung, galatnya ECONNREFUSED, bukan kalimat penjaga.
    const mesin = mesinPostgres("postgres://aleta:rahasia@127.0.0.1:1/aleta");
    expect(mesin.namaProduksi).toBe("aleta");
    await expect(mesin.buatDb("aleta")).rejects.toThrow(/bukan basis data sementara/);
    await expect(mesin.hapusDb("aleta")).rejects.toThrow(/bukan basis data sementara/);
    await expect(mesin.pulihkan("aleta", "/tidak/ada.sql", 1000)).rejects.toThrow(/bukan basis data sementara/);
    await expect(mesin.ringkas("aleta", ["users"])).rejects.toThrow(/bukan basis data sementara/);
    await expect(mesin.hapusDb("postgres")).rejects.toThrow(/bukan basis data sementara/);
    // produksi yang kebetulan bernama berpola tetap ditolak
    const aneh = mesinPostgres("postgres://aleta:x@127.0.0.1:1/aleta_ujipulih_20261025190000_ab12");
    await expect(aneh.hapusDb("aleta_ujipulih_20261025190000_ab12")).rejects.toThrow(/sama dengan basis data produksi/);
    // nama sementara yang sah lolos penjaga dan baru gagal di jaringan
    await expect(mesin.hapusDb("aleta_ujipulih_20261025190000_ab12")).rejects.not.toThrow(/dihentikan/);
  });

  it("pipeline: setiap operasi mesin memakai SATU nama sementara; nama produksi tidak pernah muncul", async () => {
    await buatBundel("20261025-020000");
    const { mesin, operasi } = mesinTiruan();
    const r = await jalan({ mesin });
    expect(r.status).toBe("berhasil");
    const { POLA_DB_SEMENTARA } = await import("@/server/modules/keamanan/uji-pulih");
    expect(operasi.map((o) => o.op)).toEqual(["buat", "pulihkan", "ringkas", "hapus"]);
    expect(new Set(operasi.map((o) => o.nama)).size).toBe(1);
    for (const o of operasi) {
      expect(o.nama).toMatch(POLA_DB_SEMENTARA);
      expect(o.nama).not.toBe(PRODUKSI);
    }
    expect(r.rincian?.dbSementara).toBe(operasi[0].nama);
  });
});

// ─── 3. SQL berbahaya, tar, jadwal ──────────────────────────────────────────

describe("pemindai SQL", () => {
  const tulis = async (isi: string) => {
    const j = path.join(akar, `p-${Math.random().toString(16).slice(2)}.sql`);
    await writeFile(j, isi);
    return j;
  };
  it("menerima dump wajar - termasuk baris data COPY yang menyerupai perintah", async () => {
    const { pindaiSqlBerbahaya } = await import("@/server/modules/keamanan/uji-pulih");
    expect(await pindaiSqlBerbahaya(await tulis(SQL_BAIK))).toMatchObject({ aman: true });
    expect(await pindaiSqlBerbahaya(await tulis("COPY t (a) FROM stdin;\nDROP DATABASE aleta;\n\\c aleta\n\\.\nSELECT 1;\n"))).toMatchObject({ aman: true });
  });
  it("menolak pindah basis data, shell, buat/hapus/ubah basis data, peran, dan ALTER SYSTEM", async () => {
    const { pindaiSqlBerbahaya } = await import("@/server/modules/keamanan/uji-pulih");
    for (const buruk of ["\\connect aleta", "\\c aleta", "\\! rm -rf /", "\\i /etc/passwd", "CREATE DATABASE x;", "drop database aleta;", "ALTER DATABASE aleta SET x=1;", "DROP ROLE aleta;", "ALTER SYSTEM SET x = 1;"]) {
      const h = await pindaiSqlBerbahaya(await tulis(`SET x = 1;\n${buruk}\nSELECT 1;\n`));
      expect(h.aman, buruk).toBe(false);
      expect(h.temuan).toMatch(/baris 2/);
    }
  });
});

describe("pembongkar tar", () => {
  it("hanya berkas .sql yang ditulis, hanya sebagai nama dasar di folder tujuan (tidak keluar folder)", async () => {
    const tgz = await susunTarGz({ "a/aleta-postgres-1.sql": "SELECT 1;", "a/aleta.dump": "BINER", "a/../../jahat.sql": "SELECT 2;".repeat(100), "BACA-SAYA.txt": "x" });
    const { ekstrakSqlDariTar } = await import("@/server/modules/keamanan/uji-pulih");
    const { createGunzip } = await import("node:zlib");
    const tujuan = path.join(akar, "tujuan-tar");
    const hasil = await ekstrakSqlDariTar(Readable.from([tgz]).pipe(createGunzip()), tujuan);
    expect(hasil.map((j) => path.basename(j)).sort()).toEqual(["aleta-postgres-1.sql", "jahat.sql"]);
    expect(hasil.every((j) => path.dirname(j) === tujuan)).toBe(true);
    expect(await readFile(path.join(tujuan, "aleta-postgres-1.sql"), "utf8")).toBe("SELECT 1;");
    expect((await readdir(tujuan)).sort()).toEqual(["aleta-postgres-1.sql", "jahat.sql"]);
    expect((await readFile(path.join(tujuan, "jahat.sql"), "utf8")).length).toBe("SELECT 2;".length * 100);
  });
});

describe("jadwal mingguan", () => {
  // Minggu 25 Okt 2026, 03:00 WITA = Sabtu 24 Okt 19:00 UTC
  const p = { aktif: true, hari: 0, jam: "03:00", toleransiPersen: 30 };
  it("jatuh tempo hanya pada hari dan jam yang dipilih, sekali per minggu, hanya bila menyala", async () => {
    const { ujiPulihJatuhTempo } = await import("@/server/modules/keamanan/uji-pulih");
    const minggu = (jamUtc: string) => new Date(`2026-10-24T${jamUtc}:00Z`);
    expect(ujiPulihJatuhTempo({ ...p, aktif: false }, undefined, minggu("19:00"))).toBe(false);
    expect(ujiPulihJatuhTempo(p, undefined, minggu("18:59"))).toBe(false); // 02.59 WITA
    expect(ujiPulihJatuhTempo(p, undefined, minggu("19:00"))).toBe(true);
    expect(ujiPulihJatuhTempo(p, undefined, new Date("2026-10-25T04:00:00Z"))).toBe(true); // Minggu 12.00 WITA, belum jalan
    expect(ujiPulihJatuhTempo(p, minggu("19:01").toISOString(), minggu("21:00"))).toBe(false); // sudah jalan minggu ini
    expect(ujiPulihJatuhTempo(p, new Date("2026-10-17T19:01:00Z").toISOString(), minggu("19:00"))).toBe(true); // minggu lalu
    expect(ujiPulihJatuhTempo(p, undefined, new Date("2026-10-25T19:00:00Z"))).toBe(false); // Senin 03.00 WITA
  });
});

// ─── 4. alur penuh ──────────────────────────────────────────────────────────

describe("alur penuh", () => {
  it("berhasil: SQL dari arsip sampai ke mesin, hasil tersimpan, basis data sementara dan folder kerja bersih, laporan 'baik'", async () => {
    await buatBundel("20261025-020000");
    const laporan: Array<{ sumber: string; tingkat: string }> = [];
    const kait = await import("@/server/modules/keamanan/kait");
    kait.daftarkanPenerimaLaporanKesehatan({ nama: "uji", terima: async (_db, l) => void laporan.push({ sumber: l.sumber, tingkat: l.tingkat }) });
    const wa: string[] = [];
    const { mesin, operasi, sqlDibaca } = mesinTiruan();
    const r = await jalan({ mesin, kirimWa: async (m) => void wa.push(m.nomor) });
    expect(r).toMatchObject({ status: "berhasil", tingkat: "baik", bundel: "20261025-020000", dibersihkan: true, pemicu: "manual" });
    expect(sqlDibaca).toEqual([SQL_BAIK]); // yang dipulihkan memang SQL dari arsip
    expect(operasi.map((o) => o.op)).toEqual(["buat", "pulihkan", "ringkas", "hapus"]);
    expect(r.rincian?.berkas).toMatchObject({ sha256Cocok: true, tersandi: false });
    expect(r.rincian?.tabel.length).toBeGreaterThan(0);
    expect(r.rincian?.tabel.every((t) => t.lulus)).toBe(true);
    expect(r.rincian?.langkah.every((l) => l.ok)).toBe(true);
    expect(await readdir(kerja())).toEqual([]);
    const { riwayatUjiPulih } = await import("@/server/modules/keamanan/uji-pulih");
    const [baris] = await riwayatUjiPulih(db, 5);
    expect(baris).toMatchObject({ id: r.id, status: "berhasil", dibersihkan: true });
    expect(laporan).toEqual([{ sumber: "uji-pulih-cadangan", tingkat: "baik" }]);
    expect(wa).toEqual([]); // WhatsApp hanya saat gagal
  });

  it("cadangan tersandi: dibuka dengan kata sandi arsip dari pengaturan; tanpa sandi gagal bersih", async () => {
    await buatBundel("20261025-020000", { sandi: "sandi-arsip-uji" });
    const tanpa = mesinTiruan();
    const gagal = await jalan({ mesin: tanpa.mesin });
    expect(gagal.status).toBe("gagal");
    expect(gagal.pesan).toMatch(/kata sandi arsip tidak terbaca/);
    expect(tanpa.operasi).toEqual([]);
    expect(await readdir(kerja())).toEqual([]);

    await pasangSandiArsip("sandi-arsip-uji");
    const ada = mesinTiruan();
    const baik = await jalan({ mesin: ada.mesin });
    expect(baik).toMatchObject({ status: "berhasil" });
    expect(baik.rincian?.berkas?.tersandi).toBe(true);
    expect(ada.sqlDibaca).toEqual([SQL_BAIK]);

    await pasangSandiArsip("sandi-lain");
    const salah = await jalan({ mesin: mesinTiruan().mesin });
    expect(salah.status).toBe("gagal");
    expect(salah.pesan).toMatch(/Kata sandi salah atau arsip rusak/);
    expect(await readdir(kerja())).toEqual([]);
  });

  it("tanpa cadangan: gagal dengan kalimat yang menunjuk tindakan; bundel belum selesai dan berkas hilang dilewati", async () => {
    const kosong = await jalan({ mesin: mesinTiruan().mesin });
    expect(kosong).toMatchObject({ status: "gagal", tingkat: "gagal" });
    expect(kosong.pesan).toMatch(/Belum ada cadangan ALETA yang selesai/);

    await buatBundel("20261025-020000", { selesai: "" }); // masih berjalan
    await buatBundel("20261024-020000", { tanpaBerkas: true }); // berkas hilang
    expect((await jalan({ mesin: mesinTiruan().mesin })).pesan).toMatch(/Belum ada cadangan/);
    await buatBundel("20261023-020000");
    const r = await jalan({ mesin: mesinTiruan().mesin });
    expect(r).toMatchObject({ status: "berhasil", bundel: "20261023-020000" });
  });

  it("sidik tidak cocok: gagal sebelum apa pun dibuat", async () => {
    await buatBundel("20261025-020000", { rusakSidik: true });
    const { mesin, operasi } = mesinTiruan();
    const r = await jalan({ mesin });
    expect(r).toMatchObject({ status: "gagal" });
    expect(r.pesan).toMatch(/Sidik SHA-256 .* tidak cocok/);
    expect(r.rincian?.berkas?.sha256Cocok).toBe(false);
    expect(operasi).toEqual([]);
  });

  it("SQL berbahaya: ditolak sebelum basis data sementara dibuat", async () => {
    await buatBundel("20261025-020000", { sql: "SET x=1;\n\\connect aleta\nDROP TABLE users;\n" });
    const { mesin, operasi } = mesinTiruan();
    const r = await jalan({ mesin });
    expect(r.status).toBe("gagal");
    expect(r.pesan).toMatch(/menyentuh basis data lain/);
    expect(operasi).toEqual([]);
    expect(await readdir(kerja())).toEqual([]);
  });

  it("arsip tanpa SQL polos (hanya format kustom) gagal dengan penjelasan", async () => {
    await buatBundel("20261025-020000", { isi: { "x/aleta.dump": "PGDMP" } });
    const r = await jalan({ mesin: mesinTiruan().mesin });
    expect(r.status).toBe("gagal");
    expect(r.pesan).toMatch(/tidak memuat berkas SQL polos/);
  });

  it("pemulihan runtuh di tengah: tetap menghapus basis data sementara dan folder kerja", async () => {
    await buatBundel("20261025-020000");
    const { mesin, operasi } = mesinTiruan({ pulihkanGalat: true });
    const r = await jalan({ mesin });
    expect(r).toMatchObject({ status: "gagal", dibersihkan: true });
    expect(r.pesan).toMatch(/psql runtuh/);
    expect(operasi.map((o) => o.op)).toEqual(["buat", "pulihkan", "hapus"]);
    expect(await readdir(kerja())).toEqual([]);
  });

  it("basis data sementara GAGAL dihapus: dicatat sebagai temuan dengan nama untuk dihapus manual", async () => {
    await buatBundel("20261025-020000");
    const { mesin } = mesinTiruan({ hapusGalat: true });
    const r = await jalan({ mesin });
    expect(r).toMatchObject({ status: "gagal", tingkat: "gagal", dibersihkan: false });
    expect(r.pesan).toMatch(/aleta_ujipulih_\d{14}_[0-9a-f]{4} GAGAL dihapus; hapus manual/);
    expect(r.rincian?.langkah.at(-1)).toMatchObject({ nama: "Hapus basis data sementara", ok: false });
  });

  it("perbandingan tabel: dalam toleransi lulus, di luar toleransi gagal, tabel hilang gagal", async () => {
    await buatBundel("20261025-020000");
    const bacaProduksi = async () => ({ migrasi: null, tabel: { users: 100, roles: 10 } });
    const denganPulih = (users: number | null, roles: number | null) =>
      mesinTiruan({ ringkas: () => ({ migrasi: null, tabel: { users, roles } }) }).mesin;

    expect(await jalan({ mesin: denganPulih(100, 10), bacaProduksi })).toMatchObject({ status: "berhasil" });
    expect(await jalan({ mesin: denganPulih(75, 10), bacaProduksi })).toMatchObject({ status: "berhasil" }); // kurang 25% <= 30%
    const lewat = await jalan({ mesin: denganPulih(60, 10), bacaProduksi });
    expect(lewat.status).toBe("gagal");
    expect(lewat.pesan).toMatch(/Tabel tidak cocok: users \(60 dari 100\)/);
    expect(lewat.rincian?.tabel.find((t) => t.nama === "users")).toMatchObject({ selisihPersen: 40, lulus: false });
    const kosongPulih = await jalan({ mesin: denganPulih(100, 0), bacaProduksi });
    expect(kosongPulih.pesan).toMatch(/roles \(0 dari 10\)/);
    const hilang = await jalan({ mesin: denganPulih(null, 10), bacaProduksi });
    expect(hilang.pesan).toMatch(/users \(tidak ada dari 100\)/);
    // lebih banyak dari produksi (baris dihapus sesudah cadangan) tidak dihukum
    expect((await jalan({ mesin: denganPulih(140, 10), bacaProduksi })).status).toBe("berhasil");
  });

  it("migrasi: hasil pulih tidak boleh lebih banyak dari produksi atau kosong; produksi tanpa catatan dilewati", async () => {
    await buatBundel("20261025-020000");
    const prod = (migrasi: number | null) => async () => ({ migrasi, tabel: { users: 10 } });
    const pulih = (migrasi: number | null) => mesinTiruan({ ringkas: () => ({ migrasi, tabel: { users: 10 } }) }).mesin;
    expect((await jalan({ mesin: pulih(88), bacaProduksi: prod(90) })).status).toBe("berhasil");
    expect((await jalan({ mesin: pulih(90), bacaProduksi: prod(90) })).status).toBe("berhasil");
    const lebih = await jalan({ mesin: pulih(95), bacaProduksi: prod(90) });
    expect(lebih.status).toBe("gagal");
    expect(lebih.pesan).toMatch(/Jumlah migrasi hasil pulih \(95\)/);
    expect((await jalan({ mesin: pulih(null), bacaProduksi: prod(90) })).pesan).toMatch(/tidak ada/);
    expect((await jalan({ mesin: pulih(0), bacaProduksi: prod(90) })).status).toBe("gagal");
    expect((await jalan({ mesin: pulih(null), bacaProduksi: prod(null) })).status).toBe("berhasil");
    expect((await jalan({ mesin: pulih(null), bacaProduksi: prod(0) })).status).toBe("berhasil");
  });

  it("cadangan lebih tua dari 48 jam: berhasil tetapi tingkat 'peringatan'", async () => {
    const tua = new Date(Date.now() - 60 * 3_600_000).toISOString();
    await buatBundel("20261022-020000", { selesai: tua });
    const r = await jalan({ mesin: mesinTiruan().mesin });
    expect(r).toMatchObject({ status: "berhasil", tingkat: "peringatan" });
    expect(r.pesan).toMatch(/sudah 60 jam/);
  });

  it("dua uji bersamaan: yang kedua ditolak", async () => {
    await buatBundel("20261025-020000");
    let lepas: () => void = () => undefined;
    const tahan = new Promise<void>((s) => (lepas = s));
    const { mesin } = mesinTiruan();
    const lambat: MesinPulih = { ...mesin, buatDb: async () => void (await tahan) };
    const pertama = jalan({ mesin: lambat });
    await new Promise((s) => setTimeout(s, 200));
    await expect(jalan({ mesin })).rejects.toThrow(/sedang berjalan/);
    lepas();
    expect((await pertama).status).toBe("berhasil");
  });
});

// ─── 5. laporan: kesehatan, WhatsApp, lonceng ───────────────────────────────

describe("laporan hasil gagal", () => {
  it("ke Pusat kesehatan lewat kait (penerima rusak tidak menghentikan yang lain), WhatsApp ke Admin+Super Admin, lonceng", async () => {
    await buatBundel("20261025-020000", { rusakSidik: true });
    const kait = await import("@/server/modules/keamanan/kait");
    const terima: string[] = [];
    kait.daftarkanPenerimaLaporanKesehatan({ nama: "rusak", terima: async () => Promise.reject(new Error("pusat mati")) });
    kait.daftarkanPenerimaLaporanKesehatan({ nama: "pusat", terima: async (_db, l) => void terima.push(`${l.tingkat}|${l.judul}|${l.sumber}`) });
    const wa: Array<{ nomor: string; nama: string; pesan: string }> = [];
    const r = await jalan({ mesin: mesinTiruan().mesin, kirimWa: async (m) => void wa.push(m) });
    expect(r.status).toBe("gagal");
    expect(terima).toEqual(["gagal|Uji pulih cadangan GAGAL|uji-pulih-cadangan"]);
    const penerima = await db.queryAll<{ id: string }>("SELECT id FROM users WHERE deleted_at IS NULL AND is_active = 1 AND role_id IN ('admin','super-admin') AND COALESCE(whatsapp_number,'') <> ''", []);
    expect(wa).toHaveLength(penerima.length);
    expect(penerima.length).toBeGreaterThanOrEqual(2);
    expect(wa[0].pesan).toContain("Uji pulih cadangan GAGAL");
    expect(wa[0].pesan).toContain(r.pesan);
    expect(wa[0].pesan).not.toMatch(/sandi|password|token/i);

    const { pemberitahuanUjiPulih } = await import("@/server/modules/keamanan/uji-pulih");
    const lonceng = await pemberitahuanUjiPulih(db);
    expect(lonceng).toHaveLength(1);
    expect(lonceng[0]).toMatchObject({ id: `uji_pulih_${r.id}`, judul: "Uji pulih cadangan gagal" });
    expect(await pemberitahuanUjiPulih(db, new Date(Date.now() + 8 * 86_400_000))).toEqual([]);
    await buatBundel("20261025-030000");
    await jalan({ mesin: mesinTiruan().mesin }); // sekarang pilih bundel terbaru (030000, sidik baik)
    expect(await pemberitahuanUjiPulih(db)).toEqual([]);
  });

  it("WhatsApp yang gagal dikirim tidak menggagalkan penyimpanan hasil", async () => {
    await buatBundel("20261025-020000", { rusakSidik: true });
    const r = await jalan({ mesin: mesinTiruan().mesin, kirimWa: async () => Promise.reject(new Error("bot mati")) });
    expect(r.status).toBe("gagal");
    const { riwayatUjiPulih } = await import("@/server/modules/keamanan/uji-pulih");
    expect((await riwayatUjiPulih(db, 1))[0].id).toBe(r.id);
  });
});

// ─── 6. detak jadwal ────────────────────────────────────────────────────────

describe("detak penjadwal", () => {
  const minggu0300 = new Date("2026-10-24T19:00:00Z");
  it("saklar MATI (bawaan): tidak berbuat apa pun, tidak ada baris", async () => {
    await buatBundel("20261025-020000");
    const { detakUjiPulih, bacaPengaturanUjiPulih } = await import("@/server/modules/keamanan/uji-pulih");
    expect((await bacaPengaturanUjiPulih(db)).aktif).toBe(false);
    const { mesin, operasi } = mesinTiruan();
    expect(await detakUjiPulih(db, minggu0300, { mesin, direktoriKerja: kerja() })).toBeNull();
    expect(operasi).toEqual([]);
    expect(await db.queryAll("SELECT id FROM aleta_uji_pulih", [])).toEqual([]);
  });

  it("menyala: jalan SEKALI pada slotnya, tidak pada hari lain, tidak berulang pada detak berikutnya", async () => {
    await buatBundel("20261025-020000");
    const { detakUjiPulih, simpanPengaturanUjiPulih } = await import("@/server/modules/keamanan/uji-pulih");
    await simpanPengaturanUjiPulih(db, { aktif: true }, "usr-super");
    const { mesin, operasi } = mesinTiruan();
    const opsi = { mesin, direktoriKerja: kerja(), kirimWa: async () => undefined };
    expect(await detakUjiPulih(db, new Date("2026-10-24T18:59:00Z"), opsi)).toBeNull(); // 02.59 WITA
    expect(await detakUjiPulih(db, new Date("2026-10-23T19:00:00Z"), opsi)).toBeNull(); // Sabtu
    const r = await detakUjiPulih(db, minggu0300, opsi);
    expect(r).toMatchObject({ status: "berhasil", pemicu: "jadwal", oleh: "Jadwal mingguan" });
    expect(operasi.filter((o) => o.op === "buat")).toHaveLength(1);
    expect(await detakUjiPulih(db, new Date("2026-10-24T19:05:00Z"), opsi)).toBeNull();
    expect(await detakUjiPulih(db, new Date("2026-10-25T03:00:00Z"), opsi)).toBeNull(); // Minggu siang, sudah jalan
    expect(await detakUjiPulih(db, new Date("2026-10-31T19:00:00Z"), opsi)).toMatchObject({ pemicu: "jadwal" }); // minggu depan
  });

  it("uji manual tidak menghabiskan slot jadwal; yang sedang berjalan menahan detak", async () => {
    await buatBundel("20261025-020000");
    const { detakUjiPulih, simpanPengaturanUjiPulih } = await import("@/server/modules/keamanan/uji-pulih");
    await simpanPengaturanUjiPulih(db, { aktif: true }, "usr-super");
    const opsi = { mesin: mesinTiruan().mesin, direktoriKerja: kerja(), kirimWa: async () => undefined };
    await jalan({ mesin: mesinTiruan().mesin }); // manual
    expect(await detakUjiPulih(db, minggu0300, opsi)).toMatchObject({ pemicu: "jadwal" });
    await db.run("DELETE FROM aleta_uji_pulih", []);
    await db.run(
      "INSERT INTO aleta_uji_pulih (id, mulai_pada, status, pemicu) VALUES ('tertahan', ?, 'berjalan', 'manual')",
      [new Date(minggu0300.getTime() - 60_000).toISOString()]
    );
    expect(await detakUjiPulih(db, minggu0300, opsi)).toBeNull();
    // berjalan lebih dari 3 jam = terputus, tidak menahan
    await db.run("UPDATE aleta_uji_pulih SET mulai_pada = ? WHERE id = 'tertahan'", [new Date(minggu0300.getTime() - 4 * 3_600_000).toISOString()]);
    expect(await detakUjiPulih(db, minggu0300, opsi)).toMatchObject({ pemicu: "jadwal" });
  });

  it("pewaktu dipasang sekali dan dapat dihentikan", async () => {
    vi.useFakeTimers();
    try {
      const { mulaiUjiPulihBerkala, hentikanUjiPulihBerkala } = await import("@/server/modules/keamanan/uji-pulih");
      const ambil = vi.fn(async () => db);
      mulaiUjiPulihBerkala(ambil, 1000);
      mulaiUjiPulihBerkala(ambil, 1000);
      await vi.advanceTimersByTimeAsync(3100);
      expect(ambil.mock.calls.length).toBe(3);
      hentikanUjiPulihBerkala();
      await vi.advanceTimersByTimeAsync(5000);
      expect(ambil.mock.calls.length).toBe(3);
    } finally {
      vi.useRealTimers();
    }
  });
});

// ─── 7. rute ────────────────────────────────────────────────────────────────

describe("rute /api/admin/keamanan/uji-pulih", () => {
  const minta = (o: { method?: string; aktor?: string; badan?: unknown } = {}) =>
    new NextRequest(`${ASAL}/api/admin/keamanan/uji-pulih`, {
      method: o.method ?? "GET",
      headers: { "content-type": "application/json", "x-forwarded-for": "192.168.10.31", ...(o.aktor ? { "x-aleta-user-id": o.aktor } : {}) },
      ...(o.badan !== undefined ? { body: JSON.stringify(o.badan) } : {}),
    });

  it("Admin membaca (tanpa jalur berkas di server), peran lain 403; hanya Super Admin mengubah dan menjalankan", async () => {
    await buatBundel("20261025-020000");
    const { GET, POST } = await import("@/app/api/admin/keamanan/uji-pulih/route");
    expect((await GET(minta({ aktor: "usr-hakim" }))).status).toBe(403);
    const baca = await GET(minta({ aktor: "usr-admin" }));
    expect(baca.status).toBe(200);
    const d = (await baca.json()).data;
    expect(d.setelan).toEqual({ aktif: false, hari: 0, jam: "03:00", toleransiPersen: 30 });
    expect(d.cadanganTerbaru).toMatchObject({ bundel: "20261025-020000", tersandi: false });
    expect(JSON.stringify(d)).not.toContain(akar);
    expect(d.berjalan).toBe(false);

    expect((await POST(minta({ method: "POST", aktor: "usr-admin", badan: { aksi: "setelan", aktif: true } }))).status).toBe(403);
    expect((await POST(minta({ method: "POST", aktor: "usr-admin", badan: { aksi: "jalankan" } }))).status).toBe(403);
    expect((await POST(minta({ method: "POST", aktor: "usr-super", badan: { aksi: "ngawur" } }))).status).toBe(400);
    expect((await POST(minta({ method: "POST", aktor: "usr-super", badan: { aksi: "setelan", hari: 9 } }))).status).toBe(400);
    expect((await POST(minta({ method: "POST", aktor: "usr-super", badan: { aksi: "setelan", jam: "25:00" } }))).status).toBe(400);
    expect((await POST(minta({ method: "POST", aktor: "usr-super", badan: { aksi: "setelan", toleransiPersen: 95 } }))).status).toBe(400);
    const simpan = await POST(minta({ method: "POST", aktor: "usr-super", badan: { aksi: "setelan", aktif: true, hari: 6, jam: "04:30", toleransiPersen: 10 } }));
    expect(simpan.status).toBe(200);
    expect((await simpan.json()).data.setelan).toEqual({ aktif: true, hari: 6, jam: "04:30", toleransiPersen: 10 });
    const audit = await db.queryAll<{ action: string }>("SELECT action FROM audit_logs WHERE action = 'SECURITY_RESTORE_TEST_SETTINGS_UPDATE'", []);
    expect(audit).toHaveLength(1);
  });

  it("'Jalankan uji sekarang' menjawab 202 segera, berjalan di latar, hasilnya muncul di riwayat; tanpa cadangan gagal bersih", async () => {
    const { POST, GET } = await import("@/app/api/admin/keamanan/uji-pulih/route");
    const { __tungguUjiPulihLatarUntukUji } = await import("@/server/modules/keamanan/uji-pulih");
    const r = await POST(minta({ method: "POST", aktor: "usr-super", badan: { aksi: "jalankan" } }));
    expect(r.status).toBe(202);
    expect((await r.json()).data.dimulai).toBe(true);
    await __tungguUjiPulihLatarUntukUji();
    const d = (await (await GET(minta({ aktor: "usr-super" }))).json()).data;
    expect(d.berjalan).toBe(false);
    expect(d.riwayat[0]).toMatchObject({ status: "gagal", pemicu: "manual", oleh: expect.any(String) });
    expect(d.riwayat[0].pesan).toMatch(/Belum ada cadangan ALETA/);
  });

  it("menolak mulai bila sedang berjalan (409)", async () => {
    await db.run("INSERT INTO aleta_uji_pulih (id, mulai_pada, status, pemicu) VALUES ('sedang', ?, 'berjalan', 'jadwal')", [new Date().toISOString()]);
    const { POST } = await import("@/app/api/admin/keamanan/uji-pulih/route");
    const r = await POST(minta({ method: "POST", aktor: "usr-super", badan: { aksi: "jalankan" } }));
    expect(r.status).toBe(409);
    expect((await r.json()).error.message).toMatch(/sedang berjalan/);
  });
});
