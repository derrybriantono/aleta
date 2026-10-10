"use strict";

/**
 * ============================================================================
 * UKUR ATURAN KASIR PER KEADAAN PERKARA ATAS JURNAL NYATA (1.189.x, 10 Okt 2026)
 * ============================================================================
 *
 * Hanya MEMBACA basis data SIPP LOKAL (salinan satker sipp_donggala, data
 * 9 Okt 2026). Tidak ada satu pun tulisan.
 *
 * Uji balik dua saat yang dikerjakan kasir:
 *
 *   A. HARI PUTUSAN - perkara yang jurnalnya sudah ditutup (ada Pengembalian
 *      Sisa Panjar). Seluruh pengeluaran bertanggal >= tanggal putusan
 *      dibuang dari jurnal, lalu mesin usulan (susunUsulan) dijalankan atas
 *      keadaan perkara yang sama. Usulan yang dicentang dibandingkan dengan
 *      baris yang sungguh ditulis kasir: jenis biaya (multiset), lalu jenis +
 *      jumlah, lalu sisa panjar tepat.
 *   B. BARU DIDAFTAR / PANGGILAN PERTAMA - jurnal dipotong sampai sebelum
 *      PNBP relaas pertama, sidang hanya sidang pertama, tanpa putusan.
 *
 * Keadaan diberi nama oleh kasirJurnalService.keadaanPerkara - nama yang
 * sama dengan yang dilihat kasir di layar.
 *
 *   node scripts/ukur-kasir-keadaan.js [--db sipp_donggala] [--dari 2025-07-01]
 *        [--sampai 2026-10-01] [--batas 2000] [--contoh ../manajemen_surat/src/test/kasir-keadaan-nyata.json]
 *
 * Variabel MYSQL_HOST/MYSQL_USER/MYSQL_PASSWORD bila bukan root lokal.
 */

const path = require("path");
const fs = require("fs");
const mysql = require("mysql");
const kasir = require("../services/kasirJurnalService");

function argumen(nama, bawaan) {
  const i = process.argv.indexOf(`--${nama}`);
  return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : bawaan;
}

const DB = argumen("db", "sipp_donggala");
const DARI = argumen("dari", "2025-07-01");
const SAMPAI = argumen("sampai", "2026-10-01");
const BATAS = Number(argumen("batas", "3000"));
const CONTOH = argumen("contoh", "");

const pool = mysql.createPool({
  host: process.env.MYSQL_HOST || "127.0.0.1",
  user: process.env.MYSQL_USER || "root",
  password: process.env.MYSQL_PASSWORD || "",
  database: DB,
  connectionLimit: 6,
});
const kueri = (sql, params = []) =>
  new Promise((selesai, gagal) => pool.query(sql, params, (galat, hasil) => (galat ? gagal(galat) : selesai(hasil))));

const layanan = kasir.buatLayanan({
  kueri,
  tabelAda: async () => true,
  jeda: async () => {},
  transaksi: async () => {
    throw new Error("ukur hanya membaca");
  },
});

const JENIS_HARI_PUTUSAN = new Set([157, 152, 404, 260, 29, 389, 151, 14]);
const JENIS_PANGGILAN_PERTAMA = new Set([236, 237, 253, 388, 12, 13, 14, 15]);

function multiset(daftar) {
  const m = {};
  for (const x of daftar) m[x] = (m[x] || 0) + 1;
  return m;
}

function bandingkan(usul, nyata) {
  const a = multiset(usul);
  const b = multiset(nyata);
  let cocok = 0;
  for (const k of Object.keys(a)) cocok += Math.min(a[k], b[k] || 0);
  return { cocok, usul: usul.length, nyata: nyata.length, tepat: cocok === usul.length && cocok === nyata.length };
}

function anonim(k) {
  const salin = JSON.parse(JSON.stringify(k));
  salin.perkara.nomorPerkara = `${salin.perkara.perkaraId % 1000}/Pdt.X/2026/PA.Anon`;
  salin.pihak = salin.pihak.map((p, i) => ({ ...p, nama: `Pihak ${p.ke}-${i + 1}` }));
  salin.jurusita = salin.jurusita.map((j) => ({ ...j, nama: "Juru Sita Anonim" }));
  salin.jurnal = salin.jurnal.map((b) => ({ ...b, namaPihak: "", jurusita: "", diinputOleh: "kasir", diinputTanggal: "", keterangan: "" }));
  // Rujukan jenis biaya dipangkas ke yang dipakai mesin dan jurnal ini saja.
  const dipakai = new Set([...Object.values(kasir.JB), 254, ...salin.jurnal.map((b) => b.jenisBiayaId)].map(Number));
  for (const id of Object.keys(salin.jenisBiaya)) if (!dipakai.has(Number(id))) delete salin.jenisBiaya[id];
  for (const jb of Object.values(salin.jenisBiaya)) delete jb.kategori;
  return salin;
}

