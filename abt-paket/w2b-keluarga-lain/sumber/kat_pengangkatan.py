# -*- coding: utf-8 -*-
"""Isi tambahan katalog saksi PENGANGKATAN ANAK (369, permohonan) - agen W2b-C, 21 Okt 2026.

Menambah: dasar hukum baru, keadaan baru (pemohonPerkawinan, orangTuaKandung, anakKandungPemohon), pokok pembuktian baru (pp-aa-*) dan
butir baru (q-pa-*-aa). Butir/pokok/dasar hukum/keadaan lama tidak diubah. Variabel isian baru (jatah 4910-4915):
  4910 sejak kapan anak diasuh pemohon | 4911 alasan penyerahan anak oleh orang tua kandung | 4912 riwayat perkawinan dan anak kandung pemohon
  4913 izin atau rekomendasi instansi sosial | 4914 penghasilan pemohon | 4915 tujuan pengangkatan (alasan pemohon)
Variabel lama yang dipakai: 7036 (Pemohon/Para Pemohon), 8602 (nama anak), 8618 (tempat-tanggal lahir anak), 8619 (orang tua kandung),
8622 (status perkawinan pemohon), 8623 (hubungan pemohon dengan anak), 0100 (pekerjaan pemohon), 0099 (umur pemohon).
"""
KUNCI = 'pengangkatan-anak'
VARBARU = ['4910', '4911', '4912', '4913', '4914', '4915']

SUMBER_PP54 = 'jdih.kemenkeu.go.id/api/download/fulltext/2007/54TAHUN2007PP.htm (dibaca SAKSI-E 18 Okt 2026)'

DASAR_BARU = [
    dict(id='dh-aa-uu35-40', rujukan='Pasal 40 UU 23/2002 sebagaimana diubah UU 35/2014 tentang Perlindungan Anak',
         uraian='orang tua angkat wajib memberitahukan kepada anak angkatnya mengenai asal-usulnya dan orang tuanya, dengan memperhatikan kesiapan anak',
         status='perlu-verifikasi', sumber='dikutip dari pengetahuan hukum; belum dicocokkan dengan naskah resmi (naskah UU 35/2014 di peraturan.bpk.go.id/Download/28052 perlu dibaca untuk Pasal 40)'),
    dict(id='dh-aa-khi-209', rujukan='Pasal 209 Kompilasi Hukum Islam',
         uraian='anak angkat yang tidak menerima wasiat diberi wasiat wajibah oleh orang tua angkatnya, dan sebaliknya; anak angkat bukan ahli waris orang tua angkat',
         status='perlu-verifikasi', sumber='bunyi ayat (2) cocok dengan beberapa jurnal hukum (sumber sekunder, hasil pencarian W2b-C 21 Okt 2026); naskah KHI (Inpres 1/1991) terbitan Kemenag belum dibaca'),
    dict(id='dh-aa-khi-wali-nikah', rujukan='Ketentuan Kompilasi Hukum Islam tentang wali nikah (Pasal 19 sampai Pasal 23)',
         uraian='wali nikah anak perempuan adalah wali nasab menurut urutan kekerabatan darah, sehingga pengangkatan anak tidak memindahkan kedudukan wali nikah kepada orang tua angkat',
         status='perlu-verifikasi', sumber='dikutip dari pengetahuan hukum; belum dicocokkan dengan naskah KHI terbitan Kemenag'),
    dict(id='dh-aa-pp54-tunggal', rujukan='Pasal 16 ayat (1) dan ayat (2) PP 54/2007 tentang Pelaksanaan Pengangkatan Anak',
         uraian='pengangkatan anak oleh orang tua tunggal hanya dapat dilakukan oleh Warga Negara Indonesia setelah mendapat izin dari Menteri; pemberian izin dapat didelegasikan kepada kepala instansi sosial di provinsi',
         status='terverifikasi', sumber=SUMBER_PP54.replace('18 Okt', '21 Okt') + '; dibaca lagi W2b-C 21 Okt 2026 (Pasal 16 ayat (1)-(2))'),
    dict(id='dh-aa-pp54-pantau', rujukan='Pasal 30 ayat (2) huruf b, Pasal 36, dan Pasal 39 PP 54/2007',
         uraian='pendampingan memantau perkembangan anak dalam pengasuhan orang tua angkat; pengawasan oleh Pemerintah (Departemen Sosial); pekerja sosial menyampaikan laporan sosial tentang kelayakan orang tua angkat dan perkembangan anak kepada Menteri atau kepala instansi sosial setempat',
         status='terverifikasi', sumber='jdih.kemenkeu.go.id/api/download/fulltext/2007/54TAHUN2007PP.htm (dibaca W2b-C 21 Okt 2026); teks pasal tidak menyebut waktu pelaporan sesudah penetapan pengadilan'),
]

KEADAAN_BARU = {
    'pemohonPerkawinan': {'sumber': 'borang', 'nilai': ['berdua', 'sendiri'], 'label': 'Pemohon pengangkatan anak: suami istri berdua atau seorang diri', 'bawaan': 'berdua'},
    'orangTuaKandung': {'sumber': 'borang', 'nilai': ['lengkap', 'salah-satu-meninggal', 'kedua-meninggal', 'tidak-diketahui'],
                        'label': 'Keadaan orang tua kandung anak yang akan diangkat', 'bawaan': 'lengkap'},
    'anakKandungPemohon': {'sumber': 'borang', 'nilai': ['belum-ada', 'ada'], 'label': 'Pemohon sudah mempunyai anak kandung', 'bawaan': 'belum-ada'},
}


def _p(id_, judul, uraian, dasar, keadaan=None):
    d = dict(id=id_, judul=judul, uraian=uraian, wajib=False, dasarHukum=dasar)
    if keadaan:
        d['keadaan'] = keadaan
    return d


POKOK_BARU = [
    _p('pp-aa-identitas', 'Identitas dan akta kelahiran anak', 'tempat-tanggal lahir, akta kelahiran, dan Kartu Keluarga anak', ['dh-pp54-12']),
    _p('pp-aa-kehidupan', 'Keadaan anak dalam asuhan pemohon', 'kesehatan, pendidikan, ibadah, dan hubungan batin anak dengan pemohon', ['dh-uu35-39', 'dh-pp54-13']),
    _p('pp-aa-persetujuan-anak', 'Persetujuan anak', 'anak bersedia diasuh dan diangkat, sesuai tingkat pemahamannya', ['dh-pp54-13']),
    _p('pp-aa-penyerahan', 'Penyerahan anak oleh orang tua kandung', 'alasan, cara, dan bukti penyerahan anak oleh orang tua kandung', ['dh-pp54-13', 'dh-khi-171h'], {'bukan:orangTuaKandung': ['kedua-meninggal', 'tidak-diketahui']}),
    _p('pp-aa-ortu-meninggal', 'Orang tua kandung yang meninggal dunia', 'kematian salah satu atau kedua orang tua kandung dan siapa yang berhak atas anak', ['dh-pp54-12'], {'orangTuaKandung': ['salah-satu-meninggal', 'kedua-meninggal']}),
    _p('pp-aa-asal-tidak-diketahui', 'Anak yang orang tuanya tidak diketahui', 'cara anak ditemukan atau diserahkan dan upaya mencari orang tua kandung', ['dh-pp54-12'], {'orangTuaKandung': 'tidak-diketahui'}),
    _p('pp-aa-izin-asuh', 'Izin pengasuhan dari instansi sosial', 'surat izin atau rekomendasi pengasuhan dari dinas sosial', ['dh-pp54-13', 'dh-permensos-110'], {'izinInstansiSosial': 'berlaku'}),
    _p('pp-aa-laporan-sosial', 'Laporan sosial dan kunjungan petugas', 'penelitian kemasyarakatan dan kunjungan petugas sosial ke rumah pemohon', ['dh-pp54-13'], {'izinInstansiSosial': 'berlaku'}),
    _p('pp-aa-ekonomi', 'Kemampuan ekonomi dan tempat tinggal', 'penghasilan, biaya hidup anak, dan tempat tinggal pemohon', ['dh-pp54-13']),
    _p('pp-aa-pasangan', 'Perkawinan dan persetujuan pasangan', 'riwayat perkawinan pemohon dan persetujuan pasangannya', ['dh-pp54-13'], {'pemohonPerkawinan': 'berdua'}),
    _p('pp-aa-tunggal', 'Pemohon seorang diri', 'status perkawinan pemohon dan siapa yang membantu mengasuh anak', ['dh-aa-pp54-tunggal', 'dh-pp54-13'], {'pemohonPerkawinan': 'sendiri'}),
    _p('pp-aa-anak-kandung', 'Anak kandung pemohon', 'ada atau belum adanya anak kandung pemohon dan sikapnya terhadap anak yang akan diangkat', ['dh-pp54-13']),
    _p('pp-aa-keluarga', 'Sikap keluarga pemohon', 'keluarga besar pemohon menerima kehadiran anak itu', ['dh-buku2-2013-17']),
    _p('pp-aa-hubungan-darah', 'Hubungan keluarga pemohon dengan anak', 'hubungan kerabat antara pemohon dan orang tua kandung anak', ['dh-pp54-13', 'dh-uu35-39'], {'hubunganPemohon': 'keluarga'}),
    _p('pp-aa-bukan-keluarga', 'Pemohon bukan kerabat anak', 'bagaimana pemohon mengenal anak dan alasan memilih anak itu', ['dh-pp54-13', 'dh-uu35-39'], {'hubunganPemohon': 'bukan-keluarga'}),
    _p('pp-aa-nasab', 'Nasab, waris, dan wali nikah', 'pemohon memahami pengangkatan anak tidak memutus nasab, tidak menjadikan anak ahli waris, dan tidak memindahkan wali nikah', ['dh-khi-171h', 'dh-aa-khi-209', 'dh-aa-khi-wali-nikah']),
    _p('pp-aa-asal-usul-lanjut', 'Pemberitahuan asal-usul dan hubungan dengan orang tua kandung', 'rencana memberi tahu anak asal-usulnya dan menjaga hubungan dengan orang tua kandung', ['dh-pp54-6', 'dh-aa-uu35-40']),
    _p('pp-aa-adat', 'Penyerahan menurut adat kebiasaan', 'penyerahan dilakukan terbuka di hadapan keluarga atau aparat dan diketahui masyarakat', ['dh-uu35-39', 'dh-buku2-2013-17']),
    _p('pp-aa-lingkungan', 'Pengakuan lingkungan', 'anak dikenal lingkungan sebagai anak yang diasuh pemohon', ['dh-uu35-39']),
    _p('pp-aa-sengketa', 'Tidak ada sengketa atas anak', 'tidak ada pihak yang menuntut kembali anak atau menyengketakan pengasuhan', ['dh-buku2-2013-17']),
    _p('pp-aa-pernyataan', 'Pernyataan kepentingan terbaik anak', 'pemohon menyatakan pengangkatan semata-mata demi kepentingan terbaik anak', ['dh-uu35-39', 'dh-pp54-13']),
    _p('pp-aa-kepentingan', 'Rencana masa depan anak', 'rencana pendidikan, kesehatan, dan masa depan anak setelah penetapan', ['dh-uu35-39', 'dh-buku2-2013-17']),
    _p('pp-aa-kesiapan', 'Kesiapan menjadi orang tua angkat', 'kesiapan lahir batin dan pemahaman tanggung jawab sampai anak dewasa', ['dh-pp54-13']),
    _p('pp-aa-kesehatan', 'Surat kesehatan dan catatan kepolisian pemohon', 'pemeriksaan kesehatan jasmani, rohani, bebas narkotika, dan catatan kepolisian pemohon', ['dh-pp54-13']),
    _p('pp-aa-pasca', 'Pelaporan dan pencatatan setelah penetapan', 'kesediaan melapor ke instansi sosial dan mengurus dokumen kependudukan setelah penetapan', ['dh-aa-pp54-pantau']),
]

SPEC = []


def S(**kw):
    kw.setdefault('prefix', 'q-pa-')
    kw.setdefault('bentuk', ('aa',))
    SPEC.append(kw)


