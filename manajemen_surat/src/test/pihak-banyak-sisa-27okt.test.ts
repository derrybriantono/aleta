// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";

import { describe, expect, it } from "vitest";

import { SIPP_ADDITIONAL_QUERY_DEFINITIONS } from "@/server/modules/aleta-bot/sipp-additional-query-sources";

/**
 * Pihak banyak, sisa (27 Okt 2026):
 *  - sebutan pihak di kartu "Pekerjaan terbaca" (ekstensi) memakai angka romawi umum, bukan tabel yang berhenti di V;
 *  - sumber data "Pihak Lanjutan": perkara_pihak3 = pihak INTERVENSI, perkara_pihak4 = TURUT TERGUGAT.
 */

const AKAR = path.resolve(process.cwd(), "..");
const SUMBER = readFileSync(path.join(AKAR, "ekstensi-sipp/abt-panel-blangko.js"), "utf8").replace(/\r\n/g, "\n");

/** Mengeluarkan fungsi pkRomawi dan pkBarisPihak dari berkas ekstensi apa adanya, lalu menjalankannya. */
function muatKartu() {
  const ambil = (nama: string) => {
    const awal = SUMBER.indexOf(`function ${nama}(`);
    expect(awal, nama).toBeGreaterThan(-1);
    const tutup = SUMBER.indexOf("\n}\n", awal);
    return SUMBER.slice(awal, tutup + 3);
  };
  const ctx: Record<string, unknown> = { nilaiVariabel: (k: string) => (k === "0046" ? "Penggugat" : "Tergugat") };
  vm.createContext(ctx);
  vm.runInContext(`${ambil("pkRomawi")}\n${ambil("pkBarisPihak")}\nglobalThis.pkRomawi = pkRomawi; globalThis.pkBarisPihak = pkBarisPihak;`, ctx);
  return ctx as unknown as { pkRomawi: (n: unknown) => string; pkBarisPihak: (o: Record<string, unknown>) => string };
}

describe("angka romawi sebutan pihak (tanpa batas V)", () => {
  const { pkRomawi, pkBarisPihak } = muatKartu();

  it("urutan 1 tanpa angka; 2 dst. dengan spasi di depan, persis seperti dulu sampai V", () => {
    expect(pkRomawi(1)).toBe("");
    expect(pkRomawi(2)).toBe(" II");
    expect(pkRomawi(3)).toBe(" III");
    expect(pkRomawi(4)).toBe(" IV");
    expect(pkRomawi(5)).toBe(" V");
  });

  it("melewati V: 6 sampai 50 dan seterusnya", () => {
    const harapan: Record<number, string> = { 6: " VI", 7: " VII", 8: " VIII", 9: " IX", 10: " X", 11: " XI", 14: " XIV", 19: " XIX", 24: " XXIV", 39: " XXXIX", 40: " XL", 44: " XLIV", 49: " XLIX", 50: " L", 51: " LI", 99: " XCIX", 100: " C" };
    for (const [n, r] of Object.entries(harapan)) expect(pkRomawi(Number(n)), n).toBe(r);
  });

  it("masukan tak sah tidak menghasilkan angka (kosong/0/negatif/bukan angka/terlalu besar)", () => {
    for (const x of [0, -3, NaN, undefined, null, "abc", 4000]) expect(pkRomawi(x), String(x)).toBe("");
  });

  it("kartu: Tergugat ke-7 dan Penggugat ke-12 tertulis lengkap", () => {
    expect(pkBarisPihak({ pihakKe: 2, urutan: 7, nama: "A", kunci: "BUKAN", pekerjaan: "Petani", asal: "pilihan", kalimat: "-" })).toMatch(/^Tergugat VII - A:/);
    expect(pkBarisPihak({ pihakKe: 1, urutan: 12, nama: "B", kunci: "BUKAN", pekerjaan: "Petani", asal: "pilihan", kalimat: "-" })).toMatch(/^Penggugat XII - B:/);
    expect(pkBarisPihak({ pihakKe: 1, urutan: 1, nama: "C", kunci: "BUKAN", pekerjaan: "Petani", asal: "pilihan", kalimat: "-" })).toMatch(/^Penggugat - C:/);
  });

  it("tabel lama yang berhenti di V sudah tidak ada", () => {
    expect(SUMBER).not.toMatch(/PK_ROMAWI\[/);
  });
});

describe("sumber data Pihak Lanjutan: intervensi = perkara_pihak3, turut tergugat = perkara_pihak4", () => {
  const ambil = (id: string) => SIPP_ADDITIONAL_QUERY_DEFINITIONS.find((q) => q.id === id)!;

  it("Intervensi Aktif membaca perkara_pihak3", () => {
    const q = ambil("sipp-extra-pihak-lanjutan-intervensi-aktif");
    expect(q.sqlText).toContain("FROM perkara_pihak3 pp3");
    expect(q.sqlText).not.toContain("perkara_pihak4");
    expect(q.sqlText).toContain("Pihak intervensi");
  });

  it("Turut Tergugat Aktif membaca perkara_pihak4", () => {
    const q = ambil("sipp-extra-pihak-lanjutan-turut-tergugat-aktif");
    expect(q.sqlText).toContain("FROM perkara_pihak4 pp4");
    expect(q.sqlText).not.toContain("perkara_pihak3");
    expect(q.sqlText).toContain("Turut tergugat");
  });

  it("pasangan 'Baru Minggu Ini' tetap selaras: intervensi pihak3, turut tergugat pihak4", () => {
    expect(ambil("sipp-extra-pihak-intervensi-baru-minggu-ini").sqlText).toContain("FROM perkara_pihak3 pp3");
    expect(ambil("sipp-extra-turut-tergugat-baru-minggu-ini").sqlText).toContain("FROM perkara_pihak4 pp4");
  });

  it("tidak ada sumber yang menyebut 'intervensi' tetapi membaca perkara_pihak4 (atau 'turut' dari pihak3)", () => {
    for (const q of SIPP_ADDITIONAL_QUERY_DEFINITIONS) {
      const sendiri = /FROM perkara_pihak([34]) pp\1\b/.exec(q.sqlText);
      if (!sendiri) continue;
      if (/UNION ALL/.test(q.sqlText)) continue; // gabungan semua pihak
      const judul = `${q.name} ${q.sqlText}`.toLowerCase();
      if (sendiri[1] === "4") expect(judul, q.id).not.toMatch(/intervensi/);
      if (sendiri[1] === "3") expect(judul, q.id).not.toMatch(/turut tergugat/);
    }
  });
});
