-- =============================================================================
-- CHECKLIST KONSEPTOR SEMENTARA (F1.6, 17 Oktober 2026)
-- =============================================================================
--
-- Langkah penyusunan draf putusan per perkara yang konseptornya ditunjuk
-- lewat Konseptor Sementara (0046): duduk perkara, bukti, saksi, kesimpulan,
-- pertimbangan, amar, biaya, dikoreksi majelis. Katalog langkahnya di
-- src/lib/konseptor-langkah.ts, bukan di sini - basis data hanya menyimpan
-- tanda dan laporan.
--
-- aleta_konseptor_langkah   tanda selesai per langkah: siapa dan kapan
--                           (perubahan terakhir; mencabut centang juga
--                           tercatat siapa dan kapan).
-- aleta_konseptor_blangko   laporan terakhir Blangko ABT by Derry Briantono
--                           untuk blangko PUTUSAN perkara itu: isian yang
--                           terisi/kosong per langkah (JSON). Isian kosong
--                           membuat langkahnya belum selesai walau dicentang.
--
-- Keduanya TIDAK dihapus ketika tunjukan konseptornya dicabut atau ketika
-- SIPP sudah menyebut konseptornya - pekerjaan yang sudah dicentang tetap
-- pekerjaan yang sudah dikerjakan.
--
-- NOMOR: 0067 (idx 64) diklaim 17 Okt 2026 oleh agen F1.6 (branch fitur-f16
-- dari claude/determined-feistel-87dd93). Lihat memori migrasi-0039-diklaim.
--
-- TIGA TEMPAT PENDAFTARAN, semuanya wajib (yang terlewat gagal diam-diam):
--   (a) berkas ini dan entrinya di meta/_journal.json;
--   (b) DDL yang sama di src/server/db/schema.ts (DDL_KONSEPTOR_LANGKAH);
--   (c) tabelnya di IN_MEMORY_TABLE_PERSISTENCE_ORDER (db/client.ts).
-- Kesamaan (a) dan (b) dijaga src/test/konseptor-langkah-f16.test.ts.
-- =============================================================================

CREATE TABLE IF NOT EXISTS aleta_konseptor_langkah (
  perkara_id TEXT NOT NULL,
  langkah TEXT NOT NULL,
  selesai INTEGER NOT NULL DEFAULT 0,
  catatan TEXT NOT NULL DEFAULT '',
  oleh TEXT NOT NULL DEFAULT '',
  pada TEXT NOT NULL,
  PRIMARY KEY (perkara_id, langkah)
);

CREATE TABLE IF NOT EXISTS aleta_konseptor_blangko (
  perkara_id TEXT PRIMARY KEY,
  nomor_perkara TEXT NOT NULL DEFAULT '',
  berkas TEXT NOT NULL DEFAULT '',
  terisi INTEGER NOT NULL DEFAULT 0,
  jumlah INTEGER NOT NULL DEFAULT 0,
  per_langkah TEXT NOT NULL DEFAULT '{}',
  oleh TEXT NOT NULL DEFAULT '',
  pada TEXT NOT NULL
);
