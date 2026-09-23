-- =============================================================================
-- ANTRIAN SIDANG TANPA LOGIN - APA YANG BOLEH TAMPIL, DIPUTUSKAN PIMPINAN
-- =============================================================================
--
-- Diminta pengguna 23 September 2026: "buatkan link saja yang bisa langsung di
-- liat tanpa harus login untuk menampilkan antrian sidang, buat pengaturannya
-- juga di admin aleta untuk apa saja fitur yang bisa di tampilkan url antrian
-- sidang tanpa login ini, untuk defaultnya semua tampil".
--
-- =============================================================================
-- PRANALANYA SUDAH ADA - YANG BELUM ADA KENDALINYA
-- =============================================================================
--
-- Layar antrian tanpa login sudah berdiri sejak lama di /antrian-layar, dan
-- rute datanya /api/antrian-ruang. Yang dijawabnya sengaja dibatasi empat hal:
-- nomor antrian, nomor ruang, keadaan, dan jam panggil. Nomor perkara, nama
-- para pihak, agenda, dan nama majelis DITOLAK di dalam kodenya, dengan alasan
-- yang tertulis panjang di sana: rute itu terbuka bagi siapa pun di jaringan
-- pengadilan.
--
-- Batas itu kini menjadi PENGATURAN, bukan lagi keputusan yang terkunci di
-- dalam kode. Pimpinan satker yang memutuskan seberapa banyak yang tampil di
-- televisi ruang tunggunya sendiri.
--
-- =============================================================================
-- BAWAANNYA SEMUA TAMPIL - DAN ITU PERLU DIBACA SEKALI LAGI
-- =============================================================================
--
-- Bawaan "semua tampil" diminta dengan tegas, dan karena itu dipasang begitu.
-- Yang perlu diketahui yang menyalakannya: dengan bawaan ini, nomor perkara
-- dan nama para pihak yang bersidang hari itu dapat dibaca siapa pun yang
-- dapat membuka alamat layar antrian - tanpa login, tanpa jejak siapa yang
-- membacanya.
--
-- Itu bukan keadaan yang salah dengan sendirinya: televisi ruang tunggu
-- memang memperlihatkannya kepada semua orang yang duduk di sana. Yang
-- berbeda hanyalah jangkauannya - sebuah alamat dapat dibuka dari mana saja
-- di jaringan yang sama, sedangkan televisi hanya dari ruang tunggu.
--
-- Karena itu tiap ruas yang menyangkut identitas ditandai "peka" di layar
-- pengaturannya, dan penandanya muncul tiap kali pengaturan itu dibuka -
-- bukan sekali saat dipasang.
--
-- =============================================================================
-- SATU BARIS SAJA
-- =============================================================================
--
-- CHECK (id = 1) memaksa tabel ini hanya pernah punya satu baris. Pengaturan
-- yang dapat berbilang baris selalu berakhir dengan dua baris yang berbeda dan
-- tidak ada yang tahu mana yang berlaku - pola yang sama sudah dipakai
-- panel_settings pada basis data ini.

CREATE TABLE IF NOT EXISTS aleta_antrian_publik (
  id SMALLINT PRIMARY KEY CHECK (id = 1),

  -- Saklar induk. Dimatikan berarti alamat tanpa login menjawab kosong sama
  -- sekali - bukan menjawab sebagian. Satker yang tidak menghendaki layar
  -- terbuka mematikan satu hal ini, bukan sebelas hal.
  aktif BOOLEAN NOT NULL DEFAULT TRUE,

  -- Ruas mana yang boleh tampil. Disimpan sebagai JSON, bukan sebelas kolom
  -- boolean: daftarnya akan bertambah seiring layarnya bertambah, dan
  -- menambah kolom untuk tiap ruas baru berarti satu migrasi untuk tiap
  -- kotak centang.
  --
  -- Kosong berarti BAWAAN, dan bawaannya seluruhnya menyala - lihat
  -- src/lib/antrian-publik.ts, tempat daftar ruas dan bawaannya ditulis satu
  -- kali untuk seluruh aplikasi.
  tampil_json TEXT NOT NULL DEFAULT '{}',

  -- Judul yang tertulis di layar. Kosong berarti memakai nama satker.
  judul TEXT NOT NULL DEFAULT '',

  -- Catatan bebas bagi petugas yang mengurusnya - mis. "layar lobi lantai 1".
  catatan TEXT NOT NULL DEFAULT '',

  diperbarui_oleh TEXT,
  diperbarui_pada TEXT NOT NULL,

  CONSTRAINT fk_aleta_antrian_publik_oleh FOREIGN KEY (diperbarui_oleh) REFERENCES users(id)
);

-- Baris tunggalnya dibuat sekarang juga, dengan bawaan seluruhnya menyala.
--
-- Tanpa ini, layar akan membaca tabel kosong pada pemasangan baru dan harus
-- memilih sendiri apa yang berlaku - dan "tidak ada barisnya" pernah dibaca
-- sebagai "seluruhnya mati" di tempat lain pada aplikasi ini.
INSERT INTO aleta_antrian_publik (id, aktif, tampil_json, judul, catatan, diperbarui_pada)
VALUES (1, TRUE, '{}', '', '', '')
ON CONFLICT (id) DO NOTHING;
