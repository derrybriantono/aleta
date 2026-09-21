// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { adaHasilSidang, hasilSidangPutusan } from "@/lib/hasil-sidang";

/**
 * ============================================================================
 * HASIL SIDANG DAN TUNDAAN BERBAGI SATU KOLOM SIPP
 * ============================================================================
 *
 * perkara_jadwal_sidang tidak punya kolom hasil sidang - diperiksa lewat SHOW
 * COLUMNS. Panitera memakai alasan_ditunda untuk dua hal, dan yang memisahkan
 * keduanya bendera `ditunda` milik SIPP sendiri:
 *
 *   ditunda = Y   agenda berikutnya      "Panggil Tergugat", "Pembacaan Putusan"
 *   ditunda = T   hasil sidangnya        "putus DIKABULKAN (verstek)"
 *
 * Diukur pada 20.063 baris jadwal sidang PA Donggala:
 *
 *   ditunda = T   3.909 mengandung "putus", 7.395 lainnya, 311 kosong
 *   ditunda = Y     124 mengandung "putus", 8.321 lainnya,   3 kosong
 *
 * Yang 7.395 bukan hasil sidang: 6.207 di antaranya berisi angka "0" belaka.
 */

describe("memisahkan hasil sidang dari agenda tundaan", () => {
  it("yang ditunda TIDAK pernah dianggap hasil sidang", () => {
    // 58 baris berbunyi "Pembacaan Putusan" dengan ditunda = Y. Menghijaukannya
    // berarti mengumumkan perkara sudah putus padahal sidangnya baru ditunda
    // untuk pembacaannya.
    expect(hasilSidangPutusan(true, "Pembacaan Putusan")).toBe("");
    expect(hasilSidangPutusan(true, "Musyawarah Majelis dan Pembacaan Putusan")).toBe("");
    expect(hasilSidangPutusan(true, "putus DIKABULKAN")).toBe("");
  });

  it("yang tidak ditunda dan menyebut putus adalah hasil sidang", () => {
    expect(hasilSidangPutusan(false, "putus DIKABULKAN (verstek)")).toBe("putus DIKABULKAN (verstek)");
    expect(hasilSidangPutusan(false, "putus DICABUT")).toBe("putus DICABUT");
    expect(hasilSidangPutusan(false, "Putus")).toBe("Putus");
    expect(hasilSidangPutusan(false, "putus TIDAK DITERIMA")).toBe("putus TIDAK DITERIMA");
  });

  it("angka nol bawaan tidak pernah ditampilkan", () => {
    // 6.207 baris berisi ini. Menampilkan "0" sebagai hasil sidang lebih buruk
    // daripada tidak menampilkan apa pun.
    expect(hasilSidangPutusan(false, "0")).toBe("");
    expect(hasilSidangPutusan(false, "")).toBe("");
    expect(hasilSidangPutusan(false, "   ")).toBe("");
  });

  it("agenda yang terlanjur diketik tanpa menandai tundaan tidak dihijaukan", () => {
    // 7.395 baris ditunda = T berisi agenda, bukan hasil. Yang membedakannya
    // hanya kata "putus" - dan itu sengaja: menebak lebih jauh akan salah.
    expect(hasilSidangPutusan(false, "Panggil Tergugat")).toBe("");
    expect(hasilSidangPutusan(false, "telah ikrar talak")).toBe("");
    expect(hasilSidangPutusan(false, "Mediasi")).toBe("");
  });

  it("bentuk gabungan dirapatkan menjadi satu baris", () => {
    // 35 baris berbentuk begini. Tulisan yang menjulur ke bawah menggeser
    // seluruh baris tabel di sebelahnya.
    expect(hasilSidangPutusan(false, "Panggil Tergugat\nputus verstek")).toBe(
      "Panggil Tergugat · putus verstek"
    );
    expect(hasilSidangPutusan(false, "Panggil Tergugat\nputus verstek\n")).toBe(
      "Panggil Tergugat · putus verstek"
    );
  });

  it("adaHasilSidang sejalan dengan isinya", () => {
    expect(adaHasilSidang(false, "putus DICABUT")).toBe(true);
    expect(adaHasilSidang(true, "putus DICABUT")).toBe(false);
    expect(adaHasilSidang(false, "0")).toBe(false);
  });
});

