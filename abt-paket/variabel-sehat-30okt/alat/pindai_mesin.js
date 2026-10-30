"use strict";
/**
 * Pindai LUAS keluaran variabel Blangko Derry atas banyak perkara lewat mesin variabel bot (aleta_bot/services/abtMesinVariabel.js:
 * tiruan setia ABT, HANYA MEMBACA - tiap kueri lewat pagarBaca, urutan sidang dihitung, tidak ditulis). Hasil diperiksa ulang
 * dengan renderer php56 ABT asli untuk contoh tiap temuan (render.py).
 *
 * pakai: NODE_PATH=<aleta_bot/node_modules> node pindai_mesin.js <pakai.json> <sampel.tsv> <keluar-dir> [mulai] [akhir]
 *   env: SIPP_DB (bawaan sipp_vs), ABT_DB (bawaan aps_badilag_vs; teks "aps_badilag." di kueri katalog diarahkan ke salinan ini)
 * Keluar: <keluar-dir>/p<perkara_id>.json  {perkara, detik, nilai: {no: [status, polos<=400, sebab<=160]}, lambat: [[ms, sql<=300]]}
 * Hanya variabel yang folder blangkonya cocok dengan jenis perkara (atau folder umum) dihitung untuk perkara itu.
 * Perkara yang sudah ada berkasnya dilewati (boleh dihentikan dan diulang).
 */
const fs = require("fs");
const path = require("path");
const mysql = require("mysql");
const { buatMesin } = require(path.join(__dirname, "..", "..", "..", "aleta_bot", "services", "abtMesinVariabel.js"));

const [pakaiF, sampelF, keluar, mulai = "0", akhir = "100000"] = process.argv.slice(2);
const SIPP = process.env.SIPP_DB || "sipp_vs";
const ABT = process.env.ABT_DB || "aps_badilag_vs";
const pakai = JSON.parse(fs.readFileSync(pakaiF, "utf8"));
const JENIS = new Set(["data_sql", "data_sipp", "data_teks", "data_tanggal", "terbilang", "tanggal_hari", "tanggal_hijriah"]);
const kode = Object.keys(pakai).filter((k) => JENIS.has(pakai[k].jenis)).sort((a, b) => Number(a) - Number(b));
/** Folder blangko -> awalan jenis perkara SIPP (sama dengan analisa.py); folder lain = umum (semua perkara). */
const FOLDER = [
  [/^1 Perceraian CG|^1c |^1d |^1e |^1f |^- BAS (CONTRA|VERSTEK) PERCERAIAN/, ["Cerai Gugat", "Cerai Talak"]],
  [/^1a Perceraian CT/, ["Cerai Talak"]], [/^2 Itsbat|^2a Itsbat/, ["Pengesahan Perkawinan"]],
  [/^3 Dispensasi/, ["Dispensasi Kawin"]], [/^3a Izin/, ["Izin Kawin"]], [/^4a Harta/, ["Harta Bersama"]], [/^4b Kewarisan/, ["Kewarisan"]],
  [/^4c Wasiat/, ["Wasiat"]], [/^4d Hibah/, ["Hibah"]], [/^4e Wakaf/, ["Wakaf"]], [/^5 Izin Poligami/, ["Izin Poligami"]],
  [/^5a /, ["Pembatalan Perkawinan"]], [/^5b /, ["Pencegahan"]], [/^5c /, ["Penolakan"]], [/^5d /, ["Perkawinan Campuran"]],
  [/^6 Perwalian/, ["Perwalian"]], [/^6[a-h] /, ["Lain-Lain", "Hak Asuh", "Penguasaan Anak", "Nafkah Anak", "Pencabutan", "Penunjukan", "Ganti Rugi"]],
  [/^7 Wali/, ["Wali Adhol"]], [/^8 Asal|^- BAS ASAL/, ["Asal Usul Anak"]], [/^8a /, ["Pengesahan Anak", "Lain-Lain"]],
  [/^9 Penetapan Ahli Waris/, ["P3HP"]], [/^9a /, ["Lain-Lain", "Pengangkatan Anak"]], [/^9c /, ["Lain-Lain", "Mafqud"]],
  [/^10 Ekonomi|^10a Ekonomi/, ["Ekonomi Syariah"]],
];
function relevan(folder, jenis) {
  for (const f of folder || []) {
    let dikenal = false;
    for (const [pola, js] of FOLDER) {
      if (pola.test(f)) {
        dikenal = true;
        if (js.some((j) => jenis.startsWith(j))) return true;
      }
    }
    if (!dikenal) return true;
  }
  return false;
}
const sampel = fs.readFileSync(sampelF, "utf8").split(/\r?\n/).filter((l) => l.trim() && !l.startsWith("#")).map((l) => l.split("\t"));
fs.mkdirSync(keluar, { recursive: true });

// Semua kolom sebagai teks (seperti mysqli PHP ABT): tanggal "1997-10-31", bukan objek Date.
const pool = mysql.createPool({ host: "127.0.0.1", user: "root", database: SIPP, connectionLimit: Number(process.env.SAMBUNGAN || 4), charset: "latin1_swedish_ci", multipleStatements: false });
let lambat = [];
function kueri(sql, params, opsi) {
  const teks = String(sql).replace(/\baps_badilag\./g, `${ABT}.`);
  // Waktu diukur sejak sambungan didapat (antrean kolam tidak ikut dihitung).
  return new Promise((ok, gagal) => {
    pool.getConnection((gs, sam) => {
      if (gs) return gagal(gs);
      const t0 = Date.now();
      sam.query({ sql: teks, values: params || [], timeout: (opsi && opsi.timeoutMs) || 30000, typeCast: (f) => f.string() }, (g, rows) => {
        const ms = Date.now() - t0;
        if (g && g.fatal) sam.destroy();
        else sam.release();
        if (ms > 5000) lambat.push([ms, teks.replace(/\s+/g, " ").slice(0, 300)]);
        if (g) gagal(g);
        else ok(rows);
      });
    });
  });
}

(async () => {
  const daftar = sampel.slice(Number(mulai), Number(akhir));
  for (const [pid, gol, jenis, alur] of daftar) {
    const f = path.join(keluar, `p${pid}.json`);
    if (fs.existsSync(f)) continue;
    lambat = [];
    const t0 = Date.now();
    const mesin = buatMesin({ kueri, skemaAbt: ABT, umurKatalogMs: 3600 * 1000, batasKueriMs: 30000 });
    const nilai = {};
    const kodeIni = process.env.SEMUA === "1" ? kode : kode.filter((k) => relevan(pakai[k].folder, jenis));
    for (let i = 0; i < kodeIni.length; i += 150) {
      const potong = kodeIni.slice(i, i + 150);
      let p;
      try {
        p = await mesin.nilaiPenanda({ perkaraId: pid, sidangKe: 0 }, potong);
      } catch (g) {
        p = new Map(potong.map((no) => [no, { status: "galat", sebab: String((g && g.message) || g), polos: "" }]));
      }
      for (const no of potong) {
        const v = p.get(no) || {};
        nilai[no] = [v.status || "?", String(v.polos || "").slice(0, 400), String(v.sebab || "").slice(0, 160)];
      }
    }
    const detik = Math.round((Date.now() - t0) / 1000);
    fs.writeFileSync(f, JSON.stringify({ perkara: pid, gol, jenis, alur, detik, nilai, lambat }));
    console.log(pid, jenis, gol, "detik", detik, "lambat", lambat.length);
  }
  pool.end();
})().catch((g) => {
  console.error("GAGAL", g);
  process.exit(1);
});
