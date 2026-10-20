# -*- coding: utf-8 -*-
"""Spesifikasi blangko GANTI RUGI TERHADAP WALI (jenis SIPP 357; folder "6g Ganti Rugi terhadap Wali").

Hanya set GUGATAN (Pdt.G): Penggugat = anak yang kini telah dewasa atau keluarga anak; Tergugat = wali yang menyebabkan kerugian harta benda anak.
Tanpa set permohonan (perkara ini selalu bersengketa dengan lawan).

Dasar hukum (semua terverifikasi dengan naskah resmi di D:/aleta-dev/kerja/referensi/_unduhan, lihat spek/PASAL-357.md):
  - Pasal 48, 50 ayat (1)-(2), 51 ayat (3)-(5), 52, 54 UU 1/1974 (naskah BPK);
  - Pasal 107, 110 ayat (1)-(4), 111 ayat (1)-(2), 112 Kompilasi Hukum Islam (khi-pasalid.json);
  - Pasal 33 ayat (4) UU 23/2002 sebagaimana diubah UU 35/2014; Pasal 14 ayat (1) huruf d PP 29/2019;
  - Pasal 49 huruf a dan penjelasan angka 18 UU 7/1989 jo. UU 3/2006 jo. UU 50/2009 (teks di aleta_bot/query.js); Pasal 283 RBg (beban bukti, ada di berkas dasar).
Variabel baru: sumber/variabel_357.py (3890-3919). Variabel lama yang dipakai: #4406# #4407# (nama anak / sebutan anak), #0046# #0047# #8554# #0053#.
Catatan: Tergugat adalah WALI, bukan orang tua kandung: variabel kedudukan Tergugat lama (#9301#) TIDAK dipakai.
"""

ANAK = '#4407# tersebut'   # anak / anak-anak tersebut
NAMA_ANAK = '#3893#'       # nama anak pemilik harta (isian 3892 atau SIPP)

SPEK = dict(
    kode='357',
    kunci='ganti-rugi-wali',
    label='ganti rugi terhadap wali',
    nama_berkas='Ganti Rugi terhadap Wali',
    folder='6g Ganti Rugi terhadap Wali',
    # isian bahan jawaban saksi di BAS (variabelAbt katalog ganti-rugi-wali): kedudukan Penggugat, nama anak, dasar perwalian, harta,
    # perbuatan wali, waktu perbuatan, harta yang dikembalikan, teguran sebelum gugatan, jumlah kerugian yang dituntut
    isian_bas=[3890, 3892, 3894, 3895, 3896, 3897, 3903, 3913, 3915],
    perdamaian=True,   # ganti rugi atas harta benda anak bersifat kebendaan dan dapat didamaikan: [97] Akta Perdamaian dan BAS AP ikut dibuat
)

