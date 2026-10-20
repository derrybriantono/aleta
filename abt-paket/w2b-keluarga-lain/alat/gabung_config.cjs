// Menggabungkan usulan tambahan tiga keluarga W2b ke berkas konfigurasi bersama (idempoten; tidak pernah menghapus/mengubah entri yang sudah ada).
//   node gabung_config.cjs [--tulis]     tanpa --tulis: hanya melaporkan apa yang akan ditambahkan.
// Masukan : abt-paket/w2b-keluarga-lain/untuk-sesi-utama/<keluarga>-peta-fakta.json   (skema peta-fakta-variabel/1: "fakta" entri baru, "tambahKode" kode untuk fakta lama)
//           abt-paket/w2b-keluarga-lain/untuk-sesi-utama/<keluarga>-gerbang.json      ("kode": {kode: entri gerbang}, "belumTerukur": {kode: alasan})
// Keluaran: aleta_bot/config/peta-fakta-variabel.json dan aleta_bot/config/gerbang-isian.json (indentasi sama dengan berkas asli).
const fs = require("fs");
const path = require("path");

const AKAR = path.resolve(__dirname, "..", "..", "..");
const SUMBER = path.join(AKAR, "abt-paket", "w2b-keluarga-lain", "untuk-sesi-utama");
const PETA = path.join(AKAR, "aleta_bot", "config", "peta-fakta-variabel.json");
const GERBANG = path.join(AKAR, "aleta_bot", "config", "gerbang-isian.json");
const tulis = process.argv.includes("--tulis");

const baca = (p) => JSON.parse(fs.readFileSync(p, "utf8"));
const indent = (p) => {
  const s = fs.readFileSync(p, "utf8");
  const m = /\n( +)"/.exec(s);
  return m ? m[1].length : 2;
};
const berkas = fs.existsSync(SUMBER) ? fs.readdirSync(SUMBER).sort() : [];

function gabungPeta() {
  const peta = baca(PETA);
  let baru = 0;
  let kodeBaru = 0;
  const kodePakai = new Map();
  for (const [k, d] of Object.entries(peta.fakta)) for (const x of d.kode || []) kodePakai.set(typeof x === "string" ? x : x.kode, k);
  for (const nama of berkas.filter((n) => n.endsWith("-peta-fakta.json"))) {
    const t = baca(path.join(SUMBER, nama));
    for (const [k, d] of Object.entries(t.fakta || {})) {
      if (peta.fakta[k]) continue;
      for (const x of d.kode || []) {
        const kode = typeof x === "string" ? x : x.kode;
        if (kodePakai.has(kode)) throw new Error(`${nama}: kode ${kode} sudah dipakai fakta ${kodePakai.get(kode)}`);
        kodePakai.set(kode, k);
      }
      peta.fakta[k] = d;
      baru++;
    }
    for (const [k, daftar] of Object.entries(t.tambahKode || {})) {
      if (!peta.fakta[k]) throw new Error(`${nama}: tambahKode ke fakta yang tidak ada: ${k}`);
      for (const kode of daftar) {
        if (kodePakai.has(kode)) continue;
        peta.fakta[k].kode = [...(peta.fakta[k].kode || []), kode];
        kodePakai.set(kode, k);
        kodeBaru++;
      }
    }
    if (t.bentukKode) peta.fakta = peta.fakta; // tidak dipakai; cadangan skema
  }
  if (tulis) fs.writeFileSync(PETA, JSON.stringify(peta, null, indent(PETA)) + "\n", "utf8");
  return { faktaBaru: baru, kodeBaru };
}

function gabungGerbang() {
  const g = baca(GERBANG);
  let kode = 0;
  let belum = 0;
  for (const nama of berkas.filter((n) => n.endsWith("-gerbang.json"))) {
    const t = baca(path.join(SUMBER, nama));
    // Entri "kode" W2b semuanya berstatus saran dan TANPA data mentah isian petugas (berkas gerbang hanya boleh memuat entri yang bisa
    // dihitung ulang dari UKURAN-GERBANG-U6-*.json). Maka dicatat sebagai belumTerukur (diperlakukan sebagai saran "ragu") beserta
    // ringkasan ukur agen; kode yang bukan saran tidak digabung otomatis (perlu data mentah dan ukur ulang oleh sesi utama).
    for (const [k, e] of Object.entries(t.kode || {})) {
      if (g.kode[k] || (g.belumTerukur && g.belumTerukur[k])) continue;
      const asal = Object.values(e.asal || {});
      if (asal.some((a) => a.status !== "saran")) throw new Error(`${nama}: kode ${k} bukan saran; ukur ulang lewat ukur-gerbang-u6`);
      const ringkas = asal.map((a) => `n=${a.n}${a.banding ? `, banding=${a.banding}, cocok=${a.cocok}` : ""}: ${a.dasar}`).join("; ");
      g.belumTerukur = g.belumTerukur || {};
      g.belumTerukur[k] = `${e.nama}: hanya saran; ${ringkas}`;
      kode++;
    }
    for (const [k, alasan] of Object.entries(t.belumTerukur || {})) {
      if (g.kode[k] || (g.belumTerukur && g.belumTerukur[k])) continue;
      g.belumTerukur = g.belumTerukur || {};
      g.belumTerukur[k] = alasan;
      belum++;
    }
  }
  if (tulis) fs.writeFileSync(GERBANG, JSON.stringify(g, null, indent(GERBANG)) + "\n", "utf8");
  return { kodeBaru: kode, belumTerukurBaru: belum };
}

console.log("peta fakta :", JSON.stringify(gabungPeta()));
console.log("gerbang    :", JSON.stringify(gabungGerbang()));
console.log(tulis ? "DITULIS" : "(tanpa --tulis: tidak ada yang ditulis)");
