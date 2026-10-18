"use strict";

/**
 * Saklar tampil/sembunyi panel.
 *
 * Hanya menyimpan tiga nilai di penyimpanan ekstensi. Tidak ada kredensial,
 * tidak ada data perkara - keduanya tetap di sesi portal dan di server.
 *
 * Tidak ada pemuatan ulang tab di sini. Skrip konten mendengarkan perubahan
 * penyimpanan sendiri, sehingga saklarnya berlaku seketika tanpa menuntut
 * izin "tabs" - izin yang memberi ekstensi kemampuan membaca alamat SELURUH
 * tab peramban, jauh lebih luas daripada yang dibutuhkan.
 */
const kotak = document.getElementById("aktif");
const kotakTanda = document.getElementById("tandaiHalaman");
const kotakSisip = document.getElementById("sisipJadwal");
const kotakCetak = document.getElementById("cetakTigaBerkas");
const kotakSunting = document.getElementById("suntingLangsungAbt");
const kotakChecklist = document.getElementById("checklistMilestone");
/* Blangko ABT by Derry Briantono (tahap C): empat saklar yang sama dengan "Widget ALETA" di tampilan itu. */
const SAKLAR_DERRY = {
  derryBawaan: ["blangkoDerryBawaan", false],
  derryTawar: ["blangkoDerryTawar", true],
  derrySaran: ["blangkoDerrySaran", true],
  derryIngat: ["blangkoDerryIngat", true],
  /* JJ2 (18 Okt): tanya-jawab jawab-menjawab otomatis dari berkas e-Court, bawaan NYALA (keputusan 74). */
  derryTjJawab: ["blangkoDerryTjJawab", true],
};
/* SIPP dengan Ide ALETA gelombang 2 (tahap M2): penyatu SIPP-ABT-ALETA dan tombol ALETA yang dobel. */
const SAKLAR_SIPP_IDE = {
  sippPenyatu: ["sippPenyatu", true],
  sippTampilDobel: ["sippTampilDobel", false],
  /* F3.2: kotak kehadiran sidang hari ini di widget - keputusan 17 Okt butir 41: bawaan MENYALA, terlipat di kiri bawah. */
  widgetKehadiran: ["widgetKehadiran", true],
  /* F4.2: kotak draf putusan H-7 di widget - keputusan 17 Okt butir 41: bawaan MENYALA, terlipat di kiri bawah. */
  widgetDrafH7: ["widgetDrafH7", true],
};
/* F1.5 (17 Okt): gembok panel ALETA di ABT biasa - kunci yang sama dengan tombol
   gembok di bawah kepala panel dan Widget ALETA. Menyala = terkunci (tampil penuh). */
const SAKLAR_ABT = {
  gembokAbt: ["gembokKepalaAbt", false],
};
/**
 * Butir 41 (17 Okt, audit): centang "Kehadiran sidang" dan "Draf putusan H-7"
 * = kotak yang BENAR-BENAR tampil. UI Baru: bawaan menyala, tampil walau
 * Checklist milestone mati. Baru (Klasik): kotaknya hanya ada di atas
 * checklist dan hanya bila dinyalakan sendiri - tanpa Checklist milestone
 * saklarnya tidak tercentang dan tidak dapat diubah. Lama: popup tidak diubah.
 */
const KOTAK_WIDGET_SIDANG = ["widgetKehadiran", "widgetDrafH7"];
const nilaiKotakWidget = { checklistMilestone: false, widgetKehadiran: undefined, widgetDrafH7: undefined };
function selaraskanSaklarKotakWidget() {
  let mode = "lama";
  try {
    mode = modePopupBerlaku().mode;
  } catch {
    mode = "lama";
  }
  const checklist = nilaiKotakWidget.checklistMilestone === true;
  for (const kunci of KOTAK_WIDGET_SIDANG) {
    const k = document.getElementById(kunci);
    if (!k) continue;
    const v = nilaiKotakWidget[kunci];
    if (mode !== "baru") {
      // UI Baru: bawaan menyala, tampil walau Checklist milestone mati. Lama: popup
      // tetap persis seperti sebelumnya (syarat mutlak Tampilan Lama).
      k.checked = v !== false;
      if (k.disabled) k.disabled = false;
      if (k.hasAttribute("title")) k.removeAttribute("title");
    } else {
      k.checked = checklist && v === true;
      k.disabled = !checklist;
      if (k.disabled) k.title = "Di tampilan Baru kotak ini tampil di atas Checklist milestone - nyalakan Checklist milestone dulu.";
      else if (k.hasAttribute("title")) k.removeAttribute("title");
    }
  }
}

/**
 * Penyimpanan ekstensi, bila memang sedang berjalan sebagai ekstensi.
 *
 * Berkas ini kadang dibuka sebagai halaman biasa - saat memeriksa tampilannya.
 * Di luar ekstensi, chrome.storage tidak ada, dan menyentuhnya melempar galat
 * yang menghentikan seluruh skrip: saklarnya lalu mati total tanpa keterangan
 * apa pun. Karena itu ketiadaannya diperlakukan sebagai keadaan yang wajar.
 */
const penyimpanan =
  typeof chrome !== "undefined" && chrome.storage && chrome.storage.local
    ? chrome.storage.local
    : null;

/**
 * ============================================================================
 * UKURAN HURUF PANEL
 * ============================================================================
 *
 * Angka, bukan saklar - dan karena itu bentuknya bukan kotak centang. Yang
 * tersimpan persen (80..160, kelipatan 10); panel membacanya lewat
 * panel-alat.js dan memasangnya sebagai pengali pada tiap ukuran huruf.
 *
 * Batas dan langkahnya ditulis ULANG di sini, tidak diambil dari panel-alat.js:
 * popup berjalan di halaman ekstensi yang TIDAK memuat berkas itu. Keduanya
 * dijaga tetap sama oleh uji ekstensi - kalau berbeda, popup akan menawarkan
 * angka yang kemudian dijepit panel tanpa ada yang mengatakannya.
 */
/* === POPUP-PERAN 12 Okt === deklarasi data dipindah ke atas: dibaca sebelum bagian lain selesai dievaluasi (TDZ). */
const KUNCI_IDENTITAS = "identitasPopup";
const KUNCI_PERALIHAN = "identitasPeralihan";
const AWALAN_AKUN = "pengaturanAkun:";
/** Kunci setelan pribadi - SAMA dengan KUNCI_SETELAN_AKUN di latar.js (dijaga uji). */
const KUNCI_SETELAN_AKUN = [
  "aktif",
  "tandaiHalaman",
  "sisipJadwal",
  "cetakTigaBerkas",
  "suntingLangsungAbt",
  "checklistMilestone",
  "blangkoDerryBawaan",
  "blangkoDerryTawar",
  "blangkoDerrySaran",
  "blangkoDerryIngat",
  "blangkoDerryTjJawab",
  "sippPenyatu",
  "sippTampilDobel",
  "widgetKehadiran",
  "widgetDrafH7",
  "gembokKepalaAbt",
  /* Saklar penanda SIPP (popup-ide-l2.js) - per akun seperti saklar lain (audit 17 Okt). */
  "ideL2",
  "ideL2Sita",
  "ideL2Eksekusi",
  "ideL2IzinCerai",
  "ideL2Penetapan",
  "ideL2BelumDitunda",
  "ideL2Verstek",
  "ideL2Umur",
  "ideL2TanpaSidang",
  "ideL2Ikrar",
  "ideL2AktaCerai",
  "ideL2LimaBulan",
  "ideL2EcourtVerifikasi",
  "skalaHuruf",
  "temaPopup",
  "temaPanel",
  "warnaGelap",
  "warnaMandiri",
  "warnaSendiri",
  "panelBawaanTampil",
  "senyapSampai",
  "sembunyikanTeknis",
  "ujiTampilan",
  "ujiFitur",
  "ujiIzinkanNyata",
];
/** Nilai awal tiap kunci yang punya bawaan jelas; selebihnya dihapus saat berganti akun. */
const BAWAAN_AKUN = {
  aktif: true,
  tandaiHalaman: true,
  sisipJadwal: false,
  cetakTigaBerkas: false,
  suntingLangsungAbt: false,
  checklistMilestone: false,
  blangkoDerryBawaan: false,
  blangkoDerryTawar: true,
  blangkoDerrySaran: true,
  blangkoDerryIngat: true,
  blangkoDerryTjJawab: true,
  sippPenyatu: true,
  sippTampilDobel: false,
  widgetKehadiran: true,
  widgetDrafH7: true,
  gembokKepalaAbt: false,
  skalaHuruf: 100,
  temaPopup: "ikut",
  temaPanel: "gelap",
  sembunyikanTeknis: true,
  ujiTampilan: "lama",
  ujiFitur: {},
  ujiIzinkanNyata: false,
};
const SAKLAR_PROFIL_ID = ["tandaiHalaman", "sisipJadwal", "cetakTigaBerkas", "suntingLangsungAbt", "checklistMilestone"];
const SITUS_PANEL_ID = ["aleta", "sipp", "abt"];

const LABEL_GOLONGAN = {
  "super-admin": "Super Admin",
  admin: "Admin",
  ketua: "Ketua",
  hakim: "Hakim",
  "panitera-pengganti": "Panitera Pengganti",
  "juru-sita": "Juru Sita",
  panitera: "Panitera",
  kasir: "Kasir",
  ptsp: "PTSP",
  mediator: "Mediator",
  operator: "Operator",
  umum: "Pegawai",
};

let identitasPopup = null;
/** { profil, kustom } milik akun+golongan yang masuk - dari salinan tersimpan. */
let rekamAkunPopup = { profil: "", kustom: null };

let golonganTersimpan = "";
const KUNCI_PEMBARUAN_OTOMATIS = "pembaruanOtomatis";
const pembaruanLatar = { versiPortal: "", menunggu: "", diunduh: null };


const SKALA_KUNCI = "skalaHuruf";
const SKALA_BAWAAN = 100;
const SKALA_MIN = 80;
const SKALA_MAKS = 160;
const SKALA_LANGKAH = 10;

const skalaKurang = document.getElementById("skalaKurang");
const skalaTambah = document.getElementById("skalaTambah");
const skalaNilai = document.getElementById("skalaNilai");
const skalaContoh = document.getElementById("skalaContoh");
const skalaPulih = document.getElementById("skalaPulih");

let skalaSekarang = SKALA_BAWAAN;

function rapikanSkala(nilai) {
  const angka = Number(nilai);
  if (!Number.isFinite(angka)) return SKALA_BAWAAN;
  const dibulatkan = Math.round(angka / SKALA_LANGKAH) * SKALA_LANGKAH;
  return Math.min(SKALA_MAKS, Math.max(SKALA_MIN, dibulatkan));
}

/**
 * Menggambarkan keadaan sekarang.
 *
 * Contoh teksnya ikut diperbesar di tempat, supaya yang memilih melihat
 * akibatnya TANPA harus berpindah ke halaman SIPP lebih dulu. Tombol yang
 * sudah mentok dimatikan - menekan sesuatu yang diam-diam tidak berbuat apa
 * pun membuat orang menyangka setelannya rusak.
 */
function gambarSkala() {
  if (!skalaNilai) return;
  skalaNilai.textContent = `${skalaSekarang}%`;
  if (skalaContoh) skalaContoh.style.fontSize = `${(12.5 * skalaSekarang) / 100}px`;
  if (skalaKurang) skalaKurang.disabled = skalaSekarang <= SKALA_MIN;
  if (skalaTambah) skalaTambah.disabled = skalaSekarang >= SKALA_MAKS;
  if (skalaPulih) skalaPulih.disabled = skalaSekarang === SKALA_BAWAAN;
  // Penggeser dan pratinjau ide popup-4 (Tahap 2). Dicari lewat id tiap kali,
  // bukan disimpan di const: keduanya hanya ADA selama saklar fiturnya
  // menyala, dan fungsi ini sudah dipanggil sebelum bagian Tahap 2 terbaca.
  const geser = document.getElementById("skalaGeser");
  if (geser) geser.value = String(skalaSekarang);
  const pratinjau = document.getElementById("skalaPratinjau");
  if (pratinjau) pratinjau.style.fontSize = `${(12.5 * skalaSekarang) / 100}px`;
}

function setelSkala(nilai) {
  const bersih = rapikanSkala(nilai);
  if (bersih === skalaSekarang) {
    gambarSkala();
    return;
  }
  skalaSekarang = bersih;
  gambarSkala();
  simpan(SKALA_KUNCI, skalaSekarang);
}

if (skalaKurang) skalaKurang.addEventListener("click", () => setelSkala(skalaSekarang - SKALA_LANGKAH));
if (skalaTambah) skalaTambah.addEventListener("click", () => setelSkala(skalaSekarang + SKALA_LANGKAH));
if (skalaPulih) skalaPulih.addEventListener("click", () => setelSkala(SKALA_BAWAAN));

function pasangNilai(simpan) {
  // Panel bawaannya MENYALA: ia hanya menambah lapisan di sisi kanan.
  kotak.checked = simpan.aktif !== false;
  // Penandaan halaman bawaannya MENYALA. Dulu mati, dan karena saklarnya
  // terkubur di jendela ini - yang hampir tidak pernah dibuka - penanda ghaib
  // dan panjar menipis tidak pernah muncul di daftar perkara sama sekali.
  // Penanda hanya menambah keterangan, jadi harganya rendah dan gunanya
  // tinggi; yang mematikannya tetap diingat.
  kotakTanda.checked = simpan.tandaiHalaman !== false;
  // Ukuran huruf panel - angka, dan bawaannya 100%.
  skalaSekarang = rapikanSkala(
    simpan[SKALA_KUNCI] === undefined ? SKALA_BAWAAN : simpan[SKALA_KUNCI]
  );
  gambarSkala();
  // Menyisipkan ke dalam tabel SIPP lebih jauh lagi daripada menandai:
  // tampilannya menyatu, sehingga berkas ALETA terlihat seperti bagian
  // SIPP. Bawaannya mati, dan menyalakannya keputusan petugas.
  kotakSisip.checked = simpan.sisipJadwal === true;
  // Bawaannya MATI: ia mengubah arti tombol CETAK milik ABT, dan satu tekanan
  // yang dulu menghasilkan satu berkas menjadi tiga.
  if (kotakCetak) kotakCetak.checked = simpan.cetakTigaBerkas === true;
  // Bawaannya MATI - yang gagal dibaca tidak boleh menyalakan perilaku yang
  // mengubah berkas perkara.
  if (kotakSunting) kotakSunting.checked = simpan.suntingLangsungAbt === true;
  // Widget checklist milestone - bawaannya MATI. Ia menambah satu kotak
  // melayang di tiap halaman kerja; yang tidak pernah menyalakannya tidak
  // melihat apa pun berubah.
  if (kotakChecklist) kotakChecklist.checked = simpan.checklistMilestone === true;
  // Bawaan MATI (tampilan baru dipilih orangnya); tawaran, saran Tab, dan
  // pengingat isian kosong bawaannya MENYALA.
  for (const [id, [kunci, bawaan]] of Object.entries({ ...SAKLAR_DERRY, ...SAKLAR_SIPP_IDE, ...SAKLAR_ABT })) {
    const k = document.getElementById(id);
    if (k) k.checked = bawaan ? simpan[kunci] !== false : simpan[kunci] === true;
  }
  nilaiKotakWidget.checklistMilestone = simpan.checklistMilestone === true;
  for (const kunci of KOTAK_WIDGET_SIDANG) nilaiKotakWidget[kunci] = typeof simpan[kunci] === "boolean" ? simpan[kunci] : undefined;
  selaraskanSaklarKotakWidget();

  // Alamat portal dicatat skrip konten saat halaman SIPP dibuka. Popup
  // berjalan di origin chrome-extension://, sehingga tautan relatif di sini
  // menunjuk ke dalam ekstensi - bukan ke server.
  const tautan = document.getElementById("tautanPortal");
  if (!tautan) return;
  if (simpan.asalPortal) {
    tautan.href = simpan.asalPortal;
  } else {
    // Belum pernah membuka halaman SIPP, jadi alamatnya belum diketahui.
    // Menebak alamatnya lebih buruk daripada mengatakannya apa adanya.
    tautan.removeAttribute("href");
    tautan.textContent = "portal ALETA (buka halaman SIPP dulu)";
  }
}

if (penyimpanan) {
  penyimpanan
    .get(["aktif", "tandaiHalaman", "sisipJadwal", "cetakTigaBerkas", "suntingLangsungAbt", "checklistMilestone", "asalPortal", SKALA_KUNCI, ...Object.values(SAKLAR_DERRY).map((x) => x[0]), ...Object.values(SAKLAR_SIPP_IDE).map((x) => x[0]), ...Object.values(SAKLAR_ABT).map((x) => x[0])])
    .then(pasangNilai)
    .catch(() => pasangNilai({}));
} else {
  pasangNilai({});
}

function simpan(kunci, nilai, kotakCentang) {
  if (!penyimpanan) return;
  if (kotakCentang) {
    void simpanSaklar({ [kunci]: nilai }, kotakCentang);
    return;
  }
  void Promise.resolve()
    .then(() => penyimpanan.set({ [kunci]: nilai }))
    .catch(() => {
      /* bukan saklar (skala, tema): nilai lama tetap berlaku di panel */
    });
}

/**
 * ============================================================================
 * SAKLAR YANG GAGAL TERSIMPAN TIDAK BOLEH TAMPAK TERSIMPAN
 * ============================================================================
 *
 * Uji rilis U2c (9 Okt 2026). chrome.storage.local boleh menolak menulis -
 * kuota penuh, atau ekstensi sedang dimuat ulang. Sebelumnya penolakan itu
 * ditelan (`void penyimpanan.set(...)`): centangnya berubah di jendela ini
 * sementara panel di SIPP tetap memakai nilai lama. Yang paling berbahaya:
 * Mode latihan tampak MENYALA padahal panel tetap menulis ke SIPP, dan
 * "Izinkan tindakan nyata" tampak mati padahal tindakan nyata tetap berlaku.
 *
 * Kini centangnya dikembalikan ke nilai yang sungguh berlaku, sebabnya
 * disebut tepat di bawah saklar itu, dan `saatGagal` memulihkan keadaan
 * jendela ini (keterangan mode coba / latihan). Pulang true bila tersimpan.
 */
function kabarSimpanUntuk(kotakCentang) {
  const induk = (kotakCentang && (kotakCentang.closest("label") || kotakCentang.parentNode)) || null;
  if (!induk || !induk.parentNode) return null;
  const ada = induk.nextElementSibling;
  if (ada && ada.hasAttribute && ada.hasAttribute("data-gagal-simpan")) return ada;
  return null;
}

function simpanSaklar(isi, kotakCentang, saatGagal) {
  const nilaiBaru = kotakCentang ? kotakCentang.checked : undefined;
  return Promise.resolve()
    .then(() => {
      if (!penyimpanan) throw new Error("Penyimpanan ekstensi tidak tersedia di jendela ini.");
      return penyimpanan.set(isi);
    })
    .then(() => {
      const kabar = kabarSimpanUntuk(kotakCentang);
      if (kabar) kabar.remove();
      return true;
    })
    .catch(() => {
      // Dikembalikan hanya bila petugas belum mengubahnya lagi sementara itu.
      if (kotakCentang && kotakCentang.checked === nilaiBaru) kotakCentang.checked = !nilaiBaru;
      if (typeof saatGagal === "function") {
        try {
          saatGagal();
        } catch {
          /* keterangan jendela ini saja */
        }
      }
      const induk = kotakCentang && (kotakCentang.closest("label") || kotakCentang.parentNode);
      if (induk && induk.parentNode) {
        let kabar = kabarSimpanUntuk(kotakCentang);
        if (!kabar) {
          kabar = document.createElement("p");
          kabar.className = "saklar-ket";
          kabar.setAttribute("data-gagal-simpan", "ya");
          kabar.setAttribute("role", "alert");
          induk.parentNode.insertBefore(kabar, induk.nextSibling);
        }
        kabar.textContent =
          "Tidak tersimpan - penyimpanan ekstensi menolak menulis, jadi saklar ini dikembalikan ke nilai yang " +
          "sedang berlaku. Coba lagi; bila tetap gagal, muat ulang ekstensi.";
      }
      return false;
    });
}

/**
 * ============================================================================
 * MEMASANG PEMBARUAN DARI POPUP
 * ============================================================================
 *
 * Popup adalah halaman ekstensi, jadi ia SANGGUP memanggil requestUpdateCheck
 * dan reload sendiri. Meski begitu keduanya tetap dititipkan ke latar.js -
 * bukan karena tidak bisa, melainkan supaya aturan "apa yang terjadi pada tiap
 * keadaan" hidup di SATU tempat. Popup dan panel di halaman SIPP menekan
 * tombol yang berbeda dan menerima kalimat yang sama persis.
 *
 * Dan satu alasan yang lebih keras: reload() membunuh popupnya sendiri
 * seketika. Dikerjakan dari sini, jawabannya tidak pernah sempat terbaca.
 */
const tombolPerbarui = document.getElementById("perbaruiSekarang");
const tombolMuatUlangEkstensi = document.getElementById("muatUlangEkstensi");
const perbaruiKabar = document.getElementById("perbaruiKabar");
const perbaruiVersi = document.getElementById("perbaruiVersi");

function kabarPerbarui(teks) {
  if (!perbaruiKabar) return;
  perbaruiKabar.textContent = teks;
  perbaruiKabar.hidden = false;
  // POPUP-PERAN 12 Okt: kabar yang sama di pemberitahuan puncak jendela.
  const kabarPita = document.getElementById("pemberitahuanVersiKabar");
  if (kabarPita) {
    kabarPita.textContent = teks;
    kabarPita.hidden = false;
  }
}

async function mintaKeLatar(jenis, paksa, tambahan) {
  if (typeof chrome === "undefined" || !chrome.runtime || !chrome.runtime.sendMessage) {
    return { ok: false, pesan: "Jendela ini tidak berjalan sebagai ekstensi." };
  }
  try {
    if (paksa) return await chrome.runtime.sendMessage({ sumber: "aleta-panel", jenis, paksa: true, ...(tambahan || {}) });
    return await chrome.runtime.sendMessage({ sumber: "aleta-panel", jenis, ...(tambahan || {}) });
  } catch (galat) {
    // Ekstensi sedang dimuat ulang - konteksnya mati sebelum jawabannya
    // sampai. Itu pertanda perintahnya berjalan, bukan gagal.
    return { ok: true, keadaan: "konteks_mati", pesan: "Ekstensi sedang dimuat ulang." };
  }
}

if (perbaruiVersi && typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.getManifest) {
  try {
    perbaruiVersi.textContent = `versi ${chrome.runtime.getManifest().version}`;
  } catch {
    /* di luar ekstensi - versinya memang tidak dapat diketahui */
  }
}

// Putaran cetak relaas yang belum selesai HILANG bila ekstensi dimuat ulang;
// latar.js menahannya dan menjawab "putaran-relaas-berjalan". Tekanan KEDUA
// pada tombol yang sama baru memaksa - sama dengan panel ALETA.
let paksaPerbarui = false;
let paksaMuatUlang = false;

/**
 * Ditahan latar.js? Putaran relaas (keadaan lama) ATAU antrean kerja massal
 * di tab SIPP/ABT mana pun - penetapan, putusan, BAS, relaas & PBT massal
 * ("antrean-berjalan", 9 Okt 2026). Tekanan kedua = "Tetap perbarui" (paksa).
 */
function pembaruanDitahan(jawab) {
  if (!jawab) return false;
  return jawab.ditahan === true || jawab.keadaan === "putaran-relaas-berjalan" || jawab.keadaan === "antrean-berjalan";
}

