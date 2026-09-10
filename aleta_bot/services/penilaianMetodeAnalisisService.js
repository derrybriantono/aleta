"use strict";

/**
 * ============================================================================
 * METODE ANALISIS DAN PENGUJIAN - BAB 12 KATALOG
 * ============================================================================
 *
 * Tiga belas butir dari lima belas. Bab ini berbeda dari seluruh bab lain, dan
 * perbedaannya harus dipegang siapa pun yang menambah butir ke sini.
 *
 * ============================================================================
 * YANG DINILAI: APAKAH METODENYA BOLEH DIPAKAI ATAS DATA INI
 * ============================================================================
 *
 * Bab lain menilai keadaan pengadilan. Bab ini menilai apakah ALAT UKURNYA
 * sendiri sah dipakai - dan itu pertanyaan yang lebih dulu harus dijawab.
 *
 * Uji beda atas enam perkara akan memulangkan angka. Regresi atas peubah yang
 * seluruhnya kosong akan memulangkan angka. Korelasi antara dua deret yang
 * tidak berhubungan sama sekali akan memulangkan angka. Ketiganya terbaca
 * meyakinkan, ketiganya salah, dan tidak satu pun menampakkan dirinya sendiri.
 *
 * Karena itu tiap butir di sini menyebutkan SYARAT KESAHIHANNYA lebih dahulu -
 * berapa sampel minimalnya, apakah ragamnya cukup, apakah pembandingnya ada -
 * dan barisan yang tidak memenuhi syarat itu ditandai TIDAK MEMENUHI, bukan
 * dihitung apa adanya.
 *
 * ============================================================================
 * DUA BUTIR TIDAK DISAMBUNGKAN
 * ============================================================================
 *
 *   MT14 perbandingan antar satuan kerja menuntut data pengadilan agama LAIN.
 *        SIPP satu satuan kerja hanya memuat dirinya sendiri, dan angka
 *        pembanding yang dikarang lebih buruk daripada tidak ada pembanding.
 *
 *   MT15 asisten analisis berbasis kecerdasan buatan adalah FITUR, bukan
 *        pengukuran. Ia tidak punya pembilang dan penyebut, dan memaksanya
 *        menjadi angka penilaian hanya akan menghasilkan angka yang tidak
 *        menjawab apa pun. Kesiapan bahannya sudah terwakili butir-butir lain.
 *
 * ============================================================================
 * SEPULUH TAHUN DATA
 * ============================================================================
 *
 * Basis data yang dipakai mengukur memuat 5.554 perkara dari 2015 sampai
 * Agustus 2024. Beberapa butir di sini - penguraian deret waktu, uji beda
 * antar periode, kohort - baru berbicara pada rentang yang panjang, dan pada
 * rentang satu tahun mereka akan menyatakan dirinya belum sahih. Itu jawaban
 * yang benar, bukan kegagalan.
 */

const db = require("../db_config");
const kerangka = require("./kerangkaPenilaianService");
const sippSkemaService = require("./sippSkemaService");

const BATAS_BARIS = 5000;

/** Sampel minimal sebelum satu kelompok boleh dibandingkan dengan kelompok lain. */
const SAMPEL_MINIMAL_UJI_BEDA = 30;

/** Sampel minimal sebelum sebuah proporsi boleh diuji. */
const SAMPEL_MINIMAL_PROPORSI = 30;

/** Berapa bulan yang dibutuhkan sebelum deret waktu dapat diurai musimannya. */
const BULAN_MINIMAL_DERET = 24;

/** Batas kumulatif Pareto - dua puluh persen sebab, delapan puluh persen akibat. */
const AMBANG_PARETO = 0.8;

/** Batas indeks Herfindahl yang masih disebut terbagi merata. */
const AMBANG_KONSENTRASI = 0.25;

/** Lebar selang kepercayaan yang masih berguna, sebagai bagian dari nilainya. */
const LEBAR_SELANG_MAKSIMAL = 0.2;

/** Berapa simpangan baku dari rerata sebelum sebuah bulan disebut di luar kendali. */
const LEBAR_BATAS_KENDALI = 3;

function runQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (error, hasil) => {
      if (error) reject(error);
      else resolve(Array.isArray(hasil) ? hasil : []);
    });
  });
}

const teks = (n) => String(n == null ? "" : n).trim();
const angka = (n) => {
  const x = Number(n);
  return Number.isFinite(x) ? x : 0;
};

function tanggalTerisi(nilai) {
  const t = teks(nilai);
  if (!t) return false;
  if (/^0000-00-00/.test(t)) return false;
  return true;
}

function selisihHari(awal, akhir) {
  if (!tanggalTerisi(awal) || !tanggalTerisi(akhir)) return null;
  const a = new Date(awal);
  const b = new Date(akhir);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return null;
  return Math.round((b - a) / 86400000);
}

function bulanDari(nilai) {
  if (nilai instanceof Date && !Number.isNaN(nilai.getTime())) {
    return `${nilai.getFullYear()}-${String(nilai.getMonth() + 1).padStart(2, "0")}`;
  }
  return teks(nilai).slice(0, 7);
}

async function tabelSiap(daftar) {
  for (const t of daftar) {
    const ada = await sippSkemaService.tabelAda(t).catch(() => false);
    if (!ada) return false;
  }
  return true;
}

/* ==========================================================================
 * PUSTAKA STATISTIK KECIL
 * ==========================================================================
 *
 * Ditulis sendiri dan sengaja sederhana. Menarik pustaka statistik dari luar
 * berarti satu ketergantungan lagi yang harus diperbarui pada peladen yang
 * jaringannya terbatas - dan yang dibutuhkan di sini hanya delapan fungsi.
 *
 * Tiap fungsi memulangkan null ketika masukannya tidak sahih, bukan NaN.
 * NaN merambat diam-diam melalui perhitungan berikutnya dan baru muncul di
 * layar sebagai "NaN%", yang terbaca seperti kesalahan tampilan.
 */

function rerata(nilai) {
  if (!nilai.length) return null;
  return nilai.reduce((a, b) => a + b, 0) / nilai.length;
}

/** Simpangan baku SAMPEL - pembaginya n-1, bukan n. */
function simpanganBaku(nilai) {
  if (nilai.length < 2) return null;
  const r = rerata(nilai);
  const ragam = nilai.reduce((a, b) => a + (b - r) ** 2, 0) / (nilai.length - 1);
  return Math.sqrt(ragam);
}

function kuantil(nilai, bagian) {
  if (!nilai.length) return null;
  const urut = [...nilai].sort((a, b) => a - b);
  const posisi = (urut.length - 1) * bagian;
  const bawah = Math.floor(posisi);
  const atas = Math.ceil(posisi);
  if (bawah === atas) return urut[bawah];
  return urut[bawah] + (posisi - bawah) * (urut[atas] - urut[bawah]);
}

/**
 * Statistik t untuk dua sampel bebas, ragam tidak diandaikan sama (Welch).
 *
 * Yang dipulangkan statistiknya saja, bukan nilai p. Menghitung nilai p
 * menuntut fungsi distribusi t, dan menampilkan "p = 0,03" kepada pembaca yang
 * tidak menuntutnya akan membuat angka itu dikutip sebagai kesimpulan. Yang
 * dipakai butirnya hanya besar statistiknya terhadap dua - kira-kira setara
 * lima persen pada sampel besar.
 */
function statistikT(a, b) {
  if (a.length < 2 || b.length < 2) return null;
  const ra = rerata(a);
  const rb = rerata(b);
  const sa = simpanganBaku(a);
  const sb = simpanganBaku(b);
  if (sa === null || sb === null) return null;
  const galat = Math.sqrt((sa * sa) / a.length + (sb * sb) / b.length);
  if (!(galat > 0)) return null;
  return (ra - rb) / galat;
}

