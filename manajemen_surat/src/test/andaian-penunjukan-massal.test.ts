// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { BATAS_ANDAIAN, bacaAndaianPenunjukan, tulisAndaianPenunjukan } from "@/lib/andaian-penunjukan";

/**
 * ============================================================================
 * PRATINJAU PENETAPAN MASSAL YANG BERGILIR SEPERTI PENULISANNYA
 * ============================================================================
 *
 * Penetapan massal memeriksa dua puluh perkara atas keadaan basis data yang
 * sama, lalu menuliskannya satu per satu; tiap penulisan mengubah giliran
 * bagi perkara berikutnya. Tanpa andaian, pratinjau mengusulkan majelis,
 * panitera pengganti, dan juru sita yang SAMA untuk semuanya - dan begitu
 * rinciannya diperlihatkan, yang tertulis berbeda dari yang tertera.
 *
 * Andaian dibawa di alamat dalam bentuk ringkas. Yang dijaga di sini:
 * pembacanya di portal dan penulisnya di ekstensi memakai bentuk yang SAMA,
 * rute meneruskannya, dan penetapan massal benar-benar mengirimnya.
 */

const AKAR = path.resolve(process.cwd(), "..");
const baca = (p: string) => readFileSync(path.join(AKAR, p), "utf8");

describe("bentuk ringkas andaian: dibaca dan ditulis dengan aturan yang sama", () => {
  const contoh = [
    { perkaraId: 10119, hakimId: [32, 26, 31], paniteraId: 18, jurusitaId: 30, tanggalSidang: "2026-09-23" },
    { perkaraId: 10120, hakimId: [33, 28, 31], paniteraId: 21, jurusitaId: 30, tanggalSidang: "2026-09-22" },
    // Hakim tunggal, belum ada hari sidang.
    { perkaraId: 10121, hakimId: [26], paniteraId: 0, jurusitaId: 0, tanggalSidang: "" },
  ];

  it("bolak-balik tanpa kehilangan apa pun", () => {
    const teks = tulisAndaianPenunjukan(contoh);
    expect(teks).toBe("10119:32.26.31:18:30:2026-09-23;10120:33.28.31:21:30:2026-09-22;10121:26:::");
    expect(bacaAndaianPenunjukan(teks)).toEqual(contoh);
  });

  it("yang datang dari peramban disaring: bukan angka, tanggal salah, butir kosong", () => {
    expect(bacaAndaianPenunjukan("abc:x.y:z:w:23-09-2026;::::;10119:32.26.31:18:30:2026-09-23")).toEqual([
      { perkaraId: 10119, hakimId: [32, 26, 31], paniteraId: 18, jurusitaId: 30, tanggalSidang: "2026-09-23" },
    ]);
    expect(bacaAndaianPenunjukan(null)).toEqual([]);
    expect(bacaAndaianPenunjukan("")).toEqual([]);
  });

  it("dibatasi 25 - sebesar batas penetapan massal", () => {
    const banyak = Array.from({ length: 40 }, (_, i) => ({
      perkaraId: 100 + i,
      hakimId: [26],
      paniteraId: 0,
      jurusitaId: 0,
      tanggalSidang: "",
    }));
    expect(BATAS_ANDAIAN).toBe(25);
    expect(bacaAndaianPenunjukan(tulisAndaianPenunjukan(banyak))).toHaveLength(25);
    expect(baca("ekstensi-sipp/konten.js")).toContain("const BATAS_ANDAIAN = 25;");
    expect(baca("ekstensi-sipp/konten.js")).toContain("const BATAS_PERKARA_MASSAL = 25;");
  });

  it("penulis di ekstensi memakai susunan ladang yang sama", () => {
    // Dua penulis untuk satu bentuk: yang di ekstensi tidak dapat mengimpor
    // pustaka portal. Yang dijaga: urutan ladang dan pemisahnya sama.
    const konten = baca("ekstensi-sipp/konten.js");
    const mulai = konten.indexOf("function serialkanAndaian(daftar)");
    expect(mulai).toBeGreaterThan(0);
    const badan = konten.slice(mulai, mulai + 700);
    for (const potongan of [
      'a.perkaraId > 0 ? String(a.perkaraId) : ""',
      '(a.hakimId || []).filter((x) => x > 0).join(".")',
      'a.paniteraId > 0 ? String(a.paniteraId) : ""',
      'a.jurusitaId > 0 ? String(a.jurusitaId) : ""',
      'a.tanggalSidang || ""',
      '].join(":")',
      '.join(";")',
    ]) {
      expect(badan).toContain(potongan);
    }
  });
});

