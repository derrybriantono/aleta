// Mengukur waktu kueri tiap variabel (token #nnnn# di dalam kueri tidak diganti: yang diukur kueri mentah).
//   node waktu_token.cjs <perkara_id> <no...>
const path = require("path");
const mysql = require(path.resolve(__dirname, "../../../aleta_bot/node_modules/mysql"));
const kon = mysql.createConnection({ host: "127.0.0.1", user: "root", database: "sipp_donggala", typeCast: (f) => f.string() });
const q = (s) => new Promise((a, b) => kon.query(s, (e, r) => (e ? b(e) : a(r))));
(async () => {
  const [, , pid, ...nomor] = process.argv;
  for (const no of nomor) {
    const r = await q(`SELECT sql_query, data_type FROM aps_badilag_w2a.abt_variabel WHERE no_var=${Number(no)}`);
    if (!r[0] || r[0].data_type !== "data_sql") {
      console.log(no, "bukan data_sql");
      continue;
    }
    const sql = r[0].sql_query.split("#perkara_id#").join(pid);
    const t0 = Date.now();
    try {
      await q(sql);
      console.log(no.padStart(5), String(Date.now() - t0).padStart(6), "ms", (r[0].sql_query.match(/#\d{4}#/g) || []).filter((x, i, a) => a.indexOf(x) === i).join(" "));
    } catch (e) {
      console.log(no, "GALAT", e.message.slice(0, 100));
    }
  }
  kon.end();
})();
