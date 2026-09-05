"use strict";

/**
 * Penilaian SIPP menurut SK Dirjen Badilag Nomor 048/DJA/SK.KP3.4.3/IV/2024
 * tanggal 1 April 2024 tentang Evaluasi Kinerja pada SIPP di lingkungan
 * Peradilan Agama.
 *
 * ============================================================================
 * ANGKA DI BERKAS INI DISALIN DARI SK, BUKAN KARANGAN
 * ============================================================================
 *
 * Seluruh bobot, skala poin, rumus, predikat, dan kode warna di bawah ini
 * disalin apa adanya dari lampiran SK tersebut - Tabel 1 (Bobot Nilai),
 * Tabel 2 (Kriteria Penilaian), dan Bab III (Hasil Penilaian). Tiap unsur
 * mencantumkan `dasar` supaya dapat ditelusuri kembali ke halaman SK-nya.
 *
 * Berkas ini SENGAJA tidak menyentuh basis data. Isinya perhitungan murni:
 * fakta masuk, nilai keluar. Dengan begitu seluruh angkanya dapat diuji tanpa
 * SIPP - dan memang diuji, lihat scripts/verify-penilaian-sipp.js.
 *
 * ============================================================================
 * SK MENILAI SATUAN KERJA, BUKAN SATU PERKARA
 * ============================================================================
 *
 * Rumus SK membandingkan jumlah poin seluruh perkara putus dengan poin
 * maksimalnya:
 *
 *   Nilai Unsur X = (Nilai Riil Unsur X / Nilai Maksimal Unsur X) x 100% x bobot
 *   Nilai Riil    = jumlah poin tiap perkara pada unsur itu
 *   Nilai Maksimal= jumlah perkara x poin maksimal unsur itu
 *
 * Angka satu perkara tetap bermakna - itulah poin riilnya, 5/3/2/1/0 - tetapi
 * PERSENTASE satu perkara bukan nilai satker. Karena itu poinPerkara() dan
 * nilaiSatker() dipisah, dan hasil satu perkara selalu membawa keterangan
 * bahwa itu poin perkara, bukan nilai satker.
 *
 * ============================================================================
 * TIDAK TERBACA BERBEDA DARI KOSONG
 * ============================================================================
 *
 * SK menilai NOL untuk data yang tidak diisi. Tetapi data yang belum dapat
 * DIBACA ALETA bukan data yang kosong di SIPP - menilainya nol akan menuduh
 * pengadilan lalai atas pekerjaan yang sebenarnya sudah dikerjakan.
 *
 * Karena itu tiap unsur mengembalikan `terbaca`. Unsur yang tidak terbaca
 * dikeluarkan dari pembilang DAN penyebut, lalu disebutkan sendiri pada hasil
 * sebagai unsur yang belum tersambung sumber datanya. Nilai yang keluar
 * karenanya nilai SEBAGIAN, dan hasilnya menyatakan itu.
 *
 * ============================================================================
 * DI MANA ANGKA INI BERBEDA DARI NOTIFIKASI SIPP SETEMPAT
 * ============================================================================
 *
 * Pengadilan ini sudah lama punya notifikasi SIPP sendiri. Angkanya sama pada
 * hampir seluruh unsur, dengan dua selisih yang disengaja:
 *
 *   waktu minutasi   - SK: hari 1-2 bernilai 5. Notifikasi: hanya hari ke-1.
 *   waktu publikasi  - SK: hari ke-2 bernilai 5. Notifikasi: hanya hari ke-1.
 *
 * Pada keduanya SK menyebut angkanya dengan tegas, dan yang diikuti di sini
 * SK. Akibatnya perkara yang diminutasi atau diunggah pada hari kedua bernilai
 * 5 di sini dan 3 pada notifikasi. Selisih itu disebutkan di sini supaya tidak
 * disangka salah hitung ketika kedua angkanya dibandingkan.
 */

/** Poin maksimal tiap unsur kepatuhan pada Tabel 2. */
const POIN_MAKSIMAL = 5;

/**
 * Memilih poin dari skala bertingkat.
 *
 * @param {number} ukuran nilai yang diukur, umumnya selisih hari
 * @param {Array<[number, number]>} tangga pasangan [batas atas, poin], menaik
 * @param {number} sisa poin bila melewati seluruh batas
 */
function tangga(ukuran, daftar, sisa) {
  for (const [batas, poin] of daftar) {
    if (ukuran <= batas) return poin;
  }
  return sisa;
}

function hari(a, b) {
  if (!a || !b) return null;
  const awal = a instanceof Date ? a : new Date(a);
  const akhir = b instanceof Date ? b : new Date(b);
  if (Number.isNaN(awal.getTime()) || Number.isNaN(akhir.getTime())) return null;
  const satuHari = 24 * 60 * 60 * 1000;
  return Math.round((akhir.setHours(0, 0, 0, 0) - awal.setHours(0, 0, 0, 0)) / satuHari);
}

/** Hasil satu unsur yang sumber datanya belum tersambung ke ALETA. */
function belumTerbaca(sebab) {
  return { poin: null, terbaca: false, catatan: sebab };
}

function poin(nilai, catatan) {
  return { poin: nilai, terbaca: true, catatan: String(catatan || "") };
}

/**
 * ============================================================================
 * ASPEK KINERJA PENANGANAN PERKARA - bobot 50%
 * ============================================================================
 *
 * Lampiran SK Bab II huruf B angka 2 huruf a, b, dan c.
 */
