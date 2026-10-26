// @vitest-environment node
import crypto from "node:crypto";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync, utimesSync, existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { NextRequest } from "next/server";
import { newDb } from "pg-mem";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { IN_MEMORY_TABLE_PERSISTENCE_ORDER, createAletaDatabase } from "@/server/db/client";
import { DDL_PENJAGA_INTEGRITAS } from "@/server/db/schema";
import { dalamFolderUnggahan, periksaIsi } from "@/server/modules/integritas/aturan";
import {
  FOLDER_HALAMAN,
  daftarTemuan,
  detakIntegritas,
  kirimPeringatanIntegritas,
  pindaiHalamanPublik,
  pindaiSemua,
  ringkasIntegritas,
  tandaiAman,
  tandaiDitangani,
} from "@/server/modules/integritas/layanan";
import { pindaiFolder } from "@/server/modules/integritas/pemindai";
import {
  PENGATURAN_INTEGRITAS_BAWAAN,
  bersihkanPengaturanIntegritas,
  jalurFolderSah,
  kosongkanSinggahIntegritas,
  periksaMasukanIntegritas,
  simpanPengaturanIntegritas,
  urlHalamanSah,
} from "@/server/modules/integritas/pengaturan";
import { periksaIntegritas } from "@/server/modules/kesehatan/pemeriksa";

/**
 * ============================================================================
 * PENJAGA INTEGRITAS BERKAS (E6, 25 Okt 2026)
 * ============================================================================
 *
 *   1. aturan: webshell, konfigurasi, kata judol (ambang), folder unggahan
 *   2. pengaturan: MATI bawaan, jalur folder sah, URL sah
 *   3. migrasi 0104 = DDL, ikut cadangan, jurnal berurutan
 *   4. pindai folder nyata: baseline awal tanpa "baru", lalu baru/berubah/hilang,
 *      FOLDER TIDAK BERUBAH SAMA SEKALI (isi, ukuran, waktu ubah), isi mencurigakan
 *      tidak masuk basis data
 *   5. diketahui aman, ditangani, dibuka kembali bila isi berubah lagi
 *   6. peringatan WhatsApp: satu pesan ringkas tanpa isi berkas, tidak berulang
 *   7. halaman publik, detak (saklar mati = tidak membaca apa pun), kunci pindai
 *   8. Pusat kesehatan dan rute (Admin melihat, hanya Super Admin mengatur)
 *
 * CATATAN PENTING: pola serangan di berkas ini SENGAJA dirakit dari potongan
 * (j(...)) dan berkas rekaan di disk hanya memakai pola yang paling ringan.
 * Penulisan utuh pola webshell membuat antivirus Windows memutus berkas uji
 * ini ("Permission denied") sehingga tidak dapat dibaca atau dijalankan.
 */

// Peringatan WhatsApp digabung dengan jendela tahan (26 Okt 2026); uji ini memeriksa pengiriman langsung (jendela 0). Penggabungan diuji di peringatan-gabungan-26okt.
process.env.ALETA_PERINGATAN_GABUNG_MENIT = "0";

const ctx = vi.hoisted(() => ({ db: null as unknown }));

vi.mock("@/server/db/client", async (asli) => ({
  ...(await asli<typeof import("@/server/db/client")>()),
  getDatabase: async () => ctx.db,
}));
vi.mock("@/lib/auth", () => ({
  getAuth: async () => {
    throw new Error("tanpa Better Auth di uji");
  },
}));

/** Merakit potongan menjadi satu teks (menghindari tanda tangan antivirus pada berkas sumber). */
const j = (...bagian: string[]) => bagian.join("");

type Db = Awaited<ReturnType<typeof createAletaDatabase>>;
const db = () => ctx.db as Db;
const KINI = new Date("2026-10-26T01:00:00.000Z");
const menit = (m: number) => new Date(KINI.getTime() + m * 60_000);
const req = (url: string, init?: ConstructorParameters<typeof NextRequest>[1]) => new NextRequest(`http://localhost${url}`, init);

let akar = "";

beforeAll(async () => {
  akar = mkdtempSync(path.join(os.tmpdir(), "integritas-uji-"));
  const d = await createAletaDatabase({ useInMemory: true, seed: false });
  const kini = KINI.toISOString();
  for (const r of ["hakim", "admin", "super-admin"]) await d.run(`INSERT INTO roles (id, name, description) VALUES (?, ?, '')`, [r, r]);
  await d.run(`INSERT INTO positions (id, name, unit_kerja, level_hierarchy, created_at, updated_at) VALUES ('pos-uji', 'Uji', 'Uji', 1, ?, ?)`, [kini, kini]);
  for (const [id, peran, wa] of [
    ["u-sa", "super-admin", "081200000001"],
    ["u-admin", "admin", "081200000002"],
    ["u-hakim", "hakim", "081200000003"],
  ]) {
    await d.run(
      `INSERT INTO users (id, username, password_hash, name, email, whatsapp_number, role_id, position_id, created_at, updated_at) VALUES (?, ?, 'x', ?, ?, ?, ?, 'pos-uji', ?, ?)`,
      [id, id, `Nama ${id}`, `${id}@rekaan.test`, wa, peran, kini, kini]
    );
  }
  ctx.db = d;
}, 300_000);

afterAll(() => {
  if (akar) rmSync(akar, { recursive: true, force: true });
});

beforeEach(async () => {
  for (const t of ["aleta_ekstensi_setelan", "aleta_integritas_berkas", "aleta_integritas_temuan", "aleta_integritas_aman", "aleta_integritas_pindai", "audit_logs"]) {
    await db().run(`DELETE FROM ${t}`);
  }
  kosongkanSinggahIntegritas();
});

