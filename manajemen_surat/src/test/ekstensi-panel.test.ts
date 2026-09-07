// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Perilaku panel ekstensi SIPP yang tidak boleh hilang diam-diam.
 *
 * ============================================================================
 * KENAPA PENJAGA SUMBER, BUKAN UJI PERILAKU
 * ============================================================================
 *
 * konten.js adalah content script: ia hidup di dalam halaman SIPP, memakai
 * chrome.storage, dan menyusun DOM di atas halaman milik aplikasi lain.
 * Merendernya di node menuntut memalsukan seluruh lingkungan itu, dan palsuan
 * sebesar itu lebih mungkin salah daripada kodenya sendiri.
 *
 * Yang dijaga di sini karena itu KEPUTUSANNYA, dibaca dari berkas sumbernya -
 * keputusan yang bila terbalik tidak menimbulkan galat apa pun, hanya panel
 * yang diam-diam berhenti bekerja seperti yang dijanjikan.
 */

const berkasKonten = path.resolve(process.cwd(), "../ekstensi-sipp/konten.js");
const berkasGaya = path.resolve(process.cwd(), "../ekstensi-sipp/panel.css");

const konten = () => readFileSync(berkasKonten, "utf8");
const gaya = () => readFileSync(berkasGaya, "utf8");

describe("bagian malas termuat meski sudah terbentang", () => {
  it("tiap bagian malas memuat sendiri saat tergambar terbentang", () => {
    // Keadaan lipatan disimpan antar-sesi. Bila tersimpan sebagai TERBUKA,
    // bagiannya tergambar terbentang tetapi KOSONG - dan baru terisi sesudah
    // ditekan dua kali: sekali menutup, sekali membuka. Terbaca sebagai menu
    // yang rusak, padahal hanya pemuatnya yang tidak pernah dipanggil.
    const isi = konten();
    const pendaftaran = isi.split('kepala.addEventListener("click", muatBagian);').length - 1;
    const pemuatanAwal = isi.split("setTimeout(muatBagian, 0);").length - 1;
    expect(pendaftaran).toBeGreaterThanOrEqual(3);
    // Tiap bagian yang mendaftarkan pemuat HARUS punya pemuatan awalnya.
    expect(pemuatanAwal).toBe(pendaftaran);
  });

  it("bagian penetapan juga memuat sendiri", () => {
    expect(konten()).toContain("setTimeout(muat, 0);");
  });
});

describe("saklar papan benar-benar dapat ditekan", () => {
  it("pilnya tombol, bukan span", () => {
    // Sebelumnya <span> berbentuk tombol tanpa penangan apa pun: menekannya
    // tidak melakukan apa-apa, dan yang membacanya wajar menyimpulkan
    // aplikasinya rusak.
    const isi = konten();
    expect(isi).toContain('const tombol = buatElemen("button", "aleta-saklar-pil", pil.label);');
    expect(isi).toContain("onPilih(pil.nilai)");
  });

  it("pil tanpa penangan dimatikan dan menyebutkan dirinya", () => {
    // Tombol hidup yang diam lebih buruk daripada tombol mati yang jujur.
    const isi = konten();
    expect(isi).toContain("tombol.disabled = true;");
    expect(isi).toContain("belum dapat diubah dari sini");
  });

  it("berpindah ke otomatis membuang pilihan manual", () => {
    // Menyimpannya diam-diam berarti menekan Otomatis lalu tetap mendapat
    // orang yang dipilih tangan - saklar yang berbohong.
    expect(konten()).toContain('if (nilai === "otomatis") data.pilihanManual = {};');
  });
});

describe("pilihan manual benar-benar terbawa ke formulir", () => {
  it("nilaiUntukBorang menerima dan memakai pilihan manual", () => {
    // Kalau tidak, dropdown-nya berubah di layar tetapi yang terisi ke
    // formulir tetap usulan semula - jauh lebih berbahaya daripada tidak ada
    // pilihan manual sama sekali.
    const isi = konten();
    expect(isi).toContain("function nilaiUntukBorang(formulir, usulan, pilihanManual = {})");
    expect(isi).toContain("nilaiUntukBorang(formulir, usulan, (data && data.pilihanManual) || {})");
  });

  it("pencari calon mengenali keempat bentuk pengenal", () => {
    // hakimId sempat tertinggal, dan akibatnya pilihan hakim tidak pernah
    // ketemu di daftarnya lalu diam-diam jatuh kembali ke usulan.
    const isi = konten();
    expect(isi).toContain("x.id ?? x.hakimId ?? x.paniteraId ?? x.jurusitaId ?? x.nama");
  });

  it("pilihan yang tidak ketemu jatuh ke usulan, bukan ke kosong", () => {
    // Penetapan tanpa nama jauh lebih buruk daripada penetapan dengan nama
    // yang diusulkan mesin.
    expect(konten()).toContain("function pilihanDari(daftar, pengenal)");
  });
});

