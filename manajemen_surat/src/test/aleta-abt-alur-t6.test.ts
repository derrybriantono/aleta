// @vitest-environment node
/**
 * ============================================================================
 * MIGRASI 0137 DAN PENDAFTARAN (5 Nov 2026, Tahap 6 dan 7)
 * ============================================================================
 *   1. migrasi 0137 = DDL schema.ts = urutan penyimpanan; jurnal idx 119 sesudah 0136; tanpa kunci asing; tanpa kolom isi naskah;
 *   2. semua saklar bawaan MATI (persetujuan matriks hak, tulis ke luar, berdampingan);
 *   3. semua rute baru menjaga Super Admin di server dan mencatat audit; tanpa tulisan ke SIPP/ABT di modul baru selain lewat rute yang sudah ada;
 *   4. tidak satu kata "Aleta" tertulis ke sistem luar (nama berkas unggahan dan isi formulir yang dikirim ke e-Doc/e-Court);
 *   5. hak-akses-peta memuat dua entri baru hanya untuk Super Admin.
 */
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { susunPetaHakAkses } from "@/lib/hak-akses-peta";
import { DDL_ALETA_ABT_ALUR } from "@/server/db/schema";

const M = process.cwd();
const BACA = (p: string) => readFileSync(path.join(M, p), "utf8");
const SQL_0137 = BACA("drizzle/0137_aleta_abt_alur_berdampingan.sql");
const JURNAL = JSON.parse(BACA("drizzle/meta/_journal.json")) as { entries: Array<{ idx: number; when: number; tag: string }> };
const KLIEN = BACA("src/server/db/client.ts");
const rapat = (s: string) => s.replace(/--.*$/gm, "").replace(/\s+/g, " ").replace(/\( /g, "(").replace(/ \)/g, ")").trim();

describe("migrasi 0137", () => {
  it("SQL = DDL schema.ts; jurnal idx 119 sesudah 0136; terdaftar di urutan penyimpanan; tanpa kunci asing", () => {
    expect(DDL_ALETA_ABT_ALUR.tabel.map(rapat)).toEqual(SQL_0137.match(/CREATE TABLE IF NOT EXISTS [^;]+/g)!.map(rapat));
    expect(DDL_ALETA_ABT_ALUR.indeks.map(rapat)).toEqual(SQL_0137.match(/CREATE (?:UNIQUE )?INDEX IF NOT EXISTS [^;]+/g)!.map(rapat));
    const e = JURNAL.entries;
    const i = e.findIndex((x) => x.tag === "0137_aleta_abt_alur_berdampingan");
    expect(e[i]).toMatchObject({ idx: 119 });
    expect(e[i - 1].tag).toBe("0136_aleta_abt_banding");
    expect(e[i].when).toBeGreaterThan(e[i - 1].when);
    expect(new Set(e.map((x) => x.idx)).size).toBe(e.length);
    expect(KLIEN).toContain('"aleta_abt_selesai"');
    expect(KLIEN).toContain('"aleta_abt_berdampingan"');
    expect(SQL_0137).not.toMatch(/REFERENCES|FOREIGN KEY/i);
  });
  it("tabel berdampingan tidak punya kolom untuk isi naskah, kalimat, atau nama pihak; tabel selesai tidak menyimpan PDF", () => {
    const berdampingan = SQL_0137.slice(SQL_0137.indexOf("CREATE TABLE IF NOT EXISTS aleta_abt_berdampingan"));
    const kolom = [...berdampingan.matchAll(/^\s+([a-z_]+) (?:TEXT|INTEGER)/gm)].map((m) => m[1]);
    expect(kolom).toEqual(
      expect.arrayContaining(["berkas_nama", "folder", "jenis_perkara", "jenis_naskah", "perkara_id", "hasil", "per_kelas", "nomor_beda"])
    );
    for (const k of kolom) expect(k, k).not.toMatch(/isi|teks|kalimat|nama_pihak|pihak|naskah_|pdf|rtf|bagian/);
    const selesai = SQL_0137.slice(SQL_0137.indexOf("CREATE TABLE IF NOT EXISTS aleta_abt_selesai"), SQL_0137.indexOf("CREATE TABLE IF NOT EXISTS aleta_abt_berdampingan"));
    expect(selesai).not.toMatch(/pdf|isi |naskah/i);
  });
});

