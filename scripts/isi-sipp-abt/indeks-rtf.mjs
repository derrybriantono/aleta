// Mengindeks berkas RTF blangko Derry dari semua sumber lokal, terbaru menang.
// Dipakai bangun-daftar-cek.mjs. Hanya baca.
import fs from "fs";
import path from "path";

export function indeksRtf(akarBatch = "D:/aleta-dev/kerja/batch-14okt-sore", xampp = "D:/satker asal/website pa bungku/xampp/htdocs/aps_badilag/_blangko_abt") {
  const roots = [];
  if (fs.existsSync(xampp)) roots.push(xampp);
  if (fs.existsSync(akarBatch)) {
    for (const s of fs.readdirSync(akarBatch)) {
      const sp = path.join(akarBatch, s);
      if (!fs.statSync(sp).isDirectory()) continue;
      for (const x of fs.readdirSync(sp)) {
        const xp = path.join(sp, x);
        if (!fs.statSync(xp).isDirectory()) continue;
        if (/^abt-/.test(x) && fs.existsSync(path.join(xp, "paket-satker"))) roots.push(path.join(xp, "paket-satker"));
        if (/^server-asal/.test(x)) roots.push(xp);
      }
    }
  }
  const hasil = new Map();
  const jalan = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) jalan(p);
      else if (/\.rtf$/i.test(e.name)) {
        const m = p.replace(/\\/g, "/").match(/derry_briantono\/(.+)$/);
        if (!m) continue;
        const k = "derry_briantono/" + m[1];
        const t = fs.statSync(p).mtimeMs;
        const lama = hasil.get(k);
        if (!lama || t > lama.t) hasil.set(k, { p: p.replace(/\\/g, "/"), t });
      }
    }
  };
  for (const r of roots) {
    try {
      jalan(r);
    } catch {
      /* akar tak terbaca */
    }
  }
  return hasil;
}

if (process.argv[1] && process.argv[1].endsWith("indeks-rtf.mjs")) {
  const h = indeksRtf();
  const fx = JSON.parse(fs.readFileSync("manajemen_surat/src/test/fixtures/blangko-derry-server-17okt.json", "utf8"));
  const tidak = fx.berkas.filter((b) => !h.has(b));
  console.log("jalur unik", h.size, "fixture", fx.berkas.length, "tak ada", tidak.length);
  console.log(tidak.slice(0, 20));
}
