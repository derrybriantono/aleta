# -*- coding: utf-8 -*-
"""Jenis IZIN KAWIN (SIPP 361, Pdt.P, alur 16) - blangko Derry BARU "3a Izin Kawin" dan "3a Izin Kawin - BAS" (agen W3a-B, 21 Okt 2026).

Dasar hukum (semua dicocokkan dengan naskah lokal, lihat docs/gelombang3/PERIKSA-PASAL-W3a-izin-kawin.md):
  Pasal 6 ayat (1)-(6) dan Pasal 7 ayat (1)-(2) UU 1/1974 (Pasal 7 sebagaimana diubah UU 16/2019), Pasal 63 ayat (1) huruf a UU 1/1974,
  Pasal 6 ayat (2) huruf c PP 9/1975, Pasal 15 ayat (2), Pasal 16-17 dan Pasal 39-44 KHI, Penjelasan Pasal 49 huruf a angka 2 UU 7/1989 jo. UU 3/2006 jo. UU 50/2009.
Permohonan diajukan oleh calon mempelai yang belum berumur 21 tahun (Pasal 6 ayat (5)); orang tua/wali/keluarga garis lurus ke atas yang DIDENGAR
BUKAN pihak SIPP - nama dan hubungannya diisi petugas (3644-3647) dan dirangkai otomatis (3648).

Pakai:  python sumber/jenis_izin_kawin.py     (menulis semua RTF ke rtf/derry_briantono/3a Izin Kawin* dan mencetak ringkasan)
"""
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import w3a_lib as L  # noqa: E402
import w3a_susun_b as S  # noqa: E402
from variabel_def import V  # noqa: E402

J = L.JENIS['izin-kawin']

# ---------------------------------------------------------------------------------------------------------------------
# VARIABEL BARU 3640-3659
# ---------------------------------------------------------------------------------------------------------------------
V(3640, 'IZIN KAWIN: NAMA CALON PASANGAN #0046# - ISIAN (nama lengkap bin/binti)', 'data_teks')
V(3641, 'IZIN KAWIN: UMUR CALON PASANGAN #0046# - ISIAN (angka tahun, mis. 20; menentukan pertimbangan batas umur 19 tahun)', 'data_teks', default='...')
V(3642, 'IZIN KAWIN: SEBUTAN CALON PASANGAN (OTOMATIS: SIPP jenis kelamin #0046#; perempuan = calon suami, laki-laki = calon istri)', 'data_sql',
  '''SELECT IFNULL((SELECT CASE WHEN p.jenis_kelamin = 'P' THEN 'calon suami' WHEN p.jenis_kelamin = 'L' THEN 'calon istri' ELSE 'calon pasangan' END
  FROM perkara_pihak1 pp JOIN pihak p ON p.id = pp.pihak_id WHERE pp.perkara_id = '#perkara_id#' AND pp.urutan = 1 LIMIT 1), 'calon pasangan') AS data''')
V(3643, 'IZIN KAWIN: UMUR #0046# SAAT PERKARA DIDAFTARKAN (OTOMATIS dari SIPP pihak.tanggal_lahir; kosong bila tanggal lahir belum ada)', 'data_sql',
  '''SELECT IFNULL((SELECT TIMESTAMPDIFF(YEAR, p.tanggal_lahir, pr.tanggal_pendaftaran)
  FROM perkara_pihak1 pp JOIN pihak p ON p.id = pp.pihak_id JOIN perkara pr ON pr.perkara_id = pp.perkara_id
  WHERE pp.perkara_id = '#perkara_id#' AND pp.urutan = 1 AND p.tanggal_lahir IS NOT NULL AND p.tanggal_lahir <> '0000-00-00' LIMIT 1), '') AS data''')
V(3644, 'IZIN KAWIN: ORANG YANG DIDENGAR KE-1 - NAMA (orang tua/wali/keluarga garis lurus ke atas; nama lengkap bin/binti)', 'data_teks')
V(3645, 'IZIN KAWIN: ORANG YANG DIDENGAR KE-1 - HUBUNGAN DENGAN #0046# (mis. ayah kandung, ibu kandung, kakek, nenek, wali, orang yang memelihara)', 'data_teks', default='ayah kandung')
V(3646, 'IZIN KAWIN: ORANG YANG DIDENGAR KE-2 - NAMA (kosongkan bila hanya satu orang yang didengar)', 'data_teks')
V(3647, 'IZIN KAWIN: ORANG YANG DIDENGAR KE-2 - HUBUNGAN DENGAN #0046# (mis. ibu kandung)', 'data_teks', default='ibu kandung')
V(3648, 'IZIN KAWIN: ORANG-ORANG YANG DIDENGAR (OTOMATIS dari isian 3644-3647: ayah kandung #0046# bernama ... dan ibu kandung #0046# bernama ...)', 'data_sql',
  '''SELECT IF(x.s = '', 'orang tua atau wali #0046#', x.s) AS data FROM (SELECT CONCAT_WS(' dan ',
  IF(TRIM("#3644#") <> "", CONCAT(IF(TRIM("#3645#") <> "", TRIM("#3645#"), "orang tua"), " #0046# bernama #3644#"), NULL),
  IF(TRIM("#3646#") <> "", CONCAT(IF(TRIM("#3647#") <> "", TRIM("#3647#"), "wali"), " #0046# bernama #3646#"), NULL)) AS s) x''')
V(3649, 'IZIN KAWIN: KEADAAN ORANG TUA/WALI - ISIAN (angka 1-5: 1 kedua hidup; 2 satu meninggal; 3 satu tidak mampu; 4 kedua meninggal; 5 kedua tidak mampu)', 'data_teks', default='1')
V(3650, 'IZIN KAWIN: POKOK KETERANGAN ORANG YANG DIDENGAR YANG HADIR DI PERSIDANGAN (sikapnya terhadap rencana perkawinan; kosong = tidak hadir)', 'data_teks')
V(3651, 'IZIN KAWIN: ALASAN TIDAK MEMBERI IZIN / BELUM MENYATAKAN PENDAPAT - ISIAN (tulis "karena ...")', 'data_teks', default='karena ........')
V(3652, 'IZIN KAWIN: PERTIMBANGAN KEDUDUKAN PEMBERI IZIN (OTOMATIS dari isian 3649: Pasal 6 ayat (2), (3) atau (4) UU 1/1974)', 'data_sql',
  '''SELECT CASE
  WHEN LEFT(TRIM("#3649#"), 1) IN ("", "1") THEN "Menimbang, bahwa berdasarkan Pasal 6 ayat (2) Undang-Undang Nomor 1 Tahun 1974 tentang Perkawinan jo. Pasal 15 ayat (2) Kompilasi Hukum Islam, untuk melangsungkan perkawinan seorang yang belum mencapai umur 21 (dua puluh satu) tahun harus mendapat izin kedua orang tua; oleh karena kedua orang tua kandung #0046# masih hidup dan mampu menyatakan kehendaknya, izin yang diperlukan adalah izin dari kedua orang tua tersebut, yaitu #3648#;"
  WHEN LEFT(TRIM("#3649#"), 1) = "2" THEN "Menimbang, bahwa berdasarkan Pasal 6 ayat (3) Undang-Undang Nomor 1 Tahun 1974 tentang Perkawinan jo. Pasal 15 ayat (2) Kompilasi Hukum Islam, dalam hal salah seorang dari kedua orang tua telah meninggal dunia, izin cukup diperoleh dari orang tua yang masih hidup; oleh karena salah seorang dari kedua orang tua kandung #0046# telah meninggal dunia, izin yang diperlukan adalah izin dari orang tua yang masih hidup, yaitu #3648#;"
  WHEN LEFT(TRIM("#3649#"), 1) = "3" THEN "Menimbang, bahwa berdasarkan Pasal 6 ayat (3) Undang-Undang Nomor 1 Tahun 1974 tentang Perkawinan jo. Pasal 15 ayat (2) Kompilasi Hukum Islam, dalam hal salah seorang dari kedua orang tua dalam keadaan tidak mampu menyatakan kehendaknya, izin cukup diperoleh dari orang tua yang mampu menyatakan kehendaknya; oleh karena salah seorang dari kedua orang tua kandung #0046# tidak mampu menyatakan kehendaknya, izin yang diperlukan adalah izin dari orang tua yang mampu menyatakan kehendaknya, yaitu #3648#;"
  WHEN LEFT(TRIM("#3649#"), 1) IN ("4", "5") THEN "Menimbang, bahwa berdasarkan Pasal 6 ayat (4) Undang-Undang Nomor 1 Tahun 1974 tentang Perkawinan jo. Pasal 15 ayat (2) Kompilasi Hukum Islam, dalam hal kedua orang tua telah meninggal dunia atau dalam keadaan tidak mampu menyatakan kehendaknya, izin diperoleh dari wali, orang yang memelihara atau keluarga yang mempunyai hubungan darah dalam garis keturunan lurus ke atas selama mereka masih hidup dan dalam keadaan dapat menyatakan kehendaknya; oleh karena kedua orang tua kandung #0046# tidak dapat memberikan izin, izin yang diperlukan adalah izin dari #3648#;"
  ELSE "[PERIKSA: isian keadaan orang tua/wali (3649) harus angka 1 sampai 5] Menimbang, bahwa izin untuk melangsungkan perkawinan bagi seorang yang belum mencapai umur 21 (dua puluh satu) tahun diperoleh dari #3648# sebagaimana diatur dalam Pasal 6 ayat (2), (3) dan (4) Undang-Undang Nomor 1 Tahun 1974 tentang Perkawinan;" END AS data''')
V(3653, 'IZIN KAWIN: PERTIMBANGAN UMUR #0046# DAN CALON PASANGAN (OTOMATIS dari #3643# dan isian 3641; diberi tanda PERIKSA bila di bawah 19 atau 21 tahun ke atas)', 'data_sql',
  '''SELECT CONCAT("Menimbang, bahwa berdasarkan Pasal 6 ayat (2) Undang-Undang Nomor 1 Tahun 1974 tentang Perkawinan jo. Pasal 15 ayat (2) Kompilasi Hukum Islam, calon mempelai yang belum mencapai umur 21 (dua puluh satu) tahun harus mendapat izin orang tua atau pihak yang disebut dalam ayat (3) dan (4) pasal tersebut, sedangkan Pasal 7 ayat (1) Undang-Undang Nomor 1 Tahun 1974 sebagaimana telah diubah dengan Undang-Undang Nomor 16 Tahun 2019 menentukan bahwa perkawinan hanya diizinkan apabila pria dan wanita sudah mencapai umur 19 (sembilan belas) tahun; berdasarkan bukti surat dan identitas, ",
  CASE
    WHEN TRIM("#3643#") = "" THEN "[PERIKSA: tanggal lahir #0046# belum ada di SIPP; pastikan #0046# berumur 19 sampai dengan 20 tahun] #0046# belum mencapai umur 21 (dua puluh satu) tahun dan telah mencapai batas umur perkawinan 19 (sembilan belas) tahun"
    WHEN CAST("#3643#" AS UNSIGNED) < 19 THEN "[PERIKSA: umur #0046# menurut SIPP baru #3643# tahun, belum mencapai batas umur perkawinan 19 tahun - perlu dispensasi kawin yang diajukan orang tua (PERMA 5/2019), bukan izin kawin] #0046# berumur #3643# tahun"
    WHEN CAST("#3643#" AS UNSIGNED) >= 21 THEN "[PERIKSA: umur #0046# menurut SIPP sudah #3643# tahun (21 tahun atau lebih) sehingga izin Pasal 6 ayat (2) tidak diperlukan - pertimbangkan blangko Tidak Dapat Diterima] #0046# berumur #3643# tahun"
    ELSE "#0046# berumur #3643# tahun sehingga belum mencapai umur 21 (dua puluh satu) tahun, tetapi telah memenuhi batas umur perkawinan 19 (sembilan belas) tahun" END,
  CASE
    WHEN TRIM("#3641#") REGEXP "^[0-9]+$" AND CAST("#3641#" AS UNSIGNED) < 19 THEN ", sedangkan [PERIKSA: umur #3640# baru #3641# tahun, belum mencapai batas umur perkawinan 19 tahun - perlu dispensasi kawin bagi calon pasangan] #3640# berumur #3641# tahun"
    WHEN TRIM("#3641#") REGEXP "^[0-9]+$" THEN ", demikian pula #3640# yang berumur #3641# tahun telah memenuhi batas umur perkawinan 19 (sembilan belas) tahun"
    ELSE "" END, ";") AS data''')
