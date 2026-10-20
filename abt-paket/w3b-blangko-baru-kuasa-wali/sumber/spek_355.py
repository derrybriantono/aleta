# -*- coding: utf-8 -*-
"""Spesifikasi blangko PENCABUTAN KEKUASAAN WALI (jenis SIPP 355; folder "6e Pencabutan Kekuasaan Wali").

Dasar hukum (semua terverifikasi dengan naskah resmi di D:/aleta-dev/kerja/referensi/_unduhan, lihat spek/PASAL-355.md):
  - Pasal 50 ayat (1)-(2), Pasal 51 ayat (2), (3), (5), Pasal 53 ayat (1)-(2) dan Pasal 49 ayat (1) UU 1/1974 (naskah BPK);
  - Pasal 107 ayat (3), Pasal 109, Pasal 110 ayat (1), (3), (4) Kompilasi Hukum Islam;
  - PP 29/2019 Pasal 3-7, 12, 17 ayat (1)-(2), 18, 19 ayat (1)-(4);
  - Pasal 33 ayat (1)-(2) UU 23/2002 sebagaimana diubah UU 35/2014; Pasal 49 huruf a dan penjelasan angka 16-17 UU 7/1989 jo. UU 3/2006 jo. UU 50/2009.
Variabel baru: sumber/variabel_355.py (3830-3857). Variabel lama yang dipakai: #9300#/#9301# TIDAK dipakai (itu ayah/ibu kandung; Tergugat di sini adalah wali);
#4406# #4407# (nama anak / sebutan anak, SIPP perkara_anak_pihak).
"""

SPEK = dict(
    kode='355',
    kunci='pencabutan-kuasa-wali',
    label='pencabutan kekuasaan wali',
    nama_berkas='Pencabutan Kekuasaan Wali',
    folder='6e Pencabutan Kekuasaan Wali',
    isian_bas=[3830, 3832, 3834, 3838, 3841, 3842, 3847, 3849, 3852, 3857],   # isian bahan jawaban saksi di BAS (variabelAbt katalog)
    perdamaian=False,   # status perwalian anak tidak dapat dikesampingkan dengan akta perdamaian
)

# ---------------------------------------------------------------------------------------------------------------------------------
# bagian hukum bersama (gugatan dan permohonan)
# ---------------------------------------------------------------------------------------------------------------------------------
HUKUM_INTI = [
    ('body',
     'Menimbang, bahwa berdasarkan Pasal 50 ayat (1) dan ayat (2) Undang-Undang Nomor 1 Tahun 1974 tentang Perkawinan, anak yang belum mencapai umur 18 (delapan belas) tahun atau belum pernah '
     'melangsungkan perkawinan, yang tidak berada di bawah kekuasaan orang tua, berada di bawah kekuasaan wali, dan perwalian itu mengenai pribadi anak yang bersangkutan maupun harta bendanya; '
     'selanjutnya Pasal 51 ayat (3) Undang-Undang yang sama dan Pasal 110 ayat (1) Kompilasi Hukum Islam menentukan bahwa wali wajib mengurus anak yang berada di bawah penguasaannya dan harta '
     'bendanya sebaik-baiknya dengan menghormati agama dan kepercayaan anak itu, serta wajib memberikan bimbingan agama, pendidikan dan keterampilan lainnya untuk masa depan anak tersebut;'),
    ('body',
     'Menimbang, bahwa pencabutan kekuasaan wali diatur dalam #3835# yang pada pokoknya menentukan bahwa #3836#;'),
    ('body',
     'Menimbang, bahwa selanjutnya Pasal 107 ayat (3) Kompilasi Hukum Islam menentukan bahwa bila wali tidak mampu berbuat atau lalai melaksanakan tugas perwaliannya, maka Pengadilan Agama dapat '
     'menunjuk salah seorang kerabat untuk bertindak sebagai wali atas permohonan kerabat tersebut, dan Pasal 53 ayat (2) Undang-Undang Nomor 1 Tahun 1974 menentukan bahwa dalam hal kekuasaan '
     'seorang wali dicabut, oleh Pengadilan ditunjuk orang lain sebagai wali;'),
    ('body',
     'Menimbang, bahwa Pasal 19 ayat (1) sampai dengan ayat (4) Peraturan Pemerintah Nomor 29 Tahun 2019 tentang Syarat dan Tata Cara Penunjukan Wali menentukan bahwa pada saat berakhirnya wali '
     'karena kekuasaan wali dicabut, seseorang atau badan hukum dapat ditunjuk sebagai wali, permohonan pencabutan kuasa asuh sebagai wali diajukan kepada Pengadilan oleh orang tua atau oleh orang '
     'atau badan hukum yang akan ditunjuk sebagai wali, dalam hal diajukan oleh orang tua Pengadilan dapat menetapkan pengembalian dan tanggung jawab kuasa asuh kepada orang tua atau menetapkan '
     'wali pengganti, sedangkan dalam hal diajukan oleh orang atau badan hukum yang akan ditunjuk sebagai wali Pengadilan dapat menetapkan wali pengganti; ketentuan tersebut sejalan dengan '
     'Pasal 33 ayat (1) dan ayat (2) Undang-Undang Nomor 23 Tahun 2002 tentang Perlindungan Anak sebagaimana telah diubah dengan Undang-Undang Nomor 35 Tahun 2014 yang menentukan bahwa '
     'penunjukan wali dilakukan melalui penetapan pengadilan;'),
]

