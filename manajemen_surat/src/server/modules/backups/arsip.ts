import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { gunzipSync, gzipSync } from "node:zlib";

import { APP_VERSION } from "@/lib/patch-notes";
import { getDatabaseRuntimeStatus, getDatabaseUrl, type AletaDatabase } from "@/server/db/client";
import { createDatabaseBackup, listApplicationBackupFiles } from "@/server/modules/backups/service";
import { ApiError } from "@/server/shared/errors";

/**
 * Tiga unduhan dari Update Manager: seluruh aplikasi, paket pembaruan, dan
 * seluruh basis data - masing-masing dimampatkan sekuat alat yang ada.
 *
 * ============================================================================
 * RAR TIDAK DAPAT DIJANJIKAN, DAN INI SEBABNYA DISEBUT TERANG-TERANGAN
 * ============================================================================
 *
 * Format RAR hanya dapat dibuat oleh program `rar` milik RARLAB - berbayar,
 * tertutup, dan tidak tersedia di citra Docker mana pun secara bawaan. Yang
 * dapat dijanjikan adalah PEMAMPATAN SEKUAT RAR TANPA KEHILANGAN APA PUN:
 * 7-Zip dengan LZMA2 tingkat 9 memampatkan sama kuat atau lebih kuat daripada
 * RAR, bebas dipakai, dan berkasnya dibuka WinRAR maupun 7-Zip di Windows.
 *
 * Karena itu alatnya dipilih saat berjalan, dari yang paling kuat:
 *
 *   rar   ->  .rar       hanya bila programnya terpasang di peladen
 *   7z    ->  .7z        LZMA2 tingkat 9, blok padat
 *   xz    ->  .tar.xz    LZMA2 tingkat 9e
 *   (tidak ada) -> .tar.gz  gzip tingkat 9 dari Node sendiri
 *
 * Layar menyebut format mana yang benar-benar dihasilkan. Menamai berkas
 * .rar padahal isinya bukan RAR adalah kebohongan yang baru ketahuan ketika
 * orang lain gagal membukanya.
 *
 * ============================================================================
 * TIDAK MENGURANGI APA PUN
 * ============================================================================
 *
 * Seluruh aplikasi berarti seluruh berkas sumber yang dilacak - kode, skrip,
 * migrasi, dokumen - persis daftar yang dipakai cadangan aplikasi selama ini.
 * Yang dikecualikan hanya yang DIBANGUN ULANG dari sumber itu (node_modules,
 * .next) dan yang bukan aplikasi (unggahan pengguna, basis data). Menyertakan
 * node_modules menggandakan ukuran sepuluh kali tanpa menambah satu pun
 * berkas yang tidak dapat dipulihkan dengan `npm ci` dari lockfile yang ikut.
 *
 * Seluruh basis data berarti dua bentuk sekaligus: SQL polos yang dapat
 * dibaca dan dijalankan di mana pun, dan format kustom pg_dump yang dipulihkan
 * pg_restore secara selektif. Keduanya dari pg_dump; bila pg_dump tidak ada,
 * SQL polos disusun ALETA sendiri dan itu disebut pada berkas BACA-SAYA.
 */
export type JenisArsip = "aplikasi" | "pembaruan" | "database";

export type AlatArsip = { rar: boolean; "7z": boolean; xz: boolean; pg_dump: boolean };

export type FormatArsip = "rar" | "7z" | "tar.xz" | "tar.gz";

export type HasilArsip = {
  jenis: JenisArsip;
  namaBerkas: string;
  jalur: string;
  direktoriSementara: string;
  byteLength: number;
  sha256: string;
  format: FormatArsip;
  mimeType: string;
  catatan: string[];
};

/** Daftar isi paket pembaruan - SAMA dengan scripts/aleta-make-update.sh. */
export const ISI_PAKET_PEMBARUAN = [
  "scripts",
  "docs",
  "manajemen_surat/src",
  "manajemen_surat/drizzle",
  "manajemen_surat/public",
  "manajemen_surat/scripts",
  "aleta_bot/services",
  "aleta_bot/routes",
  "aleta_bot/config",
  "aleta_bot/utils",
  "aleta_bot/tools",
  "aleta_bot/scripts",
  "aleta_bot/app.js",
  "aleta_bot/absen.js",
  "aleta_bot/detail.js",
  "aleta_bot/pengumuman.js",
  "aleta_bot/query.js",
  "aleta_bot/notifikasi.js",
  "aleta_bot/db_config.js",
  "aleta_bot/package.json",
  "aleta_bot/package-lock.json",
  "aleta_bot/Dockerfile",
  "aleta_bot/.env.example",
  "manajemen_surat/package.json",
  "manajemen_surat/package-lock.json",
  "manajemen_surat/next.config.ts",
  "manajemen_surat/tsconfig.json",
  "manajemen_surat/tailwind.config.ts",
  "manajemen_surat/postcss.config.js",
  "manajemen_surat/drizzle.config.ts",
  "manajemen_surat/eslint.config.mjs",
  "manajemen_surat/.env.example",
];

