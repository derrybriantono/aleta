const fs = require('fs');
const W = 'D:/aleta-dev/wt/w30';
const src = fs.readFileSync(W + '/ekstensi-sipp/abt.js', 'utf8');
const a = src.indexOf('const POLA_PENUTUP = [');
const bEnd = src.indexOf('// ─── Posita: dirapikan di SIPP');
const code = src.slice(a, bEnd) + '\nmodule.exports={bersihkanKeteranganSaksi,adalahKalimatPenutupSaksi};';
const m = { exports: {} };
new Function('module', 'exports', code)(m, m.exports);
const { bersihkanKeteranganSaksi, adalahKalimatPenutupSaksi } = m.exports;
const un = (s) => s.replace(/\\(n|t|r|\\)/g, (x, c) => (c === 'n' ? '\n' : c === 't' ? '\t' : c === 'r' ? '\r' : '\\'));
const berkas = process.env.KS_BERKAS || 'ks_semua.tsv';
const L = fs.readFileSync(berkas, 'utf8').split('\n').slice(1).filter(Boolean);
const rows = L.map((l) => {
  const p = l.split('\t');
  return { id: p[0], perkara: p[1], sidang: p[2], saksi: p[3], urut: p[4], q: un(p[5] || ''), j: un(p.slice(6).join('\t')) };
});
module.exports = { rows, bersihkanKeteranganSaksi, adalahKalimatPenutupSaksi };
if (require.main === module) {
  let tangkap = 0;
  const kena = new Map();
  for (const r of rows) {
    const b = bersihkanKeteranganSaksi(r.j, r.q);
    if (!b.trim()) {
      tangkap++;
      const k = r.j.replace(/\s+/g, ' ').trim().toLowerCase();
      kena.set(k, (kena.get(k) || 0) + 1);
    }
  }
  console.log('baris', rows.length, 'tertangkap', tangkap, 'bentuk', kena.size);
  const urut = [...kena].sort((x, y) => y[1] - x[1]);
  fs.writeFileSync('kena.json', JSON.stringify(urut));
  console.log(urut.slice(0, 60).map((x) => x[1] + '\t' + x[0]).join('\n'));
}
