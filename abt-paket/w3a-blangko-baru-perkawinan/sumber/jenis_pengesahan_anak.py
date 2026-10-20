# -*- coding: utf-8 -*-
"""Jenis PENGESAHAN ANAK (SIPP 352, Pdt.P, alur 16) - blangko Derry BARU "8a Pengesahan Anak" dan "8a Pengesahan Anak - BAS" (agen W3a-B, 21 Okt 2026).

Beda dengan "8 Asal Usul Anak" (penetapan asal usul bila akta kelahiran tidak ada, Pasal 55 ayat (2) UU 1/1974 / Pasal 103 ayat (2) KHI):
Pengesahan Anak adalah putusan tentang SAH TIDAKNYA seorang anak atas permintaan orang tuanya (suami istri) - Penjelasan Pasal 49 huruf a angka 14 UU 7/1989
jo. UU 3/2006, Pasal 44 ayat (2) UU 1/1974 - termasuk status anak yang lahir dari perkawinan sah yang belum/baru dicatat dan anak yang lahir sebelum pernikahan
orang tuanya (pengakuan/hubungan darah, Pasal 43 ayat (1) UU 1/1974 sebagaimana dimaknai Putusan MK 46/PUU-VIII/2010). Isi akhir (anak sah atau hubungan perdata
dengan ayah biologis) tetap PILIHAN MAJELIS (variabel 3668).

Dasar hukum: lihat docs/gelombang3/PERIKSA-PASAL-W3a-pengesahan-anak.md.
Pakai:  python sumber/jenis_pengesahan_anak.py
"""
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import w3a_lib as L  # noqa: E402
import w3a_susun_b as S  # noqa: E402
from variabel_def import V  # noqa: E402

J = L.JENIS['pengesahan-anak']

# ---------------------------------------------------------------------------------------------------------------------
# VARIABEL BARU 3660-3689
# ---------------------------------------------------------------------------------------------------------------------
V(3660, 'PENGESAHAN ANAK: TEMPAT DAN TANGGAL LAHIR ANAK - ISIAN (tulis "di ... pada tanggal ...", tanpa titik akhir)', 'data_teks')
V(3661, 'PENGESAHAN ANAK: SEBUTAN anak / anak-anak (OTOMATIS: lebih dari satu anak di SIPP atau isian nama anak 8603 memuat koma atau "dan" = anak-anak)', 'data_sql',
  '''SELECT IF(IFNULL((SELECT COUNT(*) FROM perkara_anak_pihak WHERE perkara_id = '#perkara_id#' AND TRIM(IFNULL(nama_anak, '')) <> ''), 0) > 1
  OR (TRIM("#8603#") <> "" AND (LOCATE(",", "#8603#") > 0 OR LOCATE(" dan ", "#8603#") > 0)), 'anak-anak', 'anak') AS data''')
V(3662, 'PENGESAHAN ANAK: KEADAAN PENCATATAN PERNIKAHAN PARA PEMOHON - PILIHAN (A = dicatat sesudah anak lahir; B = belum dicatat; C = telah diitsbatkan Pengadilan)', 'data_teks',
  default='A · pernikahan baru dicatat Pegawai Pencatat Nikah sesudah anak lahir\nB · pernikahan belum dicatat (nikah menurut agama)\nC · pernikahan telah diitsbatkan Pengadilan')
V(3663, 'PENGESAHAN ANAK: PERTIMBANGAN PENCATATAN PERNIKAHAN (OTOMATIS dari pilihan 3662: Pasal 2 ayat (1) dan (2) UU 1/1974, pertimbangan Putusan MK 46/PUU-VIII/2010, Pasal 7 KHI)', 'data_sql',
  '''SELECT CASE UPPER(LEFT(TRIM("#3662#"), 1))
  WHEN "B" THEN "Menimbang, bahwa pernikahan #3673# sampai saat ini belum dicatat oleh Pegawai Pencatat Nikah; menurut Pasal 2 ayat (1) Undang-Undang Nomor 1 Tahun 1974 tentang Perkawinan perkawinan adalah sah apabila dilakukan menurut hukum masing-masing agamanya dan kepercayaannya itu, sedangkan pencatatan menurut Pasal 2 ayat (2) merupakan kewajiban administratif, sebagaimana dipertimbangkan dalam Putusan Mahkamah Konstitusi Nomor 46/PUU-VIII/2010 bahwa pencatatan perkawinan bukan faktor yang menentukan sahnya perkawinan; ketiadaan pencatatan tersebut tidak menghilangkan keabsahan pernikahan yang telah dilangsungkan menurut hukum Islam, tetapi pernikahan tersebut belum dapat dibuktikan dengan akta nikah sebagaimana Pasal 7 ayat (1) Kompilasi Hukum Islam sehingga perlu dibuktikan di persidangan ini dengan alat bukti lain;"
  WHEN "C" THEN "Menimbang, bahwa pernikahan #3673# telah diitsbatkan oleh Pengadilan sebagaimana #3664#; itsbat nikah tersebut menurut Pasal 7 ayat (2) Kompilasi Hukum Islam diajukan karena perkawinan tidak dapat dibuktikan dengan akta nikah, sehingga keabsahan pernikahan para Pemohon telah dinyatakan dan dibuktikan secara hukum, dan anak yang dilahirkan dalam atau sebagai akibat perkawinan tersebut memenuhi unsur Pasal 42 Undang-Undang Nomor 1 Tahun 1974 tentang Perkawinan;"
  ELSE "Menimbang, bahwa meskipun pernikahan #3673# baru dicatat secara resmi sesudah anak dilahirkan, yaitu #3664#, pencatatan perkawinan menurut Pasal 2 ayat (2) Undang-Undang Nomor 1 Tahun 1974 tentang Perkawinan merupakan kewajiban administratif, sedangkan sahnya perkawinan ditentukan menurut Pasal 2 ayat (1) yaitu dilakukan menurut hukum masing-masing agamanya dan kepercayaannya itu, sebagaimana dipertimbangkan dalam Putusan Mahkamah Konstitusi Nomor 46/PUU-VIII/2010 bahwa pencatatan perkawinan bukan faktor yang menentukan sahnya perkawinan; dengan demikian pencatatan yang dilakukan kemudian tidak menghilangkan keabsahan pernikahan yang telah dilangsungkan sebelumnya menurut hukum Islam;" END AS data''')
V(3664, 'PENGESAHAN ANAK: AKTA NIKAH ATAU PENETAPAN ITSBAT NIKAH - ISIAN (mis. Akta Nikah Nomor ... tanggal ... KUA Kecamatan ...; atau Penetapan Itsbat Nikah Nomor ... tanggal ...)', 'data_teks', default='........')
V(3665, 'PENGESAHAN ANAK: SEBAB ANAK BELUM MEMPUNYAI AKTA KELAHIRAN - ISIAN (satu kalimat tanpa titik akhir, mis. "belum mempunyai akta kelahiran karena ...")', 'data_teks', default='belum mempunyai akta kelahiran karena ........')
V(3666, 'PENGESAHAN ANAK: BUKTI HUBUNGAN DARAH ANAK DENGAN AYAH BIOLOGIS - ISIAN (mis. "dibuktikan dengan hasil tes DNA ..."; kosongkan bila anak lahir dalam perkawinan)', 'data_teks')
V(3667, 'PENGESAHAN ANAK: PERTIMBANGAN BUKTI HUBUNGAN DARAH (OTOMATIS: muncul hanya bila isian 3666 terisi; Putusan MK 46/PUU-VIII/2010; diawali satu baris baru)', 'data_sql',
  '''SELECT IF(TRIM("#3666#") <> "", CONCAT("<br>Menimbang, bahwa hubungan darah antara #8602# dengan #0098# #3666#; sebagaimana Putusan Mahkamah Konstitusi Nomor 46/PUU-VIII/2010, hubungan perdata anak yang dilahirkan di luar perkawinan dengan laki-laki sebagai ayahnya dapat dibuktikan berdasarkan ilmu pengetahuan dan teknologi dan/atau alat bukti lain menurut hukum mempunyai hubungan darah, sehingga alat bukti tersebut #8554# nilai cukup untuk menetapkan adanya hubungan darah tersebut;"), "") AS data''')
V(3668, 'PENGESAHAN ANAK: STATUS ANAK - PILIHAN MAJELIS (pilih satu: anak sah; anak sah meskipun baru dicatat; anak luar kawin dengan hubungan perdata dengan ayah biologis)', 'data_teks',
  default='anak sah dari #3673# karena dilahirkan dalam perkawinan yang sah menurut hukum Islam\nanak sah dari #3673# karena dilahirkan dalam perkawinan yang sah menurut hukum Islam, meskipun pernikahan tersebut baru dicatat setelah anak dilahirkan\n'
          'anak yang dilahirkan di luar perkawinan yang sah, yang mempunyai hubungan nasab dan hubungan perdata dengan ibunya dan keluarga ibunya serta hubungan perdata dengan #0098# sebagai ayah biologisnya')
