"use strict";

/**
 * ============================================================================
 * PELAYANAN KEPADA PENCARI KEADILAN - BAB 11 KATALOG
 * ============================================================================
 *
 * Tujuh dari dua belas butir. Lima sisanya tidak punya sumber, dan itu
 * diperiksa pada basis datanya - bukan disimpulkan dari kesan:
 *
 *   LY03 waktu tunggu di meja PTSP. Tabel antrian pada SIPP adalah antrian
 *        RUANG SIDANG (nomor antrian per jadwal sidang, 34 baris seluruhnya),
 *        bukan antrian meja pelayanan. Memakainya berarti menjawab pertanyaan
 *        yang sama sekali lain dengan angka yang terbaca meyakinkan.
 *
 *   LY04 layanan informasi. Tidak ada satu pun tabel permohonan informasi.
 *
 *   LY05 penanganan pengaduan. Tidak ada satu pun tabel pengaduan.
 *
 *   LY10 survei kepuasan masyarakat. Katalog sendiri sudah menyebutnya diisi
 *        manual dari hasil survei.
 *
 *   LY12 pemberitahuan lewat pesan elektronik. Tabel perkara_pemberitahuan ADA
 *        tetapi KOSONG SELURUHNYA - nol baris, bukan nol pada rentang tertentu.
 *        Menyambungkannya menghasilkan penilaian tanpa penyebut.
 *
 * ============================================================================
 * PELAYANAN DIUKUR DARI SISI PIHAK, BUKAN DARI SISI KANTOR
 * ============================================================================
 *
 * Ini yang membedakan Bab 11 dari Bab 6 dan Bab 10, dan mudah sekali hilang
 * ketika butir baru ditambahkan.
 *
 * "Perkara selesai dalam 23 hari" adalah angka kantor. Yang dirasakan pihak
 * lain: berapa kali ia harus datang, berapa lama ia menunggu aktanya sesudah
 * putusan diucapkan, dan apakah ia harus menempuh perjalanan ke ibu kota
 * kabupaten atau sidangnya datang ke desanya. Angka kantor dapat bagus
 * sementara ketiganya buruk.
 *
 * ============================================================================
 * YANG DITEMUKAN SAAT MENGUKUR
 * ============================================================================
 *
 * Salinan putusan: TIDAK SATU PUN dari 388 putusan mencatat tanggal penerbitan
 * salinan, tanggal pengiriman, maupun tanggal pihak menerimanya. Kolomnya ada
 * pada SIPP dan tidak pernah diisi. Karena itu LY07 akan merah sampai
 * pengisiannya dimulai - dan itulah yang ingin ditunjukkannya. Ini berbeda
 * dari butir yang tabelnya tidak ada: yang ini DAPAT diperbaiki.
 *
 * Akta cerai: 218 terbit, 218 diserahkan kepada pihak pertama, hanya 43 kepada
 * pihak kedua. Rerata dua hari dari berkekuatan hukum tetap sampai akta
 * terbit, dan sebelas hari dari terbit sampai diambil.
 *
 * Sidang di luar gedung: 97 persidangan pada sebelas tempat yang tersebut
 * namanya - balai kelurahan, kantor KUA, kantor desa - dan 32 lagi yang tidak
 * dapat diletakkan pada wilayah mana pun.
 */

const db = require("../db_config");
const kerangka = require("./kerangkaPenilaianService");
const sippSkemaService = require("./sippSkemaService");

const BATAS_BARIS = 5000;

/**
 * Ruang sidang di dalam gedung. Persidangan di luar ini adalah sidang di luar
 * gedung, apakah petugasnya menandainya sidang keliling atau tidak - diukur
 * pada SIPP sungguhan, dari 97 persidangan di luar ruang sidang hanya 7 yang
 * bertanda.
 */
const POLA_RUANG_DALAM = "^[[:space:]]*Ruang[[:space:]]+Sidang[[:space:]]*[0-9]+[[:space:]]*$";

/**
 * Berapa kali pihak masih pantas diminta datang. Tiap kehadiran adalah satu
 * hari kerja yang hilang, ditambah ongkos perjalanan yang tidak pernah
 * tercatat pada berkas mana pun.
 *
 * Diukur pada SIPP sungguhan: 431 perkara, terbanyak delapan kali kehadiran,
 * dan 213 perkara cukup dua kali.
 */
const AMBANG_KEHADIRAN_PIHAK = 6;

/**
 * Berapa hari akta cerai yang sudah terbit masih wajar menunggu diambil.
 * Diukur pada SIPP sungguhan: rerata sebelas hari dari terbit sampai diambil.
 */
const HARI_WAJAR_AMBIL_AKTA = 30;

/**
 * Berapa hari sesudah berkekuatan hukum tetap akta cerai semestinya terbit.
 * Diukur pada SIPP sungguhan: rerata dua hari, tetapi 32 dari 218 akta terbit
 * lebih dari seminggu sesudahnya.
 */
const HARI_WAJAR_TERBIT_AKTA = 7;

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

