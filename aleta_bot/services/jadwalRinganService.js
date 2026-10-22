"use strict";

/**
 * ============================================================================
 * JADWAL SIDANG RINGAN - HANYA KOLOM YANG BERUBAH SEPANJANG HARI (22 Okt 2026)
 * ============================================================================
 *
 * Keluhan pengguna: sidang yang sudah DITUNDA atau sudah diberi keterangan
 * PUTUS di SIPP baru tampil di Jadwal Sidang ALETA lama sesudahnya. Terukur di
 * server (22 Okt 2026, 25 sidang hari itu): jadwal penuh 216-277 ms dan 83-96
 * KB (sekitar 40 kueri SIPP), dan satu-satunya jalur yang membawa tunda/putus
 * adalah muat ulang penuh tiap 45 detik - paling lama 45 dtk + 4 dtk singgahan
 * portal + 0,3 dtk, dan tab yang baru kembali terlihat menunggu putaran
 * berikutnya. Menyingkat putaran penuh berarti melipatgandakan 40 kueri; yang
 * perlu dipercepat hanya kolom yang memang berubah.
 *
 * Bacaan ini EMPAT kueri berindeks untuk SELURUH daftar sidang satu rentang
 * (bukan per baris), tanpa view (v_pihak_perkara lambat dan tidak stabil):
 *
 *   1. perkara_jadwal_sidang j JOIN perkara p (kunci utama) pada rentang
 *      tanggal (indeks tanggal_sidang): ditunda, hasil/alasan, kehadiran, ...
 *   2. perkara_putusan WHERE perkara_id IN (...)        - tanggal putusan
 *   3. perkara_jadwal_sidang WHERE perkara_id IN (...)  - sidang berikutnya
 *   4. perkara_ikrar_talak WHERE perkara_id IN (...)    - ikrar tercatat
 *
 * Kueri 2-4 DIPINJAM dari sippJadwalSidangService (putusanBanyakPerkara,
 * sidangBerikutnya, ikrarBanyakPerkara): aturannya satu, supaya jalur ringan
 * dan jalur penuh tidak berselisih untuk perkara yang sama. Hasil putus yang
 * diketik di kolom keterangan dibaca lewat aturan bersama hasilSidangKolom
 * (sqlAlasanHasil) - sama dengan jadwal penuh.
 *
 * Tidak menyentuh relaas/panggilan (aturan retur ada di returRelaas.js dan
 * tetap diperbarui oleh jadwal penuh), pihak, majelis, mediasi, atau e-Court.
 *
 * HANYA SELECT. Rentang tanggal dan id selalu parameter.
 */

const db = require("../db_config");
const { sqlAlasanHasil } = require("./hasilSidangKolom");
const jadwal = require("./sippJadwalSidangService");

/** Paling banyak baris jadwal yang dibaca satu kali (jadwal penuh membatasi 500). */
const BATAS_BARIS = 500;

function runQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (galat, rows) => {
      if (galat) reject(galat);
      else resolve(Array.isArray(rows) ? rows : []);
    });
  });
}

function teks(nilai) {
  return nilai === null || nilai === undefined ? "" : String(nilai).trim();
}

function tanggalHariIni() {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
}

function tanggalSah(nilai) {
  const t = teks(nilai);
  return /^\d{4}-\d{2}-\d{2}$/.test(t) ? t : "";
}

function isoTanggal(nilai) {
  if (!nilai) return "";
  if (nilai instanceof Date) {
    return `${nilai.getFullYear()}-${String(nilai.getMonth() + 1).padStart(2, "0")}-${String(nilai.getDate()).padStart(2, "0")}`;
  }
  return teks(nilai).slice(0, 10);
}

function jamRingkas(nilai) {
  return teks(nilai).slice(0, 5);
}

const SQL_JADWAL = `
  SELECT j.id                AS sidangId,
         j.perkara_id        AS perkaraId,
         j.tanggal_sidang    AS tanggalSidang,
         j.jam_sidang        AS jamSidang,
         j.agenda            AS agenda,
         j.ruangan           AS ruangan,
         j.ditunda           AS ditunda,
         j.ikrar_talak       AS ikrarTalak,
         j.sidang_keliling   AS sidangKeliling,
         j.urutan            AS urutanSidang,
         j.dihadiri_oleh     AS dihadiriOleh,
         CASE WHEN j.edoc_bas IS NOT NULL AND TRIM(j.edoc_bas) <> '' THEN 1 ELSE 0 END AS adaBas,
         ${sqlAlasanHasil("j")} AS alasanDitunda
    FROM perkara_jadwal_sidang j
    JOIN perkara p ON p.perkara_id = j.perkara_id
   WHERE j.tanggal_sidang BETWEEN ? AND ?
   ORDER BY j.id ASC
   LIMIT ?`;

