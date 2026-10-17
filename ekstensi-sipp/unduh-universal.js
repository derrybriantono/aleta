"use strict";

/**
 * ============================================================================
 * UNDUHAN UNIVERSAL: SIPP, ALETA, DAN BLANGKO DERRY DI ABT (17 Okt 2026)
 * ============================================================================
 *
 * Keluhan: "unduhan tidak teridentifikasi / tidak aman diblokir" - SIPP satker
 * (http://192.168.10.10) dan portal (/aleta) bukan konteks aman, sehingga
 * Chrome menahan unduhan yang LAHIR DARI HALAMAN (tautan <a download>, blob:,
 * window.open ke rute berkas, kiriman borang). Unduhan yang diterbitkan
 * ekstensi lewat chrome.downloads (alatUnduh -> latar.js -> terbitkanUnduhan)
 * tidak pernah ditahan; jalur itu sudah dipakai putusan, BAS, dan relaas.
 * Berkas ini MENGGUNAKAN ULANG jalur yang sama - tidak ada jalur kedua - untuk
 * unduhan MANA PUN di halaman-halaman itu.
 *
 * ----------------------------------------------------------------------------
 * DUA LAPIS
 * ----------------------------------------------------------------------------
 *   1. SEBELUM terblokir (di sini). Tautan yang pasti unduhan dicegat:
 *        - <a download> (blob:, data:, atau http sama-asal), baik diklik
 *          petugas maupun dipicu skrip halaman (a.click() - lihat unduh-halaman.js
 *          di dunia halaman, yang meneruskannya ke sini lewat peristiwa);
 *        - tautan biasa ke berkas yang tak pernah dibuka di tab (.rtf .doc .docx
 *          .xls .xlsx .zip .rar .7z .csv .odt .ods .crx). PDF/gambar/HTML TIDAK
 *          dicegat: peramban menampilkannya, bukan mengunduhnya.
 *      Isinya diambil fetch berkredensial (sesi/cookie ikut), dijadikan blob,
 *      lalu alatUnduh: data: -> pekerja latar -> chrome.downloads. Gagal di mana
 *      pun -> tautan ASLI dijalankan (tidak ada unduhan yang hilang).
 *   2. SESUDAH terblokir (cadangan). Unduhan yang tak dapat diketahui di muka
 *      (window.open ke rute berkas bertajuk Content-Disposition, location.href,
 *      kiriman borang POST, tautan SIPP tanpa atribut download) kadang ditahan
 *      Chrome (FILE_BLOCKED). latar.js mendengarkan chrome.downloads.onChanged
 *      lalu MEMINTA tab asalnya mengulang lewat jalur aman - pesan
 *      "unduh-ulang" ke sini. Borang POST terakhir dicatat (di memori halaman,
 *      bukan di DOM) supaya dapat diulang sebagai POST.
 *
 * ----------------------------------------------------------------------------
 * ABT: HANYA BLANGKO DERRY
 * ----------------------------------------------------------------------------
 * Di halaman ABT, pengalihan berlaku HANYA bila tampilan Blangko Derry sedang
 * aktif (kelas aleta-bd-aktif di <html>, atau elemen di dalam akarnya) atau
 * baru saja aktif (<= 2 menit, untuk ulangan unduhan yang terblokir). Unduhan
 * bawaan ABT untuk blangko lain TIDAK disentuh sama sekali.
 *
 * ----------------------------------------------------------------------------
 * BATAS
 * ----------------------------------------------------------------------------
 *   - Berkas > 40 MB tidak diterbitkan lewat data: (batas pesan ke pekerja latar)
 *     - dibiarkan asli, dicatat.
 *   - Hanya bingkai utama; unduhan dari <iframe> tidak dicegat di muka, hanya
 *     lewat cadangan bila tab induknya yang terjangkau.
 *   - Penjaga tanda (penjaga-tanda.js) tetap berlaku pada fetch POST ulangan.
 *   - Tidak satu pun atribut/teks bernama "aleta" ditulis ke DOM halaman SIPP
 *     maupun ABT; penanda hanya di memori skrip ini.
 */
