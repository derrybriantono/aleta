# -*- coding: utf-8 -*-
"""Isi tambahan katalog saksi PENGUASAAN ANAK (jenis perkara 349) - agen W2b-B, 21 Okt 2026.
Penguasaan anak = keadaan faktual (anak berada dalam kendali satu pihak) yang dipersoalkan; hak asuh adalah hak yuridisnya.
Pokok: awal dan cara penguasaan, permintaan penyerahan, penghalangan, keadaan anak, kecakapan penguasa dan penuntut, kepentingan terbaik anak.
Variabel pengasuhAnak: pihak yang SEKARANG menguasai anak (bawaan lawan). Tidak ada fakta karangan: kerangka dari isian perkara."""
from katalog_anak import PENGASUH, PILIHAN, pokok, dasar, keadaan

DASAR_BARU = [
    dasar('dh-khi-77-3', 'Pasal 77 ayat (3) Kompilasi Hukum Islam', 'suami istri wajib mengasuh dan memelihara anak-anak mereka, baik mengenai pertumbuhan jasmani, rohani maupun kecerdasannya dan pendidikan agamanya', 'perlu-verifikasi',
          'pengetahuan hukum; belum dicocokkan dengan naskah resmi Kompilasi Hukum Islam (Inpres 1/1991). Hanya dasar panel dan pertimbangan, tidak tercetak di keterangan saksi.'),
    dasar('dh-uupa-26', 'Pasal 26 ayat (1) UU 23/2002 sebagaimana diubah UU 35/2014 tentang Perlindungan Anak', 'orang tua berkewajiban dan bertanggung jawab mengasuh, memelihara, mendidik dan melindungi anak', 'perlu-verifikasi',
          'pengetahuan hukum; belum dicocokkan dengan naskah resmi UU 35/2014. Hanya dasar panel dan pertimbangan, tidak tercetak di keterangan saksi.'),
]

KEADAAN_BARU = {
    'jumlahAnak': keadaan('Jumlah anak yang dipersoalkan', ['satu', 'lebih'], 'satu'),
    'kedudukanPengaju': keadaan('Kedudukan pengaju terhadap anak', ['ibu', 'ayah', 'kerabat'], 'ibu'),
    'caraPenguasaan': keadaan('Cara anak sampai berada dalam penguasaan', ['dibawa-pergi', 'tidak-dikembalikan', 'dititipkan-lalu-ditahan', 'diambil-paksa'], 'tidak-dikembalikan'),
    'penguasaLain': keadaan('Pihak yang menguasai anak', ['orang-tua', 'kerabat'], 'orang-tua'),
    'lokasiAnak': keadaan('Keberadaan anak sekarang', ['diketahui', 'tidak-diketahui'], 'diketahui'),
}

POKOK_BARU = [
    pokok('pp-pa-identitas', 'Jumlah anak dan akta kelahiran', 'jumlah anak yang dipersoalkan dan akta kelahiran yang mencatat orang tuanya', ['dh-uu1-41-45', 'dh-khi-1g']),
    pokok('pp-pa-hak', 'Pengasuhan anak sebelum dikuasai pihak lain', 'siapa yang merawat anak sejak lahir sampai anak berada dalam penguasaan sekarang', ['dh-khi-105', 'dh-khi-156', 'dh-uu1-41-45']),
    pokok('pp-pa-cara-bawa', 'Anak dibawa pergi', 'bagaimana anak dibawa pergi dan siapa yang melihat peristiwa itu', ['dh-sema-1-2025-penyerahan', 'dh-uupa-terbaik'], keadaan={'caraPenguasaan': 'dibawa-pergi'}),
    pokok('pp-pa-cara-tahan', 'Anak tidak dikembalikan', 'anak semula bersama pengaju atau dititipkan lalu tidak dikembalikan', ['dh-sema-1-2025-penyerahan', 'dh-uupa-terbaik'], keadaan={'caraPenguasaan': ['tidak-dikembalikan', 'dititipkan-lalu-ditahan']}),
    pokok('pp-pa-cara-paksa', 'Anak diambil dengan paksa', 'anak diambil dari pengasuhan semula dengan paksaan atau tanpa persetujuan', ['dh-sema-1-2025-penyerahan', 'dh-uupa-terbaik'], keadaan={'caraPenguasaan': 'diambil-paksa'}),
    pokok('pp-pa-waktu', 'Lamanya penguasaan dan keberadaan anak', 'sejak kapan anak dikuasai dan di mana anak berada sekarang', ['dh-uu1-41-45']),
    pokok('pp-pa-minta', 'Permintaan dan penolakan penyerahan anak', 'siapa yang meminta anak diserahkan, kapan, bagaimana dan apa alasan penolakan', ['dh-sema-1-2025-penyerahan', 'dh-sema-3-2018-ultra'], keadaan={'penyerahan': 'ya'}),
    pokok('pp-pa-halang', 'Penghalangan bertemu anak', 'anak dijauhkan atau pengaju dihalangi bertemu atau menghubungi anak', ['dh-sema-1-2017-akses', 'dh-uupa-terbaik']),
    pokok('pp-pa-kondisi', 'Keadaan anak selama dikuasai', 'kesehatan, sekolah, ibadah dan jiwa anak selama berada dalam penguasaan', ['dh-khi-156', 'dh-uupa-terbaik']),
    pokok('pp-pa-penguasa', 'Kecakapan pihak yang menguasai anak', 'penghasilan, waktu, tempat tinggal, akhlak dan kebiasaan pihak yang menguasai anak', ['dh-khi-156', 'dh-uupa-terbaik']),
    pokok('pp-pa-kerabat', 'Penguasaan oleh kerabat', 'hubungan kerabat dengan anak, alasan menguasai anak dan izin orang tua', ['dh-khi-156', 'dh-uupa-terbaik'], keadaan={'penguasaLain': 'kerabat'}),
    pokok('pp-pa-penuntut', 'Kesiapan pihak yang menuntut anak', 'tempat tinggal, penghasilan, waktu dan akhlak pihak yang menuntut penyerahan anak', ['dh-khi-156', 'dh-uupa-terbaik']),
    pokok('pp-pa-ikatan', 'Ikatan batin dan kebutuhan anak', 'kedekatan anak dengan masing-masing pihak dan kebutuhan perawatan anak yang belum mumayyiz', ['dh-khi-105', 'dh-uupa-terbaik']),
    pokok('pp-pa-pilihan', 'Alasan dan kemandirian pilihan anak mumayyiz', 'alasan dan kebebasan anak yang sudah mumayyiz dalam memilih', ['dh-khi-105', 'dh-khi-156'], keadaan={'anakMumayyiz': 'sudah'}),
    pokok('pp-pa-bahaya', 'Keadaan yang membahayakan anak', 'kekerasan, penelantaran dan pengaruh buruk selama anak dikuasai', ['dh-khi-156', 'dh-uupa-terbaik'], keadaan={'pengalihan': 'ya'}),
    pokok('pp-pa-saudara', 'Keutuhan saudara kandung', 'hubungan antar anak dan keberatan memisahkan anak dari saudaranya', ['dh-uupa-terbaik'], keadaan={'jumlahAnak': 'lebih'}),
    pokok('pp-pa-damai', 'Kesepakatan dan pertemuan keluarga', 'kesepakatan yang pernah ada tentang anak dan pertemuan keluarga yang pernah diadakan', ['dh-uu1-41-45']),
]

SPEC = []


def S(**kw):
    kw.setdefault('prefix', 'q-pa-')
    kw.setdefault('beda_pada', 'peristiwa')
    SPEC.append(kw)


S(id='jumlah-anak', pokok='pp-pa-identitas', urut=31, tingkat='jarang', kelompok='pokok',
  teks='Berapa jumlah anak #0046# dan #0047# dan siapa nama anak yang penguasaannya dipersoalkan di sini?',
  varian=['Dari perkawinan #0046# dan #0047# ada berapa anak dan yang dipersoalkan penguasaannya bernama siapa?'],
  hal='jumlah anak dan nama anak yang dipersoalkan', m='jumlah dan nama anak #0046# dan #0047#',
  K=(['dari perkawinan #0046# dan #0047# lahir anak yang dipersoalkan penguasaannya bernama #8602# dan semuanya anak kandung keduanya',
      'anak yang menjadi pokok perkara ini bernama #8602# dan ia anak kandung #0046# dan #0047#'],
     ['yang dipersoalkan penguasaannya adalah anak bernama #8602# yang lahir dari perkawinan #0046# dan #0047#',
      'anak kandung #0046# dan #0047# yang diperebutkan bernama #8602#']),
  A=['anak #0046# dan #0047# yang dipersoalkan bernama #8602#', 'yang menjadi pokok perkara adalah anak bernama #8602#'],
  B=['anak #0046# dan #0047# ada lebih banyak daripada yang disebut dalam gugatan', 'jumlah anak #0046# dan #0047# lebih banyak daripada yang disebut dalam gugatan'],
  beda_pada='jumlah', beda_maksud='versi A: hanya anak yang disebut dalam gugatan; versi B: ada anak lain yang tidak disebut - berselisih pada JUMLAH ANAK')

