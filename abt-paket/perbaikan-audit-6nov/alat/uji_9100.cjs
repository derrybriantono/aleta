// Uji #9100# (hari dan tanggal pengumuman): kosong -> titik-titik; terisi -> "Hari tanggal D Bulan YYYY". Menulis SATU baris sementara ke skema uji aps_badilag_w223 (milik pekerjaan ini) lalu menghapusnya.
const { createRequire } = require("module");
const req = createRequire("D:/aleta-dev/wt/w33/aleta_bot/package.json");
const mysql = req("mysql");
const { buatMesin } = require("D:/aleta-dev/wt/w223/aleta_bot/services/abtMesinVariabel.js");
const ABT = "aps_badilag_w223";
const kolam = mysql.createPool({ host: "127.0.0.1", user: "root", database: "sipp_vs", connectionLimit: 2, dateStrings: true });
const kueri = (sql, params) => new Promise((a, b) => kolam.query({ sql: String(sql).split("aps_badilag.").join(`${ABT}.`), values: params || [], timeout: 60000 }, (e, r) => (e ? b(e) : a(r))));
(async () => {
  const baris = await kueri(`SELECT no_var, nama, data_type, data_tabel, data_kolom, urutan_data, referensi, sql_query, default_data, multi_sidang FROM ${ABT}.abt_variabel`);
  const pustaka = {};
  const alias = {};
  for (const b of baris) {
    const no = String(b.no_var);
    const kode = `AA${no.padStart(5, "0")}`;
    pustaka[no] = { ...b, kode };
    alias[kode] = no;
  }
  const mesin = buatMesin({ kueri, skemaAbt: ABT, umurKatalogMs: 1, batasKueriMs: 60000, jalurAleta: { pustaka, alias } });
  const pid = "8136";
  const baca = async () => {
    const v = (await mesin.nilaiPenanda({ perkaraId: pid }, ["9100"])).get("9100");
    return { status: v.status, polos: v.polos };
  };
  const sebelum = await kueri(`SELECT COUNT(*) n FROM ${ABT}.abt_data_tanggal WHERE no_var = 303 AND perkara_id = ?`, [pid]);
  console.log("baris 303 sebelum:", sebelum[0].n);
  console.log("KOSONG :", JSON.stringify(await baca()));
  try {
    await kueri(`INSERT INTO ${ABT}.abt_data_tanggal (perkara_id, no_var, data) VALUES (?, 303, '2026-11-05')`, [pid]);
    console.log("TERISI :", JSON.stringify(await baca()));
  } finally {
    await kueri(`DELETE FROM ${ABT}.abt_data_tanggal WHERE perkara_id = ? AND no_var = 303 AND data = '2026-11-05'`, [pid]);
  }
  const sesudah = await kueri(`SELECT COUNT(*) n FROM ${ABT}.abt_data_tanggal WHERE no_var = 303 AND perkara_id = ?`, [pid]);
  console.log("baris 303 sesudah:", sesudah[0].n);
  kolam.end();
})().catch((e) => {
  console.error(e.message);
  kolam.end();
  process.exit(1);
});
