#!/usr/bin/env node
/**
 * ALETA - sinkron laptop (butir 29, 30 September 2026).
 *
 * Laptop MENARIK cadangan basis data terbaru dari server ALETA, memeriksa
 * SHA-256-nya, lalu - bila diatur - memulihkannya ke basis data laptop.
 * Hanya modul bawaan Node (>= 18). Tidak ada pustaka tambahan.
 *
 *   node sinkron-laptop.mjs                      tarik + (opsional) pulihkan
 *   node sinkron-laptop.mjs --uji                periksa konfigurasi & daftar di server, tanpa mengunduh
 *   node sinkron-laptop.mjs --hanya-unduh        tarik saja, tidak memulihkan
 *   node sinkron-laptop.mjs --buka-sandi MASUK KELUAR   buka satu arsip .aleta-enc
 *   node sinkron-laptop.mjs --konfigurasi D:/.../konfigurasi.json
 *
 * ATURAN KERAS: basis data `sipp` di laptop (salinan PA Bungku) TIDAK PERNAH
 * disentuh. Konfigurasi yang menunjuk ke sana ditolak sebelum apa pun
 * dijalankan, dan aliran SQL yang memuat USE/CREATE DATABASE/DROP DATABASE
 * dihentikan di tengah jalan.
 */

import { createDecipheriv, createHash, scryptSync } from "node:crypto";
import { execFile, spawn } from "node:child_process";
import { createReadStream, createWriteStream, existsSync } from "node:fs";
import { mkdir, open, readdir, readFile, rename, rm, stat, writeFile, appendFile } from "node:fs/promises";
import path from "node:path";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";
import { createGunzip } from "node:zlib";

// ─── Bentuk berkas tersandi (SAMA dengan manajemen_surat/src/server/modules/sinkron/sandi-arsip.ts) ──

export const PENANDA_SANDI = Buffer.from("ALETASNK", "ascii");
export const PANJANG_KEPALA = 41;
export const PANJANG_TAG = 16;
export const AKHIRAN_SANDI = ".aleta-enc";

function turunkanKunci(sandi, garam, logN, r, p) {
  if (!sandi) throw new Error("Kata sandi arsip kosong.");
  if (logN < 10 || logN > 20 || r < 1 || r > 32 || p < 1 || p > 16) throw new Error("Parameter kunci arsip tidak wajar.");
  const N = 2 ** logN;
  return scryptSync(sandi, garam, 32, { N, r, p, maxmem: 256 * N * r + 1024 * 1024 });
}

export function bacaKepala(kepala) {
  if (kepala.length < PANJANG_KEPALA || !kepala.subarray(0, 8).equals(PENANDA_SANDI)) {
    throw new Error("Bukan arsip tersandi ALETA (penanda ALETASNK tidak ada).");
  }
  if (kepala[8] !== 1 || kepala[9] !== 1) throw new Error(`Versi arsip tersandi tidak dikenal (${kepala[8]}).`);
  return { logN: kepala[10], r: kepala[11], p: kepala[12], garam: kepala.subarray(13, 29), iv: kepala.subarray(29, 41), kepala: kepala.subarray(0, PANJANG_KEPALA) };
}

export function bukaSandiBuffer(berkas, sandi) {
  const k = bacaKepala(berkas.subarray(0, PANJANG_KEPALA));
  const d = createDecipheriv("aes-256-gcm", turunkanKunci(sandi, k.garam, k.logN, k.r, k.p), k.iv);
  d.setAAD(k.kepala);
  d.setAuthTag(berkas.subarray(berkas.length - PANJANG_TAG));
  try {
    return Buffer.concat([d.update(berkas.subarray(PANJANG_KEPALA, berkas.length - PANJANG_TAG)), d.final()]);
  } catch {
    throw new Error("Kata sandi salah atau arsip rusak (tag GCM tidak cocok).");
  }
}

