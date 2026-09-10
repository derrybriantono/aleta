"use strict";

/**
 * ============================================================================
 * STATISTIK PERKARA DAN PARA PIHAK - SISA BAB 9 KATALOG
 * ============================================================================
 *
 * Empat belas butir. Delapan butir Bab 9 lainnya sudah dikerjakan berkas lain
 * (kelengkapan ruas pihak dan sebaran wilayah).
 *
 * ============================================================================
 * SATU BUTIR DI SINI MENILAI CAPAIAN, SISANYA MENILAI BAHAN
 * ============================================================================
 *
 * Ini perlu disadari siapa pun yang membaca papannya, sebab kedua jenis angka
 * itu terlihat sama persis.
 *
 * ST12 - tingkat penggunaan e-Court - menilai CAPAIAN. Angkanya rendah bukan
 * karena datanya buruk melainkan karena memang sedikit yang mendaftar secara
 * elektronik, dan yang memperbaikinya sosialisasi, bukan pengisian kolom.
 *
 * Tiga belas butir lainnya menilai BAHAN: apakah statistiknya dapat disusun
 * sama sekali. Angka rendah di situ berarti kolomnya kosong, dan yang
 * memperbaikinya mengisi kolomnya.
 *
 * Menyamakan keduanya akan membuat seseorang mengejar angka e-Court dengan
 * cara yang sama seperti mengejar angka kelengkapan data - dan itu tidak
 * mungkin berhasil.
 *
 * ============================================================================
 * TIGA HAL YANG DITEMUKAN SAAT MENGUKUR
 * ============================================================================
 *
 * Pertama: 76 perkara berstatus Dicabut dan 1 Gugur, dan TIDAK SATU PUN punya
 * tanggal_cabut atau tanggal_gugur. Kolomnya ada pada perkara_putusan dan
 * tidak pernah diisi - statusnya diketahui, tanggalnya tidak. Laporan perkara
 * dicabut per bulan karena itu tidak dapat disusun dari SIPP satuan kerja ini
 * tanpa memakai tanggal putusannya sebagai pengganti, dan keduanya bukan hal
 * yang sama.
 *
 * Kedua: pendidikan pihak terisi 66 dari 493. Katalog meminta faktor penyebab
 * perceraian DISILANGKAN dengan usia perkawinan dan pendidikan; persilangan
 * itu hanya dapat disusun atas seperdelapan perkaranya.
 *
 * Ketiga: 228 dari 388 putusan punya tanggal berkekuatan hukum tetap. Pada 160
 * sisanya, "apakah perkara ini diupayakan hukum" tidak dapat dijawab - tidak
 * ada baris banding, dan juga tidak ada tanggal yang menyatakan tenggangnya
 * sudah lewat.
 */

const db = require("../db_config");
const kerangka = require("./kerangkaPenilaianService");
const sippSkemaService = require("./sippSkemaService");

const BATAS_BARIS = 5000;

/** Asas penyelesaian perkara pada peradilan tingkat pertama. */
const HARI_ASAS_PENYELESAIAN = 150;

/** Batas usia perkawinan yang masih masuk akal, dalam tahun. */
const USIA_KAWIN_MAKSIMAL = 80;

/**
 * Berapa simpangan baku dari rerata jenisnya sebelum satu perkara disebut
 * menyimpang. Dua dipilih supaya yang ditandai benar-benar sedikit - pada
 * sebaran yang wajar, sekitar lima persen.
 */
const LEBAR_SIMPANGAN_JENIS = 2;

/** Berapa putusan sejenis yang dibutuhkan sebelum sebarannya berarti. */
const MINIMAL_PUTUSAN_SEJENIS = 10;

function runQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (error, hasil) => {
      if (error) reject(error);
      else resolve(Array.isArray(hasil) ? hasil : []);
    });
  });
}

const teks = (n) => String(n == null ? "" : n).trim();
const angka = (n) => {
  const x = Number(n);
  return Number.isFinite(x) ? x : 0;
};

function tanggalTerisi(nilai) {
  const t = teks(nilai);
  if (!t) return false;
  if (/^0000-00-00/.test(t)) return false;
  return true;
}

/** Ruas teks SIPP yang "terisi" dengan tanda hubung sebenarnya kosong. */
function ruasTerisi(nilai) {
  const t = teks(nilai);
  if (!t) return false;
  if (t === "-") return false;
  if (/^0000-00-00/.test(t)) return false;
  return true;
}

function selisihHari(awal, akhir) {
  if (!tanggalTerisi(awal) || !tanggalTerisi(akhir)) return null;
  const a = new Date(awal);
  const b = new Date(akhir);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return null;
  return Math.round((b - a) / 86400000);
}

/** Bulan YYYY-MM dari tanggal apa pun bentuknya, termasuk objek Date. */
function bulanDari(nilai) {
  if (nilai instanceof Date && !Number.isNaN(nilai.getTime())) {
    return `${nilai.getFullYear()}-${String(nilai.getMonth() + 1).padStart(2, "0")}`;
  }
  return teks(nilai).slice(0, 7);
}

async function tabelSiap(daftar) {
  for (const t of daftar) {
    const ada = await sippSkemaService.tabelAda(t).catch(() => false);
    if (!ada) return false;
  }
  return true;
}

/**
 * ============================================================================
 * ST01 - KEADAAN PERKARA BULANAN
 * ============================================================================
 *
 * Tiga angka yang harus berimbang: diterima, diputus, dan sisa. Sisa yang
 * NEGATIF berarti bulan itu memutus lebih banyak daripada yang pernah masuk -
 * mustahil, dan hampir selalu berarti tanggal putusan mendahului tanggal
 * pendaftarannya pada beberapa perkara.
 *
 * Sisa di sini dihitung atas perkara yang DIDAFTARKAN pada rentang, bukan atas
 * seluruh tunggakan satuan kerja. Sisa satuan kerja yang sesungguhnya memuat
 * perkara tahun-tahun sebelumnya, dan itu di luar rentang penilaian.
 */
async function barisKeadaanBulanan(rentang) {
  if (!(await tabelSiap(["perkara", "perkara_putusan"]))) return [];

  const hasil = await runQuery(
    `SELECT DATE_FORMAT(p.tanggal_pendaftaran, '%Y-%m')      AS bulan,
            COUNT(*)                                          AS diterima,
            SUM(d.tanggal_putusan IS NOT NULL
                AND d.tanggal_putusan <> '0000-00-00')        AS diputus
       FROM perkara p
       LEFT JOIN perkara_putusan d ON d.perkara_id = p.perkara_id
      WHERE p.tanggal_pendaftaran >= ? AND p.tanggal_pendaftaran <= ?
      GROUP BY bulan
      ORDER BY bulan`,
    [rentang.mulai, rentang.selesai]
  );

  return hasil.map((x) => {
    const diterima = angka(x.diterima);
    const diputus = angka(x.diputus);
    const sisa = diterima - diputus;
    const sebab = [];

    if (diterima === 0) sebab.push("tidak ada penerimaan tercatat pada bulan ini");
    if (sisa < 0) {
      sebab.push(
        `sisa negatif (${sisa}) - diputus ${diputus} dari ${diterima} yang masuk, dan itu mustahil; biasanya tanggal putusan mendahului pendaftarannya`
      );
    }

    return {
      kunci: `keadaan-${teks(x.bulan)}`,
      bulan: teks(x.bulan),
      diterima,
      diputus,
      sisa,
      memenuhi: sebab.length === 0,
      sebabTidakMemenuhi: sebab.join("; "),
    };
  });
}

