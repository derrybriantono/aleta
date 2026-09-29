-- =============================================================================
-- TAMPILAN EKSTENSI YANG DITERAPKAN, DAN SETELAN PRIBADI EKSTENSI
-- =============================================================================
--
-- Tahap 5 rencana "ekstensi dulu" (29 September 2026). Sampai ekstensi 1.172.0
-- pengalih tampilan (Lama / Baru / UI Baru) dan 120 saklar fitur hanya hidup
-- di PC Super Admin yang mencobanya - chrome.storage.local, bukan milik siapa
-- pun selain peramban itu. Tabel pertama membuat pilihan itu dapat DITERAPKAN
-- kepada pegawai lain: semua, per peran, atau per orang.
--
-- Aksesnya HANYA lewat src/server/modules/aleta-ecourt/tampilan-ekstensi.ts;
-- tidak ada SQL ke kedua tabel ini di luar modul itu.
--
-- =============================================================================
-- SATU BARIS PER SASARAN, TIGA LINGKUP
-- =============================================================================
--
--   lingkup 'semua'     sasaran ''              berlaku bagi setiap pegawai
--   lingkup 'peran'     sasaran = roles.id      berlaku bagi pemegang peran itu
--   lingkup 'pengguna'  sasaran = users.id      berlaku bagi satu orang
--
-- Yang berlaku bagi seseorang: pengguna > peran > semua > bawaan 'lama'.
-- Aturannya fungsi murni di modul di atas (pecahkanTampilan), bukan di SQL.
--
-- Tidak ada kunci asing ke roles/users: sasaran berarti tabel yang berbeda
-- menurut lingkupnya. Penyimpanannya memeriksa sasaran itu ada; baris yang
-- sasarannya kemudian hilang tidak cocok dengan siapa pun dan diam saja.
--
-- =============================================================================
-- FITUR - HANYA KODE YANG DIKENAL, HANYA YANG MENYALA
-- =============================================================================
--
-- fitur adalah JSON {kode: true} untuk kode dari src/lib/daftar-fitur-ekstensi.ts
-- (cermin ekstensi-sipp/daftar-fitur.js, dijaga uji). Kode yang tidak dikenal
-- dibuang saat disimpan DAN saat dibaca - daftar dapat menyusut, dan kode yatim
-- tidak boleh menyala diam-diam bila kelak dipakai lagi untuk arti lain.
--
-- =============================================================================
-- SETELAN PRIBADI - DAFTAR PUTIH, BUKAN PENYIMPANAN BEBAS
-- =============================================================================
--
-- aleta_ekstensi_setelan menyimpan setelan ekstensi MILIK SATU ORANG: tanda
-- Selesai/Tunda checklist, urutan pintasan portal, dan pengaturan ekstensi
-- yang ikut ke PC mana pun ia masuk. Kunci yang boleh disimpan dibatasi
-- daftar putih di modul (KUNCI_SETELAN); kredensial, token, dan sesi tidak
-- pernah ada di daftar itu. nilai berupa teks JSON yang sudah dinormalkan dan
-- dibatasi ukurannya.
--
-- Waktu disimpan sebagai TEXT ISO, mengikuti aleta_tipe_keluaran.
--
-- TIGA TEMPAT PENDAFTARAN, semuanya wajib (yang terlewat gagal diam-diam):
--   (a) berkas ini dan entrinya di meta/_journal.json;
--   (b) DDL yang sama di src/server/db/schema.ts (DDL_EKSTENSI_TAMPILAN) -
--       pg-mem dan mode cadangan tidak menjalankan berkas drizzle/*.sql;
--   (c) kedua tabel di IN_MEMORY_TABLE_PERSISTENCE_ORDER (client.ts).
-- Kesamaan (a) dan (b) dijaga src/test/tampilan-ekstensi-skema.test.ts.
-- =============================================================================

CREATE TABLE IF NOT EXISTS aleta_ekstensi_tampilan (
  lingkup TEXT NOT NULL CHECK (lingkup IN ('semua', 'peran', 'pengguna')),
  sasaran TEXT NOT NULL DEFAULT '',
  mode TEXT NOT NULL CHECK (mode IN ('lama', 'baru', 'ui')),
  fitur TEXT NOT NULL DEFAULT '{}',
  catatan TEXT NOT NULL DEFAULT '',
  diubah_oleh TEXT NOT NULL,
  diubah_pada TEXT NOT NULL,
  PRIMARY KEY (lingkup, sasaran),
  CHECK ((lingkup = 'semua' AND sasaran = '') OR (lingkup <> 'semua' AND sasaran <> ''))
);

CREATE TABLE IF NOT EXISTS aleta_ekstensi_setelan (
  pengguna_id TEXT NOT NULL,
  kunci TEXT NOT NULL,
  nilai TEXT NOT NULL,
  diubah_pada TEXT NOT NULL,
  PRIMARY KEY (pengguna_id, kunci)
);
