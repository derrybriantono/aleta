# -*- coding: utf-8 -*-
"""Isi tambahan katalog saksi HAK ASUH ANAK (hadhanah) - agen W2b-B, 21 Okt 2026.
Pokok pembuktian: Pasal 105 dan 156 KHI (mumayyiz 12 tahun, kecakapan, keselamatan jasmani dan rohani), Pasal 41 huruf a dan Pasal 45 UU 1/1974,
asas kepentingan terbaik anak. Tidak ada fakta karangan: semua jawaban berupa kerangka dari isian perkara (#nnnn#) dan slot yang diisi petugas."""
from katalog_anak import PENGASUH, PILIHAN, pokok, dasar, keadaan

BERMASALAH = [({'pihakBermasalah': 'lawan'}, {'X': '#0047#', 'Y': '#0046#'}),
              ({'pihakBermasalah': 'pengaju'}, {'X': '#0046#', 'Y': '#0047#'})]

DASAR_BARU = [
    dasar('dh-khi-77-3', 'Pasal 77 ayat (3) Kompilasi Hukum Islam', 'suami istri wajib mengasuh dan memelihara anak-anak mereka, baik mengenai pertumbuhan jasmani, rohani maupun kecerdasannya dan pendidikan agamanya', 'perlu-verifikasi',
          'pengetahuan hukum; belum dicocokkan dengan naskah resmi Kompilasi Hukum Islam (Inpres 1/1991). Hanya dasar panel dan pertimbangan, tidak tercetak di keterangan saksi.'),
    dasar('dh-khi-98', 'Pasal 98 ayat (1) Kompilasi Hukum Islam', 'batas usia anak yang mampu berdiri sendiri atau dewasa adalah 21 tahun sepanjang anak tidak bercacat fisik atau mental atau belum pernah melangsungkan perkawinan', 'perlu-verifikasi',
          'pengetahuan hukum; belum dicocokkan dengan naskah resmi Kompilasi Hukum Islam (Inpres 1/1991).'),
    dasar('dh-uupa-26', 'Pasal 26 ayat (1) UU 23/2002 sebagaimana diubah UU 35/2014 tentang Perlindungan Anak', 'orang tua berkewajiban dan bertanggung jawab mengasuh, memelihara, mendidik dan melindungi anak serta menumbuhkembangkan anak sesuai kemampuan, bakat dan minatnya', 'perlu-verifikasi',
          'pengetahuan hukum; belum dicocokkan dengan naskah resmi UU 35/2014. Hanya dasar panel dan pertimbangan, tidak tercetak di keterangan saksi.'),
    dasar('dh-ha-mumayyiz-didengar', 'Pasal 105 huruf b dan Pasal 156 huruf b Kompilasi Hukum Islam (lanjutan)', 'anak yang sudah mumayyiz berhak memilih untuk mendapatkan hadhanah dari ayah atau ibunya; pilihan itu didengar hakim langsung dan keterangan saksi hanya pelengkap', 'terverifikasi',
          'rumusan yang sama dengan butir dh-khi-105 dan dh-khi-156 yang sudah ada di katalog ini (terverifikasi pada naskah KHI).'),
]

KEADAAN_BARU = {
    'jumlahAnak': keadaan('Jumlah anak yang diperebutkan', ['satu', 'lebih'], 'satu'),
    'kedudukanPengaju': keadaan('Kedudukan pengaju terhadap anak', ['ibu', 'ayah', 'kerabat'], 'ibu'),
    'pihakBermasalah': keadaan('Pihak yang dipersoalkan kecakapan atau perilakunya', ['lawan', 'pengaju'], 'lawan'),
    'keadaanPihakLain': keadaan('Keadaan pihak yang dipersoalkan', ['tidak-ada', 'menikah-lagi', 'bekerja-jauh', 'kebiasaan-buruk', 'kekerasan-penelantaran', 'jarang-menjenguk'], 'tidak-ada'),
    'perubahan': keadaan('Ada perubahan penting sejak orang tua berpisah (pindah tempat tinggal atau sekolah anak)', ['tidak', 'ya'], 'tidak'),
}

POKOK_BARU = [
    pokok('pp-ha-identitas', 'Identitas dan akta kelahiran anak', 'jumlah anak, nama dan kelahiran anak serta akta kelahiran yang mencatat orang tuanya', ['dh-uu1-41-45', 'dh-khi-1g']),
    pokok('pp-ha-pisah', 'Perpisahan orang tua dan pengasuhan sesudahnya', 'kapan orang tua berpisah dan dengan siapa anak tinggal sesudah itu', ['dh-uu1-41-45', 'dh-khi-1g']),
    pokok('pp-ha-jasmani', 'Kesehatan dan kebutuhan jasmani anak', 'kesehatan, makan dan gizi, perawatan dan tempat tidur anak selama dalam pengasuhan', ['dh-khi-156', 'dh-uupa-terbaik', 'dh-khi-77-3']),
    pokok('pp-ha-rohani', 'Perkembangan rohani, akhlak dan agama anak', 'ibadah, pendidikan agama, akhlak dan keadaan jiwa anak selama dalam pengasuhan', ['dh-khi-156', 'dh-khi-77-3', 'dh-uupa-terbaik']),
    pokok('pp-ha-pendidikan', 'Pendidikan dan prestasi anak', 'sekolah, biaya, pendampingan belajar dan prestasi anak', ['dh-khi-156', 'dh-khi-77-3', 'dh-uupa-26']),
    pokok('pp-ha-akhlak-pengasuh', 'Akhlak dan agama pihak yang mengasuh', 'ibadah, perilaku, nama baik dan kesehatan jasmani rohani pihak yang mengasuh anak', ['dh-khi-156', 'dh-uupa-terbaik']),
    pokok('pp-ha-waktu', 'Waktu dan bantuan keluarga dalam mengasuh', 'jam kerja, pengawasan anak dan bantuan keluarga dekat', ['dh-khi-156', 'dh-uupa-terbaik']),
    pokok('pp-ha-tempat', 'Tempat tinggal anak', 'status rumah, penghuni, kamar dan keamanan lingkungan', ['dh-khi-156', 'dh-sema-2-2024-tempat', 'dh-uupa-terbaik']),
    pokok('pp-ha-ekonomi', 'Kemampuan ekonomi pihak yang mengasuh', 'sumber penghasilan dan pemenuhan kebutuhan anak', ['dh-khi-156', 'dh-khi-105']),
    pokok('pp-ha-lain', 'Keadaan pihak yang dipersoalkan', 'pernikahan baru, pekerjaan jauh, kebiasaan buruk, kekerasan atau penelantaran dan kepedulian kepada anak', ['dh-khi-156', 'dh-uupa-terbaik']),
    pokok('pp-ha-bahaya', 'Keadaan yang membahayakan jasmani atau rohani anak', 'kekerasan, penelantaran, pengaruh buruk dan keadaan lain yang mengancam keselamatan anak walaupun biaya telah dicukupi', ['dh-khi-156', 'dh-uupa-terbaik'], keadaan={'pengalihan': 'ya'}),
    pokok('pp-ha-ikatan', 'Ikatan batin anak dengan orang tuanya', 'kedekatan dan kenyamanan anak dengan masing-masing orang tua', ['dh-uupa-terbaik', 'dh-khi-156']),
    pokok('pp-ha-pilihan-lanjut', 'Alasan dan kemandirian pilihan anak mumayyiz', 'alasan, waktu dan kebebasan anak yang sudah mumayyiz dalam memilih', ['dh-ha-mumayyiz-didengar', 'dh-khi-105'], keadaan={'anakMumayyiz': 'sudah'}),
    pokok('pp-ha-akses-lanjut', 'Pelaksanaan akses bertemu anak', 'frekuensi, tempat, komunikasi dan hambatan orang tua lainnya bertemu anak', ['dh-sema-1-2017-akses', 'dh-uupa-terbaik']),
    pokok('pp-ha-saudara', 'Keutuhan saudara kandung', 'hubungan antar anak dan keberatan memisahkan anak dari saudaranya', ['dh-uupa-terbaik'], keadaan={'jumlahAnak': 'lebih'}),
    pokok('pp-ha-kerabat', 'Kerabat yang mengajukan hadhanah', 'hubungan kerabat dengan anak dan kesanggupannya mengasuh', ['dh-khi-156', 'dh-uupa-terbaik'], keadaan={'kedudukanPengaju': 'kerabat'}),
    pokok('pp-ha-perubahan', 'Perubahan keadaan sesudah orang tua berpisah', 'pindah tempat tinggal atau sekolah anak dan akibatnya', ['dh-uupa-terbaik'], keadaan={'perubahan': 'ya'}),
    pokok('pp-ha-damai', 'Kesepakatan keluarga tentang pengasuhan', 'kesepakatan yang pernah ada dan pelaksanaannya', ['dh-uu1-41-45']),
]

SPEC = []


def S(**kw):
    kw.setdefault('prefix', 'q-ha-')
    kw.setdefault('beda_pada', 'peristiwa')
    SPEC.append(kw)


# ---- identitas ------------------------------------------------------------------------------------------------------
S(id='jumlah-anak', pokok='pp-ha-identitas', urut=31, tingkat='pilihan', kelompok='pokok',
  teks='Berapa jumlah anak #0046# dan #0047# dan siapa saja nama anak yang dipersoalkan di sini?',
  varian=['Dari perkawinan #0046# dan #0047# ada berapa anak dan yang dipersoalkan hak asuhnya bernama siapa?'],
  hal='jumlah anak dan nama anak yang dipersoalkan', m='jumlah dan nama anak #0046# dan #0047#',
  K=(['dari perkawinan #0046# dan #0047# lahir anak yang dipersoalkan hak asuhnya bernama #8602# dan semuanya anak kandung keduanya',
      'anak yang menjadi pokok perkara ini bernama #8602# dan ia anak kandung #0046# dan #0047#'],
     ['yang dipersoalkan hak asuhnya adalah anak bernama #8602# yang lahir dari perkawinan #0046# dan #0047#',
      'anak kandung #0046# dan #0047# yang diperebutkan pengasuhannya bernama #8602#']),
  A=['anak #0046# dan #0047# yang dipersoalkan bernama #8602#', 'yang menjadi pokok perkara adalah anak bernama #8602#'],
  B=['anak #0046# dan #0047# ada lebih banyak daripada yang disebut dalam gugatan', 'jumlah anak #0046# dan #0047# lebih banyak daripada yang disebut dalam gugatan'],
  beda_pada='jumlah', beda_maksud='versi A: hanya anak yang disebut dalam gugatan; versi B: ada anak lain yang tidak disebut - berselisih pada JUMLAH ANAK')

