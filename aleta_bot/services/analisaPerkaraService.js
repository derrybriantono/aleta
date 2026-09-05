"use strict";

/**
 * Analisa satu perkara: garis waktu, jeda antar sidang, ketepatan input, dan
 * ringkasan yang dapat dibaca dalam sepuluh detik.
 *
 * ============================================================================
 * MENJAWAB "KENAPA", BUKAN MENAMBAH ANGKA
 * ============================================================================
 *
 * Layar status perkara sudah memuat banyak angka. Yang belum ada justru
 * jawaban atas pertanyaan yang paling sering diajukan petugas: kenapa perkara
 * ini selama ini, apa yang sedang ditunggu, dan apa yang terlambat.
 *
 * Empat bagian di bawah menjawabnya dari data yang SUDAH ada - tidak ada satu
 * pun kueri baru ke SIPP. Itu disengaja: analisa yang menambah beban pada
 * sistem induk akan dimatikan orang pada hari pertama layar terasa lambat.
 *
 * ============================================================================
 * FUNGSI MURNI, SUPAYA DAPAT DIUJI
 * ============================================================================
 *
 * Seluruh berkas ini tidak menyentuh basis data maupun jam sistem. Hari ini
 * pun dikirim pemanggilnya. Dengan begitu tiap kesimpulan dapat diuji dengan
 * tanggal yang pasti, bukan tanggal yang berubah tiap kali uji dijalankan.
 */

/** Ambang bawaan: lima bulan, satuan yang dipakai SK dan rubrik ALETA. */
const AMBANG_HARI = 150;

/**
 * Tangga poin penginputan menurut SK 048/2024 - hari yang sama 5, ke-1 nilai
 * 3, ke-2 nilai 2, ke-3 nilai 1, ke-4 atau lebih nilai 0.
 *
 * Disalin nilainya, bukan dipanggil dari penilaianSippService, supaya berkas
 * ini tetap murni dan dapat diuji sendiri. Bila SK berubah, keduanya memang
 * harus diperiksa bersama - dan itu disebutkan di sini agar tidak terlewat.
 */
const TANGGA_INPUT = [
  { batas: 0, poin: 5, sebutan: "hari yang sama" },
  { batas: 1, poin: 3, sebutan: "terlambat 1 hari" },
  { batas: 2, poin: 2, sebutan: "terlambat 2 hari" },
  { batas: 3, poin: 1, sebutan: "terlambat 3 hari" },
];

function poinInput(selisih) {
  for (const anak of TANGGA_INPUT) {
    if (selisih <= anak.batas) return { poin: anak.poin, sebutan: anak.sebutan };
  }
  return { poin: 0, sebutan: `terlambat ${selisih} hari` };
}

function urai(teks) {
  const cocok = String(teks || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!cocok) return null;
  return new Date(Number(cocok[1]), Number(cocok[2]) - 1, Number(cocok[3]));
}

/** Selisih hari kalender, atau null bila salah satu tanggalnya tidak terbaca. */
function selisih(dari, sampai) {
  const a = urai(dari);
  const b = urai(sampai);
  if (!a || !b) return null;
  return Math.round((b - a) / 86400000);
}

function angkaHari(nilai) {
  const n = Number(nilai);
  return Number.isFinite(n) ? n : null;
}

/**
 * ============================================================================
 * GARIS WAKTU
 * ============================================================================
 *
 * Satu batang dari pendaftaran sampai putusan - atau sampai hari ini bila
 * perkaranya masih berjalan - dengan tiap peristiwa duduk pada jaraknya yang
 * sebenarnya. Yang dijawabnya: KE MANA WAKTUNYA PERGI.
 *
 * Titik yang tanggalnya tidak terbaca TIDAK digambar. Menaruhnya di tempat
 * yang ditebak akan membuat garis waktu berbohong dengan meyakinkan - dan
 * gambar yang salah jauh lebih sulit dibantah daripada angka yang salah.
 */
