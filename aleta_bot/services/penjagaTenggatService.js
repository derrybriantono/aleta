/**
 * ============================================================================
 * AGEN PENJAGA TENGGAT - PEMBACA FAKTANYA (TAHAP 3)
 * ============================================================================
 *
 * Berkas ini HANYA MEMBACA. Tidak ada satu pun INSERT, UPDATE, atau DELETE di
 * sini, dan itu bukan kebetulan: penjaga tenggat yang dapat menulis adalah
 * penjaga yang suatu hari akan menulis pada saat yang keliru, dan tidak ada
 * yang menyuruhnya melakukan itu.
 *
 * Keputusan tentang apa yang terlampaui TIDAK diambil di sini - ia diambil
 * mesin aturan di manajemen_surat/src/lib/penjaga-tenggat.ts, yang dapat diuji
 * tanpa basis data. Yang dikerjakan berkas ini hanya menyusun fakta menurut
 * bentuk yang diminta mesin itu.
 *
 * ============================================================================
 * SETIAP KUERI MEMBAWA ANGKA HASIL UKURNYA
 * ============================================================================
 *
 * Diukur 15 September 2026 atas sipp_donggala. Angka pada tiap kueri adalah
 * berapa perkara yang tertangkap saat itu - bukan hiasan: bila suatu hari
 * angkanya melonjak sepuluh kali lipat, yang berubah hampir pasti kuerinya,
 * bukan pengadilannya.
 *
 * ============================================================================
 * TIDAK MEMAKAI v_pihak_perkara
 * ============================================================================
 *
 * View itu memaksa MariaDB membentuk seluruh isinya sebelum saringan berlaku -
 * 8,5 detik untuk 20 perkara. Penjaga tenggat berjalan pagi hari tanpa ada
 * yang menunggu di depan layar, tetapi kelambatan yang tidak perlu tetap
 * kelambatan. Tidak ada satu pun kueri di sini yang menyentuhnya.
 */

const db = require("../db_config");

/** Status putusan SIPP yang berarti perceraiannya dikabulkan. */
const STATUS_DIKABULKAN = 62;

/** Seberapa jauh ke belakang fakta dibaca. Lebih tua dari ini = tumpukan lama. */
const CAKRAWALA_BULAN = 24;

function jalankan(sql, nilai = []) {
  return new Promise((selesai, gagal) => {
    db.query(sql, nilai, (galat, baris) => (galat ? gagal(galat) : selesai(baris || [])));
  });
}

/** yyyy-mm-dd dari Date atau teks. */
function isoTanggal(nilai) {
  if (!nilai) return "";
  if (nilai instanceof Date) {
    if (Number.isNaN(nilai.getTime())) return "";
    return `${nilai.getFullYear()}-${String(nilai.getMonth() + 1).padStart(2, "0")}-${String(
      nilai.getDate()
    ).padStart(2, "0")}`;
  }
  const cocok = String(nilai).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return cocok ? `${cocok[1]}-${cocok[2]}-${cocok[3]}` : "";
}

/** Tanggal acuan mundur sekian bulan, sebagai yyyy-mm-dd. */
function mundurBulan(acuanIso, bulan) {
  const t = new Date(`${acuanIso}T12:00:00Z`);
  t.setUTCMonth(t.getUTCMonth() - bulan);
  return isoTanggal(t);
}

function rapikan(baris) {
  return {
    perkaraId: String(baris.perkaraId || ""),
    nomorPerkara: String(baris.nomorPerkara || ""),
    jenisPerkara: String(baris.jenisPerkara || ""),
    tanggalAcuan: isoTanggal(baris.tanggalAcuan),
    statusPutusanId: baris.statusPutusanId == null ? null : Number(baris.statusPutusanId),
    keterangan: String(baris.keterangan || ""),
  };
}

/* ========================================================================== */

/**
 * 1. Perkara belum putus, dihitung dari tanggal pendaftaran.
 *
 * Diukur: 107 perkara belum putus; 1 melewati 150 hari, 1 pada bulan kelima.
 */
async function umurPerkara(acuan) {
  const baris = await jalankan(
    `SELECT p.perkara_id AS perkaraId, p.nomor_perkara AS nomorPerkara,
            p.jenis_perkara_nama AS jenisPerkara, p.tanggal_pendaftaran AS tanggalAcuan,
            NULL AS statusPutusanId, p.tahapan_terakhir_text AS keterangan
       FROM perkara p
       LEFT JOIN perkara_putusan pu ON pu.perkara_id = p.perkara_id
      WHERE pu.tanggal_putusan IS NULL
        AND p.tanggal_pendaftaran IS NOT NULL
        AND p.tanggal_pendaftaran >= ?
      ORDER BY p.tanggal_pendaftaran ASC
      LIMIT 500`,
    [mundurBulan(acuan, CAKRAWALA_BULAN)]
  );
  return baris.map(rapikan);
}

