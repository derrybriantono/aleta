// @vitest-environment node

import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Kepala yang sama di setiap halaman, dan medan yang tersembunyi di balik
 * pintunya.
 */

const akar = path.resolve(process.cwd(), "..");
const baca = (nama: string) => readFileSync(path.join(akar, "ekstensi-sipp", nama), "utf8");

function potongFungsi(isi: string, nama: string): string {
  const mulai = isi.indexOf(`function ${nama}(`);
  if (mulai < 0) throw new Error(`fungsi ${nama} tidak ketemu`);
  const selesai = isi.indexOf("\nfunction ", mulai + 10);
  return isi.slice(mulai, selesai < 0 ? undefined : selesai);
}

describe("kepala yang sama di setiap halaman", () => {
  const konten = baca("konten.js");

  it("akun ALETA dibaca juga di halaman yang bukan halaman perkara", () => {
    // penggunaTerakhir hanya terisi dari jawaban konteks perkara, dan jawaban
    // itu tidak pernah datang di dashboard maupun daftar perkara - sehingga
    // pita di sana hanya memuat akun SIPP.
    expect(konten).toContain('const ALETA_API_SIAPA = "/aleta/api/aleta-ecourt/ekstensi/siapa";');
    expect(konten).toContain("async function muatPenggunaAleta()");
    expect(konten).toContain("await muatPenggunaAleta();");
  });

  it("dibaca sekali saja, dan kegagalannya tidak menggagalkan panel", () => {
    const badan = potongFungsi(konten, "muatPenggunaAleta");
    expect(badan).toContain("if (penggunaTerakhir && penggunaTerakhir.nama) return penggunaTerakhir;");
    expect(badan).toContain("catch {");
  });
});

describe("chip peran di kepala", () => {
  const konten = baca("konten.js");

  it("berdiri di deret tombol, bukan di baris tersendiri", () => {
    expect(konten).toContain("alatKepala.appendChild(chipPeran);");
    // Nama pengguna tidak diulang di baris ketiga - ia sudah di pita.
    expect(konten).not.toContain('buatElemen("span", "aleta-kepala-nama", penggunaTerakhir.nama)');
  });

  it("tidak terlihat dapat ditekan, walau duduk di antara tombol", () => {
    const css = baca("panel.css");
    const blok = css.slice(css.indexOf(".aleta-alat-kepala .aleta-kepala-peran {"));
    expect(blok.slice(0, 250)).toContain("cursor: default;");
  });
});

describe("medan yang tersembunyi di balik pintunya", () => {
  const konten = baca("konten.js");

  it("Status Putusan dan Qobla dikenali sebagai pintu", () => {
    // Memilih Status Putusan memunculkan faktor perceraian, nusyuz, qobla,
    // dan keadaan isteri; memilih Qobla memunculkan keadaan isteri lagi.
    expect(konten).toContain('const MEDAN_PINTU = [\'select[name="status_putusan"]\', \'select[name="qobla"]\'];');
  });

  it("pintunya dibuka sendiri sebelum isinya dibaca", () => {
    const badan = potongFungsi(konten, "bagianIsiPutusan");
    expect(badan).toContain("for (const pintu of MEDAN_PINTU)");
    expect(badan).toContain("sudahDibuka.add(pintu);");
    // Diterapkan HANYA bila ALETA memang mengusulkannya.
    expect(badan).toContain("if (!usul || !usul.nilai) continue;");
  });

  it("berputar paling banyak tiga kali - dua pintu bersusun, tidak lebih", () => {
    const badan = potongFungsi(konten, "bagianIsiPutusan");
    expect(badan).toContain("for (let putaran = 0; putaran < 3; putaran += 1)");
    // Berhenti begitu tidak ada medan baru.
    expect(badan).toContain("if (baru.length === 0) break;");
    expect(badan).toContain("if (!adaYangDibuka) break;");
  });

  it("borang diberi waktu menggambar ulang sebelum dibaca lagi", () => {
    const badan = potongFungsi(konten, "bagianIsiPutusan");
    expect(badan).toContain("await new Promise((selesai) => setTimeout(selesai, 350));");
  });

  it("yang dibuka sendiri DIKATAKAN, bukan didiamkan", () => {
    // Panel yang diam-diam mengubah isian borang adalah panel yang tidak
    // dapat dipercaya. Yang diubahnya disebut.
    //
    // Kalimatnya berubah pada 2.32.0 karena perilakunya berubah: dulu panel
    // menulis Status Putusan APA PUN yang sudah ada di sana, dan kalimatnya
    // "ubah sendiri bila keliru" - keterangan yang datang SESUDAH pilihan
    // petugas terlanjur tertimpa. Sekarang yang sudah dipilih tidak disentuh,
    // jadi kalimatnya pun harus menyatakan itu.
    const badan = potongFungsi(konten, "bagianIsiPutusan");
    expect(badan).toContain("yang masih kosong dipilihkan lebih dulu");
    expect(badan).toContain("yang sudah Anda pilih TIDAK disentuh");
  });

  it("yang SUDAH dipilih petugas tidak pernah ditimpa", () => {
    // ========================================================================
    // INILAH YANG SESUNGGUHNYA DIJAGA, DAN AKIBATNYA BUKAN TAMPILAN
    // ========================================================================
    //
    // Petugas yang sudah memilih "Dicabut" lalu membuka panel mendapati
    // pilihannya berganti sendiri menjadi usulan ALETA - yang pada sebagian
    // besar perkara berbunyi "Dikabulkan". Status putusan yang keliru
    // tersimpan ke perkara orang, lalu mengalir ke laporan dan ke Direktori
    // Putusan.
    //
    // Lebih buruk lagi: praperiksa dijalankan SEBELUM pintunya dibuka, atas
    // status yang lama. Status baru yang dituliskan panel karena itu tidak
    // pernah diadu dengan amar drafnya oleh siapa pun.
    const badan = potongFungsi(konten, "bagianIsiPutusan");
    const i = badan.indexOf("const sudahDipilihOrang =");
    expect(i, "keadaan borang tidak diperiksa sebelum menulis").toBeGreaterThan(-1);

    // "-1" adalah "Pilih Status Putusan" milik SIPP - itu BELUM dipilih.
    // Menganggapnya pilihan membuat pintunya tidak pernah terbuka.
    expect(badan).toContain('nilaiSekarang !== ""');
    expect(badan).toContain('nilaiSekarang !== "-1"');

    // Cabang "sudah dipilih" tidak boleh menulis apa pun ke borang.
    const cabang = badan.slice(
      badan.indexOf("if (sudahDipilihOrang) {"),
      badan.indexOf("continue;", badan.indexOf("if (sudahDipilihOrang) {"))
    );
    expect(cabang.length, "cabang lewati tidak ada").toBeGreaterThan(0);
    expect(cabang, "masih menulis ke borang").not.toContain('jenis: "isi"');
  });

  it("pembacaan dan permintaan usulannya satu tempat, dipakai tiap putaran", () => {
    expect(konten).toContain("async function bacaMedanTampak()");
    expect(konten).toContain("async function mintaUsulanMedan(daftar, jenisPerkara)");
    // Tidak ada lagi salinan kedua permintaan usulan di dalam badan.
    expect(konten.split("Menyusun usulan pilihan").length - 1).toBeLessThanOrEqual(3);
  });
});