const KINERJA = [
  {
    kunci: "waktuPutus",
    label: "Waktu putus perkara",
    aspek: "kinerja",
    bobotPa: 20,
    bobotPta: 20,
    dasar: "SK 048/2024 Tabel 1 dan huruf a - 3 bulan (90 hari) nilai 5, 4 bulan (120 hari) nilai 3, 5 bulan (150 hari) nilai 1, lebih dari itu nilai 0. Lama mediasi dipotong lebih dulu.",
    keterangan: "Dihitung dari tanggal pendaftaran sampai tanggal putus, hari pendaftaran ikut dihitung, dikurangi lama mediasi dan kelonggaran perkara khusus.",
    nilai(f) {
      const selisih = hari(f.tanggalDaftar, f.tanggalPutus);
      if (selisih === null) return belumTerbaca("Tanggal daftar atau tanggal putus belum tercatat.");

      // ====================================================================
      // HARI PENDAFTARAN IKUT DIHITUNG
      // ====================================================================
      //
      // Perkara yang didaftarkan dan diputus pada hari yang sama berjalan
      // SATU hari, bukan nol. Itulah cara notifikasi SIPP pengadilan ini
      // menghitung sejak lama - DATEDIFF ditambah satu - dan memakai cara
      // yang sama membuat angka ALETA dapat disandingkan dengan angka yang
      // sudah biasa dibaca orang.
      const kotor = selisih + 1;

      // ====================================================================
      // LAMA MEDIASI DIPOTONG - TETAPI TIDAK MELEBIHI LAMA PERKARANYA
      // ====================================================================
      //
      // Mediasi wajib menurut PERMA 1/2016, dan selama berjalan perkaranya
      // memang berhenti - bukan karena majelis lambat, melainkan karena hukum
      // acaranya memerintahkan begitu. Menghitungnya sebagai keterlambatan
      // berarti menghukum majelis atas kepatuhan.
      //
      // Tetapi angka yang dipotong dijepit lebih dulu. View v_durasi_mediasi
      // pada SIPP setempat kadang menghasilkan angka ribuan hari - tampaknya
      // untuk perkara lama yang mediasinya tidak pernah ditutup, sehingga
      // terhitung sampai hari ini. Memotongnya apa adanya membuat perkara
      // yang berjalan setahun terbaca selesai dalam waktu negatif, dan
      // bernilai 5 tanpa berhak.
      //
      // Karena itu potongan tidak boleh melebihi lama perkaranya sendiri, dan
      // sisanya tidak boleh kurang dari satu hari.
      const mediasiMentah = Math.max(0, Number(f.hariMediasi) || 0);
      const mediasi = Math.min(mediasiMentah, Math.max(0, kotor - 1));

      // Pengecualian perkara khusus - lampiran SK Tabel 2 nomor 1.
      const potongan = kelonggaranWaktuPutus(f);
      const bersih = kotor - mediasi - potongan.hari;

      // SK memakai satuan bulan; satu bulan dihitung 30 hari, sehingga
      // ambangnya jatuh pada 90, 120, dan 150 hari - persis ambang yang
      // dipakai notifikasi SIPP setempat.
      const nilai = bersih <= 90 ? 5 : bersih <= 120 ? 3 : bersih <= 150 ? 1 : 0;

      const rinci = [`${kotor} hari sejak pendaftaran`];
      if (mediasi > 0) {
        rinci.push(
          mediasi < mediasiMentah
            ? `dikurangi ${mediasi} hari mediasi (dijepit dari ${mediasiMentah})`
            : `dikurangi ${mediasi} hari mediasi`
        );
      }
      if (potongan.hari > 0) rinci.push(`dikurangi ${potongan.hari} hari (${potongan.sebab})`);

      return poin(
        nilai,
        `${rinci.join(", ")} = ${bersih} hari (${(bersih / 30).toFixed(1)} bulan).`
      );
    },
  },
  {
    kunci: "waktuMinutasi",
    label: "Waktu minutasi berkas perkara",
    aspek: "kinerja",
    bobotPa: 15,
    bobotPta: 15,
    dasar: "SK 048/2024 Tabel 1 dan huruf b - hari 1-2 nilai 5, hari 3-5 nilai 3, hari 6-9 nilai 2, hari 10-14 nilai 1, lebih dari 14 hari nilai 0.",
    keterangan: "Dihitung dari tanggal putus sampai tanggal minutasi.",
    nilai(f) {
      if (!f.tanggalPutus) return belumTerbaca("Perkara belum diputus.");
      if (!f.tanggalMinutasi) return poin(0, "Berkas belum diminutasi.");
      const selisih = hari(f.tanggalPutus, f.tanggalMinutasi);
      if (selisih === null) return belumTerbaca("Tanggal minutasi tidak terbaca.");
      return poin(
        tangga(selisih, [[2, 5], [5, 3], [9, 2], [14, 1]], 0),
        `${selisih} hari setelah putusan.`
      );
    },
  },
  {
    kunci: "waktuPublikasi",
    label: "Waktu publikasi putusan",
    aspek: "kinerja",
    bobotPa: 15,
    bobotPta: 15,
    dasar: "SK 048/2024 Tabel 1 dan huruf c - hari ke-2 nilai 5, hari 3-5 nilai 3, hari 6-9 nilai 2, hari 10-14 nilai 1, lebih dari 14 hari nilai 0. Bobot 15% terbagi atas waktu publikasi 7,5% dan prosentase publikasi 7,5%.",
    keterangan: "Dihitung dari tanggal putus sampai naskah putusan diunggah ke SIPP atau Direktori Putusan.",
    nilai(f) {
      if (!f.tanggalPutus) return belumTerbaca("Perkara belum diputus.");
      if (f.tanggalUnggahPutusan === undefined) {
        return belumTerbaca("Tanggal unggah putusan belum tersambung ke ALETA.");
      }
      if (!f.tanggalUnggahPutusan) return poin(0, "Putusan belum diunggah.");
      const selisih = hari(f.tanggalPutus, f.tanggalUnggahPutusan);
      if (selisih === null) return belumTerbaca("Tanggal unggah putusan tidak terbaca.");
      return poin(
        tangga(selisih, [[2, 5], [5, 3], [9, 2], [14, 1]], 0),
        `${selisih} hari setelah putusan.`
      );
    },
  },
];

/**
 * Kelonggaran waktu putus untuk perkara khusus - lampiran SK Tabel 2 nomor 1.
 *
 * Perkara ghaib, mafqud, dan perkara pihak PNS/POLRI/TNI memang berjalan lebih
 * lama karena hukum acaranya sendiri yang mengharuskan, bukan karena majelis
 * lambat. SK karena itu memotong tenggangnya sebelum dinilai.
 */
function kelonggaranWaktuPutus(f = {}) {
  if (f.perkaraMafqud) return { hari: 270, sebab: "perkara mafqud" };
  if (f.perkaraGhaibDiumumkan) return { hari: 180, sebab: "perkara ghaib dengan pengumuman" };
  if (f.perkaraGhaib) return { hari: 120, sebab: "perkara ghaib" };
  if (f.hariIzinAtasan) {
    // Paling banyak enam bulan - SK Tabel 2 nomor 1 angka 4.
    const batas = Math.min(Number(f.hariIzinAtasan) || 0, 180);
    if (batas > 0) return { hari: batas, sebab: "menunggu izin atasan PNS/POLRI/TNI" };
  }
  return { hari: 0, sebab: "" };
}

/** Skala yang berulang pada SK: hari yang sama 5, lalu 3, 2, 1, dan 0. */
function skalaHarian(selisih) {
  return tangga(selisih, [[0, 5], [1, 3], [2, 2], [3, 1]], 0);
}

