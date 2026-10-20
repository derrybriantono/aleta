# -*- coding: utf-8 -*-
"""Jenis 345 KELALAIAN ATAS KEWAJIBAN SUAMI / ISTRI (gugatan Pdt.G, alur 15) - paket abt-w3a-blangko-baru-perkawinan, agen W3a-C (21 Okt 2026).

Gugatan suami atau istri terhadap pasangannya yang melalaikan kewajiban TANPA meminta cerai (perkawinan tetap):
  - dasar: Pasal 30-34 UU 1/1974 (naskah BPK lokal), KHI Pasal 77-84 (Pasal 77-79 dan 81-84 dicocokkan pasal.id + OCR Depag; Pasal 80 dari OCR Depag),
    Penjelasan Pasal 49 huruf a angka 7 UU 7/1989 jo. UU 3/2006 jo. UU 50/2009 (naskah UU 3/2006 lokal);
  - kasus utama: istri menggugat suami (nafkah lampau/madliyah, nafkah ke depan, tempat kediaman, kiswah, biaya rumah tangga, meninggalkan);
    suami menggugat istri (tidak mengurus rumah tangga, tidak mau serumah, tidak berbakti/nusyuz);
  - sebutan pihak dan kewajiban mengikuti JENIS KELAMIN Penggugat di SIPP (variabel 3690); bila tak terbaca ada isian pilihan (3691), tidak menebak.

Dasar susunan: folder "6c Nafkah Anak" (15 putusan) + "6c Nafkah Anak - BAS"; bagian jenis-spesifik ditulis ulang di sini.
Keluaran: rtf/derry_briantono/1e Kelalaian Kewajiban Suami Istri (15 putusan) dan "... - BAS" (29 salinan + 9 khusus).
Jalankan: python sumber/jenis_kelalaian_kewajiban.py  (idempoten; hanya menulis ke folder keluaran jenis ini).
"""
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import w3a_lib as L  # noqa: E402
from variabel_def import V  # noqa: E402

J = L.JENIS['kelalaian-kewajiban']
S = J['singkat']                       # "Kelalaian Kewajiban"
KATA = J['kata']                       # "kelalaian kewajiban suami atau istri"


# ---------------------------------------------------------------------------------------------------------------------
# Pembantu SQL (MariaDB 5.5, SELECT saja). Isian petugas dibaca LANGSUNG dari abt_data_teks (tahan tanda kutip, 'belum diisi' = kosong).
# ---------------------------------------------------------------------------------------------------------------------
def T(no):
    return ("TRIM(TRAILING ';' FROM TRIM(IFNULL(REPLACE(REPLACE(REPLACE(CONVERT((SELECT data FROM aps_badilag.abt_data_teks "
            "WHERE no_var = %d AND perkara_id = '#perkara_id#' LIMIT 1) USING utf8), '\\\\', '/'), '\"', '&quot;'), '''', '&#39;'), '')))" % no)


GENDER_P = ("(SELECT UPPER(TRIM(IFNULL(b.jenis_kelamin, ''))) FROM perkara_pihak1 p JOIN pihak b ON b.id = p.pihak_id "
            "WHERE p.perkara_id = '#perkara_id#' ORDER BY p.urutan LIMIT 1)")


def sq(teks):
    """Teks literal ke dalam kutip tunggal SQL (tanpa apostrof di naskah; ganda kutip aman)."""
    assert "'" not in teks and '\\' not in teks, teks
    return "'" + teks + "'"


KUTIP_3_2018 = 'Rumusan Hukum Kamar Agama, Hukum Keluarga huruf b, Surat Edaran Mahkamah Agung Nomor 3 Tahun 2018'

# ---------------------------------------------------------------------------------------------------------------------
# Sebutan pihak menurut jenis kelamin Penggugat (3690-3693)
# ---------------------------------------------------------------------------------------------------------------------
V(3690, 'KELALAIAN KEWAJIBAN: KEDUDUKAN #0046# suami atau istri (OTOMATIS: jenis kelamin Penggugat di SIPP; isian 3691 lebih dahulu)', 'data_sql',
  "SELECT CASE WHEN x.iv IN ('istri', 'isteri') THEN 'istri' WHEN x.iv = 'suami' THEN 'suami' WHEN x.g = 'P' THEN 'istri' WHEN x.g = 'L' THEN 'suami' "
  "ELSE '........' END AS data FROM (SELECT LOWER(%s) AS iv, %s AS g) x" % (T(3691), GENDER_P))
V(3691, 'KELALAIAN KEWAJIBAN: KEDUDUKAN #0046# - ISIAN PILIHAN istri atau suami (hanya bila jenis kelamin di SIPP kosong atau keliru)', 'data_teks')
V(3692, 'KELALAIAN KEWAJIBAN: KEDUDUKAN #0047# (OTOMATIS: kebalikan #3690#)', 'data_sql',
  "SELECT CASE WHEN '#3690#' = 'istri' THEN 'suami' WHEN '#3690#' = 'suami' THEN 'istri' ELSE '........' END AS data")
V(3693, 'KELALAIAN KEWAJIBAN: KEWAJIBAN YANG DILALAIKAN (OTOMATIS: isian 3694; kosong = kewajiban selaku suami atau istri)', 'data_sql',
  "SELECT CASE WHEN c.k <> '' THEN c.k WHEN '#3690#' = 'istri' THEN 'kewajibannya selaku suami' "
  "WHEN '#3690#' = 'suami' THEN 'kewajibannya selaku istri' ELSE 'kewajibannya selaku suami atau istri' END AS data "
  "FROM (SELECT %s AS k) c" % T(3694))
V(3694, 'KELALAIAN KEWAJIBAN: KEWAJIBAN YANG DILALAIKAN - ISIAN frasa benda, mis. kewajiban memberi nafkah lahir dan menyediakan tempat kediaman', 'data_teks')
# ---------------------------------------------------------------------------------------------------------------------
# Fakta yang diisi petugas / dideteksi dari posita (3696-3699)
# ---------------------------------------------------------------------------------------------------------------------
V(3696, 'KELALAIAN KEWAJIBAN: FAKTA HUKUM KELALAIAN - ISIAN kalimat sesudah kata "Bahwa" (siapa melalaikan apa, sejak kapan)', 'data_teks',
  default='#0047# selaku #3692# tidak melaksanakan #3693# terhadap #0046# selaku #3690# sebagaimana didalilkan #0046# dan diterangkan oleh saksi-saksi')
V(3697, 'KELALAIAN KEWAJIBAN: SEJAK KAPAN KEWAJIBAN DILALAIKAN - ISIAN, mis. sejak bulan Maret 2024 (kosong = tidak disebut)', 'data_teks')
V(3699, 'KELALAIAN KEWAJIBAN: DALIL TERGUGAT ATAU ALASAN SAH - ISIAN kalimat sesudah "bahwa" (nusyuz, tidak mampu; kosong = tidak ada)', 'data_teks')

