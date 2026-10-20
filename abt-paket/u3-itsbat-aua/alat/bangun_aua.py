# -*- coding: utf-8 -*-
"""Membangun blangko BARU asal usul anak dari [01] [Kabul] AUA.rtf (agen U3, 20 Okt 2026):
  [01a] [Kabul] AUA - Perkawinan Siri Dicatat Kemudian, Anak Lahir Sebelum Pencatatan (rukun dan syarat, pencatatan administratif)
  [01b] [Kabul] AUA - Anak Luar Perkawinan Sah, Hubungan Perdata (Pemohon Ibu Saja atau Perkawinan Siri Poligami)
  [01c] [Kabul] AUA - Anak Lahir Kurang dari Enam Bulan setelah Akad Nikah
Berkas lama tidak disentuh."""
import hashlib, os, re, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from rtflib import Berkas, buat_dari, polos, ubah_teks  # noqa: E402

AKAR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASLI = os.environ.get('ASLI_DERRY', r'D:\Aplikasi\aleta\tmp\u3\asli')
FOLDER = '8 Asal Usul Anak'
SUMBER = '[01] [Kabul] AUA - Anak Sah dari Perkawinan Tercatat, Belum Punya Akta Kelahiran.rtf'
KELUAR = os.path.join(AKAR, 'paket-satker', 'rtf', 'derry_briantono', FOLDER)
A = '[01a] [Kabul] AUA - Perkawinan Siri Dicatat Kemudian, Anak Lahir Sebelum Pencatatan.rtf'
B = '[01b] [Kabul] AUA - Anak Luar Perkawinan Sah, Hubungan Perdata (Ibu Saja atau Perkawinan Siri).rtf'
C = '[01c] [Kabul] AUA - Anak Lahir Kurang dari Enam Bulan setelah Akad Nikah.rtf'
TAB = chr(9)


def muat():
    return Berkas(os.path.join(ASLI, FOLDER, SUMBER))


def ubah_cari(b, potongan, fn):
    i = b.cari(potongan)
    b.par[i] = ubah_teks(b.par[i], fn)
    return i


def sisip_sebelum(b, potongan, daftar_teks):
    i = b.cari(potongan)
    contoh = b.par[i]
    b.par[i:i] = [buat_dari(contoh, t) for t in daftar_teks]


# ------------------------------------------------------------------------------------------------------------ [01a]
A_UMUM = ('Menimbang, bahwa untuk menetapkan asal usul anak, terlebih dahulu harus dipastikan sah atau tidaknya perkawinan orang tua anak itu pada saat anak dilahirkan; '
          'bahwa menurut Pasal 2 ayat (1) Undang-Undang Nomor 1 Tahun 1974 tentang Perkawinan jo. Pasal 4 Kompilasi Hukum Islam, perkawinan adalah sah apabila dilakukan '
          'menurut hukum masing-masing agamanya dan kepercayaannya itu, sedangkan pencatatan perkawinan menurut Pasal 2 ayat (2) undang-undang tersebut merupakan kewajiban '
          'administratif yang tidak menentukan sah atau tidaknya perkawinan;')
A_RUKUN = ('Menimbang, bahwa berdasarkan fakta angka 1 dan angka 2, perkawinan para #0046# yang dilangsungkan menurut hukum Islam pada tanggal #5197# di #5105# telah '
           'dilaksanakan dengan wali nikah #1046# bernama #1217#, yang menikahkan #8087#, disaksikan oleh dua orang saksi nikah yaitu #0650# dan #0651#, dengan mahar berupa '
           '#1001#, serta ijab dan kabul oleh para #0046#, sehingga seluruh rukun perkawinan sebagaimana dimaksud Pasal 14 Kompilasi Hukum Islam telah terpenuhi dan antara '
           'para #0046# tidak terdapat halangan perkawinan sebagaimana dimaksud Pasal 39 sampai dengan Pasal 44 Kompilasi Hukum Islam;')
A_CATAT = ('Menimbang, bahwa meskipun perkawinan para #0046# baru dicatat secara resmi #8605#, yaitu sesudah anak tersebut dilahirkan, pencatatan itu tidak menghilangkan '
           'keabsahan perkawinan yang telah dilangsungkan sebelumnya menurut hukum Islam sebagaimana ditegaskan dalam Penjelasan Umum angka 4 huruf b Undang-Undang Nomor 1 '
           'Tahun 1974 tentang Perkawinan dan pertimbangan Putusan Mahkamah Konstitusi Nomor 46/PUU-VIII/2010, sehingga anak yang lahir pada masa perkawinan tersebut tetap '
           'merupakan anak yang lahir dalam perkawinan yang sah;')


