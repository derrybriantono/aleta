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
  });
  pengamat.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
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
  if (siapa && siapa.peran) tambah("aleta-id-jenis", "", siapa.peran, "Peran yang sedang berlaku.");
  try {
    const seri = chrome.runtime.getManifest().version;
    if (seri) tambah("aleta-id-versi aleta-kaki-versi", "", `v${seri}`, "Seri ekstensi yang terpasang di peramban ini.");
  } catch {
    /* di luar konteks ekstensi */
  }
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

  const tombolPerbarui = buatElemen(
    "button",
    "aleta-tombol",
    tertinggal ? "Perbarui sekarang" : "Periksa pembaruan"
  );
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
  async function mintaKeLatar(jenis) {
    try {
      return await chrome.runtime.sendMessage({ sumber: "aleta-panel", jenis });
    } catch (galat) {
      // Terjadi ketika ekstensi sedang dimuat ulang - konteksnya mati sebelum
      // jawabannya sampai. Itu justru pertanda perintahnya berjalan.
      return { ok: false, keadaan: "konteks_mati", pesan: String((galat && galat.message) || galat) };
    }
  }

  tombolPerbarui.addEventListener("click", async () => {
    tombolPerbarui.disabled = true;
    kabarkan("Menanyakan pembaruan kepada Chrome…", false);

    const jawab = await mintaKeLatar("perbarui");
    kabarkan((jawab && jawab.pesan) || "Tidak ada jawaban dari ekstensi.", !(jawab && jawab.ok));

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
    const jawab = await mintaKeLatar("muat-ulang");
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
  kaki.appendChild(pitaIdentitas(siapa));

  // Panel ini dibangun SEKALI saat halaman dibuka, sedangkan portal
  // berpindah halaman tanpa memuat ulang. Kewenangan yang baru diubah,
  // perkara yang baru dibuka di SIPP, dan versi ekstensi yang baru
  // dipasang karena itu tidak pernah terbaca sampai halamannya dimuat
  // ulang seluruhnya - dan memuat ulang halaman ALETA berarti kehilangan
  // apa pun yang sedang dikerjakan di sana.
  // Bentuk kaki yang sama dengan panel SIPP - satu baris, ikon di kanan.
  // Panel ini tidak punya pintasan papan tik, jadi barisnya hanya berisi
  // ikonnya; yang sama adalah tempat dan bentuknya, bukan isinya.
  const barisKaki = buatElemen("div", "aleta-kaki-baris");
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
  kaki.appendChild(barisKaki);
  panel.appendChild(kaki);

  await alatPasangPanel(panel, kepala, KUNCI_POSISI_ALETA, {
    // Tema TIDAK diterapkan ke halaman - halamannya ALETA, dan ALETA punya
    // saklarnya sendiri.
    temaHalaman: false,
    saatTutup: () => panel.remove(),
  });

  // Saklar tema milik panel disingkirkan: temanya mengikuti ALETA. Dua saklar
  // untuk satu tema hanya melahirkan dua tema yang berselisih.
  const tombolTema = kepala.querySelector(".aleta-tema");
  if (tombolTema) tombolTema.remove();
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

void pasangPortal();

// Portal berpindah halaman tanpa memuat ulang (Next.js). Skrip ini hanya
// dijalankan sekali, jadi perpindahan dari /login ke /portal harus dikejar
// sendiri - dan panel yang sudah ada dibiarkan, tidak dibangun ulang.
let jalurTerakhir = location.pathname;
setInterval(() => {
  if (location.pathname === jalurTerakhir) return;
  jalurTerakhir = location.pathname;
  void pasangPortal();
}, 800);
