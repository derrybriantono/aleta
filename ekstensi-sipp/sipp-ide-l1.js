"use strict";

/**
 * ============================================================================
 * SIPP DENGAN IDE ALETA - GELOMBANG 1 (TAHAP L1, 16 Okt 2026)
 * ============================================================================
 *
 * Skrip konten TERSENDIRI (dimuat paling belakang di SIPP dan di ABT) supaya
 * tidak bertabrakan dengan konten.js / abt.js maupun gelombang L2
 * (sipp-ide-l2.js). Seluruh isinya dibungkus satu fungsi; yang keluar hanya
 * globalThis.aletaSippIdeL1. Rancangan: D:/aleta-dev/kerja/ide-meja-blangko/
 * sipp-dengan-ide.html (v3) dan peta SIPP 7.0.4 (K-PETA-SIPP.md).
 *
 *   J01 "Buka di ABT"   di tiap perkara: daftar perkara (#tablePerkaraAll -
 *       juga daftar Jurnal yang memakai id sama), daftar arsip
 *       (#tableArsipAll), dan baris tombol halaman perkara (#submenus).
 *       Membuka ABT di tab baru (main/beranda#aleta-bd=<nomor>); di ABT skrip
 *       ini menyerahkan nomornya ke Blangko ABT by Derry Briantono
 *       (aletaBlangkoDerry.buka + pilihPerkara) - blangko yang disarankan
 *       untuk perkara itu tampil di sana (rekomendasi blangko tahap E).
 *       Akun ABT tanpa grup Blangko Derry = ABT biasa + kabar singkat.
 *   J02 "Buka di ALETA" di tempat yang sama: /aleta/aleta-ecourt?perkara=.
 *   I01 Pita "Isi dengan ALETA" + penghitung kolom (wajib = label bertanda *
 *       merah SIPP) di jendela SIPP yang PUNYA usulan ALETA: Putusan Akhir,
 *       Data Umum, PMH/PPP/PJS/PHS, Saksi/Pihak, Court Calendar. Tombolnya
 *       menjalankan mesin usulan yang SUDAH ada di panel (Putusan otomatis,
 *       Isi formulir Data Umum dari posita, Penetapan dan Penunjukan, kartu
 *       KTP/saksi) - tidak ada aturan isi baru, tidak ada tulisan baru.
 *   I02-I05 Jendela Putusan Akhir (form#frm_putusan berALAMAT simpan
 *       managePutusanAkhir/validateInput - id formnya dipakai juga oleh
 *       Pemberitahuan dan Minutasi): unggah/taruh berkas RTF/DOCX/DOC/PDF ->
 *       diteruskan ke pemilih naskah Putusan otomatis -> usulan SEMUA kolom
 *       dicerminkan di jendela (keyakinan, sekarang -> usulan, selisih,
 *       centang dua arah) -> "Isikan, lalu Simpan" menekan tombol Isikan
 *       panel (Simpan + e-Doc putusan & anonimisasi lewat rute unggah-sipp
 *       yang sudah ada, termasuk pemeriksa anonimisasi).
 *   Cek dobel e-Doc: jendela e-Doc SIPP (PMH/PPP/PJS/PHS/BAS/putusan/
 *       anonimisasi, form#frm_upload_file) yang sudah punya "File Tersimpan"
 *       memberi tahu sebelum diganti dan meminta konfirmasi saat Simpan.
 *       "Isikan, lalu Simpan" di Putusan Akhir juga bertanya bila e-Doc
 *       putusan di tab Putusan sudah ada.
 *
 * Tidak satu pun yang ditulis ke SIPP/ABT oleh berkas ini: tulisan tetap lewat
 * tombol yang sudah ada (Simpan SIPP, Isikan panel, unggah-sipp). Tidak ada
 * tanda ALETA yang masuk ke isian SIPP. Semua tombol sisipan type="button",
 * berkelas aleta-sisip (diabaikan pengamat konten.js) dan aleta-l1.
 * Tampilan Lama tidak berubah sama sekali (alatUjiMode() === "lama").
 */
