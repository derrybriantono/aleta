// @vitest-environment node

import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * ============================================================================
 * HALAMAN YANG TERLEWAT LAPISAN GELAP
 * ============================================================================
 *
 * Peta warna gelombang pertama disusun dari halaman yang paling sering
 * dibuka - daftar perkara, detil perkara, borang penetapan. Halaman lain
 * tidak pernah ikut, dan akibatnya bukan "agak terang" melainkan KEDIP PUTIH
 * PENUH di antara dua halaman gelap.
 *
 * Yang dijaga di sini bukan warnanya - warna tidak dapat diuji dari teks
 * berkas - melainkan bahwa tiap halaman yang dilaporkan PUNYA aturannya, dan
 * bahwa aturannya tetap tersasar (bukan pemilih borong yang menggelapkan
 * segalanya termasuk yang sudah benar).
 */

const akar = path.resolve(process.cwd(), "..");
const gaya = readFileSync(path.join(akar, "ekstensi-sipp/panel.css"), "utf8");
const abt = readFileSync(path.join(akar, "ekstensi-sipp/abt.js"), "utf8");
const popupHtml = readFileSync(path.join(akar, "ekstensi-sipp/popup.html"), "utf8");
const popupJs = readFileSync(path.join(akar, "ekstensi-sipp/popup.js"), "utf8");
const manifest = JSON.parse(readFileSync(path.join(akar, "ekstensi-sipp/manifest.json"), "utf8")) as {
  content_scripts: Array<{ matches: string[]; js: string[] }>;
};

describe("SIPP: halaman yang dulu menyala putih", () => {
  it("halaman login punya aturannya sendiri", () => {
    // Halaman pertama yang dilihat tiap hari, dan satu-satunya yang dilihat
    // SEBELUM ada yang tahu temanya gelap.
    for (const penunjuk of ["#kotakLogin", "#kotak", "hr.login"]) {
      expect(gaya, penunjuk).toContain(penunjuk);
    }
  });

  it("kerangka AdminLTE - isi kotaknya, bukan hanya kotaknya", () => {
    // .box sudah dipetakan sejak awal; yang menyala justru isinya.
    for (const penunjuk of [".box-header", ".box-body", ".info-box", ".todo-list", ".small-box"]) {
      expect(gaya, penunjuk).toContain(penunjuk);
    }
  });

  it("tabel bootstrap dan tabel laporan yang dicetak ke Excel", () => {
    expect(gaya).toContain("table.cetakExcel");
    expect(gaya).toContain("#view_laporan");
    expect(gaya).toContain(".table-striped");
  });

  it("aturannya TIDAK berlaku di halaman ABT", () => {
    // Peta SIPP menyentuh nama yang juga ada di ABT (.table, .panel). Tanpa
    // penjagaan ini keduanya saling menimpa, dan yang rusak justru halaman
    // yang sudah benar.
    // Dibatasi sampai blok palet super admin: token warna di sana memang
    // berlaku untuk SIPP dan ABT sekaligus - ia mendeklarasikan nilai, bukan
    // mewarnai elemen, jadi tidak perlu dan tidak boleh dikunci ke halaman.
    const blok = gaya.slice(
      gaya.indexOf("LAPISAN GELAP GELOMBANG KEDUA"),
      gaya.indexOf("ENAM WARNA GELAP UNTUK SUPER ADMIN")
    );
    const baris = blok.split("\n").filter((b) => b.includes("data-aleta-tema-sipp"));
    expect(baris.length).toBeGreaterThan(10);
    // Tidak satu pun aturan baru boleh berdiri tanpa menyebut halamannya:
    // entah HANYA-SIPP, entah HANYA-ABT. Yang tidak disebut akan berlaku di
    // keduanya, dan nama seperti .table dan .panel ada di keduanya.
    for (const b of baris) {
      const hanyaSipp = b.includes('html:not([data-aleta-halaman="abt"])');
      const hanyaAbt = b.includes('html[data-aleta-halaman="abt"]');
      expect(hanyaSipp || hanyaAbt, b.trim().slice(0, 90)).toBe(true);
    }
  });
});