// ─── helper folder ──────────────────────────────────────────────────────────

const UNGGAHAN = ["uploads", "upload", "images"];
let nomor = 0;

const SKRIP_CURIGA = j("<?php\n@ass", "ert($muatan);\n");

/** Website rekaan. Isinya hanya memicu aturan, bukan malware sungguhan. */
function buatWebsite() {
  nomor += 1;
  const dir = path.join(akar, `web${nomor}`);
  const tulis = (rel: string, isi: string) => {
    const f = path.join(dir, ...rel.split("/"));
    mkdirSync(path.dirname(f), { recursive: true });
    writeFileSync(f, isi);
  };
  tulis("index.php", "<?php echo 'Selamat datang di PA rekaan'; ?>\n");
  tulis("tentang.html", "<html><body>Waspada judi online. Layanan resmi pengadilan.</body></html>\n");
  tulis("uploads/foto-ruang.jpg", "JPEGDATA-bukan-php");
  tulis("css/gaya.css", "body { color: #333 }\n");
  tulis("uploads/shell.php", SKRIP_CURIGA);
  tulis("uploads/gambar-palsu.png", "PNGDATA\n<?php echo 1; ?>");
  tulis("halaman-judi.html", "<html>\nsitus SLOT GACOR hari ini, bonus new member, togel maxwin\n</html>\n");
  tulis(".htaccess", j("AddType application/x-httpd-", "php .jpg\n"));
  tulis("node_modules/lib/x.php", SKRIP_CURIGA);
  return { dir, tulis };
}

function foto(dir: string): string {
  const keluar: string[] = [];
  const jalan = (d: string) => {
    for (const nama of readdirSync(d).sort()) {
      const f = path.join(d, nama);
      const st = statSync(f);
      if (st.isDirectory()) {
        keluar.push(`D ${path.relative(dir, f)} ${Math.floor(st.mtimeMs)}`);
        jalan(f);
      } else keluar.push(`F ${path.relative(dir, f)} ${st.size} ${Math.floor(st.mtimeMs)} ${crypto.createHash("sha256").update(readFileSync(f)).digest("hex")}`);
    }
  };
  jalan(dir);
  return keluar.join("\n");
}

const folderUji = (dir: string, id = "f-uji") => ({ id, nama: "Website uji", jalur: dir.replace(/\\/g, "/"), jenis: "website" as const, unggahan: UNGGAHAN });
const lewati = { lewati: [".git", "node_modules"] };
const nyalakan = (dir: string, ekstra: Record<string, unknown> = {}) =>
  simpanPengaturanIntegritas(db(), { aktif: true, folder: [folderUji(dir)], ...ekstra }, { id: "u-sa", nama: "SA" }, { kini: KINI });

// ─── 1. Aturan ──────────────────────────────────────────────────────────────

describe("aturan deteksi", () => {
  const web = (t: string) => periksaIsi(t, { skrip: true, htaccess: false, judol: false }).map((d) => d.aturan);

  it("pola webshell yang diminta: pembungkus, assert, gzinflate, preg_replace /e, perintah dengan masukan", () => {
    expect(web(j("<?php ev", "al(base", "64_decode($x));"))).toContain("eval-pembungkus");
    expect(web(j("<?php ev", "al(@gz", "inflate(base", "64_decode($x)));"))).toEqual(expect.arrayContaining(["eval-pembungkus"]));
    expect(web(j("<?php gz", "inflate(base", "64_decode($x));"))).toContain("gzinflate-base64");
    expect(web(j("<?php @ass", "ert($_PO", "ST['a']);"))).toContain("assert-variabel");
    expect(web(j("<?php ass", "ert($kode);"))).toContain("assert-variabel");
    expect(web(j("<?php preg_", "replace('/(.*)/e', $x, 'a');"))).toContain("preg-replace-e");
    expect(web(j("<?php sys", "tem($_GE", "T['cmd']);"))).toContain("perintah-masukan");
    expect(web(j("<?php file_put_", "contents($_PO", "ST['f'], $d);"))).toContain("tulis-berkas-masukan");
    expect(web(j("<?php ev", "al($_REQ", "UEST['z']);"))).toContain("eval-masukan");
    expect(web(j("<?php echo 'c99", "shell';"))).toContain("shell-dikenal");
    expect(web(j("<?php $f='ass", "ert'; $f($x);"))).toContain("fungsi-variabel");
  });

  it("kode wajar tidak dituduh: assert dengan perbandingan, preg_replace tanpa /e, system dengan konstanta, decode tanpa eval", () => {
    expect(web(j("<?php ass", "ert($x > 0); preg_", "replace('/a/i', 'b', $s); sys", "tem('ls'); $y = base", "64_decode($z); echo gz", "inflate($d);"))).toEqual([]);
    expect(web("<?php // evaluasi hasil sidang\n$assertion = 1;")).toEqual([]);
  });

  it("konfigurasi .htaccess mencurigakan hanya bila diminta", () => {
    const htaccess = j("AddType application/x-httpd-", "php .jpg");
    expect(periksaIsi(htaccess, { skrip: false, htaccess: true, judol: false }).map((d) => d.aturan)).toEqual(["htaccess-jalankan-php"]);
    expect(periksaIsi("php_value auto_prepend_file /x/y.php", { skrip: false, htaccess: true, judol: false }).map((d) => d.aturan)).toEqual(["htaccess-auto-prepend"]);
    expect(periksaIsi(htaccess, { skrip: false, htaccess: false, judol: false })).toEqual([]);
    expect(periksaIsi("RewriteEngine On\nOptions -Indexes", { skrip: false, htaccess: true, judol: false })).toEqual([]);
  });

  it("kata judol: satu kata tunggal (imbauan resmi) tidak cukup, dua kata berbeda atau frasa khas cukup; nomor baris benar", () => {
    const judol = (t: string) => periksaIsi(t, { skrip: false, htaccess: false });
    expect(judol("Waspada judi online dan togel.")).toHaveLength(1);
    expect(judol("Waspada judi online. Layanan resmi pengadilan.")).toEqual([]);
    expect(judol("Jadwal sidang. Slot waktu mediasi tersedia.")).toEqual([]);
    expect(judol("baris satu\nbaris dua\nBandar Togel terpercaya")[0]).toMatchObject({ jenis: "kata-judol", baris: 3 });
    expect(judol("link: slot_gacor hari ini")).toHaveLength(1);
    expect(judol("nggacorsekali")).toEqual([]);
  });

  it("folder unggahan: segmen utuh, tanpa membedakan huruf, bukan nama berkas", () => {
    expect(dalamFolderUnggahan("uploads/a.php", UNGGAHAN)).toBe(true);
    expect(dalamFolderUnggahan("wp-content/Uploads/2026/a.php", ["wp-content/uploads"])).toBe(true);
    expect(dalamFolderUnggahan("a/images/b/c.php", UNGGAHAN)).toBe(true);
    expect(dalamFolderUnggahan("uploads.php", UNGGAHAN)).toBe(false);
    expect(dalamFolderUnggahan("myuploads/a.php", UNGGAHAN)).toBe(false);
    expect(dalamFolderUnggahan("index.php", UNGGAHAN)).toBe(false);
  });
});

