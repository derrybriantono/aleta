"use strict";

/**
 * ============================================================================
 * PENANDA PERKARA DAN PIHAK UNTUK JADWAL SIDANG (12 Okt 2026, butir 5)
 * ============================================================================
 *
 * Permintaan pengguna: "berikan penanda ghaib, prodeo dan PNS, PPPK, POLRI, TNI
 * dan BUMN BUMD di samping nama pihaknya (kalau ghaib, prodeo di samping nomor
 * perkara), beri tanda perkara non e-Court di samping nomor perkara (apabila
 * e-Court maka tidak perlu ada), tambah juga di rincian".
 *
 * Berkas ini hanya MENGUMPULKAN bahan untuk seluruh daftar dengan sedikit
 * kueri; tidak satu pun aturan baru ditulis di sini:
 *
 *   GHAIB      sippTahapanService.penandaGhaibBanyakPerkara - penciri yang SAMA
 *              dengan kelonggaran 120 hari SK 048/2024 dan layar Status Perkara
 *              (empat sumber; yang menyala disebut sumbernya). Dua penciri
 *              untuk satu pertanyaan pernah membuat dua layar berselisih.
 *   PRODEO     perkara.prodeo = 1 - kolom yang sama dengan kueri bot lama
 *              ("monev prodeo", daftar sidang WhatsApp). Diukur di
 *              sipp_donggala: 118 dari 10.216 perkara.
 *   NON E-COURT  bukan dihitung di sini: baris jadwal sudah membawa
 *              `lewatEcourt` (perkara_efiling_id). Yang ditambahkan di sini
 *              hanya KETERBACAANNYA (lihat sippJadwalSidangService) - peta e-Court
 *              yang gagal dibaca kosong, dan membaca "non e-Court" dari peta
 *              kosong itu menuduh SELURUH daftar.
 *   PEKERJAAN  pekerjaanPihakService.klasifikasiPekerjaan - penggolongan SAMA
 *              dengan variabel ABT 8510/8524/8533 dan lajur Data Pihak SIPP
 *              (keputusan 11 Okt: pensiunan, CPNS, PPPK paruh waktu BUKAN PNS;
 *              PPPK berlencana sendiri; aparat desa bukan PNS). Aturan kedua
 *              tidak dibuat: yang diberi lencana hanya kunci PNS, PPPK, POLRI,
 *              TNI, BUMN, BUMD.
 *
 * SIPP hanya DIBACA. Gagal sendiri-sendiri: jadwal tetap tampil tanpa lencana.
 */

const { cleanText } = require("./ecourtTextService");
const pekerjaanPihakService = require("./pekerjaanPihakService");

/** Kunci penggolongan pekerjaan yang diberi lencana (DESA, BUKAN, LAIN, KOSONG tidak). */
const KUNCI_BERLENCANA = Object.freeze(["PNS", "PPPK", "POLRI", "TNI", "BUMN", "BUMD"]);

/** perkara_pihak1..4 - penggugat, tergugat, intervensi, turut tergugat. Saksi (5) tidak. */
const SISI_PIHAK = Object.freeze([1, 2, 3, 4]);

function idBersih(daftar = []) {
  return [...new Set((daftar || []).map((x) => Number(x)).filter((x) => Number.isFinite(x) && x > 0))].slice(0, 500);
}

/**
 * Sebutan pada lencana. Pilihan SIPP "Pegawai BUMN/BUMD" dan "BUMD" masuk ke kunci
 * BUMN pada kamus (hanya satu entri 'pilihan'), jadi sebutannya dibetulkan dari teks:
 * yang menyebut keduanya = "BUMN/BUMD", yang hanya BUMD = "BUMD".
 */
function sebutanLencana(kunci, teks) {
  const t = String(teks || "").toLowerCase();
  if (kunci === "BUMN" || kunci === "BUMD") {
    const bumn = /\bbumn\b/.test(t);
    const bumd = /\bbumd\b/.test(t);
    if (bumn && bumd) return "BUMN/BUMD";
    if (bumd && !bumn) return "BUMD";
  }
  return kunci;
}

/**
 * Lencana pekerjaan satu pihak, atau null bila pekerjaannya tidak termasuk yang
 * dilencanai. Murni (selain membaca kamus lewat pekerjaanPihakService).
 *
 * @returns {{kunci: string, label: string, ragu: boolean, kalimat: string} | null}
 */
function lencanaPekerjaan(teksPekerjaan) {
  const k = pekerjaanPihakService.klasifikasiPekerjaan(teksPekerjaan);
  if (!KUNCI_BERLENCANA.includes(k.kunci)) return null;
  return {
    kunci: k.kunci,
    label: sebutanLencana(k.kunci, teksPekerjaan),
    ragu: k.yakin === "ragu",
    kalimat: pekerjaanPihakService.kalimatTerbaca(teksPekerjaan, k),
  };
}

let dbCadangan = null;
function runQueryBawaan(sql, params = []) {
  if (!dbCadangan) dbCadangan = require("../db_config");
  return new Promise((resolve, reject) => {
    dbCadangan.query(sql, params, (error, rows) => (error ? reject(error) : resolve(Array.isArray(rows) ? rows : [])));
  });
}

/**
 * Perkara berprodeo, untuk sekumpulan perkara. Hanya yang prodeo punya kunci.
 * Melempar bila kolomnya tidak terbaca - pemanggil mencatatnya sebagai tidak terbaca.
 */
