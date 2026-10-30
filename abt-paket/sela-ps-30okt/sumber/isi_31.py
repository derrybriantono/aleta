# -*- coding: utf-8 -*-
"""Blangko tambahan sesudah jawaban pengguna 30 Okt (13 butir): eksepsi lain, rekonvensi, penggabungan, sumpah pemutus/penaksir/li'an,
mediasi tidak beriktikad baik (PERMA 1/2016 Pasal 22-23), BAS sumpah (tunda / lalu putus), BAS pemeriksaan setempat cerai kumulasi harta bersama.
Mediasi elektronik (PERMA 3/2022) dirakit dari blangko mediasi yang ada di bangun_paket.py (ubah_mediasi_elektronik)."""
from isi import (F_SELA, F_SELA_BAS, LANJUT, TANGGUH, TIMBANG_PA49, amar, bas_kepala, bas_tutup, bas_umum_awal, biaya_sela, kaki, kepala,
                 penutup_duduk)

# ---------------------------------------------------------------------------------------------------------------------------
# A. EKSEPSI LAIN (bukan kewenangan): dikabulkan = PUTUSAN akhir NO; ditolak = SISIPAN bagian "Dalam Eksepsi" untuk putusan akhir
#    (Pasal 162 RBg: eksepsi selain kewenangan diperiksa dan diputus bersama pokok perkara - tidak dapat berdiri sebagai putusan sela)
# ---------------------------------------------------------------------------------------------------------------------------
EKSEPSI_LAIN = {
    'kabur': dict(
        judul='gugatan kabur (<i>obscuur libel</i>)', isi='#0053# #7036# kabur atau tidak jelas (<i>obscuur libel</i>)', tambah='',
        dasar='Menimbang, bahwa surat #0053# harus menguraikan dengan jelas dasar hukum dan kejadian yang menjadi dasar tuntutan (<i>fundamentum petendi</i>) serta '
              'memuat tuntutan (<i>petitum</i>) yang tegas dan sesuai dengan dalil-dalilnya; #0053# yang tidak jelas atau kabur (<i>obscuur libel</i>) tidak memenuhi '
              'syarat formil #0053#;'),
    'persona': dict(
        judul='keliru pihak (<i>error in persona</i>)', isi='#0053# #7036# keliru mengenai pihak (<i>error in persona</i>)', tambah='',
        dasar='Menimbang, bahwa #0053# harus diajukan oleh dan terhadap pihak yang mempunyai hubungan hukum dengan pokok sengketa; #0053# yang diajukan oleh orang '
              'yang tidak berkualitas atau ditujukan kepada orang yang keliru (<i>error in persona</i>) tidak memenuhi syarat formil #0053#;'),
    'kurang': dict(
        judul='kurang pihak (<i>plurium litis consortium</i>)', isi='#0053# #7036# kurang pihak (<i>plurium litis consortium</i>)',
        tambah='Menimbang, bahwa pihak yang didalilkan tidak ditarik sebagai pihak adalah #11376#;',
        dasar='Menimbang, bahwa semua pihak yang mempunyai hubungan hukum dan kepentingan langsung dengan objek sengketa harus ditarik sebagai pihak agar sengketa '
              'dapat diselesaikan secara tuntas; #0053# yang tidak menarik pihak tersebut mengandung cacat kurang pihak (<i>plurium litis consortium</i>);'),
    'nebis': dict(
        judul='<i>ne bis in idem</i>', isi='perkara #7036# telah pernah diputus dan putusannya telah berkekuatan hukum tetap (<i>ne bis in idem</i>)',
        tambah='Menimbang, bahwa putusan terdahulu yang didalilkan #7037# adalah #11375#;',
        dasar='Menimbang, bahwa berdasarkan Pasal 1917 Kitab Undang-Undang Hukum Perdata, kekuatan putusan yang telah berkekuatan hukum tetap berlaku apabila soal '
              'yang dituntut sama, tuntutan didasarkan pada alasan yang sama, dan diajukan oleh dan terhadap pihak-pihak yang sama dalam hubungan yang sama, sehingga '
              'perkara yang demikian tidak dapat diperiksa dan diputus untuk kedua kalinya (<i>ne bis in idem</i>);'),
    'prematur': dict(
        judul='gugatan prematur', isi='#0053# #7036# diajukan sebelum waktunya (prematur)', tambah='',
        dasar='Menimbang, bahwa #0053# yang diajukan sebelum hak yang dituntut dapat ditagih atau sebelum syarat yang ditentukan terpenuhi adalah #0053# yang belum '
              'waktunya (prematur), sehingga belum dapat diperiksa pokok perkaranya;'),
}


