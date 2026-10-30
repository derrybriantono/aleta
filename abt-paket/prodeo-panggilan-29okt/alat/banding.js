// Bandingkan keluaran potongan blangko SEBELUM (basis ABT lama) dan SESUDAH (paket terpasang) atas perkara nyata sipp_2810, dengan meniru
// Abt_model::data_variabel_detil + variabel_var_data + variabel_library + TemplateHelper::cleanHtmlTagSpecial/Terbilang (ABT php56). BACA SAJA.
// pakai: node banding.js ; env DB_LAMA (aps_badilag_2810) DB_BARU (aps_badilag_pp29) SIPP (sipp_2810) KELUAR (folder hasil) PEKERJA (4)
// Keluaran: <KELUAR>/banding-rinci.json (memuat data perkara: JANGAN masuk repo) dan ringkasan hitungan di stdout.
'use strict';
const fs = require('fs');
const path = require('path');
const mysql = require(process.env.MYSQL_MODUL || 'D:/aleta-dev/wt/w33/aleta_bot/node_modules/mysql');
const DB_LAMA = process.env.DB_LAMA || 'aps_badilag_2810';
const DB_BARU = process.env.DB_BARU || 'aps_badilag_pp29';
const SIPP = process.env.SIPP || 'sipp_2810';
const KELUAR = process.env.KELUAR || 'D:/Aplikasi/aleta/tmp/pp29/banding';
const PEKERJA = Number(process.env.PEKERJA || 4);
const FUNGSI = process.env.FUNGSI || 'pp29_fn';
const koneksi = () => mysql.createConnection({ host: '127.0.0.1', user: 'root', database: SIPP, charset: 'latin1_swedish_ci', dateStrings: true, multipleStatements: false,
  typeCast: (f, next) => (f.type === 'BLOB' || f.type === 'VAR_STRING' || f.type === 'STRING' ? next() : f.string()) }); // seperti mysqli PHP: angka sebagai teks
const qc = (conn, sql) => new Promise((res) => conn.query({ sql, timeout: 180000 }, (err, rows) => res({ err, rows })));

