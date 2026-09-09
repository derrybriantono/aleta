"use strict";

/**
 * ============================================================================
 * MS06 - BERKAS PENGAWASAN SIAP KIRIM
 * ============================================================================
 *
 * Butir MS06 katalog e-Audit: "Nilai, temuan, bukti, dan tanggal hitung dalam
 * satu berkas siap dikirim kepada pengawas."
 *
 * Keempatnya sudah ada di ALETA, tetapi terpencar: nilainya di kerangka
 * penilaian, temuannya di catatan penilaian, buktinya di dalam tiap satuan
 * periode, dan aturan yang berlaku di ambang. Yang belum ada satu tempat yang
 * merangkainya.
 *
 * ============================================================================
 * KENAPA HARUS SATU BERKAS, DAN BUKAN EMPAT LAYAR
 * ============================================================================
 *
 * Pengawas tidak memakai ALETA. Yang sampai kepadanya sebuah berkas, dan
 * berkas itu harus dapat berdiri sendiri berbulan-bulan sesudah dikirim -
 * ketika datanya sudah berubah, ketika ambangnya mungkin sudah diganti, dan
 * ketika tidak ada seorang pun yang ingat bagaimana angka itu dahulu
 * dihitung.
 *
 * Karena itu berkas ini memuat, dan HARUS memuat, kelima-limanya:
 *
 *   nilai         angka yang dilaporkan, beserta pembilang dan penyebutnya
 *   bukti         daftar perkara penyusun angka itu, satu per satu
 *   temuan        catatan pengawasan yang sudah tertulis atas periode itu
 *   tanggalHitung kapan angkanya dihitung - bukan kapan berkasnya dibuka
 *   aturan        ambang yang BERLAKU saat itu, beserta sidiknya
 *
 * Yang terakhir yang paling mudah dilupakan dan paling menentukan. Nilai 82
 * yang dihitung dengan ambang tiga hari bukan nilai yang sama dengan 82 yang
 * dihitung dengan ambang lima hari, dan berkas yang tidak menyebutkan
 * ambangnya tidak dapat dipertahankan ketika ambangnya kelak berubah.
 *
 * ============================================================================
 * BERKASNYA DIPERIKSA SEBELUM DIKIRIM
 * ============================================================================
 *
 * celaBerkas() memeriksa kelimanya benar-benar ada. Berkas yang kurang satu
 * bagian tidak dikirim setengah - ia ditolak beserta sebabnya, sebab berkas
 * pengawasan yang tidak lengkap lebih berbahaya daripada tidak ada: yang
 * menerimanya tidak tahu bagian mana yang hilang.
 */

const kerangkaPenilaian = require("./kerangkaPenilaianService");
const catatanPenilaian = require("./catatanPenilaianService");
const ambangPenilaian = require("./ambangPenilaianService");

/** Bagian yang wajib ada pada tiap berkas pengawasan. */
const BAGIAN_WAJIB = ["penilaian", "periode", "nilai", "bukti", "temuan", "aturan", "tanggalHitung"];

/**
 * Cela pada satu berkas pengawasan.
 *
 * Murni - tidak menyentuh basis data - supaya dapat diuji, dan supaya
 * pemeriksaan kemampuan mesin dapat memanggilnya tanpa SIPP.
 *
 * @returns {string[]} kosong berarti berkasnya utuh
 */
function celaBerkas(berkas) {
  const cela = [];
  if (!berkas || typeof berkas !== "object") return ["berkas bukan objek"];

  for (const bagian of BAGIAN_WAJIB) {
    if (!Object.prototype.hasOwnProperty.call(berkas, bagian)) {
      cela.push(`bagian "${bagian}" tidak ada`);
    }
  }
  if (cela.length) return cela;

  if (!String(berkas.tanggalHitung || "").trim()) {
    cela.push("tanggalHitung kosong - tanpa itu, angkanya tidak dapat ditempatkan dalam waktu");
  }

  if (!berkas.penilaian || !String(berkas.penilaian.kunci || "").trim()) {
    cela.push("penilaian tidak menyebut kuncinya");
  } else if (!String(berkas.penilaian.versiRumus || "").trim()) {
    // Tanpa versi rumus, perubahan angka tidak dapat dibedakan antara
    // "datanya berubah" dan "cara menghitungnya berubah".
    cela.push("penilaian tidak menyebut versi rumusnya");
  }

  if (!Array.isArray(berkas.bukti)) {
    cela.push("bukti bukan daftar");
  }
  if (!Array.isArray(berkas.temuan)) {
    cela.push("temuan bukan daftar");
  }

  if (!berkas.aturan || !String(berkas.aturan.sidik || "").trim()) {
    cela.push("aturan tidak membawa sidiknya - berkas tidak dapat dipertahankan bila ambangnya kelak berubah");
  }

  return cela;
}

