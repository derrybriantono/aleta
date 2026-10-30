# -*- coding: utf-8 -*-
"""Isi blangko paket sela-ps-30okt: daftar paragraf (gaya, teks) tiap blangko. Gaya dipetakan ke paragraf contoh blangko Derry di bangun_paket.py.

Matriks putusan sela (folder baru "97a Putusan Sela", menu 151) x status; sita tetap di "97 Sita" (menu 150, tidak diubah).
BAS: "97a Putusan Sela - BAS" (menu 152) + BAS pemeriksaan setempat di folder BAS jenis kebendaan."""

UU_PA = ("Undang-Undang Nomor 7 Tahun 1989 tentang Peradilan Agama sebagaimana telah diubah dengan Undang-Undang Nomor 3 Tahun 2006 "
         "dan perubahan kedua dengan Undang-Undang Nomor 50 Tahun 2009")

F_SELA = 'derry_briantono/97a Putusan Sela'
F_SELA_BAS = 'derry_briantono/97a Putusan Sela - BAS'

# ---------------------------------------------------------------------------------------------------------------------------
# potongan bersama putusan sela
# ---------------------------------------------------------------------------------------------------------------------------


def kepala(pokok, gugatan=True, judul='PUTUSAN SELA', produk='putusan sela', intervensi=False):
    p = [('judul', judul), ('nomor', 'Nomor #0001#'), ('kosong', ''), ('tengah', 'DEMI KEADILAN BERDASARKAN KETUHANAN YANG MAHA ESA'),
         ('tengah', '#8010#'), ('kosong2', '')]
    if gugatan:
        p.append(('pembuka', 'Memeriksa dan mengadili perkara perdata agama pada tingkat pertama telah menjatuhkan %s %s dalam perkara #0048# antara:' % (produk, pokok)))
        p += [('ident', '#7047#'), ('melawan', 'melawan')]
        if intervensi:
            p += [('ident', '#7048##8710#'), ('biasa', 'dan permohonan intervensi yang diajukan oleh:'), ('ident', '#11327#')]
        else:
            p.append(('ident', '#7048##8710##7054#'))
    else:
        p.append(('pembuka', 'Memeriksa dan mengadili perkara perdata agama pada tingkat pertama telah menjatuhkan %s %s dalam perkara #0048# yang diajukan oleh:' % (produk, pokok)))
        p.append(('ident', '#7047#'))
    p += [('biasa', 'Pengadilan Agama tersebut;'), ('biasa', 'Telah mempelajari berkas perkara;'),
          ('biasa', 'Telah mendengar keterangan %s di persidangan;' % ('#7036#, #7037#, dan #11328#' if intervensi else '#11310#')),
          ('sub', 'DUDUK PERKARA'),
          ('duduk', 'Bahwa #7036# dengan surat #0053#nya tanggal #0017# telah mengajukan #0053# yang terdaftar di Kepaniteraan #8008# dengan register Nomor #0001# tanggal #0306#, '
                    'dengan dalil-dalil sebagaimana termuat dalam surat #0053# tersebut, dan mohon agar #8008# menjatuhkan #0194# yang amarnya berbunyi sebagai berikut:'),
          ('butir', '#9251#'),
          ('duduk', '#11312#')]
    return p


def penutup_duduk(produk='putusan sela'):
    return [('duduk', 'Bahwa untuk mempersingkat uraian %s ini, segala sesuatu yang termuat dalam berita acara sidang perkara ini ditunjuk sebagai bagian yang tidak terpisahkan dari %s ini;' % (produk, produk)),
            ('sub2', 'PERTIMBANGAN HUKUM'),
            ('timbang', 'Menimbang, bahwa maksud dan tujuan #0053# #7036# adalah sebagaimana tersebut di atas;')] + (
        [('timbang', 'Menimbang, bahwa %s ini adalah putusan yang bukan putusan akhir, yang dijatuhkan sebelum putusan akhir untuk memungkinkan atau '
                     'mempermudah kelanjutan pemeriksaan perkara, sebagaimana dimaksud dalam #11370#;' % produk)] if 'sela' in produk else [])


def biaya_sela(produk='putusan sela', akhir='putusan akhir'):
    return [('timbang', 'Menimbang, bahwa oleh karena %s ini bukan %s dan pemeriksaan perkara dilanjutkan, maka berdasarkan Pasal 89 ayat (2) %s, '
                        'biaya perkara ditangguhkan dan akan diperhitungkan dalam %s;' % (produk, akhir, UU_PA, akhir)),
            ('timbang', 'Mengingat segala ketentuan peraturan perundang-undangan yang berlaku dan hukum Islam yang berkaitan dengan perkara ini;')]


def kaki():
    return [('kaki', '#8501# pada hari #0032# tanggal #0033# Masehi bertepatan dengan tanggal #8184# Hijriah, #11311#'), ('ttd', ''), ('akhir', '')]


def amar(butir, judul='MENGADILI'):
    out = [('mengadili', judul)]
    for i, b in enumerate(butir, 1):
        out.append(('amar', '%d.\t%s%s' % (i, b, '.' if i == len(butir) else ';')))
    return out


