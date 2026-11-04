-- =============================================================================
-- CERMIN JADWAL SIDANG & MEDIASI LENGKAP (5 Nov 2026) - terhapus lembut, kolom yang dapat dicari, arsip antrian
-- =============================================================================
--
-- Permintaan Derry: database sendiri yang LENGKAP untuk jadwal sidang dan jadwal mediasi di database ALETA,
-- sementara jadwal sidang tetap sinkron dengan database antrian sidang seperti sekarang. Cermin Perkara (0090)
-- sudah menyimpan sidang dan mediasi; berkas ini hanya MENAMBAH kolom pada dua tabelnya, tanpa tabel baru
-- dan tanpa mengubah satu pun kolom yang ada.
--
--   terhapus_at      '' = ada di SIPP. Terisi (ISO UTC) = hilang dari SIPP (dihapus/dipindah/perkaranya hilang);
--                    barisnya TIDAK di-DELETE dan hidup lagi (terhapus_at = '') bila SIPP memilikinya kembali.
--                    Semua pembaca cermin menyaring terhapus_at = '' supaya layar tidak berubah.
--   kolom_diisi      0 = baris lama yang kolom bawahnya belum diisi (diisi dari baris_json oleh latar, atau
--                    saat pemindaian/pembaruan berikutnya menulis ulang barisnya); 1 = sudah.
--   sidang           nomor_perkara, jenis_perkara, alasan_tunda (alasan_ditunda SIPP; berisi hasil bila diputus),
--                    dihadiri_oleh (1 semua pihak, 2 penggugat, 3 tergugat, 4 tidak hadir; NULL = tidak diisi),
--                    urutan_sidang (perkara_jadwal_sidang.urutan), sidang_keliling, sidang_ikrar, ada_bas.
--   mediasi          nomor_perkara, jenis_perkara, tempat, ditunda, dihadiri, status_mediator, jenis_mediasi,
--                    nomor_sk, penetapan_mediator, laporan_mediator, hasil, hasil_teks (mediator & status sudah ada).
--   antrian_*        arsip antrian dari sipp_turunan_antrian (hanya SELECT): nomor, disidang, keadaan, jam ambil,
--                    jam hadir terakhir, dan waktu baca. HANYA ARSIP dan bahan jawaban darurat - layar tetap
--                    membaca antrian langsung.
--
-- Hanya TAMBAH (ADD COLUMN IF NOT EXISTS / CREATE INDEX IF NOT EXISTS): aman diulang di Postgres produksi.
-- Nilai bawaan membuat baris lama tetap sah; tidak ada backfill di sini (dikerjakan portal di latar, per kelompok).
--
-- NOMOR: 0134, jurnal idx 116 (klaim koordinator 5 Nov 2026). TIGA TEMPAT: (a) berkas ini + meta/_journal.json;
-- (b) DDL_ALETA_CERMIN_JADWAL_LENGKAP di src/server/db/schema.ts (kolom di migrationStatements, indeks di
-- indexStatements); (c) tidak ada tabel baru, jadi daftar cadangan di db/client.ts tetap.
-- =============================================================================

