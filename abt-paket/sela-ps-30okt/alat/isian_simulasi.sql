-- Isian simulasi seperti diketik petugas/hakim - HANYA untuk basis salinan laptop aps_badilag_sela30 (paket sela-ps-30okt).
-- Teks rekaan untuk menguji kalimat; tidak pernah dikirim ke server.
REPLACE INTO abt_data_teks (no_var, perkara_id, data, modifier) VALUES
-- eksepsi absolut 8329 (kewarisan)
(9685, 8329, 'perkara a quo menyangkut sengketa hak milik atas tanah yang menjadi kewenangan Pengadilan Negeri, bukan Pengadilan Agama', 'uji'),
(9684, 8329, 'para Penggugat dan Tergugat beragama Islam dan pokok sengketa adalah pembagian harta peninggalan pewaris yang beragama Islam, sedangkan sengketa hak milik yang didalilkan Tergugat merupakan bagian dari penentuan harta peninggalan', 'uji'),
(9682, 8329, 'pokok sengketa ternyata mengenai perbuatan melawan hukum atas tanah antara pihak yang tidak terikat hubungan kewarisan', 'uji'),
(11314, 8329, 'eksepsi tersebut tidak berdasar karena seluruh pihak beragama Islam dan objek adalah harta peninggalan pewaris', 'uji'),
-- eksepsi relatif 9929 (cerai gugat), 10059 (cerai talak)
(9685, 9929, 'Penggugat telah lama bertempat tinggal di Kota Palu sehingga gugatan seharusnya diajukan ke Pengadilan Agama Palu', 'uji'),
(9684, 9929, 'berdasarkan bukti surat keterangan domisili dan Kartu Tanda Penduduk, Penggugat bertempat kediaman di Kecamatan Sindue yang termasuk wilayah hukum Pengadilan Agama ini', 'uji'),
(9681, 10059, 'Termohon bertempat kediaman di Kota Palu sejak sebelum permohonan diajukan', 'uji'),
(9682, 10059, 'berdasarkan Kartu Tanda Penduduk dan keterangan saksi, Termohon bertempat kediaman di Kelurahan Tondo, Kota Palu, dan tidak terbukti meninggalkan tempat kediaman bersama tanpa izin Pemohon', 'uji'),
(11317, 10059, 'Pengadilan Agama Palu', 'uji'),
-- provisi 9929 (cerai gugat) dan 9806 (harta bersama)
(11320, 9929, 'Tergugat dihukum membayar nafkah Penggugat dan anak sejumlah Rp1.500.000,00 (satu juta lima ratus ribu rupiah) setiap bulan selama perkara ini berlangsung', 'uji'),
(11321, 9929, 'Tergugat keberatan karena penghasilannya tidak tetap', 'uji'),
(11324, 9929, 'Menghukum Tergugat untuk membayar nafkah kepada Penggugat sejumlah Rp1.000.000,00 (satu juta rupiah) setiap bulan terhitung sejak putusan sela ini diucapkan sampai perkara ini berkekuatan hukum tetap', 'uji'),
(11325, 9929, 'Tergugat sebagai suami tetap berkewajiban menafkahi Penggugat selama ikatan perkawinan masih ada, dan berdasarkan keterangan para pihak Tergugat bekerja sebagai petani dengan penghasilan yang cukup untuk itu', 'uji'),
(11320, 9806, 'Tergugat dilarang mengalihkan, menjual, atau membebani hak tanggungan atas objek sengketa selama perkara ini berlangsung', 'uji'),
(11325, 9806, 'tuntutan provisi tersebut pada hakikatnya sama dengan permohonan sita yang telah dipertimbangkan dan menyangkut pokok perkara mengenai status objek sengketa', 'uji'),
-- intervensi 9806 (voeging), 9215 (tussenkomst), 9291 (vrijwaring)
(11326, 9806, 'Hasnah binti Lamuda, umur 52 tahun, agama Islam, pekerjaan petani, tempat tinggal di Desa Tibo, Kecamatan Sindue Tombusabora, Kabupaten Donggala', 'uji'),
(11329, 9806, 'sebagian objek sengketa berupa sebidang tanah kebun adalah milik Pemohon Intervensi yang dititipkan kepada Tergugat', 'uji'),
(11330, 9806, 'Penggugat keberatan, sedangkan Tergugat tidak keberatan', 'uji'),
(11331, 9806, 'Pemohon Intervensi telah menunjukkan bukti permulaan berupa surat keterangan kepemilikan tanah atas sebagian objek sengketa', 'uji'),
(11333, 9806, 'T', 'uji'),
(11326, 9215, 'Ramli bin Djanggola, umur 45 tahun, agama Islam, pekerjaan wiraswasta, tempat tinggal di Kelurahan Besusu Barat, Kota Palu', 'uji'),
(11329, 9215, 'Pemohon Intervensi adalah saudara kandung pewaris yang mendalilkan berhak atas bagian harta peninggalan', 'uji'),
(11330, 9215, 'Penggugat dan Tergugat sama-sama keberatan', 'uji'),
(11331, 9215, 'pewaris meninggalkan anak perempuan sehingga hubungan hukum Pemohon Intervensi dengan harta peninggalan tidak terbukti secara langsung', 'uji'),
(11326, 9291, 'PT Asuransi Syariah Amanah, berkedudukan di Kota Palu, diwakili oleh direkturnya', 'uji'),
(11329, 9291, 'objek wasiat berupa polis asuransi syariah yang pembayarannya menjadi tanggungan penanggung', 'uji'),
(11330, 9291, 'Penggugat tidak keberatan', 'uji'),
(11331, 9291, 'pihak penanggung terikat perjanjian dengan pewasiat atas objek wasiat sehingga kepentingannya langsung', 'uji'),
-- sumpah 9575 (CG verstek), 9496 (itsbat)
(11343, 9575, 'fotokopi Kutipan Akta Nikah (P.1) dan seorang saksi bernama Hasnah yang menerangkan bahwa Penggugat dan Tergugat telah berpisah tempat tinggal sejak satu tahun', 'uji'),
(11343, 9496, 'surat keterangan dari kepala desa (P.1) dan seorang saksi yang menghadiri akad nikah, sedangkan saksi kedua tidak mengetahui wali nikah', 'uji'),
-- pemeriksaan setempat
(9165, 7154, 'Desa Tambu, Kecamatan Balaesang, Kabupaten Donggala', 'uji'),
(9165, 9215, 'Desa Baliase, Kecamatan Marawola, Kabupaten Sigi', 'uji'),
(9166, 9215, 'Ahmad Lasaka selaku Kepala Desa Baliase', 'uji'),
(8718, 9215, '1. Sebidang tanah kebun Sertifikat Hak Milik Nomor 112, seluas 2.500 m2, terletak di Desa Baliase, dengan batas-batas: Utara jalan desa; Timur kebun Lapangka; Selatan sungai; Barat kebun Ladjoni;<br>2. Sebuah rumah permanen di atas tanah seluas 300 m2, terletak di Jalan Poros Palu-Bangga, Desa Baliase;', 'uji'),
(9167, 9215, '1. Tanah kebun: ditemukan di Desa Baliase, luas sekitar 2.400 m2, batas Utara jalan desa, Timur kebun Lapangka, Selatan sungai, Barat kebun Ladjoni; di atasnya tanaman kakao; dikuasai Tergugat;<br>2. Rumah: ditemukan di Jalan Poros Palu-Bangga, rumah permanen, luas tanah sekitar 300 m2; ditempati Tergugat;', 'uji'),
(9168, 9215, 'Penggugat dan Tergugat membenarkan letak dan batas-batas objek sengketa, sedangkan Tergugat menyatakan luas tanah kebun kurang dari yang didalilkan', 'uji'),
(11349, 9215, 'Sudirman, petugas Kantor Pertanahan Kabupaten Sigi', 'uji'),
(11351, 9215, 'sebagian: luas objek 1 sekitar 2.400 m2, bukan 2.500 m2 sebagaimana didalilkan', 'uji'),
(11355, 9215, 'tanah kebun dan rumah tersebut tercatat dalam buku tanah desa atas nama pewaris', 'uji'),
(9165, 9235, 'Desa Siweli, Kecamatan Balaesang, Kabupaten Donggala', 'uji'),
(11347, 9235, 'Sebidang tanah pekarangan beserta rumah di atasnya, seluas 400 m2, terletak di Desa Siweli, dengan batas-batas: Utara jalan; Timur rumah warga; Selatan kebun; Barat sungai;', 'uji');

DELETE FROM abt_keterangan_terdakwa WHERE perkara_id = 9215 AND sidang_id = 18257;
INSERT INTO abt_keterangan_terdakwa (perkara_id, sidang_id, penanya_id, pihak_id, urutan_pertanyaan, pertanyaan, jawaban, diinput_oleh, diinput_tanggal) VALUES
(9215, 18257, '1', 13626, 1, 'Apakah benar tanah kebun ini objek yang Saudara maksud dalam gugatan?', 'Benar, tanah kebun ini peninggalan almarhum ayah kami', 'uji', NOW()),
(9215, 18257, '1', 13626, 2, 'Berapa luas tanah kebun ini menurut Saudara?', 'Sekitar 2.500 meter persegi sesuai sertifikat', 'uji', NOW()),
(9215, 18257, '1', 5481, 1, 'Apakah Saudara membenarkan batas-batas tanah kebun ini?', 'Batas-batasnya benar, tetapi luasnya tidak sampai 2.500 meter persegi', 'uji', NOW()),
(9215, 18257, '1', 5481, 2, 'Siapa yang menguasai objek ini sekarang?', 'Saya yang menguasai dan merawat kebun ini sejak ayah meninggal', 'uji', NOW());
