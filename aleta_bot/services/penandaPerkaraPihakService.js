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
 *   PRODEO     prodeoPerkaraService (26 Okt 2026): perkara.prodeo = 1 - kolom yang
 *              sama dengan kueri bot lama ("monev prodeo", daftar sidang WhatsApp)
 *              - ditambah persetujuan prodeo dari e-Court. Satu sumber dengan layar
 *              Status Perkara. Diukur di sipp_donggala: 124 dari 10.273 perkara.
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
 *   IZIN CERAI izinCeraiService (14 Okt 2026) - perkara cerai yang pihaknya
 *              PNS/PPPK/TNI/POLRI: perkara_izin_cerai SIPP, posita, judul
 *              dokumen e-Court. Lihat berkas itu untuk ukuran dan keadaannya.
 *
 * SIPP hanya DIBACA. Gagal sendiri-sendiri: jadwal tetap tampil tanpa lencana.
 */

const { cleanText } = require("./ecourtTextService");
const pekerjaanPihakService = require("./pekerjaanPihakService");
const izinCeraiService = require("./izinCeraiService");
const prodeoPerkaraService = require("./prodeoPerkaraService");

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
 *
 * 26 Okt 2026: sumbernya SATU, dipakai juga Status Perkara - lihat prodeoPerkaraService
 * (perkara.prodeo = 1, ditambah persetujuan prodeo dari e-Court).
 */
async function prodeoBanyakPerkara(daftarPerkaraId, deps = {}) {
  return prodeoPerkaraService.prodeoBanyakPerkara(daftarPerkaraId, deps);
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
 * @returns {Promise<{ghaib: Object, prodeo: Object, pekerjaan: Object, izinCerai: Object, terbaca: {prodeo: boolean, pekerjaan: boolean, izinCerai: boolean}}>}
 */
async function bahanPenanda(daftarPerkaraId, deps = {}) {
  const id = idBersih(daftarPerkaraId);
  const terbaca = { prodeo: true, pekerjaan: true, izinCerai: true };
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
    aman(() => prodeoPerkaraService.sumberProdeoBanyakPerkara(id, deps), "prodeo"),
    aman(() => pekerjaanPihakBanyakPerkara(id, deps), "pekerjaan"),
  ]);
  // Izin cerai bergantung pada lencana pekerjaan; pekerjaan tak terbaca = tidak menyimpulkan apa pun.
  const izinCerai = terbaca.pekerjaan
    ? await aman(
        () =>
          izinCeraiService.izinCeraiBanyakPerkara(id, pekerjaan, {
            kueri: deps.kueri || runQueryBawaan,
            skema: deps.skema,
            judulEcourt: deps.judulEcourt || izinCeraiService.judulEcourtBawaan,
          }),
        "izinCerai"
      )
    : {};
  if (!terbaca.pekerjaan) terbaca.izinCerai = false;
  return { ghaib, prodeo, pekerjaan, izinCerai, terbaca };
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
    // 26 Okt 2026: dari mana prodeonya dikenali (keterangan lencana), terpisah dari
    // penandaPerkara agar bentuk lama tidak berubah.
    penandaProdeoSumber: Array.isArray(bahan.prodeo[kunci]) ? bahan.prodeo[kunci] : [],
    penandaPihak: bahan.pekerjaan[kunci] || [],
    penandaProdeoTerbaca: bahan.terbaca.prodeo,
    penandaPekerjaanTerbaca: bahan.terbaca.pekerjaan,
    // 14 Okt 2026: {keadaan: ada|belum-dicatat|belum-ada|belum-terbaca, label, judul, sumber}
    // atau null (bukan cerai / tidak ada pihak wajib izin / tidak terbaca).
    izinCerai: (bahan.izinCerai && bahan.izinCerai[kunci]) || null,
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
