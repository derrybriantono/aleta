/**
 * Dua temuan dari pemeriksaan rantai PMH/PPP/PJS/PHS sesudah 2.19.0 terpasang.
 *
 *   1. Bongkar 567 pukul 15:19:43 masih mengaudit DELETE perkara_smartmajelis -
 *      tabel yang SIPP tidak pernah catat. Jalur tulis sudah dicabut, jalur
 *      bongkar tertinggal.
 *   2. Tanggal sidang yang dipilih untuk majelis B bertahan sesudah majelis
 *      diganti ke A - jatuh ke jalur "tanggal bebas" dengan peringatan. Tidak
 *      diam, tetapi tanggal itu sisa, bukan pilihan.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const AKAR = path.resolve(__dirname, "../../..");
const baca = (p: string) => readFileSync(path.join(AKAR, p), "utf8");
const tulis = baca("aleta_bot/services/penetapanTulisService.js");
const konten = baca("ekstensi-sipp/konten.js");

describe("bongkar tidak mengaudit perkara_smartmajelis", () => {
  it("baris auditnya dilewati - barisnya sendiri tetap dihapus", () => {
    const loop = tulis.slice(tulis.indexOf("for (const rincian of rincianUntukHapus("));
    const potong = loop.slice(0, 900);
    expect(potong).toContain('langkah.push({ ...rincian, aksi: "DELETE" });');
    expect(potong).toContain('if (rincian.tabel === "perkara_smartmajelis") continue;');
    // Urutannya menentukan: DELETE didorong DULU, baru dilewati auditnya.
    expect(potong.indexOf('aksi: "DELETE"')).toBeLessThan(potong.indexOf('=== "perkara_smartmajelis") continue;'));
  });

  it("rincian bongkar PMH masih menghapus smartmajelis", () => {
    expect(tulis).toContain('tabel: "perkara_smartmajelis",\n        sql: `DELETE FROM perkara_smartmajelis');
  });
});

describe("mengganti majelis melepas tanggal sidang majelis lama", () => {
  it("dilepas di pemuat ulang, kecuali tanggal bebas yang sengaja dibuka", () => {
    const fungsi = konten.slice(konten.indexOf("async function muatUlangUsulan("));
    const potong = fungsi.slice(0, 2600);
    expect(potong).toContain("if (data.pilihanManual && !data.pilihanManual.phsBebas) {");
    expect(potong).toContain('data.pilihanManual.phs = "";');
  });

  it("ruangan dan juru sita TIDAK ikut dilepas - keduanya bukan milik majelis", () => {
    const fungsi = konten.slice(konten.indexOf("async function muatUlangUsulan("));
    const potong = fungsi.slice(0, 2600);
    expect(potong).not.toContain('data.pilihanManual.ruangan = "";');
    expect(potong).not.toContain('data.pilihanManual.pjs = "";');
  });
});
