# -*- coding: utf-8 -*-
"""Jenis 343 PENOLAKAN PERKAWINAN (SIPP "Penolakan Perkawinan", permohonan Pdt.P, ALUR 60) - agen W3a-A, 21 Okt 2026.

Calon mempelai memohon agar Pengadilan memeriksa penolakan Pegawai Pencatat Nikah (KUA) melangsungkan perkawinan
(Pasal 21 ayat (1)-(5) UU 1/1974; Penjelasan Pasal 49 huruf a angka 5 UU 7/1989 jo. UU 3/2006 jo. UU 50/2009). Pengadilan memeriksa
"dengan acara singkat" dan menetapkan menguatkan penolakan atau memerintahkan perkawinan dilangsungkan (ayat (4)).
Pegawai Pencatat Nikah BUKAN pihak tetapi didengar (hadir / surat / tidak hadir).

Dasar susunan: kerangka "5b Pencegahan Perkawinan" (permohonan dengan pihak ketiga didengar) + "7 Wali Adhal" (umum) + "6 Perwalian - BAS".
Variabel baru 3600-3619. Rujukan hukum: docs/gelombang3/PERIKSA-PASAL-W3a-penolakan-perkawinan.md.
Pakai: python jenis_penolakan_perkawinan.py   (membangun RTF + katalog saksi + ringkasan)
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import w3a_lib as L  # noqa: E402
from variabel_def import V  # noqa: E402
import w3aA_susun as S  # noqa: E402

J = L.JENIS['penolakan-perkawinan']

# ---------------------------------------------------------------------------------------------------------------------
# VARIABEL BARU 3600-3619
# ---------------------------------------------------------------------------------------------------------------------
_UMUR = '''(SELECT TIMESTAMPDIFF(YEAR, p.tanggal_lahir, pr.tanggal_pendaftaran) FROM perkara_pihak1 pp JOIN pihak p ON p.id = pp.pihak_id
   WHERE pp.perkara_id = pr.perkara_id AND UPPER(IFNULL(p.jenis_kelamin, '')) = '%s' AND p.tanggal_lahir IS NOT NULL AND p.tanggal_lahir > '1900-01-01' ORDER BY pp.urutan LIMIT 1)'''
_UMUR_SUB = '''FROM (SELECT %s AS ul, %s AS up FROM perkara pr WHERE pr.perkara_id = '#perkara_id#') x''' % (_UMUR % 'L', _UMUR % 'P')


def _nama_calon(no_isian, jk):
    return '''SELECT IF(TRIM("#%d#") <> "", TRIM("#%d#"), IFNULL((SELECT TRIM(pp.nama) FROM perkara_pihak1 pp JOIN pihak p ON p.id = pp.pihak_id
  WHERE pp.perkara_id = '#perkara_id#' AND UPPER(IFNULL(p.jenis_kelamin, '')) = '%s' ORDER BY pp.urutan LIMIT 1), "......")) AS data''' % (no_isian, no_isian, jk)


V(3600, 'PENOLAKAN KAWIN: NAMA CALON SUAMI - ISIAN (nama lengkap bin ...; kosong = Pemohon laki-laki pada SIPP; isi bila calon suami BUKAN Pemohon)', 'data_teks')
V(3601, 'PENOLAKAN KAWIN: NAMA CALON ISTRI - ISIAN (nama lengkap binti ...; kosong = Pemohon perempuan pada SIPP; isi bila calon istri BUKAN Pemohon)', 'data_teks')
V(3602, 'PENOLAKAN KAWIN: CALON SUAMI (OTOMATIS: isian 3600; kosong = nama Pemohon laki-laki pada SIPP; titik-titik bila tidak ada)', 'data_sql', _nama_calon(3600, 'L'))
V(3603, 'PENOLAKAN KAWIN: CALON ISTRI (OTOMATIS: isian 3601; kosong = nama Pemohon perempuan pada SIPP; titik-titik bila tidak ada)', 'data_sql', _nama_calon(3601, 'P'))
V(3604, 'PENOLAKAN KAWIN: WILAYAH KUA PEGAWAI PENCATAT NIKAH YANG MENOLAK - ISIAN (tulis "Kecamatan ..., Kabupaten ..."; wilayah hukum Pengadilan ditentukan olehnya, Pasal 21 ayat (3) UU 1/1974)', 'data_teks', None, 'Kecamatan ..., Kabupaten ...')
V(3605, 'PENOLAKAN KAWIN: ALASAN PENOLAKAN MENURUT SURAT PEGAWAI PENCATAT NIKAH - ISIAN (klausa singkat sesuai surat, mis. calon istri belum mencapai umur 19 tahun; Pasal 21 ayat (2))', 'data_teks')
V(3606, 'PENOLAKAN KAWIN: DASAR LARANGAN YANG DIJADIKAN ALASAN - ISIAN (1 huruf A-H: A terikat kawin, B umur, C nasab/semenda/susuan, D iddah, E beda agama, F talak tiga/lian, G izin, H berkas)', 'data_teks')
V(3607, 'PENOLAKAN KAWIN: DASAR HUKUM LARANGAN (OTOMATIS dari huruf isian 3606: pasal UU 1/1974, PP 9/1975 dan KHI)', 'data_sql',
  '''SELECT CASE UPPER(LEFT(TRIM("#3606#"), 1))
 WHEN 'A' THEN "Pasal 9 Undang-Undang Nomor 1 Tahun 1974 tentang Perkawinan jo. Pasal 40 huruf a Kompilasi Hukum Islam"
 WHEN 'B' THEN "Pasal 7 ayat (1) dan ayat (2) Undang-Undang Nomor 1 Tahun 1974 tentang Perkawinan sebagaimana telah diubah dengan Undang-Undang Nomor 16 Tahun 2019 jo. Pasal 15 ayat (1) Kompilasi Hukum Islam"
 WHEN 'C' THEN "Pasal 8 Undang-Undang Nomor 1 Tahun 1974 tentang Perkawinan jo. Pasal 39 Kompilasi Hukum Islam"
 WHEN 'D' THEN "Pasal 11 Undang-Undang Nomor 1 Tahun 1974 tentang Perkawinan jo. Pasal 39 Peraturan Pemerintah Nomor 9 Tahun 1975 jo. Pasal 40 huruf b dan Pasal 153 Kompilasi Hukum Islam"
 WHEN 'E' THEN "Pasal 2 ayat (1) Undang-Undang Nomor 1 Tahun 1974 tentang Perkawinan jo. Pasal 40 huruf c, Pasal 44 dan Pasal 61 Kompilasi Hukum Islam"
 WHEN 'F' THEN "Pasal 10 Undang-Undang Nomor 1 Tahun 1974 tentang Perkawinan jo. Pasal 43 Kompilasi Hukum Islam"
 WHEN 'G' THEN "Pasal 6 ayat (1) dan ayat (2) Undang-Undang Nomor 1 Tahun 1974 tentang Perkawinan jo. Pasal 15 ayat (2), Pasal 16 dan Pasal 17 Kompilasi Hukum Islam"
 WHEN 'H' THEN "Pasal 12 Undang-Undang Nomor 1 Tahun 1974 tentang Perkawinan jo. Pasal 6 ayat (1) dan ayat (2) serta Pasal 7 ayat (2) Peraturan Pemerintah Nomor 9 Tahun 1975"
 ELSE "<mark>isi huruf dasar larangan (variabel 3606)</mark>" END AS data''')
V(3608, 'PENOLAKAN KAWIN: BUNYI NORMA LARANGAN (OTOMATIS dari huruf isian 3606)', 'data_sql',
  '''SELECT CASE UPPER(LEFT(TRIM("#3606#"), 1))
 WHEN 'A' THEN "seorang yang masih terikat tali perkawinan dengan orang lain tidak dapat kawin lagi, kecuali dalam hal yang tersebut pada Pasal 3 ayat (2) dan Pasal 4 Undang-Undang tersebut"
 WHEN 'B' THEN "perkawinan hanya diizinkan apabila pria dan wanita sudah mencapai umur 19 (sembilan belas) tahun, dan penyimpangan terhadap ketentuan umur tersebut hanya dapat dilakukan dengan meminta dispensasi kepada Pengadilan"
 WHEN 'C' THEN "perkawinan dilarang antara dua orang yang berhubungan darah, berhubungan semenda, berhubungan susuan, atau mempunyai hubungan yang oleh agamanya atau peraturan lain yang berlaku dilarang kawin"
 WHEN 'D' THEN "bagi seorang wanita yang putus perkawinannya berlaku jangka waktu tunggu (iddah), dan dilarang melangsungkan perkawinan dengan seorang wanita yang masih berada dalam masa iddah dengan pria lain"
 WHEN 'E' THEN "perkawinan adalah sah apabila dilakukan menurut hukum masing-masing agamanya dan kepercayaannya itu, seorang wanita beragama Islam dilarang melangsungkan perkawinan dengan pria yang tidak beragama Islam, dan seorang pria beragama Islam dilarang melangsungkan perkawinan dengan wanita yang tidak beragama Islam"
 WHEN 'F' THEN "dilarang melangsungkan perkawinan antara seorang pria dengan bekas istrinya yang telah ditalak tiga kali, kecuali bekas istri tersebut telah kawin dengan pria lain kemudian perkawinan tersebut putus ba'da dukhul dan telah habis masa iddahnya, dan dilarang pula dengan bekas istri yang dili'an"
 WHEN 'G' THEN "perkawinan harus didasarkan atas persetujuan kedua calon mempelai, dan untuk melangsungkan perkawinan seorang yang belum mencapai umur 21 (dua puluh satu) tahun harus mendapat izin kedua orang tuanya"
 WHEN 'H' THEN "Pegawai Pencatat meneliti apakah syarat-syarat perkawinan telah dipenuhi dan apakah tidak terdapat halangan perkawinan menurut Undang-Undang, termasuk kutipan akta kelahiran, keterangan mengenai orang tua, izin atau dispensasi bila diperlukan, serta surat kematian atau keterangan perceraian bagi yang pernah kawin, dan bila terdapat halangan atau persyaratan belum dipenuhi keadaan itu diberitahukan kepada calon mempelai"
 ELSE "<mark>isi huruf dasar larangan (variabel 3606)</mark>" END AS data''')
V(3609, 'PENOLAKAN KAWIN (KABUL): FAKTA HUKUM MENGAPA LARANGAN TIDAK TERBUKTI - ISIAN (klausa dari bukti dan saksi, mis. calon istri lahir pada ... sehingga telah berumur 19 tahun)', 'data_teks')
V(3610, 'PENOLAKAN KAWIN (TOLAK): FAKTA HUKUM LARANGAN YANG TERBUKTI - ISIAN (klausa dari bukti, saksi dan keterangan calon mempelai, mis. calon suami masih terikat perkawinan sah dengan ...)', 'data_teks')
V(3611, 'PENOLAKAN KAWIN: KETERANGAN PEGAWAI PENCATAT NIKAH YANG DIDENGAR - ISIAN (frasa kerja: hadir dan menerangkan ... / menyerahkan surat ... / tidak hadir)', 'data_teks',
  None, 'hadir di persidangan dan menerangkan pada pokoknya bahwa penolakan didasarkan pada alasan sebagaimana tertulis dalam surat penolakan')
V(3612, 'PENOLAKAN KAWIN: POKOK KETERANGAN CALON MEMPELAI DI PERSIDANGAN - ISIAN (satu klausa, mis. membenarkan rencana perkawinan dan menyatakan menikah atas kehendak sendiri tanpa paksaan)', 'data_teks',
  None, 'membenarkan rencana perkawinan tersebut dan menyatakan melangsungkannya atas kehendak sendiri tanpa paksaan')
V(3613, 'PENOLAKAN KAWIN: ALAT BUKTI SURAT #0046# - ISIAN (daftar bukti P.1 dst.; tanpa teks satker tetap)', 'data_teks',
  None, '1. Fotokopi Kartu Tanda Penduduk atas nama ..., NIK ..., yang dikeluarkan oleh ..., bukti surat tersebut telah diberi meterai cukup, di-nazegelen, serta telah dicocokkan dengan aslinya yang ternyata sesuai, lalu diberi tanda P.1;<br>'
  '2. Fotokopi Surat Penolakan Pegawai Pencatat Nikah Kantor Urusan Agama ... Nomor ... tanggal ..., bukti surat tersebut telah diberi meterai cukup, di-nazegelen, serta telah dicocokkan dengan aslinya yang ternyata sesuai, lalu diberi tanda P.2;<br>3. ...')
V(3614, 'PENOLAKAN KAWIN: PERTIMBANGAN UMUR DAN PERSETUJUAN CALON MEMPELAI (OTOMATIS: umur dari tanggal lahir Pemohon pada SIPP; kurang dari 19 tahun diberi tanda PERIKSA)', 'data_sql',
  '''SELECT CONCAT("Menimbang, bahwa berdasarkan Pasal 7 ayat (1) Undang-Undang Nomor 1 Tahun 1974 tentang Perkawinan sebagaimana telah diubah dengan Undang-Undang Nomor 16 Tahun 2019, perkawinan hanya diizinkan apabila pria dan wanita sudah mencapai umur 19 (sembilan belas) tahun, dan berdasarkan Pasal 6 ayat (1) Undang-Undang tersebut jo. Pasal 16 ayat (1) Kompilasi Hukum Islam, perkawinan harus didasarkan atas persetujuan kedua calon mempelai; ",
 CASE
  WHEN x.ul IS NULL AND x.up IS NULL THEN "[PERIKSA: tanggal lahir calon mempelai belum ada pada SIPP; tuliskan umur kedua calon menurut bukti surat] "
  WHEN (x.ul IS NOT NULL AND x.ul < 19) OR (x.up IS NOT NULL AND x.up < 19) THEN CONCAT("[PERIKSA: menurut SIPP umur calon suami ", IFNULL(x.ul, "belum diketahui"), " tahun dan umur calon istri ", IFNULL(x.up, "belum diketahui"), " tahun, ada yang belum mencapai 19 tahun - perlu dispensasi kawin] ")
  WHEN x.ul IS NOT NULL AND x.up IS NOT NULL THEN CONCAT("berdasarkan data kependudukan #3602# (calon suami) berumur ", x.ul, " tahun dan #3603# (calon istri) berumur ", x.up, " tahun sehingga kedua calon mempelai telah memenuhi batas umur perkawinan, ")
  WHEN x.ul IS NOT NULL THEN CONCAT("berdasarkan data kependudukan #3602# (calon suami) berumur ", x.ul, " tahun sehingga telah memenuhi batas umur perkawinan, [PERIKSA: umur calon istri belum ada pada SIPP; tuliskan menurut bukti surat] ")
  ELSE CONCAT("berdasarkan data kependudukan #3603# (calon istri) berumur ", x.up, " tahun sehingga telah memenuhi batas umur perkawinan, [PERIKSA: umur calon suami belum ada pada SIPP; tuliskan menurut bukti surat] ") END,
 "dan berdasarkan keterangan #0046#, calon mempelai serta saksi-saksi, perkawinan tersebut dikehendaki oleh kedua calon mempelai tanpa paksaan, sehingga syarat umur dan persetujuan calon mempelai telah terpenuhi;") AS data
''' + _UMUR_SUB)
V(3615, 'PENOLAKAN KAWIN: KALIMAT PENOLAKAN PEGAWAI PENCATAT NIKAH (OTOMATIS dari isian 3604, 3605, surat Nomor/Tanggal 0652-0653 dan calon 3602-3603)', 'data_sql',
  '''SELECT CONCAT("Pegawai Pencatat Nikah Kantor Urusan Agama ", IF(TRIM("#3604#") = "", "Kecamatan ..., Kabupaten ...", TRIM("#3604#")),
 " telah menolak melangsungkan perkawinan antara #3602# (calon suami) dan #3603# (calon istri) berdasarkan surat penolakan",
 IF(TRIM("#0652#") = "", "", " Nomor #0652#"), IF(TRIM("#0653#") = "", "", " tanggal #0653#"),
 IF(TRIM("#3605#") = "", "", " dengan alasan #3605#")) AS data''')
V(3616, 'PENOLAKAN KAWIN (NO): PENGADILAN AGAMA YANG BERWENANG SECARA RELATIF - ISIAN (nama Pengadilan Agama yang wilayah hukumnya memuat KUA yang menolak, mis. Pengadilan Agama ...)', 'data_teks')
V(3617, 'PENOLAKAN KAWIN (NO): FAKTA KEADAAN PEMBERITAHUAN DAN PENOLAKAN DI KUA - ISIAN (klausa, mis. belum ada penolakan tertulis dari Pegawai Pencatat Nikah)', 'data_teks')
V(3618, 'PENOLAKAN KAWIN: PERTIMBANGAN IZIN ORANG TUA (OTOMATIS: hanya bila salah seorang Pemohon pada SIPP belum 21 tahun; diawali satu baris baru)', 'data_sql',
  '''SELECT IF(LEAST(IFNULL(x.ul, 99), IFNULL(x.up, 99)) < 21,
 CONCAT("<br>Menimbang, bahwa oleh karena salah seorang calon mempelai belum mencapai umur 21 (dua puluh satu) tahun, berdasarkan Pasal 6 ayat (2) Undang-Undang Nomor 1 Tahun 1974 tentang Perkawinan jo. Pasal 15 ayat (2) Kompilasi Hukum Islam untuk melangsungkan perkawinan diperlukan izin kedua orang tua; [PERIKSA: pastikan izin kedua orang tua tercantum pada bukti surat atau keterangan saksi] "), "") AS data
''' + _UMUR_SUB)

# Isian yang tidak mungkin terisi otomatis (dibaca isian-metadata.ts): satu kode tidak boleh di kedua daftar.
ISIAN = {
    '3600': ('opsional', 'Nama calon suami; isi hanya bila calon suami bukan Pemohon (bila Pemohon laki-laki, nama diambil dari SIPP)'),
    '3601': ('opsional', 'Nama calon istri; isi hanya bila calon istri bukan Pemohon (bila Pemohon perempuan, nama diambil dari SIPP)'),
    '3604': ('manual', 'Wilayah KUA yang menolak ditulis di surat penolakan; belum tentu sama dengan tempat tinggal Pemohon dan tidak ada di SIPP'),
    '3605': ('manual', 'Alasan penolakan dikutip dari surat Pegawai Pencatat Nikah yang diserahkan Pemohon; tidak dicatat terstruktur di SIPP'),
    '3606': ('manual', 'Huruf larangan yang dijadikan alasan penolakan ditentukan majelis dari surat penolakan dan alat bukti'),
    '3609': ('manual', 'Pertimbangan bahwa larangan tidak terbukti adalah penilaian majelis atas bukti dan saksi; diisi hakim pada blangko Kabul'),
    '3610': ('manual', 'Larangan yang terbukti adalah penilaian majelis atas bukti dan saksi; diisi hakim pada blangko Tolak'),
    '3611': ('manual', 'Keterangan Pegawai Pencatat Nikah di persidangan atau melalui surat bukan data SIPP; isi dari persidangan'),
    '3612': ('manual', 'Keterangan calon mempelai di persidangan diambil dari berita acara sidang; tidak ada di SIPP'),
    '3613': ('manual', 'Daftar alat bukti surat diketik dari bukti yang diajukan Pemohon'),
    '3616': ('manual', 'Pengadilan Agama yang berwenang menurut wilayah KUA yang menolak ditetapkan majelis; pada blangko Tidak Dapat Diterima (wilayah)'),
    '3617': ('manual', 'Keadaan belum adanya penolakan tertulis diambil dari keterangan Pemohon dan bukti surat; pada blangko Tidak Dapat Diterima (prematur)'),
}

# Tampilan isian untuk petugas (format RAMAH di blangko-derry/susun.ts); {P} = sebutan Pemohon.
RAMAH = {
    '3600': dict(nm='Calon suami (nama lengkap bin ...; kosong = Pemohon laki-laki dari SIPP)', saran='Isi hanya bila calon suami bukan Pemohon'),
    '3601': dict(nm='Calon istri (nama lengkap binti ...; kosong = Pemohon perempuan dari SIPP)', saran='Isi hanya bila calon istri bukan Pemohon'),
    '3604': dict(nm='Wilayah KUA yang menolak (Kecamatan ..., Kabupaten ...)', saran='Lihat kop surat penolakan Pegawai Pencatat Nikah'),
    '3605': dict(nm='Alasan penolakan menurut surat Pegawai Pencatat Nikah', saran='Kutip singkat dari surat penolakan'),
    '3606': dict(nm='Larangan yang dijadikan alasan penolakan (pilih satu huruf)', pil=[
        'A · masih terikat perkawinan dengan orang lain', 'B · belum mencapai umur perkawinan', 'C · hubungan darah, semenda atau susuan',
        'D · masih dalam masa tunggu (iddah)', 'E · beda agama', 'F · sudah dua kali cerai satu sama lain, talak tiga atau li\'an',
        'G · tanpa persetujuan calon mempelai atau izin orang tua', 'H · syarat administrasi belum lengkap']),
    '3609': dict(nm='Fakta hukum mengapa larangan tidak terbukti (untuk putusan dikabulkan)', saran='Satu klausa dari bukti dan saksi, mis. calon istri lahir pada ... sehingga telah berumur 19 tahun'),
    '3610': dict(nm='Fakta hukum larangan yang terbukti (untuk putusan ditolak)', saran='Satu klausa dari bukti dan saksi'),
    '3611': dict(nm='Keterangan Pegawai Pencatat Nikah yang didengar', saran='Mis. hadir di persidangan dan menerangkan bahwa ...; atau menyerahkan surat tanggal ...; atau tidak hadir'),
    '3612': dict(nm='Pokok keterangan calon mempelai di persidangan', saran='Satu klausa dari berita acara sidang'),
    '3613': dict(nm='Alat bukti surat {P} (daftar bukti P.1 dst.)', saran='Sertakan surat penolakan Pegawai Pencatat Nikah'),
    '3616': dict(nm='Pengadilan Agama yang berwenang menurut wilayah KUA yang menolak (untuk Tidak Dapat Diterima)'),
    '3617': dict(nm='Fakta keadaan pemberitahuan dan penolakan di KUA (untuk Tidak Dapat Diterima, belum ada penolakan tertulis)', saran='Satu klausa, mis. belum ada surat penolakan tertulis dari Pegawai Pencatat Nikah'),
}

# ---------------------------------------------------------------------------------------------------------------------
# Peta blangko putusan jenis ini
# ---------------------------------------------------------------------------------------------------------------------
N01 = '[01] [Kabul] Penolakan Perkawinan - PPN Didengar atau Menyerahkan Surat Penolakan.rtf'
N01A = '[01a] [Kabul] Penolakan Perkawinan - PPN Tidak Hadir.rtf'
N03 = '[03] [Tolak] Penolakan Perkawinan - Larangan Perkawinan Terbukti.rtf'
N99A = '[99a] [NO] Penolakan Perkawinan - Belum Ada Penolakan Tertulis PPN.rtf'
N99B = '[99b] [NO] Penolakan Perkawinan - PPN Berkedudukan di Luar Wilayah Hukum.rtf'

PETA = [
    L.meta(J, N01, '', 'Kabul: penolakan PPN dinyatakan tidak beralasan dan perkawinan diperintahkan dilangsungkan (Pasal 21 ayat (4)); PPN didengar atau menyerahkan surat'),
    L.meta(J, N01A, 'ppn-tidak-hadir', 'Kabul: PPN diberi kesempatan didengar tetapi tidak hadir'),
    L.meta(J, N03, '', 'Tolak: larangan perkawinan terbukti, penolakan PPN dikuatkan'),
    L.meta(J, N99A, 'belum-ada-penolakan-tertulis', 'NO: belum ada penolakan tertulis dari PPN (permohonan prematur, Pasal 21 ayat (2) dan (3))'),
    L.meta(J, N99B, 'bukan-wilayah-hukum', 'NO: PPN yang menolak berkedudukan di luar wilayah hukum Pengadilan (Pasal 21 ayat (3))'),
] + L.meta_umum_permohonan(J)

# ---------------------------------------------------------------------------------------------------------------------
# Susunan penetapan
# ---------------------------------------------------------------------------------------------------------------------
DASAR = '5b Pencegahan Perkawinan/[01] [Kabul] Pencegahan Perkawinan - Calon Mempelai Hadir.rtf'
# indeks paragraf berkas dasar (alat/paragraf.py): lihat docstring modul
P_KEPALA, P_DENGAR, P_DUDUK, P_INTRO, P_POSITA, P_BERDASARKAN, P_PETITUM = 0, 11, 12, 13, 14, 15, 16
P_BAHWA, P_UNTUK_BUKTI, P_SURAT, P_ISI_SURAT, P_SAKSI = 17, 22, 23, 24, 25
P_PERTIM, P_MENIMBANG, P_FAKTA, P_MEMPERHATIKAN, P_MENETAPKAN, P_AMAR, P_KAKI = 32, 33, 40, 50, 51, 52, 55

ABS = ('Menimbang, bahwa #0053# #0046# pada pokoknya mengenai penolakan perkawinan oleh Pegawai Pencatat Nikah terhadap orang-orang yang beragama Islam, maka '
       'berdasarkan Pasal 49 huruf a beserta penjelasannya angka 5 Undang-Undang Nomor 7 Tahun 1989 tentang Peradilan Agama sebagaimana telah diubah dengan '
       'Undang-Undang Nomor 3 Tahun 2006 dan perubahan kedua dengan Undang-Undang Nomor 50 Tahun 2009 jo. Pasal 63 ayat (1) huruf a Undang-Undang Nomor 1 Tahun 1974 '
       'tentang Perkawinan, perkara a quo termasuk kewenangan absolut Pengadilan Agama;')
REL = ('Menimbang, bahwa berdasarkan Pasal 21 ayat (3) Undang-Undang Nomor 1 Tahun 1974 tentang Perkawinan, para pihak yang perkawinannya ditolak berhak mengajukan '
       'permohonan kepada pengadilan di dalam wilayah mana Pegawai Pencatat Perkawinan yang mengadakan penolakan berkedudukan, dan oleh karena Pegawai Pencatat Nikah '
       'Kantor Urusan Agama #3604# yang menolak melangsungkan perkawinan antara #3602# dan #3603# berkedudukan di wilayah hukum #8008#, maka perkara a quo termasuk '
       'kewenangan relatif #8008#;')
STANDING = ('Menimbang, bahwa berdasarkan Pasal 21 ayat (2) dan ayat (3) Undang-Undang Nomor 1 Tahun 1974 tentang Perkawinan, dalam hal penolakan Pegawai Pencatat '
            'Perkawinan memberikan keterangan tertulis tentang penolakan tersebut disertai alasan-alasannya atas permintaan salah satu pihak yang ingin melangsungkan perkawinan, '
            'dan para pihak yang perkawinannya ditolak berhak mengajukan permohonan kepada pengadilan dengan menyerahkan surat keterangan penolakan tersebut; oleh karena '
            '#0046# adalah calon mempelai yang perkawinannya ditolak dan telah menyerahkan surat penolakan Pegawai Pencatat Nikah sebagaimana diuraikan di atas, maka #0046# '
            'mempunyai kedudukan hukum (legal standing) untuk mengajukan #0053# a quo;')
ACARA_SINGKAT = ('Menimbang, bahwa berdasarkan Pasal 21 ayat (4) Undang-Undang Nomor 1 Tahun 1974 tentang Perkawinan, Pengadilan memeriksa perkaranya dengan acara singkat dan '
                 'memberikan ketetapan, apakah akan menguatkan penolakan tersebut ataukah memerintahkan agar perkawinan dilangsungkan, sehingga pemeriksaan dalam perkara ini '
                 'dibatasi pada ada atau tidak adanya larangan perkawinan menurut Undang-Undang yang dijadikan alasan penolakan;')
NORMA_PPN = ('Menimbang, bahwa berdasarkan Pasal 20 Undang-Undang Nomor 1 Tahun 1974 tentang Perkawinan, Pegawai Pencatat Perkawinan tidak diperbolehkan melangsungkan atau '
             'membantu melangsungkan perkawinan bila ia mengetahui adanya pelanggaran dari ketentuan dalam Pasal 7 ayat (1), Pasal 8, Pasal 9, Pasal 10 dan Pasal 12 '
             'Undang-Undang tersebut, dan berdasarkan Pasal 21 ayat (1) Undang-Undang tersebut Pegawai Pencatat Perkawinan menolak melangsungkan perkawinan apabila '
             'berpendapat bahwa terhadap perkawinan tersebut ada larangan menurut Undang-Undang;')
ALASAN_PPN = ('Menimbang, bahwa alasan penolakan Pegawai Pencatat Nikah dalam perkara ini bersandar pada #3607#, yang pada pokoknya menentukan bahwa #3608#;')
PASAL_21_5 = ('Menimbang, bahwa berdasarkan Pasal 21 ayat (5) Undang-Undang Nomor 1 Tahun 1974 tentang Perkawinan, ketetapan ini hilang kekuatannya jika rintangan-rintangan yang '
              'mengakibatkan penolakan tersebut hilang dan para pihak yang ingin kawin dapat mengulangi pemberitahuan tentang maksud mereka;')
ISLAM = 'Bahwa #3602# dan #3603# beragama Islam;'


def _kepala(s, tokens, dengar):
    s.baru(P_KEPALA, ' '.join('#%s#' % t for t in tokens))
    s.raw(1, 2, 3, 4, 5, 6, 7, 8, 9, 10)
    s.baru(P_DENGAR, dengar)


def _duduk_awal(s):
    s.raw(P_DUDUK, P_INTRO, P_POSITA, P_BERDASARKAN, P_PETITUM)


def _penutup(s, amar, biaya_idx_baru=None):
    """Biaya perkara (49), Memperhatikan, MENETAPKAN, amar bernomor, kaki (55-73)."""
    s.raw(49, P_MEMPERHATIKAN, P_MENETAPKAN)
    for n, teks in enumerate(amar, 1):
        s.baru(P_AMAR, teks, '%d.' % n)
    s.raw(*range(P_KAKI, len(s.d.par)))


def _bukti_dan_saksi(s, dengan_saksi):
    s.raw(P_UNTUK_BUKTI, P_SURAT)
    s.baru(P_ISI_SURAT, '#3613#')
    if dengan_saksi:
        s.raw(25, 26, 27, 28, 29)
    s.raw(30, 31)


def _pertimbangan_bukti(s, dengan_saksi):
    s.raw(37)
    if dengan_saksi:
        s.raw(38)


def susun_kabul(ppn_hadir):
    s = S.Susun(DASAR)
    token = ['0652', '0653', '3600', '3601', '3604', '3605', '3606', '3609', '3612', '3613'] + (['3611'] if ppn_hadir else [])
    _kepala(s, token, 'Telah mendengar keterangan #0046#, %ssaksi-saksi serta memeriksa alat-alat bukti di persidangan;'
            % ('Pegawai Pencatat Nikah, ' if ppn_hadir else ''))
    _duduk_awal(s)
    s.baru(P_BAHWA, 'Bahwa pada hari sidang yang telah ditetapkan, #4046# telah datang menghadap di persidangan;')
    if ppn_hadir:
        s.baru(P_BAHWA, 'Bahwa Pegawai Pencatat Nikah Kantor Urusan Agama #3604# yang menolak melangsungkan perkawinan antara #3602# (calon suami) dan #3603# (calon istri) '
               'telah diberi kesempatan untuk didengar keterangannya dan #3611#;')
    else:
        s.baru(P_BAHWA, 'Bahwa Pegawai Pencatat Nikah Kantor Urusan Agama #3604# yang menolak melangsungkan perkawinan antara #3602# (calon suami) dan #3603# (calon istri) '
               'telah diberi kesempatan untuk didengar keterangannya, namun tidak hadir di persidangan dan tidak menyampaikan keterangan lain di luar surat penolakan yang '
               'diserahkan #0046#;')
    s.baru(P_BAHWA, 'Bahwa #0690# telah menjelaskan kepada #0046# bahwa Pengadilan memeriksa perkara penolakan perkawinan ini dengan acara singkat dan hanya menilai ada atau '
           'tidak adanya larangan perkawinan menurut Undang-Undang yang dijadikan alasan penolakan, dan #0046# menyatakan mengerti serta tetap pada #0053#nya;')
    s.raw(19)
    s.baru(P_BAHWA, 'Bahwa atas pertanyaan #0690#, #0046# memberikan keterangan yang pada pokoknya bahwa #3615#; dan bahwa #0046# berkeberatan atas penolakan tersebut karena #3609#;')
    s.baru(P_BAHWA, 'Bahwa calon mempelai, yaitu #3602# dan #3603#, telah didengar keterangannya di persidangan yang pada pokoknya #3612#;')
    _bukti_dan_saksi(s, True)
    s.raw(P_PERTIM)
    s.raw(33)  # maksud dan tujuan
    s.baru(P_MENIMBANG, ABS)
    s.baru(P_MENIMBANG, REL)
    s.baru(P_MENIMBANG, STANDING)
    s.baru(P_MENIMBANG, ACARA_SINGKAT)
    _pertimbangan_bukti(s, True)
    s.baru(P_MENIMBANG, 'Menimbang, bahwa berdasarkan keterangan #0046#, bukti surat dan keterangan saksi-saksi, ditemukan fakta hukum sebagai berikut:')
    s.baru(P_FAKTA, 'Bahwa #3615#;', '1.')
    s.baru(P_FAKTA, ISLAM, '2.')
    s.baru(P_FAKTA, 'Bahwa #3609#;', '3.')
    s.baru(P_MENIMBANG, NORMA_PPN)
    s.baru(P_MENIMBANG, ALASAN_PPN)
    if ppn_hadir:
        s.baru(P_MENIMBANG, 'Menimbang, bahwa Pegawai Pencatat Nikah Kantor Urusan Agama #3604# telah didengar keterangannya dan #3611#, namun keterangan tersebut tidak '
               'membuktikan adanya larangan perkawinan sebagaimana dimaksud #3607#;')
    else:
        s.baru(P_MENIMBANG, 'Menimbang, bahwa Pegawai Pencatat Nikah Kantor Urusan Agama #3604# telah diberi kesempatan untuk didengar keterangannya namun tidak hadir, '
               'sehingga penilaian atas alasan penolakan didasarkan pada surat penolakan, keterangan #0046#, bukti surat dan keterangan saksi-saksi;')
    s.baru(P_MENIMBANG, 'Menimbang, bahwa berdasarkan fakta hukum tersebut di atas, larangan perkawinan yang dijadikan alasan penolakan tidak terbukti, karena #3609#, '
           'sehingga antara #3602# dan #3603# tidak terdapat larangan perkawinan sebagaimana dimaksud #3607#, dan penolakan Pegawai Pencatat Nikah tersebut tidak beralasan hukum;')
    s.baru(P_MENIMBANG, '#3614##3618#')
    s.baru(P_MENIMBANG, 'Menimbang, bahwa calon mempelai, yaitu #3602# dan #3603#, telah didengar keterangannya di persidangan yang pada pokoknya #3612#, sehingga keterangan tersebut '
           'menguatkan fakta hukum sebagaimana diuraikan di atas;')
    s.baru(P_MENIMBANG, 'Menimbang, bahwa berdasarkan pertimbangan-pertimbangan tersebut di atas, penolakan Pegawai Pencatat Nikah tersebut tidak beralasan sehingga #0053# #0046# '
           'telah beralasan dan berdasar hukum, oleh karena itu patut dikabulkan dan perkawinan antara #3602# dan #3603# dapat dilangsungkan di hadapan Pegawai Pencatat Nikah '
           'sepanjang syarat-syarat dan tata cara perkawinan menurut peraturan perundang-undangan yang berlaku dipenuhi;')
    _penutup(s, ['Mengabulkan #0053# #0046#;',
                 'Menyatakan penolakan Pegawai Pencatat Nikah Kantor Urusan Agama #3604# untuk melangsungkan perkawinan antara #3602# dengan #3603# tidak beralasan;',
                 'Memerintahkan agar perkawinan antara #3602# dengan #3603# dilangsungkan di hadapan Pegawai Pencatat Nikah Kantor Urusan Agama #3604# sesuai ketentuan peraturan perundang-undangan yang berlaku;',
                 '#8505# (#0155# #7095#).'])
    return s.hasil()


def susun_tolak():
    s = S.Susun(DASAR)
    _kepala(s, ['0652', '0653', '3600', '3601', '3604', '3605', '3606', '3610', '3611', '3612', '3613'],
            'Telah mendengar keterangan #0046#, Pegawai Pencatat Nikah, saksi-saksi serta memeriksa alat-alat bukti di persidangan;')
    _duduk_awal(s)
    s.baru(P_BAHWA, 'Bahwa pada hari sidang yang telah ditetapkan, #4046# telah datang menghadap di persidangan;')
    s.baru(P_BAHWA, 'Bahwa Pegawai Pencatat Nikah Kantor Urusan Agama #3604# yang menolak melangsungkan perkawinan antara #3602# (calon suami) dan #3603# (calon istri) '
           'telah diberi kesempatan untuk didengar keterangannya dan #3611#;')
    s.baru(P_BAHWA, 'Bahwa #0690# telah menjelaskan kepada #0046# bahwa Pengadilan memeriksa perkara penolakan perkawinan ini dengan acara singkat dan hanya menilai ada atau '
           'tidak adanya larangan perkawinan menurut Undang-Undang yang dijadikan alasan penolakan, dan #0046# menyatakan mengerti serta tetap pada #0053#nya;')
    s.raw(19)
    s.baru(P_BAHWA, 'Bahwa atas pertanyaan #0690#, #0046# memberikan keterangan yang pada pokoknya bahwa #3615#, dan #0046# berkeberatan atas penolakan tersebut serta memohon '
           'agar Pengadilan memerintahkan perkawinan dilangsungkan;')
    s.baru(P_BAHWA, 'Bahwa calon mempelai, yaitu #3602# dan #3603#, telah didengar keterangannya di persidangan yang pada pokoknya #3612#;')
    _bukti_dan_saksi(s, True)
    s.raw(P_PERTIM, 33)
    s.baru(P_MENIMBANG, ABS)
    s.baru(P_MENIMBANG, REL)
    s.baru(P_MENIMBANG, STANDING)
    s.baru(P_MENIMBANG, ACARA_SINGKAT)
    _pertimbangan_bukti(s, True)
    s.baru(P_MENIMBANG, 'Menimbang, bahwa berdasarkan keterangan #0046#, bukti surat dan keterangan saksi-saksi, ditemukan fakta hukum sebagai berikut:')
    s.baru(P_FAKTA, 'Bahwa #3615#;', '1.')
    s.baru(P_FAKTA, ISLAM, '2.')
    s.baru(P_FAKTA, 'Bahwa #3610#;', '3.')
    s.baru(P_MENIMBANG, NORMA_PPN)
    s.baru(P_MENIMBANG, ALASAN_PPN)
    s.baru(P_MENIMBANG, 'Menimbang, bahwa Pegawai Pencatat Nikah Kantor Urusan Agama #3604# telah didengar keterangannya dan #3611#, yang sejalan dengan fakta hukum '
           'sebagaimana diuraikan di atas;')
    s.baru(P_MENIMBANG, 'Menimbang, bahwa berdasarkan fakta hukum tersebut di atas, telah terbukti bahwa #3610#, sehingga antara #3602# dan #3603# terdapat larangan perkawinan '
           'sebagaimana dimaksud #3607#, dan penolakan Pegawai Pencatat Nikah tersebut beralasan hukum;')
    s.baru(P_MENIMBANG, 'Menimbang, bahwa oleh karena larangan perkawinan tersebut terbukti ada, maka berdasarkan Pasal 21 ayat (4) Undang-Undang Nomor 1 Tahun 1974 tentang '
           'Perkawinan penolakan Pegawai Pencatat Nikah tersebut patut dikuatkan, dan #0053# #0046# agar perkawinan dilangsungkan harus ditolak;')
    s.baru(P_MENIMBANG, PASAL_21_5)
    _penutup(s, ['Menolak #0053# #0046#;',
                 'Menguatkan penolakan Pegawai Pencatat Nikah Kantor Urusan Agama #3604# untuk melangsungkan perkawinan antara #3602# dengan #3603#;',
                 '#8505# (#0155# #7095#).'])
    return s.hasil()


def susun_no_prematur():
    s = S.Susun(DASAR)
    _kepala(s, ['0652', '0653', '3600', '3601', '3604', '3613', '3617'], 'Telah mendengar keterangan #0046# serta memeriksa alat-alat bukti di persidangan;')
    _duduk_awal(s)
    s.baru(P_BAHWA, 'Bahwa pada hari sidang yang telah ditetapkan, #4046# telah datang menghadap di persidangan;')
    s.baru(P_BAHWA, 'Bahwa #0690# telah menjelaskan kepada #0046# bahwa Pengadilan memeriksa perkara penolakan perkawinan dengan acara singkat berdasarkan surat keterangan penolakan '
           'dari Pegawai Pencatat Nikah, dan #0046# menyatakan mengerti serta tetap pada #0053#nya;')
    s.raw(19)
    s.baru(P_BAHWA, 'Bahwa atas pertanyaan #0690#, #0046# memberikan keterangan yang pada pokoknya bahwa #3602# (calon suami) dan #3603# (calon istri) hendak melangsungkan '
           'perkawinan di hadapan Pegawai Pencatat Nikah Kantor Urusan Agama #3604#, dan bahwa #3617#;')
    _bukti_dan_saksi(s, False)
    s.raw(P_PERTIM, 33)
    s.baru(P_MENIMBANG, ABS)
    s.baru(P_MENIMBANG, ACARA_SINGKAT)
    s.baru(P_MENIMBANG, 'Menimbang, bahwa berdasarkan Pasal 21 ayat (1), ayat (2) dan ayat (3) Undang-Undang Nomor 1 Tahun 1974 tentang Perkawinan, apabila Pegawai Pencatat '
           'Perkawinan berpendapat bahwa terhadap perkawinan tersebut ada larangan menurut Undang-Undang maka ia menolak melangsungkan perkawinan, dalam hal penolakan atas '
           'permintaan salah satu pihak diberikan suatu keterangan tertulis tentang penolakan tersebut disertai dengan alasan-alasannya, dan para pihak yang perkawinannya '
           'ditolak berhak mengajukan permohonan kepada pengadilan dengan menyerahkan surat keterangan penolakan tersebut;')
    _pertimbangan_bukti(s, False)
    s.baru(P_MENIMBANG, 'Menimbang, bahwa berdasarkan keterangan #0046# dan bukti surat, ditemukan fakta hukum sebagai berikut:')
    s.baru(P_FAKTA, 'Bahwa #3602# (calon suami) dan #3603# (calon istri) hendak melangsungkan perkawinan di hadapan Pegawai Pencatat Nikah Kantor Urusan Agama #3604#;', '1.')
    s.baru(P_FAKTA, 'Bahwa #3617#;', '2.')
    s.baru(P_MENIMBANG, 'Menimbang, bahwa oleh karena belum ada penolakan Pegawai Pencatat Nikah yang dituangkan dalam keterangan tertulis beserta alasan-alasannya dan diserahkan '
           'kepada Pengadilan, maka belum timbul hak #0046# untuk mengajukan permohonan sebagaimana dimaksud Pasal 21 ayat (3) Undang-Undang Nomor 1 Tahun 1974 tentang Perkawinan, '
           'dan Pengadilan belum dapat menilai ada atau tidak adanya larangan perkawinan sebagaimana dimaksud ayat (4) Pasal tersebut;')
    s.baru(P_MENIMBANG, 'Menimbang, bahwa dengan demikian #0053# #0046# diajukan sebelum waktunya (prematur) sehingga harus dinyatakan tidak dapat diterima '
           '(Niet Ontvankelijke Verklaard) tanpa perlu mempertimbangkan pokok permohonannya, dan #0046# tetap dapat mengajukan permohonan kembali sesudah Pegawai Pencatat Nikah '
           'memberikan keterangan tertulis tentang penolakan beserta alasan-alasannya;')
    _penutup(s, ['Menyatakan #0053# #0046# tidak dapat diterima (Niet Ontvankelijke Verklaard);', '#8505# (#0155# #7095#).'])
    return s.hasil()


def susun_no_wilayah():
    s = S.Susun(DASAR)
    _kepala(s, ['0652', '0653', '3600', '3601', '3604', '3605', '3613', '3616'], 'Telah mendengar keterangan #0046# serta memeriksa alat-alat bukti di persidangan;')
    _duduk_awal(s)
    s.baru(P_BAHWA, 'Bahwa pada hari sidang yang telah ditetapkan, #4046# telah datang menghadap di persidangan;')
    s.baru(P_BAHWA, 'Bahwa #0690# telah menjelaskan kepada #0046# bahwa Pengadilan memeriksa perkara penolakan perkawinan dengan acara singkat, dan #0046# menyatakan mengerti serta tetap pada #0053#nya;')
    s.raw(19)
    s.baru(P_BAHWA, 'Bahwa atas pertanyaan #0690#, #0046# memberikan keterangan yang pada pokoknya bahwa #3615#;')
    _bukti_dan_saksi(s, False)
    s.raw(P_PERTIM, 33)
    s.baru(P_MENIMBANG, ABS)
    s.baru(P_MENIMBANG, 'Menimbang, bahwa berdasarkan Pasal 21 ayat (3) Undang-Undang Nomor 1 Tahun 1974 tentang Perkawinan, para pihak yang perkawinannya ditolak berhak mengajukan '
           'permohonan kepada pengadilan di dalam wilayah mana Pegawai Pencatat Perkawinan yang mengadakan penolakan berkedudukan, sehingga kewenangan relatif pengadilan ditentukan '
           'oleh kedudukan Pegawai Pencatat Perkawinan yang menolak;')
    _pertimbangan_bukti(s, False)
    s.baru(P_MENIMBANG, 'Menimbang, bahwa berdasarkan keterangan #0046# dan bukti surat, ditemukan fakta hukum sebagai berikut:')
    s.baru(P_FAKTA, 'Bahwa #3615#;', '1.')
    s.baru(P_FAKTA, 'Bahwa Pegawai Pencatat Nikah Kantor Urusan Agama #3604# berkedudukan di wilayah hukum #3616#;', '2.')
    s.baru(P_MENIMBANG, 'Menimbang, bahwa oleh karena Pegawai Pencatat Nikah yang menolak melangsungkan perkawinan berkedudukan di wilayah hukum #3616#, bukan di wilayah hukum #8008#, '
           'maka #8008# tidak berwenang secara relatif memeriksa dan mengadili #0053# a quo;')
    s.baru(P_MENIMBANG, 'Menimbang, bahwa oleh karena #8008# tidak berwenang secara relatif, maka #0053# #0046# harus dinyatakan tidak dapat diterima (Niet Ontvankelijke Verklaard) '
           'tanpa perlu mempertimbangkan pokok permohonannya, dan #0046# dapat mengajukannya kepada #3616#;')
    _penutup(s, ['Menyatakan #0053# #0046# tidak dapat diterima (Niet Ontvankelijke Verklaard);', '#8505# (#0155# #7095#).'])
    return s.hasil()


# ---------------------------------------------------------------------------------------------------------------------
# BAS
# ---------------------------------------------------------------------------------------------------------------------
NASIHAT = ('tentang hal-hal yang berkaitan dengan penolakan perkawinan oleh Pegawai Pencatat Nikah, antara lain bahwa Pengadilan memeriksa perkara ini dengan acara singkat dan '
           'hanya menilai ada atau tidak adanya larangan perkawinan menurut Undang-Undang yang dijadikan alasan penolakan, dan atas penjelasan tersebut')
TOKEN_BAS = ['0652', '0653', '3600', '3601', '3604', '3605', '3606', '3611', '3613']


def bangun_bas():
    import re
    hasil = L.buat_bas_permohonan(J, NASIHAT, '3613')
    for p in hasil:
        raw = open(L.lp(p), 'rb').read().decode('latin1')
        # paragraf 0 = daftar token isian tersembunyi
        raw = L.ganti_paragraf(raw, r'^#1025#', ' '.join('#%s#' % t for t in TOKEN_BAS), wajib=False)
        # sebelum penyerahan alat bukti: surat penolakan PPN dan keterangan PPN
        dd = L.dok_dari_raw(raw)
        if any('menyerahkan bukti surat berupa' in dd.isi(i) for i in range(len(dd.par))):
            hasilp = []
            for i, par in enumerate(dd.par):
                if 'menyerahkan bukti surat berupa' in dd.isi(i):
                    hasilp.append(dd.ganti_teks(i, 'Selanjutnya #0690# memeriksa surat penolakan yang diserahkan #7036#, yaitu bahwa #3615#;'))
                    hasilp.append(dd.ganti_teks(i, 'Pegawai Pencatat Nikah Kantor Urusan Agama #3604# telah diberi kesempatan untuk didengar keterangannya dan #3611#;'))
                hasilp.append(par)
            raw = dd.rakit(hasilp)
        L.simpan_bas(J, os.path.basename(p), raw)
    return hasil


def bangun():
    import w3aA_susun  # noqa: F401
    L.simpan_putusan(J, N01, susun_kabul(True))
    L.simpan_putusan(J, N01A, susun_kabul(False))
    L.simpan_putusan(J, N03, susun_tolak())
    L.simpan_putusan(J, N99A, susun_no_prematur())
    L.simpan_putusan(J, N99B, susun_no_wilayah())
    L.buat_umum_permohonan(J)
    bangun_bas()


def bangun_katalog():
    import w3aA_katalog_penolakan as K
    kat = K.katalog(J)
    return S.tulis_katalog(kat)


if __name__ == '__main__':
    bangun()
    print('RTF selesai:', J['folder'])
    p = bangun_katalog()
    kode, keluar = S.periksa_katalog('penolakan-perkawinan.json')
    print(keluar)