S(id='akta-lahir', pokok='pp-pa-identitas', urut=33, tingkat='jarang', kelompok='pokok',
  teks='Apakah anak bernama #8602# sudah mempunyai akta kelahiran dan siapa orang tua yang tercatat di dalamnya?',
  hal='akta kelahiran anak dan nama orang tua yang tercatat', m='akta kelahiran anak bernama #8602#',
  K=(['anak bernama #8602# sudah memiliki akta kelahiran yang mencatat #0046# dan #0047# sebagai orang tuanya',
      'kelahiran anak bernama #8602# sudah tercatat dalam akta kelahiran atas nama orang tuanya #0046# dan #0047#'],
     ['akta kelahiran anak bernama #8602# sudah ada dan tercatat orang tuanya adalah #0046# dan #0047#',
      'anak bernama #8602# memegang akta kelahiran dengan nama #0046# dan #0047# sebagai ayah dan ibunya']),
  A=['anak bernama #8602# sudah memiliki akta kelahiran', 'akta kelahiran anak bernama #8602# sudah ada'],
  B=['anak bernama #8602# belum memiliki akta kelahiran', 'akta kelahiran anak bernama #8602# belum dibuat'],
  beda_maksud='versi A: akta kelahiran sudah ada; versi B: belum ada - berselisih pada PERISTIWA')

S(id='asuh-sebelumnya', pokok='pp-pa-hak', urut=35, tingkat='inti', kelompok='pokok',
  teks='Sebelum anak bernama #8602# berada dalam penguasaan sekarang siapa yang sehari-hari merawat dan mengasuhnya?',
  varian=['Siapa yang merawat anak bernama #8602# sejak lahir sampai ia berada dalam penguasaan yang dipersoalkan ini?'],
  hal='pihak yang merawat anak sebelum penguasaan sekarang', m='perawatan anak bernama #8602# sebelum penguasaan sekarang', v=PENGASUH,
  K=(['sebelum anak bernama #8602# berada dalam penguasaan @X@ anak itu dirawat dan diasuh sehari-hari oleh @Y@',
      'sejak lahir sampai berada dalam penguasaan @X@ anak bernama #8602# dirawat sehari-hari oleh @Y@'],
     ['sebelum dikuasai @X@ anak bernama #8602# diasuh dan dirawat setiap hari oleh @Y@',
      'perawatan anak bernama #8602# sehari-hari dahulu dilakukan @Y@ sebelum anak itu berada dalam penguasaan @X@']),
  A=['anak dahulu dirawat oleh pihak yang sekarang menuntut', 'dahulu anak dirawat sehari-hari oleh pihak yang sekarang menuntut'],
  B=['anak dahulu dirawat bersama oleh kedua orang tuanya', 'dahulu anak dirawat bersama oleh kedua orang tuanya'],
  beda_pada='pelaku', beda_maksud='versi A: dirawat pihak yang menuntut; versi B: dirawat bersama - berselisih pada PELAKU')

S(id='cara-dibawa', pokok='pp-pa-cara-bawa', urut=41, tingkat='inti', kelompok='pokok', keadaan={'caraPenguasaan': 'dibawa-pergi'},
  teks='Bagaimana anak bernama #8602# sampai dibawa pergi oleh pihak yang menguasainya dan apa yang saksi lihat pada waktu itu?',
  hal='peristiwa anak dibawa pergi oleh pihak yang menguasainya', m='peristiwa anak bernama #8602# dibawa pergi', v=PENGASUH, fam='hadir',
  K=(['anak bernama #8602# dibawa pergi oleh @X@ dari rumah @Y@ pada {sejak} dan peristiwa itu terjadi tanpa persetujuan @Y@',
      'pada {sejak} @X@ membawa pergi anak bernama #8602# dari rumah @Y@ tanpa persetujuan @Y@'],
     ['@X@ mengambil anak bernama #8602# dari rumah @Y@ pada {sejak} tanpa persetujuan @Y@',
      'peristiwa dibawanya anak bernama #8602# oleh @X@ dari rumah @Y@ pada {sejak} terjadi tanpa persetujuan @Y@']),
  A=['anak dibawa pergi oleh pihak yang menguasainya tanpa persetujuan', 'pihak yang menguasai membawa pergi anak tanpa persetujuan'],
  B=['anak dibawa pergi oleh pihak yang menguasainya dengan persetujuan', 'pihak yang menguasai membawa pergi anak dengan persetujuan'],
  beda_maksud='versi A: dibawa tanpa persetujuan; versi B: dibawa dengan persetujuan - berselisih pada PERISTIWA')

S(id='cara-tidak-kembali', pokok='pp-pa-cara-tahan', urut=42, tingkat='inti', kelompok='pokok', keadaan={'caraPenguasaan': ['tidak-dikembalikan', 'dititipkan-lalu-ditahan']},
  teks='Bagaimana awalnya anak bernama #8602# berada bersama pihak yang menguasainya dan mengapa anak itu tidak dikembalikan?',
  hal='awal anak berada bersama pihak yang menguasai dan sebab tidak dikembalikan', m='sebab anak bernama #8602# tidak dikembalikan', v=PENGASUH,
  K=(['anak bernama #8602# semula berada bersama @X@ untuk sementara waktu lalu tidak dikembalikan kepada @Y@ sampai sekarang',
      'mulanya anak bernama #8602# hanya dibawa @X@ untuk sementara lalu tidak dikembalikan kepada @Y@ sampai sekarang'],
     ['anak bernama #8602# dahulu hanya sementara bersama @X@ kemudian tidak diantar kembali kepada @Y@ sampai sekarang',
      'sementara waktu saja anak bernama #8602# bersama @X@ namun ia tidak dikembalikan kepada @Y@ sampai sekarang']),
  A=['anak dibawa untuk sementara lalu tidak dikembalikan sesuai janji', 'anak dibawa sementara kemudian tidak dikembalikan sesuai janji'],
  B=['anak diantar kembali sesuai janji lalu dibawa lagi', 'anak sudah dikembalikan sesuai janji lalu dibawa lagi'],
  beda_maksud='versi A: tidak dikembalikan; versi B: pernah dikembalikan lalu dibawa lagi - berselisih pada PERISTIWA')

S(id='cara-dititipkan', pokok='pp-pa-cara-tahan', urut=43, tingkat='pilihan', kelompok='pokok', keadaan={'caraPenguasaan': 'dititipkan-lalu-ditahan'},
  teks='Siapa yang menitipkan anak bernama #8602# kepada pihak yang menguasainya dan untuk berapa lama penitipan itu disepakati?',
  hal='penitipan anak dan lamanya yang disepakati', m='penitipan anak bernama #8602#', v=PENGASUH, fam='hadir',
  K=(['anak bernama #8602# dititipkan @Y@ kepada @X@ untuk jangka waktu {lama} dan saya mengetahui penitipan itu',
      '@Y@ menitipkan anak bernama #8602# kepada @X@ untuk jangka waktu {lama} dan hal itu diketahui banyak orang'],
     ['penitipan anak bernama #8602# oleh @Y@ kepada @X@ disepakati selama {lama} dan saya mengetahuinya',
      'kesepakatan @Y@ dan @X@ tentang penitipan anak bernama #8602# adalah selama {lama} dan hal itu diketahui banyak orang']),
  A=['anak dititipkan untuk jangka waktu tertentu yang sudah lewat', 'penitipan anak untuk jangka waktu tertentu itu sudah lewat'],
  B=['anak dititipkan tanpa batas waktu', 'penitipan anak dilakukan tanpa batas waktu'],
  beda_pada='lama', beda_maksud='versi A: penitipan sementara yang sudah lewat; versi B: tanpa batas waktu - berselisih pada LAMA')

S(id='cara-paksa', pokok='pp-pa-cara-paksa', urut=44, tingkat='pilihan', kelompok='pokok', keadaan={'caraPenguasaan': 'diambil-paksa'},
  teks='Apakah anak bernama #8602# diambil dengan paksa dari pengasuhan semula dan apa yang saksi ketahui tentang peristiwa itu?',
  hal='peristiwa anak diambil dengan paksa', m='peristiwa anak bernama #8602# diambil dengan paksa', v=PENGASUH, fam='hadir',
  K=(['anak bernama #8602# diambil @X@ dengan paksa dari rumah @Y@ dan anak itu menangis',
      '@X@ mengambil anak bernama #8602# dengan paksa dari rumah @Y@ sehingga anak itu menangis'],
     ['pengambilan anak bernama #8602# oleh @X@ dari rumah @Y@ dilakukan dengan paksa dan anak itu menangis',
      'dengan paksa @X@ membawa anak bernama #8602# dari rumah @Y@ dan anak itu menangis']),
  M=(['@X@ berkata akan membawa anak bernama #8602# dengan paksa dan @Y@ berusaha mencegahnya',
      '@X@ berteriak hendak mengambil anak bernama #8602# dan @Y@ berusaha mencegahnya'],
     ['@X@ menyatakan akan mengambil anak bernama #8602# dengan paksa dan @Y@ berusaha mencegahnya',
      '@X@ mengatakan hendak membawa anak bernama #8602# dengan paksa dan @Y@ berusaha mencegahnya']),
  A=['anak diambil dengan paksa dari pengasuhan semula', 'anak diambil secara paksa dari pengasuhan semula'],
  B=['anak ikut dengan sukarela dari pengasuhan semula', 'anak ikut atas kemauannya sendiri dari pengasuhan semula'],
  beda_maksud='versi A: diambil dengan paksa; versi B: ikut dengan sukarela - berselisih pada PERISTIWA')

