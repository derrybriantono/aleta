// Ukur (baca saja) ketepatan faktaPerkara() atas perkara nyata di salinan lokal, dibanding isian petugas (aps_badilag.abt_data_teks).
//
//   node scripts/isi-sipp-abt/ukur-fakta-u6.cjs --maks 300 --kerja 3 --keluar docs/isi-sipp-abt/UKURAN-FAKTA-U6.json
//
// Untuk tiap fakta berpeta yang kodenya diisi petugas: nilai fakta (dibaca TANPA melihat isian petugas: runAbt dimatikan) dibandingkan dengan isian
// petugas pada kode itu. Pembanding "pengisi tunggal" = nilai usulan dariSipp untuk kode yang sama (cara lama: satu pengisi, tanpa penimbangan).
// Dilaporkan: ketepatan fakta, ketepatan pengisi tunggal, ketepatan saat fakta ditandai bertentangan / tidak, dan ketepatan menurut keyakinan.
const fs = require("fs");
const path = require("path");
const { createRequire } = require("module");
const arg = (n, b) => {
  const i = process.argv.indexOf(n);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : b;
};
const akar = path.resolve(__dirname, "..", "..");
const maks = Number(arg("--maks", "250"));
const kerja = Number(arg("--kerja", "3"));
const keluar = arg("--keluar", "");
process.env.ALETA_BOT_DB_SIPP_NAME = process.env.ALETA_BOT_DB_SIPP_NAME || "sipp_donggala";
process.env.ALETA_BOT_DB_USER = process.env.ALETA_BOT_DB_USER || "root";
process.env.ALETA_BOT_DB5_NAME = "tidak_ada_u6";
const mysql = createRequire(path.join(akar, "aleta_bot", "package.json"))("mysql");
const FP = require(path.join(akar, "aleta_bot", "services", "faktaPerkara.js"));
const kon = mysql.createConnection({ host: "127.0.0.1", user: "root", typeCast: (f) => f.string() });
const q = (s, p) => new Promise((a, b) => kon.query(s, p || [], (e, r) => (e ? b(e) : a(r))));
const kon2 = mysql.createConnection({ host: "127.0.0.1", user: "root", database: "sipp_donggala", typeCast: (f) => f.string() });
const runSipp = (s, p) => new Promise((a, b) => kon2.query(s, p || [], (e, r) => (e ? b(e) : a(r))));

const rapat = (t) => String(t == null ? "" : t).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
const norm = (t) => rapat(t).toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
function cocok(a, b) {
  const x = rapat(a);
  const y = rapat(b);
  if (!x || !y) return null;
  const ta = FP.kanon("tanggal", x);
  const tb = FP.kanon("tanggal", y);
  if (/^\d{4}-\d{2}-\d{2}$/.test(ta) && /^\d{4}-\d{2}-\d{2}$/.test(tb)) return ta === tb;
  const na = norm(x);
  const nb = norm(y);
  if (na === nb) return true;
  if (na.length >= 3 && nb.length >= 3 && (na.includes(nb) || nb.includes(na))) return true;
  const xa = (x.match(/\d[\d.]*/g) || []).map((v) => v.replace(/\./g, ""));
  const xb = (y.match(/\d[\d.]*/g) || []).map((v) => v.replace(/\./g, ""));
  if (xa.length && xb.length && xa.length <= 4 && xb.length <= 4 && xa.every((v) => xb.includes(v)) && na.replace(/\d+/g, "").length < 40) return true;
  const sa = new Set(na.split(" ").filter((v) => v.length > 2));
  const sb = new Set(nb.split(" ").filter((v) => v.length > 2));
  if (sa.size && sb.size) return [...sa].filter((v) => sb.has(v)).length / Math.min(sa.size, sb.size) >= 0.7;
  return false;
}

const stat = {};
const total = { perkara: 0, pasanganFakta: 0, setara: { n: 0, cocok: 0 } };
const S = (k) => (stat[k] = stat[k] || { fakta: { n: 0, cocok: 0 }, tunggal: { n: 0, cocok: 0 }, bertentangan: { n: 0, cocok: 0 }, tenang: { n: 0, cocok: 0 }, perYakin: {}, peranSumber: {} });