# ---------------------------------------------------------------------------------------------------------------------
# Identitas anak
S(id='akta-lahir', pokok='pp-aa-identitas', urut_abs=22, tingkat='pilihan',
  teks='Apakah anak bernama {ANAK} mempunyai akta kelahiran, dan siapa orang tua yang tercantum di dalamnya?',
  varian=['Apakah saksi mengetahui akta kelahiran anak bernama {ANAK} dan nama orang tua yang tertulis di akta itu?'],
  hal='akta kelahiran anak', m='akta kelahiran anak bernama {ANAK}', fam='tahu',
  K=(['anak bernama {ANAK} mempunyai akta kelahiran yang mencantumkan {ORTU} sebagai orang tuanya', 'akta kelahiran anak bernama {ANAK} memuat nama {ORTU} sebagai orang tua anak itu'],
     ['akta kelahiran anak bernama {ANAK} ada dan namanya tertulis sebagai anak dari {ORTU}', 'anak bernama {ANAK} sudah punya akta kelahiran yang menyebut {ORTU} sebagai orang tuanya']),
  P=(['anak bernama {ANAK} sudah mempunyai akta kelahiran', 'akta kelahiran anak bernama {ANAK} sudah ada'],
     ['setahu saya anak bernama {ANAK} punya akta kelahiran', 'anak bernama {ANAK} sudah punya akta kelahiran']),
  A=['akta kelahiran anak bernama {ANAK} mencantumkan {ORTU} sebagai orang tuanya', 'anak bernama {ANAK} tercatat di akta kelahiran sebagai anak dari {ORTU}'],
  B=['akta kelahiran anak bernama {ANAK} belum ada karena belum diurus', 'anak bernama {ANAK} belum mempunyai akta kelahiran karena belum diurus'],
  beda_pada='peristiwa', beda_maksud='versi A: akta kelahiran ada dan memuat nama orang tua kandung; versi B: akta belum diurus - berselisih pada PERISTIWA')

S(id='tempat-lahir', pokok='pp-aa-identitas', urut_abs=23, tingkat='pilihan',
  teks='Di mana dan kapan anak bernama {ANAK} dilahirkan?',
  varian=['Kapan dan di mana anak bernama {ANAK} lahir?'],
  hal='tempat dan tanggal lahir anak', m='tempat dan tanggal lahir anak bernama {ANAK}', fam='tahu',
  K=(['anak bernama {ANAK} dilahirkan di {TTL}', 'tempat dan tanggal lahir anak bernama {ANAK} adalah di {TTL}'],
     ['anak bernama {ANAK} lahir di {TTL}', 'kelahiran anak bernama {ANAK} terjadi di {TTL}']),
  P=(['anak bernama {ANAK} lahir di {TTL}', 'anak bernama {ANAK} dilahirkan di {TTL}'],
     ['setahu saya anak bernama {ANAK} lahir di {TTL}', 'anak bernama {ANAK} dilahirkan di {TTL}']),
  A=['anak bernama {ANAK} lahir di {TTL}', 'anak bernama {ANAK} dilahirkan di {TTL}'],
  B=['anak bernama {ANAK} lahir pada tahun yang berbeda dari yang dimohonkan', 'tanggal lahir anak bernama {ANAK} berbeda dengan yang dimohonkan'],
  beda_pada='waktu', beda_maksud='versi A: sesuai tempat dan tanggal lahir dalam permohonan; versi B: berbeda - berselisih pada WAKTU')

S(id='kk-anak', pokok='pp-aa-identitas', urut_abs=24, tingkat='tambahan',
  teks='Dalam Kartu Keluarga siapa anak bernama {ANAK} tercatat sekarang?',
  varian=['Di Kartu Keluarga mana nama anak bernama {ANAK} tertulis sekarang?'],
  hal='Kartu Keluarga anak', m='Kartu Keluarga anak bernama {ANAK}', fam='tahu',
  K=(['anak bernama {ANAK} masih tercatat dalam Kartu Keluarga {ORTU}', 'nama anak bernama {ANAK} masih tertulis di Kartu Keluarga {ORTU}'],
     ['pada Kartu Keluarga anak bernama {ANAK} sampai sekarang masih tertulis atas nama {ORTU}', 'anak bernama {ANAK} sampai sekarang tercatat di Kartu Keluarga {ORTU}']),
  P=(['anak bernama {ANAK} tercatat dalam Kartu Keluarga orang tua kandungnya', 'nama anak bernama {ANAK} masih ada di Kartu Keluarga orang tua kandungnya'],
     ['setahu saya anak bernama {ANAK} masih dalam Kartu Keluarga orang tua kandungnya', 'anak bernama {ANAK} masih tercatat di Kartu Keluarga orang tua kandungnya']),
  A=['anak bernama {ANAK} masih tercatat dalam Kartu Keluarga orang tua kandungnya', 'nama anak bernama {ANAK} masih ada di Kartu Keluarga orang tua kandungnya'],
  B=['anak bernama {ANAK} sudah dimasukkan ke dalam Kartu Keluarga {PEM}', 'nama anak bernama {ANAK} sudah ditulis di Kartu Keluarga {PEM}'],
  beda_pada='tempat', beda_maksud='versi A: masih di Kartu Keluarga orang tua kandung; versi B: sudah dimasukkan ke Kartu Keluarga pemohon - berselisih pada TEMPAT')

# Keadaan anak dalam asuhan
S(id='kesehatan-anak', pokok='pp-aa-kehidupan', urut_abs=82, tingkat='pilihan',
  teks='Bagaimana kesehatan dan pertumbuhan anak bernama {ANAK} selama diasuh {PEM}?',
  varian=['Selama dalam asuhan {PEM}, bagaimana kesehatan dan tumbuh kembang anak bernama {ANAK}?'],
  hal='kesehatan dan pertumbuhan anak', m='kesehatan dan pertumbuhan anak bernama {ANAK} selama diasuh {PEM}', fam='tahu',
  K=(['anak bernama {ANAK} tumbuh sehat dan dibawa berobat oleh {PEM} bila sakit', 'selama diasuh {PEM} anak bernama {ANAK} sehat dan bila sakit segera dibawa berobat'],
     ['kesehatan anak bernama {ANAK} terjaga baik dan {PEM} membawanya berobat bila sakit', 'pertumbuhan anak bernama {ANAK} baik dan {PEM} segera mengobatinya bila sakit']),
  P=(['anak bernama {ANAK} tampak sehat selama diasuh {PEM}', 'selama diasuh {PEM} anak bernama {ANAK} tampak sehat'],
     ['setahu saya anak bernama {ANAK} sehat selama diasuh {PEM}', 'anak bernama {ANAK} terlihat sehat selama diasuh {PEM}']),
  A=['anak bernama {ANAK} sehat selama diasuh {PEM}', 'selama diasuh {PEM} anak bernama {ANAK} dalam keadaan sehat'],
  B=['anak bernama {ANAK} pernah sakit cukup lama selama diasuh {PEM}', 'selama diasuh {PEM} anak bernama {ANAK} pernah menderita sakit yang cukup lama'],
  beda_pada='peristiwa', beda_maksud='versi A: anak sehat selama diasuh; versi B: pernah sakit cukup lama - berselisih pada PERISTIWA')

S(id='pendidikan-anak', pokok='pp-aa-kehidupan', urut_abs=83, tingkat='pilihan',
  teks='Apakah anak bernama {ANAK} bersekolah, dan siapa yang membiayai pendidikannya?',
  varian=['Bagaimana pendidikan anak bernama {ANAK} sekarang dan siapa yang menanggung biayanya?'],
  hal='pendidikan anak', m='pendidikan anak bernama {ANAK}', fam='tahu',
  K=(['anak bernama {ANAK} bersekolah dan seluruh biayanya ditanggung {PEM}', 'pendidikan anak bernama {ANAK} berjalan dan biaya sekolahnya dibayar {PEM}'],
     ['anak bernama {ANAK} sekolah dengan biaya dari {PEM}', 'biaya sekolah anak bernama {ANAK} ditanggung sepenuhnya oleh {PEM}']),
  P=(['anak bernama {ANAK} bersekolah', 'anak bernama {ANAK} masih bersekolah'],
     ['setahu saya anak bernama {ANAK} bersekolah', 'anak bernama {ANAK} sekolah']),
  A=['anak bernama {ANAK} bersekolah dengan biaya dari {PEM}', 'biaya sekolah anak bernama {ANAK} dibayar {PEM}'],
  B=['sebagian biaya sekolah anak bernama {ANAK} masih dibantu orang tua kandungnya', 'orang tua kandung masih ikut membantu biaya sekolah anak bernama {ANAK}'],
  beda_pada='pelaku', beda_maksud='versi A: biaya sekolah ditanggung pemohon; versi B: masih dibantu orang tua kandung - berselisih pada PELAKU')

S(id='ibadah-anak', pokok='pp-aa-kehidupan', urut_abs=84, tingkat='tambahan',
  teks='Bagaimana pendidikan agama dan ibadah anak bernama {ANAK} di rumah {PEM}?',
  varian=['Apakah di rumah {PEM} anak bernama {ANAK} dibimbing menjalankan ibadah dan belajar agama Islam?'],
  hal='pendidikan agama anak', m='pendidikan agama dan ibadah anak bernama {ANAK}', fam='tahu',
  K=(['anak bernama {ANAK} dibimbing {PEM} menjalankan salat dan belajar mengaji', '{PEM} membimbing anak bernama {ANAK} salat dan mengaji setiap hari'],
     ['di rumah {PEM} anak bernama {ANAK} diajari salat dan membaca Al-Quran', 'anak bernama {ANAK} belajar mengaji dan salat di bawah bimbingan {PEM}']),
  P=(['anak bernama {ANAK} diajari agama oleh {PEM}', '{PEM} mengajari anak bernama {ANAK} agama Islam'],
     ['setahu saya anak bernama {ANAK} diajari agama oleh {PEM}', '{PEM} mengajarkan agama Islam kepada anak bernama {ANAK}']),
  A=['anak bernama {ANAK} belajar mengaji di rumah {PEM}', 'anak bernama {ANAK} mengaji di rumah {PEM}'],
  B=['anak bernama {ANAK} belajar mengaji di surau dekat rumah {PEM}', 'anak bernama {ANAK} mengaji di surau dekat rumah {PEM}'],
  beda_pada='tempat', beda_maksud='versi A: mengaji di rumah pemohon; versi B: di surau - berselisih pada TEMPAT')

S(id='hubungan-batin', pokok='pp-aa-kehidupan', urut_abs=85, tingkat='pilihan',
  teks='Bagaimana hubungan anak bernama {ANAK} dengan {PEM} dan anggota keluarga lainnya di rumah itu?',
  varian=['Apakah anak bernama {ANAK} dekat dan diperlakukan dengan kasih oleh {PEM}?'],
  hal='hubungan batin anak dengan pemohon', m='hubungan batin anak bernama {ANAK} dengan {PEM}', fam='tahu',
  K=(['anak bernama {ANAK} dekat dengan {PEM} dan diperlakukan penuh kasih', '{PEM} mengasihi anak bernama {ANAK} dan anak itu pun dekat dengannya'],
     ['anak bernama {ANAK} merasa nyaman bersama {PEM} yang memperlakukannya dengan penuh kasih', '{PEM} memperlakukan anak bernama {ANAK} dengan kasih dan anak itu akrab dengannya']),
  P=(['anak bernama {ANAK} tampak dekat dengan {PEM}', '{PEM} tampak mengasihi anak bernama {ANAK}'],
     ['setahu saya anak bernama {ANAK} dekat dengan {PEM}', 'anak bernama {ANAK} terlihat akrab dengan {PEM}']),
  A=['anak bernama {ANAK} sangat dekat dengan {PEM}', '{PEM} sangat mengasihi anak bernama {ANAK}'],
  B=['anak bernama {ANAK} lebih dekat dengan salah satu anggota keluarga {PEM}', 'anak bernama {ANAK} lebih akrab dengan salah satu anggota keluarga {PEM}'],
  beda_pada='pelaku', beda_maksud='versi A: sangat dekat dengan pemohon; versi B: lebih dekat dengan anggota keluarga lain - berselisih pada PELAKU')