/** Statistik z untuk beda dua proporsi. */
function statistikZ(sukses1, n1, sukses2, n2) {
  if (n1 < 1 || n2 < 1) return null;
  const p1 = sukses1 / n1;
  const p2 = sukses2 / n2;
  const gabung = (sukses1 + sukses2) / (n1 + n2);
  const galat = Math.sqrt(gabung * (1 - gabung) * (1 / n1 + 1 / n2));
  if (!(galat > 0)) return null;
  return (p1 - p2) / galat;
}

/** Korelasi Pearson. */
function korelasi(x, y) {
  if (x.length !== y.length || x.length < 3) return null;
  const rx = rerata(x);
  const ry = rerata(y);
  let atas = 0;
  let bx = 0;
  let by = 0;
  for (let i = 0; i < x.length; i += 1) {
    atas += (x[i] - rx) * (y[i] - ry);
    bx += (x[i] - rx) ** 2;
    by += (y[i] - ry) ** 2;
  }
  const bawah = Math.sqrt(bx * by);
  if (!(bawah > 0)) return null;
  return atas / bawah;
}

/** Setengah lebar selang kepercayaan 95% untuk sebuah proporsi (Wald). */
function selangProporsi(sukses, n) {
  if (n < 1) return null;
  const p = sukses / n;
  return 1.96 * Math.sqrt((p * (1 - p)) / n);
}

/** Indeks Herfindahl-Hirschman yang dinormalkan - 0 merata, 1 terpusat. */
function indeksKonsentrasi(nilai) {
  const n = nilai.length;
  if (n < 2) return null;
  const total = nilai.reduce((a, b) => a + b, 0);
  if (!(total > 0)) return null;
  const hhi = nilai.reduce((a, b) => a + (b / total) ** 2, 0);
  return (hhi - 1 / n) / (1 - 1 / n);
}

/* ==========================================================================
 * PEMUAT DATA BERSAMA
 * ========================================================================== */

/**
 * Perkara beserta ukuran-ukuran yang dipakai seluruh butir bab ini.
 *
 * Satu kueri untuk tiga belas butir. Ditulis satu kali sebab tiga belas
 * tempat yang masing-masing menyusun definisi "lama penyelesaian" akan
 * menghasilkan tiga belas angka yang berbeda-beda sedikit - dan perbedaan
 * sedikit itu tidak akan pernah terlihat, sebab tidak ada yang menyandingkan
 * butir satu dengan butir lainnya.
 */
async function muatUkuran(rentang) {
  const adaEfiling = await sippSkemaService.tabelAda("perkara_efiling_id").catch(() => false);

  return runQuery(
    `SELECT p.perkara_id          AS perkaraId,
            p.nomor_perkara       AS nomorPerkara,
            p.jenis_perkara_nama  AS jenisPerkara,
            p.tanggal_pendaftaran AS tanggalDaftar,
            d.tanggal_putusan     AS tanggalPutusan,
            d.tanggal_minutasi    AS tanggalMinutasi,
            h.hakim_id            AS hakimId,
            h.hakim_nama          AS hakimNama,
            (SELECT COUNT(*) FROM perkara_jadwal_sidang j
              WHERE j.perkara_id = p.perkara_id)                    AS jumlahSidang,
            (SELECT COUNT(*) FROM perkara_jadwal_sidang j
              WHERE j.perkara_id = p.perkara_id AND j.ditunda = 'Y') AS jumlahTunda,
            (SELECT COUNT(*) FROM perkara_pelaksanaan_relaas r
              WHERE r.perkara_id = p.perkara_id)                    AS jumlahRelaas,
            ${
              adaEfiling
                ? `(SELECT COUNT(*) FROM perkara_efiling_id e WHERE e.perkara_id = p.perkara_id)`
                : "0"
            }                                                        AS jumlahEfiling
       FROM perkara p
       LEFT JOIN perkara_putusan d ON d.perkara_id = p.perkara_id
       LEFT JOIN perkara_hakim_pn h
              ON h.perkara_id = p.perkara_id
             AND h.aktif = 'Y'
             AND (h.jabatan_hakim_nama LIKE '%etua%' OR h.jabatan_hakim_nama LIKE '%unggal%')
      WHERE p.tanggal_pendaftaran >= ? AND p.tanggal_pendaftaran <= ?
      GROUP BY p.perkara_id
      ORDER BY p.tanggal_pendaftaran
      LIMIT ${BATAS_BARIS}`,
    [rentang.mulai, rentang.selesai]
  );
}

/** Lama penyelesaian satu perkara, atau null bila belum diputus. */
function lamaPenyelesaian(x) {
  if (!tanggalTerisi(x.tanggalPutusan)) return null;
  const n = selisihHari(x.tanggalDaftar, x.tanggalPutusan);
  return n === null || n < 0 ? null : n;
}

/**
 * ============================================================================
 * MT01 - UJI BEDA ANTAR PERIODE
 * ============================================================================
 *
 * Rentang dibelah dua menurut waktunya, lalu lama penyelesaian paruh pertama
 * dibandingkan paruh kedua - PER JENIS PERKARA, sebab bauran jenis yang
 * berubah dapat menggeser rerata keseluruhan tanpa satu pun jenis benar-benar
 * berubah.
 *
 * Yang dinilai KESAHIHAN ujinya, bukan hasilnya: jenis perkara yang salah satu
 * paruhnya kurang dari tiga puluh putusan tidak boleh diuji. Uji beda atas
 * enam perkara akan tetap memulangkan angka, dan angka itu akan dikutip.
 */
async function barisUjiBedaPeriode(rentang) {
  if (!(await tabelSiap(["perkara", "perkara_putusan"]))) return [];
  const hasil = await muatUkuran(rentang);
  if (hasil.length === 0) return [];

  const bulanSemua = [...new Set(hasil.map((x) => bulanDari(x.tanggalDaftar)))].sort();
  if (bulanSemua.length < 2) return [];
  const pemisah = bulanSemua[Math.floor(bulanSemua.length / 2)];

  const perJenis = new Map();
  hasil.forEach((x) => {
    const lama = lamaPenyelesaian(x);
    if (lama === null) return;
    const j = teks(x.jenisPerkara) || "(tanpa jenis)";
    if (!perJenis.has(j)) perJenis.set(j, { awal: [], akhir: [] });
    const sisi = bulanDari(x.tanggalDaftar) < pemisah ? "awal" : "akhir";
    perJenis.get(j)[sisi].push(lama);
  });

  return [...perJenis.entries()].map(([jenis, s]) => {
    const cukup = s.awal.length >= SAMPEL_MINIMAL_UJI_BEDA && s.akhir.length >= SAMPEL_MINIMAL_UJI_BEDA;
    const t = cukup ? statistikT(s.awal, s.akhir) : null;

    return {
      kunci: `beda-periode-${jenis}`,
      jenisPerkara: jenis,
      sampelAwal: s.awal.length,
      sampelAkhir: s.akhir.length,
      rerataAwal: s.awal.length ? Number(rerata(s.awal).toFixed(1)) : null,
      rerataAkhir: s.akhir.length ? Number(rerata(s.akhir).toFixed(1)) : null,
      statistikT: t === null ? null : Number(t.toFixed(2)),
      memenuhi: cukup,
      sebabTidakMemenuhi: cukup
        ? ""
        : `paruh pertama ${s.awal.length} putusan dan paruh kedua ${s.akhir.length} - uji beda menuntut sekurangnya ${SAMPEL_MINIMAL_UJI_BEDA} pada masing-masing. Uji atas sampel sekecil ini tetap memulangkan angka, dan angka itu akan dikutip.`,
    };
  });
}

