# -*- coding: utf-8 -*-
"""Variabel ABT baru - PENUNJUKAN ORANG LAIN SEBAGAI WALI OLEH PENGADILAN (jenis SIPP 356), jatah 3860-3889.

Dasar hukum yang dicetak (semua terverifikasi dengan naskah di D:/aleta-dev/kerja/referensi/_unduhan; lihat spek/PASAL-356.md):
  Pasal 50 ayat (1)-(2), Pasal 51 ayat (2)-(5), Pasal 53 ayat (2) UU 1/1974 (naskah BPK); Pasal 107 ayat (1)-(4) KHI;
  Pasal 26 ayat (2) dan Pasal 33 ayat (1)-(4) UU 23/2002 sebagaimana diubah UU 35/2014;
  Pasal 1 angka 5-7, Pasal 2, Pasal 3 ayat (1)-(4), Pasal 4-7, Pasal 9, Pasal 11-14, Pasal 16 huruf c, Pasal 19 ayat (1), (4), (5) PP 29/2019;
  Pasal 49 huruf a dan penjelasan angka 17 UU 7/1989 jo. UU 3/2006 jo. UU 50/2009.

Pembagian:
  3860-3871  ISIAN (data_teks) hakim / panitera pengganti;   3872-3883  TURUNAN (data_sql) yang dicetak blangko;   3884-3889 cadangan.
Catatan teknis: teks keluaran tidak memuat tanda kutip tunggal/ganda, garis miring terbalik, maupun nama diri (nama orang/anak TIDAK disisipkan di dalam kueri;
nama anak dan nama Pemohon dipasang oleh ABT di teks blangko lewat penanda #4406# dan #0098#).
"""
from variabel_def import v, isi

P = 'PENUNJUKAN WALI: '

PP = 'Peraturan Pemerintah Nomor 29 Tahun 2019'
UU1 = 'Undang-Undang Nomor 1 Tahun 1974'
UU23 = 'Undang-Undang Nomor 23 Tahun 2002 jo. Undang-Undang Nomor 35 Tahun 2014'


def _huruf(n, h):
    """Ungkapan SQL boolean: isian pilihan huruf n memuat huruf h sebagai kata tersendiri (A, B atau A dan B); kata utuh seperti Saudara tidak cocok."""
    return "UPPER(%s) REGEXP '[[:<:]]%s[[:>:]]'" % (isi(n), h)


def _kat(h):
    return _huruf(3860, h)


def _seb(h):
    return _huruf(3862, h)


def _lit(teks):
    assert "'" not in teks and '"' not in teks and '\\' not in teks, teks
    return "'" + teks + "'"


# ---------------------------------------------------------------------------------------------------------------------------------
# ISIAN
# ---------------------------------------------------------------------------------------------------------------------------------
v(3860, P + 'KATEGORI CALON WALI - ISIAN HURUF: A Keluarga Anak (mis. kakek, nenek), B Saudara (mis. kakak, paman, bibi), C orang lain, D badan hukum (yayasan/lembaga)',
  'data_teks')
v(3861, P + 'HUBUNGAN CALON WALI DENGAN ANAK - ISIAN (frasa, mis. nenek kandung dari ibu, kakak kandung, paman (adik ayah kandung), tetangga yang mengasuh sejak bayi, yayasan yang mengasuh anak)',
  'data_teks')
v(3862, P + 'SEBAB ANAK BUTUH WALI - ISIAN HURUF (boleh lebih dari satu): A orang tua meninggal, B orang tua tidak diketahui, C orang tua tidak mampu, D kuasa wali dicabut, E wali berakhir',
  'data_teks')
v(3863, P + 'KETERANGAN SEBAB - ISIAN (nama dan kedudukan orang tua atau wali sebelumnya, tanggal meninggal, atau nomor dan tanggal penetapan pencabutan; sambungan kalimat sesudah kata yaitu)',
  'data_teks')
