"use strict";

/**
 * ============================================================================
 * MENU KIRI ABT BISA DIGULIR (19 Okt 2026)
 * ============================================================================
 *
 * Keluhan: di beranda ABT ("Blangko Tambahan SIPP") menu kiri (accordion
 * #navbar) tidak bisa digulir; isi "Blangko Derry (Daftar s.d. Produk)" yang
 * berisi puluhan submenu terpotong di bawah layar.
 *
 * SEBAB (terukur di ABT lokal dan server, hanya dibaca):
 *   beranda.php memasang window.onscroll yang, begitu halaman digulir melewati
 *   posisi menu, menambah kelas .stickynav pada #navbar. customStyle.css
 *   mendefinisikan .stickynav { position: fixed; top: 20px } (kalah oleh
 *   #navbar { top: 0 }, jadi menempel di margin-top). Elemen fixed
 *   keluar dari alur halaman dan TIDAK ikut tergulir, sedangkan #navbar tidak
 *   punya max-height - tingginya mengikuti isi. Submenu yang melewati tepi
 *   bawah layar jadi tidak terjangkau: halaman tidak bisa digulir lagi untuk
 *   menggesernya, dan #navbar sendiri tidak pernah meluap (tingginya selalu
 *   sepanjang isi).
 *
 * PERBAIKAN (hanya gaya, tidak ada elemen ABT dihapus/disembunyikan/ditulisi):
 *   1. #navbar diberi max-height sebatas tinggi layar yang tersisa (dikurangi
 *      jarak atas menu dan ruang untuk pita bawah widget) dan overflow-y:auto
 *      dengan bilah gulir tipis yang mengikuti tema (abu transparan).
 *      Konten kanan (.pricing) tidak disentuh.
 *   2. Posisi gulir menu diingat selama sesi tab (sessionStorage) supaya tidak
 *      lompat ke atas tiap pindah halaman. Pemulihan berhenti seketika begitu
 *      petugas menggulir/menyentuh menu sendiri.
 *   3. Menu yang sedang aktif (#navbar a.active) digulir sampai tampak di dalam
 *      menu (tanpa menggeser halaman). Header accordion yang baru dibuka dibawa
 *      ke tampak.
 *
 * Tidak satu pun atribut/kelas/teks bernama "aleta" ditulis ke DOM ABT
 * (keputusan 17 Okt 2026).
 */
