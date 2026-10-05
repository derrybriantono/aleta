"use strict";

/**
 * Buku waktu antrian sidang (antrianWaktuService) dan rute yang membawanya ke
 * jadwal sidang.
 *
 * ============================================================================
 * YANG DIJAGA
 * ============================================================================
 *
 *   - Waktu ambil tiap sisi TIDAK ditimpa sesudah terisi, walau aplikasi
 *     antrian menulis ulang kolomnya.
 *   - Jam jadwal asli diambil hanya dari baris yang BELUM PERNAH teramati
 *     dipanggil - sesudah itu jam_sidang berisi jam panggil.
 *   - Panggilan pertama tetap; panggilan terakhir dan hitungannya mengikuti.
 *   - Pencatat tidak menjatuhkan bot, tidak tumpang tindih, tidak membanjiri
 *     log, dan tidak menulis apa pun di luar jam kerja atau pada hari tanpa
 *     antrian.
 *   - Rute jadwal sidang mengirim waktu SELURUH perkara hari itu - bukan hanya
 *     yang tampil - sebab yang tersaring tetap menjadi tetangga dalam hitungan
 *     jarak antar sidang.
 *
 * Tanpa basis data: aplikasi antrian dan basis data ALETA ditiru. Kueri yang
 * dikirim layanan tetap diperiksa bentuknya (DATE_FORMAT, CURDATE, tidak ada
 * tulisan ke aplikasi antrian).
 */

process.env.NODE_ENV = "test";
process.env.ALETA_BOT_INTERNAL_API_TOKEN = process.env.ALETA_BOT_INTERNAL_API_TOKEN || "token-uji-lokal";

const path = require("path");
const http = require("http");
const Module = require("module");

let lulus = 0;
let gagal = 0;

function periksa(nama, benar) {
  if (benar) {
    lulus += 1;
    console.log(`  OK    ${nama}`);
  } else {
    gagal += 1;
    console.log(`  GAGAL ${nama}`);
  }
}

function tiru(namaBerkas, exports) {
  const jalur = require.resolve(path.resolve(__dirname, "..", "services", namaBerkas));
  const m = new Module(jalur, null);
  m.filename = jalur;
  m.loaded = true;
  m.exports = exports;
  require.cache[jalur] = m;
  return m;
}

// ---------------------------------------------------------------------------
// Aplikasi antrian tiruan: baris "hari ini" sebagaimana DIPULANGKAN kueri
// (sudah diformat SQL), plus jam basis datanya.
// ---------------------------------------------------------------------------
const antrian = {
  sekarang: "2026-09-01 08:00:00",
  hariIni: "2026-09-01",
  baris: [],
  lempar: "",
  lemparJam: "",
};
const kueriAntrian = [];

tiru("externalDbService.js", {
  sanitizeError: (galat) => String((galat && galat.message) || galat),
  query: async (kunci, sql, params = []) => {
    kueriAntrian.push({ kunci, sql: String(sql), params });
    if (/NOW\(\)/.test(sql) && /AS sekarang/.test(sql)) {
      if (antrian.lemparJam) throw new Error(antrian.lemparJam);
      return [{ sekarang: antrian.sekarang, hariIni: antrian.hariIni }];
    }
    if (antrian.lempar) throw new Error(antrian.lempar);
    if (/FROM sipp_turunan_antrian\.antrian_sidang/.test(sql)) {
      return antrian.baris.map((b) => ({ ...b }));
    }
    return [];
  },
});

// Peta nomor antrian resmi tiruan - rumusnya milik antrianSidangService dan
// dijaga verify-antrian-sidang.js; di sini cukup nomornya.
const petaNomor = { terbaca: true, peta: {} };
let petaNomorDibaca = 0;
tiru("antrianSidangService.js", {
  petaAntrian: async () => {
    petaNomorDibaca += 1;
    return petaNomor;
  },
  saringUntukPerkara: (hasil, ids = []) => {
    if (!hasil || !hasil.terbaca) return hasil;
    const diminta = new Set(ids.map(String));
    if (diminta.size === 0) return hasil;
    const peta = {};
    for (const [k, v] of Object.entries(hasil.peta)) if (diminta.has(k)) peta[k] = v;
    return { ...hasil, peta };
  },
});

// ---------------------------------------------------------------------------
// Basis data ALETA tiruan: menyimpan apa yang DIKIRIM - aturan "tidak
// ditimpa" harus sudah dijalankan layanan sebelum sampai ke sini. (Aturan
// yang sama di SQL-nya diuji terhadap MariaDB sungguhan secara terpisah.)
// ---------------------------------------------------------------------------
const tabel = new Map();
const kueriBot = [];
let lemparBot = "";

