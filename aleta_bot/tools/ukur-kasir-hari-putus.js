"use strict";

/**
 * ============================================================================
 * UKUR JURNAL KASIR PADA HARI PUTUS (13 Okt 2026) - HANYA MEMBACA
 * ============================================================================
 *
 * Bahan saklar "Kasir otomatis" (butir 10): baris apa yang ditulis kasir pada
 * HARI PUTUS menurut keadaan putusan - biasa (contradictoir), verstek,
 * dicabut, ditolak, tidak dapat diterima, digugurkan, perdamaian, dicoret,
 * permohonan, cerai talak dikabulkan.
 *
 * Basis data SIPP LOKAL saja (salinan satker). Hanya SELECT.
 *
 *   node tools/ukur-kasir-hari-putus.js [--db sipp_donggala] [--dari 2025-07-01] [--sampai 2026-10-13] [--uji-balik]
 *
 * --uji-balik: tiap perkara putus dijalankan SEOLAH hari putusnya hari ini -
 * jurnal bertanggal >= tanggal putus dibuang, lalu kasirOtomatisService.
 * rencanaOtomatis (seluruh butir) dibandingkan dengan baris yang sungguh
 * ditulis kasir hari itu: berapa baris otomatis yang SAMA jenis & jumlahnya
 * (ketepatan - yang penting untuk tulisan tanpa dilihat manusia) dan berapa
 * baris kasir yang terliput.
 *
 * Per golongan: jumlah perkara, persen perkara yang memuat tiap jenis biaya
 * BERTANGGAL hari putus (dan sesudahnya), nominal terbanyak, urutan tulis
 * (menurut id) terbanyak, serta apakah Pengembalian Sisa Panjar baris
 * terakhir dan saldonya habis.
 */

const mysql = require("mysql");

function argumen(nama, bawaan) {
  const i = process.argv.indexOf(`--${nama}`);
  return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : bawaan;
}

const DB = argumen("db", "sipp_donggala");
const DARI = argumen("dari", "2025-07-01");
const SAMPAI = argumen("sampai", "2026-10-13");

const pool = mysql.createPool({
  host: process.env.MYSQL_HOST || "127.0.0.1",
  user: process.env.MYSQL_USER || "root",
  password: process.env.MYSQL_PASSWORD || "",
  database: DB,
  connectionLimit: 4,
});
const kueri = (sql, params = []) =>
  new Promise((selesai, gagal) => pool.query(sql, params, (galat, hasil) => (galat ? gagal(galat) : selesai(hasil))));

const NAMA_JB = {
  29: "Biaya Pemberitahuan",
  151: "Pengembalian Sisa Panjar",
  152: "Meterai",
  157: "Redaksi",
  224: "Tambahan Panjar",
  260: "PNBP PBT Penggugat",
  389: "PNBP PBT Tergugat",
  404: "PNBP Pencabutan",
  252: "PNBP Relaas Pemberitahuan Isi Putusan (252)",
};

function golongan(p) {
  const s = Number(p.statusId) || 0;
  if (s === 7 || s === 67) return "dicabut";
  if (s === 65 || s === 93) return "digugurkan";
  if (s === 85) return "perdamaian";
  if (s === 63) return "ditolak";
  if (s === 64) return "tidak-diterima";
  if (s === 66) return "dicoret";
  if (Number(p.alur) === 16) return "permohonan";
  if (Number(p.jenis) === 346 && s === 62) return "cerai-talak-dikabulkan";
  if (String(p.verstek || "").toUpperCase() === "Y") return "verstek";
  if (s === 62) return "contradictoir";
  return `status-${s}`;
}

function modus(peta) {
  let terbaik = null;
  let n = 0;
  for (const [k, v] of peta) if (v > n) [terbaik, n] = [k, v];
  return { nilai: terbaik, n };
}

