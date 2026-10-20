// Menguji paket-satker/*.sql pada MariaDB lokal (basis data uji aps_badilag_w2ap, tabel abt_variabel tiruan skema server):
//   1. PASANG pada tabel yang hanya berisi variabel rujukan -> PERIKSA harus "SEMUA COCOK"
//   2. PASANG kedua kali harus GAGAL pada prasyarat (jatah terpakai) dan tidak menambah baris
//   3. PULIH menghapus semuanya; baris di luar 4780-4849 tidak tersentuh
//   4. PASANG ditolak bila variabel rujukan tidak lengkap
//   5. semua kueri variabel BARU jalan tanpa galat atas perkara nyata (SELECT saja, DB sipp_donggala)
// Keluaran: JSON ringkas. Dipakai uji vitest w2a-kebendaan.test.ts.
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
  await q("DROP DATABASE IF EXISTS aps_badilag_w2ap; CREATE DATABASE aps_badilag_w2ap DEFAULT CHARSET latin1;");
  await q("USE aps_badilag_w2ap");
  await q("CREATE TABLE abt_variabel LIKE aps_badilag_w2a.abt_variabel");
  const pra = [46, 47, 53, 218, 1025, 1246, 1509, 2026, 7037, 8554];
  const isiPra = (n) => q("INSERT INTO abt_variabel (no_var, nama, data_type, locked) VALUES (?, 'VARIABEL LAMA', 'data_sql', 0)", [n]);
  // 4. rujukan tidak lengkap -> ditolak
  for (const n of pra.slice(0, -1)) await isiPra(n);
  let galat = "";
  try {
    await q(baca("abt-w2a-PASANG.sql"));
  } catch (e) {
    galat = e.message;
  }
  hasil.rujukanKurangGalat = galat;
  hasil.rujukanKurangBaris = (await q("SELECT COUNT(*) n FROM abt_variabel WHERE no_var BETWEEN 4780 AND 4849"))[0].n;
  await isiPra(pra[pra.length - 1]);
  await q("INSERT INTO abt_variabel (no_var, nama, data_type, locked) VALUES (9999, 'LAIN', 'data_sql', 0)");
  hasil.sebelum = (await q("SELECT COUNT(*) n FROM abt_variabel"))[0].n;

  // 1. pasang
  const r1 = await q(baca("abt-w2a-PASANG.sql"));
  hasil.prasyarat = JSON.stringify(r1).includes("PRASYARAT COCOK");
  hasil.sesudahPasang = (await q("SELECT COUNT(*) n FROM abt_variabel WHERE no_var BETWEEN 4780 AND 4849"))[0].n;
  const per = await q(baca("abt-w2a-PERIKSA.sql"));
  const terakhir = per[per.length - 1];
  hasil.periksa = terakhir && terakhir[0] ? terakhir[0].hasil : "(tidak ada)";
  hasil.barisPeriksa = (per[0] || []).length;
  hasil.barisTidakCocok = (per[0] || []).filter((b) => b.cocok !== "1").map((b) => b.no_var);

  // 2. pasang lagi harus gagal
  galat = "";
  try {
    await q(baca("abt-w2a-PASANG.sql"));
  } catch (e) {
    galat = e.message;
  }
  hasil.pasangLagiGalat = galat;
  hasil.sesudahPasangLagi = (await q("SELECT COUNT(*) n FROM abt_variabel WHERE no_var BETWEEN 4780 AND 4849"))[0].n;

  // 3. pulih
  await q(baca("abt-w2a-PULIH-HAPUS-BARU.sql"));
  hasil.sesudahPulih = (await q("SELECT COUNT(*) n FROM abt_variabel WHERE no_var BETWEEN 4780 AND 4849"))[0].n;
  hasil.akhir = (await q("SELECT COUNT(*) n FROM abt_variabel"))[0].n;
  hasil.lainTersentuh = (await q("SELECT COUNT(*) n FROM abt_variabel WHERE no_var = 9999"))[0].n;

  // isi: panjang kolom dalam batas TEXT (65535) dan nama <= 200
  await q(baca("abt-w2a-PASANG.sql"));
  const panjang = await q("SELECT no_var, LENGTH(sql_query) p, CHAR_LENGTH(nama) n, data_type t FROM abt_variabel WHERE no_var BETWEEN 4780 AND 4849 ORDER BY no_var");
  hasil.terpanjang = Math.max(...panjang.map((x) => Number(x.p) || 0));
  hasil.namaTerpanjang = Math.max(...panjang.map((x) => Number(x.n) || 0));
  hasil.jumlah = panjang.length;

  // 5. kueri berjalan (token #nnnn# dibiarkan; isian dibaca dari aps_badilag_w2a)
  const daftar = await q("SELECT no_var, sql_query FROM abt_variabel WHERE data_type = 'data_sql' AND no_var BETWEEN 4780 AND 4849 ORDER BY no_var");
  const uji = ["10025", "9528", "9291", "8781", "9233"];
  hasil.kueriGalat = [];
  hasil.kueriJalan = 0;
  await q("USE sipp_donggala");
  for (const v of daftar) {
    for (const id of uji) {
      const sql = v.sql_query.split("aps_badilag.").join("aps_badilag_w2a.").split("#perkara_id#").join(id);
      try {
        await q(sql);
        hasil.kueriJalan += 1;
      } catch (e) {
        hasil.kueriGalat.push(`${v.no_var}/${id}: ${e.message.slice(0, 120)}`);
      }
    }
  }
  console.log(JSON.stringify(hasil));
  kon.end();
})().catch((e) => {
  console.error("GALAT", e.message);
  process.exit(1);
});
