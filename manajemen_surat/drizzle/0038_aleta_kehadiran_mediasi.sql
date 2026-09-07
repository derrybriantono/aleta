-- =============================================================================
-- Kehadiran pertemuan mediasi.
--
-- =============================================================================
-- KENAPA DICATAT DI ALETA, BUKAN DIBACA DARI SIPP
-- =============================================================================
--
-- SIPP menyimpan kehadiran mediasi sebagai SATU ruas bebas pada
-- perkara_jadwal_mediasi - "dihadiri 1", "dihadiri 2", kadang kalimat. Ruas itu
-- tidak mengatakan SIAPA yang hadir, dan mediasi justru menuntut jawaban itu:
--
--   PERMA 1/2016 Pasal 7 ayat (1) menuntut para pihak menghadiri mediasi
--   SECARA LANGSUNG. Kuasa hukum yang hadir sendirian TIDAK memenuhi syarat
--   itu kecuali pada keadaan yang disebut Pasal 7 ayat (2).
--
-- Angka "dihadiri 2" karena itu dapat berarti dua keadaan yang akibat hukumnya
-- berlawanan: dua pihak hadir sendiri, atau dua kuasa hadir tanpa pihaknya.
-- Yang pertama sah; yang kedua dapat berujung pada pihak dinyatakan tidak
-- beriktikad baik menurut Pasal 6.
--
-- ALETA karena itu mencatat kehadiran menurut EMPAT kedudukan yang terpisah -
-- penggugat, tergugat, kuasa penggugat, kuasa tergugat - dan tidak pernah
-- menyimpulkannya menjadi satu angka.
--
-- =============================================================================
-- SIPP TIDAK DISENTUH
-- =============================================================================
--
-- Tabel ini milik ALETA sepenuhnya. Sambungan ke SIPP tetap hanya baca, dan
-- catatan ini tidak pernah ditulis balik ke sana. Yang menyambungkan keduanya
-- hanya mediasi_id dan perkara_id - keduanya disalin, bukan dijadikan kunci
-- asing, karena SIPP berada di basis data yang lain sama sekali.
--
-- =============================================================================
-- SATU BARIS PER PERTEMUAN PER KEDUDUKAN
-- =============================================================================
--
-- Bukan satu baris per pertemuan dengan empat kolom. Sebabnya: tiap kehadiran
-- membawa keterangannya sendiri - nama yang hadir, dan alasan bila tidak - dan
-- empat kolom memaksa keempatnya berbagi satu ruas alasan.
--
-- Bentuk ini juga membuat kedudukan baru - turut tergugat, misalnya - cukup
-- ditambahkan sebagai nilai, bukan sebagai kolom.
-- =============================================================================

CREATE TABLE IF NOT EXISTS aleta_kehadiran_mediasi (
  id TEXT PRIMARY KEY,
  -- Penunjuk ke SIPP. Disalin, bukan kunci asing: SIPP basis data terpisah.
  mediasi_id TEXT NOT NULL,
  perkara_id TEXT NOT NULL DEFAULT '',
  nomor_perkara TEXT NOT NULL DEFAULT '',
  -- Tanggal pertemuan yang dicatat kehadirannya. Satu mediasi dapat
  -- berlangsung beberapa pertemuan, dan kehadirannya berbeda tiap kali.
  tanggal_pertemuan TEXT NOT NULL DEFAULT '',
  -- 'penggugat' | 'tergugat' | 'kuasa_penggugat' | 'kuasa_tergugat'.
  -- Disimpan sebagai teks, bukan angka: nilai baru cukup ditambahkan tanpa
  -- migrasi, dan barisnya terbaca sendiri saat basis datanya dibuka langsung.
  kedudukan TEXT NOT NULL,
  hadir INTEGER NOT NULL DEFAULT 0,
  -- Nama yang benar-benar hadir. Berguna justru saat dipersoalkan: kuasa yang
  -- hadir belum tentu kuasa yang namanya tercatat pada surat kuasa.
  nama TEXT NOT NULL DEFAULT '',
  -- Alasan tidak hadir. Kosong bila hadir - dan itu bukan kelalaian pencatatan.
  alasan TEXT NOT NULL DEFAULT '',
  catatan TEXT NOT NULL DEFAULT '',
  dicatat_oleh TEXT NOT NULL DEFAULT '',
  dicatat_at TEXT NOT NULL,
  diperbarui_at TEXT NOT NULL DEFAULT ''
);

-- Satu kedudukan hanya boleh punya SATU catatan per pertemuan. Tanpa ini,
-- menekan simpan dua kali menghasilkan dua baris yang saling bertentangan, dan
-- tidak ada cara menentukan mana yang benar.
CREATE UNIQUE INDEX IF NOT EXISTS idx_kehadiran_mediasi_kunci
  ON aleta_kehadiran_mediasi(mediasi_id, tanggal_pertemuan, kedudukan);

CREATE INDEX IF NOT EXISTS idx_kehadiran_mediasi_perkara
  ON aleta_kehadiran_mediasi(perkara_id);

CREATE INDEX IF NOT EXISTS idx_kehadiran_mediasi_nomor
  ON aleta_kehadiran_mediasi(nomor_perkara);
