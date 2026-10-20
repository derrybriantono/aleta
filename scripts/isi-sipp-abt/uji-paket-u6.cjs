// Menguji paket ABT u6-fakta-sinkron atas data lokal (baca saja kecuali pada basis data uji sementara):
//   1. tiap kueri variabel dijalankan pada SIPP lokal (sipp_donggala) untuk beberapa perkara; hasil dicetak;
//   2. PASANG -> PERIKSA -> PULIH dijalankan pada salinan tabel abt_variabel di basis data sementara `aps_u6_uji`
//      (dibuat lalu dihapus; tidak menyentuh aps_badilag*).
//   node scripts/isi-sipp-abt/uji-paket-u6.cjs [id perkara ...]
const fs = require("fs");
const path = require("path");
const { createRequire } = require("module");
const akar = path.resolve(__dirname, "..", "..");
const mysql = createRequire(path.join(akar, "aleta_bot", "package.json"))("mysql");
const paket = path.join(akar, "abt-paket", "u6-fakta-sinkron");
const kon = mysql.createConnection({ host: "127.0.0.1", user: "root", multipleStatements: true, typeCast: (f) => f.string() });
const q = (s, p) => new Promise((a, b) => kon.query(s, p || [], (e, r) => (e ? b(e) : a(r))));
(async () => {
  const V = JSON.parse(fs.readFileSync(path.join(paket, "variabel.json"), "utf8"));
  let ids = process.argv.slice(2).map(Number).filter(Boolean);
  if (!ids.length) ids = [10164, 10165, 10153, 9524, 8316];
  await q("USE sipp_donggala");
  let galat = 0;
  for (const id of ids) {
    console.log("== perkara", id);
    for (const v of V) {
      try {
        const r = await q(v.sql_query.split("#perkara_id#").join(String(id)));
        const nilai = r[0] ? r[0].data : null;
        console.log(" ", v.no_var, String(nilai == null ? "(NULL)" : nilai).replace(/\s+/g, " ").slice(0, 110));
      } catch (e) {
        galat++;
        console.log(" ", v.no_var, "GALAT", e.code, e.sqlMessage);
      }
    }
  }
  // pemasangan pada salinan sementara
  await q("DROP DATABASE IF EXISTS aps_u6_uji");
  await q("CREATE DATABASE aps_u6_uji");
  await q("CREATE TABLE aps_u6_uji.abt_variabel LIKE aps_badilag_i18.abt_variabel");
  await q("INSERT INTO aps_u6_uji.abt_variabel SELECT * FROM aps_badilag_i18.abt_variabel");
  await q("USE aps_u6_uji");
  const sebelum = (await q("SELECT COUNT(*) c FROM abt_variabel"))[0].c;
  const pasang = fs.readFileSync(path.join(paket, "PASANG.sql"), "latin1");
  await q(pasang);
  const sesudah = (await q("SELECT COUNT(*) c FROM abt_variabel"))[0].c;
  const periksa = await q(fs.readFileSync(path.join(paket, "PERIKSA.sql"), "latin1"));
  const akhir = periksa[periksa.length - 1][0].hasil;
  // pasang ulang harus gagal keras dan tidak menulis apa pun
  let ulangGagal = false;
  try {
    await q(pasang);
  } catch (e) {
    ulangGagal = /1242|more than 1 row/i.test(`${e.code} ${e.sqlMessage}`);
  }
  const setelahUlang = (await q("SELECT COUNT(*) c FROM abt_variabel"))[0].c;
  await q(fs.readFileSync(path.join(paket, "PULIH-HAPUS-BARU.sql"), "latin1"));
  const pulih = (await q("SELECT COUNT(*) c FROM abt_variabel"))[0].c;
  console.log(JSON.stringify({ galatKueri: galat, sebelum: Number(sebelum), sesudah: Number(sesudah), periksa: akhir, pasangUlangDitolak: ulangGagal, setelahPasangUlang: Number(setelahUlang), sesudahPulih: Number(pulih) }));
  await q("DROP DATABASE aps_u6_uji");
  kon.end();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