async function prodeoBanyakPerkara(daftarPerkaraId, deps = {}) {
  const id = idBersih(daftarPerkaraId);
  const hasil = {};
  if (id.length === 0) return hasil;
  const kueri = deps.kueri || runQueryBawaan;
  const skema = deps.skema || require("./sippSkemaService");
  // Pemasangan SIPP yang belum punya kolomnya: tidak ada yang bisa ditandai prodeo,
  // dan itu BUKAN galat (tidak ada yang dituduh).
  if (!(await skema.kolomAda("perkara", "prodeo"))) return hasil;
  const rows = await kueri(
    `SELECT perkara_id AS perkaraId FROM perkara WHERE prodeo = 1 AND perkara_id IN (${id.map(() => "?").join(", ")})`,
    id
  );
  for (const baris of rows) hasil[String(baris.perkaraId)] = true;
  return hasil;
}

/**
 * Pihak (kedudukan 1-4) berlencana pekerjaan, untuk sekumpulan perkara.
 *
 * @returns {Promise<Record<string, Array<{sisi:number, nama:string, kunci:string, label:string, ragu:boolean, kalimat:string}>>>}
 *   hanya perkara yang punya pihak berlencana yang berkunci.
 */
async function pekerjaanPihakBanyakPerkara(daftarPerkaraId, deps = {}) {
  const id = idBersih(daftarPerkaraId);
  const hasil = {};
  if (id.length === 0) return hasil;
  const kueri = deps.kueri || runQueryBawaan;
  const skema = deps.skema || require("./sippSkemaService");
  const kolom = await skema.pilihKolom("pihak", ["pekerjaan", "pekerjaan_nama", "jenis_pekerjaan"]);
  if (!kolom) throw new Error("kolom pekerjaan pada tabel pihak tidak ditemukan");
  const isian = id.map(() => "?").join(", ");
  const cabang = SISI_PIHAK.map(
    (n) =>
      `SELECT k.perkara_id AS perkaraId, ${n} AS sisi, k.urutan AS urutan, k.nama AS nama, p.${kolom} AS pekerjaan
         FROM perkara_pihak${n} k LEFT JOIN pihak p ON p.id = k.pihak_id
        WHERE k.perkara_id IN (${isian})`
  );
  const rows = await kueri(
    `${cabang.join(" UNION ALL ")} ORDER BY perkaraId ASC, sisi ASC, urutan ASC`,
    SISI_PIHAK.flatMap(() => id)
  );
  for (const baris of rows) {
    const nama = cleanText(baris.nama);
    if (!nama || !baris.pekerjaan) continue;
    const l = lencanaPekerjaan(baris.pekerjaan);
    if (!l) continue;
    const kunciPerkara = String(baris.perkaraId);
    if (!hasil[kunciPerkara]) hasil[kunciPerkara] = [];
    hasil[kunciPerkara].push({ sisi: Number(baris.sisi), nama, ...l });
  }
  return hasil;
}

/**
 * Bahan penanda perkara & pihak untuk seluruh daftar. Tiap bagian gagal sendiri:
 * `terbaca` memuat bagian yang SELURUHNYA terbaca (false = jangan menyimpulkan
 * apa pun dari ketiadaan lencana).
 *
 * @returns {Promise<{ghaib: Object, prodeo: Object, pekerjaan: Object, terbaca: {prodeo: boolean, pekerjaan: boolean}}>}
 */
async function bahanPenanda(daftarPerkaraId, deps = {}) {
  const id = idBersih(daftarPerkaraId);
  const terbaca = { prodeo: true, pekerjaan: true };
  const aman = async (kerja, nama) => {
    try {
      return await kerja();
    } catch {
      if (nama) terbaca[nama] = false;
      return {};
    }
  };
  const tahapan = deps.tahapan || (() => require("./sippTahapanService"));
  const [ghaib, prodeo, pekerjaan] = await Promise.all([
    // penandaGhaibBanyakPerkara sudah gagal-tertutup sendiri (himpunan kosong).
    aman(() => tahapan().penandaGhaibBanyakPerkara(id), ""),
    aman(() => prodeoBanyakPerkara(id, deps), "prodeo"),
    aman(() => pekerjaanPihakBanyakPerkara(id, deps), "pekerjaan"),
  ]);
  return { ghaib, prodeo, pekerjaan, terbaca };
}

/**
 * Ruas yang ditempelkan ke satu baris jadwal. Bentuknya DATA polos (JSON) -
 * layar tidak menghitung ulang apa pun.
 */
function ruasBaris(bahan, perkaraId) {
  const kunci = String(perkaraId);
  const g = bahan.ghaib[kunci] || null;
  return {
    penandaPerkara: {
      ghaib: Boolean(g),
      ghaibSumber: g ? g.sumber || [] : [],
      prodeo: Boolean(bahan.prodeo[kunci]),
    },
    penandaPihak: bahan.pekerjaan[kunci] || [],
    penandaProdeoTerbaca: bahan.terbaca.prodeo,
    penandaPekerjaanTerbaca: bahan.terbaca.pekerjaan,
  };
}

module.exports = {
  KUNCI_BERLENCANA,
  SISI_PIHAK,
  sebutanLencana,
  lencanaPekerjaan,
  prodeoBanyakPerkara,
  pekerjaanPihakBanyakPerkara,
  bahanPenanda,
  ruasBaris,
};