describe("SIPP: putih yang tidak ditulis sebagai kelas", () => {
  // Mengejar nama kelas tidak akan pernah menangkap ketiganya. Sebabnya
  // berbeda-beda, dan tiap sebab menuntut caranya sendiri.
  it("gaya sebaris yang menyebut dirinya putih ikut diturunkan", () => {
    for (const bentuk of [
      '[style*="background:white" i]',
      '[style*="background-color: white" i]',
      '[style*="background:#fff" i]',
    ]) {
      expect(gaya, bentuk).toContain(bentuk);
    }
  });

  it("bilah atas: gambarnya DICAMPUR, bukan warna di baliknya yang diturunkan", () => {
    // Aturan lama menurunkan background-color #atas, dan itu tidak pernah
    // terlihat - hijaunya datang dari top_repeat.jpg yang menutupinya rapat.
    // Dicari PEMILIH lengkapnya, bukan "#atas {" - catatan di atas aturannya
    // menyebut bilah itu juga, dan penjaga yang menangkap catatannya sendiri
    // tidak menjaga apa pun.
    const pemilih = 'html:not([data-aleta-halaman="abt"])[data-aleta-tema-sipp="gelap"] #atas {';
    const letak = gaya.lastIndexOf(pemilih);
    expect(letak).toBeGreaterThan(-1);
    expect(gaya.slice(letak, letak + 200)).toContain("background-blend-mode: multiply");
  });

  it("kanvas grafik diturunkan ke nada tengah - TIDAK dibalik, dan hanya grafiknya", () => {
    // Kanvas di SIPP juga memuat pindaian dokumen dan pratinjau tanda tangan;
    // membaliknya mengubah warna dokumen pengadilan. Yang disentuh hanya
    // #chartHakim, dan latarnya nada tengah supaya sumbu kelabu Chart.js
    // tetap terbaca.
    expect(gaya).toContain("canvas#chartHakim");
    const aturan = gaya.slice(gaya.lastIndexOf("canvas#chartHakim"));
    expect(aturan.slice(0, 160)).toContain("background-color: #c9d3cd");
    expect(aturan.slice(0, 160)).not.toContain("filter:");
  });

  it("kuning penanda diturunkan, bukan disamakan dengan permukaan biasa", () => {
    // Ia memang menandai sesuatu; menghapus warnanya menghapus tandanya.
    expect(gaya).toContain('[style*="background-color: #FFFF99" i]');
    expect(gaya).toContain("#4a431f");
  });
});

describe("ABT: kerangka di luar halaman blangko", () => {
  it("halaman masuk dan menu ikon APS Badilag", () => {
    // Keduanya templat admin Bootstrap 4 dengan latar foto - kerangka yang
    // sama sekali berbeda dari halaman blangko, dan keduanya pintu masuknya.
    for (const penunjuk of [".container-scroller", ".page-body-wrapper", ".auto-form-wrapper", ".auth-bg-1"]) {
      expect(gaya, penunjuk).toContain(penunjuk);
    }
  });

  it("daftar blangko: kepalanya ikut palet, warna kelompoknya tinggal garis kiri", () => {
    // Dulu sembilan warna .pricing-top hanya diredupkan dengan filter, sebab
    // itulah cara petugas membedakan kelompok blangko sekilas. Sejak ada
    // palet, kepala kuning atau hijau-saat-disentuh itu justru yang "nyelip"
    // di palet ungu. Keputusan 1.128.0: kepalanya memakai warna tua palet,
    // dan warna kelompoknya tinggal sebagai garis tebal di tepi kiri - cara
    // membedakan kelompok tetap ada tanpa satu bidang pun melawan paletnya.
    expect(gaya).toContain(".pricing-bottom");
    const aturanTop = gaya.slice(gaya.indexOf('[data-aleta-halaman="abt"][data-aleta-tema-sipp="gelap"] .pricing-top {'));
    expect(aturanTop.slice(0, 260)).toContain("background: var(--s-hijau-tua) !important;");
    expect(aturanTop.slice(0, 260)).toContain("box-shadow: inset 6px 0 0 var(--kelompok, var(--s-garis-hijau));");
    expect(aturanTop.slice(0, 260)).not.toContain("filter: brightness(");
  });

  it("seluruh aturan ABT dikunci ke halaman ABT", () => {
    // Dibatasi sampai gelombang ketiga: sesudah itu ada aturan SIPP lagi, lalu
    // palet super admin yang memang berlaku untuk keduanya.
    const blok = gaya.slice(
      gaya.indexOf("ABT / APS BADILAG - KERANGKA DI LUAR HALAMAN BLANGKO"),
      gaya.indexOf("GELOMBANG KETIGA - PUTIH YANG TIDAK DITULIS SEBAGAI KELAS")
    );
    const baris = blok.split("\n").filter((b) => b.includes("data-aleta-tema-sipp"));
    expect(baris.length).toBeGreaterThan(0);
    for (const b of baris) {
      expect(b, b.trim().slice(0, 80)).toContain('[data-aleta-halaman="abt"]');
    }
  });
});

describe("ekstensi berjalan di SELURUH halaman ABT server", () => {
  it("polanya /aps_badilag/*, bukan /aps_badilag/abt/*", () => {
    // Alamat ABT yang sungguhan memuat index.php di tengah -
    // /aps_badilag/index.php/abt/... - sehingga pola /aps_badilag/abt/* tidak
    // pernah cocok satu halaman pun di peladen. Tema dan panelnya karena itu
    // tidak pernah muncul di sana, sementara di mesin setempat keduanya
    // tampak biasa saja.
    const semua = manifest.content_scripts.flatMap((x) => x.matches);
    expect(semua).not.toContain("http://192.168.10.10/aps_badilag/abt/*");
    expect(semua).toContain("http://192.168.10.10/aps_badilag/*");
  });

  it("tema dipasang sedini mungkin di halaman ABT server juga", () => {
    const awal = manifest.content_scripts.find((x) => x.js.includes("tema-awal.js"));
    expect(awal?.matches).toContain("http://192.168.10.10/aps_badilag/*");
  });
});