/**
 * ============================================================================
 * ST04 - FAKTOR PENYEBAB PERCERAIAN, DISILANGKAN
 * ============================================================================
 *
 * Katalog tidak meminta daftar faktornya saja - ia meminta faktor itu
 * DISILANGKAN dengan usia perkawinan dan pendidikan. Persilangan hanya dapat
 * disusun bila ketiganya ada pada perkara yang sama.
 *
 * Diukur pada SIPP sungguhan: faktor terisi 252 dari 252, usia perkawinan
 * terhitung untuk 371 dari 431 perkara, tetapi pendidikan hanya 66 dari 493
 * baris pihak. Persilangan tiga arah karena itu hanya dapat disusun atas
 * seperdelapan perkaranya - dan daftar faktor yang tampak lengkap menyembunyikan
 * kekurangan itu sepenuhnya.
 */
async function barisFaktorPerceraian(rentang) {
  if (!(await tabelSiap(["perkara", "perkara_akta_cerai", "faktor_perceraian", "perkara_pihak1", "pihak"]))) {
    return [];
  }

  const hasil = await runQuery(
    `SELECT p.nomor_perkara           AS nomorPerkara,
            p.jenis_perkara_nama      AS jenisPerkara,
            p.tanggal_pendaftaran     AS tanggalDaftar,
            a.faktor_perceraian_id    AS faktorId,
            f.nama                    AS faktorNama,
            n.tgl_nikah               AS tanggalNikah,
            MAX(CASE WHEN ${ruasTerisiSql("h.pendidikan")} THEN 1 ELSE 0 END) AS adaPendidikan
       FROM perkara p
       JOIN perkara_akta_cerai a ON a.perkara_id = p.perkara_id
       LEFT JOIN faktor_perceraian f ON f.id = a.faktor_perceraian_id
       LEFT JOIN perkara_data_pernikahan n ON n.perkara_id = p.perkara_id
       LEFT JOIN perkara_pihak1 pp ON pp.perkara_id = p.perkara_id
       LEFT JOIN pihak h ON h.id = pp.pihak_id
      WHERE p.tanggal_pendaftaran >= ? AND p.tanggal_pendaftaran <= ?
      GROUP BY p.perkara_id, p.nomor_perkara, p.jenis_perkara_nama, p.tanggal_pendaftaran,
               a.faktor_perceraian_id, f.nama, n.tgl_nikah
      ORDER BY p.nomor_perkara
      LIMIT ${BATAS_BARIS}`,
    [rentang.mulai, rentang.selesai]
  );

  return hasil.map((x) => {
    const sebab = [];
    if (!angka(x.faktorId)) sebab.push("faktor penyebab perceraiannya tidak dipilih");
    else if (!teks(x.faktorNama)) {
      sebab.push(
        `faktor bernomor ${teks(x.faktorId)} tidak ada pada dua puluh enam kategori baku - angkanya tidak dapat dikelompokkan`
      );
    }
    if (!tanggalTerisi(x.tanggalNikah)) sebab.push("tanggal nikahnya kosong - usia perkawinan tidak terhitung");
    if (!angka(x.adaPendidikan)) sebab.push("pendidikan pihaknya kosong - persilangannya tidak dapat disusun");

    return {
      kunci: `${teks(x.nomorPerkara)}#ST04`,
      nomorPerkara: teks(x.nomorPerkara),
      jenisPerkara: teks(x.jenisPerkara),
      faktor: teks(x.faktorNama),
      memenuhi: sebab.length === 0,
      sebabTidakMemenuhi: sebab.join("; "),
    };
  });
}

/**
 * Potongan SQL "ruas ini benar-benar terisi".
 *
 * Ditulis satu kali sebab bentuk "belum diisi" milik SIPP ada beberapa
 * sekaligus, dan dua tempat yang menuliskannya berbeda akan menghasilkan dua
 * angka kelengkapan yang keduanya tampak masuk akal.
 */
function ruasTerisiSql(kolom) {
  return `(${kolom} IS NOT NULL AND TRIM(${kolom}) <> '' AND TRIM(${kolom}) <> '-')`;
}

/**
 * ============================================================================
 * ST08 - SEBARAN USIA PERKAWINAN
 * ============================================================================
 *
 * Hanya perkara perceraian yang dinilai. Permohonan dispensasi kawin dan
 * itsbat nikah tidak punya "usia perkawinan sebelum perkara diajukan", dan
 * menuntutnya berarti menyalahkan pengadilan atas sesuatu yang memang tidak
 * ada.
 *
 * Usia NEGATIF ikut ditandai: tanggal nikah sesudah tanggal pendaftaran
 * berarti salah ketik tahun, dan salah ketik itu akan menarik seluruh rerata
 * sebaran ke bawah tanpa ada yang menyadarinya.
 *
 * Diukur pada SIPP sungguhan: usia perkawinan 0 sampai 36 tahun, rerata 10,
 * dan tidak satu pun negatif.
 */
async function barisUsiaPerkawinan(rentang) {
  if (!(await tabelSiap(["perkara", "perkara_data_pernikahan"]))) return [];

  const hasil = await runQuery(
    `SELECT p.nomor_perkara       AS nomorPerkara,
            p.jenis_perkara_nama  AS jenisPerkara,
            p.tanggal_pendaftaran AS tanggalDaftar,
            n.tgl_nikah           AS tanggalNikah
       FROM perkara p
       LEFT JOIN perkara_data_pernikahan n ON n.perkara_id = p.perkara_id
      WHERE p.tanggal_pendaftaran >= ? AND p.tanggal_pendaftaran <= ?
        AND p.jenis_perkara_nama LIKE '%erai%'
      ORDER BY p.tanggal_pendaftaran
      LIMIT ${BATAS_BARIS}`,
    [rentang.mulai, rentang.selesai]
  );

  return hasil.map((x) => {
    const hari = selisihHari(x.tanggalNikah, x.tanggalDaftar);
    const tahun = hari === null ? null : Math.floor(hari / 365);
    const sebab = [];

    if (!tanggalTerisi(x.tanggalNikah)) sebab.push("tanggal nikahnya tidak tercatat");
    else if (hari === null) sebab.push("tanggal nikahnya tidak dapat dibaca sebagai tanggal");
    else if (hari < 0) {
      sebab.push(
        `menikah ${Math.abs(hari)} hari SESUDAH perkaranya didaftarkan - hampir selalu salah ketik tahun, dan satu baris seperti ini menarik seluruh rerata sebaran`
      );
    } else if (tahun > USIA_KAWIN_MAKSIMAL) {
      sebab.push(`usia perkawinan terhitung ${tahun} tahun, melampaui batas wajar ${USIA_KAWIN_MAKSIMAL} tahun`);
    }

    return {
      kunci: `${teks(x.nomorPerkara)}#ST08`,
      nomorPerkara: teks(x.nomorPerkara),
      jenisPerkara: teks(x.jenisPerkara),
      usiaPerkawinanTahun: tahun,
      memenuhi: sebab.length === 0,
      sebabTidakMemenuhi: sebab.join("; "),
    };
  });
}

/**
 * Penerimaan per bulan pada satu rentang. Dipakai ST10.
 */
async function penerimaanBulanan(rentang) {
  const hasil = await runQuery(
    `SELECT DATE_FORMAT(p.tanggal_pendaftaran, '%Y-%m') AS bulan, COUNT(*) AS jumlah
       FROM perkara p
      WHERE p.tanggal_pendaftaran >= ? AND p.tanggal_pendaftaran <= ?
      GROUP BY bulan
      ORDER BY bulan`,
    [rentang.mulai, rentang.selesai]
  );
  return hasil.map((x) => ({ bulan: teks(x.bulan), jumlah: angka(x.jumlah) }));
}

