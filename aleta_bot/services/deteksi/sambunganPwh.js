"use strict";

/**
 * ============================================================================
 * SAMBUNGAN RUTE /abt/usulan (sumber "posita-lain") UNTUK IZIN POLIGAMI,
 * HARTA BERSAMA, KEWARISAN, DAN PENETAPAN AHLI WARIS - butir 16, 13 Okt 2026
 * ============================================================================
 *
 * Modul per jenis (deteksi/poligami.js, hartaBersama.js, waris.js) murni:
 * posita + opsi -> fakta. Berkas ini satu-satunya yang:
 *   1. membaca SIPP (BACA SAJA): petitum, perkara_alasan_nikah (alasan izin
 *      poligami + nominal_penghasilan), perkara_pihak1 (nama berurutan, untuk
 *      "Pemohon I" di posita P3HP), jenis_perkara_id bila ekstensi hanya
 *      mengirim nama jenis;
 *   2. menggabungkan usulan modul ke jawaban posita-lain yang sudah ada:
 *      kode yang sama dari kamus per jenis (pola "ragu" lama) DIGANTI usulan
 *      modul yang berisi; keputusan sumber terukur jalur lama (bawaanAbt,
 *      belumSiap) tidak disentuh.
 *
 * Tiap usulan diberi `jagaIsianLama: true`: ekstensi tidak mencentangnya
 * sendiri bila variabel di blangko SUDAH berisi isian (bukan kosong/"..."/
 * bawaan bergaris bawah) - isian petugas yang berbeda tidak ditimpa diam-diam.
 */

const pemuat = require("./index");

const JENIS_PWH = new Set([341, 348, 364, 365, 371]);
const NAMA_JENIS = [
  [/poligami/i, 341],
  [/harta\s+bersama|gono\s*-?\s*gini/i, 348],
  [/wasiat/i, 365],
  [/kewarisan|gugatan\s+waris/i, 364],
  [/ahli\s+waris|p3hp/i, 371],
];

/** Id jenis perkara dari id/nama; 0 bila bukan salah satu jenis ini. */
function idJenis(jenis) {
  const t = String(jenis === undefined || jenis === null ? "" : jenis).trim();
  const n = Number(t);
  if (Number.isFinite(n) && JENIS_PWH.has(n)) return n;
  for (const [re, id] of NAMA_JENIS) if (re.test(t)) return id;
  return 0;
}

function runQuery(sql, params) {
  const db = require("../../db_config");
  return new Promise((resolve, reject) => {
    db.query(sql, params || [], (e, r) => (e ? reject(e) : resolve(r)));
  });
}

/**
 * Data SIPP yang dipakai modul - HANYA SELECT. null bila perkara tak ada.
 * @returns {Promise<{perkaraId, jenisPerkaraId, petitum, alasanNikah: Array, pihak1: Array}|null>}
 */
async function bacaSipp(nomorPerkara, kueri = runQuery) {
  const nomor = String(nomorPerkara || "").trim();
  if (!nomor) return null;
  const baris = await kueri("SELECT perkara_id, jenis_perkara_id, petitum FROM perkara WHERE nomor_perkara = ? LIMIT 1", [nomor]);
  if (!Array.isArray(baris) || !baris[0]) return null;
  const id = baris[0].perkara_id;
  const [alasanNikah, pihak1] = await Promise.all([
    kueri("SELECT alasan_id, nama, nominal_penghasilan FROM perkara_alasan_nikah WHERE perkara_id = ?", [id]).catch(() => []),
    kueri("SELECT nama, urutan FROM perkara_pihak1 WHERE perkara_id = ? ORDER BY urutan", [id]).catch(() => []),
  ]);
  return {
    perkaraId: id,
    jenisPerkaraId: Number(baris[0].jenis_perkara_id) || 0,
    petitum: String(baris[0].petitum || ""),
    alasanNikah: Array.isArray(alasanNikah) ? alasanNikah : [],
    pihak1: Array.isArray(pihak1) ? pihak1 : [],
  };
}

/**
 * Menambah usulan modul jenis ke jawaban posita-lain.
 * @param {object|null} hasil jawaban dariPositaLain + tambahUsulanJenis
 * @param {string} posita
 * @param {{jenisPerkara, alur?, sipp?}} opsi
 */
function tambahUsulanPwh(hasil, posita, opsi = {}) {
  const sipp = opsi.sipp || null;
  const jenis = idJenis(opsi.jenisPerkara) || (sipp && JENIS_PWH.has(sipp.jenisPerkaraId) ? sipp.jenisPerkaraId : 0);
  if (!jenis) return hasil;
  const modul = pemuat.modulUntuk(jenis);
  if (!modul) return hasil;
  const baru = pemuat
    .usulanModul(jenis, posita, {
      jenisPerkara: jenis,
      alur: opsi.alur,
      petitum: opsi.petitum !== undefined ? opsi.petitum : sipp ? sipp.petitum : "",
      sipp: sipp || { alasanNikah: opsi.alasanNikah || [], pihak1: opsi.pihak1 || [] },
    })
    .map((u) => ({ ...u, jagaIsianLama: true, jenisPerkara: modul.kunci, siap: u.keyakinan === "cukup" }));
  if (!baru.length) return hasil;
  const lama = hasil && typeof hasil === "object" ? hasil : null;
  const kodeBaru = new Set(baru.map((u) => String(u.kode)));
  const catatan = `${baru.length} variabel ${modul.kunci} dari posita/petitum/SIPP (${baru.filter((u) => u.keyakinan === "cukup").length} tercentang; selebihnya "ragu" - periksa kalimat sumbernya).`;
  if (!lama || lama.ok === false) {
    return { ok: true, jenis: modul.kunci, usulan: baru, belumSiap: [], bawaanAbt: [], catatan };
  }
  // Kode yang jalur lama putuskan diserahkan ke bawaan ABT / belum siap tidak diusulkan ulang.
  const diputuskan = new Set([...(lama.bawaanAbt || []), ...(lama.belumSiap || [])].map((u) => String(u && u.kode)));
  const tambahan = baru.filter((u) => !diputuskan.has(String(u.kode)));
  return {
    ...lama,
    usulan: [...(Array.isArray(lama.usulan) ? lama.usulan : []).filter((u) => !kodeBaru.has(String(u && u.kode)) || !tambahan.some((t) => t.kode === u.kode)), ...tambahan],
    catatan: [lama.catatan || "", catatan].filter(Boolean).join(" "),
  };
}

module.exports = { JENIS_PWH, idJenis, bacaSipp, tambahUsulanPwh };
