// @vitest-environment node

import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * ============================================================================
 * UNGGAH PUTUSAN - EMPAT PERMINTAAN YANG BERAKAR PADA SATU HAL
 * ============================================================================
 *
 *   1. unggah ke form putusan SIPP terasa LAMBAT
 *   2. unggah putusan + anonimisasi ERROR dan tidak mau terunggah
 *   3. unggah putusan dapat dijalankan dari halaman ABT
 *   5. unggah massal bermula dari BERKAS, bukan dari tanggal sidang
 *
 * Yang dijaga di sini BUKAN adanya kode, melainkan sifat yang salahnya tidak
 * berbunyi: batas waktu yang berurutan, pemeriksaan yang terbatas, dan
 * pencocokan berkas yang menolak menebak.
 */

const akar = path.resolve(process.cwd(), "..");
const baca = (jalur: string) =>
  readFileSync(path.join(akar, jalur), "utf8").replace(/\r\n/g, "\n");

const konten = baca("ekstensi-sipp/konten.js");
const abt = baca("ekstensi-sipp/abt.js");
const gerbang = baca("manajemen_surat/src/server/modules/aleta-bot/whatsapp-gateway-client.ts");

/**
 * Angka tetapan dari sumbernya - bukan diketik ulang di sini. Pemisah angka
 * ("150_000") ikut dikenali: menulis ulang tetapan dengan pemisah tidak boleh
 * membuat penjaga ini gagal dengan "tidak ketemu".
 */
function angka(isi: string, nama: string): number {
  const cocok = new RegExp(`const ${nama} = (\\d[\\d_]*);`).exec(isi);
  expect(cocok, `tetapan ${nama} tidak ketemu`).toBeTruthy();
  return Number(cocok![1].replace(/_/g, ""));
}

/**
 * Batas waktu gerbang saat menulis putusan ke SIPP. Nilainya juga diukur
 * dengan MENJALANKAN gatewayUnggahPutusanSipp di soffice-singgah-sejajar.test.ts
 * (fetch ditiru, jam tiruan: batal tepat pada 120.000 ms).
 */
function batasGerbang(): number {
  const i = gerbang.indexOf("export async function gatewayUnggahPutusanSipp(");
  expect(i).toBeGreaterThan(-1);
  // Sampai penutup fungsi yang SEBENARNYA - "\n}\n". Memotong pada "\n}" saja
  // berhenti di penutup tipe literal di dalamnya, jauh sebelum timeoutMs.
  const blok = gerbang.slice(i, gerbang.indexOf("\n}\n", i));
  const cocok = /timeoutMs:\s*(\d[\d_]*)/.exec(blok);
  expect(cocok, "timeoutMs gerbang tidak ketemu").toBeTruthy();
  return Number(cocok![1].replace(/_/g, ""));
}

