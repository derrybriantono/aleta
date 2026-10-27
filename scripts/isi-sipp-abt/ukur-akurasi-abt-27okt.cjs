// Ukur (baca saja) ketepatan modul deteksi bot terhadap isian petugas yang TERSIMPAN di ABT lokal (abt_data_teks), per jenis perkara
// selain cerai dan per kode: sama / mirip (salah satu memuat yang lain) / beda / hanya-deteksi / hanya-petugas. Juga waktu deteksi (ms/perkara).
//   node scripts/isi-sipp-abt/ukur-akurasi-abt-27okt.cjs [--akar <repo>] [--keluar <berkas.json>] [--jenis 360,362,...] [--contoh 0]
// --contoh N : cetak sampai N pasangan "beda" per kode ke layar (BERISI data sungguhan - jangan disalin ke repo).
const fs = require("fs");
const path = require("path");
const { createRequire } = require("module");

const arg = (nama, bawaan) => {
  const i = process.argv.indexOf(nama);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : bawaan;
};
const akar = path.resolve(arg("--akar", path.resolve(__dirname, "..", "..")));
const keluar = arg("--keluar", "");
const contoh = Number(arg("--contoh", "0"));
const jenisFokus = arg("--jenis", "360,362,371,354,364,369,348,358,363,341,365").split(",").map(Number);
const mysql = createRequire(path.join(akar, "aleta_bot", "package.json"))("mysql");
const deteksi = require(path.join(akar, "aleta_bot", "services", "deteksi", "index.js"));

const kon = mysql.createConnection({ host: "127.0.0.1", user: "root", typeCast: (f) => f.string() });
const q = (sql, p) => new Promise((ok, gagal) => kon.query(sql, p || [], (e, r) => (e ? gagal(e) : ok(r))));
const norm = (t) => String(t || "").toLowerCase().replace(/<[^>]*>/g, " ").replace(/[^a-z0-9]+/g, "");

(async () => {
  const baris = await q(
    `SELECT perkara_id, jenis_perkara_id j, alur_perkara_id a, posita, petitum FROM sipp_donggala.perkara
      WHERE jenis_perkara_id IN (${jenisFokus.join(",")}) AND posita IS NOT NULL AND LENGTH(posita) > 60
        AND perkara_id IN (SELECT DISTINCT perkara_id FROM aps_badilag.abt_data_teks)`
  );
  const abt = await q(
    `SELECT d.perkara_id, CAST(d.no_var AS UNSIGNED) k, d.data FROM aps_badilag.abt_data_teks d JOIN sipp_donggala.perkara p ON p.perkara_id = d.perkara_id
      WHERE p.jenis_perkara_id IN (${jenisFokus.join(",")}) AND d.data IS NOT NULL AND d.data <> ''`
  );
  const nilaiPetugas = new Map();
  for (const r of abt) {
    const m = nilaiPetugas.get(r.perkara_id) || {};
    m[String(r.k).padStart(4, "0")] = r.data;
    nilaiPetugas.set(r.perkara_id, m);
  }
  const hasil = {};
  for (const b of baris) {
    const modul = deteksi.modulUntuk(Number(b.j));
    if (!modul) continue;
    const t0 = process.hrtime.bigint();
    let fakta = {};
    try {
      fakta = modul.deteksi(String(b.posita), { petitum: String(b.petitum || ""), alur: String(b.a || "") }) || {};
    } catch {
      fakta = {};
    }
    const ms = Number(process.hrtime.bigint() - t0) / 1e6;
    const r = (hasil[b.j] = hasil[b.j] || { perkara: 0, ms: 0, kode: {} });
    r.perkara++;
    r.ms += ms;
    const petugas = nilaiPetugas.get(b.perkara_id) || {};
    const kodeSemua = new Set([...Object.keys(petugas), ...Object.keys(fakta).map((k) => String(k).padStart(4, "0"))]);
    for (const k of kodeSemua) {
      const f = fakta[k] || fakta[String(Number(k))];
      const d = f && String(f.nilai || "").trim() ? String(f.nilai) : "";
      const p = petugas[k] || "";
      if (!d && !p) continue;
      const c = (r.kode[k] = r.kode[k] || { sama: 0, mirip: 0, beda: 0, hanyaDeteksi: 0, hanyaPetugas: 0, yakin: {}, contohBeda: [] });
      if (d) c.yakin[f.yakin || "?"] = (c.yakin[f.yakin || "?"] || 0) + 1;
      if (d && !p) c.hanyaDeteksi++;
      else if (!d && p) c.hanyaPetugas++;
      else {
        const a = norm(d), z = norm(p);
        if (a === z) c.sama++;
        else if (a && z && (a.includes(z) || z.includes(a))) c.mirip++;
        else {
          c.beda++;
          if (c.contohBeda.length < contoh) c.contohBeda.push({ deteksi: d.slice(0, 120), petugas: p.slice(0, 120) });
        }
      }
    }
  }
  for (const r of Object.values(hasil)) r.msPerPerkara = r.perkara ? Math.round((r.ms / r.perkara) * 100) / 100 : 0;
  const out = { diukur: new Date().toISOString().slice(0, 10), akar, jenis: hasil };
  if (keluar) fs.writeFileSync(keluar, JSON.stringify({ ...out, jenis: JSON.parse(JSON.stringify(hasil, (k, v) => (k === "contohBeda" ? [] : v))) }, null, 1));
  for (const [j, r] of Object.entries(hasil)) {
    console.log(`\n== jenis ${j}: ${r.perkara} perkara ber-ABT, ${r.msPerPerkara} ms/perkara`);
    for (const [k, c] of Object.entries(r.kode).sort()) {
      const banding = c.sama + c.mirip + c.beda;
      console.log(k, `banding ${banding}`.padEnd(11), `sama ${c.sama} mirip ${c.mirip} beda ${c.beda}`.padEnd(30), `hanyaDeteksi ${c.hanyaDeteksi} hanyaPetugas ${c.hanyaPetugas}`.padEnd(40), JSON.stringify(c.yakin));
      for (const x of c.contohBeda) console.log("     D:", x.deteksi, "| P:", x.petugas);
    }
  }
  kon.end();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