V(3654, 'IZIN KAWIN: ALAT BUKTI SURAT #0046# - ISIAN (daftar bukti P.1 dst.: KTP dan KK Pemohon, akta kelahiran Pemohon, KTP orang yang didengar, KTP calon pasangan)', 'data_teks',
  default='1. Fotokopi Kartu Tanda Penduduk atas nama #0098#, NIK #0335#, yang dikeluarkan oleh Dinas Kependudukan dan Pencatatan Sipil ..., bukti surat tersebut telah diberi meterai cukup, di-nazegelen, serta telah dicocokkan dengan aslinya yang ternyata sesuai, lalu diberi tanda P.1;<br>'
          '2. Fotokopi Kartu Keluarga Nomor ... yang memuat #0098#, yang dikeluarkan oleh Dinas Kependudukan dan Pencatatan Sipil ..., bukti surat tersebut telah diberi meterai cukup, di-nazegelen, serta telah dicocokkan dengan aslinya yang ternyata sesuai, lalu diberi tanda P.2;<br>'
          '3. Fotokopi Kutipan Akta Kelahiran atas nama #0098#, Nomor ..., yang dikeluarkan oleh Dinas Kependudukan dan Pencatatan Sipil ..., bukti surat tersebut telah diberi meterai cukup, di-nazegelen, serta telah dicocokkan dengan aslinya yang ternyata sesuai, lalu diberi tanda P.3;<br>'
          '4. Fotokopi Kartu Tanda Penduduk atas nama #3640#, NIK ..., yang dikeluarkan oleh Dinas Kependudukan dan Pencatatan Sipil ..., bukti surat tersebut telah diberi meterai cukup, di-nazegelen, serta telah dicocokkan dengan aslinya yang ternyata sesuai, lalu diberi tanda P.4;')
V(3655, 'IZIN KAWIN: FAKTA KEADAAN ORANG TUA/WALI (OTOMATIS dari isian 3649; kalimat fakta hukum)', 'data_sql',
  '''SELECT CASE LEFT(TRIM("#3649#"), 1)
  WHEN "2" THEN "salah seorang dari kedua orang tua kandung #0046# telah meninggal dunia, sedangkan yang lain masih hidup dan mampu menyatakan kehendaknya"
  WHEN "3" THEN "salah seorang dari kedua orang tua kandung #0046# dalam keadaan tidak mampu menyatakan kehendaknya, sedangkan yang lain mampu menyatakan kehendaknya"
  WHEN "4" THEN "kedua orang tua kandung #0046# telah meninggal dunia, sedangkan #3648# masih hidup dan dapat menyatakan kehendaknya"
  WHEN "5" THEN "kedua orang tua kandung #0046# dalam keadaan tidak mampu menyatakan kehendaknya, sedangkan #3648# masih hidup dan dapat menyatakan kehendaknya"
  ELSE "kedua orang tua kandung #0046# masih hidup dan mampu menyatakan kehendaknya" END AS data''')
V(3656, 'IZIN KAWIN: PERTIMBANGAN MAJELIS ATAS KEBERATAN / ALASAN (isi hakim: mengapa keberatan tidak beralasan hukum [kabul] atau beralasan [tolak])', 'data_teks')
V(3657, 'IZIN KAWIN: KESIAPAN #0046# DAN CALON PASANGAN - ISIAN (pendidikan, pekerjaan, kemampuan membina rumah tangga; kosongkan bila tidak dipertimbangkan)', 'data_teks')
V(3658, 'IZIN KAWIN: PERTIMBANGAN KESIAPAN (OTOMATIS: muncul hanya bila isian 3657 terisi; diawali satu baris baru)', 'data_sql',
  '''SELECT IF(TRIM("#3657#") <> "", CONCAT("<br>Menimbang, bahwa mengenai kesiapan #0046# dan #3640# untuk membina rumah tangga, berdasarkan keterangan #0046#, keterangan #3648# dan keterangan saksi-saksi diketahui bahwa #3657#, sehingga #8554# menilai kesiapan keduanya menjadi bahan pertimbangan yang patut diperhatikan dalam menentukan apakah izin dapat diberikan;"), "") AS data''')
V(3659, 'IZIN KAWIN: BAS - PENDENGARAN ORANG YANG DIDENGAR (OTOMATIS: isian 3650 kosong = tidak hadir meskipun dipanggil patut; terisi = hadir dan menyatakan pendapat)', 'data_sql',
  '''SELECT IF(TRIM("#3650#") = "", "Bahwa #3648# telah dipanggil dengan patut untuk didengar keterangannya mengenai rencana perkawinan #7036# dengan #3640#, akan tetapi tidak hadir di persidangan",
  "Selanjutnya #3648# dipanggil masuk dan menghadap ke persidangan, yang atas pertanyaan #4004# menyatakan pendapatnya mengenai rencana perkawinan #7036# dengan #3640# (#3642# #7036#) yang pada pokoknya sebagai berikut: #3650#") AS data''')

# Isian petugas yang tidak mungkin terisi otomatis (dibaca portal: isian-metadata.ts). Satu kode tidak boleh di kedua kelompok.
ISIAN = {
    '3640': ('manual', 'Nama calon pasangan dibaca dari posita bila ada kalimat "akan menikah dengan ... bernama ..."; selain itu ketik dari keterangan Pemohon (tidak ada di data pihak SIPP).'),
    '3641': ('manual', 'Umur calon pasangan tidak tercatat di SIPP; ketik dari posita atau keterangan di sidang. Bila di bawah 19 tahun, calon pasangan perlu dispensasi kawin.'),
    '3644': ('manual', 'Orang tua, wali atau keluarga garis lurus ke atas yang didengar bukan pihak di SIPP; ketik namanya dari posita atau relaas panggilan.'),
    '3645': ('manual', 'Hubungan orang yang didengar dengan Pemohon (ayah kandung, ibu kandung, kakek, wali, dan seterusnya) diisi dari posita atau keterangan di sidang.'),
    '3646': ('opsional', 'Orang kedua yang didengar (mis. ibu kandung) bila orang tua kedua-duanya didengar.'),
    '3647': ('opsional', 'Hubungan orang kedua yang didengar dengan Pemohon (mis. ibu kandung).'),
    '3649': ('manual', 'Keadaan orang tua (kedua hidup, salah seorang meninggal atau tidak mampu, kedua meninggal atau tidak mampu) menentukan siapa yang memberi izin menurut Pasal 6 ayat (2), (3), (4); diisi dari posita dan bukti.'),
    '3650': ('manual', 'Pokok keterangan orang tua/wali di sidang tidak tercatat di SIPP; ketik dari berita acara sidang. Kosongkan bila tidak hadir meskipun dipanggil patut.'),
    '3651': ('manual', 'Alasan orang tua/wali tidak memberi izin atau tidak menyatakan pendapat diambil dari posita atau keterangan di sidang.'),
    '3654': ('manual', 'Daftar bukti surat diketik dari berkas e-Court atau yang diserahkan di sidang (KTP, KK, akta kelahiran Pemohon, identitas calon pasangan).'),
    '3656': ('manual', 'Penilaian atas keberatan orang tua/wali (beralasan atau tidak) adalah pertimbangan majelis; diisi hakim.'),
    '3657': ('opsional', 'Kesiapan Pemohon dan calon pasangan (pendidikan, pekerjaan, kemampuan) bila majelis mempertimbangkannya.'),
}

# Tampilan isian di popup Blangko Derry (bahasa mudah untuk petugas; {P} = sebutan Pemohon).
RAMAH = {
    '3640': dict(nm='Nama calon suami atau calon istri {P} (lengkap, bin atau binti)', saran='Dibaca dari posita bila tertulis; selain itu ketik dari keterangan Pemohon.'),
    '3641': dict(nm='Umur calon suami atau calon istri {P} (angka tahun)', saran='Bila di bawah 19 tahun, calon pasangan juga memerlukan dispensasi kawin.'),
    '3644': dict(nm='Orang tua, wali atau keluarga yang didengar (pertama): nama lengkap bin atau binti'),
    '3645': dict(nm='Hubungan orang yang didengar (pertama) dengan {P}', saran='Mis. ayah kandung, ibu kandung, kakek, nenek, wali, orang yang memelihara.'),
    '3646': dict(nm='Orang tua, wali atau keluarga yang didengar (kedua): nama lengkap bin atau binti', saran='Kosongkan bila hanya satu orang yang didengar.'),
    '3647': dict(nm='Hubungan orang yang didengar (kedua) dengan {P}', saran='Mis. ibu kandung.'),
    '3649': dict(nm='Keadaan orang tua {P} (pilih satu)', pil=[
        '1 · kedua orang tua masih hidup dan mampu menyatakan kehendak',
        '2 · salah seorang orang tua meninggal dunia',
        '3 · salah seorang orang tua tidak mampu menyatakan kehendak',
        '4 · kedua orang tua meninggal dunia',
        '5 · kedua orang tua tidak mampu menyatakan kehendak'], saran='Menentukan siapa yang berhak memberi izin menurut Pasal 6 ayat (2), (3), (4) UU 1/1974.'),
    '3650': dict(nm='Pokok keterangan orang yang didengar di sidang', saran='Ketik dari berita acara sidang. Kosongkan bila tidak hadir meskipun dipanggil patut.'),
    '3651': dict(nm='Alasan tidak memberi izin atau belum menyatakan pendapat (tulis "karena ...")'),
    '3654': dict(nm='Bukti surat {P} (P.1 dan seterusnya)', saran='KTP dan KK Pemohon, akta kelahiran Pemohon, identitas calon pasangan dan orang yang didengar.'),
    '3656': dict(nm='Pertimbangan majelis atas keberatan (isi hakim)', saran='Kabul: mengapa keberatan tidak beralasan hukum. Tolak: mengapa beralasan atau syarat lain tidak terpenuhi.'),
    '3657': dict(nm='Kesiapan {P} dan calon pasangan (bila dipertimbangkan)', saran='Pendidikan, pekerjaan, kemampuan membina rumah tangga. Kosongkan bila tidak dipertimbangkan.'),
}

# ---------------------------------------------------------------------------------------------------------------------
# Teks bersama
# ---------------------------------------------------------------------------------------------------------------------
UU7 = ('Undang-Undang Nomor 7 Tahun 1989 tentang Peradilan Agama sebagaimana telah diubah dengan Undang-Undang Nomor 3 Tahun 2006 dan perubahan kedua dengan Undang-Undang Nomor 50 Tahun 2009')
HEADER = '#3640# #3641# #3644# #3645# #3646# #3647# #3649# #3650# #3651# #3654# #3656# #3657#'
HEADER_SEDERHANA = '#3640# #3641# #3644# #3645# #3646# #3647# #3649# #3651# #3654# #3656#'


def kewenangan(sebab):
    """Dua paragraf kewenangan absolut dan relatif + legal standing. sebab: kalimat sebab izin tidak diperoleh."""
    return [
        ('h', 'Pertimbangan Kewenangan Pengadilan'),
        ('b', 'Menimbang, bahwa #0053# #0046# pada pokoknya memohon agar Pengadilan memberikan izin kepada #0046# yang belum berumur 21 (dua puluh satu) tahun untuk melangsungkan perkawinan dengan #3640#, '
              + sebab + ' permohonan tersebut diajukan oleh orang yang beragama Islam dan termasuk bidang perkawinan, sehingga berdasarkan Pasal 49 huruf a beserta Penjelasan Pasal 49 huruf a angka 2 '
              + UU7 + ' jo. Pasal 63 ayat (1) huruf a Undang-Undang Nomor 1 Tahun 1974 tentang Perkawinan, perkara a quo termasuk kewenangan absolut Pengadilan Agama;'),
        ('b', 'Menimbang, bahwa Pasal 6 ayat (5) Undang-Undang Nomor 1 Tahun 1974 tentang Perkawinan menentukan bahwa permintaan izin diajukan kepada Pengadilan dalam daerah hukum tempat tinggal orang yang akan melangsungkan perkawinan; '
              'oleh karena #0046# bertempat tinggal di #0101# yang termasuk dalam wilayah hukum #8008#, maka perkara a quo termasuk kewenangan relatif #8008#;'),
        ('h', 'Pertimbangan Kedudukan Hukum (Legal Standing)'),
        ('b', 'Menimbang, bahwa berdasarkan Pasal 6 ayat (5) Undang-Undang Nomor 1 Tahun 1974 tentang Perkawinan jo. Pasal 15 ayat (2) Kompilasi Hukum Islam, Pengadilan dapat memberikan izin atas permintaan orang yang akan melangsungkan perkawinan; '
              'oleh karena #0046# adalah calon mempelai yang belum berumur 21 (dua puluh satu) tahun dan akan melangsungkan perkawinan dengan #3640#, maka #0046# mempunyai kedudukan hukum (legal standing/persona standi in judicio) untuk mengajukan #0053# a quo;'),
    ]


