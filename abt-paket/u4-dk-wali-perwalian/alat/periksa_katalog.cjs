// Memeriksa katalog saksi U4 dengan periksaKatalog (mesin yang sama dengan uji penjaga) dan mencetak SEMUA galat/peringatan.
// Pakai: node periksa_katalog.cjs [berkas1.json berkas2.json ...]   (bawaan: dispensasi-kawin, wali-adhal, perwalian)
const fs = require("node:fs");
const path = require("node:path");
const REPO = path.resolve(__dirname, "..", "..", "..");
const EKS = path.join(REPO, "ekstensi-sipp");
globalThis.window = globalThis;
const Mesin = require(path.join(EKS, "saksi-katalog.js"));
const kamusBerkas = process.env.ALETA_ABT_VARIABEL || "D:/Aplikasi/aleta/tmp/abt-variabel.json";
const variabelAda = fs.existsSync(kamusBerkas) ? new Set(Object.keys(JSON.parse(fs.readFileSync(kamusBerkas, "utf8")))) : null;
const berkas = process.argv.slice(2).length ? process.argv.slice(2) : ["dispensasi-kawin.json", "wali-adhal.json", "perwalian.json"];
let total = 0;
for (const nama of berkas) {
  const kat = JSON.parse(fs.readFileSync(path.join(EKS, "saksi-katalog", nama), "utf8"));
  const r = Mesin.periksaKatalog(kat, { namaBerkas: nama, variabelAda });
  console.log(`${nama}: galat ${r.galat.length}, peringatan ${r.peringatan.length}`);
  for (const g of r.galat) console.log("  GALAT", g);
  for (const g of r.peringatan.slice(0, 20)) console.log("  peringatan", g);
  total += r.galat.length;
}
process.exit(total ? 1 : 0);
