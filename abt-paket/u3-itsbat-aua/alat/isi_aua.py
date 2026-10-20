# -*- coding: utf-8 -*-
"""Isi tambahan katalog asal usul anak (agen U3, 20 Okt 2026). Bentuk: ua = suami istri (pemohon dua), ui = ibu saja."""


def _pokok(id_, judul, uraian, dasar, keadaan=None, wajib=False):
    d = dict(id=id_, judul=judul, uraian=uraian, dasarHukum=dasar, wajib=wajib)
    if keadaan:
        d['keadaan'] = keadaan
    return d


POKOK_BARU = [
    _pokok('pp-aua-itsbat-ortu', 'Itsbat nikah orang tua anak', 'pernikahan siri orang tua anak sudah diitsbatkan Pengadilan Agama dan kemudian dicatat', ['dh-aua-rukun', 'dh-aua-103'], {'perkawinan': 'sirri-dicatat-kemudian'}),
    _pokok('pp-aua-belum-catat', 'Sebab pernikahan orang tua belum dicatat', 'pernikahan orang tua anak belum dicatat dan sebabnya', ['dh-aua-rukun', 'dh-aua-103'], {'perkawinan': 'sirri-belum-dicatat'}),
    _pokok('pp-aua-enam-bulan', 'Anak lahir kurang dari enam bulan sesudah akad', 'jarak akad nikah dan kelahiran anak serta keadaan ibu ketika akad', ['dh-aua-sah', 'dh-aua-100'], {'waktuLahir': 'kurang-enam-bulan'}),
    _pokok('pp-aua-pengakuan', 'Pengakuan dan pengenalan anak', 'ayah mengakui anak dan masyarakat mengenal anak itu sebagai anak para pemohon', ['dh-aua-sah']),
    _pokok('pp-aua-bukti-lahir', 'Bukti kelahiran dan catatan kependudukan anak', 'surat keterangan kelahiran dan Kartu Keluarga anak', ['dh-aua-103']),
    _pokok('pp-aua-kepentingan', 'Kepentingan penetapan asal usul anak', 'untuk apa penetapan asal usul anak dimohonkan', ['dh-aua-103']),
]

SPEC = []


def S(**kw):
    kw.setdefault('prefix', 'q-aua-')
    SPEC.append(kw)


S(id='itsbat-ortu', pokok='pp-aua-itsbat-ortu', urut_abs=55, tingkat='inti', bentuk=('ua',), keadaan={'perkawinan': 'sirri-dicatat-kemudian'},
  teks='Apakah pernikahan siri {PAS} sudah diitsbatkan oleh Pengadilan Agama, dan bagaimana penetapannya?',
  varian=['Apakah pernikahan {PAS} yang semula tidak tercatat telah mendapat penetapan itsbat nikah dari Pengadilan Agama?'],
  hal='penetapan itsbat nikah orang tua anak', m='penetapan itsbat nikah pernikahan {PAS}', fam='tahu',
  K=(['pernikahan {PAS} sudah diitsbatkan oleh Pengadilan Agama dengan penetapan #4310#', 'Pengadilan Agama telah mengitsbatkan pernikahan {PAS} dengan penetapan #4310#'],
     ['pernikahan {PAS} telah mendapat penetapan itsbat nikah dari Pengadilan Agama, yaitu #4310#', 'atas pernikahan {PAS} Pengadilan Agama sudah menjatuhkan penetapan itsbat nikah #4310#']),
  P=(['pernikahan {PAS} sudah diitsbatkan oleh Pengadilan Agama', 'Pengadilan Agama telah mengitsbatkan pernikahan {PAS}'],
     ['setahu saya pernikahan {PAS} sudah diitsbatkan Pengadilan Agama', 'pernikahan {PAS} telah mendapat penetapan itsbat nikah']),
  A=['pernikahan {PAS} sudah diitsbatkan oleh Pengadilan Agama dengan penetapan #4310#', 'Pengadilan Agama telah mengitsbatkan pernikahan {PAS} dengan penetapan #4310#'],
  B=['permohonan itsbat nikah {PAS} masih berjalan dan belum ada penetapannya', 'itsbat nikah {PAS} masih dalam proses dan belum ada penetapannya'],
  beda_pada='peristiwa', beda_maksud='versi A: sudah ada penetapan itsbat nikah; versi B: masih dalam proses - berselisih pada PERISTIWA')

