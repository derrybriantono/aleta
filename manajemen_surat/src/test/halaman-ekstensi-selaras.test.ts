// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * ============================================================================
 * HALAMAN EKSTENSI DAN PESAN GALATNYA HARUS BERKATA SAMA
 * ============================================================================
 *
 * Ketika ALETA tidak terjangkau, yang disimpulkan petugas selalu sama:
 * ekstensinya rusak. Lalu panelnya ditutup, dan sesudah beberapa kali begitu
 * ia berhenti memakainya - padahal bagian terbesar ekstensi ini tidak pernah
 * menyentuh ALETA sama sekali.
 *
 * Daftar "yang tetap jalan" karena itu diucapkan DUA KALI: di halaman Ekstensi
 * SIPP, dan di dalam pesan galat ekstensi sendiri. Dua tempat yang mengucapkan
 * hal yang sama akan menyimpang - itu selalu terjadi - dan halaman yang
 * menjanjikan sesuatu tetap jalan sementara pesan galatnya berkata lain lebih
 * membingungkan daripada tidak ada keterangan sama sekali.
 *
 * Penjaga ini mengadu keduanya butir demi butir.
 *
 * ============================================================================
 * KENAPA DAFTARNYA TIDAK DISATUKAN SAJA
 * ============================================================================
 *
 * Karena keduanya hidup di dunia yang berbeda: yang satu komponen React di
 * dalam portal, yang lain berkas JavaScript polos yang berjalan di halaman
 * SIPP milik aplikasi lain, tanpa pembangun dan tanpa impor. Menyatukannya
 * menuntut ekstensi mengambil daftarnya dari portal - dan daftar tentang
 * "apa yang jalan ketika portal mati" tidak boleh datang dari portal.
 *
 * Jadi keduanya memang harus terpisah, dan justru karena itu kesamaannya
 * harus dijaga dari luar.
 */

const akar = path.resolve(process.cwd(), "..");

const halaman = () =>
  readFileSync(
    path.join(akar, "manajemen_surat/src/components/portal/aleta-ecourt-pengguna.tsx"),
    "utf8"
  );

/**
 * Isi halaman dengan spasinya dirapatkan.
 *
 * Prosa di dalam JSX dipenggal baris oleh perapi kode, di tempat yang
 * ditentukannya sendiri. Memeriksa kalimat apa adanya berarti uji ini gagal
 * setiap kali perapi memindahkan pemenggalannya - gagal atas kalimat yang
 * tidak berubah sepatah kata pun.
 */
const halamanRapat = () => halaman().replace(/\s+/g, " ");

const panelAlat = () => readFileSync(path.join(akar, "ekstensi-sipp/panel-alat.js"), "utf8");

/**
 * Butir yang harus disebut KEDUANYA.
 *
 * Ditulis sebagai pasangan kata kunci, bukan kalimat utuh: halaman memakai
 * bahasa yang lebih panjang daripada pesan galat yang harus muat di satu
 * baris panel. Yang dijaga kesamaan MAKSUDNYA, bukan susunan katanya.
 */
const TETAP_JALAN: Array<{ halaman: string; pesan: string }> = [
  { halaman: "Tema gelap dan terang", pesan: "tema" },
  { halaman: "Penandaan halaman", pesan: "penandaan halaman" },
  { halaman: "Penjaga CETAK", pesan: "penjaga CETAK" },
  { halaman: "Sunting variabel ABT", pesan: "sunting variabel ABT" },
  { halaman: "Pembersih keterangan saksi", pesan: "keterangan saksi" },
];

const MENUNGGU: Array<{ halaman: string; pesan: string }> = [
  { halaman: "Usulan dari keterangan saksi", pesan: "usulan dari keterangan saksi" },
  { halaman: "Huruf alasan", pesan: "huruf alasan" },
  { halaman: "Perapian posita", pesan: "perapian posita" },
  { halaman: "PDF", pesan: "PDF" },
  { halaman: "Penunjukan", pesan: "penunjukan" },
  { halaman: "Data Umum", pesan: "Data Umum" },
];

describe("daftar yang tetap jalan tanpa ALETA", () => {
  it("halaman Ekstensi SIPP menyebut seluruhnya", () => {
    const isi = halaman();
    expect(isi).toContain("Tetap jalan walau ALETA mati");
    for (const butir of TETAP_JALAN) {
      expect(isi, butir.halaman).toContain(butir.halaman);
    }
  });

  it("pesan galat ekstensi menyebut seluruhnya", () => {
    const isi = panelAlat();
    for (const butir of TETAP_JALAN) {
      expect(isi, butir.pesan).toContain(butir.pesan);
    }
  });

  it("keduanya menyebut yang MENUNGGU ALETA dengan sama", () => {
    const isiHalaman = halaman();
    const isiPesan = panelAlat();
    for (const butir of MENUNGGU) {
      expect(isiHalaman, `halaman: ${butir.halaman}`).toContain(butir.halaman);
      expect(isiPesan, `pesan: ${butir.pesan}`).toContain(butir.pesan);
    }
  });

  it("penjaganya sungguh dapat gagal", () => {
    // Penjaga yang tidak dapat gagal bukan penjaga. Butir karangan tidak
    // boleh ditemukan di mana pun.
    expect(halaman()).not.toContain("Penyunting berkas rahasia");
    expect(panelAlat()).not.toContain("Penyunting berkas rahasia");
  });
});

describe("sisi ABT tidak lagi tersembunyi", () => {
  it("halaman menyebut apa yang dikerjakannya di blangko ABT", () => {
    // Seluruh keterangan lain di halaman itu berbicara tentang SIPP. Petugas
    // yang membacanya menyimpulkan ekstensinya tidak menyentuh ABT sama
    // sekali, lalu mengerjakan dengan tangan apa yang sudah ada tombolnya.
    const isi = halaman();
    expect(isi).toContain("Di halaman blangko ABT");
    for (const bagian of [
      "Penjaga CETAK",
      "Menyunting variabel",
      "Membersihkan keterangan saksi",
      "Alasan-Alasan Cerai",
      "Merapikan posita",
    ]) {
      expect(isi, bagian).toContain(bagian);
    }
  });

  it("menyebutkan bahwa penyuntingan lewat jalur ABT sendiri", () => {
    // Batas yang paling perlu dinyatakan: ekstensi tidak menulis ke basis
    // data ABT. Yang tidak menyatakannya akan dicurigai melakukan lebih
    // daripada yang benar-benar dilakukannya.
    expect(halamanRapat()).toContain("penyuntingan milik ABT sendiri");
  });

  it("menyebutkan penjagaan isi pada perapian posita", () => {
    // Perapian posita MENULIS ke kolom posita SIPP. Satu-satunya jalur tulis
    // ke SIPP yang lahir dari halaman ABT, dan penjagaannya harus disebut di
    // tempat orang membacanya - bukan hanya di dalam kode.
    expect(halamanRapat()).toContain("yang berbeda satu huruf pun ditolak");
  });
});
