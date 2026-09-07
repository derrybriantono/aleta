"use strict";

/**
 * ============================================================================
 * HARI LIBUR NASIONAL - TANPA INI, "HARI KERJA" BERBOHONG
 * ============================================================================
 *
 * Penilaian ketaatan tenggang pemanggilan menghitung HARI KERJA. Selama yang
 * dikecualikan baru Sabtu dan Minggu, hitungan itu menuduh juru sita yang
 * justru tidak dapat bekerja.
 *
 * Contohnya nyata dan sering: relaas disampaikan Selasa untuk sidang Senin
 * pekan berikutnya. Empat hari kerja - lulus. Tetapi bila Rabu sampai Jumat
 * adalah cuti bersama Idulfitri, yang sebenarnya hanya SATU hari kerja, dan
 * juru sita itu tidak melakukan kesalahan apa pun.
 *
 * ============================================================================
 * YANG DITULIS DI SINI USULAN, BUKAN KETETAPAN
 * ============================================================================
 *
 * Hari libur nasional dan cuti bersama ditetapkan tiap tahun lewat Surat
 * Keputusan Bersama tiga menteri. Tanggalnya - terutama hari besar keagamaan
 * yang mengikuti penanggalan hijriah - TIDAK dapat dihitung sendiri dengan
 * pasti, dan tidak boleh ditebak.
 *
 * Maka tiap tahun di berkas ini membawa penanda `disahkan`. Selama masih
 * `false`, hitungan hari kerja untuk tahun itu tetap berjalan TETAPI melaporkan
 * bahwa dasarnya belum disahkan - dan penilaian yang memakainya membawa
 * keterangan itu sampai ke layar.
 *
 * Mengesahkan berarti seseorang membuka SKB-nya, mencocokkan tanggalnya, lalu
 * mengubah penanda itu menjadi true beserta nomor SKB-nya. Bukan pekerjaan
 * besar - tetapi tanpa itu, angka ketaatan tidak boleh dipakai membina.
 *
 * ============================================================================
 * MENGAPA TIDAK DIAMBIL DARI INTERNET
 * ============================================================================
 *
 * Server pengadilan tidak menjangkau internet, dan tidak seharusnya menjangkau.
 * Daftar yang diambil dari luar juga berarti angka penilaian dapat berubah
 * karena sumber di luar kendali pengadilan berubah - persis yang dihindari
 * seluruh rancangan ini.
 */

/**
 * Hari libur nasional dan cuti bersama.
 *
 * Sumber: Surat Keputusan Bersama Menteri Agama, Menteri Ketenagakerjaan, dan
 * Menteri PANRB tentang Hari Libur Nasional dan Cuti Bersama.
 *
 * TAHUN 2026 SUDAH DISAHKAN terhadap SKB Nomor 1497/2/5 Tahun 2025. Tanggalnya
 * disalin dari lampiran, dan tiap harinya diperiksa terhadap kalender.
 *
 * TAHUN 2024 DAN 2025 MASIH BERPENANDA `disahkan: false`. Tanggalnya disusun
 * dari pengetahuan umum dan belum dicocokkan dengan SKB masing-masing tahun.
 * Selama itu, hitungan hari kerja untuk kedua tahun tersebut tetap berjalan
 * tetapi membawa keterangan bahwa dasarnya belum dipastikan.
 *
 * Pengesahan 2026 memperbaiki delapan tanggal yang sebelumnya HILANG - antara
 * lain 23 dan 24 Maret yang jatuh Senin dan Selasa. Selama kedelapan tanggal
 * itu belum masuk, hari yang sebenarnya libur terhitung sebagai hari kerja,
 * dan relaas yang tenggangnya kurang justru lolos.
 */