// ─── 2. Pengaturan ──────────────────────────────────────────────────────────

describe("pengaturan", () => {
  it("MATI bawaan: tanpa folder, tanpa halaman", () => {
    expect(PENGATURAN_INTEGRITAS_BAWAAN).toMatchObject({ aktif: false, folder: [], halamanPublik: [], selangMenit: 360 });
  });

  it("jalur folder: absolut dan spesifik; akar disk/sistem, relatif, dan '..' ditolak", () => {
    for (const salah of ["", "/", "/etc", "/proc", "C:/", "C:", "relatif/web", "../web", "/var/www/../../etc", "/mnt"]) expect(jalurFolderSah(salah), salah).toBe(false);
    for (const benar of ["/mnt/website-pa", "/var/www/html", "D:/satker/website", "C:\\xampp\\htdocs\\pa"]) expect(jalurFolderSah(benar), benar).toBe(true);
  });

  it("URL halaman: hanya http/https tanpa kredensial dan bukan alamat metadata", () => {
    expect(urlHalamanSah("https://pa-contoh.go.id/")).toBe(true);
    expect(urlHalamanSah("http://192.168.10.10:8080/web")).toBe(true);
    for (const salah of ["ftp://x/y", "file:///etc/passwd", "javascript:alert(1)", "https://u:p@x.id/", "http://169.254.169.254/latest", "bukan url"]) expect(urlHalamanSah(salah), salah).toBe(false);
  });

  it("simpan menolak folder yang tidak ada/bukan folder dan selang di luar batas; membersihkan sisanya", async () => {
    await expect(periksaMasukanIntegritas({ folder: [{ jalur: path.join(akar, "tidak-ada").replace(/\\/g, "/") }] })).rejects.toThrow(/tidak ditemukan atau tidak terbaca/);
    const berkas = path.join(akar, "bukan-folder.txt");
    writeFileSync(berkas, "x");
    await expect(periksaMasukanIntegritas({ folder: [{ jalur: berkas.replace(/\\/g, "/") }] })).rejects.toThrow(/tidak ditemukan atau tidak terbaca/);
    await expect(periksaMasukanIntegritas({ folder: [{ jalur: "/" }] })).rejects.toThrow(/tidak sah/);
    await expect(periksaMasukanIntegritas({ selangMenit: 5 })).rejects.toThrow(/Selang/);
    await expect(periksaMasukanIntegritas({ halamanPublik: ["ftp://x"] })).rejects.toThrow(/http/);
    await expect(periksaMasukanIntegritas(null)).rejects.toThrow();
    const p = bersihkanPengaturanIntegritas({ aktif: true, folder: [{ jalur: "/etc" }, { jalur: "/mnt/web-a", nama: "<b>Web</b>", jenis: "gaib", unggahan: ["../x", "uploads"] }], selangMenit: 7 });
    expect(p.folder).toHaveLength(1);
    expect(p.folder[0]).toMatchObject({ nama: "bWeb/b", jenis: "website", unggahan: ["uploads"] });
    expect(p.selangMenit).toBe(360);
  });
});

// ─── 3. Migrasi ─────────────────────────────────────────────────────────────