// ─── Alat ────────────────────────────────────────────────────────────────────

function adaProgram(nama: string, argumen: string[] = ["--help"]): Promise<boolean> {
  return new Promise((selesai) => {
    let anak;
    try {
      anak = spawn(nama, argumen, { windowsHide: true, stdio: ["ignore", "ignore", "ignore"] });
    } catch {
      selesai(false);
      return;
    }
    const timer = setTimeout(() => {
      anak.kill();
      selesai(false);
    }, 4000);
    anak.on("error", () => {
      clearTimeout(timer);
      selesai(false);
    });
    anak.on("exit", (kode) => {
      clearTimeout(timer);
      // rar dan 7z menjawab bantuan dengan kode 0; xz juga. Kode lain berarti
      // programnya ada tetapi menolak - tetap dianggap ada.
      selesai(kode !== null);
    });
  });
}

let singgahanAlat: { pada: number; alat: AlatArsip } | null = null;

/** Alat yang terpasang, diperiksa paling cepat sekali per lima menit. */
export async function periksaAlat(): Promise<AlatArsip> {
  if (singgahanAlat && Date.now() - singgahanAlat.pada < 5 * 60 * 1000) return singgahanAlat.alat;
  const [rar, tujuh, xz, pgDump] = await Promise.all([
    adaProgram("rar", ["-?"]),
    adaProgram("7z", ["i"]),
    adaProgram("xz", ["--version"]),
    adaProgram("pg_dump", ["--version"]),
  ]);
  const alat = { rar, "7z": tujuh, xz, pg_dump: pgDump };
  singgahanAlat = { pada: Date.now(), alat };
  return alat;
}

/** Format terkuat yang dapat dihasilkan dengan alat yang ada. Murni, diuji. */
export function pilihFormat(alat: Partial<AlatArsip>): FormatArsip {
  if (alat.rar) return "rar";
  if (alat["7z"]) return "7z";
  if (alat.xz) return "tar.xz";
  return "tar.gz";
}

export function mimeUntukFormat(format: FormatArsip) {
  switch (format) {
    case "rar":
      return "application/vnd.rar";
    case "7z":
      return "application/x-7z-compressed";
    case "tar.xz":
      return "application/x-xz";
    default:
      return "application/gzip";
  }
}

// ─── Tar ─────────────────────────────────────────────────────────────────────

function kepalaTar(namaRelatif: string, ukuran: number, mtimeMs: number): Buffer | null {
  const nama = namaRelatif.replace(/\\/g, "/");
  const kepala = Buffer.alloc(512, 0);
  let awalan = "";
  let namaBerkas = nama;
  if (Buffer.byteLength(namaBerkas) > 100) {
    const potong = nama.lastIndexOf("/", 154);
    if (potong <= 0) return null;
    awalan = nama.slice(0, potong);
    namaBerkas = nama.slice(potong + 1);
    if (Buffer.byteLength(namaBerkas) > 100 || Buffer.byteLength(awalan) > 155) return null;
  }
  kepala.write(namaBerkas, 0, 100, "utf8");
  kepala.write("0000644\0", 100, 8, "utf8");
  kepala.write("0000000\0", 108, 8, "utf8");
  kepala.write("0000000\0", 116, 8, "utf8");
  kepala.write(`${ukuran.toString(8).padStart(11, "0")}\0`, 124, 12, "utf8");
  kepala.write(`${Math.floor(mtimeMs / 1000).toString(8).padStart(11, "0")}\0`, 136, 12, "utf8");
  kepala.write("        ", 148, 8, "utf8");
  kepala.write("0", 156, 1, "utf8");
  kepala.write("ustar\0", 257, 6, "utf8");
  kepala.write("00", 263, 2, "utf8");
  if (awalan) kepala.write(awalan, 345, 155, "utf8");
  let jumlah = 0;
  for (const b of kepala) jumlah += b;
  kepala.write(`${jumlah.toString(8).padStart(6, "0")}\0 `, 148, 8, "utf8");
  return kepala;
}

