"use strict";

/**
 * Cermin Perkara (C0, 25 Okt 2026) - SISI BOT, bagian PEMBARUAN dan PENCOCOKAN.
 *
 * ============================================================================
 * HANYA MEMBACA - SIPP/ABT TIDAK PERNAH DITULIS DARI SINI
 * ============================================================================
 *
 * Seperti cerminService.js, berkas ini hanya berisi SELECT. Penjaganya:
 * src/test/cermin-pembaruan-25okt.test.ts memeriksa teksnya dan menjalankan
 * layanan ini atas basis data tiruan yang menolak apa pun selain SELECT.
 *
 * ----------------------------------------------------------------------------
 * PEMBARUAN BERKALA (tiap menit) - perubahanSejak
 * ----------------------------------------------------------------------------
 * SIPP mengisi diinput_tanggal / diperbaharui_tanggal (dan sebagian diedit_tanggal)
 * pada baris yang disimpan. Portal menanyakan "perkara mana yang tersentuh sejak
 * T" dan hanya itu yang dihitung ulang. Per tabel:
 *
 *   * Tabel kecil-menengah (perkara, jadwal sidang, penetapan, putusan, pihak 1-4,
 *     mediasi, petugas, data pernikahan; <= ±30 ribu baris): kolom waktunya
 *     dibandingkan langsung. perkara punya indeks pada diinput/diperbaharui;
 *     sisanya pemindaian tabel kecil sekali semenit (puluhan ms).
 *   * Tabel besar (perkara_biaya, perkara_proses; >100 ribu baris): TIDAK dipindai
 *     menurut kolom waktu pembaruan (tanpa indeks); dibaca lewat kolom tanggal
 *     transaksi/proses yang BERINDEKS, hanya sejak tanggal T. Perubahan baris lama
 *     di tabel besar ditangkap perkara.diperbaharui_tanggal bila SIPP
 *     menyentuhnya, selebihnya oleh pencocokan mingguan.
 *   * Tabel yang tidak ada / kolomnya beda di satker lain: dilewati dan dicatat
 *     (tidakTerbaca), tidak menjatuhkan pembaruan.
 *
 * ----------------------------------------------------------------------------
 * PENCOCOKAN MINGGUAN - idPerkara / idSidang
 * ----------------------------------------------------------------------------
 * Daftar ringan (id + waktu terakhir) untuk menemukan yang DIHAPUS di SIPP
 * (penghapusan tidak terlihat dari kolom waktu), baris tabel tanpa kolom waktu,
 * dan selisih lain. Portal yang membandingkan dan memperbaiki cermin.
 */

const db = require("../db_config");

const BATAS_ID = 500;

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

function tanggalIso(nilai) {
  if (!nilai) return "";
  if (nilai instanceof Date) {
    if (Number.isNaN(nilai.getTime())) return "";
    return `${nilai.getFullYear()}-${dua(nilai.getMonth() + 1)}-${dua(nilai.getDate())}`;
  }
  const teks = String(nilai).trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(teks) && teks !== "0000-00-00" ? teks : "";
}

function waktuIso(nilai) {
  if (!nilai) return "";
  if (nilai instanceof Date) {
    if (Number.isNaN(nilai.getTime())) return "";
    return `${tanggalIso(nilai)} ${dua(nilai.getHours())}:${dua(nilai.getMinutes())}:${dua(nilai.getSeconds())}`;
  }
  const teks = String(nilai).trim().slice(0, 19);
  return /^\d{4}-\d{2}-\d{2}/.test(teks) && !teks.startsWith("0000") ? teks : "";
}

const WAKTU_NOL = "1000-01-01 00:00:00";

/** Yang terbaru dari beberapa waktu (teks ISO sama panjang -> urut leksikografis). */
function terbaru(...waktu) {
  return waktu.map(waktuIso).filter(Boolean).sort().pop() || "";
}

function tanggalHariIni() {
  const k = new Date();
  return `${k.getFullYear()}-${dua(k.getMonth() + 1)}-${dua(k.getDate())}`;
}

/** Waktu SIPP sah ('YYYY-MM-DD HH:MM:SS') atau kosong. */
function waktuParam(nilai) {
  const teks = String(nilai || "").trim();
  return /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}$/.test(teks) ? teks.replace("T", " ") : "";
}

/**
 * Tabel yang dipantau menurut kolom waktu. `kolom` = kolom waktu yang ada pada
 * SIPP PA (diukur di salinan Donggala). Satu ekspresi GREATEST per baris.
 */
