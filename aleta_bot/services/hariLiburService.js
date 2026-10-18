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
 * TAHUN 2024 DAN 2025 KINI JUGA DISAHKAN, terhadap daftar resmi SKB masing-
 * masing tahun. Pengesahan itu langsung membayar dirinya: daftar 2025 yang
 * semula disusun dari pengetahuan umum ternyata memuat cuti bersama Nyepi pada
 * tanggal yang KELIRU, dan tidak memuat cuti bersama HUT ke-80 Kemerdekaan RI
 * sama sekali.
 *
 * Berbeda dengan 2026 yang dicocokkan terhadap pindaian SKB aslinya, kedua
 * tahun ini dicocokkan terhadap daftar resmi yang dimuat sumber publik. Tiap
 * tahun membawa ruas `sumber` yang menyebutkan dari mana daftarnya diambil,
 * supaya siapa pun dapat memeriksa ulang tanpa menebak.
 *
 * Pengesahan 2026 memperbaiki delapan tanggal yang sebelumnya HILANG - antara
 * lain 23 dan 24 Maret yang jatuh Senin dan Selasa. Selama kedelapan tanggal
 * itu belum masuk, hari yang sebenarnya libur terhitung sebagai hari kerja,
 * dan relaas yang tenggangnya kurang justru lolos.
 */
