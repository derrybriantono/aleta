"use strict";

/**
 * ============================================================================
 * TOMBOL "SYNC E-COURT" DI SAMPING "HELP" (3 Nov 2026)
 * ============================================================================
 *
 * Permintaan pengguna: di semua halaman SIPP, di samping tombol Help, tombol
 * "Sync E-Court" yang fungsinya seperti halaman SIPP "Monitoring Sinkronisasi Data"
 * (jumlah antrian data SIPP yang menunggu dikirim ke Mahkamah Agung dan e-Court,
 * daftar Tabel/ID Data, "Cek Antrian Data", dan "Sinkronisasi Data").
 *
 * MEMAKAI JALUR SIPP YANG SAMA dengan halaman itu, atas sesi pengguna sendiri:
 *   - membaca antrian : GET <SIPP>/monitoring_sinkron   (pintu menu SIPP; dialihkan SIPP ke
 *                       monitoring_sync_antrian). Halamannya dibaca, bukan ditulis.
 *   - sinkronisasi    : GET <SIPP>/api/Sync             (persis yang dipanggil tombol
 *                       "Sinkronisasi Data" di halaman itu), hanya sesudah pengguna menekan
 *                       "Ya, sinkronkan" di dalam panel.
 * Tidak ada yang ditulis ke basis data SIPP oleh berkas ini; satu-satunya aksi tulis adalah
 * aksi SIPP sendiri yang dijalankan pengguna dengan konfirmasi.
 *
 * RINGAN. Pintu menu SIPP memakai sesi kilat (flash) - pembacaan beruntun bisa bersilang dengan
 * perpindahan halaman pengguna, jadi antrian TIDAK dibaca tiap halaman dimuat. Hasil (ada/tidak
 * boleh, jumlah antrian) disimpan 5 menit di penyimpanan ekstensi dan dipakai bersama semua tab;
 * dibaca ulang paling cepat tiap 5 menit, hanya saat tab terlihat dan pengguna sedang diam,
 * dan tiap kali panel dibuka. Peran yang ditolak/dialihkan SIPP: tombolnya disembunyikan.
 *
 * Tombol memakai kelas "about" SIPP sendiri (bentuk dan warna sama dengan Help); panel kecil
 * bergaya SIPP terang dan gelap (panel.css, .aleta-sec-*). Semua elemen berkelas aleta-sisip.
 */