/** Aliran isi terbuka dari berkas tersandi (tag dibaca dulu dari ujung berkas). */
export async function aliranBukaSandi(jalur, sandi) {
  const info = await stat(jalur);
  if (info.size < PANJANG_KEPALA + PANJANG_TAG) throw new Error("Arsip tersandi terpotong.");
  const h = await open(jalur, "r");
  const kepala = Buffer.alloc(PANJANG_KEPALA);
  const tag = Buffer.alloc(PANJANG_TAG);
  try {
    await h.read(kepala, 0, PANJANG_KEPALA, 0);
    await h.read(tag, 0, PANJANG_TAG, info.size - PANJANG_TAG);
  } finally {
    await h.close();
  }
  const k = bacaKepala(kepala);
  const d = createDecipheriv("aes-256-gcm", turunkanKunci(sandi, k.garam, k.logN, k.r, k.p), k.iv);
  d.setAAD(k.kepala);
  d.setAuthTag(tag);
  const isi = info.size - PANJANG_KEPALA - PANJANG_TAG;
  return { masuk: isi > 0 ? createReadStream(jalur, { start: PANJANG_KEPALA, end: info.size - PANJANG_TAG - 1 }) : null, penyandi: d };
}

export async function bukaSandiBerkas(masuk, keluar, sandi) {
  const { masuk: aliran, penyandi } = await aliranBukaSandi(masuk, sandi);
  try {
    if (aliran) await pipeline(aliran, penyandi, createWriteStream(keluar));
    else await writeFile(keluar, penyandi.final());
  } catch {
    await rm(keluar, { force: true });
    throw new Error("Kata sandi salah atau arsip rusak (tag GCM tidak cocok).");
  }
}

// ─── Konfigurasi & penjaga ───────────────────────────────────────────────────

/** Basis data MySQL yang TIDAK BOLEH disentuh di laptop. */
export const BASIS_DATA_TERLARANG = new Set(["sipp"]);

export function normalkanNamaDb(nama) {
  return String(nama ?? "").trim().replace(/^`+|`+$/g, "").trim();
}

/** Melempar bila tujuan pemulihan MySQL tidak sah - termasuk `sipp`, apa pun besar-kecilnya. */
export function periksaTujuanMysql(nama, sumber = "") {
  const n = normalkanNamaDb(nama);
  if (!n) throw new Error(`Basis data tujuan untuk "${sumber}" kosong.`);
  if (BASIS_DATA_TERLARANG.has(n.toLowerCase())) {
    throw new Error(
      `DITOLAK: basis data tujuan "${n}" untuk "${sumber}" adalah basis data sipp (salinan PA Bungku) yang tidak boleh disentuh. Pakai sipp_donggala.`
    );
  }
  if (!/^[A-Za-z0-9_]{1,64}$/.test(n)) throw new Error(`Nama basis data tujuan "${n}" tidak sah (hanya huruf, angka, garis bawah).`);
  return n;
}

function bukanDriveC(jalur, sebutan) {
  const p = String(jalur || "");
  if (!p || !path.isAbsolute(p)) throw new Error(`${sebutan} harus jalur lengkap, mis. D:/Aplikasi/aleta/sinkron.`);
  if (/^[cC]:/.test(p) || /^\\\\\?\\[cC]:/.test(p)) throw new Error(`${sebutan} tidak boleh di drive C: (${p}). Pakai drive D:.`);
  return p;
}

export const KONFIGURASI_BAWAAN = {
  server: "http://192.168.10.10/aleta",
  cara: "portal",
  token: "",
  tokenBerkas: "",
  ssh: { alias: "aleta", folderArsip: "/var/www/html/aleta-data/reports/sinkron/arsip" },
  folderSimpan: "D:/Aplikasi/aleta/sinkron",
  simpanSalinan: 5,
  sandiDariEnv: "ALETA_SINKRON_SANDI",
  sandiBerkas: "",
  pulihkan: {
    mysql: { mysqlExe: "D:/satker asal/website pa bungku/xampp/mysql/bin/mysql.exe", host: "127.0.0.1", port: 3306, pengguna: "root", sandiDariEnv: "" },
    postgres: { binFolder: "", host: "127.0.0.1", port: 54329, pengguna: "postgres", sandiDariEnv: "PGPASSWORD", tujuhZipExe: "" },
    aleta: { aktif: false, basisData: "aleta" },
    sipp: { aktif: false, basisData: "sipp_donggala" },
    abt: { aktif: false, basisData: "aps_badilag" },
    antrian: { aktif: false, basisData: "sipp_turunan_antrian" },
    aleta_bot: { aktif: false, basisData: "aleta_bot" },
  },
};