# ---------------------------------------------------------------------------------------------------------------------
# Tuntutan dan besarannya (3700-3710): kosong = tidak dituntut / tidak dikabulkan
# ---------------------------------------------------------------------------------------------------------------------
V(3700, 'KELALAIAN KEWAJIBAN: NAFKAH KE DEPAN - JUMLAH SETIAP BULAN - ISIAN, mis. Rp1.500.000,00 (satu juta lima ratus ribu rupiah)', 'data_teks')
V(3701, 'KELALAIAN KEWAJIBAN: NAFKAH LAMPAU (MADLIYAH) - JANGKA WAKTU - ISIAN, mis. sejak bulan Maret 2024 sampai bulan Juli 2026 (29 bulan)', 'data_teks')
V(3702, 'KELALAIAN KEWAJIBAN: NAFKAH LAMPAU (MADLIYAH) - JUMLAH - ISIAN, mis. Rp43.500.000,00 (29 bulan x Rp1.500.000,00)', 'data_teks')
V(3703, 'KELALAIAN KEWAJIBAN: KISWAH (PAKAIAN) - ISIAN bentuk atau jumlahnya; kosong = tidak dituntut', 'data_teks')
V(3704, 'KELALAIAN KEWAJIBAN: TEMPAT KEDIAMAN - ISIAN bentuk pemenuhan, mis. rumah yang layak di ...; kosong = tidak dituntut', 'data_teks')
V(3705, 'KELALAIAN KEWAJIBAN: BIAYA RUMAH TANGGA, PERAWATAN DAN PENGOBATAN - ISIAN lanjutan kata "berupa"; kosong = tidak dituntut', 'data_teks')
V(3706, 'KELALAIAN KEWAJIBAN: KEWAJIBAN LAIN BUKAN UANG - ISIAN frasa kerja, mis. kembali tinggal serumah dengan Penggugat; kosong = tidak dituntut', 'data_teks')
V(3707, 'KELALAIAN KEWAJIBAN: DASAR KEMAMPUAN TERGUGAT DAN KEBUTUHAN DASAR PENGGUGAT - ISIAN tanpa titik akhir; kosong = tidak tercetak', 'data_teks')
V(3708, 'KELALAIAN KEWAJIBAN: PEMOTONGAN LANGSUNG PENGHASILAN - ISIAN nama instansi tempat Tergugat bekerja; kosong = tidak dimohonkan', 'data_teks')
V(3709, 'KELALAIAN KEWAJIBAN: SITA JAMINAN - ISIAN objek dirinci dan berita acara sita; kosong = tidak ada sita', 'data_teks')
V(3710, 'KELALAIAN KEWAJIBAN: UANG PAKSA (DWANGSOM) - ISIAN jumlah per hari, hanya atas kewajiban bukan uang; kosong = tidak dituntut', 'data_teks')
V(3711, 'KELALAIAN KEWAJIBAN: (KABUL SEBAGIAN) ALASAN PETITUM SELEBIHNYA DITOLAK - ISIAN kalimat sesudah "Menimbang, bahwa"', 'data_teks',
  default='besaran kewajiban yang dituntut melebihi kemampuan #0047# dan kebutuhan dasar hidup #0046# sebagaimana terbukti di persidangan')
V(3712, 'KELALAIAN KEWAJIBAN: (TOLAK) ALASAN GUGATAN DITOLAK - ISIAN kalimat sesudah "Menimbang, bahwa"', 'data_teks',
  default='alat bukti yang diajukan #0046# tidak cukup membuktikan bahwa #0047# telah melalaikan kewajibannya tanpa alasan yang sah')

# ---------------------------------------------------------------------------------------------------------------------
# Alat bukti surat (3730 - 3731), dipakai putusan dan BAS
# ---------------------------------------------------------------------------------------------------------------------
V(3730, 'KELALAIAN KEWAJIBAN: ALAT BUKTI SURAT #0046# - ISIAN daftar bukti P.1 dst. (KTP-el, Kutipan Akta Nikah, Kartu Keluarga)', 'data_teks',
  default=('Fotokopi Kartu Tanda Penduduk Elektronik (KTP-el) atas nama #4048#, NIK #0335# tanggal #8870#, yang dikeluarkan oleh Pemerintah #9277#, Provinsi #9278#, '
           'bukti surat tersebut telah diberi meterai cukup, di-nazegelen, serta telah dicocokkan dengan aslinya yang ternyata sesuai, lalu oleh #4004# diberi tanda P.1;\n'
           'Fotokopi Kutipan Akta Nikah, Nomor #1004# tanggal #1012#, yang dikeluarkan oleh #1005#, bukti surat tersebut telah diberi meterai cukup, di-nazegelen, '
           'serta telah dicocokkan dengan aslinya yang ternyata sesuai, lalu oleh #4004# diberi tanda P.2;\n'
           'Fotokopi Kartu Keluarga yang memuat nama #0098# dan #0102#, yang dikeluarkan oleh Dinas Kependudukan dan Pencatatan Sipil, bukti surat tersebut telah diberi meterai cukup, '
           'di-nazegelen, serta telah dicocokkan dengan aslinya yang ternyata sesuai, lalu oleh #4004# diberi tanda P.3;'))
V(3731, 'KELALAIAN KEWAJIBAN: ALAT BUKTI SURAT #0047# - ISIAN daftar bukti T.1 dst. (KTP-el, Kutipan Akta Nikah)', 'data_teks',
  default=('Fotokopi Kartu Tanda Penduduk Elektronik (KTP-el) atas nama #0102#, NIK #0337#, yang dikeluarkan oleh Pemerintah #9279#, Provinsi #9560#, '
           'bukti surat tersebut telah diberi meterai cukup, di-nazegelen, serta telah dicocokkan dengan aslinya yang ternyata sesuai, lalu oleh #4004# diberi tanda T.1;\n'
           'Fotokopi Kutipan Akta Nikah, Nomor #1004# tanggal #1012#, yang dikeluarkan oleh #1005#, bukti surat tersebut telah diberi meterai cukup, di-nazegelen, '
           'serta telah dicocokkan dengan aslinya yang ternyata sesuai, lalu oleh #4004# diberi tanda T.2;'))

# ---------------------------------------------------------------------------------------------------------------------
# Teks pertimbangan dan amar OTOMATIS (3695, 3698, 3720-3729, 3732-3733)
# ---------------------------------------------------------------------------------------------------------------------
P_UMUM = ('Menimbang, bahwa Pasal 30 Undang-Undang Nomor 1 Tahun 1974 tentang Perkawinan menentukan bahwa suami istri memikul kewajiban yang luhur untuk menegakkan rumah tangga '
          'yang menjadi sendi dasar dari susunan masyarakat, dan Pasal 33 Undang-Undang tersebut jo. Pasal 77 ayat (2) Kompilasi Hukum Islam menentukan bahwa suami istri wajib saling '
          'cinta-mencintai, hormat-menghormati, setia dan memberi bantuan lahir batin yang satu kepada yang lain;')
P_SUAMI = ('Menimbang, bahwa khusus mengenai kewajiban suami, Pasal 34 ayat (1) Undang-Undang Nomor 1 Tahun 1974 tentang Perkawinan menentukan bahwa suami wajib melindungi istrinya dan '
           'memberikan segala sesuatu keperluan hidup berumah tangga sesuai dengan kemampuannya, yang dalam Pasal 80 ayat (2) dan ayat (4) huruf a dan huruf b Kompilasi Hukum Islam diuraikan '
           'sebagai kewajiban suami melindungi istrinya dan, sesuai dengan penghasilannya, menanggung nafkah, kiswah dan tempat kediaman bagi istri serta biaya rumah tangga, biaya perawatan '
           'dan biaya pengobatan bagi istri dan anak, sedangkan Pasal 81 ayat (1) dan ayat (2) Kompilasi Hukum Islam mewajibkan suami menyediakan tempat kediaman yang layak bagi istri dan '
           'anak-anaknya selama dalam ikatan perkawinan;')
P_SUAMI_TAMKIN = ('Menimbang, bahwa menurut Pasal 80 ayat (5), ayat (6) dan ayat (7) Kompilasi Hukum Islam, kewajiban suami terhadap istrinya sebagaimana dimaksud ayat (4) huruf a dan huruf b '
                  'mulai berlaku sesudah ada tamkin sempurna dari istrinya, istri dapat membebaskan suaminya dari kewajiban tersebut, dan kewajiban tersebut gugur apabila istri nusyuz; istri dapat '
                  'dianggap nusyuz jika ia tidak mau melaksanakan kewajiban-kewajibannya sebagaimana dimaksud Pasal 83 ayat (1) Kompilasi Hukum Islam kecuali dengan alasan yang sah, dan ada atau '
                  'tidak adanya nusyuz harus didasarkan atas bukti yang sah (Pasal 84 ayat (1), ayat (2) dan ayat (4) Kompilasi Hukum Islam);')
P_ISTRI = ('Menimbang, bahwa khusus mengenai kewajiban istri, Pasal 34 ayat (2) Undang-Undang Nomor 1 Tahun 1974 tentang Perkawinan menentukan bahwa istri wajib mengatur urusan rumah tangga '
           'sebaik-baiknya, dan Pasal 83 ayat (1) dan ayat (2) Kompilasi Hukum Islam menentukan bahwa kewajiban utama bagi seorang istri ialah berbakti lahir dan batin kepada suami di dalam '
           'batas-batas yang dibenarkan oleh hukum Islam serta menyelenggarakan dan mengatur keperluan rumah tangga sehari-hari dengan sebaik-baiknya, sedangkan Pasal 32 Undang-Undang tersebut '
           'jo. Pasal 78 Kompilasi Hukum Islam menentukan bahwa suami istri harus mempunyai tempat kediaman yang tetap yang ditentukan oleh suami istri bersama;')