describe("saklar bawaan mati", () => {
  const baca = (p: string) => BACA(p);
  it("persetujuan matriks, tulis ke luar, dan berdampingan bawaan mati", () => {
    expect(baca("src/server/modules/aleta-abt-alur/hak-folder.ts")).toContain("const BAWAAN: Persetujuan = { disetujui: false");
    expect(baca("src/server/modules/aleta-abt-selesai/service.ts")).toMatch(/"edoc-sipp": !mati && t\?\.\["edoc-sipp"\] === true/);
    expect(baca("src/server/modules/aleta-abt-selesai/service.ts")).toMatch(/ecourt: !mati && t\?\.ecourt === true/);
    expect(baca("src/server/modules/aleta-abt-berdampingan/service.ts")).toMatch(/aktif: !mati && t\?\.aktif === true/);
  });
  it("tidak ada kode yang menyalakan saklar kecuali rute yang diminta Super Admin", () => {
    const akar = path.join(M, "src");
    const hasil: string[] = [];
    const jelajah = (d: string) => {
      for (const n of readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, n.name);
        if (n.isDirectory()) {
          if (n.name !== "test") jelajah(p);
        } else if (/\.(ts|tsx)$/.test(n.name)) {
          const s = readFileSync(p, "utf8");
          if (/simpanSaklarTulis\(|simpanSetelanBerdampingan\(|simpanPersetujuan\(/.test(s)) hasil.push(path.relative(akar, p).replace(/\\/g, "/"));
        }
      }
    };
    jelajah(akar);
    expect(hasil.sort()).toEqual([
      "app/api/aleta-abt/berdampingan/route.ts",
      "app/api/aleta-abt/hak-folder/route.ts",
      "app/api/aleta-abt/selesai/route.ts",
      "server/modules/aleta-abt-alur/hak-folder.ts",
      "server/modules/aleta-abt-berdampingan/service.ts",
      "server/modules/aleta-abt-selesai/service.ts",
    ]);
  });
});

describe("rute baru dijaga di server dan tercatat di audit", () => {
  const RUTE = ["siap", "hak-folder", "selesai", "berdampingan"];
  it.each(RUTE)("rute %s memakai penjaga Super Admin pada GET dan POST dan mencatat audit", (nama) => {
    const s = BACA(`src/app/api/aleta-abt/${nama}/route.ts`);
    expect(s).toContain("aktorSuperAdminAlur(request, PESAN)");
    expect((s.match(/aktorSuperAdminAlur\(request, PESAN\)/g) ?? []).length).toBe(2);
    expect(s).toContain("catatAlur(");
    expect(s).toContain("handleAdminRouteError");
    expect(s).toMatch(/export async function GET/);
  });
  it("penjaga memutuskan dari peran akun, bukan dari masukan permintaan", () => {
    const s = BACA("src/server/modules/aleta-abt-alur/penjaga.ts");
    expect(s).toContain('roleId !== "super-admin"');
    expect(s).toContain("throw new ApiError(403, pesan)");
    expect(s).not.toMatch(/searchParams|getSearchParam|headers\.get/);
    expect(s).toContain("getEffectiveRoleId(actor)");
  });
});

describe("tidak satu kata ALETA ke sistem luar", () => {
  it("berkas dan isian yang dikirim ke e-Doc SIPP dan e-Court tidak memuat nama aplikasi", () => {
    const s = BACA("src/server/modules/aleta-abt-selesai/service.ts");
    const kirim = s.slice(s.indexOf("export async function unggahEdocLewatRute"), s.indexOf("// Menjalankan"));
    // Yang dikirim ke luar: isian formulir dan nama berkas. (Alamat rute internal portal bukan isi kiriman.)
    const isian = kirim.split("\n").filter((b) => /\bf\.set\(|berkasPdf\(/.test(b));
    expect(isian.length).toBeGreaterThanOrEqual(5);
    for (const b of isian) expect(b, b).not.toMatch(/aleta/i);
    for (const nama of ['"putusan.pdf"', '"salinan.pdf"']) expect(kirim).toContain(nama);
  });
  it("pesan layar dan nama berkas tidak memuat tanda aplikasi di tempat yang dapat keluar (PDF, unggahan)", () => {
    const s = BACA("src/lib/aleta-abt-selesai.ts");
    expect(s).not.toMatch(/pdfBase64: "[^"]*aleta/i);
  });
});

describe("hak akses peta", () => {
  it("dua entri baru hanya untuk Super Admin: tidak satu golongan lain diberi hak", () => {
    const peta = susunPetaHakAkses();
    for (const id of ["alur-aleta-abt", "berdampingan-aleta-abt"]) {
      const e = peta.find((x) => x.id === `pengaturan.${id}`);
      expect(e, id).toBeTruthy();
      expect(e!.hak["super-admin"], id).toBe("U");
      for (const [g, t] of Object.entries(e!.hak)) if (g !== "super-admin") expect(t, `${id} ${g}`).toBeFalsy();
    }
  });
});