def _timbang_eksepsi(d):
    p = [('timbang', 'Menimbang, bahwa dalam jawabannya #7037# mengajukan eksepsi bahwa %s, yang pada pokoknya #11313#;' % d['isi']),
         ('timbang', 'Menimbang, bahwa eksepsi tersebut bukan mengenai kewenangan mengadili, sehingga berdasarkan #11302# diperiksa dan diputus bersama-sama '
                     'dengan pokok perkara;'),
         ('timbang', d['dasar'])]
    if d['tambah']:
        p.append(('timbang', d['tambah']))
    return p


def eksepsi_lain_dikabulkan(kode):
    d = EKSEPSI_LAIN[kode]
    p = kepala('atas eksepsi %s' % d['judul'], judul='PUTUSAN', produk='putusan')
    p.append(('duduk', 'Bahwa atas #0053# tersebut, #7037# mengajukan jawaban yang memuat eksepsi bahwa %s, yang pada pokoknya #11313#;#11315#' % d['isi']))
    p += penutup_duduk('putusan')
    p.append(('bagian', 'Mengenai Kewenangan Mengadili'))
    p.append(('timbang', 'Menimbang, bahwa perkara <i>a quo</i> termasuk #11372#, sehingga menjadi kewenangan absolut Pengadilan Agama, dan berdasarkan identitas para '
                         'pihak dan letak objek sengketa dalam surat #0053#, perkara <i>a quo</i> termasuk wilayah hukum #8008#;'))
    p.append(('bagian', 'Dalam Eksepsi'))
    p += _timbang_eksepsi(d)
    p.append(('timbang', 'Menimbang, bahwa berdasarkan dalil-dalil #0053# #7036#, jawaban #7037#, serta fakta yang terungkap di persidangan, #11374#, sehingga eksepsi '
                         '#7037# beralasan hukum dan harus dikabulkan;'))
    p.append(('bagian', 'Dalam Pokok Perkara'))
    p.append(('timbang', 'Menimbang, bahwa oleh karena eksepsi #7037# dikabulkan, #0053# #7036# mengandung cacat formil, sehingga harus dinyatakan tidak dapat diterima '
                         '(<i>niet ontvankelijke verklaard</i>) tanpa mempertimbangkan pokok perkara lebih lanjut;'))
    p.append(('bagian', 'Mengenai Biaya Perkara'))
    p += [('timbang', '#11319#'),
          ('timbang', 'Mengingat segala ketentuan peraturan perundang-undangan yang berlaku dan hukum Islam yang berkaitan dengan perkara ini;'),
          ('mengadili', 'MENGADILI'), ('bagian', 'Dalam Eksepsi'), ('amar', '-\tMengabulkan eksepsi #7037#;'),
          ('bagian', 'Dalam Pokok Perkara'), ('amar', '1.\tMenyatakan #0053# #7036# tidak dapat diterima (<i>niet ontvankelijke verklaard</i>);'),
          ('amar', '2.\t#11122#.'), ('ekor_akhir', '')]
    return p


def eksepsi_lain_sisipan(kode):
    """Bagian pertimbangan dan amar "Dalam Eksepsi" (ditolak) untuk disalin ke putusan akhir jenis perkaranya."""
    d = EKSEPSI_LAIN[kode]
    p = [('judul', 'SISIPAN PUTUSAN AKHIR'), ('nomor', 'Nomor #0001#'), ('kosong', ''),
         ('biasa', 'Bagian pertimbangan dan amar "Dalam Eksepsi" atas eksepsi %s yang ditolak, untuk disalin ke putusan akhir perkara #0048# ini sebelum '
                   'pertimbangan pokok perkara.' % d['judul']),
         ('sub2', 'PERTIMBANGAN HUKUM'), ('bagian', 'Dalam Eksepsi')]
    p += _timbang_eksepsi(d)
    p.append(('timbang', 'Menimbang, bahwa berdasarkan dalil-dalil #0053# #7036#, jawaban #7037#, serta fakta yang terungkap di persidangan, #11374#, sehingga eksepsi '
                         '#7037# tidak beralasan hukum dan harus ditolak;'))
    p += [('mengadili', 'MENGADILI'), ('bagian', 'Dalam Eksepsi'), ('amar', '-\tMenolak eksepsi #7037#;'), ('bagian', 'Dalam Pokok Perkara'),
          ('amar', '-\t(amar pokok perkara menurut putusan akhir jenis perkara ini).'), ('akhir', '')]
    return p