if (tombolPerbarui) {
  const labelPerbarui = tombolPerbarui.textContent;
  tombolPerbarui.addEventListener("click", async () => {
    tombolPerbarui.disabled = true;
    kabarPerbarui("Menanyakan pembaruan kepada Chrome…");

    const sudahDipaksa = paksaPerbarui;
    const jawab = paksaPerbarui ? await mintaKeLatar("perbarui", true) : await mintaKeLatar("perbarui");
    kabarPerbarui((jawab && jawab.pesan) || "Tidak ada jawaban dari ekstensi.");

    if (pembaruanDitahan(jawab)) {
      paksaPerbarui = true;
      tombolPerbarui.textContent = jawab.labelPaksa || "Tetap perbarui - putaran cetak hilang";
      tombolPerbarui.disabled = false;
      return;
    }
    paksaPerbarui = false;
    tombolPerbarui.textContent = labelPerbarui;

    if (jawab && jawab.ok && jawab.keadaan === "dipasang") return;

    // Chrome tidak memasang apa pun. Jalan kedua ditawarkan hanya sekarang.
    // Petugas yang SUDAH menekan "Tetap perbarui - putaran cetak hilang" tidak
    // ditahan kedua kalinya oleh putaran yang sama (uji rilis U2c 9 Okt 2026) -
    // sama dengan alatJalankanPembaruan di panel, yang membawa paksa ke
    // "muat-ulang" juga.
    if (sudahDipaksa) paksaMuatUlang = true;
    if (tombolMuatUlangEkstensi) tombolMuatUlangEkstensi.hidden = false;
    tampilkanMuatUlangPita(jawab);
    tombolPerbarui.disabled = false;
  });
}

if (tombolMuatUlangEkstensi) {
  const labelMuatUlang = tombolMuatUlangEkstensi.textContent;
  tombolMuatUlangEkstensi.addEventListener("click", async () => {
    tombolMuatUlangEkstensi.disabled = true;
    kabarPerbarui("Memuat ulang ekstensi dari berkasnya…");
    const jawab = await mintaKeLatar("muat-ulang", paksaMuatUlang);
    if (pembaruanDitahan(jawab)) {
      kabarPerbarui(jawab.pesan || "Putaran cetak relaas belum selesai.");
      paksaMuatUlang = true;
      tombolMuatUlangEkstensi.textContent =
        jawab.keadaan === "antrean-berjalan" ? "Tetap muat ulang - antrean terputus" : "Tetap muat ulang - putaran cetak hilang";
      tombolMuatUlangEkstensi.disabled = false;
      return;
    }
    paksaMuatUlang = false;
    tombolMuatUlangEkstensi.textContent = labelMuatUlang;
    kabarPerbarui(
      (jawab && jawab.pesan) ||
        "Ekstensi sedang dimuat ulang. Muat ulang halaman SIPP yang terbuka sebentar lagi."
    );
    // latar.js menolak (keadaan putaran tidak terbaca): ekstensi TIDAK dimuat
    // ulang, jadi jendela ini tetap hidup - tombolnya harus dapat ditekan lagi.
    if (jawab && jawab.ok === false) tombolMuatUlangEkstensi.disabled = false;
  });
}

kotak.addEventListener("change", () => simpan("aktif", kotak.checked, kotak));
kotakTanda.addEventListener("change", () => simpan("tandaiHalaman", kotakTanda.checked, kotakTanda));
kotakSisip.addEventListener("change", () => simpan("sisipJadwal", kotakSisip.checked, kotakSisip));
if (kotakCetak) {
  kotakCetak.addEventListener("change", () => simpan("cetakTigaBerkas", kotakCetak.checked, kotakCetak));
  if (kotakSunting) {
    kotakSunting.addEventListener("change", () => simpan("suntingLangsungAbt", kotakSunting.checked, kotakSunting));
  }
}
for (const [id, [kunci]] of Object.entries({ ...SAKLAR_DERRY, ...SAKLAR_SIPP_IDE, ...SAKLAR_ABT })) {
  const k = document.getElementById(id);
  if (k) k.addEventListener("change", () => simpan(kunci, k.checked, k));
}
// F1.5 (17 Okt): gembok ABT juga diubah dari panel dan Widget ALETA - centang ikut seketika.
try {
  chrome.storage.onChanged.addListener((ubah, tempat) => {
    // Popup yang sudah ditutup tidak lagi punya document - kabar yang datang sesudahnya diabaikan.
    if (tempat !== "local" || typeof document === "undefined" || !document) return;
    for (const [id, [kunci]] of Object.entries(SAKLAR_ABT)) {
      const k = document.getElementById(id);
      if (k && ubah[kunci]) k.checked = ubah[kunci].newValue === true;
    }
  });
} catch {
  /* di luar konteks ekstensi */
}
if (kotakChecklist) {
  kotakChecklist.addEventListener("change", () => {
    nilaiKotakWidget.checklistMilestone = kotakChecklist.checked;
    selaraskanSaklarKotakWidget();
    simpan("checklistMilestone", kotakChecklist.checked, kotakChecklist);
  });
  // × di kepala widget mematikan saklar ini. Centangnya ikut lepas di sini
  // selama jendela ini terbuka - centang yang tertinggal menyala sementara
  // widgetnya sudah tertutup adalah saklar yang berbohong.
  try {
    chrome.storage.onChanged.addListener((ubah, tempat) => {
      if (tempat !== "local") return;
      if (ubah.checklistMilestone) {
        kotakChecklist.checked = ubah.checklistMilestone.newValue === true;
        nilaiKotakWidget.checklistMilestone = kotakChecklist.checked;
      }
      let ada = Boolean(ubah.checklistMilestone);
      for (const kunci of KOTAK_WIDGET_SIDANG) {
        if (!(kunci in ubah)) continue;
        const v = ubah[kunci].newValue;
        nilaiKotakWidget[kunci] = typeof v === "boolean" ? v : undefined;
        ada = true;
      }
      if (ada) selaraskanSaklarKotakWidget();
    });
  } catch {
    /* di luar konteks ekstensi */
  }
}

/**
 * ============================================================================
 * MENGEMBALIKAN PANEL YANG TERGESER KELUAR LAYAR
 * ============================================================================
 *
 * Yang dihapus kunci LETAK - tempat posisi, ukuran, dan keadaan lencana tiap
 * panel disimpan. Skrip konten mendengarkan penghapusan itu lalu mengembalikan
 * panelnya ke tempat bawaan DAN membentangkannya lagi, sehingga tidak perlu
 * memuat ulang halaman dan tidak perlu izin "tabs" hanya untuk menyentuh satu
 * tab.
 *
 * ============================================================================
 * KEEMPAT KUNCINYA, BUKAN HANYA MILIK SIPP
 * ============================================================================
 *
 * Dahulu hanya "posisiPanel" yang dihapus - kunci panel SIPP. Panel ABT,
 * panel putusan massal ABT, dan panel portal ALETA menyimpan letaknya di
 * kunci masing-masing, dan tombol ini tidak menjangkau satu pun di antaranya.
 *
 * Akibatnya: panel yang diciutkan menjadi lencana lalu terseret ke tepi di
 * halaman ABT atau portal ALETA tidak dapat dikembalikan dari mana pun -
 * tidak dari panelnya (tombolnya ikut menciut), tidak dari sini. Satu-satunya
 * jalan adalah memuat ulang halaman, dan lencananya lahir kembali di tempat
 * yang sama persis.
 *
 * Saklar tampil/sembunyi, tema, dan lipatan menu TIDAK ikut terhapus: yang
 * hilang dari layar adalah letaknya, dan membuang pengaturan lain sekalian
 * berarti menghukum petugas atas kesalahan yang tidak ia perbuat.
 */
const KUNCI_LETAK_PANEL = [
  "posisiPanel",
  "posisiPanelAbt",
  "posisiPanelAbtMassal",
  "posisiPanelAleta",
  // Widget checklist milestone - satu kunci per aplikasi, sama alasannya
  // dengan panel (lihat checklist.js). Yang terciut menjadi pil ikut
  // dibentangkan lagi.
  "posisiChecklistSipp",
  "posisiChecklistAbt",
  "posisiChecklistAleta",
  // Sudut tempat widget menempel (ide popup-9, tahap 3). Tanpa ini sudut
  // yang diingat membawa widget kembali ke pojok lama sesudah "Kembalikan
  // posisi". Dalam tampilan Lama kuncinya tidak pernah ada.
  "sudutWidget",
];
const tombolReset = document.getElementById("resetPosisi");
const kabarReset = document.getElementById("kabarReset");

function kabarkan(teks) {
  if (!kabarReset) return;
  kabarReset.textContent = teks;
  kabarReset.hidden = false;
}

if (tombolReset) {
  tombolReset.addEventListener("click", () => {
    if (!penyimpanan) {
      kabarkan("Penyimpanan ekstensi tidak tersedia di jendela ini.");
      return;
    }
    tombolReset.disabled = true;
    void penyimpanan
      .remove(KUNCI_LETAK_PANEL)
      .then(() => {
        kabarkan(
          "Posisi panel dikembalikan - SIPP, ABT, dan portal ALETA. Panel yang terciut ikut dibentangkan lagi, " +
            "dan widget checklist kembali ke kiri bawah."
        );
      })
      .catch(() => {
        kabarkan("Gagal mengembalikan posisi. Coba lagi.");
      })
      .finally(() => {
        tombolReset.disabled = false;
      });
  });
}

/**
 * ============================================================================
 * VERSI EKSTENSI DAN DUA AKUN YANG SEDANG MASUK
 * ============================================================================
 *
 * Ada DUA akun yang berjalan bersamaan di layar yang sama, dan keduanya belum
 * tentu orang yang sama:
 *
 *   akun ALETA  sesi portal. Inilah yang menentukan menu apa yang boleh
 *               dipakai, dan atas nama siapa tindakan tercatat di ALETA.
 *   akun SIPP   sesi SIPP di tab itu. Inilah yang tercatat di sys_audittrail
 *               ketika penetapan ditulis.
 *
 * Perbedaan keduanya diam-diam adalah masalah yang mahal: pekerjaan dapat
 * tercatat atas nama pejabat yang keliru, dan ketahuannya baru belakangan.
 * Menyebut keduanya berdampingan membuat perbedaan itu terlihat sebelum ada
 * yang menekan Kerjakan.
 *
 * Versinya diambil dari manifest yang benar-benar terpasang - bukan dari angka
 * yang ditulis terpisah. Ekstensi yang dimuat unpacked tidak pernah memperbarui
 * dirinya sendiri, jadi versi terpasang dibandingkan dengan versi yang
 * DISAJIKAN portal, dan selisihnya disebut di sini.
 */
const kolomVersi = document.getElementById("versiEkstensi");
const kolomAleta = document.getElementById("akunAleta");
const kolomSipp = document.getElementById("akunSipp");

function tulisKeadaan(kolom, teks, { kosong = false, usang = false } = {}) {
  if (!kolom) return;
  kolom.textContent = teks;
  kolom.classList.toggle("kosong", kosong);
  kolom.classList.toggle("usang", usang);
}

/** Membandingkan dua versi bertitik. Positif berarti kiri lebih baru. */
function bandingVersi(kiri, kanan) {
  const a = String(kiri || "").split(".").map((x) => parseInt(x, 10) || 0);
  const b = String(kanan || "").split(".").map((x) => parseInt(x, 10) || 0);
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    const selisih = (a[i] || 0) - (b[i] || 0);
    if (selisih !== 0) return selisih > 0 ? 1 : -1;
  }
  return 0;
}

function versiTerpasang() {
  try {
    return String(chrome.runtime.getManifest().version || "");
  } catch {
    return "";
  }
}

const terpasang = versiTerpasang();
tulisKeadaan(kolomVersi, terpasang ? terpasang : "tidak terbaca", { kosong: !terpasang });

/**
 * Jawaban portal yang sama, dalam bentuk DATA - bukan hanya kalimat di kolom.
 *
 * Kartu status UI Baru dan lampu sambungan (Tahap 2) perlu tahu "server
 * menjawab tetapi belum masuk" berbeda dari "server tidak menjawab". Kalimat
 * di kolom Masuk ALETA sudah membedakannya, tetapi mengurai kalimat kembali
 * menjadi keadaan adalah cara paling pasti untuk patah diam-diam kelak.
 *
 * Dideklarasikan DI SINI, sebelum periksaAkunAleta pertama kali dipanggil:
 * tanpa penyimpanan, panggilan itu berjalan serempak dan akan menyentuhnya
 * saat masih dalam temporal dead zone.
 */
const keadaanPortal = {
  selesai: false,
  asal: "",
  server: "belum", // "ok" | "putus" | "belum"
  masuk: false,
  nama: "",
  peran: "",
  versi: "",
  yangBaru: "",
  pesan: "",
};

/** Mencatat jawaban portal lalu mengabarkannya; hanya peristiwa DOM, tanpa let/const lain. */
function catatPortal(ubah) {
  Object.assign(keadaanPortal, ubah, { selesai: true });
  try {
    document.dispatchEvent(new CustomEvent("aleta-popup-portal"));
  } catch {
    /* yang membaca akan melihatnya saat digambar */
  }
}

/**
 * Menanyakan ke portal siapa yang sedang masuk.
 *
 * Alamatnya dari penyimpanan, dicatat skrip konten - popup berjalan di origin
 * chrome-extension:// dan tidak punya cara lain mengetahuinya. Selama halaman
 * SIPP belum pernah dibuka, alamatnya memang belum diketahui, dan menebaknya
 * lebih buruk daripada mengatakannya apa adanya.
 */
async function periksaAkunAleta(asal) {
  if (!asal) {
    tulisKeadaan(kolomAleta, "belum diketahui — buka halaman SIPP dulu", { kosong: true });
    catatPortal({ asal: "", server: "belum", masuk: false, pesan: "alamat portal belum diketahui" });
    return;
  }
  // ==========================================================================
  // PERMINTAANNYA DIBERI BATAS WAKTU
  // ==========================================================================
  //
  // Popup ini dibuka dari bilah ekstensi, dan yang membukanya menunggu di
  // depan jendela sebesar kartu nama. Bila portal tidak menjawab - server
  // sedang dibangun ulang, jaringan kantor putus - fetch tanpa batas waktu
  // menggantung sampai peramban menyerah sendiri, dan selama itu barisnya
  // tetap bertulis "memuat..." tanpa satu pun keterangan.
  //
  // Empat detik: cukup untuk jaringan kantor yang lambat, terlalu singkat
  // untuk terasa sebagai jendela yang macet.
  const pembatal = new AbortController();
  const penghenti = setTimeout(() => pembatal.abort(), 4000);
  try {
    const respons = await fetch(`${asal}/api/aleta-ecourt/ekstensi?info=siapa`, {
      credentials: "include",
      cache: "no-store",
      signal: pembatal.signal,
    });
    if (respons.status === 401 || respons.status === 403) {
      tulisKeadaan(kolomAleta, "belum masuk portal ALETA", { kosong: true });
      catatPortal({ asal, server: "ok", masuk: false, pesan: "belum masuk portal ALETA" });
      return;
    }
    if (!respons.ok) {
      tulisKeadaan(kolomAleta, `portal menjawab ${respons.status}`, { kosong: true });
      catatPortal({ asal, server: respons.status >= 500 ? "putus" : "ok", masuk: false, pesan: `portal menjawab ${respons.status}` });
      return;
    }
    const isi = await respons.json();
    const data = isi && isi.data ? isi.data : isi;
    const nama = String((data && data.pengguna && data.pengguna.nama) || "");
    const peran = String((data && data.pengguna && data.pengguna.peran) || "");
    tulisKeadaan(
      kolomAleta,
      nama ? (peran ? `${nama} (${peran})` : nama) : "belum masuk portal ALETA",
      { kosong: !nama }
    );
    catatPortal({
      asal,
      server: "ok",
      masuk: Boolean(nama),
      nama,
      peran,
      versi: String((data && data.versi) || ""),
      // Satu kalimat "yang baru" (ide popup-10) - dipakai bila portal kelak
      // menyertakannya; sekarang belum, dan popup menunjuk catatan pembaruan.
      yangBaru: String((data && data.yangBaru) || ""),
      pesan: nama ? "" : "belum masuk portal ALETA",
    });
    // Pemilih warna gelap hanya bagi super admin - diputuskan di sini, sesudah
    // portal menjawab siapa yang masuk. Sebelum itu barisnya tersembunyi.
    // POPUP-PERAN 12 Okt: setelan per akun + golongan diselaraskan SEBELUM
    // bagian lain membaca penyimpanan.
    await prosesIdentitasPopup(data);
    void pasangPemilihWarnaPopup(peran);
    // Pengalih uji tampilan - juga hanya bagi super admin, diputuskan di sini.
    void pasangUjiTampilan(peran);
    // Mode latihan (sipp-28) - Super Admin DAN Admin, diputuskan di sini pula.
    void pasangModeLatihan(peran);
    // 12OKT-F: baris "Tarik data e-Court" - Super Admin dan Admin; server menjaga juga.
    void pasangTarikEcourt(asal, peran);

    // Versi yang disajikan portal ikut datang pada jawaban yang sama - satu
    // permintaan, dua pertanyaan terjawab.
    const disajikan = String((data && data.versi) || "");
    if (terpasang && disajikan && bandingVersi(disajikan, terpasang) > 0) {
      tulisKeadaan(kolomVersi, `${terpasang} — portal sudah ${disajikan}, perlu diperbarui`, {
        usang: true,
      });
    }
  } catch (galat) {
    tulisKeadaan(
      kolomAleta,
      galat && galat.name === "AbortError" ? "portal tidak menjawab" : "portal tidak terjangkau",
      { kosong: true }
    );
    catatPortal({
      asal,
      server: "putus",
      masuk: false,
      pesan: galat && galat.name === "AbortError" ? "server tidak menjawab" : "server tidak terjangkau",
    });
  } finally {
    clearTimeout(penghenti);
  }
}

/** Akun SIPP dicatat skrip konten dari sapaan di kepala halaman SIPP. */
function tampilkanAkunSipp(simpan) {
  const nama = String(simpan.akunSipp || "");
  if (!nama) {
    tulisKeadaan(kolomSipp, "belum diketahui — buka halaman SIPP dulu", { kosong: true });
    return;
  }
  tulisKeadaan(kolomSipp, nama);
}

if (penyimpanan) {
  penyimpanan
    .get(["asalPortal", "akunSipp"])
    .then((simpan) => {
      tampilkanAkunSipp(simpan || {});
      return periksaAkunAleta(String((simpan && simpan.asalPortal) || ""));
    })
    .catch(() => {
      tampilkanAkunSipp({});
      void periksaAkunAleta("");
    });
} else {
  tampilkanAkunSipp({});
  void periksaAkunAleta("");
}

/**
 * ============================================================================
 * TEMA JENDELA INI - DAN SEKARANG TEMA SELURUH EKSTENSI
 * ============================================================================
 *
 * Tiga keadaan, berputar dengan satu tombol:
 *
 *   ikut ALETA     mengikuti tema panel (temaPanel) - tidak ada pilihan
 *                  tersendiri untuk jendela ini
 *   terang         data-tema="terang", DAN panel ikut menjadi terang
 *   gelap          data-tema="gelap",  DAN panel ikut menjadi gelap
 *
 * ============================================================================
 * KENAPA "IKUT SISTEM" DIGANTI "IKUT ALETA"
 * ============================================================================
 *
 * Bawaannya dahulu mengikuti setelan sistem, dengan alasan yang masuk akal:
 * jendela sekecil kartu nama sebaiknya berwarna sama dengan jendela lain di
 * layar yang sama.
 *
 * Yang tidak diperhitungkan: panel ALETA bawaannya GELAP, sedangkan Windows
 * di meja petugas hampir selalu TERANG. Hasilnya jendela putih menyilaukan
 * yang muncul di atas SIPP yang gelap - "warna putih pop up yang tidak sesuai
 * dengan dark mode" - dan tombol tema di dalamnya tidak menyentuh panel sama
 * sekali, sedangkan tombol tema di panel tidak menyentuh jendela ini.
 *
 * Dua saklar yang tidak saling mengenal, untuk satu hal yang oleh siapa pun
 * disebut "tema ALETA".
 *
 * Sekarang temaPanel satu-satunya kebenaran: dibaca di sini, DITULIS di sini
 * ketika terang atau gelap dipilih, dan diikuti seketika ketika ia berubah
 * dari panel di tab mana pun - SIPP, ABT, maupun portal ALETA.
 *
 * KUNCI_TEMA_POPUP tetap ada dan tetap disimpan: yang tersimpan di situ
 * PILIHAN jendela ini (ikut / terang / gelap), bukan warnanya. Tanpa itu,
 * "ikut" tidak dapat dibedakan dari "kebetulan sama".
 */
const KUNCI_TEMA_POPUP = "temaPopup";
const KUNCI_TEMA_PANEL = "temaPanel";
const URUTAN_TEMA = ["ikut", "terang", "gelap"];
const SEBUTAN_TEMA = { ikut: "ikut ALETA", terang: "terang", gelap: "gelap" };

/**
 * ============================================================================
 * ENAM WARNA GELAP SUPER ADMIN - DARI POPUP JUGA
 * ============================================================================
 *
 * Daftarnya disalin dari panel-alat.js, bukan diimpor: popup hidup di origin
 * chrome-extension:// sendiri dan tidak memuat skrip konten. Keduanya dijaga
 * uji supaya tidak berselisih.
 *
 * Yang ditulis hanya chrome.storage - popup tidak punya localStorage halaman
 * SIPP. Salinan sinkronnya ditulis panel begitu halaman SIPP/ABT berikutnya
 * dibuka (alatPasangPanel memulihkan dari chrome.storage lalu menyimpan
 * ulang), jadi halaman itu berkelebat sekali - dan hanya sekali.
 */
const KUNCI_WARNA_GELAP = "warnaGelap";
const DAFTAR_WARNA_GELAP = [
  ["", "Hijau SIPP (bawaan)", "#7fd0a6"],
  ["arang", "Arang - hitam, aksen kelabu", "#b8b8b8"],
  ["neon", "Neon - hitam pekat, hijau neon", "#35d98f"],
  ["hangat", "Hangat - krem, koral, emas", "#e9b64a"],
  ["pastel", "Pastel - kelabu lembut, biru muda", "#a8dadc"],
  ["permata", "Permata - biru laut dalam", "#5fc3dd"],
  ["vibran", "Vibran - jingga bata, ungu", "#ff7a4d"],
];

async function pasangPemilihWarnaPopup(peran) {
  const baris = document.getElementById("barisWarna");
  const wadah = document.getElementById("pilihWarna");
  if (!baris || !wadah) return;
  if (!/super/i.test(String(peran || ""))) {
    baris.hidden = true;
    return;
  }
  let aktif = "";
  try {
    const simpan = penyimpanan ? await penyimpanan.get([KUNCI_WARNA_GELAP]) : {};
    const nama = String((simpan && simpan[KUNCI_WARNA_GELAP]) || "");
    aktif = DAFTAR_WARNA_GELAP.some(([k]) => k === nama) ? nama : "";
  } catch {
    aktif = "";
  }
  wadah.textContent = "";
  const titikSemua = [];
  const tandai = (nama) => {
    for (const [t, k] of titikSemua) t.setAttribute("aria-pressed", k === nama ? "true" : "false");
  };
  for (const [nama, judul, contoh] of DAFTAR_WARNA_GELAP) {
    const titik = document.createElement("button");
    titik.type = "button";
    titik.className = "titik-warna";
    titik.title = judul;
    titik.setAttribute("aria-label", judul);
    titik.style.setProperty("--titik", contoh);
    titik.addEventListener("click", () => {
      tandai(nama);
      if (penyimpanan) void penyimpanan.set({ [KUNCI_WARNA_GELAP]: nama });
    });
    wadah.appendChild(titik);
    titikSemua.push([titik, nama]);
  }
  tandai(aktif);
  baris.hidden = false;
}

/**
 * ============================================================================
 * UJI TAMPILAN: LAMA / BARU / UI BARU (TAHAP 1, 1.172.0)
 * ============================================================================
 *
 * Super Admin merasakan tiga tampilan bergantian, seketika, di semua panel:
 *
 *   Lama     kulit Klasik, fitur ide mati - persis ekstensi sebelumnya
 *   Baru     kulit Klasik, fitur ide yang saklarnya dinyalakan ikut tampil
 *   UI Baru  kulit Modern, fitur ide yang saklarnya dinyalakan ikut tampil
 *
 * Ketiganya disimpan di chrome.storage.local - PC ini saja - selama masa
 * coba; panel membacanya lewat panel-alat.js (bagian 3b), yang juga
 * menjalankan MODE COBA: selain Lama, kirim dan simpan ditahan kecuali kotak
 * "Izinkan tindakan nyata" dicentang.
 *
 * Kunci dan nilainya SAMA dengan yang dibaca panel-alat.js; uji repo
 * menjaga keduanya.
 */
