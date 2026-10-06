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
async function perbaruiSekarang(opsi) {
  const paksa = Boolean(opsi && opsi.paksa);
  const versiSekarang = String(chrome.runtime.getManifest().version || "");

  // Sudah pernah diunduh Chrome dan tinggal dipasang - tidak perlu bertanya
  // lagi ke portal.
  if (versiMenunggu) {
    const cegah = paksa ? null : await relaasPenghalangMuatUlang();
    if (cegah) return relaasTahanMuatUlang(cegah, versiSekarang, versiMenunggu);
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
    const cegah = paksa ? null : await relaasPenghalangMuatUlang();
    if (cegah) {
      return relaasTahanMuatUlang(cegah, versiSekarang, String((hasil && hasil.version) || ""));
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

chrome.runtime.onMessage.addListener((pesan, pengirim, jawab) => {
  if (!pesan || pesan.sumber !== "aleta-panel") return undefined;

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

  if (pesan.jenis === "muat-ulang") {
    (pesan.paksa === true ? Promise.resolve(null) : relaasPenghalangMuatUlang())
      .then((cegah) => {
        if (cegah) return relaasTahanMuatUlang(cegah, "", "");
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
          pesan: `Keadaan putaran cetak relaas tidak terbaca, jadi ekstensi TIDAK dimuat ulang: ${String((e && e.message) || e).slice(0, 240)}`,
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

  if (pesan.jenis === "unduh") {
    // Dipotong pada BATANGNYA, bukan dari belakang: memotong nama utuh
    // membuang akhiran ".rtf" atau ".pdf"-nya, dan berkas tanpa akhiran tidak
    // dapat dibuka dengan dua ketukan.
    const nama = potongNamaBerkas(
      String(pesan.nama || "berkas").replace(/[\\/:*?"<>|]+/g, "_"),
      180
    );
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
    jawab({
      ok: true,
      versiSekarang: String(chrome.runtime.getManifest().version || ""),
      versiMenunggu,
    });
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
 * Pekerja inilah yang mengambil RTF dari ABT, meminta PDF ke ALETA, dan
 * menyimpan berkasnya ke folder unduhan - tanpa membuka satu tab ABT pun di
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
 *      jadi ABT pun tidak menampilkan daftar sidangnya).
 *   3. GET  abt/preview?c=&e=&b=&a=&d=  - tombol CETAK, diambil dari halaman
 *      view yang dirender ABT, bentuknya persis.
 *
 * Di antara langkah itu dan di antara dokumen ada jarak pendek untuk BEBAN
 * peladen ABT (lihat bagian 3) - bukan penyamaran. Keputusan 25 September
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
 * ("sedang"), SESUDAH TIAP BERKAS tersimpan (unduhan.rtf / unduhan.pdf), dan
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
 * hanya mencetak: RTF dan PDF turun ke folder unduhan
 *   ALETA relaas <tanggal>/<juru sita>/<nomor perkara> - <keterangan>.rtf|.pdf
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
/** Rute PDF yang SAMA dengan putusan massal (ALETA_API_PDF di abt.js). */
const RELAAS_API_PDF = "/aleta/api/aleta-bot/abt/pdf";
/**
 * "Siapa saya" portal - ditanyakan HANYA sesudah rute PDF menjawab 401, supaya
 * kalimat "Sesi ALETA habis" dikatakan hanya bila ALETA memang tidak mengenali
 * sesinya (perbaikan 30 Sep sore, agen J). Pembacaan saja.
 */
const RELAAS_API_SIAPA = "/aleta/api/aleta-ecourt/ekstensi/siapa";
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
const RELAAS_GOLONGAN = ["sidang-pertama", "sidang-ditunda", "sidang-lanjutan", "ikrar-talak", "pemberitahuan-putusan"];

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

/** Memetakan nama katalog ke token pada satu daftar berkas; yang pertama cocok menang. */
function relaasPetakanToken(diminta, daftarBerkas) {
  const token = {};
  const hilang = [];
  for (const nama of diminta || []) {
    const cocok = (daftarBerkas || []).find((b) => relaasCocokTepat(nama, b.berkas));
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
 *   ANTAR DOKUMEN        acak 2-5 detik (RELAAS_JEDA_MIN_MS..MAKS_MS), tanpa
 *                        jeda panjang.
 *   DI DALAM SATU        0,5-1,5 detik di antara buka (cari) -> daftar sidang
 *   DOKUMEN, DAN SAAT    (view) -> CETAK, dan di antara halaman kelompok
 *   MEMANEN BLANGKO      ketika token blangko dipanen.
 *
 * Acaknya hanya supaya beberapa juru sita yang mencetak bersamaan tidak
 * mengetuk peladen pada detik yang sama. Keputusan 25 September 2026: jarak
 * ini TIDAK meniru pola kerja manusia dan tidak dimaksudkan menyembunyikan
 * ALETA dari catatan ABT atau SIPP - profil lama (rata-rata ±49 detik dengan
 * jeda panjang sesekali) sudah dibuang.
 *
 * `acak` disuntikkan supaya uji dapat memakai deret tetap.
 */
const RELAAS_JEDA_MIN_MS = 2000;
const RELAAS_JEDA_MAKS_MS = 5000;
const RELAAS_JEDA_LANGKAH_MIN_MS = 500;
const RELAAS_JEDA_LANGKAH_MAKS_MS = 1500;
/** Rata-rata jeda antar dokumen - sebarannya seragam, jadi titik tengahnya. */
const RELAAS_JEDA_RATA_MS = Math.round((RELAAS_JEDA_MIN_MS + RELAAS_JEDA_MAKS_MS) / 2);
/**
 * Kira-kira lamanya satu dokumen dikerjakan: tiga permintaan ABT, dua jarak
 * langkah di dalamnya (rata-rata 1 detik), PDF dari bot, unduhan.
 */
const RELAAS_KERJA_RATA_MS = 6000;

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

/** Jeda antar dokumen: 2-5 detik, untuk beban peladen ABT. */
function relaasJedaDokumen(acak) {
  return relaasJedaSeragam(acak, RELAAS_JEDA_MIN_MS, RELAAS_JEDA_MAKS_MS);
}

/**
 * Jarak di antara langkah satu dokumen (cari -> view -> CETAK) dan di antara
 * halaman kelompok saat memanen blangko: 0,5-1,5 detik.
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
 * Cara RTF diunduh: "selalu" (bawaan - "RTF + PDF diunduh"), "bila-pdf-gagal",
 * atau "tidak".
 *
 * Bentuk lama `rtfBilaPdfGagal` diterjemahkan MENURUT NAMANYA, seperti mesin
 * sebelumnya memakainya: true = RTF hanya sebagai ganti PDF yang gagal
 * ("bila-pdf-gagal"), false = tidak pernah. Tanpa keduanya: "selalu".
 */
function relaasCaraRtf(p) {
  const cara = String((p && p.unduhRtf) || "");
  if (cara === "selalu" || cara === "bila-pdf-gagal" || cara === "tidak") return cara;
  if (p && p.rtfBilaPdfGagal === true) return "bila-pdf-gagal";
  if (p && p.rtfBilaPdfGagal === false) return "tidak";
  return "selalu";
}

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
      unduhan: { rtf: "", pdf: "" },
      tanpaPdf: false,
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
    opsi: { unduhRtf: relaasCaraRtf(p) },
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

/** Apakah seluruh berkas yang diminta untuk satu butir sudah tersimpan. */
function relaasBerkasLengkap(pekerjaan, butir) {
  const u = (butir && butir.unduhan) || {};
  if (!u.pdf) return false;
  return (pekerjaan && pekerjaan.opsi && pekerjaan.opsi.unduhRtf) !== "selalu" || Boolean(u.rtf);
}

/** Nama berkas yang sudah tersimpan untuk satu butir, untuk neraca. */
function relaasHasilButir(butir) {
  const u = (butir && butir.unduhan) || {};
  return [u.pdf, u.rtf].filter(Boolean).join(", ");
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
    if (!b.unduhan || typeof b.unduhan !== "object") b.unduhan = { rtf: "", pdf: "" };
    const ada = peta[b.kunci] || {};
    const ditemukan = [];
    for (const format of ["pdf", "rtf"]) {
      if (!b.unduhan[format] && ada[format] && ada[format].nama) {
        b.unduhan[format] = ada[format].nama;
        ditemukan.push(format.toUpperCase());
      }
    }
    const tambahan = ditemukan.length ? ` (${ditemukan.join(" dan ")} ditemukan di riwayat unduhan, tidak diunduh ulang)` : "";
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
  const hitung = { menunggu: 0, sedang: 0, selesai: 0, gagal: 0, dilewati: 0, tanpaPdf: 0 };
  if (!pekerjaan) return hitung;
  for (const b of pekerjaan.butir || []) {
    hitung[b.keadaan] = (hitung[b.keadaan] || 0) + 1;
    if (b.keadaan === "selesai" && b.tanpaPdf) hitung.tanpaPdf += 1;
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
  return `(^|[\\\\/])${bagian.join("[\\\\/]")}( \\(\\d+\\))?\\.(pdf|rtf)$`;
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
 * sebabnya. Butir yang sudah separuh tersimpan (RTF-nya ada, PDF-nya belum)
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

async function bacaTokenTersimpan(dasarAbt) {
  const isi = await chrome.storage.local.get(KUNCI_TOKEN_RELAAS);
  const s = isi && isi[KUNCI_TOKEN_RELAAS];
  if (!s || s.asal !== dasarAbt || Date.now() - Number(s.pada || 0) > RELAAS_UMUR_TOKEN_MS) return {};
  return { ...(s.token || {}) };
}

async function simpanTokenTersimpan(dasarAbt, token) {
  await chrome.storage.local.set({ [KUNCI_TOKEN_RELAAS]: { asal: dasarAbt, pada: Date.now(), token } });
}

async function lupakanTokenRelaas(dasarAbt, nama) {
  const token = await bacaTokenTersimpan(dasarAbt);
  delete token[nama];
  await simpanTokenTersimpan(dasarAbt, token);
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
  const peta = await bacaTokenTersimpan(dasar);
  if (opsi && opsi.paksa) for (const n of nama) delete peta[n];
  let kurang = nama.filter((n) => !peta[n]);
  const pilih = () => Object.fromEntries(nama.filter((n) => peta[n]).map((n) => [n, peta[n]]));
  if (kurang.length === 0) {
    return { ok: true, token: pilih(), hilang: [], kelompokDibaca: 0, kelompokGagal: [], dariSimpanan: true };
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
    for (const [n, t] of Object.entries(token)) peta[n] = { ...t, kelompok: t.kelompok || k.kelompok };
    kurang = nama.filter((n) => !peta[n]);
    if (kurang.length === 0) break;
  }
  await simpanTokenTersimpan(dasar, peta);
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
        const format = /\.pdf$/i.test(namaBerkas) ? "pdf" : /\.rtf$/i.test(namaBerkas) ? "rtf" : "";
        if (format && !peta[format]) peta[format] = { nama: namaBerkas, pada: Date.parse(x.startTime || "") || 0 };
      }
      if (peta.pdf || peta.rtf) bukti[b.kunci] = peta;
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
const RELAAS_TAHAN_SESI_HABIS = "Sesi ALETA habis - masuk ke portal ALETA lagi, lalu tekan Lanjutkan.";

/**
 * Kalimat untuk 401 dari rute PDF - JUJUR tentang apa yang diketahui.
 *
 * 401 berarti ALETA tidak melihat sesi pada permintaan PEKERJA INI. Itu belum
 * tentu "sesi habis": tangkapan layar 30 Sep sore menunjukkan putaran tertahan
 * "Sesi ALETA habis" sementara tab portal ALETA masih masuk. Karena itu rute
 * "siapa saya" ditanyakan sekali (GET, tanpa efek), dari pekerja yang sama:
 *   401          -> sesi memang tidak dikenali: "Sesi ALETA habis".
 *   200          -> sesi dikenali, yang ditolak hanya permintaan PDF itu.
 *   lainnya/gagal-> tidak dapat dipastikan; dikatakan apa adanya.
 * perluMasuk tetap "aleta" pada ketiganya - putarannya tertahan dan Lanjutkan
 * mencobanya lagi.
 */
async function relaasSebabTolakSesi(asal) {
  let status = 0;
  try {
    const r = await fetch(`${asal}${RELAAS_API_SIAPA}`, { credentials: "include", cache: "no-store" });
    status = Number(r.status) || 0;
  } catch {
    status = 0;
  }
  if (status === 401) return RELAAS_TAHAN_SESI_HABIS;
  if (status >= 200 && status < 300) {
    return (
      "ALETA menolak membuat PDF (401) padahal sesi ALETA Anda masih dikenali - tekan Lanjutkan untuk mencoba lagi; " +
      "bila tertahan lagi, keluar lalu masuk lagi di portal ALETA."
    );
  }
  return (
    `ALETA menolak membuat PDF karena sesi tidak dikenali (401); sesi tidak dapat diperiksa ulang` +
    `${status ? ` (ALETA menjawab ${status})` : " (ALETA tidak terjangkau)"} - masuk ke portal ALETA lagi, lalu tekan Lanjutkan.`
  );
}

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

  // 2. DoNav: memilih baris sidang di daftar sidang.
  if (butir.d > 0) {
    await tidurRelaas(relaasJedaLangkah());
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
  await tidurRelaas(relaasJedaLangkah());
  const alamat =
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

  return { ok: true, rtf };
}

/**
 * Satu dokumen: token -> buka blangko (cari) -> pilih sidang -> CETAK (RTF)
 * -> RTF disimpan -> PDF dari ALETA -> PDF disimpan.
 *
 * Tidak pernah melempar. Pulang
 *   { ok:true, tanpaPdf?, sebab? }                  - berkasnya tersimpan
 *   { ok:false, sebab, bolehUlang? }                - gagal; bolehUlang bila
 *                                                     sebabnya sesaat (5xx, putus)
 *   { tahan:true, perluMasuk, sebab }               - putaran BERHENTI SEMENTARA:
 *       sesi ABT atau ALETA yang habis membuat SELURUH sisa antrian gagal
 *       dengan sebab yang sama, dan lima puluh baris gagal yang sama bukan
 *       neraca, melainkan kebisingan.
 *
 * `catat(format, nama)` dipanggil SEGERA sesudah tiap berkas diterima
 * peramban, dan ia menyimpan kemajuannya - pekerja yang mati sesudah RTF
 * tersimpan tidak mengunduh RTF itu lagi.
 */
async function kerjakanSatuRelaas(pekerjaan, butir, catat) {
  const dasar = relaasDasarAbt(pekerjaan.asalAbt);
  const ambil = await relaasAmbilRtf(dasar, butir.berkas, butir.perkaraId, butir.d, {});
  if (!ambil.ok) return ambil;
  const rtf = ambil.rtf;

  const jalur = relaasJalurBerkas(pekerjaan, butir);
  const caraRtf = (pekerjaan.opsi && pekerjaan.opsi.unduhRtf) || "selalu";
  const unduhRtf = async () => {
    const u = await terbitkanUnduhan(`data:application/rtf;base64,${relaasBase64(rtf)}`, `${jalur}.rtf`);
    if (!u.ok) return `RTF ditolak peramban: ${u.pesan}`;
    await catat("rtf", `${butir.nama}.rtf`);
    return "";
  };
  if (caraRtf === "selalu" && !butir.unduhan.rtf) {
    const tolak = await unduhRtf();
    if (tolak) return { ok: false, sebab: `unduhan ${tolak}` };
  }
  if (butir.unduhan.pdf) return { ok: true };

  let pdfBase64 = "";
  let pdfGagal = "";
  try {
    const r = await fetch(`${pekerjaan.asal}${RELAAS_API_PDF}`, {
      method: "POST",
      credentials: "include",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rtfBase64: relaasBase64(rtf) }),
    });
    if (r.status === 401) {
      return { tahan: true, perluMasuk: "aleta", sebab: await relaasSebabTolakSesi(pekerjaan.asal) };
    }
    if (r.status === 403) pdfGagal = "peran Anda tidak diberi kewenangan blangko-abt di ALETA";
    else if (!r.ok) pdfGagal = `ALETA menjawab ${r.status}`;
    else {
      const luar = await r.json();
      const isi = luar && luar.data ? luar.data : luar;
      if (isi && isi.available && isi.pdfBase64) pdfBase64 = String(isi.pdfBase64);
      else pdfGagal = (isi && isi.message) || "pengubah PDF tidak tersedia";
    }
  } catch (galat) {
    pdfGagal = `ALETA tidak terjangkau: ${relaasPesan(galat)}`;
  }

  if (pdfBase64) {
    const u = await terbitkanUnduhan(`data:application/pdf;base64,${pdfBase64}`, `${jalur}.pdf`);
    if (!u.ok) return { ok: false, sebab: `unduhan PDF ditolak peramban: ${u.pesan}` };
    await catat("pdf", `${butir.nama}.pdf`);
    return { ok: true };
  }
  // PDF gagal. RTF-nya tetap diunduh bila caranya mengizinkan - berkas yang
  // dapat dicetak dari Word jauh lebih berguna daripada tidak ada berkas.
  if (caraRtf === "bila-pdf-gagal" && !butir.unduhan.rtf) {
    const tolak = await unduhRtf();
    if (tolak) return { ok: false, sebab: `PDF gagal (${pdfGagal}); ${tolak}` };
  }
  if (butir.unduhan.rtf) {
    return { ok: true, tanpaPdf: true, sebab: `PDF gagal: ${pdfGagal}. Hanya RTF yang tersimpan - cetak dari Word.` };
  }
  return { ok: false, sebab: `PDF gagal: ${pdfGagal}` };
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
      if (!butir.unduhan || typeof butir.unduhan !== "object") butir.unduhan = { rtf: "", pdf: "" };
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
        butir.tanpaPdf = Boolean(hasil.tanpaPdf);
        butir.sebab = hasil.sebab || "";
        butir.selesaiPada = Date.now();
      } else {
        butir.keadaan = "gagal";
        butir.sebab = hasil.bolehUlang
          ? `gagal sesudah ${butir.percobaan} percobaan: ${hasil.sebab || "sebabnya tidak terbaca"}`
          : hasil.sebab || "sebabnya tidak terbaca";
        butir.selesaiPada = Date.now();
      }
      butir.hasil = relaasHasilButir(butir);
      pekerjaan.waktuBerikut = Date.now() + relaasJedaDokumen();
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
  const asal = String(s.asalPortal || "").replace(/\/+$/, "");
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
