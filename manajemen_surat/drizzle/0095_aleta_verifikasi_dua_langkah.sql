-- =============================================================================
-- VERIFIKASI DUA LANGKAH: OTP WHATSAPP + AUTHENTICATOR (E5, 25 Okt 2026)
-- =============================================================================
--
--   aleta_verifikasi_authenticator  satu baris per akun: rahasia TOTP TERENKRIPSI
--                                   (AES-256-GCM; kunci dari rahasia aplikasi),
--                                   aktif setelah akun membuktikan satu kode.
--                                   langkah_terakhir menolak kode yang dipakai ulang.
--   aleta_verifikasi_tantangan      tiket sekali pakai 10 menit yang diterbitkan
--                                   kait masuk SESUDAH password terbukti benar
--                                   (id = SHA-256 tiket) beserta kode WhatsApp
--                                   yang sedang berlaku (hanya hash-nya).
--   aleta_verifikasi_lolos          akun + perangkat yang sudah lolos: jenis
--                                   'sekali' (5 menit, dipakai sekali oleh masuk
--                                   ulang) dan 'tepercaya' (30 hari, atas pilihan
--                                   pengguna). Perangkat = kuki aleta_perangkat.
--   aleta_verifikasi_kode_cadangan  kode sekali pakai dari admin bila HP hilang
--                                   (hanya hash-nya; ditampilkan SEKALI).
--
-- Saklar (otp WhatsApp, authenticator), aturan per peran, dan daftar jaringan
-- kantor disimpan di aleta_ekstensi_setelan (pengguna *sistem*), MATI bawaan.
--
-- Tanpa kunci asing dan tanpa CHECK: nilai sah dijaga modul
-- (src/server/modules/verifikasi/*). Waktu ISO UTC sebagai TEXT.
--
-- NOMOR: rantai E memegang 0094, 0095, 0104. Jurnal memakai idx sementara 82
-- (menyambung 81 agar uji "idx = urutan" tetap hijau); dirapikan saat gabung akhir.
--
-- TIGA TEMPAT PENDAFTARAN, semuanya wajib (yang terlewat gagal diam-diam):
--   (a) berkas ini dan entrinya di meta/_journal.json;
--   (b) DDL yang sama di src/server/db/schema.ts (DDL_VERIFIKASI_DUA_LANGKAH);
--   (c) tabel-tabelnya di IN_MEMORY_TABLE_PERSISTENCE_ORDER (db/client.ts).
-- =============================================================================

CREATE TABLE IF NOT EXISTS aleta_verifikasi_authenticator (
  user_id TEXT PRIMARY KEY,
  rahasia_enc TEXT NOT NULL,
  aktif INTEGER NOT NULL DEFAULT 0,
  dibuat_pada TEXT NOT NULL,
  aktif_pada TEXT NOT NULL DEFAULT '',
  langkah_terakhir INTEGER NOT NULL DEFAULT -1
);

CREATE TABLE IF NOT EXISTS aleta_verifikasi_tantangan (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  perangkat_id TEXT NOT NULL DEFAULT '',
  jalur TEXT NOT NULL DEFAULT '',
  dibuat_pada TEXT NOT NULL,
  kedaluwarsa_pada TEXT NOT NULL,
  percobaan INTEGER NOT NULL DEFAULT 0,
  kode_wa_hash TEXT NOT NULL DEFAULT '',
  kode_wa_kedaluwarsa TEXT NOT NULL DEFAULT '',
  kirim_terakhir TEXT NOT NULL DEFAULT '',
  jumlah_kirim INTEGER NOT NULL DEFAULT 0,
  selesai_pada TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS aleta_verifikasi_lolos (
  user_id TEXT NOT NULL,
  perangkat_id TEXT NOT NULL,
  jenis TEXT NOT NULL,
  metode TEXT NOT NULL DEFAULT '',
  dibuat_pada TEXT NOT NULL,
  sampai TEXT NOT NULL,
  PRIMARY KEY (user_id, perangkat_id, jenis)
);

CREATE TABLE IF NOT EXISTS aleta_verifikasi_kode_cadangan (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  kode_hash TEXT NOT NULL,
  dibuat_pada TEXT NOT NULL,
  dibuat_oleh TEXT NOT NULL DEFAULT '',
  dipakai_pada TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_verifikasi_tantangan_akun ON aleta_verifikasi_tantangan(user_id, kedaluwarsa_pada);
CREATE INDEX IF NOT EXISTS idx_verifikasi_lolos_sampai ON aleta_verifikasi_lolos(sampai);
CREATE INDEX IF NOT EXISTS idx_verifikasi_kode_cadangan_akun ON aleta_verifikasi_kode_cadangan(user_id, dipakai_pada);
