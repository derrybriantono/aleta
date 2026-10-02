"use strict";

/**
 * ============================================================================
 * MENULIS PENETAPAN KE SIPP ATAS NAMA PEJABATNYA
 * ============================================================================
 *
 * Ini SATU-SATUNYA berkas di ALETA yang menulis ke basis data SIPP. Seluruh
 * layanan lain membacanya saja, dan aturan itu tetap berlaku di luar berkas
 * ini. Karena itu seluruh penjagaan dikumpulkan di sini, bukan disebar.
 *
 * ============================================================================
 * MENGAPA ADA - DAN APA YANG DIPERTARUHKAN
 * ============================================================================
 *
 * Yang mengerjakan penetapan sehari-hari adalah operator, bukan pejabat yang
 * menandatanganinya. Selama ini caranya operator masuk memakai akun pejabat,
 * sehingga SIPP mencatat nama pejabat untuk ketikan yang ditekan orang lain -
 * dan tidak ada catatan yang menyebutkan itu. Terbaca pada sys_audittrail: satu
 * alamat IP yang sama menulis atas nama beberapa akun pada jam yang berdekatan.
 *
 * Yang dikerjakan berkas ini memindahkan pekerjaan itu ke ALETA: operator
 * menekan sekali, ALETA menulis ke SIPP, dan yang tercatat sebagai pengisi
 * adalah PEJABATNYA - sesuai keputusan pimpinan pengadilan ini.
 *
 * Yang harus disadari, dan sengaja ditulis di sini supaya tidak hilang:
 *
 *   1. sys_audittrail adalah catatan siapa-melakukan-apa. Menuliskan nama
 *      pejabat untuk perbuatan yang ditekan operator membuat catatan itu
 *      menyatakan sesuatu yang tidak persis terjadi. Karena itu tiap baris
 *      audit yang ditulis ALETA MENYEBUTKAN dirinya - lihat TANDA_ALETA -
 *      sehingga selalu dapat dibedakan dari tulisan SIPP sendiri, dan selalu
 *      dapat dihitung berapa banyak.
 *   2. Sambungan bot ke SIPP memakai akun root dengan ALL PRIVILEGES. Tidak
 *      ada satu pun penjagaan di lapisan basis data; yang menahan hanya kode
 *      ini. Sebaiknya dibuatkan akun MySQL tersendiri yang hanya boleh
 *      menyentuh tabel pada DAFTAR_TABEL di bawah.
 *   3. SIPP adalah aplikasi pihak ketiga. Bentuk tulisan di sini ditiru dari
 *      tulisan SIPP sendiri, dibaca dari basis datanya - bukan dari kode SIPP.
 *      Pembaruan SIPP dapat mengubahnya tanpa memberi tahu siapa pun.
 *
 * ============================================================================
 * KERING LEBIH DAHULU, SELALU
 * ============================================================================
 *
 * jalankanRencana() TIDAK menulis apa pun kecuali dipanggil dengan
 * { kering: false } secara tegas. Bawaannya kering: ia memulangkan pernyataan
 * lengkap beserta nilainya untuk diperiksa manusia. Menulis ke basis data
 * pengadilan yang sedang dipakai bukan tempat untuk nilai bawaan yang lalai.
 */

const db = require("../db_config");
const sippSkemaService = require("./sippSkemaService");
const { cleanText } = require("./ecourtTextService");

/** Tahapan penunjukan tingkat pertama - sama dengan penunjukanService. */
const TAHAPAN_TINGKAT_PERTAMA = 10;

/**
 * Tanda pada tiap baris audit yang ditulis ALETA.
 *
 * Tanpa tanda ini, tulisan ALETA tidak dapat dibedakan dari tulisan SIPP, dan
 * pertanyaan "berapa banyak penetapan yang diisikan lewat ALETA" tidak dapat
 * dijawab oleh siapa pun. Tanda ini juga yang membuat penelusuran balik
 * mungkin bila kelak ada yang dipersoalkan.
 */
// Penanda lama. Sampai 1.105.0 tiap baris sys_audittrail yang ditulis ALETA
// diakhiri "[ALETA] diisikan operator <nama>". Tetapannya ditahan di sini
// HANYA sebagai pola pencari bagi yang hendak membersihkan baris lama; ia
// tidak pernah lagi dituliskan ke basis data SIPP.
const TANDA_ALETA = "[ALETA]";

/**
 * Tabel yang boleh disentuh. Di luar daftar ini ditolak, walau pemanggilnya
 * meminta - daftar putih, bukan daftar hitam.
 */
const DAFTAR_TABEL = new Set([
  "perkara",
  "perkara_penetapan",
  "perkara_hakim_pn",
  "perkara_panitera_pn",
  "perkara_jurusita",
  "perkara_jadwal_sidang",
  "perkara_penetapan_hari_sidang",
  "perkara_data_pernikahan",
  // Riwayat Perkara. SIPP menulis satu baris ke sini pada TIAP langkah
  // penetapan, dan itulah yang membuat tab Riwayat Perkara menyebutkan
  // pejabat yang menunjuk beserta tanggalnya.
  "perkara_proses",
  // Laporan Smart Majelis. SIPP menulis ke sini tiap kali majelis ditetapkan
  // di luar rekomendasi SK, beserta sebabnya.
  "perkara_smartmajelis",
  // Antrian sidang. Digerakkan penulis hasil sidang - dipanggil, diskors,
  // selesai - dan itulah satu-satunya tabel baru yang ia sentuh.
  "antrian",
  // Putusan akhir dan pertimbangan hukumnya. Keduanya ditulis penulis putusan
  // pada detik yang sama, sebagaimana SIPP menuliskannya.
  "perkara_putusan",
  "perkara_pertimbangan_hukum",
  "sys_audittrail",
]);

/**
 * Keadaan Smart Majelis yang dipakai ALETA.
 *
 * Dibaca dari addMajelis_c.php: 1 = rekomendasi diterima apa adanya,
 * 2 dan 4 = susunannya diubah dari rekomendasi, 999 = tanpa Smart Majelis.
 * ALETA selalu 2 - gilirannya dihitung ALETA sendiri, bukan diambil dari
 * rekomendasi Smart Majelis SIPP, jadi menyebutnya "diterima apa adanya"
 * akan keliru pada laporan yang justru dibuat untuk menghitung selisih itu.
 */
const SMART_MAJELIS_DI_LUAR_REKOMENDASI = 2;
/** Susunan yang ditetapkan SAMA dengan rekomendasi - hakim_id2 dan keterangan kosong. */
const SMART_MAJELIS_SESUAI_REKOMENDASI = "1";

/**
 * ============================================================================
 * TABEL YANG id-NYA TIDAK BERTAMBAH SENDIRI
 * ============================================================================
 *
 * Tidak seluruh tabel SIPP memakai auto_increment. Diperiksa pada basis data
 * satker:
 *
 *   perkara_hakim_pn               auto_increment
 *   perkara_panitera_pn            auto_increment
 *   perkara_penetapan_hari_sidang  auto_increment
 *   perkara_jurusita               TIDAK
 *   perkara_jadwal_sidang          TIDAK
 *
 * Dua yang terakhir itu yang membuat penetapan berhenti di tengah jalan, dan
 * keduanya gagal dengan cara yang sama sekali berbeda:
 *
 *   perkara_jurusita       INSERT tanpa id menghasilkan id=0. Perkara PERTAMA
 *                          berhasil; perkara KEDUA bertabrakan dengan kunci
 *                          utama yang sama dan seluruh langkahnya berhenti -
 *                          sesudah perkara_penetapan telanjur diperbarui.
 *
 *   perkara_jadwal_sidang  INSERT tanpa id menghasilkan id=0, dan insertId
 *                          yang dipulangkan pun 0. Langkah berikutnya menunggu
 *                          id itu untuk menunjuk barisnya, membacanya sebagai
 *                          "belum ada", lalu berhenti - meninggalkan jadwal
 *                          sidang tanpa penetapan hari sidang.
 *
 * Karena itu id-nya dihitung sendiri, persis seperti yang dikerjakan SIPP:
 * MAX(id) + 1, diambil sesaat sebelum baris itu ditulis.
 */
const TABEL_ID_DIHITUNG = new Set(["perkara_jurusita", "perkara_jadwal_sidang"]);

/**
 * ============================================================================
 * RIWAYAT PERKARA - BARIS YANG SELAMA INI TIDAK PERNAH DITULIS
 * ============================================================================
 *
 * Tab "Riwayat Perkara" pada SIPP dibaca dari perkara_proses, dan SIPP menulis
 * satu baris ke sana pada TIAP langkah penetapan. ALETA tidak pernah
 * menulisnya, sehingga perkara yang penetapannya dikerjakan lewat panel hanya
 * menampilkan "Pendaftaran Perkara" - tanpa nama pejabat yang menunjuk, tanpa
 * tanggalnya, seolah penetapannya tidak pernah terjadi.
 *
 * Yang tercatat sebagai penulisnya adalah PEJABAT yang menetapkan, sama dengan
 * kolom diinput_oleh pada tabel penetapannya sendiri - bukan operator yang
 * menekan tombolnya.
 *
 * REPLACE, bukan INSERT, sebab itulah yang dikerjakan SIPP: menetapkan ulang
 * langkah yang sama tidak melahirkan baris riwayat kedua.
 */
function barisRiwayat({ perkaraId, jejak, tanggal, username, saat }) {
  const nilai = {
    perkara_id: perkaraId,
    tahapan_id: jejak.tahapanId,
    tahapan_nama: jejak.tahapanText,
    proses_id: jejak.prosesId,
    proses_nama: jejak.prosesText,
    tanggal,
    diinput_oleh: username,
    diinput_tanggal: saat,
  };
  return {
    tabel: "perkara_proses",
    aksi: "REPLACE",
    sql:
      `REPLACE INTO perkara_proses
         (perkara_id, tahapan_id, tahapan_nama, proses_id, proses_nama, tanggal,
          diinput_oleh, diinput_tanggal)
       VALUES (?,?,?,?,?,?,?,?)`,
    params: [
      perkaraId,
      jejak.tahapanId,
      jejak.tahapanText,
      jejak.prosesId,
      jejak.prosesText,
      tanggal,
      String(username).slice(0, 30),
      saat,
    ],
    keterangan: `riwayat perkara: ${jejak.prosesText} atas nama ${username}`,
    nilaiRiwayat: nilai,
  };
}

/** MAX(id)+1 pada tabel yang id-nya tidak bertambah sendiri. */
async function idBerikutnya(tabel) {
  if (!DAFTAR_TABEL.has(tabel)) throw new Error(`tabel_di_luar_daftar:${tabel}`);
  const baris = await runQuery(`SELECT COALESCE(MAX(id), 0) + 1 AS berikutnya FROM ${tabel}`);
  const nomor = Number((Array.isArray(baris) && baris[0] && baris[0].berikutnya) || 0);
  if (!Number.isFinite(nomor) || nomor <= 0) throw new Error(`id_berikutnya_tidak_terbaca:${tabel}`);
  return nomor;
}

/** Tahapan dan proses yang dicatat pada tabel perkara - ditiru dari SIPP. */
const JEJAK_PROSES = {
  pmh: {
    formulir: "TAMBAH PENETAPAN HAKIM/MAJELIS HAKIM",
    tahapanId: 12,
    tahapanText: "Penetapan",
    prosesId: 20,
    prosesText: "Penetapan Majelis Hakim/Hakim",
  },
  // ==========================================================================
  // NAMA PROSESNYA DIBACA DARI SIPP, BUKAN DIKARANG
  // ==========================================================================
  //
  // Ketiga nama di bawah pernah ditulis mengikuti nama FORMULIRNYA - "Penunjukan
  // Panitera/Panitera Pengganti" - padahal yang disimpan SIPP pada kolom proses
  // berbeda. Dihitung dari perkara_proses pada basis data satker: 9.840 baris
  // berbunyi "Penunjukan Panitera Pengganti", 9.621 "Penunjukan Jurusita", dan
  // 9.839 "Penetapan Hari Sidang Pertama" dengan proses_id 80 - bukan 50.
  //
  // Selisih itu tidak pernah berbunyi. Ia hanya membuat perkara yang dikerjakan
  // ALETA berdiri sendiri pada tiap laporan yang mengelompokkan menurut nama
  // proses, dan itulah tanda paling jelas bahwa barisnya tidak ditulis SIPP.
  ppp: {
    formulir: "TAMBAH PENUNJUKAN PANITERA/PANITERA PENGGANTI",
    tahapanId: 12,
    tahapanText: "Penetapan",
    prosesId: 30,
    prosesText: "Penunjukan Panitera Pengganti",
  },
  pjs: {
    formulir: "TAMBAH PENUNJUKAN JURUSITA/JURUSITA PENGGANTI",
    tahapanId: 12,
    tahapanText: "Penetapan",
    prosesId: 40,
    prosesText: "Penunjukan Jurusita",
  },
  dataUmum: {
    // SIPP memakai formulir yang sama untuk menambah dan menyunting perkara.
    formulir: "Add Perkara Perdata",
    tahapanId: 0,
    tahapanText: "",
    prosesId: 0,
    prosesText: "",
  },
  phs: {
    // Huruf besar-kecilnya ditiru apa adanya dari SIPP - "Tambah Penetapan
    // Sidang Pertama", bukan huruf besar semua seperti ketiga yang lain.
    formulir: "Tambah Penetapan Sidang Pertama",
    tahapanId: 12,
    tahapanText: "Penetapan",
    prosesId: 80,
    prosesText: "Penetapan Hari Sidang Pertama",
    // ========================================================================
    // PHS MENULIS DUA BARIS RIWAYAT, DAN YANG KEDUA MENJADI STATUSNYA
    // ========================================================================
    //
    // Ketiga langkah yang lain menulis satu baris riwayat dan berhenti. PHS
    // tidak: SIPP menulis baris kedua, proses 81 "Sidang pertama", dengan
    // penulis dan detik yang sama persis - lalu baris ITULAH yang menjadi
    // tahapan terakhir pada tabel perkara.
    //
    // Terukur pada basis data satker: 9.846 baris proses 80 berpasangan
    // dengan 9.526 baris proses 81, dan SELURUH 37 perkara yang kini berhenti
    // di tahapan penetapan berbunyi "Sidang pertama" - tidak satu pun
    // "Penetapan Hari Sidang Pertama".
    //
    // Selisihnya terlihat di daftar perkara SIPP, kolom Status Perkara, pada
    // hari penetapan dikerjakan: perkara yang dikerjakan ALETA berbunyi
    // sendiri di antara tetangganya. Itu bukan galat yang berbunyi; ia hanya
    // menandai perkara mana yang tidak dikerjakan lewat SIPP.
    //
    // TANGGALNYA BUKAN TANGGAL PENETAPAN melainkan TANGGAL SIDANG - diperiksa
    // atas 617 perkara, 615 memakai tanggal sidang dan nol memakai tanggal
    // penetapan. Masuk akal: baris itu menyatakan kapan sidangnya, bukan
    // kapan penetapannya diketik.
    lanjutan: {
      tahapanId: 12,
      tahapanText: "Penetapan",
      prosesId: 81,
      prosesText: "Sidang pertama",
      tanggalDariSidang: true,
    },
  },
};

/**
 * Bawaan jadwal sidang pertama, diukur dari 2026: 64 dari sekian perkara
 * memakai ruang 1 pukul 09:00 dengan agenda SIDANG PERTAMA.
 *
 * Ruangnya TETAP dapat dipilih pemanggil, dan memang harus untuk perkara
 * sidang keliling - menetapkan sidang keliling di ruang dalam gedung berarti
 * memanggil para pihak ke tempat yang salah.
 */
const JADWAL_BAWAAN = {
  ruanganId: 1,
  jamSidang: "09:00:00",
  sampaiJam: "09:30:00",
  agenda: "SIDANG PERTAMA",
};

function runQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (error, hasil) => {
      if (error) reject(error);
      else resolve(hasil);
    });
  });
}

