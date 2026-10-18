import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * 18 Okt 2026 (1.205.7): "tahun tahun". Variabel umur memuat satuannya sendiri ("17 tahun", "18 tahun 3 bulan"):
 *   - 0607 / 0601 (umur calon mempelai wanita / pria, dispensasi kawin) - ABT lokal: 36 dari 38 dan 26 dari 28 isian memuat "tahun";
 *   - 7211 / 7212 (umur laki-laki / perempuan saat menikah, itsbat) - bawaan ABT (#10104#/#10105#) menambahkan ' tahun' sendiri,
 *     usulan ALETA juga "N tahun" (238 dari 279 isian ABT lokal memuat "tahun").
 * Katalog saksi tidak boleh menulis kata "tahun" lagi sesudah variabel itu. #0099# (umur dari get_umur()) hanya angka, jadi tetap diberi "tahun".
 */

const AKAR = path.resolve(process.cwd(), "..");
const DIR = path.join(AKAR, "ekstensi-sipp/saksi-katalog");
const BERSATUAN = ["0607", "0601", "7211", "7212"];

const berkas = readdirSync(DIR).filter((f) => f.endsWith(".json"));

describe("katalog saksi: tidak ada 'tahun' sesudah variabel umur yang sudah bersatuan", () => {
  it("ada katalog yang diperiksa", () => {
    expect(berkas.length).toBeGreaterThanOrEqual(25);
  });

  for (const f of berkas) {
    it(`${f}: tanpa '#0607# tahun', '#0601# tahun', '#7211# tahun', '#7212# tahun'`, () => {
      const teks = readFileSync(path.join(DIR, f), "utf8");
      const pola = new RegExp(`#(?:${BERSATUAN.join("|")})#\\s*(?:\\([^)]{0,30}\\)\\s*)?(?:tahun|th\\.?|thn)\\b`, "gi");
      expect(teks.match(pola) || []).toEqual([]);
    });
  }

  it("variabel umur dari get_umur() (#0099#, hanya angka) tetap diikuti 'tahun'", () => {
    const teks = readFileSync(path.join(DIR, "pengangkatan-anak.json"), "utf8");
    expect(teks).toMatch(/#0099# tahun/);
  });

  it("susunan dispensasi kawin: umur calon mempelai tertulis sekali, mis. 'berumur 17 tahun'", () => {
    const kat = JSON.parse(readFileSync(path.join(DIR, "dispensasi-kawin.json"), "utf8"));
    const semua = JSON.stringify(kat);
    expect(semua).toMatch(/#0607#/);
    expect(semua).toMatch(/#0601#/);
    // Setelah ganti #0607# -> "17 tahun" tidak ada "tahun tahun" di mana pun.
    const isi = semua.replace(/#(?:0607|0601)#/g, "17 tahun");
    expect(isi).not.toMatch(/tahun\s+tahun/i);
  });

  it("itsbat nikah dan kumulasinya: umur saat menikah tertulis sekali", () => {
    for (const f of ["itsbat-nikah.json", "cerai-kumulasi-itsbat.json", "asal-usul-anak.json"]) {
      const isi = readFileSync(path.join(DIR, f), "utf8").replace(/#(?:7211|7212)#/g, "21 tahun");
      expect(isi, f).not.toMatch(/tahun\s+tahun/i);
    }
  });
});
