// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * ============================================================================
 * PAPAN YANG MENYALA SEPANJANG HARI TIDAK BOLEH MENAMPILKAN RUANG ORANG LAIN
 * ============================================================================
 *
 * Layar-layar ini menyala dari pagi sampai sidang terakhir, menghadap orang
 * yang menunggu gilirannya. Tidak ada petugas yang menatapnya, dan tidak ada
 * yang menyegarkan halamannya. Apa pun yang salah di sini salah berjam-jam.
 *
 * Yang dijaga: penanda hidup pada tiap penyegaran berkala.
 *
 * Permintaan yang sedang di jalan TIDAK ikut berhenti ketika nomor ruangnya
 * berganti atau layarnya dilepas. Tanpa penanda itu, jawaban ruang sebelumnya
 * tetap ditulis ke layar - papan di depan pintu ruang 3 memperlihatkan antrian
 * ruang lain, dan tidak ada seorang pun yang tahu sejak kapan.
 *
 * Penanda semacam itu TIDAK TERLIHAT bekerja. Ia tidak menambah apa pun di
 * layar, tidak ada yang gagal bila ia dihapus, dan orang berikutnya yang
 * membaca effect ini wajar mengiranya sisa percobaan. Itu sebabnya ia dijaga
 * di sini alih-alih diserahkan pada ingatan.
 */

const akar = process.cwd();

/** Berkas layar berkala, beserta nama pembacanya. */
const LAYAR = [
  { berkas: "src/app/antrian-layar/page.tsx", nama: "papan besar antrian ruang tunggu" },
  { berkas: "src/app/antrian-ruang/page.tsx", nama: "papan antrian per ruang" },
  { berkas: "src/app/sidang-ruang/page.tsx", nama: "papan sidang di depan pintu" },
  { berkas: "src/components/portal/aleta-antrian-layar.tsx", nama: "layar antrian di portal" },
  { berkas: "src/components/portal/aleta-antrian-panggil.tsx", nama: "papan panggilan petugas" },
  { berkas: "src/components/portal/aleta-antrian-ambil.tsx", nama: "pengambilan nomor antrian" },
];

const isi = (berkas: string) => readFileSync(path.resolve(akar, berkas), "utf8");

describe("penyegaran berkala membawa penanda hidup", () => {
  for (const { berkas, nama } of LAYAR) {
    it(`${nama} membatalkan penulisan setelah dilepas`, () => {
      const teks = isi(berkas);

      // Ketiganya harus ada bersama-sama. Penanda tanpa pemeriksaan tidak
      // menahan apa pun, dan pemeriksaan tanpa pembersihan tidak pernah
      // berubah nilainya - keduanya penjagaan yang hanya tampak seperti
      // penjagaan.
      expect(teks, "penanda hidup").toContain("let hidup = true;");
      // Tanpa kurung penutup: sebagian layar menggabungkannya dengan
      // pemeriksaan lain - `if (!hidup || !hasil) return;`. Yang dijaga
      // pemeriksaannya, bukan bentuk tulisnya.
      expect(teks, "pemeriksaan sebelum menulis").toContain("if (!hidup");
      expect(teks, "pembersihan saat dilepas").toContain("hidup = false;");
    });
  }

  it("tidak ada lagi pengambil yang dipanggil telanjang di dalam effect", () => {
    // Bentuk lama: `void ambil(ruang);` tepat di badan effect, dengan
    // penulisan keadaan tersembunyi di dalam pengambilnya. Selama penulisan
    // itu tersembunyi, effect-nya tidak punya kesempatan memutuskan apakah
    // hasilnya masih layak dipakai.
    for (const { berkas, nama } of LAYAR) {
      const teks = isi(berkas);
      expect(teks, nama).not.toContain("void ambil(ruang);");
      expect(teks, nama).not.toContain("void muat();");
    }
  });
});

describe("kegagalan sesaat tidak mengosongkan papan", () => {
  for (const berkas of ["src/app/antrian-layar/page.tsx", "src/app/antrian-ruang/page.tsx"]) {
    it(`${path.basename(path.dirname(berkas))} mempertahankan daftar lama saat gagal`, () => {
      // Papan yang mendadak kosong terbaca sebagai "tidak ada sidang hari
      // ini" oleh orang yang sedang menunggu gilirannya - kesimpulan yang
      // membuatnya pulang. Daftar yang terlambat delapan detik tidak.
      //
      // Perbedaan gagal dan kosong dibawa oleh baris bernilai null; daftar
      // kosong berarti memang tidak ada yang mengantre.
      const teks = isi(berkas);
      expect(teks).toContain("baris: null");
      expect(teks).toContain("if (bacaan.baris) setBaris(bacaan.baris);");
    });
  }
});

describe("pengecualian aturan effect selalu menyebutkan alasannya", () => {
  it("tiap set-state-in-effect yang dimatikan punya keterangan di atasnya", () => {
    // ========================================================================
    // PENGECUALIAN TANPA ALASAN ADALAH PENGECUALIAN YANG AKAN BERANAK
    // ========================================================================
    //
    // Tiga dari sepuluh keluhan aturan ini memang tidak tepat: nomor ruang
    // hanya ada di alamat peramban sedangkan gambar pertamanya disusun di
    // server, dan kedipan adalah kejadian - "baru saja berganti" tidak ada di
    // dalam data mana pun, ia ada di dalam perbandingan dengan sebelumnya.
    //
    // Tetapi pengecualian yang tidak menyebutkan sebabnya tidak dapat
    // dibedakan dari pengecualian yang dipasang orang yang menyerah. Yang
    // kedua itulah yang lama-lama membuat seluruh aturan tidak berarti.
    for (const { berkas, nama } of LAYAR) {
      const baris = isi(berkas).split(/\r?\n/);
      baris.forEach((satu, i) => {
        if (!satu.includes("eslint-disable-next-line react-hooks/set-state-in-effect")) return;
        const sebelumnya = (baris[i - 1] || "").trim();
        expect(
          sebelumnya.startsWith("//"),
          `${nama} baris ${i + 1}: pengecualian tanpa keterangan`
        ).toBe(true);
      });
    }
  });
});