S(id='akta-lahir', pokok='pp-ha-identitas', urut=33, tingkat='pilihan', kelompok='pokok',
  teks='Apakah anak bernama #8602# sudah mempunyai akta kelahiran dan siapa orang tua yang tercatat di dalamnya?',
  varian=['Apakah kelahiran anak bernama #8602# sudah dicatat dalam akta kelahiran dan siapa nama orang tuanya di akta itu?'],
  hal='akta kelahiran anak dan nama orang tua yang tercatat', m='akta kelahiran anak bernama #8602#',
  K=(['anak bernama #8602# sudah memiliki akta kelahiran yang mencatat #0046# dan #0047# sebagai orang tuanya',
      'kelahiran anak bernama #8602# sudah tercatat dalam akta kelahiran atas nama orang tuanya #0046# dan #0047#'],
     ['akta kelahiran anak bernama #8602# sudah ada dan tercatat orang tuanya adalah #0046# dan #0047#',
      'anak bernama #8602# memegang akta kelahiran dengan nama #0046# dan #0047# sebagai ayah dan ibunya']),
  A=['anak bernama #8602# sudah memiliki akta kelahiran', 'akta kelahiran anak bernama #8602# sudah ada'],
  B=['anak bernama #8602# belum memiliki akta kelahiran', 'akta kelahiran anak bernama #8602# belum dibuat'],
  beda_maksud='versi A: akta kelahiran sudah ada; versi B: belum ada - berselisih pada PERISTIWA')

# ---- perpisahan -----------------------------------------------------------------------------------------------------
S(id='pisah-kapan', pokok='pp-ha-pisah', urut=35, tingkat='inti', kelompok='pokok',
  teks='Sejak kapan #0046# dan #0047# berpisah tempat tinggal dan dengan siapa anak bernama #8602# tinggal sesudah itu?',
  varian=['Kapan #0046# dan #0047# mulai tidak serumah lagi dan anak bernama #8602# ikut siapa?'],
  hal='waktu orang tua berpisah dan pengasuhan anak sesudahnya', m='waktu #0046# dan #0047# berpisah dan pengasuhan anak sesudahnya', v=PENGASUH,
  K=(['#0046# dan #0047# berpisah tempat tinggal sejak {sejak} dan sesudah itu anak bernama #8602# tinggal bersama @X@',
      'sejak {sejak} #0046# dan #0047# hidup terpisah rumah dan anak bernama #8602# ikut bersama @X@'],
     ['perpisahan tempat tinggal #0046# dan #0047# terjadi sejak {sejak} dan anak bernama #8602# diasuh @X@ sesudah itu',
      'mulai {sejak} #0046# dan #0047# hidup terpisah dan anak bernama #8602# berada dalam asuhan @X@']),
  A=['#0046# dan #0047# sudah berpisah tempat tinggal cukup lama', 'sudah lama #0046# dan #0047# hidup terpisah rumah'],
  B=['#0046# dan #0047# baru berpisah tempat tinggal beberapa waktu terakhir', 'baru beberapa waktu terakhir #0046# dan #0047# hidup terpisah rumah'],
  beda_pada='lama', beda_maksud='versi A: sudah berpisah lama; versi B: baru berpisah - berselisih pada LAMA')

S(id='anak-ikut', pokok='pp-ha-pisah', urut=36, tingkat='pilihan', kelompok='pokok',
  teks='Ketika orang tua anak berpisah bagaimana anak bernama #8602# sampai ikut bersama salah satu orang tuanya?',
  varian=['Bagaimana awalnya anak bernama #8602# ikut tinggal bersama salah satu orang tuanya setelah mereka berpisah?'],
  hal='cara anak ikut bersama salah satu orang tuanya', m='cara anak bernama #8602# ikut bersama @X@', v=PENGASUH,
  K=(['ketika berpisah anak bernama #8602# ikut bersama @X@ dengan sendirinya dan tidak ada yang keberatan saat itu',
      'anak bernama #8602# ikut bersama @X@ sejak awal perpisahan dan tidak ada yang mempersoalkannya pada waktu itu'],
     ['sejak perpisahan itu anak bernama #8602# dibawa tinggal oleh @X@ dan tidak ada keberatan dari siapa pun pada waktu itu',
      'anak bernama #8602# tinggal bersama @X@ sejak orang tuanya berpisah dan tidak ada pihak yang menolaknya waktu itu']),
  A=['anak bernama #8602# ikut bersama @X@ atas persetujuan kedua orang tuanya', 'anak bernama #8602# tinggal bersama @X@ dengan sepengetahuan dan persetujuan orang tuanya'],
  B=['anak bernama #8602# dibawa pergi oleh @X@ tanpa persetujuan orang tua lainnya', 'anak bernama #8602# diambil oleh @X@ tanpa sepengetahuan orang tua lainnya'],
  beda_maksud='versi A: anak ikut dengan persetujuan; versi B: dibawa tanpa persetujuan - berselisih pada PERISTIWA')

# ---- jasmani --------------------------------------------------------------------------------------------------------
S(id='kesehatan-anak', pokok='pp-ha-jasmani', urut=41, tingkat='pilihan', kelompok='pokok',
  teks='Bagaimana kesehatan anak bernama #8602# selama ini dan siapa yang membawanya berobat bila sakit?',
  varian=['Apakah anak bernama #8602# sehat dan siapa yang mengurus pengobatannya bila ia sakit?'],
  hal='kesehatan anak dan pengurusan pengobatannya', m='kesehatan anak bernama #8602#', v=PENGASUH,
  K=(['anak bernama #8602# dalam keadaan sehat dan @X@ yang membawanya berobat bila ia sakit',
      'kesehatan anak bernama #8602# terjaga dan @X@ sendiri yang mengurus pengobatannya bila ia sakit'],
     ['selama bersama @X@ anak bernama #8602# sehat dan bila ia sakit @X@ yang membawanya berobat',
      'bila anak bernama #8602# sakit @X@ segera membawanya berobat sehingga kesehatannya terjaga']),
  A=['anak bernama #8602# sehat dan terawat selama diasuh', 'kesehatan anak bernama #8602# terjaga selama diasuh'],
  B=['anak bernama #8602# sering sakit dan kurang terawat selama diasuh', 'kesehatan anak bernama #8602# kurang terjaga selama diasuh'],
  beda_maksud='versi A: anak sehat dan terawat; versi B: sering sakit dan kurang terawat - berselisih pada PERISTIWA')

S(id='makan-gizi', pokok='pp-ha-jasmani', urut=42, tingkat='pilihan', kelompok='pokok',
  teks='Apakah kebutuhan makan dan gizi anak bernama #8602# terpenuhi setiap hari dan siapa yang menyiapkannya?',
  hal='pemenuhan makan dan gizi anak', m='pemenuhan makan dan gizi anak bernama #8602#', v=PENGASUH,
  K=(['makan dan gizi anak bernama #8602# terpenuhi setiap hari dan @X@ yang menyiapkannya',
      'anak bernama #8602# makan teratur setiap hari dari masakan yang disiapkan @X@'],
     ['@X@ menyiapkan makanan anak bernama #8602# setiap hari sehingga gizinya terpenuhi',
      'kebutuhan makan anak bernama #8602# dipenuhi @X@ dengan teratur setiap hari']),
  A=['anak bernama #8602# makan teratur dan gizinya terpenuhi', 'makan anak bernama #8602# teratur dan gizinya cukup'],
  B=['anak bernama #8602# sering makan tidak teratur dan gizinya kurang', 'makan anak bernama #8602# tidak teratur dan gizinya kurang'],
  beda_pada='peristiwa', beda_maksud='versi A: makan teratur dan gizi cukup; versi B: makan tidak teratur dan gizi kurang - berselisih pada PERISTIWA')

S(id='perawatan-harian', pokok='pp-ha-jasmani', urut=43, tingkat='tambahan', kelompok='pokok',
  teks='Siapa yang memandikan, menyiapkan pakaian dan mengurus kebersihan anak bernama #8602# sehari-hari?',
  hal='perawatan harian dan kebersihan anak', m='perawatan harian anak bernama #8602#', v=PENGASUH,
  K=(['@X@ yang mengurus mandi pakaian dan kebersihan anak bernama #8602# sehari-hari',
      'kebersihan dan pakaian anak bernama #8602# diurus @X@ setiap hari'],
     ['setiap hari @X@ mengurus pakaian dan kebersihan anak bernama #8602# sendiri',
      'anak bernama #8602# selalu bersih dan berpakaian rapi karena diurus @X@']),
  A=['anak bernama #8602# selalu bersih dan rapi', 'pakaian dan kebersihan anak bernama #8602# terjaga'],
  B=['anak bernama #8602# sering kotor dan kurang rapi', 'pakaian dan kebersihan anak bernama #8602# kurang terjaga'],
  beda_maksud='versi A: anak bersih dan rapi; versi B: sering kotor dan kurang rapi - berselisih pada PERISTIWA')

# ---- rohani ---------------------------------------------------------------------------------------------------------
S(id='ibadah-anak', pokok='pp-ha-rohani', urut=51, tingkat='pilihan', kelompok='pokok',
  teks='Bagaimana anak bernama #8602# menjalankan ibadah dan siapa yang membimbingnya?',
  varian=['Siapa yang membimbing anak bernama #8602# dalam beribadah dan apakah ia menjalankannya sesuai usianya?'],
  hal='ibadah anak dan pembimbingnya', m='ibadah anak bernama #8602#', v=PENGASUH,
  K=(['anak bernama #8602# dibimbing @X@ menjalankan ibadah sesuai usianya',
      '@X@ membimbing anak bernama #8602# beribadah dan anak itu menjalankannya sesuai kemampuannya'],
     ['ibadah anak bernama #8602# dibimbing langsung oleh @X@ sesuai usianya',
      'anak bernama #8602# beribadah di bawah bimbingan @X@ sesuai usianya']),
  A=['anak bernama #8602# rajin beribadah di bawah bimbingan orang tua yang mengasuhnya', 'anak bernama #8602# beribadah dengan teratur dibimbing orang tua yang mengasuhnya'],
  B=['anak bernama #8602# jarang beribadah dan kurang dibimbing orang tua yang mengasuhnya', 'ibadah anak bernama #8602# jarang dilakukan dan kurang dibimbing orang tua yang mengasuhnya'],
  beda_maksud='versi A: anak rajin beribadah dibimbing; versi B: jarang beribadah dan kurang dibimbing - berselisih pada PERISTIWA')

S(id='mengaji', pokok='pp-ha-rohani', urut=52, tingkat='tambahan', kelompok='pokok',
  teks='Apakah anak bernama #8602# belajar mengaji atau pendidikan agama dan siapa yang mengantar dan mengawasinya?',
  hal='belajar mengaji dan pendidikan agama anak', m='belajar mengaji anak bernama #8602#', v=PENGASUH,
  K=(['anak bernama #8602# belajar mengaji dan @X@ yang mengantar serta mengawasinya',
      'pendidikan agama anak bernama #8602# diperhatikan @X@ yang mengantarnya belajar mengaji'],
     ['@X@ mengantar anak bernama #8602# belajar mengaji dan mengawasi belajarnya',
      'anak bernama #8602# mengaji secara teratur dengan pengawasan @X@']),
  A=['anak bernama #8602# belajar mengaji secara teratur', 'anak bernama #8602# mengaji dengan teratur'],
  B=['anak bernama #8602# tidak belajar mengaji sama sekali', 'anak bernama #8602# tidak pernah mengaji'],
  beda_maksud='versi A: anak mengaji teratur; versi B: tidak mengaji - berselisih pada PERISTIWA')