/**
 * Menggabungkan konfigurasi dengan bawaan lalu memeriksanya. SELURUH tujuan
 * MySQL diperiksa - juga yang tidak aktif - supaya konfigurasi yang menunjuk
 * `sipp` ditolak sekarang, bukan kelak ketika seseorang menyalakannya.
 */
export function periksaKonfigurasi(mentah) {
  const k = {
    ...KONFIGURASI_BAWAAN,
    ...mentah,
    ssh: { ...KONFIGURASI_BAWAAN.ssh, ...(mentah?.ssh ?? {}) },
    pulihkan: { ...KONFIGURASI_BAWAAN.pulihkan },
  };
  for (const kunci of Object.keys(KONFIGURASI_BAWAAN.pulihkan)) {
    k.pulihkan[kunci] = { ...KONFIGURASI_BAWAAN.pulihkan[kunci], ...(mentah?.pulihkan?.[kunci] ?? {}) };
  }
  if (k.cara !== "portal" && k.cara !== "ssh") throw new Error('cara harus "portal" atau "ssh".');
  bukanDriveC(k.folderSimpan, "folderSimpan");
  if (k.sandiBerkas) bukanDriveC(k.sandiBerkas, "sandiBerkas");
  if (k.tokenBerkas) bukanDriveC(k.tokenBerkas, "tokenBerkas");
  for (const sumber of ["sipp", "abt", "antrian", "aleta_bot"]) {
    k.pulihkan[sumber].basisData = periksaTujuanMysql(k.pulihkan[sumber].basisData, sumber);
  }
  if (!/^[A-Za-z0-9_]{1,63}$/.test(String(k.pulihkan.aleta.basisData))) throw new Error("Nama basis data PostgreSQL tujuan tidak sah.");
  k.simpanSalinan = Math.max(1, Math.min(60, Number(k.simpanSalinan) || 5));
  k.server = String(k.server || "").replace(/\/$/, "");
  return k;
}

/**
 * Penjaga aliran SQL: menghentikan pemulihan bila dump memuat USE, CREATE
 * DATABASE, atau DROP DATABASE - dump ALETA tidak pernah memuatnya, jadi
 * kemunculannya berarti berkas yang salah atau dirusak, dan satu USE `sipp`
 * cukup untuk menimpa basis data yang dilarang.
 */
export class PenjagaSql extends Transform {
  constructor() {
    super();
    this.sisa = "";
  }
  _transform(potong, _e, selesai) {
    const teks = this.sisa + potong.toString("latin1");
    if (/(^|\n)\s*(USE\s|CREATE\s+(DATABASE|SCHEMA)\b|DROP\s+(DATABASE|SCHEMA)\b)/i.test(teks)) {
      return selesai(new Error("DITOLAK: dump memuat USE/CREATE DATABASE/DROP DATABASE - pemulihan dihentikan."));
    }
    this.sisa = teks.slice(-64);
    selesai(null, potong);
  }
}

// ─── Catatan (tanpa rahasia) ─────────────────────────────────────────────────

let berkasCatatan = "";
async function catat(...bagian) {
  const baris = `[${new Date().toISOString()}] ${bagian.join(" ")}`;
  console.log(baris);
  if (berkasCatatan) await appendFile(berkasCatatan, baris + "\n").catch(() => undefined);
}

// ─── Mengambil dari server ───────────────────────────────────────────────────

async function tokenDari(k) {
  if (k.token) return String(k.token).trim();
  if (k.tokenBerkas) return (await readFile(k.tokenBerkas, "utf8")).trim();
  if (process.env.ALETA_SINKRON_TOKEN) return process.env.ALETA_SINKRON_TOKEN.trim();
  throw new Error("Token laptop belum diisi (token, tokenBerkas, atau env ALETA_SINKRON_TOKEN).");
}

async function sandiDari(k) {
  if (k.sandiBerkas) return (await readFile(k.sandiBerkas, "utf8")).replace(/\r?\n$/, "");
  if (k.sandiDariEnv && process.env[k.sandiDariEnv]) return process.env[k.sandiDariEnv];
  return "";
}

