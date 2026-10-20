// Memeriksa katalog saksi terhadap skema (saksi-katalog.js:periksaKatalog). node periksa_katalog.cjs [nama.json ...]
const fs = require("fs");
const path = require("path");
const REPO = path.resolve(__dirname, "..", "..", "..");
const Mesin = require(path.join(REPO, "ekstensi-sipp", "saksi-katalog.js"));
const FOLDER = path.join(REPO, "ekstensi-sipp", "saksi-katalog");
const KAMUS = process.env.ALETA_ABT_VARIABEL || "D:/Aplikasi/aleta/tmp/abt-variabel.json";
const variabelAda = fs.existsSync(KAMUS) ? new Set(Object.keys(JSON.parse(fs.readFileSync(KAMUS, "utf8")))) : null;
const daftar = process.argv.slice(2).length ? process.argv.slice(2) : ["itsbat-nikah.json", "asal-usul-anak.json", "cerai-kumulasi-itsbat.json"];
let salah = 0;
for (const nama of daftar) {
  const kat = JSON.parse(fs.readFileSync(path.join(FOLDER, nama), "utf8"));
  const r = Mesin.periksaKatalog(kat, { namaBerkas: nama, variabelAda });
  console.log(`${nama}: galat=${r.galat.length} peringatan=${r.peringatan.length} butir=${kat.pertanyaan.length}`);
  r.galat.slice(0, 60).forEach((g) => console.log("  GALAT " + g));
  r.peringatan.slice(0, 15).forEach((g) => console.log("  peringatan " + g));
  salah += r.galat.length;
}
process.exit(salah ? 1 : 0);