(function sippIdeL1Modul() {
  if (typeof globalThis === "undefined" || globalThis.aletaSippIdeL1) return;

  // ──────────────────────────────────────────────────────────────────────────
  // Konstanta
  // ──────────────────────────────────────────────────────────────────────────
  const KELAS = "aleta-sisip aleta-l1";
  const ID_GAYA = "aleta-l1-gaya";
  const ID_PANEL = "aleta-panel-sipp";
  const KUNCI_SERAH = "sippIdeL1SerahAbt";
  const HASH_SERAH = "aleta-bd=";
  const BATAS_SERAH_MS = 3 * 60 * 1000;
  const POLA_NOMOR = /\b(\d{1,5}\/[A-Za-z]{1,10}(?:\.[A-Za-z]{1,4}){0,2}\/\d{4}\/[A-Za-z]{2,4}\.[A-Za-z]{2,6})\b/;
  const POLA_NOMOR_PENUH = /^\d{1,5}\/[A-Za-z]{1,10}(?:\.[A-Za-z]{1,4}){0,2}\/\d{4}\/[A-Za-z]{2,4}\.[A-Za-z]{2,6}$/;
  const LABEL_NOMOR = /^nomor\s+perkara\s*:?$/i;
  const TABEL_DAFTAR = "table#tablePerkaraAll, table#tableArsipAll";
  const BUKAN_SIPP = `.aleta-sisip, #${ID_PANEL}, [data-aleta-tanda], .aleta-panel`;
  const BENTUK_NASKAH = ["rtf", "docx", "doc", "pdf"];
  const DETAK_MS = 1000;
  /** Tulisan SIPP untuk e-Doc yang belum ada (diukur di halaman 7.0.4 sungguhan). */
  const BELUM_ADA = /belum\s+(?:ada|di\s*-?\s*upload|diupload|diunggah)/i;

  /**
   * Jendela SIPP yang punya usulan ALETA. `bagian` = data-kunci bagian panel
   * konten.js yang memegang mesinnya; `tombol` = tombol baca-saja di bagian
   * itu yang menyusun usulan (tanpa pola: hanya bagiannya dibuka - mis.
   * Penetapan, yang menulis lewat tombol Tetapkan di panel sendiri);
   * `dalam` = kartu ALETA yang sudah ada di jendela itu sendiri.
   */
  const aksiForm = (f) => String((f && f.getAttribute && f.getAttribute("action")) || "");
  const JENDELA = [
    {
      kode: "putusan-akhir",
      judul: "Putusan Akhir",
      cocok: (f) => f.id === "frm_putusan" && /managePutusanAkhir\/validateInput(?:[/?#]|$)/i.test(aksiForm(f)),
      bagian: "isiPutusan",
      tombol: /ambil usulan dari aleta/i,
      unggah: true,
    },
    { kode: "data-umum", judul: "Data Umum", cocok: (f) => f.id === "frm_data_umum", bagian: "isiAlasanPerkara", tombol: /baca posita/i },
    { kode: "pmh", judul: "Penetapan Majelis Hakim", cocok: (f) => f.id === "frm_majelis", bagian: "penunjukan" },
    { kode: "ppp", judul: "Penunjukan Panitera Pengganti", cocok: (f) => f.id === "frm_panitera", bagian: "penunjukan" },
    { kode: "pjs", judul: "Penunjukan Juru Sita", cocok: (f) => f.id === "frm_juru_sita", bagian: "penunjukan" },
    { kode: "phs", judul: "Penetapan Hari Sidang", cocok: (f) => f.id === "frm_sidang_pertama", bagian: "penunjukan" },
    { kode: "saksi", judul: "Saksi / Pihak", cocok: (f) => f.id === "frm_user", dalam: ".aleta-c2-saksi, .aleta-c2-saksi-pemicu, .aleta-c2-sbantu" },
    { kode: "court-calendar", judul: "Court Calendar", cocok: (f) => f.id === "frm_input_cc", bagian: "courtCalendarOtomatis" },
  ];

  /** Jenis e-Doc dari `from` (fileupload_v.php) atau `form` (fileupload_putusan_v.php). */
  const JENIS_EDOC = {
    dokpmh: "PMH (Penetapan Majelis Hakim)",
    dokppp: "PPP (Penunjukan Panitera Pengganti)",
    dokpjs: "PJS (Penunjukan Juru Sita)",
    dokphs: "PHS (Penetapan Hari Sidang)",
    bas: "BAS",
    putusan: "putusan",
    anonimisasi: "putusan anonimisasi",
  };

  // ──────────────────────────────────────────────────────────────────────────
  // Pembantu kecil
  // ──────────────────────────────────────────────────────────────────────────
  const sebaris = (t) => String(t == null ? "" : t).replace(/\s+/g, " ").trim();
  function el(tag, kelas, teks) {
    const e = document.createElement(tag);
    if (kelas) e.className = kelas;
    if (teks != null) e.textContent = teks;
    return e;
  }
  function tombol(teks, judul, kelas) {
    const b = el("button", `aleta-l1-tombol${kelas ? ` ${kelas}` : ""}`, teks);
    b.type = "button";
    if (judul) b.title = judul;
    return b;
  }
  const milikAleta = (n) => Boolean(n && n.nodeType === 1 && typeof n.closest === "function" && n.closest(BUKAN_SIPP));
  /**
   * Teks hanya ditulis bila BERBEDA. Menulis textContent yang sama tetap
   * mengganti simpul teksnya, dan pengamat konten.js (perubahanDariAleta)
   * menganggap simpul teks sebagai perubahan SIPP - detak pita tiap detik
   * dulu menyegarkan seluruh panel ALETA tiap detik (audit 17 Okt).
   */
  function setelTeks(e, teks) {
    const t = String(teks == null ? "" : teks);
    if (e && e.textContent !== t) e.textContent = t;
  }

  /** Teks sel tanpa sisipan ALETA di dalamnya. */
  function teksSipp(sel) {
    if (!sel) return "";
    let t = "";
    for (const n of Array.from(sel.childNodes)) {
      if (n.nodeType === 3) t += n.nodeValue;
      else if (n.nodeType === 1 && !(n.classList && (n.classList.contains("aleta-sisip") || n.classList.contains("aleta-tanda")))) t += teksSipp(n);
    }
    return t;
  }

  /**
   * Tampak di layar? SIPP menyembunyikan medan dengan .hide() (display:none,
   * elemennya tetap ada) - itu yang dikenali di sini. Peramban tanpa tata letak
   * (uji) hanya memeriksa gaya.
   */
  function tampak(e) {
    if (!e || !e.ownerDocument) return false;
    const w = e.ownerDocument.defaultView;
    for (let n = e; n && n.nodeType === 1; n = n.parentElement) {
      if (n.hidden) return false;
      const gaya = w && typeof w.getComputedStyle === "function" ? w.getComputedStyle(n) : null;
      if (gaya && (gaya.display === "none" || gaya.visibility === "hidden")) return false;
    }
    const akar = e.ownerDocument.documentElement;
    const adaTataLetak = akar && typeof akar.getClientRects === "function" && akar.getClientRects().length > 0;
    if (!adaTataLetak) return true;
    return e.offsetParent !== null || e.getClientRects().length > 0;
  }

  function modeLama() {
    try {
      return typeof alatUjiMode === "function" && String(alatUjiMode() || "lama") === "lama";
    } catch {
      return false;
    }
  }

  async function bacaPenyimpanan(kunci) {
    try {
      return (await chrome.storage.local.get(kunci)) || {};
    } catch {
      return {};
    }
  }
  async function tulisPenyimpanan(isi) {
    try {
      await chrome.storage.local.set(isi);
      return true;
    } catch {
      return false;
    }
  }
  async function hapusPenyimpanan(kunci) {
    try {
      await chrome.storage.local.remove(kunci);
    } catch {
      /* simpanan hanya pembantu serah terima */
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Alamat
  // ──────────────────────────────────────────────────────────────────────────
  function asalAbt(loc) {
    const l = loc || location;
    const cocok = String(l.pathname || "").match(/^(.*?\/abt)\//);
    return cocok ? `${l.origin}${cocok[1]}` : `${l.origin}/aps_badilag/abt`;
  }
  /** J01: ABT di tab baru; nomornya dibawa di hash (tidak dikirim ke server ABT). */
  function alamatAbtUntuk(nomor, loc) {
    return `${asalAbt(loc)}/main/beranda#${HASH_SERAH}${encodeURIComponent(String(nomor || ""))}`;
  }
  /** J02: sama dengan tombol "Buka di ALETA" panel (t7AlamatAleta, sipp-16). */
  function alamatAleta(nomor, loc) {
    const l = loc || location;
    if (!loc && typeof t7AlamatAleta === "function") {
      try {
        return t7AlamatAleta(nomor);
      } catch {
        /* jatuh ke susunan sendiri */
      }
    }
    return `${l.origin}/aleta/aleta-ecourt?perkara=${encodeURIComponent(String(nomor || ""))}`;
  }

  /** Nomor dari hash serah terima ABT; "" bila tidak ada atau bentuknya bukan nomor perkara. */
  function bacaSerahDariHash(hash) {
    const h = String(hash || "");
    const i = h.indexOf(HASH_SERAH);
    if (i < 0) return "";
    let nomor = "";
    try {
      nomor = decodeURIComponent(h.slice(i + HASH_SERAH.length).split("&")[0] || "");
    } catch {
      return "";
    }
    return POLA_NOMOR_PENUH.test(nomor) ? nomor : "";
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Nomor perkara di halaman SIPP
  // ──────────────────────────────────────────────────────────────────────────
  /** Halaman detil: baris "Nomor Perkara" tab Data Umum (sama dengan nomorUtamaHalamanPerkara konten.js). */
  function nomorHalamanDetil(doc) {
    const d = doc || document;
    for (const sel of Array.from(d.querySelectorAll("td, th"))) {
      if (milikAleta(sel)) continue;
      if (!LABEL_NOMOR.test(sebaris(sel.textContent))) continue;
      let isi = sel.nextElementSibling;
      if (isi && /^:?$/.test(sebaris(isi.textContent))) isi = isi.nextElementSibling || isi;
      const m = isi ? POLA_NOMOR.exec(teksSipp(isi)) : null;
      if (m) return m[1];
    }
    if (typeof cariNomorPerkara === "function" && d === document) {
      try {
        const n = cariNomorPerkara();
        if (n && POLA_NOMOR_PENUH.test(n)) return n;
      } catch {
        /* konten.js belum siap */
      }
    }
    return "";
  }

  /** Kolom "Nomor Perkara" sebuah tabel daftar (-1 = tidak dikenal; dipakai sel pertama yang memuat nomor). */
  function kolomNomor(tabel) {
    for (const tr of Array.from(tabel.querySelectorAll("tr")).slice(0, 4)) {
      const sel = Array.from(tr.children);
      const i = sel.findIndex((c) => /^nomor\s+perkara$/i.test(sebaris(teksSipp(c))));
      if (i >= 0) return i;
    }
    return -1;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // J01/J02 - tombol di tiap perkara
  // ──────────────────────────────────────────────────────────────────────────
  function tulisSerah(nomor) {
    void tulisPenyimpanan({ [KUNCI_SERAH]: { nomor: String(nomor || ""), saat: Date.now() } });
  }

  function buatTautan(nomor, besar) {
    const w = el(besar ? "td" : "span", `${KELAS} ${besar ? "aleta-l1-submenu" : "aleta-l1-tautan"}`);
    w.setAttribute("data-l1-nomor", nomor || "");
    const kelasA = besar ? "btn btn-default btn-sm aleta-l1-tombol-sipp" : "aleta-l1-chip";
    const abt = el("a", kelasA, besar ? "Buka di ABT" : "ABT");
    abt.setAttribute("data-l1", "abt");
    abt.target = "_blank";
    abt.rel = "noopener";
    abt.title = "Buka di ABT: Blangko ABT by Derry Briantono langsung di perkara ini (tab baru)";
    abt.addEventListener("click", (e) => {
      const n = w.getAttribute("data-l1-nomor");
      if (!n) {
        e.preventDefault();
        return;
      }
      tulisSerah(n);
    });
    const aleta = el("a", kelasA, besar ? "Buka di ALETA" : "ALETA");
    aleta.setAttribute("data-l1", "aleta");
    aleta.target = "_blank";
    aleta.rel = "noopener";
    aleta.title = "Buka di ALETA: perkara ini di portal ALETA (tab baru)";
    aleta.addEventListener("click", (e) => {
      if (!w.getAttribute("data-l1-nomor")) e.preventDefault();
    });
    if (besar) {
      abt.style.marginLeft = "3px";
      aleta.style.marginLeft = "3px";
    }
    w.append(abt, aleta);
    setelNomorTautan(w, nomor);
    return w;
  }

  function setelNomorTautan(w, nomor) {
    const n = String(nomor || "");
    if (w.getAttribute("data-l1-nomor") === n && w.hasAttribute("data-l1-siap")) return;
    w.setAttribute("data-l1-nomor", n);
    w.setAttribute("data-l1-siap", "");
    const abt = w.querySelector('[data-l1="abt"]');
    const aleta = w.querySelector('[data-l1="aleta"]');
    if (n) {
      abt.href = alamatAbtUntuk(n);
      aleta.href = alamatAleta(n);
      abt.removeAttribute("aria-disabled");
      aleta.removeAttribute("aria-disabled");
    } else {
      abt.removeAttribute("href");
      aleta.removeAttribute("href");
      abt.setAttribute("aria-disabled", "true");
      aleta.setAttribute("aria-disabled", "true");
      abt.title = "Nomor perkara belum terbaca di halaman ini (tunggu tab Data Umum termuat)";
      aleta.title = abt.title;
    }
  }

  function pasangTautanDaftar(doc) {
    let jumlah = 0;
    for (const tabel of Array.from(doc.querySelectorAll(TABEL_DAFTAR))) {
      const kol = kolomNomor(tabel);
      for (const tr of Array.from(tabel.querySelectorAll("tr"))) {
        const sel = Array.from(tr.children).filter((c) => c.tagName === "TD");
        if (!sel.length) continue;
        const calon = kol >= 0 && sel[kol] ? [sel[kol]] : sel.slice(0, 3);
        for (const c of calon) {
          const m = POLA_NOMOR.exec(teksSipp(c));
          if (!m) continue;
          if (!c.querySelector(".aleta-l1-tautan")) {
            c.appendChild(buatTautan(m[1], false));
            jumlah += 1;
          }
          break;
        }
      }
    }
    return jumlah;
  }

  function pasangTautanDetil(doc) {
    const kembali = doc.querySelector("#submenus td#backlist");
    const tr = kembali && kembali.parentElement;
    if (!tr) return false;
    const nomor = nomorHalamanDetil(doc);
    let td = tr.querySelector(":scope > .aleta-l1-submenu");
    if (!td) {
      td = buatTautan(nomor, true);
      tr.appendChild(td);
    } else setelNomorTautan(td, nomor);
    return true;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // I01 / J08 - menghitung kolom borang
  // ──────────────────────────────────────────────────────────────────────────
  function labelBaris(e) {
    const tr = e.closest("tr");
    if (!tr) return e.getAttribute("name") || e.id || "kolom";
    const sel = tr.querySelector("td#first-child") || tr.querySelector("td, th");
    const t = sebaris(sel && sel !== e.closest("td") ? teksSipp(sel) : "").replace(/\*\s*$/, "").trim();
    return t || e.getAttribute("name") || e.id || "kolom";
  }
  function wajibBaris(e) {
    const tr = e.closest("tr");
    const sel = tr && (tr.querySelector("td#first-child") || tr.querySelector("td"));
    if (!sel || sel === e.closest("td")) return false;
    return Array.from(sel.querySelectorAll("font, span")).some((f) => /\*/.test(f.textContent || "") && /red|#f00|#ff0000/i.test(`${f.getAttribute("color") || ""} ${f.getAttribute("style") || ""}`));
  }
  /** Isi editor CKEditor (bingkai di sebelah textarea yang disembunyikan). null = bukan CKEditor. */
  function isiCkeditor(ta) {
    if (!ta.id) return null;
    const doc = ta.ownerDocument;
    const wadah = doc.getElementById(`cke_${ta.id}`);
    if (!wadah) return null;
    const bingkai = wadah.querySelector("iframe");
    try {
      const badan = bingkai && bingkai.contentDocument && bingkai.contentDocument.body;
      if (badan) return { wadah, teks: sebaris(badan.textContent) };
    } catch {
      /* bingkai lain asal: pakai nilai textarea */
    }
    return { wadah, teks: sebaris(ta.value) };
  }
  function pilihanKosong(s) {
    const v = String(s.value == null ? "" : s.value).trim();
    if (v === "" || v === "-1") return true;
    const o = s.options && s.selectedIndex >= 0 ? s.options[s.selectedIndex] : null;
    return Boolean(o && /^\s*(?:-+\s*)?pilih\b/i.test(o.textContent || ""));
  }

  /**
   * Kolom borang yang tampak: { jumlah, terisi, wajib, wajibTerisi, kosong:[{el,label,wajib}] }.
   * Radio sekelompok = satu kolom; kotak centang bernama "x[]" = satu kolom
   * (terisi bila satu dicentang); kotak centang tunggal tidak dihitung.
   */
  function hitungKolom(form) {
    const hasil = { jumlah: 0, terisi: 0, wajib: 0, wajibTerisi: 0, kosong: [] };
    const kelompok = new Map();
    for (const e of Array.from(form.querySelectorAll("input, select, textarea"))) {
      if (milikAleta(e) || e.disabled) continue;
      // Tanpa name = tidak ikut terkirim (mis. select#template_amar "Pilih amar" - pemilih templat, bukan kolom).
      if (!e.getAttribute("name")) continue;
      const jenis = String(e.type || e.tagName).toLowerCase();
      if (["hidden", "button", "submit", "reset", "file", "image"].includes(jenis)) continue;
      let terisi;
      let sasaran = e;
      if (e.tagName === "TEXTAREA") {
        const cke = isiCkeditor(e);
        if (cke) {
          if (!tampak(cke.wadah)) continue;
          terisi = cke.teks !== "";
          sasaran = cke.wadah;
        } else {
          if (!tampak(e)) continue;
          terisi = sebaris(e.value) !== "";
        }
      } else if (jenis === "radio" || jenis === "checkbox") {
        const nama = e.getAttribute("name") || "";
        if (jenis === "checkbox" && !/\[\]$/.test(nama)) continue;
        if (!nama || !tampak(e)) continue;
        const k = kelompok.get(nama) || { el: e, terisi: false };
        k.terisi = k.terisi || e.checked;
        kelompok.set(nama, k);
        continue;
      } else if (e.tagName === "SELECT") {
        if (!tampak(e)) continue;
        terisi = !pilihanKosong(e);
      } else {
        if (!tampak(e)) continue;
        terisi = sebaris(e.value) !== "";
      }
      catat(hasil, e, sasaran, terisi);
    }
    for (const k of kelompok.values()) catat(hasil, k.el, k.el, k.terisi);
    return hasil;
  }
  function catat(hasil, e, sasaran, terisi) {
    const wajib = wajibBaris(e);
    hasil.jumlah += 1;
    if (wajib) hasil.wajib += 1;
    if (terisi) {
      hasil.terisi += 1;
      if (wajib) hasil.wajibTerisi += 1;
    } else hasil.kosong.push({ el: sasaran, label: labelBaris(e), wajib });
  }
  function kalimatHitung(h) {
    if (!h.jumlah) return "Tidak ada kolom yang tampak";
    const bagian = [];
    if (h.wajib) bagian.push(`wajib terisi ${h.wajibTerisi} dari ${h.wajib}`);
    bagian.push(`${h.terisi} dari ${h.jumlah} kolom terisi`);
    return bagian.join(" · ");
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Panel ALETA (konten.js) - mesin usulan yang sudah ada
  // ──────────────────────────────────────────────────────────────────────────
  const panelAleta = () => document.getElementById(ID_PANEL);
  function kotakPanel(kunci) {
    const p = panelAleta();
    return p ? p.querySelector(`.aleta-bagian[data-kunci="${kunci}"]`) : null;
  }
  function bukaDiPanel(kunci) {
    const panel = panelAleta();
    if (!panel) return false;
    try {
      if (typeof t7Buka === "function") t7Buka({ panel }, kunci);
      else if (typeof bukaBagianPanel === "function") bukaBagianPanel(panel, kunci);
    } catch {
      /* membuka hanya kenyamanan */
    }
    const k = kotakPanel(kunci);
    if (k && typeof k.scrollIntoView === "function") {
      try {
        k.scrollIntoView({ block: "nearest" });
      } catch {
        /* gulir hanya kenyamanan */
      }
    }
    return Boolean(k);
  }
  function tombolPanel(kotak, pola) {
    if (!kotak || !pola) return null;
    return Array.from(kotak.querySelectorAll("button")).find((b) => pola.test(sebaris(b.textContent))) || null;
  }
  const bentukBerkas = (nama) => (String(nama || "").toLowerCase().match(/\.([a-z0-9]+)$/) || [])[1] || "";

  /** Pemilih naskah Putusan otomatis (bagianIsiPutusan: .aleta-unggah-naskah > .aleta-tetap-kaki > input). */
  function pemilihNaskah(kotak) {
    if (!kotak) return null;
    return kotak.querySelector(".aleta-unggah-naskah .aleta-tetap-kaki input[type='file']") || kotak.querySelector(".aleta-unggah-naskah input[type='file']");
  }
  /** Bentuk yang diterima pemilih panel (Lama: .rtf,.txt; Baru & UI Baru: + docx/doc/pdf). */
  function terimaPemilih(pemilih) {
    return String((pemilih && pemilih.accept) || "")
      .split(",")
      .map((x) => x.trim().replace(/^\./, "").toLowerCase())
      .filter(Boolean);
  }

  /**
   * Usulan Putusan otomatis yang sedang tergambar di panel, dibaca apa adanya.
   * Pulang { ada, baris:[{label, tanda, nada, kini, usul, kutipan, aksara, centang}], terap, sekaligus, kabar, hasil }.
   */
  function bacaUsulanPanel(kotak) {
    const kosong = { ada: false, baris: [], terap: null, sekaligus: null, kabar: "", hasil: "", hasilGagal: false, kabarGagal: false };
    if (!kotak) return kosong;
    const isi = kotak.querySelector(".aleta-bagian-isi") || kotak;
    const kabarEl = Array.from(isi.children).find((c) => c.classList && c.classList.contains("aleta-abt-kabar")) || null;
    const wadah = isi.querySelector(".aleta-isian-putusan");
    const baris = [];
    for (const kartu of wadah ? Array.from(wadah.children).filter((c) => c.classList.contains("aleta-abt-kartu")) : []) {
      const nama = kartu.querySelector(".aleta-abt-nama");
      const centang = kartu.querySelector(".aleta-abt-kartu-kepala > input.aleta-abt-centang");
      const tanda = kartu.querySelector(".aleta-abt-kartu-kepala > .aleta-tanda");
      const kini = kartu.querySelector(".aleta-abt-kini .aleta-abt-isi");
      const usul = kartu.querySelector(".aleta-abt-usul .aleta-abt-isi");
      const sunting = kartu.querySelector("textarea.aleta-sunting");
      const kutip = kartu.querySelector(".aleta-abt-kutipan .aleta-abt-kalimat");
      const kelasTanda = tanda ? String(tanda.className || "") : "";
      baris.push({
        label: sebaris(nama && nama.textContent),
        tanda: sebaris(tanda && tanda.textContent),
        nada: /hijau/.test(kelasTanda) ? "hijau" : /merah/.test(kelasTanda) ? "merah" : /kuning/.test(kelasTanda) ? "kuning" : tanda ? "abu" : "",
        kini: kini ? sebaris(kini.textContent) : null,
        usul: usul ? sebaris(usul.textContent) : null,
        kutipan: sebaris(kutip && kutip.textContent),
        aksara: sunting ? String(sunting.value || "").trim().length : null,
        centang,
      });
    }
    const hasilEl = wadah ? Array.from(wadah.querySelectorAll(":scope > .aleta-abt-kabar")).pop() || null : null;
    const terap = wadah ? Array.from(wadah.querySelectorAll("button")).find((b) => /isikan yang dicentang/i.test(sebaris(b.textContent))) || null : null;
    const barisSekaligus = kotak.querySelector(".aleta-a30-sekaligus");
    const sekaligus =
      barisSekaligus && barisSekaligus.style.display !== "none"
        ? { centang: barisSekaligus.querySelector("input[type='checkbox']"), teks: sebaris(barisSekaligus.textContent) }
        : null;
    return {
      ada: baris.length > 0,
      baris,
      terap,
      sekaligus,
      kabar: sebaris(kabarEl && kabarEl.textContent),
      kabarGagal: Boolean(kabarEl && kabarEl.classList.contains("aleta-abt-gagal")),
      hasil: sebaris(hasilEl && hasilEl.textContent),
      hasilGagal: Boolean(hasilEl && hasilEl.classList.contains("aleta-abt-gagal")),
    };
  }

  /** e-Doc di tab Putusan (putusan_akhir.php): "ada" | "belum" | "" (tidak terbaca). */
  function bacaEdocTabPutusan(doc) {
    const hasil = { putusan: "", anonimisasi: "" };
    const tab = (doc || document).querySelector("#tabs10");
    if (!tab) return hasil;
    for (const sel of Array.from(tab.querySelectorAll("td#first-child, td"))) {
      const label = sebaris(sel.textContent);
      // 7.0.4 sungguhan: "E-Doc Putusan Akhir" / "E-Doc Putusan Anonimisasi" (kode 6.2.4: "E-Doc <status>").
      const slot = /^e-doc\s+(?:putusan|penetapan)(?:\s+akhir)?\s+anonimisasi$/i.test(label)
        ? "anonimisasi"
        : /^e-doc\s+(?:putusan|penetapan)(?:\s+akhir)?$/i.test(label)
          ? "putusan"
          : "";
      if (!slot || hasil[slot]) continue;
      const isi = sel.nextElementSibling;
      if (!isi) continue;
      const tautan = Array.from(isi.querySelectorAll("a")).some((a) => /unduh\s+dokumen/i.test(a.textContent || ""));
      hasil[slot] = tautan ? "ada" : BELUM_ADA.test(isi.textContent || "") ? "belum" : "";
    }
    return hasil;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Gaya
  // ──────────────────────────────────────────────────────────────────────────
  // Rupa mengikuti rancangan "SIPP dengan Ide ALETA" (pita .ide-isi, lencana bulat
  // berwarna dengan ikon i) dan tema SIPP 7.0.4 (hijau #008C4B / #007640); huruf
  // mengikuti SIPP (font-family & ukuran inherit), tidak lebih kecil (M1, 16 Okt).
  const GAYA = `
.aleta-l1-tautan{display:inline-flex;gap:4px;margin-left:6px;vertical-align:middle;white-space:nowrap}
.aleta-l1-chip{display:inline-block;padding:0 9px;border:1px solid #235b3e;border-radius:999px;font-size:inherit;font-family:inherit;line-height:1.6;font-weight:600;color:#fff!important;text-decoration:none!important;background:#16704a;cursor:pointer}
.aleta-l1-chip:hover{background:#007640}
.aleta-l1-chip[aria-disabled="true"],.aleta-l1-tombol-sipp[aria-disabled="true"]{opacity:.5;cursor:default}
.aleta-l1-pita{clear:both;margin:4px 0 8px;padding:6px 10px;background:rgba(47,158,68,.12);border-left:3px solid #2f9e44;font-family:inherit;font-size:inherit;color:#333;text-align:left;line-height:1.5;letter-spacing:0}
.aleta-l1-baris{display:flex;flex-wrap:wrap;gap:6px 8px;align-items:center}
.aleta-l1-logo{display:inline-block;background:#007640;color:#fff;border-radius:999px;padding:0 9px;font-weight:700}
.aleta-l1-judul{font-weight:600;color:#008c4b;margin-right:2px}
.aleta-l1-tombol{font-family:inherit;font-size:inherit;padding:3px 12px;border:1px solid #c9d4ce;border-radius:999px;background:#fff;color:#333;cursor:pointer;line-height:1.4}
.aleta-l1-tombol.aleta-l1-utama{background:#007640;border-color:#007640;color:#fff;border-radius:3px;font-weight:600}
.aleta-l1-tombol:disabled{opacity:.55;cursor:default}
.aleta-l1-hitung{display:inline-block;padding:1px 10px;border-radius:999px;background:#16704a;border:1px solid #235b3e;color:#fff;font-weight:600;cursor:pointer}
.aleta-l1-hitung.aleta-l1-ada-kosong{background:#9a5b06;border-color:#74440a}
.aleta-l1-kabar{margin-top:4px;color:#333}
.aleta-l1-kabar:empty{display:none}
.aleta-l1-kabar.aleta-l1-gagal,.aleta-l1-gagal{color:#b42318;font-weight:600}
.aleta-l1-unggah{margin-top:6px;padding:6px 8px;border:1px dashed #2f9e44;border-radius:4px;background:#fff}
.aleta-l1-unggah.aleta-l1-seret{background:#e3f3e6;border-color:#007640}
.aleta-l1-tabel{width:100%;border-collapse:collapse;margin-top:6px;background:#fff;font-family:inherit;font-size:inherit}
.aleta-l1-tabel td,.aleta-l1-tabel th{border:1px solid #d6e4d8;padding:3px 6px;font-size:inherit;vertical-align:top;text-align:left}
.aleta-l1-tabel th{background:#008c4b;color:#fff;font-weight:400}
.aleta-l1-yakin{display:inline-flex;align-items:center;gap:5px;padding:1px 9px;border-radius:999px;font-weight:600;white-space:nowrap;line-height:1.6;background:#6b7a72;border:1px solid #6b7a72;color:#fff}
.aleta-l1-yakin::after{content:"i";display:inline-block;width:14px;height:14px;border-radius:50%;border:1px solid currentColor;font:italic 700 10px/12px Georgia,serif;text-align:center;opacity:.9}
.aleta-l1-yakin-hijau{background:#16704a;border-color:#235b3e}.aleta-l1-yakin-kuning{background:#9a5b06;border-color:#74440a}.aleta-l1-yakin-merah{background:#b42318;border-color:#8a1c13}
.aleta-l1-beda{color:#8a4b00}
.aleta-l1-awas{margin:4px 0;padding:3px 9px;border-left:3px solid #f59e0b;background:rgba(245,158,11,.12);color:#5c3d00}
.aleta-l1-kecil{color:#555}
.aleta-l1-sorot{outline:2px solid #e0a800!important;outline-offset:1px}
.aleta-l1-kosong-chip{margin-right:6px;font-family:inherit;font-size:inherit;padding:2px 10px;border:1px solid #74440a;border-radius:999px;background:#9a5b06;color:#fff;font-weight:600;cursor:pointer}
.aleta-l1-toast{position:fixed;right:16px;bottom:16px;z-index:2147483000;max-width:380px;padding:9px 12px;border-radius:6px;background:#007640;color:#fff;font-family:inherit;font-size:14px;box-shadow:0 2px 10px rgba(0,0,0,.3)}
html[data-aleta-tema-sipp="gelap"] .aleta-l1-pita{background:rgba(47,158,68,.10);color:#dfe8e2}
html[data-aleta-tema-sipp="gelap"] .aleta-l1-tombol.aleta-l1-utama,html[data-aleta-tema-sipp="gelap"] .aleta-l1-chip,html[data-aleta-tema-sipp="gelap"] .aleta-l1-logo{background:#1c5539;border-color:#1c5539}
html[data-aleta-tema-sipp="gelap"] .aleta-l1-judul{color:#7fd0a6}
html[data-aleta-tema-sipp="gelap"] .aleta-l1-tombol,html[data-aleta-tema-sipp="gelap"] .aleta-l1-unggah,html[data-aleta-tema-sipp="gelap"] .aleta-l1-tabel{background:#17211c;color:#dfe8e2;border-color:#27342e}
html[data-aleta-tema-sipp="gelap"] .aleta-l1-tabel td,html[data-aleta-tema-sipp="gelap"] .aleta-l1-tabel th{border-color:#27342e}
html[data-aleta-tema-sipp="gelap"] .aleta-l1-tabel th{background:#143c29}
html[data-aleta-tema-sipp="gelap"] .aleta-l1-kabar,html[data-aleta-tema-sipp="gelap"] .aleta-l1-kecil{color:#c9d8e6}
html[data-aleta-tema-sipp="gelap"] .aleta-l1-awas{color:#f3e2b5}
`;
  function sisipkanGaya(doc) {
    if (doc.getElementById(ID_GAYA)) return;
    const s = doc.createElement("style");
    s.id = ID_GAYA;
    s.className = KELAS;
    s.textContent = GAYA;
    (doc.head || doc.documentElement).appendChild(s);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // I01 - pita di jendela
  // ──────────────────────────────────────────────────────────────────────────
  const pitaHidup = new Set();
  let detak = null;

  function kenaliJendela(form) {
    for (const j of JENDELA) {
      try {
        if (j.cocok(form)) return j;
      } catch {
        /* lanjut */
      }
    }
    return null;
  }

  /** Sumber usulan yang tersedia SEKARANG untuk jendela ini (bagian panel atau kartu di jendela). */
  function sumberUsulan(form, j) {
    if (j.bagian && kotakPanel(j.bagian)) return "panel";
    if (j.dalam) {
      const wadah = form.parentElement || form;
      if (form.querySelector(j.dalam) || (wadah && wadah.querySelector(j.dalam))) return "jendela";
    }
    return "";
  }

  function sorot(daftar) {
    for (const k of daftar) {
      try {
        k.el.classList.add("aleta-l1-sorot");
        setTimeout(() => k.el.classList.remove("aleta-l1-sorot"), 2600);
      } catch {
        /* sorot hanya kenyamanan */
      }
    }
  }
  function loncatKosong(p) {
    const h = hitungKolom(p.form);
    const urut = h.kosong.filter((k) => k.wajib).concat(h.kosong.filter((k) => !k.wajib));
    if (!urut.length) {
      kabar(p, "Semua kolom yang tampak sudah terisi.");
      return;
    }
    sorot(urut);
    const pertama = urut[0].el;
    try {
      pertama.scrollIntoView({ block: "center" });
    } catch {
      /* gulir hanya kenyamanan */
    }
    const fokus = pertama.matches && pertama.matches("input, select, textarea") ? pertama : pertama.querySelector && pertama.querySelector("iframe");
    try {
      if (fokus && typeof fokus.focus === "function") fokus.focus();
    } catch {
      /* fokus hanya kenyamanan */
    }
    kabar(
      p,
      `Masih kosong: ${urut
        .slice(0, 8)
        .map((k) => `${k.label}${k.wajib ? " (wajib)" : ""}`)
        .join(", ")}${urut.length > 8 ? `, dan ${urut.length - 8} lagi` : ""}.`
    );
  }

  function kabar(p, teks, gagal) {
    if (!p || !p.kabar) return;
    setelTeks(p.kabar, teks || "");
    p.kabar.classList.toggle("aleta-l1-gagal", Boolean(gagal));
  }

  function isiDenganAleta(p) {
    const j = p.jendela;
    if (j.bagian) {
      const kotak = kotakPanel(j.bagian);
      if (!kotak) {
        kabar(p, "Usulan ALETA untuk jendela ini belum termuat di panel (panel belum siap atau akun ini tidak berwenang).", true);
        return;
      }
      bukaDiPanel(j.bagian);
      const t = tombolPanel(kotak, j.tombol);
      if (j.tombol && t) {
        if (t.disabled) {
          kabar(p, "ALETA sedang menyusun usulan - tunggu sebentar.");
          return;
        }
        t.click();
        kabar(
          p,
          j.unggah
            ? "Membaca draf putusan ALETA untuk perkara ini. Usulannya tampil di bawah dan di panel; periksa, lalu tekan Isikan, lalu Simpan."
            : "Usulan ALETA disusun di panel kanan. Periksa dan centang yang dipakai, lalu Isikan. Tombol Simpan SIPP tetap Anda yang menekan."
        );
        return;
      }
      kabar(p, "Usulan ALETA untuk jendela ini ada di panel kanan (bagian yang baru dibuka). Simpan/Tetapkan tetap Anda yang menekan.");
      return;
    }
    if (j.dalam) {
      const wadah = p.form.parentElement || p.form;
      const kartu = p.form.querySelector(j.dalam) || wadah.querySelector(j.dalam);
      if (kartu) {
        try {
          kartu.scrollIntoView({ block: "center" });
        } catch {
          /* gulir hanya kenyamanan */
        }
        sorot([{ el: kartu }]);
        kabar(p, "Kartu ALETA untuk jendela ini ada di sini (foto KTP / bantu data saksi). Isian yang pasti diisi otomatis; Simpan tetap Anda yang menekan.");
      }
    }
  }

  function bangunPita(form, j) {
    const pita = el("div", `${KELAS} aleta-l1-pita`);
    pita.setAttribute("data-l1-jendela", j.kode);
    const baris = el("div", "aleta-l1-baris");
    const judul = el("span", "aleta-l1-judul", j.judul);
    const logo = el("span", "aleta-l1-logo", "ALETA");
    const hitung = el("span", "aleta-l1-hitung", "…");
    hitung.setAttribute("data-l1", "hitung");
    hitung.title = "Klik untuk melompat ke kolom yang masih kosong";
    const tIsi = tombol("Isi dengan ALETA", "Isi jendela ini dengan usulan ALETA - kolom yang pasti diisi, yang ragu diberi tanda; Simpan tetap Anda yang menekan", "aleta-l1-utama");
    tIsi.setAttribute("data-l1", "isi");
    const tKosong = tombol("Loncat ke yang kosong", "Sorot dan lompat ke kolom yang masih kosong (wajib lebih dulu)");
    tKosong.setAttribute("data-l1", "kosong");
    baris.append(logo, judul, tIsi, hitung, tKosong);
    const kabarEl = el("div", "aleta-l1-kabar");
    kabarEl.setAttribute("data-l1", "kabar");
    kabarEl.setAttribute("aria-live", "polite");
    pita.append(baris, kabarEl);

    const p = { form, jendela: j, pita, hitung, kabar: kabarEl, tIsi, chip: null, putusan: null };
    tIsi.addEventListener("click", () => isiDenganAleta(p));
    tKosong.addEventListener("click", () => loncatKosong(p));
    hitung.addEventListener("click", () => loncatKosong(p));
    if (j.unggah) p.putusan = bangunPutusan(p);

    // Penghitung kecil tepat sebelum Simpan (K-PETA: sisipan dalam form WAJIB type="button").
    const simpan = form.querySelector("#simpan, #simpan_btn");
    if (simpan && simpan.parentNode) {
      const chip = el("button", `${KELAS} aleta-l1-kosong-chip`, "");
      chip.type = "button";
      chip.setAttribute("data-l1", "chip");
      chip.title = "Kolom yang masih kosong - klik untuk melompat ke sana";
      chip.hidden = true;
      chip.addEventListener("click", () => loncatKosong(p));
      simpan.parentNode.insertBefore(chip, simpan);
      p.chip = chip;
    }
    if (!form.__aletaL1Dengar) {
      form.__aletaL1Dengar = true;
      const segar = () => {
        const kini = form.__aletaL1;
        if (kini && kini.pita.isConnected) segarkanHitung(kini);
      };
      form.addEventListener("input", segar);
      form.addEventListener("change", segar);
    }
    return p;
  }

  function segarkanHitung(p) {
    const h = hitungKolom(p.form);
    setelTeks(p.hitung, kalimatHitung(h));
    const adaKosongWajib = h.wajib ? h.wajibTerisi < h.wajib : h.terisi < h.jumlah;
    p.hitung.classList.toggle("aleta-l1-ada-kosong", adaKosongWajib);
    if (p.chip) {
      const nKosong = h.kosong.filter((k) => k.wajib).length;
      p.chip.hidden = nKosong === 0;
      setelTeks(p.chip, nKosong ? `${nKosong} kolom wajib kosong` : "");
    }
    return h;
  }

  function segarkanPita(p) {
    const sumber = sumberUsulan(p.form, p.jendela);
    p.pita.hidden = !sumber;
    if (p.chip && !sumber) p.chip.hidden = true;
    if (!sumber) return;
    segarkanHitung(p);
    const kotak = p.jendela.bagian ? kotakPanel(p.jendela.bagian) : null;
    const t = kotak ? tombolPanel(kotak, p.jendela.tombol) : null;
    p.tIsi.disabled = Boolean(t && t.disabled);
    if (p.putusan) segarkanPutusan(p);
  }

  function pasangPita(form) {
    if (form.__aletaL1) {
      if (form.__aletaL1.pita.isConnected) return form.__aletaL1;
      // Pita terlepas (jendela digambar ulang): dibuat lagi di bawah.
    }
    const j = kenaliJendela(form);
    if (!j || !form.parentNode) return null;
    const p = bangunPita(form, j);
    form.parentNode.insertBefore(p.pita, form);
    form.__aletaL1 = p;
    pitaHidup.add(p);
    segarkanPita(p);
    mulaiDetak();
    return p;
  }

  /** Satu detak: pita yang masih terpasang diselaraskan dengan borang dan panel. Pulang jumlah pita hidup. */
  function segarkanSemua() {
    for (const p of Array.from(pitaHidup)) {
      if (!p.pita.isConnected || !p.form.isConnected) {
        pitaHidup.delete(p);
        continue;
      }
      try {
        segarkanPita(p);
      } catch {
        /* satu pita gagal tidak menghentikan yang lain */
      }
    }
    return pitaHidup.size;
  }

  function mulaiDetak() {
    if (detak) return;
    detak = setInterval(() => {
      if (segarkanSemua()) return;
      clearInterval(detak);
      detak = null;
    }, DETAK_MS);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // I02-I05 - Putusan Akhir: unggah berkas, usulan semua kolom, Simpan + e-Doc
  // ──────────────────────────────────────────────────────────────────────────
  function bangunPutusan(p) {
    const unggah = el("div", "aleta-l1-unggah");
    unggah.setAttribute("data-l1", "unggah");
    const label = el("label", "aleta-l1-kecil");
    label.appendChild(el("b", "", "Unggah berkas putusan "));
    label.appendChild(document.createTextNode("(RTF, DOCX, DOC, atau PDF) - ALETA membacanya lalu mengusulkan seluruh kolom di bawah. "));
    const pemilih = document.createElement("input");
    pemilih.type = "file";
    pemilih.accept = BENTUK_NASKAH.map((x) => `.${x}`).join(",");
    pemilih.setAttribute("data-l1", "berkas");
    label.appendChild(pemilih);
    unggah.append(label, el("span", "aleta-l1-kecil", " Bisa juga: taruh berkasnya di kotak ini."));
    const usulan = el("div", "aleta-l1-usulan");
    usulan.setAttribute("data-l1", "usulan");
    const edoc = el("div", "aleta-l1-edoc aleta-l1-kecil");
    edoc.setAttribute("data-l1", "edoc");
    const aksi = el("div", "aleta-l1-baris");
    aksi.setAttribute("data-l1", "aksi");
    aksi.style.marginTop = "6px";
    const labelSekaligus = el("label", "aleta-l1-kecil");
    const cekSekaligus = document.createElement("input");
    cekSekaligus.type = "checkbox";
    cekSekaligus.setAttribute("data-l1", "sekaligus");
    labelSekaligus.append(cekSekaligus, document.createTextNode(" Sesudah tersimpan, unggah juga e-Doc putusan + anonimisasinya"));
    labelSekaligus.hidden = true;
    const tTerap = tombol("Isikan, lalu Simpan", "Isikan kolom yang dicentang ke jendela ini, lalu Simpan SIPP ditekan sesudah semuanya terisi (sama dengan tombol Isikan di panel)", "aleta-l1-utama");
    tTerap.setAttribute("data-l1", "terap");
    tTerap.disabled = true;
    const tPanel = tombol("Lihat di panel", "Buka bagian Putusan otomatis di panel ALETA (teks pertimbangan/amar dapat disunting di sana)");
    tPanel.setAttribute("data-l1", "panel");
    aksi.append(labelSekaligus, tTerap, tPanel);
    p.pita.append(unggah, usulan, edoc, aksi);

    const st = { pemilih, unggah, usulan, edoc, aksi, cekSekaligus, labelSekaligus, tTerap, tPanel, sidik: "", naskah: null };
    pemilih.addEventListener("change", () => {
      const f = pemilih.files && pemilih.files[0];
      pemilih.value = "";
      if (f) teruskanNaskah(p, f);
    });
    unggah.addEventListener("dragover", (e) => {
      e.preventDefault();
      unggah.classList.add("aleta-l1-seret");
    });
    unggah.addEventListener("dragleave", () => unggah.classList.remove("aleta-l1-seret"));
    unggah.addEventListener("drop", (e) => {
      e.preventDefault();
      unggah.classList.remove("aleta-l1-seret");
      const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (f) teruskanNaskah(p, f);
    });
    tPanel.addEventListener("click", () => bukaDiPanel("isiPutusan"));
    cekSekaligus.addEventListener("change", () => {
      const u = bacaUsulanPanel(kotakPanel("isiPutusan"));
      if (u.sekaligus && u.sekaligus.centang && u.sekaligus.centang.checked !== cekSekaligus.checked) {
        u.sekaligus.centang.checked = cekSekaligus.checked;
        u.sekaligus.centang.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });
    tTerap.addEventListener("click", () => terapPutusan(p));
    return st;
  }

  /** I02: berkas diteruskan ke pemilih naskah Putusan otomatis - jalur baca, konversi, anonimisasi yang sama. */
  function teruskanNaskah(p, berkas) {
    const kotak = kotakPanel("isiPutusan");
    const pemilih = pemilihNaskah(kotak);
    if (!kotak || !pemilih) {
      kabar(p, "Putusan otomatis ALETA belum termuat di panel untuk perkara ini (panel belum siap, atau akun ini tidak berhak mengisi putusan).", true);
      return { ok: false, sebab: "tanpa-panel" };
    }
    const bentuk = bentukBerkas(berkas.name);
    const terima = terimaPemilih(pemilih);
    if (!BENTUK_NASKAH.includes(bentuk) || (terima.length && !terima.includes(bentuk))) {
      kabar(
        p,
        terima.length && !terima.includes(bentuk) && BENTUK_NASKAH.includes(bentuk)
          ? `Tampilan ALETA ini hanya menerima ${terima.map((x) => x.toUpperCase()).join("/")}; ${berkas.name} belum dapat dibaca. Pilih berkas RTF-nya.`
          : `${berkas.name} bukan berkas putusan yang dapat dibaca (RTF, DOCX, DOC, atau PDF).`,
        true
      );
      return { ok: false, sebab: "bentuk" };
    }
    try {
      const dt = new DataTransfer();
      dt.items.add(berkas);
      pemilih.files = dt.files;
    } catch {
      kabar(p, "Peramban ini tidak dapat meneruskan berkas. Pilih berkasnya di bagian Putusan otomatis panel ALETA.", true);
      bukaDiPanel("isiPutusan");
      return { ok: false, sebab: "datatransfer" };
    }
    pemilih.dispatchEvent(new Event("change", { bubbles: true }));
    p.putusan.naskah = berkas.name;
    p.putusan.sidik = "";
    bukaDiPanel("isiPutusan");
    kabar(p, `Membaca ${berkas.name}… Usulan seluruh kolom akan tampil di sini.`);
    return { ok: true };
  }

  const NADA_YAKIN = { hijau: "aleta-l1-yakin-hijau", kuning: "aleta-l1-yakin-kuning", merah: "aleta-l1-yakin-merah", abu: "" };

  function segarkanPutusan(p) {
    const st = p.putusan;
    const kotak = kotakPanel("isiPutusan");
    const u = bacaUsulanPanel(kotak);
    st.pemilih.disabled = !pemilihNaskah(kotak);

    // Kabar panel dicerminkan (membaca, konversi, gagal, hasil Isikan/Simpan).
    const kabarPanel = u.hasil || u.kabar;
    if (kabarPanel && kabarPanel !== st.kabarTerakhir) {
      st.kabarTerakhir = kabarPanel;
      kabar(p, kabarPanel, u.hasil ? u.hasilGagal : u.kabarGagal);
    }

    // Tabel usulan - digambar ulang hanya bila isinya berubah.
    const sidik = JSON.stringify(u.baris.map((b) => [b.label, b.tanda, b.kini, b.usul, b.aksara, b.centang ? b.centang.disabled : null]));
    if (sidik !== st.sidik) {
      st.sidik = sidik;
      gambarUsulan(st, u);
    } else {
      // Centang saja yang berubah: diselaraskan tanpa menggambar ulang.
      Array.from(st.usulan.querySelectorAll("input[data-l1-baris]")).forEach((c) => {
        const b = u.baris[Number(c.getAttribute("data-l1-baris"))];
        if (b && b.centang) {
          c.checked = b.centang.checked;
          c.disabled = b.centang.disabled;
        }
      });
    }

    st.labelSekaligus.hidden = !u.sekaligus;
    if (u.sekaligus && u.sekaligus.centang) st.cekSekaligus.checked = u.sekaligus.centang.checked;
    st.tTerap.disabled = !u.terap || u.terap.disabled;
    st.tTerap.title = !u.terap
      ? "Usulan belum ada: tekan Isi dengan ALETA atau unggah berkas putusan"
      : u.terap.disabled
        ? "Tombol Isikan di panel sedang ditahan (sedang bekerja, atau praperiksa minta dikukuhkan dulu - lihat panel)"
        : "Isikan kolom yang dicentang, lalu Simpan SIPP ditekan sesudah semuanya terisi";

    const e = bacaEdocTabPutusan(document);
    const sebut = (s) => (s === "ada" ? "sudah ada" : s === "belum" ? "belum ada" : "belum terbaca");
    setelTeks(st.edoc, `e-Doc di tab Putusan: putusan ${sebut(e.putusan)}, anonimisasi ${sebut(e.anonimisasi)}.`);
  }

  function gambarUsulan(st, u) {
    st.usulan.textContent = "";
    if (!u.ada) return;
    const tabel = el("table", "aleta-l1-tabel");
    const kepala = el("tr");
    for (const t of ["Pakai", "Kolom", "Keyakinan", "Sekarang di SIPP", "Usulan ALETA"]) kepala.appendChild(el("th", "", t));
    tabel.appendChild(kepala);
    u.baris.forEach((b, i) => {
      const tr = el("tr");
      const tdC = el("td");
      if (b.centang) {
        const c = document.createElement("input");
        c.type = "checkbox";
        c.setAttribute("data-l1-baris", String(i));
        c.checked = b.centang.checked;
        c.disabled = b.centang.disabled;
        c.addEventListener("change", () => {
          const asli = bacaUsulanPanel(kotakPanel("isiPutusan")).baris[i];
          if (!asli || !asli.centang || asli.centang.disabled) return;
          asli.centang.checked = c.checked;
          asli.centang.dispatchEvent(new Event("change", { bubbles: true }));
        });
        tdC.appendChild(c);
      }
      tr.appendChild(tdC);
      const tdL = el("td", "", b.label);
      if (b.kutipan) tdL.title = `Di berkas: ${b.kutipan}`;
      tr.appendChild(tdL);
      const tdY = el("td");
      const teksYakin = b.aksara != null ? (b.aksara ? "dari naskah" : "kosong di naskah") : b.tanda || "-";
      tdY.appendChild(el("span", `aleta-l1-yakin ${NADA_YAKIN[b.nada] || (b.aksara ? "aleta-l1-yakin-hijau" : "")}`, teksYakin));
      tr.appendChild(tdY);
      tr.appendChild(el("td", "", b.aksara != null ? "-" : b.kini || "(belum dipilih)"));
      const tdU = el("td", "", b.aksara != null ? `${b.aksara.toLocaleString("id-ID")} aksara` : b.usul || "-");
      if (b.aksara == null && b.usul && b.kini && b.kini !== "(belum dipilih)" && b.usul !== b.kini) tdU.appendChild(el("div", "aleta-l1-beda", "berbeda dari isi SIPP sekarang"));
      if (b.kutipan) tdU.appendChild(el("div", "aleta-l1-kecil", `“${b.kutipan.length > 140 ? `${b.kutipan.slice(0, 139)}…` : b.kutipan}”`));
      tr.appendChild(tdU);
      tabel.appendChild(tr);
    });
    st.usulan.appendChild(tabel);
    st.usulan.appendChild(el("div", "aleta-l1-kecil", "Teks Pertimbangan Hukum, Amar, dan Amar Anonim dapat disunting di panel (Lihat di panel). Yang tidak ditemukan dibiarkan kosong, bukan ditebak."));
  }

  /** I05: Isikan + Simpan (+ e-Doc) lewat tombol panel; e-Doc yang sudah ada ditanyakan dulu. */
  function terapPutusan(p) {
    const u = bacaUsulanPanel(kotakPanel("isiPutusan"));
    if (!u.terap) {
      kabar(p, "Usulan belum ada. Tekan Isi dengan ALETA atau unggah berkas putusan lebih dulu.", true);
      return { ok: false, sebab: "tanpa-usulan" };
    }
    if (u.terap.disabled) {
      bukaDiPanel("isiPutusan");
      kabar(p, "Tombol Isikan di panel sedang ditahan - lihat panel (praperiksa mungkin minta dikukuhkan dulu).", true);
      return { ok: false, sebab: "ditahan" };
    }
    const pakaiEdoc = Boolean(u.sekaligus && u.sekaligus.centang && u.sekaligus.centang.checked);
    if (pakaiEdoc) {
      const e = bacaEdocTabPutusan(document);
      const sudah = [e.putusan === "ada" ? "e-Doc putusan" : "", e.anonimisasi === "ada" ? "e-Doc putusan anonimisasi" : ""].filter(Boolean);
      if (sudah.length) {
        let ya = false;
        try {
          ya =
            window.confirm(
              `${sudah.join(" dan ")} perkara ini SUDAH ada di SIPP.\n\nBila dilanjutkan, berkas yang lama DIGANTI dengan berkas yang baru sesudah putusan tersimpan.\n` +
                "Pilih Batal untuk berhenti (lepas centang unggah e-Doc bila hanya ingin menyimpan putusannya)."
            ) === true;
        } catch {
          ya = false;
        }
        if (!ya) {
          kabar(p, "Dibatalkan: e-Doc yang sudah ada tidak diganti. Lepas centang unggah e-Doc bila hanya ingin menyimpan.");
          return { ok: false, sebab: "edoc-sudah-ada" };
        }
      }
    }
    u.terap.click();
    kabar(p, "Mengisikan yang dicentang. Simpan ditekan sesudah semuanya terisi; kabarnya tampil di sini.");
    return { ok: true };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Cek dobel e-Doc - jendela e-Doc SIPP (form#frm_upload_file)
  // ──────────────────────────────────────────────────────────────────────────
  /** { jenis, tersimpan } dari jendela e-Doc SIPP. tersimpan = nama berkas lama ("" = belum ada). */
  function bacaEdocJendela(form) {
    const nilai = (n) => {
      const e = form.querySelector(`input[name="${n}"]`);
      return e ? String(e.value || "").trim() : "";
    };
    const kode = (nilai("from") || nilai("form")).toLowerCase();
    let tersimpan = "";
    let terbaca = false;
    for (const sel of Array.from(form.querySelectorAll("td"))) {
      if (!/^file\s+tersimpan$/i.test(sebaris(sel.textContent))) continue;
      let isi = sel.nextElementSibling;
      if (!isi) {
        const trBerikut = sel.parentElement && sel.parentElement.nextElementSibling;
        isi = trBerikut ? trBerikut.querySelector("td") : null;
      }
      if (!isi) break;
      terbaca = true;
      const t = sebaris(isi.textContent);
      // 7.0.4 sungguhan: "Dokumen Belum Ada" (fileupload_v) dan "File E-Doc Belum Di Upload" (fileupload_putusan_v).
      tersimpan = BELUM_ADA.test(t) ? "" : t;
      break;
    }
    return { kode, jenis: JENIS_EDOC[kode] || (kode ? kode.toUpperCase() : "dokumen"), tersimpan, terbaca };
  }

  const kunciBerkas = (f) => (f ? `${f.name}|${f.size}|${f.lastModified || 0}` : "");

  function pasangCekEdoc(form) {
    if (form.__aletaL1Edoc && form.__aletaL1Edoc.isConnected) return form.__aletaL1Edoc;
    const info = bacaEdocJendela(form);
    if (!info.tersimpan || !form.parentNode) return null;
    const kotak = el("div", `${KELAS} aleta-l1-pita aleta-l1-edoc-cek`);
    kotak.setAttribute("data-l1-jendela", "edoc");
    kotak.appendChild(el("div", "aleta-l1-awas", `e-Doc ${info.jenis} perkara ini sudah ada di SIPP: ${info.tersimpan}. Berkas yang Anda simpan di sini akan MENGGANTINYA.`));
    const catatan = el("div", "aleta-l1-kabar");
    catatan.setAttribute("data-l1", "kabar");
    kotak.appendChild(catatan);
    form.parentNode.insertBefore(kotak, form);
    form.__aletaL1Edoc = kotak;
    const pemilih = form.querySelector("input[type='file']");
    if (pemilih) {
      pemilih.addEventListener("change", () => {
        const f = pemilih.files && pemilih.files[0];
        if (!f) {
          catatan.textContent = "";
          return;
        }
        const sama = sebaris(f.name).toLowerCase() === sebaris(info.tersimpan).toLowerCase();
        catatan.textContent = sama
          ? `Nama berkasnya sama dengan e-Doc yang tersimpan (${f.name}) - kemungkinan berkas yang sama (dobel). Simpan hanya bila memang hendak mengganti.`
          : `Berkas baru: ${f.name}. Saat Simpan, ALETA bertanya dulu karena e-Doc lama akan diganti.`;
        catatan.classList.toggle("aleta-l1-gagal", sama);
      });
    }
    return kotak;
  }

  /** Penjaga Simpan jendela e-Doc: dipasang sekali di dokumen, fase tangkap (sebelum SubmitHandling SIPP). */
  function saatKirim(e) {
    const form = e.target;
    if (!form || form.id !== "frm_upload_file" || !aktifSekarang()) return;
    const info = bacaEdocJendela(form);
    if (!info.tersimpan) return;
    const pemilih = form.querySelector("input[type='file']");
    const f = pemilih && pemilih.files && pemilih.files[0];
    if (!f) return;
    const k = kunciBerkas(f);
    if (form.__aletaL1Setuju === k) return;
    let ya = false;
    try {
      ya =
        window.confirm(
          `e-Doc ${info.jenis} perkara ini SUDAH ada di SIPP: ${info.tersimpan}.\n\nMenyimpan ${f.name} akan MENGGANTI berkas yang lama. Lanjutkan?`
        ) === true;
    } catch {
      ya = false;
    }
    if (ya) {
      form.__aletaL1Setuju = k;
      return;
    }
    e.preventDefault();
    e.stopImmediatePropagation();
    const catatan = form.__aletaL1Edoc && form.__aletaL1Edoc.querySelector('[data-l1="kabar"]');
    if (catatan) {
      catatan.textContent = "Tidak disimpan - e-Doc yang lama tetap.";
      catatan.classList.remove("aleta-l1-gagal");
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // ABT - menerima serah terima J01
  // ──────────────────────────────────────────────────────────────────────────
  function toast(teks) {
    const lama = document.querySelector(".aleta-l1-toast");
    if (lama) lama.remove();
    const t = el("div", `${KELAS} aleta-l1-toast`, teks);
    t.setAttribute("role", "status");
    (document.body || document.documentElement).appendChild(t);
    setTimeout(() => t.remove(), 9000);
    return t;
  }
  function tombolDerryAbt() {
    return Array.from(document.querySelectorAll("#navbar .accordion")).find((b) => /^\s*blangko\s+derry\b/i.test(String(b.textContent || ""))) || null;
  }

  /**
   * Membuka Blangko ABT by Derry Briantono di perkara `nomor`. Pulang
   * { ok, sebab }: sebab "tanpa-derry" (grup tidak ada di akun ABT ini),
   * "belum-masuk" (akun ALETA belum terbaca), "tidak-di-daftar", "tidak-terpasang".
   */
  async function serahkanKeDerry(nomor, opsi) {
    const o = opsi || {};
    const tunggu = o.tunggu || ((ms) => new Promise((r) => setTimeout(r, ms)));
    const sekarang = o.sekarang || (() => Date.now());
    const mulai = sekarang();
    const batas = mulai + (o.batasMs || 20000);
    let sudahSemua = false;
    let api = null;
    let adaTombol = false;
    while (sekarang() < batas) {
      api = globalThis.aletaBlangkoDerry || null;
      adaTombol = Boolean(tombolDerryAbt());
      if (api && adaTombol) {
        const k = api.keadaan();
        if (!k.aktif) {
          if (api.siapa()) api.buka();
        } else {
          api.pilihPerkara(nomor);
          if (api.keadaan().pk === nomor) return { ok: true };
          if (!sudahSemua && sekarang() - mulai > (o.semuaSesudahMs || 5000) && k.mode !== "semua") {
            const b = document.querySelector('#aleta-bd-akar [data-mode="semua"]');
            if (b) {
              b.click();
              sudahSemua = true;
            }
          }
        }
      } else if (!adaTombol && sekarang() - mulai > (o.tanpaDerryMs || 10000)) break;
      await tunggu(o.detakMs || 400);
    }
    if (!api) return { ok: false, sebab: "tidak-terpasang" };
    if (!adaTombol) return { ok: false, sebab: "tanpa-derry" };
    if (!api.siapa()) return { ok: false, sebab: "belum-masuk" };
    return { ok: false, sebab: "tidak-di-daftar" };
  }

  async function terimaSerahAbt() {
    let nomor = bacaSerahDariHash(location.hash);
    if (nomor) {
      try {
        history.replaceState(null, "", `${location.pathname}${location.search}`);
      } catch {
        /* hash tetap: tidak mengganggu ABT */
      }
    } else {
      const s = (await bacaPenyimpanan([KUNCI_SERAH]))[KUNCI_SERAH];
      if (s && POLA_NOMOR_PENUH.test(String(s.nomor || "")) && Date.now() - Number(s.saat || 0) < BATAS_SERAH_MS) nomor = String(s.nomor);
    }
    if (!nomor) return null;
    await hapusPenyimpanan(KUNCI_SERAH);
    const h = await serahkanKeDerry(nomor);
    const api = globalThis.aletaBlangkoDerry;
    if (h.ok) {
      if (api && typeof api.toast === "function") api.toast(`Perkara ${nomor} dibuka dari SIPP.`);
    } else if (h.sebab === "tidak-di-daftar" && api && typeof api.toast === "function") {
      api.toast(`Perkara ${nomor} tidak ada di daftar perkara Anda di Blangko ABT by Derry Briantono.`);
    } else if (h.sebab === "belum-masuk") {
      toast(`Masuk ke ALETA dulu supaya Blangko ABT by Derry Briantono dapat membuka perkara ${nomor}.`);
    } else {
      toast(`Blangko ABT by Derry Briantono tidak ada di menu ABT akun ini. Cari perkara ${nomor} lewat menu ABT seperti biasa.`);
    }
    return { nomor, ...h };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Pemasangan
  // ──────────────────────────────────────────────────────────────────────────
  let nyala = true;
  function aktifSekarang() {
    return nyala && !modeLama();
  }
  function bersihkan(doc) {
    for (const e of Array.from((doc || document).querySelectorAll(".aleta-l1"))) e.remove();
    for (const f of Array.from((doc || document).querySelectorAll("form"))) {
      f.__aletaL1 = null;
      f.__aletaL1Edoc = null;
    }
    pitaHidup.clear();
  }

  /** Satu putaran pemasangan di SIPP. Pulang ringkasan (dipakai uji). */
  function pasang(doc) {
    const d = doc || document;
    if (!aktifSekarang()) {
      if (d.querySelector(".aleta-l1")) bersihkan(d);
      return { tautan: 0, detil: false, pita: 0, edoc: 0 };
    }
    sisipkanGaya(d);
    const tautan = pasangTautanDaftar(d);
    const detil = pasangTautanDetil(d);
    let pita = 0;
    let edoc = 0;
    for (const f of Array.from(d.querySelectorAll("form"))) {
      if (milikAleta(f)) continue;
      if (f.id === "frm_upload_file") {
        if (pasangCekEdoc(f)) edoc += 1;
        continue;
      }
      if (pasangPita(f)) pita += 1;
    }
    return { tautan, detil, pita, edoc };
  }

  let jeda = null;
  function jadwalkan() {
    if (jeda) return;
    jeda = setTimeout(() => {
      jeda = null;
      try {
        pasang(document);
      } catch {
        /* tambahan: kegagalannya tidak boleh mengganggu SIPP */
      }
    }, 250);
  }
  function dariAletaSaja(m) {
    if (milikAleta(m.target)) return true;
    const n = [...Array.from(m.addedNodes || []), ...Array.from(m.removedNodes || [])];
    return n.length > 0 && n.every((x) => x.nodeType === 1 && x.classList && (x.classList.contains("aleta-sisip") || x.id === ID_PANEL));
  }

  const diAbt = () => /\/aps_badilag\//i.test(String(location.pathname || ""));

  async function mulai() {
    try {
      const s = await bacaPenyimpanan(["aktif"]);
      nyala = s.aktif !== false;
      try {
        chrome.storage.onChanged.addListener((ubah, wilayah) => {
          if (wilayah !== "local" || !ubah || !ubah.aktif) return;
          nyala = ubah.aktif.newValue !== false;
          if (!diAbt()) jadwalkan();
        });
      } catch {
        /* di luar konteks ekstensi */
      }
      if (diAbt()) {
        if (nyala) void terimaSerahAbt();
        return;
      }
      if (!document.body) return;
      // Pengamat, penjaga Simpan, dan pendengar tampilan dipasang SELALU -
      // juga bila ALETA sedang mati saat halaman dibuka: pasang() dan
      // saatKirim() sendiri yang memeriksa aktifSekarang(). Dulu ALETA yang
      // dinyalakan dari popup sesudah halaman terbuka tidak pernah memasang
      // pita di jendela berikutnya (audit 17 Okt).
      document.addEventListener("submit", saatKirim, true);
      // Lama <-> Baru/UI Baru (popup, atau tampilan dari server) diikuti seketika.
      document.addEventListener("aleta-uji-berubah", () => jadwalkan());
      new MutationObserver((daftar) => {
        if (daftar.every(dariAletaSaja)) return;
        jadwalkan();
      }).observe(document.body, { childList: true, subtree: true });
      jadwalkan();
    } catch {
      /* tambahan: kegagalannya tidak boleh mengganggu SIPP/ABT */
    }
  }

  const api = {
    versi: "tahap-L1",
    pasang,
    segarkanSemua,
    bersihkan,
    serahkanKeDerry,
    terimaSerahAbt,
    teruskanNaskah,
    terapPutusan,
    saatKirim,
    murni: {
      kenaliJendela,
      hitungKolom,
      kalimatHitung,
      bacaEdocJendela,
      bacaEdocTabPutusan,
      bacaUsulanPanel,
      bacaSerahDariHash,
      alamatAbtUntuk,
      alamatAleta,
      asalAbt,
      kolomNomor,
      nomorHalamanDetil,
      tampak,
    },
    KUNCI_SERAH,
  };
  globalThis.aletaSippIdeL1 = api;
  void mulai();
})();
