"use strict";

/**
 * F3.2 (17 Okt 2026) - kehadiran rinci per orang di sisi bot.
 *
 *   1. Skema: saksi_untuk, pulang_pada, diperiksa_pada, keadaan_oleh - SATU
 *      ALTER per kolom (ALTER gabungan ditolak seluruhnya bila satu kolom ada).
 *   2. catatHadir menyimpan "saksi siapa" hanya untuk saksi.
 *   3. daftarKehadiran mengirim id, saksiUntuk, pulangJam, diperiksaJam.
 *   4. ubahKeadaan: pulang/kembali/diperiksa - tidak menyentuh aplikasi
 *      antrian, disaring id + perkara, "diperiksa" hanya untuk saksi.
 *   5. Rute jadwal (?waktu=1) menempelkan kehadiran berkunci perkaraId|tanggal.
 */

const fs = require("fs");
const path = require("path");

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

const kueri = [];
const baris = [];
const botDbPath = require.resolve("../services/botDbService");
const botDbAsli = require("../services/botDbService");
require.cache[botDbPath].exports = {
  toMysqlDate: botDbAsli.toMysqlDate,
  fromMysqlDate: botDbAsli.fromMysqlDate,
  query: async (sql, params = []) => {
    kueri.push({ sql, params });
    if (/^\s*CREATE TABLE/i.test(sql) || /^\s*ALTER TABLE/i.test(sql)) return [];
    if (/INSERT INTO aleta_bot_antrian_kehadiran/i.test(sql)) {
      baris.push({ params });
      return { affectedRows: 1 };
    }
    if (/^\s*UPDATE aleta_bot_antrian_kehadiran\s+SET (pulang_pada|diperiksa_pada)/i.test(sql)) {
      return { affectedRows: params[2] === "ada" ? 1 : 0 };
    }
    if (/FROM aleta_bot_antrian_kehadiran/i.test(sql)) {
      return [
        {
          id: "kh-1",
          perkaraId: "9971",
          peran: "saksi",
          urutanPihak: "2",
          sebagaiKuasa: 0,
          nama: "Siti",
          sisi: "saksi",
          waktuHadir: botDbAsli.toMysqlDate(new Date(2026, 9, 17, 9, 40, 0)),
          sumber: "aleta",
          waChatId: "",
          saksiUntuk: "pihak_1",
          pulangPada: null,
          diperiksaPada: botDbAsli.toMysqlDate(new Date(2026, 9, 17, 10, 5, 0)),
        },
      ];
    }
    return [];
  },
};

const kueriAntrian = [];
const externalPath = require.resolve("../services/externalDbService");
require("../services/externalDbService");
require.cache[externalPath].exports = {
  sanitizeError: (e) => String((e && e.message) || e),
  query: async (kunci, sql, params = []) => {
    kueriAntrian.push({ sql, params });
    return { affectedRows: 1 };
  },
};

const layanan = require("../services/kehadiranAntrianService");

