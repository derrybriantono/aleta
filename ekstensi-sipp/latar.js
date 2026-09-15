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