/** Tar (ustar) polos dari daftar berkas relatif - tanpa pemampatan. */
export async function susunTar(rootDir: string, daftar: string[]): Promise<{ tar: Buffer; jumlah: number }> {
  const potongan: Buffer[] = [];
  let jumlah = 0;
  for (const relatif of daftar) {
    const penuh = path.join(rootDir, relatif);
    const info = await stat(penuh);
    if (!info.isFile()) continue;
    const kepala = kepalaTar(relatif, info.size, info.mtimeMs);
    if (!kepala) continue;
    const isi = await readFile(penuh);
    const sisa = (512 - (isi.length % 512)) % 512;
    potongan.push(kepala, isi);
    if (sisa) potongan.push(Buffer.alloc(sisa, 0));
    jumlah += 1;
  }
  potongan.push(Buffer.alloc(1024, 0));
  return { tar: Buffer.concat(potongan), jumlah };
}

// ─── Pemampatan ──────────────────────────────────────────────────────────────

function jalankan(program: string, argumen: string[], opsi: { cwd?: string; masukan?: Buffer }): Promise<Buffer> {
  return new Promise((selesai, gagal) => {
    const anak = spawn(program, argumen, { cwd: opsi.cwd, windowsHide: true });
    const keluar: Buffer[] = [];
    const galat: Buffer[] = [];
    anak.stdout.on("data", (b: Buffer) => keluar.push(b));
    anak.stderr.on("data", (b: Buffer) => galat.push(b));
    anak.on("error", gagal);
    anak.on("close", (kode) => {
      if (kode === 0) selesai(Buffer.concat(keluar));
      else gagal(new Error(Buffer.concat(galat).toString("utf8") || `${program} keluar dengan kode ${kode}`));
    });
    if (opsi.masukan) anak.stdin.end(opsi.masukan);
    else anak.stdin.end();
  });
}

/**
 * Memampatkan sebuah DIREKTORI berisi apa yang hendak dikirim.
 *
 * rar dan 7z bekerja atas direktori (supaya nama dan tanggalnya utuh); xz dan
 * gzip bekerja atas tar yang disusun sendiri dari daftar berkas direktori itu.
 */
async function mampatkanDirektori(
  direktori: string,
  namaDasar: string,
  format: FormatArsip,
  direktoriKeluar: string
): Promise<{ jalur: string; namaBerkas: string }> {
  const daftar = await daftarBerkasRelatif(direktori);

  if (format === "rar") {
    const namaBerkas = `${namaDasar}.rar`;
    const jalur = path.join(direktoriKeluar, namaBerkas);
    // -m5 pemampatan terkuat, -s arsip padat, -r rekursif, -ep1 buang awalan jalur.
    await jalankan("rar", ["a", "-m5", "-s", "-r", "-ep1", "-idq", jalur, `${direktori}${path.sep}*`], {});
    return { jalur, namaBerkas };
  }

  if (format === "7z") {
    const namaBerkas = `${namaDasar}.7z`;
    const jalur = path.join(direktoriKeluar, namaBerkas);
    await jalankan("7z", ["a", "-t7z", "-mx=9", "-m0=lzma2", "-ms=on", "-bd", "-y", jalur, "."], {
      cwd: direktori,
    });
    return { jalur, namaBerkas };
  }

  const { tar } = await susunTar(direktori, daftar);
  if (format === "tar.xz") {
    const namaBerkas = `${namaDasar}.tar.xz`;
    const jalur = path.join(direktoriKeluar, namaBerkas);
    const hasil = await jalankan("xz", ["-9e", "-T0", "-c"], { masukan: tar });
    await writeFile(jalur, hasil);
    return { jalur, namaBerkas };
  }

  const namaBerkas = `${namaDasar}.tar.gz`;
  const jalur = path.join(direktoriKeluar, namaBerkas);
  await writeFile(jalur, gzipSync(tar, { level: 9 }));
  return { jalur, namaBerkas };
}

async function daftarBerkasRelatif(akar: string, sekarang = akar): Promise<string[]> {
  const hasil: string[] = [];
  for (const entri of await readdir(sekarang, { withFileTypes: true })) {
    const penuh = path.join(sekarang, entri.name);
    if (entri.isDirectory()) hasil.push(...(await daftarBerkasRelatif(akar, penuh)));
    else if (entri.isFile()) hasil.push(path.relative(akar, penuh).replace(/\\/g, "/"));
  }
  return hasil.sort();
}