S(id='dicatat-kemudian', pokok='pp-aua-itsbat-ortu', urut_abs=115, tingkat='inti', bentuk=('ua',), keadaan={'perkawinan': 'sirri-dicatat-kemudian'},
  teks='Setelah penetapan itsbat nikah itu, apakah pernikahan {PAS} dicatat di Kantor Urusan Agama dan sudah ada kutipan akta nikahnya?',
  varian=['Apakah {PAS} sudah memegang kutipan akta nikah sesudah pernikahan mereka diitsbatkan dan dicatat?'],
  hal='pencatatan pernikahan sesudah itsbat nikah', m='pencatatan pernikahan {PAS} sesudah itsbat nikah', fam='tahu',
  K=(['setelah penetapan itsbat nikah pernikahan {PAS} dicatat #8605# dan keduanya sudah memegang kutipan akta nikah',
      'pernikahan {PAS} dicatat #8605# sesudah penetapan itsbat nikah, dan kutipan akta nikahnya sudah mereka terima'],
     ['sesudah itsbat nikah pernikahan {PAS} telah dicatat #8605# dan kutipan akta nikah sudah berada di tangan mereka',
      'pencatatan pernikahan {PAS} dilakukan #8605# setelah penetapan itsbat nikah, dan keduanya telah menerima kutipan akta nikah']),
  P=(['pernikahan {PAS} sudah dicatat setelah penetapan itsbat nikah', 'setelah itsbat nikah pernikahan {PAS} sudah dicatat'],
     ['setahu saya pernikahan {PAS} sudah dicatat sesudah itsbat nikah', 'sesudah penetapan itsbat nikah pernikahan {PAS} telah dicatat']),
  A=['pernikahan {PAS} sudah dicatat dan kutipan akta nikahnya sudah mereka terima', 'setelah itsbat nikah pernikahan {PAS} dicatat dan kutipan akta nikah sudah diterima'],
  B=['pernikahan {PAS} baru dicatat setelah anak itu lahir dan kutipan akta nikah belum mereka terima', 'pernikahan {PAS} dicatat belakangan setelah anak lahir, dan kutipan akta nikah belum diterima'],
  beda_pada='waktu', beda_maksud='versi A: dicatat dan akta nikah diterima; versi B: dicatat setelah anak lahir dan akta belum diterima - berselisih pada WAKTU')

S(id='belum-catat', pokok='pp-aua-belum-catat', urut_abs=56, tingkat='inti', bentuk=('ua',), keadaan={'perkawinan': 'sirri-belum-dicatat'},
  teks='Mengapa pernikahan {PAS} sampai sekarang belum dicatat di Kantor Urusan Agama?',
  varian=['Apa sebabnya pernikahan {PAS} belum didaftarkan dan belum ada buku nikahnya?'],
  hal='sebab pernikahan orang tua anak belum dicatat', m='sebab belum dicatatnya pernikahan {PAS}', fam='tahu',
  K=(['#1358#', 'sebab pernikahan itu luput dicatat adalah bahwa #1358#'],
     ['alasan pernikahan itu luput dicatat adalah bahwa #1358#', '#1358#, demikian yang terjadi pada pernikahan itu']),
  P=(['pernikahan {PAS} belum dicatat di Kantor Urusan Agama', 'pernikahan {PAS} belum didaftarkan di Kantor Urusan Agama'],
     ['setahu saya pernikahan {PAS} belum dicatat', 'pernikahan {PAS} belum didaftarkan']),
  A=['#1358#', 'sebab pernikahan itu luput dicatat adalah bahwa #1358#'],
  B=['pernikahan {PAS} sebenarnya pernah didaftarkan tetapi pendaftarannya ditolak karena berkasnya kurang lengkap', 'pernikahan {PAS} pernah diurus pendaftarannya namun ditolak karena berkas kurang lengkap'],
  beda_pada='penyebab', beda_maksud='versi A: sebab menurut isian perkara; versi B: pendaftaran ditolak karena berkas kurang - berselisih pada PENYEBAB')

