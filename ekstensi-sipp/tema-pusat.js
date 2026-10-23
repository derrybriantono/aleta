"use strict";

/**
 * ============================================================================
 * SATU PUSAT TEMA: TERANG, GELAP, ATAU IKUTI SISTEM
 * ============================================================================
 *
 * Yang dilaporkan: tombol tema "nge-bug" - kadang tidak berubah, kadang
 * berubah ke kebalikannya; "ikuti sistem" tampil terang padahal sistem gelap
 * (dan sebaliknya); dan yang paling parah, pindah halaman membuat warna
 * berkedip bergantian gelap dan terang.
 *
 * SEBAB NYATA (sebelum berkas ini ada)
 *
 *   1. Pilihan tema disimpan di EMPAT tempat yang tidak saling mengenal:
 *      localStorage portal (light/dark), chrome.storage temaPanel, chrome.storage
 *      temaPopup (ikut/terang/gelap), dan salinan sinkron halaman
 *      aleta-tema-sipp (terang/gelap/mati). Tiap pemuatan halaman
 *      "menyamakan" dua di antaranya dengan menyuruh yang satu mengikuti yang
 *      lain tanpa tahu mana yang lebih baru - jadi yang usang kadang menang.
 *   2. Salinan aleta-tema-sipp ditulis dua penulis dengan arti berbeda:
 *      konten.js (SIPP) menulis "mati" bila lapisan gelap SIPP dimatikan,
 *      panel-alat.js (ABT) hanya menulis "gelap"/"terang". SIPP dan ABT satu
 *      origin, sehingga tiap pindah SIPP <-> ABT halaman lahir dengan
 *      nilai penulis sebelumnya lalu dikoreksi penulis berikutnya: kedip.
 *   3. "Ikuti sistem" tidak pernah ada. "Otomatis" di popup berarti "ikut
 *      temaPanel", bukan prefers-color-scheme; sistem gelap + temaPanel terang
 *      = tampil terang.
 *
 * ATURAN DI SINI
 *
 *   - Pilihan hanya tiga: terang | gelap | sistem. Disimpan BERSAMA WAKTU
 *     PILIHNYA ("gelap|1729700000000"); yang lebih baru menang, dan yang
 *     disalin ke tempat lain disalin APA ADANYA (nilai dan waktunya) sehingga
 *     penerima mendapati keadaannya sudah sama dan tidak menulis balik.
 *     Itu yang memutus ping-pong.
 *   - "Sistem" diuraikan di JENDELA HALAMAN (matchMedia) dan dipantau
 *     perubahannya - bukan di pekerja latar, yang tidak punya matchMedia.
 *   - Penanda dipasang pada document_start dari salinan sinkron
 *     (localStorage origin yang sama), SEBELUM lukis pertama. chrome.storage
 *     hanya menyegarkan; bila sama dengan yang sudah terpasang, tidak ada
 *     satu pun penulisan atau perubahan atribut.
 *   - Satu penulis salinan, dengan arti tunggal. Lapisan gelap SIPP (Shift
 *     pada tombol tema) punya kunci sendiri, bukan nilai "mati" di kunci tema.
 *   - Pergantian apa pun dilakukan dengan transisi dimatikan sesaat.
 *   - Nilai lama dipetakan, tidak dihapus: temaPanel (terang/gelap),
 *     aleta-tema-sipp (terang/gelap/mati), portal-terpadu-pa-v2.theme
 *     (light/dark). temaPanel tetap ditulis sebagai CERMIN hasil uraian supaya
 *     tab lama yang belum dimuat ulang tidak buta.
 *
 * Portal ALETA memegang tampilannya sendiri (kelas `dark`); di sana pusat ini
 * hanya menjembatani: menyalin pilihan portal ke chrome.storage dan sebaliknya
 * lewat salinan yang sama, tanpa menyentuh kelas portal.
 */
