const { rows, bersihkanKeteranganSaksi } = require('./ukur.js');
let sebagian = 0;
const contoh = [];
let multi = 0;
for (const r of rows) {
  if (/\n/.test(r.j.trim())) multi++;
  const b = bersihkanKeteranganSaksi(r.j, r.q);
  if (b.trim() && b.trim() !== r.j.trim()) {
    // beda hanya karena spasi/baris?
    const a1 = r.j.replace(/\s+/g, ' ').trim();
    const b1 = b.replace(/\s+/g, ' ').trim();
    if (a1 !== b1) {
      sebagian++;
      if (contoh.length < 12) contoh.push({ id: r.id, asli: a1.slice(0, 200), bersih: b1.slice(0, 200) });
    }
  }
}
console.log('baris multi-baris', multi, 'penutup SEBAGIAN (ada butir lain di baris sama)', sebagian);
console.log(contoh);
// jumlah panjang terbesar jawaban
console.log('panjang maks', Math.max(...rows.map((r) => r.j.length)));
