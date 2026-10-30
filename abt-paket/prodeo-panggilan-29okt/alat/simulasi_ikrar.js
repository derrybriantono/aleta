// Simulasi teks amar penetapan ikrar yang AKAN ditulis ALETA ke SIPP (aleta_bot/services/ikrarTalakService.js susunAmarIkrar),
// atas data nyata sipp_2810 (BACA SAJA): biaya ikrar = #1101# ABT (#1090# + #1164#: biaya panggilan terakhir Pemohon/Termohon),
// terbilang = isian_rtf_terbilang (sama dengan #2050#), nama pengadilan = sys_config NamaPN, tahun = tahun pendaftaran.
// pakai: node simulasi_ikrar.js <perkara_id>[:prodeo] ...   (":prodeo" = paksa prodeo untuk simulasi; data tidak diubah)
'use strict';
const path = require('path');
const mysql = require(process.env.MYSQL_MODUL || 'D:/aleta-dev/wt/w33/aleta_bot/node_modules/mysql');
const ik = require(path.resolve(__dirname, '../../../aleta_bot/services/ikrarTalakService'));
const c = mysql.createConnection({ host: '127.0.0.1', user: 'root', database: 'sipp_2810', dateStrings: true });
const q = (sql, p = []) => new Promise((res, rej) => c.query(sql, p, (e, r) => (e ? rej(e) : res(r))));

(async () => {
  const pn = await q("SELECT value FROM sys_config WHERE name = 'NamaPN' LIMIT 1");
  const namaPengadilan = ik.hurufJudul(pn[0] ? pn[0].value : '');
  for (const a of process.argv.slice(2)) {
    const [idTeks, paksa] = a.split(':');
    const id = Number(idTeks);
    const [p] = await q('SELECT nomor_perkara, pihak1_text, pihak2_text, prodeo, YEAR(tanggal_pendaftaran) AS tahun FROM perkara WHERE perkara_id = ?', [id]);
    const satu = async (jenis) => {
      const r = await q(`SELECT jumlah FROM perkara_biaya WHERE perkara_id = ? AND jenis_biaya_id IN (${jenis}) ORDER BY tanggal_transaksi DESC LIMIT 1`, [id]);
      return r[0] ? Number(r[0].jumlah) : 0;
    };
    const jumlah = (await satu('12,13')) + (await satu('14,15'));
    const [t] = await q('SELECT pp29_fn.isian_rtf_terbilang(?) AS t', [jumlah.toFixed(2)]);
    const angka = jumlah.toLocaleString('id-ID').replace(/,/g, '.');
    const biaya = ik.bacaBiayaIkrar({ 1101: { status: 'terisi', teks: angka }, 2050: { status: 'terisi', teks: t.t } });
    const prodeo = paksa === 'prodeo' || Number(p.prodeo) === 1;
    const amar = ik.susunAmarIkrar(1, { pihak1: 'Pemohon X', pihak2: 'Termohon Y', biaya, prodeo, namaPengadilan, tahunDaftar: p.tahun });
    const butir = (amar.match(/<li>(Membebankan[^<]*)<\/li>/) || [])[1] || '(tidak tersusun)';
    console.log(`${p.nomor_perkara} | prodeo ${prodeo ? 'ya' + (paksa ? ' (simulasi)' : '') : 'tidak'} | biaya ikrar Rp${angka} -> ${butir}`);
    console.log(`   aleta di teks: ${/aleta/i.test(amar) ? 'ADA' : 'tidak'}; panjang amar ${amar.length}`);
  }
  c.end();
})().catch((e) => { console.error(e); c.end(); process.exit(1); });
