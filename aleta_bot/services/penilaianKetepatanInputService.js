"use strict";

/**
 * ============================================================================
 * KETEPATAN WAKTU PENGINPUTAN - JARAK ANTARA PERISTIWA DAN SAAT DIKETIK
 * ============================================================================
 *
 * Sebelas butir ketaatan yang sudah ada mengukur TANGGAL PERISTIWANYA:
 * penetapan majelis bertanggal berapa, putusan diucapkan tanggal berapa,
 * dibandingkan dengan tanggal pendaftaran. Itu ukuran yang sah dan memang
 * diminta SK.
 *
 * Tetapi ia diam tentang satu hal yang sama pentingnya. Penetapan yang
 * BERTANGGAL 3 Januari tetapi baru DIKETIK ke SIPP pada 20 Januari terbaca
 * patuh sempurna - jaraknya nol hari dari pendaftaran - padahal selama tujuh
 * belas hari itu SIPP tidak memuat keterangan yang seharusnya sudah ada.
 * Siapa pun yang membuka perkara itu selama tujuh belas hari melihat perkara
 * yang belum bermajelis.
 *
 * Lima butir katalog e-Audit menyebutkan kekurangan ini sendiri, dengan
 * kalimat yang hampir sama: "Butir ini menuntut tanggal PENGINPUTAN. Yang
 * dinilai tanggal penetapannya, dan keduanya dapat berbeda jauh."
 *
 * ============================================================================
 * DATANYA SUDAH ADA, DAN ATURANNYA PUN SUDAH ADA
 * ============================================================================
 *
 * SIPP menyimpan diinput_tanggal pada tabel-tabel perkaranya - kolom jejak
 * yang menyebutkan kapan barisnya diketik. Yang tidak pernah ada: pembacanya
 * di mesin penilaian.
 *
 * Dan skala nilainya pun sudah ada, terkubur di dalam satu kueri pemberitahuan
 * WhatsApp harian di notifikasi.js:
 *
 *     0 hari -> 5,  1 hari -> 3,  2 hari -> 2,  3 hari -> 1,  selebihnya -> 0
 *
 * Aturan yang hidup di dalam satu kueri pemberitahuan tidak dapat diuji, tidak
 * dapat disandingkan, dan tidak muncul di rapor mana pun. Ia dipakai tiap hari
 * dan tidak pernah dapat dipertanggungjawabkan. Di sini ia diangkat menjadi
 * fungsi murni - dan begitu murni, ia dapat diuji tanpa SIPP sama sekali.
 *
 * ============================================================================
 * SKALANYA DIPAKAI SEBAGAI KETERANGAN, AMBANGNYA YANG MENILAI
 * ============================================================================
 *
 * Kerangka penilaian menghitung pembilang dan penyebut: tiap baris memenuhi
 * atau tidak. Skala lima tingkat tidak masuk ke dalam bentuk itu.
 *
 * Karena itu keduanya dipakai bersama, masing-masing pada tempatnya:
 *
 *   ambang ketepatanInput   memutuskan MEMENUHI atau tidak - inilah angkanya
 *   skala lima tingkat      menerangkan SEBERAPA pada tiap baris bukti
 *
 * Baris bukti karena itu tetap menyebutkan "terlambat 6 hari" alih-alih
 * sekadar "tidak memenuhi". Angka yang tidak dapat dibuka menjadi keterangan
 * sebesar itu tidak menolong siapa pun memperbaiki apa pun.
 */

const db = require("../db_config");
const sippSkemaService = require("./sippSkemaService");
const ambang = require("./ambangPenilaianService");
const kerangka = require("./kerangkaPenilaianService");

/** Batas baris bukti per satu pembacaan. */
const BATAS_BARIS = 5000;

/**
 * Skala nilai ketepatan, disalin apa adanya dari pemberitahuan harian ALETA.
 *
 * Disimpan sebagai daftar bertingkat, bukan rantai if: bentuk daftar dapat
 * ditampilkan di layar apa adanya, dan skala yang dapat dibaca orang adalah
 * skala yang dapat dibantah orang.
 */
