"use strict";

/**
 * ============================================================================
 * MENU "ABT BY DERRY" DAN "ALETA" DI BILAH ATAS SIPP (22 Okt 2026)
 * ============================================================================
 *
 * Permintaan pengguna: di samping tab "Perdata" pada bilah menu atas SIPP, tambah
 * "ABT By Derry", lalu "ALETA", dengan model yang SAMA dengan butir menu SIPP.
 *
 *   Home | Jurnal Perkara | Register Induk Keuangan | Perdata | ABT By Derry |
 *   ALETA | Jinayat | Jinayat Anak | Delegasi | Laporan | ...
 *
 * BENTUK. Persis butir menu SIPP (application/views/Menu/menu.php):
 *     <li class="has-sub"><a href="...">Judul</a><ul></ul></li>
 * di dalam  div#cssmenu > ul.nav.navbar-nav. Tidak ada kelas, ukuran, atau warna
 * ALETA di sini: gaya, hover, huruf, dan tingginya datang dari #cssmenu SIPP
 * sendiri. Satu-satunya tambahan adalah kelas penanda "aleta-sisip" (diabaikan
 * pengamat konten.js) dan atribut data-aleta-menu. Tidak merusak submenu SIPP:
 * butir disisipkan sebagai saudara <li> tingkat atas, submenu SIPP tidak disentuh.
 * Dipasang ulang bila SIPP menggambar ulang bilahnya; tidak pernah ganda.
 *
 * "ABT BY DERRY" - mengikuti sesi, TANPA menyimpan sandi apa pun:
 *   1. Periksa sesi ALETA (rute /ekstensi/siapa yang dipakai panel). Belum masuk:
 *      coba dulu masuk dengan sesi SIPP yang sudah terbuka (jalur "Masuk dengan
 *      akun SIPP ini" yang sudah ada, tanpa sandi); tetap belum -> pesan "Masuk ke
 *      ALETA dulu" + tautan masuk. ABT TIDAK dibuka.
 *   2. Akun ALETA tanpa hak Blangko Derry -> pesan, butir menu disembunyikan.
 *   3. Sudah masuk ALETA -> tab baru ke ABT dengan penanda #aleta-derry=1.
 *   4. Di ABT: sudah masuk -> Blangko ABT by Derry Briantono terbuka sendiri
 *      (aletaBlangkoDerry.buka). ABT menampilkan halaman masuk -> catatan "Masuk
 *      dengan akun SIPP Anda, lalu Blangko ABT by Derry Briantono terbuka sendiri"
 *      dan niat disimpan (chrome.storage.local, hanya tanda waktu, 5 menit);
 *      pengguna masuk SENDIRI (atau lewat masuk otomatis ekstensi yang sudah
 *      ada), lalu ekstensi mengarahkan ke Blangko ABT by Derry Briantono.
 *   Berkas ini TIDAK PERNAH mengisi sandi, tidak mengisi kolom masuk ABT, dan
 *   tidak menekan tombol masuk.
 *
 * "ALETA" - tautan biasa ke portal (tab baru). Portal sendiri yang menampilkan
 *   beranda atau halaman masuk menurut keadaan sesinya.
 *
 * "E-COURT" (butir ketiga, sesudah ALETA) - pintu ke https://ecourt.mahkamahagung.go.id/Login
 *   lewat akun e-Court milik pengguna ALETA itu sendiri (peran e-Court mengikuti akunnya):
 *   1. Wajib masuk ALETA (sama dengan ABT By Derry; sesi SIPP dicoba dulu).
 *   2. Akun SIPP yang terbuka dijaga: tertaut ke pengguna ALETA lain -> ditolak
 *      (server: periksaAkunSippTerbuka lewat ?dariSipp=1).
 *   3. Belum menyimpan akun e-Court -> tab baru ke formulir "Akun e-Court saya" di portal
 *      (penyimpanan sandi yang SUDAH ada: disandi di bot, tidak pernah dikirim balik).
 *      Sesudah tersimpan, pengguna klik E-Court lagi.
 *   4. Sudah ada -> tab baru ke halaman Login e-Court. Surel akun tersimpan diisikan ke
 *      kolom nama pengguna (ecourt-masuk.js, lewat pekerja latar); sandi, captcha, dan
 *      tombol masuk TIDAK pernah disentuh. Selama tab itu terbuka dan pengguna sudah
 *      masuk, ecourt-masuk.js menjaga sesi tetap hidup dengan satu permintaan ringan
 *      berkala ke halaman Login e-Court (yang mengalihkan bila sesinya sah).
 *   Tidak satu kata pun milik ALETA ditulis ke halaman e-Court.
 *
 * Hak: "ABT By Derry" hanya untuk akun yang boleh membuka Blangko Derry (admin,
 * hakim, panitera/pp, jurusita, ptsp - aturan berhakDaftar blangko-derry.js).
 * Selagi akunnya belum diketahui (belum masuk ALETA) butirnya tampil. Saklar di
 * popup ("menuAtasSipp", bawaan menyala) mematikan ketiga butir.
 *
 * Tidak satu pun nilai ditulis ke isian SIPP/ABT; hanya label menu di tampilan
 * halaman (sama seperti tombol ALETA yang sudah ada di SIPP).
 */
