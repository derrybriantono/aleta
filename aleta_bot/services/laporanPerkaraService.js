"use strict";

/**
 * ============================================================================
 * BAB 4 - LAPORAN PERKARA LIPA 1 SAMPAI 22
 * ============================================================================
 *
 * Dua puluh dua laporan, masing-masing dinilai satu per satu dengan blangko
 * nilai yang bentuknya sama persis.
 *
 * ============================================================================
 * TANGGAL KIRIM TIDAK ADA DI SIPP - DAN ITU MENENTUKAN SEGALANYA
 * ============================================================================
 *
 * Aspek pertama penilaian ini adalah ketepatan waktu pengiriman: apakah laporan
 * dikirim sebelum tanggal 5 (atau tanggal 10 untuk yang berbiaya DIPA 04) bulan
 * berikutnya.
 *
 * SIPP tidak menyimpan tanggal itu. SIPP menyimpan data perkara; kapan sebuah
 * laporan diunggah ke sistem pelaporan Badilag adalah peristiwa di luar SIPP.
 * Menebaknya dari data perkara - misalnya dari tanggal input terakhir - akan
 * menghasilkan angka yang tampak berdasar padahal karangan.
 *
 * Maka ALETA menyimpannya sendiri: petugas kepaniteraan hukum mencatat tanggal
 * kirim dan angka yang dilaporkan. Itu bukan kekurangan melainkan kejujuran -
 * fakta yang hanya diketahui manusia dicatat manusia, dan yang dicatat mesin
 * dihitung mesin.
 *
 * ============================================================================
 * ANGKA SIPP DISAMBUNG SATU PER SATU, TIDAK DIKARANG SEKALIGUS
 * ============================================================================
 *
 * Aspek kedua membandingkan angka pada laporan dengan angka hasil hitung
 * langsung dari SIPP. Tiap LIPA menghitung hal yang berbeda - keadaan perkara,
 * banding, kasasi, eksekusi, keuangan - dan tiap hitungan menuntut kueri
 * tersendiri yang harus diperiksa terhadap SIPP yang sungguhan.
 *
 * LIPA yang kueri SIPP-nya belum disambung berkata TERUS TERANG demikian, dan
 * aspek kedua tidak dinilai untuknya. Memberi nilai empat puluh penuh kepada
 * laporan yang angkanya tidak pernah dibandingkan berarti memberi nilai atas
 * pekerjaan yang tidak pernah diperiksa.
 */

const botDb = require("./botDbService");
const ambang = require("./ambangPenilaianService");
const periode = require("./periodePenilaianService");

const TABEL = "aleta_bot_laporan_perkara";

/**
 * Dua puluh dua laporan.
 *
 * `dipa04` menandai laporan yang dibiayai DIPA 04 - batas kirimnya tanggal
 * sepuluh, dan realisasi fisiknya dinilai pada aspek ketiga.
 */
const LIPA = [
  { nomor: 1, nama: "Keadaan Perkara" },
  { nomor: 2, nama: "Perkara Banding" },
  { nomor: 3, nama: "Perkara Kasasi" },
  { nomor: 4, nama: "Perkara Peninjauan Kembali" },
  { nomor: 5, nama: "Perkara Eksekusi" },
  { nomor: 6, nama: "Kegiatan Hakim" },
  { nomor: 7, nama: "Keuangan Perkara" },
  { nomor: 8, nama: "Keuangan Eksekusi" },
  { nomor: 9, nama: "Hak-hak Kepaniteraan" },
  { nomor: 10, nama: "Formulir Akta Cerai" },
  { nomor: 11, nama: "Eksaminasi Putusan" },
  { nomor: 12, nama: "Pelaksanaan Mediasi" },
  { nomor: 13, nama: "Penerbitan Akta Cerai" },
  { nomor: 14, nama: "Sidang di Luar Gedung", dipa04: true },
  { nomor: 15, nama: "Pembebasan Biaya Perkara", dipa04: true },
  { nomor: 16, nama: "Pos Bantuan Hukum", dipa04: true },
  { nomor: 17, nama: "Biaya Proses" },
  { nomor: 18, nama: "Meja Informasi" },
  { nomor: 19, nama: "Penanganan Pengaduan" },
  { nomor: 20, nama: "Titipan Pihak Ketiga" },
  { nomor: 21, nama: "Sidang Keliling Terpadu" },
  { nomor: 22, nama: "Dispensasi Kawin" },
];

/** Bobot kedua aspek. Ditulis di sini supaya dapat diperiksa, bukan tersebar. */
const BOBOT_KETEPATAN = 60;
const BOBOT_KESESUAIAN = 40;