# ---------------------------------------------------------------------------------------------------------------------------
# B. REKONVENSI dan PENGGABUNGAN PERKARA
# ---------------------------------------------------------------------------------------------------------------------------
def rekonvensi_no():
    p = kepala('atas gugatan rekonvensi')
    p.append(('duduk', 'Bahwa bersama atau sesudah jawabannya, #7037# mengajukan gugatan balik (rekonvensi) terhadap #7036#;'))
    p += penutup_duduk()
    p.append(('bagian', 'Mengenai Gugatan Rekonvensi'))
    p += [('timbang', 'Menimbang, bahwa berdasarkan #11379#, gugatan rekonvensi diajukan bersama-sama dengan jawaban dan tidak dapat diajukan dalam hal-hal yang '
                      'dikecualikan undang-undang, dan pada asasnya gugatan konvensi dan rekonvensi diperiksa serta diputus bersama-sama, kecuali pengadilan berpendapat '
                      'bahwa perkara yang satu dapat diselesaikan lebih dahulu daripada yang lain;'),
          ('timbang', 'Menimbang, bahwa berdasarkan fakta yang terungkap di persidangan, #11378#, sehingga gugatan rekonvensi #7037# tidak memenuhi syarat untuk '
                      'diperiksa bersama-sama dengan gugatan konvensi dan harus dinyatakan tidak dapat diterima, sedangkan pemeriksaan gugatan konvensi dilanjutkan;'),
          ('bagian', 'Mengenai Biaya Perkara')]
    p += biaya_sela()
    p += amar(['Menyatakan gugatan rekonvensi #7037# tidak dapat diterima (<i>niet ontvankelijke verklaard</i>)',
               'Memerintahkan #7036# dan #7037# untuk melanjutkan pemeriksaan gugatan konvensi', TANGGUH])
    p += kaki()
    return p


def penggabungan(kabul):
    p = kepala('tentang penggabungan perkara')
    p.append(('duduk', 'Bahwa dalam persidangan diajukan permohonan agar perkara ini diperiksa bersama-sama (digabungkan) dengan perkara Nomor #11380# yang juga '
                       'diperiksa di #8008#;'))
    p += penutup_duduk()
    p.append(('bagian', 'Mengenai Penggabungan Perkara'))
    p += [('timbang', 'Menimbang, bahwa penggabungan perkara (<i>samenvoeging</i>) tidak diatur dalam RBg, akan tetapi dalam praktik peradilan dapat dilakukan '
                      'apabila antara perkara-perkara tersebut terdapat hubungan yang erat (<i>innerlijke samenhang</i>) dan diperiksa di pengadilan yang sama, '
                      'sejalan dengan asas peradilan sederhana, cepat, dan biaya ringan sebagaimana dimaksud dalam Pasal 2 ayat (4) Undang-Undang Nomor 48 Tahun 2009 '
                      'tentang Kekuasaan Kehakiman;'),
          ('timbang', 'Menimbang, bahwa setelah memeriksa kedua perkara tersebut, #11381#;')]
    if kabul:
        p.append(('timbang', 'Menimbang, bahwa oleh karena itu permohonan penggabungan perkara beralasan hukum dan patut dikabulkan;'))
        butir = ['Mengabulkan permohonan penggabungan perkara', 'Menggabungkan pemeriksaan perkara Nomor #0001# dengan perkara Nomor #11380#',
                 'Memerintahkan para pihak untuk melanjutkan pemeriksaan kedua perkara tersebut secara bersama-sama', TANGGUH]
    else:
        p.append(('timbang', 'Menimbang, bahwa oleh karena itu permohonan penggabungan perkara tidak beralasan hukum dan harus ditolak;'))
        butir = ['Menolak permohonan penggabungan perkara Nomor #0001# dengan perkara Nomor #11380#', LANJUT, TANGGUH]
    p.append(('bagian', 'Mengenai Biaya Perkara'))
    p += biaya_sela()
    p += amar(butir)
    p += kaki()
    return p


# ---------------------------------------------------------------------------------------------------------------------------
# C. SUMPAH PEMUTUS, PENAKSIR, LI'AN (putusan sela gugatan)
# ---------------------------------------------------------------------------------------------------------------------------
BEBAN = ('Menimbang, bahwa berdasarkan #11309#, setiap orang yang mendalilkan bahwa ia mempunyai suatu hak, atau guna meneguhkan haknya sendiri maupun '
         'membantah hak orang lain menunjuk pada suatu peristiwa, wajib membuktikan adanya hak atau peristiwa tersebut;')