S(id='enam-bulan', pokok='pp-aua-enam-bulan', urut_abs=125, tingkat='inti', bentuk=('ua',), keadaan={'waktuLahir': 'kurang-enam-bulan'},
  teks='Berapa lama jarak antara akad nikah {PAS} dengan kelahiran anak bernama #8602#?',
  varian=['Anak bernama #8602# lahir berapa bulan setelah akad nikah {PAS}?'],
  hal='jarak akad nikah dengan kelahiran anak', m='jarak akad nikah {PAS} dengan kelahiran anak bernama #8602#', fam='tahu',
  K=(['anak bernama #8602# lahir kurang dari enam bulan setelah akad nikah {PAS} pada #5197#',
      'kelahiran anak bernama #8602# terjadi kurang dari enam bulan sesudah {PAS} menikah pada #5197#'],
     ['jarak antara akad nikah {PAS} pada #5197# dengan kelahiran anak bernama #8602# kurang dari enam bulan',
      'anak bernama #8602# dilahirkan kurang dari enam bulan setelah {PAS} melangsungkan akad nikah pada #5197#']),
  P=(['anak bernama #8602# lahir tidak lama setelah akad nikah {PAS}', 'kelahiran anak bernama #8602# terjadi tidak lama setelah {PAS} menikah'],
     ['setahu saya anak bernama #8602# lahir tidak lama sesudah {PAS} menikah', 'anak bernama #8602# dilahirkan tidak lama setelah akad nikah {PAS}']),
  A=['anak bernama #8602# lahir kurang dari enam bulan setelah akad nikah {PAS}', 'kelahiran anak bernama #8602# terjadi kurang dari enam bulan sesudah {PAS} menikah'],
  B=['anak bernama #8602# lahir lebih dari enam bulan setelah akad nikah {PAS}', 'kelahiran anak bernama #8602# terjadi lebih dari enam bulan sesudah {PAS} menikah'],
  beda_pada='lama', beda_maksud='versi A: lahir kurang dari enam bulan sesudah akad; versi B: lebih dari enam bulan - berselisih pada LAMA')

S(id='hamil-akad', pokok='pp-aua-enam-bulan', urut_abs=126, tingkat='pilihan', bentuk=('ua',), keadaan={'waktuLahir': 'kurang-enam-bulan'},
  teks='Apakah ketika akad nikah {WAN} sudah dalam keadaan hamil dari {PRIA}, dan apakah setelah menikah keduanya hidup bersama sebagai suami istri?',
  varian=['Apakah {WAN} telah mengandung anak dari {PRIA} ketika akad nikah dilangsungkan?'],
  hal='keadaan hamil ketika akad nikah', m='keadaan {WAN} ketika akad nikah dengan {PRIA}', fam='tahu',
  K=(['ketika akad nikah {WAN} sedang hamil dari {PRIA}, dan setelah menikah keduanya hidup bersama sebagai suami istri',
      'pada waktu akad nikah {WAN} telah mengandung anak dari {PRIA}, dan sesudah menikah keduanya tinggal bersama sebagai suami istri'],
     ['saat akad nikah dilangsungkan {WAN} sudah mengandung dari {PRIA}, dan sesudah itu keduanya hidup serumah sebagai suami istri',
      '{WAN} sudah hamil dari {PRIA} ketika akad nikah, kemudian keduanya berumah tangga bersama sebagai suami istri']),
  P=(['ketika akad nikah {WAN} sedang hamil', 'pada waktu akad nikah {WAN} sudah mengandung'],
     ['setahu saya {WAN} sedang hamil ketika akad nikah', 'saat akad nikah {WAN} sudah dalam keadaan mengandung']),
  A=['ketika akad nikah {WAN} sedang hamil dari {PRIA} dan setelah menikah keduanya hidup bersama', 'pada waktu akad nikah {WAN} sudah mengandung dari {PRIA}, lalu keduanya hidup bersama'],
  B=['ketika akad nikah {WAN} belum hamil dan kehamilan baru diketahui setelah menikah', 'pada waktu akad nikah {WAN} belum mengandung, kehamilan baru diketahui sesudah menikah'],
  beda_pada='peristiwa', beda_maksud='versi A: sudah hamil saat akad; versi B: belum hamil saat akad - berselisih pada PERISTIWA')