async function ujiHariPutusan() {
  const daftar = await kueri(
    `SELECT pu.perkara_id AS id, DATE_FORMAT(pu.tanggal_putusan, '%Y-%m-%d') AS tp
       FROM perkara_putusan pu
      WHERE pu.tanggal_putusan >= ? AND pu.tanggal_putusan < ?
        AND EXISTS (SELECT 1 FROM perkara_biaya b WHERE b.perkara_id = pu.perkara_id AND b.jenis_biaya_id = 151 AND b.tahapan_id = 10)
        AND NOT EXISTS (SELECT 1 FROM perkara_biaya b WHERE b.perkara_id = pu.perkara_id AND b.id_pembiayaan <> 1)
      ORDER BY pu.tanggal_putusan DESC LIMIT ?`,
    [DARI, SAMPAI, BATAS]
  );
  const per = {};
  const contoh = {};
  for (const d of daftar) {
    const baca = await layanan.bacaKeadaan(d.id);
    if (!baca.ok) continue;
    const k = baca.keadaan;
    const dibuang = k.jurnal.filter((b) => b.jenisTransaksi < 0 && b.tanggal >= d.tp && JENIS_HARI_PUTUSAN.has(b.jenisBiayaId));
    if (!dibuang.some((b) => b.jenisBiayaId === 151)) continue;
    const buang = new Set(dibuang.map((b) => b.id));
    const sebelum = { ...k, jurnal: k.jurnal.filter((b) => !buang.has(b.id)) };
    sebelum.hariIni = dibuang.map((b) => b.tanggal).sort().pop();
    const keadaan = kasir.keadaanPerkara(sebelum);
    const hasil = kasir.susunUsulan(sebelum);
    const dipilih = hasil.usulan.filter((u) => u.pilih && (!u.sisaOtomatis || u.jumlah > 0) && JENIS_HARI_PUTUSAN.has(u.jenisBiayaId));
    const j = bandingkan(
      dipilih.map((u) => u.jenisBiayaId),
      dibuang.map((b) => b.jenisBiayaId)
    );
    const jj = bandingkan(
      dipilih.map((u) => `${u.jenisBiayaId}|${u.jumlah}`),
      dibuang.map((b) => `${b.jenisBiayaId}|${b.jumlah}`)
    );
    const sisaU = dipilih.find((u) => u.sisaOtomatis);
    const sisaN = dibuang.find((b) => b.jenisBiayaId === 151);
    const r = (per[keadaan.kunci] = per[keadaan.kunci] || {
      nama: keadaan.nama,
      perkara: 0,
      jenisTepat: 0,
      jumlahTepat: 0,
      sisaTepat: 0,
      barisCocok: 0,
      barisUsul: 0,
      barisNyata: 0,
      meleset: [],
    });
    r.perkara += 1;
    if (j.tepat) r.jenisTepat += 1;
    if (jj.tepat) r.jumlahTepat += 1;
    if (sisaU && sisaN && Number(sisaU.jumlah) === Number(sisaN.jumlah)) r.sisaTepat += 1;
    r.barisCocok += j.cocok;
    r.barisUsul += j.usul;
    r.barisNyata += j.nyata;
    if (!j.tepat && r.meleset.length < 6) {
      r.meleset.push({
        perkara: k.perkara.nomorPerkara,
        usul: dipilih.map((u) => u.jenisBiayaId).join(","),
        nyata: dibuang.map((b) => b.jenisBiayaId).join(","),
      });
    }
    if (CONTOH && j.tepat && jj.tepat && (contoh[keadaan.kunci] || []).length < 1) {
      contoh[keadaan.kunci] = contoh[keadaan.kunci] || [];
      contoh[keadaan.kunci].push({
        saat: "hari-putusan",
        keadaan: anonim(sebelum),
        harap: dibuang
          .slice()
          .sort((a, b) => a.id - b.id)
          .map((b) => ({ jenisBiayaId: b.jenisBiayaId, jumlah: b.jumlah })),
      });
    }
  }
  return { per, contoh };
}

