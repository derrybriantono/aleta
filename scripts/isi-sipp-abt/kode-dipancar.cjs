// Kode yang SUNGGUH dipancarkan modul deteksi bot (dari sumber), dibandingkan dengan registri `variabel` modulnya.
// Registri `variabel` adalah dokumentasi; pemancar sungguhan ada di badan fungsi `deteksi`.
//   node scripts/isi-sipp-abt/kode-dipancar.cjs
const fs = require("fs");
const path = require("path");

const akar = path.resolve(__dirname, "..", "..");
const dir = path.join(akar, "aleta_bot", "services", "deteksi");

const POLA = [
  /hasil\["(\d{4,5})"\]\s*=/g,
  /taruh\(\s*\w+\s*,\s*"(\d{4,5})"/g,
  /peta\["(\d{4,5})"\]\s*=/g,
  /fakta\["(\d{4,5})"\]\s*=/g,
  /out\["(\d{4,5})"\]\s*=/g,
  /\["(\d{4,5})"\]\s*=\s*[a-zA-Z]/g,
];

/** Peta kunci modul -> Set kode yang dipancarkan (dibaca dari sumber berkas modul). */
function dipancar() {
  const { DAFTAR } = require(path.join(dir, "index.js"));
  const hasil = new Map();
  for (const nama of DAFTAR) {
    const f = path.join(dir, `${nama}.js`);
    if (!fs.existsSync(f)) continue;
    const src = fs.readFileSync(f, "utf8");
    const set = new Set();
    for (const p of POLA) {
      p.lastIndex = 0;
      let m;
      while ((m = p.exec(src))) set.add(m[1]);
    }
    const kunci = require(f).kunci;
    hasil.set(kunci, { berkas: `aleta_bot/services/deteksi/${nama}.js`, kode: set });
  }
  return hasil;
}

module.exports = { dipancar };

if (require.main === module) {
  const { semuaModul } = require(path.join(dir, "index.js"));
  for (const [kunci, d] of dipancar()) {
    const mod = semuaModul().find((x) => x.kunci === kunci);
    const reg = new Set((mod.variabel || []).filter((v) => v.deteksi !== false && !/^belum/i.test(v.oleh || "")).map((v) => v.kode));
    const lebih = [...d.kode].filter((k) => !reg.has(k));
    const kurang = [...reg].filter((k) => !d.kode.has(k));
    console.log(kunci.padEnd(18), "dipancar", d.kode.size, "registri", reg.size, "| dipancar-bukan-registri:", lebih.join(","), "| registri-bukan-dipancar:", kurang.join(","));
  }
}
