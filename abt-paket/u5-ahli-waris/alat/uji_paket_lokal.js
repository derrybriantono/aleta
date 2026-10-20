// Menguji paket-satker/*.sql pada MariaDB lokal (basis data uji aps_badilag_u5p, tabel abt_variabel tiruan skema server):
//   1. PASANG pada tabel kosong -> PERIKSA harus "SEMUA COCOK"
//   2. PASANG kedua kali harus GAGAL pada prasyarat (jatah terpakai) dan tidak menambah baris
//   3. PULIH menghapus semuanya
//   4. baris lain di abt_variabel (di luar 4500-4599) tidak tersentuh
// Keluaran: JSON ringkas. Dipakai uji vitest (abt-paket-u5.test.ts).
const path = require("path");
const fs = require("fs");
const { createRequire } = require("module");
const akar = path.resolve(__dirname, "..", "..", "..");
const mysql = createRequire(path.join(akar, "aleta_bot", "package.json"))("mysql");
const PAKET = path.join(__dirname, "..", "paket-satker");

const kon = mysql.createConnection({ host: "127.0.0.1", user: "root", multipleStatements: true, typeCast: (f) => f.string() });
const q = (s, p) => new Promise((ok, g) => kon.query(s, p || [], (e, r) => (e ? g(e) : ok(r))));
const baca = (n) => fs.readFileSync(path.join(PAKET, n), "latin1");

(async () => {
  const hasil = {};
  await q("DROP DATABASE IF EXISTS aps_badilag_u5p; CREATE DATABASE aps_badilag_u5p DEFAULT CHARSET latin1;");
  await q("USE aps_badilag_u5p");
  await q("CREATE TABLE abt_variabel LIKE aps_badilag.abt_variabel");
  await q("INSERT INTO abt_variabel (no_var, nama, data_type, locked) VALUES (4001, 'AMAR LAMA', 'data_sql', 0), (9770, 'AHLI WARIS YANG BERHAK', 'data_sql', 0)");
  hasil.sebelum = (await q("SELECT COUNT(*) n FROM abt_variabel"))[0].n;

  // 1. pasang
  const r1 = await q(baca("abt-u5-PASANG.sql"));
  hasil.prasyarat = JSON.stringify(r1).includes("PRASYARAT COCOK");
  hasil.sesudahPasang = (await q("SELECT COUNT(*) n FROM abt_variabel WHERE no_var BETWEEN 4500 AND 4599"))[0].n;
  const per = await q(baca("abt-u5-PERIKSA.sql"));
  const terakhir = per[per.length - 1];
  hasil.periksa = terakhir && terakhir[0] ? terakhir[0].hasil : "(tidak ada)";
  hasil.barisPeriksa = (per[0] || []).length;
  hasil.barisTidakCocok = (per[0] || []).filter((b) => b.cocok !== "1").map((b) => b.no_var);

  // 2. pasang lagi harus gagal
  let galat = "";
  try {
    await q(baca("abt-u5-PASANG.sql"));
  } catch (e) {
    galat = e.message;
  }
  hasil.pasangLagiGalat = galat;
  hasil.sesudahPasangLagi = (await q("SELECT COUNT(*) n FROM abt_variabel WHERE no_var BETWEEN 4500 AND 4599"))[0].n;

  // 3. pulih
  await q(baca("abt-u5-PULIH-HAPUS-BARU.sql"));
  hasil.sesudahPulih = (await q("SELECT COUNT(*) n FROM abt_variabel WHERE no_var BETWEEN 4500 AND 4599"))[0].n;
  hasil.akhir = (await q("SELECT COUNT(*) n FROM abt_variabel"))[0].n;

  // 4. isi: panjang kolom dalam batas TEXT
  await q(baca("abt-u5-PASANG.sql"));
  const panjang = await q("SELECT no_var, LENGTH(sql_query) p, CHAR_LENGTH(nama) n FROM abt_variabel WHERE no_var BETWEEN 4500 AND 4599 ORDER BY no_var");
  hasil.terpanjang = Math.max(...panjang.map((x) => Number(x.p) || 0));
  hasil.namaTerpanjang = Math.max(...panjang.map((x) => Number(x.n) || 0));
  hasil.jumlah = panjang.length;
  console.log(JSON.stringify(hasil));
  kon.end();
})().catch((e) => {
  console.error("GALAT", e.message);
  process.exit(1);
});
