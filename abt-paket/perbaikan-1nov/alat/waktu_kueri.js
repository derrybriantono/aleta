// Ukur waktu kueri variabel pembuktian LAMA (sesudah 29 paket) vs BARU (paket perbaikan-1nov) di salinan SIPP.
// Tiap kueri dijalankan N kali per perkara pada satu sambungan; dilaporkan rata-rata dan terburuk (ms).
// pakai: node waktu_kueri.js <basis SIPP> <N> <perkara_id,perkara_id,...>   (NODE_PATH = node_modules bot yang memuat mysql)
const mysql = require("mysql");
const fs = require("fs");
const path = require("path");
const [db, nStr, daftar] = process.argv.slice(2);
const N = Number(nStr || 30);
const baris = fs.readFileSync(path.join(__dirname, "../hasil/kueri-lama-baru.tsv"), "utf8").trim().split("\n").map((l) => l.split("\t"));
const c = mysql.createConnection({ host: "127.0.0.1", user: "root", database: db, dateStrings: true });
const q = (s) => new Promise((ok, no) => c.query(s, (e, r) => (e ? no(e) : ok(r))));
(async () => {
  const ids = String(daftar).split(",").map(Number);
  const jumlah = {};
  for (const id of ids) jumlah[id] = (await q(`SELECT COUNT(*) n FROM perkara_jadwal_sidang WHERE perkara_id = ${id}`))[0].n;
  const hasil = [];
  for (const [no, lama, baru] of baris) {
    for (const id of ids) {
      const row = { no, perkara: id, sidang: jumlah[id] };
      for (const [nama, teks] of [["lama", lama], ["baru", baru]]) {
        const s = teks.split("\\n").join("\n").replace(/;\s*$/, "").split("#perkara_id#").join(String(id));
        await q(s); // panas
        const t = [];
        for (let i = 0; i < N; i += 1) {
          const a = process.hrtime.bigint();
          await q(s);
          t.push(Number(process.hrtime.bigint() - a) / 1e6);
        }
        t.sort((x, y) => x - y);
        row[nama] = { rata: Math.round((t.reduce((x, y) => x + y, 0) / N) * 100) / 100, median: Math.round(t[N >> 1] * 100) / 100, maks: Math.round(t[N - 1] * 100) / 100 };
      }
      hasil.push(row);
      console.log(JSON.stringify(row));
    }
  }
  c.end();
})().catch((e) => { console.error(e); process.exit(1); });
