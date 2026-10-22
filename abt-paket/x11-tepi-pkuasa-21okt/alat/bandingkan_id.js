// Bandingkan id yang dihapus paket x11 (cadangan/id-hapus.txt) dengan harapan menurut aturan bot (JS adalahKalimatPenutupSaksi + pertanyaan)
// atas sampel lab dan status SIPP: jawaban seluruhnya penutup DAN perkara tanpa catatan Minutasi (tanpa proses 220).
// pakai: node bandingkan_id.js <id-hapus.txt> [ks.tsv] [sipp_status.tsv]
const fs = require('fs');
const path = require('path');
const berkasId = process.argv[2];
const ks = process.argv[3] || 'D:/Aplikasi/aleta/tmp/w30/x7/ks_sampel_x11.tsv';
const sipp = process.argv[4] || 'D:/Aplikasi/aleta/tmp/w30/x7/sipp_status.tsv';
process.env.KS_BERKAS = ks;
const { rows, adalahKalimatPenutupSaksi } = require(path.resolve(__dirname, '../../x6-penutup-saksi-21okt/alat/ukur.js'));
const st = new Map();
for (const l of fs.readFileSync(sipp, 'utf8').split('\n').slice(1).filter(Boolean)) {
  const [id, pt, a220] = l.split('\t');
  st.set(id, { pt: Number(pt), a220: Number(a220) });
}
const harapan = new Set();
for (const r of rows) {
  const s = st.get(r.perkara);
  if (!s || s.a220 !== 0) continue; // x11: perkara TANPA catatan Minutasi (proses terakhir berapa pun)
  if (r.j.trim() && adalahKalimatPenutupSaksi(r.j, r.q)) harapan.add(r.id);
}
const nyata = new Set(fs.readFileSync(berkasId, 'utf8').split('\n').map((x) => x.trim()).filter(Boolean));
const kurang = [...harapan].filter((x) => !nyata.has(x));
const lebih = [...nyata].filter((x) => !harapan.has(x));
console.log(kurang.length === 0 && lebih.length === 0 ? `YA (${nyata.size} id sama)` : `TIDAK (harapan ${harapan.size}, nyata ${nyata.size}, kurang ${kurang.length}, lebih ${lebih.length})`);
