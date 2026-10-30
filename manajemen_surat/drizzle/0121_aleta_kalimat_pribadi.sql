-- =============================================================================
-- PUSTAKA KALIMAT PRIBADI (30 Oktober 2026)
-- =============================================================================
--
-- Hakim dan panitera pengganti menyimpan paragraf yang sering mereka pakai per jenis perkara, status, dan isian teks; satu klik
-- menyisipkannya ke isian, dan yang paling sering dipakai untuk jenis + status yang sama diusulkan sendiri sebagai saran samar (Tab).
-- Tersimpan di akun ALETA pemiliknya; dapat dibagikan ke golongan peran lain bila pemiliknya memilih.
--
--   aleta_kalimat_pribadi   id, pemilik (id + nama), jenis_perkara (kunci huruf kecil; '' = semua jenis), status ('verstek',
--                           'hadir', ...; '' = semua status), kode (nomor isian ABT; '' = isian teks mana pun), judul, teks,
--                           dibagikan (golongan dipisah koma: 'hakim,pp'; '' = pribadi), dipakai (hitungan), dipakai_terakhir,
--                           dibuat_pada, diubah_pada.
--
-- Tanpa kunci asing dan tanpa CHECK. Modul: src/server/modules/aleta-ecourt/kalimat-pribadi.ts.
--
-- NOMOR: 0121 (idx 107) diklaim 30 Okt 2026 (blok 0120-0121 agen G3G5-KENDALI-CETAK).
--
-- TIGA TEMPAT PENDAFTARAN: (a) berkas ini + _journal.json; (b) DDL_KALIMAT_PRIBADI di src/server/db/schema.ts;
-- (c) tabelnya di IN_MEMORY_TABLE_PERSISTENCE_ORDER (db/client.ts).
-- =============================================================================

CREATE TABLE IF NOT EXISTS aleta_kalimat_pribadi (
  id TEXT NOT NULL PRIMARY KEY,
  pemilik_id TEXT NOT NULL,
  pemilik_nama TEXT NOT NULL DEFAULT '',
  jenis_perkara TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT '',
  kode TEXT NOT NULL DEFAULT '',
  judul TEXT NOT NULL DEFAULT '',
  teks TEXT NOT NULL,
  dibagikan TEXT NOT NULL DEFAULT '',
  dipakai INTEGER NOT NULL DEFAULT 0,
  dipakai_terakhir TEXT NOT NULL DEFAULT '',
  dibuat_pada TEXT NOT NULL,
  diubah_pada TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_kalimat_pribadi_pemilik ON aleta_kalimat_pribadi(pemilik_id);
CREATE INDEX IF NOT EXISTS idx_kalimat_pribadi_jenis ON aleta_kalimat_pribadi(jenis_perkara, kode);
