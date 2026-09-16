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

/** Nama yang diusulkan bagi satu unduhan - dipisah supaya dapat diuji. */
function namaUnduhanAbt(nama, konteks) {
  const akhiran = (String(nama).split(".").pop() || "rtf").toLowerCase();
  const bagian = [konteks.nomor, konteks.keterangan, "putusan"].filter(Boolean);
  return `${bagian.join(" - ")}.${akhiran}`.replace(/[\\/:*?"<>|]+/g, "_");
}

if (chrome.downloads && chrome.downloads.onDeterminingFilename) {
  chrome.downloads.onDeterminingFilename.addListener((barang, sarankan) => {
    const nama = String((barang && barang.filename) || "");
    const asal = `${(barang && barang.url) || ""} ${(barang && barang.referrer) || ""}`;
    const dariAbt = /\/aps_badilag\//i.test(asal) || /\/abt\//i.test(asal);

    // Yang tidak mungkin diubah dijawab SEKARANG. Menjawab benar lalu
    // menunggu penyimpanan pada tiap unduhan biasa - gambar, lampiran,
    // pemasang - menahan seluruh unduhan peramban selama pembacaan itu.
    if (!dariAbt || !POLA_NAMA_UMUM.test(nama)) return false;

    // Sisanya dibaca dari penyimpanan, dan karena itu menyusul. Chrome
    // mengizinkannya asal listener-nya memulangkan true dan sarankan()
    // dipanggil TEPAT sekali - termasuk pada jalan yang gagal, kalau tidak
    // unduhannya menggantung tanpa nama.
    bacaKonteksUnduh()
      .then((konteks) => {
        if (!konteks) {
          sarankan();
          return;
        }
        sarankan({ filename: namaUnduhanAbt(nama, konteks), conflictAction: "uniquify" });
      })
      .catch(() => sarankan());
    return true;
  });
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
    void simpanKonteksUnduh({
      nomor: String(pesan.nomor || "").slice(0, 60),
      keterangan: String(pesan.keterangan || "").slice(0, 60),
      saat: Date.now(),
    });
    jawab({ ok: true });
    return false;
  }

  if (pesan.jenis === "unduh") {
    const nama = String(pesan.nama || "berkas").replace(/[\\/:*?"<>|]+/g, "_").slice(0, 180);
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
        jawab({ ok: true, id });
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
