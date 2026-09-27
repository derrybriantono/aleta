"use strict";

/**
 * ============================================================================
 * PETA PERKARA - DARI MANA PERKARA DATANG, DAN KENAPA
 * ============================================================================
 *
 * Menjawab pertanyaan yang tidak dapat dijawab daftar perkara: desa mana yang
 * paling banyak berperkara, faktor apa yang paling sering disebut, dan siapa
 * yang lebih sering datang - laki-laki atau perempuan.
 *
 * ============================================================================
 * TIDAK ADA PETA GEOGRAFIS, DAN ITU KEPUTUSAN YANG DIUKUR
 * ============================================================================
 *
 * Tabel `kode_pos` memang memuat kolom lintang dan bujur, dan mula-mula peta
 * titik memang dibangun dari sana. Dua hal membatalkannya - keduanya terukur,
 * bukan dikhawatirkan:
 *
 *   1. KOLOMNYA TERTUKAR. `longitude` memuat lintang, `latitude` memuat bujur.
 *      Banawa tercatat longitude -0,6723 dan latitude 119,7402, sedangkan
 *      Donggala memang berada di -0,67 lintang dan 119,74 bujur. Dari 2.023
 *      baris Sulawesi Tengah, NOL masuk akal bila dibaca apa adanya.
 *
 *   2. DAN SESUDAH DITUKAR PUN, KOORDINATNYA SALAH. Diperiksa per kabupaten:
 *      keenam belas kabupaten Sulawesi Tengah masing-masing hanya punya SATU
 *      titik - bukan satu per kecamatan - dan sebagian titik itu berada di
 *      pulau yang sama sekali lain:
 *
 *          Banggai          -10,2065 / 120,3529   Laut Sawu, dekat Sumba
 *          Morowali Utara    -4,5536 / 136,0339   PAPUA
 *          Dolo             -10,8471 / 122,8647   selatan Sumba
 *          Marawola (Sigi)    1,1615 / 124,4393   dekat Manado
 *
 *      Donggala sendiri benar (-0,6723 / 119,7402), dan justru itu yang
 *      membuatnya berbahaya: petanya akan tampak masuk akal bagi yang melihat
 *      Donggala, lalu diam-diam salah untuk seluruh kabupaten lain.
 *
 * Peta yang salah lebih buruk daripada tidak ada peta - tidak ada yang
 * memeriksa peta. Yang dibangun di sini karena itu sebaran BERJENJANG:
 * provinsi -> kabupaten -> kecamatan -> desa, seluruhnya dari kode wilayah
 * resmi, tanpa satu pun koordinat yang dikarang.
 *
 * ============================================================================
 * DAN SEKARANG ADA PETANYA - TETAPI KOORDINATNYA DARI SUMBER LAIN
 * ============================================================================
 *
 * Sejak 2.24.0 peta titiknya ada. Koordinatnya TIDAK datang dari `kode_pos`
 * dan tidak datang dari SIPP sama sekali - seluruh basis data SIPP disisir
 * lewat information_schema dan `kode_pos` adalah satu-satunya tabel yang punya
 * kolom lintang/bujur. Titiknya datang dari OpenStreetMap, dijodohkan SEKALI
 * di luar portal, disimpan berkunci kode wilayah BPS, dan yang tidak
 * berhasil dijodohkan tidak ditaruh di peta sama sekali.
 *
 * Yang dikirim dari sini hanya HITUNGANNYA per kode desa (lihat titikDesa).
 * Layanan ini tidak tahu-menahu soal koordinat, dan memang tidak boleh tahu:
 * begitu koordinat masuk ke sini, ia akan ikut tersimpan pada jawaban yang
 * disinggah dan berumur lebih panjang daripada sumbernya.
 *
 * ============================================================================
 * KODE WILAYAH BUKAN NAMA WILAYAH
 * ============================================================================
 *
 *     pihak.kecamatan   "72.10.01"   bukan "Sigi Biromaru"
 *     pihak.kabupaten   "72.10"      bukan "Kabupaten Sigi"
 *
 * Sebaran yang dibangun langsung dari kolom itu akan menuliskan "72.10.01"
 * sebagai nama tempat. Penawarnya ada di basis data yang sama:
 * ref_provinsi_new (34), ref_kabupaten_new (514), ref_kecamatan_new (7.314),
 * ref_kelurahan_new (80.124).
 *
 * ============================================================================
 * HANYA SEBAGIAN PERKARA YANG BERALAMAT
 * ============================================================================
 *
 * Terukur atas seluruh basis data: 4.218 dari 14.136 pihak penggugat punya
 * alamat - 30%. Pada perceraian saja 2.375 dari 5.470 - 43%.
 *
 * Sebaran dari 43% data akan tampak berwibawa sambil menyembunyikan lebih dari
 * separuh kenyataan. Angka itu DIPULANGKAN bersama datanya dan harus tampil di
 * layar.
 */

const db = require("../db_config");

/** Tingkat wilayah yang dapat dipilih, dari yang terluas. */
const TINGKAT = ["provinsi", "kabupaten", "kecamatan", "kelurahan"];

/**
 * Kelompok perkara yang digabung dalam satu halaman.
 *
 * Perceraian digabung atas permintaan satker - cerai gugat dan cerai talak
 * adalah peristiwa yang sama dilihat dari dua pihak, dan memisahkannya menjadi
 * dua halaman membuat seluruh angka perceraian harus dijumlahkan sendiri oleh
 * pembacanya. Yang membedakan keduanya di layar cukup warna dan penanda.
 */
const KELOMPOK = {
  perceraian: {
    nama: "Perceraian (Gugat + Talak)",
    jenis: ["Cerai Gugat", "Cerai Talak"],
    penanda: { "Cerai Gugat": "merah", "Cerai Talak": "biru" },
  },
};

