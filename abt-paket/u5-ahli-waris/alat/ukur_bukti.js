// Mengukur variabel 4530 atas 32 daftar alat bukti PAW (8132) isian petugas SUNGGUHAN dari server (salinan d8132.json, hasil SELECT 20 Okt).
//   node ukur_bukti.js <d8132.json>
const path = require("path"), fs = require("fs"), { spawnSync } = require("child_process"), { createRequire } = require("module");
const akar = path.resolve(__dirname, "..", "..", "..");
const mysql = createRequire(path.join(akar, "aleta_bot", "package.json"))("mysql");
const VAR = JSON.parse(spawnSync("python", ["-I", path.join(__dirname, "keluarkan_json.py")], { encoding: "utf8", maxBuffer: 1 << 26 }).stdout);
const sql = VAR.find((v) => v.no === 4530).sql;
const data = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const kon = mysql.createConnection({ host: "127.0.0.1", user: "root", multipleStatements: true, typeCast: (f) => f.string() });
const q = (s, p) => new Promise((ok, g) => kon.query(s, p || [], (e, r) => (e ? g(e) : ok(r))));
(async () => {
  await q("CREATE DATABASE IF NOT EXISTS aps_badilag_u5b; CREATE TABLE IF NOT EXISTS aps_badilag_u5b.abt_data_teks (no_var int(4) unsigned zerofill NOT NULL, perkara_id bigint(20) NOT NULL, `data` text, PRIMARY KEY (no_var, perkara_id)) DEFAULT CHARSET=utf8");
  const per = { perkara: 0, baris: 0, kelompok: 0, kelas: {}, tanpaKelompok: [] };
  let id = 770000;
  for (const r of data) {
    id += 1;
    await q("REPLACE INTO aps_badilag_u5b.abt_data_teks (no_var, perkara_id, data) VALUES (8132, ?, ?)", [id, r.data]);
    const out = (await q(sql.replace(/aps_badilag\./g, "aps_badilag_u5b.").replace(/#perkara_id#/g, String(id))))[0].data;
    const butir = out.split("<br>").filter(Boolean);
    const baris = r.data.replace(/\r/g, "").split("\n").filter((x) => x.trim()).length;
    per.perkara += 1; per.baris += baris; per.kelompok += butir.length;
    for (const b of butir) {
      const k = /\(([^)]{3,80})\)/.exec(b);
      const nama = k ? k[1] : "(tanpa nama jenis: lain-lain)";
      per.kelas[nama] = (per.kelas[nama] || 0) + 1;
    }
    // kode bukti: bandingkan banyaknya kode P.n pada keluaran dengan banyaknya baris
    const kode = (out.match(/\bP\.[0-9a-zA-Z.]+/g) || []);
    const unik = new Set(kode.map((x) => x.replace(/\.$/, "")));
    if (unik.size < baris && !/ dan /.test(out)) per.tanpaKelompok.push(r.nomor_perkara);
    r.__keluar = { baris, kelompok: butir.length, kode: unik.size };
  }
  console.log(JSON.stringify({ ...per, rataBarisPerKelompok: +(per.baris / per.kelompok).toFixed(2) }, null, 1));
  const lain = Object.entries(per.kelas);
  console.log("kelas:", JSON.stringify(Object.fromEntries(lain)));
  // kode terpakai: semua baris tercakup?
  const kurang = data.filter((r) => r.__keluar.kode < r.__keluar.baris).map((r) => `${r.nomor_perkara}: baris ${r.__keluar.baris} kode ${r.__keluar.kode}`);
  console.log("perkara yang kodenya < baris (pengecualian: baris tanpa kode P bersama kode jamak):", kurang.length, kurang.slice(0, 5).join(" | "));
  kon.end();
})();