const TABEL_WAKTU = [
  { tabel: "perkara", id: "perkara_id", kolom: ["diinput_tanggal", "diperbaharui_tanggal", "diedit_tanggal"] },
  { tabel: "perkara_jadwal_sidang", id: "perkara_id", kolom: ["diinput_tanggal", "diperbaharui_tanggal", "diedit_tanggal"], sidang: true },
  { tabel: "perkara_penetapan", id: "perkara_id", kolom: ["diinput_tanggal", "diperbaharui_tanggal", "diedit_tanggal"] },
  { tabel: "perkara_putusan", id: "perkara_id", kolom: ["diinput_tanggal", "diperbaharui_tanggal", "diedit_tanggal"] },
  { tabel: "perkara_pihak1", id: "perkara_id", kolom: ["diinput_tanggal", "diperbaharui_tanggal", "diedit_tanggal"] },
  { tabel: "perkara_pihak2", id: "perkara_id", kolom: ["diinput_tanggal", "diperbaharui_tanggal", "diedit_tanggal"] },
  { tabel: "perkara_pihak3", id: "perkara_id", kolom: ["diinput_tanggal", "diperbaharui_tanggal", "diedit_tanggal"] },
  { tabel: "perkara_pihak4", id: "perkara_id", kolom: ["diinput_tanggal", "diperbaharui_tanggal", "diedit_tanggal"] },
  { tabel: "perkara_mediasi", id: "perkara_id", kolom: ["diinput_tanggal", "diperbaharui_tanggal", "diedit_tanggal"] },
  { tabel: "perkara_hakim_pn", id: "perkara_id", kolom: ["diinput_tanggal", "diperbaharui_tanggal"] },
  { tabel: "perkara_panitera_pn", id: "perkara_id", kolom: ["diinput_tanggal", "diperbaharui_tanggal"] },
  { tabel: "perkara_jurusita", id: "perkara_id", kolom: ["diinput_tanggal", "diperbaharui_tanggal"] },
  { tabel: "perkara_data_pernikahan", id: "perkara_id", kolom: ["diinput_tanggal", "diperbaharui_tanggal", "diedit_tanggal"] },
];

/** Tabel besar: dibaca lewat kolom tanggal BERINDEKS, sejak tanggal T. */
const TABEL_TANGGAL = [
  { tabel: "perkara_biaya", id: "perkara_id", tanggal: "tanggal_transaksi" },
  { tabel: "perkara_proses", id: "perkara_id", tanggal: "tanggal" },
];

function ekspresiTerbaru(kolom) {
  return `GREATEST(${kolom.map((k) => `COALESCE(${k}, '${WAKTU_NOL}')`).join(", ")})`;
}

/**
 * Perkara yang tersentuh sejak `sejak` ('YYYY-MM-DD HH:MM:SS', waktu SIPP).
 * Mengembalikan paling banyak `batas` perkara (yang waktunya paling awal lebih
 * dulu), `tandaBaru` = waktu terakhir yang termuat, dan `terpotong` bila masih
 * ada sisa. Plus tanggal sidang yang perlu dihitung ulang.
 */
