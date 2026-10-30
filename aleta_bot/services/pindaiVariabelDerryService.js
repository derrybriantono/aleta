"use strict";

/**
 * ============================================================================
 * PINDAI MINGGUAN VARIABEL BLANGKO DERRY (G1, 30 Okt 2026)
 * ============================================================================
 *
 * Tugas terjadwal bot (mingguan, di luar jam kerja): SEMUA variabel yang dipakai Blangko Derry dihitung atas contoh perkara tiap
 * jenis lewat mesin variabel ALETA (abtMesinVariabel - tiruan setia ABT, HANYA MEMBACA: tiap kueri lewat pagarBaca, urutan
 * sidang DIHITUNG bukan ditulis). Hasilnya untuk Pusat Kesehatan portal:
 *   - galat SQL         : kueri variabel gagal dijalankan (Unknown column, syntax, ...), atas perkara jenis APA PUN;
 *   - lambat            : waktu habis walau sudah diulang sekali dengan batas 30 detik (server sibuk / kueri berat) - bukan galat;
 *   - penanda tersisa   : keluaran masih memuat #nnnn#, atas perkara sejenis dengan folder blangko pemakainya;
 *   - bunyi penanda     : "TIDAK BENAR QUERY NYA", "[... BELUM ...]" (isian wajib kosong / data SIPP belum diubah), atas perkara
 *                         sejenis - dicatat terpisah, bukan galat;
 *   - tiba-tiba kosong  : variabel yang PEKAN LALU terisi pada perkara contoh yang SAMA, kini kosong.
 * Tidak satu baris pun ditulis ke ABT atau SIPP; hasil disimpan sebagai berkas JSON di folder data bot (ALETA_BOT_DATA_DIR).
 *
 * Alat yang sama dengan pindai php56 di laptop (abt-paket/variabel-galat-30okt/alat/pindai_galat.py + analisa_galat.py): golongan
 * dan pemetaan folder -> jenis perkara sama, tetapi mesinnya mesin variabel bot (server tidak punya php56 untuk menjalankan
 * renderer ABT di luar ABT).
 */

const fs = require("fs");
const path = require("path");

const JENIS_DIPINDAI = Object.freeze(["data_sql", "data_sipp", "data_teks", "data_tanggal", "terbilang", "tanggal_hari", "tanggal_hijriah"]);
/** Kelompok jenis perkara contoh: [jenis_perkara_id, alur_perkara_id] terbanyak setahun terakhir, tiap kelompok putus + belum putus. */
const KELOMPOK_MAKS = 12;
const POTONGAN = 150;
const NILAI_CONTOH = 160;
const RIWAYAT_MAKS = 8;

/** Awalan folder blangko Derry -> awalan nama jenis perkara SIPP (sama dengan analisa_galat.py). */
const FOLDER_JENIS = Object.freeze([
  [/^1 Perceraian CG|^1c |^1d |^1e |^1f /, ["Cerai Gugat", "Cerai Talak"]],
  [/^1a Perceraian CT/, ["Cerai Talak"]],
  [/^2 Itsbat/, ["Pengesahan Perkawinan/Istbat Nikah"]],
  [/^2a Itsbat/, ["Pengesahan Perkawinan/Istbat Nikah"]],
  [/^3 Dispensasi/, ["Dispensasi Kawin"]],
  [/^3a Izin/, ["Izin Kawin"]],
  [/^4a Harta/, ["Harta Bersama"]],
  [/^4b Kewarisan/, ["Kewarisan"]],
  [/^6 Perwalian/, ["Perwalian"]],
  [/^7 Wali/, ["Wali Adhol"]],
  [/^8 Asal/, ["Asal Usul Anak"]],
  [/^9 Penetapan Ahli Waris/, ["P3HP/Penetapan Ahli Waris"]],
]);
/** Bunyi penanda di keluaran variabel: bukan galat kueri, tetapi isian wajib/data yang belum ada. */
const POLA_BUNYI = /TIDAK BENAR QUERY NYA|\[[A-Z][A-Z ,/-]{6,}BELUM [A-Z ,/-]{3,}\]|BELUM ISI ALASAN/;
const POLA_PENANDA = /#\d{3,5}#/g;
/** Galat yang sebabnya waktu habis/sambungan (bukan kueri yang salah): diulang sekali dengan batas lebih longgar, sisanya "lambat". */
const POLA_LAMBAT = /timeout|inactivity|ETIMEDOUT|ECONNRESET|PROTOCOL_CONNECTION_LOST|habis waktu|batas waktu/i;
const BATAS_ULANG_MS = 30000;