describe("migrasi 0104", () => {
  const SQL = path.join(process.cwd(), "drizzle", "0104_aleta_penjaga_integritas.sql");
  const pernyataan = (s: string) =>
    s
      .split("\n")
      .filter((l) => !l.trim().startsWith("--"))
      .join("\n")
      .split(";")
      .map((x) => x.trim())
      .filter(Boolean);

  it("jurnal: 0104 tepat sekali, idx = urutan, when naik", () => {
    const jr = JSON.parse(readFileSync(path.join(process.cwd(), "drizzle/meta/_journal.json"), "utf8")) as { entries: Array<{ idx: number; tag: string; when: number }> };
    jr.entries.forEach((e, i) => expect(e.idx).toBe(i));
    expect(jr.entries.filter((e) => e.tag.startsWith("0104_"))).toEqual([expect.objectContaining({ tag: "0104_aleta_penjaga_integritas" })]);
    for (let i = 1; i < jr.entries.length; i += 1) expect(jr.entries[i]?.when).toBeGreaterThan(jr.entries[i - 1]?.when ?? 0);
  });

  it("pernyataan berkas = DDL, berjalan di pg-mem, semua tabelnya ikut cadangan", () => {
    const isiSql = readFileSync(SQL, "utf8");
    expect(pernyataan(isiSql)).toEqual([...DDL_PENJAGA_INTEGRITAS.tabel, ...DDL_PENJAGA_INTEGRITAS.indeks].map((s) => pernyataan(s)[0]));
    const kosong = newDb();
    kosong.public.none(isiSql);
    for (const t of ["aleta_integritas_berkas", "aleta_integritas_temuan", "aleta_integritas_aman", "aleta_integritas_pindai"]) {
      expect(kosong.public.many(`SELECT * FROM ${t}`)).toEqual([]);
      expect(IN_MEMORY_TABLE_PERSISTENCE_ORDER).toContain(t);
    }
  });
});

// ─── 4. Pindai folder nyata ─────────────────────────────────────────────────