TIMBANG_PA49 = ('Menimbang, bahwa berdasarkan Pasal 49 ' + UU_PA + ', Pengadilan Agama bertugas dan berwenang memeriksa, memutus, dan menyelesaikan '
                "perkara di tingkat pertama antara orang-orang yang beragama Islam di bidang perkawinan, waris, wasiat, hibah, wakaf, zakat, infaq, shadaqah, dan ekonomi syari'ah;")
LANJUT = 'Memerintahkan #7036# dan #7037# untuk melanjutkan pemeriksaan pokok perkara'
TANGGUH = 'Menangguhkan pembebanan biaya perkara hingga putusan akhir'
TANGGUH_P = 'Menangguhkan pembebanan biaya perkara hingga penetapan akhir'

# ---------------------------------------------------------------------------------------------------------------------------
# A. EKSEPSI KEWENANGAN
# ---------------------------------------------------------------------------------------------------------------------------
DUDUK_EKSEPSI = ('duduk', 'Bahwa atas #0053# tersebut, #7037# mengajukan jawaban yang memuat eksepsi mengenai kewenangan %s pengadilan, yang pada pokoknya #11313#;#11315#')


def eksepsi_ditolak(jenis):
    absolut = jenis == 'absolut'
    p = kepala('atas eksepsi kewenangan %s' % jenis)
    p.append((DUDUK_EKSEPSI[0], DUDUK_EKSEPSI[1] % jenis))
    p += penutup_duduk()
    p.append(('bagian', 'Mengenai Kewenangan Mengadili'))
    p.append(('timbang', 'Menimbang, bahwa dalam jawabannya #7037# mengajukan eksepsi mengenai kewenangan %s pengadilan yang pada pokoknya #11313#;' % jenis))
    if absolut:
        p.append(('timbang', 'Menimbang, bahwa berdasarkan #11301#, eksepsi mengenai kewenangan absolut dapat diajukan setiap saat selama pemeriksaan perkara berlangsung, '
                             'dan hakim karena jabatannya wajib menyatakan dirinya tidak berwenang apabila perkara yang diajukan tidak termasuk kewenangannya; sebagai eksepsi mengenai '
                             'kewenangan mengadili, eksepsi tersebut dikecualikan dari ketentuan #11302# yang mengharuskan eksepsi lain diperiksa dan diputus bersama-sama dengan pokok perkara, '
                             'sehingga #8554# terlebih dahulu mempertimbangkan dan memutusnya dengan putusan sela;'))
        p.append(('timbang', TIMBANG_PA49 + '#11373#'))
        p.append(('timbang', 'Menimbang, bahwa berdasarkan dalil-dalil #0053# #7036#, jawaban #7037#, serta fakta yang terungkap di persidangan, #9684#, sehingga perkara <i>a quo</i> '
                             'termasuk #11372# dan menjadi kewenangan absolut Pengadilan Agama; dengan demikian eksepsi #7037# tentang kewenangan absolut tidak beralasan hukum dan harus ditolak;'))
    else:
        p.append(('timbang', 'Menimbang, bahwa berdasarkan #11300#, eksepsi mengenai kewenangan relatif harus diajukan pada permulaan persidangan sebelum #7037# mengajukan '
                             'jawaban mengenai pokok perkara; sebagai eksepsi mengenai kewenangan mengadili, eksepsi tersebut dikecualikan dari ketentuan #11302# yang mengharuskan eksepsi '
                             'lain diperiksa dan diputus bersama-sama dengan pokok perkara, sehingga #8554# terlebih dahulu mempertimbangkan dan memutusnya dengan putusan sela; eksepsi #7037# '
                             'dalam perkara <i>a quo</i> diajukan pada kesempatan pertama bersamaan dengan jawabannya sehingga memenuhi ketentuan tersebut;'))
        p.append(('timbang', 'Menimbang, bahwa #11316#;'))
        p.append(('timbang', 'Menimbang, bahwa berdasarkan dalil-dalil #0053# #7036#, jawaban #7037#, serta fakta yang terungkap di persidangan, #9684#, sehingga perkara <i>a quo</i> '
                             'termasuk wilayah hukum #8008#; dengan demikian eksepsi #7037# tentang kewenangan relatif tidak beralasan hukum dan harus ditolak;'))
    p.append(('timbang', 'Menimbang, bahwa oleh karena eksepsi tersebut ditolak, #8008# berwenang mengadili perkara <i>a quo</i>, sehingga #7036# dan #7037# diperintahkan untuk '
                         'melanjutkan pemeriksaan pokok perkara;'))
    p.append(('bagian', 'Mengenai Biaya Perkara'))
    p += biaya_sela()
    p += amar(['Menolak eksepsi #7037# tentang kewenangan %s' % jenis,
               'Menyatakan #8008# berwenang %smengadili perkara Nomor #0001#' % ('' if absolut else 'secara relatif '),
               LANJUT, TANGGUH])
    p += kaki()
    return p


