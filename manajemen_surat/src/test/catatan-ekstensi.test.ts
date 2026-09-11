import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  CATATAN_EKSTENSI,
  DIRILIS_EKSTENSI_TERBARU,
  VERSI_EKSTENSI_TERBARU,
  tulisWaktuRilis,
} from "@/lib/catatan-ekstensi";
import { EKSTENSI_VERSI } from "@/server/shared/ekstensi-berkas";

/**
 * Catatan pembaruan ekstensi.
 *
 * Yang dijaga: catatannya tidak pernah tertinggal dari ekstensinya, waktunya
 * tertulis lengkap, dan ketiga layar membaca daftar yang sama.
 *
 * Yang TIDAK boleh terjadi: manifest naik ke versi baru, catatannya tetap di
 * versi lama, dan Update Manager menyebut nomor yang tidak pernah ada di
 * Patch Notes. Uji pertama di bawah menutup jalan itu.
 */
const baca = (relatif: string) => readFileSync(path.resolve(process.cwd(), relatif), "utf8");

const bandingVersi = (a: string, b: string) => {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i += 1) {
    if (pa[i] !== pb[i]) return pa[i] - pb[i];
  }
  return 0;
};

describe("catatan tidak boleh tertinggal dari ekstensinya", () => {
  it("entri teratas sama dengan versi manifest yang tertanam", () => {
    expect(VERSI_EKSTENSI_TERBARU).toBe(EKSTENSI_VERSI);
  });

  it("versinya unik dan menurun ketat dari atas ke bawah", () => {
    const versi = CATATAN_EKSTENSI.map((c) => c.versi);
    expect(new Set(versi).size).toBe(versi.length);
    for (let i = 1; i < versi.length; i += 1) {
      expect(bandingVersi(versi[i - 1], versi[i]), `${versi[i - 1]} > ${versi[i]}`).toBeGreaterThan(0);
    }
  });

  it("waktunya ISO lengkap dengan zona, dan menurun dari atas ke bawah", () => {
    for (const c of CATATAN_EKSTENSI) {
      expect(c.dirilis, c.versi).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/);
      expect(Number.isNaN(new Date(c.dirilis).getTime()), c.versi).toBe(false);
    }
    for (let i = 1; i < CATATAN_EKSTENSI.length; i += 1) {
      const a = new Date(CATATAN_EKSTENSI[i - 1].dirilis).getTime();
      const b = new Date(CATATAN_EKSTENSI[i].dirilis).getTime();
      expect(a, `${CATATAN_EKSTENSI[i - 1].versi} sesudah ${CATATAN_EKSTENSI[i].versi}`).toBeGreaterThan(b);
    }
  });

  it("tiap entri punya judul dan sekurang-kurangnya satu butir", () => {
    for (const c of CATATAN_EKSTENSI) {
      expect(c.judul.length, c.versi).toBeGreaterThan(8);
      expect(c.butir.length, c.versi).toBeGreaterThan(0);
      for (const b of c.butir) expect(b.trim().length, c.versi).toBeGreaterThan(10);
    }
  });

  it("waktu rilis ditulis dalam zona WITA dengan tanggal DAN jam", () => {
    const teks = tulisWaktuRilis(DIRILIS_EKSTENSI_TERBARU);
    expect(teks).toMatch(/\d{2} \w+ \d{4}/);
    expect(teks).toMatch(/\d{2}[.:]\d{2}/);
    expect(teks).toContain("WITA");
    // 14:08 +08:00 harus tetap 14:08, bukan digeser ke zona komputer pembacanya.
    expect(tulisWaktuRilis("2026-09-11T14:08:51+08:00")).toMatch(/14[.:]08/);
  });
});

describe("tiga layar membaca satu daftar", () => {
  const berkas = {
    patchNotes: "src/app/(portal)/patch-notes/page.tsx",
    ecourt: "src/components/portal/aleta-ecourt-pengguna.tsx",
    updateManager: "src/app/(portal)/admin/pembaruan-sistem/page.tsx",
    footer: "src/components/layout/portal-footer.tsx",
  };

  it("Patch Notes, Integrasi e-Court, dan Update Manager memakai komponen yang sama", () => {
    for (const [nama, rel] of Object.entries(berkas)) {
      if (nama === "footer") continue;
      expect(baca(rel), nama).toContain('from "@/components/portal/catatan-ekstensi-daftar"');
      expect(baca(rel), nama).toContain("<CatatanEkstensiDaftar");
    }
  });

  it("Patch Notes memuat SELURUH versi pada jangkar #ekstensi", () => {
    const isi = baca(berkas.patchNotes);
    expect(isi).toContain('id="ekstensi"');
    expect(isi).toContain("<CatatanEkstensiDaftar tautanLengkap={false} />");
  });

  it("kaki halaman menautkan versi ekstensi ke jangkar itu", () => {
    const isi = baca(berkas.footer);
    expect(isi).toContain('href="/patch-notes#ekstensi"');
    expect(isi).toContain("Ekstensi {VERSI_EKSTENSI_TERBARU}");
  });

  it("tidak ada nomor versi ekstensi yang diketik tangan di layar mana pun", () => {
    // Nomor yang diketik tangan adalah nomor yang akan tertinggal.
    for (const [nama, rel] of Object.entries(berkas)) {
      const isi = baca(rel).replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*/g, "");
      expect(isi, nama).not.toMatch(/Ekstensi\s+1\.\d+\.\d+/);
      expect(isi, nama).not.toMatch(/Patch\s+1\.\d+\.\d+/);
    }
  });
});
