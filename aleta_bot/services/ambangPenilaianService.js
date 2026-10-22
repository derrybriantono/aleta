"use strict";

/**
 * ============================================================================
 * AMBANG PENILAIAN BESERTA DASAR HUKUM DAN TANGGAL BERLAKUNYA
 * ============================================================================
 *
 * Setiap penilaian membandingkan sesuatu dengan sebuah angka: tiga hari kerja,
 * empat belas hari, lima bulan, tanggal lima. Angka-angka itu tidak lahir dari
 * kesepakatan tim - ia berasal dari peraturan, dan peraturan berubah.
 *
 * Selama ambang dipatok di dalam kode, tiga hal terjadi sekaligus:
 *
 *   - setiap perubahan peraturan menuntut pembongkaran program;
 *   - tidak ada yang dapat menjawab "atas dasar apa angkanya tiga?"; dan
 *   - yang paling berbahaya, mengubah angkanya membuat NILAI PERIODE LAMPAU
 *     ikut bergeser tanpa ada yang menyadarinya. Laporan bulan lalu yang sudah
 *     ditandatangani mendadak tidak dapat direproduksi.
 *
 * Maka ambang disimpan sebagai RIWAYAT, bukan sebagai satu angka. Menanyakan
 * ambang selalu menyertakan tanggal, dan yang dijawab adalah yang berlaku pada
 * tanggal itu.
 *
 * ============================================================================
 * DUA SIFAT YANG BERBEDA
 * ============================================================================
 *
 *   peraturan  - hanya boleh berubah bila peraturannya berubah. Perubahannya
 *                menuntut penyebutan peraturan penggantinya.
 *   kebijakan  - ditetapkan pimpinan pengadilan. Boleh berubah, tetapi
 *                perubahannya tetap bertanggal dan tercatat.
 *
 * Membedakan keduanya bukan kerapian. Ambang berdasar peraturan yang diubah
 * diam-diam adalah pelanggaran; ambang kebijakan yang diubah adalah keputusan
 * pimpinan. Keduanya tidak boleh tampak sama pada layar.
 */

/**
 * Riwayat tiap ambang, terurut dari yang paling lama.
 *
 * `mulai` bertanggal almanak. Nilai sebelum tanggal berlaku pertama TIDAK ADA -
 * dan itu jawaban yang jujur untuk periode sebelum aturannya lahir, jauh lebih
 * baik daripada memakai angka hari ini secara mundur.
 */
