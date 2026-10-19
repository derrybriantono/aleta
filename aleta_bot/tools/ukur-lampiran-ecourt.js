#!/usr/bin/env node
"use strict";

/**
 * ============================================================================
 * UKUR PEMBACA LAMPIRAN e-COURT (19 Okt 2026, OCR-ECOURT) - BACA SAJA
 * ============================================================================
 *
 *   docker exec -i aleta-bot node tools/ukur-lampiran-ecourt.js [--json]
 *
 * HANYA SELECT - tidak menulis ke SIPP, ABT, maupun aleta_bot. Mengukur HASIL penyapu latar portal yang tersimpan di
 * aleta_bot_lampiran_medan (jalankan sesudah penyapu sempat bekerja) terhadap ISIAN PETUGAS:
 *   - butir alat bukti yang diketik petugas di ABT (1214, 9958, 0378, 9955, 9956, 9957, 9911): nomor dan tanggal KK,
 *     akta kelahiran, akta kematian, akta cerai, surat keterangan desa;
 *   - tanggal surat kuasa di SIPP perkara_pengacara (pihak 1 / 2) dan ABT 0184/0185;
 *   - nomor/tanggal kutipan akta nikah di SIPP perkara_data_pernikahan (kalibrasi; isiannya sudah dari SIPP).
 * Satu perkara dihitung sekali per medan. Keputusan "otomatis" HANYA bila cocok >= 95% dengan >= 20 perkara terbaca;
 * bila ya, tambahkan medannya ke TINGKAT_TERUKUR di services/lampiranEcourtService.js dan catat di
 * docs/isi-sipp-abt/UKURAN-OCR-ECOURT.json. Keluaran angka saja (tanpa nama/NIK/nomor).
 */

const mysql = require("mysql");
const L = require("../services/lampiranEcourtService");

const SIPP = process.env.ALETA_BOT_DB_SIPP_NAME || "SIPP";
const BOT = process.env.ALETA_BOT_INTERNAL_DB_NAME || process.env.ALETA_BOT_DB_NAME || "aleta_bot";
const ABT = process.env.ALETA_BOT_DB_APS_NAME || "aps_badilag";
for (const n of [SIPP, BOT, ABT]) if (!/^[A-Za-z0-9_]+$/.test(n)) process.exit(2);

const k = mysql.createConnection({
  host: process.env.ALETA_BOT_DB_HOST || "127.0.0.1",
  port: Number(process.env.ALETA_BOT_DB_PORT || 3306),
  user: process.env.ALETA_BOT_DB_USER || "root",
  password: process.env.ALETA_BOT_DB_PASSWORD || "",
  charset: "utf8mb4",
  dateStrings: true,
});
const q = (sql, p) => new Promise((ok, no) => k.query(sql, p || [], (e, r) => (e ? no(e) : ok(r))));

