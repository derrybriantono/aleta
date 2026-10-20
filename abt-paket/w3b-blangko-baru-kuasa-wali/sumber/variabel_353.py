# -*- coding: utf-8 -*-
"""Variabel ABT baru - PENCABUTAN KEKUASAAN ORANG TUA (jenis SIPP 353), jatah 3800-3829.

Dasar hukum yang dicetak (semua terverifikasi dengan naskah di D:/aleta-dev/kerja/referensi/_unduhan; lihat docs/gelombang3/PERIKSA-PASAL-W3b.md):
  Pasal 45, 47, 49 UU 1/1974 (naskah BPK); Pasal 30, 31, 32 UU 23/2002 (tidak diubah UU 35/2014); Pasal 3, 4, 9, 11, 12 PP 29/2019;
  Pasal 49 huruf a dan penjelasan angka 15 UU 7/1989 jo. UU 3/2006 jo. UU 50/2009.
"""
from variabel_def import v, isi, ada, pilihan_huruf

P = 'KEKUASAAN ORANG TUA: '

v(3800, P + 'HUBUNGAN #0046# DENGAN ANAK - ISIAN (mis. ibu kandung, ayah kandung, nenek, kakak kandung yang telah dewasa, Dinas Sosial; kosong = ibu/ayah kandung menurut SIPP)',
  'data_teks')
v(3801, P + 'KEDUDUKAN #0046# TERHADAP ANAK (OTOMATIS: isian 3800; kosong = ibu kandung / ayah kandung menurut jenis kelamin #0046# di SIPP)', 'data_sql',
  "SELECT IF(%s <> '', %s, '#9300#') AS data" % (isi(3800), isi(3800)))
v(3802, P + 'ALASAN PENCABUTAN PASAL 49 AYAT (1) UU 1/1974 - PILIH HURUF: A sangat melalaikan kewajiban terhadap anak, B berkelakuan buruk sekali (boleh keduanya: A, B)', 'data_teks')
v(3803, P + 'DASAR HUKUM ALASAN (OTOMATIS dari huruf isian 3802: Pasal 49 ayat (1) huruf a dan/atau huruf b UU 1/1974)', 'data_sql',
  "SELECT CASE WHEN %s AND %s THEN 'Pasal 49 ayat (1) huruf a dan huruf b Undang-Undang Nomor 1 Tahun 1974 tentang Perkawinan' "
  "WHEN %s THEN 'Pasal 49 ayat (1) huruf a Undang-Undang Nomor 1 Tahun 1974 tentang Perkawinan' "
  "WHEN %s THEN 'Pasal 49 ayat (1) huruf b Undang-Undang Nomor 1 Tahun 1974 tentang Perkawinan' "
  "ELSE 'Pasal 49 ayat (1) Undang-Undang Nomor 1 Tahun 1974 tentang Perkawinan' END AS data" % (
      pilihan_huruf(3802, 'A'), pilihan_huruf(3802, 'B'), pilihan_huruf(3802, 'A'), pilihan_huruf(3802, 'B')))
v(3804, P + 'BUNYI NORMA ALASAN (OTOMATIS dari huruf isian 3802)', 'data_sql',
  "SELECT CASE WHEN %s AND %s THEN 'salah seorang atau kedua orang tua dapat dicabut kekuasaannya terhadap seorang anak atau lebih untuk waktu yang tertentu apabila ia sangat melalaikan kewajibannya terhadap anaknya atau berkelakuan buruk sekali' "
  "WHEN %s THEN 'salah seorang atau kedua orang tua dapat dicabut kekuasaannya terhadap seorang anak atau lebih untuk waktu yang tertentu apabila ia sangat melalaikan kewajibannya terhadap anaknya' "
  "WHEN %s THEN 'salah seorang atau kedua orang tua dapat dicabut kekuasaannya terhadap seorang anak atau lebih untuk waktu yang tertentu apabila ia berkelakuan buruk sekali' "
  "ELSE '........' END AS data" % (
      pilihan_huruf(3802, 'A'), pilihan_huruf(3802, 'B'), pilihan_huruf(3802, 'A'), pilihan_huruf(3802, 'B')))