const TAHUN = {
  2024: {
    disahkan: false,
    skb: null,
    catatan: "Belum dicocokkan dengan SKB. Tanggal hari besar keagamaan wajib diperiksa.",
    libur: [
      ["2024-01-01", "Tahun Baru Masehi"],
      ["2024-02-08", "Isra Mikraj Nabi Muhammad SAW"],
      ["2024-02-09", "Cuti Bersama Tahun Baru Imlek"],
      ["2024-02-10", "Tahun Baru Imlek"],
      ["2024-03-11", "Hari Suci Nyepi"],
      ["2024-03-12", "Cuti Bersama Nyepi"],
      ["2024-03-29", "Wafat Isa Almasih"],
      ["2024-03-31", "Hari Paskah"],
      ["2024-04-08", "Cuti Bersama Idulfitri"],
      ["2024-04-09", "Cuti Bersama Idulfitri"],
      ["2024-04-10", "Idulfitri 1445 H"],
      ["2024-04-11", "Idulfitri 1445 H"],
      ["2024-04-12", "Cuti Bersama Idulfitri"],
      ["2024-04-15", "Cuti Bersama Idulfitri"],
      ["2024-05-01", "Hari Buruh Internasional"],
      ["2024-05-09", "Kenaikan Isa Almasih"],
      ["2024-05-10", "Cuti Bersama Kenaikan Isa Almasih"],
      ["2024-05-23", "Hari Raya Waisak"],
      ["2024-05-24", "Cuti Bersama Waisak"],
      ["2024-06-01", "Hari Lahir Pancasila"],
      ["2024-06-17", "Iduladha 1445 H"],
      ["2024-06-18", "Cuti Bersama Iduladha"],
      ["2024-07-07", "Tahun Baru Islam 1446 H"],
      ["2024-08-17", "Hari Kemerdekaan Republik Indonesia"],
      ["2024-09-16", "Maulid Nabi Muhammad SAW"],
      ["2024-12-25", "Hari Raya Natal"],
      ["2024-12-26", "Cuti Bersama Natal"],
    ],
  },
  2025: {
    disahkan: false,
    skb: null,
    catatan: "Belum dicocokkan dengan SKB. Tanggal hari besar keagamaan wajib diperiksa.",
    libur: [
      ["2025-01-01", "Tahun Baru Masehi"],
      ["2025-01-27", "Isra Mikraj Nabi Muhammad SAW"],
      ["2025-01-28", "Cuti Bersama Tahun Baru Imlek"],
      ["2025-01-29", "Tahun Baru Imlek"],
      ["2025-03-14", "Cuti Bersama Nyepi"],
      ["2025-03-29", "Hari Suci Nyepi"],
      ["2025-03-31", "Idulfitri 1446 H"],
      ["2025-04-01", "Idulfitri 1446 H"],
      ["2025-04-02", "Cuti Bersama Idulfitri"],
      ["2025-04-03", "Cuti Bersama Idulfitri"],
      ["2025-04-04", "Cuti Bersama Idulfitri"],
      ["2025-04-07", "Cuti Bersama Idulfitri"],
      ["2025-04-18", "Wafat Isa Almasih"],
      ["2025-04-20", "Hari Paskah"],
      ["2025-05-01", "Hari Buruh Internasional"],
      ["2025-05-12", "Hari Raya Waisak"],
      ["2025-05-13", "Cuti Bersama Waisak"],
      ["2025-05-29", "Kenaikan Isa Almasih"],
      ["2025-05-30", "Cuti Bersama Kenaikan Isa Almasih"],
      ["2025-06-01", "Hari Lahir Pancasila"],
      ["2025-06-06", "Iduladha 1446 H"],
      ["2025-06-09", "Cuti Bersama Iduladha"],
      ["2025-06-27", "Tahun Baru Islam 1447 H"],
      ["2025-08-17", "Hari Kemerdekaan Republik Indonesia"],
      ["2025-09-05", "Maulid Nabi Muhammad SAW"],
      ["2025-12-25", "Hari Raya Natal"],
      ["2025-12-26", "Cuti Bersama Natal"],
    ],
  },
  2026: {
    // Dicocokkan dengan SKB aslinya pada 7 September 2026. Seluruh dua puluh
    // lima tanggal diperiksa harinya terhadap kalender - tidak satu pun
    // meleset dari yang tertulis di lampiran.
    disahkan: true,
    skb: "Nomor 1497 Tahun 2025, Nomor 2 Tahun 2025, dan Nomor 5 Tahun 2025",
    ditetapkan: "2025-09-19",
    catatan:
      "Sudah dicocokkan dengan SKB tiga menteri. Lampiran A memuat 16 butir hari libur nasional " +
      "(butir 5 mencakup dua tanggal) dan Lampiran B memuat 6 butir cuti bersama " +
      "(butir 3 mencakup tiga tanggal), seluruhnya 25 tanggal.",
    libur: [
      // ---- A. HARI LIBUR NASIONAL (Lampiran A, 16 butir / 17 tanggal) ----
      ["2026-01-01", "Tahun Baru 2026 Masehi"],
      ["2026-01-16", "Isra Mikraj Nabi Muhammad SAW"],
      // Cuti bersama Imlek jatuh SEBELUM hari rayanya - 16 Februari cuti
      // bersama, 17 Februari hari liburnya.
      ["2026-02-16", "Cuti Bersama Tahun Baru Imlek 2577 Kongzili"],
      ["2026-02-17", "Tahun Baru Imlek 2577 Kongzili"],
      ["2026-03-18", "Cuti Bersama Hari Suci Nyepi"],
      ["2026-03-19", "Hari Suci Nyepi (Tahun Baru Saka 1948)"],
      // Idul Fitri 1447 H jatuh Sabtu-Minggu, sehingga rangkaian cuti
      // bersamanya terbelah: Jumat sebelumnya, lalu Senin dan Selasa
      // sesudahnya. Ketiga hari itulah yang benar-benar mengurangi hari kerja;
      // hari rayanya sendiri sudah akhir pekan.
      ["2026-03-20", "Cuti Bersama Idul Fitri 1447 Hijriah"],
      ["2026-03-21", "Idul Fitri 1447 Hijriah"],
      ["2026-03-22", "Idul Fitri 1447 Hijriah"],
      ["2026-03-23", "Cuti Bersama Idul Fitri 1447 Hijriah"],
      ["2026-03-24", "Cuti Bersama Idul Fitri 1447 Hijriah"],
      ["2026-04-03", "Wafat Yesus Kristus"],
      ["2026-04-05", "Kebangkitan Yesus Kristus (Paskah)"],
      ["2026-05-01", "Hari Buruh Internasional"],
      ["2026-05-14", "Kenaikan Yesus Kristus"],
      ["2026-05-15", "Cuti Bersama Kenaikan Yesus Kristus"],
      ["2026-05-27", "Idul Adha 1447 Hijriah"],
      ["2026-05-28", "Cuti Bersama Idul Adha 1447 Hijriah"],
      ["2026-05-31", "Hari Raya Waisak 2570 BE"],
      ["2026-06-01", "Hari Lahir Pancasila"],
      ["2026-06-16", "1 Muharam Tahun Baru Islam 1448 Hijriah"],
      ["2026-08-17", "Proklamasi Kemerdekaan"],
      ["2026-08-25", "Maulid Nabi Muhammad SAW"],
      ["2026-12-24", "Cuti Bersama Kelahiran Yesus Kristus"],
      ["2026-12-25", "Kelahiran Yesus Kristus"],
    ],
  },
};

