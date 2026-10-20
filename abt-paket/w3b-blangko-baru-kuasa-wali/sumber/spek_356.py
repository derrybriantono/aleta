# -*- coding: utf-8 -*-
"""Spesifikasi blangko PENUNJUKAN ORANG LAIN SEBAGAI WALI OLEH PENGADILAN (jenis SIPP 356; folder "6f Penunjukan Wali oleh Pengadilan").

Perkara ini HANYA permohonan (Pdt.P, tanpa Termohon): calon wali (Keluarga Anak, Saudara, orang lain, atau badan hukum) memohon agar pengadilan menunjuknya sebagai wali
bagi anak yang tidak berada di bawah kekuasaan orang tua. Set penetapan: [01p] kabul, [03p] tolak, [99p] tidak dapat diterima; BAS permohonan; pencabutan, gugur, dan
coret memakai 9b Permohonan Umum seperti hibah.

Dasar hukum (semua terverifikasi dengan naskah resmi di D:/aleta-dev/kerja/referensi/_unduhan; ringkasan di spek/PASAL-356.md):
  - Pasal 50 ayat (1)-(2), Pasal 51 ayat (2)-(5), Pasal 53 ayat (2) UU 1/1974 (naskah BPK); Pasal 107 ayat (1)-(4) KHI;
  - Pasal 26 ayat (2) dan Pasal 33 ayat (1)-(4) UU 23/2002 sebagaimana diubah UU 35/2014;
  - PP 29/2019 Pasal 1 angka 5-7, Pasal 2, Pasal 3, Pasal 4-7, Pasal 9, Pasal 11-14, Pasal 16 huruf c, Pasal 19;
  - Pasal 49 huruf a dan penjelasan angka 17 UU 7/1989 jo. UU 3/2006 jo. UU 50/2009 (teks di aleta_bot/query.js).
Variabel baru: sumber/variabel_356.py (3860-3883). Variabel lama yang dipakai: #4406# nama anak, #4407# anak / anak-anak (U4), #0098# nama Pemohon, #8554# majelis.
"""
import os

import bas
import permohonan
from pustaka import KELUAR

SPEK = dict(
    kode='356',
    kunci='penunjukan-wali',
    label='penunjukan wali oleh pengadilan',
    nama_berkas='Penunjukan Wali oleh Pengadilan',
    folder='6f Penunjukan Wali oleh Pengadilan',
    isian_bas=[3860, 3861, 3862, 3863, 3864, 3865, 3866, 3867, 3868],   # isian bahan jawaban saksi di BAS (variabelAbt katalog)
    perdamaian=False,   # perwalian anak tidak dapat dikesampingkan dengan akta perdamaian
)

PP_LENGKAP = 'Peraturan Pemerintah Nomor 29 Tahun 2019 tentang Syarat dan Tata Cara Penunjukan Wali'
UU1 = 'Undang-Undang Nomor 1 Tahun 1974 tentang Perkawinan'