const teks = (v) => (v === null || v === undefined ? "" : String(v));

function berkasHasil(env = process.env) {
  const dasar = env.ALETA_BOT_DATA_DIR ? path.resolve(env.ALETA_BOT_DATA_DIR) : path.join(__dirname, "..", "data");
  return path.join(dasar, "pindai-variabel-derry.json");
}

function bacaSimpanan(berkas) {
  try {
    const isi = JSON.parse(fs.readFileSync(berkas, "utf8"));
    return isi && typeof isi === "object" ? isi : null;
  } catch {
    return null;
  }
}

function tulisSimpanan(berkas, isi) {
  fs.mkdirSync(path.dirname(berkas), { recursive: true });
  const sementara = `${berkas}.${process.pid}.tmp`;
  fs.writeFileSync(sementara, JSON.stringify(isi));
  fs.renameSync(sementara, berkas);
}

/** Folder blangko (tingkat atas) cocok dengan jenis perkara contoh? */
function folderCocok(folder, jenisNama) {
  const j = teks(jenisNama);
  for (const f of folder || []) {
    for (const [pola, jenis] of FOLDER_JENIS) {
      if (pola.test(f) && jenis.some((x) => j.startsWith(x))) return true;
    }
  }
  return false;
}

/** Golongan satu keluaran variabel: galat | penanda | bunyi | kosong | terisi. */
function golongkan(v) {
  if (!v) return { golongan: "kosong", contoh: "" };
  const polos = teks(v.polos).replace(/\s+/g, " ").trim();
  if (v.status === "galat") return { golongan: POLA_LAMBAT.test(teks(v.sebab)) ? "lambat" : "galat", contoh: teks(v.sebab).slice(0, NILAI_CONTOH) };
  if (v.status === "takada") return { golongan: "takada", contoh: "" };
  if (POLA_BUNYI.test(polos)) return { golongan: "bunyi", contoh: polos.slice(0, NILAI_CONTOH) };
  const sisa = polos.match(POLA_PENANDA);
  if (sisa) return { golongan: "penanda", contoh: [...new Set(sisa)].slice(0, 5).join(" ") };
  if (v.status === "kosong" || !polos || polos === "..." || polos === "DATA_TIDAK_ADA") return { golongan: "kosong", contoh: "" };
  return { golongan: "terisi", contoh: "" };
}

/**
 * Contoh perkara: kelompok [jenis, alur] terbanyak setahun terakhir; tiap kelompok perkara putus terbaru + belum putus terbaru.
 * Perkara contoh pekan lalu yang masih ada DIPAKAI LAGI (perbandingan "tiba-tiba kosong" butuh perkara yang sama).
 */
async function pilihContoh(kueri, sebelum) {
  const kelompok = await kueri(
    `SELECT p.jenis_perkara_id, p.alur_perkara_id, MAX(p.jenis_perkara_nama) AS nama, COUNT(*) AS n
       FROM perkara p WHERE p.tanggal_pendaftaran >= DATE_SUB(CURDATE(), INTERVAL 365 DAY)
      GROUP BY p.jenis_perkara_id, p.alur_perkara_id HAVING n >= 3 ORDER BY n DESC LIMIT ${KELOMPOK_MAKS}`
  );
  const lama = new Map((Array.isArray(sebelum && sebelum.contoh) ? sebelum.contoh : []).map((c) => [`${c.jenisId}|${c.alurId}|${c.putus ? 1 : 0}`, c]));
  const contoh = [];
  for (const k of kelompok) {
    for (const putus of [true, false]) {
      const kunci = `${k.jenis_perkara_id}|${k.alur_perkara_id}|${putus ? 1 : 0}`;
      const ulang = lama.get(kunci);
      if (ulang) {
        const ada = await kueri("SELECT perkara_id FROM perkara WHERE perkara_id = ? LIMIT 1", [ulang.perkaraId]);
        if (ada.length) {
          contoh.push(ulang);
          continue;
        }
      }
      const b = await kueri(
        `SELECT p.perkara_id, p.nomor_perkara FROM perkara p LEFT JOIN perkara_putusan pp ON pp.perkara_id = p.perkara_id
          WHERE p.jenis_perkara_id = ? AND p.alur_perkara_id = ? AND ${putus ? "pp.tanggal_putusan IS NOT NULL" : "pp.tanggal_putusan IS NULL"}
          ORDER BY p.perkara_id DESC LIMIT 1`,
        [k.jenis_perkara_id, k.alur_perkara_id]
      );
      if (b[0]) contoh.push({ perkaraId: Number(b[0].perkara_id), nomor: teks(b[0].nomor_perkara), jenisId: Number(k.jenis_perkara_id), alurId: Number(k.alur_perkara_id), jenis: teks(k.nama), putus });
    }
  }
  return contoh;
}

