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
   * ==========================================================================
   * 5227 - ALASAN-ALASAN GUGATAN, DISUSUN SEBAGAI FAKTA HUKUM
   * ==========================================================================
   *
   * Bentuk pertamanya menderetkan kalimat lengkap satu per satu:
   *
   *   "antara Penggugat dan Tergugat terus-menerus terjadi perselisihan dan
   *    pertengkaran, Tergugat melakukan Kekerasan Dalam Rumah Tangga terhadap
   *    Penggugat, Tergugat melalaikan kewajiban memberi nafkah kepada
   *    Penggugat dan Tergugat bersikap cemburu berlebihan"
   *
   * Itu bukan bahasa putusan. Empat hal keliru sekaligus:
   *
   *   1. SUBJEKNYA DIULANG. "Tergugat" muncul tiga kali dalam satu kalimat,
   *      padahal seluruh perbuatan itu dilakukan orang yang sama.
   *   2. TIDAK DIAWALI PELAKUNYA. Kalimatnya dibuka dengan keadaan bersama
   *      ("antara Penggugat dan Tergugat"), sehingga yang terbaca lebih dulu
   *      justru bukan siapa yang berbuat.
   *   3. PERSELISIHAN DISAMAKAN DENGAN PERBUATAN. Perselisihan terus-menerus
   *      itu AKIBAT dari perbuatan-perbuatan tadi, bukan salah satu di antara
   *      keduanya. Menderetkannya sejajar menghilangkan hubungan sebab-akibat
   *      yang justru menjadi inti pertimbangan.
   *   4. PENYAMBUNGNYA "dan". Dalam rumusan berdaftar, penutup yang lazim
   *      dipakai putusan adalah "serta".
   *
   * Yang benar satu kalimat berpelaku tunggal, daftar perbuatan tanpa
   * mengulang subjek, lalu akibatnya sebagai keterangan penutup:
   *
   *   "Tergugat melalaikan kewajiban nafkah lahir, bersikap cemburu
   *    berlebihan, serta melakukan Kekerasan Dalam Rumah Tangga (KDRT) yang
   *    memicu perselisihan terus-menerus dengan Penggugat"
   *
   * ==========================================================================
   * PELAKUNYA TIDAK DITEBAK
   * ==========================================================================
   *
   * Pada cerai gugat pelakunya "Tergugat"; pada cerai talak "Termohon". Kedua
   * kata itu tidak diturunkan dari jenis perkara di sini - ABT sudah
   * menyimpannya sebagai variabel tersendiri, 0046 dan 0047, dan ekstensi
   * membacanya dari halaman yang sedang dibuka. Menebaknya dari klasifikasi
   * perkara berarti salah menyebut pihak pada perkara yang klasifikasinya
   * tidak terduga.
   */
  frasaCiri: {
    // `urutan` menentukan tempatnya di dalam kalimat - bukan urutan kata kunci
    // ditemukan, yang bergantung pada cara saksi bertutur.
    //
    // `akibat` menandai ciri yang BUKAN perbuatan. Yang bertanda akibat tidak
    // pernah masuk daftar; ia menjadi keterangan penutup.
    "tidak memberi nafkah": { urutan: 10, frasa: "melalaikan kewajiban nafkah lahir" },
    cemburu: { urutan: 20, frasa: "bersikap cemburu berlebihan" },
    "pihak lain (wanita/pria idaman lain)": { urutan: 30, frasa: "menjalin hubungan dengan pihak lain" },
    "kekerasan dalam rumah tangga": {
      urutan: 40,
      frasa: "melakukan Kekerasan Dalam Rumah Tangga (KDRT)",
    },
    // ========================================================================
    // MABUK, JUDI, DAN OBAT TERLARANG DIPISAH - DULU SATU FRASA UNTUK TIGANYA
    // ========================================================================
    //
    // Bentuk lamanya satu ciri berbunyi "menjadi pemabuk, penjudi, atau
    // pemakai obat terlarang". Ia dipakai apa pun pemicunya, sehingga saksi
    // yang hanya menerangkan judi menghasilkan kalimat yang menuduh mabuk dan
    // memakai obat terlarang sekaligus.
    //
    // Pada perkara 510/Pdt.G/2026/PA.Dgl keduanya menerangkan judi online -
    // tidak satu pun menyebut mabuk maupun obat - dan kalimat yang tersusun
    // tetap menuduh ketiganya. Itu bukan ketidaktepatan bahasa; itu
    // pertimbangan hukum yang menyebut perbuatan yang tidak dibuktikan.
    //
    // Ketiganya tetap satu huruf yang sama dalam Pasal 19 PP 9/1975 - itu
    // urusan 8503, bukan urusan kalimat ini. Yang ditulis di sini apa yang
    // benar-benar diterangkan.
    "mabuk": { urutan: 50, frasa: "menjadi pemabuk" },
    "judi": { urutan: 51, frasa: "menjadi penjudi" },
    "obat terlarang": { urutan: 52, frasa: "menjadi pemakai obat terlarang" },
    "murtad/pindah agama": { urutan: 60, frasa: "berpindah agama" },
    "perselisihan terus-menerus": {
      urutan: 90,
      akibat: true,
      frasa: "memicu perselisihan terus-menerus dengan",
    },
  },

  /**
   * Penyambung berdaftar.
   *
   * "serta" untuk yang terakhir, bukan "dan". Tetapi komanya bergantung pada
   * BANYAKNYA butir: daftar tiga butir atau lebih memakai koma sebelum
   * "serta", sedangkan dua butir tidak - "A, serta B" bukan bentuk yang lazim,
   * sebab koma di sana memisahkan dua hal yang justru sudah tersambung.
   */
  penyambungAlasan: { antara: ", ", terakhirBanyak: ", serta ", terakhirDua: " serta " },

  /**
   * Ketika tidak ada satu pun PERBUATAN yang terbaca dan yang ada hanya
   * perselisihannya, kalimat berpelaku tunggal tidak dapat disusun - tidak ada
   * perbuatan untuk digantungi akibat. Yang dipakai rumusan bersama, dan itu
   * memang bentuk yang lazim untuk keadaan itu.
   */
  hanyaPerselisihan: "Antara {lawan} dan {pelaku} terus-menerus terjadi perselisihan dan pertengkaran",
};