/**
 * ============================================================================
 * GOLONGAN BULATAN PETA - DIBACA LEWAT jenis_perkara_id, BUKAN LEWAT NAMANYA
 * ============================================================================
 *
 * Satker meminta bulatan peta dapat dipilih: seluruh perkara, cerai (talak +
 * gugat), dispensasi kawin, itsbat nikah, dan lainnya. Penggolongannya memakai
 * NOMOR jenis perkara, sebab namanya tidak dapat dipercaya - terukur di
 * sipp_donggala 27 Sep 2026:
 *
 *     id 360   "Pengesahan Perkawinan/Istbat Nikah"   3.964 perkara
 *              "Istbat Nikah"                            89 perkara
 *
 * Satu jenis, DUA ejaan pada kolom namanya - dan tak satu pun berbunyi
 * "itsbat". Pola kata "itsbat" akan menemukan nol dari 4.053 perkara itu.
 *
 * Jumlah per golongan pada perkara DIPUTUS seluruh basis data (dasar peta):
 *
 *     cerai        5.470   (346 cerai talak + 347 cerai gugat)
 *     itsbat       4.045   (360)
 *     dispensasi     195   (362)
 *     lainnya        283   (sisanya: P3HP, perwalian, kewarisan, ...)
 *     seluruhnya   9.993
 *
 * Cerai dipecah dua KELAS di sini - gugat dan talak - bukan satu, sebab warna
 * merah-biru keduanya keputusan satker (lihat penanda KELOMPOK di atas) dan
 * layar harus tetap dapat membedakannya di dalam golongan "cerai".
 */
const KELAS_JENIS = Object.freeze({
  ceraiGugat: Object.freeze([347]),
  ceraiTalak: Object.freeze([346]),
  dispensasi: Object.freeze([362]),
  itsbat: Object.freeze([360]),
});

/** Urutan kelas yang dikirim ke layar; yang tidak dikenali jatuh ke "lainnya". */
const KELAS_PETA = Object.freeze(["ceraiGugat", "ceraiTalak", "dispensasi", "itsbat", "lainnya"]);

/** Golongan yang dapat dipilih layar - tiap golongan gabungan beberapa kelas. */
const GOLONGAN_PETA = Object.freeze({
  semua: KELAS_PETA,
  cerai: Object.freeze(["ceraiGugat", "ceraiTalak"]),
  dispensasi: Object.freeze(["dispensasi"]),
  itsbat: Object.freeze(["itsbat"]),
  lainnya: Object.freeze(["lainnya"]),
});

/** Kelas satu nomor jenis perkara. */
function kelasJenis(jenisPerkaraId) {
  const id = Number(jenisPerkaraId);
  for (const kelas of Object.keys(KELAS_JENIS)) {
    if (KELAS_JENIS[kelas].includes(id)) return kelas;
  }
  return "lainnya";
}

/** Golongan satu kelas - cerai gugat dan cerai talak sama-sama "cerai". */
function golonganKelas(kelas) {
  for (const golongan of ["cerai", "dispensasi", "itsbat"]) {
    if (GOLONGAN_PETA[golongan].includes(kelas)) return golongan;
  }
  return "lainnya";
}

/**
 * Saringan SQL satu golongan, atau null bila golongannya tidak dikenal.
 *
 * Dibaca lewat hasOwnProperty: nama golongan datang dari peramban, dan
 * "constructor" pada objek biasa memulangkan fungsi - bukan "tidak ada".
 */
function saringGolongan(golongan, alias = "pk") {
  const kunci = String(golongan || "");
  if (!Object.prototype.hasOwnProperty.call(GOLONGAN_PETA, kunci)) return null;
  if (kunci === "semua") return { sql: "1 = 1", params: [] };
  if (kunci === "lainnya") {
    const dikenal = Object.values(KELAS_JENIS).flat();
    return {
      sql: `(${alias}.jenis_perkara_id IS NULL OR ${alias}.jenis_perkara_id NOT IN (${dikenal.map(() => "?").join(",")}))`,
      params: dikenal,
    };
  }
  const id = GOLONGAN_PETA[kunci].flatMap((kelas) => KELAS_JENIS[kelas]);
  return { sql: `${alias}.jenis_perkara_id IN (${id.map(() => "?").join(",")})`, params: id };
}

/**
 * Cermin `saringJenis` untuk baris yang sudah di tangan.
 *
 * Sejak peta membawa SELURUH jenis, kuerinya tidak lagi menyaring jenis - yang
 * menyaring daftar dan kartu kini fungsi ini. Ia harus menjawab PERSIS seperti
 * `jenis_perkara_text IN (...)` di MySQL, dan kolasi MySQL tidak membedakan
 * besar-kecil huruf dan mengabaikan spasi di ekor. Perbandingan polos di Node
 * akan kehilangan "Cerai gugat" yang ditemukan MySQL tanpa berbunyi apa-apa.
 * Kesamaannya diukur atas sipp_donggala untuk tiap kelompok di menu.
 */
const samakanTeksJenis = (x) => String(x === null || x === undefined ? "" : x).replace(/\s+$/, "").toLowerCase();

function cocokKelompok(baris, kelompok) {
  if (baris.jenisPerkara === null || baris.jenisPerkara === undefined) return false;
  const teks = samakanTeksJenis(baris.jenisPerkara);
  const kel = Object.prototype.hasOwnProperty.call(KELOMPOK, kelompok) ? KELOMPOK[kelompok] : null;
  if (kel) return kel.jenis.some((j) => samakanTeksJenis(j) === teks);
  return teks === samakanTeksJenis(kelompok);
}

function kueri(sql, params = []) {
  return new Promise((selesai, gagal) => {
    db.query(sql, params, (galat, hasil) => (galat ? gagal(galat) : selesai(hasil)));
  });
}

const dua = (n) => String(n).padStart(2, "0");
const iso = (d) => `${d.getFullYear()}-${dua(d.getMonth() + 1)}-${dua(d.getDate())}`;

/** Kolom kode dan tabel rujukan tiap tingkat. */
const RUJUKAN = {
  provinsi: { kode: "propinsi", tabel: "ref_provinsi_new", kunci: "provinsi_kode", nama: "provinsi_nama" },
  kabupaten: { kode: "kabupaten", tabel: "ref_kabupaten_new", kunci: "kabupaten_kode", nama: "kabupaten_nama" },
  kecamatan: { kode: "kecamatan", tabel: "ref_kecamatan_new", kunci: "kecamatan_kode", nama: "kecamatan_nama" },
  kelurahan: { kode: "kelurahan", tabel: "ref_kelurahan_new", kunci: "kelurahan_kode", nama: "kelurahan_nama" },
};