describe("pindai folder", () => {
  it("pindai awal: baseline tanpa 'baru/berubah', tetapi webshell, PHP di unggahan, kode PHP di gambar, judol, dan .htaccess tetap terdeteksi; folder TIDAK berubah", async () => {
    const { dir } = buatWebsite();
    const sebelum = foto(dir);
    const hasil = await pindaiFolder(db(), folderUji(dir), lewati, "otomatis", { kini: () => KINI });
    expect(hasil).toMatchObject({ jenis: "awal", galat: "" });
    expect(hasil.jumlahBerkas).toBe(8); // node_modules dilewati

    const t = await daftarTemuan(db(), { status: "semua" });
    const kunci = t.map((x) => `${x.jenis}:${x.jalur}`).sort();
    expect(kunci).toEqual(
      [
        "kata-judol:halaman-judi.html",
        "konfigurasi:.htaccess",
        "php-di-gambar:uploads/gambar-palsu.png",
        "php-di-unggahan:uploads/shell.php",
        "webshell:uploads/shell.php",
      ].sort()
    );
    expect(t.some((x) => x.jenis === "php-baru" || x.jenis === "php-berubah")).toBe(false);
    // tentang.html (satu kata judol saja) dan index.php bersih tidak dituduh
    expect(t.some((x) => x.jalur === "tentang.html" || x.jalur === "index.php")).toBe(false);

    expect(foto(dir)).toBe(sebelum);
    const baseline = await db().queryAll<{ jalur: string; sha256: string }>("SELECT jalur, sha256 FROM aleta_integritas_berkas WHERE folder_id = 'f-uji'");
    expect(baseline).toHaveLength(8);
    expect(baseline.find((b) => b.jalur === "index.php")?.sha256).toBe(crypto.createHash("sha256").update(readFileSync(path.join(dir, "index.php"))).digest("hex"));
  });

  it("isi mencurigakan TIDAK masuk basis data (hanya jalur, jenis, aturan, baris, ukuran, sha256)", async () => {
    const { dir } = buatWebsite();
    await pindaiFolder(db(), folderUji(dir), lewati, "otomatis", { kini: () => KINI });
    const semua = JSON.stringify([
      await db().queryAll("SELECT * FROM aleta_integritas_temuan"),
      await db().queryAll("SELECT * FROM aleta_integritas_berkas"),
      await db().queryAll("SELECT * FROM aleta_integritas_pindai"),
    ]);
    for (const rahasia of ["$muatan", "ass" + "ert(", "gacor", "GACOR", "x-httpd-php", "bonus new member", "<?php", "maxwin"]) expect(semua).not.toContain(rahasia);
  });

  it("pindai rutin tanpa perubahan: nol temuan baru; sesudahnya PHP baru, PHP berubah, dan berkas hilang dikenali", async () => {
    const { dir, tulis } = buatWebsite();
    await pindaiFolder(db(), folderUji(dir), lewati, "otomatis", { kini: () => KINI });
    const awal = (await daftarTemuan(db(), { status: "baru" })).length;

    const diam = await pindaiFolder(db(), folderUji(dir), lewati, "otomatis", { kini: () => menit(10) });
    expect(diam).toMatchObject({ jenis: "rutin", temuanBaru: 0 });
    expect((await daftarTemuan(db(), { status: "baru" })).length).toBe(awal);

    tulis("blog/baru.php", "<?php echo 'halaman baru yang sah'; ?>");
    tulis("index.php", "<?php echo 'index diubah'; ?>\n");
    const ubah = await pindaiFolder(db(), folderUji(dir), lewati, "otomatis", { kini: () => menit(20) });
    expect(ubah.temuanBaru).toBe(2);
    const t = await daftarTemuan(db(), { status: "baru" });
    expect(t.filter((x) => x.jenis === "php-baru").map((x) => x.jalur)).toEqual(["blog/baru.php"]);
    expect(t.filter((x) => x.jenis === "php-berubah").map((x) => x.jalur)).toEqual(["index.php"]);

    // berkas yang dihapus manusia: temuannya ditutup oleh sistem (ALETA tidak menghapus apa pun)
    rmSync(path.join(dir, "uploads", "shell.php"));
    await pindaiFolder(db(), folderUji(dir), lewati, "otomatis", { kini: () => menit(30) });
    const ditutup = (await daftarTemuan(db(), { status: "ditangani" })).filter((x) => x.jalur === "uploads/shell.php");
    expect(ditutup.length).toBeGreaterThanOrEqual(2);
    expect(ditutup.every((x) => x.tanganiOleh.startsWith("sistem"))).toBe(true);
    expect(existsSync(path.join(dir, "uploads", "gambar-palsu.png"))).toBe(true);
  });

  it("tautan simbolik tidak diikuti dan folder yang dilewati (node_modules, .git) tidak dibaca", async () => {
    const { dir } = buatWebsite();
    const luar = path.join(akar, `luar${nomor}`);
    mkdirSync(luar, { recursive: true });
    writeFileSync(path.join(luar, "rahasia.php"), SKRIP_CURIGA);
    try {
      symlinkSync(luar, path.join(dir, "tautan-keluar"), "junction");
    } catch {
      /* tanpa hak membuat tautan: bagian ini dilewati, sisanya tetap diuji */
    }
    mkdirSync(path.join(dir, ".git"));
    writeFileSync(path.join(dir, ".git", "x.php"), SKRIP_CURIGA);
    await pindaiFolder(db(), folderUji(dir), lewati, "otomatis", { kini: () => KINI });
    const jalur = (await daftarTemuan(db(), { status: "semua" })).map((x) => x.jalur);
    expect(jalur.some((p) => p.includes("rahasia.php"))).toBe(false);
    expect(jalur.some((p) => p.startsWith(".git") || p.startsWith("node_modules"))).toBe(false);
  });

  it("pindai penuh menghitung ulang sidik walau ukuran dan waktu ubah dipalsukan sama", async () => {
    const { dir } = buatWebsite();
    await pindaiFolder(db(), folderUji(dir), lewati, "otomatis", { kini: () => KINI });
    const f = path.join(dir, "index.php");
    const st = statSync(f);
    const asli = readFileSync(f, "utf8");
    writeFileSync(f, asli.replace("Selamat", "Selimat")); // ukuran sama
    // waktu ubah dipalsukan sama (ketelitian milidetik berbeda antar sistem berkas, jadi dicoba beberapa selisih kecil)
    const asliMs = Math.floor(st.mtimeMs);
    for (const selisih of [0, 0.0004, -0.0004, 0.001, -0.001]) {
      utimesSync(f, st.atime, asliMs / 1000 + selisih);
      if (Math.floor(statSync(f).mtimeMs) === asliMs) break;
    }
    expect(Math.floor(statSync(f).mtimeMs)).toBe(asliMs);
    const rutin = await pindaiFolder(db(), folderUji(dir), lewati, "rutin", { kini: () => menit(10) });
    expect(rutin.temuanBaru).toBe(0);
    const penuh = await pindaiFolder(db(), folderUji(dir), lewati, "penuh", { kini: () => menit(20) });
    expect(penuh.temuanBaru).toBe(1);
    expect((await daftarTemuan(db(), { status: "baru" })).some((x) => x.jenis === "php-berubah" && x.jalur === "index.php")).toBe(true);
  });

  it("melewati batas waktu: berhenti dengan galat, baseline berkas yang belum terlihat TIDAK dibuang", async () => {
    const { dir } = buatWebsite();
    await pindaiFolder(db(), folderUji(dir), lewati, "otomatis", { kini: () => KINI });
    const sebelum = Number((await db().queryOne<{ n: number }>("SELECT COUNT(*) AS n FROM aleta_integritas_berkas"))?.n);
    let panggilan = 0;
    const jamCepatHabis = () => new Date(KINI.getTime() + 60_000 + (panggilan++ > 6 ? 10 * 60_000 : 0));
    const hasil = await pindaiFolder(db(), folderUji(dir), lewati, "rutin", { kini: jamCepatHabis, berhentiSetelahMs: 5 * 60_000 });
    expect(hasil.galat).toMatch(/batas waktu/);
    expect(Number((await db().queryOne<{ n: number }>("SELECT COUNT(*) AS n FROM aleta_integritas_berkas"))?.n)).toBe(sebelum);
  });

  it("folder yang tidak terbaca mencatat galat dan tidak menghapus baseline", async () => {
    const { dir } = buatWebsite();
    await pindaiFolder(db(), folderUji(dir), lewati, "otomatis", { kini: () => KINI });
    const hasil = await pindaiFolder(db(), folderUji(path.join(akar, "hilang-total")), lewati, "otomatis", { kini: () => menit(5) });
    expect(hasil.galat).toMatch(/tidak terbaca/);
    expect(hasil.jumlahBerkas).toBe(0);
    expect(Number((await db().queryOne<{ n: number }>("SELECT COUNT(*) AS n FROM aleta_integritas_berkas WHERE folder_id = 'f-uji'"))?.n)).toBeGreaterThan(0);
  });
});

// ─── 5. Aman / ditangani ────────────────────────────────────────────────────

