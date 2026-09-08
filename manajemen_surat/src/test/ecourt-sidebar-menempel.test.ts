// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Sidebar ALETA e-Court harus MENEMPEL saat halaman digulung.
 *
 * Layar Jadwal Sidang dan Status Perkara panjangnya berkali-kali tinggi layar.
 * Selama sidebarnya ikut tergulung, berpindah layar menuntut menggulung balik
 * ke atas lebih dahulu - dan pada perkara yang rinciannya panjang itu berarti
 * belasan putaran roda tetikus untuk satu klik.
 *
 * Diuji dari sumbernya, bukan dari halaman yang dirender: kelas Tailwind
 * inilah keputusannya, dan yang hilang dari sini tidak akan pernah muncul di
 * peramban. Merender komponen ini menuntut sesi, basis data, dan gerbang bot -
 * ongkos yang tidak sebanding dengan yang dijaga.
 */

const berkas = path.resolve(
  process.cwd(),
  "src/components/portal/aleta-ecourt-pengguna.tsx"
);
const isi = readFileSync(berkas, "utf8");

/** Kelas pada elemen nav sidebar, dipotong dari sumbernya. */
function kelasNav() {
  const awal = isi.indexOf('aria-label="Menu ALETA e-Court"');
  expect(awal, "elemen nav sidebar tidak ditemukan").toBeGreaterThan(-1);
  const potong = isi.slice(awal, awal + 1200);
  const tutup = potong.indexOf(">");
  return tutup > -1 ? potong.slice(0, tutup) : potong;
}

describe("sidebar e-Court menempel saat digulung", () => {
  it("memakai sticky beserta jarak dari tepi atas", () => {
    // top tanpa sticky tidak berpengaruh apa pun, dan sticky tanpa top
    // menempel di 0 - keduanya bukan yang dimaksud.
    const kelas = kelasNav();
    expect(kelas).toContain("lg:sticky");
    expect(kelas).toContain("lg:top-4");
  });

  it("tingginya dibatasi dan menggulung di dalam dirinya", () => {
    // Inilah bagian yang paling mudah tertinggal. Sidebar yang menempel tetapi
    // lebih tinggi dari layar akan terpotong di bawah, dan butir terbawahnya
    // - justru menu yang paling jarang dipakai dan paling dicari - tidak
    // pernah dapat diklik.
    const kelas = kelasNav();
    expect(kelas).toContain("lg:max-h-[calc(100vh-2rem)]");
    expect(kelas).toContain("lg:overflow-y-auto");
  });

  it("hanya berlaku pada layar lebar", () => {
    // Di bawah lg sidebar berada di ATAS isinya, bukan di sampingnya.
    // Menempelkannya di sana akan menutupi isi yang sedang dibaca.
    const kelas = kelasNav();
    for (const kandidat of ["sticky", "top-4", "max-h-[calc(100vh-2rem)]", "overflow-y-auto"]) {
      // Setiap kemunculan harus berawalan lg:.
      const tanpaAwalan = new RegExp(`(^|[\\s"'])${kandidat.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`);
      expect(tanpaAwalan.test(kelas), `${kandidat} tanpa awalan lg:`).toBe(false);
    }
  });

  it("nav tetap h-fit, tidak diregangkan setinggi baris grid", () => {
    // h-fit itulah yang membuat sidebar berhenti setinggi isinya sendiri
    // sementara bagan grid-nya tetap setinggi baris - dan bagan itulah yang
    // memberi sticky ruang untuk bergerak. Menggantinya dengan h-full
    // membuat sidebar setinggi halaman, dan sticky tidak pernah bergeser.
    expect(kelasNav()).toContain("h-fit");
  });

  it("alasannya tertulis di sumbernya", () => {
    // Kelas yang tidak diketahui sebabnya adalah kelas yang akan dihapus orang
    // berikutnya karena dikira sisa percobaan.
    expect(isi).toContain("SIDEBAR MENEMPEL, DAN MENGGULUNG SENDIRI BILA KEPANJANGAN");
  });
});
