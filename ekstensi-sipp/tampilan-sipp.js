"use strict";

/**
 * ============================================================================
 * TAMPILAN ALETA DI HALAMAN SIPP PER PERAN DAN PER PENGGUNA (28 Okt 2026)
 * ============================================================================
 *
 * Bagian ALETA mana yang tampil di halaman SIPP ditentukan di server (portal, src/lib/tampilan-sipp.ts):
 * aturan admin per peran -> per pengguna -> pilihan pengguna sendiri (halaman Akun > Tampilan ALETA di SIPP).
 * Berkas ini hanya MENERAPKAN jawaban GET /aleta/api/aleta-ecourt/ekstensi/tampilan-sipp?untuk=ekstensi:
 * { versi, sembunyi: [{kunci, pilih[], bayang?: {tuan, pilih[]}, gaya?}] }.
 *
 *   - Sembunyi = TIDAK DIGAMBAR (display:none lewat satu lembar gaya). Fitur latar - isi otomatis, pelaksana
 *     terjadwal, antrean - tetap berjalan, sama dengan mode tersembunyi 1.205.52. Tidak ada yang dihapus dari
 *     halaman SIPP dan tidak ada yang ditulis ke SIPP.
 *   - Katalog TIDAK disalin di sini: server mengirim penyaringnya. Penyaring yang tidak sah dilewati.
 *   - Singgahan chrome.storage.local "tampilanSippBerlaku" diterapkan seketika saat halaman dimuat (tanpa
 *     menunggu jaringan), lalu disegarkan dari server (paling cepat tiap 60 detik, dan saat tab kembali tampil).
 *     Gagal bertanya = singgahan tetap; tanpa singgahan = tidak ada yang disembunyikan (perilaku lama).
 *   - Elemen di dalam akar bayangan (widget) diberi lembar gaya di akar bayangannya sendiri.
 *
 * Dimuat document_start di halaman SIPP saja. Tidak pernah melempar.
 */