/**
 * ============================================================================
 * MT02 - UJI BEDA PROPORSI ANTAR UNIT
 * ============================================================================
 *
 * Proporsi perkara yang selesai di bawah asas lima bulan, dibandingkan antara
 * tiap ketua majelis dan seluruh pengadilan. Yang dinilai lagi-lagi
 * kesahihannya: majelis dengan kurang dari tiga puluh putusan tidak boleh
 * dibandingkan proporsinya dengan siapa pun.
 *
 * Perlu dipegang: yang dibandingkan PROPORSINYA, dan proporsi tidak
 * memperhitungkan bobot perkara. Majelis yang kebetulan menerima banyak
 * perkara berat akan tampak lebih buruk tanpa satu pun kesalahan.
 */
const HARI_ASAS_PENYELESAIAN = 150;

async function barisUjiProporsiUnit(rentang) {
  if (!(await tabelSiap(["perkara", "perkara_putusan", "perkara_hakim_pn"]))) return [];
  const hasil = await muatUkuran(rentang);

  const perHakim = new Map();
  let totalSukses = 0;
  let totalN = 0;

  hasil.forEach((x) => {
    const lama = lamaPenyelesaian(x);
    if (lama === null) return;
    const id = teks(x.hakimId);
    if (!id) return;
    if (!perHakim.has(id)) perHakim.set(id, { nama: teks(x.hakimNama), sukses: 0, n: 0 });
    const h = perHakim.get(id);
    h.n += 1;
    totalN += 1;
    if (lama <= HARI_ASAS_PENYELESAIAN) {
      h.sukses += 1;
      totalSukses += 1;
    }
  });

  return [...perHakim.entries()].map(([id, h]) => {
    const cukup = h.n >= SAMPEL_MINIMAL_PROPORSI;
    const z = cukup ? statistikZ(h.sukses, h.n, totalSukses - h.sukses, totalN - h.n) : null;

    return {
      kunci: `proporsi-hakim-${id}`,
      petugas: h.nama,
      sampel: h.n,
      proporsi: h.n ? Number(((h.sukses / h.n) * 100).toFixed(1)) : null,
      statistikZ: z === null ? null : Number(z.toFixed(2)),
      memenuhi: cukup,
      sebabTidakMemenuhi: cukup
        ? ""
        : `hanya ${h.n} putusan - uji beda proporsi menuntut sekurangnya ${SAMPEL_MINIMAL_PROPORSI}. Yang dibandingkan proporsi, dan proporsi tidak memperhitungkan bobot perkara.`,
    };
  });
}

/**
 * ============================================================================
 * MT03 - ANALISIS REGRESI LAMA PENYELESAIAN
 * ============================================================================
 *
 * Regresi menuntut peubah penjelas yang benar-benar ada nilainya pada tiap
 * baris. Baris yang salah satu peubahnya kosong akan dibuang diam-diam oleh
 * hampir tiap pustaka regresi - dan model yang tersusun dari separuh data
 * tetap memulangkan koefisien yang terbaca meyakinkan.
 *
 * Yang dinilai di sini kelengkapan peubahnya per perkara. Regresinya sendiri
 * BELUM dijalankan ALETA; katalog menyebut butir ini analisis, dan analisis
 * yang menyimpulkan sebab-akibat dari data pengamatan menuntut manusia yang
 * memahami batasnya.
 */
const PEUBAH_REGRESI = ["jumlah sidang", "jumlah penundaan", "jumlah relaas", "jenis perkara", "majelis"];

async function barisRegresiLama(rentang) {
  if (!(await tabelSiap(["perkara", "perkara_putusan", "perkara_jadwal_sidang"]))) return [];
  const hasil = await muatUkuran(rentang);

  return hasil
    .filter((x) => lamaPenyelesaian(x) !== null)
    .map((x) => {
      const kosong = [];
      if (angka(x.jumlahSidang) === 0) kosong.push("jumlah sidang");
      if (!teks(x.jenisPerkara)) kosong.push("jenis perkara");
      if (!teks(x.hakimId)) kosong.push("majelis");

      return {
        kunci: `${teks(x.nomorPerkara)}#MT03`,
        nomorPerkara: teks(x.nomorPerkara),
        jenisPerkara: teks(x.jenisPerkara),
        lamaHari: lamaPenyelesaian(x),
        memenuhi: kosong.length === 0,
        sebabTidakMemenuhi: kosong.length
          ? `peubah penjelasnya kosong: ${kosong.join(
              ", "
            )} - baris seperti ini dibuang diam-diam oleh hampir tiap pustaka regresi, dan model yang tersusun dari separuh data tetap memulangkan koefisien yang meyakinkan`
          : "",
      };
    });
}

/**
 * ============================================================================
 * MT04 - ANALISIS KOHORT PERKARA
 * ============================================================================
 *
 * Satu baris satu bulan pendaftaran, diikuti nasibnya. Kohort hanya dapat
 * diikuti bila SELURUH anggotanya punya keadaan akhir yang diketahui - diputus
 * dengan tanggalnya, atau jelas masih berjalan. Perkara yang keadaannya tidak
 * diketahui membuat seluruh kohort itu tidak dapat disimpulkan, sebab tidak
 * ada yang tahu ia masuk hitungan yang mana.
 */
async function barisKohort(rentang) {
  if (!(await tabelSiap(["perkara", "perkara_putusan"]))) return [];
  const hasil = await muatUkuran(rentang);
  if (hasil.length === 0) return [];

  const perBulan = new Map();
  hasil.forEach((x) => {
    const b = bulanDari(x.tanggalDaftar);
    if (!perBulan.has(b)) perBulan.set(b, { bulan: b, anggota: 0, diputus: 0, takJelas: 0 });
    const k = perBulan.get(b);
    k.anggota += 1;
    if (tanggalTerisi(x.tanggalPutusan)) {
      if (lamaPenyelesaian(x) === null) k.takJelas += 1;
      else k.diputus += 1;
    }
  });

  return [...perBulan.values()]
    .sort((a, b) => a.bulan.localeCompare(b.bulan))
    .map((k) => ({
      kunci: `kohort-${k.bulan}`,
      bulan: k.bulan,
      anggota: k.anggota,
      diputus: k.diputus,
      belumDiputus: k.anggota - k.diputus - k.takJelas,
      memenuhi: k.takJelas === 0,
      sebabTidakMemenuhi:
        k.takJelas === 0
          ? ""
          : `${k.takJelas} perkara punya tanggal putusan yang tidak dapat dibaca atau mendahului pendaftarannya - seluruh kohort bulan ini tidak dapat disimpulkan, sebab tidak ada yang tahu perkara itu masuk hitungan yang mana`,
    }));
}

/**
 * ============================================================================
 * MT05 - PENGURAIAN DERET WAKTU
 * ============================================================================
 *
 * Menguraikan deret menjadi tren, pola musiman, dan kejadian luar biasa
 * menuntut sekurangnya dua putaran musim penuh - dua puluh empat bulan.
 * Di bawah itu, yang terurai sebagai "pola musiman" sebenarnya derau.
 *
 * Berbeda dari butir Bab 9 yang hanya menanyakan ada tidaknya bulan
 * pembanding, butir ini menuntut PANJANG deretnya secara keseluruhan.
 */