(function gulirMenuAbtModul() {
  if (typeof globalThis === "undefined" || globalThis.gulirMenuAbt) return;

  const ID_GAYA = "gulir-menu-gaya";
  const KUNCI_SESI = "gulir-menu-abt-v1";
  /**
   * Bila `top` menu tidak terbaca. .stickynav menulis top 20px (customStyle.css),
   * tetapi aturan #navbar { top: 0 } menang atas kelas itu (spesifisitas id),
   * jadi ABT sungguhan menempel di top 0 + margin-top. Nilai terbaca dari gaya
   * dipakai lebih dulu; ini hanya cadangan.
   */
  const TOP_STICKY_PX = 20;
  /** Selisih aman: menu membesar 2% saat disorot tetikus (transform ABT). */
  const BANTALAN_PX = 12;
  const MARGIN_ATAS_BAWAAN_PX = 60;
  /** Ruang kosong di bawah supaya pita bawah widget (RAM/CPU, kiri bawah) tidak tertutup. */
  const RUANG_BAWAH_PX = 64;
  const TINGGI_MINIMUM_PX = 160;
  const BATAS_PEMULIHAN_MS = 2000;
  const JEDA_SIMPAN_MS = 120;

  // --------------------------------------------------------------------------
  // Pembantu murni
  // --------------------------------------------------------------------------
  function halamanAbt(lokasi) {
    const p = String((lokasi || (typeof location !== "undefined" ? location : {})).pathname || "");
    return /\/aps_badilag\//i.test(p);
  }

  function cariMenu(dok) {
    const d = dok || document;
    const menu = d.getElementById("navbar");
    if (!menu || !menu.querySelector(".accordion")) return null;
    return menu;
  }

  /**
   * `atasPx` = jarak atas menu saat menempel; `ekstraPx` = padding+garis tepi
   * vertikal menu BILA kotaknya content-box (max-height tidak mencakupnya).
   * Ukuran kotak tidak diubah: lebar menu ABT tetap persis seperti semula.
   */
  function gayaGulir(atasPx, ekstraPx) {
    const atas = (Number.isFinite(atasPx) ? atasPx : TOP_STICKY_PX + MARGIN_ATAS_BAWAAN_PX) + (Number.isFinite(ekstraPx) ? ekstraPx : 0) + BANTALAN_PX;
    return `
#navbar {
  max-height: max(${TINGGI_MINIMUM_PX}px, calc(100vh - ${atas}px - ${RUANG_BAWAH_PX}px));
  overflow-y: auto;
  overflow-x: hidden;
  scrollbar-width: thin;
  scrollbar-color: rgba(120, 130, 125, 0.6) transparent;
}
#navbar::-webkit-scrollbar { width: 6px; }
#navbar::-webkit-scrollbar-track { background: transparent; }
#navbar::-webkit-scrollbar-thumb { background: rgba(120, 130, 125, 0.55); border-radius: 3px; }
#navbar::-webkit-scrollbar-thumb:hover { background: rgba(120, 130, 125, 0.85); }
`;
  }

  function bacaTersimpan() {
    try {
      const mentah = globalThis.sessionStorage && globalThis.sessionStorage.getItem(KUNCI_SESI);
      if (!mentah) return null;
      const x = JSON.parse(mentah);
      const atas = Number(x && x.atas);
      return Number.isFinite(atas) && atas >= 0 ? atas : null;
    } catch {
      return null;
    }
  }

  function simpan(atas) {
    try {
      if (globalThis.sessionStorage) globalThis.sessionStorage.setItem(KUNCI_SESI, JSON.stringify({ atas: Math.max(0, Math.round(atas)) }));
    } catch {
      /* sessionStorage bisa tidak ada/penuh: gulir tetap jalan tanpa ingatan */
    }
  }

  /** Geser gulir MENU saja (bukan halaman) supaya `el` tampak penuh di dalamnya. */
  function tampakkan(menu, el, tengah) {
    if (!menu || !el) return;
    const m = menu.getBoundingClientRect();
    const e = el.getBoundingClientRect();
    const tepi = 6;
    const diAtas = e.top < m.top + tepi;
    const diBawah = e.bottom > m.bottom - tepi;
    if (!diAtas && !diBawah) return;
    if (tengah) menu.scrollTop += e.top + e.height / 2 - (m.top + m.height / 2);
    else if (diAtas) menu.scrollTop += e.top - m.top - tepi;
    else menu.scrollTop += e.bottom - m.bottom + tepi;
  }

  // --------------------------------------------------------------------------
  // Pemasangan
  // --------------------------------------------------------------------------
  function pasang(dok) {
    const d = dok || document;
    const menu = cariMenu(d);
    if (!menu) return false;
    if (d.getElementById(ID_GAYA)) return true;

    const jendela = d.defaultView || globalThis;
    let marginAtas = MARGIN_ATAS_BAWAAN_PX;
    let atasTempel = TOP_STICKY_PX;
    let ekstra = 0;
    try {
      const cs = jendela.getComputedStyle(menu);
      const m = parseFloat(cs.marginTop);
      if (Number.isFinite(m) && m >= 0) marginAtas = m;
      const t = parseFloat(cs.top);
      atasTempel = Number.isFinite(t) && t >= 0 ? t : TOP_STICKY_PX;
      if (cs.boxSizing !== "border-box") {
        const n = (v) => (Number.isFinite(parseFloat(v)) ? parseFloat(v) : 0);
        ekstra = n(cs.paddingTop) + n(cs.paddingBottom) + n(cs.borderTopWidth) + n(cs.borderBottomWidth);
      }
    } catch {
      /* pakai bawaan */
    }

    const gaya = d.createElement("style");
    gaya.id = ID_GAYA;
    gaya.textContent = gayaGulir(atasTempel + marginAtas, ekstra);
    (d.head || d.documentElement).appendChild(gaya);
    d.documentElement.setAttribute("data-gulir-menu", "1");

    // --- ingatan posisi gulir --------------------------------------------
    let memulihkan = true;
    let penghitung = null;
    const hentikanPemulihan = () => {
      memulihkan = false;
    };
    ["wheel", "touchstart", "mousedown", "keydown"].forEach((nama) => menu.addEventListener(nama, hentikanPemulihan, { passive: true }));
    menu.addEventListener("scroll", () => {
      if (memulihkan) return;
      if (penghitung) clearTimeout(penghitung);
      penghitung = setTimeout(() => simpan(menu.scrollTop), JEDA_SIMPAN_MS);
    });
    jendela.addEventListener("pagehide", () => {
      if (!memulihkan) simpan(menu.scrollTop);
    });

    const tersimpan = bacaTersimpan();
    const aktif = menu.querySelector("a.active");
    const terapkan = () => {
      if (!memulihkan) return;
      if (tersimpan !== null) menu.scrollTop = tersimpan;
      if (aktif) tampakkan(menu, aktif, tersimpan === null);
    };
    terapkan();

    // Tinggi menu masih berubah beberapa saat (transisi max-height panel 0,2 dtk,
    // submenu yang ditambah skrip lain): ulangi sampai batas waktu atau sampai
    // petugas menyentuh menu sendiri.
    const selesai = () => {
      memulihkan = false;
      if (pengamat) pengamat.disconnect();
    };
    let pengamat = null;
    if (typeof jendela.ResizeObserver === "function") {
      pengamat = new jendela.ResizeObserver(terapkan);
      Array.from(menu.children).forEach((anak) => pengamat.observe(anak));
      pengamat.observe(menu);
    }
    menu.addEventListener("transitionend", terapkan);
    setTimeout(selesai, BATAS_PEMULIHAN_MS);

    // --- header accordion yang baru dibuka dibawa ke tampak --------------
    menu.addEventListener("click", (peristiwa) => {
      const t = peristiwa.target && peristiwa.target.closest ? peristiwa.target.closest(".accordion") : null;
      if (!t || !menu.contains(t)) return;
      setTimeout(() => tampakkan(menu, t, false), 260);
    });
    return true;
  }

  globalThis.gulirMenuAbt = { halamanAbt, cariMenu, gayaGulir, pasang, tampakkan, KUNCI_SESI, ID_GAYA };

  if (typeof document === "undefined" || !halamanAbt()) return;
  if (!pasang(document)) {
    // Skrip konten dimuat document_idle; bila menu belum ada, coba sekali lagi saat halaman selesai.
    document.addEventListener("DOMContentLoaded", () => pasang(document), { once: true });
    globalThis.addEventListener("load", () => pasang(document), { once: true });
  }
})();