P_ISTRI_NUSYUZ = ('Menimbang, bahwa menurut Pasal 84 ayat (1) dan ayat (4) Kompilasi Hukum Islam, istri dapat dianggap nusyuz jika ia tidak mau melaksanakan kewajiban-kewajiban sebagaimana dimaksud '
                  'Pasal 83 ayat (1) Kompilasi Hukum Islam kecuali dengan alasan yang sah, dan ada atau tidak adanya nusyuz harus didasarkan atas bukti yang sah;')
P_UMUM_SUAMI_ISTRI = ('Menimbang, bahwa Pasal 34 ayat (1) dan ayat (2) Undang-Undang Nomor 1 Tahun 1974 tentang Perkawinan menentukan bahwa suami wajib melindungi istrinya dan memberikan segala sesuatu '
                      'keperluan hidup berumah tangga sesuai dengan kemampuannya, sedangkan istri wajib mengatur urusan rumah tangga sebaik-baiknya, yang diuraikan lebih lanjut dalam Pasal 80 sampai dengan '
                      'Pasal 84 Kompilasi Hukum Islam;')


def _penutup(pelaku, penggugat):
    return ('Menimbang, bahwa apabila %s melalaikan kewajibannya, %s dapat mengajukan gugatan kepada Pengadilan, sebagaimana ditentukan Pasal 34 ayat (3) Undang-Undang Nomor 1 Tahun 1974 tentang '
            'Perkawinan jo. Pasal 77 ayat (5) Kompilasi Hukum Islam; gugatan demikian tidak mensyaratkan putusnya perkawinan karena tujuannya ialah menegakkan pemenuhan kewajiban selama perkawinan '
            'masih berlangsung;' % (pelaku, penggugat))


_SQL_3695 = ("SELECT CASE WHEN '#3692#' = 'suami' THEN CONCAT(%s, '<br>', %s, '<br>', %s, '<br>', %s) "
             "WHEN '#3692#' = 'istri' THEN CONCAT(%s, '<br>', %s, '<br>', %s, '<br>', %s) "
             "ELSE CONCAT(%s, '<br>', %s, '<br>', %s) END AS data") % (
    sq(P_UMUM), sq(P_SUAMI), sq(P_SUAMI_TAMKIN), sq(_penutup('suami', 'istri')),
    sq(P_UMUM), sq(P_ISTRI), sq(P_ISTRI_NUSYUZ), sq(_penutup('istri', 'suami')),
    sq(P_UMUM), sq(P_UMUM_SUAMI_ISTRI), sq(_penutup('suami atau istri', 'masing-masing pihak')))
V(3695, 'KELALAIAN KEWAJIBAN: PERTIMBANGAN DASAR HUKUM KEWAJIBAN #0047# (OTOMATIS menurut kedudukan #0047# suami atau istri)',
  'data_sql', _SQL_3695)

_SQL_3698 = ("SELECT CONCAT('Menimbang, bahwa berdasarkan fakta hukum tersebut di atas, #0047# selaku #3692# terbukti tidak melaksanakan #3693# terhadap #0046# selaku #3690#', "
             "IF(c.sj = '', '', CONCAT(' ', c.sj)), ', tanpa alasan yang sah menurut hukum, sehingga #0047# terbukti telah melalaikan kewajibannya;') AS data FROM (SELECT %s AS sj) c") % T(3697)
V(3698, 'KELALAIAN KEWAJIBAN: PERTIMBANGAN TERBUKTI MELALAIKAN (OTOMATIS: isian 3693 dan 3697)', 'data_sql', _SQL_3698)

# --- nafkah ke depan -------------------------------------------------------------------------------------------------
V(3720, 'KELALAIAN KEWAJIBAN: PERTIMBANGAN NAFKAH KE DEPAN (OTOMATIS: isian 3700 dan 3707; kosong = tidak tercetak)', 'data_sql',
  "SELECT IF(c.jm = '', '', CONCAT('<br>Menimbang, bahwa terhadap tuntutan nafkah ke depan, dengan menggali fakta kemampuan ekonomi #0047# dan fakta kebutuhan dasar hidup #0046# sebagaimana "
  + KUTIP_3_2018 + ", serta berdasarkan fakta hukum tersebut di atas mengenai pekerjaan dan penghasilan #0047#', IF(c.dk = '', '', CONCAT(' (', c.dk, ')')), ', #8554# berpendapat patut dan layak #0047# "
  "dihukum membayar nafkah kepada #0046# sebesar ', c.jm, ' setiap bulan selama perkawinan antara #0046# dan #0047# masih berlangsung dan #0046# tidak nusyuz, sebagaimana Pasal 80 ayat (4) huruf a "
  "dan ayat (7) jo. Pasal 84 ayat (2) Kompilasi Hukum Islam;')) AS data FROM (SELECT %s AS jm, %s AS dk) c" % (T(3700), T(3707)))
V(3721, 'KELALAIAN KEWAJIBAN: AMAR NAFKAH KE DEPAN (OTOMATIS: isian 3700; peringatan bila tak satu pun isian 3700-3706 terisi)', 'data_sql',
  "SELECT IF(c.jm = '', IF(c.jl = '' AND c.ks = '' AND c.tk = '' AND c.br = '' AND c.lain = '', '<br>    - kewajiban belum diisi - isi variabel 3700 sampai 3706;', ''), "
  "CONCAT('<br>    - membayar nafkah kepada #0046# sebesar ', c.jm, ' setiap bulan selama perkawinan masih berlangsung dan #0046# tidak nusyuz;')) AS data "
  "FROM (SELECT %s AS jm, %s AS jl, %s AS ks, %s AS tk, %s AS br, %s AS lain) c" % (T(3700), T(3702), T(3703), T(3704), T(3705), T(3706)))
# --- nafkah lampau ----------------------------------------------------------------------------------------------------
V(3722, 'KELALAIAN KEWAJIBAN: PERTIMBANGAN NAFKAH LAMPAU (MADLIYAH) (OTOMATIS: isian 3701-3702; kosong bila 3702 kosong)', 'data_sql',
  "SELECT IF(c.jl = '', '', CONCAT('<br>Menimbang, bahwa #0046# juga menuntut agar #0047# dihukum membayar nafkah lampau (nafkah madliyah)', IF(c.pr = '', '', CONCAT(' ', c.pr)), ' sejumlah ', c.jl, "
  "'; dengan menggali fakta kemampuan ekonomi #0047# dan fakta kebutuhan dasar hidup #0046# sebagaimana " + KUTIP_3_2018 + ", serta berdasarkan fakta hukum tersebut di atas bahwa #0047# tidak "
  "memberikan nafkah kepada #0046# selama jangka waktu tersebut, #8554# berpendapat nafkah lampau hanya dapat dibebankan sepanjang jangka waktu dan jumlahnya terbukti di persidangan dan #0046# "
  "tidak terbukti nusyuz pada jangka waktu tersebut, sehingga patut dan layak #0047# dihukum membayar nafkah lampau (nafkah madliyah) kepada #0046# sejumlah ', c.jl, ';')) AS data "
  "FROM (SELECT %s AS pr, %s AS jl) c" % (T(3701), T(3702)))
V(3723, 'KELALAIAN KEWAJIBAN: AMAR NAFKAH LAMPAU (MADLIYAH) (OTOMATIS: isian 3701-3702; kosong bila 3702 kosong)', 'data_sql',
  "SELECT IF(c.jl = '', '', CONCAT('<br>    - membayar nafkah lampau (nafkah madliyah) kepada #0046#', IF(c.pr = '', '', CONCAT(' ', c.pr)), ' sejumlah ', c.jl, ';')) AS data "
  "FROM (SELECT %s AS pr, %s AS jl) c" % (T(3701), T(3702)))