v(3805, P + 'FAKTA KELALAIAN ATAU KELAKUAN BURUK YANG TERBUKTI - ISIAN kalimat sesudah kata "Bahwa" (apa yang dilalaikan atau dilakukan, sejak kapan, akibatnya bagi anak)', 'data_teks')
v(3806, P + 'JANGKA WAKTU PENCABUTAN - ISIAN (Pasal 49 ayat (1) UU 1/1974: untuk waktu tertentu; mis. sampai anak berumur 18 (delapan belas) tahun atau menikah, atau selama 2 (dua) tahun)', 'data_teks')
v(3807, P + 'KUALIFIKASI PERBUATAN (OTOMATIS dari huruf isian 3802: sangat melalaikan kewajibannya terhadap anak dan/atau berkelakuan buruk sekali)', 'data_sql',
  "SELECT CASE WHEN %s AND %s THEN 'sangat melalaikan kewajibannya terhadap anaknya dan berkelakuan buruk sekali' "
  "WHEN %s THEN 'sangat melalaikan kewajibannya terhadap anaknya' WHEN %s THEN 'berkelakuan buruk sekali' ELSE '........' END AS data" % (
      pilihan_huruf(3802, 'A'), pilihan_huruf(3802, 'B'), pilihan_huruf(3802, 'A'), pilihan_huruf(3802, 'B')))
v(3808, P + 'ORANG TUA YANG DIMOHONKAN DICABUT - ISIAN pada permohonan Pdt.P (kedudukan dan nama lengkap, mis. ayah kandung anak bernama Fulan bin Fulan); pada gugatan kosongkan', 'data_teks')
v(3809, P + 'WALI PENGGANTI YANG DITUNJUK BERSAMAAN - ISIAN OPSIONAL (nama lengkap bin/binti ... dan hubungannya dengan anak; kosong = tidak ada penunjukan wali dalam putusan ini)', 'data_teks')
v(3810, P + 'PERTIMBANGAN PENUNJUKAN WALI (OTOMATIS: hanya bila isian 3809 terisi; PP 29/2019 Pasal 9 ayat (2) dan Pasal 3-4, UU 23/2002 Pasal 31 ayat (3); diawali satu baris baru)', 'data_sql',
  "SELECT IF(%s <> '', CONCAT('<br>Menimbang, bahwa oleh karena kekuasaan orang tua atas #4407# tersebut dicabut, sedangkan Pasal 50 ayat (1) Undang-Undang Nomor 1 Tahun 1974 menentukan bahwa anak yang belum mencapai umur 18 (delapan belas) tahun atau belum pernah melangsungkan perkawinan, yang tidak berada di bawah kekuasaan orang tua, berada di bawah kekuasaan wali, dan Pasal 31 ayat (3) Undang-Undang Nomor 23 Tahun 2002 tentang Perlindungan Anak menentukan bahwa penetapan pengadilan tentang pencabutan kuasa asuh dapat menunjuk orang perseorangan atau lembaga untuk menjadi wali, serta Pasal 9 ayat (2) Peraturan Pemerintah Nomor 29 Tahun 2019 tentang Syarat dan Tata Cara Penunjukan Wali menentukan bahwa permohonan penunjukan wali diajukan bersamaan dengan permohonan pencabutan kuasa asuh, maka #8554# menilai bahwa ', %s, ' telah memenuhi syarat sebagai wali menurut Pasal 3 sampai dengan Pasal 6 Peraturan Pemerintah tersebut berdasarkan keterangan saksi-saksi dan alat bukti yang diajukan, sehingga patut ditunjuk sebagai wali bagi #4407# tersebut demi kepentingan terbaik anak;'), '') AS data" % (isi(3809), isi(3809)))
