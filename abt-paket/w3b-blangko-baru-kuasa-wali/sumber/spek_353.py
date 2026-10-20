# -*- coding: utf-8 -*-
"""Spesifikasi blangko PENCABUTAN KEKUASAAN ORANG TUA (jenis SIPP 353; folder "6d Pencabutan Kekuasaan Orang Tua").

Dasar hukum (semua terverifikasi dengan naskah resmi di D:/aleta-dev/kerja/referensi/_unduhan, lihat docs/gelombang3/PERIKSA-PASAL-W3b.md):
  - Pasal 47 ayat (1)-(2), Pasal 45 ayat (1)-(2), Pasal 49 ayat (1)-(2), Pasal 50 ayat (1) UU 1/1974 (naskah BPK);
  - Pasal 30 ayat (1)-(2), Pasal 31 ayat (1)-(4), Pasal 32 UU 23/2002 (Pasal-pasal itu tidak diubah UU 35/2014);
  - PP 29/2019 Pasal 3, 4, 9, 11, 12; Pasal 49 huruf a dan penjelasan angka 15 UU 7/1989 jo. UU 3/2006 jo. UU 50/2009 (teks di aleta_bot/query.js).
Variabel baru: sumber/variabel_353.py (3800-3817). Variabel lama yang dipakai: #9300# #9301# #4406# #4407# (nama anak / sebutan anak, U4).
"""

ANAK = '#4407# tersebut'   # anak / anak-anak tersebut
NAMA_ANAK = '#4406#'

SPEK = dict(
    kode='353',
    kunci='pencabutan-kuasa-asuh',
    label='pencabutan kekuasaan orang tua',
    nama_berkas='Pencabutan Kekuasaan Orang Tua',
    folder='6d Pencabutan Kekuasaan Orang Tua',
    isian_bas=[3800, 3802, 3805, 3806, 3808, 3809, 3812],   # isian bahan jawaban saksi di BAS (variabelAbt katalog)
    perdamaian=False,   # status pengasuhan anak tidak dapat dikesampingkan dengan akta perdamaian
)

# ---------------------------------------------------------------------------------------------------------------------------------
# GUGATAN (Pdt.G): Penggugat = orang tua yang lain / keluarga anak / saudara kandung dewasa; Tergugat = orang tua yang dimohonkan dicabut
# ---------------------------------------------------------------------------------------------------------------------------------
HUKUM_INTI = [
    ('body',
     'Menimbang, bahwa berdasarkan Pasal 47 ayat (1) dan ayat (2) Undang-Undang Nomor 1 Tahun 1974 tentang Perkawinan, anak yang belum mencapai umur 18 (delapan belas) tahun atau belum pernah '
     'melangsungkan perkawinan berada di bawah kekuasaan orang tuanya selama mereka tidak dicabut dari kekuasaannya, dan orang tua mewakili anak tersebut mengenai segala perbuatan hukum di dalam dan di luar '
     'pengadilan; selanjutnya Pasal 45 ayat (1) dan ayat (2) Undang-Undang yang sama menentukan bahwa kedua orang tua wajib memelihara dan mendidik anak-anak mereka sebaik-baiknya dan kewajiban itu berlaku '
     'sampai anak itu kawin atau dapat berdiri sendiri, kewajiban mana berlaku terus meskipun perkawinan antara kedua orang tua putus;'),
    ('body',
     'Menimbang, bahwa pencabutan kekuasaan orang tua diatur dalam #3803# yang pada pokoknya menentukan bahwa #3804#, atas permintaan orang tua yang lain, keluarga anak dalam garis lurus ke atas, saudara '
     'kandung yang telah dewasa atau pejabat yang berwenang, dengan keputusan Pengadilan; ketentuan tersebut sejalan dengan Pasal 30 ayat (1) dan ayat (2) serta Pasal 31 ayat (1) Undang-Undang Nomor 23 '
     'Tahun 2002 tentang Perlindungan Anak yang menentukan bahwa dalam hal orang tua melalaikan kewajibannya, kuasa asuh orang tua dapat dicabut melalui penetapan pengadilan atas permohonan salah satu '
     'orang tua, saudara kandung, atau keluarga sampai derajat ketiga;'),
    ('body',
     'Menimbang, bahwa menurut Pasal 49 ayat (2) Undang-Undang Nomor 1 Tahun 1974 meskipun orang tua dicabut kekuasaannya, mereka masih tetap berkewajiban memberi biaya pemeliharaan kepada anak tersebut, dan '
     'menurut Pasal 32 Undang-Undang Nomor 23 Tahun 2002 penetapan pengadilan tentang pencabutan kuasa asuh sekurang-kurangnya memuat ketentuan bahwa pencabutan tidak memutuskan hubungan darah antara '
     'anak dan orang tua kandungnya, tidak menghilangkan kewajiban orang tuanya untuk membiayai hidup anaknya, dan batas waktu pencabutan;'),
]

