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

const appeal = require("./appealDeadlineService");

// Basis data dibaca LAZY: berkas ini kini juga dimuat uji tanpa SIPP. Pada jalan biasa tidak ada bedanya
// (kolam mysql baru terhubung saat kueri pertama).
function dbBawaan() {
  return require("../db_config");
}

/** Status putusan SIPP yang berarti perceraiannya dikabulkan. */
const STATUS_DIKABULKAN = 62;

/** Seberapa jauh ke belakang fakta dibaca. Lebih tua dari ini = tumpukan lama. */
const CAKRAWALA_BULAN = 24;

function jalankanBawaan(sql, nilai = []) {
  return new Promise((selesai, gagal) => {
    dbBawaan().query(sql, nilai, (galat, baris) => (galat ? gagal(galat) : selesai(baris || [])));
  });
}

// Penyuntik untuk uji (kueri palsu, skema palsu). Pada jalan biasa tidak pernah dipanggil.
let pelaksana = jalankanBawaan;
let penjawabKolom = (tabel, kolom) => require("./sippSkemaService").kolomAda(tabel, kolom);

function jalankan(sql, nilai = []) {
  return pelaksana(sql, nilai);
}

/** Hanya untuk uji: ganti pelaksana kueri dan/atau pemeriksa kolom; mengembalikan fungsi pemulih. */
function pasangSumber({ jalankan: j, kolomAda: k } = {}) {
  const lamaJ = pelaksana;
  const lamaK = penjawabKolom;
  if (j) pelaksana = j;
  if (k) penjawabKolom = k;
  return () => {
    pelaksana = lamaJ;
    penjawabKolom = lamaK;
  };
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
/* ATURAN BARU (G1, 25 Okt 2026) - banding, kasasi, mediasi                    */
/* ========================================================================== */
/*
 * Dibaca HANYA bila pemanggil meminta `baru` (jadwal harian / layar Tenggat). Rute lama tetap membaca
 * tujuh aturan di atas persis seperti sebelumnya.
 *
 * Semua pembaca di bagian ini juga HANYA MEMBACA. Dasar hukum tiap aturan ditulis di mesin aturan portal
 * (src/lib/penjaga-tenggat.ts) dengan catatan "diperiksa Derry 26 Okt 2026"; di sini hanya tertulis angka yang
 * dipakai kueri.
 */

/** Putusan yang masih dibaca masa bandingnya: lebih tua dari ini sudah pasti lewat atau sudah BHT. */
const JENDELA_PUTUSAN_HARI = 60;

/** Mediasi belum dilaporkan yang masih dibaca: lebih tua dari ini dianggap data lama, bukan tenggat. */
const JENDELA_MEDIASI_HARI = 120;

/** PERMA 1/2016 Pasal 24 ayat (2). Uji menjaga agar sama dengan sippJadwalSidangService.BATAS_MEDIASI_HARI. */
const BATAS_MEDIASI_HARI = 30;

function geserHari(iso, hari) {
  return appeal.addDays(iso, hari);
}

function tengahHari(acuan) {
  return new Date(`${acuan}T12:00:00Z`);
}

function teksBersih(nilai) {
  return String(nilai == null ? "" : nilai)
    .replace(/\s+/g, " ")
    .trim();
}

/** Bidang tambahan fakta aturan baru; bidang kosong tidak ikut supaya bentuk fakta lama tidak berubah. */
function rapikanBaru(baris, tambahan = {}) {
  const dasar = rapikan(baris);
  const ekstra = {};
  const alur = Number(baris.alurPerkaraId);
  const jenis = Number(baris.jenisPerkaraId);
  if (Number.isFinite(alur) && alur > 0) ekstra.alurPerkaraId = alur;
  if (Number.isFinite(jenis) && jenis > 0) ekstra.jenisPerkaraId = jenis;
  for (const [k, v] of Object.entries(tambahan)) {
    if (v !== undefined && v !== null && v !== "") ekstra[k] = v;
  }
  return { ...dasar, ...ekstra };
}

/**
 * 8. Masa banding 14 hari, PER PIHAK.
 *
 * Putusan terbaru (60 hari), belum BHT, belum ada permohonan banding. Tiap pihak dihitung oleh
 * appealDeadlineService (aturan lama, tidak digandakan): sejak putusan diucapkan bagi yang hadir, sejak
 * pemberitahuan putusan bagi yang tidak hadir. Pihak tidak hadir yang BELUM diberitahu tidak diberi
 * tanggal - hanya catatan "masa banding belum berjalan".
 */
async function bandingMasa(acuan) {
  const baris = await jalankan(
    `SELECT p.perkara_id AS perkaraId, p.nomor_perkara AS nomorPerkara,
            p.jenis_perkara_nama AS jenisPerkara, p.alur_perkara_id AS alurPerkaraId,
            p.jenis_perkara_id AS jenisPerkaraId,
            pu.tanggal_putusan AS tanggalPutusan, pu.putusan_verstek AS verstek,
            pu.tanggal_bht AS tanggalBht, pu.status_putusan_id AS statusPutusanId,
            (SELECT j.dihadiri_oleh FROM perkara_jadwal_sidang j
              WHERE j.perkara_id = pu.perkara_id AND j.tanggal_sidang = pu.tanggal_putusan
              ORDER BY j.id DESC LIMIT 1) AS dihadiriSaatPutus,
            (SELECT MAX(b.tanggal_pemberitahuan_putusan) FROM perkara_putusan_pemberitahuan_putusan b
              WHERE b.perkara_id = pu.perkara_id AND b.pihak = 1) AS pbtPihak1,
            (SELECT MAX(b.tanggal_pemberitahuan_putusan) FROM perkara_putusan_pemberitahuan_putusan b
              WHERE b.perkara_id = pu.perkara_id AND b.pihak = 2) AS pbtPihak2,
            EXISTS (SELECT 1 FROM perkara_pihak2 x WHERE x.perkara_id = pu.perkara_id) AS adaPihak2
       FROM perkara_putusan pu
       JOIN perkara p ON p.perkara_id = pu.perkara_id
      WHERE pu.tanggal_putusan BETWEEN ? AND ?
        AND pu.tanggal_bht IS NULL
        AND NOT EXISTS (SELECT 1 FROM perkara_banding bd
                         WHERE bd.perkara_id = pu.perkara_id AND bd.permohonan_banding IS NOT NULL)
      ORDER BY pu.tanggal_putusan ASC
      LIMIT 500`,
    [geserHari(acuan, -JENDELA_PUTUSAN_HARI), acuan]
  );

  const fakta = [];
  for (const b of baris) {
    const putusan = isoTanggal(b.tanggalPutusan);
    const jendela = appeal.computeAppealWindows({
      tanggalPutusan: putusan,
      tanggalBht: isoTanggal(b.tanggalBht),
      dihadiriOleh: b.dihadiriSaatPutus === null || b.dihadiriSaatPutus === undefined ? null : Number(b.dihadiriSaatPutus),
      verstek: String(b.verstek || "").toUpperCase() === "Y",
      pemberitahuan: { 1: isoTanggal(b.pbtPihak1), 2: isoTanggal(b.pbtPihak2) },
      adaPihak2: Number(b.adaPihak2) === 1,
      today: tengahHari(acuan),
    });
    for (const w of jendela) {
      if (w.status === "berjalan" || w.status === "habis") {
        fakta.push(
          rapikanBaru(b, {
            tanggalAcuan: w.tanggalMulai,
            tanggalBatas: w.tanggalBatas,
            pihakKe: w.pihakKe,
            dasarMulai: w.dasar,
            pasti: w.kehadiranPasti,
          })
        );
      } else if (w.status === "menunggu_beritahu") {
        fakta.push(
          rapikanBaru(b, {
            tanggalAcuan: putusan,
            pihakKe: w.pihakKe,
            dasarMulai: "pemberitahuan",
            menunggu: true,
          })
        );
      }
    }
  }
  return fakta;
}

/** Kolom pemberitahuan putusan banding yang mungkin ada di SIPP ini (daftar tetap, tidak dari masukan). */
const KOLOM_PBT_BANDING = Object.freeze([
  "pemberitahuan_putusan_banding",
  "pemberitahuan_putusan_banding_pembanding",
  "pemberitahuan_putusan_banding_terbanding",
]);

/**
 * 9. Masa kasasi 14 hari sejak putusan banding diberitahukan.
 *
 * Perkara yang putusan bandingnya terbaru (60 hari), belum BHT, dan belum ada permohonan kasasi. Tanpa
 * tanggal pemberitahuan: hanya catatan, tidak ada angka. Kolom SIPP yang tidak ada = aturan diam.
 */
async function kasasiMasa(acuan) {
  if (!(await penjawabKolom("perkara_banding", "putusan_banding"))) return [];
  const ada = [];
  for (const k of KOLOM_PBT_BANDING) {
    if (await penjawabKolom("perkara_banding", k)) ada.push(k);
  }
  const bacaPbt = ada.map((k, i) => `bd.${k} AS pbt${i}`).join(", ");
  const adaKasasi = await penjawabKolom("perkara_kasasi", "permohonan_kasasi");
  const baris = await jalankan(
    `SELECT p.perkara_id AS perkaraId, p.nomor_perkara AS nomorPerkara,
            p.jenis_perkara_nama AS jenisPerkara, p.alur_perkara_id AS alurPerkaraId,
            p.jenis_perkara_id AS jenisPerkaraId,
            bd.putusan_banding AS putusanBanding, pu.tanggal_bht AS tanggalBht
            ${bacaPbt ? `, ${bacaPbt}` : ""}
       FROM perkara_banding bd
       JOIN perkara p ON p.perkara_id = bd.perkara_id
       LEFT JOIN perkara_putusan pu ON pu.perkara_id = bd.perkara_id
      WHERE bd.putusan_banding IS NOT NULL
        AND bd.putusan_banding BETWEEN ? AND ?
        AND pu.tanggal_bht IS NULL
        ${adaKasasi ? "AND NOT EXISTS (SELECT 1 FROM perkara_kasasi k WHERE k.perkara_id = bd.perkara_id AND k.permohonan_kasasi IS NOT NULL)" : ""}
      ORDER BY bd.putusan_banding ASC
      LIMIT 300`,
    [geserHari(acuan, -JENDELA_PUTUSAN_HARI), acuan]
  );

  // Satu perkara dapat punya beberapa baris banding: yang terbaru yang dipakai.
  const terbaru = new Map();
  for (const b of baris) {
    const id = String(b.perkaraId);
    const lama = terbaru.get(id);
    if (!lama || isoTanggal(b.putusanBanding) > isoTanggal(lama.putusanBanding)) terbaru.set(id, b);
  }

  const fakta = [];
  for (const b of terbaru.values()) {
    // Pemberitahuan terakhir di antara kolom gabungan/per pihak: para pihak baru seluruhnya diberi tahu pada tanggal itu.
    const tanggal =
      ada
        .map((_k, i) => isoTanggal(b[`pbt${i}`]))
        .filter(Boolean)
        .sort()
        .pop() || "";
    const hitung = appeal.computeKasasiDeadline({
      tanggalPutusanBanding: isoTanggal(b.putusanBanding),
      tanggalPemberitahuan: tanggal,
      tanggalBht: isoTanggal(b.tanggalBht),
      today: tengahHari(acuan),
    });
    if (hitung.status === "berjalan" || hitung.status === "habis") {
      fakta.push(rapikanBaru(b, { tanggalAcuan: hitung.tanggalMulai, tanggalBatas: hitung.tanggalBatas, dasarMulai: "pemberitahuan", pasti: true }));
    } else if (hitung.status === "menunggu_beritahu") {
      fakta.push(rapikanBaru(b, { tanggalAcuan: isoTanggal(b.putusanBanding), dasarMulai: "pemberitahuan", menunggu: true }));
    }
  }
  return fakta;
}

/**
 * 10. Mediasi lewat 30 hari sejak penetapan perintah/penunjukan mediator, laporan mediator belum masuk.
 *
 * Perkara belum putus. Perpanjangan atas kesepakatan para pihak TIDAK dibaca (tidak ada kolomnya yang
 * dikenal) - karena itu butir ini hanya mengingatkan, dan penerimanya diminta memeriksa penetapan perpanjangan.
 */
async function mediasiBatas(acuan) {
  if (!(await penjawabKolom("perkara_mediasi", "tgl_laporan_mediator"))) return [];
  const baris = await jalankan(
    `SELECT p.perkara_id AS perkaraId, p.nomor_perkara AS nomorPerkara,
            p.jenis_perkara_nama AS jenisPerkara, p.alur_perkara_id AS alurPerkaraId,
            p.jenis_perkara_id AS jenisPerkaraId,
            m.penetapan_penunjukan_mediator AS tanggalAcuan, m.mediator_text AS mediator
       FROM perkara_mediasi m
       JOIN perkara p ON p.perkara_id = m.perkara_id
       LEFT JOIN perkara_putusan pu ON pu.perkara_id = m.perkara_id
      WHERE m.tgl_laporan_mediator IS NULL
        AND m.penetapan_penunjukan_mediator IS NOT NULL
        AND m.penetapan_penunjukan_mediator BETWEEN ? AND ?
        AND pu.tanggal_putusan IS NULL
      ORDER BY m.penetapan_penunjukan_mediator ASC
      LIMIT 300`,
    [geserHari(acuan, -JENDELA_MEDIASI_HARI), acuan]
  );
  // Satu perkara, satu butir: penetapan mediator TERBARU yang menentukan.
  const terbaru = new Map();
  for (const b of baris) {
    const id = String(b.perkaraId);
    const lama = terbaru.get(id);
    if (!lama || isoTanggal(b.tanggalAcuan) > isoTanggal(lama.tanggalAcuan)) terbaru.set(id, b);
  }
  return [...terbaru.values()].map((b) =>
    rapikanBaru(b, {
      tanggalBatas: geserHari(isoTanggal(b.tanggalAcuan), BATAS_MEDIASI_HARI),
      mediator: teksBersih(b.mediator),
    })
  );
}

/* -------------------------------------------------------------------------- */
/* PETUGAS PERKARA - supaya pengingat per orang hanya memuat perkara miliknya  */
/* -------------------------------------------------------------------------- */

const UKURAN_POTONGAN = 300;

async function bacaNamaPetugas(tabel, kolomNama, ids) {
  const hasil = new Map();
  for (let i = 0; i < ids.length; i += UKURAN_POTONGAN) {
    const potong = ids.slice(i, i + UKURAN_POTONGAN);
    const baris = await jalankan(
      `SELECT perkara_id AS perkaraId, ${kolomNama} AS nama FROM ${tabel}
        WHERE aktif = 'Y' AND perkara_id IN (${potong.map(() => "?").join(", ")})`,
      potong
    );
    for (const b of baris) {
      const id = String(b.perkaraId);
      const nama = teksBersih(b.nama);
      if (!nama) continue;
      const daftar = hasil.get(id) || [];
      if (!daftar.includes(nama)) daftar.push(nama);
      hasil.set(id, daftar);
    }
  }
  return hasil;
}

/**
 * Menempelkan majelis, panitera pengganti, dan jurusita aktif ke fakta (teks dipisah koma). Pembacaan
 * satu tabel yang gagal hanya mengosongkan ruasnya - fakta tetap dipulangkan, dan penerima pribadi
 * HANYA menerima perkara yang namanya tercantum (tanpa nama = tidak diingatkan, tidak "ke semua").
 */
async function lampirkanPetugas(semuaFakta) {
  const ids = [
    ...new Set(
      Object.values(semuaFakta)
        .flat()
        .map((f) => String(f.perkaraId || ""))
        .filter(Boolean)
    ),
  ];
  const gagal = {};
  if (!ids.length) return { gagal };
  const baca = async (kunci, tabel, kolom) => {
    try {
      return await bacaNamaPetugas(tabel, kolom, ids);
    } catch (galat) {
      gagal[kunci] = String((galat && galat.message) || galat).slice(0, 200);
      return new Map();
    }
  };
  const [hakim, panitera, jurusita] = await Promise.all([
    baca("petugas-majelis", "perkara_hakim_pn", "hakim_nama"),
    baca("petugas-panitera", "perkara_panitera_pn", "panitera_nama"),
    baca("petugas-jurusita", "perkara_jurusita", "jurusita_nama"),
  ]);
  for (const daftar of Object.values(semuaFakta)) {
    for (const f of daftar) {
      const id = String(f.perkaraId || "");
      f.majelis = (hakim.get(id) || []).join(", ");
      f.panitera = (panitera.get(id) || []).join(", ");
      f.jurusita = (jurusita.get(id) || []).join(", ");
    }
  }
  return { gagal };
}

/**
 * Batas ikrar TEGAS (6 bulan kalender sejak PHS ikrar, ikrarTalakService.batasEnamBulanIkrar) untuk fakta
 * aturan ikrar-talak. Mesin aturan memakai tanggal ini bila ada (180 hari hanya cadangan). Layanan ikrar
 * dimuat malas dan kegagalannya tidak menjatuhkan penjaga tenggat.
 */
function pasangBatasIkrarTegas(daftar) {
  let batasEnam = null;
  try {
    batasEnam = require("./ikrarTalakService").batasEnamBulanIkrar;
  } catch {
    batasEnam = null;
  }
  for (const f of daftar) {
    const batas = batasEnam ? batasEnam({ tanggalPenetapanSidangIkrar: f.tanggalAcuan }) : "";
    if (batas) f.tanggalBatas = batas;
  }
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
const PEMBACA_BARU = {
  "banding-14-hari": bandingMasa,
  "kasasi-14-hari": kasasiMasa,
  "mediasi-30-hari": mediasiBatas,
};

/**
 * Membaca seluruh fakta tenggat untuk satu tanggal acuan.
 *
 * Tiap pembaca GAGAL SENDIRI-SENDIRI. Satu tabel yang tidak ada pada
 * pemasangan tertentu - perkara_ikrar_talak pada pengadilan negeri, misalnya -
 * tidak boleh menghilangkan enam aturan lainnya; ia hanya membuat aturannya
 * sendiri diam, dan sebabnya disebut.
 *
 * `opsi.baru` (G1): ikut membaca banding/kasasi/mediasi, menempelkan petugas perkara, dan memberi batas
 * ikrar tegas. Tanpa `baru` hasilnya persis seperti sebelum G1 (bentuk dan isi).
 */
async function bacaFakta(acuanIso, opsi = {}) {
  const acuan = isoTanggal(acuanIso) || isoTanggal(new Date());
  const fakta = {};
  const gagal = {};
  const baru = Boolean(opsi && opsi.baru);
  const pembaca = baru ? { ...PEMBACA, ...PEMBACA_BARU } : PEMBACA;

  await Promise.all(
    Object.entries(pembaca).map(async ([kode, baca]) => {
      try {
        fakta[kode] = await baca(acuan);
      } catch (galat) {
        fakta[kode] = [];
        gagal[kode] = String((galat && galat.message) || galat).slice(0, 200);
      }
    })
  );

  if (baru) {
    pasangBatasIkrarTegas(fakta["ikrar-talak"] || []);
    Object.assign(gagal, (await lampirkanPetugas(fakta)).gagal);
  }

  return { acuan, fakta, gagal };
}

module.exports = {
  BATAS_MEDIASI_HARI,
  CAKRAWALA_BULAN,
  JENDELA_MEDIASI_HARI,
  JENDELA_PUTUSAN_HARI,
  STATUS_DIKABULKAN,
  bacaFakta,
  isoTanggal,
  mundurBulan,
  pasangSumber,
  // Dibuka satu per satu supaya tiap aturan dapat diukur sendiri saat
  // angkanya dicurigai, tanpa menjalankan ketujuhnya.
  pembaca: PEMBACA,
  pembacaBaru: PEMBACA_BARU,
};
