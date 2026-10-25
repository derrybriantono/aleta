"use strict";

/**
 * Cermin Perkara (C0, 25 Okt 2026) - SISI BOT: membaca SIPP untuk portal.
 *
 * ============================================================================
 * HANYA MEMBACA - SIPP/ABT TIDAK PERNAH DITULIS DARI SINI
 * ============================================================================
 *
 * Berkas ini hanya berisi SELECT. Tidak ada INSERT/UPDATE/DELETE, tidak ada
 * trigger, tidak ada ubahan skema, dan tidak ada tulisan ke basis data mana
 * pun: cermin disimpan portal di basis data ALETA (Postgres); bot hanya
 * menyodorkan bahannya. Penjaganya: src/test/cermin-dasar-25okt.test.ts
 * memeriksa bahwa setiap kueri yang dijalankan berawalan SELECT.
 *
 * Kueri: berindeks (perkara_id = kunci utama/indeks perkara_id, tanggal_sidang
 * berindeks), berkelompok (paling banyak 500 perkara atau satu jendela tanggal
 * per panggilan), dan tanpa view lambat (v_pihak_perkara tidak dipakai).
 * Portal yang mengatur jeda antar kelompok dan jam kerjanya (malam hari).
 *
 * Bentuk baris jadwal sidang SENGAJA tidak disusun ulang di sini: `baris`
 * adalah keluaran sippJadwalSidangService.daftarSidang apa adanya (satu-satunya
 * sumber bentuknya), supaya isi layar dari cermin = isi dari jalur lama.
 */

const db = require("../db_config");
const sippJadwalSidangService = require("./sippJadwalSidangService");

/** Batas kelompok perkara per panggilan dan baris sidang per jendela. */
const BATAS_PERKARA = 500;
const BATAS_SIDANG = 500;

function runQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (error, rows) => {
      if (error) reject(error);
      else resolve(Array.isArray(rows) ? rows : []);
    });
  });
}

function dua(angka) {
  return String(angka).padStart(2, "0");
}

/** Tanggal MySQL -> 'YYYY-MM-DD' tanpa pergeseran zona; kosong untuk 0000-00-00. */
function tanggalIso(nilai) {
  if (!nilai) return "";
  if (nilai instanceof Date) {
    if (Number.isNaN(nilai.getTime())) return "";
    return `${nilai.getFullYear()}-${dua(nilai.getMonth() + 1)}-${dua(nilai.getDate())}`;
  }
  const teks = String(nilai).trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(teks) && teks !== "0000-00-00" ? teks : "";
}

/** DATETIME MySQL -> 'YYYY-MM-DD HH:MM:SS'; kosong untuk nol/rusak. */
function waktuIso(nilai) {
  if (!nilai) return "";
  if (nilai instanceof Date) {
    if (Number.isNaN(nilai.getTime())) return "";
    return `${tanggalIso(nilai)} ${dua(nilai.getHours())}:${dua(nilai.getMinutes())}:${dua(nilai.getSeconds())}`;
  }
  const teks = String(nilai).trim().slice(0, 19);
  return /^\d{4}-\d{2}-\d{2}/.test(teks) && !teks.startsWith("0000") ? teks : "";
}

/** Yang terbaru dari beberapa waktu (teks ISO sama panjang -> urut leksikografis). */
function terbaru(...waktu) {
  return waktu.map(waktuIso).filter(Boolean).sort().pop() || "";
}

function tanggalHariIni() {
  const k = new Date();
  return `${k.getFullYear()}-${dua(k.getMonth() + 1)}-${dua(k.getDate())}`;
}

function idSah(daftar) {
  return [...new Set((daftar || []).map((x) => Number(x)).filter((x) => Number.isFinite(x) && x > 0))];
}

/**
 * Ukuran sumber: jumlah/rentang perkara dan rentang tanggal sidang. Murah
 * (indeks kunci utama dan tanggal_sidang); dasar kemajuan pemindai awal.
 */
async function ringkasanSumber() {
  const [perkara, sidang] = await Promise.all([
    runQuery("SELECT COUNT(*) AS jumlah, MIN(perkara_id) AS terkecil, MAX(perkara_id) AS terbesar FROM perkara"),
    runQuery("SELECT COUNT(*) AS jumlah, MIN(tanggal_sidang) AS awal, MAX(tanggal_sidang) AS akhir FROM perkara_jadwal_sidang"),
  ]);
  const p = perkara[0] || {};
  const s = sidang[0] || {};
  return {
    perkara: {
      jumlah: Number(p.jumlah) || 0,
      terkecil: Number(p.terkecil) || 0,
      terbesar: Number(p.terbesar) || 0,
    },
    sidang: {
      jumlah: Number(s.jumlah) || 0,
      awal: tanggalIso(s.awal),
      akhir: tanggalIso(s.akhir),
    },
    hariIni: tanggalHariIni(),
  };
}

