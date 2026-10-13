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
    keterangan: "",
    diinput_oleh: username,
    diinput_tanggal: saat,
  };
  return {
    tabel: "perkara_proses",
    aksi: "REPLACE",
    // keterangan '' - parameter ketujuh CALL perkara_proses_update, yang pada
    // keempat controller penetapan SIPP selalu dikirim kosong. Tanpanya
    // kolomnya NULL, satu-satunya baris riwayat penetapan yang begitu.
    sql:
      `REPLACE INTO perkara_proses
         (perkara_id, tahapan_id, tahapan_nama, proses_id, proses_nama, tanggal,
          keterangan, diinput_oleh, diinput_tanggal)
       VALUES (?,?,?,?,?,?,?,?,?)`,
    params: [
      perkaraId,
      jejak.tahapanId,
      jejak.tahapanText,
      jejak.prosesId,
      jejak.prosesText,
      tanggal,
      "",
      String(username).slice(0, 30),
      saat,
    ],
    keterangan: `riwayat perkara: ${jejak.prosesText} atas nama ${username}`,
    nilaiRiwayat: nilai,
  };
}

/** MAX(id)+1 pada tabel yang id-nya tidak bertambah sendiri. */
async function idBerikutnya(tabel, jalankan = runQuery) {
  if (!DAFTAR_TABEL.has(tabel)) throw new Error(`tabel_di_luar_daftar:${tabel}`);
  const baris = await jalankan(`SELECT COALESCE(MAX(id), 0) + 1 AS berikutnya FROM ${tabel}`);
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
  // Agenda bawaan borang SIPP sekarang. Diukur 5 Okt 2026 atas jadwal sidang
  // pertama sejak Juni 2026 yang belum disunting: 30 dari 30 berbunyi
  // "Sidang Pertama" dengan sampai_jam NULL. "SIDANG PERTAMA" + 09:30 yang
  // dahulu dipatok di sini hanya muncul pada baris yang sudah disunting
  // sesudahnya - atau yang ditulis ALETA.
  agenda: "Sidang Pertama",
};

/**
 * Penjalan kueri transaksi rantai (tulisRantaiUtuh, uji rilis U1 9 Okt 2026).
 * Selama satu rantai berjalan, SELURUH kueri modul ini - penyusun rencana yang
 * membaca perkara_penetapan/perkara_hakim_pn DAN penjalannya - lewat sambungan
 * bertransaksi yang sama, sehingga PPP/PHS melihat PMH yang baru ditulis
 * (belum di-COMMIT). Di luar rantai: kolam biasa, perilaku lama utuh.
 */
const { AsyncLocalStorage } = require("node:async_hooks");
const kueriTransaksi = new AsyncLocalStorage();

function runQuery(sql, params = []) {
  const lewat = kueriTransaksi.getStore();
  if (typeof lewat === "function") return lewat(sql, params);
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
 * JAM SIPP - ZONA YANG DIPAKAI SIPP SENDIRI, BUKAN ZONA BASIS DATA (butir 17)
 * ============================================================================
 *
 * SIPP tidak memakai NOW() basis data. Tiap diinput_tanggal dan tiap
 * sys_audittrail.datetime ditulis PHP date() sesudah
 * date_default_timezone_set("Asia/Jakarta") (models/default_setting.php,
 * views/header.php) - WIB - sedangkan basis datanya berzona sistem WITA.
 *
 * Terukur di server 13 Okt 2026: baris audit ALETA 507558 (NOW() basis data)
 * bertanggal 10:46:08, lalu baris 507574 yang ditulis SIPP SESUDAHNYA (petugas
 * menghapus penetapan itu) bertanggal 09:46:38. Menulis NOW() berarti menulis
 * satu jam di depan tiap baris SIPP - di layar SIPP itu jam yang belum terjadi.
 *
 * Karena itu "sekarang" bagi baris SIPP = UTC basis data, dibaca dalam zona
 * SIPP (ALETA_ZONA_WAKTU_SIPP, bawaan Asia/Jakarta). Tanggal penetapan dan
 * pagar "tanggal masa depan" tetap memakai tanggal setempat (waktuBasisData).
 */
const ZONA_SIPP_BAWAAN = "Asia/Jakarta";

function zonaSipp() {
  const zona = String(process.env.ALETA_ZONA_WAKTU_SIPP || "").trim() || ZONA_SIPP_BAWAAN;
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone: zona });
    return zona;
  } catch {
    return ZONA_SIPP_BAWAAN;
  }
}

/** Milidetik UTC -> "YYYY-MM-DD HH:mm:ss" pada zona tertentu. */
function waktuPadaZona(ms, zona) {
  const bagian = {};
  for (const p of new Intl.DateTimeFormat("en-CA", {
    timeZone: zona,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(ms))) {
    bagian[p.type] = p.value;
  }
  return `${bagian.year}-${bagian.month}-${bagian.day} ${bagian.hour}:${bagian.minute}:${bagian.second}`;
}

/**
 * Selisih zona SIPP terhadap UTC, dalam menit, saat ini (Asia/Jakarta: +420).
 * Dihitung dari Intl, bukan dipatok - zona lain yang dipasang lewat env tetap
 * benar.
 */
function selisihMenitZonaSipp(ms = Date.now()) {
  const teks = waktuPadaZona(ms, zonaSipp());
  const m = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/.exec(teks);
  if (!m) return 420;
  const naif = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
  return Math.round((naif - Math.floor(ms / 1000) * 1000) / 60000);
}

/**
 * Ungkapan SQL "jam SIPP sekarang" untuk pernyataan yang mengambil jamnya di
 * dalam pernyataan itu sendiri (pengganti NOW()). Contoh:
 * sqlJamSipp("%Y-%m-%d %h:%i:%s") untuk kolom berjam dua belas ala date("h").
 * Tanpa tabel zona MySQL: UTC_TIMESTAMP() digeser selisih zona SIPP.
 */
function sqlJamSipp(format = "%Y-%m-%d %H:%i:%s") {
  const f = String(format).replace(/[^%A-Za-z0-9 :\-]/g, "");
  return `DATE_FORMAT(DATE_ADD(UTC_TIMESTAMP(), INTERVAL ${selisihMenitZonaSipp()} MINUTE), '${f}')`;
}

/** Jam SEKARANG menurut jam SIPP - lihat catatan di atas. */
async function waktuSipp() {
  const baris = await runQuery("SELECT DATE_FORMAT(UTC_TIMESTAMP(), '%Y-%m-%d %H:%i:%s') AS utc").catch(() => []);
  const utc = Array.isArray(baris) && baris[0] ? String(baris[0].utc || "") : "";
  const ms = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(utc) ? Date.parse(`${utc.replace(" ", "T")}Z`) : Date.now();
  return waktuPadaZona(ms, zonaSipp());
}

/**
 * ============================================================================
 * JAM TIAP LANGKAH SEPERTI ORANG BEKERJA (butir 17, 13 Okt 2026)
 * ============================================================================
 *
 * Keputusan pengguna: "untuk jam dibuat seperti manusia yang kerja (jadi tidak
 * sama jamnya, ini hanya yang tercatat di database SIPP)". Satu tekanan tombol
 * menulis PMH, PPP, PJS, PHS dalam hitungan detik; yang dicatat di SIPP disusun
 * seperti petugas yang mengetiknya satu per satu. Jam SEBENARNYA tetap dicatat
 * di jejak ALETA (aleta_bot_jejak_penetapan.waktu).
 *
 * Mesin ini MENGGANTIKAN mesin lama (waktuLangkah/rangkaianDetik/waktuBongkar:
 * benih tetap per perkara, jendela 08:00-14:00 pada tanggal penetapan, mundur
 * dari jam server) - yang menenggelamkan baris di Audit Trail dan polanya
 * berulang. Yang sekarang:
 *
 *   1. URUT menurut urutan kerja; tiap langkah jamnya sendiri (detik berbeda).
 *   2. JEDA ACAK, tidak berpola, dari sebaran yang DIUKUR pada penetapan tangan
 *      2026 di server (763 perkara, Jan-Agu, perkara_proses):
 *        PMH -> PPP  median 30 mnt, p25 8 mnt, p10 4 mnt (orang berbeda)
 *        PPP -> PJS  median 8 dtk, p90 19 dtk, p95 41 dtk (Panitera sekaligus)
 *        PJS -> PHS  median 5 mnt, p25 2 mnt, p75 14 mnt
 *        daftar -> PMH median 31 mnt, p10 6 mnt
 *      Rentang di bawah dipangkas dari ekor panjangnya supaya satu rangkaian
 *      tidak berjam-jam mundur dari tekanan tombolnya.
 *   3. TIDAK PERNAH DI MASA DEPAN: langkah terakhir <= jam SIPP sekarang.
 *   4. TIDAK MENDAHULUI KEJADIAN SEBELUMNYA di perkara itu (pendaftaran,
 *      penetapan/riwayat sebelumnya, suntingan perkara) - lantaiKejadianPerkara.
 *   5. JAM KERJA: PMH tangan terukur pukul 07.00-16.59 WIB. Ditekan sesudah
 *      16.30 (jam SIPP), rangkaiannya diakhiri sebelum 16.30 bila lantainya
 *      memberi ruang; tidak pernah dimulai sebelum 07.00 bila ruangnya ada.
 *   6. Ruang yang sempit (perkara baru didaftarkan) MERAPATKAN jedanya, tidak
 *      pernah melanggar butir 3 dan 4. Bila kejadian sebelumnya justru tercatat
 *      di depan jam SIPP (baris lama ber-NOW() WITA), butir 3 yang menang dan
 *      itu dicatat pada `catatan`.
 */
const JAM_KERJA_SIPP = { mulai: 7 * 3600, akhir: 16 * 3600 + 30 * 60 };
/** Rentang jeda antarlangkah, detik [min, maks] - ditarik log-seragam. */
const JEDA_ANTARLANGKAH = Object.freeze({
  "pmh>ppp": [90, 1800],
  "ppp>pjs": [5, 45],
  "pjs>phs": [40, 900],
  // Membongkar berjalan terbalik; orangnya sama dengan yang menetapkan.
  "phs>pjs": [40, 900],
  "pjs>ppp": [5, 45],
  "ppp>pmh": [90, 1800],
});
const JEDA_LANGKAH_LAIN = [60, 900];
/** Jeda sesudah kejadian terakhir di perkara itu sebelum langkah pertama. */
const JEDA_SESUDAH_KEJADIAN = [60, 600];
/** Langkah terakhir selesai sedikit sebelum tombolnya ditekan. */
const JEDA_UJUNG = [5, 120];
/** Ditekan sesudah jam kerja: rangkaian diakhiri 0-20 menit sebelum 16.30. */
const SEBARAN_SESUDAH_JAM_KERJA = 20 * 60;

function detikNaif(teks) {
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(
    teks instanceof Date ? waktuMysql(teks) : String(teks || "")
  );
  if (!m) return NaN;
  return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]) / 1000;
}