def pokok_pembuktian(pokok_ketiga):
    return [
        ('h', 'Pertimbangan Pokok Permohonan'),
        ('b', 'Menimbang, bahwa ketentuan Pasal 6 ayat (6) Undang-Undang Nomor 1 Tahun 1974 tentang Perkawinan menentukan bahwa ketentuan ayat (1) sampai dengan ayat (5) berlaku sepanjang hukum masing-masing agamanya dan kepercayaannya dari yang bersangkutan tidak menentukan lain, '
              'sedangkan bagi umat Islam kewajiban izin tersebut dipertegas oleh Pasal 15 ayat (2) Kompilasi Hukum Islam, sehingga ketentuan izin tersebut berlaku bagi #0046# yang beragama Islam;'),
        ('b', 'Menimbang, bahwa oleh karena itu pokok yang harus dibuktikan dalam perkara ini adalah: (1) bahwa #0046# belum berumur 21 (dua puluh satu) tahun dan telah memenuhi batas umur perkawinan; (2) bahwa #0046# berkehendak melangsungkan perkawinan dengan #3640# tanpa paksaan dan di antara keduanya tidak terdapat halangan perkawinan; '
              'serta (3) ' + pokok_ketiga + ';'),
        ('b', '#3652#'),
        ('b', '#3653#'),
    ]


BUKTI = [
    ('h', 'Pertimbangan Alat Bukti'),
    ('b', 'Menimbang, bahwa bukti-bukti surat yang diajukan #0046# merupakan fotokopi akta autentik dan surat yang dikeluarkan oleh pejabat yang berwenang, telah bermeterai cukup, telah dinazegelen dan dicocokkan dengan aslinya, sehingga memenuhi syarat formil dan materiil sebagai alat bukti '
          'dan mempunyai kekuatan pembuktian yang sempurna dan mengikat sebagaimana dimaksud Pasal 285 RBg jo. Pasal 1870 KUH Perdata;'),
    ('b', 'Menimbang, bahwa bukti surat berupa fotokopi Kartu Tanda Penduduk dan Kartu Keluarga atas nama #0046# merupakan akta otentik yang dibuat oleh pejabat yang berwenang berdasarkan Undang-Undang Nomor 23 Tahun 2006 sebagaimana telah diubah dengan Undang-Undang Nomor 24 Tahun 2013 tentang Administrasi Kependudukan, '
          'sehingga mempunyai nilai kekuatan pembuktian yang sempurna dan mengikat (volledig en bindende bewijskracht) berdasarkan Pasal 285 RBg selama tidak dibuktikan kepalsuannya; bukti tersebut menerangkan bahwa #0046# beragama Islam dan bertempat tinggal di #0101# yang termasuk dalam wilayah hukum #8008#;'),
    ('b', 'Menimbang, bahwa bukti surat berupa fotokopi kutipan akta kelahiran atas nama #0046# merupakan akta otentik yang dibuat oleh pejabat yang berwenang berdasarkan Undang-Undang Nomor 23 Tahun 2006 sebagaimana telah diubah dengan Undang-Undang Nomor 24 Tahun 2013 tentang Administrasi Kependudukan, '
          'sehingga mempunyai nilai kekuatan pembuktian yang sempurna dan mengikat berdasarkan Pasal 285 RBg selama tidak dibuktikan kepalsuannya; bukti tersebut menerangkan tanggal lahir #0046#, yaitu #0345#, sehingga dapat diketahui umur #0046# dalam hubungannya dengan batas umur Pasal 6 ayat (2) dan Pasal 7 ayat (1) Undang-Undang Nomor 1 Tahun 1974;'),
    ('b', 'Menimbang, bahwa bukti-bukti surat lainnya sebagaimana tercantum dalam daftar alat bukti di atas, yaitu identitas #3648# dan identitas #3640#, relevan dengan perkara a quo dan menerangkan hubungan keluarga antara #0046# dengan #3648# serta identitas #3640# sebagai #3642# #0046#;'),
    ('b', 'Menimbang, bahwa saksi-saksi #0046# telah dewasa, bukan orang yang dilarang menjadi saksi, memberikan keterangan di bawah sumpah secara terpisah di persidangan, dan keterangannya didasarkan pada pengetahuan sendiri serta saling bersesuaian, '
          'sehingga memenuhi syarat formil dan materiil sebagaimana diatur dalam Pasal 172 ayat (1), Pasal 308 dan Pasal 309 RBg, oleh karena itu keterangan para saksi tersebut dapat diterima sebagai alat bukti;'),
    ('b', 'Menimbang, bahwa saksi-saksi #0046# pada pokoknya menerangkan tentang rencana perkawinan #0046# dengan #3640#, umur #0046#, sikap #3648# terhadap rencana perkawinan tersebut, dan ada tidaknya halangan perkawinan di antara keduanya; '
          'keterangan tersebut bersumber dari pengetahuan, penglihatan atau pendengaran saksi sendiri serta relevan dengan pokok yang harus dibuktikan, sehingga telah memenuhi syarat materiil;'),
]

BIAYA = [
    ('h', 'Pertimbangan Biaya Perkara'),
    ('b', 'Menimbang, bahwa oleh karena perkara ini termasuk bidang perkawinan, maka berdasarkan Pasal 89 ayat (1) ' + UU7 + ', biaya perkara dibebankan kepada #0046#;'),
    ('b', 'Memperhatikan segala peraturan perundang-undangan yang berlaku dan hukum Islam yang berkaitan dengan perkara ini;'),
]

HALANGAN = ('di antara #0046# dan #3640# tidak terdapat halangan perkawinan, baik karena hubungan darah, semenda maupun sesusuan sebagaimana Pasal 8 Undang-Undang Nomor 1 Tahun 1974 dan Pasal 39 sampai dengan Pasal 44 Kompilasi Hukum Islam, '
            'keduanya beragama Islam, dan masing-masing tidak sedang terikat perkawinan dengan orang lain')


def fakta_umum(butir_keberatan):
    return [
        ('h', 'Pertimbangan Hal-Hal yang Terbukti dan Fakta Hukum'),
        ('b', 'Menimbang, bahwa berdasarkan keterangan #0046#, keterangan #3648#, bukti surat dan keterangan saksi-saksi, ditemukan fakta hukum sebagai berikut:'),
        ('n', 'Bahwa #0046# beragama Islam, bertempat tinggal di #0101#, berstatus #1002#, dan belum mencapai umur 21 (dua puluh satu) tahun, yaitu berumur #3643# tahun;'),
        ('n', 'Bahwa #0046# hendak melangsungkan perkawinan dengan #3640# (#3642# #0046#) yang berumur #3641# tahun, atas kehendak sendiri tanpa paksaan, dan di antara keduanya tidak terdapat halangan perkawinan menurut hukum Islam dan peraturan perundang-undangan;'),
        ('n', 'Bahwa #3655#;'),
    ] + [('n', t) for t in butir_keberatan]


# ---------------------------------------------------------------------------------------------------------------------
# Penetapan KABUL
# ---------------------------------------------------------------------------------------------------------------------
NASIHAT_DENGAR = ('Bahwa #0690# telah menasihati #0046# dan #3648# agar mencapai kesepakatan secara kekeluargaan mengenai rencana perkawinan #0046# dengan #3640#, akan tetapi tidak berhasil dan #0046# tetap pada #0053#nya;')
DIBACAKAN = 'Bahwa selanjutnya dibacakan surat #0053# #0046# yang isinya tetap dipertahankan oleh #0046#;'


def keterangan_pemohon(akhir):
    return ('Bahwa atas pertanyaan #0690#, #0046# memberikan keterangan yang pada pokoknya bahwa #0046# belum berumur 21 (dua puluh satu) tahun, berstatus #1002#, dan hendak melangsungkan perkawinan dengan #3640# (#3642# #0046#) yang berumur #3641# tahun '
            'atas kehendak sendiri tanpa paksaan; bahwa di antara keduanya tidak terdapat halangan perkawinan; ' + akhir)


def kabul_hadir_berbeda_pendapat():
    """[01] Orang tua/wali hadir didengar tetapi tidak bersedia memberi izin (keadaan orang tua menurut isian 3649)."""
    timbang = [('b', 'Menimbang, bahwa maksud dan tujuan #0053# #0046# adalah sebagaimana telah diuraikan di atas;')]
    timbang += kewenangan('oleh karena #3648# tidak memberikan izin;')
    timbang += pokok_pembuktian('bahwa orang yang wajib memberikan izin berbeda pendapat atau tidak menyatakan pendapatnya, sehingga izin tidak diperoleh dan Pengadilan dapat memberikan izin setelah lebih dahulu mendengar mereka')
    timbang += BUKTI
    timbang += [('b', 'Menimbang, bahwa keterangan #3648# yang didengar di persidangan sebagaimana diuraikan dalam duduk perkara menunjukkan bahwa #3648# tidak bersedia memberikan izin #3651#; keterangan tersebut dipertimbangkan sebagai bahan penilaian #8554# '
                       'terhadap ada tidaknya alasan yang dibenarkan hukum untuk tidak memberikan izin, sebagaimana dikehendaki Pasal 6 ayat (5) Undang-Undang Nomor 1 Tahun 1974 yang mensyaratkan Pengadilan terlebih dahulu mendengar orang-orang yang disebut dalam ayat (2), (3) dan (4);')]
    timbang += fakta_umum([
        'Bahwa #3648# telah dipanggil dengan patut, hadir di persidangan dan didengar keterangannya, tetapi tidak bersedia memberikan izin #3651#;',
        'Bahwa upaya #0690# menasihati #0046# dan #3648# agar mencapai kesepakatan secara kekeluargaan tidak berhasil;'])
    timbang += _petitum_kabul('berdasarkan fakta hukum, #3648# telah didengar keterangannya di persidangan, namun tetap tidak bersedia memberikan izin sehingga terdapat perbedaan pendapat sebagaimana dimaksud ketentuan tersebut')
    return dict(
        dengar='Telah mendengar keterangan #0046#, keterangan #3648# dan saksi-saksi serta memeriksa alat-alat bukti di persidangan;',
        duduk=['Bahwa pada hari sidang yang telah ditetapkan, #4046# telah datang menghadap di persidangan, demikian pula #3648# yang telah dipanggil dengan patut telah datang menghadap di persidangan;',
               NASIHAT_DENGAR, DIBACAKAN,
               keterangan_pemohon('dan bahwa #3648# tidak bersedia memberikan izin #3651#;'),
               'Bahwa #3648# telah didengar keterangannya di persidangan yang pada pokoknya sebagai berikut: #3650#;'],
        timbang=timbang + BIAYA, amar=_amar_kabul())


