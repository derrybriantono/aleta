"use strict";

/**
 * ============================================================================
 * UBIN "ALETA ABT" DI HALAMAN MENU APS BADILAG (3 Nov 2026)
 * ============================================================================
 *
 * Permintaan pengguna: di halaman menu APS Badilag (/aps_badilag/main, cetakan
 * application/views/homepage.php) tambahkan ubin "ALETA ABT" tepat di samping
 * BLANGKO TAMBAHAN SIPP; E-PELAPORAN turun ke baris di bawahnya. Klik = langsung
 * ke Blangko ABT by Derry Briantono (rencana ke depan: ABT ALETA).
 *
 * BENTUK. Ubin APS adalah  div.col-lg-3.mb-4 > a > img.img-fluid  (gambar
 * 900x520) di dalam  .auto-form-wrapper > .row.justify-content-center. Ubin kita
 * memakai kelas kolom yang SAMA dan gambar SVG berperbandingan 900x520 yang
 * sama, sehingga tingginya sama dengan ubin lain di semua lebar layar (di bawah
 * 992 px kolom Bootstrap menjadi satu per baris, seperti ubin aslinya). Sesudah
 * ubin disisipkan satu pemisah baris (div.w-100 setinggi nol) supaya E-PELAPORAN
 * dan ubin sesudahnya selalu mulai di baris berikutnya - juga bagi peran yang
 * ubinnya lebih sedikit (Hakim tanpa E-KEUANGAN). Ubin asli tidak diubah ukuran,
 * urutan, maupun gayanya.
 *
 * TUJUAN. Alamat ubin BLANGKO TAMBAHAN SIPP (".../abt") + "/main/beranda#aleta-derry=1"
 * - penanda yang sama dengan butir "ABT By Derry" di bilah SIPP (menu-atas.js);
 * di halaman ABT, menu-atas.js membuka Blangko ABT by Derry Briantono sendiri.
 * Dibuka di tab yang sama seperti ubin APS lain; sesi ABT = sesi APS yang sama.
 *
 * HAK. Hanya akun ALETA yang boleh membuka Blangko Derry (aturan bolehDerry
 * menu-atas.js: admin, hakim, PP/panitera, juru sita, PTSP).
 *   - sudah masuk dan berhak: ubin ke panel Blangko Derry (seperti semula);
 *   - sudah masuk dan tidak berhak: ubin TIDAK tampil;
 *   - BELUM masuk ALETA (GET /ekstensi/siapa dijawab 401, 5 Nov 2026): ubin tampil dan
 *     mengantar ke layar masuk ALETA dengan ?kembali=/aleta-abt?dari=aps. Sesudah masuk
 *     portal membuka halaman /aleta-abt, dan halaman itu membuka panel Blangko Derry bila
 *     ekstensi aktif dan akun berhak. Hanya jalur di dalam portal (tujuanKembaliAman);
 *   - ALETA tak terjangkau (galat jaringan / bukan 401): ubin TIDAK tampil.
 * Jawaban "sudah masuk" disimpan 5 menit di sessionStorage dengan kunci yang sama dengan
 * menu-atas.js, sehingga kunjungan berikutnya menggambar ubin seketika tanpa permintaan.
 * Keadaan "belum masuk" TIDAK disimpan: begitu akun masuk, kunjungan berikutnya langsung benar.
 *
 * RINGAN. Tidak ada pengamat DOM dan tidak ada pewaktu berulang. Satu GET ke
 * /ekstensi/siapa paling banyak sekali per 5 menit, dan itu pun ditunda sampai
 * peramban senggang (requestIdleCallback) sesudah halaman selesai dimuat.
 *
 * Tidak ada yang ditulis ke server atau basis data APS/ABT/SIPP; hanya tampilan
 * di peramban ini. Tanpa ekstensi, halaman APS tidak berubah sama sekali.
 */
