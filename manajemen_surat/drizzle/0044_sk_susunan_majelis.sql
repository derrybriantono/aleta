-- =============================================================================
-- SK susunan majelis hakim dan panitera pengganti - dua kolom pada baris yang
-- sudah ada.
--
-- aleta_sipp_hari_sidang sejak 0019 menyimpan hari sidang tiap majelis beserta
-- kode panitera menurut SK. Yang belum pernah tersimpan adalah SUSUNAN
-- HAKIMNYA - siapa ketua dan siapa anggotanya - sehingga susunan yang
-- ditawarkan panel diturunkan dari pemakaian di SIPP, bukan dari SK.
--
-- Bedanya terlihat pada susunan yang kebetulan pernah dipakai: majelis yang
-- satu kali pernah diisi hakim pengganti tampil sebagai susunan tersendiri,
-- setara dengan susunan yang memang ditetapkan SK, dan tidak ada yang
-- membedakannya di layar.
--
-- =============================================================================
-- KENAPA PANITERANYA DISIMPAN SEBAGAI ID, BUKAN KODE
-- =============================================================================
--
-- Kolom panitera_kode memuat kode dari SK: D, D1, D2, D4, D5, D6. Diperiksa
-- pada panitera_pn SIPP PA Donggala, kode itu TIDAK DAPAT dipakai menemukan
-- orangnya:
--
--   Sri Susilowati       kode "D"     SK menyebut D
--   Munifa               kode "D"     SK menyebut D1
--   Qadariyah            kode "D"     SK menyebut D3
--   Andini Puspita Sari  kode "D"     SK menyebut D4
--   Sitti Nurhidayah     kode "D8"    SK menyebut D6
--   Unun Fidiyasari P.   kode ""      SK menyebut D5
--   Fikrianto            kode ""      SK menyebut D2
--
-- Empat orang berbagi kode "D", satu berkode lain, dan dua tidak berkode sama
-- sekali. Mencocokkan menurut kode memulangkan empat orang untuk "D" dan nol
-- orang untuk D1, D2, D4, D5, D6.
--
-- Namanya pun tidak dapat diandalkan: SK menulis "Munifah, S.H." sedangkan
-- SIPP menulis "Munifa" - beda satu huruf, dan pencocokan nama yang meleset
-- pada berkas perkara menetapkan panitera yang salah tanpa berbunyi.
--
-- Karena itu panitera_id menyimpan PASANGAN kode-SK dengan id panitera_pn:
--
--   panitera_id = 'D=26,D4=21'
--
-- Berpasangan, bukan dua daftar sejajar: daftar sejajar bergeser diam-diam
-- begitu satu kode dihapus dari tengah - D4 menjadi milik orang yang
-- seharusnya D5, dan tidak ada yang berbunyi.
--
-- Kodenya tetap terbaca di layar di sebelah namanya, persis seperti kode
-- majelis hakim - itulah gunanya ia disimpan. Yang berubah hanya: kode itu
-- LABEL, dan id-lah yang menunjuk orangnya.
--
-- Kode hakim TIDAK bermasalah: A, B, C1, C2, C3 pada hakim_pn tunggal dan
-- cocok persis dengan SK, jadi susunannya disimpan sebagai kode.
--
-- Keduanya berbawaan '' - baris lama terbaca sebagai "SK-nya belum diisi",
-- dan panel kembali ke perilaku lamanya sampai seseorang mengisinya.
-- =============================================================================

ALTER TABLE aleta_sipp_hari_sidang
  ADD COLUMN IF NOT EXISTS hakim_kode TEXT NOT NULL DEFAULT '';

ALTER TABLE aleta_sipp_hari_sidang
  ADD COLUMN IF NOT EXISTS panitera_id TEXT NOT NULL DEFAULT '';

-- Nomor dan tanggal SK-nya sendiri, supaya yang membaca layar pengaturan tahu
-- SK mana yang sedang berlaku - dan supaya penggantinya kelak dapat dibedakan.
ALTER TABLE aleta_sipp_hari_sidang
  ADD COLUMN IF NOT EXISTS sk_nomor TEXT NOT NULL DEFAULT '';

ALTER TABLE aleta_sipp_hari_sidang
  ADD COLUMN IF NOT EXISTS sk_tanggal TEXT NOT NULL DEFAULT '';