async function satu(p) {
  const petugasBaris = await q("SELECT no_var, data FROM aps_badilag.abt_data_teks WHERE perkara_id = ?", [p.perkara_id]);
  const petugas = {};
  for (const b of petugasBaris) petugas[String(b.no_var).padStart(4, "0")] = b.data;
  const dari = await require(path.join(akar, "aleta_bot", "services", "abtUsulanService.js")).dariSipp(p.nomor_perkara).catch(() => null);
  const usulan = dari && Array.isArray(dari.usulan) ? dari.usulan : [];
  const f = await FP.faktaPerkara(Number(p.perkara_id), { runQuery: runSipp, runAbt: null, usulan, tanpaBas: true, perkara: undefined });
  if (!f.ok) return;
  total.perkara++;
  const tunggal = new Map(usulan.filter((u) => u && u.kode && String(u.nilai || "").trim()).map((u) => [String(u.kode).padStart(4, "0"), u]));
  for (const [kunci, fa] of Object.entries(f.fakta)) {
    for (const kd of fa.kode) {
      if (petugas[kd] == null || !rapat(petugas[kd])) continue;
      const nilaiKode = f.kode[kd] ? f.kode[kd].nilai : fa.nilai;
      const c = cocok(nilaiKode, petugas[kd]);
      if (c === null) continue;
      const s = S(kunci);
      total.pasanganFakta++;
      s.fakta.n++;
      if (c) s.fakta.cocok++;
      const t = tunggal.get(kd);
      if (t) {
        const ct = cocok(t.nilai, petugas[kd]);
        if (ct !== null) {
          s.tunggal.n++;
          if (ct) s.tunggal.cocok++;
        }
      }
      const g = fa.bertentangan.length ? s.bertentangan : s.tenang;
      g.n++;
      if (c) g.cocok++;
      const y = (s.perYakin[fa.yakin] = s.perYakin[fa.yakin] || { n: 0, cocok: 0 });
      y.n++;
      if (c) y.cocok++;
      const pr = (s.peranSumber[fa.sumber] = s.peranSumber[fa.sumber] || { n: 0, cocok: 0 });
      pr.n++;
      if (c) pr.cocok++;
    }
  }
  // usulan kode setara (petugas diabaikan di sini): nilai yang diusulkan untuk kode yang petugas isi sendiri
  for (const u of f.usulanSetara) {
    const kd = String(u.kode).padStart(4, "0");
    if (petugas[kd] == null || !rapat(petugas[kd])) continue;
    const c = cocok(u.nilai, petugas[kd]);
    if (c === null) continue;
    total.setara.n++;
    if (c) total.setara.cocok++;
  }
}

(async () => {
  const sampel = await q(
    `SELECT p.perkara_id, p.nomor_perkara FROM sipp_donggala.perkara p
      WHERE p.tanggal_pendaftaran >= '2023-01-01' AND p.posita IS NOT NULL AND LENGTH(p.posita) > 150
        AND p.perkara_id IN (SELECT perkara_id FROM aps_badilag.abt_data_teks GROUP BY perkara_id HAVING COUNT(*) >= 6)
      ORDER BY RAND() LIMIT ${maks}`
  );
  const antre = sampel.slice();
  let selesai = 0;
  await Promise.all(
    Array.from({ length: kerja }, async () => {
      while (antre.length) {
        const p = antre.shift();
        try {
          await satu(p);
        } catch (e) {
          console.error("gagal", p.perkara_id, e.message);
        }
        selesai++;
        if (selesai % 25 === 0) console.error("terukur", selesai, "dari", sampel.length);
      }
    })
  );
  const pct = (x) => (x.n ? Math.round((x.cocok / x.n) * 1000) / 10 : null);
  const ringkas = {};
  const jumlah = { fakta: { n: 0, cocok: 0 }, tunggal: { n: 0, cocok: 0 }, bertentangan: { n: 0, cocok: 0 }, tenang: { n: 0, cocok: 0 } };
  for (const [k, s] of Object.entries(stat)) {
    ringkas[k] = { fakta: { ...s.fakta, persen: pct(s.fakta) }, pengisiTunggal: { ...s.tunggal, persen: pct(s.tunggal) }, bertentangan: { ...s.bertentangan, persen: pct(s.bertentangan) }, tenang: { ...s.tenang, persen: pct(s.tenang) }, perYakin: s.perYakin };
    for (const g of ["fakta", "bertentangan", "tenang"]) {
      jumlah[g].n += s[g].n;
      jumlah[g].cocok += s[g].cocok;
    }
    jumlah.tunggal.n += s.tunggal.n;
    jumlah.tunggal.cocok += s.tunggal.cocok;
  }
  const hasil = {
    diukur: new Date().toISOString().slice(0, 10),
    cara: "scripts/isi-sipp-abt/ukur-fakta-u6.cjs: faktaPerkara() tanpa isian petugas vs aps_badilag.abt_data_teks (pembanding = isian petugas/hakim)",
    perkara: total.perkara,
    pasangan: total.pasanganFakta,
    keseluruhan: { fakta: { ...jumlah.fakta, persen: pct(jumlah.fakta) }, pengisiTunggal: { ...jumlah.tunggal, persen: pct(jumlah.tunggal) }, ditandaiBertentangan: { ...jumlah.bertentangan, persen: pct(jumlah.bertentangan) }, tidakBertentangan: { ...jumlah.tenang, persen: pct(jumlah.tenang) } },
    kodeSetaraVsPetugas: { ...total.setara, persen: pct(total.setara) },
    perFakta: ringkas,
  };
  if (keluar) fs.writeFileSync(keluar, JSON.stringify(hasil, null, 1));
  console.log(JSON.stringify({ perkara: hasil.perkara, pasangan: hasil.pasangan, keseluruhan: hasil.keseluruhan, kodeSetaraVsPetugas: hasil.kodeSetaraVsPetugas }, null, 1));
  kon.end();
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
