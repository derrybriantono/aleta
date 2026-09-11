-- =============================================================================
-- Susunan kartu dasbor, milik tiap pengguna sendiri.
--
-- Dasbor menampilkan hal yang sama bagi semua orang dalam urutan yang sama,
-- padahal yang dikerjakan tiap jabatan berbeda: panitera pengganti membuka
-- dasbor untuk melihat tugas masuk, kepala bagian umum untuk melihat surat
-- masuk, dan keduanya harus menggulir melewati kartu yang bukan urusannya.
--
-- KENAPA DI BASIS DATA, BUKAN DI PERAMBAN SAJA
--
-- Susunannya juga disimpan di localStorage - itu yang membuat dasbor tersusun
-- benar pada gambar pertama, tanpa menunggu jaringan. Tetapi localStorage
-- melekat pada satu peramban di satu komputer, sedangkan pegawai pengadilan
-- berpindah meja, memakai komputer ruang sidang, dan data situsnya dibersihkan
-- setiap kali ada yang membereskan peramban bersama. Susunan yang hilang
-- diam-diam terbaca sebagai aplikasi yang lupa - bukan sebagai singgahan yang
-- dibersihkan.
--
-- Jadi peramban yang menjawab cepat, dan tabel ini yang mengingat.
--
-- SATU BARIS PER HALAMAN, BUKAN PER KARTU
--
-- susunan_json memuat seluruh zona halaman itu sekaligus, misalnya
-- {"ringkasan":["tugas-masuk","surat-masuk",...],"panel":["aktivitas",...]}.
-- Satu baris berarti satu kali baca saat halaman dibuka dan satu kali hapus
-- saat pengguna menekan "Kembalikan susunan bawaan" - keduanya perbuatan yang
-- memang utuh per halaman.
--
-- Yang TIDAK disimpan di sini: kartu mana yang boleh dilihat. Itu ditentukan
-- kewenangan, dan menyimpannya bersama susunan akan membuat urutan yang
-- tersimpan diam-diam menjadi daftar akses. Kunci yang tidak dikenal saat
-- dibaca diabaikan, dan kartu baru yang belum pernah disusun muncul di
-- akhir - bukan hilang.
-- =============================================================================

CREATE TABLE IF NOT EXISTS tata_letak_dasbor (
  user_id TEXT NOT NULL,
  halaman TEXT NOT NULL,
  susunan_json TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL,
  PRIMARY KEY (user_id, halaman),
  CONSTRAINT fk_tata_letak_dasbor_user FOREIGN KEY (user_id) REFERENCES users(id)
);