describe("diketahui aman dan ditangani", () => {
  it("diketahui aman: berkas dengan sidik yang sama tidak dilaporkan lagi; berubah lagi -> dilaporkan kembali", async () => {
    const { dir, tulis } = buatWebsite();
    await pindaiFolder(db(), folderUji(dir), lewati, "otomatis", { kini: () => KINI });
    tulis("index.php", "<?php echo 'pembaruan resmi v2'; ?>");
    await pindaiFolder(db(), folderUji(dir), lewati, "otomatis", { kini: () => menit(10) });
    const temuan = (await daftarTemuan(db(), { status: "baru" })).find((x) => x.jalur === "index.php");
    expect(temuan?.jenis).toBe("php-berubah");

    await expect(tandaiAman(db(), temuan!.id, "x", { id: "u-sa", nama: "SA" }, menit(11))).rejects.toThrow(/alasan/i);
    await tandaiAman(db(), temuan!.id, "pembaruan resmi CMS v2", { id: "u-sa", nama: "SA" }, menit(11));
    expect((await daftarTemuan(db(), { status: "baru" })).some((x) => x.jalur === "index.php")).toBe(false);

    // baseline berkas ini hilang (seolah baru) tetapi sidiknya sama dengan yang ditandai aman -> tidak dilaporkan lagi
    await db().run("DELETE FROM aleta_integritas_berkas WHERE folder_id = 'f-uji' AND jalur = 'index.php'");
    await pindaiFolder(db(), folderUji(dir), lewati, "penuh", { kini: () => menit(20) });
    expect((await daftarTemuan(db(), { status: "baru" })).some((x) => x.jalur === "index.php")).toBe(false);

    // berubah lagi (isi lain) -> dilaporkan kembali
    tulis("index.php", "<?php echo 'isi lain lagi'; ?>");
    await pindaiFolder(db(), folderUji(dir), lewati, "otomatis", { kini: () => menit(30) });
    expect((await daftarTemuan(db(), { status: "baru" })).some((x) => x.jalur === "index.php")).toBe(true);
    const audit = await db().queryAll<{ action: string }>("SELECT action FROM audit_logs WHERE action LIKE 'INTEGRITAS_%'");
    expect(audit.map((a) => a.action)).toEqual(["INTEGRITAS_AMAN"]);
  });

  it("ditangani: status berubah, tercatat siapa dan di audit; ditangani lalu isi berubah -> dibuka kembali", async () => {
    const { dir, tulis } = buatWebsite();
    await pindaiFolder(db(), folderUji(dir), lewati, "otomatis", { kini: () => KINI });
    const t = (await daftarTemuan(db(), { status: "baru" })).find((x) => x.jenis === "webshell")!;
    const selesai = await tandaiDitangani(db(), t.id, { id: "u-sa", nama: "SA" }, menit(1));
    expect(selesai).toMatchObject({ status: "ditangani", tanganiOleh: "SA" });
    await expect(tandaiDitangani(db(), "tidak-ada", { id: "u-sa", nama: "SA" })).rejects.toThrow(/tidak ditemukan/);

    tulis("uploads/shell.php", j("<?php\n@ass", "ert($lain); // berbeda\n"));
    const lagi = await pindaiFolder(db(), folderUji(dir), lewati, "otomatis", { kini: () => menit(10) });
    expect(lagi.temuanBaru).toBeGreaterThanOrEqual(1);
    expect((await daftarTemuan(db(), { status: "baru" })).some((x) => x.id === t.id)).toBe(true);
  });
});

// ─── 6. Peringatan WhatsApp ─────────────────────────────────────────────────

describe("peringatan WhatsApp", () => {
  const penerima = async () => [
    { id: "u-sa", nama: "SA", nomor: "081200000001" },
    { id: "u-admin", nama: "Admin", nomor: "081200000002" },
  ];

  it("satu pesan ringkas ke admin, tanpa isi berkas; tidak berulang; temuan baru berikutnya dikabarkan lagi", async () => {
    const { dir, tulis } = buatWebsite();
    await nyalakan(dir);
    await pindaiFolder(db(), folderUji(dir), lewati, "otomatis", { kini: () => KINI });
    const kiriman: Array<{ pesan: string; n: number }> = [];
    const kirim = async (p: Array<unknown>, pesan: string) => {
      kiriman.push({ pesan, n: p.length });
      return { terkirim: p.length, gagal: 0 };
    };
    const r1 = await kirimPeringatanIntegritas(db(), { kini: menit(1), kirim, penerima });
    expect(r1).toMatchObject({ jumlah: 5, terkirim: 2 });
    expect(kiriman).toHaveLength(1);
    expect(kiriman[0].n).toBe(2);
    expect(kiriman[0].pesan).toContain("PERINGATAN KEAMANAN");
    expect(kiriman[0].pesan).toContain("uploads/shell.php");
    expect(kiriman[0].pesan).toContain("Tidak ada berkas yang diubah atau dihapus otomatis");
    for (const rahasia of ["$muatan", "ass" + "ert(", "<?php", "gacor"]) expect(kiriman[0].pesan).not.toContain(rahasia);

    expect(await kirimPeringatanIntegritas(db(), { kini: menit(2), kirim, penerima })).toBeNull();
    expect(kiriman).toHaveLength(1);

    tulis("blog/baru.php", "<?php echo 'x'; ?>");
    await pindaiFolder(db(), folderUji(dir), lewati, "otomatis", { kini: () => menit(10) });
    await kirimPeringatanIntegritas(db(), { kini: menit(11), kirim, penerima });
    expect(kiriman).toHaveLength(2);
    expect(kiriman[1].pesan).toContain("Berkas PHP baru");
    expect(kiriman[1].pesan).not.toContain("webshell");
  });

  it("gagal kirim ke semua orang: tidak ditandai, dicoba lagi; saklar mati atau peringatan WhatsApp mati: tidak mengirim", async () => {
    const { dir } = buatWebsite();
    await nyalakan(dir);
    await pindaiFolder(db(), folderUji(dir), lewati, "otomatis", { kini: () => KINI });
    const gagal = async () => ({ terkirim: 0, gagal: 2 });
    expect(await kirimPeringatanIntegritas(db(), { kini: menit(1), kirim: gagal, penerima })).toMatchObject({ terkirim: 0 });
    const ok = vi.fn(async (p: Array<unknown>) => ({ terkirim: p.length, gagal: 0 }));
    expect(await kirimPeringatanIntegritas(db(), { kini: menit(2), kirim: ok, penerima })).toMatchObject({ terkirim: 2 });
    expect(ok).toHaveBeenCalledTimes(1);

    await simpanPengaturanIntegritas(db(), { peringatanWa: false }, { id: "u-sa", nama: "SA" }, { kini: menit(3), cekFolder: false });
    expect(await kirimPeringatanIntegritas(db(), { kini: menit(4), kirim: ok, penerima })).toBeNull();
    await simpanPengaturanIntegritas(db(), { peringatanWa: true, aktif: false }, { id: "u-sa", nama: "SA" }, { kini: menit(5), cekFolder: false });
    expect(await kirimPeringatanIntegritas(db(), { kini: menit(6), kirim: ok, penerima })).toBeNull();
    expect(ok).toHaveBeenCalledTimes(1);
  });
});

