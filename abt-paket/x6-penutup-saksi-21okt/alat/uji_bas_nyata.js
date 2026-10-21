const fs = require('fs');
const vm = require('vm');
const W = 'D:/aleta-dev/wt/w30';
const abt = fs.readFileSync(W + '/ekstensi-sipp/abt.js', 'utf8');
const isi = fs.readFileSync(W + '/ekstensi-sipp/blangko-derry-isian.js', 'utf8');
const awal = abt.indexOf('const POLA_PENUTUP = [');
const akhir = abt.indexOf('// ─── Keterangan saksi: disunting');
const a = isi.indexOf('function bersihkanPenutupSaksiRtf(');
const b = isi.indexOf('async function ambilRtf(');
const k = {};
vm.createContext(k);
vm.runInContext(
  abt.slice(awal, akhir) +
    `
const latin1 = (buf) => (typeof buf === "string" ? buf : String.fromCharCode.apply(null, new Uint8Array(buf)));
const bufDariLatin1 = (s) => { const u = new Uint8Array(s.length); for (let i = 0; i < s.length; i += 1) u[i] = s.charCodeAt(i) & 0xff; return u.buffer; };
const bersihkanPenutup = (t, q) => bersihkanKeteranganSaksi(t, q);
` +
    isi.slice(a, b),
  k
);
const rtf = fs.readFileSync(process.argv[2]).toString('latin1');
const h = k.bersihkanPenutupTabelRtf(rtf);
const hitung = (t, re) => (t.match(re) || []).length;
console.log('pasangan dibuang', h.jumlah, 'panjang', rtf.length, '->', h.rtf.length);
console.log('\\row', hitung(rtf, /\\row(?![a-z])/g), '->', hitung(h.rtf, /\\row(?![a-z])/g), '| kurung seimbang', h.rtf.split('{').length === h.rtf.split('}').length);
for (const kata of ['Sudah cukup', 'masih ada yang ingin', 'masih ada keterangan', 'kenal dengan', 'sanggup untuk mendamaikan', 'penyebab']) {
  console.log(kata.padEnd(28), hitung(rtf, new RegExp(kata, 'g')), '->', hitung(h.rtf, new RegExp(kata, 'g')));
}
if (process.argv[3]) fs.writeFileSync(process.argv[3], h.rtf, 'latin1');