async function barisPenguraianDeret(rentang) {
  if (!(await tabelSiap(["perkara"]))) return [];

  const hasil = await runQuery(
    `SELECT DATE_FORMAT(p.tanggal_pendaftaran, '%Y-%m') AS bulan, COUNT(*) AS jumlah
       FROM perkara p
      WHERE p.tanggal_pendaftaran >= ? AND p.tanggal_pendaftaran <= ?
      GROUP BY bulan
      ORDER BY bulan`,
    [rentang.mulai, rentang.selesai]
  );

  const panjang = hasil.length;

  return hasil.map((x) => ({
    kunci: `deret-${teks(x.bulan)}`,
    bulan: teks(x.bulan),
    penerimaan: angka(x.jumlah),
    panjangDeret: panjang,
    memenuhi: panjang >= BULAN_MINIMAL_DERET,
    sebabTidakMemenuhi:
      panjang >= BULAN_MINIMAL_DERET
        ? ""
        : `deretnya hanya ${panjang} bulan - penguraian tren dan musiman menuntut sekurangnya ${BULAN_MINIMAL_DERET} bulan, yaitu dua putaran musim penuh. Di bawah itu yang terurai sebagai pola musiman sebenarnya derau.`,
  }));
}

/**
 * ============================================================================
 * MT06 - DETEKSI DATA PENCILAN
 * ============================================================================
 *
 * Memakai jarak antar kuartil, BUKAN simpangan baku. Bedanya penting: satu
 * perkara yang berjalan tiga tahun akan menggelembungkan simpangan bakunya
 * sendiri sampai ia berhenti tampak menyimpang - pencilan yang menyembunyikan
 * dirinya dengan kehadirannya sendiri. Kuartil tidak dapat digeser begitu.
 *
 * Butir Bab 9 memakai simpangan baku per jenis perkara; keduanya sengaja
 * berbeda, dan perkara yang tertangkap keduanya memang pantas dibuka lebih
 * dulu.
 */
async function barisPencilan(rentang) {
  if (!(await tabelSiap(["perkara", "perkara_putusan"]))) return [];
  const hasil = await muatUkuran(rentang);

  const lama = hasil.map(lamaPenyelesaian).filter((n) => n !== null);
  if (lama.length < 8) return [];

  const q1 = kuantil(lama, 0.25);
  const q3 = kuantil(lama, 0.75);
  const jarak = q3 - q1;
  const batasAtas = q3 + 1.5 * jarak;
  const batasBawah = Math.max(0, q1 - 1.5 * jarak);

  return hasil
    .filter((x) => lamaPenyelesaian(x) !== null)
    .map((x) => {
      const n = lamaPenyelesaian(x);
      const pencilan = n > batasAtas || n < batasBawah;

      return {
        kunci: `${teks(x.nomorPerkara)}#MT06`,
        nomorPerkara: teks(x.nomorPerkara),
        jenisPerkara: teks(x.jenisPerkara),
        lamaHari: n,
        batasAtas: Number(batasAtas.toFixed(1)),
        memenuhi: !pencilan,
        sebabTidakMemenuhi: pencilan
          ? `selesai dalam ${n} hari sedangkan kebiasaan pengadilan ini ${batasBawah.toFixed(
              0
            )} sampai ${batasAtas.toFixed(0)} hari menurut jarak antar kuartil - pantas dibuka, bukan terbukti salah`
          : "",
      };
    });
}

/**
 * ============================================================================
 * MT07 - ANALISIS PARETO PENYEBAB
 * ============================================================================
 *
 * Golongan alasan penundaan diurutkan dari yang terbanyak, lalu ditandai mana
 * yang masuk delapan puluh persen kumulatif pertama - itulah "sebab yang
 * sedikit tetapi berat".
 *
 * Yang TIDAK memenuhi di sini adalah golongan yang masuk kelompok itu, dan itu
 * disengaja: yang ditandai justru yang perlu dikerjakan lebih dulu. Butir ini
 * karena itu bukan nilai baik-buruk melainkan penunjuk arah, dan angkanya
 * harus dibaca demikian.
 */
const GOLONGAN_PENUNDAAN = [
  { nama: "pemanggilan pihak", pola: /panggil|relaas|ghaib|gaib/i },
  { nama: "mediasi", pola: /mediasi|damai|perdamaian/i },
  { nama: "jawaban dan replik duplik", pola: /jawab|replik|duplik|eksepsi/i },
  { nama: "pembuktian", pola: /bukti|saksi|sumpah|pemeriksaan setempat|descente/i },
  { nama: "kesimpulan", pola: /kesimpulan/i },
  { nama: "pembacaan putusan atau penetapan", pola: /putusan|penetapan|ikrar/i },
  { nama: "pihak tidak hadir", pola: /tidak hadir|belum hadir|absen/i },
  { nama: "keadaan majelis atau kantor", pola: /hakim|majelis|dinas|libur|cuti|sakit/i },
];

async function barisPareto(rentang) {
  if (!(await tabelSiap(["perkara", "perkara_jadwal_sidang"]))) return [];

  const hasil = await runQuery(
    `SELECT j.alasan_ditunda AS alasan, COUNT(*) AS jumlah
       FROM perkara p
       JOIN perkara_jadwal_sidang j ON j.perkara_id = p.perkara_id
      WHERE p.tanggal_pendaftaran >= ? AND p.tanggal_pendaftaran <= ?
        AND j.ditunda = 'Y'
      GROUP BY j.alasan_ditunda
      LIMIT ${BATAS_BARIS}`,
    [rentang.mulai, rentang.selesai]
  );

  const perGolongan = new Map();
  hasil.forEach((x) => {
    const t = teks(x.alasan);
    const cocok = GOLONGAN_PENUNDAAN.find((g) => g.pola.test(t));
    const nama = cocok ? cocok.nama : "belum bergolongan";
    perGolongan.set(nama, (perGolongan.get(nama) || 0) + angka(x.jumlah));
  });

  const urut = [...perGolongan.entries()].sort((a, b) => b[1] - a[1]);
  const total = urut.reduce((a, b) => a + b[1], 0);
  if (total === 0) return [];

  let kumulatif = 0;
  return urut.map(([nama, jumlah]) => {
    const sebelum = kumulatif;
    kumulatif += jumlah;
    const masukVital = sebelum / total < AMBANG_PARETO;

    return {
      kunci: `pareto-${nama}`,
      golongan: nama,
      jumlah,
      bagianPersen: Number(((jumlah / total) * 100).toFixed(1)),
      kumulatifPersen: Number(((kumulatif / total) * 100).toFixed(1)),
      memenuhi: !masukVital,
      sebabTidakMemenuhi: masukVital
        ? `menyumbang ${((jumlah / total) * 100).toFixed(1)}% penundaan dan masuk ${(
            AMBANG_PARETO * 100
          ).toFixed(0)}% kumulatif pertama - ditandai karena PERLU DIKERJAKAN LEBIH DULU, bukan karena buruk`
        : "",
    };
  });
}

/**
 * ============================================================================
 * MT08 - INDEKS KONSENTRASI BEBAN
 * ============================================================================
 *
 * Herfindahl yang dinormalkan: nol berarti beban terbagi persis rata, satu
 * berarti seluruhnya ditanggung satu orang. Berbeda dari koefisien Gini pada
 * bab beban kerja, indeks ini lebih peka terhadap satu pemegang yang sangat
 * besar - dan keduanya sengaja dipakai, sebab ketimpangan punya dua bentuk
 * yang berbeda.
 */
async function barisKonsentrasiBeban(rentang) {
  if (!(await tabelSiap(["perkara", "perkara_hakim_pn"]))) return [];
  const hasil = await muatUkuran(rentang);

  const perHakim = new Map();
  hasil.forEach((x) => {
    const id = teks(x.hakimId);
    if (!id) return;
    if (!perHakim.has(id)) perHakim.set(id, { nama: teks(x.hakimNama), n: 0 });
    perHakim.get(id).n += 1;
  });

  const daftar = [...perHakim.values()];
  if (daftar.length < 2) return [];
  const indeks = indeksKonsentrasi(daftar.map((d) => d.n));
  if (indeks === null) return [];

  return [...perHakim.entries()].map(([id, d]) => ({
    kunci: `konsentrasi-${id}`,
    petugas: d.nama,
    jumlahPerkara: d.n,
    indeksKonsentrasi: Number(indeks.toFixed(4)),
    memenuhi: indeks <= AMBANG_KONSENTRASI,
    sebabTidakMemenuhi:
      indeks <= AMBANG_KONSENTRASI
        ? ""
        : `indeks konsentrasi seluruh pengadilan ${indeks.toFixed(
            3
          )}, melampaui ambang ${AMBANG_KONSENTRASI} - yang dinilai PEMBAGIANNYA, dan yang membagi perkara bukan yang menerimanya`,
  }));
}