S(id='akhlak-anak', pokok='pp-ha-rohani', urut=53, tingkat='pilihan', kelompok='pokok',
  teks='Bagaimana akhlak dan pergaulan anak bernama #8602# sehari-hari?',
  varian=['Bagaimana perilaku dan teman bergaul anak bernama #8602# selama ini?'],
  hal='akhlak dan pergaulan anak sehari-hari', m='akhlak dan pergaulan anak bernama #8602#', v=PENGASUH,
  K=(['akhlak anak bernama #8602# baik dan pergaulannya wajar di bawah pengawasan @X@',
      'anak bernama #8602# bersikap sopan dan bergaul wajar dengan teman sebayanya karena diawasi @X@'],
     ['perilaku anak bernama #8602# baik dan pergaulannya terjaga oleh pengawasan @X@',
      'selama diasuh @X@ anak bernama #8602# berakhlak baik dan bergaul secara wajar']),
  A=['anak bernama #8602# berakhlak baik dan bergaul wajar', 'akhlak anak bernama #8602# baik dan pergaulannya wajar'],
  B=['anak bernama #8602# mulai berperilaku buruk dan bergaul bebas', 'perilaku anak bernama #8602# mulai buruk dan pergaulannya bebas'],
  beda_maksud='versi A: akhlak baik dan pergaulan wajar; versi B: perilaku mulai buruk dan bergaul bebas - berselisih pada PERISTIWA')

S(id='jiwa-anak', pokok='pp-ha-rohani', urut=54, tingkat='tambahan', kelompok='akibat',
  teks='Bagaimana perasaan dan keadaan jiwa anak bernama #8602# selama diasuh sekarang apakah ia tampak tenang dan ceria?',
  hal='keadaan jiwa dan perasaan anak selama diasuh', m='keadaan jiwa anak bernama #8602#', v=PENGASUH,
  K=(['anak bernama #8602# tampak tenang dan ceria selama bersama @X@',
      'selama diasuh @X@ anak bernama #8602# terlihat riang dan merasa aman'],
     ['bersama @X@ anak bernama #8602# kelihatan gembira dan tenang',
      'anak bernama #8602# merasa nyaman dan ceria dalam asuhan @X@']),
  A=['anak bernama #8602# tampak tenang dan ceria', 'anak bernama #8602# terlihat riang dan tenang'],
  B=['anak bernama #8602# tampak murung dan gelisah', 'anak bernama #8602# terlihat sedih dan gelisah'],
  beda_maksud='versi A: anak tenang dan ceria; versi B: murung dan gelisah - berselisih pada PERISTIWA')

# ---- pendidikan -----------------------------------------------------------------------------------------------------
S(id='sekolah-mana', pokok='pp-ha-pendidikan', urut=61, tingkat='pilihan', kelompok='pokok',
  teks='Di sekolah mana anak bernama #8602# belajar sekarang dan kelas berapa?',
  hal='sekolah dan kelas anak', m='sekolah dan kelas anak bernama #8602#',
  K=(['anak bernama #8602# sekarang belajar di {isi} dan ia terdaftar sebagai murid di sana',
      'sekolah anak bernama #8602# sekarang adalah {isi} tempat ia terdaftar sebagai murid'],
     ['anak bernama #8602# bersekolah di {isi} dan tercatat sebagai muridnya',
      'tempat anak bernama #8602# belajar sekarang adalah {isi} dan ia terdaftar di sana']),
  A=['anak bernama #8602# bersekolah di {isi} dan tercatat sebagai muridnya', 'anak bernama #8602# belajar di {isi} dan terdaftar sebagai muridnya'],
  B=['anak bernama #8602# belum bersekolah di {isi} dan belum tercatat sebagai murid', 'anak bernama #8602# belum belajar di {isi} dan belum terdaftar sebagai murid'],
  beda_maksud='versi A: anak bersekolah; versi B: belum bersekolah - berselisih pada PERISTIWA')

S(id='pendampingan-belajar', pokok='pp-ha-pendidikan', urut=62, tingkat='tambahan', kelompok='pokok',
  teks='Siapa yang menemani anak bernama #8602# belajar di rumah dan mengantar jemputnya ke sekolah?',
  hal='pendampingan belajar dan antar jemput anak', m='pendampingan belajar anak bernama #8602#', v=PENGASUH,
  K=(['@X@ menemani anak bernama #8602# belajar di rumah dan mengantar jemputnya ke sekolah',
      'antar jemput sekolah dan pendampingan belajar anak bernama #8602# dilakukan @X@'],
     ['anak bernama #8602# didampingi @X@ ketika belajar dan diantar jemput ke sekolah',
      '@X@ sendiri yang mengantar anak bernama #8602# ke sekolah dan menemaninya belajar']),
  A=['anak bernama #8602# didampingi orang tua yang mengasuhnya saat belajar', 'orang tua yang mengasuh menemani anak bernama #8602# belajar'],
  B=['anak bernama #8602# dibiarkan belajar sendiri', 'anak bernama #8602# belajar sendirian saja'],
  beda_maksud='versi A: anak didampingi saat belajar; versi B: dibiarkan sendiri - berselisih pada PERISTIWA')

S(id='prestasi-sekolah', pokok='pp-ha-pendidikan', urut=63, tingkat='tambahan', kelompok='akibat',
  teks='Bagaimana kehadiran dan prestasi anak bernama #8602# di sekolah selama diasuh sekarang?',
  hal='kehadiran dan prestasi anak di sekolah', m='kehadiran dan prestasi sekolah anak bernama #8602#', v=PENGASUH,
  K=(['anak bernama #8602# rajin masuk sekolah dan prestasinya baik selama diasuh @X@',
      'selama bersama @X@ anak bernama #8602# selalu masuk sekolah dan nilainya baik'],
     ['kehadiran anak bernama #8602# di sekolah teratur dan prestasinya baik di bawah asuhan @X@',
      'anak bernama #8602# rajin berangkat sekolah dan nilainya baik karena diperhatikan @X@']),
  A=['anak bernama #8602# rajin masuk sekolah dan berprestasi baik', 'prestasi anak bernama #8602# di sekolah baik dan kehadirannya teratur'],
  B=['anak bernama #8602# sering bolos dan prestasinya menurun', 'kehadiran anak bernama #8602# di sekolah sering terputus dan nilainya menurun'],
  beda_maksud='versi A: rajin dan berprestasi; versi B: sering bolos dan menurun - berselisih pada PERISTIWA')

# ---- akhlak dan agama pihak yang mengasuh --------------------------------------------------------------------------
S(id='ibadah-pengasuh', pokok='pp-ha-akhlak-pengasuh', urut=71, tingkat='inti', kelompok='pokok',
  teks='Bagaimana ketaatan orang tua yang mengasuh anak dalam menjalankan ibadah dan apakah ia menjadi teladan bagi anak?',
  hal='ketaatan beribadah orang tua yang mengasuh anak', m='ketaatan beribadah @X@', v=PENGASUH,
  K=(['@X@ taat menjalankan ibadah dan menjadi teladan bagi anak bernama #8602#',
      '@X@ rajin beribadah sehingga anak bernama #8602# mencontoh kebiasaan baiknya'],
     ['ibadah @X@ terjaga dan menjadi contoh yang baik bagi anak bernama #8602#',
      'anak bernama #8602# melihat @X@ menjalankan ibadah dengan taat setiap hari']),
  A=['orang tua yang mengasuh anak taat beribadah', 'ibadah orang tua yang mengasuh anak terjaga'],
  B=['orang tua yang mengasuh anak jarang beribadah', 'ibadah orang tua yang mengasuh anak sering ditinggalkan'],
  beda_maksud='versi A: taat beribadah; versi B: jarang beribadah - berselisih pada PERISTIWA')

S(id='kebiasaan-buruk-tidak', pokok='pp-ha-akhlak-pengasuh', urut=72, tingkat='pilihan', kelompok='pokok',
  teks='Apakah orang tua yang mengasuh anak memiliki kebiasaan buruk seperti minuman keras, judi atau narkoba?',
  varian=['Apakah saksi pernah melihat orang tua yang mengasuh anak minum minuman keras, berjudi atau memakai narkoba?'],
  hal='kebiasaan buruk orang tua yang mengasuh anak', m='kebiasaan buruk @X@', v=PENGASUH,
  K=(['@X@ tidak memiliki kebiasaan buruk berupa minuman keras judi atau narkoba',
      '@X@ tidak pernah saya lihat minum minuman keras berjudi atau memakai narkoba'],
     ['tidak ada kebiasaan buruk pada @X@ berupa minuman keras judi maupun narkoba',
      'selama saya kenal @X@ tidak pernah terlibat minuman keras judi atau narkoba']),
  A=['orang tua yang mengasuh anak tidak memiliki kebiasaan buruk', 'orang tua yang mengasuh anak tidak pernah terlibat kebiasaan buruk'],
  B=['orang tua yang mengasuh anak memiliki kebiasaan minum minuman keras', 'orang tua yang mengasuh anak sering terlihat minum minuman keras'],
  beda_maksud='versi A: tidak ada kebiasaan buruk; versi B: ada kebiasaan buruk - berselisih pada PERISTIWA')

S(id='nama-baik-pengasuh', pokok='pp-ha-akhlak-pengasuh', urut=73, tingkat='tambahan', kelompok='pokok',
  teks='Bagaimana nama baik dan pergaulan orang tua yang mengasuh anak di lingkungan tempat tinggalnya?',
  hal='nama baik dan pergaulan orang tua yang mengasuh anak', m='nama baik dan pergaulan @X@', v=PENGASUH,
  K=(['@X@ dikenal baik di lingkungan tempat tinggalnya dan tidak pernah terlibat masalah dengan tetangga',
      'tetangga mengenal @X@ sebagai orang yang baik dan tidak pernah bermasalah dengan siapa pun'],
     ['nama baik @X@ terjaga di lingkungannya dan tidak ada masalah dengan tetangga',
      '@X@ bergaul baik dengan warga sekitar dan tidak pernah membuat keributan']),
  A=['orang tua yang mengasuh anak dikenal baik di lingkungannya', 'nama baik orang tua yang mengasuh anak terjaga di lingkungannya'],
  B=['orang tua yang mengasuh anak sering bermasalah di lingkungannya', 'orang tua yang mengasuh anak kurang disukai warga di lingkungannya'],
  beda_maksud='versi A: dikenal baik; versi B: sering bermasalah - berselisih pada PERISTIWA')

