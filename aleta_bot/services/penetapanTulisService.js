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
function waktuLangkah({ perkaraId, tanggalPenetapan, jenis, saatServer }) {
  const urutan = URUTAN_LANGKAH_WAKTU[jenis];
  // Data Umum bukan penetapan dan tidak ikut dalam rangkaian ini.
  if (urutan === undefined || !tanggalSah(tanggalPenetapan)) return saatServer;

  const benih = benihDari(perkaraId);

  // Titik mulai dan jeda tiap langkah - keduanya tetap bagi satu perkara.
  let menit = JAM_MULAI_PALING_AWAL + (benih % LEBAR_JENDELA_MULAI);
  for (let i = 0; i < urutan; i += 1) menit += jedaLangkah(benih, i);
  // Detiknya punya benih SENDIRI, yang ikut memuat urutan langkahnya.
  //
  // Dua kali salah sebelum bentuk ini. Mula-mula detiknya diambil dari sisa
  // bagi yang sama dengan menitnya, sehingga dua perkara yang menitnya
  // kebetulan sama selalu identik sampai ke detik. Lalu diambil dari bagian
  // lain benihnya - benar antar perkara, tetapi TETAP bagi keempat langkah
  // satu perkara: dibaca di layar Audit Trail, PMH, PPP, PJS, dan PHS
  // seluruhnya berakhiran detik yang sama persis. Terbaca di basis data pada
  // 12 September 2026: 11:53:41, 11:57:41, 12:07:41, 12:09:41.
  //
  // Empat keputusan yang ditulis manusia pada empat waktu yang berbeda tidak
  // mungkin sedetik pun sama, jadi urutan langkahnya ikut menentukan detiknya.
  //
  // Bagian pertamanya - benih dibagi lebar jendela - yang memisahkan satu
  // perkara dari perkara lain; itu yang membuat 3.000 perkara pada tanggal
  // yang sama tidak ada satu pun yang jam mulainya kembar. Dua bagian
  // berikutnya yang memisahkan langkah satu dari langkah lain di dalam satu
  // perkara.
  //
  // Benih baru dari perkaraId dan urutan SUDAH DICOBA dan justru merusak yang
  // pertama: nomor perkara yang beruntun membuat benihnya melangkah dengan
  // kelipatan empat, sehingga sisa bagi 60-nya hanya pernah jatuh pada 15
  // nilai - dan 862 dari 3.000 perkara kembali kembar jam mulainya.
  const detik = (Math.floor(benih / LEBAR_JENDELA_MULAI) + jedaLangkah(benih, urutan) * 7 + urutan * 13) % 60;

  // Seluruh rangkaian digeser mundur bila ujungnya akan melampaui jam
  // sekarang. Yang dihitung ujungnya - PHS - supaya urutannya tetap utuh.
  let menitAkhir = JAM_MULAI_PALING_AWAL + (benih % LEBAR_JENDELA_MULAI);
  for (let i = 0; i < 3; i += 1) menitAkhir += jedaLangkah(benih, i);

  const cocokServer = /^(\d{4}-\d{2}-\d{2}) (\d{2}):(\d{2}):(\d{2})$/.exec(String(saatServer || ""));
  if (cocokServer && cocokServer[1] === tanggalPenetapan) {
    const menitServer = Number(cocokServer[2]) * 60 + Number(cocokServer[3]);
    if (menitAkhir > menitServer) {
      const geser = menitAkhir - menitServer;
      menit -= geser;
      // Tidak pernah mundur melewati tengah malam. Pada jam yang sangat pagi
      // rangkaiannya dirapatkan ke awal hari, bukan dilempar ke hari sebelumnya.
      if (menit < 0) menit = Math.max(0, urutan);
    }
  }

  const jam = Math.floor(menit / 60);
  const sisa = menit % 60;
  return `${tanggalPenetapan} ${duaAngkaWaktu(jam)}:${duaAngkaWaktu(sisa)}:${duaAngkaWaktu(detik)}`;
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
function barisAudit({ username, operator, tabel, formulir, aksi, nilai, perkaraId, ip, saat }) {
  // Kunci utamanya diambil dari nilai yang ditulis bila tidak disebut - tiap
  // baris pada berkas ini selalu membawa perkara_id.
  const idPerkara = Number(perkaraId || (nilai && nilai.perkara_id) || 0);
  const kunci = idPerkara > 0 ? ` dengan Primary Key [perkara_id=${idPerkara}]` : "";
  return {
    tabel: "sys_audittrail",
    aksi: "INSERT",
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
      `${aksi} table <b>${tabel}</b> dari halaman <b>${formulir}</b>${kunci}`,
      // Provenansinya di sini, bukan di judul: terbaca ketika [detil] dibuka,
      // tanpa membuat tiap baris menonjol di daftar.
      keteranganAudit(nilai) +
        `<br>${TANDA_ALETA}${operator ? ` diisikan operator ${operator}` : ""}`,
    ],
    keterangan: `catatan audit ${tabel} atas nama ${username}`,
  };
}