/**
 * ============================================================================
 * MT09 - UJI HUBUNGAN ANTAR UKURAN
 * ============================================================================
 *
 * Pasangan yang diuji DITETAPKAN LEBIH DAHULU, dan itu batas yang paling
 * penting di seluruh bab ini.
 *
 * Menghitung korelasi seluruh pasangan yang mungkin lalu melaporkan yang
 * terkuat adalah cara paling mudah menemukan hubungan yang tidak ada: pada dua
 * puluh ukuran ada seratus sembilan puluh pasangan, dan beberapa di antaranya
 * PASTI berkorelasi kuat secara kebetulan.
 *
 * Empat pasangan di bawah dipilih karena masing-masing punya alasan hukum
 * acara mengapa keduanya mungkin berhubungan - bukan karena angkanya bagus.
 */
const PASANGAN_UKURAN = [
  {
    nama: "jumlah sidang dan lama penyelesaian",
    alasan: "tiap sidang berjarak sekurangnya sepekan, jadi jumlah sidang seharusnya menarik lamanya",
    x: (r) => angka(r.jumlahSidang),
    y: (r) => lamaPenyelesaian(r),
  },
  {
    nama: "jumlah penundaan dan lama penyelesaian",
    alasan: "penundaan menambah tenggang sebelum sidang berikutnya",
    x: (r) => angka(r.jumlahTunda),
    y: (r) => lamaPenyelesaian(r),
  },
  {
    nama: "jumlah relaas dan lama penyelesaian",
    alasan: "pemanggilan berulang menandakan pihak yang sulit ditemui",
    x: (r) => angka(r.jumlahRelaas),
    y: (r) => lamaPenyelesaian(r),
  },
  {
    nama: "pendaftaran elektronik dan lama penyelesaian",
    alasan: "e-Court meniadakan sebagian pemanggilan fisik",
    x: (r) => (angka(r.jumlahEfiling) > 0 ? 1 : 0),
    y: (r) => lamaPenyelesaian(r),
  },
];

async function barisHubunganUkuran(rentang) {
  if (!(await tabelSiap(["perkara", "perkara_putusan"]))) return [];
  const hasil = await muatUkuran(rentang);

  return PASANGAN_UKURAN.map((p) => {
    const x = [];
    const y = [];
    hasil.forEach((r) => {
      const yy = p.y(r);
      if (yy === null) return;
      x.push(p.x(r));
      y.push(yy);
    });

    const cukup = x.length >= SAMPEL_MINIMAL_UJI_BEDA;
    const r = cukup ? korelasi(x, y) : null;

    return {
      kunci: `hubungan-${p.nama}`,
      pasangan: p.nama,
      alasanDipilih: p.alasan,
      sampel: x.length,
      korelasi: r === null ? null : Number(r.toFixed(3)),
      memenuhi: cukup && r !== null,
      sebabTidakMemenuhi:
        cukup && r !== null
          ? ""
          : !cukup
          ? `hanya ${x.length} pasangan - korelasi menuntut sekurangnya ${SAMPEL_MINIMAL_UJI_BEDA}`
          : "salah satu ukurannya tidak beragam sama sekali, sehingga korelasinya tidak terdefinisi",
    };
  });
}

/**
 * ============================================================================
 * MT10 - SELANG KEPERCAYAAN NILAI
 * ============================================================================
 *
 * Tiap angka nilai sesungguhnya berkisar, dan kisarannya melebar ketika
 * penyebutnya kecil. Nilai 100% dari tiga perkara berkisar 44% sampai 100% -
 * dan angka "100%" yang ditampilkan tanpa kisarannya akan dibaca sebagai
 * kepastian.
 *
 * Yang dinilai di sini apakah kisarannya cukup SEMPIT untuk berguna. Bulan
 * yang selangnya lebih lebar daripada seperlima nilainya tidak boleh dipakai
 * membandingkan apa pun.
 */
async function barisSelangKepercayaan(rentang) {
  if (!(await tabelSiap(["perkara", "perkara_putusan"]))) return [];
  const hasil = await muatUkuran(rentang);

  const perBulan = new Map();
  hasil.forEach((x) => {
    const lama = lamaPenyelesaian(x);
    if (lama === null) return;
    const b = bulanDari(x.tanggalDaftar);
    if (!perBulan.has(b)) perBulan.set(b, { bulan: b, sukses: 0, n: 0 });
    const m = perBulan.get(b);
    m.n += 1;
    if (lama <= HARI_ASAS_PENYELESAIAN) m.sukses += 1;
  });

  return [...perBulan.values()]
    .sort((a, b) => a.bulan.localeCompare(b.bulan))
    .map((m) => {
      const setengah = selangProporsi(m.sukses, m.n);
      const cukupSempit = setengah !== null && setengah <= LEBAR_SELANG_MAKSIMAL;
      const p = m.n ? m.sukses / m.n : 0;

      return {
        kunci: `selang-${m.bulan}`,
        bulan: m.bulan,
        sampel: m.n,
        nilai: Number((p * 100).toFixed(1)),
        selangBawah: setengah === null ? null : Number((Math.max(0, p - setengah) * 100).toFixed(1)),
        selangAtas: setengah === null ? null : Number((Math.min(1, p + setengah) * 100).toFixed(1)),
        memenuhi: cukupSempit,
        sebabTidakMemenuhi: cukupSempit
          ? ""
          : `dari ${m.n} putusan, nilainya berkisar ${((Math.max(0, p - (setengah || 0))) * 100).toFixed(
              0
            )}% sampai ${((Math.min(1, p + (setengah || 0))) * 100).toFixed(
              0
            )}% - terlalu lebar untuk dipakai membandingkan apa pun`,
      };
    });
}

/**
 * ============================================================================
 * MT11 - PETA KENDALI PROSES
 * ============================================================================
 *
 * Peta kendali atas PENERIMAAN perkara per bulan - berbeda dari peta kendali
 * Bab 10 yang mengawasi lama penyelesaiannya. Keduanya sengaja ada: proses
 * yang menerima perkara dan proses yang menyelesaikannya dapat lepas kendali
 * sendiri-sendiri, dan yang satu tidak akan menunjukkan yang lain.
 */
async function barisPetaKendaliProses(rentang) {
  if (!(await tabelSiap(["perkara"]))) return [];

  const hasil = await runQuery(
    `SELECT DATE_FORMAT(p.tanggal_pendaftaran, '%Y-%m') AS bulan, COUNT(*) AS jumlah
       FROM perkara p
      WHERE p.tanggal_pendaftaran >= ? AND p.tanggal_pendaftaran <= ?
      GROUP BY bulan
      ORDER BY bulan`,
    [rentang.mulai, rentang.selesai]
  );

  if (hasil.length < 3) return [];
  const nilai = hasil.map((x) => angka(x.jumlah));
  const pusat = rerata(nilai);
  const simpangan = simpanganBaku(nilai);
  if (simpangan === null || !(simpangan > 0)) return [];

  const atas = pusat + LEBAR_BATAS_KENDALI * simpangan;
  const bawah = Math.max(0, pusat - LEBAR_BATAS_KENDALI * simpangan);

  return hasil.map((x) => {
    const n = angka(x.jumlah);
    const lewat = n > atas || n < bawah;

    return {
      kunci: `kendali-proses-${teks(x.bulan)}`,
      bulan: teks(x.bulan),
      penerimaan: n,
      batasAtas: Number(atas.toFixed(1)),
      batasBawah: Number(bawah.toFixed(1)),
      memenuhi: !lewat,
      sebabTidakMemenuhi: lewat
        ? `penerimaan ${n} perkara di luar batas kendali ${bawah.toFixed(0)} sampai ${atas.toFixed(
            0
          )} - bulan ini benar-benar menyimpang, bukan sekadar di atas rerata`
        : "",
    };
  });
}