S(id='kesehatan-pengasuh', pokok='pp-ha-akhlak-pengasuh', urut=74, tingkat='pilihan', kelompok='pokok',
  teks='Apakah orang tua yang mengasuh anak sehat jasmani dan rohani sehingga mampu mengurus anak sehari-hari?',
  hal='kesehatan jasmani dan rohani orang tua yang mengasuh anak', m='kesehatan jasmani dan rohani @X@', v=PENGASUH,
  K=(['@X@ sehat jasmani dan rohani sehingga mampu mengurus anak bernama #8602# sehari-hari',
      'keadaan @X@ sehat lahir dan batin dan ia mampu mengurus anak bernama #8602# setiap hari'],
     ['@X@ dalam keadaan sehat dan mampu mengurus keperluan anak bernama #8602# sehari-hari',
      'kesehatan @X@ baik secara jasmani dan rohani sehingga mengurus anak bernama #8602# berjalan lancar']),
  A=['orang tua yang mengasuh anak sehat jasmani dan rohani', 'kesehatan jasmani dan rohani orang tua yang mengasuh anak baik'],
  B=['orang tua yang mengasuh anak sering sakit dan kesulitan mengurus anak', 'orang tua yang mengasuh anak sering sakit sehingga kesulitan mengurus anak'],
  beda_maksud='versi A: sehat; versi B: sering sakit - berselisih pada PERISTIWA')

# ---- waktu dan bantuan ---------------------------------------------------------------------------------------------
S(id='jam-kerja', pokok='pp-ha-waktu', urut=81, tingkat='pilihan', kelompok='pokok',
  teks='Pada jam berapa orang tua yang mengasuh anak bekerja dan siapa yang menjaga anak selama ia bekerja?',
  hal='jam kerja orang tua yang mengasuh anak dan penjagaan anak', m='jam kerja @X@ dan penjagaan anak bernama #8602#', v=PENGASUH,
  K=(['@X@ bekerja pada jam tertentu dan selama itu anak bernama #8602# dijaga keluarga dekat',
      'ketika @X@ bekerja anak bernama #8602# berada dalam penjagaan keluarga dekatnya'],
     ['jam kerja @X@ terbatas dan anak bernama #8602# dijaga keluarga dekat selama ia bekerja',
      'selama @X@ bekerja anak bernama #8602# dititipkan kepada keluarga dekat yang dipercaya']),
  A=['orang tua yang mengasuh anak punya waktu cukup untuk anak', 'orang tua yang mengasuh anak memiliki waktu yang cukup bagi anak'],
  B=['orang tua yang mengasuh anak sibuk bekerja dan jarang di rumah', 'orang tua yang mengasuh anak sibuk bekerja dan jarang berada di rumah'],
  beda_pada='waktu', beda_maksud='versi A: waktu cukup untuk anak; versi B: sibuk dan jarang di rumah - berselisih pada WAKTU')

S(id='dibantu-keluarga', pokok='pp-ha-waktu', urut=82, tingkat='tambahan', kelompok='pokok',
  teks='Siapa dari keluarga yang ikut membantu mengasuh anak bernama #8602# dan bagaimana hubungan mereka dengan anak?',
  hal='bantuan keluarga dalam mengasuh anak', m='bantuan keluarga mengasuh anak bernama #8602#', v=PENGASUH,
  K=(['@X@ dibantu keluarga dekatnya mengasuh anak bernama #8602# dan anak itu dekat dengan mereka',
      'keluarga dekat @X@ ikut membantu mengasuh anak bernama #8602# dan anak itu akrab dengan mereka'],
     ['dalam mengasuh anak bernama #8602# @X@ mendapat bantuan keluarga dekat yang akrab dengan anak itu',
      'anak bernama #8602# diasuh @X@ bersama keluarga dekat yang menyayangi anak itu dengan tulus']),
  A=['orang tua yang mengasuh anak dibantu keluarga dekat yang akrab dengan anak', 'keluarga dekat ikut membantu orang tua yang mengasuh dan akrab dengan anak'],
  B=['orang tua yang mengasuh anak mengurus anak sendirian tanpa bantuan', 'orang tua yang mengasuh anak sendirian tanpa bantuan keluarga'],
  beda_maksud='versi A: dibantu keluarga; versi B: sendirian tanpa bantuan - berselisih pada PERISTIWA')

S(id='tidak-ditinggal', pokok='pp-ha-waktu', urut=83, tingkat='tambahan', kelompok='pokok',
  teks='Apakah anak bernama #8602# pernah ditinggal sendirian atau sering dititipkan kepada orang yang tidak dikenal anak?',
  hal='anak ditinggal sendirian atau dititipkan kepada orang lain', m='anak bernama #8602# ditinggal atau dititipkan', v=PENGASUH,
  K=(['anak bernama #8602# tidak pernah ditinggal sendirian oleh @X@ dan hanya dititipkan kepada keluarga sendiri',
      '@X@ tidak pernah membiarkan anak bernama #8602# sendirian dan hanya menitipkannya pada keluarga yang dipercaya'],
     ['anak bernama #8602# tidak pernah dibiarkan sendirian oleh @X@ dan hanya dititipkan kepada kerabat',
      'bila @X@ pergi anak bernama #8602# tidak ditinggal sendiri melainkan dititipkan kepada keluarga yang dikenal']),
  A=['anak bernama #8602# tidak pernah ditinggal sendirian', 'anak bernama #8602# tidak pernah dibiarkan sendirian'],
  B=['anak bernama #8602# sering ditinggal sendirian', 'anak bernama #8602# sering dibiarkan sendirian'],
  beda_pada='jumlah', beda_maksud='versi A: tidak pernah ditinggal sendirian; versi B: sering ditinggal sendirian - berselisih pada JUMLAH KEJADIAN')

# ---- tempat tinggal -------------------------------------------------------------------------------------------------
S(id='rumah-status', pokok='pp-ha-tempat', urut=91, tingkat='pilihan', kelompok='pokok',
  teks='Anak bernama #8602# tinggal di rumah milik siapa dan apakah rumah itu layak huni?',
  varian=['Rumah tempat anak bernama #8602# tinggal sekarang milik siapa dan bagaimana kelayakannya?'],
  hal='status dan kelayakan rumah tempat anak tinggal', m='rumah tempat tinggal anak bernama #8602#', v=PENGASUH,
  K=(['anak bernama #8602# tinggal di rumah yang ditempati @X@ dan rumah itu layak huni',
      'rumah tempat @X@ dan anak bernama #8602# tinggal layak huni dan memiliki ruang yang cukup'],
     ['@X@ dan anak bernama #8602# menempati rumah yang layak huni',
      'anak bernama #8602# tinggal di rumah yang layak huni bersama @X@']),
  A=['rumah tempat anak tinggal layak huni dan cukup luas', 'rumah tempat anak tinggal cukup luas dan layak ditempati'],
  B=['rumah tempat anak tinggal sempit dan kurang layak', 'rumah tempat anak tinggal sempit dan kurang layak huni'],
  beda_pada='tempat', beda_maksud='versi A: rumah layak huni; versi B: sempit dan kurang layak - berselisih pada TEMPAT')

S(id='kamar-aman', pokok='pp-ha-tempat', urut=92, tingkat='tambahan', kelompok='pokok',
  teks='Apakah anak bernama #8602# memiliki tempat tidur dan tempat belajar sendiri dan apakah lingkungannya aman?',
  hal='tempat tidur tempat belajar dan keamanan lingkungan anak', m='tempat tidur dan lingkungan anak bernama #8602#', v=PENGASUH,
  K=(['anak bernama #8602# memiliki tempat tidur dan tempat belajar sendiri di rumah @X@ dan lingkungannya aman',
      'di rumah @X@ anak bernama #8602# punya tempat tidur dan tempat belajar sendiri dalam lingkungan yang aman'],
     ['@X@ menyediakan tempat tidur dan tempat belajar bagi anak bernama #8602# di lingkungan yang aman',
      'lingkungan rumah @X@ aman dan anak bernama #8602# punya tempat tidur dan tempat belajar sendiri']),
  A=['lingkungan tempat anak tinggal aman dan tenang', 'lingkungan tempat anak tinggal tenang dan aman'],
  B=['lingkungan tempat anak tinggal rawan dan bising', 'lingkungan tempat anak tinggal bising dan rawan'],
  beda_pada='tempat', beda_maksud='versi A: lingkungan aman dan tenang; versi B: rawan dan bising - berselisih pada TEMPAT')

S(id='penghuni-rumah', pokok='pp-ha-tempat', urut=93, tingkat='tambahan', kelompok='pokok',
  teks='Siapa saja yang tinggal serumah dengan anak bernama #8602# sekarang?',
  hal='orang yang tinggal serumah dengan anak', m='penghuni rumah tempat anak bernama #8602# tinggal', v=PENGASUH,
  K=(['serumah dengan anak bernama #8602# tinggal @X@ dan keluarga dekatnya yang baik kepada anak itu',
      'penghuni rumah tempat anak bernama #8602# tinggal adalah @X@ dan keluarga dekatnya yang baik kepada anak itu'],
     ['di rumah itu anak bernama #8602# tinggal bersama @X@ dan keluarga dekatnya yang baik kepada anak itu',
      'anak bernama #8602# serumah dengan @X@ dan keluarga dekatnya yang baik kepada anak itu']),
  A=['anak tinggal serumah dengan keluarga dekat yang baik kepadanya', 'anak serumah dengan keluarga dekat yang memperlakukannya dengan baik'],
  B=['anak tinggal serumah dengan orang yang asing baginya', 'anak serumah dengan orang yang kurang akrab dengannya'],
  beda_pada='pelaku', beda_maksud='versi A: serumah dengan keluarga dekat; versi B: serumah dengan orang yang kurang akrab - berselisih pada PELAKU')

# ---- ekonomi --------------------------------------------------------------------------------------------------------
S(id='sumber-nafkah-pengasuh', pokok='pp-ha-ekonomi', urut=101, tingkat='pilihan', kelompok='pokok',
  teks='Dari mana orang tua yang mengasuh anak memenuhi kebutuhan anak bernama #8602# selama ini?',
  hal='sumber pemenuhan kebutuhan anak oleh orang tua yang mengasuh', m='sumber pemenuhan kebutuhan anak bernama #8602#', v=PENGASUH,
  K=(['@X@ memenuhi kebutuhan anak bernama #8602# dari penghasilan pekerjaannya sendiri dan bantuan keluarga',
      'kebutuhan anak bernama #8602# dipenuhi @X@ dari hasil kerjanya dan dibantu keluarga dekat'],
     ['biaya hidup anak bernama #8602# ditutup @X@ dari penghasilannya dan bantuan keluarga',
      '@X@ mencukupi keperluan anak bernama #8602# dengan hasil kerjanya serta bantuan keluarga']),
  A=['kebutuhan anak tercukupi dari penghasilan orang tua yang mengasuh', 'kebutuhan anak terpenuhi dari penghasilan orang tua yang mengasuh'],
  B=['kebutuhan anak sering kekurangan karena penghasilan orang tua yang mengasuh kecil', 'kebutuhan anak sering kurang karena penghasilan orang tua yang mengasuh kecil'],
  beda_pada='jumlah', beda_maksud='versi A: kebutuhan anak tercukupi; versi B: kekurangan - berselisih pada JUMLAH PENGHASILAN')

