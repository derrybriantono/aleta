"use strict";

// Deteksi sisa blangko (17 Okt 2026): dipakai putaran relaas massal di bawah. Gagal memuat tidak
// boleh mengganggu pekerja latar - relaas tetap tercetak tanpa pemeriksaan.
try {
  if (typeof importScripts === "function") importScripts("deteksi-sisa-blangko.js");
  // K1 (19 Okt 2026): alamat portal yang hidup - port 8008 atau cadangan port 80.
  if (typeof importScripts === "function") importScripts("alamat-portal.js");
} catch {
  /* tanpa pemeriksaan */
}

/**
 * ============================================================================
 * PEKERJA LATAR - SATU-SATUNYA TEMPAT PEMBARUAN DAPAT DIMINTA
 * ============================================================================
 *
 * Memperbarui ekstensi menuntut dua panggilan yang HANYA ada di dalam konteks
 * ekstensi: chrome.runtime.requestUpdateCheck() dan chrome.runtime.reload().
 * Skrip konten - panel yang tergambar di halaman SIPP, ABT, dan ALETA - tidak
 * punya keduanya; chrome.runtime miliknya hanya sanggup mengirim pesan.
 *
 * Karena itu tombol "Perbarui sekarang" di panel tidak mengerjakan apa pun
 * sendiri. Ia mengirim pesan ke sini, dan berkas inilah yang meminta Chrome
 * memeriksa pembaruan lalu memasangnya.
 *
 * ============================================================================
 * APA YANG SESUNGGUHNYA TERJADI, MENURUT CARA PEMASANGANNYA
 * ============================================================================
 *
 * Ada dua cara ekstensi ini terpasang, dan keduanya berperilaku berbeda -
 * perbedaan itu harus dikatakan kepada petugas, bukan disamarkan menjadi satu
 * pesan "berhasil" yang sama:
 *
 *   TERPASANG SEBAGAI CRX (peladen, lewat kebijakan Chrome)
 *     requestUpdateCheck menanyakan updates.xml di portal. Bila ada versi yang
 *     lebih baru, Chrome MENGUNDUH DAN MEMASANGNYA sendiri, lalu reload()
 *     memberlakukannya seketika. Inilah pemasangan sekali klik yang sebenarnya.
 *
 *   TERPASANG TIDAK TERKEMAS (Load unpacked, dipakai saat mengembangkan)
 *     Chrome MENGABAIKAN update_url sama sekali, jadi requestUpdateCheck selalu
 *     menjawab "no_update" betapa pun barunya versi di portal. Yang tetap
 *     berguna: reload() membaca ULANG berkas dari foldernya di disk. Selama
 *     foldernya sudah disamakan dengan rilis terbaru, satu tekanan tombol ini
 *     menggantikan perjalanan ke chrome://extensions.
 *
 * ============================================================================
 * YANG TIDAK DAPAT DIKERJAKAN, DAN KENAPA
 * ============================================================================
 *
 * Ekstensi TIDAK dapat menulis ke foldernya sendiri. Tidak ada API untuk itu,
 * dan ketiadaannya disengaja Chrome: ekstensi yang dapat menimpa kodenya
 * sendiri dari halaman web adalah ekstensi yang dapat dibajak halaman web.
 *
 * Karena itu pada pemasangan tidak terkemas, berkasnya tetap harus sampai ke
 * folder lebih dahulu - oleh skrip rilis, bukan oleh tombol ini. Yang
 * dikerjakan tombol adalah langkah sesudahnya, dan itu memang langkah yang
 * selama ini paling sering terlupa.
 */

/** Sekat waktu supaya jawaban sempat sampai ke panel sebelum ekstensi mati. */
const JEDA_MUAT_ULANG = 400;

/** Versi yang Chrome laporkan sudah diunduh dan menunggu dipasang. */
let versiMenunggu = "";

/**
 * Chrome memberi tahu ketika CRX yang lebih baru sudah diunduh.
 *
 * Pembaruan itu baru benar-benar terpasang sesudah ekstensi dimuat ulang.
 * TIDAK dimuat ulang di sini: petugas mungkin sedang di tengah mengisi borang
 * penetapan, dan panel yang lenyap di saat itu membuang pekerjaannya. Yang
 * dikerjakan hanya mencatatnya, supaya panel dapat menawarkan pemasangannya.
 */
/** Kunci chrome.storage.session untuk versi yang sudah diunduh Chrome. */
const KUNCI_VERSI_MENUNGGU = "aletaVersiMenunggu";

chrome.runtime.onUpdateAvailable.addListener((rincian) => {
  versiMenunggu = String((rincian && rincian.version) || "");
  // Pekerja MV3 mati tiap +-30 detik menganggur, dan peristiwa ini TIDAK
  // berbunyi lagi untuk pekerja berikutnya. Ingatan modul saja membuat versi
  // yang sudah diunduh terlupa (uji rilis 9 Okt 2026) - jadi ia dititipkan ke
  // chrome.storage.session, yang dikosongkan Chrome sendiri begitu ekstensi
  // dimuat ulang atau diperbarui.
  try {
    const titip = chrome.storage.session.set({ [KUNCI_VERSI_MENUNGGU]: versiMenunggu });
    if (titip && typeof titip.catch === "function") titip.catch(() => {});
  } catch {
    /* tanpa storage.session: ingatan modul saja, seperti sebelumnya */
  }
});

/**
 * Versi yang sudah diunduh Chrome dan menunggu dipasang - dari ingatan, atau
 * dari titipan pekerja sebelumnya. Titipan yang tidak lebih baru dari versi
 * terpasang berarti pembaruannya sudah berlaku: diabaikan.
 */
async function bacaVersiMenunggu() {
  if (versiMenunggu) return versiMenunggu;
  let titipan = "";
  try {
    const isi = await chrome.storage.session.get([KUNCI_VERSI_MENUNGGU]);
    titipan = String((isi && isi[KUNCI_VERSI_MENUNGGU]) || "");
  } catch {
    return "";
  }
  if (!titipan) return "";
  const sekarang = String(chrome.runtime.getManifest().version || "");
  if (bandingkanVersi(titipan, sekarang) <= 0) return "";
  versiMenunggu = titipan;
  return versiMenunggu;
}

/** -1 / 0 / 1 untuk versi bertitik seperti "1.188.0". */
function bandingkanVersi(a, b) {
  const pa = String(a || "").split(".").map((x) => Number.parseInt(x, 10) || 0);
  const pb = String(b || "").split(".").map((x) => Number.parseInt(x, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i += 1) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d !== 0) return d > 0 ? 1 : -1;
  }
  return 0;
}

/** Menjadwalkan pemuatan ulang, sesudah jawabannya sempat terkirim. */
function muatUlangSebentarLagi() {
  setTimeout(() => {
    try {
      chrome.runtime.reload();
    } catch {
      /* sudah dimuat ulang oleh sebab lain - tidak ada yang perlu dikerjakan */
    }
  }, JEDA_MUAT_ULANG);
}

/**
 * Memeriksa pembaruan, lalu memasangnya bila ada.
 *
 * Yang dipulangkan menyebutkan APA YANG TERJADI, bukan sekadar berhasil atau
 * gagal - sebab "no_update" pada pemasangan tidak terkemas berarti sesuatu
 * yang sama sekali berbeda dari "no_update" pada CRX.
 */
async function perbaruiSekarang(opsi) {
  const paksa = Boolean(opsi && opsi.paksa);
  const versiSekarang = String(chrome.runtime.getManifest().version || "");

  // Sudah pernah diunduh Chrome dan tinggal dipasang - tidak perlu bertanya
  // lagi ke portal. Dibaca juga dari titipan pekerja sebelumnya.
  await bacaVersiMenunggu();
  if (versiMenunggu) {
    const cegah = paksa ? null : await penghalangMuatUlang();
    if (cegah) return tahanMuatUlang(cegah, versiSekarang, versiMenunggu);
    muatUlangSebentarLagi();
    return {
      ok: true,
      keadaan: "dipasang",
      versiSekarang,
      versiBaru: versiMenunggu,
      pesan: `Versi ${versiMenunggu} sudah diunduh Chrome dan sedang dipasang. Muat ulang halaman ini sebentar lagi.`,
    };
  }

  // POPUP-PERAN 12 Okt: pemasangan folder (Load unpacked) tidak dapat memasang
  // sendiri - yang dapat dikerjakan: mengunduh paket ZIP terbarunya.
  if ((await jenisPemasangan()) === "development") {
    const paket = await siapkanPaketManual(versiSekarang);
    if (paket) return paket;
  }

  let hasil = null;
  let galat = "";
  try {
    hasil = await chrome.runtime.requestUpdateCheck();
  } catch (e) {
    galat = String((e && e.message) || e);
  }

  const keadaan = String((hasil && hasil.status) || "");

  if (keadaan === "update_available") {
    const cegah = paksa ? null : await penghalangMuatUlang();
    if (cegah) {
      return tahanMuatUlang(cegah, versiSekarang, String((hasil && hasil.version) || ""));
    }
    muatUlangSebentarLagi();
    return {
      ok: true,
      keadaan: "dipasang",
      versiSekarang,
      versiBaru: String((hasil && hasil.version) || ""),
      pesan: "Pembaruan ditemukan dan sedang dipasang. Muat ulang halaman ini sebentar lagi.",
    };
  }

  if (keadaan === "throttled") {
    return {
      ok: false,
      keadaan: "ditahan",
      versiSekarang,
      pesan:
        "Chrome menahan pemeriksaan pembaruan karena baru saja diperiksa. Coba lagi beberapa menit lagi, " +
        "atau muat ulang ekstensinya langsung dari tombol di bawah.",
    };
  }

  // no_update, atau permintaannya ditolak sama sekali. Pada pemasangan tidak
  // terkemas keduanya selalu terjadi, dan itu BUKAN galat - Chrome memang
  // mengabaikan update_url di sana.
  return {
    ok: false,
    keadaan: galat ? "tidak_didukung" : "tidak_ada_pembaruan",
    versiSekarang,
    pesan: galat
      ? "Chrome tidak melayani pemeriksaan pembaruan untuk pemasangan ini - lazimnya karena ekstensinya dimuat sebagai folder (Load unpacked). Tombol muat ulang di bawah tetap berlaku: ia membaca ulang berkas dari foldernya."
      : "Chrome menjawab tidak ada pembaruan. Bila versi di portal memang lebih baru, ekstensinya dimuat sebagai folder - Chrome mengabaikan pembaruan otomatis di sana. Pakai tombol muat ulang di bawah.",
  };
}

/**
 * ============================================================================
 * UNDUHAN ABT YANG BERNAMA "download" DIBERI NAMA PERKARANYA
 * ============================================================================
 *
 * ABT menjawab tombol CETAK tanpa nama berkas yang masuk akal, jadi Chrome
 * menamainya "download.rtf", "download.pdf", "download (1).rtf". Tiga berkas
 * putusan tiga perkara berbeda karena itu tidak dapat dibedakan di folder
 * unduhan tanpa membukanya satu per satu.
 *
 * Yang diubah HANYA nama yang benar-benar umum, dan HANYA bila datang dari
 * alamat ABT. Nama yang sudah bermakna - dari mana pun - tidak disentuh:
 * menimpa nama yang dipilih orang lain jauh lebih merugikan daripada
 * membiarkan satu berkas bernama "download".
 *
 * Konteksnya juga harus BARU. Nomor perkara dari setengah jam lalu ditempelkan
 * ke unduhan perkara lain adalah kekeliruan yang tidak akan pernah disadari -
 * berkasnya terbuka benar, hanya namanya berbohong.
 */
const UMUR_KONTEKS_UNDUH = 5 * 60 * 1000;
const POLA_NAMA_UMUM = /^download(?:\s*\(\d+\))?\.(rtf|pdf|doc|docx)$/i;
const KUNCI_KONTEKS_UNDUH = "aleta-konteks-unduh";

/**
 * ============================================================================
 * KONTEKSNYA DISIMPAN, BUKAN DIINGAT - PEKERJA MV3 DIMATIKAN TIAP ±30 DETIK
 * ============================================================================
 *
 * Sebelumnya konteks ini satu variabel modul: `let konteksAbt = null`. Pada
 * Manifest V3 pekerja latar bukan halaman yang hidup terus - Chrome
 * mematikannya sesudah kira-kira tiga puluh detik menganggur, dan seluruh
 * variabelnya hilang bersamanya. Halaman ABT mengabarkan konteksnya SEKALI
 * saat dibuka; ketika petugas menekan CETAK beberapa menit kemudian, pekerja
 * itu dibangunkan oleh unduhannya sendiri - dengan konteks kosong.
 *
 * Akibatnya tidak berbunyi sama sekali: berkasnya tersimpan, hanya bernama
 * "download.rtf", "download (2).pdf", dan seterusnya. Terlihat pada folder
 * unduhan 16 September 2026: enam berkas bernama download pada hari yang sama
 * ketika unduhan lewat panel ALETA - yang menyebut namanya sendiri kepada
 * chrome.downloads - bernama benar.
 *
 * chrome.storage.session hidup di luar pekerjanya dan ikut terhapus ketika
 * peramban ditutup - persis umur yang pantas bagi keterangan ini. Peramban
 * yang belum mengenalnya jatuh ke storage.local, dan di sana umurnya dijaga
 * UMUR_KONTEKS_UNDUH yang sama.
 */
function penyimpananKonteks() {
  return (chrome.storage && chrome.storage.session) || (chrome.storage && chrome.storage.local) || null;
}

async function simpanKonteksUnduh(konteks) {
  const gudang = penyimpananKonteks();
  if (!gudang) return;
  try {
    await gudang.set({ [KUNCI_KONTEKS_UNDUH]: konteks });
  } catch {
    // Penyimpanan penuh atau ditolak - unduhannya tetap tersimpan, hanya
    // namanya yang tidak berubah.
  }
}

async function bacaKonteksUnduh() {
  const gudang = penyimpananKonteks();
  if (!gudang) return null;
  try {
    const isi = await gudang.get(KUNCI_KONTEKS_UNDUH);
    const konteks = isi && isi[KUNCI_KONTEKS_UNDUH];
    if (!konteks || !konteks.nomor) return null;
    return Date.now() - Number(konteks.saat || 0) < UMUR_KONTEKS_UNDUH ? konteks : null;
  } catch {
    return null;
  }
}

/**
 * Nama yang diusulkan bagi satu unduhan - dipisah supaya dapat diuji.
 *
 * Bentuknya SAMA dengan namaBerkas di abt.js: nomor perkara - jenis perkara -
 * status putusan. Dua jalur unduhan yang menamai berkasnya dengan dua bentuk
 * berbeda membuat satu perkara punya dua pola nama di folder yang sama, dan
 * yang mencarinya harus tahu lewat jalur mana berkas itu turun.
 *
 * Bentuk lama menempelkan `keterangan` - potongan kepala halaman blangko - dan
 * kata "putusan" pada tiap berkas. Yang pertama bukan jenis perkara; yang
 * kedua menjadikan seluruh berkas bernama sama ketika perkaranya sama.
 */
/** Memotong nama tanpa memakan akhirannya. */
function potongNamaBerkas(nama, batas) {
  if (nama.length <= batas) return nama;
  const titik = nama.lastIndexOf(".");
  if (titik <= 0 || nama.length - titik > 8) return nama.slice(0, batas);
  const akhiran = nama.slice(titik);
  return nama.slice(0, Math.max(1, batas - akhiran.length)) + akhiran;
}

