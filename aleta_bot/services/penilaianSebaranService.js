"use strict";

/**
 * ============================================================================
 * SEBARAN DAN STATISTIK PERKARA - DINILAI DARI KELENGKAPAN BAHANNYA
 * ============================================================================
 *
 * Bab 9 katalog e-Audit meminta sebaran: pendidikan para pihak, pekerjaan,
 * umur, wilayah hukum, cara pendaftaran, dan seterusnya. Sekilas ini bukan
 * penilaian - sebaran tidak punya benar atau salah, ia hanya gambaran.
 *
 * Yang dapat dinilai, dan justru inilah yang dicari pengawasan: APAKAH
 * BAHANNYA ADA. Sebaran pendidikan yang disusun dari data yang tiga perempat
 * kosong bukan gambaran keadaan - ia gambaran atas seperempat perkara yang
 * kebetulan diisi, disajikan seolah gambaran seluruhnya.
 *
 * Itu bukan dugaan. Diukur pada basis data SIPP yang ada di tangan: dari 493
 * baris pihak pada satu tahun, 427 di antaranya berpendidikan NULL. Sebaran
 * yang digambar dari sana akan menyebut "Sekolah Dasar" sebagai jenjang
 * terbanyak berdasarkan 29 baris, dan yang membacanya tidak punya cara tahu
 * bahwa 427 lainnya tidak terbaca.
 *
 * Karena itu tiap butir keluarga ini dinilai dengan satu pertanyaan yang sama:
 * berapa bagian yang ruasnya terisi. Sebarannya sendiri tetap dipulangkan -
 * pada baris buktinya - sehingga yang ingin melihat gambarannya tetap dapat,
 * lengkap dengan berapa banyak yang tidak terhitung.
 *
 * ============================================================================
 * SATU TABEL, BUKAN SEPULUH BERKAS
 * ============================================================================
 *
 * Seluruh butir di sini berbentuk sama: hitung baris dalam satu periode,
 * kelompokkan menurut satu ruas, dan nyatakan berapa yang terisi. Menuliskan
 * sepuluh berkas yang isinya sama kecuali nama kolomnya berarti sepuluh tempat
 * yang harus diperbaiki ketika bentuknya berubah - dan pada perbaikan
 * kesembilan seseorang akan lupa yang kesepuluh.
 *
 * Bentuk deklaratif ini mengikuti penilaianTahapanService, yang sudah memakai
 * pola sama untuk sebelas butir ketaatan.
 */

const db = require("../db_config");
const kerangka = require("./kerangkaPenilaianService");
const sippSkemaService = require("./sippSkemaService");

/** Batas baris bukti sekali baca. */
const BATAS_BARIS = 5000;

/**
 * ============================================================================
 * BUTIR YANG DIUKUR
 * ============================================================================
 *
 * kode       butir katalog e-Audit
 * kunci      nama penilaian di kerangka
 * sumber     "pihak"   - ruasnya ada pada tabel pihak, disambung lewat
 *                        perkara_pihak1/2
 *            "perkara" - ruasnya ada pada tabel perkara itu sendiri
 *            "ada"     - yang dinilai keberadaan baris pada tabel lain
 * ruas       kolom yang diperiksa keterisiannya
 * pihak      untuk sumber "pihak": 1 = penggugat/pemohon saja, 0 = keduanya
 * tabelAda   untuk sumber "ada": tabel yang diperiksa
 */
