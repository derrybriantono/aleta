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
/**
 * Halaman tanpa sesi yang dapat dibaca. Layar yang menghadap masyarakat -
 * televisi ruang tunggu, layar ambil antrian, papan pintu ruang sidang -
 * TIDAK didaftar di sini, melainkan di alatHalamanPublikPortal (panel-alat.js),
 * daftar yang sama dengan yang dipakai widget checklist.
 */
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

/**
 * ============================================================================
 * TAHAP 4 - PANEL PORTAL DALAM TAMPILAN BARU DAN UI BARU
 * ============================================================================
 *
 * Rencana "ekstensi dulu", 29 September 2026. Semua yang ada di blok ini
 * TAMBAHAN yang menumpang pada panel lama yang sudah jadi - panel lama tetap
 * disusun oleh fungsi-fungsi di atas, persis seperti sebelumnya, lalu blok ini
 * menata dan menambahinya. Sebabnya satu: tampilan Lama harus tetap sama
 * sampai ke DOM-nya, dan cara paling pasti untuk itu adalah tidak menyentuh
 * jalur yang menyusunnya.
 *
 * Tiga pagar, dan ketiganya ditanyakan ke panel-alat.js (Tahap 1):
 *
 *   tampilan Lama       t4Tata keluar di baris pertamanya; tidak ada atribut,
 *                       tidak ada permintaan, tidak ada pewaktu
 *   ide portal-N        hanya bila alatFiturNyala("portal-N") - dalam Baru
 *                       maupun UI Baru
 *   perbaikan D1-D15    hanya dalam UI Baru (alatKulit() === "modern")
 *
 * Fungsi panel-alat.js ditanyakan lewat pembungkus yang memeriksa
 * keberadaannya dahulu. Uji jembatan relaas memuat berkas ini dengan TIGA
 * fungsi panel-alat.js saja, dan pembungkus inilah yang membuat blok ini
 * tidak pernah melempar di sana - yang tidak diketahui dianggap "Lama".
 *
 * ============================================================================
 * TETAP TIDAK MENULIS KE PORTAL
 * ============================================================================
 *
 * Panel ini sejak lahir hanya MEMBACA portal, dan uji halaman-aleta menjaganya.
 * Blok ini mematuhinya: seluruh permintaannya GET (dan HEAD untuk lampu SIPP
 * dan ABT). Yang disimpan hanya milik ekstensi sendiri - chrome.storage.local
 * di peramban ini. Karena itu mode coba tidak pernah menahan satu pun
 * permintaannya; t4AmbilJson tetap membaca jawaban 423 "mode_coba" dan
 * menyebut kalimatnya apa adanya, supaya kalau suatu hari ada yang ditahan,
 * panel tidak berpura-pura berhasil.
 *
 * Yang butuh penulisan ke portal - menandai pemberitahuan dibaca, berganti
 * peran portal - karena itu TIDAK dikerjakan dari sini, dan panel mengatakan
 * di mana hal itu dikerjakan.
 */
const T4_KUNCI_LETAK = "letakPanelPortal";
const T4_KUNCI_PUBLIK = "modeLayarPublik";
const T4_KUNCI_SEMATAN = "sematanPerkaraPortal";
const T4_KUNCI_URUTAN = "urutanPintasanPortal";
const T4_KUNCI_CATATAN = "catatanTempelPortal";
const T4_KUNCI_TUR = "turPanelPortalSelesai";
const T4_KUNCI_TAB = "tabPanelPortal";
/** Milik checklist.js - hanya DIBACA di sini, kecuali peran (lihat t4BagianPeran). */
const T4_KUNCI_TAUTAN_SIPP = "tautanPerkaraSipp";
const T4_KUNCI_PERAN_CHECKLIST = "peranChecklistMilestone";
/** Belum ditulis siapa pun - lihat t4BagianUnduhan. */
const T4_KUNCI_UNDUHAN = "unduhanTerakhir";
const T4_LETAK = ["samping", "mengambang", "mengecil"];
const T4_ATRIBUT_LETAK = "data-aleta-portal-letak";
const T4_PERIKSA_MS = 30 * 60 * 1000;
/** Jawaban server yang lebih lama dari ini membuat lampunya kuning. */
const T4_LAMBAT_MS = 1500;
const T4_TAB = [
  ["beranda", "Beranda"],
  ["perkara", "Perkara"],
  ["pintasan", "Pintasan"],
  ["akun", "Akun"],
];
/**
 * Tanda tampilan yang dipakai saat sebuah panel disusun. Disimpan di luar
 * elemennya - atribut di panel akan mengubah DOM tampilan Lama.
 */
const t4TandaPanel = new WeakMap();
/** Keadaan panel yang sedang tergambar (satu halaman, satu panel). */
let t4Keadaan = null;
/** Pilihan letak panel yang terakhir terbaca dari penyimpanan. */
let t4LetakPilihan = "";
let t4PeriksaPewaktu = 0;
let t4PengecilPewaktu = 0;
let t4PengamatBody = null;
let t4PendengarKunciTerpasang = false;
/** Lama "siapa saya" menjawab - ukuran kecepatan server yang paling murah. */
let t4LamaSiapaMs = 0;
/** Kabar yang harus tampil SESUDAH panel dibangun ulang. */
let t4KabarTertunda = "";

// ─── Pembungkus fondasi Tahap 1 ──────────────────────────────────────────────

function t4Mode() {
  try {
    return typeof alatUjiMode === "function" ? String(alatUjiMode() || "lama") : "lama";
  } catch {
    return "lama";
  }
}

function t4Aktif() {
  return t4Mode() !== "lama";
}

function t4Modern() {
  try {
    return typeof alatKulit === "function" && alatKulit() === "modern";
  } catch {
    return false;
  }
}

function t4Nyala(kode) {
  try {
    return typeof alatFiturNyala === "function" && alatFiturNyala(kode) === true;
  } catch {
    return false;
  }
}

/** Ringkasan tampilan: berubah = panel perlu disusun ulang. */
function t4TandaTampilan() {
  const nyala = [];
  for (let i = 1; i <= 30; i += 1) if (t4Nyala(`portal-${i}`)) nyala.push(i);
  return `${t4Mode()}|${t4Modern() ? "modern" : "klasik"}|${nyala.join(",")}`;
}

async function t4Baca(kunci) {
  try {
    return (await chrome.storage.local.get(kunci)) || {};
  } catch {
    return {};
  }
}

function t4Tulis(isi) {
  try {
    Promise.resolve(chrome.storage.local.set(isi)).catch(() => {
      /* berlaku untuk halaman ini saja */
    });
  } catch {
    /* di luar konteks ekstensi */
  }
}

/**
 * Satu bacaan GET ke portal, dengan kalimat kegagalan yang dapat dibaca.
 * Pulang { ok, status, data, pesan } dan TIDAK PERNAH melempar.
 */
async function t4AmbilJson(jalur, keterangan) {
  const alamat = `${dasarPortal()}${jalur}`;
  const opsi = { credentials: "include", cache: "no-store" };
  try {
    const respons = typeof alatAmbil === "function" ? await alatAmbil(alamat, opsi, keterangan) : await fetch(alamat, opsi);
    let badan = null;
    try {
      badan = await respons.json();
    } catch {
      badan = null;
    }
    if (respons.status === 423 && badan && (badan.alasan === "mode_coba" || badan.alasan === "mode_kering" || badan.alasan === "mode_latihan")) {
      return { ok: false, status: 423, data: null, pesan: String(badan.pesan || "Permintaan ditahan mode coba.") };
    }
    if (!respons.ok) {
      const dariPortal = badan && badan.error && badan.error.message ? String(badan.error.message) : "";
      const pesan =
        dariPortal ||
        (typeof alatPesanGagal === "function"
          ? alatPesanGagal(null, respons.status, keterangan)
          : `${keterangan} gagal (status ${respons.status}).`);
      return { ok: false, status: respons.status, data: null, pesan };
    }
    const data = badan && typeof badan === "object" && "data" in badan ? badan.data : badan;
    return { ok: true, status: respons.status, data, pesan: "" };
  } catch (galat) {
    const pesan =
      typeof alatPesanGagal === "function"
        ? alatPesanGagal(galat, 0, keterangan)
        : `${keterangan} gagal: ${String((galat && galat.message) || galat)}`;
    return { ok: false, status: 0, data: null, pesan };
  }
}

/** Menjawab-tidaknya sebuah alamat (SIPP, ABT) - lewat HEAD, tanpa isi. */
async function t4Jangkau(alamat) {
  const mulai = Date.now();
  try {
    const opsi = { method: "HEAD", credentials: "include", cache: "no-store" };
    const respons = typeof alatAmbil === "function" ? await alatAmbil(alamat, opsi, "Memeriksa sambungan") : await fetch(alamat, opsi);
    return { hidup: respons.status > 0 && respons.status < 500, ms: Date.now() - mulai, status: respons.status };
  } catch {
    return { hidup: false, ms: Date.now() - mulai, status: 0 };
  }
}

// ─── Perkakas kecil ──────────────────────────────────────────────────────────

function t4Pad(n) {
  return String(n).padStart(2, "0");
}

/** "10.41", "kemarin 15.20", atau "28-09 14.05". */
function t4Jam(iso) {
  const t = new Date(String(iso || ""));
  if (Number.isNaN(t.getTime())) return "";
  const jam = `${t4Pad(t.getHours())}.${t4Pad(t.getMinutes())}`;
  const kini = new Date();
  if (t.toDateString() === kini.toDateString()) return jam;
  const kemarin = new Date(kini);
  kemarin.setDate(kini.getDate() - 1);
  if (t.toDateString() === kemarin.toDateString()) return `kemarin ${jam}`;
  return `${t4Pad(t.getDate())}-${t4Pad(t.getMonth() + 1)} ${jam}`;
}

function t4Tanggal(iso) {
  const t = new Date(String(iso || ""));
  if (Number.isNaN(t.getTime())) return "";
  return `${t4Pad(t.getDate())}-${t4Pad(t.getMonth() + 1)}-${t.getFullYear()}`;
}

/** "459/Pdt.G/2026/PA.Dgl" -> "459/Pdt.G". */
function t4NomorPendek(nomor) {
  return String(nomor || "").split("/").slice(0, 2).join("/");
}

function t4AlamatSippDepan() {
  const lokal = /^(127\.0\.0\.1|localhost)$/.test(String(location.hostname || ""));
  return `${location.origin}${lokal ? "/index.php/" : "/SIPP/"}`;
}

function t4AlamatAbtDepan() {
  return `${location.origin}/aps_badilag/`;
}

function t4AlamatAletaPerkara(nomor) {
  return `${location.origin}${dasarPortal()}/aleta-ecourt?perkara=${encodeURIComponent(String(nomor || ""))}`;
}

/** Kunci "per orang" - satu PC dapat dipakai beberapa pegawai bergantian. */
function t4KunciAkun(siapa) {
  return String((siapa && siapa.nama) || "").trim().toLowerCase() || "-";
}

function t4LabelPeran(id) {
  return String(id || "")
    .split("-")
    .filter(Boolean)
    .map((x) => x.charAt(0).toUpperCase() + x.slice(1))
    .join(" ");
}

/**
 * ============================================================================
 * MODE LAYAR PUBLIK (ide portal-28): NAMA PIHAK DISAMARKAN
 * ============================================================================
 *
 * Keputusan pengguna: menyala lewat tombol DAN pintasan keyboard, bertahan
 * sampai dimatikan, dan tandanya jelas di panel. Ekstensi tidak dapat
 * mengetahui layarnya sedang dibagikan atau diproyeksikan - karena itu tidak
 * ada yang menyala sendiri.
 *
 * Tiap kata dipotong menjadi dua huruf pertamanya, kata penghubung nasab
 * (bin, binti) dibiarkan: "Sri Rahayu binti Ikhsan" -> "Sr*** Ra*** binti
 * Ik***". Cukup untuk dikenali pemiliknya, tidak cukup untuk dibaca orang
 * di ruang rapat.
 */
const T4_KATA_TETAP = new Set(["bin", "binti", "alias", "als", "dan", "dkk"]);

function t4Samarkan(nama) {
  return String(nama || "")
    .split(/(\s+|;|,)/)
    .map((kata) => {
      if (!kata.trim() || /^[;,]$/.test(kata)) return kata;
      if (T4_KATA_TETAP.has(kata.toLowerCase())) return kata;
      const huruf = kata.replace(/[^A-Za-zÀ-ɏ]/g, "");
      return `${(huruf || kata).slice(0, 2)}***`;
    })
    .join("");
}

function t4NamaPihak(nama) {
  return t4Keadaan && t4Keadaan.publik ? t4Samarkan(nama) : String(nama || "");
}

/**
 * Salin ke papan klip - CADANGAN LEBIH DAHULU, sebelum await apa pun.
 *
 * SIPP dan portal satker berjalan di http://192.168.10.10, yang bukan konteks
 * aman: navigator.clipboard kerap tidak ada sama sekali. execCommand("copy")
 * hanya sah selama isyarat pengguna masih hangat, dan await pertama sudah
 * cukup untuk mendinginkannya - karena itu ia dicoba pertama, serempak.
 */
function t4SalinSerempak(teks) {
  let berhasil = false;
  try {
    const kotak = document.createElement("textarea");
    kotak.value = teks;
    kotak.setAttribute("readonly", "");
    kotak.style.position = "fixed";
    kotak.style.left = "-9999px";
    kotak.style.top = "0";
    document.body.appendChild(kotak);
    kotak.select();
    berhasil = typeof document.execCommand === "function" && document.execCommand("copy") === true;
    kotak.remove();
  } catch {
    berhasil = false;
  }
  return berhasil;
}

async function t4Salin(teks) {
  if (t4SalinSerempak(teks)) return true;
  try {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
      await navigator.clipboard.writeText(teks);
      return true;
    }
  } catch {
    /* ditolak - teksnya ditampilkan untuk disalin tangan */
  }
  return false;
}

/** Salin, lalu kabarkan hasilnya - teks yang gagal disalin DITAMPILKAN. */
function t4SalinDanKabarkan(teks, nama) {
  void t4Salin(teks).then((ok) => {
    if (ok) t4Kabar(`${nama} tersalin.`);
    else t4Kabar(`Papan klip ditolak peramban. Salin sendiri: ${teks}`, true);
  });
}