/**
 * ============================================================================
 * MT12 - PENELUSURAN SEBAB AKAR TEMUAN
 * ============================================================================
 *
 * Temuan yang berulang punya sebab, dan sebab itu jarang berupa "petugasnya
 * kurang teliti". Yang ditelusuri di sini apakah tiap jenis temuan dapat
 * dipulangkan ke satu SEBAB YANG DAPAT DITINDAK - kolom yang tidak ada,
 * kolom yang ada tetapi tidak diisi, atau aturan yang belum ditetapkan.
 *
 * Temuan yang sebabnya tidak dapat disebutkan akan berulang pada tiap
 * pemeriksaan berikutnya, dan tiap kali dicatat sebagai temuan baru.
 */
const SEBAB_AKAR = [
  {
    temuan: "kolom ada tetapi tidak pernah diisi",
    contoh: "penerbitan salinan putusan, tanggal cabut, pendidikan pihak",
    dapatDitindak: true,
    tindakan: "menetapkan kolom itu wajib pada borang SIPP, atau memasukkannya ke daftar periksa harian",
  },
  {
    temuan: "kolom tidak ada pada SIPP",
    contoh: "Posbakum, pengaduan, eksaminasi, konsinyasi, media pengumuman ghaib",
    dapatDitindak: false,
    tindakan: "",
  },
  {
    temuan: "ambang belum ditetapkan pimpinan",
    contoh: "kapasitas ruang sidang, deviasi pemerataan, bobot nilai kondisi",
    dapatDitindak: true,
    tindakan: "menetapkannya dengan surat keputusan, lalu memasukkannya ke pengaturan ambang ALETA",
  },
  {
    temuan: "isian bebas tanpa golongan",
    contoh: "alasan penundaan, isi kesepakatan mediasi",
    dapatDitindak: true,
    tindakan: "menambah golongan yang belum dikenali, bukan memaksa petugas mengetik seragam",
  },
  {
    temuan: "penanda dan keadaan sesungguhnya berselisih",
    contoh: "sidang keliling tanpa tempat, prodeo dengan panjar terbayar",
    dapatDitindak: true,
    tindakan: "memasang pemeriksaan silang pada borang SIPP sehingga keduanya tidak dapat berselisih sejak awal",
  },
  {
    temuan: "bobot perkara tidak tersimpan",
    contoh: "seluruh butir beban kerja",
    dapatDitindak: false,
    tindakan: "",
  },
];

async function barisSebabAkar() {
  return SEBAB_AKAR.map((s) => ({
    kunci: `sebab-akar-${s.temuan}`,
    jenisTemuan: s.temuan,
    contoh: s.contoh,
    tindakan: s.tindakan,
    memenuhi: s.dapatDitindak,
    sebabTidakMemenuhi: s.dapatDitindak
      ? ""
      : `sebabnya di luar jangkauan satuan kerja - ${s.contoh}. Temuan ini akan berulang pada tiap pemeriksaan sampai SIPP sendiri berubah, dan mencatatnya sebagai temuan baru tiap kali hanya membuang waktu pemeriksa.`,
  }));
}

/**
 * ============================================================================
 * MT13 - UJI PETIK BERBASIS RISIKO
 * ============================================================================
 *
 * Waktu pemeriksa terbatas. Yang dipilih untuk diperiksa manual bukan sampel
 * acak melainkan berkas yang paling mungkin bermasalah - dan "paling mungkin"
 * disusun dari penanda yang sudah terukur butir lain.
 *
 * Yang TIDAK memenuhi di sini adalah berkas yang TERPILIH, dan itu disengaja:
 * daftar yang tidak memenuhi adalah daftar kerjanya.
 */
const PENANDA_RISIKO = [
  { nama: "melampaui asas lima bulan", nilai: 3, uji: (x) => (lamaPenyelesaian(x) || 0) > HARI_ASAS_PENYELESAIAN },
  { nama: "tanpa jadwal sidang", nilai: 3, uji: (x) => angka(x.jumlahSidang) === 0 },
  { nama: "penundaan lebih dari separuh sidangnya", nilai: 2, uji: (x) => angka(x.jumlahSidang) > 0 && angka(x.jumlahTunda) / angka(x.jumlahSidang) > 0.5 },
  { nama: "belum diminutasi", nilai: 2, uji: (x) => tanggalTerisi(x.tanggalPutusan) && !tanggalTerisi(x.tanggalMinutasi) },
  { nama: "tanpa majelis tercatat", nilai: 3, uji: (x) => !teks(x.hakimId) },
  { nama: "relaas lebih dari empat kali", nilai: 1, uji: (x) => angka(x.jumlahRelaas) > 4 },
];

const AMBANG_RISIKO_PETIK = 3;

async function barisUjiPetikRisiko(rentang) {
  if (!(await tabelSiap(["perkara", "perkara_putusan", "perkara_jadwal_sidang"]))) return [];
  const hasil = await muatUkuran(rentang);

  return hasil.map((x) => {
    const kena = PENANDA_RISIKO.filter((p) => {
      try {
        return p.uji(x);
      } catch {
        return false;
      }
    });
    const nilai = kena.reduce((a, p) => a + p.nilai, 0);
    const terpilih = nilai >= AMBANG_RISIKO_PETIK;

    return {
      kunci: `${teks(x.nomorPerkara)}#MT13`,
      nomorPerkara: teks(x.nomorPerkara),
      jenisPerkara: teks(x.jenisPerkara),
      nilaiRisiko: nilai,
      memenuhi: !terpilih,
      sebabTidakMemenuhi: terpilih
        ? `nilai risiko ${nilai} - ${kena
            .map((p) => p.nama)
            .join("; ")}. Terpilih untuk diperiksa manual: daftar yang tidak memenuhi di sini adalah daftar kerjanya, bukan daftar kesalahan.`
        : "",
    };
  });
}