S(id='persetujuan-anak', pokok='pp-aa-persetujuan-anak', urut_abs=172, tingkat='pilihan',
  teks='Apakah anak bernama {ANAK} bersedia diasuh dan diangkat oleh {PEM}, dan apakah ia sudah ditanya pendapatnya?',
  varian=['Apakah anak bernama {ANAK} menerima {PEM} sebagai orang tua angkatnya?'],
  hal='kesediaan anak', m='kesediaan anak bernama {ANAK} diangkat oleh {PEM}', fam='tahu',
  K=(['anak bernama {ANAK} menerima {PEM} sebagai orang tua angkatnya dan sudah ditanya pendapatnya', 'anak bernama {ANAK} bersedia diangkat oleh {PEM} setelah ditanya pendapatnya'],
     ['pendapat anak bernama {ANAK} sudah ditanyakan dan ia bersedia diangkat oleh {PEM}', 'anak bernama {ANAK} mau diasuh dan diangkat {PEM} setelah ditanya langsung']),
  M=(['anak bernama {ANAK} mau diangkat oleh {PEM}', 'anak bernama {ANAK} bersedia diangkat oleh {PEM}'],
     ['anak bernama {ANAK} menyatakan mau diangkat oleh {PEM}', 'anak bernama {ANAK} menjawab bersedia diangkat oleh {PEM}']),
  P=(['anak bernama {ANAK} tampak menerima {PEM}', 'anak bernama {ANAK} tampak senang bersama {PEM}'],
     ['setahu saya anak bernama {ANAK} menerima {PEM}', 'anak bernama {ANAK} terlihat senang bersama {PEM}']),
  A=['anak bernama {ANAK} sudah ditanya pendapatnya dan bersedia diangkat', 'pendapat anak bernama {ANAK} sudah ditanyakan dan ia bersedia diangkat'],
  B=['anak bernama {ANAK} masih terlalu kecil sehingga pendapatnya belum ditanyakan', 'karena masih terlalu kecil pendapat anak bernama {ANAK} belum ditanyakan'],
  beda_pada='peristiwa', beda_maksud='versi A: pendapat anak sudah ditanyakan; versi B: belum karena masih kecil - berselisih pada PERISTIWA')

# Penyerahan oleh orang tua kandung
S(id='sebab-serah', pokok='pp-aa-penyerahan', urut_abs=167, tingkat='inti', kelompok='pokok',
  teks='Apa alasan {ORTU} menyerahkan anak bernama {ANAK} kepada {PEM} untuk diasuh?',
  varian=['Mengapa {ORTU} menyerahkan pengasuhan anak bernama {ANAK} kepada {PEM}?'],
  hal='alasan penyerahan anak', m='alasan {ORTU} menyerahkan anak bernama {ANAK} kepada {PEM}', fam='tahu',
  K=(['alasan {ORTU} menyerahkan anak bernama {ANAK} kepada {PEM} adalah bahwa #4911#', '{ORTU} menyerahkan anak bernama {ANAK} kepada {PEM} karena #4911#'],
     ['sebab {ORTU} menyerahkan anak bernama {ANAK} kepada {PEM} adalah bahwa #4911#', 'anak bernama {ANAK} diserahkan kepada {PEM} oleh {ORTU} karena #4911#']),
  M=(['{ORTU} menyerahkan anak bernama {ANAK} kepada {PEM} karena #4911#', 'anak bernama {ANAK} diserahkan kepada {PEM} oleh {ORTU} karena #4911#'],
     ['alasan {ORTU} menyerahkan anak bernama {ANAK} kepada {PEM} adalah #4911#', 'penyerahan anak bernama {ANAK} kepada {PEM} oleh {ORTU} disebabkan #4911#']),
  P=(['anak bernama {ANAK} diserahkan kepada {PEM} oleh {ORTU}', '{ORTU} menyerahkan anak bernama {ANAK} kepada {PEM}'],
     ['setahu saya anak bernama {ANAK} diserahkan kepada {PEM} oleh {ORTU}', 'anak bernama {ANAK} diserahkan oleh {ORTU} kepada {PEM}']),
  A=['anak bernama {ANAK} diserahkan karena #4911#', 'penyerahan anak bernama {ANAK} terjadi karena #4911#'],
  B=['anak bernama {ANAK} diserahkan karena orang tua kandungnya merasa tidak sanggup mengurusnya', 'penyerahan anak bernama {ANAK} terjadi karena orang tua kandungnya merasa tidak sanggup mengurusnya'],
  beda_pada='penyebab', beda_maksud='versi A: sebab menurut isian perkara; versi B: orang tua kandung tidak sanggup - berselisih pada PENYEBAB',
  keadaan={'bukan:orangTuaKandung': ['kedua-meninggal', 'tidak-diketahui']})

S(id='surat-serah', pokok='pp-aa-penyerahan', urut_abs=168, tingkat='pilihan',
  teks='Apakah penyerahan anak bernama {ANAK} dibuat secara tertulis, dan siapa yang menyaksikan penyerahan itu?',
  varian=['Adakah surat pernyataan penyerahan anak bernama {ANAK}, dan siapa yang hadir ketika surat itu dibuat?'],
  hal='surat penyerahan anak', m='surat penyerahan anak bernama {ANAK}', fam='tahu',
  K=(['penyerahan anak bernama {ANAK} dibuat dalam surat pernyataan yang ditandatangani {ORTU}', 'surat pernyataan penyerahan anak bernama {ANAK} sudah dibuat dan ditandatangani {ORTU}'],
     ['{ORTU} menandatangani surat pernyataan penyerahan anak bernama {ANAK}', 'ada surat pernyataan penyerahan anak bernama {ANAK} yang diteken {ORTU}']),
  P=(['penyerahan anak bernama {ANAK} dibuat secara tertulis', 'ada surat penyerahan anak bernama {ANAK}'],
     ['setahu saya penyerahan anak bernama {ANAK} dibuat tertulis', 'surat penyerahan anak bernama {ANAK} memang ada']),
  A=['surat penyerahan anak bernama {ANAK} dibuat di hadapan keluarga dua belah pihak', 'penyerahan anak bernama {ANAK} secara tertulis disaksikan keluarga dua belah pihak'],
  B=['surat penyerahan anak bernama {ANAK} dibuat di hadapan aparat desa', 'penyerahan anak bernama {ANAK} secara tertulis disaksikan aparat desa'],
  beda_pada='pelaku', beda_maksud='versi A: disaksikan keluarga kedua pihak; versi B: disaksikan aparat desa - berselisih pada PELAKU')

S(id='ekonomi-ortu', pokok='pp-aa-penyerahan', urut_abs=169, tingkat='tambahan',
  teks='Bagaimana keadaan kehidupan {ORTU} sekarang, dan apakah penyerahan anak bernama {ANAK} itu sudah mereka pikirkan baik-baik?',
  varian=['Apakah {ORTU} menyerahkan anak bernama {ANAK} dengan pertimbangan matang dan tanpa tekanan?'],
  hal='keadaan orang tua kandung dan pertimbangan penyerahan', m='keadaan orang tua kandung dan pertimbangan penyerahan anak bernama {ANAK}', fam='tahu',
  K=(['{ORTU} menyerahkan anak bernama {ANAK} setelah mempertimbangkannya dan tanpa tekanan dari siapa pun', 'penyerahan anak bernama {ANAK} oleh {ORTU} dilakukan setelah dipikirkan matang dan tanpa paksaan'],
     ['{ORTU} sudah memikirkan baik-baik penyerahan anak bernama {ANAK} dan tidak ada yang menekan', 'tidak ada paksaan dalam penyerahan anak bernama {ANAK} sebab {ORTU} telah mempertimbangkannya']),
  P=(['{ORTU} menyerahkan anak bernama {ANAK} dengan rela', 'penyerahan anak bernama {ANAK} oleh {ORTU} dilakukan dengan rela'],
     ['setahu saya {ORTU} menyerahkan anak bernama {ANAK} dengan rela', 'penyerahan anak bernama {ANAK} berlangsung dengan kerelaan {ORTU}']),
  A=['{ORTU} menyerahkan anak bernama {ANAK} tanpa paksaan', 'penyerahan anak bernama {ANAK} oleh {ORTU} berlangsung tanpa paksaan'],
  B=['{ORTU} menyerahkan anak bernama {ANAK} tanpa paksaan setelah berunding dengan keluarga besar', 'penyerahan anak bernama {ANAK} tanpa paksaan itu terjadi setelah {ORTU} berunding dengan keluarga besar'],
  beda_pada='peristiwa', beda_maksud='versi A: penyerahan tanpa paksaan; versi B: tanpa paksaan setelah berunding keluarga besar - berselisih pada PERISTIWA',
  keadaan={'bukan:orangTuaKandung': ['kedua-meninggal', 'tidak-diketahui']})

S(id='tanpa-eksploitasi', pokok='pp-aa-penyerahan', urut_abs=181, tingkat='pilihan',
  teks='Apakah ada kesepakatan uang, barang, atau janji lain dalam penyerahan anak bernama {ANAK}, dan apakah anak itu akan dimanfaatkan untuk kepentingan {PEM}?',
  varian=['Apakah penyerahan anak bernama {ANAK} sama sekali tanpa imbalan dan bukan untuk dimanfaatkan {PEM}?'],
  hal='tidak adanya imbalan dan pemanfaatan anak', m='tidak adanya imbalan dan pemanfaatan anak bernama {ANAK}', fam='tahu',
  K=(['tidak ada imbalan apa pun dalam penyerahan anak bernama {ANAK} dan anak itu tidak dimanfaatkan untuk kepentingan {PEM}', 'penyerahan anak bernama {ANAK} tanpa imbalan sama sekali dan anak itu tidak dipekerjakan atau dimanfaatkan {PEM}'],
     ['tidak ada uang, barang, maupun janji apa pun dalam penyerahan anak bernama {ANAK} dan {PEM} tidak memanfaatkannya', 'penyerahan anak bernama {ANAK} berlangsung tanpa imbalan dan {PEM} tidak memanfaatkan anak itu untuk kepentingan sendiri']),
  P=(['tidak ada imbalan dalam penyerahan anak bernama {ANAK}', 'penyerahan anak bernama {ANAK} tanpa imbalan'],
     ['setahu saya tidak ada imbalan dalam penyerahan anak bernama {ANAK}', 'penyerahan anak bernama {ANAK} tidak disertai imbalan']),
  A=['tidak ada imbalan apa pun dalam penyerahan anak bernama {ANAK}', 'penyerahan anak bernama {ANAK} tanpa imbalan apa pun'],
  B=['{PEM} hanya memberi bantuan biaya hidup kepada orang tua kandung anak bernama {ANAK} tanpa syarat', 'bantuan biaya hidup yang diberikan {PEM} kepada orang tua kandung anak bernama {ANAK} tidak dijadikan syarat'],
  beda_pada='peristiwa', beda_maksud='versi A: tanpa imbalan sama sekali; versi B: ada bantuan biaya hidup tanpa syarat - berselisih pada PERISTIWA')

# Orang tua kandung meninggal / tidak diketahui
S(id='ortu-meninggal', pokok='pp-aa-ortu-meninggal', urut_abs=165, tingkat='inti',
  teks='Kapan dan karena apa orang tua kandung anak bernama {ANAK} meninggal dunia, dan apakah ada surat keterangan kematiannya?',
  varian=['Siapa di antara orang tua kandung anak bernama {ANAK} yang sudah meninggal dunia, dan apakah ada surat keterangan kematiannya?'],
  hal='kematian orang tua kandung anak', m='kematian orang tua kandung anak bernama {ANAK}', fam='tahu',
  K=(['salah satu orang tua kandung anak bernama {ANAK} sudah meninggal dunia dan surat keterangan kematiannya ada', 'orang tua kandung anak bernama {ANAK} yang meninggal dunia itu mempunyai surat keterangan kematian'],
     ['ada surat keterangan kematian orang tua kandung anak bernama {ANAK} yang sudah meninggal dunia', 'orang tua kandung anak bernama {ANAK} sudah meninggal dunia dan keterangan kematiannya tertulis dalam surat']),
  P=(['orang tua kandung anak bernama {ANAK} sudah meninggal dunia', 'salah satu orang tua kandung anak bernama {ANAK} sudah meninggal dunia'],
     ['setahu saya orang tua kandung anak bernama {ANAK} sudah meninggal dunia', 'salah satu orang tua kandung anak bernama {ANAK} sudah wafat']),
  A=['orang tua kandung anak bernama {ANAK} meninggal dunia karena sakit', 'orang tua kandung anak bernama {ANAK} wafat karena sakit'],
  B=['orang tua kandung anak bernama {ANAK} meninggal dunia karena kecelakaan', 'orang tua kandung anak bernama {ANAK} wafat karena kecelakaan'],
  beda_pada='penyebab', beda_maksud='versi A: meninggal karena sakit; versi B: karena kecelakaan - berselisih pada PENYEBAB',
  keadaan={'orangTuaKandung': ['salah-satu-meninggal', 'kedua-meninggal']})