/**
 * Satu putaran pindai. Bergantung (semua disuntik, tidak ada sambungan sendiri):
 *   kueri(sql, params, opsi) -> baris   (sambungan baca SIPP; skema ABT disebut dengan awalan)
 *   indeksDerry() -> { peta: Map(noVar -> [berkas relatif]) , jumlahBerkas }
 *   buatMesin(opsi) -> mesin variabel
 *   sebelum  hasil pindai sebelumnya (atau null)
 *   kini     Date
 * -> hasil (JSON) - lihat ringkas().
 */
async function pindaiSekali(d) {
  const mulai = Date.now();
  const kini = d.kini instanceof Date ? d.kini : new Date();
  const skema = teks(d.skemaAbt || process.env.ALETA_ABT_SKEMA || "aps_badilag").trim();
  if (!/^[A-Za-z0-9_]+$/.test(skema)) throw new Error("nama skema ABT tidak sah");
  const { peta } = await d.indeksDerry();
  const kat = await d.kueri(`SELECT no_var, nama, data_type, modifier FROM ${skema}.abt_variabel`);
  const katalog = new Map(kat.map((b) => [teks(b.no_var).trim().padStart(4, "0"), b]));
  const variabel = [...peta.entries()]
    .map(([no, berkas]) => ({ no, berkas, def: katalog.get(no) }))
    .filter((x) => x.def && JENIS_DIPINDAI.includes(teks(x.def.data_type)))
    .map((x) => ({ no: x.no, nama: teks(x.def.nama).slice(0, 90), jenis: teks(x.def.data_type), derry: teks(x.def.modifier) === "admin", folder: [...new Set(x.berkas.map((b) => b.split("/")[0]))], blangko: x.berkas.length }));
  const contoh = await pilihContoh(d.kueri, d.sebelum);
  const mesin = d.buatMesin({ kueri: d.kueri, skemaAbt: skema, umurKatalogMs: 10 * 60 * 1000, batasKueriMs: Number(d.batasKueriMs) || 10000 });
  const hasilPerkara = [];
  for (const c of contoh) {
    const nilai = {};
    const t0 = Date.now();
    for (let i = 0; i < variabel.length; i += POTONGAN) {
      const potong = variabel.slice(i, i + POTONGAN).map((v) => v.no);
      let p;
      try {
        p = await mesin.nilaiPenanda({ perkaraId: c.perkaraId, sidangKe: 0 }, potong);
      } catch (g) {
        p = new Map(potong.map((no) => [no, { status: "galat", sebab: teks((g && g.message) || g), polos: "" }]));
      }
      for (const no of potong) nilai[no] = golongkan(p.get(no));
    }
    // Waktu habis (server sibuk) bukan kueri yang salah: diulang SEKALI, bergiliran, dengan batas lebih longgar.
    const lambat = Object.keys(nilai).filter((no) => nilai[no].golongan === "lambat");
    if (lambat.length) {
      const ulang = d.buatMesin({ kueri: d.kueri, skemaAbt: skema, umurKatalogMs: 10 * 60 * 1000, batasKueriMs: Number(d.batasUlangMs) || BATAS_ULANG_MS });
      for (let i = 0; i < lambat.length; i += 20) {
        const potong = lambat.slice(i, i + 20);
        try {
          const p = await ulang.nilaiPenanda({ perkaraId: c.perkaraId, sidangKe: 0 }, potong);
          for (const no of potong) nilai[no] = golongkan(p.get(no));
        } catch {
          /* tetap "lambat" */
        }
      }
    }
    hasilPerkara.push({ ...c, detik: Math.round((Date.now() - t0) / 1000), nilai });
  }
  // Golongan per variabel
  const lamaTerisi = new Map();
  for (const hp of Array.isArray(d.sebelum && d.sebelum.terisi) ? d.sebelum.terisi : []) lamaTerisi.set(String(hp.perkaraId), new Set(hp.kode || []));
  const temuan = { galat: [], lambat: [], penanda: [], bunyi: [], kosongBaru: [] };
  for (const v of variabel) {
    const per = { galat: [], lambat: [], penanda: [], bunyi: [], kosongBaru: [] };
    for (const hp of hasilPerkara) {
      const g = hp.nilai[v.no];
      if (!g) continue;
      const sejenis = folderCocok(v.folder, hp.jenis);
      if (g.golongan === "galat") per.galat.push({ perkara: hp.nomor, jenis: hp.jenis, contoh: g.contoh });
      else if (g.golongan === "lambat") per.lambat.push({ perkara: hp.nomor, jenis: hp.jenis, contoh: g.contoh });
      else if (g.golongan === "penanda" && sejenis) per.penanda.push({ perkara: hp.nomor, jenis: hp.jenis, contoh: g.contoh });
      else if (g.golongan === "bunyi" && sejenis) per.bunyi.push({ perkara: hp.nomor, jenis: hp.jenis, contoh: g.contoh });
      const dulu = lamaTerisi.get(String(hp.perkaraId));
      if (dulu && dulu.has(v.no) && (g.golongan === "kosong" || g.golongan === "takada")) per.kosongBaru.push({ perkara: hp.nomor, jenis: hp.jenis, contoh: "" });
    }
    for (const k of Object.keys(temuan)) {
      if (per[k].length) temuan[k].push({ no: v.no, nama: v.nama, jenis: v.jenis, derry: v.derry, blangko: v.blangko, perkara: per[k].slice(0, 4), jumlah: per[k].length });
    }
  }
  const urut = (a, b) => b.blangko - a.blangko || a.no.localeCompare(b.no);
  for (const k of Object.keys(temuan)) temuan[k].sort(urut);
  return {
    versi: 1,
    selesai: kini.toISOString(),
    detik: Math.round((Date.now() - mulai) / 1000),
    jumlahVariabel: variabel.length,
    contoh: contoh.map(({ perkaraId, nomor, jenisId, alurId, jenis, putus }) => ({ perkaraId, nomor, jenisId, alurId, jenis, putus })),
    detikPerkara: hasilPerkara.map((h) => ({ nomor: h.nomor, detik: h.detik })),
    temuan,
    // Ingatan untuk pekan berikutnya: kode yang TERISI per perkara contoh.
    terisi: hasilPerkara.map((h) => ({ perkaraId: h.perkaraId, kode: Object.entries(h.nilai).filter(([, g]) => g.golongan === "terisi").map(([no]) => no) })),
  };
}