const AMBANG = Object.assign(Object.create(null), {
  tenggangPanggilan: {
    label: "Tenggang panggilan patut",
    satuan: "hari kerja",
    sifat: "peraturan",
    keterangan: "Panggilan sah sekurangnya tiga hari kerja sebelum sidang.",
    riwayat: [
      { mulai: "1848-01-01", nilai: 3, dasar: "Pasal 146 RBg" },
    ],
  },
  /**
   * ==========================================================================
   * TENGGANG PENGINPUTAN - BERSIFAT KEBIJAKAN, DAN ITU DISENGAJA
   * ==========================================================================
   *
   * Ambang ini memisahkan "diinput tepat waktu" dari "terlambat diinput".
   * Ia TIDAK ditandai sebagai peraturan, sebab dasar peraturannya belum
   * diperiksa terhadap naskah resminya.
   *
   * Yang diketahui: ALETA sudah lama memakai skala 0 hari bernilai 5, 1 hari
   * 3, 2 hari 2, 3 hari 1, selebihnya 0 - di dalam pemberitahuan harian yang
   * dikirimkannya. Skala itu dipakai tiap hari dan tidak pernah dipersoalkan,
   * tetapi dipakai bukan berarti berdasar; itu dua hal yang berbeda dan
   * menyamakannya adalah cara paling mudah menuliskan dasar hukum yang tidak
   * ada.
   *
   * Angka satu dipilih sebagai batas "tepat": peristiwa yang diinput pada hari
   * yang sama atau keesokan harinya masih wajar - petugas mengetik pagi
   * berikutnya - sedangkan mulai hari kedua jaraknya sudah menjadi keterangan
   * tentang cara kerja, bukan tentang jam kerja.
   *
   * WAJIB ditinjau ulang begitu ada pengukuran atas data nyata. Ambang yang
   * ditetapkan tanpa melihat sebarannya akan menuduh atau membebaskan seluruh
   * pengadilan sekaligus, dan keduanya sama-sama tidak berguna.
   */
  ketepatanInput: {
    label: "Tenggang penginputan peristiwa ke SIPP",
    satuan: "hari",
    sifat: "kebijakan",
    keterangan:
      "Peristiwa perkara diinput ke SIPP pada hari yang sama atau keesokan harinya. Belum ditetapkan pimpinan; angkanya sementara, menunggu pengukuran atas data nyata.",
    riwayat: [
      {
        mulai: "2026-09-10",
        nilai: 1,
        dasar:
          "Sementara - dari skala yang sudah dipakai pemberitahuan harian ALETA. Dasar peraturannya belum diperiksa terhadap naskah resmi.",
      },
    ],
  },
  minutasiBerkas: {
    label: "Tenggang minutasi berkas",
    satuan: "hari",
    sifat: "peraturan",
    keterangan: "Berkas diminutasi paling lambat empat belas hari sesudah putusan diucapkan.",
    riwayat: [
      { mulai: "2024-01-01", nilai: 14, dasar: "SK Dirjen Badilag 048/DJA/SK.KP3.4.3/IV/2024" },
    ],
  },
  publikasiPutusan: {
    label: "Tenggang publikasi direktori putusan",
    satuan: "hari kerja",
    sifat: "peraturan",
    keterangan: "Putusan diunggah ke direktori paling lambat satu hari kerja sesudah diminutasi.",
    riwayat: [
      { mulai: "2024-01-01", nilai: 1, dasar: "SK Dirjen Badilag 048/DJA/SK.KP3.4.3/IV/2024" },
    ],
  },
  asasPenyelesaian: {
    label: "Asas penyelesaian perkara",
    satuan: "bulan",
    sifat: "peraturan",
    keterangan: "Perkara diselesaikan paling lama lima bulan sejak didaftarkan.",
    riwayat: [
      { mulai: "2014-04-13", nilai: 5, dasar: "SEMA 2 Tahun 2014" },
    ],
  },
  tenggangBanding: {
    label: "Tenggang menyatakan banding",
    satuan: "hari",
    sifat: "peraturan",
    keterangan: "Empat belas hari sejak putusan diucapkan atau diberitahukan.",
    riwayat: [{ mulai: "1947-06-06", nilai: 14, dasar: "Pasal 7 UU 20 Tahun 1947" }],
  },
  tenggangKasasi: {
    label: "Tenggang menyatakan kasasi",
    satuan: "hari",
    sifat: "peraturan",
    keterangan: "Empat belas hari sejak putusan banding diberitahukan.",
    riwayat: [{ mulai: "1985-12-30", nilai: 14, dasar: "Pasal 46 UU 14 Tahun 1985" }],
  },
  jangkaMediasi: {
    label: "Jangka waktu mediasi",
    satuan: "hari",
    sifat: "peraturan",
    keterangan: "Tiga puluh hari sejak penetapan mediator, dapat diperpanjang tiga puluh hari.",
    riwayat: [{ mulai: "2016-02-04", nilai: 30, dasar: "PERMA 1 Tahun 2016" }],
  },
  batasKirimLaporan: {
    label: "Batas kirim laporan perkara",
    satuan: "tanggal",
    sifat: "peraturan",
    keterangan: "LIPA 1 sampai 13 dikirim paling lambat tanggal lima bulan berikutnya.",
    riwayat: [{ mulai: "2024-01-01", nilai: 5, dasar: "Petunjuk pelaporan Ditjen Badilag" }],
  },
  batasKirimLaporanDipa: {
    label: "Batas kirim laporan berbiaya DIPA 04",
    satuan: "tanggal",
    sifat: "peraturan",
    keterangan: "LIPA 14 sampai 22 dikirim paling lambat tanggal sepuluh bulan berikutnya.",
    riwayat: [{ mulai: "2024-01-01", nilai: 10, dasar: "Petunjuk pelaporan Ditjen Badilag" }],
  },
  pembatasPenyebut: {
    label: "Pembatas kecukupan penyebut",
    satuan: "perkara",
    sifat: "kebijakan",
    keterangan:
      "Nilai hanya ditampilkan bila penyebutnya sekurangnya dua puluh. Di bawah itu yang tampil daftarnya.",
    riwayat: [{ mulai: "2026-09-01", nilai: 20, dasar: "Kebijakan Pengadilan Agama Donggala" }],
  },
  batasKendali: {
    label: "Batas peta kendali",
    satuan: "simpangan baku",
    sifat: "kebijakan",
    keterangan: "Titik di luar dua simpangan baku ditandai menyimpang.",
    riwayat: [{ mulai: "2026-09-01", nilai: 2, dasar: "Kebijakan Pengadilan Agama Donggala" }],
  },
  cakupanRendah: {
    label: "Ambang cakupan rendah",
    satuan: "persen",
    sifat: "kebijakan",
    keterangan:
      "Angka yang dihitung dari kurang dari empat puluh persen populasinya diberi penanda berwarna.",
    riwayat: [{ mulai: "2026-09-01", nilai: 40, dasar: "Kebijakan Pengadilan Agama Donggala" }],
  },
});

