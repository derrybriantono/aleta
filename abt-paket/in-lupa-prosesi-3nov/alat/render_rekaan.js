"use strict";
/**
 * Render REKAAN blangko [01f] (paket abt-in-lupa-prosesi-3nov) dengan MESIN VARIABEL ALETA (aleta_bot/services/abtMesinVariabel.js)
 * atas MySQL LAPTOP - BACA SAJA. Kerangka perkara = perkara itsbat laptop (sipp_w180), tetapi SEMUA isian yang memuat data
 * orang/perkara ditimpa nilai REKAAN (opsi.timpa menang atas SIPP/ABT). Sesudah render, nama pihak, saksi, hakim, panitera,
 * dan nomor perkara asli dibaca dari SIPP dan DICARI di hasil: ada satu saja = GAGAL (berkas tidak ditulis).
 * Pakai (dari akar repo, NODE_PATH = node_modules bot):
 *   SIPP_DB=sipp_w180 ABT_DB=aps_badilag_w180d node abt-paket/in-lupa-prosesi-3nov/alat/render_rekaan.js <rtf blangko> <rtf keluar> [perkara_id]
 */
const fs = require("fs");
const path = require("path");
const mysql = require("mysql");
const { buatMesin } = require(path.join(__dirname, "..", "..", "..", "aleta_bot", "services", "abtMesinVariabel"));

const [masuk, keluar, pidArg] = process.argv.slice(2);
const PID = Number(pidArg || 10041);
const pool = mysql.createPool({ host: "127.0.0.1", user: "root", database: process.env.SIPP_DB || "sipp_w180", connectionLimit: 4, charset: "latin1_swedish_ci" });
const kueri = (sql, params) =>
  new Promise((ok, gagal) =>
    pool.query({ sql: typeof sql === "string" ? sql : sql.sql, timeout: 60000, typeCast: (f) => f.string() }, params || [], (g, h) => (g ? gagal(g) : ok(h)))
  );
const kueriBaca = (sql, params) => {
  const teks = typeof sql === "string" ? sql : String((sql && sql.sql) || "");
  if (/^\s*(INSERT|UPDATE|DELETE|REPLACE|CREATE|DROP|ALTER|CALL)\b/i.test(teks)) return Promise.reject(new Error("tulis ditolak (uji baca saja)"));
  return kueri(sql, params);
};

const KET_SAKSI = (nama, hubungan) =>
  `- Bahwa saksi kenal dengan para Pemohon karena saksi adalah ${hubungan} Pemohon I;\n` +
  "- Bahwa saksi menghadiri pesta pernikahan para Pemohon pada tahun 2010, tetapi saksi tidak mengikuti acara akad nikahnya;\n" +
  "- Bahwa karena tidak mengikuti akad nikah, saksi tidak tahu siapa wali nikahnya, bagaimana lafal ijab kabulnya, berapa maharnya, dan siapa saksi nikahnya;\n" +
  "- Bahwa sejak menikah para Pemohon tinggal bersama sebagai suami istri dan sudah mempunyai anak;\n" +
  "- Bahwa selama ini tidak ada orang yang keberatan atas pernikahan para Pemohon;\n" +
  `- Bahwa para Pemohon tidak pernah bercerai dan tetap beragama Islam (${nama});`;