V(3669, 'PENGESAHAN ANAK: ALAT BUKTI SURAT #0046# - ISIAN (daftar bukti P.1 dst.: KTP, KK, akta atau buku nikah atau penetapan itsbat, surat keterangan lahir anak)', 'data_teks',
  default='1. Fotokopi Kartu Tanda Penduduk atas nama #0098#, NIK #0335#, yang dikeluarkan oleh Dinas Kependudukan dan Pencatatan Sipil ..., bukti surat tersebut telah diberi meterai cukup, di-nazegelen, serta telah dicocokkan dengan aslinya yang ternyata sesuai, lalu diberi tanda P.1;<br>'
          '2. Fotokopi Kartu Keluarga Nomor ... atas nama kepala keluarga ..., yang dikeluarkan oleh Dinas Kependudukan dan Pencatatan Sipil ..., bukti surat tersebut telah diberi meterai cukup, di-nazegelen, serta telah dicocokkan dengan aslinya yang ternyata sesuai, lalu diberi tanda P.2;<br>'
          '3. Fotokopi Kutipan Akta Nikah atau Penetapan Itsbat Nikah #3664#, bukti surat tersebut telah diberi meterai cukup, di-nazegelen, serta telah dicocokkan dengan aslinya yang ternyata sesuai, lalu diberi tanda P.3;<br>'
          '4. Fotokopi Surat Keterangan Lahir atas nama #8602#, yang dikeluarkan oleh ..., bukti surat tersebut telah diberi meterai cukup, di-nazegelen, serta telah dicocokkan dengan aslinya yang ternyata sesuai, lalu diberi tanda P.4;')
V(3670, 'PENGESAHAN ANAK: PENGAKUAN AYAH (PEMOHON I) ATAS ANAK - ISIAN (mis. "mengakui #8602# sebagai anak kandungnya"; kosongkan bila anak lahir dalam perkawinan)', 'data_teks')
V(3671, 'PENGESAHAN ANAK: PERTIMBANGAN MAJELIS ATAS DALIL YANG TIDAK TERBUKTI - ISIAN (hakim: dalil atau bukti apa yang kurang; dipakai blangko Tolak dan Tidak Dapat Diterima)', 'data_teks')
V(3672, 'PENGESAHAN ANAK: TUJUAN PENGESAHAN - ISIAN (frasa setelah kata "untuk", mis. pengurusan akta kelahiran dan dokumen kependudukan anak)', 'data_teks', default='pengurusan akta kelahiran dan dokumen kependudukan anak')
V(3673, 'PENGESAHAN ANAK: PENYEBUTAN PEMOHON RINGKAS (OTOMATIS: dua Pemohon = Pemohon I (nama) dan Pemohon II (nama); satu Pemohon = namanya)', 'data_sql',
  '''SELECT IFNULL((SELECT CASE WHEN COUNT(*) >= 2 THEN CONCAT('Pemohon I (', MAX(CASE WHEN pp.urutan = 1 THEN p.nama END), ') dan Pemohon II (', MAX(CASE WHEN pp.urutan = 2 THEN p.nama END), ')')
  WHEN COUNT(*) = 1 THEN MAX(p.nama) ELSE NULL END FROM perkara_pihak1 pp JOIN pihak p ON p.id = pp.pihak_id WHERE pp.perkara_id = '#perkara_id#'), 'para Pemohon') AS data''')
V(3674, 'PENGESAHAN ANAK: FAKTA PENCATATAN PERNIKAHAN (OTOMATIS dari pilihan 3662; kalimat fakta hukum)', 'data_sql',
  '''SELECT CASE UPPER(LEFT(TRIM("#3662#"), 1))
  WHEN "B" THEN "sampai saat ini belum dicatat oleh Pegawai Pencatat Nikah"
  WHEN "C" THEN "telah diitsbatkan oleh Pengadilan sebagaimana #3664#"
  ELSE "baru dicatat secara resmi sesudah anak dilahirkan, yaitu #3664#" END AS data''')
V(3675, 'PENGESAHAN ANAK: PERTIMBANGAN PENGAKUAN AYAH (OTOMATIS: muncul hanya bila isian 3670 terisi; diawali satu baris baru)', 'data_sql',
  '''SELECT IF(TRIM("#3670#") <> "", CONCAT("<br>Menimbang, bahwa #0098# di persidangan #3670#; pengakuan tersebut dihubungkan dengan keterangan saksi-saksi dan bukti surat yang diajukan sehingga #8554# menilai pengakuan tersebut bersesuaian dengan alat bukti lain dan dapat dipertimbangkan sebagai dasar penetapan status anak;"), "") AS data''')
V(3676, 'PENGESAHAN ANAK: PERTIMBANGAN AKTA KELAHIRAN DAN KEPENTINGAN TERBAIK ANAK (OTOMATIS; memuat tujuan dari isian 3672: Pasal 55 UU 1/1974, Pasal 5 dan Pasal 27 UU 23/2002 jo. UU 35/2014)', 'data_sql',
  '''SELECT CONCAT("Menimbang, bahwa Pasal 55 ayat (1) Undang-Undang Nomor 1 Tahun 1974 tentang Perkawinan menentukan bahwa asal usul seorang anak hanya dapat dibuktikan dengan akta kelahiran yang autentik yang dikeluarkan oleh pejabat yang berwenang, sedangkan Pasal 5 dan Pasal 27 ayat (1) dan ayat (2) Undang-Undang Nomor 23 Tahun 2002 tentang Perlindungan Anak sebagaimana telah diubah dengan Undang-Undang Nomor 35 Tahun 2014 menentukan bahwa setiap anak berhak atas suatu nama sebagai identitas diri dan identitas diri tersebut dituangkan dalam akta kelahiran; penetapan pengesahan ini diperlukan untuk ", IF(TRIM("#3672#") <> "", "#3672#", "pengurusan akta kelahiran dan dokumen kependudukan anak"), " sehingga sejalan dengan kepentingan terbaik bagi anak karena memberikan kepastian hukum atas status dan identitas anak;") AS data''')

ISIAN = {
    '3660': ('manual', 'Tempat dan tanggal lahir anak dibaca dari posita bila tertulis jelas; selain itu ketik dari surat keterangan lahir (tidak ada di tab Anak SIPP).'),
    '3662': ('manual', 'Keadaan pencatatan pernikahan (dicatat kemudian, belum dicatat, atau diitsbatkan) diisi dari posita dan bukti nikah; menentukan pertimbangan keabsahan pernikahan.'),
    '3664': ('manual', 'Nomor dan tanggal akta nikah atau penetapan itsbat nikah dibaca dari posita bila ada; selain itu ketik dari bukti surat.'),
    '3665': ('manual', 'Sebab anak belum mempunyai akta kelahiran disampaikan Pemohon di sidang; tidak tercatat di SIPP.'),
    '3666': ('opsional', 'Bukti hubungan darah (hasil tes DNA, pengakuan, keterangan saksi) hanya diisi bila anak lahir sebelum pernikahan para Pemohon.'),
    '3668': ('manual', 'Status anak yang ditetapkan adalah putusan majelis; pilih salah satu: anak sah, anak sah meskipun baru dicatat, atau anak luar kawin dengan hubungan perdata dengan ayah biologis.'),
    '3669': ('manual', 'Daftar bukti surat diketik dari berkas e-Court atau yang diserahkan di sidang (KTP, KK, akta nikah atau penetapan itsbat, surat keterangan lahir).'),
    '3670': ('opsional', 'Pengakuan ayah atas anak hanya diisi bila anak lahir sebelum pernikahan para Pemohon.'),
    '3671': ('manual', 'Dalil atau bukti yang kurang adalah penilaian majelis (blangko Tolak dan Tidak Dapat Diterima); diisi hakim.'),
    '3672': ('opsional', 'Tujuan pengesahan (mis. pengurusan akta kelahiran) bila berbeda dari bunyi bawaan.'),
}

RAMAH = {
    '3660': dict(nm='Tempat dan tanggal lahir anak (tulis "di ... pada tanggal ...")', saran='Dibaca dari posita bila jelas; selain itu ketik dari surat keterangan lahir.'),
    '3662': dict(nm='Keadaan pencatatan pernikahan {P} (pilih satu)', pil=[
        'A · pernikahan baru dicatat Pegawai Pencatat Nikah sesudah anak lahir',
        'B · pernikahan belum dicatat (nikah menurut agama)',
        'C · pernikahan telah diitsbatkan Pengadilan'], saran='Menentukan pertimbangan keabsahan pernikahan para Pemohon.'),
    '3664': dict(nm='Nomor dan tanggal akta nikah atau penetapan itsbat nikah', saran='Mis. Akta Nikah Nomor ... tanggal ... KUA Kecamatan ...'),
    '3665': dict(nm='Sebab anak belum mempunyai akta kelahiran (satu kalimat tanpa titik akhir)'),
    '3666': dict(nm='Bukti hubungan darah anak dengan ayah biologis', saran='Hanya bila anak lahir sebelum pernikahan: mis. "dibuktikan dengan hasil tes DNA ..." atau pengakuan dan keterangan saksi.'),
    '3668': dict(nm='Status anak yang ditetapkan majelis (pilih satu)', pil=[
        'anak sah dari #3673# karena dilahirkan dalam perkawinan yang sah menurut hukum Islam',
        'anak sah dari #3673# karena dilahirkan dalam perkawinan yang sah menurut hukum Islam, meskipun pernikahan tersebut baru dicatat setelah anak dilahirkan',
        'anak yang dilahirkan di luar perkawinan yang sah, yang mempunyai hubungan nasab dan hubungan perdata dengan ibunya dan keluarga ibunya serta hubungan perdata dengan #0098# sebagai ayah biologisnya'],
                saran='Putusan majelis. Pilihan ketiga untuk anak yang lahir sebelum pernikahan para Pemohon (Putusan MK 46/PUU-VIII/2010).'),
    '3669': dict(nm='Bukti surat {P} (P.1 dan seterusnya)', saran='KTP, KK, akta nikah atau penetapan itsbat, surat keterangan lahir anak.'),
    '3670': dict(nm='Pengakuan ayah atas anak', saran='Hanya bila anak lahir sebelum pernikahan: mis. "mengakui anak tersebut sebagai anak kandungnya".'),
    '3671': dict(nm='Pertimbangan majelis atas dalil yang tidak terbukti (isi hakim)', saran='Dalil atau bukti apa yang kurang (blangko Tolak dan Tidak Dapat Diterima).'),
    '3672': dict(nm='Tujuan pengesahan (setelah kata "untuk")', saran='Bawaan: pengurusan akta kelahiran dan dokumen kependudukan anak.'),
}

