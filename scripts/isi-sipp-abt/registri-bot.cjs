// Registri pengisi isian di bot: modul deteksi per jenis (aleta_bot/services/deteksi/*).
// Mengembalikan Map kode -> [{ modul, sumber, deteksi }]. Hanya baca, tanpa jaringan.
const path = require("path");

function muat(akarRepo) {
  const dir = path.join(akarRepo, "aleta_bot", "services", "deteksi");
  const { DAFTAR, semuaModul } = require(path.join(dir, "index.js"));
  const peta = new Map();
  const taruh = (kode, info) => {
    const k = String(kode);
    if (!peta.has(k)) peta.set(k, []);
    peta.get(k).push(info);
  };
  for (const m of semuaModul()) {
    for (const v of m.variabel || []) {
      taruh(v.kode, { modul: m.kunci, sumber: v.sumber || "", deteksi: v.deteksi !== false && !/^belum/i.test(String(v.oleh || "")), oleh: v.oleh || "", nama: v.nama || "" });
    }
  }
  return { peta, daftar: DAFTAR };
}

module.exports = { muat };

if (require.main === module) {
  const akar = path.resolve(__dirname, "..", "..");
  const { peta } = muat(akar);
  console.log("kode terdaftar di modul deteksi:", peta.size);
  console.log([...peta.entries()].slice(0, 5).map(([k, v]) => k + " " + JSON.stringify(v)).join("\n"));
}
