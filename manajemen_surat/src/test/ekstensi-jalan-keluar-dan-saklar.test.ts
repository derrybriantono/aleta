/**
 * Empat perbaikan panel 1.145.0 - dijaga MAKSUDNYA.
 *
 *   1. Escape dan klik-ganda di luar menciutkan panel
 *   2. Reset menjangkar ke KANAN, tidak lagi melompat ke kiri
 *   3. Sunting sekali klik di ABT dapat dimatikan - dan bawaannya mati
 *   4. Unduhan diterbitkan ekstensi, bukan halaman http yang diblokir Chrome
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const AKAR = path.resolve(__dirname, "../../../ekstensi-sipp");
const baca = (n: string) => readFileSync(path.join(AKAR, n), "utf8");
const alat = baca("panel-alat.js");
const abt = baca("abt.js");
const latar = baca("latar.js");
const popupJs = baca("popup.js");
const popupHtml = baca("popup.html");
const manifest = JSON.parse(baca("manifest.json"));

describe("menyingkir tanpa mencari tombolnya", () => {
  it("Escape dan klik-ganda di luar keduanya menciutkan", () => {
    expect(alat).toContain("function alatPasangJalanKeluar(");
    expect(alat).toContain('peristiwa.key !== "Escape"');
    expect(alat).toContain('"dblclick",');
    // Dipasang bersama panelnya - kalau tidak, ia hanya ada di berkasnya.
    expect(alat).toContain("alatPasangJalanKeluar(panel, kunci);");
  });

  it("keduanya pada fase TANGKAP", () => {
    // 1.155.0. SIPP dan ABT keduanya halaman jQuery yang memasang
    // pendengarnya sendiri di mana-mana; pendengar yang menghentikan gelembung
    // membuat klik ganda tidak pernah sampai ke document - tanpa satu pun
    // tanda bahwa ia dihentikan.
    const fungsi = alat.slice(alat.indexOf("function alatPasangJalanKeluar("));
    const badan = fungsi.slice(0, fungsi.indexOf("\n}\n"));
    const dblclick = badan.slice(badan.indexOf('"dblclick",'));
    expect(dblclick).toMatch(/true\s*\n\s*\);/);
    const keydown = badan.slice(badan.indexOf('"keydown",'), badan.indexOf('"dblclick",'));
    expect(keydown).toMatch(/true\s*\n\s*\);/);
  });

  it("Escape TIDAK merebut pembatalan suntingan DI DALAM panel", () => {
    // Kotak isian memakai Escape untuk membatalkan; merebutnya berarti
    // menutup panel sekaligus membuang ketikan orang.
    expect(alat).toContain("const sedangMenyunting = ");
    // Panelnya ikut disebut sejak pendengarnya menjadi satu pasang untuk
    // seluruh halaman - lihat "satu pasang pendengar" di bawah.
    expect(alat).toContain("if (sedangMenyunting(entri.panel)) continue;");
  });

  it("isian HALAMAN tidak lagi membungkam Escape", () => {
    // 1.155.0 - sebab "escape tidak berfungsi di sipp dan abt, di aleta
    // berfungsi". SIPP dan ABT halaman borang dari ujung ke ujung: satu klik
    // pada kolom mana pun membuat fokus tinggal di isian halaman, sehingga
    // syarat lama (isian mana pun yang berfokus) hampir selalu terpenuhi dan
    // Escape tidak pernah sampai ke panel. Portal ALETA hampir tidak punya
    // borang - karena itu di sana ia terasa bekerja.
    const fungsi = alat.slice(alat.indexOf("const sedangMenyunting = "));
    expect(fungsi.slice(0, 600)).toContain("if (!panel.contains(fokus)) return false;");
  });

  it("tingkap milik halamannya sendiri tidak direbut", () => {
    // Escape di atas tingkap SIPP yang terbuka berarti "tutup tingkap ini",
    // bukan "ciutkan panel di belakangnya" - dan yang terjadi kalau direbut
    // adalah tingkap yang tetap menutupi layar sementara panel yang TIDAK
    // sedang dilihat diam-diam menciut.
    expect(alat).toContain("function alatTingkapHalamanTerbuka(");
    expect(alat).toContain("#popup_form, #popup_form_2nd");
    expect(alat).toContain(".mfp-wrap");
    expect(alat).toContain("if (alatTingkapHalamanTerbuka()) return;");
    // getClientRects, bukan offsetParent: tingkap SIPP position:fixed, dan
    // offsetParent elemen fixed selalu null.
    expect(alat).toContain("tingkap.getClientRects().length > 0");
  });

  it("panel SIPP ikut mendapatkannya - dan menciut dengan caranya sendiri", () => {
    const konten = baca("konten.js");
    expect(konten).toContain("alatPasangJalanKeluar(panel, KUNCI_POSISI, {");
    // ciutkanKeLencana, bukan alatCiutkan: keadaan lencana panel SIPP
    // disimpan lewat simpanKeadaanPanel, dan dua penyimpan untuk satu keadaan
    // akan saling menimpa.
    expect(konten).toContain("ciutkan: () => ciutkanKeLencana(panel, true),");
    expect(alat).toContain("if (entri.opsi && typeof entri.opsi.ciutkan === \"function\")");
  });

  it("klik ganda DI DALAM panel tidak menciutkan - itu memilih kata", () => {
    expect(alat).toContain("if (panel.contains(peristiwa.target)) continue;");
  });
});

describe("reset menjangkar ke kanan", () => {
  it("ditulis sendiri, tidak diserahkan ke rambatan CSS", () => {
    // Membersihkan gaya sebaris SEHARUSNYA mengembalikannya ke kanan, tetapi
    // pada halaman yang aturannya bertumpuk jangkar kanan tidak selalu menang
    // kembali - dan panel melompat ke kiri, menutupi tempat kerja.
    const fungsi = alat.slice(alat.indexOf("function alatKembalikanBawaan("));
    const badan = fungsi.slice(0, fungsi.indexOf("\n}\n"));
    expect(badan).toContain('panel.style.right = "12px";');
    expect(badan).toContain('panel.style.left = "auto";');
    expect(badan).toContain('panel.style.top = "12px";');
  });
});

describe("sunting sekali klik di ABT - bawaannya MATI", () => {
  it("saklarnya ada, dan kuncinya di perkakas bersama", () => {
    expect(alat).toContain('const KUNCI_SUNTING_LANGSUNG = "suntingLangsungAbt";');
    expect(alat).toContain("async function alatSuntingLangsung()");
  });

  it("penyimpanan yang gagal dibaca berarti MATI, bukan menyala", () => {
    // Yang gagal dibaca tidak boleh menyalakan perilaku yang mengubah berkas
    // perkara.
    const fungsi = alat.slice(alat.indexOf("async function alatSuntingLangsung()"));
    expect(fungsi.slice(0, 400)).toContain("return false;");
  });

  it("klik hanya menyunting bila saklarnya menyala - dibaca ULANG", () => {
    // Salinan di memori dapat basi tanpa satu pun tanda: tab yang dibekukan
    // peramban tidak menerima chrome.storage.onChanged, dan ekstensi yang
    // dimuat ulang meninggalkan tab lama tanpa pendengar sama sekali. Pada
    // keadaan itu centang di tingkap ekstensi berkata satu hal dan halaman
    // mengerjakan yang lain.
    //
    // Yang dicegah nyata: penyunting yang terbuka TANPA DIMAKSUD pada
    // halaman tempat naskah putusan disusun.
    expect(abt).toContain("if (!(await suntingLangsungSekarang())) return;");
    expect(abt, "salinan memori tidak boleh jadi penentu").not.toContain(
      "if (!suntingLangsungNyala) return;"
    );
  });

  it("saat mati, tombol Sunting per baris tetap ada", () => {
    // Yang berubah bukan kemampuannya menyunting melainkan seberapa mudah ia
    // terbuka TANPA dimaksud.
    expect(abt).toContain('buatElemen("button", "aleta-perkakas-pulih", "Sunting")');
    expect(abt).toContain("usul.appendChild(tombolSunting);");
  });

  it("popup menawarkannya, dan tidak tercentang secara bawaan", () => {
    expect(popupHtml).toContain('id="suntingLangsungAbt"');
    // Tanpa atribut checked pada markupnya.
    const potong = popupHtml.slice(popupHtml.indexOf('id="suntingLangsungAbt"') - 60);
    expect(potong.slice(0, 120)).not.toContain("checked");
    expect(popupJs).toContain('simpan("suntingLangsungAbt", kotakSunting.checked)');
  });
});

describe("unduhan tidak lagi diblokir Chrome", () => {
  it("izin downloads diminta", () => {
    expect(manifest.permissions).toContain("downloads");
  });

  it("diterbitkan pekerja latar, dari alamat data:", () => {
    // Alamat blob mewarisi asal halamannya - http://192.168.10.10 - jadi ia
    // tetap diblokir. Yang menolong adalah menerbitkannya dari ekstensi.
    expect(latar).toContain('pesan.jenis === "unduh"');
    expect(latar).toContain("chrome.downloads.download(");
    // Hanya data: yang diterima - alamat sembarang dari halaman tidak boleh
    // menumpang izin unduh ekstensi.
    expect(latar).toContain('if (!alamat.startsWith("data:"))');
  });

  it("panel mengirimkannya, dan punya jalan mundur bila gagal", () => {
    expect(abt).toContain('jenis: "unduh"');
    expect(abt).toContain("function unduhLewatTautan(");
    // Unduhan yang tertahan peringatan masih jauh lebih baik daripada
    // unduhan yang tidak terjadi.
    const fungsi = abt.slice(abt.indexOf("async function unduhBlob("));
    expect(fungsi.slice(0, 1400)).toContain("unduhLewatTautan(blob, nama);");
  });

  it("nama berkas dibersihkan sebelum ditulis ke cakram", () => {
    expect(latar).toContain('.replace(/[\\\\/:*?"<>|]+/g, "_")');
  });
});