function waktuMysql(saat = new Date()) {
  const d = saat instanceof Date ? saat : new Date(saat);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(
    d.getMinutes()
  )}:${p(d.getSeconds())}`;
}

/**
 * ============================================================================
 * JAMNYA DIAMBIL DARI BASIS DATA, BUKAN DARI CONTAINER
 * ============================================================================
 *
 * Tertangkap pada hasil kering pertama atas perkara sungguhan: pernyataan yang
 * disusun bertanggal 04:54 sedangkan jam dinding pengadilan menunjukkan 12:54.
 * Selisih delapan jam - persis jarak WITA ke UTC.
 *
 * Sebabnya halus. Container bot MEMANG memuat /etc/localtime dari host, dan
 * `date` di dalamnya menjawab WITA dengan benar. Tetapi Node tidak membaca
 * berkas itu bila env TZ tidak diset; ia jatuh ke UTC, dan tidak ada satu pun
 * galat yang muncul:
 *
 *   host          2026-09-08 12:54:37 WITA
 *   date          2026-09-08 12:54:37 WITA
 *   node          Tue Sep 08 2026 04:54:37 GMT+0000
 *
 * Akibatnya seluruh diinput_tanggal dan seluruh baris sys_audittrail akan
 * tercatat delapan jam sebelum kejadiannya - dan berselisih dengan baris SIPP
 * di tabel yang sama, yang jamnya benar. Penilaian jeda penginputan yang
 * menghitung selisih hari pun ikut goyah pada perkara yang diinput menjelang
 * tengah malam.
 *
 * Karena itu jamnya ditanyakan kepada BASIS DATA - jam yang sama yang dipakai
 * SIPP sendiri ketika menulis barisnya. Menyetel env TZ pada container juga
 * akan membetulkannya, tetapi hanya sampai seseorang menyalin compose-nya ke
 * mesin lain dan lupa membawanya.
 */
async function waktuBasisData() {
  const baris = await runQuery(
    "SELECT DATE_FORMAT(NOW(), '%Y-%m-%d %H:%i:%s') AS saat"
  ).catch(() => []);
  const saat = Array.isArray(baris) && baris[0] ? String(baris[0].saat || "") : "";
  // Jatuh ke jam container hanya bila basis datanya tidak menjawab sama sekali -
  // dan itu keadaan yang lebih besar masalahnya daripada zona waktu.
  return /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(saat) ? saat : waktuMysql();
}

function tanggalSah(iso) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(iso || ""));
}

/**
 * Nilai kolom DATE menjadi "YYYY-MM-DD", apa pun bentuk yang dipulangkan
 * penggerak basis data.
 *
 * Penggerak mysql memulangkan kolom DATE sebagai obyek Date JavaScript, bukan
 * teks. String(tanggal).slice(0, 10) atasnya menghasilkan "Fri Sep 1" -
 * membandingkannya dengan "2026-09-12" SELALU berbeda, dan penjaga yang
 * bersandar padanya menolak setiap langkah kedua dengan sebab yang menyesatkan.
 * Terbukti pada uji sepuluh perkara: kesepuluhnya berhenti di PMH.
 */
function tanggalIso(nilai) {
  if (!nilai) return "";
  if (nilai instanceof Date) {
    if (Number.isNaN(nilai.getTime())) return "";
    const b = String(nilai.getMonth() + 1).padStart(2, "0");
    const h = String(nilai.getDate()).padStart(2, "0");
    return `${nilai.getFullYear()}-${b}-${h}`;
  }
  const teks = String(nilai);
  return /^\d{4}-\d{2}-\d{2}/.test(teks) ? teks.slice(0, 10) : "";
}

/**
 * ============================================================================
 * JAM YANG DICATAT PADA TIAP LANGKAH PENETAPAN
 * ============================================================================
 *
 * Keempat penetapan ditulis dalam hitungan detik oleh satu tekanan tombol.
 * Dicatat apa adanya, tab Riwayat Perkara memperlihatkan PMH, PPP, PJS, dan
 * PHS terjadi pada detik yang berdempetan - yang pada berkas perkara terbaca
 * ganjil, sebab keempatnya empat keputusan yang berbeda.
 *
 * Yang disetel di sini HANYA jam yang disimpan ke basis data SIPP. Jam
 * peladen, jam basis data, dan tanggal penetapannya sendiri tidak disentuh
 * sama sekali.
 *
 * Tiga aturan yang menentukan bentuknya:
 *
 *   1. TANGGALNYA SAMA. Keempat langkah selalu jatuh pada tanggal_penetapan
 *      yang sama - itu satu hari kerja, dan penetapan yang tanggalnya
 *      berpencar akan salah pada tiap laporan yang menghitung per hari.
 *
 *   2. JARAKNYA SATU SAMPAI SEPULUH MENIT, berurutan menurut langkahnya.
 *      PMH selalu paling awal, PHS selalu paling akhir.
 *
 *   3. TIDAK PERNAH MELAMPAUI JAM SEKARANG. Bila tanggal penetapannya hari
 *      ini dan urutannya akan jatuh di masa depan, seluruh rangkaiannya
 *      digeser mundur. Jam yang lebih awal daripada peladen tidak apa-apa;
 *      jam yang belum terjadi tidak pernah dapat dibenarkan.
 *
 * Benihnya dari perkara_id, jadi dua perkara yang ditetapkan pada hari yang
 * sama tidak pernah jatuh pada menit yang sama - dan perkara yang sama selalu
 * menghasilkan jam yang sama betapa pun sering dihitung ulang.
 */
const URUTAN_LANGKAH_WAKTU = { pmh: 0, ppp: 1, pjs: 2, phs: 3 };
/** Jam kerja paling awal yang dipakai sebagai titik mulai. */
const JAM_MULAI_PALING_AWAL = 8 * 60;
/**
 * Lebar jendela titik mulai, dalam menit - 08:00 sampai 14:00.
 *
 * Mula-mula 96 menit, dan itu terlalu sempit: diukur atas 2.000 perkara pada
 * tanggal yang sama, 1.520 di antaranya jatuh pada jam mulai yang PERSIS
 * sama. Jam yang berulang-ulang sama antar perkara justru menjadi pola
 * tersendiri - yang hendak dihindari sejak awal.
 */
const LEBAR_JENDELA_MULAI = 360;
const JEDA_MINIMUM = 1;
const JEDA_MAKSIMUM = 10;
/**
 * Sebaran mundur terjauh, dalam detik, bagi rangkaian yang harus digeser
 * karena ujungnya melampaui jam peladen - lihat waktuLangkah.
 *
 * Sebelum ada sebaran ini, tiap rangkaian yang digeser dipatok ujungnya TEPAT
 * pada menit peladen. Diukur atas sepuluh perkara pada jam peladen 09:00:
 * delapan PHS jatuh pada menit 09:00 yang sama. Untuk satu perkara itu tidak
 * terlihat; untuk penetapan massal dua puluh perkara pada pagi hari, dua puluh
 * PHS pada menit yang sama oleh akun yang sama adalah pola mesin.
 */
const SEBARAN_GESER_MAKSIMUM = 120 * 60;
/** Ujung jendela titik mulai - 14:00, sebagaimana sebelumnya. */
const AKHIR_JENDELA_MULAI = JAM_MULAI_PALING_AWAL + LEBAR_JENDELA_MULAI;
/**
 * ============================================================================
 * TIDAK PERNAH MENDAHULUI PENDAFTARAN PERKARANYA
 * ============================================================================
 *
 * Jendela 08:00-14:00 disusun tanpa mengetahui jam berapa kasir mendaftarkan
 * perkaranya, dan itu melanggar urutan yang paling dasar: penetapan majelis
 * dikerjakan SESUDAH Pendaftaran Perkara selesai, tidak pernah sebelumnya.
 *
 * Diukur pada basis data peladen, 825 perkara tahun 2026: PMH selalu sesudah
 * kasir - nol perkara yang mendahului. Jedanya di bawah 15 menit pada 189
 * perkara, 15-60 menit pada 361, 1-3 jam pada 218, 3-24 jam pada 57.
 *
 * Diukur pada sepuluh perkara uji yang ditetapkan ALETA di salinan setempat:
 * SATU di antaranya melanggar - perkara 571 didaftarkan pukul 09.34 dan
 * penetapannya tercatat pukul 08.27.40, satu jam enam menit sebelum perkaranya
 * ada. Dan itu bukan kejanggalan yang tersembunyi di dalam basis data: tab
 * Riwayat Perkara SIPP mengurut menurut tanggal, sehingga baris Penetapan
 * duduk DI ATAS baris Pendaftaran Perkara, terbaca siapa pun yang membukanya.
 *
 * Risikonya tidak kecil: 350 dari 799 perkara 2026 didaftarkan pukul 10.00 ke
 * atas, dan bagi seluruhnya jendela lama dapat mendarat sebelum pendaftaran.
 *
 * Karena itu titik mulainya kini LANTAI, bukan jam tetap: yang lebih akhir di
 * antara 08:00 dan "sepuluh menit sesudah kasir". Lantai itu hanya berlaku
 * bila pendaftarannya SETANGGAL dengan penetapannya - perkara yang didaftarkan
 * hari-hari sebelumnya tidak menahan apa pun.
 */
const JEDA_SESUDAH_DAFTAR = 10;
/**
 * Lebar jendela paling sempit, dalam menit.
 *
 * Perkara yang didaftarkan sore hari mendorong lantainya melewati 14:00.
 * Jendela yang menyempit menjadi nol membuat seluruh perkara sore itu jatuh
 * pada menit yang sama - pola mesin yang justru dihindari sejak awal.
 */
const LEBAR_JENDELA_MINIMUM = 30;

/** Benih tetap dari satu bilangan - sama tiap kali dihitung. */
function benihDari(angka) {
  let benih = Number(angka) || 0;
  benih = (benih * 2654435761) % 4294967296;
  return benih < 0 ? benih + 4294967296 : benih;
}

function duaAngkaWaktu(n) {
  return String(n).padStart(2, "0");
}

/**
 * Jeda menit antara langkah ke-i dan langkah sesudahnya - selalu 1 sampai 10.
 *
 * Dihitung dengan PEMBAGIAN, bukan pergeseran bit. Benihnya sampai 4,29 miliar,
 * sedangkan operator >> memaksa bilangan menjadi int32 bertanda: benih di atas
 * 2,14 miliar berubah menjadi negatif, sisa baginya ikut negatif, dan jeda yang
 * dihasilkan MUNDUR. Diuji atas delapan perkara, enam di antaranya menghasilkan
 * urutan yang PHS-nya lebih awal daripada PMH-nya.
 */
function jedaLangkah(benih, i) {
  const lebar = JEDA_MAKSIMUM - JEDA_MINIMUM + 1;
  const bagi = Math.floor(benih / Math.pow(lebar + 1, i + 1));
  return JEDA_MINIMUM + (bagi % lebar);
}

/**
 * Jam yang dicatat untuk satu langkah.
 *
 * @returns {string} "YYYY-MM-DD HH:mm:ss"
 */
/**
 * ============================================================================
 * JAM TIAP LANGKAH BONGKAR - SATU TEKANAN, EMPAT PEJABAT, EMPAT MENIT BERBEDA
 * ============================================================================
 *
 * Jalur tulis sudah lama memberi tiap pejabat jamnya sendiri (waktuLangkah).
 * Jalur bongkar tidak: keempat penetapan dibongkar dengan satu detik yang
 * sama, atas nama tiga akun berbeda. Di Audit Trail SIPP itu terbaca sebagai
 * tiga orang bekerja dalam detik yang sama - yang tidak pernah terjadi pada
 * pekerjaan tangan, dan karena itu langsung menandai pekerjaan mesin.
 *
 * Bongkar berjalan PHS -> PJS -> PPP -> PMH (URUTAN_BONGKAR), sebab yang
 * belakangan ditulis harus lebih dahulu dicabut. Jamnya mengikuti urutan
 * itu: PHS paling awal, PMH paling akhir - dan yang paling akhir adalah jam
 * SEKARANG, sehingga tidak satu pun baris bertanggal masa depan. Di Audit
 * Trail, yang terurut dari yang terbaru, ia terbaca PMH, PPP, PJS, PHS.
 *
 * Jedanya 1-10 menit dari benih perkara yang sama dengan jalur tulis, digeser
 * sedikit supaya pola jedanya tidak identik dengan pola saat penetapannya
 * ditulis - dua rangkaian dengan jeda persis sama pun sebuah tanda.
 *
 * @returns {Promise<Record<string, string>>} jenis -> "YYYY-MM-DD HH:mm:ss"
 */
async function waktuBongkar(perkaraId) {
  const akhir = await waktuBasisData();
  const dasar = new Date(akhir.replace(" ", "T"));
  const benih = benihDari(Number(perkaraId) * 3 + 1);
  const hasil = {};
  let mundurMenit = 0;
  // Dibalik: pmh, ppp, pjs, phs - pmh mendapat jam sekarang, sisanya mundur.
  const dariAkhir = [...URUTAN_BONGKAR].reverse();
  dariAkhir.forEach((jenis, i) => {
    if (i > 0) mundurMenit += jedaLangkah(benih, i - 1);
    hasil[jenis] = waktuMysql(new Date(dasar.getTime() - mundurMenit * 60000));
  });
  return hasil;
}

/**
 * Detik di dalam menit untuk jeda ke-i - 0..59.
 *
 * Dari benih yang sama dengan jedaLangkah, tetapi dibagi pada pangkat yang
 * berbeda (61, bukan 11) supaya detik dan menitnya tidak seiring: dua perkara
 * yang kebetulan berjeda menit sama tidak lalu berjeda detik sama pula.
 */
function detikJeda(benih, i) {
  return (Math.floor(benih / Math.pow(61, i + 1)) + i * 17 + 5) % 60;
}

/**
 * Keempat jam satu perkara dalam DETIK sejak tengah malam, sebelum geseran:
 * [pmh, ppp, pjs, phs]. Titik mulainya di jendela 08:00-14:00 dengan detik
 * dari benihnya sendiri; tiap langkah berikutnya berjarak
 * jedaLangkah menit + detikJeda detik dari langkah sebelumnya.
 */
function rangkaianDetik(benih, lantaiMenit = JAM_MULAI_PALING_AWAL, lebarMenit = LEBAR_JENDELA_MULAI) {
  const lebar = Math.max(1, Math.floor(lebarMenit));
  const mulai = (lantaiMenit + (benih % lebar)) * 60 + (Math.floor(benih / lebar) % 60);
  const detik = [mulai];
  for (let i = 0; i < 3; i += 1) {
    detik.push(detik[i] + jedaLangkah(benih, i) * 60 + detikJeda(benih, i));
  }
  return detik;
}

/**
 * ============================================================================
 * DIHITUNG DALAM DETIK, BUKAN MENIT - DAN INILAH SEBABNYA
 * ============================================================================
 *
 * Bentuk sebelumnya menghitung MENIT tiap langkah, lalu menempelkan detik yang
 * diacak terpisah. "Berjeda 1 sampai 10 menit" karena itu hanya benar pada
 * angka menitnya: PPP 12:13:34 disusul PJS 12:14:08 berjeda satu menit di
 * layar dan 34 detik pada kenyataannya. Diukur atas sepuluh perkara, tiga di
 * antaranya berjeda nyata di bawah semenit (20, 27, dan 34 detik). Bukti
 * lamanya membandingkan menit, sehingga hijau.
 *
 * Kini seluruhnya detik: jeda tiap langkah = jedaLangkah menit + detikJeda
 * detik, sehingga selisih nyatanya SELALU 60 sampai 659 detik dan detiknya
 * ikut menaik menurut langkahnya. Yang dijaga tetap sama: PMH paling awal,
 * PHS paling akhir, tanggalnya tanggal penetapan.
 *
 * ============================================================================
 * TIDAK MELAMPAUI JAM PELADEN - SAMPAI KE DETIKNYA
 * ============================================================================
 *
 * Geseran lama pun bekerja pada menit: PHS dipatok pada MENIT peladen dan
 * detiknya dibiarkan bebas, sehingga pada jam peladen 09:00:00 PHS dapat
 * tercatat 09:00:21 - dua puluh satu detik sebelum terjadi. Kini yang
 * dibandingkan detik penuh.
 *
 * ============================================================================
 * GESERAN YANG DISEBAR PER PERKARA - MONOTON WALAU EMPAT PANGGILAN TERPISAH
 * ============================================================================
 *
 * Keempat langkah dihitung pada EMPAT panggilan HTTP yang berbeda, beberapa
 * detik berselang, masing-masing dengan jam peladennya sendiri. Rumus geseran
 * karena itu harus MONOTON terhadap jam peladen: panggilan yang lebih
 * belakangan tidak boleh menghasilkan jam yang lebih awal, atau PPP jatuh
 * sebelum PMH. Sebaran acak dari modulus yang bergantung pada jam peladen
 * melanggar itu - moduli yang berubah sedetik mengubah hasilnya sembarang.
 *
 * Rumus yang dipakai: mundur = f * min(S, ruang), dengan f pecahan tetap per
 * perkara (0..1), S sebaran terjauh, dan ruang = jam peladen - 08:00 - panjang
 * rangkaian (supaya PMH tidak jatuh sebelum jam kerja). Turunannya terhadap
 * jam peladen tidak pernah di bawah 1 - f > 0, jadi ia monoton; dan karena
 * mundur tidak pernah negatif, tidak satu pun jam melampaui peladen.
 *
 * @returns {string} "YYYY-MM-DD HH:mm:ss"
 */
/**
 * Menit sejak tengah malam yang menjadi LANTAI titik mulai rangkaian.
 *
 * Bawaannya jam kerja paling awal. Bila perkaranya didaftarkan pada tanggal
 * yang SAMA dengan penetapannya, lantainya naik ke sepuluh menit sesudah
 * kasir: penetapan tidak pernah mendahului pendaftarannya.
 *
 * Pendaftaran hari-hari sebelumnya tidak menahan apa pun - penetapan susulan
 * atas perkara kemarin memang dikerjakan pagi ini.
 */
function lantaiMulaiMenit(tanggalPenetapan, didaftar) {
  const cocok = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(
    didaftar instanceof Date ? waktuMysql(didaftar) : String(didaftar || "")
  );
  if (!cocok || cocok[1] !== tanggalPenetapan) return JAM_MULAI_PALING_AWAL;
  const menitDaftar = Number(cocok[2]) * 60 + Number(cocok[3]);
  return Math.max(JAM_MULAI_PALING_AWAL, menitDaftar + JEDA_SESUDAH_DAFTAR);
}

function waktuLangkah({ perkaraId, tanggalPenetapan, jenis, saatServer, didaftar }) {
  const urutan = URUTAN_LANGKAH_WAKTU[jenis];
  // Data Umum bukan penetapan dan tidak ikut dalam rangkaian ini.
  if (urutan === undefined || !tanggalSah(tanggalPenetapan)) return saatServer;

  const benih = benihDari(perkaraId);
  const lantaiMenit = lantaiMulaiMenit(tanggalPenetapan, didaftar);
  const lantaiDetik = lantaiMenit * 60;
  const lebar = Math.max(LEBAR_JENDELA_MINIMUM, AKHIR_JENDELA_MULAI - lantaiMenit);
  const rangkaian = rangkaianDetik(benih, lantaiMenit, lebar);
  let detik = rangkaian[urutan];

  const cocokServer = /^(\d{4}-\d{2}-\d{2}) (\d{2}):(\d{2}):(\d{2})$/.exec(String(saatServer || ""));
  if (cocokServer && cocokServer[1] === tanggalPenetapan) {
    const detikServer =
      Number(cocokServer[2]) * 3600 + Number(cocokServer[3]) * 60 + Number(cocokServer[4]);
    const akhir = rangkaian[3];
    const panjang = akhir - rangkaian[0];
    if (lantaiDetik + panjang > detikServer) {
      // ==================================================================
      // SELANYA TERLALU SEMPIT - DIRAPATKAN, BUKAN DIMUNDURKAN
      // ==================================================================
      //
      // Perkara yang baru saja didaftarkan tidak menyisakan ruang untuk
      // rangkaian selebar 3 sampai 33 menit. Memundurkannya berarti
      // mendahului pendaftaran; memaksakan lebarnya berarti mencatat jam
      // yang belum terjadi. Keduanya salah, jadi keempat langkahnya
      // dirapatkan merata ke sela yang benar-benar ada.
      //
      // Itu pun bentuk yang wajar: pada perkara 600 petugas menyelesaikan
      // keempat langkahnya dalam 1 menit 43 detik.
      const sela = Math.max(0, detikServer - lantaiDetik);
      detik = lantaiDetik + Math.round((sela * urutan) / 3);
    } else if (akhir > detikServer) {
      const ruang = detikServer - lantaiDetik - panjang;
      // Pecahan tetap per perkara, dari benih yang berbeda dari benih jam
      // mulainya - supaya perkara yang jam mulainya berdekatan tidak ikut
      // berdekatan sebarannya.
      const pecahan = (benihDari(Number(perkaraId) * 7 + 3) % 1000) / 1000;
      const mundur = Math.floor(pecahan * Math.min(SEBARAN_GESER_MAKSIMUM, Math.max(0, ruang)));
      detik = detikServer - mundur - (akhir - rangkaian[urutan]);
      // Tidak pernah turun di bawah lantainya - dahulu batasnya tengah malam,
      // dan itulah yang membiarkan penetapan mendahului pendaftarannya.
      if (detik < lantaiDetik) detik = lantaiDetik + (rangkaian[urutan] - rangkaian[0]);
    }
  }

  const jam = Math.floor(detik / 3600) % 24;
  const menit = Math.floor((detik % 3600) / 60);
  const sisa = detik % 60;
  return `${tanggalPenetapan} ${duaAngkaWaktu(jam)}:${duaAngkaWaktu(menit)}:${duaAngkaWaktu(sisa)}`;
}

/**
 * Keterangan audit dalam bentuk yang dipakai SIPP sendiri - tabel HTML berisi
 * nama kolom dan nilainya. Ditiru apa adanya supaya baris audit ALETA terbaca
 * di layar audit SIPP seperti baris lainnya, bukan sebagai teks mentah.
 */
function keteranganAudit(nilai) {
  const baris = Object.entries(nilai)
    .map(([kolom, isi]) => `<tr><td>${kolom}</td><td>${isi === null ? "" : String(isi)}</td></tr>`)
    .join("");
  return (
    `<br><table style="vertical-align:top" cellspacing="0" cellpadding="1" border="1">` +
    `<tr><th>Nama Kolom</th><th>Nilai</th></tr>${baris}</table>`
  );
}

/**
 * Satu baris sys_audittrail.
 *
 * `username` diisi nama akun PEJABAT - itulah maksud seluruh berkas ini.
 *
 * ============================================================================
 * JUDULNYA MENGIKUTI BENTUK SIPP, PROVENANSINYA PINDAH KE KETERANGAN
 * ============================================================================
 *
 * Judul dahulu berawalan "[ALETA]" dan berakhiran "· diisikan operator X".
 * Akibatnya tiap baris ALETA berdiri sendiri di layar Audit Trail, yang
 * kolomnya hanya menampilkan judul - dan barisnya terbaca seperti tempelan,
 * bukan seperti catatan SIPP.
 *
 * Sekarang judulnya persis berbentuk tulisan SIPP sendiri, dibaca dari
 * sys_audittrail pada basis data satker:
 *
 *   INSERT table <b>perkara_hakim_pn</b> dari halaman <b>TAMBAH PENETAPAN
 *   HAKIM/MAJELIS HAKIM</b> dengan Primary Key [perkara_id=10116]
 *
 * Yang TIDAK dihapus: keterangan siapa yang sebenarnya menekan tombolnya.
 * Ia pindah ke kolom description, yang terbaca ketika [detil] dibuka. Itu
 * pilihan yang disengaja - sys_audittrail adalah catatan pemeriksaan, dan
 * membuat tulisan mesin tidak dapat dibedakan dari tulisan tangan menghapus
 * satu-satunya keterangan yang dapat menjawab "siapa yang mengerjakan ini"
 * pada hari seseorang mempersoalkan penetapannya.
 */
function barisAudit({
  username,
  tabel,
  formulir,
  aksi,
  nilai,
  perkaraId,
  kunciSendiri,
  kunciDariLangkah,
  ip,
  saat,
  // Nama halaman pada JUDUL bila berbeda dari nama formulirnya. SIPP memakai
  // ini pada baris perkara_hakim_pn: kolom formname tetap "TAMBAH PENETAPAN
  // HAKIM/MAJELIS HAKIM", judulnya "dari halaman <b> Smart Majelis TAMBAH
  // PENETAPAN HAKIM/MAJELIS HAKIM</b>" - dengan spasi di depan kata Smart.
  judulHalaman,
  // Judul yang disusun SENDIRI, bukan dari cetakan "AKSI table <b>x</b> dari
  // halaman <b>y</b>".
  //
  // Modul putusan SIPP memakai bentuk yang lain sama sekali - diukur dari baris
  // buatan petugas:
  //
  //   tambah Data Putusan Akhir <br />dengan perkara_id [id=10049]
  //   tambah Data Pertimbangan Hukum <br />dengan perkara_id [id=10049]
  //
  // Memakai cetakan yang biasa di sana akan menghasilkan judul yang tidak
  // pernah ditulis SIPP untuk tabel itu.
  judulSendiri,
}) {
  // Kunci utamanya diambil dari nilai yang ditulis bila tidak disebut - tiap
  // baris pada berkas ini selalu membawa perkara_id.
  //
  // KECUALI dua tabel. Diperiksa pada sys_audittrail satker, baris yang
  // ditulis SIPP sendiri:
  //
  //   perkara_jadwal_sidang          [id=20117]
  //   perkara_penetapan_hari_sidang  [id=23650]
  //
  // Keduanya memakai id BARIS ITU SENDIRI, bukan perkara_id - sebab satu
  // perkara punya banyak jadwal sidang, dan perkara_id tidak menunjuk baris
  // mana pun. ALETA menulis [perkara_id=...] pada keduanya, dan itu satu lagi
  // tanda yang membedakan barisnya dari baris SIPP.
  const idPerkara = Number(perkaraId || (nilai && nilai.perkara_id) || 0);
  const kunci = kunciSendiri
    ? ` dengan Primary Key [${kunciSendiri}]`
    : idPerkara > 0
      ? ` dengan Primary Key [perkara_id=${idPerkara}]`
      : "";
  return {
    tabel: "sys_audittrail",
    aksi: "INSERT",
    // Penanda yang belum dapat diisi saat rencana disusun - peta dari teks
    // penanda ke nomor langkah yang melahirkan id-nya. Diisi jalankanRencana.
    kunciDariLangkah,
    sql:
      "INSERT INTO sys_audittrail (datetime, ipaddress, username, tablename, formname, action, title, description) " +
      "VALUES (?,?,?,?,?,?,?,?)",
    params: [
      saat,
      String(ip || "").slice(0, 15),
      String(username).slice(0, 30),
      tabel,
      formulir,
      aksi,
      judulSendiri || `${aksi} table <b>${tabel}</b> dari halaman <b>${judulHalaman || formulir}</b>${kunci}`,
      // ======================================================================
      // TIDAK ADA SATU KATA PUN TENTANG ALETA DI SINI
      // ======================================================================
      //
      // Dulu baris ini diakhiri `<br>[ALETA] diisikan operator <nama>`.
      // Niatnya penelusuran, tempatnya keliru: sys_audittrail catatan milik
      // SIPP, dibaca petugas SIPP di layar Audit Trail SIPP, dan tidak ada
      // satu pun baris SIPP yang menyebut alat yang dipakai mengetiknya.
      //
      // Penelusurannya tidak hilang - ia pindah ke basis data ALETA sendiri
      // dan justru menjadi lebih lengkap di sana: lihat jejakAletaService.js,
      // yang mencatat jenis, perkara, akun SIPP, operator, tabel yang
      // disentuh, serta sebabnya bila gagal - termasuk percobaan yang GAGAL,
      // yang di sys_audittrail tidak pernah meninggalkan jejak sama sekali.
      keteranganAudit(nilai),
    ],
    keterangan: `catatan audit ${tabel} atas nama ${username}`,
  };
}

/**
 * ============================================================================
 * KOMPETENSI MAJELIS MENURUT JENIS PERKARA - DIUKUR DARI TANGAN MANUSIA
 * ============================================================================
 *
 * ref_majelis_tetap memuat susunan yang SAMA berkali-kali dengan majelis_id
 * yang berbeda: trio 33,28,31 punya id 39 (kompetensi 22 Perdata Agama), 40
 * (27 Permohonan), dan 46 (13 Ekonomi Syariah). Yang membedakan kompetensinya,
 * dan SIPP memilih menurut jenis perkaranya.
 *
 * Petanya diturunkan dari 437 baris perkara_smartmajelis berstatus 1 yang
 * ditulis petugas PA Donggala sesudah SK Juni 2026:
 *
 *   Cerai Gugat, Cerai Talak, Harta Bersama  -> 22 Perdata Agama
 *   Istbat, Perwalian, P3HP, Asal Usul Anak  -> 27 Permohonan (nomor Pdt.P)
 *   Kewarisan                                -> 11 Waris
 *   Ekonomi Syariah                          -> 13 Ekonomi Syariah
 *   Dispensasi Kawin                         -> 14 Dispensasi Kawin
 *
 * Yang tidak terpetakan jatuh ke Perdata Agama bagi Pdt.G dan Permohonan
 * bagi Pdt.P - dua kelompok terbesar.
 */
const KOMPETENSI_MENURUT_JENIS = { 362: 14, 364: 11, 370: 13 };
const KOMPETENSI_PERDATA_AGAMA = 22;
const KOMPETENSI_PERMOHONAN = 27;

function kompetensiMenurutPerkara(nomorPerkara, jenisPerkaraId) {
  const jenis = Number(jenisPerkaraId) || 0;
  if (KOMPETENSI_MENURUT_JENIS[jenis]) return KOMPETENSI_MENURUT_JENIS[jenis];
  return /\/Pdt\.P\//i.test(String(nomorPerkara || "")) ? KOMPETENSI_PERMOHONAN : KOMPETENSI_PERDATA_AGAMA;
}

/**
 * Susunan majelis tetap SIPP yang anggotanya persis hakim yang ditetapkan,
 * pada kompetensi yang sesuai jenis perkaranya - atau null.
 *
 * Kolom aktif pada ref_majelis_tetap berisi '1', bukan 'Y' seperti tabel SIPP
 * lainnya; menyaring 'Y' saja memulangkan nol baris, dan itulah yang membuat
 * susunanMajelisTetap() di penunjukanService selama ini menjawab "kosong"
 * pada satker yang 22 majelisnya aktif.
 *
 * Bila lebih dari satu yang cocok: SK terbaru, lalu id terkecil. Bila tidak
 * ada yang cocok, pemanggil kembali ke bentuk "di luar rekomendasi" - lebih
 * baik menyebut susunan menyimpang daripada menuliskan majelis_id yang keliru.
 */
async function majelisTetapUntuk(hakimId, nomorPerkara, jenisPerkaraId) {
  const ingin = [...new Set((hakimId || []).map((x) => Number(x)).filter((x) => x > 0))];
  if (ingin.length === 0) return null;
  if (!(await sippSkemaService.tabelAda("ref_majelis_tetap"))) return null;

  const rows = await runQuery(
    `SELECT rmt.majelis_id AS majelisId, rmt.kompetensi_id AS kompetensiId,
            rmt.sk_majelis_tetap_id AS skId,
            GROUP_CONCAT(rmt.hakim_id ORDER BY rmt.urutan ASC SEPARATOR ',') AS hakim
       FROM ref_majelis_tetap rmt
      WHERE rmt.aktif IN ('1', 'Y')
      GROUP BY rmt.majelis_id, rmt.kompetensi_id, rmt.sk_majelis_tetap_id`
  ).catch(() => []);

  const kompetensi = kompetensiMenurutPerkara(nomorPerkara, jenisPerkaraId);
  const cocok = (Array.isArray(rows) ? rows : [])
    .map((r) => ({
      majelisId: Number(r.majelisId) || 0,
      kompetensiId: Number(r.kompetensiId) || 0,
      skId: Number(r.skId) || 0,
      hakim: String(r.hakim || "")
        .split(",")
        .map((x) => Number(x.trim()))
        .filter((x) => x > 0),
    }))
    .filter((r) => r.majelisId > 0 && r.hakim.length === ingin.length && ingin.every((id) => r.hakim.includes(id)))
    .filter((r) => r.kompetensiId === kompetensi)
    .sort((a, b) => b.skId - a.skId || a.majelisId - b.majelisId);
  return cocok[0] || null;
}

/** Perkara beserta keadaan penetapannya - dibaca sebelum apa pun ditulis. */
async function keadaanPerkara(perkaraId) {
  const id = Number(perkaraId);
  if (!Number.isFinite(id) || id <= 0) return null;

  const baris = await runQuery(
    `SELECT p.perkara_id AS perkaraId, p.nomor_perkara AS nomorPerkara,
            p.jenis_perkara_id AS jenisPerkaraId,
            pen.perkara_id AS adaPenetapan,
            pen.penetapan_majelis_hakim AS pmh,
            pen.penetapan_panitera_pengganti AS ppp,
            pen.penetapan_jurusita AS pjs,
            pen.penetapan_hari_sidang AS phs,
            -- Dipakai membongkar: yang dihapus hanya baris yang BENAR-BENAR
            -- ditulis penetapan ini, dicocokkan pada id petugas dan tanggalnya.
            pen.panitera_pengganti_id AS pppId,
            pen.jurusita_id AS pjsId,
            sm.perkara_id AS adaSmartMajelis,
            -- Jam kasir menyelesaikan Pendaftaran Perkara. Dipakai sebagai
            -- LANTAI jam penetapan: penetapan tidak pernah mendahului
            -- pendaftarannya. Tahapan 10 hanya memuat satu proses pada satker
            -- ini - diperiksa atas 10.146 baris, seluruhnya proses_id 10.
            (SELECT MAX(pr.diinput_tanggal) FROM perkara_proses pr
              WHERE pr.perkara_id = p.perkara_id AND pr.tahapan_id = 10) AS didaftar
       FROM perkara p
       LEFT JOIN perkara_penetapan pen ON pen.perkara_id = p.perkara_id
       LEFT JOIN perkara_smartmajelis sm ON sm.perkara_id = p.perkara_id
      WHERE p.perkara_id = ? LIMIT 1`,
    [id]
  ).catch(() => []);
  return (Array.isArray(baris) && baris[0]) || null;
}

/**
 * Memastikan akun pejabatnya benar-benar ada di SIPP.
 *
 * Nama akun yang salah ketik akan menghasilkan penetapan yang tercatat atas
 * nama yang tidak ada - dan itu justru lebih buruk daripada tercatat atas nama
 * operator, sebab tidak ada seorang pun yang dapat dimintai keterangan.
 */
async function akunSipp(username) {
  const nama = cleanText(username);
  if (!nama) return null;
  const baris = await runQuery(
    `SELECT username, fullname FROM sys_users WHERE username = ? LIMIT 1`,
    [nama]
  ).catch(() => []);
  return (Array.isArray(baris) && baris[0]) || null;
}

/**
 * Petugas beserta kode dan NIP-nya, dari tabel acuannya sendiri.
 *
 * Dibaca, bukan diterima dari pemanggil: kode dan NIP tidak pernah ada di
 * papan penunjukan, dan membiarkan peramban mengirimnya berarti membiarkan
 * NIP siapa pun dituliskan ke berkas perkara. Yang datang dari peramban hanya
 * nomor barisnya.
 */
async function petugasUntuk(jenis, id) {
  const nomor = Number(id);
  if (!Number.isFinite(nomor) || nomor <= 0) return null;

  // Nama tabelnya berbeda dan tidak beraturan: panitera_pn tetapi jurusita
  // tanpa akhiran - sama seperti yang dibaca penunjukanService.
  const tabel = jenis === "ppp" ? "panitera_pn" : "jurusita";
  if (!(await sippSkemaService.tabelAda(tabel))) return null;

  const baris = await runQuery(
    `SELECT id, kode, nip, nama_gelar AS namaGelar, nama FROM ${tabel} WHERE id = ? LIMIT 1`,
    [nomor]
  ).catch(() => []);
  const satu = (Array.isArray(baris) && baris[0]) || null;
  if (!satu) return null;
  return {
    id: Number(satu.id) || 0,
    kode: cleanText(satu.kode),
    nip: cleanText(satu.nip),
    // Nama bergelar yang dipakai SIPP pada berkas perkara - "Munifa, S.H.",
    // bukan "Munifa".
    nama: cleanText(satu.namaGelar) || cleanText(satu.nama),
  };
}

/**
 * Ruang sidang beserta sifatnya.
 *
 * sidang_keliling DIBACA dari tabel acuannya, tidak diterima dari pemanggil:
 * menandai sidang keliling pada ruang dalam gedung - atau sebaliknya - membuat
 * laporan sidang keliling salah hitung, dan tidak ada yang menyadarinya sampai
 * laporan tahunan disusun.
 */
/**
 * Seluruh ruangan sidang yang masih aktif, untuk DIPILIH di layar.
 *
 * Benderanya ikut dikirim apa adanya - yang memutuskan sifatnya (dalam
 * gedung, keliling, atau terpadu) adalah src/lib/ruangan-sidang.ts di portal,
 * yang dapat diuji tanpa basis data.
 *
 * Diukur di PA Donggala: ruangan_sidang memuat 13 baris, tetapi 2.140 sidang
 * 2025-2026 memakai ruangan yang TIDAK ada di sana sama sekali - termasuk
 * "Ruang Sidang 1" yang paling banyak dipakai. Daftar ini karena itu daftar
 * PILIHAN, bukan daftar seluruh ruangan yang pernah dipakai.
 */
/**
 * ============================================================================
 * KATA DEPAN YANG DIBUANG UNTUK MENEMUKAN NAMA KECAMATANNYA
 * ============================================================================
 *
 * Nama ruangan sidang keliling di SIPP berbentuk "Sidang Keliling Sigi
 * Biromaru", "Terpadu Sindue Tombusabura". Yang menyebut TEMPATNYA hanya ekor
 * namanya - dan ekor itulah yang dicocokkan dengan nama KUA.
 *
 * Daftarnya diurut dari yang paling panjang supaya "Sidang Keliling" dibuang
 * sebagai satu kesatuan, bukan hanya kata "Sidang"-nya.
 */
const AWALAN_RUANGAN = [
  "sidang diluar gedung pengadilan",
  "sidang di luar gedung pengadilan",
  "sidang keliling",
  "ruang sidang elektronik",
  "ruang sidang",
  "terpadu",
  "sidang",
];

/** Nama kecamatan pada nama ruangan - "" bila tidak ada yang tersisa. */
function wilayahRuangan(nama) {
  let sisa = String(nama || "").trim().toLowerCase();
  for (const awalan of AWALAN_RUANGAN) {
    if (sisa.startsWith(awalan)) {
      sisa = sisa.slice(awalan.length).trim();
      break;
    }
  }
  // Ekor seperti "1", "2", atau "dalam gedung" bukan nama tempat.
  sisa = sisa.replace(/^\d+\s*/, "").replace(/\bdalam gedung\b/g, "").trim();
  return sisa ? sisa.toUpperCase() : "";
}

/**
 * ============================================================================
 * SEBERAPA SERING DIPAKAI - SUPAYA YANG DITAWARKAN LEBIH DAHULU YANG TERPAKAI
 * ============================================================================
 *
 * Terukur di PA Donggala atas sidang sejak 2025:
 *
 *   Sidang Keliling Sigi Biromaru   128 sidang, terakhir 1 Okt 2026
 *   Sidang Keliling Rio Pakava       40 sidang, terakhir 4 Sep 2026
 *   Sidang Keliling Sirenja          14 sidang, terakhir 19 Feb 2026
 *   Sidang Keliling Labuan            0 sidang
 *
 * Daftar yang diurut menurut id menempatkan Sirenja di atas Rio Pakava dan
 * Labuan - yang tidak pernah dipakai - di tengah. Petugas yang menetapkan
 * sidang keliling hampir selalu memilih Sigi Biromaru, dan ia harus
 * menemukannya di antara tiga belas baris yang urutannya tidak berarti apa-apa.
 */
async function pemakaianRuangan() {
  if (!(await sippSkemaService.tabelAda("perkara_jadwal_sidang"))) return new Map();
  const sejak = new Date();
  sejak.setMonth(sejak.getMonth() - 24);
  const baris = await runQuery(
    `SELECT ruangan_id AS id, COUNT(*) AS jumlah, MAX(tanggal_sidang) AS terakhir
       FROM perkara_jadwal_sidang
      WHERE tanggal_sidang >= ?
        AND ruangan_id IS NOT NULL
      GROUP BY ruangan_id`,
    [sejak.toISOString().slice(0, 10)]
  ).catch(() => []);
  const peta = new Map();
  for (const b of Array.isArray(baris) ? baris : []) {
    peta.set(Number(b.id) || 0, {
      dipakai: Number(b.jumlah) || 0,
      terakhirDipakai: b.terakhir ? String(b.terakhir).slice(0, 10) : "",
    });
  }
  return peta;
}

/**
 * KUA wilayah tiap ruangan - tempat sidang keliling sesungguhnya digelar.
 *
 * ref_kua memuat 5.936 KUA se-Indonesia; yang dicari hanya segelintir, jadi
 * namanya disusun dari nama ruangan lalu ditanyakan sekaligus dengan isian
 * bernomor - tidak ada jalan masuk bagi nilai luar ke dalam SQL-nya.
 */
async function kuaUntukRuangan(daftarWilayah) {
  const wilayah = [...new Set(daftarWilayah.filter(Boolean))];
  if (wilayah.length === 0) return new Map();
  if (!(await sippSkemaService.tabelAda("ref_kua"))) return new Map();

  const isian = wilayah.map(() => "?").join(",");
  const baris = await runQuery(
    `SELECT nama_kua AS nama, alamat, wilayah_kecamatan AS kecamatan
       FROM ref_kua
      WHERE UPPER(nama_kua) IN (${isian})`,
    wilayah.map((x) => `KUA ${x}`)
  ).catch(() => []);

  const peta = new Map();
  for (const b of Array.isArray(baris) ? baris : []) {
    const nama = cleanText(b.nama);
    const kunci = nama.toUpperCase().replace(/^KUA\s+/, "");
    if (!kunci || peta.has(kunci)) continue;
    peta.set(kunci, { nama, alamat: cleanText(b.alamat).slice(0, 200) });
  }
  return peta;
}

async function daftarRuangan() {
  if (!(await sippSkemaService.tabelAda("ruangan_sidang"))) return [];
  const baris = await runQuery(
    `SELECT id, kode, nama, sidang_keliling AS keliling
       FROM ruangan_sidang
      WHERE aktif = 'Y'
      ORDER BY kode ASC, nama ASC`
  ).catch(() => []);

  const mentah = (Array.isArray(baris) ? baris : []).map((b) => ({
    id: Number(b.id) || 0,
    kode: cleanText(b.kode),
    nama: cleanText(b.nama),
    benderaKeliling:
      b.keliling == null
        ? null
        : String(b.keliling) === "1" || String(b.keliling).toUpperCase() === "Y",
    aktif: true,
    wilayah: wilayahRuangan(b.nama),
  }));

  // Keduanya dibaca bersamaan, dan kegagalan salah satunya tidak menggagalkan
  // daftarnya: ruangan tanpa angka pemakaian tetap dapat dipilih.
  const [pakai, kua] = await Promise.all([
    pemakaianRuangan(),
    kuaUntukRuangan(mentah.map((x) => x.wilayah)),
  ]);

  return mentah.map((r) => {
    const angka = pakai.get(r.id) || { dipakai: 0, terakhirDipakai: "" };
    const tempat = r.wilayah ? kua.get(r.wilayah) || null : null;
    return {
      ...r,
      dipakai: angka.dipakai,
      terakhirDipakai: angka.terakhirDipakai,
      kua: tempat ? tempat.nama : "",
      kuaAlamat: tempat ? tempat.alamat : "",
    };
  });
}

async function ruanganUntuk(id) {
  const nomor = Number(id);
  if (!Number.isFinite(nomor) || nomor <= 0) return null;
  if (!(await sippSkemaService.tabelAda("ruangan_sidang"))) return null;

  const baris = await runQuery(
    `SELECT id, nama, sidang_keliling AS keliling FROM ruangan_sidang WHERE id = ? AND aktif = 'Y' LIMIT 1`,
    [nomor]
  ).catch(() => []);
  const satu = (Array.isArray(baris) && baris[0]) || null;
  if (!satu) return null;
  return {
    id: Number(satu.id) || 0,
    nama: cleanText(satu.nama),
    keliling: String(satu.keliling) === "1" || String(satu.keliling).toUpperCase() === "Y",
  };
}

/** Hakim beserta NIP-nya - dibutuhkan perkara_hakim_pn. */
async function hakimUntuk(daftarId) {
  const id = (daftarId || []).map((x) => Number(x)).filter((x) => Number.isFinite(x) && x > 0);
  if (id.length === 0) return [];
  const isian = id.map(() => "?").join(",");
  const baris = await runQuery(
    `SELECT id AS hakimId, kode, nip, nama_gelar AS nama FROM hakim_pn WHERE id IN (${isian})`,
    id
  ).catch(() => []);
  const peta = new Map((baris || []).map((x) => [Number(x.hakimId), x]));
  // Urutan mengikuti yang diminta, bukan urutan basis data - urutan itulah yang
  // membedakan ketua dari anggota.
  return id.map((x) => peta.get(x)).filter(Boolean);
}

/**
 * ============================================================================
 * RENCANA TULIS - DISUSUN LEBIH DAHULU, DIPERIKSA, BARU DIJALANKAN
 * ============================================================================
 *
 * Memulangkan daftar pernyataan lengkap beserta nilainya. Tidak satu pun
 * dijalankan di sini. Bentuk ini yang membuat perbuatannya dapat dibaca
 * manusia sebelum terjadi - dan dapat diuji tanpa menyentuh SIPP sama sekali.
 */
/**
 * Pencarian jenis yang tidak mempersoalkan besar-kecil huruf.
 *
 * Sebelumnya jenisnya dikecilkan lalu dicari langsung pada JEJAK_PROSES.
 * Itu bekerja selama seluruh kuncinya satu kata - "pmh", "ppp", "pjs", "phs" -
 * lalu patah diam-diam begitu ada kunci berhuruf besar di tengah: "dataUmum"
 * menjadi "dataumum" dan tidak pernah ketemu, dengan alasan
 * "jenis_tidak_didukung" yang menunjuk ke arah yang salah.
 *
 * Petanya disusun sekali dari kunci yang ada, sehingga menambah jenis baru
 * tidak menuntut mengingat aturan ini lagi.
 */
const JENIS_MENURUT_HURUF_KECIL = new Map(
  Object.keys(JEJAK_PROSES).map((kunci) => [kunci.toLowerCase(), kunci])
);

async function susunRencanaTulis(minta) {
  const diminta = String((minta && minta.jenis) || "").toLowerCase();
  const jenis = JENIS_MENURUT_HURUF_KECIL.get(diminta) || "";
  const jejak = JEJAK_PROSES[jenis];
  if (!jejak) return { ok: false, alasan: "jenis_tidak_didukung", jenis: diminta };

  const perkara = await keadaanPerkara(minta.perkaraId);
  if (!perkara) return { ok: false, alasan: "perkara_tidak_ketemu" };

  if (!tanggalSah(minta.tanggalPenetapan)) {
    return { ok: false, alasan: "tanggal_penetapan_tidak_sah" };
  }

  const akun = await akunSipp(minta.olehUsername);
  if (!akun) {
    // Nama akunnya IKUT disebutkan. Tanpa itu, yang membacanya hanya tahu
    // "akun pejabat tidak ketemu" dan tidak punya satu pun petunjuk akun mana
    // yang dicari - padahal yang dicari datang dari pemetaan jabatan ALETA,
    // dan di situlah perbaikannya.
    return {
      ok: false,
      alasan: "akun_pejabat_tidak_ketemu",
      username: String(minta.olehUsername || ""),
    };
  }

  const operator = cleanText(minta.operator);
  if (!operator) return { ok: false, alasan: "operator_tidak_disebut" };

  // ==========================================================================
  // KEEMPAT LANGKAH SELALU PADA TANGGAL YANG SAMA
  // ==========================================================================
  //
  // PMH, PPP, PJS, dan PHS adalah satu rangkaian pada satu hari kerja.
  // Tanggal yang berpencar membuat perkaranya salah dihitung pada tiap laporan
  // yang mengelompokkan penetapan per hari - dan salahnya tidak berbunyi.
  //
  // Karena itu tanggal langkah yang sudah tertulis menjadi pengikat: yang
  // menyusul harus memakai tanggal yang sama, dan yang berbeda ditolak dengan
  // menyebutkan tanggal yang seharusnya.
  // Yang mengikat adalah tanggal langkah LAIN, bukan langkah ini sendiri.
  // Langkah yang sudah ada ditolak oleh penjaganya sendiri dengan sebab yang
  // jauh lebih menolong - "pmh_sudah_ada" menyuruh petugas membatalkan dulu,
  // sedangkan "tanggal tidak sama" mengirimnya membetulkan tanggal yang tidak
  // ada salahnya.
  //
  // ==========================================================================
  // YANG DITOLAK HANYA YANG MUSTAHIL, BUKAN YANG SEKADAR BERBEDA
  // ==========================================================================
  //
  // Penjaga ini dahulu menolak MENTAH tiap langkah yang tanggalnya berbeda
  // dari langkah lain yang sudah ada. Terukur pada SIPP satker, itu menolak
  // satu dari lima perkara yang sah:
  //
  //     penetapan 2026 yang punya PMH        800
  //     PPP setanggal dengan PMH             637   (80%)
  //     PPP BEDA tanggal                     161   (20%)
  //     PHS setanggal dengan PMH             679   (85%)
  //     PHS BEDA tanggal                     119   (15%)
  //
  //     selisih PMH -> PPP yang paling sering +1 hari, lalu +3, +2, +4
  //
  // Akibatnya perkara yang PMH-nya ditetapkan kemarin tidak dapat dilanjutkan
  // ke PPP/PJS/PHS hari ini SAMA SEKALI - padahal itu praktik yang biasa, dan
  // penetapan memang ditanggali hari ia ditandatangani.
  //
  // Sekarang yang ditolak hanya yang MUSTAHIL: langkah yang ditanggali lebih
  // awal daripada langkah yang sudah ada. PPP tidak dapat ditetapkan sebelum
  // PMH-nya ada; itu bukan selera, itu urutan.
  //
  // Yang setanggal atau sesudahnya diterima, dan bedanya dibawa ke panel
  // sebagai CATATAN - lihat catatanTanggal di bawah. Ditelan diam-diam berarti
  // yang menekan tombol tidak tahu penetapannya bertanggal lain daripada
  // PMH-nya, dan baru menyadarinya ketika laporan per hari tidak cocok.
  //
  // Tidak ada tanggal yang dikarang mundur agar cocok. Itu akan memalsukan
  // tanggal penetapan - dokumen hukum - demi kerapian angka.
  const tanggalLangkahLain = ["pmh", "ppp", "pjs", "phs"]
    .filter((x) => x !== jenis)
    .map((x) => ({ jenis: x, tanggal: tanggalIso(perkara[x]) }))
    .filter((x) => x.tanggal);

  const palingAwal = tanggalLangkahLain
    .map((x) => x.tanggal)
    .sort()
    .find(Boolean);

  if (palingAwal && minta.tanggalPenetapan < palingAwal) {
    return {
      ok: false,
      alasan: "tanggal_penetapan_mendahului",
      seharusnya: palingAwal,
      diminta: minta.tanggalPenetapan,
    };
  }

  // Catatan, bukan penolakan. Kosong ketika seluruhnya setanggal - keadaan
  // yang paling sering, dan tidak ada yang perlu dikatakan tentangnya.
  const catatanTanggal = tanggalLangkahLain
    .filter((x) => x.tanggal !== minta.tanggalPenetapan)
    .map(
      (x) =>
        `${x.jenis.toUpperCase()} bertanggal ${x.tanggal}, sedangkan langkah ini ${minta.tanggalPenetapan}.`
    );

  const saatServer = await waktuBasisData();
  // Jam yang DICATAT ke SIPP - berjarak satu sampai sepuluh menit tiap
  // langkah, tidak pernah melampaui jam sekarang. Jam peladen tidak disentuh.
  const saat = waktuLangkah({
    perkaraId: perkara.perkaraId,
    tanggalPenetapan: minta.tanggalPenetapan,
    jenis,
    saatServer,
    // Lantai jamnya: penetapan tidak pernah mendahului Pendaftaran Perkara.
    didaftar: perkara.didaftar,
  });
  // Butir 14: alamat yang tidak diteruskan DIKOSONGKAN, tidak dikarang "127.0.0.1".
  const ip = String(minta.ip || "");
  const langkah = [];
  // Andaian yang dipakai menyusun rencana ini - kosong pada keadaan biasa.
  // Diteruskan apa adanya ke panel supaya yang membacanya tahu rencana ini
  // dinilai atas keadaan yang BELUM ada, bukan yang sudah.
  const andaian = [];

  // ---- PMH ---------------------------------------------------------------
  if (jenis === "pmh") {
    if (perkara.pmh) return { ok: false, alasan: "pmh_sudah_ada" };

    const hakim = await hakimUntuk(minta.hakimId);
    if (hakim.length === 0) return { ok: false, alasan: "hakim_tidak_ketemu" };
    if (hakim.length !== (minta.hakimId || []).length) {
      return { ok: false, alasan: "sebagian_hakim_tidak_ketemu" };
    }
    if (new Set(hakim.map((x) => x.hakimId)).size !== hakim.length) {
      return { ok: false, alasan: "hakim_kembar" };
    }

    // Bentuk kolom gabungan ditiru dari baris SIPP yang sudah ada:
    // id dipisah koma, kode dipisah garis tegak, nama dipisah </br>.
    const idGabung = hakim.map((x) => x.hakimId).join(",");
    const kodeGabung = hakim.map((x) => x.kode || "").join("|");
    const namaGabung = hakim.map((x) => x.nama).join("</br>");
    const teksGabung = hakim
      .map((x, i) => `${i === 0 ? "Hakim Ketua" : `Hakim Anggota ${i}`}: ${x.nama}`)
      .join("</br>");

    const nilaiPenetapan = {
      perkara_id: perkara.perkaraId,
      penetapan_majelis_hakim: minta.tanggalPenetapan,
      majelis_hakim_id: idGabung,
      majelis_hakim_kode: kodeGabung,
      majelis_hakim_nama: namaGabung,
      majelis_hakim_text: teksGabung,
      diinput_oleh: akun.username,
      diinput_tanggal: saat,
    };

    langkah.push({
      tabel: "perkara_penetapan",
      aksi: perkara.adaPenetapan ? "UPDATE" : "INSERT",
      sql: perkara.adaPenetapan
        ? `UPDATE perkara_penetapan SET penetapan_majelis_hakim = ?, majelis_hakim_id = ?,
             majelis_hakim_kode = ?, majelis_hakim_nama = ?, majelis_hakim_text = ?,
             diperbaharui_oleh = ?, diperbaharui_tanggal = ?
           WHERE perkara_id = ?`
        : `INSERT INTO perkara_penetapan
             (perkara_id, penetapan_majelis_hakim, majelis_hakim_id, majelis_hakim_kode,
              majelis_hakim_nama, majelis_hakim_text, diinput_oleh, diinput_tanggal)
           VALUES (?,?,?,?,?,?,?,?)`,
      params: perkara.adaPenetapan
        ? [
            minta.tanggalPenetapan,
            idGabung,
            kodeGabung,
            namaGabung,
            teksGabung,
            akun.username,
            saat,
            perkara.perkaraId,
          ]
        : [
            perkara.perkaraId,
            minta.tanggalPenetapan,
            idGabung,
            kodeGabung,
            namaGabung,
            teksGabung,
            akun.username,
            saat,
          ],
      keterangan: `penetapan majelis ${kodeGabung}`,
    });
    langkah.push(
      barisAudit({
        username: akun.username,
        tabel: "perkara_penetapan",
        formulir: jejak.formulir,
        aksi: perkara.adaPenetapan ? "UPDATE" : "INSERT",
        nilai: nilaiPenetapan,
        ip,
        saat,
      })
    );

    // ======================================================================
    // SMART MAJELIS - BARIS YANG SELAMA INI TIDAK PERNAH DITULIS
    // ======================================================================
    //
    // SIPP mencatat di perkara_smartmajelis setiap kali majelis ditetapkan
    // BERBEDA dari susunan yang direkomendasikan SK majelis tetap, beserta
    // sebabnya. Itulah yang dibaca laporan Smart Majelis, dan perkara yang
    // majelisnya ditetapkan ALETA sama sekali tidak muncul di sana.
    //
    // Bentuknya ditiru persis dari addMajelis_c.php: pada keadaan "majelis
    // diubah dari rekomendasi" SIPP menyimpan hakim_id2, status, tanggal, dan
    // keterangan - TANPA menyentuh majelis_id maupun hakim_id, yang memang
    // milik SK-nya. Baris yang sudah ada diperbarui, bukan disisipkan kedua
    // kalinya.
    //
    // status 2 = susunannya ditetapkan di luar rekomendasi otomatis. Itu yang
    // benar untuk ALETA: giliran majelis dihitung ALETA sendiri, bukan diambil
    // dari rekomendasi Smart Majelis SIPP.
    // Sebab yang DITULISKAN ke kolom keterangan SIPP, dan karena itu tidak
    // boleh menyebut ALETA sama sekali. Yang dibaca laporan Smart Majelis
    // adalah alasan majelisnya menyimpang dari rekomendasi - dan alasan yang
    // sesungguhnya memang giliran serta beban perkara, bukan alat yang
    // dipakai mengetiknya.
    // ======================================================================
    // SESUAI REKOMENDASI (STATUS 1) BILA SUSUNANNYA MAJELIS SK
    // ======================================================================
    //
    // Diukur pada 1.112 perkara PA Donggala tahun 2026 yang ditetapkan
    // tangan: 782 memakai tombol Smart Majelis, dan yang susunannya diterima
    // apa adanya berbaris status 1 - majelis_id menunjuk ref_majelis_tetap,
    // hakim_id berisi susunan itu, hakim_id2 dan keterangan kosong. Sejak
    // ALETA memilih majelis dari SK Ketua, susunan yang ditetapkannya adalah
    // susunan yang sama dengan ref_majelis_tetap; menulisnya sebagai "di
    // luar rekomendasi" membuat laporan Smart Majelis menghitung tiap perkara
    // ALETA sebagai penyimpangan yang tidak pernah terjadi.
    //
    // Yang tidak ada di ref - hakim tunggal di luar dispensasi kawin, atau
    // susunan darurat - tetap ditulis sebagai status 2 beserta sebabnya,
    // seperti dahulu.
    const majelisTetap = await majelisTetapUntuk(
      hakim.map((x) => x.hakimId),
      perkara.nomorPerkara,
      perkara.jenisPerkaraId
    );
    if (majelisTetap) {
      const idMenurutRef = majelisTetap.hakim.join(",");
      langkah.push({
        tabel: "perkara_smartmajelis",
        aksi: perkara.adaSmartMajelis ? "UPDATE" : "INSERT",
        sql: perkara.adaSmartMajelis
          ? `UPDATE perkara_smartmajelis SET majelis_id = ?, hakim_id = ?, hakim_id2 = NULL, status = ?,
                    tanggal = ?, keterangan = NULL
             WHERE perkara_id = ?`
          : `INSERT INTO perkara_smartmajelis (perkara_id, majelis_id, hakim_id, hakim_id2, status, tanggal, keterangan)
             VALUES (?,?,?,NULL,?,?,NULL)`,
        params: perkara.adaSmartMajelis
          ? [majelisTetap.majelisId, idMenurutRef, SMART_MAJELIS_SESUAI_REKOMENDASI, saat, perkara.perkaraId]
          : [perkara.perkaraId, majelisTetap.majelisId, idMenurutRef, SMART_MAJELIS_SESUAI_REKOMENDASI, saat],
        keterangan: `smart majelis: sesuai majelis tetap ${majelisTetap.majelisId}`,
      });
    } else {
      const sebabMajelis =
        cleanText(minta.sebabMajelis) ||
        "Ditetapkan menurut giliran majelis dan pemerataan beban perkara";
      const nilaiSmart = {
        perkara_id: perkara.perkaraId,
        hakim_id2: idGabung,
        status: SMART_MAJELIS_DI_LUAR_REKOMENDASI,
        tanggal: saat,
        keterangan: sebabMajelis.slice(0, 1000),
      };
      langkah.push({
        tabel: "perkara_smartmajelis",
        aksi: perkara.adaSmartMajelis ? "UPDATE" : "INSERT",
        sql: perkara.adaSmartMajelis
          ? `UPDATE perkara_smartmajelis SET hakim_id2 = ?, status = ?, tanggal = ?, keterangan = ?
             WHERE perkara_id = ?`
          : `INSERT INTO perkara_smartmajelis (perkara_id, hakim_id2, status, tanggal, keterangan)
             VALUES (?,?,?,?,?)`,
        params: perkara.adaSmartMajelis
          ? [idGabung, SMART_MAJELIS_DI_LUAR_REKOMENDASI, saat, nilaiSmart.keterangan, perkara.perkaraId]
          : [perkara.perkaraId, idGabung, SMART_MAJELIS_DI_LUAR_REKOMENDASI, saat, nilaiSmart.keterangan],
        keterangan: `smart majelis: ${sebabMajelis}`,
      });
    }
    // Tanpa baris audit: sama seperti perkara_proses, SIPP tidak pernah
    // mencatat tabel ini di sys_audittrail - nol baris sejak 2016. Lihat
    // catatan pada bagian Riwayat Perkara di bawah. Jejak "Smart Majelis" di
    // Audit Trail justru ada pada JUDUL baris perkara_hakim_pn di bawah ini.

    hakim.forEach((orang, urutan) => {
      const nilaiHakim = {
        perkara_id: perkara.perkaraId,
        tahapan_id: TAHAPAN_TINGKAT_PERTAMA,
        tanggal_penetapan: minta.tanggalPenetapan,
        urutan: urutan + 1,
        // 1 ketua, 2 anggota - dibaca dari baris SIPP yang sudah ada.
        jabatan_hakim_id: urutan === 0 ? 1 : 2,
        jabatan_hakim_nama: urutan === 0 ? "Hakim Ketua" : "Hakim Anggota",
        hakim_id: orang.hakimId,
        hakim_kode: orang.kode || "",
        hakim_nip: orang.nip || "",
        hakim_nama: orang.nama,
        aktif: "Y",
        diinput_oleh: akun.username,
        diinput_tanggal: saat,
      };
      langkah.push({
        tabel: "perkara_hakim_pn",
        aksi: "INSERT",
        sql:
          `INSERT INTO perkara_hakim_pn
             (perkara_id, tahapan_id, tanggal_penetapan, urutan, jabatan_hakim_id,
              jabatan_hakim_nama, hakim_id, hakim_kode, hakim_nip, hakim_nama, aktif,
              diinput_oleh, diinput_tanggal)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        params: [
          perkara.perkaraId,
          TAHAPAN_TINGKAT_PERTAMA,
          minta.tanggalPenetapan,
          urutan + 1,
          urutan === 0 ? 1 : 2,
          urutan === 0 ? "Hakim Ketua" : "Hakim Anggota",
          orang.hakimId,
          orang.kode || "",
          orang.nip || "",
          orang.nama,
          "Y",
          akun.username,
          saat,
        ],
        keterangan: `${urutan === 0 ? "ketua" : `anggota ${urutan}`}: ${orang.nama}`,
      });
      langkah.push(
        barisAudit({
          username: akun.username,
          tabel: "perkara_hakim_pn",
          formulir: jejak.formulir,
          // Persis tulisan SIPP saat petugas memakai tombol Smart Majelis:
          // 782 dari 1.112 perkara 2026 di PA Donggala berjudul begini, dan
          // hanya ketiga baris hakim_pn yang membawanya - baris
          // perkara_penetapan dan perkara di sebelahnya tidak.
          judulHalaman: ` Smart Majelis ${jejak.formulir}`,
          aksi: "INSERT",
          nilai: nilaiHakim,
          ip,
          saat,
        })
      );
    });
  }

  // ---- PPP dan PJS -------------------------------------------------------
  if (jenis === "ppp" || jenis === "pjs") {
    const ppp = jenis === "ppp";
    if (ppp && perkara.ppp) return { ok: false, alasan: "ppp_sudah_ada" };
    if (!ppp && perkara.pjs) return { ok: false, alasan: "pjs_sudah_ada" };

    const petugas = await petugasUntuk(jenis, minta.petugasId);
    if (!petugas) return { ok: false, alasan: "petugas_tidak_ketemu" };
    const orangId = petugas.id;
    const orangNama = petugas.nama;

    const tabelPetugas = ppp ? "perkara_panitera_pn" : "perkara_jurusita";
    const kolomTanggal = ppp ? "penetapan_panitera_pengganti" : "penetapan_jurusita";
    const kolomId = ppp ? "panitera_pengganti_id" : "jurusita_id";
    const kolomTeks = ppp ? "panitera_pengganti_text" : "jurusita_text";
    const sebutan = ppp ? "Panitera Pengganti" : "Juru Sita Pengganti";
    const teks = `${sebutan}: ${orangNama}`;

    if (!(await sippSkemaService.tabelAda(tabelPetugas))) {
      return { ok: false, alasan: `tabel_${tabelPetugas}_tidak_ada` };
    }

    langkah.push({
      tabel: "perkara_penetapan",
      aksi: perkara.adaPenetapan ? "UPDATE" : "INSERT",
      sql: perkara.adaPenetapan
        ? `UPDATE perkara_penetapan SET ${kolomTanggal} = ?, ${kolomId} = ?, ${kolomTeks} = ?,
             diperbaharui_oleh = ?, diperbaharui_tanggal = ? WHERE perkara_id = ?`
        : `INSERT INTO perkara_penetapan
             (perkara_id, ${kolomTanggal}, ${kolomId}, ${kolomTeks}, diinput_oleh, diinput_tanggal)
           VALUES (?,?,?,?,?,?)`,
      params: perkara.adaPenetapan
        ? [minta.tanggalPenetapan, String(orangId), teks, akun.username, saat, perkara.perkaraId]
        : [perkara.perkaraId, minta.tanggalPenetapan, String(orangId), teks, akun.username, saat],
      keterangan: teks,
    });
    langkah.push(
      barisAudit({
        username: akun.username,
        tabel: "perkara_penetapan",
        formulir: jejak.formulir,
        aksi: perkara.adaPenetapan ? "UPDATE" : "INSERT",
        nilai: {
          perkara_id: perkara.perkaraId,
          [kolomTanggal]: minta.tanggalPenetapan,
          [kolomId]: orangId,
          [kolomTeks]: teks,
          diinput_oleh: akun.username,
          diinput_tanggal: saat,
        },
        ip,
        saat,
      })
    );

    // Kode dan NIP ikut ditulis, sebagaimana SIPP menulisnya sendiri. Baris
    // yang tanpa NIP tetap tersimpan, tetapi laporan yang membacanya menurut
    // NIP akan melewatkannya - kekurangan yang tidak berbunyi sampai laporan
    // tahunan disusun.
    const kolomOrang = ppp ? "panitera_id" : "jurusita_id";
    const kolomKode = ppp ? "panitera_kode" : "jurusita_kode";
    const kolomNip = ppp ? "panitera_nip" : "jurusita_nip";
    const kolomOrangNama = ppp ? "panitera_nama" : "jurusita_nama";
    const nilaiPetugas = {
      perkara_id: perkara.perkaraId,
      tahapan_id: TAHAPAN_TINGKAT_PERTAMA,
      tanggal_penetapan: minta.tanggalPenetapan,
      urutan: 1,
      [kolomOrang]: orangId,
      [kolomKode]: petugas.kode,
      [kolomNip]: petugas.nip,
      [kolomOrangNama]: orangNama,
      aktif: "Y",
      diinput_oleh: akun.username,
      diinput_tanggal: saat,
    };
    // perkara_jurusita tidak memakai auto_increment - id-nya dihitung sendiri
    // sesaat sebelum ditulis. Tanpa ini, perkara kedua dan seterusnya selalu
    // bertabrakan pada id=0.
    const idSendiri = TABEL_ID_DIHITUNG.has(tabelPetugas);
    langkah.push({
      tabel: tabelPetugas,
      aksi: "INSERT",
      sql: idSendiri
        ? `INSERT INTO ${tabelPetugas}
             (id, perkara_id, tahapan_id, tanggal_penetapan, urutan, ${kolomOrang}, ${kolomKode},
              ${kolomNip}, ${kolomOrangNama}, aktif, diinput_oleh, diinput_tanggal)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`
        : `INSERT INTO ${tabelPetugas}
             (perkara_id, tahapan_id, tanggal_penetapan, urutan, ${kolomOrang}, ${kolomKode},
              ${kolomNip}, ${kolomOrangNama}, aktif, diinput_oleh, diinput_tanggal)
           VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      params: [
        ...(idSendiri ? [0] : []),
        perkara.perkaraId,
        TAHAPAN_TINGKAT_PERTAMA,
        minta.tanggalPenetapan,
        1,
        orangId,
        petugas.kode,
        petugas.nip,
        orangNama,
        "Y",
        akun.username,
        saat,
      ],
      // Penjalannya yang mengisi id-nya, tepat sebelum pernyataan ini
      // dijalankan - bukan saat rencana disusun, supaya jaraknya sesempit
      // mungkin dari penulisan yang sesungguhnya.
      idDihitung: idSendiri ? { tabel: tabelPetugas, posisiParam: 0 } : undefined,
      keterangan: `${sebutan.toLowerCase()}: ${orangNama}`,
    });
    langkah.push(
      barisAudit({
        username: akun.username,
        tabel: tabelPetugas,
        formulir: jejak.formulir,
        aksi: "INSERT",
        nilai: nilaiPetugas,
        ip,
        saat,
      })
    );
  }

  // ---- PHS ---------------------------------------------------------------
  //
  // Yang paling berlapis dari keempatnya. SIPP menyentuh empat tabel, dan satu
  // di antaranya BERGANTUNG pada hasil yang sebelumnya: baris jadwal sidang
  // disisipkan lebih dahulu, lalu id-nya dipakai baris penetapan hari sidang.
  //
  // Ketergantungan itu tidak dapat disusun sebagai nilai tetap - id barunya
  // belum ada saat rencana dibuat. Karena itu langkahnya menandai dirinya
  // dengan isiDariLangkah, dan penjalannya yang mengisikan id itu. Pada
  // hasil kering, tempatnya terbaca sebagai "<id jadwal sidang baru>".
  if (jenis === "phs") {
    // ========================================================================
    // UJI KERING DINILAI ATAS KEADAAN YANG AKAN ADA, BUKAN YANG ADA SEKARANG
    // ========================================================================
    //
    // Hari sidang ditetapkan ketua majelis. Selama majelisnya belum ada, tidak
    // ada yang berwenang menetapkannya - dan SIPP pun menolaknya. Pagar itu
    // benar, dan tetap berlaku penuh pada penulisan sungguhan.
    //
    // Tetapi pada UJI KERING ia memagari yang salah. Uji kering dijalankan
    // SEBELUM satu baris pun ditulis, jadi pada perkara yang baru didaftarkan
    // PMH memang belum ada - dan tidak akan pernah ada selama uji keringnya
    // sendiri yang menghalangi. Akibatnya, atas perkara yang justru paling
    // lazim, keempat langkah tidak pernah sampai ke penulisan: PMH, PPP, dan
    // PJS lulus, PHS ditolak "pmh_belum_ada", panel menyimpulkan rencananya
    // belum siap, dan tombol "Tuliskan ke SIPP" tidak pernah menyala. Tidak
    // ada satu pun penetapan yang tertulis, dan sebabnya tidak menunjuk ke
    // sini sama sekali.
    //
    // Karena itu: bila pemanggilnya menyatakan PMH ditulis LEBIH DAHULU dalam
    // rantai yang sama, uji kering menilai PHS seolah-olah PMH sudah ada, dan
    // mengatakan andaian itu apa adanya. Pada penulisan sungguhan pemanggil
    // benar-benar menulis PMH lebih dulu dan berhenti bila PMH gagal, sehingga
    // saat PHS dijalankan majelisnya memang sudah tersimpan.
    const pmhMenyusul =
      minta.kering === true &&
      Array.isArray(minta.rantaiSebelum) &&
      minta.rantaiSebelum.map((x) => String(x).toLowerCase()).includes("pmh");

    if (!perkara.pmh && !pmhMenyusul) {
      return { ok: false, alasan: "pmh_belum_ada" };
    }
    if (!perkara.pmh) {
      andaian.push(
        "PMH belum ada di SIPP saat rencana ini disusun. PHS dinilai dengan andaian PMH ditulis lebih dulu pada rantai yang sama - dan bila PMH gagal, PHS tidak dijalankan sama sekali."
      );
    }
    if (perkara.phs) return { ok: false, alasan: "phs_sudah_ada" };
    if (!tanggalSah(minta.tanggalSidang)) return { ok: false, alasan: "tanggal_sidang_tidak_sah" };
    if (minta.tanggalSidang < minta.tanggalPenetapan) {
      return { ok: false, alasan: "sidang_mendahului_penetapan" };
    }

    const ruangan = await ruanganUntuk(minta.ruanganId || JADWAL_BAWAAN.ruanganId);
    if (!ruangan) return { ok: false, alasan: "ruangan_tidak_ketemu" };

    const jam = /^\d{2}:\d{2}(:\d{2})?$/.test(String(minta.jamSidang || ""))
      ? String(minta.jamSidang).length === 5
        ? `${minta.jamSidang}:00`
        : String(minta.jamSidang)
      : JADWAL_BAWAAN.jamSidang;

    // ======================================================================
    // URUTANNYA DITIRU, BUKAN DIPILIH SENDIRI
    // ======================================================================
    //
    // SIPP menulis perkara_penetapan LEBIH DAHULU, baru jadwal sidang dan
    // penetapan hari sidangnya - terbaca dari sys_audittrail satker, nomor
    // baris 501137 sampai 501141 pada perkara 566:
    //
    //   perkara_penetapan UPDATE, perkara_jadwal_sidang INSERT,
    //   perkara_penetapan_hari_sidang INSERT, perkara UPDATE, perkara UPDATE
    //
    // Kelimanya berbagi detik yang sama, jadi yang membedakan hanya urutan
    // nomornya - dan di layar Audit Trail urutan itulah yang terlihat.
    langkah.push({
      tabel: "perkara_penetapan",
      aksi: "UPDATE",
      sql:
        `UPDATE perkara_penetapan SET penetapan_hari_sidang = ?, sidang_pertama = ?,
           diperbaharui_oleh = ?, diperbaharui_tanggal = ? WHERE perkara_id = ?`,
      params: [
        minta.tanggalPenetapan,
        minta.tanggalSidang,
        akun.username,
        saat,
        perkara.perkaraId,
      ],
      keterangan: `hari sidang pertama ${minta.tanggalSidang}`,
    });
    langkah.push(
      barisAudit({
        username: akun.username,
        tabel: "perkara_penetapan",
        formulir: jejak.formulir,
        aksi: "UPDATE",
        nilai: {
          perkara_id: perkara.perkaraId,
          penetapan_hari_sidang: minta.tanggalPenetapan,
          sidang_pertama: minta.tanggalSidang,
          diperbaharui_oleh: akun.username,
          diperbaharui_tanggal: saat,
        },
        ip,
        saat,
      })
    );
    const nilaiJadwal = {
      perkara_id: perkara.perkaraId,
      urutan: 1,
      tanggal_sidang: minta.tanggalSidang,
      jam_sidang: jam,
      agenda: JADWAL_BAWAAN.agenda,
      ruangan_id: ruangan.id,
      ruangan: ruangan.nama,
      sidang_keliling: ruangan.keliling ? "Y" : "T",
      // Sidang yang baru ditetapkan belum ditunda apa pun.
      ditunda: "T",
      sifat_sidang: "Y",
      diinput_oleh: akun.username,
      diinput_tanggal: saat,
    };

    langkah.push({
      tabel: "perkara_jadwal_sidang",
      aksi: "INSERT",
      // perkara_jadwal_sidang pun tanpa auto_increment. Di sini akibatnya
      // lebih halus: id=0 membuat insertId ikut 0, dan langkah berikutnya -
      // yang menunggu id ini untuk menunjuk barisnya - membacanya sebagai
      // "belum ada" lalu berhenti. Jadwal sidangnya tertulis, penetapan hari
      // sidangnya tidak.
      sql:
        `INSERT INTO perkara_jadwal_sidang
           (id, perkara_id, verzet, keberatan, ikrar_talak, urutan, tanggal_sidang, jam_sidang,
            sampai_jam, agenda, ruangan_id, ruangan, sidang_keliling, ditunda, sifat_sidang,
            diinput_oleh, diinput_tanggal)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      idDihitung: { tabel: "perkara_jadwal_sidang", posisiParam: 0 },
      params: [
        0,
        perkara.perkaraId,
        "T",
        "T",
        "T",
        1,
        minta.tanggalSidang,
        jam,
        JADWAL_BAWAAN.sampaiJam,
        JADWAL_BAWAAN.agenda,
        ruangan.id,
        ruangan.nama,
        ruangan.keliling ? "Y" : "T",
        "T",
        "Y",
        akun.username,
        saat,
      ],
      keterangan: `jadwal sidang pertama ${minta.tanggalSidang} ${jam} di ${ruangan.nama}`,
    });
    const indeksJadwal = langkah.length - 1;
    langkah.push(
      barisAudit({
        username: akun.username,
        tabel: "perkara_jadwal_sidang",
        formulir: jejak.formulir,
        aksi: "INSERT",
        nilai: nilaiJadwal,
        // id barisnya dihitung sendiri saat langkahnya dijalankan - lihat
        // idDihitung. Nilainya belum ada di sini, jadi tempatnya ditandai
        // dan diisi jalankanRencana.
        kunciSendiri: "id=#ID#",
        kunciDariLangkah: { "#ID#": indeksJadwal },
        ip,
        saat,
      })
    );

    langkah.push({
      tabel: "perkara_penetapan_hari_sidang",
      aksi: "INSERT",
      sql:
        `INSERT INTO perkara_penetapan_hari_sidang
           (perkara_id, tahapan_id, jadwalsidang_id, tanggal_penetapan, tanggal_sidang,
            keterangan, diinput_oleh, diinput_tanggal)
         VALUES (?,?,?,?,?,?,?,?)`,
      // Tempat ketiga menampung id baris jadwal sidang yang baru disisipkan.
      params: [
        perkara.perkaraId,
        jejak.tahapanId,
        null,
        minta.tanggalPenetapan,
        minta.tanggalSidang,
        "Penetapan Hari Sidang Pertama",
        akun.username,
        saat,
      ],
      isiDariLangkah: { indeks: indeksJadwal, posisiParam: 2 },
      keterangan: "penetapan hari sidang pertama",
    });
    const indeksHariSidang = langkah.length - 1;
    langkah.push(
      barisAudit({
        username: akun.username,
        tabel: "perkara_penetapan_hari_sidang",
        formulir: jejak.formulir,
        aksi: "INSERT",
        // Tabel ini ber-auto_increment, jadi id-nya baru ada sesudah barisnya
        // ditulis. Ditandai di sini, diisi dari insertId.
        kunciSendiri: "id=#ID#",
        kunciDariLangkah: { "#ID#": indeksHariSidang, "#IDJADWAL#": indeksJadwal },
        nilai: {
          perkara_id: perkara.perkaraId,
          tahapan_id: jejak.tahapanId,
          jadwalsidang_id: "#IDJADWAL#",
          tanggal_penetapan: minta.tanggalPenetapan,
          tanggal_sidang: minta.tanggalSidang,
          keterangan: "Penetapan Hari Sidang Pertama",
          diinput_oleh: akun.username,
          diinput_tanggal: saat,
        },
        ip,
        saat,
      })
    );

  }

  // ---- DATA UMUM dari berkas gugatan --------------------------------------
  //
  // ==========================================================================
  // DUA TABEL, DAN SATU DI ANTARANYA TIDAK PERNAH DIAUDIT SIPP
  // ==========================================================================
  //
  // Data Umum tersebar di dua tempat:
  //
  //   perkara                   tanggal_surat, nomor_surat
  //   perkara_data_pernikahan   tgl_nikah, tgl_kutipan_akta_nikah,
  //                             no_kutipan_akta_nikah, kua_tempat_nikah
  //
  // Diperiksa pada sys_audittrail: perkara_data_pernikahan TIDAK PERNAH
  // diaudit SIPP - nol baris sepanjang masa. ALETA tetap menuliskan baris
  // auditnya. Itu penyimpangan dari kebiasaan SIPP, dan disengaja: seluruh
  // dasar jalur tulis ini adalah dapat ditelusuri. Baris yang ditulis atas
  // nama pejabat tanpa meninggalkan jejak sama sekali persis keadaan yang
  // hendak dihindari sejak awal.
  //
  // ==========================================================================
  // YANG SUDAH TERISI TIDAK DITIMPA
  // ==========================================================================
  //
  // Petikan dari berkas gugatan adalah HASIL BACA MESIN atas dokumen yang
  // ditulis manusia - ia bisa meleset. Menimpa data yang sudah diketik petugas
  // dengan tebakan mesin adalah pertukaran yang salah arah.
  //
  // Karena itu tiap ruas hanya diisi bila di SIPP masih KOSONG. Yang sudah
  // ada dilewati dan disebutkan sebagai dilewati, sehingga yang membacanya
  // tahu bedanya "tidak diisikan" dari "gagal diisikan".
  //
  // kode_kua sengaja TIDAK disentuh: ia pengenal acuan yang tidak dapat
  // diturunkan dari nama KUA pada berkas gugatan, dan mengisinya salah lebih
  // buruk daripada membiarkannya kosong.
  if (jenis === "dataUmum") {
    const isian = minta.dataUmum || {};
    const adaTabelNikah = await sippSkemaService.tabelAda("perkara_data_pernikahan");

    const sekarang = await runQuery(
      `SELECT p.tanggal_surat AS tanggalSurat, p.nomor_surat AS nomorSurat
         FROM perkara p WHERE p.perkara_id = ? LIMIT 1`,
      [perkara.perkaraId]
    ).catch(() => []);
    const lamaPerkara = (Array.isArray(sekarang) && sekarang[0]) || {};

    const lamaNikah = adaTabelNikah
      ? ((
          await runQuery(
            `SELECT tgl_nikah AS tglNikah, tgl_kutipan_akta_nikah AS tglAkta,
                    no_kutipan_akta_nikah AS noAkta, kua_tempat_nikah AS kua
               FROM perkara_data_pernikahan WHERE perkara_id = ? LIMIT 1`,
            [perkara.perkaraId]
          ).catch(() => [])
        )[0] || {})
      : {};

    const dilewati = [];
    const isiPerkara = {};
    const isiNikah = {};

    const pasang = (nilai, kolom, lama, sasaran, sebutan) => {
      const bersih = cleanText(nilai);
      if (!bersih) return;
      if (cleanText(lama)) {
        dilewati.push(`${sebutan} sudah terisi di SIPP`);
        return;
      }
      sasaran[kolom] = bersih;
    };

    pasang(isian.tanggalSurat, "tanggal_surat", lamaPerkara.tanggalSurat, isiPerkara, "Tanggal surat");
    pasang(isian.nomorSurat, "nomor_surat", lamaPerkara.nomorSurat, isiPerkara, "Nomor surat");

    if (adaTabelNikah) {
      pasang(isian.tanggalMenikah, "tgl_nikah", lamaNikah.tglNikah, isiNikah, "Tanggal menikah");
      pasang(isian.tanggalAktaNikah, "tgl_kutipan_akta_nikah", lamaNikah.tglAkta, isiNikah, "Tanggal kutipan akta nikah");
      pasang(isian.nomorAktaNikah, "no_kutipan_akta_nikah", lamaNikah.noAkta, isiNikah, "Nomor kutipan akta nikah");
      pasang(isian.kuaTempatMenikah, "kua_tempat_nikah", lamaNikah.kua, isiNikah, "KUA tempat menikah");
    }

    const jumlahIsi = Object.keys(isiPerkara).length + Object.keys(isiNikah).length;
    if (jumlahIsi === 0) {
      return { ok: false, alasan: "tidak_ada_yang_perlu_diisi", dilewati };
    }

    if (Object.keys(isiPerkara).length > 0) {
      const kolom = Object.keys(isiPerkara);
      langkah.push({
        tabel: "perkara",
        aksi: "UPDATE",
        sql:
          `UPDATE perkara SET ${kolom.map((k) => `${k} = ?`).join(", ")}, ` +
          `diperbaharui_oleh = ?, diperbaharui_tanggal = ? WHERE perkara_id = ?`,
        params: [...kolom.map((k) => isiPerkara[k]), akun.username, saat, perkara.perkaraId],
        keterangan: `data umum: ${kolom.join(", ")}`,
      });
      langkah.push(
        barisAudit({
          username: akun.username,
          tabel: "perkara",
          formulir: jejak.formulir,
          aksi: "UPDATE",
          nilai: { perkara_id: perkara.perkaraId, ...isiPerkara, diperbaharui_oleh: akun.username },
          ip,
          saat,
        })
      );
    }

    if (Object.keys(isiNikah).length > 0) {
      const kolom = Object.keys(isiNikah);
      // perkara_id adalah PRIMARY KEY tabel ini - diperiksa - sehingga satu
      // pernyataan menangani perkara yang barisnya belum ada maupun yang
      // sudah. Dari 9.834 perkara, 5.691 sudah punya barisnya.
      langkah.push({
        tabel: "perkara_data_pernikahan",
        aksi: "INSERT",
        sql:
          `INSERT INTO perkara_data_pernikahan (perkara_id, ${kolom.join(", ")}, diinput_oleh, diinput_tanggal)
           VALUES (?${kolom.map(() => ", ?").join("")}, ?, ?)
           ON DUPLICATE KEY UPDATE ${kolom.map((k) => `${k} = VALUES(${k})`).join(", ")},
             diperbaharui_oleh = VALUES(diinput_oleh), diperbaharui_tanggal = VALUES(diinput_tanggal)`,
        params: [perkara.perkaraId, ...kolom.map((k) => isiNikah[k]), akun.username, saat],
        keterangan: `data pernikahan: ${kolom.join(", ")}`,
      });
      langkah.push(
        barisAudit({
          username: akun.username,
          tabel: "perkara_data_pernikahan",
          formulir: jejak.formulir,
          aksi: "INSERT",
          nilai: { perkara_id: perkara.perkaraId, ...isiNikah, diinput_oleh: akun.username },
          ip,
          saat,
        })
      );
    }

    return {
      ok: true,
      jenis,
      perkara,
      atasNama: { username: akun.username, namaLengkap: akun.namaLengkap },
      operator,
      dilewati,
      jumlahLangkah: langkah.length,
      langkah,
    };
  }

  // ---- Riwayat Perkara, sama untuk keempatnya -----------------------------
  //
  // Ditulis SEBELUM jejak pada tabel perkara, mengikuti urutan SIPP sendiri.
  // Data Umum tidak punya langkah penetapan, jadi ia tidak menambah riwayat.
  // ==========================================================================
  // DAN TIDAK SATU BARIS AUDIT PUN UNTUKNYA
  // ==========================================================================
  //
  // Berkas ini dahulu menuliskan baris sys_audittrail untuk perkara_proses,
  // dengan alasan yang ditulis panjang lebar di sini: jalur tulis harus dapat
  // ditelusuri. Alasan itu SALAH TEMPAT, dan pengukuran membuktikannya.
  //
  // Dihitung atas seluruh sys_audittrail satker sejak 2016 - ratusan ribu
  // baris, sepuluh tahun:
  //
  //   perkara_proses        0 baris ditulis SIPP,  16 ditulis ALETA
  //   perkara_smartmajelis  0 baris ditulis SIPP,   6 ditulis ALETA
  //
  // Dua nama tabel yang muncul di Audit Trail HANYA ketika ALETA yang
  // mengerjakan. Menyaring audit menurut tablename memulangkan pekerjaan
  // ALETA dan tidak satu pun yang lain - penanda yang lebih tajam daripada
  // tulisan "[ALETA]" yang dahulu sengaja dihapus dari judulnya.
  //
  // Ketertelusurannya TIDAK hilang: jejakAletaService mencatat jenis, perkara,
  // akun SIPP, operator, tabel yang disentuh, dan sebabnya bila gagal - di
  // basis data ALETA sendiri, lebih lengkap daripada sys_audittrail, dan
  // termasuk percobaan yang gagal, yang di sys_audittrail memang tidak pernah
  // meninggalkan jejak. Yang dicabut di sini hanya salinannya di tempat yang
  // tidak pernah menampung baris semacam itu.
  //
  // Barisnya sendiri TETAP ditulis - tanpa perkara_proses, tab Riwayat Perkara
  // pada SIPP kosong. Yang dicabut catatan auditnya, bukan riwayatnya.
  if (jejak.prosesId > 0) {
    langkah.push(
      barisRiwayat({
        perkaraId: perkara.perkaraId,
        jejak,
        tanggal: minta.tanggalPenetapan,
        username: akun.username,
        saat,
      })
    );
    // Baris kedua PHS - proses 81 "Sidang pertama", bertanggal tanggal
    // sidangnya. Lihat catatan pada JEJAK_PROSES.phs.
    if (jejak.lanjutan) {
      langkah.push(
        barisRiwayat({
          perkaraId: perkara.perkaraId,
          jejak: jejak.lanjutan,
          tanggal: jejak.lanjutan.tanggalDariSidang ? minta.tanggalSidang : minta.tanggalPenetapan,
          username: akun.username,
          saat,
        })
      );
    }
  }

  // ---- jejak pada tabel perkara, sama untuk keempatnya --------------------
  //
  // PHS menulisnya DUA KALI: sekali menjadi proses 80, sekali lagi menjadi
  // proses 81. Bukan gaya penulisan - terhitung pada sys_audittrail 2026,
  // formulir "Tambah Penetapan Sidang Pertama" meninggalkan 1.636 baris
  // UPDATE perkara untuk 818 penetapan. Tepat dua, tidak pernah satu.
  const tahap = jejak.lanjutan ? [jejak, jejak.lanjutan] : [jejak];
  for (const langkahTahap of tahap) {
    const nilaiPerkara = {
      tahapan_terakhir_id: langkahTahap.tahapanId,
      tahapan_terakhir_text: langkahTahap.tahapanText,
      proses_terakhir_id: langkahTahap.prosesId,
      proses_terakhir_text: langkahTahap.prosesText,
      diperbaharui_oleh: akun.username,
      diperbaharui_tanggal: saat,
    };
    langkah.push({
      tabel: "perkara",
      aksi: "UPDATE",
      sql:
        `UPDATE perkara SET tahapan_terakhir_id = ?, tahapan_terakhir_text = ?,
           proses_terakhir_id = ?, proses_terakhir_text = ?,
           diperbaharui_oleh = ?, diperbaharui_tanggal = ?
         WHERE perkara_id = ?`,
      params: [
        langkahTahap.tahapanId,
        langkahTahap.tahapanText,
        langkahTahap.prosesId,
        langkahTahap.prosesText,
        akun.username,
        saat,
        perkara.perkaraId,
      ],
      keterangan: `tahapan terakhir menjadi ${langkahTahap.prosesText}`,
    });
    langkah.push(
      barisAudit({
        username: akun.username,
        tabel: "perkara",
        formulir: jejak.formulir,
        aksi: "UPDATE",
        nilai: nilaiPerkara,
        // nilaiPerkara hanya memuat kolom yang DIUBAH, dan perkara_id bukan
        // salah satunya. Tanpa disebut di sini, judulnya menjadi satu-satunya
        // baris audit tanpa Primary Key - dan justru itu yang menonjol.
        perkaraId: perkara.perkaraId,
        ip,
        saat,
      })
    );
  }

  // Penjagaan terakhir: tidak satu pun langkah boleh menyentuh tabel di luar
  // daftar putih. Diperiksa di sini, bukan hanya saat menjalankan - rencana
  // yang salah harus tertolak sebelum sempat diperlihatkan sebagai sah.
  const diluar = langkah.filter((x) => !DAFTAR_TABEL.has(x.tabel));
  if (diluar.length > 0) {
    return { ok: false, alasan: "tabel_di_luar_daftar", tabel: diluar.map((x) => x.tabel) };
  }

  return {
    ok: true,
    jenis,
    perkara: { perkaraId: perkara.perkaraId, nomorPerkara: perkara.nomorPerkara },
    atasNama: { username: akun.username, namaLengkap: akun.fullname },
    operator,
    tanggalPenetapan: minta.tanggalPenetapan,
    saat,
    langkah,
    andaian,
    // Kosong pada keadaan biasa - seluruh langkah setanggal. Berisi ketika
    // rantainya dilanjutkan pada hari yang berbeda; panel menampilkannya
    // sebagai catatan, bukan sebagai kegagalan.
    catatanTanggal,
  };
}

