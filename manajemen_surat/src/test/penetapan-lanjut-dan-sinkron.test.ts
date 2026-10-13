// @vitest-environment node

import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * ============================================================================
 * MELANJUTKAN RANTAI PENETAPAN, DAN MEMPERLIHATKAN APA YANG AKAN DITULIS
 * ============================================================================
 *
 * Dua permintaan pengguna, dan keduanya tentang hal yang sama: yang menekan
 * tombol harus tahu persis apa yang akan terjadi.
 *
 *   1. sesudah PMH boleh dibuat PPP/PJS/PHS; sesudah PPP boleh PJS/PHS;
 *      sesudah PJS boleh PHS - dan waktunya harus seperti dikerjakan manusia;
 *   2. pilihan otomatis dan manual harus SALING SINKRON: nama pejabat,
 *      tanggal, dan ruang sidang yang dipilih tangan harus benar di pratinjau
 *      DAN sesudah eksekusi.
 *
 * ============================================================================
 * APA YANG SUDAH ADA SEBELUM INI - DIKATAKAN SUPAYA TIDAK DIKLAIM DUA KALI
 * ============================================================================
 *
 * Rantainya SUDAH berjalan: "_sudah_ada" dicatat lalu dilewati, dan langkah
 * berikutnya tetap dikerjakan. Jam tiap langkah pun SUDAH disebar seperti
 * tangan manusia lewat waktuLangkah.
 *
 * Yang belum: tiga dari empat hal yang dapat dipilih tangan tidak pernah
 * terbaca sebelum ditekan - tanggal penetapan, ruang sidang, dan pejabat
 * penetapnya. Ruang sidang yang paling merugikan: ia sudah DIKIRIM ke mesin
 * tulis sejak lama tanpa pernah dipajang, sehingga sidang keliling yang salah
 * ruangannya baru ketahuan berbulan kemudian oleh penyusun laporan.
 */

const akar = path.resolve(process.cwd(), "..");
const baca = (jalur: string) =>
  readFileSync(path.join(akar, jalur), "utf8").replace(/\r\n/g, "\n");

const konten = baca("ekstensi-sipp/konten.js");
const tulis = baca("aleta_bot/services/penetapanTulisService.js");
const penunjukan = baca("aleta_bot/services/penunjukanService.js");

