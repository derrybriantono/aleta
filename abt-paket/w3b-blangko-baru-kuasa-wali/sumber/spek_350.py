# -*- coding: utf-8 -*-
"""Spesifikasi blangko NAFKAH ANAK OLEH IBU KARENA AYAH TIDAK MAMPU (jenis SIPP 350; folder "6h Nafkah Anak oleh Ibu").

Beda dengan 743 (nafkah anak pasca perceraian): pokoknya BUKAN menghukum ayah membayar sebanyak-banyaknya, melainkan
  (1) menetapkan ayah dalam kenyataan tidak (sepenuhnya) dapat memenuhi kewajibannya,
  (2) menetapkan ibu ikut memikul biaya pemeliharaan dan pendidikan anak (besar bagian ibu),
  (3) bila ayah masih mampu sebagian: menghukum ayah membayar bagiannya setiap bulan (kenaikan opsional),
  (4) biaya perkara.
Kemampuan ayah/ibu dan besar biaya adalah penilaian hakim -> isian pilihan; mesin hanya menghitung selisih dan menyusun kalimat.

Dasar hukum (terverifikasi dengan naskah resmi di D:/aleta-dev/kerja/referensi/_unduhan; rinci di spek/PASAL-350.md):
  Pasal 41 huruf b, Pasal 45 ayat (1)-(2) UU 1/1974 (naskah BPK); Pasal 105 huruf c, Pasal 156 huruf d-f, Pasal 98 ayat (3) KHI;
  Pasal 26 ayat (1)-(2) UU 23/2002 sebagaimana diubah UU 35/2014; Pasal 49 huruf a beserta penjelasan angka 12 UU 7/1989 jo. UU 3/2006 jo. UU 50/2009;
  rumusan Kamar Agama yang sudah tercetak di blangko 6c: SEMA 3/2018 (Hukum Keluarga huruf b), SEMA 3/2015 angka 14, Buku II 2026.
Variabel baru: sumber/variabel_350.py (3920-3939). Variabel lama yang dipakai: #9300# #9301# (kedudukan Penggugat/Tergugat) #4406# #4407# (nama anak / sebutan anak).

Sita jaminan: sita=False. Sita jaminan atas harta ayah bertentangan dengan dalil pokok jenis ini (ayah dalam kenyataan tidak mampu), dan bagian ayah yang masih
dibebankan tidak memerlukan agunan; karena itu #9755#/#9756# (angkat sita) dikosongkan di semua berkas. Bila ada sita jaminan, perkara itu jenis 743.
"""
import os

import bas
import gugatan
from pustaka import Berkas, Rakit

SPEK = dict(
    kode='350',
    kunci='nafkah-anak-ibu',
    label='nafkah anak oleh ibu karena ayah tidak mampu',
    nama_berkas='Nafkah Anak oleh Ibu',
    folder='6h Nafkah Anak oleh Ibu',
    # isian bahan jawaban saksi di BAS: fakta keadaan ayah, kemampuan ibu, kebutuhan biaya anak, dasar kebutuhan, pengasuh anak (katalog saksi nafkah-anak.json,
    # syarat jenisPerkaraId ['743','350']); alasan huruf, bagian ayah dan kenaikan adalah penilaian hakim sehingga tidak ikut.
    isian_bas=[3921, 3922, 3923, 3932, 3933],
    perdamaian=True,    # perselisihan biaya pemeliharaan anak antara kedua orang tua dapat diakhiri dengan akta perdamaian (Pasal 154 RBg; PERMA 1/2016)
    sita=False,
)