async function utama() {
  const perkara = await kueri(
    `SELECT p.perkara_id AS id, p.nomor_perkara AS nomor, p.alur_perkara_id AS alur, p.jenis_perkara_id AS jenis,
            DATE_FORMAT(pu.tanggal_putusan, '%Y-%m-%d') AS tPut, pu.status_putusan_id AS statusId, pu.putusan_verstek AS verstek,
            DATE_FORMAT(it.tgl_ikrar_talak, '%Y-%m-%d') AS tIkrar
       FROM perkara_putusan pu JOIN perkara p ON p.perkara_id = pu.perkara_id
       LEFT JOIN perkara_ikrar_talak it ON it.perkara_id = p.perkara_id
      WHERE pu.tanggal_putusan BETWEEN ? AND ?`,
    [DARI, SAMPAI]
  );
  const ids = perkara.map((p) => p.id);
  const jurnal = ids.length
    ? await kueri(
        `SELECT id, perkara_id AS pid, id_pembiayaan AS pemb, jenis_biaya_id AS jb, jenis_transaksi AS jt, urutan, uraian, jumlah,
                DATE_FORMAT(tanggal_transaksi, '%Y-%m-%d') AS t, DATE_FORMAT(diinput_tanggal, '%Y-%m-%d') AS tInput, diinput_oleh AS oleh
           FROM perkara_biaya WHERE tahapan_id = 10 AND perkara_id IN (?) ORDER BY perkara_id, id`,
        [ids]
      )
    : [];
  const perP = new Map();
  for (const b of jurnal) {
    if (!perP.has(b.pid)) perP.set(b.pid, []);
    perP.get(b.pid).push(b);
  }

  const kel = new Map();
  for (const p of perkara) {
    const baris = perP.get(p.id) || [];
    if (!baris.length) continue;
    if (baris.some((b) => Number(b.pemb) !== 1)) continue; // prodeo
    const g = golongan(p);
    if (!kel.has(g)) kel.set(g, { n: 0, hari: new Map(), sesudah: new Map(), jumlah: new Map(), urutan: new Map(), uraian: new Map(), sisaAkhir: 0, sisaAda: 0, tanpaSisaNol: 0, tanpaSisaPositif: 0, saldoNol: 0, sisaHariPutus: 0, sisaHariIkrar: 0, diinputHariItu: 0, barisHari: 0, contoh: [] });
    const k = kel.get(g);
    k.n += 1;
    const hariPutus = baris.filter((b) => Number(b.urutan) === 0 && b.t === p.tPut);
    const sesudah = baris.filter((b) => Number(b.urutan) === 0 && b.t > p.tPut);
    const jenisHari = new Set(hariPutus.map((b) => Number(b.jb)));
    const jenisSesudah = new Set(sesudah.map((b) => Number(b.jb)));
    for (const jb of jenisHari) k.hari.set(jb, (k.hari.get(jb) || 0) + 1);
    for (const jb of jenisSesudah) if (!jenisHari.has(jb)) k.sesudah.set(jb, (k.sesudah.get(jb) || 0) + 1);
    for (const b of [...hariPutus, ...sesudah]) {
      const jb = Number(b.jb);
      if (!k.jumlah.has(jb)) k.jumlah.set(jb, new Map());
      const m = k.jumlah.get(jb);
      const v = Number(b.jumlah) || 0;
      m.set(v, (m.get(v) || 0) + 1);
      if (!k.uraian.has(jb)) k.uraian.set(jb, new Map());
      const u = k.uraian.get(jb);
      const teks = String(b.uraian || "").replace(/\/[A-Z0-9]{6,}$/i, "/<resi>");
      u.set(teks, (u.get(teks) || 0) + 1);
    }
    const urut = hariPutus.map((b) => Number(b.jb)).join(">");
    if (urut) k.urutan.set(urut, (k.urutan.get(urut) || 0) + 1);
    k.barisHari += hariPutus.length;
    k.diinputHariItu += hariPutus.filter((b) => b.tInput === b.t).length;
    const sisa = baris.filter((b) => Number(b.jb) === 151);
    if (sisa.length) {
      k.sisaAda += 1;
      const terakhir = baris.slice().sort((a, b) => a.t.localeCompare(b.t) || a.id - b.id).pop();
      if (Number(terakhir.jb) === 151) k.sisaAkhir += 1;
      const saldo = baris.reduce((s, b) => s + Number(b.jt) * Number(b.jumlah), 0);
      if (saldo === 0) k.saldoNol += 1;
      if (sisa[0].t === p.tPut) k.sisaHariPutus += 1;
      if (p.tIkrar && sisa[0].t === p.tIkrar) k.sisaHariIkrar += 1;
    } else {
      const saldo = baris.reduce((s, b) => s + Number(b.jt) * Number(b.jumlah), 0);
      if (saldo === 0) k.tanpaSisaNol += 1;
      else if (saldo > 0) k.tanpaSisaPositif += 1;
    }
    if (k.contoh.length < 3 && hariPutus.length) k.contoh.push(`${p.nomor} ${p.tPut}: ${hariPutus.map((b) => `${b.uraian} ${b.jumlah}`).join(" | ")}`);
  }

  const persen = (a, b) => (b ? `${Math.round((a / b) * 100)}%` : "-");
  const urutGol = [...kel.entries()].sort((a, b) => b[1].n - a[1].n);
  console.log(`SIPP ${DB}, putusan ${DARI}..${SAMPAI}: ${perkara.length} putusan, ${urutGol.reduce((s, [, k]) => s + k.n, 0)} berjurnal (bukan prodeo).`);
  for (const [g, k] of urutGol) {
    console.log(`\n== ${g}: ${k.n} perkara; baris hari putus ${k.barisHari}, diketik hari itu ${persen(k.diinputHariItu, k.barisHari)}`);
    const jenis = [...new Set([...k.hari.keys(), ...k.sesudah.keys()])].sort((a, b) => (k.hari.get(b) || 0) - (k.hari.get(a) || 0));
    for (const jb of jenis) {
      const h = k.hari.get(jb) || 0;
      const s = k.sesudah.get(jb) || 0;
      const m = modus(k.jumlah.get(jb) || new Map());
      const u = modus(k.uraian.get(jb) || new Map());
      console.log(
        `  ${String(jb).padStart(3)} ${(NAMA_JB[jb] || "").padEnd(26)} hari putus ${String(h).padStart(4)} (${persen(h, k.n).padStart(4)})  sesudahnya saja ${String(s).padStart(3)}  nominal ${m.nilai} (${m.n}x)  uraian "${u.nilai}"`
      );
    }
    const urutan = [...k.urutan.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
    console.log(`  urutan hari putus: ${urutan.map(([u, n]) => `${u} (${n})`).join("; ")}`);
    console.log(
      `  sisa panjar: ada ${k.sisaAda}/${k.n}, baris terakhir ${k.sisaAkhir}/${k.sisaAda}, saldo nol ${k.saldoNol}/${k.sisaAda}, bertanggal putus ${k.sisaHariPutus}, bertanggal ikrar ${k.sisaHariIkrar}; tanpa sisa: saldo nol ${k.tanpaSisaNol}, saldo masih ada ${k.tanpaSisaPositif}`
    );
    for (const c of k.contoh) console.log(`  contoh ${c}`);
  }
}

async function ujiBalik() {
  const kasir = require("../services/kasirJurnalService");
  const otomatis = require("../services/kasirOtomatisService");
  const layanan = kasir.buatLayanan({
    kueri,
    tabelAda: async () => true,
    jeda: async () => {},
    transaksi: async () => {
      throw new Error("ukur hanya membaca");
    },
  });
  const daftar = await kueri(
    `SELECT pu.perkara_id AS id, DATE_FORMAT(pu.tanggal_putusan, '%Y-%m-%d') AS tp
       FROM perkara_putusan pu
      WHERE pu.tanggal_putusan BETWEEN ? AND ?
        AND EXISTS (SELECT 1 FROM perkara_biaya b WHERE b.perkara_id = pu.perkara_id AND b.tahapan_id = 10 AND b.tanggal_transaksi = pu.tanggal_putusan AND b.urutan = 0)
        AND NOT EXISTS (SELECT 1 FROM perkara_biaya b WHERE b.perkara_id = pu.perkara_id AND b.id_pembiayaan <> 1)
      ORDER BY pu.tanggal_putusan DESC`,
    [DARI, SAMPAI]
  );
  const per = {};
  const perJenis = {};
  const meleset = [];
  for (const d of daftar) {
    const baca = await layanan.bacaKeadaan(d.id);
    if (!baca.ok) continue;
    const k = baca.keadaan;
    const nyata = k.jurnal.filter((b) => b.tanggal === d.tp && b.urutan === 0 && b.jenisTransaksi < 0);
    const sebelum = {
      ...k,
      hariIni: d.tp,
      jurnal: k.jurnal.filter((b) => b.tanggal < d.tp || (b.tanggal === d.tp && b.jenisTransaksi > 0 && b.urutan > 0)),
      sidang: k.sidang.filter((s) => !s.tanggal || s.tanggal <= d.tp),
      ikrar: k.ikrar && k.ikrar.tanggal <= d.tp ? k.ikrar : null,
    };
    const r = otomatis.rencanaOtomatis(sebelum, { hari: d.tp });
    const g = r.keadaan.kunci;
    const x = (per[g] = per[g] || { perkara: 0, otomatis: 0, tepat: 0, jenisSalah: 0, jumlahSalah: 0, nyata: 0, terliput: 0, sisaTulis: 0, sisaTepat: 0, perkaraTerisi: 0, perkaraLengkap: 0 });
    x.perkara += 1;
    const sisaNyata = new Map();
    for (const b of nyata) sisaNyata.set(b.id, b);
    let semuaTepat = true;
    for (const u of r.kirim) {
      x.otomatis += 1;
      const sama = [...sisaNyata.values()].find((b) => b.jenisBiayaId === u.jenisBiayaId && Number(b.jumlah) === Number(u.jumlah));
      const jenisSama = [...sisaNyata.values()].find((b) => b.jenisBiayaId === u.jenisBiayaId);
      if (u.sisaOtomatis) {
        x.sisaTulis += 1;
        const n151 = nyata.find((b) => b.jenisBiayaId === 151);
        if (!n151) x.sisaDini = (x.sisaDini || 0) + 1;
        else if (Number(n151.jumlah) !== Number(u.jumlah)) x.sisaBeda = (x.sisaBeda || 0) + 1;
      }
      const pj = (perJenis[`${g}|${u.jenisBiayaId}`] = perJenis[`${g}|${u.jenisBiayaId}`] || { tulis: 0, tepat: 0 });
      pj.tulis += 1;
      if (sama) pj.tepat += 1;
      if (sama) {
        x.tepat += 1;
        if (u.sisaOtomatis) x.sisaTepat += 1;
        sisaNyata.delete(sama.id);
      } else {
        semuaTepat = false;
        if (jenisSama) {
          x.jumlahSalah += 1;
          sisaNyata.delete(jenisSama.id);
        } else x.jenisSalah += 1;
        if (meleset.length < 25) meleset.push(`${k.perkara.nomorPerkara} ${d.tp} [${g}] otomatis ${u.jenisBiayaId}:${u.jumlah} - kasir: ${nyata.map((b) => `${b.jenisBiayaId}:${b.jumlah}`).join(" ")}`);
      }
    }
    const relevan = nyata.filter((b) => otomatis.BUTIR_OTOMATIS.some((bt) => bt.jenis.includes(b.jenisBiayaId)));
    x.nyata += relevan.length;
    x.terliput += relevan.length - [...sisaNyata.values()].filter((b) => relevan.includes(b)).length;
    if (r.kirim.length) x.perkaraTerisi += 1;
    if (r.kirim.length && semuaTepat && sisaNyata.size === 0) x.perkaraLengkap += 1;
  }
  const persen = (a, b) => (b ? `${((a / b) * 100).toFixed(1)}%` : "-");
  let t = { perkara: 0, otomatis: 0, tepat: 0, nyata: 0, terliput: 0, sisaTulis: 0, sisaTepat: 0, sisaBeda: 0, sisaDini: 0, jenisSalah: 0, jumlahSalah: 0 };
  console.log(`UJI BALIK kasir otomatis ${DB} ${DARI}..${SAMPAI}: ${daftar.length} perkara putus berjurnal hari putus`);
  for (const [g, x] of Object.entries(per).sort((a, b) => b[1].perkara - a[1].perkara)) {
    for (const kunci of Object.keys(t)) t[kunci] += x[kunci] || 0;
    console.log(
      `  ${g.padEnd(16)} perkara ${String(x.perkara).padStart(4)}  diisi ${String(x.perkaraTerisi).padStart(4)} (persis kasir ${x.perkaraLengkap})  baris otomatis ${String(x.otomatis).padStart(4)}  tepat ${persen(x.tepat, x.otomatis).padStart(6)} (jenis salah ${x.jenisSalah}, jumlah salah ${x.jumlahSalah})  liputan ${persen(x.terliput, x.nyata).padStart(6)}  sisa tepat ${x.sisaTepat}/${x.sisaTulis}`
    );
  }
  console.log(`  JUMLAH: baris otomatis ${t.otomatis}, tepat ${persen(t.tepat, t.otomatis)} (jenis salah ${t.jenisSalah}, jumlah salah ${t.jumlahSalah}), liputan ${persen(t.terliput, t.nyata)}, sisa tepat ${t.sisaTepat}/${t.sisaTulis} (jumlah beda dari kasir ${t.sisaBeda}, kasir menulisnya hari lain ${t.sisaDini})`);
  console.log(`  per jenis (golongan|jenis tulis/tepat): ${Object.entries(perJenis).filter(([, v]) => v.tepat < v.tulis).map(([k2, v]) => `${k2} ${v.tepat}/${v.tulis}`).join("; ")}`);
  for (const m of meleset) console.log(`  meleset ${m}`);
}

(process.argv.includes("--uji-balik") ? ujiBalik() : utama())
  .catch((galat) => {
    console.error(galat);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