async function ujiPanggilanPertama() {
  const daftar = await kueri(
    `SELECT p.perkara_id AS id, DATE_FORMAT(s.tanggal_sidang, '%Y-%m-%d') AS ts, s.id AS sidangId
       FROM perkara p JOIN perkara_jadwal_sidang s ON s.perkara_id = p.perkara_id AND s.urutan = 1
      WHERE p.tanggal_pendaftaran >= ? AND p.tanggal_pendaftaran < ?
        AND EXISTS (SELECT 1 FROM perkara_biaya b WHERE b.perkara_id = p.perkara_id AND b.jenis_biaya_id IN (236,253))
        AND NOT EXISTS (SELECT 1 FROM perkara_biaya b WHERE b.perkara_id = p.perkara_id AND b.id_pembiayaan <> 1)
      ORDER BY p.perkara_id DESC LIMIT ?`,
    [DARI, SAMPAI, BATAS]
  );
  const per = {};
  const contoh = {};
  for (const d of daftar) {
    const baca = await layanan.bacaKeadaan(d.id);
    if (!baca.ok) continue;
    const k = baca.keadaan;
    const nyata = k.jurnal.filter(
      (b) => JENIS_PANGGILAN_PERTAMA.has(b.jenisBiayaId) && b.tanggal <= d.ts && !/ikrar/i.test(b.uraian)
    );
    if (!nyata.length) continue;
    const awal = nyata.map((b) => b.tanggal).sort()[0];
    const sebelum = {
      ...k,
      jurnal: k.jurnal.filter((b) => b.tanggal < awal || (b.jenisTransaksi > 0 && b.tanggal <= awal) || (b.tanggal === awal && !JENIS_PANGGILAN_PERTAMA.has(b.jenisBiayaId) && b.id < Math.min(...nyata.map((x) => x.id)))),
      sidang: k.sidang.filter((s) => s.id === Number(d.sidangId)),
      relaas: k.relaas.filter((r) => r.sidangId === Number(d.sidangId)),
      putusan: null,
      ikrar: null,
      pemberitahuan: [],
    };
    sebelum.hariIni = nyata.map((b) => b.tanggal).sort().pop();
    const keadaan = kasir.keadaanPerkara(sebelum);
    const hasil = kasir.susunUsulan(sebelum);
    const dipilih = hasil.usulan.filter((u) => u.pilih && JENIS_PANGGILAN_PERTAMA.has(u.jenisBiayaId));
    const j = bandingkan(
      dipilih.map((u) => u.jenisBiayaId),
      nyata.map((b) => b.jenisBiayaId)
    );
    const kunci = Number(k.perkara.alurPerkaraId) === 16 ? "baru-permohonan" : "baru-gugatan";
    const r = (per[kunci] = per[kunci] || {
      nama: keadaan.nama + (kunci === "baru-permohonan" ? " (permohonan)" : " (gugatan)"),
      perkara: 0,
      jenisTepat: 0,
      barisCocok: 0,
      barisUsul: 0,
      barisNyata: 0,
      meleset: [],
    });
    r.perkara += 1;
    if (j.tepat) r.jenisTepat += 1;
    r.barisCocok += j.cocok;
    r.barisUsul += j.usul;
    r.barisNyata += j.nyata;
    if (!j.tepat && r.meleset.length < 6) {
      r.meleset.push({ perkara: k.perkara.nomorPerkara, usul: dipilih.map((u) => u.jenisBiayaId).join(","), nyata: nyata.map((b) => b.jenisBiayaId).join(",") });
    }
    if (CONTOH && j.tepat && (contoh[kunci] || []).length < 1) {
      contoh[kunci] = contoh[kunci] || [];
      contoh[kunci].push({
        saat: "panggilan-pertama",
        keadaan: anonim(sebelum),
        harap: nyata
          .slice()
          .sort((a, b) => a.id - b.id)
          .map((b) => ({ jenisBiayaId: b.jenisBiayaId, jumlah: b.jumlah })),
      });
    }
  }
  return { per, contoh };
}

function persen(a, b) {
  return b ? `${((a / b) * 100).toFixed(1)}%` : "-";
}

(async () => {
  const a = await ujiHariPutusan();
  const b = await ujiPanggilanPertama();
  const semua = { ...b.per, ...a.per };
  console.log(`Basis data ${DB}, putusan ${DARI} s.d. ${SAMPAI}`);
  console.log("keadaan | perkara | jenis tepat | jenis+jumlah tepat | sisa tepat | presisi baris | cakupan baris");
  const ringkas = {};
  for (const [kunci, r] of Object.entries(semua).sort((x, y) => y[1].perkara - x[1].perkara)) {
    console.log(
      `${kunci} (${r.nama}) | ${r.perkara} | ${persen(r.jenisTepat, r.perkara)} | ${r.jumlahTepat === undefined ? "-" : persen(r.jumlahTepat, r.perkara)} | ${r.sisaTepat === undefined ? "-" : persen(r.sisaTepat, r.perkara)} | ${persen(r.barisCocok, r.barisUsul)} | ${persen(r.barisCocok, r.barisNyata)}`
    );
    for (const m of r.meleset.slice(0, 3)) console.log(`    meleset ${m.perkara}: usul [${m.usul}] nyata [${m.nyata}]`);
    ringkas[kunci] = {
      nama: r.nama,
      perkara: r.perkara,
      jenisTepat: r.jenisTepat,
      jumlahTepat: r.jumlahTepat ?? null,
      sisaTepat: r.sisaTepat ?? null,
      presisiBaris: r.barisUsul ? Number((r.barisCocok / r.barisUsul).toFixed(4)) : null,
      cakupanBaris: r.barisNyata ? Number((r.barisCocok / r.barisNyata).toFixed(4)) : null,
    };
  }
  if (CONTOH) {
    const keluar = path.resolve(process.cwd(), CONTOH);
    fs.writeFileSync(
      keluar,
      `${JSON.stringify({ diukur: new Date().toISOString().slice(0, 10), basisData: DB, rentang: [DARI, SAMPAI], ringkas, contoh: { ...b.contoh, ...a.contoh } })}\n`
    );
    console.log(`contoh & ringkasan ditulis ke ${keluar}`);
  }
  pool.end();
})().catch((galat) => {
  console.error(galat);
  pool.end();
  process.exit(1);
});