/**
 * ============================================================================
 * ST10 - TREN DAN POLA MUSIMAN
 * ============================================================================
 *
 * Pola musiman hanya dapat diurai bila tiap bulan punya PEMBANDING PADA BULAN
 * YANG SAMA TAHUN SEBELUMNYA. Tanpa itu yang terhitung bukan pola musiman
 * melainkan naik turun biasa - dan naik turun biasa yang disebut "pola
 * musiman" akan dipakai orang memperkirakan bulan depan.
 *
 * Karena itu butir ini TIDAK menghasilkan proyeksi. Yang dinilai apakah
 * bahannya cukup untuk menguraikannya sama sekali. Pada rentang satu tahun,
 * jawabannya selalu tidak - dan itu memang jawaban yang benar.
 */
async function barisTrenMusiman(rentang) {
  if (!(await tabelSiap(["perkara"]))) return [];
  const rekap = await penerimaanBulanan(rentang);
  if (rekap.length === 0) return [];

  const peta = new Map(rekap.map((x) => [x.bulan, x.jumlah]));

  return rekap.map((x) => {
    const [tahun, bulan] = x.bulan.split("-");
    const kunciLalu = `${Number(tahun) - 1}-${bulan}`;
    const adaPembanding = peta.has(kunciLalu);

    return {
      kunci: `musiman-${x.bulan}`,
      bulan: x.bulan,
      penerimaan: x.jumlah,
      bulanPembanding: kunciLalu,
      memenuhi: adaPembanding,
      sebabTidakMemenuhi: adaPembanding
        ? ""
        : `tidak ada data ${kunciLalu} di dalam rentang ini - yang terhitung hanya naik turun biasa, bukan pola musiman; rentang penilaiannya perlu memuat sekurangnya dua tahun`,
    };
  });
}

/**
 * ============================================================================
 * ST11 - PERKARA BERDASARKAN CARA PENDAFTARAN
 * ============================================================================
 *
 * SIPP tidak punya kolom "cara pendaftaran". Ketiganya DITURUNKAN:
 *
 *   e-Court        punya baris pada perkara_efiling_id
 *   sidang keliling  bertanda sidang_keliling pada jadwal sidangnya
 *   manual         bukan keduanya
 *
 * Yang dinilai apakah penggolongan itu dapat dilakukan tanpa bertentangan.
 * Perkara yang bertanda sidang keliling TETAPI seluruh sidangnya di ruang
 * sidang bernomor tidak dapat digolongkan - dan pada laporan ia akan masuk
 * golongan mana pun yang kebetulan diperiksa lebih dulu.
 */
async function barisCaraPendaftaran(rentang) {
  if (!(await tabelSiap(["perkara", "perkara_jadwal_sidang"]))) return [];
  const adaEfiling = await sippSkemaService.tabelAda("perkara_efiling_id").catch(() => false);

  const hasil = await runQuery(
    `SELECT p.nomor_perkara      AS nomorPerkara,
            p.jenis_perkara_nama AS jenisPerkara,
            ${
              adaEfiling
                ? `(SELECT COUNT(*) FROM perkara_efiling_id e WHERE e.perkara_id = p.perkara_id)`
                : "0"
            }                                                        AS jumlahEfiling,
            (SELECT COUNT(*) FROM perkara_jadwal_sidang j
              WHERE j.perkara_id = p.perkara_id
                AND j.sidang_keliling IS NOT NULL
                AND j.sidang_keliling NOT IN ('', '0', 'T'))          AS jumlahKeliling,
            (SELECT COUNT(*) FROM perkara_jadwal_sidang j
              WHERE j.perkara_id = p.perkara_id
                AND j.sidang_keliling IS NOT NULL
                AND j.sidang_keliling NOT IN ('', '0', 'T')
                AND j.ruangan IS NOT NULL
                AND TRIM(j.ruangan) <> ''
                AND j.ruangan NOT REGEXP '^[[:space:]]*Ruang[[:space:]]+Sidang[[:space:]]*[0-9]+[[:space:]]*$')
                                                                      AS kelilingBertempat
       FROM perkara p
      WHERE p.tanggal_pendaftaran >= ? AND p.tanggal_pendaftaran <= ?
      ORDER BY p.nomor_perkara
      LIMIT ${BATAS_BARIS}`,
    [rentang.mulai, rentang.selesai]
  );

  return hasil.map((x) => {
    const efiling = angka(x.jumlahEfiling);
    const keliling = angka(x.jumlahKeliling);
    const bertempat = angka(x.kelilingBertempat);
    const sebab = [];

    if (keliling > 0 && bertempat === 0) {
      sebab.push(
        "bertanda sidang keliling tetapi tidak satu pun sidangnya menyebut tempat di luar ruang sidang - golongannya tidak dapat dipastikan"
      );
    }

    const golongan = efiling > 0 ? "e-Court" : keliling > 0 ? "sidang keliling" : "manual";

    return {
      kunci: `${teks(x.nomorPerkara)}#ST11`,
      nomorPerkara: teks(x.nomorPerkara),
      jenisPerkara: teks(x.jenisPerkara),
      caraPendaftaran: golongan,
      memenuhi: sebab.length === 0,
      sebabTidakMemenuhi: sebab.join("; "),
    };
  });
}

/**
 * ============================================================================
 * ST12 - TINGKAT PENGGUNAAN e-COURT
 * ============================================================================
 *
 * SATU-SATUNYA butir di berkas ini yang menilai CAPAIAN, bukan bahan.
 * Angkanya adalah proporsi perkara yang benar-benar didaftarkan secara
 * elektronik - dan angka rendah di sini berarti sedikit yang memakainya,
 * bukan berarti datanya buruk.
 *
 * Yang memperbaikinya sosialisasi kepada advokat dan pencari keadilan, bukan
 * pengisian kolom. Menaruhnya berdampingan dengan butir kelengkapan data
 * tanpa kalimat ini akan membuat seseorang mengejarnya dengan cara yang tidak
 * mungkin berhasil.
 *
 * Diukur pada SIPP sungguhan: 45 dari 431 perkara, sekitar sepuluh persen.
 */
async function barisTingkatEcourt(rentang) {
  if (!(await tabelSiap(["perkara", "perkara_efiling_id"]))) return [];

  const hasil = await runQuery(
    `SELECT p.nomor_perkara      AS nomorPerkara,
            p.jenis_perkara_nama AS jenisPerkara,
            (SELECT COUNT(*) FROM perkara_efiling_id e WHERE e.perkara_id = p.perkara_id) AS jumlahEfiling
       FROM perkara p
      WHERE p.tanggal_pendaftaran >= ? AND p.tanggal_pendaftaran <= ?
      ORDER BY p.nomor_perkara
      LIMIT ${BATAS_BARIS}`,
    [rentang.mulai, rentang.selesai]
  );

  return hasil.map((x) => {
    const elektronik = angka(x.jumlahEfiling) > 0;
    return {
      kunci: `${teks(x.nomorPerkara)}#ST12`,
      nomorPerkara: teks(x.nomorPerkara),
      jenisPerkara: teks(x.jenisPerkara),
      memenuhi: elektronik,
      sebabTidakMemenuhi: elektronik
        ? ""
        : "didaftarkan secara manual - ini angka CAPAIAN, bukan kekurangan data; yang menaikkannya sosialisasi kepada advokat dan pencari keadilan",
    };
  });
}

/**
 * ============================================================================
 * ST14 - PERKARA DICABUT DAN GUGUR
 * ============================================================================
 *
 * Perkara yang berakhir tanpa putusan pokok tetap harus punya TANGGALNYA -
 * laporan perkara dicabut disusun per bulan, dan bulan itu adalah bulan
 * pencabutannya, bukan bulan putusannya.
 *
 * Diukur pada SIPP sungguhan: 76 perkara berstatus Dicabut dan 1 Gugur, dan
 * TIDAK SATU PUN punya tanggal_cabut atau tanggal_gugur. Kolomnya ada dan
 * tidak pernah diisi. Butir ini karena itu akan merah seluruhnya sampai
 * pengisiannya dimulai - dan itulah yang ingin ditunjukkannya.
 */
