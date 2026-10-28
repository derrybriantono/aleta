"use strict";

/**
 * ============================================================================
 * UJI KERING PUTUS IKRAR TIGA STATUS ATAS SALINAN SIPP LAPTOP (28 Okt 2026, T5)
 * ============================================================================
 *
 * Menyusun rencana tombol PUTUS sidang ikrar (sidangHasilService.susunRencanaPutusIkrar)
 * untuk SETIAP sidang ikrar terakhir yang sudah berpenetapan di salinan SIPP laptop
 * (bawaan `sipp_donggala`, data s.d. 9 Okt 2026), dengan status yang SUNGGUH dicatat
 * petugas (1/2/3), lalu menjalankannya KERING (penjaga tanda + daftar putih). BACA SAJA:
 * db_config diganti kolam MySQL laptop yang MENOLAK setiap perintah tulis sebelum
 * sampai ke basis data. Tidak pernah menyentuh SIPP satker.
 *
 * Dua putaran:
 *   A "apa adanya": form & jadwal sudah diisi petugas -> harus idempoten (form dilewati,
 *     jadwal yang hasilnya sama tidak ditulis ulang) atau ditolak dengan sebab yang jelas.
 *   B "seolah belum diisi": baris form/jadwal yang dibaca DIKOSONGKAN di memori ->
 *     rencana lengkap: PP ikrar, ketua majelis ikrar, amar per status, jam dua akun
 *     (penetapan 1-1800 dtk sesudah keterangan, <= jam SIPP), audit jadwal 13 kolom.
 *
 * Pakai (dari aleta_bot/, NODE_PATH = node_modules bot):
 *   SIPP_DB=sipp_donggala DARI=2025-01-01 node scripts/verify-ikrar-putus-sipp-lokal.js
 */

const path = require("path");
const mysql = require("mysql");

const SIPP_DB = process.env.SIPP_DB || "sipp_donggala";
const DARI = process.env.DARI || "2025-01-01";
const TULIS = /^\s*(INSERT|UPDATE|DELETE|REPLACE|CREATE|DROP|ALTER|TRUNCATE|CALL|START|COMMIT|ROLLBACK)\b/i;

const kolam = mysql.createPool({ host: "127.0.0.1", user: "root", database: SIPP_DB, connectionLimit: 4, dateStrings: false });
let putaran = "A";
const query = (sql, params, cb) => {
  const balik = typeof params === "function" ? params : cb;
  const p = Array.isArray(params) ? params : [];
  const teks = typeof sql === "string" ? sql : String((sql && sql.sql) || "");
  if (TULIS.test(teks)) return balik(new Error(`perintah tulis ditolak (uji baca saja): ${teks.slice(0, 40)}`));
  kolam.query(sql, p, (g, h) => {
    if (g || putaran !== "B" || !Array.isArray(h)) return balik(g, h);
    // Putaran B: form ikrar & hasil sidang "belum diisi" (di memori saja).
    if (/AS adaBarisIkrar/.test(teks)) {
      for (const r of h) Object.assign(r, { tglIkrar: null, statusIkrar: null, amarIkrar: null, ditunda: "T", alasanDitunda: "0", keterangan: null });
    } else if (/AS alasanDitundaAsli/.test(teks)) {
      for (const r of h) Object.assign(r, { ditunda: "T", alasanDitunda: "0", alasanDitundaAsli: "0", keterangan: null });
    }
    return balik(g, h);
  });
};
const dbPath = require.resolve(path.join(__dirname, "..", "db_config.js"));
require.cache[dbPath] = {
  id: dbPath,
  filename: dbPath,
  loaded: true,
  exports: { query, getConnection: (cb) => cb(new Error("transaksi tidak dipakai pada uji kering")) },
};
// Antrian sidang (basis turunan) tidak ada di laptop: tanpa antrian.
const extPath = require.resolve(path.join(__dirname, "..", "services", "externalDbService.js"));
require.cache[extPath] = { id: extPath, filename: extPath, loaded: true, exports: { query: async () => [] } };

const layanan = require("../services/sidangHasilService");

const kueri = (sql, p = []) => new Promise((ok, gagal) => kolam.query(sql, p, (g, h) => (g ? gagal(g) : ok(h))));
const detik = (s) => Date.parse(`${String(s).replace(" ", "T")}Z`) / 1000;
const KOLOM_EDIT =
  "tanggal_sidang,jam_sidang,sampai_jam,agenda,dihadiri_oleh,alasan_ditunda,sifat_sidang,keterangan,diperbaharui_oleh,diperbaharui_tanggal,ruangan_id,ruangan,sidang_keliling";

