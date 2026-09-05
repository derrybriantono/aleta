-- =============================================================================
-- Riwayat berkas perkara: keadaan pada tiap tanggal, bukan hanya yang terakhir.
--
-- =============================================================================
-- MASALAH YANG DIPECAHKAN
-- =============================================================================
--
-- Berkas perkara dirakit ulang tiap kali dibuka, dan yang terlihat selalu
-- keadaan HARI INI. Padahal pertanyaan yang paling sering muncul saat sebuah
-- naskah dipersoalkan justru: "apa yang tercatat waktu itu?"
--
-- BAS yang ditandatangani 1 September menyebut dua saksi. Bulan depan SIPP
-- memuat empat. Tanpa riwayat, tidak ada cara membuktikan bahwa BAS itu benar
-- pada saat ditandatangani - dan yang tampak adalah BAS yang keliru.
--
-- =============================================================================
-- HANYA PERUBAHAN YANG DISIMPAN
-- =============================================================================
--
-- Sidik isi dihitung tiap perakitan. Bila sama dengan yang terakhir, tidak ada
-- baris baru. Perkara yang dibuka dua puluh kali sehari dengan begitu
-- meninggalkan satu baris, bukan dua puluh.
--
-- Tanpa penjagaan itu tabel ini akan tumbuh secepat pemakaian, bukan secepat
-- perubahan - dan riwayat yang penuh salinan yang sama tidak dapat dibaca.
--
-- =============================================================================
-- YANG DISIMPAN RINGKASAN, BUKAN SELURUH BERKAS
-- =============================================================================
--
-- Isi lengkap berkas dapat mencapai puluhan ribu huruf karena memuat naskah
-- pertimbangan hukum. Menyimpannya utuh tiap perubahan menjadikan tabel ini
-- lebih besar daripada seluruh data ALETA lainnya.
--
-- Yang disimpan: jumlah tiap bagian, nomor perkara, tahapan, dan selisih yang
-- ditemukan - cukup untuk menjawab "apa yang tercatat waktu itu" tanpa menjadi
-- salinan kedua dari SIPP.
-- =============================================================================

CREATE TABLE IF NOT EXISTS aleta_berkas_riwayat (
  id TEXT PRIMARY KEY,
  perkara_id TEXT NOT NULL,
  nomor_perkara TEXT NOT NULL DEFAULT '',
  -- Sidik isi ringkasan. Baris baru hanya ditulis bila sidiknya berbeda.
  sidik TEXT NOT NULL,
  -- Ringkasan keadaan sebagai JSON: jumlah tiap bagian, tahapan, selisih.
  ringkasan TEXT NOT NULL DEFAULT '{}',
  -- Bagian mana yang tidak terbaca saat itu, supaya riwayat yang timpang
  -- terbaca sebagai sumber yang mati - bukan sebagai data yang memang hilang.
  halangan TEXT NOT NULL DEFAULT '',
  dirakit_at TEXT NOT NULL,
  dicatat_oleh TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_berkas_riwayat_perkara
  ON aleta_berkas_riwayat(perkara_id, dirakit_at);
