"use strict";

/**
 * ============================================================================
 * PEMUAT KATALOG SUSUN SAKSI PER JENIS PERKARA (K10, 25 Okt 2026, rantai C butir C2)
 * ============================================================================
 *
 * Dahulu seluruh katalog (9,4 MB) disuntik ke SETIAP halaman ABT sebagai satu skrip
 * (saksi-katalog-data.js). PC tua menanggung ±12,4 MB JS per tab ABT. Sekarang halaman
 * hanya memuat INDEKS kecil (saksi-katalog-indeks.js: kunci, judul, syarat, kode variabel)
 * dan berkas ini; isi katalog dimuat HANYA untuk jenis perkara yang dibuka:
 *
 *   utama (dikenali dari syarat jenis/alur/nama) + semua yang `tambahanUntuk` memuat kuncinya
 *   (kumulasi, keterangan anak/calon) = paket yang dulu sudah ada di ALETA_SAKSI_KATALOG_DATA.
 *
 * Isi dipasang ke globalThis.ALETA_SAKSI_KATALOG_DATA - larik yang sama yang dibaca saksi-susun.js
 * dan blangko-derry-katalog.js - sehingga mesin dan hasil susunan TIDAK berubah. Katalog yang sudah
 * ada di larik itu (uji, atau cadangan) tidak dimuat lagi.
 *
 * Sumber isi: berkas JSON di paket ekstensi (web_accessible_resources, tanpa izin baru); ingatan
 * halaman menyimpannya selama halaman hidup, dan peramban menyimpan berkasnya. Gagal memuat = false
 * (tombol Susun saksi tetap tersembunyi, tidak ada yang ditebak) - tidak pernah melempar.
 */
(function () {
  const Mesin = () => globalThis.AletaSaksiKatalog;
  const daftar = (x) => (Array.isArray(x) ? x : []);

  const indeks = () => daftar(globalThis.ALETA_SAKSI_KATALOG_INDEKS);
  function data() {
    if (!Array.isArray(globalThis.ALETA_SAKSI_KATALOG_DATA)) globalThis.ALETA_SAKSI_KATALOG_DATA = [];
    return globalThis.ALETA_SAKSI_KATALOG_DATA;
  }

  const janji = new Map(); // kunci -> Promise<boolean>
  const gagal = new Set();
  let versi = 0;

  const sudahAda = (kunci) => data().some((k) => k && k.kunci === kunci);

  function alamat(berkas) {
    try {
      if (typeof chrome !== "undefined" && chrome.runtime && typeof chrome.runtime.getURL === "function") return chrome.runtime.getURL(berkas);
    } catch {
      /* tanpa chrome.runtime */
    }
    return berkas;
  }

  /** Memuat SATU berkas katalog dan memasangnya; true bila katalog itu kini ada di larik data. */
  function muatSatu(butir) {
    if (!butir || !butir.kunci) return Promise.resolve(false);
    if (sudahAda(butir.kunci)) return Promise.resolve(true);
    if (janji.has(butir.kunci)) return janji.get(butir.kunci);
    const p = (async () => {
      try {
        const r = await fetch(alamat(butir.berkas), { cache: "force-cache" });
        if (!r || !r.ok) throw new Error(`status ${r && r.status}`);
        const kat = await r.json();
        if (!kat || kat.kunci !== butir.kunci) throw new Error("kunci katalog tidak cocok");
        if (!sudahAda(butir.kunci)) {
          data().push(kat);
          versi += 1;
        }
        gagal.delete(butir.kunci);
        return true;
      } catch {
        gagal.add(butir.kunci);
        janji.delete(butir.kunci); // gagal boleh dicoba lagi
        return false;
      }
    })();
    janji.set(butir.kunci, p);
    return p;
  }

  /** Kunci yang harus dimuat bersama `kunci`: katalog itu sendiri dan semua yang menempel padanya. */
  function paketKunci(kunci) {
    const hasil = [kunci];
    for (const k of indeks()) if (k && k.kunci !== kunci && daftar(k.tambahanUntuk).includes(kunci)) hasil.push(k.kunci);
    return hasil;
  }

  /** Memuat paket satu katalog (utama + tambahan + keterangan). true bila SEMUANYA kini tersedia. */
  async function siapkanKunci(kunci) {
    const butir = new Map(indeks().map((k) => [k.kunci, k]));
    const hasil = await Promise.all(paketKunci(kunci).map((k) => muatSatu(butir.get(k) || (sudahAda(k) ? { kunci: k } : null))));
    return hasil.every(Boolean);
  }

  /** Katalog utama untuk perkara ini menurut INDEKS (tanpa memuat isi), atau null. */
  function kenaliDiIndeks(perkara) {
    const m = Mesin();
    return m ? m.kenaliKatalog(indeks(), perkara) : null;
  }

  /**
   * Memuat paket yang diperlukan perkara ini. `perkara` = {jenisPerkaraId, alurPerkaraId, nama}.
   * true bila perkara ini tidak punya katalog (tidak ada yang perlu dimuat) atau semuanya termuat.
   */
  async function siapkan(perkara) {
    const utama = kenaliDiIndeks(perkara);
    if (!utama) return true;
    return siapkanKunci(utama.kunci);
  }

  /** Katalog yang mungkin bagi alur ini (petugas memilih jenis), dari indeks - sama dengan kandidatKatalog di saksi-susun.js. */
  function kandidat(alur) {
    const a = String(alur || "").trim();
    return indeks().filter((kat) => {
      if (!kat || kat.contoh === true || !kat.syarat || (kat.tambahanUntuk && kat.tambahanUntuk.length)) return false;
      const alurSah = daftar(kat.syarat.alurPerkaraId).map(String);
      return !a || !alurSah.length || alurSah.includes(a);
    });
  }

  /** Katalog palsu per butir indeks yang hanya memuat kode variabelnya: masukan kodeDipakaiKatalog tanpa memuat isi. */
  function untukKodeVariabel() {
    return indeks().map((k) => ({ kunci: k.kunci, pertanyaan: [{ variabelAbt: daftar(k.kodeVariabel) }] }));
  }

  globalThis.AletaSaksiKatalogMuat = Object.freeze({
    ada: () => indeks().length > 0,
    indeks,
    siapkan,
    siapkanKunci,
    kenaliDiIndeks,
    kandidat,
    untukKodeVariabel,
    paketKunci,
    sudahDimuat: sudahAda,
    /** Bertambah tiap katalog baru terpasang: pemanggil yang menyimpan hasil kenali() memakainya sebagai bagian kunci ingatannya. */
    versi: () => versi,
    gagal: () => Array.from(gagal),
  });
})();
