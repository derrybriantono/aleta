"use strict";

/**
 * ============================================================================
 * TAHAP PEMBUKTIAN PER SIDANG - URUTAN PIHAK (keputusan pengguna 52, 1 Nov 2026; MENGGANTI keputusan 29-30)
 * ============================================================================
 *
 *   1. Pembuktian selalu DIAWALI Penggugat/Pemohon.
 *   2. "Pembuktian lanjutan" (dan agenda pembuktian lain tanpa sebutan pihak) MELANJUTKAN pihak yang sedang membuktikan.
 *   3. Agenda pembuktian tanpa sebutan pihak SESUDAH pembuktian Penggugat SELESAI = pembuktian Tergugat/Termohon.
 *   4. Satu tahap pembuktian bisa beberapa hari sidang (sidang lanjutan atas permintaan pihak) - semuanya satu tahap;
 *      tanggal tahap = sidang PERTAMA tahap itu.
 *
 * "Pembuktian Penggugat selesai" dibaca dari data SIPP (perkara_jadwal_sidang), bukan ditebak dari urutan sidang:
 *   - agenda sidang yang TEGAS pembuktian Tergugat ("pembuktian tergugat", "saksi termohon", "pembuktian lanjutan tergugat");
 *   - alasan ditunda / keterangan sidang yang menyebut pembuktian Tergugat berikutnya ("Pembuktian Tergugat"), kesimpulan
 *     (tanpa kata bukti), atau Penggugat mencukupkan buktinya ("telah mencukupkan alat buktinya", "pemohon cukup bukti",
 *     "tidak mengajukan lagi bukti"; "belum cukup bukti" BUKAN);
 *   - alasan ditunda / keterangan yang menyebut Tergugat SUDAH mulai membuktikan pada sidang itu ("Pembuktian Lanjutan
 *     Termohon", "selanjutnya termohon mengajukan bukti") - sidang itu milik kedua pihak.
 * Tanda selesai hanya berlaku sesudah pembuktian dimulai (sidang pembuktian pertama atau sesudahnya), dan aturan 3 hanya untuk
 * perkara gugatan (Pdt.G) - permohonan tidak punya pihak lawan yang membuktikan.
 *
 * KEMBARAN paket ABT abt-paket/pembuktian-urut-1nov (variabel 2111/7119 Penggugat, 2112/7121 Tergugat, MariaDB 5.5 POSIX):
 * pola di bawah SAMA dengan pola paket (dijaga agenda-selingkuh-1nov.test.ts; banding atas SIPP di hasil/ paket itu).
 * Murni: tanpa basis data.
 */

// Pola (huruf kecil) ditulis SEKALI dalam bentuk POSIX MariaDB 5.5 (dipakai paket ABT apa adanya); bentuk JS diturunkan
// ([[:space:]] -> \s). Tanpa \b / lookbehind - tidak ada di REGEXP MariaDB 5.5.
const SP = "[[:space:]]+";
const POSIX = {
  BUKTI: "bukti|saksi",
  // Pembuktian TEGAS Tergugat: sebutan Tergugat/Termohon TEPAT sesudah kata bukti/saksi ("pembuktian tergugat", "saksi termohon",
  // "pembuktian lanjutan tergugat", "pembuktian penggugat dan tergugat"); "pembuktian dan panggil tergugat" BUKAN.
  // Singkatan "P"/"T" ("Pembuktian lanjutan P", "pembuktian T.") diterima bila tidak diikuti huruf ("pembuktian tambahan" bukan T).
  T: `(bukti|saksi)[a-z-]*(${SP}lanjutan|${SP}tambahan)?(${SP}dari|${SP}oleh|${SP}untuk)?${SP}((penggugat|pemohon|p)${SP}dan${SP})?(tergugat|termohon|t([^a-z]|$))`,
  P: `(bukti|saksi)[a-z-]*(${SP}lanjutan|${SP}tambahan)?(${SP}dari|${SP}oleh|${SP}untuk)?${SP}(penggugat|pemohon|p([^a-z]|$))`,
  // Penggugat mencukupkan buktinya / tidak mengajukan bukti lagi ("belum cukup" disaring terpisah).
  CUKUP: `(penggugat|pemohon)[a-z ,]{0,40}(mencukupkan|cukup${SP}(alat${SP})?bukti)|tidak${SP}(akan${SP})?(lagi${SP})?mengajukan${SP}(lagi${SP})?(alat${SP})?bukti`,
  // Tergugat SUDAH mulai membuktikan pada sidang itu.
  T_MULAI: `(bukti|saksi)[a-z-]*${SP}lanjutan(${SP}dari|${SP}oleh|${SP}untuk)?${SP}(tergugat|termohon)|(tergugat|termohon)${SP}(telah${SP}|juga${SP})?mengajukan${SP}(alat${SP})?(bukti|saksi)`,
};
const keJs = (x) => new RegExp(x.split("[[:space:]]").join("\\s"));
const RE_BUKTI = keJs(POSIX.BUKTI);
const RE_T = keJs(POSIX.T);
const RE_P = keJs(POSIX.P);
const RE_CUKUP = keJs(POSIX.CUKUP);
const RE_T_MULAI = keJs(POSIX.T_MULAI);
const RE_KESIMPULAN = /kesimpulan/;
const RE_BELUM = /belum\s+cukup/;

