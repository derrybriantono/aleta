"use strict";

/**
 * Menguji pendaftaran jadwal sidang ke aplikasi antrian.
 *
 * ============================================================================
 * INI SATU-SATUNYA TEMPAT ALETA MENULIS KE APLIKASI LAIN
 * ============================================================================
 *
 * Tabel yang ditulis milik aplikasi antrian yang dipakai mesin di ruang
 * tunggu. Baris yang keliru di sana bukan sekadar data yang salah - ia antrian
 * orang yang sedang menunggu dipanggil. Karena itu yang diuji paling keras
 * bukan kemampuannya menulis, melainkan sikapnya MENAHAN DIRI:
 *
 *   - uji kering adalah perilaku bawaan,
 *   - tidak pernah ada UPDATE maupun DELETE,
 *   - kolom milik mesin antrian tidak pernah disentuh,
 *   - kolom wajib yang tidak dikenal menghentikan seluruhnya, bukan dicoba,
 *   - perkara yang sudah terdaftar tidak didaftarkan dua kali.
 */

const pathx = require("path");
const fs = require("fs");

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

// --- Tiruan basis data aplikasi antrian --------------------------------------
const kueri = [];
let kolomTabel = [
  { Field: "id", Null: "NO", Default: null, Extra: "auto_increment" },
  { Field: "perkara_id", Null: "NO", Default: null, Extra: "" },
  { Field: "tanggal_sidang", Null: "YES", Default: null, Extra: "" },
  { Field: "jam_sidang", Null: "YES", Default: null, Extra: "" },
  { Field: "majelis_hakim_kode", Null: "YES", Default: null, Extra: "" },
  { Field: "ruangan_id", Null: "YES", Default: null, Extra: "" },
  { Field: "no_ruang", Null: "YES", Default: null, Extra: "" },
  { Field: "nama_petugas", Null: "YES", Default: null, Extra: "" },
  { Field: "online", Null: "NO", Default: "0", Extra: "" },
  { Field: "pihak_1", Null: "YES", Default: null, Extra: "" },
  { Field: "pihak_2", Null: "YES", Default: null, Extra: "" },
  { Field: "saksi", Null: "YES", Default: null, Extra: "" },
  { Field: "disidang", Null: "YES", Default: null, Extra: "" },
];
let barisTerdaftar = [];
let gagalkanInsert = "";

const externalPath = require.resolve("../services/externalDbService");
require("../services/externalDbService");
require.cache[externalPath].exports = {
  sanitizeError: (e) => String((e && e.message) || e),
  query: async (kunci, sql, params = []) => {
    kueri.push({ kunci, sql, params });
    if (/^\s*SHOW COLUMNS/i.test(sql)) return kolomTabel;
    if (/^\s*SELECT/i.test(sql)) return barisTerdaftar.map((x) => ({ perkaraId: x.perkara_id }));
    if (/^\s*INSERT/i.test(sql)) {
      if (gagalkanInsert) throw new Error(gagalkanInsert);
      barisTerdaftar.push({ perkara_id: String(params[0]) });
      return { affectedRows: 1 };
    }
    return [];
  },
};

const logPath = require.resolve("../services/logService");
require("../services/logService");
const jejak = [];
require.cache[logPath].exports = {
  logSecurityEvent: async (e) => {
    jejak.push(e);
    return true;
  },
  logSystemEvent: async () => true,
};

const layanan = require("../services/antrianSinkronService");

const JADWAL = [
  { sidangId: "50001", perkaraId: "9971", nomorPerkara: "1/Pdt.G/2026/PA.Dgl", tanggalSidang: "2026-09-05", jamSidang: "09:00", majelisKode: "B", ruanganId: 1, noRuang: 1 },
  { sidangId: "50002", perkaraId: "9956", nomorPerkara: "2/Pdt.G/2026/PA.Dgl", tanggalSidang: "2026-09-05", jamSidang: "09:30", majelisKode: "B", ruanganId: 1, noRuang: 1 },
  { sidangId: "50003", perkaraId: "9969", nomorPerkara: "3/Pdt.G/2026/PA.Dgl", tanggalSidang: "2026-09-05", jamSidang: "10:00", majelisKode: "C1", ruanganId: 2, noRuang: 2 },
];

function bersihkan() {
  kueri.length = 0;
  jejak.length = 0;
  barisTerdaftar = [];
  gagalkanInsert = "";
}