S(id='waktu-mulai', pokok='pp-pa-waktu', urut=45, tingkat='pilihan', kelompok='pokok',
  teks='Pada kapan anak bernama #8602# mulai berada dalam penguasaan pihak tersebut dan sudah berapa lama sampai sekarang?',
  hal='waktu mulai dan lamanya penguasaan anak', m='waktu mulai penguasaan anak bernama #8602#', v=PENGASUH,
  K=(['anak bernama #8602# mulai berada dalam penguasaan @X@ sejak {sejak} sampai sekarang',
      'sejak {sejak} anak bernama #8602# berada terus dalam penguasaan @X@ sampai sekarang'],
     ['penguasaan @X@ atas anak bernama #8602# berlangsung sejak {sejak} sampai sekarang',
      'mulai {sejak} anak bernama #8602# dikuasai @X@ terus sampai sekarang']),
  A=['penguasaan itu sudah berlangsung lama', 'penguasaan itu sudah berjalan lama'],
  B=['penguasaan itu baru berlangsung beberapa waktu terakhir', 'penguasaan itu baru berjalan beberapa waktu terakhir'],
  beda_pada='lama', beda_maksud='versi A: sudah lama; versi B: baru beberapa waktu - berselisih pada LAMA')

S(id='anak-tidak-diketahui', pokok='pp-pa-waktu', urut=46, tingkat='inti', kelompok='pokok', keadaan={'lokasiAnak': 'tidak-diketahui'},
  teks='Apakah saksi mengetahui di mana anak bernama #8602# berada sekarang dan sejak kapan keberadaannya tidak diketahui pengaju?',
  hal='keberadaan anak yang tidak diketahui pengaju', m='keberadaan anak bernama #8602# yang tidak diketahui pengaju', v=PENGASUH,
  K=(['keberadaan anak bernama #8602# sekarang tidak diketahui #0046# karena @X@ menyembunyikannya sejak {sejak} sampai sekarang',
      '@X@ membawa anak bernama #8602# ke tempat yang tidak diberitahukan kepada #0046# sejak {sejak} sampai sekarang'],
     ['sejak {sejak} sampai sekarang #0046# tidak tahu di mana anak bernama #8602# berada karena @X@ menyembunyikannya',
      'tempat anak bernama #8602# berada tidak diberitahukan @X@ kepada #0046# sejak {sejak} sampai sekarang']),
  A=['keberadaan anak tidak diketahui oleh pengaju', 'pengaju tidak mengetahui keberadaan anak'],
  B=['keberadaan anak diketahui oleh pengaju', 'pengaju mengetahui keberadaan anak'],
  beda_pada='tempat', beda_maksud='versi A: keberadaan anak tidak diketahui; versi B: diketahui - berselisih pada TEMPAT')

S(id='permintaan-oleh', pokok='pp-pa-minta', urut=51, tingkat='pilihan', kelompok='akibat', keadaan={'penyerahan': 'ya'},
  teks='Siapa yang meminta anak bernama #8602# diserahkan kembali dan apa jawaban pihak yang menguasainya?',
  hal='permintaan penyerahan anak dan jawaban pihak yang menguasai', m='permintaan penyerahan anak bernama #8602#', v=PENGASUH, fam='hadir',
  K=(['#0046# beberapa kali meminta anak bernama #8602# diserahkan kembali tetapi @X@ menolak memberikannya',
      'permintaan #0046# agar anak bernama #8602# diserahkan berulang kali disampaikan namun @X@ menolaknya'],
     ['berkali kali #0046# meminta penyerahan anak bernama #8602# namun @X@ tetap menolak',
      '#0046# memohon agar anak bernama #8602# diserahkan akan tetapi @X@ menolak']),
  M=(['#0046# berkata kepada @X@ agar anak bernama #8602# diserahkan dan @X@ menjawab menolak',
      '@X@ menjawab menolak ketika #0046# meminta anak bernama #8602# diserahkan'],
     ['#0046# meminta di depan saya agar anak bernama #8602# diserahkan lalu @X@ menjawab menolak',
      'jawaban @X@ ketika #0046# meminta anak bernama #8602# diserahkan adalah menolak']),
  A=['permintaan penyerahan anak ditolak oleh pihak yang menguasai', 'pihak yang menguasai menolak permintaan penyerahan anak'],
  B=['pihak yang menguasai berjanji menyerahkan anak', 'pihak yang menguasai menjanjikan penyerahan anak'],
  beda_maksud='versi A: menolak menyerahkan; versi B: berjanji menyerahkan - berselisih pada PERISTIWA')

S(id='alasan-menolak', pokok='pp-pa-minta', urut=52, tingkat='pilihan', kelompok='akibat', keadaan={'penyerahan': 'ya'},
  teks='Apa alasan pihak yang menguasai anak bernama #8602# menolak menyerahkannya?',
  hal='alasan pihak yang menguasai menolak menyerahkan anak', m='alasan penolakan penyerahan anak bernama #8602#', v=PENGASUH,
  K=(['@X@ menolak menyerahkan anak bernama #8602# dengan alasan bahwa anak itu lebih terurus bersamanya',
      'alasan @X@ menolak menyerahkan anak bernama #8602# adalah bahwa anak itu lebih terurus bersamanya'],
     ['dengan alasan anak itu lebih terurus bersamanya @X@ menolak menyerahkan anak bernama #8602#',
      '@X@ beralasan anak bernama #8602# lebih terurus bersamanya sehingga ia menolak menyerahkannya']),
  A=['penolakan itu beralasan anak lebih terurus bersama pihak yang menguasai', 'alasan penolakan adalah anak lebih terurus bersama pihak yang menguasai'],
  B=['penolakan itu beralasan pengaju belum sanggup merawat anak', 'alasan penolakan adalah pengaju belum sanggup merawat anak'],
  beda_pada='penyebab', beda_maksud='versi A: alasan anak lebih terurus; versi B: alasan pengaju belum sanggup - berselisih pada PENYEBAB')

S(id='teguran-perantara', pokok='pp-pa-minta', urut=53, tingkat='jarang', kelompok='upaya', keadaan={'penyerahan': 'ya'},
  teks='Apakah pernah ada teguran atau perantaraan keluarga dan aparat desa agar anak bernama #8602# diserahkan dan bagaimana hasilnya?',
  hal='teguran dan perantaraan agar anak diserahkan', m='teguran dan perantaraan penyerahan anak bernama #8602#', v=PENGASUH,
  K=(['pernah ada perantaraan keluarga dan aparat desa agar anak bernama #8602# diserahkan namun @X@ tetap menolak',
      'keluarga dan aparat desa pernah menengahi agar anak bernama #8602# diserahkan tetapi @X@ tetap menolak'],
     ['perantaraan keluarga dan aparat desa agar anak bernama #8602# diserahkan pernah dilakukan akan tetapi @X@ tetap menolak',
      'upaya keluarga dan aparat desa menengahi penyerahan anak bernama #8602# membuat @X@ tetap menolak menyerahkannya']),
  A=['perantaraan keluarga dan aparat desa tidak berhasil', 'upaya perantaraan keluarga dan aparat desa tidak berhasil'],
  B=['perantaraan keluarga dan aparat desa berhasil dan anak diserahkan', 'upaya perantaraan keluarga dan aparat desa berhasil sehingga anak diserahkan'],
  beda_maksud='versi A: perantaraan tidak berhasil; versi B: berhasil - berselisih pada PERISTIWA')

S(id='dihalangi-bertemu', pokok='pp-pa-halang', urut=61, tingkat='inti', kelompok='pokok', keadaan={'akses': 'tidak'},
  teks='Apakah #0046# pernah dihalangi bertemu atau menghubungi anak bernama #8602# dan siapa yang menghalanginya?',
  hal='hambatan pengaju bertemu atau menghubungi anak', m='penghalangan pertemuan dengan anak bernama #8602#', v=PENGASUH, fam='hadir',
  K=(['#0046# dihalangi @X@ untuk bertemu dan menghubungi anak bernama #8602# ketika datang menjenguk',
      '@X@ melarang #0046# bertemu dan menghubungi anak bernama #8602# ketika datang menjenguk'],
     ['ketika #0046# datang menjenguk @X@ menghalanginya bertemu dan menghubungi anak bernama #8602#',
      '#0046# ditolak @X@ ketika hendak bertemu dan menghubungi anak bernama #8602#']),
  M=(['@X@ berkata kepada #0046# bahwa ia dilarang menemui anak bernama #8602#',
      '@X@ melarang #0046# menemui anak bernama #8602# di depan saya'],
     ['@X@ mengatakan kepada #0046# agar menjauhi anak bernama #8602#',
      '@X@ menyatakan di depan saya bahwa #0046# dilarang bertemu anak bernama #8602#']),
  A=['pengaju dihalangi bertemu anak', 'pengaju dilarang bertemu anak'],
  B=['pengaju dipersilakan bertemu anak', 'pengaju diizinkan bertemu anak'],
  beda_maksud='versi A: dihalangi bertemu anak; versi B: dipersilakan bertemu - berselisih pada PERISTIWA')

