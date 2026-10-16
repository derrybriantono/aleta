// @vitest-environment node

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * ============================================================================
 * UKURAN HURUF PANEL - SATU SETELAN, DUA BERKAS YANG HARUS SEPAKAT
 * ============================================================================
 *
 * Popup berjalan di halaman ekstensi dan TIDAK memuat panel-alat.js, sehingga
 * batas serta langkahnya terpaksa ditulis dua kali. Duplikasi itu diterima
 * dengan sadar, tetapi hanya bila ada yang menjaganya: kalau popup menawarkan
 * 200% sementara panel menjepitnya di 160%, petugas menyetel angka yang tidak
 * pernah berlaku dan tidak ada satu pun pesan yang mengatakannya.
 */

const AKAR = path.resolve(process.cwd(), "..", "ekstensi-sipp");
const baca = (nama: string) => readFileSync(path.join(AKAR, nama), "utf8");

/** Angka di balik sebuah const, apa pun spasinya. */
function angkaKonstanta(sumber: string, nama: string): number | null {
  const cocok = new RegExp(`const\\s+${nama}\\s*=\\s*(-?\\d+)`).exec(sumber);
  return cocok ? Number(cocok[1]) : null;
}

describe("tiap ukuran huruf panel dapat diskalakan", () => {
  const css = baca("panel.css");

  it("tidak ada lagi font-size yang dipatok px polos", () => {
    // Satu saja yang tertinggal akan tetap kecil ketika seluruh panel
    // diperbesar - dan yang tertinggal itu justru tidak pernah disadari,
    // sebab yang memeriksanya melihat panel yang sebagian besar sudah benar.
    const polos = css.match(/font-size:\s*[\d.]+px/g) || [];
    expect(polos).toEqual([]);
  });

  it("seluruhnya memakai pengali yang sama", () => {
    const berpengali = css.match(/font-size:\s*calc\([\d.]+px \* var\(--aleta-skala-huruf, 1\)\)/g) || [];
    expect(berpengali.length).toBeGreaterThan(90);
  });

  it("pengalinya bernilai 1 bila tidak disetel, sehingga tampilan bawaannya tidak berubah", () => {
    // var(--aleta-skala-huruf, 1) - angka 1 sesudah koma itulah yang membuat
    // panel yang belum pernah disetel tampil persis seperti sebelumnya.
    expect(css).toContain("var(--aleta-skala-huruf, 1)");
    expect(css).not.toContain("var(--aleta-skala-huruf)");
  });
});

