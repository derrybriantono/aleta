// Bandingkan keluaran variabel ABT SEBELUM dan SESUDAH paket pihak-urut-romawi-pihak-28okt atas perkara nyata (sipp_donggala lokal), dengan meniru penyulihan #NNNN# Abt_model.php
// (turunan audit-abt/uji_lokal.js; BACA SAJA). Dua basis ABT: DB_SEBELUM (keadaan server sesudah paket sisa 28 Okt) dan DB_SESUDAH (paket romawi terpasang).
// pakai: node bandingkan.js <var,var,...> [pid,pid,... | semua | contoh:N] ; env DB_SEBELUM DB_SESUDAH PEKERJA KELUAR
const fs = require('fs');
const mysql = require('D:/Download File/server aleta baru/aleta_server/aleta_bot/node_modules/mysql');
const DB_SEB = process.env.DB_SEBELUM || 'aps_badilag_rm0';
const DB_SES = process.env.DB_SESUDAH || 'aps_badilag_rm2';
const VARS = (process.argv[2] || '5847,5890,5891,5892,5893,5896,5897').split(',').map(Number);
const PEKERJA = Number(process.env.PEKERJA || 4);
const koneksi = () => mysql.createConnection({ host: '127.0.0.1', user: 'root', database: 'sipp_donggala', charset: 'latin1_swedish_ci', dateStrings: true });