KEWENANGAN_PUSTAKA = (
    'Pasal 49 huruf a beserta penjelasannya angka 16 Undang-Undang Nomor 7 Tahun 1989 tentang Peradilan Agama sebagaimana telah diubah dengan Undang-Undang Nomor 3 Tahun 2006 dan perubahan kedua '
    'dengan Undang-Undang Nomor 50 Tahun 2009 jo. Pasal 53 Undang-Undang Nomor 1 Tahun 1974 tentang Perkawinan')

# ---------------------------------------------------------------------------------------------------------------------------------
# GUGATAN (Pdt.G): Penggugat = orang tua / kerabat anak / pihak yang berkepentingan; Tergugat = wali yang dimohonkan dicabut
# ---------------------------------------------------------------------------------------------------------------------------------
GUGATAN = dict(
    judul_inti='Pencabutan Kekuasaan Wali',
    kewenangan=(
        'Menimbang, bahwa #0053# #0046# yang beragama Islam diajukan terhadap #0047# yang juga beragama Islam dan pada pokoknya memohon agar kekuasaan #0047# sebagai wali atas #4407# yang bernama '
        '#4406# dicabut; oleh karena perkara ini mengenai pencabutan kekuasaan wali yang termasuk bidang perkawinan, maka berdasarkan ' + KEWENANGAN_PUSTAKA + ', perkara a quo termasuk kewenangan '
        'absolut Pengadilan Agama;'),
    kewenangan_ringkas=(
        'Menimbang, bahwa #0053# #0046# pada pokoknya mengenai pencabutan kekuasaan wali antara orang-orang yang beragama Islam, maka berdasarkan ' + KEWENANGAN_PUSTAKA + ', perkara a quo termasuk '
        'kewenangan absolut Pengadilan Agama;'),
    standing=(
        'Menimbang, bahwa berdasarkan #0053# dan keterangan para pihak, #0046# adalah #3831# dari #4407# yang bernama #4406# dan #0047# adalah wali dari #4407# tersebut#3833#, sehingga berdasarkan '
        'Pasal 109 Kompilasi Hukum Islam yang memberi hak kepada kerabat untuk memohon pencabutan hak perwalian, Pasal 19 ayat (2) Peraturan Pemerintah Nomor 29 Tahun 2019 tentang Syarat dan Tata '
        'Cara Penunjukan Wali yang memberi hak mengajukan permohonan pencabutan kuasa asuh sebagai wali kepada orang tua atau orang atau badan hukum yang akan ditunjuk sebagai wali, serta Pasal 53 '
        'ayat (1) jo. Pasal 49 ayat (1) Undang-Undang Nomor 1 Tahun 1974 tentang Perkawinan yang menyebut orang tua yang lain, keluarga anak dalam garis lurus ke atas, saudara kandung yang telah '
        'dewasa atau pejabat yang berwenang sebagai pihak yang dapat meminta pencabutan, #0046# mempunyai kepentingan hukum (persona standi in judicio) untuk mengajukan #0053# a quo terhadap #0047#;'),
    standing_no=(
        'Menimbang, bahwa berdasarkan #0053# dan keterangan para pihak, #0046# adalah #3831# dan #0047# adalah wali dari #4407# yang bernama #4406#, sehingga #0046# dan #0047# sama-sama '
        'mempunyai hubungan hukum dengan perkara a quo;'),
    isu=[
        'Apakah #0047# sebagai wali atas #4407# yang bernama #4406# memenuhi alasan pencabutan kekuasaan wali menurut ketentuan perundang-undangan, yaitu #3837#?',
        'Apakah pencabutan kekuasaan #0047# sebagai wali diperlukan demi kepentingan terbaik #4407# tersebut?',
        'Siapa yang akan mengasuh dan mengurus diri serta harta #4407# tersebut sesudah kekuasaan #0047# sebagai wali dicabut, apakah ditunjuk wali pengganti atau kuasa asuh dikembalikan kepada orang tua?',
    ],
    fakta=[
        'Bahwa #0046# adalah #3831# dari #4407# yang bernama #4406# dan #0047# adalah wali dari #4407# tersebut#3833#;',
        'Bahwa #4407# tersebut saat ini belum berumur 18 (delapan belas) tahun dan belum pernah melangsungkan perkawinan;',
        'Bahwa #3838#;',
    ],
    inti_hukum=HUKUM_INTI,
    inti_kabul=[
        ('body',
         'Menimbang, bahwa berdasarkan fakta hukum tersebut di atas, terbukti bahwa #3837#, yang merupakan alasan pencabutan kekuasaan wali sebagaimana dimaksud dalam #3835#, sehingga alasan '
         'untuk mencabut kekuasaan #0047# sebagai wali atas #4407# tersebut telah terpenuhi menurut hukum;'),
        ('body',
         'Menimbang, bahwa dengan memperhatikan kepentingan terbaik anak, #8554# berpendapat bahwa kekuasaan #0047# sebagai wali atas #4407# tersebut patut dicabut#3840#;#3848##3843##3844##3850#'),
    ],
    inti_kabul_akhir=dict(
        kontra='Menimbang, bahwa berdasarkan pertimbangan-pertimbangan tersebut di atas, #0053# #0046# beralasan hukum dan patut dikabulkan sebagaimana tersebut dalam amar putusan ini;',
        verstek='Menimbang, bahwa berdasarkan pertimbangan-pertimbangan tersebut di atas, #0053# #0046# beralasan hukum dan patut dikabulkan dengan verstek sebagaimana tersebut dalam amar putusan ini;'),
    inti_tolak=[
        ('body',
         'Menimbang, bahwa berdasarkan fakta hukum tersebut di atas, alasan pencabutan kekuasaan wali yang didalilkan #0046#, sebagaimana dimaksud dalam #3835#, tidak terbukti terpenuhi oleh '
         '#0047# sebagai wali atas #4407# tersebut;'),
    ],
    inti_tolak_akhir=dict(
        kontra='Menimbang, bahwa #3855#, sehingga dalil-dalil #0053# #0046# tidak terbukti dan #0053# #0046# tidak beralasan hukum serta harus ditolak;',
        verstek='Menimbang, bahwa meskipun #0047# tidak pernah hadir dan tidak membantah dalil-dalil #0053# #0046#, oleh karena #3855#, maka sesuai Pasal 149 ayat (1) RBg #0053# #0046# yang tidak '
                'beralasan hukum harus ditolak;'),
    amar_kabul=[
        'Mencabut kekuasaan #0047# sebagai wali atas #4407# yang bernama #4406##3840##3845##3846##3851#;',
    ],
    amar_tolak=['Menolak #0053# #0046#;'],
)