S(id='pengakuan', pokok='pp-aua-pengakuan', urut_abs=127, tingkat='inti', bentuk=('ua',),
  teks='Apakah {PRIA} mengakui anak bernama #8602# sebagai anak kandungnya dari {WAN}?',
  varian=['Apakah {PRIA} pernah menyatakan bahwa anak bernama #8602# adalah anak kandungnya dengan {WAN}?'],
  hal='pengakuan ayah atas anak', m='pengakuan {PRIA} atas anak bernama #8602#', fam='tahu',
  K=(['{PRIA} mengakui bahwa anak bernama #8602# adalah anak kandungnya dari {WAN}', '{PRIA} menyatakan anak bernama #8602# adalah anak kandungnya bersama {WAN}'],
     ['{PRIA} membenarkan bahwa anak bernama #8602# adalah anak kandungnya dari {WAN}', 'menurut pengakuan {PRIA}, anak bernama #8602# adalah anak kandungnya bersama {WAN}']),
  P=(['{PRIA} mengakui anak bernama #8602# sebagai anaknya', '{PRIA} menyatakan anak bernama #8602# adalah anaknya'],
     ['setahu saya {PRIA} mengakui anak bernama #8602# sebagai anaknya', '{PRIA} membenarkan anak bernama #8602# adalah anaknya']),
  A=['{PRIA} mengakui anak bernama #8602# sebagai anak kandungnya dari {WAN} sejak anak itu lahir', '{PRIA} sejak anak itu lahir menyatakan anak bernama #8602# adalah anak kandungnya bersama {WAN}'],
  B=['{PRIA} baru mengakui anak bernama #8602# sebagai anak kandungnya beberapa tahun setelah anak itu lahir', '{PRIA} menyatakan anak bernama #8602# anak kandungnya beberapa tahun setelah kelahiran anak itu'],
  beda_pada='waktu', beda_maksud='versi A: mengakui sejak anak lahir; versi B: baru mengakui beberapa tahun kemudian - berselisih pada WAKTU')

S(id='dikenal-anak', pokok='pp-aua-pengakuan', urut_abs=128, tingkat='pilihan', bentuk=('ua', 'ui'),
  teks='Apakah masyarakat sekitar mengenal anak bernama #8602# sebagai anak {PAS}?',
  varian=['Apakah warga di sekitar tempat tinggal {PAS} mengetahui anak bernama #8602# sebagai anak mereka?'],
  hal='pengenalan masyarakat terhadap anak', m='pengenalan masyarakat terhadap anak bernama #8602# sebagai anak {PAS}', fam='tahu',
  K=(['masyarakat sekitar mengenal anak bernama #8602# sebagai anak {PAS}', 'warga sekitar mengetahui anak bernama #8602# adalah anak {PAS}'],
     ['anak bernama #8602# dikenal oleh warga sekitar sebagai anak {PAS}', 'orang-orang di lingkungan itu mengenal anak bernama #8602# sebagai anak {PAS}']),
  P=(['masyarakat sekitar mengenal anak bernama #8602#', 'warga sekitar mengetahui anak bernama #8602#'],
     ['setahu saya warga mengenal anak bernama #8602#', 'orang-orang di lingkungan itu mengenal anak bernama #8602#']),
  A=['masyarakat sekitar mengenal anak bernama #8602# sebagai anak {PAS} sejak anak itu lahir', 'warga sekitar sejak anak itu lahir mengetahui anak bernama #8602# adalah anak {PAS}'],
  B=['masyarakat sekitar mengenal anak bernama #8602# sebagai anak orang lain', 'warga sekitar mengira anak bernama #8602# adalah anak orang lain'],
  beda_pada='pelaku', beda_maksud='versi A: dikenal sebagai anak para pemohon; versi B: dikira anak orang lain - berselisih pada PELAKU (orang tua)')

S(id='ayah-biologis', pokok='pp-ibu-saja', urut_abs=182, tingkat='tambahan', bentuk=('ui',),
  teks='Siapa laki-laki yang menjadi ayah biologis anak bernama #8602#, dan apakah ia mengakui anak itu?',
  varian=['Apakah ada laki-laki yang mengakui anak bernama #8602# sebagai anaknya, dan siapa dia?'],
  hal='ayah biologis dan pengakuannya', m='ayah biologis anak bernama #8602# dan pengakuannya', fam='tahu',
  K=(['ayah biologis anak bernama #8602# adalah #4311# dan ia mengakui anak itu sebagai anaknya', 'laki-laki bernama #4311# adalah ayah biologis anak bernama #8602# dan ia mengakui anak itu'],
     ['anak bernama #8602# dilahirkan #0046# dari laki-laki bernama #4311# yang mengakui anak itu sebagai anaknya', '#4311# adalah ayah biologis anak bernama #8602# dan mengakui anak itu sebagai anaknya']),
  P=(['anak bernama #8602# punya ayah biologis bernama #4311#', 'ayah biologis anak bernama #8602# bernama #4311#'],
     ['setahu saya ayah biologis anak bernama #8602# adalah #4311#', 'laki-laki bernama #4311# adalah ayah biologis anak bernama #8602#']),
  A=['ayah biologis anak bernama #8602# adalah #4311# dan ia mengakui anak itu', 'laki-laki bernama #4311# adalah ayah biologis anak bernama #8602# yang mengakui anak itu'],
  B=['ayah biologis anak bernama #8602# adalah #4311# tetapi ia tidak mengakui anak itu', 'laki-laki bernama #4311# adalah ayah biologis anak bernama #8602# namun tidak mengakui anak itu'],
  beda_pada='peristiwa', beda_maksud='versi A: laki-laki itu mengakui anak; versi B: tidak mengakui - berselisih pada PERISTIWA (pengakuan)',
  catatan='Hubungan perdata anak dengan laki-laki hanya dapat ditetapkan bila dibuktikan menurut ilmu pengetahuan dan teknologi atau alat bukti lain (Putusan MK 46/PUU-VIII/2010); keputusan ada pada majelis.')

