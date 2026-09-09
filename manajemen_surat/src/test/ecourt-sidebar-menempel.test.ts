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

/**
 * Kelas pada elemen nav sidebar, dipotong dari sumbernya.
 *
 * ============================================================================
 * KOMENTAR DIBUANG LEBIH DAHULU - INI BUKAN KERAPIAN, INI KEBENARANNYA
 * ============================================================================
 *
 * Uji ini pernah gagal atas komponen yang sama sekali tidak berubah
 * perilakunya. Sebabnya komentar sepanjang tujuh ratus huruf yang ditulis
 * untuk MENJELASKAN kelas-kelas ini, dan di dalamnya nama kelasnya tertulis
 * harfiah:
 *
 *   // overflow-y-auto SENDIRIAN MEMBUAT BILAH GULIR MENDATAR
 *
 * Dua kerusakan sekaligus, keduanya dari cara memotong yang lama:
 *
 *   1. jendela 1.200 huruf habis di dalam komentar itu, sehingga baris kelas
 *      yang sesungguhnya tidak pernah terbaca - "lg:sticky tidak ada",
 *      padahal ia ada;
 *   2. penjaga "setiap kemunculan harus berawalan lg:" menemukan
 *      overflow-y-auto di dalam PROSA, lalu melaporkannya sebagai kelas tanpa
 *      awalan.
 *
 * Yang kedua paling berbahaya: ia menghukum orang yang menulis komentar. Uji
 * yang berbunyi setiap kali seseorang menerangkan keputusannya akan
 * menghasilkan kode tanpa keterangan - persis kebalikan dari yang kita mau.
 *
 * Karena itu yang dibaca hanya KODE-nya. Komentar dibuang, lalu potongannya
 * berhenti di kurung sudut penutup tag - dan sesudah komentar hilang, kurung
 * sudut pertama memang penutup tagnya.
 */
function kelasNav() {
  const awal = isi.indexOf('aria-label="Menu ALETA e-Court"');
  expect(awal, "elemen nav sidebar tidak ditemukan").toBeGreaterThan(-1);

  // Jendelanya dilebihkan jauh: yang membatasi potongan adalah kurung sudut
  // penutup tag, bukan angka ini. Angka yang pas-pasan itulah yang dulu
  // membuat uji ini gagal diam-diam ketika komentarnya bertambah panjang.
  const kasar = isi.slice(awal, awal + 6000);
  const tanpaKomentar = kasar.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ");

  const tutup = tanpaKomentar.indexOf(">");
  expect(tutup, "penutup tag nav tidak ditemukan").toBeGreaterThan(-1);
  return tanpaKomentar.slice(0, tutup);
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