# ---------------------------------------------------------------------------------------------------------------------------------
# GUGATAN (Pdt.G)
# ---------------------------------------------------------------------------------------------------------------------------------
HUKUM_INTI = [
    ('body',
     'Menimbang, bahwa menurut Pasal 50 ayat (1) dan ayat (2) Undang-Undang Nomor 1 Tahun 1974 tentang Perkawinan, anak yang belum mencapai umur 18 (delapan belas) tahun atau belum pernah '
     'melangsungkan perkawinan, yang tidak berada di bawah kekuasaan orang tua, berada di bawah kekuasaan wali, dan perwalian itu mengenai pribadi anak yang bersangkutan maupun harta bendanya; '
     'selanjutnya Pasal 51 ayat (3) dan ayat (4) Undang-Undang yang sama menentukan bahwa wali wajib mengurus anak yang di bawah penguasaannya dan harta bendanya sebaik-baiknya, serta wajib membuat '
     'daftar harta benda anak pada waktu memulai jabatannya dan mencatat semua perubahan harta benda anak tersebut, sedangkan Pasal 51 ayat (5) menentukan bahwa wali bertanggung jawab tentang harta '
     'benda anak yang berada di bawah perwaliannya serta kerugian yang ditimbulkan karena kesalahan atau kelalaiannya;'),
    ('body',
     'Menimbang, bahwa ketentuan tersebut sejalan dengan Pasal 110 ayat (1), ayat (2), ayat (3) dan ayat (4) Kompilasi Hukum Islam yang pada pokoknya menentukan bahwa wali berkewajiban mengurus diri dan '
     'harta orang yang berada di bawah perwaliannya dengan sebaik-baiknya, dilarang mengikatkan, membebani dan mengasingkan harta tersebut kecuali bila perbuatan itu menguntungkan bagi orang yang berada '
     'di bawah perwaliannya atau merupakan suatu kenyataan yang tidak dapat dihindarkan, bertanggung jawab terhadap harta tersebut dan mengganti kerugian yang timbul sebagai akibat kesalahan atau '
     'kelalaiannya, serta pertanggungjawaban itu harus dibuktikan dengan pembukuan yang ditutup tiap satu tahun sekali; larangan serupa terdapat dalam Pasal 48 Undang-Undang Nomor 1 Tahun 1974 yang '
     'menurut Pasal 52 Undang-Undang yang sama berlaku juga terhadap wali, yaitu tidak diperbolehkan memindahkan hak atau menggadaikan barang-barang tetap yang dimiliki anak, kecuali apabila '
     'kepentingan anak itu menghendakinya;'),
    ('body',
     'Menimbang, bahwa Pasal 54 Undang-Undang Nomor 1 Tahun 1974 tentang Perkawinan menentukan bahwa wali yang telah menyebabkan kerugian kepada harta benda anak yang di bawah kekuasaannya, atas '
     'tuntutan anak atau keluarga anak tersebut dengan keputusan Pengadilan, dapat diwajibkan untuk mengganti kerugian tersebut; kewajiban wali mengelola harta anak itu ditegaskan pula dalam Pasal 33 '
     'ayat (4) Undang-Undang Nomor 23 Tahun 2002 tentang Perlindungan Anak sebagaimana telah diubah dengan Undang-Undang Nomor 35 Tahun 2014, yang menentukan bahwa wali bertanggung jawab terhadap diri '
     'anak dan wajib mengelola harta milik anak untuk kepentingan terbaik bagi anak, dan dalam Pasal 14 ayat (1) huruf d Peraturan Pemerintah Nomor 29 Tahun 2019 tentang Syarat dan Tata Cara '
     'Penunjukan Wali yang mewajibkan wali mengelola harta milik anak untuk keperluan anak;'),
    ('body',
     'Menimbang, bahwa Pasal 111 ayat (1) dan ayat (2) Kompilasi Hukum Islam menentukan bahwa wali berkewajiban menyerahkan seluruh harta orang yang berada di bawah perwaliannya bila yang bersangkutan '
     'telah mencapai umur 21 tahun atau telah kawin, dan apabila perwalian telah berakhir, Pengadilan Agama berwenang mengadili perselisihan antara wali dan orang yang berada di bawah perwaliannya '
     'tentang harta yang diserahkan kepadanya, sedangkan Pasal 112 Kompilasi Hukum Islam hanya membolehkan wali mempergunakan harta orang yang berada di bawah perwaliannya sepanjang diperlukan untuk '
     'kepentingannya menurut kepatutan atau bil ma\'ruf kalau wali itu fakir;'),
    ('body',
     'Menimbang, bahwa berdasarkan ketentuan tersebut, agar #0047# dapat diwajibkan mengganti kerugian harus terpenuhi unsur-unsur sebagai berikut: (1) #0047# adalah wali dari anak yang harta '
     'bendanya dipersoalkan; (2) terdapat kerugian pada harta benda anak tersebut; (3) kerugian itu ditimbulkan oleh kesalahan atau kelalaian #0047# dalam mengurus harta benda anak; dan (4) tuntutan '
     'diajukan oleh anak atau keluarga anak tersebut, sedangkan besarnya kerugian dinilai oleh #8554# berdasarkan alat bukti yang diajukan di persidangan;'),
]