describe("rute portal dan gerbang bot meneruskan andaian", () => {
  it("rute usulan membaca ?andaian= lewat pustaka dan meneruskannya", () => {
    const rute = baca("manajemen_surat/src/app/api/aleta-bot/penunjukan/route.ts");
    expect(rute).toContain('import { bacaAndaianPenunjukan } from "@/lib/andaian-penunjukan";');
    expect(rute).toContain('bacaAndaianPenunjukan(request.nextUrl.searchParams.get("andaian"))');
    expect(rute).toContain("        pilihanMajelis,\n        andaian,\n");
  });

  it("gerbang bot menyaringnya sekali lagi dan meneruskan ke layanan", () => {
    const rute = baca("aleta_bot/routes/internalGatewayRoutes.js");
    expect(rute).toContain("kirim.andaian");
    expect(rute).toContain(".slice(0, 25)");
    expect(rute).toContain("      susunanSk,\n      andaian,\n");
  });

  it("layanan bot menerapkannya ke majelis, petugas, dan beban tanggal", () => {
    const layanan = baca("aleta_bot/services/penunjukanService.js");
    expect(layanan).toContain("const andaian = normalkanAndaian(pengaturan.andaian);");
    expect(layanan).toContain("terapkanAndaianSusunan(terpakai.susunan, andaian);");
    expect(layanan).toContain("terapkanAndaianBeban(beban, bebanMajelis, andaian, bobotAndaian);");
    expect(layanan).toContain('"jurusitaId"\n  );');
    expect(layanan).toContain('"paniteraId"\n  );');
    // Bobotnya bobot yang sama dengan kueri beban.
    expect(layanan).toContain("function bobotJenis(jenisPerkaraId)");
    expect(layanan).toContain("const bobot = BOBOT_JENIS[Number(jenisPerkaraId)];");
  });
});