const SKALA = [
  { sampaiHari: 0, nilai: 5, sebutan: "hari yang sama" },
  { sampaiHari: 1, nilai: 3, sebutan: "keesokan harinya" },
  { sampaiHari: 2, nilai: 2, sebutan: "dua hari" },
  { sampaiHari: 3, nilai: 1, sebutan: "tiga hari" },
];

/** Nilai skala untuk satu selisih hari. Murni - tidak menyentuh apa pun. */
function nilaiSkala(selisihHari) {
  // ==========================================================================
  // KOSONG DITOLAK LEBIH DAHULU - Number(null) ADALAH NOL
  // ==========================================================================
  //
  // Tanpa baris ini, baris yang TIDAK PUNYA jejak sama sekali - jaraknya null -
  // akan bernilai LIMA, yaitu "diinput pada hari yang sama". Nilai sempurna
  // untuk baris yang justru tidak dapat dipertanggungjawabkan kapan masuknya.
  //
  // Number("") juga nol, dan Number(false) juga nol. Ketiganya harus ditolak
  // sebelum diangkakan, bukan sesudahnya.
  if (selisihHari === null || selisihHari === undefined || selisihHari === "") return null;
  if (typeof selisihHari === "boolean") return null;

  const n = Number(selisihHari);
  if (!Number.isFinite(n)) return null;

  // Selisih negatif berarti barisnya diketik SEBELUM peristiwanya terjadi.
  // Itu bukan ketepatan yang luar biasa - itu tanggal yang keliru, dan
  // menilainya sempurna akan menyembunyikan justru temuan yang paling perlu
  // dilihat.
  if (n < 0) return null;

  for (const tingkat of SKALA) {
    if (n <= tingkat.sampaiHari) return tingkat.nilai;
  }
  return 0;
}

/** Sebutan jarak yang dapat dibaca orang. */
function sebutanJarak(selisihHari) {
  const n = Number(selisihHari);
  if (!Number.isFinite(n)) return "tidak dapat dihitung";
  if (n < 0) return `diketik ${Math.abs(n)} hari SEBELUM peristiwanya`;
  const tingkat = SKALA.find((x) => n <= x.sampaiHari);
  return tingkat ? tingkat.sebutan : `${n} hari sesudahnya`;
}

/**
 * ============================================================================
 * PERISTIWA YANG DIUKUR
 * ============================================================================
 *
 * tabel      - tabel SIPP yang memuat peristiwanya
 * ruas       - kolom tanggal peristiwanya
 * ruasInput  - kolom jejak yang menyebutkan kapan barisnya diketik
 * kode       - butir katalog e-Audit yang bersangkutan, untuk penelusuran
 *
 * Yang didaftarkan hanya peristiwa yang tabelnya sudah dipakai penilaian lain
 * di ALETA - jadi nama tabel dan kolom tanggalnya sudah terbukti benar. Yang
 * belum terbukti hanya keberadaan kolom jejaknya, dan itu diperiksa sendiri
 * sebelum dipakai.
 */
const PERISTIWA = [
  {
    kunci: "ketepatanInputPenetapanMajelis",
    kode: "KT02",
    judul: "Ketepatan Penginputan Penetapan Majelis",
    keterangan:
      "Jarak antara tanggal penetapan majelis dan saat penetapan itu diketik ke SIPP.",
    tabel: "perkara_hakim_pn",
    ruas: "tanggal_penetapan",
  },
  {
    kunci: "ketepatanInputPaniteraPengganti",
    kode: "KT03",
    judul: "Ketepatan Penginputan Penunjukan Panitera Pengganti",
    keterangan:
      "Jarak antara tanggal penunjukan panitera pengganti dan saat penunjukan itu diketik ke SIPP.",
    tabel: "perkara_panitera_pn",
    ruas: "tanggal_penetapan",
  },
  {
    kunci: "ketepatanInputJurusita",
    kode: "KT04",
    judul: "Ketepatan Penginputan Penunjukan Jurusita",
    keterangan:
      "Jarak antara tanggal penunjukan jurusita dan saat penunjukan itu diketik ke SIPP.",
    tabel: "perkara_jurusita",
    ruas: "tanggal_penetapan",
  },
  {
    kunci: "ketepatanInputPutusan",
    kode: "KT11",
    judul: "Ketepatan Penginputan Putusan",
    keterangan:
      "Jarak antara tanggal putusan diucapkan dan saat putusan itu diketik ke SIPP.",
    tabel: "perkara_putusan",
    ruas: "tanggal_putusan",
  },
];