def _petitum_kabul(kalimat_dengar):
    return [
        ('h', 'Pertimbangan Petitum'),
        ('b', 'Menimbang, bahwa selanjutnya #8554# akan mempertimbangkan petitum #0053# #0046# sesuai dengan fakta-fakta persidangan yang telah diuraikan di atas sebagai berikut;'),
        ('b', 'Petitum agar #0046# diberi izin untuk melangsungkan perkawinan dengan #3640#'),
        ('b', 'Menimbang, bahwa berdasarkan Pasal 6 ayat (1) Undang-Undang Nomor 1 Tahun 1974 tentang Perkawinan dan Pasal 16 ayat (1) Kompilasi Hukum Islam, perkawinan harus didasarkan atas persetujuan calon mempelai; berdasarkan fakta hukum, #0046# telah menyatakan kehendaknya melangsungkan perkawinan dengan #3640# '
              'tanpa paksaan, sehingga syarat persetujuan calon mempelai dapat dinilai terpenuhi, dengan tetap menjadi kewajiban Pegawai Pencatat Nikah menanyakan persetujuan kedua calon mempelai di hadapan dua saksi nikah sebelum perkawinan dilangsungkan sebagaimana Pasal 17 ayat (1) Kompilasi Hukum Islam;'),
        ('b', 'Menimbang, bahwa Pasal 6 ayat (5) Undang-Undang Nomor 1 Tahun 1974 tentang Perkawinan menentukan bahwa dalam hal ada perbedaan pendapat antara orang-orang yang disebut dalam ayat (2), (3) dan (4), atau salah seorang atau lebih di antara mereka tidak menyatakan pendapatnya, '
              'Pengadilan dalam daerah hukum tempat tinggal orang yang akan melangsungkan perkawinan atas permintaan orang tersebut dapat memberikan izin setelah lebih dahulu mendengar orang-orang tersebut, sedangkan Pasal 15 ayat (2) Kompilasi Hukum Islam menentukan bahwa calon mempelai yang belum mencapai umur 21 tahun harus mendapat izin '
              'sebagaimana diatur dalam Pasal 6 ayat (2), (3), (4) dan (5) Undang-Undang Nomor 1 Tahun 1974; ' + kalimat_dengar + ';'),
        ('b', 'Menimbang, bahwa wewenang Pengadilan memberikan izin menurut Pasal 6 ayat (5) tersebut bersifat memberi penilaian, sehingga #8554# perlu menilai apakah sikap #3648# yang tidak memberikan izin mempunyai alasan yang dibenarkan hukum; terhadap hal itu #8554# berpendapat bahwa #3656#;'),
        ('b', 'Menimbang, bahwa selain itu, berdasarkan fakta hukum, ' + HALANGAN + ', dan #0046# telah berumur #3643# tahun sehingga telah memenuhi batas umur perkawinan menurut Pasal 7 ayat (1) Undang-Undang Nomor 1 Tahun 1974 sebagaimana telah diubah dengan Undang-Undang Nomor 16 Tahun 2019.#3658#'),
        ('b', 'Menimbang, bahwa berdasarkan seluruh pertimbangan tersebut di atas, #0053# #0046# agar diberi izin untuk melangsungkan perkawinan dengan #3640# telah beralasan dan berdasar hukum, oleh karena itu patut dikabulkan;'),
    ]


def _amar_kabul():
    return ['Mengabulkan #0053# #0046#;',
            'Memberi izin kepada #0046# (#0098#) untuk melangsungkan perkawinan dengan #3640# (#3642# #0046#), dengan tetap memenuhi syarat dan tata cara perkawinan menurut peraturan perundang-undangan yang berlaku;',
            '#8505# (#0155# #7095#).']


def kabul_tidak_hadir():
    """[01a] Orang tua/wali dipanggil patut tetapi tidak hadir / tidak menyatakan pendapat."""
    timbang = [('b', 'Menimbang, bahwa maksud dan tujuan #0053# #0046# adalah sebagaimana telah diuraikan di atas;')]
    timbang += kewenangan('oleh karena #3648# tidak memberikan izin dan tidak menyatakan pendapatnya;')
    timbang += pokok_pembuktian('bahwa orang yang wajib memberikan izin tidak menyatakan pendapatnya, sehingga izin tidak diperoleh dan Pengadilan dapat memberikan izin setelah lebih dahulu memanggil dan mendengar mereka')
    timbang += BUKTI[:-1]
    timbang += [('b', 'Menimbang, bahwa saksi-saksi #0046# pada pokoknya menerangkan tentang rencana perkawinan #0046# dengan #3640#, umur #0046#, tidak diberikannya izin oleh #3648#, dan ada tidaknya halangan perkawinan di antara keduanya; '
                      'keterangan tersebut bersumber dari pengetahuan, penglihatan atau pendengaran saksi sendiri serta relevan dengan pokok yang harus dibuktikan, sehingga telah memenuhi syarat materiil;'),
                ('b', 'Menimbang, bahwa berdasarkan relaas panggilan yang dibuat oleh Juru Sita atau Juru Sita Pengganti, #3648# telah dipanggil secara resmi dan patut untuk didengar keterangannya, tetapi tidak datang menghadap di persidangan dan tidak pula menyuruh orang lain menghadap sebagai wakilnya, '
                      'sehingga #8554# tidak dapat mendengar keterangannya secara langsung; ketidakhadiran tersebut telah memberi kesempatan yang cukup kepada #3648# untuk menyatakan pendapatnya sebagaimana dikehendaki Pasal 6 ayat (5) Undang-Undang Nomor 1 Tahun 1974 tentang Perkawinan;')]
    timbang += fakta_umum([
        'Bahwa #3648# telah dipanggil secara resmi dan patut untuk didengar keterangannya, tetapi tidak hadir di persidangan dan tidak menyatakan pendapatnya, dengan sebab yang menurut #0046# #3651#;',
        'Bahwa tidak ternyata ada keberatan yang dibenarkan hukum dari #3648# terhadap rencana perkawinan #0046# dengan #3640#;'])
    timbang += _petitum_kabul('berdasarkan fakta hukum, #3648# telah dipanggil secara resmi dan patut tetapi tidak menyatakan pendapatnya sehingga terpenuhi keadaan salah seorang atau lebih dari mereka tidak menyatakan pendapatnya sebagaimana dimaksud ketentuan tersebut')
    return dict(
        dengar='Telah mendengar keterangan #0046# dan saksi-saksi serta memeriksa alat-alat bukti di persidangan, sedangkan #3648# yang telah dipanggil dengan patut tidak hadir di persidangan;',
        duduk=['Bahwa pada hari sidang yang telah ditetapkan, #4046# telah datang menghadap di persidangan, sedangkan #3648# yang telah dipanggil secara resmi dan patut tidak datang menghadap di persidangan dan tidak pula menyuruh orang lain menghadap sebagai wakilnya;',
               'Bahwa #0690# telah menasihati #0046# agar mengupayakan kembali kesediaan #3648# memberikan izin, namun #0046# menyatakan tetap pada #0053#nya;',
               DIBACAKAN,
               keterangan_pemohon('dan bahwa #3648# tidak memberikan izin dan tidak menyatakan pendapatnya mengenai rencana perkawinan tersebut #3651#;')],
        timbang=timbang + BIAYA, amar=_amar_kabul())


def kabul_satu_orang_tua():
    """[01b] Salah seorang orang tua meninggal dunia / tidak mampu menyatakan kehendak; orang tua yang lain hadir tetapi tidak memberi izin (Pasal 6 ayat (3))."""
    timbang = [('b', 'Menimbang, bahwa maksud dan tujuan #0053# #0046# adalah sebagaimana telah diuraikan di atas;')]
    timbang += kewenangan('oleh karena orang tua #0046# yang masih hidup dan mampu menyatakan kehendaknya, yaitu #3648#, tidak memberikan izin;')
    timbang += pokok_pembuktian('bahwa orang tua yang masih hidup dan mampu menyatakan kehendaknya tidak memberikan izin, sehingga izin tidak diperoleh dan Pengadilan dapat memberikan izin setelah lebih dahulu mendengarnya')
    timbang = [x for x in timbang if x[1] != '#3652#']      # ayat (3) ditulis tetap di bawah (tanpa pilihan 3649)
    timbang.insert(len(timbang) - 1, ('b', 'Menimbang, bahwa berdasarkan Pasal 6 ayat (3) Undang-Undang Nomor 1 Tahun 1974 tentang Perkawinan jo. Pasal 15 ayat (2) Kompilasi Hukum Islam, dalam hal salah seorang dari kedua orang tua telah meninggal dunia atau dalam keadaan tidak mampu menyatakan kehendaknya, '
                                          'izin cukup diperoleh dari orang tua yang masih hidup atau dari orang tua yang mampu menyatakan kehendaknya; oleh karena itu izin yang diperlukan adalah izin dari orang tua #0046# yang masih hidup dan mampu menyatakan kehendaknya, yaitu #3648#;'))
    timbang += BUKTI
    timbang += [('b', 'Menimbang, bahwa keterangan #3648# yang didengar di persidangan menunjukkan bahwa #3648# tidak bersedia memberikan izin #3651#; keterangan tersebut dipertimbangkan sebagai bahan penilaian #8554# terhadap ada tidaknya alasan yang dibenarkan hukum untuk tidak memberikan izin;')]
    fakta = fakta_umum([
        'Bahwa #3648# telah dipanggil dengan patut, hadir di persidangan dan didengar keterangannya, tetapi tidak bersedia memberikan izin #3651#;',
        'Bahwa upaya #0690# menasihati #0046# dan #3648# agar mencapai kesepakatan secara kekeluargaan tidak berhasil;'])
    fakta = [(j, t.replace('Bahwa #3655#;', 'Bahwa salah seorang dari kedua orang tua kandung #0046# telah meninggal dunia atau tidak mampu menyatakan kehendaknya, sedangkan orang tua yang lain masih hidup dan mampu menyatakan kehendaknya;')) for j, t in fakta]
    timbang += fakta
    timbang += _petitum_kabul('berdasarkan fakta hukum, orang tua #0046# yang masih hidup dan mampu menyatakan kehendaknya, yaitu #3648#, telah didengar keterangannya di persidangan, namun tetap tidak bersedia memberikan izin sehingga terdapat perbedaan pendapat sebagaimana dimaksud ketentuan tersebut')
    d = kabul_hadir_berbeda_pendapat()
    d['timbang'] = timbang + BIAYA
    d['dengar'] = 'Telah mendengar keterangan #0046#, keterangan #3648# selaku orang tua yang masih hidup dan saksi-saksi serta memeriksa alat-alat bukti di persidangan;'
    d['duduk'] = [t.replace('demikian pula #3648#', 'demikian pula #3648# selaku orang tua #0046# yang masih hidup dan mampu menyatakan kehendaknya,') for t in d['duduk']]
    return d


def kabul_wali_keluarga():
    """[01c] Kedua orang tua meninggal dunia / tidak mampu menyatakan kehendak; wali, orang yang memelihara atau keluarga garis lurus ke atas hadir tetapi berbeda pendapat (Pasal 6 ayat (4))."""
    timbang = [('b', 'Menimbang, bahwa maksud dan tujuan #0053# #0046# adalah sebagaimana telah diuraikan di atas;')]
    timbang += kewenangan('oleh karena wali, orang yang memelihara atau keluarga #0046# dalam garis keturunan lurus ke atas, yaitu #3648#, tidak memberikan izin;')
    timbang += pokok_pembuktian('bahwa wali, orang yang memelihara atau keluarga dalam garis keturunan lurus ke atas yang masih hidup dan dapat menyatakan kehendaknya tidak memberikan izin, sehingga izin tidak diperoleh dan Pengadilan dapat memberikan izin setelah lebih dahulu mendengarnya')
    timbang = [x for x in timbang if x[1] != '#3652#']
    timbang.insert(len(timbang) - 1, ('b', 'Menimbang, bahwa berdasarkan Pasal 6 ayat (4) Undang-Undang Nomor 1 Tahun 1974 tentang Perkawinan jo. Pasal 15 ayat (2) Kompilasi Hukum Islam, dalam hal kedua orang tua telah meninggal dunia atau dalam keadaan tidak mampu menyatakan kehendaknya, izin diperoleh dari wali, orang yang memelihara '
                                          'atau keluarga yang mempunyai hubungan darah dalam garis keturunan lurus ke atas selama mereka masih hidup dan dalam keadaan dapat menyatakan kehendaknya; oleh karena itu izin yang diperlukan adalah izin dari #3648#;'))
    timbang += BUKTI
    timbang += [('b', 'Menimbang, bahwa keterangan #3648# yang didengar di persidangan menunjukkan bahwa #3648# tidak bersedia memberikan izin #3651#; keterangan tersebut dipertimbangkan sebagai bahan penilaian #8554# terhadap ada tidaknya alasan yang dibenarkan hukum untuk tidak memberikan izin;')]
    fakta = fakta_umum([
        'Bahwa #3648# telah dipanggil dengan patut, hadir di persidangan dan didengar keterangannya, tetapi tidak bersedia memberikan izin #3651#;',
        'Bahwa upaya #0690# menasihati #0046# dan #3648# agar mencapai kesepakatan secara kekeluargaan tidak berhasil;'])
    fakta = [(j, t.replace('Bahwa #3655#;', 'Bahwa kedua orang tua kandung #0046# telah meninggal dunia atau dalam keadaan tidak mampu menyatakan kehendaknya, sedangkan #3648# adalah wali, orang yang memelihara atau keluarga #0046# dalam garis keturunan lurus ke atas yang masih hidup dan dapat menyatakan kehendaknya;')) for j, t in fakta]
    timbang += fakta
    timbang += _petitum_kabul('berdasarkan fakta hukum, wali, orang yang memelihara atau keluarga #0046# dalam garis keturunan lurus ke atas, yaitu #3648#, telah didengar keterangannya di persidangan, namun tetap tidak bersedia memberikan izin sehingga terdapat perbedaan pendapat sebagaimana dimaksud ketentuan tersebut')
    d = kabul_hadir_berbeda_pendapat()
    d['timbang'] = timbang + BIAYA
    d['dengar'] = 'Telah mendengar keterangan #0046#, keterangan #3648# selaku pihak yang berhak memberi izin dan saksi-saksi serta memeriksa alat-alat bukti di persidangan;'
    return d