S(id='pemenuhan-selama-asuh', pokok='pp-ha-ekonomi', urut=102, tingkat='tambahan', kelompok='akibat',
  teks='Selama anak bernama #8602# diasuh sekarang apakah orang tua lainnya ikut memberi biaya hidup anak?',
  hal='pemberian biaya hidup anak oleh orang tua lainnya selama anak diasuh', m='pemberian biaya hidup oleh @Y@', v=PENGASUH,
  K=(['@Y@ ikut memberi biaya hidup untuk anak bernama #8602# walaupun tidak selalu teratur',
      'selama anak bernama #8602# diasuh @X@ maka @Y@ ikut memberikan biaya hidup anak meskipun tidak selalu teratur'],
     ['@Y@ turut memberi uang untuk keperluan anak bernama #8602# walau tidak selalu teratur',
      'biaya hidup anak bernama #8602# ikut diberikan @Y@ walaupun tidak selalu teratur']),
  A=['orang tua lainnya memberi biaya hidup anak secara teratur', 'orang tua lainnya memberi uang keperluan anak dengan teratur'],
  B=['orang tua lainnya tidak memberi biaya hidup anak sama sekali', 'orang tua lainnya sama sekali tidak memberi uang keperluan anak'],
  beda_pada='jumlah', beda_maksud='versi A: memberi biaya teratur; versi B: tidak memberi biaya - berselisih pada JUMLAH PEMBERIAN')

# ---- keadaan pihak yang dipersoalkan --------------------------------------------------------------------------------
S(id='menikah-lagi', pokok='pp-ha-lain', urut=111, tingkat='pilihan', kelompok='pokok', keadaan={'keadaanPihakLain': 'menikah-lagi'},
  teks='Apakah orang tua yang dipersoalkan sudah menikah lagi dan bagaimana hubungan anak dengan pasangan barunya?',
  hal='pernikahan baru orang tua yang dipersoalkan dan hubungan anak dengan pasangan barunya', m='pernikahan baru @X@', v=BERMASALAH,
  K=(['@X@ sudah menikah lagi dan anak bernama #8602# belum akrab dengan pasangan barunya',
      'pasangan baru @X@ belum akrab dengan anak bernama #8602# sejak @X@ menikah lagi'],
     ['setelah menikah lagi @X@ tinggal bersama pasangan barunya yang belum akrab dengan anak bernama #8602#',
      '@X@ telah menikah lagi dan anak bernama #8602# masih canggung dan belum akrab dengan pasangan barunya']),
  A=['orang tua yang dipersoalkan sudah menikah lagi dan anak canggung kepada pasangan barunya', 'orang tua yang dipersoalkan telah menikah lagi dan anak canggung kepada pasangan barunya'],
  B=['orang tua yang dipersoalkan sudah menikah lagi dan anak akrab dengan pasangan barunya', 'orang tua yang dipersoalkan telah menikah lagi dan anak akrab dengan pasangan barunya'],
  beda_pada='peristiwa', beda_maksud='versi A: anak canggung pada pasangan baru; versi B: anak akrab - berselisih pada PERISTIWA')

S(id='bekerja-jauh', pokok='pp-ha-lain', urut=112, tingkat='pilihan', kelompok='pokok', keadaan={'keadaanPihakLain': 'bekerja-jauh'},
  teks='Di mana orang tua yang dipersoalkan bekerja dan seberapa sering ia berada di rumah bersama anak?',
  hal='tempat kerja orang tua yang dipersoalkan dan seringnya ia di rumah', m='tempat kerja dan keberadaan @X@', v=BERMASALAH,
  K=(['@X@ bekerja di tempat yang jauh dan jarang berada di rumah sehingga sulit mengasuh anak bernama #8602# setiap hari',
      'pekerjaan @X@ di tempat jauh membuatnya jarang di rumah dan sulit mengasuh anak bernama #8602# setiap hari'],
     ['karena bekerja di tempat jauh @X@ jarang berada di rumah dan sulit mengasuh anak bernama #8602# setiap hari',
      '@X@ jarang pulang karena bekerja jauh sehingga sulit mengasuh anak bernama #8602# setiap hari']),
  A=['orang tua yang dipersoalkan bekerja jauh dan jarang pulang', 'orang tua yang dipersoalkan bekerja di tempat jauh dan jarang pulang'],
  B=['orang tua yang dipersoalkan bekerja dekat dan pulang setiap hari', 'orang tua yang dipersoalkan bekerja di tempat dekat dan setiap hari pulang'],
  beda_pada='tempat', beda_maksud='versi A: bekerja jauh dan jarang pulang; versi B: bekerja dekat dan pulang tiap hari - berselisih pada TEMPAT')

S(id='kebiasaan-buruk-ada', pokok='pp-ha-lain', urut=113, tingkat='pilihan', kelompok='pokok', keadaan={'keadaanPihakLain': 'kebiasaan-buruk'},
  teks='Apakah orang tua yang dipersoalkan memiliki kebiasaan yang buruk bagi anak dan apa saja yang saksi lihat sendiri?',
  hal='kebiasaan buruk orang tua yang dipersoalkan', m='kebiasaan buruk @X@', v=BERMASALAH,
  K=(['@X@ memiliki kebiasaan buruk yang dapat berpengaruh bagi anak bernama #8602# dan hal itu terjadi di rumah',
      'kebiasaan buruk @X@ terlihat di rumah dan dapat berpengaruh bagi anak bernama #8602#'],
     ['di rumah tampak kebiasaan buruk @X@ yang dapat berpengaruh bagi anak bernama #8602#',
      '@X@ mempunyai kebiasaan buruk di rumah yang berpengaruh bagi anak bernama #8602#']),
  A=['kebiasaan buruk orang tua yang dipersoalkan terjadi di depan anak', 'kebiasaan buruk orang tua yang dipersoalkan dilakukan di depan anak'],
  B=['kebiasaan buruk orang tua yang dipersoalkan terjadi di luar rumah dan tidak di depan anak', 'kebiasaan buruk orang tua yang dipersoalkan dilakukan di luar rumah dan tidak di depan anak'],
  beda_pada='tempat', beda_maksud='versi A: kebiasaan buruk di depan anak; versi B: di luar rumah - berselisih pada TEMPAT')

S(id='kekerasan-penelantaran', pokok='pp-ha-lain', urut=114, tingkat='inti', kelompok='pokok', keadaan={'keadaanPihakLain': 'kekerasan-penelantaran'},
  teks='Apakah orang tua yang dipersoalkan pernah berlaku kasar kepada anak atau menelantarkannya dan apa yang saksi ketahui?',
  hal='kekerasan atau penelantaran anak oleh orang tua yang dipersoalkan', m='kekerasan atau penelantaran anak oleh @X@', v=BERMASALAH,
  K=(['@X@ pernah berlaku kasar kepada anak bernama #8602# dan sering membiarkannya tanpa perhatian',
      'anak bernama #8602# pernah diperlakukan kasar oleh @X@ dan sering dibiarkan tanpa perhatian'],
     ['@X@ pernah memperlakukan anak bernama #8602# dengan kasar dan sering mengabaikannya tanpa perhatian',
      'perlakuan kasar @X@ kepada anak bernama #8602# pernah terjadi dan anak itu sering dibiarkan tanpa perhatian']),
  A=['orang tua yang dipersoalkan pernah berlaku kasar kepada anak', 'orang tua yang dipersoalkan pernah memperlakukan anak dengan kasar'],
  B=['orang tua yang dipersoalkan tidak pernah berlaku kasar kepada anak', 'orang tua yang dipersoalkan tidak pernah memperlakukan anak dengan kasar'],
  beda_maksud='versi A: pernah berlaku kasar; versi B: tidak pernah - berselisih pada PERISTIWA')

S(id='jarang-menjenguk', pokok='pp-ha-lain', urut=115, tingkat='pilihan', kelompok='pokok', keadaan={'keadaanPihakLain': 'jarang-menjenguk'},
  teks='Seberapa sering orang tua yang dipersoalkan menjenguk atau menghubungi anak bernama #8602# selama berpisah?',
  hal='seringnya orang tua yang dipersoalkan menjenguk atau menghubungi anak', m='kepedulian @X@ menjenguk anak bernama #8602#', v=BERMASALAH,
  K=(['@X@ jarang menjenguk anak bernama #8602# dan jarang pula menghubunginya',
      'selama berpisah @X@ hanya sesekali menjenguk anak bernama #8602# dan menghubunginya'],
     ['@X@ jarang datang melihat anak bernama #8602# dan jarang menghubunginya',
      'kunjungan @X@ kepada anak bernama #8602# sangat jarang dan komunikasinya pun jarang']),
  A=['orang tua yang dipersoalkan jarang menjenguk anak', 'orang tua yang dipersoalkan hanya sesekali menjenguk anak'],
  B=['orang tua yang dipersoalkan sering menjenguk anak', 'orang tua yang dipersoalkan rutin menjenguk anak'],
  beda_pada='jumlah', beda_maksud='versi A: jarang menjenguk; versi B: sering menjenguk - berselisih pada JUMLAH KUNJUNGAN')

# ---- keadaan yang membahayakan (pengalihan=ya) -----------------------------------------------------------------------
S(id='bahaya-kekerasan', pokok='pp-ha-bahaya', urut=121, tingkat='inti', kelompok='pokok', keadaan={'pengalihan': 'ya'},
  teks='Apakah saksi pernah melihat anak bernama #8602# dipukul atau dibentak oleh orang tua yang mengasuhnya sampai ketakutan?',
  hal='kekerasan terhadap anak oleh orang tua yang mengasuhnya', m='kekerasan terhadap anak bernama #8602# oleh @X@', v=PENGASUH, fam='hadir',
  K=(['@X@ pernah memukul dan membentak anak bernama #8602# sampai anak itu ketakutan',
      'anak bernama #8602# pernah dipukul dan dibentak @X@ hingga ketakutan'],
     ['pernah terjadi @X@ membentak dan memukul anak bernama #8602# sampai ia ketakutan',
      '@X@ memarahi anak bernama #8602# dengan kasar sampai anak itu ketakutan']),
  M=(['@X@ membentak anak bernama #8602# dengan kata kata kasar',
      '@X@ memarahi anak bernama #8602# dengan suara keras'],
     ['@X@ berteriak kasar kepada anak bernama #8602# dan anak itu menangis',
      '@X@ membentak anak bernama #8602# dengan kasar sampai anak itu menangis']),
  A=['orang tua yang mengasuh anak pernah memukul anak', 'orang tua yang mengasuh anak pernah main tangan kepada anak'],
  B=['orang tua yang mengasuh anak tidak pernah memukul anak', 'orang tua yang mengasuh anak tidak pernah main tangan kepada anak'],
  beda_maksud='versi A: pernah memukul; versi B: tidak pernah - berselisih pada PERISTIWA')

