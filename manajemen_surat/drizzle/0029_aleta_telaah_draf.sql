-- =============================================================================
-- Telaah draf per bagian (H3) - hakim menyaring, bukan menerima seluruhnya.
--
-- =============================================================================
-- YANG DIUBAH BUKAN TAMPILAN, MELAINKAN SYARAT TANDA TANGAN
-- =============================================================================
--
-- Tombol "terima" dan "tolak" pada tiap alinea tidak berarti apa-apa selama
-- draf yang belum ditelaah tetap dapat ditandatangani. Ia hanya akan menjadi
-- hiasan yang dilewati - dan lebih buruk daripada hiasan, karena jejaknya
-- kemudian menyebut "ditelaah" untuk naskah yang tidak pernah dibaca.
--
-- Maka kolom keadaan di sini menjadi SYARAT: selama masih ada butir bertanda
-- 'belum', draf tidak dapat ditandatangani.
--
-- =============================================================================
-- MENERIMA SEKALIGUS TETAP DIBOLEHKAN, TETAPI TERCATAT SEBAGAI ITU
-- =============================================================================
--
-- Draf berisi empat puluh alinea menuntut empat puluh ketukan. Menolak jalan
-- pintas sama sekali akan membuat alatnya ditinggalkan pada hari yang paling
-- sibuk, dan alat yang ditinggalkan tidak menyaring apa pun.
--
-- Karena itu ada jalan menerima sisanya sekaligus - dan kolom `sekaligus`
-- mencatat bahwa itulah yang terjadi. Jejaknya tidak akan pernah mengaku
-- telaah alinea demi alinea untuk keputusan yang diambil sekali tekan.
--
-- =============================================================================
-- BUTIR YANG DITOLAK TIDAK DIHAPUS
-- =============================================================================
--
-- Alasan yang sama dengan versi butir pustaka pada migrasi 0026: yang ditolak
-- adalah keputusan, dan keputusan adalah bagian dari jejak. Butir yang hilang
-- dari tabel membuat pertanyaan "mengapa alinea ini tidak ada di putusan"
-- tidak dapat dijawab siapa pun.
-- =============================================================================

ALTER TABLE aleta_putusan_draf_butir ADD COLUMN IF NOT EXISTS keadaan TEXT NOT NULL DEFAULT 'belum';
ALTER TABLE aleta_putusan_draf_butir ADD COLUMN IF NOT EXISTS diputus_oleh TEXT NOT NULL DEFAULT '';
ALTER TABLE aleta_putusan_draf_butir ADD COLUMN IF NOT EXISTS alasan_tolak TEXT NOT NULL DEFAULT '';
ALTER TABLE aleta_putusan_draf_butir ADD COLUMN IF NOT EXISTS diputus_at TEXT NOT NULL DEFAULT '';
-- Keputusan ini diambil bersama butir lain dalam satu ketukan, bukan sendiri.
ALTER TABLE aleta_putusan_draf_butir ADD COLUMN IF NOT EXISTS sekaligus INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_putusan_draf_butir_keadaan ON aleta_putusan_draf_butir(draf_id, keadaan);