def eksepsi_dikabulkan(jenis):
    """PUTUSAN AKHIR (perkara selesai): kepala PUTUSAN, biaya menurut aturan putusan akhir (#11319# + #11122# prodeo DIPA), rincian biaya prodeo."""
    absolut = jenis == 'absolut'
    p = kepala('atas eksepsi kewenangan %s' % jenis, judul='PUTUSAN', produk='putusan')
    p.append((DUDUK_EKSEPSI[0], DUDUK_EKSEPSI[1] % jenis))
    p += penutup_duduk('putusan')
    p.append(('bagian', 'Mengenai Kewenangan Mengadili'))
    p.append(('timbang', 'Menimbang, bahwa dalam jawabannya #7037# mengajukan eksepsi mengenai kewenangan %s pengadilan yang pada pokoknya #11313#;' % jenis))
    if absolut:
        p.append(('timbang', 'Menimbang, bahwa berdasarkan #11301#, eksepsi mengenai kewenangan absolut dapat diajukan setiap saat selama pemeriksaan perkara berlangsung, '
                             'dan hakim karena jabatannya wajib menyatakan dirinya tidak berwenang apabila perkara yang diajukan tidak termasuk kewenangannya; sebagai eksepsi mengenai '
                             'kewenangan mengadili, eksepsi tersebut dikecualikan dari ketentuan #11302#, sehingga #8554# terlebih dahulu mempertimbangkannya sebelum memeriksa pokok perkara;'))
        p.append(('timbang', TIMBANG_PA49))
        p.append(('timbang', 'Menimbang, bahwa berdasarkan dalil-dalil #0053# #7036#, jawaban #7037#, serta fakta yang terungkap di persidangan, #9682#, sehingga perkara <i>a quo</i> '
                             'tidak termasuk kewenangan absolut Pengadilan Agama; dengan demikian eksepsi #7037# tentang kewenangan absolut beralasan hukum dan harus dikabulkan;'))
    else:
        p.append(('timbang', 'Menimbang, bahwa berdasarkan #11300#, eksepsi mengenai kewenangan relatif harus diajukan pada permulaan persidangan sebelum #7037# mengajukan '
                             'jawaban mengenai pokok perkara; sebagai eksepsi mengenai kewenangan mengadili, eksepsi tersebut dikecualikan dari ketentuan #11302#, sehingga #8554# '
                             'terlebih dahulu mempertimbangkannya sebelum memeriksa pokok perkara; eksepsi #7037# dalam perkara <i>a quo</i> diajukan pada kesempatan pertama bersamaan '
                             'dengan jawabannya sehingga memenuhi ketentuan tersebut;'))
        p.append(('timbang', 'Menimbang, bahwa #11316#;'))
        p.append(('timbang', 'Menimbang, bahwa berdasarkan dalil-dalil #0053# #7036#, jawaban #7037#, serta fakta yang terungkap di persidangan, #9682#, sehingga perkara <i>a quo</i> '
                             'tidak termasuk wilayah hukum #8008##11318#; dengan demikian eksepsi #7037# tentang kewenangan relatif beralasan hukum dan harus dikabulkan;'))
    p.append(('timbang', 'Menimbang, bahwa oleh karena eksepsi tersebut dikabulkan dan #8008# tidak berwenang mengadili perkara <i>a quo</i>, maka pokok perkara tidak perlu '
                         'dipertimbangkan lebih lanjut;'))
    p.append(('bagian', 'Mengenai Biaya Perkara'))
    p.append(('timbang', '#11319#'))
    p.append(('timbang', 'Mengingat segala ketentuan peraturan perundang-undangan yang berlaku dan hukum Islam yang berkaitan dengan perkara ini;'))
    p += amar(['Mengabulkan eksepsi #7037# tentang kewenangan %s' % jenis,
               'Menyatakan #8008# tidak berwenang %smengadili perkara Nomor #0001#' % ('' if absolut else 'secara relatif '),
               'Menyatakan #0053# #7036# tidak dapat diterima (<i>niet ontvankelijke verklaard</i>)',
               '#11122#'])
    p.append(('ekor_akhir', ''))   # kaki putusan akhir + tanda tangan + Untuk Salinan + rincian biaya (dari blangko [99c], dipakai apa adanya)
    return p


# ---------------------------------------------------------------------------------------------------------------------------
# B. PROVISI
# ---------------------------------------------------------------------------------------------------------------------------
def provisi(kabul):
    p = kepala('atas tuntutan provisi')
    p.append(('duduk', 'Bahwa dalam surat #0053#nya, #7036# juga mengajukan tuntutan provisi yang pada pokoknya agar #11320#;#11322#'))
    p += penutup_duduk()
    p.append(('bagian', 'Mengenai Tuntutan Provisi'))
    p += [('timbang', 'Menimbang, bahwa #7036# dalam surat #0053#nya mengajukan tuntutan provisi agar #11320#;'),
          ('timbang', 'Menimbang, bahwa tuntutan provisi adalah tuntutan agar sebelum putusan akhir dijatuhkan, pengadilan menetapkan tindakan sementara yang bersifat '
                      'mendesak untuk kepentingan salah satu pihak, dan tuntutan tersebut tidak boleh mengenai pokok perkara;'),
          ('timbang', 'Menimbang, bahwa #11323#;'),
          ('timbang', 'Menimbang, bahwa setelah mempertimbangkan dalil #7036# dan tanggapan #7037# di persidangan, #11325#;')]
    if kabul:
        p.append(('timbang', 'Menimbang, bahwa oleh karena itu tuntutan provisi #7036# beralasan hukum dan patut dikabulkan, sedangkan pokok perkara akan diperiksa dan diputus '
                             'kemudian;'))
        butir = ['Mengabulkan tuntutan provisi #7036#', '#11324#', LANJUT, TANGGUH]
    else:
        p.append(('timbang', 'Menimbang, bahwa oleh karena itu tuntutan provisi #7036# tidak beralasan hukum dan harus ditolak, sedangkan pokok perkara akan diperiksa dan diputus '
                             'kemudian;'))
        butir = ['Menolak tuntutan provisi #7036#', LANJUT, TANGGUH]
    p.append(('bagian', 'Mengenai Biaya Perkara'))
    p += biaya_sela()
    p += amar(butir)
    p += kaki()
    return p