function susunGarisWaktu({ tanggalDaftar, akhir, sebabAkhir, tahapan, jadwal, putusan, ambangHari }) {
  if (!tanggalDaftar || !akhir) {
    return { terbaca: false, alasan: "Tanggal pendaftaran atau tanggal akhir tidak terbaca.", titik: [] };
  }

  const totalHari = selisih(tanggalDaftar, akhir);
  if (totalHari === null || totalHari < 0) {
    return { terbaca: false, alasan: "Rentang tanggalnya tidak masuk akal.", titik: [] };
  }

  const titik = [{ kunci: "daftar", label: "Didaftarkan", tanggal: tanggalDaftar, hariKe: 0, jenis: "awal" }];

  const tahap = tahapan && Array.isArray(tahapan.tahap) ? tahapan.tahap : [];
  const SEBUTAN_TAHAP = { pmh: "PMH", ppp: "PPP", pjs: "PJS", phs: "PHS" };
  for (const kunci of ["pmh", "ppp", "pjs", "phs"]) {
    const satu = tahap.find((x) => x.kunci === kunci);
    if (!satu || !satu.tanggal) continue;
    const hariKe = selisih(tanggalDaftar, satu.tanggal);
    if (hariKe === null) continue;
    titik.push({ kunci, label: SEBUTAN_TAHAP[kunci], tanggal: satu.tanggal, hariKe, jenis: "penetapan" });
  }

  const sidang = (Array.isArray(jadwal) ? jadwal : []).filter((x) => x && x.tanggalSidang);
  sidang.forEach((satu, i) => {
    const hariKe = selisih(tanggalDaftar, satu.tanggalSidang);
    if (hariKe === null) return;
    titik.push({
      kunci: `sidang-${i + 1}`,
      label: `S${i + 1}`,
      tanggal: satu.tanggalSidang,
      hariKe,
      jenis: "sidang",
      agenda: String(satu.agenda || ""),
      ditunda: Boolean(satu.ditunda),
    });
  });

  const akhiran = [
    { kunci: "putusan", label: sebabAkhir === "dicabut" ? "Dicabut" : sebabAkhir === "gugur" ? "Gugur" : "Putus", tanggal: putusan.tanggalPutusan },
    { kunci: "minutasi", label: "Minutasi", tanggal: putusan.tanggalMinutasi },
    { kunci: "bht", label: "BHT", tanggal: putusan.tanggalBht },
  ];
  for (const satu of akhiran) {
    if (!satu.tanggal) continue;
    const hariKe = selisih(tanggalDaftar, satu.tanggal);
    if (hariKe === null) continue;
    titik.push({ ...satu, hariKe, jenis: "akhir" });
  }

  titik.sort((a, b) => a.hariKe - b.hariKe);

  // Panjang gambar mengikuti yang TERJAUH - peristiwa sesudah tanggal akhir
  // (minutasi dan BHT selalu sesudah putusan) tidak boleh terpotong keluar.
  const terjauh = titik.reduce((maks, x) => Math.max(maks, x.hariKe), totalHari);

  return {
    terbaca: true,
    alasan: "",
    mulai: tanggalDaftar,
    akhir,
    sebabAkhir,
    totalHari,
    panjangHari: terjauh,
    ambangHari,
    // Ambang digambar hanya bila ia jatuh di dalam rentangnya; garis ambang di
    // luar gambar tidak menerangkan apa pun.
    ambangTampak: ambangHari <= terjauh,
    titik,
  };
}

/**
 * ============================================================================
 * JEDA ANTAR SIDANG
 * ============================================================================
 *
 * Perkara jarang menjadi lama karena satu sebab besar. Ia menjadi lama karena
 * tundaan beruntun yang masing-masing tampak wajar. Deretan jeda inilah yang
 * memperlihatkannya - lengkap dengan alasan tundaan sidang SEBELUMNYA, sebab
 * itulah yang menyebabkan jeda tersebut.
 */