UU7 = ('Undang-Undang Nomor 7 Tahun 1989 tentang Peradilan Agama sebagaimana telah diubah dengan Undang-Undang Nomor 3 Tahun 2006 dan perubahan kedua dengan Undang-Undang Nomor 50 Tahun 2009')
HEADER = '#8603# #3660# #3662# #3664# #3665# #3666# #3668# #3669# #3670# #3671# #3672# #5197# #5105# #1046# #1217# #8087# #0650# #0651# #1001#'
HEADER_NO = '#8603# #3660# #3662# #3664# #3669# #3671#'
DIBACAKAN = 'Bahwa selanjutnya dibacakan surat #0053# #0046# yang isinya tetap dipertahankan oleh #0046#;'
NASIHAT = ('Bahwa #0690# telah menjelaskan kepada #0046# mengenai pengertian dan akibat hukum pengesahan anak serta pentingnya pencatatan perkawinan dan pencatatan kelahiran anak, '
           'dan #0046# menyatakan telah mengerti dan tetap pada #0053#nya;')


def keterangan_pemohon(akhir):
    return ('Bahwa atas pertanyaan #0690#, #0046# memberikan keterangan yang pada pokoknya bahwa #0046# telah menikah menurut hukum Islam pada tanggal #5197# di #5105#; ' + akhir)


def kewenangan():
    return [
        ('h', 'Pertimbangan Kewenangan Pengadilan'),
        ('b', 'Menimbang, bahwa #0053# #0046# pada pokoknya memohon agar Pengadilan mengesahkan #3661# bernama #8602# yang lahir #3660# sebagai #3661# #0046#, sehingga yang dimohonkan adalah putusan tentang sah tidaknya seorang anak; '
              'perkara tersebut diajukan oleh orang-orang yang beragama Islam dan termasuk bidang perkawinan, sehingga berdasarkan Pasal 49 huruf a beserta Penjelasan Pasal 49 huruf a angka 14 ' + UU7 +
              ' jo. Pasal 44 ayat (2) Undang-Undang Nomor 1 Tahun 1974 tentang Perkawinan yang menentukan bahwa Pengadilan memberikan keputusan tentang sah tidaknya anak atas permintaan pihak yang berkepentingan, perkara a quo termasuk kewenangan absolut Pengadilan Agama;'),
        ('b', 'Menimbang, bahwa #0046# bertempat tinggal di #0101# yang termasuk dalam wilayah hukum #8008#, sehingga #8008# berwenang secara relatif untuk memeriksa, mengadili, dan memutus perkara ini;#8601#'),
        ('h', 'Pertimbangan Kedudukan Hukum (Legal Standing)'),
        ('b', 'Menimbang, bahwa Pasal 44 ayat (2) Undang-Undang Nomor 1 Tahun 1974 tentang Perkawinan memberi wewenang kepada Pengadilan memutus sah tidaknya anak atas permintaan pihak yang berkepentingan; '
              'oleh karena #0046# adalah ayah dan ibu dari #3661# yang dimohonkan pengesahannya, maka #0046# mempunyai kepentingan hukum (legal standing/persona standi in judicio) untuk mengajukan #0053# a quo;'),
    ]


def pokok(unsur):
    return [
        ('h', 'Pertimbangan Pokok Permohonan'),
        ('b', 'Menimbang, bahwa pokok #0053# #0046# adalah agar #3661# bernama #8602# yang lahir #3660# disahkan dan ditetapkan sebagai #3668#, untuk #3672#; ' + unsur),
    ]


BUKTI = [
    ('h', 'Pertimbangan Alat Bukti'),
    ('b', 'Menimbang, bahwa bukti-bukti surat yang diajukan #0046# merupakan fotokopi akta autentik dan surat yang dikeluarkan oleh pejabat yang berwenang, telah bermeterai cukup, telah dinazegelen dan dicocokkan dengan aslinya, sehingga memenuhi syarat formil dan materiil sebagai alat bukti '
          'dan mempunyai kekuatan pembuktian yang sempurna dan mengikat sebagaimana dimaksud Pasal 285 RBg jo. Pasal 1870 KUH Perdata;'),
    ('b', 'Menimbang, bahwa bukti surat berupa fotokopi Kartu Tanda Penduduk dan Kartu Keluarga atas nama #0046# merupakan akta otentik yang dibuat oleh pejabat yang berwenang berdasarkan Undang-Undang Nomor 23 Tahun 2006 sebagaimana telah diubah dengan Undang-Undang Nomor 24 Tahun 2013 tentang Administrasi Kependudukan, '
          'sehingga mempunyai nilai kekuatan pembuktian yang sempurna dan mengikat berdasarkan Pasal 285 RBg selama tidak dibuktikan kepalsuannya; bukti tersebut menerangkan bahwa #0046# beragama Islam dan bertempat tinggal di #0101# yang termasuk dalam wilayah hukum #8008#;'),
    ('b', 'Menimbang, bahwa bukti surat tentang pernikahan #0046#, sebagaimana tercantum dalam daftar alat bukti di atas, menerangkan bahwa #0046# telah menikah pada tanggal #5197# di #5105#, dan pernikahan tersebut #3674#; bukti tersebut relevan dengan dalil yang harus dibuktikan #0046#;'),
    ('b', 'Menimbang, bahwa bukti surat berupa surat keterangan lahir atau akta kelahiran atas nama #8602# menerangkan kelahiran #3661# tersebut, yaitu #3660#, dan relevan dengan dalil yang harus dibuktikan #0046#;'),
    ('b', 'Menimbang, bahwa saksi-saksi #0046# telah dewasa, bukan orang yang dilarang menjadi saksi, memberikan keterangan di bawah sumpah secara terpisah di persidangan, dan keterangannya didasarkan pada pengetahuan sendiri serta saling bersesuaian, '
          'sehingga memenuhi syarat formil dan materiil sebagaimana diatur dalam Pasal 172 ayat (1), Pasal 308 dan Pasal 309 RBg, oleh karena itu keterangan para saksi tersebut dapat diterima sebagai alat bukti;'),
    ('b', 'Menimbang, bahwa saksi-saksi #0046# pada pokoknya menerangkan tentang pernikahan #0046# menurut hukum Islam, kelahiran dan pengasuhan #8602# oleh #3673#, serta tidak adanya pihak yang menyangkal atau mempersoalkan status #3661# tersebut; '
          'keterangan tersebut bersumber dari penglihatan, pendengaran atau pengalaman saksi sendiri serta saling bersesuaian, sehingga telah memenuhi syarat materiil;'),
]

BIAYA = [
    ('h', 'Pertimbangan Biaya Perkara'),
    ('b', 'Menimbang, bahwa oleh karena perkara ini termasuk bidang perkawinan dan bersifat voluntair, maka berdasarkan Pasal 89 ayat (1) ' + UU7 + ', biaya perkara dibebankan kepada #0046#;'),
    ('b', 'Memperhatikan segala peraturan perundang-undangan yang berlaku dan hukum Islam yang berkaitan dengan perkara ini;'),
]

FAKTA_NIKAH = [
    'Bahwa #3673# telah menikah menurut hukum Islam pada tanggal #5197# di #5105#, dengan wali nikah #1046# bernama #1217#, yang menikahkan #8087#, disaksikan oleh #0650# dan #0651#, dengan mas kawin berupa #1001#;',
    'Bahwa di antara #0046# tidak terdapat pertalian nasab, semenda dan sesusuan serta larangan menikah, dan tidak ada pihak yang keberatan atas pernikahan tersebut;',
    'Bahwa pernikahan tersebut #3674#;',
]


def fakta(butir):
    return [('h', 'Pertimbangan Hal-Hal yang Terbukti dan Fakta Hukum'),
            ('b', 'Menimbang, bahwa berdasarkan keterangan #0046#, bukti surat dan keterangan saksi-saksi, ditemukan fakta hukum sebagai berikut:')] + [('n', t) for t in butir]