ALTER TABLE aleta_cermin_sidang ADD COLUMN IF NOT EXISTS terhapus_at TEXT NOT NULL DEFAULT '';
ALTER TABLE aleta_cermin_sidang ADD COLUMN IF NOT EXISTS kolom_diisi INTEGER NOT NULL DEFAULT 0;
ALTER TABLE aleta_cermin_sidang ADD COLUMN IF NOT EXISTS nomor_perkara TEXT NOT NULL DEFAULT '';
ALTER TABLE aleta_cermin_sidang ADD COLUMN IF NOT EXISTS jenis_perkara TEXT NOT NULL DEFAULT '';
ALTER TABLE aleta_cermin_sidang ADD COLUMN IF NOT EXISTS alasan_tunda TEXT NOT NULL DEFAULT '';
ALTER TABLE aleta_cermin_sidang ADD COLUMN IF NOT EXISTS dihadiri_oleh INTEGER;
ALTER TABLE aleta_cermin_sidang ADD COLUMN IF NOT EXISTS urutan_sidang INTEGER NOT NULL DEFAULT 0;
ALTER TABLE aleta_cermin_sidang ADD COLUMN IF NOT EXISTS sidang_keliling INTEGER NOT NULL DEFAULT 0;
ALTER TABLE aleta_cermin_sidang ADD COLUMN IF NOT EXISTS sidang_ikrar INTEGER NOT NULL DEFAULT 0;
ALTER TABLE aleta_cermin_sidang ADD COLUMN IF NOT EXISTS ada_bas INTEGER NOT NULL DEFAULT 0;
ALTER TABLE aleta_cermin_sidang ADD COLUMN IF NOT EXISTS antrian_nomor INTEGER;
ALTER TABLE aleta_cermin_sidang ADD COLUMN IF NOT EXISTS antrian_disidang INTEGER;
ALTER TABLE aleta_cermin_sidang ADD COLUMN IF NOT EXISTS antrian_keadaan TEXT NOT NULL DEFAULT '';
ALTER TABLE aleta_cermin_sidang ADD COLUMN IF NOT EXISTS antrian_jam_ambil TEXT NOT NULL DEFAULT '';
ALTER TABLE aleta_cermin_sidang ADD COLUMN IF NOT EXISTS antrian_jam_hadir TEXT NOT NULL DEFAULT '';
ALTER TABLE aleta_cermin_sidang ADD COLUMN IF NOT EXISTS antrian_dibaca_at TEXT NOT NULL DEFAULT '';
ALTER TABLE aleta_cermin_mediasi ADD COLUMN IF NOT EXISTS terhapus_at TEXT NOT NULL DEFAULT '';
ALTER TABLE aleta_cermin_mediasi ADD COLUMN IF NOT EXISTS kolom_diisi INTEGER NOT NULL DEFAULT 0;
ALTER TABLE aleta_cermin_mediasi ADD COLUMN IF NOT EXISTS nomor_perkara TEXT NOT NULL DEFAULT '';
ALTER TABLE aleta_cermin_mediasi ADD COLUMN IF NOT EXISTS jenis_perkara TEXT NOT NULL DEFAULT '';
ALTER TABLE aleta_cermin_mediasi ADD COLUMN IF NOT EXISTS tempat TEXT NOT NULL DEFAULT '';
ALTER TABLE aleta_cermin_mediasi ADD COLUMN IF NOT EXISTS ditunda INTEGER NOT NULL DEFAULT 0;
ALTER TABLE aleta_cermin_mediasi ADD COLUMN IF NOT EXISTS dihadiri TEXT NOT NULL DEFAULT '';
ALTER TABLE aleta_cermin_mediasi ADD COLUMN IF NOT EXISTS status_mediator TEXT NOT NULL DEFAULT '';
ALTER TABLE aleta_cermin_mediasi ADD COLUMN IF NOT EXISTS jenis_mediasi TEXT NOT NULL DEFAULT '';
ALTER TABLE aleta_cermin_mediasi ADD COLUMN IF NOT EXISTS nomor_sk TEXT NOT NULL DEFAULT '';
ALTER TABLE aleta_cermin_mediasi ADD COLUMN IF NOT EXISTS penetapan_mediator TEXT NOT NULL DEFAULT '';
ALTER TABLE aleta_cermin_mediasi ADD COLUMN IF NOT EXISTS laporan_mediator TEXT NOT NULL DEFAULT '';
ALTER TABLE aleta_cermin_mediasi ADD COLUMN IF NOT EXISTS hasil TEXT NOT NULL DEFAULT '';
ALTER TABLE aleta_cermin_mediasi ADD COLUMN IF NOT EXISTS hasil_teks TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_cermin_sidang_nomor ON aleta_cermin_sidang(nomor_perkara);
CREATE INDEX IF NOT EXISTS idx_cermin_sidang_terhapus ON aleta_cermin_sidang(terhapus_at, tanggal_sidang);
CREATE INDEX IF NOT EXISTS idx_cermin_mediasi_nomor ON aleta_cermin_mediasi(nomor_perkara);
CREATE INDEX IF NOT EXISTS idx_cermin_mediasi_terhapus ON aleta_cermin_mediasi(terhapus_at, tanggal);