/** Rentang tanggal - bentuk yang sama dengan penilaian konseptor. */
function rentangPeriode(periode, acuanIso, dari, sampai) {
  if (periode === "rentang") return { dari: String(dari || ""), sampai: String(sampai || "") };
  const acuan = /^\d{4}-\d{2}-\d{2}$/.test(String(acuanIso || "")) ? new Date(`${acuanIso}T00:00:00`) : new Date();
  const tahun = acuan.getFullYear();
  if (periode === "total") return { dari: "1900-01-01", sampai: "2999-12-31" };
  if (periode === "tahun") return { dari: `${tahun}-01-01`, sampai: `${tahun}-12-31` };
  if (periode === "semester") {
    const awal = acuan.getMonth() < 6 ? 1 : 7;
    return { dari: `${tahun}-${dua(awal)}-01`, sampai: awal === 1 ? `${tahun}-06-30` : `${tahun}-12-31` };
  }
  if (periode === "triwulan") {
    const awal = Math.floor(acuan.getMonth() / 3) * 3 + 1;
    return { dari: `${tahun}-${dua(awal)}-01`, sampai: iso(new Date(tahun, awal + 2, 0)) };
  }
  if (periode === "bulan") {
    const bulan = acuan.getMonth() + 1;
    return { dari: `${tahun}-${dua(bulan)}-01`, sampai: iso(new Date(tahun, bulan, 0)) };
  }
  const hari = acuan.getDay() === 0 ? 7 : acuan.getDay();
  const senin = new Date(acuan);
  senin.setDate(acuan.getDate() - (hari - 1));
  const minggu = new Date(senin);
  minggu.setDate(senin.getDate() + 6);
  return { dari: iso(senin), sampai: iso(minggu) };
}

/**
 * Satu pihak per perkara.
 *
 * Yang dihitung PERKARA, bukan pihak: satu perkara yang penggugatnya dua orang
 * tidak boleh terhitung dua kali pada desanya, dan desa yang gemar berperkara
 * berombongan akan tampak lebih besar daripada yang sebenarnya.
 */
const SATU_PIHAK = `(
  SELECT pp.perkara_id, MIN(x.pihak_id) AS pihak_id
    FROM perkara_putusan pp
    JOIN perkara_pihak1 x ON x.perkara_id = pp.perkara_id
   WHERE pp.tanggal_putusan BETWEEN ? AND ?
   GROUP BY pp.perkara_id
)`;

/** Saringan jenis perkara menurut kelompok yang dipilih. */
function saringJenis(kelompok, alias = "pk") {
  const kel = KELOMPOK[kelompok];
  if (kel) {
    return {
      sql: `${alias}.jenis_perkara_text IN (${kel.jenis.map(() => "?").join(",")})`,
      params: [...kel.jenis],
    };
  }
  return { sql: `${alias}.jenis_perkara_text = ?`, params: [String(kelompok || "")] };
}

/** Jenis perkara yang sungguh diputus - untuk menyusun menunya. */
async function daftarJenis() {
  // MIN(jenis_perkara_id) menyertakan NOMOR jenisnya - satu nama selalu satu
  // nomor, sedangkan satu nomor dapat dua nama (360). Dari nomor itulah
  // golongan bulatan peta untuk pilihan menu ini ditentukan.
  const baris = await kueri(
    `SELECT p.jenis_perkara_text AS jenis, MIN(p.jenis_perkara_id) AS jenisId, COUNT(*) AS n
       FROM perkara p
       JOIN perkara_putusan pp ON pp.perkara_id = p.perkara_id
      WHERE p.jenis_perkara_text IS NOT NULL AND p.jenis_perkara_text <> ''
      GROUP BY p.jenis_perkara_text
      ORDER BY n DESC`
  );

  const cerai = new Set(KELOMPOK.perceraian.jenis);
  const jumlahCerai = baris.filter((b) => cerai.has(String(b.jenis))).reduce((n, b) => n + Number(b.n), 0);

  const menu = [];
  // Perceraian di depan bila memang ada - ia hampir selalu yang terbesar, dan
  // menu yang mengurut menurut abjad menyembunyikannya di tengah.
  if (jumlahCerai > 0) {
    menu.push({
      kunci: "perceraian",
      nama: KELOMPOK.perceraian.nama,
      perkara: jumlahCerai,
      gabungan: true,
      golongan: "cerai",
    });
  }
  for (const b of baris) {
    if (cerai.has(String(b.jenis))) continue;
    menu.push({
      kunci: String(b.jenis),
      nama: String(b.jenis),
      perkara: Number(b.n),
      gabungan: false,
      golongan: golonganKelas(kelasJenis(b.jenisId)),
    });
  }
  return menu;
}

/**
 * ============================================================================
 * SATU KUERI UNTUK SELURUH TINGKAT, LALU DIKELOMPOKKAN DI SINI
 * ============================================================================
 *
 * Susunan sebelumnya memanggil MySQL tiga kali - sebaran, faktor, jangkauan -
 * dan masing-masing menyusun ulang tabel turunan "satu pihak per perkara" yang
 * sama persis. Diukur atas rentang seluruh basis data: 9,6 detik untuk
 * kecamatan dan 12,4 detik untuk kabupaten.
 *
 * Sesudah dirapatkan, terukur ulang atas salinan satker:
 *
 *      seluruh basis data, kabupaten     4,3 detik
 *      seluruh basis data, kecamatan     4,8 detik
 *      setahun, kecamatan                0,5 detik
 *
 * Yang dipulangkan kueri ini satu baris per PERKARA - 5.470 baris untuk
 * perceraian, empat belas ribu untuk seluruhnya. Mengelompokkannya di Node
 * berlangsung dalam hitungan milidetik, dan sebagai gantinya MySQL hanya
 * disentuh sekali. Penelusuran turun dari kabupaten ke kecamatan ke desa pun
 * tidak lagi menuntut kueri baru: keempat tingkatnya sudah ada di baris yang
 * sama.
 *
 * ============================================================================
 * DUA ERA PENGISIAN DATA, SATU NAMA
 * ============================================================================
 *
 * Kolom wilayah pada `pihak` memuat dua bentuk sekaligus - terukur:
 *
 *     kode angka   11.213 baris   "72.10.01"
 *     teks nama       583 baris   "Kab. Sigi", "Kota Palu"
 *     kosong       24.655 baris
 *
 * Dibiarkan apa adanya, "Kabupaten Donggala" muncul dua kali pada daftar yang
 * sama: 1.047 dari baris berkode, dan 122 lagi sebagai "(kode Kab. Donggala)"
 * dari baris bernama. Pembacanya melihat dua tempat, padahal tempatnya satu.
 *
 * Karena itu yang bukan angka dipakai sebagai NAMA apa adanya, dan singkatan
 * resminya disamakan - "Kab." menjadi "Kabupaten", "Kab" tanpa titik pun ikut.
 * Yang tidak disamakan hanya yang memang tidak dikenal.
 *
 * ============================================================================
 * `kelompok` null = SELURUH JENIS, DAN ITULAH YANG DIPAKAI `hitung`
 * ============================================================================
 *
 * Bulatan peta dapat dipilih golongannya di peramban - seluruh perkara, cerai,
 * dispensasi, itsbat, lainnya - tanpa kembali ke peladen. Untuk itu barisnya
 * harus memuat seluruh jenis. Menyaring di sini lalu meminta kueri kedua untuk
 * peta berarti menyusun ulang tabel turunan "satu pihak per perkara" dua kali;
 * yang dipilih satu kueri tanpa saringan jenis, lalu daftar dan kartu
 * disaring di Node lewat `cocokKelompok`.
 */