def _petitum_sah():
    return [
        ('h', 'Pertimbangan Petitum'),
        ('b', 'Menimbang, bahwa selanjutnya #8554# akan mempertimbangkan petitum #0053# #0046# sesuai dengan fakta-fakta persidangan yang telah diuraikan di atas sebagai berikut;'),
        ('b', 'Petitum agar #3661# bernama #8602# disahkan sebagai #3661# #0046#'),
        ('b', 'Menimbang, bahwa menurut Pasal 42 Undang-Undang Nomor 1 Tahun 1974 tentang Perkawinan dan Pasal 99 huruf a Kompilasi Hukum Islam, anak yang sah adalah anak yang dilahirkan dalam atau sebagai akibat perkawinan yang sah, sedangkan Pasal 2 ayat (1) Undang-Undang Nomor 1 Tahun 1974 menentukan bahwa perkawinan adalah sah apabila dilakukan menurut hukum masing-masing agamanya dan kepercayaannya itu; '
              'berdasarkan fakta hukum, pernikahan #0046# dilaksanakan dengan wali nikah, saksi nikah, mas kawin serta ijab dan kabul sehingga rukun perkawinan sebagaimana Pasal 14 Kompilasi Hukum Islam terpenuhi dan tidak terdapat halangan perkawinan sebagaimana Pasal 39 sampai dengan Pasal 44 Kompilasi Hukum Islam, sehingga pernikahan tersebut sah menurut hukum Islam;'),
        ('b', '#3663#'),
        ('b', 'Menimbang, bahwa Pasal 44 ayat (1) Undang-Undang Nomor 1 Tahun 1974 hanya memberi hak kepada suami untuk menyangkal sahnya anak yang dilahirkan istrinya bilamana ia dapat membuktikan bahwa istrinya telah berzina dan anak itu akibat perzinaan tersebut; dalam perkara ini tidak ada penyangkalan dari pihak mana pun terhadap status #8602# sebagai #3661# #0046#;'),
        ('b', 'Menimbang, bahwa berdasarkan fakta hukum dan ketentuan tersebut, #8554# berpendapat bahwa #8602# adalah #3668#;'),
        ('b', '#3676#'),
        ('b', 'Menimbang, bahwa berdasarkan seluruh pertimbangan tersebut di atas, #0053# #0046# telah beralasan hukum dan oleh karenanya dapat dikabulkan;'),
    ]


def kabul_perkawinan_sah():
    """[01] Anak lahir dalam perkawinan yang sah menurut hukum Islam yang belum atau baru dicatat (atau telah diitsbatkan)."""
    timbang = [('b', 'Menimbang, bahwa maksud dan tujuan #0053# #0046# adalah sebagaimana telah diuraikan di atas;')]
    timbang += kewenangan()
    timbang += pokok('oleh karena itu pokok yang harus dibuktikan adalah: (1) bahwa #0046# telah menikah menurut hukum Islam dengan memenuhi rukun dan syarat tanpa halangan perkawinan; (2) bahwa #3661# tersebut dilahirkan dalam atau sebagai akibat pernikahan itu; serta (3) bahwa pengesahan tersebut diperlukan untuk #3672#;')
    timbang += BUKTI
    timbang += fakta(FAKTA_NIKAH + [
        'Bahwa dari pernikahan tersebut telah lahir #3661# bernama #8602#, yang lahir #3660##4313#;',
        'Bahwa #3661# tersebut diasuh dan dibiayai oleh #3673#, sedangkan tidak ada pihak yang menyangkal atau mempersoalkan statusnya;',
        'Bahwa #3661# tersebut #3665#;'])
    timbang += _petitum_sah()
    return dict(
        header=HEADER,
        dengar='Telah mendengar keterangan #0046# dan saksi-saksi serta memeriksa alat-alat bukti di persidangan;',
        duduk=['Bahwa pada hari sidang yang telah ditetapkan, #4046# telah datang menghadap di persidangan;', NASIHAT, DIBACAKAN,
               keterangan_pemohon('bahwa dari pernikahan tersebut telah lahir #3661# bernama #8602# yang lahir #3660#; bahwa pernikahan tersebut #3674#; dan bahwa #0046# memohon pengesahan agar #3661# tersebut ditetapkan sebagai #3668# untuk #3672#;')],
        timbang=timbang + BIAYA, amar=_amar_kabul())


def _amar_kabul():
    return ['Mengabulkan #0053# #0046#;',
            'Menetapkan bahwa #3661# bernama #8602#, yang lahir #3660#, adalah #3668#;',
            '#8505# (#0155# #7095#).']


def kabul_lahir_sebelum_nikah():
    """[01a] Anak lahir sebelum pernikahan para Pemohon: pengakuan ayah / hubungan darah, hubungan perdata menurut Putusan MK 46/PUU-VIII/2010; status = pilihan majelis."""
    timbang = [('b', 'Menimbang, bahwa maksud dan tujuan #0053# #0046# adalah sebagaimana telah diuraikan di atas;')]
    timbang += kewenangan()
    timbang += pokok('oleh karena itu pokok yang harus dibuktikan adalah: (1) bahwa #3661# tersebut lahir sebelum pernikahan #0046# dan hubungan darah dengan #0098# sebagai ayah biologisnya; (2) bahwa #0046# kemudian menikah menurut hukum Islam; serta (3) bahwa pengesahan tersebut diperlukan untuk #3672#;')
    timbang += BUKTI
    timbang += [('b', 'Menimbang, bahwa alat bukti yang berkaitan dengan hubungan darah dan pengakuan ayah, sebagaimana diuraikan dalam duduk perkara, dinilai #8554# bersama-sama dengan keterangan saksi-saksi dan bukti surat lainnya;')]
    timbang += fakta(FAKTA_NIKAH[:2] + [
        'Bahwa pernikahan tersebut #3674#;',
        'Bahwa #3661# bernama #8602# lahir #3660#, yaitu sebelum pernikahan #0046# pada tanggal #5197#, dari hubungan antara #3673# yang kemudian menikah;',
        'Bahwa hubungan darah antara #8602# dengan #0098# #3666#;',
        'Bahwa #3661# tersebut #3665# dan diasuh serta dibiayai oleh #3673#, sedangkan tidak ada pihak yang menyangkal atau mempersoalkan statusnya;'])
    timbang += [
        ('h', 'Pertimbangan Petitum'),
        ('b', 'Menimbang, bahwa selanjutnya #8554# akan mempertimbangkan petitum #0053# #0046# sesuai dengan fakta-fakta persidangan yang telah diuraikan di atas sebagai berikut;'),
        ('b', 'Petitum agar #3661# bernama #8602# disahkan sebagai #3661# #0046#'),
        ('b', 'Menimbang, bahwa menurut Pasal 42 Undang-Undang Nomor 1 Tahun 1974 tentang Perkawinan dan Pasal 99 huruf a Kompilasi Hukum Islam, anak yang sah adalah anak yang dilahirkan dalam atau sebagai akibat perkawinan yang sah, sedangkan menurut Pasal 43 ayat (1) Undang-Undang Nomor 1 Tahun 1974 tentang Perkawinan dan Pasal 100 Kompilasi Hukum Islam, '
              'anak yang dilahirkan di luar perkawinan hanya mempunyai hubungan nasab dengan ibunya dan keluarga ibunya;'),
        ('b', 'Menimbang, bahwa Mahkamah Konstitusi dalam Putusan Nomor 46/PUU-VIII/2010 menyatakan bahwa Pasal 43 ayat (1) Undang-Undang Nomor 1 Tahun 1974 harus dibaca bahwa anak yang dilahirkan di luar perkawinan mempunyai hubungan perdata dengan ibunya dan keluarga ibunya serta dengan laki-laki sebagai ayahnya yang dapat dibuktikan berdasarkan ilmu pengetahuan dan teknologi dan/atau alat bukti lain menurut hukum mempunyai hubungan darah, termasuk hubungan perdata dengan keluarga ayahnya;#3667##3675#'),
        ('b', 'Menimbang, bahwa berdasarkan fakta hukum, #8602# lahir sebelum pernikahan #0046# pada tanggal #5197#, sehingga kelahirannya tidak terjadi dalam perkawinan yang sah; oleh karena itu status #3661# tersebut harus dinilai menurut ketentuan tentang anak yang dilahirkan di luar perkawinan dan ketentuan tentang hubungan perdata dengan ayah biologisnya, '
              'dan #8554# berpendapat bahwa #8602# adalah #3668#;'),
        ('b', '#3676#'),
        ('b', 'Menimbang, bahwa berdasarkan seluruh pertimbangan tersebut di atas, #0053# #0046# telah beralasan hukum dan oleh karenanya dapat dikabulkan sebagaimana amar penetapan ini;'),
    ]
    return dict(
        header=HEADER,
        dengar='Telah mendengar keterangan #0046# dan saksi-saksi serta memeriksa alat-alat bukti di persidangan;',
        duduk=['Bahwa pada hari sidang yang telah ditetapkan, #4046# telah datang menghadap di persidangan;', NASIHAT, DIBACAKAN,
               keterangan_pemohon('bahwa #3661# bernama #8602# lahir #3660#, yaitu sebelum pernikahan tersebut; bahwa #0098# adalah ayah biologis #3661# tersebut dan hubungan darah itu #3666#; dan bahwa #0046# memohon pengesahan untuk #3672#;')],
        timbang=timbang + BIAYA, amar=_amar_kabul())