/** Skala penetapan setelah PMH: hari yang sama 5, hari 1-2 nilai 3, 3-4 nilai 2, 5-9 nilai 1. */
function skalaPenetapan(selisih) {
  return tangga(selisih, [[0, 5], [2, 3], [4, 2], [9, 1]], 0);
}

/**
 * ============================================================================
 * ASPEK INPUT DATA - bobot 40%
 * ============================================================================
 *
 * Lampiran SK Tabel 2 bagian I, nomor 1 sampai 17.
 */
const INPUT_DATA = [
  {
    kunci: "pendaftaranPerkara",
    label: "Pendaftaran perkara",
    bobotPa: 2,
    bobotPta: 5,
    dasar: "SK 048/2024 Tabel 2 I.1 - hari yang sama 5, hari ke-1 nilai 3, ke-2 nilai 2, ke-3 nilai 1, ke-4 atau lebih nilai 0.",
    keterangan: "Tanggal input SIPP dibandingkan tanggal pendaftaran perkara.",
    nilai(f) {
      if (f.tanggalInputPendaftaran === undefined) {
        return belumTerbaca("Tanggal input pendaftaran belum tersambung ke ALETA.");
      }
      const selisih = hari(f.tanggalDaftar, f.tanggalInputPendaftaran);
      if (selisih === null) return poin(0, "Tanggal input pendaftaran belum tercatat.");
      return poin(skalaHarian(selisih), `Diinput ${selisih} hari setelah pendaftaran.`);
    },
  },
  {
    kunci: "penetapanMajelis",
    label: "Penetapan majelis hakim",
    bobotPa: 2.5,
    bobotPta: 5,
    dasar: "SK 048/2024 Tabel 2 I.2 - hari yang sama 5, hari 1-2 nilai 3, 3-4 nilai 2, 5-9 nilai 1, 10 atau lebih nilai 0.",
    keterangan: "Tanggal penetapan majelis dibandingkan tanggal pendaftaran perkara.",
    nilai(f) {
      if (f.tanggalPmh === undefined) return belumTerbaca("Tanggal PMH belum tersambung ke ALETA.");
      const selisih = hari(f.tanggalDaftar, f.tanggalPmh);
      if (selisih === null) return poin(0, "PMH belum tercatat.");
      return poin(skalaPenetapan(selisih), `PMH ${selisih} hari setelah pendaftaran.`);
    },
  },
  {
    kunci: "inputPenetapanMajelis",
    label: "Penginputan penetapan majelis hakim",
    bobotPa: 2,
    bobotPta: 5,
    dasar: "SK 048/2024 Tabel 2 I.3 - hari yang sama 5, ke-1 nilai 3, ke-2 nilai 2, ke-3 nilai 1, ke-4 atau lebih nilai 0.",
    keterangan: "Tanggal input atau cetak PMH dibandingkan tanggal PMH.",
    nilai(f) {
      if (f.tanggalInputPmh === undefined) return belumTerbaca("Tanggal input PMH belum tersambung ke ALETA.");
      const selisih = hari(f.tanggalPmh, f.tanggalInputPmh);
      if (selisih === null) return poin(0, "Input PMH belum tercatat.");
      return poin(skalaHarian(selisih), `Diinput ${selisih} hari setelah PMH.`);
    },
  },
  {
    kunci: "penunjukanPp",
    label: "Penunjukan panitera pengganti",
    bobotPa: 2.5,
    bobotPta: 5,
    dasar: "SK 048/2024 Tabel 2 I.4 - hari yang sama 5, hari 1-2 nilai 3, 3-4 nilai 2, 5-9 nilai 1, 10 atau lebih nilai 0.",
    keterangan: "Tanggal penetapan panitera pengganti dibandingkan tanggal PMH.",
    nilai(f) {
      if (f.tanggalPpp === undefined) return belumTerbaca("Tanggal penunjukan PP belum tersambung ke ALETA.");
      const selisih = hari(f.tanggalPmh, f.tanggalPpp);
      if (selisih === null) return poin(0, "Penunjukan PP belum tercatat.");
      return poin(skalaPenetapan(selisih), `PP ditunjuk ${selisih} hari setelah PMH.`);
    },
  },
  {
    kunci: "inputPenunjukanPp",
    label: "Penginputan penunjukan panitera pengganti",
    bobotPa: 2,
    bobotPta: 5,
    dasar: "SK 048/2024 Tabel 2 I.5 - hari yang sama 5, ke-1 nilai 3, ke-2 nilai 2, ke-3 nilai 1, ke-4 atau lebih nilai 0.",
    keterangan: "Tanggal input atau cetak penunjukan PP dibandingkan tanggal penunjukan PP.",
    nilai(f) {
      if (f.tanggalInputPpp === undefined) return belumTerbaca("Tanggal input penunjukan PP belum tersambung ke ALETA.");
      const selisih = hari(f.tanggalPpp, f.tanggalInputPpp);
      if (selisih === null) return poin(0, "Input penunjukan PP belum tercatat.");
      return poin(skalaHarian(selisih), `Diinput ${selisih} hari setelah penunjukan PP.`);
    },
  },
  {
    kunci: "penunjukanJurusita",
    label: "Penunjukan juru sita",
    bobotPa: 2.5,
    bobotPta: 0,
    dasar: "SK 048/2024 Tabel 2 I.6 - hari yang sama 5, hari 1-2 nilai 3, 3-4 nilai 2, 5-9 nilai 1, 10 atau lebih nilai 0.",
    keterangan: "Tanggal penetapan juru sita dibandingkan tanggal PMH.",
    nilai(f) {
      if (f.tanggalPjs === undefined) return belumTerbaca("Tanggal penunjukan juru sita belum tersambung ke ALETA.");
      const selisih = hari(f.tanggalPmh, f.tanggalPjs);
      if (selisih === null) return poin(0, "Penunjukan juru sita belum tercatat.");
      return poin(skalaPenetapan(selisih), `Juru sita ditunjuk ${selisih} hari setelah PMH.`);
    },
  },
  {
    kunci: "inputPenunjukanJurusita",
    label: "Penginputan penunjukan juru sita",
    bobotPa: 2,
    bobotPta: 0,
    dasar: "SK 048/2024 Tabel 2 I.7 - hari yang sama 5, ke-1 nilai 3, ke-2 nilai 2, ke-3 nilai 1, ke-4 atau lebih nilai 0.",
    keterangan: "Tanggal input atau cetak penunjukan juru sita dibandingkan tanggal penunjukannya.",
    nilai(f) {
      if (f.tanggalInputPjs === undefined) return belumTerbaca("Tanggal input penunjukan juru sita belum tersambung ke ALETA.");
      const selisih = hari(f.tanggalPjs, f.tanggalInputPjs);
      if (selisih === null) return poin(0, "Input penunjukan juru sita belum tercatat.");
      return poin(skalaHarian(selisih), `Diinput ${selisih} hari setelah penunjukan juru sita.`);
    },
  },
  {
    kunci: "penetapanHariSidang",
    label: "Penetapan hari sidang pertama",
    bobotPa: 2.5,
    bobotPta: 5,
    dasar: "SK 048/2024 Tabel 2 I.8 - hari yang sama 5, hari 1-2 nilai 3, 3-4 nilai 2, 5-9 nilai 1, 10 atau lebih nilai 0.",
    keterangan: "Tanggal penetapan hari sidang dibandingkan tanggal PMH.",
    nilai(f) {
      if (f.tanggalPhs === undefined) return belumTerbaca("Tanggal PHS belum tersambung ke ALETA.");
      const selisih = hari(f.tanggalPmh, f.tanggalPhs);
      if (selisih === null) return poin(0, "PHS belum tercatat.");
      return poin(skalaPenetapan(selisih), `PHS ${selisih} hari setelah PMH.`);
    },
  },
  {
    kunci: "inputPenetapanHariSidang",
    label: "Penginputan penetapan hari sidang",
    bobotPa: 2,
    bobotPta: 5,
    dasar: "SK 048/2024 Tabel 2 I.9 - hari yang sama 5, ke-1 nilai 3, ke-2 nilai 2, ke-3 nilai 1, ke-4 atau lebih nilai 0.",
    keterangan: "Tanggal input atau cetak PHS dibandingkan tanggal PHS.",
    nilai(f) {
      if (f.tanggalInputPhs === undefined) return belumTerbaca("Tanggal input PHS belum tersambung ke ALETA.");
      const selisih = hari(f.tanggalPhs, f.tanggalInputPhs);
      if (selisih === null) return poin(0, "Input PHS belum tercatat.");
      return poin(skalaHarian(selisih), `Diinput ${selisih} hari setelah PHS.`);
    },
  },
  {
    kunci: "dataRelaas",
    label: "Pengisian data relaas (kepatuhan)",
    bobotPa: 2.5,
    bobotPta: 0,
    dasar: "SK 048/2024 Tabel 2 I.10 - diinput 3 hari atau lebih sebelum sidang nilai 5, 2 hari nilai 2, 1 hari nilai 1, 0 hari nilai 0, tidak ada data relaas nilai -5.",
    keterangan:
      "Relaas dihitung dua kali untuk sidang pertama ditambah sekurangnya sekali untuk sidang berikutnya. Selama penghitungan itu belum dapat diakomodir, SK membolehkan penilaian cukup sekurangnya satu kali panggilan.",
    nilai(f) {
      // Bila SIPP sendiri sudah menilainya, nilai itu yang dipakai - ia
      // catatan pengadilan, bukan tafsiran kita. Dijepit ke rentang yang sah
      // supaya angka menyimpang pada satu baris tidak merusak nilai unsurnya.
      if (typeof f.nilaiRelaasLangsung === "number") {
        const dariSipp = Math.max(-5, Math.min(5, f.nilaiRelaasLangsung));
        return poin(dariSipp, "Nilai dari tabel penilaian relaas SIPP.");
      }
      if (!Array.isArray(f.relaas)) return belumTerbaca("Data relaas belum tersambung ke ALETA.");
      if (f.relaas.length === 0) return poin(-5, "Tidak ada data relaas.");

      // Tiap relaas dinilai sendiri, lalu dirata-ratakan: satu perkara hanya
      // menyumbang satu poin pada unsur ini.
      const daftar = [];
      for (const r of f.relaas) {
        const selisih = hari(r.tanggalInput, r.tanggalSidang);
        if (selisih === null) {
          daftar.push(-5);
          continue;
        }
        // selisih = berapa hari SEBELUM sidang relaas itu diinput.
        daftar.push(selisih >= 3 ? 5 : selisih === 2 ? 2 : selisih === 1 ? 1 : 0);
      }
      const rata = daftar.reduce((a, b) => a + b, 0) / daftar.length;
      return poin(
        Math.round(rata * 10) / 10,
        `${daftar.length} relaas dinilai, rata-rata ${Math.round(rata * 10) / 10}.`
      );
    },
  },
  {
    kunci: "dataMediasi",
    label: "Data mediasi",
    bobotPa: 2.5,
    bobotPta: 0,
    dasar: "SK 048/2024 Tabel 2 I.11 - terisi nilai 5, tidak terisi nilai 0.",
    keterangan: "Pengisian data rapor hasil mediasi.",
    nilai(f) {
      if (f.rapotMediasiTerisi === undefined) return belumTerbaca("Data rapor mediasi belum tersambung ke ALETA.");
      return f.rapotMediasiTerisi
        ? poin(5, "Rapor mediasi terisi.")
        : poin(0, "Rapor mediasi belum terisi.");
    },
  },
  {
    kunci: "dataSaksi",
    label: "Kepatuhan dan kelengkapan data saksi",
    bobotPa: 2.5,
    bobotPta: 0,
    dasar: "SK 048/2024 Tabel 2 I.12 - ada saksi dan isian lengkap 5, 2 dari 3 isian 3, 1 dari 3 isian 2, 0 dari 3 isian 1, tidak ada data saksi 0.",
    keterangan:
      "Dikecualikan perkara cabut atau gugur, kecuali gugur karena ikrar talak. Kelengkapan identitas saksi menurut SK: jenis identitas dan nomor identitas.",
    nilai(f) {
      if (f.dikecualikanSaksi) return belumTerbaca("Perkara cabut atau gugur - dikecualikan SK.");
      if (!Array.isArray(f.saksi)) return belumTerbaca("Data saksi belum tersambung ke ALETA.");
      if (f.saksi.length === 0) return poin(0, "Tidak ada data saksi.");

      const nilaiSaksi = f.saksi.map((s) => {
        const terisi = Number(s.isianTerisi) || 0;
        return terisi >= 3 ? 5 : terisi === 2 ? 3 : terisi === 1 ? 2 : 1;
      });
      const rata = nilaiSaksi.reduce((a, b) => a + b, 0) / nilaiSaksi.length;
      return poin(Math.round(rata * 10) / 10, `${f.saksi.length} saksi tercatat.`);
    },
  },
  {
    kunci: "pemberitahuanPutusan",
    label: "Pemberitahuan putusan atau penetapan",
    bobotPa: 2.5,
    bobotPta: 0,
    dasar:
      "SK 048/2024 Tabel 2 I.13 - pelaksanaan PBT 3 hari atau kurang nilai 5, 4 hari 3, 5 hari 2, 6 hari 1, lebih dari 6 hari 0. Penginputan PBT: 0 hari 5, 1 hari 3, 2 hari 2, 3 hari 1, lebih dari 3 hari 0.",
    keterangan:
      "Pelaksanaan dan penginputan masing-masing separuh bobot. Selama penginputan belum dapat diakomodir, SK membolehkan waktu pelaksanaan dihitung penuh.",
    nilai(f) {
      if (!f.wajibPbt) return belumTerbaca("Perkara tidak wajib pemberitahuan putusan.");
      if (f.hariPbt === undefined) return belumTerbaca("Data pemberitahuan putusan belum tersambung ke ALETA.");
      if (f.hariPbt === null) return poin(0, "Pemberitahuan putusan belum dilaksanakan.");

      const pelaksanaan = tangga(f.hariPbt, [[3, 5], [4, 3], [5, 2], [6, 1]], 0);
      if (f.hariInputPbt === undefined || f.hariInputPbt === null) {
        // Ketentuan peralihan pada SK: hitung pelaksanaannya 100%.
        return poin(pelaksanaan, `PBT ${f.hariPbt} hari setelah putusan; penginputan belum dinilai (ketentuan peralihan SK).`);
      }
      const penginputan = skalaHarian(f.hariInputPbt);
      return poin(
        Math.round(((pelaksanaan + penginputan) / 2) * 10) / 10,
        `PBT ${f.hariPbt} hari setelah putusan, diinput ${f.hariInputPbt} hari setelahnya.`
      );
    },
  },
  {
    kunci: "pengisianBht",
    label: "Pengisian BHT",
    bobotPa: 2.5,
    bobotPta: 0,
    dasar: "SK 048/2024 Tabel 2 I.14 - ada nilai 5, tidak ada nilai 0.",
    keterangan:
      "Perkara cerai talak paling lama 6 bulan; perkara cabut atau gugur langsung BHT; perkara tanpa upaya hukum 14 hari sejak PBT; perkara rogatori dan ghaib sekurangnya 14 hari setelah diumumkan; perkara kasasi dibandingkan tanggal PBT kasasi.",
    nilai(f) {
      if (!f.wajibBht) return belumTerbaca("Perkara belum wajib BHT.");
      return f.tanggalBht ? poin(5, "BHT terisi.") : poin(0, "BHT belum diisi.");
    },
  },
  {
    kunci: "sisaPanjar",
    label: "Pencatatan sisa panjar biaya perkara",
    bobotPa: 2.5,
    bobotPta: 5,
    dasar: "SK 048/2024 Tabel 2 I.15 - hari yang sama 5, ke-1 nilai 3, ke-2 nilai 2, ke-3 nilai 1, ke-4 atau lebih nilai 0.",
    keterangan: "Tanggal input SIPP dibandingkan tanggal pengembalian sisa panjar yang sebenarnya.",
    nilai(f) {
      if (f.hariInputSisaPanjar === undefined) {
        return belumTerbaca("Pencatatan sisa panjar belum tersambung ke ALETA.");
      }
      if (f.hariInputSisaPanjar === null) return poin(0, "Sisa panjar belum dicatat.");
      return poin(skalaHarian(f.hariInputSisaPanjar), `Diinput ${f.hariInputSisaPanjar} hari setelah pengembalian.`);
    },
  },
  {
    kunci: "dataArsip",
    label: "Penginputan data arsip",
    bobotPa: 2.5,
    bobotPta: 0,
    dasar:
      "SK 048/2024 Tabel 2 I.16 - 5 hari atau kurang nilai 5, 6 hari nilai 3, 7 hari nilai 2, 8 hari nilai 1, 9 hari atau lebih nilai 0. Perkara cerai dihitung dari tanggal terbit akta cerai, selainnya dari tanggal BHT.",
    keterangan: "Tanggal input arsip dibandingkan tanggal akta cerai atau tanggal BHT.",
    nilai(f) {
      if (f.hariInputArsip === undefined) return belumTerbaca("Penginputan arsip belum tersambung ke ALETA.");
      if (f.hariInputArsip === null) return poin(0, "Arsip belum diinput.");
      return poin(tangga(f.hariInputArsip, [[5, 5], [6, 3], [7, 2], [8, 1]], 0), `Diinput ${f.hariInputArsip} hari setelah acuan.`);
    },
  },
  {
    kunci: "penerimaanDelegasi",
    label: "Pelaksanaan penerimaan panggilan atau pemberitahuan delegasi",
    bobotPa: 2.5,
    bobotPta: 0,
    dasar: "SK 048/2024 Tabel 2 I.17 - 1 hari atau kurang nilai 5, 2 hari nilai 3, 3 hari nilai 2, 4 hari nilai 1, 5 hari nilai 0.",
    keterangan:
      "Dihitung dari tanggal satker pengaju mengunggah dokumen. Pendelegasian yang jatuh pada hari Jumat dihitung mulai hari Senin.",
    nilai(f) {
      if (f.hariTerimaDelegasi === undefined) return belumTerbaca("Data delegasi belum tersambung ke ALETA.");
      if (f.hariTerimaDelegasi === null) return belumTerbaca("Perkara ini tidak ada delegasi.");
      return poin(tangga(f.hariTerimaDelegasi, [[1, 5], [2, 3], [3, 2], [4, 1]], 0), `Diterima ${f.hariTerimaDelegasi} hari setelah diunggah pengaju.`);
    },
  },
];