HUKUM_UMUM = [
    ('body',
     'Menimbang, bahwa Pasal 50 ayat (1) dan ayat (2) ' + UU1 + ' menentukan bahwa anak yang belum mencapai umur 18 (delapan belas) tahun atau belum pernah melangsungkan perkawinan, yang tidak berada di bawah kekuasaan orang tua, '
     'berada di bawah kekuasaan wali, dan perwalian itu mengenai pribadi anak yang bersangkutan maupun harta bendanya; selanjutnya Pasal 51 ayat (2) Undang-Undang yang sama dan Pasal 107 ayat (4) Kompilasi Hukum Islam menentukan bahwa wali '
     'sedapat-dapatnya diambil dari keluarga anak tersebut atau orang lain yang sudah dewasa, berpikiran sehat, adil, jujur dan berkelakuan baik, atau badan hukum, sedangkan Pasal 107 ayat (1) dan ayat (2) Kompilasi Hukum Islam menentukan bahwa perwalian hanya '
     'terhadap anak yang belum mencapai umur 21 (dua puluh satu) tahun dan atau belum pernah melangsungkan perkawinan serta meliputi perwalian terhadap diri dan harta kekayaannya;'),
    ('body',
     'Menimbang, bahwa Pasal 26 ayat (2) Undang-Undang Nomor 23 Tahun 2002 tentang Perlindungan Anak sebagaimana telah diubah dengan Undang-Undang Nomor 35 Tahun 2014 menentukan bahwa dalam hal Orang Tua tidak ada, atau tidak diketahui keberadaannya, '
     'atau karena suatu sebab tidak dapat melaksanakan kewajiban dan tanggung jawabnya, kewajiban dan tanggung jawab tersebut dapat beralih kepada Keluarga; selanjutnya Pasal 33 ayat (1) dan ayat (2) Undang-Undang yang sama menentukan bahwa dalam hal Orang Tua '
     'dan Keluarga Anak tidak dapat melaksanakan kewajiban dan tanggung jawab tersebut, seseorang atau badan hukum yang memenuhi persyaratan dapat ditunjuk sebagai Wali dari Anak yang bersangkutan melalui penetapan pengadilan, '
     'yang menurut ayat (3) harus memiliki kesamaan dengan agama yang dianut Anak, dan menurut ayat (4) bertanggung jawab terhadap diri Anak serta wajib mengelola harta milik Anak untuk kepentingan terbaik bagi Anak;'),
    ('body',
     'Menimbang, bahwa menurut Pasal 3 ayat (1) ' + PP_LENGKAP + ', untuk dapat ditunjuk sebagai Wali karena Orang Tua tidak ada, Orang Tua tidak diketahui keberadaannya, atau suatu sebab Orang Tua tidak dapat melaksanakan kewajiban dan tanggung jawabnya, '
     'seseorang yang berasal dari Keluarga Anak, Saudara, orang lain, atau badan hukum harus memenuhi syarat penunjukan Wali dan melalui penetapan Pengadilan, dengan urutan bahwa Keluarga Anak diutamakan (ayat (2)), dalam hal Keluarga Anak tidak ada, tidak bersedia, '
     'atau tidak memenuhi persyaratan dapat ditunjuk Saudara (ayat (3)), dan dalam hal Keluarga Anak dan Saudara tidak ada, tidak bersedia, tidak diketahui keberadaannya, atau tidak memenuhi persyaratan dapat ditunjuk orang lain atau badan hukum (ayat (4)); '
     'selanjutnya Pasal 9 ayat (1) dan ayat (4) Peraturan Pemerintah tersebut menentukan bahwa permohonan penunjukan Wali disampaikan oleh seseorang atau badan hukum sebagai calon Wali kepada Pengadilan dan yang bersangkutan dinyatakan sebagai Wali setelah mendapatkan penetapan dari Pengadilan;'),
    ('body', '#3874#'),
]

FAKTA_KABUL = [
    'Bahwa #4406# adalah #4407# yang belum berumur 18 (delapan belas) tahun dan belum pernah melangsungkan perkawinan;',
    'Bahwa #3876#;',
    'Bahwa #3883#;',
    'Bahwa #0046# mempunyai hubungan sebagai #3875# dengan #4407# tersebut dan termasuk #3872# menurut Peraturan Pemerintah Nomor 29 Tahun 2019;',
    'Bahwa #0046# memenuhi syarat sebagai wali, yaitu #3881#;',
    'Bahwa mengenai persetujuan yang dipersyaratkan, #3882#;',
]
FAKTA_TOLAK = [
    'Bahwa #4406# adalah #4407# yang belum berumur 18 (delapan belas) tahun dan belum pernah melangsungkan perkawinan;',
    'Bahwa #0046# mempunyai hubungan sebagai #3875# dengan #4407# tersebut dan mengaku termasuk #3872# menurut Peraturan Pemerintah Nomor 29 Tahun 2019;',
    'Bahwa #0046# mengajukan #0053# agar ditunjuk sebagai wali bagi #4407# tersebut;',
]