async function barisWilayah(kelompok, dari, sampai) {
  const jenis = kelompok === null ? null : saringJenis(kelompok);
  return kueri(
    `SELECT pk.jenis_perkara_text AS jenisPerkara,
            pk.jenis_perkara_id   AS jenisPerkaraId,
            p.jenis_kelamin       AS kelamin,
            p.propinsi            AS kodeProvinsi,
            p.kabupaten           AS kodeKabupaten,
            p.kecamatan           AS kodeKecamatan,
            p.kelurahan           AS kodeKelurahan,
            pr.provinsi_nama      AS namaProvinsi,
            kb.kabupaten_nama     AS namaKabupaten,
            kc.kecamatan_nama     AS namaKecamatan,
            kl.kelurahan_nama     AS namaKelurahan,
            f.nama                AS faktor
       FROM ${SATU_PIHAK} satu
       JOIN pihak p ON p.id = satu.pihak_id
       JOIN perkara pk ON pk.perkara_id = satu.perkara_id
       LEFT JOIN ref_provinsi_new  pr ON pr.provinsi_kode  = p.propinsi
       LEFT JOIN ref_kabupaten_new kb ON kb.kabupaten_kode = p.kabupaten
       LEFT JOIN ref_kecamatan_new kc ON kc.kecamatan_kode = p.kecamatan
       LEFT JOIN ref_kelurahan_new kl ON kl.kelurahan_kode = p.kelurahan
       LEFT JOIN perkara_akta_cerai ac ON ac.perkara_id = satu.perkara_id
       LEFT JOIN faktor_perceraian f ON f.id = ac.faktor_perceraian_id
      ${jenis ? `WHERE ${jenis.sql}` : ""}`,
    [dari, sampai, ...(jenis ? jenis.params : [])]
  );
}

/**
 * Nama wilayah dari satu baris, apa pun bentuk isian aslinya.
 *
 * Urutannya disengaja: nama resmi dari tabel rujukan lebih dahulu, lalu isian
 * mentah bila ia memang sudah berupa nama, dan barulah kodenya yang tidak
 * dikenal - ditandai terang-terangan sebagai kode supaya tidak terbaca sebagai
 * nama tempat.
 */
function namaWilayah(baris, tingkat) {
  const resmi = {
    provinsi: baris.namaProvinsi,
    kabupaten: baris.namaKabupaten,
    kecamatan: baris.namaKecamatan,
    kelurahan: baris.namaKelurahan,
  }[tingkat];
  if (resmi) return String(resmi);

  const mentahNilai = {
    provinsi: baris.kodeProvinsi,
    kabupaten: baris.kodeKabupaten,
    kecamatan: baris.kodeKecamatan,
    kelurahan: baris.kodeKelurahan,
  }[tingkat];
  const mentah = String(mentahNilai || "").trim();
  if (!mentah) return "";

  // Yang diawali angka adalah kode BPS yang tidak ketemu di tabel rujukan.
  if (/^[0-9]/.test(mentah)) return `(kode ${mentah})`;

  return bakukanNamaWilayah(mentah);
}

/**
 * Menyamakan singkatan resmi supaya tempat yang sama tidak terpecah dua.
 *
 * "Kab. Donggala" dan "Kabupaten Donggala" adalah tempat yang sama, dan
 * daftar yang memuat keduanya berdampingan membuat pembacanya menjumlahkan
 * sendiri - atau, lebih sering, membaca yang pertama dan mengira itu
 * seluruhnya.
 */
function bakukanNamaWilayah(nama) {
  return String(nama)
    .trim()
    .replace(/^Kab\.?\s+/i, "Kabupaten ")
    .replace(/^Kota\.?\s+/i, "Kota ")
    .replace(/^Kec\.?\s+/i, "")
    .replace(/^Kel\.?\s+/i, "")
    .replace(/^Desa\s+/i, "")
    .replace(/\s+/g, " ");
}

/**
 * Kode induk satu baris pada tingkat di atasnya.
 *
 * Dipakai menyaring penelusuran turun. Baris yang wilayahnya tersimpan sebagai
 * teks tidak punya kode - ia disaring lewat nama induknya.
 */
function indukBaris(baris, tingkat) {
  if (tingkat === "kabupaten") return String(baris.kodeProvinsi || "");
  if (tingkat === "kecamatan") return String(baris.kodeKabupaten || "");
  if (tingkat === "kelurahan") return String(baris.kodeKecamatan || "");
  return "";
}

/**
 * Mengelompokkan baris perkara menjadi satu baris per tempat.
 *
 * Dikerjakan di Node, bukan di MySQL - sebab barisnya sudah ada di tangan, dan
 * mengelompokkan lima ribu baris di sini berlangsung dalam hitungan milidetik.
 * Memintanya kembali ke MySQL untuk tiap tingkat berarti menyusun ulang tabel
 * turunan yang sama empat kali.
 */
