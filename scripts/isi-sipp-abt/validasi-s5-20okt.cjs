// Memvalidasi pengisi S5 (aleta_bot/services/isiOtomatisJenisS5.js) terhadap isian MANUSIA di ABT lokal (aps_badilag.abt_data_teks,
// hanya yang diubah SEBELUM 1 Sep 2026 supaya bukan hasil usulan mesin). BACA SAJA.
//   node scripts/isi-sipp-abt/validasi-s5-20okt.cjs [--akar <repo>] [--dari 2022-01-01] [--jenis 362,...] [--kode 0600,0601] [--salah]
// Per kode: n pasangan (usulan ada dan isian manusia ada), cocok menurut pembanding makna, dan contoh yang berbeda (--salah).
const path = require("path");
const { createRequire } = require("module");
const arg = (n, b) => {
  const i = process.argv.indexOf(n);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : b;
};
const akar = path.resolve(arg("--akar", path.resolve(__dirname, "..", "..")));
const dari = arg("--dari", "2022-01-01");
const JENIS = arg("--jenis", "362,354,358,363,371").split(",").map(Number);
const KODE = arg("--kode", "").split(",").filter(Boolean);
const tampilSalah = process.argv.includes("--salah");
const mysql = createRequire(path.join(akar, "aleta_bot", "package.json"))("mysql");
const S5 = require(path.join(akar, "aleta_bot", "services", "isiOtomatisJenisS5.js"));
const B = require(path.join(akar, "aleta_bot", "services", "isiOtomatisS5", "bantu.js"));
const buat = (db) => {
  const k = mysql.createConnection({ host: "127.0.0.1", user: "root", database: db, typeCast: (f) => f.string() });
  return [k, (s, p) => new Promise((ok, g) => k.query(s, p || [], (e, r) => (e ? g(e) : ok(r))))];
};

const nrm = B.normal;
const angka = (t) => {
  const m = /\d+/.exec(String(t || ""));
  return m ? Number(m[0]) : null;
};
const TANGGAL = new Set(["0349", "1230", "1246", "0663", "1232", "0185", "0184", "0132"]);
/** Kelas makna isian bergaya bebas: pendidikan, pekerjaan anak, status (sinonim dianggap sama). */
function kelasPendidikan(t) {
  const x = nrm(t);
  if (/\b(tidak|belum) (sekolah|tamat)\b|\btidak ada\b/.test(x) && !/\b(sd|dasar)\b/.test(x)) return "tidak";
  if (/\b(sd|mi|sekolah dasar|ibtidaiyah)\b/.test(x)) return "sd";
  if (/\b(sltp|smp|mts|tsanawiyah|menengah pertama|lanjutan tingkat pertama)\b/.test(x)) return "sltp";
  if (/\b(slta|sma|smk|ma|aliyah|menengah atas|lanjutan tingkat atas|menengah kejuruan)\b/.test(x)) return "slta";
  if (/\b(s1|strata (i|satu|1)|sarjana)\b/.test(x)) return "s1";
  return x;
}
function kelasPekerjaan(t) {
  const x = nrm(t);
  if (/^(belum ada|tidak ada|tidak bekerja|belum bekerja|belum ada pekerjaan|tidak ada pekerjaan|belum memiliki pekerjaan|tidak memiliki pekerjaan)$/.test(x) || x === "") return "tidak";
  if (/pelajar|mahasiswa|siswa/.test(x)) return "pelajar";
  if (/rumah tangga/.test(x)) return "irt";
  return x;
}
function kelasStatus(t) {
  const x = nrm(t);
  if (/\b(bujang|jejaka|perjaka)\b/.test(x)) return "belumPria";
  if (/\b(gadis|perawan)\b/.test(x)) return "belumWanita";
  if (/\bduda\b/.test(x)) return "duda";
  if (/\bjanda\b/.test(x)) return "janda";
  return x;
}
/** Pembanding makna: nama (inti sama), umur (angka pertama), tanggal (sama), teks (sepadan). */
function cocok(kode, mine, human) {
  const a = String(mine || "");
  const h = String(human || "");
  if (!a || !h) return false;
  if (["0609", "0603"].includes(kode)) return kelasPendidikan(a) === kelasPendidikan(h);
  if (["0610", "0604"].includes(kode)) return kelasPekerjaan(a) === kelasPekerjaan(h);
  if (["2029", "2030", "1002", "1003"].includes(kode)) return kelasStatus(a) === kelasStatus(h);
  if (["0600", "0606", "1029", "1217", "1551", "1552", "0650", "0651", "1025", "8610", "8608"].includes(kode)) return B.samaNama(a, h) || nrm(h).includes(nrm(a)) || nrm(a).includes(nrm(h));
  if (["0601", "0607", "1030", "7211", "7212"].includes(kode)) return angka(a) !== null && angka(a) === angka(h);
  if (TANGGAL.has(kode) || kode === "5197") {
    const ia = /^\d{2}\/\d{2}\/\d{4}$/.test(a) ? a.split("/").reverse().join("-") : B.indonesiaKeIso(a);
    const ih = /^\d{4}-\d{2}-\d{2}/.test(h) ? h.slice(0, 10) : /^\d{2}\/\d{2}\/\d{4}$/.test(h) ? h.split("/").reverse().join("-") : B.indonesiaKeIso(h);
    return Boolean(ia) && ia === ih;
  }
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
  process.env.ALETA_BOT_DB_SIPP_NAME = "sipp_donggala";
  const [k1, q] = buat("sipp_donggala");
  const [k2, qa] = buat("aps_badilag");
  const ps = await q(`SELECT perkara_id, nomor_perkara, jenis_perkara_id j FROM perkara WHERE jenis_perkara_id IN (${JENIS.join(",")}) AND tanggal_pendaftaran >= ?`, [dari]);
  const rekap = {};
  const salah = [];
  for (const p of ps) {
    const usul = await S5.usulanJenisS5(p.perkara_id, q);
    if (!usul.length) continue;
    const human = Object.fromEntries((await qa("SELECT no_var, data FROM abt_data_teks WHERE perkara_id = ? AND modified < '2026-09-01' AND data IS NOT NULL AND data <> ''", [p.perkara_id])).map((x) => [String(Number(x.no_var)).padStart(4, "0"), x.data]));
    for (const u of usul) {
      if (KODE.length && !KODE.includes(u.kode)) continue;
      const r = (rekap[u.kode] = rekap[u.kode] || { usulan: 0, banding: 0, cocok: 0, pasti: 0, cukup: 0, ragu: 0 });
      r.usulan += 1;
      r[u.keyakinan] += 1;
      const h = human[u.kode];
      if (!h) continue;
      r.banding += 1;
      if (cocok(u.kode, u.nilai, h)) r.cocok += 1;
      else salah.push(`${p.nomor_perkara} ${u.kode} [${u.keyakinan}] mesin="${String(u.nilai).slice(0, 70)}" | manusia="${String(h).replace(/\s+/g, " ").slice(0, 70)}"`);
    }
  }
  for (const [k, r] of Object.entries(rekap).sort()) console.log(`${k} usulan ${r.usulan} (pasti ${r.pasti} cukup ${r.cukup} ragu ${r.ragu}) | dibanding ${r.banding} cocok ${r.cocok}${r.banding ? ` (${Math.round((r.cocok / r.banding) * 100)}%)` : ""}`);
  if (tampilSalah) console.log(salah.join("\n"));
  k1.end();
  k2.end();
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