function selisihHari(awal, akhir) {
  if (!tanggalTerisi(awal) || !tanggalTerisi(akhir)) return null;
  const a = new Date(awal);
  const b = new Date(akhir);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return null;
  return Math.round((b - a) / 86400000);
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
 * LY01 - LAMA LAYANAN YANG DIRASAKAN PARA PIHAK
 * ============================================================================
 *
 * Yang dinilai bukan lamanya, melainkan apakah lamanya DAPAT DIKETAHUI. Pihak
 * yang bertanya "sampai di mana perkara saya" harus dapat dijawab dari tonggak
 * yang tercatat; tonggak yang kosong berarti pertanyaan itu hanya dapat
 * dijawab dengan membuka berkas fisiknya.
 *
 * Tiap tonggak dinilai HANYA bila ia sudah semestinya dilalui. Perkara yang
 * belum diputus tidak dituntut punya tanggal putusan - menghitungnya gagal
 * berarti menghukum pengadilan karena waktu belum berjalan.
 */
async function barisLamaLayanan(rentang) {
  if (!(await tabelSiap(["perkara", "perkara_putusan", "perkara_jadwal_sidang"]))) return [];

  const adaAkta = await sippSkemaService.tabelAda("perkara_akta_cerai").catch(() => false);

  const hasil = await runQuery(
    `SELECT p.nomor_perkara       AS nomorPerkara,
            p.jenis_perkara_nama  AS jenisPerkara,
            p.tanggal_pendaftaran AS tanggalDaftar,
            (SELECT MIN(j.tanggal_sidang) FROM perkara_jadwal_sidang j
              WHERE j.perkara_id = p.perkara_id)   AS sidangPertama,
            d.tanggal_putusan     AS tanggalPutusan,
            d.tanggal_bht         AS tanggalBht
            ${
              adaAkta
                ? `, (SELECT MIN(a.tgl_akta_cerai) FROM perkara_akta_cerai a
                        WHERE a.perkara_id = p.perkara_id)              AS aktaTerbit,
                   (SELECT MIN(a.tgl_penyerahan_akta_cerai) FROM perkara_akta_cerai a
                        WHERE a.perkara_id = p.perkara_id)              AS aktaDiserahkan`
                : ""
            }
       FROM perkara p
       LEFT JOIN perkara_putusan d ON d.perkara_id = p.perkara_id
      WHERE p.tanggal_pendaftaran >= ? AND p.tanggal_pendaftaran <= ?
      ORDER BY p.tanggal_pendaftaran
      LIMIT ${BATAS_BARIS}`,
    [rentang.mulai, rentang.selesai]
  );

  return hasil.map((x) => {
    const sebab = [];

    if (!tanggalTerisi(x.sidangPertama)) sebab.push("belum punya tanggal sidang pertama");

    // Akta cerai hanya dituntut pada perkara CERAI yang sudah berkekuatan
    // hukum tetap. Perkara permohonan tidak menerbitkan akta cerai, dan
    // menuntutnya berarti menyalahkan pengadilan atas sesuatu yang memang
    // tidak ada.
    const perkaraCerai = /cerai/i.test(teks(x.jenisPerkara));
    if (adaAkta && perkaraCerai && tanggalTerisi(x.tanggalBht)) {
      if (!tanggalTerisi(x.aktaTerbit)) {
        sebab.push(
          "sudah berkekuatan hukum tetap tetapi akta cerainya belum terbit - inilah tonggak yang paling ditunggu pihak"
        );
      } else {
        const jarakTerbit = selisihHari(x.tanggalBht, x.aktaTerbit);
        if (jarakTerbit !== null && jarakTerbit > HARI_WAJAR_TERBIT_AKTA) {
          sebab.push(
            `akta cerai baru terbit ${jarakTerbit} hari sesudah berkekuatan hukum tetap, melampaui ${HARI_WAJAR_TERBIT_AKTA} hari`
          );
        }
        if (!tanggalTerisi(x.aktaDiserahkan)) {
          sebab.push("akta cerai sudah terbit tetapi tanggal penyerahannya belum tercatat");
        }
      }
    }

    const lama = selisihHari(
      x.tanggalDaftar,
      tanggalTerisi(x.aktaDiserahkan)
        ? x.aktaDiserahkan
        : tanggalTerisi(x.tanggalPutusan)
        ? x.tanggalPutusan
        : x.sidangPertama
    );

    return {
      kunci: `${teks(x.nomorPerkara)}#LY01`,
      nomorPerkara: teks(x.nomorPerkara),
      jenisPerkara: teks(x.jenisPerkara),
      lamaHariSampaiTonggakTerakhir: lama,
      memenuhi: sebab.length === 0,
      sebabTidakMemenuhi: sebab.join("; "),
    };
  });
}

/**
 * ============================================================================
 * LY02 - JUMLAH KEHADIRAN YANG DIBEBANKAN KEPADA PIHAK
 * ============================================================================
 *
 * Tiap kehadiran adalah satu hari kerja yang hilang bagi pihak, ditambah
 * ongkos perjalanan yang tidak pernah tercatat pada berkas mana pun. Pada
 * satuan kerja yang wilayahnya luas, ongkos itu kerap melampaui panjar
 * perkaranya sendiri.
 *
 * Perkara yang TIDAK SATU PUN sidangnya mencatat kehadiran juga tidak
 * memenuhi - bukan karena pihaknya tidak datang, melainkan karena beban yang
 * ditanggungnya tidak dapat diketahui siapa pun.
 *
 * Diukur pada SIPP sungguhan: 213 perkara cukup dua kali kehadiran, tiga
 * perkara sampai tujuh dan delapan kali, dan 30 perkara tidak mencatatnya.
 */
async function barisKehadiranDibebankan(rentang) {
  if (!(await tabelSiap(["perkara", "perkara_jadwal_sidang"]))) return [];

  const hasil = await runQuery(
    `SELECT p.nomor_perkara      AS nomorPerkara,
            p.jenis_perkara_nama AS jenisPerkara,
            COUNT(j.id)                              AS jumlahSidang,
            SUM(j.dihadiri_oleh IS NOT NULL)         AS jumlahHadir
       FROM perkara p
       JOIN perkara_jadwal_sidang j ON j.perkara_id = p.perkara_id
      WHERE p.tanggal_pendaftaran >= ? AND p.tanggal_pendaftaran <= ?
      GROUP BY p.perkara_id, p.nomor_perkara, p.jenis_perkara_nama
      ORDER BY p.nomor_perkara
      LIMIT ${BATAS_BARIS}`,
    [rentang.mulai, rentang.selesai]
  );

  return hasil.map((x) => {
    const hadir = angka(x.jumlahHadir);
    const sidang = angka(x.jumlahSidang);
    const sebab = [];

    if (hadir === 0) {
      sebab.push(
        `${sidang} kali sidang tetapi tidak satu pun mencatat kehadiran - beban yang ditanggung pihak tidak dapat diketahui`
      );
    } else if (hadir > AMBANG_KEHADIRAN_PIHAK) {
      sebab.push(
        `pihak diminta hadir ${hadir} kali, melampaui ambang ${AMBANG_KEHADIRAN_PIHAK} - tiap kehadiran satu hari kerja yang hilang beserta ongkos perjalanan yang tidak tercatat di berkas mana pun`
      );
    }

    return {
      kunci: `${teks(x.nomorPerkara)}#LY02`,
      nomorPerkara: teks(x.nomorPerkara),
      jenisPerkara: teks(x.jenisPerkara),
      jumlahKehadiran: hadir,
      jumlahSidang: sidang,
      memenuhi: sebab.length === 0,
      sebabTidakMemenuhi: sebab.join("; "),
    };
  });
}

/**
 * ============================================================================
 * LY06 - AKTA CERAI TERBIT BELUM DIAMBIL
 * ============================================================================
 *
 * Satu baris satu pihak, bukan satu perkara. Pada perkara cerai KEDUA pihak
 * berhak atas akta cerainya masing-masing, dan menghitung per perkara akan
 * menyembunyikan separuh persoalannya.
 *
 * Diukur pada SIPP sungguhan: 218 akta terbit, 218 diserahkan kepada pihak
 * pertama, hanya 43 kepada pihak kedua. Seratus tujuh puluh lima akta pihak
 * kedua belum tercatat diserahkan - dan tiap satunya adalah orang yang belum
 * dapat menikah lagi secara sah.
 */
async function barisAktaBelumDiambil(rentang) {
  if (!(await tabelSiap(["perkara", "perkara_akta_cerai"]))) return [];

  const hasil = await runQuery(
    `SELECT p.nomor_perkara       AS nomorPerkara,
            p.jenis_perkara_nama  AS jenisPerkara,
            a.tgl_akta_cerai      AS aktaTerbit,
            a.tgl_penyerahan_akta_cerai        AS serah1,
            a.tgl_penyerahan_akta_cerai_pihak2 AS serah2,
            d.tanggal_bht         AS tanggalBht
       FROM perkara p
       JOIN perkara_akta_cerai a ON a.perkara_id = p.perkara_id
       LEFT JOIN perkara_putusan d ON d.perkara_id = p.perkara_id
      WHERE p.tanggal_pendaftaran >= ? AND p.tanggal_pendaftaran <= ?
        AND a.tgl_akta_cerai IS NOT NULL
        AND a.tgl_akta_cerai <> '0000-00-00'
      ORDER BY a.tgl_akta_cerai
      LIMIT ${BATAS_BARIS}`,
    [rentang.mulai, rentang.selesai]
  );

  const baris = [];
  hasil.forEach((x) => {
    [
      { urut: 1, sebutan: "pihak pertama", tanggal: x.serah1 },
      { urut: 2, sebutan: "pihak kedua", tanggal: x.serah2 },
    ].forEach((sisi) => {
      const diambil = tanggalTerisi(sisi.tanggal);
      const menunggu = diambil ? selisihHari(x.aktaTerbit, sisi.tanggal) : selisihHari(x.aktaTerbit, rentang.selesai);
      const sebab = [];

      if (!diambil) {
        sebab.push(
          `akta terbit tetapi belum tercatat diserahkan kepada ${sisi.sebutan}${
            menunggu === null ? "" : ` - sudah ${menunggu} hari`
          }; selama akta belum di tangannya, ia belum dapat menikah lagi secara sah`
        );
      } else if (menunggu !== null && menunggu > HARI_WAJAR_AMBIL_AKTA) {
        sebab.push(
          `akta baru diserahkan kepada ${sisi.sebutan} sesudah ${menunggu} hari, melampaui ${HARI_WAJAR_AMBIL_AKTA} hari`
        );
      }

      baris.push({
        kunci: `${teks(x.nomorPerkara)}#LY06#${sisi.urut}`,
        nomorPerkara: teks(x.nomorPerkara),
        jenisPerkara: teks(x.jenisPerkara),
        pihak: sisi.sebutan,
        hariMenunggu: menunggu,
        memenuhi: sebab.length === 0,
        sebabTidakMemenuhi: sebab.join("; "),
      });
    });
  });

  return baris;
}

/**
 * ============================================================================
 * LY07 - SALINAN PUTUSAN BELUM DIAMBIL
 * ============================================================================
 *
 * Butir ini akan MERAH SELURUHNYA pada satuan kerja yang diukur, dan itu
 * disengaja. Diperiksa pada 388 putusan satu tahun: tidak satu pun mencatat
 * tanggal penerbitan salinan, tanggal pengiriman, maupun tanggal pihak
 * menerimanya. Kolomnya ada pada SIPP dan tidak pernah diisi.
 *
 * Angka nol yang tidak dapat diperbaiki memang harus dihindari - itu sebabnya
 * butir yang TABELNYA tidak ada tidak dinilai sama sekali. Yang ini berbeda:
 * ia dapat diperbaiki, dan cara memperbaikinya mengisi kolomnya.
 *
 * Populasinya dibatasi putusan yang sudah berkekuatan hukum tetap. Sebelum
 * itu, salinan memang belum boleh dikeluarkan kepada pihak.
 */
async function barisSalinanBelumDiambil(rentang) {
  if (!(await tabelSiap(["perkara", "perkara_putusan"]))) return [];

  const hasil = await runQuery(
    `SELECT p.nomor_perkara       AS nomorPerkara,
            p.jenis_perkara_nama  AS jenisPerkara,
            d.tanggal_bht         AS tanggalBht,
            d.penerbitan_salinan_putusan   AS salinanTerbit,
            d.kirim_salinan_putusan_pihak1 AS kirim1,
            d.kirim_salinan_putusan_pihak2 AS kirim2
       FROM perkara p
       JOIN perkara_putusan d ON d.perkara_id = p.perkara_id
      WHERE p.tanggal_pendaftaran >= ? AND p.tanggal_pendaftaran <= ?
        AND d.tanggal_bht IS NOT NULL
        AND d.tanggal_bht <> '0000-00-00'
      ORDER BY d.tanggal_bht
      LIMIT ${BATAS_BARIS}`,
    [rentang.mulai, rentang.selesai]
  );

  return hasil.map((x) => {
    const terbit = tanggalTerisi(x.salinanTerbit);
    const sampai = tanggalTerisi(x.kirim1) || tanggalTerisi(x.kirim2);
    const sebab = [];

    if (!terbit) sebab.push("sudah berkekuatan hukum tetap tetapi penerbitan salinannya belum tercatat");
    else if (!sampai) sebab.push("salinan sudah terbit tetapi belum tercatat sampai kepada satu pun pihak");

    return {
      kunci: `${teks(x.nomorPerkara)}#LY07`,
      nomorPerkara: teks(x.nomorPerkara),
      jenisPerkara: teks(x.jenisPerkara),
      memenuhi: sebab.length === 0,
      sebabTidakMemenuhi: sebab.join("; "),
    };
  });
}

/**
 * ============================================================================
 * LY08 - SIDANG DI LUAR GEDUNG MENURUT WILAYAH
 * ============================================================================
 *
 * Sidang di luar gedung ada supaya pihak yang tinggal jauh tidak perlu
 * menempuh perjalanan ke ibu kota kabupaten. Laporannya disusun MENURUT
 * WILAYAH - dan wilayah itu hanya dapat diketahui dari nama tempatnya.
 *
 * Persidangan yang bertanda sidang keliling tetapi tempatnya tidak tersebut
 * tidak dapat diletakkan pada wilayah mana pun, sehingga ia hilang dari
 * laporan meskipun benar-benar dilaksanakan.
 *
 * Diukur pada SIPP sungguhan: 129 persidangan masuk populasi ini, 97 di
 * antaranya menyebut tempatnya - balai kelurahan, kantor KUA, kantor desa,
 * kantor kecamatan, sebelas tempat seluruhnya. Tiga puluh dua sisanya tidak.
 */
async function barisSidangLuarGedung(rentang) {
  if (!(await tabelSiap(["perkara", "perkara_jadwal_sidang"]))) return [];

  const hasil = await runQuery(
    `SELECT j.id                 AS sidangId,
            p.nomor_perkara      AS nomorPerkara,
            p.jenis_perkara_nama AS jenisPerkara,
            j.tanggal_sidang     AS tanggalSidang,
            j.ruangan            AS ruangan,
            j.sidang_keliling    AS bertanda
       FROM perkara p
       JOIN perkara_jadwal_sidang j ON j.perkara_id = p.perkara_id
      WHERE p.tanggal_pendaftaran >= ? AND p.tanggal_pendaftaran <= ?
        AND (
          (j.ruangan IS NOT NULL AND TRIM(j.ruangan) <> '' AND j.ruangan NOT REGEXP ?)
          OR (j.sidang_keliling IS NOT NULL AND j.sidang_keliling NOT IN ('', '0', 'T'))
        )
      ORDER BY j.tanggal_sidang
      LIMIT ${BATAS_BARIS}`,
    [rentang.mulai, rentang.selesai, POLA_RUANG_DALAM]
  );

  return hasil.map((x) => {
    const tempat = teks(x.ruangan);
    const diDalam = new RegExp("^\\s*Ruang\\s+Sidang\\s*[0-9]+\\s*$", "i").test(tempat);
    const dapatDiletakkan = Boolean(tempat) && !diDalam;

    return {
      kunci: `luar-${teks(x.sidangId)}`,
      nomorPerkara: teks(x.nomorPerkara),
      jenisPerkara: teks(x.jenisPerkara),
      tempat,
      memenuhi: dapatDiletakkan,
      sebabTidakMemenuhi: dapatDiletakkan
        ? ""
        : tempat
        ? `bertanda sidang keliling tetapi tempatnya tercatat "${tempat}" - tidak dapat diletakkan pada wilayah mana pun`
        : "bertanda sidang keliling tetapi tempatnya tidak tersebut - persidangannya benar-benar dilaksanakan tetapi hilang dari laporan menurut wilayah",
    };
  });
}

/**
 * ============================================================================
 * LY09 - LAYANAN POS BANTUAN HUKUM
 * ============================================================================
 *
 * SIPP tidak punya tabel Posbakum. Yang dipakai di sini aturan yang berlaku
 * pada satuan kerjanya: perkara yang didaftarkan TANPA kuasa hukum melewati
 * Pos Bantuan Hukum - di sanalah gugatannya disusun.
 *
 * Karena itu yang dinilai HASIL layanan Posbakum, bukan jumlah layanannya:
 * gugatan yang disusun di sana harus memuat posita, petitum, dan alamat
 * lengkap pihak pengajunya. Gugatan tanpa kecamatan tidak dapat dipanggil
 * jurusitanya, dan pihak yang sudah dibantu menyusun gugatan tetapi tidak
 * dapat dipanggil kembali ke titik awal.
 *
 * BATASNYA HARUS IKUT TERBACA. Perkara tanpa kuasa TIDAK SELALU pengguna
 * Posbakum - ada yang menyusun sendiri gugatannya. Angka ini batas atas, dan
 * ia disebut demikian pada katalog.
 *
 * Diukur pada SIPP sungguhan: 409 dari 431 perkara didaftarkan tanpa kuasa,
 * dan dari 493 baris pihak pengaju seluruhnya beralamat tetapi 55 tanpa
 * kecamatan.
 */
async function barisLayananPosbakum(rentang) {
  if (!(await tabelSiap(["perkara", "perkara_pihak1", "pihak"]))) return [];

  const adaPengacara = await sippSkemaService.tabelAda("perkara_pengacara").catch(() => false);

  const hasil = await runQuery(
    `SELECT p.nomor_perkara       AS nomorPerkara,
            p.jenis_perkara_nama  AS jenisPerkara,
            p.posita              AS posita,
            p.petitum             AS petitum,
            MAX(TRIM(COALESCE(h.alamat, '')) <> '')    AS adaAlamat,
            MAX(TRIM(COALESCE(h.kecamatan, '')) <> '') AS adaKecamatan
       FROM perkara p
       JOIN perkara_pihak1 pp ON pp.perkara_id = p.perkara_id
       JOIN pihak h ON h.id = pp.pihak_id
       ${adaPengacara ? "LEFT JOIN perkara_pengacara g ON g.perkara_id = p.perkara_id" : ""}
      WHERE p.tanggal_pendaftaran >= ? AND p.tanggal_pendaftaran <= ?
        ${adaPengacara ? "AND g.perkara_id IS NULL" : ""}
      GROUP BY p.perkara_id, p.nomor_perkara, p.jenis_perkara_nama, p.posita, p.petitum
      ORDER BY p.nomor_perkara
      LIMIT ${BATAS_BARIS}`,
    [rentang.mulai, rentang.selesai]
  );

  return hasil.map((x) => {
    const sebab = [];
    if (!teks(x.posita)) sebab.push("gugatannya tanpa posita");
    if (!teks(x.petitum)) sebab.push("gugatannya tanpa petitum");
    if (!angka(x.adaAlamat)) sebab.push("pihak pengajunya tanpa alamat");
    if (!angka(x.adaKecamatan)) {
      sebab.push("pihak pengajunya tanpa kecamatan - jurusita tidak dapat memanggilnya");
    }

    return {
      kunci: `${teks(x.nomorPerkara)}#LY09`,
      nomorPerkara: teks(x.nomorPerkara),
      jenisPerkara: teks(x.jenisPerkara),
      memenuhi: sebab.length === 0,
      sebabTidakMemenuhi: sebab.join("; "),
    };
  });
}

/**
 * ============================================================================
 * LY11 - PAPAN NILAI PELAYANAN PUBLIK
 * ============================================================================
 *
 * Satu baris satu ANGKA yang boleh dipublikasikan, bukan satu perkara. Yang
 * dijawab butir ini: berapa bagian papan nilai pelayanan publik yang benar-
 * benar dapat diisi dari data, dan bagian mana yang selama ini diisi tangan.
 *
 * Angka yang diisi tangan bukan angka yang salah - ia angka yang tidak dapat
 * diperiksa. Papan nilai yang separuhnya diisi tangan tetap terbaca lengkap,
 * dan tidak ada yang dapat membedakan bagian mana yang terhitung dan bagian
 * mana yang diketik.
 *
 * Diukur pada SIPP sungguhan: dari sepuluh angka, tujuh terhitung dari SIPP.
 * Tiga yang tidak - pengaduan masyarakat, survei kepuasan, dan salinan putusan
 * yang diterbitkan - masing-masing sebabnya berbeda dan disebutkan pada
 * barisnya.
 */
/**
 * ============================================================================
 * PAPAN NILAI MENGHITUNG PERISTIWA PADA RENTANG, BUKAN PERKARA PADA RENTANG
 * ============================================================================
 *
 * Seluruh butir lain di aplikasi ini berpopulasi "perkara yang DIDAFTARKAN
 * pada rentang ini". Papan nilai pelayanan publik tidak, dan bedanya
 * disengaja.
 *
 * Papan nilai menjawab pertanyaan masyarakat: berapa akta cerai yang
 * DITERBITKAN bulan ini, berapa sidang yang DILAKSANAKAN bulan ini. Akta yang
 * terbit Maret atas perkara yang didaftarkan Januari adalah pelayanan bulan
 * Maret - dan menghitungnya ke Januari membuat papan bulan berjalan selalu
 * tampak kosong pada minggu pertama.
 *
 * Bonusnya menyusul dengan sendirinya: tiap angka dihitung dari satu tabel
 * atas kolom tanggalnya sendiri, tanpa menggabung tabel perkara yang berisi
 * ribuan baris. Susunan sebelumnya menggabung keduanya dan satu angkanya
 * kehabisan waktu - papan nilai yang angkanya berubah-ubah menurut kesibukan
 * basis data lebih buruk daripada papan yang kosong.
 */
const ANGKA_PAPAN_NILAI = [
  {
    kunci: "perkaraDiterima",
    judul: "Perkara diterima",
    sql: `SELECT COUNT(*) AS n FROM perkara p
           WHERE p.tanggal_pendaftaran >= ? AND p.tanggal_pendaftaran <= ?`,
    tabel: ["perkara"],
  },
  {
    kunci: "perkaraDiputus",
    judul: "Perkara diputus",
    sql: `SELECT COUNT(*) AS n FROM perkara_putusan d
           WHERE d.tanggal_putusan >= ? AND d.tanggal_putusan <= ?`,
    tabel: ["perkara_putusan"],
  },
  {
    kunci: "aktaCeraiTerbit",
    judul: "Akta cerai diterbitkan",
    sql: `SELECT COUNT(*) AS n FROM perkara_akta_cerai a
           WHERE a.tgl_akta_cerai >= ? AND a.tgl_akta_cerai <= ?`,
    tabel: ["perkara_akta_cerai"],
  },
  {
    kunci: "aktaCeraiDiserahkan",
    judul: "Akta cerai diserahkan kepada pihak",
    sql: `SELECT COUNT(*) AS n FROM perkara_akta_cerai a
           WHERE a.tgl_penyerahan_akta_cerai >= ? AND a.tgl_penyerahan_akta_cerai <= ?`,
    tabel: ["perkara_akta_cerai"],
  },
  {
    kunci: "sidangLuarGedung",
    judul: "Persidangan di luar gedung",
    sql: `SELECT COUNT(*) AS n FROM perkara_jadwal_sidang j
           WHERE j.tanggal_sidang >= ? AND j.tanggal_sidang <= ?
             AND j.ruangan IS NOT NULL AND TRIM(j.ruangan) <> ''
             AND j.ruangan NOT REGEXP '${POLA_RUANG_DALAM}'`,
    tabel: ["perkara_jadwal_sidang"],
  },
  {
    kunci: "perkaraElektronik",
    judul: "Perkara didaftarkan secara elektronik",
    // Satu-satunya yang masih harus menggabung tabel perkara: tabel
    // perkara_efiling_id hanya memuat dua kolom penghubung, tanpa tanggal.
    sql: `SELECT COUNT(DISTINCT p.perkara_id) AS n FROM perkara p
            JOIN perkara_efiling_id e ON e.perkara_id = p.perkara_id
           WHERE p.tanggal_pendaftaran >= ? AND p.tanggal_pendaftaran <= ?`,
    tabel: ["perkara", "perkara_efiling_id"],
  },
  {
    kunci: "mediasiDilaksanakan",
    judul: "Mediasi dilaksanakan",
    sql: `SELECT COUNT(*) AS n FROM perkara_mediasi m
           WHERE m.dimulai_mediasi >= ? AND m.dimulai_mediasi <= ?`,
    tabel: ["perkara_mediasi"],
  },
  {
    kunci: "salinanPutusanTerbit",
    judul: "Salinan putusan diterbitkan",
    sql: `SELECT COUNT(*) AS n FROM perkara_putusan d
           WHERE d.penerbitan_salinan_putusan >= ? AND d.penerbitan_salinan_putusan <= ?`,
    tabel: ["perkara_putusan"],
    // Kolomnya ada dan tidak pernah diisi - lihat LY07. Angka nol di sini
    // bukan "tidak ada salinan yang terbit"; salinan terbit tiap hari dan
    // tidak dicatat.
    wajibLebihDariNol: true,
  },
  {
    kunci: "pengaduanMasyarakat",
    judul: "Pengaduan masyarakat ditangani",
    tabel: ["pengaduan"],
    sebabTidakAda: "tidak ada satu pun tabel pengaduan pada SIPP - angkanya selama ini diisi tangan",
  },
  {
    kunci: "kepuasanMasyarakat",
    judul: "Nilai kepuasan masyarakat",
    tabel: ["survei_kepuasan"],
    sebabTidakAda:
      "hasil survei tidak tersimpan pada basis data mana pun - katalog sendiri menyebutnya diisi manual",
  },
];

async function barisPapanNilai(rentang) {
  const baris = [];

  for (const a of ANGKA_PAPAN_NILAI) {
    const siap = await tabelSiap(a.tabel);
    let nilai = null;
    let sebab = "";

    if (!siap) {
      sebab = a.sebabTidakAda || `tabel sumbernya (${a.tabel.join(", ")}) tidak ada pada SIPP satuan kerja ini`;
    } else if (!a.sql) {
      sebab = a.sebabTidakAda || "belum punya cara hitung";
    } else {
      try {
        const hasil = await runQuery(a.sql, [rentang.mulai, rentang.selesai]);
        nilai = angka(hasil[0] && hasil[0].n);
        if (a.wajibLebihDariNol && nilai === 0) {
          sebab =
            "kolomnya ada pada SIPP tetapi tidak pernah diisi, sehingga angkanya nol - itu bukan berarti tidak ada yang diterbitkan";
        }
      } catch (e) {
        sebab = `angkanya tidak dapat dihitung: ${String(e.message || e).slice(0, 120)}`;
      }
    }

    baris.push({
      kunci: `papan-${a.kunci}`,
      judulAngka: a.judul,
      nilai,
      memenuhi: !sebab,
      sebabTidakMemenuhi: sebab,
    });
  }

  return baris;
}

/** Tujuh butir Bab 11 yang punya sumber di SIPP. */
const BUTIR = [
  {
    kode: "LY01",
    kunci: "lamaLayananDirasakanPihak",
    judul: "Lama Layanan yang Dirasakan Para Pihak",
    keterangan:
      "Apakah lama layanan DAPAT DIKETAHUI - pendaftaran, sidang pertama, putusan, sampai akta cerai di tangan. Pihak yang bertanya sampai di mana perkaranya harus dapat dijawab dari tonggak yang tercatat; tonggak yang kosong berarti pertanyaan itu hanya dapat dijawab dengan membuka berkas fisiknya. Tiap tonggak dinilai hanya bila ia sudah semestinya dilalui.",
    baris: barisLamaLayanan,
    pembilang: "Perkara yang seluruh tonggak layanannya yang sudah semestinya dilalui memang bertanggal",
    penyebut: "Seluruh perkara yang didaftarkan pada rentang ini",
    tabel: "perkara disambung perkara_jadwal_sidang, perkara_putusan, dan perkara_akta_cerai",
    ruas: "tanggal_pendaftaran, tanggal_sidang, tanggal_putusan, tanggal_bht, tgl_akta_cerai, tgl_penyerahan_akta_cerai",
  },
  {
    kode: "LY02",
    kunci: "kehadiranDibebankanPihak",
    judul: "Jumlah Kehadiran yang Dibebankan kepada Pihak",
    keterangan: `Tiap kehadiran adalah satu hari kerja yang hilang bagi pihak, ditambah ongkos perjalanan yang tidak pernah tercatat pada berkas mana pun - pada satuan kerja yang wilayahnya luas, ongkos itu kerap melampaui panjar perkaranya sendiri. Yang melampaui ${AMBANG_KEHADIRAN_PIHAK} kali ditandai; yang tidak mencatat kehadiran sama sekali juga ditandai, sebab beban yang ditanggung pihaknya tidak dapat diketahui siapa pun.`,
    baris: barisKehadiranDibebankan,
    pembilang: `Perkara yang kehadiran pihaknya tercatat dan tidak lebih dari ${AMBANG_KEHADIRAN_PIHAK} kali`,
    penyebut: "Seluruh perkara yang didaftarkan pada rentang ini dan punya jadwal sidang",
    tabel: "perkara disambung perkara_jadwal_sidang lewat perkara_id",
    ruas: "tanggal_sidang, dihadiri_oleh",
  },
  {
    kode: "LY06",
    kunci: "aktaCeraiBelumDiambil",
    judul: "Akta Cerai Terbit Belum Diambil",
    keterangan: `Satu baris satu PIHAK, bukan satu perkara - pada perkara cerai kedua pihak berhak atas akta cerainya masing-masing, dan menghitung per perkara akan menyembunyikan separuh persoalannya. Selama akta belum di tangannya, seorang bekas suami atau istri belum dapat menikah lagi secara sah. Yang melampaui ${HARI_WAJAR_AMBIL_AKTA} hari sejak terbit juga ditandai.`,
    baris: barisAktaBelumDiambil,
    pembilang: `Akta yang tercatat diserahkan kepada pihaknya dalam ${HARI_WAJAR_AMBIL_AKTA} hari sejak terbit`,
    penyebut: "Tiap pihak dari tiap akta cerai yang sudah terbit atas perkara yang didaftarkan pada rentang ini",
    tabel: "perkara disambung perkara_akta_cerai dan perkara_putusan lewat perkara_id",
    ruas: "tgl_akta_cerai, tgl_penyerahan_akta_cerai, tgl_penyerahan_akta_cerai_pihak2, tanggal_bht",
  },
  {
    kode: "LY07",
    kunci: "salinanPutusanBelumDiambil",
    judul: "Salinan Putusan Belum Diambil",
    keterangan:
      "Penerbitan salinan putusan dan sampainya kepada pihak, dihitung hanya atas putusan yang sudah berkekuatan hukum tetap - sebelum itu salinan memang belum boleh dikeluarkan. Butir ini akan MERAH SELURUHNYA pada satuan kerja yang kolomnya tidak pernah diisi, dan itu disengaja: berbeda dari butir yang tabelnya tidak ada, yang ini dapat diperbaiki, dan cara memperbaikinya mengisi kolomnya.",
    baris: barisSalinanBelumDiambil,
    pembilang: "Putusan berkekuatan hukum tetap yang salinannya tercatat terbit dan sampai kepada pihak",
    penyebut: "Seluruh putusan berkekuatan hukum tetap atas perkara yang didaftarkan pada rentang ini",
    tabel: "perkara disambung perkara_putusan lewat perkara_id",
    ruas: "tanggal_bht, penerbitan_salinan_putusan, kirim_salinan_putusan_pihak1, kirim_salinan_putusan_pihak2",
  },
  {
    kode: "LY08",
    kunci: "sidangLuarGedungWilayah",
    judul: "Pelaksanaan Sidang di Luar Gedung",
    keterangan:
      "Sidang di luar gedung ada supaya pihak yang tinggal jauh tidak perlu menempuh perjalanan ke ibu kota kabupaten, dan laporannya disusun menurut WILAYAH. Wilayah itu hanya dapat diketahui dari nama tempatnya: persidangan yang bertanda sidang keliling tetapi tempatnya tidak tersebut benar-benar dilaksanakan namun hilang dari laporan menurut wilayah.",
    baris: barisSidangLuarGedung,
    pembilang: "Persidangan di luar gedung yang menyebut nama tempatnya, sehingga wilayahnya dapat dilaporkan",
    penyebut:
      "Persidangan atas perkara yang didaftarkan pada rentang ini yang ruangannya bukan ruang sidang bernomor, atau yang bertanda sidang keliling",
    tabel: "perkara disambung perkara_jadwal_sidang lewat perkara_id",
    ruas: "tanggal_sidang, ruangan, sidang_keliling",
  },
  {
    kode: "LY09",
    kunci: "layananPosbakum",
    judul: "Layanan Pos Bantuan Hukum",
    keterangan:
      "SIPP tidak punya tabel Posbakum. Yang dipakai aturan yang berlaku pada satuan kerjanya: perkara yang didaftarkan tanpa kuasa hukum melewati Pos Bantuan Hukum, dan di sanalah gugatannya disusun. Karena itu yang dinilai HASIL layanannya - posita, petitum, dan alamat lengkap pihak pengaju - bukan jumlah layanannya. BATASNYA: perkara tanpa kuasa tidak selalu pengguna Posbakum, sebab ada yang menyusun sendiri gugatannya; angka ini batas atas.",
    baris: barisLayananPosbakum,
    pembilang: "Perkara tanpa kuasa yang gugatannya lengkap: posita, petitum, alamat, dan kecamatan pihak pengaju",
    penyebut: "Seluruh perkara yang didaftarkan pada rentang ini tanpa kuasa hukum",
    tabel: "perkara disambung perkara_pihak1 dan pihak, disaring yang tidak punya baris pada perkara_pengacara",
    ruas: "posita, petitum, alamat, kecamatan",
  },
  {
    kode: "LY11",
    kunci: "papanNilaiPelayananPublik",
    judul: "Papan Nilai Pelayanan Publik",
    keterangan:
      "Satu baris satu ANGKA yang boleh dipublikasikan, bukan satu perkara. Yang dijawab: berapa bagian papan nilai pelayanan publik yang benar-benar dapat diisi dari data, dan bagian mana yang selama ini diisi tangan. Angka yang diisi tangan bukan angka yang salah - ia angka yang tidak dapat diperiksa, dan papan yang separuhnya diisi tangan tetap terbaca lengkap.",
    baris: barisPapanNilai,
    pembilang: "Angka papan nilai yang benar-benar terhitung dari SIPP pada rentang ini",
    penyebut: "Seluruh angka yang semestinya ada pada papan nilai pelayanan publik",
    tabel: "perkara, perkara_putusan, perkara_akta_cerai, perkara_jadwal_sidang, perkara_efiling_id, perkara_mediasi",
    ruas: "tanggal_pendaftaran, tanggal_putusan, tgl_akta_cerai, tgl_penyerahan_akta_cerai, ruangan, dimulai_mediasi, penerbitan_salinan_putusan",
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
      versiRumus: "pelayanan-v1",
      ambangDipakai: [],
      caraHitung: {
        pembilang: b.pembilang,
        penyebut: b.penyebut,
        dikecualikan:
          "Tonggak layanan yang belum semestinya dilalui tidak dituntut - perkara yang belum diputus tidak dinilai gagal karena belum punya tanggal putusan. Salinan putusan hanya dinilai pada perkara yang sudah berkekuatan hukum tetap, sebab sebelum itu salinan memang belum boleh dikeluarkan kepada pihak. Butir yang tabelnya tidak ada pada SIPP satuan kerja ini tidak menghasilkan baris sama sekali.",
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
  AMBANG_KEHADIRAN_PIHAK,
  ANGKA_PAPAN_NILAI,
  BUTIR,
  HARI_WAJAR_AMBIL_AKTA,
  HARI_WAJAR_TERBIT_AKTA,
  POLA_RUANG_DALAM,
  barisAktaBelumDiambil,
  barisKehadiranDibebankan,
  barisLamaLayanan,
  barisLayananPosbakum,
  barisPapanNilai,
  barisSalinanBelumDiambil,
  barisSidangLuarGedung,
  daftarkanSemua,
  lupakanSemua,
  sambungan,
};
