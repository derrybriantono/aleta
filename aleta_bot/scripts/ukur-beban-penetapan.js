"use strict";

/**
 * ============================================================================
 * UKUR: APAKAH REKOMENDASI BEBAN LEBIH MERATA DARIPADA PENETAPAN NYATA
 * (20 Okt 2026, agen B1) - BACA SAJA
 * ============================================================================
 *
 * Pemakaian:
 *   node aleta_bot/scripts/ukur-beban-penetapan.js <folder-tsv> [tahun]
 *
 * Folder berisi hasil ekspor SIPP (mysql -B -N) dari salinan lokal
 * `sipp_donggala` - lihat docs/penetapan/PENILAIAN-BEBAN.md bagian "Cara
 * mengukur" untuk kueri ekspornya. Skrip ini TIDAK membuka basis data apa pun.
 *
 * Yang diukur:
 *   1. Sebaran penetapan NYATA tahun itu per hakim, panitera pengganti, juru sita.
 *   2. SIMULASI: tiap perkara diputar ulang menurut urutan tanggal penetapan;
 *      juru sita dan panitera pengganti dipilih oleh urutan rekomendasi
 *      (bebanPenetapanService.urutkanKandidat, kandidat teratas) atas keadaan
 *      yang dibangun dari simulasi itu sendiri, bukan dari kenyataan.
 *   3. Majelis: sesudah tanggal SK, tiap perkara bermajelis dibagi kepada
 *      majelis SK yang teringan bebannya.
 *
 * BATAS: tanpa cuti/sakit/sidang bentrok; kandidat = orang yang pernah
 * menerima penetapan pada tahun itu, hanya pada rentang tanggal pertama sampai
 * terakhir ia menerima; panitera pendamping SK tidak dibatasi (SK belum
 * mengikat panitera di salinan lokal); salinan lokal berhenti pada tanggal
 * ekspor terakhir.
 */

const fs = require("fs");
const path = require("path");
const beban = require("../services/bebanPenetapanService");
// Bahan percobaan: BOBOT_JSON='{"jurusita":{"biasa":{...},"kebendaan":{...}},"anggota":0.2}'
if (process.env.BOBOT_JSON) {
  const o = JSON.parse(process.env.BOBOT_JSON);
  for (const k of ["hakim", "panitera", "jurusita"]) if (o[k]) beban.BOBOT_SKOR_PERAN[k] = o[k];
  if (o.anggota !== undefined) beban.BOBOT_ANGGOTA_MAJELIS.nilai = o.anggota;
}

const folder = process.argv[2];
const tahun = Number(process.argv[3]) || 2026;
if (!folder) {
  console.error("Pemakaian: node ukur-beban-penetapan.js <folder-tsv> [tahun]");
  process.exit(2);
}

// Definisi kebendaan/bobot: dibaca dari penunjukanService supaya satu sumber.
// penunjukanService memuat db_config; tidak ada kueri dijalankan saat dimuat.
const dbPath = require.resolve(path.resolve(__dirname, "..", "db_config.js"));
const Module = require("module");
require.cache[dbPath] = new Module(dbPath, null);
require.cache[dbPath].filename = dbPath;
require.cache[dbPath].loaded = true;
require.cache[dbPath].exports = { query: (s, p, cb) => cb(null, []) };
const { bobotJenis, adalahKebendaan } = require("../services/penunjukanService");