# --- kiswah, tempat kediaman, biaya, kewajiban lain, pemotongan, sita ---------------------------------------------------
V(3724, 'KELALAIAN KEWAJIBAN: PERTIMBANGAN TAMBAHAN - KISWAH, TEMPAT KEDIAMAN, BIAYA, KEWAJIBAN LAIN, PEMOTONGAN, SITA (OTOMATIS: isian 3703-3709)', 'data_sql',
  "SELECT IF(t.x IS NULL OR t.x = '', '', CONCAT('<br>', t.x)) AS data FROM (SELECT CONCAT_WS('<br>', "
  "IF(c.ks = '', NULL, CONCAT('Menimbang, bahwa mengenai kiswah (pakaian), Pasal 80 ayat (4) huruf a Kompilasi Hukum Islam menentukan bahwa sesuai dengan penghasilannya suami menanggung kiswah bagi istri; "
  "oleh karena #0047# terbukti melalaikan kewajiban tersebut, #8554# berpendapat patut #0047# dihukum menyediakan kiswah bagi #0046# berupa ', c.ks, ';')), "
  "IF(c.tk = '', NULL, CONCAT('Menimbang, bahwa mengenai tempat kediaman, Pasal 81 ayat (1), ayat (2) dan ayat (4) Kompilasi Hukum Islam mewajibkan suami menyediakan tempat tinggal yang layak bagi istri "
  "selama dalam ikatan perkawinan dan melengkapinya sesuai dengan kemampuannya serta keadaan lingkungan tempat tinggalnya; oleh karena itu #8554# berpendapat patut #0047# dihukum menyediakan tempat "
  "kediaman bagi #0046# berupa ', c.tk, ';')), "
  "IF(c.br = '', NULL, CONCAT('Menimbang, bahwa mengenai biaya rumah tangga, biaya perawatan dan biaya pengobatan, Pasal 80 ayat (4) huruf b Kompilasi Hukum Islam menentukan bahwa sesuai dengan "
  "penghasilannya suami menanggung biaya tersebut bagi istri dan anak; oleh karena itu #8554# berpendapat patut #0047# dihukum menanggung biaya tersebut berupa ', c.br, ';')), "
  "IF(c.lain = '', NULL, CONCAT('Menimbang, bahwa terhadap tuntutan agar #0047# ', c.lain, ', oleh karena hal tersebut merupakan bagian dari #3693# sebagaimana tersebut di atas dan terbukti dilalaikan, "
  "#8554# berpendapat tuntutan tersebut patut dikabulkan;')), "
  "IF(c.pt = '', NULL, CONCAT('Menimbang, bahwa untuk menjamin terlaksananya pembayaran tersebut, #8554# berpendapat patut pembayaran dilaksanakan melalui pemotongan langsung atas penghasilan #0047# oleh ', c.pt, ';')), "
  "IF(c.st = '', NULL, CONCAT('Menimbang, bahwa terhadap sita jaminan (conservatoir beslag) atas harta milik #0047# berupa ', c.st, ' yang telah diletakkan dalam perkara ini, oleh karena gugatan beralasan hukum "
  "dan dikabulkan, maka sita jaminan tersebut patut dinyatakan sah dan berharga;'))) AS x FROM (SELECT %s AS ks, %s AS tk, %s AS br, %s AS lain, %s AS pt, %s AS st) c) t"
  % (T(3703), T(3704), T(3705), T(3706), T(3708), T(3709)))
V(3725, 'KELALAIAN KEWAJIBAN: AMAR TAMBAHAN - KISWAH, TEMPAT KEDIAMAN, BIAYA, KEWAJIBAN LAIN, PEMOTONGAN, SITA (OTOMATIS: isian 3703-3709)', 'data_sql',
  "SELECT CONCAT(IF(c.ks = '', '', CONCAT('<br>    - menyediakan kiswah (pakaian) bagi #0046# berupa ', c.ks, ';')), "
  "IF(c.tk = '', '', CONCAT('<br>    - menyediakan tempat kediaman bagi #0046# berupa ', c.tk, ';')), "
  "IF(c.br = '', '', CONCAT('<br>    - menanggung biaya rumah tangga, biaya perawatan dan biaya pengobatan #0046# berupa ', c.br, ';')), "
  "IF(c.lain = '', '', CONCAT('<br>    - ', c.lain, ';')), "
  "IF(c.pt = '', '', CONCAT('<br>    - dengan ketentuan pembayaran tersebut dapat dilaksanakan melalui pemotongan langsung atas penghasilan #0047# oleh ', c.pt, ';')), "
  "IF(c.st = '', '', CONCAT('<br>    - dengan jaminan berupa sita jaminan (conservatoir beslag) atas harta milik #0047# berupa ', c.st, ', yang dinyatakan sah dan berharga;'))) AS data "
  "FROM (SELECT %s AS ks, %s AS tk, %s AS br, %s AS lain, %s AS pt, %s AS st) c" % (T(3703), T(3704), T(3705), T(3706), T(3708), T(3709)))
# --- dalil Tergugat / nusyuz / alasan sah ------------------------------------------------------------------------------
V(3726, 'KELALAIAN KEWAJIBAN: PERTIMBANGAN DALIL TERGUGAT TIDAK TERBUKTI (OTOMATIS: isian 3699; untuk putusan yang mengabulkan)', 'data_sql',
  "SELECT IF(c.dl = '', '', CONCAT('<br>Menimbang, bahwa terhadap dalil #0047# bahwa ', c.dl, ', oleh karena dalil tersebut merupakan dalil yang harus dibuktikan oleh pihak yang mengajukannya "
  "(Pasal 283 RBg jo. Pasal 1865 Kitab Undang-Undang Hukum Perdata) dan, sepanjang menyangkut nusyuz, harus didasarkan atas bukti yang sah (Pasal 84 ayat (4) Kompilasi Hukum Islam), sedangkan alat bukti "
  "yang diajukan tidak cukup membuktikannya, maka dalil tersebut dinyatakan tidak terbukti dan dikesampingkan;')) AS data FROM (SELECT %s AS dl) c" % T(3699))
V(3727, 'KELALAIAN KEWAJIBAN: PERTIMBANGAN DALIL TERGUGAT TERBUKTI (OTOMATIS: isian 3699; untuk putusan yang menolak)', 'data_sql',
  "SELECT IF(c.dl = '', '', CONCAT('<br>Menimbang, bahwa terhadap dalil #0047# bahwa ', c.dl, ', berdasarkan alat bukti yang diajukan dalil tersebut terbukti, sehingga kelalaian yang didalilkan #0046# "
  "bukan merupakan kelalaian tanpa alasan yang sah (sepanjang menyangkut nusyuz, sesuai Pasal 84 ayat (1) dan ayat (4) Kompilasi Hukum Islam);')) AS data FROM (SELECT %s AS dl) c" % T(3699))
# --- uang paksa --------------------------------------------------------------------------------------------------------
V(3728, 'KELALAIAN KEWAJIBAN: PERTIMBANGAN UANG PAKSA / DWANGSOM (OTOMATIS: isian 3710; kosong = tidak tercetak)', 'data_sql',
  "SELECT IF(c.up = '', '', CONCAT('<br>Menimbang, bahwa #0046# juga menuntut uang paksa (dwangsom) sebesar ', c.up, ' untuk setiap hari keterlambatan; menurut Rumusan Hukum Kamar Perdata Tahun 2025 "
  "(Surat Edaran Mahkamah Agung Nomor 1 Tahun 2025) angka 2, uang paksa berlaku bagi semua penghukuman kecuali penghukuman pembayaran sejumlah uang dan dihitung sejak hari ke-9 (sembilan) setelah "
  "teguran (aanmaning) sampai putusan dilaksanakan, sedangkan menurut Rumusan Hukum Kamar Agama (Surat Edaran Mahkamah Agung Nomor 3 Tahun 2018) uang paksa tanpa tuntutan termasuk ultra petita; oleh "
  "karena uang paksa telah dituntut dan #8554# menilainya layak hanya terhadap kewajiban yang bukan pembayaran sejumlah uang, maka uang paksa patut dikabulkan terbatas pada kewajiban tersebut;')) AS data "
  "FROM (SELECT %s AS up) c" % T(3710))
V(3729, 'KELALAIAN KEWAJIBAN: AMAR UANG PAKSA / DWANGSOM (OTOMATIS: isian 3710; kosong = tidak tercetak)', 'data_sql',
  "SELECT IF(c.up = '', '', CONCAT('<br>    - dengan ketentuan #0047# membayar uang paksa (dwangsom) sebesar ', c.up, ' untuk setiap hari keterlambatan melaksanakan kewajiban yang bukan pembayaran sejumlah uang, "
  "dihitung sejak hari ke-9 (sembilan) setelah teguran (aanmaning) sampai putusan dilaksanakan;')) AS data FROM (SELECT %s AS up) c" % T(3710))
# --- pengangkatan sita bila gugatan tidak dikabulkan ----------------------------------------------------------------------
V(3732, 'KELALAIAN KEWAJIBAN: PERTIMBANGAN PENGANGKATAN SITA JAMINAN BILA GUGATAN TIDAK DIKABULKAN (OTOMATIS: isian 3709)', 'data_sql',
  "SELECT IF(c.st = '', '', CONCAT('<br>Menimbang, bahwa oleh karena gugatan tidak dikabulkan (ditolak, tidak dapat diterima, dicabut, gugur atau dibatalkan dari pendaftaran), maka sita jaminan "
  "(conservatoir beslag) atas harta milik #0047# berupa ', c.st, ' yang telah diletakkan harus diperintahkan untuk diangkat;')) AS data FROM (SELECT %s AS st) c" % T(3709))