HUKUM_INTI = [
    ('body',
     'Menimbang, bahwa menurut Pasal 45 ayat (1) dan ayat (2) Undang-Undang Nomor 1 Tahun 1974 tentang Perkawinan, kedua orang tua wajib memelihara dan mendidik anak-anak mereka sebaik-baiknya, dan '
     'kewajiban itu berlaku sampai anak itu kawin atau dapat berdiri sendiri, kewajiban mana berlaku terus meskipun perkawinan antara kedua orang tua putus; selanjutnya Pasal 41 huruf b Undang-Undang '
     'yang sama menentukan bahwa bapak bertanggung jawab atas semua biaya pemeliharaan dan pendidikan yang diperlukan anak itu; bilamana bapak dalam kenyataan tidak dapat memenuhi kewajiban tersebut, '
     'Pengadilan dapat menentukan bahwa ibu ikut memikul biaya tersebut;'),
    ('body',
     'Menimbang, bahwa ketentuan tersebut sejalan dengan Pasal 105 huruf c Kompilasi Hukum Islam yang menentukan bahwa biaya pemeliharaan anak ditanggung oleh ayahnya, dan Pasal 156 huruf d '
     'Kompilasi Hukum Islam yang menentukan bahwa semua biaya hadhanah dan nafkah anak menjadi tanggungan ayah menurut kemampuannya, sekurang-kurangnya sampai anak tersebut dewasa dan dapat mengurus '
     'diri sendiri (21 tahun); sedangkan menurut Pasal 156 huruf e dan huruf f Kompilasi Hukum Islam, bilamana terjadi perselisihan mengenai hadhanah dan nafkah anak, Pengadilan Agama memberikan '
     'putusannya dan dapat pula dengan mengingat kemampuan ayahnya menetapkan jumlah biaya untuk pemeliharaan dan pendidikan anak-anak yang tidak turut padanya;'),
    ('body',
     'Menimbang, bahwa Pasal 26 ayat (1) huruf a Undang-Undang Nomor 23 Tahun 2002 tentang Perlindungan Anak sebagaimana telah diubah dengan Undang-Undang Nomor 35 Tahun 2014 menentukan bahwa '
     'orang tua berkewajiban dan bertanggung jawab untuk mengasuh, memelihara, mendidik, dan melindungi anak, dan Pasal 26 ayat (2) menentukan bahwa dalam hal orang tua tidak ada, atau tidak diketahui '
     'keberadaannya, atau karena suatu sebab tidak dapat melaksanakan kewajiban dan tanggung jawabnya, maka kewajiban dan tanggung jawab tersebut dapat beralih kepada keluarga; '
     'selain itu Pasal 98 ayat (3) Kompilasi Hukum Islam menentukan bahwa Pengadilan Agama dapat menunjuk salah seorang kerabat terdekat yang mampu menunaikan kewajiban tersebut apabila kedua '
     'orang tuanya tidak mampu, sehingga ketentuan terakhir ini baru dapat diterapkan apabila kedua orang tua anak sama-sama tidak mampu, sedangkan #0053# a quo diajukan oleh #0046# berdasarkan '
     'Pasal 41 huruf b Undang-Undang Nomor 1 Tahun 1974 sehingga yang dinilai adalah kemampuan ayah dan kemampuan ibu;'),
]