S(id='wali-yatim', pokok='pp-aa-ortu-meninggal', urut_abs=166, tingkat='pilihan',
  teks='Siapa keluarga terdekat anak bernama {ANAK} sesudah orang tua kandungnya meninggal, dan apakah mereka setuju anak itu diangkat {PEM}?',
  varian=['Apakah keluarga terdekat anak bernama {ANAK} yang masih hidup setuju anak itu diasuh dan diangkat {PEM}?'],
  hal='persetujuan keluarga terdekat anak yatim', m='persetujuan keluarga terdekat anak bernama {ANAK} yang orang tua kandungnya sudah meninggal', fam='tahu',
  K=(['keluarga terdekat anak bernama {ANAK} yang masih hidup setuju anak itu diasuh dan diangkat {PEM}', 'keluarga terdekat anak bernama {ANAK} sudah merestui anak itu diasuh dan diangkat {PEM}'],
     ['keluarga dekat anak bernama {ANAK} yang masih ada menyetujui pengasuhan dan pengangkatan anak itu oleh {PEM}', 'keluarga terdekat anak bernama {ANAK} merestui anak itu diangkat {PEM}']),
  P=(['keluarga terdekat anak bernama {ANAK} setuju anak itu diasuh {PEM}', 'keluarga terdekat anak bernama {ANAK} merestui anak itu diasuh {PEM}'],
     ['setahu saya keluarga terdekat anak bernama {ANAK} setuju anak itu diasuh {PEM}', 'keluarga dekat anak bernama {ANAK} merestui anak itu diasuh {PEM}']),
  A=['yang menyetujui anak bernama {ANAK} diangkat adalah kakek dan nenek anak itu', 'kakek dan nenek anak bernama {ANAK} menyetujui anak itu diangkat'],
  B=['yang menyetujui anak bernama {ANAK} diangkat adalah paman dan bibi anak itu', 'paman dan bibi anak bernama {ANAK} menyetujui anak itu diangkat'],
  beda_pada='pelaku', beda_maksud='versi A: kakek dan nenek yang menyetujui; versi B: paman dan bibi - berselisih pada PELAKU',
  keadaan={'orangTuaKandung': 'kedua-meninggal'})

S(id='ditemukan', pokok='pp-aa-asal-tidak-diketahui', urut_abs=163, tingkat='inti',
  teks='Bagaimana anak bernama {ANAK} sampai berada dalam asuhan {PEM}, dan apa yang diketahui tentang orang tua kandungnya?',
  varian=['Dari mana dan bagaimana {PEM} memperoleh anak bernama {ANAK}, serta apa yang diketahui tentang orang tua kandungnya?'],
  hal='asal anak dan orang tua kandung yang tidak diketahui', m='asal anak bernama {ANAK} yang orang tuanya tidak diketahui', fam='tahu',
  K=(['anak bernama {ANAK} sampai berada dalam asuhan {PEM} dengan cara yang terbuka dan orang tua kandungnya tidak diketahui', '{PEM} mengasuh anak bernama {ANAK} yang orang tua kandungnya tidak diketahui sampai sekarang'],
     ['asal anak bernama {ANAK} tidak diketahui dan {PEM} mengasuhnya secara terbuka', 'orang tua kandung anak bernama {ANAK} tidak diketahui siapa dan {PEM} mengasuh anak itu secara terbuka']),
  P=(['orang tua kandung anak bernama {ANAK} tidak diketahui', 'siapa orang tua kandung anak bernama {ANAK} tidak diketahui'],
     ['setahu saya orang tua kandung anak bernama {ANAK} tidak diketahui', 'orang tua kandung anak bernama {ANAK} tidak ada yang tahu']),
  A=['anak bernama {ANAK} ditemukan di depan rumah {PEM}', 'anak bernama {ANAK} didapati di depan rumah {PEM}'],
  B=['anak bernama {ANAK} diserahkan oleh bidan kepada {PEM}', 'anak bernama {ANAK} diberikan oleh bidan kepada {PEM}'],
  beda_pada='peristiwa', beda_maksud='versi A: anak ditemukan di depan rumah pemohon; versi B: diserahkan oleh bidan - berselisih pada PERISTIWA',
  keadaan={'orangTuaKandung': 'tidak-diketahui'})

S(id='upaya-cari-ortu', pokok='pp-aa-asal-tidak-diketahui', urut_abs=164, tingkat='pilihan',
  teks='Upaya apa yang dilakukan {PEM} untuk mencari orang tua kandung anak bernama {ANAK}, termasuk melapor kepada aparat atau instansi sosial?',
  varian=['Apakah {PEM} sudah berusaha mencari orang tua kandung anak bernama {ANAK} dan melapor kepada pihak berwenang?'],
  hal='upaya mencari orang tua kandung', m='upaya mencari orang tua kandung anak bernama {ANAK}', fam='tahu',
  K=(['{PEM} telah mencari orang tua kandung anak bernama {ANAK} dan melaporkannya kepada aparat desa dan instansi sosial', '{PEM} sudah berusaha mencari orang tua kandung anak bernama {ANAK} serta melapor ke aparat desa dan instansi sosial'],
     ['upaya mencari orang tua kandung anak bernama {ANAK} sudah dilakukan {PEM} dan dilaporkan kepada aparat desa dan instansi sosial', 'laporan tentang anak bernama {ANAK} sudah {PEM} sampaikan kepada aparat desa dan instansi sosial disertai usaha mencari orang tua kandungnya']),
  P=(['{PEM} pernah berusaha mencari orang tua kandung anak bernama {ANAK}', '{PEM} sudah berupaya mencari orang tua kandung anak bernama {ANAK}'],
     ['setahu saya {PEM} pernah mencari orang tua kandung anak bernama {ANAK}', '{PEM} pernah mengupayakan pencarian orang tua kandung anak bernama {ANAK}']),
  A=['{PEM} melapor kepada kepolisian tentang anak bernama {ANAK}', '{PEM} membuat laporan ke kepolisian tentang anak bernama {ANAK}'],
  B=['{PEM} melapor kepada kepala desa tentang anak bernama {ANAK}', '{PEM} membuat laporan ke kepala desa tentang anak bernama {ANAK}'],
  beda_pada='tempat', beda_maksud='versi A: lapor ke kepolisian; versi B: lapor ke kepala desa - berselisih pada TEMPAT',
  keadaan={'orangTuaKandung': 'tidak-diketahui'})

# Izin pengasuhan dan laporan sosial
S(id='izin-asuh', pokok='pp-aa-izin-asuh', urut_abs=216, tingkat='pilihan',
  teks='Apakah {PEM} sudah memperoleh izin pengasuhan anak dari dinas sosial untuk mengasuh anak bernama {ANAK}?',
  varian=['Apakah dinas sosial sudah memberikan izin atau rekomendasi kepada {PEM} untuk mengasuh dan mengangkat anak bernama {ANAK}?'],
  hal='izin pengasuhan dari dinas sosial', m='izin pengasuhan dari dinas sosial atas anak bernama {ANAK}', fam='tahu',
  K=(['{PEM} sudah mendapat izin dari dinas sosial untuk mengasuh anak bernama {ANAK} sebagaimana #4913#', 'dinas sosial telah memberikan izin kepada {PEM} untuk mengasuh anak bernama {ANAK} berdasarkan #4913#'],
     ['izin pengasuhan anak bernama {ANAK} dari dinas sosial sudah dimiliki {PEM} yaitu #4913#', '{PEM} memegang izin dinas sosial untuk mengasuh anak bernama {ANAK} yaitu #4913#']),
  P=(['{PEM} sudah mengurus izin pengasuhan anak bernama {ANAK} ke dinas sosial', '{PEM} pernah mengurus izin ke dinas sosial untuk mengasuh anak bernama {ANAK}'],
     ['setahu saya {PEM} sudah mengurus izin ke dinas sosial untuk anak bernama {ANAK}', '{PEM} sudah mengurus izin pengasuhan anak bernama {ANAK} di dinas sosial']),
  A=['izin pengasuhan anak bernama {ANAK} diperoleh {PEM} dari dinas sosial provinsi', 'dinas sosial provinsi mengeluarkan izin pengasuhan anak bernama {ANAK} kepada {PEM}'],
  B=['izin pengasuhan anak bernama {ANAK} diperoleh {PEM} dari dinas sosial kabupaten', 'dinas sosial kabupaten mengeluarkan izin pengasuhan anak bernama {ANAK} kepada {PEM}'],
  beda_pada='tempat', beda_maksud='versi A: izin dari dinas sosial provinsi; versi B: dari dinas sosial kabupaten - berselisih pada TEMPAT',
  keadaan={'izinInstansiSosial': 'berlaku'})

S(id='laporan-sosial', pokok='pp-aa-laporan-sosial', urut_abs=217, tingkat='tambahan',
  teks='Apakah petugas sosial pernah datang ke rumah {PEM} untuk melihat keadaan keluarga dan anak bernama {ANAK}?',
  varian=['Apakah ada kunjungan petugas sosial ke rumah {PEM} untuk menilai keadaan anak bernama {ANAK}?'],
  hal='kunjungan petugas sosial', m='kunjungan petugas sosial ke rumah {PEM}', fam='tahu',
  K=(['petugas sosial pernah datang ke rumah {PEM} dan melihat keadaan anak bernama {ANAK}', 'saya tahu petugas sosial mengunjungi rumah {PEM} untuk menilai keadaan anak bernama {ANAK}'],
     ['kunjungan petugas sosial ke rumah {PEM} pernah terjadi dan keadaan anak bernama {ANAK} diperiksa', 'petugas sosial sudah datang ke rumah {PEM} serta menanyai anak bernama {ANAK}']),
  P=(['petugas sosial pernah datang ke rumah {PEM}', 'rumah {PEM} pernah dikunjungi petugas sosial'],
     ['setahu saya petugas sosial pernah ke rumah {PEM}', 'petugas sosial pernah berkunjung ke rumah {PEM}']),
  A=['petugas sosial datang ke rumah {PEM} satu kali', 'kunjungan petugas sosial ke rumah {PEM} terjadi satu kali'],
  B=['petugas sosial datang ke rumah {PEM} lebih dari satu kali', 'kunjungan petugas sosial ke rumah {PEM} terjadi lebih dari satu kali'],
  beda_pada='jumlah', beda_maksud='versi A: satu kali kunjungan; versi B: lebih dari satu kali - berselisih pada JUMLAH',
  keadaan={'izinInstansiSosial': 'berlaku'})