def tolak_tidak_terbukti():
    """[03] Dalil permohonan pengesahan tidak terbukti (pernikahan, kelahiran atau pengasuhan)."""
    timbang = [('b', 'Menimbang, bahwa maksud dan tujuan #0053# #0046# adalah sebagaimana telah diuraikan di atas;')]
    timbang += kewenangan()
    timbang += pokok('oleh karena itu #0046# wajib membuktikan pernikahannya menurut hukum Islam dan kelahiran #3661# tersebut dalam atau akibat pernikahan itu;')
    timbang += BUKTI[:-1]
    timbang += [BUKTI[-1][:1] + ('Menimbang, bahwa saksi-saksi #0046# telah memberikan keterangan sebagaimana diuraikan dalam duduk perkara; keterangan tersebut dinilai #8554# dalam hubungannya dengan dalil yang harus dibuktikan;',)]
    timbang += [
        ('h', 'Pertimbangan Petitum'),
        ('b', 'Menimbang, bahwa Pasal 42 Undang-Undang Nomor 1 Tahun 1974 tentang Perkawinan menentukan bahwa anak yang sah adalah anak yang dilahirkan dalam atau sebagai akibat perkawinan yang sah, sehingga pengesahan anak mensyaratkan terbuktinya perkawinan yang sah antara orang tua anak dan terbuktinya kelahiran anak dalam atau akibat perkawinan itu;'),
        ('b', 'Menimbang, bahwa terhadap dalil-dalil tersebut, #8554# berpendapat bahwa #3671#, sehingga dalil #0046# tidak terbukti;'),
        ('b', 'Menimbang, bahwa oleh karena dalil #0053# #0046# tidak terbukti, maka #0053# #0046# harus ditolak, dengan tidak menutup kemungkinan #0046# mengajukan permohonan kembali, termasuk permohonan itsbat nikah bila pernikahannya belum dapat dibuktikan dengan akta nikah;'),
    ]
    return dict(header=HEADER_NO, dengar='Telah mendengar keterangan #0046# dan saksi-saksi serta memeriksa alat-alat bukti di persidangan;',
                duduk=['Bahwa pada hari sidang yang telah ditetapkan, #4046# telah datang menghadap di persidangan;', DIBACAKAN,
                       keterangan_pemohon('bahwa dari pernikahan tersebut telah lahir #3661# bernama #8602# yang lahir #3660#; dan bahwa #0046# memohon pengesahan agar #3661# tersebut ditetapkan sebagai anak sah #0046#;')],
                timbang=timbang + BIAYA, amar=['Menolak #0053# #0046#;', '#8505# (#0155# #7095#).'])


def tolak_hubungan_darah():
    """[03a] Anak lahir sebelum pernikahan: pengakuan atau hubungan darah dengan ayah biologis tidak terbukti."""
    d = kabul_lahir_sebelum_nikah()
    timbang = []
    for jenis, t in d['timbang']:
        if t.startswith('Pertimbangan Petitum'):
            break
        timbang.append((jenis, t))
    timbang += [
        ('h', 'Pertimbangan Petitum'),
        ('b', 'Menimbang, bahwa selanjutnya #8554# akan mempertimbangkan petitum #0053# #0046# sesuai dengan fakta-fakta persidangan yang telah diuraikan di atas sebagai berikut;'),
        ('b', 'Menimbang, bahwa Mahkamah Konstitusi dalam Putusan Nomor 46/PUU-VIII/2010 menyatakan bahwa hubungan perdata anak yang dilahirkan di luar perkawinan dengan laki-laki sebagai ayahnya harus dapat dibuktikan berdasarkan ilmu pengetahuan dan teknologi dan/atau alat bukti lain menurut hukum mempunyai hubungan darah;'),
        ('b', 'Menimbang, bahwa terhadap bukti hubungan darah dan pengakuan yang diajukan #0046#, #8554# berpendapat bahwa #3671#, sehingga hubungan darah antara #8602# dengan #0098# tidak terbukti;'),
        ('b', 'Menimbang, bahwa oleh karena hubungan darah tidak terbukti, maka pengesahan anak tidak dapat dikabulkan dan #0053# #0046# harus ditolak;'),
    ] + BIAYA
    d['timbang'] = timbang
    d['amar'] = ['Menolak #0053# #0046#;', '#8505# (#0155# #7095#).']
    return d


def _no(dengar, duduk, inti):
    timbang = [('b', 'Menimbang, bahwa maksud dan tujuan #0053# #0046# adalah sebagaimana telah diuraikan di atas;')]
    timbang += kewenangan()[:3]
    timbang += inti
    return dict(header=HEADER_NO, dengar=dengar, duduk=duduk, timbang=timbang + BIAYA,
                amar=['Menyatakan #0053# #0046# tidak dapat diterima (Niet Ontvankelijke Verklaard);', '#8505# (#0155# #7095#).'])


def no_perkawinan_belum_terbukti():
    return _no('Telah mendengar keterangan #0046# dan saksi-saksi serta memeriksa alat-alat bukti di persidangan;',
               ['Bahwa pada hari sidang yang telah ditetapkan, #4046# telah datang menghadap di persidangan;', DIBACAKAN,
                keterangan_pemohon('bahwa dari pernikahan tersebut telah lahir #3661# bernama #8602# yang lahir #3660#; dan bahwa pernikahan tersebut belum dapat dibuktikan dengan akta nikah;')],
               [('h', 'Pertimbangan Keabsahan Pernikahan Orang Tua Anak'),
                ('b', 'Menimbang, bahwa Pasal 42 Undang-Undang Nomor 1 Tahun 1974 tentang Perkawinan dan Pasal 99 huruf a Kompilasi Hukum Islam menentukan bahwa anak yang sah adalah anak yang dilahirkan dalam atau sebagai akibat perkawinan yang sah, sehingga pengesahan anak mensyaratkan adanya perkawinan orang tua anak yang sah dan terbukti;'),
                ('b', 'Menimbang, bahwa Pasal 7 ayat (1) dan ayat (2) Kompilasi Hukum Islam menentukan bahwa perkawinan hanya dapat dibuktikan dengan akta nikah dan, dalam hal perkawinan tidak dapat dibuktikan dengan akta nikah, dapat diajukan itsbat nikahnya ke Pengadilan Agama;'),
                ('b', 'Menimbang, bahwa berdasarkan bukti dan keterangan di persidangan, #3671#, sehingga keabsahan pernikahan #0046# belum ditetapkan oleh Pengadilan; oleh karena keabsahan pernikahan merupakan dasar pengesahan anak, maka #0053# a quo belum tepat dan prematur;'),
                ('b', 'Menimbang, bahwa oleh karena itu #0053# #0046# harus dinyatakan tidak dapat diterima (Niet Ontvankelijke Verklaard) tanpa mempertimbangkan pokok permohonannya, dan #0046# dapat lebih dahulu mengajukan permohonan itsbat nikah;')])


def no_bukan_orang_tua():
    return _no('Telah mendengar keterangan #0046# dan saksi-saksi serta memeriksa alat-alat bukti di persidangan;',
               ['Bahwa pada hari sidang yang telah ditetapkan, #4046# telah datang menghadap di persidangan;', DIBACAKAN,
                'Bahwa atas pertanyaan #0690#, #0046# memberikan keterangan yang pada pokoknya bahwa #0046# memohon agar #8602# yang lahir #3660# disahkan sebagai anak sah; dan bahwa hubungan #0046# dengan #8602# #3671#;'],
               [('h', 'Pertimbangan Kedudukan Hukum (Legal Standing)'),
                ('b', 'Menimbang, bahwa Pasal 44 ayat (2) Undang-Undang Nomor 1 Tahun 1974 tentang Perkawinan menentukan bahwa Pengadilan memberikan keputusan tentang sah tidaknya anak atas permintaan pihak yang berkepentingan, sehingga pemohon harus mempunyai kepentingan hukum langsung terhadap status anak yang dimohonkan, terutama sebagai ayah atau ibu dari anak tersebut;'),
                ('b', 'Menimbang, bahwa berdasarkan bukti dan keterangan di persidangan, #3671#, sehingga #0046# tidak terbukti sebagai ayah atau ibu dari #8602# dan tidak mempunyai kepentingan hukum langsung untuk mengajukan #0053# a quo;'),
                ('b', 'Menimbang, bahwa oleh karena itu #0053# #0046# harus dinyatakan tidak dapat diterima (Niet Ontvankelijke Verklaard) tanpa mempertimbangkan pokok permohonannya;')])


def no_sudah_berakta():
    return _no('Telah mendengar keterangan #0046# dan saksi-saksi serta memeriksa alat-alat bukti di persidangan;',
               ['Bahwa pada hari sidang yang telah ditetapkan, #4046# telah datang menghadap di persidangan;', DIBACAKAN,
                'Bahwa atas pertanyaan #0690#, #0046# memberikan keterangan yang pada pokoknya bahwa #8602# yang lahir #3660# telah mempunyai akta kelahiran yang memuat nama #0046# sebagai orang tuanya;'],
               [('h', 'Pertimbangan Kepentingan Hukum'),
                ('b', 'Menimbang, bahwa Pasal 55 ayat (1) Undang-Undang Nomor 1 Tahun 1974 tentang Perkawinan menentukan bahwa asal usul seorang anak hanya dapat dibuktikan dengan akta kelahiran yang autentik yang dikeluarkan oleh pejabat yang berwenang, dan penetapan Pengadilan menurut ayat (2) hanya diperlukan bila akta kelahiran tersebut tidak ada;'),
                ('b', 'Menimbang, bahwa berdasarkan bukti dan keterangan di persidangan, #8602# telah mempunyai akta kelahiran yang memuat nama #0046# sebagai orang tuanya, dan #3671#, sehingga tidak ada keadaan yang menimbulkan sengketa atas status anak tersebut yang harus diputus oleh Pengadilan;'),
                ('b', 'Menimbang, bahwa oleh karena itu #0046# tidak mempunyai kepentingan hukum untuk memperoleh pengesahan dari Pengadilan, dan #0053# #0046# harus dinyatakan tidak dapat diterima (Niet Ontvankelijke Verklaard) tanpa mempertimbangkan pokok permohonannya;')])