async function salinBerkas(sumberAkar: string, relatif: string, tujuanAkar: string) {
  const sumber = path.join(sumberAkar, relatif);
  const tujuan = path.join(tujuanAkar, relatif);
  const isi = await readFile(sumber);
  await writeFile(tujuan, isi).catch(async () => {
    const { mkdir } = await import("node:fs/promises");
    await mkdir(path.dirname(tujuan), { recursive: true });
    await writeFile(tujuan, isi);
  });
}

function capWaktu(tanggal = new Date()) {
  const dua = (n: number) => String(n).padStart(2, "0");
  return `${tanggal.getFullYear()}${dua(tanggal.getMonth() + 1)}${dua(tanggal.getDate())}-${dua(tanggal.getHours())}${dua(tanggal.getMinutes())}${dua(tanggal.getSeconds())}`;
}

async function sidikBerkas(jalur: string) {
  const isi = await readFile(jalur);
  return { sha256: createHash("sha256").update(isi).digest("hex"), byteLength: isi.byteLength };
}

// ─── Tiga arsip ──────────────────────────────────────────────────────────────

/** Akar repositori: satu tingkat di atas manajemen_surat bila ada, kalau tidak cwd. */
export function akarAplikasi(cwd = process.cwd()) {
  const induk = path.dirname(cwd);
  return path.basename(cwd) === "manajemen_surat" ? induk : cwd;
}

async function siapkanDirektoriSementara(awalan: string) {
  return mkdtemp(path.join(os.tmpdir(), `aleta-${awalan}-`));
}

/**
 * Seluruh aplikasi - berkas sumber yang dilacak, tanpa yang dibangun ulang.
 */
export async function buatArsipAplikasi(alat?: AlatArsip): Promise<HasilArsip> {
  const alatAda = alat ?? (await periksaAlat());
  const format = pilihFormat(alatAda);
  const akar = akarAplikasi();
  const sementara = await siapkanDirektoriSementara("aplikasi");
  const isi = path.join(sementara, `aleta-${APP_VERSION}`);
  await (await import("node:fs/promises")).mkdir(isi, { recursive: true });

  const daftar = await listApplicationBackupFiles(akar);
  for (const relatif of daftar) await salinBerkas(akar, relatif, isi);

  await writeFile(
    path.join(isi, "BACA-SAYA-ARSIP.txt"),
    [
      `ALETA ${APP_VERSION} - seluruh berkas sumber aplikasi.`,
      `Dibuat ${new Date().toISOString()} dari Update Manager.`,
      "",
      "Yang TIDAK disertakan, karena dibangun ulang dari sumber ini:",
      "  node_modules  -> jalankan `npm ci` di manajemen_surat dan aleta_bot",
      "  .next         -> jalankan `npm run build` di manajemen_surat",
      "Unggahan pengguna dan basis data diarsipkan terpisah.",
      "",
      `Jumlah berkas: ${daftar.length}`,
    ].join("\n"),
    "utf8"
  );

  const { jalur, namaBerkas } = await mampatkanDirektori(isi, `aleta-aplikasi-${APP_VERSION}-${capWaktu()}`, format, sementara);
  const { sha256, byteLength } = await sidikBerkas(jalur);
  return {
    jenis: "aplikasi",
    namaBerkas,
    jalur,
    direktoriSementara: sementara,
    byteLength,
    sha256,
    format,
    mimeType: mimeUntukFormat(format),
    catatan: [`${daftar.length} berkas sumber`, `dimampatkan ${format}`],
  };
}

/**
 * Paket pembaruan terbaru.
 *
 * Yang lebih dulu: paket yang benar-benar dibuat skrip di host dan tersedia
 * lewat mount reports/updates - itulah yang dipakai memperbarui. Bila belum
 * ada satu pun, disusun di sini dari daftar isi yang SAMA dengan skripnya,
 * dan namanya menyebut asalnya.
 */
