// @vitest-environment node

import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Layar Putusan Akhir SIPP, dilihat dari sisi ekstensi.
 *
 * Tiga hal dijaga di sini, dan ketiganya pernah rusak sekaligus:
 *
 *   1. BAGIANNYA MUNCUL. Borang Putusan Akhir dimuat SIPP lewat AJAX ke dalam
 *      tingkap di atas halaman perkara yang sama. Penjaga nomorTerakhir dulu
 *      menolak menggambar ulang, sehingga "Isi formulir putusan dari ALETA"
 *      tidak pernah terlihat siapa pun sejak hari ia ditulis.
 *   2. NASKAHNYA DAPAT MASUK. Tanpa jalan menerima naskah yang sudah jadi,
 *      satu-satunya isi aleta_putusan_draf adalah draf yang dirakit dari
 *      fakta - dan tombolnya selalu menjawab "belum ada draf".
 *   3. GAYANYA TIDAK IKUT TERSIMPAN. Gaya gelap bidang ketik disisipkan ke
 *      dalam dokumen CKEditor. Satu elemen <style> di tempat yang keliru akan
 *      ikut tersimpan sebagai amar, lalu tercetak pada salinan putusan.
 */

const akar = path.resolve(process.cwd(), "..");
const konten = () => readFileSync(path.join(akar, "ekstensi-sipp/konten.js"), "utf8").replace(/\r\n/g, "\n");
const gaya = () => readFileSync(path.join(akar, "ekstensi-sipp/panel.css"), "utf8").replace(/\r\n/g, "\n");

function potongFungsi(isi: string, nama: string): string {
  const baris = isi.split("\n");
  const mulai = baris.findIndex((b) => new RegExp(`^(?:async )?function ${nama}\\(`).test(b));
  if (mulai < 0) throw new Error(`fungsi ${nama} tidak ketemu`);
  let j = mulai;
  while (j < baris.length && baris[j] !== "}") j += 1;
  return baris.slice(mulai, j + 1).join("\n");
}

describe("panel digambar ulang ketika borang SIPP muncul", () => {
  it("penjaganya membaca borang, bukan nomor perkara saja", () => {
    // Inilah sebab bagian itu tidak pernah muncul: tingkap Putusan Akhir
    // terbuka pada perkara yang sama, jadi nomornya tidak berubah.
    const isi = konten();
    expect(isi).toContain("function tandaBorang()");
    expect(isi).toContain("if (nomor === nomorTerakhir) {");
    expect(isi).toContain("if (borang === borangTerakhir) return;");
    // Penjaga lamanya harus benar-benar hilang, bukan tersisa di suatu cabang.
    expect(isi).not.toContain("if (nomor === nomorTerakhir || sedangAmbil) return;");
  });

  it("tandaBorang melihat kedua borang yang punya bagiannya sendiri", () => {
    const badan = potongFungsi(konten(), "tandaBorang");
    expect(badan).toContain("#frm_putusan");
    expect(badan).toContain("#frm_data_umum");
  });

  it("menggambar ulang TIDAK menanyakan apa pun ke portal", () => {
    // Tidak ada satu pun keterangan perkara yang berubah ketika sebuah
    // tingkap dibuka. Menanyakannya lagi hanya menambah penantian - dan pada
    // portal yang berat, penantian itulah yang terbaca sebagai ekstensi macet.
    const badan = potongFungsi(konten(), "gambarUlangKonteks");
    expect(badan).toContain("susunPanel(konteksTerakhir)");
    expect(badan).not.toContain("fetch(");
    expect(badan).not.toContain("alatAmbil(");
  });

  it("lencana tetap lencana sesudah digambar ulang", () => {
    // Panel yang ditinggalkan sebagai lencana lalu membentang sendiri tiap
    // kali sebuah tingkap dibuka adalah gangguan, bukan fitur.
    const badan = potongFungsi(konten(), "gambarUlangKonteks");
    expect(badan).toContain("if (posisi && posisi.lencana) ciutkanKeLencana(panel, true);");
  });
});

describe("naskah putusan diterima dari berkas", () => {
  it("hanya menawarkan RTF dan teks, bukan PDF", () => {
    // PDF memecah tiap paragraf menjadi baris cetak. Menawarkannya berarti
    // mengundang naskah yang tersambung salah.
    const isi = konten();
    expect(isi).toContain('pemilih.accept = ".rtf,.txt";');
  });

  it("dikirim sebagai FormData beserta nomor perkaranya", () => {
    const isi = konten();
    expect(isi).toContain('badan.append("berkas", berkas);');
    expect(isi).toContain('badan.append("nomorPerkara", nomorPerkara || "");');
    expect(isi).toContain('badan.append("perkaraId", perkaraIdDariHalaman());');
  });

  it("batas waktunya lebih longgar daripada bacaan biasa", () => {
    // 9 detik pas untuk satu bacaan panel; ia terlalu pendek untuk mengunggah
    // naskah, menguraikannya, lalu menyimpannya. Yang dibatalkan di detik
    // kesembilan bukan pekerjaannya - hanya jawabannya.
    const isi = konten();
    expect(isi).toContain("const BATAS_UNGGAH_NASKAH_MS = 45000;");
    expect(isi).toContain("batasMs: BATAS_UNGGAH_NASKAH_MS,");
  });

  it("perkara_id dibaca dari borang, dan kosongnya bukan kegagalan", () => {
    const badan = potongFungsi(konten(), "perkaraIdDariHalaman");
    expect(badan).toContain('input[name="perkara_id"]');
    expect(badan).toContain('return medan && medan.value ? String(medan.value).trim() : "";');
  });

  it("panjang tiap bagian diperlihatkan sebelum apa pun diisikan", () => {
    // Bagian yang terpotong salah hampir selalu kelihatan dari panjangnya -
    // amar 8.000 aksara berarti pertimbangan ikut terbawa ke dalamnya.
    const isi = konten();
    expect(isi).toContain("aleta-unggah-baris");
    expect(isi).toContain("jawab.bagian || []");
  });

  it("ringkasannya tidak terhapus oleh pembacaan usulan yang menyusul", () => {
    // Unggahan disambung langsung ke pembacaan usulan, dan pembacaan itu
    // mengosongkan wadahnya lebih dulu. Ringkasan yang ditaruh di wadah yang
    // sama akan lenyap sepersekian detik sesudah ditulis - tepat ketika yang
    // membacanya sedang memeriksa apakah potongannya masuk akal.
    const isi = konten();
    expect(isi).toContain("wadahUnggah.appendChild(rinci);");
    expect(isi).not.toContain("wadah.appendChild(rinci);");
    expect(isi).toContain("tombol.click();");
  });
});

