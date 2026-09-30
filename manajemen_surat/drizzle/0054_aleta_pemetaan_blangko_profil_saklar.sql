-- =============================================================================
-- PEMETAAN BLANGKO (PUTUSAN, RELAAS, PBT) DAN PROFIL SAKLAR PER PERAN
-- =============================================================================
--
-- Perbaikan 30 September 2026 (butir 16, 17, 25; kontrak K3 dan K4 di
-- D:/aleta-dev/kerja/perbaikan-30sep/KONTRAK.md). Dua tabel kecil yang dibaca
-- ekstensi dan disunting Super Admin / Admin dari menu Integrasi e-Court.
--
-- Akses tiap tabel HANYA lewat modulnya:
--   aleta_pemetaan_blangko  src/server/modules/aleta-ecourt/pemetaan-blangko.ts
--   aleta_profil_saklar     src/server/modules/aleta-ecourt/profil-saklar.ts
--
-- =============================================================================
-- aleta_pemetaan_blangko - NAMA BERKAS BLANGKO PER KEADAAN
-- =============================================================================
--
-- Sampai ekstensi 1.174.1 peta "jenis perkara -> blangko putusan ABT" hanya
-- hidup di chrome.storage satu peramban (petaBlangkoPutusan). Tabel ini
-- menjadikannya milik satker: satu baris per (jenis, kunci).
--
--   jenis 'putusan'  kunci = jenis perkara ("Cerai Gugat", "Cerai Talak", ...)
--   jenis 'relaas'   kunci = "panggilan-penggugat" | "panggilan-tergugat" |
--                    "panggilan-pemohon" | "panggilan-termohon" |
--                    "panggilan-ikrar" | kunci bebas lain
--   jenis 'pbt'      kunci = "pbt-penggugat" | "pbt-tergugat" | ... bebas
--
-- nama_berkas adalah nama blangko sebagaimana tertulis di ABT; ALETA tidak
-- memeriksa keberadaannya (daftar blangko ABT hanya terbaca di peramban yang
-- masuk ABT). sebutan adalah tulisan untuk layar - kosong berarti modul
-- memakai sebutan bawaan kuncinya. Baris dengan nama_berkas kosong tidak
-- disimpan: mengosongkan nama = menghapus pemetaannya.
--
-- =============================================================================
-- aleta_profil_saklar - SAKLAR EKSTENSI YANG DIPEGANG PERAN
-- =============================================================================
--
-- Satu baris per peran (kunci profil: "hakim", "panitera-pengganti",
-- "juru-sita", "admin", "super-admin", atau id peran lain). saklar adalah
-- JSON {tandaiHalaman, sisipJadwal, cetakTigaBerkas, checklistMilestone,
-- suntingLangsungAbt, aktif?} berisi boolean saja; fitur adalah JSON
-- {kode: true} untuk kode dari src/lib/daftar-fitur-ekstensi.ts, atau NULL =
-- semua fitur boleh (tidak dibatasi). Kode yang tidak dikenal dibuang saat
-- disimpan dan saat dibaca, sama dengan aleta_ekstensi_tampilan.
--
-- Peran tanpa baris memakai profil bawaan dari kode (hakim, PP, juru sita)
-- atau tidak diatur sama sekali (saklar NULL di jawaban).
--
-- Waktu disimpan sebagai TEXT ISO, mengikuti 0050, 0052, dan 0053.
--
-- TIGA TEMPAT PENDAFTARAN, semuanya wajib (yang terlewat gagal diam-diam):
--   (a) berkas ini dan entrinya di meta/_journal.json;
--   (b) DDL yang sama di src/server/db/schema.ts (DDL_PEMETAAN_PROFIL);
--   (c) kedua tabel di IN_MEMORY_TABLE_PERSISTENCE_ORDER (client.ts).
-- Kesamaan (a) dan (b) dijaga src/test/pemetaan-profil-skema.test.ts.
-- =============================================================================

CREATE TABLE IF NOT EXISTS aleta_pemetaan_blangko (
  jenis TEXT NOT NULL CHECK (jenis IN ('putusan', 'relaas', 'pbt')),
  kunci TEXT NOT NULL,
  sebutan TEXT NOT NULL DEFAULT '',
  nama_berkas TEXT NOT NULL,
  catatan TEXT NOT NULL DEFAULT '',
  diubah_oleh TEXT NOT NULL,
  diubah_pada TEXT NOT NULL,
  PRIMARY KEY (jenis, kunci)
);

CREATE TABLE IF NOT EXISTS aleta_profil_saklar (
  peran TEXT PRIMARY KEY,
  saklar TEXT NOT NULL DEFAULT '{}',
  fitur TEXT,
  catatan TEXT NOT NULL DEFAULT '',
  diubah_oleh TEXT NOT NULL,
  diubah_pada TEXT NOT NULL
);