def sumpah_pemutus():
    p = kepala('tentang sumpah pemutus (<i>decisoir</i>)')
    p += [('duduk', 'Bahwa #11384# menyatakan tidak dapat lagi mengajukan alat bukti lain untuk membuktikan dalilnya, lalu memohon agar #11383# diperintahkan '
                    'mengangkat sumpah pemutus (<i>decisoir</i>) mengenai peristiwa yang dirumuskan sebagai berikut: "#11386#";')]
    p += penutup_duduk()
    p.append(('bagian', 'Mengenai Sumpah Pemutus'))
    p += [('timbang', BEBAN),
          ('timbang', 'Menimbang, bahwa berdasarkan #11371# jo. Pasal 1929 sampai dengan Pasal 1939 Kitab Undang-Undang Hukum Perdata, apabila tidak ada bukti '
                      'lain untuk menguatkan gugatan atau jawaban, salah satu pihak dapat meminta agar pihak lawannya bersumpah di hadapan hakim mengenai suatu '
                      'perbuatan yang dilakukan oleh pihak yang disumpah; pihak yang diperintahkan bersumpah tetapi enggan bersumpah atau tidak mengembalikan sumpah '
                      'itu kepada lawannya harus dikalahkan;'),
          ('timbang', 'Menimbang, bahwa permohonan #11384# mengenai peristiwa yang merupakan perbuatan #11383# sendiri, sehingga #8554# memerintahkan #11383# '
                      'untuk mengangkat sumpah pemutus menurut tata cara agama #11385# dengan lafal sebagai berikut: "#11387#";'),
          ('timbang', 'Menimbang, bahwa sumpah pemutus tersebut menentukan putusan atas peristiwa yang disumpahkan, dan akibatnya akan dipertimbangkan dalam '
                      'putusan akhir;'),
          ('bagian', 'Mengenai Biaya Perkara')]
    p += biaya_sela()
    p += amar(['Memerintahkan #11383# untuk mengangkat sumpah pemutus (<i>decisoir</i>) sebagaimana dimohonkan oleh #11384#, di hadapan persidangan dengan '
               'lafal sebagaimana tersebut dalam pertimbangan putusan sela ini', TANGGUH])
    p += kaki()
    return p


def sumpah_penaksir():
    p = kepala('tentang sumpah penaksir (<i>aestimatoir</i>)')
    p += [('duduk', 'Bahwa dalam perkara <i>a quo</i> #7036# menuntut sejumlah uang atau nilai barang yang besarnya tidak dapat ditetapkan dengan alat bukti lain, '
                    'yaitu #11388#;')]
    p += penutup_duduk()
    p.append(('bagian', 'Mengenai Sumpah Penaksir'))
    p += [('timbang', BEBAN),
          ('timbang', 'Menimbang, bahwa berdasarkan #11305# jo. Pasal 1940 dan Pasal 1942 Kitab Undang-Undang Hukum Perdata, hakim karena jabatannya dapat '
                      'memerintahkan salah satu pihak untuk bersumpah guna menetapkan jumlah uang atau harga barang yang akan dikabulkan, apabila tidak ada jalan lain '
                      'untuk menetapkannya, dan hakim menetapkan batas jumlah yang dapat dipercaya atas sumpah tersebut;'),
          ('timbang', 'Menimbang, bahwa oleh karena itu #8554# memerintahkan #11339# untuk mengangkat sumpah penaksir menurut tata cara agama #11340# dengan '
                      'batas setinggi-tingginya #11389#, dengan lafal sebagai berikut: "#11390#";'),
          ('bagian', 'Mengenai Biaya Perkara')]
    p += biaya_sela()
    p += amar(['Memerintahkan #11339# untuk mengangkat sumpah penaksir (<i>aestimatoir</i>) mengenai #11388#, dengan batas setinggi-tingginya #11389#, di '
               'hadapan persidangan dengan lafal sebagaimana tersebut dalam pertimbangan putusan sela ini', TANGGUH])
    p += kaki()
    return p