/** Tiga belas butir Bab 12 yang dapat diukur. */
const BUTIR = [
  {
    kode: "MT01",
    kunci: "ujiBedaAntarPeriode",
    judul: "Uji Beda Antar Periode",
    keterangan: `Rentang dibelah dua menurut waktunya, lalu lama penyelesaian paruh pertama dibandingkan paruh kedua PER JENIS PERKARA - bauran jenis yang berubah dapat menggeser rerata keseluruhan tanpa satu pun jenis benar-benar berubah. Yang dinilai KESAHIHAN ujinya: jenis yang salah satu paruhnya kurang dari ${SAMPEL_MINIMAL_UJI_BEDA} putusan tidak boleh diuji, sebab uji atas sampel sekecil itu tetap memulangkan angka dan angka itu akan dikutip.`,
    baris: barisUjiBedaPeriode,
    pembilang: `Jenis perkara yang kedua paruhnya punya sekurangnya ${SAMPEL_MINIMAL_UJI_BEDA} putusan`,
    penyebut: "Seluruh jenis perkara yang punya putusan pada rentang ini",
    tabel: "perkara disambung perkara_putusan, dibelah menurut paruh waktu rentangnya",
    ruas: "tanggal_pendaftaran, tanggal_putusan, jenis_perkara_nama",
  },
  {
    kode: "MT02",
    kunci: "ujiBedaProporsiUnit",
    judul: "Uji Beda Proporsi Antar Unit",
    keterangan: `Proporsi perkara yang selesai di bawah asas ${HARI_ASAS_PENYELESAIAN} hari, tiap ketua majelis dibandingkan seluruh pengadilan. Majelis dengan kurang dari ${SAMPEL_MINIMAL_PROPORSI} putusan tidak boleh dibandingkan proporsinya dengan siapa pun. Perlu dipegang: proporsi tidak memperhitungkan bobot perkara, sehingga majelis yang kebetulan menerima banyak perkara berat akan tampak lebih buruk tanpa satu pun kesalahan.`,
    baris: barisUjiProporsiUnit,
    pembilang: `Majelis yang punya sekurangnya ${SAMPEL_MINIMAL_PROPORSI} putusan sehingga proporsinya boleh diuji`,
    penyebut: "Seluruh ketua majelis dan hakim tunggal yang punya putusan pada rentang ini",
    tabel: "perkara disambung perkara_putusan dan perkara_hakim_pn, dikelompokkan menurut hakim_id",
    ruas: "tanggal_putusan, hakim_id, jabatan_hakim_nama",
  },
  {
    kode: "MT03",
    kunci: "regresiLamaPenyelesaian",
    judul: "Analisis Regresi Lama Penyelesaian",
    keterangan: `Regresi menuntut peubah penjelas yang benar-benar ada nilainya pada tiap baris - ${PEUBAH_REGRESI.join(
      ", "
    )}. Baris yang salah satu peubahnya kosong dibuang diam-diam oleh hampir tiap pustaka regresi, dan model yang tersusun dari separuh data tetap memulangkan koefisien yang meyakinkan. Regresinya sendiri BELUM dijalankan ALETA: menyimpulkan sebab-akibat dari data pengamatan menuntut manusia yang memahami batasnya.`,
    baris: barisRegresiLama,
    pembilang: "Putusan yang seluruh peubah penjelasnya terisi",
    penyebut: "Seluruh putusan atas perkara yang didaftarkan pada rentang ini",
    tabel: "perkara disambung perkara_putusan, perkara_jadwal_sidang, dan perkara_hakim_pn",
    ruas: "tanggal_putusan, jumlah sidang, jumlah penundaan, jenis_perkara_nama, hakim_id",
  },
  {
    kode: "MT04",
    kunci: "analisisKohortPerkara",
    judul: "Analisis Kohort Perkara",
    keterangan:
      "Satu baris satu bulan pendaftaran, diikuti nasibnya. Kohort hanya dapat diikuti bila SELURUH anggotanya punya keadaan akhir yang diketahui. Satu perkara yang keadaannya tidak diketahui membuat seluruh kohort itu tidak dapat disimpulkan, sebab tidak ada yang tahu ia masuk hitungan yang mana.",
    baris: barisKohort,
    pembilang: "Bulan yang seluruh anggotanya punya keadaan akhir yang dapat dibaca",
    penyebut: "Seluruh bulan pendaftaran pada rentang ini",
    tabel: "perkara disambung perkara_putusan, dikelompokkan menurut bulan pendaftaran",
    ruas: "tanggal_pendaftaran, tanggal_putusan",
  },
  {
    kode: "MT05",
    kunci: "penguraianDeretWaktu",
    judul: "Penguraian Deret Waktu",
    keterangan: `Menguraikan deret menjadi tren, pola musiman, dan kejadian luar biasa menuntut sekurangnya ${BULAN_MINIMAL_DERET} bulan - dua putaran musim penuh. Di bawah itu, yang terurai sebagai pola musiman sebenarnya derau. Berbeda dari butir Bab 9 yang hanya menanyakan ada tidaknya bulan pembanding, butir ini menuntut panjang deretnya secara keseluruhan.`,
    baris: barisPenguraianDeret,
    pembilang: `Bulan pada deret yang panjangnya sekurangnya ${BULAN_MINIMAL_DERET} bulan`,
    penyebut: "Seluruh bulan pada rentang ini yang memuat penerimaan perkara",
    tabel: "perkara, dikelompokkan menurut bulan pendaftaran",
    ruas: "tanggal_pendaftaran",
  },
  {
    kode: "MT06",
    kunci: "deteksiDataPencilan",
    judul: "Deteksi Data Pencilan",
    keterangan:
      "Memakai jarak antar kuartil, BUKAN simpangan baku. Bedanya penting: satu perkara yang berjalan tiga tahun akan menggelembungkan simpangan bakunya sendiri sampai ia berhenti tampak menyimpang - pencilan yang menyembunyikan dirinya dengan kehadirannya sendiri. Kuartil tidak dapat digeser begitu. Butir Bab 9 memakai simpangan baku per jenis; perkara yang tertangkap keduanya memang pantas dibuka lebih dulu.",
    baris: barisPencilan,
    pembilang: "Putusan yang lama penyelesaiannya di dalam pagar 1,5 jarak antar kuartil",
    penyebut: "Seluruh putusan atas perkara yang didaftarkan pada rentang ini",
    tabel: "perkara disambung perkara_putusan",
    ruas: "tanggal_pendaftaran, tanggal_putusan",
  },
  {
    kode: "MT07",
    kunci: "analisisParetoPenyebab",
    judul: "Analisis Pareto Penyebab",
    keterangan: `Golongan alasan penundaan diurutkan dari yang terbanyak, lalu ditandai mana yang masuk ${(
      AMBANG_PARETO * 100
    ).toFixed(
      0
    )}% kumulatif pertama. Yang TIDAK memenuhi adalah golongan yang masuk kelompok itu, dan itu disengaja: yang ditandai justru yang perlu dikerjakan lebih dulu. Butir ini bukan nilai baik-buruk melainkan penunjuk arah, dan angkanya harus dibaca demikian.`,
    baris: barisPareto,
    pembilang: `Golongan penyebab yang berada DI LUAR ${(AMBANG_PARETO * 100).toFixed(0)}% kumulatif pertama`,
    penyebut: "Seluruh golongan alasan penundaan yang muncul pada rentang ini",
    tabel: "perkara disambung perkara_jadwal_sidang, digolongkan dari alasan_ditunda",
    ruas: "ditunda, alasan_ditunda",
  },
  {
    kode: "MT08",
    kunci: "indeksKonsentrasiBeban",
    judul: "Indeks Konsentrasi Beban",
    keterangan: `Herfindahl yang dinormalkan: nol berarti beban terbagi persis rata, satu berarti seluruhnya ditanggung satu orang, dan ambangnya ${AMBANG_KONSENTRASI}. Berbeda dari koefisien Gini pada bab beban kerja, indeks ini lebih peka terhadap satu pemegang yang sangat besar - keduanya sengaja dipakai, sebab ketimpangan punya dua bentuk yang berbeda.`,
    baris: barisKonsentrasiBeban,
    pembilang: `Majelis pada pengadilan yang indeks konsentrasi bebannya tidak melampaui ${AMBANG_KONSENTRASI}`,
    penyebut: "Seluruh ketua majelis dan hakim tunggal yang memegang perkara pada rentang ini",
    tabel: "perkara disambung perkara_hakim_pn, dikelompokkan menurut hakim_id",
    ruas: "hakim_id, jabatan_hakim_nama, aktif",
  },
  {
    kode: "MT09",
    kunci: "ujiHubunganAntarUkuran",
    judul: "Uji Hubungan Antar Ukuran",
    keterangan:
      "Pasangan yang diuji DITETAPKAN LEBIH DAHULU, dan itu batas terpenting di seluruh bab ini. Menghitung korelasi seluruh pasangan yang mungkin lalu melaporkan yang terkuat adalah cara paling mudah menemukan hubungan yang tidak ada - pada dua puluh ukuran ada seratus sembilan puluh pasangan, dan beberapa PASTI berkorelasi kuat secara kebetulan. Empat pasangan yang dipakai masing-masing punya alasan hukum acara, bukan alasan angka.",
    baris: barisHubunganUkuran,
    pembilang: "Pasangan ukuran yang sampelnya cukup dan kedua ukurannya beragam",
    penyebut: "Empat pasangan ukuran yang ditetapkan lebih dahulu",
    tabel: "perkara disambung perkara_putusan, perkara_jadwal_sidang, perkara_pelaksanaan_relaas, perkara_efiling_id",
    ruas: "jumlah sidang, jumlah penundaan, jumlah relaas, e-filing, lama penyelesaian",
  },
  {
    kode: "MT10",
    kunci: "selangKepercayaanNilai",
    judul: "Selang Kepercayaan Nilai",
    keterangan: `Tiap angka nilai sesungguhnya berkisar, dan kisarannya melebar ketika penyebutnya kecil - nilai 100% dari tiga perkara berkisar 44% sampai 100%, dan angka "100%" tanpa kisarannya akan dibaca sebagai kepastian. Yang dinilai apakah kisarannya cukup SEMPIT untuk berguna: bulan yang selangnya lebih lebar daripada ${(
      LEBAR_SELANG_MAKSIMAL * 100
    ).toFixed(0)}% tidak boleh dipakai membandingkan apa pun.`,
    baris: barisSelangKepercayaan,
    pembilang: `Bulan yang setengah lebar selang kepercayaannya tidak melampaui ${(
      LEBAR_SELANG_MAKSIMAL * 100
    ).toFixed(0)}%`,
    penyebut: "Seluruh bulan pada rentang ini yang memuat putusan",
    tabel: "perkara disambung perkara_putusan, dikelompokkan menurut bulan pendaftaran",
    ruas: "tanggal_pendaftaran, tanggal_putusan",
  },
  {
    kode: "MT11",
    kunci: "petaKendaliProses",
    judul: "Peta Kendali Proses",
    keterangan: `Peta kendali atas PENERIMAAN perkara per bulan - berbeda dari peta kendali Bab 10 yang mengawasi lama penyelesaiannya. Keduanya sengaja ada: proses yang menerima perkara dan proses yang menyelesaikannya dapat lepas kendali sendiri-sendiri, dan yang satu tidak akan menunjukkan yang lain. Batasnya rerata ditambah dan dikurangi ${LEBAR_BATAS_KENDALI} simpangan baku.`,
    baris: barisPetaKendaliProses,
    pembilang: "Bulan yang penerimaannya berada di dalam batas kendali",
    penyebut: "Seluruh bulan pada rentang ini, bila rentangnya sekurangnya tiga bulan",
    tabel: "perkara, dikelompokkan menurut bulan pendaftaran",
    ruas: "tanggal_pendaftaran",
  },
  {
    kode: "MT12",
    kunci: "sebabAkarTemuan",
    judul: "Penelusuran Sebab Akar Temuan",
    keterangan:
      "Temuan yang berulang punya sebab, dan sebab itu jarang berupa petugasnya kurang teliti. Yang ditelusuri apakah tiap jenis temuan dapat dipulangkan ke satu SEBAB YANG DAPAT DITINDAK - kolom yang tidak ada, kolom yang ada tetapi tidak diisi, atau aturan yang belum ditetapkan. Temuan yang sebabnya tidak dapat disebutkan akan berulang pada tiap pemeriksaan berikutnya, dan tiap kali dicatat sebagai temuan baru.",
    baris: barisSebabAkar,
    pembilang: "Jenis temuan yang sebabnya dapat ditindak satuan kerja sendiri",
    penyebut: "Seluruh jenis temuan yang dikenali mesin penilaian",
    tabel: "daftar yang ditetapkan di dalam kode - bukan dari basis data",
    ruas: "jenis temuan, contoh, dan tindakan yang mungkin",
  },
  {
    kode: "MT13",
    kunci: "ujiPetikBerbasisRisiko",
    judul: "Uji Petik Berbasis Risiko",
    keterangan: `Waktu pemeriksa terbatas, jadi yang dipilih untuk diperiksa manual bukan sampel acak melainkan berkas yang paling mungkin bermasalah - disusun dari penanda yang sudah terukur butir lain, dengan ambang nilai risiko ${AMBANG_RISIKO_PETIK}. Yang TIDAK memenuhi adalah berkas yang TERPILIH, dan itu disengaja: daftar yang tidak memenuhi adalah daftar kerjanya, bukan daftar kesalahan.`,
    baris: barisUjiPetikRisiko,
    pembilang: `Perkara yang nilai risikonya di bawah ambang ${AMBANG_RISIKO_PETIK}`,
    penyebut: "Seluruh perkara yang didaftarkan pada rentang ini",
    tabel: "perkara disambung perkara_putusan, perkara_jadwal_sidang, perkara_hakim_pn, perkara_pelaksanaan_relaas",
    ruas: "tanggal_putusan, tanggal_minutasi, jumlah sidang, jumlah penundaan, hakim_id, jumlah relaas",
  },
];