function jalankanProgram(program, argumen, pilihan = {}) {
  return new Promise((selesai, gagal) => {
    execFile(program, argumen, { maxBuffer: 64 * 1024 * 1024, windowsHide: true, ...pilihan }, (galat, keluar, galatKeluar) => {
      if (galat) gagal(new Error(`${path.basename(program)}: ${String(galatKeluar || galat.message).slice(0, 400)}`));
      else selesai(keluar);
    });
  });
}

async function daftarBundelServer(k) {
  if (k.cara === "ssh") {
    const keluar = await jalankanProgram("ssh", [k.ssh.alias, `ls -1 ${k.ssh.folderArsip}`]);
    const nama = String(keluar).split(/\r?\n/).filter((n) => /^\d{8}-\d{6}$/.test(n)).sort().reverse();
    const hasil = [];
    for (const n of nama.slice(0, 3)) {
      const m = await jalankanProgram("ssh", [k.ssh.alias, `cat ${k.ssh.folderArsip}/${n}/MANIFEST.json`]).catch(() => "");
      try {
        const j = JSON.parse(m);
        if (j.berkas?.length) hasil.push(j);
      } catch {
        /* bundel sedang ditulis */
      }
    }
    return hasil;
  }
  const token = await tokenDari(k);
  const jawab = await fetch(`${k.server}/api/sinkron/laptop/daftar`, { headers: { Authorization: `Bearer ${token}` } });
  const isi = await jawab.json().catch(() => null);
  if (!jawab.ok || !isi?.ok) throw new Error(`Server menolak: ${isi?.error?.message || `HTTP ${jawab.status}`}`);
  return isi.data.bundel;
}

async function sidikBerkas(jalur) {
  const h = createHash("sha256");
  await pipeline(createReadStream(jalur), h);
  return h.digest("hex");
}

async function unduhBerkas(k, bundel, berkas, tujuan) {
  if (existsSync(tujuan) && (await sidikBerkas(tujuan)) === berkas.sha256) return "sudah ada";
  const bagian = `${tujuan}.bagian`;
  if (k.cara === "ssh") {
    await jalankanProgram("scp", ["-q", `${k.ssh.alias}:${k.ssh.folderArsip}/${bundel}/${berkas.nama}`, bagian]);
  } else {
    const token = await tokenDari(k);
    let mulai = existsSync(bagian) ? (await stat(bagian)).size : 0;
    if (mulai >= berkas.byte) mulai = 0;
    const url = `${k.server}/api/sinkron/laptop/unduh?bundel=${encodeURIComponent(bundel)}&berkas=${encodeURIComponent(berkas.nama)}`;
    const jawab = await fetch(url, { headers: { Authorization: `Bearer ${token}`, ...(mulai ? { Range: `bytes=${mulai}-` } : {}) } });
    if (!(jawab.status === 200 || jawab.status === 206) || !jawab.body) {
      const isi = await jawab.json().catch(() => null);
      throw new Error(`Unduh ${berkas.nama} ditolak: ${isi?.error?.message || `HTTP ${jawab.status}`}`);
    }
    const lanjut = jawab.status === 206;
    const { Readable } = await import("node:stream");
    await pipeline(Readable.fromWeb(jawab.body), createWriteStream(bagian, { flags: lanjut ? "a" : "w" }));
  }
  const sidik = await sidikBerkas(bagian);
  if (sidik !== berkas.sha256) {
    await rm(bagian, { force: true });
    throw new Error(`SHA-256 ${berkas.nama} tidak cocok - berkas dibuang, ulangi sinkron.`);
  }
  await rename(bagian, tujuan);
  return "terunduh";
}

async function pangkasLokal(k) {
  const akar = path.join(k.folderSimpan, "arsip");
  const nama = (await readdir(akar, { withFileTypes: true }).catch(() => []))
    .filter((d) => d.isDirectory() && /^\d{8}-\d{6}$/.test(d.name))
    .map((d) => d.name)
    .sort()
    .reverse();
  for (const n of nama.slice(k.simpanSalinan)) {
    await rm(path.join(akar, n), { recursive: true, force: true });
    await catat("salinan lama dihapus:", n);
  }
}