/**
 * Menjalankan rencana. KERING kecuali diminta tegas.
 *
 * Tidak ada transaksi: kolam koneksi mysql memberi sambungan yang berbeda tiap
 * pernyataan, sehingga BEGIN di satu sambungan tidak melindungi pernyataan di
 * sambungan lain. Yang dilakukan sebagai gantinya BERHENTI pada kegagalan
 * pertama, lalu memulangkan persis berapa langkah yang telanjur berhasil -
 * supaya yang membetulkannya tahu di mana harus melihat, bukan menebak.
 */
/**
 * ============================================================================
 * MEMBATALKAN SATU PENETAPAN
 * ============================================================================
 *
 * Penetapan yang salah tidak dapat diperbaiki dengan menekan ulang: tabelnya
 * menolak baris kedua, dan yang tertinggal adalah perkara yang separuh
 * tertulis. Selama ini jalan keluarnya membongkar dengan tangan dari beberapa
 * tabel sekaligus - dan itu pula yang harus dikerjakan ketika ALETA sendiri
 * berhenti di tengah jalan.
 *
 * Yang dikerjakan di sini KEBALIKAN dari susunRencanaTulis, langkah demi
 * langkah, dengan tiga aturan yang tidak boleh dilanggar:
 *
 *   1. URUTANNYA TERBALIK. PHS dibongkar lebih dulu, PMH paling akhir -
 *      sama seperti menulis, tetapi dari ujung yang lain. Membongkar PMH
 *      selagi PHS masih ada meninggalkan hari sidang bagi majelis yang sudah
 *      tidak ada.
 *
 *   2. HANYA LANGKAH ITU. Membatalkan PPP tidak menyentuh majelis maupun hari
 *      sidang. SIPP sendiri menghapus seluruh perkara_penetapan ketika majelis
 *      ditetapkan ulang, dan itu terlalu kasar untuk dipakai membatalkan satu
 *      penunjukan.
 *
 *   3. JEJAKNYA TETAP ADA. Tiap pembongkaran menulis barisnya sendiri ke
 *      sys_audittrail. Penetapan yang hilang tanpa jejak jauh lebih buruk
 *      daripada penetapan yang salah.
 */

