"use strict";

/**
 * ============================================================================
 * OBYEK SENGKETA - KEBIASAAN SATKER, BUKAN PEMBACAAN POSITA
 * ============================================================================
 *
 * Layar Data Umum SIPP menuntut satu kotak "Obyek Sengketa" pada tiap perkara
 * perdata. Isinya bukan kutipan dari posita: pada 1.345 cerai gugat PA
 * Donggala, 895 ditulis "Pernikahan/Perceraian", 273 "Pernikahan /
 * Perceraian", 128 "Pernikahan atau Perceraian" - satu maksud, empat ejaan.
 * Tidak satu pun kalimat di posita menyebut frasa itu.
 *
 * Yang benar-benar menentukan isinya adalah KEBIASAAN SATKER untuk jenis
 * perkara itu. Karena itu yang dipulangkan layanan ini bukan tebakan dari
 * teks melainkan hitungan: untuk jenis perkara yang sama, apa yang selama ini
 * ditulis, dan berapa kali. Yang memutuskan tetap petugas; angka itu hanya
 * memberitahunya apa yang lazim.
 *
 * ============================================================================
 * BACA SAJA, DAN NOMOR PERKARA TIDAK PERNAH DISAMBUNG KE TEKS KUERI
 * ============================================================================
 *
 * Nomor perkara datang dari peramban lewat portal. Ia hanya pernah menjadi
 * PARAMETER kueri, tidak pernah bagian dari teksnya. Ejaan-ejaan obyek
 * dipulangkan apa adanya - penggabungan variannya dikerjakan portal, di
 * tempat yang dapat diuji.
 */

const sippDb = require("../db_config");
const sippSkemaService = require("./sippSkemaService");

/** Batas ejaan yang dipulangkan. Di atas ini hanya sampah pengetikan. */
const BATAS_EJAAN = 80;

function runQuerySipp(sql, params = []) {
  return new Promise((resolve, reject) => {
    sippDb.query(sql, params, (galat, hasil) => {
      if (galat) reject(galat);
      else resolve(Array.isArray(hasil) ? hasil : []);
    });
  });
}

/**
 * Kebiasaan penulisan obyek sengketa untuk jenis perkara yang sama dengan
 * perkara ini.
 *
 * @param {string} nomorPerkara
 * @returns {Promise<{ok: true, perkaraId: number, jenisPerkaraId: number,
 *   jenisPerkara: string, baris: Array<{obyek: string, jumlah: number}>}
 *   | {ok: false, error: string}>}
 */
async function kebiasaan(nomorPerkara) {
  const nomor = String(nomorPerkara || "").trim();
  if (!nomor) return { ok: false, error: "nomor_kosong" };

  // Tabel yang tidak terdaftar di layanan skema dijawab "tidak ada" tanpa
  // galat. Diperiksa di sini supaya SIPP yang belum punya tabelnya menjawab
  // terang, bukan dengan galat MySQL yang tersembunyi di catatan.
  if (!(await sippSkemaService.tabelAda("perkara_obyek_sengketa"))) {
    return { ok: false, error: "tabel_tidak_ada" };
  }

  const perkara = await runQuerySipp(
    `SELECT perkara_id, jenis_perkara_id
       FROM perkara
      WHERE nomor_perkara = ?
      LIMIT 1`,
    [nomor]
  );
  if (perkara.length === 0) return { ok: false, error: "perkara_tidak_ketemu" };

  const perkaraId = Number(perkara[0].perkara_id || 0);
  const jenisPerkaraId = Number(perkara[0].jenis_perkara_id || 0);
  if (!jenisPerkaraId) return { ok: false, error: "jenis_perkara_kosong" };

  const baris = await runQuerySipp(
    `SELECT o.obyek_gugatan AS obyek, COUNT(*) AS jumlah
       FROM perkara_obyek_sengketa o
       JOIN perkara p ON p.perkara_id = o.perkara_id
      WHERE p.jenis_perkara_id = ?
        AND o.obyek_gugatan IS NOT NULL
        AND TRIM(o.obyek_gugatan) <> ''
      GROUP BY o.obyek_gugatan
      ORDER BY jumlah DESC
      LIMIT ${BATAS_EJAAN}`,
    [jenisPerkaraId]
  );

  let jenisPerkara = "";
  if (await sippSkemaService.tabelAda("jenis_perkara")) {
    const jenis = await runQuerySipp(`SELECT nama FROM jenis_perkara WHERE id = ? LIMIT 1`, [jenisPerkaraId]);
    jenisPerkara = jenis.length > 0 ? String(jenis[0].nama || "").trim() : "";
  }

  return {
    ok: true,
    perkaraId,
    jenisPerkaraId,
    jenisPerkara,
    baris: baris.map((satu) => ({
      obyek: String(satu.obyek || "").trim(),
      jumlah: Number(satu.jumlah || 0),
    })),
  };
}

module.exports = { kebiasaan, BATAS_EJAAN };