# ---------------------------------------------------------------------------------------------------------------------------
# C. INTERVENSI (voeging, tussenkomst, vrijwaring) x (dikabulkan, ditolak)
# ---------------------------------------------------------------------------------------------------------------------------
INTERVENSI = {
    'voeging': dict(
        nama='Voeging',
        duduk='Bahwa dalam pemeriksaan perkara <i>a quo</i>, #11328# mengajukan permohonan untuk masuk sebagai pihak dengan cara menggabungkan diri kepada pihak #11334# '
              '(<i>voeging</i>), dengan alasan yang pada pokoknya #11329#;',
        pengertian='masuknya pihak ketiga ke dalam perkara yang sedang berjalan dengan cara menggabungkan diri kepada salah satu pihak untuk bersama-sama menghadapi pihak lawan',
        kedudukan='#11335#',
        menetapkan='Menetapkan #11328# sebagai #11335# yang menggabungkan diri kepada pihak #11334# dalam perkara Nomor #0001#'),
    'tussenkomst': dict(
        nama='Tussenkomst',
        duduk='Bahwa dalam pemeriksaan perkara <i>a quo</i>, #11328# mengajukan permohonan untuk masuk sebagai pihak yang berdiri sendiri untuk membela kepentingannya '
              'sendiri melawan #7036# dan #7037# (<i>tussenkomst</i>), dengan alasan yang pada pokoknya #11329#;',
        pengertian='masuknya pihak ketiga ke dalam perkara yang sedang berjalan sebagai pihak yang berdiri sendiri untuk membela kepentingannya sendiri melawan kedua belah pihak',
        kedudukan='#11336#',
        menetapkan='Menetapkan #11328# sebagai #11336#, serta #7036# dan #7037# masing-masing sebagai Tergugat Intervensi I dan Tergugat Intervensi II dalam perkara Nomor #0001#'),
    'vrijwaring': dict(
        nama='Vrijwaring',
        duduk='Bahwa dalam jawabannya, #7037# memohon agar pihak ketiga, yaitu #11328#, ditarik masuk sebagai pihak dalam perkara <i>a quo</i> untuk menanggung atau '
              'membebaskan #7037# (<i>vrijwaring</i>), dengan alasan yang pada pokoknya #11329#;',
        pengertian='penarikan pihak ketiga ke dalam perkara yang sedang berjalan oleh salah satu pihak, pada umumnya Tergugat, agar pihak ketiga tersebut ikut menanggung atau '
                   'membebaskan pihak yang menariknya dari akibat putusan',
        kedudukan='#11337#',
        menetapkan='Menetapkan #11328# sebagai #11337# dalam perkara Nomor #0001#'),
}


def intervensi(bentuk, kabul):
    d = INTERVENSI[bentuk]
    p = kepala('atas permohonan intervensi', intervensi=True)
    p.append(('duduk', d['duduk']))
    p.append(('duduk', 'Bahwa atas permohonan intervensi tersebut, #11330#;'))
    p += penutup_duduk()
    p.append(('bagian', 'Mengenai Permohonan Intervensi'))
    p += [('timbang', 'Menimbang, bahwa intervensi tidak diatur dalam RBg, akan tetapi dalam praktik peradilan berpedoman pada Pasal 279 sampai dengan Pasal 282 '
                      '<i>Reglement op de Burgerlijke Rechtsvordering</i> (Rv) mengenai penggabungan diri (<i>voeging</i>) dan campur tangan (<i>tussenkomst</i>), serta '
                      'Pasal 70 sampai dengan Pasal 76 Rv mengenai penanggungan (<i>vrijwaring</i>);'),
          ('timbang', 'Menimbang, bahwa intervensi dalam bentuk <i>%s</i> adalah %s, dan permohonan tersebut diperiksa serta diputus dengan putusan sela sebelum '
                      'pemeriksaan pokok perkara dilanjutkan;' % (bentuk, d['pengertian'])),
          ('timbang', 'Menimbang, bahwa setelah mempertimbangkan alasan permohonan intervensi dan tanggapan #7036# serta #7037#, #11331#;')]
    if kabul:
        p.append(('timbang', 'Menimbang, bahwa oleh karena #11328# mempunyai kepentingan hukum yang langsung terhadap perkara <i>a quo</i>, maka permohonan intervensi tersebut '
                             'beralasan hukum dan patut dikabulkan, dan pemeriksaan perkara dilanjutkan dengan mengikutsertakan #11328# sebagai %s;' % d['kedudukan']))
        butir = ['Mengabulkan permohonan intervensi #11328#', d['menetapkan'],
                 'Memerintahkan #7036#, #7037#, dan %s untuk melanjutkan pemeriksaan perkara' % d['kedudukan'], TANGGUH]
    else:
        p.append(('timbang', 'Menimbang, bahwa oleh karena #11328# tidak terbukti mempunyai kepentingan hukum yang langsung terhadap perkara <i>a quo</i>, maka permohonan '
                             'intervensi tersebut tidak beralasan hukum dan harus ditolak;'))
        butir = ['Menolak permohonan intervensi #11328#', LANJUT, TANGGUH]
    p.append(('bagian', 'Mengenai Biaya Perkara'))
    p += biaya_sela()
    p += amar(butir)
    p += kaki()
    return p


