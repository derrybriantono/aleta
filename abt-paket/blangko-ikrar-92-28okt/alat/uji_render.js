"use strict";
/**
 * Uji render blangko ikrar (paket abt-blangko-ikrar-92-28okt) dengan MESIN VARIABEL ALETA yang sama dengan
 * e-Doc ikrar (aleta_bot/services/abtMesinVariabel.js, jembatan "blangko.isi"), atas MySQL LAPTOP - BACA SAJA:
 *   SIPP  = sipp_donggala (salinan satker s.d. 9 Okt 2026), katalog variabel = basis uji ABT_DB (salinan server).
 * Pakai (dari folder repo, NODE_PATH = node_modules bot):
 *   ABT_DB=aps_badilag_ikrar BLANGKO=D:/b92 node abt-paket/blangko-ikrar-92-28okt/alat/uji_render.js 9596:92:3 8770:91 9812:90a
 * Tiap argumen perkara_id:kode blangko[:urutan sidang]. Keluaran: jumlah terisi, isian KOSONG (yang menahan unggah e-Doc), galat mesin,
 * dan penanda mentah yang tersisa. Tidak menulis apa pun.
 */
const fs = require("fs");
const path = require("path");
const mysql = require("mysql");
const { buatMesin } = require(path.join(__dirname, "..", "..", "..", "aleta_bot", "services", "abtMesinVariabel"));

const BERKAS = {
  90: "[90] [Ikrar] Penetapan Ikrar Talak - P Hadir & T Tidak Hadir.rtf",
  "90a": "[90a] [Ikrar] Penetapan Ikrar Talak - P & T Hadir.rtf",
  91: "[91] [Ikrar Gugur] Penetapan Kekuatan Putusan Gugur - P Tidak Ikrar 6 Bulan.rtf",
  92: "[92] [Ikrar Rukun] Penetapan Rukun Kembali - P Hadir & T Tidak Hadir.rtf",
  "92a": "[92a] [Ikrar Rukun] Penetapan Rukun Kembali - P & T Hadir.rtf",
};
const AKAR = process.env.BLANGKO || "D:/b92";
const pool = mysql.createPool({ host: "127.0.0.1", user: "root", database: process.env.SIPP_DB || "sipp_donggala", connectionLimit: 4, charset: "latin1_swedish_ci" });
const kueri = (sql, params) =>
  new Promise((ok, gagal) =>
    pool.query({ sql: typeof sql === "string" ? sql : sql.sql, timeout: 60000, typeCast: (f) => f.string() }, params || [], (g, h) =>
      g ? gagal(g) : ok(h)
    )
  );
// Penjaga baca saja: perintah tulis ditolak sebelum sampai ke basis data.
const kueriBaca = (sql, params) => {
  const teks = typeof sql === "string" ? sql : String((sql && sql.sql) || "");
  if (/^\s*(INSERT|UPDATE|DELETE|REPLACE|CREATE|DROP|ALTER|CALL)\b/i.test(teks)) return Promise.reject(new Error("tulis ditolak (uji baca saja)"));
  return kueri(sql, params);
};

async function main() {
  const mesin = buatMesin({ kueri: kueriBaca, skemaAbt: process.env.ABT_DB || "aps_badilag_ikrar" });
  for (const arg of process.argv.slice(2)) {
    // perkara_id:kode[:urutan sidang ikrar] - e-Doc ikrar mengisi blangko pada sidang ikrar itu (sidangKe = urutan).
    const [pid, kode, urutan] = arg.split(":");
    const nama = BERKAS[kode];
    const rtf = fs.readFileSync(path.join(AKAR, "derry_briantono", "1a Perceraian CT", nama), "latin1");
    const h = await mesin.isiRtf(rtf, { perkaraId: Number(pid), sidangKe: Number(urutan) || 0, timpa: {}, cadangan: {} });
    const mentah = [...new Set((h.rtf.match(/#\d{4}#/g) || []))];
    console.log(
      `perkara ${pid} [${kode}]: terisi ${h.terisi.length}, kosong ${h.kosong.length}${h.kosong.length ? ` (${h.kosong.map((k) => `#${k.noVar}# ${k.nama || ""}`).join("; ")})` : ""}, galat ${
        (h.mesinGalat || []).length || 0
      }, mentah ${mentah.length ? mentah.join(" ") : 0}, aleta ${/aleta/i.test(h.rtf) ? "ADA" : 0}`
    );
    if (process.env.KELUAR) fs.writeFileSync(path.join(process.env.KELUAR, `${pid}-${kode}.rtf`), h.rtf, "latin1");
  }
  pool.end();
}
main().catch((e) => {
  console.error("GAGAL", e && e.message);
  pool.end();
  process.exit(1);
});
