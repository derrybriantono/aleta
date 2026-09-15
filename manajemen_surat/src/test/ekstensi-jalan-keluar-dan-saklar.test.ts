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
    expect(alat).toContain('document.addEventListener("dblclick"');
    // Dipasang bersama panelnya - kalau tidak, ia hanya ada di berkasnya.
    expect(alat).toContain("alatPasangJalanKeluar(panel, kunci);");
  });

  it("Escape TIDAK merebut pembatalan suntingan", () => {
    // Kotak isian memakai Escape untuk membatalkan; merebutnya berarti
    // menutup panel sekaligus membuang ketikan orang.
    expect(alat).toContain("const sedangMenyunting = ");
    expect(alat).toContain("if (sedangMenyunting()) return;");
  });

  it("klik ganda DI DALAM panel tidak menciutkan - itu memilih kata", () => {
    expect(alat).toContain("if (panel.contains(peristiwa.target)) return;");
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

  it("klik hanya menyunting bila saklarnya menyala", () => {
    expect(abt).toContain("if (!suntingLangsungNyala) return;");
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