S(id='bahaya-penelantaran', pokok='pp-ha-bahaya', urut=122, tingkat='pilihan', kelompok='pokok', keadaan={'pengalihan': 'ya'},
  teks='Apakah anak bernama #8602# pernah tidak terurus atau tidak masuk sekolah dalam waktu lama karena pengasuhnya lalai?',
  hal='anak tidak terurus karena kelalaian pengasuh', m='anak bernama #8602# tidak terurus oleh @X@', v=PENGASUH,
  K=(['anak bernama #8602# sering tidak terurus oleh @X@ dan pernah tidak masuk sekolah dalam waktu lama',
      '@X@ lalai mengurus anak bernama #8602# sehingga anak itu tidak terurus dan pernah lama tidak masuk sekolah'],
     ['kelalaian @X@ membuat anak bernama #8602# tidak terurus dan pernah lama tidak bersekolah',
      'anak bernama #8602# dibiarkan tidak terurus oleh @X@ hingga pernah lama tidak masuk sekolah']),
  A=['anak sering tidak terurus oleh orang tua yang mengasuhnya', 'anak sering tidak terawat di bawah asuhan orang tua yang mengasuhnya'],
  B=['anak selalu terurus oleh orang tua yang mengasuhnya', 'anak selalu terawat di bawah asuhan orang tua yang mengasuhnya'],
  beda_maksud='versi A: anak tidak terurus; versi B: terurus - berselisih pada PERISTIWA')

S(id='bahaya-pengaruh', pokok='pp-ha-bahaya', urut=123, tingkat='pilihan', kelompok='pokok', keadaan={'pengalihan': 'ya'},
  teks='Apakah anak bernama #8602# terpengaruh keadaan buruk di rumah pengasuhnya seperti pergaulan bebas atau minuman keras?',
  hal='pengaruh buruk di rumah pengasuh terhadap anak', m='pengaruh buruk di rumah @X@ terhadap anak bernama #8602#', v=PENGASUH,
  K=(['anak bernama #8602# terpengaruh keadaan buruk di rumah @X@ berupa pergaulan bebas dan minuman keras',
      'di rumah @X@ ada pergaulan bebas dan minuman keras yang berpengaruh buruk bagi anak bernama #8602#'],
     ['keadaan di rumah @X@ berupa pergaulan bebas dan minuman keras berpengaruh buruk bagi anak bernama #8602#',
      'anak bernama #8602# melihat pergaulan bebas dan minuman keras di rumah @X@ dan terpengaruh olehnya']),
  A=['rumah pengasuh berpengaruh buruk bagi anak', 'keadaan rumah pengasuh berpengaruh buruk bagi anak'],
  B=['rumah pengasuh tidak berpengaruh buruk bagi anak', 'keadaan rumah pengasuh tidak berpengaruh buruk bagi anak'],
  beda_maksud='versi A: berpengaruh buruk; versi B: tidak berpengaruh buruk - berselisih pada PERISTIWA')

S(id='bahaya-pertengkaran', pokok='pp-ha-bahaya', urut=124, tingkat='tambahan', kelompok='pokok', keadaan={'pengalihan': 'ya'},
  teks='Apakah anak bernama #8602# sering menyaksikan pertengkaran atau keributan di rumah tempat ia diasuh?',
  hal='pertengkaran di depan anak di rumah pengasuh', m='pertengkaran di depan anak bernama #8602#', v=PENGASUH, fam='hadir',
  K=(['anak bernama #8602# sering menyaksikan pertengkaran di rumah @X@ dan menjadi takut',
      'pertengkaran di rumah @X@ sering disaksikan anak bernama #8602# sampai ia ketakutan'],
     ['di rumah @X@ anak bernama #8602# kerap melihat keributan dan menjadi takut',
      'anak bernama #8602# sering terkejut dan takut karena keributan di rumah @X@']),
  A=['anak sering melihat pertengkaran di rumah pengasuh', 'anak kerap menyaksikan pertengkaran di rumah pengasuh'],
  B=['anak jarang melihat pertengkaran di rumah pengasuh', 'anak jarang sekali menyaksikan pertengkaran di rumah pengasuh'],
  beda_pada='jumlah', beda_maksud='versi A: sering melihat pertengkaran; versi B: jarang - berselisih pada JUMLAH KEJADIAN')

# ---- ikatan batin ---------------------------------------------------------------------------------------------------
S(id='kedekatan-anak', pokok='pp-ha-ikatan', urut=131, tingkat='pilihan', kelompok='pokok',
  teks='Dengan siapa anak bernama #8602# lebih dekat dan tampak lebih nyaman?',
  varian=['Anak bernama #8602# lebih akrab dan merasa lebih nyaman bersama ayahnya atau ibunya?'],
  hal='kedekatan dan kenyamanan anak dengan orang tuanya', m='kedekatan anak bernama #8602# dengan @X@', v=PENGASUH,
  K=(['anak bernama #8602# lebih dekat dan tampak nyaman bersama @X@',
      'kedekatan anak bernama #8602# lebih terasa kepada @X@ dan ia merasa nyaman di sisinya'],
     ['bersama @X@ anak bernama #8602# terlihat paling akrab dan nyaman',
      'anak bernama #8602# merasa aman dan nyaman bila berada di dekat @X@']),
  A=['anak lebih dekat dengan orang tua yang mengasuhnya', 'kedekatan anak lebih terasa kepada orang tua yang mengasuhnya'],
  B=['anak sama dekatnya dengan kedua orang tuanya', 'kedekatan anak sama kuat kepada kedua orang tuanya'],
  beda_pada='pelaku', beda_maksud='versi A: anak lebih dekat pada pengasuh; versi B: sama dekat dengan keduanya - berselisih pada PELAKU')

S(id='sikap-anak-bertemu', pokok='pp-ha-ikatan', urut=132, tingkat='tambahan', kelompok='pokok',
  teks='Bagaimana sikap anak bernama #8602# ketika bertemu dengan orang tuanya yang tidak mengasuhnya?',
  hal='sikap anak ketika bertemu orang tuanya yang tidak mengasuh', m='sikap anak bernama #8602# bertemu @Y@', v=PENGASUH, fam='hadir',
  K=(['anak bernama #8602# tampak senang dan akrab setiap kali bertemu @Y@',
      'setiap bertemu @Y@ anak bernama #8602# terlihat gembira dan akrab'],
     ['bila bertemu @Y@ anak bernama #8602# bersikap akrab dan gembira',
      'anak bernama #8602# menyambut @Y@ dengan akrab dan gembira ketika bertemu']),
  A=['anak senang dan akrab bila bertemu orang tua lainnya', 'anak gembira dan akrab saat bertemu orang tua lainnya'],
  B=['anak takut dan menjauh bila bertemu orang tua lainnya', 'anak ketakutan dan menjauh saat bertemu orang tua lainnya'],
  beda_maksud='versi A: anak senang dan akrab; versi B: takut dan menjauh - berselisih pada PERISTIWA')

S(id='merindukan', pokok='pp-ha-ikatan', urut=133, tingkat='tambahan', kelompok='akibat',
  teks='Apakah anak bernama #8602# pernah menanyakan atau merindukan orang tuanya yang tidak bersamanya?',
  hal='anak menanyakan atau merindukan orang tuanya yang tidak bersamanya', m='anak bernama #8602# merindukan @Y@', v=PENGASUH,
  M=(['anak bernama #8602# sering menanyakan @Y@ dan berkata ingin bertemu',
      'anak bernama #8602# berkata rindu kepada @Y@ dan ingin bertemu'],
     ['anak bernama #8602# bertanya kapan ia bisa bertemu @Y@ dan berkata merindukannya',
      'anak bernama #8602# mengatakan rindu kepada @Y@ dan ingin bertemu']),
  K=(['anak bernama #8602# sering menanyakan @Y@ dan ingin bertemu dengannya',
      'anak bernama #8602# kerap menanyakan @Y@ dan tampak rindu ingin bertemu'],
     ['anak bernama #8602# merindukan @Y@ dan beberapa kali menanyakannya',
      'beberapa kali anak bernama #8602# menanyakan @Y@ dan tampak ingin bertemu']),
  A=['anak sering menanyakan dan merindukan orang tua lainnya', 'anak kerap menanyakan dan rindu kepada orang tua lainnya'],
  B=['anak tidak pernah menanyakan orang tua lainnya', 'anak tidak pernah bertanya tentang orang tua lainnya'],
  beda_maksud='versi A: anak menanyakan dan merindukan; versi B: tidak pernah menanyakan - berselisih pada PERISTIWA')

# ---- pilihan anak (mumayyiz) lanjutan --------------------------------------------------------------------------------
S(id='alasan-pilihan', pokok='pp-ha-pilihan-lanjut', urut=141, tingkat='tambahan', kelompok='pokok', keadaan={'anakMumayyiz': 'sudah'},
  teks='Apakah anak bernama #8602# menyebut alasan mengapa ia memilih tinggal bersama orang tua yang dipilihnya?',
  hal='alasan anak memilih tinggal bersama salah satu orang tuanya', m='alasan pilihan anak bernama #8602#', v=PILIHAN,
  K=(['anak bernama #8602# memilih tinggal bersama @X@ karena merasa lebih nyaman dan lebih diperhatikan',
      'alasan anak bernama #8602# memilih @X@ adalah karena merasa lebih nyaman dan diperhatikan'],
     ['anak bernama #8602# lebih memilih @X@ sebab ia merasa nyaman dan diperhatikan olehnya',
      'anak bernama #8602# menyebut @X@ sebagai pilihannya karena merasa nyaman dan diperhatikan']),
  M=(['anak bernama #8602# berkata ia ingin tinggal bersama @X@ karena merasa nyaman',
      'anak bernama #8602# menyebut alasannya memilih @X@ yaitu merasa nyaman'],
     ['anak bernama #8602# menyatakan memilih @X@ karena nyaman di dekatnya',
      'anak bernama #8602# mengatakan ingin ikut @X@ sebab ia merasa nyaman']),
  A=['anak memilih orang tua pilihannya karena merasa nyaman', 'anak memilih orang tua pilihannya sebab merasa diperhatikan'],
  B=['anak memilih orang tua pilihannya karena dijanjikan hadiah', 'anak memilih orang tua pilihannya sebab diiming-imingi hadiah'],
  beda_pada='penyebab', beda_maksud='versi A: memilih karena nyaman; versi B: memilih karena dijanjikan hadiah - berselisih pada PENYEBAB')