# ---------------------------------------------------------------------------------------------------------------------------
# D. SUMPAH PELENGKAP (gugatan: putusan sela; permohonan: penetapan sela)
# ---------------------------------------------------------------------------------------------------------------------------
def sumpah(gugatan):
    produk = 'putusan sela' if gugatan else 'penetapan sela'
    akhir = 'putusan akhir' if gugatan else 'penetapan akhir'
    p = kepala('tentang sumpah pelengkap (<i>suppletoir</i>)', gugatan=gugatan, judul=produk.upper(), produk=produk)
    p += [('duduk', 'Bahwa untuk membuktikan dalil-dalilnya, #7036# telah mengajukan alat bukti berupa #11343#;'),
          ('duduk', 'Bahwa atas pertanyaan #4004#, #7036# menyatakan tidak dapat lagi mengajukan alat bukti lain;')]
    p += penutup_duduk(produk)
    p.append(('bagian', 'Mengenai Sumpah Pelengkap'))
    p += [('timbang', 'Menimbang, bahwa berdasarkan #11309#, setiap orang yang mendalilkan bahwa ia mempunyai suatu hak, atau guna meneguhkan haknya sendiri maupun '
                      'membantah hak orang lain menunjuk pada suatu peristiwa, wajib membuktikan adanya hak atau peristiwa tersebut;'),
          ('timbang', 'Menimbang, bahwa alat bukti yang diajukan #7036# berupa #11343#, sehingga dalil #7036# belum terbukti dengan sempurna, akan tetapi juga tidak sama '
                      'sekali tidak terbukti, sedangkan #7036# menyatakan tidak dapat lagi mengajukan alat bukti lain;'),
          ('timbang', 'Menimbang, bahwa berdasarkan #11305# jo. Pasal 1940 dan Pasal 1941 Kitab Undang-Undang Hukum Perdata, hakim karena jabatannya dapat memerintahkan '
                      'salah satu pihak untuk mengangkat sumpah guna melengkapi pembuktian apabila tuntutan atau pembelaan tidak terbukti dengan sempurna dan tidak pula sama '
                      'sekali tidak terbukti;'),
          ('timbang', 'Menimbang, bahwa oleh karena itu #8554# memandang perlu memerintahkan #11339# untuk mengangkat sumpah pelengkap (<i>suppletoir</i>) menurut tata cara '
                      'agama #11340# dengan lafal sebagai berikut: "#11342#";'),
          ('timbang', 'Menimbang, bahwa nilai pembuktian sumpah pelengkap tersebut akan dipertimbangkan bersama-sama dengan alat bukti lain dalam %s;' % akhir),
          ('bagian', 'Mengenai Biaya Perkara')]
    p += biaya_sela(produk, akhir)
    p += amar(['Memerintahkan #11339# untuk mengangkat sumpah pelengkap (<i>suppletoir</i>) di hadapan persidangan dengan lafal sebagaimana tersebut dalam pertimbangan %s ini' % produk,
               TANGGUH if gugatan else TANGGUH_P], judul='MENGADILI' if gugatan else 'MENETAPKAN')
    p += kaki()
    return p