const KUNCI_UJI_TAMPILAN = "ujiTampilan";
const KUNCI_UJI_FITUR = "ujiFitur";
const KUNCI_UJI_NYATA = "ujiIzinkanNyata";
const MODE_UJI = ["lama", "baru", "ui"];
const KET_UJI = {
  lama: "Lama: persis ekstensi sekarang. Tidak ada yang ditahan.",
  baru: "Baru: kulit Klasik + fitur yang saklarnya dinyalakan.",
  ui: "UI Baru: kulit Modern + fitur yang saklarnya dinyalakan.",
};
const ujiKeadaan = { mode: "lama", fitur: {}, nyata: false, server: null };

/**
 * Tampilan yang BERLAKU di popup - aturan sama dengan alatUjiBerlaku di
 * panel-alat.js: pilihan uji lokal Super Admin dulu, lalu tampilan yang
 * diterapkan admin (singgahan "tampilanServer"), lalu Lama. Pengalih milik
 * Super Admin tetap membaca pilihan LOKAL (ujiKeadaan.mode).
 */
function modePopupBerlaku() {
  // UIBARU-WAJIB 12 Okt: selain Super Admin, popup selalu UI Baru.
  if (popupWajibUi()) {
    const w = ujiKeadaan.server;
    return { mode: "ui", fitur: w && w.diterapkan === true && w.fitur && typeof w.fitur === "object" ? w.fitur : {} };
  }
  if (ujiKeadaan.mode !== "lama") return { mode: ujiKeadaan.mode, fitur: ujiKeadaan.fitur };
  const s = ujiKeadaan.server;
  if (s && s.diterapkan === true && MODE_UJI.includes(s.mode) && s.mode !== "lama") {
    return { mode: s.mode, fitur: s.fitur && typeof s.fitur === "object" ? s.fitur : {} };
  }
  return { mode: "lama", fitur: {} };
}

function bersihModeUji(x) {
  return MODE_UJI.includes(x) ? x : "lama";
}

/** Kulit jendela ini: Modern hanya dalam "UI Baru"; selain itu atribut dilepas. */
function terapkanKulitPopup() {
  const akar = document.documentElement;
  if (modePopupBerlaku().mode === "ui") akar.setAttribute("data-kulit", "modern");
  else akar.removeAttribute("data-kulit");
  // Susunan Tahap 2 ikut tampilan yang dipilih - lihat bagian TAHAP 2 di bawah.
  jadwalkanSusunan();
  selaraskanSaklarKotakWidget();
}

async function muatUjiPopup() {
  if (!penyimpanan) return;
  try {
    const simpan = await penyimpanan.get([KUNCI_UJI_TAMPILAN, KUNCI_UJI_FITUR, KUNCI_UJI_NYATA, "tampilanServer", KUNCI_IDENTITAS]);
    const sv = simpan && simpan.tampilanServer;
    ujiKeadaan.server = sv && typeof sv === "object" && !Array.isArray(sv) ? sv : null;
    // Golongan pegawai yang terakhir masuk - supaya kulit benar sejak gambar pertama.
    const idTersimpan = simpan && simpan[KUNCI_IDENTITAS];
    golonganTersimpan = idTersimpan && typeof idTersimpan.golongan === "string" ? idTersimpan.golongan : "";
    ujiKeadaan.mode = bersihModeUji(simpan && simpan[KUNCI_UJI_TAMPILAN]);
    const f = simpan && simpan[KUNCI_UJI_FITUR];
    ujiKeadaan.fitur = f && typeof f === "object" && !Array.isArray(f) ? { ...f } : {};
    ujiKeadaan.nyata = Boolean(simpan && simpan[KUNCI_UJI_NYATA] === true);
  } catch {
    /* tetap "lama" */
  }
  terapkanKulitPopup();
}

const ujiSiap = muatUjiPopup();

function daftarFiturUji() {
  const d = globalThis.ALETA_DAFTAR_FITUR;
  return Array.isArray(d) ? d : [];
}

function tulisKetUji() {
  const ket = document.getElementById("ujiKet");
  const barisNyata = document.getElementById("ujiNyataBaris");
  const kotakNyata = document.getElementById("ujiIzinkanNyata");
  const hitung = document.getElementById("ujiFiturHitung");
  const lama = ujiKeadaan.mode === "lama";
  if (ket) {
    const coba = lama
      ? ""
      : ujiKeadaan.nyata
        ? " Tindakan nyata DIIZINKAN - kirim dan simpan berlaku sungguhan."
        : " Mode coba: kirim WhatsApp dan simpan ke SIPP/ABT/ALETA ditahan.";
    ket.textContent = KET_UJI[ujiKeadaan.mode] + coba;
  }
  if (barisNyata) barisNyata.hidden = lama;
  if (kotakNyata) kotakNyata.checked = ujiKeadaan.nyata;
  // 13 (12 Okt sore): blok ini bawaannya diciutkan; ringkasan satu baris
  // memberi tahu tampilan yang dicoba dan apakah tindakan nyata menyala.
  const ringkasan = document.getElementById("ujiRingkasan");
  if (ringkasan) {
    const nama = { lama: "Lama", baru: "Baru", ui: "UI Baru" }[ujiKeadaan.mode] || "Lama";
    ringkasan.textContent = lama
      ? `Tampilan uji · ${nama}`
      : `Tampilan uji · ${nama} · tindakan nyata ${ujiKeadaan.nyata ? "NYALA" : "mati"}`;
    if (!lama && ujiKeadaan.nyata) ringkasan.setAttribute("data-nyata", "ya");
    else ringkasan.removeAttribute("data-nyata");
  }
  if (hitung) {
    const semua = daftarFiturUji();
    const nyala = semua.filter((x) => ujiKeadaan.fitur[x.kode] === true).length;
    hitung.textContent = `${nyala}/${semua.length} nyala${lama && nyala ? " (mati selama Lama)" : ""}`;
  }
  for (const b of document.querySelectorAll("[data-uji-mode]")) {
    b.setAttribute("aria-pressed", b.getAttribute("data-uji-mode") === ujiKeadaan.mode ? "true" : "false");
  }
}

function tulisKeadaanKotakFitur() {
  for (const k of document.querySelectorAll("#ujiFiturDaftar input[data-kode]")) {
    k.checked = ujiKeadaan.fitur[k.getAttribute("data-kode")] === true;
  }
}

function simpanFiturUji() {
  // Yang mati tidak disimpan: kunci yang tidak ada berarti bawaan (mati).
  const bersih = {};
  for (const [k, v] of Object.entries(ujiKeadaan.fitur)) if (v === true) bersih[k] = true;
  ujiKeadaan.fitur = bersih;
  if (penyimpanan) void penyimpanan.set({ [KUNCI_UJI_FITUR]: bersih });
  tulisKeadaanKotakFitur();
  tulisKetUji();
  // Saklar popup-N yang baru dinyalakan langsung tampil di jendela ini.
  jadwalkanSusunan();
}

/* === 12OKT-N: keterangan "belum ada" pada saklar fitur ide yang belum dibangun === */
/**
 * Kode saklar yang TIDAK punya pembaca di berkas ekstensi mana pun (fiturnya
 * belum dibangun). Tetap tampil di popup, diberi keterangan "belum ada" supaya
 * menyalakannya tidak disangka berfungsi. Dijaga uji ekstensi-saklar-widget-
 * audit-12okt (BELUM_DIBANGUN): fitur yang kelak dibangun keluar dari daftar ini
 * bersama daftar di uji itu.
 */
const FITUR_BELUM_ADA = new Set([
  "sipp-3", "sipp-4", "sipp-9", "sipp-12", "sipp-15", "sipp-18", "sipp-19", "sipp-20", "sipp-24", "sipp-25", "sipp-26", "sipp-28",
  "portal-15", "portal-17", "portal-21", "portal-24", "portal-30",
  "popup-25", "popup-28", "popup-29", "popup-30",
]);
/* === AKHIR 12OKT-N === */

/** Seratus dua puluh saklar, disusun sekali saat laci pertama dibuka. */
function susunDaftarFiturUji() {
  const wadah = document.getElementById("ujiFiturDaftar");
  if (!wadah || wadah.childElementCount > 0) return;
  const namaBagian = globalThis.ALETA_BAGIAN_FITUR || {};
  let bagianTerakhir = "";
  for (const x of daftarFiturUji()) {
    if (x.bagian !== bagianTerakhir) {
      bagianTerakhir = x.bagian;
      const judul = document.createElement("div");
      judul.className = "uji-bagian-judul";
      judul.textContent = namaBagian[x.bagian] || x.bagian;
      wadah.appendChild(judul);
    }
    const baris = document.createElement("label");
    baris.className = "uji-baris";
    const kotak = document.createElement("input");
    kotak.type = "checkbox";
    kotak.id = `uji-fitur-${x.kode}`;
    kotak.setAttribute("data-kode", x.kode);
    kotak.addEventListener("change", () => {
      if (kotak.checked) ujiKeadaan.fitur[x.kode] = true;
      else delete ujiKeadaan.fitur[x.kode];
      simpanFiturUji();
    });
    const teks = document.createElement("span");
    const kode = document.createElement("span");
    kode.className = "uji-kode";
    kode.textContent = `${x.kode} `;
    teks.appendChild(kode);
    teks.appendChild(document.createTextNode(x.judul));
    if (x.perluKeputusan) {
      const tanda = document.createElement("span");
      tanda.className = "uji-tanda";
      tanda.textContent = " · perlu keputusan";
      teks.appendChild(tanda);
    }
    /* === 12OKT-N: keterangan "belum ada" === */
    if (FITUR_BELUM_ADA.has(x.kode)) {
      const belum = document.createElement("span");
      belum.className = "uji-belum";
      belum.textContent = " · belum ada";
      belum.title = "Fiturnya belum dibangun; menyalakan saklar ini belum mengubah apa pun.";
      teks.appendChild(belum);
      baris.setAttribute("data-belum-ada", "ya");
      baris.title = belum.title;
    }
    /* === AKHIR 12OKT-N === */
    baris.appendChild(kotak);
    baris.appendChild(teks);
    wadah.appendChild(baris);
  }
  tulisKeadaanKotakFitur();
}

async function pasangUjiTampilan(peran) {
  const bagian = document.getElementById("bagianUji");
  const lain = document.getElementById("ujiLainBaris");
  if (!bagian) return;
  await ujiSiap;
  if (!/super/i.test(String(peran || ""))) {
    bagian.hidden = true;
    // POPUP-PERAN / UIBARU-WAJIB 12 Okt: bukan Super Admin = selalu UI Baru, tanpa
    // pengalih. Keterangan teknis "tampilan uji Super Admin sedang menyala"
    // tidak ditampilkan; pilihan uji yang tertinggal di PC ini dipulihkan ke
    // Lama (bawaan aman) dan tidak berlaku bagi akun ini.
    if (lain) lain.hidden = true;
    if (ujiKeadaan.mode !== "lama") {
      ujiKeadaan.mode = "lama";
      if (penyimpanan) void penyimpanan.set({ [KUNCI_UJI_TAMPILAN]: "lama" });
      terapkanKulitPopup();
    }
    const kembali = document.getElementById("ujiKembaliLama");
    if (kembali && !kembali.dataset.terpasang) {
      kembali.dataset.terpasang = "ya";
      kembali.addEventListener("click", () => {
        ujiKeadaan.mode = "lama";
        if (penyimpanan) void penyimpanan.set({ [KUNCI_UJI_TAMPILAN]: "lama" });
        terapkanKulitPopup();
        if (lain) lain.hidden = true;
      });
    }
    return;
  }
  if (lain) lain.hidden = true;
  if (!bagian.dataset.terpasang) {
    bagian.dataset.terpasang = "ya";
    for (const b of bagian.querySelectorAll("[data-uji-mode]")) {
      b.addEventListener("click", () => {
        ujiKeadaan.mode = bersihModeUji(b.getAttribute("data-uji-mode"));
        if (penyimpanan) void penyimpanan.set({ [KUNCI_UJI_TAMPILAN]: ujiKeadaan.mode });
        terapkanKulitPopup();
        tulisKetUji();
      });
    }
    const kotakNyata = document.getElementById("ujiIzinkanNyata");
    if (kotakNyata) {
      kotakNyata.addEventListener("change", () => {
        ujiKeadaan.nyata = kotakNyata.checked;
        void simpanSaklar({ [KUNCI_UJI_NYATA]: ujiKeadaan.nyata }, kotakNyata, () => {
          ujiKeadaan.nyata = kotakNyata.checked;
          tulisKetUji();
        });
        tulisKetUji();
      });
    }
    const laci = document.getElementById("ujiFiturLaci");
    if (laci) laci.addEventListener("toggle", () => laci.open && susunDaftarFiturUji());
    const semuaNyala = document.getElementById("ujiSemuaNyala");
    if (semuaNyala) {
      semuaNyala.addEventListener("click", () => {
        for (const x of daftarFiturUji()) ujiKeadaan.fitur[x.kode] = true;
        simpanFiturUji();
      });
    }
    const semuaMati = document.getElementById("ujiSemuaMati");
    if (semuaMati) {
      semuaMati.addEventListener("click", () => {
        ujiKeadaan.fitur = {};
        simpanFiturUji();
      });
    }
  }
  tulisKetUji();
  bagian.hidden = false;
}

/**
 * ============================================================================
 * MODE LATIHAN (IDE sipp-28, TAHAP 7) - SUPER ADMIN DAN ADMIN SAJA
 * ============================================================================
 *
 * Keputusan pengguna 29 September 2026: yang menyalakan dan mematikannya
 * hanya Super Admin dan Admin. Kuncinya "modeLatihan" di chrome.storage.local
 * - SAMA dengan yang dibaca panel-alat.js (bagian 3d), dan tab yang terbuka
 * ikut seketika lewat onChanged.
 *
 * Peran dikenali dengan aturan yang sama dengan chip peran panel
 * (alatKelasPeran): "super" lalu "admin". Peran lain tidak melihat saklarnya
 * sama sekali; bila latihan sedang menyala di PC ini, mereka hanya membaca
 * kabarnya - saklar keselamatan tidak boleh dimatikan oleh yang sedang
 * dilatih.
 *
 * Dipanggil dua kali: sekali saat jendela dibuka (peran belum diketahui -
 * hanya kabar bila menyala), sekali lagi sesudah portal menjawab siapa yang
 * masuk. Selama mati dan bukan admin, jendela ini persis seperti sebelumnya.
 */
const KUNCI_MODE_LATIHAN = "modeLatihan";
/** Jawaban portal yang datang lebih dulu tidak boleh ditimpa panggilan pembuka. */
let latihanPeranDiketahui = false;

function peranBolehLatihan(peran) {
  const p = String(peran || "").toLowerCase();
  return /super/.test(p) || /admin/.test(p);
}

async function pasangModeLatihan(peran) {
  const bagian = document.getElementById("bagianLatihan");
  const lain = document.getElementById("latihanLainBaris");
  const kotak = document.getElementById("modeLatihan");
  const ket = document.getElementById("latihanKet");
  if (!bagian || !kotak) return;
  if (peran) latihanPeranDiketahui = true;
  let nyala = false;
  try {
    const simpan = penyimpanan ? await penyimpanan.get([KUNCI_MODE_LATIHAN]) : {};
    nyala = Boolean(simpan && simpan[KUNCI_MODE_LATIHAN] === true);
  } catch {
    nyala = false;
  }
  if (!peran && latihanPeranDiketahui) return;
  if (!peranBolehLatihan(peran)) {
    bagian.hidden = true;
    if (lain) lain.hidden = !nyala;
    return;
  }
  if (lain) lain.hidden = true;
  const tulisKet = () => {
    if (!ket) return;
    ket.textContent = kotak.checked
      ? "MENYALA: medan blangko SIPP tidak diisi, Simpan tidak ditekan, dan tidak ada yang dikirim ke ALETA. Yang akan ditulis tampil di catatan latihan."
      : "Mati (bawaan). Nyalakan saat melatih petugas baru di SIPP sungguhan.";
  };
  kotak.checked = nyala;
  if (!bagian.dataset.terpasang) {
    bagian.dataset.terpasang = "ya";
    kotak.addEventListener("change", () => {
      // Saklar keselamatan: yang gagal tersimpan dikembalikan dan disebut -
      // latihan yang tampak menyala padahal tidak berarti SIPP tetap ditulis.
      void simpanSaklar({ [KUNCI_MODE_LATIHAN]: kotak.checked === true }, kotak, tulisKet);
      tulisKet();
    });
  }
  tulisKet();
  bagian.hidden = false;
}

void pasangModeLatihan("");

/* === 12OKT-F: baris "Tarik data e-Court" (SUPER ADMIN DAN ADMIN SAJA) === */
/*
 * Status penjadwal penarikan e-Court, berwarna, dan BISA DIKLIK untuk
 * menyalakan / mematikannya. Satu saklar dengan Penjadwal di Integrasi
 * e-Court; keadaannya disimpan di SERVER (bukan chrome.storage) sehingga
 * berlaku tanpa memulai ulang dan terlihat sama di PC mana pun.
 *
 * Warna dan kalimatnya DIPUTUSKAN SERVER (src/lib/tarik-ecourt-status.ts):
 * berkas ini hanya menggambar. Peran lain tidak melihat barisnya, dan rute
 * server menolak mereka sendiri (aksi "ecourt.tarik-data") - menyembunyikan
 * baris bukan penjagaan. Hanya menarik (membaca) dari e-Court yang sudah ada;
 * tidak ada yang dikirim ke e-Court.
 *
 * Dipanggil dari periksaAkunAleta SESUDAH portal menjawab siapa yang masuk -
 * tidak dari tingkat atas, sehingga tidak ada pembacaan let/const yang belum lahir.
 */
const ALAMAT_TARIK_ECOURT = "/api/aleta-ecourt/ekstensi/tarik-ecourt";
const tarikEcourt = { asal: "", ringkas: null, memuat: true, sibuk: false, tanya: "", kabar: "" };

function waktuTarikEcourt(iso) {
  const t = Date.parse(String(iso || ""));
  if (!Number.isFinite(t)) return "";
  const d = new Date(t);
  const jam = jamMenit(t);
  if (d.toDateString() === new Date().toDateString()) return `hari ini ${jam}`;
  let tgl = "";
  try {
    tgl = d.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
  } catch {
    tgl = d.toISOString().slice(0, 10);
  }
  return `${tgl} ${jam}`;
}

/** { data } bila server menjawab, { galat, status } bila tidak. Batas waktu 6 detik. */
async function panggilTarikEcourt(cara, badan) {
  const pembatal = new AbortController();
  const penghenti = setTimeout(() => pembatal.abort(), 6000);
  try {
    const r = await fetch(`${tarikEcourt.asal}${ALAMAT_TARIK_ECOURT}`, {
      method: cara,
      credentials: "include",
      cache: "no-store",
      signal: pembatal.signal,
      ...(badan ? { headers: { "content-type": "application/json" }, body: JSON.stringify(badan) } : {}),
    });
    if (r.status === 401) return { status: 401, galat: "Belum masuk portal ALETA." };
    if (r.status === 403) return { status: 403, galat: "Hanya Super Admin dan Admin." };
    if (!r.ok) return { status: r.status, galat: `Server menjawab ${r.status}.` };
    const isi = await r.json().catch(() => ({}));
    return { status: r.status, data: (isi && isi.data) || isi || {} };
  } catch (galat) {
    return { status: 0, galat: galat && galat.name === "AbortError" ? "Server tidak menjawab." : "Server tidak terjangkau." };
  } finally {
    clearTimeout(penghenti);
  }
}

function gambarTarikEcourt() {
  const bagian = document.getElementById("bagianTarikEcourt");
  const tombol = document.getElementById("tarikEcourtStatus");
  const ket = document.getElementById("tarikEcourtKet");
  const yakin = document.getElementById("tarikEcourtYakin");
  const tanya = document.getElementById("tarikEcourtTanya");
  if (!bagian || !tombol || !ket) return;
  const r = tarikEcourt.ringkas;
  const keadaan = tarikEcourt.memuat ? "memuat" : r ? r.keadaan : "tidak-terjangkau";
  bagian.setAttribute("data-keadaan", keadaan);
  tombol.textContent = tarikEcourt.memuat ? "memuat…" : r ? String(r.label || "") : "Tidak terjangkau";
  const bisaDiklik = !tarikEcourt.memuat && !tarikEcourt.sibuk && r && (r.keadaan === "mati" || r.aktif === true);
  tombol.disabled = !bisaDiklik;
  tombol.title = bisaDiklik ? (r.aktif === true ? "Klik untuk mematikan penarikan e-Court" : "Klik untuk mengaktifkan penarikan e-Court") : "";
  let teks = tarikEcourt.kabar || (r ? String(r.keterangan || "") : "");
  if (!tarikEcourt.kabar && r && r.terakhirSelesai) teks += ` Tarikan terakhir: ${waktuTarikEcourt(r.terakhirSelesai)}.`;
  else if (!tarikEcourt.kabar && r && r.aktif === true && !r.sedangJalan) teks += " Belum ada tarikan sejak server dinyalakan.";
  ket.textContent = teks.trim();
  if (yakin && tanya) {
    yakin.hidden = !tarikEcourt.tanya;
    tanya.textContent = tarikEcourt.tanya
      ? tarikEcourt.tanya === "aktifkan"
        ? "Aktifkan penarikan berkala e-Court untuk seluruh satker?"
        : "Matikan penarikan berkala e-Court untuk seluruh satker?"
      : "";
  }
}

async function ubahTarikEcourt(aktif) {
  tarikEcourt.tanya = "";
  tarikEcourt.sibuk = true;
  tarikEcourt.kabar = "Menyimpan di server…";
  gambarTarikEcourt();
  const j = await panggilTarikEcourt("POST", { aktif });
  tarikEcourt.sibuk = false;
  if (j.galat) {
    tarikEcourt.kabar = `Tidak tersimpan: ${j.galat}`;
  } else if (j.data && j.data.ringkas && typeof j.data.ringkas === "object") {
    tarikEcourt.ringkas = j.data.ringkas;
    tarikEcourt.kabar = j.data.berhasil === true ? String(j.data.pesan || "") : String(j.data.pesan || "Tidak tersimpan.");
  } else {
    tarikEcourt.kabar = "Tidak tersimpan: jawaban server tidak terbaca.";
  }
  gambarTarikEcourt();
}

async function pasangTarikEcourt(asal, peran) {
  const bagian = document.getElementById("bagianTarikEcourt");
  const tombol = document.getElementById("tarikEcourtStatus");
  if (!bagian || !tombol) return;
  if (!asal || !(popupAdmin() || peranBolehLatihan(peran))) {
    bagian.hidden = true;
    return;
  }
  tarikEcourt.asal = asal;
  if (!bagian.dataset.terpasang) {
    bagian.dataset.terpasang = "ya";
    tombol.addEventListener("click", () => {
      const r = tarikEcourt.ringkas;
      if (tarikEcourt.sibuk || tarikEcourt.memuat || !r || r.keadaan === "tidak-terjangkau") return;
      tarikEcourt.kabar = "";
      tarikEcourt.tanya = r.aktif === true ? "matikan" : "aktifkan";
      gambarTarikEcourt();
    });
    document.getElementById("tarikEcourtBatal")?.addEventListener("click", () => {
      tarikEcourt.tanya = "";
      gambarTarikEcourt();
    });
    document.getElementById("tarikEcourtYa")?.addEventListener("click", () => {
      const r = tarikEcourt.ringkas;
      if (!tarikEcourt.tanya || !r) return;
      void ubahTarikEcourt(tarikEcourt.tanya === "aktifkan");
    });
  }
  bagian.hidden = false;
  tarikEcourt.memuat = true;
  gambarTarikEcourt();
  const j = await panggilTarikEcourt("GET");
  if (j.status === 403) {
    // Server menolak peran ini: baris tidak ditampilkan sama sekali.
    bagian.hidden = true;
    return;
  }
  tarikEcourt.memuat = false;
  const r = j.data && j.data.ringkas && typeof j.data.ringkas === "object" ? j.data.ringkas : null;
  tarikEcourt.ringkas = r;
  tarikEcourt.kabar = r ? "" : j.galat || (j.data && j.data.pesan) || "Jawaban server tidak terbaca.";
  gambarTarikEcourt();
}
/* === AKHIR 12OKT-F === */