/** Ringkasan untuk Pusat Kesehatan (tanpa ingatan "terisi" yang besar). */
function ringkas(h) {
  if (!h || !h.temuan) return null;
  const n = (k) => (Array.isArray(h.temuan[k]) ? h.temuan[k].length : 0);
  return {
    selesai: h.selesai,
    detik: h.detik,
    jumlahVariabel: h.jumlahVariabel,
    jumlahContoh: Array.isArray(h.contoh) ? h.contoh.length : 0,
    contoh: h.contoh,
    jumlah: { galat: n("galat"), lambat: n("lambat"), penanda: n("penanda"), bunyi: n("bunyi"), kosongBaru: n("kosongBaru") },
    temuan: {
      galat: (h.temuan.galat || []).slice(0, 30),
      lambat: (h.temuan.lambat || []).slice(0, 30),
      penanda: (h.temuan.penanda || []).slice(0, 30),
      bunyi: (h.temuan.bunyi || []).slice(0, 30),
      kosongBaru: (h.temuan.kosongBaru || []).slice(0, 30),
    },
    adaPembanding: h.adaPembanding === true,
  };
}

let sedangJalan = null;

/**
 * Jalankan, simpan (terakhir + riwayat ringkas), kembalikan ringkasan. Satu putaran sekaligus.
 * deps: { kueri, indeksDerry, buatMesin, skemaAbt, berkas, kini }
 */
