"use strict";

/**
 * Menguji pemanggilan antrian dari ALETA.
 *
 * ============================================================================
 * YANG DIJAGA PALING KERAS
 * ============================================================================
 *
 *   - Aplikasi antrian ditulis LEBIH DULU. Bila ia gagal, panggilannya memang
 *     tidak terjadi - layar ruang tunggu tidak berubah dan tidak ada yang
 *     mendengar apa pun. Mencatat riwayat lebih dulu akan menghasilkan
 *     hitungan "sudah dipanggil dua kali" atas panggilan yang tidak pernah
 *     terdengar siapa pun, dan hitungan itulah yang dipakai memutuskan
 *     penundaan perkara.
 *
 *   - Hanya disidang = 10 yang ditulis. Nilai lain artinya tidak diketahui,
 *     dan menebak arti sebuah kode di aplikasi orang lain adalah cara
 *     tercepat merusaknya.
 *
 *   - Hitungan panggilan bertambah satu tiap kali, dan batas tiga kali
 *     ditandai - itulah aturan yang sudah dijanjikan ALETA kepada para pihak
 *     lewat pesan WhatsApp.
 */

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

// --- tiruan basis data ALETA -------------------------------------------------
const baris = [];
const botDbPath = require.resolve("../services/botDbService");
const botDbAsli = require("../services/botDbService");
require.cache[botDbPath].exports = {
  ensureSchema: async () => true,
  addColumnIfMissing: async () => true,
  addIndexIfMissing: async () => true,
  toMysqlDate: botDbAsli.toMysqlDate,
  fromMysqlDate: botDbAsli.fromMysqlDate,
  query: async (sql, params = []) => {
    if (/^\s*CREATE TABLE/i.test(sql)) return [];
    if (/INSERT INTO aleta_bot_antrian_panggilan/i.test(sql)) {
      baris.push({
        perkara_id: params[1],
        tanggal: params[3],
        nomor_antrian: params[4],
        urutan: params[5],
        no_ruang: params[6],
        dipanggil_pada: params[7],
        oleh: params[8],
      });
      return { affectedRows: 1 };
    }
    if (/FROM aleta_bot_antrian_panggilan/i.test(sql)) {
      return baris
        .filter((b) => b.tanggal === params[0])
        .sort((a, b) => a.urutan - b.urutan)
        .map((b) => ({
          perkaraId: b.perkara_id,
          urutan: b.urutan,
          dipanggilPada: b.dipanggil_pada,
          oleh: b.oleh,
        }));
    }
    return [];
  },
};

// --- tiruan aplikasi antrian -------------------------------------------------
const kueri = [];
let gagalkanAntrian = "";

/**
 * Berapa baris yang dikenai UPDATE ke aplikasi antrian.
 *
 * Nol berarti perkaranya tidak punya baris antrian bertanggal hari ini -
 * dan itu BUKAN galat menurut MySQL: pernyataannya berhasil, hanya saja
 * atas nol baris.
 */
let barisAntrianTerpengaruh = 1;
const externalPath = require.resolve("../services/externalDbService");
require("../services/externalDbService");
require.cache[externalPath].exports = {
  sanitizeError: (e) => String((e && e.message) || e),
  query: async (kunci, sql, params = []) => {
    kueri.push({ sql, params });
    if (gagalkanAntrian) throw new Error(gagalkanAntrian);
    return { affectedRows: barisAntrianTerpengaruh };
  },
};

const logPath = require.resolve("../services/logService");
require("../services/logService");
require.cache[logPath].exports = {
  logSystemEvent: async () => true,
  logSecurityEvent: async () => true,
};

const layanan = require("../services/panggilanAntrianService");

function bersihkan() {
  barisAntrianTerpengaruh = 1;
  baris.length = 0;
  kueri.length = 0;
  gagalkanAntrian = "";
}