/** Kolom perkara_penetapan yang dikosongkan tiap jenis. */
const KOLOM_DIKOSONGKAN = {
  pmh: [
    "penetapan_majelis_hakim",
    "majelis_hakim_id",
    "majelis_hakim_kode",
    "majelis_hakim_nama",
    "majelis_hakim_text",
  ],
  ppp: [
    "penetapan_panitera_pengganti",
    "panitera_pengganti_id",
    "panitera_pengganti_text",
  ],
  pjs: ["penetapan_jurusita", "jurusita_id", "jurusita_text"],
  phs: ["penetapan_hari_sidang", "sidang_pertama"],
};

/**
 * ============================================================================
 * YANG DIHAPUS HANYA BARIS MILIK PENETAPAN ITU
 * ============================================================================
 *
 * Mula-mula pembongkaran menghapus seluruh baris milik satu perkara:
 * DELETE FROM perkara_jurusita WHERE perkara_id = ?. Sekilas benar, dan pada
 * perkara baru memang tidak ada bedanya.
 *
 * Pada perkara lama bedanya besar. Diuji atas sepuluh perkara tahun 2015,
 * pembongkaran itu ikut membuang 10 baris juru sita dan 23 baris jadwal sidang
 * yang sudah ada sejak perkaranya disidangkan - riwayat yang tidak ada
 * hubungannya sama sekali dengan penetapan yang sedang dibatalkan. Ketahuan
 * hanya karena cacah barisnya dibandingkan sebelum dan sesudah.
 *
 * Sekarang tiap penghapusan dipagari nilai yang TERCATAT pada
 * perkara_penetapan: id petugasnya dan tanggal penetapannya. Jadwal sidang
 * dipagari lebih rapat lagi - barisnya ditunjuk langsung oleh
 * perkara_penetapan_hari_sidang.jadwalsidang_id, jadi yang terhapus tepat satu
 * baris yang memang dibuat penetapan ini.
 */