const TAHUN = {
  2024: {
    // Dicocokkan 7 September 2026 terhadap daftar resmi SKB. Ketujuh belas
    // hari libur nasional dan kesepuluh cuti bersamanya COCOK SELURUHNYA
    // dengan daftar yang semula disusun dari pengetahuan umum - tidak satu
    // pun tanggal meleset.
    disahkan: true,
    skb: "Nomor 855 Tahun 2023, Nomor 3 Tahun 2023, dan Nomor 4 Tahun 2023",
    sumber:
      "Daftar resmi Kemenko PMK dan Indonesia Baik. Berkas SKB yang ditandatangani belum dibaca langsung - berbeda dengan 2026 yang dicocokkan terhadap pindaian aslinya.",
    catatan:
      "17 hari libur nasional dan 10 cuti bersama, seluruhnya 27 tanggal.",
    libur: [
      ["2024-01-01", "Tahun Baru 2024 Masehi"],
      ["2024-02-08", "Isra Mikraj Nabi Muhammad SAW"],
      ["2024-02-09", "Cuti Bersama Tahun Baru Imlek"],
      ["2024-02-10", "Tahun Baru Imlek 2575 Kongzili"],
      ["2024-03-11", "Hari Suci Nyepi Tahun Baru Saka 1946"],
      ["2024-03-12", "Cuti Bersama Hari Suci Nyepi"],
      ["2024-03-29", "Wafat Isa Almasih"],
      ["2024-03-31", "Hari Paskah"],
      ["2024-04-08", "Cuti Bersama Idulfitri 1445 H"],
      ["2024-04-09", "Cuti Bersama Idulfitri 1445 H"],
      ["2024-04-10", "Idulfitri 1445 H"],
      ["2024-04-11", "Idulfitri 1445 H"],
      ["2024-04-12", "Cuti Bersama Idulfitri 1445 H"],
      ["2024-04-15", "Cuti Bersama Idulfitri 1445 H"],
      ["2024-05-01", "Hari Buruh Internasional"],
      ["2024-05-09", "Kenaikan Isa Almasih"],
      ["2024-05-10", "Cuti Bersama Kenaikan Isa Almasih"],
      ["2024-05-23", "Hari Raya Waisak 2568 BE"],
      ["2024-05-24", "Cuti Bersama Hari Raya Waisak"],
      ["2024-06-01", "Hari Lahir Pancasila"],
      ["2024-06-17", "Iduladha 1445 H"],
      ["2024-06-18", "Cuti Bersama Iduladha 1445 H"],
      ["2024-07-07", "Tahun Baru Islam 1446 H"],
      ["2024-08-17", "Proklamasi Kemerdekaan"],
      ["2024-09-16", "Maulid Nabi Muhammad SAW"],
      ["2024-12-25", "Kelahiran Yesus Kristus"],
      ["2024-12-26", "Cuti Bersama Kelahiran Yesus Kristus"],
    ],
  },
  2025: {
    // ========================================================================
    // TIGA KEKELIRUAN YANG DITEMUKAN SAAT PENGESAHAN
    // ========================================================================
    //
    // Daftar yang semula disusun dari pengetahuan umum memuat:
    //
    //   1. Cuti bersama Nyepi pada 14 MARET - yang benar 28 Maret.
    //   2. Tidak memuat 28 Maret sama sekali.
    //   3. Tidak memuat 18 Agustus - cuti bersama HUT ke-80 Kemerdekaan RI
    //      yang ditetapkan lewat SKB perubahan, ditandatangani 7 Agustus 2025.
    //
    // Kekeliruan pertama yang paling merugikan: 14 Maret 2025 jatuh pada
    // Jumat, dan menghitungnya libur berarti satu hari kerja hilang dari
    // hitungan tenggang - sedangkan 28 Maret yang benar-benar libur justru
    // terhitung hari kerja. Dua kesalahan yang saling menutupi pada jumlah
    // keseluruhan, tetapi menggeser tenggang tiap perkara di antaranya.
    disahkan: true,
    skb: "Nomor 1017 Tahun 2024, Nomor 2 Tahun 2024, dan Nomor 2 Tahun 2024",
    skbPerubahan:
      "SKB perubahan yang ditandatangani 7 Agustus 2025, menambahkan cuti bersama 18 Agustus 2025 untuk HUT ke-80 Kemerdekaan RI",
    sumber:
      "Daftar resmi SKB 3 Menteri sebagaimana dimuat sumber publik, beserta SKB perubahannya. Berkas yang ditandatangani belum dibaca langsung - berbeda dengan 2026 yang dicocokkan terhadap pindaian aslinya.",
    catatan:
      "17 hari libur nasional, 10 cuti bersama, ditambah 1 cuti bersama dari SKB perubahan - seluruhnya 28 tanggal.",
    libur: [
      ["2025-01-01", "Tahun Baru 2025 Masehi"],
      ["2025-01-27", "Isra Mikraj Nabi Muhammad SAW"],
      ["2025-01-28", "Cuti Bersama Tahun Baru Imlek"],
      ["2025-01-29", "Tahun Baru Imlek 2576 Kongzili"],
      ["2025-03-28", "Cuti Bersama Hari Suci Nyepi"],
      ["2025-03-29", "Hari Suci Nyepi Tahun Baru Saka 1947"],
      ["2025-03-31", "Idulfitri 1446 H"],
      ["2025-04-01", "Idulfitri 1446 H"],
      ["2025-04-02", "Cuti Bersama Idulfitri 1446 H"],
      ["2025-04-03", "Cuti Bersama Idulfitri 1446 H"],
      ["2025-04-04", "Cuti Bersama Idulfitri 1446 H"],
      ["2025-04-07", "Cuti Bersama Idulfitri 1446 H"],
      ["2025-04-18", "Wafat Yesus Kristus"],
      ["2025-04-20", "Kebangkitan Yesus Kristus (Paskah)"],
      ["2025-05-01", "Hari Buruh Internasional"],
      ["2025-05-12", "Hari Raya Waisak 2569 BE"],
      ["2025-05-13", "Cuti Bersama Hari Raya Waisak"],
      ["2025-05-29", "Kenaikan Yesus Kristus"],
      ["2025-05-30", "Cuti Bersama Kenaikan Yesus Kristus"],
      ["2025-06-01", "Hari Lahir Pancasila"],
      ["2025-06-06", "Iduladha 1446 H"],
      ["2025-06-09", "Cuti Bersama Iduladha 1446 H"],
      ["2025-06-27", "1 Muharam Tahun Baru Islam 1447 H"],
      ["2025-08-17", "Proklamasi Kemerdekaan"],
      ["2025-08-18", "Cuti Bersama HUT ke-80 Kemerdekaan RI"],
      ["2025-09-05", "Maulid Nabi Muhammad SAW"],
      ["2025-12-25", "Kelahiran Yesus Kristus"],
      ["2025-12-26", "Cuti Bersama Kelahiran Yesus Kristus"],
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
  2027: {
    // Ditetapkan 15 September 2026. Dicocokkan 18 Oktober 2026 terhadap tiga
    // salinan resmi yang isinya sama (setneg.go.id, kemenkopmk.go.id/node/6444,
    // hukumonline); tiap tanggal diperiksa harinya. Berkas SKB yang
    // ditandatangani belum dibaca langsung.
    disahkan: true,
    skb: "Nomor 1205 Tahun 2026, Nomor 3 Tahun 2026, dan Nomor 2 Tahun 2026",
    ditetapkan: "2026-09-15",
    sumber:
      "setneg.go.id (Inilah SKB 3 Menteri Libur Nasional dan Cuti Bersama 2027) dan kemenkopmk.go.id/node/6444.",
    catatan: "18 hari libur nasional dan 8 cuti bersama, seluruhnya 26 tanggal.",
    libur: [
      ["2027-01-01", "Tahun Baru 2027 Masehi"],
      ["2027-01-05", "Isra Mikraj Nabi Muhammad SAW 1448 Hijriah"],
      ["2027-02-05", "Cuti Bersama Tahun Baru Imlek 2578 Kongzili"],
      ["2027-02-06", "Tahun Baru Imlek 2578 Kongzili"],
      ["2027-03-08", "Hari Suci Nyepi (Tahun Baru Saka 1949)"],
      ["2027-03-09", "Cuti Bersama Idulfitri 1448 Hijriah"],
      ["2027-03-10", "Idulfitri 1448 Hijriah"],
      ["2027-03-11", "Idulfitri 1448 Hijriah"],
      ["2027-03-12", "Cuti Bersama Idulfitri 1448 Hijriah"],
      ["2027-03-15", "Cuti Bersama Idulfitri 1448 Hijriah"],
      ["2027-03-25", "Cuti Bersama Wafat Yesus Kristus"],
      ["2027-03-26", "Wafat Yesus Kristus"],
      ["2027-03-28", "Kebangkitan Yesus Kristus (Paskah)"],
      ["2027-05-01", "Hari Buruh Internasional"],
      ["2027-05-06", "Kenaikan Yesus Kristus"],
      ["2027-05-17", "Iduladha 1448 Hijriah"],
      ["2027-05-18", "Cuti Bersama Iduladha 1448 Hijriah"],
      ["2027-05-19", "Cuti Bersama Hari Raya Waisak 2571 BE"],
      ["2027-05-20", "Hari Raya Waisak 2571 BE"],
      ["2027-06-01", "Hari Lahir Pancasila"],
      ["2027-06-06", "1 Muharam Tahun Baru Islam 1449 Hijriah"],
      ["2027-08-15", "Maulid Nabi Muhammad SAW"],
      ["2027-08-17", "Proklamasi Kemerdekaan"],
      ["2027-12-24", "Cuti Bersama Kelahiran Yesus Kristus"],
      ["2027-12-25", "Kelahiran Yesus Kristus"],
      ["2027-12-26", "Isra Mikraj Nabi Muhammad SAW 1449 Hijriah"],
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

// ============================================================================
// TAMBAHAN DARI PENGATURAN PORTAL (18 Okt 2026)
// ============================================================================
//
// Super Admin/Admin menambah libur daerah atau cuti bersama tambahan - atau
// membatalkan tanggal SKB - di Pengaturan portal. Portal mengirimkannya ke
// sini setiap kali disimpan (POST /internal/hari-libur/tambahan), dan salinannya
// ditulis ke folder data bot yang terpasang di luar container, supaya tidak
// hilang tiap pembaruan. Sumber datanya tetap SATU: simpanan portal.
const fs = require("fs");
const path = require("path");

let TAMBAHAN = Object.create(null);

function berkasTambahan() {
  const dasar = process.env.ALETA_BOT_DATA_DIR || path.join(__dirname, "..", "data");
  return path.join(dasar, "hari-libur-tambahan.json");
}

function bersihkanTambahan(daftar) {
  const hasil = Object.create(null);
  for (const x of Array.isArray(daftar) ? daftar.slice(0, 400) : []) {
    const tanggal = String((x && x.tanggal) || "").trim();
    if (!POLA_TANGGAL.test(tanggal)) continue;
    const aksi = x.aksi === "hapus" ? "hapus" : "tambah";
    const nama = String(x.nama || "").replace(/\s+/g, " ").trim().slice(0, 120);
    if (aksi === "tambah" && !nama) continue;
    hasil[tanggal] = { aksi, nama, jenis: String(x.jenis || "lain") };
  }
  return hasil;
}

function pasangTambahan(daftar, opsi = {}) {
  TAMBAHAN = bersihkanTambahan(daftar);
  if (opsi.simpan !== false) {
    try {
      const berkas = berkasTambahan();
      fs.mkdirSync(path.dirname(berkas), { recursive: true });
      fs.writeFileSync(berkas, JSON.stringify(Array.isArray(daftar) ? daftar : [], null, 2));
    } catch {
      // Gagal menyimpan salinan tidak membatalkan yang sudah berlaku di memori.
    }
  }
  return Object.keys(TAMBAHAN).length;
}

function muatTambahanTersimpan() {
  try {
    const isi = JSON.parse(fs.readFileSync(berkasTambahan(), "utf8"));
    pasangTambahan(isi, { simpan: false });
  } catch {
    TAMBAHAN = Object.create(null);
  }
}
muatTambahanTersimpan();

/** Apakah sebuah tanggal hari libur nasional, cuti bersama, atau tambahan Pengaturan? */
function hariLibur(tanggal) {
  const t = String(tanggal || "").trim();
  if (!POLA_TANGGAL.test(t)) return null;
  const tambahan = TAMBAHAN[t];
  if (tambahan && tambahan.aksi === "hapus") return null;
  if (tambahan) return { nama: tambahan.nama, tahun: Number(t.slice(0, 4)), tambahan: true };
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
  pasangTambahan,
};
