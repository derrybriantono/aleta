#!/usr/bin/env node
"use strict";

/**
 * ============================================================================
 * UKUR DETEKSI TEMPAT TINGGAL BERSAMA (KDL2 11 Okt 2026) - BACA SAJA
 * ============================================================================
 *
 * Dua tulisan bebas oleh orang berbeda tentang hal yang sama dibandingkan:
 *   - POSITA SIPP (perkara.posita) - ditulis pihak/kuasa/meja 1;
 *   - jawaban saksi ABT atas "Dimana ... tinggal (bersama) setelah menikah?"
 *     (aps_badilag.abt_keterangan_saksi) - ditulis PP di persidangan.
 * Per ruas pertama & terakhir: jenis tempat + sisi pemilik ("orang-tua:lawan" =
 * rumah orang tua Penggugat) dianggap tepat bila sama. "rumah saya" saksi
 * dipetakan lewat Keterangan saksi SIPP (ibu kandung Penggugat -> rumah orang tua
 * Penggugat). Juga: nama desa/kelurahan, berpindah-pindah, cakupan, dan isian
 * 1006 petugas (34 perkara).
 *
 *   node tools/ukur-deteksi-tempat-tinggal.js [--json hasil.json] [--sampel 15]
 *
 * Sambungan: MYSQL_HOST/MYSQL_USER/MYSQL_PASSWORD; DB --sipp (sipp_donggala) --abt (aps_badilag).
 * Tidak ada satu pun tulisan ke basis data.
 */

const fs = require("fs");
const mysql = require("mysql");
const tt = require("../services/deteksiTempatTinggalService");
const ds = require("../services/deteksiSaksiService");

function argumen(nama, bawaan) {
  const i = process.argv.indexOf(`--${nama}`);
  return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : bawaan;
}
const DB_SIPP = argumen("sipp", "sipp_donggala");
const DB_ABT = argumen("abt", "aps_badilag");
const KELUAR = argumen("json", "");
const SAMPEL = Number(argumen("sampel", "15"));
if (!/^\w+$/.test(DB_SIPP) || !/^\w+$/.test(DB_ABT)) throw new Error("Nama basis data tidak sah.");

const pool = mysql.createPool({
  host: process.env.MYSQL_HOST || "127.0.0.1",
  user: process.env.MYSQL_USER || "root",
  password: process.env.MYSQL_PASSWORD || "",
  connectionLimit: 2,
  charset: "utf8mb4",
});
const kueri = (sql, nilai = []) => new Promise((ok, gagal) => pool.query(sql, nilai, (e, r) => (e ? gagal(e) : ok(r))));
const persen = (a, b) => (b ? `${((100 * a) / b).toFixed(1)}%` : "-");

function tambah(peta, kunci, tepat) {
  const s = peta[kunci] || (peta[kunci] = { n: 0, tepat: 0, salahTangkap: 0 });
  s.n += 1;
  if (tepat) s.tepat += 1;
  else s.salahTangkap += 1;
}

