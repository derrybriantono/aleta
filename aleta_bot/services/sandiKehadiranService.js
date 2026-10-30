"use strict";

/**
 * Sandi perkara_jadwal_sidang.dihadiri_oleh yang berarti Tergugat/Termohon atau Penggugat/Pemohon hadir (30 Okt 2026, agen G2B).
 * KEMBARAN manajemen_surat/src/lib/sandi-kehadiran.ts (dijaga sandi-kehadiran-g2b-30okt.test.ts - angka harus sama persis).
 *
 * Tergugat hadir = 1 semua pihak, 3 pihak kedua saja, 8 T + intervensi, 9 P + T (ada intervensi), 11 sebagian Tergugat, 15 T + turut T
 * - identik aturan "pernah hadir" paket ABT relaas-penetapan-30okt (upaya hukum pemberitahuan putusan).
 * Penggugat hadir = 1, 2 pihak pertama saja, 7 P + intervensi, 9, 10 sebagian Penggugat, 14 P + turut T.
 */
const SANDI_TERGUGAT_HADIR = Object.freeze([1, 3, 8, 9, 11, 15]);
const SANDI_PENGGUGAT_HADIR = Object.freeze([1, 2, 7, 9, 10, 14]);

const angka = (x) => (x === null || x === undefined || x === "" || !Number.isFinite(Number(x)) ? null : Number(x));
const tergugatHadirSandi = (x) => SANDI_TERGUGAT_HADIR.includes(angka(x));
const penggugatHadirSandi = (x) => SANDI_PENGGUGAT_HADIR.includes(angka(x));

module.exports = { SANDI_TERGUGAT_HADIR, SANDI_PENGGUGAT_HADIR, tergugatHadirSandi, penggugatHadirSandi };