GUGATAN = dict(
    judul_inti='Pencabutan Kekuasaan Orang Tua',
    ganti=[('#9955#', '#3814#'), ('#9911#', '#3819#'), ('#9651#', '#3816#'), ('#9652#', '#3818#')],
    kewenangan=(
        'Menimbang, bahwa #0053# #0046# yang beragama Islam diajukan terhadap #0047# yang juga beragama Islam dan pada pokoknya memohon agar kekuasaan #0047# sebagai #9301# terhadap #4407# yang bernama '
        '#4406# dicabut; oleh karena perkara ini mengenai pencabutan kekuasaan orang tua yang termasuk bidang perkawinan, maka berdasarkan Pasal 49 huruf a beserta penjelasannya angka 15 Undang-Undang '
        'Nomor 7 Tahun 1989 tentang Peradilan Agama sebagaimana telah diubah dengan Undang-Undang Nomor 3 Tahun 2006 dan perubahan kedua dengan Undang-Undang Nomor 50 Tahun 2009 jo. Pasal 49 Undang-Undang '
        'Nomor 1 Tahun 1974 tentang Perkawinan, perkara a quo termasuk kewenangan absolut Pengadilan Agama;'),
    kewenangan_ringkas=(
        'Menimbang, bahwa #0053# #0046# pada pokoknya mengenai pencabutan kekuasaan orang tua antara orang-orang yang beragama Islam, maka berdasarkan Pasal 49 huruf a beserta penjelasannya angka 15 '
        'Undang-Undang Nomor 7 Tahun 1989 tentang Peradilan Agama sebagaimana telah diubah dengan Undang-Undang Nomor 3 Tahun 2006 dan perubahan kedua dengan Undang-Undang Nomor 50 Tahun 2009, perkara a '
        'quo termasuk kewenangan absolut Pengadilan Agama;'),
    standing=(
        'Menimbang, bahwa berdasarkan #0053# dan keterangan para pihak, #0046# adalah #3801# dari #4407# yang bernama #4406# dan #0047# adalah #9301# dari #4407# tersebut, sehingga berdasarkan Pasal 49 '
        'ayat (1) Undang-Undang Nomor 1 Tahun 1974 tentang Perkawinan yang memberi hak mengajukan permintaan pencabutan kekuasaan orang tua kepada orang tua yang lain, keluarga anak dalam garis lurus ke atas, '
        'saudara kandung yang telah dewasa atau pejabat yang berwenang, jo. Pasal 31 ayat (1) Undang-Undang Nomor 23 Tahun 2002 tentang Perlindungan Anak, #0046# mempunyai kepentingan hukum (persona standi '
        'in judicio) untuk mengajukan #0053# a quo terhadap #0047#;'),
    standing_no=(
        'Menimbang, bahwa berdasarkan #0053# dan keterangan para pihak, #0046# adalah #3801# dan #0047# adalah #9301# dari #4407# yang bernama #4406#, sehingga #0046# dan #0047# sama-sama '
        'mempunyai hubungan hukum dengan perkara a quo;'),
    isu=[
        'Apakah #0047# sebagai #9301# dari #4407# yang bernama #4406# sangat melalaikan kewajibannya terhadap #4407# tersebut dan/atau berkelakuan buruk sekali?',
        'Apakah pencabutan kekuasaan #0047# diperlukan demi kepentingan terbaik #4407# tersebut, dan untuk waktu berapa lama?',
        'Bagaimana pengasuhan dan pembiayaan #4407# tersebut selama kekuasaan #0047# dicabut?',
    ],
    fakta=[
        'Bahwa #0046# adalah #3801# dari #4407# yang bernama #4406# dan #0047# adalah #9301# dari #4407# tersebut;',
        'Bahwa #4407# tersebut saat ini belum berumur 18 (delapan belas) tahun dan belum pernah melangsungkan perkawinan;',
        'Bahwa #3805#;',
    ],
    inti_hukum=HUKUM_INTI,
    inti_kabul=[
        ('body',
         'Menimbang, bahwa berdasarkan fakta hukum tersebut di atas, perbuatan #0047# tersebut memenuhi unsur #3807# sebagaimana dimaksud #3803#, sehingga alasan untuk mencabut kekuasaan #0047# '
         'terhadap #4407# tersebut telah terpenuhi menurut hukum;'),
        ('body',
         'Menimbang, bahwa dengan memperhatikan kepentingan terbaik anak, #8554# berpendapat bahwa kekuasaan #0047# terhadap #4407# tersebut patut dicabut untuk waktu #3806#, dengan ketentuan bahwa pencabutan '
         'tersebut tidak memutuskan hubungan darah antara #4407# tersebut dan #0047# serta tidak menghilangkan kewajiban #0047# untuk membiayai kehidupan #4407# tersebut sebagaimana Pasal 49 ayat (2) '
         'Undang-Undang Nomor 1 Tahun 1974 jo. Pasal 32 Undang-Undang Nomor 23 Tahun 2002;#3813##3810#'),
    ],
    inti_kabul_akhir=dict(
        kontra='Menimbang, bahwa berdasarkan pertimbangan-pertimbangan tersebut di atas, #0053# #0046# beralasan hukum dan patut dikabulkan sebagaimana tersebut dalam amar putusan ini;',
        verstek='Menimbang, bahwa berdasarkan pertimbangan-pertimbangan tersebut di atas, #0053# #0046# beralasan hukum dan patut dikabulkan dengan verstek sebagaimana tersebut dalam amar putusan ini;'),
    inti_tolak=[],
    inti_tolak_akhir=dict(
        kontra='Menimbang, bahwa #3815#, sehingga dalil-dalil #0053# #0046# tidak terbukti dan #0053# #0046# tidak beralasan hukum serta harus ditolak;',
        verstek='Menimbang, bahwa meskipun #0047# tidak pernah hadir dan tidak membantah dalil-dalil #0053# #0046#, oleh karena #3815#, maka sesuai Pasal 149 ayat (1) RBg #0053# #0046# yang tidak '
                'beralasan hukum harus ditolak;'),
    amar_kabul=[
        'Mencabut kekuasaan #0047# sebagai #9301# terhadap #4407# yang bernama #4406# untuk waktu #3806#, dengan ketentuan:\n    - pencabutan tersebut tidak memutuskan hubungan darah antara #4407# '
        'tersebut dan #0047#;\n    - pencabutan tersebut tidak menghilangkan kewajiban #0047# untuk membiayai kehidupan #4407# tersebut;#3811#',
    ],
    amar_tolak=['Menolak #0053# #0046#;'],
)