// --- PHP ---------------------------------------------------------------------------------------------------------------------
const ABIL = ['', 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan', 'sepuluh', 'sebelas'];
function phpIdx(x) { // $abil[$x]: string bukan bilangan bulat murni -> indeks tidak ada; float -> dipotong
  if (typeof x === 'string') return /^\d+$/.test(x) ? ABIL[Number(x)] || '' : '';
  return ABIL[Math.trunc(x)] || '';
}
function terbilang(x) {
  if (x === '' || x === null || x === undefined) x = 0;
  const n = Number(x);
  if (n == 0) return '';
  if (n < 12) return ' ' + phpIdx(x);
  if (n < 20) return terbilang(n - 10) + ' belas';
  if (n < 100) return terbilang(n / 10) + ' puluh' + terbilang(Math.trunc(n) % 10);
  if (n < 200) return ' seratus' + terbilang(n - 100);
  if (n < 1000) return terbilang(n / 100) + ' ratus' + terbilang(Math.trunc(n) % 100);
  if (n < 2000) return ' seribu' + terbilang(n - 1000);
  if (n < 1000000) return terbilang(n / 1000) + ' ribu' + terbilang(Math.trunc(n) % 1000);
  if (n < 1000000000) return terbilang(n / 1000000) + ' juta' + terbilang(Math.trunc(n) % 1000000);
  return '';
}
const isNumeric = (s) => typeof s === 'string' && /^\s*[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?\s*$/.test(s);
function numberFormat0(s) { // number_format($x, 0, ',', '.')
  const n = Math.round(Number(s));
  return String(Math.abs(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.').replace(/^/, n < 0 ? '-' : '');
}
const B = ['', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
function tglIndo2(d) { const [y, m, dd] = d.split('-'); return `${dd} ${B[Number(m)]} ${y}`; }
function bersihHtml(t) { // TemplateHelper::cleanHtmlTagSpecial (bagian yang berpengaruh pada teks)
  t = String(t);
  t = t.split('\u2019').join("'").split('DATA_TIDAK_ADA').join('...').split('TIDAK_BISA_LOAD').join('...');
  t = t.split('</p>').join('\\par').split(' <p').join('<p');
  for (const [a, b] of [['-   ', '-\\tab '], ['-  ', '-\\tab '], ['.   ', '.\\tab '], ['.  ', '.\\tab '], ['    ', '\\tab '], ['   ', '\\tab ']]) t = t.split(a).join(b);
  t = t.replace(/<br(\s*)?\/?>/gi, '\\par ');
  t = t.split('\u00c2').join('');
  t = t.replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, '\u00a0');
  t = t.split('  ').join(' ');
  t = t.replace(/<[^>]*>?/g, ''); // FILTER_SANITIZE_STRING membuang tag
  t = t.split(';').join('; ');
  t = t.split('\u201d').join(' ').split('\u201c').join(' ');
  return t.trim();
}

// --- ABT -----------------------------------------------------------------------------------------------------------------------
async function muat(conn, db) {
  const r = await qc(conn, `SELECT no_var+0 AS no_var, nama, data_type, data_tabel, data_kolom, urutan_data, referensi+0 AS referensi, sql_query FROM ${db}.abt_variabel`);
  if (r.err) throw r.err;
  const m = new Map();
  for (const x of r.rows) m.set(Number(x.no_var), x);
  return m;
}
const PENUH = ['v8508', 'v8547', 'v8600'];
const SAMA = new Set();
const tokens = (s) => { const out = []; const re = /#([0-9]*)#/g; let m; while ((m = re.exec(s || ''))) out.push(m[1]); return out; };

async function evalVar(ctx, noStr, pid, tumpuk) {
  const no = Number(noStr);
  if (ctx.memo.has(no)) return ctx.memo.get(no);
  if (ctx.sama.has(no) && ctx.bersama.has(no)) return ctx.bersama.get(no);
  const v = ctx.V.get(no);
  let r = { value: 'DATA_TIDAK_ADA', var_data: null, value_type: '-' };
  if (tumpuk.includes(no) || noStr === '') { /* daur */ } else if (!v) {
    r = { value: 'DATA_TIDAK_ADA', var_data: null, value_type: '-' };
  } else if (v.data_type === 'multi_sidang' || v.data_type === 'tanya_jawab') {
    r = { value: '', var_data: '', value_type: '-' }; // tanpa pilihan sidang
  } else if (v.referensi) {
    const d = await evalVar(ctx, String(v.referensi), pid, [...tumpuk, no]);
    const data = d.var_data;
    if (v.data_type === 'terbilang' && isNumeric(data == null ? '' : String(data))) r = { value: terbilang(String(data)), var_data: data, value_type: 'terbilang' };
  } else {
    let data;
    if (v.data_type === 'data_sql' && v.sql_query) {
      let q = v.sql_query;
      for (const t of tokens(q)) {
        const d = await evalVar(ctx, t, pid, [...tumpuk, no]);
        q = q.split('#' + t + '#').join(d.value_type === 'tanggal' ? d.value : (d.var_data == null ? '' : String(d.var_data)));
      }
      // fungsi: basis FUNGSI (salinan fungsi server yang membaca SIPP lewat skema sipp_2810, + isian_rtf_terbilang); tabel ABT: basis sisi ini
      q = q.split('#perkara_id#').join(String(pid)).replace(/\baps_badilag\.(?=\w+\s*\()/g, FUNGSI + '.').replace(/\baps_badilag\./g, ctx.db + '.');
      const res = await qc(ctx.conn, q);
      if (res.err) { ctx.galat.push(`${no} ${pid} ${res.err.code} ${String(res.err.sqlMessage).slice(0, 120)}`); data = 'GALAT'; }
      else {
        const rows = Array.isArray(res.rows) && Array.isArray(res.rows[0]) ? res.rows[res.rows.length - 1] : res.rows; // kueri berakhir ';'
        if (rows && rows[0]) { const k = Object.keys(rows[0])[0]; data = k === 'data' ? rows[0].data : undefined; }
        else data = undefined;
        if (rows && rows[0] && data === undefined) data = '__BUKAN_DATA__';
      }
    } else if (v.data_type === 'data_sipp') {
      let res = await qc(ctx.conn, `select ${v.data_kolom} as data from ${v.data_tabel} where perkara_id=${pid} ${v.urutan_data ? 'and urutan=' + v.urutan_data : ''} limit 1`);
      // salinan laptop bisa tanpa view SIPP (view tidak ikut terimpor): v_perkara.tahun_pendaftaran = YEAR(perkara.tanggal_pendaftaran) (definisi view server)
      if (res.err && v.data_tabel === 'v_perkara' && v.data_kolom === 'tahun_pendaftaran') res = await qc(ctx.conn, `select year(tanggal_pendaftaran) as data from perkara where perkara_id=${pid} limit 1`);
      if (!res.err && res.rows[0]) data = res.rows[0].data;
    } else if (v.data_type) {
      const res = await qc(ctx.conn, `select data from ${ctx.db}.abt_${v.data_type} where perkara_id=${pid} and no_var=${no} limit 1`);
      if (!res.err && res.rows[0]) data = res.rows[0].data;
    }
    if (data === undefined || data === '__BUKAN_DATA__') r = { value: 'DATA_TIDAK_ADA', var_data: null, value_type: '-' };
    else if (no === 8008 || no === 8011) { const s = String(data).toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()); r = { value: s, var_data: s, value_type: 'teks_biasa' }; }
    else if (data !== null && /^\d{4}-\d{2}-\d{2}$/.test(String(data))) r = { value: tglIndo2(String(data)), var_data: String(data).replace(/-/g, '/'), value_type: 'tanggal' };
    else if (data !== null && isNumeric(String(data)) && String(data).includes('0.00')) r = { value: numberFormat0(String(data)), var_data: String(data), value_type: 'angka' };
    else r = { value: data == null ? '' : String(data).replace(/\r?\n/g, '<br />\n'), var_data: data, value_type: 'teks_biasa' };
  }
  ctx.memo.set(no, r);
  if (ctx.sama.has(no)) ctx.bersama.set(no, r);
  return r;
}
async function render(ctx, templat, pid) {
  let s = templat;
  for (const t of tokens(templat)) {
    const d = await evalVar(ctx, t, pid, []);
    s = s.split('#' + t + '#').join(bersihHtml(d.value));
  }
  return s;
}

// --- potongan -----------------------------------------------------------------------------------------------------------------
const POTONGAN = {
  amar: ['#8505# (#0155# #7095#)', '#11122#'],
  amarA2: ['Membebankan kepada #7036# untuk membayar biaya perkara ini sejumlah Rp#8504#,00 (#0155# #7095#)', '#11122#'],
  rincian: ['Pendaftaran Rp #0279#,00 | Proses Rp #6060#,00 | PNBP Panggilan Rp #6074#,00 | Relaas I Rp #6063#,00 | Relaas I Rp #8891#,00 | Panggilan Rp #0312#,00 | Redaksi Rp #0281#,00 | Meterai Rp #5223#,00 | Sita Rp #0242#,00 | PS Rp #0244#,00 | Jumlah Rp #0143#,00 (#0155# #7095#)',
    'Pendaftaran Rp #11130#,00 | Proses Rp #11131#,00 | PNBP Panggilan Rp #11132#,00 | Relaas I Rp #11133#,00 | Relaas I Rp #11134#,00 | Panggilan Rp #11135#,00 | Redaksi Rp #11136#,00 | Meterai Rp #11137#,00 | Sita Rp #11138#,00 | PS Rp #11139#,00 | Jumlah Rp #11140#,00 (#11123#)'],
  rincianRupiah: ['Terbilang : (#0155# rupiah)', 'Terbilang : (#11123#)'],
  rincianIkrar: ['Panggilan P Rp #1090#,00 | Panggilan T Rp #1164#,00 | Jumlah Rp #1101#,00 (#2050# rupiah)', 'Panggilan P Rp #11141#,00 | Panggilan T Rp #11142#,00 | Jumlah Rp #11143#,00 (#11124#)'],
  rincianVerzet: ['Jumlah Rp #3993#,00 (#3994# rupiah)', 'Jumlah Rp #11144#,00 (#11145#)'],
  amarDasar: ['#8505#', '#8505#'],
  tglT: ['tanggal #1077# dan tanggal #0120#', 'tanggal #11121#'],
  tglP: ['tanggal #1076# dan tanggal #0118#', 'tanggal #11120#'],
  tglT1: ['tanggal #1077#', 'tanggal #11121#'],
  v8508: ['#8508#', '#8508#'],
  v8547: ['#8547#', '#8547#'],
  v8600: ['#8600#', '#8600#'],
};

const ISI = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'hasil', 'isi-paket.json'), 'utf8'));
for (const [no, kalimat] of Object.entries(ISI.varian_amar || {})) POTONGAN['varian' + no] = [kalimat, '#' + no + '#'];
(async () => {
  fs.mkdirSync(KELUAR, { recursive: true });
  const c0 = koneksi();
  const VL = await muat(c0, DB_LAMA);
  const VB = await muat(c0, DB_BARU);
  const pr = await qc(c0, 'SELECT perkara_id, prodeo FROM perkara');
  const prodeo = new Set(pr.rows.filter((x) => Number(x.prodeo) === 1).map((x) => Number(x.perkara_id)));
  const pu = await qc(c0, "SELECT DISTINCT perkara_id FROM perkara_putusan WHERE tanggal_putusan >= '2025-01-01'");
  const putus = new Set(pu.rows.map((x) => Number(x.perkara_id)));
  const rl = await qc(c0, "SELECT r.perkara_id, COUNT(DISTINCT r.tanggal_relaas) n FROM perkara_pelaksanaan_relaas r JOIN perkara_pihak2 p ON p.perkara_id = r.perkara_id AND p.pihak_id = r.pihak_id WHERE r.tanggal_relaas > '1000-01-01' GROUP BY r.perkara_id");
  const nRelaasT = new Map(rl.rows.map((x) => [Number(x.perkara_id), Number(x.n)]));
  c0.end();
  const pids = [...new Set([...prodeo, ...putus])].sort((a, b) => a - b);
  // potongan berat (variabel 8508/8547/8600 utuh: memuat majelis, nomor, dll.) hanya atas sampel: semua prodeo yang putus + tiap perkara ke-K
  const K = Number(process.env.SAMPEL_TIAP || 8);
  const sampel = new Set(pids.filter((p, i) => i % K === 0 || (prodeo.has(p) && putus.has(p))));
  for (const [no, v] of VL) { const w = VB.get(no); if (w && w.sql_query === v.sql_query && w.data_type === v.data_type && Number(w.referensi) === Number(v.referensi)) SAMA.add(no); }
  for (let ulang = true; ulang;) { // buang yang (transitif) merujuk variabel berubah/baru
    ulang = false;
    for (const no of [...SAMA]) { const v = VL.get(no); const r = [...tokens(v.sql_query), ...(v.referensi ? [String(v.referensi)] : [])]; if (r.some((t) => !SAMA.has(Number(t)))) { SAMA.delete(no); ulang = true; } }
  }
  console.error(`sampel potongan penuh: ${sampel.size}; variabel sama: ${SAMA.size}`);
  console.error(`perkara: ${pids.length} (prodeo ${prodeo.size}, putus 2025-2026 ${putus.size}); lama=${DB_LAMA} baru=${DB_BARU} sipp=${SIPP}`);
  const rinci = {};
  const galat = { lama: [], baru: [] };
  let idx = 0, selesai = 0;
  async function pekerja() {
    const conn = koneksi();
    while (idx < pids.length) {
      const pid = pids[idx++];
      const bersama = new Map(); // variabel yang isinya sama di kedua basis dan tidak bergantung pada yang berubah: dihitung sekali
      const A = { V: VL, db: DB_LAMA, memo: new Map(), bersama, sama: SAMA, conn, galat: galat.lama };
      const Bc = { V: VB, db: DB_BARU, memo: new Map(), bersama, sama: SAMA, conn, galat: galat.baru };
      const h = { prodeo: prodeo.has(pid), putus: putus.has(pid), nRelaasT: nRelaasT.get(pid) || 0 };
      for (const [k, [a, b]] of Object.entries(POTONGAN)) {
        if (PENUH.includes(k) && !sampel.has(pid)) continue;
        h[k] = [await render(A, a, pid), await render(Bc, b, pid)];
      }
      rinci[pid] = h;
      if (++selesai % 50 === 0) console.error(`  ${selesai}/${pids.length}`);
    }
    conn.end();
  }
  await Promise.all(Array.from({ length: PEKERJA }, pekerja));
  fs.writeFileSync(path.join(KELUAR, 'banding-rinci.json'), JSON.stringify(rinci));
  fs.writeFileSync(path.join(KELUAR, 'banding-galat.json'), JSON.stringify(galat, null, 1));
  const ring = {};
  for (const k of Object.keys(POTONGAN)) {
    const r = { prodeo: { n: 0, beda: 0 }, bukan: { n: 0, beda: 0 } };
    for (const h of Object.values(rinci)) { if (!h[k]) continue; const g = h.prodeo ? r.prodeo : r.bukan; g.n++; if (h[k][0] !== h[k][1]) g.beda++; }
    ring[k] = r;
  }
  console.log(JSON.stringify({ perkara: pids.length, galat_lama: galat.lama.length, galat_baru: galat.baru.length, potongan: ring }, null, 1));
})();
