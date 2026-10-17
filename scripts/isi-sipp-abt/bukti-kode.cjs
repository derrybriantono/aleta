// Mencari kemunculan tiap kode isian di berkas kode (bukan uji). Keluaran: kode -> [berkas relatif + jumlah].
// node scripts/isi-sipp-abt/bukti-kode.cjs <analisa.json> <keluaran.json>
const fs = require("fs");
const path = require("path");

const akar = path.resolve(__dirname, "..", "..");
const DIR = [
  ["aleta_bot/services", /\.js$/],
  ["ekstensi-sipp", /\.js$/],
  ["manajemen_surat/src/server/modules/aleta-ecourt", /\.ts$/],
  ["manajemen_surat/src/lib", /\.ts$/],
  ["manajemen_surat/src/app/api/aleta-ecourt", /\.ts$/],
  ["manajemen_surat/src/app/api/aleta-bot", /\.ts$/],
];
const berkas = [];
const jalan = (d, pola) => {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (e.name === "node_modules" || e.name === "archive_unused") continue;
    const p = path.join(d, e.name);
    if (e.isDirectory()) jalan(p, pola);
    else if (pola.test(e.name) && !/\.test\.|\.uji\./.test(e.name)) berkas.push(p);
  }
};
for (const [d, p] of DIR) jalan(path.join(akar, d), p);

const analisa = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const kode = new Set();
for (const b of analisa.blangko) for (const i of b.isian) kode.add(i.kode);

const hasil = {};
for (const k of kode) hasil[k] = [];
for (const f of berkas) {
  const t = fs.readFileSync(f, "utf8");
  const rel = path.relative(akar, f).replace(/\\/g, "/");
  for (const k of kode) {
    const re = new RegExp(`(?<![0-9])${k}(?![0-9])`, "g");
    const n = (t.match(re) || []).length;
    if (n) hasil[k].push([rel, n]);
  }
}
fs.writeFileSync(process.argv[3], JSON.stringify(hasil, null, 1));
console.log("berkas dipindai", berkas.length, "kode", kode.size);
