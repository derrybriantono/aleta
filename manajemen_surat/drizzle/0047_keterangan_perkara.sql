-- =============================================================================
-- KETERANGAN PERKARA - catatan bebas dari siapa pun pegawai pengadilan
-- =============================================================================
--
-- Di layar jadwal sidang, di bawah tunjuk konseptor. Isinya apa saja yang perlu
-- diketahui orang berikutnya tentang perkara itu: berkas yang masih ditunggu,
-- pihak yang sulit dihubungi, kesepakatan yang belum tertulis di mana pun.
--
-- SIPP tidak punya tempat untuk ini. Yang ada hanya kolom-kolom yang sudah
-- ditentukan artinya, dan menuliskan catatan bebas ke salah satunya berarti
-- merusak arti kolom itu bagi seluruh laporan yang membacanya.
--
-- =============================================================================
-- TAMBAH SAJA - TIDAK PERNAH DIUBAH, TIDAK PERNAH DIHAPUS
-- =============================================================================
--
-- Tiap suntingan menjadi BARIS BARU bernomor urut, bukan menimpa baris lama.
-- Yang berlaku baris berurutan tertinggi; sisanya riwayat.
--
-- Sebabnya bukan kerapian. Catatan semacam ini dibaca orang untuk mengambil
-- keputusan - menunda sidang, menunggu berkas, menghubungi pihak - dan ketika
-- keputusan itu kelak dipertanyakan, yang ditanyakan justru "waktu itu
-- tulisannya apa". Menimpa baris lama menghapus jawabannya.
--
-- Karena itu tidak ada UPDATE dan tidak ada DELETE pada tabel ini. Yang keliru
-- diperbaiki dengan menulis baris baru; yang salah tetap terbaca beserta siapa
-- yang menulisnya.
--
-- =============================================================================
-- NAMA DAN JABATAN DISALIN, BUKAN DITAUTKAN
-- =============================================================================
--
-- nama_penulis dan jabatan disimpan APA ADANYA pada saat menulis, bukan dibaca
-- ulang dari tabel pengguna saat ditampilkan.
--
-- Jabatan orang berubah - panitera pengganti menjadi panitera muda, hakim
-- pindah satker. Membacanya ulang membuat catatan tiga bulan lalu tampak
-- ditulis oleh jabatan yang baru dijabat pekan ini, dan itu keterangan yang
-- keliru tentang siapa yang berwenang mengatakannya saat itu.
--
-- ditulis_oleh tetap disimpan supaya tautan ke akunnya tidak hilang.
-- =============================================================================

CREATE TABLE IF NOT EXISTS aleta_keterangan_perkara (
  id TEXT PRIMARY KEY,
  perkara_id TEXT NOT NULL,
  nomor_perkara TEXT NOT NULL DEFAULT '',
  -- Perubahan keberapa. Mulai dari 1, naik satu tiap suntingan pada perkara
  -- yang sama. Dihitung saat menulis, bukan saat membaca.
  urutan INTEGER NOT NULL DEFAULT 1,
  isi TEXT NOT NULL DEFAULT '',
  ditulis_oleh TEXT NOT NULL DEFAULT '',
  nama_penulis TEXT NOT NULL DEFAULT '',
  jabatan TEXT NOT NULL DEFAULT '',
  ditulis_at TEXT NOT NULL
);

-- Dibaca selalu per perkara dan selalu urut. Tanpa indeks ini, tiap pembukaan
-- panel menyapu seluruh tabel - dan tabel catatan tumbuh terus sebab tidak
-- pernah ada baris yang dibuang.
CREATE INDEX IF NOT EXISTS idx_keterangan_perkara_urut
  ON aleta_keterangan_perkara (perkara_id, urutan);