async function jalankan(deps) {
  if (sedangJalan) return sedangJalan;
  sedangJalan = (async () => {
    const berkas = deps.berkas || berkasHasil();
    const simpanan = bacaSimpanan(berkas) || {};
    const sebelum = simpanan.terakhir || null;
    const h = await pindaiSekali({ ...deps, sebelum });
    h.adaPembanding = Boolean(sebelum && Array.isArray(sebelum.terisi) && sebelum.terisi.length);
    const riwayat = [ringkasRiwayat(h), ...(Array.isArray(simpanan.riwayat) ? simpanan.riwayat : [])].slice(0, RIWAYAT_MAKS);
    tulisSimpanan(berkas, { terakhir: h, riwayat });
    return ringkas(h);
  })();
  try {
    return await sedangJalan;
  } finally {
    sedangJalan = null;
  }
}

function ringkasRiwayat(h) {
  const r = ringkas(h);
  return { selesai: r.selesai, detik: r.detik, jumlahVariabel: r.jumlahVariabel, jumlahContoh: r.jumlahContoh, jumlah: r.jumlah };
}

/** Hasil terakhir + riwayat ringkas (baca berkas; tidak menjalankan pindai). */
function bacaHasil(berkas = berkasHasil()) {
  const s = bacaSimpanan(berkas);
  if (!s || !s.terakhir) return { ada: false, sedangJalan: Boolean(sedangJalan), riwayat: [] };
  return { ada: true, sedangJalan: Boolean(sedangJalan), terakhir: ringkas(s.terakhir), riwayat: Array.isArray(s.riwayat) ? s.riwayat : [] };
}

/** Dependensi sungguhan: kolam SIPP baca-saja (sebagai pekerjaan LATAR), indeks & mesin variabel yang sama dengan Pengaturan ABT. */
function depsAsli() {
  const externalDbService = require("./externalDbService");
  const kolam = require("./kolamSippService");
  const pengaturan = require("./abtPengaturanService");
  const { buatMesin } = require("./abtMesinVariabel");
  const kueri = (sql, params, opsi) =>
    kolam.latar(() =>
      externalDbService.query("sipp_primary", { sql, timeout: (opsi && opsi.timeoutMs) || 15000, typeCast: (field) => field.string() }, params || [])
    );
  return { kueri, indeksDerry: () => pengaturan.layanan().indeksDerry(), buatMesin };
}

/** Jadwal bawaan: Minggu 02.15 (di luar jam kerja). ALETA_PINDAI_VARIABEL=0 mematikan; ALETA_PINDAI_VARIABEL_CRON mengganti jadwal. */
function jadwal(cron, env = process.env, catat = console) {
  if (String(env.ALETA_PINDAI_VARIABEL || "1") === "0") return null;
  const ekspresi = String(env.ALETA_PINDAI_VARIABEL_CRON || "15 02 * * 0").trim();
  return cron.schedule(ekspresi, () => {
    jalankan(depsAsli())
      .then((r) => catat.log(`[pindai-variabel] selesai: ${r ? `${r.jumlahVariabel} variabel x ${r.jumlahContoh} perkara, galat ${r.jumlah.galat}, penanda ${r.jumlah.penanda}, kosong baru ${r.jumlah.kosongBaru}` : "-"}`))
      .catch((g) => catat.error("[pindai-variabel] gagal:", (g && g.message) || g));
  });
}

module.exports = { pindaiSekali, jalankan, bacaHasil, ringkas, golongkan, folderCocok, pilihContoh, depsAsli, jadwal, berkasHasil, FOLDER_JENIS, JENIS_DIPINDAI, POLA_BUNYI };