/**
 * ============================================================================
 * ASPEK KELENGKAPAN DOKUMEN - bobot 10%
 * ============================================================================
 *
 * Lampiran SK Tabel 2 bagian II.
 */
const KELENGKAPAN = [
  {
    kunci: "eDokPetitum",
    label: "E-Dokumen petitum atau tuntutan",
    bobotPa: 2.5,
    bobotPta: 0,
    dasar: "SK 048/2024 Tabel 2 II.1 - ada nilai 5, tidak ada nilai 0.",
    keterangan: "Kelengkapan dokumen petitum yang diunggah ke SIPP.",
    nilai(f) {
      if (f.adaDokPetitum === undefined) return belumTerbaca("Dokumen petitum belum tersambung ke ALETA.");
      return f.adaDokPetitum ? poin(5, "Petitum terunggah.") : poin(0, "Petitum belum diunggah.");
    },
  },
  {
    kunci: "eDokRelaas",
    label: "E-Dokumen relaas",
    bobotPa: 2.5,
    bobotPta: 0,
    dasar: "SK 048/2024 Tabel 2 II.2 - lengkap 100% nilai 5, 71-99% nilai 3, 41-70% nilai 2, 1-40% nilai 1, tidak ada nilai 0.",
    keterangan: "Jumlah relaas yang seharusnya dihitung dari biaya panggilan yang dikeluarkan.",
    nilai(f) {
      const seharusnya = Number(f.relaasSeharusnya);
      if (!Number.isFinite(seharusnya)) return belumTerbaca("Jumlah relaas seharusnya belum tersambung ke ALETA.");
      if (seharusnya <= 0) return belumTerbaca("Perkara ini tidak mengeluarkan biaya panggilan.");
      const ada = Number(f.relaasBerdokumen) || 0;
      const persen = (ada / seharusnya) * 100;
      const nilai = persen >= 100 ? 5 : persen >= 71 ? 3 : persen >= 41 ? 2 : persen >= 1 ? 1 : 0;
      return poin(nilai, `${ada} dari ${seharusnya} relaas berdokumen (${Math.round(persen)}%).`);
    },
  },
  {
    kunci: "eDokBas",
    label: "E-Dokumen BAS",
    bobotPa: 3,
    bobotPta: 0,
    dasar: "SK 048/2024 Tabel 2 II.3 - 0 hari setelah sidang nilai 5, 1 hari 4, 2 hari 3, 3 hari 2, 4 hari 1.",
    keterangan:
      "BAS yang sudah ditandatangani pejabat terkait dan berbentuk PDF. Jumlah BAS mengikuti jumlah sidang. Tanggal hari sidang dibandingkan tanggal input e-doc terakhir pada SIPP.",
    nilai(f) {
      if (!Array.isArray(f.bas)) return belumTerbaca("Tanggal unggah BAS belum tersambung ke ALETA.");
      if (f.bas.length === 0) return belumTerbaca("Belum ada sidang yang berlalu.");

      const nilaiBas = f.bas.map((b) => {
        const selisih = hari(b.tanggalSidang, b.tanggalUnggah);
        // Tidak diunggah, atau lewat dari empat hari - keduanya nol.
        if (selisih === null) return 0;
        return tangga(selisih, [[0, 5], [1, 4], [2, 3], [3, 2], [4, 1]], 0);
      });
      const rata = nilaiBas.reduce((a, b) => a + b, 0) / nilaiBas.length;
      return poin(Math.round(rata * 10) / 10, `${f.bas.length} sidang dinilai BAS-nya.`);
    },
  },
  {
    kunci: "eDokAktaCerai",
    label: "E-Dokumen akta cerai",
    bobotPa: 2,
    bobotPta: 0,
    dasar: "SK 048/2024 Tabel 2 II.4 - 1 hari setelah BHT nilai 5, 2 hari 4, 3 hari 3, 4 hari 2, 5-6 hari 1.",
    keterangan: "Tanggal input akta cerai dibandingkan tanggal BHT.",
    nilai(f) {
      if (!f.wajibAktaCerai) return belumTerbaca("Perkara ini tidak menerbitkan akta cerai.");
      if (!f.tanggalBht) return belumTerbaca("Tanggal BHT belum tercatat.");
      if (!f.tanggalAktaCerai) return poin(0, "Akta cerai belum diinput.");
      const selisih = hari(f.tanggalBht, f.tanggalAktaCerai);
      if (selisih === null) return belumTerbaca("Tanggal akta cerai tidak terbaca.");
      return poin(tangga(selisih, [[1, 5], [2, 4], [3, 3], [4, 2], [6, 1]], 0), `Akta cerai ${selisih} hari setelah BHT.`);
    },
  },
  {
    kunci: "eDokAmarPutusan",
    label: "E-Dokumen amar putusan",
    bobotPa: 0,
    bobotPta: 10,
    dasar: "SK 048/2024 Tabel 1 - unsur ini berbobot pada pengadilan tingkat banding, tidak pada tingkat pertama.",
    keterangan: "Kelengkapan naskah amar putusan yang diunggah.",
    nilai(f) {
      if (f.adaAmarPutusan === undefined) return belumTerbaca("Dokumen amar putusan belum tersambung ke ALETA.");
      return f.adaAmarPutusan ? poin(5, "Amar putusan terunggah.") : poin(0, "Amar putusan belum diunggah.");
    },
  },
];