const SEBARAN = [
  {
    kode: "ST05",
    kunci: "sebaranPendidikan",
    judul: "Sebaran Pendidikan Para Pihak",
    keterangan:
      "Jenjang pendidikan para pihak sebagaimana tercatat pada SIPP. Yang dinilai keterisiannya - sebaran yang disusun dari ruas yang sebagian besar kosong bukan gambaran keadaan.",
    sumber: "pihak",
    ruas: "pendidikan",
    pihak: 0,
    dasar: "Rubrik ALETA - kelengkapan identitas pihak.",
  },
  {
    kode: "ST06",
    kunci: "sebaranPekerjaan",
    judul: "Sebaran Pekerjaan Para Pihak",
    keterangan:
      "Pekerjaan para pihak. Ruas teks bebas, sehingga yang dinilai keterisiannya; pengelompokan katanya dikerjakan terpisah.",
    sumber: "pihak",
    ruas: "pekerjaan",
    pihak: 0,
    dasar: "Rubrik ALETA - kelengkapan identitas pihak.",
  },
  {
    kode: "ST07",
    kunci: "sebaranUmur",
    judul: "Sebaran Umur Para Pihak",
    keterangan:
      "Tanggal lahir para pihak, yang darinya umur dihitung. Tanpa tanggal lahir, kelompok umur tidak dapat disusun sama sekali.",
    sumber: "pihak",
    ruas: "tanggal_lahir",
    pihak: 0,
    dasar: "Rubrik ALETA - kelengkapan identitas pihak.",
  },
  {
    kode: "ST19",
    kunci: "kelengkapanNikPihak",
    judul: "Nomor Induk Kependudukan Para Pihak",
    keterangan:
      "Nomor induk kependudukan para pihak. Inilah satu-satunya penanda yang membuat riwayat perkara seseorang dapat ditelusuri; tanpa itu penelusuran jatuh pada kecocokan nama, yang keliru pada nama yang sama.",
    sumber: "pihak",
    ruas: "nomor_indentitas",
    pihak: 0,
    dasar: "Rubrik ALETA - dasar penelusuran riwayat pihak.",
  },
];

function runQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (error, hasil) => {
      if (error) reject(error);
      else resolve(Array.isArray(hasil) ? hasil : []);
    });
  });
}

function teks(nilai) {
  return String(nilai == null ? "" : nilai).trim();
}

/**
 * Apakah satu nilai benar-benar terisi.
 *
 * SIPP menyimpan "belum diisi" dengan beberapa bentuk sekaligus, dan
 * memperlakukan sebagiannya sebagai terisi akan menggelembungkan angka
 * kelengkapan tanpa ada yang menyadarinya:
 *
 *   NULL          tidak pernah disentuh
 *   ""            disentuh lalu dikosongkan
 *   "-"           diisi tanda hubung supaya borangnya mau disimpan
 *   "0000-00-00"  tanggal nol MariaDB - dipulangkan sebagai string, bukan null
 */
function terisi(nilai) {
  const t = teks(nilai);
  if (!t) return false;
  if (t === "-") return false;
  if (/^0000-00-00/.test(t)) return false;
  return true;
}

/** Kueri satu butir bersumber tabel pihak. */
function kueriPihak(p) {
  // Kedua pihak digabung dengan UNION ALL, bukan JOIN dua kali: satu perkara
  // dapat berpihak lebih dari satu di tiap sisi, dan JOIN ganda mengalikan
  // barisnya sehingga perkara berpihak banyak terhitung berkali-kali.
  const sisi = (tabel, sebutan) => `
    SELECT p.perkara_id AS perkaraId,
           p.nomor_perkara AS nomorPerkara,
           p.jenis_perkara_nama AS jenisPerkara,
           '${sebutan}' AS sisi,
           pp.urutan AS urutan,
           h.nama AS namaPihak,
           h.${p.ruas} AS nilai
      FROM perkara p
      JOIN ${tabel} pp ON pp.perkara_id = p.perkara_id
      JOIN pihak h ON h.id = pp.pihak_id
     WHERE p.tanggal_pendaftaran >= ? AND p.tanggal_pendaftaran <= ?`;

  const bagian =
    p.pihak === 1
      ? sisi("perkara_pihak1", "Penggugat/Pemohon")
      : `${sisi("perkara_pihak1", "Penggugat/Pemohon")}
         UNION ALL
         ${sisi("perkara_pihak2", "Tergugat/Termohon")}`;

  return `${bagian} ORDER BY nomorPerkara, sisi, urutan LIMIT ${BATAS_BARIS}`;
}