v(3811, P + 'AMAR PENUNJUKAN WALI (OTOMATIS: hanya bila isian 3809 terisi; satu butir rinci di bawah amar pencabutan)', 'data_sql',
  "SELECT IF(%s <> '', CONCAT('<br>    - menunjuk ', %s, ' sebagai wali bagi #4407# tersebut yang berkewajiban mengurus diri dan harta #4407# tersebut dengan sebaik-baiknya sesuai peraturan perundang-undangan;'), '') AS data" % (isi(3809), isi(3809)))
v(3812, P + 'REKOMENDASI DINAS SOSIAL - ISIAN OPSIONAL (nomor, tanggal, dan kesimpulan asesmen pekerja sosial profesional; PP 29/2019 Pasal 11-12; kosong = tidak ada rekomendasi)', 'data_teks')
v(3813, P + 'PERTIMBANGAN REKOMENDASI DINAS SOSIAL (OTOMATIS: hanya bila isian 3812 terisi; diawali satu baris baru)', 'data_sql',
  "SELECT IF(%s <> '', CONCAT('<br>Menimbang, bahwa sesuai Pasal 12 ayat (1) Peraturan Pemerintah Nomor 29 Tahun 2019 tentang Syarat dan Tata Cara Penunjukan Wali, rekomendasi dinas yang menyelenggarakan urusan pemerintahan di bidang sosial menjadi bahan pertimbangan dalam penetapan wali atau pencabutan kuasa asuh; dalam perkara ini diajukan rekomendasi berupa ', %s, ', yang #8554# pertimbangkan bersama-sama dengan alat bukti lainnya;'), '') AS data" % (isi(3812), isi(3812)))
v(3814, P + 'ALAT BUKTI SURAT #0046# - ISIAN (daftar bukti P.1 dst.; bila dibiarkan, memakai contoh bawaan)', 'data_teks',
  default=('1. Fotokopi Kartu Tanda Penduduk atas nama #0098#, NIK ..., yang dikeluarkan oleh ..., bukti surat tersebut telah diberi meterai cukup, di-nazegelen, serta telah dicocokkan dengan aslinya yang ternyata sesuai, lalu diberi tanda P.1;<br>'
           '2. Fotokopi Kartu Keluarga Nomor ... atas nama ..., yang dikeluarkan oleh ..., bukti surat tersebut telah diberi meterai cukup, di-nazegelen, serta telah dicocokkan dengan aslinya yang ternyata sesuai, lalu diberi tanda P.2;<br>'
           '3. Fotokopi Kutipan Akta Kelahiran anak atas nama ..., Nomor ..., yang dikeluarkan oleh ..., bukti surat tersebut telah diberi meterai cukup, di-nazegelen, serta telah dicocokkan dengan aslinya yang ternyata sesuai, lalu diberi tanda P.3;<br>'
           '4. ...'))
v(3815, P + 'ALASAN DITOLAK - ISIAN kalimat sesudah kata "Menimbang, bahwa" (mengapa kelalaian atau kelakuan buruk tidak terbukti atau tidak sampai tingkat sangat melalaikan atau buruk sekali)', 'data_teks')
v(3816, P + 'SEBAB TIDAK DAPAT DITERIMA - ISIAN kalimat sesudah kata "Menimbang, bahwa" (mis. Penggugat bukan pihak yang berhak mengajukan menurut Pasal 49 ayat (1) UU 1/1974)', 'data_teks')
v(3817, P + 'ORANG TUA YANG DICABUT (OTOMATIS: isian 3808 pada permohonan; pada gugatan memakai kedudukan Tergugat di SIPP dan sebutan Tergugat)', 'data_sql',
  "SELECT IF(%s <> '', %s, CONCAT('#9301# (', '#0047#', ')')) AS data" % (isi(3808), isi(3808)))
v(3818, P + 'PIHAK YANG SEHARUSNYA IKUT DITARIK SEBAGAI PIHAK - ISIAN (untuk putusan tidak dapat diterima karena kurang pihak, mis. orang tua lain atau wali anak; nama dan kedudukannya)', 'data_teks')
v(3819, P + 'ALAT BUKTI SURAT TERGUGAT - ISIAN (daftar bukti T.1 dst.; kosong = tanpa daftar)', 'data_teks')
