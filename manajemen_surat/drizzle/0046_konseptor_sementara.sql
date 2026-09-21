-- =============================================================================
-- Konseptor SEMENTARA - tunjukan tangan, sebelum SIPP punya jawabannya
-- =============================================================================
--
-- SIPP baru dapat menyebut konseptor putusan SESUDAH ada yang mengerjakannya:
-- namanya terbaca dari jejak tahapan (perkara_proses, proses_id 210), dan
-- jejak itu baru lahir ketika naskahnya disentuh. Di antara sidang terakhir
-- dan naskah yang jadi, SIPP tidak dapat ditanyai "siapa yang menyusun ini" -
-- dan justru pada rentang itulah pertanyaannya paling sering diajukan.
--
-- Yang disimpan tabel ini jawabannya sementara, ditunjuk tangan oleh majelis
-- atau panitera, supaya rentang itu tidak kosong.
--
-- =============================================================================
-- SEMENTARA, DAN TIDAK PERNAH MENJADI KEBENARAN
-- =============================================================================
--
-- Begitu ada yang SUNGGUH mengunggah naskahnya, yang berlaku adalah nama dari
-- SIPP - bukan yang tersimpan di sini. Baris ini tidak dihapus ketika itu
-- terjadi, dan itu disengaja: selisih antara yang DITUNJUK dan yang SUNGGUH
-- mengerjakan adalah keterangan tersendiri. Ia menjawab "pekerjaan ini
-- berpindah tangan", dan menghapus barisnya menghapus pertanyaannya.
--
-- Karena itu tidak ada kolom "aktif". Yang membuat baris ini berhenti berlaku
-- bukan benderanya sendiri, melainkan adanya jawaban dari SIPP - dan bendera
-- yang harus diperbarui oleh sesuatu di luar dirinya adalah bendera yang
-- cepat atau lambat berbohong.
--
-- =============================================================================
-- SATU PERKARA, SATU TUNJUKAN
-- =============================================================================
--
-- Kuncinya perkara_id, bukan pasangan perkara dan orang. Konseptor putusan
-- satu orang; membiarkan dua baris hidup berdampingan berarti layar harus
-- memilih salah satunya, dan pilihan itu akan jatuh pada urutan baris - yaitu
-- pada kebetulan.
--
-- Menunjuk orang lain MENIMPA tunjukan sebelumnya. Siapa yang menimpa dan
-- kapan tetap tercatat pada kolom ditetapkan_oleh dan ditetapkan_at.
-- =============================================================================

CREATE TABLE IF NOT EXISTS aleta_konseptor_sementara (
  perkara_id TEXT PRIMARY KEY,
  nomor_perkara TEXT NOT NULL DEFAULT '',
  -- Nama sebagaimana ditulis - bukan penunjuk ke tabel pengguna. Konseptor
  -- sementara kerap hakim atau panitera pengganti yang belum tentu punya akun
  -- portal, dan menuntut akun berarti menutup penunjukan bagi sebagian orang
  -- yang justru paling sering mengerjakannya.
  nama TEXT NOT NULL DEFAULT '',
  -- Nama pengguna SIPP bila diketahui - kosong bila tidak. Dipakai
  -- membandingkan dengan nama dari SIPP, yang juga berbentuk username.
  pengguna TEXT NOT NULL DEFAULT '',
  catatan TEXT NOT NULL DEFAULT '',
  ditetapkan_oleh TEXT NOT NULL DEFAULT '',
  ditetapkan_at TEXT NOT NULL
);
