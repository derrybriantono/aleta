"use strict";

/**
 * Nomor antrian sidang, untuk ditempelkan pada jadwal.
 *
 * ============================================================================
 * NOMORNYA HARUS SAMA DENGAN YANG DITERIMA PARA PIHAK
 * ============================================================================
 *
 * Nomor antrian bukan angka yang boleh dihitung sekehendak sendiri. Ia sudah
 * diberitahukan kepada pihak berperkara lewat WhatsApp - "antrian Anda nomor
 * 7" - dan layar jadwal yang menyebut nomor lain untuk perkara yang sama akan
 * dipercaya oleh petugas dan dibantah oleh yang datang.
 *
 * Karena itu rumusnya DISALIN PERSIS dari antrianOnlineService, yang menjawab
 * WhatsApp:
 *
 *     urut menurut waktu ambil TERAWAL di antara kedua pihak,
 *     lalu perkara_id, lalu kode majelis;
 *     hanya baris yang salah satu pihaknya sudah mengambil;
 *     nomornya = urutan barisnya, mulai dari satu.
 *
 * Kalau rumus itu suatu saat diubah, keduanya harus diubah bersamaan. Uji
 * verify-antrian-sidang.js menjaga agar keduanya tidak diam-diam berselisih.
 *
 * ============================================================================
 * ONLINE DAN OFFLINE SATU DERET, BUKAN DUA
 * ============================================================================
 *
 * Yang mengambil antrian lewat WhatsApp dan yang mengambil di mesin antrian
 * masuk deret yang sama, diurut menurut waktu ambilnya. Membuat dua deret
 * terpisah berarti dua orang memegang nomor 3, dan yang dipanggil lebih dulu
 * jadi soal siapa yang berdiri lebih dekat.
 *
 * Kolom `online` hanya menandai ASALNYA, dan itu keterangan - bukan urutan.
 *
 * ============================================================================
 * TABELNYA DI BASIS DATA LAIN
 * ============================================================================
 *
 * antrian_sidang tinggal di skema sipp_turunan_antrian, bukan di SIPP. Ia
 * dibaca lewat sambungan bernama "antrian_sidang" pada daftar koneksi - sama
 * dengan yang dipakai antrianOnlineService - sehingga penyuntingan sambungan
 * dari portal berlaku untuk keduanya sekaligus.
 */

const externalDbService = require("./externalDbService");
const { cleanText } = require("./ecourtTextService");
const { angkaDisidang, keadaanDisidang, ruangDisidang, selesaiDisidang } = require("./antrianDisidang");

/** Sambungan ke skema sipp_turunan_antrian. */
const KUNCI_KONEKSI = "antrian_sidang";

/**
 * Rumus urutan antrian - disalin dari antrianOnlineService.
 *
 * Sengaja TIDAK menyaring tanggal, persis seperti aslinya. Tabel turunan ini
 * memuat hari berjalan saja, dan menambahkan saringan tanggal di sini akan
 * membuat nomor di layar berbeda dari nomor yang sudah diterima orang - yang
 * justru hal yang paling harus dihindari.
 *
 * Bila suatu saat tabelnya memuat lebih dari satu tanggal, yang keliru adalah
 * rumus di antrianOnlineService, dan keduanya harus dibetulkan bersamaan.
 * Layanan ini melaporkan berapa tanggal yang terbaca supaya keadaan itu
 * terlihat, bukan didiamkan.
 */
/**
 * ============================================================================
 * AMBANG "MENUNGGU LAMA" - 40 MENIT, DIMINTA PENGGUNA
 * ============================================================================
 *
 * Empat puluh menit (perhatian) dan enam puluh (mendesak).
 *
 * Saya sempat mengusulkan 30, dan alasannya masih berdiri: 30 dan 60 sudah
 * menjadi batas pita jarak antar-sidang di layar yang sama (BATAS_JARAK
 * [5, 15, 30, 60]), diukur dari 10.989 jarak nyata pada 1.753 kelompok hari x
 * ruang sidang. Empat puluh menjadi batas keenam yang tidak diukur dari apa
 * pun.
 *
 * Alasan itu tidak menang atas keputusan yang memimpin satuan kerja. Berapa
 * lama orang pantas menunggu di ruang tunggunya sendiri bukan pertanyaan yang
 * dijawab sebaran data - ia dijawab orang yang bertanggung jawab atas
 * pelayanannya.
 *
 * Keduanya tetap dapat disetel lewat lingkungan, dan angkanya hidup di SINI
 * saja - bukan ditulis ulang di tiap tempat yang membacanya.
 */
const AMBANG_MENUNGGU_MENIT = Number(process.env.ALETA_ANTRIAN_AMBANG_MENUNGGU || 40);
const AMBANG_MENUNGGU_MENDESAK_MENIT = Number(
  process.env.ALETA_ANTRIAN_AMBANG_MENUNGGU_MENDESAK || 60
);

