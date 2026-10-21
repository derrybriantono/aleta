// Siapkan lab x7: sample abt_keterangan_saksi (TSV), status SIPP (SQL), terdakwa (TSV) -> berkas siap muat.
process.env.KS_BERKAS = 'D:/Aplikasi/aleta/tmp/w30/x7/ks2.tsv';
const fs = require('fs');
const { rows, bersihkanKeteranganSaksi } = require('../../x6-penutup-saksi-21okt/alat/ukur.js');
const st = new Map();
for (const l of fs.readFileSync('D:/Aplikasi/aleta/tmp/w30/x7/sipp_status.tsv', 'utf8').split('\n').slice(1).filter(Boolean)) {
  const [id, pt, a220] = l.split('\t');
  st.set(id, { pt: Number(pt), a220: Number(a220) });
}
// perkara dengan penutup
const adaPenutup = new Set();
for (const r of rows) if (r.j.trim() && !bersihkanKeteranganSaksi(r.j, r.q).trim()) adaPenutup.add(r.perkara);
const semua = [...new Set(rows.map((r) => r.perkara))].sort((a, b) => Number(a) - Number(b));
const belum = (id) => st.get(id) && st.get(id).a220 === 0;
const pilih = new Set();
for (const id of semua) if (belum(id)) pilih.add(id); // semua perkara tanpa catatan Minutasi (sasaran + tepi)
const penMin = semua.filter((id) => !belum(id) && adaPenutup.has(id));
penMin.filter((_, i) => i % Math.max(1, Math.floor(penMin.length / 120)) === 0).slice(0, 120).forEach((id) => pilih.add(id));
const tanpa = semua.filter((id) => !belum(id) && !adaPenutup.has(id));
tanpa.filter((_, i) => i % Math.max(1, Math.floor(tanpa.length / 60)) === 0).slice(0, 60).forEach((id) => pilih.add(id));
const L = fs.readFileSync('D:/Aplikasi/aleta/tmp/w30/x7/ks2.tsv', 'utf8').split('\n');
const kepala = L[0];
const keluar = [kepala];
let n = 0;
for (const l of L.slice(1)) {
  if (!l) continue;
  const p = l.split('\t');
  if (pilih.has(p[1])) {
    keluar.push(l);
    n++;
  }
}
fs.writeFileSync('D:/Aplikasi/aleta/tmp/w30/x7/ks_sampel.tsv', keluar.join('\n') + '\n');
// SIPP lab
const sql = [
  'DROP DATABASE IF EXISTS sipp_x7; CREATE DATABASE sipp_x7 DEFAULT CHARSET latin1; USE sipp_x7;',
  'CREATE TABLE perkara (perkara_id BIGINT PRIMARY KEY, proses_terakhir_id INT) ENGINE=InnoDB;',
  'CREATE TABLE perkara_proses (id BIGINT AUTO_INCREMENT PRIMARY KEY, perkara_id BIGINT, proses_id INT, KEY (perkara_id)) ENGINE=InnoDB;',
];
const v1 = [];
const v2 = [];
for (const [id, s] of st) {
  v1.push(`(${id}, ${s.pt})`);
  if (s.a220) v2.push(`(${id}, 220)`);
  v2.push(`(${id}, 200)`);
}
for (let i = 0; i < v1.length; i += 500) sql.push('INSERT INTO perkara VALUES ' + v1.slice(i, i + 500).join(',') + ';');
for (let i = 0; i < v2.length; i += 500) sql.push('INSERT INTO perkara_proses (perkara_id, proses_id) VALUES ' + v2.slice(i, i + 500).join(',') + ';');
fs.writeFileSync('D:/Aplikasi/aleta/tmp/w30/x7/sipp_x7.sql', sql.join('\n') + '\n');
console.log('perkara terpilih', pilih.size, 'baris', n, 'belum minutasi/tepi', [...pilih].filter(belum).length);
