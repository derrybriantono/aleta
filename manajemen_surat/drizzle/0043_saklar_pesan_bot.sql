-- =============================================================================
-- Saklar pesan ALETA Bot: kirim saat data lengkap, dan saklar per pesan.
--
-- Dua setelan baru pada satu baris aleta_bot_settings, keduanya JSON:
--
--   kirim_saat_lengkap_json  {enabled, pegawai, pihak, jendelaHari, intervalMenit}
--   pesan_nonaktif_json      {pegawai: [kunci...], pihak: [kunci...]}
--
-- KENAPA JSON, BUKAN KOLOM PER SAKLAR
--
-- Saklar per pesan tumbuh mengikuti jenis pesan: tiap pemberitahuan baru di
-- bot menambah satu kunci, dan menambah satu kolom tiap kali berarti satu
-- migrasi per jenis pesan. Daftar kunci yang DIMATIKAN disimpan apa adanya;
-- kunci yang belum dikenal portal tidak terpengaruh, dan itu memang yang
-- diinginkan - pesan jenis baru tetap terkirim sampai seseorang mematikannya.
--
-- Bawaan '{}' dibaca sebagai: fitur kirim-saat-lengkap MATI, tidak ada pesan
-- yang dimatikan. Baris lama tidak berubah perilakunya.
-- =============================================================================

ALTER TABLE aleta_bot_settings ADD COLUMN IF NOT EXISTS kirim_saat_lengkap_json TEXT NOT NULL DEFAULT '{}';
ALTER TABLE aleta_bot_settings ADD COLUMN IF NOT EXISTS pesan_nonaktif_json TEXT NOT NULL DEFAULT '{}';