function susunJedaSidang({ tanggalDaftar, jadwal, sudahPutus, tanggalPutusan, hariIni }) {
  const sidang = (Array.isArray(jadwal) ? jadwal : []).filter((x) => x && x.tanggalSidang);
  if (sidang.length === 0) {
    return { terbaca: false, alasan: "Belum ada sidang terjadwal.", baris: [], rata: null, terpanjang: null };
  }

  const baris = [];

  const keSidangPertama = selisih(tanggalDaftar, sidang[0].tanggalSidang);
  if (keSidangPertama !== null) {
    baris.push({
      dari: "Didaftarkan",
      ke: "Sidang 1",
      hari: keSidangPertama,
      alasan: "",
      jenis: "pendaftaran",
    });
  }

  for (let i = 1; i < sidang.length; i += 1) {
    const hari = selisih(sidang[i - 1].tanggalSidang, sidang[i].tanggalSidang);
    if (hari === null) continue;
    baris.push({
      dari: `Sidang ${i}`,
      ke: `Sidang ${i + 1}`,
      hari,
      // Alasan tundaan melekat pada sidang yang DITUNDA - yaitu sidang
      // sebelumnya. Mengambilnya dari sidang berikutnya akan menerangkan jeda
      // dengan sebab yang belum terjadi.
      alasan: String(sidang[i - 1].alasanDitunda || ""),
      jenis: "sidang",
    });
  }

  // Perkara yang belum putus: jarak dari sidang terakhir sampai hari ini.
  // Inilah yang memperlihatkan perkara yang menggantung tanpa jadwal baru.
  const terakhir = sidang[sidang.length - 1];
  if (!sudahPutus) {
    const menggantung = selisih(terakhir.tanggalSidang, hariIni);
    if (menggantung !== null && menggantung > 0) {
      baris.push({
        dari: `Sidang ${sidang.length}`,
        ke: "Hari ini",
        hari: menggantung,
        alasan: String(terakhir.alasanDitunda || ""),
        jenis: "berjalan",
      });
    }
  } else if (tanggalPutusan) {
    const kePutusan = selisih(terakhir.tanggalSidang, tanggalPutusan);
    if (kePutusan !== null && kePutusan > 0) {
      baris.push({
        dari: `Sidang ${sidang.length}`,
        ke: "Putus",
        hari: kePutusan,
        alasan: "",
        jenis: "akhir",
      });
    }
  }

  const antarSidang = baris.filter((x) => x.jenis === "sidang").map((x) => x.hari);
  const rata =
    antarSidang.length > 0
      ? Math.round((antarSidang.reduce((a, b) => a + b, 0) / antarSidang.length) * 10) / 10
      : null;
  const terpanjang = baris.length > 0 ? baris.reduce((a, b) => (b.hari > a.hari ? b : a)) : null;

  return { terbaca: true, alasan: "", baris, rata, terpanjang };
}

/**
 * ============================================================================
 * KETEPATAN INPUT KE SIPP
 * ============================================================================
 *
 * Selisih antara tanggal peristiwa dan tanggal ia diinput. Angka ini sudah
 * dipakai menilai perkara menurut SK, tetapi selama ini terkubur di dalam
 * daftar unsur - padahal ia satu-satunya bagian nilai yang dapat diperbaiki
 * SEKARANG, tanpa menunggu perkara berikutnya.
 */
function susunKetepatanInput({ tahapan }) {
  const tahap = tahapan && Array.isArray(tahapan.tahap) ? tahapan.tahap : [];
  if (tahap.length === 0) {
    return { terbaca: false, alasan: "Tahapan perkara tidak terbaca.", baris: [], terlambat: 0 };
  }

  const baris = [];
  for (const satu of tahap) {
    if (!satu || !satu.tanggal || !satu.diinput) continue;
    const jarak = selisih(satu.tanggal, satu.diinput);
    if (jarak === null || jarak < 0) continue;
    const nilai = poinInput(jarak);
    baris.push({
      kunci: String(satu.kunci || ""),
      label: String(satu.label || satu.kunci || ""),
      tanggal: satu.tanggal,
      diinput: satu.diinput,
      selisih: jarak,
      poin: nilai.poin,
      poinMaksimal: 5,
      sebutan: nilai.sebutan,
    });
  }

  if (baris.length === 0) {
    return {
      terbaca: false,
      alasan: "Belum ada tahapan yang tanggal input-nya terbaca.",
      baris: [],
      terlambat: 0,
    };
  }

  return {
    terbaca: true,
    alasan: "",
    baris,
    terlambat: baris.filter((x) => x.selisih > 0).length,
    dasar: "SK 048/2024: hari yang sama 5, ke-1 nilai 3, ke-2 nilai 2, ke-3 nilai 1, ke-4 atau lebih nilai 0.",
  };
}

