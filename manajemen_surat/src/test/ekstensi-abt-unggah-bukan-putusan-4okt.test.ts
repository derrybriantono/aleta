// @vitest-environment node
/**
 * ============================================================================
 * 4 OKT 2026 - "UNGGAH PUTUSAN" TIDAK BOLEH ADA DI BLANGKO BAS / RELAAS
 * ============================================================================
 *
 * Sampai 1.181.0 bagian "Unggah putusan perkara ini ke SIPP" dan tombol kaki
 * "Kerjakan perkara ini" tampil di SEMUA halaman blangko ABT. Bila token
 * blangko halaman tidak cocok dengan pemetaan putusan, a1PilihBlangkoHalaman
 * jatuh ke "Blangko halaman ini (dari tautan CETAK)" - satu klik mengunggah
 * RTF BAS atau relaas sebagai putusan perkara.
 *
 * Perbaikan: a3BukanBlangkoPutusan() (BAS / relaas / pemberitahuan) -
 *   1. bagianUnggahSatuAbt tidak menggambar apa pun (kaki ikut hilang karena
 *      t6TataUnggah hanya jalan bila k.unggah ada);
 *   2. penjaga kedua di tombol bila halaman berganti isi tanpa muat ulang;
 *   3. langkah "Kerjakan" (abt-10) tanpa bagian Unggah tidak melempar.
 *
 * Pembukti gigitan: salinan bercacat lewat ALETA_UJI_ABT.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const EKSTENSI = path.resolve(process.cwd(), "../ekstensi-sipp");
function sumberAbt(): string {
  const alt = process.env.ALETA_UJI_ABT;
  return readFileSync(alt || path.join(EKSTENSI, "abt.js"), "utf8");
}

function ambilFungsi(s: string, nama: string): string {
  const i = s.indexOf(`function ${nama}(`);
  expect(i, `fungsi ${nama} tidak ada`).toBeGreaterThan(-1);
  const buka = s.indexOf("{", s.indexOf(")", i));
  let dalam = 0;
  for (let j = buka; j < s.length; j++) {
    if (s[j] === "{") dalam++;
    else if (s[j] === "}" && --dalam === 0) return s.slice(i, j + 1);
  }
  throw new Error(`badan ${nama} tidak tertutup`);
}

describe("unggah putusan hanya di blangko putusan (4 Okt)", () => {
  const s = sumberAbt();

  it("pola mengenali BAS, relaas, panggilan, pemberitahuan, PBT - dan tidak memotong blangko putusan", () => {
    const m = s.match(/const A3_POLA_BUKAN_PUTUSAN = \/(.+)\/([a-z]*);/);
    expect(m, "A3_POLA_BUKAN_PUTUSAN hilang").not.toBeNull();
    const pola = new RegExp((m as RegExpMatchArray)[1], (m as RegExpMatchArray)[2]);
    for (const bukan of ["BAS 1 Cerai Gugat", "Berita Acara Sidang", "Relaas Panggilan Sidang Pertama", "Panggilan Tergugat", "Pemberitahuan Isi Putusan", "PBT Verstek"]) {
      expect(pola.test(bukan), bukan).toBe(true);
    }
    for (const putusan of ["Putusan Cerai Gugat Verstek", "Putusan Cerai Talak Kabul", "Putusan Itsbat Nikah", "Putusan Hadhanah", "Putusan Ekonomi Syariah"]) {
      expect(pola.test(putusan), putusan).toBe(false);
    }
  });

  it("penjaga memakai halaman BAS sebagai syarat pertama, lalu pola nama (1.183.0: a3JenisBlangkoHalaman)", () => {
    expect(ambilFungsi(s, "a3BukanBlangkoPutusan")).toMatch(/a3JenisBlangkoHalaman\(\) === "bukan"/);
    const f = ambilFungsi(s, "a3JenisBlangkoHalaman");
    const iBas = f.indexOf("p7HalamanBas()");
    const iPola = f.indexOf("A3_POLA_BUKAN_PUTUSAN.test(nama)");
    const iMenu = f.indexOf("a3MenuHalaman(nama)");
    expect(iBas).toBeGreaterThan(-1);
    expect(iPola).toBeGreaterThan(iBas);
    expect(iMenu).toBeGreaterThan(iPola);
  });

  it("bagianUnggahSatuAbt pulang null SEBELUM membuat kotak", () => {
    const f = ambilFungsi(s, "bagianUnggahSatuAbt");
    const iJaga = f.indexOf('if (jenisHalaman === "bukan") return null;');
    const iJenis = f.indexOf("const jenisHalaman = a3JenisBlangkoHalaman();");
    const iKotak = f.indexOf('buatElemen("div", "aleta-abt-bagian")');
    expect(iJenis).toBeGreaterThan(-1);
    expect(iJaga).toBeGreaterThan(iJenis);
    expect(iKotak).toBeGreaterThan(iJaga);
  });

  it("tombol punya penjaga kedua sebelum membaca blangko", () => {
    const f = ambilFungsi(s, "bagianUnggahSatuAbt");
    const iKlik = f.indexOf('tombol.addEventListener("click"');
    const iJaga = f.indexOf("a3BukanBlangkoPutusan()", iKlik);
    const iJenis = f.indexOf("pilihBlangko.value", iKlik);
    expect(iJaga).toBeGreaterThan(iKlik);
    expect(iJenis).toBeGreaterThan(iJaga);
  });

  it("langkah Kerjakan tanpa bagian Unggah tidak melempar", () => {
    const f = ambilFungsi(s, "t6JalankanLangkah");
    const iKerja = f.indexOf('l.kunci === "kerjakan"');
    const iJaga = f.indexOf("if (!k.unggah) return;", iKerja);
    const iBaca = f.indexOf("k.unggah.querySelector", iKerja);
    expect(iJaga).toBeGreaterThan(iKerja);
    expect(iBaca).toBeGreaterThan(iJaga);
  });

  it("t6TataUnggah (kaki) hanya dipasang bila bagian Unggah ada", () => {
    expect(s).toMatch(/if \(k\.unggah\) t6TataUnggah\(k\);/);
  });
});