describe("butir 1 - rantai boleh dilanjutkan, dan yang ditolak hanya yang mustahil", () => {
  it("langkah yang sudah ada TIDAK memutus rantai", () => {
    // Perilaku yang sudah ada, dijaga supaya tidak hilang: tanpa ini, perkara
    // yang PMH-nya sudah ditetapkan tidak akan pernah dapat dilanjutkan.
    const i = konten.indexOf("if (!berhasil) {");
    expect(i).toBeGreaterThan(-1);
    const blok = konten.slice(i, i + 260);
    expect(blok).toContain("/_sudah_ada$/.test(kode)");
    expect(blok).toContain("rantaiSebelum.push(jenis)");
    expect(blok).toContain("continue");
  });

  it("penolakan tanggal hanya untuk yang MENDAHULUI, bukan yang sekadar berbeda", () => {
    // Terukur pada SIPP satker, penetapan 2026:
    //     PPP setanggal PMH  637 (80%)   PPP BEDA  161 (20%)
    //     PHS setanggal PMH  679 (85%)   PHS BEDA  119 (15%)
    // Penolakan atas SEMUA yang berbeda menolak satu dari lima perkara yang
    // sah. Yang sungguh mustahil hanya langkah yang ditanggali lebih awal
    // daripada langkah yang sudah ada - PPP tidak dapat mendahului PMH.
    expect(tulis).toContain('alasan: "tanggal_penetapan_mendahului"');
    expect(tulis).not.toContain('alasan: "tanggal_penetapan_tidak_sama"');
    expect(tulis).toContain("minta.tanggalPenetapan < palingAwal");
  });

  it("bedanya dibawa sebagai CATATAN, bukan ditelan diam-diam", () => {
    // Ditelan diam-diam berarti yang menekan tombol tidak tahu penetapannya
    // bertanggal lain daripada PMH-nya, dan baru menyadarinya ketika laporan
    // per hari tidak cocok.
    expect(tulis).toContain("const catatanTanggal =");
    expect(tulis).toContain("catatanTanggal,");
  });

  it("angkanya TERTULIS, supaya penjaganya tidak dibuang saat merapikan", () => {
    const i = tulis.indexOf("YANG DITOLAK HANYA YANG MUSTAHIL");
    expect(i).toBeGreaterThan(-1);
    const catatan = tulis.slice(i, i + 1400);
    expect(catatan).toContain("637");
    expect(catatan).toContain("161");
  });

  it("tanggal lanjutannya tetap mengikuti PMH - keputusan pengguna", () => {
    // Diputuskan pengguna 22 September 2026: PPP/PJS/PHS yang menyusul tetap
    // bertanggal PMH, sebab 80% praktik satker memang begitu.
    //
    // Penjaga ini menahan bawaan itu agar tidak berubah diam-diam. Penjaga di
    // atas hanya membuka KEMUNGKINAN tanggal lain; ia tidak mengubah bawaannya.
    expect(penunjukan).toContain(
      "const tanggalPenetapan = penetapan.pmh || isoTanggal(new Date());"
    );
  });

  it("jam tiap langkah tetap disebar seperti tangan manusia", () => {
    // Perilaku yang sudah ada. Dijaga di sini karena permintaan penggunanya
    // menyebutnya lagi ("ingat buatnya seperti manusia"), dan karena rantai
    // yang kini boleh melintasi hari melewati jalur yang sama.
    // Butir 17 (13 Okt 2026): satu mesin - jamRangkaianManusia - berjeda acak
    // dari sebaran terukur, dan tidak pernah mencatat jam yang belum terjadi
    // (dijalankan di jam-penetapan-sesudah-pendaftaran.test.ts).
    expect(tulis).toContain("function jamRangkaianManusia(");
    expect(tulis).toContain("ujung = kini;");
  });
});

describe("butir 2 - yang dipilih tangan terbaca SEBELUM ditekan", () => {
  const rapor = (() => {
    const i = konten.indexOf("function raporPraperiksa(");
    expect(i).toBeGreaterThan(-1);
    return konten.slice(i, konten.indexOf("\n}", konten.indexOf("return { baris, ganjalan", i)));
  })();

  it("tanggal penetapan dipajang", () => {
    // Dahulu tidak pernah dipajang sama sekali. Selama seluruh langkah wajib
    // setanggal itu masih dapat dimaklumi; sejak rantainya boleh melintasi
    // hari, justru tanggal inilah yang paling perlu diperiksa.
    expect(rapor).toContain('label: "Tanggal penetapan"');
    expect(rapor).toContain("sebutTanggal(usulan.tanggalPenetapan)");
  });

  it("ruang sidang dipajang, dan dengan NAMANYA bukan nomornya", () => {
    // "3" tidak memberi tahu siapa pun ruangan mana yang dimaksud.
    expect(rapor).toContain('label: "Ruang sidang"');
    expect(rapor).toContain("ruanganTersimpan");
    expect(rapor).toContain("tempat.nama");
  });

  it("daftar ruangan yang belum terbaca dikatakan apa adanya", () => {
    // Bukan disamarkan menjadi nomor yang tampak pasti.
    expect(rapor).toContain("namanya belum terbaca");
  });

  it("pejabat penetap tiap langkah dipajang - nama DAN akun SIPP", () => {
    // Akun SIPP-nya ikut disebut sebab itulah yang mendarat di kolom pengguna
    // dan di sys_audittrail. Kalau pemetaan jabatan ALETA salah, ketahuannya
    // di sini - sebelum tertulis, bukan sesudah.
    //
    // Diputuskan pengguna 22 September 2026: nama + akun, bukan nama saja.
    // Butir 17 (13 Okt 2026): "akan dicatat atas nama <pejabat> (akun SIPP x)".
    expect(rapor).toContain("`Penetap ${jenis}`");
    expect(rapor).toContain("`akan dicatat atas nama ${nama || username} (akun SIPP ${username})`");
  });

  it("yang dipilih tangan DITANDAI, yang dari mesin tidak", () => {
    // Tanpa tanda itu, petugas yang baru saja memilih pejabat lain tidak
    // punya cara memastikan pilihannya sampai - dan pilihan yang tidak
    // sampai tidak berbunyi apa pun.
    expect(rapor).toContain('sebab: tangan ? "pilihan Anda" : ""');
    expect(rapor).toContain('sebab: "pilihan Anda"');
  });

  it("catatan tanggal dari bot ikut terbaca di pratinjau", () => {
    expect(rapor).toContain("catatanTanggal");
  });
});