# ---------------------------------------------------------------------------------------------------------------------------
# E. PEMERIKSAAN SETEMPAT (putusan sela memerintahkan pemeriksaan setempat)
# ---------------------------------------------------------------------------------------------------------------------------
def sela_ps():
    p = kepala('tentang pemeriksaan setempat')
    p.append(('duduk', 'Bahwa dalam pemeriksaan perkara <i>a quo</i>, para pihak telah mengajukan alat bukti di persidangan, dan untuk memperoleh kepastian mengenai letak, luas, '
                       'batas-batas, dan keadaan objek sengketa, #11345#;'))
    p += penutup_duduk()
    p.append(('bagian', 'Mengenai Pemeriksaan Setempat'))
    p += [('timbang', 'Menimbang, bahwa objek sengketa dalam perkara <i>a quo</i> sebagaimana diuraikan dalam surat #0053# #7036# adalah sebagai berikut:'),
          ('butir', '#11346#'),
          ('timbang', 'Menimbang, bahwa berdasarkan #11304#, apabila dipandang perlu atau berguna, Ketua dapat mengangkat seorang atau dua orang komisaris dari majelis untuk, '
                      'dengan bantuan panitera, melihat keadaan setempat atau melakukan pemeriksaan yang dapat memberikan keterangan kepada hakim;'),
          ('timbang', 'Menimbang, bahwa Surat Edaran Mahkamah Agung Nomor 7 Tahun 2001 tentang Pemeriksaan Setempat menghendaki agar dalam perkara perdata yang objeknya berupa '
                      'tanah atau benda tetap dilakukan pemeriksaan setempat atas objek perkara oleh Majelis Hakim yang dibantu Panitera Pengganti, baik atas prakarsa hakim maupun '
                      'atas permintaan para pihak, dan apabila dipandang perlu serta disetujui para pihak dapat dilakukan pengukuran dan pembuatan gambar situasi oleh Kantor '
                      'Pertanahan setempat;'),
          ('timbang', 'Menimbang, bahwa untuk memperoleh kejelasan dan kepastian mengenai letak, luas, batas-batas, dan keadaan objek sengketa, serta agar putusan yang akan '
                      'dijatuhkan kelak dapat dilaksanakan, #8554# memandang perlu melakukan pemeriksaan setempat atas objek sengketa tersebut;'),
          ('timbang', 'Menimbang, bahwa biaya pemeriksaan setempat dibayar lebih dahulu sebagai tambahan panjar biaya perkara oleh #11397#, dan pembebanannya akan '
                      'diperhitungkan dalam putusan akhir;'),
          ('bagian', 'Mengenai Biaya Perkara')]
    p += biaya_sela()
    p += amar(['Memerintahkan dilaksanakan pemeriksaan setempat terhadap objek sengketa yang terletak di #9165#, pada hari #0133# tanggal #0134#, pukul #9400#',
               'Memerintahkan #7036# dan #7037# untuk hadir di lokasi objek sengketa pada waktu tersebut',
               'Memerintahkan #11397# untuk membayar tambahan panjar biaya pemeriksaan setempat sejumlah #11396# melalui Kasir #8008# sebelum pemeriksaan setempat dilaksanakan',
               'Memerintahkan Jurusita/Jurusita Pengganti #8008# untuk memberitahukan pelaksanaan pemeriksaan setempat tersebut kepada Kepala Desa/Lurah setempat agar hadir '
               'mendampingi pemeriksaan setempat',
               TANGGUH])
    p += kaki()
    return p


# ---------------------------------------------------------------------------------------------------------------------------
# BAS (gaya BAS Derry: blangko BAS ALUR 30 HB - Sidang PS)
# ---------------------------------------------------------------------------------------------------------------------------
def bas_kepala(lokasi=False):
    p = [('b_judul', 'BERITA ACARA SIDANG'), ('b_nomor', 'Nomor #0001#'), ('b_lanjutan', 'Lanjutan'), ('b_kosong', '')]
    if lokasi:
        p.append(('b_badan', '#8008# yang memeriksa dan mengadili perkara tertentu pada tingkat pertama yang dilangsungkan di lokasi objek sengketa, yaitu di #9165#, pada '
                             'hari #0032# tanggal #0033# dalam perkara #0048# antara:'))
    else:
        p.append(('b_badan', '#8008# yang memeriksa dan mengadili perkara tertentu pada tingkat pertama yang dilangsungkan di #1261#, pada hari #0032# tanggal #0033# dalam '
                             'perkara #0048# antara:'))
    p += [('b_ident', '#11368#'), ('b_majelis', '')]
    return p


def bas_ps():
    p = bas_kepala(lokasi=True)
    p += [('b_badan', 'Setelah sidang dibuka dan dinyatakan terbuka untuk umum oleh #4004# di lokasi objek sengketa, #7036# dan #7037# dipanggil menghadap;'),
          ('b_badan', '#0141#;'),
          ('b_badan', '#0142#;'),
          ('b_badan', 'Hadir pula #9166#, yang mendampingi pemeriksaan setempat ini;#11350#'),
          ('b_badan', 'Kemudian #4004# menjelaskan bahwa pemeriksaan setempat (<i>descente</i>) dilaksanakan berdasarkan #11304# jo. Surat Edaran Mahkamah Agung Nomor 7 '
                      'Tahun 2001 tentang Pemeriksaan Setempat#11362#, untuk memastikan keberadaan, letak, luas, batas-batas, dan keadaan objek sengketa sebagaimana didalilkan '
                      'dalam surat #0053# #7036#;'),
          ('b_badan', 'Objek sengketa yang didalilkan dalam surat #0053# #7036# adalah sebagai berikut:'),
          ('b_badan', '#11346#'),
          ('b_badan', 'Selanjutnya #0690# bersama #6034#, para pihak, dan #9166# meninjau objek sengketa tersebut satu per satu, dengan hasil sebagai berikut:'),
          ('b_badan', '#9167#'),
          ('b_badan', 'Gambar situasi atau denah objek sengketa yang dibuat pada pemeriksaan setempat ini terlampir dan merupakan bagian yang tidak terpisahkan dari '
                      'berita acara sidang ini;'),
          ('b_badan', 'Kemudian atas pertanyaan #4004# di lokasi objek sengketa, #7036# memberikan keterangan sebagai berikut:'),
          ('b_tj', '#11353#'),
          ('b_badan', 'Selanjutnya atas pertanyaan #4004#, #7037# memberikan keterangan sebagai berikut:'),
          ('b_tj', '#11354#'),
          ('b_badan', 'Atas hasil pemeriksaan setempat tersebut, #9168#;#11356#'),
          ('b_badan', '#11352#'),
          ('b_badan', 'Setelah pemeriksaan setempat selesai, #4004# menyatakan sidang ditunda sampai dengan hari #0133# tanggal #0134#, pukul #9400#., di #9402#, untuk '
                      '#11348#, dan memberitahu #7036# dan #7037# supaya menghadap ke persidangan yang telah ditetapkan tersebut tanpa dipanggil lagi karena pemberitahuan ini '
                      'merupakan panggilan resmi;'),
          ('b_badan', 'Setelah penundaan sidang tersebut diumumkan, selanjutnya #4004# menyatakan sidang ditutup;'),
          ('b_badan', 'Demikian Berita Acara Sidang ini dibuat yang ditandatangani oleh #4004# dan #6034#.'),
          ('b_ttd', '')]
    return p