describe("penetapan massal mengirim andaian dan memperlihatkan rinciannya", () => {
  const konten = () => baca("ekstensi-sipp/konten.js");
  function potongFungsi(isi: string, nama: string) {
    const mulai = isi.indexOf(`function ${nama}(`);
    expect(mulai, `${nama} tidak ditemukan`).toBeGreaterThan(-1);
    return isi.slice(mulai, isi.indexOf("\nfunction ", mulai + 10));
  }

  it("usulan tiap perkara pada uji kering membawa andaian perkara sebelumnya", () => {
    const badan = potongFungsi(konten(), "bagianPenetapanMassal");
    expect(badan).toContain("const andaian = [];");
    expect(badan).toContain("ambilUsulanPenunjukan(nomor, null, kering ? andaian : [])");
    expect(badan).toContain("const satuAndaian = andaianDari(usulan, data.pilihanManual || {});");
    expect(badan).toContain("if (satuAndaian) andaian.push(satuAndaian);");
  });

  it("andaian hanya dari perkara yang lolos, dan hanya pada uji kering", () => {
    const badan = potongFungsi(konten(), "bagianPenetapanMassal");
    // 7 Okt 2026: perkara yang gagal di-`continue` lebih dahulu; andaian
    // hanya didorong sesudah lulus, dan hanya pada uji kering.
    const lulus = badan.slice(badan.indexOf("lulus.add(nomor);"));
    expect(badan.indexOf("if (gagalSungguhan.length > 0) {")).toBeGreaterThan(0);
    expect(badan.indexOf("if (gagalSungguhan.length > 0) {")).toBeLessThan(badan.indexOf("lulus.add(nomor);"));
    expect(lulus.slice(0, 200)).toContain("if (kering) {");
    expect(lulus.slice(0, 300)).toContain("if (satuAndaian) andaian.push(satuAndaian);");
  });

  it("ambilUsulanPenunjukan menempelkan &andaian= hanya bila ada", () => {
    const isi = konten();
    expect(isi).toContain("async function ambilUsulanPenunjukan(nomor, pilihanMajelis, andaian)");
    expect(isi).toContain('teksAndaian ? `&andaian=${encodeURIComponent(teksAndaian)}` : ""');
  });

  it("rinciannya rapor yang SAMA dengan papan satu perkara", () => {
    const badan = potongFungsi(konten(), "bagianPenetapanMassal");
    expect(badan).toContain("gambarRincianMassal(nomor, raporPraperiksa(usulan, data, hasil), hasil);");
    expect(badan).toContain("function gambarRincianMassal(nomor, rapor, hasil)");
    expect(badan).toContain('buatElemen("div", "aleta-massal-ganjalan", ganjalan)');
    expect(badan).toContain("for (const andaianBot of satu.andaian || [])");
  });

  it("tiap perkara satu butir, belangnya per butir", () => {
    const badan = potongFungsi(konten(), "bagianPenetapanMassal");
    expect(badan).toContain('"aleta-massal-daftar aleta-massal-daftar-penetapan"');
    expect(badan).toContain('const butir = buatElemen("div", "aleta-massal-butir");');
    const css = baca("ekstensi-sipp/panel.css");
    expect(css).toContain(".aleta-massal-daftar-penetapan .aleta-massal-butir:nth-child(odd)");
    expect(css).toContain(".aleta-massal-rincian {");
    expect(css).toContain(".aleta-massal-ganjalan {");
  });

  it("penjaga lama tetap: tidak ada centang yang tercentang sendiri", () => {
    const badan = potongFungsi(konten(), "bagianPenetapanMassal");
    expect(badan).not.toContain("centang.checked = true;");
  });
});

describe("bukti luring bot yang menyertai rilis ini", () => {
  it("bukti waktu mengukur detik, bukan menit", () => {
    const bukti = baca("aleta_bot/scripts/verify-waktu-penetapan.js");
    expect(bukti).toContain("const JEDA_MIN = 60;");
    expect(bukti).toContain("const JEDA_MAKS = 10 * 60 + 59;");
    expect(bukti).toContain("tidak ada yang melampaui, sampai detiknya");
    expect(bukti).toContain("panggilan berselang: tidak pernah mundur");
  });

  it("bukti bentuk SIPP menuntut judul Smart Majelis dan tanpa baris kembar", () => {
    const bukti = baca("aleta_bot/scripts/verify-penetapan-bentuk-sipp.js");
    expect(bukti).toContain("dari halaman <b> Smart Majelis TAMBAH PENETAPAN HAKIM/MAJELIS HAKIM</b>");
    expect(bukti).toContain("seluruh rantai: 16 baris audit, tidak satu pun kembar");
  });

  it("layanan tulis menulis judul Smart Majelis hanya pada hakim_pn", () => {
    const tulis = baca("aleta_bot/services/penetapanTulisService.js");
    // Sejak butir 39 (5 Okt 2026) hanya pada jalur rekomendasi (status 1) -
    // jalur borang (status 2) berjudul tanpa "Smart Majelis", seperti SIPP.
    expect(tulis).toContain("judulHalaman: lewatSmart ? ` Smart Majelis ${jejak.formulir}` : undefined,");
    expect(tulis.split("judulHalaman: ").length - 1).toBe(1);
    expect(tulis).toContain('const SMART_MAJELIS_SESUAI_REKOMENDASI = "1";');
    expect(tulis).toContain("WHERE rmt.aktif IN ('1', 'Y')");
  });
});