/**
 * 2. Cerai talak yang ikrarnya belum diucapkan.
 *
 * Acuan = PENETAPAN HARI SIDANG IKRAR (perkara_ikrar_talak.tanggal_penetapan_sidang_ikrar),
 * bukan BHT: Pasal 70 ayat (6) UU 7/1989 menghitung 6 bulan sejak hari sidang ikrar ditetapkan
 * (keputusan pengguna no. 91, 18 Okt 2026). Perkara tanpa penetapan itu TIDAK ikut - tenggatnya
 * belum berjalan. Batasnya di mesin aturan 180 hari (mesin hanya mengenal hari): 1-4 hari lebih
 * awal daripada 6 bulan kalender, jadi peringatan sedikit lebih hati-hati, tidak pernah terlambat.
 *
 * Saringan status DIKABULKAN dikerjakan DI SINI, bukan diserahkan ke mesin
 * aturan, supaya perkara yang tidak pernah menunggu ikrar tidak ikut terbawa
 * melintasi jaringan. Mesin aturan menyaringnya sekali lagi - dua saringan
 * untuk satu kekeliruan yang pernah menghasilkan 33 tuduhan palsu.
 *
 * Diukur (dasar BHT lama): tanpa saringan 35 tertangkap, 2 sungguhan.
 */
async function ikrarTalak(acuan) {
  const baris = await jalankan(
    `SELECT p.perkara_id AS perkaraId, p.nomor_perkara AS nomorPerkara,
            p.jenis_perkara_nama AS jenisPerkara,
            it.tanggal_penetapan_sidang_ikrar AS tanggalAcuan,
            pu.status_putusan_id AS statusPutusanId,
            CONCAT('PHS ikrar ', DATE_FORMAT(it.tanggal_penetapan_sidang_ikrar, '%d-%m-%Y')) AS keterangan
       FROM perkara_ikrar_talak it
       JOIN perkara p ON p.perkara_id = it.perkara_id
       JOIN perkara_putusan pu ON pu.perkara_id = it.perkara_id
      WHERE pu.status_putusan_id = ?
        AND p.jenis_perkara_nama = 'Cerai Talak'
        AND it.tanggal_penetapan_sidang_ikrar IS NOT NULL
        AND it.tanggal_penetapan_sidang_ikrar >= ?
        AND it.tgl_ikrar_talak IS NULL
      ORDER BY it.tanggal_penetapan_sidang_ikrar ASC
      LIMIT 500`,
    [STATUS_DIKABULKAN, mundurBulan(acuan, CAKRAWALA_BULAN)]
  );
  return baris.map(rapikan);
}

/**
 * 3. Cerai gugat yang akta cerainya belum terbit - dihitung sejak BHT.
 *
 * Diukur: nol sejak 2019. Yang tertangkap tanpa cakrawala seluruhnya dari
 * 2015-2018, dan seluruhnya dari masa sebelum SIPP dipakai penuh.
 */
async function aktaCeraiGugat(acuan) {
  const baris = await jalankan(
    `SELECT p.perkara_id AS perkaraId, p.nomor_perkara AS nomorPerkara,
            p.jenis_perkara_nama AS jenisPerkara, pu.tanggal_bht AS tanggalAcuan,
            pu.status_putusan_id AS statusPutusanId,
            CONCAT('BHT ', DATE_FORMAT(pu.tanggal_bht, '%d-%m-%Y')) AS keterangan
       FROM perkara_putusan pu
       JOIN perkara p ON p.perkara_id = pu.perkara_id
       LEFT JOIN perkara_akta_cerai ac ON ac.perkara_id = pu.perkara_id
      WHERE pu.status_putusan_id = ?
        AND p.jenis_perkara_nama = 'Cerai Gugat'
        AND pu.tanggal_bht IS NOT NULL
        AND pu.tanggal_bht >= ?
        AND ac.perkara_id IS NULL
      ORDER BY pu.tanggal_bht ASC
      LIMIT 500`,
    [STATUS_DIKABULKAN, mundurBulan(acuan, CAKRAWALA_BULAN)]
  );
  return baris.map(rapikan);
}

/**
 * 4. Cerai talak yang akta cerainya belum terbit - dihitung sejak IKRAR.
 *
 * ==========================================================================
 * INILAH ATURAN YANG PALING MUDAH DITULIS KELIRU
 * ==========================================================================
 *
 * Menghitungnya dari BHT - sebagaimana cerai gugat - menuduh 16 perkara
 * terlambat, padahal SELURUH 16 sedang menunggu ikrarnya. Akta cerai pada
 * cerai talak memang tidak boleh terbit sebelum ikrar diucapkan; menagihnya
 * berarti menagih pekerjaan yang belum boleh dikerjakan.
 *
 * JOIN, bukan LEFT JOIN, pada perkara_ikrar_talak: yang belum ikrar bukan
 * urusan aturan ini sama sekali - ia urusan aturan nomor 2.
 *
 * Diukur: 5 perkara.
 */