const tombolTema = document.getElementById("tombolTema");
let temaPopup = "ikut";
/** Tema panel yang sedang berlaku - bawaannya gelap, sama dengan panel. */
let temaPanelSekarang = "gelap";

function terapkanTemaPopup() {
  const akar = document.documentElement;
  // "ikut" tidak lagi berarti "tanpa atribut": ia berarti memakai tema panel.
  // Membiarkannya tanpa atribut menyerahkan warnanya kepada peramban, dan
  // itulah jendela putih di atas SIPP yang gelap.
  const berlaku = temaPopup === "ikut" ? temaPanelSekarang : temaPopup;
  akar.setAttribute("data-tema", berlaku === "terang" ? "terang" : "gelap");
  if (tombolTema) tombolTema.textContent = `tema: ${SEBUTAN_TEMA[temaPopup]}`;
}

if (penyimpanan) {
  void penyimpanan
    .get([KUNCI_TEMA_POPUP, KUNCI_TEMA_PANEL])
    .then((simpan) => {
      const tersimpan = String((simpan && simpan[KUNCI_TEMA_POPUP]) || "");
      if (URUTAN_TEMA.includes(tersimpan)) temaPopup = tersimpan;
      temaPanelSekarang = (simpan && simpan[KUNCI_TEMA_PANEL]) === "terang" ? "terang" : "gelap";
      terapkanTemaPopup();
    })
    .catch(() => terapkanTemaPopup());
} else {
  terapkanTemaPopup();
}

if (tombolTema) {
  tombolTema.title =
    "Tema ALETA - jendela ini, panel di SIPP dan ABT, dan panel di portal ALETA sekaligus";
  tombolTema.addEventListener("click", () => {
    pilihTemaPopup(URUTAN_TEMA[(URUTAN_TEMA.indexOf(temaPopup) + 1) % URUTAN_TEMA.length]);
  });
}

/**
 * Satu jalan untuk memilih tema - dipakai tombol berputar di kepala DAN
 * segmen Otomatis/Gelap/Terang (UI Baru, ide popup-5). Dua salinan aturan
 * "pilihan tegas ikut menggerakkan panel" pasti berselisih suatu hari.
 */
function pilihTemaPopup(pilihan) {
  if (!URUTAN_TEMA.includes(pilihan)) return;
  temaPopup = pilihan;
  terapkanTemaPopup();
  segarkanSusunan();
  if (!penyimpanan) return;
  void penyimpanan.set({ [KUNCI_TEMA_POPUP]: temaPopup });
  // Pilihan tegas ikut menggerakkan panel. "ikut" tidak: ia mengikuti, dan
  // yang mengikuti tidak menyuruh.
  if (temaPopup === "terang" || temaPopup === "gelap") {
    temaPanelSekarang = temaPopup;
    void penyimpanan.set({ [KUNCI_TEMA_PANEL]: temaPopup });
  }
}

// Tema yang diganti dari panel - di tab SIPP, ABT, atau portal ALETA -
// terbaca di sini seketika, selama jendela ini masih terbuka.
try {
  chrome.storage.onChanged.addListener((ubah, tempat) => {
    if (tempat !== "local" || !ubah[KUNCI_TEMA_PANEL]) return;
    temaPanelSekarang = ubah[KUNCI_TEMA_PANEL].newValue === "terang" ? "terang" : "gelap";
    terapkanTemaPopup();
  });
} catch {
  /* di luar konteks ekstensi: jendela ini memakai pilihannya sendiri */
}

/**
 * ============================================================================
 * PEMETAAN BLANGKO PUTUSAN TIDAK LAGI DI SINI
 * ============================================================================
 *
 * Dulu popup ini memuat tabel pemetaan lengkap dengan penyunting nama berkas,
 * penambah jenis, dan pengisi dari pohon blangko. Popup dibuka dari bilah
 * ekstensi dan lebarnya sebesar kartu nama; tabel belasan baris di dalamnya
 * membuat saklar-saklar yang benar-benar harian - nyalakan ALETA, tandai
 * halaman SIPP, cetak tiga berkas - terdorong jauh ke bawah gulungan.
 *
 * Lagi pula tempatnya memang bukan di sini: token hanya dapat dipanen dari
 * halaman blangko ABT, jadi separuh pekerjaannya selalu menuntut membuka ABT.
 * Yang disunting di popup selalu berupa setengah pekerjaan.
 *
 * Seluruhnya pindah ke panel PUTUSAN MASSAL di halaman ABT - satu tempat,
 * berdampingan dengan daftar blangko yang menjadi sumbernya. Panel itu pula
 * yang menyembunyikan baris yang sudah selesai.
 *
 * Kunci penyimpanannya tidak berubah (petaBlangkoPutusan), jadi pemetaan yang
 * pernah disusun lewat popup tetap terbaca panel ABT apa adanya.
 */

/**
 * ============================================================================
 * TAHAP 2: POPUP - FITUR IDE popup-N DAN SUSUNAN UI BARU
 * ============================================================================
 *
 * Rencana "ekstensi dulu", tahap 2 (29 September 2026). Tiga aturan, menurut
 * pentingnya:
 *
 *   1. Tampilan LAMA tidak disentuh sama sekali. Bagian ini tidak membuat,
 *      memindah, atau menyembunyikan apa pun selama ujiTampilan "lama" atau
 *      belum pernah disetel - apa pun isi saklar fiturnya.
 *   2. Ide popup-N (fitur) tampil dalam Baru DAN UI Baru, masing-masing hanya
 *      bila saklar kodenya menyala. Dalam Baru ia menumpang pada susunan
 *      lama: yang berdiri sendiri dikumpulkan di kartu "Fitur coba", yang
 *      mengubah sesuatu yang sudah ada dipasang di tempatnya.
 *   3. Perbaikan desain D1-D15 (brief uiux popup) hanya hidup dalam UI Baru.
 *      D6 (profil) dan D7 (senyap) SEKALIGUS fitur popup-11 dan popup-12,
 *      jadi keduanya ikut saklar fiturnya: tombol senyap yang tampil padahal
 *      panel mengabaikannya (panel-alat.js hanya menaatinya bila popup-12
 *      menyala) adalah tombol yang berbohong.
 *
 * ============================================================================
 * ELEMEN LAMA DIPINDAH, BUKAN DISALIN
 * ============================================================================
 *
 * UI Baru menyusun ulang jendela ini: saklar induk naik ke kepala, saklar lain
 * masuk kelompok berjudul, kartu pembaruan masuk "Lainnya". Yang dipindah
 * adalah ELEMEN ASLINYA - kotak centang yang sama, dengan id dan pendengar
 * yang sama - sehingga tidak ada logika saklar yang ditulis dua kali.
 *
 * Tiap pemindahan, pembuatan, dan perubahan atribut dicatat sebagai langkah;
 * pulihkanSusunan() membaliknya dari yang terakhir. Karena itu pengalih
 * Lama / Baru / UI Baru berlaku seketika tanpa memuat ulang jendela, dan
 * kembali ke Lama benar-benar mengembalikan susunan aslinya.
 *
 * Popup TIDAK mengirim apa pun ke luar: tidak ada POST. Yang dibaca hanya GET
 * (lampu sambungan), yang ditulis hanya chrome.storage.local milik ekstensi.
 */
const KUNCI_SENYAP = "senyapSampai";
const SENYAP_LAMA_MS = 60 * 60 * 1000;
const KUNCI_TANDA_BARU = "tandaBaruDilihat";

/** Ide popup-N boleh tampil? Dalam Lama tidak pernah, apa pun saklarnya. */
function fiturPopupNyala(kode) {
  const b = modePopupBerlaku();
  const k = String(kode || "");
  if (b.mode === "lama" || b.fitur[k] !== true) return false;
  // Profil peran (K4, butir 25) - aturan yang sama dengan alatFiturNyala.
  const p = profilPeranPopup();
  if (p && p.fitur && typeof p.fitur === "object" && p.fitur[k] !== true) return false;
  return true;
}

/**
 * Profil saklar peran yang BERLAKU (perbaikan 30 Sep butir 25, kontrak K4):
 * singgahan "tampilanServer" yang ditulis panel-alat.js membawa data.profil
 * dari GET /ekstensi/tampilan. Null dalam Lama, tanpa profil (server lama,
 * 404, belum masuk), dan bagi Super Admin/Admin (bolehUbahProfil) - mereka
 * tetap melihat "Profil saklar" dan mengatur saklarnya sendiri.
 */
function profilPeranPopup() {
  if (modePopupBerlaku().mode === "lama") return null;
  const s = ujiKeadaan.server;
  const p = s && s.profil;
  if (!p || typeof p !== "object" || p.bolehUbahProfil === true) return null;
  return p;
}

/** Profil peran mengatur saklar pegawai ini: "Profil saklar" tidak ditampilkan. */
function profilPeranMengaturSaklar() {
  const p = profilPeranPopup();
  return Boolean(p && p.saklar && typeof p.saklar === "object" && Object.keys(p.saklar).length);
}

/**
 * Pengganti kartu "Profil saklar" bagi pegawai yang saklarnya diatur profil
 * perannya: satu kalimat yang menyebut perannya dan siapa yang mengaturnya.
 * Saklarnya sendiri tetap di tempatnya dan tetap dapat diubah - profil hanya
 * menetapkan keadaan awal peran itu (lihat alatTerapkanProfilSaklar).
 */
function komponenProfilPeran() {
  const p = profilPeranPopup();
  const k = buat("p", "saklar-ket tb-profil-peran");
  k.id = "tbProfilPeran";
  const peran = String((p && p.peran) || "").replace(/-/g, " ");
  k.textContent =
    `Saklar disetel menurut profil peran ${peran || "Anda"}` +
    `${p && p.sumber === "admin" ? " yang diatur admin" : ""}. Mengubah satu saklar tetap boleh.`;
  return k;
}

/** Keadaan yang hanya dibaca bagian ini - dimuat sekali, lalu diikuti lewat onChanged. */
const tahap2 = { asalPortal: "", akunSipp: "", senyapSampai: 0, tandaBaru: {}, teknis: true };
const tandaBaruSesiIni = new Set();

/**
 * Perbaikan 30 Sep sore butir 3 (K5): "Sembunyikan penjelasan teknis".
 * Kuncinya sama dengan panel-alat.js (ALAT_TEKNIS_KUNCI) - popup tidak
 * memuat berkas itu, jadi namanya ditulis ulang di sini dan dijaga uji
 * ekstensi-teknis-tersembunyi supaya tidak berselisih. Belum pernah diatur =
 * NYALA.
 */
const KUNCI_TEKNIS = "sembunyikanTeknis";

async function muatTahap2() {
  if (!penyimpanan) return;
  try {
    const s = await penyimpanan.get(["asalPortal", "akunSipp", KUNCI_SENYAP, KUNCI_TANDA_BARU, KUNCI_TEKNIS]);
    tahap2.teknis = !(s && s[KUNCI_TEKNIS] === false);
    tahap2.asalPortal = String((s && s.asalPortal) || "");
    tahap2.akunSipp = String((s && s.akunSipp) || "");
    tahap2.senyapSampai = Number(s && s[KUNCI_SENYAP]) || 0;
    const t = s && s[KUNCI_TANDA_BARU];
    tahap2.tandaBaru = t && typeof t === "object" && !Array.isArray(t) ? { ...t } : {};
  } catch {
    /* tanpa bacaan: lampu menyebut "belum diketahui", tidak menebak */
  }
}

const tahap2Siap = muatTahap2();

// ── Mesin susunan: tiap langkah dicatat supaya dapat dibalik ──────────────────

const susunan = { langkah: [], penyegar: [] };
let susunanPewaktu = 0;

function jadwalkanSusunan() {
  if (susunanPewaktu) return;
  // Satu penyusunan untuk serentetan perubahan (mode dan saklar sekaligus).
  susunanPewaktu = setTimeout(() => {
    susunanPewaktu = 0;
    void terapkanSusunan();
  }, 0);
}

function buat(tag, kelas, teks) {
  const x = document.createElement(tag);
  if (kelas) x.className = kelas;
  if (teks !== undefined && teks !== null) x.textContent = teks;
  return x;
}

/** Menaruh elemen BUATAN ke halaman; dibuang lagi saat susunan dipulihkan. */
function sisipkan(el, induk, acuan) {
  if (!el || !induk) return el;
  induk.insertBefore(el, acuan || null);
  susunan.langkah.push({ jenis: "buat", el });
  return el;
}

/** Memindah elemen ASLI; tempat asalnya dicatat supaya dapat dikembalikan. */
function pindahkan(el, induk, acuan) {
  if (!el || !induk) return;
  susunan.langkah.push({ jenis: "pindah", el, induk: el.parentNode, sesudah: el.nextSibling });
  induk.insertBefore(el, acuan || null);
}

function ubahSementara(el, nama, nilai) {
  if (!el) return;
  susunan.langkah.push({ jenis: "prop", el, nama, lama: el[nama] });
  el[nama] = nilai;
}

function atributSementara(el, nama, nilai) {
  if (!el) return;
  susunan.langkah.push({ jenis: "atribut", el, nama, lama: el.getAttribute(nama) });
  el.setAttribute(nama, nilai);
}

function dengarSementara(el, tipe, fn, tangkap) {
  if (!el) return;
  el.addEventListener(tipe, fn, Boolean(tangkap));
  susunan.langkah.push({ jenis: "dengar", el, tipe, fn, tangkap: Boolean(tangkap) });
}

function pulihkanSusunan() {
  for (const x of Array.from(document.querySelectorAll("[data-cari-sembunyi]"))) {
    x.removeAttribute("data-cari-sembunyi");
  }
  // Penanda penjelasan teknis (K5) tidak dicatat sebagai langkah - ia
  // dibalik saklarnya di tempat. Lama tidak pernah memilikinya.
  document.documentElement.removeAttribute("data-aleta-teknis");
  while (susunan.langkah.length) {
    const l = susunan.langkah.pop();
    try {
      if (l.jenis === "buat") l.el.remove();
      else if (l.jenis === "pindah") {
        if (l.sesudah && l.sesudah.parentNode === l.induk) l.induk.insertBefore(l.el, l.sesudah);
        else if (l.induk) l.induk.appendChild(l.el);
      } else if (l.jenis === "prop") l.el[l.nama] = l.lama;
      else if (l.jenis === "atribut") {
        if (l.lama === null) l.el.removeAttribute(l.nama);
        else l.el.setAttribute(l.nama, l.lama);
      } else if (l.jenis === "dengar") l.el.removeEventListener(l.tipe, l.fn, l.tangkap);
    } catch {
      /* satu langkah yang gagal dibalik tidak boleh menahan yang lain */
    }
  }
  susunan.penyegar = [];
}

/** Menggambar ulang bagian yang bergantung keadaan (portal, saklar, senyap). */
function segarkanSusunan() {
  try {
    terapkanPeranPopup();
  } catch {
    /* penyaringan peran tidak boleh menahan penyegar lain */
  }
  for (const fn of susunan.penyegar.slice()) {
    try {
      fn();
    } catch {
      /* satu kartu yang gagal tidak boleh mengosongkan yang lain */
    }
  }
}

async function terapkanSusunan() {
  await tahap2Siap;
  // Dari sini sampai akhir serempak: dua panggilan tidak dapat bersilang.
  pulihkanSusunan();
  const mode = modePopupBerlaku().mode;
  if (mode === "lama") {
    terapkanPeranPopup();
    return;
  }
  atributSementara(document.documentElement, "data-susunan", mode);
  if (mode === "ui") susunUiBaru();
  else susunBaru();
  // Perbaikan 30 Sep sore butir 3 (K5): saklar penjelasan teknis, di
  // Baru DAN UI Baru, sesudah ukuran huruf panel.
  pasangSaklarTeknis();
  // Butir 25: kalimat profil peran di puncak daftar saklar.
  if (profilPeranMengaturSaklar() && popupSuperAdmin()) {
    const isi = document.querySelector(".isi");
    if (isi) sisipkan(komponenProfilPeran(), isi, isi.firstChild);
  }
  // Butir 6/26: penjelasan panjang yang masih terbuka dilipat di balik ⓘ -
  // UI Baru selalu (D2), Baru bila saklar popup-1 menyala: Baru tanpa satu
  // pun saklar popup harus tetap tanpa elemen buatan (uji popup tahap 2).
  if (mode === "ui" || fiturPopupNyala("popup-1")) lipatKetPanjang();
  simpanTandaBaru();
  segarkanSusunan();
}

// ── Perbaikan 30 Sep sore butir 3 (K5): sembunyikan penjelasan teknis ───────
//
// Satu saklar di popup (dan satu di widget checklist) untuk semua panel
// ALETA: popup hanya menulis kunci sembunyikanTeknis; panel-alat.js di tiap
// tab membacanya lewat onChanged dan memasang <html data-aleta-teknis>.
// Jendela popup ini sendiri memasang penanda yang sama untuk keterangan
// teknisnya (kelas aleta-teknis). Lama: tidak ada saklar, tidak ada penanda.

/** Penanda di jendela popup: hanya di luar Lama dan bila saklarnya nyala. */
function tandaiTeknisPopup() {
  const akar = document.documentElement;
  if (modePopupBerlaku().mode !== "lama" && tahap2.teknis) akar.setAttribute("data-aleta-teknis", "sembunyi");
  else akar.removeAttribute("data-aleta-teknis");
}

/** Menandai elemen ASLI sebagai penjelasan teknis - dibalik saat susunan dipulihkan. */
function tandaiTeknisSementara(el) {
  if (!el || !el.classList || el.classList.contains("aleta-teknis")) return;
  ubahSementara(el, "className", `${el.className} aleta-teknis`.trim());
}

function komponenTeknis() {
  const label = buat("label", "saklar w-teknis");
  label.id = "wTeknis";
  label.title = "Keterangan teknis di panel, widget, dan popup disembunyikan.";
  const kotak = buat("input");
  kotak.type = "checkbox";
  kotak.id = KUNCI_TEKNIS;
  kotak.checked = tahap2.teknis;
  const teks = buat("span");
  teks.appendChild(buat("span", "saklar-nama", "Sembunyikan penjelasan teknis"));
  teks.appendChild(buat("span", "saklar-ket", "Error, peringatan, dan konfirmasi tetap tampil."));
  label.appendChild(kotak);
  label.appendChild(teks);
  kotak.addEventListener("change", () => {
    tahap2.teknis = kotak.checked;
    simpan(KUNCI_TEKNIS, kotak.checked);
    tandaiTeknisPopup();
  });
  susunan.penyegar.push(() => {
    kotak.checked = tahap2.teknis;
  });
  return label;
}

function pasangSaklarTeknis() {
  // Sesudah "Ukuran huruf panel" - di mana pun kartu itu kini berada
  // (kelompok Tampilan dalam UI Baru, atau .isi dalam Baru).
  const skala = kartuSkalaHuruf();
  const isi = document.querySelector(".isi");
  if (skala && skala.parentNode) sisipkan(komponenTeknis(), skala.parentNode, skala.nextSibling);
  else if (isi) sisipkan(komponenTeknis(), isi, null);
  // Keterangan teknis milik popup sendiri. Pesan kabar (perbaruiKabar,
  // kabarReset) dan kalimat profil peran TIDAK - itu hasil yang dibaca.
  const pembaruan = kartuPembaruan();
  if (pembaruan) tandaiTeknisSementara(pembaruan.querySelector(":scope > .saklar-ket:not([id])"));
  if (skala) tandaiTeknisSementara(skala.querySelector(":scope > .saklar-ket"));
  const tindakan = document.querySelector(".tindakan");
  if (tindakan) tandaiTeknisSementara(tindakan.querySelector(":scope > .saklar-ket:not([id])"));
  tandaiTeknisPopup();
}

// ── Butir 6 dan 26 (perbaikan 30 Sep): penjelasan panjang di balik ⓘ ───────

/** Lebih panjang dari ini = dilipat. Sama dengan ALAT_INFO_BATAS panel. */
const POPUP_INFO_BATAS = 90;
/** Kotak kabar yang isinya berubah - bukan penjelasan, tidak pernah dilipat. */
const POPUP_KET_HIDUP = new Set(["perbaruiKabar", "kabarReset", "ujiKet", "latihanKet", "tbProfilPeran"]);

function ringkasKalimatPopup(teks) {
  const bersih = String(teks || "").replace(/\s+/g, " ").trim();
  const titik = bersih.search(/[.!?](\s|$)/);
  const kalimat = titik > 0 ? bersih.slice(0, titik + 1) : bersih;
  return kalimat.length <= 64 ? kalimat : `${kalimat.slice(0, 56).replace(/\s+\S*$/, "")}…`;
}

/**
 * Keterangan yang lebih panjang dari POPUP_INFO_BATAS: kalimat pertamanya
 * tetap tampil, sisanya di balik ⓘ yang dapat dibuka-tutup. Elemen ASLINYA
 * yang disembunyikan (ubahSementara) - kembali ke Lama memulihkannya utuh.
 * Yang sudah dilipat pasangRingkas (hidden) dan kotak kabar dilewati; yang
 * memuat tombol, tautan, atau isian tidak pernah dilipat.
 */
function lipatKetPanjang() {
  const calon = Array.from(
    document.querySelectorAll(".isi .saklar-ket, .isi .pengantar, #fiturCoba .saklar-ket, .tindakan .saklar-ket")
  );
  for (const ket of calon) {
    if (ket.hidden || POPUP_KET_HIDUP.has(ket.id) || ket.classList.contains("tb-ringkas")) continue;
    if (ket.classList.contains("tb-lipat")) continue;
    if (ket.parentElement && ket.parentElement.closest("[hidden], .tb-lipat")) continue;
    if (ket.querySelector("button, a[href], input, select, textarea")) continue;
    const teks = String(ket.textContent || "").replace(/\s+/g, " ").trim();
    if (teks.length <= POPUP_INFO_BATAS || !ket.parentNode) continue;
    // Penjelasan teknis yang dilipat (K5): ringkasannya ikut teknis.
    const kelasTeknis = ket.classList.contains("aleta-teknis") ? " aleta-teknis" : "";
    const ringkas = buat(ket.tagName === "P" ? "p" : "span", `saklar-ket tb-lipat${kelasTeknis}`, ringkasKalimatPopup(teks));
    const buka = buat("button", "tb-info tb-lipat-tombol", "ⓘ");
    buka.type = "button";
    buka.setAttribute("aria-expanded", "false");
    buka.setAttribute("aria-label", "Penjelasan lengkap");
    buka.title = "Penjelasan lengkap";
    buka.addEventListener("click", (e) => {
      // Tombol di dalam <label>: tanpa ini klik membalik saklarnya juga.
      e.preventDefault();
      e.stopPropagation();
      const terbuka = ket.hidden;
      ket.hidden = !terbuka;
      buka.setAttribute("aria-expanded", terbuka ? "true" : "false");
    });
    ringkas.appendChild(buka);
    sisipkan(ringkas, ket.parentNode, ket);
    ubahSementara(ket, "hidden", true);
  }
}

// ── Bantuan kecil ─────────────────────────────────────────────────────────────

function asalSitus() {
  try {
    return tahap2.asalPortal ? new URL(tahap2.asalPortal).origin : "";
  } catch {
    return "";
  }
}

/** Alamat beranda tiap aplikasi, dengan aturan yang sama dengan checklist.js. */
function alamatAplikasi(apa) {
  const asal = asalSitus();
  if (!asal) return "";
  if (apa === "portal") return tahap2.asalPortal;
  if (apa === "sipp") return /\/\/127\.0\.0\.1(?::|\/|$)/.test(asal) ? `${asal}/index.php/` : `${asal}/SIPP/`;
  if (apa === "abt") return `${asal}/aps_badilag/abt`;
  return "";
}

function tautanKeluar(teks, alamat, judul) {
  const a = buat("a", "tb-tautan", teks);
  if (alamat) {
    a.href = alamat;
    a.target = "_blank";
    a.rel = "noreferrer noopener";
  } else {
    a.setAttribute("aria-disabled", "true");
    a.classList.add("tb-mati");
  }
  if (judul) a.title = judul;
  return a;
}