function kelompokkan(baris, tingkat, induk) {
  const peta = new Map();
  for (const b of baris) {
    if (induk && indukBaris(b, tingkat) !== induk) continue;
    const nama = namaWilayah(b, tingkat);
    if (!nama) continue;

    // Dikunci NAMA, bukan kode: itulah yang menyatukan baris berkode dengan
    // baris bertulis nama. Kodenya tetap disimpan untuk penelusuran turun -
    // yang pertama ketemu menang, dan baris bernama memang tidak punya.
    if (!peta.has(nama)) {
      peta.set(nama, {
        nama,
        kode: String(
          { provinsi: b.kodeProvinsi, kabupaten: b.kodeKabupaten, kecamatan: b.kodeKecamatan, kelurahan: b.kodeKelurahan }[
            tingkat
          ] || ""
        ),
        perkara: 0,
        lelaki: 0,
        perempuan: 0,
        jenis: {},
      });
    }
    const t = peta.get(nama);
    t.perkara += 1;
    if (String(b.kelamin || "").toUpperCase() === "L") t.lelaki += 1;
    else if (String(b.kelamin || "").toUpperCase() === "P") t.perempuan += 1;
    const j = String(b.jenisPerkara || "");
    t.jenis[j] = (t.jenis[j] || 0) + 1;
  }
  return [...peta.values()].sort((a, b) => b.perkara - a.perkara);
}

/**
 * ============================================================================
 * TITIK PETA - SATU BARIS PER DESA, DIKUNCI KODE DAN BUKAN NAMA
 * ============================================================================
 *
 * `kelompokkan` mengunci barisnya dengan NAMA, dan itu benar untuk daftar yang
 * ditelusuri turun: di dalam satu kecamatan tidak ada dua desa senama, dan
 * mengunci nama-lah yang menyatukan baris berkode dengan baris bertulis nama.
 *
 * Untuk PETA aturannya terbalik. Petanya memajang seluruh desa sekaligus,
 * tanpa induk, dan di tingkat itu nama berulang: "Labuan" ada di Donggala dan
 * ada pula di tempat lain. Dikunci nama, keduanya menyatu menjadi satu titik
 * yang jumlahnya benar untuk dua desa sekaligus dan salah untuk masing-masing.
 *
 * Karena itu di sini kuncinya KODE. Akibatnya baris yang wilayahnya tersimpan
 * sebagai teks - 583 baris dari era pengisian yang lama - tidak punya tempat
 * di peta. Itu disebutkan sebagai `tanpaKode`, bukan dibulatkan ke desa
 * terdekat: yang disebut terlihat, yang dibulatkan tidak.
 *
 * ============================================================================
 * TIAP DESA MEMBAWA HITUNGAN PER KELAS JENIS
 * ============================================================================
 *
 * `kelas` memecah hitungan desa menurut KELAS_JENIS - cerai gugat, cerai
 * talak, dispensasi, itsbat, lainnya - supaya layar dapat berpindah golongan
 * bulatan tanpa kembali ke peladen. Hanya kelas yang ada yang dikirim. Rincian
 * nama jenis hanya dibawa kelas "lainnya": di sanalah satu kelas memuat banyak
 * jenis, dan keterangan melayangnya harus dapat menyebut yang mana.
 *
 * `jenisKelamin` (per NAMA jenis) dan `tanpaKodeJenis` ada untuk bulatan JENIS
 * TUNGGAL - telaah 2.40.0: memilih Kewarisan di halaman harus membuat bulatan
 * menghitung tepat Kewarisan, sama dengan tabelnya, bukan seluruh golongan
 * "lainnya". Layar menjumlahkan `jenis` dengan aturan yang sama dengan
 * cocokKelompok; kelaminnya dari sini.
 */
function tambahKelamin(wadah, kelamin) {
  if (kelamin === "L") wadah.lelaki += 1;
  else if (kelamin === "P") wadah.perempuan += 1;
}

function titikDesa(baris) {
  const peta = new Map();
  let tanpaKode = 0;
  const tanpaKodeKelas = {};
  const tanpaKodeJenis = {};
  for (const b of baris) {
    const kode = String(b.kodeKelurahan || "").trim();
    const kelas = kelasJenis(b.jenisPerkaraId);
    const kelamin = String(b.kelamin || "").toUpperCase();
    const j = String(b.jenisPerkara || "");
    if (!kode) {
      tanpaKode += 1;
      tanpaKodeKelas[kelas] = (tanpaKodeKelas[kelas] || 0) + 1;
      tanpaKodeJenis[j] = (tanpaKodeJenis[j] || 0) + 1;
      continue;
    }
    if (!peta.has(kode)) {
      peta.set(kode, {
        kode,
        nama: String(b.namaKelurahan || "").trim() || kode,
        kecamatan: String(b.namaKecamatan || "").trim(),
        kabupaten: String(b.namaKabupaten || "").trim(),
        perkara: 0,
        lelaki: 0,
        perempuan: 0,
        jenis: {},
        jenisKelamin: {},
        kelas: {},
      });
    }
    const t = peta.get(kode);
    t.perkara += 1;
    tambahKelamin(t, kelamin);
    t.jenis[j] = (t.jenis[j] || 0) + 1;
    if (!t.jenisKelamin[j]) t.jenisKelamin[j] = { lelaki: 0, perempuan: 0 };
    tambahKelamin(t.jenisKelamin[j], kelamin);

    if (!t.kelas[kelas]) t.kelas[kelas] = { perkara: 0, lelaki: 0, perempuan: 0 };
    const k = t.kelas[kelas];
    k.perkara += 1;
    tambahKelamin(k, kelamin);
    if (kelas === "lainnya") {
      if (!k.jenis) k.jenis = {};
      k.jenis[j] = (k.jenis[j] || 0) + 1;
    }
  }
  return {
    titik: [...peta.values()].sort((a, b) => b.perkara - a.perkara),
    tanpaKode,
    tanpaKodeKelas,
    tanpaKodeJenis,
  };
}