(function sinkronEcourtModul() {
  if (typeof globalThis === "undefined" || globalThis.aletaSinkronEcourt) return;

  const KUNCI = "sinkronEcourt";
  const UMUR_MS = 5 * 60 * 1000;
  const UMUR_TOLAK_MS = 30 * 60 * 1000;
  const DIAM_MS = 4000;
  const BATAS_BARIS = 50;
  const ID_TOMBOL = "aleta-sec-tombol";
  const ID_PANEL = "aleta-sec-panel";
  const JUDUL = "Monitoring Sinkronisasi Data";

  // ──────────────────────────────────────────────────────────────────────────
  // Murni (diuji tanpa peramban sungguhan)
  // ──────────────────────────────────────────────────────────────────────────
  const rapat = (t) => String(t == null ? "" : t).replace(/\s+/g, " ").trim();

  /** Alamat dasar SIPP dari alamat halaman: .../SIPP/ atau .../index.php/. */
  function alamatDasar(lokasi) {
    const l = lokasi || (typeof location !== "undefined" ? location : { origin: "", pathname: "/" });
    const m = /^(.*?\/(?:SIPP|index\.php)\/)/i.exec(String(l.pathname || "/"));
    return `${l.origin || ""}${m ? m[1] : "/"}`;
  }

  /** Angka dari "Total Antrian Data : 1.234" -> 1234. */
  function angkaTotal(teks) {
    const m = /Total\s+Antrian\s+Data\s*:\s*([\d.,]+)/i.exec(rapat(teks));
    if (!m) return null;
    const n = Number(m[1].replace(/[.,]/g, ""));
    return Number.isFinite(n) ? n : null;
  }

  /**
   * Uraikan halaman "Monitoring Sinkronisasi Data" SIPP.
   * ok = benar-benar halaman itu (bukan halaman masuk / dasbor / galat).
   */
  function uraiHalaman(html, parser) {
    const hasil = { ok: false, total: 0, baris: [] };
    let doc = null;
    try {
      doc = (parser || new DOMParser()).parseFromString(String(html || ""), "text/html");
    } catch {
      return hasil;
    }
    const tabel = doc.querySelector("#tablePerkaraAll");
    const penanda = doc.querySelector(".total_perkara");
    const total = penanda ? angkaTotal(penanda.textContent) : null;
    if (!tabel || total === null) return hasil;
    hasil.ok = true;
    hasil.total = total;
    for (const tr of Array.from(tabel.querySelectorAll("tr")).slice(1)) {
      const td = Array.from(tr.querySelectorAll("td"));
      if (td.length < 3) continue; // baris "Data Antrian Kosong"
      hasil.baris.push({ no: rapat(td[0].textContent), tabel: rapat(td[1].textContent), dataId: rapat(td[2].textContent) });
    }
    return hasil;
  }

  /** Lencana di tombol: kosong bila tidak ada antrian. */
  function teksLencana(total) {
    const n = Number(total) || 0;
    if (n <= 0) return "";
    return n > 999 ? "999+" : String(n);
  }

  /** Apakah hasil simpanan masih boleh dipakai tanpa membaca ulang. */
  function simpananSegar(s, sekarang) {
    if (!s || typeof s !== "object" || !Number.isFinite(Number(s.saat))) return false;
    const umur = (sekarang || Date.now()) - Number(s.saat);
    return umur >= 0 && umur < (s.ok === false ? UMUR_TOLAK_MS : UMUR_MS);
  }

  /** Pesan awam dari jawaban api/Sync (JSON {status, message} bila terbaca). */
  function pesanSinkron(teks, kodeHttp) {
    let j = null;
    try {
      j = JSON.parse(String(teks || ""));
    } catch {
      j = null;
    }
    if (j && typeof j === "object") {
      if (j.status === 0 || j.status === "0" || j.status === false) return { ok: false, teks: rapat(j.message) || "SIPP menolak sinkronisasi." };
      if (j.message) return { ok: true, teks: rapat(j.message) };
    }
    if (kodeHttp && kodeHttp >= 400) return { ok: false, teks: `SIPP menjawab ${kodeHttp}.` };
    return { ok: true, teks: "Sinkronisasi dijalankan." };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Penyimpanan bersama antar tab
  // ──────────────────────────────────────────────────────────────────────────
  let memori = null;
  async function bacaSimpanan() {
    try {
      const o = await chrome.storage.local.get(KUNCI);
      return (o && o[KUNCI]) || memori;
    } catch {
      return memori;
    }
  }
  async function tulisSimpanan(isi) {
    memori = isi;
    try {
      await chrome.storage.local.set({ [KUNCI]: isi });
    } catch {
      /* hanya cadangan antar tab */
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Pembacaan dan sinkronisasi (jalur SIPP sendiri)
  // ──────────────────────────────────────────────────────────────────────────
  const S = { tombol: null, panel: null, hasil: null, sibuk: false, membaca: null, terakhirAksi: 0, bolehTampil: false };

  async function bacaAntrian() {
    if (S.membaca) return S.membaca;
    S.membaca = (async () => {
      try {
        const r = await fetch(`${alamatDasar()}monitoring_sinkron`, { credentials: "include", cache: "no-store", redirect: "follow" });
        const teks = r.ok ? await r.text() : "";
        const u = r.ok ? uraiHalaman(teks) : { ok: false, total: 0, baris: [] };
        // Ditolak / dialihkan / bukan halamannya: peran ini tidak boleh membukanya.
        const rekam = { saat: Date.now(), ok: u.ok, total: u.total };
        await tulisSimpanan(rekam);
        return { ok: u.ok, ditolak: !u.ok, total: u.total, baris: u.baris, saat: rekam.saat };
      } catch {
        return { ok: false, ditolak: false, galat: true, total: 0, baris: [], saat: Date.now() };
      } finally {
        S.membaca = null;
      }
    })();
    return S.membaca;
  }

  async function jalankanSinkron() {
    try {
      const r = await fetch(`${alamatDasar()}api/Sync`, { credentials: "include", cache: "no-store" });
      const teks = await r.text().catch(() => "");
      return pesanSinkron(teks, r.status);
    } catch {
      return { ok: false, teks: "SIPP tidak dapat dihubungi. Periksa sambungan, lalu coba lagi." };
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Tampilan
  // ──────────────────────────────────────────────────────────────────────────
  function el(tag, kelas, teks) {
    const e = document.createElement(tag);
    if (kelas) e.className = kelas;
    if (teks != null) e.textContent = teks;
    return e;
  }

  function terapkanLencana() {
    if (!S.tombol) return;
    const l = S.tombol.querySelector(".aleta-sec-lencana");
    const t = teksLencana(S.hasil && S.hasil.total);
    if (!l) return;
    l.hidden = !t;
    if (l.textContent !== t) l.textContent = t;
    S.tombol.title = t ? `${JUDUL} - ${t} data menunggu dikirim ke Mahkamah Agung dan e-Court` : `${JUDUL} - tidak ada data yang menunggu`;
  }

  function tutupPanel() {
    if (S.panel) S.panel.remove();
    S.panel = null;
    document.removeEventListener("keydown", saatTombolTekan, true);
    document.removeEventListener("pointerdown", saatKlikLuar, true);
  }
  function saatTombolTekan(e) {
    if (e.key === "Escape") tutupPanel();
  }
  function saatKlikLuar(e) {
    const t = e.target;
    if (!S.panel || !t || !t.closest) return;
    if (!t.closest(`#${ID_PANEL}`) && !t.closest(`#${ID_TOMBOL}`)) tutupPanel();
  }

  function letakkanPanel() {
    if (!S.panel || !S.tombol) return;
    const r = S.tombol.getBoundingClientRect();
    const lebar = Math.max(document.documentElement.clientWidth || 0, 320);
    S.panel.style.top = `${Math.round(r.bottom + 6)}px`;
    S.panel.style.right = `${Math.max(8, Math.round(lebar - r.right))}px`;
  }

  function gambarPanel(kabar) {
    const p = S.panel;
    if (!p) return;
    const h = S.hasil;
    p.textContent = "";
    const kepala = el("div", "aleta-sec-kepala");
    kepala.append(el("span", "aleta-sec-judul", JUDUL));
    const tutup = el("button", "aleta-sec-tutup", "×");
    tutup.type = "button";
    tutup.title = "Tutup";
    tutup.setAttribute("aria-label", "Tutup");
    tutup.addEventListener("click", tutupPanel);
    kepala.append(tutup);
    p.append(kepala);

    p.append(el("div", "aleta-sec-info", "Data pada antrian dikirim dari SIPP ke Mahkamah Agung, lalu diteruskan ke e-Court. Biasanya terkirim otomatis sesuai jadwal."));

    if (!h) {
      p.append(el("div", "aleta-sec-lembut", "Membaca antrian…"));
    } else if (h.galat) {
      p.append(el("div", "aleta-sec-peringatan", "Antrian belum terbaca - SIPP tidak dapat dihubungi."));
    } else {
      const jml = h.total || 0;
      const ringkas = el("div", `aleta-sec-total${jml > 0 ? " aleta-sec-ada" : ""}`, `Total antrian data: ${jml.toLocaleString("id-ID")}`);
      p.append(ringkas);
      if (h.baris && h.baris.length) {
        const gulir = el("div", "aleta-sec-gulir");
        const tb = el("table", "aleta-sec-tabel");
        const kp = el("tr");
        for (const t of ["No", "Tabel", "ID Data"]) kp.append(el("th", "", t));
        tb.append(kp);
        for (const b of h.baris.slice(0, BATAS_BARIS)) {
          const tr = el("tr");
          tr.append(el("td", "", b.no), el("td", "", b.tabel), el("td", "", b.dataId));
          tb.append(tr);
        }
        gulir.append(tb);
        p.append(gulir);
        if (jml > h.baris.length) p.append(el("div", "aleta-sec-lembut", `Menampilkan ${h.baris.length} data pertama dari ${jml.toLocaleString("id-ID")}.`));
      } else if (jml === 0) {
        p.append(el("div", "aleta-sec-lembut", "Tidak ada data yang menunggu dikirim."));
      }
      if (h.saat) p.append(el("div", "aleta-sec-lembut", `Dibaca pukul ${new Date(h.saat).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}.`));
    }

    if (kabar) p.append(el("div", `aleta-sec-kabar${kabar.gagal ? " aleta-sec-gagal" : ""}`, kabar.teks));

    const aksi = el("div", "aleta-sec-aksi");
    const cek = el("button", "aleta-sec-btn", "Cek antrian data");
    cek.type = "button";
    cek.disabled = S.sibuk;
    cek.addEventListener("click", () => void muatPanel());
    const sinkron = el("button", "aleta-sec-btn aleta-sec-utama", "Sinkronisasi data");
    sinkron.type = "button";
    sinkron.disabled = S.sibuk;
    aksi.append(cek, sinkron);
    p.append(aksi);

    const konfirmasi = el("div", "aleta-sec-konfirmasi");
    konfirmasi.hidden = true;
    konfirmasi.append(el("div", "", "Kirim data antrian ke Mahkamah Agung sekarang? Prosesnya dapat berlangsung beberapa menit; jangan tutup halaman ini."));
    const baris = el("div", "aleta-sec-aksi");
    const ya = el("button", "aleta-sec-btn aleta-sec-utama", "Ya, sinkronkan");
    ya.type = "button";
    const batal = el("button", "aleta-sec-btn", "Batal");
    batal.type = "button";
    baris.append(ya, batal);
    konfirmasi.append(baris);
    p.append(konfirmasi);
    sinkron.addEventListener("click", () => {
      konfirmasi.hidden = false;
      sinkron.disabled = true;
    });
    batal.addEventListener("click", () => {
      konfirmasi.hidden = true;
      sinkron.disabled = S.sibuk;
    });
    ya.addEventListener("click", () => void lakukanSinkron());
    letakkanPanel();
  }

  async function muatPanel() {
    if (S.sibuk) return;
    S.sibuk = true;
    gambarPanel(null);
    const h = await bacaAntrian();
    S.sibuk = false;
    terapkanHasil(h);
    gambarPanel(h.galat ? { teks: "Antrian belum terbaca. Coba lagi sebentar lagi.", gagal: true } : null);
  }

  async function lakukanSinkron() {
    if (S.sibuk) return;
    S.sibuk = true;
    gambarPanel({ teks: "Menjalankan sinkronisasi… mohon tunggu." });
    const r = await jalankanSinkron();
    const h = await bacaAntrian();
    S.sibuk = false;
    terapkanHasil(h);
    gambarPanel({ teks: r.ok ? `${r.teks} Antrian dibaca ulang.` : r.teks, gagal: !r.ok });
  }

  function terapkanHasil(h) {
    if (h && h.ditolak) {
      // Peran ini tidak boleh membuka halamannya: tombol disembunyikan.
      S.hasil = null;
      S.bolehTampil = false;
      tutupPanel();
      if (S.tombol) S.tombol.remove();
      S.tombol = null;
      return;
    }
    if (h && !h.galat) {
      S.hasil = h;
      S.bolehTampil = true;
    }
    terapkanLencana();
  }

  async function bukaPanel() {
    if (S.panel) {
      tutupPanel();
      return;
    }
    S.panel = el("div", "aleta-sisip aleta-sec-panel");
    S.panel.id = ID_PANEL;
    S.panel.setAttribute("role", "dialog");
    S.panel.setAttribute("aria-label", JUDUL);
    document.body.appendChild(S.panel);
    document.addEventListener("keydown", saatTombolTekan, true);
    document.addEventListener("pointerdown", saatKlikLuar, true);
    gambarPanel(null);
    void muatPanel();
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Pemasangan di samping Help
  // ──────────────────────────────────────────────────────────────────────────
  function cariHelp(doc) {
    return doc.querySelector("#cssmenu .about:not(.aleta-sisip)");
  }

  function selaraskan(tombol, help) {
    // Help memakai right:5px; tombol berdiri tepat di kirinya dengan jarak 6px.
    const kanan = 5 + Math.max(help.offsetWidth || 0, 40) + 6;
    const teks = `${kanan}px`;
    if (tombol.style.right !== teks) tombol.style.right = teks;
  }

  function pasangTombol(doc) {
    if (!S.bolehTampil) return false;
    const help = cariHelp(doc);
    if (!help || !help.parentNode) return false;
    let t = doc.getElementById(ID_TOMBOL);
    if (!t) {
      t = el("div", "about aleta-sisip aleta-sec-tombol");
      t.id = ID_TOMBOL;
      t.setAttribute("role", "button");
      t.tabIndex = 0;
      const ikon = el("i", "fa fa-refresh");
      ikon.setAttribute("aria-hidden", "true");
      t.append(ikon, doc.createTextNode(" Sync E-Court"));
      const lencana = el("span", "aleta-sec-lencana");
      lencana.hidden = true;
      t.append(lencana);
      t.addEventListener("click", () => void bukaPanel());
      t.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          void bukaPanel();
        }
      });
      help.parentNode.insertBefore(t, help);
    }
    S.tombol = t;
    selaraskan(t, help);
    terapkanLencana();
    return true;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Siklus: simpanan bersama -> bila basi, baca sekali saat pengguna diam
  // ──────────────────────────────────────────────────────────────────────────
  let terakhirGerak = 0;
  const catatGerak = () => {
    terakhirGerak = Date.now();
  };

  const terlihat = () => typeof document !== "undefined" && document.visibilityState !== "hidden";

  async function segarkanBilaPerlu() {
    if (!terlihat() || S.sibuk || !cariHelp(document)) return;
    const s = await bacaSimpanan();
    if (simpananSegar(s)) {
      if (s.ok === false) {
        S.bolehTampil = false;
        if (S.tombol) {
          S.tombol.remove();
          S.tombol = null;
        }
      } else {
        S.hasil = Object.assign({}, S.hasil || { baris: [] }, { total: s.total, saat: s.saat, ok: true });
        S.bolehTampil = true;
        pasangTombol(document);
      }
      return;
    }
    // Pengguna baru saja bergerak: jangan bersilang dengan perpindahan halamannya.
    if (Date.now() - terakhirGerak < DIAM_MS) {
      setTimeout(() => void segarkanBilaPerlu(), DIAM_MS);
      return;
    }
    // Tab lain sedang membaca (penanda dipasang sebelum membaca).
    await tulisSimpanan(Object.assign({}, s || {}, { saat: Date.now(), ok: s && s.ok === false ? false : true, total: (s && s.total) || 0, membaca: true }));
    const h = await bacaAntrian();
    terapkanHasil(h);
    if (S.bolehTampil) pasangTombol(document);
  }

  let jeda = null;
  function jadwalkan() {
    if (jeda) return;
    jeda = setTimeout(() => {
      jeda = null;
      if (S.bolehTampil) pasangTombol(document);
      else void segarkanBilaPerlu();
    }, 400);
  }

  function mulai() {
    try {
      if (typeof document === "undefined" || !document.body || globalThis.__aletaSecTerpasang) return;
      if (/aps_badilag/i.test(location.pathname)) return; // hanya SIPP
      globalThis.__aletaSecTerpasang = true;
      document.addEventListener("pointerdown", catatGerak, { capture: true, passive: true });
      document.addEventListener("keydown", catatGerak, { capture: true, passive: true });
      new (globalThis.ALETA_PENGAMAT ? globalThis.ALETA_PENGAMAT.Pengamat : MutationObserver)((daftar) => {
        const luar = daftar.some((m) => !(m.target && m.target.closest && m.target.closest(".aleta-sisip")));
        if (luar) jadwalkan();
      }).observe(document.body, { childList: true, subtree: true });
      // Dibaca ulang paling cepat tiap 5 menit (berhenti di tab tersembunyi).
      (globalThis.ALETA_PENGAMAT ? globalThis.ALETA_PENGAMAT.setiap : (f, m) => setInterval(f, m))(() => void segarkanBilaPerlu(), UMUR_MS);
      // Tunda sejenak supaya tidak bersaing dengan muatan awal halaman.
      setTimeout(() => void segarkanBilaPerlu(), 2500);
    } catch {
      /* tambahan: kegagalannya tidak boleh mengganggu SIPP */
    }
  }

  globalThis.aletaSinkronEcourt = {
    versi: "sinkron-ecourt-1",
    murni: { alamatDasar, angkaTotal, uraiHalaman, teksLencana, simpananSegar, pesanSinkron },
    mulai,
    bacaAntrian,
    segarkan: segarkanBilaPerlu,
    bukaPanel,
  };
  mulai();
})();