/**
 * Berapa menit baris ini sudah menunggu, atau null bila tidak dihitung.
 *
 * Yang SUDAH dipanggil tidak dihitung lagi - lihat keterangannya di tempat
 * pemakaiannya. Yang belum mengambil nomor pun tidak: ia tidak sedang
 * menunggu giliran, ia belum datang.
 */
function menitMenungguBaris(baris) {
  const keadaan = keadaanAntrian(baris);
  if (keadaan !== "menunggu") return null;

  // ==========================================================================
  // HANYA BARIS HARI INI
  // ==========================================================================
  //
  // Tabel antrian menyimpan satu baris untuk TIAP tanggal sidang dan tidak
  // pernah dibersihkan saat berganti hari - keterangan itu sudah tertulis di
  // antrianOnlineService, yang menyaringnya dengan CURDATE() karena sebab yang
  // sama.
  //
  // Baris kemarin yang tidak pernah ditandai dipanggil akan terus dihitung:
  // "menunggu 1.500 menit", dan penandanya menyala terus untuk perkara yang
  // tidak ada orangnya di ruang tunggu. Penanda yang selalu menyala berhenti
  // dibaca.
  const hari = isoTanggal(baris.tanggalSidang);
  if (hari && hari !== isoTanggal(new Date())) return null;
  const n = Number(baris.menitSejakAmbil);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

const SQL_URUTAN = `
  SELECT
    a.perkara_id AS perkaraId,
    a.tanggal_sidang AS tanggalSidang,
    a.majelis_hakim_kode AS majelisKode,
    a.ruangan_id AS ruanganId,
    a.no_ruang AS noRuang,
    a.jam_sidang AS jamPanggil,
    a.nama_petugas AS namaPetugas,
    a.disidang AS disidang,
    a.online AS online,
    a.pihak_1 AS pihak1,
    a.pihak_2 AS pihak2,
    a.saksi AS saksi,
    CASE
      WHEN a.pihak_1 IS NOT NULL AND a.pihak_2 IS NOT NULL THEN LEAST(a.pihak_1, a.pihak_2)
      WHEN a.pihak_1 IS NOT NULL THEN a.pihak_1
      ELSE a.pihak_2
    END AS waktuAmbil,
    /*
     * SUDAH BERAPA LAMA MENUNGGU - DIHITUNG MySQL, BUKAN NODE
     * =====================================================================
     *
     * Selisihnya dihitung oleh basis data yang SAMA dengan yang menulis NOW()
     * saat pihaknya mengambil nomor. Tiga sebab, dan ketiganya nyata:
     *
     *   1. Dua basis waktu yang bertemu menghasilkan selisih yang salah tanpa
     *      satu pun galat - peringatan itu sudah tertulis di
     *      kehadiranAntrianService.
     *   2. Kolam koneksi ke mesin antrian dibuat TANPA pilihan zona waktu,
     *      jadi Date bikinan Node dapat bergeser berjam-jam terhadapnya.
     *   3. Jam PC petugas tidak dapat dipercaya sebagai patokan; yang
     *      menghitung di peramban akan mendapat angka yang berbeda-beda di
     *      tiap meja.
     *
     * Angkanya MENTAH - berhenti atau tidaknya ditentukan keadaan, dan itu
     * diputuskan di JavaScript di bawah supaya aturannya terbaca satu tempat.
     */
    TIMESTAMPDIFF(
      MINUTE,
      CASE
        WHEN a.pihak_1 IS NOT NULL AND a.pihak_2 IS NOT NULL THEN LEAST(a.pihak_1, a.pihak_2)
        WHEN a.pihak_1 IS NOT NULL THEN a.pihak_1
        ELSE a.pihak_2
      END,
      NOW()
    ) AS menitSejakAmbil
  FROM sipp_turunan_antrian.antrian_sidang a
  WHERE a.pihak_1 IS NOT NULL OR a.pihak_2 IS NOT NULL
  ORDER BY waktuAmbil ASC, a.perkara_id ASC, a.majelis_hakim_kode ASC`;

/**
 * Baris antrian yang BELUM diambil siapa pun.
 *
 * Dibaca terpisah karena ia tidak punya nomor - dan memberinya nomor nol atau
 * menaruhnya di ekor deret sama-sama menyesatkan. Yang benar: perkaranya
 * terdaftar pada mesin antrian, tetapi belum ada yang datang.
 *
 * Tetap perlu dibaca supaya jadwal dapat membedakan "belum ada yang ambil"
 * dari "tidak terdaftar di mesin antrian sama sekali".
 */
const SQL_BELUM_AMBIL = `
  SELECT
    a.perkara_id AS perkaraId,
    a.tanggal_sidang AS tanggalSidang,
    a.ruangan_id AS ruanganId,
    a.no_ruang AS noRuang,
    a.jam_sidang AS jamPanggil,
    a.disidang AS disidang
  FROM sipp_turunan_antrian.antrian_sidang a
  WHERE a.pihak_1 IS NULL AND a.pihak_2 IS NULL`;

function isoTanggal(nilai) {
  if (!nilai) return "";
  const tanggal = nilai instanceof Date ? nilai : new Date(String(nilai));
  if (Number.isNaN(tanggal.getTime())) return "";
  const bulan = String(tanggal.getMonth() + 1).padStart(2, "0");
  const hari = String(tanggal.getDate()).padStart(2, "0");
  return `${tanggal.getFullYear()}-${bulan}-${hari}`;
}

/** Jam:menit dari sebuah waktu, tanpa detik. */
function jamMenit(nilai) {
  if (!nilai) return "";
  if (nilai instanceof Date) {
    const jam = String(nilai.getHours()).padStart(2, "0");
    const menit = String(nilai.getMinutes()).padStart(2, "0");
    return `${jam}:${menit}`;
  }
  const cocok = /(\d{1,2}):(\d{2})/.exec(String(nilai));
  return cocok ? `${cocok[1].padStart(2, "0")}:${cocok[2]}` : "";
}

/**
 * Keadaan satu antrian, dari kolom-kolom yang dipakai mesin antrian.
 *
 * "dipanggil" = sudah dipanggil MASUK RUANG: sedang disidang (disidang = nomor
 * ruang 1..9) ATAU sudah selesai disidang (10) - lihat antrianDisidang.js.
 * Sampai 1.183.0 hanya 10 yang dikenali, sehingga perkara yang SEDANG di
 * ruang sidang tetap terbaca "menunggu" dan waktu tunggunya terus berdetak.
 * Pembedaan sedang/selesai dibawa terpisah (diRuang, selesaiDisidang) supaya
 * pembaca lama yang hanya mengenal "dipanggil"/"menunggu" tidak berubah.
 */
function keadaanAntrian(baris) {
  const keadaan = keadaanDisidang(baris.disidang);
  if (keadaan === "disidang" || keadaan === "selesai") return "dipanggil";
  return "menunggu";
}

/** Rincian disidang untuk peta antrian: nilai mentah, ruang bila sedang disidang, selesai. */
function rincianDisidang(baris) {
  return {
    disidang: angkaDisidang(baris.disidang),
    diRuang: ruangDisidang(baris.disidang),
    selesaiDisidang: selesaiDisidang(baris.disidang),
  };
}

/**
 * Peta nomor antrian menurut perkara_id, untuk seluruh baris yang terbaca.
 *
 * @returns {Promise<{terbaca: boolean, alasan: string, peta: Record<string, object>, tanggal: string[]}>}
 */
async function petaAntrian() {
  let barisUrut;
  let barisBelum;

  try {
    barisUrut = await externalDbService.query(KUNCI_KONEKSI, SQL_URUTAN, []);
  } catch (galat) {
    // Antrian adalah keterangan TAMBAHAN pada jadwal. Kegagalannya tidak boleh
    // menjatuhkan seluruh layar jadwal - yang benar: jadwalnya tetap tampil,
    // dan kolom antriannya menyebutkan kenapa ia kosong.
    return {
      terbaca: false,
      alasan: externalDbService.sanitizeError
        ? String(externalDbService.sanitizeError(galat)).slice(0, 200)
        : String(galat.message || galat).slice(0, 200),
      peta: {},
      tanggal: [],
    };
  }

  try {
    barisBelum = await externalDbService.query(KUNCI_KONEKSI, SQL_BELUM_AMBIL, []);
  } catch (galat) {
    barisBelum = [];
  }

  const peta = {};
  const tanggal = new Set();

  const daftar = Array.isArray(barisUrut) ? barisUrut : [];
  daftar.forEach((baris, urutan) => {
    const kunci = String(baris.perkaraId || "");
    if (!kunci) return;
    const hari = isoTanggal(baris.tanggalSidang);
    if (hari) tanggal.add(hari);

    peta[kunci] = {
      // Nomornya urutan barisnya, mulai dari satu - persis seperti yang
      // diberitahukan kepada para pihak lewat WhatsApp.
      nomor: urutan + 1,
      tanggalSidang: hari,
      waktuAmbil: jamMenit(baris.waktuAmbil),
      // Menandai ASAL pengambilan, bukan urutan. Keduanya satu deret.
      online: Number(baris.online) === 1,
      // Kedua pihak dicatat sendiri-sendiri: yang datang baru satu pihak
      // adalah keadaan yang berbeda dari yang keduanya sudah hadir.
      pihak1: jamMenit(baris.pihak1),
      pihak2: jamMenit(baris.pihak2),
      saksi: jamMenit(baris.saksi),
      keadaan: keadaanAntrian(baris),
      ...rincianDisidang(baris),
      // ====================================================================
      // BERHENTI BEGITU DIPANGGIL
      // ====================================================================
      //
      // Angka yang terus tumbuh sesudah orangnya masuk ruang sidang adalah
      // angka yang salah - dan ia akan menyalakan penanda "menunggu lama"
      // pada perkara yang justru sedang disidangkan.
      //
      // null, bukan nol: nol berarti baru saja mengambil nomor, keadaan yang
      // sungguh terjadi dan berbeda sama sekali dari "tidak dihitung".
      menitMenunggu: menitMenungguBaris(baris),
      jamPanggil: jamMenit(baris.jamPanggil),
      noRuang: baris.noRuang === null || baris.noRuang === undefined ? null : Number(baris.noRuang),
      ruanganId: baris.ruanganId === null || baris.ruanganId === undefined ? null : Number(baris.ruanganId),
      namaPetugas: cleanText(baris.namaPetugas),
      majelisKode: cleanText(baris.majelisKode),
    };
  });

  for (const baris of Array.isArray(barisBelum) ? barisBelum : []) {
    const kunci = String(baris.perkaraId || "");
    if (!kunci || peta[kunci]) continue;
    const hari = isoTanggal(baris.tanggalSidang);
    if (hari) tanggal.add(hari);

    peta[kunci] = {
      // Belum ada yang mengambil - dan itu BUKAN nomor nol. Memberi nomor
      // kepada yang belum datang berarti menggeser nomor orang lain.
      nomor: null,
      tanggalSidang: hari,
      waktuAmbil: "",
      online: false,
      pihak1: "",
      pihak2: "",
      saksi: "",
      keadaan: "belum-ambil",
      // Tetap dibawa: perkara tanpa nomor pun dapat di-PROSES masuk ruang
      // (mis. sidang yang para pihaknya tidak mengambil nomor).
      ...rincianDisidang(baris),
      // Belum ada yang datang: tidak ada yang menunggu, dan itu bukan nol menit.
      menitMenunggu: null,
      jamPanggil: jamMenit(baris.jamPanggil),
      noRuang: baris.noRuang === null || baris.noRuang === undefined ? null : Number(baris.noRuang),
      ruanganId: baris.ruanganId === null || baris.ruanganId === undefined ? null : Number(baris.ruanganId),
      namaPetugas: "",
      majelisKode: "",
    };
  }

  return {
    terbaca: true,
    alasan: "",
    peta,
    // Dilaporkan supaya keadaan "tabelnya memuat lebih dari satu tanggal"
    // terlihat. Pada keadaan itu nomor antriannya patut diragukan, sebab
    // rumus yang dipakai WhatsApp pun tidak menyaring tanggal.
    tanggal: [...tanggal].sort(),
    jumlahDiambil: daftar.length,
  };
}

/**
 * Antrian untuk sekumpulan perkara saja.
 *
 * Nomornya tetap dihitung dari SELURUH deret, bukan dari perkara yang diminta -
 * nomor antrian adalah kedudukan dalam satu deret bersama, dan menghitungnya
 * ulang atas sebagian daftar akan menghasilkan angka yang tidak pernah
 * disebutkan kepada siapa pun.
 */
async function antrianUntukPerkara(daftarPerkaraId = []) {
  return saringUntukPerkara(await petaAntrian(), daftarPerkaraId);
}

/**
 * Menyaring hasil petaAntrian yang SUDAH dibaca - tanpa membaca ulang.
 *
 * Dipisah supaya rute jadwal sidang dapat membaca peta penuh SEKALI lalu
 * memakainya dua kali: disaring untuk layar, dan utuh untuk buku waktu
 * antrian (antrianWaktuService), yang memerlukan nomor seluruh perkara hari
 * itu - termasuk yang tidak tampil - sebab mereka tetap menjadi tetangga
 * dalam hitungan jarak antar sidang.
 */
function saringUntukPerkara(hasil, daftarPerkaraId = []) {
  if (!hasil || !hasil.terbaca) return hasil;

  const diminta = new Set(daftarPerkaraId.map((x) => String(x)));
  if (diminta.size === 0) return hasil;

  const peta = {};
  for (const [kunci, nilai] of Object.entries(hasil.peta)) {
    if (diminta.has(kunci)) peta[kunci] = nilai;
  }

  return { ...hasil, peta };
}

module.exports = {
  AMBANG_MENUNGGU_MENIT,
  AMBANG_MENUNGGU_MENDESAK_MENIT,
  KUNCI_KONEKSI,
  SQL_BELUM_AMBIL,
  SQL_URUTAN,
  antrianUntukPerkara,
  jamMenit,
  keadaanAntrian,
  rincianDisidang,
  petaAntrian,
  saringUntukPerkara,
};
