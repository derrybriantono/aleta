-- Isian simulasi tambahan (jawaban pengguna 30 Okt) - HANYA untuk basis salinan laptop aps_badilag_sela30. Teks rekaan untuk menguji kalimat.
REPLACE INTO abt_data_teks (no_var, perkara_id, data, modifier) VALUES
-- eksepsi gugatan kabur 9806 (harta bersama)
(9685, 9806, 'gugatan Penggugat tidak menyebutkan luas dan batas-batas sebidang tanah kebun yang didalilkan sebagai harta bersama', 'uji'),
(11374, 9806, 'surat gugatan Penggugat tidak menyebutkan luas dan batas-batas objek sengketa berupa sebidang tanah kebun, akibatnya objek tersebut tidak dapat ditentukan secara pasti', 'uji'),
(11314, 9806, 'letak tanah kebun sudah cukup jelas karena berada di Desa Tibo', 'uji'),
-- eksepsi kurang pihak dan ne bis in idem 8329 (kewarisan)
(11376, 8329, 'Hasna binti Lamarauna, anak kandung pewaris yang turut menguasai sebagian harta peninggalan', 'uji'),
(11375, 8329, 'putusan Pengadilan Agama ini Nomor 101/Pdt.G/2019 tanggal 12 Agustus 2019 antara pihak yang sama mengenai pembagian harta peninggalan yang sama, yang telah berkekuatan hukum tetap', 'uji'),
(11374, 8329, 'salah seorang ahli waris pewaris yang turut menguasai sebagian objek sengketa tidak ditarik sebagai pihak dalam perkara ini', 'uji'),
-- gugatan rekonvensi 9235 (harta bersama)
(11378, 9235, 'gugatan rekonvensi baru diajukan dalam duplik sesudah jawaban pertama', 'uji'),
-- penggabungan perkara 9215 (kewarisan)
(11380, 9215, '621/Pdt.G/2025/PA.Dgl', 'uji'),
(11381, 9215, 'kedua perkara diajukan oleh para ahli waris yang sama terhadap Tergugat yang sama mengenai harta peninggalan pewaris yang sama, sehingga terdapat hubungan yang erat antara keduanya', 'uji'),
-- sumpah pemutus 9235 (harta bersama)
(11382, 9235, '', 'uji'),
(11386, 9235, 'saya tidak pernah menjual sebidang tanah pekarangan di Desa Siweli yang didalilkan sebagai harta bersama kepada orang lain', 'uji'),
-- sumpah penaksir 9215 (kewarisan)
(11338, 9215, 'P', 'uji'),
(11388, 9215, 'nilai hasil panen kebun cengkih yang dikuasai Tergugat sejak tahun 2020 adalah sejumlah Rp24.000.000,00 (dua puluh empat juta rupiah)', 'uji'),
(11389, 9215, 'Rp20.000.000,00 (dua puluh juta rupiah)', 'uji'),
-- li'an 10059 (cerai talak)
(11391, 10059, 'istri saya Termohon telah berbuat zina dengan laki-laki lain pada bulan Maret 2026 di Kota Palu', 'uji'),
-- mediasi tidak beriktikad baik: tergugat 9291 (wasiat), penggugat 9929 (cerai gugat)
(11394, 9291, 'a', 'uji'),
(11398, 9291, 'Rp150.000,00 (seratus lima puluh ribu rupiah)', 'uji'),
(11394, 9929, 'b, d', 'uji'),
(11398, 9929, 'Rp150.000,00 (seratus lima puluh ribu rupiah)', 'uji'),
-- mediasi elektronik 9929
(11399, 9929, 'aplikasi konferensi video yang disediakan Mahkamah Agung', 'uji'),
-- pemeriksaan setempat cerai gugat kumulasi harta bersama 9929
(9165, 9929, 'Desa Toaya, Kecamatan Sindue, Kabupaten Donggala', 'uji'),
(11347, 9929, 'Sebidang tanah pekarangan beserta rumah papan di atasnya, seluas 300 m2, terletak di Desa Toaya, dengan batas-batas: Utara jalan desa; Timur rumah warga; Selatan kebun; Barat lorong', 'uji'),
(11396, 9929, 'Rp1.500.000,00 (satu juta lima ratus ribu rupiah)', 'uji');