// ─── Unsur tampilan ──────────────────────────────────────────────────────────

function t4Bagian(judul, kode, tab) {
  const b = bagian(judul);
  b.kotak.classList.add("aleta-t4-bagian");
  if (kode) b.kotak.setAttribute("data-t4-fitur", kode);
  b.kotak.setAttribute("data-t4-tab", tab || "beranda");
  return b;
}

function t4Tombol(teks, judul, kelas) {
  const t = buatElemen("button", `aleta-t4-tombol${kelas ? ` ${kelas}` : ""}`, teks);
  t.type = "button";
  if (judul) t.title = judul;
  return t;
}

function t4Tautan(href, teks, judul, tabBaru) {
  const a = tautan(href, teks, "aleta-t4-tautan");
  if (judul) a.title = judul;
  if (tabBaru) a.target = "_blank";
  return a;
}

function t4Ket(teks, kelas) {
  return buatElemen("div", `aleta-t4-ket${kelas ? ` ${kelas}` : ""}`, teks);
}

/** Kabar jujur untuk ide yang datanya belum ada. */
function t4BelumTersedia(teks) {
  return buatElemen("div", "aleta-t4-belum", teks);
}

/**
 * Kabar singkat di panel (perbaikan desain D14). Satu kotak untuk seluruh
 * panel; kabar baru menggantikan yang lama, dan hilang sendiri.
 */
function t4Kabar(teks, buruk) {
  const k = t4Keadaan;
  if (!k || !k.panel || !k.panel.isConnected) {
    t4KabarTertunda = String(teks || "");
    return;
  }
  let kotak = k.panel.querySelector(".aleta-t4-kabar");
  if (!kotak) {
    kotak = buatElemen("div", "aleta-t4-kabar");
    kotak.setAttribute("role", "status");
    const kaki = k.panel.querySelector(".aleta-kaki");
    if (kaki) k.panel.insertBefore(kotak, kaki);
    else k.panel.appendChild(kotak);
  }
  kotak.textContent = String(teks || "");
  kotak.classList.toggle("aleta-t4-kabar-buruk", Boolean(buruk));
  kotak.hidden = false;
  clearTimeout(kotak.aletaPewaktu);
  kotak.aletaPewaktu = setTimeout(() => {
    kotak.hidden = true;
  }, buruk ? 12000 : 5000);
}

/** D3: pindah tab. Tanpa bilah tab (Lama, Baru) tidak berbuat apa-apa. */
function t4PilihTab(panel, tab, janganSimpan) {
  if (!panel || !panel.querySelector(".aleta-t4-tabbar")) return;
  if (!panel.querySelector(`.aleta-t4-tab[data-t4-ke="${tab}"]`)) return;
  panel.setAttribute("data-t4-tab-aktif", tab);
  for (const t of Array.from(panel.querySelectorAll(".aleta-t4-tab"))) {
    t.setAttribute("aria-selected", t.getAttribute("data-t4-ke") === tab ? "true" : "false");
  }
  if (!janganSimpan) t4Tulis({ [T4_KUNCI_TAB]: tab });
}

// ─── Letak panel (ide portal-8, perbaikan D1) ────────────────────────────────

/**
 * ============================================================================
 * PANEL TIDAK MENUTUPI TABEL - SAMPING, MENGAMBANG, MENGECIL SENDIRI
 * ============================================================================
 *
 * Keputusan pengguna: bawaannya SAMPING - panel menjadi kolom kanan dan isi
 * portal bergeser ke kiri, sehingga kolom Agenda Jadwal Sidang tidak lagi
 * tertutup. Mengambang (seperti selama ini) dan Mengecil-sendiri tetap dapat
 * dipilih.
 *
 * Yang digeser BUKAN elemen milik React. Portal menulis ulang className
 * elemennya sendiri setiap kali menggambar; kelas yang ditempelkan dari luar
 * hilang tanpa kabar. Yang dipasang satu atribut pada <html> - satu-satunya
 * elemen yang tidak pernah digambar ulang React - dan panel.css yang
 * memberi <body> margin kanan selebar panel.
 *
 * Atributnya hanya ada selama panel TERBENTANG. Lencana dan layar penuh
 * melepasnya, panel yang dibuang melepasnya (pengamat body), dan kembali ke
 * tampilan Lama melepasnya - halaman kembali selebar semula.
 */
function t4LetakBerlaku() {
  if (!t4Aktif()) return "";
  if (!(t4Nyala("portal-8") || t4Modern())) return "";
  return T4_LETAK.includes(t4LetakPilihan) ? t4LetakPilihan : "samping";
}

function t4TerapkanLetak() {
  let nilai = "";
  const panel = document.getElementById(PENANDA_ALETA);
  const letak = t4LetakBerlaku();
  if (panel && panel.isConnected && letak) {
    const ciut = panel.classList.contains("aleta-panel-lencana") || panel.classList.contains("aleta-panel-penuh");
    if (letak === "samping" && !ciut) nilai = "samping";
    if (letak === "mengecil") nilai = "mengecil";
  }
  try {
    const akar = document.documentElement;
    if (nilai) akar.setAttribute(T4_ATRIBUT_LETAK, nilai);
    else akar.removeAttribute(T4_ATRIBUT_LETAK);
  } catch {
    /* tanpa atributnya, panel mengambang seperti semula */
  }
  t4AturPengecil(nilai === "mengecil" ? panel : null);
  for (const t of Array.from(document.querySelectorAll(".aleta-t4-letak-pilih"))) {
    t.setAttribute("aria-pressed", t.getAttribute("data-t4-letak") === (letak || "mengambang") ? "true" : "false");
  }
}

/**
 * Mengecil sendiri: panel yang MENUTUPI tabel tinggal kepalanya selama kursor
 * tidak di atasnya. Kotak yang dibandingkan kotak terbentangnya - kotak yang
 * sudah mengecil tidak lagi menutupi, dan membandingkannya membuat panel
 * membesar-mengecil tanpa henti.
 */
function t4AturPengecil(panel) {
  if (t4PengecilPewaktu) {
    clearInterval(t4PengecilPewaktu);
    t4PengecilPewaktu = 0;
  }
  const semua = document.getElementById(PENANDA_ALETA);
  if (!panel) {
    if (semua && semua.hasAttribute("data-t4-menutupi")) semua.removeAttribute("data-t4-menutupi");
    return;
  }
  const periksa = () => {
    if (!panel.isConnected) {
      clearInterval(t4PengecilPewaktu);
      t4PengecilPewaktu = 0;
      return;
    }
    let sedangDitunjuk = false;
    try {
      sedangDitunjuk = panel.matches(":hover") || panel.matches(":focus-within");
    } catch {
      sedangDitunjuk = false;
    }
    if (sedangDitunjuk) return;
    const kecil = panel.getAttribute("data-t4-menutupi") === "ya";
    let kotak = null;
    if (kecil && panel.aletaKotakPenuh) kotak = panel.aletaKotakPenuh;
    else {
      const r = panel.getBoundingClientRect();
      kotak = { kiri: r.left, kanan: r.right, atas: r.top, bawah: r.bottom };
      panel.aletaKotakPenuh = kotak;
    }
    let menutupi = false;
    for (const tabel of Array.from(document.querySelectorAll("table")).slice(0, 40)) {
      if (panel.contains(tabel)) continue;
      const r = tabel.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) continue;
      if (r.left < kotak.kanan && r.right > kotak.kiri && r.top < kotak.bawah && r.bottom > kotak.atas) {
        menutupi = true;
        break;
      }
    }
    if (menutupi) panel.setAttribute("data-t4-menutupi", "ya");
    else panel.removeAttribute("data-t4-menutupi");
  };
  t4PengecilPewaktu = setInterval(() => {
    try {
      periksa();
    } catch {
      /* halaman sedang ditutup */
    }
  }, 1200);
  periksa();
}

function t4SetelLetak(letak) {
  t4LetakPilihan = T4_LETAK.includes(letak) ? letak : "samping";
  t4Tulis({ [T4_KUNCI_LETAK]: t4LetakPilihan });
  t4TerapkanLetak();
  const nama = { samping: "Samping - halaman bergeser ke kiri", mengambang: "Mengambang", mengecil: "Mengecil sendiri saat menutupi tabel" };
  t4Kabar(`Letak panel: ${nama[t4LetakPilihan]}.`);
}

function t4PemilihLetak() {
  const baris = buatElemen("div", "aleta-t4-letak");
  baris.appendChild(buatElemen("span", "aleta-t4-label", "Letak panel"));
  const pilihan = [
    ["samping", "▥ Samping", "Panel menjadi kolom kanan; isi halaman bergeser ke kiri sehingga tabel tidak tertutup."],
    ["mengambang", "Mengambang", "Panel melayang dan dapat digeser, seperti selama ini."],
    ["mengecil", "Mengecil sendiri", "Panel tinggal kepalanya saat menutupi tabel, dan membentang saat ditunjuk."],
  ];
  const berlaku = t4LetakBerlaku() || "mengambang";
  for (const [nilai, teks, judul] of pilihan) {
    const t = t4Tombol(teks, judul, "aleta-t4-letak-pilih");
    t.setAttribute("data-t4-letak", nilai);
    t.setAttribute("aria-pressed", berlaku === nilai ? "true" : "false");
    t.addEventListener("click", () => t4SetelLetak(nilai));
    baris.appendChild(t);
  }
  return baris;
}

// ─── Layar publik (ide portal-28) ────────────────────────────────────────────

function t4LayarPublikBoleh() {
  return t4Nyala("portal-28");
}

function t4SetelPublik(nyala) {
  if (!t4LayarPublikBoleh()) return;
  t4KabarTertunda = nyala
    ? "Mode layar publik MENYALA - nama pihak disamarkan sampai dimatikan (Alt+L)."
    : "Mode layar publik dimatikan - nama pihak tampil utuh lagi.";
  t4Tulis({ [T4_KUNCI_PUBLIK]: Boolean(nyala) });
  // Penyimpanan mengabarkan perubahannya ke semua tab; pendengarnya yang
  // menyusun ulang panel (t4DengarkanKunci). Di luar konteks ekstensi -
  // tanpa kabar itu - panel disusun ulang dari sini.
  if (t4Keadaan) t4Keadaan.publikDiminta = Boolean(nyala);
  setTimeout(() => {
    if (t4Keadaan && t4Keadaan.publik !== Boolean(nyala)) t4BangunUlang();
  }, 300);
}

function t4TombolPublik(k) {
  const t = t4Tombol(
    k.publik ? "◐ Layar publik: MENYALA" : "◐ Layar publik: mati",
    "Menyamarkan nama pihak di panel ini (mis. Sr*** binti Ik***) saat layar dibagikan atau diproyeksikan. Bertahan sampai dimatikan. Pintasan Alt+L. Ekstensi tidak dapat mengetahui sendiri kapan layar dibagikan.",
    "aleta-t4-publik-saklar"
  );
  t.setAttribute("aria-pressed", k.publik ? "true" : "false");
  t.addEventListener("click", () => t4SetelPublik(!k.publik));
  return t;
}

function t4PitaPublik() {
  const pita = buatElemen("div", "aleta-t4-pita-publik");
  pita.setAttribute("data-t4-tab", "semua");
  pita.setAttribute("role", "status");
  pita.textContent = "◐ LAYAR PUBLIK - nama pihak disamarkan. Alt+L untuk mematikan.";
  return pita;
}

// ─── Sumber data bersama ─────────────────────────────────────────────────────

function t4Checklist(k) {
  if (!k.janjiChecklist) {
    const peran = k.peranChecklist ? `?peran=${encodeURIComponent(k.peranChecklist)}` : "";
    k.janjiChecklist = t4AmbilJson(`/api/aleta-ecourt/checklist${peran}`, "Membaca tugas saya");
  }
  return k.janjiChecklist;
}

function t4CatatanPortal(k) {
  if (!k.janjiCatatan) k.janjiCatatan = t4AmbilJson("/api/aleta-ecourt/ekstensi-panel/catatan?batas=3", "Membaca catatan pembaruan");
  return k.janjiCatatan;
}

/** Alamat SIPP satu perkara yang SUDAH diketahui peramban ini, atau "". */
function t4AlamatSippDikenal(k, nomor) {
  const n = String(nomor || "");
  const r = k.riwayat.find((x) => x && x.nomor === n && x.url);
  if (r) return String(r.url);
  const t = k.tautan && k.tautan[n];
  return t && t.url ? String(t.url) : "";
}

/** Tautan ABT: halaman depannya, dan nomor perkara disalin untuk kotak cari ABT. */
function t4TautanAbt(nomor, teks) {
  const a = t4Tautan(
    t4AlamatAbtDepan(),
    teks || "ABT ↗",
    "ABT dibuka lewat pencarian (tidak punya alamat per perkara) - nomor perkara disalin untuk ditempel di kotak cari ABT.",
    true
  );
  a.addEventListener("click", () => {
    if (!nomor) return;
    // Serempak, di dalam klik - lihat t4SalinSerempak.
    t4SalinDanKabarkan(String(nomor), `Nomor ${t4NomorPendek(nomor)} (tempel di kotak cari ABT)`);
  });
  return a;
}

// ─── Kepala: ikon berlabel (portal-6), lencana server (portal-7), menu ⋯ (D2) ─

const T4_KELOMPOK_IKON = [
  [".aleta-tema", "tampilan", "Tema"],
  [".aleta-warna-tombol", "tampilan", "Warna panel"],
  [".aleta-lipat", "jendela", "Ciutkan"],
  [".aleta-penuh", "jendela", "Layar penuh"],
  [".aleta-bawaan", "jendela", "Kembalikan posisi"],
  [".aleta-matikan", "jendela", "Tutup"],
  [".aleta-warna-lepas", "sambungan", "Warna mengikuti popup"],
  [".aleta-perkakas-tombol", "sambungan", "Perkakas"],
];

/**
 * portal-6: tiap ikon kepala bernama, dan dikelompokkan tampilan | jendela |
 * sambungan dengan garis pemisah - supaya "Tutup" tidak lagi berdiri di
 * sebelah "Ciutkan" tanpa beda. Tombolnya DIPINDAH urutannya, bukan dibuat
 * ulang: pendengar kliknya tetap yang dipasang panel-alat.js. Baris titik
 * warna ikut pindah bersama tombolnya, sebab ia melayang di bawah tombol itu.
 */
