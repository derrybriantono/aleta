-- =============================================================================
-- Mutu, biaya, dan perluasan (K1-K7).
--
-- =============================================================================
-- BIAYA DICATAT PER PANGGILAN, BUKAN DIJUMLAH SAAT DIBACA
-- =============================================================================
--
-- Menjumlahkan biaya saat laporan dibuka menuntut tarif yang berlaku HARI INI
-- dipakai atas panggilan yang terjadi bulan lalu. Tarif penyedia berubah, dan
-- laporan yang dihitung ulang dengan tarif baru akan berubah angkanya sendiri
-- tanpa satu pun panggilan bertambah - lalu tidak ada yang dapat menjelaskan
-- mengapa biaya Agustus hari ini berbeda dari biaya Agustus kemarin.
--
-- Karena itu rupiahnya dihitung sekali, saat panggilannya terjadi, dengan
-- tarif yang berlaku saat itu - dan disimpan sebagai angka.
--
-- =============================================================================
-- PAGU HABIS TIDAK MENGHENTIKAN PENGADILAN
-- =============================================================================
--
-- Pagu yang menghentikan segalanya akan dinaikkan sampai tidak pernah habis,
-- yang sama saja dengan tidak ada pagu. Di sini pagu habis mengembalikan
-- ALETA ke keadaan PUSTAKA SAJA: draf tetap dirakit, pemeriksaan tetap
-- berjalan, hanya penyusunan alinea baru yang berhenti.
--
-- Itu dapat ditanggung justru karena I5 membuat pustaka lebih dulu sejak awal.
--
-- =============================================================================
-- SUMBER BARU MENDAFTARKAN RUASNYA, BUKAN HANYA SAMBUNGANNYA
-- =============================================================================
--
-- J5 memperlakukan ruas tak dikenal sebagai terlarang. Sumber yang tersambung
-- tanpa mendaftarkan ruasnya akan berjalan tetapi tidak satu pun datanya dapat
-- dipakai - dan kegagalannya terlihat seperti kerusakan sambungan, bukan
-- seperti pendaftaran yang belum lengkap.
-- =============================================================================

-- Satu baris per panggilan model. Rupiahnya sudah dihitung saat dicatat.
CREATE TABLE IF NOT EXISTS aleta_ai_pemakaian (
  id TEXT PRIMARY KEY,
  -- 'tarikFakta', 'percakapan', 'susunPertimbangan'.
  pekerjaan TEXT NOT NULL DEFAULT '',
  -- 'hemat' atau 'kuat' - K3 memilihnya menurut pekerjaannya.
  tingkat TEXT NOT NULL DEFAULT 'hemat',
  penyedia TEXT NOT NULL DEFAULT '',
  model TEXT NOT NULL DEFAULT '',
  token_masuk INTEGER NOT NULL DEFAULT 0,
  token_keluar INTEGER NOT NULL DEFAULT 0,
  -- Tarif yang berlaku SAAT panggilan, disimpan supaya angkanya dapat
  -- diperiksa ulang bertahun kemudian.
  tarif_masuk_per_juta REAL NOT NULL DEFAULT 0,
  tarif_keluar_per_juta REAL NOT NULL DEFAULT 0,
  biaya_rupiah REAL NOT NULL DEFAULT 0,
  berhasil INTEGER NOT NULL DEFAULT 1,
  perkara_id TEXT NOT NULL DEFAULT '',
  oleh TEXT NOT NULL DEFAULT '',
  -- 'YYYY-MM', dipakai menjumlah pemakaian bulan berjalan tanpa mengurai tanggal.
  bulan TEXT NOT NULL DEFAULT '',
  dibuat_at TEXT NOT NULL
);