async function utama() {
  console.log("");
  console.log("Uji pemanggilan antrian dari ALETA");
  console.log("");

  // ==========================================================================
  console.log("== Memanggil menulis penanda yang sama dengan mesin antrian ==");
  {
    bersihkan();
    const hasil = await layanan.panggil({
      perkaraId: "9971",
      nomorPerkara: "1/Pdt.G/2026/PA.Dgl",
      nomorAntrian: 7,
      noRuang: 2,
      oleh: "PETUGAS",
    });

    periksa("berhasil", hasil.ok === true);
    periksa("panggilan pertama", hasil.urutan === 1);
    periksa("belum mencapai batas", hasil.sudahBatas === false);

    const perintah = kueri[0].sql;
    periksa("menulis disidang", /SET disidang = \?/.test(perintah));
    periksa("dan jam panggil", /jam_sidang = NOW\(\)/.test(perintah));
    periksa("nilainya 10, bukan tebakan lain", kueri[0].params[0] === 10);
    periksa("disaring per perkara", /WHERE perkara_id = \?/.test(perintah));

    // Kolom milik pengambilan tidak boleh ikut tersentuh saat memanggil.
    periksa("tidak menyentuh pihak_1", !/pihak_1/.test(perintah));
    periksa("tidak menyentuh pihak_2", !/pihak_2/.test(perintah));
    periksa("tidak ada DELETE", !/\bDELETE\b/i.test(perintah));
  }

  // ==========================================================================
  console.log("\n== Hitungan panggilan dan batas tiga kali ==");
  {
    bersihkan();
    const satu = await layanan.panggil({ perkaraId: "9971", oleh: "A" });
    const dua = await layanan.panggil({ perkaraId: "9971", oleh: "A" });
    const tiga = await layanan.panggil({ perkaraId: "9971", oleh: "B" });

    periksa("urutannya bertambah", satu.urutan === 1 && dua.urutan === 2 && tiga.urutan === 3);
    periksa("panggilan ketiga menandai batas", tiga.sudahBatas === true);
    periksa("keterangannya menyebut penundaan", /patut ditunda/.test(tiga.keterangan));
    periksa("sebelum batas tidak menakut-nakuti", /Panggilan ke-1 dari 3/.test(satu.keterangan));

    const riwayat = await layanan.riwayatPanggilan(["9971"]);
    periksa("riwayatnya tiga baris", riwayat["9971"].jumlah === 3);
    periksa("siapa yang memanggil tercatat", riwayat["9971"].panggilan[2].oleh === "B");
    periksa("penanda batas ikut dilaporkan", riwayat["9971"].sudahBatas === true);

    // Perkara lain tidak ikut terhitung.
    const lain = await layanan.panggil({ perkaraId: "9956", oleh: "A" });
    periksa("hitungan perkara lain mulai dari satu", lain.urutan === 1);
  }

  // ==========================================================================
  console.log("\n== Aplikasi antrian gagal: panggilannya TIDAK dianggap terjadi ==");
  {
    bersihkan();
    gagalkanAntrian = "Lost connection";
    const hasil = await layanan.panggil({ perkaraId: "9971", oleh: "A" });

    periksa("dijawab gagal", hasil.ok === false);
    periksa("sebabnya disebutkan", /Lost connection/.test(hasil.alasan));
    // Inilah yang paling penting: riwayat TIDAK bertambah. Hitungan panggilan
    // dipakai memutuskan penundaan perkara, dan menambahkannya atas panggilan
    // yang tidak pernah terdengar berarti menunda perkara orang tanpa dasar.
    periksa("riwayat tidak bertambah", baris.length === 0);

    gagalkanAntrian = "";
    const lagi = await layanan.panggil({ perkaraId: "9971", oleh: "A" });
    periksa("sesudah pulih, hitungannya tetap mulai dari satu", lagi.urutan === 1);
  }

  // ==========================================================================
  console.log("\n== Tidak ada baris antrian hari ini: bukan panggilan ==");
  {
    bersihkan();
    // Tabel antrian menyimpan satu baris untuk tiap tanggal sidang dan tidak
    // dibersihkan saat berganti hari. Perkara yang tidak disidangkan hari ini
    // karena itu tidak punya baris hari ini - UPDATE-nya berhasil atas nol
    // baris, layar ruang tunggu tidak berubah, dan tidak ada yang mendengar
    // apa pun.
    barisAntrianTerpengaruh = 0;

    const hasil = await layanan.panggil({ perkaraId: "9971", oleh: "A" });
    periksa("dijawab gagal", hasil.ok === false);
    periksa("sebabnya menyebut antrian hari ini", /hari ini/.test(hasil.alasan || ""));
    periksa("riwayat tidak bertambah", baris.length === 0);

    // Dan sesudah perkaranya terdaftar, hitungannya tetap mulai dari satu.
    barisAntrianTerpengaruh = 1;
    const lagi = await layanan.panggil({ perkaraId: "9971", oleh: "A" });
    periksa("sesudah terdaftar, hitungannya mulai dari satu", lagi.urutan === 1);
  }

  // ==========================================================================
  console.log("\n== Masukan yang tidak masuk akal ditolak ==");
  {
    bersihkan();
    const kosong = await layanan.panggil({ perkaraId: "" });
    periksa("tanpa perkara ditolak", kosong.ok === false);
    periksa("dan tidak menyentuh apa pun", kueri.length === 0 && baris.length === 0);

    const kosongRiwayat = await layanan.riwayatPanggilan([]);
    periksa("riwayat tanpa perkara dijawab kosong", Object.keys(kosongRiwayat).length === 0);
  }

  console.log("");
  console.log(`Lulus: ${lulus}, Gagal: ${gagal}`);
  if (gagal > 0) {
    console.log("ADA PERIKSAAN YANG GAGAL.");
    process.exit(1);
  }
  console.log("SEMUA PERIKSAAN LULUS.");
}

utama().catch((galat) => {
  console.error(galat);
  process.exit(1);
});