async function perubahanSejak({ sejak, batas = BATAS_ID } = {}) {
  const dari = waktuParam(sejak);
  if (!dari) return { ok: false, error: "sejak_tidak_sah", message: "sejak harus 'YYYY-MM-DD HH:MM:SS'." };
  const jumlah = Math.min(Math.max(Number(batas) || BATAS_ID, 1), 2000);
  const hariIni = tanggalHariIni();
  const tanggalDari = dari.slice(0, 10);

  const tidakTerbaca = [];
  /** perkara_id -> waktu tersentuh terbaru */
  const tersentuh = new Map();
  const tanggalLangsung = new Set(); // tanggal sidang baris jadwal yang tersentuh
  const catat = (id, waktu) => {
    const kunci = String(id);
    const lama = tersentuh.get(kunci) || "";
    if (waktu > lama) tersentuh.set(kunci, waktu);
    else if (!tersentuh.has(kunci)) tersentuh.set(kunci, waktu);
  };

  await Promise.all([
    ...TABEL_WAKTU.map(async (t) => {
      try {
        const syarat = t.kolom.map((k) => `${k} >= ?`).join(" OR ");
        const pilihanSidang = t.sidang ? ", tanggal_sidang AS tanggalSidang" : "";
        const rows = await runQuery(
          `SELECT ${t.id} AS perkaraId, ${ekspresiTerbaru(t.kolom)} AS waktu${pilihanSidang}
             FROM ${t.tabel}
            WHERE ${syarat}`,
          t.kolom.map(() => dari)
        );
        for (const r of rows) {
          catat(r.perkaraId, waktuIso(r.waktu) || dari);
          if (t.sidang && r.tanggalSidang) {
            const tgl = tanggalIso(r.tanggalSidang);
            if (tgl) tanggalLangsung.add(tgl);
          }
        }
      } catch (error) {
        tidakTerbaca.push({ tabel: t.tabel, sebab: String((error && error.message) || error).slice(0, 120) });
      }
    }),
    ...TABEL_TANGGAL.map(async (t) => {
      try {
        const rows = await runQuery(`SELECT DISTINCT ${t.id} AS perkaraId FROM ${t.tabel} WHERE ${t.tanggal} >= ?`, [tanggalDari]);
        // Tanpa waktu per baris: diberi waktu T (perkara dihitung ulang, idempoten).
        for (const r of rows) catat(r.perkaraId, dari);
      } catch (error) {
        tidakTerbaca.push({ tabel: t.tabel, sebab: String((error && error.message) || error).slice(0, 120) });
      }
    }),
  ]);

  const urut = [...tersentuh.entries()].sort((a, b) => (a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : Number(a[0]) - Number(b[0])));
  const terpotong = urut.length > jumlah;
  const dipakai = urut.slice(0, jumlah);
  const perkaraId = dipakai.map(([id]) => id);
  // Waktu terakhir yang termuat; bila terpotong, hentikan di waktu baris terakhir
  // (portal mengulang dari situ - baris sewaktu yang sama dibaca ulang, idempoten).
  const tandaBaru = dipakai.length ? dipakai[dipakai.length - 1][1] : dari;

  // Tanggal sidang untuk dihitung ulang: baris jadwal yang tersentuh langsung, plus
  // sidang perkara tersentuh lain dalam [hari ini - 7, hari ini + 60].
  const tanggal = new Set(tanggalLangsung);
  if (perkaraId.length) {
    const idAngka = perkaraId.map(Number).filter((x) => Number.isFinite(x) && x > 0);
    const mulai = tambah(hariIni, -7);
    const akhir = tambah(hariIni, 60);
    for (let i = 0; i < idAngka.length; i += 500) {
      const rows = await runQuery(
        `SELECT DISTINCT tanggal_sidang AS tanggalSidang
           FROM perkara_jadwal_sidang
          WHERE perkara_id IN (?) AND tanggal_sidang BETWEEN ? AND ?`,
        [idAngka.slice(i, i + 500), mulai, akhir]
      );
      for (const r of rows) {
        const tgl = tanggalIso(r.tanggalSidang);
        if (tgl) tanggal.add(tgl);
      }
    }
  }

  return {
    ok: true,
    sejak: dari,
    tandaBaru,
    terpotong,
    jumlahTersentuh: urut.length,
    perkaraId,
    tanggalSidang: [...tanggal].sort(),
    tidakTerbaca,
  };
}

function tambah(tanggal, hari) {
  const [t, b, h] = tanggal.split("-").map(Number);
  const d = new Date(Date.UTC(t, (b || 1) - 1, h || 1));
  d.setUTCDate(d.getUTCDate() + hari);
  return d.toISOString().slice(0, 10);
}

/** Daftar ringan perkara: id + waktu SIPP terbaru (perkara + penetapan + putusan). Untuk pencocokan mingguan. */
async function idPerkara({ setelahId = 0, batas = 2000 } = {}) {
  const awal = Math.max(0, Number(setelahId) || 0);
  const jumlah = Math.min(Math.max(Number(batas) || 2000, 1), 5000);
  const rows = await runQuery(
    `SELECT perkara_id AS perkaraId,
            ${ekspresiTerbaru(["diinput_tanggal", "diperbaharui_tanggal", "diedit_tanggal"])} AS waktu
       FROM perkara
      WHERE perkara_id > ?
      ORDER BY perkara_id ASC
      LIMIT ?`,
    [awal, jumlah]
  );
  return {
    perkara: rows.map((r) => ({ perkaraId: String(r.perkaraId), waktu: waktuIso(r.waktu) })),
    terakhirId: rows.length ? Number(rows[rows.length - 1].perkaraId) || awal : awal,
    habis: rows.length < jumlah,
  };
}

/** Daftar ringan sidang pada satu jendela tanggal: id, perkara, tanggal, waktu SIPP. */
async function idSidang({ dari, sampai } = {}) {
  const rows = await runQuery(
    `SELECT id AS sidangId, perkara_id AS perkaraId, tanggal_sidang AS tanggalSidang,
            ${ekspresiTerbaru(["diinput_tanggal", "diperbaharui_tanggal", "diedit_tanggal"])} AS waktu
       FROM perkara_jadwal_sidang
      WHERE tanggal_sidang BETWEEN ? AND ?
      ORDER BY tanggal_sidang ASC, id ASC`,
    [dari, sampai]
  );
  return {
    dari,
    sampai,
    sidang: rows.map((r) => ({
      sidangId: String(r.sidangId),
      perkaraId: String(r.perkaraId),
      tanggalSidang: tanggalIso(r.tanggalSidang),
      waktu: waktuIso(r.waktu),
    })),
  };
}

module.exports = {
  BATAS_ID,
  TABEL_WAKTU,
  TABEL_TANGGAL,
  perubahanSejak,
  idPerkara,
  idSidang,
  _waktuParam: waktuParam,
  _terbaru: terbaru,
};