def sumpah_lian():
    p = kepala("tentang sumpah li'an")
    p += [('duduk', 'Bahwa #11392# mengajukan tuduhan zina dan/atau pengingkaran anak terhadap #11393#, yang dirumuskan sebagai berikut: "#11391#", '
                    'sedangkan #11393# membantah tuduhan tersebut;'),
          ('duduk', 'Bahwa #7036# menyatakan tidak dapat lagi mengajukan alat bukti lain untuk menguatkan dalil tersebut;')]
    p += penutup_duduk()
    p.append(('bagian', "Mengenai Sumpah Li'an"))
    p += [('timbang', 'Menimbang, bahwa berdasarkan Pasal 87 ayat (1) dan ayat (2) Undang-Undang Nomor 7 Tahun 1989 tentang Peradilan Agama sebagaimana telah '
                      'diubah dengan Undang-Undang Nomor 3 Tahun 2006 dan perubahan kedua dengan Undang-Undang Nomor 50 Tahun 2009, apabila permohonan atau gugatan '
                      'cerai diajukan atas alasan salah satu pihak melakukan zina, sedangkan pemohon atau penggugat tidak dapat melengkapi bukti-bukti dan termohon '
                      'atau tergugat menyanggah alasan tersebut, dan hakim berpendapat bahwa permohonan atau gugatan itu bukan tiada pembuktian sama sekali serta upaya '
                      'peneguhan alat bukti tidak mungkin lagi diperoleh, hakim karena jabatannya dapat menyuruh pemohon atau penggugat untuk bersumpah, dan pihak '
                      'termohon atau tergugat diberi kesempatan meneguhkan sanggahannya dengan cara yang sama;'),
          ('timbang', "Menimbang, bahwa berdasarkan Pasal 88 ayat (1) Undang-Undang tersebut jo. Pasal 126, Pasal 127, dan Pasal 128 Kompilasi Hukum Islam, sumpah yang "
                      "dilakukan oleh suami diselesaikan dengan cara li'an, yaitu suami bersumpah empat kali atas tuduhannya diikuti sumpah kelima berupa laknat Allah "
                      "atas dirinya apabila tuduhannya dusta, lalu istri menolak tuduhan itu dengan sumpah empat kali diikuti sumpah kelima berupa murka Allah atas "
                      "dirinya apabila tuduhan itu benar, dan li'an hanya sah apabila dilakukan di hadapan sidang Pengadilan Agama;"),
          ('timbang', "Menimbang, bahwa oleh karena itu #8554# memerintahkan #11392# untuk mengucapkan sumpah li'an di hadapan persidangan dan memberi kesempatan "
                      "kepada #11393# untuk menolak tuduhan tersebut dengan sumpah li'an;"),
          ('bagian', 'Mengenai Biaya Perkara')]
    p += biaya_sela()
    p += amar(["Memerintahkan #11392# untuk mengucapkan sumpah li'an atas tuduhannya di hadapan persidangan menurut tata cara Pasal 127 Kompilasi Hukum Islam",
               "Memberi kesempatan kepada #11393# untuk menolak tuduhan tersebut dengan sumpah li'an di hadapan persidangan", TANGGUH])
    p += kaki()
    return p


# ---------------------------------------------------------------------------------------------------------------------------
# D. MEDIASI TIDAK BERIKTIKAD BAIK (PERMA 1/2016)
# ---------------------------------------------------------------------------------------------------------------------------
PASAL7 = ('Menimbang, bahwa berdasarkan Pasal 7 ayat (2) Peraturan Mahkamah Agung Nomor 1 Tahun 2016 tentang Prosedur Mediasi di Pengadilan, salah satu pihak '
          'dapat dinyatakan tidak beriktikad baik oleh Mediator antara lain apabila tidak hadir setelah dipanggil secara patut 2 (dua) kali berturut-turut tanpa '
          'alasan sah, menghadiri pertemuan pertama tetapi selanjutnya tidak pernah hadir, tidak hadir berulang-ulang sehingga mengganggu jadwal mediasi, tidak '
          'mengajukan atau tidak menanggapi resume perkara pihak lain, atau tidak menandatangani konsep kesepakatan perdamaian yang telah disepakati tanpa alasan sah;')


def mediasi_tergugat():
    p = kepala('tentang tidak beriktikad baik dalam mediasi', judul='PENETAPAN', produk='penetapan')
    p.append(('duduk', 'Bahwa berdasarkan laporan Mediator #0056# tanggal #8012#, #7037# dinyatakan tidak beriktikad baik dalam proses mediasi karena #11395#;'))
    p += penutup_duduk('penetapan')
    p.append(('bagian', 'Mengenai Iktikad Baik dalam Mediasi'))
    p += [('timbang', PASAL7),
          ('timbang', 'Menimbang, bahwa berdasarkan Pasal 23 ayat (1) dan ayat (3) Peraturan Mahkamah Agung tersebut, Tergugat yang dinyatakan tidak beriktikad baik '
                      'dikenai kewajiban pembayaran biaya mediasi, dan berdasarkan laporan Mediator, sebelum melanjutkan pemeriksaan, Hakim Pemeriksa Perkara dalam '
                      'persidangan yang ditetapkan berikutnya wajib mengeluarkan penetapan yang menyatakan Tergugat tidak beriktikad baik dan menghukum Tergugat '
                      'untuk membayar biaya mediasi;'),
          ('timbang', 'Menimbang, bahwa berdasarkan laporan Mediator tersebut, #7037# terbukti #11395#, sehingga #7037# harus dinyatakan tidak beriktikad baik dan '
                      'dihukum membayar biaya mediasi;'),
          ('timbang', 'Menimbang, bahwa berdasarkan Pasal 23 ayat (4) Peraturan Mahkamah Agung tersebut, biaya mediasi sebagai penghukuman kepada Tergugat '
                      'dapat dimasukkan dalam panjar biaya perkara atau dibayar tersendiri oleh Tergugat;'),
          ('bagian', 'Mengenai Biaya Perkara')]
    p += biaya_sela('penetapan')
    p += amar(['Menyatakan #7037# tidak beriktikad baik dalam proses mediasi', 'Menghukum #7037# untuk membayar biaya mediasi sejumlah #11398# #11415#',
               'Memerintahkan pemeriksaan pokok perkara dilanjutkan', TANGGUH], judul='MENETAPKAN')
    p += [('kaki', 'Demikian ditetapkan pada hari #0032# tanggal #0033# Masehi bertepatan dengan tanggal #8184# Hijriah, #11402#'), ('ttd', ''), ('akhir', '')]
    return p