# ---------------------------------------------------------------------------------------------------------------------------------
# PERMOHONAN (Pdt.P): Pemohon = orang tua / kerabat anak / calon wali pengganti; tanpa Termohon
# ---------------------------------------------------------------------------------------------------------------------------------
PERMOHONAN = dict(
    # urutan: paragraf-paragraf permohonan disusun dari berkas dasar 4d Hibah [01p]/[03p]/[99p] oleh permohonan.py
    penjelasan='pencabutan kekuasaan wali, alasan, dan akibat hukumnya, antara lain bahwa dalam hal kekuasaan seorang wali dicabut maka oleh Pengadilan ditunjuk orang lain sebagai wali',
    pengakuan='bahwa #0046# adalah #3831# dari #4407# yang bernama #4406#, bahwa #3838#, dan #0046# mohon agar kekuasaan #3853# sebagai wali atas #4407# tersebut dicabut',
    token_bukti='#3854#',
    tokens_tersembunyi='#3830# #3832# #3834# #3838# #3841# #3842# #3849# #3852# #3857#',
    penjelasan_bas='pencabutan kekuasaan wali, alasan dan akibat hukumnya, serta kewajiban wali untuk mengurus diri dan harta anak dengan sebaik-baiknya dan mempertanggungjawabkannya',
    kewenangan=(
        'Menimbang, bahwa #0053# #0046# pada pokoknya mengenai pencabutan kekuasaan wali antara orang-orang yang beragama Islam, maka berdasarkan ' + KEWENANGAN_PUSTAKA + ', perkara a quo '
        'termasuk kewenangan absolut Pengadilan Agama;'),
    standing=(
        'Menimbang, bahwa #0046# adalah #3831# dari #4407# yang bernama #4406# dan #3853# adalah wali dari #4407# tersebut#3833#, sehingga berdasarkan Pasal 109 Kompilasi Hukum Islam yang memberi '
        'hak kepada kerabat untuk memohon pencabutan hak perwalian, Pasal 19 ayat (2) Peraturan Pemerintah Nomor 29 Tahun 2019 tentang Syarat dan Tata Cara Penunjukan Wali yang memberi hak '
        'mengajukan permohonan pencabutan kuasa asuh sebagai wali kepada orang tua atau orang atau badan hukum yang akan ditunjuk sebagai wali, serta Pasal 53 ayat (1) jo. Pasal 49 ayat (1) '
        'Undang-Undang Nomor 1 Tahun 1974 tentang Perkawinan, #0046# mempunyai kepentingan hukum (legal standing) untuk mengajukan #0053# a quo;'),
    fakta=[
        'Bahwa #0046# adalah #3831# dari #4407# yang bernama #4406# dan #3853# adalah wali dari #4407# tersebut#3833#;',
        'Bahwa #4407# tersebut saat ini belum berumur 18 (delapan belas) tahun dan belum pernah melangsungkan perkawinan;',
        'Bahwa #3838#;',
    ],
    fakta_no=[
        'Bahwa #0046# mengaku sebagai #3831# dari #4407# yang bernama #4406#;',
        'Bahwa #4407# tersebut saat ini belum berumur 18 (delapan belas) tahun dan belum pernah melangsungkan perkawinan;',
    ],
    hukum=HUKUM_INTI,
    kabul=[
        'Menimbang, bahwa berdasarkan fakta hukum tersebut di atas, terbukti bahwa #3837#, yang merupakan alasan pencabutan kekuasaan wali sebagaimana dimaksud dalam #3835#, sehingga alasan '
        'untuk mencabut kekuasaan #3853# sebagai wali atas #4407# tersebut telah terpenuhi menurut hukum;',
        'Menimbang, bahwa dengan memperhatikan kepentingan terbaik anak, #8554# berpendapat bahwa kekuasaan #3853# sebagai wali atas #4407# tersebut patut dicabut#3840#;#3848##3843##3844##3850#',
        'Menimbang, bahwa oleh karena itu #0053# #0046# beralasan hukum dan patut dikabulkan;',
    ],
    amar_kabul=[
        'Mengabulkan #0053# #0046#;',
        'Mencabut kekuasaan #3853# sebagai wali atas #4407# yang bernama #4406##3840##3845##3846##3851#;',
    ],
    tolak=[
        'Menimbang, bahwa berdasarkan fakta hukum tersebut di atas, alasan pencabutan kekuasaan wali yang didalilkan #0046#, sebagaimana dimaksud dalam #3835#, tidak terbukti terpenuhi oleh '
        '#3853# sebagai wali atas #4407# tersebut;',
        'Menimbang, bahwa #3855#, sehingga dalil-dalil #0053# #0046# tidak terbukti dan #0053# #0046# tidak beralasan hukum serta harus ditolak;',
    ],
    amar_tolak=['Menolak #0053# #0046#;'],
    no=[
        'Menimbang, bahwa #3856#, sehingga #0053# #0046# tidak memenuhi syarat formil dan harus dinyatakan tidak dapat diterima (niet ontvankelijk verklaard);',
    ],
    amar_no=['Menyatakan #0053# #0046# tidak dapat diterima;'],
)