tiru("botDbService.js", {
  ensureSchema: async () => true,
  addColumnIfMissing: async () => true,
  addIndexIfMissing: async () => true,
  toMysqlDate: (d) => new Date(d).toISOString().slice(0, 19).replace("T", " "),
  fromMysqlDate: (v) => (v ? new Date(v) : null),
  query: async (sql, params = []) => {
    kueriBot.push({ sql: String(sql), params });
    if (lemparBot) throw new Error(lemparBot);
    if (/CREATE TABLE IF NOT EXISTS aleta_bot_antrian_waktu/.test(sql)) return [];
    if (/INSERT INTO aleta_bot_antrian_waktu/.test(sql)) {
      const [
        tanggal, perkara, nomor, noRuang, ruanganId, majelis, online, petugas,
        p1, p2, saksi, terawal, jamJadwal, pertama, terakhir, jumlah, lihat1, lihat2,
      ] = params;
      const k = `${tanggal}|${perkara}`;
      const lama = tabel.get(k);
      tabel.set(k, {
        tanggalSidang: tanggal,
        perkaraId: perkara,
        nomorAntrian: nomor,
        noRuang,
        ruanganId,
        majelisKode: majelis,
        online,
        namaPetugas: petugas,
        ambilPihak1: p1,
        ambilPihak2: p2,
        ambilSaksi: saksi,
        ambilTerawal: terawal,
        jamJadwal,
        panggilPertama: pertama,
        panggilTerakhir: terakhir,
        jumlahPanggil: jumlah,
        terlihatPertama: lama ? lama.terlihatPertama : lihat1,
        terlihatTerakhir: lihat2,
      });
      return { affectedRows: lama ? 2 : 1 };
    }
    if (/FROM aleta_bot_antrian_waktu/.test(sql)) {
      const hari = new Set(params);
      return [...tabel.values()].filter((b) => hari.has(b.tanggalSidang)).map((b) => ({ ...b }));
    }
    return [];
  },
});

const catatanLog = [];
tiru("logService.js", {
  logSystemEvent: async (isi) => {
    catatanLog.push(isi);
    return true;
  },
  logSecurityEvent: async () => true,
  logWhatsappEvent: async () => true,
});

const layanan = require("../services/antrianWaktuService");

/** Satu baris aplikasi antrian sebagaimana dipulangkan SQL_HARI_INI. */
function barisAntrian(ubah = {}) {
  return {
    perkaraId: 9971,
    tanggalSidang: "2026-09-01",
    majelisKode: "B|C2|C3",
    ruanganId: 1,
    noRuang: 1,
    jamSidang: "09:00:00",
    namaPetugas: "RAHMA",
    disidang: 0,
    online: null,
    pihak1: null,
    pihak2: null,
    saksi: null,
    ...ubah,
  };
}

function bersihkan() {
  tabel.clear();
  kueriAntrian.length = 0;
  kueriBot.length = 0;
  catatanLog.length = 0;
  antrian.baris = [];
  antrian.lempar = "";
  antrian.lemparJam = "";
  antrian.sekarang = "2026-09-01 08:00:00";
  antrian.hariIni = "2026-09-01";
  lemparBot = "";
  petaNomor.terbaca = true;
  petaNomor.peta = {};
  layanan.lupakan();
}