// ─── 7. Halaman publik, detak, kunci ────────────────────────────────────────

describe("halaman publik dan detak", () => {
  it("halaman publik: kata judol terdeteksi, imbauan resmi tidak; halaman yang sudah bersih menutup temuannya; galat jaringan tidak melempar", async () => {
    const url = "https://pa-contoh.go.id/";
    const kotor = { status: 200, teks: "<html>SLOT GACOR dan TOGEL maxwin hari ini</html>" };
    const bersih = { status: 200, teks: "<html>Waspada judi online. Jadwal sidang hari ini.</html>" };
    let jawaban: { status: number; teks: string } | "putus" = kotor;
    const ambil = async () => {
      if (jawaban === "putus") throw new Error("ENOTFOUND");
      return jawaban;
    };
    const p = { halamanPublik: [url] };
    expect(await pindaiHalamanPublik(db(), p, { ambil, kini: KINI })).toMatchObject({ diperiksa: 1, temuanBaru: 1 });
    const t = await daftarTemuan(db(), { status: "baru" });
    expect(t).toHaveLength(1);
    expect(t[0]).toMatchObject({ folderId: FOLDER_HALAMAN, jenis: "kata-judol", jalur: url, folderNama: "Halaman publik" });
    expect(await pindaiHalamanPublik(db(), p, { ambil, kini: menit(5) })).toMatchObject({ temuanBaru: 0 });

    jawaban = "putus";
    expect(await pindaiHalamanPublik(db(), p, { ambil, kini: menit(10) })).toMatchObject({ diperiksa: 0, galat: expect.stringContaining("tidak dapat dijangkau") });
    expect(await daftarTemuan(db(), { status: "baru" })).toHaveLength(1);

    jawaban = bersih;
    await pindaiHalamanPublik(db(), p, { ambil, kini: menit(20) });
    expect(await daftarTemuan(db(), { status: "baru" })).toHaveLength(0);
    expect((await daftarTemuan(db(), { status: "ditangani" }))[0].tanganiOleh).toContain("halaman sudah bersih");
  });

  it("detak: saklar MATI = tidak membaca folder dan tidak mencatat apa pun; menyala = pindai awal, lalu menunggu selang", async () => {
    const { dir } = buatWebsite();
    await simpanPengaturanIntegritas(db(), { aktif: false, folder: [folderUji(dir)] }, { id: "u-sa", nama: "SA" }, { kini: KINI });
    expect(await detakIntegritas(db(), { kini: menit(1) })).toBeNull();
    expect(await db().queryAll("SELECT * FROM aleta_integritas_pindai")).toEqual([]);
    expect(await db().queryAll("SELECT * FROM aleta_integritas_berkas")).toEqual([]);

    await simpanPengaturanIntegritas(db(), { aktif: true, peringatanWa: false }, { id: "u-sa", nama: "SA" }, { kini: menit(2), cekFolder: false });
    const h1 = await detakIntegritas(db(), { kini: menit(3) });
    expect(h1?.folder[0]).toMatchObject({ jenis: "awal" });
    expect(await detakIntegritas(db(), { kini: menit(4) })).toBeNull();
    expect(await detakIntegritas(db(), { kini: menit(3 + 359) })).toBeNull();
    const h2 = await detakIntegritas(db(), { kini: menit(3 + 361) });
    expect(h2?.folder[0]).toMatchObject({ jenis: "rutin", temuanBaru: 0 });
  });

  it("detak mingguan melakukan pindai penuh; pindai bersamaan ditolak (kunci)", async () => {
    const { dir } = buatWebsite();
    await nyalakan(dir, { peringatanWa: false });
    await detakIntegritas(db(), { kini: menit(1) });
    const seminggu = await detakIntegritas(db(), { kini: new Date(KINI.getTime() + 8 * 86_400_000) });
    expect(seminggu?.folder[0].jenis).toBe("penuh");

    const pertama = pindaiSemua(db(), { kini: () => menit(2) });
    await expect(pindaiSemua(db())).rejects.toThrow(/sedang berjalan/);
    await pertama;
    await expect(pindaiSemua(db(), { kini: () => menit(3) })).resolves.toBeTruthy();
  });
});

// ─── 8. Pusat kesehatan dan rute ────────────────────────────────────────────