/**
 * ============================================================================
 * PERKARA YANG KECAMATANNYA BERKODE TETAPI DESANYA TIDAK
 * ============================================================================
 *
 * Label kecamatan di peta harus menyebut SELURUH perkara kecamatan itu, bukan
 * hanya yang desanya berkode. Layar menjumlahkan desa-desanya sendiri; yang
 * dikirim di sini sisanya - baris yang kecamatannya berbentuk kode
 * ("72.03.08") sedangkan kelurahannya kosong atau berupa tulisan.
 *
 * Terukur pada sipp_donggala 27 Sep 2026: NOL baris seperti itu (3.043 baris
 * berkode kecamatan, seluruhnya berkode desa, dan tak satu pun kode desanya
 * menyimpang dari kode kecamatannya). Tetap dihitung, sebab data peladen
 * berbeda umur dan era pengisiannya.
 */
const POLA_KODE_KECAMATAN = /^\d{2}\.\d{2}\.\d{2}$/;
const POLA_KODE_DESA = /^\d{2}\.\d{2}\.\d{2}\.\d{4}$/;

function kecamatanTanpaDesa(baris) {
  const peta = new Map();
  for (const b of baris) {
    const kec = String(b.kodeKecamatan || "").trim();
    const desa = String(b.kodeKelurahan || "").trim();
    if (!POLA_KODE_KECAMATAN.test(kec) || POLA_KODE_DESA.test(desa)) continue;
    if (!peta.has(kec)) {
      peta.set(kec, {
        kode: kec,
        nama: String(b.namaKecamatan || "").trim() || kec,
        kabupaten: String(b.namaKabupaten || "").trim(),
        perkara: 0,
        kelas: {},
        jenis: {},
      });
    }
    const t = peta.get(kec);
    const kelas = kelasJenis(b.jenisPerkaraId);
    const j = String(b.jenisPerkara || "");
    t.perkara += 1;
    t.kelas[kelas] = (t.kelas[kelas] || 0) + 1;
    // Rincian nama jenis - untuk label kecamatan pada bulatan jenis tunggal.
    t.jenis[j] = (t.jenis[j] || 0) + 1;
  }
  return [...peta.values()].sort((a, b) => b.perkara - a.perkara);
}

/**
 * Mengelompokkan baris perkara menurut faktor perceraiannya.
 *
 * Yang tidak berfaktor dilewati, bukan dihitung sebagai "tidak diketahui":
 * perkara_akta_cerai terisi pada 4.603 dari 4.607 akta, jadi yang kosong
 * hampir selalu perkara yang memang belum berakta - dan menampilkannya sebagai
 * satu batang besar bernama "tidak diketahui" akan menenggelamkan faktor
 * sungguhan yang sedang dibandingkan.
 */
function kelompokkanFaktor(baris) {
  const peta = new Map();
  for (const b of baris) {
    const nama = String(b.faktor || "").trim();
    if (!nama) continue;
    if (!peta.has(nama)) peta.set(nama, { nama, perkara: 0, lelaki: 0, perempuan: 0, jenis: {} });
    const t = peta.get(nama);
    t.perkara += 1;
    if (String(b.kelamin || "").toUpperCase() === "L") t.lelaki += 1;
    else if (String(b.kelamin || "").toUpperCase() === "P") t.perempuan += 1;
    const j = String(b.jenisPerkara || "");
    t.jenis[j] = (t.jenis[j] || 0) + 1;
  }
  return [...peta.values()].sort((a, b) => b.perkara - a.perkara);
}


/**
 * ============================================================================
 * LAPISAN PANGGILAN TIDAK BERTEMU - DAN SANDI YANG BERGANTI ARTI
 * ============================================================================
 *
 * Jurusita menanyakan satu hal yang tidak dijawab peta jumlah perkara: desa
 * mana yang panggilannya paling sering TIDAK SAMPAI. Itu menentukan berapa
 * kali ia harus kembali, dan desa mana yang layak diusulkan jadi tempat sidang
 * keliling.
 *
 * Datanya ada di `perkara_pelaksanaan_relaas.ket_temu`. Tetapi kolom itu
 * BERGANTI ARTI, dan itu terukur:
 *
 *     2019 - 2024   Y (bertemu) dan T (tidak bertemu)
 *     2025 - 2026   hampir seluruhnya S dan E; 'T' tinggal 2 baris setahun
 *
 * S dan E menandai SALURAN pengiriman, bukan hasil pertemuan. Dihitung apa
 * adanya, dua tahun terakhir akan memulangkan 0% tidak bertemu - dan angka itu
 * terbaca sebagai "pelayanan sempurna", bukan sebagai "kolomnya berganti
 * makna". Justru kesalahan yang paling sukar ketahuan, sebab hasilnya masuk
 * akal.
 *
 * Karena itu yang dihitung HANYA baris bersandi Y atau T - 7.751 dari 14.495
 * baris (53%) - dan jangkauannya disebut di layar. Pembatasan ini menyesuaikan
 * diri sendiri: begitu satker kembali memakai Y/T, barisnya ikut terhitung
 * tanpa kode ini disentuh.
 *
 * AMBANG MINIMAL. Desa dengan tiga relaas yang dua di antaranya gagal bukan
 * "67% gagal" - itu kebetulan. Yang di bawah ambang tetap dikirim beserta
 * jumlahnya, tetapi ditandai `cukup: false`; layar tidak mewarnainya.
 */
const SANDI_TEMU = ["Y", "T"];
const AMBANG_RELAAS = 10;