v(3864, P + 'PENGASUHAN ANAK SAAT INI - ISIAN (kalimat utuh sesudah kata Bahwa: sejak kapan, oleh siapa, tinggal di mana, keadaan anak, bersekolah atau tidak)',
  'data_teks')
v(3865, P + 'FAKTA SYARAT CALON WALI - ISIAN (umur, WNI berdomisili tetap, sehat fisik dan mental, berkelakuan baik, mampu secara ekonomi, seagama dengan anak, surat pernyataan kesediaan)',
  'data_teks')
v(3866, P + 'PERSETUJUAN YANG DIPERSYARATKAN - ISIAN (suami atau istri calon wali, Orang Tua bila masih ada dan cakap, persetujuan Anak bagi Saudara dan orang lain; kalimat utuh)',
  'data_teks')
v(3867, P + 'REKOMENDASI DINAS SOSIAL - ISIAN OPSIONAL (nomor, tanggal, dan kesimpulan asesmen pekerja sosial profesional; PP 29/2019 Pasal 11-12; kosong = tidak dicetak)', 'data_teks')
v(3868, P + 'HARTA ATAU TINDAKAN HUKUM ANAK YANG PERLU DIKELOLA WALI - ISIAN OPSIONAL (mis. pencairan dana santunan atau tabungan atas nama anak, pengurusan warisan; kosong = tidak ada permohonan)',
  'data_teks')
v(3869, P + 'ALAT BUKTI SURAT PEMOHON - ISIAN (daftar bukti P.1 dst.; bila dibiarkan, memakai contoh bawaan)', 'data_teks',
  default=('1. Fotokopi Kartu Tanda Penduduk atas nama #0098#, NIK ..., yang dikeluarkan oleh ..., bukti surat tersebut telah diberi meterai cukup, di-nazegelen, serta telah dicocokkan dengan aslinya yang ternyata sesuai, lalu diberi tanda P.1;<br>'
           '2. Fotokopi Kartu Keluarga Nomor ... atas nama ..., yang dikeluarkan oleh ..., bukti surat tersebut telah diberi meterai cukup, di-nazegelen, serta telah dicocokkan dengan aslinya yang ternyata sesuai, lalu diberi tanda P.2;<br>'
           '3. Fotokopi Kutipan Akta Kelahiran anak atas nama ..., Nomor ..., yang dikeluarkan oleh ..., bukti surat tersebut telah diberi meterai cukup, di-nazegelen, serta telah dicocokkan dengan aslinya yang ternyata sesuai, lalu diberi tanda P.3;<br>'
           '4. Fotokopi Kutipan Akta Kematian orang tua anak atau Salinan Penetapan Pengadilan tentang pencabutan kekuasaan wali, Nomor ..., yang dikeluarkan oleh ..., bukti surat tersebut telah diberi meterai cukup, di-nazegelen, serta telah dicocokkan dengan aslinya yang ternyata sesuai, lalu diberi tanda P.4;<br>'
           '5. Surat pernyataan kesediaan menjadi wali dan surat pernyataan tidak pernah dan tidak akan melakukan kekerasan, eksploitasi, penelantaran, atau perlakuan salah terhadap anak, bermeterai cukup, lalu diberi tanda P.5;<br>'
           '6. ...'))
v(3870, P + 'ALASAN DITOLAK - ISIAN kalimat sesudah kata "Menimbang, bahwa" (mengapa syarat calon wali tidak terpenuhi atau penunjukan belum untuk kepentingan terbaik anak)', 'data_teks',
  default='........')
v(3871, P + 'SEBAB TIDAK DAPAT DITERIMA - ISIAN kalimat sesudah kata "Menimbang, bahwa" (mis. anak atau Pemohon tidak beragama Islam, anak telah berumur 18 tahun, pemohon bukan calon wali)', 'data_teks',
  default='........')