# ---------------------------------------------------------------------------------------------------------------------
# Penetapan TOLAK
# ---------------------------------------------------------------------------------------------------------------------
def tolak_beralasan():
    """[03] Keberatan orang tua/wali beralasan hukum - izin tidak diberikan."""
    d = kabul_hadir_berbeda_pendapat()

    timbang = []
    for jenis, t in d['timbang']:
        timbang.append((jenis, t))
        if t.startswith('Pertimbangan Petitum'):
            break
    timbang = timbang[:-1] + [
        ('h', 'Pertimbangan Petitum'),
        ('b', 'Menimbang, bahwa selanjutnya #8554# akan mempertimbangkan petitum #0053# #0046# sesuai dengan fakta-fakta persidangan yang telah diuraikan di atas sebagai berikut;'),
        ('b', 'Petitum agar #0046# diberi izin untuk melangsungkan perkawinan dengan #3640#'),
        ('b', 'Menimbang, bahwa Pasal 6 ayat (5) Undang-Undang Nomor 1 Tahun 1974 tentang Perkawinan menentukan bahwa Pengadilan dapat memberikan izin (bukan wajib memberikan izin) setelah lebih dahulu mendengar orang-orang yang disebut dalam ayat (2), (3) dan (4), sehingga Pengadilan berwenang menilai '
              'alasan perbedaan pendapat atau ketidakbersediaan memberikan izin dan tidak wajib mengabulkan setiap permintaan izin; Pasal 15 ayat (2) Kompilasi Hukum Islam mengharuskan calon mempelai yang belum mencapai umur 21 tahun mendapat izin sebagaimana diatur dalam Pasal 6 ayat (2), (3), (4) dan (5) Undang-Undang Nomor 1 Tahun 1974;'),
        ('b', 'Menimbang, bahwa berdasarkan fakta hukum, #3648# telah didengar keterangannya di persidangan dan tidak bersedia memberikan izin #3651#; terhadap sikap tersebut #8554# berpendapat bahwa #3656#, sehingga keberatan #3648# mempunyai alasan yang dibenarkan hukum dan izin dari Pengadilan belum patut diberikan;#3658#'),
        ('b', 'Menimbang, bahwa penolakan permohonan ini tidak menutup kemungkinan #0046# melangsungkan perkawinan dengan #3640# di kemudian hari, yaitu apabila #3648# kemudian memberikan izin atau setelah #0046# mencapai umur 21 (dua puluh satu) tahun, dengan tetap memenuhi syarat dan tata cara perkawinan menurut peraturan perundang-undangan yang berlaku;'),
        ('b', 'Menimbang, bahwa berdasarkan seluruh pertimbangan tersebut di atas, #0053# #0046# agar diberi izin untuk melangsungkan perkawinan dengan #3640# tidak beralasan hukum, oleh karena itu harus ditolak;'),
    ] + BIAYA
    d['timbang'] = timbang
    d['amar'] = ['Menolak #0053# #0046#;', '#8505# (#0155# #7095#).']
    return d


def tolak_syarat():
    """[03a] Syarat perkawinan tidak terpenuhi (halangan perkawinan, persetujuan calon mempelai atau calon pasangan belum 19 tahun) - izin tidak diberikan."""
    d = kabul_hadir_berbeda_pendapat()
    timbang = []
    for jenis, t in d['timbang']:
        if t.startswith('Pertimbangan Petitum'):
            break
        timbang.append((jenis, t))
    timbang += [
        ('h', 'Pertimbangan Petitum'),
        ('b', 'Menimbang, bahwa selanjutnya #8554# akan mempertimbangkan petitum #0053# #0046# sesuai dengan fakta-fakta persidangan yang telah diuraikan di atas sebagai berikut;'),
        ('b', 'Petitum agar #0046# diberi izin untuk melangsungkan perkawinan dengan #3640#'),
        ('b', 'Menimbang, bahwa wewenang Pengadilan memberikan izin menurut Pasal 6 ayat (5) Undang-Undang Nomor 1 Tahun 1974 tentang Perkawinan tidak dapat dilepaskan dari terpenuhinya syarat-syarat perkawinan lainnya, yaitu persetujuan kedua calon mempelai (Pasal 6 ayat (1) Undang-Undang Nomor 1 Tahun 1974 jo. Pasal 16 ayat (1) Kompilasi Hukum Islam), '
              'batas umur 19 (sembilan belas) tahun bagi pria dan wanita (Pasal 7 ayat (1) Undang-Undang Nomor 1 Tahun 1974 sebagaimana telah diubah dengan Undang-Undang Nomor 16 Tahun 2019), dan tidak adanya larangan perkawinan (Pasal 8 sampai dengan Pasal 10 Undang-Undang Nomor 1 Tahun 1974 jo. Pasal 39 sampai dengan Pasal 44 Kompilasi Hukum Islam);'),
        ('b', 'Menimbang, bahwa berdasarkan fakta persidangan, #3656#, sehingga syarat perkawinan tersebut tidak terpenuhi dan Pengadilan tidak dapat memberikan izin untuk melangsungkan perkawinan antara #0046# dengan #3640#;#3658#'),
        ('b', 'Menimbang, bahwa berdasarkan seluruh pertimbangan tersebut di atas, #0053# #0046# agar diberi izin untuk melangsungkan perkawinan dengan #3640# tidak beralasan hukum, oleh karena itu harus ditolak;'),
    ] + BIAYA
    d['timbang'] = timbang
    d['amar'] = ['Menolak #0053# #0046#;', '#8505# (#0155# #7095#).']
    return d


# ---------------------------------------------------------------------------------------------------------------------
# Penetapan TIDAK DAPAT DITERIMA (NO)
# ---------------------------------------------------------------------------------------------------------------------
def _no(dengar, duduk, inti, header=HEADER_SEDERHANA):
    timbang = [('b', 'Menimbang, bahwa maksud dan tujuan #0053# #0046# adalah sebagaimana telah diuraikan di atas;')]
    timbang += kewenangan('oleh karena izin tersebut tidak diperoleh dari orang tua, wali atau keluarga dalam garis lurus ke atas;')[:3]
    timbang += inti
    timbang += BIAYA
    return dict(dengar=dengar, duduk=duduk, timbang=timbang,
                amar=['Menyatakan #0053# #0046# tidak dapat diterima (Niet Ontvankelijke Verklaard);', '#8505# (#0155# #7095#).'], header=header)


def no_belum_19():
    return _no('Telah mendengar keterangan #0046# dan saksi-saksi serta memeriksa alat-alat bukti di persidangan;',
               ['Bahwa pada hari sidang yang telah ditetapkan, #4046# telah datang menghadap di persidangan;',
                DIBACAKAN,
                'Bahwa atas pertanyaan #0690#, #0046# memberikan keterangan yang pada pokoknya bahwa #0046# berumur #3643# tahun dan hendak melangsungkan perkawinan dengan #3640# (#3642# #0046#), tetapi orang tua atau walinya tidak memberikan izin;'],
               [('h', 'Pertimbangan Syarat Umur Perkawinan'),
                ('b', 'Menimbang, bahwa Pasal 7 ayat (1) Undang-Undang Nomor 1 Tahun 1974 tentang Perkawinan sebagaimana telah diubah dengan Undang-Undang Nomor 16 Tahun 2019 menentukan bahwa perkawinan hanya diizinkan apabila pria dan wanita sudah mencapai umur 19 (sembilan belas) tahun, dan dalam hal terjadi penyimpangan terhadap ketentuan umur tersebut, '
                      'Pasal 7 ayat (2) menentukan bahwa orang tua pihak pria dan/atau orang tua pihak wanita dapat meminta dispensasi kepada Pengadilan dengan alasan sangat mendesak disertai bukti-bukti pendukung yang cukup; adapun tata cara mengadili permohonan tersebut diatur dalam Peraturan Mahkamah Agung Nomor 5 Tahun 2019 tentang Pedoman Mengadili Permohonan Dispensasi Kawin, '
                      'yang dalam Pasal 1 angka 1 menentukan bahwa Anak adalah seorang yang belum berusia 19 tahun atau belum pernah kawin menurut peraturan perundang-undangan, dan dalam Pasal 1 angka 5 menentukan bahwa Dispensasi Kawin adalah pemberian izin kawin oleh pengadilan kepada calon suami/isteri yang belum berusia 19 tahun untuk melangsungkan perkawinan;'),
                ('b', 'Menimbang, bahwa Pasal 6 ayat (2) dan ayat (5) Undang-Undang Nomor 1 Tahun 1974 tentang Perkawinan mengatur izin kawin bagi calon mempelai yang belum mencapai umur 21 (dua puluh satu) tahun yang telah memenuhi batas umur perkawinan, sehingga izin kawin dari Pengadilan hanya dapat diberikan kepada calon mempelai yang telah berumur 19 (sembilan belas) tahun atau lebih tetapi belum berumur 21 (dua puluh satu) tahun;'),
                ('b', 'Menimbang, bahwa berdasarkan bukti surat dan keterangan #0046#, #0046# berumur #3643# tahun, yaitu belum mencapai umur 19 (sembilan belas) tahun, sehingga yang dibutuhkan #0046# adalah dispensasi kawin yang dimohonkan oleh orang tua sebagaimana Pasal 7 ayat (2) Undang-Undang Nomor 1 Tahun 1974 sebagaimana telah diubah dengan Undang-Undang Nomor 16 Tahun 2019, '
                      'bukan izin kawin yang dimohonkan oleh calon mempelai sendiri; oleh karena itu #0053# #0046# tidak tepat dan harus dinyatakan tidak dapat diterima tanpa mempertimbangkan pokok permohonannya;')])


def no_sudah_21():
    return _no('Telah mendengar keterangan #0046# dan saksi-saksi serta memeriksa alat-alat bukti di persidangan;',
               ['Bahwa pada hari sidang yang telah ditetapkan, #4046# telah datang menghadap di persidangan;',
                DIBACAKAN,
                'Bahwa atas pertanyaan #0690#, #0046# memberikan keterangan yang pada pokoknya bahwa #0046# berumur #3643# tahun dan hendak melangsungkan perkawinan dengan #3640# (#3642# #0046#);'],
               [('h', 'Pertimbangan Syarat Umur'),
                ('b', 'Menimbang, bahwa Pasal 6 ayat (2) Undang-Undang Nomor 1 Tahun 1974 tentang Perkawinan menentukan bahwa untuk melangsungkan perkawinan seorang yang belum mencapai umur 21 (dua puluh satu) tahun harus mendapat izin kedua orang tua, dan Pasal 6 ayat (5) menentukan bahwa Pengadilan dapat memberikan izin '
                      'dalam hal ada perbedaan pendapat atau salah seorang atau lebih di antara orang yang wajib memberikan izin tidak menyatakan pendapatnya; ketentuan tersebut dipertegas oleh Pasal 15 ayat (2) Kompilasi Hukum Islam yang menyebut calon mempelai yang belum mencapai umur 21 tahun;'),
                ('b', 'Menimbang, bahwa berdasarkan bukti surat berupa kutipan akta kelahiran dan keterangan #0046#, #0046# berumur #3643# tahun, yaitu telah mencapai umur 21 (dua puluh satu) tahun atau lebih, sehingga #0046# tidak lagi memerlukan izin sebagaimana Pasal 6 ayat (2) Undang-Undang Nomor 1 Tahun 1974 dan tidak ada dasar hukum bagi Pengadilan untuk memberikan izin yang tidak diwajibkan oleh undang-undang; '
                      'dengan demikian #0046# tidak mempunyai kepentingan hukum untuk mengajukan #0053# a quo, terlepas dari syarat-syarat perkawinan lain yang diatur tersendiri;'),
                ('b', 'Menimbang, bahwa oleh karena #0046# tidak mempunyai kepentingan hukum, maka #0053# #0046# harus dinyatakan tidak dapat diterima (Niet Ontvankelijke Verklaard) tanpa mempertimbangkan pokok permohonannya;')])