/**
 * ============================================================================
 * ASPEK KESESUAIAN - PENGURANG, bobot -10%
 * ============================================================================
 *
 * Lampiran SK Tabel 2 bagian III. Poinnya nol sampai minus lima: nol berarti
 * tidak ada yang dikurangi.
 */
const KESESUAIAN = [
  {
    kunci: "agendaSidangTerakhir",
    label: "Kesesuaian agenda sidang terakhir dengan tanggal putus",
    bobotPa: 2,
    bobotPta: 10,
    dasar: "SK 048/2024 Tabel 2 III.1 - sesuai nilai 0, selisih kurang dari 3 hari nilai -1, selisih 4 hari -2, 5 hari -3, 6 hari atau lebih -5.",
    keterangan: "Berlaku pada perkara putus, dikecualikan perkara talak kabul dan verzet.",
    nilai(f) {
      if (f.dikecualikanAgendaTerakhir) return belumTerbaca("Perkara talak kabul atau verzet - dikecualikan SK.");
      if (!f.tanggalPutus || !f.tanggalSidangTerakhir) return belumTerbaca("Tanggal sidang terakhir atau tanggal putus belum tercatat.");
      const selisih = Math.abs(hari(f.tanggalSidangTerakhir, f.tanggalPutus));
      if (selisih === 0) return poin(0, "Sidang terakhir jatuh pada tanggal putus.");
      return poin(
        tangga(selisih, [[3, -1], [4, -2], [5, -3]], -5),
        `Selisih ${selisih} hari antara sidang terakhir dan tanggal putus.`
      );
    },
  },
  {
    kunci: "sinkronisasi",
    label: "Sinkronisasi SIPP",
    bobotPa: 2,
    bobotPta: 0,
    dasar: "SK 048/2024 Tabel 2 III.2 - sinkron tiap hari nilai 0, tidak sinkron 1 hari -1, 2 hari -2, 3 hari -3, 4 hari atau lebih -5.",
    keterangan: "Dinilai atas satuan kerja dalam satu minggu, bukan atas satu perkara.",
    nilai(f) {
      if (f.hariTidakSinkron === undefined) return belumTerbaca("Sinkronisasi dinilai atas satker, bukan atas perkara.");
      return poin(
        tangga(Number(f.hariTidakSinkron) || 0, [[0, 0], [1, -1], [2, -2], [3, -3]], -5),
        `${Number(f.hariTidakSinkron) || 0} hari tidak sinkron dalam sepekan.`
      );
    },
  },
  {
    kunci: "permohonanDelegasi",
    label: "Permohonan panggilan delegasi (tabayun)",
    bobotPa: 2,
    bobotPta: 0,
    dasar: "SK 048/2024 Tabel 2 III.3 - 6 hari atau lebih sebelum sidang nilai 0, 5 hari -1, 4 hari -2, 3 hari -3, 2 hari atau kurang -5.",
    keterangan: "Tanggal permohonan delegasi dibandingkan hari sidang.",
    nilai(f) {
      if (f.hariSebelumSidangDelegasi === undefined) return belumTerbaca("Data permohonan delegasi belum tersambung ke ALETA.");
      if (f.hariSebelumSidangDelegasi === null) return belumTerbaca("Perkara ini tidak ada delegasi.");
      const h = Number(f.hariSebelumSidangDelegasi);
      const nilai = h >= 6 ? 0 : h === 5 ? -1 : h === 4 ? -2 : h === 3 ? -3 : -5;
      return poin(nilai, `Dimohonkan ${h} hari sebelum sidang.`);
    },
  },
  {
    kunci: "jenisPutusan",
    label: "Kesesuaian pengisian jenis putusan (verstek atau contradictoir)",
    bobotPa: 2,
    bobotPta: 0,
    dasar: "SK 048/2024 Tabel 2 III.4 - sesuai nilai 0, tidak sesuai nilai -5.",
    keterangan: "Jenis putusan pada SIPP dibandingkan kehadiran para pihak pada persidangan.",
    nilai(f) {
      if (f.jenisPutusanSesuai === undefined) return belumTerbaca("Kesesuaian jenis putusan belum dapat dinilai.");
      return f.jenisPutusanSesuai
        ? poin(0, "Jenis putusan sesuai proses persidangan.")
        : poin(-5, "Jenis putusan tidak sesuai proses persidangan.");
    },
  },
  {
    kunci: "validasiDataPerkara",
    label: "Validasi data perkara",
    bobotPa: 2,
    bobotPta: 0,
    dasar: "SK 048/2024 Tabel 1 dan Tabel 2 bagian III - unsur pengurang dengan bobot 2%.",
    keterangan: "Kesesuaian data perkara pada SIPP dengan berkasnya.",
    nilai(f) {
      if (f.dataPerkaraValid === undefined) return belumTerbaca("Validasi data perkara belum tersambung ke ALETA.");
      return f.dataPerkaraValid ? poin(0, "Data perkara valid.") : poin(-5, "Data perkara tidak valid.");
    },
  },
];

