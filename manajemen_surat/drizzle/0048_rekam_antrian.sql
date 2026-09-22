-- =============================================================================
-- REKAM ANTRIAN SIDANG - catatan ALETA sendiri tentang antrian hari itu
-- =============================================================================
--
-- Diminta pengguna 22 September 2026: "tambahkan saya database di aleta antrian
-- sidang yaitu urutan antrian sidang, pengambilan antrian, siapa yang ambil
-- antrian sidang, perbandingan jarak antara perkara dengan perkara selanjutnya".
--
-- Keempatnya sudah ada di layar - tetapi hanya untuk hari yang sedang dibuka.
--
-- =============================================================================
-- KENAPA DISALIN, PADAHAL SUDAH ADA DI TABEL ANTRIAN
-- =============================================================================
--
-- Tabel antrian_sidang milik aplikasi ruang tunggu adalah tabel KERJA. Ia
-- dipakai ulang tiap hari sidang: nomor mulai lagi dari satu, baris kemarin
-- tidak lagi menerangkan apa pun, dan tidak ada di dalamnya yang menyimpan
-- keadaan sebuah hari sesudah hari itu lewat.
--
-- Akibatnya pertanyaan yang paling sering ditanyakan tentang pelayanan justru
-- tidak dapat dijawab sama sekali:
--
--   "Berapa lama para pihak menunggu pada sidang bulan lalu?"
--   "Hari mana yang ruangnya paling berdesakan?"
--   "Siapa petugas yang melayani pengambilan nomor hari itu?"
--
-- Tabel ini menjawabnya. Ia TIDAK menggantikan tabel antrian - yang memanggil
-- nomor tetap aplikasi ruang tunggu; ini salinan yang tinggal.
--
-- =============================================================================
-- SATU BARIS PER SIDANG PER HARI - DIPERBARUI, BUKAN DITUMPUK
-- =============================================================================
--
-- id-nya "tanggal|sidang_id", disusun sendiri, bukan diundi. Keadaan antrian
-- BERUBAH sepanjang hari: belum-ambil menjadi menunggu, menunggu menjadi
-- dipanggil. Menumpuk tiap perubahan berarti puluhan baris per perkara yang
-- isinya nyaris sama, dan yang membacanya harus tahu mana yang terakhir.
--
-- Yang disimpan di sini FAKTA yang dapat diperiksa ulang ke SIPP kapan saja -
-- jam, nomor, nama petugas - bukan pendapat orang. Itu bedanya dengan
-- aleta_keterangan_perkara, yang justru tidak boleh ditimpa sebab yang
-- disimpan di sana adalah "waktu itu tulisannya apa".
--
-- pertama_direkam_at sengaja tidak ikut ditimpa: ia menyatakan kapan ALETA
-- pertama kali melihat baris itu, dan itu keterangan yang hilang selamanya
-- kalau tertimpa.
-- =============================================================================

CREATE TABLE IF NOT EXISTS aleta_rekam_antrian (
  -- "<tanggal_sidang>|<sidang_id>". Lihat catatan di atas.
  id TEXT PRIMARY KEY,
  tanggal_sidang TEXT NOT NULL DEFAULT '',
  sidang_id TEXT NOT NULL DEFAULT '',
  perkara_id TEXT NOT NULL DEFAULT '',
  nomor_perkara TEXT NOT NULL DEFAULT '',
  ruangan TEXT NOT NULL DEFAULT '',

  -- (1) URUTAN ANTRIAN -------------------------------------------------------
  -- nomor_antrian: nomor yang tercetak dan dipanggil, dari aplikasi antrian.
  -- urutan_ruang: keberapa perkara ini duduk DI RUANGNYA menurut jam panggil.
  -- Keduanya berbeda dan keduanya ditanyakan: nomor antrian dihitung lintas
  -- ruang, sehingga nomor 7 bisa jadi perkara pertama di ruang 2.
  nomor_antrian INTEGER,
  urutan_ruang INTEGER,

  -- (2) PENGAMBILAN ANTRIAN --------------------------------------------------
  waktu_ambil TEXT NOT NULL DEFAULT '',
  jam_panggil TEXT NOT NULL DEFAULT '',
  -- 0/1, bukan BOOLEAN: dipakai sama oleh SQLite dan Postgres.
  online INTEGER NOT NULL DEFAULT 0,
  keadaan TEXT NOT NULL DEFAULT '',

  -- (3) SIAPA YANG MENGAMBIL -------------------------------------------------
  -- Disalin apa adanya dari aplikasi antrian pada saat direkam. Tidak
  -- ditautkan ke tabel pengguna ALETA: yang melayani ruang tunggu belum tentu
  -- punya akun ALETA, dan nama yang hilang lebih merugikan daripada nama yang
  -- tidak dapat diklik.
  nama_petugas TEXT NOT NULL DEFAULT '',

  -- (4) JARAK KE PERKARA SEBELUM DAN SESUDAHNYA ------------------------------
  -- Dalam menit, dihitung PER RUANG menurut jam panggil. NULL berarti tidak
  -- ada tetangga di sisi itu - bukan nol. Nol berarti dipanggil bersamaan,
  -- dan itu keadaan yang sungguh terjadi serta patut diperiksa.
  jarak_sebelum_menit INTEGER,
  jarak_berikut_menit INTEGER,

  pertama_direkam_at TEXT NOT NULL DEFAULT '',
  direkam_at TEXT NOT NULL DEFAULT ''
);

-- Dibaca per rentang tanggal, lalu per ruang, lalu urut. Tabel ini tumbuh
-- sebanyak sidang yang pernah berlangsung dan tidak pernah dipangkas.
CREATE INDEX IF NOT EXISTS idx_rekam_antrian_hari
  ON aleta_rekam_antrian (tanggal_sidang, ruangan, urutan_ruang);

-- Pertanyaan kedua yang paling sering: riwayat antrian satu perkara, lintas
-- hari sidangnya.
CREATE INDEX IF NOT EXISTS idx_rekam_antrian_perkara
  ON aleta_rekam_antrian (perkara_id, tanggal_sidang);
