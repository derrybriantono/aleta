"use strict";

/**
 * ============================================================================
 * PEMUAT DETEKSI PER JENIS PERKARA (kerangka bersama, 13 Okt 2026)
 * ============================================================================
 *
 * Aturan deteksi variabel ABT dari posita/SIPP/e-Court DIPISAH per jenis
 * perkara, satu berkas per kelompok, supaya agen yang bekerja paralel tidak
 * menyunting berkas yang sama:
 *
 *   aleta_bot/services/deteksi/itsbat.js   itsbat nikah (voluntair & kontentius)
 *   aleta_bot/services/deteksi/cerai.js    cerai gugat / cerai talak (+ kumulasi)
 *   aleta_bot/services/deteksi/<jenis>.js  jenis lain - ditambahkan ke DAFTAR di bawah
 *
 * Bentuk satu modul:
 *
 *   module.exports = {
 *     kunci: "itsbat-nikah",            // kunci jenis (sama dengan deteksiJenisPerkaraService)
 *     jenisPerkaraId: [360],            // jenis_perkara_id SIPP
 *     variabel: [                       // PETA VARIABEL -> SUMBER (dokumentasi + uji cakupan)
 *       { kode: "5105", nama: "Alamat tempat menikah", sumber: "posita", blangko: ["putusan", "bas"] },
 *       { kode: "0364", nama: "Tgl. KTP Pemohon",      sumber: "ktp-ecourt" },
 *       ...
 *     ],
 *     deteksi(posita, opsi) {           // MURNI: tidak menulis, tidak membaca basis data
 *       return { "5105": { nilai, kalimat, yakin: "pasti"|"cukup"|"ragu" }, ... };
 *     },
 *   };
 *
 * `sumber`: posita | petitum | sipp | ktp-ecourt | berkas-ecourt | saksi-sipp |
 * dihitung-abt (data_sql/data_sipp - tidak diisi ALETA). Hanya `deteksi`
 * yang menghasilkan nilai; peta sumber dipakai untuk laporan cakupan.
 *
 * Modul yang belum ada (agen lain belum menambahkannya) dilewati diam-diam -
 * pemuat ini tidak pernah menggagalkan usulan.
 */

// Agen X/W/Y (13 Okt): DK, poligami, waris, harta bersama, perwalian, asal usul, pengangkatan anak, wali adhol, hadhanah, Lain-Lain.
const DAFTAR = Object.freeze(["itsbat", "cerai", "dispensasiKawin", "poligami", "waris", "hartaBersama", "perwalian", "asalUsul", "pengangkatanAnak", "waliAdhol", "hadhanah", "lainLain"]);

let tembolok = null;

function semuaModul() {
  if (tembolok) return tembolok;
  const hasil = [];
  for (const nama of DAFTAR) {
    try {
      const m = require(`./${nama}`);
      if (m && m.kunci && typeof m.deteksi === "function") hasil.push(m);
    } catch (galat) {
      if (!(galat && galat.code === "MODULE_NOT_FOUND" && String(galat.message).includes(`./${nama}`))) throw galat;
    }
  }
  tembolok = hasil;
  return hasil;
}

/** Modul untuk jenis perkara: id SIPP (360), kunci ("itsbat-nikah"), atau null. */
function modulUntuk(jenis) {
  const teks = String(jenis === undefined || jenis === null ? "" : jenis).trim();
  if (!teks) return null;
  const angka = Number(teks);
  return (
    semuaModul().find((m) => m.kunci === teks) ||
    (Number.isFinite(angka) ? semuaModul().find((m) => (m.jenisPerkaraId || []).includes(angka)) : null) ||
    null
  );
}

/** Peta variabel -> sumber satu jenis ([] bila tidak dikenal). */
function petaSumber(jenis) {
  const m = modulUntuk(jenis);
  return m ? m.variabel || [] : [];
}

/**
 * Usulan (bentuk panel ABT) dari modul jenis itu.
 * keyakinan: "pasti"/"cukup" -> "cukup" (tercentang), "ragu" -> "ragu".
 */
function usulanModul(jenis, posita, opsi = {}) {
  const m = modulUntuk(jenis);
  if (!m) return [];
  const fakta = m.deteksi(String(posita || ""), opsi) || {};
  const nama = new Map((m.variabel || []).map((v) => [String(v.kode), v.nama]));
  const hasil = [];
  for (const [kode, f] of Object.entries(fakta)) {
    if (!f || !String(f.nilai || "").trim()) continue;
    hasil.push({
      kode,
      nama: nama.get(kode) || kode,
      nilai: String(f.nilai),
      keyakinan: f.yakin === "ragu" ? "ragu" : "cukup",
      bentrok: "",
      catatan: f.catatan || "",
      dihitung: false,
      sumber: f.kalimat ? [{ saksi: 0, asal: f.asal || "posita", kalimat: String(f.kalimat).slice(0, 400) }] : [],
      kodePola: f.kodePola || `deteksi-${m.kunci}-${kode}`,
    });
  }
  return hasil;
}

module.exports = { DAFTAR, semuaModul, modulUntuk, petaSumber, usulanModul };
