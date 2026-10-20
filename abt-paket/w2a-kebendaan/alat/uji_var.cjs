// Pasang variabel paket ke DB uji aps_badilag_w2a dan jalankan kueri variabel untuk perkara tertentu.
//   node uji_var.cjs pasang                       -> hapus 4750-4849 lalu pasang dari ../data/variabel.json (jalur aps_badilag. -> aps_badilag_w2a.)
//   node uji_var.cjs jalan <perkara_id> <no...>   -> cetak hasil tiap variabel (token #nnnn# dibiarkan apa adanya)
//   node uji_var.cjs isian <perkara_id> <no> <teks>  (teks kosong = hapus)
const fs = require("fs");
const path = require("path");
const mysql = require(path.resolve(__dirname, "../../../aleta_bot/node_modules/mysql"));
const DB = "aps_badilag_w2a";
const kon = mysql.createConnection({ host: "127.0.0.1", user: "root", database: "sipp_donggala", typeCast: (f) => f.string() });
const q = (s, p) => new Promise((a, b) => kon.query(s, p || [], (e, r) => (e ? b(e) : a(r))));
const V = () => JSON.parse(fs.readFileSync(path.resolve(__dirname, "../data/variabel.json"), "utf8"));

(async () => {
  const [, , perintah, ...arg] = process.argv;
  if (perintah === "pasang") {
    await q(`DELETE FROM ${DB}.abt_variabel WHERE no_var BETWEEN 4750 AND 4849`);
    const v = V();
    for (const x of v) {
      const sql = x.sql ? x.sql.split("aps_badilag.").join(DB + ".") : null;
      await q(`INSERT INTO ${DB}.abt_variabel (no_var,nama,data_type,sql_query,default_data,locked,modifier) VALUES (?,?,?,?,?,0,'admin')`, [x.no, x.nama, x.tipe, sql, x.default || null]);
    }
    console.log("terpasang", v.length);
  } else if (perintah === "jalan") {
    const pid = arg[0];
    const nomor = arg.slice(1).map(Number);
    const v = V();
    for (const x of v) {
      if (nomor.length && !nomor.includes(x.no)) continue;
      if (x.tipe !== "data_sql") continue;
      const sql = x.sql.split("aps_badilag.").join(DB + ".").split("#perkara_id#").join(pid);
      try {
        const r = await q(sql);
        console.log(`== ${x.no}: ${JSON.stringify(r[0] && r[0].data)}`);
      } catch (e) {
        console.log(`== ${x.no}: GALAT ${e.message.slice(0, 300)}`);
      }
    }
  } else if (perintah === "fixture") {
    // fixture <berkas.json> [--bersih]: tulis isian ke abt_data_teks (hapus dahulu isian perkara itu yang dipakai fixture)
    const f = JSON.parse(fs.readFileSync(arg[0], "utf8"));
    for (const [no, teks] of Object.entries(f.isian)) {
      await q(`DELETE FROM ${DB}.abt_data_teks WHERE perkara_id=? AND no_var=?`, [f.perkara_id, no]);
      if (teks) await q(`INSERT INTO ${DB}.abt_data_teks (perkara_id,no_var,data) VALUES (?,?,?)`, [f.perkara_id, no, teks]);
    }
    console.log("fixture", Object.keys(f.isian).length, "isian untuk perkara", f.perkara_id);
  } else if (perintah === "bersihkan") {
    // bersihkan <perkara_id> <no,no,...>
    await q(`DELETE FROM ${DB}.abt_data_teks WHERE perkara_id=? AND no_var IN (${arg[1]})`, [arg[0]]);
    console.log("dibersihkan");
  } else if (perintah === "isian") {
    const [pid, no, teks] = arg;
    await q(`DELETE FROM ${DB}.abt_data_teks WHERE perkara_id=? AND no_var=?`, [pid, no]);
    if (teks) await q(`INSERT INTO ${DB}.abt_data_teks (perkara_id,no_var,data) VALUES (?,?,?)`, [pid, no, teks]);
    console.log("isian", no, teks ? "diisi" : "dihapus");
  }
  kon.end();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
