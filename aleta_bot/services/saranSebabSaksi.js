"use strict";

/**
 * ============================================================================
 * KETERANGAN SAKSI OTOMATIS SEMUA JENIS PERKARA - SEBAB DALIL = SARAN (T2, 25 Okt 2026)
 * ============================================================================
 *
 * Keputusan pengguna yang berlaku (sama dengan perceraian):
 *   - POSITA acuan utama: jawaban saksi yang masih bertitik-titik diisi dari posita (sesudah isian blangko dan data SIPP);
 *   - sebab/alasan yang hanya didalilkan posita (belum dikuatkan saksi) = SARAN saja: keyakinannya "ragu", ditandai
 *     kuning di panel, dan keterangannya menyebut bahwa itu dalil yang belum dikuatkan saksi;
 *   - tanpa kalimat penutup (dijaga penutupSaksi.js di seluruh jalur tulis).
 *
 * Perceraian (cg/ct) TIDAK lewat sini: sebab perceraian sudah punya jalurnya sendiri (abtUsulanService, W49 22 Okt).
 *
 * Sebutan pihak yang kosong (variabel #0046#/#0047# belum terbaca) diturunkan dari alur_perkara_id / jenis_perkara_id
 * lewat sebutanPihakService - satu sumber, bukan tebakan kata. Murni (tanpa jaringan/basis data).
 */

const sebutanPihak = require("./sebutanPihakService");

/** Kunci fakta yang berupa SEBAB/ALASAN dalil (bukan identitas/peristiwa): bila hanya dari posita -> saran. */
const KUNCI_SEBAB_DALIL = Object.freeze([
  "penyebab", // sebab perselisihan (kumulasi / jenis lain yang memakainya)
  "alasanWali", // wali adhal: alasan wali enggan menikahkan
  "hamil", // dispensasi kawin: alasan mendesak (kehamilan)
  "eratHubungan", // dispensasi kawin: hubungan sudah sangat erat
  "sebabTidakTercatat", // itsbat nikah: sebab pernikahan tidak tercatat
  "tujuan", // itsbat / perwalian / ahli waris: keperluan permohonan
]);
const SEBAB = new Set(KUNCI_SEBAB_DALIL);
const JENIS_CERAI = new Set(["cg", "ct"]);

const KET_SARAN = "Saran dari posita: sebab/alasan ini baru didalilkan dan belum dikuatkan saksi - sesuaikan dengan keterangan saksi yang sesungguhnya.";

/** Fakta yang hanya bersumber gugatan/posita (bukan isian blangko atau data SIPP). */
function hanyaDariPosita(f) {
  const s = String((f && f.sumber) || "")
    .split(" + ")
    .map((x) => x.trim())
    .filter(Boolean);
  return s.length > 0 && s.every((x) => x === "gugatan");
}

/** Kunci sebab dalil yang dipakai `pakai` dan hanya bersumber posita. Perceraian selalu []. */
function sebabBelumDikuatkan(pakai, jenis) {
  if (JENIS_CERAI.has(String(jenis || ""))) return [];
  const hasil = [];
  for (const f of Array.isArray(pakai) ? pakai : []) {
    const k = String((f && f.kunci) || "");
    if (SEBAB.has(k) && hanyaDariPosita(f) && !hasil.includes(k)) hasil.push(k);
  }
  return hasil;
}

/**
 * Menandai satu hasil isian {teks, yakin, sumber, ket} sebagai saran bila memakai sebab dalil yang belum dikuatkan.
 * Mengembalikan objek BARU; masukan tidak diubah.
 */
function tandaiSaran(hasil, pakai, jenis) {
  if (!hasil || typeof hasil !== "object") return hasil;
  const kunci = sebabBelumDikuatkan(pakai, jenis);
  if (!kunci.length) return hasil;
  const ket = String(hasil.ket || "");
  return { ...hasil, yakin: "ragu", saran: kunci, ket: ket.includes(KET_SARAN) ? ket : `${KET_SARAN} ${ket}`.trim() };
}

/**
 * Sebutan pihak pertama/kedua untuk pengisi jawaban. Yang dikirim ekstensi (#0046#/#0047#) dipakai bila ada; yang
 * kosong diturunkan dari alur/jenis_perkara_id (sebutanPihakService) - bukan "Pemohon" bawaan.
 * @param {{lawan?: string, pelaku?: string, alur?: string|number, jenisPerkara?: string|number, nomorPerkara?: string}} k
 * @returns {{P: string, T: string, sumber: string}}
 */
function sebutanUntuk(k) {
  const o = k && typeof k === "object" ? k : {};
  const lawan = String(o.lawan || "").trim();
  const pelaku = String(o.pelaku || "").trim();
  if (lawan && pelaku) return { P: lawan, T: pelaku, sumber: "variabel" };
  const jenis = String(o.jenisPerkara === undefined || o.jenisPerkara === null ? "" : o.jenisPerkara).trim();
  const angka = /^\d+$/.test(jenis);
  const s = sebutanPihak.sebutanPihakPerkara({
    alurPerkaraId: o.alur,
    jenisPerkaraId: angka ? jenis : null,
    jenisPerkaraNama: angka ? null : jenis,
    nomorPerkara: o.nomorPerkara,
  });
  return { P: lawan || s.satu, T: pelaku || s.dua, sumber: s.sumber };
}

module.exports = { KUNCI_SEBAB_DALIL, KET_SARAN, hanyaDariPosita, sebabBelumDikuatkan, tandaiSaran, sebutanUntuk };
