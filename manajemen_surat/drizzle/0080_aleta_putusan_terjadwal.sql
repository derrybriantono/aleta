-- =============================================================================
-- UNGGAH PUTUSAN TERJADWAL (21 Oktober 2026, agen B3)
-- =============================================================================
--
-- Hakim memilih perkara (satu, atau banyak menurut tanggal), menyeret berkas
-- putusannya, memilih jam, lalu ALETA mengerjakan pada waktunya: isi & simpan
-- Putusan Akhir (peramban petugas yang terbuka), e-Doc putusan dan e-Doc
-- anonimisasi (pelaksana di server portal). Tabel ini adalah antreannya.
--
--   aleta_putusan_jadwal         satu jadwal: siapa menjadwalkan, jam mulai, batas
--                                akhir, jeda antar perkara, jendela jam kerja
--   aleta_putusan_jadwal_butir   satu perkara dalam jadwal: langkah yang dipilih,
--                                status tiap langkah, saat rencana, berkasnya
--   aleta_putusan_jadwal_berkas  berkas yang diunggah (belum/sudah dipasang ke
--                                butir); isinya di folder penyimpanan yang
--                                di-mount (ALETA_UPLOAD_DIR/putusan-terjadwal),
--                                bukan di basis data
--   aleta_putusan_jadwal_jejak   jejak jujur: siapa menjadwalkan, kapan dijalankan,
--                                oleh pelaksana mana, hasil tiap langkah
--
-- Tanpa kunci asing dan tanpa CHECK: nilai yang sah dijaga modul
-- (src/server/modules/putusan-terjadwal/*, src/lib/putusan-terjadwal.ts).
-- Waktu disimpan ISO UTC sebagai TEXT (dapat dibandingkan sebagai teks); waktu
-- yang dilihat petugas WITA, ditulis "YYYY-MM-DD HH:mm" pada kolom *_wita.
-- Tidak ada kata ALETA yang ditulis ke SIPP dari tabel ini: semuanya hanya
-- catatan ALETA sendiri.
--
-- NOMOR: 0080 diklaim 21 Okt 2026 (jurnal terakhir idx 72 = 0079 milik B1);
-- idx 73.
--
-- TIGA TEMPAT PENDAFTARAN, semuanya wajib (yang terlewat gagal diam-diam):
--   (a) berkas ini dan entrinya di meta/_journal.json;
--   (b) DDL yang sama di src/server/db/schema.ts (DDL_PUTUSAN_TERJADWAL);
--   (c) keempat tabelnya di IN_MEMORY_TABLE_PERSISTENCE_ORDER (db/client.ts).
-- Kesamaan (a) dan (b) dijaga src/test/putusan-terjadwal-layanan-21okt.test.ts.
-- =============================================================================

CREATE TABLE IF NOT EXISTS aleta_putusan_jadwal (
  id TEXT PRIMARY KEY,
  dibuat_oleh TEXT NOT NULL,
  dibuat_nama TEXT NOT NULL DEFAULT '',
  peran TEXT NOT NULL DEFAULT '',
  akun_sipp TEXT NOT NULL DEFAULT '',
  ip TEXT NOT NULL DEFAULT '',
  sumber TEXT NOT NULL DEFAULT '',
  tanggal_acuan TEXT NOT NULL DEFAULT '',
  mulai_wita TEXT NOT NULL,
  batas_akhir_wita TEXT NOT NULL DEFAULT '',
  jeda_min INTEGER NOT NULL DEFAULT 120,
  jeda_maks INTEGER NOT NULL DEFAULT 420,
  jam_dari TEXT NOT NULL DEFAULT '',
  jam_sampai TEXT NOT NULL DEFAULT '',
  malam_boleh INTEGER NOT NULL DEFAULT 0,
  lintas_hari INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'aktif',
  catatan TEXT NOT NULL DEFAULT '',
  dibuat_pada TEXT NOT NULL,
  diubah_pada TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS aleta_putusan_jadwal_butir (
  id TEXT PRIMARY KEY,
  jadwal_id TEXT NOT NULL,
  urut INTEGER NOT NULL DEFAULT 0,
  perkara_id TEXT NOT NULL,
  nomor_perkara TEXT NOT NULL,
  jenis_perkara TEXT NOT NULL DEFAULT '',
  pemilik_id TEXT NOT NULL,
  akun_sipp TEXT NOT NULL DEFAULT '',
  peran TEXT NOT NULL DEFAULT '',
  ip TEXT NOT NULL DEFAULT '',
  waktu_rencana TEXT NOT NULL,
  langkah_isi INTEGER NOT NULL DEFAULT 0,
  langkah_putusan INTEGER NOT NULL DEFAULT 0,
  langkah_anonim INTEGER NOT NULL DEFAULT 0,
  status_isi TEXT NOT NULL DEFAULT 'tidak',
  status_putusan TEXT NOT NULL DEFAULT 'tidak',
  status_anonim TEXT NOT NULL DEFAULT 'tidak',
  catatan_isi TEXT NOT NULL DEFAULT '',
  catatan_putusan TEXT NOT NULL DEFAULT '',
  catatan_anonim TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'menunggu',
  pilihan_json TEXT NOT NULL DEFAULT '{}',
  berkas_id TEXT NOT NULL DEFAULT '',
  berkas_nama TEXT NOT NULL DEFAULT '',
  berkas_bentuk TEXT NOT NULL DEFAULT '',
  berkas_ukuran INTEGER NOT NULL DEFAULT 0,
  berkas_sha256 TEXT NOT NULL DEFAULT '',
  berkas_jalur TEXT NOT NULL DEFAULT '',
  berkas_hapus_pada TEXT NOT NULL DEFAULT '',
  percobaan INTEGER NOT NULL DEFAULT 0,
  klaim_oleh TEXT NOT NULL DEFAULT '',
  klaim_sampai TEXT NOT NULL DEFAULT '',
  tunggu_sampai TEXT NOT NULL DEFAULT '',
  edoc_sesudah TEXT NOT NULL DEFAULT '',
  mulai_pada TEXT NOT NULL DEFAULT '',
  selesai_pada TEXT NOT NULL DEFAULT '',
  dilihat_pada TEXT NOT NULL DEFAULT '',
  dibuat_pada TEXT NOT NULL,
  diubah_pada TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS aleta_putusan_jadwal_berkas (
  id TEXT PRIMARY KEY,
  pemilik_id TEXT NOT NULL,
  nama TEXT NOT NULL,
  bentuk TEXT NOT NULL DEFAULT '',
  ukuran INTEGER NOT NULL DEFAULT 0,
  sha256 TEXT NOT NULL DEFAULT '',
  jalur TEXT NOT NULL DEFAULT '',
  nomor_isi TEXT NOT NULL DEFAULT '',
  peringatan_json TEXT NOT NULL DEFAULT '[]',
  dipakai_butir TEXT NOT NULL DEFAULT '',
  dibuat_pada TEXT NOT NULL,
  dihapus_pada TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS aleta_putusan_jadwal_jejak (
  id TEXT PRIMARY KEY,
  jadwal_id TEXT NOT NULL DEFAULT '',
  butir_id TEXT NOT NULL DEFAULT '',
  nomor_perkara TEXT NOT NULL DEFAULT '',
  waktu TEXT NOT NULL,
  peristiwa TEXT NOT NULL,
  pelaku TEXT NOT NULL DEFAULT '',
  pelaku_id TEXT NOT NULL DEFAULT '',
  akun_sipp TEXT NOT NULL DEFAULT '',
  hasil TEXT NOT NULL DEFAULT '',
  ringkas TEXT NOT NULL DEFAULT '',
  rinci_json TEXT NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_putusan_jadwal_pembuat ON aleta_putusan_jadwal(dibuat_oleh, dibuat_pada);

CREATE INDEX IF NOT EXISTS idx_putusan_jadwal_butir_giliran ON aleta_putusan_jadwal_butir(status, waktu_rencana);

CREATE INDEX IF NOT EXISTS idx_putusan_jadwal_butir_pemilik ON aleta_putusan_jadwal_butir(pemilik_id, status);

CREATE INDEX IF NOT EXISTS idx_putusan_jadwal_butir_jadwal ON aleta_putusan_jadwal_butir(jadwal_id, urut);

CREATE INDEX IF NOT EXISTS idx_putusan_jadwal_butir_perkara ON aleta_putusan_jadwal_butir(perkara_id, status);

CREATE INDEX IF NOT EXISTS idx_putusan_jadwal_berkas_pemilik ON aleta_putusan_jadwal_berkas(pemilik_id, dibuat_pada);

CREATE INDEX IF NOT EXISTS idx_putusan_jadwal_jejak_butir ON aleta_putusan_jadwal_jejak(butir_id, waktu);

CREATE INDEX IF NOT EXISTS idx_putusan_jadwal_jejak_waktu ON aleta_putusan_jadwal_jejak(waktu);
