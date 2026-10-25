"use strict";

/**
 * ============================================================================
 * TOMBOL "TARIK DATA" DI KEPALA HALAMAN PERKARA SIPP (21 Okt 2026)
 * ============================================================================
 *
 * Permintaan hakim: "Tambahkan tombol tarik data di atas SIPP (sebelah kirinya
 * selamat datang user) ketika masuk di perkara (jadi tariknya cuman 1), namun
 * ketika dia tarik data jangan sampai memberatkan penarikan data yang asli
 * dari e-Court admin yang kerjakan umumnya."
 *
 * Tempat: kepala SIPP memuat `.h_right` (pojok kanan atas, position:absolute)
 * yang berisi tabel `table.badge` - "Selamat Datang <nama> / Anda Login Sebagai
 * <jabatan>" dan tombol Keluar. Tombol ini diletakkan DI DALAM `.h_right` dengan
 * `right:100%` sehingga persis di kiri tabel itu, sejajar dengannya; tata letak
 * SIPP tidak diubah sedikit pun (tidak ada elemen SIPP yang dipindah/diubah).
 *
 * Hanya muncul di halaman DETAIL perkara dan hanya untuk peran yang diberi
 * kemampuan "permintaan" (Titip permintaan penarikan); server menegakkannya
 * lagi (403). Menarik e-Court HANYA perkara itu. Antrean, batas laju, dan
 * jaminan "tidak memberatkan penarikan utama" ada di server (bot):
 *   - satu tarikan sekaligus, hanya di sela penarikan utama;
 *   - satu perkara tidak ditarik ulang dalam 10 menit (jawabannya "baru
 *     ditarik N menit lalu"); menarik ulang sebelum itu HANYA Super Admin /
 *     Admin - tombol "Tarik ulang" hanya muncul bila server menyatakan boleh.
 * Tombol ini tidak membuat sesi e-Court baru dan tidak menulis apa pun ke SIPP;
 * tidak ada kata merek yang ditulis ke halaman SIPP.
 */