function tombolKecil(teks, judul) {
  const b = buat("button", "uji-kecil tb-tombol", teks);
  b.type = "button";
  if (judul) b.title = judul;
  return b;
}

/** Kartu satu fitur, dengan judul dan kode fiturnya (dibaca uji dan pratinjau). */
function kartuFitur(kode, judul) {
  const k = buat("div", "tb-kartu");
  k.dataset.fitur = kode;
  const kepala = buat("div", "tb-kartu-kepala");
  const j = buat("span", "tb-kartu-judul", judul);
  kepala.appendChild(j);
  k.appendChild(kepala);
  tandaBaru(j, kode);
  return k;
}

function jamMenit(ms) {
  try {
    return new Date(ms).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

// ── popup-26: tanda BARU sekali tampil ───────────────────────────────────────
//
// Tanda itu hilang pada pembukaan BERIKUTNYA, bukan sedetik sesudah tampil:
// yang sudah digambar di jendela ini tetap bertanda sampai jendelanya
// ditutup, walau susunannya digambar ulang karena saklar lain berubah.

function tandaBaru(el, kode) {
  if (!fiturPopupNyala("popup-26") || !el) return;
  if (tahap2.tandaBaru[kode] === true && !tandaBaruSesiIni.has(kode)) return;
  tandaBaruSesiIni.add(kode);
  const t = buat("span", "tb-baru", "BARU");
  t.title = "Baru di popup ini - tanda ini hilang pada pembukaan berikutnya";
  // Lewat sisipkan: induknya bisa elemen ASLI (nama kartu ukuran huruf).
  sisipkan(t, el, null);
}

function simpanTandaBaru() {
  if (!tandaBaruSesiIni.size || !penyimpanan) return;
  const baru = { ...tahap2.tandaBaru };
  let berubah = false;
  for (const k of tandaBaruSesiIni) {
    if (baru[k] !== true) {
      baru[k] = true;
      berubah = true;
    }
  }
  if (!berubah) return;
  tahap2.tandaBaru = baru;
  void penyimpanan.set({ [KUNCI_TANDA_BARU]: baru });
}

// ── popup-1 / D2: keterangan satu baris, uraian lengkap tetap ada ────────────

const RINGKAS_SAKLAR = {
  aktif: "Saklar induk: mati = tidak ada apa pun dari ALETA.",
  tandaiHalaman: "Penanda ghaib, izin atasan, verzet, prodeo, panjar.",
  checklistMilestone: "Widget kiri bawah: pekerjaan penting peran Anda.",
  widgetKehadiran: "Di widget: siapa yang sudah hadir di sidang Anda hari ini.",
  widgetDrafH7: "Di widget: kesiapan draf putusan Anda tujuh hari ke depan.",
  suntingLangsungAbt: "Mati: sel ABT tak bisa disunting. Nyala: klik dua kali.",
  cetakTigaBerkas: "Putusan .rtf + PDF + anonim .rtf · bawaan mati.",
  sisipJadwal: "Jawaban, replik, duplik di baris sidangnya.",
};

/**
 * Uraian panjang tiap saklar DILIPAT, tidak dibuang: tombol ⓘ (UI Baru) atau
 * "selengkapnya" (Baru) membentangkan span keterangan yang asli.
 */
function pasangRingkas(gayaUi) {
  for (const [id, pendek] of Object.entries(RINGKAS_SAKLAR)) {
    const kotak = document.getElementById(id);
    const label = kotak ? kotak.closest("label.saklar") : null;
    if (!label) continue;
    const teks = label.querySelector(":scope > span");
    const ket = teks ? teks.querySelector(":scope > .saklar-ket") : null;
    const nama = teks ? teks.querySelector(":scope > .saklar-nama") : null;
    if (!ket || !nama) continue;
    const ringkas = buat("span", "saklar-ket tb-ringkas", pendek);
    sisipkan(ringkas, teks, ket);
    ubahSementara(ket, "hidden", true);
    const buka = buat("button", "tb-info", gayaUi ? "i" : "selengkapnya ▸");
    buka.type = "button";
    buka.setAttribute("aria-expanded", "false");
    buka.setAttribute("aria-label", `Uraian lengkap: ${nama.textContent.trim()}`);
    buka.title = "Uraian lengkap";
    buka.addEventListener("click", (e) => {
      // Tombol di dalam <label>: tanpa ini klik membalik saklarnya juga.
      e.preventDefault();
      e.stopPropagation();
      const terbuka = ket.hidden;
      ket.hidden = !terbuka;
      buka.setAttribute("aria-expanded", terbuka ? "true" : "false");
      if (!gayaUi) buka.textContent = terbuka ? "ringkas ▴" : "selengkapnya ▸";
    });
    if (gayaUi) sisipkan(buka, nama, null);
    else sisipkan(buka, teks, ket);
  }
}

// ── popup-3 / D1: kelompok berjudul ──────────────────────────────────────────

const KELOMPOK_SAKLAR = [
  { kode: "tampilan", judul: "Tampilan", isi: [] },
  { kode: "sipp", judul: "SIPP", isi: ["tandaiHalaman", "sisipJadwal"] },
  { kode: "abt", judul: "ABT", isi: ["suntingLangsungAbt", "cetakTigaBerkas", "gembokAbt"] },
  { kode: "portal", judul: "Portal", isi: ["checklistMilestone", "widgetKehadiran", "widgetDrafH7"] },
];

function kartuSkalaHuruf() {
  const n = document.getElementById("skalaNilai");
  return n ? n.closest(".skala") : null;
}

function kartuPembaruan() {
  const t = document.getElementById("perbaruiSekarang");
  return t ? t.closest(".skala") : null;
}

/** Menyusun kelompok di .isi, sebelum kartu pembaruan. Mengembalikan wadah per kode. */
function kelompokkanSaklar() {
  const isi = document.querySelector(".isi");
  const wadah = {};
  if (!isi) return wadah;
  const acuan = kartuPembaruan();
  for (const k of KELOMPOK_SAKLAR) {
    const sek = buat("section", "tb-kelompok");
    sek.id = `kelompok-${k.kode}`;
    sek.dataset.kelompok = k.kode;
    sek.appendChild(buat("h3", "tb-kelompok-judul", k.judul));
    sisipkan(sek, isi, acuan && acuan.parentNode === isi ? acuan : null);
    wadah[k.kode] = sek;
    for (const id of k.isi) {
      const kotak = document.getElementById(id);
      const label = kotak ? kotak.closest("label.saklar") : null;
      if (label) pindahkan(label, sek, null);
    }
  }
  pindahkan(kartuSkalaHuruf(), wadah.tampilan, null);
  return wadah;
}

/** popup-3: tombol lompat ke tiap kelompok. */
function komponenLompat() {
  const baris = buat("div", "tb-lompat");
  baris.dataset.fitur = "popup-3";
  baris.setAttribute("role", "navigation");
  baris.setAttribute("aria-label", "Lompat ke kelompok saklar");
  for (const k of KELOMPOK_SAKLAR) {
    const b = buat("button", "tb-chip", k.judul);
    b.type = "button";
    b.addEventListener("click", () => {
      const sasaran = document.getElementById(`kelompok-${k.kode}`);
      if (sasaran && typeof sasaran.scrollIntoView === "function") sasaran.scrollIntoView({ block: "start", behavior: "smooth" });
    });
    baris.appendChild(b);
  }
  return baris;
}

// ── popup-15: kotak cari saklar ──────────────────────────────────────────────

function komponenCari() {
  const k = buat("div", "tb-cari");
  k.dataset.fitur = "popup-15";
  const masukan = buat("input", "tb-cari-isi");
  masukan.type = "search";
  masukan.id = "tbCariSaklar";
  masukan.placeholder = "Cari saklar… (mis. \"cetak\")";
  masukan.setAttribute("aria-label", "Cari saklar");
  const kosong = buat("p", "saklar-ket tb-cari-kosong", "Tidak ada saklar yang cocok.");
  kosong.hidden = true;
  masukan.addEventListener("input", () => {
    const cari = masukan.value.trim().toLowerCase();
    const butir = Array.from(document.querySelectorAll(".isi label.saklar, .isi .skala, .isi [data-cari]"));
    let ada = 0;
    for (const x of butir) {
      if (x.hidden || x.hasAttribute("data-peran-sembunyi")) continue;
      const cocok = !cari || x.textContent.toLowerCase().includes(cari);
      if (cocok) {
        x.removeAttribute("data-cari-sembunyi");
        ada += 1;
        // Yang cocok di dalam laci "Lainnya" tidak boleh tetap terlipat.
        const laci = x.closest("details");
        if (cari && laci) laci.open = true;
      } else x.setAttribute("data-cari-sembunyi", "ya");
    }
    for (const g of Array.from(document.querySelectorAll(".tb-kelompok"))) {
      const tampil = Array.from(g.querySelectorAll("label.saklar, .skala, [data-cari]")).some(
        (x) => !x.hidden && !x.hasAttribute("data-cari-sembunyi")
      );
      if (tampil || !cari) g.removeAttribute("data-cari-sembunyi");
      else g.setAttribute("data-cari-sembunyi", "ya");
    }
    kosong.hidden = !cari || ada > 0;
  });
  k.appendChild(masukan);
  k.appendChild(kosong);
  return k;
}

// ── popup-11 / D6: profil saklar per peran ───────────────────────────────────
//
// USULAN - menunggu konfirmasi isi tiap profil (lihat laporan Tahap 2):
//
//   Hakim              tandai ✓  sisip jadwal ✓  CETAK 3 berkas ✗  checklist ✓
//   Panitera Pengganti tandai ✓  sisip jadwal ✓  CETAK 3 berkas ✓  checklist ✓
//   Juru Sita          tandai ✓  sisip jadwal ✗  CETAK 3 berkas ✗  checklist ✓
//
// "Sunting sekali klik di ABT" MATI di ketiganya: satu klik salah sasaran
// membuka isian di atas nilai yang benar, dan itu keputusan orangnya sendiri.
// Saklar induk tidak disentuh profil mana pun - profil mengatur ALETA yang
// menyala, bukan menyalakan atau mematikannya.
const PROFIL_GOLONGAN = {
  // saklar = keadaan awal; panel = panel yang terbuka saat halaman dibuka;
  // relevan = saklar yang ditampilkan popup bagi golongan itu (12 Okt).
  ketua: {
    nama: "Ketua",
    saklar: { tandaiHalaman: true, sisipJadwal: true, cetakTigaBerkas: false, suntingLangsungAbt: false, checklistMilestone: true },
    panel: { aleta: false, sipp: true, abt: true },
    relevan: ["tandaiHalaman", "sisipJadwal", "cetakTigaBerkas", "suntingLangsungAbt", "checklistMilestone"],
  },
  hakim: {
    nama: "Hakim",
    saklar: { tandaiHalaman: true, sisipJadwal: true, cetakTigaBerkas: false, suntingLangsungAbt: false, checklistMilestone: true },
    panel: { aleta: false, sipp: true, abt: true },
    relevan: ["tandaiHalaman", "sisipJadwal", "cetakTigaBerkas", "suntingLangsungAbt", "checklistMilestone"],
  },
  "panitera-pengganti": {
    nama: "Panitera Pengganti",
    saklar: { tandaiHalaman: true, sisipJadwal: true, cetakTigaBerkas: true, suntingLangsungAbt: false, checklistMilestone: true },
    panel: { aleta: false, sipp: true, abt: true },
    relevan: ["tandaiHalaman", "sisipJadwal", "cetakTigaBerkas", "suntingLangsungAbt", "checklistMilestone"],
  },
  "juru-sita": {
    nama: "Juru Sita",
    saklar: { tandaiHalaman: true, sisipJadwal: false, cetakTigaBerkas: false, suntingLangsungAbt: false, checklistMilestone: true },
    panel: { aleta: false, sipp: true, abt: true },
    relevan: ["tandaiHalaman", "checklistMilestone"],
  },
  panitera: {
    nama: "Panitera / Panmud",
    saklar: { tandaiHalaman: true, sisipJadwal: false, cetakTigaBerkas: false, suntingLangsungAbt: false, checklistMilestone: true },
    panel: { aleta: false, sipp: true, abt: true },
    relevan: ["tandaiHalaman", "sisipJadwal", "checklistMilestone"],
  },
  kasir: {
    nama: "Kasir",
    saklar: { tandaiHalaman: false, sisipJadwal: false, cetakTigaBerkas: false, suntingLangsungAbt: false, checklistMilestone: true },
    panel: { aleta: false, sipp: true, abt: false },
    relevan: ["checklistMilestone"],
  },
  ptsp: {
    nama: "PTSP",
    saklar: { tandaiHalaman: true, sisipJadwal: false, cetakTigaBerkas: false, suntingLangsungAbt: false, checklistMilestone: true },
    panel: { aleta: false, sipp: true, abt: false },
    relevan: ["tandaiHalaman", "checklistMilestone"],
  },
  mediator: {
    nama: "Mediator",
    saklar: { tandaiHalaman: true, sisipJadwal: true, cetakTigaBerkas: false, suntingLangsungAbt: false, checklistMilestone: true },
    panel: { aleta: false, sipp: true, abt: false },
    relevan: ["tandaiHalaman", "sisipJadwal", "checklistMilestone"],
  },
  operator: {
    nama: "Operator",
    saklar: { tandaiHalaman: true, sisipJadwal: false, cetakTigaBerkas: false, suntingLangsungAbt: false, checklistMilestone: false },
    panel: { aleta: false, sipp: true, abt: false },
    relevan: ["tandaiHalaman", "checklistMilestone"],
  },
  umum: {
    nama: "Pegawai",
    saklar: { tandaiHalaman: true, sisipJadwal: false, cetakTigaBerkas: false, suntingLangsungAbt: false, checklistMilestone: true },
    panel: { aleta: false, sipp: true, abt: true },
    relevan: ["tandaiHalaman", "checklistMilestone"],
  },
};

/** Tombol profil di kartu "Profil saklar" (Super Admin dan Admin): satu per golongan. */
const PROFIL_SAKLAR = [
  { kode: "hakim", nama: "Hakim", golongan: "hakim" },
  { kode: "pp", nama: "Panitera Pengganti", pendek: "PP", golongan: "panitera-pengganti" },
  { kode: "jurusita", nama: "Juru Sita", golongan: "juru-sita" },
  { kode: "panitera", nama: "Panitera / Panmud", pendek: "Panitera", golongan: "panitera" },
  { kode: "kasir", nama: "Kasir", golongan: "kasir" },
  { kode: "ptsp", nama: "PTSP", golongan: "ptsp" },
  { kode: "mediator", nama: "Mediator", golongan: "mediator" },
  { kode: "operator", nama: "Operator", golongan: "operator" },
].map((p) => ({ ...p, saklar: PROFIL_GOLONGAN[p.golongan].saklar, panel: PROFIL_GOLONGAN[p.golongan].panel }));

/** Profil yang cocok dengan saklar sekarang; "kustom" bila tidak ada. Yang tercatat untuk akun ini didahulukan. */
function profilSekarang() {
  const cocok = (p) =>
    Object.entries(p.saklar).every(([id, nilai]) => {
      const k = document.getElementById(id);
      return k && k.checked === nilai;
    });
  const dicatat = PROFIL_SAKLAR.find((p) => p.kode === rekamAkunPopup.profil);
  if (dicatat && cocok(dicatat)) return dicatat.kode;
  // Belum ada profil yang dipilih untuk akun ini: kombinasi bawaan kebetulan sama
  // dengan satu profil (mis. Operator) - tidak boleh tampak sebagai pilihan.
  if (!rekamAkunPopup.profil) return "kustom";
  for (const p of PROFIL_SAKLAR) if (cocok(p)) return p.kode;
  return "kustom";
}

function saklarSekarangPopup() {
  const hasil = {};
  for (const id of SAKLAR_PROFIL_ID) {
    const k = document.getElementById(id);
    if (k) hasil[id] = k.checked;
  }
  return hasil;
}

/** Panel yang terbuka saat halaman dibuka, sebagaimana berlaku sekarang. */
async function panelSekarangPopup() {
  let lokal = null;
  try {
    const s = penyimpanan ? await penyimpanan.get([KUNCI_BAWAAN_PANEL]) : {};
    lokal = s && s[KUNCI_BAWAAN_PANEL] && typeof s[KUNCI_BAWAAN_PANEL] === "object" ? s[KUNCI_BAWAAN_PANEL] : null;
  } catch {
    lokal = null;
  }
  const b = bawaanPanelBerlaku(lokal, bawaanPanelServer());
  return { aleta: b.aleta !== false, sipp: b.sipp !== false, abt: b.abt !== false };
}

/** Menyetel saklar lewat KOTAK CENTANG ASLINYA, dengan peristiwa change. */
function setelSaklarPopup(peta) {
  for (const [id, nilai] of Object.entries(peta || {})) {
    const k = document.getElementById(id);
    if (!k || k.checked === nilai) continue;
    k.checked = nilai;
    k.dispatchEvent(new Event("change", { bubbles: true }));
  }
}

/**
 * Menyetel saklar lewat KOTAK CENTANG ASLINYA, dengan peristiwa change -
 * sehingga yang menyimpan tetap pendengar lama, satu-satunya penulis kunci
 * itu. Tidak ada salinan aturan simpan di sini.
 *
 * 12 Okt: profil juga menyetel PANEL yang terbuka saat halaman dibuka, dan
 * "Kustom" memulihkan setelan sendiri yang diingat sebelum profil dicoba.
 */
function terapkanProfil(kode) {
  if (kode === "kustom") {
    const k = rekamAkunPopup.kustom;
    if (!k || !k.saklar) return;
    setelSaklarPopup(k.saklar);
    void ubahRekamAkun({ profil: "kustom" });
    if (k.panel) {
      void simpanBawaanPanel(k.panel).then(() => kabarkanPanelPopup());
    }
    segarkanSusunan();
    return;
  }
  const p = PROFIL_SAKLAR.find((x) => x.kode === kode);
  if (!p) return;
  const kustomSaklar = profilSekarang() === "kustom" ? saklarSekarangPopup() : null;
  const panelLama = kustomSaklar ? panelSekarangPopup() : null;
  // Diingat SEKARANG (serempak): "Kustom" yang ditekan segera sesudahnya sudah punya isi.
  if (kustomSaklar) rekamAkunPopup = { ...rekamAkunPopup, kustom: { saklar: kustomSaklar, panel: null } };
  rekamAkunPopup = { ...rekamAkunPopup, profil: kode };
  setelSaklarPopup(p.saklar);
  void (async () => {
    if (kustomSaklar) await ubahRekamAkun({ kustom: { saklar: kustomSaklar, panel: await panelLama } });
    await ubahRekamAkun({ profil: kode });
    await simpanBawaanPanel(p.panel);
    kabarkanPanelPopup();
  })();
  segarkanSusunan();
}

function komponenProfil() {
  const k = kartuFitur("popup-11", "Profil saklar");
  k.id = "tbProfil";
  const seg = buat("div", "uji-seg tb-seg");
  seg.setAttribute("role", "group");
  seg.setAttribute("aria-label", "Profil saklar per peran");
  seg.style.flexWrap = "wrap";
  const tombol = [];
  for (const p of [...PROFIL_SAKLAR, { kode: "kustom", nama: "Kustom" }]) {
    // "PP", bukan "Panitera Pengganti": empat tombol sebaris di kartu selebar
    // 270 piksel - nama lengkapnya memotong "Kustom". Nama lengkap di title.
    const b = buat("button", "", p.pendek || p.nama);
    b.type = "button";
    b.dataset.profil = p.kode;
    if (p.saklar) b.title = `Setel saklar dan panel untuk ${p.nama}`;
    else b.title = "Kembali ke setelan Anda sendiri (diingat sebelum profil dicoba)";
    b.addEventListener("click", () => terapkanProfil(p.kode));
    seg.appendChild(b);
    tombol.push(b);
  }
  const ket = buat(
    "p",
    "saklar-ket aleta-teknis",
    "Menyetel lima saklar dan panel yang terbuka sekaligus; saklar induk tidak disentuh. Ubah satu saklar → Kustom."
  );
  k.appendChild(seg);
  k.appendChild(ket);
  const segarkan = () => {
    const kini = profilSekarang();
    for (const b of tombol) b.setAttribute("aria-pressed", b.dataset.profil === kini ? "true" : "false");
  };
  susunan.penyegar.push(segarkan);
  for (const id of Object.keys(PROFIL_SAKLAR[0].saklar)) dengarSementara(document.getElementById(id), "change", segarkan);
  return k;
}

// ── D13 / popup-5: tema Otomatis / Gelap / Terang ────────────────────────────

const PILIHAN_TEMA = [
  ["ikut", "Otomatis", "Ikut tema panel ALETA di SIPP, ABT, dan portal"],
  ["gelap", "Gelap", "Popup dan semua panel gelap"],
  ["terang", "Terang", "Popup dan semua panel terang"],
];

function komponenTema(denganContoh, sebagaiKartu) {
  const k = sebagaiKartu ? kartuFitur("popup-5", "Tema - popup dan panel sekaligus") : buat("div", "tb-baris-set");
  k.id = "tbTema";
  k.dataset.cari = "tema";
  if (!sebagaiKartu) k.appendChild(buat("span", "saklar-nama", "Tema"));
  const seg = buat("div", `uji-seg tb-seg${denganContoh ? " tb-seg-contoh" : ""}`);
  seg.setAttribute("role", "group");
  seg.setAttribute("aria-label", "Tema ALETA");
  const tombol = [];
  for (const [kode, nama, judul] of PILIHAN_TEMA) {
    const b = buat("button", "");
    b.type = "button";
    b.dataset.temaPilih = kode;
    b.title = judul;
    if (denganContoh) {
      const contoh = buat("span", `tb-contoh-tema tb-contoh-${kode}`);
      contoh.setAttribute("aria-hidden", "true");
      b.appendChild(contoh);
    }
    b.appendChild(document.createTextNode(nama));
    b.addEventListener("click", () => pilihTemaPopup(kode));
    seg.appendChild(b);
    tombol.push(b);
  }
  k.appendChild(seg);
  susunan.penyegar.push(() => {
    for (const b of tombol) b.setAttribute("aria-pressed", b.dataset.temaPilih === temaPopup ? "true" : "false");
  });
  return k;
}

// ── popup-4: penggeser ukuran huruf dengan pratinjau ─────────────────────────

function pasangGeserSkala() {
  const kartu = kartuSkalaHuruf();
  if (!kartu) return;
  const wadah = buat("div", "tb-geser");
  wadah.dataset.fitur = "popup-4";
  const geser = buat("input", "tb-geser-isi");
  geser.type = "range";
  geser.id = "skalaGeser";
  // Batasnya SAMA dengan tombol - dan +: menyempitkannya ke 140% berarti
  // mengambil 150% dan 160% dari yang sudah memakainya.
  geser.min = String(SKALA_MIN);
  geser.max = String(SKALA_MAKS);
  geser.step = String(SKALA_LANGKAH);
  geser.setAttribute("aria-label", "Ukuran huruf panel");
  geser.addEventListener("input", () => setelSkala(Number(geser.value)));
  const pratinjau = buat("div", "tb-pratinjau");
  pratinjau.id = "skalaPratinjau";
  pratinjau.setAttribute("aria-hidden", "true");
  pratinjau.appendChild(buat("span", "tb-lencana-awas", "panjar menipis"));
  pratinjau.appendChild(document.createTextNode(" 492/Pdt.G/2026 · sidang ke-2"));
  wadah.appendChild(geser);
  wadah.appendChild(pratinjau);
  sisipkan(wadah, kartu, null);
  tandaBaru(kartu.querySelector(":scope > .saklar-nama"), "popup-4");
  gambarSkala();
}

/** D5: tombol − kembalikan + menjadi segmen A− A A+ (tombol yang SAMA). */
function pasangSkalaSegmen() {
  const kurang = document.getElementById("skalaKurang");
  const tambah = document.getElementById("skalaTambah");
  const pulih = document.getElementById("skalaPulih");
  const nilai = document.getElementById("skalaNilai");
  const atur = kurang ? kurang.parentNode : null;
  if (!atur || !tambah || !pulih || !nilai) return;
  atributSementara(atur, "data-ui", "seg");
  ubahSementara(kurang, "textContent", "A−");
  ubahSementara(tambah, "textContent", "A+");
  ubahSementara(pulih, "textContent", "A");
  ubahSementara(pulih, "title", "Ukuran bawaan (100%)");
  pindahkan(pulih, atur, tambah);
  pindahkan(nilai, atur, null);
}

// ── popup-12 / D7: senyap 1 jam ──────────────────────────────────────────────
//
// Popup hanya MENULIS saat berakhirnya (senyapSampai); yang menyembunyikan
// panel, penanda, dan widget adalah panel-alat.js bagian 3c, di tiap tab.

function tulisSenyap(sampai) {
  tahap2.senyapSampai = sampai;
  if (penyimpanan) void penyimpanan.set({ [KUNCI_SENYAP]: sampai });
  segarkanSusunan();
}

function komponenSenyap() {
  const k = buat("div", "tb-senyap");
  k.dataset.fitur = "popup-12";
  const tombol = buat("button", "tombol-reset tb-senyap-tombol", "◷ Senyapkan 1 jam");
  tombol.type = "button";
  tombol.id = "tbSenyap";
  tombol.title = "Sembunyikan panel, penanda, dan widget selama 1 jam; muncul lagi sendiri. ALETA tetap aktif.";
  tombol.addEventListener("click", () => tulisSenyap(Date.now() + SENYAP_LAMA_MS));
  const pita = buat("div", "tb-pita");
  pita.hidden = true;
  const teks = buat("span", "tb-pita-teks");
  const akhiri = tombolKecil("Akhiri senyap", "Tampilkan lagi panel, penanda, dan widget sekarang");
  akhiri.id = "tbAkhiriSenyap";
  akhiri.addEventListener("click", () => tulisSenyap(0));
  pita.appendChild(teks);
  pita.appendChild(akhiri);
  k.appendChild(tombol);
  k.appendChild(pita);
  tandaBaru(tombol, "popup-12");
  susunan.penyegar.push(() => {
    const aktif = tahap2.senyapSampai > Date.now();
    pita.hidden = !aktif;
    tombol.hidden = aktif;
    if (aktif) teks.textContent = `Disenyapkan sampai ${jamMenit(tahap2.senyapSampai)} - panel, penanda, dan widget tersembunyi.`;
  });
  return k;
}

// ── popup-13: kembalikan posisi panel DAN widget, dengan pilihan ─────────────
//
// Bawaannya keduanya tercentang, dan saat itu tombol lama bekerja persis
// seperti biasa (pendengarnya tidak disentuh). Hanya bila salah satunya
// dilepas, pendengar tangkap di bawah mengambil alih dan menghapus sebagian.

function pasangPilihanPosisi() {
  const tombol = document.getElementById("resetPosisi");
  if (!tombol) return;
  const baris = buat("div", "tb-posisi-pilih");
  baris.dataset.fitur = "popup-13";
  const pilih = {};
  for (const [kode, teks] of [
    ["panel", "panel & lencana"],
    ["widget", "widget checklist"],
  ]) {
    const label = buat("label", "tb-cek");
    const kotak = buat("input");
    kotak.type = "checkbox";
    kotak.checked = true;
    kotak.id = `tbPosisi-${kode}`;
    label.appendChild(kotak);
    label.appendChild(document.createTextNode(` ${teks}`));
    baris.appendChild(label);
    pilih[kode] = kotak;
  }
  const ket = buat("span", "saklar-ket tb-posisi-ket", "SIPP, ABT, dan portal sekaligus.");
  baris.appendChild(ket);
  sisipkan(baris, tombol.parentNode, tombol.nextSibling);
  tandaBaru(ket, "popup-13");
  dengarSementara(
    tombol,
    "click",
    (e) => {
      const panel = pilih.panel.checked;
      const widget = pilih.widget.checked;
      if (panel && widget) return; // jalan lama, utuh
      e.stopImmediatePropagation();
      e.preventDefault();
      const kabar = document.getElementById("kabarReset");
      const tulis = (t) => {
        if (!kabar) return;
        kabar.textContent = t;
        kabar.hidden = false;
      };
      if (!panel && !widget) {
        tulis("Tidak ada yang dipilih - centang panel, widget, atau keduanya.");
        return;
      }
      if (!penyimpanan) {
        tulis("Penyimpanan ekstensi tidak tersedia di jendela ini.");
        return;
      }
      // sudutWidget (popup-9) milik WIDGET checklist: tanpanya "hanya widget"
      // membiarkan widget kembali ke sudut lama, dan "hanya panel" justru
      // memindahkan widget yang katanya dibiarkan (uji rilis U2c 9 Okt 2026).
      const milikWidget = (k) => k.startsWith("posisiChecklist") || k === "sudutWidget";
      const kunci = KUNCI_LETAK_PANEL.filter((k) => (milikWidget(k) ? widget : panel));
      tombol.disabled = true;
      void penyimpanan
        .remove(kunci)
        .then(() =>
          tulis(
            panel
              ? "Posisi panel dikembalikan - SIPP, ABT, dan portal ALETA. Widget checklist dibiarkan di tempatnya."
              : "Widget checklist kembali ke kiri bawah di SIPP, ABT, dan portal. Panel dibiarkan di tempatnya."
          )
        )
        .catch(() => tulis("Gagal mengembalikan posisi. Coba lagi."))
        .finally(() => {
          tombol.disabled = false;
        });
    },
    true
  );
}

// ── popup-2: lampu sambungan per situs (GET saja) ────────────────────────────

const lampuSitus = { sipp: { keadaan: "belum", ket: "" }, abt: { keadaan: "belum", ket: "" } };
let lampuPada = 0;

/**
 * GET ke beranda SIPP dan ABT. Hanya membaca: halaman yang sama yang terbuka
 * bila orangnya mengetik alamatnya sendiri. Izin host sudah ada di manifest
 * (192.168.10.10 dan 127.0.0.1), jadi tidak ada izin baru.
 *
 * Alamat yang berakhir di halaman masuk dihitung "belum masuk", bukan
 * "tersambung": servernya hidup, tetapi pekerjaan di sana belum dapat jalan.
 */
async function periksaSatuSitus(kode) {
  const alamat = alamatAplikasi(kode);
  if (!alamat) {
    lampuSitus[kode] = { keadaan: "belum", ket: "alamat belum diketahui - buka halaman SIPP dulu" };
    return;
  }
  const pembatal = new AbortController();
  const penghenti = setTimeout(() => pembatal.abort(), 4000);
  try {
    const r = await fetch(alamat, { method: "GET", credentials: "include", cache: "no-store", signal: pembatal.signal });
    const akhir = String(r.url || "");
    if (!r.ok) lampuSitus[kode] = { keadaan: "putus", ket: `menjawab ${r.status}` };
    else if (/login|masuk|signin/i.test(akhir)) lampuSitus[kode] = { keadaan: "awas", ket: "belum masuk" };
    else lampuSitus[kode] = { keadaan: "ok", ket: "tersambung" };
  } catch (galat) {
    lampuSitus[kode] = {
      keadaan: "putus",
      ket: galat && galat.name === "AbortError" ? "tidak menjawab" : "tidak terjangkau",
    };
  } finally {
    clearTimeout(penghenti);
  }
}

async function periksaLampu(ulangPortal) {
  lampuSitus.sipp = { keadaan: "memuat", ket: "memeriksa…" };
  lampuSitus.abt = { keadaan: "memuat", ket: "memeriksa…" };
  segarkanSusunan();
  if (ulangPortal) void periksaAkunAleta(tahap2.asalPortal);
  await Promise.all([periksaSatuSitus("sipp"), periksaSatuSitus("abt")]);
  lampuPada = Date.now();
  segarkanSusunan();
}

/** Keempat lampu dalam satu bentuk: [kode, nama, keadaan, keterangan, alamat perbaikan]. */
function daftarLampu() {
  const p = keadaanPortal;
  const server = !p.selesai
    ? ["memuat", "memeriksa…"]
    : p.server === "ok"
      ? ["ok", "menjawab"]
      : p.server === "putus"
        ? ["putus", p.pesan || "tidak menjawab"]
        : ["belum", "alamat belum diketahui"];
  const portal = !p.selesai
    ? ["memuat", "memeriksa…"]
    : p.masuk
      ? ["ok", p.nama || "masuk"]
      : p.server === "ok"
        ? ["awas", "belum masuk"]
        : ["putus", "tidak dapat diperiksa"];
  const masukPortal = tahap2.asalPortal ? `${tahap2.asalPortal}/login` : "";
  return [
    ["sipp", "SIPP", lampuSitus.sipp.keadaan, tahap2.akunSipp && lampuSitus.sipp.keadaan === "ok" ? tahap2.akunSipp : lampuSitus.sipp.ket, alamatAplikasi("sipp")],
    ["abt", "ABT", lampuSitus.abt.keadaan, lampuSitus.abt.ket, alamatAplikasi("abt")],
    ["portal", "Portal", portal[0], portal[1], masukPortal],
    ["server", "Server", server[0], server[1], masukPortal],
  ];
}

function komponenLampu(sebagaiKartu) {
  const k = sebagaiKartu ? kartuFitur("popup-2", "Sambungan") : buat("div", "tb-lampu-wadah");
  k.id = "tbLampu";
  if (!sebagaiKartu) k.dataset.fitur = "popup-2";
  const daftar = buat("ul", "tb-lampu");
  const kaki = buat("div", "tb-lampu-kaki");
  const waktu = buat("span", "saklar-ket tb-lampu-waktu aleta-teknis");
  const ulang = tombolKecil("Periksa ulang", "Periksa lagi SIPP, ABT, portal, dan server");
  ulang.addEventListener("click", () => void periksaLampu(true));
  kaki.appendChild(waktu);
  kaki.appendChild(ulang);
  k.appendChild(daftar);
  k.appendChild(kaki);
  susunan.penyegar.push(() => {
    daftar.textContent = "";
    for (const [kode, nama, keadaan, ket, alamat] of daftarLampu()) {
      const li = buat("li", "tb-lampu-baris");
      li.dataset.situs = kode;
      li.dataset.keadaan = keadaan;
      const titik = buat("span", `tb-titik tb-titik-${keadaan}`);
      titik.setAttribute("aria-hidden", "true");
      li.appendChild(titik);
      li.appendChild(buat("b", "", nama));
      li.appendChild(buat("span", "tb-lampu-ket", ket));
      if (keadaan === "putus" || keadaan === "awas") {
        // Perbaiki = membuka halaman masuknya; server yang mati tidak dapat
        // diperbaiki dari peramban, jadi yang dibuka portal - tempat pesan
        // gangguannya tampil.
        const perbaiki = tautanKeluar("Perbaiki ↗", alamat, `Buka ${nama} di tab baru`);
        perbaiki.classList.add("tb-perbaiki");
        li.appendChild(perbaiki);
      }
      daftar.appendChild(li);
    }
    waktu.textContent = lampuPada ? `diperiksa ${jamMenit(lampuPada)}` : "";
  });
  void periksaLampu(false);
  return k;
}

// ── popup-27: batas situs yang terlihat ──────────────────────────────────────

const POLA_SITUS = [
  ["SIPP", /\/SIPP\/|\/index\.php\//i],
  ["ABT", /\/aps_badilag\//i],
  ["portal ALETA", /\/aleta(\/|$)/i],
];

function inangTerizinkan() {
  let daftar = [];
  try {
    daftar = (chrome.runtime.getManifest().host_permissions || []).slice();
  } catch {
    daftar = [];
  }
  if (!daftar.length) daftar = ["http://192.168.10.10/*", "http://127.0.0.1/*"];
  return daftar
    .map((p) => {
      const m = /^https?:\/\/([^/]+)\//.exec(String(p));
      return m ? m[1] : "";
    })
    .filter(Boolean);
}

/**
 * Tab aktif TANPA izin "tabs": chrome.tabs.query tetap boleh dipanggil, dan
 * Chrome hanya mengisi url-nya untuk tab yang alamatnya sudah dalam izin
 * host ekstensi ini. Url yang kosong itu sendiri jawabannya: situs itu di
 * luar jangkauan ALETA.
 */
async function periksaTabAktif() {
  const tabs = typeof chrome !== "undefined" && chrome.tabs && chrome.tabs.query ? chrome.tabs : null;
  if (!tabs) return "Tab tidak dapat diperiksa dari jendela ini.";
  try {
    const hasil = await tabs.query({ active: true, currentWindow: true });
    const tab = Array.isArray(hasil) ? hasil[0] : null;
    const url = tab && tab.url ? String(tab.url) : "";
    if (!url) return "Tab ini situs lain - ALETA tidak dapat membaca maupun mengubahnya.";
    let u = null;
    try {
      u = new URL(url);
    } catch {
      u = null;
    }
    if (!u || !inangTerizinkan().includes(u.hostname)) {
      return "Tab ini situs lain - ALETA tidak dapat membaca maupun mengubahnya.";
    }
    const cocok = POLA_SITUS.find(([, pola]) => pola.test(u.pathname));
    return cocok
      ? `Tab ini: ${cocok[0]} di ${u.host} ✓ - ALETA aktif di sini.`
      : `Tab ini di ${u.host}, tetapi bukan SIPP, ABT, atau portal - ALETA tidak memasang apa pun.`;
  } catch {
    return "Tab tidak dapat diperiksa.";
  }
}

function komponenBatasSitus() {
  const k = buat("div", "tb-batas");
  k.id = "tbBatasSitus";
  k.dataset.fitur = "popup-27";
  const teks = buat("span", "tb-batas-teks");
  const inang = inangTerizinkan();
  teks.textContent = `▣ Aktif hanya di ${inang.map((h) => (/^127\./.test(h) ? `${h} (uji setempat)` : h)).join(" · ")}`;
  tandaBaru(teks, "popup-27");
  const periksa = tombolKecil("Periksa", "Periksa tab yang sedang terbuka");
  const hasil = buat("p", "saklar-ket tb-batas-hasil");
  hasil.hidden = true;
  periksa.addEventListener("click", async () => {
    hasil.textContent = await periksaTabAktif();
    hasil.hidden = false;
  });
  const baris = buat("div", "tb-batas-baris");
  baris.appendChild(teks);
  baris.appendChild(periksa);
  k.appendChild(baris);
  k.appendChild(hasil);
  return k;
}

// ── popup-10: versi, terbaru, dan yang baru ──────────────────────────────────

function keadaanVersi() {
  const disajikan = keadaanPortal.versi;
  if (!terpasang) return { kode: "belum", teks: "versi tidak terbaca" };
  if (!disajikan) return { kode: "belum", teks: "belum dapat dibandingkan dengan portal" };
  if (bandingVersi(disajikan, terpasang) > 0) return { kode: "usang", teks: `portal sudah ${disajikan} - perlu diperbarui` };
  return { kode: "ok", teks: "terbaru ✓" };
}

function komponenVersi() {
  const k = kartuFitur("popup-10", `Ekstensi ${terpasang || "?"}`);
  k.id = "tbVersi";
  k.dataset.cari = "versi pembaruan";
  const status = buat("span", "tb-versi-status");
  k.firstChild.appendChild(status);
  const baru = buat("p", "saklar-ket tb-versi-baru");
  const aksi = buat("div", "tb-baris-aksi");
  const perbarui = tombolKecil("Perbarui sekarang", "Sama dengan tombol Perbarui sekarang di kartu Pembaruan ekstensi");
  perbarui.addEventListener("click", () => {
    const asli = document.getElementById("perbaruiSekarang");
    if (asli && !asli.disabled) asli.click();
  });
  const catatan = tautanKeluar(
    "Semua catatan ↗",
    tahap2.asalPortal ? `${tahap2.asalPortal}/patch-notes` : "",
    "Catatan pembaruan di portal ALETA"
  );
  aksi.appendChild(perbarui);
  aksi.appendChild(catatan);
  k.appendChild(baru);
  k.appendChild(aksi);
  susunan.penyegar.push(() => {
    const v = keadaanVersi();
    status.textContent = ` · ${v.teks}`;
    status.dataset.keadaan = v.kode;
    perbarui.hidden = v.kode !== "usang";
    baru.textContent = keadaanPortal.yangBaru
      ? `Yang baru: ${keadaanPortal.yangBaru}`
      : "Yang baru di versi ini tertulis di Catatan Pembaruan portal ALETA.";
  });
  return k;
}

// ── popup-14: ekspor dan impor pengaturan ────────────────────────────────────
//
// Hanya SETELAN yang dipilih orangnya sendiri di popup ini. Sengaja TIDAK:
//   asalPortal, akunSipp           siapa dan di mana - bukan setelan
//   token*, antrean, riwayat,      sesi, pekerjaan berjalan, dan data perkara
//   simpanan konteks
//   posisi*                        letak di layar PC ini; di monitor lain salah
//   uji*, senyapSampai             tampilan coba Super Admin dan keadaan sesaat
//   petaBlangkoPutusan             disunting di panel ABT, bukan di sini
// Impor menerima kunci yang dikenal DAN nilainya sah; sisanya disebut ditolak.

const benarSalah = (v) => typeof v === "boolean";
const ATURAN_PENGATURAN = {
  aktif: benarSalah,
  tandaiHalaman: benarSalah,
  sisipJadwal: benarSalah,
  cetakTigaBerkas: benarSalah,
  suntingLangsungAbt: benarSalah,
  checklistMilestone: benarSalah,
  // Perbaikan 30 Sep sore butir 3 (K5) - setelan pribadi, ikut diekspor.
  [KUNCI_TEKNIS]: benarSalah,
  [SKALA_KUNCI]: (v) => typeof v === "number" && v >= SKALA_MIN && v <= SKALA_MAKS && v % SKALA_LANGKAH === 0,
  [KUNCI_TEMA_POPUP]: (v) => URUTAN_TEMA.includes(v),
  [KUNCI_TEMA_PANEL]: (v) => v === "terang" || v === "gelap",
  [KUNCI_WARNA_GELAP]: (v) => typeof v === "string" && DAFTAR_WARNA_GELAP.some(([n]) => n === v),
};
const JENIS_BERKAS_PENGATURAN = "aleta-pengaturan-ekstensi";

/** Isi berkas ekspor dari isi penyimpanan - kunci di luar daftar tidak pernah ikut. */
function susunEksporPengaturan(simpan) {
  const pengaturan = {};
  for (const [kunci, sah] of Object.entries(ATURAN_PENGATURAN)) {
    if (simpan && kunci in simpan && sah(simpan[kunci])) pengaturan[kunci] = simpan[kunci];
  }
  return { jenis: JENIS_BERKAS_PENGATURAN, versiEkstensi: terpasang, dibuat: new Date().toISOString(), pengaturan };
}

/** { diterima, ditolak } - ditolak berisi nama kunci beserta sebabnya. */
function saringImporPengaturan(isi) {
  const hasil = { diterima: {}, ditolak: [] };
  if (!isi || typeof isi !== "object" || isi.jenis !== JENIS_BERKAS_PENGATURAN) {
    hasil.ditolak.push("berkas: bukan berkas pengaturan ALETA");
    return hasil;
  }
  const p = isi.pengaturan;
  if (!p || typeof p !== "object" || Array.isArray(p)) {
    hasil.ditolak.push("berkas: bagian pengaturan tidak ada");
    return hasil;
  }
  for (const [kunci, nilai] of Object.entries(p)) {
    const sah = Object.prototype.hasOwnProperty.call(ATURAN_PENGATURAN, kunci) ? ATURAN_PENGATURAN[kunci] : null;
    if (!sah) hasil.ditolak.push(`${kunci}: tidak dikenal`);
    else if (!sah(nilai)) hasil.ditolak.push(`${kunci}: nilainya tidak sah`);
    else hasil.diterima[kunci] = nilai;
  }
  return hasil;
}

async function eksporPengaturan() {
  if (!penyimpanan) return "Penyimpanan ekstensi tidak tersedia di jendela ini.";
  const simpan = await penyimpanan.get(Object.keys(ATURAN_PENGATURAN));
  const isi = susunEksporPengaturan(simpan || {});
  try {
    const berkas = new Blob([JSON.stringify(isi, null, 2)], { type: "application/json" });
    const alamat = URL.createObjectURL(berkas);
    const a = document.createElement("a");
    a.href = alamat;
    a.download = `aleta-pengaturan-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => {
      try {
        URL.revokeObjectURL(alamat);
      } catch {
        /* sudah dilepas */
      }
    }, 5000);
  } catch {
    return "Berkas tidak dapat dibuat di jendela ini.";
  }
  return `Diekspor: ${Object.keys(isi.pengaturan).length} setelan.`;
}

/** Menerapkan teks berkas impor. Mengembalikan kalimat hasilnya. */
async function terimaImporPengaturan(teks) {
  let isi = null;
  try {
    isi = JSON.parse(String(teks || ""));
  } catch {
    return "Berkas tidak terbaca - bukan JSON.";
  }
  const { diterima, ditolak } = saringImporPengaturan(isi);
  const jumlah = Object.keys(diterima).length;
  if (!jumlah) return `Tidak ada yang diimpor.${ditolak.length ? ` Ditolak: ${ditolak.join("; ")}.` : ""}`;
  if (!penyimpanan) return "Penyimpanan ekstensi tidak tersedia di jendela ini.";
  await penyimpanan.set(diterima);
  // Kotak centang, skala, dan tema digambar ulang dari penyimpanan - jalan
  // yang sama dengan saat popup dibuka, bukan salinan aturannya.
  const s = await penyimpanan.get([
    "aktif",
    "tandaiHalaman",
    "sisipJadwal",
    "cetakTigaBerkas",
    "suntingLangsungAbt",
    "checklistMilestone",
    "asalPortal",
    SKALA_KUNCI,
    KUNCI_TEMA_POPUP,
    KUNCI_TEMA_PANEL,
  ]);
  pasangNilai(s || {});
  const tp = String((s && s[KUNCI_TEMA_POPUP]) || "");
  if (URUTAN_TEMA.includes(tp)) temaPopup = tp;
  temaPanelSekarang = (s && s[KUNCI_TEMA_PANEL]) === "terang" ? "terang" : "gelap";
  terapkanTemaPopup();
  if (KUNCI_TEKNIS in diterima) {
    tahap2.teknis = diterima[KUNCI_TEKNIS] !== false;
    tandaiTeknisPopup();
  }
  segarkanSusunan();
  return `Diimpor: ${jumlah} setelan.${ditolak.length ? ` Ditolak: ${ditolak.join("; ")}.` : ""}`;
}

function komponenEksporImpor() {
  const k = kartuFitur("popup-14", "Ekspor dan impor pengaturan");
  k.id = "tbEksporImpor";
  k.dataset.cari = "ekspor impor pengaturan";
  const aksi = buat("div", "tb-baris-aksi");
  const ekspor = tombolKecil("⤓ Ekspor", "Simpan saklar, tema, dan ukuran huruf ke satu berkas JSON");
  ekspor.id = "tbEkspor";
  const impor = tombolKecil("⤒ Impor", "Pasang setelan dari berkas JSON ekspor ALETA");
  impor.id = "tbImpor";
  const pilih = buat("input");
  pilih.type = "file";
  pilih.accept = "application/json,.json";
  pilih.hidden = true;
  pilih.id = "tbImporBerkas";
  const kabar = buat("p", "saklar-ket tb-kabar");
  kabar.hidden = true;
  const tulis = (t) => {
    kabar.textContent = t;
    kabar.hidden = false;
  };
  ekspor.addEventListener("click", async () => tulis(await eksporPengaturan()));
  impor.addEventListener("click", () => pilih.click());
  pilih.addEventListener("change", async () => {
    const berkas = pilih.files && pilih.files[0];
    if (!berkas) return;
    tulis(await terimaImporPengaturan(await berkas.text()));
    pilih.value = "";
  });
  aksi.appendChild(ekspor);
  aksi.appendChild(impor);
  k.appendChild(aksi);
  k.appendChild(pilih);
  k.appendChild(
    buat("p", "saklar-ket aleta-teknis", "Saklar, tema, dan ukuran huruf saja - tanpa akun, sesi, posisi layar, atau data perkara.")
  );
  k.appendChild(kabar);
  return k;
}

// ── popup-16: daftar pintasan papan ketik (hanya daftar) ─────────────────────
//
// Mengubahnya butuh "commands" di manifest - di luar tahap ini. Yang
// didaftar adalah pintasan yang SUDAH ada di tiap panel (konten.js, abt.js,
// aleta.js); tulisannya disalin dari sana.
const DAFTAR_PINTASAN = [
  ["Panel SIPP", [["Alt+A", "ciutkan / bentangkan panel"], ["Alt+P", "buka Penetapan"], ["Alt+R", "buka Riwayat ALETA"], ["Alt+Enter", "tekan Tetapkan"]]],
  ["Panel ABT", [["Alt+A", "ciutkan / bentangkan panel"], ["Alt+P", "isi blangko dari SIPP"], ["Alt+R", "buka Lihat riwayat perubahan"], ["Alt+Enter", "susun keterangan saksi 1 & 2"]]],
  ["Putusan massal ABT", [["Alt+A", "ciutkan / bentangkan panel"], ["Alt+P", "periksa dulu - belum dijalankan"], ["Alt+R", "ambil token dari ABT"], ["Alt+Enter", "jalankan putusan massal"]]],
  ["Panel portal ALETA", [["Alt+A", "ciutkan / bentangkan panel"], ["Alt+P", "buka daftar Kembali ke SIPP"], ["Alt+R", "buka Catatan pembaruan"], ["Alt+Enter", "periksa pembaruan ekstensi"]]],
];

function komponenPintasan() {
  const k = kartuFitur("popup-16", "Pintasan papan ketik");
  k.id = "tbPintasan";
  k.dataset.cari = "pintasan papan ketik keyboard";
  const laci = buat("details", "tb-pintasan-laci");
  laci.appendChild(buat("summary", "", "lihat daftar"));
  for (const [panel, daftar] of DAFTAR_PINTASAN) {
    laci.appendChild(buat("div", "tb-pintasan-judul", panel));
    for (const [tombol, arti] of daftar) {
      const baris = buat("div", "tb-pintasan-baris");
      baris.appendChild(buat("kbd", "", tombol));
      baris.appendChild(buat("span", "", arti));
      laci.appendChild(baris);
    }
  }
  laci.appendChild(
    buat("p", "saklar-ket aleta-teknis", "Tidak berlaku selagi mengetik di kolom isian. Mengubah pintasan belum tersedia.")
  );
  k.appendChild(laci);
  return k;
}

// ── Susunan BARU: kulit Klasik + fitur yang saklarnya menyala ────────────────

function susunBaru() {
  const isi = document.querySelector(".isi");
  const keadaan = document.querySelector(".keadaan");
  const kartu = [];
  if (fiturPopupNyala("popup-2")) kartu.push(komponenLampu(true));
  if (fiturPopupNyala("popup-27") && popupSuperAdmin()) kartu.push(komponenBatasSitus());
  if (fiturPopupNyala("popup-10")) kartu.push(komponenVersi());
  if (fiturPopupNyala("popup-11") && !profilPeranMengaturSaklar() && stripProfilBoleh()) kartu.push(komponenProfil());
  if (fiturPopupNyala("popup-5")) kartu.push(komponenTema(true, true));
  if (fiturPopupNyala("popup-12")) kartu.push(komponenSenyap());
  if (fiturPopupNyala("popup-15")) kartu.push(komponenCari());
  if (fiturPopupNyala("popup-14")) kartu.push(komponenEksporImpor());
  if (fiturPopupNyala("popup-16")) kartu.push(komponenPintasan());
  if (kartu.length && isi) {
    const coba = buat("section", "tb-fitur-coba");
    coba.id = "fiturCoba";
    const judul = buat("div", "tb-fitur-coba-judul");
    judul.appendChild(buat("b", "", "Fitur coba"));
    judul.appendChild(buat("span", "saklar-ket aleta-teknis", " saklar ide yang dinyalakan Super Admin"));
    coba.appendChild(judul);
    for (const x of kartu) coba.appendChild(x);
    sisipkan(coba, isi.parentNode, keadaan && keadaan.parentNode === isi.parentNode ? keadaan.nextSibling : isi);
  }
  if (fiturPopupNyala("popup-1")) pasangRingkas(false);
  if (fiturPopupNyala("popup-3") && isi) {
    kelompokkanSaklar();
    const aktif = document.getElementById("aktif");
    const labelAktif = aktif ? aktif.closest("label.saklar") : null;
    sisipkan(komponenLompat(), isi, labelAktif ? labelAktif.nextSibling : isi.firstChild);
  }
  if (fiturPopupNyala("popup-4")) pasangGeserSkala();
  if (fiturPopupNyala("popup-13")) pasangPilihanPosisi();
}

// ── Susunan UI BARU: kulit Modern + D1-D15 + fitur yang saklarnya menyala ────

const JUDUL_INDUK =
  "Matikan ALETA di SIPP, ABT, dan portal dengan saklar ini. " +
  "× di kepala panel hanya menutup panel menjadi lencana - ALETA tetap aktif.";

/** D4 + D12: saklar induk besar di kepala; × di panel hanya menutup. */
function susunKepalaUi() {
  const kepala = document.querySelector(".kepala");
  const kotak = document.getElementById("aktif");
  if (!kepala || !kotak) return;
  const judul = kepala.querySelector(".judul");
  const info = buat("button", "tb-info", "i");
  info.type = "button";
  info.setAttribute("aria-expanded", "false");
  info.setAttribute("aria-label", "Tentang ALETA dan saklar induknya");
  info.title = "Tentang ALETA";
  if (judul) sisipkan(info, judul, null);
  const akun = buat("small", "tb-akun");
  akun.id = "uiAkun";
  if (judul) sisipkan(akun, judul.parentNode, null);

  const induk = buat("label", "tb-induk");
  induk.id = "uiSaklarInduk";
  induk.title = JUDUL_INDUK;
  const teks = buat("span", "tb-induk-teks");
  induk.appendChild(teks);
  sisipkan(induk, kepala, null);
  const labelLama = kotak.closest("label.saklar");
  pindahkan(kotak, induk, null);
  atributSementara(kotak, "role", "switch");
  atributSementara(kotak, "aria-label", "ALETA di SIPP, ABT, dan portal");
  ubahSementara(labelLama, "hidden", true);
  ubahSementara(document.getElementById("tombolTema"), "hidden", true);

  // Uraian ALETA (pengantar lama) dan jalan mematikannya - di balik ⓘ.
  const panelInfo = buat("div", "tb-info-panel");
  panelInfo.id = "uiInfo";
  panelInfo.hidden = true;
  sisipkan(panelInfo, kepala.parentNode, kepala.nextSibling);
  pindahkan(document.querySelector(".pengantar"), panelInfo, null);
  panelInfo.appendChild(
    buat(
      "p",
      "saklar-ket",
      "× di kepala panel hanya MENUTUP panel menjadi lencana - ALETA tetap aktif. " +
        "Untuk mematikan ALETA di SIPP, ABT, dan portal, geser saklar Aktif di kepala jendela ini."
    )
  );
  info.addEventListener("click", () => {
    panelInfo.hidden = !panelInfo.hidden;
    info.setAttribute("aria-expanded", panelInfo.hidden ? "false" : "true");
  });

  const segarkan = () => {
    teks.textContent = kotak.checked ? "Aktif" : "Mati";
    induk.dataset.nyala = kotak.checked ? "ya" : "tidak";
    const p = keadaanPortal;
    akun.textContent = p.nama ? `${p.nama}${p.peran ? ` · ${p.peran}` : ""}` : "";
  };
  dengarSementara(kotak, "change", segarkan);
  susunan.penyegar.push(segarkan);
}

/** D3: kartu status ringkas - "Semua tersambung ✓" atau daftar masalah + Perbaiki. */
function masalahSambungan() {
  const p = keadaanPortal;
  const hasil = [];
  if (!p.selesai) return hasil;
  if (!tahap2.asalPortal) {
    hasil.push({ teks: "Alamat portal belum diketahui - buka halaman SIPP sekali.", alamat: "" });
    return hasil;
  }
  if (p.server === "putus") {
    const sebab = /^server /.test(p.pesan) ? p.pesan.replace(/^server /, "") : `bermasalah (${p.pesan || "tidak menjawab"})`;
    hasil.push({ teks: `Server ALETA ${sebab}.`, ulang: true });
    return hasil;
  }
  if (!p.masuk) hasil.push({ teks: "Belum masuk portal ALETA.", alamat: `${tahap2.asalPortal}/login` });
  // POPUP-PERAN 12 Okt (butir 4): SIPP dan ABT yang menjawab 404/5xx/tidak
  // terjangkau, atau belum masuk, ikut dihitung - dahulu kartu bertulis
  // "Semua tersambung" walau lampu SIPP dan ABT merah.
  for (const [kode, nama] of [
    ["sipp", "SIPP"],
    ["abt", "ABT"],
  ]) {
    const l = lampuSitus[kode];
    if (l.keadaan === "putus") hasil.push({ teks: `${nama} ${l.ket}.`, alamat: alamatAplikasi(kode) });
    else if (l.keadaan === "awas") hasil.push({ teks: `Belum masuk ${nama}.`, alamat: alamatAplikasi(kode) });
  }
  const v = keadaanVersi();
  if (v.kode === "usang") hasil.push({ teks: `Ekstensi ${terpasang} - ${v.teks}.`, perbarui: true });
  return hasil;
}

/** SIPP/ABT masih diperiksa (lampu "memuat") - kartu belum boleh menyebut "tersambung". */
function sambunganMasihDiperiksa() {
  return lampuSitus.sipp.keadaan === "memuat" || lampuSitus.abt.keadaan === "memuat";
}

function komponenStatusUi() {
  const k = buat("section", "tb-status");
  k.id = "uiStatus";
  const kepala = buat("div", "tb-status-kepala");
  const ikon = buat("span", "tb-status-ikon");
  ikon.setAttribute("aria-hidden", "true");
  const judul = buat("b", "tb-status-judul");
  const perbaiki = buat("button", "uji-kecil tb-tombol tb-tombol-utama", "Perbaiki");
  perbaiki.type = "button";
  perbaiki.id = "uiPerbaiki";
  kepala.appendChild(ikon);
  kepala.appendChild(judul);
  // POPUP-PERAN 12 Okt (butir 4): bila semua tersambung kartu menciut jadi satu
  // baris (bisa dibuka lewat "rincian"); bila ada masalah tampil penuh.
  const lipat = buat("button", "tb-status-lipat", "rincian ▾");
  lipat.type = "button";
  lipat.id = "uiStatusLipat";
  lipat.setAttribute("aria-expanded", "false");
  kepala.appendChild(lipat);
  kepala.appendChild(perbaiki);
  const ringkas = buat("p", "saklar-ket tb-status-ringkas");
  const masalah = buat("ul", "tb-status-masalah");
  const isiKartu = buat("div", "tb-status-isi");
  k.appendChild(kepala);
  isiKartu.appendChild(ringkas);
  isiKartu.appendChild(masalah);
  if (fiturPopupNyala("popup-2")) isiKartu.appendChild(komponenLampu(false));
  else if (!lampuSitus.sipp.ket && !sambunganMasihDiperiksa()) void periksaLampu(false);
  const rincian = buat("details", "tb-rincian");
  rincian.appendChild(buat("summary", "", "Rincian: versi dan akun"));
  isiKartu.appendChild(rincian);
  k.appendChild(isiKartu);
  lipat.addEventListener("click", () => {
    const buka = k.dataset.terbuka !== "ya";
    if (buka) k.dataset.terbuka = "ya";
    else delete k.dataset.terbuka;
    lipat.setAttribute("aria-expanded", buka ? "true" : "false");
    lipat.textContent = buka ? "sembunyikan ▴" : "rincian ▾";
  });
  let yangPertama = null;
  perbaiki.addEventListener("click", () => {
    const m = yangPertama;
    if (!m) return;
    if (m.perbarui) {
      const asli = document.getElementById("perbaruiSekarang");
      const laci = document.getElementById("uiLainnya");
      if (laci) laci.open = true;
      if (asli && !asli.disabled) asli.click();
    } else if (m.ulang) void periksaAkunAleta(tahap2.asalPortal);
    else if (m.alamat) window.open(m.alamat, "_blank", "noopener");
  });
  susunan.penyegar.push(() => {
    const daftar = masalahSambungan();
    yangPertama = daftar[0] || null;
    masalah.textContent = "";
    for (const m of daftar) masalah.appendChild(buat("li", "", m.teks));
    const p = keadaanPortal;
    if (!p.selesai || (!daftar.length && sambunganMasihDiperiksa())) {
      k.dataset.keadaan = "memuat";
      ikon.textContent = "…";
      judul.textContent = "Memeriksa sambungan…";
    } else if (!daftar.length) {
      k.dataset.keadaan = "ok";
      ikon.textContent = "✓";
      judul.textContent = "Semua tersambung";
    } else {
      k.dataset.keadaan = "masalah";
      ikon.textContent = "!";
      judul.textContent = daftar.length === 1 ? "1 hal perlu dibereskan" : `${daftar.length} hal perlu dibereskan`;
    }
    // Menciut hanya bila semuanya baik; masalah selalu tampil penuh.
    const semuaBaik = k.dataset.keadaan === "ok";
    if (semuaBaik) k.dataset.ringkas = "ya";
    else {
      delete k.dataset.ringkas;
      delete k.dataset.terbuka;
      lipat.setAttribute("aria-expanded", "false");
      lipat.textContent = "rincian ▾";
    }
    lipat.hidden = !semuaBaik;
    perbaiki.hidden = !yangPertama || (!yangPertama.alamat && !yangPertama.ulang && !yangPertama.perbarui);
    const bagian = [];
    if (p.nama) bagian.push(`Portal · ${p.nama}`);
    if (tahap2.akunSipp) bagian.push(`SIPP · ${tahap2.akunSipp}`);
    if (terpasang) bagian.push(`v${terpasang}`);
    ringkas.textContent = bagian.join(" · ");
    ringkas.hidden = !bagian.length;
  });
  return { kartu: k, rincian };
}

/** D14: pintasan Portal / SIPP / ABT di kaki, dengan versi. */
function komponenKakiUi() {
  const k = buat("div", "tb-pintas-kaki");
  k.id = "uiPintasan";
  const judulMati = "Alamatnya belum diketahui - buka halaman SIPP sekali";
  k.appendChild(tautanKeluar("Portal ↗", alamatAplikasi("portal"), alamatAplikasi("portal") ? "Buka portal ALETA" : judulMati));
  k.appendChild(tautanKeluar("SIPP ↗", alamatAplikasi("sipp"), alamatAplikasi("sipp") ? "Buka SIPP" : judulMati));
  k.appendChild(tautanKeluar("ABT ↗", alamatAplikasi("abt"), alamatAplikasi("abt") ? "Buka ABT" : judulMati));
  const versi = buat("span", "tb-versi-kaki");
  k.appendChild(versi);
  susunan.penyegar.push(() => {
    const v = keadaanVersi();
    versi.textContent = `v${terpasang || "?"}${v.kode === "ok" ? " ✓" : v.kode === "usang" ? " · perlu diperbarui" : ""}`;
    versi.dataset.keadaan = v.kode;
    versi.title = v.teks;
  });
  return k;
}

// ── Perbaikan 2 Okt butir 4: panel terbuka/tersembunyi saat halaman dimuat ───
//
// Tiga saklar (ALETA, SIPP, ABT). Mati = panel situs itu lahir sebagai LENCANA
// (logo bulat) saat halaman dibuka - satu klik membukanya; fitur tidak ada
// yang hilang dan saklar induk tidak disentuh. Bawaan: ALETA mati, SIPP dan
// ABT nyala. Disimpan per AKUN (setelan "panel.bawaan", PUT /ekstensi/setelan)
// + cadangan lokal "panelBawaanTampil" {aleta,sipp,abt,diubahPada}; yang
// lebih baru yang berlaku (sama dengan alatBawaanTampilBerlaku di
// panel-alat.js). Mode latihan/kering: lokal saja. UI Baru saja.
const KUNCI_BAWAAN_PANEL = "panelBawaanTampil";
const SETELAN_BAWAAN_PANEL = "panel.bawaan";
const BAWAAN_PANEL = { aleta: false, sipp: true, abt: true };
const SITUS_BAWAAN_PANEL = [
  ["aleta", "Panel ALETA (portal)"],
  ["sipp", "Panel SIPP"],
  ["abt", "Panel ABT"],
];

function bawaanPanelBersih(x) {
  const hasil = {};
  if (!x || typeof x !== "object" || Array.isArray(x)) return hasil;
  for (const [s] of SITUS_BAWAAN_PANEL) if (typeof x[s] === "boolean") hasil[s] = x[s];
  return hasil;
}

function bawaanPanelBerlaku(lokal, server) {
  const waktu = (x) => {
    const t = Date.parse(String((x && x.diubahPada) || ""));
    return Number.isFinite(t) ? t : 0;
  };
  const sv = server && typeof server === "object" && server.nilai && typeof server.nilai === "object" ? server : null;
  const lk = lokal && typeof lokal === "object" ? lokal : null;
  if (sv && (!lk || waktu(sv) >= waktu(lk))) return { ...BAWAAN_PANEL, ...bawaanPanelBersih(sv.nilai), sumber: "akun" };
  if (lk) return { ...BAWAAN_PANEL, ...bawaanPanelBersih(lk), sumber: "lokal" };
  return { ...BAWAAN_PANEL, sumber: "bawaan" };
}

function bawaanPanelServer() {
  const s = ujiKeadaan.server;
  return s && s.setelan && typeof s.setelan === "object" ? s.setelan[SETELAN_BAWAAN_PANEL] : undefined;
}

/** Simpan lokal dulu (berlaku seketika), lalu ke akun bila boleh. Pulang kalimat keadaan. */
async function simpanBawaanPanel(nilai) {
  const bersih = bawaanPanelBersih(nilai);
  const pada = new Date().toISOString();
  if (!penyimpanan) return "Tidak tersimpan - penyimpanan ekstensi tidak tersedia.";
  let s = {};
  try {
    await penyimpanan.set({ [KUNCI_BAWAAN_PANEL]: { ...bersih, diubahPada: pada } });
    s = await penyimpanan.get(["modeLatihan", "modeKering", "asalPortal", "tampilanServer"]);
  } catch {
    return "Tersimpan di peramban ini saja.";
  }
  if (s.modeLatihan === true || s.modeKering === true) {
    return `${s.modeLatihan === true ? "Mode latihan" : "Mode kering"}: tersimpan di peramban ini saja.`;
  }
  const asal = String(s.asalPortal || "");
  if (!asal) return "Tersimpan di peramban ini; akun menyusul sesudah portal ALETA dibuka.";
  try {
    const r = await fetch(`${asal}/api/aleta-ecourt/ekstensi/setelan`, {
      method: "PUT",
      credentials: "include",
      cache: "no-store",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ kunci: SETELAN_BAWAAN_PANEL, nilai: bersih }),
    });
    if (!r.ok) return `Tersimpan di peramban ini; akun belum (server menjawab ${r.status}).`;
    const isi = await r.json().catch(() => ({}));
    const data = (isi && isi.data) || isi || {};
    const diubahPada = String(data.diubahPada || pada);
    // Singgahan tampilan diperbarui di tempat - tab lain dan halaman
    // berikutnya tidak membaca nilai akun yang sudah basi.
    const sv = s.tampilanServer && typeof s.tampilanServer === "object" ? s.tampilanServer : null;
    if (sv) {
      const baru = { ...sv, setelan: { ...(sv.setelan || {}), [SETELAN_BAWAAN_PANEL]: { nilai: data.nilai || bersih, diubahPada } } };
      await penyimpanan.set({ tampilanServer: baru });
      ujiKeadaan.server = baru;
    }
    return "Tersimpan di akun Anda - berlaku di PC mana pun.";
  } catch {
    return "Tersimpan di peramban ini; akun belum (server tidak terjangkau).";
  }
}

function komponenBawaanPanel() {
  const sek = buat("section", "tb-kelompok tb-bawaan-panel");
  sek.id = "kelompok-bawaan-panel";
  sek.dataset.kelompok = "bawaan-panel";
  sek.appendChild(buat("h3", "tb-kelompok-judul", "Panel saat halaman dibuka"));
  // POPUP-PERAN 12 Okt: penjelasan teknis hanya untuk Super Admin.
  if (popupSuperAdmin()) {
    sek.appendChild(
      buat("p", "saklar-ket", "Mati = panel lahir sebagai logo ALETA (lencana); klik logonya untuk membuka. Tidak ada fitur yang dimatikan.")
    );
  }
  const kotak = {};
  for (const [situs, nama] of SITUS_BAWAAN_PANEL) {
    const label = buat("label", "saklar");
    const masukan = buat("input");
    masukan.type = "checkbox";
    masukan.id = `bawaanPanel-${situs}`;
    masukan.dataset.situs = situs;
    const teks = buat("span");
    teks.appendChild(buat("span", "saklar-nama", nama));
    if (popupSuperAdmin()) teks.appendChild(buat("span", "saklar-ket", `Bawaan: ${BAWAAN_PANEL[situs] ? "terbuka" : "tersembunyi"}`));
    label.appendChild(masukan);
    label.appendChild(teks);
    sek.appendChild(label);
    kotak[situs] = masukan;
  }
  const kabar = buat("p", "saklar-ket tb-bawaan-kabar");
  kabar.id = "bawaanPanelKabar";
  kabar.setAttribute("aria-live", "polite");
  sek.appendChild(kabar);
  let lokal = null;
  const gambar = () => {
    const b = bawaanPanelBerlaku(lokal, bawaanPanelServer());
    for (const [situs] of SITUS_BAWAAN_PANEL) kotak[situs].checked = b[situs] !== false;
    if (!kabar.dataset.dikabarkan && popupSuperAdmin()) {
      kabar.textContent =
        b.sumber === "akun" ? "Mengikuti setelan akun Anda." : b.sumber === "lokal" ? "Mengikuti setelan peramban ini." : "Memakai bawaan.";
    }
  };
  for (const [situs] of SITUS_BAWAAN_PANEL) {
    kotak[situs].addEventListener("change", async () => {
      const nilai = {};
      for (const [s] of SITUS_BAWAAN_PANEL) nilai[s] = kotak[s].checked;
      lokal = { ...nilai, diubahPada: new Date().toISOString() };
      kabar.dataset.dikabarkan = "ya";
      kabar.textContent = "Menyimpan…";
      kabar.textContent = await simpanBawaanPanel(nilai);
    });
  }
  const muatLokal = () =>
    penyimpanan
      ? penyimpanan
          .get([KUNCI_BAWAAN_PANEL])
          .then((s) => {
            lokal = s && s[KUNCI_BAWAAN_PANEL] && typeof s[KUNCI_BAWAAN_PANEL] === "object" ? s[KUNCI_BAWAAN_PANEL] : null;
            gambar();
          })
          .catch(gambar)
      : Promise.resolve();
  void muatLokal();
  // Profil yang diterapkan / akun yang berganti menulis ulang panelBawaanTampil.
  dengarSementara(document, "aleta-popup-panel", () => void muatLokal());
  gambar();
  susunan.penyegar.push(gambar);
  return sek;
}

function susunUiBaru() {
  susunKepalaUi();

  // D3: kartu status sesudah pengalih uji, di tempat kotak keadaan lama -
  // kotak itu sendiri pindah ke "Rincian" di dalamnya (tetap utuh).
  const keadaan = document.querySelector(".keadaan");
  const { kartu, rincian } = komponenStatusUi();
  if (keadaan) {
    sisipkan(kartu, keadaan.parentNode, keadaan);
    pindahkan(keadaan, rincian, null);
  }
  if (fiturPopupNyala("popup-27") && popupSuperAdmin()) sisipkan(komponenBatasSitus(), kartu.parentNode, kartu.nextSibling);

  const isi = document.querySelector(".isi");
  if (!isi) return;
  // D1 + D2: kelompok berjudul, keterangan satu baris + ⓘ.
  const wadah = kelompokkanSaklar();
  pasangRingkas(true);
  // D13 (+ contoh warna bila popup-5 menyala) dan warna gelap Super Admin
  // di kelompok Tampilan; D5 ukuran huruf A− A A+ (+ penggeser popup-4).
  if (wadah.tampilan) {
    const judulTampilan = wadah.tampilan.firstChild;
    const tema = komponenTema(fiturPopupNyala("popup-5"), false);
    if (fiturPopupNyala("popup-5")) tandaBaru(tema.firstChild, "popup-5");
    wadah.tampilan.insertBefore(tema, judulTampilan.nextSibling);
    pindahkan(document.getElementById("barisWarna"), wadah.tampilan, tema.nextSibling);
  }
  pasangSkalaSegmen();
  if (fiturPopupNyala("popup-4")) pasangGeserSkala();
  // Perbaikan 2 Okt butir 4: panel terbuka/tersembunyi per situs - sesudah Tampilan.
  sisipkan(komponenBawaanPanel(), isi, wadah.tampilan ? wadah.tampilan.nextSibling : isi.querySelector(".tb-kelompok"));

  // Bagian atas isi: profil (popup-11), cari (popup-15), lompat (popup-3).
  const atas = [];
  if (fiturPopupNyala("popup-11") && !profilPeranMengaturSaklar() && stripProfilBoleh()) atas.push(komponenProfil());
  if (fiturPopupNyala("popup-15")) atas.push(komponenCari());
  if (fiturPopupNyala("popup-3")) atas.push(komponenLompat());
  const pertama = isi.querySelector(".tb-kelompok");
  for (const x of atas) sisipkan(x, isi, pertama);

  // "Lainnya": pembaruan ekstensi (kartu lama, dipindah), versi (popup-10),
  // ekspor/impor (popup-14), daftar pintasan (popup-16).
  const lainnya = buat("details", "tb-lainnya");
  lainnya.id = "uiLainnya";
  lainnya.appendChild(buat("summary", "", "Lainnya: pembaruan ekstensi"));
  sisipkan(lainnya, isi, null);
  if (fiturPopupNyala("popup-10")) lainnya.appendChild(komponenVersi());
  pindahkan(kartuPembaruan(), lainnya, null);
  if (fiturPopupNyala("popup-14")) lainnya.appendChild(komponenEksporImpor());
  if (fiturPopupNyala("popup-16")) lainnya.appendChild(komponenPintasan());

  // D7 + posisi: satu baris tindakan.
  const tindakan = document.querySelector(".tindakan");
  if (tindakan && fiturPopupNyala("popup-12")) sisipkan(komponenSenyap(), tindakan, tindakan.firstChild);
  if (fiturPopupNyala("popup-13")) pasangPilihanPosisi();

  // D14: pintasan di kaki; kalimat kaki lama tetap di bawahnya.
  const kaki = document.querySelector(".kaki");
  if (kaki) sisipkan(komponenKakiUi(), kaki, kaki.firstChild);
}

/* === POPUP-PERAN 12 Okt === */
/**
 * ============================================================================
 * POPUP PER AKUN + GOLONGAN (12 Okt 2026)
 * ============================================================================
 *
 * Keluhan pengguna: isi widget "dicampur seluruh peran", dan profil saklar
 * (Hakim / PP / Juru Sita / Kustom) tampak tidak mengubah apa pun.
 *
 * SEBAB profil tampak diam (ditelusuri 12 Okt):
 *   1. ketiga profil lama hanya berbeda pada DUA dari lima saklar
 *      (sisipJadwal untuk Juru Sita, cetakTigaBerkas untuk PP) - dan kelima
 *      saklar itu berada di bawah gulungan, di luar pandangan saat tombol
 *      profil ditekan;
 *   2. "Kustom" hanya penanda "tidak ada yang cocok" - menekannya tidak
 *      mengerjakan apa pun, dan setelan sendiri tidak pernah diingat;
 *   3. profil tidak menyentuh panel yang dibuka bersama halaman, dan tidak
 *      mengenal peran lain (panitera, kasir, PTSP, mediator, operator);
 *   4. satu PC = satu set kunci: tidak ada yang terpisah per akun dan peran.
 *
 * PENYELESAIAN:
 *   - Kunci global yang dibaca panel (aktif, tandaiHalaman, ...) tetap
 *     menjadi "setelan yang sedang berlaku" - skrip konten tidak diubah.
 *     Setelan TIAP AKUN+GOLONGAN disimpan sebagai salinan di kunci
 *     "pengaturanAkun:<kunci>" dan DIPULIHKAN ke kunci global saat akun/peran
 *     yang masuk berganti (selaraskanIdentitas). Salinan diperbarui oleh
 *     pendengar onChanged (di sini dan di latar.js) pada tiap perubahan.
 *   - Akun baru pada PC ini memulai dari profil bawaan golongannya; akun
 *     pertama sesudah pembaruan memakai setelan PC yang sudah ada apa adanya.
 *   - Tiap golongan punya profil yang BERBEDA nyata (saklar + panel yang
 *     terbuka); isi popup hanya menampilkan saklar yang relevan bagi golongan
 *     itu. Super Admin dan Admin melihat semuanya dan dapat mencoba profil
 *     mana pun; "Kustom" = setelan sendiri, diingat sebelum profil dicoba.
 *   - Keterangan teknis (profil, batas situs, panel bawaan, uji Super Admin)
 *     hanya untuk Super Admin.
 */
/** Golongan dari nama peran - cadangan bila portal belum mengirim `golongan`. */
function golonganDariNama(peran) {
  const p = String(peran || "").toLowerCase().replace(/[-_]+/g, " ").trim();
  if (!p) return "umum";
  if (/super/.test(p)) return "super-admin";
  if (/\badmin\b|administrator/.test(p)) return "admin";
  if (/\bketua\b/.test(p)) return "ketua";
  if (/hakim/.test(p)) return "hakim";
  if (/panitera pengganti|\bpp\b/.test(p)) return "panitera-pengganti";
  if (/juru\s*sita|jurusita/.test(p)) return "juru-sita";
  if (/\bpanitera\b/.test(p)) return "panitera";
  if (/kasir|keuangan|bendahara/.test(p)) return "kasir";
  if (/ptsp/.test(p)) return "ptsp";
  if (/mediator/.test(p)) return "mediator";
  if (/operator/.test(p)) return "operator";
  return "umum";
}

/** { kunci, nama, peranNama, golongan: { kode, semua } } dari jawaban ?info=siapa. */
function bangunIdentitas(data) {
  const u = (data && data.pengguna) || {};
  const nama = String(u.nama || "");
  const peranNama = String(u.peran || "");
  let kode = "";
  let semua = [];
  if (u.golongan && typeof u.golongan === "object" && LABEL_GOLONGAN[u.golongan.kode]) {
    kode = u.golongan.kode;
    semua = Array.isArray(u.golongan.semua) ? u.golongan.semua.filter((x) => LABEL_GOLONGAN[x]) : [];
  }
  if (!kode) kode = golonganDariNama(peranNama);
  if (!semua.length) semua = [kode];
  const orang = String(u.kunci || "").trim() || nama.trim().toLowerCase().replace(/\s+/g, "-") || "-";
  return { kunci: `${orang}|${kode}`, nama, peranNama, golongan: { kode, semua } };
}

function popupSuperAdmin() {
  return Boolean(identitasPopup && identitasPopup.golongan.semua.includes("super-admin"));
}

function popupAdmin() {
  return Boolean(identitasPopup && identitasPopup.golongan.semua.some((g) => g === "super-admin" || g === "admin"));
}

/**
 * Yang relevan bagi golongan: { saklar:Set, panel:Set }, atau null = semua
 * (Super Admin, Admin, dan peran yang belum diketahui).
 */
function relevanPopup() {
  if (!identitasPopup || popupAdmin()) return null;
  const saklar = new Set();
  const panel = new Set();
  for (const g of identitasPopup.golongan.semua) {
    const p = PROFIL_GOLONGAN[g] || PROFIL_GOLONGAN.umum;
    for (const s of p.relevan) saklar.add(s);
    for (const s of SITUS_PANEL_ID) if (p.panel[s]) panel.add(s);
  }
  return { saklar, panel };
}

/** UIBARU-WAJIB 12 Okt: selain Super Admin popup selalu UI Baru (identitas, atau yang terakhir tersimpan). */
function popupWajibUi() {
  const g = identitasPopup ? identitasPopup.golongan.semua : golonganTersimpan ? [golonganTersimpan] : null;
  return Boolean(g && !g.includes("super-admin"));
}

/** Tombol "muat ulang ekstensi" di pemberitahuan puncak - sesudah pemasangan perlu muat ulang. */
function tampilkanMuatUlangPita(jawab) {
  const t = document.getElementById("muatUlangPita");
  if (t) {
    t.hidden = false;
    if (!t.dataset.terpasang) {
      t.dataset.terpasang = "ya";
      t.addEventListener("click", () => {
        if (tombolMuatUlangEkstensi && !tombolMuatUlangEkstensi.disabled) tombolMuatUlangEkstensi.click();
      });
    }
  }
  if (jawab && jawab.idUnduhan) {
    pembaruanLatar.diunduh = { versi: String(jawab.versiBaru || ""), id: jawab.idUnduhan, nama: String(jawab.namaBerkas || "") };
    gambarPemberitahuanVersi();
  }
}

function nilaiDariSimpanan(s) {
  const hasil = {};
  if (!s || typeof s !== "object") return hasil;
  for (const k of KUNCI_SETELAN_AKUN) if (s[k] !== undefined) hasil[k] = s[k];
  return hasil;
}

/** Profil awal akun BARU: profil server (bila Admin mengaturnya) lalu bawaan golongan. */
function profilAwalPopup(golongan) {
  const hasil = {};
  const kode = golongan.kode;
  if (kode === "super-admin" || kode === "admin") return hasil;
  const p = PROFIL_GOLONGAN[kode] || PROFIL_GOLONGAN.umum;
  Object.assign(hasil, p.saklar);
  const sv = ujiKeadaan.server && ujiKeadaan.server.profil;
  if (sv && sv.saklar && typeof sv.saklar === "object" && sv.bolehUbahProfil !== true) {
    for (const id of SAKLAR_PROFIL_ID) if (typeof sv.saklar[id] === "boolean") hasil[id] = sv.saklar[id];
  }
  // diubahPada kosong: setelan panel milik AKUN di server (bila ada) menang atas bawaan golongan.
  hasil.panelBawaanTampil = { ...p.panel, diubahPada: "" };
  return hasil;
}

/**
 * Menyelaraskan kunci global dengan akun+golongan yang masuk. Pulang true bila
 * kunci global diganti (jendela perlu membaca ulang).
 */
async function selaraskanIdentitas(id) {
  identitasPopup = id;
  if (!penyimpanan || !id) return false;
  const kunciBaru = AWALAN_AKUN + id.kunci;
  let s;
  try {
    s = await penyimpanan.get([KUNCI_IDENTITAS, kunciBaru, ...KUNCI_SETELAN_AKUN]);
  } catch {
    return false;
  }
  const aktif = s && s[KUNCI_IDENTITAS];
  const rekam = s && s[kunciBaru] && typeof s[kunciBaru] === "object" ? s[kunciBaru] : null;
  rekamAkunPopup = { profil: String((rekam && rekam.profil) || ""), kustom: (rekam && rekam.kustom) || null };
  if (aktif && aktif.kunci === id.kunci) return false;

  const sekarang = new Date().toISOString();
  try {
    // Salinan akun yang LAMA dikunci dulu dengan keadaan terakhirnya.
    if (aktif && aktif.kunci) {
      const kl = AWALAN_AKUN + aktif.kunci;
      const lama = ((await penyimpanan.get([kl])) || {})[kl] || {};
      await penyimpanan.set({ [kl]: { ...lama, nilai: nilaiDariSimpanan(s), diubahPada: sekarang } });
    }
    const ada = nilaiDariSimpanan(s);
    // Setelan pribadi sungguhan (bukan sekadar pilihan uji Super Admin) = tanda PC ini sudah dipakai.
    const adaPribadi = Object.keys(ada).filter((k) => !/^uji/.test(k));
    let target;
    let tulisSemua = true;
    if (rekam && rekam.nilai && typeof rekam.nilai === "object") target = { ...rekam.nilai };
    else if (!aktif && (adaPribadi.length || popupAdmin())) {
      // Pembaruan dari versi tanpa setelan per akun: setelan PC ini milik akun pertama.
      target = ada;
      tulisSemua = false;
    } else target = profilAwalPopup(id.golongan);

    await penyimpanan.set({ [KUNCI_PERALIHAN]: true });
    const tulis = {};
    for (const k of Object.keys(target)) tulis[k] = target[k];
    if (tulisSemua) {
      // Nilai lama akun sebelumnya tidak boleh tertinggal: yang punya bawaan ditimpa, sisanya dihapus.
      const hapus = [];
      for (const k of KUNCI_SETELAN_AKUN) {
        if (k in target || s[k] === undefined) continue;
        if (k in BAWAAN_AKUN) tulis[k] = BAWAAN_AKUN[k];
        else hapus.push(k);
      }
      if (hapus.length && penyimpanan.remove) await penyimpanan.remove(hapus);
    }
    const sesudah = { ...(tulisSemua ? {} : ada), ...target };
    for (const k of KUNCI_SETELAN_AKUN) if (tulis[k] !== undefined) sesudah[k] = tulis[k];
    await penyimpanan.set({
      ...tulis,
      [KUNCI_IDENTITAS]: { kunci: id.kunci, nama: id.nama, golongan: id.golongan.kode },
      [kunciBaru]: { ...(rekam || {}), nilai: nilaiDariSimpanan(sesudah), diubahPada: sekarang },
      [KUNCI_PERALIHAN]: false,
    });
    return tulisSemua;
  } catch {
    try {
      await penyimpanan.set({ [KUNCI_PERALIHAN]: false });
    } catch {
      /* penyimpanan menolak: salinan akun menyusul pada pembukaan berikutnya */
    }
    return false;
  }
}

/** Memberi tahu bagian "Panel saat halaman dibuka" bahwa setelannya ditulis ulang (profil / akun berganti). */
function kabarkanPanelPopup() {
  try {
    document.dispatchEvent(new CustomEvent("aleta-popup-panel"));
  } catch {
    /* jendela sudah ditutup */
  }
}

/** Salinan akun yang masuk diperbarui dari kunci global (dipanggil tiap setelan berubah). */
async function catatSalinanAkun() {
  if (!penyimpanan) return;
  try {
    const s = await penyimpanan.get([KUNCI_IDENTITAS, KUNCI_PERALIHAN, ...KUNCI_SETELAN_AKUN]);
    const a = s && s[KUNCI_IDENTITAS];
    if (!a || !a.kunci || s[KUNCI_PERALIHAN] === true) return;
    const k = AWALAN_AKUN + a.kunci;
    const r = ((await penyimpanan.get([k])) || {})[k] || {};
    await penyimpanan.set({ [k]: { ...r, nilai: nilaiDariSimpanan(s), diubahPada: new Date().toISOString() } });
  } catch {
    /* salinan menyusul pada perubahan berikutnya */
  }
}

async function ubahRekamAkun(ubah) {
  rekamAkunPopup = { ...rekamAkunPopup, ...ubah };
  if (!penyimpanan || !identitasPopup) return;
  try {
    const k = AWALAN_AKUN + identitasPopup.kunci;
    const r = ((await penyimpanan.get([k])) || {})[k] || {};
    await penyimpanan.set({ [k]: { ...r, ...ubah } });
  } catch {
    /* hanya ingatan jendela ini */
  }
}

/** Jendela membaca ulang semua yang bergantung kunci global setelah berganti akun. */
async function bacaUlangSetelanPopup() {
  if (!penyimpanan) return;
  try {
    const s = await penyimpanan.get([
      "aktif",
      "tandaiHalaman",
      "sisipJadwal",
      "cetakTigaBerkas",
      "suntingLangsungAbt",
      "checklistMilestone",
      "asalPortal",
      SKALA_KUNCI,
      KUNCI_TEMA_POPUP,
      KUNCI_TEMA_PANEL,
    ]);
    pasangNilai(s || {});
    const t = String((s && s[KUNCI_TEMA_POPUP]) || "");
    temaPopup = URUTAN_TEMA.includes(t) ? t : "ikut";
    temaPanelSekarang = (s && s[KUNCI_TEMA_PANEL]) === "terang" ? "terang" : "gelap";
    terapkanTemaPopup();
    await muatUjiPopup();
    await muatTahap2();
    kabarkanPanelPopup();
    jadwalkanSusunan();
  } catch {
    /* jendela memakai nilai yang sudah digambar */
  }
}

/** Dipanggil periksaAkunAleta sesudah portal menjawab siapa yang masuk. */
async function prosesIdentitasPopup(data) {
  const id = bangunIdentitas(data);
  if (!id.nama) return;
  const berganti = await selaraskanIdentitas(id);
  if (berganti) await bacaUlangSetelanPopup();
  // Golongan sudah diketahui: kulit (UI Baru wajib bagi selain Super Admin) dan
  // susunan digambar ulang dengan keterangan teknis yang sesuai.
  terapkanKulitPopup();
  terapkanPeranPopup();
  segarkanSusunan();
}

/** Menyembunyikan (bukan menghapus) yang tidak relevan; nilai tetap tersimpan. */
function terapkanPeranPopup() {
  const r = relevanPopup();
  const sembunyi = (el, ya) => {
    if (!el) return;
    if (ya) el.setAttribute("data-peran-sembunyi", "ya");
    else el.removeAttribute("data-peran-sembunyi");
  };
  for (const id of SAKLAR_PROFIL_ID) {
    const k = document.getElementById(id);
    sembunyi(k && k.closest("label.saklar"), Boolean(r) && !r.saklar.has(id));
  }
  for (const situs of SITUS_PANEL_ID) {
    const k = document.getElementById(`bawaanPanel-${situs}`);
    sembunyi(k && k.closest("label.saklar"), Boolean(r) && !r.panel.has(situs));
  }
  for (const g of Array.from(document.querySelectorAll(".tb-kelompok"))) {
    const kode = g.getAttribute("data-kelompok");
    if (!["sipp", "abt", "portal", "bawaan-panel"].includes(kode)) continue;
    const label = Array.from(g.querySelectorAll("label.saklar"));
    sembunyi(g, Boolean(r) && label.length > 0 && label.every((l) => l.hasAttribute("data-peran-sembunyi")));
  }
  const khusus = !popupSuperAdmin();
  for (const el of Array.from(document.querySelectorAll(".aleta-hanya-super"))) sembunyi(el, khusus);
}

/** Kartu "Profil saklar" hanya untuk Super Admin dan Admin (peran lain: profil mengikuti perannya). */
function stripProfilBoleh() {
  return !identitasPopup || popupAdmin();
}

/**
 * ----------------------------------------------------------------------------
 * PEMBERITAHUAN VERSI BARU (puncak jendela)
 * ----------------------------------------------------------------------------
 * Sumber: versi yang disajikan portal (?info=siapa) dan catatan latar.js
 * ("pembaruanOtomatis": paket yang sudah diunduh / versi yang sudah diunduh
 * Chrome). "Perbaharui" menekan tombol Perbarui sekarang yang sudah ada -
 * satu aturan untuk dua jalan masuk.
 */
function versiBaruPopup() {
  const p = keadaanPortal.versi;
  const dariPortal = terpasang && p && bandingVersi(p, terpasang) > 0 ? p : "";
  const dariLatar = [pembaruanLatar.versiPortal, pembaruanLatar.menunggu, pembaruanLatar.diunduh && pembaruanLatar.diunduh.versi]
    .filter((v) => v && terpasang && bandingVersi(v, terpasang) > 0)
    .sort((a, b) => bandingVersi(b, a))[0];
  return [dariPortal, dariLatar || ""].filter(Boolean).sort((a, b) => bandingVersi(b, a))[0] || "";
}

function gambarPemberitahuanVersi() {
  const el = document.getElementById("pemberitahuanVersi");
  if (!el) return;
  const baru = versiBaruPopup();
  el.hidden = !baru;
  if (!baru) return;
  const teks = document.getElementById("pemberitahuanVersiTeks");
  const siap = pembaruanLatar.diunduh && pembaruanLatar.diunduh.versi === baru;
  const menunggu = pembaruanLatar.menunggu === baru;
  if (teks) {
    teks.textContent =
      `Versi baru ${baru} tersedia (terpasang ${terpasang}).` +
      (menunggu ? " Sudah diunduh Chrome - tinggal dipasang." : siap ? " Paketnya sudah diunduh otomatis." : "");
  }
  const lihat = document.getElementById("tampilkanPaketBaru");
  if (lihat) lihat.hidden = !(siap && pembaruanLatar.diunduh.id);
}

function pasangPemberitahuanVersi() {
  const tautan = document.getElementById("tautanPerbaharui");
  const lihat = document.getElementById("tampilkanPaketBaru");
  if (tautan && !tautan.dataset.terpasang) {
    tautan.dataset.terpasang = "ya";
    tautan.addEventListener("click", (e) => {
      e.preventDefault();
      if (tombolPerbarui && !tombolPerbarui.disabled) tombolPerbarui.click();
    });
  }
  if (lihat && !lihat.dataset.terpasang) {
    lihat.dataset.terpasang = "ya";
    lihat.addEventListener("click", () => {
      const d = pembaruanLatar.diunduh;
      if (d && d.id) void mintaKeLatar("tampilkan-unduhan", false, { id: d.id });
    });
  }
  document.addEventListener("aleta-popup-portal", gambarPemberitahuanVersi);
  if (penyimpanan) {
    void penyimpanan
      .get([KUNCI_PEMBARUAN_OTOMATIS])
      .then((s) => {
        catatPembaruanLatar(s && s[KUNCI_PEMBARUAN_OTOMATIS]);
        gambarPemberitahuanVersi();
      })
      .catch(() => {});
  }
}

function catatPembaruanLatar(x) {
  const o = x && typeof x === "object" && !Array.isArray(x) ? x : {};
  pembaruanLatar.versiPortal = String(o.versiPortal || "");
  pembaruanLatar.menunggu = String(o.menunggu || "");
  pembaruanLatar.diunduh = o.diunduh && typeof o.diunduh === "object" ? o.diunduh : null;
}

pasangPemberitahuanVersi();

/* === AKHIR POPUP-PERAN === */

// ── Diikuti selama jendela terbuka ───────────────────────────────────────────

document.addEventListener("aleta-popup-portal", () => segarkanSusunan());

try {
  chrome.storage.onChanged.addListener((ubah, tempat) => {
    if (tempat !== "local") return;
    let perlu = false;
    if (ubah[KUNCI_SENYAP]) {
      tahap2.senyapSampai = Number(ubah[KUNCI_SENYAP].newValue) || 0;
      perlu = true;
    }
    if (ubah.akunSipp) {
      tahap2.akunSipp = String(ubah.akunSipp.newValue || "");
      perlu = true;
    }
    // Saklar penjelasan teknis diubah dari widget di tab lain (K5).
    if (ubah[KUNCI_TEKNIS]) {
      tahap2.teknis = ubah[KUNCI_TEKNIS].newValue !== false;
      tandaiTeknisPopup();
      perlu = true;
    }
    // POPUP-PERAN 12 Okt: salinan setelan akun + pembaruan dari latar.js.
    if (KUNCI_SETELAN_AKUN.some((k) => ubah[k])) void catatSalinanAkun();
    if (ubah[KUNCI_PEMBARUAN_OTOMATIS]) {
      catatPembaruanLatar(ubah[KUNCI_PEMBARUAN_OTOMATIS].newValue);
      gambarPemberitahuanVersi();
    }
    // Profil peran (butir 25) tiba lewat singgahan tampilan server.
    if (ubah.tampilanServer) {
      const sv = ubah.tampilanServer.newValue;
      ujiKeadaan.server = sv && typeof sv === "object" && !Array.isArray(sv) ? sv : null;
      jadwalkanSusunan();
    }
    // Saklar yang berubah dari tab lain (× widget, profil di popup lain)
    // menggeser profil yang cocok.
    if (["tandaiHalaman", "sisipJadwal", "cetakTigaBerkas", "suntingLangsungAbt", "checklistMilestone"].some((k) => ubah[k])) {
      perlu = true;
    }
    if (perlu) segarkanSusunan();
  });
} catch {
  /* di luar konteks ekstensi: jendela ini digambar sekali saat dibuka */
}