GUGATAN = dict(
    judul_inti='Pembagian Biaya Pemeliharaan dan Pendidikan Anak antara Ibu dan Ayah',
    kewenangan=(
        'Menimbang, bahwa #0053# #0046# pada pokoknya mengenai penentuan agar #0046# selaku #3929# ikut memikul biaya pemeliharaan dan pendidikan #4407# yang bernama #4406# yang lahir dari '
        'perkawinan #0046# dan #0047# yang dilangsungkan menurut hukum Islam dan telah putus karena perceraian, karena #0047# selaku #9301# dalam kenyataan tidak dapat memenuhi seluruh kewajibannya, '
        'yaitu tuntutan agar ditetapkan bagian biaya yang dipikul oleh #0046# dan bagian biaya yang tetap ditanggung oleh #0047#; oleh karena perkara ini menyangkut biaya pemeliharaan dan '
        'pendidikan anak sebagai akibat putusnya perkawinan, maka berdasarkan Pasal 49 huruf a beserta penjelasannya angka 12 Undang-Undang Nomor 7 Tahun 1989 tentang Peradilan Agama sebagaimana '
        'telah diubah dengan Undang-Undang Nomor 3 Tahun 2006 dan perubahan kedua dengan Undang-Undang Nomor 50 Tahun 2009 jo. Pasal 41 huruf b Undang-Undang Nomor 1 Tahun 1974 tentang Perkawinan, '
        'perkara a quo termasuk kewenangan absolut Pengadilan Agama;'),
    kewenangan_ringkas=(
        'Menimbang, bahwa #0053# #0046# pada pokoknya mengenai penentuan bagian biaya pemeliharaan dan pendidikan anak yang dipikul ibu karena ayah dalam kenyataan tidak dapat memenuhi kewajibannya '
        'antara orang-orang yang beragama Islam, maka berdasarkan Pasal 49 huruf a beserta penjelasannya angka 12 Undang-Undang Nomor 7 Tahun 1989 tentang Peradilan Agama sebagaimana telah diubah '
        'dengan Undang-Undang Nomor 3 Tahun 2006 dan perubahan kedua dengan Undang-Undang Nomor 50 Tahun 2009, perkara a quo termasuk kewenangan absolut Pengadilan Agama;'),
    standing=(
        'Menimbang, bahwa berdasarkan #0053# dan keterangan para pihak, #0046# adalah #3929# dan #0047# adalah #9301# dari #4407# yang bernama #4406#, sehingga berdasarkan Pasal 41 huruf b '
        'Undang-Undang Nomor 1 Tahun 1974 tentang Perkawinan yang memberi kewenangan kepada Pengadilan untuk menentukan bahwa ibu ikut memikul biaya pemeliharaan dan pendidikan anak, jo. Pasal 156 '
        'huruf d dan huruf f Kompilasi Hukum Islam, #0046# mempunyai kepentingan hukum (persona standi in judicio) untuk mengajukan #0053# a quo terhadap #0047#;'),
    standing_no=(
        'Menimbang, bahwa berdasarkan #0053# dan keterangan para pihak, #0046# adalah #3929# dan #0047# adalah #9301# dari #4407# yang bernama #4406#, sehingga #0046# dan #0047# '
        'sama-sama mempunyai hubungan hukum dengan perkara a quo;'),
    isu=[
        'Apakah #4407# yang bernama #4406# berada dalam asuhan nyata #0046# dan apakah #0046# nyata-nyata ikut membiayai kebutuhan #4407# tersebut?',
        'Apakah #0047# selaku #9301# dalam kenyataan tidak dapat memenuhi seluruh kewajibannya membiayai pemeliharaan dan pendidikan #4407# tersebut?',
        'Apakah #0046# mampu dan patut ikut memikul biaya pemeliharaan dan pendidikan #4407# tersebut, dan berapa kebutuhan biaya #4407# tersebut setiap bulan?',
        'Berapa bagian biaya yang patut dipikul oleh #0046# dan berapa bagian yang tetap harus ditanggung oleh #0047# sesuai kemampuannya?',
    ],
    fakta=[
        'Bahwa #0046# dan #0047# dahulu adalah suami istri yang menikah menurut hukum Islam, dan perkawinan tersebut telah putus karena perceraian;',
        'Bahwa dari perkawinan tersebut lahir #4407# bernama #4406#;',
        'Bahwa #3933#;',
        'Bahwa #3921#;',
        'Bahwa #3922#;',
    ],
    inti_hukum=HUKUM_INTI,
    inti_kabul=[
        ('body',
         'Menimbang, bahwa berdasarkan fakta hukum tersebut di atas, terbukti bahwa #0047# selaku #9301# dari #4407# tersebut dalam kenyataan tidak dapat memenuhi seluruh kewajibannya untuk '
         'membiayai pemeliharaan dan pendidikan #4407# tersebut karena #3939#, sehingga syarat yang ditentukan Pasal 41 huruf b Undang-Undang Nomor 1 Tahun 1974 tentang Perkawinan agar '
         'Pengadilan dapat menentukan bahwa ibu ikut memikul biaya tersebut telah terpenuhi;#3934#'),
        ('body',
         'Menimbang, bahwa pembagian biaya tersebut ditetapkan demi kepentingan terbaik anak agar kebutuhan pemeliharaan dan pendidikan #4407# tersebut tetap terpenuhi, tanpa menghilangkan '
         'kewajiban #0047# selaku #9301# sebagaimana Pasal 45 ayat (2) Undang-Undang Nomor 1 Tahun 1974 tentang Perkawinan dan Pasal 26 ayat (1) huruf a Undang-Undang Nomor 23 Tahun 2002 tentang '
         'Perlindungan Anak sebagaimana telah diubah dengan Undang-Undang Nomor 35 Tahun 2014;'),
    ],
    inti_kabul_akhir=dict(
        kontra='Menimbang, bahwa berdasarkan pertimbangan-pertimbangan tersebut di atas, #0053# #0046# beralasan hukum dan patut dikabulkan sebagaimana tersebut dalam amar putusan ini;',
        verstek='Menimbang, bahwa berdasarkan pertimbangan-pertimbangan tersebut di atas, #0053# #0046# beralasan hukum dan patut dikabulkan dengan verstek sebagaimana tersebut dalam amar putusan ini;'),
    inti_tolak=[
        ('body',
         'Menimbang, bahwa penentuan agar ibu ikut memikul biaya pemeliharaan dan pendidikan anak menurut Pasal 41 huruf b Undang-Undang Nomor 1 Tahun 1974 tentang Perkawinan mensyaratkan bahwa '
         'ayah dalam kenyataan tidak dapat memenuhi kewajibannya, sehingga menurut Pasal 283 RBg #0046# wajib membuktikan keadaan tersebut serta besar kebutuhan biaya anak dan kemampuannya sendiri;'),
    ],
    inti_tolak_akhir=dict(
        kontra='Menimbang, bahwa #3936#, sehingga dalil-dalil #0053# #0046# tidak terbukti dan #0053# #0046# tidak beralasan hukum serta harus ditolak;',
        verstek='Menimbang, bahwa meskipun #0047# tidak pernah hadir dan tidak membantah dalil-dalil #0053# #0046#, oleh karena #3936#, maka sesuai Pasal 149 ayat (1) RBg #0053# #0046# yang '
                'tidak beralasan hukum harus ditolak;'),
    amar_kabul=[
        'Menetapkan bahwa #0047# selaku #9301# dari #4407# yang bernama #4406# dalam kenyataan tidak dapat memenuhi seluruh kewajibannya untuk membiayai pemeliharaan dan pendidikan #4407# '
        'tersebut, dan menetapkan #0046# selaku #3929# ikut memikul biaya tersebut, dengan pembagian setiap bulan sebagai berikut:#3935#',
    ],
    amar_tolak=['Menolak #0053# #0046#;'],
)
SPEK['gugatan'] = GUGATAN

