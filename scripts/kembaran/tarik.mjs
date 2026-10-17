#!/usr/bin/env node
/**
 * ALETA - TARIK DATA SERVER KE LAPTOP (kembaran, 19 Okt 2026).
 *
 * Mengambil cadangan terbaru SIPP, ABT, antrian, ALETA Bot (MySQL), dan ALETA
 * (PostgreSQL portal) dari server kantor lewat `ssh aleta`, lalu memulihkannya
 * ke basis data laptop. Pekerjaan berat dilakukan alat yang SUDAH ADA di repo:
 * tools/sinkron-laptop/sinkron-laptop.mjs (pemeriksaan SHA-256, buka sandi
 * AES-256-GCM, pemulihan mysql/pg_restore, dan PENOLAKAN basis data `sipp`
 * salinan PA Bungku). Skrip ini menambahkan yang khas kembaran:
 *
 *   1. konfigurasi kembaran -> konfigurasi sinkron-laptop (cara ssh, semua pemulihan menyala);
 *   2. penjagaan: ANTREAN TULIS yang belum selesai (menunggu / disetujui) mencegah
 *      penarikan - memulihkan dari server menimpa SIPP/ABT laptop, jadi tulisan
 *      yang belum dikirim akan hilang dari pandangan. Cadangan antrean (mysqldump)
 *      selalu dibuat sebelum memulihkan;
 *   3. bot dan portal harus sudah dimatikan (basis datanya sedang dipulihkan);
 *   4. cap tarik (D:/Aplikasi/aleta/kembaran/tarik.json) ditulis sesudah berhasil -
 *      itulah yang dibaca pita "Mode kembaran - data per <waktu>".
 *
 *   node scripts/kembaran/tarik.mjs --rencana     tampilkan konfigurasi & langkah, tanpa menyentuh apa pun
 *   node scripts/kembaran/tarik.mjs --uji         periksa server (ssh) tanpa mengunduh
 *   node scripts/kembaran/tarik.mjs               tarik dan pulihkan
 *   node scripts/kembaran/tarik.mjs --hanya-unduh tarik saja, tidak memulihkan, tidak menulis cap
 *   --konfigurasi D:/.../konfigurasi.json   --abaikan-antrean   --bot-masih-hidup
 *
 * JANGAN dijalankan saat server mati: tidak ada yang bisa ditarik. Tidak pernah
 * menyentuh WhatsApp; tidak pernah menulis ke server.
 */