GUGATAN = dict(
    judul_inti='Ganti Rugi atas Harta Benda Anak',
    kewenangan=(
        'Menimbang, bahwa #0053# #0046# yang beragama Islam diajukan terhadap #0047# yang juga beragama Islam dan pada pokoknya menuntut agar #0047# selaku wali dari #4407# yang bernama #3893# '
        'dibebani kewajiban mengganti kerugian yang timbul pada harta benda #4407# tersebut; oleh karena perkara ini mengenai pembebanan kewajiban ganti kerugian atas harta benda anak yang ada di bawah '
        'kekuasaan wali yang termasuk bidang perkawinan, maka berdasarkan Pasal 49 huruf a beserta penjelasannya angka 18 Undang-Undang Nomor 7 Tahun 1989 tentang Peradilan Agama sebagaimana telah '
        'diubah dengan Undang-Undang Nomor 3 Tahun 2006 dan perubahan kedua dengan Undang-Undang Nomor 50 Tahun 2009 jo. Pasal 54 Undang-Undang Nomor 1 Tahun 1974 tentang Perkawinan, perkara a quo '
        'termasuk kewenangan absolut Pengadilan Agama;'),
    kewenangan_ringkas=(
        'Menimbang, bahwa #0053# #0046# pada pokoknya mengenai pembebanan kewajiban ganti kerugian atas harta benda anak yang ada di bawah kekuasaan wali antara orang-orang yang beragama Islam, maka '
        'berdasarkan Pasal 49 huruf a beserta penjelasannya angka 18 Undang-Undang Nomor 7 Tahun 1989 tentang Peradilan Agama sebagaimana telah diubah dengan Undang-Undang Nomor 3 Tahun 2006 dan '
        'perubahan kedua dengan Undang-Undang Nomor 50 Tahun 2009, perkara a quo termasuk kewenangan absolut Pengadilan Agama;'),
    standing=(
        'Menimbang, bahwa berdasarkan #0053# dan keterangan para pihak, #0046# adalah #3891# dan #0047# adalah wali dari #4407# yang bernama #3893# berdasarkan #3894#, sehingga berdasarkan Pasal 54 '
        'Undang-Undang Nomor 1 Tahun 1974 tentang Perkawinan yang memberi hak kepada anak atau keluarga anak untuk menuntut wali yang telah menyebabkan kerugian kepada harta benda anak agar diwajibkan '
        'mengganti kerugian tersebut, #0046# mempunyai kepentingan hukum (persona standi in judicio) untuk mengajukan #0053# a quo terhadap #0047#;'),
    standing_no=(
        'Menimbang, bahwa berdasarkan #0053# dan keterangan para pihak, #0046# adalah #3891# dan #0047# adalah wali dari #4407# yang bernama #3893#, sehingga #0046# dan #0047# sama-sama '
        'mempunyai hubungan hukum dengan perkara a quo;'),
    isu=[
        'Apakah #0047# adalah wali dari #4407# yang bernama #3893# dan apakah harta benda berupa #3895# berada dalam pengurusan #0047# selaku wali?',
        'Apakah #0047# telah melakukan kesalahan atau kelalaian dalam mengurus harta benda #4407# tersebut, yaitu #3896# pada waktu #3897#, sehingga menimbulkan kerugian pada harta benda #4407# tersebut?',
        'Berapa besar kerugian yang diderita harta benda #4407# tersebut, dan apakah patut #0047# diwajibkan mengganti kerugian itu sebagaimana dituntut oleh #0046#?',
    ],
    fakta=[
        'Bahwa #0046# adalah #3891# dan #0047# adalah wali dari #4407# yang bernama #3893# berdasarkan #3894#;',
        'Bahwa #4407# tersebut memiliki harta benda berupa #3895# yang berada dalam pengurusan #0047# selaku wali;',
        'Bahwa #3907#;',
    ],
    inti_hukum=HUKUM_INTI,
    inti_kabul=[
        ('body',
         'Menimbang, bahwa berdasarkan fakta hukum tersebut di atas, terbukti bahwa #0047# adalah wali dari #4407# yang bernama #3893# berdasarkan #3894#, sehingga #0047# berkewajiban mengurus harta '
         'benda #4407# tersebut sebaik-baiknya dan bertanggung jawab atas kerugian yang timbul karena kesalahan atau kelalaiannya sebagaimana Pasal 51 ayat (3) dan ayat (5) Undang-Undang Nomor 1 Tahun '
         '1974 jo. Pasal 110 ayat (1) dan ayat (3) Kompilasi Hukum Islam;#3914##3918#'),
        ('body',
         'Menimbang, bahwa perbuatan #0047# yaitu #3896# pada waktu #3897# tidak ternyata dilakukan demi kepentingan #4407# tersebut dan tidak pula merupakan keadaan yang tidak dapat dihindarkan '
         'sebagaimana Pasal 110 ayat (2) Kompilasi Hukum Islam, sehingga #8554# berpendapat bahwa perbuatan tersebut merupakan kesalahan atau kelalaian #0047# selaku wali dalam mengurus harta benda '
         '#4407# tersebut;'),
        ('body',
         'Menimbang, bahwa akibat kesalahan atau kelalaian tersebut harta benda #4407# tersebut berupa #3895# mengalami kerugian, sehingga unsur adanya kerugian pada harta benda anak telah '
         'terpenuhi;#3904#'),
        ('body',
         'Menimbang, bahwa oleh karena seluruh unsur Pasal 54 Undang-Undang Nomor 1 Tahun 1974 tentang Perkawinan telah terpenuhi, maka #0047# selaku wali patut diwajibkan mengganti kerugian yang timbul '
         'pada harta benda #4407# tersebut sebagaimana tersebut dalam amar putusan ini;'),
    ],
    inti_kabul_akhir=dict(
        kontra='Menimbang, bahwa berdasarkan pertimbangan-pertimbangan tersebut di atas, #0053# #0046# beralasan hukum dan patut dikabulkan sebagaimana tersebut dalam amar putusan ini;',
        verstek='Menimbang, bahwa berdasarkan pertimbangan-pertimbangan tersebut di atas, #0053# #0046# beralasan hukum dan patut dikabulkan dengan verstek sebagaimana tersebut dalam amar putusan ini;'),
    inti_tolak=[
        ('body',
         'Menimbang, bahwa Pasal 54 Undang-Undang Nomor 1 Tahun 1974 tentang Perkawinan hanya memungkinkan wali diwajibkan mengganti kerugian apabila wali telah menyebabkan kerugian kepada harta benda '
         'anak yang di bawah kekuasaannya, sehingga sesuai Pasal 283 RBg #0046# berkewajiban membuktikan adanya kerugian pada harta benda #4407# tersebut, besarnya kerugian itu, serta hubungan sebab '
         'akibat antara kerugian tersebut dan kesalahan atau kelalaian #0047#;#3914##3918#'),
    ],
    inti_tolak_akhir=dict(
        kontra='Menimbang, bahwa #3908#, sehingga dalil-dalil #0053# #0046# tidak terbukti dan #0053# #0046# tidak beralasan hukum serta harus ditolak;',
        verstek='Menimbang, bahwa meskipun #0047# tidak pernah hadir dan tidak membantah dalil-dalil #0053# #0046#, oleh karena #3908#, maka sesuai Pasal 149 ayat (1) RBg #0053# #0046# yang tidak '
                'beralasan hukum harus ditolak;'),
    amar_kabul=[
        'Menyatakan bahwa #0047# selaku wali dari #4407# yang bernama #3893# telah menyebabkan kerugian pada harta benda #4407# tersebut berupa #3895# karena kesalahan atau kelalaiannya;',
        'Menghukum #0047# untuk mengganti kerugian pada harta benda #4407# tersebut #3906#;',
    ],
    amar_tolak=['Menolak #0053# #0046#;'],
    # penukar penanda umum berkas dasar 6c Nafkah Anak dengan isian jenis ini (diterapkan gugatan.py pada semua paragraf)
    ganti=[('#9955#', '#3910#'),    # bukti surat Penggugat bawaan perceraian -> bukti surat P jenis ini
           ('#9911#', '#3911#'),    # bukti surat Tergugat bawaan -> bukti surat T jenis ini
           ('#9651#', '#3909#')],   # cacat formil NO (gugatan kabur) -> isian khusus ganti rugi wali
)

SPEK['gugatan'] = GUGATAN