(function pasangTemaPusat(akar) {
  if (akar.AletaTemaPusat) return;

  const DAFTAR = ["terang", "gelap", "sistem"];
  const KUNCI = {
    pilihan: "pilihanTema",
    waktu: "pilihanTemaWaktu",
    cermin: "temaPanel",
    lapisan: "temaSipp",
    salinan: "aleta-tema-pilihan",
    salinanLapisan: "aleta-tema-lapisan",
    salinanLama: "aleta-tema-sipp",
    portalLama: "portal-terpadu-pa-v2",
    jembatan: "data-aleta-tema-salinan",
  };

  function bersihkan(p) {
    return DAFTAR.indexOf(p) >= 0 ? p : "";
  }

  /** "gelap|1729700000000" -> { pilihan, waktu }; selain itu null. */
  function urai(teks) {
    const m = /^(terang|gelap|sistem)\|(\d{1,15})$/.exec(String(teks == null ? "" : teks));
    return m ? { pilihan: m[1], waktu: Number(m[2]) } : null;
  }

  function susun(pilihan, waktu) {
    return pilihan + "|" + waktu;
  }

  function sistemGelap() {
    try {
      if (akar.matchMedia) return akar.matchMedia("(prefers-color-scheme: dark)").matches === true;
    } catch {
      /* jatuh ke bawaan produk */
    }
    // Tidak dapat ditanyakan: bawaan produk ini gelap.
    return true;
  }

  function resolusiDari(pilihan, gelapSistem) {
    if (pilihan === "sistem") return gelapSistem ? "gelap" : "terang";
    return pilihan === "terang" ? "terang" : "gelap";
  }

  /**
   * Pilihan dari isi chrome.storage. Nilai lama dipetakan: temaPanel
   * "terang"/"gelap" menjadi pilihan dengan waktu 0 (lebih tua dari pilihan
   * mana pun yang sungguh diambil sesudah ini).
   */
  function dariChrome(simpan) {
    const s = simpan || {};
    const p = bersihkan(s[KUNCI.pilihan]);
    if (p) return { pilihan: p, waktu: Number(s[KUNCI.waktu]) || 0 };
    const lama = s[KUNCI.cermin];
    if (lama === "terang" || lama === "gelap") return { pilihan: lama, waktu: 0 };
    return null;
  }

  /** Isi yang ditulis ke chrome.storage untuk satu keadaan. */
  function tulisanChrome(pilihan, waktu, resolusi) {
    return {
      [KUNCI.pilihan]: pilihan,
      [KUNCI.waktu]: waktu,
      [KUNCI.cermin]: resolusi,
    };
  }

  /** Yang lebih baru menang; waktu sama tetapi beda pilihan: chrome menang. */
  function chromeMenang(dariC, lokal) {
    if (!dariC) return false;
    if (!lokal) return true;
    if (dariC.waktu > lokal.waktu) return true;
    return dariC.waktu === lokal.waktu && dariC.pilihan !== lokal.pilihan;
  }

  // ─── Keadaan halaman ───────────────────────────────────────────────────────

  let halaman = "sipp"; // "sipp" | "abt" | "portal"
  let sudahMulai = false;
  /** Pembersih semua pendengar yang dipasang mulai(); dipakai hentikan(). */
  const penghenti = [];
  const kini = { pilihan: "gelap", waktu: 0, resolusi: "gelap", lapisan: true, ada: false };
  const pendengar = [];

  function dok() {
    return akar.document;
  }

  function penyimpananHalaman() {
    try {
      return akar.localStorage || null;
    } catch {
      return null;
    }
  }

  function deteksiHalaman() {
    let jalur = "";
    try {
      jalur = String(akar.location.pathname || "");
    } catch {
      /* bawaan: sipp */
    }
    if (jalur.indexOf("/aps_badilag/") === 0) return "abt";
    if (/^\/aleta(\/|$)/.test(jalur)) return "portal";
    return "sipp";
  }

  function bacaSalinan() {
    const s = penyimpananHalaman();
    if (!s) return null;
    try {
      const baru = urai(s.getItem(KUNCI.salinan));
      if (baru) return baru;
      if (halaman === "portal") {
        const mentah = s.getItem(KUNCI.portalLama);
        if (mentah) {
          const lama = JSON.parse(mentah);
          const tema = lama && lama.theme;
          if (tema === "light") return { pilihan: "terang", waktu: 0 };
          if (tema === "dark") return { pilihan: "gelap", waktu: 0 };
        }
        return null;
      }
      const lama = s.getItem(KUNCI.salinanLama);
      if (lama === "terang" || lama === "gelap") return { pilihan: lama, waktu: 0 };
      if (lama === "mati") return { pilihan: "gelap", waktu: 0 };
    } catch {
      /* penyimpanan halaman tidak tersedia atau rusak: bawaan */
    }
    return null;
  }

  function bacaLapisan() {
    const s = penyimpananHalaman();
    if (!s) return true;
    try {
      const baru = s.getItem(KUNCI.salinanLapisan);
      if (baru === "0") return false;
      if (baru === "1") return true;
      // Lama: lapisan dimatikan dahulu dicatat sebagai "mati" di kunci tema.
      if (s.getItem(KUNCI.salinanLama) === "mati") return false;
    } catch {
      /* bawaan: menyala */
    }
    return true;
  }

  function tulisSalinan() {
    const s = penyimpananHalaman();
    if (!s) return;
    try {
      const nilai = susun(kini.pilihan, kini.waktu);
      if (s.getItem(KUNCI.salinan) !== nilai) s.setItem(KUNCI.salinan, nilai);
    } catch {
      /* temanya tetap berlaku di halaman ini */
    }
  }

  function tulisSalinanLapisan() {
    const s = penyimpananHalaman();
    if (!s) return;
    try {
      const nilai = kini.lapisan ? "1" : "0";
      if (s.getItem(KUNCI.salinanLapisan) !== nilai) s.setItem(KUNCI.salinanLapisan, nilai);
    } catch {
      /* ditulis ulang pada pergantian berikutnya */
    }
  }

  function setAtribut(el, nama, nilai) {
    if (el.getAttribute(nama) !== nilai) el.setAttribute(nama, nilai);
  }

  function cabutAtribut(el, nama) {
    if (el.hasAttribute(nama)) el.removeAttribute(nama);
  }

  /** Penanda di <html>. Hanya menulis yang berbeda; portal tidak disentuh. */
  function tandai() {
    if (halaman === "portal") return;
    const d = dok();
    const html = d && d.documentElement;
    if (!html) return;
    setAtribut(html, "data-aleta-tema", kini.resolusi);
    setAtribut(html, "data-aleta-tema-pilihan", kini.pilihan);
    // SIPP: lapisan gelap hanya bila temanya gelap DAN saklarnya menyala.
    // ABT tidak punya saklar itu: gelap berarti gelap.
    const pasang = kini.resolusi === "gelap" && (halaman === "abt" || kini.lapisan);
    if (pasang) setAtribut(html, "data-aleta-tema-sipp", "gelap");
    else cabutAtribut(html, "data-aleta-tema-sipp");
  }

  /** Mematikan transisi sesaat (dua bingkai) selama `kerjakan` berjalan. */
  function tanpaTransisi(kerjakan) {
    if (halaman === "portal") {
      // Portal mematikan transisinya sendiri (tema-pilihan.ts); pusat tidak
      // menyentuh kelas <html> di sana.
      kerjakan();
      return;
    }
    const d = dok();
    const html = d && d.documentElement;
    let dipasang = false;
    try {
      if (html) {
        html.classList.add("aleta-ganti-tema");
        dipasang = true;
      }
    } catch {
      /* tanpa kelasnya, temanya tetap berganti */
    }
    try {
      kerjakan();
    } finally {
      if (dipasang) {
        const lepas = () => {
          try {
            html.classList.remove("aleta-ganti-tema");
          } catch {
            /* halaman sudah berganti */
          }
        };
        if (typeof akar.requestAnimationFrame === "function") {
          akar.requestAnimationFrame(() => akar.requestAnimationFrame(lepas));
        } else {
          akar.setTimeout(lepas, 50);
        }
      }
    }
  }

  function kabarkan(asal) {
    const salinan = { pilihan: kini.pilihan, resolusi: kini.resolusi, waktu: kini.waktu, lapisan: kini.lapisan, asal };
    for (const fn of pendengar.slice()) {
      try {
        fn(salinan);
      } catch {
        /* satu pendengar yang gagal tidak mematikan yang lain */
      }
    }
  }

  /** Portal diminta mengikuti salinan. Pembacanya membaca localStorage sendiri. */
  function kabarkanPortal() {
    if (halaman !== "portal") return;
    try {
      akar.dispatchEvent(
        new akar.CustomEvent("aleta-ekstensi-tema", {
          detail: { pilihan: kini.pilihan, waktu: kini.waktu, tema: kini.resolusi },
        })
      );
    } catch {
      /* portal tetap pada temanya sendiri */
    }
  }

  function chromeAda() {
    try {
      return typeof chrome !== "undefined" && chrome.storage && chrome.storage.local ? chrome : null;
    } catch {
      return null;
    }
  }

  function tulisLapisanKeChrome(nilai) {
    const c = chromeAda();
    if (!c) return;
    try {
      const jawab = c.storage.local.set({ [KUNCI.lapisan]: nilai });
      if (jawab && typeof jawab.catch === "function") jawab.catch(() => undefined);
    } catch {
      /* berlaku di halaman ini */
    }
  }

  function tulisKeChrome() {
    const c = chromeAda();
    if (!c) return;
    try {
      const jawab = c.storage.local.set(tulisanChrome(kini.pilihan, kini.waktu, kini.resolusi));
      if (jawab && typeof jawab.catch === "function") jawab.catch(() => undefined);
    } catch {
      /* temanya tetap berlaku di halaman ini */
    }
  }

  /**
   * Menerima satu keadaan. Mengembalikan true bila ada yang berubah.
   *
   *   asal "pengguna"  tombol ditekan di halaman ini
   *   asal "chrome"    chrome.storage (popup atau tab lain)
   *   asal "salinan"   localStorage diubah tab lain (peristiwa storage)
   *   asal "portal"    portal baru menulis salinannya dan memberi tahu lewat atribut
   *   asal "sistem"    tampilan sistem berganti
   */
  function terima(pilihan, waktu, asal) {
    const p = bersihkan(pilihan);
    if (!p) return false;
    const t = Number(waktu) || 0;
    const resolusi = resolusiDari(p, sistemGelap());
    if (kini.ada && kini.pilihan === p && kini.waktu === t && kini.resolusi === resolusi) return false;
    const tampilBerubah = kini.resolusi !== resolusi || kini.pilihan !== p;
    kini.pilihan = p;
    kini.waktu = t;
    kini.resolusi = resolusi;
    kini.ada = true;
    if (asal !== "salinan" && asal !== "portal") tulisSalinan();
    // Di portal pusat tidak menyentuh penanda (tandai() kosong): tidak perlu
    // menyalakan-mematikan kelas transisi untuk pekerjaan yang tidak ada.
    if (tampilBerubah && halaman !== "portal") tanpaTransisi(tandai);
    else tandai();
    if (asal !== "portal") kabarkanPortal();
    kabarkan(asal);
    return true;
  }

  // ─── Chrome <-> halaman ────────────────────────────────────────────────────

  function selarasDenganChrome(simpan) {
    const dariC = dariChrome(simpan);
    const lokal = kini.ada ? { pilihan: kini.pilihan, waktu: kini.waktu } : null;
    // Lapisan gelap SIPP: yang tercatat di chrome menang; bila chrome belum
    // pernah mencatatnya, salinan halaman yang sengaja mematikannya (nilai
    // lama "mati") yang dibawa ke chrome - bukan sebaliknya.
    if (halaman !== "portal") {
      const tercatat = simpan ? simpan[KUNCI.lapisan] : undefined;
      if (typeof tercatat === "boolean") {
        if (tercatat !== kini.lapisan) {
          kini.lapisan = tercatat;
          tulisSalinanLapisan();
          tanpaTransisi(tandai);
          kabarkan("chrome");
        }
      } else if (kini.lapisan === false) {
        tulisLapisanKeChrome(false);
      }
    }
    if (!dariC) {
      // Chrome belum pernah mencatat pilihan: halaman yang sudah punya
      // salinan menjadi sumbernya (diadopsi, bukan dipaksakan).
      if (lokal) tulisKeChrome();
      return;
    }
    if (chromeMenang(dariC, lokal)) {
      terima(dariC.pilihan, dariC.waktu, "chrome");
    } else if (lokal && lokal.waktu > dariC.waktu) {
      tulisKeChrome();
    } else if (lokal && lokal.waktu === dariC.waktu && simpan && simpan[KUNCI.pilihan] === undefined) {
      // Hanya cermin lama yang ada di chrome: tulis bentuk barunya, sekali.
      tulisKeChrome();
    }
  }

  function muatDariChrome() {
    const c = chromeAda();
    if (!c) return;
    try {
      // sudahMulai: jawaban yang tiba sesudah hentikan() diabaikan.
      c.storage.local.get([KUNCI.pilihan, KUNCI.waktu, KUNCI.cermin, KUNCI.lapisan], (simpan) => {
        if (sudahMulai) selarasDenganChrome(simpan || {});
      });
    } catch {
      /* di luar konteks ekstensi: salinan halaman yang berlaku */
    }
  }

  function pasangPendengarChrome() {
    const c = chromeAda();
    if (!c || !c.storage.onChanged) return;
    try {
      const saatBerubah = (ubah, tempat) => {
        if (tempat !== "local") return;
        if (ubah[KUNCI.lapisan] && halaman !== "portal") {
          const menyala = ubah[KUNCI.lapisan].newValue !== false;
          if (menyala !== kini.lapisan) {
            kini.lapisan = menyala;
            tulisSalinanLapisan();
            tanpaTransisi(tandai);
            kabarkan("chrome");
          }
        }
        if (ubah[KUNCI.pilihan] && !bersihkan(ubah[KUNCI.pilihan].newValue)) {
          // Dihapus (misalnya setelan akun diganti): halaman yang sudah punya
          // pilihan menulis kembali, supaya popup dan tab lain tidak kosong.
          if (kini.ada) tulisKeChrome();
          return;
        }
        if (ubah[KUNCI.pilihan] || ubah[KUNCI.waktu]) {
          const p = ubah[KUNCI.pilihan] ? ubah[KUNCI.pilihan].newValue : kini.pilihan;
          const t = ubah[KUNCI.waktu] ? Number(ubah[KUNCI.waktu].newValue) || 0 : kini.waktu;
          if (chromeMenang({ pilihan: bersihkan(p), waktu: t }, kini.ada ? { pilihan: kini.pilihan, waktu: kini.waktu } : null)) {
            terima(p, t, "chrome");
          }
        }
      };
      c.storage.onChanged.addListener(saatBerubah);
      if (typeof c.storage.onChanged.removeListener === "function") {
        penghenti.push(() => c.storage.onChanged.removeListener(saatBerubah));
      }
    } catch {
      /* tanpa pendengarnya, perubahan dari tab lain terbaca saat dimuat ulang */
    }
  }

  function pasangPemantauSistem() {
    try {
      const mq = akar.matchMedia && akar.matchMedia("(prefers-color-scheme: dark)");
      if (!mq) return;
      const berubah = () => {
        if (kini.pilihan !== "sistem") return;
        const resolusi = resolusiDari("sistem", sistemGelap());
        if (resolusi === kini.resolusi) return;
        kini.resolusi = resolusi;
        tanpaTransisi(tandai);
        kabarkan("sistem");
      };
      if (typeof mq.addEventListener === "function") {
        mq.addEventListener("change", berubah);
        penghenti.push(() => mq.removeEventListener("change", berubah));
      } else if (typeof mq.addListener === "function") {
        mq.addListener(berubah);
        penghenti.push(() => mq.removeListener(berubah));
      }
    } catch {
      /* "sistem" tetap benar saat dimuat; hanya tidak ikut berubah langsung */
    }
  }

  function pasangPendengarSalinan() {
    try {
      const saatStorage = (peristiwa) => {
        if (peristiwa.key === KUNCI.salinan) {
          const a = urai(peristiwa.newValue);
          if (!a) return;
          const lokal = kini.ada ? { pilihan: kini.pilihan, waktu: kini.waktu } : null;
          if (!lokal || a.waktu > lokal.waktu || (a.waktu === lokal.waktu && a.pilihan !== lokal.pilihan)) {
            terima(a.pilihan, a.waktu, "salinan");
            // Penulisnya mungkin tab tanpa ekstensi: pastikan chrome ikut.
            muatDariChrome();
          }
        } else if (peristiwa.key === KUNCI.salinanLapisan && halaman !== "portal") {
          const menyala = peristiwa.newValue !== "0";
          if (menyala !== kini.lapisan) {
            kini.lapisan = menyala;
            tanpaTransisi(tandai);
            kabarkan("salinan");
          }
        }
      };
      akar.addEventListener("storage", saatStorage);
      penghenti.push(() => akar.removeEventListener("storage", saatStorage));
    } catch {
      /* tab lain terbaca lewat chrome.storage */
    }
  }

  function pasangJembatanPortal() {
    const d = dok();
    const html = d && d.documentElement;
    if (!html) return;
    const baca = () => {
      const a = urai(html.getAttribute(KUNCI.jembatan));
      if (!a) return;
      const lokal = kini.ada ? { pilihan: kini.pilihan, waktu: kini.waktu } : null;
      if (!lokal || a.waktu > lokal.waktu || (a.waktu === lokal.waktu && a.pilihan !== lokal.pilihan)) {
        terima(a.pilihan, a.waktu, "portal");
        tulisKeChrome();
      }
    };
    try {
      const pengamat = new akar.MutationObserver(baca);
      pengamat.observe(html, { attributes: true, attributeFilter: [KUNCI.jembatan] });
      penghenti.push(() => pengamat.disconnect());
    } catch {
      /* portal lama tanpa jembatan: tombol portal tidak menggerakkan popup */
    }
    baca();
  }

  // ─── Antarmuka ─────────────────────────────────────────────────────────────

  /** Dipanggil sekali pada document_start. Mengembalikan keadaan awal. */
  function mulai() {
    if (sudahMulai) return Object.assign({}, kini);
    sudahMulai = true;
    halaman = deteksiHalaman();
    const s = bacaSalinan();
    if (s) {
      kini.pilihan = s.pilihan;
      kini.waktu = s.waktu;
      kini.ada = true;
    }
    kini.lapisan = bacaLapisan();
    kini.resolusi = resolusiDari(kini.pilihan, sistemGelap());
    tandai();
    pasangPemantauSistem();
    pasangPendengarSalinan();
    if (halaman === "portal") pasangJembatanPortal();
    pasangPendengarChrome();
    muatDariChrome();
    return Object.assign({}, kini);
  }

  /** Pilihan diambil pengguna di halaman ini. Pilihan yang sama diabaikan. */
  function pilih(pilihan) {
    const p = bersihkan(pilihan);
    if (!p || (kini.ada && p === kini.pilihan)) return false;
    const waktu = Math.max(Date.now(), kini.waktu + 1);
    const berubah = terima(p, waktu, "pengguna");
    tulisKeChrome();
    return berubah;
  }

  /** Lapisan gelap SIPP (Shift + tombol tema). Tidak berlaku di ABT dan portal. */
  function aturLapisan(menyala) {
    const nilai = menyala !== false;
    if (nilai === kini.lapisan) return;
    kini.lapisan = nilai;
    tulisSalinanLapisan();
    tanpaTransisi(tandai);
    tulisLapisanKeChrome(nilai);
    kabarkan("pengguna");
  }

  /**
   * Melepas semua pendengar dan mengizinkan mulai() lagi. Dipakai uji dan
   * pemuatan ulang skrip; halaman sungguhan tidak pernah memanggilnya.
   */
  function hentikan() {
    while (penghenti.length) {
      try {
        penghenti.pop()();
      } catch {
        /* sudah lepas */
      }
    }
    pendengar.length = 0;
    sudahMulai = false;
  }

  function dengar(fn) {
    if (typeof fn !== "function") return () => undefined;
    pendengar.push(fn);
    return () => {
      const i = pendengar.indexOf(fn);
      if (i >= 0) pendengar.splice(i, 1);
    };
  }

  function keadaan() {
    return { pilihan: kini.pilihan, resolusi: kini.resolusi, waktu: kini.waktu, lapisan: kini.lapisan };
  }

  akar.AletaTemaPusat = {
    DAFTAR,
    KUNCI,
    bersihkan,
    urai,
    susun,
    sistemGelap,
    resolusiDari,
    dariChrome,
    tulisanChrome,
    chromeMenang,
    tanpaTransisi,
    mulai,
    pilih,
    aturLapisan,
    hentikan,
    dengar,
    keadaan,
    halaman: () => halaman,
  };
})(typeof window !== "undefined" ? window : globalThis);