export async function buatArsipPembaruan(reportDir?: string): Promise<HasilArsip> {
  const akar = akarAplikasi();
  const direktoriLaporan = reportDir ?? path.join(process.cwd(), "reports");
  const direktoriPaket = path.join(direktoriLaporan, "updates");

  let terbaru: { jalur: string; nama: string; mtime: number } | null = null;
  try {
    for (const nama of await readdir(direktoriPaket)) {
      if (!/^aleta-update-.*\.tar\.gz$/i.test(nama)) continue;
      const jalur = path.join(direktoriPaket, nama);
      const info = await stat(jalur);
      if (!terbaru || info.mtimeMs > terbaru.mtime) terbaru = { jalur, nama, mtime: info.mtimeMs };
    }
  } catch {
    /* folder laporan belum ada: disusun sendiri di bawah */
  }

  if (terbaru) {
    const { sha256, byteLength } = await sidikBerkas(terbaru.jalur);
    return {
      jenis: "pembaruan",
      namaBerkas: terbaru.nama,
      jalur: terbaru.jalur,
      direktoriSementara: "",
      byteLength,
      sha256,
      format: "tar.gz",
      mimeType: "application/gzip",
      catatan: ["paket dari scripts/aleta-make-update.sh di host"],
    };
  }

  const sementara = await siapkanDirektoriSementara("pembaruan");
  const isi = path.join(sementara, `aleta-update-${APP_VERSION}`);
  await (await import("node:fs/promises")).mkdir(isi, { recursive: true });
  let jumlah = 0;
  for (const butir of ISI_PAKET_PEMBARUAN) {
    const sumber = path.join(akar, butir);
    let info;
    try {
      info = await stat(sumber);
    } catch {
      continue;
    }
    if (info.isFile()) {
      await salinBerkas(akar, butir, isi);
      jumlah += 1;
    } else if (info.isDirectory()) {
      for (const relatif of await daftarBerkasRelatif(sumber)) {
        const gabung = `${butir}/${relatif}`;
        if (/(^|\/)(node_modules|\.next|\.git)(\/|$)/.test(gabung)) continue;
        await salinBerkas(akar, gabung, isi);
        jumlah += 1;
      }
    }
  }
  const namaBerkas = `aleta-update-${APP_VERSION}-dari-portal.tar.gz`;
  const jalur = path.join(sementara, namaBerkas);
  const { tar } = await susunTar(sementara, (await daftarBerkasRelatif(sementara)).filter((n) => n !== namaBerkas));
  await writeFile(jalur, gzipSync(tar, { level: 9 }));
  const { sha256, byteLength } = await sidikBerkas(jalur);
  return {
    jenis: "pembaruan",
    namaBerkas,
    jalur,
    direktoriSementara: sementara,
    byteLength,
    sha256,
    format: "tar.gz",
    mimeType: "application/gzip",
    catatan: [`${jumlah} berkas, disusun portal dengan daftar isi yang sama dengan skrip host`],
  };
}