async function sebaranRelaas(dari, sampai) {
  const baris = await kueri(
    `SELECT p.kelurahan          AS kode,
            kl.kelurahan_nama    AS nama,
            kc.kecamatan_nama    AS kecamatan,
            COUNT(*)             AS relaas,
            SUM(r.ket_temu = 'T') AS takTemu
       FROM perkara_pelaksanaan_relaas r
       JOIN pihak p ON p.id = r.pihak_id
       LEFT JOIN ref_kelurahan_new kl ON kl.kelurahan_kode = p.kelurahan
       LEFT JOIN ref_kecamatan_new kc ON kc.kecamatan_kode = p.kecamatan
      WHERE r.ket_temu IN (${SANDI_TEMU.map(() => "?").join(",")})
        AND r.tanggal_relaas BETWEEN ? AND ?
        AND p.kelurahan IS NOT NULL AND p.kelurahan <> ''
      GROUP BY p.kelurahan, kl.kelurahan_nama, kc.kecamatan_nama`,
    [...SANDI_TEMU, dari, sampai]
  );

  let relaasSemua = 0;
  let takTemuSemua = 0;
  const desa = [];
  for (const b of baris) {
    const relaas = Number(b.relaas) || 0;
    const takTemu = Number(b.takTemu) || 0;
    relaasSemua += relaas;
    takTemuSemua += takTemu;
    desa.push({
      kode: String(b.kode || ""),
      nama: String(b.nama || b.kode || ""),
      kecamatan: String(b.kecamatan || ""),
      relaas,
      takTemu,
      persen: relaas > 0 ? Math.round((takTemu / relaas) * 100) : 0,
      cukup: relaas >= AMBANG_RELAAS,
    });
  }

  desa.sort((a, b) => b.persen - a.persen || b.relaas - a.relaas);
  return {
    ambang: AMBANG_RELAAS,
    relaas: relaasSemua,
    takTemu: takTemuSemua,
    persen: relaasSemua > 0 ? Math.round((takTemuSemua / relaasSemua) * 100) : 0,
    desa,
  };
}

/**
 * Daftar perkara satu desa - dibaca ketika lingkaran peta diketuk.
 *
 * Tidak ikut muatan peta. Sembilan ribu nomor perkara beserta tanggalnya
 * berukuran ratusan kilobita, dan yang dibuka orang paling banyak satu atau
 * dua desa. Dibaca saat diketuk, ia satu kueri berindeks nomor desa.
 */
const BATAS_PERKARA_DESA = 300;

/**
 * `golongan` - bila dikenal - MENGGANTIKAN `kelompok`.
 *
 * Bulatan yang diketuk digambar menurut golongan pilihan layar (cerai,
 * dispensasi, itsbat, ...), jadi daftarnya harus disaring golongan yang sama.
 * Disaring kelompok halaman, desa yang bulatannya menyebut "3 dispensasi
 * kawin" akan membuka daftar perceraian - atau daftar kosong.
 */
async function perkaraDesa(kelompok, kode, dari, sampai, golongan) {
  const kodeDesa = String(kode || "").trim();
  if (!kodeDesa) return { ok: false, alasan: "kode_desa_kosong" };

  const jenis = saringGolongan(golongan, "pk") || saringJenis(kelompok, "pk");
  const baris = await kueri(
    `SELECT pk.nomor_perkara       AS nomorPerkara,
            pk.jenis_perkara_text  AS jenisPerkara,
            pk.tanggal_pendaftaran AS tanggalDaftar,
            pp.tanggal_putusan     AS tanggalPutusan,
            p.jenis_kelamin        AS kelamin,
            p.nama                 AS namaPihak
       FROM ${SATU_PIHAK} satu
       JOIN pihak p ON p.id = satu.pihak_id
       JOIN perkara pk ON pk.perkara_id = satu.perkara_id
       JOIN perkara_putusan pp ON pp.perkara_id = pk.perkara_id
      WHERE p.kelurahan = ?
        AND ${jenis.sql}
      ORDER BY pp.tanggal_putusan DESC
      LIMIT ${BATAS_PERKARA_DESA}`,
    [dari, sampai, kodeDesa, ...jenis.params]
  );

  return {
    ok: true,
    kode: kodeDesa,
    batas: BATAS_PERKARA_DESA,
    perkara: baris.map((b) => ({
      nomorPerkara: String(b.nomorPerkara || ""),
      jenisPerkara: String(b.jenisPerkara || ""),
      tanggalDaftar: tanggalIsoPeta(b.tanggalDaftar),
      tanggalPutusan: tanggalIsoPeta(b.tanggalPutusan),
      kelamin: String(b.kelamin || "").toUpperCase(),
      // Nama pihak TIDAK dikirim utuh - hanya huruf pertama tiap kata. Peta
      // dibuka di layar yang kerap terlihat orang lain, dan daftar nama orang
      // berperkara per desa adalah hal yang paling tidak boleh terpajang.
      inisial: String(b.namaPihak || "")
        .split(/\s+/)
        .filter(Boolean)
        .map((k) => k[0].toUpperCase())
        .join("."),
    })),
  };
}