# Ekonomi dan tempat tinggal
S(id='rumah-tinggal', pokok='pp-aa-ekonomi', urut_abs=131, tingkat='pilihan',
  teks='Bagaimana keadaan rumah tempat tinggal {PEM} dan anak bernama {ANAK}, dan siapa saja yang tinggal di rumah itu?',
  varian=['Apakah rumah {PEM} layak ditinggali anak bernama {ANAK}, dan siapa saja penghuninya?'],
  hal='tempat tinggal pemohon dan anak', m='tempat tinggal {PEM} dan anak bernama {ANAK}', fam='tahu',
  K=(['{PEM} tinggal di rumah yang layak bersama anak bernama {ANAK} dan keluarganya', 'rumah yang ditinggali {PEM} layak dan di situ anak bernama {ANAK} tinggal bersama keluarganya'],
     ['anak bernama {ANAK} tinggal di rumah {PEM} yang layak bersama keluarganya', 'rumah tempat tinggal {PEM} dan anak bernama {ANAK} layak dan dihuni bersama keluarganya']),
  P=(['anak bernama {ANAK} tinggal di rumah {PEM}', 'rumah {PEM} dihuni juga oleh anak bernama {ANAK}'],
     ['setahu saya anak bernama {ANAK} tinggal di rumah {PEM}', 'anak bernama {ANAK} tinggal serumah dengan {PEM}']),
  A=['rumah {PEM} adalah rumah milik sendiri', 'rumah tempat tinggal {PEM} adalah milik sendiri'],
  B=['rumah {PEM} adalah rumah sewa', 'rumah tempat tinggal {PEM} adalah rumah sewa'],
  beda_pada='peristiwa', beda_maksud='versi A: rumah milik sendiri; versi B: rumah sewa - berselisih pada PERISTIWA')

S(id='penghasilan', pokok='pp-aa-ekonomi', urut_abs=132, tingkat='pilihan',
  teks='Berapa penghasilan {PEM} dari pekerjaannya sebagai #0100#, dan apakah cukup untuk kebutuhan keluarga dan anak bernama {ANAK}?',
  varian=['Dari pekerjaan sebagai #0100# berapa penghasilan {PEM}, dan apakah cukup untuk membiayai anak bernama {ANAK}?'],
  hal='penghasilan pemohon', m='penghasilan {PEM} dari pekerjaan sebagai #0100#', fam='tahu',
  K=(['{PEM} bekerja sebagai #0100# dengan penghasilan #4914# yang cukup untuk kebutuhan keluarga dan anak bernama {ANAK}', 'penghasilan {PEM} sebagai #0100# adalah #4914# dan cukup untuk menghidupi keluarga dan anak bernama {ANAK}'],
     ['dari pekerjaan sebagai #0100# {PEM} memperoleh #4914# yang mencukupi keluarga dan anak bernama {ANAK}', '{PEM} berpenghasilan #4914# dari pekerjaan sebagai #0100# dan itu cukup bagi keluarga dan anak bernama {ANAK}']),
  P=(['{PEM} bekerja sebagai #0100# dan penghasilannya cukup', 'pekerjaan {PEM} sebagai #0100# memberi penghasilan yang cukup'],
     ['setahu saya {PEM} bekerja sebagai #0100# dan hasilnya cukup', '{PEM} bekerja sebagai #0100# dan hasilnya mencukupi']),
  A=['penghasilan {PEM} dari pekerjaan sebagai #0100# tetap setiap bulan', 'dari pekerjaan sebagai #0100# {PEM} menerima penghasilan tetap setiap bulan'],
  B=['penghasilan {PEM} dari pekerjaan sebagai #0100# tidak tetap setiap bulan', 'dari pekerjaan sebagai #0100# {PEM} menerima penghasilan yang tidak tetap setiap bulan'],
  beda_pada='jumlah', beda_maksud='versi A: penghasilan tetap tiap bulan; versi B: tidak tetap - berselisih pada JUMLAH')

S(id='biaya-anak', pokok='pp-aa-ekonomi', urut_abs=133, tingkat='pilihan',
  teks='Bagaimana {PEM} mencukupi biaya makan, sekolah, dan kesehatan anak bernama {ANAK} selama ini?',
  varian=['Dari mana {PEM} membiayai makan, sekolah, dan pengobatan anak bernama {ANAK}?'],
  hal='pembiayaan kebutuhan anak', m='pembiayaan kebutuhan anak bernama {ANAK} oleh {PEM}', fam='tahu',
  K=(['{PEM} membiayai makan, sekolah, dan kesehatan anak bernama {ANAK} dari penghasilannya sendiri', 'biaya makan, sekolah, dan pengobatan anak bernama {ANAK} dipenuhi {PEM} dari hasil kerjanya'],
     ['kebutuhan makan, sekolah, dan kesehatan anak bernama {ANAK} selalu dipenuhi {PEM} dari penghasilannya', '{PEM} menanggung biaya makan, sekolah, dan berobat anak bernama {ANAK} dari hasil kerjanya sendiri']),
  P=(['{PEM} memenuhi kebutuhan anak bernama {ANAK}', 'kebutuhan anak bernama {ANAK} dipenuhi oleh {PEM}'],
     ['setahu saya {PEM} memenuhi kebutuhan anak bernama {ANAK}', 'kebutuhan sehari-hari anak bernama {ANAK} dipenuhi {PEM}']),
  A=['{PEM} menanggung seluruh biaya anak bernama {ANAK}', 'seluruh biaya anak bernama {ANAK} ditanggung {PEM}'],
  B=['{PEM} dibantu keluarga dalam menanggung biaya anak bernama {ANAK}', 'keluarga ikut membantu {PEM} menanggung biaya anak bernama {ANAK}'],
  beda_pada='pelaku', beda_maksud='versi A: seluruhnya ditanggung pemohon; versi B: dibantu keluarga - berselisih pada PELAKU')

# Perkawinan dan pasangan
S(id='riwayat-kawin', pokok='pp-aa-pasangan', urut_abs=141, tingkat='inti',
  teks='Kapan {PEM} menikah, apakah pernikahan itu tercatat, dan apakah masih berlangsung sampai sekarang?',
  varian=['Bagaimana riwayat pernikahan {PEM}, apakah tercatat resmi dan masih utuh sampai sekarang?'],
  hal='riwayat perkawinan pemohon', m='riwayat perkawinan {PEM}', fam='tahu',
  K=(['pernikahan {PEM} #4912# dan sampai sekarang rumah tangga mereka masih utuh', 'riwayat pernikahan {PEM} adalah bahwa #4912# dan rumah tangganya masih utuh sampai sekarang'],
     ['menurut yang saya alami sendiri pernikahan {PEM} #4912# dan masih berlangsung sampai sekarang', 'pernikahan {PEM} yang #4912# masih bertahan dan rumah tangganya rukun sampai sekarang']),
  P=(['{PEM} adalah suami istri yang masih utuh rumah tangganya', 'rumah tangga {PEM} sebagai suami istri masih utuh'],
     ['setahu saya {PEM} masih sebagai suami istri', 'sampai sekarang {PEM} masih hidup sebagai suami istri']),
  A=['pernikahan {PEM} sudah tercatat resmi di Kantor Urusan Agama', 'pernikahan {PEM} dicatat resmi oleh Kantor Urusan Agama'],
  B=['pernikahan {PEM} dicatat resmi oleh Kantor Urusan Agama dan buku nikahnya dipegang istri', 'pernikahan {PEM} sudah tercatat resmi dan buku nikahnya dipegang istri'],
  beda_pada='tempat', beda_maksud='versi A: tercatat di Kantor Urusan Agama; versi B: tercatat dan buku nikah dipegang istri - berselisih pada TEMPAT',
  keadaan={'pemohonPerkawinan': 'berdua'})

S(id='setuju-pasangan', pokok='pp-aa-pasangan', urut_abs=142, tingkat='pilihan',
  teks='Apakah {PEM} sebagai suami istri sama-sama sepakat mengangkat anak bernama {ANAK} dan sama-sama mengasihinya?',
  varian=['Apakah {PEM} satu hati dalam mengasuh dan mengangkat anak bernama {ANAK}?'],
  hal='kesepakatan suami istri', m='kesepakatan suami istri mengangkat anak bernama {ANAK}', fam='tahu',
  K=(['{PEM} sama-sama sepakat mengangkat anak bernama {ANAK} dan sama-sama menyayanginya', '{PEM} sebagai suami istri sepakat mengangkat anak bernama {ANAK} dan sama-sama menyayangi anak itu'],
     ['{PEM} satu hati mengangkat anak bernama {ANAK} dan sama-sama menyayanginya', 'suami istri yang mengajukan permohonan itu, yaitu {PEM}, bersepakat mengangkat anak bernama {ANAK} dan sama-sama menyayanginya']),
  P=(['{PEM} sepakat mengangkat anak bernama {ANAK}', '{PEM} sebagai suami istri sepakat mengangkat anak bernama {ANAK}'],
     ['setahu saya {PEM} sepakat mengangkat anak bernama {ANAK}', '{PEM} sebagai suami istri bersepakat mengangkat anak bernama {ANAK}']),
  A=['suami dan istri sama-sama menginginkan anak bernama {ANAK} diangkat', 'keinginan mengangkat anak bernama {ANAK} datang dari suami dan istri sekaligus'],
  B=['keinginan mengangkat anak bernama {ANAK} datang lebih dulu dari pihak istri', 'pihak istri lebih dulu menginginkan anak bernama {ANAK} diangkat'],
  beda_pada='pelaku', beda_maksud='versi A: keinginan datang dari keduanya; versi B: lebih dulu dari istri - berselisih pada PELAKU',
  keadaan={'pemohonPerkawinan': 'berdua'})

S(id='status-sendiri', pokok='pp-aa-tunggal', urut_abs=143, tingkat='inti',
  teks='Mengapa {PEM} mengajukan permohonan seorang diri, dan bagaimana status perkawinannya sekarang?',
  varian=['Apa status perkawinan {PEM} sekarang, dan mengapa ia mengajukan permohonan sendirian?'],
  hal='status perkawinan pemohon yang seorang diri', m='status perkawinan {PEM} yang mengajukan permohonan seorang diri', fam='tahu',
  K=(['{PEM} berstatus #8622# dan mengajukan permohonan seorang diri', 'status perkawinan {PEM} sekarang adalah #8622# sehingga permohonan diajukan seorang diri'],
     ['sekarang {PEM} #8622# karena itu permohonan ini diajukan sendirian', '{PEM} berstatus #8622# dan itulah sebabnya ia mengajukan permohonan sendirian']),
  P=(['{PEM} berstatus #8622# sekarang', 'status {PEM} sekarang adalah #8622#'],
     ['setahu saya {PEM} sekarang #8622#', '{PEM} saat ini #8622#']),
  A=['{PEM} berstatus #8622# sejak beberapa tahun lalu', 'status {PEM} sebagai #8622# sudah berlangsung beberapa tahun'],
  B=['{PEM} berstatus #8622# sejak baru-baru ini', 'status {PEM} sebagai #8622# baru berlangsung belakangan ini'],
  beda_pada='lama', beda_maksud='versi A: status itu sudah beberapa tahun; versi B: baru-baru ini - berselisih pada LAMA',
  keadaan={'pemohonPerkawinan': 'sendiri'})

S(id='pembantu-asuh', pokok='pp-aa-tunggal', urut_abs=144, tingkat='pilihan',
  teks='Siapa yang membantu {PEM} mengasuh anak bernama {ANAK} sehari-hari ketika sedang bekerja?',
  varian=['Kalau {PEM} sedang bekerja, siapa yang menjaga anak bernama {ANAK}?'],
  hal='orang yang membantu mengasuh anak', m='orang yang membantu {PEM} mengasuh anak bernama {ANAK}', fam='tahu',
  K=(['saat {PEM} bekerja anak bernama {ANAK} dijaga oleh anggota keluarganya yang tinggal serumah', 'anak bernama {ANAK} dijaga anggota keluarga {PEM} yang serumah ketika bekerja'],
     ['ketika {PEM} bekerja yang menjaga anak bernama {ANAK} adalah keluarganya yang tinggal bersama', 'anggota keluarga {PEM} yang serumah menjaga anak bernama {ANAK} selama bekerja']),
  P=(['anak bernama {ANAK} dijaga oleh keluarga {PEM}', 'keluarga {PEM} membantu menjaga anak bernama {ANAK}'],
     ['setahu saya keluarga {PEM} membantu menjaga anak bernama {ANAK}', 'anak bernama {ANAK} dibantu dijaga keluarga {PEM}']),
  A=['anak bernama {ANAK} dijaga oleh ibu {PEM} ketika bekerja', 'ibu {PEM} yang menjaga anak bernama {ANAK} ketika bekerja'],
  B=['anak bernama {ANAK} dijaga oleh saudara {PEM} ketika bekerja', 'saudara {PEM} yang menjaga anak bernama {ANAK} ketika bekerja'],
  beda_pada='pelaku', beda_maksud='versi A: dijaga ibu pemohon; versi B: dijaga saudara pemohon - berselisih pada PELAKU',
  keadaan={'pemohonPerkawinan': 'sendiri'})

