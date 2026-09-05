"use strict";

/**
 * Jadwal pertemuan mediasi.
 *
 * ============================================================================
 * MENJALANKAN KUERINYA, BUKAN MEMBACA TULISANNYA
 * ============================================================================
 *
 * db_config diganti tiruan sebelum layanannya dimuat, sehingga kueri yang
 * BENAR-BENAR ditembakkan dapat diperiksa - termasuk apa yang masuk sebagai
 * parameter dan apa yang menjadi teks kueri. Tidak ada database yang disentuh.
 */

const pathx = require("path");
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

// --- SIPP palsu -------------------------------------------------------------

const KOLOM = {
  perkara: ["perkara_id", "nomor_perkara", "jenis_perkara_nama"],
  perkara_mediasi: [
    "mediasi_id",
    "perkara_id",
    "mediator_text",
    "status_mediator",
    "jenis_mediasi",
    "penetapan_penunjukan_mediator",
    "tgl_laporan_mediator",
    "hasil_mediasi",
    "nomor_sk_penetapan_mediator",
  ],
  perkara_jadwal_mediasi: [
    "mediasi_id",
    "tanggal_mediasi",
    "jam_mediasi",
    "sampai_jam",
    "tempat",
    "dihadiri_oleh",
    "ditunda",
  ],
  v_pihak_perkara: ["perkara_id", "pihak_ke", "nama"],
  v_durasi_mediasi: ["perkara_id", "durasi_mediasi"],
};

const kueri = [];
let jawaban = {};

function cocokkan(sql) {
  const teks = String(sql);
  if (/information_schema/i.test(teks)) {
    const hasil = [];
    for (const [tabel, daftar] of Object.entries(KOLOM)) {
      for (const nama of daftar) hasil.push({ tabel, kolom: nama });
    }
    return hasil;
  }
  if (teks.includes("FROM perkara_jadwal_mediasi j")) return jawaban.mediasi || [];
  if (teks.includes("FROM v_pihak_perkara")) return jawaban.pihak || [];
  if (teks.includes("FROM v_durasi_mediasi")) return jawaban.durasi || [];
  return [];
}

const dbPath = require.resolve(pathx.resolve(__dirname, "..", "db_config.js"));
require.cache[dbPath] = new Module(dbPath, null);
require.cache[dbPath].filename = dbPath;
require.cache[dbPath].loaded = true;
require.cache[dbPath].exports = {
  query(sql, params, callback) {
    kueri.push({ sql: String(sql), params: params || [] });
    callback(null, cocokkan(sql));
  },
};

const layanan = require("../services/sippJadwalSidangService");
const skema = require("../services/sippSkemaService");

function bersihkan() {
  kueri.length = 0;
}

/** Tanggal hari ini, supaya ujinya tidak basi seiring waktu. */
function hariIni() {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
}

function geser(iso, n) {
  const [y, m, d] = iso.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
}