/**
 * ============================================================================
 * RINGKASAN - YANG BENAR-BENAR DIBACA
 * ============================================================================
 *
 * Chart dibuka kalau kalimatnya bikin penasaran. Karena itu bagian ini
 * ditaruh paling atas di antara keempatnya, dan isinya hanya hal yang menuntut
 * tindakan atau menerangkan keadaan - bukan pengulangan seluruh angka yang
 * sudah tampil di layar.
 *
 * Tiap kalimat berdiri sendiri dan hanya muncul bila ada isinya. Ringkasan
 * yang memaksakan lima kalimat pada perkara yang tidak punya apa-apa untuk
 * dilaporkan akan berhenti dibaca sama seperti peringatan yang selalu menyala.
 */
function susunRingkasan(bahan) {
  const {
    hariBerjalan,
    hariBersih,
    hariMediasi,
    sudahPutus,
    sebabAkhir,
    ambangHari,
    jeda,
    ketepatan,
    panggilan,
    biaya,
    hariSejakPutus,
    ambangMinutasi,
    sudahMinutasi,
    penilaian,
  } = bahan;

  const kalimat = [];

  // --- umur -----------------------------------------------------------------
  if (angkaHari(hariBersih) !== null) {
    const bersih = angkaHari(hariBersih);
    const potongan = angkaHari(hariMediasi) > 0 ? ` (dari ${hariBerjalan} hari, mediasi ${hariMediasi} hari dipotong)` : "";
    if (sudahPutus) {
      const sebutan = sebabAkhir === "dicabut" ? "dicabut" : sebabAkhir === "gugur" ? "gugur" : "diputus";
      kalimat.push(
        `Perkara ${sebutan} pada hari ke-${bersih}${potongan} - ` +
          (bersih <= ambangHari ? `di dalam ambang ${ambangHari} hari.` : `melewati ambang ${ambangHari} hari.`)
      );
    } else {
      kalimat.push(
        `Perkara berjalan ${bersih} hari${potongan} - ` +
          (bersih <= ambangHari
            ? `masih di dalam ambang ${ambangHari} hari.`
            : `sudah melewati ambang ${ambangHari} hari.`)
      );
    }
  }

  // --- sidang yang menggantung ---------------------------------------------
  const menggantung = jeda && jeda.terbaca ? jeda.baris.find((x) => x.jenis === "berjalan") : null;
  if (menggantung) {
    kalimat.push(
      `Sudah ${menggantung.hari} hari sejak sidang terakhir` +
        (menggantung.alasan ? `, yang ditunda karena ${menggantung.alasan.toLowerCase()}` : "") +
        "."
    );
  }

  // --- jeda terpanjang -----------------------------------------------------
  if (jeda && jeda.terbaca && jeda.terpanjang && jeda.terpanjang.jenis === "sidang" && jeda.terpanjang.hari >= 30) {
    kalimat.push(
      `Jeda terpanjang ${jeda.terpanjang.hari} hari antara ${jeda.terpanjang.dari} dan ${jeda.terpanjang.ke}` +
        (jeda.terpanjang.alasan ? ` - ${jeda.terpanjang.alasan.toLowerCase()}` : "") +
        "."
    );
  }

  // --- ketepatan input -----------------------------------------------------
  if (ketepatan && ketepatan.terbaca && ketepatan.terlambat > 0) {
    const terparah = ketepatan.baris.reduce((a, b) => (b.selisih > a.selisih ? b : a));
    kalimat.push(
      `${ketepatan.terlambat} tahapan diinput terlambat ke SIPP, terparah ${terparah.label} ${terparah.selisih} hari.`
    );
  }

  // --- panggilan -----------------------------------------------------------
  if (panggilan && Number(panggilan.jumlahPihak) > 0) {
    const jumlah = Number(panggilan.jumlahPihak);
    const patut = Number(panggilan.patut) || 0;
    if (patut < jumlah) {
      kalimat.push(`${jumlah - patut} dari ${jumlah} pihak belum dipanggil secara patut.`);
    }
  }

  // --- minutasi ------------------------------------------------------------
  if (sudahPutus && !sudahMinutasi && angkaHari(hariSejakPutus) !== null) {
    const umur = angkaHari(hariSejakPutus);
    const ambang = angkaHari(ambangMinutasi) ?? 14;
    kalimat.push(
      umur <= ambang
        ? `Belum diminutasi - hari ke-${umur} dari tenggang ${ambang} hari.`
        : `Belum diminutasi, sudah ${umur} hari sejak putusan (tenggang ${ambang} hari).`
    );
  }

  // --- panjar --------------------------------------------------------------
  if (biaya && Number.isFinite(Number(biaya.sisa))) {
    const sisa = Number(biaya.sisa);
    if (sisa < 0) {
      kalimat.push(`Panjar MINUS ${Math.abs(sisa).toLocaleString("id-ID")} rupiah - perlu tambah panjar.`);
    } else if (sisa === 0 && !sudahPutus) {
      kalimat.push("Panjar habis - panggilan berikutnya belum ada biayanya.");
    }
  }

  // --- nilai ---------------------------------------------------------------
  if (penilaian && Number.isFinite(Number(penilaian.skor))) {
    kalimat.push(`Nilai kelengkapan ${penilaian.skor} dari 100 - ${penilaian.keadaan}.`);
  }

  return kalimat;
}

