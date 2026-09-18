/**
 * ============================================================================
 * TAB BERKAS DAN PERKARA YANG TIDAK LAGI BERSELISIH
 * ============================================================================
 *
 * Petugas melaporkan tab Berkas dan tab Perkara "sepertinya tidak sinkron".
 * Ditelusuri, keduanya membaca sumber yang SAMA - `ambilStatusPerkara(nomor)`,
 * lewat simpanan tunggal `simpananStatus`. Sepakat satu sama lain adalah
 * sifat bawaannya, bukan kebetulan.
 *
 * Sampai ALETA menulis sesuatu.
 *
 * ============================================================================
 * SIMPANANNYA HANYA DIBATALKAN KETIKA GAGAL, TIDAK KETIKA BERHASIL
 * ============================================================================
 *
 * `simpananStatus` dahulu dibuang pada satu keadaan saja: ketika pengambilan
 * dari ALETA GAGAL. Ketika penetapan atau Data Umum BERHASIL ditulis ke SIPP,
 * ia dibiarkan apa adanya - padahal justru saat itulah ia menjadi salah.
 *
 * Akibatnya berlapis:
 *
 *   1. menu yang sudah terbentang tetap memajang keadaan SEBELUM tulisan
 *   2. menu yang baru dibuka sesudahnya menggambar dari simpanan basi yang
 *      sama
 *   3. dan keduanya berselisih dengan halaman SIPP di belakangnya, yang sudah
 *      berubah
 *
 * Tidak ada galat yang berbunyi: datanya memang terbaca, hanya terbaca dari
 * sebelum pekerjaan itu terjadi. Satu-satunya jalan memperbaikinya dahulu
 * adalah menutup lalu membuka halaman SIPP - dan tidak ada apa pun di layar
 * yang menyarankan itu.
 *
 * ============================================================================
 * MEMBUANG SIMPANAN SAJA TIDAK CUKUP
 * ============================================================================
 *
 * Menu yang SUDAH terbentang sudah selesai menggambar dan tidak akan mengambil
 * apa pun lagi - membuang simpanan hanya menolong menu yang belum dibuka.
 * Padahal menu yang terbentang itulah yang paling dilihat orang sesudah
 * menulis, dan justru itulah yang paling lama basi.
 *
 * Karena itu pembatalnya juga MENGGAMBAR ULANG yang terbuka.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const AKAR = path.resolve(process.cwd(), "..");
const baca = (jalur: string) => readFileSync(path.join(AKAR, jalur), "utf8").replace(/\r\n/g, "\n");

const konten = baca("ekstensi-sipp/konten.js");

/** Kode saja - supaya tuntutan tidak lulus atas keterangannya sendiri. */
const kode = konten
  .split("\n")
  .filter((b) => !/^\s*(\*|\/\/|\/\*)/.test(b))
  .join("\n");

describe("kedua tab membaca satu sumber", () => {
  it("Berkas dan Perkara sama-sama lewat ambilStatusPerkara", () => {
    // Inilah yang membuat keduanya sepakat. Kalau salah satunya kelak diberi
    // sumber sendiri, keduanya akan berselisih lagi - kali ini karena
    // rancangan, bukan karena simpanan basi.
    expect(kode).toContain("const status = await ambilStatusPerkara(nomor);");
    const pengambil = kode.match(/ambilStatusPerkara\(/g) || [];
    expect(pengambil.length).toBeGreaterThanOrEqual(2);
  });

  it("menu Berkas dan menu Perkara keduanya menu malas", () => {
    expect(kode).toContain('malas("Kelengkapan berkas SIPP", "berkasSipp"');
    expect(kode).toContain('malas("Tahapan dan ketepatan input", "tahapan"');
  });
});

describe("simpanan dibatalkan ketika BERHASIL menulis", () => {
  it("pembatalnya ada, dan mencocokkan nomor perkaranya", () => {
    expect(kode).toContain("function lupakanStatusPerkara(nomor)");
    // Menulis pada perkara A tidak boleh membuang simpanan perkara B yang
    // sedang dibaca di tab sebelah.
    expect(kode).toContain("if (nomor && simpananStatus.nomor && simpananStatus.nomor !== nomor) return false;");
  });

  it("dipanggil sesudah penetapan sungguhan - dan TIDAK sesudah uji kering", () => {
    expect(kode).toContain("if (berhasil && !kering) lupakanStatusPerkara(");
  });

  it("dipanggil juga sesudah Data Umum tersimpan", () => {
    const iPanggil = kode.indexOf("lupakanStatusPerkara(String((konteks && konteks.nomorPerkara)");
    const iKabar = kode.indexOf("kabar.textContent = `Tersimpan.");
    expect(iPanggil).toBeGreaterThan(-1);
    // Dibatalkan SEBELUM kabar "Tersimpan" - supaya yang membaca kabar itu
    // sudah melihat menu yang benar.
    expect(iPanggil).toBeLessThan(iKabar);
  });

  it("dipanggil di dalam gelung penetapan, bukan di pemanggilnya", () => {
    // Tiap jenis penetapan lewat gelung yang sama; menaruhnya di pemanggil
    // berarti jenis yang ditambahkan kelak terlewat tanpa berbunyi.
    const gelung = kode.slice(kode.indexOf("async function rantaiPenetapan("));
    const sampaiAkhirGelung = gelung.slice(0, gelung.indexOf("\nfunction "));
    expect(sampaiAkhirGelung).toContain("lupakanStatusPerkara(");
  });
});

describe("menu yang sudah terbuka digambar ulang", () => {
  it("tiap menu malas mendaftarkan dirinya", () => {
    expect(kode).toContain("menuMalasHidup.push(kotak);");
    expect(kode).toContain("let menuMalasHidup = [];");
  });

  it("pembatal simpanan ikut menggambar ulang", () => {
    const pembatal = kode.slice(
      kode.indexOf("function lupakanStatusPerkara(nomor)"),
      kode.indexOf("async function ambilStatusPerkara(nomor)")
    );
    expect(pembatal).toContain("for (const kotak of menuMalasHidup)");
    expect(pembatal).toContain("kotak.gambarUlang()");
  });

  it("yang tertutup hanya ditandai, tidak ikut memanggil ALETA", () => {
    // Menggambar ulang menu tertutup berarti memanggil ALETA untuk sesuatu
    // yang tidak sedang dilihat siapa pun.
    expect(kode).toContain('if (!isi || isi.style.display === "none") return;');
  });

  it("satu menu yang gagal tidak menghentikan yang lain", () => {
    const pembatal = kode.slice(
      kode.indexOf("function lupakanStatusPerkara(nomor)"),
      kode.indexOf("async function ambilStatusPerkara(nomor)")
    );
    expect(pembatal).toContain("try {");
    expect(pembatal).toContain("} catch (galat) {");
  });

  it("daftarnya dikosongkan tiap panel digambar ulang", () => {
    // Dibiarkan bertambah, ia menyimpan menu dari perkara sebelumnya yang
    // elemennya sudah dibuang dari halaman.
    expect(kode).toContain("menuMalasHidup = [];");
    const iKosong = kode.indexOf("  menuMalasHidup = [];");
    const iDaftarMenu = kode.indexOf("  const menuMalas = {};");
    expect(iKosong).toBeGreaterThan(iDaftarMenu);
  });
});