V(3733, 'KELALAIAN KEWAJIBAN: AMAR PENGANGKATAN SITA JAMINAN BILA GUGATAN TIDAK DIKABULKAN (OTOMATIS: isian 3709)', 'data_sql',
  "SELECT IF(c.st = '', '', CONCAT(', dan memerintahkan agar sita jaminan (conservatoir beslag) atas harta milik #0047# berupa ', c.st, ' diangkat')) AS data FROM (SELECT %s AS st) c" % T(3709))

# ---------------------------------------------------------------------------------------------------------------------
# ISIAN: variabel data_teks yang tidak mungkin terisi otomatis ('manual' = keputusan/penilaian majelis atau fakta sidang; 'opsional' = tambahan bila ada)
# ---------------------------------------------------------------------------------------------------------------------
ISIAN = {
    '3691': ('opsional', 'Kedudukan Penggugat (istri atau suami) - hanya bila jenis kelamin Penggugat di SIPP kosong atau keliru'),
    '3694': ('opsional', 'Kewajiban yang dilalaikan (frasa benda) - kosong = kewajiban selaku suami/istri menurut kedudukan'),
    '3696': ('manual', 'Fakta hukum kelalaian adalah penilaian majelis atas bukti dan keterangan saksi; diisi hakim'),
    '3697': ('opsional', 'Sejak kapan kewajiban dilalaikan (bila ingin disebut dalam pertimbangan)'),
    '3699': ('opsional', 'Dalil Tergugat atau alasan sah (nusyuz, tidak mampu, dibebaskan) - bila ada; terbukti atau tidaknya penilaian majelis'),
    '3700': ('manual', 'Besar nafkah ke depan ditetapkan majelis menurut kemampuan Tergugat dan kebutuhan dasar Penggugat; kosong bila tidak dikabulkan'),
    '3701': ('opsional', 'Jangka waktu nafkah lampau (bila nafkah lampau dituntut dan terbukti)'),
    '3702': ('manual', 'Jumlah nafkah lampau yang dikabulkan ditetapkan majelis menurut yang terbukti; kosong bila tidak dikabulkan'),
    '3703': ('opsional', 'Kiswah (pakaian) - bila dituntut dan dikabulkan'),
    '3704': ('opsional', 'Tempat kediaman - bila dituntut dan dikabulkan'),
    '3705': ('opsional', 'Biaya rumah tangga, perawatan dan pengobatan - bila dituntut dan dikabulkan'),
    '3706': ('opsional', 'Kewajiban lain bukan uang (mis. kembali serumah, mengurus rumah tangga) - bila dituntut dan dikabulkan'),
    '3707': ('manual', 'Dasar kemampuan Tergugat dan kebutuhan dasar adalah pertimbangan majelis dari pekerjaan, penghasilan dan standar biaya hidup setempat'),
    '3708': ('opsional', 'Pemotongan langsung penghasilan (instansi tempat Tergugat bekerja) - bila dimohonkan'),
    '3709': ('opsional', 'Sita jaminan (objek dan berita acara sita) - hanya bila ada sita'),
    '3710': ('opsional', 'Uang paksa - hanya bila dituntut dan dinilai layak oleh majelis'),
    '3711': ('manual', 'Alasan petitum selebihnya ditolak adalah pertimbangan majelis; diisi hakim'),
    '3712': ('manual', 'Alasan gugatan ditolak adalah pertimbangan majelis; diisi hakim'),
    '3730': ('manual', 'Alat bukti surat Penggugat dicatat dari persidangan (nomor, tanggal, pengeluar, tanda P)'),
    '3731': ('opsional', 'Alat bukti surat Tergugat - bila Tergugat mengajukan bukti surat'),
}


# ---------------------------------------------------------------------------------------------------------------------
# PEMBANTU PENYUSUNAN RTF (label nomor di RTF Derry ada di dalam teks run: "3.\tMenghukum ...")
# ---------------------------------------------------------------------------------------------------------------------
RX_LABEL = re.compile(r'^((?:\d{1,2}|[A-Za-z])\.\t)')


def _urai(t):
    m = RX_LABEL.match(t)
    return (m.group(1), t[m.end():]) if m else ('', t)


def ganti_par(raw, cocok, baru, semua=False, wajib=False, nama=''):
    """Ganti paragraf yang BADAN teksnya (tanpa label nomor di depan) cocok regex `cocok` dengan `baru` (str, atau fungsi(badan)->str; label dipertahankan).
    `baru` None = hapus paragraf. Mengembalikan (raw, jumlah_cocok)."""
    d = L.dok_dari_raw(raw)
    rx = re.compile(cocok, re.S)
    potong, n = [], 0
    for i, p in enumerate(d.par):
        label, badan = _urai(d.isi(i))
        if rx.search(badan) and (semua or n == 0):
            n += 1
            if baru is None:
                continue
            teks = baru(badan) if callable(baru) else baru
            potong.append(d.ganti_teks(i, label + teks))
        else:
            potong.append(p)
    if n == 0 and wajib:
        raise SystemExit('ganti_par: tidak ada paragraf cocok /%s/ di %s' % (cocok, nama))
    return d.rakit(potong), n


def sisip_par(raw, cocok, teks_baru_list, sesudah=True, nama=''):
    """Sisipkan paragraf-paragraf baru (gaya paragraf yang cocok) sesudah/sebelum paragraf pertama yang cocok `cocok` (badan teks)."""
    d = L.dok_dari_raw(raw)
    rx = re.compile(cocok, re.S)
    potong, ok = [], False
    for i, p in enumerate(d.par):
        label, badan = _urai(d.isi(i))
        if not ok and rx.search(badan):
            ok = True
            baru = [d.ganti_teks(i, t) for t in teks_baru_list]
            potong.extend([p] + baru if sesudah else baru + [p])
        else:
            potong.append(p)
    if not ok:
        raise SystemExit('sisip_par: tidak ada paragraf cocok /%s/ di %s' % (cocok, nama))
    return d.rakit(potong)


def renomor_amar(raw, nama=''):
    """Renomori butir amar berurutan (1., 2., ...) sesudah paragraf 'MENGADILI'."""
    d = L.dok_dari_raw(raw)
    potong, dalam, k = [], False, 0
    for i, p in enumerate(d.par):
        label, badan = _urai(d.isi(i))
        if not dalam:
            potong.append(p)
            if d.isi(i).strip() == 'MENGADILI':
                dalam = True
            continue
        if re.match(r'^\d{1,2}\.\t', d.isi(i)):
            k += 1
            potong.append(d.ganti_teks(i, '%d.\t%s' % (k, badan)))
        else:
            potong.append(p)
            if k:
                dalam = False
    return d.rakit(potong)


def ganti_sub(raw, lama, baru, wajib=False, nama=''):
    """Ganti potongan kalimat (teks polos) di RTF mentah; bila terpecah oleh format, ganti lewat tulis ulang paragraf pemuatnya."""
    from bangun import esc
    e_lama, e_baru = esc(lama), esc(baru)
    if e_lama in raw:
        return raw.replace(e_lama, e_baru), True
    d = L.dok_dari_raw(raw)
    potong, ok = [], False
    for i, p in enumerate(d.par):
        t = d.isi(i)
        if lama in t:
            ok = True
            potong.append(d.ganti_teks(i, t.replace(lama, baru)))
        else:
            potong.append(p)
    if not ok and wajib:
        raise SystemExit('ganti_sub: "%s" tidak ada di %s' % (lama[:60], nama))
    return (d.rakit(potong) if ok else raw), ok


# ---------------------------------------------------------------------------------------------------------------------
# NASKAH JENIS-SPESIFIK (ditulis ulang; penanda #nnnn# ditulis utuh)
# ---------------------------------------------------------------------------------------------------------------------
UU7 = ('Undang-Undang Nomor 7 Tahun 1989 tentang Peradilan Agama sebagaimana telah diubah dengan Undang-Undang Nomor 3 Tahun 2006 dan perubahan kedua dengan '
       'Undang-Undang Nomor 50 Tahun 2009')