describe("panel memasang skalanya sendiri", () => {
  const alat = baca("panel-alat.js");

  it("dipasang di akar dokumen, bukan pada satu panel tertentu", () => {
    // Satu halaman dapat memuat panel dan sisipan sekaligus. Menyetelnya di
    // akar membuat seluruhnya ikut tanpa daftar elemen yang harus dijaga.
    expect(alat).toContain('document.documentElement.style.setProperty("--aleta-skala-huruf"');
  });

  it("dibaca dari penyimpanan ekstensi, jadi ia bawaan orang itu sendiri", () => {
    expect(alat).toContain('const ALAT_SKALA_KUNCI = "skalaHuruf"');
    expect(alat).toContain("chrome.storage.local.get([ALAT_SKALA_KUNCI])");
  });

  it("perubahan dari popup berlaku tanpa memuat ulang halaman", () => {
    expect(alat).toContain("chrome.storage.onChanged.addListener");
    expect(alat).toContain("perubahan[ALAT_SKALA_KUNCI]");
  });

  it("nilai yang tidak masuk akal dijepit, bukan dipakai apa adanya", () => {
    // Yang tersimpan pernah ditulis tangan lewat penyimpanan ekstensi. Angka
    // 1000 akan membuat satu huruf memenuhi layar, dan jalan kembalinya lewat
    // popup yang hurufnya ikut raksasa.
    expect(alat).toContain("function alatRapikanSkala(");
    expect(alat).toMatch(/Math\.min\(ALAT_SKALA_MAKS, Math\.max\(ALAT_SKALA_MIN,/);
  });

  it("penyimpanan yang tidak tersedia tidak menghentikan panel", () => {
    const potongan = alat.slice(alat.indexOf("async function alatMuatSkalaHuruf("));
    expect(potongan).toContain("catch");
    expect(potongan).toContain("ALAT_SKALA_BAWAAN");
  });
});

describe("popup menawarkan angka yang benar-benar berlaku", () => {
  const alat = baca("panel-alat.js");
  const popup = baca("popup.js");
  const laman = baca("popup.html");

  it("batas, langkah, dan kuncinya sama persis dengan milik panel", () => {
    for (const [diPopup, diPanel] of [
      ["SKALA_BAWAAN", "ALAT_SKALA_BAWAAN"],
      ["SKALA_MIN", "ALAT_SKALA_MIN"],
      ["SKALA_MAKS", "ALAT_SKALA_MAKS"],
      ["SKALA_LANGKAH", "ALAT_SKALA_LANGKAH"],
    ]) {
      const a = angkaKonstanta(popup, diPopup);
      const b = angkaKonstanta(alat, diPanel);
      expect(a, `${diPopup} tidak terbaca di popup.js`).not.toBeNull();
      expect(b, `${diPanel} tidak terbaca di panel-alat.js`).not.toBeNull();
      expect(a, `${diPopup} (${a}) harus sama dengan ${diPanel} (${b})`).toBe(b);
    }
    expect(popup).toContain('const SKALA_KUNCI = "skalaHuruf"');
  });

  it("batasnya masuk akal - tidak terbalik, dan langkahnya membagi rentangnya", () => {
    const min = angkaKonstanta(popup, "SKALA_MIN") as number;
    const maks = angkaKonstanta(popup, "SKALA_MAKS") as number;
    const langkah = angkaKonstanta(popup, "SKALA_LANGKAH") as number;
    const bawaan = angkaKonstanta(popup, "SKALA_BAWAAN") as number;
    expect(min).toBeLessThan(maks);
    expect(langkah).toBeGreaterThan(0);
    expect((maks - min) % langkah).toBe(0);
    // Bawaannya harus dapat dicapai dengan menekan tombol, kalau tidak tombol
    // "kembalikan" memulangkan angka yang tidak pernah muncul dari + dan -.
    expect((bawaan - min) % langkah).toBe(0);
    expect(bawaan).toBeGreaterThanOrEqual(min);
    expect(bawaan).toBeLessThanOrEqual(maks);
  });

  it("deklarasinya mendahului pemakaian - const tidak terangkat", () => {
    // Ini pernah salah dan akibatnya jauh lebih besar daripada kelihatannya:
    // SKALA_KUNCI dipakai pada baris .get(...) yang berjalan di tingkat modul,
    // sedangkan const-nya ada di bawah. ReferenceError, seluruh skrip popup
    // mati, dan saklar yang selama ini berfungsi ikut mati bersamanya.
    const posDeklarasi = popup.indexOf('const SKALA_KUNCI = "skalaHuruf"');
    // Pemakaian PERTAMA di mana pun, bukan satu baris yang dihafal bentuknya.
    const posPakai = popup.indexOf("SKALA_KUNCI", posDeklarasi + 1);
    expect(posDeklarasi).toBeGreaterThan(-1);
    expect(posPakai).toBeGreaterThan(-1);
    expect(posDeklarasi).toBeLessThan(posPakai);

    // Dan yang paling menentukan: baris .get(...) berjalan di tingkat modul,
    // jadi deklarasinya harus mendahuluinya.
    const posGet = popup.indexOf('"asalPortal", SKALA_KUNCI');
    expect(posGet).toBeGreaterThan(-1);
    expect(posDeklarasi).toBeLessThan(posGet);

    // Begitu pula seluruh keadaan dan fungsi yang dipakai pasangNilai.
    const posPasangNilai = popup.indexOf("function pasangNilai(simpan) {");
    for (const nama of ["let skalaSekarang", "function rapikanSkala(", "function gambarSkala("]) {
      const pos = popup.indexOf(nama);
      expect(pos, `${nama} tidak ketemu`).toBeGreaterThan(-1);
      expect(pos, `${nama} harus mendahului pasangNilai`).toBeLessThan(posPasangNilai);
    }
  });

  it("kotaknya ada di popup.html beserta kelima kendalinya", () => {
    for (const id of ["skalaKurang", "skalaTambah", "skalaNilai", "skalaContoh", "skalaPulih"]) {
      expect(laman).toContain(`id="${id}"`);
    }
  });

  it("nilainya ikut dibaca saat popup dibuka, bukan hanya saat diubah", () => {
    expect(popup).toContain('"asalPortal", SKALA_KUNCI');
    expect(popup).toContain("skalaSekarang = rapikanSkala(");
  });

  it("tombol yang sudah mentok dimatikan", () => {
    // Tombol yang diam-diam tidak berbuat apa pun membuat orang menyangka
    // setelannya rusak.
    expect(popup).toContain("skalaKurang.disabled = skalaSekarang <= SKALA_MIN");
    expect(popup).toContain("skalaTambah.disabled = skalaSekarang >= SKALA_MAKS");
  });
});