S(id='anak-kandung-ada', pokok='pp-aa-anak-kandung', urut_abs=151, tingkat='pilihan',
  teks='Berapa anak kandung {PEM} sekarang, dan bagaimana sikap mereka terhadap anak bernama {ANAK}?',
  varian=['Apakah anak-anak kandung {PEM} menerima kehadiran anak bernama {ANAK} di rumah mereka?'],
  hal='anak kandung pemohon dan sikap mereka', m='anak kandung {PEM} dan sikapnya terhadap anak bernama {ANAK}', fam='tahu',
  K=(['{PEM} mempunyai anak kandung #4912# dan mereka menerima anak bernama {ANAK} seperti saudara sendiri', 'anak kandung {PEM} yang #4912# menerima anak bernama {ANAK} sebagai saudara'],
     ['anak-anak kandung {PEM} yang #4912# menyayangi anak bernama {ANAK} seperti saudara sendiri', 'keadaan anak kandung {PEM} adalah #4912# dan mereka akrab dengan anak bernama {ANAK}']),
  P=(['anak kandung {PEM} menerima anak bernama {ANAK}', 'anak kandung {PEM} akrab dengan anak bernama {ANAK}'],
     ['setahu saya anak kandung {PEM} menerima anak bernama {ANAK}', 'anak kandung {PEM} bergaul baik dengan anak bernama {ANAK}']),
  A=['anak kandung {PEM} sering bermain bersama anak bernama {ANAK}', 'anak kandung {PEM} sering bermain dengan anak bernama {ANAK}'],
  B=['anak kandung {PEM} sering belajar bersama anak bernama {ANAK}', 'anak kandung {PEM} sering belajar dengan anak bernama {ANAK}'],
  beda_pada='peristiwa', beda_maksud='versi A: sering bermain bersama; versi B: sering belajar bersama - berselisih pada PERISTIWA',
  keadaan={'anakKandungPemohon': 'ada'})

S(id='anak-kandung-belum', pokok='pp-aa-anak-kandung', urut_abs=152, tingkat='pilihan',
  teks='Apakah {PEM} belum mempunyai anak kandung, dan apa yang sudah diusahakan untuk memperoleh keturunan?',
  varian=['Mengapa {PEM} belum mempunyai anak kandung, dan apakah sudah berusaha memperoleh keturunan?'],
  hal='belum adanya anak kandung pemohon', m='belum adanya anak kandung {PEM}', fam='tahu',
  K=(['{PEM} belum dikaruniai anak kandung dan sudah berusaha memperoleh keturunan', 'sampai sekarang {PEM} belum mempunyai anak kandung walaupun sudah berusaha'],
     ['belum ada anak kandung {PEM} padahal sudah ada usaha untuk mendapat keturunan', '{PEM} belum dikaruniai keturunan walau telah berikhtiar']),
  P=(['{PEM} belum mempunyai anak kandung', '{PEM} belum dikaruniai anak kandung'],
     ['setahu saya {PEM} belum mempunyai anak kandung', 'sejauh yang saya tahu {PEM} belum punya anak kandung']),
  A=['{PEM} sudah memeriksakan diri ke dokter untuk memperoleh keturunan', '{PEM} sudah berobat ke dokter untuk memperoleh keturunan'],
  B=['{PEM} sudah berobat kepada tabib untuk memperoleh keturunan', '{PEM} sudah berobat tradisional untuk memperoleh keturunan'],
  beda_pada='peristiwa', beda_maksud='versi A: berobat ke dokter; versi B: berobat tradisional - berselisih pada PERISTIWA',
  keadaan={'anakKandungPemohon': 'belum-ada'})

S(id='keluarga-menerima', pokok='pp-aa-keluarga', urut_abs=191, tingkat='tambahan',
  teks='Bagaimana sikap keluarga besar {PEM} terhadap kehadiran anak bernama {ANAK} di rumahnya?',
  varian=['Apakah keluarga besar {PEM} menerima anak bernama {ANAK} sebagai bagian dari keluarga?'],
  hal='sikap keluarga besar pemohon', m='sikap keluarga besar {PEM} terhadap anak bernama {ANAK}', fam='tahu',
  K=(['keluarga besar {PEM} menerima anak bernama {ANAK} sebagai bagian dari keluarga', 'anak bernama {ANAK} diterima baik oleh keluarga besar {PEM}'],
     ['semua keluarga besar {PEM} menerima anak bernama {ANAK} dengan baik', 'keluarga besar {PEM} menyambut anak bernama {ANAK} dengan baik']),
  P=(['keluarga besar {PEM} menerima anak bernama {ANAK}', 'anak bernama {ANAK} diterima oleh keluarga besar {PEM}'],
     ['setahu saya keluarga besar {PEM} menerima anak bernama {ANAK}', 'keluarga besar {PEM} menyambut anak bernama {ANAK}']),
  A=['kedua orang tua {PEM} menyambut anak bernama {ANAK} dengan baik', 'orang tua {PEM} menyambut anak bernama {ANAK} dengan baik'],
  B=['saudara-saudara {PEM} menyambut anak bernama {ANAK} dengan baik', 'saudara kandung {PEM} menyambut anak bernama {ANAK} dengan baik'],
  beda_pada='pelaku', beda_maksud='versi A: orang tua pemohon yang menyambut; versi B: saudara pemohon - berselisih pada PELAKU')

# Hubungan keluarga / bukan keluarga
S(id='hubungan-darah', pokok='pp-aa-hubungan-darah', urut_abs=61, tingkat='inti',
  teks='Siapa {ORTU} dalam hubungan keluarga dengan {PEM}, dan sejak kapan anak bernama {ANAK} dekat dengan {PEM}?',
  varian=['Apa hubungan kerabat antara {PEM} dengan {ORTU}, dan sejak kapan anak bernama {ANAK} akrab dengan {PEM}?'],
  hal='hubungan kerabat pemohon dengan orang tua kandung anak', m='hubungan kerabat {PEM} dengan {ORTU}', fam='tahu',
  K=(['{PEM} adalah #8623# dari anak bernama {ANAK} dan anak itu dekat dengan {PEM} sejak #4910#', 'hubungan kerabat {PEM} dengan anak bernama {ANAK} adalah sebagai #8623# dan sejak #4910# anak itu dekat dengan {PEM}'],
     ['{PEM} masih kerabat anak bernama {ANAK} yaitu sebagai #8623# dan anak itu akrab dengan {PEM} sejak #4910#', 'dalam keluarga {PEM} adalah #8623# anak bernama {ANAK} dan sejak #4910# anak itu akrab dengan {PEM}']),
  P=(['{PEM} adalah #8623# dari anak bernama {ANAK}', 'hubungan {PEM} dengan anak bernama {ANAK} adalah sebagai #8623#'],
     ['setahu saya {PEM} adalah #8623# dari anak bernama {ANAK}', '{PEM} masih kerabat anak bernama {ANAK} sebagai #8623#']),
  A=['{PEM} adalah kerabat dari pihak ayah anak bernama {ANAK}', '{PEM} masih keluarga dari pihak ayah anak bernama {ANAK}'],
  B=['{PEM} adalah kerabat dari pihak ibu anak bernama {ANAK}', '{PEM} masih keluarga dari pihak ibu anak bernama {ANAK}'],
  beda_pada='pelaku', beda_maksud='versi A: kerabat dari pihak ayah; versi B: kerabat dari pihak ibu - berselisih pada PELAKU',
  keadaan={'hubunganPemohon': 'keluarga'})

S(id='kenal-bukan-kerabat', pokok='pp-aa-bukan-keluarga', urut_abs=62, tingkat='inti',
  teks='Bagaimana {PEM} pertama kali mengenal anak bernama {ANAK}, dan mengapa {PEM} memilih anak itu untuk diangkat padahal bukan kerabat?',
  varian=['Dari mana {PEM} mengenal anak bernama {ANAK}, dan apa sebabnya {PEM} memilih anak itu untuk diangkat?'],
  hal='cara pemohon mengenal anak yang bukan kerabat', m='cara {PEM} mengenal anak bernama {ANAK} yang bukan kerabat', fam='tahu',
  K=(['{PEM} bukan kerabat anak bernama {ANAK} dan mengenal anak itu sejak #4910# lalu timbul rasa kasih untuk mengangkatnya', '{PEM} tidak ada hubungan keluarga dengan anak bernama {ANAK} dan mulai mengenalnya sejak #4910# hingga ingin mengangkatnya'],
     ['anak bernama {ANAK} bukan kerabat {PEM} tetapi sejak #4910# anak itu dikenal dan dikasihi hingga ingin diangkat', 'tidak ada pertalian darah antara {PEM} dan anak bernama {ANAK} namun sejak #4910# anak itu dikasihi hingga ingin diangkat']),
  P=(['{PEM} bukan kerabat anak bernama {ANAK}', '{PEM} tidak ada hubungan keluarga dengan anak bernama {ANAK}'],
     ['setahu saya {PEM} bukan keluarga anak bernama {ANAK}', 'anak bernama {ANAK} bukan kerabat {PEM}']),
  A=['{PEM} mengenal anak bernama {ANAK} melalui tetangga', '{PEM} berkenalan dengan anak bernama {ANAK} melalui tetangga'],
  B=['{PEM} mengenal anak bernama {ANAK} melalui tempat kerja', '{PEM} berkenalan dengan anak bernama {ANAK} melalui tempat kerja'],
  beda_pada='tempat', beda_maksud='versi A: mengenal anak melalui tetangga; versi B: melalui tempat kerja - berselisih pada TEMPAT',
  keadaan={'hubunganPemohon': 'bukan-keluarga'})

S(id='nasab-tetap', pokok='pp-aa-nasab', urut_abs=201, tingkat='pilihan',
  teks='Apakah {PEM} mengerti bahwa anak bernama {ANAK} tetap anak kandung {ORTU} dan namanya tetap dinasabkan kepada ayah kandungnya?',
  varian=['Apakah {PEM} paham bahwa pengangkatan anak tidak memutus hubungan darah dan nasab anak bernama {ANAK} dengan {ORTU}?'],
  hal='pemahaman pemohon tentang nasab anak', m='pemahaman {PEM} bahwa nasab anak bernama {ANAK} tidak terputus', fam='tahu',
  K=(['{PEM} mengerti bahwa anak bernama {ANAK} tetap anak kandung {ORTU} dan nasabnya tidak terputus', '{PEM} paham pengangkatan ini tidak memutus nasab anak bernama {ANAK} dengan {ORTU}'],
     ['{PEM} sadar nasab anak bernama {ANAK} tidak terputus dari {ORTU}', '{PEM} telah menyatakan paham bahwa nasab anak bernama {ANAK} tidak berpindah dari {ORTU}']),
  P=(['{PEM} mengerti bahwa anak bernama {ANAK} tetap anak kandung {ORTU}', '{PEM} paham anak bernama {ANAK} tetap anak kandung {ORTU}'],
     ['setahu saya {PEM} mengerti anak bernama {ANAK} tetap anak kandung {ORTU}', '{PEM} sadar anak bernama {ANAK} tetap anak kandung {ORTU}']),
  A=['{PEM} berniat tetap menyebut nama ayah kandung di belakang nama anak bernama {ANAK}', '{PEM} akan tetap memakai nama ayah kandung di belakang nama anak bernama {ANAK}'],
  B=['{PEM} berniat menambahkan nama {PEM} di belakang nama anak bernama {ANAK}', '{PEM} akan menambahkan nama {PEM} di belakang nama anak bernama {ANAK}'],
  beda_pada='peristiwa', beda_maksud='versi A: nama ayah kandung tetap dipakai; versi B: nama pemohon akan ditambahkan - berselisih pada PERISTIWA')