S(id='pilihan-tanpa-paksaan', pokok='pp-ha-pilihan-lanjut', urut=142, tingkat='tambahan', kelompok='pokok', keadaan={'anakMumayyiz': 'sudah'},
  teks='Apakah pilihan anak bernama #8602# itu datang dari kemauannya sendiri tanpa dipengaruhi atau ditekan siapa pun?',
  hal='kemandirian pilihan anak tanpa tekanan', m='kemandirian pilihan anak bernama #8602#', v=PILIHAN,
  K=(['pilihan anak bernama #8602# untuk tinggal bersama @X@ datang dari kemauannya sendiri tanpa tekanan',
      'anak bernama #8602# memilih @X@ atas kemauan sendiri tanpa tekanan dari siapa pun'],
     ['tanpa tekanan dari siapa pun anak bernama #8602# memilih tinggal bersama @X@ atas kemauannya sendiri',
      'pilihan anak bernama #8602# terhadap @X@ lahir dari kehendaknya sendiri tanpa dipaksa']),
  A=['pilihan anak datang dari kemauannya sendiri tanpa paksaan', 'anak memilih atas kemauan sendiri tanpa paksaan'],
  B=['pilihan anak dipengaruhi bujukan salah satu orang tuanya', 'anak memilih setelah dibujuk salah satu orang tuanya'],
  beda_pada='penyebab', beda_maksud='versi A: pilihan atas kemauan sendiri; versi B: dipengaruhi bujukan - berselisih pada PENYEBAB')

S(id='pilihan-sejak', pokok='pp-ha-pilihan-lanjut', urut=143, tingkat='tambahan', kelompok='pokok', keadaan={'anakMumayyiz': 'sudah'},
  teks='Sejak kapan anak bernama #8602# menyatakan keinginannya tinggal bersama orang tua yang dipilihnya?',
  hal='waktu anak mulai menyatakan pilihannya', m='waktu anak bernama #8602# menyatakan pilihannya', v=PILIHAN,
  K=(['anak bernama #8602# sudah menyatakan keinginannya tinggal bersama @X@ sejak {sejak} sampai sekarang',
      'sejak {sejak} anak bernama #8602# berulang kali menyatakan ingin tinggal bersama @X@'],
     ['keinginan anak bernama #8602# tinggal bersama @X@ sudah ia sampaikan sejak {sejak} sampai sekarang',
      'mulai {sejak} anak bernama #8602# menyatakan memilih tinggal bersama @X@']),
  A=['anak menyatakan pilihannya sudah sejak lama dan tetap sama', 'anak sudah lama menyatakan pilihannya dan pilihan itu tetap'],
  B=['anak baru menyatakan pilihannya belakangan ini', 'anak baru belakangan ini menyatakan pilihannya'],
  beda_pada='lama', beda_maksud='versi A: pilihan sudah lama dan tetap; versi B: baru belakangan - berselisih pada LAMA')

# ---- akses ------------------------------------------------------------------------------------------------------------
S(id='akses-berjalan', pokok='pp-ha-akses-lanjut', urut=151, tingkat='pilihan', kelompok='pokok', keadaan={'akses': 'ya'},
  teks='Seberapa sering orang tua yang tidak mengasuh bertemu anak bernama #8602# dan bagaimana pertemuan itu berlangsung?',
  hal='pelaksanaan pertemuan orang tua lainnya dengan anak', m='pertemuan @Y@ dengan anak bernama #8602#', v=PENGASUH,
  K=(['@Y@ diberi kesempatan bertemu anak bernama #8602# dan pertemuan itu berlangsung baik',
      '@X@ membolehkan @Y@ bertemu anak bernama #8602# dan pertemuan itu berjalan baik'],
     ['pertemuan @Y@ dengan anak bernama #8602# diizinkan dan berjalan baik',
      '@Y@ leluasa bertemu anak bernama #8602# dan pertemuan berjalan baik']),
  A=['orang tua lainnya bebas bertemu anak kapan saja', 'orang tua lainnya dapat bertemu anak kapan pun ia mau'],
  B=['orang tua lainnya hanya boleh bertemu anak pada waktu tertentu', 'orang tua lainnya hanya diizinkan bertemu anak pada waktu yang ditentukan'],
  beda_pada='waktu', beda_maksud='versi A: bebas bertemu kapan saja; versi B: hanya waktu tertentu - berselisih pada WAKTU')

S(id='akses-dihalangi', pokok='pp-ha-akses-lanjut', urut=152, tingkat='inti', kelompok='pokok', keadaan={'akses': 'tidak'},
  teks='Apakah orang tua yang tidak mengasuh pernah dihalangi bertemu anak bernama #8602# dan siapa yang menghalanginya?',
  hal='hambatan orang tua lainnya bertemu anak', m='penghalangan pertemuan @Y@ dengan anak bernama #8602#', v=PENGASUH, fam='hadir',
  K=(['@Y@ dihalangi @X@ untuk bertemu anak bernama #8602# ketika datang menjenguk',
      '@X@ melarang @Y@ bertemu anak bernama #8602# ketika datang menjenguk'],
     ['ketika @Y@ datang menjenguk @X@ menghalanginya bertemu anak bernama #8602#',
      '@Y@ ditolak @X@ ketika hendak bertemu anak bernama #8602#']),
  M=(['@X@ berkata kepada @Y@ bahwa ia dilarang menemui anak bernama #8602#',
      '@X@ melarang @Y@ menemui anak bernama #8602#'],
     ['@X@ mengatakan kepada @Y@ agar menjauhi anak bernama #8602#',
      '@X@ menyatakan di depan saya bahwa @Y@ dilarang bertemu anak bernama #8602#']),
  A=['orang tua lainnya dihalangi bertemu anak', 'orang tua lainnya dilarang bertemu anak'],
  B=['orang tua lainnya tidak pernah dihalangi bertemu anak', 'orang tua lainnya tidak pernah dilarang bertemu anak'],
  beda_maksud='versi A: dihalangi bertemu anak; versi B: tidak pernah dihalangi - berselisih pada PERISTIWA')

S(id='akses-komunikasi', pokok='pp-ha-akses-lanjut', urut=153, tingkat='tambahan', kelompok='pokok',
  teks='Apakah orang tua yang tidak mengasuh dapat berkomunikasi dengan anak bernama #8602# lewat telepon atau pesan?',
  hal='komunikasi orang tua lainnya dengan anak lewat telepon atau pesan', m='komunikasi @Y@ dengan anak bernama #8602#', v=PENGASUH,
  K=(['@Y@ dapat berkomunikasi dengan anak bernama #8602# lewat telepon dan @X@ tidak melarangnya',
      'anak bernama #8602# bebas berbicara dengan @Y@ lewat telepon dan @X@ tidak melarangnya'],
     ['telepon antara @Y@ dan anak bernama #8602# berjalan lancar dan @X@ tidak melarangnya',
      '@X@ tidak pernah melarang anak bernama #8602# menelepon @Y@']),
  A=['anak dapat menelepon orang tua lainnya kapan saja', 'anak dapat menghubungi orang tua lainnya kapan pun'],
  B=['anak tidak dapat menghubungi orang tua lainnya karena ponselnya disita', 'anak tidak bisa menghubungi orang tua lainnya karena ponselnya diambil'],
  beda_maksud='versi A: anak dapat menelepon; versi B: tidak dapat karena ponsel diambil - berselisih pada PERISTIWA')

# ---- saudara ------------------------------------------------------------------------------------------------------------
S(id='saudara-bersama', pokok='pp-ha-saudara', urut=161, tingkat='pilihan', kelompok='pokok', keadaan={'jumlahAnak': 'lebih'},
  teks='Apakah anak-anak #0046# dan #0047# tinggal bersama sebagai saudara dan bagaimana kedekatan mereka satu sama lain?',
  hal='kebersamaan dan kedekatan anak-anak sebagai saudara', m='kebersamaan anak-anak #8602#', v=PENGASUH,
  K=(['anak-anak #8602# tinggal satu rumah di bawah asuhan @X@ dan sangat dekat satu sama lain',
      'anak-anak #8602# berada bersama dalam asuhan @X@ dan hubungan mereka sebagai saudara sangat dekat'],
     ['semua anak #8602# tinggal bersama @X@ dan mereka saling dekat sebagai saudara',
      'kebersamaan anak-anak #8602# di rumah @X@ terjaga dan mereka sangat dekat']),
  A=['anak-anak tinggal bersama dan sangat dekat satu sama lain', 'anak-anak berkumpul dan sangat akrab satu sama lain'],
  B=['anak-anak tinggal terpisah dan jarang bertemu', 'anak-anak hidup terpisah dan jarang bertemu'],
  beda_pada='tempat', beda_maksud='versi A: anak-anak bersama; versi B: terpisah - berselisih pada TEMPAT')

S(id='saudara-dipisah', pokok='pp-ha-saudara', urut=162, tingkat='tambahan', kelompok='akibat', keadaan={'jumlahAnak': 'lebih'},
  teks='Apakah ada kekhawatiran bila anak-anak #0046# dan #0047# dipisahkan pengasuhannya dan apa yang saksi lihat dari anak-anak itu?',
  hal='dampak memisahkan anak-anak dari saudaranya', m='dampak pemisahan anak-anak #8602#', v=PENGASUH,
  K=(['anak-anak #8602# sangat terikat satu sama lain dan akan sedih bila dipisahkan',
      'ikatan antar anak #8602# sangat kuat sehingga mereka akan sedih bila dipisahkan'],
     ['anak-anak #8602# enggan berpisah dan akan sedih bila pengasuhan mereka dipisahkan',
      'bila anak-anak #8602# dipisahkan mereka akan sedih karena ikatan mereka sangat kuat']),
  A=['anak-anak akan sedih bila dipisahkan', 'anak-anak akan bersedih bila dipisahkan'],
  B=['anak-anak tidak keberatan bila dipisahkan', 'anak-anak tidak menolak bila dipisahkan'],
  beda_maksud='versi A: anak-anak akan sedih bila dipisah; versi B: tidak keberatan - berselisih pada PERISTIWA')

# ---- kerabat ------------------------------------------------------------------------------------------------------------
S(id='kerabat-hubungan', pokok='pp-ha-kerabat', urut=171, tingkat='inti', kelompok='pokok', keadaan={'kedudukanPengaju': 'kerabat'},
  teks='Apa hubungan #0046# dengan anak bernama #8602# dan mengapa #0046# yang mengajukan hak asuh anak itu?',
  hal='hubungan pengaju dengan anak dan alasan pengajuan', m='hubungan #0046# dengan anak bernama #8602#',
  K=(['#0046# adalah {hubungan} anak bernama #8602# dan mengajukan hak asuh karena orang tua anak itu tidak dapat menjamin pengasuhannya',
      'hubungan #0046# dengan anak bernama #8602# adalah {hubungan} dan ia mengajukan hak asuh karena orang tua anak itu tidak dapat menjamin pengasuhannya'],
     ['#0046# berkedudukan sebagai {hubungan} anak bernama #8602# dan memohon hak asuh sebab orang tua anak itu tidak dapat menjamin pengasuhannya',
      'sebagai {hubungan} anak bernama #8602# maka #0046# memohon hak asuh karena orang tua anak itu tidak dapat menjamin pengasuhannya']),
  A=['#0046# adalah kerabat dekat anak yang berhak mengasuh', 'kerabat dekat anak yang berhak mengasuh adalah #0046#'],
  B=['#0046# hanyalah kenalan biasa dan bukan kerabat anak', 'hubungan #0046# dengan anak hanya sebagai kenalan biasa dan bukan kerabat'],
  beda_pada='pelaku', beda_maksud='versi A: kerabat dekat yang berhak mengasuh; versi B: hanya kenalan - berselisih pada PELAKU')

