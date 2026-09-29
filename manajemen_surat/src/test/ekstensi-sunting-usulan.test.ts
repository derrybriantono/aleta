// @vitest-environment node

import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Usulan yang dapat diubah sebelum diisikan, dan jalan membaca ulang.
 *
 * Dua kemampuan yang tampak kecil tetapi menentukan apakah alat ini dipakai:
 *
 *   MENYUNTING. Usulan yang hanya dapat diterima atau ditolak seluruhnya
 *   memaksa petugas membatalkan pertimbangan 8.000 aksara karena satu kata
 *   yang keliru, lalu menyalinnya tangan dari naskahnya - pekerjaan yang
 *   justru hendak dihapus alat ini.
 *
 *   MEMBACA ULANG. Panel dibangun sekali; tanpa jalan menyegarkan, satu-
 *   satunya cara adalah memuat ulang halaman - dan memuat ulang halaman orang
 *   yang sedang mengisi borang membuang isian yang belum disimpan.
 */

const akar = path.resolve(process.cwd(), "..");
const baca = (nama: string) => readFileSync(path.join(akar, "ekstensi-sipp", nama), "utf8");

describe("usulan teks dapat disunting sebelum diisikan", () => {
  const konten = baca("konten.js");

  it("yang diisikan dibaca dari kotak suntingnya, bukan dari usulan semula", () => {
    // Inilah sifat yang menentukan: bila ia kembali memakai teks yang
    // digambar, suntingan petugas hilang tanpa satu pun tanda, dan yang masuk
    // ke putusan adalah kalimat yang justru sudah ia perbaiki.
    expect(konten).toContain('sunting.className = "aleta-abt-isi aleta-sunting"');
    expect(konten).toContain("get teks() {");
    expect(konten).toContain("return sunting.value;");
  });

  it("mengisi yang tadinya kosong menyalakan centangnya", () => {
    // Bagian yang kosong pada draf tetap dapat diisi sendiri - selama
    // centangnya tidak mati selamanya.
    expect(konten).toContain("centang.disabled = !ada;");
    expect(konten).toContain("(kosong pada draf - boleh diisi sendiri)");
  });
});

describe("pilihan dapat diganti tanpa meninggalkan panel", () => {
  const konten = baca("konten.js");

  it("daftarnya berisi pilihan blangko itu sendiri, bukan daftar yang dihafal", () => {
    expect(konten).toContain('pilih.className = "aleta-pilih-sendiri"');
    expect(konten).toContain("for (const pil of medan.pilihan)");
  });

  it("yang diisikan dibaca saat ditekan, bukan saat digambar", () => {
    expect(konten).toContain("get nilaiSemua() {");
    expect(konten).toContain("return bacaPilihanPanel();");
  });

  it("medan bernilai banyak memakai kotak centang, bukan daftar pilih satu", () => {
    // Memilih satu dari daftar tidak pernah dapat menyatakan tiga sumber
    // hukum sekaligus.
    expect(konten).toContain('buatElemen("div", "aleta-pilih-banyak")');
    expect(konten).toContain("semua.filter((x) => x.checked).map((x) => x.value)");
  });

  it("medan yang dicentang tetapi kosong disebut, bukan didiamkan", () => {
    // Dulu pilihan kosong berakhir sebagai pengisian yang tidak terjadi tanpa
    // satu pun kabar - dan petugas menyimpan borang yang dikiranya sudah
    // terisi.
    expect(konten).toContain("belum ada yang dipilih");
  });

  it("gayanya ada, sehingga kemampuannya terlihat", () => {
    const css = baca("panel.css");
    expect(css).toContain("textarea.aleta-sunting");
    expect(css).toContain(".aleta-pilih-sendiri");
    expect(css).toContain(".aleta-pilih-banyak-baris");
  });
});