// ─── Memulihkan ──────────────────────────────────────────────────────────────

async function pulihkanMysql(k, sumber, jalur, tersandi, sandi) {
  const m = k.pulihkan.mysql;
  const db = periksaTujuanMysql(k.pulihkan[sumber].basisData, sumber);
  const umum = [`--host=${m.host}`, `--port=${m.port}`, `--user=${m.pengguna}`, "--default-character-set=utf8mb4", "--max_allowed_packet=512M"];
  const env = { ...process.env };
  if (m.sandiDariEnv && process.env[m.sandiDariEnv]) env.MYSQL_PWD = process.env[m.sandiDariEnv];
  await jalankanProgram(m.mysqlExe, [...umum, "-e", `CREATE DATABASE IF NOT EXISTS \`${db}\``], { env });
  await catat(`memulihkan ${sumber} ke MySQL ${db} ...`);
  const anak = spawn(m.mysqlExe, [...umum, db], { env, windowsHide: true, stdio: ["pipe", "inherit", "pipe"] });
  let galatMysql = "";
  anak.stderr.on("data", (b) => {
    galatMysql = (galatMysql + b.toString()).slice(-2000);
  });
  const selesaiAnak = new Promise((ok) => anak.on("close", ok));
  const tahap = [];
  if (tersandi) {
    const { masuk, penyandi } = await aliranBukaSandi(jalur, sandi);
    tahap.push(masuk, penyandi);
  } else {
    tahap.push(createReadStream(jalur));
  }
  try {
    await pipeline(...tahap, createGunzip(), new PenjagaSql(), anak.stdin);
  } catch (galat) {
    anak.kill();
    throw new Error(`Pemulihan ${sumber} gagal: ${galat.message}`);
  }
  const kode = await selesaiAnak;
  if (kode !== 0) throw new Error(`mysql keluar dengan kode ${kode}: ${galatMysql.trim().slice(-400)}`);
  await catat(`${sumber} dipulihkan ke ${db}.`);
}

async function pulihkanPostgres(k, jalur, tersandi, sandi, kerja) {
  const pg = k.pulihkan.postgres;
  const db = k.pulihkan.aleta.basisData;
  const bin = (nama) => (pg.binFolder ? path.join(pg.binFolder, nama) : nama);
  let arsip = jalur;
  if (tersandi) {
    arsip = path.join(kerja, path.basename(jalur, AKHIRAN_SANDI));
    await bukaSandiBerkas(jalur, arsip, sandi);
  }
  const keluar = path.join(kerja, "aleta-pg");
  await mkdir(keluar, { recursive: true });
  if (arsip.endsWith(".7z")) await jalankanProgram(pg.tujuhZipExe || "7z", ["x", "-y", `-o${keluar}`, arsip]);
  else await jalankanProgram("tar", ["-xf", arsip, "-C", keluar]);
  const semua = [];
  const jelajah = async (d) => {
    for (const e of await readdir(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) await jelajah(p);
      else semua.push(p);
    }
  };
  await jelajah(keluar);
  const env = { ...process.env };
  if (pg.sandiDariEnv && process.env[pg.sandiDariEnv]) env.PGPASSWORD = process.env[pg.sandiDariEnv];
  const umum = ["-h", pg.host, "-p", String(pg.port), "-U", pg.pengguna];
  const kustom = semua.find((p) => p.endsWith(".dump"));
  const polos = semua.find((p) => /aleta-(postgres|portable)-.*\.sql$/.test(p));
  await catat(`memulihkan ALETA ke PostgreSQL ${db} (port ${pg.port}) ...`);
  if (kustom) {
    await jalankanProgram(bin("pg_restore"), [...umum, "-d", db, "--clean", "--if-exists", "--no-owner", "--no-privileges", kustom], { env });
  } else if (polos) {
    await jalankanProgram(bin("psql"), [...umum, "-d", db, "-v", "ON_ERROR_STOP=1", "-f", polos], { env });
  } else {
    throw new Error("Arsip ALETA tidak memuat .dump maupun .sql.");
  }
  await catat(`ALETA dipulihkan ke ${db}.`);
}

// ─── Utama ───────────────────────────────────────────────────────────────────