const POLA_TANGGAL = /^\d{4}-\d{2}-\d{2}$/;

function sahTanggal(t) {
  return POLA_TANGGAL.test(String(t || ""));
}

/** Daftar kunci ambang yang dikenal. */
function daftarAmbang() {
  return Object.keys(AMBANG).map((kunci) => ({
    kunci,
    label: AMBANG[kunci].label,
    satuan: AMBANG[kunci].satuan,
    sifat: AMBANG[kunci].sifat,
    keterangan: AMBANG[kunci].keterangan,
    riwayat: AMBANG[kunci].riwayat.map((r) => ({ ...r })),
  }));
}

/**
 * Ambang yang berlaku pada sebuah tanggal.
 *
 * Memulangkan null bila tanggalnya mendahului tanggal berlaku pertama. Itu
 * jawaban yang jujur - memakai angka hari ini untuk periode sebelum aturannya
 * lahir adalah menilai orang dengan aturan yang belum ada.
 */
function ambangBerlaku(kunci, tanggal) {
  const butir = Object.prototype.hasOwnProperty.call(AMBANG, kunci) ? AMBANG[kunci] : null;
  if (!butir) throw new Error(`Ambang tidak dikenali: ${kunci}`);
  if (!sahTanggal(tanggal)) throw new Error(`Tanggal harus YYYY-MM-DD, dapat: ${tanggal}`);

  let berlaku = null;
  for (const r of butir.riwayat) {
    if (r.mulai <= tanggal) berlaku = r;
    else break;
  }
  if (!berlaku) {
    return {
      kunci,
      label: butir.label,
      satuan: butir.satuan,
      sifat: butir.sifat,
      nilai: null,
      dasar: null,
      mulai: null,
      sebab: `Belum ada ambang yang berlaku pada ${tanggal}; yang paling awal mulai ${butir.riwayat[0].mulai}.`,
    };
  }
  return {
    kunci,
    label: butir.label,
    satuan: butir.satuan,
    sifat: butir.sifat,
    keterangan: butir.keterangan,
    nilai: berlaku.nilai,
    dasar: berlaku.dasar,
    mulai: berlaku.mulai,
  };
}

/**
 * Seluruh ambang yang berlaku pada sebuah tanggal, sebagai satu kumpulan.
 *
 * Kumpulan inilah yang DISIMPAN bersama nilai pada MS03, dan yang DICETAK pada
 * kaki tiap ekspor. Tanpa itu, dua cetakan yang berbeda angkanya tidak dapat
 * dijelaskan - dan yang dipersalahkan aplikasinya.
 */
function kumpulanAmbang(tanggal) {
  const kumpulan = {};
  Object.keys(AMBANG).forEach((kunci) => {
    const a = ambangBerlaku(kunci, tanggal);
    kumpulan[kunci] = a.nilai;
  });
  return kumpulan;
}

/**
 * Sidik kumpulan ambang - tulisan pendek yang berubah bila ada satu saja
 * ambang yang berbeda.
 *
 * Dipakai MS03 untuk menjawab "apakah nilai ini dihitung dengan aturan yang
 * sama dengan sekarang?" tanpa harus membandingkan seluruh isinya.
 */
function sidikAmbang(tanggal) {
  const kumpulan = kumpulanAmbang(tanggal);
  return Object.keys(kumpulan)
    .sort()
    .map((k) => `${k}=${kumpulan[k] === null ? "-" : kumpulan[k]}`)
    .join(";");
}

module.exports = {
  AMBANG,
  daftarAmbang,
  ambangBerlaku,
  kumpulanAmbang,
  sidikAmbang,
};
