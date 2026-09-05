-- =============================================================================
-- Antrean penetapan: menyerahkan pekerjaan, bukan menyerahkan akun.
--
-- =============================================================================
-- MASALAH YANG DIPECAHKAN
-- =============================================================================
--
-- Keempat penetapan dikerjakan pejabat yang berbeda:
--
--   PMH  Ketua Pengadilan
--   PPP  Panitera
--   PJS  Panitera
--   PHS  ketua majelis perkara itu
--
-- Selama ini satu operator mengerjakan keempatnya, dan untuk itu ia harus
-- masuk SIPP bergantian dengan empat akun. Akibatnya jejak SIPP mencatat
-- pejabatnya, tetapi yang menekan tombolnya orang lain - dan tidak ada satu
-- pun catatan yang menyebutkan itu.
--
-- =============================================================================
-- YANG TIDAK DIKERJAKAN TABEL INI
-- =============================================================================
--
-- Ia TIDAK menyimpan kata sandi siapa pun, TIDAK masuk atas nama siapa pun,
-- dan TIDAK menekan tombol atas nama siapa pun. Menyimpan kredensial pejabat
-- agar satu orang dapat bertindak sebagai empat orang akan menghapus satu-
-- satunya hal yang membuat penetapan dapat dipertanggungjawabkan.
--
-- Yang dikerjakan sebaliknya: usulan yang sudah disiapkan operator DITITIPKAN,
-- lalu muncul di panel pejabat yang berwenang begitu ia membuka SIPP dengan
-- akunnya sendiri - lengkap, tinggal diperiksa dan ditekan sekali.
--
-- Empat kali masuk-keluar akun berubah menjadi empat orang menekan sekali.
-- =============================================================================

CREATE TABLE IF NOT EXISTS aleta_sipp_penunjukan_antrean (
  id TEXT PRIMARY KEY,
  perkara_id TEXT NOT NULL,
  nomor_perkara TEXT NOT NULL,
  jenis TEXT NOT NULL CHECK (jenis IN ('pmh', 'ppp', 'pjs', 'phs')),

  -- Usulan yang sudah disiapkan, disimpan apa adanya sebagai JSON. Disimpan
  -- BEKU, bukan dihitung ulang saat dibuka pejabatnya: giliran juru sita
  -- bergeser tiap ada penetapan baru, dan usulan yang berubah diam-diam antara
  -- disiapkan dan dikerjakan adalah usulan yang tidak pernah diperiksa siapa
  -- pun dalam bentuk yang akhirnya tercatat.
  usulan TEXT NOT NULL DEFAULT '{}',

  -- Ringkasan yang dapat dibaca manusia tanpa membuka JSON-nya - dipakai
  -- daftar "menunggu Anda" supaya pejabatnya tahu isinya sebelum membuka
  -- perkaranya.
  ringkasan TEXT NOT NULL DEFAULT '',

  -- Jabatan yang berwenang mengerjakannya. Disimpan, bukan disimpulkan saat
  -- dibaca: aturan jabatan dapat berubah, dan antrean yang diteruskan hari ini
  -- harus tetap menunjuk pejabat yang sama besok.
  untuk_peran TEXT NOT NULL DEFAULT '',

  keadaan TEXT NOT NULL DEFAULT 'menunggu'
    CHECK (keadaan IN ('menunggu', 'dikerjakan', 'dibatalkan', 'kedaluwarsa')),

  disiapkan_oleh TEXT NOT NULL,
  disiapkan_at TEXT NOT NULL,
  catatan TEXT NOT NULL DEFAULT '',

  dikerjakan_oleh TEXT,
  dikerjakan_at TEXT,
  akun_sipp TEXT NOT NULL DEFAULT '',
  alasan_batal TEXT NOT NULL DEFAULT ''
);

-- Satu perkara hanya boleh punya SATU penerusan yang menunggu per jenis
-- penetapan. Tanpa ini, operator yang menekan Teruskan dua kali akan membuat
-- pejabatnya melihat dua baris yang sama dan mengerjakan keduanya.
CREATE UNIQUE INDEX IF NOT EXISTS idx_antrean_perkara_jenis_menunggu
  ON aleta_sipp_penunjukan_antrean (perkara_id, jenis)
  WHERE keadaan = 'menunggu';

-- Pertanyaan yang paling sering ditanya: "apa yang menunggu saya".
CREATE INDEX IF NOT EXISTS idx_antrean_peran_keadaan
  ON aleta_sipp_penunjukan_antrean (untuk_peran, keadaan);

CREATE INDEX IF NOT EXISTS idx_antrean_perkara
  ON aleta_sipp_penunjukan_antrean (perkara_id);
