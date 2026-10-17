// @vitest-environment jsdom

import fs from "node:fs";
import path from "node:path";

import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ModeLayarJauh } from "@/components/layout/mode-layar-jauh";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

/**
 * ============================================================================
 * UI/UX SEMUA UKURAN LAYAR - YANG TIDAK BOLEH HILANG DI LAYAR SEMPIT
 * ============================================================================
 *
 * jsdom tidak menghitung tata letak, jadi uji ini tidak membuktikan bahwa
 * sesuatu "muat". Yang dijaganya dua hal yang memang dapat dibuktikan tanpa
 * peramban:
 *
 *   1. Elemen penting TETAP ADA di berkas tampilannya - penyesuaian layar
 *      sempit hanya boleh mengubah susunan, tidak boleh membuang tombol,
 *      menu, atau aksi (misalnya pencarian cepat yang dulu tersembunyi di HP).
 *
 *   2. Mekanisme penyesuaiannya terpasang: skala huruf layar sangat lebar,
 *      mode layar jauh untuk televisi, dan tabulasi yang dapat digulir.
 *
 * Kepatutan tampilannya diukur di peramban (docs/uiux-v1/).
 */

const akar = path.resolve(process.cwd(), "src");
const baca = (relatif: string) => fs.readFileSync(path.join(akar, relatif), "utf8");

describe("kerangka portal: tidak ada aksi yang hilang di HP", () => {
  const cangkang = baca("components/layout/portal-shell-v2.tsx");

  it("pencarian cepat ada di layar lebar DAN dapat dicapai lewat ikon di HP", () => {
    expect(cangkang).toContain("function HeaderSearchForm()");
    // dua tempat: tombol kirim borang (layar lebar) dan tautan ikon (HP)
    expect(cangkang.match(/aria-label="Cari cepat"/g)?.length).toBe(2);
    expect(cangkang).toContain('<Link href="/search">');
  });

  it("navigasi laci HP, menu admin, tugas, dan profil tetap ada", () => {
    for (const butir of [
      'aria-label="Buka navigasi"',
      'aria-label="Tutup menu"',
      'aria-label="Buka Panel Admin"',
      'aria-label="Pusat Tugas dan Notifikasi"',
      'data-testid="user-menu"',
      'data-testid="logout-button"',
      "Edit Profil / Akun",
      "Tandai Semua Sudah Dilihat",
      "Buka Pusat Tugas Selengkapnya",
    ]) {
      expect(cangkang, butir).toContain(butir);
    }
  });

  it("laci HP memakai dvh dan lebar maksimum terhadap layar, bukan px tetap", () => {
    expect(cangkang).toContain("h-[calc(100dvh-4rem)]");
    expect(cangkang).toContain("w-[min(20rem,calc(100vw-1.5rem))]");
    expect(cangkang).toContain("w-[min(18.75rem,calc(100vw-1.5rem))]");
  });

  it("lebar isi mengikuti ukuran huruf akar supaya ikut membesar di 4K", () => {
    expect(cangkang).toContain("max-w-[100rem]");
    expect(cangkang).not.toContain("max-w-[1600px]");
  });
});