async function barisDicabutGugur(rentang) {
  if (!(await tabelSiap(["perkara", "perkara_putusan", "status_putusan"]))) return [];

  const hasil = await runQuery(
    `SELECT p.nomor_perkara      AS nomorPerkara,
            p.jenis_perkara_nama AS jenisPerkara,
            s.nama               AS statusNama,
            d.tanggal_putusan    AS tanggalPutusan,
            d.tanggal_cabut      AS tanggalCabut,
            d.tanggal_gugur      AS tanggalGugur
       FROM perkara p
       JOIN perkara_putusan d ON d.perkara_id = p.perkara_id
       JOIN status_putusan s ON s.id = d.status_putusan_id
      WHERE p.tanggal_pendaftaran >= ? AND p.tanggal_pendaftaran <= ?
        AND (s.nama LIKE '%abut%' OR s.nama LIKE '%ugur%')
      ORDER BY d.tanggal_putusan
      LIMIT ${BATAS_BARIS}`,
    [rentang.mulai, rentang.selesai]
  );

  return hasil.map((x) => {
    const status = teks(x.statusNama);
    const cabut = /abut/i.test(status);
    const adaTanggal = cabut ? tanggalTerisi(x.tanggalCabut) : tanggalTerisi(x.tanggalGugur);

    return {
      kunci: `${teks(x.nomorPerkara)}#ST14`,
      nomorPerkara: teks(x.nomorPerkara),
      jenisPerkara: teks(x.jenisPerkara),
      statusAkhir: status,
      memenuhi: adaTanggal,
      sebabTidakMemenuhi: adaTanggal
        ? ""
        : `berstatus ${status} tetapi ${
            cabut ? "tanggal_cabut" : "tanggal_gugur"
          } kosong - laporan bulanannya disusun menurut tanggal itu, bukan menurut tanggal putusannya`,
    };
  });
}

/**
 * ============================================================================
 * ST15 - PERKARA PRODEO
 * ============================================================================
 *
 * Dua catatan yang harus sepakat: penanda prodeo pada perkara, dan panjar yang
 * memang tidak terbayar. Perkara bertanda prodeo yang panjarnya terbayar penuh
 * berarti salah satu catatannya keliru, dan keduanya dipakai menyusun laporan
 * yang berbeda.
 *
 * Berbeda dari butir LIPA 15 yang menilai bahan laporannya, butir ini menilai
 * KESEPAKATAN kedua catatan itu pada tiap perkara.
 */
const BATAS_PANJAR_NOL = 10000;

async function barisPerkaraProdeo(rentang) {
  if (!(await tabelSiap(["perkara", "perkara_biaya"]))) return [];

  const hasil = await runQuery(
    `SELECT p.nomor_perkara      AS nomorPerkara,
            p.jenis_perkara_nama AS jenisPerkara,
            p.prodeo             AS prodeo,
            COALESCE((SELECT SUM(b.jumlah) FROM perkara_biaya b
                       WHERE b.perkara_id = p.perkara_id
                         AND b.jenis_transaksi = 1), 0)  AS panjarMasuk
       FROM perkara p
      WHERE p.tanggal_pendaftaran >= ? AND p.tanggal_pendaftaran <= ?
        AND p.prodeo = 1
      ORDER BY p.nomor_perkara
      LIMIT ${BATAS_BARIS}`,
    [rentang.mulai, rentang.selesai]
  );

  return hasil.map((x) => {
    const panjar = angka(x.panjarMasuk);
    const selaras = panjar <= BATAS_PANJAR_NOL;

    return {
      kunci: `${teks(x.nomorPerkara)}#ST15`,
      nomorPerkara: teks(x.nomorPerkara),
      jenisPerkara: teks(x.jenisPerkara),
      panjarMasuk: panjar,
      memenuhi: selaras,
      sebabTidakMemenuhi: selaras
        ? ""
        : `bertanda prodeo tetapi panjarnya terbayar Rp${panjar.toLocaleString(
            "id-ID"
          )} - salah satu dari kedua catatan itu keliru, dan keduanya dipakai laporan yang berbeda`,
    };
  });
}

/**
 * ============================================================================
 * ST16 - PERKARA DENGAN PANGGILAN GHAIB
 * ============================================================================
 *
 * Pemanggilan ghaib dilakukan melalui media massa dan memakan tenggang tiga
 * bulan sebelum sidang pertama. Perkara bertanda ghaib yang tidak punya satu
 * pun relaas berarti pemanggilannya tidak dapat dibuktikan pernah dilakukan -
 * dan putusan verstek yang bersandar padanya menjadi rapuh.
 *
 * Diukur pada SIPP sungguhan: 11 pihak ditandai ghaib.
 */
async function barisPanggilanGhaib(rentang) {
  if (!(await tabelSiap(["perkara", "perkara_pihak2"]))) return [];
  const adaRelaas = await sippSkemaService.tabelAda("perkara_pelaksanaan_relaas").catch(() => false);

  const hasil = await runQuery(
    `SELECT p.nomor_perkara      AS nomorPerkara,
            p.jenis_perkara_nama AS jenisPerkara,
            ${
              adaRelaas
                ? `(SELECT COUNT(*) FROM perkara_pelaksanaan_relaas r WHERE r.perkara_id = p.perkara_id)`
                : "-1"
            }                                                  AS jumlahRelaas
       FROM perkara p
       JOIN perkara_pihak2 x2 ON x2.perkara_id = p.perkara_id
      WHERE p.tanggal_pendaftaran >= ? AND p.tanggal_pendaftaran <= ?
        AND x2.ghaib IS NOT NULL AND x2.ghaib NOT IN ('', '0', 'T')
      GROUP BY p.perkara_id, p.nomor_perkara, p.jenis_perkara_nama
      ORDER BY p.nomor_perkara
      LIMIT ${BATAS_BARIS}`,
    [rentang.mulai, rentang.selesai]
  );

  return hasil.map((x) => {
    const relaas = angka(x.jumlahRelaas);
    const cukup = relaas !== 0;

    return {
      kunci: `${teks(x.nomorPerkara)}#ST16`,
      nomorPerkara: teks(x.nomorPerkara),
      jenisPerkara: teks(x.jenisPerkara),
      jumlahRelaas: relaas,
      memenuhi: cukup,
      sebabTidakMemenuhi: cukup
        ? ""
        : "pihaknya ditandai ghaib tetapi tidak ada satu pun pelaksanaan relaas - pemanggilannya tidak dapat dibuktikan pernah dilakukan, dan putusan verstek yang bersandar padanya menjadi rapuh",
    };
  });
}

/**
 * ============================================================================
 * ST17 - DELEGASI BANTUAN PANGGILAN
 * ============================================================================
 *
 * Berbeda dari butir beban kerja yang menilai kelengkapan SURATNYA, butir ini
 * menilai apakah delegasi masuk benar-benar SELESAI DIKERJAKAN: relaasnya
 * dilaksanakan dan dikirim kembali kepada pengadilan pengirim.
 *
 * Delegasi yang suratnya lengkap tetapi relaasnya tidak pernah kembali adalah
 * perkara pengadilan LAIN yang tertahan - dan yang menanggung akibatnya pihak
 * di pengadilan sana, yang tidak pernah tahu kepada siapa harus bertanya.
 */