def no_izin_diberikan():
    return _no('Telah mendengar keterangan #0046#, keterangan #3648# dan saksi-saksi serta memeriksa alat-alat bukti di persidangan;',
               ['Bahwa pada hari sidang yang telah ditetapkan, #4046# telah datang menghadap di persidangan, demikian pula #3648# yang telah dipanggil dengan patut telah datang menghadap di persidangan;',
                DIBACAKAN,
                'Bahwa #3648# telah didengar keterangannya di persidangan yang pada pokoknya sebagai berikut: #3650#;'],
               [('h', 'Pertimbangan Pokok Permohonan'),
                ('b', 'Menimbang, bahwa Pasal 6 ayat (5) Undang-Undang Nomor 1 Tahun 1974 tentang Perkawinan memberi wewenang kepada Pengadilan untuk memberikan izin hanya dalam hal ada perbedaan pendapat antara orang-orang yang disebut dalam ayat (2), (3) dan (4) pasal tersebut, atau salah seorang atau lebih di antara mereka tidak menyatakan pendapatnya, '
                      'setelah lebih dahulu mendengar orang-orang tersebut;'),
                ('b', 'Menimbang, bahwa Pasal 6 ayat (2) huruf c Peraturan Pemerintah Nomor 9 Tahun 1975 tentang Pelaksanaan Undang-Undang Nomor 1 Tahun 1974 menentukan bahwa Pegawai Pencatat meneliti izin tertulis atau izin Pengadilan sebagaimana dimaksud dalam Pasal 6 ayat (2), (3), (4) dan (5) Undang-Undang apabila salah seorang calon mempelai atau keduanya belum mencapai umur 21 (dua puluh satu) tahun, '
                      'sehingga izin dapat diberikan langsung secara tertulis oleh orang yang berhak apabila tidak ada perbedaan pendapat;'),
                ('b', 'Menimbang, bahwa berdasarkan keterangan #3648# di persidangan sebagaimana diuraikan dalam duduk perkara, #3648# tidak berbeda pendapat dan tidak keberatan terhadap rencana perkawinan #0046# dengan #3640# serta bersedia memberikan izin, sehingga tidak terdapat perbedaan pendapat maupun keadaan tidak menyatakan pendapat sebagaimana dimaksud Pasal 6 ayat (5) Undang-Undang Nomor 1 Tahun 1974; '
                      'oleh karena itu tidak ada sengketa yang harus diputus oleh Pengadilan dan #0046# tidak mempunyai kepentingan hukum untuk memperoleh izin dari Pengadilan;'),
                ('b', 'Menimbang, bahwa oleh karena itu #0053# #0046# harus dinyatakan tidak dapat diterima (Niet Ontvankelijke Verklaard) tanpa mempertimbangkan pokok permohonannya, dan #0046# dapat memperoleh izin tertulis dari #3648# untuk diajukan kepada Pegawai Pencatat Nikah;')])


# ---------------------------------------------------------------------------------------------------------------------
# DAFTAR BLANGKO PUTUSAN DAN METADATA
# ---------------------------------------------------------------------------------------------------------------------
S_ = J['singkat']
BLANGKO = [
    # (berkas, fungsi, keadaan, catatan)
    ('[01] [Kabul] %s - Orang Tua atau Wali Hadir dan Berbeda Pendapat.rtf' % S_, kabul_hadir_berbeda_pendapat, '',
     'Pasal 6 ayat (5) UU 1/1974: orang tua/wali hadir, didengar, tidak memberi izin. Isi 3649 (keadaan orang tua), 3644-3645 (orang yang didengar), 3650, 3651, 3656.'),
    ('[01a] [Kabul] %s - Orang Tua atau Wali Dipanggil Patut Tidak Hadir atau Tidak Menyatakan Pendapat.rtf' % S_, kabul_tidak_hadir, 'orang-tua-tidak-hadir',
     'Orang tua/wali dipanggil patut tetapi tidak hadir sehingga tidak menyatakan pendapat (Pasal 6 ayat (5)). Pastikan relaas panggilan sah dan patut.'),
    ('[01b] [Kabul] %s - Salah Seorang Orang Tua Meninggal atau Tidak Mampu Menyatakan Kehendak.rtf' % S_, kabul_satu_orang_tua, 'salah-satu-orang-tua',
     'Pasal 6 ayat (3): izin cukup dari orang tua yang masih hidup/mampu; orang tua tersebut hadir tetapi tidak memberi izin.'),
    ('[01c] [Kabul] %s - Kedua Orang Tua Meninggal atau Tidak Mampu, Wali atau Keluarga Garis Lurus Berbeda Pendapat.rtf' % S_, kabul_wali_keluarga, 'wali-keluarga',
     'Pasal 6 ayat (4): izin dari wali, orang yang memelihara atau keluarga garis lurus ke atas yang masih hidup dan dapat menyatakan kehendak.'),
    ('[03] [Tolak] %s - Keberatan Orang Tua atau Wali Beralasan Hukum.rtf' % S_, tolak_beralasan, '',
     'Majelis menilai keberatan orang tua/wali beralasan (isi 3656); izin tidak diberikan.'),
    ('[03a] [Tolak] %s - Syarat Perkawinan Tidak Terpenuhi.rtf' % S_, tolak_syarat, 'syarat-tidak-terpenuhi',
     'Izin tidak diberikan karena syarat perkawinan lain tidak terpenuhi (halangan perkawinan, persetujuan calon, atau calon pasangan belum 19 tahun); uraikan di 3656.'),
    ('[99a] [NO] %s - Pemohon Belum Berumur 19 Tahun (Bukan Izin Kawin tetapi Dispensasi Kawin).rtf' % S_, no_belum_19, 'umur-kurang-19',
     'Pemohon belum 19 tahun: yang tepat dispensasi kawin yang dimohonkan orang tua (Pasal 7 ayat (2) UU 1/1974 jo. UU 16/2019, PERMA 5/2019).'),
    ('[99b] [NO] %s - Pemohon Sudah Berumur 21 Tahun (Tidak Perlu Izin).rtf' % S_, no_sudah_21, 'umur-21-lebih',
     'Pemohon sudah 21 tahun atau lebih: izin Pasal 6 ayat (2) tidak diperlukan.'),
    ('[99c] [NO] %s - Orang Tua atau Wali Telah Memberi Izin (Tidak Ada Perbedaan Pendapat).rtf' % S_, no_izin_diberikan, 'izin-diberikan',
     'Orang tua/wali yang hadir ternyata memberi izin: tidak ada perbedaan pendapat, tidak ada sengketa untuk diputus.'),
]

NASIHAT_BAS = ('#0690# menjelaskan kepada #7036# tentang ketentuan izin kawin bagi calon mempelai yang belum berumur 21 (dua puluh satu) tahun, yaitu bahwa izin diperoleh dari orang tua, wali atau keluarga dalam garis keturunan lurus ke atas, '
               'dan bahwa Pengadilan baru dapat memberikan izin apabila terdapat perbedaan pendapat atau mereka tidak menyatakan pendapatnya, setelah Pengadilan mendengar mereka, dan atas penjelasan tersebut #7036# menyatakan tetap pada #0053#nya;')
HEADER_BAS = '#3640# #3641# #3644# #3645# #3646# #3647# #3649# #3650# #3651# #3654#'
# BAS yang memuat acara pendengaran orang yang didengar (sidang pertama/lanjutan dengan pembuktian)
BAS_DENGAR = {
    '[1]': r'^Selanjutnya atas pertanyaan .* menyatakan telah siap mengajukan alat bukti',
    '[1a]': r'^Selanjutnya atas pertanyaan .* menyatakan telah siap mengajukan alat bukti',
    '[1b]': r'^Selanjutnya atas pertanyaan .* menyatakan pada hari ini baru siap mengajukan alat bukti',
    '[2a]': r'^Selanjutnya atas pertanyaan .* menyatakan telah siap mengajukan alat bukti',
    '[2]': r'^Atas pertanyaan .* mengajukan 2 \(dua\) orang saksi',
    '[2b]': r'^Atas pertanyaan .* mengajukan 2 \(dua\) orang saksi',
}
BAS_SEMUA_HEADER = ('[1]', '[1a]', '[1b]', '[1c]', '[2]', '[2a]', '[2b]', '[3]')


def _bas_langkah(nama):
    m = re.search(r' - (\[[0-9a-zA-Z]+\]) ', nama)
    return m.group(1) if m else ''


def bangun_bas():
    paths = L.buat_bas_permohonan(J, None, '3654')
    # nasihat: seluruh paragraf diganti (kalimat dasar menyebut perwalian)
    hasil = []
    for p in paths:
        nama = os.path.basename(p)
        raw = open(L.lp(p), 'rb').read().decode('latin1')
        langkah = _bas_langkah(nama)
        raw = L.ganti_paragraf(raw, r'^#0690# menjelaskan kepada #7036# tentang hal-hal', NASIHAT_BAS, wajib=False)
        if langkah in BAS_SEMUA_HEADER:
            head = HEADER_BAS + (' #9134#' if langkah in ('[1c]', '[2a]') else '')
            raw = S.tambah_header_bas(raw, head)
        if langkah in BAS_DENGAR:
            raw = S.sisip_sebelum(raw, BAS_DENGAR[langkah], '#3659#;', klon_dari=r'^Lalu dibacakan surat|^Selanjutnya #4004# menyatakan bahwa acara sidang')
        hasil.append(L.simpan_bas(J, nama, raw))
    return hasil


def bangun():
    """Menulis semua RTF jenis izin kawin. Mengembalikan daftar jalur."""
    hasil = []
    for berkas, fungsi, _keadaan, _cat in BLANGKO:
        spek = fungsi()
        raw = S.penetapan(spek.get('header', HEADER), spek['dengar'], spek['duduk'], '#3654#', spek['timbang'], spek['amar'])
        hasil.append(L.simpan_putusan(J, berkas, raw))
    hasil += L.buat_umum_permohonan(J)
    hasil += bangun_bas()
    return hasil


PETA = [L.meta(J, b, k, c) for b, _f, k, c in BLANGKO] + L.meta_umum_permohonan(J)


