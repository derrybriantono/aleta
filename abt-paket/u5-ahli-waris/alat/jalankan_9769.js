// Menjalankan variabel 9768/9769/9770 (salinan dari server, baca saja) pada MariaDB lokal dengan isian tiruan.
//   node jalankan_9769.js '{"1025":"Fulan bin A","9701":"Siti binti B","9702":"Ali bin Fulan; Ani binti Fulan"}'
const path = require("path");
const fs = require("fs");
const { createRequire } = require("module");
const akar = path.resolve(__dirname, "..", "..", "..");
const mysql = createRequire(path.join(akar, "aleta_bot", "package.json"))("mysql");
const SQL_DIR = process.env.SQL_9769 || "D:/Aplikasi/aleta/tmp/u5/sql";

function buatPenjalan() {
  const kon = mysql.createConnection({ host: "127.0.0.1", user: "root", database: "aps_badilag_u5", multipleStatements: true, typeCast: (f) => f.string() });
  const q = (s, p) => new Promise((ok, g) => kon.query(s, p || [], (e, r) => (e ? g(e) : ok(r))));
  const sqls = {};
  for (const n of [9768, 9769, 9770]) sqls[n] = fs.readFileSync(path.join(SQL_DIR, `${n}.sql`), "latin1");
  let id = 880000;
  return {
    async jalankan(isian) {
      id += 1;
      await q("DELETE FROM abt_data_teks WHERE perkara_id = ?", [id]).catch(() => null);
      for (const [no, data] of Object.entries(isian)) await q("INSERT INTO abt_data_teks (no_var, perkara_id, data) VALUES (?, ?, ?)", [Number(no), id, data]);
      const hasil = {};
      for (const n of [9768, 9769, 9770]) {
        const sql = sqls[n].replace(/aps_badilag\./g, "aps_badilag_u5.").replace(/#perkara_id#/g, String(id));
        const r = await q(sql);
        hasil[n] = r[0] ? String(r[0].data == null ? "" : r[0].data) : "";
      }
      return hasil;
    },
    tutup: () => kon.end(),
  };
}
module.exports = { buatPenjalan };
if (require.main === module) {
  (async () => {
    const p = buatPenjalan();
    const h = await p.jalankan(JSON.parse(process.argv[2]));
    for (const [n, t] of Object.entries(h)) console.log(`--- ${n}\n${t.replace(/<br>/g, "\n  <br>")}`);
    p.tutup();
  })();
}