async function barisDelegasiPanggilan(rentang) {
  if (!(await tabelSiap(["delegasi_masuk", "delegasi_proses_masuk"]))) return [];

  const hasil = await runQuery(
    `SELECT m.id                    AS delegasiId,
            m.nomor_perkara         AS nomorPerkara,
            m.pn_asal_text          AS pengirim,
            m.tgl_delegasi          AS tanggalDelegasi,
            pr.tgl_penunjukan_jurusita AS tanggalTunjuk,
            pr.tgl_relaas           AS tanggalRelaas,
            pr.tgl_pengiriman_relaas AS tanggalKirimBalik
       FROM delegasi_masuk m
       LEFT JOIN delegasi_proses_masuk pr ON pr.delegasi_id = m.id
      WHERE m.tgl_delegasi >= ? AND m.tgl_delegasi <= ?
      ORDER BY m.tgl_delegasi
      LIMIT ${BATAS_BARIS}`,
    [rentang.mulai, rentang.selesai]
  );

  return hasil.map((x) => {
    const sebab = [];
    if (!tanggalTerisi(x.tanggalTunjuk)) sebab.push("jurusitanya belum ditunjuk");
    if (!tanggalTerisi(x.tanggalRelaas)) sebab.push("relaasnya belum dilaksanakan");
    if (!tanggalTerisi(x.tanggalKirimBalik)) {
      sebab.push("relaasnya belum dikirim kembali kepada pengadilan pengirim");
    }

    return {
      kunci: `delegasi-selesai-${teks(x.delegasiId)}`,
      nomorPerkara: teks(x.nomorPerkara),
      pengirim: teks(x.pengirim),
      tanggal: teks(x.tanggalDelegasi),
      memenuhi: sebab.length === 0,
      sebabTidakMemenuhi: sebab.length
        ? `${sebab.join("; ")} - ini perkara pengadilan lain yang tertahan di sini, dan yang menanggung akibatnya pihak di sana`
        : "",
    };
  });
}

/**
 * ============================================================================
 * ST18 - PROFIL UPAYA HUKUM
 * ============================================================================
 *
 * Pertanyaannya sederhana: berapa banyak putusan yang diupayakan hukum. Yang
 * tidak sederhana adalah penyebutnya - putusan yang BELUM berkekuatan hukum
 * tetap dan juga belum diupayakan hukum tidak dapat dijawab sama sekali,
 * sebab tenggangnya mungkin masih berjalan.
 *
 * Menghitungnya sebagai "tidak diupayakan hukum" akan menggelembungkan angka
 * penerimaan putusan - dan angka itu dipakai menilai mutu putusan.
 *
 * Diukur pada SIPP sungguhan: 228 dari 388 putusan punya tanggal berkekuatan
 * hukum tetap; pada 160 sisanya pertanyaannya belum dapat dijawab.
 */
async function barisProfilUpayaHukum(rentang) {
  if (!(await tabelSiap(["perkara", "perkara_putusan"]))) return [];

  const adaBanding = await sippSkemaService.tabelAda("perkara_banding").catch(() => false);
  const adaKasasi = await sippSkemaService.tabelAda("perkara_kasasi").catch(() => false);
  const adaPk = await sippSkemaService.tabelAda("perkara_pk").catch(() => false);

  const hitung = (tabel, ada) =>
    ada ? `(SELECT COUNT(*) FROM ${tabel} u WHERE u.perkara_id = p.perkara_id)` : "0";

  const hasil = await runQuery(
    `SELECT p.nomor_perkara      AS nomorPerkara,
            p.jenis_perkara_nama AS jenisPerkara,
            d.tanggal_putusan    AS tanggalPutusan,
            d.tanggal_bht        AS tanggalBht,
            ${hitung("perkara_banding", adaBanding)} AS jumlahBanding,
            ${hitung("perkara_kasasi", adaKasasi)}   AS jumlahKasasi,
            ${hitung("perkara_pk", adaPk)}           AS jumlahPk
       FROM perkara p
       JOIN perkara_putusan d ON d.perkara_id = p.perkara_id
      WHERE p.tanggal_pendaftaran >= ? AND p.tanggal_pendaftaran <= ?
        AND d.tanggal_putusan IS NOT NULL AND d.tanggal_putusan <> '0000-00-00'
      ORDER BY d.tanggal_putusan
      LIMIT ${BATAS_BARIS}`,
    [rentang.mulai, rentang.selesai]
  );

  return hasil.map((x) => {
    const upaya = angka(x.jumlahBanding) + angka(x.jumlahKasasi) + angka(x.jumlahPk);
    const bht = tanggalTerisi(x.tanggalBht);
    const terjawab = upaya > 0 || bht;

    return {
      kunci: `${teks(x.nomorPerkara)}#ST18`,
      nomorPerkara: teks(x.nomorPerkara),
      jenisPerkara: teks(x.jenisPerkara),
      jumlahUpayaHukum: upaya,
      berkekuatanHukumTetap: bht,
      memenuhi: terjawab,
      sebabTidakMemenuhi: terjawab
        ? ""
        : "tidak ada upaya hukum tercatat dan juga tidak ada tanggal berkekuatan hukum tetap - pertanyaannya belum dapat dijawab, dan menghitungnya sebagai putusan yang diterima akan menggelembungkan angka penerimaan putusan",
    };
  });
}

/**
 * ============================================================================
 * ST20 - RIWAYAT PERKARA ANTAR PASANGAN PIHAK
 * ============================================================================
 *
 * Pertanyaan yang dijawab butir ini bukan "berapa yang berperkara berulang"
 * melainkan "APAKAH pertanyaan itu dapat dijawab sama sekali".
 *
 * Menelusuri riwayat antar pasangan pihak menuntut pengenal yang tidak
 * berubah. Nama tidak memenuhinya - satu orang tercatat dengan beberapa ejaan,
 * dan dua orang berbeda dapat bernama sama. Yang memenuhinya nomor identitas.
 *
 * Diukur pada SIPP sungguhan: nomor identitas terisi 491 dari 493 baris pihak
 * pengaju, dan 14 nama muncul pada lebih dari satu perkara - tetapi tanpa
 * nomor identitas, keempat belas itu tidak dapat dipastikan orang yang sama.
 */
async function barisRiwayatPasangan(rentang) {
  if (!(await tabelSiap(["perkara", "perkara_pihak1", "perkara_pihak2", "pihak"]))) return [];

  const hasil = await runQuery(
    `SELECT p.nomor_perkara      AS nomorPerkara,
            p.jenis_perkara_nama AS jenisPerkara,
            MAX(CASE WHEN ${ruasTerisiSql("h1.nomor_indentitas")} THEN 1 ELSE 0 END) AS nikPengaju,
            MAX(CASE WHEN ${ruasTerisiSql("h2.nomor_indentitas")} THEN 1 ELSE 0 END) AS nikLawan,
            COUNT(DISTINCT h2.id)                                                     AS jumlahLawan
       FROM perkara p
       LEFT JOIN perkara_pihak1 pp1 ON pp1.perkara_id = p.perkara_id
       LEFT JOIN pihak h1 ON h1.id = pp1.pihak_id
       LEFT JOIN perkara_pihak2 pp2 ON pp2.perkara_id = p.perkara_id
       LEFT JOIN pihak h2 ON h2.id = pp2.pihak_id
      WHERE p.tanggal_pendaftaran >= ? AND p.tanggal_pendaftaran <= ?
      GROUP BY p.perkara_id, p.nomor_perkara, p.jenis_perkara_nama
      ORDER BY p.nomor_perkara
      LIMIT ${BATAS_BARIS}`,
    [rentang.mulai, rentang.selesai]
  );

  return hasil.map((x) => {
    const sebab = [];
    if (!angka(x.nikPengaju)) sebab.push("pihak pengajunya tanpa nomor identitas");
    if (angka(x.jumlahLawan) === 0) sebab.push("pihak lawannya tidak tercatat");
    else if (!angka(x.nikLawan)) sebab.push("pihak lawannya tanpa nomor identitas");

    return {
      kunci: `${teks(x.nomorPerkara)}#ST20`,
      nomorPerkara: teks(x.nomorPerkara),
      jenisPerkara: teks(x.jenisPerkara),
      memenuhi: sebab.length === 0,
      sebabTidakMemenuhi: sebab.length
        ? `${sebab.join("; ")} - riwayat antar pasangan hanya dapat ditelusuri lewat nomor identitas, sebab satu orang tercatat dengan beberapa ejaan nama dan dua orang berbeda dapat bernama sama`
        : "",
    };
  });
}

