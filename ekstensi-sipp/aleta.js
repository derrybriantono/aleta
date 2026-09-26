"use strict";

/**
 * ============================================================================
 * PANEL ALETA DI HALAMAN PORTAL ALETA SENDIRI
 * ============================================================================
 *
 * Ekstensi ini lahir untuk halaman SIPP dan ABT: menempelkan keterangan ALETA
 * ke halaman milik aplikasi lain. Di portal ALETA sendiri ia diam - padahal
 * dari sanalah petugas berangkat ke SIPP tiap pagi, dan dari sana pula ia
 * ingin tahu tiga hal yang tidak dijawab halaman portal mana pun: ekstensi
 * saya versi berapa dan apakah tertinggal, saya boleh apa lewat ekstensi, dan
 * bagaimana kembali ke perkara yang tadi saya buka di SIPP.
 *
 * Panel ini menjawab tiga hal itu, ditambah pintasan yang berbeda menurut
 * jabatan - hakim tidak perlu Update Manager, dan panitera pengganti tidak
 * perlu papan penetapan.
 *
 * ============================================================================
 * TEMANYA MENGIKUTI ALETA, BUKAN SEBALIKNYA
 * ============================================================================
 *
 * Di halaman SIPP panel membawa temanya sendiri dan mewarnai halaman. Di sini
 * tuan rumahnya ALETA: tema gelap-terang dibaca dari kelas `dark` pada <html>,
 * dan WARNANYA diambil dari token CSS ALETA (--card, --foreground, --primary,
 * ...) supaya panel dan halaman satu palet, bukan hijau di atas biru. Tombol
 * tema milik panel disingkirkan - dua saklar untuk satu tema hanya melahirkan
 * dua tema yang berselisih.
 *
 * ============================================================================
 * TIDAK MENGUBAH PORTAL, TIDAK MENYIMPAN KREDENSIAL
 * ============================================================================
 *
 * Yang dilakukan hanya menambah satu elemen melayang. Semua yang ditampilkan
 * dibaca dari rute portal dengan sesi peramban yang sudah ada; tidak ada satu
 * pun yang ditulis ke ALETA dari sini.
 */

const PENANDA_ALETA = "aleta-panel-portal";
const KUNCI_POSISI_ALETA = "posisiPanelAleta";
const KUNCI_RIWAYAT_SIPP = "riwayatPerkaraSipp";
const JALUR_TANPA_PANEL = ["/login", "/verifikasi-dokumen"];

/** Awalan jalur portal - "/aleta" di peladen, kosong di pengembangan. */
function dasarPortal() {
  const cocok = String(location.pathname || "").match(/^(\/aleta)(?=\/|$)/);
  return cocok ? cocok[1] : "";
}

function alamatSiapa() {
  return `${dasarPortal()}/api/aleta-ecourt/ekstensi/siapa`;
}

function buatElemen(tag, kelas, teks) {
  const el = document.createElement(tag);
  if (kelas) el.className = kelas;
  if (teks !== undefined && teks !== null) el.textContent = teks;
  return el;
}

function tautan(href, teks, kelas) {
  const a = buatElemen("a", kelas || "aleta-portal-tautan", teks);
  a.href = href;
  a.rel = "noreferrer";
  return a;
}

// ─── Tema: mengikuti ALETA ───────────────────────────────────────────────────

/** Token warna ALETA yang dipakai panel, dipetakan ke token panel.css. */
const PETA_WARNA = [
  ["--aleta-latar", "--card"],
  ["--aleta-latar-naik", "--muted"],
  ["--aleta-garis", "--border"],
  ["--aleta-garis-kuat", "--border"],
  ["--aleta-tulisan", "--foreground"],
  ["--aleta-tulisan-lembut", "--muted-foreground"],
  ["--aleta-merek", "--primary"],
  ["--aleta-aman", "--primary"],
];

function temaAleta() {
  return document.documentElement.classList.contains("dark") ? "gelap" : "terang";
}

/**
 * Menyalin palet ALETA ke panel.
 *
 * Token ALETA berbentuk tiga angka HSL tanpa fungsi ("212 46% 8%"), gaya
 * shadcn; dibungkus hsl() di sini. Token yang tidak ada dibiarkan - panel.css
 * punya nilai bawaannya sendiri, dan warna yang setengah tersalin lebih buruk
 * daripada palet panel yang utuh.
 */