describe("Pusat kesehatan", () => {
  it("kelabu bila mati; hijau bila bersih; MERAH bila ada temuan baru; kuning bila belum memindai atau galat", () => {
    const kini = menit(60);
    expect(periksaIntegritas(null, kini).warna).toBe("kelabu");
    const dasar = { aktif: true, folder: 1, halaman: 0, temuanBaru: 0, perJenis: [], pindaiTerakhir: "", galatTerakhir: "" };
    expect(periksaIntegritas({ ...dasar, aktif: false }, kini).warna).toBe("kelabu");
    expect(periksaIntegritas(dasar, kini).warna).toBe("kuning");
    expect(periksaIntegritas({ ...dasar, pindaiTerakhir: KINI.toISOString() }, kini).warna).toBe("hijau");
    expect(periksaIntegritas({ ...dasar, pindaiTerakhir: KINI.toISOString(), galatTerakhir: "folder tidak terbaca" }, kini).warna).toBe("kuning");
    const merah = periksaIntegritas({ ...dasar, pindaiTerakhir: KINI.toISOString(), temuanBaru: 2, perJenis: [{ label: "Pola webshell", jumlah: 2 }] }, kini);
    expect(merah.warna).toBe("merah");
    expect(merah.rincian).toEqual(expect.arrayContaining([{ label: "Pola webshell", nilai: "2" }]));
  });

  it("ringkasIntegritas membaca temuan baru per jenis dan pindai terakhir dari basis data", async () => {
    const { dir } = buatWebsite();
    await nyalakan(dir);
    await pindaiFolder(db(), folderUji(dir), lewati, "otomatis", { kini: () => KINI });
    const r = await ringkasIntegritas(db());
    expect(r).toMatchObject({ aktif: true, folder: 1, temuanBaru: 5 });
    expect(r.perJenis.map((x) => x.label).sort()).toEqual(["Kata judi online", "Kode PHP di dalam berkas non-PHP", "Konfigurasi server mencurigakan", "PHP di folder unggahan", "Pola webshell"]);
    expect(r.pindaiTerakhir).toBe(KINI.toISOString());
  });
});

describe("rute", () => {
  const dari = (id: string, metode: string, badan?: unknown) => ({
    method: metode,
    headers: { "x-aleta-user-id": id, "content-type": "application/json" },
    body: badan === undefined ? undefined : JSON.stringify(badan),
  });

  it("hak: hakim ditolak semua; Admin melihat (jalur folder disembunyikan) tetapi tidak mengatur/memindai/menandai", async () => {
    const { dir } = buatWebsite();
    await nyalakan(dir);
    const rute = await import("@/app/api/admin/integritas/route");
    const temuanRute = await import("@/app/api/admin/integritas/temuan/route");
    const pindaiRute = await import("@/app/api/admin/integritas/pindai/route");

    expect((await rute.GET(req("/api/admin/integritas", dari("u-hakim", "GET")))).status).toBe(403);
    const admin = await rute.GET(req("/api/admin/integritas", dari("u-admin", "GET")));
    expect(admin.status).toBe(200);
    const isiAdmin = (await admin.json()) as { data: { boleh: boolean; pengaturan: { folder: Array<{ jalur: string }> } } };
    expect(isiAdmin.data.boleh).toBe(false);
    expect(isiAdmin.data.pengaturan.folder[0].jalur).toBe("(disembunyikan)");
    expect(JSON.stringify(isiAdmin)).not.toContain(dir.replace(/\\/g, "/"));

    expect((await rute.POST(req("/api/admin/integritas", dari("u-admin", "POST", { aktif: false })))).status).toBe(403);
    expect((await temuanRute.POST(req("/api/admin/integritas/temuan", dari("u-admin", "POST", { id: "x", aksi: "ditangani" })))).status).toBe(403);
    expect((await pindaiRute.POST(req("/api/admin/integritas/pindai", dari("u-admin", "POST", {})))).status).toBe(403);
  });

  it("Super Admin: simpan (folder nyata), pindai butuh saklar menyala, tandai ditangani; semuanya tercatat di audit", async () => {
    const { dir } = buatWebsite();
    const rute = await import("@/app/api/admin/integritas/route");
    const temuanRute = await import("@/app/api/admin/integritas/temuan/route");
    const pindaiRute = await import("@/app/api/admin/integritas/pindai/route");

    const salah = await rute.POST(req("/api/admin/integritas", dari("u-sa", "POST", { folder: [{ jalur: "/etc" }] })));
    expect(salah.status).toBe(400);

    const mati = await pindaiRute.POST(req("/api/admin/integritas/pindai", dari("u-sa", "POST", {})));
    expect(mati.status).toBe(400);

    const simpan = await rute.POST(req("/api/admin/integritas", dari("u-sa", "POST", { aktif: false, folder: [folderUji(dir)], peringatanWa: false })));
    expect(simpan.status).toBe(200);
    expect((await pindaiRute.POST(req("/api/admin/integritas/pindai", dari("u-sa", "POST", {})))).status).toBe(400);

    await rute.POST(req("/api/admin/integritas", dari("u-sa", "POST", { aktif: true })));
    await pindaiFolder(db(), folderUji(dir), lewati, "otomatis", { kini: () => KINI });
    const baca = (await (await rute.GET(req("/api/admin/integritas", dari("u-sa", "GET")))).json()) as {
      data: { boleh: boolean; temuan: Array<{ id: string; status: string }>; pengaturan: { folder: Array<{ jalur: string }> } };
    };
    expect(baca.data.boleh).toBe(true);
    expect(baca.data.pengaturan.folder[0].jalur).toBe(dir.replace(/\\/g, "/"));
    expect(baca.data.temuan.length).toBe(5);

    const id = baca.data.temuan[0].id;
    const tandai = await temuanRute.POST(req("/api/admin/integritas/temuan", dari("u-sa", "POST", { id, aksi: "ditangani" })));
    expect(tandai.status).toBe(200);
    expect((await temuanRute.POST(req("/api/admin/integritas/temuan", dari("u-sa", "POST", { id, aksi: "gaib" })))).status).toBe(400);

    const audit = (await db().queryAll<{ action: string }>("SELECT action FROM audit_logs ORDER BY action")).map((a) => a.action);
    expect(audit).toEqual(expect.arrayContaining(["INTEGRITAS_DITANGANI", "UPDATE_PENJAGA_INTEGRITAS"]));
  });
});