/**
 * Menyusun satu berkas pengawasan.
 *
 * @param {string} kunci        kunci penilaian
 * @param {string} jenisPeriode salah satu jendela periode
 * @param {string} acuan        tanggal acuan (YYYY-MM-DD)
 */
async function susun(kunci, jenisPeriode, acuan, opsi = {}) {
  const hasil = await kerangkaPenilaian.jalankan(kunci, jenisPeriode, acuan, opsi);
  if (!hasil || !hasil.ok) {
    return { ok: false, alasan: (hasil && hasil.alasan) || "penilaian_tidak_dapat_dijalankan" };
  }

  // Satuan TERAKHIR yang dilaporkan - itulah periode berjalan. Yang
  // sebelumnya tetap dibawa sebagai riwayat, sebab satu angka tanpa
  // pembandingnya tidak menerangkan apa pun.
  const satuan = Array.isArray(hasil.satuan) ? hasil.satuan : [];
  const terkini = satuan.length ? satuan[satuan.length - 1] : null;

  // Temuan yang sudah tertulis atas penilaian ini. Kegagalan membacanya tidak
  // menggagalkan berkasnya - ia menjadi daftar kosong beserta sebabnya,
  // sebab berkas tanpa temuan tetap berguna, sedangkan berkas yang gagal
  // disusun tidak berguna sama sekali.
  let temuan = [];
  let sebabTemuan = "";
  try {
    const dibaca = await catatanPenilaian.bacaCatatan({ kunciPenilaian: kunci });
    temuan = Array.isArray(dibaca) ? dibaca : (dibaca && dibaca.baris) || [];
  } catch (galat) {
    temuan = [];
    sebabTemuan = String((galat && galat.message) || galat).slice(0, 160);
  }

  const berkas = {
    judul: `Berkas pengawasan - ${hasil.judul}`,
    // Tanggal hitung, BUKAN tanggal berkas dibuka. Keduanya berbeda begitu
    // berkasnya disimpan lalu dibaca kembali.
    tanggalHitung: new Date().toISOString(),
    penilaian: {
      kunci: hasil.kunci,
      judul: hasil.judul,
      keterangan: hasil.keterangan,
      lantai: hasil.lantai,
      versiRumus: hasil.versiRumus,
      caraHitung: hasil.caraHitung || {},
    },
    periode: hasil.periode,
    nilai: terkini
      ? {
          unit: terkini.unit,
          angka: terkini.nilai ?? null,
          cukup: Boolean(terkini.cukup),
          sebabTidakCukup: terkini.sebabTidakCukup || "",
          jumlahBukti: terkini.jumlahBukti ?? (terkini.bukti || []).length,
          belumMemenuhi: terkini.belumMemenuhi ?? 0,
        }
      : { unit: null, angka: null, cukup: false, sebabTidakCukup: "tidak ada satuan periode" },
    riwayat: satuan.map((s) => ({ unit: s.unit, angka: s.nilai ?? null, cukup: Boolean(s.cukup) })),
    bukti: terkini && Array.isArray(terkini.bukti) ? terkini.bukti : [],
    temuan,
    sebabTemuanKosong: sebabTemuan,
    aturan: {
      sidik: ambangPenilaian.sidikAmbang(),
      dipakai: hasil.ambangDipakai || [],
    },
    bawahLantai: Boolean(hasil.bawahLantai),
  };

  const cela = celaBerkas(berkas);
  if (cela.length) return { ok: false, alasan: "berkas_tidak_lengkap", cela };

  return { ok: true, berkas };
}

module.exports = {
  BAGIAN_WAJIB,
  celaBerkas,
  susun,
};