def mediasi_penggugat():
    p = kepala('karena tidak beriktikad baik dalam mediasi', judul='PUTUSAN', produk='putusan')
    p.append(('duduk', 'Bahwa berdasarkan laporan Mediator #0056# tanggal #8012#, #7036# dinyatakan tidak beriktikad baik dalam proses mediasi karena #11395#;'))
    p += penutup_duduk('putusan')
    p.append(('bagian', 'Mengenai Iktikad Baik dalam Mediasi'))
    p += [('timbang', PASAL7),
          ('timbang', 'Menimbang, bahwa berdasarkan Pasal 22 ayat (1), ayat (2), dan ayat (4) Peraturan Mahkamah Agung tersebut, apabila penggugat dinyatakan tidak '
                      'beriktikad baik dalam proses mediasi, gugatan dinyatakan tidak dapat diterima oleh Hakim Pemeriksa Perkara, penggugat dikenai pula kewajiban '
                      'pembayaran biaya mediasi, dan berdasarkan laporan Mediator, Hakim Pemeriksa Perkara mengeluarkan putusan akhir yang menyatakan gugatan tidak '
                      'dapat diterima disertai penghukuman pembayaran biaya mediasi dan biaya perkara;'),
          ('timbang', 'Menimbang, bahwa berdasarkan laporan Mediator tersebut, #7036# terbukti #11395#, sehingga #0053# #7036# harus dinyatakan tidak dapat '
                      'diterima (<i>niet ontvankelijke verklaard</i>) dan #7036# dihukum membayar biaya mediasi;'),
          ('bagian', 'Mengenai Biaya Perkara'), ('timbang', '#11403#'),
          ('timbang', 'Mengingat segala ketentuan peraturan perundang-undangan yang berlaku dan hukum Islam yang berkaitan dengan perkara ini;')]
    p += amar(['Menyatakan #0053# #7036# tidak dapat diterima (<i>niet ontvankelijke verklaard</i>)',
               'Menghukum #7036# untuk membayar biaya mediasi sejumlah #11398#', '#11122#'])
    p.append(('ekor_akhir', ''))
    return p


# ---------------------------------------------------------------------------------------------------------------------------
# E. BAS SUMPAH: tunda putusan / lalu putusan dibacakan pada hari itu
# ---------------------------------------------------------------------------------------------------------------------------
SUMPAH = {
    'pelengkap': dict(nama='sumpah pelengkap (<i>suppletoir</i>)', pihak='#11339#', agama='#11340#', lafal='#11342#', asal='putusan sela yang telah dijatuhkan'),
    'pemutus': dict(nama='sumpah pemutus (<i>decisoir</i>)', pihak='#11383#', agama='#11385#', lafal='#11387#',
                    asal='putusan sela yang telah dijatuhkan atas permohonan #11384#'),
    'penaksir': dict(nama='sumpah penaksir (<i>aestimatoir</i>)', pihak='#11339#', agama='#11340#', lafal='#11390#',
                     asal='putusan sela yang telah dijatuhkan, dengan batas setinggi-tingginya #11389#'),
}