/** Seluruh unsur, sudah bertanda aspeknya. */
const UNSUR = [
  ...KINERJA,
  ...INPUT_DATA.map((u) => ({ ...u, aspek: "input" })),
  ...KELENGKAPAN.map((u) => ({ ...u, aspek: "kelengkapan" })),
  ...KESESUAIAN.map((u) => ({ ...u, aspek: "kesesuaian" })),
];

const ASPEK = {
  kinerja: { label: "Kinerja penanganan perkara", bobot: 50, pengurang: false },
  input: { label: "Input data SIPP", bobot: 40, pengurang: false },
  kelengkapan: { label: "Kelengkapan dokumen", bobot: 10, pengurang: false },
  kesesuaian: { label: "Kesesuaian", bobot: 10, pengurang: true },
};

function bobotUnsur(unsur, jenisPengadilan) {
  return jenisPengadilan === "banding" ? unsur.bobotPta : unsur.bobotPa;
}

/**
 * Poin satu perkara pada tiap unsur.
 *
 * Yang dikembalikan poin riil 5/3/2/1/0 sesuai Tabel 2 - bukan persentase.
 * Persentase baru bermakna setelah dikumpulkan satu satuan kerja.
 */
function poinPerkara(fakta = {}, { jenisPengadilan = "pertama" } = {}) {
  const rinci = [];
  for (const unsur of UNSUR) {
    const bobot = bobotUnsur(unsur, jenisPengadilan);
    // Unsur yang tidak berbobot pada tingkat ini tidak ikut dinilai.
    if (!bobot) continue;

    let hasil;
    try {
      hasil = unsur.nilai(fakta) || belumTerbaca("Unsur tidak menghasilkan nilai.");
    } catch (error) {
      hasil = belumTerbaca(`Gagal menilai: ${error && error.message ? error.message : error}`);
    }

    rinci.push({
      kunci: unsur.kunci,
      label: unsur.label,
      aspek: unsur.aspek,
      pengurang: ASPEK[unsur.aspek].pengurang,
      bobot,
      dasar: unsur.dasar,
      keterangan: unsur.keterangan,
      poin: hasil.poin,
      poinMaksimal: ASPEK[unsur.aspek].pengurang ? 0 : POIN_MAKSIMAL,
      poinMinimal: ASPEK[unsur.aspek].pengurang ? -POIN_MAKSIMAL : 0,
      terbaca: hasil.terbaca,
      catatan: hasil.catatan,
    });
  }

  const belum = rinci.filter((x) => !x.terbaca);
  return {
    jenisPengadilan,
    rinci,
    unsurBelumTersambung: belum.map((x) => ({ kunci: x.kunci, label: x.label, catatan: x.catatan })),
    dasar: "SK Dirjen Badilag Nomor 048/DJA/SK.KP3.4.3/IV/2024 tanggal 1 April 2024.",
    catatan:
      "Poin satu perkara menurut Tabel 2 SK. Nilai akhir SK dihitung atas seluruh perkara putus satu satuan kerja, bukan atas satu perkara.",
  };
}

