"use strict";

/**
 * Pemeriksaan keutuhan arsip berkas e-Court.
 *
 * ============================================================================
 * CATATAN "ADA" TIDAK SAMA DENGAN BERKAS YANG BENAR-BENAR UTUH
 * ============================================================================
 *
 * Baris pada aleta_bot_ecourt_files berarti berkas itu PERNAH tersimpan. Sejak
 * saat itu berkasnya dapat hilang, terpotong, atau tertimpa - dan tidak ada
 * satu pun yang memberi tahu. Perkaranya tetap terhitung lengkap, sehingga
 * penarikan berikutnya melewatinya, dan kerusakannya baru ketahuan ketika ada
 * yang membukanya.
 *
 * Pemeriksaan ini membandingkan catatan dengan berkas di disk pada empat hal:
 *
 *   ada       - berkasnya masih ada di jalur yang tercatat
 *   ukuran    - ukurannya sama dengan yang dicatat
 *   sidik jari- isinya menghasilkan SHA-256 yang sama
 *   bentuk    - penanda awal isinya sesuai formatnya
 *
 * ============================================================================
 * BERGILIR, BUKAN SEKALIGUS
 * ============================================================================
 *
 * Membaca dan menghitung sidik jari SELURUH arsip berarti membaca berpuluh
 * gigabita sekali jalan. Karena itu tiap putaran memeriksa sejumlah berkas yang
 * PALING LAMA tidak diperiksa, lalu memperbarui penandanya. Seluruh arsip
 * terperiksa dalam beberapa putaran, tanpa satu putaran pun yang membebani
 * server berjam-jam.
 *
 * ============================================================================
 * MEMPERBAIKI BERARTI MENGHAPUS CATATANNYA, BUKAN MENGUNDUH DI SINI
 * ============================================================================
 *
 * Berkas rusak diperbaiki dengan menghapus catatan dan berkasnya, sehingga
 * perkaranya tidak lagi terhitung lengkap dan penarikan berikutnya mengambilnya
 * kembali. Mengunduh langsung dari sini berarti membuka peramban dan sesi
 * e-Court kedua di samping jembatan - dua jalur yang dapat berbeda perilaku,
 * dan yang satu ini justru paling jarang diperhatikan orang.
 */

const crypto = require("crypto");
const fs = require("fs");

const botDb = require("./botDbService");
const logService = require("./logService");
const berkasIntegritasService = require("./berkasIntegritasService");

/** Berapa berkas diperiksa sekali putaran. */
const BATAS_BAWAAN = 200;

/**
 * Berkas sebesar ini tidak dibaca seluruhnya untuk dihitung sidik jarinya.
 *
 * Yang diperiksa cukup keberadaan, ukuran, dan penanda awalnya. Membaca berkas
 * ratusan megabita hanya untuk memastikan sidik jarinya tidak berubah bukan
 * pemakaian waktu yang sepadan - berkas sebesar itu jarang, dan kerusakan yang
 * lolos akan tertangkap pada pemeriksaan penanda.
 */
const BATAS_BACA_PENUH = 64 * 1024 * 1024;

/** Membaca beberapa huruf pertama saja - untuk berkas yang sangat besar. */
function bacaAwalan(jalur, panjang) {
  const penyangga = Buffer.alloc(panjang);
  const pegangan = fs.openSync(jalur, "r");
  try {
    const terbaca = fs.readSync(pegangan, penyangga, 0, panjang, 0);
    return penyangga.subarray(0, terbaca);
  } finally {
    fs.closeSync(pegangan);
  }
}

/**
 * Memeriksa satu baris berkas.
 *
 * @returns {{ ok: boolean, alasan: string }}
 */
function periksaSatu(baris) {
  const jalur = String(baris.jalurBerkas || "");
  if (!jalur) return { ok: false, alasan: "jalur_tidak_tercatat" };

  let info;
  try {
    info = fs.statSync(jalur);
  } catch {
    return { ok: false, alasan: "berkas_hilang_dari_disk" };
  }

  if (!info.isFile()) return { ok: false, alasan: "bukan_berkas" };

  const ukuranTercatat = Number(baris.ukuranByte) || 0;
  if (ukuranTercatat > 0 && info.size !== ukuranTercatat) {
    return { ok: false, alasan: `ukuran_berubah (${ukuranTercatat} -> ${info.size})` };
  }

  const format = String(baris.format || "") || berkasIntegritasService.formatDariNama(jalur);

  if (info.size > BATAS_BACA_PENUH) {
    // Berkas sangat besar: penanda awalnya saja - lihat catatan di atas.
    const awalan = bacaAwalan(jalur, 1024);
    const bentuk = berkasIntegritasService.periksaIsi(awalan, { format });
    return bentuk.ok ? { ok: true, alasan: "" } : { ok: false, alasan: bentuk.alasan };
  }

  let isi;
  try {
    isi = fs.readFileSync(jalur);
  } catch (galat) {
    return { ok: false, alasan: `tidak_dapat_dibaca: ${galat.message}` };
  }

  const bentuk = berkasIntegritasService.periksaIsi(isi, { format });
  if (!bentuk.ok) return { ok: false, alasan: bentuk.alasan };

  const sidikJari = crypto.createHash("sha256").update(isi).digest("hex");
  if (baris.sidikJari && sidikJari !== baris.sidikJari) {
    return { ok: false, alasan: "sidik_jari_berbeda" };
  }

  return { ok: true, alasan: "" };
}