# ---------------------------------------------------------------------------------------------------------------------------------
# TURUNAN
# ---------------------------------------------------------------------------------------------------------------------------------
v(3872, P + 'KATEGORI CALON WALI MENURUT PP 29/2019 (OTOMATIS dari huruf isian 3860: Keluarga Anak, Saudara, orang lain, badan hukum; kosong = titik-titik)', 'data_sql',
  "SELECT CASE WHEN %s THEN 'Keluarga Anak' WHEN %s THEN 'Saudara' WHEN %s THEN 'orang lain' WHEN %s THEN 'badan hukum' ELSE '........' END AS data" % (
      _kat('A'), _kat('B'), _kat('C'), _kat('D')))

v(3873, P + 'DASAR SYARAT CALON WALI (OTOMATIS dari huruf isian 3860: Pasal 4, 5, 6 atau 7 PP 29/2019)', 'data_sql',
  "SELECT CASE WHEN %s THEN %s WHEN %s THEN %s WHEN %s THEN %s WHEN %s THEN %s ELSE '........' END AS data" % (
      _kat('A'), _lit('Pasal 4 ayat (1) ' + PP),
      _kat('B'), _lit('Pasal 5 ayat (1) ' + PP),
      _kat('C'), _lit('Pasal 6 ayat (1) ' + PP),
      _kat('D'), _lit('Pasal 7 ayat (2) dan ayat (3) ' + PP)))

_SYARAT_BERSAMA = ('warga negara Indonesia yang berdomisili tetap di Indonesia, %s, sehat fisik dan mental, berkelakuan baik, mampu secara ekonomi, beragama sama dengan agama yang dianut Anak, '
                   'mendapat persetujuan tertulis dari suami atau istri bagi yang sudah menikah, bersedia menjadi Wali yang dinyatakan dalam surat pernyataan, '
                   'membuat pernyataan tertulis tidak pernah dan tidak akan melakukan kekerasan, eksploitasi, penelantaran, dan perlakuan salah terhadap Anak atau penerapan hukuman fisik dengan alasan apa pun termasuk untuk penegakan disiplin terhadap Anak')
_ORTU = 'mendapat persetujuan tertulis dari Orang Tua jika masih ada, diketahui keberadaannya, dan cakap melakukan perbuatan hukum'

_SYARAT_A = (
    'Menimbang, bahwa menurut Pasal 3 ayat (2) ' + PP + ' seseorang yang ditunjuk sebagai Wali diutamakan dari Keluarga Anak, yaitu keluarga sedarah dalam garis lurus ke atas sampai dengan derajat ketiga (Pasal 1 angka 5), '
    'yang menurut Pasal 4 ayat (1) harus memenuhi syarat: ' + _SYARAT_BERSAMA % 'berumur paling rendah 30 (tiga puluh) tahun' + ', mendahulukan Keluarga Anak derajat terdekat, dan ' + _ORTU + '; '
    'selanjutnya Pasal 4 ayat (2) menentukan bahwa Wali yang ditunjuk dari Keluarga Anak diutamakan memiliki kedekatan dengan Anak;')
_SYARAT_B = (
    'Menimbang, bahwa menurut Pasal 3 ayat (3) ' + PP + ' dalam hal Keluarga Anak tidak ada, tidak bersedia, atau tidak memenuhi persyaratan dapat ditunjuk Saudara, yaitu kerabat Keluarga laki-laki maupun perempuan '
    'menyamping dari kakek atau nenek, bapak atau ibu, dan Anak (Pasal 1 angka 6), yang menurut Pasal 5 ayat (1) harus memenuhi syarat: ' + _SYARAT_BERSAMA % 'berumur paling rendah 21 (dua puluh satu) tahun' + ', dan ' + _ORTU + '; '
    'selanjutnya Pasal 5 ayat (2) menentukan bahwa Saudara dapat ditunjuk sebagai Wali dengan ketentuan diutamakan memiliki kedekatan dengan Anak, mendapatkan persetujuan dari Anak, dan dalam hal Anak tidak mampu memberikan persetujuannya secara langsung, '
    'pernyataan Anak difasilitasi oleh ahli atau lembaga yang ditunjuk sesuai dengan ketentuan peraturan perundang-undangan;')