describe("butir 2 - batas waktu MENAIK dari dalam ke luar", () => {
  // ==========================================================================
  // INILAH SEBAB "ERROR DAN TIDAK MAU TERUPLOAD"
  // ==========================================================================
  //
  // Sebelum perbaikan:
  //
  //     ekstensi   BATAS_UNGGAH_NASKAH_MS = 45000   dipakai unggah ke SIPP
  //     gerbang    timeoutMs              = 60000
  //
  // Ekstensi menyerah LEBIH DAHULU. Unggahan 45-60 detik dibatalkan di layar -
  // petugas melihat galat - sementara botnya terus bekerja dan mungkin
  // menyelesaikannya. Komentar pada gerbangnya sendiri menyebut akibatnya:
  // "meninggalkan berkas yang sudah tertulis tanpa barisnya".
  //
  // Anonimisasi paling sering kena, dan sebabnya aritmetika: kedua berkas
  // dikirim dalam SATU permintaan, jadi bitanya dua kali lipat.

  it("batas ekstensi LEBIH LAMA daripada batas gerbang", () => {
    const luar = angka(konten, "BATAS_UNGGAH_SIPP_MS");
    expect(luar).toBeGreaterThan(batasGerbang());
  });

  it("batas ABT pun lebih lama - dahulu persis sama, tanpa selisih", () => {
    // Sama persis berarti keduanya menyerah pada saat yang sama, dan yang
    // membatalkan lebih dahulu meninggalkan pekerjaan setengah jalan.
    expect(angka(abt, "BATAS_UNGGAH_MASSAL_MS")).toBeGreaterThan(batasGerbang());
  });

  it("unggah ke SIPP memakai batasnya sendiri, bukan batas unggah naskah", () => {
    const i = konten.indexOf('"Mengunggah putusan ke SIPP"');
    expect(i).toBeGreaterThan(-1);
    const sekitar = konten.slice(Math.max(0, i - 400), i);
    expect(sekitar).toContain("BATAS_UNGGAH_SIPP_MS");
    expect(sekitar).not.toContain("batasMs: BATAS_UNGGAH_NASKAH_MS");
  });

  it("unggah NASKAH tetap memakai batasnya yang lama - ia tidak menulis ke SIPP", () => {
    // Memperpanjang yang ini pun tidak merugikan, tetapi ia bukan bagian dari
    // cacatnya - dan mengubah yang tidak rusak menyamarkan apa yang diperbaiki.
    const i = konten.indexOf('"Mengirim naskah putusan"');
    expect(i).toBeGreaterThan(-1);
    expect(konten.slice(Math.max(0, i - 400), i)).toContain("BATAS_UNGGAH_NASKAH_MS");
  });

  it("sebabnya TERTULIS, supaya angkanya tidak dipulangkan saat merapikan", () => {
    const i = konten.indexOf("const BATAS_UNGGAH_SIPP_MS");
    const catatan = konten.slice(Math.max(0, i - 2400), i);
    // Batas gerbang yang BERLAKU (sejak 25 September 2026, kontrak K6:
    // 120 detik) harus tertulis di catatannya - bukan angka lama yang sudah
    // tidak berlaku. Dahulu penjaga ini menuntut "60000".
    expect(catatan).toContain(`gerbang ${batasGerbang() / 1000} detik`);
    expect(catatan.toLowerCase()).toContain("menaik dari dalam ke luar");
  });

  it("urutan K6 utuh: gerbang 120 dtk, dan kedua batas ekstensi 150 dtk", () => {
    expect(batasGerbang()).toBe(120000);
    expect(angka(konten, "BATAS_UNGGAH_SIPP_MS")).toBeGreaterThanOrEqual(150000);
    expect(angka(abt, "BATAS_UNGGAH_MASSAL_MS")).toBeGreaterThanOrEqual(150000);
  });
});

describe("butir 1 - pemeriksaan draf berbarengan, TERBATAS", () => {
  it("ada pembantu berbarengan yang terbatas", () => {
    expect(konten).toContain("async function berbarenganTerbatas(");
  });

  it("pemeriksaan draf memakainya, bukan gelung berurutan", () => {
    expect(konten).toContain("await berbarenganTerbatas(belum, 6,");
    expect(konten).not.toContain("for (const s of belum) {\n      const d = await adaDraf");
  });

  it("TERBATAS, bukan seluruhnya sekaligus", () => {
    // Dua puluh permintaan serentak ke SIPP lewat satu gerbang menukar
    // menunggu dengan menumpuk - dan yang menumpuk menahan permintaan lain di
    // layar yang sama, termasuk yang sedang ditunggu orang lain.
    const i = konten.indexOf("async function berbarenganTerbatas(");
    const blok = konten.slice(i, konten.indexOf("\n  }", i));
    expect(blok).toContain("Math.min(sekaligus, butir.length)");
    expect(blok).not.toContain("butir.map(");
  });

  it("jawaban draf disimpan UTUH, tidak ditarik dua kali", () => {
    // Sebelumnya seluruh draf ditarik lalu dibuang - hanya { ada, sebab } yang
    // disimpan - dan pengisian borang menariknya LAGI utuh.
    const i = konten.indexOf("async function adaDraf(");
    const blok = konten.slice(i, konten.indexOf("\n  }", i));
    expect(blok).toContain("isi: d || null");
  });
});