/** Perkara beserta keadaan penetapannya - dibaca sebelum apa pun ditulis. */
async function keadaanPerkara(perkaraId) {
  const id = Number(perkaraId);
  if (!Number.isFinite(id) || id <= 0) return null;

  const baris = await runQuery(
    `SELECT p.perkara_id AS perkaraId, p.nomor_perkara AS nomorPerkara,
            pen.perkara_id AS adaPenetapan,
            pen.penetapan_majelis_hakim AS pmh,
            pen.penetapan_panitera_pengganti AS ppp,
            pen.penetapan_jurusita AS pjs,
            pen.penetapan_hari_sidang AS phs,
            -- Dipakai membongkar: yang dihapus hanya baris yang BENAR-BENAR
            -- ditulis penetapan ini, dicocokkan pada id petugas dan tanggalnya.
            pen.panitera_pengganti_id AS pppId,
            pen.jurusita_id AS pjsId,
            sm.perkara_id AS adaSmartMajelis
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
  if (!akun) return { ok: false, alasan: "akun_pejabat_tidak_ketemu" };

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
  const tanggalTerpakai = ["pmh", "ppp", "pjs", "phs"]
    .filter((x) => x !== jenis)
    .map((x) => tanggalIso(perkara[x]))
    .find(Boolean);
  if (tanggalTerpakai && tanggalTerpakai !== minta.tanggalPenetapan) {
    return {
      ok: false,
      alasan: "tanggal_penetapan_tidak_sama",
      seharusnya: tanggalTerpakai,
      diminta: minta.tanggalPenetapan,
    };
  }

  const saatServer = await waktuBasisData();
  // Jam yang DICATAT ke SIPP - berjarak satu sampai sepuluh menit tiap
  // langkah, tidak pernah melampaui jam sekarang. Jam peladen tidak disentuh.
  const saat = waktuLangkah({
    perkaraId: perkara.perkaraId,
    tanggalPenetapan: minta.tanggalPenetapan,
    jenis,
    saatServer,
  });
  const ip = String(minta.ip || "127.0.0.1");
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
        operator,
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
    const sebabMajelis = cleanText(minta.sebabMajelis) || "Ditetapkan lewat giliran majelis ALETA";
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
    langkah.push(
      barisAudit({
        username: akun.username,
        operator,
        tabel: "perkara_smartmajelis",
        formulir: jejak.formulir,
        aksi: perkara.adaSmartMajelis ? "UPDATE" : "INSERT",
        nilai: nilaiSmart,
        ip,
        saat,
      })
    );

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
          operator,
          tabel: "perkara_hakim_pn",
          formulir: jejak.formulir,
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
        operator,
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
        operator,
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
        operator,
        tabel: "perkara_jadwal_sidang",
        formulir: jejak.formulir,
        aksi: "INSERT",
        nilai: nilaiJadwal,
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
    langkah.push(
      barisAudit({
        username: akun.username,
        operator,
        tabel: "perkara_penetapan_hari_sidang",
        formulir: jejak.formulir,
        aksi: "INSERT",
        nilai: {
          perkara_id: perkara.perkaraId,
          tahapan_id: jejak.tahapanId,
          jadwalsidang_id: "<id jadwal sidang baru>",
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
        operator,
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
          operator,
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
          operator,
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
  if (jejak.prosesId > 0) {
    const riwayat = barisRiwayat({
      perkaraId: perkara.perkaraId,
      jejak,
      tanggal: minta.tanggalPenetapan,
      username: akun.username,
      saat,
    });
    langkah.push(riwayat);
    langkah.push(
      barisAudit({
        username: akun.username,
        operator,
        tabel: "perkara_proses",
        formulir: jejak.formulir,
        aksi: "INSERT",
        nilai: riwayat.nilaiRiwayat,
        perkaraId: perkara.perkaraId,
        ip,
        saat,
      })
    );
  }

  // ---- jejak pada tabel perkara, sama untuk keempatnya --------------------
  const nilaiPerkara = {
    tahapan_terakhir_id: jejak.tahapanId,
    tahapan_terakhir_text: jejak.tahapanText,
    proses_terakhir_id: jejak.prosesId,
    proses_terakhir_text: jejak.prosesText,
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
      jejak.tahapanId,
      jejak.tahapanText,
      jejak.prosesId,
      jejak.prosesText,
      akun.username,
      saat,
      perkara.perkaraId,
    ],
    keterangan: `tahapan terakhir menjadi ${jejak.prosesText}`,
  });
  langkah.push(
    barisAudit({
      username: akun.username,
      operator,
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
        keterangan: `membongkar majelis hakim tanggal ${perkara.pmh}`,
      },
    ];
  }
  if (jenis === "ppp") {
    return [
      {
        tabel: "perkara_panitera_pn",
        sql: `DELETE FROM perkara_panitera_pn WHERE perkara_id = ? AND tahapan_id = ? AND tanggal_penetapan = ? AND panitera_id = ?`,
        params: [perkara.perkaraId, TAHAPAN_TINGKAT_PERTAMA, perkara.ppp, String(perkara.pppId ?? "")],
        keterangan: `membongkar panitera pengganti tanggal ${perkara.ppp}`,
      },
    ];
  }
  if (jenis === "pjs") {
    return [
      {
        tabel: "perkara_jurusita",
        sql: `DELETE FROM perkara_jurusita WHERE perkara_id = ? AND tahapan_id = ? AND tanggal_penetapan = ? AND jurusita_id = ?`,
        params: [perkara.perkaraId, TAHAPAN_TINGKAT_PERTAMA, perkara.pjs, String(perkara.pjsId ?? "")],
        keterangan: `membongkar juru sita tanggal ${perkara.pjs}`,
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
      keterangan: `membongkar penetapan hari sidang tanggal ${perkara.phs}`,
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
    if (masih[jenis]) return JEJAK_PROSES[jenis];
  }
  // Tidak ada penetapan yang tersisa - kembali ke pendaftaran, sama seperti
  // perkara yang baru didaftarkan kasir.
  return { tahapanId: 10, tahapanText: "Pendaftaran Perkara", prosesId: 10, prosesText: "Pendaftaran Perkara" };
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
  const menghalangi = sesudah.filter((x) => Boolean(perkara[x]));
  if (menghalangi.length > 0) {
    return { ok: false, alasan: "langkah_sesudahnya_masih_ada", langkah: menghalangi };
  }

  const akun = await akunSipp(minta.olehUsername);
  if (!akun) return { ok: false, alasan: "akun_pejabat_tidak_ketemu" };

  const operator = cleanText(minta.operator);
  if (!operator) return { ok: false, alasan: "operator_tidak_disebut" };

  const saat = await waktuBasisData();
  const ip = String(minta.ip || "127.0.0.1");
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
    langkah.push(
      barisAudit({
        username: akun.username,
        operator,
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
      operator,
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
  langkah.push({
    tabel: "perkara_proses",
    aksi: "DELETE",
    sql: `DELETE FROM perkara_proses WHERE perkara_id = ? AND tahapan_id = ? AND proses_id = ?`,
    params: [perkara.perkaraId, jejak.tahapanId, jejak.prosesId],
    keterangan: `membongkar riwayat: ${jejak.prosesText}`,
  });
  langkah.push(
    barisAudit({
      username: akun.username,
      operator,
      tabel: "perkara_proses",
      formulir: jejak.formulir,
      aksi: "DELETE",
      nilai: { perkara_id: perkara.perkaraId, tahapan_id: jejak.tahapanId, proses_id: jejak.prosesId },
      perkaraId: perkara.perkaraId,
      ip,
      saat,
    })
  );

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
      operator,
      tabel: "perkara",
      formulir: jejak.formulir,
      aksi: "UPDATE",
      nilai: {
        tahapan_terakhir_id: kembali.tahapanId,
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

module.exports = {
  TANDA_ALETA,
  DAFTAR_TABEL,
  JEJAK_PROSES,
  susunRencanaTulis,
  susunRencanaHapus,
  jalankanRencana,
  // Diekspor untuk diuji satuan.
  waktuLangkah,
  // Diekspor untuk diuji satuan.
  keteranganAudit,
  waktuMysql,
};
