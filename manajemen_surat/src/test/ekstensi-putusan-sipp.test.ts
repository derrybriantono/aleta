// @vitest-environment node

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * ============================================================================
 * DUA FITUR PUTUSAN PADA EKSTENSI - DIJAGA DARI SUMBERNYA
 * ============================================================================
 *
 * Skrip ekstensi berjalan di halaman SIPP dan ABT, di peramban petugas. Tidak
 * ada satu pun uji yang dapat menjalankannya di sini: tanpa halaman SIPP,
 * tanpa CKEditor, tanpa sesi. Yang DAPAT dijaga adalah janji-janji yang bila
 * dilanggar berakibat pada dokumen resmi - dan ketiga janji di bawah ini
 * pernah hampir dilanggar justru ketika kodenya dirapikan.
 *
 * Uji semacam ini menjaga KALIMAT di dalam kode, jadi ia ikut menua bersama
 * kodenya. Itu diterima dengan sadar: harga yang dibayar kecil dibandingkan
 * satu putusan yang tersimpan tanpa dibaca.
 */

const akar = path.resolve(process.cwd(), "..");
const baca = (nama: string) => readFileSync(path.join(akar, "ekstensi-sipp", nama), "utf8");

describe("usulan ABT dapat disunting sebelum dimasukkan", () => {
  const abt = baca("abt.js");

  it("yang disimpan ke ABT adalah nilai yang terbaca saat Terapkan, bukan usulan semula", () => {
    // Kalau baris ini kembali memakai x.usulan.nilai, suntingan petugas
    // hilang tanpa satu pun tanda - dan yang masuk blangko adalah kalimat
    // mesin yang justru sudah ia perbaiki.
    expect(abt).toContain("const nilaiDipakai = x.nilai();");
    expect(abt).toContain("simpanVariabel(x.usulan.kode, nilaiDipakai, jatiDiri)");
  });

  it("penyaring centang memakai isi terkini, sehingga usulan kosong yang diisi sendiri ikut terpakai", () => {
    expect(abt).toContain("pilih.filter((x) => x.centang.checked && x.nilai())");
  });

  it("riwayat membedakan yang disunting petugas dari usulan mesin", () => {
    // Tanpa pembedaan ini, kalimat yang ditulis petugas tercatat seolah-olah
    // usulan mesin, dan yang membacanya kelak tidak dapat membedakan mana
    // yang diperiksa manusia.
    expect(abt).toContain("disunting petugas sebelum disimpan");
    expect(abt).toContain("diketik petugas di panel ALETA");
  });

  it("kotak suntingnya dapat dibatalkan dan dapat dicapai tanpa tetikus", () => {
    expect(abt).toContain('peristiwa.key === "Escape"');
    expect(abt).toMatch(/isi\.tabIndex = 0/);
    expect(abt).toContain('isi.setAttribute("role", "button")');
  });

  it("centang mengikuti ada-tidaknya isi, bukan usulan semula", () => {
    expect(abt).toContain("centang.disabled = !nilaiTerkini;");
  });

  it("gaya penanda suntingnya ada, sehingga kemampuan itu terlihat", () => {
    // Teks yang dapat diklik tanpa penanda apa pun bukan kemampuan,
    // melainkan rahasia.
    const css = baca("panel.css");
    expect(css).toContain(".aleta-abt-isi-sunting");
    expect(css).toContain(".aleta-abt-sunting-kotak");
  });
});

describe("mengisi borang putusan SIPP", () => {
  const konten = baca("konten.js");

  it("tidak pernah menekan tombol Simpan", () => {
    // Yang tersimpan di borang ini menjadi putusan resmi. Satu-satunya tempat
    // manusia masih membacanya adalah sebelum Simpan ditekan.
    const bagian = konten.slice(
      konten.indexOf("function bagianIsiPutusan("),
      konten.indexOf("function bagianBacaBorang(")
    );
    expect(bagian.length).toBeGreaterThan(500);
    expect(bagian).not.toContain('jenis: "tekan"');
    expect(bagian).toContain("tekan Simpan sendiri");
  });

  it("mengisi ketiga editor lewat jembatan dengan jenis medan kaya", () => {
    // CKEditor menyimpan nilainya di obyek JavaScript, bukan di DOM.
    // Menyetel value pada textarea aslinya membuat tampilannya berubah tanpa
    // nilainya ikut - dan yang tersimpan kemudian bukan yang terlihat.
    expect(konten).toContain('jenisMedan: "kaya"');
    expect(konten).toContain('"#perhum"');
    expect(konten).toContain('"#amar"');
    expect(konten).toContain('"#amar_anonim"');
  });

  it("hanya digambar di halaman yang benar-benar memuat borang putusan", () => {
    expect(konten).toContain('document.querySelector("#frm_putusan")');
  });

  it("tidak menyentuh status putusan, verstek, maupun sumber hukum", () => {
    // Pilihannya sudah disaring SIPP menurut jenis dan alur perkara, dan
    // salah pilih di situ mengubah jenis putusannya - bukan sekadar salah
    // ketik.
    const bagian = konten.slice(
      konten.indexOf("function bagianIsiPutusan("),
      konten.indexOf("function bagianBacaBorang(")
    );
    expect(bagian).not.toContain("#status_putusan");
    expect(bagian).not.toContain("#verstek");
    expect(bagian).not.toContain("sumber_hukum");
  });

  it("bagian yang kosong pada draf disebut, bukan diisikan", () => {
    expect(konten).toContain("Belum terisi pada draf");
    expect(konten).toContain("Bagian itu tidak akan diisikan");
  });

  it("memakai rute portal yang memang ada", () => {
    expect(konten).toContain('const ALETA_API_ISIAN_PUTUSAN = "/aleta/api/aleta-ecourt/putusan/isian-sipp"');
    // Dan rutenya benar-benar ada di portal - alamat yang salah ketik hanya
    // terlihat ketika petugas menekan tombolnya.
    const rute = path.resolve(
      process.cwd(),
      "src/app/api/aleta-ecourt/putusan/isian-sipp/route.ts"
    );
    expect(readFileSync(rute, "utf8")).toContain("export async function GET");
  });
});