describe("butir 2 - dan terbaca lagi SESUDAH ditekan", () => {
  const hasil = (() => {
    const i = konten.indexOf("function gambarHasilTulis(");
    expect(i).toBeGreaterThan(-1);
    return konten.slice(i, i + 4200);
  })();

  it("tanggalnya diulang sesudah penulisan sungguhan", () => {
    // Yang sudah tertulis ke SIPP tidak dapat dilihat lagi dari panel tanpa
    // membuka SIPP.
    expect(hasil).toContain("Bertanggal ${sebutTanggal(satu.tanggalPenetapan)}");
  });

  it("hanya pada penulisan sungguhan, tidak pada uji kering", () => {
    // Pada uji kering tanggalnya sudah disebut rapor di atas; mengulangnya di
    // tiap baris hanya memanjangkan yang sudah terbaca.
    expect(hasil).toContain("if (!kering && satu.ok && satu.tanggalPenetapan)");
  });

  it("catatan tanggalnya ikut, supaya tidak hilang sesudah ditulis", () => {
    expect(hasil).toContain("for (const catatan of satu.catatanTanggal || [])");
  });

  it("rantai membawa tanggal dan catatannya dari jawaban bot", () => {
    const i = konten.indexOf("async function rantaiPenetapan(");
    const blok = konten.slice(i, konten.indexOf("\n}", konten.indexOf("return hasil;", i)));
    expect(blok).toContain("catatanTanggal: (jawab && jawab.catatanTanggal) || []");
    expect(blok).toContain('tanggalPenetapan: (jawab && jawab.tanggalPenetapan) || ""');
  });
});

describe("yang dipajang berasal dari SUMBER YANG SAMA dengan yang ditulis", () => {
  it("hari sidang dipajang lewat idUntukTulis, bukan dihitung ulang", () => {
    // Inti permintaan penggunanya: yang ditampilkan harus BENAR, artinya sama
    // dengan yang akan ditulis. Dua perhitungan terpisah berarti pratinjau
    // yang benar sendiri dan tulisan yang benar sendiri - dan bedanya hanya
    // ketahuan sesudah tertulis.
    const i = konten.indexOf("function raporPraperiksa(");
    const blok = konten.slice(i, i + 3000);
    expect(blok).toContain('const nilaiPhs = idUntukTulis("phs", usulan, pilihanManual);');
    expect(blok).toContain("nilaiPhs && nilaiPhs.tanggalSidang");
  });

  it("ruangan yang dipajang dibaca dari pilihanManual yang sama dengan yang dikirim", () => {
    const iTulis = konten.indexOf("const ruanganId = Number(pilihanManual.ruangan);");
    const iRapor = konten.indexOf("const idRuangan = Number(pilihanManual.ruangan);");
    expect(iTulis).toBeGreaterThan(-1);
    expect(iRapor).toBeGreaterThan(-1);
  });
});