_SYARAT_C = (
    'Menimbang, bahwa menurut Pasal 3 ayat (4) ' + PP + ' dalam hal Keluarga Anak dan Saudara tidak ada, tidak bersedia, tidak diketahui keberadaannya, atau tidak memenuhi persyaratan dapat ditunjuk orang lain, '
    'yang menurut Pasal 6 ayat (1) harus memenuhi syarat: ' + _SYARAT_BERSAMA % 'berumur paling rendah 30 (tiga puluh) tahun' + ', dan ' + _ORTU + '; '
    'selanjutnya Pasal 6 ayat (2) menentukan bahwa orang lain dapat ditunjuk sebagai Wali dengan ketentuan diutamakan memiliki kedekatan dengan Anak, mendapatkan persetujuan dari Anak, dan dalam hal Anak tidak mampu memberikan persetujuannya secara langsung, '
    'pernyataan Anak difasilitasi oleh ahli atau lembaga yang ditunjuk sesuai dengan ketentuan peraturan perundang-undangan;')
_SYARAT_D = (
    'Menimbang, bahwa menurut Pasal 3 ayat (4) ' + PP + ' dalam hal Keluarga Anak dan Saudara tidak ada, tidak bersedia, tidak diketahui keberadaannya, atau tidak memenuhi persyaratan dapat ditunjuk badan hukum; '
    'menurut Pasal 7 ayat (1) badan hukum yang ditunjuk sebagai Wali terdiri atas unit pelaksana teknis kementerian atau lembaga, unit pelaksana teknis perangkat daerah, dan lembaga kesejahteraan sosial Anak; '
    'unit pelaksana teknis harus dibentuk berdasarkan ketentuan peraturan perundang-undangan dan melaksanakan tugas dan fungsi pengasuhan Anak (Pasal 7 ayat (2)); lembaga kesejahteraan sosial Anak harus berbadan hukum berupa yayasan dan terakreditasi, '
    'bersedia menjadi Wali yang dinyatakan dalam surat pernyataan dari pengurus yang ditunjuk, mendapat rekomendasi dari dinas yang menyelenggarakan urusan pemerintahan di bidang sosial, membuat pernyataan tertulis tidak pernah dan tidak akan melakukan diskriminasi '
    'dalam melindungi hak Anak, seagama dengan agama yang dianut Anak bagi lembaga keagamaan, dan mendapat persetujuan tertulis dari Orang Tua jika masih ada, diketahui keberadaannya, dan cakap melakukan perbuatan hukum (Pasal 7 ayat (3)); '
    'badan hukum yang ditunjuk sebagai Wali tidak boleh membedakan suku, ras, golongan, jenis kelamin, etnik, budaya, bahasa, urutan kelahiran, kondisi fisik, dan atau mental Anak (Pasal 7 ayat (4));')
v(3874, P + 'PERTIMBANGAN SYARAT SESUAI KATEGORI CALON WALI (OTOMATIS dari huruf isian 3860: uraian Pasal 3-7 PP 29/2019 untuk Keluarga Anak, Saudara, orang lain atau badan hukum)', 'data_sql',
  "SELECT CASE WHEN %s THEN %s WHEN %s THEN %s WHEN %s THEN %s WHEN %s THEN %s ELSE 'Menimbang, bahwa syarat penunjukan wali sesuai kedudukan calon wali diatur dalam Pasal 3 sampai dengan Pasal 7 %s;' END AS data" % (
      _kat('A'), _lit(_SYARAT_A), _kat('B'), _lit(_SYARAT_B), _kat('C'), _lit(_SYARAT_C), _kat('D'), _lit(_SYARAT_D), PP))