async function utama() {
  console.log("\nUji F3.2 kehadiran rinci (bot)\n");

  console.log("== Skema ==");
  layanan.lupakan();
  await layanan.ensureSchema();
  const alter = kueri.filter((q) => /ALTER TABLE/i.test(q.sql)).map((q) => q.sql);
  for (const kolom of ["saksi_untuk", "pulang_pada", "diperiksa_pada", "keadaan_oleh"]) {
    const satu = alter.filter((s) => s.includes(kolom));
    periksa(`kolom ${kolom} ditambah dengan ALTER tersendiri`, satu.length === 1 && (satu[0].match(/ADD COLUMN/g) || []).length === 1);
  }

  console.log("\n== catatHadir: saksi siapa ==");
  baris.length = 0;
  await layanan.catatHadir({ perkaraId: "9971", peran: "saksi", saksiUntuk: "pihak_1", urutanPihak: "2", nama: "Siti", tanggal: "2026-10-17" });
  await layanan.catatHadir({ perkaraId: "9971", peran: "penggugat", saksiUntuk: "pihak_2", tanggal: "2026-10-17" });
  await layanan.catatHadir({ perkaraId: "9971", peran: "saksi", saksiUntuk: "ngawur", tanggal: "2026-10-17" });
  periksa("saksi pihak_1 tersimpan di kolom ke-14", baris[0].params[13] === "pihak_1");
  periksa("peran bukan saksi tidak menyimpan saksi_untuk", baris[1].params[13] === "");
  periksa("nilai saksi_untuk yang tidak sah dikosongkan", baris[2].params[13] === "");
  periksa("jumlah tanda tanya sama dengan jumlah nilai", (kueri.find((q) => /INSERT INTO/.test(q.sql)).sql.match(/\?/g) || []).length === baris[0].params.length);

  console.log("\n== daftarKehadiran membawa ruas F3.2 ==");
  const peta = await layanan.daftarKehadiran(["9971"], "2026-10-17");
  const satu = peta["9971"].hadir[0];
  periksa("id terkirim", satu.id === "kh-1");
  periksa("saksiUntuk terkirim", satu.saksiUntuk === "pihak_1");
  periksa("diperiksaJam 10:05", satu.diperiksaJam === "10:05");
  periksa("pulangJam kosong", satu.pulangJam === "");
  periksa("kueri memilih kolom baru", /saksi_untuk AS saksiUntuk/.test(kueri[kueri.length - 1].sql));

  console.log("\n== ubahKeadaan ==");
  kueriAntrian.length = 0;
  const pulang = await layanan.ubahKeadaan({ perkaraId: "9971", id: "ada", keadaan: "pulang", oleh: "Petugas" });
  const q1 = kueri[kueri.length - 1];
  periksa("pulang berhasil", pulang.ok === true);
  periksa("pulang mengisi pulang_pada", /SET pulang_pada = \?/.test(q1.sql) && q1.params[0] !== null);
  periksa("disaring id DAN perkara, baris batal tidak diubah", /WHERE id = \? AND perkara_id = \? AND dibatalkan_pada IS NULL/.test(q1.sql));
  await layanan.ubahKeadaan({ perkaraId: "9971", id: "ada", keadaan: "kembali" });
  periksa("kembali mengosongkan pulang_pada", kueri[kueri.length - 1].params[0] === null);
  await layanan.ubahKeadaan({ perkaraId: "9971", id: "ada", keadaan: "diperiksa" });
  periksa("diperiksa hanya untuk saksi", /peran = 'saksi'/.test(kueri[kueri.length - 1].sql));
  periksa("aplikasi antrian tidak disentuh", kueriAntrian.length === 0);
  const tidakAda = await layanan.ubahKeadaan({ perkaraId: "9971", id: "tidak", keadaan: "pulang" });
  periksa("baris tidak ditemukan dijawab jujur", tidakAda.ok === false && tidakAda.alasan === "kehadiran_tidak_ditemukan");
  const salah = await layanan.ubahKeadaan({ perkaraId: "9971", id: "ada", keadaan: "hapus" });
  periksa("keadaan tak dikenal ditolak", salah.ok === false && salah.alasan === "keadaan_tidak_dikenali");

  console.log("\n== Rute gateway ==");
  const rute = fs.readFileSync(path.join(__dirname, "..", "routes", "internalGatewayRoutes.js"), "utf8");
  periksa("GET /antrian/kehadiran ada", rute.includes('router.get("/antrian/kehadiran"'));
  periksa("POST /antrian/kehadiran/keadaan ada", rute.includes('router.post("/antrian/kehadiran/keadaan"'));
  periksa("hadir meneruskan saksiUntuk", /saksiUntuk: String\(req\.body\?\.saksiUntuk/.test(rute));
  periksa("jadwal menempelkan kehadiran berkunci perkaraId|tanggal", rute.includes("kehadiranRinci[`${perkaraId}|${hari}`]") && rute.includes("kehadiran: kehadiranRinci"));

  console.log(`\nLulus: ${lulus}, Gagal: ${gagal}`);
  if (gagal) {
    console.log("ADA PERIKSAAN GAGAL.");
    process.exitCode = 1;
  } else console.log("SEMUA PERIKSAAN LULUS.");
}

utama().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