const POLA_TANGGAL = /^(\d{4})-\d{2}-\d{2}$/;

/** Peta tanggal -> nama libur, disusun sekali. */
const PETA = Object.create(null);
Object.keys(TAHUN).forEach((t) => {
  TAHUN[t].libur.forEach(([tanggal, nama]) => {
    PETA[tanggal] = { nama, tahun: Number(t) };
  });
});

/** Tahun yang daftarnya tersedia, apa pun keadaan pengesahannya. */
function tahunTersedia() {
  return Object.keys(TAHUN)
    .map(Number)
    .sort((a, b) => a - b);
}

function keadaanTahun(tahun) {
  const t = TAHUN[String(tahun)];
  if (!t) {
    return {
      ada: false,
      disahkan: false,
      jumlah: 0,
      sebab: `Daftar hari libur tahun ${tahun} belum ada. Hitungan hari kerja untuk tahun itu hanya mengecualikan Sabtu dan Minggu.`,
    };
  }
  return {
    ada: true,
    disahkan: Boolean(t.disahkan),
    skb: t.skb,
    jumlah: t.libur.length,
    catatan: t.catatan,
    sebab: t.disahkan
      ? null
      : `Daftar hari libur tahun ${tahun} belum disahkan terhadap SKB. Angka hari kerja untuk tahun itu belum boleh dipakai membina.`,
  };
}

/** Apakah sebuah tanggal hari libur nasional atau cuti bersama? */
function hariLibur(tanggal) {
  const t = String(tanggal || "").trim();
  if (!POLA_TANGGAL.test(t)) return null;
  return Object.prototype.hasOwnProperty.call(PETA, t) ? PETA[t] : null;
}

/**
 * Keadaan pengesahan untuk sebuah rentang tanggal.
 *
 * Rentang yang melintasi tahun yang belum disahkan MEMBAWA keterangan itu -
 * bukan diam-diam dihitung seolah daftarnya lengkap.
 */
function keadaanRentang(mulai, selesai) {
  const a = POLA_TANGGAL.exec(String(mulai || ""));
  const b = POLA_TANGGAL.exec(String(selesai || ""));
  if (!a || !b) return { dapatDipercaya: false, sebab: "tanggalnya tidak sah" };

  const dari = Number(a[1]);
  const sampai = Number(b[1]);
  const belum = [];
  const tanpaDaftar = [];
  for (let t = dari; t <= sampai; t += 1) {
    const k = keadaanTahun(t);
    if (!k.ada) tanpaDaftar.push(t);
    else if (!k.disahkan) belum.push(t);
  }

  const bagian = [];
  if (tanpaDaftar.length) {
    bagian.push(
      `daftar hari libur tahun ${tanpaDaftar.join(", ")} belum ada sama sekali - yang dikecualikan hanya Sabtu dan Minggu`
    );
  }
  if (belum.length) {
    bagian.push(`daftar hari libur tahun ${belum.join(", ")} belum disahkan terhadap SKB`);
  }

  return {
    dapatDipercaya: bagian.length === 0,
    tahunBelumDisahkan: belum,
    tahunTanpaDaftar: tanpaDaftar,
    sebab: bagian.length ? bagian.join("; ") : null,
  };
}

/** Seluruh hari libur pada sebuah tahun, terurut. */
function daftarTahun(tahun) {
  const t = TAHUN[String(tahun)];
  if (!t) return [];
  return t.libur
    .map(([tanggal, nama]) => ({ tanggal, nama }))
    .sort((x, y) => x.tanggal.localeCompare(y.tanggal));
}

module.exports = {
  TAHUN,
  tahunTersedia,
  keadaanTahun,
  keadaanRentang,
  hariLibur,
  daftarTahun,
};
