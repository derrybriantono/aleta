const { rows, bersihkanKeteranganSaksi } = require('./ukur.js');
// Pertanyaan penutup (menurut kelompok bot) yang jawabannya TIDAK tertangkap.
const tanyaTutup = /masih ada (?:yang|keterangan|hal|ingin)|ingin .*sampaikan|akan .*sampaikan|sampikan|ada tambahan/i;
const lolos = new Map();
let nTanya = 0;
let nTangkap = 0;
for (const r of rows) {
  if (!tanyaTutup.test(r.q)) continue;
  nTanya++;
  const b = bersihkanKeteranganSaksi(r.j, r.q);
  if (!b.trim()) {
    nTangkap++;
    continue;
  }
  const k = r.j.replace(/\s+/g, ' ').trim().toLowerCase();
  const e = lolos.get(k) || { n: 0, p: new Set(), q: r.q.replace(/\s+/g, ' ').trim().slice(0, 60) };
  e.n++;
  e.p.add(r.perkara);
  lolos.set(k, e);
}
console.log('baris dengan pertanyaan penutup', nTanya, 'tertangkap', nTangkap, 'lolos', nTanya - nTangkap, 'bentuk', lolos.size);
const urut = [...lolos].sort((a, b) => b[1].n - a[1].n);
console.log(urut.slice(0, 120).map(([k, e]) => e.n + '\t' + k.slice(0, 140) + '\t<= ' + e.q).join('\n'));
