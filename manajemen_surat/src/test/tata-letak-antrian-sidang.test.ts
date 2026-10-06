// @vitest-environment node

import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * ============================================================================
 * TATA LETAK LAYAR ANTRIAN SIDANG - 22 SEPTEMBER 2026
 * ============================================================================
 *
 * Empat permintaan tata letak yang diajukan bersamaan:
 *
 *   2. kotak pencarian terlalu panjang; Pencarian lanjutan di sebelahnya
 *   6. Perkara saya / Tampilan / Ringkas-Lengkap / Ciutkan pindah ke kanan
 *   7. rapikan posisi UI
 *   8. baris tombol tindakan dapat diciutkan lewat ikon; kotak penanda naik
 *
 * Tata letak tidak dapat diuji dengan menjalankannya - yang diuji di sini
 * sifat-sifat yang KELIRUNYA DIAM: tombol yang menyembunyikan dirinya tanpa
 * jalan kembali, dua tombol bernama sama, dan kotak yang melebar tanpa batas.
 */

const akar = path.resolve(process.cwd(), "..");
const layar = readFileSync(
  path.join(akar, "manajemen_surat/src/components/portal/aleta-ecourt-sidang.tsx"),
  "utf8"
).replace(/\r\n/g, "\n");

describe("butir 6 - kelompok tombol kepala di sebelah kanan", () => {
  it("nama pengguna berdiri SESUDAH kelompok tombol", () => {
    // Inilah yang menentukan letaknya, dan sebabnya halus: baris nama memakai
    // w-full basis-full, jadi ia SELALU memaksa pembungkusan. Ketika ia
    // berdiri lebih dulu, kelompok tombol terdorong ke baris berikutnya -
    // dan di baris itu justify-end tidak berpengaruh apa pun, sebab
    // pembungkusnya menyusut ke isinya dan justify-between milik induk
    // menaruh satu-satunya isi baris di KIRI.
    const iTombol = layar.indexOf('<div className="ml-auto flex flex-wrap items-center justify-end gap-2">');
    const iNama = layar.indexOf("{currentUser.name}");
    expect(iTombol, "pembungkus kelompok tombol tidak ditemukan").toBeGreaterThan(-1);
    expect(iNama, "baris nama pengguna tidak ditemukan").toBeGreaterThan(-1);
    expect(iNama, "nama pengguna mendahului tombol - tombolnya akan jatuh ke kiri").toBeGreaterThan(
      iTombol
    );
  });

  it("pembungkusnya ml-auto - menempel kanan walau turun ke baris sendiri", () => {
    expect(layar).toContain('className="ml-auto flex flex-wrap items-center justify-end gap-2"');
  });
});

describe("butir 2 - kotak pencarian dan temannya", () => {
  it("lebarnya DIBATASI, tidak lagi selebar layar", () => {
    const i = layar.indexOf("LEBARNYA DIBATASI, DAN TEMANNYA DI SEBELAHNYA");
    expect(i, "blok pencarian tidak ditemukan").toBeGreaterThan(-1);
    const blok = layar.slice(i, i + 3000);
    expect(blok).toContain("sm:max-w-xl");
    // min-w menjaga agar ia tidak menyusut menjadi kotak selebar ikon ketika
    // tombol di sebelahnya banyak.
    expect(blok).toContain("min-w-[15rem]");
  });

  it("Pencarian lanjutan, x dari y, dan Reset ADA di baris pencarian", () => {
    const i = layar.indexOf("LEBARNYA DIBATASI, DAN TEMANNYA DI SEBELAHNYA");
    const blok = layar.slice(i, i + 3000);
    expect(blok).toContain("Pencarian lanjutan");
    expect(blok).toContain("dari {sidang.length} perkara");
    expect(blok).toContain("resetSemuaSaringan");
  });

  it("ketiganya TIDAK tertinggal juga di baris tombol tindakan", () => {
    // Dua salinan tombol yang sama pada satu layar adalah cacat yang paling
    // mudah lahir dari pemindahan - yang lama lupa dibuang, dan keduanya
    // tampak sah.
    // Yang dihitung TULISAN TOMBOLNYA - simpul teks JSX yang berdiri sendiri
    // di satu baris - bukan penyebutannya. Catatan di atas kodenya memang
    // menyebut namanya untuk menerangkan kepindahannya, dan penjaga yang
    // melarang katanya akan melarang keterangannya juga.
    const sebagaiTombol = layar.match(/\n\s+Pencarian lanjutan\n/g) ?? [];
    expect(sebagaiTombol.length, "tombol Pencarian lanjutan lebih dari satu").toBe(1);

    // Reset yang KEDUA bukan salinan: ia tombol pemulih pada baris "tidak ada
    // hasil", yang justru hanya muncul ketika tabelnya kosong. Karena itu
    // yang diperiksa BUKAN jumlahnya, melainkan bahwa baris tombol tindakan
    // tidak lagi memuat satu pun dari ketiganya.
    const iTindak = layar.indexOf("BARIS TOMBOL TINDAKAN - DAPAT DICIUTKAN SENDIRI");
    expect(iTindak, "baris tombol tindakan tidak ditemukan").toBeGreaterThan(-1);
    const barisTindak = layar.slice(iTindak, layar.indexOf("Daftarkan ke antrian", iTindak) + 400);
    expect(barisTindak, "Pencarian lanjutan tertinggal di baris tindakan").not.toContain(
      "setLanjutTerbuka"
    );
    expect(barisTindak, "Reset tertinggal di baris tindakan").not.toContain("resetSemuaSaringan");
  });
});