async function aktaCeraiTalak(acuan) {
  const baris = await jalankan(
    `SELECT p.perkara_id AS perkaraId, p.nomor_perkara AS nomorPerkara,
            p.jenis_perkara_nama AS jenisPerkara, it.tgl_ikrar_talak AS tanggalAcuan,
            pu.status_putusan_id AS statusPutusanId,
            CONCAT('ikrar ', DATE_FORMAT(it.tgl_ikrar_talak, '%d-%m-%Y')) AS keterangan
       FROM perkara_putusan pu
       JOIN perkara p ON p.perkara_id = pu.perkara_id
       JOIN perkara_ikrar_talak it ON it.perkara_id = pu.perkara_id
       LEFT JOIN perkara_akta_cerai ac ON ac.perkara_id = pu.perkara_id
      WHERE pu.status_putusan_id = ?
        AND p.jenis_perkara_nama = 'Cerai Talak'
        AND it.tgl_ikrar_talak IS NOT NULL
        AND it.tgl_ikrar_talak >= ?
        AND ac.perkara_id IS NULL
      ORDER BY it.tgl_ikrar_talak ASC
      LIMIT 500`,
    [STATUS_DIKABULKAN, mundurBulan(acuan, CAKRAWALA_BULAN)]
  );
  return baris.map(rapikan);
}

/**
 * 5. Sidang pertama yang sudah dekat sedangkan relaasnya belum kembali.
 *
 * Tanggal acuannya tanggal SIDANG, dan tenggatnya jatuh SEBELUM tanggal itu -
 * karena itu ambangnya negatif pada mesin aturan (-3 hari).
 *
 * Diukur atas 2.039 sidang pertama setahun: jeda relaas ke sidang rata-rata
 * 16,6 hari, hanya 2,6% kurang dari 3 hari. Setahun penuh hanya 10 sidang
 * pertama yang tidak punya relaas sama sekali - kurang dari satu persen.
 *
 * Hanya sidang PERTAMA. Sidang lanjutan tidak selalu menuntut relaas baru,
 * dan menagihnya membuat 43 dari 57 sidang tertangkap - tuduhan yang
 * kebanyakannya salah.
 */
async function relaasSidangPertama(acuan) {
  const baris = await jalankan(
    `SELECT p.perkara_id AS perkaraId, p.nomor_perkara AS nomorPerkara,
            p.jenis_perkara_nama AS jenisPerkara, j.tanggal_sidang AS tanggalAcuan,
            NULL AS statusPutusanId,
            -- Tanggalnya TIDAK diulang di sini: laporan sudah menyebut
            -- "sidang hari ini" atau "sidang 6 hari lagi" dari hitungannya
            -- sendiri, dan mengulanginya menghasilkan "sidang hari ini -
            -- sidang 15-09-2026 09:00:00". Yang tersisa hanya jamnya, sebab
            -- itulah yang tidak dapat disimpulkan dari selisih hari.
            CONCAT('pukul ', COALESCE(LEFT(j.jam_sidang, 5), '-')) AS keterangan
       FROM perkara_jadwal_sidang j
       JOIN perkara p ON p.perkara_id = j.perkara_id
       LEFT JOIN perkara_putusan pu ON pu.perkara_id = p.perkara_id
      WHERE j.urutan = 1
        AND pu.tanggal_putusan IS NULL
        AND j.tanggal_sidang BETWEEN ? AND DATE_ADD(?, INTERVAL 14 DAY)
        AND NOT EXISTS (
              SELECT 1 FROM perkara_pelaksanaan_relaas r
               WHERE r.sidang_id = j.id AND r.tanggal_relaas IS NOT NULL)
      ORDER BY j.tanggal_sidang ASC
      LIMIT 500`,
    [acuan, acuan]
  );
  return baris.map(rapikan);
}

/**
 * 6. Antrean Direktori Putusan yang gagal terkirim.
 *
 * Diukur: 4 gagal, percobaan terakhir 9 April 2026 - lima bulan tanpa ada
 * yang menyadarinya, sebab tidak ada satu pun layar yang menyebutkannya.
 * Itulah jenis kegagalan yang paling pantas dijaga penjaga tenggat: yang
 * tidak berbunyi sendiri.
 */