S(id='bukti-lahir', pokok='pp-aua-bukti-lahir', urut_abs=145, tingkat='pilihan', bentuk=('ua', 'ui'),
  teks='Siapa yang menolong persalinan anak bernama #8602#, dan adakah surat keterangan kelahiran dari bidan, dokter, atau rumah sakit?',
  varian=['Adakah surat keterangan lahir untuk anak bernama #8602# yang diterbitkan oleh yang menolong persalinannya?'],
  hal='pertolongan persalinan dan surat keterangan lahir', m='pertolongan persalinan dan surat keterangan lahir anak bernama #8602#', fam='tahu',
  K=(['anak bernama #8602# lahir #9709# dengan pertolongan tenaga kesehatan dan ada surat keterangan kelahiran untuk anak itu',
      'persalinan anak bernama #8602# yang lahir #9709# ditolong tenaga kesehatan, dan surat keterangan kelahirannya ada'],
     ['kelahiran anak bernama #8602# #9709# ditolong oleh tenaga kesehatan yang menerbitkan surat keterangan lahir',
      'anak bernama #8602# dilahirkan #9709# dibantu tenaga kesehatan, dan surat keterangan lahirnya sudah diterbitkan']),
  P=(['anak bernama #8602# lahir #9709#', 'kelahiran anak bernama #8602# terjadi #9709#'],
     ['setahu saya anak bernama #8602# lahir #9709#', 'anak bernama #8602# dilahirkan #9709#']),
  A=['anak bernama #8602# lahir #9709# dengan pertolongan tenaga kesehatan yang menerbitkan surat keterangan lahir', 'persalinan anak bernama #8602# #9709# ditolong tenaga kesehatan yang menerbitkan surat keterangan lahir'],
  B=['anak bernama #8602# lahir #9709# dengan pertolongan dukun bayi sehingga surat keterangan lahir tidak ada', 'persalinan anak bernama #8602# #9709# ditolong dukun bayi sehingga tidak ada surat keterangan lahir'],
  beda_pada='pelaku', beda_maksud='versi A: ditolong tenaga kesehatan dan ada surat keterangan; versi B: ditolong dukun bayi tanpa surat keterangan - berselisih pada PELAKU (penolong)')

S(id='kk-anak', pokok='pp-aua-bukti-lahir', urut_abs=147, tingkat='pilihan', bentuk=('ua', 'ui'),
  teks='Apakah anak bernama #8602# sudah tercantum dalam Kartu Keluarga {PAS}, dan atas nama siapa orang tuanya dicatat?',
  varian=['Apakah anak bernama #8602# sudah masuk dalam Kartu Keluarga {PAS}?'],
  hal='pencatatan anak dalam Kartu Keluarga', m='pencatatan anak bernama #8602# dalam Kartu Keluarga', fam='tahu',
  K=(['anak bernama #8602# sudah tercantum dalam Kartu Keluarga {PAS} sebagai anak mereka', 'dalam Kartu Keluarga {PAS} sudah ada nama anak bernama #8602# sebagai anak mereka'],
     ['nama anak bernama #8602# sudah dicatat dalam Kartu Keluarga {PAS} sebagai anaknya', 'anak bernama #8602# telah masuk dalam Kartu Keluarga {PAS} sebagai anak mereka']),
  P=(['anak bernama #8602# sudah masuk dalam Kartu Keluarga', 'nama anak bernama #8602# sudah ada dalam Kartu Keluarga'],
     ['setahu saya anak bernama #8602# sudah ada dalam Kartu Keluarga', 'anak bernama #8602# telah tercatat dalam Kartu Keluarga']),
  A=['anak bernama #8602# sudah tercantum dalam Kartu Keluarga {PAS} sebagai anak mereka', 'dalam Kartu Keluarga {PAS} sudah ada nama anak bernama #8602# sebagai anak mereka'],
  B=['anak bernama #8602# belum tercantum dalam Kartu Keluarga {PAS}', 'nama anak bernama #8602# belum ada dalam Kartu Keluarga {PAS}'],
  beda_pada='peristiwa', beda_maksud='versi A: anak sudah tercantum dalam Kartu Keluarga; versi B: belum tercantum - berselisih pada PERISTIWA')

