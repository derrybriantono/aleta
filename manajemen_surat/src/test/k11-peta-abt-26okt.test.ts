// @vitest-environment node
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { pernyataanTingkatAtas } from "../../scripts/k11-peta.mjs";

/**
 * ============================================================================
 * K11 tahap 3 (26 Okt 2026) - abt.js DIPECAH: TIDAK ADA PERNYATAAN YANG HILANG
 * ============================================================================
 *
 * Sama dengan k11-peta-fitur-26okt.test.ts untuk konten.js: abt.js (1,0 MB, dimuat di tiap
 * halaman ABT) dipecah menjadi inti + abt-panel-bersama.js + abt-panel-blangko.js +
 * abt-panel-beranda.js, dimuat modul-malas.js hanya di halaman blangko / tanya-jawab / beranda.
 */

process.env.ALETA_KONTEN_MENTAH = "1";

const AKAR = path.resolve(process.cwd(), "..");
const EKS = path.join(AKAR, "ekstensi-sipp");
const baca = (b: string) => readFileSync(path.join(EKS, b), "utf8").replace(/\r\n/g, "\n");
const sebelum = JSON.parse(readFileSync(path.join(process.cwd(), "src/test/fixtures/k11-peta-fitur-sebelum.json"), "utf8")) as {
  berkas: Record<string, { pernyataan?: string[] }>;
};
const PECAHAN = ["abt.js", "abt-panel-bersama.js", "abt-panel-blangko.js", "abt-panel-beranda.js"];
const sidikPendek = (t: string) => createHash("sha1").update(t).digest("hex").slice(0, 12);
const tanpaGuard = (teks: string) =>
  teks
    .split("\n")
    .filter((b) => !/K11-GUARD|K11-PRA/.test(b))
    .join("\n");

describe("peta fitur K11 (abt.js): pernyataan", () => {
  it("setiap pernyataan tingkat atas abt.js lama masih ada persis; hanya lem K11 yang bertambah", () => {
    const lama = new Map<string, number>();
    for (const h of sebelum.berkas["abt.js"].pernyataan!) lama.set(h, (lama.get(h) || 0) + 1);
    const baru = new Map<string, number>();
    const lem: string[] = [];
    for (const nama of PECAHAN) {
      for (const s of pernyataanTingkatAtas(tanpaGuard(baca(nama)))) {
        if (s.direktif) continue;
        if (s.jenis === "FunctionDeclaration" && ["modulAbtSiap", "pastikanModulAbt"].includes(s.nama[0])) {
          lem.push(s.nama[0]);
          continue;
        }
        if (s.jenis === "ExpressionStatement" && s.teks.includes("__aletaModulSelesai")) {
          lem.push("selesai");
          continue;
        }
        const k = sidikPendek(s.teks);
        baru.set(k, (baru.get(k) || 0) + 1);
      }
    }
    expect(lem.sort()).toEqual(["modulAbtSiap", "pastikanModulAbt", "selesai", "selesai", "selesai"]);
    const hilang: string[] = [];
    const tambah: string[] = [];
    for (const [k, n] of lama) if ((baru.get(k) || 0) !== n) hilang.push(k);
    for (const [k, n] of baru) if ((lama.get(k) || 0) !== n) tambah.push(k);
    expect({ hilang, tambah }).toEqual({ hilang: [], tambah: [] });
  });

  it("empat berkas tidak mendefinisikan nama yang sama dua kali", () => {
    const sudah = new Map<string, string>();
    const ganda: string[] = [];
    for (const nama of PECAHAN)
      for (const s of pernyataanTingkatAtas(baca(nama)))
        for (const n of s.nama) {
          if (sudah.has(n)) ganda.push(`${n}: ${sudah.get(n)} & ${nama}`);
          else sudah.set(n, nama);
        }
    expect(ganda).toEqual([]);
  });
});

