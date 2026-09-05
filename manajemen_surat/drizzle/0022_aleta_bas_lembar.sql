-- =============================================================================
-- Lembar BAS: tempat jawaban sidang disimpan.
--
-- =============================================================================
-- MASALAH YANG DIPECAHKAN
-- =============================================================================
--
-- Sampai sekarang alat bantu tulis BAS hanya dapat MEMBACA. Pertanyaan ABT
-- terbaca, penanda terisi dari SIPP, blangko terunduh - tetapi tidak ada satu
-- pun tempat menyimpan apa yang dikatakan saksi hari ini. Panitera tetap
-- mengetiknya di Word, dan pekerjaan itu hilang begitu berkasnya ditutup.
--
-- Tabel ini yang menampungnya, sehingga lembar yang sudah diisi dapat dibuka
-- lagi, dilanjutkan, dan dijadikan naskah.
--
-- =============================================================================
-- PERTANYAANNYA IKUT DISIMPAN, BUKAN HANYA JAWABANNYA
-- =============================================================================
--
-- Yang disimpan adalah pertanyaan SESUDAH penandanya terisi - lengkap dengan
-- nama para pihak sebagaimana berbunyi saat itu.
--
-- Kalau hanya nomor pertanyaannya yang disimpan lalu bunyinya diambil ulang
-- dari ABT saat dibaca, maka setiap perubahan katalog ABT akan mengubah bunyi
-- BAS yang SUDAH ditandatangani. Naskah resmi tidak boleh bergeser di bawah
-- tanda tangan yang sudah membubuhinya.
--
-- =============================================================================
-- ABT TIDAK DITULISI
-- =============================================================================
--
-- abt_keterangan_saksi tetap hanya dibaca. ABT adalah alat kerja panitera yang
-- dipakai setiap hari; menulis ke dalamnya dari luar berarti mengubah alat
-- kerja orang lain tanpa sepengetahuannya. Jawaban ALETA disimpan di sini.
-- =============================================================================

CREATE TABLE IF NOT EXISTS aleta_bas_lembar (
  id TEXT PRIMARY KEY,
  perkara_id TEXT NOT NULL,
  nomor_perkara TEXT NOT NULL DEFAULT '',
  -- Kode kumpulan pertanyaan ABT, misalnya A1a.
  kode_kumpulan TEXT NOT NULL,
  nama_kumpulan TEXT NOT NULL DEFAULT '',
  -- Saksi ke berapa dalam sidang ini. Blangko BAS menyediakan tempat terpisah
  -- untuk saksi pertama dan kedua (#5058# dan #5059#), jadi urutannya bagian
  -- dari jati diri lembar, bukan keterangan tambahan.
  saksi_ke INTEGER NOT NULL DEFAULT 1,
  -- Jati diri saksi sebagaimana ditanyakan di persidangan.
  saksi_nama TEXT NOT NULL DEFAULT '',
  saksi_umur TEXT NOT NULL DEFAULT '',
  saksi_agama TEXT NOT NULL DEFAULT '',
  saksi_pendidikan TEXT NOT NULL DEFAULT '',
  saksi_pekerjaan TEXT NOT NULL DEFAULT '',
  saksi_alamat TEXT NOT NULL DEFAULT '',
  tanggal_sidang TEXT NOT NULL DEFAULT '',
  keadaan TEXT NOT NULL DEFAULT 'draf' CHECK (keadaan IN ('draf', 'selesai')),
  catatan TEXT NOT NULL DEFAULT '',
  dibuat_oleh TEXT NOT NULL,
  dibuat_at TEXT NOT NULL,
  diubah_oleh TEXT NOT NULL DEFAULT '',
  diubah_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS aleta_bas_jawaban (
  id TEXT PRIMARY KEY,
  lembar_id TEXT NOT NULL,
  urutan INTEGER NOT NULL,
  -- Bunyi pertanyaan SESUDAH penanda terisi, disimpan apa adanya.
  pertanyaan TEXT NOT NULL DEFAULT '',
  jawaban TEXT NOT NULL DEFAULT '',
  diubah_at TEXT NOT NULL,
  CONSTRAINT fk_bas_jawaban_lembar FOREIGN KEY (lembar_id) REFERENCES aleta_bas_lembar(id) ON DELETE CASCADE
);

-- Satu lembar per perkara, kumpulan, dan urutan saksi. Tanpa ini satu perkara
-- dapat punya dua lembar untuk saksi pertama, dan tidak ada cara memilih mana
-- yang benar saat naskahnya dirakit.
CREATE UNIQUE INDEX IF NOT EXISTS idx_bas_lembar_kunci
  ON aleta_bas_lembar(perkara_id, kode_kumpulan, saksi_ke);

CREATE INDEX IF NOT EXISTS idx_bas_lembar_perkara ON aleta_bas_lembar(perkara_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_bas_jawaban_baris
  ON aleta_bas_jawaban(lembar_id, urutan);