async function utama() {
  console.log("\nUji buku waktu antrian sidang\n");

  // ==========================================================================
  console.log("== gabungWaktu: aturan yang tidak boleh ditimpa ==");
  {
    const g = layanan.gabungWaktu;
    const pertama = g(
      null,
      {
        tanggalSidang: "2026-09-01",
        perkaraId: "9971",
        jamSidang: "09:00:00",
        disidang: 0,
        pihak1: "2026-09-01 08:12:40",
        pihak2: "",
        saksi: "",
        nomorAntrian: 3,
        noRuang: 1,
      },
      "2026-09-01 08:13:00"
    );
    periksa("baris baru selalu ditulis", pertama.berubah === true);
    periksa("waktu ambil pihak 1 berdetik", pertama.baris.ambilPihak1 === "2026-09-01 08:12:40");
    periksa("ambil terawal = pihak 1", pertama.baris.ambilTerawal === "2026-09-01 08:12:40");
    periksa("jam jadwal asli tercatat sebelum dipanggil", pertama.baris.jamJadwal === "09:00:00");
    periksa("belum ada panggilan", pertama.baris.panggilPertama === "" && pertama.baris.jumlahPanggil === 0);
    periksa("terlihat pertama dari jam antrian", pertama.baris.terlihatPertama === "2026-09-01 08:13:00");

    // Mesin kios menulis ulang pihak_1 saat orang KEDUA dari sisi yang sama
    // mengambil: kedatangan pertama tetap yang tercatat.
    const kios = g(
      pertama.baris,
      {
        tanggalSidang: "2026-09-01",
        perkaraId: "9971",
        jamSidang: "09:00:00",
        disidang: 0,
        pihak1: "2026-09-01 08:50:00",
        pihak2: "2026-09-01 08:05:00",
        saksi: "2026-09-01 08:55:10",
      },
      "2026-09-01 08:55:30"
    );
    periksa("pihak 1 TIDAK ditimpa waktu yang lebih baru", kios.baris.ambilPihak1 === "2026-09-01 08:12:40");
    periksa("pihak 2 yang baru terlihat ikut tercatat", kios.baris.ambilPihak2 === "2026-09-01 08:05:00");
    periksa("ambil terawal ikut yang lebih awal", kios.baris.ambilTerawal === "2026-09-01 08:05:00");
    periksa("saksi tercatat tetapi tidak ikut menentukan terawal", kios.baris.ambilSaksi === "2026-09-01 08:55:10");
    periksa("nomor lama dipertahankan saat pengamatan tanpa nomor", kios.baris.nomorAntrian === 3);

    // Dipanggil: jam_sidang ditimpa NOW().
    const panggil1 = g(
      kios.baris,
      { tanggalSidang: "2026-09-01", perkaraId: "9971", jamSidang: "09:41:19", disidang: 1 },
      "2026-09-01 09:41:30"
    );
    periksa("panggilan pertama tercatat berdetik", panggil1.baris.panggilPertama === "2026-09-01 09:41:19");
    periksa("panggilan terakhir = pertama", panggil1.baris.panggilTerakhir === "2026-09-01 09:41:19");
    periksa("dipanggil satu kali", panggil1.baris.jumlahPanggil === 1);
    periksa("jam jadwal asli TIDAK ditimpa jam panggil", panggil1.baris.jamJadwal === "09:00:00");

    const sama = g(
      panggil1.baris,
      { tanggalSidang: "2026-09-01", perkaraId: "9971", jamSidang: "09:41:19", disidang: 1 },
      "2026-09-01 09:42:00"
    );
    periksa("pengamatan yang sama tidak menulis", sama.berubah === false);
    periksa("dan tidak menambah hitungan", sama.baris.jumlahPanggil === 1);

    const segar = g(
      panggil1.baris,
      { tanggalSidang: "2026-09-01", perkaraId: "9971", jamSidang: "09:41:19", disidang: 1 },
      "2026-09-01 09:46:31"
    );
    periksa("lima menit kemudian ditulis untuk memajukan terlihat_terakhir", segar.berubah === true);

    const panggil2 = g(
      panggil1.baris,
      { tanggalSidang: "2026-09-01", perkaraId: "9971", jamSidang: "10:05:02", disidang: 1 },
      "2026-09-01 10:05:10"
    );
    periksa("panggilan ulang: pertama TETAP", panggil2.baris.panggilPertama === "2026-09-01 09:41:19");
    periksa("panggilan ulang: terakhir mengikuti", panggil2.baris.panggilTerakhir === "2026-09-01 10:05:02");
    periksa("panggilan ulang: hitungan dua", panggil2.baris.jumlahPanggil === 2);

    // Tanda dipanggil dilepas lagi (mis. dikembalikan ke antrian): jam_sidang
    // sekarang jam PANGGIL, bukan jadwal - tidak boleh tersalin sebagai jadwal.
    const lepas = g(
      { ...panggil2.baris, jamJadwal: "" },
      { tanggalSidang: "2026-09-01", perkaraId: "9971", jamSidang: "10:05:02", disidang: 0 },
      "2026-09-01 10:06:00"
    );
    periksa("sesudah pernah dipanggil, jam_sidang tidak menjadi jadwal", lepas.baris.jamJadwal === "");
    periksa("panggilan terakhir tidak hilang saat tandanya dilepas", lepas.baris.panggilTerakhir === "2026-09-01 10:05:02");

    // Pencatat yang baru menyala sesudah perkaranya dipanggil.
    const telat = g(
      null,
      { tanggalSidang: "2026-09-01", perkaraId: "9956", jamSidang: "09:30:00", disidang: 1, pihak1: "2026-09-01 08:00:00" },
      "2026-09-01 10:00:00"
    );
    periksa("pengamatan pertama yang sudah dipanggil: jadwal tidak diketahui", telat.baris.jamJadwal === "");
    periksa("tetapi jam panggilnya tetap tepat", telat.baris.panggilTerakhir === "2026-09-01 09:30:00");

    // jam_sidang ber-DATETIME di aplikasi antrian pengadilan lain.
    const lengkap = g(
      null,
      { tanggalSidang: "2026-09-01", perkaraId: "1", jamSidang: "2026-09-01 11:02:03", disidang: 1 },
      "2026-09-01 11:05:00"
    );
    periksa("jam_sidang DATETIME terbaca sama", lengkap.baris.panggilTerakhir === "2026-09-01 11:02:03");
    periksa("jam nol bukan jadwal", layanan.jamDariJamSidang("00:00:00") === "");
    periksa("tanggal nol MySQL dianggap kosong", g(null, { tanggalSidang: "2026-09-01", perkaraId: "2", pihak1: "0000-00-00 00:00:00" }, "2026-09-01 08:00:00").baris.ambilPihak1 === "");
    periksa("jam panggil TIME dilekatkan pada tanggal sidang", layanan.waktuPanggilDari("9:05", "2026-09-01") === "2026-09-01 09:05:00");
  }

  // ==========================================================================
  console.log("\n== Arti disidang aplikasi antrian (5 Okt 2026): 1..9 = di ruang, 10 = SELESAI ==");
  {
    const g = layanan.gabungWaktu;
    const menunggu = g(
      null,
      { tanggalSidang: "2026-10-05", perkaraId: "609", jamSidang: "09:00:00", disidang: null, pihak1: "2026-10-05 08:30:00" },
      "2026-10-05 08:31:00"
    ).baris;
    periksa("NULL = menunggu: jam jadwal tercatat, belum dipanggil", menunggu.jamJadwal === "09:00:00" && menunggu.panggilTerakhir === "");

    // Data hidup 5 Okt 10.20: 609/Pdt.G/2026 disidang = 1, jam_sidang 10:19.
    const masuk = g(menunggu, { tanggalSidang: "2026-10-05", perkaraId: "609", jamSidang: "10:19:04", disidang: 1 }, "2026-10-05 10:20:00").baris;
    periksa("disidang = nomor ruang: jam masuk ruang tercatat sebagai panggilan", masuk.panggilTerakhir === "2026-10-05 10:19:04");
    periksa("dan dihitung satu panggilan", masuk.jumlahPanggil === 1);
    periksa("jam jadwal tidak tertimpa jam masuk", masuk.jamJadwal === "09:00:00");

    // Selesai: aplikasi antrian menulis 10 TANPA mengubah jam_sidang.
    const selesai = g(masuk, { tanggalSidang: "2026-10-05", perkaraId: "609", jamSidang: "10:19:04", disidang: 10 }, "2026-10-05 10:40:00").baris;
    periksa("disidang = 10 sesudah di ruang: bukan panggilan baru", selesai.jumlahPanggil === 1 && selesai.panggilTerakhir === "2026-10-05 10:19:04");

    // Langsung ditunda tanpa PROSES: 10 dengan jam_sidang = jam jadwal.
    const tundaLangsung = g(menunggu, { tanggalSidang: "2026-10-05", perkaraId: "609", jamSidang: "09:00:00", disidang: 10 }, "2026-10-05 11:00:00").baris;
    periksa("10 dengan jam = jadwal: TIDAK dicatat sebagai panggilan", tundaLangsung.panggilTerakhir === "" && tundaLangsung.jumlahPanggil === 0);

    // Masuk ruang yang TIDAK teramati (selang 30 detik terlewat), lalu selesai.
    const terlewat = g(menunggu, { tanggalSidang: "2026-10-05", perkaraId: "609", jamSidang: "10:19:04", disidang: 10 }, "2026-10-05 11:00:00").baris;
    periksa("10 dengan jam berbeda dari jadwal: jam masuknya tetap tercatat", terlewat.panggilTerakhir === "2026-10-05 10:19:04");

    // Pencatat baru menyala sesudah sidangnya selesai, jadwal tak diketahui.
    const tanpaJadwal = g(null, { tanggalSidang: "2026-10-05", perkaraId: "610", jamSidang: "09:30:00", disidang: 10 }, "2026-10-05 11:00:00").baris;
    periksa("10 tanpa jadwal tercatat: tidak dikarang menjadi panggilan", tanpaJadwal.panggilTerakhir === "");
    periksa("dan jam_sidang-nya tidak dicatat sebagai jadwal", tanpaJadwal.jamJadwal === "");
  }

  // ==========================================================================
  console.log("\n== Jam kerja WITA, bukan jam server ==");
  {
    // 1 September 2026 hari Selasa. 00:30 UTC = 08:30 WITA.
    periksa("Selasa 08:30 WITA termasuk", layanan.dalamJamKerja(new Date("2026-09-01T00:30:00Z")) === true);
    periksa("Selasa 06:59 WITA belum", layanan.dalamJamKerja(new Date("2026-08-31T22:59:00Z")) === false);
    periksa("Selasa 18:00 WITA sudah lewat", layanan.dalamJamKerja(new Date("2026-09-01T10:00:00Z")) === false);
    periksa("Minggu tidak dicatat", layanan.dalamJamKerja(new Date("2026-09-06T02:00:00Z")) === false);
    periksa("Sabtu tidak dicatat", layanan.dalamJamKerja(new Date("2026-09-05T02:00:00Z")) === false);
  }

  // ==========================================================================
  console.log("\n== Pencatat berkala ==");
  {
    bersihkan();
    const luar = await layanan.catatSekali({ paksa: false });
    // Tidak dapat memastikan jam uji di luar jam kerja tanpa memalsukan jam;
    // yang dipastikan: bila dilewati, tidak satu kueri pun dikirim.
    if (luar.dilewati) {
      periksa("di luar jam kerja: tidak satu kueri pun", kueriAntrian.length === 0 && kueriBot.length === 0);
    } else {
      periksa("di dalam jam kerja: putaran berjalan", luar.ok === true);
    }

    bersihkan();
    antrian.baris = [];
    const kosong = await layanan.catatSekali({ paksa: true });
    periksa("hari tanpa antrian: berhasil, nol ditulis", kosong.ok === true && kosong.ditulis === 0);
    periksa("hari tanpa antrian: tabel ALETA tidak disentuh sama sekali", kueriBot.length === 0);

    bersihkan();
    antrian.sekarang = "2026-09-01 08:15:00";
    antrian.baris = [
      barisAntrian({ perkaraId: 9971, pihak1: "2026-09-01 08:12:40" }),
      barisAntrian({ perkaraId: 9956, noRuang: 2, jamSidang: "09:30:00", pihak2: "2026-09-01 08:14:05" }),
      barisAntrian({ perkaraId: 9958 }),
    ];
    petaNomor.peta = {
      9971: { nomor: 1, tanggalSidang: "2026-09-01" },
      9956: { nomor: 2, tanggalSidang: "2026-09-01" },
      // Baris hari LAIN - nomornya bukan milik sidang hari ini.
      9958: { nomor: 9, tanggalSidang: "2026-08-31" },
    };
    const satu = await layanan.catatSekali({ paksa: true });
    periksa("putaran pertama menulis ketiga baris", satu.ok === true && satu.ditulis === 3);
    periksa("nomor resmi ikut tersimpan", tabel.get("2026-09-01|9971").nomorAntrian === 1);
    periksa("nomor bertanggal lain tidak dipakai", tabel.get("2026-09-01|9958").nomorAntrian === null);
    periksa("jam jadwal asli tersimpan", tabel.get("2026-09-01|9956").jamJadwal === "09:30:00");

    const sqlAntrian = kueriAntrian.map((k) => k.sql).join("\n");
    periksa("waktu diformat di SQL, bukan kolom mentah", /DATE_FORMAT\(a\.pihak_1/.test(sqlAntrian));
    periksa("jam_sidang dibaca sebagai teks", /CAST\(a\.jam_sidang AS CHAR\)/.test(sqlAntrian));
    periksa("hanya baris hari ini", /a\.tanggal_sidang = CURDATE\(\)/.test(sqlAntrian));
    periksa("tidak ada tulisan ke aplikasi antrian", !/\b(UPDATE|INSERT|DELETE|REPLACE)\b/i.test(sqlAntrian));

    const dua = await layanan.catatSekali({ paksa: true });
    periksa("putaran tanpa perubahan tidak menulis", dua.ok === true && dua.ditulis === 0);

    // Kios menulis ulang, lalu perkara dipanggil.
    antrian.sekarang = "2026-09-01 09:41:30";
    antrian.baris[0] = barisAntrian({
      perkaraId: 9971,
      pihak1: "2026-09-01 09:00:00",
      disidang: 1,
      jamSidang: "09:41:19",
    });
    const tiga = await layanan.catatSekali({ paksa: true });
    const tersimpan = tabel.get("2026-09-01|9971");
    // Yang berubah ditulis; dua lainnya ikut ditulis HANYA karena sudah lebih
    // dari lima menit sejak terlihat_terakhir-nya - isinya tidak berubah.
    periksa("yang diam disegarkan terlihat_terakhir-nya sesudah lima menit", tiga.ditulis === 3);
    periksa(
      "dan isinya tidak berubah karena penyegaran itu",
      tabel.get("2026-09-01|9956").ambilPihak2 === "2026-09-01 08:14:05" &&
        tabel.get("2026-09-01|9956").jamJadwal === "09:30:00" &&
        tabel.get("2026-09-01|9956").terlihatTerakhir === "2026-09-01 09:41:30"
    );
    antrian.sekarang = "2026-09-01 09:43:00";
    const empat = await layanan.catatSekali({ paksa: true });
    periksa("dua menit kemudian tanpa perubahan: tidak menulis", empat.ditulis === 0);
    periksa("ambil pihak 1 tersimpan TETAP yang pertama", tersimpan.ambilPihak1 === "2026-09-01 08:12:40");
    periksa("jam jadwal tersimpan tetap 09:00:00", tersimpan.jamJadwal === "09:00:00");
    periksa("panggilan pertama tersimpan", tersimpan.panggilPertama === "2026-09-01 09:41:19");
    periksa("terlihat pertama tidak bergeser", tersimpan.terlihatPertama === "2026-09-01 08:15:00");

    antrian.sekarang = "2026-09-01 10:05:10";
    antrian.baris[0] = { ...antrian.baris[0], jamSidang: "10:05:02" };
    await layanan.catatSekali({ paksa: true });
    const ulang = tabel.get("2026-09-01|9971");
    periksa("dipanggil ulang: pertama tetap tersimpan", ulang.panggilPertama === "2026-09-01 09:41:19");
    periksa("dipanggil ulang: terakhir tersimpan", ulang.panggilTerakhir === "2026-09-01 10:05:02");
    periksa("dipanggil ulang: hitungan 2", ulang.jumlahPanggil === 2);
  }

  // ==========================================================================
  console.log("\n== Gagal tanpa menjatuhkan bot, tanpa membanjiri log ==");
  {
    bersihkan();
    antrian.lemparJam = "ER_BAD_DB_ERROR: Unknown database 'sipp_turunan_antrian'";
    const hasil = [];
    for (let i = 0; i < 5; i += 1) hasil.push(await layanan.catatSekali({ paksa: true }));
    periksa("tiap putaran dijawab gagal, tidak melempar", hasil.every((h) => h.ok === false));
    periksa("sebabnya disebutkan", /Unknown database/.test(hasil[0].alasan || ""));
    const gagalLog = catatanLog.filter((x) => x.eventType === "antrian_waktu_gagal");
    periksa("lima kegagalan sama = SATU catatan log", gagalLog.length === 1);
    periksa("keadaannya terbaca", layanan.status().galatBeruntun === 5);

    antrian.lemparJam = "Lost connection";
    await layanan.catatSekali({ paksa: true });
    periksa(
      "pesan galat yang berbeda dicatat lagi",
      catatanLog.filter((x) => x.eventType === "antrian_waktu_gagal").length === 2
    );

    antrian.lemparJam = "";
    antrian.baris = [barisAntrian({ pihak1: "2026-09-01 08:12:40" })];
    const pulih = await layanan.catatSekali({ paksa: true });
    periksa("pulih sesudahnya", pulih.ok === true && pulih.ditulis === 1);
    periksa("pemulihan dicatat sekali", catatanLog.filter((x) => x.eventType === "antrian_waktu_pulih").length === 1);
    periksa("hitungan galat kembali nol", layanan.status().galatBeruntun === 0);

    bersihkan();
    antrian.baris = [barisAntrian({ pihak1: "2026-09-01 08:12:40" })];
    lemparBot = "ER_ACCESS_DENIED";
    const botGagal = await layanan.catatSekali({ paksa: true });
    periksa("basis data ALETA gagal: dijawab gagal, tidak melempar", botGagal.ok === false);
    lemparBot = "";
  }

  // ==========================================================================
  console.log("\n== Tidak tumpang tindih ==");
  {
    bersihkan();
    antrian.baris = [barisAntrian({ pihak1: "2026-09-01 08:12:40" })];
    const [a, b] = await Promise.all([layanan.catatSekali({ paksa: true }), layanan.catatSekali({ paksa: true })]);
    const sibuk = [a, b].filter((x) => x.alasan === "sedang_berjalan");
    periksa("putaran kedua yang bertabrakan ditolak", sibuk.length === 1);
    periksa("dan yang pertama tetap selesai", [a, b].some((x) => x.ok === true && x.ditulis === 1));
  }

  // ==========================================================================
  console.log("\n== Pembaca untuk jadwal sidang ==");
  {
    bersihkan();
    // Rekaman hari LAMPAU - dan aplikasi antrian yang sudah tidak menyimpannya.
    tabel.set("2026-08-31|500", {
      tanggalSidang: "2026-08-31",
      perkaraId: "500",
      nomorAntrian: 4,
      noRuang: 1,
      ruanganId: 1,
      majelisKode: "",
      online: null,
      namaPetugas: "IWAN",
      ambilPihak1: "2026-08-31 08:01:00",
      ambilPihak2: "",
      ambilSaksi: "",
      ambilTerawal: "2026-08-31 08:01:00",
      jamJadwal: "09:00:00",
      panggilPertama: "2026-08-31 09:10:00",
      panggilTerakhir: "2026-08-31 09:10:00",
      jumlahPanggil: 1,
      terlihatPertama: "2026-08-31 08:01:30",
      terlihatTerakhir: "2026-08-31 11:00:00",
    });
    const lampau = await layanan.waktuUntukJadwal({ tanggal: ["2026-08-31"] });
    periksa("hari lampau terbaca dari rekaman", lampau.terbaca && lampau.rekamanTerbaca);
    periksa("barisnya sampai", lampau.baris.length === 1 && lampau.baris[0].sumber === "rekaman");
    periksa("waktu panggil berdetik ikut", lampau.baris[0].panggilTerakhir === "2026-08-31 09:10:00");
    periksa("rekaman saja: disidang TIDAK dikirim (keadaannya tidak diketahui)", !("disidang" in lampau.baris[0]));
    periksa("jam antrian ikut dikirim", lampau.sekarang === "2026-09-01 08:00:00" && lampau.hariIni === "2026-09-01");
    periksa(
      "hari lampau tidak membaca baris aplikasi antrian",
      !kueriAntrian.some((k) => /FROM sipp_turunan_antrian\.antrian_sidang/.test(k.sql))
    );

    // Hari ini: rekaman menyimpan panggilan pertama yang sudah TERTIMPA di
    // aplikasi antrian; pembacaan langsung membawa panggilan terbaru.
    bersihkan();
    antrian.sekarang = "2026-09-01 10:06:00";
    tabel.set("2026-09-01|9971", {
      tanggalSidang: "2026-09-01",
      perkaraId: "9971",
      nomorAntrian: 1,
      noRuang: 1,
      ruanganId: 1,
      majelisKode: "",
      online: null,
      namaPetugas: "RAHMA",
      ambilPihak1: "2026-09-01 08:12:40",
      ambilPihak2: "",
      ambilSaksi: "",
      ambilTerawal: "2026-09-01 08:12:40",
      jamJadwal: "09:00:00",
      panggilPertama: "2026-09-01 09:41:19",
      panggilTerakhir: "2026-09-01 09:41:19",
      jumlahPanggil: 1,
      terlihatPertama: "2026-09-01 08:15:00",
      terlihatTerakhir: "2026-09-01 09:45:00",
    });
    antrian.baris = [
      barisAntrian({ perkaraId: 9971, pihak1: "2026-09-01 08:12:40", disidang: 1, jamSidang: "10:05:02" }),
      // Perkara yang TIDAK ada di daftar SIPP yang diminta - tetap dikirim.
      barisAntrian({ perkaraId: 7777, noRuang: 1, pihak1: "2026-09-01 08:30:00", disidang: 1, jamSidang: "09:50:00" }),
    ];
    const kini = await layanan.waktuUntukJadwal({
      tanggal: ["2026-09-01", "2026-09-01", "bukan-tanggal"],
      petaNomor: { 9971: { nomor: 1, tanggalSidang: "2026-09-01" }, 7777: { nomor: 5, tanggalSidang: "2026-09-01" } },
    });
    const b9971 = kini.baris.find((x) => x.perkaraId === "9971");
    const b7777 = kini.baris.find((x) => x.perkaraId === "7777");
    periksa("hari ini: rekaman dan langsung disatukan", b9971 && b9971.sumber === "gabungan");
    periksa("panggilan pertama dari rekaman tetap", b9971 && b9971.panggilPertama === "2026-09-01 09:41:19");
    periksa("panggilan terakhir dari aplikasi antrian", b9971 && b9971.panggilTerakhir === "2026-09-01 10:05:02");
    periksa("hitungannya dua", b9971 && b9971.jumlahPanggil === 2);
    periksa("perkara di luar daftar tetap dikirim", b7777 && b7777.sumber === "langsung" && b7777.nomorAntrian === 5);
    periksa("pembaca TIDAK menulis", !kueriBot.some((k) => /INSERT INTO/.test(k.sql)));
    // Keadaan langsung disidang ikut dikirim (portal: 1..9 = sedang berjalan).
    periksa("disidang langsung ikut dikirim untuk baris hari ini", b9971 && b9971.disidang === 1);

    // Aplikasi antrian putus: rekaman tetap sampai, sebabnya disebut.
    bersihkan();
    tabel.set("2026-08-31|500", { tanggalSidang: "2026-08-31", perkaraId: "500", panggilTerakhir: "2026-08-31 09:10:00" });
    antrian.lemparJam = "connect ETIMEDOUT";
    const putus = await layanan.waktuUntukJadwal({ tanggal: ["2026-08-31"] });
    periksa("antrian putus: rekaman tetap terbaca", putus.terbaca === true && putus.rekamanTerbaca === true);
    periksa("antrian putus: disebut", putus.langsungTerbaca === false && /ETIMEDOUT/.test(putus.alasan));
    periksa("antrian putus: jam tidak dikarang", putus.sekarang === "" && putus.hariIni === "");

    // Basis data ALETA gagal: hari ini tetap terbaca langsung.
    bersihkan();
    lemparBot = "ER_NO_SUCH_TABLE";
    antrian.baris = [barisAntrian({ pihak1: "2026-09-01 08:12:40" })];
    const botPutus = await layanan.waktuUntukJadwal({ tanggal: ["2026-09-01"] });
    periksa("rekaman gagal: langsung tetap terbaca", botPutus.terbaca === true && botPutus.rekamanTerbaca === false);
    periksa("rekaman gagal: barisnya tetap ada", botPutus.baris.length === 1);
    lemparBot = "";
  }

  // ==========================================================================
  console.log("\n== Rute jadwal sidang membawa waktu seluruh perkara hari itu ==");
  {
    bersihkan();
    antrian.sekarang = "2026-09-01 10:06:00";
    antrian.baris = [
      barisAntrian({ perkaraId: 9971, pihak1: "2026-09-01 08:12:40", disidang: 1, jamSidang: "10:05:02" }),
      barisAntrian({ perkaraId: 7777, pihak1: "2026-09-01 08:30:00", disidang: 1, jamSidang: "09:50:00" }),
      barisAntrian({ perkaraId: 9956, pihak2: "2026-09-01 08:14:05" }),
    ];
    petaNomor.peta = {
      9971: { nomor: 1, tanggalSidang: "2026-09-01" },
      7777: { nomor: 2, tanggalSidang: "2026-09-01" },
      9956: { nomor: 3, tanggalSidang: "2026-09-01" },
    };

    tiru("sippJadwalSidangService.js", {
      daftarSidang: async () => ({
        dari: "2026-09-01",
        sampai: "2026-09-01",
        diperiksaPada: "",
        sidang: [
          { perkaraId: "9971", sidangId: "1", nomorPerkara: "1/Pdt.G/2026/PA.Dgl", tanggalSidang: "2026-09-01" },
          { perkaraId: "9956", sidangId: "2", nomorPerkara: "2/Pdt.G/2026/PA.Dgl", tanggalSidang: "2026-09-01" },
        ],
      }),
    });

    const express = require("express");
    const router = require(path.resolve(__dirname, "..", "routes", "internalGatewayRoutes.js"));
    const app = express();
    app.use(express.json());
    app.use("/internal/aleta-bot", router);
    const server = await new Promise((resolve) => {
      const s = app.listen(0, () => resolve(s));
    });
    const port = server.address().port;
    const ambil = (jalur) =>
      new Promise((resolve, reject) => {
        http
          .get(
            {
              host: "127.0.0.1",
              port,
              path: jalur,
              headers: { "x-aleta-internal-token": process.env.ALETA_BOT_INTERNAL_API_TOKEN },
            },
            (res) => {
              let isi = "";
              res.on("data", (c) => (isi += c));
              res.on("end", () => {
                try {
                  resolve({ status: res.statusCode, data: JSON.parse(isi) });
                } catch (galat) {
                  reject(galat);
                }
              });
            }
          )
          .on("error", reject);
      });

    try {
      // ====================================================================
      // TANPA ?waktu=1: bentuk jawaban dan bebannya SAMA dengan sebelum 2.39
      // ====================================================================
      //
      // Temuan penelaah 27 September 2026: rute publik yang dipanggil
      // berulang (antrian-publik, antrian-tampil, sidang-ruang) ikut
      // menanggung tiga kueri waktu antrian yang hasilnya dibuang.
      kueriAntrian.length = 0;
      kueriBot.length = 0;
      const petaPolos = petaNomorDibaca;
      const polos = await ambil("/internal/aleta-bot/sipp/jadwal-sidang?dari=2026-09-01&sampai=2026-09-01");
      periksa("tanpa waktu=1: rute tetap menjawab 200", polos.status === 200 && polos.data.ok === true);
      periksa("tanpa waktu=1: TIDAK ada kunci waktuAntrian", !("waktuAntrian" in polos.data));
      periksa(
        "tanpa waktu=1: antrian tetap disaring seperti biasa",
        Object.keys(polos.data.antrian.peta).sort().join(",") === "9956,9971"
      );
      periksa("tanpa waktu=1: peta antrian dibaca sekali saja", petaNomorDibaca - petaPolos === 1);
      periksa(
        "tanpa waktu=1: tidak ada kueri jam maupun baris waktu ke aplikasi antrian",
        !kueriAntrian.some((k) => /AS sekarang|DATE_FORMAT\(a\.pihak_1/.test(k.sql))
      );
      periksa("tanpa waktu=1: basis data ALETA tidak disentuh sama sekali", kueriBot.length === 0);

      const petaSebelum = petaNomorDibaca;
      const jawab = await ambil("/internal/aleta-bot/sipp/jadwal-sidang?dari=2026-09-01&sampai=2026-09-01&waktu=1");
      periksa("rute menjawab 200", jawab.status === 200 && jawab.data.ok === true);
      periksa("peta antrian dibaca SEKALI", petaNomorDibaca - petaSebelum === 1);
      periksa(
        "peta antrian untuk layar tetap disaring ke perkara yang tampil",
        Object.keys(jawab.data.antrian.peta).sort().join(",") === "9956,9971"
      );
      const w = jawab.data.waktuAntrian || {};
      periksa("waktuAntrian ikut terkirim", w.terbaca === true && w.hariIni === "2026-09-01");
      periksa("sekarang menurut jam antrian", w.sekarang === "2026-09-01 10:06:00");
      periksa(
        "waktu SELURUH perkara hari itu, termasuk yang tidak tampil",
        (w.baris || []).map((x) => x.perkaraId).sort().join(",") === "7777,9956,9971"
      );
      const tetangga = (w.baris || []).find((x) => x.perkaraId === "7777");
      periksa("nomor perkara yang tidak tampil ikut dari peta penuh", tetangga && tetangga.nomorAntrian === 2);

      const keadaan = await ambil("/internal/aleta-bot/antrian/waktu/status");
      periksa("status pencatat terbaca", keadaan.status === 200 && typeof keadaan.data.galatBeruntun === "number");
    } finally {
      server.close();
    }
  }

  console.log("");
  console.log(`Lulus: ${lulus}, Gagal: ${gagal}`);
  if (gagal > 0) {
    console.log("ADA PERIKSAAN YANG GAGAL.");
    process.exit(1);
  }
  console.log("SEMUA PERIKSAAN LULUS.");
  process.exit(0);
}

utama().catch((galat) => {
  console.error(galat);
  process.exit(1);
});
