"use strict";

/**
 * ============================================================================
 * PENANDA YANG TIDAK ADA DI HALAMAN SIPP
 * ============================================================================
 *
 * SIPP menyimpan jauh lebih banyak daripada yang ditampilkannya. Sebagian yang
 * tidak ditampilkan itu justru yang menentukan pekerjaan hari itu - dan
 * petugas baru mengetahuinya ketika sudah terlambat: juru sita berangkat lalu
 * panjarnya habis, sidang dijadwalkan lalu mediasinya ternyata belum pernah
 * dilaksanakan, berkas banding menumpuk lewat tenggat pengiriman.
 *
 * Layanan ini membaca sembilan keadaan semacam itu. Seluruhnya BACA SAJA.
 *
 * ============================================================================
 * TIGA ATURAN YANG BERLAKU UNTUK SEMUANYA
 * ============================================================================
 *
 *   1. GAGAL-TERBUKA, DAN DIAM. Tabel yang tidak ada, kolom yang tidak
 *      dikenali, kueri yang gagal - semuanya berakhir dengan penanda itu TIDAK
 *      MUNCUL. Bukan muncul sebagai galat merah, dan bukan muncul sebagai
 *      "tidak ada masalah". Penanda yang salah di halaman SIPP lebih berbahaya
 *      daripada tidak ada penanda: petugas mempercayai apa yang tampil di
 *      aplikasi resminya.
 *
 *   2. SATU PENANDA HARUS MENGUBAH PEKERJAAN. Keterangan yang benar tetapi
 *      tidak mengubah apa pun akan diabaikan pada hari ketiga - lalu menulari
 *      penanda lain ikut diabaikan. Itu sebabnya daftar ini pendek.
 *
 *   3. TIAP TABEL DIPERIKSA ADA-TIDAKNYA LEBIH DAHULU. SIPP berbeda antar
 *      versi, dan ALETA dapat dipasang di satker lain.
 */

const db = require("../db_config");
const sippSkemaService = require("./sippSkemaService");
const prodeoPerkaraService = require("./prodeoPerkaraService");
const { cleanText } = require("./ecourtTextService");

/** Ambang sisa panjar yang dianggap menipis - satu kali panggilan tidak cukup. */
const AMBANG_PANJAR_TIPIS = 100000;

/**
 * Ambang perkara berjalan lama.
 *
 * SK Dirjen Badilag 048/2024 menilai waktu putus dengan tangga 3 bulan (5),
 * 4 bulan (3), 5 bulan (1), lebih dari itu nol. Lima bulan karena itu bukan
 * angka karangan - itu batas terakhir sebelum perkara bernilai NOL pada unsur
 * yang bobotnya paling besar di seluruh SK.
 */
const AMBANG_HARI_LAMA = 150;

function runQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (error, hasil) => {
      if (error) reject(error);
      else resolve(hasil);
    });
  });
}

/** Menjalankan pembaca satu penanda; kegagalan apa pun berarti penanda mati. */
async function aman(fn) {
  try {
    return await fn();
  } catch {
    return null;
  }
}

