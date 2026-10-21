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
const berkas = process.argv[2];
const rtf = fs.readFileSync(berkas).toString('latin1');
const h = k.bersihkanPenutupSaksiRtf(rtf);
console.log('jumlah dibuang', h.jumlah, 'panjang', rtf.length, '->', h.rtf.length);
console.log('kurung seimbang', h.rtf.split('{').length === h.rtf.split('}').length, 'par', rtf.split('\\par').length, '->', h.rtf.split('\\par').length);
const sisa = (h.rtf.match(/Bahwa (?:sudah cukup|tidak ada, sudah cukup)/g) || []).length;
console.log('penutup tersisa', sisa, 'butir saksi tersisa', (h.rtf.match(/-\\tab Bahwa/g) || []).length, 'dari', (rtf.match(/-\\tab Bahwa/g) || []).length);
if (process.argv[3]) fs.writeFileSync(process.argv[3], h.rtf, 'latin1');