/** Nama desa/kelurahan pertama di alamat ruas, dibakukan. */
function namaDesa(alamat) {
  const m = String(alamat || "").match(/\b(?:desa|kelurahan|kel\.|dusun|kota|kecamatan|kabupaten)\s+([a-z0-9][a-z0-9' ]*?)(?=\s*(?:,|kecamatan|kabupaten|kota|provinsi|kec\.|kab\.|rt\b|$))/i);
  return m ? m[1].toLowerCase().replace(/\s+/g, " ").replace(/\s+(?:i|ii|iii|satu|dua)$/, (x) => x).trim() : "";
}

async function utama() {
  const mulai = Date.now();
  const perkara = await kueri(
    `SELECT p.perkara_id, p.nomor_perkara, p.posita
       FROM ${DB_SIPP}.perkara p
       JOIN ${DB_SIPP}.perkara_putusan pp ON pp.perkara_id = p.perkara_id AND pp.tanggal_putusan IS NOT NULL
      WHERE p.perkara_id IN (SELECT DISTINCT perkara_id FROM ${DB_ABT}.abt_keterangan_saksi)`
  );
  const jawab = await kueri(
    `SELECT k.perkara_id, k.saksi_id, p5.urutan, p5.keterangan, k.jawaban
       FROM ${DB_ABT}.abt_keterangan_saksi k
       JOIN ${DB_SIPP}.perkara_pihak5 p5 ON p5.id = k.saksi_id
      WHERE k.pertanyaan REGEXP '(di ?mana|dimanakah).*(tinggal|bertempat|membina).*(setelah|sesudah) (menikah|pernikahan|perkawinan)'
         OR k.pertanyaan REGEXP '(setelah|sesudah) (menikah|pernikahan).*(di ?mana|dimanakah).*(tinggal|bertempat)'
      ORDER BY k.perkara_id, p5.urutan, k.id`
  );
  const isian = await kueri(`SELECT perkara_id, data FROM ${DB_ABT}.abt_data_teks WHERE no_var+0 = 1006 AND data IS NOT NULL AND TRIM(data) <> ''`);
  const saksiPer = new Map();
  for (const j of jawab) {
    if (!saksiPer.has(j.perkara_id)) saksiPer.set(j.perkara_id, new Map());
    const m = saksiPer.get(j.perkara_id);
    if (!m.has(j.saksi_id)) m.set(j.saksi_id, j);
  }
  const isi1006 = new Map(isian.map((r) => [r.perkara_id, String(r.data)]));

  const hasil = {
    dibuat: new Date().toISOString(),
    perkara: perkara.length,
    cakupan: { positaAdaRiwayat: 0, positaTidakSerumah: 0, jawabanSaksi: 0, jawabanAdaRuas: 0, jawabanRumahSaksi: 0, rumahSaksiDipetakan: 0 },
    pertama: {},
    terakhir: {},
    perPola: {},
    desa: { n: 0, tepat: 0, salahTangkap: 0 },
    berpindah: { n: 0, tepat: 0, salahTangkap: 0 },
    banyakRuas: { n: 0, tepat: 0, salahTangkap: 0 },
    isian1006: { n: 0, awalSama: 0, jenisSama: 0, contoh: [] },
    usulan: { kartu1006: 0, kartu8570: 0, keyakinan: {} },
    sampel: {},
    salahContoh: [],
    tidakDapatDibandingkan: {},
    ketat: {},
  };
  const sampel = (jenis, teks) => {
    const s = (hasil.sampel[jenis] = hasil.sampel[jenis] || []);
    if (s.length < 400) s.push(teks);
  };

  for (const p of perkara) {
    const rp = tt.riwayat(tt.butirDari(p.posita), {});
    if (rp.ruas.length) hasil.cakupan.positaAdaRiwayat += 1;
    if (rp.tidakPernahSerumah) hasil.cakupan.positaTidakSerumah += 1;
    for (const r of rp.ruas) sampel(r.jenis, `${p.nomor_perkara} | ${r.jenis}${r.sisi ? ":" + r.sisi : ""} | ${r.tempat} || ${rp.kalimat.slice(0, 160)}`);

    // isian petugas 1006
    if (isi1006.has(p.perkara_id)) {
      const m = isi1006.get(p.perkara_id).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      hasil.isian1006.n += 1;
      const awal = (x) => x.toLowerCase().replace(/^di\s+/, "").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim().slice(0, 35);
      const sama = Boolean(rp.potongan) && awal(rp.potongan) === awal(m);
      if (sama) hasil.isian1006.awalSama += 1;
      const jm = tt.riwayat([`Setelah menikah Penggugat dan Tergugat tinggal bersama di ${m.replace(/^di\s+/i, "")}`], {});
      const jenisSama = Boolean(rp.ruas[0] && jm.ruas[0]) && tt.sidikRuas(rp.ruas[0]) === tt.sidikRuas(jm.ruas[0]);
      if (jenisSama) hasil.isian1006.jenisSama += 1;
      if (hasil.isian1006.contoh.length < 40) hasil.isian1006.contoh.push({ nomor: p.nomor_perkara, petugas: m.slice(0, 120), usulan: rp.potongan.slice(0, 120), awalSama: sama, jenisSama });
    }

    // kartu usulan (perilaku produksi) atas posita + dua saksi pertama
    const sk = saksiPer.has(p.perkara_id) ? [...saksiPer.get(p.perkara_id).values()].sort((a, b) => a.urutan - b.urutan) : [];
    const hub = sk.slice(0, 2).map((s) => {
      const h = ds.deteksiHubungan(String(s.keterangan || ""), { bentuk: "label" });
      if (!h) return null;
      const e = (h.ekor || []).join(" ");
      return { ...h, sisi: /tergugat|termohon/.test(e) ? "pelaku" : /penggugat|pemohon/.test(e) ? "lawan" : "" };
    });
    const kartu = tt.usulanTempatTinggal({ posita: p.posita, saksi1: sk[0] ? sk[0].jawaban : "", saksi2: sk[1] ? sk[1].jawaban : "", hubunganSaksi: hub });
    for (const u of kartu.usulan) {
      if (!u.nilai) continue;
      hasil.usulan[`kartu${u.kode}`] += 1;
      hasil.usulan.keyakinan[`${u.kode} ${u.keyakinan}`] = (hasil.usulan.keyakinan[`${u.kode} ${u.keyakinan}`] || 0) + 1;
    }

    // pasangan posita - tiap saksi
    for (const [i, s] of sk.entries()) {
      hasil.cakupan.jawabanSaksi += 1;
      let rs = tt.riwayat(tt.butirDari(s.jawaban), { saksi: true });
      if (!rs.ruas.length) continue;
      hasil.cakupan.jawabanAdaRuas += 1;
      if (rs.ruas.some((x) => x.jenis === "rumah-saksi")) {
        hasil.cakupan.jawabanRumahSaksi += 1;
        const h = i < 2 ? hub[i] : null;
        rs = { ...rs, ruas: rs.ruas.map((x) => tt.ruasSaksiDipetakan(x, h)) };
        if (rs.ruas.some((x) => x.dipetakan)) hasil.cakupan.rumahSaksiDipetakan += 1;
      }
      if (!rp.ruas.length) continue;
      const bandingkan = (wadah, a, b, label) => {
        if (!a || !b) return;
        // cocokRuas: pemilik tak disebut di salah satu sumber tidak menyalahkan; ruas tanpa
        // pemilik (alamat saja / rumah saksi tak terpetakan) hanya dibandingkan desanya.
        const ok = tt.cocokRuas(a, b);
        if (ok === null) {
          hasil.tidakDapatDibandingkan[label] = (hasil.tidakDapatDibandingkan[label] || 0) + 1;
          return;
        }
        tambah(hasil.ketat, `${label} ${tt.sidikRuas(a) === tt.sidikRuas(b) ? "persis" : ok ? "setara (pemilik tak disebut satu sumber)" : "beda"}`, true);
        tambah(wadah, tt.sidikRuas(a), ok);
        tambah(hasil.perPola, `${(a.kodePola || [])[0] || a.jenis}|posita`, ok);
        tambah(hasil.perPola, `${(b.kodePola || [])[0] || b.jenis}|saksi`, ok);
        if (!ok && hasil.salahContoh.length < 60) hasil.salahContoh.push({ nomor: p.nomor_perkara, bagian: label, posita: `${tt.sidikRuas(a)} ${a.tempat}`, saksi: `${tt.sidikRuas(b)} ${b.tempat}`, jawaban: String(s.jawaban).slice(0, 180) });
      };
      bandingkan(hasil.pertama, rp.ruas[0], rs.ruas[0], "pertama");
      bandingkan(hasil.terakhir, rp.ruas[rp.ruas.length - 1], rs.ruas[rs.ruas.length - 1], "terakhir");
      const d1 = namaDesa(rp.ruas[0].alamat);
      const d2 = namaDesa(rs.ruas[0].alamat);
      if (d1 && d2) {
        hasil.desa.n += 1;
        if (d1 === d2 || d1.startsWith(d2) || d2.startsWith(d1)) hasil.desa.tepat += 1;
        else hasil.desa.salahTangkap += 1;
      }
      if (rp.berpindah || rs.berpindah) {
        hasil.berpindah.n += 1;
        if (rp.berpindah && rs.berpindah) hasil.berpindah.tepat += 1;
        else hasil.berpindah.salahTangkap += 1;
      }
      hasil.banyakRuas.n += 1;
      if ((rp.ruas.length > 1) === (rs.ruas.length > 1)) hasil.banyakRuas.tepat += 1;
      else hasil.banyakRuas.salahTangkap += 1;
    }
  }
  pool.end();
  const ringkas = (w) => Object.fromEntries(Object.entries(w).sort((a, b) => b[1].n - a[1].n).map(([k, v]) => [k, { ...v, ketepatan: persen(v.tepat, v.n) }]));
  hasil.pertama = ringkas(hasil.pertama);
  hasil.terakhir = ringkas(hasil.terakhir);
  hasil.perPola = ringkas(hasil.perPola);
  const jum = (w) => Object.values(w).reduce((a, v) => ({ n: a.n + v.n, tepat: a.tepat + v.tepat }), { n: 0, tepat: 0 });
  const p1 = jum(hasil.pertama);
  const p2 = jum(hasil.terakhir);
  console.log(`perkara diputus berketerangan saksi: ${hasil.perkara}; posita beriwayat ${hasil.cakupan.positaAdaRiwayat} (${persen(hasil.cakupan.positaAdaRiwayat, hasil.perkara)}), tidak pernah serumah ${hasil.cakupan.positaTidakSerumah}`);
  console.log(`jawaban saksi 'di mana tinggal setelah menikah': ${hasil.cakupan.jawabanSaksi}; beruas ${hasil.cakupan.jawabanAdaRuas} (${persen(hasil.cakupan.jawabanAdaRuas, hasil.cakupan.jawabanSaksi)}); rumah saksi ${hasil.cakupan.jawabanRumahSaksi}, dipetakan lewat hubungan ${hasil.cakupan.rumahSaksiDipetakan}`);
  console.log(`RUAS PERTAMA posita vs saksi: ${p1.tepat}/${p1.n} = ${persen(p1.tepat, p1.n)}; TERAKHIR ${p2.tepat}/${p2.n} = ${persen(p2.tepat, p2.n)}`);
  for (const [k, v] of Object.entries(hasil.pertama)) console.log(`  pertama ${k.padEnd(22)} n=${String(v.n).padStart(5)} tepat=${String(v.tepat).padStart(5)} ${v.ketepatan}`);
  for (const [k, v] of Object.entries(hasil.terakhir)) console.log(`  terakhir ${k.padEnd(21)} n=${String(v.n).padStart(5)} tepat=${String(v.tepat).padStart(5)} ${v.ketepatan}`);
  for (const [k, v] of Object.entries(hasil.perPola)) console.log(`  pola ${k.padEnd(40)} n=${String(v.n).padStart(5)} tepat=${String(v.tepat).padStart(5)} ${v.ketepatan}`);
  console.log("tak dapat dibandingkan", JSON.stringify(hasil.tidakDapatDibandingkan), "rincian", JSON.stringify(Object.fromEntries(Object.entries(hasil.ketat).map(([k, v]) => [k, v.n]))));
  console.log(`desa/kelurahan sama ${hasil.desa.tepat}/${hasil.desa.n} = ${persen(hasil.desa.tepat, hasil.desa.n)}; berpindah keduanya ${hasil.berpindah.tepat}/${hasil.berpindah.n}; satu vs banyak ruas sama ${persen(hasil.banyakRuas.tepat, hasil.banyakRuas.n)}`);
  console.log(`isian 1006 petugas n=${hasil.isian1006.n}: awal bunyi sama ${hasil.isian1006.awalSama}, jenis ruas pertama sama ${hasil.isian1006.jenisSama}`);
  console.log(`kartu: 1006 ${hasil.usulan.kartu1006}, 8570 ${hasil.usulan.kartu8570}; ${JSON.stringify(hasil.usulan.keyakinan)}`);
  // sampel tersebar per jenis untuk dibaca
  for (const [k, v] of Object.entries(hasil.sampel)) {
    const langkah = Math.max(1, Math.floor(v.length / SAMPEL));
    hasil.sampel[k] = v.filter((_, i) => i % langkah === 0).slice(0, SAMPEL);
  }
  console.log(`selesai ${((Date.now() - mulai) / 1000).toFixed(1)} dtk`);
  if (KELUAR) fs.writeFileSync(KELUAR, JSON.stringify(hasil, null, 1));
}

if (require.main === module) {
  utama().catch((e) => {
    console.error(e);
    pool.end();
    process.exit(1);
  });
}

module.exports = { namaDesa };
