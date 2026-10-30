# -*- coding: utf-8 -*-
"""Blangko putaran 3 (jawaban pengguna 30 Okt atas 9 pertanyaan putaran 2): sisipan "Dalam Rekonvensi" dikabulkan/ditolak, pemisahan perkara
(splitsing) dikabulkan/ditolak, putusan akhir perceraian karena li'an (folder cerai gugat dan cerai talak)."""
from isi import F_SELA, LANJUT, TANGGUH, amar, biaya_sela, kaki, kepala, penutup_duduk

AKAR = 'derry_briantono'


# ---------------------------------------------------------------------------------------------------------------------------
# A. SISIPAN "DALAM REKONVENSI" untuk putusan akhir (rekonvensi diperiksa dan diputus bersama konvensi)
# ---------------------------------------------------------------------------------------------------------------------------
def rekonvensi_sisipan(kabul):
    p = [('judul', 'SISIPAN PUTUSAN AKHIR'), ('nomor', 'Nomor #0001#'), ('kosong', ''),
         ('biasa', 'Bagian pertimbangan dan amar "Dalam Rekonvensi" atas gugatan rekonvensi yang %s, untuk disalin ke putusan akhir perkara #0048# ini '
                   'sesudah pertimbangan dalam konvensi.' % ('dikabulkan' if kabul else 'ditolak')),
         ('sub2', 'PERTIMBANGAN HUKUM'), ('bagian', 'Dalam Rekonvensi'),
         ('timbang', 'Menimbang, bahwa dalam rekonvensi ini #7037# dalam konvensi disebut sebagai Penggugat Rekonvensi dan #7036# dalam konvensi disebut '
                     'sebagai Tergugat Rekonvensi;'),
         ('timbang', 'Menimbang, bahwa gugatan rekonvensi diajukan bersama-sama dengan jawaban sebagaimana dimaksud dalam #11379#, sehingga secara formil '
                     'dapat diterima dan diperiksa serta diputus bersama-sama dengan gugatan konvensi;'),
         ('timbang', 'Menimbang, bahwa segala sesuatu yang telah dipertimbangkan dalam konvensi, sepanjang relevan, dianggap termuat pula dalam '
                     'pertimbangan rekonvensi ini;'),
         ('timbang', 'Menimbang, bahwa Penggugat Rekonvensi pada pokoknya menuntut #11404#;'),
         ('timbang', 'Menimbang, bahwa atas gugatan rekonvensi tersebut, Tergugat Rekonvensi memberikan jawaban yang pada pokoknya #11405#;')]
    if kabul:
        p.append(('timbang', 'Menimbang, bahwa berdasarkan fakta yang terungkap di persidangan, #11406#, sehingga gugatan rekonvensi beralasan hukum dan '
                             'patut dikabulkan #11409#;'))
        butir = [('amar', '1.\tMengabulkan gugatan Penggugat Rekonvensi #11409#;'), ('amar', '2.\t#11407##11410#;')]
    else:
        p.append(('timbang', 'Menimbang, bahwa berdasarkan fakta yang terungkap di persidangan, #11406#, sehingga gugatan rekonvensi tidak beralasan '
                             'hukum dan harus ditolak;'))
        butir = [('amar', '-\tMenolak gugatan Penggugat Rekonvensi seluruhnya;')]
    p += [('mengadili', 'MENGADILI'), ('bagian', 'Dalam Konvensi'), ('amar', '-\t(amar konvensi menurut putusan akhir jenis perkara ini);'),
          ('bagian', 'Dalam Rekonvensi')] + butir + [
          ('bagian', 'Dalam Konvensi dan Rekonvensi'), ('amar', '-\t(amar biaya perkara menurut putusan akhir jenis perkara ini).'), ('akhir', '')]
    return p