describe("peta fitur K11 (abt.js): pintu antar-modul", () => {
  const require = createRequire(import.meta.url);
  const acorn = require("acorn");
  const escope = require("eslint-scope");
  function analisa(nama: string) {
    const ast = acorn.parse(baca(nama), { ecmaVersion: "latest", sourceType: "script", ranges: true, locations: true });
    const sm = escope.analyze(ast, { ecmaVersion: 2022, sourceType: "script" });
    const didefinisikan = new Set<string>();
    for (const v of sm.globalScope.variables) if (v.defs.length) didefinisikan.add(v.name);
    const dirujuk = new Set<string>(sm.globalScope.through.map((r: { identifier: { name: string } }) => r.identifier.name));
    return { didefinisikan, dirujuk };
  }
  const a = Object.fromEntries(PECAHAN.map((n) => [n, analisa(n)]));
  const rujukan = (dari: string, ke: string) => [...a[dari].dirujuk].filter((n) => a[ke].didefinisikan.has(n)).sort();

  it("inti hanya merujuk titik-masuk panel blangko dan panel beranda", () => {
    expect(rujukan("abt.js", "abt-panel-bersama.js")).toEqual([]);
    expect(rujukan("abt.js", "abt-panel-blangko.js")).toEqual(["pasangPenjagaCetak", "pasangSunting", "soreTataAman", "susunPanelAbt", "t6TataAman"]);
    expect(rujukan("abt.js", "abt-panel-beranda.js")).toEqual(["soreTataBerandaAman", "susunPanelMassalAbt"]);
  });

  it("modul tidak merujuk ke atas: bersama tidak ke blangko/beranda; blangko dan beranda tidak saling", () => {
    expect(rujukan("abt-panel-bersama.js", "abt-panel-blangko.js")).toEqual([]);
    expect(rujukan("abt-panel-bersama.js", "abt-panel-beranda.js")).toEqual([]);
    expect(rujukan("abt-panel-blangko.js", "abt-panel-beranda.js")).toEqual([]);
    expect(rujukan("abt-panel-beranda.js", "abt-panel-blangko.js")).toEqual([]);
  });

  it("titik-masuk dipanggil hanya sesudah penunggu modulnya (pasang dan pasangMassalAbt)", () => {
    const isi = baca("abt.js");
    const pasang = isi.slice(isi.indexOf("async function pasang() {"), isi.indexOf("let saklarCetakDibaca"));
    const guard = pasang.indexOf('pastikanModulAbt("abt-blangko")');
    expect(guard).toBeGreaterThan(0);
    for (const n of ["pasangSunting(", "susunPanelAbt(", "pasangPenjagaCetak(", "t6TataAman(", "soreTataAman("]) {
      expect(pasang.indexOf(n), n).toBeGreaterThan(guard);
    }
    const awalMassal = isi.indexOf("async function pasangMassalAbt() {");
    const batas = isi.slice(awalMassal, awalMassal + 1800);
    const g2 = batas.indexOf('pastikanModulAbt("abt-beranda")');
    expect(g2).toBeGreaterThan(0);
    expect(batas.indexOf("susunPanelMassalAbt(")).toBeGreaterThan(g2);
    expect(batas.indexOf("soreTataBerandaAman(")).toBeGreaterThan(g2);
    // pemasangan ganda dicegah: sudahDipasang diperiksa lagi sesudah menunggu
    expect(pasang).toMatch(/pastikanModulAbt\("abt-blangko"\)\)\) return; \/\/ K11-GUARD\n\s+if \(sudahDipasang\) return;/);
  });

  it("tanda waktu muat halaman (A1_MUAT_MS = Date.now()) tetap di inti, bukan di modul yang disuntik belakangan", () => {
    expect(baca("abt.js")).toContain("const A1_MUAT_MS = Date.now();");
    for (const n of PECAHAN.slice(1)) expect(baca(n)).not.toContain("A1_MUAT_MS = Date.now()");
  });
});

describe("modul malas ABT terdaftar", () => {
  it("manifest ABT memuat modul-malas.js sebelum abt.js, dan modul abt-* tidak ada di manifest", () => {
    const m = JSON.parse(baca("manifest.json")) as { content_scripts: Array<{ js?: string[] }> };
    const js = m.content_scripts.find((x) => (x.js || []).includes("abt.js"))!.js!;
    expect(js.indexOf("modul-malas.js")).toBeGreaterThanOrEqual(0);
    expect(js.indexOf("modul-malas.js")).toBeLessThan(js.indexOf("abt.js"));
    for (const n of PECAHAN.slice(1)) expect(m.content_scripts.flatMap((x) => x.js || [])).not.toContain(n);
    const pemuat = baca("modul-malas.js");
    expect(pemuat).toContain('"abt-blangko": modul(["abt-bersama"], ["abt-panel-blangko.js"])');
    expect(pemuat).toContain('"abt-beranda": modul(["abt-bersama"], ["abt-panel-beranda.js"])');
    const latar = baca("latar.js");
    for (const n of PECAHAN.slice(1)) expect(latar).toContain(`"${n}"`);
  });
});
