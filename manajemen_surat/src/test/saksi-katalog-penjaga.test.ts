// @vitest-environment node
import { createRequire } from "node:module";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

import { describe, expect, it } from "vitest";

/**
 * ============================================================================
 * PENJAGA KATALOG SUSUN SAKSI
 * ============================================================================
 *
 * Setiap katalog (ekstensi-sipp/saksi-katalog/*.json, disalin dari folder
 * kerja D:/aleta-dev/kerja/saksi/katalog/) HARUS lolos skema saksi-katalog/1:
 *   - bentuk, dasar hukum bersumber, pokok pembuktian bertaut ke pertanyaan;
 *   - setiap jawaban punya >= 4 varian saksi 1 dan >= 4 varian saksi 2
 *     dengan maksud sama dan kalimat berbeda;
 *   - penanda #nnnn# ada di kamus variabel ABT (atau dideklarasikan sebagai
 *     variabel baru), slot hanya yang baku, tanpa kata Aleta.
 * Berkas data ekstensi (saksi-katalog-data.js) DIHASILKAN dari folder itu oleh
 * scripts/susun-saksi-katalog.mjs; uji ini menuntut keduanya sama.
 */

const REPO = path.resolve(__dirname, "../../..");
const AKAR = path.join(REPO, "ekstensi-sipp");
const FOLDER = path.join(AKAR, "saksi-katalog");
const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-require-imports
const Mesin = require(path.join(AKAR, "saksi-katalog.js")) as any;

const KERJA = process.env.ALETA_SAKSI_KERJA || "D:/aleta-dev/kerja/saksi/katalog";
const KAMUS = process.env.ALETA_ABT_VARIABEL || "D:/Aplikasi/aleta/tmp/abt-variabel.json";

const variabelAda: Set<string> | null = existsSync(KAMUS) ? new Set(Object.keys(JSON.parse(readFileSync(KAMUS, "utf8")))) : null;

const berkasRepo = readdirSync(FOLDER)
  .filter((n) => n.endsWith(".json"))
  .sort();

describe("katalog di repo lolos skema", () => {
  it("ada sedikitnya cerai gugat dan cerai talak", () => {
    expect(berkasRepo).toContain("cerai-gugat.json");
    expect(berkasRepo).toContain("cerai-talak.json");
  });

  for (const nama of berkasRepo) {
    it(`${nama} lolos periksaKatalog (min 4 varian saksi 1 dan 4 varian saksi 2 di tiap jawaban)`, () => {
      const kat = JSON.parse(readFileSync(path.join(FOLDER, nama), "utf8"));
      expect(kat.contoh, "berkas contoh tidak ikut ke repo").not.toBe(true);
      const r = Mesin.periksaKatalog(kat, { namaBerkas: nama, variabelAda });
      expect(r.galat, `${nama}:\n${r.galat.slice(0, 12).join("\n")}`).toEqual([]);
      // katalog tambahan arah Tergugat sengaja kecil (butir pengganti saja); katalog utama minimal 10 butir
      expect(Mesin.ringkasKatalog(kat).pertanyaan).toBeGreaterThanOrEqual(kat.tambahanUntuk ? 5 : 10);
    });
  }

  it("tidak ada dua katalog UTAMA yang berebut satu jenis perkara tanpa pembeda; tambahan menunjuk katalog utama yang ada", () => {
    const katalog = berkasRepo.map((n) => JSON.parse(readFileSync(path.join(FOLDER, n), "utf8")));
    const tabel = new Map<string, string[]>();
    for (const k of katalog.filter((x: any) => !x.tambahanUntuk)) {
      for (const id of k.syarat.jenisPerkaraId.map(String)) {
        const kunciAlur = (k.syarat.alurPerkaraId ?? []).join(",") || "*";
        const pembeda = k.syarat.polaNama ? `pola:${k.syarat.polaNama}` : "";
        const kunci = `${id}|${kunciAlur}|${pembeda}`;
        tabel.set(kunci, [...(tabel.get(kunci) ?? []), k.kunci]);
      }
    }
    for (const [kunci, pemilik] of tabel) expect(pemilik, `jenis ${kunci}`).toHaveLength(1);
    const kunciUtama = new Set(katalog.filter((x: any) => !x.tambahanUntuk).map((x: any) => x.kunci));
    for (const t of katalog.filter((x: any) => x.tambahanUntuk)) for (const u of t.tambahanUntuk) expect(kunciUtama.has(u), `${t.kunci} -> ${u}`).toBe(true);
  });

  it("katalog utama yang digabung dengan tambahannya tetap lolos skema (id tak kembar, urutan tak bentrok)", () => {
    const katalog = berkasRepo.map((n) => JSON.parse(readFileSync(path.join(FOLDER, n), "utf8")));
    for (const u of katalog.filter((x: any) => !x.tambahanUntuk)) {
      const gabung = Mesin.gabungKatalog(u, katalog);
      if (!gabung.digabungDari) continue;
      const r = Mesin.periksaKatalog(gabung, { variabelAda });
      expect(r.galat, `${u.kunci} + ${gabung.digabungDari}`).toEqual([]);
    }
  });

  it("rujukan hukum yang perlu-verifikasi tidak tercetak di teks keluaran mana pun", () => {
    for (const nama of berkasRepo) {
      const k = JSON.parse(readFileSync(path.join(FOLDER, nama), "utf8"));
      const keluaran = JSON.stringify({ p: k.pertanyaan, u: k.jawabanUmum, c: k.catatanPetugas }).toLowerCase();
      for (const d of k.dasarHukum.filter((x: any) => x.status === "perlu-verifikasi")) expect(keluaran, `${nama}: ${d.rujukan}`).not.toContain(String(d.rujukan).toLowerCase());
    }
  });

  it("kata 'Aleta' tidak ada di seluruh isi katalog", () => {
    for (const nama of berkasRepo) expect(readFileSync(path.join(FOLDER, nama), "utf8"), nama).not.toMatch(/aleta/i);
  });
});

