// Uji kering di MariaDB 5.5.68 server: HANYA SELECT lewat /root/lihat-jejak.sh (baca saja). Subkueri isian abt_data_teks
// diganti literal dari skenario (sama dengan uji_lokal.js), jadi tidak ada baris yang ditulis dan hasilnya dapat dibanding.
//   node uji_server.js   -> hasil_server.json dan perbandingan dengan hasil_lokal.json
const path = require("path");
const fs = require("fs");
const { spawnSync } = require("child_process");

const py = spawnSync("python", ["-I", path.join(__dirname, "keluarkan_json.py")], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
const VAR = JSON.parse(py.stdout);
const lokal = JSON.parse(fs.readFileSync(path.join(__dirname, "hasil_lokal.json"), "utf8"));
const skenario = JSON.parse(spawnSync("node", [path.join(__dirname, "skenario.js")], { encoding: "utf8" }).stdout);

const escLit = (t) => "'" + String(t).replace(/\\/g, "\\\\").replace(/'/g, "''") + "'";
const hasil = {};
let salah = 0;
for (const v of VAR) {
  if (v.tipe !== "data_sql") continue;
  hasil[v.no] = {};
  for (const [nama, s] of Object.entries(skenario)) {
    const khusus = [4531, 4532].includes(v.no);
    if (khusus !== Boolean(s.sippId) && khusus) continue;
    // subkueri isian -> literal (NULL bila isian tidak ada); CONVERT(... USING utf8) tetap berlaku pada literal
    let sql = v.sql.replace(/\(SELECT data FROM aps_badilag\.abt_data_teks WHERE no_var = (\d+) AND perkara_id = '#perkara_id#' LIMIT 1\)/g, (_, no) =>
      s.isi[no] === undefined ? "NULL" : escLit(s.isi[no])
    );
    sql = sql.replace(/#perkara_id#/g, String(s.sippId || 0));
    const r = spawnSync("ssh", ["aleta", 'bash /root/lihat-jejak.sh "$(cat)"'], { input: sql, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
    const keluar = String(r.stdout || "");
    const err = String(r.stderr || "");
    let teks;
    if (/ERROR/.test(err) || r.status !== 0) teks = "GALAT: " + err.slice(0, 300);
    else {
      const baris = keluar.split("\n").slice(1).join("\n").replace(/\n$/, "");
      teks = baris
        .replace(/\\n/g, "\n")
        .replace(/\\t/g, "\t")
        .replace(/\\\\/g, "\\");
      if (teks === "NULL") teks = "";
    }
    hasil[v.no][nama] = teks;
    const l = (lokal[v.no] || {})[nama];
    if (l !== undefined && l !== teks) {
      salah += 1;
      console.log(`BEDA ${v.no}/${nama}\n  lokal : ${JSON.stringify(l).slice(0, 200)}\n  server: ${JSON.stringify(teks).slice(0, 200)}`);
    }
  }
  console.log("selesai", v.no);
}
fs.writeFileSync(path.join(__dirname, "hasil_server.json"), JSON.stringify(hasil, null, 1));
console.log(salah ? `${salah} perbedaan` : "SERVER = LOKAL untuk semua skenario");