function selaraskanDenganAleta(panel) {
  const gaya = getComputedStyle(document.documentElement);
  for (const [tujuan, sumber] of PETA_WARNA) {
    const nilai = gaya.getPropertyValue(sumber).trim();
    if (!nilai) continue;
    panel.style.setProperty(tujuan, /^hsl\(|^#|^rgb/.test(nilai) ? nilai : `hsl(${nilai})`);
  }
  panel.setAttribute("data-tema", temaAleta());
}

/**
 * ============================================================================
 * SATU TEMA UNTUK POPUP, WIDGET, SIPP, ABT, DAN PORTAL INI
 * ============================================================================
 *
 * Sebelumnya ada dua saklar yang tidak saling mengenal:
 *
 *   temaPanel   dipakai panel SIPP dan ABT, diubah dari tombol ☀/☾ di kepala
 *   temaPopup   dipakai jendela popup ikon Chrome, bawaannya "ikut peramban"
 *
 * dan portal ALETA punya yang ketiga lagi - kelas `dark` miliknya sendiri.
 * Akibatnya persis yang dilaporkan: panel gelap, popupnya putih menyilaukan,
 * dan tombol tema di salah satunya tidak pernah menyentuh yang lain.
 *
 * Sekarang temaPanel satu-satunya kebenaran. Di halaman ini ia disambungkan
 * DUA ARAH dengan tema portal:
 *
 *   portal berubah   -> ditulis ke temaPanel, sehingga popup, SIPP, dan ABT
 *                       ikut seketika
 *   temaPanel berubah -> portal diminta berganti lewat satu peristiwa DOM,
 *                       yang didengar PortalProvider (lihat app-state.tsx)
 *
 * Kenapa peristiwa, bukan menulis localStorage portal: temanya dipegang
 * keadaan React, dan localStorage yang diubah dari luar baru terbaca pada
 * pemuatan berikutnya - halamannya akan tampak menolak.
 *
 * Portal yang belum membawa pendengarnya tidak rusak sama sekali: peristiwa
 * itu tidak ditangkap siapa pun, dan panel tetap mengikuti tema portal
 * seperti sedia kala.
 */
const KUNCI_TEMA_BERSAMA = "temaPanel";
let temaBersamaTerakhir = "";
let pendengarTemaTerpasang = false;

function mintaPortalBertema(tema) {
  const bersih = tema === "terang" ? "terang" : "gelap";
  if (temaAleta() === bersih) return;
  try {
    window.dispatchEvent(new CustomEvent("aleta-ekstensi-tema", { detail: { tema: bersih } }));
  } catch {
    /* portal tetap pada temanya sendiri - panel mengikutinya */
  }
}

/**
 * ============================================================================
 * SAAT HALAMAN DIBUKA: YANG MEMAKSA HANYA PILIHAN YANG SUNGGUH PERNAH DIAMBIL
 * ============================================================================
 *
 * Dua arah sudah tersambung, tetapi PEMUATAN PERTAMA menuntut keputusan
 * tersendiri: siapa yang menang ketika keduanya berbeda dan belum ada yang
 * menekan apa pun?
 *
 * Bila petugas memang pernah memilih tema - dari popup, dari panel SIPP, dari
 * panel ABT - pilihan itu yang berlaku, dan portal diminta mengikutinya.
 * Itulah arti "temanya satu".
 *
 * Bila BELUM pernah ada yang memilih, tidak ada yang pantas dipaksakan.
 * Memaksakan bawaan ekstensi berarti membalik tampilan portal orang atas
 * sesuatu yang tidak pernah ia minta - sekali, tepat sesudah pembaruan, dan
 * tanpa keterangan apa pun. Yang dikerjakan justru sebaliknya: tema portal
 * DIADOPSI menjadi tema bersama, sehingga popup dan panel di tab lain ikut
 * kepadanya.
 */
async function samakanTemaDenganPortal() {
  try {
    const simpan = await chrome.storage.local.get([KUNCI_TEMA_BERSAMA]);
    const tersimpan = simpan[KUNCI_TEMA_BERSAMA];
    if (tersimpan !== "terang" && tersimpan !== "gelap") {
      temaBersamaTerakhir = temaAleta();
      await chrome.storage.local.set({ [KUNCI_TEMA_BERSAMA]: temaBersamaTerakhir });
      return;
    }
    temaBersamaTerakhir = tersimpan;
    mintaPortalBertema(tersimpan);
  } catch {
    /* di luar konteks ekstensi: portal memakai temanya sendiri */
  }
}

function ikutiTemaAleta(panel) {
  selaraskanDenganAleta(panel);
  // ALETA mengganti tema dengan menambah/membuang kelas pada <html>; itulah
  // satu-satunya sinyal yang perlu didengar.
  const pengamat = new MutationObserver(() => {
    if (!panel.isConnected) {
      pengamat.disconnect();
      return;
    }
    selaraskanDenganAleta(panel);
    // Tema portal yang baru diganti orangnya - dari tombol ALETA sendiri
    // maupun dari tombol panel ini - dituliskan ke penyimpanan bersama.
    // Dari sanalah popup ekstensi dan panel di tab SIPP/ABT mengikutinya.
    const kini = temaAleta();
    if (kini === temaBersamaTerakhir) return;
    temaBersamaTerakhir = kini;
    try {
      void chrome.storage.local.set({ [KUNCI_TEMA_BERSAMA]: kini });
    } catch {
      /* temanya tetap berlaku di halaman ini */
    }
  });
  pengamat.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

  // Arah sebaliknya: tema yang diganti dari popup atau dari tab SIPP/ABT
  // meminta portal ini ikut berganti.
  //
  // SEKALI SEUMUR HALAMAN, dan itu perlu disebut: fungsi ini dipanggil tiap
  // kali panel dibangun - saat tombol segarkan ditekan, dan saat saklar
  // induknya dinyalakan lagi - sedangkan pendengar penyimpanan hidup di
  // halamannya, bukan di panelnya. Tanpa pagar ini, tiap pembangunan ulang
  // meninggalkan satu pendengar tambahan yang mengerjakan hal yang sama.
  if (!pendengarTemaTerpasang) {
    pendengarTemaTerpasang = true;
    try {
      chrome.storage.onChanged.addListener((ubah, tempat) => {
        if (tempat !== "local" || !ubah[KUNCI_TEMA_BERSAMA]) return;
        const baru = ubah[KUNCI_TEMA_BERSAMA].newValue === "terang" ? "terang" : "gelap";
        temaBersamaTerakhir = baru;
        mintaPortalBertema(baru);
      });
    } catch {
      /* tanpa pendengarnya, temanya berlaku di halaman tempat ia ditekan saja */
    }
  }
  void samakanTemaDenganPortal();
}

// ─── Pita identitas: bentuk yang sama dengan panel SIPP dan ABT ──────────────

function pitaIdentitas(siapa) {
  const pita = buatElemen("div", "aleta-identitas-panel");
  const tambah = (kelas, label, teks, judul) => {
    const kotak = buatElemen("span", kelas);
    if (label) kotak.appendChild(buatElemen("span", "aleta-id-label", label));
    kotak.appendChild(document.createTextNode(teks));
    if (judul) kotak.title = judul;
    pita.appendChild(kotak);
  };
  if (siapa && siapa.nama) {
    tambah("aleta-id-akun aleta-id-aleta", "ALETA", siapa.nama, `Masuk ke ALETA sebagai ${siapa.nama}.`);
  }
  if (siapa && siapa.peran) tambah(`aleta-id-jenis ${alatKelasPeran(siapa.peran)}`, "", siapa.peran, "Peran yang sedang berlaku.");
  // Seri ekstensi tidak lagi di pita - ia pindah ke baris kaki, satu
  // tempat untuk ketiga panel.
  return pita;
}

// ─── Bagian-bagian isi ───────────────────────────────────────────────────────

function bagian(judul) {
  const kotak = buatElemen("section", "aleta-bagian aleta-portal-bagian");
  kotak.appendChild(buatElemen("div", "aleta-bagian-judul", judul));
  const isi = buatElemen("div", "aleta-bagian-isi");
  kotak.appendChild(isi);
  return { kotak, isi };
}

/** Versi terpasang vs tersedia. Yang tertinggal disebut terang-terangan. */
function bagianEkstensi(siapa) {
  const { kotak, isi } = bagian("Ekstensi");
  let terpasang = "";
  try {
    terpasang = String(chrome.runtime.getManifest().version || "");
  } catch {
    /* di luar konteks ekstensi */
  }
  const tersedia = String((siapa && siapa.versiEkstensi) || "");
  const tertinggal = terpasang && tersedia && terpasang !== tersedia;

  const baris = buatElemen("div", "aleta-portal-versi");
  baris.appendChild(buatElemen("span", "aleta-portal-versi-label", "Terpasang"));
  baris.appendChild(buatElemen("span", "aleta-portal-versi-nilai", terpasang || "-"));
  baris.appendChild(buatElemen("span", "aleta-portal-versi-label", "Tersedia"));
  baris.appendChild(buatElemen("span", "aleta-portal-versi-nilai", tersedia || "-"));
  isi.appendChild(baris);

  if (tertinggal) {
    isi.appendChild(
      buatElemen(
        "div",
        "aleta-portal-awas",
        `Ekstensi Anda ${terpasang}, yang tersedia ${tersedia} - selama tertinggal, sebagian menu di SIPP dapat tidak muncul.`
      )
    );
  }

  // ==========================================================================
  // MEMASANG PEMBARUAN DARI SINI, BUKAN DARI chrome://extensions
  // ==========================================================================
  //
  // Sebelumnya kotak ini hanya berkata "unduh lalu muat ulang dari
  // chrome://extensions". Tiga langkah, dua di antaranya di halaman yang tidak
  // pernah dibuka petugas - dan akibatnya beberapa rilis berturut-turut tidak
  // pernah benar-benar terpasang di peramban siapa pun.
  //
  // Tombolnya tidak mengerjakan apa pun sendiri: requestUpdateCheck dan reload
  // hanya ada di dalam konteks ekstensi, sedangkan berkas ini skrip konten.
  // Yang dikerjakan mengirim pesan ke latar.js, lalu mengatakan apa adanya apa
  // yang dijawab Chrome - termasuk ketika Chrome menolak, yang pada pemasangan
  // tidak terkemas memang selalu terjadi.
  const kabar = buatElemen("div", "aleta-portal-sebab");
  kabar.hidden = true;

  const aksi = buatElemen("div", "aleta-portal-aksi");

  const tombolPerbarui = buatElemen("button", "aleta-tombol", tertinggal ? "Perbarui sekarang" : "Periksa pembaruan");
  tombolPerbarui.type = "button";

  const tombolMuatUlang = buatElemen("button", "aleta-portal-tautan", "Muat ulang ekstensi");
  tombolMuatUlang.type = "button";
  // Disembunyikan sampai diperlukan: pada pemasangan CRX yang sehat tombol ini
  // tidak pernah dibutuhkan, dan menawarkannya sejak awal hanya mengajak orang
  // memuat ulang ekstensi tanpa sebab.
  tombolMuatUlang.hidden = true;

  function kabarkan(teks, buruk) {
    kabar.textContent = teks;
    kabar.hidden = false;
    kabar.classList.toggle("aleta-portal-awas", Boolean(buruk));
  }

  /** Mengirim satu pesan ke pekerja latar, dengan galatnya ditangkap. */
  async function mintaKeLatar(jenis, paksa) {
    try {
      // paksa: tekanan KEDUA sesudah latar.js menahan pemuatan ulang karena
      // putaran cetak relaas belum selesai (lihat di bawah).
      if (paksa) return await chrome.runtime.sendMessage({ sumber: "aleta-panel", jenis, paksa: true });
      return await chrome.runtime.sendMessage({ sumber: "aleta-panel", jenis });
    } catch (galat) {
      // Terjadi ketika ekstensi sedang dimuat ulang - konteksnya mati sebelum
      // jawabannya sampai. Itu justru pertanda perintahnya berjalan.
      return { ok: false, keadaan: "konteks_mati", pesan: String((galat && galat.message) || galat) };
    }
  }

  // Putaran cetak relaas yang belum selesai HILANG bila ekstensi dimuat ulang
  // (chrome.storage.session dikosongkan Chrome). latar.js menahan pemuatan
  // ulang dan menjawab "putaran-relaas-berjalan"; tekanan KEDUA pada tombol
  // yang sama baru memaksa.
  const LABEL_PERBARUI = tertinggal ? "Perbarui sekarang" : "Periksa pembaruan";
  const LABEL_MUAT_ULANG = "Muat ulang ekstensi";
  let paksaPerbarui = false;
  let paksaMuatUlang = false;

  tombolPerbarui.addEventListener("click", async () => {
    tombolPerbarui.disabled = true;
    kabarkan("Menanyakan pembaruan kepada Chrome…", false);

    const jawab = await mintaKeLatar("perbarui", paksaPerbarui);
    kabarkan((jawab && jawab.pesan) || "Tidak ada jawaban dari ekstensi.", !(jawab && jawab.ok));

    if (jawab && jawab.keadaan === "putaran-relaas-berjalan") {
      paksaPerbarui = true;
      tombolPerbarui.textContent = "Tetap perbarui - putaran cetak hilang";
      tombolPerbarui.disabled = false;
      return;
    }
    paksaPerbarui = false;
    tombolPerbarui.textContent = LABEL_PERBARUI;

    if (jawab && jawab.ok && jawab.keadaan === "dipasang") {
      // Ekstensi akan mati sebentar lagi, dan skrip konten TIDAK disuntikkan
      // ulang ke halaman yang sudah terbuka. Tanpa memuat ulang halaman ini,
      // panelnya tetap yang lama sampai petugas kebetulan berpindah halaman.
      setTimeout(() => location.reload(), 1500);
      return;
    }

    // Chrome tidak memasang apa pun. Jalan kedua ditawarkan HANYA sekarang,
    // yaitu ketika ia memang berguna.
    tombolMuatUlang.hidden = false;
    tombolPerbarui.disabled = false;
  });

  tombolMuatUlang.addEventListener("click", async () => {
    tombolMuatUlang.disabled = true;
    kabarkan("Memuat ulang ekstensi dari berkasnya…", false);
    const jawab = await mintaKeLatar("muat-ulang", paksaMuatUlang);
    if (jawab && jawab.keadaan === "putaran-relaas-berjalan") {
      kabarkan(jawab.pesan || "Putaran cetak relaas belum selesai.", true);
      paksaMuatUlang = true;
      tombolMuatUlang.textContent = "Tetap muat ulang - putaran cetak hilang";
      tombolMuatUlang.disabled = false;
      return;
    }
    paksaMuatUlang = false;
    tombolMuatUlang.textContent = LABEL_MUAT_ULANG;
    kabarkan(
      (jawab && jawab.pesan) || "Ekstensi sedang dimuat ulang. Muat ulang halaman ini sebentar lagi.",
      false
    );
    setTimeout(() => location.reload(), 1500);
  });

  aksi.appendChild(tombolPerbarui);
  aksi.appendChild(tombolMuatUlang);
  aksi.appendChild(tautan(`${dasarPortal()}/aleta-ecourt`, "Halaman ekstensi"));
  aksi.appendChild(tautan(`${dasarPortal()}/patch-notes#ekstensi`, "Catatan pembaruan"));
  isi.appendChild(aksi);
  isi.appendChild(kabar);
  return kotak;
}

/** Perkara yang terakhir dibuka di SIPP - jalan kembali tanpa mencari lagi. */
async function bagianSipp() {
  const { kotak, isi } = bagian("Kembali ke SIPP");
  let riwayat = [];
  try {
    const simpan = await chrome.storage.local.get([KUNCI_RIWAYAT_SIPP]);
    riwayat = Array.isArray(simpan[KUNCI_RIWAYAT_SIPP]) ? simpan[KUNCI_RIWAYAT_SIPP] : [];
  } catch {
    /* tanpa riwayat, tautan umumnya tetap ada */
  }

  if (riwayat.length === 0) {
    isi.appendChild(
      buatElemen("div", "aleta-kosong-lembut", "Perkara yang Anda buka di SIPP akan tercatat di sini, supaya dapat dibuka kembali dengan satu klik.")
    );
  } else {
    const daftar = buatElemen("ul", "aleta-portal-riwayat");
    for (const r of riwayat.slice(0, 6)) {
      if (!r || !r.nomor || !r.url) continue;
      const li = buatElemen("li");
      const a = tautan(String(r.url), String(r.nomor), "aleta-portal-riwayat-nomor");
      a.target = "_blank";
      li.appendChild(a);
      if (r.jenis) li.appendChild(buatElemen("span", "aleta-id-jenis", String(r.jenis)));
      daftar.appendChild(li);
    }
    isi.appendChild(daftar);
  }

  const aksi = buatElemen("div", "aleta-portal-aksi");
  const sipp = tautan(`${location.origin}/SIPP/`, "Buka SIPP");
  sipp.target = "_blank";
  const abt = tautan(`${location.origin}/aps_badilag/`, "Buka ABT");
  abt.target = "_blank";
  aksi.appendChild(sipp);
  aksi.appendChild(abt);
  isi.appendChild(aksi);
  return kotak;
}

/** Kewenangan orang ini - supaya menu yang tidak muncul di SIPP punya sebab yang terbaca. */
function bagianKewenangan(siapa) {
  const { kotak, isi } = bagian("Kewenangan saya di SIPP");
  const kapabilitas = (siapa && siapa.kapabilitas) || {};
  const keterangan = (siapa && siapa.keterangan) || {};
  const daftar = buatElemen("ul", "aleta-portal-kewenangan");
  for (const kunci of Object.keys(keterangan)) {
    const boleh = kapabilitas[kunci] === true;
    const li = buatElemen("li", boleh ? "aleta-portal-boleh" : "aleta-portal-tidak");
    li.appendChild(buatElemen("span", "aleta-portal-tanda", boleh ? "✓" : "–"));
    li.appendChild(buatElemen("span", "", keterangan[kunci].label || kunci));
    li.title = keterangan[kunci].penjelasan || "";
    daftar.appendChild(li);
  }
  isi.appendChild(daftar);
  if (siapa && siapa.bolehMengatur) {
    const aksi = buatElemen("div", "aleta-portal-aksi");
    aksi.appendChild(tautan(`${dasarPortal()}/admin/aleta-ecourt#pengaturan-ekstensi`, "Atur kewenangan ekstensi", "aleta-tombol"));
    isi.appendChild(aksi);
  }
  return kotak;
}

/** Pintasan menurut jabatan - disusun portal, digambar di sini. */
function bagianPintasan(siapa) {
  const menu = (siapa && Array.isArray(siapa.menu) ? siapa.menu : []).filter((m) => m && m.href && m.label);
  if (menu.length === 0) return null;
  const { kotak, isi } = bagian(`Pintasan ${siapa.peran || ""}`.trim());
  const daftar = buatElemen("ul", "aleta-portal-pintasan");
  for (const m of menu) {
    const li = buatElemen("li");
    const a = tautan(`${dasarPortal()}${m.href}`, m.label, "aleta-portal-pintasan-tautan");
    li.appendChild(a);
    if (m.keterangan) li.appendChild(buatElemen("span", "aleta-portal-pintasan-ket", m.keterangan));
    daftar.appendChild(li);
  }
  isi.appendChild(daftar);
  return kotak;
}

// ─── Panel ───────────────────────────────────────────────────────────────────

async function susunPanelPortal(siapa) {
  const panel = buatElemen("div", "aleta-panel aleta-panel-portal");
  panel.id = PENANDA_ALETA;

  const kepala = buatElemen("div", "aleta-kepala");
  try {
    const logo = document.createElement("img");
    logo.className = "aleta-logo";
    logo.alt = "";
    logo.src = chrome.runtime.getURL("ikon/aleta-32.png");
    logo.addEventListener("error", () => logo.remove());
    kepala.appendChild(logo);
  } catch {
    /* tanpa logo, kepala tetap utuh */
  }
  kepala.appendChild(buatElemen("span", "aleta-merek", "ALETA"));
  kepala.appendChild(pitaIdentitas(siapa));
  // Perannya ditandai pada akar panel - dari situlah rel gradasi di tepi atas
  // mengambil warnanya. Sama persis dengan panel SIPP dan ABT.
  alatTandaiPeranPanel(panel, siapa && siapa.peran);
  panel.appendChild(kepala);

  const isi = buatElemen("div", "aleta-isi");
  isi.appendChild(bagianEkstensi(siapa));
  isi.appendChild(await bagianSipp());
  const pintasan = bagianPintasan(siapa);
  if (pintasan) isi.appendChild(pintasan);
  isi.appendChild(bagianKewenangan(siapa));
  panel.appendChild(isi);

  const kaki = buatElemen("div", "aleta-kaki");
  kaki.title = "Keterangan dari ALETA. Tidak ada yang diubah dari sini.";
  // Pita identitas TIDAK diulang di kaki - ia sudah di kepala, dua jengkal
  // di atasnya. Sama dengan panel SIPP.

  // Panel ini dibangun SEKALI saat halaman dibuka, sedangkan portal
  // berpindah halaman tanpa memuat ulang. Kewenangan yang baru diubah,
  // perkara yang baru dibuka di SIPP, dan versi ekstensi yang baru
  // dipasang karena itu tidak pernah terbaca sampai halamannya dimuat
  // ulang seluruhnya - dan memuat ulang halaman ALETA berarti kehilangan
  // apa pun yang sedang dikerjakan di sana.
  // Bentuk kaki yang sama dengan panel SIPP - satu baris, pintasan di kiri,
  // ikon segarkan dan nomor seri di kanan. Barisan pintasan itu pula yang
  // MENDORONG keduanya ke kanan lewat margin otomatisnya; tanpa barisnya,
  // keduanya berdiri di kiri - dan itulah bentuk panel ini selama ini.
  const barisKaki = buatElemen("div", "aleta-kaki-baris");

  // Keempatnya punya sasaran yang sungguh ada di panel ini. Yang tidak punya
  // sasaran tidak didaftarkan: menjanjikan pintasan yang tidak berbuat apa-apa
  // lebih buruk daripada tidak menjanjikannya.
  const PINTASAN_PORTAL = [
    {
      tombol: "Alt+A",
      kunci: "a",
      nama: "ciutkan / bentangkan panel",
      jalankan: (p) => alatCiutkan(p, KUNCI_POSISI_ALETA),
    },
    {
      tombol: "Alt+P",
      kunci: "p",
      nama: "buka daftar Kembali ke SIPP",
      jalankan: (p) => {
        const daftar = p.querySelector(".aleta-portal-perkara, .aleta-portal-tautan");
        if (daftar) daftar.scrollIntoView({ block: "nearest" });
      },
    },
    {
      tombol: "Alt+R",
      kunci: "r",
      nama: "buka Catatan pembaruan",
      jalankan: (p) => {
        for (const a of Array.from(p.querySelectorAll("a"))) {
          if (/catatan pembaruan/i.test(a.textContent || "")) {
            a.click();
            return;
          }
        }
      },
    },
    {
      tombol: "Alt+Enter",
      kunci: "Enter",
      nama: "periksa pembaruan ekstensi",
      jalankan: (p) => alatTekanPertama(p, "button.aleta-tombol"),
    },
  ];
  barisKaki.appendChild(alatBarisPintasan(PINTASAN_PORTAL));
  alatPasangPintasan(PENANDA_ALETA, PINTASAN_PORTAL);

  const segar = buatElemen("button", "aleta-kaki-segar", "↻");
  segar.type = "button";
  segar.setAttribute("aria-label", "Segarkan");
  segar.title = "Segarkan - membaca ulang akun dan kewenangan dari ALETA. Halaman portal tidak dimuat ulang.";
  segar.addEventListener("click", () => {
    segar.disabled = true;
    segar.classList.add("aleta-kaki-segar-jalan");
    const lama = document.getElementById(PENANDA_ALETA);
    if (lama) lama.remove();
    void pasangPortal();
  });
  barisKaki.appendChild(segar);
  try {
    const seri = chrome.runtime.getManifest().version;
    if (seri) {
      const versi = buatElemen("span", "aleta-kaki-versi", `v${seri}`);
      versi.title = "Seri ekstensi yang terpasang di peramban ini.";
      barisKaki.appendChild(versi);
    }
  } catch {
    /* di luar konteks ekstensi */
  }
  kaki.appendChild(barisKaki);
  panel.appendChild(kaki);

  await alatPasangPanel(panel, kepala, KUNCI_POSISI_ALETA, {
    // Penanda gelap milik SIPP TIDAK dipasang di halaman ini: portal ALETA
    // punya peta warnanya sendiri, dan menumpuk keduanya berarti dua peta
    // warna berebut satu halaman. Yang disamakan temanya, bukan petanya.
    temaHalaman: false,
    saatTutup: () => tutupPanel(),
  });

  // ==========================================================================
  // SAKLAR TEMANYA KEMBALI - SEBAB SEKARANG IA SAKLAR YANG SAMA
  // ==========================================================================
  //
  // Dahulu tombol ini disingkirkan, dengan alasan yang benar pada zamannya:
  // "dua saklar untuk satu tema hanya melahirkan dua tema yang berselisih".
  // Tombol panel mengubah temaPanel, tombol ALETA mengubah kelas `dark`, dan
  // keduanya tidak pernah bertemu.
  //
  // Sejak keduanya disambungkan (lihat ikutiTemaAleta), alasan itu hilang:
  // menekan yang mana pun menggerakkan tema yang SATU - panel ini, halaman
  // portal, jendela popup, dan panel di tab SIPP maupun ABT sekaligus. Dua
  // tombol untuk satu tema kini seperti dua saklar lampu di ujung lorong yang
  // sama.
  const tombolTema = kepala.querySelector(".aleta-tema");
  if (tombolTema) {
    tombolTema.title = "Ganti tema ALETA - panel, halaman portal, popup ekstensi, SIPP, dan ABT sekaligus";
  }
  ikutiTemaAleta(panel);

  return panel;
}

// ─── Pemasangan ──────────────────────────────────────────────────────────────

async function sedangAktif() {
  try {
    const simpan = await chrome.storage.local.get(["aktif"]);
    return simpan.aktif !== false;
  } catch {
    return true;
  }
}

function halamanTanpaPanel() {
  const jalur = String(location.pathname || "").replace(/^\/aleta(?=\/|$)/, "");
  return JALUR_TANPA_PANEL.some((j) => jalur === j || jalur.startsWith(`${j}/`));
}

let sedangMemasang = false;

async function pasangPortal() {
  if (sedangMemasang) return;
  const sudahAda = document.getElementById(PENANDA_ALETA);

  if (halamanTanpaPanel()) {
    // Halaman masuk: tidak ada yang perlu dibaca, dan panel yang menutupi
    // isian kata sandi hanya mengganggu.
    if (sudahAda) sudahAda.remove();
    return;
  }
  if (sudahAda) return;
  if (!(await sedangAktif())) return;

  sedangMemasang = true;
  try {
    const respons = await alatAmbil(alamatSiapa(), { credentials: "include", cache: "no-store" }, "Membaca akun");
    // Belum masuk: diam. Portal sendiri yang mengantar ke halaman masuk.
    if (respons.status === 401) return;
    if (!respons.ok) return;
    const luar = await respons.json();
    const siapa = luar && luar.data ? luar.data : luar;
    if (!siapa || !siapa.nama) return;
    if (document.getElementById(PENANDA_ALETA)) return;
    document.body.appendChild(await susunPanelPortal(siapa));
  } catch {
    /* gangguan jaringan: tidak ada panel, tidak ada galat di layar orang */
  } finally {
    sedangMemasang = false;
  }
}

/**
 * ============================================================================
 * MENUTUP PANEL DI SINI DULU BERARTI MENUTUPNYA UNTUK SELAMANYA
 * ============================================================================
 *
 * Tombol × dahulu hanya panel.remove(). Sesudah itu tidak ada satu pun jalan
 * kembali: berkas ini dijalankan sekali saat halaman dibuka, pasangPortal()
 * hanya dipanggil lagi ketika ALAMATNYA berpindah, dan portal yang sedang
 * dibaca orang tidak berpindah alamat. Saklar di popup ikon Chrome pun tidak
 * menolong - tidak ada yang mendengarkannya di halaman ini.
 *
 * Yang dilaporkan karena itu benar seluruhnya: "di aleta sudah ditutup atau
 * minimize, diklik kembali widget dan popup ekstensi tidak mau terbuka".
 *
 * Sekarang × berarti hal yang sama dengan × di panel SIPP: saklar aktif
 * dimatikan. Saklar itu tergambar di popup ikon Chrome sebagai kotak centang
 * yang IKUT TERBUKA centangnya - jadi jalan pulangnya terlihat di tempat yang
 * memang dicari orang, dan satu tekanan mengembalikan panel di ketiga halaman
 * sekaligus tanpa memuat ulang apa pun.
 */
function tutupPanel() {
  const panel = document.getElementById(PENANDA_ALETA);
  try {
    void chrome.storage.local.set({ aktif: false });
  } catch {
    /* penyimpanan tidak tersedia: panel tetap ditutup untuk halaman ini */
  }
  if (panel) panel.remove();
}

/**
 * ============================================================================
 * JEMBATAN HALAMAN <-> EKSTENSI UNTUK CETAK RELAAS MASSAL (KONTRAK K3)
 * ============================================================================
 *
 * Tombol "Cetak relaas" di Antrian Sidang (ALETA e-Court, tab Jadwal Sidang)
 * adalah kode HALAMAN - ia tidak punya chrome.runtime, sehingga tidak dapat
 * menyuruh pekerja latar mencetak. Berkas ini skrip konten: ia berbagi DOM
 * dengan halaman, dan ia punya chrome.runtime. Jadi ia yang menjembatani:
 *
 *   halaman  --window.postMessage({sumber:"aleta-portal", jenis, idPesan, muatan})-->  jembatan
 *   jembatan --chrome.runtime.sendMessage({sumber:"aleta-panel", jenis, ...})-->       latar.js
 *   jembatan <--jawaban-------------------------------------------------------         latar.js
 *   halaman  <--window.postMessage({sumber:"aleta-ekstensi", balasan:idPesan, jawaban})-- jembatan
 *
 * KEHADIRAN diumumkan dua cara: dataset pada <html> (aletaEkstensi = versi,
 * aletaRelaas = "1") yang dapat dibaca kapan saja - halaman React sering baru
 * mendengar SESUDAH skrip ini berjalan - dan satu pesan "siap" untuk halaman
 * yang sudah mendengar.
 *
 * YANG DITOLAK, dan kenapa ketat: pesan yang diteruskan menyuruh pekerja latar
 * mengambil halaman ABT dengan kuki petugas dan menyimpan berkas ke cakramnya.
 *   - e.source bukan jendela ini (bingkai lain, jendela lain)
 *   - e.origin bukan asal halaman ini
 *   - sumber bukan "aleta-portal" (termasuk balasan jembatan sendiri)
 *   - jenis di luar lima jenis relaas yang dipakai dialog - dibalas galat,
 *     TIDAK diteruskan. relaas-panen dan relaas-perkiraan (dikenal latar.js)
 *     sengaja TIDAK dibuka dari halaman: dialog tidak memakainya, dan
 *     relaas-panen {paksa:true} dari skrip mana pun di asal portal membuka
 *     beranda dan halaman kelompok ABT dengan kuki petugas (telaah 25 Sep
 *     2026: lima pesan serentak = lima panen dalam tiga detik).
 *   - idPesan bukan string 1..64 aksara - tidak dapat dibalas, jadi diabaikan
 * asal dan asalAbt DIHITUNG di sini dari location.origin; nilai kiriman
 * halaman dibuang. Muatan disaring per jenis - hanya ruas yang dikenal
 * kontrak, dengan batas panjang.
 *
 * TIDAK ADA PERMINTAAN YANG DIBIARKAN TANPA BALASAN. Ekstensi yang dimuat
 * ulang meninggalkan skrip konten yatim - chrome.runtime.sendMessage
 * melempar "Extension context invalidated" - dan pekerja yang tidak menjawab
 * menyalakan chrome.runtime.lastError. Keduanya dibalas { ok:false, sebab }.
 * Halaman tetap memasang batas waktunya sendiri untuk yang tidak terduga.
 */
const JEMBATAN_SUMBER_HALAMAN = "aleta-portal";
const JEMBATAN_SUMBER_EKSTENSI = "aleta-ekstensi";
const JEMBATAN_JENIS_RELAAS = [
  "relaas-mulai",
  "relaas-keadaan",
  "relaas-henti",
  "relaas-lanjut",
  "relaas-bersihkan",
];
const JEMBATAN_ID_MAKS = 64;
const JEMBATAN_DOKUMEN_MAKS = 500;
const JEMBATAN_CARA_RTF = ["selalu", "bila-pdf-gagal", "tidak"];
const KALIMAT_EKSTENSI_DIMUAT_ULANG =
  "Ekstensi ALETA baru dimuat ulang atau diperbarui - muat ulang halaman ini supaya jembatannya tersambung lagi.";
let jembatanRelaasTerpasang = false;

/** asal dan asalAbt menurut halaman ini sendiri - bukan menurut kiriman halaman. */
function jembatanAsal() {
  const asal = location.origin;
  return { asal, asalAbt: `${asal}/aps_badilag` };
}

/**
 * Teks dari halaman, dipotong - TIDAK dirapikan. Nama blangko ABT memuat spasi
 * tersembunyi sebelum ".rtf" ([JS] 1), dan pemangkasan di sini akan membuat
 * blangkonya tidak pernah ditemukan.
 */
function jembatanTeks(nilai, batas) {
  if (typeof nilai !== "string" && typeof nilai !== "number") return "";
  return String(nilai).slice(0, batas);
}

function jembatanSaringDokumen(d) {
  if (!d || typeof d !== "object") return null;
  const jurusita = d.jurusita && typeof d.jurusita === "object" ? d.jurusita.nama : d.jurusita;
  const nomorSidang = Number(d.d);
  return {
    kunci: jembatanTeks(d.kunci, 160),
    perkaraId: jembatanTeks(d.perkaraId, 20),
    nomorPerkara: jembatanTeks(d.nomorPerkara, 80),
    golongan: jembatanTeks(d.golongan, 40),
    label: jembatanTeks(d.label, 200),
    d: d.d === null || d.d === undefined || !Number.isInteger(nomorSidang) || nomorSidang < 0 ? null : nomorSidang,
    berkas: jembatanTeks(d.berkas, 200),
    nama: jembatanTeks(d.nama, 200),
    jurusita: jembatanTeks(jurusita, 120),
  };
}

/** Muatan per jenis, disaring. Pulang { isi } atau { sebab } bila bentuknya tidak sah. */
function jembatanSaringMuatan(jenis, muatan) {
  const m = muatan && typeof muatan === "object" ? muatan : {};
  if (jenis === "relaas-mulai") {
    const p = m.pekerjaan;
    if (!p || typeof p !== "object" || !Array.isArray(p.dokumen)) {
      return { sebab: "muatan relaas-mulai tidak sah - pekerjaan.dokumen harus berupa daftar" };
    }
    if (p.dokumen.length > JEMBATAN_DOKUMEN_MAKS) {
      return { sebab: `terlalu banyak dokumen dalam satu putaran (${p.dokumen.length}; paling banyak ${JEMBATAN_DOKUMEN_MAKS})` };
    }
    const dilewati = (Array.isArray(p.dilewati) ? p.dilewati : []).slice(0, JEMBATAN_DOKUMEN_MAKS).map((x) => ({
      kunci: jembatanTeks(x && x.kunci, 160),
      nomorPerkara: jembatanTeks(x && x.nomorPerkara, 80),
      label: jembatanTeks(x && x.label, 200),
      sebab: jembatanTeks(x && x.sebab, 300),
    }));
    const pekerjaan = {
      tanggal: /^\d{4}-\d{2}-\d{2}$/.test(String(p.tanggal || "")) ? String(p.tanggal) : "",
      dokumen: p.dokumen.map(jembatanSaringDokumen).filter(Boolean),
      dilewati,
      ...jembatanAsal(),
    };
    const cara = p.unduhRtf !== undefined ? p.unduhRtf : m.unduhRtf;
    if (JEMBATAN_CARA_RTF.includes(cara)) pekerjaan.unduhRtf = cara;
    const cadangan = p.rtfBilaPdfGagal !== undefined ? p.rtfBilaPdfGagal : m.rtfBilaPdfGagal;
    if (typeof cadangan === "boolean") pekerjaan.rtfBilaPdfGagal = cadangan;
    return { isi: { pekerjaan } };
  }
  return { isi: {} };
}

/** Meneruskan satu pesan ke pekerja latar; SELALU memanggil `balas` tepat sekali. */
function jembatanTeruskan(pesan, balas) {
  let runtime = null;
  try {
    runtime = chrome.runtime && chrome.runtime.id ? chrome.runtime : null;
  } catch (galat) {
    balas({ ok: false, sebab: `${KALIMAT_EKSTENSI_DIMUAT_ULANG} (${String((galat && galat.message) || galat)})` });
    return;
  }
  if (!runtime) {
    balas({ ok: false, sebab: KALIMAT_EKSTENSI_DIMUAT_ULANG });
    return;
  }
  try {
    runtime.sendMessage(pesan, (jawaban) => {
      let galat = null;
      try {
        galat = chrome.runtime.lastError || null;
      } catch (e) {
        galat = e;
      }
      if (galat) {
        balas({
          ok: false,
          sebab: `Pekerja latar ekstensi tidak menjawab: ${String(galat.message || galat)}`,
        });
        return;
      }
      if (jawaban === undefined || jawaban === null) {
        balas({ ok: false, sebab: "Pekerja latar ekstensi tidak memulangkan jawaban apa pun." });
        return;
      }
      balas(jawaban);
    });
  } catch (galat) {
    balas({ ok: false, sebab: `${KALIMAT_EKSTENSI_DIMUAT_ULANG} (${String((galat && galat.message) || galat)})` });
  }
}

function jembatanTerimaPesan(e) {
  if (e.source !== window || e.origin !== location.origin) return;
  const data = e.data;
  if (!data || typeof data !== "object" || data.sumber !== JEMBATAN_SUMBER_HALAMAN) return;
  const idPesan = data.idPesan;
  if (typeof idPesan !== "string" || idPesan.length === 0 || idPesan.length > JEMBATAN_ID_MAKS) return;
  let sudahDibalas = false;
  const balas = (jawaban) => {
    if (sudahDibalas) return;
    sudahDibalas = true;
    window.postMessage({ sumber: JEMBATAN_SUMBER_EKSTENSI, balasan: idPesan, jawaban }, location.origin);
  };
  if (!JEMBATAN_JENIS_RELAAS.includes(data.jenis)) {
    balas({ ok: false, sebab: `jenis pesan "${String(data.jenis).slice(0, 40)}" tidak diterima jembatan relaas` });
    return;
  }
  const saring = jembatanSaringMuatan(data.jenis, data.muatan);
  if (saring.sebab) {
    balas({ ok: false, sebab: saring.sebab });
    return;
  }
  jembatanTeruskan({ sumber: "aleta-panel", jenis: data.jenis, ...saring.isi, ...jembatanAsal() }, balas);
}

function pasangJembatanRelaas() {
  if (jembatanRelaasTerpasang) return;
  jembatanRelaasTerpasang = true;
  let versi = "";
  try {
    versi = String(chrome.runtime.getManifest().version || "");
  } catch (galat) {
    console.warn("ALETA: versi ekstensi tidak terbaca untuk jembatan relaas", galat);
  }
  const akar = document.documentElement;
  akar.dataset.aletaEkstensi = versi;
  akar.dataset.aletaRelaas = "1";
  window.addEventListener("message", jembatanTerimaPesan);
  window.postMessage({ sumber: JEMBATAN_SUMBER_EKSTENSI, jenis: "siap", versi }, location.origin);
}

// Jembatan dipasang LEBIH DAHULU dan terlepas dari panel: saklar panel yang
// dimatikan, atau panel yang gagal dibangun, tidak boleh memutus cetak relaas.
pasangJembatanRelaas();

// Halaman portal itu sendiri - alamat yang paling pasti dari semuanya, dan
// yang paling sering dibuka orang yang belum pernah menyentuh SIPP.
alatCatatAsalPortal();
void pasangPortal();

// Saklar dari popup ikon Chrome berlaku seketika di halaman ini juga - sama
// seperti di SIPP. Tanpa pendengar ini, menyalakannya kembali hanya berlaku
// pada halaman yang dibuka SESUDAHNYA.
try {
  chrome.storage.onChanged.addListener((ubah, tempat) => {
    if (tempat !== "local" || !ubah.aktif) return;
    if (ubah.aktif.newValue === false) {
      const panel = document.getElementById(PENANDA_ALETA);
      if (panel) panel.remove();
      return;
    }
    void pasangPortal();
  });
} catch {
  /* di luar konteks ekstensi */
}

// Portal berpindah halaman tanpa memuat ulang (Next.js). Skrip ini hanya
// dijalankan sekali, jadi perpindahan dari /login ke /portal harus dikejar
// sendiri - dan panel yang sudah ada dibiarkan, tidak dibangun ulang.
let jalurTerakhir = location.pathname;
setInterval(() => {
  if (location.pathname === jalurTerakhir) return;
  jalurTerakhir = location.pathname;
  void pasangPortal();
}, 800);
