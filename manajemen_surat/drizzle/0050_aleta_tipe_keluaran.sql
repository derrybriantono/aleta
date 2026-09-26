-- =============================================================================
-- TIPE KELUARAN - kalimat dan pilihan keluaran PUTUSAN dan BAS dalam satu tempat
-- =============================================================================
--
-- Sampai 2.35.0 daftar kalimat dan pilihan yang dipakai menyusun putusan dan
-- berita acara tertanam di TIGA tempat yang berjalan sendiri-sendiri: ekstensi
-- (konten.js, abt.js, panel-alat.js), pustaka portal, dan bot. Terukur sudah
-- berselisih: panel ekstensi menawarkan 9 alasan, bot mengenal 13 - dan dua
-- alasan hilang dari kalimat tanpa satu pun galat.
--
-- Tabel ini menjadi satu sumbernya. Aksesnya HANYA lewat modul
-- src/server/modules/aleta-ecourt/tipe-keluaran.ts; tidak ada SQL ke tabel ini
-- di luar modul itu.
--
-- =============================================================================
-- BAWAAN TIDAK DISIMPAN SEBAGAI NILAI YANG BERLAKU
-- =============================================================================
--
-- Baris 'bawaan' hanyalah saklar atas entri cermin kode (src/lib/tipe-keluaran/
-- bawaan/). NILAINYA selalu dibaca dari cermin, bukan dari baris ini - sehingga
-- kode dan basis data tidak dapat berselisih tanpa ketahuan. Baris bawaan yang
-- sidiknya tidak lagi ada di cermin disebut 'yatim': diabaikan dan dicatat
-- sekali di riwayat.
--
-- Karena itu benih TIDAK ditulis di berkas ini. pastikanBenih mengisinya dari
-- cermin kode secara idempoten saat pertama dibaca. Tabel yang kosong atau tak
-- terbaca berarti keluaran = cermin, yaitu perilaku yang sama dengan sebelum
-- tabel ini ada.
--
-- =============================================================================
-- TIDAK ADA YANG DIHAPUS
-- =============================================================================
--
-- Tambahan masuk sebagai usulan, disahkan Super Admin atas perintah yang
-- disebut, ditolak dengan alasan, dimatikan/dinyalakan dengan alasan, atau
-- digantikan versi baru (menggantikan_id). Tidak ada jalur DELETE: pertanyaan
-- "sejak kapan kalimat ini berbunyi begini, dan atas perintah siapa" harus
-- tetap terjawab.
--
-- Waktu disimpan sebagai TEXT ISO dan bendera sebagai INTEGER, mengikuti
-- aleta_saklar_periksa.
--
-- TIGA TEMPAT PENDAFTARAN, semuanya wajib (yang terlewat gagal diam-diam):
--   (a) berkas ini dan entrinya di meta/_journal.json;
--   (b) DDL yang sama di src/server/db/schema.ts (DDL_TIPE_KELUARAN) - pg-mem
--       dan mode cadangan tidak menjalankan berkas drizzle/*.sql;
--   (c) kedua tabel di IN_MEMORY_TABLE_PERSISTENCE_ORDER (client.ts), supaya
--       entri tangan yang dibuat saat Postgres mati tidak lenyap saat mulai
--       ulang.
-- Kesamaan (a) dan (b) dijaga src/test/tipe-keluaran-skema.test.ts.
-- =============================================================================

CREATE TABLE IF NOT EXISTS aleta_tipe_keluaran (
  id TEXT PRIMARY KEY,
  golongan TEXT NOT NULL CHECK (golongan IN ('bas', 'putusan', 'bersama')),
  daftar TEXT NOT NULL,
  kunci TEXT NOT NULL DEFAULT '',
  nilai TEXT NOT NULL,
  data TEXT NOT NULL DEFAULT '{}',
  asal TEXT NOT NULL CHECK (asal IN ('bawaan', 'tambahan')),
  sidik TEXT NOT NULL,
  aktif INTEGER NOT NULL DEFAULT 1,
  keadaan TEXT NOT NULL CHECK (keadaan IN ('usulan', 'disahkan', 'ditolak', 'diganti')),
  urutan INTEGER NOT NULL DEFAULT 0,
  versi INTEGER NOT NULL DEFAULT 1,
  menggantikan_id TEXT,
  alasan TEXT NOT NULL DEFAULT '',
  hasil_ukur TEXT,
  dibuat_oleh TEXT NOT NULL,
  dibuat_at TEXT NOT NULL,
  disahkan_oleh TEXT,
  atas_perintah TEXT,
  disahkan_at TEXT,
  diubah_at TEXT NOT NULL,
  UNIQUE (daftar, sidik)
);

-- Riwayat HANYA ditambah, tidak pernah diubah. Satu baris per tindakan.
CREATE TABLE IF NOT EXISTS aleta_tipe_keluaran_riwayat (
  id TEXT PRIMARY KEY,
  butir_id TEXT NOT NULL,
  tindakan TEXT NOT NULL CHECK (tindakan IN ('benih', 'usul', 'sahkan', 'tolak', 'matikan', 'nyalakan', 'ganti', 'ukur', 'yatim')),
  dari TEXT,
  ke TEXT,
  alasan TEXT NOT NULL DEFAULT '',
  oleh TEXT NOT NULL,
  pada TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tipe_keluaran_daftar ON aleta_tipe_keluaran (golongan, daftar, keadaan, aktif);

CREATE INDEX IF NOT EXISTS idx_tipe_keluaran_riwayat_butir ON aleta_tipe_keluaran_riwayat (butir_id, pada);