// Nilai REKAAN untuk semua isian bermuatan data orang/perkara.
const REKAAN = {
  "0001": "123/Pdt.P/2026/PA.Rkn",
  "0017": "5 Oktober 2026",
  "0306": "6 Oktober 2026",
  "0033": "3 November 2026",
  "0032": "Selasa",
  "8184": "12 Jumadil Awal 1448",
  "0098": "Ahmad Rekaan bin Umar Rekaan",
  "1033": "Siti Contoh binti Hasan Contoh",
  "7047": "Ahmad Rekaan bin Umar Rekaan, umur 40 tahun, agama Islam, pekerjaan Petani, tempat tinggal di Desa Contoh, Kecamatan Contoh, Kabupaten Contoh, sebagai Pemohon I;\nSiti Contoh binti Hasan Contoh, umur 36 tahun, agama Islam, pekerjaan Mengurus Rumah Tangga, tempat tinggal di Desa Contoh, Kecamatan Contoh, Kabupaten Contoh, sebagai Pemohon II;",
  "9250": "1. Bahwa para Pemohon telah menikah menurut agama Islam pada tanggal 10 Juni 2010 di Desa Contoh, tetapi tidak dicatat di Kantor Urusan Agama;\n2. Bahwa para Pemohon membutuhkan penetapan pengesahan nikah untuk mengurus Buku Nikah;\n",
  "9251": "1. Mengabulkan permohonan para Pemohon;\n2. Menyatakan sah perkawinan para Pemohon;\n3. Membebankan biaya perkara sesuai hukum;\n",
  "0007": "telah dikaruniai 2 (dua) orang anak yang bernama Anak Rekaan Satu, Anak Rekaan Dua",
  "5197": "10 Juni 2010",
  "5105": "Desa Contoh, Kecamatan Contoh, Kabupaten Contoh",
  "5178": "Kantor Urusan Agama Kecamatan Contoh",
  "1046": "Umar Wali (ayah kandung Pemohon II)",
  "8087": "Imam Rekaan",
  "0650": "Saksi Nikah Satu",
  "0651": "Saksi Nikah Dua",
  "1001": "seperangkat alat salat dibayar tunai",
  "1002": "Jejaka",
  "1003": "Perawan",
  "1197": "Budi Rekaan bin Darto",
  "1198": "45",
  "1199": "Islam",
  "1200": "SMA",
  "1201": "Petani",
  "1202": "Desa Contoh, Kecamatan Contoh, Kabupaten Contoh",
  "1241": "tetangga Pemohon I",
  "9259": KET_SAKSI("saksi 1", "tetangga"),
  "1203": "Wati Contoh binti Karim",
  "1204": "50",
  "1205": "Islam",
  "1206": "SD",
  "1207": "Mengurus Rumah Tangga",
  "1208": "Desa Contoh, Kecamatan Contoh, Kabupaten Contoh",
  "1242": "bibi Pemohon II",
  "9260": KET_SAKSI("saksi 2", "kerabat"),
  "8004": "Panitera Rekaan, S.H.",
  "8500": "Hakim,\n\nHakim Rekaan, S.H.I., M.H.\n\nPanitera Pengganti,\n\nPP Rekaan, S.H.\n",
  "8501": "Demikian ditetapkan dalam sidang yang dilangsungkan",
  "8502": "oleh Hakim Rekaan, S.H.I., M.H. sebagai Hakim, penetapan tersebut diucapkan dalam sidang terbuka untuk umum oleh Hakim tersebut dengan didampingi PP Rekaan, S.H. sebagai Panitera Pengganti serta dihadiri oleh para Pemohon.",
  "8554": "Hakim",
};

async function main() {
  const mesin = buatMesin({ kueri: kueriBaca, skemaAbt: process.env.ABT_DB || "aps_badilag_w180d" });
  const rtf = fs.readFileSync(masuk, "latin1");
  const h = await mesin.isiRtf(rtf, { perkaraId: PID, sidangKe: 1, timpa: REKAAN, cadangan: {} });
  const mentah = [...new Set(h.rtf.match(/#\d{4,5}#/g) || [])];
  // Data asli perkara kerangka - tidak boleh tersisa di hasil.
  const asli = new Set();
  const tambah = (rows) => rows.forEach((r) => Object.values(r).forEach((v) => v && String(v).trim().length >= 4 && asli.add(String(v).trim())));
  tambah(await kueri("SELECT nomor_perkara FROM perkara WHERE perkara_id = ?", [PID]));
  for (const t of ["perkara_pihak1", "perkara_pihak2", "perkara_pihak5"]) {
    try {
      tambah(await kueri(`SELECT nama, alamat FROM ${t} WHERE perkara_id = ?`, [PID]));
    } catch (_) {}
  }
  try {
    tambah(await kueri("SELECT hakim_nama FROM perkara_hakim_pn WHERE perkara_id = ?", [PID]));
    tambah(await kueri("SELECT panitera_nama FROM perkara_panitera_pn WHERE perkara_id = ?", [PID]));
  } catch (_) {}
  const polos = h.rtf.replace(/\\'([0-9a-f]{2})/gi, (_, x) => String.fromCharCode(parseInt(x, 16)));
  const bocor = [...asli].filter((n) => polos.includes(n) || polos.toLowerCase().includes(n.toLowerCase()));
  console.log(
    `perkara kerangka ${PID}: terisi ${h.terisi.length}, kosong ${h.kosong.length}${h.kosong.length ? ` (${h.kosong.map((k) => `#${k.noVar}#`).join(" ")})` : ""}, ` +
      `galat ${(h.mesinGalat || []).length}, mentah ${mentah.length ? mentah.join(" ") : 0}, aleta ${/aleta/i.test(h.rtf) ? "ADA" : 0}, ` +
      `data asli diperiksa ${asli.size}, bocor ${bocor.length}`
  );
  if (bocor.length) {
    console.log("GAGAL: data asli masih ada di hasil - berkas tidak ditulis");
    process.exitCode = 1;
  } else {
    fs.writeFileSync(keluar, h.rtf, "latin1");
    console.log("TULIS " + keluar);
  }
  pool.end();
}
main().catch((e) => {
  console.error(e);
  pool.end();
  process.exitCode = 1;
});