/**
 * Baris ringan satu rentang. `terbaca` per kelompok: kelompok yang gagal
 * dibaca TIDAK dikirim sebagai nilai kosong (kosong bukan "tidak ada putusan"),
 * portal lalu membiarkan nilai lamanya.
 *
 * @returns {Promise<{ok: boolean, dari: string, sampai: string, diperiksaPada: string, baris: object[], terbaca: object, penuh: boolean}>}
 */
async function jadwalRingan({ dari = "", sampai = "" } = {}, deps = {}) {
  const kueri = deps.kueri || runQuery;
  const putusanBanyak = deps.putusanBanyakPerkara || jadwal.putusanBanyakPerkara;
  const berikutnya = deps.sidangBerikutnya || jadwal.sidangBerikutnya;
  const ikrarBanyak = deps.ikrarBanyakPerkara || jadwal.ikrarBanyakPerkara;

  const mulai = tanggalSah(dari) || tanggalHariIni();
  const akhir = tanggalSah(sampai) || mulai;
  const rows = await kueri(SQL_JADWAL, [mulai, akhir, BATAS_BARIS]);
  const idPerkara = [...new Set(rows.map((r) => r.perkaraId))];

  const terbaca = { putusan: true, berikutnya: true, ikrar: true };
  const aman = async (nama, kerja, kosong) => {
    try {
      const hasil = await kerja();
      if (hasil === null) {
        terbaca[nama] = false;
        return kosong;
      }
      return hasil;
    } catch {
      terbaca[nama] = false;
      return kosong;
    }
  };

  // Tiga kueri berindeks berjalan bersamaan; gagal sendiri-sendiri.
  const [petaPutusan, petaBerikut, petaIkrar] = await Promise.all([
    aman("putusan", () => putusanBanyak(idPerkara), {}),
    aman("berikutnya", () => berikutnya(rows.map((r) => ({ sidangId: r.sidangId, perkaraId: r.perkaraId }))), {}),
    aman("ikrar", () => ikrarBanyak(idPerkara), {}),
  ]);

  const baris = rows.map((r) => {
    const perkaraId = String(r.perkaraId);
    const sidangId = String(r.sidangId);
    const tanggalSidang = isoTanggal(r.tanggalSidang);
    const putusan = petaPutusan[perkaraId] || {};
    const satu = {
      sidangId,
      perkaraId,
      tanggalSidang,
      jamSidang: jamRingkas(r.jamSidang),
      agenda: teks(r.agenda),
      ruangan: teks(r.ruangan),
      // Sama dengan daftarSidang: SIPP menyimpan 'Y' bila ditunda.
      ditunda: teks(r.ditunda).toUpperCase() === "Y",
      alasanDitunda: teks(r.alasanDitunda),
      sidangIkrarTalak: teks(r.ikrarTalak).toUpperCase() === "Y",
      sidangKeliling: teks(r.sidangKeliling).toUpperCase() === "Y",
      urutanSidang: Number(r.urutanSidang) || 0,
      dihadiriOleh: r.dihadiriOleh === null || r.dihadiriOleh === undefined ? null : Number(r.dihadiriOleh),
      adaBas: Number(r.adaBas) === 1,
    };
    if (terbaca.berikutnya) satu.tanggalSidangBerikut = petaBerikut[sidangId] || "";
    if (terbaca.ikrar) satu.ikrarTercatat = Boolean(petaIkrar[perkaraId]) && petaIkrar[perkaraId] === tanggalSidang;
    if (terbaca.putusan) {
      satu.sudahPutus = Boolean(putusan.tanggalPutusan);
      satu.tanggalPutusan = putusan.tanggalPutusan || "";
      satu.statusPutusan = putusan.statusPutusan || "";
      satu.tanggalMinutasi = putusan.tanggalMinutasi || "";
      satu.tanggalBht = putusan.tanggalBht || "";
      satu.verstekPutusan = Boolean(putusan.verstek);
      satu.adaBerkasPutusan = Boolean(putusan.adaBerkasPutusan);
    }
    return satu;
  });

  return {
    ok: true,
    dari: mulai,
    sampai: akhir,
    diperiksaPada: new Date().toISOString(),
    baris,
    terbaca,
    // true bila pembacaan terpotong batas: portal tidak boleh menyimpulkan baris hilang/baru.
    terpotong: rows.length >= BATAS_BARIS,
  };
}

module.exports = { jadwalRingan, SQL_JADWAL, BATAS_BARIS };
