/**
 * Rubrik ALETA - pelengkap SK Penilaian SIPP, bukan penggantinya.
 *
 * ============================================================================
 * NILAI RESMI ADA DI penilaianSippService.js
 * ============================================================================
 *
 * Kriteria resmi SK Dirjen Badilag Nomor 048/DJA/SK.KP3.4.3/IV/2024 sudah
 * dikerjakan tersendiri di services/penilaianSippService.js, lengkap dengan
 * bobot, skala poin, rumus, predikat, dan kode warnanya. Itulah yang dipakai
 * bila yang ditanya nilai SIPP.
 *
 * Berkas ini menilai hal-hal yang TIDAK diatur SK tetapi diperlukan pengadilan
 * sehari-hari - kepatutan panggilan menurut SK KMA 363/2022, kelengkapan nomor
 * kontak para pihak, dan kesiapan berkas sidang. Bobot dan ambangnya
 * seluruhnya dapat diatur dari layar.
 *
 * Keduanya sengaja tidak dijumlahkan. Mencampur nilai resmi dengan penilaian
 * sendiri menghasilkan satu angka yang tidak dapat dipertanggungjawabkan
 * kepada siapa pun: bukan nilai Badilag, bukan pula ukuran ALETA.
 *
 * ============================================================================
 * TIGA KEADAAN, BUKAN DUA
 * ============================================================================
 *
 * Butir yang datanya SEHARUSNYA ada tetapi kosong dinilai NOL, bukan dilewati.
 * Perkara yang datanya kosong akan bernilai rendah - dan memang itulah
 * keadaannya.
 *
 * Tetapi ada keadaan ketiga yang berbeda sama sekali: butir yang BELUM
 * WAKTUNYA. Perkara yang baru ditetapkan majelisnya belum punya sidang yang
 * berlalu, jadi belum ada Berita Acara Sidang yang tertinggal; belum diputus,
 * jadi belum ada naskah putusan yang belum diunggah dan belum ada tenggang
 * minutasi yang terlewat. Menilainya nol berarti menghukum perkara karena
 * kalendernya, bukan karena pekerjaannya.
 *
 * Dulu ketiganya hanya dua: apa pun yang tidak dapat dinilai bernilai nol dan
 * TETAP dihitung sebagai pembagi. Akibatnya perkara yang baru didaftarkan -
 * majelis lengkap, panitera lengkap, pihak bernomor, tidak satu pun keliru -
 * bernilai 45 dari 100 dan berpredikat "kurang", sebab 55 poin hangus untuk
 * hal yang belum mungkin ada. Petugas yang membacanya diberi tahu ada yang
 * salah pada perkara yang justru dikerjakan dengan benar, dan angka yang
 * selalu merah berhenti dibaca.
 *
 * Karena itu butir yang belum waktunya kini dikeluarkan dari pembilang DAN
 * pembagi. Ia tetap ditampilkan beserta sebabnya - supaya terlihat bahwa ia
 * memang belum dinilai, bukan diam-diam dihilangkan - tetapi tidak menyeret
 * nilai perkara ke bawah.
 */

const { readRuntimeConfig, writeRuntimeConfig } = require("../config/runtime-config");
const logService = require("./logService");

/**
 * Butir penilaian beserta bawaannya.
 *
 * dasar - keterangan singkat dari mana angka itu berasal, ditampilkan di layar
 *         supaya dapat ditelusuri dan diperbaiki.
 */