def bangun_a():
    b = muat()
    ubah_cari(b, 'Bahwa pernikahan para #0046# tersebut telah dilangsungkan secara resmi yang tercatat',
              lambda t: t.replace('Bahwa pernikahan para #0046# tersebut telah dilangsungkan secara resmi yang tercatat #8605#',
                                  'Bahwa selanjutnya pernikahan para #0046# tersebut dicatat secara resmi, yaitu #8605#'))
    ubah_cari(b, 'Bahwa dari pernikahan tersebut telah lahir anak yang bernama', lambda t: t.replace('yang lahir #9709#;', 'yang lahir #9709##4313#;'))
    sisip_sebelum(b, 'Menimbang, bahwa menurut Pasal 42 Undang-Undang Nomor 1 Tahun 1974', [A_UMUM, A_RUKUN, A_CATAT])
    ubah_cari(b, 'Menimbang, bahwa menurut Pasal 42 Undang-Undang Nomor 1 Tahun 1974',
              lambda t: t.replace('lahir dari perkawinan para #0046# yang sah dan tercatat', 'lahir dalam perkawinan para #0046# yang sah menurut hukum Islam dan kemudian dicatat secara resmi'))
    return b


# ------------------------------------------------------------------------------------------------------------ [01c]
C_JARAK = ('Menimbang, bahwa anak yang bernama #8602# dilahirkan #9709##4313#; bahwa menurut Pasal 99 huruf a Kompilasi Hukum Islam dan Pasal 42 Undang-Undang Nomor 1 '
           'Tahun 1974 tentang Perkawinan, anak sah adalah anak yang dilahirkan dalam atau sebagai akibat perkawinan yang sah, sedangkan Pasal 53 Kompilasi Hukum Islam '
           'membolehkan wanita hamil dikawinkan dengan pria yang menghamilinya tanpa perkawinan ulang setelah anak lahir;')
C_RUKUN = A_RUKUN
C_STATUS = ('Menimbang, bahwa oleh karena anak tersebut dilahirkan kurang dari enam bulan setelah akad nikah, maka berdasarkan fakta persidangan dan pertimbangan di atas '
            '#8554# berpendapat bahwa anak yang bernama #8602# yang dilahirkan oleh #0046# II (#1033#) dari #0046# I (#0098#) adalah #4315#;')


def bangun_c():
    b = bangun_a()
    ubah_cari(b, 'Menimbang, bahwa menurut Pasal 42 Undang-Undang Nomor 1 Tahun 1974',
              lambda t: C_STATUS)
    sisip_sebelum(b, 'Menimbang, bahwa oleh karena anak tersebut dilahirkan kurang', [C_JARAK])
    ubah_cari(b, 'Menetapkan bahwa anak yang bernama #8602#',
              lambda t: t.replace('adalah anak sah dari #0046# I (#0098#) dan #0046# II (#1033#)', 'yang dilahirkan oleh #0046# II (#1033#) dari #0046# I (#0098#), adalah #4315#'))
    return b


# ------------------------------------------------------------------------------------------------------------ [01b]
B_FAKTA = [
    '1.' + TAB + 'Bahwa #0046# telah melahirkan anak yang bernama #8602#, yang lahir #9709#;',
    '2.' + TAB + 'Bahwa anak tersebut dilahirkan di luar perkawinan yang sah menurut hukum, dan laki-laki yang diakui sebagai ayah biologisnya adalah #4311#;',
    '3.' + TAB + 'Bahwa anak tersebut belum mempunyai akta kelahiran karena #9710#;',
]
B_PERTIMBANGAN = [
    'Menimbang, bahwa menurut Pasal 42 Undang-Undang Nomor 1 Tahun 1974 tentang Perkawinan dan Pasal 99 huruf a Kompilasi Hukum Islam, anak sah adalah anak yang dilahirkan '
    'dalam atau sebagai akibat perkawinan yang sah; bahwa anak yang bernama #8602# dilahirkan di luar perkawinan yang sah, sehingga bukan anak sah dari laki-laki yang '
    'diakui sebagai ayah biologisnya;',
    'Menimbang, bahwa menurut Pasal 100 Kompilasi Hukum Islam dan Pasal 43 ayat (1) Undang-Undang Nomor 1 Tahun 1974 tentang Perkawinan, anak yang lahir di luar '
    'perkawinan yang sah mempunyai hubungan nasab dan hubungan perdata dengan ibunya dan keluarga ibunya; bahwa berdasarkan Putusan Mahkamah Konstitusi Nomor 46/PUU-VIII/2010, '
    'anak tersebut juga mempunyai hubungan perdata dengan laki-laki sebagai ayahnya yang dapat dibuktikan berdasarkan ilmu pengetahuan dan teknologi dan/atau alat bukti lain '
    'menurut hukum mempunyai hubungan darah;',
    'Menimbang, bahwa berdasarkan fakta persidangan dan ketentuan tersebut, #8554# menetapkan bahwa anak yang bernama #8602# #4314#;',
]