(function tarikSatuPerkaraModul() {
  if (typeof globalThis === "undefined" || globalThis.aletaTarikSatu) return;

  const API = "/aleta/api/aleta-ecourt/tarik-satu";
  const ID = "aleta-tarik-satu";
  const ID_GAYA = "aleta-tarik-satu-gaya";
  const ID_MU = "aleta-muat-ulang-perkara";
  const KUNCI_TAB = "muatUlangTabPerkara";
  const UMUR_TAB_MS = 90 * 1000;
  const KUNCI_KONTEKS = "simpananKonteks";
  const JEDA_TANYA_MS = 3000;
  const BATAS_PANTAU_MS = 14 * 60 * 1000;
  const SEMENTARA = new Set(["menunggu-giliran", "berjalan"]);
  const GAGAL = new Set(["gagal", "sesi-habis", "ditunda", "ditolak", "terputus"]);
  /** Kegagalan lama (lebih dari ini) tidak ditampilkan lagi saat halaman dibuka. */
  const UMUR_GAGAL_TAMPIL_DETIK = 30 * 60;

  const sebaris = (t) => String(t == null ? "" : t).replace(/\s+/g, " ").trim();
  const fungsi = (nama) => (typeof globalThis[nama] === "function" ? globalThis[nama] : null);

  // ──────────────────────────────────────────────────────────────────────────
  // Murni: teks dan keadaan tampilan (dapat diuji tanpa DOM)
  // ──────────────────────────────────────────────────────────────────────────

  /** "baru saja" / "N menit lalu" / "N jam lalu" dari selisih detik. */
  function umurTeks(detik) {
    const d = Math.max(0, Math.round(Number(detik) || 0));
    if (d < 45) return "baru saja";
    if (d < 90 * 60) return `${Math.max(1, Math.round(d / 60))} menit lalu`;
    return `${Math.round(d / 3600)} jam lalu`;
  }

  const ALASAN_TUNGGU = {
    putaran_utama_berjalan: "penarikan utama sedang berjalan",
    putaran_utama_segera: "penarikan utama hampir mulai",
    penarikan_server_berjalan: "ada penarikan lain di server",
    pemulihan_sesi: "sesi e-Court sedang dipulihkan",
  };

  /**
   * Susunan tampilan dari jawaban server.
   *
   * @param {object} k { data, diterimaMs, sekarangMs, bukanEcourt, bolehPaksa, sementara }
   * @returns {{ teks: string, nada: string, judul: string, persen: number|null, mati: boolean,
   *             tombol: string, tawarPaksa: boolean, bergerak: boolean }}
   */
  function susunKabar(k) {
    const d = (k && k.data) || {};
    const t = d.tarikan || null;
    const lewat = Math.max(0, ((k && k.sekarangMs) - (k && k.diterimaMs)) / 1000) || 0;
    const umur = d.terakhirDetik == null ? null : Number(d.terakhirDetik) + lewat;
    const dasar = { teks: "", nada: "info", judul: "", persen: null, mati: false, tombol: "Tarik data", tawarPaksa: false, bergerak: false };

    if (k && k.bukanEcourt) {
      return {
        ...dasar,
        teks: "Bukan perkara e-Court",
        judul: "Perkara ini tidak didaftarkan lewat e-Court, jadi tidak ada data e-Court yang bisa ditarik.",
        mati: true,
      };
    }
    if (k && k.sementara) return { ...dasar, teks: sebaris(k.sementara), nada: "jalan", mati: true, bergerak: true };

    if (t && t.status === "berjalan") {
      const kem = t.kemajuan || {};
      const persen = Number.isFinite(Number(kem.persen)) ? Math.max(0, Math.min(100, Math.round(Number(kem.persen)))) : null;
      return {
        ...dasar,
        teks: `${persen == null ? "" : `${persen}% · `}${sebaris(kem.teks || kem.label) || "Menarik dari e-Court"}`,
        nada: "jalan",
        persen,
        mati: true,
        bergerak: true,
        judul: "Hanya perkara ini yang ditarik. Penarikan utama tidak terganggu.",
      };
    }
    if (t && t.status === "menunggu-giliran") {
      const sebab = ALASAN_TUNGGU[t.menungguKarena] || "";
      return {
        ...dasar,
        teks: `Menunggu giliran${sebab ? ` · ${sebab}` : ""}`,
        nada: "tunggu",
        mati: true,
        bergerak: true,
        judul: "Tarikan satu perkara memberi jalan kepada penarikan utama dan dimulai begitu ada sela. Paling lama 10 menit.",
      };
    }
    if (t && t.status === "selesai") {
      const sejak = t.selesaiDetik == null ? lewat : Number(t.selesaiDetik) + lewat;
      const baru = Array.isArray(t.dokumenBaru) ? t.dokumenBaru : [];
      return {
        ...dasar,
        teks: `${sebaris(t.pesan) || "Selesai"} · ${umurTeks(sejak)}`,
        nada: "ok",
        tawarPaksa: Boolean(k && k.bolehPaksa && sejak < 600),
        judul: baru.length ? baru.map((x) => sebaris(x.judul)).filter(Boolean).join(", ") : "",
      };
    }
    if (t && GAGAL.has(t.status) && (t.selesaiDetik == null || Number(t.selesaiDetik) + lewat <= UMUR_GAGAL_TAMPIL_DETIK)) {
      return { ...dasar, teks: sebaris(t.pesan) || "Tarikan tidak selesai", nada: t.status === "ditunda" ? "awas" : "galat", judul: sebaris(t.pesan) };
    }
    if (d.hasil === "segar" && umur != null) {
      return {
        ...dasar,
        teks: `Baru ditarik ${umurTeks(umur)}`,
        nada: "ok",
        tawarPaksa: Boolean(k && k.bolehPaksa),
        judul: "Datanya masih segar; tidak ditarik ulang sebelum 10 menit.",
      };
    }
    if (umur != null) {
      return { ...dasar, teks: `Terakhir ditarik ${umurTeks(umur)}`, nada: "info", tawarPaksa: Boolean(k && k.bolehPaksa && umur < 600) };
    }
    return dasar;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Keadaan dan DOM
  // ──────────────────────────────────────────────────────────────────────────

  const S = {
    nomor: "",
    data: null,
    diterimaMs: 0,
    bolehPaksa: false,
    bukanEcourt: false,
    sementara: "",
    pewaktu: null,
    mulaiPantauMs: 0,
    sibuk: false,
    statusSebelum: "",
    akar: null,
    teksTerakhir: "",
  };
  let nyala = true;

  function el(tag, kelas, teks) {
    const e = document.createElement(tag);
    if (kelas) e.className = kelas;
    if (teks != null) e.textContent = teks;
    return e;
  }

  function pasangGaya() {
    if (document.getElementById(ID_GAYA) || !document.head) return;
    const g = document.createElement("style");
    g.id = ID_GAYA;
    g.textContent = [
      // Kelas aleta-sisip tetap dipakai (penanda "buatan kita" bagi pembaca halaman dan penyembunyi cetak), tetapi
      // kotak hijau bawaannya dinetralkan: di kepala SIPP tombol ini harus tampak seperti tombol, bukan kotak sisipan.
      `#${ID}.aleta-sisip{position:absolute;z-index:2147483000;pointer-events:auto;right:100%;width:max-content;margin:0 8px 0 0;padding:0;border:0;border-radius:0;background:none;display:flex;align-items:center;gap:8px;white-space:nowrap;font-size:12px;line-height:1.25;text-align:right;}`,
      `#${ID} [hidden]{display:none !important;}`,
      `#${ID} .aleta-ts-kabar{display:flex;flex-direction:column;align-items:flex-end;max-width:240px;white-space:normal;text-align:right;color:#fff;text-shadow:0 1px 2px rgba(0,0,0,.55);}`,
      `#${ID} .aleta-ts-kabar[data-nada="galat"]{color:#ffd0d0;}`,
      `#${ID} .aleta-ts-kabar[data-nada="awas"]{color:#ffe9a8;}`,
      `#${ID} .aleta-ts-kabar[data-nada="ok"]{color:#d6ffe0;}`,
      `#${ID} .aleta-ts-kabar:empty{display:none;}`,
      `#${ID} .aleta-ts-paksa{background:none;border:0;padding:0;margin-top:1px;color:#fff;text-decoration:underline;cursor:pointer;font-size:11px;}`,
      `#${ID} .aleta-ts-garis{display:block;width:100%;height:3px;margin-top:2px;border-radius:2px;background:rgba(255,255,255,.3);overflow:hidden;}`,
      `#${ID} .aleta-ts-garis>i{display:block;height:100%;width:0;background:#fff;transition:width .5s;}`,
      `#${ID} .aleta-ts-tombol{display:inline-flex;align-items:center;gap:5px;padding:4px 10px;border:1px solid rgba(255,255,255,.6);border-radius:3px;background:#0e7490;color:#fff;font-size:12px;font-weight:600;cursor:pointer;}`,
      `#${ID} .aleta-ts-tombol:hover:not(:disabled){background:#155e75;}`,
      `#${ID} .aleta-ts-tombol:focus-visible,#${ID} .aleta-ts-paksa:focus-visible{outline:2px solid #fff;outline-offset:2px;}`,
      `#${ID} .aleta-ts-tombol:disabled{opacity:.75;cursor:default;}`,
      `#${ID} .aleta-ts-putar{display:inline-block;animation:aleta-ts-putar 1.2s linear infinite;}`,
      `@keyframes aleta-ts-putar{to{transform:rotate(360deg);}}`,
      `html[data-aleta-tema-sipp="gelap"] #${ID} .aleta-ts-tombol{background:#164e63;border-color:#67e8f9;}`,
      `html[data-aleta-tema-sipp="gelap"] #${ID} .aleta-ts-tombol:hover:not(:disabled){background:#155e75;}`,
      // Tombol "Muat ulang" yang berdiri sendiri (peran tanpa hak tarik data): gaya sama dengan tombol di atas.
      `#${ID_MU}.aleta-sisip{position:absolute;z-index:2147483000;pointer-events:auto;right:100%;width:max-content;margin:0 8px 0 0;padding:0;border:0;border-radius:0;background:none;display:flex;align-items:center;gap:8px;white-space:nowrap;font-size:12px;line-height:1.25;}`,
      `#${ID_MU} .aleta-ts-tombol{display:inline-flex;align-items:center;gap:5px;padding:4px 10px;border:1px solid rgba(255,255,255,.6);border-radius:3px;background:#0e7490;color:#fff;font-size:12px;font-weight:600;cursor:pointer;}`,
      `#${ID_MU} .aleta-ts-tombol:hover:not(:disabled){background:#155e75;}`,
      `#${ID_MU} .aleta-ts-tombol:focus-visible{outline:2px solid #fff;outline-offset:2px;}`,
      `html[data-aleta-tema-sipp="gelap"] #${ID_MU} .aleta-ts-tombol{background:#164e63;border-color:#67e8f9;}`,
      // Muat ulang tampil sebagai tombol bergaris (sekunder) di samping Tarik data yang berisi.
      `#${ID} .aleta-ts-tombol.aleta-ts-muat,#${ID_MU} .aleta-ts-tombol.aleta-ts-muat{background:#fff;color:#0e7490;border-color:#0e7490;}`,
      `#${ID} .aleta-ts-tombol.aleta-ts-muat:hover:not(:disabled),#${ID_MU} .aleta-ts-tombol.aleta-ts-muat:hover:not(:disabled){background:#e0f2fe;}`,
      `html[data-aleta-tema-sipp="gelap"] #${ID} .aleta-ts-tombol.aleta-ts-muat,html[data-aleta-tema-sipp="gelap"] #${ID_MU} .aleta-ts-tombol.aleta-ts-muat{background:#0b2530;color:#a5f3fc;border-color:#67e8f9;}`,
    ].join("\n");
    document.head.appendChild(g);
  }

  function kepala() {
    const h = document.querySelector(".h_right");
    if (!h) return null;
    const badge = h.querySelector("table.badge");
    return badge ? { h, badge } : null;
  }

  function buatAkar() {
    const akar = el("div", "aleta-sisip aleta-ts");
    akar.id = ID;
    const kabar = el("div", "aleta-ts-kabar");
    kabar.setAttribute("role", "status");
    kabar.setAttribute("aria-live", "polite");
    const garis = el("span", "aleta-ts-garis");
    garis.hidden = true;
    garis.appendChild(document.createElement("i"));
    const teks = el("span", "aleta-ts-teks");
    const paksa = el("button", "aleta-ts-paksa", "Tarik ulang sekarang");
    paksa.type = "button";
    paksa.hidden = true;
    paksa.addEventListener("click", () => void minta(true));
    kabar.append(teks, garis, paksa);
    const tombol = el("button", "aleta-ts-tombol");
    tombol.type = "button";
    const ikon = el("i", "fa fa-refresh");
    ikon.setAttribute("aria-hidden", "true");
    tombol.append(ikon, el("span", "aleta-ts-label", "Tarik data"));
    tombol.addEventListener("click", () => void minta(false));
    akar.append(kabar, tombol);
    return akar;
  }

  function selarasLetak(akar, k) {
    // Sejajar dengan tabel "Selamat Datang" (offsetParent = .h_right yang absolute).
    const atas = k.badge.offsetTop;
    const tinggi = k.badge.offsetHeight;
    akar.style.top = `${atas}px`;
    if (tinggi > 0) akar.style.height = `${tinggi}px`;
  }

  function gambar() {
    const akar = S.akar;
    if (!akar) return;
    const kabar = akar.querySelector(".aleta-ts-kabar");
    const tombol = akar.querySelector(".aleta-ts-tombol");
    const label = akar.querySelector(".aleta-ts-label");
    const ikon = akar.querySelector(".fa");
    const garis = akar.querySelector(".aleta-ts-garis");
    const paksa = akar.querySelector(".aleta-ts-paksa");
    const hasil = susunKabar({
      data: S.data,
      diterimaMs: S.diterimaMs,
      sekarangMs: Date.now(),
      bukanEcourt: S.bukanEcourt,
      bolehPaksa: S.bolehPaksa,
      sementara: S.sementara,
    });
    const kunci = JSON.stringify([hasil.teks, hasil.nada, hasil.persen, hasil.mati, hasil.tawarPaksa, hasil.judul]);
    if (kunci === S.teksTerakhir) return;
    S.teksTerakhir = kunci;
    kabar.querySelector(".aleta-ts-teks").textContent = hasil.teks;
    kabar.dataset.nada = hasil.nada;
    kabar.title = hasil.judul;
    garis.hidden = hasil.persen == null;
    if (hasil.persen != null) garis.firstChild.style.width = `${hasil.persen}%`;
    paksa.hidden = !hasil.tawarPaksa || hasil.mati;
    tombol.disabled = hasil.mati;
    label.textContent = hasil.tombol;
    ikon.className = hasil.bergerak ? "fa fa-refresh aleta-ts-putar" : "fa fa-refresh";
    tombol.title = hasil.mati && hasil.judul ? hasil.judul : "Tarik data e-Court perkara ini saja";
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Panggilan ke server
  // ──────────────────────────────────────────────────────────────────────────

  async function panggil(alamat, opsi, sebut) {
    const ambil = fungsi("alatAmbil");
    let r;
    try {
      r = ambil ? await ambil(alamat, opsi, sebut) : await fetch(alamat, opsi);
    } catch {
      return { ok: false, status: 0, data: null };
    }
    let luar = null;
    try {
      luar = await r.json();
    } catch {
      luar = null;
    }
    const data = luar && typeof luar === "object" && "data" in luar ? luar.data : luar;
    const galat = luar && luar.error ? (typeof luar.error === "object" ? luar.error.message : luar.error) : "";
    return { ok: Boolean(r.ok), status: r.status, data, galat: sebaris(galat) };
  }

  function terima(data) {
    if (!data || typeof data !== "object") return;
    S.data = data;
    S.diterimaMs = Date.now();
    if (typeof data.bolehPaksa === "boolean") S.bolehPaksa = data.bolehPaksa;
    S.bukanEcourt = data.hasil === "bukan_ecourt";
  }

  function berhentiPantau() {
    if (S.pewaktu) clearTimeout(S.pewaktu);
    S.pewaktu = null;
    S.mulaiPantauMs = 0;
  }

  /** Setelah selesai: panel di halaman digambar ulang supaya dokumen baru langsung tampak. */
  function segarkanPanel() {
    try {
      if (typeof nomorTerakhir !== "undefined" && typeof segarkan === "function") {
        // eslint-disable-next-line no-global-assign
        nomorTerakhir = "";
        void segarkan();
      }
    } catch {
      /* panel hanya kemudahan */
    }
  }

  function pantau() {
    if (S.pewaktu) return;
    if (!S.mulaiPantauMs) S.mulaiPantauMs = Date.now();
    S.pewaktu = setTimeout(async () => {
      S.pewaktu = null;
      if (Date.now() - S.mulaiPantauMs > BATAS_PANTAU_MS) {
        berhentiPantau();
        return;
      }
      await tanya(false);
    }, JEDA_TANYA_MS);
  }

  /** Membaca keadaan tarikan perkara ini (sekali saat halaman dibuka, lalu berkala selama berlangsung). */
  async function tanya(awal) {
    const nomor = S.nomor;
    if (!nomor) return;
    const r = await panggil(`${API}?nomor=${encodeURIComponent(nomor)}`, { credentials: "include", cache: "no-store" }, "Membaca keadaan tarikan");
    if (nomor !== S.nomor) return;
    if (r.ok && r.data && r.data.available !== false && r.data.ok !== false) {
      const sebelum = S.statusSebelum;
      terima(r.data);
      const status = (r.data.tarikan && r.data.tarikan.status) || "";
      S.statusSebelum = status;
      if (SEMENTARA.has(status)) pantau();
      else {
        berhentiPantau();
        if (!awal && SEMENTARA.has(sebelum) && status === "selesai") segarkanPanel();
      }
    } else if (!awal && S.statusSebelum && SEMENTARA.has(S.statusSebelum)) {
      pantau();
    }
    gambar();
  }

  async function minta(paksa) {
    if (S.sibuk || !S.nomor) return;
    S.sibuk = true;
    S.sementara = "Meneruskan permintaan...";
    S.teksTerakhir = "";
    gambar();
    const nomor = S.nomor;
    const r = await panggil(
      API,
      {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(paksa ? { nomorPerkara: nomor, paksa: true } : { nomorPerkara: nomor }),
      },
      "Meneruskan permintaan tarik data"
    );
    S.sibuk = false;
    S.sementara = "";
    S.teksTerakhir = "";
    if (nomor !== S.nomor) return;

    const d = r.data && typeof r.data === "object" ? r.data : null;
    if (!d || d.available === false) {
      S.data = { ok: false, hasil: "", tarikan: { status: "gagal", pesan: "Server belum dapat dihubungi. Coba lagi sebentar lagi.", selesaiDetik: 0 } };
      S.diterimaMs = Date.now();
      gambar();
      return;
    }
    if (d.ok === false) {
      // Penolakan wajar: antrean penuh, akun e-Court tidak siap, bukan peran Admin, dst.
      const pesan = sebaris(d.pesan) || r.galat || "Permintaan tidak dapat dikerjakan.";
      S.data = { ok: false, hasil: "", tarikan: { status: "ditolak", pesan, selesaiDetik: 0 } };
      S.diterimaMs = Date.now();
      if (typeof d.bolehPaksa === "boolean") S.bolehPaksa = d.bolehPaksa;
      gambar();
      return;
    }
    if (!r.ok) {
      const pesan = r.galat || "Permintaan ditolak.";
      S.data = { ok: false, hasil: "", tarikan: { status: "ditolak", pesan, selesaiDetik: 0 } };
      S.diterimaMs = Date.now();
      gambar();
      return;
    }
    terima(d);
    S.statusSebelum = (d.tarikan && d.tarikan.status) || "";
    if (SEMENTARA.has(S.statusSebelum)) {
      S.mulaiPantauMs = Date.now();
      pantau();
    }
    gambar();
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Pemasangan
  // ──────────────────────────────────────────────────────────────────────────

  function halamanPerkara() {
    try {
      if (fungsi("alamatHalamanPerkara")) return alamatHalamanPerkara() === true;
    } catch {
      /* jatuh ke pola alamat */
    }
    return /detil[_-]?perkara|detail[_-]?perkara/i.test(String(location.pathname || ""));
  }

  function nomorHalaman() {
    try {
      return fungsi("cariNomorPerkara") ? sebaris(cariNomorPerkara()) : "";
    } catch {
      return "";
    }
  }

  /** Peran yang diberi kemampuan "permintaan" (portal sudah menjawab). Belum terbaca = tidak tampil. */
  function berhak() {
    try {
      if (typeof penggunaTerakhir === "undefined" || !penggunaTerakhir) return false;
      return typeof boleh === "function" ? boleh("permintaan") === true : true;
    } catch {
      return false;
    }
  }

  function bersihkan() {
    const lama = document.getElementById(ID);
    if (lama) lama.remove();
    berhentiPantau();
    S.akar = null;
    S.nomor = "";
    S.data = null;
    S.bukanEcourt = false;
    S.statusSebelum = "";
    S.teksTerakhir = "";
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Tombol "Muat ulang" (21 Okt 2026): memuat ulang halaman perkara ini, tetap di
  // perkara & tab yang sama, supaya berkas/relaas/BAS/putusan yang baru diunggah
  // dan semua panel tampil terbaru. Tidak menulis apa pun ke SIPP.
  // ──────────────────────────────────────────────────────────────────────────
  const kunciNomor = (n) => String(n || "").replace(/\s+/g, "").toUpperCase();
  const dalamAleta = (e) => Boolean(e.closest && e.closest(".aleta-sisip,[class*='aleta-'],[id^='aleta-']"));

  /** Tab yang sedang terbuka di halaman perkara (href "#tabsN"), atau "". */
  function tabAktif() {
    const a = document.querySelector('li.ui-tabs-active > a[href^="#tabs"], li.ui-state-active > a[href^="#tabs"], li.active > a[href^="#tabs"]');
    return a ? String(a.getAttribute("href") || "") : "";
  }

  /** Ada isian borang SIPP yang diubah tetapi belum disimpan? (isian milik panel kita tidak dihitung) */
  function adaBorangBelumDisimpan() {
    const kolom = document.querySelectorAll("form input, form textarea, form select");
    for (const e of kolom) {
      if (dalamAleta(e) || e.disabled) continue;
      const jenis = String(e.type || "").toLowerCase();
      if (["hidden", "button", "submit", "reset", "search", "file", "image"].includes(jenis)) continue;
      if (jenis === "checkbox" || jenis === "radio") {
        if (e.checked !== e.defaultChecked) return true;
      } else if (e.tagName === "SELECT") {
        if (Array.from(e.options).some((o) => o.selected !== o.defaultSelected)) return true;
      } else if (String(e.value) !== String(e.defaultValue)) {
        return true;
      }
    }
    return false;
  }

  /** Membuang tembolok data panel ALETA untuk perkara ini (yang selamat dari muat ulang: penyimpanan ekstensi). */
  async function buangTembolok(nomor) {
    const k = kunciNomor(nomor);
    try {
      const s = await chrome.storage.local.get([KUNCI_KONTEKS]);
      const peta = s && s[KUNCI_KONTEKS] && typeof s[KUNCI_KONTEKS] === "object" ? { ...s[KUNCI_KONTEKS] } : null;
      if (peta) {
        let ubah = false;
        for (const n of Object.keys(peta)) {
          if (kunciNomor(n) === k) {
            delete peta[n];
            ubah = true;
          }
        }
        if (ubah) await chrome.storage.local.set({ [KUNCI_KONTEKS]: peta });
      }
    } catch {
      /* tembolok hanya kemudahan */
    }
    try {
      // Penjaga panel di halaman ini: tanpa ini panel menolak menggambar ulang untuk nomor yang sama.
      if (typeof nomorTerakhir !== "undefined") {
        // eslint-disable-next-line no-global-assign
        nomorTerakhir = "";
      }
    } catch {
      /* panel hanya kemudahan */
    }
  }

  /** Muat ulang halaman perkara: konfirmasi bila ada isian belum disimpan, buang tembolok, ingat tab, muat ulang. */
  async function muatUlang() {
    if (S.memuatUlang) return false;
    const nomor = nomorHalaman();
    if (adaBorangBelumDisimpan()) {
      let lanjut = false;
      try {
        lanjut = globalThis.confirm("Ada isian di halaman ini yang belum disimpan. Jika dimuat ulang, isian itu akan hilang. Tetap muat ulang?");
      } catch {
        lanjut = false;
      }
      if (!lanjut) return false;
    }
    S.memuatUlang = true;
    await buangTembolok(nomor);
    try {
      await chrome.storage.local.set({ [KUNCI_TAB]: { kunci: kunciNomor(nomor), tab: tabAktif(), waktu: Date.now() } });
    } catch {
      /* tab hanya kemudahan */
    }
    const mu = globalThis.aletaMuatUlangSipp;
    if (mu && typeof mu.muatUlangSekarang === "function") {
      const jalan = await mu.muatUlangSekarang(nomor, null);
      if (jalan === false) S.memuatUlang = false;
      return jalan !== false;
    }
    S.memuatUlang = false;
    return false;
  }

  /** Sesudah dimuat ulang: kembali ke tab yang tadi terbuka (sekali saja; catatan dicabut lebih dulu). */
  async function pulihkanTab(nomor) {
    if (S.tabDipulihkan === nomor) return;
    S.tabDipulihkan = nomor;
    let rec = null;
    try {
      const s = await chrome.storage.local.get([KUNCI_TAB]);
      rec = s && s[KUNCI_TAB];
      if (rec) await chrome.storage.local.remove(KUNCI_TAB);
    } catch {
      return;
    }
    if (!rec || rec.kunci !== kunciNomor(nomor) || !rec.tab || Date.now() - Number(rec.waktu || 0) > UMUR_TAB_MS) return;
    const mulaiMs = Date.now();
    const coba = () => {
      const a = document.querySelector(`a[href="${rec.tab}"]`);
      if (a) {
        a.click();
        return;
      }
      if (Date.now() - mulaiMs < 10000) setTimeout(coba, 300);
    };
    coba();
  }

  function buatTombolMuat() {
    const t = el("button", "aleta-ts-tombol aleta-ts-muat");
    t.type = "button";
    t.setAttribute("data-aleta-muat-ulang", "perkara");
    const ikon = el("i", "fa fa-repeat");
    ikon.setAttribute("aria-hidden", "true");
    t.append(ikon, el("span", "aleta-ts-label-muat", "Muat ulang"));
    t.title = "Muat ulang halaman perkara ini (tetap di perkara dan tab yang sama) supaya berkas dan data terbaru tampil";
    t.addEventListener("click", () => void muatUlang());
    return t;
  }

  /** Memasang tombol: di samping "Tarik data" bila ada, kalau tidak berdiri sendiri di tempat yang sama. */
  /**
   * 22 Okt: gambar besar "705" di kepala SIPP menutupi tombol sehingga tidak dapat diklik. z-index wadah kita
   * hanya berlaku bila .h_right tidak membentuk lapisan sendiri; bila membentuk (z-index bukan auto), wadah
   * .h_right dinaikkan sekali. Tidak mengubah isi atau letak SIPP.
   */
  function naikkanLapisan(h) {
    try {
      if (!h || h.dataset.aletaLapisan === "1") return;
      const zi = getComputedStyle(h).zIndex;
      if (zi && zi !== "auto") h.style.zIndex = "2147483000";
      h.dataset.aletaLapisan = "1";
    } catch {
      /* gaya tidak terbaca: biarkan */
    }
  }

  function pasangMuat(k, nomor) {
    pasangGaya();
    const tarik = document.getElementById(ID);
    let mandiri = document.getElementById(ID_MU);
    if (tarik) {
      if (mandiri) mandiri.remove();
      if (!tarik.querySelector("[data-aleta-muat-ulang]")) tarik.appendChild(buatTombolMuat());
    } else {
      if (!mandiri) {
        mandiri = el("div", "aleta-sisip aleta-ts");
        mandiri.id = ID_MU;
        mandiri.appendChild(buatTombolMuat());
        k.h.insertBefore(mandiri, k.h.firstChild);
        naikkanLapisan(k.h);
      }
      selarasLetak(mandiri, k);
    }
    void pulihkanTab(nomor);
  }

  function lepasMuat() {
    const m = document.getElementById(ID_MU);
    if (m) m.remove();
  }

  function pasang() {
    if (!nyala || !document.body || !halamanPerkara()) {
      if (S.akar || document.getElementById(ID)) bersihkan();
      lepasMuat();
      return { tombol: false, muat: false };
    }
    const k = kepala();
    const nomor = nomorHalaman();
    if (!k || !nomor) {
      if (S.akar || document.getElementById(ID)) bersihkan();
      lepasMuat();
      return { tombol: false, muat: false };
    }
    if (!berhak()) {
      if (S.akar || document.getElementById(ID)) bersihkan();
      pasangMuat(k, nomor);
      return { tombol: false, muat: true };
    }
    pasangGaya();
    if (S.nomor && S.nomor !== nomor) bersihkan();
    let akar = document.getElementById(ID);
    if (!akar) {
      akar = buatAkar();
      k.h.insertBefore(akar, k.h.firstChild);
      naikkanLapisan(k.h);
      S.akar = akar;
      S.teksTerakhir = "";
    }
    S.akar = akar;
    selarasLetak(akar, k);
    if (S.nomor !== nomor) {
      S.nomor = nomor;
      void tanya(true);
    }
    gambar();
    pasangMuat(k, nomor);
    return { tombol: true, muat: true, nomor };
  }

  let detak = null;
  async function mulai() {
    try {
      let aktif = true;
      try {
        const s = await chrome.storage.local.get(["aktif"]);
        aktif = !s || s.aktif !== false;
      } catch {
        /* di luar konteks ekstensi */
      }
      nyala = aktif;
      try {
        chrome.storage.onChanged.addListener((ubah, wilayah) => {
          if (wilayah !== "local" || !ubah || !ubah.aktif) return;
          nyala = ubah.aktif.newValue !== false;
        });
      } catch {
        /* di luar konteks ekstensi */
      }
      if (/\/aps_badilag\//i.test(String(location.pathname || ""))) return;
      document.addEventListener("aleta-uji-berubah", () => pasang());
      pasang();
      if (!detak) {
        // Murah: beberapa pembacaan DOM. Kepala SIPP dapat digambar ulang sewaktu-waktu.
        detak = (globalThis.ALETA_PENGAMAT ? globalThis.ALETA_PENGAMAT.denyut : setInterval)(() => {
          try {
            pasang();
          } catch {
            /* tambahan: kegagalannya tidak boleh mengganggu SIPP */
          }
        }, 1500);
      }
    } catch {
      /* tambahan: kegagalannya tidak boleh mengganggu SIPP */
    }
  }

  globalThis.aletaTarikSatu = {
    versi: "w29-21okt-1",
    pasang,
    bersihkan,
    tanya,
    minta,
    muatUlang,
    adaBorangBelumDisimpan,
    keadaan: () => S,
    murni: { umurTeks, susunKabar },
  };
  void mulai();
})();