async function jalan() {
  skema.lupakan();

  console.log("\n== Jadwal mediasi satu hari ==");
  {
    bersihkan();
    jawaban = {
      mediasi: [
        {
          mediasiId: 77,
          perkaraId: 9215,
          nomorPerkara: "620/Pdt.G/2025/PA.Dgl",
          jenisPerkara: "Cerai Gugat",
          tanggal: "2025-11-04",
          jam: "09:00:00",
          sampai: "09:30:00",
          tempat: "Ruang mediasi Pengadilan Agama Donggala",
          hadir: "Kedua belah pihak",
          // T berarti TIDAK ditunda.
          ditunda: "T",
          mediator: "Abdul Salam, S.H.I., M.H.",
          statusMediator: "Hakim Mediator",
          jenisMediasi: "1",
          penetapanMediator: "2025-11-04",
          laporanMediator: "2025-12-02",
          hasil: "D",
          nomorSk: "459/Pdt.G/2026/PA.Dgl",
        },
        {
          mediasiId: 77,
          perkaraId: 9215,
          nomorPerkara: "620/Pdt.G/2025/PA.Dgl",
          jenisPerkara: "Cerai Gugat",
          tanggal: "2025-11-07",
          jam: "09:00:00",
          tempat: "Ruang mediasi",
          ditunda: "Y",
          mediator: "Abdul Salam, S.H.I., M.H.",
          penetapanMediator: "2025-11-04",
          laporanMediator: "2025-12-02",
        },
      ],
      pihak: [
        { perkaraId: 9215, pihakKe: 1, nama: "SULASTRI BINTI DJANGGOLA" },
        { perkaraId: 9215, pihakKe: 2, nama: "SRI ASTUTI NINGSIH" },
      ],
      durasi: [{ hari: 28 }],
    };

    const hasil = await layanan.daftarJadwalMediasi({ dari: "2025-11-01", sampai: "2025-11-30" });

    periksa("jadwal mediasi terbaca", hasil.terbaca === true);
    periksa("dua pertemuan terbaca", hasil.mediasi.length === 2);
    periksa("nomor perkara terbaca", hasil.mediasi[0].nomorPerkara === "620/Pdt.G/2025/PA.Dgl");
    periksa("mediator terbaca", hasil.mediasi[0].mediator === "Abdul Salam, S.H.I., M.H.");
    periksa("jam dipendekkan tanpa detik", hasil.mediasi[0].jam === "09:00");
    periksa("jam selesai terbaca", hasil.mediasi[0].sampaiJam === "09:30");
    periksa("tempat terbaca", /Ruang mediasi/.test(hasil.mediasi[0].tempat));
    periksa("kehadiran terbaca", hasil.mediasi[0].dihadiri === "Kedua belah pihak");
    periksa("nomor SK terbaca", hasil.mediasi[0].nomorSk === "459/Pdt.G/2026/PA.Dgl");

    // Sifat yang dijaga: Y berarti YA, T berarti TIDAK. Kekeliruan sebaliknya
    // membuat SETIAP pertemuan yang berjalan normal tertandai ditunda.
    periksa("pertemuan bertanda T tidak ditunda", hasil.mediasi[0].ditunda === false);
    periksa("pertemuan bertanda Y ditandai ditunda", hasil.mediasi[1].ditunda === true);

    // Hasil mediasi diterjemahkan dari kodenya, bukan ditampilkan mentah.
    periksa("kode hasil diterjemahkan", hasil.mediasi[0].hasilTeks.length > 1);
    periksa("kode aslinya tetap dibawa", hasil.mediasi[0].hasil === "D");

    periksa("para pihak ikut terbaca", hasil.mediasi[0].pihak.penggugat.length === 1);
    periksa("mediasi yang sudah dilaporkan ditandai selesai", hasil.mediasi[0].selesai === true);
  }

  console.log("\n== Tenggang PERMA 1/2016 Pasal 24 ==");
  {
    bersihkan();
    const kemarin = geser(hariIni(), -1);
    const penetapanLewat = geser(hariIni(), -40); // tenggatnya 10 hari lalu
    const penetapanBaru = geser(hariIni(), -5); // masih 25 hari lagi

    jawaban = {
      mediasi: [
        {
          mediasiId: 1,
          perkaraId: 1,
          nomorPerkara: "1/Pdt.G/2026/PA.Dgl",
          tanggal: kemarin,
          penetapanMediator: penetapanLewat,
          laporanMediator: null,
          ditunda: "T",
        },
        {
          mediasiId: 2,
          perkaraId: 2,
          nomorPerkara: "2/Pdt.G/2026/PA.Dgl",
          tanggal: kemarin,
          penetapanMediator: penetapanBaru,
          laporanMediator: null,
          ditunda: "T",
        },
        {
          // Sudah dilaporkan - berapa pun lamanya, tidak menuntut apa pun lagi.
          mediasiId: 3,
          perkaraId: 3,
          nomorPerkara: "3/Pdt.G/2026/PA.Dgl",
          tanggal: kemarin,
          penetapanMediator: penetapanLewat,
          laporanMediator: geser(hariIni(), -2),
          ditunda: "T",
        },
      ],
      pihak: [],
      durasi: [],
    };

    const hasil = await layanan.daftarJadwalMediasi({ dari: kemarin, sampai: kemarin });

    periksa(
      "tenggat dihitung 30 hari sejak penetapan mediator",
      hasil.mediasi[0].tenggatPerma === geser(penetapanLewat, 30)
    );
    periksa("lewat tenggang dikenali", hasil.mediasi[0].lewatTenggang === true);
    periksa("sisa hari bernilai negatif", hasil.mediasi[0].sisaHariTenggat < 0);

    periksa("yang masih dalam tenggang tidak ditandai", hasil.mediasi[1].lewatTenggang === false);
    periksa("sisa harinya positif", hasil.mediasi[1].sisaHariTenggat > 0);

    // Sifat yang dijaga: mediasi yang laporannya SUDAH masuk tidak lagi
    // menuntut apa pun. Menandainya lewat tenggang berarti menyalakan
    // peringatan atas pekerjaan yang sudah beres.
    periksa("mediasi yang sudah dilaporkan tidak lewat tenggang", hasil.mediasi[2].lewatTenggang === false);
    periksa("sisa hari tidak dihitung lagi", hasil.mediasi[2].sisaHariTenggat === null);
  }

  console.log("\n== Kunci dan penjagaan kueri ==");
  {
    bersihkan();
    jawaban = { mediasi: [], pihak: [], durasi: [] };
    await layanan.daftarJadwalMediasi({ dari: "2026-01-01", sampai: "2026-01-31", cari: "Cerai" });

    const k = kueri.find((x) => x.sql.includes("FROM perkara_jadwal_mediasi j"));
    periksa("kueri jadwal mediasi terbentuk", Boolean(k));

    // Sifat yang dijaga: kuncinya mediasi_id, BUKAN perkara_id. Salah kunci di
    // sini membuat seluruh bagian mediasi kosong, dan itu pernah terjadi.
    periksa(
      "disambung lewat mediasi_id",
      Boolean(k) && /m\.mediasi_id = j\.mediasi_id/.test(k.sql)
    );
    periksa(
      "perkaranya disambung lewat perkara_id mediasi",
      Boolean(k) && /JOIN perkara p ON p\.perkara_id = m\.perkara_id/.test(k.sql)
    );

    // Tanggal dan kata pencarian SELALU lewat parameter.
    periksa("tanggal masuk sebagai parameter", Boolean(k) && k.params.includes("2026-01-01"));
    periksa("kata pencarian masuk sebagai parameter", Boolean(k) && k.params.includes("%Cerai%"));
    periksa(
      "kata pencarian tidak pernah masuk teks kueri",
      Boolean(k) && !k.sql.includes("Cerai")
    );
  }

  console.log("\n== Tanggal cacat ditolak ==");
  {
    bersihkan();
    const jahat = "2026-01-01' OR '1'='1";
    const hasil = await layanan.daftarJadwalMediasi({ dari: jahat, sampai: jahat });

    periksa("tanggal cacat diganti hari ini", hasil.dari !== jahat);
    periksa(
      "teks jahat tidak pernah sampai ke kueri",
      kueri.every((x) => !x.sql.includes("OR '1'='1") && !JSON.stringify(x.params).includes("OR '1'='1"))
    );
  }

  console.log("\n== SIPP hanya dibaca ==");
  {
    bersihkan();
    jawaban = { mediasi: [], pihak: [], durasi: [] };
    await layanan.daftarJadwalMediasi({ dari: "2026-01-01" });

    periksa("seluruh kueri berupa SELECT", kueri.every((x) => /^\s*SELECT\b/i.test(x.sql)));
    periksa(
      "tidak ada INSERT, UPDATE, atau DELETE",
      kueri.every((x) => !/\b(INSERT|UPDATE|DELETE|DROP|ALTER)\b/i.test(x.sql))
    );
  }

  console.log(`\nHasil: ${lulus} lulus, ${gagal} gagal\n`);
  process.exit(gagal === 0 ? 0 : 1);
}

jalan().catch((galat) => {
  console.error("Gagal dijalankan:", galat);
  process.exit(1);
});