/** Menghapus catatan dan berkas yang rusak, supaya ditarik ulang. */
async function buangBerkasRusak(baris) {
  try {
    if (baris.jalurBerkas) fs.unlinkSync(baris.jalurBerkas);
  } catch {
    // Berkas memang sudah tidak ada - itu justru salah satu sebab ia rusak.
  }
  await botDb.query(`DELETE FROM aleta_bot_ecourt_files WHERE id = ?`, [baris.id]);
}

/**
 * Satu putaran pemeriksaan.
 *
 * @param {{ batas?: number, perbaiki?: boolean, olehSiapa?: string }} opsi
 */
async function periksaArsip({ batas = BATAS_BAWAAN, perbaiki = false, olehSiapa = "" } = {}) {
  const jumlah = Math.min(Math.max(Number(batas) || BATAS_BAWAAN, 1), 2000);

  const rows = await botDb.query(
    // Berkas yang sengaja dihapus karena masa simpan TIDAK diperiksa. Ia akan
    // selalu terbaca "hilang dari disk", dan bila dibuang catatannya perkaranya
    // menjadi tidak lengkap lalu ditarik ulang dari e-Court - persis kebalikan
    // dari yang dimaksud retensi.
    `SELECT id, document_key AS documentKey, nomor_perkara AS nomorPerkara,
            format, jalur_berkas AS jalurBerkas, sidik_jari AS sidikJari,
            ukuran_byte AS ukuranByte, terakhir_diperiksa AS terakhirDiperiksa
       FROM aleta_bot_ecourt_files
      WHERE dihapus_retensi IS NULL
      ORDER BY terakhir_diperiksa ASC
      LIMIT ?`,
    [jumlah]
  );

  const daftar = Array.isArray(rows) ? rows : [];
  const masalah = [];
  let utuh = 0;
  let dibuang = 0;

  const sekarang = botDb.toMysqlDate(new Date());

  for (const baris of daftar) {
    const hasil = periksaSatu(baris);

    if (hasil.ok) {
      utuh += 1;
      // Menandai sudah diperiksa supaya putaran berikutnya beralih ke yang lain.
      await botDb
        .query(`UPDATE aleta_bot_ecourt_files SET terakhir_diperiksa = ? WHERE id = ?`, [
          sekarang,
          baris.id,
        ])
        .catch(() => {});
      continue;
    }

    masalah.push({
      id: String(baris.id),
      documentKey: String(baris.documentKey || ""),
      nomorPerkara: String(baris.nomorPerkara || ""),
      format: String(baris.format || ""),
      jalurBerkas: String(baris.jalurBerkas || ""),
      alasan: hasil.alasan,
    });

    if (perbaiki) {
      await buangBerkasRusak(baris).catch(() => {});
      dibuang += 1;
    } else {
      // TIDAK ditandai sudah diperiksa: berkas rusak yang dibiarkan harus
      // muncul lagi pada putaran berikutnya, bukan hilang dari perhatian
      // hanya karena sudah pernah dilihat sekali.
      // Tanpa ini, sekali dilaporkan berarti selamanya terlewat.
    }
  }

  const ringkasan = {
    diperiksa: daftar.length,
    utuh,
    bermasalah: masalah.length,
    dibuang,
    perbaiki,
    diperiksaPada: new Date().toISOString(),
    masalah: masalah.slice(0, 100),
  };

  if (masalah.length > 0) {
    void logService.logSystemEvent({
      eventType: "ecourt_arsip_bermasalah",
      severity: "warning",
      message: `Pemeriksaan arsip menemukan ${masalah.length} berkas bermasalah.`,
      metadata: {
        diperiksa: daftar.length,
        bermasalah: masalah.length,
        dibuang,
        olehSiapa: String(olehSiapa || ""),
        contoh: masalah.slice(0, 5).map((item) => `${item.nomorPerkara}: ${item.alasan}`),
      },
    });
  }

  return ringkasan;
}

module.exports = {
  BATAS_BACA_PENUH,
  BATAS_BAWAAN,
  buangBerkasRusak,
  periksaArsip,
  periksaSatu,
};