describe("data ekstensi = hasil susun katalog", () => {
  it("saksi-katalog-data.js sama persis dengan keluaran scripts/susun-saksi-katalog.mjs", () => {
    // dijalankan sebagai proses terpisah: modul ESM dengan jalur ber-spasi dan junction tidak dimuat vite
    const harap = execFileSync(process.execPath, [path.join(REPO, "manajemen_surat/scripts/susun-saksi-katalog.mjs"), "--stdout"], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }).replace(/\r\n/g, "\n");
    const nyata = readFileSync(path.join(AKAR, "saksi-katalog-data.js"), "utf8").replace(/\r\n/g, "\n");
    expect(nyata === harap, "jalankan: node scripts/susun-saksi-katalog.mjs").toBe(true);
  });

  it("data dapat dimuat sebagai skrip ekstensi dan setiap katalognya dikenali mesin", () => {
    const g: any = {};
    const jalankan = new Function("globalThis", readFileSync(path.join(AKAR, "saksi-katalog-data.js"), "utf8"));
    jalankan(g);
    const data = g.ALETA_SAKSI_KATALOG_DATA as any[];
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBe(berkasRepo.length);
    for (const kat of data) {
      const k = Mesin.kenaliKatalog(data, { jenisPerkaraId: kat.syarat.jenisPerkaraId[0], alurPerkaraId: (kat.syarat.alurPerkaraId ?? [""])[0], nama: kat.judul });
      expect(k, kat.kunci).toBeTruthy();
    }
  });

  it("ekstensi: tiga skrip baru terdaftar di penanaman dan dimuat di ABT sebelum abt.js", () => {
    const tanam = readFileSync(path.join(REPO, "manajemen_surat/scripts/susun-ekstensi.mjs"), "utf8");
    for (const f of ["saksi-katalog.js", "saksi-katalog-data.js", "saksi-susun.js"]) expect(tanam, f).toContain(`"${f}"`);
    expect(tanam).toContain('"saksi-katalog/"');
    const manifest = JSON.parse(readFileSync(path.join(AKAR, "manifest.json"), "utf8"));
    const abt = manifest.content_scripts.find((c: any) => c.js.includes("abt.js"));
    const urut = abt.js as string[];
    expect(urut.indexOf("saksi-katalog.js")).toBeGreaterThanOrEqual(0);
    expect(urut.indexOf("saksi-katalog.js")).toBeLessThan(urut.indexOf("saksi-katalog-data.js"));
    expect(urut.indexOf("saksi-katalog-data.js")).toBeLessThan(urut.indexOf("saksi-susun.js"));
    expect(urut.indexOf("saksi-susun.js")).toBeLessThan(urut.indexOf("abt.js"));
  });
});

describe("katalog di folder kerja yang disalin ke repo", () => {
  const adaKerja = existsSync(KERJA);
  const berkasKerja = adaKerja ? readdirSync(KERJA).filter((n) => n.endsWith(".json")).sort() : [];

  it.skipIf(!adaKerja)("contoh.json (bentuk acuan skema) lolos", () => {
    const kat = JSON.parse(readFileSync(path.join(KERJA, "contoh.json"), "utf8"));
    expect(kat.contoh).toBe(true);
    expect(Mesin.periksaKatalog(kat, { namaBerkas: "contoh.json", variabelAda }).galat).toEqual([]);
  });

  for (const nama of berkasKerja.filter((n) => n !== "contoh.json" && berkasRepo.includes(n))) {
    it(`salinan kerja ${nama} lolos skema`, () => {
      const kerja = JSON.parse(readFileSync(path.join(KERJA, nama), "utf8"));
      expect(Mesin.periksaKatalog(kerja, { namaBerkas: nama, variabelAda }).galat, nama).toEqual([]);
    });
  }
});
