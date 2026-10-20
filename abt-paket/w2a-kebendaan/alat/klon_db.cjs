// Membuat DB uji lokal aps_badilag_w2a (salinan 22 tabel ABT dari aps_badilag_u2 + variabel server 20 Okt) untuk render RTF dan uji variabel.
// Pakai: node klon_db.cjs <tsv-variabel-server>
const fs = require("fs");
const path = require("path");
const mysql = require(path.resolve(__dirname, "../../../aleta_bot/node_modules/mysql"));
const kon = mysql.createConnection({ host: "127.0.0.1", user: "root", typeCast: (f) => f.string(), multipleStatements: true });
const q = (s, p) => new Promise((a, b) => kon.query(s, p || [], (e, r) => (e ? b(e) : a(r))));
const unesc = (s) => s.replace(/\\(.)/g, (m, c) => (c === "n" ? "\n" : c === "t" ? "\t" : c === "0" ? "\0" : c === "\\" ? "\\" : m));
(async () => {
  const DB = "aps_badilag_w2a";
  const SUMBER = "aps_badilag_u2";
  await q(`DROP DATABASE IF EXISTS ${DB}`);
  await q(`CREATE DATABASE ${DB} DEFAULT CHARACTER SET latin1`);
  const tabel = (await q(`SELECT table_name n FROM information_schema.tables WHERE table_schema='${SUMBER}'`)).map((x) => x.n);
  for (const t of tabel) {
    await q(`CREATE TABLE ${DB}.${t} LIKE ${SUMBER}.${t}`);
    await q(`INSERT INTO ${DB}.${t} SELECT * FROM ${SUMBER}.${t}`);
  }
  // variabel server yang belum ada
  const ada = new Set((await q(`SELECT no_var FROM ${DB}.abt_variabel`)).map((x) => x.no_var));
  const baris = fs.readFileSync(process.argv[2], "utf8").split("\n").slice(1).filter(Boolean);
  let tambah = 0;
  for (const l of baris) {
    const p = l.split("\t");
    if (ada.has(p[0])) continue;
    const sql = p[3] === "NULL" ? null : unesc(p[3]);
    const dflt = p[4] === "NULL" ? null : unesc(p[4]);
    await q(`INSERT INTO ${DB}.abt_variabel (no_var,nama,data_type,sql_query,default_data,locked,modifier) VALUES (?,?,?,?,?,0,'admin')`, [p[0], unesc(p[2]), p[1], sql, dflt]);
    tambah++;
  }
  // semua kueri membaca isian lewat aps_badilag.* -> arahkan ke salinan uji
  await q(`UPDATE ${DB}.abt_variabel SET sql_query = REPLACE(sql_query, 'aps_badilag.', '${DB}.') WHERE sql_query LIKE '%aps_badilag.%'`);
  const n = await q(`SELECT COUNT(*) n FROM ${DB}.abt_variabel`);
  console.log("tabel", tabel.length, "variabel", n[0].n, "ditambah dari server", tambah);
  kon.end();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