function pembangunBaris(p) {
  return async function baris(rentang) {
    // Kolomnya diperiksa ada-tidaknya lebih dahulu. SIPP berbeda antar versi,
    // dan kueri atas kolom yang tidak ada melempar galat yang di layar
    // terbaca seperti perkaranya yang bermasalah.
    const punya = await sippSkemaService.kolomAda("pihak", p.ruas).catch(() => false);
    if (!punya) return [];

    const params = p.pihak === 1
      ? [rentang.mulai, rentang.selesai]
      : [rentang.mulai, rentang.selesai, rentang.mulai, rentang.selesai];

    const hasil = await runQuery(kueriPihak(p), params);

    return hasil.map((r) => {
      const ada = terisi(r.nilai);
      return {
        kunci: `${teks(r.nomorPerkara)}#${p.kode}#${teks(r.sisi)}#${teks(r.urutan)}`,
        nomorPerkara: teks(r.nomorPerkara),
        jenisPerkara: teks(r.jenisPerkara),
        sisi: teks(r.sisi),
        namaPihak: teks(r.namaPihak),
        // Nilainya ikut dipulangkan supaya sebarannya dapat disusun dari baris
        // bukti yang sama - tanpa kueri kedua yang dapat berselisih dengan
        // angka kelengkapan di sebelahnya.
        nilai: ada ? teks(r.nilai) : "",
        memenuhi: ada,
        sebabTidakMemenuhi: ada ? "" : `${p.ruas} belum terisi pada SIPP`,
      };
    });
  };
}

let sudahDidaftar = false;

/** Mendaftarkan seluruh butir sebaran ke kerangka penilaian. */
function daftarkanSemua() {
  if (sudahDidaftar) return SEBARAN.map((p) => p.kunci);

  SEBARAN.forEach((p) => {
    if (kerangka.ambil(p.kunci)) return;
    kerangka.daftarkan({
      kunci: p.kunci,
      judul: p.judul,
      keterangan: p.keterangan,
      lantai: "bulanan",
      versiRumus: "sebaran-v1",
      ambangDipakai: [],
      caraHitung: {
        pembilang: `Baris pihak yang ruas ${p.ruas} pada tabel pihak sudah terisi`,
        penyebut:
          p.pihak === 1
            ? "Seluruh penggugat/pemohon pada perkara yang didaftarkan dalam rentang ini"
            : "Seluruh pihak - penggugat/pemohon dan tergugat/termohon - pada perkara yang didaftarkan dalam rentang ini",
        dikecualikan:
          "Tidak ada yang dikecualikan. Ruas yang kosong justru temuannya, dan mengeluarkannya dari penyebut akan membuat pengadilan yang paling banyak mengosongkan ruas ini bernilai paling baik.",
        tabelSumber: `perkara, ${p.pihak === 1 ? "perkara_pihak1" : "perkara_pihak1, perkara_pihak2"}, pihak`,
        ruasSumber: `tanggal_pendaftaran, ${p.ruas}`,
      },
      baris: pembangunBaris(p),
    });
  });

  sudahDidaftar = true;
  return SEBARAN.map((p) => p.kunci);
}

/** Dilupakan supaya dapat didaftarkan ulang pada pengujian. */
function lupakanSemua() {
  sudahDidaftar = false;
}

/** Butir katalog yang dipenuhi berkas ini. */
function sambungan() {
  const peta = {};
  SEBARAN.forEach((p) => {
    peta[p.kode] = p.kunci;
  });
  return peta;
}

module.exports = {
  BATAS_BARIS,
  SEBARAN,
  daftarkanSemua,
  kueriPihak,
  lupakanSemua,
  sambungan,
  terisi,
};
