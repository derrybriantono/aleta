// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * 3 Okt 2026: kolom "Antrian / Jam" Jadwal Sidang yang sudah terisi (nomor hijau + jam P/T + lencana
 * Tunggu / Dari sebelumnya / Lama) melebar sampai ~330 px dan menyempitkan "Perkara & Para Pihak" -
 * kolom utama. Penyebabnya bukan lencananya (wadahnya flex-wrap) melainkan LEBAR IDEAL wadah itu: semua
 * lencana dijajar satu baris. Tabel otomatis membagi sisa lebar menurut lebar ideal, jadi kolom tanpa
 * batas merebut ruang. Diukur di Chromium (replika statis): terisi 240 -> 177 px, belum terisi tetap 100 px.
 */
const LAYAR = readFileSync(path.resolve(process.cwd(), "src/components/portal/aleta-ecourt-sidang.tsx"), "utf8");

describe("kolom Antrian / Jam dibatasi lebarnya", () => {
  it("kepala dan sel kolom Antrian / Jam sama-sama bermax-w-[12rem]", () => {
    const kepala = LAYAR.indexOf('kunci="antrian"');
    expect(kepala).toBeGreaterThan(-1);
    expect(LAYAR.slice(kepala, kepala + 200)).toContain("max-w-[12rem]");
    const sel = LAYAR.indexOf("<SelAntrianJam\n") >= 0 ? LAYAR.indexOf("<SelAntrianJam\n") : LAYAR.indexOf("<SelAntrianJam\r\n");
    expect(sel).toBeGreaterThan(-1);
    const tdPembuka = LAYAR.lastIndexOf("<td ", sel);
    expect(LAYAR.slice(tdPembuka, sel)).toContain("max-w-[12rem]");
  });

  it("batasnya hanya max-w (bukan w tetap): kolom yang belum terisi tetap sesempit isinya", () => {
    const sel = LAYAR.indexOf("<SelAntrianJam\n") >= 0 ? LAYAR.indexOf("<SelAntrianJam\n") : LAYAR.indexOf("<SelAntrianJam\r\n");
    const tdPembuka = LAYAR.lastIndexOf("<td ", sel);
    const tag = LAYAR.slice(tdPembuka, LAYAR.indexOf(">", tdPembuka) + 1);
    expect(tag).not.toMatch(/\sw-\[|\sw-\d/);
    expect(tag).not.toMatch(/min-w-/);
  });

  it("kolom Perkara & Para Pihak tidak diberi batas yang menyaingi", () => {
    const kepala = LAYAR.indexOf("Perkara &amp; Para Pihak");
    expect(kepala).toBeGreaterThan(-1);
    const tag = LAYAR.slice(LAYAR.lastIndexOf("<KepalaUrut", kepala), kepala);
    expect(tag).not.toContain("max-w-");
  });
});
