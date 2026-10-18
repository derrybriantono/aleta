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
  /** Pasangan [nama, nilai] kepala permintaan (Headers, larik pasangan, objek biasa, atau Request). */
  function daftarKepala(kepala) {
    const hasil = [];
    if (!kepala) return hasil;
    try {
      if (typeof kepala.forEach === "function" && typeof kepala.get === "function") {
        kepala.forEach((v, k) => hasil.push([String(k), String(v)]));
      } else if (Array.isArray(kepala)) {
        for (const p of kepala) if (Array.isArray(p)) hasil.push([String(p[0]), String(p[1])]);
      } else if (typeof kepala === "object") {
        for (const [k, v] of Object.entries(kepala)) hasil.push([String(k), String(v)]);
      }
    } catch {
      /* kepala tak terbaca: tidak ada yang diperiksa */
    }
    return hasil;
  }

  const tolak = (nama) => ({ ok: false, kolom: nama, pesan: pesanIsian(nama) });

  /**
   * Periksa satu permintaan fetch ke SIPP/ABT (bukan jalur /aleta).
   *   - SEMUA cara (juga GET): NAMA & NILAI kepala permintaan dan NAMA isian
   *     query - tidak satu pun berasal dari data SIPP, dan semuanya sampai ke
   *     server (catatan akses). Audit jejak 18 Okt 2026.
   *   - Cara TULIS (POST/PUT/PATCH/DELETE): juga nilai query, jalur, NAMA isian
   *     badan, dan nilai badan (teks data SIPP di halaman dikecualikan).
   * Pulang null bila tidak ada yang perlu diperiksa / GET yang bersih, selain itu
   * { ok:true } atau { ok:false, kolom, pesan }.
   * opsi.asal (location.origin) dan opsi.jalurAleta ("/aleta") untuk uji.
   */
  function periksaPermintaan(masukan, init, opsi) {
    const o = opsi || {};
    const metode = String((init && init.method) || (masukan && typeof masukan === "object" && masukan.method) || "GET").toUpperCase();
    const teksUrl = typeof masukan === "string" ? masukan : masukan && masukan.url ? String(masukan.url) : masukan && typeof masukan.href === "string" ? masukan.href : "";
    let url;
    try {
      url = new URL(teksUrl, o.asal || (typeof location !== "undefined" ? location.href : "http://localhost/"));
    } catch {
      return null;
    }
    const jalurAleta = o.jalurAleta || "/aleta";
    if (url.pathname === jalurAleta || url.pathname.startsWith(`${jalurAleta}/`)) return null;
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;

    const kepala = [...daftarKepala(masukan && typeof masukan === "object" ? masukan.headers : null), ...daftarKepala(init && init.headers)];
    for (const [k, v] of kepala) if (menyebutAleta(k) || menyebutAleta(v)) return tolak(`kepala permintaan ${k}`);
    for (const [k] of url.searchParams) if (menyebutAleta(k)) return tolak(`alamat (${k})`);

    if (!METODE_TULIS.has(metode)) return null;
    if (POLA_BACA.test(url.pathname)) return null;
    let dariSipp = null;
    const masihMenyebut = (teks) => {
      if (!menyebutAleta(teks)) return false;
      if (dariSipp === null) dariSipp = o.dariSipp || dataSippHalaman(o.dokumen);
      return menyebutAleta(tanpaDataSipp(teks, dariSipp));
    };
    let jalur = url.pathname;
    try {
      jalur = decodeURIComponent(url.pathname);
    } catch {
      /* jalur apa adanya */
    }
    if (masihMenyebut(jalur)) return tolak("alamat");
    for (const [k, v] of url.searchParams) if (masihMenyebut(v)) return tolak(sebut(k, url.href));
    const badan = init && init.body !== undefined ? init.body : null;
    for (const [kunci, teks] of isianBadan(badan)) {
      if (menyebutAleta(String(kunci).replace(/^nama berkas /, ""))) return tolak(`nama isian ${kunci}`);
      if (masihMenyebut(teks)) return tolak(sebut(kunci, url.href));
    }
    return { ok: true };
  }

  // -------------------------------------------------------------------------
  // Berkas RTF yang dikirim LANGSUNG ke SIPP/ABT (mis. ABT main/anonim)
  // -------------------------------------------------------------------------

  /** Ujung grup RTF yang dibuka di `mulai` ("{"); pulang indeks sesudah "}". */
  function ujungGrup(s, mulai) {
    let dalam = 0;
    for (let i = mulai; i < s.length; i += 1) {
      const c = s[i];
      if (c === "\\") i += 1;
      else if (c === "{") dalam += 1;
      else if (c === "}") {
        dalam -= 1;
        if (dalam === 0) return i + 1;
      }
    }
    return s.length;
  }

  /**
   * Teks RTF tanpa jejak buatan sistem (audit jejak 18 Okt 2026): grup tersembunyi
   * {\*\isianasal ...}/{\*\aletaasal ...} dibuang beserta isinya, dan properti naskah
   * di {\info ...} serta {\*\generator ...} yang menyebut ALETA dibuang. Isi naskah
   * tidak disentuh (padanan bot: metadataTanpaAletaService).
   */
  function bersihkanRtf(s) {
    if (typeof s !== "string" || !s.startsWith("{\\rtf")) return s;
    let keluar = "";
    let i = 0;
    const pola = /\{\\\*\s*\\(?:isianasal|aletaasal|generator)(?![a-z])|\{\\info(?![a-z])/gi;
    let m;
    while ((m = pola.exec(s))) {
      if (m.index < i) continue;
      const akhir = ujungGrup(s, m.index);
      const grup = s.slice(m.index, akhir);
      let ganti = grup;
      if (/^\{\\info/i.test(grup)) {
        // buang sub-grup properti yang menyebut ALETA
        let dalam = "";
        let j = m[0].length;
        while (j < grup.length - 1) {
          if (grup[j] === "{") {
            const u = ujungGrup(grup, j);
            const sub = grup.slice(j, u);
            if (!menyebutAleta(sub.replace(/\\[a-z]+-?\d* ?/gi, " "))) dalam += sub;
            j = u;
          } else {
            dalam += grup[j];
            j += 1;
          }
        }
        ganti = `${m[0]}${dalam}}`;
      } else if (/generator/i.test(m[0])) {
        ganti = menyebutAleta(grup) ? "" : grup;
      } else {
        ganti = "";
      }
      keluar += s.slice(i, m.index) + ganti;
      i = akhir;
      pola.lastIndex = akhir;
    }
    return i === 0 ? s : keluar + s.slice(i);
  }

  /** Bita sebuah Blob (Blob.arrayBuffer, atau FileReader pada peramban/uji lama). */
  function bacaBita(blob) {
    if (typeof blob.arrayBuffer === "function") return blob.arrayBuffer().then((b) => new Uint8Array(b));
    return new Promise((selesai, gagal) => {
      const r = new FileReader();
      r.onload = () => selesai(new Uint8Array(r.result));
      r.onerror = () => gagal(r.error);
      r.readAsArrayBuffer(blob);
    });
  }

  /** FormData baru bila ada berkas RTF yang dibersihkan; selain itu badan yang sama. */
  async function bersihkanBadanBerkas(badan) {
    if (typeof FormData === "undefined" || !(badan instanceof FormData) || typeof Blob === "undefined") return badan;
    const baru = new FormData();
    let berubah = false;
    for (const [nama, nilai] of badan.entries()) {
      if (!(nilai instanceof Blob)) {
        baru.append(nama, nilai);
        continue;
      }
      const namaBerkas = typeof nilai.name === "string" ? nilai.name : "blob";
      let isi = "";
      try {
        const bita = await bacaBita(nilai);
        if (bita.length >= 5 && String.fromCharCode(...bita.subarray(0, 5)) === "{\\rtf") {
          for (let k = 0; k < bita.length; k += 8192) isi += String.fromCharCode(...bita.subarray(k, k + 8192));
        }
      } catch {
        isi = "";
      }
      const bersih = isi ? bersihkanRtf(isi) : isi;
      if (!isi || bersih === isi) {
        baru.append(nama, nilai, namaBerkas);
        continue;
      }
      const keluar = new Uint8Array(bersih.length);
      for (let k = 0; k < bersih.length; k += 1) keluar[k] = bersih.charCodeAt(k) & 255;
      baru.append(nama, new Blob([keluar], { type: nilai.type || "application/rtf" }), namaBerkas);
      berubah = true;
    }
    return berubah ? baru : badan;
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
      // Tulisan ke SIPP/ABT yang membawa berkas: RTF dibersihkan dulu (jejak sistem saja).
      if (periksa && periksa.ok === true && init && typeof FormData !== "undefined" && init.body instanceof FormData) {
        const diri = this;
        return bersihkanBadanBerkas(init.body).then(
          (badan) => asli.call(diri, masukan, badan === init.body ? init : { ...init, body: badan }),
          () => asli.call(diri, masukan, init)
        );
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
    bersihkanRtf,
    bersihkanBadanBerkas,
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