/**
 * Satu kelompok perkara: perkara_id > setelahId, urut naik, paling banyak
 * `batas`. Ringkasan identitas, pelaksana, sidang, dan akhir perkara per
 * perkara. Kueri bantu semuanya `perkara_id IN (...)` atas kelompok itu.
 */
async function kelompokPerkara({ setelahId = 0, batas = 300 } = {}) {
  const awal = Math.max(0, Number(setelahId) || 0);
  const jumlah = Math.min(Math.max(Number(batas) || 300, 1), BATAS_PERKARA);
  const hariIni = tanggalHariIni();

  const dasar = await runQuery(
    `SELECT perkara_id AS perkaraId, nomor_perkara AS nomorPerkara,
            jenis_perkara_id AS jenisPerkaraId, jenis_perkara_nama AS jenisPerkaraNama,
            alur_perkara_id AS alurPerkaraId, tanggal_pendaftaran AS tanggalPendaftaran,
            prodeo AS prodeo,
            tahapan_terakhir_id AS tahapanTerakhirId, tahapan_terakhir_text AS tahapanTerakhirText,
            proses_terakhir_id AS prosesTerakhirId, proses_terakhir_text AS prosesTerakhirText,
            diinput_tanggal AS diinput, diperbaharui_tanggal AS diperbaharui, diedit_tanggal AS diedit
       FROM perkara
      WHERE perkara_id > ?
      ORDER BY perkara_id ASC
      LIMIT ?`,
    [awal, jumlah]
  );
  if (dasar.length === 0) return { perkara: [], terakhirId: awal, habis: true };

  const id = idSah(dasar.map((r) => r.perkaraId));
  const [penetapan, putusan, sidang] = await Promise.all([
    runQuery(
      `SELECT perkara_id AS perkaraId, majelis_hakim_text AS majelis,
              panitera_pengganti_text AS panitera, jurusita_text AS jurusita,
              sidang_pertama AS sidangPertama,
              diinput_tanggal AS diinput, diperbaharui_tanggal AS diperbaharui, diedit_tanggal AS diedit
         FROM perkara_penetapan
        WHERE perkara_id IN (?)`,
      [id]
    ),
    runQuery(
      `SELECT perkara_id AS perkaraId, tanggal_putusan AS tanggalPutusan,
              status_putusan_nama AS statusNama, putusan_verstek AS verstek,
              tanggal_minutasi AS tanggalMinutasi, tanggal_bht AS tanggalBht,
              diinput_tanggal AS diinput, diperbaharui_tanggal AS diperbaharui, diedit_tanggal AS diedit
         FROM perkara_putusan
        WHERE perkara_id IN (?)
        ORDER BY perkara_id ASC, tanggal_putusan ASC`,
      [id]
    ),
    runQuery(
      `SELECT perkara_id AS perkaraId, COUNT(*) AS jumlah,
              MAX(CASE WHEN tanggal_sidang <= ? THEN tanggal_sidang END) AS terakhir,
              MIN(CASE WHEN tanggal_sidang > ? THEN tanggal_sidang END) AS berikut,
              MAX(diinput_tanggal) AS diinput, MAX(diperbaharui_tanggal) AS diperbaharui,
              MAX(diedit_tanggal) AS diedit
         FROM perkara_jadwal_sidang
        WHERE perkara_id IN (?)
        GROUP BY perkara_id`,
      [hariIni, hariIni, id]
    ),
  ]);

  const petaPenetapan = new Map(penetapan.map((r) => [String(r.perkaraId), r]));
  // Beberapa baris putusan per perkara bisa ada (kunci utama: perkara_id +
  // tanggal_putusan); yang dipakai yang TERAKHIR (urut naik -> timpa).
  const petaPutusan = new Map();
  for (const r of putusan) petaPutusan.set(String(r.perkaraId), r);
  const petaSidang = new Map(sidang.map((r) => [String(r.perkaraId), r]));

  const perkara = dasar.map((r) => {
    const kunci = String(r.perkaraId);
    const t = petaPenetapan.get(kunci) || {};
    const p = petaPutusan.get(kunci) || {};
    const s = petaSidang.get(kunci) || {};
    return {
      perkaraId: kunci,
      nomorPerkara: String(r.nomorPerkara || ""),
      jenisPerkaraId: r.jenisPerkaraId === null || r.jenisPerkaraId === undefined ? null : Number(r.jenisPerkaraId),
      jenisPerkaraNama: String(r.jenisPerkaraNama || ""),
      alurPerkaraId: r.alurPerkaraId === null || r.alurPerkaraId === undefined ? null : Number(r.alurPerkaraId),
      tanggalPendaftaran: tanggalIso(r.tanggalPendaftaran),
      prodeo: Number(r.prodeo) === 1 ? 1 : 0,
      tahapanTerakhirId: r.tahapanTerakhirId === null || r.tahapanTerakhirId === undefined ? null : Number(r.tahapanTerakhirId),
      tahapanTerakhirText: String(r.tahapanTerakhirText || ""),
      prosesTerakhirId: r.prosesTerakhirId === null || r.prosesTerakhirId === undefined ? null : Number(r.prosesTerakhirId),
      prosesTerakhirText: String(r.prosesTerakhirText || ""),
      majelisHakim: String(t.majelis || "").trim(),
      paniteraPengganti: String(t.panitera || "").trim(),
      jurusita: String(t.jurusita || "").trim(),
      sidangPertama: tanggalIso(t.sidangPertama),
      sidangTerakhir: tanggalIso(s.terakhir),
      sidangBerikut: tanggalIso(s.berikut),
      jumlahSidang: Number(s.jumlah) || 0,
      tanggalPutusan: tanggalIso(p.tanggalPutusan),
      statusPutusan: String(p.statusNama || "").trim(),
      putusanVerstek: String(p.verstek || "").toUpperCase() === "Y" || Number(p.verstek) === 1 ? 1 : 0,
      tanggalMinutasi: tanggalIso(p.tanggalMinutasi),
      tanggalBht: tanggalIso(p.tanggalBht),
      sippDiperbarui: terbaru(
        r.diinput, r.diperbaharui, r.diedit,
        t.diinput, t.diperbaharui, t.diedit,
        p.diinput, p.diperbaharui, p.diedit,
        s.diinput, s.diperbaharui, s.diedit
      ),
    };
  });

  const terakhirId = Number(dasar[dasar.length - 1].perkaraId) || awal;
  return { perkara, terakhirId, habis: dasar.length < jumlah };
}