describe("gaya global: layar sangat lebar, sentuh, dan layar jauh", () => {
  const css = baca("app/globals.css");

  it("huruf akar naik bertahap di layar sangat lebar tanpa menyentuh desktop biasa", () => {
    expect(css).toMatch(/@media \(min-width: 2200px\)\s*{\s*html\s*{\s*font-size: 19px/);
    expect(css).toMatch(/@media \(min-width: 2800px\)\s*{\s*html\s*{\s*font-size: 23px/);
    expect(css).toMatch(/@media \(min-width: 3400px\)\s*{\s*html\s*{\s*font-size: 27px/);
    // 16px di bawah 2200 px tetap dari aturan dasar
    expect(css).toMatch(/html\s*{\s*font-size: 16px;/);
  });

  it("mode layar jauh mengikuti lebar dan tinggi layar", () => {
    expect(css).toContain("html.aleta-layar-jauh");
    expect(css).toContain("font-size: max(16px, min(1.04vw, 1.85vh))");
  });

  it("perangkat sentuh mendapat sasaran sentuh 40 px dan kolom isian 16 px", () => {
    expect(css).toContain("@media (pointer: coarse)");
    expect(css).toContain("min-height: 2.5rem");
    expect(css).toMatch(/@media \(pointer: coarse\) and \(max-width: 767px\)/);
  });

  it("pembungkus tabel yang dapat digulir tersedia", () => {
    expect(css).toContain(".aleta-tabel-gulir");
    expect(css).toContain("overflow-x: auto");
  });
});

describe("tablet dan HP: tabel tidak mendorong halaman melebar", () => {
  const css = baca("app/globals.css");

  it("sel tabel dibatasi lebarnya dan kolom grid boleh menyusut di bawah 1024 px", () => {
    expect(css).toMatch(/@media \(max-width: 1023px\)\s*{\s*main \.grid > \*\s*{\s*min-width: 0/);
    expect(css).toMatch(/main td,\s*main th\s*{\s*max-width: 22rem/);
    expect(css).toMatch(/@media \(max-width: 767px\)\s*{\s*main td,\s*main th\s*{\s*max-width: 16rem/);
  });

  it("tabel yang dulu tanpa pembungkus kini dapat digulir, tabelnya sendiri tetap ada", () => {
    for (const [berkas, minimal] of [
      ["components/portal/aleta-bot-admin.tsx", 3],
      ["components/portal/kasir-otomatis.tsx", 2],
      ["components/portal/rekap-petugas.tsx", 1],
      ["components/portal/tautan-sipp-semua.tsx", 1],
    ] as const) {
      const isi = baca(berkas);
      expect(isi.match(/<div className="aleta-tabel-gulir">/g)?.length ?? 0, berkas).toBeGreaterThanOrEqual(minimal);
      // pembungkus dan penutupnya seimbang dengan tabelnya
      expect(isi.match(/<table/g)?.length ?? 0, berkas).toBeGreaterThanOrEqual(minimal);
    }
  });

  it("kartu masuk memakai rem agar ikut membesar di layar sangat lebar", () => {
    const masuk = baca("app/login/page.tsx");
    expect(masuk).toContain("max-w-[55rem]");
    expect(masuk).toContain("lg:grid-cols-[minmax(0,1fr)_24.375rem]");
  });
});

describe("layar televisi dan publik memakai mode layar jauh", () => {
  for (const halaman of [
    "app/antrian-layar/page.tsx",
    "app/antrian-ruang/page.tsx",
    "app/antrian-tampil/page.tsx",
    "app/sidang-ruang/page.tsx",
  ]) {
    it(`${halaman} memasang <ModeLayarJauh />`, () => {
      const isi = baca(halaman);
      expect(isi).toContain('import { ModeLayarJauh } from "@/components/layout/mode-layar-jauh"');
      expect(isi).toContain("<ModeLayarJauh />");
    });
  }

  it("kelas pada <html> dipasang saat tampil dan dicabut saat ditinggalkan", () => {
    const { unmount } = render(<ModeLayarJauh />);
    expect(document.documentElement.classList.contains("aleta-layar-jauh")).toBe(true);
    unmount();
    expect(document.documentElement.classList.contains("aleta-layar-jauh")).toBe(false);
  });
});

describe("tabulasi: semua tab tetap ada dan dapat digulir di layar sempit", () => {
  it("daftar tab dapat digulir ke samping di bawah lg dan tab tidak menyusut", () => {
    const { container, getAllByRole } = render(
      <Tabs defaultValue="a">
        <TabsList>
          <TabsTrigger value="a">Pertama</TabsTrigger>
          <TabsTrigger value="b">Kedua</TabsTrigger>
          <TabsTrigger value="c">Ketiga</TabsTrigger>
        </TabsList>
      </Tabs>
    );
    expect(getAllByRole("tab")).toHaveLength(3);
    const daftar = container.querySelector('[role="tablist"]') as HTMLElement;
    expect(daftar.className).toContain("max-lg:overflow-x-auto");
    expect(daftar.className).toContain("max-lg:max-w-full");
    for (const tab of getAllByRole("tab")) {
      expect(tab.className).toContain("max-lg:shrink-0");
    }
  });
});