(function apsBerandaModul() {
  if (typeof globalThis === "undefined" || globalThis.aletaApsBeranda) return;

  const API_SIAPA = "/aleta/api/aleta-ecourt/ekstensi/siapa";
  const KUNCI_HAK = "aletaMenuAtasHak"; // sama dengan menu-atas.js
  const UMUR_HAK_MS = 5 * 60 * 1000;
  const HASH_DERRY = "aleta-derry=1";
  /** Jalur DI DALAM portal (tanpa /aleta): halaman ALETA ABT yang membuka panel bila ?dari=aps. */
  const KEMBALI_ALETA_ABT = "/aleta-abt?dari=aps";
  const ATRIBUT = "data-aleta-ubin";
  const ID_GAYA = "aleta-aps-ubin-gaya";
  const JUDUL = "ALETA ABT";
  const KETERANGAN = "Blangko ABT by Derry Briantono";

  /** Halaman menu APS: /aps_badilag/main (juga lewat index.php) atau akar /aps_badilag/. */
  function halamanMenuAps(loc) {
    const p = String(((loc || location).pathname) || "");
    return /^\/aps_badilag\/(?:index\.php\/?)?(?:main(?:\/(?:index\/?)?)?)?$/i.test(p);
  }

  /** Ubin BLANGKO TAMBAHAN SIPP: kolom yang tautannya berakhir di /abt. */
  function cariUbinAbt(d) {
    for (const a of Array.from(d.querySelectorAll(".auto-form-wrapper .row a[href]"))) {
      const href = String(a.getAttribute("href") || "");
      if (!/\/abt\/?(?:[?#].*)?$/i.test(href)) continue;
      const kolom = a.closest("[class*='col-']");
      if (kolom && kolom.parentElement) return { kolom, a };
    }
    return null;
  }

  /** Alamat Blangko ABT by Derry Briantono, diturunkan dari tautan ubin ABT milik APS sendiri. */
  function alamatDerry(aAbt, loc) {
    const l = loc || location;
    let dasar = `${l.origin}/aps_badilag/abt`;
    try {
      const u = new URL(aAbt.getAttribute("href") || "", l.href);
      if (u.origin === l.origin) dasar = `${u.origin}${u.pathname.replace(/\/+$/, "")}`;
    } catch {
      /* tetap alamat bawaan */
    }
    return `${dasar}/main/beranda#${HASH_DERRY}`;
  }

  /** Layar masuk ALETA; sesudah masuk portal mengantar ke halaman ALETA ABT (bukan ke alamat bebas). */
  function alamatMasukAleta(loc) {
    const l = loc || location;
    return `${l.origin}/aleta/login?kembali=${encodeURIComponent(KEMBALI_ALETA_ABT)}`;
  }

  /** Boleh membuka Blangko Derry? Memakai aturan menu-atas.js bila ada; selain itu golonganMenu server. */
  function boleh(siapa) {
    const m = globalThis.aletaMenuAtas;
    if (m && m.murni && typeof m.murni.bolehDerry === "function") return m.murni.bolehDerry(siapa) === true;
    if (!siapa || typeof siapa !== "object") return false;
    const roleId = String(siapa.roleId || "").toLowerCase();
    if (roleId === "super-admin" || roleId === "admin") return true;
    const g = Array.isArray(siapa.golonganMenu) ? siapa.golonganMenu.map((x) => String(x || "").toLowerCase()) : [];
    return g.some((x) => ["admin", "hakim", "ketua", "pp", "panitera", "panmud", "panitera-utama", "analis", "jurusita", "ptsp"].includes(x));
  }

  function sesiBaca() {
    try {
      const x = JSON.parse(globalThis.sessionStorage.getItem(KUNCI_HAK) || "null");
      if (x && Date.now() - Number(x.saat) < UMUR_HAK_MS && typeof x.abt === "boolean") return x.abt;
    } catch {
      /* diperiksa ulang */
    }
    return null;
  }
  function sesiTulis(abt) {
    try {
      globalThis.sessionStorage.setItem(KUNCI_HAK, JSON.stringify({ saat: Date.now(), abt }));
    } catch {
      /* tanpa sessionStorage: diperiksa lagi lain kali */
    }
  }

  /** true | false | "belum-masuk" (HTTP 401) | null (ALETA tak terjangkau / jawaban tak terbaca). */
  async function ambilHak(ambil) {
    try {
      const r = await (ambil || fetch)(API_SIAPA, { credentials: "include", cache: "no-store" });
      if (r && r.status === 401) return "belum-masuk";
      if (!r || !r.ok) return null;
      const j = await r.json().catch(() => null);
      const data = j && typeof j === "object" ? (j.data !== undefined ? j.data : j) : null;
      if (!data || typeof data !== "object") return null;
      const b = boleh(data);
      sesiTulis(b);
      return b;
    } catch {
      return null;
    }
  }

  // Warna lewat token tema SIPP/ABT ekstensi (panel.css); nilai sesudah koma = tema terang.
  const GAYA = `
.aleta-aps-ubin{display:block;color:var(--s-hijau-terang,#007640);text-decoration:none}
.aleta-aps-ubin:hover,.aleta-aps-ubin:focus{color:var(--s-tulisan,#00a35a);text-decoration:none}
.aleta-aps-ubin svg{display:block;width:100%;height:auto}
.aleta-aps-ubin .aleta-aps-lingkar{fill:currentColor}
.aleta-aps-ubin .aleta-aps-dalam{fill:var(--s-permukaan,#ffffff)}
.aleta-aps-ubin .aleta-aps-tulis{fill:currentColor;font-family:Arial,Helvetica,sans-serif;font-weight:700}
`;
  function sisipkanGaya(d) {
    if (!d.head || d.getElementById(ID_GAYA)) return;
    const s = d.createElement("style");
    s.id = ID_GAYA;
    s.textContent = GAYA;
    d.head.appendChild(s);
  }

  function ikonAleta() {
    try {
      if (globalThis.chrome && chrome.runtime && typeof chrome.runtime.getURL === "function") return chrome.runtime.getURL("ikon/aleta-128.png");
    } catch {
      /* konteks ekstensi tidak ada */
    }
    return "";
  }

  const NS = "http://www.w3.org/2000/svg";
  function svgEl(d, tag, atr) {
    const e = d.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(atr || {})) e.setAttribute(k, String(v));
    return e;
  }

  /**
   * Gambar ubin 900x520 - perbandingan yang sama dengan logo ubin APS: lingkaran berwarna
   * berisi lambang ALETA (ikon ekstensi) dan nama ubin huruf kapital tebal di bawahnya.
   */
  function gambarUbin(d) {
    const svg = svgEl(d, "svg", { viewBox: "0 0 900 520", role: "img", "aria-label": `${JUDUL} - ${KETERANGAN}` });
    svg.appendChild(svgEl(d, "circle", { class: "aleta-aps-lingkar", cx: 450, cy: 215, r: 200 }));
    svg.appendChild(svgEl(d, "circle", { class: "aleta-aps-dalam", cx: 450, cy: 215, r: 150 }));
    const ikon = ikonAleta();
    if (ikon) {
      svg.appendChild(svgEl(d, "image", { x: 330, y: 95, width: 240, height: 240, href: ikon }));
    } else {
      const t = svgEl(d, "text", { class: "aleta-aps-tulis", x: 450, y: 258, "text-anchor": "middle", "font-size": 130 });
      t.textContent = "A";
      svg.appendChild(t);
    }
    const judul = svgEl(d, "text", { class: "aleta-aps-tulis", x: 450, y: 500, "text-anchor": "middle", "font-size": 66 });
    judul.textContent = JUDUL;
    svg.appendChild(judul);
    return svg;
  }

  /**
   * Menyisipkan ubin (idempoten). Pulang { dipasang, alasan }. `tampil` false = ubin dibuang
   * (hak dicabut) dan halaman kembali persis seperti aslinya. `belumMasuk` true = tujuan ubin
   * layar masuk ALETA, bukan panel.
   */
  function pasangUbin(doc, opsi) {
    const d = doc || document;
    const o = opsi || {};
    const ada = Array.from(d.querySelectorAll(`[${ATRIBUT}]`));
    if (o.tampil === false) {
      for (const e of ada) e.remove();
      return { dipasang: false, alasan: "tanpa-hak" };
    }
    const abt = cariUbinAbt(d);
    if (!abt) return { dipasang: false, alasan: "tanpa-ubin-abt" };
    const tujuan = o.belumMasuk === true ? alamatMasukAleta(o.loc) : alamatDerry(abt.a, o.loc);
    const kolomKita = ada.find((e) => e.getAttribute(ATRIBUT) === "aleta-abt");
    const pemisah = ada.find((e) => e.getAttribute(ATRIBUT) === "pemisah");
    const tautanAda = kolomKita ? kolomKita.querySelector("a") : null;
    if (
      kolomKita &&
      pemisah &&
      tautanAda &&
      tautanAda.getAttribute("href") === tujuan &&
      abt.kolom.nextElementSibling === kolomKita &&
      kolomKita.nextElementSibling === pemisah
    ) {
      return { dipasang: true, alasan: "sudah" };
    }
    for (const e of ada) e.remove();
    sisipkanGaya(d);
    const kolom = d.createElement("div");
    // Kelas kolom APS sendiri saja - BUKAN "aleta-sisip" (panel.css menggambar kotak bergaris untuknya).
    kolom.className = String(abt.kolom.className || "col-lg-3 mb-4");
    kolom.setAttribute(ATRIBUT, "aleta-abt");
    const a = d.createElement("a");
    a.className = "aleta-aps-ubin";
    a.href = tujuan;
    a.title = o.belumMasuk === true ? `Masuk ke ALETA dulu, lalu ${KETERANGAN} terbuka` : `${KETERANGAN} (rencana: ABT ALETA)`;
    a.appendChild(gambarUbin(d));
    kolom.appendChild(a);
    const putus = d.createElement("div");
    putus.className = "w-100";
    putus.style.padding = "0";
    putus.style.margin = "0";
    putus.setAttribute(ATRIBUT, "pemisah");
    putus.setAttribute("aria-hidden", "true");
    abt.kolom.parentElement.insertBefore(kolom, abt.kolom.nextSibling);
    abt.kolom.parentElement.insertBefore(putus, kolom.nextSibling);
    return { dipasang: true, alasan: "baru" };
  }

  /** Menjalankan sesuatu saat peramban senggang, paling lambat `batas` md. */
  function saatSenggang(f, batas) {
    const ric = globalThis.requestIdleCallback;
    if (typeof ric === "function") ric(() => f(), { timeout: batas || 2000 });
    else setTimeout(f, 300);
  }

  /** Alur penuh; pulang ringkasan keputusan (dipakai uji). */
  async function mulai(opsi) {
    const o = opsi || {};
    const d = o.doc || document;
    try {
      if (!halamanMenuAps(o.loc)) return { aksi: "bukan-menu-aps" };
      if (!cariUbinAbt(d)) return { aksi: "tanpa-ubin-abt" };
      const tersimpan = sesiBaca();
      if (tersimpan !== null) return { aksi: "dari-sesi", ...pasangUbin(d, { tampil: tersimpan, loc: o.loc }) };
      // Belum diketahui: tunggu halaman selesai dimuat dan peramban senggang, baru satu GET.
      if (d.readyState !== "complete" && !o.segera) await new Promise((r) => globalThis.addEventListener("load", r, { once: true }));
      if (!o.segera) await new Promise((r) => saatSenggang(r, 2000));
      const hak = await ambilHak(o.ambil);
      if (hak === "belum-masuk") return { aksi: "belum-masuk", ...pasangUbin(d, { tampil: true, belumMasuk: true, loc: o.loc }) };
      if (hak === null) return { aksi: "hak-belum-diketahui", dipasang: false };
      return { aksi: "dari-server", ...pasangUbin(d, { tampil: hak, loc: o.loc }) };
    } catch {
      return { aksi: "galat" };
    }
  }

  globalThis.aletaApsBeranda = {
    versi: "aps-beranda-1",
    mulai,
    pasangUbin,
    murni: { halamanMenuAps, cariUbinAbt, alamatDerry, alamatMasukAleta, boleh },
    KEMBALI_ALETA_ABT,
    KUNCI_HAK,
    API_SIAPA,
  };
  if (!globalThis.__aletaApsBerandaUji) void mulai();
})();