function isoTanggal(nilai) {
  if (!nilai) return "";
  const d = nilai instanceof Date ? nilai : new Date(nilai);
  if (Number.isNaN(d.getTime())) return "";
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function selisihHariDari(tanggal) {
  const iso = isoTanggal(tanggal);
  if (!iso) return null;
  const satuHari = 24 * 60 * 60 * 1000;
  return Math.floor((Date.now() - new Date(`${iso}T00:00:00`).getTime()) / satuHari);
}

/**
 * 5. SISA PANJAR.
 *
 * ============================================================================
 * KOLOM `sisa` TIDAK PERNAH DIISI SIPP - SALDONYA DIHITUNG SENDIRI
 * ============================================================================
 *
 * perkara_biaya punya kolom bernama `sisa`, dan namanya menjanjikan persis apa
 * yang dicari. Kolom itu KOSONG: dari seluruh barisnya, 32% NULL dan 68%
 * bernilai nol. Tidak satu pun membawa saldo yang sebenarnya.
 *
 * Membacanya begitu saja - sebagaimana percobaan pertama penanda ini -
 * menghasilkan "panjar habis" pada SETIAP perkara tanpa kecuali. Penanda yang
 * menyala di semua tempat sama gunanya dengan penanda yang mati, dengan
 * tambahan bahwa ia mengajari orang mengabaikan penanda lain.
 *
 * Saldonya karena itu dijumlahkan dari transaksinya:
 *
 *   jenis_transaksi  +1  pemasukan - panjar yang dibayar pihak
 *                    -1  pengeluaran - PNBP, ATK, panggilan, redaksi, meterai
 *
 *   saldo = SUM(jumlah * jenis_transaksi)
 *
 * Diuji atas 104 perkara yang belum putus: 85 cukup, 15 menipis, 4 habis.
 * Sembilan belas dari seratus empat - cukup selektif untuk dipercaya.
 */
async function sisaPanjar(perkaraId) {
  if (!(await sippSkemaService.tabelAda("perkara_biaya"))) return null;

  // ==========================================================================
  // HANYA PERKARA YANG BELUM PUTUS
  // ==========================================================================
  //
  // Panjar yang habis pada perkara yang SUDAH putus bukan masalah - itu justru
  // keadaan akhir yang semestinya: seluruh biaya sudah dipakai, sisanya
  // dikembalikan. Menandainya berarti menyalakan peringatan pada hampir
  // seluruh arsip perkara, dan penanda yang menyala di mana-mana adalah
  // penanda yang tidak dibaca siapa pun.
  //
  // Yang genting hanya perkara BERJALAN: panjar habis di tengah jalan berarti
  // panggilan berikutnya tidak dapat dikirim, dan itu menghentikan perkara
  // karena uang - bukan karena hukum.
  const putus = await runQuery(
    `SELECT pu.tanggal_putusan AS putus FROM perkara_putusan pu WHERE pu.perkara_id = ? LIMIT 1`,
    [perkaraId]
  ).catch(() => []);
  if (Array.isArray(putus) && putus[0] && isoTanggal(putus[0].putus)) return null;

  const baris = await runQuery(
    `SELECT ROUND(SUM(b.jumlah * b.jenis_transaksi)) AS saldo,
            MAX(b.tanggal_transaksi) AS terakhir,
            COUNT(*) AS transaksi
       FROM perkara_biaya b
      WHERE b.perkara_id = ?`,
    [perkaraId]
  );
  const satu = (Array.isArray(baris) && baris[0]) || null;
  if (!satu || !Number(satu.transaksi)) return null;

  const sisa = Number(satu.saldo);
  if (!Number.isFinite(sisa)) return null;

  // Perkara yang panjarnya masih cukup tidak perlu ditandai sama sekali.
  if (sisa >= AMBANG_PANJAR_TIPIS) return null;

  return {
    sisa,
    tanggal: isoTanggal(satu.terakhir),
    habis: sisa <= 0,
    menipis: sisa > 0 && sisa < AMBANG_PANJAR_TIPIS,
    ambang: AMBANG_PANJAR_TIPIS,
  };
}

/**
 * 7. AKTA CERAI BELUM TERBIT PADAHAL SUDAH BHT.
 *
 * Hak pihak atas akta cerai jatuh tempo sejak putusan berkekuatan hukum tetap.
 * SIPP tahu keduanya - tanggal BHT dan ada-tidaknya akta - tetapi tidak pernah
 * menyandingkannya di satu layar, sehingga yang menunggu aktanya hanya
 * ketahuan ketika pihaknya sendiri datang menagih.
 */
async function aktaCerai(perkaraId) {
  if (!(await sippSkemaService.tabelAda("perkara_akta_cerai"))) return null;
  if (!(await sippSkemaService.tabelAda("perkara_putusan"))) return null;

  const kolomBht = await sippSkemaService.pilihKolom("perkara_putusan", [
    "tanggal_bht",
    "tgl_bht",
  ]);
  if (!kolomBht) return null;

  const baris = await runQuery(
    `SELECT pu.${kolomBht} AS bht, ac.tgl_akta_cerai AS akta
       FROM perkara_putusan pu
       LEFT JOIN perkara_akta_cerai ac ON ac.perkara_id = pu.perkara_id
      WHERE pu.perkara_id = ?
      LIMIT 1`,
    [perkaraId]
  );
  const satu = (Array.isArray(baris) && baris[0]) || null;
  if (!satu) return null;

  const bht = isoTanggal(satu.bht);
  if (!bht) return null;
  if (isoTanggal(satu.akta)) return { tertunggak: false, bht, hari: null };

  return { tertunggak: true, bht, hari: selisihHariDari(satu.bht) };
}

/**
 * 8. VERZET.
 *
 * Perlawanan terhadap putusan verstek. Tenggangnya berjalan sejak pemberitahuan
 * putusan, dan salah menghitungnya berarti perlawanan yang seharusnya diterima
 * dinyatakan lewat waktu - kesalahan yang tidak dapat diperbaiki di tingkat ini.
 */
async function verzet(perkaraId) {
  if (!(await sippSkemaService.tabelAda("perkara_verzet"))) return null;

  // ==========================================================================
  // SATU PERKARA DAPAT DILAWAN LEBIH DARI SEKALI
  // ==========================================================================
  //
  // Sebelumnya kueri ini berbunyi LIMIT 1 tanpa ORDER BY. Pada perkara yang
  // dilawan dua kali, baris mana yang terbaca ditentukan MySQL sendiri - dan
  // MySQL tidak menjanjikan apa pun tanpa ORDER BY. Tanggal yang tergambar
  // karena itu dapat berpindah antar-pembacaan pada perkara yang sama, tanpa
  // satu pun galat.
  //
  // Yang dibaca sekarang seluruhnya, terbaru lebih dahulu. Perlawanan yang
  // TERBARU yang tenggangnya sedang berjalan; yang lama sudah menjadi
  // sejarah - tetapi ia tetap disebutkan, sebab "ini perlawanan kedua" adalah
  // keterangan yang mengubah cara majelis membaca berkasnya.
  //
  // Ini kelas kekeliruan yang sama dengan ['0']->id di ABT yang membuat
  // keterangan saksi terbaca dari sidang yang salah.
  //
  // Kolom jejak SIPP dipakai sebagai pemutus bila tanggal pendaftarannya sama
  // - tetapi hanya bila kolomnya memang ada. Mengurutkan atas kolom yang
  // tidak ada melempar galat, dan galat di sini ditelan aman() sehingga
  // penandanya hilang diam-diam.
  const punyaJejak = await sippSkemaService.kolomAda("perkara_verzet", "diinput_tanggal");
  const urutan = punyaJejak
    ? "ORDER BY v.tanggal_pendaftaran_verzet DESC, v.diinput_tanggal DESC"
    : "ORDER BY v.tanggal_pendaftaran_verzet DESC";

  const baris = await runQuery(
    `SELECT v.tanggal_pendaftaran_verzet AS daftar,
            v.tanggal_sidang_pertama_verzet AS sidang,
            v.putusan_verzet AS putusan
       FROM perkara_verzet v
      WHERE v.perkara_id = ?
      ${urutan}`,
    [perkaraId]
  );

  const semua = Array.isArray(baris) ? baris : [];
  if (semua.length === 0) return null;

  const satu = semua[0];
  return {
    ada: true,
    // Hampir selalu 1. Yang lebih dari itu jarang - dan justru karena jarang,
    // ia tidak pernah ketahuan bila tidak disebutkan angkanya.
    jumlah: semua.length,
    tanggalDaftar: isoTanggal(satu.daftar),
    sidangPertama: isoTanggal(satu.sidang),
    sudahPutus: Boolean(isoTanggal(satu.putusan)),
    // Perlawanan sebelumnya, terbaru lebih dahulu. Kosong pada perkara yang
    // hanya dilawan sekali - yaitu hampir seluruhnya.
    sebelumnya: semua.slice(1).map((lama) => ({
      tanggalDaftar: isoTanggal(lama.daftar),
      sidangPertama: isoTanggal(lama.sidang),
      sudahPutus: Boolean(isoTanggal(lama.putusan)),
    })),
  };
}

/**
 * 13. PERKARA BERJALAN LAMA DAN BELUM PUTUS.
 *
 * Yang dihitung hari kalender sejak pendaftaran, sama seperti SK menghitungnya.
 * Perkara yang SUDAH putus tidak ditandai - lamanya sudah menjadi sejarah, dan
 * penanda yang menyala pada perkara selesai hanya keramaian.
 */
async function berjalanLama(perkaraId) {
  const baris = await runQuery(
    `SELECT p.tanggal_pendaftaran AS daftar, pu.tanggal_putusan AS putus
       FROM perkara p
       LEFT JOIN perkara_putusan pu ON pu.perkara_id = p.perkara_id
      WHERE p.perkara_id = ?
      LIMIT 1`,
    [perkaraId]
  );
  const satu = (Array.isArray(baris) && baris[0]) || null;
  if (!satu) return null;
  if (isoTanggal(satu.putus)) return null;

  const hari = selisihHariDari(satu.daftar);
  if (hari === null || hari < AMBANG_HARI_LAMA) return null;

  return { hari, tanggalDaftar: isoTanggal(satu.daftar), ambang: AMBANG_HARI_LAMA };
}

/**
 * 14. MEDIASI BELUM DILAKSANAKAN.
 *
 * Yang ditandai HANYA perkara yang barisnya sudah ada di perkara_mediasi tetapi
 * belum dimulai - artinya mediasi memang dikehendaki pada perkara ini dan belum
 * berjalan.
 *
 * Perkara yang belum punya baris sama sekali TIDAK ditandai, walau boleh jadi
 * ia justru yang paling terlewat. Sebabnya: menentukan wajib-tidaknya mediasi
 * menuntut membaca jenis perkara, ada-tidaknya kesepakatan, dan kehadiran para
 * pihak pada sidang pertama - dan menebaknya dari jenis perkara saja akan
 * menandai perkara yang memang dikecualikan PERMA 1/2016. Penanda yang menuduh
 * salah lebih merugikan daripada penanda yang absen.
 */
async function mediasiTertunda(perkaraId) {
  if (!(await sippSkemaService.tabelAda("perkara_mediasi"))) return null;

  const baris = await runQuery(
    `SELECT m.penetapan_penunjukan_mediator AS ditunjuk,
            m.dimulai_mediasi AS dimulai,
            m.mediator_text AS mediator,
            m.hasil_mediasi AS hasil
       FROM perkara_mediasi m
      WHERE m.perkara_id = ?
      ORDER BY m.mediasi_id DESC
      LIMIT 1`,
    [perkaraId]
  );
  const satu = (Array.isArray(baris) && baris[0]) || null;
  if (!satu) return null;

  const ditunjuk = isoTanggal(satu.ditunjuk);
  if (!ditunjuk) return null;
  if (isoTanggal(satu.dimulai)) return null;
  if (cleanText(satu.hasil)) return null;

  return {
    tertunda: true,
    tanggalPenunjukan: ditunjuk,
    mediator: cleanText(satu.mediator),
    hari: selisihHariDari(satu.ditunjuk),
  };
}

/**
 * 15. PRODEO.
 *
 * Perkara yang dibebaskan biayanya TIDAK boleh ditagih panjar. Salah tagih
 * bukan sekadar keliru administrasi - ia menutup akses orang yang justru
 * dibebaskan karena tidak mampu, dan menjadi temuan pengawasan.
 *
 * 118 dari 10.105 perkara di sini berstatus prodeo.
 */
async function prodeo(perkaraId) {
  // 26 Okt 2026: satu sumber dengan Jadwal Sidang dan Status Perkara
  // (perkara.prodeo = 1 atau persetujuan prodeo e-Court) - prodeoPerkaraService.
  // Tidak terbaca = null, sama seperti sebelumnya.
  const tanda = await prodeoPerkaraService.penandaProdeoPerkara(perkaraId, { kueri: runQuery, skema: sippSkemaService });
  return tanda.prodeo === true ? { prodeo: true } : null;
}

/**
 * 16. DELEGASI MASUK YANG BELUM DIKIRIM BALIK.
 *
 * Pengadilan lain menunggu, dan tenggangnya dinilai SK Tabel 2 I.17. Yang
 * ditandai delegasi yang sudah diterima tetapi relaasnya belum dikirim balik -
 * tgl_pengiriman masih kosong.
 */
async function delegasiTertunggak(perkaraId) {
  if (!(await sippSkemaService.tabelAda("delegasi_masuk"))) return null;

  const baris = await runQuery(
    `SELECT d.tgl_delegasi AS diterima, d.pn_asal_text AS asal,
            d.jenis_delegasi_text AS jenis, d.tgl_sidang AS sidang
       FROM delegasi_masuk d
      WHERE d.perkara_id = ?
        AND (d.tgl_pengiriman IS NULL OR d.tgl_pengiriman = '0000-00-00')
      ORDER BY d.tgl_delegasi ASC`,
    [perkaraId]
  );
  const daftar = Array.isArray(baris) ? baris : [];
  if (daftar.length === 0) return null;

  const pertama = daftar[0];
  return {
    jumlah: daftar.length,
    asal: cleanText(pertama.asal),
    jenis: cleanText(pertama.jenis),
    tanggalTerima: isoTanggal(pertama.diterima),
    hari: selisihHariDari(pertama.diterima),
  };
}

/**
 * 18. REKONVENSI.
 *
 * Gugatan balik. Dua perkara dalam satu berkas, dan putusannya WAJIB memuat
 * amar untuk keduanya - konvensi dan rekonvensi. Putusan yang hanya menjawab
 * konvensi adalah putusan yang tidak lengkap, dan itu alasan pembatalan di
 * tingkat banding.
 */
async function rekonvensi(perkaraId) {
  if (!(await sippSkemaService.tabelAda("perkara_rekonvensi"))) return null;

  const baris = await runQuery(
    `SELECT r.tanggal_pendaftaran AS daftar, r.parapihak AS pihak
       FROM perkara_rekonvensi r
      WHERE r.perkara_id = ?
      LIMIT 1`,
    [perkaraId]
  );
  const satu = (Array.isArray(baris) && baris[0]) || null;
  if (!satu) return null;

  return { ada: true, tanggalDaftar: isoTanggal(satu.daftar), pihak: cleanText(satu.pihak) };
}

/**
 * 20. UPAYA HUKUM BERJALAN, BERKASNYA BELUM DIKIRIM.
 *
 * Tenggat pengiriman berkas ke pengadilan tingkat atas punya sanksinya sendiri,
 * dan berkas yang tertahan di sini menahan perkara orang di sana. SIPP mencatat
 * keduanya - permohonannya dan pengirimannya - pada baris yang sama, tetapi
 * tidak pernah menyandingkannya sebagai satu pertanyaan.
 *
 * Ketiga tingkat dibaca dengan bentuk yang sama, hanya nama tabel dan kolomnya
 * berbeda. Yang tabelnya tidak ada dilewati.
 */
const UPAYA = [
  {
    kunci: "banding",
    label: "Banding",
    tabel: "perkara_banding",
    kolomMohon: "permohonan_banding",
    kolomKirim: "pengiriman_berkas_banding",
  },
  {
    kunci: "kasasi",
    label: "Kasasi",
    tabel: "perkara_kasasi",
    kolomMohon: "permohonan_kasasi",
    kolomKirim: "pengiriman_berkas_kasasi",
  },
  {
    kunci: "pk",
    label: "Peninjauan Kembali",
    tabel: "perkara_pk",
    kolomMohon: "permohonan_pk",
    kolomKirim: "pengiriman_berkas_pk",
  },
];

async function upayaHukumTertunda(perkaraId) {
  const hasil = [];

  for (const acuan of UPAYA) {
    if (!(await sippSkemaService.tabelAda(acuan.tabel))) continue;
    const mohon = await sippSkemaService.pilihKolom(acuan.tabel, [acuan.kolomMohon]);
    const kirim = await sippSkemaService.pilihKolom(acuan.tabel, [acuan.kolomKirim]);
    if (!mohon || !kirim) continue;

    const baris = await runQuery(
      `SELECT u.${mohon} AS mohon, u.${kirim} AS kirim
         FROM ${acuan.tabel} u
        WHERE u.perkara_id = ?
        LIMIT 1`,
      [perkaraId]
    ).catch(() => []);
    const satu = (Array.isArray(baris) && baris[0]) || null;
    if (!satu) continue;

    const tanggalMohon = isoTanggal(satu.mohon);
    if (!tanggalMohon) continue;
    if (isoTanggal(satu.kirim)) continue;

    hasil.push({
      kunci: acuan.kunci,
      label: acuan.label,
      tanggalMohon,
      hari: selisihHariDari(satu.mohon),
    });
  }

  return hasil.length > 0 ? hasil : null;
}

/**
 * Seluruh penanda untuk satu perkara.
 *
 * Dijalankan berbarengan: kesembilannya saling bebas, dan menjalankannya
 * berurutan berarti petugas menunggu sembilan kali lebih lama untuk keterangan
 * yang sebenarnya dapat datang bersamaan.
 *
 * Yang bernilai null TIDAK ikut dipulangkan. Amplop yang penuh kunci bernilai
 * null memaksa tiap pembacanya memeriksa null satu per satu, dan yang lupa
 * memeriksanya akan menggambar penanda kosong.
 */
async function penandaTambahan(perkaraId) {
  const id = Number(perkaraId);
  if (!Number.isFinite(id) || id <= 0) return {};

  const [
    panjar,
    akta,
    lawan,
    lama,
    mediasi,
    bebas,
    delegasi,
    balik,
    upaya,
  ] = await Promise.all([
    aman(() => sisaPanjar(id)),
    aman(() => aktaCerai(id)),
    aman(() => verzet(id)),
    aman(() => berjalanLama(id)),
    aman(() => mediasiTertunda(id)),
    aman(() => prodeo(id)),
    aman(() => delegasiTertunggak(id)),
    aman(() => rekonvensi(id)),
    aman(() => upayaHukumTertunda(id)),
  ]);

  const hasil = {};
  if (panjar) hasil.panjar = panjar;
  if (akta && akta.tertunggak) hasil.aktaCerai = akta;
  if (lawan) hasil.verzet = lawan;
  if (lama) hasil.berjalanLama = lama;
  if (mediasi) hasil.mediasi = mediasi;
  if (bebas) hasil.prodeo = bebas;
  if (delegasi) hasil.delegasi = delegasi;
  if (balik) hasil.rekonvensi = balik;
  if (upaya) hasil.upayaHukum = upaya;
  return hasil;
}

module.exports = {
  penandaTambahan,
  AMBANG_PANJAR_TIPIS,
  AMBANG_HARI_LAMA,
  // Diekspor untuk diuji satuan.
  sisaPanjar,
  aktaCerai,
  verzet,
  berjalanLama,
  mediasiTertunda,
  prodeo,
  delegasiTertunggak,
  rekonvensi,
  upayaHukumTertunda,
};