/** Kolom jejak SIPP. Sama pada seluruh tabel perkaranya. */
const RUAS_INPUT = "diinput_tanggal";

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

/** Tanggal apa adanya sebagai YYYY-MM-DD, atau kosong. */
function tanggalIso(nilai) {
  if (!nilai) return "";
  if (nilai instanceof Date) {
    if (Number.isNaN(nilai.getTime())) return "";
    const b = (x) => String(x).padStart(2, "0");
    return `${nilai.getFullYear()}-${b(nilai.getMonth() + 1)}-${b(nilai.getDate())}`;
  }
  const teksnya = String(nilai).trim();
  const cocok = teksnya.match(/^(\d{4}-\d{2}-\d{2})/);
  return cocok ? cocok[1] : "";
}

/** Selisih hari kalender antara dua tanggal ISO. Murni. */
function selisihHari(dari, sampai) {
  if (!dari || !sampai) return null;
  const a = Date.parse(`${dari}T00:00:00Z`);
  const b = Date.parse(`${sampai}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.round((b - a) / 86400000);
}

function susunKueri(p) {
  return `SELECT p.perkara_id AS perkaraId,
                 p.nomor_perkara AS nomorPerkara,
                 p.jenis_perkara_nama AS jenisPerkara,
                 x.${p.ruas} AS peristiwa,
                 x.${RUAS_INPUT} AS diinput,
                 (SELECT MAX(hk.hakim_nama) FROM perkara_hakim_pn hk WHERE hk.perkara_id = p.perkara_id) AS hakim,
                 (SELECT MAX(pp.panitera_nama) FROM perkara_panitera_pn pp WHERE pp.perkara_id = p.perkara_id) AS paniteraPengganti,
                 (SELECT MAX(js.jurusita_nama) FROM perkara_jurusita js WHERE js.perkara_id = p.perkara_id) AS jurusita
            FROM perkara p
            JOIN ${p.tabel} x ON x.perkara_id = p.perkara_id
           WHERE p.tanggal_pendaftaran >= ? AND p.tanggal_pendaftaran <= ?
           ORDER BY p.tanggal_pendaftaran ASC
           LIMIT ${BATAS_BARIS}`;
}

/** Baris bukti satu butir. */
function pembangunBaris(p) {
  return async function baris(rentang) {
    // ========================================================================
    // KOLOM JEJAKNYA DIPERIKSA ADA-TIDAKNYA LEBIH DAHULU
    // ========================================================================
    //
    // SIPP berbeda antar versi, dan ALETA dapat dipasang di satker lain.
    // Kueri atas kolom yang tidak ada melempar galat, dan galat di dalam satu
    // penilaian akan terbaca seperti perkaranya yang bermasalah.
    //
    // Yang dipulangkan pada keadaan itu daftar KOSONG, bukan nol - penilaian
    // tanpa baris tidak punya penyebut, sehingga ia tidak menghasilkan angka
    // sama sekali alih-alih menghasilkan angka nol yang menuduh.
    const punyaJejak = await sippSkemaService
      .kolomAda(p.tabel, RUAS_INPUT)
      .catch(() => false);
    if (!punyaJejak) return [];

    const hasil = await runQuery(susunKueri(p), [rentang.mulai, rentang.selesai]);
    const berlaku = ambang.ambangBerlaku("ketepatanInput", rentang.selesai);
    const batas = berlaku && berlaku.nilai !== null ? berlaku.nilai : 1;

    return hasil
      .map((r) => {
        const peristiwa = tanggalIso(r.peristiwa);
        const diinput = tanggalIso(r.diinput);

        // Peristiwa yang belum terjadi tidak dapat dinilai ketepatan
        // penginputannya. Ia bukan terlambat - ia belum ada, dan itu urusan
        // butir ketaatan yang lain.
        if (!peristiwa) return null;

        // Baris yang tidak membawa jejak sama sekali TETAP dihitung, dan
        // dihitung TIDAK memenuhi. Ketiadaan jejak berarti tidak ada yang
        // dapat mempertanggungjawabkan kapan keterangan itu masuk - dan
        // mengeluarkannya dari penyebut akan membuat pengadilan yang jejaknya
        // paling banyak hilang justru bernilai paling baik.
        const jarak = diinput ? selisihHari(peristiwa, diinput) : null;
        const mendahului = jarak !== null && jarak < 0;
        const memenuhi = jarak !== null && jarak >= 0 && jarak <= batas;

        let sebab = "";
        if (!diinput) sebab = "tidak ada jejak kapan diinput";
        else if (mendahului) sebab = sebutanJarak(jarak);
        else if (!memenuhi) sebab = `diinput ${sebutanJarak(jarak)}, melewati batas ${batas} hari`;

        return {
          kunci: `${teks(r.nomorPerkara)}#${p.kode}`,
          nomorPerkara: teks(r.nomorPerkara),
          jenisPerkara: teks(r.jenisPerkara),
          hakim: teks(r.hakim),
          paniteraPengganti: teks(r.paniteraPengganti),
          jurusita: teks(r.jurusita),
          tanggalPeristiwa: peristiwa,
          tanggalDiinput: diinput,
          jarakHari: jarak,
          // Skala lima tingkat sebagai KETERANGAN, bukan sebagai nilainya.
          nilaiSkala: nilaiSkala(jarak),
          sebutanJarak: diinput ? sebutanJarak(jarak) : "tidak ada jejaknya",
          batasHari: batas,
          memenuhi,
          sebabTidakMemenuhi: memenuhi ? "" : sebab,
        };
      })
      .filter(Boolean);
  };
}