function teksNaif(detik) {
  const d = new Date(detik * 1000);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(
    d.getUTCMinutes()
  )}:${p(d.getUTCSeconds())}`;
}

function tarikLog([min, maks], acak) {
  const u = Math.min(Math.max(Number(acak()) || 0, 0), 1);
  return Math.max(1, Math.round(min * Math.pow(maks / min, u)));
}

/**
 * Jam tiap langkah satu rangkaian, dalam jam SIPP.
 *
 * @param {object} p
 * @param {string[]} p.urutan  jenis menurut urutan kerja (tulis: pmh..phs; bongkar: phs..pmh)
 * @param {string} p.sekarang  jam SIPP sekarang "YYYY-MM-DD HH:mm:ss"
 * @param {string} [p.lantai]  kejadian terakhir di perkara itu (jam SIPP)
 * @param {() => number} [p.acak]
 * @returns {{ jam: Record<string,string>, jeda: number[], catatan: string[] }}
 */
function jamRangkaianManusia({ urutan, sekarang, lantai = "", acak = Math.random }) {
  const jenis = [...new Set((urutan || []).map((x) => String(x || "").toLowerCase()).filter(Boolean))];
  const kini = detikNaif(sekarang);
  const catatan = [];
  if (!Number.isFinite(kini) || jenis.length === 0) return { jam: {}, jeda: [], catatan };

  const k = jenis.length;
  const awalHari = kini - (((kini % 86400) + 86400) % 86400);
  const mulaiKerja = awalHari + JAM_KERJA_SIPP.mulai;
  const akhirKerja = awalHari + JAM_KERJA_SIPP.akhir;
  const kejadian = detikNaif(lantai);

  let jeda = [];
  for (let i = 0; i < k - 1; i += 1) {
    jeda.push(tarikLog(JEDA_ANTARLANGKAH[`${jenis[i]}>${jenis[i + 1]}`] || JEDA_LANGKAH_LAIN, acak));
  }
  const jumlah = (d) => d.reduce((a, b) => a + b, 0);

  // Batas atas: sekarang, atau akhir jam kerja bila ditekan sesudahnya.
  let ujung = kini - tarikLog(JEDA_UJUNG, acak);
  if (kini > akhirKerja) {
    ujung = akhirKerja - Math.floor(Math.min(Math.max(Number(acak()) || 0, 0), 1) * SEBARAN_SESUDAH_JAM_KERJA);
  }
  let lantaiEfektif = Math.max(
    Number.isFinite(kejadian) ? kejadian + tarikLog(JEDA_SESUDAH_KEJADIAN, acak) : -Infinity,
    mulaiKerja
  );

  if (ujung - jumlah(jeda) < lantaiEfektif && kini > akhirKerja) {
    // Jam kerja tidak menyisakan ruang - kembali ke jam sekarang.
    ujung = kini - tarikLog(JEDA_UJUNG, acak);
  }
  if (ujung - jumlah(jeda) < lantaiEfektif) {
    let ruang = ujung - lantaiEfektif;
    if (ruang < k - 1) {
      // Lepaskan jeda sesudah kejadian dan jam kerja; tetap SESUDAH kejadiannya.
      lantaiEfektif = Number.isFinite(kejadian) ? kejadian + 1 : -Infinity;
      ujung = kini;
      ruang = ujung - lantaiEfektif;
    }
    if (ruang >= k - 1) {
      const sisa = ruang - (k - 1);
      const total = jumlah(jeda) || 1;
      jeda = jeda.map((d) => 1 + Math.floor((d * sisa) / total));
      catatan.push("jeda_dirapatkan");
    } else {
      // Kejadian sebelumnya tercatat DI DEPAN jam SIPP. Tidak pernah menulis
      // masa depan: rangkaian berakhir tepat pada jam sekarang.
      jeda = jeda.map(() => 1);
      ujung = kini;
      catatan.push("kejadian_sebelumnya_di_depan_jam_sipp");
    }
  }

  const detik = new Array(k);
  detik[k - 1] = ujung;
  for (let i = k - 2; i >= 0; i -= 1) detik[i] = detik[i + 1] - jeda[i];
  const jam = {};
  jenis.forEach((x, i) => {
    jam[x] = teksNaif(detik[i]);
  });
  return { jam, jeda, catatan };
}

/**
 * Kejadian TERAKHIR yang sudah tercatat SIPP pada perkara itu - lantai jam
 * langkah pertama. Riwayat (perkara_proses, termasuk Pendaftaran Perkara) dan
 * cap waktu baris perkara (diinput/diperbaharui) - semuanya jam SIPP.
 */
async function lantaiKejadianPerkara(perkaraId) {
  const baris = await runQuery(
    `SELECT DATE_FORMAT(GREATEST(
              COALESCE((SELECT MAX(pr.diinput_tanggal) FROM perkara_proses pr WHERE pr.perkara_id = p.perkara_id), '1000-01-01'),
              COALESCE(p.diinput_tanggal, '1000-01-01'),
              COALESCE(p.diperbaharui_tanggal, '1000-01-01')), '%Y-%m-%d %H:%i:%s') AS lantai
       FROM perkara p WHERE p.perkara_id = ? LIMIT 1`,
    [Number(perkaraId) || 0]
  ).catch(() => []);
  const teks = Array.isArray(baris) && baris[0] ? String(baris[0].lantai || "") : "";
  return /^1000-/.test(teks) ? "" : teks;
}

/**
 * Jadwal jam SIPP untuk langkah-langkah satu perkara yang AKAN ditulis atau
 * dibongkar sekarang. `saring`: "belum" (tulis - hanya yang belum ada di SIPP)
 * atau "ada" (bongkar - hanya yang masih ada).
 */
async function jadwalJamSipp(perkaraId, urutan, { saring = "", acak } = {}) {
  let daftar = (urutan || []).map((x) => String(x || "").toLowerCase());
  if (saring) {
    const perkara = await keadaanPerkara(perkaraId);
    if (perkara) daftar = daftar.filter((x) => (saring === "ada" ? Boolean(perkara[x]) : !perkara[x]));
  }
  const [sekarang, lantai] = await Promise.all([waktuSipp(), lantaiKejadianPerkara(perkaraId)]);
  return { sekarang, lantai, ...jamRangkaianManusia({ urutan: daftar, sekarang, lantai, acak }) };
}

/** Jam SIPP yang diserahkan pemanggil dalam (rantai) - bentuknya diperiksa. */
function jamSippSah(teks) {
  return /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(String(teks || ""));
}

/**
 * Keterangan audit dalam bentuk yang dipakai SIPP sendiri - tabel HTML berisi
 * nama kolom dan nilainya. Ditiru apa adanya supaya baris audit ALETA terbaca
 * di layar audit SIPP seperti baris lainnya, bukan sebagai teks mentah.
 */
function keteranganAudit(nilai) {
  const baris = Object.entries(nilai)
    // PHP mencetak NULL sebagai teks kosong - '<td></td>' - begitu pula di sini.
    .map(([kolom, isi]) => `<tr><td>${kolom}</td><td>${isi === null || isi === undefined ? "" : String(isi)}</td></tr>`)
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
  // "Primary Key" (bawaan) atau "Foreign Key". insert_penunjukan_panitera dan
  // insert_penunjukan_juru_sita menulis "dengan Foreign Key [perkara_id=...]"
  // pada baris perkara_panitera_pn dan perkara_jurusita.
  jenisKunci = "Primary Key",
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
    ? ` dengan ${jenisKunci} [${kunciSendiri}]`
    : idPerkara > 0
      ? ` dengan ${jenisKunci} [perkara_id=${idPerkara}]`
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
            -- addMajelis_c menolak PMH yang mendahului tanggal pendaftaran.
            p.tanggal_pendaftaran AS tanggalDaftar,
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
 * ============================================================================
 * AKUN SIPP PETUGAS YANG SEDANG MASUK - BUKAN AKUN PEJABAT (butir 39, 5 Okt)
 * ============================================================================
 *
 * Sampai 5 Oktober 2026 penetapan lewat ALETA tercatat di SIPP atas nama
 * PEJABATNYA: PMH dan PHS atas nama "fahri", PPP dan PJS atas nama "Sri
 * Susilowati" - padahal yang menekan tombolnya petugas lain, yang saat itu
 * masuk SIPP dengan akunnya sendiri ("derry briantono", terbaca di
 * sys_user_online dari alamat yang sama). Keputusan pengguna 2 Oktober
 * menutup jalan itu: yang tercatat di sistem luar adalah petugas sesi
 * sungguhan, dan nama petugas LAIN tidak pernah ditulis.
 *
 * Yang dikirim ekstensi adalah sapaan "Selamat Datang <font>...</font>" di
 * kepala halaman SIPP. Diperiksa pada views/header.php SIPP: isinya
 * session->userdata('fullname') - NAMA LENGKAP, bukan username. Sedangkan
 * sys_audittrail.username dan seluruh kolom diinput_oleh menyimpan USERNAME.
 * Karena itu namanya diterjemahkan di sini, dengan urutan yang tidak menebak:
 *
 *   1. username yang persis sama            -> itu (pemanggil lama mengirim username)
 *   2. nama lengkap yang hanya milik satu akun aktif -> akun itu
 *   3. nama lengkap milik beberapa akun (di satker ini meja1g/meja1p sama-sama
 *      "Tiffany RS") -> dipersempit lewat sys_user_online: akun bernama itu
 *      yang HARI INI masuk dari alamat IP peramban yang sama
 *   4. masih ganda atau tidak ada -> DITOLAK, tidak pernah dipilihkan.
 *
 * @returns {Promise<{username:string, fullname:string} | {ganda:true, calon:string[]} | null>}
 */
async function akunPetugasMasuk(nama, ip = "") {
  const teks = cleanText(nama);
  if (!teks) return null;

  const persis = await akunSipp(teks);
  if (persis) return persis;

  const baris = await runQuery(
    `SELECT username, fullname, block FROM sys_users WHERE TRIM(fullname) = ?`,
    [teks]
  ).catch(() => []);
  const semua = (Array.isArray(baris) ? baris : []).filter((x) => x && cleanText(x.username));
  if (semua.length === 0) return null;
  // block 0 = akun aktif. Akun yang diblokir tidak dapat sedang masuk.
  const aktif = semua.filter((x) => String(x.block ?? "0") === "0");
  const calon = aktif.length > 0 ? aktif : semua;
  if (calon.length === 1) return { username: calon[0].username, fullname: calon[0].fullname };

  const alamat = String(ip || "").trim();
  if (alamat) {
    const sesi = await runQuery(
      `SELECT su.username AS username, su.fullname AS fullname
         FROM sys_user_online suo
         JOIN sys_users su ON su.userid = suo.userid
        WHERE TRIM(su.fullname) = ? AND suo.host_address = ? AND DATE(suo.login_time) = CURDATE()
        ORDER BY suo.login_time DESC`,
      [teks, alamat]
    ).catch(() => []);
    const unik = [...new Set((Array.isArray(sesi) ? sesi : []).map((x) => cleanText(x.username)).filter(Boolean))];
    if (unik.length === 1) {
      const satu = sesi.find((x) => cleanText(x.username) === unik[0]);
      return { username: satu.username, fullname: satu.fullname };
    }
  }
  return { ganda: true, calon: calon.map((x) => String(x.username)) };
}

/**
 * ============================================================================
 * AKUN SIPP PEJABAT YANG MENETAPKAN (butir 17, 13 Okt 2026)
 * ============================================================================
 *
 * Keputusan pengguna 13 Okt menggantikan butir 39 (5 Okt) KHUSUS untuk PMH,
 * PPP, PJS, PHS dan pembatalannya: "di riwayat dan sys_audittrail itu tetap
 * pejabatnya yang terinput namanya walaupun yang login akun apapun". Perkara
 * 660/Pdt.G/2026 tercatat "admin" di Riwayat Perkara karena petugasnya masuk
 * SIPP sebagai admin.
 *
 * Kebiasaan satker, diukur di server (perkara_proses, Jan-Agu 2026, 763
 * perkara): PMH 763/763 atas akun Ketua/Wakil Ketua, PPP dan PJS 763/763 atas
 * akun Panitera, PHS 758/763 atas akun ketua majelis perkara itu.
 *
 * Akunnya dipastikan, tidak ditebak: username persis (sys_users.username UNIK),
 * tidak diblokir, tidak kedaluwarsa, dan tertaut ke pejabat (user_hakim atau
 * user_panitera) - akun admin/meja/kasir ditolak. Tidak ada jalan jatuh ke
 * akun yang sedang masuk; akun itu hanya dicatat di jejak ALETA.
 */
function akunHidup(baris) {
  if (!baris) return false;
  if (String(baris.block ?? "0") === "1") return false;
  const habis = baris.kedaluwarsa ? new Date(baris.kedaluwarsa) : null;
  return !(habis instanceof Date && !Number.isNaN(habis.valueOf()) && habis.valueOf() < Date.now());
}

async function akunPejabatPasti(username) {
  const nama = cleanText(username);
  if (!nama) return { ok: false, alasan: "pejabat_belum_dipilih" };
  const baris = await runQuery(
    `SELECT userid, username, fullname, block, user_expired AS kedaluwarsa FROM sys_users WHERE username = ?`,
    [nama]
  ).catch(() => []);
  // Kolasi SIPP tidak membedakan huruf besar-kecil; yang dipakai hanya yang PERSIS.
  const persis = (Array.isArray(baris) ? baris : []).filter((x) => x && String(x.username) === nama);
  if (persis.length === 0) return { ok: false, alasan: "akun_pejabat_tidak_ketemu", username: nama };
  if (persis.length > 1) return { ok: false, alasan: "akun_pejabat_ganda", username: nama };
  const akun = persis[0];
  if (!akunHidup(akun)) return { ok: false, alasan: "akun_pejabat_diblokir", username: nama };
  const taut = await runQuery(
    `SELECT 'hakim' AS jabatan, hakim_id AS id FROM user_hakim WHERE userid = ?
     UNION ALL SELECT 'panitera' AS jabatan, panitera_id AS id FROM user_panitera WHERE userid = ?`,
    [akun.userid, akun.userid]
  ).catch(() => []);
  const daftar = Array.isArray(taut) ? taut : [];
  if (daftar.length === 0) return { ok: false, alasan: "akun_bukan_pejabat", username: nama };
  return {
    ok: true,
    username: String(akun.username),
    fullname: cleanText(akun.fullname),
    hakimId: daftar.filter((x) => x.jabatan === "hakim").map((x) => Number(x.id)),
    paniteraId: daftar.filter((x) => x.jabatan === "panitera").map((x) => Number(x.id)),
  };
}

/** Majelis aktif perkara itu dari perkara_hakim_pn - ketua = jabatan 1 / tunggal 3. */
async function majelisPerkara(perkaraId) {
  const baris = await runQuery(
    `SELECT hakim_id AS hakimId, jabatan_hakim_id AS jabatanId FROM perkara_hakim_pn
      WHERE perkara_id = ? AND tahapan_id = ? AND aktif = 'Y'`,
    [perkaraId, TAHAPAN_TINGKAT_PERTAMA]
  ).catch(() => []);
  const daftar = Array.isArray(baris) ? baris : [];
  const ketua = daftar.find((x) => [1, 3].includes(Number(x.jabatanId)));
  return { hakimId: daftar.map((x) => Number(x.hakimId)), ketuaId: ketua ? Number(ketua.hakimId) : 0 };
}

/** Satu-satunya akun hidup milik seorang hakim (user_hakim) - atau penolakan. */
async function akunUntukHakim(hakimId) {
  const baris = await runQuery(
    `SELECT su.userid, su.username, su.fullname, su.block, su.user_expired AS kedaluwarsa
       FROM user_hakim uh JOIN sys_users su ON su.userid = uh.userid WHERE uh.hakim_id = ?`,
    [hakimId]
  ).catch(() => []);
  const hidup = (Array.isArray(baris) ? baris : []).filter(akunHidup);
  if (hidup.length === 0) return { ok: false, alasan: "akun_ketua_majelis_tidak_ada", hakimId };
  if (hidup.length > 1) {
    return { ok: false, alasan: "akun_ketua_majelis_ganda", hakimId, calon: hidup.map((x) => String(x.username)) };
  }
  return akunPejabatPasti(hidup[0].username);
}

/**
 * Akun SIPP yang DICATAT untuk satu langkah penetapan.
 *
 *   PMH       Ketua / Wakil / Plh Ketua yang dipilih di panel (pejabatUsername)
 *   PPP, PJS  Panitera / Plh Panitera yang dipilih di panel
 *   PHS       ketua majelis perkara itu (perkara_hakim_pn) - atau anggota
 *             majelis yang dipilih di panel; hakim di luar majelis ditolak
 *
 * Penyaringan calon yang sah untuk PMH/PPP/PJS (Ketua/Wakil/Plh; Panitera/Plh)
 * dikerjakan portal, yang tahu penugasan Plh. Di sini akunnya dipastikan.
 */
async function akunPejabatPenetapan(jenis, perkaraId, pejabatUsername, { majelisMenyusul = false } = {}) {
  if (jenis !== "phs") return akunPejabatPasti(pejabatUsername);
  const majelis = await majelisPerkara(perkaraId);
  const dipilih = cleanText(pejabatUsername);
  if (majelis.hakimId.length === 0) {
    // Hanya uji kering yang PMH-nya menyusul pada rantai yang sama.
    if (!majelisMenyusul) return { ok: false, alasan: "pmh_belum_ada" };
    return akunPejabatPasti(dipilih);
  }
  if (!dipilih) {
    if (!majelis.ketuaId) return { ok: false, alasan: "akun_ketua_majelis_tidak_ada" };
    return akunUntukHakim(majelis.ketuaId);
  }
  const akun = await akunPejabatPasti(dipilih);
  if (!akun.ok) return akun;
  if (!akun.hakimId.some((id) => majelis.hakimId.includes(id))) {
    return { ok: false, alasan: "pejabat_phs_bukan_majelis", username: akun.username };
  }
  return akun;
}

/**
 * Akun pembatalan: SAMA dengan akun yang tercatat pada penetapan yang
 * dibatalkan (Riwayat Perkara, perkara_proses.diinput_oleh), bila akun itu
 * akun pejabat yang hidup. Penetapan yang dahulu tercatat atas akun bukan
 * pejabat (admin, 660/Pdt.G/2026) dibatalkan atas pejabat pilihan panel -
 * dengan aturan tolak yang sama. Tidak pernah atas akun yang sedang masuk.
 */
async function akunPembatalan(jenis, perkaraId, pejabatUsername) {
  const jejak = JEJAK_PROSES[jenis];
  const baris = await runQuery(
    `SELECT diinput_oleh AS oleh FROM perkara_proses WHERE perkara_id = ? AND tahapan_id = ? AND proses_id = ? LIMIT 1`,
    [perkaraId, jejak.tahapanId, jejak.prosesId]
  ).catch(() => []);
  const tercatat = cleanText(Array.isArray(baris) && baris[0] ? baris[0].oleh : "");
  if (tercatat) {
    const akun = await akunPejabatPasti(tercatat);
    if (akun.ok) return { ...akun, sumber: "tercatat" };
  }
  const pilihan = await akunPejabatPenetapan(jenis, perkaraId, pejabatUsername);
  if (!pilihan.ok) return { ...pilihan, tercatat };
  return { ...pilihan, sumber: "pilihan" };
}

/** Sabtu atau Minggu - SIPP menolak keduanya untuk tanggal penetapan dan hari sidang. */
function hariLibur(iso) {
  if (!tanggalSah(iso)) return false;
  const hari = new Date(`${iso}T00:00:00Z`).getUTCDay();
  return hari === 0 || hari === 6;
}

/**
 * Tahapan terakhir yang ditulis SIPP sesudah satu baris riwayat.
 *
 * riwayat_perkara_m::updateproses tidak menyalin langkah yang baru ditulis ke
 * tabel perkara. Ia membaca ULANG perkara_proses - ORDER BY tahapan_id DESC,
 * proses_id DESC - dan menulis yang paling akhir. Pada perkara baru keduanya
 * sama; pada perkara yang riwayatnya sudah lebih jauh, tahapan terakhirnya
 * tidak mundur.
 */
function prosesTerakhirSesudah(lama, baru) {
  if (!lama || !(Number(lama.tahapanId) > 0)) return baru;
  const t = Number(lama.tahapanId);
  const p = Number(lama.prosesId) || 0;
  if (t > baru.tahapanId || (t === baru.tahapanId && p > baru.prosesId)) {
    return { tahapanId: t, tahapanText: lama.tahapanText, prosesId: p, prosesText: lama.prosesText };
  }
  return baru;
}

async function prosesTerakhirPerkara(perkaraId) {
  const baris = await runQuery(
    `SELECT tahapan_id AS tahapanId, tahapan_nama AS tahapanText, proses_id AS prosesId, proses_nama AS prosesText
       FROM perkara_proses WHERE perkara_id = ?
      ORDER BY tahapan_id DESC, proses_id DESC, tanggal DESC LIMIT 1`,
    [perkaraId]
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
    // Nama TANPA gelar. add_juru_sita_m::insert_penunjukan_juru_sita menulis
    // perkara_jurusita.jurusita_nama dari kolom `nama`, bukan `nama_gelar` -
    // berbeda dari panitera_pn, yang memakai nama bergelar.
    namaPolos: cleanText(satu.nama) || cleanText(satu.namaGelar),
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
    // nama_gelar untuk hakim_nama dan majelis_hakim_text; `nama` (tanpa gelar)
    // untuk perkara_penetapan.majelis_hakim_nama - begitulah
    // add_majelis_m::insert_penetapan_majelis(_sm) menulisnya.
    `SELECT id AS hakimId, kode, nip, nama_gelar AS nama, nama AS namaPolos FROM hakim_pn WHERE id IN (${isian})`,
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

  // Butir 14: alamat yang tidak diteruskan DIKOSONGKAN, tidak dikarang "127.0.0.1".
  // Alamat peramban petugas - itulah yang dicatat SIPP sendiri
  // ($this->input->ip_address()) untuk pekerjaan yang sama.
  const ip = String(minta.ip || "");

  // ==========================================================================
  // AKUN SIPP YANG SEDANG MASUK - PENEKAN SEBENARNYA, UNTUK JEJAK ALETA SAJA
  // ==========================================================================
  //
  // olehUsername = nama pada kepala halaman SIPP yang dibuka petugas. Ia tetap
  // harus terbaca pasti (akunPetugasMasuk) - itulah penjagaan yang sudah ada
  // sejak butir 39 dan tidak dilonggarkan - tetapi sejak butir 17 (13 Okt
  // 2026) ia TIDAK dicatat di SIPP untuk penetapan: yang dicatat di Riwayat
  // Perkara dan sys_audittrail adalah akun pejabatnya (akunPejabatPenetapan).
  // Data Umum bukan penetapan dan tetap atas akun yang masuk.
  const akunMasuk = await akunPetugasMasuk(minta.olehUsername, ip);
  if (!akunMasuk) {
    // Nama yang dicari IKUT disebutkan - tanpa itu yang membacanya tidak tahu
    // akun mana yang tidak ditemukan.
    return {
      ok: false,
      alasan: "akun_sipp_tidak_ketemu",
      username: String(minta.olehUsername || ""),
    };
  }
  if (akunMasuk.ganda) {
    // Dua akun bernama lengkap sama, dan tidak satu pun terbaca masuk dari
    // peramban ini hari ini - penekannya tidak dapat dicatat dengan pasti.
    return {
      ok: false,
      alasan: "akun_sipp_ganda",
      username: String(minta.olehUsername || ""),
      calon: akunMasuk.calon,
    };
  }

  const operator = cleanText(minta.operator);
  if (!operator) return { ok: false, alasan: "operator_tidak_disebut" };

  // Tanggal setempat (WITA) - untuk pagar tanggal penetapan saja. Jam yang
  // DICATAT di SIPP disusun di bawah, dalam jam SIPP (lihat waktuSipp).
  const saatServer = await waktuBasisData();
  const hariIni = saatServer.slice(0, 10);

  // ==========================================================================
  // PAGAR TANGGAL MILIK SIPP SENDIRI
  // ==========================================================================
  //
  // Keempat controller penetapan SIPP (addMajelis_c, addPanitera_c,
  // addJuruSita_c, addSidangPertama_c) menolak tanggal penetapan yang
  // melebihi hari ini dan yang jatuh pada Sabtu/Minggu. Penetapan yang ditolak
  // SIPP tidak boleh lolos hanya karena ditulis lewat ALETA.
  // Data Umum bukan penetapan - ia tidak bertanggal penetapan dan tidak ikut.
  const penetapan = jenis !== "dataUmum";
  if (penetapan && tanggalSah(hariIni) && minta.tanggalPenetapan > hariIni) {
    return { ok: false, alasan: "tanggal_penetapan_masa_depan", diminta: minta.tanggalPenetapan, hariIni };
  }
  if (penetapan && hariLibur(minta.tanggalPenetapan)) {
    return { ok: false, alasan: "tanggal_penetapan_hari_libur", diminta: minta.tanggalPenetapan };
  }
  const tanggalDaftar = tanggalIso(perkara.tanggalDaftar);
  if (jenis === "pmh" && tanggalDaftar && minta.tanggalPenetapan < tanggalDaftar) {
    return {
      ok: false,
      alasan: "tanggal_penetapan_sebelum_pendaftaran",
      seharusnya: tanggalDaftar,
      diminta: minta.tanggalPenetapan,
    };
  }

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

  const langkah = [];
  // Andaian yang dipakai menyusun rencana ini - kosong pada keadaan biasa.
  // Diteruskan apa adanya ke panel supaya yang membacanya tahu rencana ini
  // dinilai atas keadaan yang BELUM ada, bukan yang sudah.
  const andaian = [];

  // Langkah yang sudah ada dijawab LEBIH DAHULU - tulisRantaiUtuh melewatinya
  // lewat akhiran _sudah_ada, dan itu tidak boleh tertutup penolakan akun.
  if (penetapan && perkara[jenis]) return { ok: false, alasan: `${jenis}_sudah_ada` };

  // ==========================================================================
  // AKUN YANG DICATAT DI SIPP: PEJABATNYA (butir 17, 13 Okt 2026)
  // ==========================================================================
  //
  // Riwayat Perkara (perkara_proses.diinput_oleh), kolom diinput_oleh /
  // diperbaharui_oleh tabel penetapan, dan sys_audittrail.username - seluruhnya
  // akun pejabat, apa pun akun SIPP/ALETA yang sedang masuk. Data Umum tetap
  // atas akun yang masuk.
  let akun = akunMasuk;
  if (penetapan) {
    const pmhMenyusulKering =
      jenis === "phs" &&
      minta.kering === true &&
      Array.isArray(minta.rantaiSebelum) &&
      minta.rantaiSebelum.map((x) => String(x).toLowerCase()).includes("pmh");
    const pejabat = await akunPejabatPenetapan(jenis, perkara.perkaraId, minta.pejabatUsername, {
      majelisMenyusul: pmhMenyusulKering,
    });
    if (!pejabat.ok) return { ...pejabat, jenis };
    akun = pejabat;
    if (jenis === "phs" && pmhMenyusulKering && !perkara.pmh) {
      andaian.push(
        `Akun PHS ${pejabat.username} belum dapat dicocokkan dengan majelis perkara - dipastikan ulang saat menulis, sesudah PMH tersimpan.`
      );
    }
  }

  // ==========================================================================
  // JAM YANG DICATAT DI SIPP - SEPERTI ORANG BEKERJA, DALAM JAM SIPP
  // ==========================================================================
  //
  // Rantai (tulisRantaiUtuh) menyerahkan jam yang sudah disusun untuk seluruh
  // langkahnya sekaligus (saatSipp); langkah tunggal menyusunnya sendiri.
  // Riwayat Perkara dan sys_audittrail satu langkah berbagi jam yang SAMA,
  // sebagaimana satu tekanan Simpan di SIPP.
  // Data Umum: jam SIPP sekarang, tanpa disusun (13 Okt 2026 - SIPP menulis
  // jamnya dalam WIB, NOW() basis data WITA).
  let saat = penetapan ? saatServer : await waktuSipp();
  if (penetapan) {
    saat = jamSippSah(minta.saatSipp)
      ? String(minta.saatSipp)
      : (await jadwalJamSipp(perkara.perkaraId, [jenis])).jam[jenis] || (await waktuSipp());
  }

  // ==========================================================================
  // SATU BARIS AUDIT, BENTUK SIPP - DIBACA DARI SUMBER SIPP SENDIRI
  // ==========================================================================
  //
  // Seluruh baris satu tekanan Simpan di SIPP berbagi akun, alamat, jam, dan
  // nama halaman yang sama - add_audittrail() pada add_majelis_m,
  // add_panitera_m, add_juru_sita_m, add_sidang_pertama_m, dan
  // riwayat_perkara_m menulis datetime date(), ipaddress ip_address(),
  // username session username, formname $namahalaman. Isi description adalah
  // fetch_description($data) - larik yang SAMA yang ditulis ke tabelnya,
  // dengan urutan kunci yang sama. Karena itu tiap langkah di bawah menyusun
  // nilainya dalam urutan kunci larik PHP-nya.
  const audit = (rincian) =>
    barisAudit({ username: akun.username, formulir: jejak.formulir, ip, saat, ...rincian });

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

    // Hakim tunggal BUKAN "Hakim Ketua": add_majelis_m menulis jabatan 3
    // "Hakim Tunggal" dan teks "Hakim Tunggal: ..." bila hanya satu kursi.
    const tunggal = hakim.length === 1;
    const jabatanUntuk = (urutan) =>
      urutan === 0
        ? tunggal
          ? { id: 3, nama: "Hakim Tunggal" }
          : { id: 1, nama: "Hakim Ketua" }
        : { id: 2, nama: "Hakim Anggota" };

    // Bentuk kolom gabungan ditiru dari SIPP: id dipisah koma, kode dipisah
    // garis tegak, nama dipisah </br>. majelis_hakim_nama memakai nama TANPA
    // gelar ($data_hakim->nama), majelis_hakim_text nama bergelar - terbaca
    // pada perkara 10186 yang ditetapkan tangan 5 Okt 2026.
    const idGabung = hakim.map((x) => x.hakimId).join(",");
    const kodeGabung = hakim.map((x) => x.kode || "").join("|");
    const namaGabung = hakim.map((x) => x.namaPolos || x.nama).join("</br>");
    const teksGabung = hakim
      .map((x, i) => `${i === 0 ? jabatanUntuk(0).nama : `Hakim Anggota ${i}`}: ${x.nama}`)
      .join("</br>");

    // ======================================================================
    // SMART MAJELIS: STATUS 1 BILA SUSUNANNYA MAJELIS SK, SELAIN ITU 2
    // ======================================================================
    //
    // Diukur pada 1.112 perkara PA Donggala tahun 2026: susunan yang diterima
    // apa adanya berbaris status 1 - majelis_id menunjuk ref_majelis_tetap,
    // hakim_id berisi susunan itu, hakim_id2 dan keterangan kosong. Yang
    // tidak ada di ref ditulis status 2 beserta sebabnya.
    //
    // Kedua keadaan itu juga DUA JALUR SIPP yang berbeda bentuknya, dan
    // keduanya ditiru utuh (diukur atas penetapan sejak Juni 2026):
    //
    //   status 1  majelis_tetap.php -> insert_penetapan_majelis_sm
    //             jenis_acara NULL, nomor_sk_penetapan NULL, keterangan NULL,
    //             judul hakim_pn "dari halaman <b> Smart Majelis ...</b>"
    //   status 2  addMajelis_c (ism=2) -> insert_penetapan_majelis
    //             jenis_acara '0', nomor_sk_penetapan '', keterangan = sebab,
    //             judul hakim_pn TANPA "Smart Majelis"
    //
    // Sebelum ini ALETA selalu memakai judul Smart Majelis, juga pada status 2.
    const majelisTetap = await majelisTetapUntuk(
      hakim.map((x) => x.hakimId),
      perkara.nomorPerkara,
      perkara.jenisPerkaraId
    );
    const lewatSmart = Boolean(majelisTetap);
    // Sebab yang DITULISKAN ke kolom keterangan SIPP, dan karena itu tidak
    // boleh menyebut ALETA sama sekali.
    const sebabMajelis =
      cleanText(minta.sebabMajelis) ||
      "Ditetapkan menurut giliran majelis dan pemerataan beban perkara";

    // perkara_smartmajelis DITULIS LEBIH DAHULU, sebagaimana kedua jalur SIPP
    // (REPLACE pada majelis_tetap.php, insert/update pada addMajelis_c) - dan
    // tanpa baris audit, sebab SIPP pun tidak pernah mengauditnya.
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
      const keteranganSmart = sebabMajelis.slice(0, 1000);
      langkah.push({
        tabel: "perkara_smartmajelis",
        aksi: perkara.adaSmartMajelis ? "UPDATE" : "INSERT",
        sql: perkara.adaSmartMajelis
          ? `UPDATE perkara_smartmajelis SET hakim_id2 = ?, status = ?, tanggal = ?, keterangan = ?
             WHERE perkara_id = ?`
          : `INSERT INTO perkara_smartmajelis (perkara_id, hakim_id2, status, tanggal, keterangan)
             VALUES (?,?,?,?,?)`,
        params: perkara.adaSmartMajelis
          ? [idGabung, SMART_MAJELIS_DI_LUAR_REKOMENDASI, saat, keteranganSmart, perkara.perkaraId]
          : [perkara.perkaraId, idGabung, SMART_MAJELIS_DI_LUAR_REKOMENDASI, saat, keteranganSmart],
        keterangan: `smart majelis: ${sebabMajelis}`,
      });
    }

    const jenisAcara = lewatSmart ? null : "0";
    const nomorSk = lewatSmart ? null : "";
    const keteranganHakim = lewatSmart ? null : sebabMajelis.slice(0, 500);

    const nilaiPenetapan = {
      perkara_id: perkara.perkaraId,
      jenis_acara: jenisAcara,
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
        ? `UPDATE perkara_penetapan SET jenis_acara = ?, penetapan_majelis_hakim = ?, majelis_hakim_id = ?,
             majelis_hakim_kode = ?, majelis_hakim_nama = ?, majelis_hakim_text = ?,
             diperbaharui_oleh = ?, diperbaharui_tanggal = ?
           WHERE perkara_id = ?`
        : `INSERT INTO perkara_penetapan
             (perkara_id, jenis_acara, penetapan_majelis_hakim, majelis_hakim_id, majelis_hakim_kode,
              majelis_hakim_nama, majelis_hakim_text, diinput_oleh, diinput_tanggal)
           VALUES (?,?,?,?,?,?,?,?,?)`,
      params: perkara.adaPenetapan
        ? [
            jenisAcara,
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
            jenisAcara,
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
      audit({
        tabel: "perkara_penetapan",
        aksi: perkara.adaPenetapan ? "UPDATE" : "INSERT",
        nilai: nilaiPenetapan,
      })
    );

    // ======================================================================
    // SELURUH BARIS HAKIM DULU, BARU BARIS AUDITNYA - SEPERTI insert_batch
    // ======================================================================
    //
    // SIPP menyisipkan ketiganya sekaligus (insert_batch) dengan id yang
    // dihitungnya sendiri - MAX(id)+1, berurutan - lalu menulis satu baris
    // audit per hakim yang MEMUAT id itu pada description-nya. id-nya karena
    // itu dihitung penjalan tepat sebelum barisnya ditulis, dan penanda #ID#
    // pada auditnya diganti dengan id yang sungguh terpakai.
    const nilaiHakimSemua = [];
    const indeksHakim = [];
    hakim.forEach((orang, urutan) => {
      const jabatan = jabatanUntuk(urutan);
      const nilaiHakim = {
        id: "#ID#",
        perkara_id: perkara.perkaraId,
        tahapan_id: TAHAPAN_TINGKAT_PERTAMA,
        tanggal_penetapan: minta.tanggalPenetapan,
        nomor_sk_penetapan: nomorSk,
        urutan: urutan + 1,
        jabatan_hakim_id: jabatan.id,
        jabatan_hakim_nama: jabatan.nama,
        hakim_id: orang.hakimId,
        hakim_kode: orang.kode || "",
        hakim_nip: orang.nip || "",
        hakim_nama: orang.nama,
        aktif: "Y",
        diinput_oleh: akun.username,
        diinput_tanggal: saat,
        keterangan: keteranganHakim,
      };
      nilaiHakimSemua.push(nilaiHakim);
      langkah.push({
        tabel: "perkara_hakim_pn",
        aksi: "INSERT",
        sql:
          `INSERT INTO perkara_hakim_pn
             (id, perkara_id, tahapan_id, tanggal_penetapan, nomor_sk_penetapan, urutan, jabatan_hakim_id,
              jabatan_hakim_nama, hakim_id, hakim_kode, hakim_nip, hakim_nama, aktif,
              diinput_oleh, diinput_tanggal, keterangan)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        params: [
          0,
          perkara.perkaraId,
          TAHAPAN_TINGKAT_PERTAMA,
          minta.tanggalPenetapan,
          nomorSk,
          urutan + 1,
          jabatan.id,
          jabatan.nama,
          orang.hakimId,
          orang.kode || "",
          orang.nip || "",
          orang.nama,
          "Y",
          akun.username,
          saat,
          keteranganHakim,
        ],
        idDihitung: { tabel: "perkara_hakim_pn", posisiParam: 0 },
        keterangan: `${urutan === 0 ? (tunggal ? "hakim tunggal" : "ketua") : `anggota ${urutan}`}: ${orang.nama}`,
      });
      indeksHakim.push(langkah.length - 1);
    });
    nilaiHakimSemua.forEach((nilaiHakim, i) => {
      langkah.push(
        audit({
          tabel: "perkara_hakim_pn",
          // Persis tulisan SIPP: hanya ketiga baris hakim_pn jalur Smart
          // Majelis yang membawa kata itu, dengan spasi di depannya - baris
          // perkara_penetapan dan perkara di sebelahnya tidak.
          judulHalaman: lewatSmart ? ` Smart Majelis ${jejak.formulir}` : undefined,
          aksi: "INSERT",
          nilai: nilaiHakim,
          perkaraId: perkara.perkaraId,
          kunciDariLangkah: { "#ID#": indeksHakim[i] },
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
    // Nama bergelar pada teksnya - "Panitera Pengganti: <nama_gelar>",
    // "Juru Sita Pengganti: <nama_gelar>" - untuk keduanya.
    const teks = `${sebutan}: ${orangNama}`;

    if (!(await sippSkemaService.tabelAda(tabelPetugas))) {
      return { ok: false, alasan: `tabel_${tabelPetugas}_tidak_ada` };
    }

    // ======================================================================
    // TIGA KOLOM, TANPA diperbaharui_*
    // ======================================================================
    //
    // insert_penunjukan_panitera dan insert_penunjukan_juru_sita memperbarui
    // perkara_penetapan dengan TIGA kolom saja - tanggal, id, teks - dan tidak
    // menyentuh diperbaharui_oleh/diperbaharui_tanggal. ALETA dahulu ikut
    // menulis keduanya, dan description auditnya memuat perkara_id,
    // diinput_oleh, dan diinput_tanggal yang tidak pernah ada di baris SIPP.
    const nilaiPenetapan = {
      [kolomTanggal]: minta.tanggalPenetapan,
      [kolomId]: String(orangId),
      [kolomTeks]: teks,
    };
    langkah.push({
      tabel: "perkara_penetapan",
      aksi: perkara.adaPenetapan ? "UPDATE" : "INSERT",
      sql: perkara.adaPenetapan
        ? `UPDATE perkara_penetapan SET ${kolomTanggal} = ?, ${kolomId} = ?, ${kolomTeks} = ? WHERE perkara_id = ?`
        : `INSERT INTO perkara_penetapan
             (perkara_id, ${kolomTanggal}, ${kolomId}, ${kolomTeks}, diinput_oleh, diinput_tanggal)
           VALUES (?,?,?,?,?,?)`,
      params: perkara.adaPenetapan
        ? [minta.tanggalPenetapan, String(orangId), teks, perkara.perkaraId]
        : [perkara.perkaraId, minta.tanggalPenetapan, String(orangId), teks, akun.username, saat],
      keterangan: teks,
    });
    langkah.push(
      audit({
        tabel: "perkara_penetapan",
        aksi: perkara.adaPenetapan ? "UPDATE" : "INSERT",
        nilai: perkara.adaPenetapan
          ? nilaiPenetapan
          : {
              perkara_id: perkara.perkaraId,
              ...nilaiPenetapan,
              diinput_oleh: akun.username,
              diinput_tanggal: saat,
            },
        perkaraId: perkara.perkaraId,
      })
    );

    // Kode dan NIP ikut ditulis, sebagaimana SIPP menulisnya sendiri. id-nya
    // MAX(id)+1 (get_last_id), dan id itu ada di description auditnya.
    //
    // Selisih kecil antara keduanya, ditiru apa adanya:
    //   perkara_panitera_pn  panitera_nama bergelar, kolom keterangan ''
    //   perkara_jurusita     jurusita_nama TANPA gelar, tanpa kolom keterangan
    const kolomOrang = ppp ? "panitera_id" : "jurusita_id";
    const kolomKode = ppp ? "panitera_kode" : "jurusita_kode";
    const kolomNip = ppp ? "panitera_nip" : "jurusita_nip";
    const kolomOrangNama = ppp ? "panitera_nama" : "jurusita_nama";
    const namaPada = ppp ? orangNama : petugas.namaPolos || orangNama;
    const nilaiPetugas = {
      id: "#ID#",
      perkara_id: perkara.perkaraId,
      tahapan_id: TAHAPAN_TINGKAT_PERTAMA,
      tanggal_penetapan: minta.tanggalPenetapan,
      urutan: 1,
      [kolomOrang]: orangId,
      [kolomKode]: petugas.kode,
      [kolomNip]: petugas.nip,
      [kolomOrangNama]: namaPada,
      aktif: "Y",
      diinput_oleh: akun.username,
      diinput_tanggal: saat,
      ...(ppp ? { keterangan: "" } : {}),
    };
    const kolomTulis = Object.keys(nilaiPetugas);
    langkah.push({
      tabel: tabelPetugas,
      aksi: "INSERT",
      sql:
        `INSERT INTO ${tabelPetugas} (${kolomTulis.join(", ")}) ` +
        `VALUES (${kolomTulis.map(() => "?").join(",")})`,
      params: kolomTulis.map((k) => (k === "id" ? 0 : nilaiPetugas[k])),
      // Penjalannya yang mengisi id-nya, tepat sebelum pernyataan ini
      // dijalankan - bukan saat rencana disusun, supaya jaraknya sesempit
      // mungkin dari penulisan yang sesungguhnya. perkara_jurusita bahkan
      // tanpa auto_increment: tanpa ini perkara kedua bertabrakan pada id=0.
      idDihitung: { tabel: tabelPetugas, posisiParam: 0 },
      keterangan: `${sebutan.toLowerCase()}: ${orangNama}`,
    });
    const indeksPetugas = langkah.length - 1;
    langkah.push(
      audit({
        tabel: tabelPetugas,
        aksi: "INSERT",
        nilai: nilaiPetugas,
        // "dengan Foreign Key [perkara_id=...]" - bukan Primary Key. Terbaca
        // pada perkara 10186: 505518 dan 505522.
        jenisKunci: "Foreign Key",
        perkaraId: perkara.perkaraId,
        kunciDariLangkah: { "#ID#": indeksPetugas },
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
    // Tetapi pada UJI KERING ia memagari yang salah: uji kering dijalankan
    // SEBELUM satu baris pun ditulis, jadi pada perkara yang baru didaftarkan
    // PMH memang belum ada. Bila pemanggilnya menyatakan PMH ditulis LEBIH
    // DAHULU dalam rantai yang sama, uji kering menilai PHS seolah-olah PMH
    // sudah ada, dan mengatakan andaian itu apa adanya.
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
    // ======================================================================
    // TANGGAL PILIHAN PETUGAS DITOLAK DENGAN SEBAB, TIDAK PERNAH DIGANTI
    // ======================================================================
    //
    // addSidangPertama_c menolak hari sidang pada Sabtu dan Minggu, kecuali
    // jenis perkara 746. Butir 38: tanggal yang dipilih tangan pernah diganti
    // diam-diam dengan usulan; di sini tanggal yang melanggar tidak diganti
    // apa pun - permintaannya ditolak, dan petugas yang memilih ulang.
    if (Number(perkara.jenisPerkaraId) !== 746 && hariLibur(minta.tanggalSidang)) {
      return { ok: false, alasan: "tanggal_sidang_hari_libur", diminta: minta.tanggalSidang };
    }

    const ruangan = await ruanganUntuk(minta.ruanganId || JADWAL_BAWAAN.ruanganId);
    if (!ruangan) return { ok: false, alasan: "ruangan_tidak_ketemu" };

    const jam = /^\d{2}:\d{2}(:\d{2})?$/.test(String(minta.jamSidang || ""))
      ? String(minta.jamSidang).length === 5
        ? `${minta.jamSidang}:00`
        : String(minta.jamSidang)
      : JADWAL_BAWAAN.jamSidang;
    // Borang SIPP mengirim jam lima huruf ("09:00", exact_length[5]) dan
    // fetch_description mencetaknya apa adanya - kolom TIME-nya sendiri
    // menyimpannya 09:00:00.
    const jamBorang = jam.slice(0, 5);

    // urutan = MAX(urutan)+1 jadwal perkara itu (get_urutan_jadwal_terakhir),
    // bukan 1 yang dipatok.
    const urutanBaris = await runQuery(
      `SELECT COALESCE(MAX(urutan), 0) + 1 AS berikutnya FROM perkara_jadwal_sidang WHERE perkara_id = ?`,
      [perkara.perkaraId]
    ).catch(() => []);
    const urutanJadwal = Number((Array.isArray(urutanBaris) && urutanBaris[0] && urutanBaris[0].berikutnya) || 1) || 1;

    // ======================================================================
    // URUTANNYA DITIRU, BUKAN DIPILIH SENDIRI
    // ======================================================================
    //
    // insert_jadwal_sidang_pertama: perkara_penetapan UPDATE, lalu
    // perkara_jadwal_sidang INSERT, lalu perkara_penetapan_hari_sidang INSERT;
    // sesudahnya dua kali updateproses (80 dan 81), masing-masing satu UPDATE
    // perkara. Kelimanya berbagi detik yang sama, jadi yang membedakan hanya
    // urutan nomornya - dan di layar Audit Trail urutan itulah yang terlihat.
    const nilaiPenetapanHs = {
      penetapan_hari_sidang: minta.tanggalPenetapan,
      sidang_pertama: minta.tanggalSidang,
      diperbaharui_oleh: akun.username,
      diperbaharui_tanggal: saat,
    };
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
      audit({
        tabel: "perkara_penetapan",
        aksi: "UPDATE",
        nilai: nilaiPenetapanHs,
        perkaraId: perkara.perkaraId,
      })
    );

    // Kolom dan urutan kuncinya = $datajsidang pada addSidangPertama_c (aksi
    // add). ikrar_talak, sampai_jam, dan sifat_sidang TIDAK ditulis SIPP
    // pada langkah ini - dibiarkan pada bawaan kolomnya. Diukur sejak Juni
    // 2026: 30 dari 30 jadwal sidang pertama yang belum disunting berisi
    // agenda "Sidang Pertama" dan sampai_jam NULL.
    const nilaiJadwal = {
      perkara_id: perkara.perkaraId,
      verzet: "T",
      keberatan: "T",
      tanggal_sidang: minta.tanggalSidang,
      jam_sidang: jamBorang,
      ruangan: ruangan.nama,
      ruangan_id: ruangan.id,
      agenda: JADWAL_BAWAAN.agenda,
      sidang_keliling: ruangan.keliling ? "Y" : "T",
      ditunda: "T",
      id: "#ID#",
      diinput_oleh: akun.username,
      diinput_tanggal: saat,
      urutan: urutanJadwal,
    };
    // id di depan pada pernyataannya (urutan kolom INSERT tidak berarti apa
    // pun bagi basis data); urutan description tetap urutan larik SIPP.
    const kolomJadwal = ["id", ...Object.keys(nilaiJadwal).filter((k) => k !== "id")];
    langkah.push({
      tabel: "perkara_jadwal_sidang",
      aksi: "INSERT",
      // perkara_jadwal_sidang tanpa auto_increment: id-nya MAX(id)+1, dihitung
      // penjalan. id=0 akan membuat langkah berikutnya - yang menunggu id ini
      // - membacanya sebagai "belum ada" lalu berhenti.
      sql:
        `INSERT INTO perkara_jadwal_sidang (${kolomJadwal.join(", ")}) ` +
        `VALUES (${kolomJadwal.map(() => "?").join(",")})`,
      idDihitung: { tabel: "perkara_jadwal_sidang", posisiParam: kolomJadwal.indexOf("id") },
      params: kolomJadwal.map((k) => (k === "id" ? 0 : k === "jam_sidang" ? jam : nilaiJadwal[k])),
      keterangan: `jadwal sidang pertama ${minta.tanggalSidang} ${jam} di ${ruangan.nama}`,
    });
    const indeksJadwal = langkah.length - 1;
    langkah.push(
      audit({
        tabel: "perkara_jadwal_sidang",
        aksi: "INSERT",
        nilai: nilaiJadwal,
        // id barisnya dihitung saat langkahnya dijalankan - ditandai di sini,
        // diisi jalankanRencana.
        kunciSendiri: "id=#ID#",
        kunciDariLangkah: { "#ID#": indeksJadwal },
      })
    );

    // $datahistoryphs: perkara_id, tahapan_id, tanggal_penetapan,
    // tanggal_sidang, lalu id, jadwalsidang_id, diinput_oleh,
    // diinput_tanggal, keterangan - urutan itulah yang tercetak di audit.
    const nilaiHariSidang = {
      perkara_id: perkara.perkaraId,
      tahapan_id: jejak.tahapanId,
      tanggal_penetapan: minta.tanggalPenetapan,
      tanggal_sidang: minta.tanggalSidang,
      id: "#ID#",
      jadwalsidang_id: "#IDJADWAL#",
      diinput_oleh: akun.username,
      diinput_tanggal: saat,
      keterangan: "Penetapan Hari Sidang Pertama",
    };
    const kolomHariSidang = ["id", ...Object.keys(nilaiHariSidang).filter((k) => k !== "id")];
    langkah.push({
      tabel: "perkara_penetapan_hari_sidang",
      aksi: "INSERT",
      sql:
        `INSERT INTO perkara_penetapan_hari_sidang (${kolomHariSidang.join(", ")}) ` +
        `VALUES (${kolomHariSidang.map(() => "?").join(",")})`,
      params: kolomHariSidang.map((k) => (k === "id" ? 0 : k === "jadwalsidang_id" ? null : nilaiHariSidang[k])),
      // id = MAX(id)+1 (get_last_id_perkara_phs), dan jadwalsidang_id = id
      // baris jadwal sidang yang baru disisipkan.
      idDihitung: { tabel: "perkara_penetapan_hari_sidang", posisiParam: kolomHariSidang.indexOf("id") },
      isiDariLangkah: { indeks: indeksJadwal, posisiParam: kolomHariSidang.indexOf("jadwalsidang_id") },
      keterangan: "penetapan hari sidang pertama",
    });
    const indeksHariSidang = langkah.length - 1;
    langkah.push(
      audit({
        tabel: "perkara_penetapan_hari_sidang",
        aksi: "INSERT",
        kunciSendiri: "id=#ID#",
        kunciDariLangkah: { "#ID#": indeksHariSidang, "#IDJADWAL#": indeksJadwal },
        nilai: nilaiHariSidang,
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

  // ---- Riwayat Perkara dan tahapan terakhir, sama untuk keempatnya --------
  //
  // riwayat_perkara_m::updateproses mengerjakan dua hal BERPASANGAN untuk tiap
  // proses: CALL perkara_proses_update (tanpa baris audit - SIPP tidak pernah
  // mengaudit perkara_proses, nol baris sejak 2016), lalu UPDATE perkara
  // beserta SATU baris audit. PHS memanggilnya dua kali - proses 80 lalu 81 -
  // sehingga urutannya riwayat 80, perkara, riwayat 81, perkara.
  //
  // keterangan riwayat diisi '' - parameter ketujuh prosedur itu, yang pada
  // keempat controller penetapan selalu dikirim kosong.
  //
  // Tahapan terakhir pada tabel perkara dibaca ULANG dari perkara_proses
  // oleh SIPP (ORDER BY tahapan_id DESC, proses_id DESC), bukan disalin dari
  // langkah yang baru ditulis - lihat prosesTerakhirSesudah.
  if (jejak.prosesId > 0) {
    let terakhir = await prosesTerakhirPerkara(perkara.perkaraId);
    const tahap = jejak.lanjutan ? [jejak, jejak.lanjutan] : [jejak];
    for (const langkahTahap of tahap) {
      langkah.push(
        barisRiwayat({
          perkaraId: perkara.perkaraId,
          jejak: langkahTahap,
          tanggal: langkahTahap.tanggalDariSidang ? minta.tanggalSidang : minta.tanggalPenetapan,
          username: akun.username,
          saat,
        })
      );

      terakhir = prosesTerakhirSesudah(terakhir, langkahTahap);
      const nilaiPerkara = {
        tahapan_terakhir_id: terakhir.tahapanId,
        tahapan_terakhir_text: terakhir.tahapanText,
        proses_terakhir_id: terakhir.prosesId,
        proses_terakhir_text: terakhir.prosesText,
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
          terakhir.tahapanId,
          terakhir.tahapanText,
          terakhir.prosesId,
          terakhir.prosesText,
          akun.username,
          saat,
          perkara.perkaraId,
        ],
        keterangan: `tahapan terakhir menjadi ${terakhir.prosesText}`,
      });
      langkah.push(
        audit({
          tabel: "perkara",
          aksi: "UPDATE",
          nilai: nilaiPerkara,
          // nilaiPerkara hanya memuat kolom yang DIUBAH, dan perkara_id bukan
          // salah satunya - judulnya tetap menyebut Primary Key-nya.
          perkaraId: perkara.perkaraId,
        })
      );
    }
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
    // Penekan sebenarnya - hanya untuk jejak ALETA, tidak pernah ditulis ke SIPP.
    akunMasuk: { username: akunMasuk.username, namaLengkap: akunMasuk.fullname },
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

  // ==========================================================================
  // MEMBATALKAN ATAS AKUN PEJABAT YANG SAMA (butir 17, 13 Okt 2026)
  // ==========================================================================
  //
  // Akun yang dicatat SIPP = akun yang tercatat pada penetapan yang dibatalkan
  // (Riwayat Perkara), bila itu akun pejabat yang hidup; selain itu pejabat
  // pilihan panel (olehUsername) dengan aturan tolak yang sama - lihat
  // akunPembatalan. Akun SIPP yang sedang masuk (akunSippMasuk) tetap WAJIB
  // terbaca pasti untuk membongkar sungguhan, tetapi hanya dicatat di jejak
  // ALETA - tidak pernah di SIPP.
  const namaMasuk = cleanText(minta.akunSippMasuk);
  let akunMasuk = null;
  if (namaMasuk) {
    akunMasuk = await akunPetugasMasuk(namaMasuk, String(minta.ip || ""));
    if (akunMasuk && akunMasuk.ganda) {
      return { ok: false, alasan: "akun_sipp_ganda", nama: namaMasuk, calon: akunMasuk.calon };
    }
    if (!akunMasuk) return { ok: false, alasan: "akun_sipp_tidak_ketemu", nama: namaMasuk };
  } else if (minta.kering !== true) {
    return { ok: false, alasan: "akun_sipp_belum_terbaca" };
  }

  const akun = await akunPembatalan(jenis, perkara.perkaraId, minta.olehUsername);
  if (!akun.ok) return { ...akun, jenis };

  const operator = cleanText(minta.operator);
  if (!operator) return { ok: false, alasan: "operator_tidak_disebut" };

  // Jam SIPP seperti orang bekerja - rantai bongkar (hapus-semua) menyerahkan
  // jam yang sudah disusun untuk seluruh langkahnya (saatSipp).
  const saat = jamSippSah(minta.saatSipp)
    ? String(minta.saatSipp)
    : (await jadwalJamSipp(perkara.perkaraId, [jenis])).jam[jenis] || (await waktuSipp());
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
    atasNama: { username: akun.username, namaLengkap: akun.fullname, sumber: akun.sumber },
    // Penekan sebenarnya - hanya untuk jejak ALETA.
    akunMasuk: akunMasuk ? { username: akunMasuk.username, namaLengkap: akunMasuk.fullname } : null,
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

  // Penjalan kueri: bawaannya kolam SIPP biasa (tiap langkah berdiri sendiri).
  // Penulis hasil sidang (sidangHasilService.jalankanRencanaUtuh, 7 Okt 2026)
  // menyerahkan SATU sambungan bertransaksi, supaya langkah yang gagal di
  // tengah tidak meninggalkan langkah sebelumnya tertulis sendirian.
  const jalankan = typeof opsi.kueri === "function" ? opsi.kueri : runQuery;
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
        params[satu.idDihitung.posisiParam] = await idBerikutnya(satu.idDihitung.tabel, jalankan);
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

      const hasil = await jalankan(satu.sql, params);
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
 * ============================================================================
 * SISA PENETAPAN SATU PERKARA: UTUH ATAU BATAL (uji rilis U1, 9 Okt 2026)
 * ============================================================================
 *
 * Sampai 1.188.0 ekstensi mengirim PMH, PPP, PJS, PHS sebagai permintaan
 * terpisah, dan tiap langkah pun ditulis pernyataan demi pernyataan lewat
 * kolam sambungan (lihat catatan jalankanRencana). Gagal di tengah - langkah
 * PJS ditolak, sambungan putus, galat di baris audit - meninggalkan perkara
 * separuh tertulis, dan menekan ulang ditolak "<jenis>_sudah_ada": cacat yang
 * sama dengan tunda 273 (sidangHasilService.jalankanRencanaUtuh).
 *
 * Kini seluruh langkah sisa SATU perkara memakai SATU sambungan dalam SATU
 * transaksi. Rencana tiap langkah disusun DI DALAM transaksi itu
 * (kueriTransaksi), sehingga PPP/PJS/PHS melihat PMH yang baru ditulis. Gagal
 * di langkah mana pun -> ROLLBACK: nol baris tertulis, dan perkara dapat
 * dicoba lagi. Jam SIPP tiap langkah disusun sekali di awal transaksi
 * (jadwalJamSipp, butir 17); jeda manusia sungguhan tetap dijalani.
 *
 * Langkah yang ternyata SUDAH ada (keadaan panel basi) dilewati, bukan gagal.
 *
 * `alat` dapat ditiru uji: { ambilSambungan, jeda }.
 */
const URUTAN_RANTAI = ["pmh", "ppp", "pjs", "phs"];

function ambilSambunganSipp() {
  return new Promise((selesai, gagal) => {
    if (typeof db.getConnection !== "function") {
      gagal(new Error("kolam sambungan SIPP tidak mendukung transaksi"));
      return;
    }
    db.getConnection((galat, sambungan) => (galat ? gagal(galat) : selesai(sambungan)));
  });
}

function pesanTeknisRantai(galat) {
  const kode = galat && galat.code ? `${galat.code}: ` : "";
  return `${kode}${String((galat && (galat.sqlMessage || galat.message)) || galat)}`.slice(0, 300);
}

async function tulisRantaiUtuh(minta, alat = {}) {
  const umum = minta || {};
  const langkahMinta = (Array.isArray(umum.langkah) ? umum.langkah : []).map((x) => ({
    ...(x || {}),
    jenis: String((x && x.jenis) || "").toLowerCase(),
  }));
  if (!langkahMinta.length) return { ok: false, alasan: "rantai_kosong", hasil: [], dipulihkan: true };
  // Urutan PMH -> PPP -> PJS -> PHS, tanpa kembar: urutan itu yang dituntut
  // SIPP (PPP/PJS/PHS menuntut majelis), dan rantai karangan ditolak utuh.
  let posisi = -1;
  for (const satu of langkahMinta) {
    const i = URUTAN_RANTAI.indexOf(satu.jenis);
    if (i <= posisi) return { ok: false, alasan: "rantai_tidak_berurutan", hasil: [], dipulihkan: true };
    posisi = i;
  }

  const ambil = typeof alat.ambilSambungan === "function" ? alat.ambilSambungan : ambilSambunganSipp;
  const jeda =
    typeof alat.jeda === "function"
      ? alat.jeda
      : (jenis) => require("./jedaManusiaService").jeda(jenis, { kering: false });

  let sambungan;
  try {
    sambungan = await ambil();
  } catch (galat) {
    return { ok: false, alasan: "server_sipp_tidak_terhubung", pesan: pesanTeknisRantai(galat), hasil: [], dipulihkan: true };
  }
  const lewat = (sql, params = []) =>
    new Promise((selesai, gagal) => {
      sambungan.query(sql, params, (galat, hasil) => (galat ? gagal(galat) : selesai(hasil)));
    });
  const batalkan = () =>
    lewat("ROLLBACK").then(
      () => true,
      () => false
    );

  const hasil = [];
  let gagal = null;
  try {
    await lewat("START TRANSACTION");
    await kueriTransaksi.run(lewat, async () => {
      // Jam SIPP seluruh langkah yang BELUM ada disusun SEKALI di awal (butir
      // 17): berurutan, berjeda seperti orang bekerja, langkah terakhir tidak
      // melewati jam SIPP sekarang, langkah pertama tidak mendahului kejadian
      // terakhir perkara itu. Jam sebenarnya tetap di jejak ALETA.
      const jadwal = await jadwalJamSipp(
        umum.perkaraId,
        langkahMinta.map((x) => x.jenis),
        { saring: "belum", acak: alat.acak }
      );
      for (const [i, satu] of langkahMinta.entries()) {
        if (i > 0) await jeda("pindah");
        await jeda("simpan");
        const rencana = await susunRencanaTulis({
          ...satu,
          perkaraId: umum.perkaraId,
          tanggalPenetapan: String(umum.tanggalPenetapan || ""),
          olehUsername: String(umum.olehUsername || ""),
          operator: String(umum.operator || ""),
          ip: String(umum.ip || ""),
          kering: false,
          rantaiSebelum: [],
          saatSipp: jadwal.jam[satu.jenis] || "",
        });
        if (!rencana.ok) {
          const alasan = String(rencana.alasan || "ditolak");
          if (/_sudah_ada$/.test(alasan)) {
            hasil.push({ jenis: satu.jenis, ok: false, sudahAda: true, alasan, rencana: null, eksekusi: null });
            continue;
          }
          hasil.push({ jenis: satu.jenis, ok: false, alasan, rencana, eksekusi: null });
          gagal = { alasan, jenis: satu.jenis };
          return;
        }
        const eksekusi = await jalankanRencana(rencana, { kering: false, kueri: lewat });
        hasil.push({ jenis: rencana.jenis, ok: eksekusi.ok === true, alasan: eksekusi.ok ? "" : String(eksekusi.alasan || "gagal"), rencana, eksekusi });
        if (!eksekusi.ok) {
          gagal = { alasan: String(eksekusi.alasan || "gagal"), jenis: rencana.jenis, pesan: eksekusi.pesan || "" };
          return;
        }
      }
    });
    if (gagal) {
      const dipulihkan = await batalkan();
      return { ok: false, ...gagal, dipulihkan, hasil };
    }
    try {
      await lewat("COMMIT");
    } catch (galat) {
      const dipulihkan = await batalkan();
      return { ok: false, alasan: "gagal_menyimpan", pesan: pesanTeknisRantai(galat), dipulihkan, hasil };
    }
    return { ok: true, utuh: true, dipulihkan: false, hasil };
  } catch (galat) {
    const dipulihkan = await batalkan();
    return { ok: false, alasan: "gagal_menulis", pesan: pesanTeknisRantai(galat), dipulihkan, hasil };
  } finally {
    try {
      sambungan.release();
    } catch {
      // Sambungan yang sudah putus tidak perlu dilepas.
    }
  }
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
  // Dipakai blangko tunda/putus Jadwal Sidang (butir 25, 5 Okt 2026).
  ruanganUntuk,
  URUTAN_BONGKAR,
  TANDA_ALETA,
  DAFTAR_TABEL,
  JEJAK_PROSES,
  susunRencanaTulis,
  susunRencanaHapus,
  jalankanRencana,
  // Sisa penetapan satu perkara dalam satu transaksi (uji rilis U1, 9 Okt 2026).
  tulisRantaiUtuh,
  // Jam SIPP seperti orang bekerja (butir 17) - dipakai rute bongkar-semua.
  jadwalJamSipp,
  // Dipakai Kasir jurnal (kasirJurnalService): nama lengkap SIPP -> username.
  akunPetugasMasuk,
  // Diekspor untuk diuji satuan.
  jamRangkaianManusia,
  // Jam SIPP (WIB) - dipakai SELURUH penulis ALETA ke tabel SIPP (13 Okt 2026).
  waktuSipp,
  sqlJamSipp,
  akunPejabatPasti,
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
  // Dipakai penetapanKembaliService (Penetapan kembali dari Jadwal Sidang,
  // 6 Okt 2026) - satu penerjemah akun, satu pembaca petugas, satu aturan
  // tahapan terakhir untuk kedua jalur.
  akunPetugasMasuk,
  hakimUntuk,
  petugasUntuk,
  prosesTerakhirPerkara,
  prosesTerakhirSesudah,
};