import { spawn, execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const AKAR_REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const ALAT = path.join(AKAR_REPO, "tools", "sinkron-laptop", "sinkron-laptop.mjs");

export const KONFIGURASI_KEMBARAN_BAWAAN = {
  folderKembaran: "D:/Aplikasi/aleta/kembaran",
  folderSimpan: "D:/Aplikasi/aleta/sinkron",
  simpanSalinan: 3,
  ssh: { alias: "aleta", folderArsip: "/var/www/html/aleta-data/reports/sinkron/arsip" },
  sandiDariEnv: "ALETA_SINKRON_SANDI",
  sandiBerkas: "",
  mysql: { mysqlExe: "D:/satker asal/website pa bungku/xampp/mysql/bin/mysql.exe", mysqldumpExe: "", host: "127.0.0.1", port: 3306, pengguna: "root", sandiDariEnv: "" },
  postgres: { binFolder: "", host: "127.0.0.1", port: 54329, pengguna: "postgres", sandiDariEnv: "PGPASSWORD", tujuhZipExe: "" },
  tujuan: { aleta: "aleta", sipp: "sipp_donggala", abt: "aps_badilag", antrian: "sipp_turunan_antrian", aleta_bot: "aleta_bot" },
  antrean: { basisData: "aleta_kembaran" },
  portBot: 3003,
  portPortal: 3000,
};

function gabung(dasar, atas) {
  const hasil = { ...dasar };
  for (const [k, v] of Object.entries(atas || {})) {
    hasil[k] = v && typeof v === "object" && !Array.isArray(v) && dasar[k] && typeof dasar[k] === "object" ? { ...dasar[k], ...v } : v;
  }
  return hasil;
}

/** Konfigurasi kembaran (sebagian) + bawaan. Menolak drive C: dan nama basis data yang tidak sah. */
export function periksaKonfigurasiKembaran(mentah = {}) {
  const k = gabung(KONFIGURASI_KEMBARAN_BAWAAN, mentah);
  for (const [nama, jalur] of [["folderKembaran", k.folderKembaran], ["folderSimpan", k.folderSimpan]]) {
    if (!path.isAbsolute(String(jalur)) || /^[cC]:/.test(String(jalur))) throw new Error(`${nama} harus jalur lengkap di drive D: (bukan C:), mis. D:/Aplikasi/aleta/kembaran.`);
  }
  if (!/^[A-Za-z0-9_]{1,64}$/.test(String(k.antrean.basisData))) throw new Error("Nama basis data antrean tidak sah.");
  for (const [sumber, nama] of Object.entries(k.tujuan)) {
    if (!/^[A-Za-z0-9_]{1,64}$/.test(String(nama))) throw new Error(`Nama basis data tujuan "${sumber}" tidak sah.`);
    if (String(nama).toLowerCase() === "sipp") {
      throw new Error(`DITOLAK: tujuan "${sumber}" bernama "sipp" - itu salinan PA Bungku yang tidak boleh disentuh. Pakai sipp_donggala.`);
    }
  }
  if (String(k.tujuan.aleta_bot).toLowerCase() === String(k.antrean.basisData).toLowerCase()) {
    throw new Error("Basis data antrean tidak boleh sama dengan aleta_bot: pemulihan akan menimpanya.");
  }
  return k;
}

/** Konfigurasi untuk tools/sinkron-laptop: cara ssh, semua pemulihan menyala (kecuali bila --hanya-unduh). */
export function susunKonfigurasiSinkron(k, { pulihkan = true } = {}) {
  return {
    server: "http://192.168.10.10/aleta",
    cara: "ssh",
    token: "",
    tokenBerkas: "",
    ssh: k.ssh,
    folderSimpan: k.folderSimpan,
    simpanSalinan: k.simpanSalinan,
    sandiDariEnv: k.sandiDariEnv,
    sandiBerkas: k.sandiBerkas,
    pulihkan: {
      mysql: { mysqlExe: k.mysql.mysqlExe, host: k.mysql.host, port: k.mysql.port, pengguna: k.mysql.pengguna, sandiDariEnv: k.mysql.sandiDariEnv },
      postgres: { ...k.postgres },
      aleta: { aktif: pulihkan, basisData: k.tujuan.aleta },
      sipp: { aktif: pulihkan, basisData: k.tujuan.sipp },
      abt: { aktif: pulihkan, basisData: k.tujuan.abt },
      antrian: { aktif: pulihkan, basisData: k.tujuan.antrian },
      aleta_bot: { aktif: pulihkan, basisData: k.tujuan.aleta_bot },
    },
  };
}

function jalankanProgram(exe, args, { env = process.env, masukan = null } = {}) {
  return new Promise((ok, no) => {
    const anak = execFile(exe, args, { env, windowsHide: true, maxBuffer: 1 << 24 }, (g, out, err) => (g ? no(new Error(String(err || g.message).trim().slice(-300))) : ok(String(out))));
    if (masukan !== null && anak.stdin) anak.stdin.end(masukan);
  });
}

function lingkunganMysql(k) {
  const env = { ...process.env };
  if (k.mysql.sandiDariEnv && process.env[k.mysql.sandiDariEnv]) env.MYSQL_PWD = process.env[k.mysql.sandiDariEnv];
  return env;
}

function argMysql(k) {
  return [`--host=${k.mysql.host}`, `--port=${k.mysql.port}`, `--user=${k.mysql.pengguna}`, "--default-character-set=utf8mb4"];
}

/** Jumlah baris antrean yang BELUM selesai (bukan terkirim/ditolak). 0 bila basis data/tabelnya belum ada. */
export async function hitungAntreanBelumSelesai(k) {
  const db = k.antrean.basisData;
  try {
    const keluar = await jalankanProgram(
      k.mysql.mysqlExe,
      [...argMysql(k), "-N", "-B", "-e", `SELECT COUNT(*) FROM \`${db}\`.kembaran_tulis WHERE status IN ('menunggu','disetujui','gagal')`],
      { env: lingkunganMysql(k) }
    );
    return Number(String(keluar).trim()) || 0;
  } catch (g) {
    if (/Unknown database|doesn't exist/i.test(String(g.message))) return 0;
    throw new Error(`Antrean tidak dapat diperiksa (${g.message}). Penarikan dibatalkan demi keamanan.`);
  }
}

/** Cadangan antrean (mysqldump) ke folderKembaran/cadangan-antrean. Mengembalikan jalurnya, atau "" bila belum ada basis datanya. */
export async function cadangkanAntrean(k, saat = new Date()) {
  const dump = k.mysql.mysqldumpExe || path.join(path.dirname(k.mysql.mysqlExe), "mysqldump.exe");
  const db = k.antrean.basisData;
  try {
    await jalankanProgram(k.mysql.mysqlExe, [...argMysql(k), "-N", "-B", "-e", `SELECT 1 FROM \`${db}\`.kembaran_tulis LIMIT 1`], { env: lingkunganMysql(k) });
  } catch {
    return "";
  }
  const folder = path.join(k.folderKembaran, "cadangan-antrean");
  await mkdir(folder, { recursive: true });
  const berkas = path.join(folder, `${db}-${saat.toISOString().replace(/[:.]/g, "-")}.sql`);
  const isi = await jalankanProgram(dump, [...argMysql(k), "--single-transaction", "--max_allowed_packet=512M", db], { env: lingkunganMysql(k) });
  await writeFile(berkas, isi, "utf8");
  return berkas;
}

/** true bila ada yang mendengarkan di port itu (bot/portal masih hidup). */
export function portTerpakai(port, host = "127.0.0.1", batasMs = 800) {
  return new Promise((ok) => {
    const s = net.connect({ port, host });
    const selesai = (v) => {
      s.destroy();
      ok(v);
    };
    s.setTimeout(batasMs, () => selesai(false));
    s.on("connect", () => selesai(true));
    s.on("error", () => selesai(false));
  });
}

/** Manifest bundel terbaru di folder simpan -> cap tarik. */
export async function susunCapTarik(k, saat = new Date()) {
  const arsip = path.join(k.folderSimpan, "arsip");
  let nama = [];
  try {
    nama = (await readdir(arsip, { withFileTypes: true })).filter((d) => d.isDirectory() && /^\d{8}-\d{6}$/.test(d.name)).map((d) => d.name).sort();
  } catch {
    nama = [];
  }
  const terbaru = nama[nama.length - 1];
  if (!terbaru) throw new Error("Tidak ada bundel hasil tarikan di folder simpan.");
  const manifest = JSON.parse(await readFile(path.join(arsip, terbaru, "MANIFEST.json"), "utf8"));
  return {
    tarikPada: saat.toISOString(),
    bundel: terbaru,
    bundelDibuat: manifest.dibuat || manifest.selesai || null,
    versiAplikasi: manifest.versiAplikasi || null,
    sumber: (manifest.berkas || []).map((b) => b.sumber),
  };
}

function jalankanAlat(jalurKonfigurasi, tambahan) {
  return new Promise((ok) => {
    const anak = spawn(process.execPath, [ALAT, "--konfigurasi", jalurKonfigurasi, ...tambahan], { stdio: "inherit", windowsHide: true });
    anak.on("close", (kode) => ok(kode ?? 1));
  });
}

async function utama(argv) {
  const ambil = (nama) => {
    const i = argv.indexOf(nama);
    return i >= 0 ? argv[i + 1] : "";
  };
  const jalurKonf = ambil("--konfigurasi") || "D:/Aplikasi/aleta/kembaran/konfigurasi.json";
  const mentah = existsSync(jalurKonf) ? JSON.parse(await readFile(jalurKonf, "utf8")) : {};
  const k = periksaKonfigurasiKembaran(mentah);
  const hanyaUnduh = argv.includes("--hanya-unduh");
  const sinkron = susunKonfigurasiSinkron(k, { pulihkan: !hanyaUnduh });

  if (argv.includes("--rencana")) {
    const aktif = Object.entries(sinkron.pulihkan).filter(([, v]) => v && v.aktif).map(([n, v]) => `${n} -> ${v.basisData}`);
    console.log(`Konfigurasi: ${existsSync(jalurKonf) ? jalurKonf : "(tidak ada, memakai bawaan)"}`);
    console.log(`Server: ssh ${k.ssh.alias}:${k.ssh.folderArsip}`);
    console.log(`Disimpan di: ${k.folderSimpan} (simpan ${k.simpanSalinan} bundel)`);
    console.log(`Dipulihkan ke laptop: ${aktif.length ? aktif.join(", ") : "tidak ada (hanya unduh)"}`);
    console.log(`Antrean tulis (${k.antrean.basisData}) TIDAK ikut dipulihkan; dicadangkan lebih dulu ke ${path.join(k.folderKembaran, "cadangan-antrean")}.`);
    console.log("Syarat: bot dan portal mati; antrean tulis tidak menyimpan baris menunggu/disetujui/gagal (kecuali --abaikan-antrean).");
    return 0;
  }

  await mkdir(k.folderKembaran, { recursive: true });
  const jalurSinkron = path.join(k.folderKembaran, "sinkron-laptop.dibuat.json");

  if (argv.includes("--uji")) {
    await writeFile(jalurSinkron, JSON.stringify(sinkron, null, 2), "utf8");
    return jalankanAlat(jalurSinkron, ["--uji"]);
  }

  if (!hanyaUnduh) {
    if (!argv.includes("--bot-masih-hidup")) {
      const hidup = [];
      if (await portTerpakai(k.portBot)) hidup.push(`bot (port ${k.portBot})`);
      if (await portTerpakai(k.portPortal)) hidup.push(`portal (port ${k.portPortal})`);
      if (hidup.length) {
        console.error(`DIBATALKAN: ${hidup.join(" dan ")} masih hidup. Matikan dulu - basis datanya akan ditimpa dari server.`);
        return 2;
      }
    }
    const belum = await hitungAntreanBelumSelesai(k);
    if (belum > 0 && !argv.includes("--abaikan-antrean")) {
      console.error(
        `DIBATALKAN: ada ${belum} tulisan di antrean sinkron yang belum selesai (menunggu / disetujui / gagal). ` +
          "Memulihkan dari server menimpa SIPP dan ABT laptop. Buka Admin > Sinkron kembaran: periksa, setujui, dan kirim - atau singkirkan - lebih dulu."
      );
      return 3;
    }
    const cadangan = await cadangkanAntrean(k);
    if (cadangan) console.log(`Cadangan antrean: ${cadangan}`);
  }

  await writeFile(jalurSinkron, JSON.stringify(sinkron, null, 2), "utf8");
  const kode = await jalankanAlat(jalurSinkron, hanyaUnduh ? ["--hanya-unduh"] : []);
  if (kode !== 0) {
    console.error(`Penarikan gagal (kode ${kode}). Cap tarik TIDAK diperbarui.`);
    return kode;
  }
  if (hanyaUnduh) {
    console.log("Selesai mengunduh. Tidak dipulihkan dan cap tarik tidak diperbarui.");
    return 0;
  }
  const cap = await susunCapTarik(k);
  await writeFile(path.join(k.folderKembaran, "tarik.json"), JSON.stringify(cap, null, 2), "utf8");
  console.log(`Cap tarik ditulis: data per ${cap.bundelDibuat || cap.tarikPada} (bundel ${cap.bundel}).`);
  return 0;
}

const dijalankanLangsung = process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
if (dijalankanLangsung) {
  utama(process.argv.slice(2)).then(
    (kode) => {
      process.exitCode = typeof kode === "number" ? kode : 0;
    },
    (galat) => {
      console.error("GAGAL:", galat.message);
      process.exitCode = 1;
    }
  );
}