function rincianUntukHapus(jenis, perkara, jadwalSidangId) {
  if (jenis === "pmh") {
    return [
      {
        tabel: "perkara_hakim_pn",
        sql: `DELETE FROM perkara_hakim_pn WHERE perkara_id = ? AND tahapan_id = ? AND tanggal_penetapan = ?`,
        params: [perkara.perkaraId, TAHAPAN_TINGKAT_PERTAMA, perkara.pmh],
        keterangan: `membongkar majelis hakim tanggal ${tanggalIso(perkara.pmh)}`,
      },
      // ======================================================================
      // BARIS SMART MAJELIS IKUT DIBONGKAR - DIPAGARI TANGGALNYA
      // ======================================================================
      //
      // Baris Smart Majelis baru ditulis sejak 1.104.0, sedangkan
      // pembongkaran ini ditulis sebelum itu. Akibatnya perkara yang
      // majelisnya dibongkar tetap punya baris yang menyatakan majelisnya
      // ditetapkan di luar rekomendasi - untuk majelis yang sudah tidak ada.
      // Di laporan Smart Majelis ia terbaca sebagai perkara menyimpang,
      // padahal perkaranya belum bermajelis sama sekali.
      //
      // Dipagari TANGGAL penetapannya, bukan perkara_id saja. Perkara 562
      // punya baris Smart Majelis yang ditulis petugas pada 10 September, dan
      // pembongkaran yang menyapu seluruh baris satu perkara pernah
      // membuangnya - baris itu harus dipulihkan dari cadangan. Yang dibongkar
      // hanya baris yang tanggalnya sama dengan penetapan yang sedang
      // dibongkar; tulisan petugas dari hari lain tidak tersentuh.
      {
        tabel: "perkara_smartmajelis",
        sql: `DELETE FROM perkara_smartmajelis WHERE perkara_id = ? AND DATE(tanggal) = ?`,
        params: [perkara.perkaraId, tanggalIso(perkara.pmh)],
        keterangan: `membongkar catatan smart majelis tanggal ${tanggalIso(perkara.pmh)}`,
      },
    ];
  }
  if (jenis === "ppp") {
    return [
      {
        tabel: "perkara_panitera_pn",
        sql: `DELETE FROM perkara_panitera_pn WHERE perkara_id = ? AND tahapan_id = ? AND tanggal_penetapan = ? AND panitera_id = ?`,
        params: [perkara.perkaraId, TAHAPAN_TINGKAT_PERTAMA, perkara.ppp, String(perkara.pppId ?? "")],
        keterangan: `membongkar panitera pengganti tanggal ${tanggalIso(perkara.ppp)}`,
      },
    ];
  }
  if (jenis === "pjs") {
    return [
      {
        tabel: "perkara_jurusita",
        sql: `DELETE FROM perkara_jurusita WHERE perkara_id = ? AND tahapan_id = ? AND tanggal_penetapan = ? AND jurusita_id = ?`,
        params: [perkara.perkaraId, TAHAPAN_TINGKAT_PERTAMA, perkara.pjs, String(perkara.pjsId ?? "")],
        keterangan: `membongkar juru sita tanggal ${tanggalIso(perkara.pjs)}`,
      },
    ];
  }
  // PHS. Urutannya penting: penetapan hari sidang menunjuk jadwal sidang, jadi
  // barisnya dibaca lebih dulu, baru keduanya dibongkar dari ujung yang benar.
  const langkah = [
    {
      tabel: "perkara_penetapan_hari_sidang",
      sql: `DELETE FROM perkara_penetapan_hari_sidang WHERE perkara_id = ? AND tanggal_penetapan = ?`,
      params: [perkara.perkaraId, perkara.phs],
      keterangan: `membongkar penetapan hari sidang tanggal ${tanggalIso(perkara.phs)}`,
    },
  ];
  if (jadwalSidangId > 0) {
    langkah.push({
      tabel: "perkara_jadwal_sidang",
      sql: `DELETE FROM perkara_jadwal_sidang WHERE id = ? AND perkara_id = ?`,
      params: [jadwalSidangId, perkara.perkaraId],
      keterangan: `membongkar jadwal sidang id ${jadwalSidangId}`,
    });
  }
  return langkah;
}