S(id='akses-berjalan', pokok='pp-pa-halang', urut=62, tingkat='pilihan', kelompok='pokok', keadaan={'akses': 'ya'},
  teks='Seberapa sering #0046# bertemu anak bernama #8602# selama anak itu berada dalam penguasaan sekarang?',
  hal='pertemuan pengaju dengan anak selama penguasaan', m='pertemuan #0046# dengan anak bernama #8602#', v=PENGASUH,
  K=(['#0046# masih diberi kesempatan bertemu anak bernama #8602# dan pertemuan itu berlangsung baik',
      '@X@ membolehkan #0046# bertemu anak bernama #8602# dan pertemuan itu berjalan baik'],
     ['pertemuan #0046# dengan anak bernama #8602# diizinkan dan berjalan baik',
      '#0046# leluasa bertemu anak bernama #8602# dan pertemuan berjalan baik']),
  A=['pengaju bebas bertemu anak kapan saja', 'pengaju dapat bertemu anak kapan pun'],
  B=['pengaju hanya boleh bertemu anak pada waktu tertentu', 'pengaju hanya diizinkan bertemu anak pada waktu yang ditentukan'],
  beda_pada='waktu', beda_maksud='versi A: bebas bertemu; versi B: hanya waktu tertentu - berselisih pada WAKTU')

S(id='komunikasi-anak', pokok='pp-pa-halang', urut=63, tingkat='jarang', kelompok='pokok',
  teks='Apakah anak bernama #8602# dapat berkomunikasi dengan #0046# lewat telepon atau pesan selama berada dalam penguasaan sekarang?',
  hal='komunikasi anak dengan pengaju lewat telepon atau pesan', m='komunikasi anak bernama #8602# dengan #0046#', v=PENGASUH,
  K=(['anak bernama #8602# dapat berbicara dengan #0046# lewat telepon dan @X@ tidak melarangnya',
      'telepon antara #0046# dan anak bernama #8602# berjalan lancar dan @X@ tidak melarangnya'],
     ['@X@ tidak pernah melarang anak bernama #8602# menelepon #0046#',
      'anak bernama #8602# bebas menelepon #0046# karena @X@ tidak melarangnya']),
  A=['anak dapat menelepon pengaju kapan saja', 'anak dapat menghubungi pengaju kapan pun'],
  B=['anak tidak dapat menghubungi pengaju karena ponselnya diambil', 'anak tidak bisa menghubungi pengaju karena ponselnya disita'],
  beda_maksud='versi A: anak dapat menelepon; versi B: tidak dapat karena ponsel diambil - berselisih pada PERISTIWA')

S(id='kesehatan-anak', pokok='pp-pa-kondisi', urut=71, tingkat='pilihan', kelompok='pokok',
  teks='Bagaimana kesehatan anak bernama #8602# selama berada dalam penguasaan sekarang dan siapa yang membawanya berobat?',
  hal='kesehatan anak selama dikuasai dan pengurusan pengobatannya', m='kesehatan anak bernama #8602# selama dikuasai', v=PENGASUH,
  K=(['anak bernama #8602# dalam keadaan sehat selama dikuasai @X@ dan @X@ yang membawanya berobat bila sakit',
      'kesehatan anak bernama #8602# terjaga selama bersama @X@ dan bila sakit @X@ sendiri yang mengurus pengobatannya'],
     ['selama dikuasai @X@ anak bernama #8602# sehat dan bila sakit @X@ yang membawanya berobat',
      'bila anak bernama #8602# sakit @X@ segera membawanya berobat sehingga kesehatannya terjaga selama dikuasai']),
  A=['anak sehat dan terawat selama dikuasai', 'kesehatan anak terjaga selama dikuasai'],
  B=['anak sering sakit dan kurang terawat selama dikuasai', 'kesehatan anak kurang terjaga selama dikuasai'],
  beda_maksud='versi A: sehat dan terawat; versi B: sering sakit - berselisih pada PERISTIWA')

S(id='sekolah-selama-dikuasai', pokok='pp-pa-kondisi', urut=72, tingkat='pilihan', kelompok='akibat',
  teks='Apakah anak bernama #8602# tetap bersekolah selama berada dalam penguasaan sekarang dan siapa yang mengurus sekolahnya?',
  hal='sekolah anak selama dikuasai', m='sekolah anak bernama #8602# selama dikuasai', v=PENGASUH,
  K=(['anak bernama #8602# tetap bersekolah selama dikuasai @X@ dan @X@ yang mengurus keperluan sekolahnya',
      'selama bersama @X@ anak bernama #8602# tetap masuk sekolah dan keperluan sekolahnya diurus @X@'],
     ['sekolah anak bernama #8602# berjalan terus selama dikuasai @X@ yang mengurus keperluannya',
      '@X@ mengurus keperluan sekolah anak bernama #8602# sehingga anak itu tetap bersekolah selama dikuasai']),
  A=['anak tetap bersekolah dengan baik selama dikuasai', 'sekolah anak berjalan baik selama dikuasai'],
  B=['sekolah anak terhenti selama dikuasai', 'anak berhenti bersekolah selama dikuasai'],
  beda_maksud='versi A: sekolah berjalan; versi B: sekolah terhenti - berselisih pada PERISTIWA')

S(id='ibadah-selama-dikuasai', pokok='pp-pa-kondisi', urut=73, tingkat='jarang', kelompok='pokok',
  teks='Bagaimana anak bernama #8602# menjalankan ibadah dan belajar agama selama berada dalam penguasaan sekarang?',
  hal='ibadah dan pendidikan agama anak selama dikuasai', m='ibadah anak bernama #8602# selama dikuasai', v=PENGASUH,
  K=(['anak bernama #8602# dibimbing @X@ menjalankan ibadah dan belajar agama selama dikuasai',
      '@X@ membimbing anak bernama #8602# beribadah dan belajar agama selama anak itu dikuasai'],
     ['ibadah dan pelajaran agama anak bernama #8602# dibimbing langsung oleh @X@ selama dikuasai',
      'selama dikuasai anak bernama #8602# beribadah dan belajar agama di bawah bimbingan @X@']),
  A=['anak rajin beribadah dan belajar agama selama dikuasai', 'anak beribadah dengan teratur dan belajar agama selama dikuasai'],
  B=['anak jarang beribadah dan belajar agama selama dikuasai', 'ibadah dan pelajaran agama anak sering ditinggalkan selama dikuasai'],
  beda_maksud='versi A: rajin beribadah; versi B: jarang beribadah - berselisih pada PERISTIWA')

S(id='jiwa-anak', pokok='pp-pa-kondisi', urut=74, tingkat='jarang', kelompok='akibat',
  teks='Bagaimana perasaan dan keadaan jiwa anak bernama #8602# selama berada dalam penguasaan sekarang?',
  hal='keadaan jiwa dan perasaan anak selama dikuasai', m='keadaan jiwa anak bernama #8602# selama dikuasai', v=PENGASUH,
  K=(['anak bernama #8602# tampak tenang dan ceria selama bersama @X@',
      'selama dikuasai @X@ anak bernama #8602# terlihat riang dan merasa aman'],
     ['bersama @X@ anak bernama #8602# kelihatan gembira dan tenang',
      'anak bernama #8602# merasa nyaman dan ceria dalam penguasaan @X@']),
  A=['anak tampak tenang dan ceria selama dikuasai', 'anak terlihat riang dan tenang selama dikuasai'],
  B=['anak tampak murung dan gelisah selama dikuasai', 'anak terlihat sedih dan gelisah selama dikuasai'],
  beda_maksud='versi A: tenang dan ceria; versi B: murung dan gelisah - berselisih pada PERISTIWA')

