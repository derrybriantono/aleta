"use strict";
/**
 * Ukur waktu satu per satu variabel (berurutan, satu sambungan, tanpa beban pindai lain) atas beberapa perkara.
 * Waktu termasuk variabel bersarang yang dirujuknya (ingatan baru tiap variabel). Baca saja (mesin variabel bot).
 * pakai: NODE_PATH=<aleta_bot/node_modules> node ukur_waktu.js <no,no,...> <perkara,perkara,...>  [env SIPP_DB, ABT_DB, TIMPA=berkas.json {no: sql}]
 */
const fs = require("fs");
const path = require("path");
const mysql = require("mysql");
const { buatMesin } = require(path.join(__dirname, "..", "..", "..", "aleta_bot", "services", "abtMesinVariabel.js"));
const [daftarNo, daftarPid] = process.argv.slice(2);
const SIPP = process.env.SIPP_DB || "sipp_vs";
const ABT = process.env.ABT_DB || "aps_badilag_vs";
const timpa = process.env.TIMPA ? JSON.parse(fs.readFileSync(process.env.TIMPA, "utf8")) : {};
const pool = mysql.createPool({ host: "127.0.0.1", user: "root", database: SIPP, connectionLimit: 1, charset: "latin1_swedish_ci" });
function kueri(sql, params, opsi) {
  const teks = String(sql).replace(/\baps_badilag\./g, `${ABT}.`);
  return new Promise((ok, gagal) =>
    pool.query({ sql: teks, values: params || [], timeout: (opsi && opsi.timeoutMs) || 120000, typeCast: (f) => f.string() }, (g, r) => (g ? gagal(g) : ok(r)))
  );
}
(async () => {
  const timpaKatalog = Object.fromEntries(Object.entries(timpa).map(([k, v]) => [k, { sql_query: v }]));
  for (const pid of daftarPid.split(",")) {
    for (const no of daftarNo.split(",")) {
      const mesin = buatMesin({ kueri, skemaAbt: ABT, umurKatalogMs: 3600 * 1000, batasKueriMs: 120000, timpaKatalog });
      await mesin.nilaiPenanda({ perkaraId: pid }, ["0001"]); // katalog dimuat dulu (tidak ikut diukur)
      const t0 = Date.now();
      const p = await mesin.nilaiPenanda({ perkaraId: pid }, [no]);
      const v = p.get(no) || {};
      console.log([pid, no, Date.now() - t0, v.status, JSON.stringify(String(v.polos || v.sebab || "").slice(0, 300))].join("\t"));
    }
  }
  pool.end();
})();