describe("jadwal hari ini memuat ulang sendiri", () => {
  const berkas = readFileSync(
    path.resolve(process.cwd(), "src/components/portal/aleta-ecourt-sidang.tsx"),
    "utf8"
  );

  it("ada pemuatan ulang berkala", () => {
    // Terbukti perlu: perkara 530/Pdt.G/2026 ditandai ditunda di SIPP pukul
    // 11:00:28 sedangkan layar yang terbuka sejak pagi masih menampilkannya
    // belum ditunda - dan layar yang basi tampak persis seperti yang benar.
    expect(berkas).toContain("JEDA_MUAT_ULANG_MS");
    expect(berkas).toContain("window.setInterval");
  });

  it("hanya untuk hari ini", () => {
    // Tanggal lampau tidak berubah lagi; memuat ulangnya hanya menghabiskan
    // kueri berat ke SIPP tanpa guna.
    expect(berkas).toContain("const sedangHariIni = dari === sampai && dari === hariIni()");
    expect(berkas).toContain("if (!sedangHariIni) return;");
  });

  it("berhenti saat tab tidak terlihat", () => {
    // Sepuluh tab menganggur akan memukul SIPP sepanjang hari.
    expect(berkas).toContain('document.visibilityState !== "visible"');
  });

  it("tidak menumpuk permintaan", () => {
    // Ref, bukan state: state yang terbaca di dalam setInterval adalah state
    // sewaktu interval dipasang - selamanya false.
    expect(berkas).toContain("memuatRef.current = true;");
    expect(berkas).toContain("if (memuatRef.current) return;");
  });
});

describe("kolom tabel jadwal disatukan", () => {
  const berkas = readFileSync(
    path.resolve(process.cwd(), "src/components/portal/aleta-ecourt-sidang.tsx"),
    "utf8"
  );

  it("Majelis, Petugas Sidang, dan Ruang menjadi satu kolom", () => {
    // Tiga kolom yang menjawab satu pertanyaan yang sama - siapa, dan di mana.
    expect(berkas).toContain("Majelis &amp; Petugas");
    expect(berkas).not.toContain("Petugas Sidang\n");
  });

  it("tidak ada lagi kepala kolom Ruang tersendiri", () => {
    expect(berkas).not.toMatch(/<KepalaUrut kunci="ruang"/);
  });

  it("colSpan mengikuti jumlah kolom yang tersisa", () => {
    // colSpan yang tertinggal membuat baris "tidak ada hasil" melebar keluar
    // tabel - rusak yang hanya terlihat ketika tabelnya kebetulan kosong.
    //
    // Sejak 2.29.0 angkanya TIDAK BOLEH lagi ditulis tetap. Kolom "Siap"
    // benar-benar tidak digambar ketika skor kesiapan dimatikan lewat saklar
    // tampilan - kepalanya dan selnya sekaligus - sehingga tabelnya kadang
    // berkolom 8 dan kadang 7. colSpan tetap akan membentang satu kolom lebih
    // jauh daripada tabelnya persis pada keadaan yang kedua.
    //
    // Yang dijaga sekarang lebih kuat daripada sebelumnya: bukan "angkanya 8",
    // melainkan "tidak ada satu pun angka tetap", ditambah tuntutan bahwa
    // penghitungnya sungguh dihitung dari saklarnya.
    expect(berkas).not.toMatch(/colSpan=\{\d+\}/);
    expect(berkas).toContain("colSpan={kolomTabel}");
    expect(berkas).toContain('const kolomTabel = tampil(tampilan, "skor-kesiapan") ? 8 : 7;');
  });

  it("ruang tetap terbaca pada mode ringkas", () => {
    // Kolomnya hilang, keterangannya tidak boleh ikut hilang.
    expect(berkas).toContain('title={`Ruang sidang: ${baris.ruangan}`}');
  });
});
