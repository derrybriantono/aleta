process.env.KS_BERKAS = 'D:/Aplikasi/aleta/tmp/w30/x7/ks2.tsv';
const fs = require('fs');
const { perPerkara } = JSON.parse(fs.readFileSync('D:/Aplikasi/aleta/tmp/w30/x7/harapan.json', 'utf8'));
const { rows } = require('../../x6-penutup-saksi-21okt/alat/ukur.js');
const tot = new Map();
for (const r of rows) tot.set(r.perkara, (tot.get(r.perkara) || 0) + 1);
const hasil = perPerkara
  .map((e) => ({ perkara_id: Number(e.perkara_id), proses_terakhir_id: e.pt, baris_sebelum: tot.get(e.perkara_id), baris_penutup_dihapus: e.hapus, baris_sesudah: tot.get(e.perkara_id) - e.hapus }))
  .sort((a, b) => a.perkara_id - b.perkara_id);
fs.writeFileSync('D:/Aplikasi/aleta/tmp/w30/x7/per_perkara.json', JSON.stringify(hasil));
console.log(hasil.map((h) => `${h.perkara_id}\t${h.proses_terakhir_id}\t${h.baris_sebelum}\t-${h.baris_penutup_dihapus}\t${h.baris_sesudah}`).join('\n'));
console.log('jumlah', hasil.length, 'sebelum', hasil.reduce((a, b) => a + b.baris_sebelum, 0), 'dihapus', hasil.reduce((a, b) => a + b.baris_penutup_dihapus, 0), 'sesudah', hasil.reduce((a, b) => a + b.baris_sesudah, 0));