let sudahDidaftar = false;

/** Mendaftarkan seluruh butir ketepatan input ke kerangka penilaian. */
function daftarkanSemua() {
  if (sudahDidaftar) return PERISTIWA.map((p) => p.kunci);

  PERISTIWA.forEach((p) => {
    if (kerangka.ambil(p.kunci)) return;
    kerangka.daftarkan({
      kunci: p.kunci,
      judul: p.judul,
      keterangan: p.keterangan,
      lantai: "bulanan",
      versiRumus: "ketepatan-input-v1",
      ambangDipakai: ["ketepatanInput"],
      caraHitung: {
        pembilang: `Baris ${p.tabel} yang ${RUAS_INPUT}-nya tidak lebih dari ambang hari sesudah ${p.ruas}`,
        penyebut: `Seluruh baris ${p.tabel} milik perkara yang didaftarkan pada rentang ini dan sudah punya ${p.ruas}`,
        dikecualikan: `Baris yang ${p.ruas}-nya belum ada - peristiwanya belum terjadi, sehingga ketepatan penginputannya tidak dapat dinilai. Baris yang ${RUAS_INPUT}-nya kosong TIDAK dikecualikan; ia dihitung tidak memenuhi, sebab tanpa jejak tidak ada yang dapat mempertanggungjawabkan kapan keterangan itu masuk.`,
        tabelSumber: `perkara, ${p.tabel}`,
        ruasSumber: `tanggal_pendaftaran, ${p.ruas}, ${RUAS_INPUT}`,
      },
      baris: pembangunBaris(p),
    });
  });

  sudahDidaftar = true;
  return PERISTIWA.map((p) => p.kunci);
}

/** Dilupakan supaya dapat didaftarkan ulang pada pengujian. */
function lupakanSemua() {
  sudahDidaftar = false;
}

module.exports = {
  BATAS_BARIS,
  PERISTIWA,
  RUAS_INPUT,
  SKALA,
  daftarkanSemua,
  lupakanSemua,
  nilaiSkala,
  sebutanJarak,
  selisihHari,
  susunKueri,
};