(function unduhUniversalModul() {
  if (typeof globalThis === "undefined" || globalThis.aletaUnduhUniversal) return;

  const BATAS_BAJT = 40 * 1024 * 1024;
  const UMUR_DERRY_MS = 2 * 60 * 1000;
  const UMUR_FORM_MS = 3 * 60 * 1000;
  const NAMA_PERISTIWA = "unduh-tautan-ekstensi";
  /** Akhiran yang selalu diunduh peramban, tidak pernah ditampilkan di tab. */
  const POLA_BERKAS_PASTI = /\.(?:rtf|docx?|xlsx?|zip|rar|7z|csv|odt|ods|crx)$/i;

  let derryTerakhir = 0;
  /** Benar selama tautan asli (cadangan) dijalankan - tidak dicegat lagi. */
  let menjalankanAsli = false;
  /** Kiriman borang POST terakhir (memori halaman saja). */
  const formTerakhir = [];

  // --------------------------------------------------------------------------
  // Pembantu
  // --------------------------------------------------------------------------
  function jenisHalaman() {
    const p = String((location && location.pathname) || "");
    if (/\/aps_badilag\//i.test(p)) return "abt";
    if (/^\/aleta(?:\/|$)/i.test(p)) return "portal";
    return "sipp";
  }

  function tanpaHash(u) {
    return String(u || "").replace(/#.*$/, "");
  }

  function catat(jenis, ringkas, rinci) {
    try {
      if (typeof alatCatat === "function") alatCatat(jenis, ringkas, rinci);
    } catch {
      /* catatan saja */
    }
  }

  function tautanAsli(a) {
    try {
      return typeof alatTautanAsli === "function" && !!a && alatTautanAsli(a);
    } catch {
      return false;
    }
  }

  function tandaiAsli(a) {
    try {
      if (typeof alatTandaiTautanAsli === "function") alatTandaiTautanAsli(a);
    } catch {
      /* tanpa penanda, tautan cadangan hanya bisa dialihkan sekali lagi */
    }
  }

  /**
   * Tampilan Blangko Derry di ABT: aktif sekarang, atau (untuk ulangan)
   * baru saja. Di luar ABT selalu benar.
   */
  function wilayahBoleh(el, longgar) {
    if (jenisHalaman() !== "abt") return true;
    try {
      const html = document.documentElement;
      if (html && html.classList.contains("aleta-bd-aktif")) {
        derryTerakhir = Date.now();
        return true;
      }
      if (el && el.closest && el.closest("#aleta-bd-akar, #aleta-bd-tawar")) {
        derryTerakhir = Date.now();
        return true;
      }
    } catch {
      /* tanpa DOM: tidak dialihkan */
    }
    return !!longgar && Date.now() - derryTerakhir < UMUR_DERRY_MS;
  }

  /** Alamat tautan yang boleh diambil dari halaman ini, atau "". */
  function alamatBoleh(href) {
    const h = String(href || "");
    if (!h) return "";
    if (/^data:/i.test(h)) return h;
    if (/^blob:/i.test(h)) return h.startsWith(`blob:${location.origin}`) ? h : "";
    let u;
    try {
      u = new URL(h, location.href);
    } catch {
      return "";
    }
    if (u.protocol !== "http:" && u.protocol !== "https:") return "";
    if (u.origin !== location.origin) return "";
    return u.href;
  }

  /** Nama dari Content-Disposition (filename* RFC 5987 dahulu). */
  function namaDariDisposisi(nilai) {
    const s = String(nilai || "");
    const bintang = s.match(/filename\*\s*=\s*(?:[A-Za-z0-9_-]+)'[^']*'([^;]+)/i);
    if (bintang) {
      try {
        return decodeURIComponent(bintang[1].trim().replace(/^"|"$/g, ""));
      } catch {
        return bintang[1].trim();
      }
    }
    const biasa = s.match(/filename\s*=\s*(?:"([^"]*)"|([^;]+))/i);
    return biasa ? String(biasa[1] !== undefined ? biasa[1] : biasa[2]).trim() : "";
  }

  function namaDariAlamat(alamat) {
    // Alamat blob:/data: hanya berisi pengenal acak - bukan nama berkas.
    if (/^(?:blob|data):/i.test(String(alamat || ""))) return "";
    try {
      const jalur = new URL(alamat, location.href).pathname;
      const potong = jalur.split("/").filter(Boolean).pop() || "";
      return decodeURIComponent(potong);
    } catch {
      return "";
    }
  }

  function akhiranTipe(tipe) {
    const t = String(tipe || "").split(";")[0].trim().toLowerCase();
    const peta = {
      "application/rtf": "rtf",
      "text/rtf": "rtf",
      "application/pdf": "pdf",
      "application/zip": "zip",
      "application/msword": "doc",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
      "application/vnd.ms-excel": "xls",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
      "text/csv": "csv",
      "application/json": "json",
      "text/plain": "txt",
    };
    return peta[t] || "";
  }

  /**
   * Memilih nama yang LAYAK (alatNamaUnduhanLayak menolak "download.rtf" dan
   * sejenisnya). Urutan: Content-Disposition, atribut download, petunjuk
   * (nama berkas yang diketahui Chrome), segmen alamat. Tanpa satu pun yang
   * layak -> "Unduhan <waktu>.<akhiran jenis isi>" bila jenisnya dikenal.
   */
  function pilihNama(kandidat, tipe) {
    for (const k of kandidat) {
      if (!k) continue;
      const n = typeof alatNamaUnduhanLayak === "function" ? alatNamaUnduhanLayak(k, tipe) : "";
      if (n) return n;
    }
    const akhiran = akhiranTipe(tipe);
    if (!akhiran) return "";
    const d = new Date();
    const p2 = (n) => String(n).padStart(2, "0");
    const stempel = `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())} ${p2(d.getHours())}${p2(d.getMinutes())}${p2(d.getSeconds())}`;
    return `Unduhan ${stempel}.${akhiran}`;
  }

  // --------------------------------------------------------------------------
  // Mengambil lalu menerbitkan lewat jalur aman
  // --------------------------------------------------------------------------
  /**
   * @param {object} o { alamat, metode?, badan?, namaAtribut?, petunjuk?, mime?, tolakHtml?, tanpaCadangan? }
   * @returns {Promise<{ok:boolean, lewat?:string, pesan?:string}>}
   */
  async function ambilDanUnduh(o) {
    if (typeof alatUnduh !== "function") return { ok: false, pesan: "panel belum siap" };
    let respons;
    try {
      respons = await fetch(o.alamat, {
        method: o.metode || "GET",
        body: o.badan || undefined,
        credentials: "include",
      });
    } catch (g) {
      return { ok: false, pesan: `fetch gagal: ${String((g && g.message) || g).slice(0, 120)}` };
    }
    if (!respons.ok) return { ok: false, pesan: `HTTP ${respons.status}` };
    const tipe = String((respons.headers && respons.headers.get("content-type")) || "");
    // Alamat yang di-GET ulang padahal dulu POST (atau sebaliknya) menjawab
    // halaman web: itu BUKAN berkasnya, jangan disimpan sebagai berkas.
    if (o.tolakHtml && /text\/html/i.test(tipe) && !/html/i.test(String(o.mime || ""))) {
      return { ok: false, pesan: "jawaban berupa halaman web, bukan berkas" };
    }
    const blob = await respons.blob();
    if (!blob || blob.size === 0) return { ok: false, pesan: "berkas kosong / diambil pengelola unduhan lain" };
    if (blob.size > BATAS_BAJT) return { ok: false, pesan: `berkas ${blob.size} bita melebihi batas ${BATAS_BAJT}` };
    const tipeBlob = blob.type || tipe.split(";")[0];
    const nama = pilihNama(
      [
        namaDariDisposisi(respons.headers && respons.headers.get("content-disposition")),
        o.namaAtribut,
        o.petunjuk,
        namaDariAlamat(o.alamat),
      ],
      tipeBlob
    );
    if (!nama) return { ok: false, pesan: "nama berkas tidak dapat ditentukan" };
    const hasil = await alatUnduh(blob, nama, { tanpaCadangan: o.tanpaCadangan === true });
    return hasil && hasil.ok ? { ok: true, lewat: hasil.lewat, nama } : { ok: false, pesan: (hasil && hasil.pesan) || "unduhan ditolak" };
  }

  /** Menjalankan tautan aslinya sebagai gantinya - tidak ada unduhan yang hilang. */
  function jalankanAsli(href, nama, elemen) {
    try {
      const a = elemen || document.createElement("a");
      if (!elemen) {
        a.href = href;
        if (nama) a.setAttribute("download", nama);
        a.style.display = "none";
        document.body.appendChild(a);
      }
      tandaiAsli(a);
      menjalankanAsli = true;
      try {
        a.click();
      } finally {
        menjalankanAsli = false;
      }
      // Tautan milik halaman dilepas lagi: klik petugas berikutnya tetap
      // dicegat. Tautan buatan sendiri dibuang.
      try {
        if (elemen && typeof alatLepasTautanAsli === "function") alatLepasTautanAsli(elemen);
      } catch {
        /* penanda bersih sendiri bersama elemennya */
      }
      if (!elemen) a.remove();
    } catch {
      /* tidak ada yang bisa dilakukan lagi */
    }
  }

  async function tanganiTautan(href, namaAtribut, elemen) {
    let hasil;
    try {
      hasil = await ambilDanUnduh({ alamat: href, namaAtribut });
    } catch (g) {
      hasil = { ok: false, pesan: String((g && g.message) || g).slice(0, 120) };
    }
    if (!hasil.ok) {
      catat("unduh-universal-gagal", `tautan dibiarkan asli: ${hasil.pesan}`, href.slice(0, 120));
      jalankanAsli(href, namaAtribut, elemen);
    }
    return hasil;
  }

  /** Layakkah tautan ini dialihkan di muka? */
  function layakDialihkan(href, punyaAtributDownload, elemen) {
    const alamat = alamatBoleh(href);
    if (!alamat) return "";
    if (!wilayahBoleh(elemen, false)) return "";
    if (punyaAtributDownload) return alamat;
    if (/^(?:blob|data):/i.test(alamat)) return "";
    try {
      return POLA_BERKAS_PASTI.test(new URL(alamat).pathname) ? alamat : "";
    } catch {
      return "";
    }
  }

  // --------------------------------------------------------------------------
  // Lapis 1: sebelum terblokir
  // --------------------------------------------------------------------------
  function dengarKlik(e) {
    try {
      if (jenisHalaman() === "abt" && e.target && e.target.closest && e.target.closest("#aleta-bd-akar")) derryTerakhir = Date.now();
      if (e.defaultPrevented || (e.button !== undefined && e.button !== 0)) return;
      if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
      const a = e.target && e.target.closest ? e.target.closest("a[href]") : null;
      if (!a || tautanAsli(a)) return;
      const alamat = layakDialihkan(a.getAttribute("href") ? a.href : "", a.hasAttribute("download"), a);
      if (!alamat) return;
      e.preventDefault();
      void tanganiTautan(alamat, a.getAttribute("download") || "", a);
    } catch {
      /* gagal memeriksa: biarkan tautan berjalan seperti biasa */
    }
  }

  /** a.click() yang dipicu skrip halaman (dunia halaman) - lihat unduh-halaman.js. */
  function dengarPeristiwaHalaman(e) {
    try {
      if (menjalankanAsli) return;
      const d = JSON.parse(String(e.detail || "{}"));
      const alamat = layakDialihkan(d.href, true, null);
      if (!alamat) return;
      e.preventDefault();
      void tanganiTautan(alamat, String(d.nama || ""), null);
    } catch {
      /* biarkan tautan berjalan */
    }
  }

  function catatKirimanBorang(e) {
    try {
      const f = e.target;
      if (!f || String(f.tagName).toUpperCase() !== "FORM") return;
      if (String(f.method || "get").toUpperCase() !== "POST") return;
      const aksi = tanpaHash(f.action || location.href);
      let data;
      try {
        data = new FormData(f, e.submitter || undefined);
      } catch {
        data = new FormData(f);
      }
      let punyaBerkas = false;
      for (const [, nilai] of data.entries()) {
        if (typeof nilai !== "string") punyaBerkas = true;
      }
      let badan = data;
      if (!punyaBerkas && !/multipart/i.test(String(f.enctype || ""))) {
        const p = new URLSearchParams();
        for (const [k, v] of data.entries()) p.append(k, String(v));
        badan = p;
      }
      formTerakhir.push({ aksi, badan, saat: Date.now() });
      while (formTerakhir.length > 5) formTerakhir.shift();
    } catch {
      /* catatan borang hanya cadangan */
    }
  }

  // --------------------------------------------------------------------------
  // Lapis 2: ulangan atas unduhan yang terblokir (pesan dari latar.js)
  // --------------------------------------------------------------------------
  async function ulangiUnduhan(p) {
    if (!wilayahBoleh(null, true)) return { ok: false, dilarang: true, pesan: "bukan tampilan Blangko Derry" };
    const alamat = String(p.url || "");
    let sasaran = alamatBoleh(alamat);
    if (!sasaran && p.urlAkhir) sasaran = alamatBoleh(p.urlAkhir);
    if (!sasaran) return { ok: false, pesan: "alamat bukan milik halaman ini" };
    const dasar = {
      alamat: sasaran,
      petunjuk: String(p.nama || ""),
      mime: String(p.mime || ""),
      tanpaCadangan: true,
      tolakHtml: true,
    };
    const kiriman = /^blob:|^data:/i.test(sasaran)
      ? null
      : formTerakhir
          .slice()
          .reverse()
          .find((f) => Date.now() - f.saat < UMUR_FORM_MS && f.aksi === tanpaHash(sasaran));
    const hasil = await ambilDanUnduh(kiriman ? { ...dasar, metode: "POST", badan: kiriman.badan } : dasar);
    if (!hasil.ok) catat("unduh-universal-ulang-gagal", `ulangan unduhan terblokir gagal: ${hasil.pesan}`, sasaran.slice(0, 120));
    return hasil;
  }

  try {
    if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.onMessage) {
      chrome.runtime.onMessage.addListener((p, _pengirim, jawab) => {
        if (!p || p.sumber !== "aleta-latar" || p.jenis !== "unduh-ulang") return undefined;
        ulangiUnduhan(p).then(jawab, (g) => jawab({ ok: false, pesan: String((g && g.message) || g).slice(0, 160) }));
        return true;
      });
    }
  } catch {
    /* tanpa pendengar, hanya lapis 1 yang bekerja */
  }

  document.addEventListener("click", dengarKlik, true);
  document.addEventListener("submit", catatKirimanBorang, true);
  document.addEventListener(NAMA_PERISTIWA, dengarPeristiwaHalaman, true);

  globalThis.aletaUnduhUniversal = {
    ambilDanUnduh,
    ulangiUnduhan,
    layakDialihkan,
    namaDariDisposisi,
    pilihNama,
    formTerakhir,
    NAMA_PERISTIWA,
  };
})();