async function main() {
  const sidang = await kueri(
    `SELECT j.id AS jadwalId, j.perkara_id AS perkaraId, j.dihadiri_oleh AS dihadiri,
            it.status_penetapan_ikrar_talak_id AS status
       FROM perkara_ikrar_talak it
       JOIN perkara_jadwal_sidang j ON j.perkara_id = it.perkara_id AND j.ikrar_talak = 'Y'
        AND j.tanggal_sidang = it.tgl_ikrar_talak
      WHERE it.tgl_ikrar_talak >= ? AND it.status_penetapan_ikrar_talak_id IN ('1','2','3')
      ORDER BY it.tgl_ikrar_talak`,
    [DARI]
  );
  console.log(`basis ${SIPP_DB}: ${sidang.length} sidang ikrar berpenetapan sejak ${DARI}`);
  for (const p of ["A", "B"]) {
    putaran = p;
    const hitung = {};
    const tambah = (k) => (hitung[k] = (hitung[k] || 0) + 1);
    const masalah = [];
    let jedaMin = Infinity;
    let jedaMaks = 0;
    for (const s of sidang) {
      const status = Number(s.status);
      const r = await layanan.susunRencanaPutusIkrar({
        jadwalId: s.jadwalId,
        statusIkrar: status,
        ikrarDilaksanakan: status === 1,
        konfirmasiStatus: status !== 1,
        dihadiriOleh: Number(s.dihadiri) || undefined,
        ip: "192.168.9.82",
        operator: "uji-kering",
        ambilBiaya: async () => null,
        acak: Math.random,
      });
      if (!r.ok) {
        tambah(`s${status} tolak:${r.alasan}`);
        continue;
      }
      const k = await layanan.jalankanRencanaUtuh(r, { kering: true });
      if (!k.ok) {
        tambah(`s${status} kering-gagal:${k.alasan}`);
        masalah.push(`${s.perkaraId} kering ${k.alasan}`);
        continue;
      }
      const audit = r.langkah.filter((l) => l.tabel === "sys_audittrail");
      const jadwal = audit.find((a) => a.params[3] === "perkara_jadwal_sidang");
      const form = audit.find((a) => a.params[3] === "perkara_ikrar_talak");
      tambah(
        `s${status} ok jadwal:${r.jadwalSudahTercatat ? "sudah" : "tulis"} form:${
          r.formIkrar && r.formIkrar.sudahTerisi ? "sudah" : r.formIkrar && r.formIkrar.ok ? "tulis" : `belum(${r.formIkrar && r.formIkrar.alasan})`
        }`
      );
      if (jadwal) {
        const kolom = [...String(jadwal.params[7]).matchAll(/<tr><td>([^<]*)<\/td>/g)].map((m) => m[1]).join(",");
        if (kolom !== KOLOM_EDIT) masalah.push(`${s.perkaraId} audit jadwal kolom ${kolom}`);
        if (detik(jadwal.params[0]) > detik(r.saat)) masalah.push(`${s.perkaraId} jam jadwal di depan jam SIPP`);
      }
      if (jadwal && form) {
        const d = detik(form.params[0]) - detik(jadwal.params[0]);
        jedaMin = Math.min(jedaMin, d);
        jedaMaks = Math.max(jedaMaks, d);
        if (d < 1 || d > 1800) masalah.push(`${s.perkaraId} jeda ${d} dtk`);
        if (form.params[2] === jadwal.params[2]) tambah("akun jadwal = akun penetapan");
      }
      if (form && detik(form.params[0]) > detik(r.saat)) masalah.push(`${s.perkaraId} jam penetapan di depan jam SIPP`);
      const isi = r.langkah.find((l) => l.tabel === "perkara_ikrar_talak");
      if (isi && Number(isi.params[1]) !== status) masalah.push(`${s.perkaraId} status ditulis ${isi.params[1]} harap ${status}`);
      if (/aleta/i.test(JSON.stringify(r.langkah.map((l) => l.params)))) masalah.push(`${s.perkaraId} KATA ALETA`);
    }
    console.log(`\n== putaran ${p} ${p === "A" ? "(apa adanya)" : "(seolah belum diisi)"}`);
    for (const [k, n] of Object.entries(hitung).sort()) console.log(`  ${String(n).padStart(4)}  ${k}`);
    if (Number.isFinite(jedaMin)) console.log(`  jeda keterangan->penetapan: ${jedaMin}-${jedaMaks} dtk`);
    console.log(`  masalah: ${masalah.length}${masalah.length ? `\n    ${masalah.slice(0, 20).join("\n    ")}` : ""}`);
  }
  kolam.end();
}

main().catch((e) => {
  console.error("GAGAL", e && e.stack);
  kolam.end();
  process.exit(1);
});