const BUTIR = [
  {
    kunci: "lamaPenyelesaian",
    label: "Lama penyelesaian perkara",
    keterangan: "Dihitung dari pendaftaran sampai putusan. Perkara berjalan dihitung sampai hari ini.",
    dasar: "Mengikuti skala waktu putus SK 048/2024: 3 bulan bernilai penuh, lebih dari 5 bulan bernilai nol. Nilai resmi SK-nya ada pada penilaianSippService.",
    bobot: 25,
  },
  {
    kunci: "majelisDitetapkan",
    label: "Majelis dan panitera ditetapkan",
    keterangan: "Majelis hakim dan panitera sidang sudah tercatat pada perkara.",
    dasar: "Rubrik ALETA.",
    bobot: 10,
  },
  {
    kunci: "pihakLengkap",
    label: "Identitas pihak lengkap",
    keterangan: "Nama para pihak tercatat, dan nomor kontaknya dapat dipakai.",
    dasar: "Rubrik ALETA.",
    bobot: 10,
  },
  {
    kunci: "panggilanPatut",
    label: "Panggilan patut",
    keterangan: "Seluruh pihak dipanggil lewat jalur yang sesuai dan dalam tenggang yang cukup.",
    dasar: "SK KMA 363/2022 dan Pasal 122 HIR - lihat pengaturan tenggang panggilan.",
    bobot: 20,
  },
  {
    kunci: "basDiunggah",
    label: "Berita Acara Sidang diunggah",
    keterangan: "Tiap sidang yang sudah berlalu punya BAS tersimpan.",
    dasar: "Rubrik ALETA.",
    bobot: 10,
  },
  {
    kunci: "putusanDiunggah",
    label: "Naskah putusan diunggah",
    keterangan: "Perkara yang sudah diputus punya naskah putusan dan naskah anonimnya.",
    dasar: "Rubrik ALETA.",
    bobot: 10,
  },
  {
    kunci: "minutasiTepat",
    label: "Minutasi tepat waktu",
    keterangan: "Berkas diminutasi dalam tenggang setelah putusan.",
    dasar: "Rubrik ALETA - ambang harinya diisi pengadilan.",
    bobot: 15,
  },
];

const BAWAAN = {
  /** Bulan penyelesaian yang masih bernilai penuh. */
  bulanPenuh: 3,
  /** Bulan penyelesaian yang bernilai nol. */
  bulanNol: 5,
  /** Hari sejak putusan sampai minutasi yang masih dinilai tepat. */
  hariMinutasi: 14,
  /** Bobot tiap butir, dapat diubah dari layar. */
  bobot: Object.fromEntries(BUTIR.map((b) => [b.kunci, b.bobot])),
};

function angka(nilai, bawaan, min, maks) {
  const n = Number(nilai);
  if (!Number.isFinite(n)) return bawaan;
  return Math.min(Math.max(Math.floor(n), min), maks);
}

function getSettings() {
  const tersimpan = (readRuntimeConfig() || {}).penilaianPerkara || {};
  const bobot = {};
  for (const butir of BUTIR) {
    bobot[butir.kunci] = angka((tersimpan.bobot || {})[butir.kunci], butir.bobot, 0, 100);
  }
  return {
    bulanPenuh: angka(tersimpan.bulanPenuh, BAWAAN.bulanPenuh, 1, 24),
    bulanNol: angka(tersimpan.bulanNol, BAWAAN.bulanNol, 1, 36),
    hariMinutasi: angka(tersimpan.hariMinutasi, BAWAAN.hariMinutasi, 1, 180),
    bobot,
  };
}

function saveSettings({ bulanPenuh, bulanNol, hariMinutasi, bobot = {}, olehSiapa = "" } = {}) {
  const isi = {
    bulanPenuh: angka(bulanPenuh, BAWAAN.bulanPenuh, 1, 24),
    bulanNol: angka(bulanNol, BAWAAN.bulanNol, 1, 36),
    hariMinutasi: angka(hariMinutasi, BAWAAN.hariMinutasi, 1, 180),
    bobot: {},
  };

  for (const butir of BUTIR) {
    isi.bobot[butir.kunci] = angka(bobot[butir.kunci], butir.bobot, 0, 100);
  }

  if (isi.bulanNol <= isi.bulanPenuh) {
    return { ok: false, alasan: "bulan_nol_harus_lebih_besar" };
  }

  const sekarang = readRuntimeConfig();
  writeRuntimeConfig({ ...sekarang, penilaianPerkara: isi });

  void logService.logSecurityEvent({
    eventType: "penilaian_perkara_disunting",
    severity: "warning",
    message: "Rubrik penilaian perkara diubah.",
    metadata: { ...isi, olehSiapa: String(olehSiapa || "") },
  });

  return { ok: true, alasan: "", pengaturan: isi };
}

