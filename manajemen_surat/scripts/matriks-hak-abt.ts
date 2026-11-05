/**
 * Menyusun matriks hak per folder blangko ALETA ABT untuk disetujui pemilik (Tahap 6, 5 Nov 2026).
 *
 *   npx tsx scripts/matriks-hak-abt.ts [--db aps_badilag_dbderry3nov] [--disk "<jalur>/_blangko_abt/derry_briantono"] [--keluar <folder>]
 *
 * HANYA MEMBACA: satu kueri SELECT atas abt_menu di MySQL setempat (ALETA_MYSQL = mysql.exe, bawaan XAMPP di D:) dan, bila diberi,
 * nama folder di cakram. Tidak menulis ke database mana pun, tidak menyentuh ABT/SIPP, tidak membaca data pegawai atau pihak.
 * Keluaran: matriks-hak.html (untuk dibaca pemilik) dan matriks-hak.json (angka dan sidik).
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

import { barisMenuDari, susunMatriks, type FolderPustaka } from "../src/lib/aleta-abt-hak-folder";
import { matriksKeHtml } from "../src/lib/aleta-abt-hak-folder-html";

function argumen(nama: string, bawaan: string): string {
  const i = process.argv.indexOf(`--${nama}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : bawaan;
}

const MYSQL = process.env.ALETA_MYSQL || "D:/Satker Asal/Website PA Bungku/xampp/mysql/bin/mysql.exe";
const DB = argumen("db", "aps_badilag_dbderry3nov");
const DISK = argumen("disk", "D:/Satker Asal/Website PA Bungku/xampp/htdocs/aps_badilag/_blangko_abt/derry_briantono");
const KELUAR = argumen("keluar", "D:/aleta-dev/kerja/aleta-abt/t6");

if (!/^[A-Za-z0-9_]+$/.test(DB)) throw new Error("Nama database tidak sah.");
const KOLOM = "direktori,nama,nama_alias,parent_direktori,proses_id_min,proses_id_max,perkara_id_min,perkara_id_max,perkara_id_referensi,user_cek,user_grup_id,user_top_id,user_validator";
const keluar = execFileSync(MYSQL, ["-u", "root", "-B", "--default-character-set=utf8mb4", DB, "-e", `SELECT ${KOLOM} FROM abt_menu ORDER BY id`], { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
const [kepala, ...isi] = keluar.replace(/\r/g, "").split("\n").filter(Boolean);
const nama = kepala.split("\t");
const menu = isi.map((b) => {
  const sel = b.split("\t");
  const o: Record<string, unknown> = {};
  nama.forEach((n, i) => (o[n] = sel[i] === "NULL" ? null : sel[i]));
  return barisMenuDari(o);
});

const folder: FolderPustaka[] = [];
if (existsSync(DISK)) {
  for (const d of readdirSync(DISK)) if (statSync(path.join(DISK, d)).isDirectory()) folder.push({ folder: d, arsip: /^-.*-$/.test(d) || /^_arsip/i.test(d) });
}

const m = susunMatriks(menu, folder);
mkdirSync(KELUAR, { recursive: true });
const catatan = [
  `Folder diambil dari baris menu Derry (induk derry_briantono dan _arsip_derry_briantono) di database ${DB} ditambah ${folder.length} folder di cakram setempat.`,
  "Keputusan 5 Nov 2026: folder arsip hanya untuk Super Admin; folder tanpa baris menu hanya untuk Super Admin sampai ditetapkan; Meja I disamakan dengan PTSP dan Meja II/III dengan Analis Perkara; mediator, petugas sidang, TI, pelaksana, dan Admin tanpa hak.",
  "Saklar PP boleh membuka folder putusan dan Hakim boleh membuka folder BAS bekerja dengan menambah peran ke hak folder di ABT, jadi ikut terhitung dari hak yang dibaca. Pada salinan ini kedua saklar mati; pada ABT di server dapat berbeda.",
  "Acuan ini harus dicocokkan ulang dengan ABT di server saat server hidup: layar Hak folder punya tombol Cocokkan ulang dengan ABT (sinkron pustaka).",
  "Angka 107 folder di pustaka ALETA di server tidak dapat dicocokkan dari sini karena server mati; matriks yang sama dapat dibangkitkan ulang dari pustaka ALETA di layar Alur kerja, bagian Hak folder.",
];
writeFileSync(path.join(KELUAR, "matriks-hak.html"), matriksKeHtml(m, { sumber: `database ${DB} (hanya dibaca)`, dibuat: new Date().toISOString().slice(0, 16).replace("T", " "), catatan }), "utf8");
writeFileSync(
  path.join(KELUAR, "matriks-hak.json"),
  JSON.stringify({ db: DB, jumlahFolder: m.jumlahFolder, jumlahRagu: m.jumlahRagu, sidik: m.sidik, baris: m.baris.map((b) => ({ folder: b.folder, ragu: b.ragu, hak: b.hak })) }, null, 2),
  "utf8"
);
console.log(JSON.stringify({ db: DB, menu: menu.length, folderDiCakram: folder.length, jumlahFolder: m.jumlahFolder, jumlahRagu: m.jumlahRagu, sidik: m.sidik }));