/**
 * ============================================================================
 * ST21 - PERKARA BERISIKO MELAMPAUI AMBANG
 * ============================================================================
 *
 * Menghitung SELURUH perkara pada rentang, yang sudah diputus maupun belum -
 * berbeda dari butir Bab 10 yang hanya melihat sisanya. Yang dijawab di sini
 * pertanyaan statistik: berapa bagian perkara satuan kerja ini yang selesai
 * di dalam asas lima bulan.
 *
 * Diukur pada SIPP sungguhan: lama penyelesaian 6 sampai 139 hari, rerata 23,
 * dan tidak satu pun putusan melampaui 150 hari.
 */
async function barisRisikoAmbang(rentang) {
  if (!(await tabelSiap(["perkara", "perkara_putusan"]))) return [];

  const hasil = await runQuery(
    `SELECT p.nomor_perkara       AS nomorPerkara,
            p.jenis_perkara_nama  AS jenisPerkara,
            p.tanggal_pendaftaran AS tanggalDaftar,
            d.tanggal_putusan     AS tanggalPutusan
       FROM perkara p
       LEFT JOIN perkara_putusan d
              ON d.perkara_id = p.perkara_id
             AND d.tanggal_putusan IS NOT NULL
             AND d.tanggal_putusan <> '0000-00-00'
      WHERE p.tanggal_pendaftaran >= ? AND p.tanggal_pendaftaran <= ?
      ORDER BY p.tanggal_pendaftaran
      LIMIT ${BATAS_BARIS}`,
    [rentang.mulai, rentang.selesai]
  );

  return hasil.map((x) => {
    const diputus = tanggalTerisi(x.tanggalPutusan);
    const lama = diputus
      ? selisihHari(x.tanggalDaftar, x.tanggalPutusan)
      : selisihHari(x.tanggalDaftar, rentang.selesai);
    const lewat = lama !== null && lama > HARI_ASAS_PENYELESAIAN;

    return {
      kunci: `${teks(x.nomorPerkara)}#ST21`,
      nomorPerkara: teks(x.nomorPerkara),
      jenisPerkara: teks(x.jenisPerkara),
      lamaHari: lama,
      sudahDiputus: diputus,
      memenuhi: !lewat,
      sebabTidakMemenuhi: lewat
        ? diputus
          ? `diputus setelah ${lama} hari, melampaui asas ${HARI_ASAS_PENYELESAIAN} hari`
          : `sudah ${lama} hari berjalan sampai akhir rentang dan belum diputus, melampaui asas ${HARI_ASAS_PENYELESAIAN} hari`
        : "",
    };
  });
}

/**
 * ============================================================================
 * ST22 - PERKARA MENYIMPANG DARI KEBIASAAN JENISNYA
 * ============================================================================
 *
 * Yang ditandai perkara yang lama penyelesaiannya jauh dari rerata jenisnya
 * sendiri - bukan dari rerata seluruh perkara. Cerai gugat verstek dan
 * kewarisan dengan dua belas ahli waris memang tidak sepantasnya dibandingkan.
 *
 * Menyimpang BUKAN berarti salah. Perkara yang pihaknya ghaib memang berjalan
 * tiga bulan lebih lama, dan itu justru benar. Yang dikatakan butir ini hanya
 * satu: berkas ini berbeda dari saudaranya, dan seseorang perlu tahu sebabnya.
 */
async function barisMenyimpangJenis(rentang) {
  if (!(await tabelSiap(["perkara", "perkara_putusan"]))) return [];

  const hasil = await runQuery(
    `SELECT p.nomor_perkara       AS nomorPerkara,
            p.jenis_perkara_nama  AS jenisPerkara,
            p.tanggal_pendaftaran AS tanggalDaftar,
            d.tanggal_putusan     AS tanggalPutusan
       FROM perkara p
       JOIN perkara_putusan d ON d.perkara_id = p.perkara_id
      WHERE p.tanggal_pendaftaran >= ? AND p.tanggal_pendaftaran <= ?
        AND d.tanggal_putusan IS NOT NULL AND d.tanggal_putusan <> '0000-00-00'
      ORDER BY p.tanggal_pendaftaran
      LIMIT ${BATAS_BARIS}`,
    [rentang.mulai, rentang.selesai]
  );

  const perJenis = new Map();
  hasil.forEach((x) => {
    const lama = selisihHari(x.tanggalDaftar, x.tanggalPutusan);
    if (lama === null || lama < 0) return;
    const j = teks(x.jenisPerkara) || "(tanpa jenis)";
    if (!perJenis.has(j)) perJenis.set(j, []);
    perJenis.get(j).push(lama);
  });

  const ringkas = new Map();
  perJenis.forEach((daftar, j) => {
    const n = daftar.length;
    const rerata = daftar.reduce((a, c) => a + c, 0) / n;
    const ragam = daftar.reduce((a, c) => a + (c - rerata) ** 2, 0) / n;
    ringkas.set(j, { n, rerata, simpangan: Math.sqrt(ragam) });
  });

  return hasil
    .filter((x) => {
      const r = ringkas.get(teks(x.jenisPerkara) || "(tanpa jenis)");
      return r && r.n >= MINIMAL_PUTUSAN_SEJENIS && r.simpangan > 0;
    })
    .map((x) => {
      const j = teks(x.jenisPerkara) || "(tanpa jenis)";
      const r = ringkas.get(j);
      const lama = selisihHari(x.tanggalDaftar, x.tanggalPutusan);
      const jarak = lama === null ? 0 : Math.abs(lama - r.rerata) / r.simpangan;
      const menyimpang = jarak > LEBAR_SIMPANGAN_JENIS;

      return {
        kunci: `${teks(x.nomorPerkara)}#ST22`,
        nomorPerkara: teks(x.nomorPerkara),
        jenisPerkara: j,
        lamaHari: lama,
        rerataJenis: Number(r.rerata.toFixed(1)),
        jarakSimpangan: Number(jarak.toFixed(2)),
        memenuhi: !menyimpang,
        sebabTidakMemenuhi: menyimpang
          ? `selesai dalam ${lama} hari sedangkan ${j} biasanya ${r.rerata.toFixed(
              0
            )} hari - berjarak ${jarak.toFixed(
              1
            )} simpangan baku. Menyimpang bukan berarti salah; yang dikatakan hanya bahwa berkas ini berbeda dari saudaranya.`
          : "",
      };
    });
}

