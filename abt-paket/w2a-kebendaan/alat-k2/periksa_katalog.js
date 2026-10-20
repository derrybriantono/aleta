// node periksa_katalog.js <katalog.json> : periksa dengan mesin repo; cetak galat/peringatan
const fs = require("fs"), path = require("path");
const akar = path.resolve(__dirname, "..", "..", "..");
const Mesin = require(path.join(akar, "ekstensi-sipp", "saksi-katalog.js"));
const kat = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const kamusBerkas = process.env.ALETA_ABT_VARIABEL || "D:/Aplikasi/aleta/tmp/abt-variabel.json";
const ada = new Set(Object.keys(JSON.parse(fs.readFileSync(kamusBerkas, "utf8"))));
const r = Mesin.periksaKatalog(kat, { namaBerkas: path.basename(process.argv[2]), variabelAda: ada });
console.log("galat", r.galat.length, "peringatan", r.peringatan.length);
r.galat.slice(0, 60).forEach((g) => console.log("  GALAT", g));
r.peringatan.slice(0, 30).forEach((g) => console.log("  PERINGATAN", g));
console.log("pertanyaan", kat.pertanyaan.length, "pokok", kat.pokokPembuktian.length, "keadaan", Object.keys(kat.keadaan).length, "dasar", kat.dasarHukum.length, "profil", kat.profilSaksi ? Object.keys(kat.profilSaksi).length : 0);
