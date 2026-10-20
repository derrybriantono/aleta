// Uji kueri variabel 4500-4599 pada MariaDB lokal (XAMPP). Memakai basis data uji aps_badilag_u5v (tabel abt_data_teks tiruan)
// dan tabel perkara asli sipp_donggala (perkara_id nyata). TIDAK menyentuh server.
//   node uji_lokal.js [--cetak]
// Keluaran JSON: { no: { skenario: teks } }, dipakai uji vitest (abt-paket-u5.test.ts) dan dibaca manusia.
const path = require("path");
const fs = require("fs");
const { spawnSync } = require("child_process");
const { createRequire } = require("module");
const akar = path.resolve(__dirname, "..", "..", "..");
const mysql = createRequire(path.join(akar, "aleta_bot", "package.json"))("mysql");
const cetak = process.argv.includes("--cetak");

const kon = mysql.createConnection({ host: "127.0.0.1", user: "root", multipleStatements: true, typeCast: (f) => f.string() });
const q = (s, p) => new Promise((ok, g) => kon.query(s, p || [], (e, r) => (e ? g(e) : ok(r))));

// kueri dibangun python (satu sumber kebenaran): variabel.py + bukti.py
const py = spawnSync("python", ["-I", path.join(__dirname, "keluarkan_json.py")], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
if (py.status !== 0) throw new Error(py.stderr || "keluarkan_json.py gagal");
const VAR = JSON.parse(py.stdout);

// perkara nyata: 230/Pdt.P/2026/PA.Dgl (petitum memuat "Menyatakan ... meninggal dunia ... beragama Islam")
const PERKARA_MATI = 10178;
// perkara nyata tanpa butir "Menyatakan ... meninggal": 226 punya; pakai id yang petitumnya tidak memuatnya (dipilih saat jalan)

const SKENARIO = require("./skenario.js");

(async () => {
  await q("DROP DATABASE IF EXISTS aps_badilag_u5v; CREATE DATABASE aps_badilag_u5v DEFAULT CHARSET utf8;");
  await q("CREATE TABLE aps_badilag_u5v.abt_data_teks (no_var int(4) unsigned zerofill NOT NULL, perkara_id bigint(20) NOT NULL, `data` text, modifier varchar(30), modified timestamp NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (no_var, perkara_id)) DEFAULT CHARSET=utf8");
  for (const s of Object.values(SKENARIO)) for (const [no, data] of Object.entries(s.isi)) await q("INSERT INTO aps_badilag_u5v.abt_data_teks (no_var, perkara_id, data) VALUES (?, ?, ?)", [Number(no), s.id, data]);
  await q("USE sipp_donggala");
  const hasil = {};
  for (const v of VAR) {
    if (v.tipe !== "data_sql") continue;
    hasil[v.no] = {};
    for (const [nama, s] of Object.entries(SKENARIO)) {
      // kematian dijaga petitum SIPP: hanya skenario ber-perkara nyata (sippId) yang dipakai untuk 4531/4532
      const khusus = [4531, 4532].includes(v.no);
      if (khusus !== Boolean(s.sippId) && khusus) continue;
      const id = s.id;
      const sql = v.sql.replace(/aps_badilag\./g, "aps_badilag_u5v.").replace(/#perkara_id#/g, String(id));
      try {
        const r = await q(sql);
        hasil[v.no][nama] = r[0] ? String(r[0].data == null ? "" : r[0].data) : "(tanpa baris)";
      } catch (e) {
        hasil[v.no][nama] = "GALAT: " + e.message;
      }
    }
  }
  fs.writeFileSync(path.join(__dirname, "hasil_lokal.json"), JSON.stringify(hasil, null, 1));
  if (cetak) for (const [no, per] of Object.entries(hasil)) for (const [n, t] of Object.entries(per)) console.log(`--- ${no} / ${n}\n${t}`);
  else console.log("ok", Object.keys(hasil).length, "variabel");
  kon.end();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