/**
 * Langkah mana yang menjadi tahapan terakhir sesudah satu langkah dibongkar.
 *
 * Dihitung dari kolom yang MASIH terisi, bukan ditebak dari jenis yang
 * dibatalkan: petugas dapat membatalkan PPP sementara PJS masih ada, dan
 * tahapan terakhirnya tetap PJS.
 */
function tahapanSetelahHapus(perkara, jenisDihapus) {
  const masih = {
    pmh: Boolean(perkara.pmh) && jenisDihapus !== "pmh",
    ppp: Boolean(perkara.ppp) && jenisDihapus !== "ppp",
    pjs: Boolean(perkara.pjs) && jenisDihapus !== "pjs",
    phs: Boolean(perkara.phs) && jenisDihapus !== "phs",
  };
  for (const jenis of ["phs", "pjs", "ppp", "pmh"]) {
    // Bila PHS yang tersisa, keadaannya "Sidang pertama" - baris kedualah yang
    // menjadi tahapan terakhir, bukan baris penetapannya.
    if (masih[jenis]) return JEJAK_PROSES[jenis].lanjutan || JEJAK_PROSES[jenis];
  }
  // ==========================================================================
  // TAHAPANNYA "PENDAFTARAN", STATUSNYA "PENDAFTARAN PERKARA"
  // ==========================================================================
  //
  // Dua nama berbeda untuk satu langkah, dan tertukar mudah sekali sebab
  // tabel riwayat memakai nama yang lain lagi: pada perkara_proses SIPP
  // menulis tahapan_nama "Pendaftaran Perkara", pada perkara ia menulis
  // tahapan_terakhir_text "Pendaftaran". Ditiru dari salinan cadangan satker,
  // yang seluruh isinya tulisan SIPP sendiri:
  //
  //   perkara.tahapan_terakhir_id   = 10
  //   perkara.tahapan_terakhir_text = "Pendaftaran"
  //   perkara.proses_terakhir_id    = 10
  //   perkara.proses_terakhir_text  = "Pendaftaran Perkara"
  //
  // Akibat tertukarnya terlihat di kolom Tahapan pada daftar perkara SIPP:
  // perkara yang penetapannya dibongkar ALETA berbunyi "Pendaftaran Perkara"
  // di kolom yang untuk perkara lain berbunyi "Pendaftaran".
  return { tahapanId: 10, tahapanText: "Pendaftaran", prosesId: 10, prosesText: "Pendaftaran Perkara" };
}