def bas_sumpah_jenis(jenis, putus):
    d = SUMPAH[jenis]
    p = bas_kepala() + bas_umum_awal()
    p += [('b_badan', 'Kemudian #4004# menyatakan bahwa sesuai dengan %s, %s diperintahkan untuk mengangkat %s;' % (d['asal'], d['pihak'], d['nama'])),
          ('b_badan', 'Selanjutnya #4004# menjelaskan maksud dan akibat hukum sumpah tersebut, kemudian %s mengangkat sumpah menurut tata cara agama %s dengan '
                      'lafal sebagai berikut:' % (d['pihak'], d['agama'])),
          ('b_badan', '"%s";' % d['lafal'])]
    if not putus:
        p.append(('b_badan', 'Setelah %s mengangkat sumpah, #4004# menyatakan bahwa sumpah tersebut akan dipertimbangkan dalam #11369#;' % d['pihak']))
        return p + bas_tutup('#11365#')
    p += [('b_badan', 'Setelah %s mengangkat sumpah, #4004# menyatakan pemeriksaan telah cukup;' % d['pihak']),
          ('b_badan', '#0067#'),
          ('b_amarjudul', '#9403#'),
          ('b_badan', '#0065#'),
          ('b_badan', 'Selanjutnya #4004# menjelaskan kepada #11367# bahwa apabila keberatan terhadap #5368# tersebut dapat mengajukan upaya hukum dalam '
                      'tenggat waktu 14 (empat belas) hari sejak #5368# diucapkan, atau sejak #5368# diberitahukan bagi pihak yang tidak hadir;'),
          ('b_badan', 'Kemudian #4004# memerintahkan #6034# mengunggah #5368# tersebut ke dalam Sistem Informasi Pengadilan agar diketahui oleh para pihak, '
                      'lalu #4004# menyatakan sidang selesai dan ditutup;'),
          ('b_badan', 'Demikian Berita Acara Sidang ini dibuat yang ditandatangani oleh #4004# dan #6034#.'),
          ('b_ttd', '')]
    return p


def bas_lian():
    p = bas_kepala() + bas_umum_awal()
    p += [('b_badan', "Kemudian #4004# menyatakan bahwa sesuai dengan putusan sela yang telah dijatuhkan, #11392# diperintahkan untuk mengucapkan sumpah li'an "
                      "dan #11393# diberi kesempatan untuk menolaknya dengan sumpah li'an, menurut tata cara Pasal 127 Kompilasi Hukum Islam;"),
          ('b_badan', "Selanjutnya #4004# menjelaskan maksud dan akibat hukum li'an, kemudian #11392# mengucapkan sumpah empat kali dengan lafal:"),
          ('b_badan', '"Demi Allah, saya bersaksi bahwa #11391#";'),
          ('b_badan', 'dan sumpah kelima dengan lafal:'),
          ('b_badan', '"Laknat Allah atas diri saya apabila tuduhan saya tersebut dusta";'),
          ('b_badan', 'Kemudian #11393# menolak tuduhan tersebut dengan mengucapkan sumpah empat kali dengan lafal:'),
          ('b_badan', '"Demi Allah, saya bersaksi bahwa tuduhan tersebut tidak benar";'),
          ('b_badan', 'dan sumpah kelima dengan lafal:'),
          ('b_badan', '"Murka Allah atas diri saya apabila tuduhan tersebut benar";'),
          ('b_badan', "Setelah sumpah li'an diucapkan oleh kedua belah pihak, #4004# menyatakan bahwa hal tersebut akan dipertimbangkan dalam #11369#;")]
    return p + bas_tutup('#11365#')


# ---------------------------------------------------------------------------------------------------------------------------
# DAFTAR
# ---------------------------------------------------------------------------------------------------------------------------
NAMA_EKSEPSI = {'kabur': 'Gugatan Kabur (Obscuur Libel)', 'persona': 'Keliru Pihak (Error in Persona)', 'kurang': 'Kurang Pihak (Plurium Litis Consortium)',
                'nebis': 'Ne Bis In Idem', 'prematur': 'Gugatan Prematur'}
TAMBAHAN = []
_n = 16
for _k in ('kabur', 'persona', 'kurang', 'nebis', 'prematur'):
    _asal = [9685, 9681, 11314, 661, 11374] + ([11376] if _k == 'kurang' else []) + ([11375] if _k == 'nebis' else [])
    TAMBAHAN.append((F_SELA, '[%02d] [NO] Eksepsi %s Dikabulkan - Gugatan Tidak Dapat Diterima (Putusan Akhir).rtf' % (_n, NAMA_EKSEPSI[_k]), 'akhir',
                     (lambda k=_k: eksepsi_lain_dikabulkan(k)), _asal, ('eksepsi %s' % _k, 'dikabulkan')))
    TAMBAHAN.append((F_SELA, '[%02d] [Sisipan] Eksepsi %s Ditolak - Bagian Dalam Eksepsi untuk Putusan Akhir.rtf' % (_n + 1, NAMA_EKSEPSI[_k]), 'sela',
                     (lambda k=_k: eksepsi_lain_sisipan(k)), [x for x in _asal if x != 661], ('eksepsi %s' % _k, 'ditolak (sisipan)')))
    _n += 2