# ---------------------------------------------------------------------------------------------------------------------------
# B. PEMISAHAN PERKARA (splitsing) - dasar sejalan dengan penggabungan
# ---------------------------------------------------------------------------------------------------------------------------
def pemisahan(kabul):
    p = kepala('tentang pemisahan perkara')
    p.append(('duduk', 'Bahwa dalam persidangan diajukan permohonan agar pemeriksaan #11417# dipisahkan dari pemeriksaan perkara ini (pemisahan perkara '
                       'atau <i>splitsing</i>);'))
    p += penutup_duduk()
    p.append(('bagian', 'Mengenai Pemisahan Perkara'))
    p += [('timbang', 'Menimbang, bahwa pemisahan perkara (<i>splitsing</i>) tidak diatur dalam RBg, akan tetapi dalam praktik peradilan dapat dilakukan '
                      'apabila tuntutan-tuntutan yang digabungkan dalam satu gugatan tidak mempunyai hubungan yang erat (<i>innerlijke samenhang</i>) atau '
                      'pemeriksaannya secara bersama-sama justru mempersulit penyelesaian perkara, sejalan dengan asas peradilan sederhana, cepat, dan biaya '
                      'ringan sebagaimana dimaksud dalam Pasal 2 ayat (4) Undang-Undang Nomor 48 Tahun 2009 tentang Kekuasaan Kehakiman;'),
          ('timbang', 'Menimbang, bahwa setelah memeriksa permohonan tersebut, #11418#;')]
    if kabul:
        p.append(('timbang', 'Menimbang, bahwa oleh karena itu permohonan pemisahan perkara beralasan hukum dan patut dikabulkan;'))
        butir = ['Mengabulkan permohonan pemisahan perkara',
                 'Memisahkan pemeriksaan #11417# dari perkara Nomor #0001# untuk diperiksa dan diputus sebagai perkara tersendiri',
                 'Memerintahkan #7036# untuk mendaftarkan #11417# sebagai perkara baru di Kepaniteraan #8008# dengan membayar panjar biaya perkara yang baru',
                 'Memerintahkan #7036# dan #7037# untuk melanjutkan pemeriksaan selebihnya dalam perkara Nomor #0001#', TANGGUH]
    else:
        p.append(('timbang', 'Menimbang, bahwa oleh karena itu permohonan pemisahan perkara tidak beralasan hukum dan harus ditolak;'))
        butir = ['Menolak permohonan pemisahan perkara', LANJUT, TANGGUH]
    p.append(('bagian', 'Mengenai Biaya Perkara'))
    p += biaya_sela()
    p += amar(butir)
    p += kaki()
    return p