/**
 * Merakit keempat bagian sekaligus.
 *
 * @param {object} bahan seluruhnya data yang SUDAH dibaca layar status perkara
 */
function analisaPerkara(bahan = {}) {
  const {
    tanggalDaftar = "",
    hariIni = "",
    sudahPutus = false,
    sebabSelesai = "",
    putusan = {},
    tahapan = null,
    jadwal = [],
    biaya = null,
    panggilan = null,
    penilaian = null,
    hariBerjalan = null,
    hariBersih = null,
    hariMediasi = 0,
    hariSejakPutus = null,
    ambangMinutasi = 14,
    ambangHari = AMBANG_HARI,
  } = bahan;

  const tanggalPutusan = putusan && putusan.tanggalPutusan ? putusan.tanggalPutusan : "";
  const akhir = sudahPutus && tanggalPutusan ? tanggalPutusan : hariIni;

  const garisWaktu = susunGarisWaktu({
    tanggalDaftar,
    akhir,
    sebabAkhir: sudahPutus ? sebabSelesai || "putus" : "",
    tahapan,
    jadwal,
    putusan: putusan || {},
    ambangHari,
  });

  const jedaSidang = susunJedaSidang({
    tanggalDaftar,
    jadwal,
    sudahPutus,
    tanggalPutusan,
    hariIni,
  });

  const ketepatanInput = susunKetepatanInput({ tahapan });

  const ringkasan = susunRingkasan({
    hariBerjalan,
    hariBersih,
    hariMediasi,
    sudahPutus,
    sebabAkhir: sebabSelesai,
    ambangHari,
    jeda: jedaSidang,
    ketepatan: ketepatanInput,
    panggilan,
    biaya,
    hariSejakPutus,
    ambangMinutasi,
    sudahMinutasi: Boolean(putusan && putusan.tanggalMinutasi),
    penilaian,
  });

  return { garisWaktu, jedaSidang, ketepatanInput, ringkasan };
}

module.exports = {
  AMBANG_HARI,
  TANGGA_INPUT,
  analisaPerkara,
  poinInput,
  susunGarisWaktu,
  susunJedaSidang,
  susunKetepatanInput,
  susunRingkasan,
};