KEWENANGAN = ('Menimbang, bahwa #0053# #0046# pada pokoknya adalah gugatan agar #0047# selaku #3692# yang masih terikat perkawinan yang sah dengan #0046# dinyatakan telah melalaikan '
              '#3693# dan dihukum memenuhinya, tanpa disertai tuntutan perceraian; oleh karena perkara ini merupakan gugatan kelalaian atas kewajiban suami dan istri antara orang-orang yang '
              'beragama Islam, maka berdasarkan Pasal 49 huruf a beserta penjelasannya angka 7 ' + UU7 + ' jo. Pasal 34 ayat (3) dan Pasal 63 ayat (1) huruf a Undang-Undang Nomor 1 Tahun 1974 '
              'tentang Perkawinan jo. Pasal 77 ayat (5) Kompilasi Hukum Islam, perkara a quo termasuk kewenangan absolut Pengadilan Agama;')
KEDUDUKAN = ('Menimbang, bahwa berdasarkan #0053# dan keterangan para pihak, #0046# adalah #3690# dan #0047# adalah #3692# dalam perkawinan yang sah menurut hukum Islam yang masih berlangsung '
             '(belum putus), sehingga berdasarkan Pasal 34 ayat (3) Undang-Undang Nomor 1 Tahun 1974 tentang Perkawinan jo. Pasal 77 ayat (5) Kompilasi Hukum Islam, #0046# mempunyai '
             'kepentingan hukum (persona standi in judicio) untuk mengajukan #0053# kelalaian kewajiban suami atau istri tersebut terhadap #0047#;')
KEDUDUKAN_NO = ('Menimbang, bahwa berdasarkan #0053# dan keterangan para pihak, #0046# adalah #3690# dan #0047# adalah #3692# dalam perkawinan yang sah menurut hukum Islam yang masih '
                'berlangsung, sehingga berdasarkan Pasal 34 ayat (3) Undang-Undang Nomor 1 Tahun 1974 tentang Perkawinan jo. Pasal 77 ayat (5) Kompilasi Hukum Islam, #0046# dan #0047# '
                'mempunyai kepentingan hukum (persona standi in judicio) dalam perkara a quo;')
ISU1 = 'Apakah #0046# dan #0047# terikat perkawinan yang sah dan masih berlangsung, serta apakah #0047# selaku #3692# berkewajiban melaksanakan #3693# terhadap #0046# selaku #3690#?'
ISU2 = 'Apakah #0047# telah melalaikan kewajiban tersebut, dan apakah kelalaian itu terjadi tanpa alasan yang sah (antara lain karena #0047# tidak mampu, dibebaskan oleh #0046#, atau #0046# nusyuz)?'
ISU3 = 'Bagaimana bentuk dan besar pemenuhan kewajiban yang patut dibebankan kepada #0047# dengan mempertimbangkan kemampuan #0047# dan kebutuhan dasar hidup #0046#?'
BEBAN_LAMA = ('namun demikian khusus dalam perkara nafkah anak, #8554# tidak akan serta merta memutus hanya berdasarkan sikap diam atau pengakuan para pihak semata tanpa didukung '
              'alat bukti lain, karena yang utama dipertimbangkan adalah kepentingan terbaik bagi anak;')
BEBAN_BARU = ('namun demikian khusus dalam perkara kelalaian kewajiban suami atau istri, ada atau tidaknya kelalaian, kemampuan pihak yang dituntut, besar kewajiban yang patut dibebankan, '
              'serta ada atau tidaknya alasan yang sah seperti nusyuz tetap dinilai #8554# berdasarkan alat bukti yang sah, tidak hanya berdasarkan sikap diam atau pengakuan para pihak;')
FAKTA1 = 'Bahwa #0046# dan #0047# adalah suami istri yang sah menurut hukum Islam dan perkawinan tersebut masih berlangsung (belum putus);'
FAKTA2 = 'Bahwa #3696#;'
FAKTA2_TOLAK = 'Bahwa #0046# mendalilkan bahwa #0047# telah melalaikan #3693# terhadap #0046#, tetapi dalil tersebut tidak terbukti sebagaimana dipertimbangkan di bawah;'
FAKTA3 = 'Bahwa #0047# bekerja sebagai #0104# #5271#;'
P2_KABUL = '#3698##3726##3722##3720##3724##3728#'
MENYATAKAN = 'Menyatakan #0047# telah melalaikan kewajibannya selaku #3692# terhadap #0046# selaku #3690#;'
MENGHUKUM = 'Menghukum #0047# untuk melaksanakan kewajibannya kepada #0046# selaku #3690#, sebagai berikut:#3723##3721##3725##3729#'


# Berkas dasar (nafkah anak) -> berkas tujuan jenis ini
DASAR = [
    ('01', '[01] [Kabul] Nafkah Anak - Kontradiktoir.rtf', '[01] [Kabul] %s - Kontradiktoir.rtf'),
    ('01a', '[01a] [Kabul] Nafkah Anak - T Tidak Hadir Setelah Mediasi.rtf', '[01a] [Kabul] %s - T Tidak Hadir Setelah Mediasi.rtf'),
    ('01b', '[01b] [Kabul Verstek] Nafkah Anak.rtf', '[01b] [Kabul Verstek] %s.rtf'),
    ('02', '[02] [Kabul Sebagian] Nafkah Anak - Kontradiktoir - Petitum Selebihnya Ditolak.rtf', '[02] [Kabul Sebagian] %s - Kontradiktoir - Petitum Selebihnya Ditolak.rtf'),
    ('02b', '[02b] [Kabul Sebagian Verstek] Nafkah Anak - T Tidak Hadir - Petitum Selebihnya Ditolak.rtf', '[02b] [Kabul Sebagian Verstek] %s - T Tidak Hadir - Petitum Selebihnya Ditolak.rtf'),
    ('03', '[03] [Tolak] Nafkah Anak - Kontradiktoir - Dalil Tidak Terbukti.rtf', '[03] [Tolak] %s - Kontradiktoir - Dalil Tidak Terbukti.rtf'),
    ('03b', '[03b] [Tolak Verstek] Nafkah Anak - T Tidak Hadir - Dalil Tidak Terbukti.rtf', '[03b] [Tolak Verstek] %s - T Tidak Hadir - Dalil Tidak Terbukti.rtf'),
    ('97', '[97] [Perdamaian] Nafkah Anak - Akta Perdamaian.rtf', '[97] [Perdamaian] %s - Akta Perdamaian.rtf'),
    ('98', '[98] [Cabut] Nafkah Anak - P & T Hadir Sebelum Jawaban.rtf', '[98] [Cabut] %s - P & T Hadir Sebelum Jawaban.rtf'),
    ('98b', '[98b] [Cabut] Nafkah Anak - Sesudah Jawaban dengan Persetujuan T.rtf', '[98b] [Cabut] %s - Sesudah Jawaban dengan Persetujuan T.rtf'),
    ('98a', '[98a] [Gugur] Nafkah Anak - P Tidak Hadir Sidang Pertama.rtf', '[98a] [Gugur] %s - P Tidak Hadir Sidang Pertama.rtf'),
    ('98c', '[98c] [Coret] Nafkah Anak - Dibatalkan dari Pendaftaran - Panjar Habis.rtf', '[98c] [Coret] %s - Dibatalkan dari Pendaftaran - Panjar Habis.rtf'),
    ('99', '[99] [NO] Nafkah Anak - P Hadir Lalu 2x Tidak Hadir (SEMA 1 2022).rtf', '[99] [NO] %s - P Hadir Lalu 2x Tidak Hadir (SEMA 1 2022).rtf'),
    ('99a', '[99a] [NO] Nafkah Anak - Kurang Pihak (Plurium Litis Consortium).rtf', '[99a] [NO] %s - Kurang Pihak (Plurium Litis Consortium).rtf'),
    ('99b', '[99b] [NO] Nafkah Anak - Gugatan Kabur (Obscuur Libel).rtf', '[99b] [NO] %s - Gugatan Kabur (Obscuur Libel).rtf'),
]
KABUL = ('01', '01a', '01b', '02', '02b')
TOLAK = ('03', '03b')
FULL = KABUL + TOLAK