/**
 * Potongan nilai.
 *
 * Delapan poin per hari terlambat berarti nilai ketepatan habis pada hari
 * kedelapan; sepuluh poin per satuan selisih berarti nilai kesesuaian habis
 * pada selisih keempat. Keduanya angka kebijakan, bukan peraturan - dan karena
 * itu tertulis di sini, terbuka untuk diubah pimpinan dengan sadar.
 */
const POTONGAN_PER_HARI_TERLAMBAT = 8;
const POTONGAN_PER_SATUAN_SELISIH = 10;

function butirLipa(nomor) {
  const n = Number(nomor);
  return LIPA.find((x) => x.nomor === n) || null;
}

function kunciLipa(nomor) {
  const n = Number(nomor);
  return `LP${String(n).padStart(2, "0")}`;
}

/**
 * Batas kirim sebuah laporan bulanan: tanggal 5 atau 10 pada bulan BERIKUTNYA.
 *
 * Hari libur belum diperhitungkan. Bila tanggal 5 jatuh pada hari Minggu,
 * apakah batasnya bergeser ke Senin? Petunjuk pelaporan tidak menyebutkannya
 * dengan tegas, dan menebak berarti menuduh atau membebaskan orang atas dasar
 * tebakan. Sampai ada keputusan, yang dipakai tanggal almanaknya apa adanya -
 * dan keadaan itu disebutkan pada keterangan penilaiannya.
 */
function batasKirim(bulanLaporan, nomor) {
  const cocok = /^(\d{4})-(\d{2})$/.exec(String(bulanLaporan || "").trim());
  if (!cocok) throw new Error(`Bulan laporan harus YYYY-MM, dapat: ${bulanLaporan}`);
  const tahun = Number(cocok[1]);
  const bulan = Number(cocok[2]);
  const butir = butirLipa(nomor);
  if (!butir) throw new Error(`LIPA ${nomor} tidak dikenali`);

  const kunciAmbang = butir.dipa04 ? "batasKirimLaporanDipa" : "batasKirimLaporan";
  const akhirBulan = periode.akhirBulan(tahun, bulan);
  const a = ambang.ambangBerlaku(kunciAmbang, akhirBulan);
  const hari = a.nilai === null ? (butir.dipa04 ? 10 : 5) : a.nilai;

  const bulanBerikut = bulan === 12 ? 1 : bulan + 1;
  const tahunBerikut = bulan === 12 ? tahun + 1 : tahun;
  return {
    tanggal: `${tahunBerikut}-${String(bulanBerikut).padStart(2, "0")}-${String(hari).padStart(2, "0")}`,
    hari,
    dasar: a.dasar,
    dipa04: Boolean(butir.dipa04),
  };
}

/**
 * Nilai satu baris blangko.
 *
 * Aspek kedua hanya dinilai bila angka SIPP-nya ADA. Bila belum tersambung,
 * yang dipulangkan nilai aspek pertama saja beserta keterangan bahwa aspek
 * kedua belum dapat dinilai - bukan empat puluh penuh.
 */
function nilaiBaris({ batas, tanggalKirim, angkaLaporan, angkaSipp }) {
  const adaKirim = Boolean(tanggalKirim);
  let terlambat = null;
  if (adaKirim) {
    try {
      terlambat = Math.max(0, periode.hariKalenderAntara(batas, tanggalKirim));
    } catch (_) {
      terlambat = null;
    }
  }

  const nilaiKetepatan =
    terlambat === null ? null : Math.max(0, BOBOT_KETEPATAN - terlambat * POTONGAN_PER_HARI_TERLAMBAT);

  const punyaKeduaAngka =
    angkaLaporan !== null && angkaLaporan !== undefined && angkaSipp !== null && angkaSipp !== undefined;
  const selisih = punyaKeduaAngka ? Number(angkaSipp) - Number(angkaLaporan) : null;
  const nilaiKesesuaian =
    selisih === null
      ? null
      : Math.max(0, BOBOT_KESESUAIAN - Math.abs(selisih) * POTONGAN_PER_SATUAN_SELISIH);

  const bagian = [];
  if (nilaiKetepatan !== null) bagian.push(nilaiKetepatan);
  if (nilaiKesesuaian !== null) bagian.push(nilaiKesesuaian);

  const belum = [];
  if (nilaiKetepatan === null) belum.push("tanggal kirim belum dicatat");
  if (nilaiKesesuaian === null) {
    belum.push(
      angkaLaporan === null || angkaLaporan === undefined
        ? "angka yang dilaporkan belum dicatat"
        : "angka SIPP untuk laporan ini belum tersambung"
    );
  }

  return {
    terlambatHari: terlambat,
    selisihAngka: selisih,
    nilaiKetepatan,
    nilaiKesesuaian,
    // Nilai gabungan hanya keluar bila KEDUA aspeknya dapat dinilai. Menjumlah
    // sebagian lalu menyebutnya nilai akan membuat laporan yang aspek keduanya
    // belum diperiksa tampak bernilai enam puluh dari seratus - padahal yang
    // benar adalah "enam puluh dari enam puluh yang dapat dinilai".
    nilai: belum.length === 0 ? bagian.reduce((s, x) => s + x, 0) : null,
    nilaiSebagian: bagian.length ? bagian.reduce((s, x) => s + x, 0) : null,
    bobotTerpakai:
      (nilaiKetepatan === null ? 0 : BOBOT_KETEPATAN) + (nilaiKesesuaian === null ? 0 : BOBOT_KESESUAIAN),
    belumDapatDinilai: belum,
  };
}