-- Pagu per bulan. Satu baris per bulan supaya perubahan pagu di tengah bulan
-- tidak menghapus jejak pagu sebelumnya.
CREATE TABLE IF NOT EXISTS aleta_ai_pagu (
  id TEXT PRIMARY KEY,
  bulan TEXT NOT NULL,
  pagu_rupiah REAL NOT NULL DEFAULT 0,
  diputuskan_oleh TEXT NOT NULL DEFAULT '',
  atas_perintah TEXT NOT NULL DEFAULT '',
  catatan TEXT NOT NULL DEFAULT '',
  dibuat_at TEXT NOT NULL,
  diubah_at TEXT NOT NULL
);

-- Sumber data selain SIPP dan APS Badilag (K7).
CREATE TABLE IF NOT EXISTS aleta_sumber_aplikasi (
  id TEXT PRIMARY KEY,
  kode TEXT NOT NULL,
  nama TEXT NOT NULL DEFAULT '',
  asal TEXT NOT NULL DEFAULT '',
  -- Selalu 1. Kolomnya ada supaya pelanggarannya terlihat di data, bukan
  -- hanya tertahan di pemeriksa.
  hanya_baca INTEGER NOT NULL DEFAULT 1,
  umur_wajar_jam INTEGER NOT NULL DEFAULT 0,
  -- Ruas beserta batas keluarnya, JSON.
  ruas TEXT NOT NULL DEFAULT '[]',
  aktif INTEGER NOT NULL DEFAULT 0,
  didaftarkan_oleh TEXT NOT NULL DEFAULT '',
  atas_perintah TEXT NOT NULL DEFAULT '',
  dibuat_at TEXT NOT NULL,
  diubah_at TEXT NOT NULL
);

-- Pemeriksaan keajekan berkala (K6): kapan terakhir dijalankan dan apa hasilnya.
CREATE TABLE IF NOT EXISTS aleta_keajekan_jalan (
  id TEXT PRIMARY KEY,
  dijalankan_at TEXT NOT NULL,
  dijalankan_oleh TEXT NOT NULL DEFAULT '',
  jumlah_perkara INTEGER NOT NULL DEFAULT 0,
  jumlah_berubah INTEGER NOT NULL DEFAULT 0,
  jumlah_galat INTEGER NOT NULL DEFAULT 0,
  -- Ringkasan perubahan yang ditemukan, JSON.
  temuan TEXT NOT NULL DEFAULT '[]',
  selesai_at TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_ai_pemakaian_bulan ON aleta_ai_pemakaian(bulan, pekerjaan);
CREATE INDEX IF NOT EXISTS idx_ai_pemakaian_perkara ON aleta_ai_pemakaian(perkara_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_pagu_bulan ON aleta_ai_pagu(bulan);
CREATE UNIQUE INDEX IF NOT EXISTS idx_sumber_aplikasi_kode ON aleta_sumber_aplikasi(kode);
CREATE INDEX IF NOT EXISTS idx_keajekan_jalan_waktu ON aleta_keajekan_jalan(dijalankan_at);

-- Tarif per model. Terpisah dari ai_providers karena tarif berubah tanpa
-- sambungannya berubah, dan riwayat perubahannya perlu terbaca.
--
-- Tanpa baris di sini, biaya tiap panggilan terhitung NOL - dan pagu yang
-- selalu nol tidak pernah memperingatkan apa pun. Karena itu laporan biaya
-- menyebutkan secara terpisah bila ada panggilan yang tarifnya belum disetel,
-- alih-alih menampilkan Rp 0 yang terbaca seperti hemat.
CREATE TABLE IF NOT EXISTS aleta_ai_tarif (
  id TEXT PRIMARY KEY,
  model TEXT NOT NULL,
  tarif_masuk_per_juta REAL NOT NULL DEFAULT 0,
  tarif_keluar_per_juta REAL NOT NULL DEFAULT 0,
  mata_uang TEXT NOT NULL DEFAULT 'IDR',
  disetel_oleh TEXT NOT NULL DEFAULT '',
  dibuat_at TEXT NOT NULL,
  diubah_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_tarif_model ON aleta_ai_tarif(model);
