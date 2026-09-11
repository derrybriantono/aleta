-- =============================================================================
-- Pengecualian akses ekstensi untuk SATU ORANG, di atas kewenangan perannya.
--
-- Kewenangan per peran sudah ada sejak 0018 dan menjawab hampir semua keadaan.
-- Yang tidak dapat dijawabnya: satu orang yang perlu berbeda dari rekan
-- sejabatannya. Panitera pengganti yang sedang dipercaya mengerjakan blangko
-- sementara rekannya belum; hakim yang memegang pengawasan dan perlu mengunduh
-- berkas satuan kerja; pegawai yang kewenangannya perlu dicabut hari ini juga
-- tanpa menunggu perannya diubah - dan tanpa ikut mencabut kewenangan seluruh
-- rekan sejabatannya, yang selama ini menjadi satu-satunya cara.
--
-- TIGA KEADAAN, BUKAN DUA
--
-- Tidak ada baris  = ikut peran. Itulah sebabnya tabel ini menyimpan hanya
-- pengecualian, bukan seluruh matriks orang kali kemampuan. Bila ia menyimpan
-- boolean untuk setiap orang, kewenangan orang itu akan BEKU pada nilai peran
-- saat barisnya ditulis: perubahan pada perannya kelak tidak lagi sampai
-- kepadanya, dan tidak ada satu pun layar yang memperlihatkan bahwa ia
-- tertinggal.
--
-- ALASAN DAN MASA BERLAKU
--
-- Pengecualian per orang adalah hal yang mudah sekali menjadi permanen: yang
-- memberinya ingat sebabnya selama sebulan, lalu tidak ada lagi yang tahu
-- mengapa satu orang boleh sesuatu yang rekannya tidak boleh. Karena itu
-- alasannya WAJIB, dan masa berlakunya boleh diisi - pengecualian yang lewat
-- tanggalnya berhenti berlaku dengan sendirinya.
--
-- Barisnya TIDAK dihapus saat kedaluwarsa. Yang sudah pernah diberikan tetap
-- terbaca di layar pengaturan beserta tanggal dan alasannya, sebab pertanyaan
-- "siapa yang pernah diberi akses ini" adalah pertanyaan pemeriksaan, dan
-- jawaban yang terhapus bukan jawaban.
--
-- Super Admin dan Admin tidak dicatat di sini, dengan alasan yang sama seperti
-- pada 0018: kewenangan keduanya ditegakkan di kode, sehingga tidak ada baris
-- tabel yang dapat mengunci administrasi keluar dari pengaturannya sendiri.
-- =============================================================================

CREATE TABLE IF NOT EXISTS ecourt_extension_access_user (
  user_id TEXT NOT NULL,
  capability TEXT NOT NULL,
  enabled SMALLINT NOT NULL,
  alasan TEXT NOT NULL DEFAULT '',
  berlaku_sampai TEXT,
  updated_at TEXT NOT NULL,
  updated_by TEXT,
  PRIMARY KEY (user_id, capability),
  CONSTRAINT fk_ecourt_extension_access_user_user FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Dipakai halaman pengaturan untuk menjawab "siapa saja yang dikecualikan pada
-- kemampuan ini" tanpa memindai seluruh tabel pengguna.
CREATE INDEX IF NOT EXISTS idx_ecourt_extension_access_user_capability
  ON ecourt_extension_access_user (capability);