/**
 * Nilai satuan kerja atas sekumpulan perkara - inilah nilai yang dimaksud SK.
 *
 *   Nilai Unsur X = (Nilai Riil / Nilai Maksimal) x 100% x bobot
 *   NKPP          = rata-rata nilai unsur aspek kinerja
 *   NKPS          = jumlah nilai unsur input + kelengkapan - kesesuaian
 *   NA            = NKPP + NKPS
 *
 * Unsur yang tidak terbaca pada suatu perkara dikeluarkan dari pembilang dan
 * penyebut perkara itu. Unsur yang tidak terbaca pada SELURUH perkara tidak
 * ikut dijumlahkan sama sekali, dan bobotnya dilaporkan sebagai bobot yang
 * belum dinilai supaya pembaca tahu nilai ini belum utuh.
 */
function nilaiSatker(daftarFakta = [], { jenisPengadilan = "pertama" } = {}) {
  const perkara = Array.isArray(daftarFakta) ? daftarFakta : [];
  const kumpulan = perkara.map((f) => poinPerkara(f, { jenisPengadilan }));

  const unsurNilai = [];
  for (const unsur of UNSUR) {
    const bobot = bobotUnsur(unsur, jenisPengadilan);
    if (!bobot) continue;

    let riil = 0;
    let jumlahDinilai = 0;
    for (const hasil of kumpulan) {
      const baris = hasil.rinci.find((x) => x.kunci === unsur.kunci);
      if (!baris || !baris.terbaca) continue;
      riil += Number(baris.poin) || 0;
      jumlahDinilai += 1;
    }

    const pengurang = ASPEK[unsur.aspek].pengurang;
    const maksimal = jumlahDinilai * POIN_MAKSIMAL;

    unsurNilai.push({
      kunci: unsur.kunci,
      label: unsur.label,
      aspek: unsur.aspek,
      pengurang,
      bobot,
      jumlahPerkaraDinilai: jumlahDinilai,
      poinRiil: Math.round(riil * 100) / 100,
      poinMaksimal: maksimal,
      // Pada unsur pengurang poin riilnya negatif, sehingga nilainya pun
      // negatif - itu yang dikurangkan dari nilai kepatuhan.
      nilai: maksimal > 0 ? Math.round((riil / maksimal) * bobot * 100) / 100 : null,
      dasar: unsur.dasar,
    });
  }

  const ambil = (aspek) => unsurNilai.filter((x) => x.aspek === aspek && x.nilai !== null);
  const jumlah = (daftar) => daftar.reduce((a, x) => a + x.nilai, 0);

  // SK Bab II huruf C angka 1 huruf a menyebut NKPP sebagai "rata-rata dari
  // nilai tiap-tiap unsur", dan rumusnya NKPP = NUWPP + NUWMBP + NUWUP.
  //
  // Yang dimaksud rata-rata di situ adalah rata-rata BERBOBOT, bukan jumlah
  // dibagi tiga. Bobot ketiga unsurnya 20% + 15% + 15% = 50%, sama dengan
  // bobot aspek kinerja itu sendiri; tiap unsur sudah dikalikan bobotnya pada
  // langkah sebelumnya, sehingga menjumlahkannya SUDAH menghasilkan
  // rata-rata berbobot. Membaginya tiga lagi akan membuat satker sempurna
  // bernilai 16,67 dan nilai akhir mentok di 66,67 - padahal SK menetapkan
  // predikat bintang lima pada nilai di atas 98%.
  const kinerja = ambil("kinerja");
  const nkpp = jumlah(kinerja);

  const input = ambil("input");
  const kelengkapan = ambil("kelengkapan");
  const kesesuaian = ambil("kesesuaian");
  const nkps = jumlah(input) + jumlah(kelengkapan) + jumlah(kesesuaian);

  const na = nkpp + nkps;

  // Bobot yang tidak dapat dinilai sama sekali - supaya jelas nilai ini belum
  // utuh dan tidak dipakai sebagai nilai resmi.
  const bobotTidakDinilai = unsurNilai
    .filter((x) => x.nilai === null)
    .reduce((a, x) => a + x.bobot, 0);

  return {
    jenisPengadilan,
    jumlahPerkara: perkara.length,
    nkpp: Math.round(nkpp * 100) / 100,
    nkps: Math.round(nkps * 100) / 100,
    nilaiAkhir: Math.round(na * 100) / 100,
    predikat: predikat(na),
    warna: warna(na),
    unsur: unsurNilai,
    bobotTidakDinilai: Math.round(bobotTidakDinilai * 100) / 100,
    utuh: bobotTidakDinilai === 0,
    dasar: "SK Dirjen Badilag Nomor 048/DJA/SK.KP3.4.3/IV/2024 tanggal 1 April 2024.",
    catatan:
      bobotTidakDinilai === 0
        ? "Seluruh unsur SK dinilai."
        : `Bobot ${Math.round(bobotTidakDinilai * 100) / 100}% belum dapat dinilai karena sumber datanya belum tersambung. Nilai ini belum utuh dan bukan nilai resmi Badilag.`,
  };
}