let sudahDidaftar = false;

function daftarkanSemua() {
  if (sudahDidaftar) return BUTIR.map((b) => b.kunci);

  BUTIR.forEach((b) => {
    if (kerangka.ambil(b.kunci)) return;
    kerangka.daftarkan({
      kunci: b.kunci,
      judul: b.judul,
      keterangan: b.keterangan,
      lantai: "bulanan",
      versiRumus: "metode-analisis-v1",
      ambangDipakai: [],
      caraHitung: {
        pembilang: b.pembilang,
        penyebut: b.penyebut,
        dikecualikan:
          "Perkara yang belum diputus dikeluarkan dari butir yang mengukur lama penyelesaian - ia belum punya lamanya. Kelompok yang sampelnya di bawah syarat kesahihan TIDAK dikeluarkan melainkan ditandai tidak memenuhi: mengeluarkannya berarti menyembunyikan bahwa metodenya tidak boleh dipakai, dan itu justru yang ingin disampaikan bab ini.",
        tabelSumber: b.tabel,
        ruasSumber: b.ruas,
      },
      baris: b.baris,
    });
  });

  sudahDidaftar = true;
  return BUTIR.map((b) => b.kunci);
}

function lupakanSemua() {
  sudahDidaftar = false;
}

function sambungan() {
  const peta = {};
  BUTIR.forEach((b) => {
    peta[b.kode] = b.kunci;
  });
  return peta;
}

module.exports = {
  AMBANG_KONSENTRASI,
  AMBANG_PARETO,
  AMBANG_RISIKO_PETIK,
  BULAN_MINIMAL_DERET,
  BUTIR,
  LEBAR_SELANG_MAKSIMAL,
  PASANGAN_UKURAN,
  PEUBAH_REGRESI,
  SAMPEL_MINIMAL_PROPORSI,
  SAMPEL_MINIMAL_UJI_BEDA,
  SEBAB_AKAR,
  barisHubunganUkuran,
  barisKohort,
  barisKonsentrasiBeban,
  barisPareto,
  barisPencilan,
  barisPenguraianDeret,
  barisPetaKendaliProses,
  barisRegresiLama,
  barisSebabAkar,
  barisSelangKepercayaan,
  barisUjiBedaPeriode,
  barisUjiPetikRisiko,
  barisUjiProporsiUnit,
  daftarkanSemua,
  indeksKonsentrasi,
  korelasi,
  kuantil,
  lupakanSemua,
  rerata,
  sambungan,
  selangProporsi,
  simpanganBaku,
  statistikT,
  statistikZ,
};