/**
 * Rencana membongkar satu penetapan.
 *
 * Bentuk jawabannya sama persis dengan susunRencanaTulis, sehingga
 * jalankanRencana dan uji keringnya berlaku tanpa perubahan apa pun.
 */
async function susunRencanaHapus(minta) {
  const diminta = String((minta && minta.jenis) || "").toLowerCase();
  const jenis = JENIS_MENURUT_HURUF_KECIL.get(diminta) || "";
  const jejak = JEJAK_PROSES[jenis];
  if (!jejak || !KOLOM_DIKOSONGKAN[jenis]) {
    return { ok: false, alasan: "jenis_tidak_didukung", jenis: diminta };
  }

  const perkara = await keadaanPerkara(minta.perkaraId);
  if (!perkara) return { ok: false, alasan: "perkara_tidak_ketemu" };
  if (!perkara[jenis]) return { ok: false, alasan: `${jenis}_belum_ada` };

  // Urutannya tidak dapat dibalik. Membongkar majelis selagi hari sidangnya
  // masih berdiri meninggalkan sidang bagi majelis yang sudah tidak ada.
  const sesudah = { pmh: ["ppp", "pjs", "phs"], ppp: ["phs"], pjs: ["phs"], phs: [] }[jenis];

  // ==========================================================================
  // RANTAI YANG DIBONGKAR SEKALIGUS - HANYA PADA UJI KERING
  // ==========================================================================
  //
  // Membatalkan SELURUH penetapan satu perkara menuntut rencana keempat
  // langkahnya diperlihatkan lebih dahulu, sekaligus. Tetapi pada saat itu
  // belum ada satu baris pun yang dihapus, sehingga penjaga di bawah akan
  // menolak PJS selagi PHS-nya masih berdiri - padahal PHS itu memang akan
  // dibongkar lebih dahulu pada rantai yang sama.
  //
  // Yang dilonggarkan HANYA uji keringnya. Pembongkaran sungguhan berjalan
  // satu per satu dan basis datanya benar-benar berubah di antara langkah,
  // jadi di sana penjaganya membaca keadaan yang sebenarnya dan tidak perlu
  // dilonggarkan sedikit pun. Sepola dengan rantaiSebelum di jalur menulis.
  const dibongkarDahulu =
    minta.kering === true && Array.isArray(minta.rantaiDibongkar)
      ? minta.rantaiDibongkar.map((x) => String(x || "").toLowerCase())
      : [];

  const menghalangi = sesudah.filter(
    (x) => Boolean(perkara[x]) && !dibongkarDahulu.includes(x)
  );
  if (menghalangi.length > 0) {
    return { ok: false, alasan: "langkah_sesudahnya_masih_ada", langkah: menghalangi };
  }

  const akun = await akunSipp(minta.olehUsername);
  if (!akun) {
    // Nama akunnya IKUT disebutkan. Tanpa itu, yang membacanya hanya tahu
    // "akun pejabat tidak ketemu" dan tidak punya satu pun petunjuk akun mana
    // yang dicari - padahal yang dicari datang dari pemetaan jabatan ALETA,
    // dan di situlah perbaikannya.
    return {
      ok: false,
      alasan: "akun_pejabat_tidak_ketemu",
      username: String(minta.olehUsername || ""),
    };
  }

  const operator = cleanText(minta.operator);
  if (!operator) return { ok: false, alasan: "operator_tidak_disebut" };

  // Jam yang dipakai pemanggil bila ia menyusun rangkaian bongkar - lihat
  // waktuBongkar. Tanpa itu, jam basis data sekarang - untuk bongkar satu
  // langkah lewat tombol "Batalkan penetapan terakhir".
  const saat = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(String(minta.saat || ""))
    ? String(minta.saat)
    : await waktuBasisData();
  // Butir 14: alamat yang tidak diteruskan DIKOSONGKAN, tidak dikarang "127.0.0.1".
  const ip = String(minta.ip || "");
  const langkah = [];

  // Jadwal sidang mana yang dibuat penetapan ini - dibaca dari baris yang
  // memang menunjuknya, bukan ditebak dari urutan atau tanggalnya.
  let jadwalSidangId = 0;
  if (jenis === "phs") {
    const baris = await runQuery(
      `SELECT jadwalsidang_id AS id FROM perkara_penetapan_hari_sidang
        WHERE perkara_id = ? AND tanggal_penetapan = ? LIMIT 1`,
      [perkara.perkaraId, perkara.phs]
    ).catch(() => []);
    jadwalSidangId = Number((Array.isArray(baris) && baris[0] && baris[0].id) || 0);
  }

  for (const rincian of rincianUntukHapus(jenis, perkara, jadwalSidangId)) {
    if (!(await sippSkemaService.tabelAda(rincian.tabel))) continue;
    langkah.push({ ...rincian, aksi: "DELETE" });
    // perkara_smartmajelis TIDAK diaudit - sama seperti jalur tulis. SIPP
    // tidak pernah mencatat tabel ini di sys_audittrail (nol baris sejak
    // 2016); baris DELETE-nya di sini adalah satu-satunya yang tersisa, dan
    // terlihat pada bongkar perkara 567 pukul 15:19:43. Barisnya sendiri
    // tetap dihapus - yang dicabut catatan auditnya.
    if (rincian.tabel === "perkara_smartmajelis") continue;
    langkah.push(
      barisAudit({
        username: akun.username,
        tabel: rincian.tabel,
        formulir: jejak.formulir,
        aksi: "DELETE",
        nilai: { perkara_id: perkara.perkaraId, keterangan: rincian.keterangan },
        perkaraId: perkara.perkaraId,
        ip,
        saat,
      })
    );
  }

  const kolom = KOLOM_DIKOSONGKAN[jenis];
  langkah.push({
    tabel: "perkara_penetapan",
    aksi: "UPDATE",
    sql:
      `UPDATE perkara_penetapan SET ${kolom.map((k) => `${k} = NULL`).join(", ")}, ` +
      `diperbaharui_oleh = ?, diperbaharui_tanggal = ? WHERE perkara_id = ?`,
    params: [akun.username, saat, perkara.perkaraId],
    keterangan: `mengosongkan ${kolom.join(", ")}`,
  });
  langkah.push(
    barisAudit({
      username: akun.username,
      tabel: "perkara_penetapan",
      formulir: jejak.formulir,
      aksi: "UPDATE",
      nilai: Object.fromEntries(kolom.map((k) => [k, null])),
      perkaraId: perkara.perkaraId,
      ip,
      saat,
    })
  );

  // Riwayat Perkara ikut dibongkar - baris yang tertinggal menyebutkan langkah
  // yang sudah tidak ada, dan itu terbaca sebagai penetapan yang hilang.
  //
  // PHS meninggalkan DUA baris: proses 80 dan proses 81. Membongkar satu saja
  // menyisakan "Sidang pertama" pada riwayat perkara yang hari sidangnya sudah
  // dibatalkan - persis kebalikan dari yang dimaksud.
  //
  // Tanpa baris audit, sama seperti saat menulisnya.
  const prosesRiwayat = [jejak.prosesId].concat(jejak.lanjutan ? [jejak.lanjutan.prosesId] : []);
  for (const prosesId of prosesRiwayat) {
    langkah.push({
      tabel: "perkara_proses",
      aksi: "DELETE",
      sql: `DELETE FROM perkara_proses WHERE perkara_id = ? AND tahapan_id = ? AND proses_id = ?`,
      params: [perkara.perkaraId, jejak.tahapanId, prosesId],
      keterangan: `membongkar riwayat: proses ${prosesId}`,
    });
  }

  const kembali = tahapanSetelahHapus(perkara, jenis);
  langkah.push({
    tabel: "perkara",
    aksi: "UPDATE",
    sql:
      `UPDATE perkara SET tahapan_terakhir_id = ?, tahapan_terakhir_text = ?,
         proses_terakhir_id = ?, proses_terakhir_text = ?,
         diperbaharui_oleh = ?, diperbaharui_tanggal = ?
       WHERE perkara_id = ?`,
    params: [
      kembali.tahapanId,
      kembali.tahapanText,
      kembali.prosesId,
      kembali.prosesText,
      akun.username,
      saat,
      perkara.perkaraId,
    ],
    keterangan: `tahapan terakhir kembali menjadi ${kembali.prosesText}`,
  });
  langkah.push(
    barisAudit({
      username: akun.username,
      tabel: "perkara",
      formulir: jejak.formulir,
      aksi: "UPDATE",
      nilai: {
        tahapan_terakhir_id: kembali.tahapanId,
        tahapan_terakhir_text: kembali.tahapanText,
        proses_terakhir_id: kembali.prosesId,
        proses_terakhir_text: kembali.prosesText,
      },
      perkaraId: perkara.perkaraId,
      ip,
      saat,
    })
  );

  const diluar = langkah.filter((x) => !DAFTAR_TABEL.has(x.tabel));
  if (diluar.length > 0) {
    return { ok: false, alasan: "tabel_di_luar_daftar", tabel: diluar.map((x) => x.tabel) };
  }

  return {
    ok: true,
    jenis,
    membongkar: true,
    perkara: { perkaraId: perkara.perkaraId, nomorPerkara: perkara.nomorPerkara },
    atasNama: { username: akun.username, namaLengkap: akun.fullname },
    operator,
    saat,
    langkah,
    andaian: [],
  };
}

