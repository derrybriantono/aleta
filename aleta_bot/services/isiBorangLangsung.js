"use strict";

/**
 * Mengisi kolom borang di halaman LANGSUNG (keputusan pengguna 17 Okt 2026:
 * "isi form itu otomatis langsung isi, jangan seperti manusia").
 *
 * Nilai disetel sekali lewat penyetel asli elemen lalu input/change/blur
 * dilepas, jadi kerangka halaman (jQuery, Vue, React) tetap melihat perubahan.
 * Tidak ada ketikan per huruf dan tidak ada jeda. Bila sesudahnya nilai yang
 * terbaca tidak sama (kolom bertopeng atau menolak setelan), jatuh ke
 * page.type tanpa jeda - tetap seketika.
 *
 * Bedakan dengan jedaManusiaService: itu HANYA untuk tulisan ke database
 * (penetapan, jadwal, putusan, e-Doc) yang riwayatnya harus tampak seperti
 * kerja petugas. Pengisian borang tidak memakainya.
 *
 * Nilai (termasuk sandi/passphrase) tidak pernah dikembalikan atau dicatat.
 */

/** Dijalankan DI DALAM halaman. */
function setelDiHalaman(el, nilai) {
  const proto = Object.getPrototypeOf(el);
  const deskriptor = Object.getOwnPropertyDescriptor(proto, "value");
  if (el.focus) el.focus();
  if (deskriptor && typeof deskriptor.set === "function") deskriptor.set.call(el, nilai);
  else el.value = nilai;
  for (const nama of ["input", "change", "blur"]) {
    el.dispatchEvent(new Event(nama, { bubbles: true }));
  }
  return el.value === nilai;
}

/**
 * @param {import("puppeteer").ElementHandle} kolom
 * @param {string} nilai
 * @returns {Promise<boolean>} true bila terisi lewat setelan langsung; false bila
 *   harus jatuh ke papan ketik tanpa jeda (kolom tetap terisi).
 */
async function isiKolom(kolom, nilai) {
  const teks = String(nilai === null || nilai === undefined ? "" : nilai);
  let cocok = false;
  try {
    cocok = Boolean(await kolom.evaluate(setelDiHalaman, teks));
  } catch {
    cocok = false;
  }
  if (!cocok) {
    // Cadangan: papan ketik tanpa jeda per huruf, di atas kolom yang dikosongkan
    // lebih dulu (mengetik di atas isian sebagian menghasilkan sandi ganda).
    await kolom.evaluate((el) => {
      el.value = "";
    });
    await kolom.type(teks);
    return false;
  }
  return true;
}

/**
 * @param {import("puppeteer").Page} page
 * @param {string} selektor
 * @param {string} nilai
 */
async function isiSelektor(page, selektor, nilai) {
  const kolom = await page.$(selektor);
  if (!kolom) throw new Error("kolom_tidak_ditemukan");
  return isiKolom(kolom, nilai);
}

module.exports = { isiKolom, isiSelektor, setelDiHalaman };