async function utama() {
  console.log("");
  console.log("Uji sinkronisasi jadwal ke aplikasi antrian");
  console.log("");

  // ==========================================================================
  console.log("== Uji kering adalah perilaku bawaan ==");
  {
    bersihkan();
    const hasil = await layanan.sinkronkan({ tanggal: "2026-09-05", sidang: JADWAL });
    periksa("tanpa terapkan -> uji kering", hasil.ujiKering === true);
    periksa("tidak ada satu pun INSERT", kueri.every((q) => !/^\s*INSERT/i.test(q.sql)));
    periksa("tetap melaporkan apa yang akan ditambah", hasil.akanDitambah.length === 3);
    periksa("belum ada yang tercatat ditambahkan", hasil.ditambahkan === 0);
    periksa("tidak menulis jejak keamanan pada uji kering", jejak.length === 0);
  }

  // ==========================================================================
  console.log("\n== Menambah, dan hanya menambah ==");
  {
    bersihkan();
    const hasil = await layanan.sinkronkan({
      tanggal: "2026-09-05",
      sidang: JADWAL,
      terapkan: true,
      olehSiapa: "PETUGAS",
    });
    periksa("tiga baris ditambahkan", hasil.ditambahkan === 3);
    periksa("tidak ada UPDATE", kueri.every((q) => !/^\s*UPDATE/i.test(q.sql)));
    periksa("tidak ada DELETE", kueri.every((q) => !/\bDELETE\b/i.test(q.sql)));
    periksa("tidak ada TRUNCATE maupun DROP", kueri.every((q) => !/\b(TRUNCATE|DROP|ALTER)\b/i.test(q.sql)));

    // Kolom milik mesin antrian TIDAK boleh ikut ditulis. Nomor antrian lahir
    // dari pengambilan, bukan dari pendaftaran - menuliskannya berarti
    // menggeser nomor orang yang sudah memegangnya.
    const insert = kueri.find((q) => /^\s*INSERT/i.test(q.sql));
    periksa("pihak_1 tidak ditulis", !/pihak_1/.test(insert.sql));
    periksa("pihak_2 tidak ditulis", !/pihak_2/.test(insert.sql));
    periksa("saksi tidak ditulis", !/\bsaksi\b/.test(insert.sql));
    periksa("disidang tidak ditulis", !/disidang/.test(insert.sql));

    // Kolom id WAJIB ikut ditulis. Ia NOT NULL dan tidak berpenomoran
    // otomatis di tabel antrian, sehingga tanpa ia disebut, pemeriksa
    // struktur menggolongkannya kolom wajib tak dikenal lalu menolak
    // seluruh sinkronisasi - dan fiturnya tidak pernah dapat dijalankan
    // sekali pun. Nilainya id baris jadwal SIPP, sama seperti yang ditulis
    // mesin antrian sendiri.
    const kolomInsert = String(insert.sql).split("VALUES")[0];
    periksa("kolom id ikut ditulis", /\(\s*id\s*,/.test(kolomInsert));
    periksa(
      "nilainya diambil dari id jadwal SIPP",
      Array.isArray(insert.params) && insert.params.map(String).includes("50001")
    );

    periksa("nilainya lewat parameter, bukan disambung ke teks", /VALUES \(\?(, \?)*\)/.test(insert.sql));
    periksa("penulisan dicatat sebagai peristiwa keamanan", jejak.length === 1);
    periksa("jejaknya menyebut siapa yang menjalankan", jejak[0].metadata.olehSiapa === "PETUGAS");
  }

  // ==========================================================================
  console.log("\n== Yang sudah terdaftar tidak didaftarkan dua kali ==");
  {
    bersihkan();
    barisTerdaftar = [{ perkara_id: "9971" }, { perkara_id: "9956" }];
    const hasil = await layanan.sinkronkan({ tanggal: "2026-09-05", sidang: JADWAL, terapkan: true });
    periksa("hanya yang belum ada yang ditambahkan", hasil.ditambahkan === 1);
    periksa("yang sudah ada dilaporkan dilewati", hasil.dilewati.length === 2);
    periksa("sebabnya disebutkan", /sudah terdaftar/.test(hasil.dilewati[0].sebab));
  }

  // ==========================================================================
  console.log("\n== Satu perkara satu antrian, walau jadwalnya dua baris ==");
  {
    bersihkan();
    const ganda = [...JADWAL, { ...JADWAL[0], jamSidang: "13:00" }];
    const hasil = await layanan.sinkronkan({ tanggal: "2026-09-05", sidang: ganda });
    periksa("baris kedua perkara yang sama tidak ditambah", hasil.akanDitambah.length === 3);
  }

  // ==========================================================================
  console.log("\n== Kolom wajib yang tidak dikenal MENGHENTIKAN semuanya ==");
  {
    bersihkan();
    kolomTabel = [
      ...kolomTabel,
      { Field: "kode_booking", Null: "NO", Default: null, Extra: "" },
    ];
    const hasil = await layanan.sinkronkan({ tanggal: "2026-09-05", sidang: JADWAL, terapkan: true });
    periksa("ditolak, bukan dicoba", hasil.ok === false);
    periksa("kolomnya disebutkan namanya", /kode_booking/.test(hasil.alasan));
    periksa("tidak ada satu pun INSERT", kueri.every((q) => !/^\s*INSERT/i.test(q.sql)));

    // Kolom wajib yang PUNYA nilai bawaan bukan halangan.
    kolomTabel = kolomTabel.filter((k) => k.Field !== "kode_booking");
    kolomTabel.push({ Field: "kode_booking", Null: "NO", Default: "0", Extra: "" });
    const lagi = await layanan.sinkronkan({ tanggal: "2026-09-05", sidang: JADWAL });
    periksa("kolom wajib bernilai bawaan tidak menghalangi", lagi.ok === true);
    kolomTabel = kolomTabel.filter((k) => k.Field !== "kode_booking");
  }

  // ==========================================================================
  console.log("\n== Kolom yang tidak ada di tabel tidak ditulis ==");
  {
    bersihkan();
    const tanpaPetugas = kolomTabel.filter((k) => k.Field !== "nama_petugas");
    const simpan = kolomTabel;
    kolomTabel = tanpaPetugas;
    await layanan.sinkronkan({ tanggal: "2026-09-05", sidang: JADWAL, terapkan: true });
    const insert = kueri.find((q) => /^\s*INSERT/i.test(q.sql));
    periksa("nama_petugas dilewati karena tabelnya tidak punya", !/nama_petugas/.test(insert.sql));
    periksa("kolom lain tetap ditulis", /perkara_id/.test(insert.sql));
    kolomTabel = simpan;
  }

  // ==========================================================================
  console.log("\n== Kegagalan satu baris tidak menelan sisanya ==");
  {
    bersihkan();
    gagalkanInsert = "Duplicate entry";
    const hasil = await layanan.sinkronkan({ tanggal: "2026-09-05", sidang: JADWAL, terapkan: true });
    periksa("tidak ada yang berhasil", hasil.ditambahkan === 0);
    periksa("ketiganya dilaporkan gagal", hasil.gagal.length === 3);
    periksa("sebab kegagalannya disebutkan", /Duplicate entry/.test(hasil.gagal[0].sebab));
    periksa("tetap dijawab ok agar sisanya terbaca", hasil.ok === true);
  }

  // ==========================================================================
  console.log("\n== Masukan yang tidak masuk akal ditolak ==");
  {
    bersihkan();
    const tanpaTanggal = await layanan.sinkronkan({ tanggal: "", sidang: JADWAL, terapkan: true });
    periksa("tanpa tanggal ditolak", tanpaTanggal.ok === false);
    periksa("dan tidak menyentuh basis data", kueri.length === 0);

    const tanpaPerkara = layanan.susunTambahan({
      tanggal: "2026-09-05",
      sidang: [{ nomorPerkara: "1/Pdt.G", tanggalSidang: "2026-09-05" }],
    });
    periksa("baris tanpa perkara_id dilewati", tanpaPerkara.akanDitambah.length === 0);
    periksa("dan sebabnya disebutkan", /perkara_id tidak terbaca/.test(tanpaPerkara.dilewati[0].sebab));
  }

  // ==========================================================================
  console.log("\n== Kodenya sendiri tidak memuat perintah pengubah ==");
  {
    const sumber = fs.readFileSync(
      pathx.resolve(__dirname, "..", "services", "antrianSinkronService.js"),
      "utf8"
    );
    // Yang dicari perintahnya, bukan katanya - kata "DELETE" muncul di dalam
    // komentar yang justru menerangkan bahwa ia tidak dipakai.
    periksa("tidak ada UPDATE", !/`?\s*UPDATE\s+\$\{?TABEL/i.test(sumber) && !/query\([^)]*UPDATE /i.test(sumber));
    periksa("tidak ada DELETE FROM", !/DELETE\s+FROM/i.test(sumber));
    periksa("tidak ada TRUNCATE", !/TRUNCATE/i.test(sumber));
    periksa("hanya INSERT INTO yang ditulis", /INSERT INTO \$\{TABEL_LENGKAP\}/.test(sumber));
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