# Penanda lama (nafkah anak) -> penanda jenis ini, untuk isian yang tetap dipakai
PETA_TOKEN = {'#9955#': '#3730#', '#9911#': '#3731#', '#1214#': '#3730#', '#9755#': '#3732#', '#9756#': '#3733#', '#9759#': '#3690#', '#9301#': '#3692#'}
# Daftar isian tersembunyi isianasal: penanda lama -> baru (None = dibuang)
PETA_ISIAN = {'9740': '3700', '9741': None, '9742': '3705', '9743': '3709', '9744': '3707', '9745': '3708', '9746': '3701', '9747': '3702', '9748': '3696', '9749': '3691', '9750': '3712'}
TAMBAH_ISIAN = {
    'kabul': ['3694', '3697', '3699', '3703', '3704', '3706', '3710', '3730', '3731'],
    'tolak': ['3694', '3697', '3699', '3730', '3731'],
}
RX_ISIAN = re.compile(r'\{' + re.escape(chr(92) + '*' + chr(92) + 'isianasal ') + r'([^}]*)\}')


def perbarui_isian(raw, kode):
    m = RX_ISIAN.search(raw)
    if not m:
        return raw
    lama = re.findall(r'#(\d{4})#', m.group(1))
    baru = []
    for t in lama:
        x = PETA_ISIAN[t] if t in PETA_ISIAN else t
        if t == '9750' and kode in KABUL:
            x = '3711'
        if x and x not in baru:
            baru.append(x)
    if kode in KABUL:
        extra = TAMBAH_ISIAN['kabul'] + (['3711'] if kode in ('02', '02b') else [])
    elif kode in TOLAK:
        extra = TAMBAH_ISIAN['tolak']
    else:
        extra = []
    if kode in ('01a', '01b', '02b', '03b'):
        extra = [e for e in extra if e != '3731']
    if kode in TOLAK and '3696' in baru:
        baru.remove('3696')
    for e in extra:
        if e not in baru:
            baru.append(e)
    return raw[:m.start(1)] + ' '.join('#%s#' % t for t in baru) + raw[m.end(1):]


def _sisip_hukum(raw, kode, nama):
    """Ganti pertimbangan kewajiban nafkah anak (paragraf dasar) dengan pertimbangan kelalaian kewajiban."""
    cocok = r'^Menimbang, bahwa berdasarkan Pasal 41 huruf b Undang-Undang Nomor 1 Tahun 1974 tentang Perkawinan, bapak bertanggung jawab'
    if kode in TOLAK:
        raw, n = ganti_par(raw, cocok, '#3695##3727#', wajib=True, nama=nama)
    else:
        raw, n = ganti_par(raw, cocok, '#3695#', wajib=True, nama=nama)
        raw = sisip_par(raw, r'^#3695#$', [P2_KABUL], nama=nama)
    return raw


def susun_putusan(kode, dasar, tujuan):
    nama = dasar
    raw = L.baca_raw('6c Nafkah Anak/' + dasar)
    # --- 1. paragraf jenis-spesifik ---
    raw, n = ganti_par(raw, r'^Menimbang, bahwa #0053# #0046# pada pokoknya mengenai nafkah', KEWENANGAN, wajib=kode in FULL + ('97', '99a', '99b'), nama=nama)
    if kode in FULL:
        raw, n = ganti_par(raw, r'^Menimbang, bahwa berdasarkan surat #0053# dan keterangan para pihak, #0046# adalah #9759# dan #0047# adalah #9301#', KEDUDUKAN, wajib=True, nama=nama)
        raw, n = ganti_par(raw, r'^Bahwa #0047# bekerja sebagai', None, wajib=True, nama=nama)
        raw, n = ganti_par(raw, r'^Bahwa #0046# dan #0047# dahulu adalah suami istri', FAKTA1, wajib=True, nama=nama)
        raw, n = ganti_par(raw, r'^Bahwa dari perkawinan tersebut lahir', FAKTA2_TOLAK if kode in TOLAK else FAKTA2, wajib=True, nama=nama)
        raw, n = ganti_par(raw, r'^Bahwa #9748#;', FAKTA3, wajib=True, nama=nama)
        raw, n = ganti_par(raw, r'^(Mengenai|Pertimbangan) Nafkah Anak$', lambda b: b.replace('Nafkah Anak', 'Kelalaian Kewajiban Suami atau Istri'), wajib=True, nama=nama)
        raw = _sisip_hukum(raw, kode, nama)
    if kode in ('01', '02', '03'):
        raw, n = ganti_par(raw, r'^Apakah #9302# #0046# dan #0047# yang bernama', ISU1, wajib=True, nama=nama)
        raw, n = ganti_par(raw, r'^Apakah #0047# berkewajiban dan mampu memberi nafkah', ISU2, wajib=True, nama=nama)
        raw, n = ganti_par(raw, r'^Berapa besar nafkah', ISU3, wajib=True, nama=nama)
        raw, ok = ganti_sub(raw, BEBAN_LAMA, BEBAN_BARU, wajib=True, nama=nama)
    if kode in KABUL:
        raw, ok = ganti_sub(raw, 'mengenai nafkah #9302# tersebut', 'mengenai kelalaian kewajiban suami atau istri tersebut', wajib=True, nama=nama)
        raw, n = ganti_par(raw, r'^Menghukum #0047# untuk melaksanakan kewajibannya kepada', MENYATAKAN, wajib=True, nama=nama)
        raw = sisip_par(raw, r'^Menyatakan #0047# telah melalaikan kewajibannya', ['9.\t' + MENGHUKUM], nama=nama)
        raw = renomor_amar(raw, nama)
    if kode in ('99a', '99b'):
        raw, n = ganti_par(raw, r'^Menimbang, bahwa berdasarkan surat #0053# dan keterangan para pihak, #0046# adalah #9300# dan #0047# adalah #9301#', KEDUDUKAN_NO, wajib=True, nama=nama)
    # --- 2. frasa ---
    for lama, baru in (
        ('namun karena perkara a quo menyangkut kepentingan anak, dalil-dalil tersebut tetap perlu dibuktikan',
         'namun karena perkara a quo menyangkut kewajiban dalam rumah tangga yang dilindungi hukum, dalil-dalil tersebut tetap perlu dibuktikan'),
        ('nafkah anak yang disengketakan', 'kewajiban suami atau istri yang disengketakan'),
        ('persoalan nafkah anak', 'persoalan rumah tangga a quo'),
        ('sengketa nafkah anak a quo', 'sengketa %s a quo' % KATA),
    ):
        raw, _ok = ganti_sub(raw, lama, baru)
    raw = raw.replace('nafkah anak', KATA)
    # --- 3. penanda ---
    for lama, baru in PETA_TOKEN.items():
        raw = raw.replace(lama, baru)
    raw = raw.replace('#9750#', '#3711#' if kode in KABUL else '#3712#')
    raw = perbarui_isian(raw, kode)
    return raw


def periksa_sisa(teks, nama):
    """Kata milik nafkah anak yang tersisa = galat penyusunan."""
    galat = []
    for pola in (r'nafkah anak', r'\bbapak\b', r'\bayah\b', r'hadh?anah', r'\bibu\b', r'#9[37]\d\d#', r'putusnya perkawinan', r'\banak\b'):
        for m in re.finditer(pola, teks, re.I):
            galat.append('%s: sisa "%s" ...%s...' % (nama, m.group(0), teks[max(0, m.start() - 40):m.end() + 40].replace('\n', ' ')))
    return galat


def bangun_putusan():
    hasil, galat = [], []
    for kode, dasar, tujuan in DASAR:
        raw = susun_putusan(kode, dasar, tujuan)
        nama_tujuan = tujuan % S
        path = L.simpan_putusan(J, nama_tujuan, raw)
        galat += periksa_sisa(L.rtf_ke_teks(raw), nama_tujuan)
        hasil.append(path)
    return hasil, galat


# ---------------------------------------------------------------------------------------------------------------------
# BAS: 29 salinan (ALUR 04-09, helper bersama) + 9 khusus jenis ini (ALUR 64)
# ---------------------------------------------------------------------------------------------------------------------
def bas_khusus_raw(kode, akhir):
    raw = L.baca_raw('6c Nafkah Anak - BAS/BAS ALUR 46 Nafkah Anak - %s.rtf' % akhir)
    nama = akhir
    if kode in ('V2', 'V2S'):
        raw, n = ganti_par(raw, r'^Menghukum #0047# untuk melaksanakan kewajibannya kepada', MENYATAKAN, wajib=True, nama=nama)
        raw = sisip_par(raw, r'^Menyatakan #0047# telah melalaikan kewajibannya', ['9.\t' + MENGHUKUM], nama=nama)
        raw = renomor_amar(raw, nama)
    for lama, baru in (('persoalan nafkah anak', 'persoalan rumah tangga a quo'),):
        raw, _ok = ganti_sub(raw, lama, baru)
    for lama, baru in L.variasi('nafkah anak', KATA):
        raw = raw.replace(lama, L.esc(baru))
    for lama, baru in PETA_TOKEN.items():
        raw = raw.replace(lama, baru)
    raw = raw.replace('#9750#', '#3711#')
    m = RX_ISIAN.search(raw)
    if m:
        lama_t = re.findall(r'#(\d{4})#', m.group(1))
        baru_t = []
        for t in lama_t:
            x = PETA_ISIAN.get(t, t)
            if t == '9750':
                x = '3711'
            if x and x not in baru_t:
                baru_t.append(x)
        for e in TAMBAH_ISIAN['kabul']:
            if e != '3731' and e not in baru_t:
                baru_t.append(e)
        raw = raw[:m.start(1)] + ' '.join('#%s#' % t for t in baru_t) + raw[m.end(1):]
    return raw