def bas_umum_awal():
    return [('b_badan', 'Setelah sidang dibuka dan dinyatakan terbuka untuk umum oleh #4004#, #11367# dipanggil menghadap ke persidangan;'),
            ('b_badan', '#0141#;#11363##11359#')]


def bas_tutup(tunda):
    return [('b_badan', '#11360#Kemudian #4004# menyatakan sidang ditunda sampai dengan hari #0133# tanggal #0134#, pukul #9400#., di #9402#, untuk %s, dan memberitahu '
                        '#11367# supaya menghadap ke persidangan yang telah ditetapkan tersebut tanpa dipanggil lagi karena pemberitahuan ini merupakan panggilan resmi;' % tunda),
            ('b_badan', 'Setelah penundaan sidang tersebut diumumkan, selanjutnya #4004# menyatakan sidang ditutup;'),
            ('b_badan', 'Demikian Berita Acara Sidang ini dibuat yang ditandatangani oleh #4004# dan #6034#.'),
            ('b_ttd', '')]


def bas_insidentil():
    p = bas_kepala() + bas_umum_awal()
    p += [('b_badan', 'Kemudian #4004# menyatakan bahwa sidang hari ini merupakan sidang insidentil untuk memeriksa #11357#, sebelum pemeriksaan pokok perkara dilanjutkan;'),
          ('b_badan', 'Atas pertanyaan #4004#, para pihak menyampaikan keterangan dan tanggapannya yang pada pokoknya #11358#;'),
          ('b_badan', 'Selanjutnya #4004# menjelaskan kepada para pihak bahwa atas hal tersebut #0690# akan menjatuhkan putusan sela;')]
    return p + bas_tutup('#11366#')


def bas_pembacaan():
    p = bas_kepala() + bas_umum_awal()
    p += [('b_badan', 'Kemudian #4004# menyatakan agenda sidang hari ini adalah pembacaan putusan sela, lalu #4004# membacakan putusan sela yang amarnya sebagai berikut:'),
          ('b_amarjudul', '#11361#'),
          ('b_badan', '#9160#'),
          ('b_badan', 'Selanjutnya #4004# memerintahkan #6034# mengunggah putusan sela tersebut ke dalam Sistem Informasi Pengadilan agar diketahui oleh para pihak;')]
    return p + bas_tutup('#11364#')


def bas_sumpah():
    p = bas_kepala() + bas_umum_awal()
    p += [('b_badan', 'Kemudian #4004# menyatakan bahwa sesuai dengan putusan sela yang telah dijatuhkan, #11339# diperintahkan untuk mengangkat sumpah pelengkap '
                      '(<i>suppletoir</i>);'),
          ('b_badan', 'Selanjutnya #4004# menjelaskan maksud dan akibat hukum sumpah tersebut, kemudian #11339# mengangkat sumpah menurut tata cara agama #11340# dengan '
                      'lafal sebagai berikut:'),
          ('b_badan', '"#11342#";'),
          ('b_badan', 'Setelah #11339# mengangkat sumpah, #4004# menyatakan bahwa sumpah tersebut akan dipertimbangkan bersama-sama dengan alat bukti lain dalam '
                      '#11369#;')]
    return p + bas_tutup('#11365#')