(function () {
  if (typeof window === "undefined" || window.__aletaTampilanSipp) return;
  window.__aletaTampilanSipp = true;

  const API = "/aleta/api/aleta-ecourt/ekstensi/tampilan-sipp?untuk=ekstensi";
  const KUNCI = "tampilanSippBerlaku";
  const ID_GAYA = "aleta-tampilan-sipp-gaya";
  const ATR_BAYANG = "data-aleta-tampilan-sipp";
  const ATR_HTML = "data-aleta-tampilan-sembunyi";
  const SEGAR_MS = 60 * 1000;

  function halamanSipp() {
    try {
      const jalur = String(location.pathname || "");
      if (/\/SIPP(?:\/|$)/i.test(jalur)) return true;
      return /^\/index\.php(?:\/|$)/.test(jalur) && /^(?:127\.0\.0\.1|localhost)$/.test(String(location.hostname || ""));
    } catch {
      return false;
    }
  }
  if (!halamanSipp()) return;

  /** Sama dengan penyaringAman di src/lib/tampilan-sipp.ts, ditambah uji sintaks peramban. */
  function penyaringSah(sel) {
    if (typeof sel !== "string" || !sel || sel.length > 200 || /[{};<@\\]|url\(/i.test(sel)) return false;
    try {
      document.createDocumentFragment().querySelector(sel);
      return true;
    } catch {
      return false;
    }
  }

  function gayaSah(g) {
    return typeof g === "string" && g.length <= 1000 && !/[<@\\]|url\(|expression\(/i.test(g);
  }

  let sembunyi = [];
  let diambilPada = 0;
  let meminta = null;
  /** Lembar gaya yang dipasang di akar bayangan, supaya dapat dikosongkan tanpa menyisir seluruh halaman. */
  const gayaBayang = new Set();

  function bersih(x) {
    const daftar = x && Array.isArray(x.sembunyi) ? x.sembunyi : [];
    const hasil = [];
    for (const s of daftar.slice(0, 200)) {
      if (!s || typeof s.kunci !== "string") continue;
      const pilih = (Array.isArray(s.pilih) ? s.pilih : []).filter(penyaringSah);
      const b = s.bayang && typeof s.bayang === "object" && penyaringSah(s.bayang.tuan) ? { tuan: s.bayang.tuan, pilih: (Array.isArray(s.bayang.pilih) ? s.bayang.pilih : []).filter(penyaringSah) } : null;
      hasil.push({ kunci: s.kunci, pilih, bayang: b && b.pilih.length ? b : null, gaya: gayaSah(s.gaya) ? s.gaya : "" });
    }
    return hasil;
  }

  function teksGaya() {
    const aturan = [];
    for (const s of sembunyi) {
      if (s.pilih.length) aturan.push(`${s.pilih.join(",\n")}{display:none!important}`);
      if (s.gaya) aturan.push(s.gaya);
    }
    return aturan.join("\n");
  }

  function pasangBayang() {
    const per = new Map();
    for (const s of sembunyi) {
      if (!s.bayang) continue;
      const d = per.get(s.bayang.tuan) || [];
      d.push(...s.bayang.pilih);
      per.set(s.bayang.tuan, d);
    }
    // Akar bayangan yang pernah diberi gaya tetapi sekarang tidak menyembunyikan apa pun: gayanya dikosongkan.
    for (const gaya of gayaBayang) {
      if (!gaya.isConnected) gayaBayang.delete(gaya);
      else gaya.textContent = "";
    }
    for (const [tuan, pilih] of per) {
      for (const inang of Array.from(document.querySelectorAll(tuan))) {
        const akar = inang.shadowRoot;
        if (!akar) continue;
        let g = akar.querySelector(`style[${ATR_BAYANG}]`);
        if (!g) {
          g = document.createElement("style");
          g.setAttribute(ATR_BAYANG, "ya");
          akar.appendChild(g);
        }
        gayaBayang.add(g);
        g.textContent = `${pilih.join(",\n")}{display:none!important}`;
      }
    }
  }

  function terapkan() {
    try {
      const akar = document.documentElement;
      if (!akar) return;
      let g = document.getElementById(ID_GAYA);
      const teks = teksGaya();
      if (!teks && !g) {
        akar.removeAttribute(ATR_HTML);
      } else {
        if (!g) {
          g = document.createElement("style");
          g.id = ID_GAYA;
          (document.head || akar).appendChild(g);
        }
        if (g.textContent !== teks) g.textContent = teks;
        const kunci = sembunyi.map((s) => s.kunci).join(" ");
        if (kunci) akar.setAttribute(ATR_HTML, kunci);
        else akar.removeAttribute(ATR_HTML);
      }
      pasangBayang();
    } catch {
      /* tampilan tetap seperti semula */
    }
  }

  async function bacaSinggahan() {
    try {
      const s = await chrome.storage.local.get(KUNCI);
      const x = s && s[KUNCI];
      if (x && typeof x === "object") {
        sembunyi = bersih(x);
        diambilPada = Number(x.diambilPada) || 0;
      }
    } catch {
      /* tanpa penyimpanan: tunggu server */
    }
  }

  async function segarkan(paksa) {
    if (meminta) return meminta;
    if (!paksa && Date.now() - diambilPada < SEGAR_MS) return null;
    meminta = (async () => {
      try {
        const r = await fetch(API, { credentials: "include", cache: "no-store" });
        if (!r || !r.ok) return;
        const j = await r.json();
        const d = j && j.data ? j.data : j;
        if (!d || !Array.isArray(d.sembunyi)) return;
        diambilPada = Date.now();
        sembunyi = bersih(d);
        try {
          await chrome.storage.local.set({ [KUNCI]: { versi: String(d.versi || ""), sembunyi: d.sembunyi, diambilPada } });
        } catch {
          /* tetap berlaku di halaman ini */
        }
        terapkan();
      } catch {
        /* server tidak terjangkau: singgahan tetap */
      } finally {
        meminta = null;
      }
    })();
    return meminta;
  }

  /** Inang akar bayangan (widget) muncul belakangan: pasang gayanya saat anak langsung body/html bertambah. */
  function amatiInang() {
    try {
      const amat = new MutationObserver((rekaman) => {
        if (!sembunyi.some((s) => s.bayang)) return;
        if (rekaman.some((r) => Array.from(r.addedNodes).some((n) => n.nodeType === 1))) pasangBayang();
      });
      amat.observe(document.documentElement, { childList: true });
      const pasangBody = () => {
        if (document.body) amat.observe(document.body, { childList: true });
      };
      if (document.body) pasangBody();
      else document.addEventListener("DOMContentLoaded", pasangBody, { once: true });
    } catch {
      /* widget tetap tampil */
    }
  }

  void (async () => {
    await bacaSinggahan();
    terapkan();
    amatiInang();
    void segarkan(false);
  })();

  try {
    chrome.storage.onChanged.addListener((ubah, tempat) => {
      if (tempat !== "local" || !(KUNCI in ubah)) return;
      const x = ubah[KUNCI].newValue;
      sembunyi = bersih(x && typeof x === "object" ? x : {});
      diambilPada = x && Number(x.diambilPada) ? Number(x.diambilPada) : diambilPada;
      terapkan();
    });
  } catch {
    /* berlaku saat halaman dimuat ulang */
  }
  // Kembali dari tab portal tempat pilihan diubah: segarkan tanpa memuat ulang halaman SIPP.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void segarkan(false);
  });

  globalThis.AletaTampilanSipp = Object.freeze({
    terapkan,
    segarkan: () => segarkan(true),
    tersembunyi: (kunci) => sembunyi.some((s) => s.kunci === kunci),
  });
})();