S(id='kerabat-sanggup', pokok='pp-ha-kerabat', urut=172, tingkat='pilihan', kelompok='pokok', keadaan={'kedudukanPengaju': 'kerabat'},
  teks='Apakah #0046# sanggup mengasuh anak bernama #8602# dan sudah pernah ikut mengasuhnya selama ini?',
  hal='kesanggupan pengaju mengasuh anak', m='kesanggupan #0046# mengasuh anak bernama #8602#',
  K=(['#0046# sanggup mengasuh anak bernama #8602# dan selama ini sudah ikut mengasuhnya',
      'selama ini #0046# sudah ikut mengasuh anak bernama #8602# dan ia sanggup meneruskannya'],
     ['#0046# mampu mengasuh anak bernama #8602# karena sudah ikut mengasuhnya selama ini',
      'anak bernama #8602# sudah biasa diasuh #0046# sehingga ia sanggup mengasuhnya']),
  A=['#0046# sanggup dan layak mengasuh anak', '#0046# mampu dan patut mengasuh anak'],
  B=['#0046# kurang sanggup mengasuh anak karena kesehatannya', '#0046# kurang mampu mengasuh anak karena kesehatannya'],
  beda_pada='penyebab', beda_maksud='versi A: sanggup mengasuh; versi B: kurang sanggup karena kesehatan - berselisih pada PENYEBAB')

# ---- perubahan keadaan ----------------------------------------------------------------------------------------------
S(id='pindah-tinggal', pokok='pp-ha-perubahan', urut=181, tingkat='pilihan', kelompok='pokok', keadaan={'perubahan': 'ya'},
  teks='Apakah anak bernama #8602# pernah dibawa pindah tempat tinggal sesudah orang tuanya berpisah dan apa akibatnya bagi anak?',
  hal='perpindahan tempat tinggal anak dan akibatnya', m='perpindahan tempat tinggal anak bernama #8602#', v=PENGASUH,
  K=(['sesudah orang tuanya berpisah anak bernama #8602# dibawa pindah oleh @X@ ke {isi} dan anak itu harus menyesuaikan diri',
      '@X@ membawa anak bernama #8602# pindah ke {isi} sesudah perpisahan dan anak itu harus menyesuaikan diri'],
     ['anak bernama #8602# pindah ke {isi} bersama @X@ setelah orang tuanya berpisah dan ia harus menyesuaikan diri',
      'setelah berpisah @X@ memindahkan anak bernama #8602# ke {isi} sehingga anak itu harus menyesuaikan diri']),
  A=['pindah tempat tinggal membuat anak jauh dari keluarga besarnya', 'perpindahan itu membuat anak jauh dari keluarga besarnya'],
  B=['pindah tempat tinggal tidak membuat anak jauh dari keluarga besarnya', 'perpindahan itu tidak membuat anak jauh dari keluarga besarnya'],
  beda_maksud='versi A: pindah membuat anak jauh dari keluarga; versi B: tidak - berselisih pada PERISTIWA')

S(id='pindah-sekolah', pokok='pp-ha-perubahan', urut=182, tingkat='tambahan', kelompok='akibat', keadaan={'perubahan': 'ya'},
  teks='Apakah anak bernama #8602# pernah pindah sekolah sesudah orang tuanya berpisah dan bagaimana belajarnya sesudah itu?',
  hal='pindah sekolah anak dan akibatnya pada belajarnya', m='pindah sekolah anak bernama #8602#', v=PENGASUH,
  K=(['anak bernama #8602# pindah sekolah ke {isi} sesudah orang tuanya berpisah dan belajarnya sempat terganggu',
      'sesudah perpisahan orang tuanya anak bernama #8602# pindah sekolah ke {isi} dan belajarnya sempat terganggu'],
     ['anak bernama #8602# dipindahkan ke {isi} sesudah perpisahan dan belajarnya sempat terganggu',
      'perpindahan sekolah anak bernama #8602# ke {isi} membuat belajarnya sempat terganggu']),
  A=['setelah pindah sekolah anak cepat menyesuaikan diri', 'setelah berpindah sekolah anak cepat beradaptasi'],
  B=['setelah pindah sekolah anak sulit menyesuaikan diri', 'setelah berpindah sekolah anak sulit beradaptasi'],
  beda_maksud='versi A: cepat menyesuaikan diri; versi B: sulit - berselisih pada PERISTIWA')

# ---- kesepakatan -----------------------------------------------------------------------------------------------------
S(id='kesepakatan-diingkari', pokok='pp-ha-damai', urut=191, tingkat='pilihan', kelompok='upaya',
  teks='Apakah pernah ada kesepakatan keluarga tentang pengasuhan anak bernama #8602# dan apakah kesepakatan itu dijalankan?',
  hal='kesepakatan keluarga tentang pengasuhan anak dan pelaksanaannya', m='kesepakatan keluarga tentang pengasuhan anak bernama #8602#',
  K=(['pernah ada kesepakatan keluarga tentang pengasuhan anak bernama #8602# yang kemudian tidak dijalankan sebagaimana disepakati',
      'keluarga pernah bersepakat tentang pengasuhan anak bernama #8602# tetapi kesepakatan itu tidak dijalankan sebagaimana disepakati'],
     ['mengenai pengasuhan anak bernama #8602# pernah dicapai kesepakatan keluarga namun tidak dijalankan sebagaimana disepakati',
      'ada kesepakatan keluarga tentang pengasuhan anak bernama #8602# yang tidak dijalankan sebagaimana disepakati']),
  A=['kesepakatan keluarga tentang pengasuhan anak dijalankan dengan baik', 'kesepakatan keluarga tentang pengasuhan anak berjalan dengan baik'],
  B=['kesepakatan keluarga tentang pengasuhan anak tidak pernah ada', 'tidak pernah ada kesepakatan keluarga tentang pengasuhan anak'],
  beda_maksud='versi A: ada kesepakatan dan dijalankan; versi B: tidak pernah ada kesepakatan - berselisih pada PERISTIWA')

S(id='mediasi-keluarga', pokok='pp-ha-damai', urut=192, tingkat='tambahan', kelompok='upaya',
  teks='Siapa dari keluarga yang pernah mempertemukan #0046# dan #0047# untuk membicarakan pengasuhan anak dan apa hasilnya?',
  hal='pertemuan keluarga untuk membicarakan pengasuhan anak dan hasilnya', m='pertemuan keluarga tentang pengasuhan anak bernama #8602#',
  K=(['keluarga pernah mempertemukan #0046# dan #0047# untuk membicarakan pengasuhan anak bernama #8602# tetapi tidak tercapai kata sepakat',
      'pertemuan keluarga untuk membicarakan pengasuhan anak bernama #8602# pernah diadakan namun tidak tercapai kata sepakat'],
     ['pihak keluarga pernah mengumpulkan #0046# dan #0047# membicarakan pengasuhan anak bernama #8602# tetapi tidak tercapai kata sepakat',
      'upaya keluarga membicarakan pengasuhan anak bernama #8602# dengan #0046# dan #0047# tidak membuahkan kata sepakat']),
  A=['keluarga pernah mempertemukan kedua pihak dan tidak ada kesepakatan', 'keluarga pernah mengumpulkan kedua pihak namun tidak ada kesepakatan'],
  B=['keluarga belum pernah mempertemukan kedua pihak', 'keluarga belum pernah mengumpulkan kedua pihak'],
  beda_maksud='versi A: pernah dipertemukan tanpa hasil; versi B: belum pernah dipertemukan - berselisih pada PERISTIWA')

# ---- tergugat tidak hadir (verstek) --------------------------------------------------------------------------------
S(id='lawan-kepedulian', pokok='pp-ha-lain', urut=201, tingkat='pilihan', kelompok='pokok', keadaan={'kehadiran': 'verstek'},
  teks='Selama berpisah apakah #0047# memperhatikan kebutuhan anak bernama #8602# dan bagaimana ia menjalin hubungan dengan anak?',
  hal='kepedulian #0047# kepada anak selama berpisah', m='kepedulian #0047# kepada anak bernama #8602# selama berpisah',
  K=(['selama berpisah #0047# kurang memperhatikan kebutuhan anak bernama #8602# dan jarang menjalin hubungan dengan anak itu',
      '#0047# kurang peduli pada kebutuhan anak bernama #8602# selama berpisah dan jarang berhubungan dengan anak itu'],
     ['sesudah berpisah #0047# kurang menaruh perhatian pada kebutuhan anak bernama #8602# dan jarang menghubungi anak itu',
      'perhatian #0047# terhadap kebutuhan anak bernama #8602# kurang selama berpisah dan jarang menjalin hubungan dengannya']),
  A=['#0047# kurang memperhatikan anak selama berpisah', '#0047# kurang peduli pada anak selama berpisah'],
  B=['#0047# tetap memperhatikan anak selama berpisah', '#0047# tetap peduli pada anak selama berpisah'],
  beda_maksud='versi A: kurang memperhatikan; versi B: tetap memperhatikan - berselisih pada PERISTIWA')

S(id='lawan-keberadaan', pokok='pp-ha-lain', urut=202, tingkat='pilihan', kelompok='pokok', keadaan={'kehadiran': 'verstek'},
  teks='Apakah #0047# mengetahui adanya perkara ini dan di mana saksi mengetahui ia tinggal sekarang?',
  hal='pengetahuan #0047# tentang perkara ini dan tempat tinggalnya sekarang', m='pengetahuan #0047# tentang perkara ini',
  K=(['#0047# sudah mengetahui adanya perkara ini dan tempat tinggalnya sekarang adalah {isi} sejauh yang saya ketahui',
      'perkara ini sudah diketahui #0047# yang sekarang bertempat tinggal di {isi} sejauh yang saya ketahui'],
     ['#0047# mengetahui perkara ini dan sekarang tinggal di {isi} sejauh yang saya ketahui',
      'sekarang #0047# berada di {isi} sejauh yang saya ketahui dan ia sudah mengetahui perkara ini']),
  A=['#0047# mengetahui adanya perkara ini', '#0047# sudah mengetahui adanya perkara ini'],
  B=['#0047# belum mengetahui adanya perkara ini', '#0047# belum tahu adanya perkara ini'],
  beda_maksud='versi A: mengetahui perkara; versi B: belum mengetahui - berselisih pada PERISTIWA')
