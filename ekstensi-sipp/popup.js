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
    .get(["aktif", "tandaiHalaman", "sisipJadwal", "cetakTigaBerkas", "asalPortal", SKALA_KUNCI])
    .then(pasangNilai)
    .catch(() => pasangNilai({}));
} else {
  pasangNilai({});
}

function simpan(kunci, nilai) {
  if (!penyimpanan) return;
  void penyimpanan.set({ [kunci]: nilai });
}

kotak.addEventListener("change", () => simpan("aktif", kotak.checked));
kotakTanda.addEventListener("change", () => simpan("tandaiHalaman", kotakTanda.checked));
kotakSisip.addEventListener("change", () => simpan("sisipJadwal", kotakSisip.checked));
if (kotakCetak) {
  kotakCetak.addEventListener("change", () => simpan("cetakTigaBerkas", kotakCetak.checked));
}

/**
 * ============================================================================
 * MENGEMBALIKAN PANEL YANG TERGESER KELUAR LAYAR
 * ============================================================================
 *
 * Yang dihapus hanya SATU kunci - posisiPanel, tempat letak dan ukuran panel
 * disimpan. Skrip konten mendengarkan penghapusan itu lalu mengembalikan
 * panelnya ke tempat bawaan, sehingga tidak perlu memuat ulang halaman dan
 * tidak perlu izin "tabs" hanya untuk menyentuh satu tab.
 *
 * Saklar tampil/sembunyi, tema, dan lipatan menu TIDAK ikut terhapus: yang
 * hilang dari layar adalah letaknya, dan membuang pengaturan lain sekalian
 * berarti menghukum petugas atas kesalahan yang tidak ia perbuat.
 */
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
      .remove("posisiPanel")
      .then(() => {
        kabarkan("Posisi panel dikembalikan. Buka kembali halaman SIPP bila belum terlihat.");
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
 * TEMA JENDELA INI
 * ============================================================================
 *
 * Tiga keadaan, berputar dengan satu tombol:
 *
 *   ikut peramban  tidak ada atribut - hanya prefers-color-scheme yang bicara
 *   terang         data-tema="terang", menang atas peramban yang gelap
 *   gelap          data-tema="gelap",  menang atas peramban yang terang
 *
 * Bawaannya mengikuti peramban. Itu yang paling jarang salah, dan yang tidak
 * pernah menyentuh tombol ini pun mendapat warna yang sama dengan seluruh
 * jendela lain di layarnya.
 *
 * Disimpan di penyimpanan ekstensi, bukan localStorage: jendela ini hidup di
 * origin chrome-extension:// dan tidak berbagi apa pun dengan halaman SIPP,
 * sedangkan pilihannya harus bertahan antar-jendela.
 */
const KUNCI_TEMA_POPUP = "temaPopup";
const URUTAN_TEMA = ["ikut", "terang", "gelap"];
const SEBUTAN_TEMA = { ikut: "ikut peramban", terang: "terang", gelap: "gelap" };

const tombolTema = document.getElementById("tombolTema");
let temaPopup = "ikut";

function terapkanTemaPopup() {
  const akar = document.documentElement;
  if (temaPopup === "ikut") akar.removeAttribute("data-tema");
  else akar.setAttribute("data-tema", temaPopup);
  if (tombolTema) tombolTema.textContent = `tema: ${SEBUTAN_TEMA[temaPopup]}`;
}

if (penyimpanan) {
  void penyimpanan
    .get([KUNCI_TEMA_POPUP])
    .then((simpan) => {
      const tersimpan = String((simpan && simpan[KUNCI_TEMA_POPUP]) || "");
      if (URUTAN_TEMA.includes(tersimpan)) temaPopup = tersimpan;
      terapkanTemaPopup();
    })
    .catch(() => terapkanTemaPopup());
} else {
  terapkanTemaPopup();
}

if (tombolTema) {
  tombolTema.addEventListener("click", () => {
    temaPopup = URUTAN_TEMA[(URUTAN_TEMA.indexOf(temaPopup) + 1) % URUTAN_TEMA.length];
    terapkanTemaPopup();
    if (penyimpanan) void penyimpanan.set({ [KUNCI_TEMA_POPUP]: temaPopup });
  });
}