S(id='pengaruh-lingkungan', pokok='pp-pa-kondisi', urut=75, tingkat='jarang', kelompok='akibat',
  teks='Bagaimana pengaruh lingkungan tempat anak bernama #8602# berada sekarang terhadap pergaulan dan perilakunya?',
  hal='pengaruh lingkungan tempat anak berada terhadap pergaulan dan perilakunya', m='pengaruh lingkungan terhadap anak bernama #8602#', v=PENGASUH,
  K=(['lingkungan tempat anak bernama #8602# berada bersama @X@ baik dan pergaulan anak itu terjaga',
      'pergaulan anak bernama #8602# terjaga di lingkungan tempat tinggal @X@ yang baik'],
     ['di lingkungan @X@ yang baik pergaulan anak bernama #8602# terjaga',
      'lingkungan rumah @X@ baik bagi pergaulan dan perilaku anak bernama #8602#']),
  A=['lingkungan tempat anak berada baik dan pergaulannya terjaga', 'pergaulan anak terjaga di lingkungan yang baik'],
  B=['lingkungan tempat anak berada rawan dan pergaulannya bebas', 'pergaulan anak bebas di lingkungan yang rawan'],
  beda_pada='tempat', beda_maksud='versi A: lingkungan baik; versi B: lingkungan rawan - berselisih pada TEMPAT')

S(id='penguasa-pengawasan', pokok='pp-pa-penguasa', urut=81, tingkat='jarang', kelompok='pokok',
  teks='Siapa yang mengawasi anak bernama #8602# ketika pihak yang menguasainya sedang bekerja atau bepergian?',
  hal='pengawasan anak ketika pihak yang menguasai bekerja atau bepergian', m='pengawasan anak bernama #8602# oleh pihak yang menguasai', v=PENGASUH,
  K=(['ketika @X@ bekerja atau bepergian anak bernama #8602# diawasi keluarga dekatnya',
      'bila @X@ pergi bekerja anak bernama #8602# berada dalam pengawasan keluarga dekatnya'],
     ['anak bernama #8602# dijaga keluarga dekat @X@ ketika @X@ bekerja atau bepergian',
      'selama @X@ bekerja atau bepergian anak bernama #8602# dititipkan kepada keluarga dekat yang dipercaya']),
  A=['anak selalu diawasi ketika pihak yang menguasai bekerja', 'anak selalu ada yang mengawasi ketika pihak yang menguasai bekerja'],
  B=['anak sering dibiarkan sendirian ketika pihak yang menguasai bekerja', 'anak sering ditinggal sendirian ketika pihak yang menguasai bekerja'],
  beda_maksud='versi A: selalu diawasi; versi B: sering dibiarkan sendirian - berselisih pada PERISTIWA')

S(id='penguasa-ekonomi', pokok='pp-pa-penguasa', urut=82, tingkat='pilihan', kelompok='pokok',
  teks='Dari mana pihak yang menguasai anak bernama #8602# memenuhi kebutuhan hidup dan sekolah anak itu?',
  hal='sumber pemenuhan kebutuhan anak oleh pihak yang menguasai', m='sumber kebutuhan anak bernama #8602# oleh pihak yang menguasai', v=PENGASUH,
  K=(['@X@ memenuhi kebutuhan hidup dan sekolah anak bernama #8602# dari penghasilan pekerjaannya sendiri',
      'kebutuhan hidup dan sekolah anak bernama #8602# dipenuhi @X@ dari hasil kerjanya'],
     ['biaya hidup dan sekolah anak bernama #8602# ditutup @X@ dari penghasilannya',
      '@X@ mencukupi keperluan hidup dan sekolah anak bernama #8602# dengan hasil kerjanya']),
  A=['kebutuhan anak tercukupi dari penghasilan pihak yang menguasai', 'kebutuhan anak terpenuhi dari penghasilan pihak yang menguasai'],
  B=['kebutuhan anak sering kekurangan karena penghasilan pihak yang menguasai kecil', 'kebutuhan anak sering kurang karena penghasilan pihak yang menguasai kecil'],
  beda_pada='jumlah', beda_maksud='versi A: kebutuhan tercukupi; versi B: kekurangan - berselisih pada JUMLAH PENGHASILAN')

S(id='penguasa-akhlak', pokok='pp-pa-penguasa', urut=83, tingkat='pilihan', kelompok='pokok',
  teks='Bagaimana akhlak dan ketaatan beribadah pihak yang menguasai anak bernama #8602# dan apakah ia menjadi teladan bagi anak?',
  hal='akhlak dan ketaatan beribadah pihak yang menguasai anak', m='akhlak dan ibadah pihak yang menguasai anak bernama #8602#', v=PENGASUH,
  K=(['@X@ berakhlak baik dan taat beribadah sehingga menjadi teladan bagi anak bernama #8602#',
      'akhlak @X@ baik dan ibadahnya terjaga sehingga menjadi contoh bagi anak bernama #8602#'],
     ['sebagai orang yang berakhlak baik dan taat beribadah @X@ menjadi teladan bagi anak bernama #8602#',
      'anak bernama #8602# mencontoh akhlak dan ibadah @X@ yang baik dan terjaga']),
  A=['pihak yang menguasai berakhlak baik dan taat beribadah', 'pihak yang menguasai berperilaku baik dan taat beribadah'],
  B=['pihak yang menguasai berperilaku buruk dan jarang beribadah', 'pihak yang menguasai berakhlak buruk dan jarang beribadah'],
  beda_maksud='versi A: akhlak baik dan taat; versi B: buruk dan jarang beribadah - berselisih pada PERISTIWA')

S(id='penguasa-kebiasaan', pokok='pp-pa-penguasa', urut=84, tingkat='jarang', kelompok='pokok',
  teks='Apakah pihak yang menguasai anak bernama #8602# memiliki kebiasaan buruk seperti minuman keras, judi atau narkoba?',
  hal='kebiasaan buruk pihak yang menguasai anak', m='kebiasaan buruk pihak yang menguasai anak bernama #8602#', v=PENGASUH,
  K=(['@X@ tidak memiliki kebiasaan buruk berupa minuman keras judi atau narkoba',
      '@X@ tidak pernah saya lihat minum minuman keras berjudi atau memakai narkoba'],
     ['tidak ada kebiasaan buruk pada @X@ berupa minuman keras judi maupun narkoba',
      'selama saya kenal @X@ tidak pernah terlibat minuman keras judi atau narkoba']),
  A=['pihak yang menguasai tidak memiliki kebiasaan buruk', 'pihak yang menguasai tidak pernah terlibat kebiasaan buruk'],
  B=['pihak yang menguasai memiliki kebiasaan minum minuman keras', 'pihak yang menguasai sering terlihat minum minuman keras'],
  beda_maksud='versi A: tidak ada kebiasaan buruk; versi B: ada kebiasaan buruk - berselisih pada PERISTIWA')

S(id='penguasa-rumah', pokok='pp-pa-penguasa', urut=85, tingkat='pilihan', kelompok='pokok',
  teks='Bagaimana keadaan rumah pihak yang menguasai anak bernama #8602# dan siapa saja yang tinggal di dalamnya?',
  hal='keadaan rumah pihak yang menguasai anak dan penghuninya', m='rumah pihak yang menguasai anak bernama #8602#', v=PENGASUH,
  K=(['rumah yang ditempati @X@ bersama anak bernama #8602# layak huni dan dihuni keluarga dekatnya',
      'anak bernama #8602# tinggal bersama @X@ di rumah yang layak huni bersama keluarga dekatnya'],
     ['@X@ dan anak bernama #8602# menempati rumah yang layak huni bersama keluarga dekatnya',
      'rumah tempat anak bernama #8602# tinggal bersama @X@ layak huni dan dihuni keluarga dekatnya']),
  A=['rumah tempat anak tinggal layak huni dan cukup luas', 'rumah tempat anak tinggal cukup luas dan layak ditempati'],
  B=['rumah tempat anak tinggal sempit dan kurang layak', 'rumah tempat anak tinggal sempit dan kurang layak huni'],
  beda_pada='tempat', beda_maksud='versi A: rumah layak huni; versi B: sempit dan kurang layak - berselisih pada TEMPAT')

S(id='kerabat-hubungan', pokok='pp-pa-kerabat', urut=91, tingkat='inti', kelompok='pokok', keadaan={'penguasaLain': 'kerabat'},
  teks='Apa hubungan pihak yang menguasai dengan anak bernama #8602# dan mengapa ia merawat anak itu?',
  hal='hubungan pihak yang menguasai dengan anak dan alasan merawatnya', m='hubungan pihak yang menguasai dengan anak bernama #8602#', v=PENGASUH,
  K=(['@X@ adalah {hubungan} anak bernama #8602# dan ia merawat anak itu karena orang tuanya berhalangan',
      'hubungan @X@ dengan anak bernama #8602# adalah {hubungan} dan ia merawat anak itu karena orang tuanya berhalangan'],
     ['@X@ berkedudukan sebagai {hubungan} anak bernama #8602# dan merawat anak itu sebab orang tuanya berhalangan',
      'sebagai {hubungan} anak bernama #8602# maka @X@ merawat anak itu karena orang tuanya berhalangan']),
  A=['pihak yang menguasai adalah kerabat dekat anak', 'kerabat dekat anak adalah pihak yang menguasai anak'],
  B=['pihak yang menguasai adalah orang lain yang tidak bertalian darah dengan anak', 'pihak yang menguasai orang lain yang tidak bertalian darah dengan anak'],
  beda_pada='pelaku', beda_maksud='versi A: kerabat dekat; versi B: orang lain - berselisih pada PELAKU')

