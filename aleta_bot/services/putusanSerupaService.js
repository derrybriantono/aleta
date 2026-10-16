"use strict";

/**
 * ============================================================================
 * PUTUSAN SERUPA MILIK HAKIM YANG SAMA (17 Okt 2026, F4.4 Putusan Advance)
 * ============================================================================
 *
 * Bahan pembanding untuk portal (manajemen_surat/src/lib/putusan-advance.ts):
 * putusan yang SUDAH BERKEKUATAN HUKUM TETAP (perkara_putusan.tanggal_bht
 * terisi), jenis perkara sama, dengan Hakim Ketua/Hakim Tunggal yang sama
 * dengan majelis perkara yang sedang disusun - "pustaka putusan hakim
 * sendiri". SELECT saja; tidak ada yang ditulis.
 *
 *   perkara                      nomor, jenis_perkara_id
 *   perkara_hakim_pn             jabatan 1 (Hakim Ketua) / 3 (Hakim Tunggal), aktif
 *   perkara_putusan              tanggal_putusan, tanggal_bht, amar_putusan
 *   perkara_pertimbangan_hukum   pertimbangan_hukum (HTML SIPP)
 *   perkara_pihak1..5            nama - HANYA untuk disamarkan di portal; portal
 *                                tidak pernah meneruskannya ke peramban
 *
 * Ukur (sipp_donggala setempat, 17 Okt): 2.305 putusan berpertimbangan, 2.257
 * BHT; 1.102 dari 1.593 putusan cerai punya >= 3 pembanding huruf sama.
 */

const db = require("../db_config");

let kueriAktif = (sql, nilai = []) =>
  new Promise((selesai, gagal) => {
    db.query(sql, nilai, (galat, hasil) => (galat ? gagal(galat) : selesai(Array.isArray(hasil) ? hasil : [])));
  });

/** Untuk uji: ganti pelaksana kueri. */
function _aturKueri(fn) {
  kueriAktif = fn;
}

function bersih(nilai) {
  return String(nilai === null || nilai === undefined ? "" : nilai).replace(/\s+/g, " ").trim();
}

function tanggalIso(nilai) {
  if (!nilai) return "";
  if (nilai instanceof Date) {
    if (Number.isNaN(nilai.getTime())) return "";
    return `${nilai.getFullYear()}-${String(nilai.getMonth() + 1).padStart(2, "0")}-${String(nilai.getDate()).padStart(2, "0")}`;
  }
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(nilai).trim());
  return m && `${m[1]}-${m[2]}-${m[3]}` > "1900-01-01" ? `${m[1]}-${m[2]}-${m[3]}` : "";
}

const NOMOR_PERKARA = /^\d{1,5}\/[A-Za-z]{1,10}(?:\.[A-Za-z]{1,4}){0,2}\/\d{4}\/[A-Za-z]{2,4}\.[A-Za-z]{2,6}\.?$/;
/** Pertimbangan per putusan rata-rata ±10 KB; 30 cukup untuk 10 pembanding huruf sama. */
const BATAS_BAWAAN = 30;

/**
 * @param {string} nomorPerkara nomor perkara yang sedang disusun putusannya
 * @param {{ batas?: number }} [opsi]
 */
async function putusanSerupa(nomorPerkara, opsi = {}) {
  const nomor = bersih(nomorPerkara).replace(/\.$/, "");
  if (!NOMOR_PERKARA.test(nomor)) return { ok: false, alasan: "nomor_perkara_tidak_sah" };
  const batas = Math.max(1, Math.min(60, Number(opsi.batas) || BATAS_BAWAAN));

  let perkara;
  try {
    perkara = (
      await kueriAktif(
        `SELECT perkara_id, nomor_perkara, jenis_perkara_id, jenis_perkara_nama
           FROM perkara WHERE nomor_perkara IN (?, ?) LIMIT 1`,
        [nomor, `${nomor}.`]
      )
    )[0];
  } catch (e) {
    return { ok: false, alasan: "gagal_membaca_sipp", pesan: String((e && e.message) || e).slice(0, 200) };
  }
  if (!perkara) return { ok: false, alasan: "perkara_tidak_ditemukan" };

  const ketua = (
    await kueriAktif(
      `SELECT hakim_id, hakim_nama FROM perkara_hakim_pn
        WHERE perkara_id = ? AND jabatan_hakim_id IN (1, 3)
        ORDER BY (aktif = 'Y') DESC, id DESC LIMIT 1`,
      [perkara.perkara_id]
    )
  )[0];
  const dasar = { ok: true, perkara: { nomor: bersih(perkara.nomor_perkara), jenis: bersih(perkara.jenis_perkara_nama) } };
  if (!ketua) return { ...dasar, hakim: null, kandidat: [], sebab: "majelis_belum_ditetapkan" };

  const baris = await kueriAktif(
    `SELECT p.perkara_id, p.nomor_perkara, pu.tanggal_putusan, pu.tanggal_bht, pu.putusan_verstek,
            pu.amar_putusan, ph.pertimbangan_hukum
       FROM perkara p
       JOIN perkara_putusan pu ON pu.perkara_id = p.perkara_id
       JOIN perkara_pertimbangan_hukum ph ON ph.perkara_id = p.perkara_id
      WHERE p.jenis_perkara_id = ?
        AND p.perkara_id <> ?
        AND pu.tanggal_bht IS NOT NULL
        AND LENGTH(ph.pertimbangan_hukum) > 300
        AND EXISTS (SELECT 1 FROM perkara_hakim_pn h
                     WHERE h.perkara_id = p.perkara_id AND h.hakim_id = ?
                       AND h.jabatan_hakim_id IN (1, 3) AND h.aktif = 'Y')
      ORDER BY pu.tanggal_putusan DESC, p.perkara_id DESC
      LIMIT ${batas}`,
    [perkara.jenis_perkara_id, perkara.perkara_id, ketua.hakim_id]
  );

  const id = baris.map((b) => b.perkara_id);
  const nama = new Map(id.map((x) => [x, []]));
  if (id.length) {
    const cabang = [1, 2, 3, 4, 5].map((ke) => `SELECT perkara_id, nama FROM perkara_pihak${ke} WHERE perkara_id IN (?)`).join(" UNION ALL ");
    try {
      for (const r of await kueriAktif(cabang, [id, id, id, id, id])) {
        const n = bersih(r.nama);
        if (n && nama.has(r.perkara_id)) nama.get(r.perkara_id).push(n);
      }
    } catch {
      // Tanpa daftar nama, portal tetap menyamarkan nasab (bin/binti) dan menolak alinea yang masih bernama.
    }
  }

  return {
    ...dasar,
    hakim: { nama: bersih(ketua.hakim_nama) },
    kandidat: baris.map((b) => ({
      nomor: bersih(b.nomor_perkara),
      tanggalPutusan: tanggalIso(b.tanggal_putusan),
      tanggalBht: tanggalIso(b.tanggal_bht),
      verstek: String(b.putusan_verstek || "").toUpperCase() === "Y",
      pertimbangan: String(b.pertimbangan_hukum || ""),
      amar: String(b.amar_putusan || ""),
      nama: nama.get(b.perkara_id) || [],
    })),
  };
}

module.exports = { putusanSerupa, _aturKueri };
