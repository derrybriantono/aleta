"use strict";

/**
 * ============================================================================
 * PUSTAKA KALIMAT BAKU UNTUK ISIAN BLANGKO
 * ============================================================================
 *
 * Sebagian variabel ABT tidak meminta FAKTA, melainkan KALIMAT tentang fakta.
 * 1268 misalnya: yang perlu diketahui hanya "keluarga sudah berusaha atau
 * belum, dan berhasil atau tidak" - dua bit keterangan - tetapi yang masuk ke
 * putusan adalah satu kalimat penuh.
 *
 * Selama kalimatnya disusun ulang tiap kali, rumusannya berbeda antar majelis
 * untuk fakta yang persis sama, dan putusan pengadilan yang sama berbunyi
 * berlainan tanpa sebab. Karena itu kalimatnya dikumpulkan di sini - satu
 * tempat, bukan tersebar di dalam kode yang menurunkannya.
 *
 * ============================================================================
 * KENAPA BERKAS, BUKAN LAYAR PENGATURAN
 * ============================================================================
 *
 * Layar penyuntingan di portal memang lebih ramah, dan itu pantas dikerjakan.
 * Tetapi ia menuntut tabel, migrasi, rute, dan halaman - sementara yang
 * dibutuhkan hari ini hanya SATU TEMPAT yang dapat dicari dan diubah, dan
 * yang perubahannya ikut ke seluruh pengadilan begitu dipasang.
 *
 * Berkas ini adalah tempat itu. Mengubah kalimat di bawah mengubah seluruh
 * usulan berikutnya; pengujian menjaga bentuknya supaya perubahan yang
 * merusak tidak lolos diam-diam.
 *
 * YANG TIDAK BOLEH MASUK KE SINI: kalimat yang menyatakan hukum - bunyi pasal,
 * dasar putusan, pertimbangan. Itu ada di abtAturanAlasan.js, dan hanya boleh
 * disalin dari naskah resmi.
 */

const KALIMAT = {
  /**
   * 1268 - upaya damai oleh keluarga.
   *
   * Dua keadaan, dua kalimat. Yang membedakan hanya berhasil atau tidak, dan
   * perbedaan itu memang menentukan: yang berhasil tidak berujung perceraian.
   */
  upayaDamai: {
    gagal: "pihak keluarga telah berusaha untuk mendamaikan Penggugat dan Tergugat, namun tidak berhasil",
    berhasil: "pihak keluarga telah berusaha untuk mendamaikan Penggugat dan Tergugat",
  },

  /**
   * 5227 - alasan-alasan gugatan.
   *
   * Blangkonya sendiri mengingatkan: "JANGAN LUPA TAMBAH DAN SEBELUM ALASAN
   * TERAKHIR". Penyambungnya karena itu diurus di sini, bukan diserahkan pada
   * ingatan orang yang mengisi.
   */
  penyambungAlasan: { antara: ", ", terakhir: " dan " },

  /**
   * Sebutan tiap ciri, dalam bentuk yang pantas masuk ke kalimat putusan.
   *
   * Kunci di sebelah kiri dipakai kode; yang kanan yang dibaca manusia.
   * Memisahkannya membuat kata kunci pencarian dapat diubah tanpa mengubah
   * bunyi putusan, dan sebaliknya.
   */
  sebutanCiri: {
    "perselisihan terus-menerus": "antara Penggugat dan Tergugat terus-menerus terjadi perselisihan dan pertengkaran",
    "kekerasan dalam rumah tangga": "Tergugat melakukan Kekerasan Dalam Rumah Tangga terhadap Penggugat",
    "tidak memberi nafkah": "Tergugat melalaikan kewajiban memberi nafkah kepada Penggugat",
    "cemburu": "Tergugat bersikap cemburu berlebihan",
    "pihak lain (wanita/pria idaman lain)": "Tergugat memiliki pihak lain",
    "mabuk/judi/obat terlarang": "Tergugat menjadi pemabuk, penjudi, atau pemakai obat terlarang",
    "murtad/pindah agama": "Tergugat berpindah agama",
  },
};

/** Menyambung daftar alasan menurut penyambung baku. */
function susunAlasan(daftarCiri) {
  const kalimat = (daftarCiri || []).map((c) => KALIMAT.sebutanCiri[c] || c);
  if (kalimat.length === 0) return "";
  if (kalimat.length === 1) return kalimat[0];
  return (
    kalimat.slice(0, -1).join(KALIMAT.penyambungAlasan.antara) +
    KALIMAT.penyambungAlasan.terakhir +
    kalimat[kalimat.length - 1]
  );
}

/** Kalimat upaya damai menurut berhasil atau tidaknya. */
function kalimatUpayaDamai(gagal) {
  return gagal ? KALIMAT.upayaDamai.gagal : KALIMAT.upayaDamai.berhasil;
}

module.exports = { KALIMAT, susunAlasan, kalimatUpayaDamai };
