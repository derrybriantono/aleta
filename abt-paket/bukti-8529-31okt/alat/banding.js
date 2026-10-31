// Banding 8529 sebelum/sesudah paket abt-bukti-8529-31okt atas SEMUA perkara basis salinan, lewat mesin variabel ALETA (tiruan ABT,
// HANYA MEMBACA; isi baru lewat timpaKatalog). Harap: yang berubah TEPAT perkara yang keluaran lamanya memuat bunyi lama.
// pakai: NODE_PATH=<aleta_bot/node_modules> node banding.js <akar-worktree> <abt> <sipp> <keluar.json>
const fs = require("fs");
const path = require("path");
const [akar, abt, sipp, keluar] = process.argv.slice(2);
const mysql = require("mysql");
const pool = mysql.createPool({ host: "127.0.0.1", user: "root", password: "", database: sipp, connectionLimit: 6 });
const kueri = (sql, params, opsi) => new Promise((ok, no) => pool.query({ sql, timeout: (opsi && opsi.timeoutMs) || 30000, typeCast: (f) => f.string() }, params || [], (e, r) => (e ? no(e) : ok(r))));
const { buatMesin } = require(path.join(akar, "aleta_bot/services/abtMesinVariabel.js"));
const LAMA = "<mark>[HURUF ALASAN PERCERAIAN BELUM DIPILIH]</mark>";
const BARU = "<mark>[BUKTI SURAT KTP/SURAT DOMISILI BELUM ADA DI DAFTAR BUKTI]</mark>";
(async () => {
  const [v] = await kueri(`SELECT sql_query FROM ${abt}.abt_variabel WHERE no_var = 8529`, [], { timeoutMs: 60000 });
  const baru = String(v.sql_query).split(LAMA).join(BARU);
  if (baru === String(v.sql_query)) throw new Error("bunyi lama tidak ada di 8529 (paket sudah terpasang?)");
  const perkara = await kueri("SELECT perkara_id, nomor_perkara FROM perkara", [], { timeoutMs: 300000 });
  const mLama = buatMesin({ kueri, skemaAbt: abt, umurKatalogMs: 3600000, batasKueriMs: 30000 });
  const mBaru = buatMesin({ kueri, skemaAbt: abt, umurKatalogMs: 3600000, batasKueriMs: 30000, timpaKatalog: { 8529: { sql_query: baru } } });
  const h = { perkara: perkara.length, sama: 0, berubahBunyiLama: 0, berubahLain: [], tidakBerubahPadahalBunyiLama: [], galatLama: 0, galatBaru: [] };
  let i = 0;
  await Promise.all(Array.from({ length: 4 }, async () => {
    while (i < perkara.length) {
      const p = perkara[i++];
      const id = String(p.perkara_id);
      const [a, b] = await Promise.all([mLama.nilaiPenanda({ perkaraId: id }, ["8529"]), mBaru.nilaiPenanda({ perkaraId: id }, ["8529"])]);
      const va = a.get("8529") || {};
      const vb = b.get("8529") || {};
      if (va.status === "galat") h.galatLama += 1;
      if (vb.status === "galat") h.galatBaru.push({ id, sebab: String(vb.sebab).slice(0, 160) });
      const lama = String(va.polos);
      const adaLama = lama.includes("[HURUF ALASAN PERCERAIAN BELUM DIPILIH]");
      if (lama === String(vb.polos)) {
        h.sama += 1;
        if (adaLama) h.tidakBerubahPadahalBunyiLama.push(id);
      } else if (adaLama && String(vb.polos) === lama.split("[HURUF ALASAN PERCERAIAN BELUM DIPILIH]").join("[BUKTI SURAT KTP/SURAT DOMISILI BELUM ADA DI DAFTAR BUKTI]")) h.berubahBunyiLama += 1;
      else h.berubahLain.push({ id, nomor: p.nomor_perkara });
    }
  }));
  fs.writeFileSync(keluar, JSON.stringify(h, null, 1));
  console.log(JSON.stringify({ ...h, berubahLain: h.berubahLain.length, tidakBerubahPadahalBunyiLama: h.tidakBerubahPadahalBunyiLama.length, galatBaru: h.galatBaru.length }));
  pool.end();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
