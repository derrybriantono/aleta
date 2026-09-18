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
 * Kalau kelak satker punya berkas batas wilayah yang benar, peta geografisnya
 * dapat ditambahkan di atas data yang sama - yang tidak boleh adalah
 * menggambarnya dari koordinat ini.
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
  const baris = await kueri(
    `SELECT p.jenis_perkara_text AS jenis, COUNT(*) AS n
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
    menu.push({ kunci: "perceraian", nama: KELOMPOK.perceraian.nama, perkara: jumlahCerai, gabungan: true });
  }
  for (const b of baris) {
    if (cerai.has(String(b.jenis))) continue;
    menu.push({ kunci: String(b.jenis), nama: String(b.jenis), perkara: Number(b.n), gabungan: false });
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
 */
async function barisWilayah(kelompok, dari, sampai) {
  const jenis = saringJenis(kelompok);
  return kueri(
    `SELECT pk.jenis_perkara_text AS jenisPerkara,
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
      WHERE ${jenis.sql}`,
    [dari, sampai, ...jenis.params]
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

  const perceraian = Boolean(KELOMPOK[kelompok]);

  let baris = [];
  try {
    // Berurutan, bukan berbarengan - alasannya sama dengan penilaian
    // konseptor: yang dibaca ini SIPP yang sedang dipakai petugas.
    //
    // Galatnya TIDAK ditelan. Pada susunan sebelumnya tiap kueri dibungkus
    // `.catch(() => [])`, dan satu kueri faktor yang keliru memulangkan daftar
    // kosong yang terbaca di layar sebagai "tidak ada faktor perceraian" -
    // kalimat yang salah, tanpa apa pun yang menyebutkan ada galat.
    baris = await barisWilayah(kelompok, dari, sampai);
  } catch (e) {
    return { ok: false, alasan: "gagal_membaca_sipp", pesan: String((e && e.message) || e) };
  }

  const daftarWilayah = kelompokkan(baris, tingkat, induk);
  // Faktornya ikut baris yang sama - satu kueri, bukan dua. Kueri faktor
  // tersendiri dahulu menyusun ulang tabel turunan "satu pihak per perkara"
  // yang persis sama, dan itu saja 2,4 detik.
  const daftarFaktor = perceraian ? kelompokkanFaktor(baris) : [];

  // Jangkauannya dihitung dari baris yang sama - tidak perlu kueri tersendiri.
  const diputus = baris.length;
  const beralamat = baris.filter((b) => String(b.kodeKecamatan || "").trim() !== "").length;
  const larut = baris.filter((b) => b.namaKecamatan).length;
  const terpetakan = daftarWilayah.reduce((n, x) => n + x.perkara, 0);
  const lelaki = daftarWilayah.reduce((n, x) => n + x.lelaki, 0);
  const perempuan = daftarWilayah.reduce((n, x) => n + x.perempuan, 0);

  // Jenis perkara yang sungguh muncul - dipakai layar menyusun penandanya
  // tanpa menebak dari kelompoknya.
  const jenisMuncul = {};
  for (const b of baris) {
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
    // Sengaja disebut supaya layar tidak menggambar peta geografis dari data
    // ini - lihat keterangan di kepala berkas.
    petaGeografis: false,
    alasanTanpaPeta:
      "Koordinat kode_pos tidak dapat dipakai: kolom lintang dan bujurnya tertukar, dan sesudah ditukar " +
      "pun tiap kabupaten hanya punya satu titik yang sebagian menunjuk pulau lain - Morowali Utara " +
      "jatuh di Papua, Banggai di Laut Sawu. Sebarannya karena itu disusun berjenjang dari kode wilayah " +
      "resmi, tanpa koordinat yang dikarang.",
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
  rentangPeriode,
  saringJenis,
  daftarJenis,
  barisWilayah,
  namaWilayah,
  bakukanNamaWilayah,
  indukBaris,
  kelompokkan,
  kelompokkanFaktor,
  hitung,
};