describe("butir 8 - baris tombol tindakan dapat diciutkan", () => {
  it("punya keadaannya sendiri, terpisah dari kendaliCiut", () => {
    // kendaliCiut menyembunyikan SELURUH kendali termasuk pencarian. Yang ini
    // hanya tombol tindakan.
    // 6 Okt 2026: bawaannya terciut (ALAT_CIUT_BAWAAN) - lihat jadwal-sidang-6okt-sore.test.tsx.
    expect(layar).toContain("const [alatCiut, setAlatCiut] = useState(ALAT_CIUT_BAWAAN);");
    expect(layar).toContain("(kendaliCiut || alatCiut) && \"hidden\"");
  });

  it("barisnya HILANG saat diciutkan - itulah yang menaikkan kotak penanda", () => {
    // Dikosongkan tidak cukup: baris kosong tetap memakan tinggi, dan yang
    // diminta pengguna justru deretan penanda naik menempati tempatnya.
    const i = layar.indexOf("BARIS TOMBOL TINDAKAN - DAPAT DICIUTKAN SENDIRI");
    expect(i).toBeGreaterThan(-1);
    const blok = layar.slice(i, i + 2200);
    expect(blok).toContain('"hidden"');
  });

  it("JALAN KEMBALINYA tidak ikut hilang", () => {
    // Tombol yang menyembunyikan dirinya sendiri tanpa jalan kembali mengubah
    // penciutan menjadi penghapusan: yang menekannya sekali harus memuat
    // ulang halaman untuk mendapatkannya lagi. Ikon pembentangnya karena itu
    // pindah ke deretan penanda yang naik.
    const i = layar.indexOf("JALAN KEMBALI KE TOMBOL TINDAKAN YANG DICIUTKAN");
    expect(i, "ikon pembentang tidak ditemukan").toBeGreaterThan(-1);
    const blok = layar.slice(i, i + 1400);
    expect(blok).toContain("{alatCiut ? (");
    expect(blok).toContain("setAlatCiut(false)");
    expect(blok).toContain("aria-label=\"Tampilkan tombol tindakan\"");
  });

  it("pembentangnya berada di deretan penanda, BUKAN di baris yang disembunyikan", () => {
    const iCiut = layar.indexOf("onClick={() => setAlatCiut(true)}");
    const iBentang = layar.indexOf("onClick={() => setAlatCiut(false)}");
    const iPenanda = layar.indexOf("onClick={alihkanSeluruhPenanda}");
    expect(iCiut).toBeGreaterThan(-1);
    expect(iBentang).toBeGreaterThan(iCiut);
    // Pembentang duduk tepat sebelum saklar penanda - artinya di dalam
    // deretan yang naik, bukan di baris yang hilang.
    expect(iBentang).toBeLessThan(iPenanda);
  });
});

describe("butir 7 - dua tombol tidak boleh bernama sama", () => {
  it('tombol layar ruang tunggu berbunyi "Layar antrian", bukan "Tampilan"', () => {
    // Dua tombol sewarna dan sebentuk dengan satu nama pada layar yang sama,
    // mengerjakan hal yang sama sekali berbeda: yang satu menyetel kepadatan
    // daftar, yang lain membuka layar untuk televisi ruang tunggu.
    const i = layar.indexOf("function MenuLayarAntrian()");
    expect(i).toBeGreaterThan(-1);
    const blok = layar.slice(i, i + 1600);
    expect(blok).toContain("Layar antrian");
    expect(blok, 'masih memakai nama "Tampilan"').not.toMatch(/<MonitorPlay[^>]*\/>\s*\n\s*Tampilan\s*\n/);
  });

  it('kata "Tampilan" sebagai nama tombol hanya tinggal satu', () => {
    // Saklar tampilan di kepala. Bila muncul lagi di tempat lain, dua tombol
    // bernama sama kembali - dan yang menekan salah satunya tidak akan tahu
    // ia menekan yang mana sampai sesuatu terjadi.
    const sebagaiNamaTombol = layar.match(/\n\s{8,}Tampilan\n/g) ?? [];
    expect(sebagaiNamaTombol.length, "lebih dari satu tombol bernama Tampilan").toBeLessThanOrEqual(
      1
    );
  });
});