S(id='kerabat-izin', pokok='pp-pa-kerabat', urut=92, tingkat='pilihan', kelompok='pokok', keadaan={'penguasaLain': 'kerabat'},
  teks='Apakah orang tua anak bernama #8602# pernah mengizinkan atau menyerahkan perawatan anak itu kepada pihak yang menguasainya?',
  hal='izin orang tua atas perawatan anak oleh pihak yang menguasai', m='izin orang tua atas perawatan anak bernama #8602#', v=PENGASUH,
  K=(['#0046# hanya mengizinkan @X@ merawat anak bernama #8602# untuk sementara dan tidak menyerahkannya selamanya',
      'izin #0046# kepada @X@ merawat anak bernama #8602# hanya untuk sementara tidak untuk selamanya'],
     ['perawatan anak bernama #8602# oleh @X@ hanya diizinkan #0046# untuk sementara tidak untuk selamanya',
      '#0046# menyerahkan anak bernama #8602# kepada @X@ hanya untuk sementara dan tidak untuk selamanya']),
  A=['orang tua hanya mengizinkan perawatan sementara', 'orang tua mengizinkan perawatan hanya untuk sementara'],
  B=['orang tua menyerahkan perawatan anak sepenuhnya', 'orang tua menyerahkan seluruh perawatan anak'],
  beda_pada='lama', beda_maksud='versi A: izin sementara; versi B: penyerahan penuh - berselisih pada LAMA')

S(id='penuntut-rumah', pokok='pp-pa-penuntut', urut=101, tingkat='pilihan', kelompok='pokok',
  teks='Bagaimana keadaan rumah dan lingkungan tempat anak bernama #8602# akan tinggal bila diserahkan kepada pihak yang menuntutnya?',
  hal='rumah dan lingkungan pihak yang menuntut penyerahan anak', m='rumah pihak yang menuntut penyerahan anak bernama #8602#', v=PENGASUH,
  K=(['rumah @Y@ layak huni dan lingkungannya aman bagi anak bernama #8602#',
      'tempat tinggal @Y@ layak huni dengan lingkungan yang aman bagi anak bernama #8602#'],
     ['@Y@ memiliki tempat tinggal yang layak huni dan lingkungannya aman bagi anak bernama #8602#',
      'di rumah @Y@ ada ruang yang layak bagi anak bernama #8602# dan lingkungannya aman']),
  A=['rumah pihak yang menuntut layak huni dan lingkungannya aman', 'lingkungan rumah pihak yang menuntut aman dan rumahnya layak huni'],
  B=['rumah pihak yang menuntut sempit dan lingkungannya rawan', 'lingkungan rumah pihak yang menuntut rawan dan rumahnya sempit'],
  beda_pada='tempat', beda_maksud='versi A: rumah layak dan aman; versi B: sempit dan rawan - berselisih pada TEMPAT')

S(id='penuntut-ekonomi', pokok='pp-pa-penuntut', urut=102, tingkat='pilihan', kelompok='pokok',
  teks='Apa pekerjaan pihak yang menuntut penyerahan anak bernama #8602# dan apakah penghasilannya mencukupi kebutuhan anak?',
  hal='pekerjaan dan penghasilan pihak yang menuntut penyerahan anak', m='penghasilan pihak yang menuntut penyerahan anak bernama #8602#', v=PENGASUH,
  K=(['@Y@ bekerja dan memiliki penghasilan yang mencukupi kebutuhan anak bernama #8602#',
      'penghasilan @Y@ dari pekerjaannya mencukupi kebutuhan hidup dan sekolah anak bernama #8602#'],
     ['dari pekerjaannya @Y@ memperoleh penghasilan yang cukup bagi kebutuhan anak bernama #8602#',
      '@Y@ berpenghasilan cukup dari pekerjaannya untuk membiayai anak bernama #8602#']),
  A=['penghasilan pihak yang menuntut mencukupi kebutuhan anak', 'penghasilan pihak yang menuntut cukup untuk kebutuhan anak'],
  B=['penghasilan pihak yang menuntut kecil dan pas-pasan bagi kebutuhan anak', 'penghasilan pihak yang menuntut kecil dan pas-pasan untuk kebutuhan anak'],
  beda_pada='jumlah', beda_maksud='versi A: penghasilan mencukupi; versi B: kecil dan pas-pasan - berselisih pada JUMLAH PENGHASILAN')

S(id='penuntut-waktu', pokok='pp-pa-penuntut', urut=103, tingkat='jarang', kelompok='pokok',
  teks='Apakah pihak yang menuntut penyerahan anak bernama #8602# memiliki waktu untuk mengurus anak dan siapa yang membantunya?',
  hal='waktu dan bantuan keluarga bagi pihak yang menuntut penyerahan anak', m='waktu pihak yang menuntut mengurus anak bernama #8602#', v=PENGASUH,
  K=(['@Y@ memiliki waktu yang cukup mengurus anak bernama #8602# dan dibantu keluarga dekatnya',
      'waktu @Y@ cukup untuk mengurus anak bernama #8602# apalagi ia dibantu keluarga dekatnya'],
     ['@Y@ sanggup mengurus anak bernama #8602# karena waktunya cukup dan keluarga dekatnya ikut membantu',
      'dengan waktu yang cukup dan bantuan keluarga dekat @Y@ dapat mengurus anak bernama #8602#']),
  A=['pihak yang menuntut punya waktu cukup untuk anak', 'pihak yang menuntut memiliki waktu yang cukup bagi anak'],
  B=['pihak yang menuntut sibuk bekerja dan jarang di rumah', 'pihak yang menuntut sibuk bekerja dan jarang berada di rumah'],
  beda_pada='waktu', beda_maksud='versi A: waktu cukup; versi B: sibuk dan jarang di rumah - berselisih pada WAKTU')

S(id='penuntut-akhlak', pokok='pp-pa-penuntut', urut=104, tingkat='jarang', kelompok='pokok',
  teks='Bagaimana akhlak dan ketaatan beribadah pihak yang menuntut penyerahan anak bernama #8602# di lingkungannya?',
  hal='akhlak dan ibadah pihak yang menuntut penyerahan anak', m='akhlak dan ibadah pihak yang menuntut penyerahan anak bernama #8602#', v=PENGASUH,
  K=(['@Y@ berakhlak baik dan taat beribadah serta dikenal baik di lingkungannya',
      'akhlak @Y@ baik dan ibadahnya terjaga serta namanya baik di lingkungannya'],
     ['@Y@ dikenal berakhlak baik dan taat beribadah di lingkungannya',
      'di lingkungannya @Y@ dikenal baik serta taat beribadah']),
  A=['pihak yang menuntut berakhlak baik dan taat beribadah', 'pihak yang menuntut berperilaku baik dan taat beribadah'],
  B=['pihak yang menuntut sering bermasalah dan jarang beribadah', 'pihak yang menuntut kerap bermasalah dan jarang beribadah'],
  beda_maksud='versi A: berakhlak baik; versi B: sering bermasalah - berselisih pada PERISTIWA')

S(id='ikatan-anak', pokok='pp-pa-ikatan', urut=111, tingkat='pilihan', kelompok='pokok',
  teks='Dengan siapa anak bernama #8602# lebih dekat dan tampak lebih nyaman?',
  hal='kedekatan dan kenyamanan anak dengan masing-masing pihak', m='kedekatan anak bernama #8602# dengan #0046#', v=PENGASUH,
  K=(['anak bernama #8602# sangat dekat dan akrab dengan @Y@ sebagaimana sebelum dikuasai @X@',
      'kedekatan anak bernama #8602# kepada @Y@ sangat terasa sebagaimana sebelum dikuasai @X@'],
     ['sebelum dikuasai @X@ anak bernama #8602# sangat akrab dengan @Y@ dan kedekatan itu masih terlihat',
      'anak bernama #8602# masih sangat dekat kepada @Y@ meski kini dikuasai @X@']),
  A=['anak lebih dekat dengan pihak yang menuntut', 'kedekatan anak lebih terasa kepada pihak yang menuntut'],
  B=['anak sama dekatnya dengan kedua pihak', 'kedekatan anak sama kuatnya kepada kedua pihak'],
  beda_pada='pelaku', beda_maksud='versi A: lebih dekat pada pihak yang menuntut; versi B: sama dekat - berselisih pada PELAKU')

S(id='sikap-bertemu', pokok='pp-pa-ikatan', urut=112, tingkat='jarang', kelompok='pokok',
  teks='Bagaimana sikap anak bernama #8602# ketika bertemu dengan #0046#?',
  hal='sikap anak ketika bertemu pengaju', m='sikap anak bernama #8602# ketika bertemu #0046#', fam='hadir',
  K=(['anak bernama #8602# tampak senang dan akrab setiap kali bertemu #0046#',
      'setiap bertemu #0046# anak bernama #8602# terlihat gembira dan akrab'],
     ['bila bertemu #0046# anak bernama #8602# bersikap akrab dan gembira',
      'anak bernama #8602# menyambut #0046# dengan akrab dan gembira ketika bertemu']),
  A=['anak senang dan akrab bila bertemu pengaju', 'anak gembira dan akrab saat bertemu pengaju'],
  B=['anak takut dan menjauh bila bertemu pengaju', 'anak ketakutan dan menjauh saat bertemu pengaju'],
  beda_maksud='versi A: anak senang dan akrab; versi B: takut dan menjauh - berselisih pada PERISTIWA')