/**
 * Menyusun kalimat 5227.
 *
 * @param daftarCiri ciri yang benar-benar disebut saksi
 * @param pihak      { pelaku, lawan } - dibaca dari variabel 0047 dan 0046
 */
function susunAlasan(daftarCiri, pihak) {
  const pelaku = String((pihak && pihak.pelaku) || "Tergugat").trim() || "Tergugat";
  const lawan = String((pihak && pihak.lawan) || "Penggugat").trim() || "Penggugat";

  const dikenal = (daftarCiri || [])
    .map((nama) => ({ nama, aturan: KALIMAT.frasaCiri[nama] }))
    .filter((x) => x.aturan)
    .sort((a, b) => a.aturan.urutan - b.aturan.urutan);

  const perbuatan = dikenal.filter((x) => !x.aturan.akibat).map((x) => x.aturan.frasa);
  const akibat = dikenal.find((x) => x.aturan.akibat);

  if (perbuatan.length === 0) {
    if (!akibat) return "";
    return KALIMAT.hanyaPerselisihan.replace("{lawan}", lawan).replace("{pelaku}", pelaku);
  }

  const penyambungAkhir =
    perbuatan.length === 2
      ? KALIMAT.penyambungAlasan.terakhirDua
      : KALIMAT.penyambungAlasan.terakhirBanyak;
  const daftar =
    perbuatan.length === 1
      ? perbuatan[0]
      : perbuatan.slice(0, -1).join(KALIMAT.penyambungAlasan.antara) +
        penyambungAkhir +
        perbuatan[perbuatan.length - 1];

  const penutup = akibat ? ` yang ${akibat.aturan.frasa} ${lawan}` : "";
  return `${pelaku} ${daftar}${penutup}`;
}

/** Kalimat upaya damai menurut berhasil atau tidaknya. */
function kalimatUpayaDamai(gagal) {
  return gagal ? KALIMAT.upayaDamai.gagal : KALIMAT.upayaDamai.berhasil;
}

module.exports = { KALIMAT, susunAlasan, kalimatUpayaDamai };
