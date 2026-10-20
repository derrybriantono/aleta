// Memvalidasi KESELURUHAN rantai usulan Blangko Derry (dariSipp + posita-lain) untuk jenis S5 terhadap isian MANUSIA di ABT lokal
// (aps_badilag.abt_data_teks, hanya yang diubah sebelum 1 Sep 2026). Hasil per kode dan per tingkat keyakinan: dasar menaikkan
// "ragu" menjadi "cukup" hanya bila presisi >= 0,9 dengan n >= 10. BACA SAJA.
//   node scripts/isi-sipp-abt/validasi-rantai-s5-20okt.cjs [--akar <repo>] [--dari 2015-01-01] [--jenis 362,354,...] [--salah]
const path = require("path");
const { createRequire } = require("module");
const arg = (n, b) => {
  const i = process.argv.indexOf(n);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : b;
};
const akar = path.resolve(arg("--akar", path.resolve(__dirname, "..", "..")));
const dari = arg("--dari", "2015-01-01");
const JENIS = arg("--jenis", "362,354,358,363,371").split(",").map(Number);
const tampilSalah = process.argv.includes("--salah");
process.env.ALETA_BOT_DB_SIPP_NAME = "sipp_donggala";
process.env.ALETA_BOT_DB_USER = "root";
process.env.ALETA_BOT_DB_SIPP_HOST = "127.0.0.1";
const mysql = createRequire(path.join(akar, "aleta_bot", "package.json"))("mysql");
const { kumpulUsulan } = require("./rantai-usulan-s5.cjs")(akar);
const B = require(path.join(akar, "aleta_bot", "services", "isiOtomatisS5", "bantu.js"));
require(path.join(akar, "ekstensi-sipp", "isi-sipp-bersama.js"));
const mesin = globalThis.AletaIsiSipp;
const buat = (db) => {
  const k = mysql.createConnection({ host: "127.0.0.1", user: "root", database: db, typeCast: (f) => f.string() });
  return [k, (s, p) => new Promise((ok, g) => k.query(s, p || [], (e, r) => (e ? g(e) : ok(r))))];
};
const nrm = B.normal;
const angka = (t) => {
  const m = /\d+/.exec(String(t || ""));
  return m ? Number(m[0]) : null;
};
const NAMA = ["0600", "0606", "1029", "1217", "1551", "1552", "0650", "0651", "1025", "8610", "8608"];
const UMUR = ["0601", "0607", "1030", "7211", "7212"];
const TANGGAL = ["0349", "1230", "1246", "5197"];
const tanggalIso = (t) => (/^\d{2}\/\d{2}\/\d{4}$/.test(t) ? t.split("/").reverse().join("-") : /^\d{4}-\d{2}-\d{2}/.test(t) ? t.slice(0, 10) : B.indonesiaKeIso(t));
function cocok(kode, a, h) {
  if (!a || !h) return false;
  if (NAMA.includes(kode)) return B.samaNama(a, h) || nrm(h).includes(nrm(a)) || nrm(a).includes(nrm(h));
  if (UMUR.includes(kode)) return angka(a) !== null && angka(a) === angka(h);
  if (TANGGAL.includes(kode)) return Boolean(tanggalIso(a)) && tanggalIso(a) === tanggalIso(h);
  const na = nrm(a);
  const nh = nrm(h);
  if (na === nh || nh.includes(na) || na.includes(nh)) return true;
  const sa = new Set(na.split(" "));
  const sh = new Set(nh.split(" "));
  let irisan = 0;
  for (const x of sa) if (sh.has(x)) irisan += 1;
  return irisan / Math.max(1, Math.min(sa.size, sh.size)) >= 0.7;
}
(async () => {
  const [k1, q] = buat("sipp_donggala");
  const [k2, qa] = buat("aps_badilag");
  const ps = await q(`SELECT perkara_id, nomor_perkara, jenis_perkara_id j, alur_perkara_id a, posita, petitum FROM perkara WHERE jenis_perkara_id IN (${JENIS.join(",")}) AND tanggal_pendaftaran >= ?`, [dari]);
  const rekap = {};
  const salah = [];
  for (const p of ps) {
    const sumber = await kumpulUsulan(p);
    const pilih = mesin.pilihPerKode(sumber, null);
    const human = Object.fromEntries((await qa("SELECT no_var, data FROM abt_data_teks WHERE perkara_id = ? AND modified < '2026-09-01' AND data IS NOT NULL AND data <> ''", [p.perkara_id])).map((x) => [String(Number(x.no_var)).padStart(4, "0"), x.data]));
    for (const [kode, u] of pilih) {
      if (!String(u.nilai || "").trim() || !human[kode]) continue;
      const kunci = `${p.j}|${kode}|${u.keyakinan}`;
      const r = (rekap[kunci] = rekap[kunci] || { n: 0, benar: 0 });
      r.n += 1;
      if (cocok(kode, String(u.nilai), String(human[kode]))) r.benar += 1;
      else salah.push(`${p.nomor_perkara} ${kode} [${u.keyakinan}] mesin="${String(u.nilai).slice(0, 60)}" | manusia="${String(human[kode]).replace(/\s+/g, " ").slice(0, 60)}"`);
    }
  }
  for (const [k, r] of Object.entries(rekap).sort()) console.log(`${k.padEnd(24)} n ${String(r.n).padStart(3)} benar ${String(r.benar).padStart(3)} (${Math.round((r.benar / r.n) * 100)}%)`);
  if (tampilSalah) console.log(salah.join("\n"));
  k1.end();
  k2.end();
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