function tglIndo2(d) {
  const B = ['', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  const [y, m, dd] = d.split('-').map(Number);
  return `${dd} ${B[m] || ''} ${y}`;
}
const getVars = (s) => { const out = []; const re = /#([0-9]*)#/g; let m; while ((m = re.exec(s || ''))) out.push(m[1]); return out; };
const qc = (conn, sql) => new Promise((res) => conn.query({ sql, timeout: 120000 }, (err, rows, fields) => res({ err, rows, fields })));

async function muatVariabel(db) {
  const c = koneksi();
  const r = await qc(c, `SELECT no_var, data_type, data_tabel, data_kolom, urutan_data, referensi+0 AS referensi, sql_query, nama, multi_sidang FROM ${db}.abt_variabel`);
  c.end();
  if (r.err) throw r.err;
  const m = new Map();
  for (const x of r.rows) m.set(Number(x.no_var), x);
  return m;
}

function bersihkan(sql) {
  // pindai kiri-ke-kanan: literal '..' dan ".." (dengan "" / '' / backslash) dibuang; komentar -- dan /* */ dibuang
  let out = '';
  let i = 0;
  while (i < sql.length) {
    const c = sql[i];
    if (c === "'" || c === '"') {
      let j = i + 1;
      while (j < sql.length) {
        if (sql[j] === '\\') { j += 2; continue; }
        if (sql[j] === c) { if (sql[j + 1] === c) { j += 2; continue; } break; }
        j++;
      }
      out += c + c;
      i = j + 1;
    } else if (c === '/' && sql[i + 1] === '*') {
      const j = sql.indexOf('*/', i + 2);
      out += ' ';
      i = j < 0 ? sql.length : j + 2;
    } else if (c === '-' && sql[i + 1] === '-') {
      const j = sql.indexOf(String.fromCharCode(10), i);
      out += ' ';
      i = j < 0 ? sql.length : j + 1;
    } else { out += c; i++; }
  }
  return out;
}
function amanBaca(sql) {
  const b = bersihkan(sql).trim();
  if (!/^\(?\s*select\b/i.test(b)) return 'tidak diawali SELECT';
  if (b.replace(/;\s*$/, '').includes(';')) return 'lebih dari satu pernyataan';
  if (/\binto\s+(outfile|dumpfile|@)|\bload_file\s*\(|\bsleep\s*\(|\bbenchmark\s*\(|\bfor\s+update\b/i.test(b)) return 'terlarang';
  if (/(^|;)\s*(insert|update|delete|replace|create|alter|drop|truncate|set|call|lock|grant|rename|do)\b/i.test(b)) return 'pernyataan tulis';
  return null;
}

async function evalVar(ctx, noStr, pid, stack) {
  const no = Number(noStr);
  const key = `${no}`;
  if (ctx.memo.has(key)) return ctx.memo.get(key);
  if (stack.includes(no)) return { value: 'DATA_TIDAK_ADA', var_data: null, value_type: '-' };
  const v = ctx.V.get(no);
  let r;
  if (!v || !v.nama) r = { value: '', var_data: null, value_type: '-' };
  else if (v.data_type === 'multi_sidang' || v.data_type === 'tanya_jawab' || v.data_type === 'qrcode') r = { value: 'DATA_TIDAK_ADA', var_data: null, value_type: '-' };
  else if (v.referensi) {
    const d = await evalVar(ctx, String(v.referensi), pid, [...stack, no]);
    r = { value: 'DATA_TIDAK_ADA', var_data: null, value_type: '-' };
    if (['tanggal_hari', 'tanggal_hijriah'].includes(v.data_type)) r = { value: d.var_data, var_data: d.var_data, value_type: v.data_type };
  } else {
    let data;
    if (v.data_type === 'data_sql' && v.sql_query) {
      let sql = v.sql_query;
      for (const rf of getVars(sql)) {
        const d = await evalVar(ctx, rf, pid, [...stack, no]);
        sql = sql.split('#' + rf + '#').join(d.value_type === 'tanggal' ? d.value : (d.var_data == null ? '' : String(d.var_data)));
      }
      sql = sql.split('#perkara_id#').join(String(pid));
      // fungsi paket di basis lab (variabel menyebut aps_badilag.isian_rtf_*)
      sql = sql.replace(/\baps_badilag\.isian_rtf_/g, ctx.db + '.isian_rtf_');
      const bahaya = amanBaca(sql);
      if (bahaya) data = undefined;
      else {
        const res = await qc(ctx.conn, sql.replace(/;\s*$/, ''));
        if (res.err) { ctx.galat.push({ no, pid, err: res.err.code + ' ' + res.err.sqlMessage }); data = undefined; }
        else if (res.rows[0]) { const k0 = Object.keys(res.rows[0])[0]; data = k0 === 'data' ? res.rows[0].data : undefined; }
      }
    } else if (v.data_type === 'data_sipp') {
      const sql = `select ${v.data_kolom} as data from ${v.data_tabel} where perkara_id=${pid} ${v.urutan_data ? 'and urutan=' + v.urutan_data : ''} limit 1`;
      const res = await qc(ctx.conn, sql);
      if (!res.err && res.rows[0]) data = res.rows[0].data;
    } else if (v.data_type === 'data_teks' || v.data_type === 'data_tanggal') {
      const res = await qc(ctx.conn, `select data from aps_badilag.abt_${v.data_type} where no_var=${no} and perkara_id=${pid} limit 1`);
      if (!res.err && res.rows[0]) data = res.rows[0].data;
    }
    if (data === undefined || data === null) r = { value: 'DATA_TIDAK_ADA', var_data: null, value_type: '-' };
    else {
      data = String(data);
      if (/^\d{1,4}-\d{1,2}-\d{1,2}$/.test(data)) r = { value: tglIndo2(data), var_data: data.replace(/-/g, '/'), value_type: 'tanggal' };
      else if (!isNaN(Number(data)) && data.trim() !== '' && data.includes('0.00')) r = { value: data, var_data: data, value_type: 'angka' };
      else r = { value: data, var_data: data, value_type: 'teks_biasa' };
    }
  }
  ctx.memo.set(key, r);
  return r;
}

(async () => {
  const [Vs, Vp] = [await muatVariabel(DB_SEB), await muatVariabel(DB_SES)];
  const c0 = koneksi();
  let pids;
  const arg = process.argv[3] || 'semua';
  if (/^[0-9,]+$/.test(arg)) pids = arg.split(',').map(Number);
  else {
    const r = await qc(c0, `SELECT DISTINCT perkara_id FROM (SELECT perkara_id FROM perkara_pihak1 UNION SELECT perkara_id FROM perkara_pihak2 UNION SELECT perkara_id FROM perkara_pihak3 UNION SELECT perkara_id FROM perkara_pihak4) x ORDER BY 1`);
    pids = r.rows.map(x => Number(x.perkara_id));
    const m = /^contoh:(\d+)$/.exec(arg);
    if (m) { const n = Number(m[1]); const langkah = Math.max(1, Math.floor(pids.length / n)); pids = pids.filter((_, i) => i % langkah === 0); }
  }
  c0.end();
  console.error(`perkara: ${pids.length}; variabel: ${VARS.join(',')}; sebelum=${DB_SEB} sesudah=${DB_SES}`);
  const hasil = { total: pids.length, beda: {}, sama: {}, galat: [], kosongSama: {}, contohBeda: {} };
  for (const n of VARS) { hasil.beda[n] = []; hasil.sama[n] = 0; hasil.kosongSama[n] = 0; }
  let idx = 0;
  let selesai = 0;
  async function pekerja() {
    let conn = koneksi();
    await qc(conn, 'SET SESSION TRANSACTION READ ONLY');
    const BATAS = Number(process.env.BATAS_CONTOH || 1500);
    while (idx < pids.length) {
      const pid = pids[idx++];
      let galat, hsl;
      // koneksi yang mati (waktu habis, laptop tidur) dibuat ulang dan perkara itu diulang, supaya galat sambungan tidak merusak seluruh hasil
      for (let coba = 0; coba < 3; coba++) {
        galat = [];
        hsl = [];
        const A = { V: Vs, db: DB_SEB, memo: new Map(), conn, galat };
        const B = { V: Vp, db: DB_SES, memo: new Map(), conn, galat };
        for (const n of VARS) {
          const a = await evalVar(A, String(n), pid, []);
          const b = await evalVar(B, String(n), pid, []);
          hsl.push([n, a.value == null ? null : String(a.value), b.value == null ? null : String(b.value)]);
        }
        if (!galat.some((g) => /^PROTOCOL_/.test(g.err))) break;
        console.error(`koneksi mati pada perkara ${pid} (percobaan ${coba + 1}): dibuat ulang`);
        try { conn.destroy(); } catch (e) { /* abaikan */ }
        conn = koneksi();
        await qc(conn, 'SET SESSION TRANSACTION READ ONLY');
      }
      for (const [n, sa, sb] of hsl) {
        if (sa === sb) { hasil.sama[n]++; if (!sa || sa === 'DATA_TIDAK_ADA' || sa === '') hasil.kosongSama[n]++; }
        else { hasil.beda[n].push(pid); if (!hasil.contohBeda[n]) hasil.contohBeda[n] = []; if (hasil.contohBeda[n].length < 40) hasil.contohBeda[n].push({ pid, sebelum: (sa || '').slice(0, BATAS), sesudah: (sb || '').slice(0, BATAS), pjSeb: (sa || '').length, pjSes: (sb || '').length }); }
      }
      for (const g of galat) hasil.galat.push(g);
      selesai++;
      if (selesai % Number(process.env.CETAK_TIAP || 25) === 0) console.error(`${selesai}/${pids.length} ${new Date().toISOString().slice(11, 19)}`);
    }
    conn.end();
  }
  await Promise.all(Array.from({ length: PEKERJA }, pekerja));
  fs.writeFileSync(process.env.KELUAR || 'D:/Aplikasi/aleta/tmp/w109/bandingkan.json', JSON.stringify(hasil));
  const ring = {};
  for (const n of VARS) ring[n] = { sama: hasil.sama[n], kosongSama: hasil.kosongSama[n], beda: hasil.beda[n].length, contohPid: hasil.beda[n].slice(0, 12) };
  console.log(JSON.stringify({ total: hasil.total, galat: hasil.galat.length, ring }, null, 1));
})();
