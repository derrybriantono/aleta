// Ukur deteksi posita itsbat/asal usul atas perkara nyata 2026 (data baca-saja di D:/Aplikasi/aleta/tmp/s2/data).
// node ukur_deteksi.cjs [--rinci=KODE] [--jenis=360|358]
const fs = require("fs");
const path = require("path");
const REPO = path.resolve(__dirname, "..", "..", "..");
const DIR = process.env.DATA_UKUR || "D:/Aplikasi/aleta/tmp/s2/data/";
const dit = require(path.join(REPO, "aleta_bot", "services", "deteksi", "itsbat.js"));
const dau = require(path.join(REPO, "aleta_bot", "services", "deteksi", "asalUsul.js"));
const U = require(path.join(REPO, "aleta_bot", "services", "abtUsulanService.js"));
const L = require(path.join(REPO, "aleta_bot", "services", "abtUsulanLainService.js"));
const D = require(path.join(REPO, "aleta_bot", "services", "deteksiJenisPerkaraService.js"));
let tambahan = null;
try {
  tambahan = require(path.join(REPO, "aleta_bot", "services", "isiJawabanSaksiPosita.js"));
} catch (e) {
  /* */
}
const arg = (n) => (process.argv.find((a) => a.startsWith("--" + n + "=")) || "").split("=")[1] || "";
const tsv = (f) => {
  const t = fs.readFileSync(DIR + f + ".tsv", "utf8").split("\n").filter(Boolean);
  const h = t[0].split("\t");
  return t.slice(1).map((l) => Object.fromEntries(l.split("\t").map((v, i) => [h[i], v === "NULL" ? "" : v.replace(/\\n/g, "\n")])));
};
const perkara = tsv("perkara");
const jenis = arg("jenis") || "360";
const rinci = arg("rinci");
const hitung = {};
let n = 0;
const contoh = {};
for (const p of perkara) {
  if (p.j !== jenis) continue;
  n++;
  let h = {};
  try {
    if (jenis === "360") {
      const r = D.tambahUsulanJenis(L.saringUsulanItsbat(U.dariPositaItsbat(p.posita, { pemohon: "Pemohon", pemohon2: "" }), ""), p.posita, { jenisPerkara: "360" });
      for (const u of r.usulan) h[u.kode] = { nilai: u.nilai, yakin: u.keyakinan };
    } else {
      h = dau.deteksi(p.posita, { petitum: p.petitum }) || {};
    }
  } catch (e) {
    h = {};
  }
  if (tambahan && tambahan.positaTambahan) {
    try {
      for (const t of tambahan.positaTambahan(p.posita, jenis === "358" ? "aua" : "itsbat") || []) h["T:" + t.kunci] = { nilai: t.nilai, yakin: t.yakin };
    } catch (e) {
      /* */
    }
  }
  for (const [k, v] of Object.entries(h)) {
    hitung[k] = (hitung[k] || 0) + 1;
    if (rinci && k === rinci) (contoh[k] = contoh[k] || []).push(`${p.nomor_perkara}: ${String(v.nilai).slice(0, 140)}`);
  }
}
console.log(`jenis ${jenis}: ${n} perkara`);
for (const [k, v] of Object.entries(hitung).sort()) console.log(k.padEnd(28), String(v).padStart(4), ((100 * v) / n).toFixed(0) + "%");
if (rinci) (contoh[rinci] || []).slice(0, 40).forEach((c) => console.log("  " + c));
