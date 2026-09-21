import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Tata letak keterangan dua saksi - berdampingan atau atas-bawah.
 *
 * ============================================================================
 * YANG DIJAGA DI SINI BUKAN ADANYA TOMBOL, MELAINKAN LETAK DAN BAWAANNYA
 * ============================================================================
 *
 * Permintaan penggunanya tiga hal sekaligus, dan ketiganya dapat patah
 * sendiri-sendiri tanpa satu pun galat berbunyi:
 *
 *   1. tampilan AWALNYA berdampingan - bukan atas-bawah;
 *   2. tombolnya di ujung KANAN;
 *   3. tombolnya menukar ke atas-bawah, bukan sekadar melebarkan panel.
 *
 * Penjaga yang hanya menanyakan "apakah kelasnya ada" akan tetap hijau
 * sesudah seseorang memulangkan bawaannya ke satu kolom.
 */

const AKAR = path.resolve(process.cwd(), "..");
const baca = (jalur: string) =>
  readFileSync(path.join(AKAR, jalur), "utf8").replace(/\r\n/g, "\n");

const css = baca("ekstensi-sipp/panel.css");
const abt = baca("ekstensi-sipp/abt.js");

describe("bawaannya BERDAMPINGAN", () => {
  it("wadah dua saksi berkolom dua tanpa syarat apa pun", () => {
    // Inti permintaannya. Sebelumnya aturan ini berbunyi 1fr - satu kolom -
    // dan berdampingan hanya terjadi lewat kelas panel penuh/lebar.
    const i = css.indexOf(".aleta-sdg-dua {");
    expect(i).toBeGreaterThan(-1);
    const blok = css.slice(i, css.indexOf("}", i));
    expect(blok).toContain("grid-template-columns: minmax(0, 1fr) minmax(0, 1fr)");
  });

  it("kolomnya memakai minmax(0,…), bukan 1fr telanjang", () => {
    // Kolom grid berlebar auto tidak mau mengecil di bawah lebar isinya. Satu
    // jawaban panjang tanpa spasi akan melebarkan kolomnya melewati panel dan
    // membawa gulir mendatar ke SELURUH panel, bukan hanya ke kolom itu.
    const i = css.indexOf(".aleta-sdg-dua {");
    const blok = css.slice(i, css.indexOf("}", i));
    expect(blok).not.toMatch(/grid-template-columns:\s*1fr\s*1fr/);
  });

  it("kelas panel penuh/lebar TIDAK lagi menentukan tata letaknya", () => {
    // Ia mengubah LEBAR, bukan pilihan orangnya. Selama aturan lama masih
    // ada, melebarkan panel diam-diam membatalkan pilihan atas-bawah yang
    // baru saja ditekan - dan tidak ada apa pun di layar yang menyebutkannya.
    expect(css).not.toContain(".aleta-panel-penuh .aleta-sdg-dua");
    expect(css).not.toContain(".aleta-panel-lebar .aleta-sdg-dua");
  });

  it("atas-bawah punya kelasnya sendiri", () => {
    const i = css.indexOf(".aleta-sdg-dua.aleta-sdg-tumpuk");
    expect(i).toBeGreaterThan(-1);
    const blok = css.slice(i, css.indexOf("}", i));
    expect(blok).toContain("grid-template-columns: minmax(0, 1fr)");
  });
});

describe("tombolnya di ujung kanan, dan di LUAR wadah kolom", () => {
  it("bilahnya merenggangkan isinya ke dua ujung", () => {
    const i = css.indexOf(".aleta-sdg-tata {");
    expect(i).toBeGreaterThan(-1);
    const blok = css.slice(i, css.indexOf("}", i));
    expect(blok).toContain("justify-content: space-between");
  });

  it("dipasang ke kotak, BUKAN ke wadah kolomnya", () => {
    // gambarKolom() mengosongkan wadah kolom tiap kali baris digeser,
    // disalin, atau dihapus. Tombol yang duduk di dalamnya lenyap pada
    // penggeseran pertama - dan lenyapnya tidak berbunyi apa pun.
    expect(abt).toContain("kotak.appendChild(bilahTata);");
    expect(abt).not.toContain("dua.appendChild(bilahTata)");
  });

  it("bilahnya digambar SEBELUM wadah kolomnya", () => {
    const iBilah = abt.indexOf("kotak.appendChild(bilahTata);");
    const iDua = abt.indexOf("kotak.appendChild(dua);");
    expect(iBilah).toBeGreaterThan(-1);
    expect(iDua).toBeGreaterThan(iBilah);
  });

  it("wadah kolomnya memang dikosongkan - sebab penjaga di atas ada", () => {
    // Bila suatu hari gambarKolom() tidak lagi mengosongkannya, penjaga di
    // atas kehilangan sebabnya dan patut ditinjau ulang, bukan diam-diam
    // dipertahankan.
    expect(abt).toContain('dua.textContent = "";');
  });
});

describe("tulisannya menyebut yang AKAN terjadi", () => {
  it("bukan keadaan sekarang", () => {
    // Tombol yang menyebut keadaan dibaca separuh orang sebagai keadaan dan
    // separuh lagi sebagai tindakan; yang salah membacanya menekannya dua
    // kali lalu menyerah.
    expect(abt).toContain("Jadikan atas-bawah");
    expect(abt).toContain("Jadikan berdampingan");
  });

  it("keadaan sekarang tetap dikatakan, di title", () => {
    expect(abt).toContain("Sekarang berdampingan.");
    expect(abt).toContain("Sekarang atas-bawah.");
  });

  it("keadaannya terbaca pembaca layar", () => {
    expect(abt).toContain('tombolTata.setAttribute("aria-pressed"');
  });
});

describe("pilihannya diingat, dan gagalnya tidak menjatuhkan apa pun", () => {
  it("disimpan di chrome.storage.local", () => {
    expect(abt).toContain('const KUNCI_TATA_SAKSI = "tataLetakSaksi";');
    expect(abt).toContain("chrome.storage.local.set({ [KUNCI_TATA_SAKSI]: tataSaksi })");
  });

  it("bawaannya damping pada tiap jalur gagal", () => {
    // Dua jalur: storage tidak terbaca, dan nilai tersimpan yang bukan
    // "tumpuk". Keduanya harus jatuh ke berdampingan - bukan ke undefined,
    // yang akan membuat kelasnya tidak dipasang maupun dilepas.
    const i = abt.indexOf("async function muatTataSaksi()");
    const blok = abt.slice(i, abt.indexOf("\n}", i));
    expect(blok).toContain('=== "tumpuk" ? "tumpuk" : "damping"');
    expect(blok).toContain('tataSaksi = "damping";');
  });

  it("menyimpan lewat try/catch - pilihannya tetap berlaku walau tak teringat", () => {
    const i = abt.indexOf("function simpanTataSaksi(");
    const blok = abt.slice(i, abt.indexOf("\n}", i));
    expect(blok).toContain("try {");
    expect(blok).toContain("catch");
  });

  it("dibaca SEKALI seumur halaman, di dalam penjaga yang sudah ada", () => {
    // Panel ABT dibangun ulang tiap kali bagian halamannya berganti. Di luar
    // penjaga itu, pembacaan yang asinkron dapat menimpa pilihan yang baru
    // saja ditekan orang dengan nilai lama yang baru selesai dibaca.
    const i = abt.indexOf("if (!saklarCetakDibaca) {");
    expect(i).toBeGreaterThan(-1);
    const blok = abt.slice(i, abt.indexOf("}", i) + 1);
    expect(blok).toContain("await muatTataSaksi();");
  });
});