S(id='akta-belum', pokok='pp-aua-kepentingan', urut_abs=151, tingkat='inti', bentuk=('ua', 'ui'), kelompok='akibat',
  teks='Mengapa anak bernama #8602# sampai sekarang belum mempunyai akta kelahiran?',
  varian=['Apa sebabnya akta kelahiran anak bernama #8602# belum dapat diterbitkan?'],
  hal='sebab anak belum mempunyai akta kelahiran', m='sebab anak bernama #8602# belum mempunyai akta kelahiran', fam='tahu',
  K=(['anak bernama #8602# belum mempunyai akta kelahiran karena #9710#', 'akta kelahiran anak bernama #8602# belum ada sebab #9710#'],
     ['sampai sekarang anak bernama #8602# belum memiliki akta kelahiran karena #9710#', 'penyebab anak bernama #8602# belum punya akta kelahiran adalah #9710#']),
  P=(['anak bernama #8602# belum mempunyai akta kelahiran', 'akta kelahiran anak bernama #8602# belum ada'],
     ['setahu saya anak bernama #8602# belum punya akta kelahiran', 'anak bernama #8602# belum memiliki akta kelahiran']),
  A=['anak bernama #8602# belum mempunyai akta kelahiran karena #9710#', 'akta kelahiran anak bernama #8602# belum ada sebab #9710#'],
  B=['anak bernama #8602# sebenarnya sudah punya akta kelahiran tetapi namanya salah tulis', 'akta kelahiran anak bernama #8602# ada tetapi nama anak itu salah tulis'],
  beda_pada='peristiwa', beda_maksud='versi A: akta kelahiran belum ada; versi B: akta ada tetapi salah tulis - berselisih pada PERISTIWA')

S(id='keperluan', pokok='pp-aua-kepentingan', urut_abs=155, tingkat='pilihan', bentuk=('ua', 'ui'), kelompok='akibat',
  teks='Untuk keperluan apa {PAS} memohonkan penetapan asal usul anak bernama #8602#?',
  varian=['Apa yang hendak diurus {PAS} dengan penetapan asal usul anak bernama #8602#?'],
  hal='keperluan penetapan asal usul anak', m='keperluan penetapan asal usul anak bernama #8602#', fam='tahu',
  K=(['penetapan asal usul anak bernama #8602# dimohonkan untuk mengurus akta kelahiran dan kepentingan anak itu seperti sekolah dan jaminan kesehatan',
      '{PAS} meminta penetapan asal usul anak bernama #8602# agar akta kelahiran terbit dan anak itu dapat bersekolah serta mendapat jaminan kesehatan'],
     ['dengan penetapan itu {PAS} hendak mengurus akta kelahiran anak bernama #8602# beserta keperluan sekolah dan jaminan kesehatan anak itu',
      'penetapan asal usul anak bernama #8602# diperlukan untuk akta kelahiran, pendidikan, dan jaminan kesehatan anak itu']),
  P=(['penetapan itu dimohonkan untuk mengurus akta kelahiran anak bernama #8602#', '{PAS} meminta penetapan itu untuk akta kelahiran anak bernama #8602#'],
     ['setahu saya penetapan itu untuk mengurus akta kelahiran anak bernama #8602#', 'penetapan itu dimohon agar akta kelahiran anak bernama #8602# terbit']),
  A=['penetapan itu dimohonkan untuk mengurus akta kelahiran, sekolah, dan jaminan kesehatan anak bernama #8602#', '{PAS} meminta penetapan itu demi akta kelahiran, sekolah, dan jaminan kesehatan anak bernama #8602#'],
  B=['penetapan itu dimohonkan hanya untuk mengurus pembagian warisan bagi anak bernama #8602#', '{PAS} meminta penetapan itu sekadar untuk mengurus warisan bagi anak bernama #8602#'],
  beda_pada='peristiwa', beda_maksud='versi A: untuk akta kelahiran, sekolah, dan jaminan kesehatan; versi B: hanya untuk warisan - berselisih pada PERISTIWA (keperluan)')