/* ==========================================================================
 * Catatan pengiriman - dicatat manusia, bukan ditebak mesin
 * ========================================================================== */

let tabelSiap = false;
let janjiTabel = null;

async function pastikanTabel() {
  if (tabelSiap) return true;
  if (janjiTabel) return janjiTabel;
  janjiTabel = (async () => {
    await botDb.query(`
      CREATE TABLE IF NOT EXISTS ${TABEL} (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        lipa_nomor INT NOT NULL,
        bulan_laporan VARCHAR(7) NOT NULL,
        tanggal_kirim DATE NULL,
        angka_laporan BIGINT NULL,
        dicatat_oleh VARCHAR(191) NOT NULL DEFAULT '',
        jabatan VARCHAR(191) NOT NULL DEFAULT '',
        keterangan TEXT NULL,
        dicatat_pada DATETIME NOT NULL,
        UNIQUE KEY uniq_laporan (lipa_nomor, bulan_laporan),
        KEY idx_laporan_bulan (bulan_laporan)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    tabelSiap = true;
    return true;
  })();
  try {
    return await janjiTabel;
  } catch (galat) {
    janjiTabel = null;
    throw galat;
  }
}

function lupakanTabel() {
  tabelSiap = false;
  janjiTabel = null;
}

function celaCatatan(c) {
  const cela = [];
  if (!c || typeof c !== "object") return ["catatan bukan objek"];
  if (!butirLipa(c.lipaNomor)) cela.push(`LIPA ${c.lipaNomor} tidak dikenali - yang ada 1 sampai 22`);
  if (!/^\d{4}-\d{2}$/.test(String(c.bulanLaporan || ""))) cela.push("bulanLaporan harus YYYY-MM");
  if (!String(c.dicatatOleh || "").trim()) {
    cela.push("dicatatOleh kosong - tanggal kirim adalah keterangan manusia, dan harus dapat ditelusuri siapa yang menyatakannya");
  }
  if (c.tanggalKirim !== null && c.tanggalKirim !== undefined && c.tanggalKirim !== "") {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(c.tanggalKirim))) cela.push("tanggalKirim harus YYYY-MM-DD");
  }
  if (c.angkaLaporan !== null && c.angkaLaporan !== undefined && c.angkaLaporan !== "") {
    if (!Number.isFinite(Number(c.angkaLaporan))) cela.push("angkaLaporan bukan bilangan");
  }
  return cela;
}

async function catatPengiriman(c) {
  const cela = celaCatatan(c);
  if (cela.length) throw new Error(`Catatan pengiriman ditolak: ${cela.join("; ")}`);
  await pastikanTabel();
  const waktu = c.dicatatPada || new Date();
  await botDb.query(
    `INSERT INTO ${TABEL}
      (lipa_nomor, bulan_laporan, tanggal_kirim, angka_laporan, dicatat_oleh, jabatan, keterangan, dicatat_pada)
     VALUES (?,?,?,?,?,?,?,?)
     ON DUPLICATE KEY UPDATE
       tanggal_kirim = VALUES(tanggal_kirim),
       angka_laporan = VALUES(angka_laporan),
       dicatat_oleh = VALUES(dicatat_oleh),
       jabatan = VALUES(jabatan),
       keterangan = VALUES(keterangan),
       dicatat_pada = VALUES(dicatat_pada)`,
    [
      Number(c.lipaNomor),
      String(c.bulanLaporan),
      c.tanggalKirim || null,
      c.angkaLaporan === "" || c.angkaLaporan === undefined ? null : c.angkaLaporan,
      String(c.dicatatOleh || "").slice(0, 191),
      String(c.jabatan || "").slice(0, 191),
      c.keterangan === undefined ? null : String(c.keterangan),
      botDb.toMysqlDate ? botDb.toMysqlDate(waktu) : waktu,
    ]
  );
  return { ok: true };
}

async function bacaPengiriman(lipaNomor, bulanDari, bulanSampai) {
  await pastikanTabel();
  const baris = await botDb.query(
    `SELECT lipa_nomor AS lipaNomor, bulan_laporan AS bulanLaporan,
            tanggal_kirim AS tanggalKirim, angka_laporan AS angkaLaporan,
            dicatat_oleh AS dicatatOleh, jabatan, keterangan, dicatat_pada AS dicatatPada
       FROM ${TABEL}
      WHERE lipa_nomor = ? AND bulan_laporan >= ? AND bulan_laporan <= ?
      ORDER BY bulan_laporan ASC`,
    [Number(lipaNomor), String(bulanDari), String(bulanSampai)]
  );
  return Array.isArray(baris) ? baris : [];
}

/**
 * Blangko nilai satu LIPA untuk beberapa bulan.
 *
 * Bentuk kolomnya SAMA untuk kedua puluh dua laporan - itu syarat rencana, dan
 * diperiksa oleh penjaganya.
 */
const KOLOM_BLANGKO = [
  "bulanLaporan",
  "batasKirim",
  "tanggalKirim",
  "terlambatHari",
  "angkaLaporan",
  "angkaSipp",
  "selisihAngka",
  "nilai",
  "keadaan",
];

function keadaanDariNilai(nilai) {
  if (nilai === null) return "belum dapat dinilai";
  if (nilai >= 95) return "baik";
  if (nilai >= 75) return "perhatian";
  return "tindakan";
}

/**
 * @param bulan  daftar bulan "YYYY-MM"
 * @param catat  peta bulan -> { tanggalKirim, angkaLaporan }
 * @param sipp   peta bulan -> angka hasil hitung SIPP, atau null bila belum tersambung
 */
function blangkoNilai(nomor, bulan, catat = {}, sipp = {}) {
  const butir = butirLipa(nomor);
  if (!butir) throw new Error(`LIPA ${nomor} tidak dikenali`);

  const baris = (Array.isArray(bulan) ? bulan : []).map((b) => {
    const batas = batasKirim(b, nomor);
    const c = Object.prototype.hasOwnProperty.call(catat, b) ? catat[b] : {};
    const angkaSipp = Object.prototype.hasOwnProperty.call(sipp, b) ? sipp[b] : null;
    const n = nilaiBaris({
      batas: batas.tanggal,
      tanggalKirim: c.tanggalKirim || null,
      angkaLaporan: c.angkaLaporan === undefined ? null : c.angkaLaporan,
      angkaSipp,
    });
    return {
      bulanLaporan: b,
      batasKirim: batas.tanggal,
      tanggalKirim: c.tanggalKirim || null,
      terlambatHari: n.terlambatHari,
      angkaLaporan: c.angkaLaporan === undefined ? null : c.angkaLaporan,
      angkaSipp,
      selisihAngka: n.selisihAngka,
      nilai: n.nilai,
      keadaan: keadaanDariNilai(n.nilai),
      nilaiKetepatan: n.nilaiKetepatan,
      nilaiKesesuaian: n.nilaiKesesuaian,
      bobotTerpakai: n.bobotTerpakai,
      belumDapatDinilai: n.belumDapatDinilai,
    };
  });

  return {
    lipa: kunciLipa(nomor),
    nomor: butir.nomor,
    nama: butir.nama,
    dipa04: Boolean(butir.dipa04),
    kolom: KOLOM_BLANGKO.slice(),
    baris,
    catatan:
      "Batas kirim tanggal " +
      String(baris.length ? batasKirim(baris[0].bulanLaporan, nomor).hari : "-") +
      " bulan berikutnya. Nilai dari ketepatan waktu (bobot 60) dan kesesuaian angka dengan SIPP (bobot 40). " +
      "Hari libur belum diperhitungkan pada batas kirim; keputusannya belum diambil.",
  };
}

module.exports = {
  TABEL,
  LIPA,
  KOLOM_BLANGKO,
  BOBOT_KETEPATAN,
  BOBOT_KESESUAIAN,
  POTONGAN_PER_HARI_TERLAMBAT,
  POTONGAN_PER_SATUAN_SELISIH,
  butirLipa,
  kunciLipa,
  batasKirim,
  nilaiBaris,
  keadaanDariNilai,
  blangkoNilai,
  pastikanTabel,
  lupakanTabel,
  celaCatatan,
  catatPengiriman,
  bacaPengiriman,
};