/** Empat belas butir sisa Bab 9. */
const BUTIR = [
  {
    kode: "ST01",
    kunci: "keadaanPerkaraBulanan",
    judul: "Keadaan Perkara Bulanan",
    keterangan:
      "Diterima, diputus, dan sisanya per bulan. Sisa NEGATIF ditandai: memutus lebih banyak daripada yang pernah masuk itu mustahil, dan hampir selalu berarti tanggal putusan mendahului tanggal pendaftaran pada beberapa perkara. Sisa di sini dihitung atas perkara yang didaftarkan pada rentang, bukan atas seluruh tunggakan satuan kerja.",
    baris: barisKeadaanBulanan,
    pembilang: "Bulan yang penerimaan, penyelesaian, dan sisanya terhitung wajar",
    penyebut: "Seluruh bulan pada rentang ini yang memuat penerimaan perkara",
    tabel: "perkara disambung perkara_putusan, dikelompokkan menurut bulan pendaftaran",
    ruas: "tanggal_pendaftaran, tanggal_putusan",
  },
  {
    kode: "ST04",
    kunci: "faktorPenyebabPerceraian",
    judul: "Analisis Faktor Penyebab Perceraian",
    keterangan:
      "Katalog tidak meminta daftar faktornya saja - ia meminta faktor itu DISILANGKAN dengan usia perkawinan dan pendidikan. Persilangan hanya dapat disusun bila ketiganya ada pada perkara yang sama, dan daftar faktor yang tampak lengkap menyembunyikan kekurangan dua ruas lainnya sepenuhnya.",
    baris: barisFaktorPerceraian,
    pembilang: "Perkara yang punya faktor perceraian dari kategori baku, tanggal nikah, dan pendidikan pihak sekaligus",
    penyebut: "Seluruh perkara yang didaftarkan pada rentang ini dan menerbitkan akta cerai",
    tabel: "perkara disambung perkara_akta_cerai, faktor_perceraian, perkara_data_pernikahan, perkara_pihak1, dan pihak",
    ruas: "faktor_perceraian_id, tgl_nikah, pendidikan",
  },
  {
    kode: "ST08",
    kunci: "sebaranUsiaPerkawinan",
    judul: "Sebaran Usia Perkawinan",
    keterangan: `Lama perkawinan sebelum perkara diajukan, hanya atas perkara perceraian - permohonan dispensasi kawin dan itsbat nikah tidak punya usia perkawinan, dan menuntutnya berarti menyalahkan pengadilan atas sesuatu yang memang tidak ada. Usia negatif dan di atas ${USIA_KAWIN_MAKSIMAL} tahun ikut ditandai: satu salah ketik tahun menarik seluruh rerata sebaran.`,
    baris: barisUsiaPerkawinan,
    pembilang: "Perkara cerai yang usia perkawinannya terhitung dan masuk akal",
    penyebut: "Seluruh perkara perceraian yang didaftarkan pada rentang ini",
    tabel: "perkara disambung perkara_data_pernikahan lewat perkara_id",
    ruas: "tanggal_pendaftaran, tgl_nikah, jenis_perkara_nama",
  },
  {
    kode: "ST10",
    kunci: "trenPolaMusiman",
    judul: "Tren dan Pola Musiman Penerimaan Perkara",
    keterangan:
      "Pola musiman hanya dapat diurai bila tiap bulan punya pembanding pada bulan yang sama TAHUN SEBELUMNYA. Tanpa itu yang terhitung naik turun biasa - dan naik turun biasa yang disebut pola musiman akan dipakai orang memperkirakan bulan depan. Butir ini tidak menghasilkan proyeksi; yang dinilai apakah bahannya cukup untuk menguraikannya sama sekali.",
    baris: barisTrenMusiman,
    pembilang: "Bulan yang punya pembanding pada bulan yang sama tahun sebelumnya",
    penyebut: "Seluruh bulan pada rentang ini yang memuat penerimaan perkara",
    tabel: "perkara, dikelompokkan menurut bulan pendaftaran lalu disandingkan antar tahun",
    ruas: "tanggal_pendaftaran",
  },
  {
    kode: "ST11",
    kunci: "caraPendaftaranPerkara",
    judul: "Perkara Berdasarkan Cara Pendaftaran",
    keterangan:
      "SIPP tidak punya kolom cara pendaftaran - ketiganya diturunkan: e-Court dari baris e-filing, sidang keliling dari penanda pada jadwal sidangnya, manual dari bukan keduanya. Yang dinilai apakah penggolongan itu dapat dilakukan tanpa bertentangan: perkara bertanda sidang keliling yang seluruh sidangnya di ruang sidang bernomor akan masuk golongan mana pun yang kebetulan diperiksa lebih dulu.",
    baris: barisCaraPendaftaran,
    pembilang: "Perkara yang cara pendaftarannya dapat digolongkan tanpa bertentangan",
    penyebut: "Seluruh perkara yang didaftarkan pada rentang ini",
    tabel: "perkara disambung perkara_efiling_id dan perkara_jadwal_sidang lewat perkara_id",
    ruas: "efiling_id, sidang_keliling, ruangan",
  },
  {
    kode: "ST12",
    kunci: "tingkatPenggunaanEcourt",
    judul: "Tingkat Penggunaan e-Court",
    keterangan:
      "SATU-SATUNYA butir Bab 9 yang menilai CAPAIAN, bukan bahan. Angkanya proporsi perkara yang benar-benar didaftarkan secara elektronik; angka rendah berarti sedikit yang memakainya, BUKAN berarti datanya buruk. Yang memperbaikinya sosialisasi kepada advokat dan pencari keadilan, bukan pengisian kolom.",
    baris: barisTingkatEcourt,
    pembilang: "Perkara yang didaftarkan secara elektronik lewat e-Court",
    penyebut: "Seluruh perkara yang didaftarkan pada rentang ini",
    tabel: "perkara disambung perkara_efiling_id lewat perkara_id",
    ruas: "tanggal_pendaftaran, efiling_id",
  },
  {
    kode: "ST14",
    kunci: "perkaraDicabutGugur",
    judul: "Perkara Dicabut dan Gugur",
    keterangan:
      "Perkara yang berakhir tanpa putusan pokok tetap harus punya TANGGALNYA - laporan perkara dicabut disusun menurut bulan pencabutannya, bukan bulan putusannya. Butir ini akan merah seluruhnya pada satuan kerja yang kolomnya tidak pernah diisi, dan itu disengaja: berbeda dari butir yang tabelnya tidak ada, yang ini dapat diperbaiki.",
    baris: barisDicabutGugur,
    pembilang: "Perkara dicabut atau gugur yang punya tanggal pencabutan atau penggugurannya",
    penyebut: "Seluruh perkara pada rentang ini yang berstatus dicabut atau gugur",
    tabel: "perkara disambung perkara_putusan dan status_putusan lewat status_putusan_id",
    ruas: "status_putusan_id, tanggal_cabut, tanggal_gugur",
  },
  {
    kode: "ST15",
    kunci: "perkaraProdeoSelaras",
    judul: "Perkara Prodeo dan Pembebasan Biaya",
    keterangan:
      "Dua catatan yang harus sepakat: penanda prodeo pada perkara, dan panjar yang memang tidak terbayar. Perkara bertanda prodeo yang panjarnya terbayar penuh berarti salah satu catatannya keliru - dan keduanya dipakai menyusun laporan yang berbeda, sehingga kekeliruannya tidak pernah bertemu.",
    baris: barisPerkaraProdeo,
    pembilang: `Perkara prodeo yang panjar masuknya tidak melampaui Rp${BATAS_PANJAR_NOL.toLocaleString("id-ID")}`,
    penyebut: "Seluruh perkara bertanda prodeo yang didaftarkan pada rentang ini",
    tabel: "perkara disambung perkara_biaya lewat perkara_id, disaring prodeo = 1",
    ruas: "prodeo, jumlah, jenis_transaksi",
  },
  {
    kode: "ST16",
    kunci: "perkaraPanggilanGhaib",
    judul: "Perkara dengan Panggilan Ghaib",
    keterangan:
      "Pemanggilan ghaib dilakukan melalui media massa dan memakan tenggang tiga bulan sebelum sidang pertama. Perkara bertanda ghaib tanpa satu pun relaas berarti pemanggilannya tidak dapat dibuktikan pernah dilakukan - dan putusan verstek yang bersandar padanya menjadi rapuh.",
    baris: barisPanggilanGhaib,
    pembilang: "Perkara berpihak ghaib yang punya sekurangnya satu pelaksanaan relaas",
    penyebut: "Seluruh perkara pada rentang ini yang pihak lawannya ditandai ghaib",
    tabel: "perkara disambung perkara_pihak2 dan perkara_pelaksanaan_relaas lewat perkara_id",
    ruas: "ghaib, tanggal_relaas",
  },
  {
    kode: "ST17",
    kunci: "delegasiBantuanPanggilan",
    judul: "Perkara Delegasi Bantuan Panggilan",
    keterangan:
      "Berbeda dari butir beban kerja yang menilai kelengkapan SURATNYA, butir ini menilai apakah delegasi masuk benar-benar selesai dikerjakan: jurusitanya ditunjuk, relaasnya dilaksanakan, dan relaas itu dikirim kembali. Delegasi yang suratnya lengkap tetapi relaasnya tidak pernah kembali adalah perkara pengadilan LAIN yang tertahan di sini.",
    baris: barisDelegasiPanggilan,
    pembilang: "Delegasi masuk yang jurusitanya ditunjuk, relaasnya dilaksanakan, dan dikirim kembali",
    penyebut: "Seluruh delegasi masuk yang bertanggal pada rentang ini",
    tabel: "delegasi_masuk disambung delegasi_proses_masuk lewat delegasi_id",
    ruas: "tgl_delegasi, tgl_penunjukan_jurusita, tgl_relaas, tgl_pengiriman_relaas",
  },
  {
    kode: "ST18",
    kunci: "profilUpayaHukum",
    judul: "Profil Upaya Hukum",
    keterangan:
      "Berapa putusan yang diupayakan hukum. Yang tidak sederhana penyebutnya: putusan yang belum berkekuatan hukum tetap dan juga belum diupayakan hukum tidak dapat dijawab sama sekali, sebab tenggangnya mungkin masih berjalan. Menghitungnya sebagai putusan yang diterima akan menggelembungkan angka penerimaan putusan - dan angka itu dipakai menilai mutu putusan.",
    baris: barisProfilUpayaHukum,
    pembilang: "Putusan yang sudah dapat dijawab: ada upaya hukum tercatat, atau sudah berkekuatan hukum tetap",
    penyebut: "Seluruh putusan atas perkara yang didaftarkan pada rentang ini",
    tabel: "perkara disambung perkara_putusan, perkara_banding, perkara_kasasi, dan perkara_pk",
    ruas: "tanggal_putusan, tanggal_bht, perkara_id pada tabel upaya hukum",
  },
  {
    kode: "ST20",
    kunci: "riwayatPerkaraPasangan",
    judul: "Riwayat Perkara Antar Pasangan Pihak",
    keterangan:
      "Yang dijawab bukan berapa yang berperkara berulang melainkan APAKAH pertanyaan itu dapat dijawab sama sekali. Penelusuran riwayat menuntut pengenal yang tidak berubah; nama tidak memenuhinya, sebab satu orang tercatat dengan beberapa ejaan dan dua orang berbeda dapat bernama sama. Yang memenuhinya nomor identitas kedua belah pihak.",
    baris: barisRiwayatPasangan,
    pembilang: "Perkara yang kedua belah pihaknya punya nomor identitas",
    penyebut: "Seluruh perkara yang didaftarkan pada rentang ini",
    tabel: "perkara disambung perkara_pihak1, perkara_pihak2, dan pihak",
    ruas: "nomor_indentitas pada kedua sisi pihak",
  },
  {
    kode: "ST21",
    kunci: "risikoMelampauiAmbang",
    judul: "Perkara Berisiko Melampaui Ambang",
    keterangan: `Seluruh perkara pada rentang dihitung - yang sudah diputus maupun belum - berbeda dari butir Bab 10 yang hanya melihat sisanya. Yang dijawab pertanyaan statistik: berapa bagian perkara satuan kerja ini yang selesai di dalam asas ${HARI_ASAS_PENYELESAIAN} hari.`,
    baris: barisRisikoAmbang,
    pembilang: `Perkara yang selesai atau masih berjalan di bawah ${HARI_ASAS_PENYELESAIAN} hari`,
    penyebut: "Seluruh perkara yang didaftarkan pada rentang ini",
    tabel: "perkara disambung perkara_putusan lewat perkara_id",
    ruas: "tanggal_pendaftaran, tanggal_putusan",
  },
  {
    kode: "ST22",
    kunci: "menyimpangKebiasaanJenis",
    judul: "Perkara Menyimpang dari Kebiasaan Jenisnya",
    keterangan: `Perkara yang lama penyelesaiannya berjarak lebih dari ${LEBAR_SIMPANGAN_JENIS} simpangan baku dari rerata JENISNYA SENDIRI - bukan dari rerata seluruh perkara. Menyimpang BUKAN berarti salah: perkara yang pihaknya ghaib memang berjalan tiga bulan lebih lama, dan itu justru benar. Yang dikatakan hanya bahwa berkas ini berbeda dari saudaranya, dan seseorang perlu tahu sebabnya.`,
    baris: barisMenyimpangJenis,
    pembilang: `Putusan yang lama penyelesaiannya berjarak tidak lebih dari ${LEBAR_SIMPANGAN_JENIS} simpangan baku dari rerata jenisnya`,
    penyebut: `Putusan atas jenis perkara yang punya sekurangnya ${MINIMAL_PUTUSAN_SEJENIS} putusan pada rentang ini`,
    tabel: "perkara disambung perkara_putusan, dikelompokkan menurut jenis perkara",
    ruas: "tanggal_pendaftaran, tanggal_putusan, jenis_perkara_nama",
  },
];

