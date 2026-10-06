"use strict";

/**
 * Pembebanan saat ikrar talak di Jadwal Sidang (diminta 6 Oktober 2026).
 *
 * Menjalankan daftarSidang dengan SIPP tiruan (db_config diganti sebelum
 * layanannya dimuat, pola verify-sipp-jadwal-sidang.js) dan memeriksa:
 *
 *   - amar dibaca dengan SATU kueri IN, hanya untuk perkara yang sidangnya
 *     sidang ikrar - bukan per baris, bukan untuk seluruh sidang hari itu;
 *   - pembebanan hanya menempel pada baris sidang ikrar;
 *   - kueri yang gagal membuat pembebananTerbaca false, bukan "tanpa
 *     pembebanan".
 *
 * Tidak ada database yang disentuh.
 */

const pathx = require("path");

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

const AMAR_IKRAR =
  "<p>1. Mengabulkan permohonan Pemohon;</p>" +
  "<p>2. Memberi izin kepada Pemohon (<strong>Fulan bin Fulan</strong>) untuk menjatuhkan talak satu raj&#39;i terhadap Termohon (<strong>Fulanah binti Fulan</strong>) di depan sidang Pengadilan Agama Donggala;</p>" +
  "<p>3. Menghukum Pemohon untuk membayar hak Termohon yaitu <em>Mut`ah</em> berupa uang tunai sebesar Rp10.000.000,00 (sepuluh juta rupiah) yang diserahkan sebelum ikrar talak diucapkan;</p>" +
  "<p>4. Membebankan kepada Pemohon untuk membayar biaya perkara ini sejumlah Rp199.000,00 (seratus sembilan puluh sembilan ribu rupiah).</p>";

let jawaban = {};
let gagalkanAmar = false;
const kueri = [];

const dbPath = require.resolve(pathx.resolve(__dirname, "..", "db_config.js"));
require.cache[dbPath] = {
  id: dbPath,
  filename: dbPath,
  loaded: true,
  exports: {
    query(sql, params, callback) {
      const teks = String(sql);
      kueri.push({ sql: teks, params: params || [] });
      if (teks.includes("pu.amar_putusan AS amarPutusan")) {
        if (gagalkanAmar) return callback(new Error("tiruan: kueri amar gagal"));
        const id = (params || []).map(Number);
        return callback(null, (jawaban.amar || []).filter((b) => id.includes(Number(b.perkaraId))));
      }
      if (teks.includes("FROM perkara_jadwal_sidang")) return callback(null, jawaban.sidang || []);
      return callback(null, []);
    },
  },
};

const layanan = require("../services/sippJadwalSidangService");

async function jalan() {
  jawaban = {
    sidang: [
      { sidangId: 1, perkaraId: 404, nomorPerkara: "404/Pdt.G/2026/PA.Dgl", jenisPerkara: "Cerai Talak", tanggalSidang: "2026-09-09", agenda: "SIDANG IKRAR TALAK", ikrarTalak: "Y", ditunda: "T" },
      // Bendera T tetapi agendanya ikrar - sidangIkrar portal juga
      // mengenalinya dari agenda.
      { sidangId: 2, perkaraId: 405, nomorPerkara: "405/Pdt.G/2026/PA.Dgl", jenisPerkara: "Cerai Talak", tanggalSidang: "2026-09-09", agenda: "Sidang Ikrar Talak", ikrarTalak: "T", ditunda: "T" },
      { sidangId: 3, perkaraId: 406, nomorPerkara: "406/Pdt.G/2026/PA.Dgl", jenisPerkara: "Cerai Talak", tanggalSidang: "2026-09-09", agenda: "Pembacaan putusan", ikrarTalak: "T", ditunda: "T" },
    ],
    amar: [
      { perkaraId: 404, tanggalPutusan: "2026-08-01", amarPutusan: AMAR_IKRAR },
      { perkaraId: 405, tanggalPutusan: "2026-08-02", amarPutusan: "<p>Mengabulkan permohonan Pemohon;</p><p>Membebankan biaya perkara sejumlah Rp199.000,00</p>" },
      { perkaraId: 406, tanggalPutusan: "2026-08-03", amarPutusan: AMAR_IKRAR },
    ],
  };

  console.log("\n== Satu kueri, hanya perkara sidang ikrar ==");
  kueri.length = 0;
  const hasil = await layanan.daftarSidang({ dari: "2026-09-09" });
  const kueriAmar = kueri.filter((k) => k.sql.includes("pu.amar_putusan AS amarPutusan"));
  periksa("amar dibaca tepat satu kali untuk seluruh daftar", kueriAmar.length === 1);
  periksa("memakai IN, bukan satu kueri per perkara", kueriAmar[0] && /IN \(\?, \?\)/.test(kueriAmar[0].sql));
  periksa(
    "yang ditanyakan hanya perkara sidang ikrar (404, 405), bukan 406",
    kueriAmar[0] && kueriAmar[0].params.map(Number).sort().join(",") === "404,405"
  );

  console.log("\n== Pembebanan hanya pada sidang ikrar ==");
  const s404 = hasil.sidang.find((s) => s.perkaraId === "404");
  const s405 = hasil.sidang.find((s) => s.perkaraId === "405");
  const s406 = hasil.sidang.find((s) => s.perkaraId === "406");
  periksa("sidang ikrar membawa pembebanan", Boolean(s404 && s404.pembebanan));
  periksa(
    "mut'ah Rp10.000.000 terbaca, biaya perkara tidak ikut",
    s404 && s404.pembebanan.totalSekaligus === 10000000 && s404.pembebanan.pos.length === 1
  );
  periksa("waktu bayar sebelum ikrar terbaca", s404 && s404.pembebanan.sebelumIkrar === true);
  periksa("sidang ikrar tanpa pembebanan bernilai null", s405 && s405.pembebanan === null);
  periksa("sidang bukan ikrar tidak membawa pembebanan walau amarnya punya", s406 && s406.pembebanan === null);
  periksa("pembebananTerbaca true bila kuerinya berhasil", hasil.sidang.every((s) => s.pembebananTerbaca === true));

  console.log("\n== Kueri gagal tidak terbaca sebagai 'tanpa pembebanan' ==");
  gagalkanAmar = true;
  const gagalBaca = await layanan.daftarSidang({ dari: "2026-09-09" });
  gagalkanAmar = false;
  periksa("jadwal tetap tampil", gagalBaca.sidang.length === 3);
  periksa("pembebananTerbaca false", gagalBaca.sidang.every((s) => s.pembebananTerbaca === false));

  console.log("\n== SIPP hanya dibaca ==");
  periksa("seluruh kueri SELECT", kueri.every((k) => /^\s*SELECT/i.test(k.sql)));

  console.log(`\nHasil: ${lulus} lulus, ${gagal} gagal`);
  process.exit(gagal > 0 ? 1 : 0);
}

jalan().catch((e) => {
  console.error(e);
  process.exit(1);
});