/** Tanggal kolom DATE menjadi "YYYY-MM-DD" - penggerak memulangkan obyek Date. */
function tanggalIsoPeta(nilai) {
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
 * Peta perkara pada satu kelompok dan satu rentang.
 *
 * @param {object} minta { kelompok, tingkat, induk, periode, acuan, dari, sampai }
 */
async function hitung(minta = {}) {
  const kelompok = String(minta.kelompok || "perceraian");
  const tingkat = TINGKAT.includes(String(minta.tingkat)) ? String(minta.tingkat) : "kecamatan";
  const periode = String(minta.periode || "tahun");
  // Kode induk dibersihkan: hanya angka dan titik. Ia tidak menyentuh SQL -
  // penyaringannya di Node - tetapi membiarkan teks bebas mengalir sebagai
  // kunci perbandingan tetap tidak ada gunanya.
  const induk = String(minta.induk || "").replace(/[^0-9.]/g, "");

  const { dari, sampai } = rentangPeriode(periode, minta.acuan, minta.dari, minta.sampai);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dari) || !/^\d{4}-\d{2}-\d{2}$/.test(sampai)) {
    return { ok: false, alasan: "rentang_tanggal_tidak_sah" };
  }
  if (dari > sampai) return { ok: false, alasan: "tanggal_awal_melewati_akhir" };

  const perceraian = Object.prototype.hasOwnProperty.call(KELOMPOK, kelompok);

  let baris = [];
  try {
    // Berurutan, bukan berbarengan - alasannya sama dengan penilaian
    // konseptor: yang dibaca ini SIPP yang sedang dipakai petugas.
    //
    // Galatnya TIDAK ditelan. Pada susunan sebelumnya tiap kueri dibungkus
    // `.catch(() => [])`, dan satu kueri faktor yang keliru memulangkan daftar
    // kosong yang terbaca di layar sebagai "tidak ada faktor perceraian" -
    // kalimat yang salah, tanpa apa pun yang menyebutkan ada galat.
    //
    // SELURUH jenis (kelompok null): bulatan peta memilih golongannya sendiri
    // di peramban. Daftar, faktor, dan kartu disaring di bawah ini.
    baris = await barisWilayah(null, dari, sampai);
  } catch (e) {
    return { ok: false, alasan: "gagal_membaca_sipp", pesan: String((e && e.message) || e) };
  }

  // Baris kelompok halaman - sama persis dengan yang dahulu disaring MySQL.
  const barisKelompok = baris.filter((b) => cocokKelompok(b, kelompok));

  const daftarWilayah = kelompokkan(barisKelompok, tingkat, induk);
  // Faktornya ikut baris yang sama - satu kueri, bukan dua. Kueri faktor
  // tersendiri dahulu menyusun ulang tabel turunan "satu pihak per perkara"
  // yang persis sama, dan itu saja 2,4 detik.
  const daftarFaktor = perceraian ? kelompokkanFaktor(barisKelompok) : [];
  // Titik peta dihitung dari BARIS YANG SAMA - bukan kueri kedua. Barisnya
  // sudah di tangan; mengelompokkannya sekali lagi berlangsung dalam hitungan
  // milidetik, sedangkan memintanya kembali ke MySQL berarti menyusun ulang
  // tabel turunan yang sama untuk ketiga kalinya.
  //
  // Titiknya dari SELURUH baris, bukan baris kelompok: tiap desa membawa
  // hitungan per kelas jenis, dan layar yang memilih golongannya.
  const sebaranTitik = titikDesa(baris);
  const sisaKecamatan = kecamatanTanpaDesa(baris);

  // Jangkauannya dihitung dari baris yang sama - tidak perlu kueri tersendiri.
  const diputus = barisKelompok.length;
  const beralamat = barisKelompok.filter((b) => String(b.kodeKecamatan || "").trim() !== "").length;
  const larut = barisKelompok.filter((b) => b.namaKecamatan).length;
  const terpetakan = daftarWilayah.reduce((n, x) => n + x.perkara, 0);
  const lelaki = daftarWilayah.reduce((n, x) => n + x.lelaki, 0);
  const perempuan = daftarWilayah.reduce((n, x) => n + x.perempuan, 0);

  // Jenis perkara yang sungguh muncul - dipakai layar menyusun penandanya
  // tanpa menebak dari kelompoknya.
  const jenisMuncul = {};
  for (const b of barisKelompok) {
    const j = String(b.jenisPerkara || "");
    if (j) jenisMuncul[j] = (jenisMuncul[j] || 0) + 1;
  }

  return {
    ok: true,
    kelompok,
    kelompokNama: (KELOMPOK[kelompok] && KELOMPOK[kelompok].nama) || kelompok,
    perceraian,
    penanda: (KELOMPOK[kelompok] && KELOMPOK[kelompok].penanda) || {},
    jenisMuncul,
    tingkat,
    induk,
    periode,
    rentang: { dari, sampai },
    // Petanya ADA sejak 2.24.0, tetapi koordinatnya bukan urusan layanan ini -
    // lihat keterangan di kepala berkas. Yang dikirim dari sini hanya
    // hitungan per kode desa; yang menjodohkannya dengan titik adalah berkas
    // statis di portal, dan desa yang tidak berjodoh tidak digambar.
    petaGeografis: false,
    alasanTanpaPeta:
      "Koordinat di dalam SIPP tidak dapat dipakai: satu-satunya tabel yang punya kolom lintang/bujur " +
      "adalah kode_pos, dan seluruh 2.023 baris Sulawesi Tengah di dalamnya hanya memuat 9 titik - satu " +
      "per kabupaten, disalin ke tiap desa di bawahnya. Titik peta karena itu diambil dari " +
      "OpenStreetMap dan dijodohkan lebih dahulu di luar portal; desa yang tidak berjodoh tidak " +
      "digambar, bukan digeser ke tempat terdekat.",
    // Titik peta: SELURUH jenis pada rentang ini, tiap desa dengan hitungan
    // per kelas (lihat titikDesa). `titikTanpaKode` pun seluruh jenis, dan
    // dipecah per kelas supaya layar dapat menyebutnya per golongan.
    titikSeluruhJenis: true,
    kelasPeta: KELAS_PETA,
    titik: sebaranTitik.titik,
    titikTanpaKode: sebaranTitik.tanpaKode,
    titikTanpaKodeKelas: sebaranTitik.tanpaKodeKelas,
    // Per NAMA jenis - untuk bulatan jenis tunggal (telaah 2.40.0).
    titikTanpaKodeJenis: sebaranTitik.tanpaKodeJenis,
    kecamatanTanpaDesa: sisaKecamatan,
    ringkas: {
      diputus,
      beralamat,
      larutNama: larut,
      persenBeralamat: diputus > 0 ? Math.round((beralamat / diputus) * 100) : 0,
      terpetakan,
      lelaki,
      perempuan,
      persenPerempuan: lelaki + perempuan > 0 ? Math.round((perempuan / (lelaki + perempuan)) * 100) : 0,
    },
    wilayah: daftarWilayah,
    faktor: daftarFaktor,
  };
}

module.exports = {
  TINGKAT,
  KELOMPOK,
  RUJUKAN,
  // Golongan bulatan peta - dibaca lewat jenis_perkara_id.
  KELAS_JENIS,
  KELAS_PETA,
  GOLONGAN_PETA,
  kelasJenis,
  golonganKelas,
  saringGolongan,
  cocokKelompok,
  kecamatanTanpaDesa,
  rentangPeriode,
  saringJenis,
  daftarJenis,
  barisWilayah,
  namaWilayah,
  bakukanNamaWilayah,
  indukBaris,
  kelompokkan,
  // Dikunci kode, bukan nama - lihat keterangannya. Diekspor untuk diuji
  // satuan: perbedaan kunci inilah yang menentukan benar-salahnya angka pada
  // peta, dan perbedaan itu tidak terlihat dari hasilnya.
  titikDesa,
  // Lapisan panggilan tidak bertemu, dan daftar perkara satu desa.
  sebaranRelaas,
  perkaraDesa,
  AMBANG_RELAAS,
  kelompokkanFaktor,
  hitung,
};