function t4IkonBerlabel(k) {
  const wadah = k.kepala.querySelector(".aleta-alat-kepala");
  if (!wadah) return;
  wadah.setAttribute("data-t4-berlabel", "ya");
  const kelompok = { tampilan: [], jendela: [], sambungan: [] };
  for (const [pemilih, nama, label] of T4_KELOMPOK_IKON) {
    const t = wadah.querySelector(pemilih);
    if (!t) continue;
    t.setAttribute("data-t4-kelompok", nama);
    t.setAttribute("aria-label", `${label} - ${t.title || label}`);
    kelompok[nama].push(t);
    if (pemilih === ".aleta-warna-tombol") {
      const titik = wadah.querySelector(".aleta-warna-pilih");
      if (titik) kelompok[nama].push(titik);
    }
  }
  let pertama = true;
  for (const nama of ["tampilan", "jendela", "sambungan"]) {
    if (kelompok[nama].length === 0) continue;
    if (!pertama) {
      const pemisah = buatElemen("span", "aleta-t4-pemisah");
      pemisah.setAttribute("aria-hidden", "true");
      wadah.appendChild(pemisah);
    }
    pertama = false;
    for (const x of kelompok[nama]) wadah.appendChild(x);
  }
}

/** portal-7: lencana SERVER menyebut versi server dan kecepatan jawabnya. */
async function t4LencanaServer(k) {
  const chip = k.kepala.querySelector(".aleta-lingkungan");
  if (!chip) return;
  const labelAsli = chip.textContent;
  const hasil = await t4CatatanPortal(k);
  if (!chip.isConnected) return;
  const ms = t4LamaSiapaMs;
  const versi = hasil.ok && hasil.data ? String(hasil.data.versiPortal || "") : "";
  const bagianTeks = [labelAsli];
  if (versi) bagianTeks.push(`ALETA ${versi}`);
  if (ms) bagianTeks.push(`${ms} ms`);
  chip.textContent = bagianTeks.join(" · ");
  const lambat = !hasil.ok || ms > T4_LAMBAT_MS;
  chip.classList.add("aleta-t4-lencana");
  chip.classList.toggle("aleta-t4-lambat", lambat);
  chip.title = `${chip.title}\n${
    hasil.ok
      ? `Server ALETA ${versi || "?"} menjawab "siapa saya" dalam ${ms} ms${lambat ? " - LAMBAT." : "."}`
      : `Server ALETA tidak menjawab: ${hasil.pesan}`
  }`;
}

/** D2: dua ikon utama (⌕ dan ⋯) dan satu menu berlabel yang memuat SEMUA tombol lama. */
function t4MenuKepala(k) {
  const utama = buatElemen("span", "aleta-t4-kepala-utama");
  if (t4Nyala("portal-13")) {
    const cari = t4Tombol("⌕", "Cari perkara (Alt+K)", "aleta-t4-ikon");
    cari.setAttribute("aria-label", "Cari perkara");
    cari.addEventListener("click", () => t4FokusCari(k.panel));
    utama.appendChild(cari);
  }
  const tombolMenu = t4Tombol("⋯", "Menu panel: tampilan, jendela, sambungan", "aleta-t4-ikon aleta-t4-menu-tombol");
  tombolMenu.setAttribute("aria-haspopup", "menu");
  tombolMenu.setAttribute("aria-expanded", "false");
  utama.appendChild(tombolMenu);

  const menu = buatElemen("div", "aleta-t4-menu");
  menu.setAttribute("role", "menu");
  menu.hidden = true;
  const tutupMenu = () => {
    menu.hidden = true;
    tombolMenu.setAttribute("aria-expanded", "false");
  };
  const kelompok = (judul) => {
    menu.appendChild(buatElemen("div", "aleta-t4-menu-judul", judul));
  };
  /** Butir yang meneruskan ke tombol lama - fungsinya tetap satu, hanya pintunya pindah. */
  const butir = (teks, ket, jalankan) => {
    const t = t4Tombol("", ket, "aleta-t4-menu-butir");
    t.setAttribute("role", "menuitem");
    t.appendChild(buatElemen("span", "aleta-t4-menu-teks", teks));
    if (ket) t.appendChild(buatElemen("span", "aleta-t4-menu-ket", ket));
    t.addEventListener("click", () => {
      tutupMenu();
      jalankan();
    });
    menu.appendChild(t);
    return t;
  };
  const tekanAsli = (pemilih) => {
    const asli = k.panel.querySelector(pemilih);
    if (asli) asli.click();
  };
  const ada = (pemilih) => Boolean(k.panel.querySelector(pemilih));

  kelompok("Tampilan");
  if (ada(".aleta-tema")) butir("Tema gelap / terang", "panel, portal, popup, SIPP, dan ABT sekaligus", () => tekanAsli(".aleta-tema"));
  if (t4LayarPublikBoleh()) {
    butir(k.publik ? "Matikan layar publik" : "Layar publik", "nama pihak disamarkan · Alt+L", () => t4SetelPublik(!k.publik));
  }
  kelompok("Jendela");
  if (ada(".aleta-lipat")) butir("Ciutkan ke lencana", "Alt+A", () => tekanAsli(".aleta-lipat"));
  if (ada(".aleta-penuh")) butir("Layar penuh", "masuk / keluar", () => tekanAsli(".aleta-penuh"));
  if (ada(".aleta-bawaan")) butir("Kembalikan posisi dan ukuran", "bawaan", () => tekanAsli(".aleta-bawaan"));
  const posisi = buatElemen("div", "aleta-t4-menu-letak");
  posisi.appendChild(t4PemilihLetak());
  menu.appendChild(posisi);
  if (ada(".aleta-matikan")) butir("Tutup panel", "menjadi lencana; ALETA tetap aktif", () => tekanAsli(".aleta-matikan"));
  kelompok("Sambungan");
  if (ada(".aleta-kaki-segar")) butir("Muat ulang panel", "baca ulang akun dan kewenangan", () => tekanAsli(".aleta-kaki-segar"));
  if (ada(".aleta-warna-lepas")) butir("Warna mengikuti popup / dilepas", "khusus Super Admin", () => tekanAsli(".aleta-warna-lepas"));

  tombolMenu.addEventListener("click", () => {
    const buka = menu.hidden;
    menu.hidden = !buka;
    tombolMenu.setAttribute("aria-expanded", buka ? "true" : "false");
  });
  // Menutup saat menekan di luar menu. Escape juga menutup - dan tidak
  // diteruskan, sebab Escape di panel ini berarti "ciutkan panel".
  document.addEventListener(
    "pointerdown",
    (e) => {
      if (menu.hidden) return;
      if (e.target instanceof Node && (menu.contains(e.target) || tombolMenu.contains(e.target))) return;
      tutupMenu();
    },
    true
  );
  menu.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    e.stopPropagation();
    tutupMenu();
    tombolMenu.focus();
  });

  const wadahAlat = k.kepala.querySelector(".aleta-alat-kepala");
  if (wadahAlat && wadahAlat.parentNode === k.kepala) k.kepala.insertBefore(utama, wadahAlat.nextSibling);
  else k.kepala.appendChild(utama);
  k.panel.appendChild(menu);
}

// ─── Beranda: sambungan (portal-14), tugas (11), sidang (23), lonceng (12) ──

function t4BagianSambungan(k) {
  const { kotak, isi } = t4Bagian("Sambungan", "portal-14", "beranda");
  const muat = async () => {
    isi.textContent = "";
    isi.appendChild(t4Ket("Memeriksa sambungan…"));
    const [server, sipp, abt] = await Promise.all([
      t4AmbilJson("/api/aleta-ecourt/ekstensi-panel/sambungan", "Membaca keadaan sambungan"),
      t4Jangkau(t4AlamatSippDepan()),
      t4Jangkau(t4AlamatAbtDepan()),
    ]);
    isi.textContent = "";
    const d = server.ok && server.data ? server.data : null;
    const lampu = [];
    const tambah = (nama, keadaan, ket) => lampu.push({ nama, keadaan, ket });
    if (d) {
      const ms = t4LamaSiapaMs;
      tambah("Server ALETA", ms > T4_LAMBAT_MS ? "awas" : "baik", `${d.versiPortal || ""}${ms ? ` · ${ms} ms` : ""}`.trim());
      tambah("ALETA Bot", d.bot && d.bot.hidup ? "baik" : "buruk", d.bot && d.bot.hidup ? "" : "tidak menjawab");
    } else {
      tambah("Server ALETA", "buruk", server.pesan);
    }
    tambah("SIPP", sipp.hidup ? (sipp.ms > T4_LAMBAT_MS ? "awas" : "baik") : "buruk", sipp.hidup ? `${sipp.ms} ms` : "tidak menjawab");
    tambah("ABT", abt.hidup ? (abt.ms > T4_LAMBAT_MS ? "awas" : "baik") : "buruk", abt.hidup ? `${abt.ms} ms` : "tidak menjawab");
    if (d && d.ecourt) {
      const e = d.ecourt;
      tambah("e-Court", e.keadaan === "hidup" ? "baik" : e.keadaan === "tidak-diketahui" ? "awas" : "buruk", e.keadaan === "hidup" ? "sesi hidup" : e.sebab || e.keadaan);
    }
    if (d && d.whatsapp && d.whatsapp.keadaan !== "nonaktif") {
      const w = d.whatsapp;
      tambah("WhatsApp", w.keadaan === "tersambung" ? "baik" : w.keadaan === "tidak-diketahui" ? "awas" : "buruk", w.keadaan === "tersambung" ? "tersambung" : w.sebab || w.keadaan);
    }
    const terganggu = lampu.filter((x) => x.keadaan !== "baik");
    const pita = buatElemen(
      "div",
      `aleta-t4-pita ${terganggu.length === 0 ? "aleta-t4-pita-baik" : "aleta-t4-pita-awas"}`,
      terganggu.length === 0 ? "✓ Semua tersambung" : `! Ada gangguan: ${terganggu.map((x) => x.nama).join(", ")}`
    );
    isi.appendChild(pita);
    const daftar = buatElemen("ul", "aleta-t4-lampu");
    for (const x of lampu) {
      const li = buatElemen("li", `aleta-t4-lampu-${x.keadaan}`);
      li.appendChild(buatElemen("span", "aleta-t4-titik", "●"));
      li.appendChild(buatElemen("span", "aleta-t4-lampu-nama", x.nama));
      if (x.ket) li.appendChild(buatElemen("span", "aleta-t4-lampu-ket", x.ket));
      daftar.appendChild(li);
    }
    isi.appendChild(daftar);
    const ulang = t4Tombol("↻ Periksa lagi", "Memeriksa ulang sambungan tanpa memuat ulang halaman", "aleta-t4-kecil");
    ulang.addEventListener("click", () => void muat());
    isi.appendChild(ulang);
  };
  k.muat.sambungan = muat;
  return kotak;
}

/** Ke mana satu butir checklist dikerjakan - alamat yang dapat dibuka dari portal. */
function t4AlamatKerjakan(k, butir) {
  const kerja = (butir && butir.kerjakan) || {};
  const nomor = butir && butir.perkara ? butir.perkara.nomor : "";
  if (kerja.tujuan === "aleta" && kerja.alamat) {
    const alamat = String(kerja.alamat);
    return alamat.startsWith("/aleta") || !dasarPortal() ? `${location.origin}${alamat}` : `${location.origin}${dasarPortal()}${alamat}`;
  }
  if (kerja.tujuan === "abt") return t4AlamatAbtDepan();
  if (kerja.tujuan === "ecourt") return `${location.origin}${dasarPortal()}/aleta-ecourt`;
  return t4AlamatSippDikenal(k, nomor) || t4AlamatSippDepan();
}

function t4BagianTugas(k) {
  const { kotak, isi } = t4Bagian("Tugas saya hari ini", "portal-11", "beranda");
  const muat = async () => {
    isi.textContent = "";
    isi.appendChild(t4Ket("Membaca checklist…"));
    const hasil = await t4Checklist(k);
    isi.textContent = "";
    if (!hasil.ok || !hasil.data) {
      isi.appendChild(t4BelumTersedia(hasil.pesan || "Checklist tidak terbaca."));
      return;
    }
    const d = hasil.data;
    const r = d.ringkas || {};
    const ubin = buatElemen("div", "aleta-t4-ubin-angka");
    for (const [nilai, label, kelas] of [
      [r.lewat, "terlambat", "aleta-t4-lewat"],
      [r.hariIni, "hari ini", "aleta-t4-hari-ini"],
      [r.mingguIni, "minggu ini", ""],
    ]) {
      const u = buatElemen("div", `aleta-t4-angka ${kelas}`.trim());
      u.appendChild(buatElemen("strong", "", String(Number(nilai) || 0)));
      u.appendChild(buatElemen("span", "", label));
      ubin.appendChild(u);
    }
    isi.appendChild(ubin);
    const butir = (Array.isArray(d.butir) ? d.butir : []).filter((b) => b && b.kelompok !== "minggu-ini").slice(0, 2);
    if (butir.length > 0) {
      const daftar = buatElemen("ul", "aleta-t4-daftar");
      for (const b of butir) {
        const li = buatElemen("li", b.kelompok === "lewat" ? "aleta-t4-lewat" : "");
        const teks = buatElemen("div", "aleta-t4-baris-teks");
        teks.appendChild(buatElemen("span", "aleta-t4-baris-judul", `${b.kelompok === "lewat" ? "⚠ " : ""}${String(b.judul || "")}`));
        if (b.perkara && b.perkara.nomor) teks.appendChild(buatElemen("span", "aleta-t4-nomor", String(b.perkara.nomor)));
        if (b.keterangan) teks.appendChild(buatElemen("span", "aleta-t4-lembut", String(b.keterangan)));
        li.appendChild(teks);
        li.appendChild(t4Tautan(t4AlamatKerjakan(k, b), "Kerjakan", "Membuka tempat pekerjaan ini dikerjakan", true));
        daftar.appendChild(li);
      }
      isi.appendChild(daftar);
    } else {
      isi.appendChild(t4Ket("Tidak ada tugas yang terlambat atau jatuh tempo hari ini."));
    }
    const galat = Array.isArray(d.galat) ? d.galat.filter(Boolean) : [];
    if (galat.length > 0) isi.appendChild(t4Ket(String(galat[0]), "aleta-t4-lembut"));
  };
  k.muat.tugas = muat;
  return kotak;
}

