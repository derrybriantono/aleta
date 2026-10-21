const fs = require('fs');
const { rows, bersihkanKeteranganSaksi } = require('./ukur.js');
const ids = [];
const sebagian = [];
for (const r of rows) {
  if (!r.j.trim()) continue;
  const b = bersihkanKeteranganSaksi(r.j, r.q);
  if (!b.trim()) ids.push(r.id);
  else if (b.replace(/\s+/g, ' ') !== r.j.replace(/\s+/g, ' ').trim()) sebagian.push(r.id);
}
fs.writeFileSync('ids_penutup.txt', ids.join('\n') + '\n');
console.log('baris penutup utuh', ids.length, 'sebagian', sebagian.length, sebagian.slice(0, 5));