const kecil = (x) => String(x == null ? "" : x).toLowerCase().replace(/\s+/g, " ").trim();

/** Tanda pada alasan ditunda/keterangan satu sidang. */
function tandaTeks(teks) {
  const t = kecil(teks);
  if (!t) return { selesaiP: false, mulaiT: false };
  const mulaiT = RE_T_MULAI.test(t);
  const selesaiP = mulaiT || RE_T.test(t) || (RE_KESIMPULAN.test(t) && !RE_BUKTI.test(t)) || (RE_CUKUP.test(t) && !RE_BELUM.test(t));
  return { selesaiP, mulaiT };
}

/**
 * Pihak yang membuktikan pada tiap sidang satu perkara.
 * @param {Array<{sidangId?, tanggalSidang?, agenda?, alasanDitunda?, keterangan?}>} sidang  urut tanggal_sidang, id
 * @param {{gugatan?: boolean}} opsi  gugatan = perkara Pdt.G (bawaan true)
 * @returns {Array<{sidangId, tanggalSidang, sisi: "P"|"T"|"PT"|null, sebab: string}>} sisi null = bukan sidang pembuktian
 */
function tahapPembuktian(sidang, opsi) {
  const gugatan = !(opsi && opsi.gugatan === false);
  let mulai = false; // pembuktian sudah dimulai (ada sidang pembuktian sebelumnya / sidang ini)
  let selesaiP = false; // pembuktian Penggugat selesai SEBELUM sidang ini
  let sebabSelesai = "";
  const hasil = [];
  for (const s of Array.isArray(sidang) ? sidang : []) {
    const a = kecil(s && s.agenda);
    const bukti = RE_BUKTI.test(a);
    const tanda = [tandaTeks(s && s.alasanDitunda), tandaTeks(s && s.keterangan)];
    let sisi = null;
    let sebab = "";
    if (bukti) {
      const t = RE_T.test(a);
      const p = RE_P.test(a);
      if (t && p) [sisi, sebab] = ["PT", "agenda menyebut kedua pihak"];
      else if (t) [sisi, sebab] = ["T", "agenda pembuktian Tergugat"];
      else if (p) [sisi, sebab] = ["P", "agenda pembuktian Penggugat"];
      else if (!mulai) [sisi, sebab] = ["P", "pembuktian diawali Penggugat"];
      else if (selesaiP && gugatan) [sisi, sebab] = ["T", `pembuktian Penggugat sudah selesai (${sebabSelesai})`];
      else [sisi, sebab] = ["P", "pembuktian lanjutan pihak yang sedang membuktikan"];
      if (gugatan && sisi === "P" && tanda.some((x) => x.mulaiT)) [sisi, sebab] = ["PT", "Tergugat mulai membuktikan pada sidang ini (alasan ditunda/keterangan)"];
      mulai = true;
      if (sisi === "T" || sisi === "PT") {
        if (!selesaiP) sebabSelesai = sisi === "T" ? "agenda pembuktian Tergugat" : "Tergugat mulai membuktikan";
        selesaiP = true;
      }
    } else if (!mulai) {
      // Sidang sebelum pembuktian: tandanya tidak berlaku.
      hasil.push({ sidangId: s && s.sidangId, tanggalSidang: s && s.tanggalSidang, sisi: null, sebab: "" });
      continue;
    } else if (/kesimpulan/.test(a) && !selesaiP) {
      selesaiP = true;
      sebabSelesai = "agenda kesimpulan";
    }
    if (!selesaiP && tanda.some((x) => x.selesaiP)) {
      selesaiP = true;
      sebabSelesai = "alasan ditunda/keterangan sidang";
    }
    hasil.push({ sidangId: s && s.sidangId, tanggalSidang: s && s.tanggalSidang, sisi, sebab });
  }
  return hasil;
}

/** Tanggal sidang pertama tahap pembuktian tiap pihak: { P: tanggal|null, T: tanggal|null }. */
function mulaiTahap(sidang, opsi) {
  const out = { P: null, T: null };
  for (const x of tahapPembuktian(sidang, opsi)) {
    if (!x.sisi) continue;
    if (!out.P && x.sisi.includes("P")) out.P = x.tanggalSidang;
    if (!out.T && x.sisi.includes("T")) out.T = x.tanggalSidang;
  }
  return out;
}

module.exports = { tahapPembuktian, mulaiTahap, tandaTeks, POSIX };
