# -*- coding: utf-8 -*-
"""Jenis 359 PERKAWINAN CAMPURAN (SIPP "Perkawinan Campuran" / nama lengkap "Penolakan Kawin Campuran", Pdt.P, ALUR 61) - agen W3a-A, 21 Okt 2026.

Permohonan terhadap penolakan pejabat memberikan surat keterangan bahwa syarat-syarat perkawinan telah dipenuhi untuk perkawinan campuran
(WNI dengan WNA): Pasal 57-62 UU 1/1974, khususnya Pasal 60 ayat (3)-(5): pengadilan memberi keputusan "dengan tidak beracara" dan tidak boleh
dimintakan banding; ayat (4) keputusan menjadi pengganti keterangan; ayat (5) tidak berkekuatan bila perkawinan tidak dilangsungkan dalam 6 bulan.
Pengadilan Agama hanya berwenang bila para pihak beragama Islam (Pasal 63 ayat (1) huruf a UU 1/1974).

Dasar susunan sama dengan penolakan perkawinan (kerangka "5b Pencegahan Perkawinan" + "7 Wali Adhal" + "6 Perwalian - BAS").
Variabel baru 3620-3639. Rujukan hukum: docs/gelombang3/PERIKSA-PASAL-W3a-perkawinan-campuran.md.
Pakai: python jenis_perkawinan_campuran.py   (membangun RTF + katalog saksi + ringkasan)
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import w3a_lib as L  # noqa: E402
from variabel_def import V  # noqa: E402
import w3aA_susun as S  # noqa: E402

J = L.JENIS['perkawinan-campuran']

# ---------------------------------------------------------------------------------------------------------------------
# VARIABEL BARU 3620-3639
# ---------------------------------------------------------------------------------------------------------------------
WNI = "p.warga_negara_id = 98"
WNA = "p.warga_negara_id IS NOT NULL AND p.warga_negara_id <> 98"
_UMUR = '''(SELECT TIMESTAMPDIFF(YEAR, p.tanggal_lahir, pr.tanggal_pendaftaran) FROM perkara_pihak1 pp JOIN pihak p ON p.id = pp.pihak_id
   WHERE pp.perkara_id = pr.perkara_id AND %s AND p.tanggal_lahir IS NOT NULL AND p.tanggal_lahir > '1900-01-01' ORDER BY pp.urutan LIMIT 1)'''
_UMUR_SUB = '''FROM (SELECT %s AS ul, %s AS up FROM perkara pr WHERE pr.perkara_id = '#perkara_id#') x''' % (_UMUR % WNI, _UMUR % WNA)


def _nama_calon(no_isian, kriteria):
    return '''SELECT IF(TRIM("#%d#") <> "", TRIM("#%d#"), IFNULL((SELECT TRIM(pp.nama) FROM perkara_pihak1 pp JOIN pihak p ON p.id = pp.pihak_id
  WHERE pp.perkara_id = '#perkara_id#' AND %s ORDER BY pp.urutan LIMIT 1), "......")) AS data''' % (no_isian, no_isian, kriteria)


V(3620, 'PERKAWINAN CAMPURAN: NAMA CALON MEMPELAI WNI - ISIAN (nama lengkap; kosong = Pemohon berkewarganegaraan Indonesia pada SIPP; isi bila calon WNI bukan Pemohon)', 'data_teks')
V(3621, 'PERKAWINAN CAMPURAN: NAMA CALON MEMPELAI WNA - ISIAN (nama lengkap sesuai paspor; kosong = Pemohon berkewarganegaraan asing pada SIPP)', 'data_teks')
V(3622, 'PERKAWINAN CAMPURAN: CALON MEMPELAI WNI (OTOMATIS: isian 3620; kosong = nama Pemohon berkewarganegaraan Indonesia pada SIPP; titik-titik bila tidak ada)', 'data_sql', _nama_calon(3620, WNI))
V(3623, 'PERKAWINAN CAMPURAN: CALON MEMPELAI WNA (OTOMATIS: isian 3621; kosong = nama Pemohon berkewarganegaraan asing pada SIPP; titik-titik bila tidak ada)', 'data_sql', _nama_calon(3621, WNA))
V(3624, 'PERKAWINAN CAMPURAN: NEGARA ASAL CALON MEMPELAI WNA - ISIAN (nama negara asal paspor, mis. Malaysia; kosong = negara pada data pihak SIPP)', 'data_teks')
V(3625, 'PERKAWINAN CAMPURAN: NEGARA ASAL CALON MEMPELAI WNA (OTOMATIS: isian 3624; kosong = negara pada data Pemohon asing di SIPP; titik-titik bila tidak ada)', 'data_sql',
  '''SELECT IF(TRIM("#3624#") <> "", TRIM("#3624#"), IFNULL((SELECT n.nama FROM perkara_pihak1 pp JOIN pihak p ON p.id = pp.pihak_id JOIN negara n ON n.id = p.warga_negara_id
  WHERE pp.perkara_id = '#perkara_id#' AND %s ORDER BY pp.urutan LIMIT 1), "......")) AS data''' % WNA)
V(3626, 'PERKAWINAN CAMPURAN: PEJABAT YANG MENOLAK MEMBERIKAN SURAT KETERANGAN - ISIAN (mis. Pegawai Pencatat Nikah Kantor Urusan Agama Kecamatan ..., Kabupaten ...)', 'data_teks',
  None, 'Pegawai Pencatat Nikah Kantor Urusan Agama Kecamatan ..., Kabupaten ...')
V(3627, 'PERKAWINAN CAMPURAN: ALASAN PENOLAKAN MENURUT SURAT PEJABAT - ISIAN (klausa singkat sesuai surat, mis. surat keterangan dari kedutaan negara asal calon belum diserahkan)', 'data_teks')
V(3628, 'PERKAWINAN CAMPURAN: KALIMAT PENOLAKAN PEJABAT (OTOMATIS dari isian 3626, 3627, surat Nomor/Tanggal 0652-0653 dan calon 3622-3623)', 'data_sql',
  '''SELECT CONCAT(IF(TRIM("#3626#") = "", "pejabat yang berwenang mencatat perkawinan", TRIM("#3626#")),
 " telah menolak memberikan surat keterangan bahwa syarat-syarat perkawinan telah dipenuhi bagi perkawinan antara #3622# (warga negara Indonesia) dan #3623# (warga negara #3625#) berdasarkan surat penolakan",
 IF(TRIM("#0652#") = "", "", " Nomor #0652#"), IF(TRIM("#0653#") = "", "", " tanggal #0653#"),
 IF(TRIM("#3627#") = "", "", " dengan alasan #3627#")) AS data''')
V(3629, 'PERKAWINAN CAMPURAN (KABUL): FAKTA HUKUM SYARAT PERKAWINAN TELAH TERPENUHI - ISIAN (klausa dari bukti dan saksi, mis. calon WNA bebas menikah menurut surat keterangan kedutaan negara asalnya)', 'data_teks')
V(3630, 'PERKAWINAN CAMPURAN (TOLAK): FAKTA HUKUM SYARAT PERKAWINAN BELUM TERPENUHI - ISIAN (klausa dari bukti dan saksi, mis. calon WNA masih terikat perkawinan di negara asalnya)', 'data_teks')
V(3631, 'PERKAWINAN CAMPURAN: SYARAT YANG DIJADIKAN ALASAN PENOLAKAN - ISIAN (1 huruf A-F: A surat keterangan negara asal, B status/terikat kawin, C umur, D agama, E paspor/izin tinggal, F lain)', 'data_teks')
V(3632, 'PERKAWINAN CAMPURAN: DASAR HUKUM SYARAT (OTOMATIS dari huruf isian 3631: pasal UU 1/1974 dan KHI)', 'data_sql',
  '''SELECT CASE UPPER(LEFT(TRIM("#3631#"), 1))
 WHEN 'A' THEN "Pasal 60 ayat (1) dan ayat (2) Undang-Undang Nomor 1 Tahun 1974 tentang Perkawinan"
 WHEN 'B' THEN "Pasal 60 ayat (1) dan Pasal 9 Undang-Undang Nomor 1 Tahun 1974 tentang Perkawinan jo. Pasal 40 huruf a Kompilasi Hukum Islam"
 WHEN 'C' THEN "Pasal 60 ayat (1) dan Pasal 7 ayat (1) Undang-Undang Nomor 1 Tahun 1974 tentang Perkawinan sebagaimana telah diubah dengan Undang-Undang Nomor 16 Tahun 2019"
 WHEN 'D' THEN "Pasal 60 ayat (1) dan Pasal 2 ayat (1) Undang-Undang Nomor 1 Tahun 1974 tentang Perkawinan jo. Pasal 40 huruf c dan Pasal 44 Kompilasi Hukum Islam"
 WHEN 'E' THEN "Pasal 60 ayat (1) dan ayat (2) Undang-Undang Nomor 1 Tahun 1974 tentang Perkawinan"
 WHEN 'F' THEN "Pasal 60 ayat (1) dan ayat (2) Undang-Undang Nomor 1 Tahun 1974 tentang Perkawinan"
 ELSE "<mark>isi huruf syarat yang dijadikan alasan (variabel 3631)</mark>" END AS data''')
V(3633, 'PERKAWINAN CAMPURAN: BUNYI NORMA SYARAT (OTOMATIS dari huruf isian 3631)', 'data_sql',
  '''SELECT CASE UPPER(LEFT(TRIM("#3631#"), 1))
 WHEN 'A' THEN "perkawinan campuran tidak dapat dilangsungkan sebelum terbukti bahwa syarat-syarat perkawinan yang ditentukan oleh hukum yang berlaku bagi pihak masing-masing telah dipenuhi, dan untuk membuktikannya diberikan surat keterangan oleh mereka yang menurut hukum yang berlaku bagi pihak masing-masing berwenang mencatat perkawinan"
 WHEN 'B' THEN "perkawinan campuran tidak dapat dilangsungkan sebelum terbukti bahwa syarat-syarat perkawinan menurut hukum masing-masing pihak telah dipenuhi, dan seorang yang masih terikat tali perkawinan dengan orang lain tidak dapat kawin lagi, kecuali dalam hal yang tersebut pada Pasal 3 ayat (2) dan Pasal 4 Undang-Undang tersebut"
 WHEN 'C' THEN "perkawinan campuran tidak dapat dilangsungkan sebelum terbukti bahwa syarat-syarat perkawinan menurut hukum masing-masing pihak telah dipenuhi, dan menurut hukum Indonesia perkawinan hanya diizinkan apabila pria dan wanita sudah mencapai umur 19 (sembilan belas) tahun"
 WHEN 'D' THEN "perkawinan campuran tidak dapat dilangsungkan sebelum terbukti bahwa syarat-syarat perkawinan menurut hukum masing-masing pihak telah dipenuhi, perkawinan adalah sah apabila dilakukan menurut hukum masing-masing agamanya dan kepercayaannya itu, dan seorang wanita beragama Islam dilarang melangsungkan perkawinan dengan pria yang tidak beragama Islam serta seorang pria beragama Islam dilarang melangsungkan perkawinan dengan wanita yang tidak beragama Islam"
 WHEN 'E' THEN "perkawinan campuran tidak dapat dilangsungkan sebelum terbukti bahwa syarat-syarat perkawinan menurut hukum masing-masing pihak telah dipenuhi, dengan bukti berupa surat keterangan dari pejabat yang menurut hukum masing-masing pihak berwenang mencatat perkawinan"
 WHEN 'F' THEN "perkawinan campuran tidak dapat dilangsungkan sebelum terbukti bahwa syarat-syarat perkawinan menurut hukum masing-masing pihak telah dipenuhi, dan untuk membuktikannya diberikan surat keterangan oleh mereka yang menurut hukum masing-masing pihak berwenang mencatat perkawinan"
 ELSE "<mark>isi huruf syarat yang dijadikan alasan (variabel 3631)</mark>" END AS data''')
V(3634, 'PERKAWINAN CAMPURAN: ALAT BUKTI SURAT #0046# - ISIAN (daftar bukti P.1 dst.; tanpa teks satker tetap)', 'data_teks',
  None, '1. Fotokopi Kartu Tanda Penduduk atas nama ..., NIK ..., yang dikeluarkan oleh ..., bukti surat tersebut telah diberi meterai cukup, di-nazegelen, serta telah dicocokkan dengan aslinya yang ternyata sesuai, lalu diberi tanda P.1;<br>'
  '2. Fotokopi paspor atas nama ... nomor ... yang dikeluarkan oleh pemerintah negara ..., bukti surat tersebut telah diberi meterai cukup, di-nazegelen, serta telah dicocokkan dengan aslinya yang ternyata sesuai, lalu diberi tanda P.2;<br>'
  '3. Fotokopi surat penolakan pemberian surat keterangan syarat-syarat perkawinan Nomor ... tanggal ..., lalu diberi tanda P.3;<br>4. ...')
V(3635, 'PERKAWINAN CAMPURAN: PERTIMBANGAN UMUR DAN PERSETUJUAN CALON MEMPELAI (OTOMATIS: umur dari tanggal lahir Pemohon pada SIPP; kurang dari 19 tahun diberi tanda PERIKSA)', 'data_sql',
  '''SELECT CONCAT("Menimbang, bahwa berdasarkan Pasal 7 ayat (1) Undang-Undang Nomor 1 Tahun 1974 tentang Perkawinan sebagaimana telah diubah dengan Undang-Undang Nomor 16 Tahun 2019, perkawinan hanya diizinkan apabila pria dan wanita sudah mencapai umur 19 (sembilan belas) tahun, dan berdasarkan Pasal 6 ayat (1) Undang-Undang tersebut jo. Pasal 16 ayat (1) Kompilasi Hukum Islam, perkawinan harus didasarkan atas persetujuan kedua calon mempelai; ",
 CASE
  WHEN x.ul IS NULL AND x.up IS NULL THEN "[PERIKSA: tanggal lahir calon mempelai belum ada pada SIPP; tuliskan umur kedua calon menurut paspor dan bukti surat] "
  WHEN (x.ul IS NOT NULL AND x.ul < 19) OR (x.up IS NOT NULL AND x.up < 19) THEN CONCAT("[PERIKSA: menurut SIPP umur calon WNI ", IFNULL(x.ul, "belum diketahui"), " tahun dan umur calon WNA ", IFNULL(x.up, "belum diketahui"), " tahun, ada yang belum mencapai 19 tahun - perlu dispensasi kawin] ")
  WHEN x.ul IS NOT NULL AND x.up IS NOT NULL THEN CONCAT("berdasarkan data kependudukan dan paspor #3622# (calon WNI) berumur ", x.ul, " tahun dan #3623# (calon WNA) berumur ", x.up, " tahun sehingga kedua calon mempelai telah memenuhi batas umur perkawinan, ")
  WHEN x.ul IS NOT NULL THEN CONCAT("berdasarkan data kependudukan #3622# (calon WNI) berumur ", x.ul, " tahun sehingga telah memenuhi batas umur perkawinan, [PERIKSA: umur calon WNA belum ada pada SIPP; tuliskan menurut paspor] ")
  ELSE CONCAT("berdasarkan paspor #3623# (calon WNA) berumur ", x.up, " tahun sehingga telah memenuhi batas umur perkawinan, [PERIKSA: umur calon WNI belum ada pada SIPP; tuliskan menurut bukti surat] ") END,
 "dan berdasarkan keterangan #0046# serta saksi-saksi, perkawinan tersebut dikehendaki oleh kedua calon mempelai tanpa paksaan, sehingga syarat umur dan persetujuan calon mempelai telah terpenuhi;") AS data
''' + _UMUR_SUB)
V(3636, 'PERKAWINAN CAMPURAN: KETERANGAN PEJABAT YANG DIDENGAR - ISIAN (frasa kerja: hadir dan menerangkan ... / menyerahkan surat ... / tidak hadir)', 'data_teks',
  None, 'hadir di persidangan dan menerangkan pada pokoknya bahwa penolakan didasarkan pada alasan sebagaimana tertulis dalam surat penolakan')
V(3637, 'PERKAWINAN CAMPURAN: POKOK KETERANGAN CALON MEMPELAI DI PERSIDANGAN - ISIAN (satu klausa, mis. membenarkan rencana perkawinan dan menyatakan menikah atas kehendak sendiri)', 'data_teks',
  None, 'membenarkan rencana perkawinan tersebut dan menyatakan melangsungkannya atas kehendak sendiri tanpa paksaan')
V(3638, 'PERKAWINAN CAMPURAN (NO): FAKTA PENYEBAB TIDAK DAPAT DITERIMA - ISIAN (klausa: calon WNA beragama ... / belum ada penolakan tertulis / kedua calon WNI)', 'data_teks')
V(3639, 'PERKAWINAN CAMPURAN: PERTIMBANGAN IZIN ORANG TUA (OTOMATIS: hanya bila salah seorang Pemohon pada SIPP belum 21 tahun; diawali satu baris baru)', 'data_sql',
  '''SELECT IF(LEAST(IFNULL(x.ul, 99), IFNULL(x.up, 99)) < 21,
 CONCAT("<br>Menimbang, bahwa oleh karena salah seorang calon mempelai belum mencapai umur 21 (dua puluh satu) tahun, berdasarkan Pasal 6 ayat (2) Undang-Undang Nomor 1 Tahun 1974 tentang Perkawinan jo. Pasal 15 ayat (2) Kompilasi Hukum Islam untuk melangsungkan perkawinan diperlukan izin kedua orang tua; [PERIKSA: pastikan izin kedua orang tua tercantum pada bukti surat atau keterangan saksi] "), "") AS data
''' + _UMUR_SUB)

ISIAN = {
    '3620': ('opsional', 'Nama calon WNI; isi hanya bila calon WNI bukan Pemohon (bila Pemohon berwarganegara Indonesia, nama diambil dari SIPP)'),
    '3621': ('opsional', 'Nama calon WNA sesuai paspor; kosong = Pemohon berkewarganegaraan asing pada SIPP'),
    '3624': ('opsional', 'Negara asal calon WNA; kosong = negara pada data pihak SIPP'),
    '3626': ('manual', 'Pejabat yang menolak ditulis di surat penolakan; tidak dicatat terstruktur di SIPP'),
    '3627': ('manual', 'Alasan penolakan dikutip dari surat penolakan yang diserahkan Pemohon; tidak ada di SIPP'),
    '3629': ('manual', 'Pertimbangan bahwa syarat perkawinan telah terpenuhi adalah penilaian majelis atas bukti dan saksi; diisi hakim pada blangko Kabul'),
    '3630': ('manual', 'Syarat yang belum terpenuhi adalah penilaian majelis atas bukti dan saksi; diisi hakim pada blangko Tolak'),
    '3631': ('manual', 'Huruf syarat yang dijadikan alasan penolakan ditentukan majelis dari surat penolakan dan alat bukti'),
    '3634': ('manual', 'Daftar alat bukti surat diketik dari bukti yang diajukan Pemohon (paspor, surat keterangan negara asal, surat penolakan)'),
    '3636': ('manual', 'Keterangan pejabat di persidangan atau melalui surat bukan data SIPP; isi dari persidangan'),
    '3637': ('manual', 'Keterangan calon mempelai di persidangan diambil dari berita acara sidang; tidak ada di SIPP'),
    '3638': ('manual', 'Fakta penyebab tidak dapat diterima adalah penilaian majelis; pada blangko Tidak Dapat Diterima'),
}

RAMAH = {
    '3620': dict(nm='Calon mempelai WNI (nama lengkap; kosong = Pemohon berwarganegara Indonesia dari SIPP)', saran='Isi hanya bila calon WNI bukan Pemohon'),
    '3621': dict(nm='Calon mempelai WNA (nama sesuai paspor; kosong = Pemohon berwarganegara asing dari SIPP)', saran='Tulis persis seperti di paspor'),
    '3624': dict(nm='Negara asal calon mempelai WNA (mis. Malaysia; kosong = dari SIPP)'),
    '3626': dict(nm='Pejabat yang menolak memberikan surat keterangan', saran='Mis. Pegawai Pencatat Nikah Kantor Urusan Agama Kecamatan ..., Kabupaten ...'),
    '3627': dict(nm='Alasan penolakan menurut surat pejabat', saran='Kutip singkat dari surat penolakan'),
    '3629': dict(nm='Fakta hukum syarat perkawinan telah terpenuhi (untuk putusan dikabulkan)', saran='Satu klausa dari bukti dan saksi, mis. calon WNA bebas menikah menurut surat keterangan kedutaan negara asalnya'),
    '3630': dict(nm='Fakta hukum syarat perkawinan belum terpenuhi (untuk putusan ditolak)', saran='Satu klausa dari bukti dan saksi'),
    '3631': dict(nm='Syarat yang dijadikan alasan penolakan (pilih satu huruf)', pil=[
        'A · surat keterangan dari negara asal calon WNA belum ada', 'B · calon masih terikat perkawinan', 'C · belum mencapai umur perkawinan',
        'D · perbedaan agama', 'E · paspor atau izin tinggal bermasalah', 'F · syarat lain menurut hukum masing-masing']),
    '3634': dict(nm='Alat bukti surat {P} (daftar bukti P.1 dst.)', saran='Sertakan paspor, surat keterangan negara asal dan surat penolakan'),
    '3636': dict(nm='Keterangan pejabat yang didengar', saran='Mis. hadir dan menerangkan ...; menyerahkan surat ...; atau tidak hadir'),
    '3637': dict(nm='Pokok keterangan calon mempelai di persidangan', saran='Satu klausa dari berita acara sidang'),
    '3638': dict(nm='Fakta penyebab tidak dapat diterima (untuk Tidak Dapat Diterima)', saran='Satu klausa sesuai blangko: calon WNA beragama ...; belum ada penolakan tertulis; atau kedua calon berwarganegara Indonesia'),
}

C01 = '[01] [Kabul] Perkawinan Campuran - Pejabat Didengar atau Menyerahkan Surat Penolakan.rtf'
C01A = '[01a] [Kabul] Perkawinan Campuran - Pejabat Tidak Hadir.rtf'
C03 = '[03] [Tolak] Perkawinan Campuran - Syarat Perkawinan Belum Terpenuhi.rtf'
C99A = '[99a] [NO] Perkawinan Campuran - Calon Mempelai Tidak Beragama Islam.rtf'
C99B = '[99b] [NO] Perkawinan Campuran - Belum Ada Penolakan Pejabat.rtf'
C99C = '[99c] [NO] Perkawinan Campuran - Bukan Perkawinan Campuran.rtf'

PETA = [
    L.meta(J, C01, '', 'Kabul: penolakan tidak beralasan dan penetapan menjadi pengganti surat keterangan (Pasal 60 ayat (4)); pejabat didengar atau menyerahkan surat'),
    L.meta(J, C01A, 'pejabat-tidak-hadir', 'Kabul: pejabat diberi kesempatan didengar tetapi tidak hadir'),
    L.meta(J, C03, '', 'Tolak: syarat perkawinan belum terpenuhi, penolakan beralasan'),
    L.meta(J, C99A, 'calon-tidak-beragama-islam', 'NO: calon mempelai tidak beragama Islam, bukan wewenang Pengadilan Agama (Pasal 63 ayat (1))'),
    L.meta(J, C99B, 'belum-ada-penolakan', 'NO: belum ada penolakan pejabat (Pasal 60 ayat (3))'),
    L.meta(J, C99C, 'bukan-perkawinan-campuran', 'NO: bukan perkawinan campuran (Pasal 57)'),
] + L.meta_umum_permohonan(J)

# ---------------------------------------------------------------------------------------------------------------------
# Susunan penetapan (kerangka sama dengan penolakan perkawinan)
# ---------------------------------------------------------------------------------------------------------------------
DASAR = '5b Pencegahan Perkawinan/[01] [Kabul] Pencegahan Perkawinan - Calon Mempelai Hadir.rtf'
P_KEPALA, P_DENGAR, P_DUDUK, P_INTRO, P_POSITA, P_BERDASARKAN, P_PETITUM = 0, 11, 12, 13, 14, 15, 16
P_BAHWA, P_UNTUK_BUKTI, P_SURAT, P_ISI_SURAT, P_SAKSI = 17, 22, 23, 24, 25
P_PERTIM, P_MENIMBANG, P_FAKTA, P_MEMPERHATIKAN, P_MENETAPKAN, P_AMAR, P_KAKI = 32, 33, 40, 50, 51, 52, 55

ABS = ('Menimbang, bahwa #0053# #0046# pada pokoknya mengenai penolakan pemberian surat keterangan bahwa syarat-syarat perkawinan telah dipenuhi untuk perkawinan campuran '
       'antara orang-orang yang beragama Islam, maka berdasarkan Pasal 49 huruf a beserta penjelasannya angka 21 Undang-Undang Nomor 7 Tahun 1989 tentang Peradilan Agama '
       'sebagaimana telah diubah dengan Undang-Undang Nomor 3 Tahun 2006 dan perubahan kedua dengan Undang-Undang Nomor 50 Tahun 2009 jo. Pasal 63 ayat (1) huruf a '
       'Undang-Undang Nomor 1 Tahun 1974 tentang Perkawinan, perkara a quo termasuk kewenangan absolut Pengadilan Agama;')
REL = ('Menimbang, bahwa oleh karena pejabat yang menolak memberikan surat keterangan, yaitu #3626#, berkedudukan di wilayah hukum #8008#, maka perkara a quo termasuk '
       'kewenangan relatif #8008#;')
STANDING = ('Menimbang, bahwa berdasarkan Pasal 60 ayat (3) Undang-Undang Nomor 1 Tahun 1974 tentang Perkawinan, apabila pejabat yang bersangkutan menolak memberikan surat keterangan '
            'bahwa syarat-syarat perkawinan telah dipenuhi, maka atas permintaan yang berkepentingan Pengadilan memberikan keputusan tentang soal apakah penolakan pemberian '
            'surat keterangan itu beralasan atau tidak; oleh karena #0046# adalah calon mempelai yang berkepentingan atas surat keterangan tersebut, maka #0046# mempunyai '
            'kedudukan hukum (legal standing) untuk mengajukan #0053# a quo;')
CAMPURAN = ('Menimbang, bahwa berdasarkan Pasal 57 Undang-Undang Nomor 1 Tahun 1974 tentang Perkawinan, perkawinan campuran ialah perkawinan antara dua orang yang di Indonesia '
            'tunduk pada hukum yang berlainan karena perbedaan kewarganegaraan dan salah satu pihak berkewarganegaraan Indonesia, dan berdasarkan Pasal 59 ayat (2) Undang-Undang '
            'tersebut perkawinan campuran yang dilangsungkan di Indonesia dilakukan menurut Undang-Undang Perkawinan; oleh karena #3622# berkewarganegaraan Indonesia dan '
            '#3623# berkewarganegaraan #3625#, maka rencana perkawinan keduanya merupakan perkawinan campuran;')
TIDAK_BERACARA = ('Menimbang, bahwa berdasarkan Pasal 60 ayat (3) Undang-Undang Nomor 1 Tahun 1974 tentang Perkawinan, Pengadilan memberikan keputusan dengan tidak beracara serta '
                  'tidak boleh dimintakan banding lagi tentang soal apakah penolakan pemberian surat keterangan itu beralasan atau tidak, sehingga pemeriksaan dalam perkara ini '
                  'dibatasi pada penilaian atas alasan penolakan berdasarkan surat penolakan, keterangan #0046# dan bukti yang diajukan;')
NORMA_60 = ('Menimbang, bahwa berdasarkan Pasal 60 ayat (1) dan ayat (2) Undang-Undang Nomor 1 Tahun 1974 tentang Perkawinan, perkawinan campuran tidak dapat dilangsungkan '
            'sebelum terbukti bahwa syarat-syarat perkawinan yang ditentukan oleh hukum yang berlaku bagi pihak masing-masing telah dipenuhi, dan untuk membuktikannya oleh mereka '
            'yang menurut hukum yang berlaku bagi pihak masing-masing berwenang mencatat perkawinan diberikan surat keterangan bahwa syarat-syarat tersebut telah dipenuhi;')
ALASAN = 'Menimbang, bahwa alasan penolakan pejabat dalam perkara ini bersandar pada #3632#, yang pada pokoknya menentukan bahwa #3633#;'
PASAL_60_4_5 = ('Menimbang, bahwa berdasarkan Pasal 60 ayat (4) Undang-Undang Nomor 1 Tahun 1974 tentang Perkawinan, apabila Pengadilan memutuskan bahwa penolakan tidak beralasan maka '
                'keputusan itu menjadi pengganti keterangan yang dimaksud, dan berdasarkan ayat (5) Pasal tersebut surat keterangan atau keputusan pengganti keterangan tidak mempunyai '
                'kekuatan lagi jika perkawinan itu tidak dilangsungkan dalam masa 6 (enam) bulan sesudah keterangan itu diberikan;')
AGAMA = 'Bahwa #3622# beragama Islam dan #3623# beragama Islam;'


def _kepala(s, tokens, dengar):
    s.baru(P_KEPALA, ' '.join('#%s#' % t for t in tokens))
    s.raw(1, 2, 3, 4, 5, 6, 7, 8, 9, 10)
    s.baru(P_DENGAR, dengar)


def _duduk_awal(s):
    s.raw(P_DUDUK, P_INTRO, P_POSITA, P_BERDASARKAN, P_PETITUM)


def _penutup(s, amar):
    s.raw(49, P_MEMPERHATIKAN, P_MENETAPKAN)
    for n, teks in enumerate(amar, 1):
        s.baru(P_AMAR, teks, '%d.' % n)
    s.raw(*range(P_KAKI, len(s.d.par)))


def _bukti(s, dengan_saksi):
    s.raw(P_UNTUK_BUKTI, P_SURAT)
    s.baru(P_ISI_SURAT, '#3634#')
    if dengan_saksi:
        s.raw(25, 26, 27, 28, 29)
    s.raw(30, 31)


def _pertimbangan_bukti(s, dengan_saksi):
    s.raw(37)
    if dengan_saksi:
        s.raw(38)


JELAS = ('Bahwa #0690# telah menjelaskan kepada #0046# bahwa Pengadilan memberikan keputusan dengan tidak beracara tentang soal apakah penolakan pemberian surat keterangan itu '
         'beralasan atau tidak, dan keputusan tersebut tidak boleh dimintakan banding lagi, dan #0046# menyatakan mengerti serta tetap pada #0053#nya;')
FAKTA_AWAL = 'Bahwa #3628#;'


def susun_kabul(hadir):
    s = S.Susun(DASAR)
    token = ['0652', '0653', '3620', '3621', '3624', '3626', '3627', '3629', '3631', '3634', '3637'] + (['3636'] if hadir else [])
    _kepala(s, token, 'Telah mendengar keterangan #0046#, %ssaksi-saksi serta memeriksa alat-alat bukti di persidangan;' % ('pejabat yang bersangkutan, ' if hadir else ''))
    _duduk_awal(s)
    s.baru(P_BAHWA, 'Bahwa pada hari sidang yang telah ditetapkan, #4046# telah datang menghadap di persidangan;')
    if hadir:
        s.baru(P_BAHWA, 'Bahwa #3626# yang menolak memberikan surat keterangan tersebut telah diberi kesempatan untuk didengar keterangannya dan #3636#;')
    else:
        s.baru(P_BAHWA, 'Bahwa #3626# yang menolak memberikan surat keterangan tersebut telah diberi kesempatan untuk didengar keterangannya, namun tidak hadir di persidangan '
               'dan tidak menyampaikan keterangan lain di luar surat penolakan yang diserahkan #0046#;')
    s.baru(P_BAHWA, JELAS)
    s.raw(19)
    s.baru(P_BAHWA, 'Bahwa atas pertanyaan #0690#, #0046# memberikan keterangan yang pada pokoknya bahwa #3628#; dan bahwa #0046# berkeberatan atas penolakan tersebut karena #3629#;')
    s.baru(P_BAHWA, 'Bahwa calon mempelai, yaitu #3622# dan #3623#, telah didengar keterangannya di persidangan yang pada pokoknya #3637#;')
    _bukti(s, True)
    s.raw(P_PERTIM, 33)
    for t in (ABS, REL, STANDING, CAMPURAN, TIDAK_BERACARA):
        s.baru(P_MENIMBANG, t)
    _pertimbangan_bukti(s, True)
    s.baru(P_MENIMBANG, 'Menimbang, bahwa berdasarkan keterangan #0046#, bukti surat dan keterangan saksi-saksi, ditemukan fakta hukum sebagai berikut:')
    s.baru(P_FAKTA, FAKTA_AWAL, '1.')
    s.baru(P_FAKTA, AGAMA, '2.')
    s.baru(P_FAKTA, 'Bahwa #3629#;', '3.')
    s.baru(P_MENIMBANG, NORMA_60)
    s.baru(P_MENIMBANG, ALASAN)
    if hadir:
        s.baru(P_MENIMBANG, 'Menimbang, bahwa #3626# telah didengar keterangannya dan #3636#, namun keterangan tersebut tidak membuktikan bahwa syarat-syarat perkawinan '
               'sebagaimana dimaksud #3632# belum dipenuhi;')
    else:
        s.baru(P_MENIMBANG, 'Menimbang, bahwa #3626# telah diberi kesempatan untuk didengar keterangannya namun tidak hadir, sehingga penilaian atas alasan penolakan didasarkan '
               'pada surat penolakan, keterangan #0046#, bukti surat dan keterangan saksi-saksi;')
    s.baru(P_MENIMBANG, 'Menimbang, bahwa berdasarkan fakta hukum tersebut di atas, syarat-syarat perkawinan menurut hukum yang berlaku bagi #3622# dan menurut hukum yang berlaku '
           'bagi #3623# telah terpenuhi, karena #3629#, sehingga penolakan untuk memberikan surat keterangan sebagaimana dimaksud #3632# tidak beralasan;')
    s.baru(P_MENIMBANG, '#3635##3639#')
    s.baru(P_MENIMBANG, PASAL_60_4_5)
    s.baru(P_MENIMBANG, 'Menimbang, bahwa berdasarkan pertimbangan-pertimbangan tersebut di atas, #0053# #0046# telah beralasan dan berdasar hukum, oleh karena itu patut dikabulkan;')
    _penutup(s, ['Mengabulkan #0053# #0046#;',
                 'Menyatakan penolakan #3626# untuk memberikan surat keterangan bahwa syarat-syarat perkawinan telah dipenuhi bagi perkawinan antara #3622# dengan #3623# tidak beralasan;',
                 'Menyatakan penetapan ini menjadi pengganti surat keterangan bahwa syarat-syarat perkawinan telah dipenuhi sebagaimana dimaksud Pasal 60 ayat (4) Undang-Undang Nomor 1 Tahun 1974 tentang Perkawinan;',
                 '#8505# (#0155# #7095#).'])
    return s.hasil()


def susun_tolak():
    s = S.Susun(DASAR)
    _kepala(s, ['0652', '0653', '3620', '3621', '3624', '3626', '3627', '3630', '3631', '3634', '3636', '3637'],
            'Telah mendengar keterangan #0046#, pejabat yang bersangkutan, saksi-saksi serta memeriksa alat-alat bukti di persidangan;')
    _duduk_awal(s)
    s.baru(P_BAHWA, 'Bahwa pada hari sidang yang telah ditetapkan, #4046# telah datang menghadap di persidangan;')
    s.baru(P_BAHWA, 'Bahwa #3626# yang menolak memberikan surat keterangan tersebut telah diberi kesempatan untuk didengar keterangannya dan #3636#;')
    s.baru(P_BAHWA, JELAS)
    s.raw(19)
    s.baru(P_BAHWA, 'Bahwa atas pertanyaan #0690#, #0046# memberikan keterangan yang pada pokoknya bahwa #3628#, dan #0046# berkeberatan atas penolakan tersebut serta memohon '
           'agar Pengadilan menyatakan penolakan itu tidak beralasan;')
    s.baru(P_BAHWA, 'Bahwa calon mempelai, yaitu #3622# dan #3623#, telah didengar keterangannya di persidangan yang pada pokoknya #3637#;')
    _bukti(s, True)
    s.raw(P_PERTIM, 33)
    for t in (ABS, REL, STANDING, CAMPURAN, TIDAK_BERACARA):
        s.baru(P_MENIMBANG, t)
    _pertimbangan_bukti(s, True)
    s.baru(P_MENIMBANG, 'Menimbang, bahwa berdasarkan keterangan #0046#, bukti surat dan keterangan saksi-saksi, ditemukan fakta hukum sebagai berikut:')
    s.baru(P_FAKTA, FAKTA_AWAL, '1.')
    s.baru(P_FAKTA, AGAMA, '2.')
    s.baru(P_FAKTA, 'Bahwa #3630#;', '3.')
    s.baru(P_MENIMBANG, NORMA_60)
    s.baru(P_MENIMBANG, ALASAN)
    s.baru(P_MENIMBANG, 'Menimbang, bahwa #3626# telah didengar keterangannya dan #3636#, yang sejalan dengan fakta hukum sebagaimana diuraikan di atas;')
    s.baru(P_MENIMBANG, 'Menimbang, bahwa berdasarkan fakta hukum tersebut di atas, telah terbukti bahwa #3630#, sehingga syarat-syarat perkawinan sebagaimana dimaksud #3632# '
           'belum dipenuhi, dan penolakan #3626# untuk memberikan surat keterangan bahwa syarat-syarat perkawinan telah dipenuhi beralasan;')
    s.baru(P_MENIMBANG, 'Menimbang, bahwa oleh karena penolakan tersebut beralasan, maka #0053# #0046# harus ditolak, dan #0046# dapat mengajukan kembali apabila syarat-syarat '
           'perkawinan menurut hukum yang berlaku bagi pihak masing-masing telah terbukti dipenuhi;')
    _penutup(s, ['Menolak #0053# #0046#;',
                 'Menyatakan penolakan #3626# untuk memberikan surat keterangan bahwa syarat-syarat perkawinan telah dipenuhi bagi perkawinan antara #3622# dengan #3623# beralasan;',
                 '#8505# (#0155# #7095#).'])
    return s.hasil()


def _susun_no(token, bahwa_atas, fakta, pertimbangan_khusus, dengan_pejabat_rel=False):
    s = S.Susun(DASAR)
    _kepala(s, ['0652', '0653', '3620', '3621', '3624', '3634', '3638'] + token, 'Telah mendengar keterangan #0046# serta memeriksa alat-alat bukti di persidangan;')
    _duduk_awal(s)
    s.baru(P_BAHWA, 'Bahwa pada hari sidang yang telah ditetapkan, #4046# telah datang menghadap di persidangan;')
    s.baru(P_BAHWA, 'Bahwa #0690# telah menjelaskan kepada #0046# bahwa Pengadilan memberikan keputusan dengan tidak beracara tentang soal apakah penolakan pemberian surat '
           'keterangan itu beralasan atau tidak, dan #0046# menyatakan mengerti serta tetap pada #0053#nya;')
    s.raw(19)
    s.baru(P_BAHWA, bahwa_atas)
    _bukti(s, False)
    s.raw(P_PERTIM, 33)
    s.baru(P_MENIMBANG, ABS)
    for t in pertimbangan_khusus[0]:
        s.baru(P_MENIMBANG, t)
    _pertimbangan_bukti(s, False)
    s.baru(P_MENIMBANG, 'Menimbang, bahwa berdasarkan keterangan #0046# dan bukti surat, ditemukan fakta hukum sebagai berikut:')
    for n, f in enumerate(fakta, 1):
        s.baru(P_FAKTA, f, '%d.' % n)
    for t in pertimbangan_khusus[1]:
        s.baru(P_MENIMBANG, t)
    _penutup(s, ['Menyatakan #0053# #0046# tidak dapat diterima (Niet Ontvankelijke Verklaard);', '#8505# (#0155# #7095#).'])
    return s.hasil()


def susun_no_agama():
    return _susun_no(
        ['3626'], 'Bahwa atas pertanyaan #0690#, #0046# memberikan keterangan yang pada pokoknya bahwa #3628#, dan bahwa #3638#;',
        ['Bahwa #3628#;', 'Bahwa #3638#;'],
        ([ 'Menimbang, bahwa berdasarkan Pasal 63 ayat (1) Undang-Undang Nomor 1 Tahun 1974 tentang Perkawinan, yang dimaksud Pengadilan dalam Undang-Undang tersebut ialah '
           'Pengadilan Agama bagi mereka yang beragama Islam dan Pengadilan Umum bagi lainnya;'],
         [ 'Menimbang, bahwa oleh karena berdasarkan fakta hukum #3638#, maka tidak seluruh calon mempelai beragama Islam sehingga perkara a quo bukan kewenangan Pengadilan Agama '
           'dan #0053# #0046# harus dinyatakan tidak dapat diterima (Niet Ontvankelijke Verklaard) tanpa perlu mempertimbangkan pokok permohonannya;']))


def susun_no_prematur():
    return _susun_no(
        ['3626'], 'Bahwa atas pertanyaan #0690#, #0046# memberikan keterangan yang pada pokoknya bahwa #3622# (warga negara Indonesia) dan #3623# (warga negara #3625#) hendak '
        'melangsungkan perkawinan, dan bahwa #3638#;',
        ['Bahwa #3622# dan #3623# hendak melangsungkan perkawinan campuran;', 'Bahwa #3638#;'],
        ([STANDING, TIDAK_BERACARA],
         ['Menimbang, bahwa berdasarkan Pasal 60 ayat (3) Undang-Undang Nomor 1 Tahun 1974 tentang Perkawinan, permohonan kepada Pengadilan baru dapat diajukan apabila pejabat yang '
          'bersangkutan menolak memberikan surat keterangan bahwa syarat-syarat perkawinan telah dipenuhi, sedangkan berdasarkan fakta hukum #3638#, sehingga belum ada penolakan '
          'yang dapat dinilai oleh Pengadilan;',
          'Menimbang, bahwa dengan demikian #0053# #0046# diajukan sebelum waktunya (prematur) sehingga harus dinyatakan tidak dapat diterima (Niet Ontvankelijke Verklaard) tanpa perlu '
          'mempertimbangkan pokok permohonannya, dan #0046# dapat mengajukannya kembali apabila pejabat yang bersangkutan telah menolak memberikan surat keterangan;']))


def susun_no_bukan_campuran():
    return _susun_no(
        [], 'Bahwa atas pertanyaan #0690#, #0046# memberikan keterangan yang pada pokoknya bahwa #3638#;',
        ['Bahwa #3638#;'],
        (['Menimbang, bahwa berdasarkan Pasal 57 Undang-Undang Nomor 1 Tahun 1974 tentang Perkawinan, perkawinan campuran ialah perkawinan antara dua orang yang di Indonesia tunduk pada hukum yang berlainan karena perbedaan kewarganegaraan dan salah satu pihak berkewarganegaraan Indonesia;'],
         ['Menimbang, bahwa berdasarkan fakta hukum #3638#, maka rencana perkawinan antara #3622# dan #3623# bukan perkawinan campuran sebagaimana dimaksud Pasal 57 Undang-Undang '
          'Nomor 1 Tahun 1974 tentang Perkawinan, sehingga ketentuan Pasal 60 Undang-Undang tersebut tidak berlaku dan #0053# #0046# harus dinyatakan tidak dapat diterima '
          '(Niet Ontvankelijke Verklaard) tanpa perlu mempertimbangkan pokok permohonannya;']))


NASIHAT = ('tentang hal-hal yang berkaitan dengan penolakan pemberian surat keterangan syarat-syarat perkawinan campuran, antara lain bahwa Pengadilan memberikan keputusan dengan tidak '
           'beracara tentang soal apakah penolakan itu beralasan atau tidak dan keputusan tersebut tidak boleh dimintakan banding lagi, dan atas penjelasan tersebut')
TOKEN_BAS = ['0652', '0653', '3620', '3621', '3624', '3626', '3627', '3631', '3636', '3634']


def bangun_bas():
    hasil = L.buat_bas_permohonan(J, NASIHAT, '3634')
    for p in hasil:
        raw = open(L.lp(p), 'rb').read().decode('latin1')
        raw = L.ganti_paragraf(raw, r'^#1025#', ' '.join('#%s#' % t for t in TOKEN_BAS), wajib=False)
        dd = L.dok_dari_raw(raw)
        if any('menyerahkan bukti surat berupa' in dd.isi(i) for i in range(len(dd.par))):
            hasilp = []
            for i, par in enumerate(dd.par):
                if 'menyerahkan bukti surat berupa' in dd.isi(i):
                    hasilp.append(dd.ganti_teks(i, 'Selanjutnya #0690# memeriksa surat penolakan yang diserahkan #7036#, yaitu bahwa #3628#;'))
                    hasilp.append(dd.ganti_teks(i, '#3626# telah diberi kesempatan untuk didengar keterangannya dan #3636#;'))
                hasilp.append(par)
            raw = dd.rakit(hasilp)
        L.simpan_bas(J, os.path.basename(p), raw)
    return hasil


def bangun():
    L.simpan_putusan(J, C01, susun_kabul(True))
    L.simpan_putusan(J, C01A, susun_kabul(False))
    L.simpan_putusan(J, C03, susun_tolak())
    L.simpan_putusan(J, C99A, susun_no_agama())
    L.simpan_putusan(J, C99B, susun_no_prematur())
    L.simpan_putusan(J, C99C, susun_no_bukan_campuran())
    L.buat_umum_permohonan(J)
    bangun_bas()


def bangun_katalog():
    import w3aA_katalog_campuran as K
    return S.tulis_katalog(K.katalog(J))


if __name__ == '__main__':
    bangun()
    print('RTF selesai:', J['folder'])
    bangun_katalog()
    kode, keluar = S.periksa_katalog('perkawinan-campuran.json')
    print(keluar)