S(id='waris-wasiat', pokok='pp-aa-nasab', urut_abs=202, tingkat='tambahan',
  teks='Apakah {PEM} mengerti bahwa anak bernama {ANAK} tidak otomatis menjadi ahli waris, tetapi dapat diberi wasiat?',
  varian=['Apakah {PEM} memahami akibat pengangkatan anak terhadap hak waris anak bernama {ANAK}?'],
  hal='pemahaman pemohon tentang hak waris anak angkat', m='pemahaman {PEM} tentang hak waris anak bernama {ANAK}', fam='tahu',
  K=(['{PEM} mengerti bahwa anak bernama {ANAK} tidak otomatis menjadi ahli waris {PEM} dan hanya dapat diberi wasiat', '{PEM} paham anak bernama {ANAK} bukan ahli waris {PEM} tetapi dapat menerima wasiat'],
     ['{PEM} sudah menyadari bahwa anak bernama {ANAK} tidak otomatis menjadi ahli waris {PEM} dan dapat diberi wasiat', '{PEM} tahu pengangkatan ini tidak menjadikan anak bernama {ANAK} ahli waris {PEM} dan hanya dapat diberi wasiat']),
  P=(['{PEM} mengerti bahwa anak bernama {ANAK} tidak otomatis menjadi ahli waris', '{PEM} paham bahwa anak bernama {ANAK} tidak otomatis menjadi ahli waris'],
     ['setahu saya {PEM} mengerti anak bernama {ANAK} tidak otomatis menjadi ahli waris', '{PEM} sudah paham anak bernama {ANAK} tidak otomatis menjadi ahli waris']),
  A=['{PEM} berniat memberikan wasiat kepada anak bernama {ANAK} kelak', '{PEM} berencana membuat wasiat untuk anak bernama {ANAK} kelak'],
  B=['{PEM} belum berpikir tentang wasiat untuk anak bernama {ANAK}', 'wasiat untuk anak bernama {ANAK} belum dipikirkan {PEM}'],
  beda_pada='peristiwa', beda_maksud='versi A: pemohon berniat memberi wasiat; versi B: belum memikirkan wasiat - berselisih pada PERISTIWA')

S(id='wali-nikah', pokok='pp-aa-nasab', urut_abs=203, tingkat='jarang',
  teks='Apakah {PEM} mengerti bahwa wali nikah anak bernama {ANAK} kelak adalah wali nasabnya dan bukan {PEM}?',
  varian=['Apakah {PEM} paham bahwa kedudukan wali nikah anak bernama {ANAK} tidak berpindah kepada {PEM}?'],
  hal='pemahaman pemohon tentang wali nikah anak', m='pemahaman {PEM} tentang wali nikah anak bernama {ANAK}', fam='tahu',
  K=(['{PEM} mengerti bahwa wali nikah anak bernama {ANAK} kelak adalah wali nasabnya', '{PEM} paham yang menjadi wali nikah anak bernama {ANAK} kelak adalah wali nasabnya'],
     ['{PEM} sudah sadar bahwa urusan wali nikah anak bernama {ANAK} nanti ada pada wali nasabnya', '{PEM} tahu wali nikah anak bernama {ANAK} kelak tetap wali nasabnya']),
  P=(['{PEM} mengerti soal wali nikah anak bernama {ANAK}', '{PEM} paham soal wali nikah anak bernama {ANAK}'],
     ['setahu saya {PEM} mengerti soal wali nikah anak bernama {ANAK}', '{PEM} sudah paham soal wali nikah anak bernama {ANAK}']),
  A=['{PEM} bersedia menghubungi ayah kandung bila anak bernama {ANAK} kelak menikah', '{PEM} akan memberi kabar kepada ayah kandung bila anak bernama {ANAK} kelak menikah'],
  B=['{PEM} bersedia menghubungi keluarga ayah kandung bila anak bernama {ANAK} kelak menikah', '{PEM} akan memberi kabar kepada keluarga ayah kandung bila anak bernama {ANAK} kelak menikah'],
  beda_pada='pelaku', beda_maksud='versi A: akan menghubungi ayah kandung; versi B: menghubungi keluarga ayah kandung - berselisih pada PELAKU')

S(id='hubungan-ortu-kandung', pokok='pp-aa-asal-usul-lanjut', urut_abs=205, tingkat='pilihan',
  teks='Apakah {PEM} akan membiarkan anak bernama {ANAK} tetap bertemu dan berhubungan dengan {ORTU}, dan kapan berencana memberi tahu asal-usulnya?',
  varian=['Apakah {PEM} bersedia menjaga hubungan anak bernama {ANAK} dengan {ORTU} dan memberi tahu asal-usulnya pada waktunya?'],
  hal='hubungan anak dengan orang tua kandung', m='hubungan anak bernama {ANAK} dengan {ORTU}', fam='tahu',
  K=(['{PEM} bersedia membiarkan anak bernama {ANAK} tetap berhubungan dengan {ORTU} dan akan memberi tahu asal-usulnya pada waktu yang tepat', '{PEM} mengizinkan anak bernama {ANAK} bertemu {ORTU} dan akan memberi tahu asal-usulnya bila anak itu sudah siap'],
     ['anak bernama {ANAK} tetap boleh bertemu {ORTU} dan {PEM} akan memberi tahu asal-usulnya pada saatnya', '{PEM} menjaga hubungan anak bernama {ANAK} dengan {ORTU} dan akan menjelaskan asal-usulnya bila waktunya tepat']),
  P=(['{PEM} mengizinkan anak bernama {ANAK} bertemu {ORTU}', '{PEM} membolehkan anak bernama {ANAK} bertemu {ORTU}'],
     ['setahu saya {PEM} mengizinkan anak bernama {ANAK} bertemu {ORTU}', '{PEM} masih membolehkan anak bernama {ANAK} bertemu {ORTU}']),
  A=['anak bernama {ANAK} sering bertemu {ORTU} pada hari libur', 'pada hari libur anak bernama {ANAK} sering bertemu {ORTU}'],
  B=['anak bernama {ANAK} jarang bertemu {ORTU} karena tinggal berjauhan', 'karena tinggal berjauhan anak bernama {ANAK} jarang bertemu {ORTU}'],
  beda_pada='jumlah', beda_maksud='versi A: sering bertemu; versi B: jarang bertemu - berselisih pada JUMLAH',
  keadaan={'bukan:orangTuaKandung': ['kedua-meninggal', 'tidak-diketahui']})

S(id='tradisi-penyerahan', pokok='pp-aa-adat', urut_abs=171, tingkat='tambahan',
  teks='Apakah penyerahan anak bernama {ANAK} kepada {PEM} dilakukan secara terbuka di hadapan keluarga atau aparat desa dan diketahui masyarakat?',
  varian=['Apakah warga sekitar dan aparat desa mengetahui anak bernama {ANAK} diserahkan untuk diasuh {PEM}?'],
  hal='keterbukaan penyerahan anak', m='keterbukaan penyerahan anak bernama {ANAK} kepada {PEM}', fam='tahu',
  K=(['penyerahan anak bernama {ANAK} kepada {PEM} dilakukan terbuka dan diketahui warga sekitar', 'warga sekitar dan keluarga mengetahui penyerahan anak bernama {ANAK} kepada {PEM}'],
     ['penyerahan anak bernama {ANAK} kepada {PEM} berlangsung terang-terangan dan diketahui masyarakat setempat', 'masyarakat setempat tahu bahwa anak bernama {ANAK} diserahkan kepada {PEM} secara terbuka']),
  P=(['penyerahan anak bernama {ANAK} kepada {PEM} diketahui warga', 'warga mengetahui penyerahan anak bernama {ANAK} kepada {PEM}'],
     ['setahu saya penyerahan anak bernama {ANAK} kepada {PEM} diketahui warga', 'warga sekitar tahu anak bernama {ANAK} diserahkan kepada {PEM}']),
  A=['penyerahan anak bernama {ANAK} dihadiri keluarga dan tokoh masyarakat', 'keluarga dan tokoh masyarakat hadir dalam penyerahan anak bernama {ANAK}'],
  B=['penyerahan anak bernama {ANAK} dihadiri keluarga dan aparat desa', 'keluarga dan aparat desa hadir dalam penyerahan anak bernama {ANAK}'],
  beda_pada='pelaku', beda_maksud='versi A: dihadiri tokoh masyarakat; versi B: dihadiri aparat desa - berselisih pada PELAKU')

S(id='dikenal-lingkungan', pokok='pp-aa-lingkungan', urut_abs=192, tingkat='tambahan',
  teks='Sebagai apa warga sekitar mengenal anak bernama {ANAK} di lingkungan tempat tinggal {PEM}?',
  varian=['Bagaimana warga sekitar mengenal anak bernama {ANAK}, apakah sebagai anak yang diasuh {PEM}?'],
  hal='pengakuan lingkungan atas anak', m='pengenalan warga sekitar atas anak bernama {ANAK}', fam='tahu',
  K=(['warga sekitar mengenal anak bernama {ANAK} sebagai anak yang diasuh {PEM}', 'di lingkungan itu anak bernama {ANAK} dikenal sebagai anak asuh {PEM}'],
     ['tetangga mengenal anak bernama {ANAK} sebagai anak yang dirawat {PEM}', 'warga setempat tahu anak bernama {ANAK} adalah anak asuh {PEM}']),
  P=(['warga mengenal anak bernama {ANAK} sebagai anak asuh {PEM}', 'anak bernama {ANAK} dikenal warga sebagai anak asuh {PEM}'],
     ['setahu saya warga mengenal anak bernama {ANAK} sebagai anak asuh {PEM}', 'anak bernama {ANAK} dikenal warga sebagai anak yang dirawat {PEM}']),
  A=['warga mengenal anak bernama {ANAK} sebagai kemenakan {PEM}', 'anak bernama {ANAK} dikenal warga sebagai kemenakan {PEM}'],
  B=['warga mengenal anak bernama {ANAK} sebagai anak angkat {PEM}', 'anak bernama {ANAK} dikenal warga sebagai anak angkat {PEM}'],
  beda_pada='peristiwa', beda_maksud='versi A: dikenal sebagai kemenakan; versi B: dikenal sebagai anak angkat - berselisih pada PERISTIWA')

S(id='tanpa-sengketa', pokok='pp-aa-sengketa', urut_abs=193, tingkat='pilihan',
  teks='Apakah pernah ada pihak yang menuntut anak bernama {ANAK} dikembalikan atau mempersoalkan pengasuhan {PEM}?',
  varian=['Apakah selama ini ada pihak yang menyengketakan pengasuhan anak bernama {ANAK} oleh {PEM}?'],
  hal='tidak adanya sengketa atas anak', m='tidak adanya sengketa atas pengasuhan anak bernama {ANAK}', fam='tahu',
  K=(['tidak pernah ada pihak yang menuntut anak bernama {ANAK} dikembalikan atau mempersoalkan pengasuhan {PEM}', 'sampai sekarang tidak ada pihak yang menyengketakan pengasuhan {PEM} atas anak bernama {ANAK}'],
     ['tidak ada seorang pun yang meminta anak bernama {ANAK} kembali atau mempermasalahkan pengasuhan {PEM}', 'pengasuhan {PEM} atas anak bernama {ANAK} tidak pernah dipersengketakan siapa pun']),
  P=(['tidak ada pihak yang mempersoalkan pengasuhan {PEM} atas anak bernama {ANAK}', 'pengasuhan {PEM} atas anak bernama {ANAK} tidak dipersoalkan'],
     ['setahu saya tidak ada yang mempersoalkan pengasuhan {PEM} atas anak bernama {ANAK}', 'pengasuhan {PEM} atas anak bernama {ANAK} tidak pernah dipersoalkan']),
  A=['tidak pernah ada pihak yang meminta kembali anak bernama {ANAK}', 'tidak pernah ada yang meminta anak bernama {ANAK} kembali'],
  B=['pernah ada yang menanyakan anak bernama {ANAK} tetapi tidak menuntut apa pun', 'pernah ada yang bertanya tentang anak bernama {ANAK} tanpa menuntut apa pun'],
  beda_pada='peristiwa', beda_maksud='versi A: tidak pernah ada yang meminta kembali; versi B: pernah ada yang menanyakan tanpa menuntut - berselisih pada PERISTIWA')