/**
 * Nilai lama penyelesaian, dari penuh ke nol secara bertahap.
 *
 * Di antara kedua ambang nilainya menurun mendatar, bukan melompat: perkara
 * empat bulan berbeda keadaannya dari perkara lima bulan, dan menyamakan
 * keduanya menghilangkan peringatan dini.
 */
function nilaiLama(hariBerjalan, pengaturan) {
  if (hariBerjalan === null || hariBerjalan === undefined) return null;

  const penuh = pengaturan.bulanPenuh * 30;
  const nol = pengaturan.bulanNol * 30;

  if (hariBerjalan <= penuh) return 1;
  if (hariBerjalan >= nol) return 0;
  return Math.max(0, Math.min(1, (nol - hariBerjalan) / (nol - penuh)));
}

/**
 * Menilai satu perkara.
 *
 * @param {{
 *   hariBerjalan: number|null, sudahPutus: boolean,
 *   majelis: Array, panitera: Array,
 *   pihak: Array, nomorPihakBermasalah: number,
 *   panggilan: { jumlahPihak: number, patut: number }|null,
 *   sidangLewat: number, basAda: number,
 *   adaBerkasPutusan: boolean, adaBerkasAnonim: boolean,
 *   hariMinutasi: number|null, hariSejakPutus?: number|null,
 * }} fakta
 */