# Berkas "umum" (gugur, cabut, coret, NO) memakai kerangka 6c: kata-kata nafkah anak hasil rakitan tidak boleh tersisa. Penggantian di bawah menyentuh paragraf yang
# tidak dikendalikan SPEK (teks tetap berkas dasar), dan bagian bukti surat Penggugat (#9955# bukti perceraian -> #3938# bukti perkara ini).
LABEL = SPEK['label']
GANTI_PUTUSAN = [('#9955#', '#3938#'),
                 # ganti_umum bersama menjalankan 'dalam perkara nafkah anak' lalu 'khusus dalam perkara nafkah anak' berturut-turut; karena label diawali 'nafkah anak',
                 # frasa kedua mengenai hasil frasa pertama dan label tercetak dua kali -> dirapikan di sini.
                 (LABEL + ' oleh ibu karena ayah tidak mampu', LABEL)]


def _tambal(path, penggantian):
    """Membuka berkas putusan keluaran dan mengganti frasa pada paragraf mana pun yang memuatnya (lewat peta RTF: gaya paragraf terjaga); menulis ulang berkas yang sama."""
    b = Berkas(path)
    r = Rakit(b)
    for i in range(b.n):
        if any(lama in b.t[i] for lama, _ in penggantian):
            r.frasa(i, penggantian)
        else:
            r.raw(i)
    r.selesai(path)


def bangun(S):
    """gugatan.susun_semua + bas.klon_gugatan lalu satu tambalan lokal atas putusan (modul bersama tidak diubah):
    bukti surat Penggugat #9955# -> #3938#, label yang tercetak dua kali dirapikan, dan cacat formil [99b] memakai isian 3937.
    (Amar BAS verstek diganti amar jenis ini oleh bas.klon_gugatan bersama.)"""
    berkas = gugatan.susun_semua(S)
    for p in berkas:
        ganti = list(GANTI_PUTUSAN)
        if os.path.basename(p).startswith('[99b]'):
            ganti.append(('#9651#', '#3937#'))     # cacat formil: isian jenis ini menggantikan isian umum 9651 (contoh objek sengketa tanah)
        _tambal(p, ganti)
    keluar = bas.klon_gugatan(S)
    return len(berkas) + len(keluar)