S(id='surat-pernyataan', pokok='pp-aa-pernyataan', urut_abs=206, tingkat='pilihan',
  teks='Apakah {PEM} telah membuat pernyataan tertulis bahwa pengangkatan ini demi kepentingan terbaik anak bernama {ANAK} dan akan memperlakukannya dengan adil?',
  varian=['Apakah ada surat pernyataan {PEM} yang menyatakan pengangkatan anak bernama {ANAK} semata-mata demi kepentingan terbaik anak itu?'],
  hal='pernyataan tertulis pemohon', m='pernyataan tertulis {PEM} demi kepentingan terbaik anak bernama {ANAK}', fam='tahu',
  K=(['{PEM} telah membuat surat pernyataan bahwa pengangkatan anak bernama {ANAK} demi kepentingan terbaik anak itu', 'surat pernyataan {PEM} untuk kepentingan terbaik anak bernama {ANAK} sudah dibuat dan ditandatangani'],
     ['ada surat pernyataan {PEM} yang menyebut pengangkatan anak bernama {ANAK} semata-mata demi kebaikan anak itu', '{PEM} sudah menandatangani pernyataan bahwa pengangkatan anak bernama {ANAK} demi kepentingan terbaik anak']),
  P=(['{PEM} pernah membuat surat pernyataan tentang pengangkatan anak bernama {ANAK}', 'ada surat pernyataan {PEM} tentang pengangkatan anak bernama {ANAK}'],
     ['setahu saya {PEM} pernah membuat surat pernyataan tentang anak bernama {ANAK}', 'surat pernyataan {PEM} tentang anak bernama {ANAK} memang ada']),
  A=['surat pernyataan {PEM} dibuat di atas meterai', 'surat pernyataan {PEM} dibuat bermeterai'],
  B=['surat pernyataan {PEM} dibuat di hadapan notaris', 'surat pernyataan {PEM} dibuat di hadapan seorang notaris'],
  beda_pada='tempat', beda_maksud='versi A: surat pernyataan bermeterai; versi B: di hadapan notaris - berselisih pada TEMPAT')

S(id='rencana-masa-depan', pokok='pp-aa-kepentingan', urut_abs=207, tingkat='pilihan',
  teks='Apa rencana {PEM} bagi pendidikan, kesehatan, dan masa depan anak bernama {ANAK} bila permohonan ini dikabulkan?',
  varian=['Bila permohonan dikabulkan, apa yang akan dilakukan {PEM} untuk masa depan anak bernama {ANAK}?'],
  hal='rencana masa depan anak', m='rencana {PEM} bagi masa depan anak bernama {ANAK}', fam='tahu',
  K=(['{PEM} berencana memenuhi #4915# bagi anak bernama {ANAK}', 'rencana {PEM} bagi anak bernama {ANAK} adalah #4915#'],
     ['setelah permohonan dikabulkan {PEM} bermaksud melaksanakan #4915# bagi anak bernama {ANAK}', '{PEM} bertujuan #4915# untuk anak bernama {ANAK}']),
  M=(['tujuan {PEM} mengangkat anak bernama {ANAK} adalah #4915#', '{PEM} mengangkat anak bernama {ANAK} dengan tujuan #4915#'],
     ['maksud {PEM} mengangkat anak bernama {ANAK} adalah #4915#', '{PEM} berniat mengangkat anak bernama {ANAK} agar #4915#']),
  P=(['{PEM} berencana menyekolahkan dan menjaga kesehatan anak bernama {ANAK}', '{PEM} berencana mendidik dan merawat anak bernama {ANAK}'],
     ['setahu saya {PEM} akan menyekolahkan anak bernama {ANAK}', '{PEM} akan mendidik dan merawat anak bernama {ANAK}']),
  A=['{PEM} akan menyekolahkan anak bernama {ANAK} sampai perguruan tinggi', '{PEM} berencana menyekolahkan anak bernama {ANAK} hingga perguruan tinggi'],
  B=['{PEM} akan menyekolahkan anak bernama {ANAK} sampai sekolah menengah', '{PEM} berencana menyekolahkan anak bernama {ANAK} hingga sekolah menengah'],
  beda_pada='lama', beda_maksud='versi A: sekolah sampai perguruan tinggi; versi B: sampai sekolah menengah - berselisih pada LAMA')

S(id='kesiapan', pokok='pp-aa-kesiapan', urut_abs=208, tingkat='pilihan',
  teks='Apakah {PEM} siap lahir batin menjadi orang tua angkat dan memahami tanggung jawabnya sampai anak bernama {ANAK} dewasa?',
  varian=['Apakah {PEM} sudah matang dan siap menanggung kewajiban sebagai orang tua angkat anak bernama {ANAK}?'],
  hal='kesiapan pemohon sebagai orang tua angkat', m='kesiapan {PEM} sebagai orang tua angkat anak bernama {ANAK}', fam='tahu',
  K=(['{PEM} siap lahir batin menjadi orang tua angkat dan memahami tanggung jawab sampai anak bernama {ANAK} dewasa', '{PEM} sudah siap secara lahir dan batin merawat anak bernama {ANAK} sampai dewasa'],
     ['kesiapan {PEM} sebagai orang tua angkat sudah matang dan tanggung jawab sampai anak bernama {ANAK} dewasa dipahaminya', '{PEM} memahami kewajiban mengasuh anak bernama {ANAK} sampai dewasa dan siap menjalaninya']),
  M=(['{PEM} siap menjadi orang tua angkat anak bernama {ANAK}', '{PEM} siap merawat anak bernama {ANAK} sampai dewasa'],
     ['{PEM} menyatakan siap menjadi orang tua angkat anak bernama {ANAK}', '{PEM} menyatakan siap merawat anak bernama {ANAK} sampai dewasa']),
  P=(['{PEM} tampak siap menjadi orang tua angkat anak bernama {ANAK}', '{PEM} tampak siap merawat anak bernama {ANAK}'],
     ['setahu saya {PEM} siap menjadi orang tua angkat anak bernama {ANAK}', '{PEM} siap merawat anak bernama {ANAK}']),
  A=['{PEM} sudah lama mempersiapkan diri menjadi orang tua angkat anak bernama {ANAK}', '{PEM} sudah lama menyiapkan diri sebagai orang tua angkat anak bernama {ANAK}'],
  B=['{PEM} baru belakangan mempersiapkan diri menjadi orang tua angkat anak bernama {ANAK}', '{PEM} baru belakangan menyiapkan diri sebagai orang tua angkat anak bernama {ANAK}'],
  beda_pada='lama', beda_maksud='versi A: sudah lama bersiap; versi B: baru belakangan - berselisih pada LAMA')

S(id='surat-kesehatan', pokok='pp-aa-kesehatan', urut_abs=121, tingkat='tambahan',
  teks='Apakah {PEM} pernah menjalani pemeriksaan kesehatan jasmani, rohani, dan bebas narkotika, serta mengurus surat keterangan catatan kepolisian?',
  varian=['Apakah {PEM} sudah memeriksakan kesehatan jasmani dan rohani, bebas narkotika, dan mengurus catatan kepolisian?'],
  hal='pemeriksaan kesehatan dan catatan kepolisian pemohon', m='pemeriksaan kesehatan dan catatan kepolisian {PEM}', fam='tahu',
  K=(['{PEM} sudah menjalani pemeriksaan kesehatan jasmani dan rohani serta bebas narkotika, dan mengurus catatan kepolisian', '{PEM} telah diperiksa kesehatan jasmani dan rohani, bebas narkotika, dan sudah mengurus catatan kepolisian'],
     ['pemeriksaan kesehatan jasmani, rohani, dan bebas narkotika sudah dijalani {PEM} serta catatan kepolisian sudah diurus', '{PEM} sudah mengurus pemeriksaan kesehatan, bebas narkotika, dan catatan kepolisian']),
  P=(['{PEM} pernah memeriksakan kesehatannya ke rumah sakit', '{PEM} pernah diperiksa kesehatannya di rumah sakit'],
     ['setahu saya {PEM} pernah memeriksakan kesehatan ke rumah sakit', '{PEM} pernah menjalani pemeriksaan kesehatan di rumah sakit']),
  A=['pemeriksaan kesehatan {PEM} dilakukan di rumah sakit umum daerah', '{PEM} diperiksa kesehatannya di rumah sakit umum daerah'],
  B=['pemeriksaan kesehatan {PEM} dilakukan di puskesmas', '{PEM} diperiksa kesehatannya di puskesmas'],
  beda_pada='tempat', beda_maksud='versi A: diperiksa di rumah sakit umum; versi B: di puskesmas - berselisih pada TEMPAT')

S(id='lapor-pasca', pokok='pp-aa-pasca', urut_abs=209, tingkat='tambahan',
  teks='Apakah {PEM} bersedia mengurus perubahan dokumen kependudukan dan melapor kepada dinas sosial setelah penetapan, dan merawat anak bernama {ANAK} sebagai amanah?',
  varian=['Apakah {PEM} bersedia melaporkan penetapan ini kepada dinas sosial dan mengurus dokumen anak bernama {ANAK} setelah penetapan?'],
  hal='kesediaan melapor dan mengurus dokumen setelah penetapan', m='kesediaan {PEM} melapor dan mengurus dokumen anak bernama {ANAK} setelah penetapan', fam='tahu',
  K=(['{PEM} bersedia melaporkan penetapan kepada dinas sosial dan mengurus dokumen kependudukan anak bernama {ANAK}', '{PEM} sanggup melapor kepada dinas sosial dan mengurus dokumen kependudukan anak bernama {ANAK} setelah penetapan'],
     ['setelah penetapan {PEM} akan melapor kepada dinas sosial dan mengurus dokumen kependudukan anak bernama {ANAK}', '{PEM} menyatakan siap melapor kepada dinas sosial dan mengurus dokumen anak bernama {ANAK}']),
  M=(['{PEM} akan melapor kepada dinas sosial dan mengurus dokumen anak bernama {ANAK} setelah penetapan', '{PEM} akan mengurus dokumen anak bernama {ANAK} dan melapor kepada dinas sosial'],
     ['{PEM} berjanji melapor kepada dinas sosial dan mengurus dokumen anak bernama {ANAK}', '{PEM} menyatakan akan mengurus dokumen anak bernama {ANAK} serta melapor kepada dinas sosial']),
  P=(['{PEM} bersedia mengurus dokumen anak bernama {ANAK} setelah penetapan', '{PEM} sanggup mengurus dokumen anak bernama {ANAK} setelah penetapan'],
     ['setahu saya {PEM} bersedia mengurus dokumen anak bernama {ANAK} setelah penetapan', '{PEM} sanggup mengurus dokumen anak bernama {ANAK} setelah penetapan']),
  A=['{PEM} akan mengurus dokumen anak bernama {ANAK} di kantor catatan sipil', '{PEM} berencana mengurus dokumen anak bernama {ANAK} di kantor catatan sipil'],
  B=['{PEM} akan mengurus dokumen anak bernama {ANAK} di kantor kecamatan', '{PEM} berencana mengurus dokumen anak bernama {ANAK} di kantor kecamatan'],
  beda_pada='tempat', beda_maksud='versi A: mengurus di kantor catatan sipil; versi B: di kantor kecamatan - berselisih pada TEMPAT')

# ---------------------------------------------------------------------------------------------------------------------
CATATAN = [
    'Pilih "Pemohon suami istri berdua atau seorang diri", "Keadaan orang tua kandung", dan "Pemohon sudah mempunyai anak kandung" sesuai permohonan; pilihan itu hanya menentukan pertanyaan yang diajukan, bukan putusan.',
    'Pengangkatan anak tidak memutus nasab dan tidak menjadikan anak angkat ahli waris orang tua angkatnya; anak angkat dapat diberi wasiat (butir nasab dan waris bersifat pemahaman pemohon, bukan putusan).',
    'Isian #4910# sampai #4915# (sejak kapan anak diasuh, alasan penyerahan, riwayat perkawinan, izin instansi sosial, penghasilan, tujuan) diambil dari permohonan; periksa dan lengkapi sebelum saksi dibacakan.',
]
