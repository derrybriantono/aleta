// @vitest-environment node

import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Pita atas hanya akun, nomor turun ke badan, chip peran berwarna, kaki rata
 * kanan.
 */

const akar = path.resolve(process.cwd(), "..");
const baca = (nama: string) => readFileSync(path.join(akar, "ekstensi-sipp", nama), "utf8");

function potongFungsi(isi: string, nama: string): string {
  const mulai = isi.indexOf(`function ${nama}(`);
  if (mulai < 0) throw new Error(`fungsi ${nama} tidak ketemu`);
  const selesai = isi.indexOf("\nfunction ", mulai + 10);
  return isi.slice(mulai, selesai < 0 ? undefined : selesai);
}

describe("pembatas di pita", () => {
  it("ada tanda | di antara keterangan", () => {
    // "ALETA SUPER ADMIN DERRY SIPP Super Administrator" tanpa pembatas
    // terbaca sebagai satu nama panjang.
    const css = baca("panel.css");
    expect(css).toContain(".aleta-identitas-panel > span + span::before {");
    const blok = css.slice(css.indexOf(".aleta-identitas-panel > span + span::before {"));
    expect(blok.slice(0, 160)).toContain('content: "|";');
  });
});

describe("kaki: segarkan dan seri di kanan", () => {
  it("baris kaki selebar kaki, pintasan mendorong sisanya ke kanan", () => {
    const css = baca("panel.css");
    const baris = css.slice(css.indexOf(".aleta-kaki-baris {"));
    expect(baris.slice(0, 400)).toContain("flex: 1 1 100%;");
    const pintasan = css.slice(css.indexOf(".aleta-kaki-baris .aleta-kaki-pintasan {"));
    expect(pintasan.slice(0, 300)).toContain("margin-right: auto;");
  });
});

describe("nomor dan register di satu tempat", () => {
  const konten = baca("konten.js");

  it("baris pertama badan memakai tombolNomorTukar, bukan tombol salin biasa", () => {
    const badan = potongFungsi(konten, "susunPanel");
    expect(badan).toContain('tombolNomorTukar(konteks.nomorPerkara, konteks.nomorRegister || "")');
    expect(badan).not.toContain('tombolSalin(konteks.nomorPerkara, "Salin nomor perkara")');
  });

  it("tombol register terpisah di baris ketiga sudah tidak ada", () => {
    // Satu nomor pernah punya tiga tempat: pita, baris kedua, baris ketiga.
    const badan = potongFungsi(konten, "susunPanel");
    expect(badan).not.toContain('reg.classList.add("aleta-kepala-register")');
  });

  it("dapat dicapai tanpa tetikus", () => {
    const badan = potongFungsi(konten, "tombolNomorTukar");
    expect(badan).toContain('kotakNomor.setAttribute("role", "button")');
    expect(badan).toContain("kotakNomor.tabIndex = 0;");
  });

  it("chip identitas di baris itu bulat dan bertepi", () => {
    const css = baca("panel.css");
    const blok = css.slice(css.indexOf(".aleta-kepala-perkara > .aleta-tanda-jenis,"));
    expect(blok.slice(0, 400)).toContain("border-radius: 999px;");
    expect(blok.slice(0, 400)).toContain("border: 1px solid;");
  });
});

describe("chip peran berwarna menurut perannya", () => {
  const alat = baca("panel-alat.js");

  it("super admin diperiksa SEBELUM admin - kata admin ada pada keduanya", () => {
    const badan = potongFungsi(alat, "alatKelasPeran");
    expect(badan.indexOf("aleta-peran-super")).toBeLessThan(badan.indexOf("aleta-peran-admin"));
    expect(badan).toContain('"aleta-peran-hakim"');
    expect(badan).toContain('"aleta-peran-panitera"');
    expect(badan).toContain('"aleta-peran-lain"');
  });

  it("dipakai di panel SIPP dan panel ALETA", () => {
    expect(baca("konten.js")).toContain("`aleta-kepala-peran ${alatKelasPeran(penggunaTerakhir.peran)}`");
    expect(baca("aleta.js")).toContain("tambah(`aleta-id-jenis ${alatKelasPeran(siapa.peran)}`");
  });

  it("super admin bergradasi berkilau bergerak, admin bergradasi diam", () => {
    const css = baca("panel.css");
    const superAdmin = css.slice(css.indexOf(".aleta-peran-super {"));
    expect(superAdmin.slice(0, 500)).toContain("linear-gradient(");
    expect(superAdmin.slice(0, 500)).toContain("animation: aleta-kilau");
    expect(css).toContain(".aleta-peran-super::after {");
    expect(css).toContain("animation: aleta-kerlip");
    const admin = css.slice(css.indexOf(".aleta-peran-admin {"));
    expect(admin.slice(0, 300)).toContain("linear-gradient(");
    expect(admin.slice(0, 300)).not.toContain("animation:");
  });

  it("kilaunya berhenti bila pengguna meminta gerak dikurangi", () => {
    // Warnanya tetap, geraknya tidak - yang meminta gerak dikurangi tidak
    // kehilangan tanda perannya, hanya kedipannya.
    const css = baca("panel.css");
    const reduce = css.slice(css.indexOf("@media (prefers-reduced-motion: reduce) {\n  .aleta-peran-super"));
    expect(reduce.slice(0, 200)).toContain("animation: none;");
  });

  it("kerlipnya tidak menangkap klik, dan mengikuti bentuk bulat chipnya", () => {
    const css = baca("panel.css");
    const after = css.slice(css.indexOf(".aleta-peran-super::after {"));
    expect(after.slice(0, 500)).toContain("pointer-events: none;");
    expect(after.slice(0, 500)).toContain("border-radius: inherit;");
  });
});
