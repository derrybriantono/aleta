// Banding 8529 lama vs baru (paket abt-murtad-8529-30okt) atas SEMUA perkara di basis salinan, lewat mesin variabel ALETA (tiruan
// ABT, HANYA MEMBACA). Kueri baru dihitung lewat timpaKatalog - tidak ada yang ditulis. Ringkasan tanpa nama ke <keluar.json>.
// pakai (Git Bash): NODE_PATH=<aleta_bot/node_modules> node banding.js <akar-worktree> <abt> <sipp> <keluar.json>
const fs = require("fs");
const path = require("path");
const [akar, abt, sipp, keluar] = process.argv.slice(2);
const mysql = require("mysql");
const pool = mysql.createPool({ host: "127.0.0.1", user: "root", password: "", database: sipp, connectionLimit: 6 });
const kueri = (sql, params, opsi) => new Promise((ok, no) => pool.query({ sql, timeout: (opsi && opsi.timeoutMs) || 30000, typeCast: (f) => f.string() }, params || [], (e, r) => (e ? no(e) : ok(r))));
const { buatMesin } = require(path.join(akar, "aleta_bot/services/abtMesinVariabel.js"));
const baru = fs.readFileSync(path.join(__dirname, "..", "sumber", "8529-baru.sql"), "latin1").trim().split("aps_badilag.").join(`${abt}.`);
(async () => {
  const perkara = await kueri("SELECT perkara_id, nomor_perkara, jenis_perkara_id FROM perkara", [], { timeoutMs: 300000 });
  const h = await kueri(`SELECT perkara_id, data FROM ${abt}.abt_data_teks WHERE no_var = 8503`, [], { timeoutMs: 300000 });
  const huruf = new Map(h.map((r) => [String(r.perkara_id), String(r.data || "")]));
  const mLama = buatMesin({ kueri, skemaAbt: abt, umurKatalogMs: 3600000, batasKueriMs: 30000 });
  const mBaru = buatMesin({ kueri, skemaAbt: abt, umurKatalogMs: 3600000, batasKueriMs: 30000, timpaKatalog: { 8529: { sql_query: baru } } });
  const hasil = { perkara: perkara.length, sama: 0, berubah: [], berubahTanpaH: [], galatLama: 0, galatBaru: [], contoh: [] };
  let i = 0;
  const pekerja = Array.from({ length: 4 }, async () => {
    while (i < perkara.length) {
      const p = perkara[i++];
      const id = String(p.perkara_id);
      const [a, b] = await Promise.all([mLama.nilaiPenanda({ perkaraId: id }, ["8529"]), mBaru.nilaiPenanda({ perkaraId: id }, ["8529"])]);
      const va = a.get("8529") || {};
      const vb = b.get("8529") || {};
      if (va.status === "galat") hasil.galatLama += 1;
      if (vb.status === "galat") hasil.galatBaru.push({ id, sebab: String(vb.sebab).slice(0, 160) });
      const n = huruf.get(id) || "";
      const adaH = /H/i.test(n.replace(/[^A-Ha-h]/g, "")) || /^(fasakh|murtad)$/i.test(n.trim());
      if (String(va.polos) === String(vb.polos) && va.status === vb.status) hasil.sama += 1;
      else {
        const r = { id, nomor: p.nomor_perkara, huruf: n, tambahan: String(vb.polos).slice(String(va.polos).length).trim().slice(0, 600) };
        if (adaH) hasil.berubah.push(r);
        else hasil.berubahTanpaH.push(r);
      }
    }
  });
  await Promise.all(pekerja);
  fs.writeFileSync(keluar, JSON.stringify(hasil, null, 1));
  console.log(JSON.stringify({ perkara: hasil.perkara, sama: hasil.sama, berubahH: hasil.berubah.length, berubahTanpaH: hasil.berubahTanpaH.length, galatLama: hasil.galatLama, galatBaru: hasil.galatBaru.length }));
  pool.end();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