def bangun_bas():
    hasil, galat = [], []
    hasil += L.buat_salinan_gugatan(J, '3730', '3731')
    for kode, akhir in L.KHUSUS_GUGATAN:
        raw = bas_khusus_raw(kode, akhir)
        hasil.append(L.simpan_bas(J, '%s - %s.rtf' % (J['awalan_bas'], akhir), raw))
    for p in hasil:
        galat += periksa_sisa(L.rtf_ke_teks(open(L.lp(p), 'rb').read().decode('latin1')), os.path.basename(p)[:60])
    return hasil, galat

# ---------------------------------------------------------------------------------------------------------------------
# RAMAH: label bahasa mudah untuk petugas (tampilan popup; nama ABT tidak diubah). {P}/{T} = sebutan Penggugat/Tergugat.
# ---------------------------------------------------------------------------------------------------------------------
RAMAH = {
    '3691': dict(nm='Kedudukan {P} (isi hanya bila jenis kelamin {P} di SIPP kosong atau keliru)', pil=['istri', 'suami'], saran='istri'),
    '3694': dict(nm='Kewajiban yang dilalaikan {T} (kosong = kewajiban selaku suami atau istri)',
                 pil=['kewajiban memberi nafkah lahir dan menyediakan tempat kediaman', 'kewajiban mengatur urusan rumah tangga dan berbakti lahir batin',
                      'kewajiban tinggal serumah dan memelihara rumah tangga'],
                 saran='kewajiban memberi nafkah lahir dan menyediakan tempat kediaman'),
    '3696': dict(nm='Fakta hukum kelalaian (siapa melalaikan apa, sejak kapan, serumah atau berpisah; kosong = kalimat bawaan)',
                 saran='{T} tidak memberikan nafkah lahir kepada {P} sejak bulan Maret 2024 dan keduanya telah berpisah tempat tinggal'),
    '3697': dict(nm='Sejak kapan kewajiban dilalaikan (kosong = tidak disebut)', pil=['sejak bulan Maret 2024', 'sejak tahun 2023', 'sejak awal tahun 2025']),
    '3699': dict(nm='Dalil {T} atau alasan sah (nusyuz, tidak mampu, dibebaskan; kosong = tidak ada)',
                 pil=['{P} nusyuz karena pergi dari tempat kediaman bersama tanpa izin {T}', '{T} tidak mampu karena tidak berpenghasilan tetap',
                      '{P} telah membebaskan {T} dari kewajiban tersebut']),
    '3700': dict(nm='Nafkah ke depan: jumlah setiap bulan (rupiah dan terbilang; kosong = tidak dituntut atau tidak dikabulkan)', saran='Rp1.500.000,00 (satu juta lima ratus ribu rupiah)'),
    '3701': dict(nm='Nafkah lampau: jangka waktu (mis. sejak bulan ... sampai bulan ...)', saran='sejak bulan Maret 2024 sampai dengan bulan Juli 2026 (29 bulan)'),
    '3702': dict(nm='Nafkah lampau: jumlah (rupiah dan terbilang, jumlah bulan x besaran; kosong = tidak dikabulkan)', saran='Rp43.500.000,00 (empat puluh tiga juta lima ratus ribu rupiah)'),
    '3703': dict(nm='Kiswah (pakaian) untuk {P}: bentuk atau jumlah (kosong = tidak dituntut)', saran='pakaian yang layak sesuai kebutuhan'),
    '3704': dict(nm='Tempat kediaman untuk {P}: bentuk pemenuhan (kosong = tidak dituntut)', saran='rumah yang layak di wilayah tempat tinggal bersama'),
    '3705': dict(nm='Biaya rumah tangga, perawatan dan pengobatan {P} (kosong = tidak dituntut)', saran='kebutuhan pokok sehari-hari dan biaya berobat'),
    '3706': dict(nm='Kewajiban lain bukan uang yang dituntut (kata kerja untuk amar; kosong = tidak dituntut)',
                 pil=['kembali tinggal serumah dengan {P} di tempat kediaman bersama', 'mengatur urusan rumah tangga sebaik-baiknya'],
                 saran='kembali tinggal serumah dengan {P} di tempat kediaman bersama'),
    '3707': dict(nm='Dasar kemampuan {T} dan kebutuhan dasar {P} (pekerjaan, penghasilan, standar biaya hidup setempat)', saran='{T} berpenghasilan sekitar Rp5.000.000,00 per bulan'),
    '3708': dict(nm='Pemotongan langsung dari penghasilan {T}: nama instansi atau perusahaan (kosong = tanpa pemotongan)'),
    '3709': dict(nm='Sita jaminan: objek yang dirinci dan nomor serta tanggal berita acara sita (kosong = tanpa sita)'),
    '3710': dict(nm='Uang paksa per hari keterlambatan (hanya bila dituntut dan hanya atas kewajiban bukan uang; kosong = tidak dikabulkan)', saran='Rp100.000,00 (seratus ribu rupiah)'),
    '3711': dict(nm='Alasan petitum selebihnya ditolak (putusan dikabulkan sebagian; kosong = kalimat bawaan)'),
    '3712': dict(nm='Alasan gugatan ditolak (putusan ditolak; kosong = kalimat bawaan)',
                 pil=['alat bukti yang diajukan {P} tidak cukup membuktikan bahwa {T} telah melalaikan kewajibannya tanpa alasan yang sah',
                      '{T} terbukti tidak mampu sehingga tidak memenuhi kewajiban bukan karena kelalaian',
                      '{P} terbukti nusyuz sehingga kewajiban {T} tidak berlaku']),
    '3730': dict(nm='Alat bukti surat {P} (daftar bukti P.1 dst.; kosong = tanpa daftar)'),
    '3731': dict(nm='Alat bukti surat {T} (daftar bukti T.1 dst.; kosong = tanpa daftar)'),
}

# ---------------------------------------------------------------------------------------------------------------------
# PETA blangko putusan jenis ini (status + keadaan unik)
# ---------------------------------------------------------------------------------------------------------------------
_KEADAAN = {'01a': 't-tidak-hadir-setelah-mediasi', '01b': 'verstek', '02b': 'verstek', '03b': 'verstek', '98b': 'sesudah-jawaban', '99': 'sema-1-2022', '99a': 'kurang-pihak', '99b': 'cacat-formil'}
_CATATAN = {'01': 'Dikabulkan: kontradiktoir', '01a': 'Dikabulkan: Tergugat berhenti hadir sesudah mediasi', '01b': 'Dikabulkan: verstek', '02': 'Dikabulkan sebagian: petitum selebihnya ditolak',
            '02b': 'Dikabulkan sebagian: verstek', '03': 'Ditolak: dalil tidak terbukti, Tergugat tidak mampu, atau nusyuz', '03b': 'Ditolak: verstek',
            '99a': 'Tidak dapat diterima: kurang pihak', '99b': 'Tidak dapat diterima: gugatan kabur'}
PETA = [L.meta(J, tujuan % S, _KEADAAN.get(kode, ''), _CATATAN.get(kode, '')) for kode, _d, tujuan in DASAR]


def bangun():
    """Menulis SEMUA RTF jenis ini (idempoten): 15 putusan + 29 salinan BAS + 9 BAS khusus."""
    put, g1 = bangun_putusan()
    bas, g2 = bangun_bas()
    if g1 + g2:
        raise SystemExit('sisa kata nafkah anak: %r' % (g1 + g2)[:5])
    return put, bas


if __name__ == '__main__':
    p, b = bangun()
    print('putusan: %d | BAS: %d | variabel baru: %d | isian: %d | PETA: %d' % (len(p), len(b), len(__import__('variabel_def').VAR), len(ISIAN), len(PETA)))