def bangun_b():
    b = muat()
    # saksi: dirangkai ulang untuk Pemohon ibu saja
    j = b.cari('mengajukan 2 (dua) orang saksi pada persidangan yang sama')

    def p15(t):
        mulai = t.index('1.' + TAB + '#1197#')
        awal = t[:mulai]
        bullets = ['Bahwa saksi kenal dengan #0046# karena saksi adalah #%s#;', 'Bahwa saksi mengetahui maksud #0046# menghadap di persidangan yaitu terkait asal usul anak;',
                   'Bahwa #0046# adalah ibu yang melahirkan anak yang bernama #8602#, yang lahir #9709#;', 'Bahwa #8607#;',
                   'Bahwa ayah biologis anak tersebut adalah #4311#;', 'Bahwa anak tersebut belum mempunyai akta kelahiran karena #9710#;',
                   'Bahwa anak tersebut diasuh dan dibiayai sehari-hari oleh #0046#;', 'Bahwa tidak ada lagi yang ingin disampaikan saksi pada persidangan ini;']
        ident = {1: '1.' + TAB + '#1197#, umur #1198# tahun, agama #1199#, pendidikan #1200#, pekerjaan #1201#, bertempat tinggal di #1202#, yang telah bersumpah menurut tata cara agama Islam, dan memberikan keterangan pada pokoknya sebagai berikut:',
                 2: '2.' + TAB + '#1203#, umur #1204# tahun, agama #1205#, pendidikan #1206#, pekerjaan #1207#, bertempat tinggal di #1208#, yang telah bersumpah menurut tata cara agama Islam, dan memberikan keterangan pada pokoknya sebagai berikut:'}
        hub = {1: '1241', 2: '1242'}
        isi = []
        for n in (1, 2):
            isi.append(ident[n])
            for bl in bullets:
                isi.append('-' + TAB + (bl % hub[n] if '%s' in bl else bl))
        sisa = t[t.index('Bahwa atas keterangan masing-masing saksi tersebut'):]
        return awal + '\n'.join(isi) + '\n' + sisa

    b.par[j] = ubah_teks(b.par[j], p15)
    # fakta hukum 1-5 -> 3 butir baru; 3 paragraf pertimbangan status anak
    i1 = b.cari('Bahwa #0046# I dan #0046# II telah menikah secara agama Islam pada tanggal')
    i5 = b.cari('Bahwa anak tersebut belum mempunyai akta kelahiran karena #9710#;', i1)
    contoh = b.par[i1]
    b.par[i1:i5 + 1] = [buat_dari(contoh, t) for t in B_FAKTA]
    i_sah = b.cari('Menimbang, bahwa menurut Pasal 42 Undang-Undang Nomor 1 Tahun 1974')
    b.par[i_sah:i_sah + 1] = [buat_dari(b.par[i_sah], t) for t in B_PERTIMBANGAN]
    ubah_cari(b, 'Menetapkan bahwa anak yang bernama #8602#',
              lambda t: t.replace('adalah anak sah dari #0046# I (#0098#) dan #0046# II (#1033#);', 'adalah anak yang dilahirkan #0046# (#0098#) di luar perkawinan yang sah dan #4314#;'))
    # sebutan: Pemohon tunggal
    for i, p in enumerate(b.par):
        b.par[i] = ubah_teks(p, lambda t: (t.replace('para #0046#', '#0046#').replace('Para #0046#', '#0046#').replace('#0046# I dan #0046# II', '#0046#')
                                           .replace('Menimbang, bahwa #0046# adalah ayah dan ibu dari anak yang dimohonkan penetapan asal usulnya',
                                                    'Menimbang, bahwa #0046# adalah ibu yang melahirkan anak yang dimohonkan penetapan asal usulnya')
                                           .replace('dari perkawinan #0046# yang dilangsungkan pada tanggal #5197# di #5105#', 'dari hubungannya dengan #4311#')))
    return b


def tulis(b, nama):
    os.makedirs(KELUAR, exist_ok=True)
    data = b.simpan(os.path.join(KELUAR, nama))
    return nama, len(data), hashlib.md5(data).hexdigest()


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    print(tulis(bangun_a(), A))
    print(tulis(bangun_b(), B))
    print(tulis(bangun_c(), C))