/** Nama tanpa gelar dan tanda baca - untuk mencocokkan akun ALETA dengan nama pejabat SIPP. */
function t4IntiNama(nama) {
  return String(nama || "")
    .toLowerCase()
    .split(/[\s,]+/)
    .filter((kata) => kata && !kata.includes(".") && kata.length > 1 && !/^(dr|drs|hj|h|ir|prof)$/.test(kata))
    .map((kata) => kata.replace(/[^a-zÀ-ɏ'-]/g, ""))
    .filter(Boolean);
}

function t4SidangMilikSaya(sidang, inti) {
  if (inti.length === 0) return false;
  const nama = t4IntiNama(`${sidang.majelisNama || ""} ${sidang.paniteraNama || ""} ${sidang.jurusitaNama || ""}`);
  const ada = new Set(nama);
  return inti.every((kata) => ada.has(kata));
}

function t4BagianSidang(k) {
  const { kotak, isi } = t4Bagian("Sidang saya hari ini", "portal-23", "beranda");
  const muat = async () => {
    isi.textContent = "";
    isi.appendChild(t4Ket("Membaca jadwal sidang hari ini…"));
    const kini = new Date();
    const tanggal = `${kini.getFullYear()}-${t4Pad(kini.getMonth() + 1)}-${t4Pad(kini.getDate())}`;
    const hasil = await t4AmbilJson(`/api/aleta-ecourt/sidang?dari=${tanggal}&sampai=${tanggal}&batas=300`, "Membaca jadwal sidang");
    isi.textContent = "";
    if (!hasil.ok || !hasil.data || hasil.data.available === false) {
      isi.appendChild(t4BelumTersedia((hasil.data && hasil.data.message) || hasil.pesan || "Jadwal sidang tidak terbaca."));
      return;
    }
    const semua = Array.isArray(hasil.data.sidang) ? hasil.data.sidang : [];
    const inti = t4IntiNama(k.siapa && k.siapa.nama);
    const milik = semua.filter((s) => t4SidangMilikSaya(s, inti));
    if (milik.length === 0) {
      isi.appendChild(
        t4Ket(
          `Tidak ada sidang atas nama Anda hari ini (dari ${semua.length} sidang). Dicocokkan dengan nama akun ALETA terhadap majelis, panitera pengganti, dan juru sita.`
        )
      );
      return;
    }
    const selesai = milik.filter((s) => s.sudahPutus || s.ditunda || s.ikrarTercatat).length;
    isi.appendChild(t4Ket(`${selesai} dari ${milik.length} sidang selesai dicatat.`, "aleta-t4-ringkas"));
    const daftar = buatElemen("ul", "aleta-t4-daftar");
    for (const s of milik.slice(0, 8)) {
      const beres = s.sudahPutus || s.ditunda || s.ikrarTercatat;
      const li = buatElemen("li", beres ? "aleta-t4-beres" : "");
      const teks = buatElemen("div", "aleta-t4-baris-teks");
      teks.appendChild(buatElemen("span", "aleta-t4-nomor", `${beres ? "✓" : "○"} ${t4NomorPendek(s.nomorPerkara)}`));
      teks.appendChild(buatElemen("span", "aleta-t4-lembut", [s.jamSidang, s.ruangan, s.agenda].filter(Boolean).join(" · ")));
      li.appendChild(teks);
      daftar.appendChild(li);
    }
    isi.appendChild(daftar);
  };
  k.muat.sidang = muat;
  return kotak;
}

function t4AlamatPortal(href) {
  const h = String(href || "");
  if (/^https?:\/\//.test(h)) return h;
  if (!h.startsWith("/")) return `${location.origin}${dasarPortal()}/${h}`;
  return h.startsWith("/aleta/") || !dasarPortal() ? `${location.origin}${h}` : `${location.origin}${dasarPortal()}${h}`;
}

function t4BagianLonceng(k) {
  const { kotak, isi } = t4Bagian("Pemberitahuan", "portal-12", "beranda");
  const muat = async () => {
    isi.textContent = "";
    isi.appendChild(t4Ket("Membaca lonceng portal…"));
    const hasil = await t4AmbilJson("/api/tasks?limit=30", "Membaca pemberitahuan");
    isi.textContent = "";
    if (!hasil.ok || !hasil.data) {
      isi.appendChild(t4BelumTersedia(hasil.pesan || "Pemberitahuan tidak terbaca."));
      return;
    }
    const tugas = [];
    for (const s of Array.isArray(hasil.data.sources) ? hasil.data.sources : []) {
      for (const t of Array.isArray(s.tasks) ? s.tasks : []) if (t && !t.seen) tugas.push(t);
    }
    const judul = kotak.querySelector(".aleta-bagian-judul");
    if (judul) judul.textContent = `Pemberitahuan${tugas.length ? ` · ${tugas.length} baru` : ""}`;
    if (tugas.length === 0) {
      isi.appendChild(t4Ket("Tidak ada pemberitahuan baru."));
      return;
    }
    const daftar = buatElemen("ul", "aleta-t4-daftar");
    for (const t of tugas.slice(0, 5)) {
      const li = buatElemen("li", t.priority === "urgent" ? "aleta-t4-lewat" : "");
      const teks = buatElemen("div", "aleta-t4-baris-teks");
      teks.appendChild(buatElemen("span", "aleta-t4-baris-judul", `● ${String(t.title || "")}`));
      if (t.sourceLabel) teks.appendChild(buatElemen("span", "aleta-t4-lembut", String(t.sourceLabel)));
      li.appendChild(teks);
      if (t.href) li.appendChild(t4Tautan(t4AlamatPortal(t.href), "Buka", "Membuka pemberitahuan ini di portal", false));
      daftar.appendChild(li);
    }
    isi.appendChild(daftar);
    // Jujur tentang batasnya: panel ini tidak menulis ke portal.
    isi.appendChild(t4Ket("Tanda dibaca dicatat portal saat pemberitahuannya dibuka - panel ini hanya membaca.", "aleta-t4-lembut"));
  };
  k.muat.lonceng = muat;
  return kotak;
}

// ─── Perkara: cari (portal-13, 22), tulisan (19), unduhan (25), minggu (20), catatan (26)

function t4FokusCari(panel) {
  if (!panel) return;
  if (panel.classList.contains("aleta-panel-lencana") && typeof alatCiutkan === "function") {
    alatCiutkan(panel, KUNCI_POSISI_ALETA, false);
  }
  t4PilihTab(panel, "perkara");
  const kotak = panel.querySelector(".aleta-t4-cari-masukan");
  if (kotak) {
    kotak.scrollIntoView({ block: "nearest" });
    kotak.focus();
  }
}

/** Tombol salin tautan SIPP: bila alamatnya belum dikenal, tekanan pertama menyiapkannya. */
function t4TombolSalinSipp(k, nomor, perkaraId) {
  const t = t4Tombol("SIPP", "Salin tautan perkara ini di SIPP", "aleta-t4-kecil");
  let alamat = t4AlamatSippDikenal(k, nomor);
  t.addEventListener("click", () => {
    if (alamat) {
      t4SalinDanKabarkan(alamat, `Tautan SIPP ${t4NomorPendek(nomor)}`);
      return;
    }
    // Alamat SIPP bersandi hanya dapat disusun server. Papan klip tidak
    // boleh ditulis sesudah menunggu jawabannya (isyarat pengguna sudah
    // dingin di SIPP http) - jadi tekanan pertama menyiapkan, tekanan kedua
    // menyalin.
    t.disabled = true;
    t.textContent = "SIPP…";
    const q = new URLSearchParams({ nomor: String(nomor || "") });
    if (perkaraId) q.set("perkaraId", String(perkaraId));
    void t4AmbilJson(`/api/aleta-ecourt/sipp-tautan?${q.toString()}`, "Menyusun tautan SIPP").then((h) => {
      t.disabled = false;
      const a = h.ok && h.data ? String(h.data.alamat || "") : "";
      if (a) {
        alamat = a;
        t.textContent = "SIPP ✓ salin";
        t.title = "Tautan SIPP siap - tekan sekali lagi untuk menyalin";
        t4Kabar(`Tautan SIPP ${t4NomorPendek(nomor)} siap - tekan "SIPP ✓ salin" untuk menyalin.`);
      } else {
        t.textContent = "SIPP";
        t4Kabar((h.data && h.data.alasan) || h.pesan || "Tautan SIPP tidak dapat disusun.", true);
      }
    });
  });
  return t;
}

function t4BarisSalin(k, nomor, perkaraId) {
  const baris = buatElemen("div", "aleta-t4-salin");
  baris.appendChild(buatElemen("span", "aleta-t4-lembut", "⧉ Salin tautan:"));
  baris.appendChild(t4TombolSalinSipp(k, nomor, perkaraId));
  const aleta = t4Tombol("ALETA", "Salin tautan Status Perkara di portal ALETA", "aleta-t4-kecil");
  aleta.addEventListener("click", () => t4SalinDanKabarkan(t4AlamatAletaPerkara(nomor), `Tautan ALETA ${t4NomorPendek(nomor)}`));
  baris.appendChild(aleta);
  baris.title = "ABT tidak punya alamat per perkara, jadi tidak ada tautan ABT untuk disalin.";
  return baris;
}

function t4BukaSipp(k, nomor, perkaraId) {
  const t = t4Tombol("SIPP ↗", "Membuka perkara ini di SIPP", "aleta-t4-kecil");
  t.addEventListener("click", () => {
    const dikenal = t4AlamatSippDikenal(k, nomor);
    if (dikenal) {
      window.open(dikenal, "_blank", "noopener");
      return;
    }
    // Jendelanya dibuka SEKARANG, di dalam klik - jendela yang dibuka sesudah
    // menunggu jawaban server ditahan pemblokir munculan peramban.
    let jendela = null;
    try {
      jendela = window.open("about:blank", "_blank");
    } catch {
      jendela = null;
    }
    const q = new URLSearchParams({ nomor: String(nomor || "") });
    if (perkaraId) q.set("perkaraId", String(perkaraId));
    void t4AmbilJson(`/api/aleta-ecourt/sipp-tautan?${q.toString()}`, "Menyusun tautan SIPP").then((h) => {
      const alamat = h.ok && h.data ? String(h.data.alamat || "") : "";
      if (alamat && jendela) {
        jendela.location.href = alamat;
        return;
      }
      if (jendela) jendela.close();
      if (alamat) window.open(alamat, "_blank", "noopener");
      else t4Kabar((h.data && h.data.alasan) || h.pesan || "Perkara ini tidak dapat dibuka di SIPP.", true);
    });
  });
  return t;
}

function t4BagianCari(k) {
  const { kotak, isi } = t4Bagian("Cari perkara", "portal-13", "perkara");
  const bentuk = buatElemen("form", "aleta-t4-cari");
  const masukan = document.createElement("input");
  masukan.type = "search";
  masukan.className = "aleta-t4-cari-masukan";
  masukan.placeholder = "Nomor perkara atau nama pihak… (Alt+K)";
  masukan.setAttribute("aria-label", "Cari perkara");
  const tombol = t4Tombol("Cari", "Mencari perkara di SIPP lewat ALETA", "");
  tombol.type = "submit";
  bentuk.appendChild(masukan);
  bentuk.appendChild(tombol);
  isi.appendChild(bentuk);
  const hasilWadah = buatElemen("div", "aleta-t4-cari-hasil");
  isi.appendChild(hasilWadah);

  const cari = async (kata) => {
    hasilWadah.textContent = "";
    if (kata.length < 2) {
      hasilWadah.appendChild(t4Ket("Ketik paling sedikit dua huruf atau angka."));
      return;
    }
    hasilWadah.appendChild(t4Ket("Mencari…"));
    const q = new URLSearchParams({ cari: kata, batas: "8" });
    const hasil = await t4AmbilJson(`/api/aleta-ecourt/status-perkara?${q.toString()}`, "Mencari perkara");
    hasilWadah.textContent = "";
    if (!hasil.ok || !hasil.data) {
      hasilWadah.appendChild(t4BelumTersedia(hasil.pesan || "Pencarian gagal."));
      return;
    }
    if (hasil.data.available === false) {
      hasilWadah.appendChild(t4BelumTersedia(String(hasil.data.message || "ALETA Bot belum dapat dihubungi.")));
      return;
    }
    const perkara = Array.isArray(hasil.data.perkara) ? hasil.data.perkara : [];
    if (perkara.length === 0) {
      hasilWadah.appendChild(t4Ket(`Tidak ada perkara yang cocok dengan "${kata}".`));
      return;
    }
    const daftar = buatElemen("ul", "aleta-t4-daftar");
    for (const p of perkara) {
      const li = buatElemen("li", "aleta-t4-hasil");
      const teks = buatElemen("div", "aleta-t4-baris-teks");
      teks.appendChild(buatElemen("span", "aleta-t4-nomor", String(p.nomorPerkara || "")));
      teks.appendChild(buatElemen("span", "aleta-t4-lembut", [p.jenisPerkara, p.tahapan || (p.sudahPutus ? "Putus" : "")].filter(Boolean).join(" · ")));
      if (p.pihak1 || p.pihak2) {
        const pihak = buatElemen("span", "aleta-t4-pihak", `${t4NamaPihak(p.pihak1)} · lawan · ${t4NamaPihak(p.pihak2)}`);
        pihak.setAttribute("data-t4-nama-pihak", "ya");
        teks.appendChild(pihak);
      }
      li.appendChild(teks);
      const aksi = buatElemen("div", "aleta-t4-aksi-baris");
      aksi.appendChild(t4BukaSipp(k, p.nomorPerkara, p.perkaraId));
      aksi.appendChild(t4TautanAbt(p.nomorPerkara));
      aksi.appendChild(t4Tautan(t4AlamatAletaPerkara(p.nomorPerkara), "ALETA ↗", "Membuka Status Perkara di portal ALETA", false));
      li.appendChild(aksi);
      if (t4Nyala("portal-22")) li.appendChild(t4BarisSalin(k, p.nomorPerkara, p.perkaraId));
      daftar.appendChild(li);
    }
    hasilWadah.appendChild(daftar);
    if (hasil.data.adaLagi) hasilWadah.appendChild(t4Ket("Masih ada yang cocok - persempit kata carinya, atau buka Status Perkara di portal.", "aleta-t4-lembut"));
  };
  bentuk.addEventListener("submit", (e) => {
    e.preventDefault();
    void cari(String(masukan.value || "").trim());
  });
  masukan.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    // Escape di kotak cari mengosongkannya, bukan menciutkan panel.
    e.stopPropagation();
    masukan.value = "";
    hasilWadah.textContent = "";
  });
  k.cari = cari;
  return kotak;
}

function t4BagianTulisan() {
  const { kotak, isi } = t4Bagian("Yang saya tulis ke SIPP hari ini", "portal-19", "perkara");
  isi.appendChild(
    t4BelumTersedia(
      "Belum tersedia. ALETA belum menyimpan catatan tulisan ke SIPP per petugas di tempat yang dapat dibaca panel - tulisannya tercatat di audit SIPP sendiri. Menunggu rute baca dari ALETA Bot."
    )
  );
  return kotak;
}

function t4BagianUnduhan(k) {
  const { kotak, isi } = t4Bagian("Unduhan terakhir", "portal-25", "perkara");
  const daftarSimpan = Array.isArray(k.unduhan) ? k.unduhan.filter((x) => x && x.nama) : [];
  if (daftarSimpan.length === 0) {
    isi.appendChild(
      t4BelumTersedia(
        "Belum tersedia. Pekerja latar ekstensi belum mencatat unduhannya ke penyimpanan; daftar ini terisi sendiri begitu pencatatnya dipasang."
      )
    );
    return kotak;
  }
  const daftar = buatElemen("ul", "aleta-t4-daftar");
  for (const u of daftarSimpan.slice(0, 5)) {
    const li = buatElemen("li");
    const teks = buatElemen("div", "aleta-t4-baris-teks");
    teks.appendChild(buatElemen("span", "aleta-t4-baris-judul", `📄 ${String(u.nama)}`));
    const ukuran = Number(u.ukuran) > 0 ? `${(Number(u.ukuran) / 1024 / 1024).toFixed(1).replace(".", ",")} MB` : "";
    teks.appendChild(buatElemen("span", "aleta-t4-lembut", [ukuran, t4Jam(u.waktu)].filter(Boolean).join(" · ")));
    li.appendChild(teks);
    daftar.appendChild(li);
  }
  isi.appendChild(daftar);
  return kotak;
}

function t4BagianMingguIni(k) {
  const { kotak, isi } = t4Bagian("Minggu ini", "portal-20", "perkara");
  const muat = async () => {
    isi.textContent = "";
    const hasil = await t4Checklist(k);
    isi.textContent = "";
    const r = hasil.ok && hasil.data ? hasil.data.ringkas || {} : null;
    if (r) {
      isi.appendChild(
        t4Ket(`Hari ini: ${Number(r.selesaiHariIni) || 0} dari ${Number(r.totalHariIni) || 0} tugas checklist selesai.`, "aleta-t4-ringkas")
      );
    }
    isi.appendChild(
      t4BelumTersedia(
        "Grafik Senin-Jumat dan pembanding minggu lalu belum tersedia: ALETA belum menyimpan hitungan harian per petugas."
      )
    );
  };
  k.muat.minggu = muat;
  return kotak;
}

function t4BagianCatatan(k) {
  const { kotak, isi } = t4Bagian("Catatan saya", "portal-26", "perkara");
  if (k.publik) {
    isi.appendChild(t4Ket("Catatan pribadi disembunyikan selama layar publik menyala."));
    return kotak;
  }
  const semua = k.catatan && typeof k.catatan === "object" ? k.catatan : {};
  const milik = semua[k.akun] && typeof semua[k.akun] === "object" ? semua[k.akun] : { teks: "" };
  const kotakTeks = document.createElement("textarea");
  kotakTeks.className = "aleta-t4-catatan-teks";
  kotakTeks.rows = 3;
  kotakTeks.maxLength = 2000;
  kotakTeks.placeholder = "Catatan singkat - hanya terlihat oleh Anda, di peramban ini.";
  kotakTeks.value = String(milik.teks || "");
  const kabar = t4Ket(milik.diubah ? `Disimpan ${t4Jam(milik.diubah)}` : "Tersimpan di peramban ini saja.", "aleta-t4-lembut");
  let pewaktu = 0;
  kotakTeks.addEventListener("input", () => {
    clearTimeout(pewaktu);
    pewaktu = setTimeout(async () => {
      const kini = await t4Baca([T4_KUNCI_CATATAN]);
      const peta = kini[T4_KUNCI_CATATAN] && typeof kini[T4_KUNCI_CATATAN] === "object" ? kini[T4_KUNCI_CATATAN] : {};
      const diubah = new Date().toISOString();
      peta[k.akun] = { teks: String(kotakTeks.value || "").slice(0, 2000), diubah };
      t4Tulis({ [T4_KUNCI_CATATAN]: peta });
      kabar.textContent = `Disimpan ${t4Jam(diubah)}`;
    }, 600);
  });
  isi.appendChild(kotakTeks);
  isi.appendChild(kabar);
  return kotak;
}

// ─── Kembali ke SIPP: berisi (portal-2), langsung (3), cari (10), salin (22), D5 ──

function t4NyalaRiwayat(k) {
  return k.modern || t4Nyala("portal-2") || t4Nyala("portal-10") || t4Nyala("portal-22") || t4Nyala("portal-3");
}

function t4UrutRiwayat(k) {
  const sematan = new Set(t4Nyala("portal-2") ? k.sematan : []);
  const daftar = k.riwayat.filter((r) => r && r.nomor && r.url);
  return [...daftar.filter((r) => sematan.has(r.nomor)), ...daftar.filter((r) => !sematan.has(r.nomor))];
}

function t4BarisRiwayat(k, r, tugasPer) {
  const li = buatElemen("li", "aleta-t4-riwayat-baris");
  const sematan = t4Nyala("portal-2");
  if (sematan) {
    const tersemat = k.sematan.includes(r.nomor);
    const pin = t4Tombol(tersemat ? "★" : "☆", tersemat ? "Lepas sematan" : "Sematkan di atas", "aleta-t4-pin");
    pin.setAttribute("aria-pressed", tersemat ? "true" : "false");
    pin.addEventListener("click", () => {
      k.sematan = tersemat ? k.sematan.filter((x) => x !== r.nomor) : [r.nomor, ...k.sematan].slice(0, 20);
      t4Tulis({ [T4_KUNCI_SEMATAN]: k.sematan });
      t4GambarRiwayat(k);
    });
    li.appendChild(pin);
  }
  const teks = buatElemen("div", "aleta-t4-baris-teks");
  const a = tautan(String(r.url), String(r.nomor), "aleta-portal-riwayat-nomor");
  a.target = "_blank";
  teks.appendChild(a);
  const ket = [];
  if (r.jenis) ket.push(String(r.jenis));
  if ((sematan || k.modern) && r.waktu) ket.push(`dibuka ${t4Jam(r.waktu)}`);
  if (ket.length) teks.appendChild(buatElemen("span", "aleta-t4-lembut", ket.join(" · ")));
  const jumlahTugas = tugasPer && tugasPer.get(r.nomor);
  if (sematan && jumlahTugas) teks.appendChild(buatElemen("span", "aleta-t4-chip", `${jumlahTugas} tugas`));
  li.appendChild(teks);
  if (k.modern) {
    const aksi = buatElemen("div", "aleta-t4-aksi-baris");
    aksi.appendChild(t4Tautan(String(r.url), "SIPP ↗", "Membuka perkara ini di SIPP", true));
    aksi.appendChild(t4TautanAbt(r.nomor));
    li.appendChild(aksi);
  }
  if (t4Nyala("portal-22")) {
    const salin = t4Tombol("⧉", `Salin tautan SIPP ${r.nomor}`, "aleta-t4-kecil");
    salin.addEventListener("click", () => t4SalinDanKabarkan(String(r.url), `Tautan SIPP ${t4NomorPendek(r.nomor)}`));
    li.appendChild(salin);
  }
  return li;
}

async function t4GambarRiwayat(k) {
  const wadah = k.riwayatWadah;
  if (!wadah) return;
  const kata = String((k.riwayatCari && k.riwayatCari.value) || "").trim().toLowerCase();
  let tugasPer = null;
  if (t4Nyala("portal-2") && t4Nyala("portal-11")) {
    // Jumlah tugas per perkara hanya dihitung bila checklist memang dibaca
    // untuk Tugas saya - tidak ada permintaan tambahan untuk ini saja.
    const h = await t4Checklist(k);
    tugasPer = new Map();
    for (const b of h.ok && h.data && Array.isArray(h.data.butir) ? h.data.butir : []) {
      const n = b && b.perkara && b.perkara.nomor;
      if (n) tugasPer.set(n, (tugasPer.get(n) || 0) + 1);
    }
  }
  wadah.textContent = "";
  let baris = t4UrutRiwayat(k);
  if (kata) {
    // Riwayat enam-delapan perkara terakhir ditambah tautan yang dipanen
    // widget checklist dari daftar SIPP - sampai tiga ratus nomor.
    const dikenal = new Set(baris.map((r) => r.nomor));
    for (const [nomor, t] of Object.entries(k.tautan || {})) {
      if (!dikenal.has(nomor) && t && t.url) baris.push({ nomor, url: t.url, jenis: "", waktu: t.pada ? new Date(Number(t.pada)).toISOString() : "" });
    }
    baris = baris.filter((r) => String(r.nomor).toLowerCase().includes(kata)).slice(0, 8);
  } else {
    baris = baris.slice(0, 6);
  }
  if (baris.length === 0) {
    wadah.appendChild(
      t4Ket(
        kata
          ? `"${kata}" tidak ada di riwayat peramban ini.${t4Nyala("portal-13") ? " Gunakan Cari perkara untuk mencari di SIPP." : ""}`
          : "Perkara yang Anda buka di SIPP akan tercatat di sini, supaya dapat dibuka kembali dengan satu klik."
      )
    );
    return;
  }
  const daftar = buatElemen("ul", "aleta-portal-riwayat aleta-t4-riwayat");
  for (const r of baris) daftar.appendChild(t4BarisRiwayat(k, r, tugasPer));
  wadah.appendChild(daftar);
}

function t4TataRiwayat(k, kotakSipp) {
  if (!kotakSipp) return;
  if (k.modern) {
    const judul = kotakSipp.querySelector(".aleta-bagian-judul");
    if (judul) judul.textContent = "Terakhir dibuka";
  }
  const isiSipp = kotakSipp.querySelector(".aleta-bagian-isi");
  if (!isiSipp) return;
  const aksiLama = isiSipp.querySelector(".aleta-portal-aksi");

  if (t4NyalaRiwayat(k)) {
    // Daftar lama diganti daftar yang digambar ulang dari riwayat yang sama.
    for (const x of Array.from(isiSipp.children)) if (x !== aksiLama) x.remove();
    if (t4Nyala("portal-10")) {
      const cari = document.createElement("input");
      cari.type = "search";
      cari.className = "aleta-t4-riwayat-cari";
      cari.placeholder = "🔎 Cari nomor perkara…";
      cari.setAttribute("aria-label", "Cari di riwayat perkara");
      cari.addEventListener("input", () => void t4GambarRiwayat(k));
      cari.addEventListener("keydown", (e) => {
        if (e.key !== "Escape") return;
        e.stopPropagation();
        cari.value = "";
        void t4GambarRiwayat(k);
      });
      isiSipp.insertBefore(cari, aksiLama);
      k.riwayatCari = cari;
    }
    const wadah = buatElemen("div", "aleta-t4-riwayat-wadah");
    isiSipp.insertBefore(wadah, aksiLama);
    k.riwayatWadah = wadah;
    void t4GambarRiwayat(k);
  }

  // portal-3: "Buka SIPP" langsung ke perkara terakhir; halaman depan tetap
  // ada di pilihan ▾. Tautan lama tidak dibuang - ia pindah ke pilihan itu.
  if (t4Nyala("portal-3") && aksiLama) {
    const sippLama = Array.from(aksiLama.querySelectorAll("a")).find((a) => /Buka SIPP/.test(a.textContent || ""));
    const abtLama = Array.from(aksiLama.querySelectorAll("a")).find((a) => /Buka ABT/.test(a.textContent || ""));
    const urut = t4UrutRiwayat(k);
    if (sippLama && urut.length > 0) {
      const terakhir = urut[0];
      const langsung = t4Tautan(String(terakhir.url), `Buka SIPP · ${t4NomorPendek(terakhir.nomor)}`, `Membuka ${terakhir.nomor} langsung di SIPP`, true);
      langsung.classList.add("aleta-portal-tautan");
      const pilih = document.createElement("details");
      pilih.className = "aleta-t4-pilih";
      pilih.appendChild(buatElemen("summary", "aleta-t4-pilih-ringkas", "▾"));
      const daftar = buatElemen("div", "aleta-t4-pilih-daftar");
      for (const r of urut.slice(1, 6)) daftar.appendChild(t4Tautan(String(r.url), String(r.nomor), `Membuka ${r.nomor} di SIPP`, true));
      sippLama.textContent = "Halaman depan SIPP saja";
      daftar.appendChild(sippLama);
      pilih.appendChild(daftar);
      aksiLama.insertBefore(langsung, aksiLama.firstChild);
      aksiLama.insertBefore(pilih, langsung.nextSibling);
    }
    if (abtLama && urut.length > 0) {
      abtLama.title = `ABT dibuka di halaman depannya; nomor ${urut[0].nomor} disalin untuk kotak cari ABT.`;
      abtLama.addEventListener("click", () => t4SalinDanKabarkan(String(urut[0].nomor), `Nomor ${t4NomorPendek(urut[0].nomor)} (tempel di kotak cari ABT)`));
    }
  }
}

// ─── Akun: ekstensi (portal-1, 9, 29, D7), peran (16), tampilan (8, 28) ──────

function t4TataEkstensi(k, kotakEkstensi) {
  if (!kotakEkstensi) return;
  const isiEks = kotakEkstensi.querySelector(".aleta-bagian-isi");
  if (!isiEks) return;
  let terpasang = "";
  try {
    terpasang = String(chrome.runtime.getManifest().version || "");
  } catch {
    terpasang = "";
  }
  const tersedia = String((k.siapa && k.siapa.versiEkstensi) || "");
  const tertinggal = Boolean(terpasang && tersedia && terpasang !== tersedia);
  const baris = isiEks.querySelector(".aleta-portal-versi");

  if (t4Nyala("portal-1") || k.modern) {
    // D7: "Terbaru ✓" menggantikan dua angka teknis sebagai kalimat pertama;
    // kedua angkanya tetap ada tepat di bawahnya.
    const ringkas = buatElemen("div", `aleta-t4-terbaru ${tertinggal ? "aleta-t4-tertinggal" : ""}`.trim());
    ringkas.appendChild(
      buatElemen("strong", "", tertinggal ? `Ekstensi tertinggal - tersedia ${tersedia}` : `Ekstensi terbaru ✓ ${terpasang || tersedia || ""}`.trim())
    );
    if (t4Nyala("portal-1") && k.siapa && k.siapa.dirilis) {
      ringkas.appendChild(buatElemen("span", "aleta-t4-lembut", ` · dirilis ${t4Tanggal(k.siapa.dirilis)}`));
    }
    isiEks.insertBefore(ringkas, baris || isiEks.firstChild);
  }

  if (t4Nyala("portal-1")) {
    const baru = t4Ket("", "aleta-t4-yang-baru");
    baru.hidden = true;
    const diperiksa = t4Ket(`Diperiksa sendiri ${t4Jam(new Date().toISOString())} · tiap 30 menit`, "aleta-t4-lembut aleta-t4-diperiksa");
    const sesudahBaris = baris ? baris.nextSibling : null;
    isiEks.insertBefore(baru, sesudahBaris);
    isiEks.insertBefore(diperiksa, baru.nextSibling);
    void t4CatatanPortal(k).then((h) => {
      const c = h.ok && h.data && Array.isArray(h.data.catatan) ? h.data.catatan : [];
      const cocok = c.find((x) => x && x.versi === (tertinggal ? tersedia : terpasang)) || c[0];
      if (!cocok) return;
      baru.textContent = `Yang baru di ${cocok.versi}: ${cocok.judul}`;
      baru.hidden = false;
    });
    t4MulaiPeriksaBerkala(k, terpasang, diperiksa);
  }

  if (t4Nyala("portal-9")) {
    const rinci = document.createElement("details");
    rinci.className = "aleta-t4-catatan-pratinjau";
    rinci.appendChild(buatElemen("summary", "", "Catatan pembaruan terakhir"));
    const daftar = buatElemen("ul", "aleta-t4-daftar");
    daftar.appendChild(buatElemen("li", "aleta-t4-lembut", "Membaca…"));
    rinci.appendChild(daftar);
    rinci.appendChild(t4Tautan(`${dasarPortal()}/patch-notes#ekstensi`, "Semua catatan ↗", "Halaman Catatan pembaruan", false));
    const aksi = isiEks.querySelector(".aleta-portal-aksi");
    isiEks.insertBefore(rinci, aksi ? aksi.nextSibling : null);
    void t4CatatanPortal(k).then((h) => {
      daftar.textContent = "";
      const c = h.ok && h.data && Array.isArray(h.data.catatan) ? h.data.catatan : [];
      if (c.length === 0) {
        daftar.appendChild(buatElemen("li", "aleta-t4-lembut", h.pesan || "Catatan pembaruan tidak terbaca."));
        return;
      }
      for (const x of c) {
        const li = buatElemen("li");
        li.appendChild(buatElemen("span", "aleta-t4-nomor", String(x.versi || "")));
        li.appendChild(buatElemen("span", "", ` · ${String(x.judul || "")}`));
        if (x.dirilis) li.title = `Dirilis ${t4Tanggal(x.dirilis)}`;
        daftar.appendChild(li);
      }
    });
  }

  if (t4Nyala("portal-29")) isiEks.appendChild(t4Diagnosa(k, kotakEkstensi));
}

/**
 * portal-1: pembaruan diperiksa sendiri tiap 30 menit.
 *
 * Yang diperiksa versi yang DISAJIKAN portal (GET "siapa saya", tanpa
 * singgahan). Memasangnya tetap lewat tombol Perbarui yang sudah ada - Chrome
 * tidak boleh memuat ulang ekstensi di bawah tangan orang yang sedang bekerja.
 */
function t4MulaiPeriksaBerkala(k, terpasang, tandaDiperiksa) {
  if (t4PeriksaPewaktu) clearInterval(t4PeriksaPewaktu);
  t4PeriksaPewaktu = setInterval(async () => {
    if (!k.panel.isConnected) {
      clearInterval(t4PeriksaPewaktu);
      t4PeriksaPewaktu = 0;
      return;
    }
    const h = await t4AmbilJson("/api/aleta-ecourt/ekstensi/siapa", "Memeriksa pembaruan ekstensi");
    tandaDiperiksa.textContent = h.ok
      ? `Diperiksa sendiri ${t4Jam(new Date().toISOString())} · tiap 30 menit`
      : `Pemeriksaan ${t4Jam(new Date().toISOString())} gagal: ${h.pesan}`;
    const tersedia = h.ok && h.data ? String(h.data.versiEkstensi || "") : "";
    if (tersedia && terpasang && tersedia !== terpasang) {
      t4Kabar(`Ekstensi ${tersedia} tersedia (terpasang ${terpasang}). Tekan "Periksa pembaruan" di bagian Ekstensi.`);
    }
  }, T4_PERIKSA_MS);
}

/** portal-29: satu tombol memeriksa izin, versi, dan catatan kegagalan; yang dapat diperbaiki diberi tombol. */
function t4Diagnosa(k, kotakEkstensi) {
  const wadah = buatElemen("div", "aleta-t4-diagnosa");
  const tombol = t4Tombol("🩺 Diagnosa ekstensi", "Memeriksa lingkungan, versi, portal, mode kering, dan catatan kegagalan", "");
  const hasilWadah = buatElemen("ul", "aleta-t4-lampu");
  wadah.appendChild(tombol);
  wadah.appendChild(hasilWadah);
  tombol.addEventListener("click", async () => {
    tombol.disabled = true;
    hasilWadah.textContent = "";
    hasilWadah.appendChild(buatElemen("li", "aleta-t4-lembut", "Memeriksa…"));
    let baris = [];
    try {
      baris = typeof alatPapanKesehatan === "function" ? await alatPapanKesehatan({ akun: { aleta: k.siapa && k.siapa.nama } }) : [];
    } catch (galat) {
      baris = [{ nama: "Diagnosa", keadaan: "buruk", ket: String((galat && galat.message) || galat) }];
    }
    tombol.disabled = false;
    hasilWadah.textContent = "";
    for (const b of baris) {
      const li = buatElemen("li", `aleta-t4-lampu-${b.keadaan === "baik" ? "baik" : b.keadaan === "awas" ? "awas" : "buruk"}`);
      li.appendChild(buatElemen("span", "aleta-t4-titik", b.keadaan === "baik" ? "✓" : "!"));
      li.appendChild(buatElemen("span", "aleta-t4-lampu-nama", String(b.nama)));
      li.appendChild(buatElemen("span", "aleta-t4-lampu-ket", String(b.ket || "")));
      if (b.nama === "Ekstensi mutakhir" && b.keadaan !== "baik") {
        const perbaiki = t4Tombol("Perbaiki", "Menjalankan Periksa pembaruan di bagian Ekstensi", "aleta-t4-kecil");
        perbaiki.addEventListener("click", () => {
          const asli = kotakEkstensi.querySelector("button.aleta-tombol");
          if (asli) asli.click();
        });
        li.appendChild(perbaiki);
      }
      hasilWadah.appendChild(li);
    }
    if (baris.length === 0) hasilWadah.appendChild(buatElemen("li", "aleta-t4-lembut", "Perkakas diagnosa tidak tersedia di halaman ini."));
  });
  return wadah;
}

function t4BagianPeran(k) {
  const { kotak, isi } = t4Bagian("Peran", "portal-16", "akun");
  const siapa = k.siapa || {};
  const tambahan = Array.isArray(siapa.peranTambahan) ? siapa.peranTambahan.filter(Boolean) : [];
  isi.appendChild(t4Ket(`Peran akun: ${siapa.peran || "-"}${tambahan.length ? ` · tambahan: ${tambahan.map(t4LabelPeran).join(", ")}` : ""}`));
  const wadah = buatElemen("div", "aleta-t4-peran");
  isi.appendChild(wadah);
  isi.appendChild(
    t4Ket(
      "Berganti peran di sini mengganti daftar Tugas saya dan widget checklist. Menu dan kewenangan portal tetap gabungan semua peran akun Anda: portal belum menyimpan peran aktif, jadi berganti peran portal belum tersedia.",
      "aleta-t4-lembut"
    )
  );
  const muat = async () => {
    wadah.textContent = "";
    const h = await t4Checklist(k);
    wadah.textContent = "";
    const tersedia = h.ok && h.data && Array.isArray(h.data.peranTersedia) ? h.data.peranTersedia : [];
    const aktif = h.ok && h.data ? String(h.data.peranAktif || "") : "";
    if (tersedia.length <= 1) {
      wadah.appendChild(
        t4Ket(
          tersedia.length === 1
            ? `Peran checklist: ${tersedia[0].label} - akun ini hanya punya satu, tidak ada yang perlu diganti.`
            : h.ok
              ? "Akun ini belum punya peran yang memiliki checklist."
              : h.pesan
        )
      );
      return;
    }
    wadah.appendChild(buatElemen("span", "aleta-t4-label", "Peran untuk tugas"));
    // Hanya peran yang MEMANG dimiliki akun - daftarnya dari portal, bukan
    // disusun di sini; ekstensi tidak dapat menambah hak siapa pun.
    for (const p of tersedia) {
      const t = t4Tombol(String(p.label || p.kunci), `Tampilkan tugas sebagai ${p.label || p.kunci}`, "aleta-t4-peran-pilih");
      t.setAttribute("aria-pressed", p.kunci === aktif ? "true" : "false");
      t.addEventListener("click", () => {
        if (p.kunci === aktif) return;
        k.peranChecklist = p.kunci;
        k.janjiChecklist = null;
        t4Tulis({ [T4_KUNCI_PERAN_CHECKLIST]: p.kunci });
        t4Kabar(`Tugas saya kini sebagai ${p.label || p.kunci}.`);
        for (const nama of ["tugas", "peran", "minggu"]) if (k.muat[nama]) void k.muat[nama]();
      });
      wadah.appendChild(t);
    }
  };
  k.muat.peran = muat;
  return kotak;
}

function t4BagianTampilan(k) {
  const letak = t4Nyala("portal-8") || k.modern;
  const publik = t4LayarPublikBoleh();
  if (!letak && !publik) return null;
  const { kotak, isi } = t4Bagian("Tampilan panel", "", "akun");
  if (publik) isi.appendChild(t4TombolPublik(k));
  if (letak) isi.appendChild(t4PemilihLetak());
  return kotak;
}

// ─── Pintasan (portal-4, D9) dan kewenangan (portal-5, D10) ──────────────────

const T4_IKON_PINTASAN = [
  [/aleta-ecourt/, "⤓"],
  [/aleta-sipp/, "⇄"],
  [/pembaruan/, "⟳"],
  [/e-audit/, "◎"],
  [/perkara/, "⚖"],
  [/surat/, "✉"],
  [/admin/, "⚙"],
];

function t4TataPintasan(k, kotakPintasan) {
  if (!kotakPintasan) return;
  const daftar = kotakPintasan.querySelector(".aleta-portal-pintasan");
  if (!daftar) return;
  const barisAsli = Array.from(daftar.children);
  const hrefDari = (li) => {
    const a = li.querySelector("a");
    return a ? a.getAttribute("href") || "" : "";
  };

  if (k.modern) {
    // D9: ubin berikon dengan label singkat; keterangannya pindah ke title.
    for (const li of barisAsli) {
      const a = li.querySelector("a");
      const ket = li.querySelector(".aleta-portal-pintasan-ket");
      if (a && ket) a.title = ket.textContent || "";
      const href = hrefDari(li);
      const ikon = (T4_IKON_PINTASAN.find(([pola]) => pola.test(href)) || [null, "▣"])[1];
      if (a && !a.querySelector(".aleta-t4-ubin-ikon")) a.insertBefore(buatElemen("span", "aleta-t4-ubin-ikon", ikon), a.firstChild);
    }
    daftar.classList.add("aleta-t4-ubin");
  }

  if (!t4Nyala("portal-4")) return;
  // portal-4: urutan dan yang disembunyikan PER ORANG (kunci akun), di
  // peramban ini. Ikut akun menyusul di Tahap 5.
  const semua = k.urutan && typeof k.urutan === "object" ? k.urutan : {};
  const milik = semua[k.akun] && typeof semua[k.akun] === "object" ? semua[k.akun] : {};
  let urutan = Array.isArray(milik.urutan) ? milik.urutan.slice() : [];
  let sembunyi = new Set(Array.isArray(milik.sembunyi) ? milik.sembunyi : []);
  const simpan = () => {
    semua[k.akun] = { urutan, sembunyi: [...sembunyi] };
    k.urutan = semua;
    t4Tulis({ [T4_KUNCI_URUTAN]: semua });
  };
  const wadahSembunyi = buatElemen("div", "aleta-t4-sembunyi");
  let mengatur = false;
  const gambar = () => {
    const posisi = (href) => {
      const i = urutan.indexOf(href);
      return i < 0 ? 1000 + barisAsli.findIndex((li) => hrefDari(li) === href) : i;
    };
    const urut = barisAsli.slice().sort((a, b) => posisi(hrefDari(a)) - posisi(hrefDari(b)));
    daftar.textContent = "";
    for (const li of urut) {
      const href = hrefDari(li);
      for (const x of Array.from(li.querySelectorAll(".aleta-t4-atur"))) x.remove();
      li.hidden = sembunyi.has(href);
      if (mengatur) {
        const alat = buatElemen("span", "aleta-t4-atur");
        const naik = t4Tombol("↑", "Naikkan", "aleta-t4-kecil");
        const turun = t4Tombol("↓", "Turunkan", "aleta-t4-kecil");
        const tutup = t4Tombol("Sembunyikan", "Sembunyikan pintasan ini", "aleta-t4-kecil");
        const geser = (arah) => {
          urutan = urut.map(hrefDari);
          const i = urutan.indexOf(href);
          const j = i + arah;
          if (j < 0 || j >= urutan.length) return;
          [urutan[i], urutan[j]] = [urutan[j], urutan[i]];
          simpan();
          gambar();
        };
        naik.addEventListener("click", () => geser(-1));
        turun.addEventListener("click", () => geser(1));
        tutup.addEventListener("click", () => {
          sembunyi.add(href);
          simpan();
          gambar();
        });
        alat.appendChild(naik);
        alat.appendChild(turun);
        alat.appendChild(tutup);
        li.appendChild(alat);
      }
      daftar.appendChild(li);
    }
    wadahSembunyi.textContent = "";
    const tersembunyi = barisAsli.filter((li) => sembunyi.has(hrefDari(li)));
    for (const li of tersembunyi) {
      const a = li.querySelector("a");
      // Nama tanpa ikon ubin (D9) - hanya tulisan tautannya.
      const nama = a
        ? Array.from(a.childNodes)
            .filter((n) => !(n.classList && n.classList.contains("aleta-t4-ubin-ikon")))
            .map((n) => n.textContent || "")
            .join("")
        : hrefDari(li);
      const t = t4Tombol(`👁 ${nama.trim()} · tampilkan`, "Tampilkan lagi pintasan ini", "aleta-t4-kecil");
      t.addEventListener("click", () => {
        sembunyi.delete(hrefDari(li));
        simpan();
        gambar();
      });
      wadahSembunyi.appendChild(t);
    }
  };
  const atur = t4Tombol("⋮⋮ Atur urutan", "Geser atau sembunyikan pintasan - berlaku untuk Anda saja di peramban ini", "aleta-t4-kecil");
  atur.addEventListener("click", () => {
    mengatur = !mengatur;
    atur.textContent = mengatur ? "Selesai" : "⋮⋮ Atur urutan";
    gambar();
  });
  const isiP = kotakPintasan.querySelector(".aleta-bagian-isi");
  if (isiP) {
    isiP.insertBefore(atur, daftar);
    isiP.appendChild(wadahSembunyi);
  }
  gambar();
}

const T4_KELOMPOK_KEWENANGAN = [
  ["Melihat", ["panel", "penunjukan", "blangko-abt"]],
  ["Mengunduh", ["berkas", "permintaan"]],
  ["Menulis ke SIPP", ["penunjukan-otomatis", "data-umum", "kerjakan"]],
];

function t4TataKewenangan(k, kotakKewenangan) {
  if (!kotakKewenangan) return;
  const isiK = kotakKewenangan.querySelector(".aleta-bagian-isi");
  const daftar = kotakKewenangan.querySelector(".aleta-portal-kewenangan");
  if (!isiK || !daftar) return;
  const kapabilitas = (k.siapa && k.siapa.kapabilitas) || {};
  const keterangan = (k.siapa && k.siapa.keterangan) || {};
  const kunciSemua = Object.keys(keterangan);
  const dimiliki = kunciSemua.filter((x) => kapabilitas[x] === true).length;
  let rincian = daftar;

  if (t4Nyala("portal-5")) {
    // portal-5: dikelompokkan menurut dampaknya. Yang tidak dimiliki tampil
    // redup, dengan cara memintanya - cukup teks (keputusan pengguna): tidak
    // ada yang dikirim dari sini.
    const kelompok = buatElemen("div", "aleta-t4-kewenangan");
    const terpakai = new Set();
    const tambahKelompok = (judul, kunci) => {
      const ada = kunci.filter((x) => kunciSemua.includes(x));
      if (ada.length === 0) return;
      kelompok.appendChild(buatElemen("div", "aleta-t4-kelompok-judul", judul));
      const ul = buatElemen("ul", "aleta-portal-kewenangan");
      for (const x of ada) {
        terpakai.add(x);
        const boleh = kapabilitas[x] === true;
        const li = buatElemen("li", boleh ? "aleta-portal-boleh" : "aleta-portal-tidak");
        li.appendChild(buatElemen("span", "aleta-portal-tanda", boleh ? "✓" : "○"));
        li.appendChild(buatElemen("span", "", (keterangan[x] && keterangan[x].label) || x));
        li.title = (keterangan[x] && keterangan[x].penjelasan) || "";
        if (!boleh) {
          const minta = document.createElement("details");
          minta.className = "aleta-t4-minta";
          minta.appendChild(buatElemen("summary", "", "cara meminta akses"));
          minta.appendChild(
            t4Ket(
              `Hubungi Super Admin ALETA dan sebutkan kewenangan "${(keterangan[x] && keterangan[x].label) || x}". Super Admin mengaturnya di Integrasi e-Court › Pengaturan ekstensi.`,
              "aleta-t4-lembut"
            )
          );
          li.appendChild(minta);
        }
        ul.appendChild(li);
      }
      kelompok.appendChild(ul);
    };
    for (const [judul, kunci] of T4_KELOMPOK_KEWENANGAN) tambahKelompok(judul, kunci);
    tambahKelompok(
      "Lainnya",
      kunciSemua.filter((x) => !T4_KELOMPOK_KEWENANGAN.some(([, kunci]) => kunci.includes(x)))
    );
    daftar.replaceWith(kelompok);
    rincian = kelompok;
  }

  if (k.modern) {
    // D10: ringkasan "7 dari 8"; rinciannya dilipat, tidak dibuang.
    const lipat = document.createElement("details");
    lipat.className = "aleta-t4-lipat-kewenangan";
    lipat.appendChild(buatElemen("summary", "", `${dimiliki} dari ${kunciSemua.length} kewenangan dimiliki · rincian`));
    rincian.replaceWith(lipat);
    lipat.appendChild(rincian);
  }
}

// ─── Bantuan "?" (portal-27, D11) dan tur singkat (portal-18) ────────────────

function t4KartuBantuan(k, pintasan) {
  const kartu = buatElemen("div", "aleta-t4-bantuan");
  kartu.setAttribute("data-t4-tab", "semua");
  kartu.hidden = true;
  kartu.appendChild(buatElemen("div", "aleta-t4-bantuan-judul", "Pintasan keyboard"));
  const daftar = buatElemen("ul", "aleta-t4-pintasan-daftar");
  for (const p of pintasan) {
    const li = buatElemen("li");
    li.appendChild(buatElemen("kbd", "", p.tombol));
    li.appendChild(buatElemen("span", "", p.nama));
    daftar.appendChild(li);
  }
  if (t4Nyala("portal-27")) {
    const li = buatElemen("li");
    li.appendChild(buatElemen("kbd", "", "?"));
    li.appendChild(buatElemen("span", "", "buka / tutup daftar ini"));
    daftar.appendChild(li);
  }
  kartu.appendChild(daftar);
  kartu.appendChild(t4Ket("Tidak berlaku selagi mengetik di kolom isian.", "aleta-t4-lembut"));
  if (t4Nyala("portal-18")) {
    const tur = t4Tombol("🧭 Tur singkat", "Lima langkah mengenal panel ini", "aleta-t4-kecil");
    tur.addEventListener("click", () => {
      kartu.hidden = true;
      t4MulaiTur(k);
    });
    kartu.appendChild(tur);
  }
  return kartu;
}

function t4AlihBantuan(panel) {
  const kartu = panel && panel.querySelector(".aleta-t4-bantuan");
  if (!kartu) return;
  kartu.hidden = !kartu.hidden;
  if (!kartu.hidden) kartu.scrollIntoView({ block: "nearest" });
}

const T4_LANGKAH_TUR = [
  [".aleta-identitas-panel", "", "Kepala panel: akun ALETA Anda dan perannya. Tombol di kanan mengatur panel."],
  [".aleta-t4-riwayat-wadah, .aleta-portal-riwayat, .aleta-kosong-lembut", "beranda", "Kembali ke SIPP: perkara yang terakhir Anda buka di SIPP, satu klik untuk membukanya lagi."],
  [".aleta-t4-cari, .aleta-portal-pintasan", "perkara", "Cari perkara dan pintasan: lompat ke perkara atau ke halaman portal yang sering dipakai."],
  [".aleta-portal-versi", "akun", "Ekstensi: versi yang terpasang, dan tombol pembaruannya."],
  [".aleta-portal-kewenangan, .aleta-t4-kewenangan, .aleta-t4-lipat-kewenangan", "akun", "Kewenangan: apa yang boleh Anda kerjakan lewat ekstensi di SIPP."],
];

function t4MulaiTur(k) {
  const panel = k.panel;
  const langkah = T4_LANGKAH_TUR.filter(([pemilih]) => panel.querySelector(pemilih));
  if (langkah.length === 0) return;
  let i = 0;
  const kartu = buatElemen("div", "aleta-t4-tur");
  kartu.setAttribute("data-t4-tab", "semua");
  kartu.setAttribute("role", "dialog");
  const teks = buatElemen("div", "aleta-t4-tur-teks");
  const lewati = t4Tombol("Lewati", "Menutup tur", "aleta-t4-kecil");
  const lanjut = t4Tombol("Lanjut ›", "Langkah berikutnya", "aleta-t4-kecil");
  kartu.appendChild(teks);
  kartu.appendChild(lewati);
  kartu.appendChild(lanjut);
  const isi = panel.querySelector(".aleta-isi");
  if (isi) isi.insertBefore(kartu, isi.firstChild);
  const lepasSorot = () => {
    for (const x of Array.from(panel.querySelectorAll(".aleta-t4-sorot"))) x.classList.remove("aleta-t4-sorot");
  };
  const selesai = () => {
    lepasSorot();
    kartu.remove();
    t4Tulis({ [T4_KUNCI_TUR]: true });
  };
  const tampil = () => {
    lepasSorot();
    const [pemilih, tab, kalimat] = langkah[i];
    if (tab) t4PilihTab(panel, tab);
    const sasaran = panel.querySelector(pemilih);
    if (sasaran) {
      sasaran.classList.add("aleta-t4-sorot");
      sasaran.scrollIntoView({ block: "nearest" });
    }
    teks.textContent = `Langkah ${i + 1} dari ${langkah.length} · ${kalimat}`;
    lanjut.textContent = i === langkah.length - 1 ? "Selesai" : "Lanjut ›";
  };
  lewati.addEventListener("click", selesai);
  lanjut.addEventListener("click", () => {
    if (i >= langkah.length - 1) {
      selesai();
      return;
    }
    i += 1;
    tampil();
  });
  tampil();
}

// ─── Tab (D3) ────────────────────────────────────────────────────────────────

function t4PasangTab(k, tabTersimpan) {
  const ada = new Set(Array.from(k.isi.children).map((x) => x.getAttribute("data-t4-tab")).filter(Boolean));
  const bar = buatElemen("div", "aleta-t4-tabbar");
  bar.setAttribute("role", "tablist");
  const tampil = T4_TAB.filter(([kunci]) => ada.has(kunci));
  for (const [kunci, label] of tampil) {
    const t = t4Tombol(label, "", "aleta-t4-tab");
    t.setAttribute("role", "tab");
    t.setAttribute("data-t4-ke", kunci);
    t.addEventListener("click", () => t4PilihTab(k.panel, kunci));
    bar.appendChild(t);
  }
  k.panel.insertBefore(bar, k.isi);
  const awal = tampil.some(([kunci]) => kunci === tabTersimpan) ? tabTersimpan : (tampil[0] || ["beranda"])[0];
  t4PilihTab(k.panel, awal, true);
}

// ─── Pintasan tambahan untuk kaki (Alt+K, Alt+L) ─────────────────────────────

/** Ditambahkan ke PINTASAN_PORTAL hanya bila fiturnya menyala - Lama tidak berubah. */
function t4TambahPintasan(daftar) {
  if (!t4Aktif()) return;
  if (t4Nyala("portal-13")) {
    daftar.push({ tombol: "Alt+K", kunci: "k", nama: "cari perkara", jalankan: (p) => t4FokusCari(p) });
  }
  if (t4LayarPublikBoleh()) {
    daftar.push({
      tombol: "Alt+L",
      kunci: "l",
      nama: "mode layar publik (nama pihak disamarkan)",
      jalankan: () => t4SetelPublik(!(t4Keadaan && t4Keadaan.publik)),
    });
  }
}

// ─── Penata utama ────────────────────────────────────────────────────────────

/**
 * Menata panel yang SUDAH disusun jalur lama. Dalam tampilan Lama hanya
 * mencatat tanda tampilannya (di luar DOM) lalu pulang.
 */
async function t4Tata(panel, kepala, isi, kaki, siapa, pintasan) {
  t4TandaPanel.set(panel, t4TandaTampilan());
  if (!t4Aktif()) {
    t4Keadaan = null;
    if (t4PeriksaPewaktu) clearInterval(t4PeriksaPewaktu);
    t4PeriksaPewaktu = 0;
    return;
  }
  const modern = t4Modern();
  const simpan = await t4Baca([
    T4_KUNCI_LETAK,
    T4_KUNCI_PUBLIK,
    T4_KUNCI_SEMATAN,
    T4_KUNCI_URUTAN,
    T4_KUNCI_CATATAN,
    T4_KUNCI_TAB,
    T4_KUNCI_TAUTAN_SIPP,
    T4_KUNCI_PERAN_CHECKLIST,
    T4_KUNCI_UNDUHAN,
    KUNCI_RIWAYAT_SIPP,
  ]);
  t4LetakPilihan = T4_LETAK.includes(simpan[T4_KUNCI_LETAK]) ? simpan[T4_KUNCI_LETAK] : "";
  const k = {
    panel,
    kepala,
    isi,
    kaki,
    siapa,
    modern,
    akun: t4KunciAkun(siapa),
    publik: t4LayarPublikBoleh() && simpan[T4_KUNCI_PUBLIK] === true,
    riwayat: Array.isArray(simpan[KUNCI_RIWAYAT_SIPP]) ? simpan[KUNCI_RIWAYAT_SIPP] : [],
    tautan: simpan[T4_KUNCI_TAUTAN_SIPP] && typeof simpan[T4_KUNCI_TAUTAN_SIPP] === "object" ? simpan[T4_KUNCI_TAUTAN_SIPP] : {},
    sematan: Array.isArray(simpan[T4_KUNCI_SEMATAN]) ? simpan[T4_KUNCI_SEMATAN].map(String) : [],
    urutan: simpan[T4_KUNCI_URUTAN],
    catatan: simpan[T4_KUNCI_CATATAN],
    unduhan: simpan[T4_KUNCI_UNDUHAN],
    peranChecklist: typeof simpan[T4_KUNCI_PERAN_CHECKLIST] === "string" ? simpan[T4_KUNCI_PERAN_CHECKLIST] : "",
    janjiChecklist: null,
    janjiCatatan: null,
    muat: {},
  };
  t4Keadaan = k;
  panel.setAttribute("data-t4", modern ? "ui" : "baru");
  if (k.publik) panel.setAttribute("data-t4-publik", "ya");

  // Bagian lama, menurut urutan penyusunannya di susunPanelPortal.
  const lama = Array.from(isi.children);
  const kotakEkstensi = lama[0] || null;
  const kotakSipp = lama[1] || null;
  const kotakKewenangan = lama.length >= 3 ? lama[lama.length - 1] : null;
  const kotakPintasan = lama.length >= 4 ? lama[2] : null;
  if (kotakEkstensi) kotakEkstensi.setAttribute("data-t4-tab", "akun");
  if (kotakSipp) kotakSipp.setAttribute("data-t4-tab", "beranda");
  if (kotakPintasan) kotakPintasan.setAttribute("data-t4-tab", "pintasan");
  if (kotakKewenangan) kotakKewenangan.setAttribute("data-t4-tab", "akun");

  const urutan = [];
  const tambah = (x) => {
    if (x) urutan.push(x);
  };
  if (k.publik) tambah(t4PitaPublik());
  if (t4Nyala("portal-14")) tambah(t4BagianSambungan(k));
  if (t4Nyala("portal-13")) tambah(t4BagianCari(k));
  if (t4Nyala("portal-11")) tambah(t4BagianTugas(k));
  if (t4Nyala("portal-23")) tambah(t4BagianSidang(k));
  if (t4Nyala("portal-12")) tambah(t4BagianLonceng(k));
  tambah(kotakSipp);
  if (t4Nyala("portal-19")) tambah(t4BagianTulisan(k));
  if (t4Nyala("portal-25")) tambah(t4BagianUnduhan(k));
  if (t4Nyala("portal-20")) tambah(t4BagianMingguIni(k));
  if (t4Nyala("portal-26")) tambah(t4BagianCatatan(k));
  tambah(kotakEkstensi);
  tambah(kotakPintasan);
  if (t4Nyala("portal-16")) tambah(t4BagianPeran(k));
  tambah(t4BagianTampilan(k));
  tambah(kotakKewenangan);
  for (const x of urutan) isi.appendChild(x);

  t4TataRiwayat(k, kotakSipp);
  t4TataEkstensi(k, kotakEkstensi);
  t4TataPintasan(k, kotakPintasan);
  t4TataKewenangan(k, kotakKewenangan);

  // Kepala.
  if (k.publik) {
    const chip = buatElemen("span", "aleta-t4-chip-publik", "◐ PUBLIK");
    chip.title = "Mode layar publik menyala - nama pihak disamarkan";
    const pita = kepala.querySelector(".aleta-identitas-panel");
    if (pita) pita.appendChild(chip);
  }
  if (t4Nyala("portal-6") && !modern) t4IkonBerlabel(k);
  if (t4Nyala("portal-7")) void t4LencanaServer(k);
  if (modern) t4MenuKepala(k);

  // Kaki: bantuan "?" (portal-27 di Baru, D11 di UI Baru) dan tur.
  const barisKaki = kaki && kaki.querySelector(".aleta-kaki-baris");
  if (modern || t4Nyala("portal-27")) {
    isi.insertBefore(t4KartuBantuan(k, pintasan), isi.firstChild);
    const tanya = t4Tombol("?", "Bantuan: pintasan keyboard" + (t4Nyala("portal-18") ? " dan tur singkat" : ""), "aleta-t4-tanya");
    tanya.addEventListener("click", () => t4AlihBantuan(panel));
    if (barisKaki) barisKaki.insertBefore(tanya, barisKaki.querySelector(".aleta-kaki-segar"));
  } else if (t4Nyala("portal-18") && barisKaki) {
    const tur = t4Tombol("🧭 Tur", "Tur singkat mengenal panel ini", "aleta-t4-tanya");
    tur.addEventListener("click", () => t4MulaiTur(k));
    barisKaki.insertBefore(tur, barisKaki.querySelector(".aleta-kaki-segar"));
  }
  // Baru: saklar layar publik juga di kaki, sekali tekan dari mana pun panel
  // sedang digulir. UI Baru menaruhnya di menu ⋯ dan tab Akun.
  if (!modern && t4LayarPublikBoleh() && barisKaki) {
    const cepat = t4Tombol("◐", k.publik ? "Matikan mode layar publik (Alt+L)" : "Mode layar publik - nama pihak disamarkan (Alt+L)", "aleta-t4-tanya");
    cepat.setAttribute("aria-pressed", k.publik ? "true" : "false");
    cepat.addEventListener("click", () => t4SetelPublik(!k.publik));
    barisKaki.insertBefore(cepat, barisKaki.querySelector(".aleta-kaki-segar"));
  }

  if (modern) t4PasangTab(k, String(simpan[T4_KUNCI_TAB] || ""));

  // Data yang dibaca dari portal - tidak ditunggu, supaya panel tidak
  // tertahan oleh bagian yang lambat.
  //
  // Perbaikan 30 Sep butir 6/26: penjelasan panjang dilipat di balik ⓘ -
  // sekarang, dan lagi sesudah tiap bagian yang dimuat dari portal selesai
  // (keterangannya baru lahir sesudah jawabannya tiba).
  const lipat = () => t4LipatPenjelasan(isi);
  lipat();
  for (const muat of Object.values(k.muat)) void Promise.resolve(muat()).then(lipat, lipat);
  t4PasangPendengarPanel();
}

/**
 * Keterangan panjang panel portal di balik ⓘ (alatLipatPenjelasan di
 * panel-alat.js). Yang dilipat hanya keterangan murni - .aleta-t4-ket, kotak
 * kosong, dan kabar "belum tersedia"; peringatan (.aleta-portal-awas) dan
 * kabar hasil tombol tetap terbuka. Tanpa panel-alat.js: tidak berbuat apa pun.
 */
function t4LipatPenjelasan(akar) {
  try {
    if (typeof alatLipatPenjelasan === "function") {
      alatLipatPenjelasan(akar, ".aleta-t4-ket, .aleta-kosong-lembut, .aleta-t4-belum");
    }
  } catch {
    /* keterangan tetap terbuka - tidak ada yang hilang */
  }
}

/** Sesudah panel masuk ke halaman: letak, pengamat, dan kabar yang tertunda. */
function t4SesudahTerpasang(panel) {
  t4TerapkanLetak();
  if (!t4Aktif() || !t4Keadaan || t4Keadaan.panel !== panel) return;
  // Penangan pengamat dibungkus: halaman yang sedang ditutup masih sempat
  // memanggilnya tanpa dokumen, dan galat di sana hanya mengotori konsol.
  const aman = (kerja) => () => {
    try {
      kerja();
    } catch {
      /* halaman sedang ditutup */
    }
  };
  try {
    new MutationObserver(aman(() => t4TerapkanLetak())).observe(panel, { attributes: true, attributeFilter: ["class"] });
    if (!t4PengamatBody && document.body) {
      t4PengamatBody = new MutationObserver(
        aman(() => {
          if (!document.getElementById(PENANDA_ALETA)) t4TerapkanLetak();
        })
      );
      t4PengamatBody.observe(document.body, { childList: true });
    }
  } catch {
    /* tanpa pengamat, letaknya dipasang ulang saat panel disusun lagi */
  }
  if (t4KabarTertunda) {
    const teks = t4KabarTertunda;
    t4KabarTertunda = "";
    t4Kabar(teks);
  }
  // Tampilan yang berganti SELAGI panel ini disusun: susun sekali lagi.
  if (t4TandaPanel.get(panel) !== t4TandaTampilan()) setTimeout(t4BangunUlang, 0);
}

function t4BangunUlang() {
  const lama = document.getElementById(PENANDA_ALETA);
  if (!lama) return;
  lama.remove();
  t4TerapkanLetak();
  void pasangPortal();
}

/** "?" membuka daftar pintasan (portal-27) - selagi tidak mengetik. */
let t4TanyaTerpasang = false;
function t4PasangPendengarPanel() {
  if (t4TanyaTerpasang) return;
  t4TanyaTerpasang = true;
  document.addEventListener(
    "keydown",
    (e) => {
      if (e.key !== "?" || e.ctrlKey || e.metaKey || e.altKey) return;
      if (!t4Aktif() || !(t4Nyala("portal-27") || t4Modern())) return;
      const sasaran = e.target instanceof Element ? e.target : null;
      if (sasaran && (sasaran.isContentEditable || sasaran.closest('input, textarea, select, [contenteditable="true"]'))) return;
      const panel = document.getElementById(PENANDA_ALETA);
      if (!panel || !panel.querySelector(".aleta-t4-bantuan")) return;
      e.preventDefault();
      t4AlihBantuan(panel);
    },
    true
  );
}

/**
 * Pengalih tampilan (Tahap 1) dan kunci milik blok ini didengar di sini.
 * Tampilan yang berganti menyusun ulang panel - dan kembali ke Lama berarti
 * panel lama yang disusun jalur lama, persis, beserta halaman yang selebar
 * semula.
 */
function t4DengarkanPerubahan() {
  if (t4PendengarKunciTerpasang) return;
  t4PendengarKunciTerpasang = true;
  try {
    document.addEventListener("aleta-uji-berubah", () => {
      t4TerapkanLetak();
      const panel = document.getElementById(PENANDA_ALETA);
      if (!panel) return;
      if (t4TandaPanel.get(panel) === t4TandaTampilan()) return;
      t4BangunUlang();
    });
  } catch {
    /* tampilannya berganti saat halaman dimuat ulang */
  }
  try {
    chrome.storage.onChanged.addListener((ubah, tempat) => {
      if (tempat !== "local" || !t4Aktif()) return;
      if (ubah[T4_KUNCI_LETAK]) {
        const baru = ubah[T4_KUNCI_LETAK].newValue;
        t4LetakPilihan = T4_LETAK.includes(baru) ? baru : "";
        t4TerapkanLetak();
      }
      if (ubah[T4_KUNCI_PUBLIK] && t4Keadaan) {
        const baru = t4LayarPublikBoleh() && ubah[T4_KUNCI_PUBLIK].newValue === true;
        if (baru !== t4Keadaan.publik) t4BangunUlang();
      }
    });
  } catch {
    /* di luar konteks ekstensi */
  }
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
        // UI Baru: daftarnya di tab Beranda. Tanpa bilah tab, tidak berbuat apa-apa.
        t4PilihTab(p, "beranda");
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
      // alatTekanPertama hanya menekan tombol yang TAMPAK - di UI Baru
      // tombolnya di tab Akun, jadi tab itu dibuka lebih dahulu.
      jalankan: (p) => {
        t4PilihTab(p, "akun");
        return alatTekanPertama(p, "button.aleta-tombol");
      },
    },
  ];
  // Alt+K dan Alt+L (Tahap 4) - hanya bila fiturnya menyala.
  t4TambahPintasan(PINTASAN_PORTAL);
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

  // Tahap 4: menata panel yang sudah jadi. Dalam tampilan Lama langsung
  // pulang tanpa menyentuh apa pun. Kegagalannya tidak boleh menggagalkan
  // panel lama yang sudah tersusun utuh.
  try {
    await t4Tata(panel, kepala, isi, kaki, siapa, PINTASAN_PORTAL);
  } catch (galat) {
    try {
      if (typeof alatCatat === "function") alatCatat("galat", "Penataan panel portal Tahap 4 gagal", String((galat && galat.message) || galat));
    } catch {
      /* panel lama tetap utuh */
    }
  }

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
  if (JALUR_TANPA_PANEL.some((j) => jalur === j || jalur.startsWith(`${j}/`))) return true;
  // Layar yang menghadap masyarakat. Ditanyakan ke panel-alat.js, bukan ke
  // daftar sendiri: dua daftar untuk satu golongan halaman pasti berselisih
  // begitu rute publik baru ditambahkan ke salah satunya saja.
  return alatHalamanPublikPortal(location.pathname);
}

