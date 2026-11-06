// Mengisi RTF blangko dengan MESIN SUNGGUHAN (aleta_bot/services/abtMesinVariabel.js worktree ini) atas salinan uji, satu perkara per berkas.
// Hanya membaca basis data. Keluaran: RTF terisi di folder keluar (lokal, TIDAK ikut paket) dan satu ringkasan JSON tanpa data pihak.
// pakai: node render_semua.cjs <daftar.txt> <folder-keluar> <ringkasan.json> [nama-skema-abt]
const { createRequire } = require("module");
const fs = require("fs");
const path = require("path");
const req = createRequire("D:/aleta-dev/wt/w33/aleta_bot/package.json");
const mysql = req("mysql");
const { buatMesin } = require("D:/aleta-dev/wt/w223/aleta_bot/services/abtMesinVariabel.js");
const [, , daftarF, keluar, ringF, skema] = process.argv;
const SIPP = "sipp_vs";
const ABT = skema || "aps_badilag_w223";
const kolam = mysql.createPool({ host: "127.0.0.1", user: "root", database: SIPP, connectionLimit: 3, dateStrings: true });
const kueri = (sql, params, opsi) =>
  new Promise((a, b) => kolam.query({ sql: String(sql).split("aps_badilag.").join(`${ABT}.`), values: params || [], timeout: (opsi && opsi.timeoutMs) || 120000 }, (e, r) => (e ? b(e) : a(r))));

const perkaraTsv = fs
  .readFileSync("D:/aleta-dev/kerja/aleta-abt/t8/perkara.tsv", "utf8")
  .split(/\r?\n/)
  .filter((l) => l.trim() && !l.startsWith("#"))
  .map((l) => l.split("\t"));
const pidDari = (kel) => (perkaraTsv.find((r) => r[2] === kel) || perkaraTsv.find((r) => r[2] === "cerai-gugat"))[0];
function keluarga(folder) {
  const f = folder.replace(/\s*-\s*BAS$/, "");
  if (/^1a /.test(f) || /^ALUR 10/.test(f)) return "cerai-talak";
  if (/^1c /.test(f)) return "cerai-kumulasi-itsbat";
  if (/^2a?\s/.test(f) && /Itsbat/.test(f)) return "itsbat-nikah";
  if (/^3 /.test(f)) return "dispensasi-kawin";
  if (/^4a /.test(f)) return "harta-bersama";
  if (/^4b /.test(f)) return "kewarisan";
  if (/^5 /.test(f)) return "izin-poligami";
  if (/^6 /.test(f)) return "perwalian";
  if (/^6[abch] /.test(f)) return "hak-asuh-anak";
  if (/^7 /.test(f)) return "wali-adhal";
  if (/^8 /.test(f)) return "asal-usul-anak";
  if (/^9 /.test(f)) return "ahli-waris";
  if (/^10a? /.test(f)) return "ekonomi-syariah";
  return "cerai-gugat";
}

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
  const mesin = buatMesin({ kueri, skemaAbt: ABT, umurKatalogMs: 3600000, batasKueriMs: 120000, jalurAleta: { pustaka, alias } });
  const daftar = fs.readFileSync(daftarF, "utf8").split(/\r?\n/).filter(Boolean);
  fs.mkdirSync(keluar, { recursive: true });
  const ring = [];
  let i = 0;
  for (const berkas of daftar) {
    i += 1;
    const jalur = berkas.replace(/\\/g, "/");
    const bagian = jalur.split("/derry_briantono/")[1];
    const folder = bagian.split("/")[0];
    const kel = keluarga(folder);
    const pid = pidDari(kel);
    const rtf = fs.readFileSync(berkas, "latin1");
    const mulai = Date.now();
    let r;
    try {
      const h = await mesin.isiRtf(rtf, { perkaraId: String(pid), tanpaSorotKosong: true });
      const nama = String(i).padStart(3, "0") + ".rtf";
      fs.writeFileSync(path.join(keluar, nama), h.rtf, "latin1");
      const takada = (h.kosong || []).filter((k) => k.status === "takada").map((k) => k.noVar);
      const galat = (h.kosong || []).filter((k) => k.status === "galat").map((k) => k.noVar);
      r = { n: i, berkas: bagian, kel, terisi: h.jumlahTerisi, kosong: (h.kosong || []).map((k) => k.noVar), takada, galat, mesinGalat: h.mesinGalat || "", ms: Date.now() - mulai, keluar: nama };
    } catch (e) {
      r = { n: i, berkas: bagian, kel, galatProses: String(e.message).slice(0, 200) };
    }
    ring.push(r);
    if (i % 10 === 0) console.log(i, "/", daftar.length);
  }
  fs.writeFileSync(ringF, JSON.stringify(ring));
  console.log("SELESAI", ring.length, "takada", ring.filter((x) => x.takada && x.takada.length).length, "galat", ring.filter((x) => (x.galat && x.galat.length) || x.mesinGalat || x.galatProses).length);
  kolam.end();
})().catch((e) => {
  console.error(e.message);
  kolam.end();
  process.exit(1);
});