async function jalankanRencana(rencana, opsi = {}) {
  if (!rencana || rencana.ok !== true) {
    return { ok: false, alasan: (rencana && rencana.alasan) || "rencana_tidak_sah" };
  }

  const kering = opsi.kering !== false;
  if (kering) {
    return {
      ok: true,
      kering: true,
      jumlahLangkah: rencana.langkah.length,
      langkah: rencana.langkah.map((x) => ({
        tabel: x.tabel,
        aksi: x.aksi,
        keterangan: x.keterangan,
      })),
    };
  }

  const selesai = [];
  // id baris yang baru disisipkan, menurut urutan langkahnya.
  const idBaru = [];
  for (const [urutan, satu] of rencana.langkah.entries()) {
    if (!DAFTAR_TABEL.has(satu.tabel)) {
      return { ok: false, kering: false, alasan: "tabel_di_luar_daftar", tabel: satu.tabel, selesai };
    }
    try {
      // Langkah yang menunggu id baris sebelumnya - lihat catatan pada cabang
      // PHS. Bila id itu belum ada, langkahnya DIHENTIKAN, bukan ditulis
      // dengan null: baris penetapan hari sidang yang tidak menunjuk jadwal
      // sidang mana pun lebih buruk daripada tidak ada baris sama sekali.
      const params = [...satu.params];

      // Tabel tanpa auto_increment: id-nya dihitung DI SINI, sedekat mungkin
      // dengan penulisannya. Dihitung saat rencana disusun, jeda antara
      // membaca MAX(id) dan memakainya selebar seluruh rencana - dan pada
      // pengadilan yang dua petugasnya menekan Simpan bersamaan, jeda itu
      // cukup untuk melahirkan dua baris berid sama.
      if (satu.idDihitung) {
        params[satu.idDihitung.posisiParam] = await idBerikutnya(satu.idDihitung.tabel);
      }

      if (satu.isiDariLangkah) {
        const id = idBaru[satu.isiDariLangkah.indeks];
        if (!id) {
          return {
            ok: false,
            kering: false,
            alasan: "id_langkah_sebelumnya_tidak_ada",
            pada: { tabel: satu.tabel, aksi: satu.aksi },
            selesai,
          };
        }
        params[satu.isiDariLangkah.posisiParam] = id;
      }

      // ====================================================================
      // KUNCI UTAMA PADA JUDUL AUDIT, DIISI SESUDAH BARISNYA ADA
      // ====================================================================
      //
      // Dua tabel diaudit SIPP memakai id baris itu sendiri, bukan perkara_id
      // - dan id itu baru lahir ketika barisnya ditulis. Judulnya disusun
      // dengan penanda #ID#, lalu penanda itu diganti di sini.
      //
      // Bila id-nya tidak ada, judulnya DIBIARKAN bertanda: baris audit yang
      // menyebut kunci keliru lebih buruk daripada baris audit yang tampak
      // belum selesai, sebab yang pertama terbaca sebagai fakta.
      if (satu.kunciDariLangkah) {
        for (const [penanda, indeks] of Object.entries(satu.kunciDariLangkah)) {
          const idKunci = idBaru[indeks];
          if (!idKunci) continue;
          for (let i = 0; i < params.length; i += 1) {
            if (typeof params[i] === "string" && params[i].includes(penanda)) {
              params[i] = params[i].split(penanda).join(String(idKunci));
            }
          }
        }
      }

      const hasil = await runQuery(satu.sql, params);
      // id yang kita tentukan sendiri dipakai lebih dulu: pada tabel tanpa
      // auto_increment, insertId yang dipulangkan basis data selalu 0.
      idBaru[urutan] = satu.idDihitung
        ? Number(params[satu.idDihitung.posisiParam])
        : hasil && hasil.insertId
          ? Number(hasil.insertId)
          : 0;
      selesai.push({ tabel: satu.tabel, aksi: satu.aksi, keterangan: satu.keterangan });
    } catch (galat) {
      return {
        ok: false,
        kering: false,
        alasan: "gagal_menulis",
        pada: { tabel: satu.tabel, aksi: satu.aksi, keterangan: satu.keterangan },
        pesan: String(galat.message || galat).slice(0, 300),
        selesai,
      };
    }
  }

  return { ok: true, kering: false, jumlahLangkah: selesai.length, selesai };
}

/**
 * Urutan membongkar: dari yang paling akhir ditulis ke yang paling awal.
 * Ditulis satu kali di sini supaya gerbang, ekstensi, dan uji membaca
 * urutan yang sama - urutan yang berbeda di salah satunya akan berujung
 * pada perkara yang separuh terbongkar.
 */
const URUTAN_BONGKAR = ["phs", "pjs", "ppp", "pmh"];

module.exports = {
  daftarRuangan,
  URUTAN_BONGKAR,
  TANDA_ALETA,
  DAFTAR_TABEL,
  JEJAK_PROSES,
  susunRencanaTulis,
  susunRencanaHapus,
  jalankanRencana,
  waktuBongkar,
  // Diekspor untuk diuji satuan.
  waktuLangkah,
  rangkaianDetik,
  majelisTetapUntuk,
  kompetensiMenurutPerkara,
  // Diekspor untuk diuji satuan.
  keteranganAudit,
  waktuMysql,
  // Jam yang BENAR - ditanyakan kepada basis data, bukan kepada container.
  // Node di dalam container jatuh ke UTC bila env TZ tidak diset, dan seluruh
  // baris audit ALETA akan tercatat delapan jam sebelum kejadiannya - lihat
  // keterangan panjang di atas waktuBasisData. Diekspor supaya penulis hasil
  // sidang dan penulis putusan memakai jam yang sama, bukan jam masing-masing.
  waktuBasisData,
  // Dipakai penulis hasil sidang - lihat sidangHasilService. Bentuk baris
  // audit hanya boleh punya SATU definisi: dua salinan akan menyimpang
  // perlahan, dan yang menyimpang justru baris yang dibaca pemeriksa.
  barisAudit,
  tanggalIso,
};
