// Bandingkan POLA_PENUTUP_LENTUR (JS) dengan terjemahan POSIX di MariaDB: lokal 10.4 dan server 5.5 (baca saja).
const fs = require('fs');
const { execFileSync } = require('child_process');
const { rows } = require('./ukur.js');
const { POLA_PENUTUP_LENTUR } = require('D:/aleta-dev/wt/w30/aleta_bot/services/penutupSaksi.js');
const { POLA } = require('D:/aleta-dev/wt/w30/abt-paket/x6-penutup-saksi-21okt/sumber/pola_posix.js');

function inti(baris) {
  return String(baris || '')
    .replace(/^[\s\-–•*]+/, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^bahwa[\s,]*/i, '')
    .replace(/[\s;.,!:]+$/, '')
    .trim();
}
const himpunan = new Set();
for (const r of rows) {
  for (const bagian of [r.j, ...r.j.split('\n')]) {
    const i = inti(bagian).toLowerCase();
    if (i && i.length <= 200) himpunan.add(i);
  }
}
// varian sintetik dari tata bahasa
const dasar = ['cukup', 'sudah cukup', 'cukup sekian', 'sekian', 'sampai di sini', 'tidak sanggup lagi', 'sudah tidak sanggup lagi', 'tidak ada lagi yang ingin disampaikan', 'tidak ada keterangan lain', 'hanya itu yang saya ketahui', 'demikian keterangan saya', 'tidak ada, sudah cukup', 'saya sudah cukup', 'saksi tidak mampu lagi memberikan keterangan', 'tidak kuat lagi', 'tidak sanggup lagi dan sudah cukup', 'cukup sekian dan terima kasih', 'sudah cukup lama berpisah', 'sekian lama ia pergi', 'tidak ada yang saya ketahui', 'tidak ada lagi yang saya ketahui', 'ya, sudah cukup', 'baik, cukup', 'iya, tidak ada lagi', 'terima kasih'];
for (const a of dasar) for (const b of ['', ' lagi', ' saja', ' dan terima kasih', ', terima kasih', ' untuk menjawab', ' dulu', ' sekian', ' keduanya']) { himpunan.add(a + b); himpunan.add('saya ' + a + b); himpunan.add('saksi ' + a + b); }
const daftar = [...himpunan].filter((s) => /^[\x20-\x7e]*$/.test(s));
const js = daftar.map((s) => (POLA_PENUTUP_LENTUR.test(s) ? 1 : 0));
console.log('himpunan', himpunan.size, 'ASCII', daftar.length, 'JS cocok', js.reduce((a, b) => a + b, 0));
fs.writeFileSync('banding_daftar.json', JSON.stringify(daftar));

function esc(s) { return "'" + s.replace(/\\/g, '\\\\').replace(/'/g, "''") + "'"; }
function sqlKueri(potong) {
  return `SELECT z.s, z.s REGEXP ${esc(POLA.lentur)} AS c FROM (` + potong.map((s, i) => (i === 0 ? `SELECT ${esc(s)} AS s` : `SELECT ${esc(s)}`)).join(' UNION ALL ') + ') z';
}
function jalankanServer(kueri) {
  const b = Buffer.from(kueri, 'latin1').toString('base64');
  const o = execFileSync('ssh', ['aleta', 'bash /root/lihat-jejak.sh "$(base64 -d)"'], { input: b, maxBuffer: 1 << 28 });
  return o.toString('utf8');
}
const mode = process.argv[2] || 'server';
let salah = 0;
const contoh = [];
if (mode === 'server') {
  const UKURAN = 450;
  for (let i = 0; i < daftar.length; i += UKURAN) {
    const potong = daftar.slice(i, i + UKURAN);
    const out = jalankanServer(sqlKueri(potong)).split('\n').slice(1).filter(Boolean);
    if (out.length !== potong.length) { console.log('jumlah keluaran beda', out.length, potong.length); process.exit(1); }
    out.forEach((l, k) => {
      const c = Number(l.split('\t').pop());
      if (c !== js[i + k]) { salah++; if (contoh.length < 15) contoh.push([potong[k], js[i + k], c]); }
    });
    process.stdout.write('.');
  }
} else {
  // lokal: tulis berkas SQL, jalankan lewat klien mysql XAMPP
  const lines = daftar.map((s, i) => `(${i}, ${esc(s)}, ${js[i]})`);
  const sql = 'CREATE DATABASE IF NOT EXISTS w30_regex DEFAULT CHARSET latin1; USE w30_regex; DROP TABLE IF EXISTS t; CREATE TABLE t (id INT PRIMARY KEY, s VARCHAR(300), js TINYINT); ' + Array.from({ length: Math.ceil(lines.length / 1000) }, (_, k) => 'INSERT INTO t VALUES ' + lines.slice(k * 1000, k * 1000 + 1000).join(',') + ';').join('\n') + '\n' + `SELECT s, js, (s REGEXP ${esc(POLA.lentur)}) AS c FROM t HAVING js <> c;`;
  fs.writeFileSync('banding_lokal.sql', sql, 'latin1');
  const out = execFileSync('D:/Satker Asal/Website PA Bungku/xampp/mysql/bin/mysql.exe', ['-uroot', '--default-character-set=latin1', '-N'], { input: fs.readFileSync('banding_lokal.sql') }).toString('latin1');
  const baris = out.split('\n').filter(Boolean);
  salah = baris.length;
  baris.slice(0, 15).forEach((b) => contoh.push(b));
}
console.log('\nmode', mode, 'berbeda', salah);
console.log(contoh);