describe("tombol segarkan", () => {
  it("ada di kaki panel SIPP, dan tidak memuat ulang halamannya", () => {
    // Memuat ulang halaman SIPP membuang isian borang yang belum disimpan -
    // yakni tepat pekerjaan yang sedang dikerjakan orang yang menekannya.
    const konten = baca("konten.js");
    // Ikon saja, bukan tulisan: kaki panel pernah memakan tiga baris, dan
    // tempat itu milik isi panel. Namanya pindah ke aria-label dan title.
    expect(konten).toContain('buatElemen("button", "aleta-kaki-segar", "↻")');
    expect(konten).toContain('segar.setAttribute("aria-label", "Segarkan")');
    expect(konten).toContain("void segarkan();");
    // Dipotong sampai fungsi berikutnya, bukan pada jumlah aksara tertentu:
    // potongan 2.500 aksara sempat memangkas badan fungsinya begitu catatan
    // di dalamnya bertambah, dan penjaga yang memeriksa potongan yang
    // terpangkas gagal karena sebab yang tidak ada hubungannya dengan yang
    // dijaganya.
    const mulai = konten.indexOf("function kakiPanel(");
    const selesai = konten.indexOf("\nfunction ", mulai + 10);
    const bagian = konten.slice(mulai, selesai < 0 ? undefined : selesai);
    expect(bagian.length).toBeGreaterThan(500);
    expect(bagian).not.toContain("location.reload");
    // Penjaga nomorTerakhir harus dikosongkan lebih dulu - tanpa itu
    // segarkan() memulangkan diri sendiri tanpa membaca apa pun.
    expect(bagian).toContain('nomorTerakhir = "";');
  });

  it("ada juga di kaki panel halaman ALETA", () => {
    const aleta = baca("aleta.js");
    expect(aleta).toContain('buatElemen("button", "aleta-kaki-segar", "↻")');
    expect(aleta).toContain("void pasangPortal();");
  });

  it("ada pula di kaki panel ABT - ketiga panel berkaki sama", () => {
    // Panel ABT dibangun sekali saat halaman dibuka. Tanpa ini, usulan yang
    // baru diubah di ALETA tidak pernah terbaca sampai halaman ABT dimuat
    // ulang - dan memuat ulang membuang isian blangko yang belum disimpan.
    const abt = baca("abt.js");
    expect(abt).toContain('buatElemen("button", "aleta-kaki-segar", "↻")');
    expect(abt).toContain("void pasang();");
  });

  it("kaki panel satu baris: pintasan disingkat, keterangannya di title", () => {
    const konten = baca("konten.js");
    expect(konten).toContain('buatElemen("div", "aleta-kaki-baris")');
    expect(konten).toContain('PINTASAN_PANEL.map((x) => x.tombol).join(" · ")');
    // Keterangan lengkapnya tidak hilang - ia pindah ke title.
    expect(konten).toContain("Tidak berlaku selagi mengetik di kolom isian.");
  });

  it("tombol kepala panel SIPP di dalam wadah yang sama dengan panel ABT dan ALETA", () => {
    // .aleta-alat-kepala ber-margin-left: auto - tombolnya di ujung kanan.
    // Panel SIPP dulu menempelkannya langsung ke kepala, satu per satu,
    // sehingga seluruhnya berkumpul di kiri dengan ruang kosong di kanan.
    const konten = baca("konten.js");
    expect(konten).toContain('const alatKepala = buatElemen("span", "aleta-alat-kepala")');
    expect(konten).toContain("kepala.appendChild(alatKepala);");
    // Tidak ada lagi tombol yang menempel langsung ke kepala.
    for (const langsung of [
      "kepala.appendChild(tombolTema(panel));",
      "kepala.appendChild(penuh);",
      "kepala.appendChild(bawaan);",
      "kepala.appendChild(lipat);",
      "kepala.appendChild(tombolMatikan());",
    ]) {
      expect(konten, langsung).not.toContain(langsung);
    }
  });

  it("gayanya lebih redup daripada tombol yang MENULIS ke SIPP", () => {
    // Tombol baca yang seterang tombol tulis mengajak ditekan tanpa alasan.
    const css = baca("panel.css");
    expect(css).toContain(".aleta-kaki-segar");
    const blok = css.slice(css.indexOf(".aleta-kaki-segar {"));
    expect(blok.slice(0, 300)).toContain("background: transparent");
  });
});

describe("ukuran panel bawaan", () => {
  it("lebih lebar dan lebih tinggi daripada sebelumnya", () => {
    const css = baca("panel.css");
    expect(css).toContain("width: 460px;");
    expect(css).toContain("max-height: 66vh;");
  });

  it("atapnya tetap ada - di bawah panel ada blangko yang sedang diisi", () => {
    const konten = baca("konten.js");
    expect(konten).toContain("Math.round((window.innerHeight * 2) / 3)");
  });
});

describe("jembatan membaca label kotak centang yang ditulis sebagai teks telanjang", () => {
  const jembatan = baca("jembatan.js");

  it("tulisan di sebelah kotak dibaca sebagai namanya", () => {
    // SIPP menulis Sumber Hukum sebagai:
    //   <input type='checkbox' name='sumber_hukum[]' value=8 />Kompilasi Hukum Islam<br/>
    // Tanpa ini, yang terkirim ke ALETA sebagai label adalah "8" - dan
    // keenam sumber hukum bernilai nol pada penilaian mana pun.
    expect(jembatan).toContain("function tulisanSesudah(");
    expect(jembatan).toContain('tag === "br"');
  });

  it("dicari sebelum <label> milik barisnya, sebab label itu menamai kelompoknya", () => {
    // <label> milik baris berbunyi "Sumber Hukum" untuk keenam kotaknya
    // sekaligus - dan enam pilihan yang kembar tidak dapat dibedakan
    // penilaian apa pun.
    const badan = jembatan.slice(jembatan.indexOf("function labelMedan("));
    const sebelah = badan.indexOf("tulisanSesudah(elemen)");
    const induk = badan.indexOf('elemen.closest(".form-group');
    expect(sebelah).toBeGreaterThan(-1);
    expect(induk).toBeGreaterThan(-1);
    expect(sebelah).toBeLessThan(induk);
  });
});
