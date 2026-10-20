// Memvalidasi penggolongan ahli waris (isiOtomatisS5/ahliWaris.js) terhadap AMAR putusan SIPP yang menyebut hubungan tiap ahli waris
// ("3.1. Sagap bin Jamal (Pemohon I), anak kandung Pewaris"). BACA SAJA (sipp_donggala lokal).
//   node scripts/isi-sipp-abt/validasi-ahli-waris-s5.cjs [--akar <repo>] [--dari 2015-01-01] [--salah]
const path = require("path");
const { createRequire } = require("module");
const arg = (n, b) => {
  const i = process.argv.indexOf(n);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : b;
};
const akar = path.resolve(arg("--akar", path.resolve(__dirname, "..", "..")));
const dari = arg("--dari", "2015-01-01");
const tampilSalah = process.argv.includes("--salah");
process.env.ALETA_BOT_DB_SIPP_NAME = "sipp_donggala";
process.env.ALETA_BOT_DB_USER = "root";
process.env.ALETA_BOT_DB_SIPP_HOST = "127.0.0.1";
const mysql = createRequire(path.join(akar, "aleta_bot", "package.json"))("mysql");
const S5 = require(path.join(akar, "aleta_bot", "services", "isiOtomatisJenisS5.js"));
const PAW = require(path.join(akar, "aleta_bot", "services", "isiOtomatisS5", "ahliWaris.js"));
const B = require(path.join(akar, "aleta_bot", "services", "isiOtomatisS5", "bantu.js"));
const kon = mysql.createConnection({ host: "127.0.0.1", user: "root", database: "sipp_donggala", typeCast: (f) => f.string() });
const q = (s, p) => new Promise((ok, g) => kon.query(s, p || [], (e, r) => (e ? g(e) : ok(r))));
const GOL = [
  [/\banak\b/i, "anak"],
  [/\b(?:isteri|istri|suami)\b/i, "pasangan"],
  [/\b(?:saudara|kakak|adik)\b/i, "saudara"],
  [/\bibu\b/i, "ibu"],
  [/\b(?:ayah|bapak)\b/i, "ayah"],
];
const golDari = (t) => {
  for (const [re, g] of GOL) if (re.test(t)) return g;
  return "";
};

/** Amar -> [{nama, gol}] dari butir "3.1. Nama (Pemohon I), anak kandung Pewaris". */
function ahliWarisAmar(amar) {
  const t = B.polos(amar);
  const mulai = t.search(/Menetapkan\s+ahli\s+waris/i);
  if (mulai < 0) return [];
  let sisa = t.slice(mulai);
  const akhir = sisa.search(/\s\d{1,2}\s*\.\s*(?:Menyatakan|Membebankan|Menetapkan\s+(?:Para|Pemohon|biaya))/i);
  if (akhir > 0) sisa = sisa.slice(0, akhir);
  const hasil = [];
  const re = /\d{1,2}\.\d{1,2}\.?\s+(.+?)(?=\s+\d{1,2}\.\d{1,2}\.?\s|$)/g;
  let m;
  while ((m = re.exec(sisa)) !== null) {
    const butir = m[1];
    const gol = golDari(butir.replace(/\(Pemohon[^)]*\)/gi, ""));
    const nama = butir.replace(/\s*\([^)]*\)/g, " ").split(/,|\s+(?:anak|isteri|istri|suami|ibu|ayah|saudara)\b/i)[0].trim();
    if (nama.length >= 3 && gol) hasil.push({ nama, gol });
  }
  return hasil;
}

(async () => {
  const ps = await q(
    `SELECT p.perkara_id, p.nomor_perkara, pp.amar_putusan FROM perkara p JOIN perkara_putusan pp ON pp.perkara_id = p.perkara_id
      WHERE p.jenis_perkara_id = 371 AND p.tanggal_pendaftaran >= ? AND pp.amar_putusan LIKE '%ahli waris%'`,
    [dari]
  );
  const st = { perkara: 0, heir: 0, tergolong: 0, benar: 0, salah: 0, sisa: 0 };
  const per = {};
  const salah = [];
  for (const p of ps) {
    const emas = ahliWarisAmar(p.amar_putusan);
    if (!emas.length) continue;
    const d = await S5.bacaData(p.perkara_id, q);
    const g = PAW.golongkan({ petitum: d.perkara.petitum, posita: d.perkara.posita, pihak1: d.pihak1 });
    if (!g.pewaris) continue;
    st.perkara += 1;
    for (const e of emas) {
      st.heir += 1;
      let mine = "";
      for (const k of ["anak", "pasangan", "saudara", "ibu", "ayah"]) if (g[k].some((n) => B.samaNama(n, e.nama))) mine = k;
      const r = (per[e.gol] = per[e.gol] || { n: 0, benar: 0, salah: 0, sisa: 0 });
      r.n += 1;
      if (!mine) {
        r.sisa += 1;
        st.sisa += 1;
      } else if (mine === e.gol) {
        r.benar += 1;
        st.benar += 1;
      } else {
        r.salah += 1;
        st.salah += 1;
        salah.push(`${p.nomor_perkara} ${e.nama}: mesin=${mine} amar=${e.gol}`);
      }
    }
  }
  console.log(JSON.stringify({ st, per }, null, 1));
  if (tampilSalah) console.log(salah.join("\n"));
  kon.end();
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