# ---------------------------------------------------------------------------------------------------------------------------
# C. PUTUSAN AKHIR PERCERAIAN KARENA LI'AN
# ---------------------------------------------------------------------------------------------------------------------------
def lian_akhir():
    p = kepala("atas perceraian karena li'an", judul='PUTUSAN', produk='putusan')
    p += [('duduk', 'Bahwa #11392# mengajukan tuduhan zina dan/atau pengingkaran anak terhadap #11393#, yang dirumuskan sebagai berikut: "#11391#", '
                    'sedangkan #11393# membantah tuduhan tersebut;'),
          ('duduk', "Bahwa atas tuduhan tersebut #8554# telah menjatuhkan putusan sela yang memerintahkan sumpah li'an, lalu di hadapan persidangan "
                    "#11392# telah bersumpah empat kali atas tuduhannya diikuti sumpah kelima berupa laknat Allah atas dirinya apabila tuduhannya dusta, "
                    "dan #11393# telah menolak tuduhan tersebut dengan sumpah empat kali diikuti sumpah kelima berupa murka Allah atas dirinya apabila "
                    "tuduhan itu benar, sebagaimana tercatat dalam berita acara sidang;")]
    p += penutup_duduk('putusan')
    p.append(('bagian', "Mengenai Li'an"))
    p += [('timbang', "Menimbang, bahwa berdasarkan Pasal 87 ayat (1) dan Pasal 88 ayat (1) Undang-Undang Nomor 7 Tahun 1989 tentang Peradilan Agama "
                      "sebagaimana telah diubah dengan Undang-Undang Nomor 3 Tahun 2006 dan perubahan kedua dengan Undang-Undang Nomor 50 Tahun 2009, "
                      "apabila perceraian diajukan atas alasan salah satu pihak melakukan zina dan sumpah dilakukan oleh suami, penyelesaiannya dapat "
                      "dilaksanakan dengan cara li'an;"),
          ('timbang', "Menimbang, bahwa berdasarkan Pasal 126 Kompilasi Hukum Islam, li'an terjadi karena suami menuduh istri berbuat zina dan/atau "
                      "mengingkari anak dalam kandungan atau yang sudah lahir dari istrinya, sedangkan istri menolak tuduhan dan/atau pengingkaran "
                      "tersebut; dan berdasarkan Pasal 127 dan Pasal 128 Kompilasi Hukum Islam, li'an dilakukan dengan sumpah suami empat kali diikuti "
                      "sumpah kelima, dan penolakan istri dengan sumpah empat kali diikuti sumpah kelima, serta hanya sah apabila dilakukan di hadapan "
                      "sidang Pengadilan Agama;"),
          ('timbang', "Menimbang, bahwa li'an tersebut telah dilakukan oleh #11392# dan #11393# di hadapan sidang #8008# menurut tata cara Pasal 127 "
                      "Kompilasi Hukum Islam, sehingga li'an tersebut sah;"),
          ('timbang', "Menimbang, bahwa berdasarkan Pasal 125 Kompilasi Hukum Islam, li'an menyebabkan putusnya perkawinan antara suami istri untuk "
                      "selama-lamanya, dan berdasarkan Pasal 162 Kompilasi Hukum Islam, bilamana li'an terjadi maka perkawinan itu putus untuk "
                      "selamanya dan anak yang dikandung dinasabkan kepada ibunya, sedangkan suaminya terbebas dari kewajiban memberi nafkah;"),
          ('timbang', "Menimbang, bahwa berdasarkan Pasal 153 ayat (1) Kompilasi Hukum Islam, bagi seorang istri yang putus perkawinannya berlaku waktu "
                      "tunggu atau iddah, kecuali qobla al dukhul dan perkawinannya putus bukan karena kematian suami, dan berdasarkan ayat (4) pasal tersebut, "
                      "bagi perkawinan yang putus karena perceraian tenggang waktu tunggu dihitung sejak jatuhnya putusan Pengadilan Agama yang "
                      "mempunyai kekuatan hukum tetap;"),
          ('timbang', "Menimbang, bahwa oleh karena itu #0053# #7036# patut dikabulkan dengan menyatakan perkawinan #11392# dengan #11393# putus "
                      "karena li'an untuk selama-lamanya;"),
          ('bagian', 'Mengenai Biaya Perkara'), ('timbang', '#11414#'),
          ('timbang', 'Mengingat segala ketentuan peraturan perundang-undangan yang berlaku dan hukum Islam yang berkaitan dengan perkara ini;'),
          ('mengadili', 'MENGADILI'),
          ('amar', '1.\tMengabulkan #0053# #7036#;'),
          ('amar', "2.\tMenyatakan perkawinan #11392# dengan #11393# putus karena li'an;"),
          ('amar', '3.\tMenyatakan #11392# dan #11393# tidak dapat rujuk dan tidak dapat menikah kembali untuk selama-lamanya#11412#;'),
          ('amar', '#11419#\t#11122#.'), ('ekor_akhir', '')]
    return p


TAMBAHAN = [
    (F_SELA, '[34] [Sisipan] Gugatan Rekonvensi Dikabulkan - Bagian Dalam Rekonvensi untuk Putusan Akhir.rtf', 'sela', lambda: rekonvensi_sisipan(True),
     [11404, 11405, 11406, 11407, 11408], ('rekonvensi', 'dikabulkan (sisipan)')),
    (F_SELA, '[35] [Sisipan] Gugatan Rekonvensi Ditolak - Bagian Dalam Rekonvensi untuk Putusan Akhir.rtf', 'sela', lambda: rekonvensi_sisipan(False),
     [11404, 11405, 11406], ('rekonvensi', 'ditolak (sisipan)')),
    (F_SELA, '[36] [Sela Kabul] Pemisahan Perkara (Splitsing) Dikabulkan.rtf', 'sela', lambda: pemisahan(True), [11417, 11418], ('pemisahan perkara', 'dikabulkan')),
    (F_SELA, '[37] [Sela Tolak] Pemisahan Perkara (Splitsing) Ditolak.rtf', 'sela', lambda: pemisahan(False), [11417, 11418], ('pemisahan perkara', 'ditolak')),
    (AKAR + '/1 Perceraian CG', "[97] [Lian] CG - Perkawinan Putus karena Lian (Putusan Akhir).rtf", 'akhir', lian_akhir, [11391, 11411, 661],
     ("li'an", 'putusan akhir (cerai gugat)')),
    (AKAR + '/1a Perceraian CT', "[97] [Lian] CT - Perkawinan Putus karena Lian (Putusan Akhir).rtf", 'akhir', lian_akhir, [11391, 11411, 661],
     ("li'an", 'putusan akhir (cerai talak)')),
]