# ---------------------------------------------------------------------------------------------------------------------------------
# PERMOHONAN (Pdt.P): Pemohon = orang tua yang lain / keluarga anak / saudara kandung dewasa / pejabat; tanpa Termohon
# ---------------------------------------------------------------------------------------------------------------------------------
PERMOHONAN = dict(
    # urutan: paragraf-paragraf permohonan disusun dari berkas dasar 4d Hibah [01p]/[03p]/[99p] oleh permohonan.py
    penjelasan=('pencabutan kekuasaan orang tua (kuasa asuh) dan akibat hukumnya'),
    pengakuan=('bahwa #0046# adalah #3801# dari #4407# yang bernama #4406#, bahwa #3805#, dan #0046# mohon agar kekuasaan #3817# terhadap #4407# tersebut dicabut untuk waktu #3806#'),
    tokens_tersembunyi='#3800# #3802# #3805# #3806# #3808# #3809# #3812# #3814#',
    penjelasan_bas='pencabutan kekuasaan orang tua (kuasa asuh), syarat dan akibat hukumnya, serta kewajiban orang tua untuk tetap membiayai anak',
    kewenangan=(
        'Menimbang, bahwa #0053# #0046# pada pokoknya mengenai pencabutan kekuasaan orang tua antara orang-orang yang beragama Islam, maka berdasarkan Pasal 49 huruf a beserta penjelasannya angka 15 '
        'Undang-Undang Nomor 7 Tahun 1989 tentang Peradilan Agama sebagaimana telah diubah dengan Undang-Undang Nomor 3 Tahun 2006 dan perubahan kedua dengan Undang-Undang Nomor 50 Tahun 2009 jo. Pasal 49 '
        'Undang-Undang Nomor 1 Tahun 1974 tentang Perkawinan, perkara a quo termasuk kewenangan absolut Pengadilan Agama;'),
    standing=(
        'Menimbang, bahwa #0046# adalah #3801# dari #4407# yang bernama #4406#, sehingga berdasarkan Pasal 49 ayat (1) Undang-Undang Nomor 1 Tahun 1974 tentang Perkawinan jo. Pasal 31 ayat (1) '
        'Undang-Undang Nomor 23 Tahun 2002 tentang Perlindungan Anak, #0046# mempunyai kepentingan hukum (legal standing) untuk mengajukan #0053# a quo;'),
    fakta=[
        'Bahwa #0046# adalah #3801# dari #4407# yang bernama #4406#;',
        'Bahwa #4407# tersebut saat ini belum berumur 18 (delapan belas) tahun dan belum pernah melangsungkan perkawinan;',
        'Bahwa #3805#;',
    ],
    hukum=HUKUM_INTI,
    kabul=[
        'Menimbang, bahwa berdasarkan fakta hukum tersebut di atas, perbuatan #3817# tersebut memenuhi unsur #3807# sebagaimana dimaksud #3803#, sehingga alasan untuk mencabut kekuasaannya terhadap '
        '#4407# tersebut telah terpenuhi menurut hukum;',
        'Menimbang, bahwa dengan memperhatikan kepentingan terbaik anak, #8554# berpendapat bahwa kekuasaan #3817# terhadap #4407# tersebut patut dicabut untuk waktu #3806#, dengan ketentuan bahwa '
        'pencabutan tersebut tidak memutuskan hubungan darah dan tidak menghilangkan kewajiban untuk membiayai kehidupan #4407# tersebut sebagaimana Pasal 49 ayat (2) Undang-Undang Nomor 1 Tahun 1974 jo. '
        'Pasal 32 Undang-Undang Nomor 23 Tahun 2002;#3813##3810#',
        'Menimbang, bahwa oleh karena itu #0053# #0046# beralasan hukum dan patut dikabulkan;',
    ],
    amar_kabul=[
        'Mengabulkan #0053# #0046#;',
        'Mencabut kekuasaan #3817# terhadap #4407# yang bernama #4406# untuk waktu #3806#, dengan ketentuan:\n    - pencabutan tersebut tidak memutuskan hubungan darah antara #4407# tersebut dan '
        'orang tua yang dicabut kekuasaannya;\n    - pencabutan tersebut tidak menghilangkan kewajiban orang tua tersebut untuk membiayai kehidupan #4407# tersebut;#3811#',
    ],
    tolak=[
        'Menimbang, bahwa #3815#, sehingga dalil-dalil #0053# #0046# tidak terbukti dan #0053# #0046# tidak beralasan hukum serta harus ditolak;',
    ],
    amar_tolak=['Menolak #0053# #0046#;'],
    no=[
        'Menimbang, bahwa #3816#, sehingga #0053# #0046# tidak memenuhi syarat formil dan harus dinyatakan tidak dapat diterima (niet ontvankelijk verklaard);',
    ],
    amar_no=['Menyatakan #0053# #0046# tidak dapat diterima;'],
)

SPEK['gugatan'] = GUGATAN
SPEK['permohonan'] = PERMOHONAN