let sedangMemasang = false;

async function pasangPortal() {
  if (sedangMemasang) return;
  const sudahAda = document.getElementById(PENANDA_ALETA);

  if (halamanTanpaPanel()) {
    // Halaman masuk: tidak ada yang perlu dibaca, dan panel yang menutupi
    // isian kata sandi hanya mengganggu. Layar publik: nama petugas dan
    // perkara yang baru dibukanya tidak boleh tampil di ruang tunggu - dan
    // "siapa saya" pun tidak ditanyakan, sebab pertanyaan itu sendiri
    // membawa kuki petugas. Panel yang sudah ada dilepas: portal dapat
    // berpindah ke layar publik tanpa memuat ulang.
    if (sudahAda) sudahAda.remove();
    return;
  }
  if (sudahAda) return;
  if (!(await sedangAktif())) return;

  sedangMemasang = true;
  try {
    const mulaiSiapa = Date.now();
    const respons = await alatAmbil(alamatSiapa(), { credentials: "include", cache: "no-store" }, "Membaca akun");
    // Lama jawaban "siapa saya" - dibaca lencana server Tahap 4 (portal-7).
    t4LamaSiapaMs = Date.now() - mulaiSiapa;
    // Belum masuk: diam. Portal sendiri yang mengantar ke halaman masuk.
    if (respons.status === 401) return;
    if (!respons.ok) return;
    const luar = await respons.json();
    const siapa = luar && luar.data ? luar.data : luar;
    if (!siapa || !siapa.nama) return;
    if (document.getElementById(PENANDA_ALETA)) return;
    const panel = await susunPanelPortal(siapa);
    document.body.appendChild(panel);
    // Tahap 4: letak panel (samping menggeser halaman) dipasang sesudah panel
    // benar-benar masuk halaman. Dalam Lama hanya memastikan tidak ada sisa.
    t4SesudahTerpasang(panel);
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
// Pengalih tampilan Tahap 1 didengar SEBELUM panel dipasang: pilihan
// tampilan yang terbaca selagi "siapa saya" masih di jalan tidak boleh lolos.
t4DengarkanPerubahan();
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