function namaUnduhanAbt(nama, konteks) {
  const akhiran = (String(nama).split(".").pop() || "rtf").toLowerCase();
  const bagian = [konteks.nomor, konteks.jenisPerkara, konteks.statusPutusan].filter(Boolean);
  return `${bagian.join(" - ")}.${akhiran}`.replace(/[\\/:*?"<>|]+/g, "_");
}

/**
 * ============================================================================
 * DIJAWAB SEKETIKA - MENUNGGU MEMBUAT UNDUHANNYA TERTAHAN
 * ============================================================================
 *
 * 2.19.7 menjawab MENYUSUL: pendengarnya memulangkan true, membaca
 * penyimpanan, baru menyarankan namanya. Chrome mengizinkan bentuk itu, dan
 * ujinya hijau - tetapi di peramban petugas hasilnya "Insecure download
 * blocked" pada unduhan ABT yang sebelumnya lewat begitu saja. Unduhan yang
 * tertahan jauh lebih merugikan daripada berkas bernama "download": yang
 * pertama menghentikan pekerjaan, yang kedua hanya merepotkan.
 *
 * Karena itu jawabannya kembali SEKETIKA, dari salinan di ingatan. Ingatan
 * pekerja MV3 memang hilang tiap ±30 detik menganggur (lihat 2.19.7), dan itu
 * ditutup dari dua arah:
 *
 *   - penyimpanan sesi MEMULIHKANNYA saat pekerjanya bangun - menolong ketika
 *     unduhannya datang beberapa detik sesudah pekerja hidup kembali;
 *   - halaman ABT menyegarkan konteksnya pada tiap `pointerdown`, yaitu
 *     beberapa milidetik SEBELUM tombol CETAK menerbitkan unduhannya. Pesan
 *     itu sendiri yang membangunkan pekerjanya, dan ia tiba lebih dahulu.
 *
 * Yang tidak tertutup - konteksnya belum sempat pulih - berakhir dengan nama
 * bawaan ABT. Itu kekurangan yang terlihat dan dapat diperbaiki orang;
 * unduhan yang tertahan tidak.
 */
let konteksIngatan = null;

/**
 * ============================================================================
 * ANTREAN NAMA UNDUHAN - BUKAN SATU SLOT
 * ============================================================================
 *
 * Bentuk sebelumnya menyimpan SATU nama, dan pendengar onDeterminingFilename
 * menghapusnya begitu dipakai. Selama unduhannya satu per satu dan pekerjanya
 * hidup terus, itu cukup. Unduhan MASSAL melanggar kedua andaian itu:
 *
 *   - beberapa unduhan dapat lahir sebelum yang pertama sempat dinamai, dan
 *     yang kedua menimpa slotnya; sisanya turun bernama "download";
 *   - pekerja MV3 mati kira-kira tiap tiga puluh detik, sedangkan unduhan
 *     massal berjalan bermenit-menit. Variabel modulnya hilang di tengah
 *     jalan tanpa satu pun galat.
 *
 * Antrean ini disimpan di chrome.storage.session, jadi ia selamat dari pekerja
 * yang mati, dan ia memuat lebih dari satu nama. Urutannya masuk-keluar:
 * Chrome menerbitkan onDeterminingFilename menurut urutan unduhan dibuat.
 *
 * DIBATASI UMUR DAN JUMLAH, dan itu bukan kerapian. Unduhan yang batal tidak
 * pernah memanggil pendengarnya; nama yang tertinggal akan dipakai berkas
 * BERIKUTNYA - berkas yang salah nama, dan salahnya diam.
 */
const KUNCI_ANTREAN = "aletaAntreanNama";
const UMUR_NAMA = 5 * 60 * 1000;
const BATAS_ANTREAN = 500;

let antreanNama = [];

/** Membuang yang kedaluwarsa - dipanggil pada tiap sentuhan antrean. */
function bersihkanAntrean(daftar) {
  const sekarang = Date.now();
  return (Array.isArray(daftar) ? daftar : [])
    .filter((x) => x && typeof x.nama === "string" && sekarang - Number(x.saat || 0) < UMUR_NAMA)
    .slice(-BATAS_ANTREAN);
}

function simpanAntrean() {
  try {
    if (chrome.storage && chrome.storage.session) {
      void chrome.storage.session.set({ [KUNCI_ANTREAN]: antreanNama });
    }
  } catch {
    // Penyimpanan sesi yang gagal tidak boleh menggagalkan unduhannya - yang
    // hilang hanya ketahanan terhadap pekerja yang mati.
  }
}

/**
 * Dipulihkan sekali saat pekerja bangun.
 *
 * TIDAK ditunggu siapa pun. Menunggunya berarti pesan `unduh` yang tiba lebih
 * dahulu tertahan, dan penundaan itulah cacat yang dahulu sudah diperbaiki.
 */
void (async () => {
  try {
    if (!chrome.storage || !chrome.storage.session) return;
    const isi = await chrome.storage.session.get(KUNCI_ANTREAN);
    const pulih = bersihkanAntrean(isi && isi[KUNCI_ANTREAN]);
    // Yang sudah masuk selagi pemulihan berjalan didahulukan - ia lebih baru.
    if (pulih.length) antreanNama = [...pulih, ...antreanNama];
  } catch {
    // Antrean yang tidak terbaca menyisakan perilaku lama, bukan kegagalan.
  }
})();

/** Menaruh satu nama untuk unduhan yang sebentar lagi dibuat. */
function antrikanNama(nama) {
  antreanNama = bersihkanAntrean([...antreanNama, { nama, saat: Date.now() }]);
  simpanAntrean();
}

/** Mengambil nama terdepan yang masih berlaku, atau kosong bila tidak ada. */
function ambilNamaAntrean() {
  antreanNama = bersihkanAntrean(antreanNama);
  const depan = antreanNama.shift();
  simpanAntrean();
  return depan ? depan.nama : "";
}

// Dipulihkan sekali saat pekerja bangun. Tidak ditunggu siapa pun: yang
// menunggu justru cacat yang baru saja diperbaiki.
void bacaKonteksUnduh().then((konteks) => {
  if (konteks && !konteksIngatan) konteksIngatan = konteks;
});

if (chrome.downloads && chrome.downloads.onDeterminingFilename) {
  chrome.downloads.onDeterminingFilename.addListener((barang, sarankan) => {
    try {
      const nama = String((barang && barang.filename) || "");
      const alamat = String((barang && barang.url) || "");

      // ----------------------------------------------------------------
      // UNDUHAN EKSTENSI SENDIRI - NAMANYA DISARANKAN DI SINI, BUKAN
      // DIANDALKAN PADA chrome.downloads.download
      // ----------------------------------------------------------------
      //
      // Jalur panel sudah menyerahkan nama lengkap lewat properti `filename`,
      // dan tetap tersimpan sebagai "download (11).rtf". Sebabnya terbaca dari
      // riwayat unduhan peramban: unduhan itu beralamat `data:` dan TANPA
      // referrer, sehingga pagar `dariAbt` di bawah bernilai salah, pendengar
      // ini mundur, dan nama bawaan peramban yang dipakai. Sembilan dari
      // sembilan unduhan beratribut ekstensi bernama "download (n)", sedangkan
      // berkas yang SAMA yang turun lewat tautan halaman bernama benar.
      //
      // Pendengar inilah satu-satunya yang benar-benar dapat memaksakan nama,
      // jadi di sinilah ia disarankan - serentak, tanpa menunggu apa pun,
      // supaya unduhannya tidak tertahan seperti pada 2.19.7.
      if (alamat.startsWith("data:")) {
        const diminta = ambilNamaAntrean();
        if (diminta) {
          sarankan({ filename: diminta, conflictAction: "uniquify" });
          return true;
        }
        // Antrean kosong pada alamat data: berarti namanya hilang di jalan -
        // pekerja yang mati, atau unduhan yang bukan dari panel. Nama yang
        // dibawa unduhannya sendiri masih lebih baik daripada "download".
        if (nama && !POLA_NAMA_UMUM.test(nama)) {
          sarankan({ filename: nama, conflictAction: "uniquify" });
          return true;
        }
      }

      const asal = `${alamat} ${(barang && barang.referrer) || ""}`;
      const dariAbt = /\/aps_badilag\//i.test(asal) || /\/abt\//i.test(asal);
      const segar =
        konteksIngatan && Date.now() - Number(konteksIngatan.saat || 0) < UMUR_KONTEKS_UNDUH;

      if (!dariAbt || !segar || !POLA_NAMA_UMUM.test(nama)) return false;

      sarankan({ filename: namaUnduhanAbt(nama, konteksIngatan), conflictAction: "uniquify" });
      return true;
    } catch {
      return false;
    }
  });
}

/**
 * Mengikuti satu unduhan sebentar, lalu melaporkan keadaannya.
 *
 * BATAS WAKTUNYA PENDEK DAN ITU DISENGAJA. Panel menunggu jawaban ini sebelum
 * meneruskan ke berkas berikutnya; menunggu lama membuat tiga berkas terasa
 * seperti aplikasi yang menggantung. Unduhan yang belum selesai dalam waktu
 * itu dianggap BERHASIL - ia memang sedang berjalan, dan yang diperiksa di
 * sini penolakan seketika, bukan kecepatan cakram.
 */
const BATAS_PANTAU_UNDUH_MS = 2500;

function ikutiUnduhan(id, selesai) {
  let sudah = false;
  const tutup = (hasil) => {
    if (sudah) return;
    sudah = true;
    try {
      chrome.downloads.onChanged.removeListener(dengar);
    } catch {
      /* pendengar sudah lepas */
    }
    selesai(hasil);
  };

  const dengar = (ubah) => {
    if (!ubah || ubah.id !== id) return;
    const keadaan = ubah.state && ubah.state.current;
    if (keadaan === "complete") {
      tutup({ ok: true, id });
      return;
    }
    if (keadaan === "interrupted") {
      const sebab = (ubah.error && ubah.error.current) || "terputus";
      tutup({ ok: false, id, pesan: `unduhan diblokir peramban (${sebab})` });
    }
  };

  try {
    chrome.downloads.onChanged.addListener(dengar);
  } catch {
    tutup({ ok: true, id });
    return;
  }
  setTimeout(() => tutup({ ok: true, id }), BATAS_PANTAU_UNDUH_MS);
}

/**
 * Mengambil SATU berkas statis dokumen SIPP untuk pratinjau (pesan "ambil-berkas-sipp").
 * Hanya GET, hanya asal yang sama dengan tab pengirim, hanya resources/file/** dan dokumen_arsip/**;
 * jawaban berupa base64 (batas 40 MB). Pulang { ok, base64, tipe, disposisi } atau { ok:false, ... }.
 */
async function ambilBerkasSipp(pesan, pengirim) {
  const BATAS = 40 * 1024 * 1024;
  let u;
  let asal = "";
  try {
    u = new URL(String(pesan.alamat || ""));
    asal = new URL(String((pengirim && pengirim.url) || "")).origin;
  } catch {
    return { ok: false, pesan: "alamat tidak sah" };
  }
  if ((u.protocol !== "http:" && u.protocol !== "https:") || u.origin !== asal) return { ok: false, pesan: "alamat bukan milik halaman ini" };
  if (!/\/(?:resources\/file|dokumen_arsip)\//i.test(u.pathname)) return { ok: false, pesan: "alamat bukan berkas dokumen" };
  const r = await fetch(u.href, { method: "GET", credentials: "include", cache: "no-store" });
  if (!r.ok) return { ok: false, status: r.status, pesan: `kode ${r.status}` };
  const bita = new Uint8Array(await r.arrayBuffer());
  if (!bita.length) return { ok: false, kosong: true, pesan: "kosong" };
  if (bita.length > BATAS) return { ok: false, pesan: "terlalu besar" };
  let biner = "";
  for (let i = 0; i < bita.length; i += 0x8000) biner += String.fromCharCode.apply(null, bita.subarray(i, i + 0x8000));
  return {
    ok: true,
    base64: btoa(biner),
    tipe: r.headers.get("content-type") || "",
    disposisi: r.headers.get("content-disposition") || "",
  };
}

/**
 * Menerbitkan satu unduhan beralamat data: dengan nama yang sudah dirapikan.
 *
 * Dipakai dua jalur - pesan `unduh` dari panel, dan putaran relaas massal di
 * kaki berkas ini - supaya keduanya menamai berkasnya dengan cara yang sama:
 * nama diantrikan LEBIH DAHULU, sebab pendengar onDeterminingFilename di atas
 * mengambilnya dari antrean, bukan dari properti `filename`.
 *
 * Pulang { ok, id } atau { ok: false, pesan } - tidak pernah melempar.
 */
function terbitkanUnduhan(alamatMentah, nama) {
  const alamat = String(alamatMentah || "");
  return new Promise((jawab) => {
    if (!alamat.startsWith("data:")) {
      // Ditolak SEBELUM namanya diantrikan: nama yang tertinggal di antrean
      // akan dipakai unduhan data: berikutnya - berkas lain, nama yang salah.
      jawab({ ok: false, pesan: "alamat unduhan bukan data: - ditolak" });
      return;
    }
    antrikanNama(nama);
    try {
      chrome.downloads.download({ url: alamat, filename: nama, saveAs: false }, (id) => {
        const galat = chrome.runtime.lastError;
        if (galat || id === undefined) {
          jawab({ ok: false, pesan: String((galat && galat.message) || "unduhan ditolak peramban") });
          return;
        }
        // ====================================================================
        // DITERIMA BUKAN BERARTI TERSIMPAN
        // ====================================================================
        //
        // Chrome memulangkan id lalu MEMBLOKIR unduhannya kemudian - "file
        // tidak terverifikasi", yang dilaporkan pengguna 23 September 2026.
        // Panel yang hanya membaca id akan mengira berhasil, dan cara
        // cadangannya tidak pernah dipakai; berkasnya hilang tanpa satu pun
        // pesan.
        //
        // Diikuti sebentar saja. Yang berakhir "interrupted" dilaporkan
        // sebagai gagal, sehingga panel menurunkannya lewat tautan halaman -
        // cara lama yang lolos, hanya bertanda peringatan.
        ikutiUnduhan(id, (hasil) => jawab(hasil));
      });
    } catch (e) {
      jawab({ ok: false, pesan: String((e && e.message) || e).slice(0, 200) });
    }
  });
}

/*
 * ============================================================================
 * CADANGAN UNDUHAN UNIVERSAL: UNDUHAN HALAMAN YANG TERBLOKIR DIULANG (17 Okt 2026)
 * ============================================================================
 *
 * Lapis pertama (unduh-universal.js) mengalihkan unduhan yang PASTI unduhan
 * sebelum Chrome menahannya. Yang tidak dapat diketahui di muka - window.open
 * ke rute berkas bertajuk Content-Disposition, location.href, kiriman borang
 * POST, tautan SIPP tanpa atribut download - tetap lahir dari halaman http dan
 * kadang ditahan Chrome: item berakhir "interrupted" dengan galat FILE_BLOCKED.
 *
 * Di sini item itu dikenali, lalu tab asalnya DIMINTA mengulang lewat jalur
 * aman yang sama (fetch berkredensial -> alatUnduh -> pesan "unduh" ->
 * terbitkanUnduhan - satu-satunya chrome.downloads.download). Alasan tab yang
 * mengulang, bukan pekerja latar: sesi/cookie, perujuk, borang POST terakhir,
 * dan blob: milik halaman hanya terjangkau dari sana. Pekerja latar hanya
 * memilih tab (perujuk cocok dahulu, lalu yang aktif) dan menghapus entri
 * gagalnya dari riwayat bila ulangannya berhasil.
 *
 * Batas: satu kali per id unduhan, dan hanya galat penahanan (bukan jaringan,
 * bukan pengguna membatalkan, bukan virus). Ulangan tidak pernah memakai
 * tautan halaman sebagai cadangan (tanpaCadangan) - itu hanya melahirkan
 * unduhan terblokir berikutnya.
 */
// Kode Chrome untuk "unduhan tidak aman diblokir" belum pasti, jadi SEMUA bentuk
// ditangani: danger "insecure" (state apa pun yang belum selesai), atau
// state "interrupted" dengan salah satu galat berikut dari alamat http kita.
const GALAT_UNDUHAN_DITAHAN = new Set(["FILE_BLOCKED", "FILE_SECURITY_CHECK_FAILED", "FILE_FAILED"]);
const POLA_ASAL_UNDUHAN = /^(?:blob:)?https?:\/\/(?:192\.168\.10\.10|127\.0\.0\.1)(?::\d+)?(?:\/|$)/i;
const unduhanSudahDiulang = new Set();

function tanpaHashLatar(u) {
  return String(u || "").replace(/#.*$/, "");
}

/** Item blokiran milik halaman kita (bukan ekstensi, bukan asal luar)? */
function unduhanTerblokirBerhak(item) {
  if (!item || item.byExtensionId) return false;
  const tidakAman = item.danger === "insecure";
  if (tidakAman) {
    if (item.state === "complete") return false;
  } else {
    if (item.state !== "interrupted" || !GALAT_UNDUHAN_DITAHAN.has(String(item.error || ""))) return false;
    if (item.danger && item.danger !== "safe" && item.danger !== "accepted") return false;
  }
  return [item.url, item.finalUrl, item.referrer].some((u) => POLA_ASAL_UNDUHAN.test(String(u || "")));
}

function namaDariJalurUnduhan(jalur) {
  const bagian = String(jalur || "").split(/[\\/]/);
  return String(bagian[bagian.length - 1] || "").replace(/\.crdownload$/i, "");
}

/** Tab SIPP/ABT/ALETA terbuka: yang perujuknya cocok dahulu, lalu yang aktif. */
async function tabKandidatUnduhan(item) {
  const pola = (chrome.runtime.getManifest().host_permissions || []).slice();
  const semua = (await chrome.tabs.query({ url: pola })) || [];
  const rujuk = tanpaHashLatar(item.referrer);
  const bobot = (t) => (rujuk && tanpaHashLatar(t.url) === rujuk ? 0 : t.active ? 1 : 2);
  return semua.filter((t) => Number.isFinite(t.id)).sort((a, b) => bobot(a) - bobot(b));
}

/**
 * Membatalkan (bila masih berjalan/menunggu keputusan) lalu menghapus entri
 * unduhan yang ditahan dari riwayat. Tidak pernah melempar.
 */
function bersihkanUnduhanDitahan(id) {
  try {
    if (typeof chrome.downloads.cancel === "function") chrome.downloads.cancel(id, () => void chrome.runtime.lastError);
  } catch {
    /* sudah selesai/terputus */
  }
  try {
    chrome.downloads.erase({ id });
  } catch {
    /* riwayat gagal tetap tinggal - tidak mengganggu */
  }
}

/**
 * Mengulang satu unduhan terblokir lewat tab asalnya.
 * Pulang { ok, id?, pesan? } - tidak pernah melempar.
 */
async function ulangiUnduhanTerblokir(id) {
  if (unduhanSudahDiulang.has(id)) return { ok: false, pesan: "sudah diulang" };
  unduhanSudahDiulang.add(id);
  try {
    const [item] = await new Promise((selesai) => chrome.downloads.search({ id }, (d) => selesai(d || [])));
    if (!unduhanTerblokirBerhak(item)) return { ok: false, pesan: "bukan unduhan ditahan milik halaman" };
    const tab = await tabKandidatUnduhan(item);
    let sebab = "tidak ada tab asal yang terjangkau";
    for (const t of tab) {
      let jawab = null;
      try {
        jawab = await chrome.tabs.sendMessage(t.id, {
          sumber: "aleta-latar",
          jenis: "unduh-ulang",
          url: tanpaHashLatar(item.url),
          urlAkhir: tanpaHashLatar(item.finalUrl),
          mime: String(item.mime || ""),
          nama: namaDariJalurUnduhan(item.filename),
          referrer: String(item.referrer || ""),
          id,
        });
      } catch {
        continue; // tab tanpa skrip konten
      }
      if (jawab && jawab.ok) {
        bersihkanUnduhanDitahan(id);
        return { ok: true, id, tab: t.id };
      }
      // Sudah ditangani tab itu tanpa mengunduh (menunggu klik petugas, atau
      // borang berisi berkas): jangan dicoba di tab lain, jangan dibersihkan
      // dahulu - entri baru dibersihkan sesudah petugas mengklik.
      if (jawab && jawab.ditangani) return { ok: false, ditangani: true, pesan: String(jawab.pesan || "") };
      if (jawab && jawab.pesan) sebab = String(jawab.pesan);
    }
    return { ok: false, pesan: sebab };
  } catch (e) {
    return { ok: false, pesan: String((e && e.message) || e).slice(0, 160) };
  }
}

if (chrome.downloads && chrome.downloads.onChanged) {
  chrome.downloads.onChanged.addListener((ubah) => {
    try {
      const galat = ubah && ubah.error && ubah.error.current;
      const keadaan = ubah && ubah.state && ubah.state.current;
      const bahaya = ubah && ubah.danger && ubah.danger.current;
      if (bahaya !== "insecure") {
        if (!galat && keadaan !== "interrupted") return;
        if (galat && !GALAT_UNDUHAN_DITAHAN.has(String(galat))) return;
      }
      void ulangiUnduhanTerblokir(ubah.id);
    } catch {
      /* pendengar tidak boleh melempar */
    }
  });
}

/**
 * PDF SALINAN ditampilkan di tab ekstensi (14 Okt 2026).
 *
 * Pulang { ok, tab } atau { ok: false, pesan } - tidak pernah melempar ke
 * pemanggil. Titipan yang lebih tua dari satu jam dibuang di tiap panggilan:
 * tab yang tidak pernah dibuka tidak meninggalkan PDF putusan selamanya.
 */
const UMUR_TITIPAN_PDF = 60 * 60 * 1000;
const BATAS_TITIPAN_PDF = 9 * 1024 * 1024;

async function tampilkanPdfTitipan(pesan) {
  const alamat = String((pesan && pesan.alamat) || "");
  if (!alamat.startsWith("data:application/pdf;base64,")) return { ok: false, pesan: "bukan PDF - tidak ditampilkan" };
  if (alamat.length > BATAS_TITIPAN_PDF) return { ok: false, pesan: "PDF terlalu besar untuk ditampilkan langsung" };
  if (!chrome.storage || !chrome.storage.session || !chrome.tabs) return { ok: false, pesan: "peramban tidak mendukung penampil salinan" };
  const nama = potongNamaBerkas(String(pesan.nama || "SALINAN.pdf").replace(/[\\/:*?"<>|]+/g, "_"), 180);
  try {
    const semua = await chrome.storage.session.get(null);
    const basi = Object.keys(semua || {}).filter(
      (k) => k.startsWith("aletaPdf:") && Date.now() - Number((semua[k] && semua[k].saat) || 0) > UMUR_TITIPAN_PDF
    );
    if (basi.length) await chrome.storage.session.remove(basi);
  } catch {
    /* pembersihan hanya pembantu */
  }
  const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  await chrome.storage.session.set({
    [`aletaPdf:${id}`]: { nama, alamat, pesan: String(pesan.pesan || "").slice(0, 600), awas: pesan.awas === true, saat: Date.now() },
  });
  const tab = await chrome.tabs.create({ url: chrome.runtime.getURL(`salinan.html#${id}`) });
  return { ok: true, tab: tab && tab.id };
}

chrome.runtime.onMessage.addListener((pesan, pengirim, jawab) => {
  if (!pesan || pesan.sumber !== "aleta-panel") return undefined;

  // Masuk SIPP & ABT otomatis (7 Okt 2026) - lihat layaniMasuk di kaki berkas.
  // MASUK-SESI-SIPP 11 Okt: masuk-sesi-boleh / masuk-sesi-lepas (panel SIPP).
  if (["masuk-titip", "masuk-lupakan", "masuk-minta", "masuk-gagal", "masuk-sesi-boleh", "masuk-sesi-lepas"].includes(pesan.jenis)) {
    layaniPesanMasuk(pesan, pengirim, jawab);
    return true; // jawaban menyusul
  }

  // Antrean kerja massal di tab SIPP/ABT (9 Okt 2026) - lihat
  // KUNCI_ANTREAN_KERJA. Dijawab sesudah tersimpan, supaya tab tahu denyutnya
  // sampai; kegagalan tidak pernah menghentikan antreannya.
  if (pesan.jenis === "antrean-kerja-denyut" || pesan.jenis === "antrean-kerja-selesai") {
    (pesan.jenis === "antrean-kerja-denyut" ? catatDenyutAntrean(pesan, pengirim) : lepasAntreanKerja(pesan.id))
      .then(() => jawab({ ok: true }))
      .catch((e) => jawab({ ok: false, pesan: String((e && e.message) || e).slice(0, 200) }));
    return true;
  }

  if (pesan.jenis === "antrean-kerja-daftar") {
    antreanKerjaPenghalang()
      .then((a) => jawab({ ok: true, antrean: a }))
      .catch((e) => jawab({ ok: false, pesan: String((e && e.message) || e).slice(0, 200) }));
    return true;
  }

  if (pesan.jenis === "perbarui") {
    // Sengaja dibungkus: penolakan yang tidak tertangkap membuat panel
    // menunggu jawaban yang tidak pernah datang, dan tombolnya mati selamanya.
    perbaruiSekarang({ paksa: pesan.paksa === true })
      .then(jawab)
      .catch((e) =>
        jawab({
          ok: false,
          keadaan: "galat",
          pesan: String((e && e.message) || e).slice(0, 300),
        })
      );
    return true; // jawaban menyusul
  }

  // POPUP-PERAN 12 Okt: pemeriksaan sesudah masuk ALETA (dari popup / halaman portal)
  // dan menampilkan paket ZIP yang sudah diunduh.
  if (pesan.jenis === "periksa-pembaruan") {
    periksaSesudahMasuk({ paksa: pesan.paksa === true })
      .then(jawab)
      .catch((e) => jawab({ ok: false, keadaan: "galat", pesan: String((e && e.message) || e).slice(0, 200) }));
    return true;
  }

  if (pesan.jenis === "tampilkan-unduhan") {
    try {
      const id = Number(pesan.id);
      if (Number.isFinite(id) && chrome.downloads && typeof chrome.downloads.show === "function") chrome.downloads.show(id);
      jawab({ ok: true });
    } catch (e) {
      jawab({ ok: false, pesan: String((e && e.message) || e).slice(0, 160) });
    }
    return false;
  }

  if (pesan.jenis === "muat-ulang") {
    (pesan.paksa === true ? Promise.resolve(null) : penghalangMuatUlang())
      .then((cegah) => {
        if (cegah) return tahanMuatUlang(cegah, "", "");
        muatUlangSebentarLagi();
        return {
          ok: true,
          keadaan: "dimuat_ulang",
          pesan: "Ekstensi sedang dimuat ulang dari berkasnya. Muat ulang halaman ini sebentar lagi.",
        };
      })
      .then(jawab)
      .catch((e) =>
        jawab({
          ok: false,
          keadaan: "galat",
          pesan: `Keadaan putaran cetak relaas / antrean massal tidak terbaca, jadi ekstensi TIDAK dimuat ulang: ${String((e && e.message) || e).slice(0, 240)}`,
        })
      );
    return true;
  }

  // ==========================================================================
  // UNDUHAN DITERBITKAN DARI SINI, BUKAN DARI HALAMAN
  // ==========================================================================
  //
  // Chrome memblokir unduhan yang berasal dari halaman http:// dengan bunyi
  // "Chrome blocked this download because the site isn't using a secure
  // connection". SIPP dan ABT berjalan di http://192.168.10.10, jadi SELURUH
  // putusan, anonimisasi, dan PDF yang disusun panel jatuh ke sana - terlihat
  // dicoret di riwayat unduhan, dan petugas harus membukanya satu per satu
  // untuk memaksanya.
  //
  // Blob yang dibuat skrip konten TIDAK menolong: alamat blob mewarisi asal
  // halamannya, jadi ia tetap http. Yang menolong adalah menerbitkannya dari
  // ekstensi - chrome-extension:// adalah asal yang tepercaya, dan unduhan
  // yang lahir di sini tidak pernah ditandai tidak aman.
  //
  // Ini BUKAN mengakali pengamanan Chrome. Berkasnya tidak melintasi jaringan
  // lagi sama sekali: ia sudah ada di memori peramban, diambil lewat fetch
  // yang sama yang dipakai panel untuk membacanya. Yang dipindahkan hanya
  // siapa yang menuliskannya ke cakram.
  //
  // Perbaikan yang sesungguhnya tetap HTTPS di peladen; ini menghapus
  // rintangan hariannya sambil menunggu.
  // Konteks halaman ABT - dipakai menamai unduhan yang diterbitkan ABT
  // sendiri. Disimpan satu, bukan per tab: unduhan ABT tidak membawa id tab,
  // dan yang menekan CETAK selalu sedang menatap halaman yang baru saja
  // mengabarkan konteksnya.
  if (pesan.jenis === "konteks-unduh") {
    // Ingatan lebih dahulu - itulah yang dibaca pendengar unduhan, dan ia
    // harus sudah terisi begitu pesan ini selesai. Penyimpanan menyusul,
    // untuk pekerja yang kelak bangun tanpa ingatan.
    konteksIngatan = {
      nomor: String(pesan.nomor || "").slice(0, 60),
      jenisPerkara: String(pesan.jenisPerkara || "").slice(0, 60),
      statusPutusan: String(pesan.statusPutusan || "").slice(0, 60),
      saat: Date.now(),
    };
    void simpanKonteksUnduh(konteksIngatan);
    jawab({ ok: true });
    return false;
  }

  // 14 Okt: PDF SALINAN langsung tampil - dititipkan di storage.session lalu
  // dibuka di salinan.html (asal chrome-extension://). Lihat salinan.js.
  if (pesan.jenis === "tampilkan-pdf") {
    void tampilkanPdfTitipan(pesan).then(jawab, (e) => jawab({ ok: false, pesan: String((e && e.message) || e).slice(0, 200) }));
    return true;
  }

  // Petugas mengklik pemberitahuan "Unduhan ditahan Chrome" dan unduhan ulangnya
  // berhasil: entri gagalnya dibersihkan. Hanya entri ditahan milik halaman kita.
  if (pesan.jenis === "unduh-ditahan-bersih") {
    const idBersih = Number(pesan.id);
    if (!Number.isFinite(idBersih)) {
      jawab({ ok: false });
      return false;
    }
    chrome.downloads.search({ id: idBersih }, (daftar) => {
      const butir = (daftar || [])[0];
      if (butir && !butir.byExtensionId && [butir.url, butir.finalUrl, butir.referrer].some((u) => POLA_ASAL_UNDUHAN.test(String(u || "")))) {
        bersihkanUnduhanDitahan(idBersih);
      }
      jawab({ ok: true });
    });
    return true;
  }

  // Pratinjau dokumen SIPP (21 Okt 2026): berkas statis diambil dari pekerja latar, bukan dari tab,
  // supaya tidak direbut pengelola unduhan (IDM) yang menambatkan diri pada permintaan tab.
  if (pesan.jenis === "ambil-berkas-sipp") {
    ambilBerkasSipp(pesan, pengirim).then(jawab, (e) => jawab({ ok: false, pesan: String((e && e.message) || e).slice(0, 160) }));
    return true; // jawaban menyusul
  }

  if (pesan.jenis === "unduh") {
    // Dipotong pada BATANGNYA, bukan dari belakang: memotong nama utuh
    // membuang akhiran ".rtf" atau ".pdf"-nya, dan berkas tanpa akhiran tidak
    // dapat dibuka dengan dua ketukan.
    const nama = potongNamaBerkas(
      String(pesan.nama || "berkas").replace(/[\\/:*?"<>|]+/g, "_"),
      180
    );
    // 14 Okt: nama generik ("download.rtf", tanpa ekstensi) DITOLAK - panel
    // wajib menyebut nama baku. Tanpa ini Chrome menamainya "download (n)".
    if (POLA_NAMA_UMUM.test(nama) || !/\.[A-Za-z0-9]{2,5}$/.test(nama) || /^berkas\./i.test(nama)) {
      jawab({ ok: false, pesan: `nama berkas generik ditolak: ${nama}` });
      return false;
    }
    // Satu jalur dengan putaran relaas massal - lihat terbitkanUnduhan.
    void terbitkanUnduhan(pesan.alamat, nama).then(jawab);
    return true; // jawaban menyusul
  }

  // ==========================================================================
  // CETAK RELAAS MASSAL - seluruh pesannya berawalan "relaas-", datang dari
  // jembatan aleta.js di halaman Antrian Sidang. Mesinnya di kaki berkas ini.
  // ==========================================================================
  if (typeof pesan.jenis === "string" && pesan.jenis.startsWith("relaas-")) {
    // Ditangkap supaya halaman SELALU menerima jawaban beserta sebabnya -
    // penolakan yang lolos membuat halaman menunggu jawaban yang tidak datang.
    layaniRelaas(pesan, pengirim).then(jawab, (e) => jawab({ ok: false, sebab: relaasPesan(e) }));
    return true; // jawaban menyusul
  }

  if (pesan.jenis === "keadaan-pembaruan") {
    bacaVersiMenunggu()
      .catch(() => versiMenunggu)
      .then((menunggu) =>
        jawab({
          ok: true,
          versiSekarang: String(chrome.runtime.getManifest().version || ""),
          versiMenunggu: String(menunggu || ""),
        })
      );
    return true;
  }

  return undefined;
});

/*
 * ============================================================================
 * CETAK RELAAS MASSAL - PUTARANNYA HIDUP DI SINI, KEMAJUANNYA DI PENYIMPANAN
 * ============================================================================
 *
 * Keputusan pengguna 25 September 2026: relaas panggilan sidang dan
 * pemberitahuan putusan dicetak massal untuk juru sita dari tombol "Cetak
 * relaas" di Antrian Sidang (ALETA e-Court, tab Jadwal Sidang). Halaman portal
 * itu TIDAK dapat berbicara dengan pekerja ini secara langsung; ia mengirim
 * window.postMessage, dan jembatan di aleta.js meneruskannya ke sini sebagai
 * pesan chrome.runtime berjenis "relaas-*" (lihat kontrak di aleta.js).
 *
 * Pekerja inilah yang mengambil RTF dari ABT dan menyimpannya APA ADANYA ke
 * folder unduhan - RTF saja, tanpa PDF (6 Okt 2026) - tanpa membuka satu tab ABT pun di
 * depan petugas. Petugas boleh berpindah halaman, menutup dialog, bahkan
 * menutup tab portal; putarannya tidak hidup di halaman mana pun.
 *
 * ============================================================================
 * JALAN YANG SAMA DENGAN TOMBOL ABT - SUPAYA HAK AKSES ABT TETAP BERLAKU
 * ============================================================================
 *
 * Satu dokumen ditempuh lewat jalan yang sama dengan juru sita yang menekan
 * tombolnya sendiri, dibaca dari kode ABT setempat (controllers/Abt.php,
 * views/abt/cari_perkara.php, view.php, assets/abt/js/custom-Jquery.js):
 *
 *   1. POST abt/main/cari  {a, b, c=perkara_id}  - tombol "buka" di daftar
 *      perkara. ABT MEMERIKSA HAK AKSES di sini (akses_pengguna: grup, juru
 *      sita perkara itu, rentang proses) lalu mengalihkan ke abt/main/view.
 *      Yang ditolak ABT untuk akun ini ditolak juga untuk putarannya, dengan
 *      kalimat ABT sendiri. preview() tidak memeriksa apa pun - melompat
 *      langsung ke sana berarti MELANGKAHI aturan hak akses yang dipasang
 *      pengguna di ABT, dan itu tidak dilakukan.
 *   2. GET  <alamat view>&d=<urutan sidang> - DoNav() di daftar sidang, persis
 *      document.URL + '&d=' + urutan. Dilewati bila dokumennya tanpa sidang
 *      (pemberitahuan putusan: blangkonya tidak memuat variabel multi_sidang,
 *      jadi ABT pun tidak menampilkan daftar sidangnya). SEJAK 7 OKT 2026
 *      dilewati juga bila halaman langkah 1 sudah memuat tautan CETAK untuk
 *      perkara itu: view.php menulis tautan yang SAMA (c, e, b, a) dengan d
 *      kosong, dan preview() membaca d hanya dari alamatnya sendiri - halaman
 *      daftar sidang hanya tampilan, tanpa pemeriksaan hak akses apa pun.
 *      Satu halaman berat (menyusun seluruh variabel blangko) per dokumen
 *      hilang dari beban ABT. Halaman yang tidak memuat tautan itu
 *      (mis. menunggu validasi hakim) tetap menempuh langkah 2.
 *   3. GET  abt/preview?c=&e=&b=&a=&d=  - tombol CETAK, diambil dari halaman
 *      view yang dirender ABT, bentuknya persis.
 *
 * Di antara dokumen ada jarak pendek untuk BEBAN peladen ABT (lihat bagian 3)
 * - bukan penyamaran; di antara langkah satu dokumen tidak. Keputusan 25 September
 * 2026: putaran ini tidak dirancang untuk menyembunyikan ALETA dari catatan
 * ABT maupun SIPP.
 *
 * YANG DITULIS ABT KE BASIS DATA SELAMA ITU - diperiksa pada kode ABT setempat
 * 25 September 2026: preview() dan view() tidak menulis satu baris pun ke
 * aps_badilag (tidak ada tabel log; sesi CodeIgniter berkas, bukan tabel).
 * Satu-satunya tulisan adalah `call perkara_jadwal_sidang_reorder(perkara_id)`
 * di basis data SIPP oleh Abt_model::data_sidang untuk variabel hari/tanggal
 * sidang - UPDATE perkara_jadwal_sidang.urutan menurut tanggal_sidang. Itu
 * perilaku ABT sendiri yang SAMA pada cetak manual (view dan preview sama-sama
 * memanggilnya), tanpa kolom waktu ubah dan tanpa pemicu; pada urutan yang
 * sudah benar ia tidak mengubah apa pun.
 *
 * ============================================================================
 * KEMAJUAN DISIMPAN, BUKAN DIINGAT
 * ============================================================================
 *
 * Pekerja MV3 dimatikan Chrome kira-kira tiap tiga puluh detik menganggur, dan
 * seluruh variabel modulnya ikut hilang - itu sudah membuat berkas bernama
 * "download.rtf" pada 16 September 2026. Satu putaran tiga puluh dokumen
 * berjalan beberapa menit; antrian yang hanya ada di ingatan
 * akan MULAI DARI AWAL tiap kali pekerjanya hidup lagi, dan mencetak ganda.
 *
 * Karena itu tiap butir ditulis ke chrome.storage.session SEBELUM dikerjakan
 * ("sedang"), SESUDAH BERKASNYA tersimpan (unduhan.rtf), dan
 * SESUDAHNYA ("selesai"/"gagal"), juga waktu jeda berikutnya. Pekerja yang
 * hidup lagi membaca butir "sedang" sebagai pekerjaan pekerja yang sudah mati,
 * lalu memutuskan lewat riwayat unduhan peramban berkas mana yang sudah lahir
 * - lihat relaasPulihkan. Satu-satunya yang boleh tinggal di ingatan adalah
 * penanda "putaran sedang berjalan DI PEKERJA INI", dan justru ia yang HARUS
 * hilang bersama pekerjanya.
 *
 * ============================================================================
 * YANG SENGAJA TIDAK DIKERJAKAN: MENULIS KE SIPP
 * ============================================================================
 *
 * Berkas hasilnya TIDAK diunggah balik ke SIPP (doc_relaas / edoc_pbt) -
 * "tidak usah unggah ke SIPP dulu" (pengguna, 25 September 2026). Versi ini
 * hanya mencetak: RTF (tanpa PDF - 6 Okt 2026) turun ke folder unduhan
 *   ALETA relaas <tanggal>/<juru sita>/<nomor perkara> - <keterangan>.rtf
 */
const KUNCI_RELAAS = "aletaRelaasMassal";
/**
 * Permintaan berhenti disimpan pada kunci SENDIRI, bukan pada pekerjaannya.
 * Putaran menulis ulang pekerjaannya tiap butir; penanda berhenti yang
 * ditulis ke objek yang sama akan tertimpa salinan putaran yang lebih tua,
 * dan tombol Hentikan akan berbunyi tanpa berbuat apa-apa.
 */
const KUNCI_RELAAS_HENTI = "aletaRelaasMassalHenti";
/** Token blangko yang sudah dipanen, per alamat ABT - di storage.local. */
const KUNCI_TOKEN_RELAAS = "aletaTokenRelaas";
/**
 * Detak selama menunggu dan bekerja. Tiap panggilan chrome.* menyetel ulang
 * penghitung menganggur Chrome (sejak Chrome 110), jadi selama detak ini
 * berbunyi di bawah tiga puluh detik, pekerjanya tidak dimatikan karena
 * menganggur. Mati karena sebab lain tetap mungkin - itu yang ditangani
 * penyimpanan di atas.
 */
const RELAAS_DETAK_MS = 10000;
/** Paling banyak kelompok ABT yang dibuka saat mencari token. */
const RELAAS_BATAS_KELOMPOK = 40;
/**
 * Berapa kali satu dokumen boleh DIMULAI - karena pekerja mati di tengahnya,
 * atau karena ABT/jaringan gagal sesaat (5xx, putus). Sekali gagal itu biasa;
 * tiga kali pada dokumen yang SAMA berarti dokumen itu sendiri yang
 * bermasalah, dan mengulangnya lagi hanya berputar di tempat sambil memenuhi
 * catatan akses ABT.
 */
const RELAAS_BATAS_PERCOBAAN = 3;
/**
 * Umur token tersimpan. Token hasil enkripsi dengan kunci peladen ABT; kunci
 * itu hampir tidak pernah berganti, tetapi bila berganti, token lama mati
 * diam-diam. Token yang ditolak ABT dibuang seketika tanpa menunggu umur ini.
 */
const RELAAS_UMUR_TOKEN_MS = 7 * 24 * 60 * 60 * 1000;
const RELAAS_CATATAN_MAKS = 60;
/** Panjang nama berkas dan nama folder juru sita - jalur Windows dibatasi 260. */
const RELAAS_NAMA_MAKS = 120;
const RELAAS_FOLDER_MAKS = 60;
const RELAAS_JURUSITA_KOSONG = "Juru sita tidak tercatat";
/** Golongan yang dikenal kontrak K1; hanya pemberitahuan yang tanpa sidang. */
// "pengumuman-itsbat" (14 Okt 2026): pengumuman itsbat nikah voluntair, dicetak bersama
// panggilan sidang pertama - d = sidang pertama (blangkonya tidak memakai variabel sidang).
const RELAAS_GOLONGAN = ["sidang-pertama", "sidang-ditunda", "sidang-lanjutan", "ikrar-talak", "pemberitahuan-putusan", "pengumuman-itsbat"];

/** Putaran sedang berjalan DI PEKERJA INI. Sengaja variabel modul - lihat di atas. */
let pelariRelaasHidup = false;
/**
 * relaas-mulai sedang DISIAPKAN di pekerja ini (memanen blangko, belum ada
 * pekerjaan tersimpan) - { pada } atau null. Variabel modul karena alasan yang
 * sama: bila pekerjanya mati di tengah persiapan, persiapannya ikut mati dan
 * penanda ini memang harus hilang.
 */
let mulaiRelaasDisiapkan = null;

/* ─── 1. Membaca halaman ABT ─────────────────────────────────────────────── */

/** Entitas HTML yang lazim, diurai tanpa menyentuh spasi apa pun. */
function relaasUraiEntitas(teks) {
  return String(teks || "").replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (utuh, isi) => {
    const k = isi.toLowerCase();
    if (k === "amp") return "&";
    if (k === "lt") return "<";
    if (k === "gt") return ">";
    if (k === "quot") return '"';
    if (k === "apos") return "'";
    // &nbsp; dijadikan U+00A0, bukan spasi biasa: menyamakannya akan membuat
    // dua nama yang memang berbeda terbaca sama.
    if (k === "nbsp") return " ";
    const angka = k.startsWith("#x") ? parseInt(k.slice(2), 16) : parseInt(k.slice(1), 10);
    return Number.isFinite(angka) && angka > 0 && angka <= 0x10ffff ? String.fromCodePoint(angka) : utuh;
  });
}

/**
 * Tautan kelompok blangko dari HTML beranda ABT. Bilah kiri (views/abt/
 * beranda.php) dan menu atas (modul_menu.php) sama-sama berbentuk
 *   <a … href="/aps_badilag/abt/main/beranda?a=ENC&c=">NAMA ALIAS</a>
 * Alamatnya disimpan UTUH sebagaimana dirender ABT - termasuk "&c=" kosong di
 * ujungnya - sebab alamat itulah yang diminta peramban orang yang
 * mengekliknya. Polanya sama dengan alatUraiKelompokDariHtml di panel-alat.js;
 * disalin sebab pekerja latar tidak dapat memuat berkas itu - panel-alat.js
 * menyentuh document dan window pada tingkat atasnya.
 */
function relaasUraiKelompok(html) {
  const hasil = [];
  const teks = String(html || "");
  const pola = /<a\b[^>]*href=["']([^"']*\/abt\/main\/(?:beranda|daftar)\?a=([^"'&]+)[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = pola.exec(teks))) {
    const nama = relaasUraiEntitas(m[3].replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim();
    const a = m[2].trim();
    if (!nama || !a) continue;
    if (hasil.some((x) => x.a === a)) continue;
    hasil.push({ kelompok: nama, a, alamat: relaasUraiEntitas(m[1]) });
  }
  return hasil;
}

/**
 * ============================================================================
 * BERKAS DARI HALAMAN KELOMPOK - NAMANYA TIDAK DIPANGKAS SAMA SEKALI
 * ============================================================================
 *
 * alatUraiBerkasDariHtml di panel-alat.js merapikan spasi nama berkas, dan itu
 * benar untuk putusan (dicocokkan lewat alatKunciBerkas yang memang
 * merapikan). Di sini TIDAK BOLEH. Katalog relaas menyebut
 *
 *   '[JS] 1. Relaas Panggilan Sidang T (Sidang Lanjutan) .rtf'
 *
 * dan views/abt/beranda.php merender namanya lewat pathinfo(PATHINFO_FILENAME)
 * yang membuang ".rtf" saja - "… (Sidang Lanjutan) " dengan spasi di ujung.
 * Bila namanya dipangkas, yang itu hilang dari pencocokan - tanpa satu pun
 * galat.
 *
 * Yang dibaca isi <span> APA ADANYA - entitasnya diurai, spasinya dibiarkan.
 */
function relaasUraiBerkas(html) {
  const hasil = [];
  const teks = String(html || "");
  const judul = teks.match(/class=["'][^"']*pricing-top[^"']*["'][^>]*>\s*<h3>([\s\S]*?)<\/h3>/i);
  const kelompok = judul
    ? relaasUraiEntitas(judul[1].replace(/<br\s*\/?>[\s\S]*$/i, "").replace(/<[^>]+>/g, ""))
        .replace(/\s+/g, " ")
        .trim()
    : "";
  const tag = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = tag.exec(teks))) {
    const token = m[1].match(/\ba\s*:\s*\\?["']([^"'\\]+)\\?["']\s*,\s*b\s*:\s*\\?["']([^"'\\]+)\\?["']/);
    if (!token) continue;
    const span = m[2].match(/<span\b[^>]*>([\s\S]*?)<\/span>/i);
    const berkas = span
      ? relaasUraiEntitas(span[1])
      : relaasUraiEntitas(m[2].replace(/<[^>]+>/g, "")).replace(/^\s*#\s/, "");
    if (!berkas) continue;
    hasil.push({ blangko: kelompok, berkas, a: token[1].trim(), b: token[2].trim() });
  }
  return hasil;
}

/**
 * Pembanding TEPAT antara nama katalog dan nama di halaman ABT.
 *
 * Katalog menyebut nama LENGKAP dengan ".rtf"; ABT hanya membuang ".rtf".
 * Tidak ada perapian lain - tidak huruf kecil, tidak pemangkasan, tidak
 * penyatuan spasi. Satu spasi yang berbeda berarti berkas yang berbeda,
 * persis seperti yang dipercaya ABT sendiri.
 */
function relaasCocokTepat(namaKatalog, namaHalaman) {
  const k = String(namaKatalog || "");
  const h = String(namaHalaman || "");
  if (!k || !h) return false;
  return h === k || `${h}.rtf` === k;
}

/**
 * Blangko ikrar talak dan kelompok ABT pemiliknya (perbaikan 6 Okt 2026 malam).
 *
 * Berkas "[JS] 4. Relaas Panggilan Ikrar Talak P dan T.rtf" di satker ada di
 * DUA folder: derry_briantono/Relaas (menu 900/981, proses 80-220) dan
 * _ikrar_talak/2 Relaas Ikrar Talak (menu 25, proses 290-600). Perkara yang
 * sampai tahap ikrar selalu berproses 290 ke atas, jadi token dari folder
 * derry SELALU ditolak ABT. Nama yang sama -> token ikrar wajib dari kelompok
 * yang namanya menyebut ikrar; kelompok lain hanya cadangan bila kelompok
 * ikrar memang tidak ada.
 */
function relaasNamaIkrar(nama) {
  return /ikrar\s+talak/i.test(String(nama || ""));
}

function relaasKelompokIkrar(kelompok) {
  return /ikrar/i.test(String(kelompok || ""));
}

/**
 * Memetakan nama katalog ke token pada satu daftar berkas; yang pertama cocok
 * menang - kecuali blangko ikrar, yang mengutamakan kelompok ikrar.
 */
function relaasPetakanToken(diminta, daftarBerkas) {
  const token = {};
  const hilang = [];
  for (const nama of diminta || []) {
    const semua = (daftarBerkas || []).filter((b) => relaasCocokTepat(nama, b.berkas));
    const cocok = relaasNamaIkrar(nama)
      ? semua.find((b) => relaasKelompokIkrar(b.blangko)) || semua[0]
      : semua[0];
    if (cocok) token[nama] = { a: cocok.a, b: cocok.b, kelompok: cocok.blangko || "" };
    else hilang.push(nama);
  }
  return { token, hilang };
}

/**
 * Kelompok yang namanya menyebut relaas atau pemberitahuan dibuka lebih dulu.
 *
 * URUTAN, bukan saringan: yang lain tetap dibuka bila yang pertama tidak
 * memuat blangkonya. Di ABT setempat kelompoknya "Relaas dan PBT" (alias dari
 * abt_menu 981, di bawah Blangko Derry), dan ada dua kelompok lain yang juga
 * bernama relaas ("Relaas Panggilan", "Relaas Ikrar Talak"). Nama menu di
 * peladen belum tentu sama; yang menentukan tetap ISI kelompoknya.
 *
 * `utamakan` (perbaikan 6 Okt 2026, edoc penetapan): nama kelompok dari Peta
 * penetapan ("Form Bantu PTSP") dibuka PALING DULU - nama yang memuatnya
 * utuh, lalu yang memuat salah satu kata khasnya ("ptsp"). Tetap urutan,
 * bukan saringan. Tanpa `utamakan` urutannya sama persis dengan sebelumnya.
 */
function relaasUrutkanKelompok(daftar, utamakan) {
  const u = String(utamakan || "").toLowerCase().replace(/\s+/g, " ").trim();
  const kataKhas = u.split(" ").filter((k) => k.length >= 4 && !/^(form|blangko|bantu|menu)$/.test(k));
  const nilai = (k) => {
    const n = String((k && k.kelompok) || "").toLowerCase();
    if (u && n.replace(/\s+/g, " ").includes(u)) return -2;
    if (kataKhas.length && kataKhas.some((k2) => n.includes(k2))) return -1;
    if (/rela+s/.test(n) && /pbt|pemberitahuan/.test(n)) return 0;
    if (/rela+s/.test(n)) return 1;
    if (/pbt|pemberitahuan/.test(n)) return 2;
    return 3;
  };
  return (daftar || [])
    .map((k, i) => ({ k, i }))
    .sort((x, y) => nilai(x.k) - nilai(y.k) || x.i - y.i)
    .map((x) => x.k);
}

/**
 * Apakah jawaban ABT halaman masuk, bukan halaman yang diminta.
 *
 * Pengendali Abt mengalihkan siapa pun yang belum masuk ke login, dan fetch
 * mengikuti pengalihan itu diam-diam: kodenya 200, isinya borang masuk.
 * Dikenali dari alamat akhirnya atau dari borangnya (views/login.php:
 * action "…login/signin", medan bertipe password). Tidak satu pun view
 * abt/* memuat medan password - diperiksa pada kode ABT setempat.
 */
function relaasHalamanMasuk(teks, alamatAkhir) {
  if (/\/login(?:\/|\?|#|$)/i.test(String(alamatAkhir || ""))) return true;
  const t = String(teks || "");
  return /login\/signin/i.test(t) || /type=["']password["']/i.test(t);
}

/** Apakah bita pertama sebuah jawaban memang RTF. */
function relaasAwalRtf(bita) {
  const u = bita instanceof Uint8Array ? bita : new Uint8Array(bita || new ArrayBuffer(0));
  if (u.length < 5) return false;
  return String.fromCharCode(u[0], u[1], u[2], u[3], u[4]) === "{\\rtf";
}

/** Teks polos dari potongan HTML - untuk mengutip kalimat ABT apa adanya. */
function relaasTeksPolos(html) {
  return relaasUraiEntitas(
    String(html || "")
      .replace(/<br\s*\/?>/gi, " - ")
      .replace(/<[^>]+>/g, " ")
  )
    .replace(/\s+/g, " ")
    .replace(/^[\s-]+|[\s-]+$/g, "")
    .slice(0, 240);
}

/**
 * Kalimat penolakan ABT pada halaman cari - "User X Tidak Ada Akses dengan
 * Perkara Nomor ...", "NOMOR PERKARA ... TIDAK DAPAT MENGGUNAKAN BLANGKO INI
 * (Proses Saat Ini ...)", "NOMOR PERKARA TIDAK DITEMUKAN". Semuanya dirender
 * html_cari_perkara/cari() sebagai elemen bergaya color:red. Kosong bila tidak
 * ada.
 */
function relaasTolakanAbt(html) {
  const m = String(html || "").match(
    /<(h[1-6]|p|div)\b[^>]*style=["'][^"']*color\s*:\s*red[^"']*["'][^>]*>([\s\S]*?)<\/\1>/i
  );
  return m ? relaasTeksPolos(m[2]) : "";
}

/**
 * Apakah penolakan ABT berlaku untuk SELURUH blangko menu itu, bukan untuk
 * satu perkara. Dibaca dari models/abt/Abt_model.php akses_pengguna dan
 * controllers/Abt.php html_cari_perkara (ABT setempat 25 September 2026):
 *
 *   per perkara  "User X - Tidak Ada Akses dengan Perkara Nomor ..."
 *                "NOMOR PERKARA ... TIDAK DAPAT MENGGUNAKAN BLANGKO INI (Proses
 *                 Saat Ini ...)", "JENIS PERKARA ... TIDAK DAPAT ...",
 *                "NOMOR PERKARA TIDAK DITEMUKAN"
 *   menyeluruh   "USER <GRUP> - TIDAK ADA AKSES MENGGUNAKAN BLANGKO INI" -
 *                grup akun tidak ada di user_grup_id menu; berlaku untuk tiap
 *                perkara dan tiap blangko di menu itu.
 *
 * Pembedanya kata "perkara": semua penolakan per perkara menyebutnya, yang
 * menyeluruh tidak.
 */
function relaasTolakanMenyeluruh(kalimat) {
  const t = String(kalimat || "");
  return t !== "" && !/perkara/i.test(t);
}

/**
 * Nilai MENTAH satu ruas kueri - tanpa mengurai "+" menjadi spasi dan tanpa
 * mengurai persen. Token ABT (MY_Encrypt url_safe) hanya berisi huruf, angka,
 * ".", "~", dan "-", dan ia dituliskan kembali ke alamat berikutnya persis
 * seperti view.php menuliskannya: apa adanya.
 */
function relaasParameter(alamat, nama) {
  const kueri = String(alamat || "").split("#")[0].split("?").slice(1).join("?");
  for (const pasangan of kueri.split("&")) {
    const i = pasangan.indexOf("=");
    const k = i < 0 ? pasangan : pasangan.slice(0, i);
    if (k === nama) return i < 0 ? "" : pasangan.slice(i + 1);
  }
  return null;
}

/* ─── 2. Alamat ABT ──────────────────────────────────────────────────────── */

/**
 * Alamat dasar pengendali ABT.
 *
 * Jembatan aleta.js mengirim asalAbt = asal portal + "/aps_badilag" (kontrak
 * K3) - akar APLIKASI ABT. Pengendalinya satu tingkat di bawahnya:
 * /aps_badilag/abt/main/beranda, /aps_badilag/abt/preview (sama dengan
 * asalAbt() di abt.js). Yang sudah berujung "/abt" dibiarkan.
 */
function relaasDasarAbt(asalAbt) {
  const s = String(asalAbt || "").trim().replace(/\/+$/, "");
  if (!/^https?:\/\/[^/?#\s]+(?:\/[^?#\s]*)?$/i.test(s)) return "";
  return /\/abt$/i.test(s) ? s : `${s}/abt`;
}

/** Asal portal: skema + host (+ port), tanpa jalur. */
function relaasAsalPortal(asal) {
  const s = String(asal || "").trim().replace(/\/+$/, "");
  return /^https?:\/\/[^/?#\s]+$/i.test(s) ? s : "";
}

/** Nilai kueri yang dituliskan apa adanya bila memang aman, dikodekan bila tidak. */
function relaasSandiUrl(nilai) {
  const s = String(nilai || "");
  return /^[A-Za-z0-9._~%-]+$/.test(s) ? s : encodeURIComponent(s);
}

/**
 * Alamat CETAK untuk satu dokumen, bila halaman view tidak dapat dibaca.
 *
 * BENTUKNYA PERSIS views/abt/view.php (cabang blangko tanpa validasi BAS):
 *   base_url("abt/preview?c=$perkara_id&e=$perk_temp&b=$enc_file&a=$enc_dir&d=$cek_sidang")
 * - urutan c, e, b, a, d; "e=" selalu ada dan kosong untuk perkara SIPP; "d="
 * selalu ada, kosong bila blangkonya tanpa sidang. Token dituliskan mentah
 * seperti echo PHP menuliskannya (URLSearchParams akan mengubah "~" menjadi
 * "%7E" - alamat yang tidak pernah diminta peramban mana pun).
 *
 * d = URUTAN SIDANG YANG DIPANGGIL. Model ABT (data_sidang) memanggil
 * perkara_jadwal_sidang_reorder lalu memilih a.urutan = d. TIDAK ADA ruas
 * pihak: preview() hanya membaca a, b, c, e, dan pihak dipilih lewat
 * BLANGKO-nya ("P dan T" satu dokumen dua pihak, "T" Pihak Kedua saja).
 */
function relaasAlamatPratinjau(asalAbt, token, perkaraId, d) {
  const dasar = relaasDasarAbt(asalAbt);
  const id = String(perkaraId === undefined || perkaraId === null ? "" : perkaraId).trim();
  if (!dasar || !token || !token.a || !token.b || !/^\d+$/.test(id) || /^0+$/.test(id)) return "";
  const n = Number(d);
  const sidang = Number.isInteger(n) && n > 0 ? String(n) : "";
  return `${dasar}/preview?c=${id}&e=&b=${relaasSandiUrl(token.b)}&a=${relaasSandiUrl(token.a)}&d=${sidang}`;
}

/**
 * Badan POST tombol "buka" di halaman cari ABT - post() di custom-Jquery.js
 * membuat borang tersembunyi {a, b, c} lalu mengirimkannya sebagai
 * application/x-www-form-urlencoded. URLSearchParams memakai penyandi yang
 * sama dengan borang peramban.
 */
function relaasBadanCari(token, perkaraId) {
  return new URLSearchParams([
    ["a", String(token.a || "")],
    ["b", String(token.b || "")],
    ["c", String(perkaraId || "")],
  ]).toString();
}

/**
 * Tautan CETAK yang dirender ABT di halaman view - bila ada, bila menunjuk
 * perkara dan sidang yang memang diminta, dan bila seasal dengan ABT-nya.
 * Selain itu kosong, dan pemanggil menyusunnya sendiri (relaasAlamatPratinjau).
 */
function relaasCetakDariTinjau(html, asalAbt, perkaraId, d) {
  const dasar = relaasDasarAbt(asalAbt);
  const m = String(html || "").match(/href=["']([^"']*\/abt\/preview\?[^"']*)["']/i);
  if (!dasar || !m) return "";
  const alamat = relaasUraiEntitas(m[1]);
  const asalDasar = (dasar.match(/^https?:\/\/[^/]+/i) || [""])[0].toLowerCase();
  const mutlak = /^https?:\/\//i.test(alamat) ? alamat : `${asalDasar}${alamat.startsWith("/") ? "" : "/"}${alamat}`;
  if (!mutlak.toLowerCase().startsWith(`${asalDasar}/`)) return "";
  if (relaasParameter(mutlak, "c") !== String(perkaraId)) return "";
  const n = Number(d);
  const sidang = Number.isInteger(n) && n > 0 ? String(n) : "";
  if ((relaasParameter(mutlak, "d") || "") !== sidang) return "";
  return mutlak;
}

/**
 * Alamat CETAK untuk sidang ke-d DARI HALAMAN LANGKAH 1 (view tanpa d) -
 * cetak relaas cepat, 7 Okt 2026. view.php menulis tautan CETAK yang sama di
 * kedua halaman, hanya d-nya yang berbeda ("$cek_sidang" = GET d, kosong di
 * halaman langkah 1). Tautan itu dipakai hanya bila seasal dengan ABT,
 * menunjuk perkara yang diminta, e-nya kosong (perkara SIPP, bukan perkara
 * sementara), dan memuat token a/b; alamatnya disusun ulang dengan
 * relaasAlamatPratinjau - bentuk yang sudah diuji SAMA PERSIS dengan ekspresi
 * view.php yang dievaluasi PHP. Selain itu kosong, dan pemanggil menempuh
 * langkah 2 (DoNav) seperti dulu.
 */
function relaasCetakSidangDariTinjau(html, asalAbt, perkaraId, d) {
  const n = Number(d);
  if (!Number.isInteger(n) || n <= 0) return "";
  const tautan = relaasCetakDariTinjau(html, asalAbt, perkaraId, 0);
  if (!tautan) return "";
  if ((relaasParameter(tautan, "e") || "") !== "") return "";
  const a = relaasParameter(tautan, "a");
  const b = relaasParameter(tautan, "b");
  if (!a || !b) return "";
  return relaasAlamatPratinjau(asalAbt, { a, b }, perkaraId, n);
}

/* ─── 3. Jarak antar permintaan ke ABT ───────────────────────────────────── */

/**
 * ============================================================================
 * JARAK RAMAH PELADEN ABT - BUKAN PENYAMARAN
 * ============================================================================
 *
 * ABT berjalan di PHP 5.6 pada peladen yang sama dengan SIPP, dan pratinjau
 * CETAK merender satu RTF utuh di sana. Putaran puluhan dokumen tanpa jarak
 * akan memborong peladen itu dari petugas lain yang sedang bekerja. Karena
 * itu:
 *
 *   ANTAR DOKUMEN        acak 1-2,5 detik (RELAAS_JEDA_MIN_MS..MAKS_MS), tanpa
 *                        jeda panjang, dihitung sejak JAWABAN ABT TERAKHIR
 *                        dokumen sebelumnya (bukan sejak unduhannya selesai
 *                        diikuti) - jadi ABT benar-benar diam selama itu.
 *   DI DALAM SATU        TANPA jeda (7 Okt 2026). Permintaannya berurutan -
 *   DOKUMEN              yang berikut baru dikirim sesudah jawaban yang
 *                        sebelumnya utuh diterima - jadi jeda di sini tidak
 *                        mengurangi beban sedikit pun, hanya menambah waktu
 *                        tunggu juru sita.
 *   ANTAR HALAMAN        0,25-0,75 detik ketika token blangko dipanen (jarang:
 *   KELOMPOK (PANEN)     tokennya disimpan tujuh hari).
 *
 * CETAK RELAAS CEPAT (7 Okt 2026, permintaan pengguna "buat cetak relaas
 * lebih prosesnya cepat"). Dulu 2-5 detik antar dokumen dan 0,5-1,5 detik
 * antar langkah, dengan TIGA halaman berat per dokumen (buka -> daftar
 * sidang -> CETAK; ketiganya menyusun variabel blangko di PHP 5.6). Kini dua
 * halaman berat per dokumen (daftar sidang dilewati bila halaman "buka" sudah
 * memuat tautan CETAK-nya - lihat relaasAmbilRtf), jadi jeda antar dokumen
 * boleh diturunkan ke 1-2,5 detik tanpa menambah halaman berat per menit
 * secara berarti: ABT tetap melayani SATU permintaan pada satu waktu dan
 * selalu diam sedikitnya satu detik di antara dua dokumen. Tidak dikerjakan
 * paralel: sesi ABT (CodeIgniter 3, sess_driver files) mengunci berkas
 * sesinya per permintaan, jadi dua permintaan serentak dengan kuki yang sama
 * tetap dilayani bergantian - dan pembaruan id sesi (sess_time_to_update 300)
 * di tengah dua permintaan serentak dapat mengeluarkan petugas dari ABT.
 *
 * Acaknya hanya supaya beberapa juru sita yang mencetak bersamaan tidak
 * mengetuk peladen pada detik yang sama. Keputusan 25 September 2026: jarak
 * ini TIDAK meniru pola kerja manusia - profil lama (rata-rata ±49 detik
 * dengan jeda panjang sesekali) sudah dibuang; 5 Oktober 2026 pengguna memilih
 * "tanpa jeda di ABT" untuk isian ABT, sebab ABT tidak menulis jejak audit
 * untuk membaca blangko (view/preview tidak menulis satu baris pun).
 *
 * `acak` disuntikkan supaya uji dapat memakai deret tetap.
 */
const RELAAS_JEDA_MIN_MS = 1000;
const RELAAS_JEDA_MAKS_MS = 2500;
const RELAAS_JEDA_LANGKAH_MIN_MS = 250;
const RELAAS_JEDA_LANGKAH_MAKS_MS = 750;
/** Rata-rata jeda antar dokumen - sebarannya seragam, jadi titik tengahnya. */
const RELAAS_JEDA_RATA_MS = Math.round((RELAAS_JEDA_MIN_MS + RELAAS_JEDA_MAKS_MS) / 2);
/**
 * Kira-kira lamanya satu dokumen dikerjakan: dua permintaan berat ABT (buka
 * dan CETAK), tanpa jeda di antaranya, lalu unduhan RTF.
 */
const RELAAS_KERJA_RATA_MS = 3500;
/**
 * Blangko yang dicari di SELURUH kelompok dan tidak ada diingat sebentar,
 * supaya tiap tombol Cetak tidak membuka ulang sampai empat puluh halaman
 * kelompok untuk jawaban yang sama. Pendek dengan sengaja: blangko yang baru
 * ditambahkan admin ke ABT terbaca lagi paling lambat sesudah ini (atau
 * seketika lewat panen paksa).
 */
const RELAAS_UMUR_HILANG_MS = 10 * 60 * 1000;

/** Sumber acak peramban bila ada; Math.random hanya cadangan. */
function relaasAcak() {
  if (typeof crypto !== "undefined" && crypto && typeof crypto.getRandomValues === "function") {
    const u = new Uint32Array(1);
    crypto.getRandomValues(u);
    return u[0] / 4294967296;
  }
  return Math.random();
}

/** Milidetik bulat yang tersebar seragam di [min, maks]. */
function relaasJedaSeragam(acak, min, maks) {
  const r = typeof acak === "function" ? acak : relaasAcak;
  const u = Math.min(1, Math.max(0, Number(r()) || 0));
  return Math.round(min + u * (maks - min));
}

/** Jeda antar dokumen: 1-2,5 detik, untuk beban peladen ABT. */
function relaasJedaDokumen(acak) {
  return relaasJedaSeragam(acak, RELAAS_JEDA_MIN_MS, RELAAS_JEDA_MAKS_MS);
}

/**
 * Jarak di antara halaman kelompok saat memanen blangko: 0,25-0,75 detik.
 * Langkah di dalam satu dokumen tidak lagi berjeda (7 Okt 2026).
 */
function relaasJedaLangkah(acak) {
  return relaasJedaSeragam(acak, RELAAS_JEDA_LANGKAH_MIN_MS, RELAAS_JEDA_LANGKAH_MAKS_MS);
}

/** Perkiraan lamanya satu putaran sebagai rentang - tanpa jeda sesudah dokumen terakhir. */
function relaasPerkiraanMs(jumlah) {
  const n = Math.max(0, Math.floor(Number(jumlah) || 0));
  if (n === 0) return { rata: 0, rendah: 0, tinggi: 0 };
  const rata = n * RELAAS_KERJA_RATA_MS + (n - 1) * RELAAS_JEDA_RATA_MS;
  return { rata, rendah: Math.round(rata * 0.75), tinggi: Math.round(rata * 1.3) };
}

/* ─── 4. Pekerjaan dan pemulihannya ──────────────────────────────────────── */

/**
 * Satu bagian jalur unduhan yang aman bagi sistem berkas Windows: tanpa
 * \ / : * ? " < > | dan tanpa aksara kendali, tanpa titik di depan (berkas
 * tersembunyi) dan tanpa titik/spasi di ujung (Windows membuangnya diam-diam,
 * sehingga nama yang dicari riwayat unduhan tidak lagi sama).
 */
function relaasRapikanNama(teks, batas) {
  const maks = Number(batas) > 0 ? Number(batas) : 150;
  return String(teks || "")
    .replace(/[\\/:*?"<>|\u0000-\u001f\u007f]+/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\.+/, "")
    .slice(0, maks)
    .replace(/[.\s]+$/, "")
    .trim();
}

/** Nama juru sita dari dokumen: string, atau objek { nama } dari bot (K1). */
function relaasNamaJurusita(nilai) {
  const mentah = nilai && typeof nilai === "object" ? nilai.nama : nilai;
  const nama = String(mentah || "").replace(/\s+/g, " ").trim();
  if (!nama || /^tidak tercatat$/i.test(nama)) return RELAAS_JURUSITA_KOSONG;
  return nama;
}

/**
 * Bentuk keluaran relaas & pemberitahuan putusan: RTF SAJA (permintaan
 * pengguna 6 Okt 2026: "untuk cetak relaas dan BAS jangan pdf, cukup
 * rtf/word saja"). RTF dari ABT disimpan apa adanya dan dicetak dari Word;
 * putaran ini tidak lagi meminta PDF ke ALETA (rute abt/pdf), jadi tidak ada
 * pilihan "unduhRtf"/"rtfBilaPdfGagal" - kiriman lama yang masih menyebutnya
 * diabaikan.
 */
const RELAAS_BENTUK = "rtf";

/**
 * Pekerjaan satu putaran, dari dokumen yang dipilih halaman Antrian Sidang.
 *
 * Kunci dokumen dipakai lagi di sini untuk MENOLAK ganda: bila suatu hari
 * halaman mengirim dua dokumen berkunci sama, yang kedua dilewati dengan
 * sebab, bukan dicetak dua kali. Dokumen yang tidak lengkap juga dilewati
 * beserta sebabnya - panggilan sidang tanpa nomor sidang mencetak blangko yang
 * tanggal sidangnya kosong, dan itu lebih buruk daripada tidak mencetak.
 *
 * NAMA BERKAS DIJAMIN UNIK DI DALAM SATU FOLDER JURU SITA. Dua dokumen bernama
 * sama akan dibedakan Chrome dengan " (1)" - dan akhiran itu pula yang
 * diterima pola riwayat unduhan, sehingga pemulihan sesudah pekerja mati dapat
 * mengira berkas dokumen LAIN sebagai bukti dokumen ini, lalu tidak
 * mencetaknya sama sekali. Yang kedua karena itu diberi " - 2", akhiran yang
 * tidak pernah dibuat Chrome.
 */
function relaasBuatPekerjaan(masukan, sekarangMs) {
  const p = masukan || {};
  const sekarang = Number(sekarangMs) || Date.now();
  const dilewati = (Array.isArray(p.dilewati) ? p.dilewati : []).map((x) => ({
    kunci: String((x && x.kunci) || ""),
    nomorPerkara: String((x && x.nomorPerkara) || ""),
    label: String((x && x.label) || ""),
    sebab: String((x && x.sebab) || "dilewati"),
  }));
  const butir = [];
  const terlihat = new Set();
  const namaTerpakai = new Set();
  for (const d of Array.isArray(p.dokumen) ? p.dokumen : []) {
    const kunci = String((d && d.kunci) || "");
    const nomor = String((d && d.nomorPerkara) || "");
    const label = String((d && d.label) || "");
    const lewati = (sebab) => dilewati.push({ kunci, nomorPerkara: nomor, label, sebab });
    if (!kunci) {
      lewati("dokumen tanpa kunci");
      continue;
    }
    if (terlihat.has(kunci)) {
      lewati("ganda - dokumen yang sama sudah ada di antrian ini");
      continue;
    }
    terlihat.add(kunci);
    const perkaraId = String((d && d.perkaraId) || "").trim();
    if (!/^\d+$/.test(perkaraId) || /^0+$/.test(perkaraId)) {
      lewati("perkara_id tidak terbaca");
      continue;
    }
    const berkas = String((d && d.berkas) || "");
    if (!berkas) {
      lewati("blangko tidak ditentukan");
      continue;
    }
    const golongan = String((d && d.golongan) || "");
    if (!RELAAS_GOLONGAN.includes(golongan)) {
      lewati(`golongan "${golongan}" tidak dikenal - tidak dapat ditentukan apakah blangkonya menuntut nomor sidang`);
      continue;
    }
    const nomorSidang = Number(d && d.d);
    const butuhSidang = golongan !== "pemberitahuan-putusan";
    if (butuhSidang && !(Number.isInteger(nomorSidang) && nomorSidang > 0)) {
      lewati("nomor sidang tidak terbaca - blangko panggilan menuntut urutan sidang (d)");
      continue;
    }
    const jurusita = relaasNamaJurusita(d && d.jurusita);
    const folderJurusita = relaasRapikanNama(jurusita, RELAAS_FOLDER_MAKS) || RELAAS_JURUSITA_KOSONG;
    const dasarNama =
      relaasRapikanNama(d && d.nama, RELAAS_NAMA_MAKS) ||
      relaasRapikanNama(`${nomor} - ${label}`, RELAAS_NAMA_MAKS) ||
      relaasRapikanNama(kunci, RELAAS_NAMA_MAKS);
    let nama = dasarNama;
    for (let ke = 2; namaTerpakai.has(`${folderJurusita}/${nama}`.toLowerCase()); ke += 1) {
      nama = `${dasarNama} - ${ke}`;
    }
    namaTerpakai.add(`${folderJurusita}/${nama}`.toLowerCase());
    butir.push({
      kunci,
      perkaraId,
      nomorPerkara: nomor,
      golongan,
      label,
      d: butuhSidang ? nomorSidang : 0,
      berkas,
      nama,
      jurusita,
      folderJurusita,
      keadaan: "menunggu",
      percobaan: 0,
      sebab: "",
      hasil: "",
      unduhan: { rtf: "" },
      mulaiPertama: 0,
      mulaiPada: 0,
      selesaiPada: 0,
    });
  }
  const tanggal = /^\d{4}-\d{2}-\d{2}$/.test(String(p.tanggal || "")) ? String(p.tanggal) : "";
  return {
    // Waktu SAJA tidak unik: dua pekerjaan dalam milidetik yang sama akan
    // berbagi penanda henti (KUNCI_RELAAS_HENTI mencocokkan id).
    id: `relaas-${sekarang}-${Math.floor(relaasAcak() * 1e9).toString(36)}`,
    dibuat: sekarang,
    tanggal,
    asalAbt: relaasDasarAbt(p.asalAbt),
    asal: relaasAsalPortal(p.asal),
    // Satu folder per tanggal, satu subfolder per juru sita, supaya relaas
    // hari itu dapat dibagikan tanpa memilahnya dari unduhan lain.
    folder: relaasRapikanNama(`ALETA relaas ${tanggal || "tanpa tanggal"}`),
    opsi: { bentuk: RELAAS_BENTUK },
    butir,
    dilewati,
    catatan: [],
    waktuBerikut: 0,
    pemulihan: 0,
    selesai: butir.length === 0,
    selesaiPada: butir.length === 0 ? sekarang : 0,
    tertahan: null,
    dihentikan: false,
  };
}

/** Jalur relatif satu dokumen di folder unduhan, tanpa akhiran. */
function relaasJalurBerkas(pekerjaan, butir) {
  return `${pekerjaan.folder}/${butir.folderJurusita || RELAAS_JURUSITA_KOSONG}/${butir.nama}`;
}

/** Butir berikutnya yang masih menunggu - atau null bila habis. */
function relaasButirBerikutnya(pekerjaan) {
  if (!pekerjaan || !Array.isArray(pekerjaan.butir)) return null;
  return pekerjaan.butir.find((b) => b.keadaan === "menunggu") || null;
}

/** Apakah berkas satu butir sudah tersimpan - satu RTF, tidak ada PDF. */
function relaasBerkasLengkap(pekerjaan, butir) {
  void pekerjaan;
  const u = (butir && butir.unduhan) || {};
  return Boolean(u.rtf);
}

/** Nama berkas yang sudah tersimpan untuk satu butir, untuk neraca. */
function relaasHasilButir(butir) {
  const u = (butir && butir.unduhan) || {};
  return u.rtf ? String(u.rtf) : "";
}

/**
 * ============================================================================
 * MEMULIHKAN SESUDAH PEKERJA MATI - TANPA MENCETAK GANDA
 * ============================================================================
 *
 * Butir yang tersimpan "sedang" ketika pekerja hidup lagi dikerjakan oleh
 * pekerja YANG SUDAH MATI. Dua kemungkinannya menuntut jawaban berlawanan:
 *
 *   mati SEBELUM unduhannya lahir   -> aman diulang dari awal;
 *   mati SESUDAH unduhannya lahir,
 *   sebelum sempat mencatatnya      -> mengulangnya berarti MENCETAK GANDA.
 *
 * Pembedanya bukti dari riwayat unduhan peramban (chrome.downloads.search
 * atas jalur berkasnya, sejak butir itu PERTAMA KALI dimulai). Pemanggil yang
 * mencarinya; fungsi ini hanya memutuskan, per berkas:
 *
 *   berkas yang ada buktinya      -> dicatat tersimpan, TIDAK diunduh ulang
 *   seluruh berkas yang diminta ada -> selesai
 *   masih ada yang kurang         -> menunggu lagi; percobaan tetap terhitung,
 *                                    dan yang sudah ada tidak diunduh ulang
 *   percobaan habis               -> gagal, dengan sebab yang menyebut pekerjanya
 */
function relaasPulihkan(pekerjaan, bukti) {
  const catatan = [];
  if (!pekerjaan || !Array.isArray(pekerjaan.butir)) return catatan;
  const peta = bukti || {};
  for (const b of pekerjaan.butir) {
    if (b.keadaan !== "sedang") continue;
    if (!b.unduhan || typeof b.unduhan !== "object") b.unduhan = { rtf: "" };
    const ada = peta[b.kunci] || {};
    let tambahan = "";
    if (!b.unduhan.rtf && ada.rtf && ada.rtf.nama) {
      b.unduhan.rtf = ada.rtf.nama;
      tambahan = " (RTF ditemukan di riwayat unduhan, tidak diunduh ulang)";
    }
    if (relaasBerkasLengkap(pekerjaan, b)) {
      b.keadaan = "selesai";
      b.sebab = `dipulihkan dari riwayat unduhan sesudah pekerja latar mati - tidak diunduh ulang`;
      b.hasil = relaasHasilButir(b);
      b.selesaiPada = Date.now();
      catatan.push(`${b.nomorPerkara || b.kunci}: selesai, dari riwayat unduhan`);
      continue;
    }
    if (Number(b.percobaan) >= RELAAS_BATAS_PERCOBAAN) {
      b.keadaan = "gagal";
      b.sebab =
        `pekerja latar Chrome mati di tengah dokumen ini dan percobaannya sudah ${b.percobaan} kali - tidak ` +
        `diulang lagi supaya putaran tidak berputar di tempat${tambahan}. Cetak dokumen ini sendiri dari ABT.`;
      b.hasil = relaasHasilButir(b);
      b.selesaiPada = Date.now();
      catatan.push(`${b.nomorPerkara || b.kunci}: gagal sesudah ${b.percobaan} percobaan`);
      continue;
    }
    b.keadaan = "menunggu";
    b.sebab = `diulang: pekerja latar mati di tengah dokumen ini (percobaan ke-${b.percobaan})${tambahan}`;
    catatan.push(`${b.nomorPerkara || b.kunci}: diulang${tambahan}`);
  }
  return catatan;
}

/** Hitungan keadaan satu pekerjaan - neraca yang digambar halaman. */
function relaasRingkas(pekerjaan) {
  const hitung = { menunggu: 0, sedang: 0, selesai: 0, gagal: 0, dilewati: 0 };
  if (!pekerjaan) return hitung;
  for (const b of pekerjaan.butir || []) {
    hitung[b.keadaan] = (hitung[b.keadaan] || 0) + 1;
  }
  hitung.dilewati += (pekerjaan.dilewati || []).length;
  return hitung;
}

/**
 * Pola chrome.downloads.search untuk satu jalur relatif (folder/juru sita/
 * nama, tanpa akhiran), termasuk akhiran " (1)" dari uniquify. Pemisahnya
 * [\\/] sebab Chrome menuliskan jalur dengan pemisah sistem operasinya.
 */
function relaasPolaUnduhan(jalurRelatif) {
  const bagian = String(jalurRelatif || "")
    .split("/")
    .map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  return `(^|[\\\\/])${bagian.join("[\\\\/]")}( \\(\\d+\\))?\\.rtf$`;
}

/** Base64 dari ArrayBuffer, dipotong supaya String.fromCharCode tidak kewalahan. */
function relaasBase64(buffer) {
  const u = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer || new ArrayBuffer(0));
  let biner = "";
  const potong = 0x8000;
  for (let i = 0; i < u.length; i += potong) {
    biner += String.fromCharCode.apply(null, Array.from(u.subarray(i, i + potong)));
  }
  return btoa(biner);
}

function relaasPesan(galat) {
  return String((galat && galat.message) || galat || "sebabnya tidak terbaca").slice(0, 240);
}

/* ─── 5. Penyimpanan ─────────────────────────────────────────────────────── */

/**
 * storage.session lebih dahulu: hidup di luar pekerjanya dan terhapus ketika
 * peramban ditutup - umur yang pantas bagi putaran cetak. storage.local
 * cadangan bagi peramban yang belum mengenalnya.
 */
function gudangRelaas() {
  const g = (chrome.storage && chrome.storage.session) || (chrome.storage && chrome.storage.local) || null;
  if (!g) throw new Error("penyimpanan ekstensi tidak tersedia - kemajuan tidak dapat disimpan");
  return g;
}

async function muatRelaas() {
  const isi = await gudangRelaas().get(KUNCI_RELAAS);
  return (isi && isi[KUNCI_RELAAS]) || null;
}

/**
 * ============================================================================
 * PUTARAN YANG AKAN HILANG BILA EKSTENSI DIMUAT ULANG
 * ============================================================================
 *
 * chrome.storage.session dikosongkan Chrome ketika ekstensi dimuat ulang atau
 * diperbarui. Tombol "Perbarui sekarang" / "Muat ulang ekstensi" (panel ALETA
 * dan popup) yang ditekan selagi putaran cetak relaas belum selesai MENGHAPUS
 * putaran itu: kemajuannya lenyap dari dialog, dan dokumen yang belum
 * tercetak harus dipilih ulang dari Antrian Sidang. Pemuatan ulang karena itu
 * DITAHAN dan sebabnya dikatakan - petugas yang tetap ingin memperbarui
 * menekan tombolnya sekali lagi (paksa).
 *
 * Pulang kalimat keadaan putarannya, atau null bila tidak ada yang hilang.
 */
async function relaasPenghalangMuatUlang() {
  // Tanpa penyimpanan ekstensi sama sekali tidak ada putaran yang dapat
  // tersimpan (simpanRelaas melempar, dan relaas-mulai gagal karenanya) - jadi
  // tidak ada yang hilang. Bukan galat yang ditelan: gudangRelaas() tidak
  // dipanggil di sini supaya Perbarui tetap bekerja di pemasangan itu.
  if (!chrome.storage || !(chrome.storage.session || chrome.storage.local)) return null;
  if (mulaiRelaasDisiapkan) {
    return "Putaran cetak relaas sedang disiapkan (blangkonya sedang dibaca dari ABT).";
  }
  const pekerjaan = await muatRelaas();
  if (!pekerjaan || pekerjaan.selesai) return null;
  const r = relaasRingkas(pekerjaan);
  const total = (pekerjaan.butir || []).length;
  const belum = r.menunggu + r.sedang;
  return (
    `Putaran cetak relaas${pekerjaan.tanggal ? ` tanggal ${pekerjaan.tanggal}` : ""} ` +
    `${pekerjaan.tertahan ? "sedang tertahan" : "sedang berjalan"}: ${r.selesai} dari ${total} dokumen ` +
    `selesai, ${belum} belum.`
  );
}

/** Jawaban tombol Perbarui / Muat ulang yang DITAHAN putaran relaas. */
function relaasTahanMuatUlang(keadaanPutaran, versiSekarang, versiBaru) {
  return {
    ok: false,
    keadaan: "putaran-relaas-berjalan",
    versiSekarang,
    versiBaru,
    pesan:
      `${keadaanPutaran} Memperbarui atau memuat ulang ekstensi sekarang MENGHAPUS putaran itu - ` +
      `dokumen yang belum tercetak harus dipilih ulang dari Antrian Sidang. ` +
      (versiBaru
        ? `Versi ${versiBaru} sudah tersedia dan dipasang Chrome sendiri begitu ekstensi menganggur ` +
          `(lazimnya sesudah putaran selesai). `
        : "") +
      `Tunggu sampai putarannya selesai, atau hentikan dulu di dialog Cetak relaas. Tekan tombolnya ` +
      `sekali lagi bila tetap ingin sekarang.`,
  };
}

/**
 * ============================================================================
 * ANTREAN KERJA MASSAL DI TAB SIPP/ABT - JUGA MENAHAN PEMBARUAN (9 Okt 2026)
 * ============================================================================
 *
 * Keputusan pengguna: tombol "Perbarui ekstensi" DITAHAN selama antrean massal
 * berjalan - penetapan massal, putusan massal (SIPP dan ABT), BAS massal,
 * relaas & PBT massal, dan putaran kerja massal lain di tab SIPP/ABT mana pun.
 * Sebelumnya hanya putaran relaas (yang hidup di pekerja ini) yang menahan;
 * antrean lain hidup di skrip konten tab, dan memuat ulang ekstensi MEMUTUS
 * skrip itu di tengah butir - borang setengah terisi, unduhan setengah jalan.
 *
 * Tab melaporkan antreannya lewat pesan (alatAntreanKerja di panel-alat.js):
 *   "antrean-kerja-denyut"  { id, antrean, nama, selesai, total }
 *   "antrean-kerja-selesai" { id }
 * Catatannya di chrome.storage.session, BUKAN variabel modul: pekerja MV3 mati
 * tiap ±30 detik menganggur dan catatannya harus tetap ada sesudah ia bangun.
 * Penyimpanan sesi dikosongkan Chrome sendiri saat ekstensi dimuat ulang -
 * tepat ketika antrean di tab memang terputus.
 *
 * BASI: antrean tanpa denyut selama ANTREAN_KERJA_BASI_MS dianggap macet atau
 * ditinggal dan TIDAK menahan lagi. Tab yang ditutup dilepas seketika.
 */
const KUNCI_ANTREAN_KERJA = "aletaAntreanKerjaMassal";
const ANTREAN_KERJA_BASI_MS = 10 * 60 * 1000;
const ANTREAN_KERJA_MAKS = 30;

function gudangAntreanKerja() {
  return (chrome.storage && (chrome.storage.session || chrome.storage.local)) || null;
}

/** Hanya yang bentuknya sah dan belum basi. `sekarang` dapat disuntik uji. */
function antreanKerjaBersih(catatan, sekarang) {
  const kini = Number(sekarang) || Date.now();
  const hasil = {};
  for (const [id, a] of Object.entries((catatan && typeof catatan === "object" && catatan) || {})) {
    if (!a || typeof a !== "object") continue;
    const denyut = Number(a.denyut) || 0;
    if (!denyut || kini - denyut >= ANTREAN_KERJA_BASI_MS) continue;
    hasil[id] = a;
  }
  return hasil;
}

async function muatAntreanKerja() {
  const g = gudangAntreanKerja();
  if (!g) return {};
  const isi = await g.get(KUNCI_ANTREAN_KERJA);
  return (isi && isi[KUNCI_ANTREAN_KERJA]) || {};
}

async function simpanAntreanKerja(catatan) {
  const g = gudangAntreanKerja();
  if (!g) return;
  await g.set({ [KUNCI_ANTREAN_KERJA]: catatan });
}

/** Rantai tulis satu per satu - dua denyut serentak tidak boleh saling menimpa. */
let rantaiAntreanKerja = Promise.resolve();
function ubahAntreanKerja(ubah) {
  const jalan = rantaiAntreanKerja.then(async () => {
    const catatan = antreanKerjaBersih(await muatAntreanKerja());
    ubah(catatan);
    const kunci = Object.keys(catatan);
    if (kunci.length > ANTREAN_KERJA_MAKS) {
      kunci
        .sort((a, b) => Number(catatan[a].denyut) - Number(catatan[b].denyut))
        .slice(0, kunci.length - ANTREAN_KERJA_MAKS)
        .forEach((k) => delete catatan[k]);
    }
    await simpanAntreanKerja(catatan);
    return catatan;
  });
  rantaiAntreanKerja = jalan.catch(() => undefined);
  return jalan;
}

function catatDenyutAntrean(pesan, pengirim) {
  const id = String((pesan && pesan.id) || "").slice(0, 120);
  if (!id) return Promise.resolve(null);
  const angka = (x) => Math.max(0, Math.floor(Number(x) || 0));
  return ubahAntreanKerja((catatan) => {
    catatan[id] = {
      id,
      antrean: String((pesan && pesan.antrean) || "").slice(0, 60),
      nama: String((pesan && pesan.nama) || "antrean massal").slice(0, 80),
      selesai: angka(pesan && pesan.selesai),
      total: angka(pesan && pesan.total),
      tab: pengirim && pengirim.tab && Number.isInteger(pengirim.tab.id) ? pengirim.tab.id : null,
      denyut: Date.now(),
    };
  });
}

function lepasAntreanKerja(id) {
  const kunci = String(id || "");
  if (!kunci) return Promise.resolve(null);
  return ubahAntreanKerja((catatan) => {
    delete catatan[kunci];
  });
}

try {
  if (chrome.tabs && chrome.tabs.onRemoved) {
    chrome.tabs.onRemoved.addListener((idTab) => {
      void ubahAntreanKerja((catatan) => {
        for (const [id, a] of Object.entries(catatan)) if (a && a.tab === idTab) delete catatan[id];
      }).catch(() => undefined);
    });
  }
} catch {
  /* tanpa tabs: antrean tab yang ditutup lepas sendiri sesudah basi */
}

/**
 * Antrean kerja yang masih berjalan dan akan TERPUTUS bila ekstensi dimuat
 * ulang - yang denyutnya paling baru - atau null. `sekarang` dapat disuntik uji.
 */
async function antreanKerjaPenghalang(sekarang) {
  if (!gudangAntreanKerja()) return null;
  const hidup = Object.values(antreanKerjaBersih(await muatAntreanKerja(), sekarang));
  if (!hidup.length) return null;
  hidup.sort((a, b) => Number(b.denyut) - Number(a.denyut));
  const a = hidup[0];
  const lain = hidup.length - 1;
  const kemajuan = a.total ? ` (${Math.min(a.selesai, a.total)}/${a.total})` : "";
  return {
    nama: a.nama,
    selesai: a.selesai,
    total: a.total,
    jumlah: hidup.length,
    kalimat: `Tunggu antrean ${a.nama} selesai${kemajuan}.${lain ? ` ${lain} antrean massal lain juga sedang berjalan.` : ""}`,
  };
}

/**
 * Satu pertanyaan untuk tombol Perbarui / Muat ulang: putaran relaas DULU
 * (kalimat dan keadaannya tetap seperti sebelumnya), lalu antrean kerja tab.
 * Pulang { jenis: "relaas" | "antrean", kalimat, ... } atau null.
 */
async function penghalangMuatUlang() {
  const relaas = await relaasPenghalangMuatUlang();
  if (relaas) return { jenis: "relaas", kalimat: relaas };
  const antrean = await antreanKerjaPenghalang();
  if (antrean) return { jenis: "antrean", ...antrean };
  return null;
}

/** Jawaban tombol yang DITAHAN - relaas atau antrean kerja. "Tetap perbarui" (paksa) tetap ada. */
function tahanMuatUlang(cegah, versiSekarang, versiBaru) {
  if (!cegah) return null;
  if (cegah.jenis === "relaas") {
    return { ...relaasTahanMuatUlang(cegah.kalimat, versiSekarang, versiBaru), ditahan: true, labelPaksa: "Tetap perbarui - putaran cetak hilang" };
  }
  return {
    ok: false,
    keadaan: "antrean-berjalan",
    ditahan: true,
    labelPaksa: "Tetap perbarui - antrean terputus",
    antrean: { nama: cegah.nama, selesai: cegah.selesai, total: cegah.total, jumlah: cegah.jumlah },
    versiSekarang,
    versiBaru,
    pesan:
      `${cegah.kalimat} Memperbarui atau memuat ulang ekstensi sekarang MEMUTUS antrean itu di tengah ` +
      `butir yang sedang dikerjakan - butir yang terputus harus diperiksa dan diulang sendiri. ` +
      (versiBaru
        ? `Versi ${versiBaru} sudah tersedia dan dipasang Chrome sendiri begitu ekstensi menganggur. `
        : "") +
      `Tunggu sampai antreannya selesai atau hentikan dulu dari panelnya. Antrean yang tidak berdenyut ` +
      `${Math.round(ANTREAN_KERJA_BASI_MS / 60000)} menit dianggap macet dan tidak menahan lagi. Tekan ` +
      `"Tetap perbarui" bila tetap ingin sekarang - antreannya akan terputus.`,
  };
}

/** MELEMPAR bila gagal - putaran yang tidak dapat menyimpan kemajuannya harus berhenti. */
async function simpanRelaas(pekerjaan) {
  if (Array.isArray(pekerjaan.catatan) && pekerjaan.catatan.length > RELAAS_CATATAN_MAKS) {
    pekerjaan.catatan = pekerjaan.catatan.slice(-RELAAS_CATATAN_MAKS);
  }
  await gudangRelaas().set({ [KUNCI_RELAAS]: pekerjaan });
}

async function dimintaBerhenti(id) {
  const isi = await gudangRelaas().get(KUNCI_RELAAS_HENTI);
  const h = isi && isi[KUNCI_RELAAS_HENTI];
  return Boolean(h && h.id === id);
}

function tidurRelaas(ms) {
  return new Promise((r) => setTimeout(r, Math.max(0, Number(ms) || 0)));
}

/**
 * Menutup pekerjaan yang diminta berhenti: sisa antrian dilewati BESERTA
 * sebabnya. Butir yang RTF-nya sudah tersimpan tetapi belum tercatat selesai
 * tidak disebut "sebelum dikerjakan" - berkas yang sudah ada di folder
 * unduhan harus dapat dicocokkan dengan neracanya.
 */
function tutupDenganHenti(pekerjaan) {
  for (const b of pekerjaan.butir) {
    if (b.keadaan === "menunggu" || b.keadaan === "sedang") {
      const tersimpan = relaasHasilButir(b);
      b.keadaan = "dilewati";
      b.sebab = tersimpan
        ? `dihentikan petugas di tengah dokumen ini - yang sudah tersimpan: ${tersimpan}`
        : "dihentikan petugas sebelum dikerjakan";
      b.hasil = tersimpan;
    }
  }
  pekerjaan.dihentikan = true;
  pekerjaan.selesai = true;
  pekerjaan.tertahan = null;
  pekerjaan.selesaiPada = Date.now();
}

/* ─── 6. Token blangko dari halaman ABT ──────────────────────────────────── */

/**
 * Simpanan token satu alamat ABT: { token, hilang }. `hilang` = blangko yang
 * dicari di seluruh kelompok dan TIDAK ada - { nama: { pada, dibaca } },
 * berumur RELAAS_UMUR_HILANG_MS (7 Okt 2026). Di storage.local, bukan ingatan
 * pekerja: pekerja MV3 mati tiap ±30 detik menganggur.
 */
async function bacaSimpananToken(dasarAbt) {
  const isi = await chrome.storage.local.get(KUNCI_TOKEN_RELAAS);
  const s = isi && isi[KUNCI_TOKEN_RELAAS];
  if (!s || s.asal !== dasarAbt || Date.now() - Number(s.pada || 0) > RELAAS_UMUR_TOKEN_MS) return { token: {}, hilang: {} };
  const hilang = {};
  for (const [n, h] of Object.entries((s.hilang && typeof s.hilang === "object" && s.hilang) || {})) {
    const pada = Number(h && h.pada) || 0;
    if (Date.now() - pada >= 0 && Date.now() - pada < RELAAS_UMUR_HILANG_MS) hilang[n] = { pada, dibaca: Number(h.dibaca) || 0 };
  }
  return { token: { ...(s.token || {}) }, hilang };
}

async function bacaTokenTersimpan(dasarAbt) {
  return (await bacaSimpananToken(dasarAbt)).token;
}

/** `hilang` tidak disebut = yang tersimpan dipertahankan. */
async function simpanTokenTersimpan(dasarAbt, token, hilang) {
  const tetap = hilang === undefined ? (await bacaSimpananToken(dasarAbt)).hilang : hilang;
  await chrome.storage.local.set({ [KUNCI_TOKEN_RELAAS]: { asal: dasarAbt, pada: Date.now(), token, hilang: tetap || {} } });
}

async function lupakanTokenRelaas(dasarAbt, nama) {
  const s = await bacaSimpananToken(dasarAbt);
  delete s.token[nama];
  await simpanTokenTersimpan(dasarAbt, s.token, s.hilang);
}

/** Satu halaman ABT, dengan sesi peramban (kuki ikut). */
async function relaasBacaHalaman(alamat, init) {
  const r = await fetch(alamat, {
    credentials: "include",
    cache: "no-store",
    ...(init || {}),
  });
  const teks = await r.text();
  return { r, teks, masuk: relaasHalamanMasuk(teks, r.url) };
}

/** Sebab blangko yang tidak ditemukan, beserta kelompok yang GAGAL dibaca. */
function relaasSebabHilang(nama, panen) {
  const gagal = (panen && panen.kelompokGagal) || [];
  return (
    `blangko "${nama}" tidak ditemukan di ABT ini (${(panen && panen.kelompokDibaca) || 0} kelompok dibuka` +
    (gagal.length ? `; gagal dibaca: ${gagal.join(", ")}` : "") +
    ")"
  );
}

/**
 * Memanen token a/b untuk nama-nama katalog dari halaman ABT.
 *
 * Token blangko DIENKRIPSI peladen ABT (pustaka encrypt CodeIgniter, mcrypt),
 * jadi ekstensi tidak dapat menyusunnya sendiri. Satu-satunya sumber: tautan
 * yang dirender ABT pada halaman kelompok blangkonya. Halamannya diambil lewat
 * fetch dari pekerja (sesi ABT ikut sebagai kuki), berjarak pendek antar
 * halaman demi beban peladen, tanpa tab ABT di depan petugas.
 *
 * Kelompok yang GAGAL dibaca tidak ditelan: namanya dan kode jawabannya ikut
 * dipulangkan, sehingga "blangko tidak ditemukan" tidak pernah menyembunyikan
 * "halaman kelompoknya menjawab 500".
 *
 * Pulang { ok, token, hilang, kelompokDibaca, kelompokGagal } atau
 * { ok:false, perluMasuk?, bolehUlang?, sebab }.
 */
/**
 * ============================================================================
 * SATU PANEN PADA SATU WAKTU, DAN "PAKSA" YANG DIBATASI
 * ============================================================================
 *
 * Panen membuka beranda ABT dan halaman kelompok dengan kuki petugas. Tanpa
 * pengunci, lima pesan relaas-panen {paksa:true} serentak membuka beranda lima
 * kali dalam tiga detik (terukur pada telaah 25 September 2026), dan
 * simpanTokenTersimpan-nya saling menimpa. Karena itu:
 *
 *   - panen yang datang selagi panen lain berjalan MENUNGGU panen itu selesai
 *     lalu berjalan sendiri - biasanya langsung terjawab dari token yang baru
 *     disimpan, tanpa menyentuh ABT;
 *   - "paksa" (membuang token tersimpan) hanya dituruti sekali per
 *     RELAAS_JEDA_PANEN_PAKSA_MS, dan tidak selama putaran cetak berjalan -
 *     token yang ditolak ABT sudah dibuang sendiri oleh putarannya.
 *
 * Penanda ini variabel modul dengan sengaja: yang dijaganya panen yang sedang
 * berjalan DI PEKERJA INI, dan ia harus hilang bersama pekerjanya.
 */
const RELAAS_JEDA_PANEN_PAKSA_MS = 60000;
let panenRelaasBerjalan = null;
let panenRelaasPaksaTerakhir = 0;

async function panenTokenRelaas(asalAbt, diminta, opsi) {
  while (panenRelaasBerjalan) {
    // allSettled: yang ditunggu hanya SELESAINYA. Hasil atau galat panen itu
    // milik pemanggilnya sendiri dan sampai kepadanya - di sini tidak ada
    // yang ditelan, sebab panen milik pemanggil ini berjalan sesudahnya dan
    // melaporkan kegagalannya sendiri.
    await Promise.allSettled([panenRelaasBerjalan]);
  }
  const mintaPaksa = Boolean(opsi && opsi.paksa);
  const paksa =
    mintaPaksa && !pelariRelaasHidup && Date.now() - panenRelaasPaksaTerakhir >= RELAAS_JEDA_PANEN_PAKSA_MS;
  const janji = panenTokenRelaasInti(asalAbt, diminta, { paksa, utamakan: (opsi && opsi.utamakan) || "" });
  panenRelaasBerjalan = janji;
  try {
    const hasil = await janji;
    if (mintaPaksa && !paksa) {
      hasil.paksaDiabaikan = pelariRelaasHidup
        ? "putaran cetak sedang berjalan - token tersimpan dipakai"
        : `panen paksa terakhir kurang dari ${Math.round(RELAAS_JEDA_PANEN_PAKSA_MS / 1000)} detik lalu - token tersimpan dipakai`;
    }
    return hasil;
  } finally {
    if (paksa) panenRelaasPaksaTerakhir = Date.now();
    if (panenRelaasBerjalan === janji) panenRelaasBerjalan = null;
  }
}

async function panenTokenRelaasInti(asalAbt, diminta, opsi) {
  const dasar = relaasDasarAbt(asalAbt);
  if (!dasar) return { ok: false, sebab: "alamat ABT tidak diketahui" };
  const nama = [...new Set((diminta || []).map(String).filter(Boolean))];
  const simpanan = await bacaSimpananToken(dasar);
  const peta = simpanan.token;
  const hilangLama = simpanan.hilang;
  if (opsi && opsi.paksa) {
    for (const n of nama) {
      delete peta[n];
      delete hilangLama[n];
    }
  }
  // Token ikrar tersimpan dari kelompok bukan-ikrar yang BELUM pernah diuji
  // terhadap kelompok ikrar (simpanan sebelum 6 Okt malam) dipanen ulang
  // SEKALI. Yang ditandai ikrarCadangan sudah melewati pemeriksaan itu -
  // kelompok ikrar tidak memuat berkasnya - jadi tidak dipanen tiap dokumen.
  for (const n of nama) {
    const t = peta[n];
    if (t && relaasNamaIkrar(n) && !relaasKelompokIkrar(t.kelompok) && !t.ikrarCadangan) delete peta[n];
  }
  let kurang = nama.filter((n) => !peta[n]);
  const pilih = () => Object.fromEntries(nama.filter((n) => peta[n]).map((n) => [n, peta[n]]));
  if (kurang.length === 0) {
    return { ok: true, token: pilih(), hilang: [], kelompokDibaca: 0, kelompokGagal: [], dariSimpanan: true };
  }
  // Seluruh yang kurang baru saja dicari di SEMUA kelompok dan tidak ada
  // (7 Okt 2026): jawabannya sama, jadi kelompok ABT tidak dibuka ulang.
  if (kurang.every((n) => hilangLama[n])) {
    return {
      ok: true,
      token: pilih(),
      hilang: kurang,
      kelompokDibaca: Math.max(...kurang.map((n) => hilangLama[n].dibaca)),
      kelompokGagal: [],
      dariSimpanan: true,
    };
  }

  const beranda = await relaasBacaHalaman(`${dasar}/main/beranda`);
  if (beranda.masuk) return { ok: false, perluMasuk: true, sebab: "Masuk ke ABT lebih dahulu." };
  if (!beranda.r.ok) {
    return {
      ok: false,
      bolehUlang: beranda.r.status >= 500,
      sebab: `ABT menjawab ${beranda.r.status} saat membaca beranda blangko`,
    };
  }
  const kelompok = relaasUrutkanKelompok(relaasUraiKelompok(beranda.teks), opsi && opsi.utamakan).slice(0, RELAAS_BATAS_KELOMPOK);
  if (kelompok.length === 0) {
    return {
      ok: false,
      sebab:
        "Bilah kelompok blangko ABT tidak terbaca - akun ABT yang masuk mungkin tidak diberi menu blangko sama sekali.",
    };
  }
  let dibaca = 0;
  const gagal = [];
  const adaKelompokIkrar = kelompok.some((k) => relaasKelompokIkrar(k.kelompok));
  const cadanganIkrar = {};
  for (const k of kelompok) {
    await tidurRelaas(relaasJedaLangkah());
    const h = await relaasBacaHalaman(new URL(k.alamat, `${dasar}/`).href);
    dibaca += 1;
    if (h.masuk) return { ok: false, perluMasuk: true, sebab: "Sesi ABT habis - masuk ke ABT lebih dahulu." };
    if (!h.r.ok) {
      gagal.push(`"${k.kelompok}" (ABT menjawab ${h.r.status})`);
      continue;
    }
    const { token } = relaasPetakanToken(kurang, relaasUraiBerkas(h.teks));
    for (const [n, t] of Object.entries(token)) {
      const isi = { ...t, kelompok: t.kelompok || k.kelompok };
      // Blangko ikrar dari kelompok bukan-ikrar hanya cadangan selama
      // kelompok ikrar ada dan belum dibuka.
      if (relaasNamaIkrar(n) && !relaasKelompokIkrar(isi.kelompok)) {
        // Tanpa kelompok ikrar sama sekali: tetap dipakai, ditandai sudah
        // diperiksa supaya tidak dipanen ulang tiap dokumen.
        if (!adaKelompokIkrar) {
          peta[n] = { ...isi, ikrarCadangan: true };
          continue;
        }
        if (!cadanganIkrar[n]) cadanganIkrar[n] = isi;
        continue;
      }
      peta[n] = isi;
    }
    kurang = nama.filter((n) => !peta[n]);
    if (kurang.length === 0) break;
  }
  for (const [n, t] of Object.entries(cadanganIkrar)) if (!peta[n]) peta[n] = { ...t, ikrarCadangan: true };
  kurang = nama.filter((n) => !peta[n]);
  // Yang tidak ada diingat HANYA bila tidak satu kelompok pun gagal dibaca -
  // "tidak ditemukan" karena halaman menjawab 500 bukan jawaban yang boleh
  // diulang dari simpanan.
  const hilangBaru = { ...hilangLama };
  for (const n of nama) if (peta[n]) delete hilangBaru[n];
  if (gagal.length === 0) for (const n of kurang) hilangBaru[n] = { pada: Date.now(), dibaca };
  await simpanTokenTersimpan(dasar, peta, hilangBaru);
  return { ok: true, token: pilih(), hilang: kurang, kelompokDibaca: dibaca, kelompokGagal: gagal };
}

/* ─── 7. Satu dokumen ────────────────────────────────────────────────────── */

/** Riwayat unduhan: janji bila tersedia, panggilan balik bila tidak. */
function cariUnduhan(kueri) {
  return new Promise((selesai, gagal) => {
    try {
      const hasil = chrome.downloads.search(kueri, (daftar) => {
        const g = chrome.runtime.lastError;
        if (g) gagal(new Error(g.message));
        else selesai(daftar || []);
      });
      if (hasil && typeof hasil.then === "function") hasil.then(selesai, gagal);
    } catch (e) {
      gagal(e);
    }
  });
}

/** Bukti dari riwayat unduhan untuk tiap butir "sedang" - lihat relaasPulihkan. */
async function buktiUnduhanRelaas(pekerjaan) {
  const bukti = {};
  for (const b of pekerjaan.butir) {
    if (b.keadaan !== "sedang") continue;
    try {
      const sejak = Number(b.mulaiPertama || b.mulaiPada || 0);
      const daftar = await cariUnduhan({
        filenameRegex: relaasPolaUnduhan(relaasJalurBerkas(pekerjaan, b)),
        startedAfter: new Date(Math.max(0, sejak - 2000)).toISOString(),
      });
      const peta = {};
      for (const x of daftar) {
        if (!x || x.state === "interrupted") continue;
        const namaBerkas = String(x.filename || "").split(/[\\/]/).pop();
        const format = /\.rtf$/i.test(namaBerkas) ? "rtf" : "";
        if (format && !peta[format]) peta[format] = { nama: namaBerkas, pada: Date.parse(x.startTime || "") || 0 };
      }
      if (peta.rtf) bukti[b.kunci] = peta;
    } catch (galat) {
      // Riwayat yang tidak terbaca TIDAK ditelan: butirnya diulang (tanpa
      // bukti tidak ada cara lain), dan kemungkinan gandanya disebut.
      pekerjaan.catatan.push(
        `${b.nomorPerkara}: riwayat unduhan tidak terbaca (${relaasPesan(galat)}) - dokumen diulang dan MUNGKIN tersimpan dua kali`
      );
    }
  }
  return bukti;
}

const RELAAS_TAHAN_ABT = "Sesi ABT belum masuk atau sudah habis - masuk ke ABT lebih dahulu, lalu tekan Lanjutkan.";

/**
 * ============================================================================
 * SATU RTF DARI ABT - panen token -> buka (cari) -> pilih sidang -> CETAK
 * ============================================================================
 *
 * Dipisah dari kerjakanSatuRelaas (perbaikan 6 Okt 2026, butir 17) supaya
 * edoc penetapan ("relaas-rtf" dari panel SIPP) menempuh jalan YANG SAMA
 * dengan cetak relaas massal - hak akses ABT tetap diperiksa di langkah cari.
 * Isinya dipindah apa adanya; opsi.utamakan hanya mendahulukan kelompok
 * blangko tertentu saat memanen token.
 *
 * Pulang { ok:true, rtf: ArrayBuffer } | { tahan:true, perluMasuk, sebab } |
 * { ok:false, sebab, bolehUlang? }.
 */
async function relaasAmbilRtf(dasar, berkas, perkaraId, d, opsi) {
  const butir = { berkas, perkaraId, d: Number(d) || 0 };
  let token;
  try {
    const panen = await panenTokenRelaas(dasar, [butir.berkas], { utamakan: (opsi && opsi.utamakan) || "" });
    if (panen.perluMasuk) return { tahan: true, perluMasuk: "abt", sebab: RELAAS_TAHAN_ABT };
    if (!panen.ok) return { ok: false, sebab: panen.sebab, bolehUlang: Boolean(panen.bolehUlang) };
    token = panen.token[butir.berkas];
    if (!token) return { ok: false, sebab: relaasSebabHilang(butir.berkas, panen) };
  } catch (galat) {
    return { ok: false, bolehUlang: true, sebab: `token blangko tidak terbaca dari ABT: ${relaasPesan(galat)}` };
  }

  // 1. Tombol "buka" di daftar perkara - ABT memeriksa hak akses di sini.
  let tinjau;
  try {
    tinjau = await relaasBacaHalaman(`${dasar}/main/cari`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: relaasBadanCari(token, butir.perkaraId),
    });
  } catch (galat) {
    return { ok: false, bolehUlang: true, sebab: `ABT tidak terjangkau saat membuka blangko: ${relaasPesan(galat)}` };
  }
  if (tinjau.masuk) return { tahan: true, perluMasuk: "abt", sebab: RELAAS_TAHAN_ABT };
  if (!tinjau.r.ok) {
    return {
      ok: false,
      bolehUlang: tinjau.r.status >= 500,
      sebab: `ABT menjawab ${tinjau.r.status} saat membuka blangko untuk perkara ini`,
    };
  }
  if (!/\/main\/view\?/i.test(String(tinjau.r.url || ""))) {
    const tolak = relaasTolakanAbt(tinjau.teks);
    if (tolak && relaasTolakanMenyeluruh(tolak)) {
      // Penolakan yang TIDAK menyebut perkara berlaku untuk seluruh isi menu
      // blangkonya - dokumen berikutnya akan ditolak dengan kalimat yang sama.
      // Putaran BERHENTI sesudah satu permintaan: menjalani semua dokumen
      // hanya mengetuk ABT puluhan kali untuk jawaban yang sama, dan juru
      // sita menunggu lama untuk nol berkas (terukur: 33 dokumen, 33 POST
      // cari, 0 berkas). Sebabnya disebut SEKALI, di penahan putaran.
      return {
        tahan: true,
        perluMasuk: "abt-akses",
        sebab:
          `ABT menolak akun yang sedang masuk untuk seluruh blangko ini: "${tolak}". Hak akses blangko ` +
          `diatur di menu ABT (abt_menu), bukan di ALETA - masuk dengan akun yang berhak atau minta ` +
          `admin ABT membuka menu ini, lalu tekan Lanjutkan.`,
      };
    }
    if (tolak) return { ok: false, sebab: `ABT menolak membuka blangko ini: ${tolak}` };
    // Tanpa kalimat penolakan ABT mengalihkan ke berandanya - token blangkonya
    // tidak lagi dikenal (kunci enkripsi peladen berganti). Dibuang, dan
    // percobaan berikutnya memanennya ulang.
    await lupakanTokenRelaas(dasar, butir.berkas);
    return {
      ok: false,
      bolehUlang: true,
      sebab: "ABT tidak membuka halaman blangko (dialihkan ke berandanya) - token blangkonya dibuang dan dipanen ulang",
    };
  }
  const alamatTinjau = String(tinjau.r.url);
  let halamanCetak = tinjau;
  // Tanpa jeda di antara langkah satu dokumen (7 Okt 2026) - lihat bagian 3.
  // 2a. Pintas: halaman langkah 1 sudah memuat tautan CETAK perkara ini; d
  //     ditulis sendiri, halaman daftar sidang tidak dibuka.
  const alamatPintas = butir.d > 0 ? relaasCetakSidangDariTinjau(tinjau.teks, dasar, butir.perkaraId, butir.d) : "";

  // 2. DoNav: memilih baris sidang di daftar sidang.
  if (butir.d > 0 && !alamatPintas) {
    try {
      halamanCetak = await relaasBacaHalaman(`${alamatTinjau}&d=${butir.d}`);
    } catch (galat) {
      return { ok: false, bolehUlang: true, sebab: `ABT tidak terjangkau saat memilih sidang: ${relaasPesan(galat)}` };
    }
    if (halamanCetak.masuk) return { tahan: true, perluMasuk: "abt", sebab: RELAAS_TAHAN_ABT };
    if (!halamanCetak.r.ok) {
      return {
        ok: false,
        bolehUlang: halamanCetak.r.status >= 500,
        sebab: `ABT menjawab ${halamanCetak.r.status} saat membuka sidang ke-${butir.d}`,
      };
    }
  }

  // 3. CETAK - tautan yang dirender ABT sendiri, bila terbaca.
  const alamat =
    alamatPintas ||
    relaasCetakDariTinjau(halamanCetak.teks, dasar, butir.perkaraId, butir.d) ||
    relaasAlamatPratinjau(
      dasar,
      { a: relaasParameter(alamatTinjau, "a"), b: relaasParameter(alamatTinjau, "b") },
      butir.perkaraId,
      butir.d
    );
  if (!alamat) return { ok: false, sebab: "alamat CETAK ABT tidak dapat disusun (token di halaman blangko kosong)" };
  let rtf;
  try {
    const r = await fetch(alamat, { credentials: "include", cache: "no-store" });
    rtf = await r.arrayBuffer();
    if (!relaasAwalRtf(rtf)) {
      const teks = new TextDecoder().decode(new Uint8Array(rtf).subarray(0, 4096));
      if (relaasHalamanMasuk(teks, r.url)) return { tahan: true, perluMasuk: "abt", sebab: RELAAS_TAHAN_ABT };
      if (!r.ok) return { ok: false, bolehUlang: r.status >= 500, sebab: `ABT menjawab ${r.status} untuk CETAK` };
      const kutip = relaasTeksPolos(teks).slice(0, 160);
      return { ok: false, sebab: `ABT tidak memulangkan RTF untuk CETAK${kutip ? `: "${kutip}"` : ""}` };
    }
  } catch (galat) {
    return { ok: false, bolehUlang: true, sebab: `ABT tidak terjangkau saat CETAK: ${relaasPesan(galat)}` };
  }

  // abtSelesaiPada: saat jawaban ABT terakhir diterima - jeda ke dokumen
  // berikutnya dihitung dari sini (lihat jalankanRelaas).
  return { ok: true, rtf, abtSelesaiPada: Date.now() };
}

/**
 * Satu dokumen: token -> buka blangko (cari) -> pilih sidang -> CETAK (RTF)
 * -> RTF disimpan. Tidak ada PDF (permintaan pengguna 6 Okt 2026: relaas
 * cukup RTF/Word).
 *
 * Tidak pernah melempar. Pulang
 *   { ok:true }                                     - RTF-nya tersimpan
 *   { ok:false, sebab, bolehUlang? }                - gagal; bolehUlang bila
 *                                                     sebabnya sesaat (5xx, putus)
 *   { tahan:true, perluMasuk, sebab }               - putaran BERHENTI SEMENTARA:
 *       sesi ABT yang habis membuat SELURUH sisa antrian gagal dengan sebab
 *       yang sama, dan lima puluh baris gagal yang sama bukan neraca,
 *       melainkan kebisingan.
 *
 * `catat(format, nama)` dipanggil SEGERA sesudah berkasnya diterima
 * peramban, dan ia menyimpan kemajuannya - pekerja yang mati sesudah RTF
 * tersimpan tidak mengunduh RTF itu lagi.
 */
async function kerjakanSatuRelaas(pekerjaan, butir, catat) {
  if (butir.unduhan && butir.unduhan.rtf) return { ok: true };
  const dasar = relaasDasarAbt(pekerjaan.asalAbt);
  const ambil = await relaasAmbilRtf(dasar, butir.berkas, butir.perkaraId, butir.d, {});
  if (!ambil.ok) return ambil;
  const rtf = ambil.rtf;
  const abtSelesaiPada = ambil.abtSelesaiPada;

  // RTF SAJA - tidak ada permintaan PDF ke ALETA (6 Okt 2026). RTF dari ABT
  // disimpan apa adanya, dicetak dari Word.
  const jalur = relaasJalurBerkas(pekerjaan, butir);
  // Deteksi sisa blangko (17 Okt 2026): putaran massal tidak dapat bertanya per dokumen (tidak ada
  // dialog di pekerja latar, dan relaas memang punya titik-titik isian tulis tangan), jadi hanya
  // dicatat dan ditampilkan di panel juru sita. Tidak pernah menahan atau menggagalkan cetak.
  const sisa = relaasPeriksaSisa(rtf);
  const u = await terbitkanUnduhan(`data:application/rtf;base64,${relaasBase64(rtf)}`, `${jalur}.rtf`);
  if (!u.ok) return { ok: false, sebab: `unduhan RTF ditolak peramban: ${u.pesan}`, abtSelesaiPada };
  await catat("rtf", `${butir.nama}.rtf`);
  return { ok: true, abtSelesaiPada, sisa };
}

/**
 * Ringkasan sisa blangko pada RTF relaas: { jumlah, ringkas:[teks], contoh:[{label, kalimat, paragraf, halaman}] }
 * atau null (bersih / tidak terbaca / pemeriksa tidak termuat). Contoh dibatasi 10 supaya keadaan pekerjaan tetap ringan.
 */
function relaasPeriksaSisa(rtf) {
  try {
    if (typeof aletaDeteksiSisa !== "object" || !aletaDeteksiSisa) return null;
    const h = aletaDeteksiSisa.periksaRtf(new TextDecoder("windows-1252").decode(new Uint8Array(rtf)));
    if (!h.temuan.length) return null;
    return {
      jumlah: h.temuan.length + h.terpotong,
      ringkas: aletaDeteksiSisa.ringkasJenis(h.temuan).map((r) => `${r.label}: ${r.jumlah}`),
      contoh: h.temuan.slice(0, 10).map((t) => ({ label: t.label, kalimat: `${t.sebelum} «${t.cocok}» ${t.sesudah}`.trim(), paragraf: t.paragraf, halaman: t.halaman })),
    };
  } catch {
    return null;
  }
}

/* ─── 8. Putaran ─────────────────────────────────────────────────────────── */

/**
 * Satu putaran, dijalankan paling banyak SATU per pekerja.
 *
 * Tiap langkahnya membaca ulang pekerjaan dari penyimpanan, bukan memegang
 * salinan lama: permintaan berhenti datang lewat pesan selagi putaran
 * berjalan. Selama putaran hidup, HANYA putaran yang menulis pekerjaannya -
 * pesan henti dan lanjut menulis hanya ketika tidak ada putaran yang hidup.
 */
async function jalankanRelaas() {
  if (pelariRelaasHidup) return;
  pelariRelaasHidup = true;
  let detak = null;
  try {
    let pekerjaan = await muatRelaas();
    if (!pekerjaan || pekerjaan.selesai || pekerjaan.tertahan) return;

    // Butir "sedang" milik pekerja yang sudah mati - dipulihkan sekali, di sini.
    if (pekerjaan.butir.some((b) => b.keadaan === "sedang")) {
      const bukti = await buktiUnduhanRelaas(pekerjaan);
      const catatan = relaasPulihkan(pekerjaan, bukti);
      pekerjaan.pemulihan = Number(pekerjaan.pemulihan || 0) + 1;
      pekerjaan.catatan.push(...catatan.map((c) => `pekerja latar hidup lagi: ${c}`));
      await simpanRelaas(pekerjaan);
    }

    for (;;) {
      pekerjaan = await muatRelaas();
      if (!pekerjaan || pekerjaan.selesai || pekerjaan.tertahan) return;
      if (await dimintaBerhenti(pekerjaan.id)) {
        tutupDenganHenti(pekerjaan);
        await simpanRelaas(pekerjaan);
        return;
      }
      const butir = relaasButirBerikutnya(pekerjaan);
      if (!butir) {
        pekerjaan.selesai = true;
        pekerjaan.selesaiPada = Date.now();
        await simpanRelaas(pekerjaan);
        return;
      }

      // Jeda yang tersimpan dihormati SESUDAH pekerja hidup lagi: tidak
      // diulang dari awal (itu memperpanjangnya) dan tidak dilewati (itu
      // menjadikan jarak dua pratinjau nol). Tidurnya dipotong-potong supaya
      // tiap potongannya menyentuh penyimpanan - itulah detak yang membuat
      // pekerjanya tidak dianggap menganggur.
      let berhenti = false;
      while (Date.now() < Number(pekerjaan.waktuBerikut || 0)) {
        await tidurRelaas(Math.min(RELAAS_DETAK_MS, Number(pekerjaan.waktuBerikut) - Date.now()));
        if (await dimintaBerhenti(pekerjaan.id)) {
          berhenti = true;
          break;
        }
      }
      if (berhenti) continue;

      // SEBELUM dikerjakan.
      if (!butir.unduhan || typeof butir.unduhan !== "object") butir.unduhan = { rtf: "" };
      butir.keadaan = "sedang";
      butir.percobaan = Number(butir.percobaan || 0) + 1;
      butir.mulaiPada = Date.now();
      if (!butir.mulaiPertama) butir.mulaiPertama = butir.mulaiPada;
      await simpanRelaas(pekerjaan);

      detak = setInterval(() => {
        try {
          gudangRelaas()
            .get(KUNCI_RELAAS_HENTI)
            .catch((galat) => console.warn("ALETA relaas massal: detak penyimpanan gagal", galat));
        } catch (galat) {
          console.warn("ALETA relaas massal: detak penyimpanan gagal", galat);
        }
      }, RELAAS_DETAK_MS);
      const catat = async (format, nama) => {
        butir.unduhan[format] = nama;
        await simpanRelaas(pekerjaan);
      };
      const hasil = await kerjakanSatuRelaas(pekerjaan, butir, catat);
      clearInterval(detak);
      detak = null;

      if (hasil.tahan) {
        // Berhenti sementara: butir ini kembali menunggu, dan percobaannya
        // tidak dihitung - sesi yang habis bukan kesalahan dokumennya.
        butir.keadaan = "menunggu";
        butir.percobaan = Math.max(0, butir.percobaan - 1);
        butir.sebab = hasil.sebab;
        pekerjaan.tertahan = { sebab: hasil.sebab, perluMasuk: hasil.perluMasuk || "", pada: Date.now() };
        await simpanRelaas(pekerjaan);
        return;
      }

      // SESUDAH dikerjakan - beserta jeda berikutnya, yang ikut disimpan.
      if (!hasil.ok && hasil.bolehUlang && butir.percobaan < RELAAS_BATAS_PERCOBAAN) {
        butir.keadaan = "menunggu";
        butir.sebab = `diulang sesudah percobaan ke-${butir.percobaan}: ${hasil.sebab}`;
        pekerjaan.catatan.push(`${butir.nomorPerkara || butir.kunci}: ${butir.sebab}`);
      } else if (hasil.ok) {
        butir.keadaan = "selesai";
        butir.sebab = hasil.sebab || "";
        butir.selesaiPada = Date.now();
        if (hasil.sisa) butir.sisaBlangko = hasil.sisa;
      } else {
        butir.keadaan = "gagal";
        butir.sebab = hasil.bolehUlang
          ? `gagal sesudah ${butir.percobaan} percobaan: ${hasil.sebab || "sebabnya tidak terbaca"}`
          : hasil.sebab || "sebabnya tidak terbaca";
        butir.selesaiPada = Date.now();
      }
      butir.hasil = relaasHasilButir(butir);
      // Jeda dihitung sejak jawaban ABT terakhir dokumen ini (7 Okt 2026):
      // menunggu konfirmasi unduhan peramban tidak membebani ABT, jadi waktu
      // itu sudah termasuk jedanya. Tidak pernah sebelum jawaban itu.
      const dasarJeda = Math.min(Date.now(), Number(hasil.abtSelesaiPada) || Date.now());
      pekerjaan.waktuBerikut = dasarJeda + relaasJedaDokumen();
      await simpanRelaas(pekerjaan);
    }
  } catch (galat) {
    // Kemajuan yang tidak dapat disimpan menghentikan putaran - melanjutkan
    // tanpa menyimpan berarti mencetak ganda sesudah pekerja berikutnya mati.
    // Sebabnya dicatat pada pekerjaan bila penyimpanannya masih dapat ditulis.
    try {
      const p = await muatRelaas();
      if (p && !p.selesai) {
        p.tertahan = { sebab: `putaran berhenti: ${relaasPesan(galat)}`, perluMasuk: "", pada: Date.now() };
        await simpanRelaas(p);
      }
    } catch (galatKedua) {
      console.error("ALETA relaas massal: putaran berhenti dan sebabnya tidak dapat disimpan", galat, galatKedua);
    }
  } finally {
    if (detak) clearInterval(detak);
    pelariRelaasHidup = false;
  }
}

/** Dipanggil tiap pekerja hidup dan tiap halaman bertanya: melanjutkan putaran yang ditinggal pekerja yang mati. */
async function lanjutkanRelaasBilaPerlu() {
  const p = await muatRelaas();
  if (p && !p.selesai && !p.tertahan && !pelariRelaasHidup) void jalankanRelaas();
  return p;
}

/**
 * Asal portal dan alamat ABT dari pesan jembatan - DIPERIKSA, bukan dipercaya.
 *
 * aleta.js menghitung keduanya sendiri dari location.origin (kontrak K3).
 * Di sini diperiksa sekali lagi terhadap halaman PENGIRIMNYA: ABT harus seasal
 * dengan portal, dan portal harus asal tab yang mengirim pesannya. Pekerja
 * ini mengambil halaman ABT dengan kuki petugas; alamat yang dapat disetir
 * halaman lain tidak boleh sampai ke fetch-nya.
 */
function relaasSaringAsal(pesanAsal, pesanAsalAbt, pengirim) {
  const asal = relaasAsalPortal(pesanAsal);
  const dasar = relaasDasarAbt(pesanAsalAbt);
  if (!asal || !dasar) return { sebab: "alamat ABT atau portal tidak terkirim" };
  if (!dasar.toLowerCase().startsWith(`${asal.toLowerCase()}/`)) {
    return { sebab: `alamat ABT (${dasar}) tidak seasal dengan portal (${asal}) - ditolak` };
  }
  const dariPengirim =
    (pengirim && typeof pengirim.origin === "string" && /^https?:\/\//i.test(pengirim.origin) && pengirim.origin) ||
    ((String((pengirim && pengirim.url) || "").match(/^https?:\/\/[^/?#]+/i) || [""])[0]);
  if (dariPengirim && dariPengirim.toLowerCase() !== asal.toLowerCase()) {
    return { sebab: `pesan dari ${dariPengirim} membawa asal ${asal} - ditolak` };
  }
  return { asal, dasar };
}

/** Pintu pesan halaman. Pulang jawaban yang dikirim balik; melempar hanya pada galat tak terduga. */
async function layaniRelaas(pesan, pengirim) {
  if (pesan.jenis === "relaas-panen") {
    const saring = relaasSaringAsal(pesan.asal, pesan.asalAbt, pengirim);
    if (saring.sebab) return { ok: false, sebab: saring.sebab };
    const berkas = Array.isArray(pesan.berkas) ? pesan.berkas.map(String) : [];
    const hasil = await panenTokenRelaas(saring.dasar, berkas, { paksa: Boolean(pesan.paksa) });
    // Token TIDAK dikirim ke halaman: halaman cukup tahu mana yang ada.
    return {
      ok: hasil.ok,
      perluMasuk: Boolean(hasil.perluMasuk),
      sebab: hasil.sebab || "",
      ada: hasil.ok ? Object.keys(hasil.token) : [],
      kelompok: hasil.ok ? Object.fromEntries(Object.entries(hasil.token).map(([n, t]) => [n, t.kelompok || ""])) : {},
      hilang: hasil.ok ? hasil.hilang : [],
      kelompokDibaca: hasil.kelompokDibaca || 0,
      kelompokGagal: hasil.kelompokGagal || [],
      dariSimpanan: Boolean(hasil.dariSimpanan),
      paksaDiabaikan: hasil.paksaDiabaikan || "",
      jedaRataMs: RELAAS_JEDA_RATA_MS,
      kerjaRataMs: RELAAS_KERJA_RATA_MS,
    };
  }

  // ==========================================================================
  // relaas-rtf - SATU blangko ABT untuk SATU perkara, RTF-nya dipulangkan
  // (perbaikan 6 Okt 2026, butir 17: edoc penetapan PMH/PHS dari panel SIPP).
  // Jalan yang sama dengan cetak relaas massal (relaasAmbilRtf): hak akses
  // ABT diperiksa ABT sendiri. Tidak mengunduh apa pun, tidak menulis apa
  // pun - RTF dipulangkan ke panel, yang mengirimkannya ke ALETA.
  // ==========================================================================
  if (pesan.jenis === "relaas-rtf") {
    const saring = relaasSaringAsal(pesan.asal, pesan.asalAbt, pengirim);
    if (saring.sebab) return { ok: false, sebab: saring.sebab };
    const berkas = String(pesan.berkas || "");
    const perkaraId = String(pesan.perkaraId || "").trim();
    if (!berkas || berkas.length > 200 || /[\\/]/.test(berkas)) return { ok: false, sebab: "nama blangko tidak sah" };
    if (!/^\d+$/.test(perkaraId) || /^0+$/.test(perkaraId)) return { ok: false, sebab: "perkara tidak dikenali" };
    const ambil = await relaasAmbilRtf(saring.dasar, berkas, perkaraId, 0, {
      utamakan: String(pesan.utamakan || "").slice(0, 120),
    });
    if (!ambil.ok) {
      return { ok: false, perluMasuk: Boolean(ambil.tahan), sebab: ambil.sebab || "blangko tidak tercetak" };
    }
    return { ok: true, rtfBase64: relaasBase64(ambil.rtf), ukuran: ambil.rtf.byteLength };
  }

  if (pesan.jenis === "relaas-perkiraan") {
    return { ok: true, ...relaasPerkiraanMs(pesan.jumlah), jedaRataMs: RELAAS_JEDA_RATA_MS };
  }

  if (pesan.jenis === "relaas-mulai") {
    // DIPERIKSA DAN DIPASANG SEBELUM await PERTAMA - bagian fungsi ini sampai
    // await berjalan tanpa jeda, jadi pesan kedua yang datang selagi yang
    // pertama memanen blangko pasti melihat penandanya. Tanpa ini keduanya
    // lolos pemeriksaan "ada putaran belum selesai" (pekerjaan baru disimpan
    // SESUDAH panen), keduanya dijawab ok:true, dan yang tersimpan terakhir
    // menimpa - dokumen tab pertama tidak pernah dicetak.
    if (mulaiRelaasDisiapkan) {
      return {
        ok: false,
        menyiapkan: true,
        sebab:
          "Putaran lain sedang disiapkan (membaca blangko dari ABT) - tunggu sampai putarannya tampil, " +
          "jangan tekan Cetak lagi.",
      };
    }
    mulaiRelaasDisiapkan = { pada: Date.now() };
    try {
      return await mulaiRelaas(pesan, pengirim);
    } finally {
      mulaiRelaasDisiapkan = null;
    }
  }

  if (pesan.jenis === "relaas-keadaan") {
    const pekerjaan = await lanjutkanRelaasBilaPerlu();
    return {
      ok: true,
      pekerjaan,
      ringkas: relaasRingkas(pekerjaan),
      berjalan: pelariRelaasHidup,
      menyiapkan: Boolean(mulaiRelaasDisiapkan),
      sekarang: Date.now(),
      perkiraanSisa: pekerjaan ? relaasPerkiraanMs(relaasRingkas(pekerjaan).menunggu) : null,
    };
  }

  return layaniRelaasTindakan(pesan);
}

/**
 * Relaas-mulai yang sesungguhnya - dipanggil HANYA lewat layaniRelaas, di
 * bawah penanda mulaiRelaasDisiapkan.
 */
async function mulaiRelaas(pesan, pengirim) {
  const ada = await muatRelaas();
  if (ada && !ada.selesai) {
    return {
      ok: false,
      sebab: ada.tertahan
        ? "Putaran sebelumnya tertahan. Lanjutkan atau hentikan dahulu sebelum memulai yang baru."
        : "Masih ada putaran yang berjalan. Tunggu sampai selesai, atau hentikan dahulu.",
      pekerjaan: ada,
      ringkas: relaasRingkas(ada),
    };
  }
  const masukan = pesan.pekerjaan || {};
  // Jembatan K3 menyisipkan asal ke dalam pekerjaan DAN ke tingkat atas
  // pesan; yang di dalam pekerjaan didahulukan, keduanya tetap diperiksa.
  const saring = relaasSaringAsal(masukan.asal || pesan.asal, masukan.asalAbt || pesan.asalAbt, pengirim);
  if (saring.sebab) return { ok: false, sebab: saring.sebab };
  const pekerjaan = relaasBuatPekerjaan({ ...masukan, asal: saring.asal, asalAbt: saring.dasar });

  // Token seluruh blangkonya dipastikan SEBELUM putaran dicatat: blangko yang
  // tidak ada di ABT ini dilewati di depan dengan sebabnya, bukan gagal satu
  // per satu di tengah putaran.
  const berkas = [...new Set(pekerjaan.butir.map((b) => b.berkas))];
  if (berkas.length > 0) {
    const panen = await panenTokenRelaas(pekerjaan.asalAbt, berkas, {});
    if (panen.perluMasuk) return { ok: false, perluMasuk: true, sebab: panen.sebab };
    if (!panen.ok) return { ok: false, sebab: panen.sebab };
    const hilang = new Set(panen.hilang);
    if (hilang.size > 0) {
      const tetap = [];
      for (const b of pekerjaan.butir) {
        if (hilang.has(b.berkas)) {
          pekerjaan.dilewati.push({
            kunci: b.kunci,
            nomorPerkara: b.nomorPerkara,
            label: b.label,
            sebab: relaasSebabHilang(b.berkas, panen),
          });
        } else {
          tetap.push(b);
        }
      }
      pekerjaan.butir = tetap;
      if (tetap.length === 0) {
        pekerjaan.selesai = true;
        pekerjaan.selesaiPada = Date.now();
      }
    }
  }
  await gudangRelaas().remove(KUNCI_RELAAS_HENTI);
  await simpanRelaas(pekerjaan);
  void jalankanRelaas();
  return { ok: true, pekerjaan, ringkas: relaasRingkas(pekerjaan), perkiraan: relaasPerkiraanMs(pekerjaan.butir.length) };
}

/** Henti, lanjut, bersihkan - dan jawaban untuk jenis yang tidak dikenal. */
async function layaniRelaasTindakan(pesan) {
  if (pesan.jenis === "relaas-henti") {
    const pekerjaan = await muatRelaas();
    if (!pekerjaan || pekerjaan.selesai) return { ok: true, pekerjaan };
    await gudangRelaas().set({ [KUNCI_RELAAS_HENTI]: { id: pekerjaan.id, pada: Date.now() } });
    // Tanpa putaran yang hidup (tertahan, atau pekerjanya baru saja mati),
    // tidak ada yang akan membaca penanda itu - jadi ditutup di sini.
    if (!pelariRelaasHidup) {
      tutupDenganHenti(pekerjaan);
      await simpanRelaas(pekerjaan);
    }
    return { ok: true, pekerjaan };
  }

  if (pesan.jenis === "relaas-lanjut") {
    const pekerjaan = await muatRelaas();
    if (!pekerjaan || pekerjaan.selesai) return { ok: false, sebab: "tidak ada putaran yang dapat dilanjutkan", pekerjaan };
    // HANYA putaran yang tertahan yang ditulis di sini. Putaran yang sedang
    // hidup menulis pekerjaannya sendiri tiap butir; salinan yang dibaca di
    // atas bisa sudah basi sedetik kemudian, dan menimpakannya berarti
    // kemajuan hilang - dan dokumen yang sudah tercetak dicetak lagi.
    if (pekerjaan.tertahan && !pelariRelaasHidup) {
      pekerjaan.tertahan = null;
      await simpanRelaas(pekerjaan);
    }
    if (!pelariRelaasHidup) void jalankanRelaas();
    return { ok: true, pekerjaan };
  }

  if (pesan.jenis === "relaas-bersihkan") {
    const pekerjaan = await muatRelaas();
    if (pekerjaan && !pekerjaan.selesai) {
      return { ok: false, sebab: "Putaran belum selesai - hentikan dahulu sebelum neracanya dibersihkan.", pekerjaan };
    }
    await gudangRelaas().remove([KUNCI_RELAAS, KUNCI_RELAAS_HENTI]);
    return { ok: true, pekerjaan: null };
  }

  return { ok: false, sebab: `pesan relaas tidak dikenal: ${pesan.jenis}` };
}

// ============================================================================
// PEKERJA HIDUP LAGI: PUTARAN RELAAS YANG DITINGGALKAN DILANJUTKAN
// ============================================================================
//
// Baris ini berjalan tiap kali Chrome menghidupkan pekerjanya - oleh peristiwa
// apa pun, termasuk pesan panel yang menanyakan kemajuan. Putaran yang tercatat
// belum selesai dan tidak tertahan dilanjutkan dari butir yang belum selesai;
// butir yang tertinggal "sedang" diputuskan lewat riwayat unduhan, bukan
// diulang begitu saja. Diletakkan di KAKI berkas: seluruh konstanta di atas
// harus sudah terisi sebelum putaran menyentuhnya.
lanjutkanRelaasBilaPerlu().catch((galat) => {
  // Tidak ada tempat lain untuk menuliskannya: penyimpanannya sendiri yang
  // gagal dibaca. Panel yang bertanya berikutnya menerima sebab yang sama.
  console.error("ALETA relaas massal: putaran tidak dapat dilanjutkan", galat);
});

// ============================================================================
// ANGKA TUGAS DI IKON EKSTENSI (ide popup-6, tahap 3 rencana "ekstensi dulu")
// ============================================================================
//
// Widget checklist (checklist.js) menulis ringkasan kecil ke penyimpanan -
// angkaChecklist: { belum, lewat, hariIni, sambungan, pada } - dan di sinilah
// angka itu dipasang di ikon ALETA pada bilah Chrome, supaya tugas yang
// terlambat terlihat dari halaman mana pun walau widgetnya diciutkan.
//
// Lewat penyimpanan, bukan pesan: pekerja ini mati tiap ±30 detik dan tidak
// mengingat apa pun (lihat catatan MV3); penyimpanan ada saat ia bangun lagi.
//
// Syaratnya diperiksa DI SINI juga, bukan hanya dipercaya dari widget:
// tampilan Baru / UI Baru, saklar popup-6, ALETA aktif, dan checklist
// menyala. Kembali ke tampilan Lama, mematikan saklarnya, atau mematikan
// checklist menghapus angkanya seketika - tidak ada angka yatim di ikon.
// Angka yang tidak diperbarui 12 jam (tidak ada tab SIPP/ABT/portal yang
// terbuka) juga dihapus: angka basi lebih menyesatkan daripada tanpa angka.
const ANGKA_IKON_KUNCI = ["angkaChecklist", "ujiTampilan", "ujiFitur", "tampilanServer", "aktif", "checklistMilestone"];
const ANGKA_IKON_BASI_MS = 12 * 60 * 60 * 1000;

/**
 * Tampilan yang berlaku - aturan sama dengan alatUjiBerlaku di panel-alat.js:
 * uji lokal Super Admin, lalu yang diterapkan admin (tahap 5), lalu Lama.
 * Dipakai angka ikon (popup-6) dan sinkron tanda (popup-7) di bawah.
 */
function tampilanBerlakuLatar(s) {
  // Profil peran (perbaikan 30 Sep butir 25, K4): pegawai yang bukan Super
  // Admin/Admin hanya mendapat fitur ide yang ada di profil perannya - aturan
  // yang sama dengan alatFiturNyala (panel-alat.js) dan fiturPopupNyala.
  // Profil tanpa daftar fitur (null) tidak menyaring apa pun. Ditulis DI
  // DALAM fungsi ini: uji tampilan-server memotong fungsi ini sendirian.
  const saringProfil = (berlaku) => {
    const sv = s && s.tampilanServer;
    const p = sv && typeof sv === "object" ? sv.profil : null;
    if (!p || typeof p !== "object" || p.bolehUbahProfil === true) return berlaku;
    if (!p.fitur || typeof p.fitur !== "object") return berlaku;
    const fitur = {};
    for (const [k, v] of Object.entries(berlaku.fitur || {})) if (v === true && p.fitur[k] === true) fitur[k] = true;
    return { mode: berlaku.mode, fitur };
  };
  const mode = ["baru", "ui"].includes(s.ujiTampilan) ? s.ujiTampilan : "lama";
  if (mode !== "lama") return saringProfil({ mode, fitur: s.ujiFitur && typeof s.ujiFitur === "object" ? s.ujiFitur : {} });
  const sv = s.tampilanServer;
  if (sv && typeof sv === "object" && sv.diterapkan === true && (sv.mode === "baru" || sv.mode === "ui")) {
    return saringProfil({ mode: sv.mode, fitur: sv.fitur && typeof sv.fitur === "object" ? sv.fitur : {} });
  }
  return { mode: "lama", fitur: {} };
}

/** { teks, warna } untuk ikon, atau null bila tidak ada angka yang boleh tampil. */
function angkaIkonDari(simpan) {
  const s = simpan && typeof simpan === "object" ? simpan : {};
  // Tampilan uji lokal ATAU yang diterapkan admin (tahap 5) - tampilanBerlakuLatar.
  const berlaku = tampilanBerlakuLatar(s);
  if (berlaku.mode === "lama") return null;
  if (berlaku.fitur["popup-6"] !== true) return null;
  if (s.aktif === false || s.checklistMilestone !== true) return null;
  const a = s.angkaChecklist && typeof s.angkaChecklist === "object" ? s.angkaChecklist : null;
  if (!a) return null;
  const belum = Math.floor(Number(a.belum));
  if (!Number.isFinite(belum) || belum <= 0) return null;
  if (!(Date.now() - Number(a.pada || 0) < ANGKA_IKON_BASI_MS)) return null;
  return { teks: belum > 99 ? "99+" : String(belum), warna: Number(a.lewat) > 0 ? "#c62828" : "#b45309" };
}

async function angkaIkonPerbarui() {
  let simpan = {};
  try {
    simpan = await chrome.storage.local.get(ANGKA_IKON_KUNCI);
  } catch {
    return; // penyimpanan tidak terbaca - ikon dibiarkan seperti adanya
  }
  const a = angkaIkonDari(simpan);
  try {
    await chrome.action.setBadgeText({ text: a ? a.teks : "" });
    if (a) await chrome.action.setBadgeBackgroundColor({ color: a.warna });
  } catch {
    /* ikon hanya kemudahan - tidak ada yang bergantung padanya */
  }
}

try {
  chrome.storage.onChanged.addListener((ubah, wilayah) => {
    if (wilayah !== "local" || !ubah) return;
    if (ANGKA_IKON_KUNCI.some((k) => k in ubah)) void angkaIkonPerbarui();
  });
} catch {
  /* tanpa pendengar, angkanya diperbarui saat pekerja bangun berikutnya */
}
void angkaIkonPerbarui();

// ============================================================================
// SINKRON TANDA SELESAI / TUNDA KE SERVER (ide popup-7, tahap 5)
// ============================================================================
//
// Tahap 3 menyimpan tanda Selesai/Tunda di peramban saja (keputusan pengguna:
// "peramban dulu"). Tahap 5 menyediakan setelan pribadi di server
// (GET/PUT /aleta/api/aleta-ecourt/ekstensi/setelan, kunci "checklist.tanda"),
// sehingga tanda ikut ke PC lain tempat pegawai yang sama masuk.
//
// Dikerjakan DI SINI, bukan di widget: widget hidup di tiap tab SIPP, ABT, dan
// portal sekaligus, dan tiga tab yang menulis setelan yang sama bersamaan
// hanya menghasilkan 409 beruntun. Pekerja latar satu untuk seluruh peramban.
//
// Penggabungan tiga arah dengan ingatan kecil "sinkronTandaMeta" (daftar id
// yang terakhir disepakati): butir yang HILANG di satu sisi sesudah
// kesepakatan terakhir berarti dihapus di sisi itu (petugas menekan
// "kembalikan"), bukan butir baru di sisi lain - tanpa ingatan itu butir yang
// dikembalikan akan hidup lagi dari PC sebelah. Butir yang ada di kedua sisi:
// yang ditandai paling akhir menang.
//
// Hanya berjalan bila popup-7 berlaku (tampilan Baru / UI Baru, uji lokal
// ATAU diterapkan admin). Setelan pribadi bukan tindakan keluar: tidak
// menyentuh SIPP, ABT, maupun WhatsApp, jadi mode coba tidak menahannya.
const SINKRON_TANDA_KUNCI = ["tandaChecklist", "asalPortal", "ujiTampilan", "ujiFitur", "tampilanServer", "aktif", "sinkronTandaMeta", "modeLatihan"];
const SINKRON_TANDA_SETELAN = "checklist.tanda";
const SINKRON_TANDA_TARIK_MS = 10 * 60 * 1000;
let sinkronTandaAntrean = Promise.resolve();
let sinkronTandaPewaktu = 0;
let sinkronTandaMenulisLokal = false;


function tandaKeServer(lokal) {
  const hasil = {};
  for (const [id, t] of Object.entries(lokal || {})) {
    if (!t || (t.tanda !== "selesai" && t.tanda !== "tunda")) continue;
    hasil[id] = {
      keadaan: t.tanda,
      sampai: t.tanda === "tunda" && t.sampai ? new Date(Number(t.sampai)).toISOString() : null,
      pada: new Date(Number(t.pada) || Date.now()).toISOString(),
    };
  }
  return hasil;
}

function tandaDariServer(id, t, lokalLama) {
  const lama = lokalLama || {};
  return {
    ...lama,
    tanda: t.keadaan === "tunda" ? "tunda" : "selesai",
    pada: Date.parse(t.pada) || Date.now(),
    ...(t.keadaan === "tunda" && t.sampai ? { sampai: Date.parse(t.sampai) } : {}),
  };
}

/** Penggabungan tiga arah; pulang { lokal, berubahLokal }. */
function gabungTanda(lokal, server, meta) {
  const disepakati = new Set(Array.isArray(meta && meta.ids) ? meta.ids : []);
  const hasil = {};
  const semua = new Set([...Object.keys(lokal), ...Object.keys(server)]);
  for (const id of semua) {
    const l = lokal[id];
    const s = server[id];
    if (l && s) {
      const pl = Number(l.pada) || 0;
      const ps = Date.parse(s.pada) || 0;
      hasil[id] = ps > pl ? tandaDariServer(id, s, l) : l;
    } else if (l) {
      // Ada di sini saja: dihapus di server sesudah kesepakatan, atau baru di sini.
      if (!disepakati.has(id)) hasil[id] = l;
    } else if (s) {
      if (!disepakati.has(id)) hasil[id] = tandaDariServer(id, s, null);
    }
  }
  const berubahLokal = JSON.stringify(hasil) !== JSON.stringify(lokal);
  return { lokal: hasil, berubahLokal };
}

async function sinkronTandaSekali(alasan) {
  let s;
  try {
    s = await chrome.storage.local.get(SINKRON_TANDA_KUNCI);
  } catch {
    return;
  }
  if (s.aktif === false) return;
  // Mode latihan (Super Admin/Admin, tahap 7): tidak ada yang ditulis ke
  // server - termasuk setelan pribadi. Tanda tetap di peramban.
  if (s.modeLatihan === true) return;
  const b = tampilanBerlakuLatar(s);
  if (b.mode === "lama" || b.fitur["popup-7"] !== true) return;
  const asal = (await asalPortalHidup(s.asalPortal)).replace(/\/+$/, "");
  if (!/^https?:\/\//.test(asal)) return;
  const alamat = `${asal}/api/aleta-ecourt/ekstensi/setelan`;

  for (let coba = 0; coba < 2; coba += 1) {
    let jawab;
    try {
      jawab = await fetch(alamat, { credentials: "include", cache: "no-store" });
    } catch {
      return; // server tidak terjangkau - tanda tetap di peramban
    }
    if (!jawab.ok) return; // 401 belum masuk, 404 portal lama: diam
    let setelan;
    try {
      const isi = await jawab.json();
      setelan = ((isi && isi.data) || isi || {}).setelan || {};
    } catch {
      return;
    }
    const baris = setelan[SINKRON_TANDA_SETELAN] || null;
    const server = baris && baris.nilai && typeof baris.nilai === "object" ? baris.nilai : {};
    const lokal = s.tandaChecklist && typeof s.tandaChecklist === "object" ? s.tandaChecklist : {};
    const g = gabungTanda(lokal, server, s.sinkronTandaMeta);

    if (g.berubahLokal) {
      sinkronTandaMenulisLokal = true;
      try {
        await chrome.storage.local.set({ tandaChecklist: g.lokal });
      } catch {
        /* dicoba lagi pada sinkron berikutnya */
      } finally {
        setTimeout(() => {
          sinkronTandaMenulisLokal = false;
        }, 500);
      }
    }
    const kirim = tandaKeServer(g.lokal);
    const samaDenganServer = JSON.stringify(Object.keys(kirim).sort()) === JSON.stringify(Object.keys(server).sort()) &&
      Object.keys(kirim).every((id) => server[id] && server[id].keadaan === kirim[id].keadaan && (server[id].sampai || null) === kirim[id].sampai);
    if (!samaDenganServer) {
      let tulis;
      try {
        tulis = await fetch(alamat, {
          method: "PUT",
          credentials: "include",
          cache: "no-store",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            kunci: SINKRON_TANDA_SETELAN,
            nilai: Object.keys(kirim).length ? kirim : null,
            jikaDiubahPada: baris ? String(baris.diubahPada || "") : "",
          }),
        });
      } catch {
        return;
      }
      if (tulis.status === 409 && coba === 0) {
        // PC lain menulis di antara baca dan tulis: baca ulang, gabung lagi.
        try {
          s = await chrome.storage.local.get(SINKRON_TANDA_KUNCI);
        } catch {
          return;
        }
        continue;
      }
      if (!tulis.ok) return;
    }
    try {
      await chrome.storage.local.set({ sinkronTandaMeta: { ids: Object.keys(g.lokal), pada: Date.now(), alasan: String(alasan || "") } });
      await chrome.storage.session.set({ sinkronTandaTarikPada: Date.now() });
    } catch {
      /* ingatan kesepakatan hilang: penggabungan berikutnya lebih pemaaf, tidak salah */
    }
    return;
  }
}

function sinkronTandaJadwalkan(alasan, jedaMs) {
  if (sinkronTandaPewaktu) clearTimeout(sinkronTandaPewaktu);
  sinkronTandaPewaktu = setTimeout(() => {
    sinkronTandaPewaktu = 0;
    sinkronTandaAntrean = sinkronTandaAntrean.then(() => sinkronTandaSekali(alasan)).catch(() => {});
  }, jedaMs);
}

async function sinkronTandaBilaLama() {
  try {
    const sesi = await chrome.storage.session.get(["sinkronTandaTarikPada"]);
    if (Date.now() - Number(sesi.sinkronTandaTarikPada || 0) < SINKRON_TANDA_TARIK_MS) return;
  } catch {
    /* tanpa ingatan sesi: tarik saja */
  }
  sinkronTandaJadwalkan("berkala", 1000);
}

try {
  chrome.storage.onChanged.addListener((ubah, wilayah) => {
    if (wilayah !== "local" || !ubah) return;
    if ("tandaChecklist" in ubah && !sinkronTandaMenulisLokal) sinkronTandaJadwalkan("tanda berubah", 2000);
    // Widget menulis angkaChecklist tiap menyegarkan diri: kesempatan menarik
    // tanda dari PC lain, paling sering sekali per sepuluh menit.
    else if ("angkaChecklist" in ubah || "tampilanServer" in ubah) void sinkronTandaBilaLama();
  });
} catch {
  /* tanpa pendengar, tanda tetap di peramban ini */
}
void sinkronTandaBilaLama();

/*
 * ============================================================================
 * MASUK SIPP & ABT OTOMATIS - TITIPAN PASSWORD HANYA DI chrome.storage.session
 * ============================================================================
 *
 * Rencana 6 Okt 2026 malam (D:/aleta-dev/kerja/masuk-satu-akun-sipp/RENCANA.md),
 * dibangun 7 Okt 2026. Petugas masuk ALETA dengan akun SIPP-nya; bila password
 * SIPP-lah yang terbukti cocok, layar masuk portal menitipkan username +
 * password itu ke sini (lewat jembatan aleta.js). Saat SIPP atau ABT
 * menampilkan halaman masuknya (sesi habis), panel-alat.js meminta titipan itu,
 * mengisi blangko masuknya, dan mengirimnya.
 *
 * DI MANA PASSWORD-NYA HIDUP: chrome.storage.session SAJA - memori Chrome,
 * hilang ketika Chrome ditutup atau ekstensi dimuat ulang. TIDAK PERNAH jatuh
 * ke chrome.storage.local (cakram), tidak ke portal, tidak ke basis data. Bila
 * storage.session tidak ada, titipan DITOLAK - bukan disimpan di tempat lain.
 * Variabel modul juga tidak dipakai: pekerja MV3 ini mati tiap ±30 detik
 * menganggur dan seluruh variabelnya hilang.
 *
 * YANG BOLEH MEMINTA (pengirim diperiksa di sini, bukan dipercaya):
 *   - masuk-titip / masuk-lupakan : halaman portal ALETA (jalur /aleta/...)
 *   - masuk-minta / masuk-gagal   : halaman SIPP (/SIPP/..., /index.php/...
 *     setempat) atau ABT (/aps_badilag/...) pada ASAL YANG SAMA dengan portal
 *     yang menitipkannya, dan jenis halamannya harus sesuai permintaannya.
 *
 * TIDAK BERPUTAR: satu kali isi per jenis halaman per menit, dan halaman masuk
 * yang memperlihatkan penolakan (password sudah diganti di SIPP) menahan isi
 * otomatis untuk jenis itu sampai petugas masuk ALETA lagi. SIPP tidak
 * mengunci akun karena salah password, tetapi mengirim password basi
 * berulang-ulang tetap tidak boleh terjadi.
 */
const KUNCI_MASUK_TITIPAN = "aletaMasukSipp";
const KUNCI_MASUK_COBA = "aletaMasukSippCoba";
/* === MASUK-SESI-SIPP 11 Okt === */
// Masuk otomatis dari SIPP ke ALETA (panel SIPP yang menerima 401 meminta
// portal membuktikan sesi SIPP lewat bot). Keluar ALETA dengan SENGAJA
// (masuk-lupakan dari portal) menahan percobaan OTOMATIS sampai petugas masuk
// ALETA lagi, menekan "Masuk dengan akun SIPP ini" sendiri, atau Chrome
// ditutup - tanpa ini, orang yang keluar untuk berganti akun langsung
// dimasukkan kembali. Hanya tanda waktu; tidak ada username atau password.
const KUNCI_MASUK_SESI_TAHAN = "aletaMasukSesiSippTahan";
/* === AKHIR MASUK-SESI-SIPP === */
/** Titipan kedaluwarsa sendiri sesudah satu hari kerja, walau Chrome tetap terbuka. */
const MASUK_BERLAKU_MS = 12 * 60 * 60 * 1000;
/** Jarak paling dekat antara dua isi otomatis untuk jenis halaman yang sama. */
const MASUK_JEDA_MS = 60 * 1000;

function masukPenyimpanan() {
  // SENGAJA tanpa cadangan chrome.storage.local - lihat kepala bagian ini.
  return (chrome.storage && chrome.storage.session) || null;
}

function masukUrai(alamat) {
  try {
    return new URL(String(alamat || ""));
  } catch {
    return null;
  }
}

/** Asal portal bila pengirimnya halaman portal ALETA; "" bila bukan. */
function masukAsalPortal(alamat) {
  const u = masukUrai(alamat);
  if (!u || (u.protocol !== "http:" && u.protocol !== "https:")) return "";
  return /^\/aleta(\/|$)/.test(u.pathname) ? u.origin : "";
}

/** "sipp" | "abt" | "" menurut alamat halaman pengirim. */
function masukJenisHalaman(alamat) {
  const u = masukUrai(alamat);
  if (!u || (u.protocol !== "http:" && u.protocol !== "https:")) return "";
  if (/^\/aps_badilag(\/|$)/i.test(u.pathname)) return "abt";
  if (/^\/SIPP(\/|$)/i.test(u.pathname)) return "sipp";
  // SIPP setempat (XAMPP) dilayani di akar: http://127.0.0.1/index.php/...
  if ((u.hostname === "127.0.0.1" || u.hostname === "localhost") && /^\/index\.php(\/|$)/.test(u.pathname)) return "sipp";
  return "";
}

function masukPengirimSah(pengirim) {
  if (!pengirim || typeof pengirim !== "object") return false;
  // Hanya skrip konten ekstensi ini sendiri, di bingkai teratas.
  let idSaya = "";
  try {
    idSaya = String((chrome.runtime && chrome.runtime.id) || "");
  } catch {
    idSaya = "";
  }
  if (idSaya && pengirim.id && pengirim.id !== idSaya) return false;
  if (typeof pengirim.frameId === "number" && pengirim.frameId !== 0) return false;
  return true;
}

function masukTeks(nilai, batas) {
  if (typeof nilai !== "string") return "";
  // Aksara kendali tidak pernah ada dalam username/password yang sah.
  if (/[\u0000-\u001f\u007f]/.test(nilai)) return "";
  return nilai.length > batas ? "" : nilai;
}

async function layaniMasuk(pesan, pengirim) {
  const gudang = masukPenyimpanan();
  if (!gudang) return { ok: false, sebab: "chrome.storage.session tidak tersedia; titipan tidak disimpan di tempat lain" };
  if (!masukPengirimSah(pengirim)) return { ok: false, sebab: "pengirim tidak dikenal" };
  const alamat = pengirim.url || (pengirim.tab && pengirim.tab.url) || "";

  if (pesan.jenis === "masuk-titip" || pesan.jenis === "masuk-lupakan") {
    const asal = masukAsalPortal(alamat);
    if (!asal) return { ok: false, sebab: "hanya halaman portal ALETA yang boleh menitipkan" };
    if (pesan.jenis === "masuk-lupakan") {
      await gudang.remove([KUNCI_MASUK_TITIPAN, KUNCI_MASUK_COBA]);
      await gudang.set({ [KUNCI_MASUK_SESI_TAHAN]: { pada: Date.now() } }); // MASUK-SESI-SIPP 11 Okt
      return { ok: true };
    }
    const username = masukTeks(pesan.username, 60).trim();
    const sandi = masukTeks(pesan.sandi, 200);
    if (!username || !sandi) return { ok: false, sebab: "username atau password tidak sah" };
    await gudang.set({ [KUNCI_MASUK_TITIPAN]: { username, sandi, asal, dititipPada: Date.now() } });
    // Titipan baru = penahanan lama dicabut (password mungkin baru diganti).
    await gudang.remove([KUNCI_MASUK_COBA, KUNCI_MASUK_SESI_TAHAN]);
    return { ok: true };
  }

  /* === MASUK-SESI-SIPP 11 Okt === */
  if (pesan.jenis === "masuk-sesi-boleh" || pesan.jenis === "masuk-sesi-lepas") {
    if (masukJenisHalaman(alamat) !== "sipp") return { ok: false, sebab: "bukan halaman SIPP yang dikenal" };
    if (pesan.jenis === "masuk-sesi-lepas") {
      await gudang.remove(KUNCI_MASUK_SESI_TAHAN);
      return { ok: true, boleh: true };
    }
    const isiTahan = await gudang.get(KUNCI_MASUK_SESI_TAHAN);
    return { ok: true, boleh: !isiTahan[KUNCI_MASUK_SESI_TAHAN] };
  }
  /* === AKHIR MASUK-SESI-SIPP === */

  // masuk-minta / masuk-gagal: dari halaman masuk SIPP atau ABT.
  const jenisHalaman = masukJenisHalaman(alamat);
  if (!jenisHalaman || jenisHalaman !== pesan.halaman) return { ok: false, sebab: "bukan halaman SIPP/ABT yang dikenal" };
  const asalHalaman = (masukUrai(alamat) || {}).origin || "";

  const isi = await gudang.get([KUNCI_MASUK_TITIPAN, KUNCI_MASUK_COBA]);
  const titipan = isi[KUNCI_MASUK_TITIPAN];
  const coba = (isi[KUNCI_MASUK_COBA] && typeof isi[KUNCI_MASUK_COBA] === "object" ? isi[KUNCI_MASUK_COBA] : {}) || {};
  const kini = Date.now();

  if (pesan.jenis === "masuk-gagal") {
    coba[jenisHalaman] = { ...(coba[jenisHalaman] || {}), ditahan: true, pada: kini };
    await gudang.set({ [KUNCI_MASUK_COBA]: coba });
    return { ok: true };
  }

  if (!titipan || typeof titipan !== "object") return { ok: false, sebab: "belum ada titipan" };
  if (kini - Number(titipan.dititipPada || 0) > MASUK_BERLAKU_MS) {
    await gudang.remove([KUNCI_MASUK_TITIPAN, KUNCI_MASUK_COBA]);
    return { ok: false, sebab: "titipan kedaluwarsa" };
  }
  if (titipan.asal !== asalHalaman) return { ok: false, sebab: "asal halaman berbeda dengan portal penitip" };
  const terakhir = coba[jenisHalaman] || {};
  if (terakhir.ditahan) return { ok: false, sebab: "ditahan sesudah penolakan" };
  if (kini - Number(terakhir.pada || 0) < MASUK_JEDA_MS) return { ok: false, sebab: "jeda" };

  // Dicatat SEBELUM dijawab: pekerja yang mati sesudah menjawab tidak boleh
  // membuat isi otomatis berikutnya lolos dari jeda.
  coba[jenisHalaman] = { pada: kini, ditahan: false };
  await gudang.set({ [KUNCI_MASUK_COBA]: coba });
  return { ok: true, username: titipan.username, sandi: titipan.sandi };
}

/**
 * Dipanggil dari pendengar pesan utama (di atas) - SATU pendengar untuk
 * seluruh pesan panel, seperti yang diandalkan uji pekerja latar.
 */
function layaniPesanMasuk(pesan, pengirim, jawab) {
  layaniMasuk(pesan, pengirim).then(jawab, (e) =>
    // Sebabnya tanpa isi pesan - pesannya dapat memuat password.
    jawab({ ok: false, sebab: String((e && e.message) || "tidak diketahui").slice(0, 160) })
  );
}

/* === POPUP-PERAN 12 Okt === */
/*
 * ============================================================================
 * SETELAN PER AKUN + PEMBARUAN OTOMATIS SESUDAH MASUK ALETA (12 Okt 2026)
 * ============================================================================
 *
 * 1. Salinan setelan per akun+golongan (lihat popup.js, "POPUP PER AKUN +
 *    GOLONGAN"): tiap perubahan kunci setelan pribadi - dari panel di tab mana
 *    pun, dari popup, dari widget - disalin ke "pengaturanAkun:<kunci>" milik
 *    akun yang sedang masuk, meski popup tertutup. KUNCI_SETELAN_AKUN SAMA
 *    dengan popup.js (dijaga uji).
 *
 * 2. Sesudah masuk ALETA, ekstensi memeriksa versi yang disajikan portal dan
 *    MENYIAPKAN pembaruannya di belakang layar. Yang MUNGKIN tergantung cara
 *    ekstensi terpasang (chrome.management.getSelf().installType):
 *
 *      "development" (Load unpacked, dari folder):
 *          Chrome mengabaikan update_url, dan ekstensi TIDAK dapat menimpa
 *          berkasnya sendiri. Yang dapat dikerjakan: mengunduh paket ZIP
 *          terbaru dari portal ke folder Unduhan (ALETA/aleta-ekstensi-sipp-
 *          <versi>.zip), sekali per versi. Mengekstraknya ke folder ekstensi
 *          dan menekan "muat ulang ekstensi" tetap dilakukan orangnya.
 *      selain itu (CRX lewat kebijakan / update_url):
 *          requestUpdateCheck membuat Chrome mengunduh dan menyiapkan versi
 *          baru sendiri (onUpdateAvailable); dipasang saat "Perbaharui"
 *          ditekan (reload) - tidak pernah dimuat ulang otomatis, sebab
 *          petugas mungkin sedang di tengah pekerjaan.
 *
 *    Hasilnya dicatat di "pembaruanOtomatis" yang dibaca popup untuk
 *    pemberitahuan "Versi baru X tersedia - Perbaharui". Satu pemeriksaan
 *    paling sering per 30 menit.
 */
const KUNCI_IDENTITAS_LATAR = "identitasPopup";
const KUNCI_PERALIHAN_LATAR = "identitasPeralihan";
const KUNCI_MENUNGGU_LATAR = "identitasMenunggu";
const AWALAN_AKUN_LATAR = "pengaturanAkun:";
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
  "blangkoDerryIsiOto",
  "sippPenyatu",
  "sippTampilDobel",
  "widgetKehadiran",
  "widgetDrafH7",
  "pratinjauBasRelaas",
  "gembokKepalaAbt",
  "panelRingkas",
  "gembokKepalaSipp",
  "gembokKepalaAleta",
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
  "ideL2PutusanEcourt",
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
const KUNCI_PEMBARUAN_OTOMATIS = "pembaruanOtomatis";
const JEDA_PERIKSA_MASUK_MS = 30 * 60 * 1000;
const BATAS_WAKTU_PERIKSA_MS = 6000;

async function catatSalinanAkunLatar() {
  try {
    const s = await chrome.storage.local.get([KUNCI_IDENTITAS_LATAR, KUNCI_PERALIHAN_LATAR, KUNCI_MENUNGGU_LATAR, ...KUNCI_SETELAN_AKUN]);
    const a = s && s[KUNCI_IDENTITAS_LATAR];
    if (!a || !a.kunci || s[KUNCI_PERALIHAN_LATAR] === true || s[KUNCI_MENUNGGU_LATAR]) return;
    const k = AWALAN_AKUN_LATAR + a.kunci;
    const r = ((await chrome.storage.local.get([k])) || {})[k] || {};
    const nilai = {};
    for (const x of KUNCI_SETELAN_AKUN) if (s[x] !== undefined) nilai[x] = s[x];
    await chrome.storage.local.set({ [k]: { ...r, nilai, diubahPada: new Date().toISOString() } });
  } catch {
    /* salinan menyusul pada perubahan berikutnya */
  }
}

try {
  chrome.storage.onChanged.addListener((ubah, tempat) => {
    if (tempat !== "local" || !ubah) return;
    if (KUNCI_SETELAN_AKUN.some((k) => ubah[k])) void catatSalinanAkunLatar();
    // Halaman portal ALETA mencatat "sesiPortalMasuk" tiap panelnya terpasang (sudah masuk).
    if (ubah.sesiPortalMasuk) void periksaSesudahMasuk({}).catch(() => {});
  });
} catch {
  /* tanpa pendengar perubahan: salinan dicatat popup saat dibuka */
}

/** "development" bila dimuat sebagai folder (Load unpacked); kosong bila tidak terbaca. */
async function jenisPemasangan() {
  try {
    if (chrome.management && typeof chrome.management.getSelf === "function") {
      const d = await chrome.management.getSelf();
      return String((d && d.installType) || "");
    }
  } catch {
    /* tanpa izin/dukungan: diperlakukan tidak diketahui */
  }
  return "";
}

function kePembaruanBase64(buf) {
  const bita = new Uint8Array(buf);
  let teks = "";
  for (let i = 0; i < bita.length; i += 0x8000) teks += String.fromCharCode.apply(null, bita.subarray(i, i + 0x8000));
  return btoa(teks);
}

/** Mengunduh paket ZIP ekstensi terbaru ke Unduhan/ALETA. Pulang { ok, id, nama } atau { ok:false, pesan }. */
async function unduhPaketTerbaru(asal, versi) {
  const nama = `ALETA/aleta-ekstensi-sipp-${String(versi).replace(/[^0-9A-Za-z.\-]/g, "_")}.zip`;
  const pembatal = typeof AbortController !== "undefined" ? new AbortController() : null;
  const henti = pembatal ? setTimeout(() => pembatal.abort(), 30000) : 0;
  try {
    const r = await fetch(`${asal}/api/aleta-ecourt/ekstensi`, {
      credentials: "include",
      cache: "no-store",
      ...(pembatal ? { signal: pembatal.signal } : {}),
    });
    if (!r.ok) return { ok: false, pesan: `portal menjawab ${r.status}` };
    const buf = await r.arrayBuffer();
    // Lewat data: dan antrean nama yang sama dengan unduhan panel - unduhan
    // http langsung dari ekstensi dapat diblokir Chrome ("insecure download").
    const hasil = await terbitkanUnduhan(`data:application/zip;base64,${kePembaruanBase64(buf)}`, nama);
    return hasil && hasil.ok ? { ok: true, id: hasil.id, nama } : { ok: false, pesan: (hasil && hasil.pesan) || "unduhan ditolak" };
  } catch (e) {
    return { ok: false, pesan: String((e && e.message) || e).slice(0, 160) };
  } finally {
    if (henti) clearTimeout(henti);
  }
}

/**
 * Memeriksa sesi ALETA, versi yang disajikan, dan menyiapkan pembaruan.
 * opsi.paksa: abaikan jeda 30 menit; opsi.unduh: paket ZIP DIUNDUH sekarang
 * (jalan manual "Perbaharui") walau sudah pernah.
 */
let periksaBerjalan = null;
async function periksaSesudahMasuk(opsi) {
  // Pekerja yang bangun, pesan portal, dan popup dapat tiba serempak: satu
  // pemeriksaan berjalan sekali (tidak ada unduhan ganda); yang meminta paksa
  // menunggu yang berjalan lalu memeriksa lagi.
  if (periksaBerjalan) {
    await periksaBerjalan.catch(() => {});
    if (!(opsi && (opsi.paksa || opsi.unduh))) return { ok: true, keadaan: "dilewati" };
  }
  const p = periksaSesudahMasukInti(opsi);
  periksaBerjalan = p;
  try {
    return await p;
  } finally {
    if (periksaBerjalan === p) periksaBerjalan = null;
  }
}

/**
 * Alamat portal yang dipakai pekerja latar (K1, 19 Okt 2026): port 8008 bila
 * terjangkau, cadangan port 80 - lihat alamat-portal.js. Asal yang bukan
 * alamat bawaan satker dipakai apa adanya.
 */
async function asalPortalHidup(asalTersimpan) {
  const asal = String(asalTersimpan || "");
  try {
    if (typeof AletaAlamatPortal !== "undefined") return String(await AletaAlamatPortal.pilihAsal(asal));
  } catch {
    /* pemilih tidak tersedia: alamat tersimpan */
  }
  return asal;
}

async function periksaSesudahMasukInti(opsi) {
  const paksa = Boolean(opsi && (opsi.paksa || opsi.unduh));
  let s;
  try {
    s = await chrome.storage.local.get(["asalPortal", KUNCI_PEMBARUAN_OTOMATIS, KUNCI_IDENTITAS_LATAR]);
  } catch {
    return { ok: false, keadaan: "penyimpanan" };
  }
  const asal = await asalPortalHidup(s && s.asalPortal);
  if (!asal) return { ok: false, keadaan: "tanpa-portal" };
  const catatan = s[KUNCI_PEMBARUAN_OTOMATIS] && typeof s[KUNCI_PEMBARUAN_OTOMATIS] === "object" ? { ...s[KUNCI_PEMBARUAN_OTOMATIS] } : {};
  const kini = Date.now();
  if (!paksa && kini - Number(catatan.periksaPada || 0) < JEDA_PERIKSA_MASUK_MS) return { ok: true, keadaan: "dilewati" };
  // Dicatat SEBELUM bertanya: pekerja yang bangun serempak tidak memeriksa dua kali.
  catatan.periksaPada = kini;
  await chrome.storage.local.set({ [KUNCI_PEMBARUAN_OTOMATIS]: catatan });

  let data = null;
  const pembatal = typeof AbortController !== "undefined" ? new AbortController() : null;
  const henti = pembatal ? setTimeout(() => pembatal.abort(), BATAS_WAKTU_PERIKSA_MS) : 0;
  try {
    const r = await fetch(`${asal}/api/aleta-ecourt/ekstensi?info=siapa`, {
      credentials: "include",
      cache: "no-store",
      ...(pembatal ? { signal: pembatal.signal } : {}),
    });
    if (!r.ok) return { ok: false, keadaan: r.status === 401 || r.status === 403 ? "belum-masuk" : "portal" };
    const isi = await r.json();
    data = isi && isi.data ? isi.data : isi;
  } catch {
    return { ok: false, keadaan: "portal" };
  } finally {
    if (henti) clearTimeout(henti);
  }
  const pengguna = (data && data.pengguna) || {};
  if (!pengguna.nama) return { ok: false, keadaan: "belum-masuk" };

  // Akun/golongan berganti sejak terakhir: salinan akun lama dikunci (tidak
  // lagi diperbarui), dan popup yang menukar setelannya saat dibuka
  // (golongan dihitung di sana).
  const kode = pengguna.golongan && pengguna.golongan.kode ? String(pengguna.golongan.kode) : "";
  const orang = String(pengguna.kunci || "").trim();
  if (orang && kode) {
    const kunciBaru = `${orang}|${kode}`;
    const aktif = s[KUNCI_IDENTITAS_LATAR];
    if (aktif && aktif.kunci && aktif.kunci !== kunciBaru) {
      try {
        await chrome.storage.local.set({ [KUNCI_MENUNGGU_LATAR]: kunciBaru, [KUNCI_PERALIHAN_LATAR]: true });
      } catch {
        /* popup tetap menyelaraskan saat dibuka */
      }
    }
  }

  const terpasang = String(chrome.runtime.getManifest().version || "");
  const versiPortal = String((data && data.versi) || "");
  catatan.versiPortal = versiPortal;
  catatan.masuk = true;
  if (!versiPortal || bandingkanVersi(versiPortal, terpasang) <= 0) {
    await chrome.storage.local.set({ [KUNCI_PEMBARUAN_OTOMATIS]: catatan });
    return { ok: true, keadaan: "terbaru", versiPortal };
  }

  const tipe = await jenisPemasangan();
  let hasil = { ok: true, keadaan: "versi-baru", versiPortal, tipe };
  if (tipe === "development") {
    const sudah = catatan.diunduh && catatan.diunduh.versi === versiPortal && catatan.diunduh.id;
    if (!sudah) {
      const u = await unduhPaketTerbaru(asal, versiPortal);
      if (u.ok) {
        catatan.diunduh = { versi: versiPortal, id: u.id, nama: u.nama, pada: kini };
        hasil = { ok: true, keadaan: "paket-diunduh", versiPortal, tipe, id: u.id, nama: u.nama };
      } else hasil = { ok: false, keadaan: "unduh-gagal", versiPortal, tipe, pesan: u.pesan };
    } else hasil = { ok: true, keadaan: "paket-diunduh", versiPortal, tipe, id: catatan.diunduh.id, nama: catatan.diunduh.nama };
  } else if (chrome.runtime && typeof chrome.runtime.requestUpdateCheck === "function") {
    try {
      const r = await chrome.runtime.requestUpdateCheck();
      if (r && r.status === "update_available") {
        catatan.menunggu = String(r.version || versiPortal);
        hasil = { ok: true, keadaan: "menunggu-pasang", versiPortal, tipe, versiBaru: catatan.menunggu };
      }
    } catch {
      /* Chrome tidak melayani - popup tetap menyebut versi baru dari portal */
    }
  }
  await chrome.storage.local.set({ [KUNCI_PEMBARUAN_OTOMATIS]: catatan });
  return hasil;
}

/** Jalan manual pada pemasangan folder: unduh paketnya, lalu jelaskan langkah sisanya. */
async function siapkanPaketManual(versiSekarang) {
  const h = await periksaSesudahMasuk({ unduh: true });
  if (h.keadaan === "paket-diunduh") {
    return {
      ok: false,
      keadaan: "paket_diunduh",
      versiSekarang,
      versiBaru: h.versiPortal,
      idUnduhan: h.id,
      namaBerkas: h.nama,
      pesan:
        `Versi ${h.versiPortal} sudah diunduh ke folder Unduhan (${String(h.nama).replace(/\//g, "\\")}). ` +
        "Ekstensi yang dimuat sebagai folder tidak dapat mengganti berkasnya sendiri: ekstrak ZIP itu ke folder ekstensi " +
        "(timpa semua berkas), lalu tekan muat ulang ekstensi.",
    };
  }
  if (h.keadaan === "unduh-gagal") {
    return {
      ok: false,
      keadaan: "unduh_gagal",
      versiSekarang,
      pesan: `Paket versi ${h.versiPortal} gagal diunduh (${h.pesan || "tidak diketahui"}). Coba lagi, atau unduh dari halaman Ekstensi di portal.`,
    };
  }
  return null;
}

// Sesudah masuk ALETA: tiap pekerja bangun / peramban dibuka / ekstensi baru terpasang.
try {
  if (chrome.runtime.onStartup) chrome.runtime.onStartup.addListener(() => void periksaSesudahMasuk({}));
  if (chrome.runtime.onInstalled) chrome.runtime.onInstalled.addListener(() => void periksaSesudahMasuk({ paksa: true }));
} catch {
  /* tanpa pendengar siklus hidup: pesan dari halaman portal/popup tetap memicu */
}
void periksaSesudahMasuk({}).catch(() => {});
/* === AKHIR POPUP-PERAN === */
