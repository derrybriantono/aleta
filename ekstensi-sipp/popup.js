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
    .get(["aktif", "tandaiHalaman", "sisipJadwal", "cetakTigaBerkas", "suntingLangsungAbt", "asalPortal", SKALA_KUNCI])
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
          "Posisi panel dikembalikan - SIPP, ABT, dan portal ALETA. Panel yang terciut ikut dibentangkan lagi."
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
      return;
    }
    if (!respons.ok) {
      tulisKeadaan(kolomAleta, `portal menjawab ${respons.status}`, { kosong: true });
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
    // Pemilih warna gelap hanya bagi super admin - diputuskan di sini, sesudah
    // portal menjawab siapa yang masuk. Sebelum itu barisnya tersembunyi.
    void pasangPemilihWarnaPopup(peran);

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
    temaPopup = URUTAN_TEMA[(URUTAN_TEMA.indexOf(temaPopup) + 1) % URUTAN_TEMA.length];
    terapkanTemaPopup();
    if (!penyimpanan) return;
    void penyimpanan.set({ [KUNCI_TEMA_POPUP]: temaPopup });
    // Pilihan tegas ikut menggerakkan panel. "ikut" tidak: ia mengikuti, dan
    // yang mengikuti tidak menyuruh.
    if (temaPopup === "terang" || temaPopup === "gelap") {
      temaPanelSekarang = temaPopup;
      void penyimpanan.set({ [KUNCI_TEMA_PANEL]: temaPopup });
    }
  });
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