(function menuAtasModul() {
  if (typeof globalThis === "undefined" || globalThis.aletaMenuAtas) return;

  // ──────────────────────────────────────────────────────────────────────────
  // Konstanta
  // ──────────────────────────────────────────────────────────────────────────
  const KUNCI_SAKLAR = "menuAtasSipp";
  const KUNCI_NIAT = "menuAtasNiatDerry";
  const BATAS_NIAT_MS = 5 * 60 * 1000;
  const HASH_DERRY = "aleta-derry=1";
  const API_SIAPA = "/aleta/api/aleta-ecourt/ekstensi/siapa";
  /** Sesi e-Court pribadi + akun e-Court tersimpan (surel, tanpa sandi). ?dariSipp=1 = penjaga identitas SIPP di server. */
  const API_ECOURT_SESI = "/aleta/api/aleta-ecourt/ecourt-sesi?dariSipp=1";
  /** Formulir "Akun e-Court saya" di portal (jalur di dalam portal, tanpa basePath). */
  const JALUR_FORMULIR_ECOURT = "/admin/aleta-ecourt?dari=menu#sesi-ecourt-saya";
  const URL_ECOURT_LOGIN = "https://ecourt.mahkamahagung.go.id/Login";
  const KUNCI_HAK = "aletaMenuAtasHak";
  const UMUR_HAK_MS = 5 * 60 * 1000;
  const KUNCI_ALIH = "aletaMenuAtasAlih";
  const ID_GAYA = "aleta-menu-atas-gaya";
  const ATRIBUT = "data-aleta-menu";

  /** Urutan butir persis seperti yang diminta: ABT By Derry, lalu ALETA. */
  const BUTIR = [
    { kode: "abt", teks: "ABT By Derry", judul: "Blangko ABT by Derry Briantono: perkara, isian, dan cetak dalam satu halaman (tab baru)" },
    { kode: "aleta", teks: "ALETA", judul: "Portal ALETA (tab baru)" },
    { kode: "ecourt", teks: "E-Court", judul: "e-Court Mahkamah Agung dengan akun e-Court Anda sendiri (tab baru)" },
  ];

  // ──────────────────────────────────────────────────────────────────────────
  // Pembantu kecil
  // ──────────────────────────────────────────────────────────────────────────
  const sebaris = (t) => String(t == null ? "" : t).replace(/\s+/g, " ").trim();
  const tunggu = (ms) => new Promise((r) => setTimeout(r, ms));
  const diAbt = (loc) => /\/aps_badilag\//i.test(String((loc || location).pathname || ""));
  /** Halaman aplikasi ABT sendiri (.../abt/...) - bukan halaman masuk atau menu APS. */
  const diAplikasiAbt = (loc) => /\/aps_badilag\/abt(?:\/|$)/i.test(String((loc || location).pathname || ""));

  async function bacaLokal(kunci) {
    try {
      return (await chrome.storage.local.get(kunci)) || {};
    } catch {
      return {};
    }
  }
  async function tulisLokal(isi) {
    try {
      await chrome.storage.local.set(isi);
      return true;
    } catch {
      return false;
    }
  }
  async function hapusLokal(kunci) {
    try {
      await chrome.storage.local.remove(kunci);
    } catch {
      /* penanda hanya pembantu */
    }
  }
  function sesiBaca(kunci) {
    try {
      return globalThis.sessionStorage ? globalThis.sessionStorage.getItem(kunci) : null;
    } catch {
      return null;
    }
  }
  function sesiTulis(kunci, nilai) {
    try {
      if (!globalThis.sessionStorage) return;
      if (nilai === null) globalThis.sessionStorage.removeItem(kunci);
      else globalThis.sessionStorage.setItem(kunci, nilai);
    } catch {
      /* tanpa sessionStorage: tidak diingat */
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Alamat
  // ──────────────────────────────────────────────────────────────────────────
  /** Portal ALETA dilayani satu asal dengan SIPP/ABT di bawah /aleta (basePath). */
  function alamatAleta(loc) {
    return `${(loc || location).origin}/aleta`;
  }
  /** Halaman masuk portal; `kembali` = jalur di dalam portal tujuan sesudah masuk (login/page.tsx tujuanKembaliAman). */
  function alamatMasukAleta(loc, kembali) {
    const dasar = `${alamatAleta(loc)}/login`;
    return kembali ? `${dasar}?kembali=${encodeURIComponent(kembali)}` : dasar;
  }
  /** Formulir akun e-Court di portal (tab baru), dengan penanda asal supaya portal menyebut peran dan jalan pulang. */
  function alamatFormulirEcourt(loc) {
    return `${alamatAleta(loc)}${JALUR_FORMULIR_ECOURT}`;
  }
  /** Blangko ABT by Derry Briantono: beranda ABT dengan penanda niat di hash (tidak dikirim ke server ABT). */
  function alamatAbtDerry(loc) {
    const l = loc || location;
    const cocok = String(l.pathname || "").match(/^(.*?\/aps_badilag\/abt)\//i);
    const dasar = cocok ? `${l.origin}${cocok[1]}` : `${l.origin}/aps_badilag/abt`;
    return `${dasar}/main/beranda#${HASH_DERRY}`;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Hak - MURNI (diuji langsung)
  // ──────────────────────────────────────────────────────────────────────────
  /** Golongan menu -> himpunan peran Blangko Derry (aturan yang sama dengan peranDariGolongan blangko-derry.js). */
  function peranDariGolongan(golongan) {
    const hasil = new Set();
    for (const g of golongan || []) {
      const x = String(g || "").toLowerCase();
      if (x === "admin") hasil.add("admin");
      else if (x === "hakim" || x === "ketua") hasil.add("hakim");
      else if (["pp", "panitera", "panmud", "panitera-utama", "analis"].includes(x)) hasil.add("pp");
      else if (x === "jurusita") hasil.add("js");
      else if (x === "ptsp") hasil.add("ptsp");
    }
    return hasil;
  }
  /**
   * Boleh membuka Blangko ABT by Derry Briantono? Aturan yang sama dengan berhakDaftar
   * (blangko-derry.js): admin, hakim, pp, jurusita, ptsp. `siapa` = jawaban /ekstensi/siapa.
   */
  function bolehDerry(siapa) {
    if (!siapa || typeof siapa !== "object") return false;
    const roleId = String(siapa.roleId || "").toLowerCase();
    if (roleId === "super-admin" || roleId === "admin") return true;
    let golongan = [];
    if (typeof alatGolonganMenuSemua === "function") {
      try {
        golongan = alatGolonganMenuSemua({
          peran: siapa.peran,
          roleId: siapa.roleId,
          bolehKasir: siapa.bolehKasir,
          peranTambahan: siapa.peranTambahan,
          golonganMenu: siapa.golonganMenu,
        });
      } catch {
        golongan = [];
      }
    }
    if (!golongan.length && Array.isArray(siapa.golonganMenu)) golongan = siapa.golonganMenu;
    const peran = peranDariGolongan(golongan);
    return ["admin", "hakim", "pp", "js", "ptsp"].some((x) => peran.has(x));
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Sesi ALETA
  // ──────────────────────────────────────────────────────────────────────────
  /** { status: "ok", siapa } | { status: "belum-masuk" } | { status: "galat" } */
  async function ambilSiapa() {
    try {
      const r = await fetch(API_SIAPA, { credentials: "include", cache: "no-store" });
      if (r.status === 401 || r.status === 403) return { status: "belum-masuk" };
      if (!r.ok) return { status: "galat" };
      const j = await r.json().catch(() => null);
      const data = j && typeof j === "object" ? (j.data !== undefined ? j.data : j) : null;
      if (!data || typeof data !== "object") return { status: "galat" };
      return { status: "ok", siapa: data };
    } catch {
      return { status: "galat" };
    }
  }

  /**
   * Memastikan pengguna masuk ALETA. Belum masuk -> mencoba SEKALI memakai sesi SIPP yang sudah terbuka
   * (jalur "Masuk dengan akun SIPP ini" panel, tanpa sandi). Hasil tetap { status, siapa? }.
   */
  async function pastikanMasukAleta(opsi) {
    const o = opsi || {};
    let h = await (o.ambilSiapa || ambilSiapa)();
    if (h.status === "belum-masuk") {
      const masuk = o.masukDariSesiSipp || (typeof masukAletaDariSesiSipp === "function" ? masukAletaDariSesiSipp : null);
      if (masuk) {
        try {
          const m = await masuk(true);
          if (m && m.jenis === "masuk") h = await (o.ambilSiapa || ambilSiapa)();
        } catch {
          /* tetap belum masuk: pesan di bawah */
        }
      }
    }
    return h;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Kabar singkat
  // ──────────────────────────────────────────────────────────────────────────
  const GAYA = `
.aleta-menu-kabar{position:fixed;right:16px;bottom:16px;z-index:2147483000;max-width:400px;padding:9px 12px;border-radius:6px;background:var(--s-hijau,#007640);color:var(--s-tulisan-atas,#fff);font-size:14px;line-height:1.4;box-shadow:0 2px 10px rgba(0,0,0,.3)}
.aleta-menu-kabar a{color:inherit;text-decoration:underline;margin-left:6px;font-weight:bold}
.aleta-menu-catatan{margin:0 0 10px;padding:8px 12px;border-radius:4px;border:1px solid var(--s-garis-hijau,#007640);background:var(--s-permukaan-2,#eeffdd);color:var(--s-tulisan,#1f2933);font-size:13px;line-height:1.4}
`;
  function sisipkanGaya(d) {
    if (!d.head || d.getElementById(ID_GAYA)) return;
    const s = d.createElement("style");
    s.id = ID_GAYA;
    s.textContent = GAYA;
    d.head.appendChild(s);
  }

  let kabarSekarang = null;
  /** Kabar singkat di pojok kanan bawah; `tautan` = { teks, href } opsional. */
  function kabar(teks, tautan, d) {
    const doc = d || document;
    sisipkanGaya(doc);
    if (kabarSekarang && kabarSekarang.parentNode) kabarSekarang.remove();
    const k = doc.createElement("div");
    k.className = "aleta-sisip aleta-menu-kabar";
    k.setAttribute("role", "status");
    k.appendChild(doc.createTextNode(teks));
    if (tautan && tautan.href) {
      const a = doc.createElement("a");
      a.href = tautan.href;
      a.target = "_blank";
      a.rel = "noopener";
      a.textContent = tautan.teks || "Buka";
      k.appendChild(a);
    }
    (doc.body || doc.documentElement).appendChild(k);
    kabarSekarang = k;
    setTimeout(() => {
      if (k.parentNode) k.remove();
    }, 14000);
    return k;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Tab baru - lewat pekerja latar (tidak terhalang penahan pop-up); jatuh ke window.open
  // ──────────────────────────────────────────────────────────────────────────
  function kirimLatar(pesan) {
    return new Promise((selesai) => {
      const jam = setTimeout(() => selesai(null), 8000);
      try {
        chrome.runtime.sendMessage({ sumber: "aleta-panel", ...pesan }, (h) => {
          void chrome.runtime.lastError;
          clearTimeout(jam);
          selesai(h || null);
        });
      } catch {
        clearTimeout(jam);
        selesai(null);
      }
    });
  }
  /** `tujuan`: "abt" | "aleta" (alamatnya disusun pekerja latar dari asal halaman ini). */
  async function bukaTab(tujuan, alamatCadangan) {
    const h = await kirimLatar({ jenis: "menu-buka-tab", tujuan });
    if (h && h.ok) return true;
    try {
      const w = window.open(alamatCadangan, "_blank", "noopener");
      return w !== undefined;
    } catch {
      return false;
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Klik butir menu
  // ──────────────────────────────────────────────────────────────────────────
  async function klikAbtDerry(opsi) {
    const o = opsi || {};
    const h = await pastikanMasukAleta(o);
    if (h.status === "belum-masuk") {
      kabar("Masuk ke ALETA dulu, lalu klik ABT By Derry lagi.", { teks: "Masuk ke ALETA", href: alamatMasukAleta(o.loc) }, o.doc);
      return { ok: false, sebab: "belum-masuk" };
    }
    if (h.status !== "ok") {
      kabar("ALETA belum dapat dihubungi. Coba lagi sebentar lagi.", null, o.doc);
      return { ok: false, sebab: "tak-terjangkau" };
    }
    if (!bolehDerry(h.siapa)) {
      sesiTulis(KUNCI_HAK, JSON.stringify({ saat: Date.now(), abt: false }));
      for (const li of Array.from((o.doc || document).querySelectorAll(`li[${ATRIBUT}="abt"]`))) li.remove();
      kabar("Akun ALETA ini tidak memakai Blangko ABT by Derry Briantono.", null, o.doc);
      return { ok: false, sebab: "tanpa-hak" };
    }
    sesiTulis(KUNCI_HAK, JSON.stringify({ saat: Date.now(), abt: true }));
    const dibuka = await (o.bukaTab || bukaTab)("abt", alamatAbtDerry(o.loc));
    return { ok: dibuka === true, sebab: dibuka ? "" : "tab-gagal" };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // E-Court
  // ──────────────────────────────────────────────────────────────────────────
  /**
   * Membaca akun e-Court tersimpan milik pengguna ALETA yang masuk (surel saja; sandinya tidak pernah keluar dari bot).
   * Pulang { status: "ada", surel } | { status: "belum-ada" } | { status: "tak-bisa-periksa" } |
   * { status: "sipp-orang-lain", pesan } | { status: "tak-didukung" } | { status: "belum-masuk" } | { status: "galat" }
   */
  async function bacaAkunEcourt() {
    let r;
    try {
      r = await fetch(API_ECOURT_SESI, { credentials: "include", cache: "no-store" });
    } catch {
      return { status: "galat" };
    }
    if (r.status === 401 || r.status === 403) return { status: "belum-masuk" };
    if (!r.ok) return { status: "galat" };
    const j = await r.json().catch(() => null);
    const d = j && typeof j === "object" ? (j.data !== undefined ? j.data : j) : null;
    if (!d || typeof d !== "object") return { status: "galat" };
    if (d.alasan === "akun_sipp_milik_pengguna_lain") return { status: "sipp-orang-lain", pesan: String(d.pesan || "") };
    if (d.tersedia !== true) return { status: "tak-bisa-periksa" };
    if (d.akunDidukung === false) return { status: "tak-didukung" };
    const akun = (Array.isArray(d.akun) ? d.akun : []).filter((a) => a && a.adaSandi === true && sebaris(a.email));
    if (!akun.length) return { status: "belum-ada" };
    // Akun yang sesinya sedang tersambung didahulukan; selain itu yang terakhir diperbarui.
    const tersambung = new Set((Array.isArray(d.sesi) ? d.sesi : []).filter((s) => s && s.keadaan === "tersambung").map((s) => s.peran));
    akun.sort((a, b) => Number(tersambung.has(b.peran)) - Number(tersambung.has(a.peran)) || String(b.diperbaruiPada || "").localeCompare(String(a.diperbaruiPada || "")));
    return { status: "ada", surel: sebaris(akun[0].email) };
  }

  const KEMBALI_ECOURT = JALUR_FORMULIR_ECOURT;

  async function klikEcourt(opsi) {
    const o = opsi || {};
    const h = await pastikanMasukAleta(o);
    if (h.status === "belum-masuk") {
      kabar("Masuk ke ALETA dulu, lalu klik E-Court lagi. Sesudah masuk, formulir akun e-Court Anda terbuka.", { teks: "Masuk ke ALETA", href: alamatMasukAleta(o.loc, KEMBALI_ECOURT) }, o.doc);
      return { ok: false, sebab: "belum-masuk" };
    }
    if (h.status !== "ok") {
      kabar("ALETA belum dapat dihubungi. Coba lagi sebentar lagi.", null, o.doc);
      return { ok: false, sebab: "tak-terjangkau" };
    }
    const a = await (o.bacaAkunEcourt || bacaAkunEcourt)();
    if (a.status === "belum-masuk") {
      kabar("Masuk ke ALETA dulu, lalu klik E-Court lagi.", { teks: "Masuk ke ALETA", href: alamatMasukAleta(o.loc, KEMBALI_ECOURT) }, o.doc);
      return { ok: false, sebab: "belum-masuk" };
    }
    if (a.status === "sipp-orang-lain") {
      kabar(a.pesan || "Akun SIPP yang terbuka tersimpan atas nama pengguna ALETA lain. Masuk ALETA dengan akun Anda sendiri.", null, o.doc);
      return { ok: false, sebab: "sipp-orang-lain" };
    }
    if (a.status === "belum-ada" || a.status === "tak-bisa-periksa") {
      const dibuka = await (o.bukaTab || bukaTab)("formulir-ecourt", alamatFormulirEcourt(o.loc));
      kabar(
        a.status === "belum-ada"
          ? "Isi akun e-Court Anda dulu (sesuai akun e-Court Anda sendiri - ini menentukan peran Anda). Sesudah tersimpan, klik E-Court lagi."
          : "ALETA belum dapat memeriksa akun e-Court Anda. Periksa atau isi akunnya di halaman yang dibuka, lalu klik E-Court lagi.",
        null,
        o.doc
      );
      return { ok: dibuka === true, sebab: "akun-belum-diisi" };
    }
    if (a.status === "tak-didukung") {
      kabar("Penyimpanan akun e-Court belum didukung server ini, jadi e-Court dibuka tanpa pengisian nama pengguna.", null, o.doc);
    } else if (a.status !== "ada") {
      kabar("ALETA belum dapat memeriksa akun e-Court Anda. Coba lagi sebentar lagi.", null, o.doc);
      return { ok: false, sebab: "tak-terjangkau" };
    }
    const dibuka = await (o.bukaEcourt || bukaEcourt)(a.status === "ada" ? a.surel : "");
    return { ok: dibuka === true, sebab: dibuka ? "" : "tab-gagal", surel: a.status === "ada" };
  }

  /** Tab baru ke Login e-Court; pekerja latar mencatat surelnya untuk tab itu (skrip e-Court mengisinya, tanpa sandi). */
  async function bukaEcourt(surel) {
    const h = await kirimLatar({ jenis: "menu-ecourt-buka", surel: String(surel || "") });
    if (h && h.ok) return true;
    try {
      const w = window.open(URL_ECOURT_LOGIN, "_blank", "noopener");
      return w !== undefined;
    } catch {
      return false;
    }
  }

  const KLIK = { abt: klikAbtDerry, ecourt: klikEcourt };

  // ──────────────────────────────────────────────────────────────────────────
  // Bilah menu SIPP
  // ──────────────────────────────────────────────────────────────────────────
  /** Teks langsung dari <a> sebuah butir (tanpa lencana anak seperti notifikasi Delegasi), huruf kecil. */
  function teksButir(li) {
    const a = Array.from(li.children).find((c) => c.tagName === "A");
    if (!a) return "";
    let t = "";
    for (const n of Array.from(a.childNodes)) if (n.nodeType === 3) t += n.textContent;
    return sebaris(t).toLowerCase();
  }
  const milik = (li) => li.hasAttribute && li.hasAttribute(ATRIBUT);

  /** <ul> tingkat atas bilah menu SIPP: div#cssmenu > ul (menu.php) atau ul.navbar-nav di .navbar (menu_b.php). */
  function cariBilah(d) {
    for (const sel of ["#cssmenu > ul", "div.navbar ul.navbar-nav", "#cssmenu ul"]) {
      for (const u of Array.from(d.querySelectorAll(sel))) {
        if (u.closest(".aleta-panel, .aleta-sisip")) continue;
        const anak = Array.from(u.children).filter((c) => c.tagName === "LI" && Array.from(c.children).some((x) => x.tagName === "A"));
        if (anak.length >= 2) return u;
      }
    }
    return null;
  }

  /** Titik sisip: butir sesudah "Perdata"; tanpa Perdata, sebelum "Jinayat"/"Delegasi"; selain itu di ujung. */
  function titikSisip(bilah) {
    const asli = Array.from(bilah.children).filter((c) => c.tagName === "LI" && !milik(c));
    const perdata = asli.find((li) => teksButir(li) === "perdata");
    if (perdata) {
      let n = perdata.nextElementSibling;
      while (n && milik(n)) n = n.nextElementSibling;
      return { acuan: perdata, sebelum: n };
    }
    const sebelum = asli.find((li) => teksButir(li) === "jinayat") || asli.find((li) => /^delegasi/.test(teksButir(li))) || null;
    return { acuan: asli[0] || null, sebelum };
  }

  function buatButir(d, butir, acuan, loc) {
    const li = d.createElement("li");
    // Kelas butir SIPP tanpa submenu ("has-sub" - menu.php mencetak setiap butir begitu) + penanda sisipan.
    const kelas = sebaris(String((acuan && acuan.className) || "has-sub").replace(/\b(active|selected|open)\b/g, ""));
    li.className = `${kelas || "has-sub"} aleta-sisip`;
    li.setAttribute(ATRIBUT, butir.kode);
    const a = d.createElement("a");
    a.textContent = butir.teks;
    a.title = butir.judul;
    if (butir.kode === "aleta") {
      a.href = alamatAleta(loc);
      a.target = "_blank";
      a.rel = "noopener";
    } else {
      a.href = "#";
      a.addEventListener("click", (e) => {
        e.preventDefault();
        const klik = KLIK[butir.kode];
        if (klik) void klik({ doc: d, loc }).catch(() => undefined);
      });
    }
    li.appendChild(a);
    li.appendChild(d.createElement("ul"));
    return li;
  }

  /** Kode butir yang harus tampil sekarang. */
  function kodeTampil(opsi) {
    const o = opsi || {};
    if (o.nyala === false) return [];
    return BUTIR.map((b) => b.kode).filter((k) => !(k === "abt" && o.tanpaAbt === true));
  }

  /**
   * Menyisipkan butir di bilah. Idempoten: urutannya benar dan berurutan -> tidak berbuat apa-apa; selain itu
   * milik kita dibuang dan disisipkan ulang. Pulang { dipasang, kode[] }.
   */
  function pasangMenu(doc, opsi) {
    const d = doc || document;
    const bilah = cariBilah(d);
    if (!bilah) return { dipasang: 0, kode: [] };
    const mau = kodeTampil(opsi);
    const ada = Array.from(bilah.children).filter((c) => c.tagName === "LI" && milik(c));
    const titik = titikSisip(bilah);
    const urutanAda = ada.map((li) => li.getAttribute(ATRIBUT));
    const berurutan = ada.every((li, i) => i === 0 || ada[i - 1].nextElementSibling === li);
    const letakBenar = ada.length === 0 || (berurutan && ada[ada.length - 1].nextElementSibling === (titik.sebelum || null));
    if (urutanAda.join("|") === mau.join("|") && letakBenar) return { dipasang: ada.length, kode: mau };
    for (const li of ada) li.remove();
    if (!mau.length) return { dipasang: 0, kode: [] };
    sisipkanGaya(d);
    const baru = titikSisip(bilah);
    const loc = (opsi && opsi.loc) || undefined;
    for (const kode of mau) {
      const butir = BUTIR.find((b) => b.kode === kode);
      bilah.insertBefore(buatButir(d, butir, baru.acuan, loc), baru.sebelum || null);
    }
    return { dipasang: mau.length, kode: mau };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // ABT: menerima niat, mengarahkan ke Blangko ABT by Derry Briantono
  // ──────────────────────────────────────────────────────────────────────────
  /** Halaman masuk ABT: formulir dengan userName + password (kenalan yang sama dengan masuk otomatis panel-alat.js). */
  function formulirMasukAbt(d) {
    const nama = d.querySelector('input[name="userName"]');
    const sandi = d.querySelector('input[name="password"]');
    if (!nama || !sandi) return null;
    return nama.form || sandi.form || null;
  }
  function namaPenggunaAbt(d) {
    const b = d.querySelector("#header .h_right b, .h_right b");
    return b ? sebaris(b.textContent) : "";
  }
  function tombolDerryAbt(d) {
    return Array.from(d.querySelectorAll("#navbar .accordion")).find((b) => /^\s*blangko\s+derry\b/i.test(String(b.textContent || ""))) || null;
  }

  /**
   * Menunggu tampilan Blangko ABT by Derry Briantono. Pulang { ok } atau
   * { ok:false, sebab: "tidak-terpasang" | "tanpa-derry" | "belum-masuk" }.
   */
  async function bukaDerryDiAbt(opsi) {
    const o = opsi || {};
    const d = o.doc || document;
    const jeda = o.tunggu || tunggu;
    const sekarang = o.sekarang || (() => Date.now());
    const mulai = sekarang();
    const batas = mulai + (o.batasMs || 20000);
    let api = null;
    let adaTombol = false;
    while (sekarang() < batas) {
      api = globalThis.aletaBlangkoDerry || null;
      adaTombol = Boolean(tombolDerryAbt(d));
      if (api && adaTombol) {
        const k = api.keadaan ? api.keadaan() : { aktif: false };
        if (k.aktif) return { ok: true };
        if (api.siapa()) api.buka();
        else if (sekarang() - mulai > (o.siapaMs || 8000)) break; // akun ALETA tak terbaca: jangan menunggu sampai batas
      } else if (!adaTombol && sekarang() - mulai > (o.tanpaDerryMs || 10000)) break;
      await jeda(o.detakMs || 400);
    }
    if (!api) return { ok: false, sebab: "tidak-terpasang" };
    if (!adaTombol) return { ok: false, sebab: "tanpa-derry" };
    if (!api.siapa()) return { ok: false, sebab: "belum-masuk" };
    return { ok: false, sebab: "tanpa-derry" };
  }

  function catatanMasuk(d) {
    if (d.querySelector(".aleta-menu-catatan")) return;
    const f = formulirMasukAbt(d);
    if (!f || !f.parentNode) return;
    sisipkanGaya(d);
    const c = d.createElement("div");
    c.className = "aleta-sisip aleta-menu-catatan";
    c.setAttribute("role", "note");
    c.textContent = "Masuk dengan akun SIPP Anda. Sesudah masuk, Blangko ABT by Derry Briantono terbuka sendiri.";
    f.parentNode.insertBefore(c, f);
  }

  async function niatSegar() {
    const n = (await bacaLokal([KUNCI_NIAT]))[KUNCI_NIAT];
    return n && Number.isFinite(Number(n.saat)) && Date.now() - Number(n.saat) < BATAS_NIAT_MS && Date.now() >= Number(n.saat) - 5000;
  }

  /** Arahan beruntun dibatasi: dua kali dalam dua menit, supaya halaman yang salah tidak memutar tanpa henti. */
  function bolehAlih() {
    let catat = { n: 0, saat: Date.now() };
    try {
      const x = JSON.parse(sesiBaca(KUNCI_ALIH) || "null");
      if (x && Date.now() - Number(x.saat) < 120000) catat = x;
    } catch {
      /* mulai baru */
    }
    if (catat.n >= 2) return false;
    sesiTulis(KUNCI_ALIH, JSON.stringify({ n: catat.n + 1, saat: catat.saat }));
    return true;
  }

  /** Dipanggil di setiap halaman ABT. Pulang ringkasan keputusan (dipakai uji). */
  async function terimaDiAbt(opsi) {
    const o = opsi || {};
    const d = o.doc || document;
    const loc = o.loc || location;
    const adaHash = String(loc.hash || "").includes(HASH_DERRY);
    const masuk = formulirMasukAbt(d);

    if (adaHash) {
      await tulisLokal({ [KUNCI_NIAT]: { saat: Date.now() } });
      if (diAplikasiAbt(loc)) {
        try {
          history.replaceState(null, "", `${loc.pathname}${loc.search}`);
        } catch {
          /* hash tetap: tidak mengganggu ABT */
        }
        await hapusLokal(KUNCI_NIAT);
        return lapor(await bukaDerryDiAbt(o), d, o);
      }
      if (masuk) {
        catatanMasuk(d);
        return { aksi: "catatan-masuk" };
      }
      return alihKeDerry(o, d, loc);
    }

    if (!(await niatSegar())) return { aksi: "tidak-ada-niat" };
    if (masuk) {
      catatanMasuk(d);
      return { aksi: "catatan-masuk" };
    }
    if (diAplikasiAbt(loc)) {
      await hapusLokal(KUNCI_NIAT);
      return lapor(await bukaDerryDiAbt(o), d, o);
    }
    return alihKeDerry(o, d, loc);
  }

  async function alihKeDerry(o, d, loc) {
    await hapusLokal(KUNCI_NIAT);
    if (!bolehAlih()) {
      kabar("Blangko ABT by Derry Briantono belum dapat dibuka dari halaman ini. Buka lewat menu ABT.", null, d);
      return { aksi: "alih-ditahan" };
    }
    const tujuan = alamatAbtDerry(loc);
    (o.alih || ((u) => loc.replace(u)))(tujuan);
    return { aksi: "alih", tujuan };
  }

  function lapor(h, d, o) {
    const api = globalThis.aletaBlangkoDerry;
    if (h.ok) {
      const nama = namaPenggunaAbt(d);
      const teks = nama ? `Blangko ABT by Derry Briantono dibuka. Akun ABT: ${nama}.` : "Blangko ABT by Derry Briantono dibuka.";
      if (api && typeof api.toast === "function") api.toast(teks);
      return { aksi: "dibuka", nama };
    }
    if (h.sebab === "belum-masuk") kabar("Masuk ke ALETA dulu supaya Blangko ABT by Derry Briantono dapat dibuka.", { teks: "Masuk ke ALETA", href: alamatMasukAleta(o.loc) }, d);
    else kabar("Blangko ABT by Derry Briantono tidak ada di menu ABT akun ini.", null, d);
    return { aksi: "gagal", sebab: h.sebab };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Pemasangan di SIPP
  // ──────────────────────────────────────────────────────────────────────────
  let nyala = true;
  let tanpaAbt = false;
  let jeda = null;

  function terapkan() {
    try {
      pasangMenu(document, { nyala, tanpaAbt });
    } catch {
      /* tambahan: kegagalannya tidak boleh mengganggu SIPP */
    }
  }
  function jadwalkan() {
    if (jeda) return;
    jeda = setTimeout(() => {
      jeda = null;
      terapkan();
    }, 120);
  }

  /** Hak "ABT By Derry": cadangan 5 menit di sessionStorage (hanya ya/tidak); selain itu satu GET ke /ekstensi/siapa. */
  async function muatHak() {
    try {
      const x = JSON.parse(sesiBaca(KUNCI_HAK) || "null");
      if (x && Date.now() - Number(x.saat) < UMUR_HAK_MS) {
        tanpaAbt = x.abt === false;
        return;
      }
    } catch {
      /* diperiksa ulang */
    }
    const h = await ambilSiapa();
    if (h.status !== "ok") return; // belum diketahui: butir tampil
    const boleh = bolehDerry(h.siapa);
    sesiTulis(KUNCI_HAK, JSON.stringify({ saat: Date.now(), abt: boleh }));
    tanpaAbt = !boleh;
    terapkan();
  }

  async function mulai() {
    try {
      if (diAbt()) {
        void terimaDiAbt().catch(() => undefined);
        return;
      }
      const s = await bacaLokal([KUNCI_SAKLAR]);
      nyala = s[KUNCI_SAKLAR] !== false;
      try {
        chrome.storage.onChanged.addListener((ubah, wilayah) => {
          if (wilayah !== "local" || !ubah || !ubah[KUNCI_SAKLAR]) return;
          nyala = ubah[KUNCI_SAKLAR].newValue !== false;
          terapkan();
        });
      } catch {
        /* di luar konteks ekstensi */
      }
      if (!document.body) return;
      terapkan();
      new MutationObserver((daftar) => {
        const dariKita = daftar.every((m) => {
          const t = m.target;
          if (t && t.nodeType === 1 && t.closest && t.closest(".aleta-sisip")) return true;
          const n = [...Array.from(m.addedNodes || []), ...Array.from(m.removedNodes || [])];
          return n.length > 0 && n.every((x) => x.nodeType === 1 && x.classList && x.classList.contains("aleta-sisip"));
        });
        if (!dariKita) jadwalkan();
      }).observe(document.body, { childList: true, subtree: true });
      if (nyala) void muatHak().catch(() => undefined);
    } catch {
      /* tambahan: kegagalannya tidak boleh mengganggu SIPP/ABT */
    }
  }

  const api = {
    versi: "menu-atas-1",
    pasangMenu,
    terimaDiAbt,
    bukaDerryDiAbt,
    klikAbtDerry,
    pastikanMasukAleta,
    muatHak,
    mulai,
    murni: { bolehDerry, peranDariGolongan, alamatAbtDerry, alamatAleta, alamatMasukAleta, cariBilah, titikSisip, kodeTampil, teksButir },
    KUNCI_SAKLAR,
    KUNCI_NIAT,
    HASH_DERRY,
  };
  globalThis.aletaMenuAtas = api;
  void mulai();
})();