function jalankanPgDump(connectionString: string, format: "plain" | "custom"): Promise<Buffer> {
  const url = new URL(connectionString);
  const namaDb = decodeURIComponent(url.pathname.replace(/^\//, "")) || "postgres";
  const argumen = [
    `--format=${format}`,
    "--no-owner",
    "--no-privileges",
    ...(format === "plain" ? ["--clean", "--if-exists"] : []),
    "--host",
    url.hostname,
    "--port",
    url.port || "5432",
    "--username",
    decodeURIComponent(url.username || "postgres"),
    "--dbname",
    namaDb,
  ];
  return new Promise((selesai, gagal) => {
    const anak = spawn("pg_dump", argumen, {
      env: { ...process.env, PGPASSWORD: decodeURIComponent(url.password || "") },
      windowsHide: true,
    });
    const keluar: Buffer[] = [];
    const galat: Buffer[] = [];
    anak.stdout.on("data", (b: Buffer) => keluar.push(b));
    anak.stderr.on("data", (b: Buffer) => galat.push(b));
    anak.on("error", gagal);
    anak.on("close", (kode) => {
      if (kode === 0) selesai(Buffer.concat(keluar));
      else gagal(new Error(Buffer.concat(galat).toString("utf8") || `pg_dump keluar dengan kode ${kode}`));
    });
  });
}

/**
 * Seluruh basis data: SQL polos DAN format kustom pg_dump, dalam satu arsip.
 */
export async function buatArsipBasisData(db: AletaDatabase, alat?: AlatArsip): Promise<HasilArsip> {
  const alatAda = alat ?? (await periksaAlat());
  const format = pilihFormat(alatAda);
  const sementara = await siapkanDirektoriSementara("database");
  const cap = capWaktu();
  const isi = path.join(sementara, `aleta-database-${cap}`);
  await (await import("node:fs/promises")).mkdir(isi, { recursive: true });

  const runtime = await getDatabaseRuntimeStatus();
  const catatan: string[] = [];
  let sumber = "";

  if (runtime.activeMode === "postgres" && alatAda.pg_dump) {
    const url = getDatabaseUrl();
    try {
      const polos = await jalankanPgDump(url, "plain");
      await writeFile(path.join(isi, `aleta-postgres-${cap}.sql`), polos);
      const kustom = await jalankanPgDump(url, "custom");
      await writeFile(path.join(isi, `aleta-postgres-${cap}.dump`), kustom);
      sumber = "pg_dump";
      catatan.push("SQL polos dan format kustom pg_dump");
    } catch (galat) {
      catatan.push(`pg_dump gagal: ${galat instanceof Error ? galat.message : String(galat)}`);
    }
  }

  if (!sumber) {
    // SQL polos disusun ALETA sendiri dari tabel-tabelnya - dapat dijalankan
    // di Postgres mana pun, tanpa format kustom.
    const cadangan = await createDatabaseBackup(db);
    await writeFile(path.join(isi, `aleta-portable-${cap}.sql`), gunzipSync(cadangan.buffer));
    sumber = cadangan.metadata.source;
    catatan.push(`SQL polos susunan ALETA (${sumber})`);
  }

  await writeFile(
    path.join(isi, "BACA-SAYA-DATABASE.txt"),
    [
      `ALETA ${APP_VERSION} - seluruh basis data portal.`,
      `Dibuat ${new Date().toISOString()} dari Update Manager. Sumber: ${sumber}.`,
      `Mode basis data saat diarsipkan: ${runtime.activeMode}.`,
      "",
      "MEMULIHKAN",
      "  SQL polos  : psql -h HOST -U aleta -d aleta -f aleta-postgres-*.sql",
      "  Kustom     : pg_restore -h HOST -U aleta -d aleta --clean --if-exists aleta-postgres-*.dump",
      "  Format kustom memungkinkan memulihkan sebagian tabel saja (--table).",
      "",
      "YANG TIDAK ADA DI SINI",
      "  Tabel aleta_bot_* milik ALETA Bot hidup di MySQL peladen SIPP, di luar",
      "  jangkauan portal. Cadangkan dari host bot:",
      "  mysqldump --single-transaction aleta_bot > aleta_bot.sql",
    ].join("\n"),
    "utf8"
  );

  const { jalur, namaBerkas } = await mampatkanDirektori(isi, `aleta-database-${cap}`, format, sementara);
  const { sha256, byteLength } = await sidikBerkas(jalur);
  catatan.push(`dimampatkan ${format}`);
  return {
    jenis: "database",
    namaBerkas,
    jalur,
    direktoriSementara: sementara,
    byteLength,
    sha256,
    format,
    mimeType: mimeUntukFormat(format),
    catatan,
  };
}

export async function buatArsip(jenis: JenisArsip, db: AletaDatabase): Promise<HasilArsip> {
  if (jenis === "aplikasi") return buatArsipAplikasi();
  if (jenis === "pembaruan") return buatArsipPembaruan();
  if (jenis === "database") return buatArsipBasisData(db);
  throw new ApiError(400, "Jenis arsip tidak dikenali.");
}

/** Membersihkan direktori sementara sesudah berkasnya terkirim. */
export async function bersihkanArsip(hasil: HasilArsip) {
  if (!hasil.direktoriSementara) return;
  await rm(hasil.direktoriSementara, { recursive: true, force: true }).catch(() => undefined);
}

/** Keterangan untuk layar: format apa yang akan dihasilkan tiap jenis. */
export async function keteranganArsip() {
  const alat = await periksaAlat();
  const format = pilihFormat(alat);
  return {
    alat,
    format: { aplikasi: format, pembaruan: "tar.gz" as FormatArsip, database: format },
    rarTersedia: alat.rar,
    catatan: alat.rar
      ? "Program rar terpasang; arsip dibuat dalam format RAR."
      : alat["7z"]
        ? "Program rar tidak terpasang (berbayar dan tertutup). Arsip dibuat 7-Zip LZMA2 tingkat 9 - sama kuat atau lebih kuat daripada RAR, dan dibuka WinRAR."
        : alat.xz
          ? "rar dan 7z tidak terpasang; dipakai xz (LZMA2) - pemampatan sekelas, berkas .tar.xz dibuka WinRAR maupun 7-Zip."
          : "Tidak ada rar, 7z, maupun xz di peladen; dipakai gzip tingkat 9. Pasang p7zip-full di citra portal untuk pemampatan yang jauh lebih kuat.",
  };
}
