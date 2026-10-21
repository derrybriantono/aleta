// Harapan x7: baris penutup utuh (aturan x6 = adalahKalimatPenutupSaksi bot, dengan pertanyaan) di perkara BELUM minutasi.
process.env.KS_BERKAS = 'D:/Aplikasi/aleta/tmp/w30/x7/ks2.tsv';
const fs = require('fs');
const { rows } = require('../../x6-penutup-saksi-21okt/alat/ukur.js');
const { adalahKalimatPenutupSaksi } = require('D:/aleta-dev/wt/w30/aleta_bot/services/penutupSaksi.js');
const st = new Map();
for (const l of fs.readFileSync('D:/Aplikasi/aleta/tmp/w30/x7/sipp_status.tsv', 'utf8').split('\n').slice(1).filter(Boolean)) {
  const [id, pt, a220] = l.split('\t');
  st.set(id, { pt: Number(pt), a220: Number(a220) });
}
const belum = (s) => s && s.a220 === 0 && s.pt < 220;
const perPerkara = new Map();
let kandidatSemua = 0;
const borderline = new Map();
let total = rows.length;
let diPerkaraBelum = 0;
for (const r of rows) {
  const s = st.get(r.perkara);
  if (belum(s)) diPerkaraBelum++;
  const pen = r.j.trim() && adalahKalimatPenutupSaksi(r.j, r.q);
  if (!pen) continue;
  kandidatSemua++;
  if (belum(s)) {
    const e = perPerkara.get(r.perkara) || { sebelum: 0, hapus: 0, pt: s.pt };
    e.hapus++;
    perPerkara.set(r.perkara, e);
  } else if (s && s.a220 === 0) {
    borderline.set(r.perkara, (borderline.get(r.perkara) || 0) + 1);
  }
}
for (const r of rows) {
  const e = perPerkara.get(r.perkara);
  if (e) e.sebelum++;
}
let hapus = 0;
for (const e of perPerkara.values()) hapus += e.hapus;
console.log({ totalBaris: total, barisDiPerkaraBelumMinutasi: diPerkaraBelum, kandidatSemuaPerkara: kandidatSemua, hapusBelumMinutasi: hapus, perkaraBelumMinutasiTerkena: perPerkara.size, borderlineTanpa220TapiLanjut: borderline.size, borderlineBaris: [...borderline.values()].reduce((a, b) => a + b, 0) });
const perPt = {};
for (const e of perPerkara.values()) {
  perPt[e.pt] = perPt[e.pt] || { perkara: 0, baris: 0 };
  perPt[e.pt].perkara++;
  perPt[e.pt].baris += e.hapus;
}
console.log(perPt);
fs.writeFileSync('D:/Aplikasi/aleta/tmp/w30/x7/harapan.json', JSON.stringify({ perPerkara: [...perPerkara].map(([id, e]) => ({ perkara_id: id, ...e })) }));