v(3875, P + 'HUBUNGAN CALON WALI DENGAN ANAK (OTOMATIS: isian 3861; kosong = titik-titik)', 'data_sql',
  "SELECT IF(%s <> '', %s, '........') AS data" % (isi(3861), isi(3861)))

# fakta sebab: tiap huruf yang dipilih menjadi satu klausa; digabung dengan kata dan; keterangan 3863 menyusul sesudah kata yaitu
_F_A = 'kedua orang tua #4407# tersebut telah meninggal dunia'
_F_B = 'keberadaan orang tua #4407# tersebut tidak diketahui'
_F_C = 'orang tua #4407# tersebut karena suatu sebab tidak dapat melaksanakan kewajiban dan tanggung jawabnya sebagai orang tua'
_F_D = 'kekuasaan wali sebelumnya atas #4407# tersebut telah dicabut'
_F_E = 'wali sebelumnya atas #4407# tersebut telah berakhir perwaliannya karena meninggal dunia, tidak mampu berbuat, atau lalai melaksanakan tugas perwaliannya'
_ADA_SEBAB = ' OR '.join(_seb(h) for h in 'ABCDE')
v(3876, P + 'FAKTA SEBAB ANAK MEMBUTUHKAN WALI (OTOMATIS dari huruf isian 3862 dan keterangan isian 3863; kalimat sesudah kata Bahwa; kosong = titik-titik)', 'data_sql',
  "SELECT IF(%s, CONCAT(CONCAT_WS(' dan ', IF(%s, %s, NULL), IF(%s, %s, NULL), IF(%s, %s, NULL), IF(%s, %s, NULL), IF(%s, %s, NULL)), IF(%s <> '', CONCAT(', yaitu ', %s), '')), '........') AS data" % (
      _ADA_SEBAB, _seb('A'), _lit(_F_A), _seb('B'), _lit(_F_B), _seb('C'), _lit(_F_C), _seb('D'), _lit(_F_D), _seb('E'), _lit(_F_E), isi(3863), isi(3863)))

_P_A = ('Menimbang, bahwa oleh karena kedua orang tua #4407# tersebut telah meninggal dunia, maka Orang Tua tidak ada sebagaimana dimaksud dalam Pasal 3 ayat (1) ' + PP + ' jo. Pasal 26 ayat (2) ' + UU23 + ', '
        'sehingga #4407# tersebut yang belum mencapai umur 18 (delapan belas) tahun dan belum pernah melangsungkan perkawinan tidak berada di bawah kekuasaan orang tua dan berada di bawah kekuasaan wali menurut Pasal 50 ayat (1) ' + UU1 + '; '
        'keadaan tersebut sejalan dengan penjelasan Pasal 49 huruf a angka 17 Undang-Undang Nomor 7 Tahun 1989 tentang Peradilan Agama sebagaimana telah diubah dengan Undang-Undang Nomor 3 Tahun 2006 dan perubahan kedua dengan Undang-Undang Nomor 50 Tahun 2009 '
        'yang memasukkan penunjukan seorang wali bagi anak yang belum cukup umur 18 (delapan belas) tahun yang ditinggal kedua orang tuanya ke dalam kewenangan Pengadilan Agama;')
_P_B = ('Menimbang, bahwa oleh karena keberadaan orang tua #4407# tersebut tidak diketahui, maka Orang Tua tidak diketahui keberadaannya sebagaimana dimaksud dalam Pasal 3 ayat (1) ' + PP + ' jo. Pasal 26 ayat (2) ' + UU23 + ', '
        'sehingga kewajiban dan tanggung jawab orang tua dapat beralih kepada Keluarga, dan apabila Orang Tua dan Keluarga Anak tidak dapat melaksanakannya, Pasal 33 ayat (1) dan ayat (2) Undang-Undang yang sama menentukan bahwa seseorang atau badan hukum '
        'yang memenuhi persyaratan dapat ditunjuk sebagai Wali melalui penetapan pengadilan;')