S_ = J['singkat']
BLANGKO = [
    ('[01] [Kabul] %s - Anak Lahir dalam Perkawinan Sah yang Belum atau Baru Dicatat.rtf' % S_, kabul_perkawinan_sah, '',
     'Anak lahir dalam perkawinan sah menurut hukum Islam yang belum/baru dicatat atau telah diitsbatkan (pilih A/B/C di 3662); status anak = pilihan majelis 3668.'),
    ('[01a] [Kabul] %s - Anak Lahir Sebelum Pernikahan Para Pemohon (Pengakuan atau Hubungan Darah).rtf' % S_, kabul_lahir_sebelum_nikah, 'lahir-sebelum-nikah',
     'Anak lahir sebelum pernikahan para Pemohon: pengakuan ayah/tes DNA (isi 3666 dan 3670), Pasal 43 ayat (1) UU 1/1974 sebagaimana dimaknai Putusan MK 46/PUU-VIII/2010; pilih status di 3668.'),
    ('[03] [Tolak] %s - Dalil Pengesahan Tidak Terbukti.rtf' % S_, tolak_tidak_terbukti, '',
     'Pernikahan atau kelahiran anak tidak terbukti; uraikan di 3671.'),
    ('[03a] [Tolak] %s - Hubungan Darah atau Pengakuan Tidak Terbukti.rtf' % S_, tolak_hubungan_darah, 'hubungan-darah-tidak-terbukti',
     'Anak lahir sebelum pernikahan tetapi hubungan darah/pengakuan tidak terbukti; uraikan di 3671.'),
    ('[99a] [NO] %s - Pernikahan Orang Tua Belum Terbukti Sah (Itsbat Nikah Lebih Dahulu).rtf' % S_, no_perkawinan_belum_terbukti, 'perkawinan-belum-terbukti',
     'Pengesahan anak prematur karena pernikahan orang tua belum dibuktikan sah (belum akta nikah/itsbat); uraikan di 3671.'),
    ('[99b] [NO] %s - Pemohon Bukan Orang Tua atau Tidak Berkepentingan.rtf' % S_, no_bukan_orang_tua, 'bukan-orang-tua',
     'Pemohon bukan ayah atau ibu anak / tidak berkepentingan langsung (Pasal 44 ayat (2) UU 1/1974); uraikan di 3671.'),
    ('[99c] [NO] %s - Anak Sudah Mempunyai Akta Kelahiran.rtf' % S_, no_sudah_berakta, 'sudah-berakta',
     'Anak sudah mempunyai akta kelahiran yang memuat nama orang tuanya dan tidak ada sengketa status (Pasal 55 ayat (1) UU 1/1974); uraikan di 3671.'),
]

NASIHAT_BAS = ('#0690# menjelaskan kepada #7036# tentang pengertian dan akibat hukum pengesahan anak serta pentingnya pencatatan perkawinan dan pencatatan kelahiran anak, '
               'dan atas penjelasan tersebut #7036# menyatakan tetap pada #0053#nya;')
HEADER_BAS = '#8603# #3660# #3662# #3664# #3665# #3666# #3670# #3672# #5197# #5105# #3669#'
BAS_SEMUA_HEADER = ('[1]', '[1a]', '[1b]', '[1c]', '[2]', '[2a]', '[2b]', '[3]')


def _bas_langkah(nama):
    m = re.search(r' - (\[[0-9a-zA-Z]+\]) ', nama)
    return m.group(1) if m else ''


def bangun_bas():
    paths = L.buat_bas_permohonan(J, None, '3669')
    hasil = []
    for p in paths:
        nama = os.path.basename(p)
        raw = open(L.lp(p), 'rb').read().decode('latin1')
        langkah = _bas_langkah(nama)
        raw = L.ganti_paragraf(raw, r'^#0690# menjelaskan kepada #7036# tentang hal-hal', NASIHAT_BAS, wajib=False)
        if langkah in BAS_SEMUA_HEADER:
            raw = S.tambah_header_bas(raw, HEADER_BAS + (' #9134#' if langkah in ('[1c]', '[2a]') else ''))
        hasil.append(L.simpan_bas(J, nama, raw))
    return hasil


def bangun():
    hasil = []
    for berkas, fungsi, _k, _c in BLANGKO:
        spek = fungsi()
        raw = S.penetapan(spek['header'], spek['dengar'], spek['duduk'], '#3669#', spek['timbang'], spek['amar'])
        hasil.append(L.simpan_putusan(J, berkas, raw))
    hasil += L.buat_umum_permohonan(J)
    hasil += bangun_bas()
    return hasil


PETA = [L.meta(J, b, k, c) for b, _f, k, c in BLANGKO] + L.meta_umum_permohonan(J)