const baca = (nama) =>
  fs
    .readFileSync(path.join(folder, nama), "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .map((b) => b.split("\t"));

function ekspor(nama) {
  // perkara_id, orang_id, urutan, tanggal, jenis, tahapan, tanggal_putusan
  const unik = new Map();
  for (const k of baca(nama)) {
    const kunci = `${k[0]}:${k[1]}`;
    if (!unik.has(kunci)) unik.set(kunci, { perkaraId: Number(k[0]), orangId: Number(k[1]), urutan: Number(k[2]), tanggal: k[3], jenisId: Number(k[4]), tahapan: Number(k[5]), putusan: k[6] || "" });
  }
  return [...unik.values()];
}

const HAKIM = ekspor("hakim.tsv");
const PP = ekspor("pp.tsv");
const JS = ekspor("js.tsv");

const awalTahun = `${tahun}-01-01`;
const akhirTahun = `${tahun}-12-31`;
const dalamTahun = (b) => b.tanggal >= awalTahun && b.tanggal <= akhirTahun;
const tanggalTerakhir = [...HAKIM, ...PP, ...JS].filter(dalamTahun).reduce((m, b) => (b.tanggal > m ? b.tanggal : m), awalTahun);

const nama = (berkas) => new Map(baca(berkas).map((k) => [Number(k[0]), { kode: k[1] || "", nama: k[2] }]));
const NAMA_HAKIM = nama("hakim_pn.tsv");
const NAMA_PP = nama("panitera_pn.tsv");
const NAMA_JS = nama("jurusita.tsv");

const f1 = (x) => Math.round(x * 10) / 10;
const w = (b) => bobotJenis(b.jenisId);

function ringkasan(judul, peta, rentang, namaPeta) {
  // peta: id -> {n, bobot, keb}; rentang: id -> hari bertugas dalam tahun
  const baris = [...peta.entries()].map(([id, v]) => ({
    id,
    nama: (namaPeta.get(id) || {}).nama || `#${id}`,
    n: v.n,
    bobot: f1(v.bobot),
    keb: v.keb,
    hari: rentang.get(id) || 1,
    per100: f1((v.bobot / (rentang.get(id) || 1)) * 100),
  }));
  baris.sort((a, b) => b.bobot - a.bobot);
  const per = baris.map((b) => b.per100);
  const rata = per.reduce((s, x) => s + x, 0) / (per.length || 1);
  const sd = Math.sqrt(per.reduce((s, x) => s + (x - rata) ** 2, 0) / (per.length || 1));
  const keb = baris.map((b) => b.keb);
  console.log(`\n${judul}`);
  for (const b of baris) console.log(`  ${String(b.nama).padEnd(28)} jumlah ${String(b.n).padStart(4)}  berbobot ${String(b.bobot).padStart(7)}  kebendaan ${String(b.keb).padStart(2)}  hari bertugas ${String(b.hari).padStart(3)}  bobot/100 hari ${String(b.per100).padStart(6)}`);
  const hasil = {
    selisihPer100: f1(Math.max(...per) - Math.min(...per)),
    cv: f1((sd / (rata || 1)) * 100),
    selisihKeb: Math.max(...keb) - Math.min(...keb),
    kebMaks: Math.max(...keb),
  };
  console.log(`  -> selisih maksimum-minimum bobot per 100 hari bertugas: ${hasil.selisihPer100}; koefisien variasi: ${hasil.cv}%; selisih kebendaan maks-min: ${hasil.selisihKeb}`);
  return hasil;
}

function kumpul(baris) {
  const peta = new Map();
  const rentang = new Map();
  for (const b of baris) {
    const v = peta.get(b.orangId) || { n: 0, bobot: 0, keb: 0 };
    v.n += 1;
    v.bobot += w(b);
    if (adalahKebendaan(b.jenisId)) v.keb += 1;
    peta.set(b.orangId, v);
    const r = rentang.get(b.orangId) || { a: b.tanggal, z: b.tanggal };
    if (b.tanggal < r.a) r.a = b.tanggal;
    if (b.tanggal > r.z) r.z = b.tanggal;
    rentang.set(b.orangId, r);
  }
  const hari = new Map();
  for (const [id, r] of rentang) hari.set(id, Math.max(1, Math.round((new Date(`${r.z}T00:00:00`) - new Date(`${r.a}T00:00:00`)) / 86400000) + 1));
  return { peta, hari, rentang };
}

// ---------------------------------------------------------------------------
// 1 dan 2: juru sita dan panitera pengganti - nyata vs simulasi
// ---------------------------------------------------------------------------

function simulasi(peran, baris, daftarNama) {
  const sejarah = baris.filter((b) => b.tanggal < awalTahun);
  const nyata = baris.filter(dalamTahun).sort((a, b) => (a.tanggal < b.tanggal ? -1 : a.tanggal > b.tanggal ? 1 : a.perkaraId - b.perkaraId));
  const { rentang } = kumpul(nyata);
  const simulasiBaris = [];
  const tanggalPutusan = new Map(nyata.map((b) => [b.perkaraId, b.putusan]));

  for (const kini of nyata) {
    const d = kini.tanggal;
    const layak = [...rentang.entries()]
      .filter(([, r]) => d >= r.a && d <= r.z)
      .map(([id, r]) => ({ id, kode: (daftarNama.get(id) || {}).kode || "", nama: (daftarNama.get(id) || {}).nama || `#${id}`, mulai: r.a > awalTahun ? r.a : "" }));
    if (layak.length === 0) continue;
    const semua = [...sejarah, ...simulasiBaris].map((b) => ({ ...b, berjalan: !tanggalPutusan.get(b.perkaraId) || tanggalPutusan.get(b.perkaraId) > d }));
    const stat = beban.statistikPeran({ peran: peran === "Juru sita" ? "jurusita" : "panitera", orang: layak, baris: semua, jendela: beban.jendelaWaktu(d), bobot: bobotJenis, kebendaan: adalahKebendaan });
    const peta = new Map(stat.orang.map((e) => [e.id, e]));
    const urut = beban.urutkanKandidat(layak, peta, { kebendaan: adalahKebendaan(kini.jenisId), ambilId: (x) => x.id });
    simulasiBaris.push({ ...kini, orangId: urut[0].id });
  }
  return { nyata, simulasiBaris };
}

console.log(`Salinan lokal SIPP: penetapan tahun ${tahun} sampai ${tanggalTerakhir}`);
const hasilBanding = {};
for (const [peran, baris, daftarNama] of [
  ["Juru sita", JS, NAMA_JS],
  ["Panitera pengganti", PP, NAMA_PP],
]) {
  const { nyata, simulasiBaris } = simulasi(peran, baris, daftarNama);
  const k1 = kumpul(nyata);
  const k2 = kumpul(simulasiBaris);
  console.log(`\n=================== ${peran}: ${nyata.length} penetapan ${tahun} ===================`);
  const a = ringkasan(`NYATA`, k1.peta, k1.hari, daftarNama);
  // Rentang simulasi memakai rentang nyata supaya per-100-hari sebanding.
  const b = ringkasan(`SIMULASI (rekomendasi diikuti)`, k2.peta, k1.hari, daftarNama);
  hasilBanding[peran] = { nyata: a, simulasi: b };
}

// ---------------------------------------------------------------------------
// 3: majelis menurut SK, sesudah tanggal SK
// ---------------------------------------------------------------------------

const TANGGAL_SK = process.argv[4] || "2026-08-27";
const SK = [
  { majelisKode: "A", hakimKode: ["A", "C1", "C3"] },
  { majelisKode: "B", hakimKode: ["B", "C2", "C3"] },
  { majelisKode: "C1", hakimKode: ["C1", "C2", "C3"] },
];
const idKode = new Map([...NAMA_HAKIM.entries()].map(([id, v]) => [v.kode, id]).filter(([k]) => k));
const kodeId = new Map([...NAMA_HAKIM.entries()].map(([id, v]) => [id, v.kode]));
const kunciKode = (ks) => [...ks].map((x) => String(x).toUpperCase()).sort().join("|");
const petaSk = new Map(SK.map((s) => [kunciKode(s.hakimKode), s]));

{
  const perPerkara = new Map();
  for (const b of HAKIM) {
    if (b.tanggal < TANGGAL_SK || b.tanggal > akhirTahun) continue;
    const p = perPerkara.get(b.perkaraId) || { ...b, ids: [] };
    p.ids.push({ id: b.orangId, urutan: b.urutan });
    perPerkara.set(b.perkaraId, p);
  }
  const perkara = [...perPerkara.values()].map((p) => ({ ...p, ids: p.ids.sort((a, b) => a.urutan - b.urutan).map((x) => x.id) }));
  const bermajelis = perkara.filter((p) => p.ids.length >= 2).sort((a, b) => (a.tanggal < b.tanggal ? -1 : a.tanggal > b.tanggal ? 1 : a.perkaraId - b.perkaraId));
  const nyataPerMajelis = new Map([["luar SK", 0], ...SK.map((s) => [s.majelisKode, 0])]);
  for (const p of bermajelis) {
    const sk = petaSk.get(kunciKode(p.ids.map((i) => kodeId.get(i) || `#${i}`)));
    const k = sk ? sk.majelisKode : "luar SK";
    nyataPerMajelis.set(k, nyataPerMajelis.get(k) + 1);
  }

  // Simulasi majelis: keadaan hakim dibangun dari pilihan simulasi; sejarah = hakim sebelum tanggal SK.
  const sejarah = HAKIM.filter((b) => b.tanggal < TANGGAL_SK).map((b) => ({ ...b }));
  const simBaris = [];
  const simPerMajelis = new Map(SK.map((s) => [s.majelisKode, 0]));
  const simMajelisBaris = new Map(SK.map((s) => [s.majelisKode, []]));
  const putusan = new Map(HAKIM.map((b) => [b.perkaraId, b.putusan]));
  const orangHakim = [...NAMA_HAKIM.entries()].filter(([id]) => HAKIM.some((b) => b.orangId === id)).map(([id, v]) => ({ id, kode: v.kode, nama: v.nama }));
  for (const p of bermajelis) {
    const d = p.tanggal;
    const semua = [...sejarah, ...simBaris].map((b) => ({ ...b, berjalan: !putusan.get(b.perkaraId) || putusan.get(b.perkaraId) > d }));
    const stat = beban.hitungStatistik({
      sekarang: d,
      baris: { hakim: semua, panitera: [], jurusita: [] },
      orang: { hakim: orangHakim, panitera: [], jurusita: [] },
      susunanSk: SK,
      skTanggal: TANGGAL_SK,
      bobot: bobotJenis,
      kebendaan: adalahKebendaan,
    });
    const petaHakim = new Map(stat.hakim.orang.map((e) => [e.id, e]));
    const opsi = { kebendaan: adalahKebendaan(p.jenisId) };
    const calon = stat.majelis.majelis.map((m) => ({ ...m, skorMajelis: beban.skorMajelis(m, petaHakim, opsi) }));
    const urut = beban.urutkanKandidat(calon, null, { kebendaan: opsi.kebendaan, ambilEntri: (m) => m });
    const pilih = urut[0];
    simPerMajelis.set(pilih.kode, simPerMajelis.get(pilih.kode) + 1);
    for (const id of pilih.anggotaId) simBaris.push({ perkaraId: p.perkaraId, orangId: id, tanggal: d, jenisId: p.jenisId, tahapan: p.tahapan });
  }

  console.log(`\n=================== Majelis menurut SK, ${bermajelis.length} perkara bermajelis ${TANGGAL_SK} .. ${tanggalTerakhir} ===================`);
  const baris = (peta) => [...peta.entries()].map(([k, v]) => `${k}=${v}`).join("  ");
  console.log(`  NYATA     : ${baris(nyataPerMajelis)}`);
  console.log(`  SIMULASI  : ${baris(simPerMajelis)}`);
  const sebaran = (peta) => {
    const nilai = SK.map((s) => peta.get(s.majelisKode));
    return Math.max(...nilai) - Math.min(...nilai);
  };
  console.log(`  selisih maksimum-minimum antar majelis SK: nyata ${sebaran(nyataPerMajelis)} -> simulasi ${sebaran(simPerMajelis)}`);
  // Kursi hakim: C3 duduk di ketiganya, jadi dilihat juga per hakim.
  const kursi = (rows) => {
    const peta = new Map();
    for (const r of rows) peta.set(r.orangId, (peta.get(r.orangId) || 0) + 1);
    return peta;
  };
  const kursiNyata = kursi(bermajelis.flatMap((p) => p.ids.map((id) => ({ orangId: id }))));
  const kursiSim = kursi(simBaris);
  console.log("  kursi per hakim (nyata -> simulasi):");
  for (const id of orangHakim.map((h) => h.id)) {
    console.log(`    ${String((NAMA_HAKIM.get(id) || {}).nama || id).padEnd(26)} ${String(kursiNyata.get(id) || 0).padStart(4)} -> ${String(kursiSim.get(id) || 0).padStart(4)}`);
  }
  const nilaiN = [...kursiNyata.values()];
  const nilaiS = orangHakim.map((h) => kursiSim.get(h.id) || 0);
  console.log(`  selisih kursi hakim maksimum-minimum: nyata ${Math.max(...nilaiN) - Math.min(...nilaiN)} -> simulasi ${Math.max(...nilaiS) - Math.min(...nilaiS)}`);
}

console.log("\nRingkasan juru sita/panitera (selisih bobot per 100 hari bertugas, nyata -> simulasi):");
for (const [k, v] of Object.entries(hasilBanding)) {
  console.log(`  ${k}: ${v.nyata.selisihPer100} -> ${v.simulasi.selisihPer100}; variasi ${v.nyata.cv}% -> ${v.simulasi.cv}%; kebendaan maks-min ${v.nyata.selisihKeb} -> ${v.simulasi.selisihKeb}`);
}