S(id='anak-merindukan', pokok='pp-pa-ikatan', urut=113, tingkat='jarang', kelompok='akibat',
  teks='Apakah anak bernama #8602# pernah menanyakan atau merindukan #0046#?',
  hal='anak menanyakan atau merindukan pengaju', m='anak bernama #8602# merindukan #0046#',
  M=(['anak bernama #8602# sering menanyakan #0046# dan berkata ingin bertemu',
      'anak bernama #8602# berkata rindu kepada #0046# dan ingin bertemu'],
     ['anak bernama #8602# bertanya kapan ia bisa bertemu #0046# dan berkata merindukannya',
      'anak bernama #8602# mengatakan rindu kepada #0046# dan ingin bertemu']),
  K=(['anak bernama #8602# sering menanyakan #0046# dan ingin bertemu dengannya',
      'anak bernama #8602# kerap menanyakan #0046# dan tampak rindu ingin bertemu'],
     ['anak bernama #8602# merindukan #0046# dan beberapa kali menanyakannya',
      'beberapa kali anak bernama #8602# menanyakan #0046# dan tampak ingin bertemu']),
  A=['anak sering menanyakan dan merindukan pengaju', 'anak kerap menanyakan dan rindu kepada pengaju'],
  B=['anak tidak pernah menanyakan pengaju', 'anak tidak pernah bertanya tentang pengaju'],
  beda_maksud='versi A: anak menanyakan dan merindukan; versi B: tidak pernah menanyakan - berselisih pada PERISTIWA')

S(id='butuh-ibu', pokok='pp-pa-ikatan', urut=114, tingkat='pilihan', kelompok='pokok', keadaan={'anakMumayyiz': 'belum'},
  teks='Karena anak bernama #8602# masih kecil apakah ia masih memerlukan perawatan langsung dari ibunya sehari-hari?',
  hal='kebutuhan anak yang masih kecil akan perawatan langsung ibunya', m='kebutuhan anak bernama #8602# akan perawatan ibunya',
  K=(['anak bernama #8602# masih kecil dan masih memerlukan perawatan langsung dari ibunya sehari-hari',
      'karena masih di bawah usia mumayyiz anak bernama #8602# masih memerlukan perawatan ibunya setiap hari'],
     ['usia anak bernama #8602# masih di bawah usia mumayyiz dan ia masih memerlukan perawatan langsung ibunya sehari-hari',
      'anak bernama #8602# yang masih di bawah usia mumayyiz masih memerlukan ibunya merawatnya setiap hari']),
  A=['anak yang masih kecil memerlukan perawatan langsung ibunya', 'anak yang masih kecil membutuhkan perawatan langsung ibunya'],
  B=['anak sudah dapat mengurus dirinya sendiri', 'anak sudah dapat mengurus keperluannya sendiri'],
  beda_maksud='versi A: masih memerlukan perawatan ibu; versi B: sudah dapat mengurus diri - berselisih pada PERISTIWA')

S(id='pilihan-alasan', pokok='pp-pa-pilihan', urut=121, tingkat='tambahan', kelompok='pokok', keadaan={'anakMumayyiz': 'sudah'},
  teks='Apakah anak bernama #8602# menyebut alasan mengapa ia memilih tinggal bersama orang tua yang dipilihnya?',
  hal='alasan anak memilih tinggal bersama salah satu pihak', m='alasan pilihan anak bernama #8602#', v=PILIHAN,
  K=(['anak bernama #8602# memilih tinggal bersama @X@ karena merasa lebih nyaman dan lebih diperhatikan',
      'alasan anak bernama #8602# memilih @X@ adalah karena merasa lebih nyaman dan diperhatikan'],
     ['anak bernama #8602# lebih memilih @X@ sebab ia merasa nyaman dan diperhatikan olehnya',
      'anak bernama #8602# menyebut @X@ sebagai pilihannya karena merasa nyaman dan diperhatikan']),
  M=(['anak bernama #8602# berkata ia ingin tinggal bersama @X@ karena merasa nyaman',
      'anak bernama #8602# menyebut alasannya memilih @X@ yaitu merasa nyaman'],
     ['anak bernama #8602# menyatakan memilih @X@ karena nyaman di dekatnya',
      'anak bernama #8602# mengatakan ingin ikut @X@ sebab ia merasa nyaman']),
  A=['anak memilih karena merasa nyaman', 'anak memilih sebab merasa diperhatikan'],
  B=['anak memilih karena dijanjikan hadiah', 'anak memilih sebab diiming-imingi hadiah'],
  beda_pada='penyebab', beda_maksud='versi A: memilih karena nyaman; versi B: memilih karena dijanjikan hadiah - berselisih pada PENYEBAB')

S(id='pilihan-bebas', pokok='pp-pa-pilihan', urut=122, tingkat='tambahan', kelompok='pokok', keadaan={'anakMumayyiz': 'sudah'},
  teks='Apakah pilihan anak bernama #8602# datang dari kemauannya sendiri tanpa dipengaruhi atau ditekan siapa pun?',
  hal='kemandirian pilihan anak tanpa tekanan', m='kemandirian pilihan anak bernama #8602#', v=PILIHAN,
  K=(['pilihan anak bernama #8602# untuk tinggal bersama @X@ datang dari kemauannya sendiri tanpa tekanan',
      'anak bernama #8602# memilih @X@ atas kemauan sendiri tanpa tekanan dari siapa pun'],
     ['tanpa tekanan dari siapa pun anak bernama #8602# memilih tinggal bersama @X@ atas kemauannya sendiri',
      'pilihan anak bernama #8602# terhadap @X@ lahir dari kehendaknya sendiri tanpa dipaksa']),
  A=['pilihan anak datang dari kemauannya sendiri tanpa paksaan', 'anak memilih atas kemauan sendiri tanpa paksaan'],
  B=['pilihan anak dipengaruhi bujukan salah satu pihak', 'anak memilih setelah dibujuk salah satu pihak'],
  beda_pada='penyebab', beda_maksud='versi A: pilihan atas kemauan sendiri; versi B: dipengaruhi bujukan - berselisih pada PENYEBAB')

S(id='bahaya-kekerasan', pokok='pp-pa-bahaya', urut=131, tingkat='inti', kelompok='pokok', keadaan={'pengalihan': 'ya'},
  teks='Apakah saksi pernah melihat anak bernama #8602# dipukul atau dibentak oleh pihak yang menguasainya sampai ketakutan?',
  hal='kekerasan terhadap anak oleh pihak yang menguasainya', m='kekerasan terhadap anak bernama #8602# oleh @X@', v=PENGASUH, fam='hadir',
  K=(['@X@ pernah memukul dan membentak anak bernama #8602# sampai anak itu ketakutan',
      'anak bernama #8602# pernah dipukul dan dibentak @X@ hingga ketakutan'],
     ['pernah terjadi @X@ membentak dan memukul anak bernama #8602# sampai ia ketakutan',
      '@X@ memarahi anak bernama #8602# dengan kasar sampai anak itu ketakutan']),
  M=(['@X@ membentak anak bernama #8602# dengan kata kata kasar',
      '@X@ memarahi anak bernama #8602# dengan suara keras'],
     ['@X@ berteriak kasar kepada anak bernama #8602# dan anak itu menangis',
      '@X@ membentak anak bernama #8602# dengan kasar sampai anak itu menangis']),
  A=['pihak yang menguasai pernah memukul anak', 'pihak yang menguasai pernah main tangan kepada anak'],
  B=['pihak yang menguasai tidak pernah memukul anak', 'pihak yang menguasai tidak pernah main tangan kepada anak'],
  beda_maksud='versi A: pernah memukul; versi B: tidak pernah - berselisih pada PERISTIWA')

S(id='bahaya-penelantaran', pokok='pp-pa-bahaya', urut=132, tingkat='pilihan', kelompok='pokok', keadaan={'pengalihan': 'ya'},
  teks='Apakah anak bernama #8602# pernah tidak terurus atau tidak masuk sekolah dalam waktu lama karena pihak yang menguasainya lalai?',
  hal='anak tidak terurus karena kelalaian pihak yang menguasai', m='anak bernama #8602# tidak terurus oleh @X@', v=PENGASUH,
  K=(['anak bernama #8602# sering tidak terurus oleh @X@ dan pernah tidak masuk sekolah dalam waktu lama',
      '@X@ lalai mengurus anak bernama #8602# sehingga anak itu tidak terurus dan pernah lama tidak masuk sekolah'],
     ['kelalaian @X@ membuat anak bernama #8602# tidak terurus dan pernah lama tidak bersekolah',
      'anak bernama #8602# dibiarkan tidak terurus oleh @X@ hingga pernah lama tidak masuk sekolah']),
  A=['anak sering tidak terurus oleh pihak yang menguasainya', 'anak sering tidak terawat di bawah penguasaan pihak itu'],
  B=['anak selalu terurus oleh pihak yang menguasainya', 'anak selalu terawat di bawah penguasaan pihak itu'],
  beda_maksud='versi A: anak tidak terurus; versi B: terurus - berselisih pada PERISTIWA')