describe("menciutkan panel benar-benar menciutkan", () => {
  it("tinggi terpatok ikut dilepas, dan dikembalikan lagi", () => {
    // Menyembunyikan isinya saja menyisakan kotak kosong sebesar semula,
    // karena tinggi panel terpatok pada gaya inline sesudah diubah ukurannya.
    const isi = konten();
    expect(isi).toContain("tinggiSebelumCiut");
    expect(isi).toContain("panel.style.height = tinggiSebelumCiut;");
    expect(isi).toContain('panel.classList.add("aleta-panel-ciut");');
  });

  it("gayanya ada, dan pegangan tariknya disembunyikan", () => {
    // Pegangan yang dapat ditarik tetapi tidak mengubah apa pun terbaca
    // sebagai kerusakan.
    const css = gaya();
    expect(css).toContain(".aleta-panel-ciut");
    expect(css).toContain(".aleta-panel-ciut .aleta-tarik");
  });
});

describe("panel pulang ke sudut kanan atas", () => {
  it("bawaan menempel di sudut, bukan 90px di bawahnya", () => {
    // Yang menekan tombol kembali-ke-bawaan sedang meminta panelnya pulang ke
    // sudut - bukan ke suatu tempat di bawah sudut, yang terbaca sebagai panel
    // yang gagal pulang.
    const css = gaya();
    expect(css).toContain("top: 12px;");
    expect(css).not.toContain("top: 90px;");
  });
});

describe("tema terang dan gelap", () => {
  it("tema terang menimpa peubah, bukan aturan satu per satu", () => {
    const css = gaya();
    expect(css).toContain('.aleta-panel[data-tema="terang"]');
    // Kontras dijaga: hijau merek digelapkan untuk latar putih.
    expect(css).toContain("--aleta-merek: #1f7a4d;");
  });

  it("tema SIPP bawaannya MATI", () => {
    // Mengubah tampilan aplikasi orang lain tanpa diminta adalah hal terakhir
    // yang boleh dilakukan lapisan bantu.
    const isi = konten();
    expect(isi).toContain("let temaSippMenyala = false;");
    expect(isi).toContain("simpan[KUNCI_TEMA_SIPP] === true");
  });

  it("tema SIPP dipasang sebagai satu style bertanda yang dapat dibuang", () => {
    // Supaya mematikannya tidak meninggalkan gaya yang menempel di elemen.
    const isi = konten();
    expect(isi).toContain('const PENANDA_TEMA_SIPP = "aleta-tema-sipp";');
    expect(isi).toContain("if (lama) lama.remove();");
  });

  it("TIDAK memakai filter invert pada seluruh halaman", () => {
    // Cara itu memang cepat, tetapi ia membalik warna FOTO dan tanda tangan
    // pindaian juga - dan dokumen pengadilan yang warnanya terbalik adalah
    // harga yang terlalu mahal untuk sebuah kenyamanan mata.
    const isi = konten();
    expect(isi).not.toContain("filter: invert");
    expect(isi).not.toContain("invert(1)");
  });
});

describe("penetapan yang dapat ditetapkan pembaca", () => {
  it("dibaca dari rencana kerja, bukan ditebak dari nama jabatan", () => {
    const isi = konten();
    expect(isi).toContain("function penetapanMilikSaya(langkah, namaSipp)");
    expect(isi).toContain("langkah.akun");
  });

  it("yang tidak dapat dipastikan dikembalikan null, bukan false", () => {
    // Menyatakan sesuatu bukan urusan seseorang padahal sebenarnya urusannya
    // adalah kekeliruan yang membuat pekerjaan tertinggal.
    const isi = konten();
    const potong = isi.slice(
      isi.indexOf("function penetapanMilikSaya"),
      isi.indexOf("function bagianMenungguSaya")
    );
    expect(potong).toContain("if (!namaSipp) return null;");
    expect(potong).toContain("if (!langkah || !langkah.akun) return null;");
  });

  it("keempat penetapan tetap disebut, termasuk yang bukan urusannya", () => {
    // Menyembunyikannya membuat papan menjawab "tidak ada apa-apa untuk Anda"
    // sementara yang ditanyakan orang justru "kalau begitu siapa yang menunggu".
    const isi = konten();
    expect(isi).toContain("const URUTAN_PENETAPAN = [");
    for (const jenis of ["pmh", "ppp", "pjs", "phs"]) {
      expect(isi).toContain(`jenis: "${jenis}"`);
    }
  });

  it("antrean penerusan tidak dibuang, hanya turun ke bawah", () => {
    const isi = konten();
    expect(isi).toContain("async function gambarAntreanPenerusan(isi)");
    // 404 berarti alurnya memang tidak dipakai di pengadilan ini - bukan
    // kerusakan, jadi tidak digambar sebagai kerusakan.
    expect(isi).toContain("if (respons.status === 404 || respons.status === 403) return;");
  });
});