PANITERA = ('dinas yang menyelenggarakan urusan pemerintahan di bidang administrasi kependudukan dan pencatatan sipil kabupaten/kota setempat, dinas yang menyelenggarakan urusan pemerintahan di bidang sosial kabupaten/kota setempat, '
            'dan instansi pemerintah pusat atau unit kerja di lingkungan instansi pemerintah pusat yang menyelenggarakan urusan pemerintahan di bidang harta peninggalan setempat')

PERMOHONAN = dict(
    penjelasan='penunjukan wali oleh pengadilan, syarat menjadi wali, serta kewajiban dan tanggung jawab wali terhadap diri dan harta anak yang berada di bawah perwaliannya',
    pengakuan=('bahwa #0046# mempunyai hubungan sebagai #3875# dengan #4407# yang bernama #4406#, bahwa #3876#, dan #0046# bersedia serta sanggup menjalankan kewajiban sebagai wali sehingga mohon agar ditunjuk sebagai wali bagi #4407# tersebut'),
    penjelasan_bas='penunjukan wali oleh pengadilan, syarat menjadi wali, serta kewajiban dan tanggung jawab wali terhadap diri dan harta anak yang berada di bawah perwaliannya',
    token_bukti='#3869#',
    kewenangan=(
        'Menimbang, bahwa #0053# #0046# pada pokoknya mengenai penunjukan #0046# sebagai wali bagi #4407# yang bernama #4406# yang beragama Islam; oleh karena itu, berdasarkan Pasal 49 huruf a beserta penjelasannya angka 17 '
        'Undang-Undang Nomor 7 Tahun 1989 tentang Peradilan Agama sebagaimana telah diubah dengan Undang-Undang Nomor 3 Tahun 2006 dan perubahan kedua dengan Undang-Undang Nomor 50 Tahun 2009 jo. Pasal 33 ayat (2) '
        'Undang-Undang Nomor 23 Tahun 2002 tentang Perlindungan Anak sebagaimana telah diubah dengan Undang-Undang Nomor 35 Tahun 2014 beserta penjelasannya dan Pasal 1 angka 7 ' + PP_LENGKAP + ', yang menentukan bahwa Pengadilan yang menetapkan Wali adalah pengadilan agama '
        'bagi yang beragama Islam, maka perkara a quo termasuk kewenangan absolut Pengadilan Agama, dan oleh karena #0046# bertempat kediaman di wilayah hukum #8008#, maka #8008# berwenang memeriksa dan mengadili perkara ini;'),
    standing=(
        'Menimbang, bahwa #0046# mempunyai hubungan dengan #4407# yang bernama #4406# sebagai #3875#, yang termasuk #3872# sebagaimana dimaksud dalam Pasal 3 ayat (1) ' + PP_LENGKAP + ', sedangkan Pasal 9 ayat (1) Peraturan Pemerintah tersebut '
        'menentukan bahwa permohonan penunjukan Wali disampaikan oleh seseorang atau badan hukum sebagai calon Wali kepada Pengadilan, sehingga #0046# mempunyai kepentingan hukum (legal standing) untuk mengajukan #0053# a quo;'),
    fakta=FAKTA_KABUL,
    fakta_tolak=FAKTA_TOLAK,
    fakta_no=FAKTA_TOLAK,
    hukum=HUKUM_UMUM,
    kabul=[
        '#3877#',
        'Menimbang, bahwa berdasarkan fakta hukum tersebut, #0046# yang termasuk #3872# telah memenuhi syarat sebagai wali sebagaimana dimaksud dalam #3873#, yaitu #3881#; adapun mengenai persetujuan yang dipersyaratkan, #3882#;#3878#',
        'Menimbang, bahwa dengan memperhatikan tujuan penunjukan wali menurut Pasal 2 Peraturan Pemerintah Nomor 29 Tahun 2019, yaitu melindungi hak dan memenuhi kebutuhan dasar Anak serta mengelola harta Anak agar dapat menjamin tumbuh kembang dan kepentingan terbaik bagi Anak, '
        '#8554# berpendapat bahwa penunjukan #0046# sebagai wali bagi #4407# tersebut telah beralasan hukum dan patut dikabulkan;#3879#',
        'Menimbang, bahwa meskipun demikian #8554# memandang perlu mengingatkan bahwa sebagai wali, #0046# wajib mengurus anak yang berada di bawah perwaliannya dan harta bendanya sebaik-baiknya dengan menghormati agama dan kepercayaan anak itu (Pasal 51 ayat (3) Undang-Undang Nomor 1 Tahun 1974), '
        'membuat daftar harta benda anak pada waktu memulai jabatannya dan mencatat semua perubahan-perubahan harta benda anak (Pasal 51 ayat (4) Undang-Undang yang sama), bertanggung jawab atas harta benda anak serta kerugian yang ditimbulkan karena kesalahan atau kelalaiannya (Pasal 51 ayat (5) Undang-Undang yang sama), '
        'melaksanakan kewajiban wali menurut Pasal 14 ayat (1) Peraturan Pemerintah Nomor 29 Tahun 2019 yang meliputi mengasuh, memelihara, mendidik, dan melindungi Anak, membimbing Anak dalam pemahaman dan pengamalan kehidupan beragama, mengelola harta milik Anak untuk keperluan Anak, '
        'dan mewakili Anak untuk melakukan perbuatan hukum di dalam dan di luar Pengadilan, serta mendaftarkan pencatatan penunjukan wali kepada dinas yang menyelenggarakan urusan pemerintahan di bidang administrasi kependudukan dan pencatatan sipil kabupaten/kota setempat '
        'dan melaporkannya kepada dinas yang menyelenggarakan urusan pemerintahan di bidang sosial kabupaten/kota setempat (Pasal 14 ayat (2) Peraturan Pemerintah tersebut);',
        'Menimbang, bahwa Pasal 13 Peraturan Pemerintah Nomor 29 Tahun 2019 mewajibkan Panitera Pengadilan menyampaikan salinan penetapan Pengadilan mengenai penunjukan Wali kepada ' + PANITERA + ', sehingga Panitera perlu diperintahkan untuk melaksanakan kewajiban tersebut;',
        'Menimbang, bahwa berdasarkan seluruh pertimbangan tersebut di atas, #0053# #0046# beralasan hukum dan patut dikabulkan sebagaimana tersebut dalam amar penetapan ini;',
    ],
    amar_kabul=[
        'Mengabulkan #0053# #0046#;',
        'Menetapkan #0098# (#0046#) sebagai wali bagi #4407# yang bernama #4406#, baik mengenai diri maupun harta kekayaannya;#3880#',
        'Memerintahkan Panitera #8008# untuk menyampaikan salinan penetapan ini kepada ' + PANITERA + ';',
    ],
    tolak=[
        'Menimbang, bahwa #3870#, sehingga syarat penunjukan wali sebagaimana dimaksud dalam #3873# tidak terpenuhi, maka dalil-dalil #0053# #0046# tidak terbukti dan #0053# #0046# tidak beralasan hukum serta harus ditolak;',
    ],
    amar_tolak=['Menolak #0053# #0046#;'],
    no=[
        'Menimbang, bahwa #3871#, sehingga #0053# #0046# tidak memenuhi syarat formil dan harus dinyatakan tidak dapat diterima (niet ontvankelijk verklaard);',
    ],
    amar_no=['Menyatakan #0053# #0046# tidak dapat diterima;'],
)

SPEK['permohonan'] = PERMOHONAN


def bangun(S):
    """Set permohonan: fakta hukum dibedakan menurut hasil (kabul memuat fakta syarat terpenuhi, tolak dan NO tidak); BAS permohonan dari 6 Perwalian - BAS."""
    folder = os.path.join(KELUAR, S['folder'])
    os.makedirs(folder, exist_ok=True)
    n = 0
    for kode, dasar, keluar, peran in permohonan.BERKAS:
        S2 = dict(S)
        P = dict(S['permohonan'])
        if peran == 'tolak':
            P['fakta'] = P['fakta_tolak']
        S2['permohonan'] = P
        permohonan.susun(kode, dasar, keluar, peran, S2, folder)
        n += 1
    n += len(bas.klon_permohonan(S))
    return n