TAMBAHAN += [
    (F_SELA, '[26] [Sela] Gugatan Rekonvensi Tidak Dapat Diterima - Pemeriksaan Konvensi Dilanjutkan.rtf', 'sela', rekonvensi_no, [11378], ('rekonvensi', 'tidak dapat diterima')),
    (F_SELA, '[27] [Sela Kabul] Penggabungan Perkara Dikabulkan.rtf', 'sela', lambda: penggabungan(True), [11380, 11381], ('penggabungan perkara', 'dikabulkan')),
    (F_SELA, '[28] [Sela Tolak] Penggabungan Perkara Ditolak.rtf', 'sela', lambda: penggabungan(False), [11380, 11381], ('penggabungan perkara', 'ditolak')),
    (F_SELA, '[29] [Sela] Sumpah Pemutus (Decisoir) - Gugatan.rtf', 'sela', sumpah_pemutus, [11382, 11386], ('sumpah pemutus', 'diperintahkan')),
    (F_SELA, '[30] [Sela] Sumpah Penaksir (Aestimatoir) - Gugatan.rtf', 'sela', sumpah_penaksir, [11338, 11388, 11389], ('sumpah penaksir', 'diperintahkan')),
    (F_SELA, '[31] [Sela] Sumpah Lian - Cerai dengan Alasan Zina.rtf', 'sela', sumpah_lian, [11391], ("sumpah li'an", 'diperintahkan')),
    (F_SELA, '[32] [Penetapan] Tergugat Tidak Beriktikad Baik dalam Mediasi - Biaya Mediasi (PERMA 1 2016 Pasal 23).rtf', 'sela', mediasi_tergugat, [11394, 11398, 11416],
     ('mediasi tidak beriktikad baik', 'tergugat (penetapan)')),
    (F_SELA, '[33] [NO] Penggugat Tidak Beriktikad Baik dalam Mediasi - Gugatan Tidak Dapat Diterima (PERMA 1 2016 Pasal 22).rtf', 'akhir', mediasi_penggugat,
     [11394, 11398, 661], ('mediasi tidak beriktikad baik', 'penggugat (putusan akhir)')),
    (F_SELA_BAS, 'BAS SELA [3a] Sumpah Pelengkap (Suppletoir) - Lalu Putusan Dibacakan.rtf', 'bas', lambda: bas_sumpah_jenis('pelengkap', True), [11338, 11341], None),
    (F_SELA_BAS, 'BAS SELA [4] Sumpah Pemutus (Decisoir) - Tunda Putusan.rtf', 'bas', lambda: bas_sumpah_jenis('pemutus', False), [11382, 11386], None),
    (F_SELA_BAS, 'BAS SELA [4a] Sumpah Pemutus (Decisoir) - Lalu Putusan Dibacakan.rtf', 'bas', lambda: bas_sumpah_jenis('pemutus', True), [11382, 11386], None),
    (F_SELA_BAS, 'BAS SELA [5] Sumpah Penaksir (Aestimatoir) - Tunda Putusan.rtf', 'bas', lambda: bas_sumpah_jenis('penaksir', False), [11338, 11388, 11389], None),
    (F_SELA_BAS, 'BAS SELA [5a] Sumpah Penaksir (Aestimatoir) - Lalu Putusan Dibacakan.rtf', 'bas', lambda: bas_sumpah_jenis('penaksir', True), [11338, 11388, 11389], None),
    (F_SELA_BAS, 'BAS SELA [6] Sumpah Lian - Tunda Putusan.rtf', 'bas', bas_lian, [11391], None),
]
PS_CERAI = [
    ('derry_briantono/1 Perceraian CG - BAS', 'BAS ALUR 04 [PS] BAS P & T Hadir - Pemeriksaan Setempat Objek Harta Bersama (Kumulasi).rtf', False, 8730),
    ('derry_briantono/1a Perceraian CT - BAS', 'BAS ALUR 04 [PS] BAS P & T Hadir - Pemeriksaan Setempat Objek Harta Bersama (Kumulasi).rtf', False, 8730),
]
# Mediasi elektronik (PERMA 3/2022): disusun dari blangko mediasi yang ada (bangun_paket.py), nama berkas baru
MEDIASI_EL_BAS = 'BAS ALUR 04 [1e] BAS 1 P & T Hadir - Mediasi Elektronik (PERMA 3 2022).rtf'
MEDIASI_EL_PTSP = '@ 4a - Penetapan Penunjukan Mediator - Mediasi Elektronik (PERMA 3 2022).rtf'