async function utama(argv) {
  const ambilArg = (nama) => {
    const i = argv.indexOf(nama);
    return i >= 0 ? argv[i + 1] : "";
  };
  if (argv.includes("--buka-sandi")) {
    const i = argv.indexOf("--buka-sandi");
    const [masuk, keluar] = [argv[i + 1], argv[i + 2]];
    if (!masuk || !keluar) throw new Error("Pakai: --buka-sandi <berkas.aleta-enc> <keluaran>");
    bukanDriveC(path.resolve(keluar), "Keluaran");
    const sandi = process.env.ALETA_SINKRON_SANDI || "";
    if (!sandi) throw new Error("Setel kata sandi arsip di env ALETA_SINKRON_SANDI lebih dulu.");
    await bukaSandiBerkas(masuk, keluar, sandi);
    console.log(`Terbuka: ${keluar}`);
    return;
  }

  const jalurKonfigurasi = ambilArg("--konfigurasi") || path.join(path.dirname(fileURLToPath(import.meta.url)), "konfigurasi.json");
  const k = periksaKonfigurasi(JSON.parse(await readFile(jalurKonfigurasi, "utf8")));
  await mkdir(k.folderSimpan, { recursive: true });
  berkasCatatan = path.join(k.folderSimpan, "sinkron-laptop.log");

  const daftar = await daftarBundelServer(k);
  if (!daftar.length) {
    await catat("Server belum punya cadangan.");
    return;
  }
  const terbaru = daftar[0];
  await catat(`Bundel terbaru di server: ${terbaru.bundel} (${terbaru.berkas.length} berkas, ${terbaru.tersandi ? "tersandi" : "TIDAK tersandi"})`);
  if (argv.includes("--uji")) {
    for (const b of terbaru.berkas) await catat(`  ${b.nama} ${(b.byte / 1024 ** 2).toFixed(1)} MB`);
    const aktif = Object.entries(k.pulihkan).filter(([, v]) => v?.aktif).map(([n, v]) => `${n}->${v.basisData}`);
    await catat(`Pemulihan aktif: ${aktif.length ? aktif.join(", ") : "tidak ada"}. Konfigurasi sah.`);
    return;
  }

  const dir = path.join(k.folderSimpan, "arsip", terbaru.bundel);
  await mkdir(dir, { recursive: true });
  for (const b of terbaru.berkas) {
    const hasil = await unduhBerkas(k, terbaru.bundel, b, path.join(dir, b.nama));
    await catat(`${b.nama}: ${hasil}`);
  }
  await writeFile(path.join(dir, "MANIFEST.json"), JSON.stringify(terbaru, null, 2));
  await pangkasLokal(k);

  if (argv.includes("--hanya-unduh")) return;
  const perlu = terbaru.berkas.filter((b) => k.pulihkan[b.sumber]?.aktif);
  if (!perlu.length) return;
  const sandi = await sandiDari(k);
  if (terbaru.tersandi && !sandi) throw new Error(`Arsip tersandi: setel kata sandi di env ${k.sandiDariEnv} atau sandiBerkas.`);
  const kerja = path.join(k.folderSimpan, "sementara");
  await rm(kerja, { recursive: true, force: true });
  await mkdir(kerja, { recursive: true });
  let gagal = 0;
  try {
    for (const b of perlu) {
      try {
        const jalur = path.join(dir, b.nama);
        if (b.sumber === "aleta") await pulihkanPostgres(k, jalur, b.tersandi, sandi, kerja);
        else await pulihkanMysql(k, b.sumber, jalur, b.tersandi, sandi);
      } catch (galat) {
        gagal += 1;
        await catat(`ERROR ${b.sumber}: ${galat.message}`);
      }
    }
  } finally {
    // Isi terbuka (tidak tersandi) tidak dibiarkan tergeletak di laptop.
    await rm(kerja, { recursive: true, force: true });
  }
  if (gagal) throw new Error(`${gagal} pemulihan gagal - lihat ${berkasCatatan}.`);
}

const dijalankanLangsung = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (dijalankanLangsung) {
  utama(process.argv.slice(2)).catch(async (galat) => {
    await catat("GAGAL:", galat.message);
    process.exitCode = 1;
  });
}