/**
 * Sidang pada satu jendela tanggal [dari, sampai]. `baris` = keluaran
 * daftarSidang apa adanya. `terpotong` true bila jumlah baris mencapai batas:
 * pemanggil mengecilkan jendela dan mengulang (tidak ada baris yang hilang
 * diam-diam).
 */
async function sidangJendela({ dari, sampai } = {}) {
  const hasil = await sippJadwalSidangService.daftarSidang({ dari, sampai, cari: "", batas: BATAS_SIDANG });
  const daftar = Array.isArray(hasil && hasil.sidang) ? hasil.sidang : [];
  const id = idSah(daftar.map((b) => b.sidangId));
  const waktu = new Map();
  for (let i = 0; i < id.length; i += 500) {
    const bagian = id.slice(i, i + 500);
    const rows = await runQuery(
      `SELECT id, diinput_tanggal AS diinput, diperbaharui_tanggal AS diperbaharui, diedit_tanggal AS diedit
         FROM perkara_jadwal_sidang
        WHERE id IN (?)`,
      [bagian]
    );
    for (const r of rows) waktu.set(String(r.id), terbaru(r.diinput, r.diperbaharui, r.diedit));
  }
  return {
    dari: String((hasil && hasil.dari) || dari || ""),
    sampai: String((hasil && hasil.sampai) || sampai || ""),
    terpotong: daftar.length >= BATAS_SIDANG,
    sidang: daftar.map((b) => ({
      sidangId: String(b.sidangId),
      perkaraId: String(b.perkaraId),
      tanggalSidang: tanggalIso(b.tanggalSidang),
      jamSidang: String(b.jamSidang || "").slice(0, 8),
      ruangan: String(b.ruangan || ""),
      agenda: String(b.agenda || ""),
      ditunda: b.ditunda === true || Number(b.ditunda) === 1 || String(b.ditunda || "").toUpperCase() === "Y" ? 1 : 0,
      sippDiperbarui: waktu.get(String(b.sidangId)) || "",
      baris: b,
    })),
  };
}

module.exports = {
  BATAS_PERKARA,
  BATAS_SIDANG,
  ringkasanSumber,
  kelompokPerkara,
  sidangJendela,
  // Untuk uji.
  _tanggalIso: tanggalIso,
  _waktuIso: waktuIso,
  _terbaru: terbaru,
};