# ---------------------------------------------------------------------------------------------------------------------------
# DAFTAR BLANGKO: (folder, berkas, jenis contoh, fungsi, isian tidak langsung, keterangan matriks)
# ---------------------------------------------------------------------------------------------------------------------------
E_ISIAN = [9685, 9684, 9681, 9682, 11314]
SEMUA = [
    (F_SELA, '[01] [Sela Tolak] Eksepsi Kewenangan Absolut Ditolak - Pemeriksaan Dilanjutkan.rtf', 'sela', lambda: eksepsi_ditolak('absolut'),
     [9685, 9681, 11314], ('eksepsi kewenangan absolut', 'ditolak')),
    (F_SELA, '[02] [NO] Eksepsi Kewenangan Absolut Dikabulkan - Pengadilan Agama Tidak Berwenang (Putusan Akhir).rtf', 'akhir', lambda: eksepsi_dikabulkan('absolut'),
     [9685, 9681, 11314, 661], ('eksepsi kewenangan absolut', 'dikabulkan')),
    (F_SELA, '[03] [Sela Tolak] Eksepsi Kewenangan Relatif Ditolak - Pemeriksaan Dilanjutkan.rtf', 'sela', lambda: eksepsi_ditolak('relatif'),
     [9685, 9681, 11314], ('eksepsi kewenangan relatif', 'ditolak')),
    (F_SELA, '[04] [NO] Eksepsi Kewenangan Relatif Dikabulkan - Pengadilan Agama Tidak Berwenang (Putusan Akhir).rtf', 'akhir', lambda: eksepsi_dikabulkan('relatif'),
     [9685, 9681, 11314, 11317, 661], ('eksepsi kewenangan relatif', 'dikabulkan')),
    (F_SELA, '[05] [Sela Kabul] Tuntutan Provisi Dikabulkan.rtf', 'sela', lambda: provisi(True), [11321], ('provisi', 'dikabulkan')),
    (F_SELA, '[06] [Sela Tolak] Tuntutan Provisi Ditolak.rtf', 'sela', lambda: provisi(False), [11321], ('provisi', 'ditolak')),
    (F_SELA, '[07] [Sela Kabul] Intervensi Voeging (Menggabungkan Diri) Dikabulkan.rtf', 'sela', lambda: intervensi('voeging', True),
     [11326, 11332, 11333], ('intervensi voeging', 'dikabulkan')),
    (F_SELA, '[08] [Sela Tolak] Intervensi Voeging (Menggabungkan Diri) Ditolak.rtf', 'sela', lambda: intervensi('voeging', False),
     [11326, 11333], ('intervensi voeging', 'ditolak')),
    (F_SELA, '[09] [Sela Kabul] Intervensi Tussenkomst (Menengahi) Dikabulkan.rtf', 'sela', lambda: intervensi('tussenkomst', True),
     [11326, 11332], ('intervensi tussenkomst', 'dikabulkan')),
    (F_SELA, '[10] [Sela Tolak] Intervensi Tussenkomst (Menengahi) Ditolak.rtf', 'sela', lambda: intervensi('tussenkomst', False),
     [11326], ('intervensi tussenkomst', 'ditolak')),
    (F_SELA, '[11] [Sela Kabul] Intervensi Vrijwaring (Penanggungan) Dikabulkan.rtf', 'sela', lambda: intervensi('vrijwaring', True),
     [11326, 11332], ('intervensi vrijwaring', 'dikabulkan')),
    (F_SELA, '[12] [Sela Tolak] Intervensi Vrijwaring (Penanggungan) Ditolak.rtf', 'sela', lambda: intervensi('vrijwaring', False),
     [11326], ('intervensi vrijwaring', 'ditolak')),
    (F_SELA, '[13] [Sela] Sumpah Pelengkap (Suppletoir) - Gugatan.rtf', 'sela', lambda: sumpah(True), [11338, 11341], ('sumpah pelengkap', 'diperintahkan (gugatan)')),
    (F_SELA, '[14] [Sela] Sumpah Pelengkap (Suppletoir) - Permohonan (Penetapan Sela).rtf', 'sela', lambda: sumpah(False), [11338, 11341],
     ('sumpah pelengkap', 'diperintahkan (permohonan)')),
    (F_SELA, '[15] [Sela] Pemeriksaan Setempat - Perintah Pemeriksaan di Lokasi Objek.rtf', 'sela', lambda: sela_ps(),
     [11344, 11347, 8730, 8718, 9479, 9795, 9826, 9162], ('pemeriksaan setempat', 'diperintahkan')),
    (F_SELA_BAS, 'BAS SELA [1] Sidang Insidentil - Pemeriksaan Eksepsi, Provisi atau Intervensi, Tunda Putusan Sela.rtf', 'bas', bas_insidentil, [], None),
    (F_SELA_BAS, 'BAS SELA [2] Pembacaan Putusan Sela - Pemeriksaan Dilanjutkan.rtf', 'bas', bas_pembacaan, [], None),
    (F_SELA_BAS, 'BAS SELA [3] Sumpah Pelengkap (Suppletoir) - Tunda Putusan.rtf', 'bas', bas_sumpah, [11338, 11341], None),
]

# BAS pemeriksaan setempat per jenis perkara kebendaan: (folder, berkas, timpa?, isian objek jenis)
PS_JENIS = [
    ('derry_briantono/4a Harta Bersama - BAS', 'BAS ALUR 30 HB - Sidang PS - Pemeriksaan Setempat di Lokasi Objek (antara ALUR 04 [7] dan [8]).rtf', True, 8730),
    ('derry_briantono/4b Kewarisan - BAS', 'BAS ALUR 32 Waris - Sidang PS - Pemeriksaan Setempat di Lokasi Objek (antara ALUR 04 [7] dan [8]).rtf', True, 8718),
    ('derry_briantono/4c Wasiat - BAS', 'BAS ALUR 42 Wasiat - Sidang PS - Pemeriksaan Setempat di Lokasi Objek (antara ALUR 04 [7] dan [8]).rtf', False, 9479),
    ('derry_briantono/4d Hibah - BAS', 'BAS ALUR 47 Hibah - Sidang PS - Pemeriksaan Setempat di Lokasi Objek (antara ALUR 04 [7] dan [8]).rtf', False, 9795),
    ('derry_briantono/4e Wakaf - BAS', 'BAS ALUR 48 Wakaf - Sidang PS - Pemeriksaan Setempat di Lokasi Objek (antara ALUR 04 [7] dan [8]).rtf', False, 9826),
    ('derry_briantono/10a Ekonomi Syariah Biasa - BAS', 'BAS ALUR 43 ES Acara Biasa - Sidang PS - Pemeriksaan Setempat di Lokasi Objek (antara ALUR 04 [7] dan [8]).rtf', False, 9162),
]
PS_ISIAN = [11347, 11349, 11355, 11351, 9162]