_P_C = ('Menimbang, bahwa oleh karena orang tua #4407# tersebut karena suatu sebab tidak dapat melaksanakan kewajiban dan tanggung jawabnya, maka sebagaimana dimaksud dalam Pasal 3 ayat (1) ' + PP + ' jo. Pasal 26 ayat (2) ' + UU23 + ', '
        'kewajiban dan tanggung jawab orang tua dapat beralih kepada Keluarga, dan apabila Orang Tua dan Keluarga Anak tidak dapat melaksanakannya, seseorang atau badan hukum yang memenuhi persyaratan dapat ditunjuk sebagai Wali melalui penetapan pengadilan '
        'menurut Pasal 33 ayat (1) dan ayat (2) Undang-Undang yang sama;')
_P_D = ('Menimbang, bahwa oleh karena kekuasaan wali sebelumnya atas #4407# tersebut telah dicabut, maka Pasal 53 ayat (2) ' + UU1 + ' menentukan bahwa oleh Pengadilan ditunjuk orang lain sebagai wali, ketentuan mana sejalan dengan penjelasan Pasal 49 huruf a angka 17 '
        'Undang-Undang Nomor 7 Tahun 1989 tentang Peradilan Agama sebagaimana telah diubah dengan Undang-Undang Nomor 3 Tahun 2006 dan perubahan kedua dengan Undang-Undang Nomor 50 Tahun 2009 yang memasukkan penunjukan orang lain sebagai wali oleh pengadilan '
        'dalam hal kekuasaan seorang wali dicabut ke dalam kewenangan Pengadilan Agama, serta dengan Pasal 19 ayat (1), ayat (4) dan ayat (5) ' + PP + ' yang menentukan bahwa pada saat berakhirnya Wali, seseorang atau badan hukum dapat ditunjuk sebagai Wali, '
        'dan Pengadilan dapat menetapkan Wali pengganti dengan berlakunya syarat dan tata cara penunjukan Wali secara mutatis mutandis;')
_P_E = ('Menimbang, bahwa oleh karena wali sebelumnya atas #4407# tersebut telah berakhir perwaliannya karena meninggal dunia, tidak mampu berbuat, atau lalai melaksanakan tugas perwaliannya, maka Pasal 107 ayat (3) Kompilasi Hukum Islam menentukan bahwa '
        'Pengadilan Agama dapat menunjuk salah seorang kerabat untuk bertindak sebagai wali atas permohonan kerabat tersebut, sedangkan Pasal 16 huruf c dan Pasal 19 ayat (1) ' + PP + ' menentukan bahwa Wali berakhir apabila Wali meninggal dunia dan pada saat berakhirnya Wali '
        'seseorang atau badan hukum dapat ditunjuk sebagai Wali;')
v(3877, P + 'PERTIMBANGAN HUKUM SEBAB ANAK MEMBUTUHKAN WALI (OTOMATIS dari huruf isian 3862: Pasal 3 PP 29/2019, Pasal 53 ayat (2) UU 1/1974, Pasal 107 ayat (3) KHI; satu paragraf per huruf)', 'data_sql',
  "SELECT IF(%s, CONCAT_WS('<br>', IF(%s, %s, NULL), IF(%s, %s, NULL), IF(%s, %s, NULL), IF(%s, %s, NULL), IF(%s, %s, NULL)), 'Menimbang, bahwa sebab #4407# tersebut membutuhkan wali ........;') AS data" % (
      _ADA_SEBAB, _seb('A'), _lit(_P_A), _seb('B'), _lit(_P_B), _seb('C'), _lit(_P_C), _seb('D'), _lit(_P_D), _seb('E'), _lit(_P_E)))

