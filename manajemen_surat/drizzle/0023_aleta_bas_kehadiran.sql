-- =============================================================================
-- Kehadiran sidang: siapa hadir, apa agendanya, apa hasilnya.
--
-- =============================================================================
-- MASALAH YANG DIPECAHKAN
-- =============================================================================
--
-- Blangko BAS menanyakan kehadiran para pihak pada penanda #1072# dan #1073#,
-- dan itu SATU-SATUNYA hal pada BAS pertama yang tidak dapat dibaca dari mana
-- pun: SIPP hanya mencatat "dihadiri oleh 2" sebagai angka, tanpa menyebut
-- siapa - Penggugat sendiri, kuasanya, atau keduanya.
--
-- Selama kehadiran belum tercatat, BAS sidang pertama tidak pernah dapat
-- selesai di ALETA betapapun lengkapnya bagian lain.
--
-- =============================================================================
-- SATU BARIS PER SIDANG, BUKAN PER PERKARA
-- =============================================================================
--
-- Kehadiran berubah dari satu sidang ke sidang berikutnya - itulah sebabnya ia
-- ada. Menyimpannya per perkara berarti BAS sidang kedua memuat kehadiran
-- sidang pertama, dan keterangan itu terbaca wajar sehingga tidak ada yang
-- memeriksanya.
--
-- =============================================================================
-- AGENDA DAN HASIL DISIMPAN MESKI SIPP JUGA MEMUATNYA
-- =============================================================================
--
-- SIPP mencatat agenda dan penundaan, dan itu yang dipakai lebih dulu. Kolom
-- di sini untuk keadaan yang BELUM tercatat di SIPP - sidang yang baru saja
-- berlangsung dan datanya belum diinput petugas. Yang tersimpan di sini tidak
-- pernah menimpa SIPP; ia hanya mengisi ketika SIPP masih kosong.
-- =============================================================================

CREATE TABLE IF NOT EXISTS aleta_bas_kehadiran (
  id TEXT PRIMARY KEY,
  perkara_id TEXT NOT NULL,
  nomor_perkara TEXT NOT NULL DEFAULT '',
  sidang_ke INTEGER NOT NULL,
  -- Bunyi kehadiran sebagaimana ditulis pada BAS, misalnya
  -- "hadir secara pribadi" atau "tidak hadir dan tidak pula menyuruh orang
  -- lain sebagai wakil/kuasanya".
  kehadiran_penggugat TEXT NOT NULL DEFAULT '',
  kehadiran_tergugat TEXT NOT NULL DEFAULT '',
  agenda TEXT NOT NULL DEFAULT '',
  hasil TEXT NOT NULL DEFAULT '',
  catatan TEXT NOT NULL DEFAULT '',
  dibuat_oleh TEXT NOT NULL,
  dibuat_at TEXT NOT NULL,
  diubah_oleh TEXT NOT NULL DEFAULT '',
  diubah_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_bas_kehadiran_kunci
  ON aleta_bas_kehadiran(perkara_id, sidang_ke);