# ---------------------------------------------------------------------------------------------------------------------
# KATALOG SAKSI  ekstensi-sipp/saksi-katalog/izin-kawin.json  (skema saksi-katalog/1)
# ---------------------------------------------------------------------------------------------------------------------
def katalog():
    import w3aB_katalog as K
    N = 'naskah lokal uu1-1974-bpk.txt (BPK), dicocokkan 21 Okt 2026'
    dasar = [
        K.dh('dh-pasal-49a-ik', 'Penjelasan Pasal 49 huruf a angka 2 UU 7/1989 jo UU 3/2006 jo UU 50/2009',
             'izin melangsungkan perkawinan bagi orang yang belum berusia 21 tahun dalam hal orang tua, wali, atau keluarga dalam garis lurus ada perbedaan pendapat termasuk kewenangan Pengadilan Agama',
             'naskah lokal ekstra/uu3-2006.txt (Penjelasan Pasal 49 huruf a angka 2), dicocokkan 21 Okt 2026'),
        K.dh('dh-uu1-6-1', 'Pasal 6 ayat (1) UU 1/1974', 'perkawinan harus didasarkan atas persetujuan kedua calon mempelai', N),
        K.dh('dh-uu1-6-izin', 'Pasal 6 ayat (2), (3) dan (4) UU 1/1974',
             'calon mempelai yang belum berumur 21 tahun harus mendapat izin kedua orang tua; bila salah seorang meninggal atau tidak mampu menyatakan kehendak cukup dari yang lain; bila keduanya meninggal atau tidak mampu, izin dari wali, orang yang memelihara atau keluarga garis lurus ke atas', N),
        K.dh('dh-uu1-6-5', 'Pasal 6 ayat (5) UU 1/1974',
             'bila ada perbedaan pendapat atau salah seorang atau lebih tidak menyatakan pendapatnya, Pengadilan di tempat tinggal calon mempelai dapat memberikan izin setelah lebih dahulu mendengar orang-orang tersebut', N),
        K.dh('dh-uu16-7-1', 'Pasal 7 ayat (1) UU 1/1974 sebagaimana diubah UU 16/2019', 'perkawinan hanya diizinkan apabila pria dan wanita sudah mencapai umur 19 tahun',
             'naskah lokal uu16-2019/uu16-2019-bpk.txt (Pasal 7 ayat (1)), dicocokkan 21 Okt 2026'),
        K.dh('dh-uu1-8', 'Pasal 8 UU 1/1974', 'larangan perkawinan antara dua orang yang berhubungan darah, semenda atau sesusuan', N),
        K.dh('dh-khi-15-2', 'Pasal 15 ayat (2) KHI', 'calon mempelai yang belum mencapai umur 21 tahun harus mendapat izin sebagaimana diatur Pasal 6 ayat (2), (3), (4) dan (5) UU 1/1974', 'KHI-pasal-terverifikasi.md (Pasal 15), dicocokkan 21 Okt 2026'),
        K.dh('dh-khi-16', 'Pasal 16 ayat (1) KHI', 'perkawinan didasarkan atas persetujuan calon mempelai', 'KHI-pasal-terverifikasi.md (Pasal 16), dicocokkan 21 Okt 2026'),
        K.dh('dh-khi-39-44', 'Pasal 39 sampai dengan Pasal 44 KHI', 'larangan kawin karena pertalian nasab, semenda, sesusuan, dan keadaan tertentu', 'KHI-pasal-terverifikasi.md (Pasal 39-44), dicocokkan 21 Okt 2026'),
        K.dh('dh-khi-153-ik', 'Pasal 153 KHI', 'janda wajib menunggu berakhirnya masa tunggu (iddah) sebelum menikah lagi', 'KHI-pasal-terverifikasi.md (Pasal 153), dicocokkan 21 Okt 2026'),
        K.dh('dh-rbg-saksi-formil', 'Pasal 172 ayat (1) dan Pasal 175 RBg', 'syarat formil saksi: bukan orang yang dilarang didengar dan disumpah menurut agamanya',
             'Pasal 172 ayat (1) dan Pasal 175 RBg, dicocokkan dengan naskah 18 Okt 2026 (VERIFIKASI-HIR-RBG.md); dipakai pula blangko Derry 7 Wali Adhal [01a]'),
        K.dh('dh-rbg-saksi-materiil', 'Pasal 308 dan Pasal 309 RBg', 'syarat materiil saksi: keterangan berdasar pengetahuan sendiri dan saling bersesuaian',
             'Pasal 308, 309 RBg, dicocokkan dengan naskah 18 Okt 2026 (VERIFIKASI-HIR-RBG.md); dipakai pula blangko Derry 7 Wali Adhal [01a]'),
    ]
    keadaan = {
        'keadaanOrangTua': dict(sumber='borang', nilai=['kedua-hidup', 'satu-meninggal', 'satu-tidak-mampu', 'kedua-meninggal', 'kedua-tidak-mampu'], bawaan='kedua-hidup', label='Keadaan orang tua Pemohon'),
        'orangDidengar': dict(sumber='borang', nilai=['hadir', 'tidak-hadir'], bawaan='hadir', label='Orang tua atau wali yang didengar hadir di persidangan'),
        'statusPemohon': dict(sumber='borang', nilai=['belum-menikah', 'janda', 'duda'], bawaan='belum-menikah', label='Status Pemohon sebelum menikah'),
    }
    pokok = [
        dict(id='pp-saksi-formil', judul='Syarat formil saksi', uraian='saksi mengenal Pemohon, menyebut hubungannya, dan tidak berkepentingan', dasarHukum=['dh-rbg-saksi-formil'], wajib=True),
        dict(id='pp-maksud-permohonan', judul='Maksud permohonan izin kawin', uraian='Pemohon hendak menikah dengan calon pasangan tetapi izin orang tua atau wali belum diperoleh', dasarHukum=['dh-pasal-49a-ik', 'dh-uu1-6-5'], wajib=True),
        dict(id='pp-umur-pemohon', judul='Umur Pemohon', uraian='Pemohon belum berumur 21 tahun tetapi sudah memenuhi batas umur perkawinan 19 tahun', dasarHukum=['dh-uu1-6-izin', 'dh-uu16-7-1'], wajib=True),
        dict(id='pp-calon-pasangan', judul='Calon pasangan Pemohon', uraian='identitas, umur dan hubungan Pemohon dengan calon suami atau calon istri', dasarHukum=['dh-uu1-6-1', 'dh-uu16-7-1'], wajib=True),
        dict(id='pp-persetujuan-calon', judul='Persetujuan kedua calon mempelai', uraian='kedua calon mempelai berkehendak menikah atas kemauan sendiri tanpa paksaan', dasarHukum=['dh-uu1-6-1', 'dh-khi-16'], wajib=True),
        dict(id='pp-halangan-kawin', judul='Tidak ada halangan perkawinan', uraian='tidak ada hubungan darah, semenda, sesusuan dan keduanya seagama serta tidak terikat perkawinan lain', dasarHukum=['dh-uu1-8', 'dh-khi-39-44'], wajib=True),
        dict(id='pp-keadaan-orang-tua', judul='Keadaan orang tua dan pihak pemberi izin', uraian='orang tua masih hidup atau tidak, mampu menyatakan kehendak atau tidak, dan siapa yang berhak memberi izin', dasarHukum=['dh-uu1-6-izin', 'dh-khi-15-2'], wajib=True),
        dict(id='pp-perbedaan-pendapat', judul='Perbedaan pendapat atau tidak menyatakan pendapat', uraian='orang yang wajib memberi izin tidak memberi izin, berbeda pendapat atau tidak menyatakan pendapatnya', dasarHukum=['dh-uu1-6-5', 'dh-pasal-49a-ik'], wajib=True),
        dict(id='pp-upaya', judul='Upaya meminta izin dan menengahi', uraian='upaya Pemohon dan keluarga meminta izin dan menengahi perbedaan pendapat', dasarHukum=['dh-uu1-6-5'], wajib=False),
        dict(id='pp-kesiapan', judul='Kesiapan membina rumah tangga', uraian='kesiapan pendidikan, pekerjaan dan kemampuan Pemohon dan calon pasangan', dasarHukum=['dh-khi-15-2'], wajib=False),
        dict(id='pp-iddah', judul='Masa tunggu Pemohon yang berstatus janda', uraian='masa tunggu (iddah) Pemohon yang berstatus janda sudah berakhir', dasarHukum=['dh-khi-153-ik'], wajib=False),
        dict(id='pp-penutup', judul='Penutup', uraian='saksi menyatakan keterangannya telah cukup', dasarHukum=['dh-rbg-saksi-materiil'], wajib=False),
    ]
    b = K.B
    butir = []
    butir.append(K.dari_wali_adhal('q-kenal-pemohon', pokok='pp-saksi-formil'))
    butir.append(K.butir_sederhana(
        'q-hubungan-kepentingan', 'pp-saksi-formil', 20, 'inti', 'hubungan',
        'Apakah saksi mempunyai kepentingan atau hubungan lain dengan #0046#, calon pasangannya maupun orang tuanya yang dapat memengaruhi keterangan saksi ?',
        'saksi tidak punya kepentingan yang memengaruhi keterangannya',
        ['saya tidak mempunyai kepentingan apa pun atas permohonan #0046# ini selain menjadi saksi', 'saya datang hanya sebagai saksi dan tidak punya kepentingan pribadi terhadap #0046# maupun calon pasangannya',
         'saya tidak mempunyai hubungan kepentingan dengan siapa pun dalam perkara #0046# ini selain sebagai saksi', 'tidak ada kepentingan lain pada saya dalam perkara #0046# ini selain memberikan keterangan'],
        ['keterangan ini saya berikan tanpa kepentingan pribadi terhadap #0046# ataupun keluarganya', 'tak ada kepentingan lain antara saya dan #0046# selain keterangan yang saya berikan hari ini',
         'saya tidak berkepentingan apa pun atas hasil perkara #0046# ini', 'tiada kepentingan saya dalam perkara #0046# ini selain sebagai saksi'],
        teks_varian=['Apakah saksi punya kepentingan lain atas permohonan #0046# ini ?']))
    butir.append(b('q-maksud-izin', 'pp-maksud-permohonan', 30, 'inti', 'pokok', 'Apakah saksi mengetahui maksud #0046# mengajukan permohonan izin kawin ini ?', 'maksud Pemohon mengajukan permohonan izin kawin',
                   '#0046# hendak menikah dengan #3640# tetapi izin dari #3648# belum diperoleh sehingga #0046# memohon izin dari Pengadilan',
                   'maksud #0046# adalah memperoleh izin dari Pengadilan agar dapat menikah dengan #3640# karena izin dari #3648# tidak diberikan',
                   '#0046# hendak menikah dengan #3640#', 'rencana #0046# menikah dengan #3640# memang ada',
                   teks_varian=['Apa yang diinginkan #0046# sehingga datang ke Pengadilan untuk memohon izin kawin ?']).json())
    butir.append(b('q-umur-pemohon', 'pp-umur-pemohon', 40, 'inti', 'pokok', 'Berapa umur #0046# sekarang, dan apakah saksi mengetahui #0046# belum berumur dua puluh satu tahun ?', 'umur Pemohon',
                   '#0046# berumur #3643# tahun sehingga belum mencapai umur dua puluh satu tahun', 'umur #0046# sekarang adalah #3643# tahun dan belum sampai dua puluh satu tahun',
                   '#0046# berumur #3643# tahun', 'umur #0046# sekarang #3643# tahun',
                   teks_varian=['Apakah saksi mengetahui umur #0046# dan sejak kapan #0046# lahir ?']).json())
    butir.append(b('q-kenal-calon', 'pp-calon-pasangan', 50, 'inti', 'pokok', 'Apakah saksi kenal dengan #3640# yang akan menikah dengan #0046#, dan berapa umurnya ?', 'calon pasangan Pemohon',
                   'saya kenal #3640# yang berumur #3641# tahun, yaitu #3642# #0046#', '#3640# yang berumur #3641# tahun adalah #3642# #0046# yang saya kenal dengan baik',
                   '#3640# adalah #3642# #0046#', 'saya kenal #3640# sebagai #3642# #0046#').json())
    butir.append(b('q-hubungan-calon', 'pp-calon-pasangan', 60, 'pilihan', 'pokok', 'Sejak kapan #0046# dan #3640# saling mengenal dan bagaimana hubungan keduanya ?', 'lama perkenalan dan hubungan keduanya',
                   '#0046# dan #3640# sudah lama saling mengenal dan hubungan keduanya baik serta saling menghormati', 'hubungan #0046# dengan #3640# sudah terjalin cukup lama dan keduanya saling menghargai',
                   '#0046# dan #3640# saling mengenal', 'saya tahu #0046# dan #3640# sudah saling kenal').json())
    butir.append(b('q-persetujuan-sendiri', 'pp-persetujuan-calon', 70, 'inti', 'pokok', 'Apakah #0046# dan #3640# sama-sama menghendaki pernikahan ini atas kemauan sendiri tanpa paksaan dari siapa pun ?',
                   'kehendak Pemohon dan calon pasangan untuk menikah',
                   '#0046# dan #3640# sama-sama berkehendak menikah atas kemauan sendiri tanpa paksaan dari siapa pun', 'pernikahan #0046# dengan #3640# dikehendaki keduanya sendiri tanpa tekanan dari pihak mana pun',
                   '#0046# dan #3640# berkehendak menikah', 'kehendak #0046# dan #3640# untuk menikah memang ada',
                   mendengar=('#0046# dan #3640# sama-sama ingin menikah atas kemauan sendiri tanpa paksaan', 'pernikahan #0046# dengan #3640# bukan karena dipaksa tetapi karena kemauan sendiri')).json())
    butir.append(b('q-halangan-kawin', 'pp-halangan-kawin', 80, 'inti', 'pokok', 'Apakah #0046# dan #3640# mempunyai hubungan darah, hubungan semenda atau hubungan sesusuan ?', 'ada tidaknya hubungan darah, semenda atau sesusuan antara Pemohon dan calon pasangan',
                   'antara #0046# dan #3640# tidak ada hubungan darah, semenda maupun sesusuan', '#0046# dan #3640# tidak memiliki hubungan nasab, semenda ataupun sesusuan',
                   'antara #0046# dan #3640# tidak ada hubungan darah', '#0046# dan #3640# tidak sedarah',
                   mendengar=('antara #0046# dan #3640# tidak ada hubungan darah, semenda maupun sesusuan', 'tidak ada ikatan nasab, semenda atau sesusuan antara #0046# dan #3640#')).json())
    butir.append(b('q-agama-status', 'pp-halangan-kawin', 90, 'inti', 'pokok', 'Apa agama #0046# dan #3640#, dan apakah salah satunya masih terikat perkawinan dengan orang lain ?', 'agama dan status perkawinan Pemohon dan calon pasangan',
                   '#0046# dan #3640# sama-sama beragama Islam dan tidak ada yang masih terikat perkawinan dengan orang lain', 'agama #0046# dan #3640# adalah Islam dan tidak seorang pun dari keduanya sedang terikat perkawinan lain',
                   '#0046# dan #3640# beragama Islam', 'agama #0046# dan #3640# adalah Islam').json())
    butir.append(b('q-status-pemohon', 'pp-halangan-kawin', 100, 'pilihan', 'pokok', 'Apa status #0046# sebelum menikah ?', 'status Pemohon sebelum menikah',
                   '#0046# berstatus #1002# sebelum rencana pernikahan ini', 'sebelum menikah #0046# berstatus #1002#', '#0046# berstatus #1002#', 'status #0046# adalah #1002#').json())
    butir.append(b('q-iddah-janda', 'pp-iddah', 110, 'tambahan', 'pokok', 'Apakah masa tunggu (iddah) #0046# sudah berakhir ?', 'masa tunggu Pemohon',
                   'masa tunggu atau iddah #0046# sudah berakhir sebelum rencana pernikahan dengan #3640#', 'iddah #0046# telah selesai sebelum #0046# berencana menikah dengan #3640#',
                   'iddah #0046# sudah berakhir', 'masa iddah #0046# telah lewat', keadaan={'statusPemohon': 'janda'}).json())
    butir.append(b('q-keadaan-orang-tua', 'pp-keadaan-orang-tua', 120, 'inti', 'pokok', 'Bagaimana keadaan kedua orang tua #0046#, apakah masih hidup dan mampu menyatakan kehendaknya ?', 'keadaan orang tua Pemohon',
                   '#3655#', 'keadaan orang tua #0046# yaitu #3655#', 'sebagian keadaan orang tua #0046# adalah #3655#', 'yang saya tahu tentang orang tua #0046# adalah #3655#').json())
    butir.append(b('q-orang-tua-meninggal', 'pp-keadaan-orang-tua', 130, 'pilihan', 'pokok', 'Siapa di antara orang tua #0046# yang sudah meninggal dunia dan siapa yang masih hidup ?', 'orang tua yang meninggal dan yang masih hidup',
                   'salah seorang orang tua #0046# sudah meninggal dunia sedangkan yang masih hidup adalah #3648#', 'orang tua #0046# yang masih hidup adalah #3648# karena yang seorang lagi sudah meninggal dunia',
                   'salah seorang orang tua #0046# sudah meninggal dunia', 'seorang dari orang tua #0046# telah wafat', keadaan={'keadaanOrangTua': 'satu-meninggal'}).json())
    butir.append(b('q-orang-tua-tidak-mampu', 'pp-keadaan-orang-tua', 140, 'pilihan', 'pokok', 'Apa yang menyebabkan orang tua #0046# tidak mampu menyatakan kehendaknya ?', 'sebab orang tua tidak mampu menyatakan kehendak',
                   'orang tua #0046# tidak mampu menyatakan kehendaknya karena keadaan kesehatan', 'karena sakit yang dideritanya orang tua #0046# tidak dapat menyatakan kehendak',
                   'orang tua #0046# tidak mampu menyatakan kehendak', 'orang tua #0046# tidak dapat menyatakan kehendak', keadaan={'keadaanOrangTua': ['satu-tidak-mampu', 'kedua-tidak-mampu']}).json())
    butir.append(b('q-wali-keluarga', 'pp-keadaan-orang-tua', 150, 'inti', 'pokok', 'Siapa yang memelihara #0046# dan keluarga garis lurus ke atas mana yang masih hidup serta dapat menyatakan kehendaknya ?', 'pihak pemelihara atau keluarga garis lurus yang memberi izin',
                   'yang memelihara #0046# dan dapat memberikan izin adalah #3648# yang masih hidup dan dapat menyatakan kehendak', '#3648# adalah pihak yang memelihara #0046# dan masih hidup serta dapat menyatakan kehendak',
                   '#3648# yang memelihara #0046#', 'pemelihara #0046# adalah #3648#', keadaan={'keadaanOrangTua': ['kedua-meninggal', 'kedua-tidak-mampu']}).json())
    butir.append(b('q-meminta-izin', 'pp-perbedaan-pendapat', 160, 'inti', 'upaya', 'Apakah #0046# sudah meminta izin kepada #3648# untuk menikah dengan #3640#, dan bagaimana jawabannya ?', 'permintaan izin kepada orang tua atau wali dan jawabannya',
                   '#0046# sudah meminta izin kepada #3648# untuk menikah dengan #3640# tetapi izin itu tidak diberikan', 'permintaan izin #0046# kepada #3648# untuk menikah dengan #3640# dijawab dengan tidak memberikan izin',
                   '#0046# sudah meminta izin kepada #3648#', 'izin dari #3648# sudah dimintakan oleh #0046#',
                   mendengar=('#3648# tidak mau memberikan izin kepada #0046# untuk menikah dengan #3640#', '#3648# menyatakan tidak memberikan izin untuk pernikahan #0046# dengan #3640#'),
                   beda=('peristiwa', 'versi A: izin sudah dimintakan dan ditolak; versi B: izin belum pernah dimintakan - berselisih pada PERISTIWA',
                         ['saya melihat sendiri bahwa #0046# sudah meminta izin kepada #3648#', 'saya menyaksikan #0046# meminta izin kepada #3648# untuk menikah', 'menurut yang saya saksikan #0046# telah meminta izin kepada #3648#', '#0046# sudah meminta izin kepada #3648# dan saya mengetahuinya langsung'],
                         ['saya melihat sendiri bahwa #0046# belum pernah meminta izin kepada #3648#', 'saya menyaksikan #0046# belum meminta izin kepada #3648# untuk menikah', 'menurut yang saya saksikan #0046# belum meminta izin kepada #3648#', '#0046# belum meminta izin kepada #3648# dan saya mengetahuinya langsung'])).json())
    butir.append(b('q-alasan-tidak-izin', 'pp-perbedaan-pendapat', 170, 'inti', 'pokok', 'Apa alasan #3648# tidak memberikan izin kepada #0046# ?', 'alasan orang tua atau wali tidak memberikan izin',
                   '#3648# tidak memberikan izin kepada #0046# #3651#', 'sikap #3648# yang tidak memberikan izin kepada #0046# itu #3651#',
                   '#3648# tidak memberikan izin #3651#', 'izin dari #3648# tidak diberikan #3651#').json())
    butir.append(b('q-sikap-disampaikan', 'pp-perbedaan-pendapat', 180, 'pilihan', 'upaya', 'Apakah #3648# sudah menyampaikan sikapnya secara langsung kepada #0046# dan keluarga ?', 'penyampaian sikap orang tua atau wali kepada Pemohon',
                   '#3648# sudah menyampaikan sikapnya langsung kepada #0046# dan keluarga yaitu tetap tidak memberikan izin', 'kepada #0046# dan keluarga #3648# menyampaikan sendiri sikapnya yang tetap tidak memberikan izin',
                   '#3648# sudah menyampaikan sikapnya kepada #0046#', 'sikap #3648# sudah disampaikan kepada #0046#', keadaan={'orangDidengar': 'hadir'}).json())
    butir.append(b('q-tidak-hadir', 'pp-perbedaan-pendapat', 190, 'tambahan', 'upaya', 'Apakah saksi mengetahui #3648# sudah dipanggil Pengadilan, dan mengapa tidak datang ?', 'pemanggilan orang tua atau wali dan ketidakhadirannya',
                   '#3648# mengetahui adanya panggilan dari Pengadilan tetapi tidak datang menghadap', 'meskipun sudah ada panggilan dari Pengadilan, #3648# tidak datang menghadap',
                   '#3648# mengetahui adanya panggilan dari Pengadilan', 'panggilan Pengadilan sudah sampai kepada #3648#', keadaan={'orangDidengar': 'tidak-hadir'}).json())
    butir.append(b('q-upaya-keluarga', 'pp-upaya', 200, 'pilihan', 'upaya', 'Apakah keluarga atau orang lain sudah berupaya menengahi supaya #3648# bersedia memberikan izin ?', 'upaya keluarga menengahi perbedaan pendapat',
                   'keluarga sudah berupaya membujuk #3648# agar bersedia memberikan izin kepada #0046# tetapi tetap belum berhasil', 'sudah ada upaya dari keluarga menengahi #3648# dan #0046# namun izin masih belum diberikan',
                   'keluarga sudah berupaya membujuk #3648#', 'upaya keluarga menengahi #3648# sudah dilakukan').json())
    butir.append(b('q-kesiapan', 'pp-kesiapan', 210, 'pilihan', 'akibat', 'Bagaimana kesiapan #0046# dan #3640# membina rumah tangga, baik pendidikan, pekerjaan maupun kemampuan menafkahi ?', 'kesiapan membina rumah tangga',
                   '#0046# dan #3640# sudah siap lahir dan batin membina rumah tangga dan #3640# mampu menafkahi', '#0046# dan #3640# telah siap berumah tangga dan #3640# mampu mencukupi nafkah keluarga',
                   '#0046# dan #3640# sudah siap berumah tangga', 'kesiapan #0046# dan #3640# berumah tangga sudah ada').json())
    butir.append(b('q-tempat-tinggal', 'pp-kesiapan', 220, 'pilihan', 'akibat', 'Di mana #0046# dan #3640# akan tinggal setelah menikah ?', 'rencana tempat tinggal setelah menikah',
                   'setelah menikah #0046# dan #3640# akan tinggal bersama keluarga sampai mampu mandiri', 'rencananya #0046# dan #3640# menetap di rumah keluarga hingga dapat hidup mandiri',
                   'setelah menikah #0046# dan #3640# akan tinggal bersama keluarga', 'rencana tempat tinggal #0046# dan #3640# di rumah keluarga').json())
    butir.append(K.dari_wali_adhal('q-penutup', pokok='pp-penutup'))
    bas = ['[1] Sidang 1 - Pemeriksaan, Bukti Surat dan 2 Saksi, Penetapan Dibacakan (1x Sidang)', '[1a] Sidang 1 - Pemeriksaan, Bukti Surat dan 2 Saksi, Tunda Pembacaan Penetapan',
           '[2] Sidang Lanjutan - Pemeriksaan 2 Saksi, Tunda Pembacaan Penetapan', '[2a] Sidang Lanjutan - Perbaikan Permohonan, Bukti Surat dan 2 Saksi, Tunda Pembacaan Penetapan',
           '[2b] Sidang Lanjutan - Pemeriksaan 2 Saksi, Penetapan Dibacakan']
    catatan = [
        'Isi nama dan umur calon pasangan, nama dan hubungan orang tua atau wali yang didengar, keadaan orang tua (angka 1 sampai 5) dan alasan tidak memberi izin pada isian blangko sebelum menyusun; isian kosong tampil sebagai titik-titik.',
        'Izin kawin hanya bagi Pemohon yang berumur 19 tahun atau lebih tetapi belum 21 tahun; bila Pemohon belum 19 tahun yang diperlukan dispensasi kawin yang dimohonkan orang tua (PERMA 5/2019), bila sudah 21 tahun izin tidak diperlukan.',
        'Pengadilan wajib lebih dahulu mendengar orang tua, wali atau keluarga yang dimaksud (Pasal 6 ayat (5) UU 1/1974); catat sikap mereka di berita acara, atau relaas panggilan bila mereka tidak hadir.',
        'Alasan keberatan yang hanya diketahui saksi dari cerita Pemohon bukan bukti atas alasan itu; usahakan saksi yang hadir saat orang tua atau wali menyatakan sikapnya.']
    return K.rakit('izin-kawin', 'Izin kawin', 361, J['folder_bas'], J['awalan_bas'], [(x, '') for x in bas], dasar, keadaan, pokok, butir, catatan,
                   ['3640', '3641', '3642', '3643', '3648', '3651', '3655'])


def tulis_katalog():
    import w3aB_katalog as K
    return K.tulis(katalog())


if __name__ == '__main__':
    daftar = bangun()
    tulis_katalog()
    print('izin-kawin: %d berkas RTF (%d putusan/penetapan, %d BAS); variabel baru %d' % (
        len(daftar), len(PETA), len(daftar) - len(PETA), len([x for x in __import__('variabel_def').VAR if 3640 <= x['no'] <= 3659])))
    for p in daftar:
        print(' ', os.path.basename(p)[:110])
