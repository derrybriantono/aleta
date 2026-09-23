"use strict";

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
chrome.runtime.onUpdateAvailable.addListener((rincian) => {
  versiMenunggu = String((rincian && rincian.version) || "");
});

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
async function perbaruiSekarang() {
  const versiSekarang = String(chrome.runtime.getManifest().version || "");

  // Sudah pernah diunduh Chrome dan tinggal dipasang - tidak perlu bertanya
  // lagi ke portal.
  if (versiMenunggu) {
    muatUlangSebentarLagi();
    return {
      ok: true,
      keadaan: "dipasang",
      versiSekarang,
      versiBaru: versiMenunggu,
      pesan: `Versi ${versiMenunggu} sudah diunduh Chrome dan sedang dipasang. Muat ulang halaman ini sebentar lagi.`,
    };
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

chrome.runtime.onMessage.addListener((pesan, _pengirim, jawab) => {
  if (!pesan || pesan.sumber !== "aleta-panel") return undefined;

  if (pesan.jenis === "perbarui") {
    // Sengaja dibungkus: penolakan yang tidak tertangkap membuat panel
    // menunggu jawaban yang tidak pernah datang, dan tombolnya mati selamanya.
    perbaruiSekarang()
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

  if (pesan.jenis === "muat-ulang") {
    muatUlangSebentarLagi();
    jawab({
      ok: true,
      keadaan: "dimuat_ulang",
      pesan: "Ekstensi sedang dimuat ulang dari berkasnya. Muat ulang halaman ini sebentar lagi.",
    });
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

  if (pesan.jenis === "unduh") {
    // Dipotong pada BATANGNYA, bukan dari belakang: memotong nama utuh
    // membuang akhiran ".rtf" atau ".pdf"-nya, dan berkas tanpa akhiran tidak
    // dapat dibuka dengan dua ketukan.
    const nama = potongNamaBerkas(
      String(pesan.nama || "berkas").replace(/[\\/:*?"<>|]+/g, "_"),
      180
    );
    antrikanNama(nama);
    const alamat = String(pesan.alamat || "");
    if (!alamat.startsWith("data:")) {
      jawab({ ok: false, pesan: "alamat unduhan bukan data: - ditolak" });
      return true;
    }
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
    return true; // jawaban menyusul
  }

  if (pesan.jenis === "keadaan-pembaruan") {
    jawab({
      ok: true,
      versiSekarang: String(chrome.runtime.getManifest().version || ""),
      versiMenunggu,
    });
    return true;
  }

  return undefined;
});