function nilaiPerkara(fakta = {}) {
  const pengaturan = getSettings();
  const rinci = [];

  /**
   * @param {string} kunci
   * @param {number|null} nilai 0..1, atau null bila datanya seharusnya ada tetapi kosong
   * @param {string} keterangan
   * @param {{ berlaku?: boolean }} [opsi] berlaku:false = belum waktunya dinilai
   */
  const catat = (kunci, nilai, keterangan, opsi = {}) => {
    const acuan = BUTIR.find((b) => b.kunci === kunci);
    const bobot = pengaturan.bobot[kunci] || 0;
    const berlaku = opsi.berlaku !== false;

    // Butir yang datanya seharusnya ada tetapi kosong bernilai NOL dan tetap
    // dihitung. Butir yang BELUM WAKTUNYA tidak dihitung sama sekali.
    const bagian = !berlaku ? 0 : nilai === null ? 0 : Math.max(0, Math.min(1, nilai));

    rinci.push({
      kunci,
      label: acuan.label,
      keterangan: acuan.keterangan,
      dasar: acuan.dasar,
      bobot,
      bagian,
      nilai: berlaku ? Math.round(bobot * bagian * 10) / 10 : 0,
      catatan: keterangan,
      /** Ikut menentukan skor. Yang belum waktunya tidak. */
      dihitung: berlaku,
      /** Belum waktunya dinilai - bukan kekurangan perkara ini. */
      belumBerlaku: !berlaku,
      /** Datanya seharusnya ada tetapi kosong; dinilai nol. */
      belumDinilai: berlaku && nilai === null,
    });
  };

  // --- lama penyelesaian ---
  //
  // Dinilai atas HARI BERSIH bila pemanggilnya mengirimkannya: hari
  // pendaftaran ikut dihitung, lama mediasi dipotong - persis cara SK
  // menghitung, dan persis angka yang ditampilkan besar di layar beserta
  // warnanya. Menilai hari mentah sementara layar mewarnai hari bersih
  // membuat perkara bermediasi tampil hijau tetapi kehilangan bobot, padahal
  // potongan mediasi memang disediakan untuk melindunginya.
  const hariDinilai = Number.isFinite(Number(fakta.hariBersih))
    ? Number(fakta.hariBersih)
    : fakta.hariBerjalan;
  const lama = nilaiLama(hariDinilai, pengaturan);
  const adaPotonganMediasi =
    Number.isFinite(Number(fakta.hariBersih)) &&
    Number.isFinite(Number(fakta.hariBerjalan)) &&
    Number(fakta.hariBersih) !== Number(fakta.hariBerjalan) + 1;
  catat(
    "lamaPenyelesaian",
    lama,
    hariDinilai === null || hariDinilai === undefined
      ? "Tanggal pendaftaran belum tercatat."
      : `${hariDinilai} hari bersih${fakta.sudahPutus ? " sampai putusan" : " dan masih berjalan"}` +
        (adaPotonganMediasi ? ` (dari ${fakta.hariBerjalan} hari, lama mediasi dipotong).` : ".")
  );

  // --- majelis dan panitera ---
  const adaMajelis = Array.isArray(fakta.majelis) && fakta.majelis.length > 0;
  const adaPanitera = Array.isArray(fakta.panitera) && fakta.panitera.length > 0;
  catat(
    "majelisDitetapkan",
    (adaMajelis ? 0.6 : 0) + (adaPanitera ? 0.4 : 0),
    adaMajelis && adaPanitera
      ? "Majelis dan panitera sudah ditetapkan."
      : !adaMajelis
        ? "Majelis belum ditetapkan."
        : "Panitera sidang belum ditunjuk."
  );

  // --- identitas pihak ---
  const jumlahPihak = Array.isArray(fakta.pihak) ? fakta.pihak.length : 0;
  if (jumlahPihak === 0) {
    catat("pihakLengkap", null, "Pihak belum tercatat.");
  } else {
    const bermasalah = Number(fakta.nomorPihakBermasalah) || 0;
    catat(
      "pihakLengkap",
      Math.max(0, 1 - bermasalah / jumlahPihak),
      bermasalah > 0 ? `${bermasalah} dari ${jumlahPihak} pihak tanpa nomor yang dapat dipakai.` : "Lengkap."
    );
  }

  const sidangLewat = Number(fakta.sidangLewat) || 0;

  // --- panggilan ---
  //
  // Sebelum sidang pertama berlangsung, belum ada panggilan yang jatuh tempo -
  // dan tidak ada yang dapat dinilai patut atau tidak. Sesudah ada sidang yang
  // berlalu, ketiadaan data panggilan JUSTRU kekurangan: para pihak dipanggil,
  // catatannya yang tidak ada.
  if (sidangLewat === 0) {
    catat("panggilanPatut", null, "Belum ada sidang yang berlalu, jadi belum ada panggilan yang jatuh tempo.", {
      berlaku: false,
    });
  } else if (!fakta.panggilan || fakta.panggilan.jumlahPihak === 0) {
    catat("panggilanPatut", null, "Sidang sudah berlalu, tetapi keadaan panggilannya tidak terbaca.");
  } else {
    catat(
      "panggilanPatut",
      fakta.panggilan.patut / fakta.panggilan.jumlahPihak,
      `${fakta.panggilan.patut} dari ${fakta.panggilan.jumlahPihak} pihak dipanggil patut.`
    );
  }

  // --- BAS ---
  if (sidangLewat === 0) {
    catat("basDiunggah", null, "Belum ada sidang yang berlalu.", { berlaku: false });
  } else {
    const basAda = Number(fakta.basAda) || 0;
    catat("basDiunggah", basAda / sidangLewat, `${basAda} dari ${sidangLewat} sidang punya BAS.`);
  }

  // --- naskah putusan ---
  if (!fakta.sudahPutus) {
    catat("putusanDiunggah", null, "Perkara belum diputus.", { berlaku: false });
  } else {
    const nilai = (fakta.adaBerkasPutusan ? 0.6 : 0) + (fakta.adaBerkasAnonim ? 0.4 : 0);
    catat(
      "putusanDiunggah",
      nilai,
      fakta.adaBerkasPutusan && fakta.adaBerkasAnonim
        ? "Naskah putusan dan anonimnya tersedia."
        : fakta.adaBerkasPutusan
          ? "Naskah anonim belum diunggah."
          : "Naskah putusan belum diunggah."
    );
  }

  // --- minutasi ---
  //
  // Tiga keadaan yang harus dibedakan, dan dulu hanya dua. Berkas yang belum
  // diminutasi SEHARI setelah putusan dinilai nol persis seperti berkas yang
  // sudah dua bulan terlambat - padahal tenggangnya masih berjalan dan belum
  // ada yang dilanggar. Perkara yang baru diputus karena itu selalu turun
  // nilainya seketika, tanpa satu pun kelalaian.
  const ambangMinutasi = pengaturan.hariMinutasi;
  const sejakPutus = Number.isFinite(Number(fakta.hariSejakPutus))
    ? Number(fakta.hariSejakPutus)
    : null;

  if (!fakta.sudahPutus) {
    catat("minutasiTepat", null, "Perkara belum diputus.", { berlaku: false });
  } else if (fakta.hariMinutasi === null || fakta.hariMinutasi === undefined) {
    if (sejakPutus !== null && sejakPutus <= ambangMinutasi) {
      catat(
        "minutasiTepat",
        null,
        `Belum diminutasi - tenggangnya masih berjalan, hari ke-${sejakPutus} dari ${ambangMinutasi}.`,
        { berlaku: false }
      );
    } else {
      catat(
        "minutasiTepat",
        0,
        sejakPutus === null
          ? "Belum diminutasi."
          : `Belum diminutasi, sudah ${sejakPutus} hari sejak putusan (ambang ${ambangMinutasi} hari).`
      );
    }
  } else {
    catat(
      "minutasiTepat",
      fakta.hariMinutasi <= pengaturan.hariMinutasi ? 1 : 0,
      `${fakta.hariMinutasi} hari setelah putusan (ambang ${pengaturan.hariMinutasi} hari).`
    );
  }

  // Pembaginya HANYA butir yang berlaku. Butir yang belum waktunya tidak
  // menambah pembagi, sehingga perkara yang baru berjalan dinilai atas apa
  // yang sudah menjadi kewajibannya - bukan atas seluruh daur hidup perkara
  // yang belum dilaluinya.
  const dinilai = rinci.filter((x) => x.dihitung);
  const totalBobot = dinilai.reduce((jumlah, x) => jumlah + x.bobot, 0);
  const totalNilai = dinilai.reduce((jumlah, x) => jumlah + x.nilai, 0);
  const skor = totalBobot > 0 ? Math.round((totalNilai / totalBobot) * 100) : 0;

  const bobotBelumBerlaku = rinci
    .filter((x) => x.belumBerlaku)
    .reduce((jumlah, x) => jumlah + x.bobot, 0);

  return {
    skor,
    keadaan: skor >= 85 ? "baik" : skor >= 60 ? "perhatian" : "kurang",
    totalBobot,
    /** Bobot butir yang belum waktunya dinilai - tidak ikut membagi. */
    bobotBelumBerlaku,
    pengaturan,
    rinci,
    // Disebutkan pada tiap jawaban, bukan hanya di layar: penerima data ini
    // harus tahu bahwa angkanya bukan nilai resmi SK.
    catatan:
      "Rubrik ALETA - pelengkap, bukan nilai resmi SK Penilaian SIPP. Nilai SK ada pada bagian penilaian SIPP tersendiri.",
  };
}

module.exports = { BAWAAN, BUTIR, getSettings, nilaiLama, nilaiPerkara, saveSettings };