describe("gaya gelap bidang ketik CKEditor", () => {
  it("disisipkan ke <head>, tidak pernah ke <body>", () => {
    // getData() milik CKEditor membaca body.innerHTML - itulah yang tersimpan
    // sebagai amar di SIPP. <style> di dalam body akan ikut tersimpan ke dalam
    // putusan, lalu ikut tercetak pada salinannya.
    const badan = potongFungsi(konten(), "warnaiSatuBingkai");
    expect(badan).toContain("dok.head.appendChild(gaya)");
    expect(badan).not.toContain("dok.body.appendChild");
  });

  it("dapat dicabut utuh, sama seperti tema halamannya", () => {
    const badan = potongFungsi(konten(), "warnaiSatuBingkai");
    expect(badan).toContain("if (lama) lama.remove();");
  });

  it("tidak tersedak bingkai yang belum siap", () => {
    const badan = potongFungsi(konten(), "warnaiSatuBingkai");
    expect(badan).toContain("try {");
    expect(badan).toContain("dok = bingkai.contentDocument;");
  });

  it("dipasang ulang ketika CKEditor menulis ulang bingkainya", () => {
    // Berpindah antara Sumber dan WYSIWYG membuang isi bingkai beserta gaya
    // yang sudah disisipkan.
    const badan = potongFungsi(konten(), "warnaiCkeditor");
    expect(badan).toContain('satu.addEventListener("load"');
    expect(badan).toContain("iframe.cke_wysiwyg_frame");
  });

  it("hitam yang tertempel dari Word tidak menjadi hitam di atas gelap", () => {
    const badan = potongFungsi(konten(), "warnaiSatuBingkai");
    expect(badan).toContain('color:#000');
    expect(badan).toContain("color: inherit !important");
  });
});

describe("bilah alat CKEditor", () => {
  it("ikut gelap, dan ikonnya dibalik hanya pada spannya sendiri", () => {
    // Ikonnya satu lembar gambar yang digambar gelap untuk latar putih, jadi
    // bilah gelap menuntut pembalikan warna. Yang berbahaya bukan filternya
    // melainkan JANGKAUANNYA: foto dan tanda tangan pindaian adalah dokumen
    // pengadilan, dan dokumen yang warnanya berubah adalah dokumen yang
    // berbeda.
    //
    // span.cke_button_icon tidak pernah dapat mencapai satu pun dokumen - ia
    // span 16x16 berisi potongan sprite antarmuka. Lihat penjaga jangkauan
    // di ekstensi-penanda-tampilan.test.ts.
    const css = gaya();
    expect(css).toContain('html[data-aleta-tema-sipp="gelap"] span.cke_button_icon');
    expect(css).toContain("filter: invert(1) hue-rotate(180deg)");
    expect(css).toContain('html[data-aleta-tema-sipp="gelap"] :is(.cke_top, .cke_bottom)');
    // Bilahnya memakai warna palet, bukan warna terang yang dipatok.
    const bilah = css.slice(css.indexOf(':is(.cke_top, .cke_bottom)'));
    expect(bilah.slice(0, 200)).toContain("var(--s-permukaan-2)");
  });

  it("putih yang ditanam SIPP sebagai gaya sebaris ikut dipadamkan", () => {
    // application/views/putusan/edit_putusan_akhir.php menulis tiga di antara
    // ketiganya sebagai gaya sebaris - dan gaya sebaris mengalahkan berkas
    // gaya mana pun kecuali yang ber-!important:
    //
    //   <div id='pihak_pilih' style="border: 1px solid #ffffff;">
    //   <div class="detil" style="padding: 2px;background-color: white;">
    //   <form id="frm_putusan" style="background:white;margin:0;">
    //
    // Aturan yang sudah ada menangkap "#fff" tetapi tidak menangkap kata
    // "white" - dan justru kata itulah yang dipakai di sini.
    const css = gaya();
    expect(css).toContain('[style*="background-color: white"]');
    expect(css).toContain('[style*="background:white"]');
    expect(css).toContain('[style*="border: 1px solid #ffffff"]');
  });

  it("bidang ketiknya tetap ikut gelap - itu yang paling luas dipandang", () => {
    const badan = potongFungsi(konten(), "warnaiSatuBingkai");
    expect(badan).toContain("background: #141d19 !important");
  });

  it("borang putusan dilingkupi ke idnya sendiri, bukan ke pembungkusnya", () => {
    // Tingkapnya bukan #konten maupun .modal-content - dua tempat yang selama
    // ini menampung aturan isian. Id borangnya tidak berubah antar versi SIPP.
    const css = gaya();
    expect(css).toContain("#frm_putusan input,");
    expect(css).toContain("#frm_putusan select,");
  });
});