/** Bab III huruf B - format hasil penilaian. */
function predikat(persen) {
  const n = Number(persen) || 0;
  if (n > 98) return { bintang: 5, label: "sangat memuaskan" };
  if (n > 95) return { bintang: 4, label: "memuaskan" };
  if (n > 90) return { bintang: 3, label: "sangat baik" };
  if (n > 75) return { bintang: 2, label: "baik" };
  return { bintang: 1, label: "cukup" };
}

/** Bab III huruf C - kode pewarnaan pada hasil penilaian. */
function warna(persen) {
  const n = Number(persen) || 0;
  if (n > 90) return "hijau";
  if (n > 60) return "kuning";
  return "merah";
}

/**
 * Bab III huruf A - kategori satuan kerja menurut jumlah perkara tahun
 * sebelumnya (sisa perkara ditambah perkara masuk).
 */
function kategoriSatker(jumlahPerkara, jenisPengadilan = "pertama") {
  const n = Number(jumlahPerkara) || 0;
  if (jenisPengadilan === "banding") {
    if (n >= 151) return "I";
    if (n >= 51) return "II";
    return "III";
  }
  // SK Bab III huruf A angka 2 menulis Kategori I "5000 ke atas" sekaligus
  // Kategori II "2501 - 5000" - keduanya memuat angka 5000. Yang dipakai di
  // sini penyebutan yang tegas, yaitu 5000 masuk Kategori I.
  if (n >= 5000) return "I";
  if (n >= 2501) return "II";
  if (n >= 1001) return "III";
  if (n >= 251) return "IV";
  return "V";
}

module.exports = {
  ASPEK,
  KESESUAIAN,
  KELENGKAPAN,
  KINERJA,
  INPUT_DATA,
  POIN_MAKSIMAL,
  UNSUR,
  kategoriSatker,
  kelonggaranWaktuPutus,
  nilaiSatker,
  poinPerkara,
  predikat,
  warna,
};