let sudahDidaftar = false;

function daftarkanSemua() {
  if (sudahDidaftar) return BUTIR.map((b) => b.kunci);

  BUTIR.forEach((b) => {
    if (kerangka.ambil(b.kunci)) return;
    kerangka.daftarkan({
      kunci: b.kunci,
      judul: b.judul,
      keterangan: b.keterangan,
      lantai: "bulanan",
      versiRumus: "statistik-v1",
      ambangDipakai: [],
      caraHitung: {
        pembilang: b.pembilang,
        penyebut: b.penyebut,
        dikecualikan:
          "Perkara permohonan dikeluarkan dari butir usia perkawinan - ia memang tidak punya usia perkawinan. Jenis perkara yang putusannya terlalu sedikit dikeluarkan dari butir penyimpangan: pada lima perkara, tiap lama penyelesaian tampak khas. Butir yang tabelnya tidak ada pada SIPP satuan kerja ini tidak menghasilkan baris sama sekali - ia tidak dinilai nol.",
        tabelSumber: b.tabel,
        ruasSumber: b.ruas,
      },
      baris: b.baris,
    });
  });

  sudahDidaftar = true;
  return BUTIR.map((b) => b.kunci);
}

function lupakanSemua() {
  sudahDidaftar = false;
}

function sambungan() {
  const peta = {};
  BUTIR.forEach((b) => {
    peta[b.kode] = b.kunci;
  });
  return peta;
}

module.exports = {
  BATAS_PANJAR_NOL,
  BUTIR,
  HARI_ASAS_PENYELESAIAN,
  LEBAR_SIMPANGAN_JENIS,
  MINIMAL_PUTUSAN_SEJENIS,
  USIA_KAWIN_MAKSIMAL,
  barisCaraPendaftaran,
  barisDelegasiPanggilan,
  barisDicabutGugur,
  barisFaktorPerceraian,
  barisKeadaanBulanan,
  barisMenyimpangJenis,
  barisPanggilanGhaib,
  barisPerkaraProdeo,
  barisProfilUpayaHukum,
  barisRisikoAmbang,
  barisRiwayatPasangan,
  barisTingkatEcourt,
  barisTrenMusiman,
  barisUsiaPerkawinan,
  bulanDari,
  daftarkanSemua,
  lupakanSemua,
  sambungan,
};
