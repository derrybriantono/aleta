// Susun kueri BACA SAJA untuk server: T, R (tanpa fungsi), dan C versi id-JS. Jalankan: node konfirmasi_server.js > q.sql
process.env.KS_BERKAS = 'D:/Aplikasi/aleta/tmp/w30/x7/ks2.tsv';
const fs = require('fs');
const { rows, adalahKalimatPenutupSaksi } = require('../../x6-penutup-saksi-21okt/alat/ukur.js');
const st = new Map();
for (const l of fs.readFileSync('D:/Aplikasi/aleta/tmp/w30/x7/sipp_status.tsv', 'utf8').split('\n').slice(1).filter(Boolean)) {
  const [id, pt, a220] = l.split('\t');
  st.set(id, { pt: Number(pt), a220: Number(a220) });
}
const ids = [];
for (const r of rows) {
  const s = st.get(r.perkara);
  if (s && s.a220 === 0 && s.pt < 220 && r.j.trim() && adalahKalimatPenutupSaksi(r.j, r.q)) ids.push(r.id);
}
const belum = (a) => `EXISTS (SELECT 1 FROM perkara p WHERE p.perkara_id = ${a}.perkara_id AND p.proses_terakhir_id < 220) AND NOT EXISTS (SELECT 1 FROM perkara_proses pp WHERE pp.perkara_id = ${a}.perkara_id AND pp.proses_id = 220)`;
console.log(`SELECT 'T' AS k, COUNT(*) AS n FROM aps_badilag.abt_keterangan_saksi
UNION ALL SELECT 'R', COUNT(*) FROM aps_badilag.abt_keterangan_saksi k WHERE ${belum('k')}
UNION ALL SELECT 'C (id hasil aturan JS ada di perkara belum minutasi)', COUNT(*) FROM aps_badilag.abt_keterangan_saksi k WHERE k.id IN (${ids.join(',')}) AND ${belum('k')}
UNION ALL SELECT 'perkara C', COUNT(DISTINCT k.perkara_id) FROM aps_badilag.abt_keterangan_saksi k WHERE k.id IN (${ids.join(',')}) AND ${belum('k')}
UNION ALL SELECT 'tepi: id penutup di perkara tanpa proses 220 tapi proses_terakhir >= 220', COUNT(*) FROM aps_badilag.abt_keterangan_saksi k WHERE k.id IN (SELECT 0) OR (k.jawaban REGEXP '(^|[^a-z])(sudah cukup|cukup sekian)([^a-z]|$)' AND NOT EXISTS (SELECT 1 FROM perkara_proses pp WHERE pp.perkara_id = k.perkara_id AND pp.proses_id = 220) AND EXISTS (SELECT 1 FROM perkara p WHERE p.perkara_id = k.perkara_id AND p.proses_terakhir_id >= 220))`);
fs.writeFileSync('D:/Aplikasi/aleta/tmp/w30/x7/ids_hapus_js.txt', ids.join('\n') + '\n');