const KELAS = [
  ["kk", /kartu\s+keluarga/i],
  ["akta_lahir", /akta?e?\s+kelahiran/i],
  ["akta_kematian", /akta?e?\s+kematian/i],
  ["akta_cerai", /akta\s+cerai/i],
  ["sk_desa", /surat\s+keterangan(?!.*(?:kua|kantor\s+urusan))/i],
];
const RE_NO = /(?:nomor|no\.?)\s*[:.]?\s*([A-Za-z0-9][^,;]*?\d[^,;]*?)(?=\s*(?:,|;|\btanggal\b|\btgl\b|\byang\b|\batas\b|\ban\.|\ba\.n\b|\btertanggal\b|\bdikeluarkan\b|$))/i;
const RE_TGL = /(?:tanggal|tgl\.?|tertanggal)\s*[:.]?\s*(\d{1,2}[\s\-/.]*[A-Za-z]{3,10}\.?[\s\-/.,]*\d{4}|\d{1,2}[\-/.]\d{1,2}[\-/.]\d{4})/i;
const normNo = (x) => String(x || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
const samaNo = (a, b) => {
  const x = normNo(a);
  const y = normNo(b);
  return x === y || (y.length >= 8 && x.startsWith(y)) || (x.length >= 8 && y.startsWith(x));
};
const iso = (x) => (x ? String(x).slice(0, 10) : "");

(async () => {
  const medan = await q(`SELECT m.perkara_id AS perkaraId, m.jenis, m.medan, m.pihak FROM ${BOT}.aleta_bot_lampiran_medan m WHERE m.perkara_id IS NOT NULL`);
  const perPerkara = new Map();
  for (const r of medan) {
    let m = {};
    let p = [];
    try {
      m = JSON.parse(r.medan);
      p = JSON.parse(r.pihak || "[]");
    } catch (_) {
      /* baris rusak dilewati */
    }
    const id = Number(r.perkaraId);
    if (!perPerkara.has(id)) perPerkara.set(id, []);
    perPerkara.get(id).push({ jenis: r.jenis, medan: m, pihak: p });
  }
  const ids = [...perPerkara.keys()];
  const hasil = { perkaraBermedan: ids.length, medan: {} };
  if (!ids.length) {
    console.log(JSON.stringify(hasil, null, 1));
    return k.end();
  }
  const daftar = ids.join(",");
  const teks = await q(`SELECT perkara_id, data FROM ${ABT}.abt_data_teks WHERE no_var IN (1214,9958,378,9955,9956,9957,9911) AND perkara_id IN (${daftar})`);
  const tgl = await q(`SELECT perkara_id, no_var, data FROM ${ABT}.abt_data_tanggal WHERE no_var IN (184,185) AND perkara_id IN (${daftar}) AND data IS NOT NULL`);
  const kuasa = await q(`SELECT perkara_id, pihak_ke, tanggal_kuasa FROM ${SIPP}.perkara_pengacara WHERE perkara_id IN (${daftar}) AND tanggal_kuasa IS NOT NULL`);
  const nikah = await q(`SELECT perkara_id, no_kutipan_akta_nikah, tgl_kutipan_akta_nikah FROM ${SIPP}.perkara_data_pernikahan WHERE perkara_id IN (${daftar})`);
  const nilai = (kunci, petugas, dibaca, sama) => {
    const p = [...new Set(petugas.filter(Boolean))];
    if (!p.length) return;
    const r = (hasil.medan[kunci] = hasil.medan[kunci] || { perkara: 0, terbaca: 0, cocok: 0, beda: 0 });
    r.perkara += 1;
    const d = [...new Set(dibaca.filter(Boolean))];
    if (!d.length) return;
    r.terbaca += 1;
    if (d.some((v) => p.some((x) => sama(v, x)))) r.cocok += 1;
    else r.beda += 1;
  };
  for (const id of ids) {
    const baca = perPerkara.get(id);
    const dari = (jenis, f) => baca.filter((b) => b.jenis === jenis).map(f);
    const petugas = {};
    for (const t of teks.filter((x) => Number(x.perkara_id) === id)) {
      for (const butir of String(t.data).replace(/<[^>]+>/g, "\n").split(/\n+|;\s*/)) {
        const kl = KELAS.find(([, re]) => re.test(butir));
        if (!kl) continue;
        const x = (petugas[kl[0]] = petugas[kl[0]] || { nomor: [], tanggal: [] });
        const no = RE_NO.exec(butir);
        if (no && /\d{3}/.test(no[1])) x.nomor.push(no[1]);
        const tg = RE_TGL.exec(butir);
        const tt = tg ? L.uraiTanggal(tg[1].replace(/\s+/g, " ")) : null;
        if (tt) x.tanggal.push(tt.iso);
      }
    }
    for (const [jenis, x] of Object.entries(petugas)) {
      nilai(`${jenis}.nomor`, x.nomor, dari(jenis, (b) => b.medan.nomor), samaNo);
      nilai(`${jenis}.tanggal`, x.tanggal, dari(jenis, (b) => b.medan.tanggal && b.medan.tanggal.iso), (a, b) => a === b);
    }
    for (const pk of [1, 2]) {
      const dibaca = baca.filter((b) => /kuasa/.test(b.jenis) && b.medan.tanggal && L.cabangKuasa(b) === pk).map((b) => b.medan.tanggal.iso);
      nilai(`surat_kuasa.tanggal.pihak${pk}`, kuasa.filter((x) => Number(x.perkara_id) === id && Number(x.pihak_ke) === pk).map((x) => iso(x.tanggal_kuasa)), dibaca, (a, b) => a === b);
      nilai(`surat_kuasa.tanggal.pihak${pk}.abt`, tgl.filter((x) => Number(x.perkara_id) === id && Number(x.no_var) === (pk === 1 ? 184 : 185)).map((x) => iso(x.data)), dibaca, (a, b) => a === b);
    }
    const n = nikah.find((x) => Number(x.perkara_id) === id);
    if (n) {
      nilai("akta_nikah.nomor.sipp", [/\d/.test(n.no_kutipan_akta_nikah || "") ? n.no_kutipan_akta_nikah : ""], dari("akta_nikah", (b) => b.medan.nomor), samaNo);
      nilai("akta_nikah.tanggal.sipp", [iso(n.tgl_kutipan_akta_nikah)], dari("akta_nikah", (b) => b.medan.tanggal && b.medan.tanggal.iso), (a, b) => a === b);
    }
  }
  for (const r of Object.values(hasil.medan)) {
    r.persen = r.terbaca ? Math.round((r.cocok / r.terbaca) * 1000) / 10 : null;
    r.memenuhiAmbang = r.terbaca >= 20 && r.persen >= 95;
  }
  console.log(JSON.stringify(hasil, null, 1));
  k.end();
})().catch((e) => {
  console.error(String(e.message || e).slice(0, 300));
  k.end();
  process.exit(1);
});