SPEK['gugatan'] = GUGATAN
SPEK['permohonan'] = PERMOHONAN


# ---------------------------------------------------------------------------------------------------------------------------------
# Penyusunan khusus jenis ini: sama dengan bangun_semua (putusan gugatan + BAS gugatan + penetapan permohonan + BAS permohonan), ditambah
# daftar isian-asal pada BAS pembuktian ALUR 04-09 (kontradiktoir). Berkas dasar 6c - BAS untuk ALUR 04 [6]/[7] tidak membawa kelompok
# {\*\isianasal ...}, sehingga isian bahan jawaban saksi (hubungan pengaju, huruf alasan, wali pengganti, dst.) tidak ditanyakan ABT pada
# sidang pembuktian; kelompok itu ditambahkan di akhir berkas (letak yang sama dengan berkas ALUR 46 verstek). Berkas yang sudah memuatnya tidak disentuh.
# ---------------------------------------------------------------------------------------------------------------------------------
SAKSI_TANYA_JAWAB = ('5058', '5059', '5060', '6124', '8931', '6120', '6121', '8921', '8941')


def bangun(S):
    import os
    import re
    import bas
    import gugatan
    import permohonan
    from bangun import simpan
    from pustaka import KELUAR, lp

    n = len(gugatan.susun_semua(S)) + len(bas.klon_gugatan(S)) + len(permohonan.susun_semua(S)) + len(bas.klon_permohonan(S))
    folder = os.path.join(KELUAR, S['folder'] + ' - BAS')
    kelompok = chr(92) + '*' + chr(92) + 'isianasal '
    token = ' '.join('#%04d#' % x for x in S['isian_bas'])
    for f in sorted(os.listdir(lp(folder))):
        if not f.lower().endswith('.rtf'):
            continue
        jalur = os.path.join(folder, f)
        with open(lp(jalur), 'rb') as fh:
            isi = fh.read().decode('latin1')
        if kelompok in isi:
            continue
        if not any(re.search(r'#%s#' % t, isi) for t in SAKSI_TANYA_JAWAB):
            continue
        akhir = isi.rstrip()
        if not akhir.endswith('}'):
            raise ValueError('%s: akhir RTF tidak berupa kurung penutup' % f)
        simpan(jalur, akhir[:-1] + '{' + kelompok + token + '}}')
    return n