S(id='dampak-anak', pokok='pp-pa-bahaya', urut=141, tingkat='pilihan', kelompok='akibat',
  teks='Apa dampak keadaan penguasaan ini terhadap pelajaran dan perasaan anak bernama #8602# yang saksi lihat?',
  hal='dampak penguasaan terhadap pelajaran dan perasaan anak', m='dampak penguasaan terhadap anak bernama #8602#', v=PENGASUH,
  K=(['sejak dikuasai @X@ pelajaran dan perasaan anak bernama #8602# terganggu dan ia sering murung',
      'penguasaan oleh @X@ membuat pelajaran anak bernama #8602# terganggu dan perasaannya sering murung'],
     ['anak bernama #8602# sering murung dan pelajarannya terganggu sejak dikuasai @X@',
      'sejak berada bersama @X@ anak bernama #8602# menjadi sering murung dan pelajarannya terganggu']),
  A=['penguasaan itu mengganggu pelajaran dan perasaan anak', 'penguasaan itu berdampak pada pelajaran dan perasaan anak'],
  B=['penguasaan itu tidak mengganggu pelajaran dan perasaan anak', 'penguasaan itu tidak berdampak pada pelajaran dan perasaan anak'],
  beda_maksud='versi A: mengganggu; versi B: tidak mengganggu - berselisih pada PERISTIWA')

S(id='saudara-bersama', pokok='pp-pa-saudara', urut=161, tingkat='pilihan', kelompok='pokok', keadaan={'jumlahAnak': 'lebih'},
  teks='Apakah anak-anak #0046# dan #0047# tinggal bersama sebagai saudara selama dikuasai dan bagaimana kedekatan mereka?',
  hal='kebersamaan dan kedekatan anak-anak sebagai saudara', m='kebersamaan anak-anak #8602#', v=PENGASUH,
  K=(['anak-anak #8602# tinggal satu rumah di bawah penguasaan @X@ dan sangat dekat satu sama lain',
      'anak-anak #8602# berada bersama dalam penguasaan @X@ dan hubungan mereka sebagai saudara sangat dekat'],
     ['semua anak #8602# tinggal bersama @X@ dan mereka saling dekat sebagai saudara',
      'kebersamaan anak-anak #8602# di rumah @X@ terjaga dan mereka sangat dekat']),
  A=['anak-anak tinggal bersama dan sangat dekat satu sama lain', 'anak-anak berkumpul dan sangat akrab satu sama lain'],
  B=['anak-anak tinggal terpisah dan jarang bertemu', 'anak-anak hidup terpisah dan jarang bertemu'],
  beda_pada='tempat', beda_maksud='versi A: anak-anak bersama; versi B: terpisah - berselisih pada TEMPAT')

S(id='kesepakatan-keluarga', pokok='pp-pa-damai', urut=151, tingkat='pilihan', kelompok='upaya',
  teks='Apakah pernah ada kesepakatan keluarga tentang siapa yang merawat anak bernama #8602# dan apakah kesepakatan itu dijalankan?',
  hal='kesepakatan keluarga tentang perawatan anak dan pelaksanaannya', m='kesepakatan keluarga tentang perawatan anak bernama #8602#',
  K=(['pernah ada kesepakatan keluarga tentang perawatan anak bernama #8602# yang kemudian tidak dijalankan sebagaimana disepakati',
      'keluarga pernah bersepakat tentang perawatan anak bernama #8602# tetapi kesepakatan itu tidak dijalankan sebagaimana disepakati'],
     ['mengenai perawatan anak bernama #8602# pernah dicapai kesepakatan keluarga namun tidak dijalankan sebagaimana disepakati',
      'ada kesepakatan keluarga tentang perawatan anak bernama #8602# yang tidak dijalankan sebagaimana disepakati']),
  A=['kesepakatan keluarga tentang perawatan anak dijalankan dengan baik', 'kesepakatan keluarga tentang perawatan anak berjalan dengan baik'],
  B=['kesepakatan keluarga tentang perawatan anak tidak pernah ada', 'tidak pernah ada kesepakatan keluarga tentang perawatan anak'],
  beda_maksud='versi A: ada kesepakatan dan dijalankan; versi B: tidak pernah ada kesepakatan - berselisih pada PERISTIWA')

S(id='pertemuan-keluarga', pokok='pp-pa-damai', urut=152, tingkat='jarang', kelompok='upaya',
  teks='Siapa dari keluarga yang pernah mempertemukan #0046# dan #0047# untuk membicarakan anak bernama #8602# dan apa hasilnya?',
  hal='pertemuan keluarga membicarakan anak dan hasilnya', m='pertemuan keluarga tentang anak bernama #8602#',
  K=(['keluarga pernah mempertemukan #0046# dan #0047# untuk membicarakan anak bernama #8602# tetapi tidak tercapai kata sepakat',
      'pertemuan keluarga untuk membicarakan anak bernama #8602# pernah diadakan namun tidak tercapai kata sepakat'],
     ['pihak keluarga pernah mengumpulkan #0046# dan #0047# membicarakan anak bernama #8602# tetapi tidak tercapai kata sepakat',
      'upaya keluarga membicarakan anak bernama #8602# dengan #0046# dan #0047# tidak membuahkan kata sepakat']),
  A=['keluarga pernah mempertemukan kedua pihak dan tidak ada kesepakatan', 'keluarga pernah mengumpulkan kedua pihak namun tidak ada kesepakatan'],
  B=['keluarga belum pernah mempertemukan kedua pihak', 'keluarga belum pernah mengumpulkan kedua pihak'],
  beda_maksud='versi A: pernah dipertemukan tanpa hasil; versi B: belum pernah dipertemukan - berselisih pada PERISTIWA')

S(id='lawan-keberadaan', pokok='pp-pa-penguasa', urut=171, tingkat='pilihan', kelompok='pokok', keadaan={'kehadiran': 'verstek'},
  teks='Apakah #0047# mengetahui adanya perkara ini dan di mana saksi mengetahui ia tinggal bersama anak bernama #8602# sekarang?',
  hal='pengetahuan #0047# tentang perkara ini dan tempat tinggalnya bersama anak', m='pengetahuan #0047# tentang perkara ini',
  K=(['#0047# sudah mengetahui adanya perkara ini dan tinggal bersama anak bernama #8602# di {isi} sejauh yang saya ketahui',
      'perkara ini sudah diketahui #0047# yang sekarang tinggal bersama anak bernama #8602# di {isi} sejauh yang saya ketahui'],
     ['#0047# mengetahui perkara ini dan sekarang tinggal bersama anak bernama #8602# di {isi} sejauh yang saya ketahui',
      'sekarang #0047# berada bersama anak bernama #8602# di {isi} sejauh yang saya ketahui dan ia sudah mengetahui perkara ini']),
  A=['#0047# mengetahui adanya perkara ini', '#0047# sudah mengetahui adanya perkara ini'],
  B=['#0047# belum mengetahui adanya perkara ini', '#0047# belum tahu adanya perkara ini'],
  beda_maksud='versi A: mengetahui perkara; versi B: belum mengetahui - berselisih pada PERISTIWA')

S(id='lawan-tanggung-jawab', pokok='pp-pa-penguasa', urut=172, tingkat='tambahan', kelompok='pokok', keadaan={'kehadiran': 'verstek'},
  teks='Apakah selama anak bernama #8602# dikuasainya #0047# memberi kabar atau kesempatan kepada #0046# untuk mengetahui keadaan anak itu?',
  hal='kabar dan kesempatan bagi pengaju mengetahui keadaan anak', m='kabar tentang keadaan anak bernama #8602#',
  K=(['selama anak bernama #8602# dikuasainya #0047# jarang memberi kabar kepada #0046# tentang keadaan anak itu',
      '#0047# jarang mengabari #0046# tentang keadaan anak bernama #8602# selama anak itu dikuasainya'],
     ['kabar tentang anak bernama #8602# jarang sampai kepada #0046# karena #0047# jarang memberitahunya',
      '#0047# jarang menyampaikan keadaan anak bernama #8602# kepada #0046# selama menguasai anak itu']),
  A=['pengaju jarang mendapat kabar tentang anak', 'pengaju jarang menerima kabar tentang anak'],
  B=['pengaju rutin mendapat kabar tentang anak', 'pengaju rutin menerima kabar tentang anak'],
  beda_pada='jumlah', beda_maksud='versi A: jarang mendapat kabar; versi B: rutin mendapat kabar - berselisih pada JUMLAH KABAR')