describe("keterangan saksi dapat disusun di tempat ia dikerjakan", () => {
  it("halaman penyunting tanya-jawab dikenali dari alamat DAN blangkonya", () => {
    // Alamat dapat berubah; borang tanya-jawab beserta tabel barisnya tidak.
    expect(abt).toContain("function halamanTanyaJawab()");
    expect(abt).toContain("tanyajawab_perkara_edit");
    expect(abt).toContain(".tbl_user_data, .add_tanyajawab, .row_data");
  });

  it("panelnya ikut terpasang di sana", () => {
    const badan = abt.slice(abt.indexOf("async function pasang()"));
    expect(badan.slice(0, 900)).toContain("const diTanyaJawab = halamanTanyaJawab();");
    // Sejak uji rilis U3 (8c1e9f7) cabang "bukan blangko dan bukan
    // tanya-jawab" menerangkan dulu halaman galat ABT (baca saja) sebelum
    // pulang - syaratnya sama, dan cabang itu tetap berakhir `return;`
    // sebelum panel dipasang.
    const syarat = "if (!halamanBlangko() && !diTanyaJawab) {";
    expect(badan.slice(0, 900)).toContain(syarat);
    const cabang = badan.slice(badan.indexOf(syarat), badan.indexOf("\n  }\n", badan.indexOf(syarat)));
    expect(cabang).toContain("a3TerangkanHalamanGalat();");
    expect(cabang.trimEnd().endsWith("return;")).toBe(true);
  });

  it("hanya penyusun keterangan saksi yang tampak di sana", () => {
    // Tombol yang ditekan lalu menjawab "tidak ada apa-apa" lebih buruk
    // daripada tombol yang tidak ada.
    const badan = abt.slice(abt.indexOf("DI HALAMAN TANYA-JAWAB, HANYA INILAH YANG MASUK AKAL"));
    expect(badan.slice(0, 1200)).toContain("tombolSipp.hidden = true;");
    expect(badan.slice(0, 1200)).toContain("tombolItsbat.hidden = true;");
    expect(badan.slice(0, 1200)).toContain("tombolSdg.hidden = false;");
  });
});

describe("sebutan di jendela ekstensi", () => {
  it("namanya ALETA E-COURT", () => {
    expect(popupHtml).toContain("ALETA E-COURT");
    expect(popupHtml).not.toContain("ALETA UNTUK SIPP");
  });

  it("anak judul \"Keterangan e-Court di halaman SIPP\" sudah tidak ada", () => {
    expect(popupHtml).not.toContain("Keterangan e-Court di halaman SIPP");
  });

  it("tiga pilihan: terang, gelap, ikuti sistem - dan \"ikuti sistem\" sungguh membaca sistem", () => {
    // 1.155.0 menggantikan "ikut sistem" dengan "ikut ALETA": panel bawaannya
    // GELAP sementara Windows di meja petugas hampir selalu TERANG, sehingga
    // jendela ini lahir putih di atas SIPP yang gelap. Alasannya tetap benar -
    // itu sebabnya BAWAANNYA tetap gelap. Yang berubah (23 Okt 2026): pilihan
    // "ikuti sistem" kini nyata (matchMedia di jendela ini), bukan "ikut
    // temaPanel" yang diam-diam membuat sistem gelap tampil terang.
    expect(popupJs).toContain('sistem: "ikuti sistem"');
    expect(popupJs).toContain("pusat.sistemGelap()");
    expect(popupJs).not.toContain("ikut peramban");
    expect(popupHtml).not.toContain("ikut peramban");
    expect(popupHtml).not.toContain("tema: ikut sistem");
    // Bawaan jendela tetap gelap, bukan menunggu tampilan sistem.
    expect(popupHtml).toContain('<html lang="id" data-tema="gelap">');
  });
});

describe("warna peran ikut tema, tidak berdiri di luarnya", () => {
  it("rel super admin diredupkan pada tema gelap", () => {
    expect(gaya).toContain('.aleta-panel:not([data-tema="terang"])[data-peran="super"]::before');
    expect(gaya).toContain("filter: brightness(0.82) saturate(0.92)");
  });

  it("peran lain mengambil warnanya dari token tema, bukan angka tetap", () => {
    const aturan = gaya.slice(gaya.indexOf('.aleta-panel[data-peran="admin"]::before {'));
    expect(aturan.slice(0, 160)).toContain("var(--aleta-merek)");
    expect(aturan.slice(0, 160)).not.toContain("#2f6b52");
  });
});
