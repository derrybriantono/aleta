/**
 * ============================================================================
 * PENJAGA BATAS: TIDAK ADA KATA "ALETA" YANG DITULIS EKSTENSI KE SIPP / ABT
 * ============================================================================
 *
 * Keputusan pengguna 17 Okt 2026: "Jangan ada satupun kalimat atau kata Aleta
 * di server SIPP atau database SIPP." Penjaga di bot (aleta_bot/services/
 * penjagaTandaSipp.js) menutup semua tulisan lewat bot. Berkas ini menutup
 * tulisan yang dikirim EKSTENSI sendiri langsung ke SIPP/ABT (Court Calendar,
 * variabel ABT, unggah anonimisasi, dst.) dan isian borang SIPP yang diisikan
 * ekstensi.
 *
 * Satu pintu, bukan di tiap pemanggil:
 *
 *   1. fetch pada dunia skrip konten DIBUNGKUS. Permintaan POST/PUT/PATCH/DELETE
 *      ke alamat yang BUKAN milik ALETA (jalur /aleta/...) diperiksa badannya:
 *      bila ada isian yang memuat kata itu, permintaan DITOLAK sebelum terkirim
 *      dengan kalimat awam yang menunjuk isiannya. Permintaan baca (cari, list,
 *      get, ...) tidak diperiksa - mencari nama pihak "Aleta" itu sah.
 *   2. AletaPenjagaTanda.periksaTeks(teks, namaIsian) untuk pengisi borang
 *      SIPP (isiBorang, setel) - teks ditahan sebelum menyentuh kolomnya.
 *
 * Pengecualian - teks yang memang berasal dari data SIPP itu sendiri (nama
 * pihak yang kebetulan "Aleta" yang tampil di halaman SIPP/ABT yang dibuka):
 * halaman dibaca (simpul teks dan atribut value DI LUAR elemen buatan ALETA),
 * dan kemunculan yang SELURUHNYA tertutup teks halaman itu tidak dihitung.
 *
 * Aturan pengenal katanya SAMA dengan aleta_bot/services/tandaAletaService.js
 * dan manajemen_surat/src/lib/tanda-aleta.ts (diuji bersama).
 */
