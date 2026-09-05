-- =============================================================================
-- Lapisan AI (I1-I5).
--
-- =============================================================================
-- YANG DISIMPAN ADALAH BUKTI, BUKAN KENYAMANAN
-- =============================================================================
--
-- Tiga tabel di sini ada bukan supaya percakapan enak dilanjutkan, melainkan
-- supaya pertanyaan berikut dapat dijawab bertahun kemudian:
--
--   Kalimat ini datang dari mana - pustaka atau model?
--   Kalau dari model: apa yang dikirim keluar gedung untuk mendapatkannya?
--   Fakta ini ditarik dari kalimat mana di berkas aslinya?
--
-- Ketiganya tidak dapat dijawab dari naskah jadinya. Naskah jadi terlihat
-- sama persis apa pun asalnya - itulah sebabnya asalnya harus dicatat di luar
-- naskah.
--
-- =============================================================================
-- FAKTA TERTARIK SELALU MEMBAWA KUTIPANNYA
-- =============================================================================
--
-- aleta_ai_fakta.kutipan berisi kalimat asal, disalin dari naskah sumber.
-- Kolom itu bukan hiasan: fakta tanpa kutipan tidak dapat diperiksa, dan
-- fakta yang tidak dapat diperiksa tidak boleh masuk berkas. Penarik menolak
-- fakta yang kutipannya tidak ditemukan di naskah, jadi baris di tabel ini
-- SELALU punya isi - kolomnya dibuat NOT NULL supaya begitu terus.
--
-- =============================================================================
-- KIRIMAN KELUAR DICATAT RUASNYA, BUKAN ISINYA
-- =============================================================================
--
-- aleta_ai_pesan.ruas_dikirim menyimpan NAMA ruas yang keluar, bukan nilainya.
-- Menyimpan nilainya berarti membuat salinan kedua data pribadi yang justru
-- sedang dijaga - dan salinan itu berada di tabel yang lebih mudah dibaca
-- daripada berkas aslinya.
--
-- Yang perlu dijawab kelak adalah "ruas apa saja yang pernah keluar", dan
-- nama ruas sudah cukup menjawabnya.
-- =============================================================================

-- Percakapan yang tahu perkara mana yang terbuka (I3).
CREATE TABLE IF NOT EXISTS aleta_ai_percakapan (
  id TEXT PRIMARY KEY,
  perkara_id TEXT NOT NULL DEFAULT '',
  nomor_perkara TEXT NOT NULL DEFAULT '',
  judul TEXT NOT NULL DEFAULT '',
  dibuat_oleh TEXT NOT NULL DEFAULT '',
  dibuat_at TEXT NOT NULL,
  diubah_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS aleta_ai_pesan (
  id TEXT PRIMARY KEY,
  percakapan_id TEXT NOT NULL,
  urutan INTEGER NOT NULL DEFAULT 0,
  peran TEXT NOT NULL DEFAULT 'pemakai' CHECK (peran IN ('pemakai', 'sistem')),
  isi TEXT NOT NULL DEFAULT '',
  -- Siapa yang menjawab: pustaka, berkas, model, atau tidak dijawab.
  -- Tidak berbawaan 'model': jawaban tanpa asal yang diam-diam terbaca sebagai
  -- model akan membuat jawaban pustaka ikut dicurigai, dan sebaliknya.
  dijawab_oleh TEXT NOT NULL DEFAULT '',
  -- Jawaban ini usulan, bukan pendirian. Selalu 1 untuk model.
  usulan INTEGER NOT NULL DEFAULT 1,
  rujukan TEXT NOT NULL DEFAULT '[]',
  peringatan TEXT NOT NULL DEFAULT '[]',
  -- NAMA ruas yang keluar gedung, bukan nilainya.
  ruas_dikirim TEXT NOT NULL DEFAULT '[]',
  ruas_ditahan TEXT NOT NULL DEFAULT '[]',
  penyedia TEXT NOT NULL DEFAULT '',
  model TEXT NOT NULL DEFAULT '',
  dibuat_at TEXT NOT NULL
);

-- Fakta yang ditarik dari naskah tak berpola (I1).
CREATE TABLE IF NOT EXISTS aleta_ai_fakta (
  id TEXT PRIMARY KEY,
  perkara_id TEXT NOT NULL,
  sumber_berkas TEXT NOT NULL DEFAULT '',
  nama TEXT NOT NULL,
  jenis TEXT NOT NULL DEFAULT 'lainnya',
  nilai TEXT NOT NULL DEFAULT '',
  -- Kalimat asal, disalin persis. Tanpa ini fakta tidak dapat diperiksa.
  kutipan TEXT NOT NULL,
  halaman INTEGER NOT NULL DEFAULT 0,
  -- Ditegaskan manusia. Sebelum itu, fakta ini hanya bacaan model.
  disahkan INTEGER NOT NULL DEFAULT 0,
  disahkan_oleh TEXT NOT NULL DEFAULT '',
  disahkan_at TEXT NOT NULL DEFAULT '',
  ditarik_oleh TEXT NOT NULL DEFAULT '',
  penyedia TEXT NOT NULL DEFAULT '',
  model TEXT NOT NULL DEFAULT '',
  dibuat_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ai_percakapan_perkara ON aleta_ai_percakapan(perkara_id, diubah_at);
CREATE INDEX IF NOT EXISTS idx_ai_pesan_percakapan ON aleta_ai_pesan(percakapan_id, urutan);
CREATE INDEX IF NOT EXISTS idx_ai_fakta_perkara ON aleta_ai_fakta(perkara_id, nama);
CREATE INDEX IF NOT EXISTS idx_ai_fakta_disahkan ON aleta_ai_fakta(perkara_id, disahkan);