describe("butir 3 - unggah dari halaman ABT", () => {
  it("panelnya ada dan dipasang di panel PERKARA", () => {
    expect(abt).toContain("function bagianUnggahSatuAbt(");
    expect(abt).toContain("bagianUnggahSatuAbt(isi);");
  });

  it("TIDAK menyalin logika unggah - memanggil yang sudah ada", () => {
    // Penjaga terpenting di sini. Dua salinan akan lambat laun berbeda, dan
    // yang berbeda diam-diam adalah yang menulis ke SIPP.
    const i = abt.indexOf("function bagianUnggahSatuAbt(");
    const blok = abt.slice(i, abt.indexOf("\n}", abt.indexOf("isi.appendChild(kotak)", i)));
    expect(blok).toContain("await kerjakanSatuPerkaraAbt(");
    expect(blok).not.toContain("ALETA_API_UNGGAH_SIPP_ABT");
    expect(blok).not.toContain("new FormData()");
  });

  it("blangkonya DIPILIH, bukan ditebak dari halaman", () => {
    // Halaman ABT tidak menyebut jenis perkaranya dalam bentuk yang dapat
    // dibaca pasti. Blangko yang salah menghasilkan putusan yang salah
    // bentuknya - dan itu baru ketahuan sesudah tercetak.
    const i = abt.indexOf("function bagianUnggahSatuAbt(");
    const blok = abt.slice(i, i + 6000);
    expect(blok).toContain("pilihBlangko");
    // Tetapan yang tidak pernah ada, sempat terkarang, dan tidak boleh kembali.
    expect(abt).not.toContain("KODE_JENIS_PERKARA");
  });

  it("hanya blangko yang SUDAH dipetakan yang ditawarkan", () => {
    const i = abt.indexOf("function bagianUnggahSatuAbt(");
    const blok = abt.slice(i, i + 6000);
    expect(blok).toContain("alatBlangkoLengkap(peta[k])");
  });

  it("halaman tanpa perkara tidak diberi panel", () => {
    // Panel yang tergambar tetapi tidak dapat dipakai hanya menambah tombol
    // yang menolak - dan yang menekannya menyangka ada yang rusak.
    const i = abt.indexOf("function bagianUnggahSatuAbt(");
    expect(abt.slice(i, i + 1600)).toContain("if (!jatiDiri || !jatiDiri.perkaraId) return null;");
  });
});

describe("butir 5 - massal bermula dari berkas", () => {
  const bagian = (() => {
    const i = konten.indexOf("function bagianMassalBerkas(");
    expect(i).toBeGreaterThan(-1);
    return konten.slice(i, konten.indexOf("\n  isi.appendChild(kotak);", i));
  })();

  it("panelnya ada dan dipasang", () => {
    // Sejak 26 September 2026 dengan sesudahSusun: antrean yang baru disusun
    // langsung tampil di panel daftar (tampilkanAntreanSipp).
    expect(konten).toContain("bagianMassalBerkas(isi, () => void tampilkanAntreanSipp(isi));");
  });

  it("pemilihnya menerima LEBIH DARI SATU berkas", () => {
    // Sebelum ini tidak satu pun pemilih berkas di ekstensi menyetel multiple.
    expect(bagian).toContain("pemilih.multiple = true;");
  });

  it("nomor perkara dipetik dari NAMA berkas", () => {
    expect(bagian).toContain("POLA_PERKARA.exec(");
  });

  it("lastIndex disetel ulang - POLA_PERKARA berbendera /g", () => {
    // RegExp berbendera g MENGINGAT posisinya di antara pemanggilan. Tanpa
    // menyetelnya, berkas kedua dicari mulai dari tempat berkas pertama
    // berhenti - dan nomor yang ada tidak ketemu.
    expect(bagian).toContain("POLA_PERKARA.lastIndex = 0;");
  });

  it("yang tidak terbaca DILEWATI, bukan ditebak", () => {
    // Memasangkan naskah putusan ke perkara yang salah berarti putusan orang
    // lain masuk ke berkas orang ini - dan itu tidak dapat dibatalkan dengan
    // menekan ulang.
    expect(bagian).toContain("pasangan.filter((p) => p.nomor)");
    expect(bagian).toContain("tidak terbaca");
  });

  it("seluruh pasangan diperlihatkan SEBELUM satu berkas pun dikirim", () => {
    const iGambar = bagian.indexOf("function gambarDaftar()");
    const iKirim = bagian.indexOf('tombol.addEventListener("click"');
    expect(iGambar).toBeGreaterThan(-1);
    expect(iKirim).toBeGreaterThan(iGambar);
  });

  it("tombolnya mati selama tidak ada satu pun yang cocok", () => {
    expect(bagian).toContain("tombol.disabled = cocok === 0;");
  });

  it("dikirim BERURUTAN - tiap berkas diurai utuh di peladen", () => {
    // Berbeda dari pemeriksaan draf di butir 1: yang itu bacaan ringan, yang
    // ini muatan berat. Dua puluh naskah sekaligus berarti dua puluh naskah di
    // memori peladen pada saat yang sama.
    expect(bagian).toContain("for (let i = 0; i < dikerjakan.length; i += 1)");
    expect(bagian).not.toContain("berbarenganTerbatas(dikerjakan");
  });

  it("perkaraId TIDAK ditebak - ia tidak diketahui dari berkas", () => {
    expect(bagian).toContain("perkaraId TIDAK dikirim");
  });
});