# ---------------------------------------------------------------------------------------------------------------------
# KATALOG SAKSI  ekstensi-sipp/saksi-katalog/pengesahan-anak.json  (skema saksi-katalog/1)
# ---------------------------------------------------------------------------------------------------------------------
def katalog():
    import w3aB_katalog as K
    N = 'naskah lokal uu1-1974-bpk.txt (BPK), dicocokkan 21 Okt 2026'
    KH = 'KHI-pasal-terverifikasi.md, dicocokkan 21 Okt 2026'
    dasar = [
        K.dh('dh-pasal-49a-14', 'Penjelasan Pasal 49 huruf a angka 14 UU 7/1989 jo UU 3/2006 jo UU 50/2009', 'putusan tentang sah tidaknya seorang anak termasuk kewenangan Pengadilan Agama',
             'naskah lokal ekstra/uu3-2006.txt (Penjelasan Pasal 49 huruf a angka 14), dicocokkan 21 Okt 2026'),
        K.dh('dh-uu1-44-2', 'Pasal 44 ayat (2) UU 1/1974', 'Pengadilan memberikan keputusan tentang sah tidaknya anak atas permintaan pihak yang berkepentingan', N),
        K.dh('dh-uu1-2', 'Pasal 2 ayat (1) dan ayat (2) UU 1/1974', 'perkawinan sah bila dilakukan menurut hukum agamanya; tiap perkawinan dicatat menurut peraturan perundang-undangan', N),
        K.dh('dh-uu1-42', 'Pasal 42 UU 1/1974', 'anak yang sah adalah anak yang dilahirkan dalam atau sebagai akibat perkawinan yang sah', N),
        K.dh('dh-uu1-43-mk46', 'Pasal 43 ayat (1) UU 1/1974 dan Putusan MK 46/PUU-VIII/2010',
             'anak yang dilahirkan di luar perkawinan mempunyai hubungan perdata dengan ibunya dan keluarga ibunya serta dengan laki-laki sebagai ayahnya yang dapat dibuktikan berdasarkan ilmu pengetahuan dan teknologi dan/atau alat bukti lain menurut hukum mempunyai hubungan darah',
             'naskah lokal mk46/mk46.txt (pertimbangan [3.14] dan amar), dicocokkan 21 Okt 2026'),
        K.dh('dh-uu1-55', 'Pasal 55 UU 1/1974', 'asal usul anak dibuktikan dengan akta kelahiran autentik; bila tidak ada Pengadilan dapat menetapkan setelah pemeriksaan yang teliti', N),
        K.dh('dh-khi-99-100', 'Pasal 99 dan Pasal 100 KHI', 'anak sah ialah anak yang dilahirkan dalam atau akibat perkawinan yang sah; anak di luar perkawinan hanya mempunyai hubungan nasab dengan ibunya', KH),
        K.dh('dh-khi-14', 'Pasal 14 KHI', 'rukun perkawinan: calon suami, calon istri, wali nikah, dua saksi, ijab dan kabul', KH),
        K.dh('dh-khi-39-44', 'Pasal 39 sampai dengan Pasal 44 KHI', 'larangan kawin karena pertalian nasab, semenda, sesusuan, dan keadaan tertentu', KH),
        K.dh('dh-khi-7', 'Pasal 7 ayat (1), (2) dan (3) KHI', 'perkawinan dibuktikan dengan akta nikah; bila tidak ada dapat diajukan itsbat nikah ke Pengadilan Agama', KH),
        K.dh('dh-uu23-5-27', 'Pasal 5 dan Pasal 27 ayat (1) dan (2) UU 23/2002 jo UU 35/2014', 'anak berhak atas nama sebagai identitas diri yang dituangkan dalam akta kelahiran',
             'naskah lokal ekstra/uu23-2002.txt dan uu35-2014.txt (Pasal 5, Pasal 27 ayat (1), (2)), dicocokkan 21 Okt 2026'),
        K.dh('dh-rbg-saksi-formil', 'Pasal 172 ayat (1) dan Pasal 175 RBg', 'syarat formil saksi: bukan orang yang dilarang didengar dan disumpah menurut agamanya',
             'Pasal 172 ayat (1) dan Pasal 175 RBg, dicocokkan dengan naskah 18 Okt 2026 (VERIFIKASI-HIR-RBG.md); dipakai pula blangko Derry 7 Wali Adhal [01a]'),
        K.dh('dh-rbg-saksi-materiil', 'Pasal 308 dan Pasal 309 RBg', 'syarat materiil saksi: keterangan berdasar pengetahuan sendiri dan saling bersesuaian',
             'Pasal 308, 309 RBg, dicocokkan dengan naskah 18 Okt 2026 (VERIFIKASI-HIR-RBG.md); dipakai pula blangko Derry 7 Wali Adhal [01a]'),
    ]
    keadaan = {
        'waktuLahir': dict(sumber='borang', nilai=['dalam-perkawinan', 'sebelum-nikah'], bawaan='dalam-perkawinan', label='Waktu anak lahir terhadap pernikahan para Pemohon'),
        'pencatatanNikah': dict(sumber='borang', nilai=['dicatat-kemudian', 'belum-dicatat', 'sudah-itsbat'], bawaan='dicatat-kemudian', label='Keadaan pencatatan pernikahan para Pemohon'),
    }
    pokok = [
        dict(id='pp-saksi-formil', judul='Syarat formil saksi', uraian='saksi mengenal Pemohon, menyebut hubungannya, dan tidak berkepentingan', dasarHukum=['dh-rbg-saksi-formil'], wajib=True),
        dict(id='pp-maksud-permohonan', judul='Maksud permohonan pengesahan anak', uraian='para Pemohon memohon anak mereka disahkan sebagai anak sah', dasarHukum=['dh-pasal-49a-14', 'dh-uu1-44-2'], wajib=True),
        dict(id='pp-pernikahan', judul='Pernikahan para Pemohon', uraian='waktu dan tempat pernikahan para Pemohon menurut hukum Islam', dasarHukum=['dh-uu1-2', 'dh-khi-14'], wajib=True),
        dict(id='pp-rukun-nikah', judul='Rukun pernikahan terpenuhi', uraian='wali nikah, saksi nikah, mas kawin serta ijab dan kabul', dasarHukum=['dh-khi-14', 'dh-uu1-2'], wajib=True),
        dict(id='pp-halangan', judul='Tidak ada halangan perkawinan', uraian='tidak ada larangan nasab, semenda, sesusuan dan tidak ada yang keberatan atas pernikahan', dasarHukum=['dh-khi-39-44'], wajib=True),
        dict(id='pp-pencatatan', judul='Pencatatan pernikahan', uraian='pernikahan dicatat kemudian, belum dicatat, atau telah diitsbatkan', dasarHukum=['dh-uu1-2', 'dh-khi-7'], wajib=True),
        dict(id='pp-kelahiran-anak', judul='Kelahiran anak', uraian='nama, tempat dan tanggal lahir anak yang dimohonkan pengesahannya', dasarHukum=['dh-uu1-42', 'dh-khi-99-100'], wajib=True),
        dict(id='pp-hubungan-anak', judul='Hubungan anak dengan para Pemohon dan pengasuhan', uraian='anak adalah anak kandung para Pemohon yang diasuh dan dibiayai oleh mereka', dasarHukum=['dh-uu1-44-2', 'dh-uu1-42'], wajib=True),
        dict(id='pp-sengketa', judul='Tidak ada penyangkalan status anak', uraian='tidak ada pihak yang menyangkal atau mempersoalkan status anak', dasarHukum=['dh-uu1-44-2'], wajib=True),
        dict(id='pp-sebelum-nikah', judul='Anak lahir sebelum pernikahan para Pemohon', uraian='anak lahir sebelum pernikahan sehingga status dinilai menurut ketentuan anak di luar perkawinan', dasarHukum=['dh-uu1-43-mk46', 'dh-khi-99-100'], wajib=False),
        dict(id='pp-hubungan-darah', judul='Hubungan darah dan pengakuan ayah', uraian='hubungan darah anak dengan ayah biologis dibuktikan dengan ilmu pengetahuan dan teknologi dan/atau alat bukti lain serta pengakuan ayah', dasarHukum=['dh-uu1-43-mk46'], wajib=False),
        dict(id='pp-akta-kelahiran', judul='Akta kelahiran anak', uraian='anak belum mempunyai akta kelahiran dan sebabnya', dasarHukum=['dh-uu1-55', 'dh-uu23-5-27'], wajib=False),
        dict(id='pp-tujuan', judul='Tujuan dan kepentingan terbaik anak', uraian='pengesahan diperlukan untuk kepastian status dan identitas anak', dasarHukum=['dh-uu23-5-27'], wajib=False),
        dict(id='pp-penutup', judul='Penutup', uraian='saksi menyatakan keterangannya telah cukup', dasarHukum=['dh-rbg-saksi-materiil'], wajib=False),
    ]
    b = K.B
    butir = []
    butir.append(K.dari_wali_adhal('q-kenal-pemohon', pokok='pp-saksi-formil'))
    butir.append(K.butir_sederhana(
        'q-hubungan-kepentingan', 'pp-saksi-formil', 20, 'inti', 'hubungan',
        'Apakah saksi mempunyai kepentingan atau hubungan lain dengan #0046# yang dapat memengaruhi keterangan saksi ?', 'saksi tidak punya kepentingan yang memengaruhi keterangannya',
        ['saya tidak mempunyai kepentingan apa pun atas permohonan #0046# ini selain menjadi saksi', 'saya datang hanya sebagai saksi dan tidak punya kepentingan pribadi terhadap #0046# maupun anaknya',
         'saya tidak mempunyai hubungan kepentingan dengan siapa pun dalam perkara #0046# ini selain sebagai saksi', 'tidak ada kepentingan lain pada saya dalam perkara #0046# ini selain memberikan keterangan'],
        ['keterangan ini saya berikan tanpa kepentingan pribadi terhadap #0046# ataupun keluarganya', 'tak ada kepentingan lain antara saya dan #0046# selain keterangan yang saya berikan hari ini',
         'saya tidak berkepentingan apa pun atas hasil perkara #0046# ini', 'tiada kepentingan saya dalam perkara #0046# ini selain sebagai saksi'],
        teks_varian=['Apakah saksi punya kepentingan lain atas permohonan #0046# ini ?']))
    butir.append(b('q-maksud-pengesahan', 'pp-maksud-permohonan', 30, 'inti', 'pokok', 'Apakah saksi mengetahui maksud #0046# mengajukan permohonan pengesahan anak ini ?', 'maksud Pemohon mengajukan permohonan pengesahan anak',
                   '#0046# ingin agar #8602# ditetapkan sebagai anak sah #0046# untuk #3672#', 'maksud #0046# memohon pengesahan adalah agar #8602# menjadi anak sah #0046# guna #3672#',
                   '#0046# memohon pengesahan atas #8602#', 'permohonan #0046# adalah tentang pengesahan #8602#',
                   teks_varian=['Apa yang diinginkan #0046# sehingga datang ke Pengadilan untuk memohon pengesahan anak ?']).json())
    butir.append(b('q-pernikahan-pemohon', 'pp-pernikahan', 40, 'inti', 'pokok', 'Kapan dan di mana #0046# menikah menurut agama Islam ?', 'waktu dan tempat pernikahan Pemohon',
                   '#0046# menikah menurut hukum Islam pada tanggal #5197# di #5105#', 'pernikahan #0046# dilangsungkan menurut ajaran Islam di #5105# pada tanggal #5197#',
                   '#0046# menikah pada tanggal #5197#', 'pernikahan #0046# terjadi pada tanggal #5197#').json())
    butir.append(b('q-rukun-nikah', 'pp-rukun-nikah', 50, 'inti', 'pokok', 'Siapa yang menjadi wali nikah, siapa saksi nikahnya, dan apa mas kawinnya ?', 'wali nikah, saksi nikah dan mas kawin',
                   'pernikahan #0046# dilakukan dengan wali nikah #1046# bernama #1217#, disaksikan #0650# dan #0651#, dengan mas kawin #1001#', 'wali pernikahan #0046# adalah #1046# bernama #1217#, saksinya #0650# dan #0651# serta mas kawinnya #1001#',
                   'wali nikah #0046# adalah #1046# bernama #1217#', '#1217# yang menjadi #1046# dalam pernikahan #0046#').json())
    butir.append(b('q-halangan-nikah', 'pp-halangan', 60, 'inti', 'pokok', 'Apakah antara #0046# ada hubungan nasab, semenda atau sesusuan, atau larangan menikah lainnya ?', 'ada tidaknya hubungan nasab, semenda, sesusuan atau larangan menikah',
                   'antara #0046# tidak ada pertalian nasab, semenda maupun sesusuan dan tidak ada larangan untuk menikah', 'tidak ada hubungan darah, semenda atau sesusuan di antara #0046# serta tidak ada larangan untuk menikah',
                   'antara #0046# tidak ada pertalian nasab', 'tidak ada hubungan darah di antara #0046#',
                   mendengar=('antara #0046# tidak ada pertalian nasab, semenda maupun sesusuan', 'tidak ada hubungan darah, semenda atau sesusuan di antara #0046#')).json())
    butir.append(b('q-keberatan-nikah', 'pp-halangan', 70, 'inti', 'pokok', 'Apakah ada pihak yang keberatan atas pernikahan #0046# ?', 'ada tidaknya keberatan atas pernikahan Pemohon',
                   'sejak menikah tidak ada pihak yang keberatan atas pernikahan #0046#', 'tidak seorang pun pernah menyatakan keberatan atas pernikahan #0046#',
                   'tidak ada pihak yang keberatan atas pernikahan #0046#', 'keberatan atas pernikahan #0046# tidak pernah ada').json())
    butir.append(b('q-pencatatan-nikah', 'pp-pencatatan', 80, 'inti', 'pokok', 'Apakah pernikahan #0046# sudah dicatat oleh Pegawai Pencatat Nikah ?', 'pencatatan pernikahan Pemohon',
                   'pernikahan #0046# #3674#', 'mengenai pencatatan, pernikahan #0046# #3674#', 'pencatatan pernikahan #0046# #3674#', 'sepengetahuan saya pernikahan #0046# #3674#').json())
    butir.append(b('q-nikah-dicatat-kemudian', 'pp-pencatatan', 90, 'pilihan', 'pokok', 'Kapan pernikahan #0046# dicatat secara resmi dan mengapa baru dicatat kemudian ?', 'waktu pencatatan pernikahan Pemohon',
                   'pernikahan #0046# baru dicatat secara resmi setelah #8602# lahir yaitu #3664#', 'setelah #8602# lahir pernikahan #0046# dicatat secara resmi yaitu #3664#',
                   'pernikahan #0046# dicatat yaitu #3664#', 'pencatatan pernikahan #0046# adalah #3664#', keadaan={'pencatatanNikah': 'dicatat-kemudian'}).json())
    butir.append(b('q-nikah-itsbat', 'pp-pencatatan', 100, 'pilihan', 'pokok', 'Apakah pernikahan #0046# sudah diitsbatkan oleh Pengadilan ?', 'itsbat nikah Pemohon',
                   'pernikahan #0046# sudah diitsbatkan oleh Pengadilan yaitu #3664#', 'sudah ada penetapan itsbat Pengadilan atas pernikahan #0046# yaitu #3664#',
                   'pernikahan #0046# sudah diitsbatkan', 'itsbat nikah #0046# sudah ada', keadaan={'pencatatanNikah': 'sudah-itsbat'}).json())
    butir.append(b('q-nikah-belum-dicatat', 'pp-pencatatan', 110, 'pilihan', 'pokok', 'Mengapa pernikahan #0046# belum dicatat ?', 'sebab pernikahan Pemohon belum dicatat',
                   'pernikahan #0046# sampai sekarang belum dicatat oleh Pegawai Pencatat Nikah', 'sampai saat ini pencatatan pernikahan #0046# belum dilakukan',
                   'pernikahan #0046# belum dicatat', 'pencatatan pernikahan #0046# belum ada', keadaan={'pencatatanNikah': 'belum-dicatat'}).json())
    butir.append(b('q-kelahiran-anak', 'pp-kelahiran-anak', 120, 'inti', 'pokok', 'Siapa nama anak #0046# yang dimohonkan pengesahannya, kapan dan di mana lahirnya ?', 'nama dan kelahiran anak',
                   '#3661# #0046# bernama #8602# lahir #3660#', '#8602# adalah #3661# #0046# yang lahir #3660#', '#3661# #0046# bernama #8602#', 'nama #3661# #0046# adalah #8602#').json())
    butir.append(b('q-anak-dari-pemohon', 'pp-hubungan-anak', 130, 'inti', 'pokok', 'Apakah #8602# benar anak kandung #0046# yang dilahirkan oleh ibunya dan diasuh oleh keduanya ?', 'hubungan anak dengan Pemohon',
                   '#8602# adalah anak kandung #3673# dan diasuh oleh keduanya sejak lahir', 'sejak lahir #8602# diasuh oleh #3673# yang merupakan ayah dan ibu kandung anak itu',
                   '#8602# adalah anak kandung #3673#', 'ayah dan ibu kandung #8602# adalah #3673#').json())
    butir.append(b('q-pengasuhan', 'pp-hubungan-anak', 140, 'pilihan', 'pokok', 'Siapa yang mengasuh dan membiayai #8602# sehari-hari ?', 'pengasuhan dan pembiayaan anak',
                   '#8602# diasuh dan dibiayai sehari-hari oleh #3673#', 'kebutuhan sehari-hari #8602# dipenuhi dan diasuh sendiri oleh #3673#',
                   '#8602# diasuh oleh #3673#', 'pengasuh #8602# adalah #3673#').json())
    butir.append(b('q-keadaan-anak', 'pp-hubungan-anak', 150, 'pilihan', 'akibat', 'Bagaimana keadaan #8602# sekarang, apakah sehat dan terawat ?', 'keadaan anak selama diasuh',
                   '#8602# dalam keadaan sehat dan terawat dengan baik di bawah asuhan #3673#', 'selama diasuh #3673# #8602# sehat dan terawat baik',
                   '#8602# sehat di bawah asuhan #3673#', 'keadaan #8602# baik di bawah asuhan #3673#').json())
    butir.append(b('q-sengketa-status', 'pp-sengketa', 160, 'inti', 'pokok', 'Apakah ada pihak yang menyangkal atau mempersoalkan status #8602# sebagai anak #0046# ?', 'ada tidaknya penyangkalan status anak',
                   'tidak ada pihak yang menyangkal atau mempersoalkan status #8602# sebagai anak #0046#', 'status #8602# sebagai anak #0046# tidak pernah dipersoalkan oleh pihak mana pun',
                   'tidak ada yang menyangkal status #8602# sebagai anak #0046#', 'status #8602# sebagai anak #0046# tidak pernah dipersoalkan').json())
    butir.append(b('q-akta-kelahiran', 'pp-akta-kelahiran', 170, 'inti', 'pokok', 'Apakah #8602# sudah mempunyai akta kelahiran, dan mengapa ?', 'akta kelahiran anak',
                   '#8602# #3665#', 'mengenai akta kelahiran, #8602# #3665#', 'tentang akta kelahiran, #8602# #3665#', 'sepengetahuan saya #8602# #3665#').json())
    butir.append(b('q-kelahiran-sebelum-nikah', 'pp-sebelum-nikah', 180, 'inti', 'pokok', 'Apakah #8602# lahir sebelum #0046# menikah ?', 'kelahiran anak sebelum pernikahan Pemohon',
                   '#8602# lahir #3660# yaitu sebelum #0046# melangsungkan pernikahan pada tanggal #5197#', 'pernikahan #0046# pada tanggal #5197# baru dilangsungkan setelah #8602# lahir #3660#',
                   '#8602# lahir sebelum pernikahan #0046# pada tanggal #5197#', 'kelahiran #8602# terjadi sebelum tanggal #5197# saat #0046# menikah', keadaan={'waktuLahir': 'sebelum-nikah'}).json())
    butir.append(b('q-hubungan-darah', 'pp-hubungan-darah', 190, 'inti', 'pokok', 'Apakah #0098# adalah ayah biologis #8602#, dan bagaimana hal itu diketahui ?', 'hubungan darah anak dengan ayah biologis',
                   '#0098# adalah ayah biologis #8602# dan hubungan darah itu #3666#', 'hubungan darah antara #0098# dan #8602# #3666#',
                   '#0098# adalah ayah biologis #8602#', 'ayah biologis #8602# adalah #0098#', keadaan={'waktuLahir': 'sebelum-nikah'}).json())
    butir.append(b('q-pengakuan-ayah', 'pp-hubungan-darah', 200, 'pilihan', 'pokok', 'Apakah #0098# pernah mengakui #8602# sebagai anaknya ?', 'pengakuan ayah atas anak',
                   '#0098# mengakui #8602# sebagai anak kandungnya secara terbuka di hadapan keluarga', 'di hadapan keluarga dan masyarakat #0098# menyatakan bahwa #8602# adalah anak kandung',
                   '#0098# mengakui #8602# sebagai anak kandung', 'pengakuan #0098# atas #8602# sebagai anak sudah ada',
                   mendengar=('#0098# menyatakan #8602# adalah anak kandung di hadapan keluarga', 'dengan terbuka #0098# menyebut #8602# sebagai anak kandung'), keadaan={'waktuLahir': 'sebelum-nikah'}).json())
    butir.append(b('q-tujuan-pengesahan', 'pp-tujuan', 210, 'pilihan', 'akibat', 'Untuk apa pengesahan anak ini diperlukan ?', 'tujuan pengesahan anak',
                   'pengesahan ini diperlukan untuk #3672# bagi #8602#', 'tujuan #0046# memohon pengesahan adalah #3672# bagi #8602#',
                   'pengesahan ini diperlukan untuk #3672#', 'tujuan pengesahan adalah #3672#').json())
    butir.append(K.dari_wali_adhal('q-penutup', pokok='pp-penutup'))
    bas = ['[1] Sidang 1 - Pemeriksaan, Bukti Surat dan 2 Saksi, Penetapan Dibacakan (1x Sidang)', '[1a] Sidang 1 - Pemeriksaan, Bukti Surat dan 2 Saksi, Tunda Pembacaan Penetapan',
           '[2] Sidang Lanjutan - Pemeriksaan 2 Saksi, Tunda Pembacaan Penetapan', '[2a] Sidang Lanjutan - Perbaikan Permohonan, Bukti Surat dan 2 Saksi, Tunda Pembacaan Penetapan',
           '[2b] Sidang Lanjutan - Pemeriksaan 2 Saksi, Penetapan Dibacakan']
    catatan = [
        'Isi tempat dan tanggal lahir anak, keadaan pencatatan pernikahan (A, B atau C), akta nikah atau penetapan itsbat, dan sebab anak belum berakta pada isian blangko sebelum menyusun; isian kosong tampil sebagai titik-titik.',
        'Pengesahan anak mensyaratkan pernikahan orang tua yang sah dan terbukti; bila pernikahan belum dapat dibuktikan dengan akta nikah, itsbat nikah lebih dahulu (Pasal 7 KHI).',
        'Anak yang lahir sebelum pernikahan para Pemohon dinilai menurut Pasal 43 ayat (1) UU 1/1974 sebagaimana dimaknai Putusan MK 46/PUU-VIII/2010; hubungan darah harus dibuktikan (tes DNA dan/atau alat bukti lain), bukan hanya pengakuan.',
        'Status yang ditetapkan (anak sah atau hubungan perdata dengan ayah biologis) adalah putusan majelis; saksi diarahkan menerangkan fakta, bukan kesimpulan hukum.']
    return K.rakit('pengesahan-anak', 'Pengesahan anak', 352, J['folder_bas'], J['awalan_bas'], [(x, '') for x in bas], dasar, keadaan, pokok, butir, catatan,
                   ['3660', '3661', '3664', '3665', '3666', '3672', '3673', '3674'])


def tulis_katalog():
    import w3aB_katalog as K
    return K.tulis(katalog())


if __name__ == '__main__':
    daftar = bangun()
    tulis_katalog()
    print('pengesahan-anak: %d berkas RTF (%d putusan/penetapan, %d BAS)' % (len(daftar), len(PETA), len(daftar) - len(PETA)))
    for p in daftar:
        print(' ', os.path.basename(p)[:110])
