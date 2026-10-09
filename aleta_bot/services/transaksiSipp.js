"use strict";

/**
 * ============================================================================
 * SATU SAMBUNGAN, SATU TRANSAKSI - UNTUK PENULIS SIPP BERLANGKAH BANYAK
 * ============================================================================
 *
 * Uji rilis 9 Okt 2026 (pola kasus 273): penulis yang menyentuh beberapa
 * tabel SIPP berturut-turut (Kasir jurnal, mediator dari Jadwal Sidang) tidak
 * boleh meninggalkan tulisan setengah jadi bila satu langkah di tengah gagal.
 *
 *   denganTransaksi(kerja)  -> kerja(kueri) dijalankan di antara
 *                              START TRANSACTION .. COMMIT pada SATU sambungan
 *                              kolam SIPP; melempar = ROLLBACK, galatnya
 *                              dilempar ulang dengan `dipulihkan` (true bila
 *                              ROLLBACK berhasil).
 *
 * Seluruh tabel yang ditulis lewat sini InnoDB (diukur di server satker,
 * baca-saja, 9 Okt 2026). Penulis tunda/putus memakai padanannya sendiri,
 * sidangHasilService.jalankanRencanaUtuh.
 */
function denganTransaksi(kerja, kolam = require("../db_config")) {
  return new Promise((selesai, gagal) => {
    if (!kolam || typeof kolam.getConnection !== "function") {
      gagal(new Error("kolam sambungan SIPP tidak mendukung transaksi"));
      return;
    }
    kolam.getConnection(async (galatSambung, sambungan) => {
      if (galatSambung) {
        gagal(galatSambung);
        return;
      }
      const kueri = (sql, params = []) =>
        new Promise((ok, no) => sambungan.query(sql, params, (g, r) => (g ? no(g) : ok(r))));
      try {
        await kueri("START TRANSACTION");
        const hasil = await kerja(kueri);
        await kueri("COMMIT");
        selesai(hasil);
      } catch (galat) {
        const dipulihkan = await kueri("ROLLBACK").then(
          () => true,
          () => false
        );
        const g = galat instanceof Error ? galat : new Error(String(galat));
        g.dipulihkan = dipulihkan;
        gagal(g);
      } finally {
        try {
          sambungan.release();
        } catch {
          // Sambungan yang sudah putus tidak perlu dilepas.
        }
      }
    });
  });
}

module.exports = { denganTransaksi };