(function (akar) {
  "use strict";

  const TAK_TAMPAK = /[­͏؜ᅟᅠ឴឵᠎​-‏‪-‮⁠-⁤⁪-⁯﻿]/g;
  const PEMISAH = "[\\s._\\-*·•/\\\\|,:;'\"`~+]*";
  const RENGGANG = new RegExp(`(?<![a-z0-9])a${PEMISAH}l${PEMISAH}e${PEMISAH}t${PEMISAH}a(?![a-z0-9])`, "i");

  /** Bentuk baku: NFKC, tanpa aksen, tanpa aksara tak tampak, huruf kecil. */
  function bakukan(teks) {
    return String(teks === null || teks === undefined ? "" : teks)
      .normalize("NFKC")
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(TAK_TAMPAK, "")
      .toLowerCase();
  }

  function menyebutAleta(teks) {
    const t = bakukan(teks);
    if (!t) return false;
    return t.includes("aleta") || RENGGANG.test(t);
  }

  const rapat = (teks) => bakukan(teks).replace(/\s+/g, " ").trim();

  /** Buang kemunculan teks SIPP yang sendirinya memuat kata itu (>= 5 huruf) dari `teks`. */
  function tanpaDataSipp(teks, dariSipp) {
    let sisa = rapat(teks);
    const daftar = (dariSipp || [])
      .map(rapat)
      .filter((x) => x.length >= 5 && menyebutAleta(x))
      .sort((a, b) => b.length - a.length);
    for (const x of new Set(daftar)) sisa = sisa.split(x).join(" ");
    return sisa;
  }

  function pesanIsian(nama) {
    const k = String(nama || "").trim() || "ini";
    return `Isian "${k}" memuat kata 'ALETA'; hapus dulu sebelum disimpan ke SIPP.`;
  }

  // -------------------------------------------------------------------------
  // Data SIPP pada halaman yang dibuka
  // -------------------------------------------------------------------------

  /** Elemen buatan ALETA (kelas/id/atribut berawalan aleta) tidak dihitung sebagai data SIPP. */
  function dalamAleta(el) {
    for (let e = el; e; e = e.parentElement) {
      const kelas = e.className && typeof e.className === "object" && "baseVal" in e.className ? e.className.baseVal : e.className;
      if (/aleta/i.test(String(kelas || "")) || /aleta/i.test(String(e.id || ""))) return true;
      if (e.attributes) {
        for (const a of Array.from(e.attributes)) if (/^data-aleta/i.test(a.name)) return true;
      }
    }
    return false;
  }

  /** Teks halaman (di luar elemen ALETA) yang memuat kata itu - data SIPP/ABT yang sudah ada. */
  function dataSippHalaman(dok) {
    const d = dok || (typeof document !== "undefined" ? document : null);
    const hasil = new Set();
    if (!d || !d.body) return [];
    try {
      const jalan = d.createTreeWalker(d.body, 4);
      while (jalan.nextNode()) {
        const n = jalan.currentNode;
        const t = n.nodeValue;
        if (!t || !menyebutAleta(t)) continue;
        if (dalamAleta(n.parentElement)) continue;
        hasil.add(t.trim());
      }
      for (const el of Array.from(d.querySelectorAll("input[value], textarea, option"))) {
        if (dalamAleta(el)) continue;
        const asli = el.tagName === "TEXTAREA" ? el.defaultValue : el.getAttribute("value") || el.defaultValue || "";
        if (asli && menyebutAleta(asli)) hasil.add(String(asli).trim());
        if (el.tagName === "OPTION" && el.textContent && menyebutAleta(el.textContent)) hasil.add(el.textContent.trim());
      }
    } catch {
      /* halaman tak terbaca: tanpa pengecualian, penjaga lebih ketat */
    }
    return Array.from(hasil);
  }

  // -------------------------------------------------------------------------
  // Periksa teks dan badan permintaan
  // -------------------------------------------------------------------------

  /**
   * Periksa SATU teks. opsi.dariSipp: daftar teks SIPP (bawaan: halaman terbuka).
   * Pulang { ok:true } atau { ok:false, kolom, pesan }.
   */
  function periksaTeks(teks, namaIsian, opsi) {
    const o = opsi || {};
    if (!menyebutAleta(teks)) return { ok: true };
    const dariSipp = o.dariSipp || dataSippHalaman(o.dokumen);
    if (!menyebutAleta(tanpaDataSipp(teks, dariSipp))) return { ok: true };
    return { ok: false, kolom: String(namaIsian || ""), pesan: pesanIsian(namaIsian) };
  }

  const SEBUTAN = {
    agenda_sidang: "Agenda sidang",
    agenda: "Agenda sidang",
    keterangan: "Keterangan",
    alasan: "Alasan",
    uraian: "Uraian",
    catatan: "Catatan",
    posita: "Posita",
  };

  function sebut(kunci, url) {
    const k = String(kunci || "");
    if (k === "value") {
      const m = /[?&]no_var=([^&#]+)/.exec(url || "");
      return m ? `Variabel #${decodeURIComponent(m[1])}#` : "Isi variabel ABT";
    }
    return SEBUTAN[k.toLowerCase()] || k || "isian";
  }

  /** Pasangan [kunci, teks] dari badan fetch; berkas diwakili namanya. */
  function* isianBadan(badan) {
    if (badan === null || badan === undefined) return;
    if (typeof badan === "string") {
      const t = badan.trim();
      if (t.startsWith("{") || t.startsWith("[")) {
        try {
          yield* jelajah(JSON.parse(t), "");
          return;
        } catch {
          /* bukan JSON: lanjut */
        }
      }
      if (/^[^=&\s]+=/.test(t)) {
        for (const [k, v] of new URLSearchParams(t)) yield [k, v];
        return;
      }
      yield ["isi kiriman", t];
      return;
    }
    if (typeof URLSearchParams !== "undefined" && badan instanceof URLSearchParams) {
      for (const [k, v] of badan) yield [k, v];
      return;
    }
    if (typeof FormData !== "undefined" && badan instanceof FormData) {
      for (const [k, v] of badan) {
        if (typeof v === "string") yield [k, v];
        else if (v && typeof v.name === "string") yield [`nama berkas ${k}`, v.name];
      }
    }
  }

  function* jelajah(nilai, jalur, dalam) {
    const tingkat = dalam || 0;
    if (nilai === null || nilai === undefined || tingkat > 6) return;
    if (typeof nilai === "string") {
      yield [jalur, nilai];
      return;
    }
    if (Array.isArray(nilai)) {
      for (const x of nilai) yield* jelajah(x, jalur, tingkat + 1);
      return;
    }
    if (typeof nilai === "object") {
      for (const [k, v] of Object.entries(nilai)) yield* jelajah(v, k, tingkat + 1);
    }
  }

  const METODE_TULIS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
  /** Alamat yang MEMBACA lewat POST (cari/daftar/ambil) - tidak menulis ke SIPP, tidak diperiksa. */
  const POLA_BACA = /\/(cari|list|search|get[_a-z0-9]*|ajax[_a-z0-9]*|datatables?|load[_a-z0-9]*|tampil[_a-z0-9]*|baca[_a-z0-9]*|view[_a-z0-9]*|detail[_a-z0-9]*|cek[_a-z0-9]*)(\/|$|\?)/i;

  /**
   * Periksa satu permintaan fetch. Pulang null bila bukan tulisan ke SIPP/ABT,
   * selain itu { ok:true } atau { ok:false, kolom, pesan }.
   * opsi.asal (location.origin) dan opsi.jalurAleta ("/aleta") untuk uji.
   */
  function periksaPermintaan(masukan, init, opsi) {
    const o = opsi || {};
    const metode = String((init && init.method) || (masukan && typeof masukan === "object" && masukan.method) || "GET").toUpperCase();
    if (!METODE_TULIS.has(metode)) return null;
    const teksUrl = typeof masukan === "string" ? masukan : masukan && masukan.url ? String(masukan.url) : "";
    let url;
    try {
      url = new URL(teksUrl, o.asal || (typeof location !== "undefined" ? location.href : "http://localhost/"));
    } catch {
      return null;
    }
    const jalurAleta = o.jalurAleta || "/aleta";
    if (url.pathname === jalurAleta || url.pathname.startsWith(`${jalurAleta}/`)) return null;
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (POLA_BACA.test(url.pathname)) return null;
    const badan = init && init.body !== undefined ? init.body : null;
    let dariSipp = null;
    for (const [kunci, teks] of isianBadan(badan)) {
      if (!menyebutAleta(teks)) continue;
      if (dariSipp === null) dariSipp = o.dariSipp || dataSippHalaman(o.dokumen);
      if (menyebutAleta(tanpaDataSipp(teks, dariSipp))) {
        const nama = sebut(kunci, url.href);
        return { ok: false, kolom: nama, pesan: pesanIsian(nama) };
      }
    }
    return { ok: true };
  }

  /** Bungkus fetch pada `dunia` (window skrip konten). Idempoten. */
  function pasangFetch(dunia) {
    const d = dunia || akar;
    if (!d || typeof d.fetch !== "function" || d.fetch.__aletaPenjaga) return false;
    const asli = d.fetch;
    const bungkus = function (masukan, init) {
      let periksa = null;
      try {
        periksa = periksaPermintaan(masukan, init);
      } catch {
        periksa = null;
      }
      if (periksa && periksa.ok === false) {
        const galat = new Error(periksa.pesan);
        galat.name = "PenjagaTandaSipp";
        galat.kode = "teks_menyebut_aleta";
        galat.kolom = periksa.kolom;
        return Promise.reject(galat);
      }
      return asli.apply(this, arguments);
    };
    bungkus.__aletaPenjaga = true;
    d.fetch = bungkus;
    return true;
  }

  const api = {
    menyebutAleta,
    bakukan,
    tanpaDataSipp,
    dataSippHalaman,
    periksaTeks,
    periksaPermintaan,
    pasangFetch,
    pesanIsian,
  };
  akar.AletaPenjagaTanda = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  try {
    pasangFetch(akar);
  } catch {
    /* penjaga tidak boleh mengganggu halaman */
  }
})(typeof window !== "undefined" ? window : globalThis);