async function dirputGagal(acuan) {
  // Satu perkara dapat punya BEBERAPA baris antrean gagal - tiap percobaan
  // meninggalkan barisnya sendiri. Diukur: 4 baris untuk 2 perkara, dan tanpa
  // penggabungan laporan menyebut perkara yang sama tiga kali berturut-turut.
  // Yang perlu dikerjakan satu kali tidak boleh tampak tiga pekerjaan.
  const baris = await jalankan(
    `SELECT p.perkara_id AS perkaraId, p.nomor_perkara AS nomorPerkara,
            p.jenis_perkara_nama AS jenisPerkara,
            DATE(MAX(a.last_tried)) AS tanggalAcuan,
            NULL AS statusPutusanId,
            CONCAT(
              COALESCE(NULLIF(MIN(a.keterangan), ''), 'tanpa keterangan'),
              -- Pemisahnya ASCII. Titik tengah yang ditulis di dalam SQL
              -- pulang sebagai "Â·" lewat sambungan ini - huruf yang rusak pada
              -- laporan terbaca sebagai kerusakan program, bukan sebagai data.
              CASE WHEN COUNT(*) > 1 THEN CONCAT(' - ', COUNT(*), 'x gagal') ELSE '' END
            ) AS keterangan
       FROM dirput_antrian a
       JOIN perkara p ON p.perkara_id = a.perkara_id
      WHERE a.status <> 1
        AND a.last_tried IS NOT NULL
        AND DATE(a.last_tried) >= ?
      GROUP BY p.perkara_id, p.nomor_perkara, p.jenis_perkara_nama
      ORDER BY MAX(a.last_tried) ASC
      LIMIT 200`,
    [mundurBulan(acuan, CAKRAWALA_BULAN)]
  );
  return baris.map(rapikan);
}

/**
 * 7. Putusan yang berkas anonimisasinya belum ada.
 *
 * Diukur atas 693 putusan 2026: 0 tanpa dokumen putusan, 1 tanpa anonimisasi.
 * Aturan ini karena itu hampir selalu diam - dan ketika berbunyi, ia menunjuk
 * satu berkas yang memang hilang, bukan seratus yang memang belum waktunya.
 */
async function anonimisasiHilang(acuan) {
  const baris = await jalankan(
    `SELECT p.perkara_id AS perkaraId, p.nomor_perkara AS nomorPerkara,
            p.jenis_perkara_nama AS jenisPerkara, pu.tanggal_putusan AS tanggalAcuan,
            NULL AS statusPutusanId, 'anonimisasi belum ada' AS keterangan
       FROM perkara_putusan pu
       JOIN perkara p ON p.perkara_id = pu.perkara_id
      WHERE pu.tanggal_putusan IS NOT NULL
        AND pu.tanggal_putusan >= ?
        AND COALESCE(pu.amar_putusan_anonimisasi_dok, '') = ''
      ORDER BY pu.tanggal_putusan ASC
      LIMIT 200`,
    [mundurBulan(acuan, CAKRAWALA_BULAN)]
  );
  return baris.map(rapikan);
}

/* ========================================================================== */

const PEMBACA = {
  "umur-perkara": umurPerkara,
  "ikrar-talak": ikrarTalak,
  "akta-cerai-gugat": aktaCeraiGugat,
  "akta-cerai-talak": aktaCeraiTalak,
  "relaas-sidang-pertama": relaasSidangPertama,
  "dirput-gagal": dirputGagal,
  "anonimisasi-hilang": anonimisasiHilang,
};

/**
 * Membaca seluruh fakta tenggat untuk satu tanggal acuan.
 *
 * Tiap pembaca GAGAL SENDIRI-SENDIRI. Satu tabel yang tidak ada pada
 * pemasangan tertentu - perkara_ikrar_talak pada pengadilan negeri, misalnya -
 * tidak boleh menghilangkan enam aturan lainnya; ia hanya membuat aturannya
 * sendiri diam, dan sebabnya disebut.
 */
async function bacaFakta(acuanIso) {
  const acuan = isoTanggal(acuanIso) || isoTanggal(new Date());
  const fakta = {};
  const gagal = {};

  await Promise.all(
    Object.entries(PEMBACA).map(async ([kode, baca]) => {
      try {
        fakta[kode] = await baca(acuan);
      } catch (galat) {
        fakta[kode] = [];
        gagal[kode] = String((galat && galat.message) || galat).slice(0, 200);
      }
    })
  );

  return { acuan, fakta, gagal };
}

module.exports = {
  CAKRAWALA_BULAN,
  STATUS_DIKABULKAN,
  bacaFakta,
  isoTanggal,
  mundurBulan,
  // Dibuka satu per satu supaya tiap aturan dapat diukur sendiri saat
  // angkanya dicurigai, tanpa menjalankan ketujuhnya.
  pembaca: PEMBACA,
};
