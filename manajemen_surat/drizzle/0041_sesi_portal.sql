-- =============================================================================
-- Penanda sesi portal: diingat atau tidak, dan versi aplikasi saat masuk.
--
-- KENAPA BUKAN DI TABEL sessions
--
-- Tabel sessions milik Better Auth. Ia yang membuat, memperbarui, dan
-- menghapus barisnya, dan kolom tambahan di sana akan hilang tanpa kabar
-- ketika pustakanya berganti bentuk. Tabel ini milik ALETA, ditautkan lewat
-- kunci asing dengan ON DELETE CASCADE - sehingga penandanya ikut hilang
-- begitu sesinya dihapus, tanpa ada yang perlu membersihkannya.
--
-- DUA MASA BERLAKU, SATU MEJA
--
-- Yang mencentang "Simpan login akun" tidak diputus di tengah pekerjaan -
-- panitera pengganti yang sedang menulis berita acara di ruang sidang tidak
-- boleh kehilangan halamannya karena dua jam lewat. Yang TIDAK mencentangnya
-- berada di komputer bersama - meja PTSP, ruang sidang, komputer pinjaman -
-- dan di sana sesi yang hidup berhari-hari berarti orang berikutnya duduk di
-- depan akun orang sebelumnya.
--
-- Karena itu tidak mencentang berarti dua jam, dan mencentang berarti sampai
-- aplikasinya diperbarui.
--
-- KENAPA PEMBARUAN MEMUTUS SESI
--
-- versi_aplikasi dicatat saat masuk dan dibandingkan pada tiap permintaan.
-- Berbeda berarti sesi itu lahir pada aplikasi yang lain: peramban masih
-- memegang berkas lama, rute yang dipanggilnya mungkin sudah berubah bentuk,
-- dan gejalanya berupa layar yang gagal di tempat yang tidak berhubungan.
-- Memutusnya sekali jauh lebih murah daripada menebak-nebak kenapa satu
-- pegawai melihat galat yang tidak dapat ditirukan siapa pun.
--
-- Yang TIDAK disimpan di sini: apa pun tentang kata sandi. Penanda ini hanya
-- menjawab "sampai kapan sesi ini berlaku".
-- =============================================================================

CREATE TABLE IF NOT EXISTS sesi_portal (
  session_id TEXT PRIMARY KEY,
  diingat SMALLINT NOT NULL DEFAULT 0,
  versi_aplikasi TEXT NOT NULL DEFAULT '',
  dibuat_pada TEXT NOT NULL,
  CONSTRAINT fk_sesi_portal_session FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);
