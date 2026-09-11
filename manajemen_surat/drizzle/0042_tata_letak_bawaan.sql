-- =============================================================================
-- Susunan bawaan dasbor, ditentukan Super Admin untuk seluruh pegawai.
--
-- Susunan per pengguna sudah ada sejak 0040. Yang belum: titik berangkatnya.
-- Pegawai baru, dan siapa pun yang menekan "Kembalikan susunan bawaan",
-- mendarat pada urutan yang dipatok di kode - padahal yang paling tahu urutan
-- mana yang berguna di satuan kerja ini adalah orang di satuan kerja itu,
-- bukan urutan yang kebetulan tertulis lebih dulu.
--
-- SATU BARIS PER HALAMAN, TANPA PEMILIK
--
-- Ini setelan bersama, bukan milik seseorang. Karena itu kuncinya halaman,
-- dan updated_by hanya catatan siapa yang terakhir mengubahnya - bukan
-- pemilik barisnya.
--
-- KENAPA BUKAN DISALIN KE TIAP AKUN
--
-- Cara lain yang mungkin: menuliskan susunan bawaan ke baris tata_letak_dasbor
-- setiap pegawai. Itu ditolak. Susunan yang disalin membeku - bawaan yang
-- diubah Super Admin kelak tidak akan sampai kepada siapa pun yang barisnya
-- sudah terlanjur terisi, dan tidak ada satu layar pun yang memperlihatkan
-- bahwa itu sedang terjadi. Lagi pula tidak akan ada lagi cara membedakan
-- pegawai yang menyusun dasbornya sendiri dari pegawai yang tidak pernah
-- menyentuhnya.
--
-- Jadi barisnya tetap satu, dibaca saat halaman dibuka, dan susunan pribadi
-- pegawai menimpanya hanya bila ia memang pernah menyusunnya sendiri.
-- =============================================================================

CREATE TABLE IF NOT EXISTS tata_letak_bawaan (
  halaman TEXT PRIMARY KEY,
  susunan_json TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL,
  updated_by TEXT
);
