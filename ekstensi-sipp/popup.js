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
    .get(["aktif", "tandaiHalaman", "sisipJadwal", "cetakTigaBerkas", "suntingLangsungAbt", "checklistMilestone", "asalPortal", SKALA_KUNCI])
    .then(pasangNilai)
    .catch(() => pasangNilai({}));
} else {
  pasangNilai({});
}

function simpan(kunci, nilai) {
  if (!penyimpanan) return;
  void penyimpanan.set({ [kunci]: nilai });
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
}

async function mintaKeLatar(jenis, paksa) {
  if (typeof chrome === "undefined" || !chrome.runtime || !chrome.runtime.sendMessage) {
    return { ok: false, pesan: "Jendela ini tidak berjalan sebagai ekstensi." };
  }
  try {
    if (paksa) return await chrome.runtime.sendMessage({ sumber: "aleta-panel", jenis, paksa: true });
    return await chrome.runtime.sendMessage({ sumber: "aleta-panel", jenis });
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

if (tombolPerbarui) {
  const labelPerbarui = tombolPerbarui.textContent;
  tombolPerbarui.addEventListener("click", async () => {
    tombolPerbarui.disabled = true;
    kabarPerbarui("Menanyakan pembaruan kepada Chrome…");

    const jawab = paksaPerbarui ? await mintaKeLatar("perbarui", true) : await mintaKeLatar("perbarui");
    kabarPerbarui((jawab && jawab.pesan) || "Tidak ada jawaban dari ekstensi.");

    if (jawab && jawab.keadaan === "putaran-relaas-berjalan") {
      paksaPerbarui = true;
      tombolPerbarui.textContent = "Tetap perbarui - putaran cetak hilang";
      tombolPerbarui.disabled = false;
      return;
    }
    paksaPerbarui = false;
    tombolPerbarui.textContent = labelPerbarui;

    if (jawab && jawab.ok && jawab.keadaan === "dipasang") return;

    // Chrome tidak memasang apa pun. Jalan kedua ditawarkan hanya sekarang.
    if (tombolMuatUlangEkstensi) tombolMuatUlangEkstensi.hidden = false;
    tombolPerbarui.disabled = false;
  });
}

if (tombolMuatUlangEkstensi) {
  const labelMuatUlang = tombolMuatUlangEkstensi.textContent;
  tombolMuatUlangEkstensi.addEventListener("click", async () => {
    tombolMuatUlangEkstensi.disabled = true;
    kabarPerbarui("Memuat ulang ekstensi dari berkasnya…");
    const jawab = await mintaKeLatar("muat-ulang", paksaMuatUlang);
    if (jawab && jawab.keadaan === "putaran-relaas-berjalan") {
      kabarPerbarui(jawab.pesan || "Putaran cetak relaas belum selesai.");
      paksaMuatUlang = true;
      tombolMuatUlangEkstensi.textContent = "Tetap muat ulang - putaran cetak hilang";
      tombolMuatUlangEkstensi.disabled = false;
      return;
    }
    paksaMuatUlang = false;
    tombolMuatUlangEkstensi.textContent = labelMuatUlang;
    kabarPerbarui(
      (jawab && jawab.pesan) ||
        "Ekstensi sedang dimuat ulang. Muat ulang halaman SIPP yang terbuka sebentar lagi."
    );
  });
}

kotak.addEventListener("change", () => simpan("aktif", kotak.checked));
kotakTanda.addEventListener("change", () => simpan("tandaiHalaman", kotakTanda.checked));
kotakSisip.addEventListener("change", () => simpan("sisipJadwal", kotakSisip.checked));
if (kotakCetak) {
  kotakCetak.addEventListener("change", () => simpan("cetakTigaBerkas", kotakCetak.checked));
  if (kotakSunting) {
    kotakSunting.addEventListener("change", () => simpan("suntingLangsungAbt", kotakSunting.checked));
  }
}
if (kotakChecklist) {
  kotakChecklist.addEventListener("change", () => simpan("checklistMilestone", kotakChecklist.checked));
  // × di kepala widget mematikan saklar ini. Centangnya ikut lepas di sini
  // selama jendela ini terbuka - centang yang tertinggal menyala sementara
  // widgetnya sudah tertutup adalah saklar yang berbohong.
  try {
    chrome.storage.onChanged.addListener((ubah, tempat) => {
      if (tempat !== "local" || !ubah.checklistMilestone) return;
      kotakChecklist.checked = ubah.checklistMilestone.newValue === true;
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
    void pasangPemilihWarnaPopup(peran);
    // Pengalih uji tampilan - juga hanya bagi super admin, diputuskan di sini.
    void pasangUjiTampilan(peran);

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
}

async function muatUjiPopup() {
  if (!penyimpanan) return;
  try {
    const simpan = await penyimpanan.get([KUNCI_UJI_TAMPILAN, KUNCI_UJI_FITUR, KUNCI_UJI_NYATA, "tampilanServer"]);
    const sv = simpan && simpan.tampilanServer;
    ujiKeadaan.server = sv && typeof sv === "object" && !Array.isArray(sv) ? sv : null;
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
    // Bukan super admin, tetapi tampilan uji tertinggal menyala di PC ini:
    // disebut, dan boleh dikembalikan ke Lama - keadaan bawaan yang aman.
    if (lain) lain.hidden = ujiKeadaan.mode === "lama";
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
        if (penyimpanan) void penyimpanan.set({ [KUNCI_UJI_NYATA]: ujiKeadaan.nyata });
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
  return b.mode !== "lama" && b.fitur[String(kode || "")] === true;
}

/** Keadaan yang hanya dibaca bagian ini - dimuat sekali, lalu diikuti lewat onChanged. */
const tahap2 = { asalPortal: "", akunSipp: "", senyapSampai: 0, tandaBaru: {} };
const tandaBaruSesiIni = new Set();

async function muatTahap2() {
  if (!penyimpanan) return;
  try {
    const s = await penyimpanan.get(["asalPortal", "akunSipp", KUNCI_SENYAP, KUNCI_TANDA_BARU]);
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
  if (mode === "lama") return;
  atributSementara(document.documentElement, "data-susunan", mode);
  if (mode === "ui") susunUiBaru();
  else susunBaru();
  simpanTandaBaru();
  segarkanSusunan();
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
  suntingLangsungAbt: "Mati: sunting lewat tombol Sunting.",
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
  { kode: "abt", judul: "ABT", isi: ["suntingLangsungAbt", "cetakTigaBerkas"] },
  { kode: "portal", judul: "Portal", isi: ["checklistMilestone"] },
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
      if (x.hidden) continue;
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
const PROFIL_SAKLAR = [
  {
    kode: "hakim",
    nama: "Hakim",
    saklar: { tandaiHalaman: true, sisipJadwal: true, cetakTigaBerkas: false, suntingLangsungAbt: false, checklistMilestone: true },
  },
  {
    kode: "pp",
    nama: "Panitera Pengganti",
    pendek: "PP",
    saklar: { tandaiHalaman: true, sisipJadwal: true, cetakTigaBerkas: true, suntingLangsungAbt: false, checklistMilestone: true },
  },
  {
    kode: "jurusita",
    nama: "Juru Sita",
    saklar: { tandaiHalaman: true, sisipJadwal: false, cetakTigaBerkas: false, suntingLangsungAbt: false, checklistMilestone: true },
  },
];

/** Profil yang cocok dengan saklar sekarang; "kustom" bila tidak ada. */
function profilSekarang() {
  for (const p of PROFIL_SAKLAR) {
    const cocok = Object.entries(p.saklar).every(([id, nilai]) => {
      const k = document.getElementById(id);
      return k && k.checked === nilai;
    });
    if (cocok) return p.kode;
  }
  return "kustom";
}

/**
 * Menyetel saklar lewat KOTAK CENTANG ASLINYA, dengan peristiwa change -
 * sehingga yang menyimpan tetap pendengar lama, satu-satunya penulis kunci
 * itu. Tidak ada salinan aturan simpan di sini.
 */
function terapkanProfil(kode) {
  const p = PROFIL_SAKLAR.find((x) => x.kode === kode);
  if (!p) return;
  for (const [id, nilai] of Object.entries(p.saklar)) {
    const k = document.getElementById(id);
    if (!k || k.checked === nilai) continue;
    k.checked = nilai;
    k.dispatchEvent(new Event("change", { bubbles: true }));
  }
  segarkanSusunan();
}

function komponenProfil() {
  const k = kartuFitur("popup-11", "Profil saklar");
  k.id = "tbProfil";
  const seg = buat("div", "uji-seg tb-seg");
  seg.setAttribute("role", "group");
  seg.setAttribute("aria-label", "Profil saklar per peran");
  const tombol = [];
  for (const p of [...PROFIL_SAKLAR, { kode: "kustom", nama: "Kustom" }]) {
    // "PP", bukan "Panitera Pengganti": empat tombol sebaris di kartu selebar
    // 270 piksel - nama lengkapnya memotong "Kustom". Nama lengkap di title.
    const b = buat("button", "", p.pendek || p.nama);
    b.type = "button";
    b.dataset.profil = p.kode;
    if (p.saklar) b.title = `Setel saklar untuk ${p.nama}`;
    else b.title = "Atur saklar satu per satu di bawah";
    b.addEventListener("click", () => (p.saklar ? terapkanProfil(p.kode) : null));
    seg.appendChild(b);
    tombol.push(b);
  }
  const ket = buat(
    "p",
    "saklar-ket",
    "Menyetel lima saklar sekaligus; saklar induk tidak disentuh. Ubah satu saklar → Kustom."
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
      const kunci = KUNCI_LETAK_PANEL.filter((k) => (k.startsWith("posisiChecklist") ? widget : panel));
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
  const waktu = buat("span", "saklar-ket tb-lampu-waktu");
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
    buat("p", "saklar-ket", "Saklar, tema, dan ukuran huruf saja - tanpa akun, sesi, posisi layar, atau data perkara.")
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
    buat("p", "saklar-ket", "Tidak berlaku selagi mengetik di kolom isian. Mengubah pintasan belum tersedia.")
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
  if (fiturPopupNyala("popup-27")) kartu.push(komponenBatasSitus());
  if (fiturPopupNyala("popup-10")) kartu.push(komponenVersi());
  if (fiturPopupNyala("popup-11")) kartu.push(komponenProfil());
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
    judul.appendChild(buat("span", "saklar-ket", " saklar ide yang dinyalakan Super Admin"));
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
  const v = keadaanVersi();
  if (v.kode === "usang") hasil.push({ teks: `Ekstensi ${terpasang} - ${v.teks}.`, perbarui: true });
  return hasil;
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
  kepala.appendChild(perbaiki);
  const ringkas = buat("p", "saklar-ket tb-status-ringkas");
  const masalah = buat("ul", "tb-status-masalah");
  k.appendChild(kepala);
  k.appendChild(ringkas);
  k.appendChild(masalah);
  if (fiturPopupNyala("popup-2")) k.appendChild(komponenLampu(false));
  const rincian = buat("details", "tb-rincian");
  rincian.appendChild(buat("summary", "", "Rincian: versi dan akun"));
  k.appendChild(rincian);
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
    if (!p.selesai) {
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
  if (fiturPopupNyala("popup-27")) sisipkan(komponenBatasSitus(), kartu.parentNode, kartu.nextSibling);

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

  // Bagian atas isi: profil (popup-11), cari (popup-15), lompat (popup-3).
  const atas = [];
  if (fiturPopupNyala("popup-11")) atas.push(komponenProfil());
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