v(3878, P + 'PERTIMBANGAN REKOMENDASI DINAS SOSIAL (OTOMATIS: hanya bila isian 3867 terisi; PP 29/2019 Pasal 11 dan 12; diawali satu baris baru)', 'data_sql',
  "SELECT IF(%s <> '', CONCAT('<br>Menimbang, bahwa Pasal 11 %s menentukan bahwa orang atau badan hukum yang akan ditunjuk sebagai Wali harus melampirkan rekomendasi dari dinas yang menyelenggarakan urusan pemerintahan di bidang sosial kabupaten/kota setempat pada saat proses penetapan Pengadilan, "
  "dan menurut Pasal 12 ayat (1) rekomendasi tersebut menjadi bahan pertimbangan dalam penetapan Wali atau pencabutan kuasa asuh; dalam perkara ini diajukan rekomendasi berupa ', %s, ', hasil asesmen pekerja sosial profesional sebagaimana Pasal 12 ayat (2) huruf a, yang #8554# pertimbangkan bersama-sama dengan alat bukti lainnya;'), '') AS data" % (
      isi(3867), PP, isi(3867)))

v(3879, P + 'PERTIMBANGAN HARTA ATAU TINDAKAN HUKUM ANAK (OTOMATIS: hanya bila isian 3868 terisi; diawali satu baris baru)', 'data_sql',
  "SELECT IF(%s <> '', CONCAT('<br>Menimbang, bahwa selanjutnya terhadap permohonan agar wali yang ditunjuk berwenang mengelola harta #4407# tersebut dan mewakilinya untuk ', %s, ', oleh karena perwalian meliputi diri dan harta benda anak (Pasal 50 ayat (2) %s jo. Pasal 107 ayat (2) Kompilasi Hukum Islam), "
  "wali wajib mengelola harta milik Anak untuk kepentingan terbaik Anak (Pasal 33 ayat (4) %s) dan mewakili Anak untuk melakukan perbuatan hukum di dalam dan di luar Pengadilan (Pasal 14 ayat (1) huruf d dan huruf e %s), "
  "maka #8554# berpendapat bahwa hal tersebut patut dikabulkan dengan ketentuan bahwa hasil tindakan hukum tersebut wajib digunakan sebesar-besarnya untuk kepentingan #4407# tersebut dan wali bertanggung jawab atas pengelolaannya (Pasal 51 ayat (4) dan ayat (5) Undang-Undang Nomor 1 Tahun 1974 jo. Pasal 110 Kompilasi Hukum Islam);'), '') AS data" % (
      isi(3868), isi(3868), UU1, UU23, PP))

v(3880, P + 'AMAR HARTA ATAU TINDAKAN HUKUM ANAK (OTOMATIS: hanya bila isian 3868 terisi; satu butir rinci di bawah amar penetapan wali, diawali satu baris baru)', 'data_sql',
  "SELECT IF(%s <> '', CONCAT('<br>    - memberi wewenang kepada wali tersebut untuk mengelola harta #4407# tersebut dan mewakilinya untuk ', %s, ', dengan kewajiban menggunakan hasilnya untuk kepentingan #4407# tersebut;'), '') AS data" % (isi(3868), isi(3868)))

v(3881, P + 'FAKTA SYARAT CALON WALI (OTOMATIS: isian 3865; kosong = titik-titik)', 'data_sql',
  "SELECT IF(%s <> '', %s, '........') AS data" % (isi(3865), isi(3865)))
v(3882, P + 'PERSETUJUAN YANG DIPERSYARATKAN (OTOMATIS: isian 3866; kosong = titik-titik)', 'data_sql',
  "SELECT IF(%s <> '', %s, '........') AS data" % (isi(3866), isi(3866)))
v(3883, P + 'PENGASUHAN ANAK SAAT INI (OTOMATIS: isian 3864; kosong = titik-titik)', 'data_sql',
  "SELECT IF(%s <> '', %s, '........') AS data" % (isi(3864), isi(3864)))
