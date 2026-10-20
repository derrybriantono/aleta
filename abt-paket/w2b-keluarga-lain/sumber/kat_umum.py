# -*- coding: utf-8 -*-
"""Butir BARU katalog saksi PERMOHONAN UMUM (agen W2b-C sub-agen mafqud/umum, 21 Okt 2026).

Hanya menambah (butir, pokok, dasar hukum, keadaan); yang lama tidak diubah. Prefiks butir q-pu-, prefiks pokok pp-pu-.
Permohonan voluntair netral; hak asuh, wali, perwalian, pengangkatan anak, dan waris sengaja TIDAK dibuat di sini (katalog lain).

Dasar hukum BARU (daftar periksa pasal untuk agen induk; keduanya 'perlu-verifikasi', rujukan tidak tercetak di teks keluaran):
  dh-akta-otentik      Pasal 1868 KUHPerdata dan Pasal 285 RBg (akta otentik sebagai alat bukti surat)      - perlu-verifikasi
  dh-adminduk-kematian Undang-Undang tentang Administrasi Kependudukan (UU 23/2006 sebagaimana diubah, bagian pencatatan kematian)
                       - perlu-verifikasi; tanpa nomor pasal; keberlakuan dan kewenangan pengadilan agama untuk penetapan kematian
                       harus dicocokkan pada naskah resmi dan putusan sejenis (contoh perkara 648/Pdt.P/2019/PA.Dgl).
Dasar hukum LAMA yang dipakai ulang: dh-sebab-pengetahuan, dh-permohonan-voluntair, dh-kesesuaian-saksi (Buku II 2013, terverifikasi).

Keadaan baru (sumber borang): jenisPermohonan (umum|kematian|status-hukum|lain-lain), jumlahPemohon (satu|dua),
  kehadiranPemohon (hadir|diwakili), pengumuman (tidak-ada|ada).
Variabel isian baru: 4930 (hal yang dimohonkan), 4931 (waktu & tempat peristiwa), 4932 (bukti surat), 4933 (keperluan & instansi),
  4934 (sebab meninggal & tempat dimakamkan). Variabel yang sudah ada di kamus: 0099 (umur), 0100 (pekerjaan), 0101 (alamat).
Jawaban 'mendengar' butir tertentu ditulis tangan (MR) dan disisipkan lewat KELUARAN_TAMBAHAN karena pembungkus 'mendengar' bawaan
mesin menyebut "para pihak".
"""
import re

import katalog_mesin as M

KUNCI = 'permohonan-umum'

M.W_MELIHAT.setdefault('paham', (
    ['saya mengetahui sendiri bahwa {F}', 'saya tahu betul bahwa {F}', '{F}, dan hal itu saya ketahui sendiri',
     'sebagai orang yang mengenal keadaan itu saya mengetahui bahwa {F}'],
    ['yang saya ketahui secara langsung adalah bahwa {F}', '{F}, begitulah yang saya ketahui dari pergaulan sehari-hari',
     'karena mengenal keadaan itu dengan baik saya paham bahwa {F}', 'saya paham dengan baik bahwa {F}']))

DASAR_BARU = [
    dict(id='dh-akta-otentik', rujukan='Pasal 1868 KUHPerdata dan Pasal 285 RBg (akta otentik)',
         uraian='akta otentik adalah akta yang dibuat dalam bentuk yang ditentukan undang-undang oleh atau di hadapan pejabat umum yang berwenang, dan menjadi alat bukti surat yang sempurna',
         status='perlu-verifikasi',
         sumber='pengetahuan umum hukum acara perdata; bunyi pasal belum dicocokkan dengan naskah resmi KUHPerdata dan RBg (21 Okt 2026)'),
    dict(id='dh-adminduk-kematian', rujukan='Undang-Undang Nomor 23 Tahun 2006 tentang Administrasi Kependudukan sebagaimana telah diubah (bagian pencatatan kematian)',
         uraian='kematian dilaporkan kepada instansi pelaksana dan dicatat; penetapan pengadilan dimohonkan agar kematian yang belum tercatat dapat dicatat oleh Dinas Kependudukan dan Pencatatan Sipil',
         status='perlu-verifikasi',
         sumber='ringkasan hukum umum tanpa nomor pasal; bunyi, batas waktu pelaporan, dan kewenangan pengadilan agama untuk penetapan kematian belum dicocokkan dengan naskah resmi dan putusan sejenis (contoh perkara 648/Pdt.P/2019/PA.Dgl dari agen induk)'),
]

KEADAAN_BARU = {
    'jenisPermohonan': dict(sumber='borang', nilai=['umum', 'kematian', 'status-hukum', 'lain-lain'], bawaan='umum',
                            label='Jenis permohonan',
                            labelNilai={'umum': 'Permohonan umum (penetapan keadaan atau peristiwa)',
                                        'kematian': 'Penetapan kematian untuk pencatatan sipil',
                                        'status-hukum': 'Penetapan status atau kedudukan hukum',
                                        'lain-lain': 'Lain-lain'}),
    'jumlahPemohon': dict(sumber='borang', nilai=['satu', 'dua'], bawaan='satu', label='Jumlah pemohon',
                          labelNilai={'satu': 'Satu pemohon', 'dua': 'Dua pemohon (suami istri atau sesama ahli waris)'}),
    'kehadiranPemohon': dict(sumber='borang', nilai=['hadir', 'diwakili'], bawaan='hadir', label='Kehadiran pemohon di persidangan',
                             labelNilai={'hadir': 'Pemohon hadir sendiri', 'diwakili': 'Pemohon diwakili kuasa'}),
    'pengumuman': dict(sumber='borang', nilai=['tidak-ada', 'ada'], bawaan='tidak-ada', label='Pengumuman permohonan',
                       labelNilai={'tidak-ada': 'Tidak ada pengumuman', 'ada': 'Permohonan diumumkan'}),
}


def _pokok(id_, judul, uraian, dasar, keadaan=None):
    d = dict(id=id_, judul=judul, uraian=uraian, dasarHukum=dasar, wajib=False)
    if keadaan:
        d['keadaan'] = keadaan
    return d


SP, VO, KS, AO, AK = 'dh-sebab-pengetahuan', 'dh-permohonan-voluntair', 'dh-kesesuaian-saksi', 'dh-akta-otentik', 'dh-adminduk-kematian'
KM = {'jenisPermohonan': 'kematian'}

POKOK_BARU = [
    _pokok('pp-pu-identitas', 'Identitas pemohon', 'umur, pekerjaan, dan alamat pemohon', [VO], {'jumlahPemohon': 'satu'}),
    _pokok('pp-pu-domisili', 'Tempat tinggal pemohon dan wilayah pengadilan', 'pemohon bertempat tinggal di wilayah hukum pengadilan yang memeriksa', [VO]),
    _pokok('pp-pu-kepentingan', 'Kepentingan hukum pemohon', 'mengapa hal yang dimohonkan perlu ditetapkan pengadilan bagi pemohon', [VO]),
    _pokok('pp-pu-kedudukan', 'Kedudukan pemohon terhadap pokok permohonan', 'hubungan langsung pemohon dengan orang, benda, atau peristiwa yang dimohonkan', [VO]),
    _pokok('pp-pu-waktu-tempat', 'Waktu dan tempat peristiwa', 'kapan dan di mana peristiwa yang menjadi dasar permohonan terjadi', [SP]),
    _pokok('pp-pu-yang-hadir', 'Orang yang terlibat atau hadir pada peristiwa', 'siapa yang terlibat atau hadir pada peristiwa itu', [SP]),
    _pokok('pp-pu-bukti-surat', 'Bukti surat yang dimiliki pemohon', 'surat yang dimiliki pemohon untuk mendukung permohonan', [AO]),
    _pokok('pp-pu-keaslian', 'Keaslian surat dan kesesuaian identitas', 'surat asli dan diterbitkan pejabat berwenang, serta identitas pada KTP dan Kartu Keluarga sesuai permohonan', [AO, KS]),
    _pokok('pp-pu-sengketa', 'Ada atau tidaknya sengketa dan pihak lawan', 'permohonan voluntair tanpa sengketa dan tanpa pihak lawan', [VO]),
    _pokok('pp-pu-pihak-lain', 'Pihak lain yang berkepentingan dan sikapnya', 'pihak lain yang berkepentingan sudah mengetahui dan menyetujui atau berkeberatan', [VO]),
    _pokok('pp-pu-waktu-mohon', 'Alasan permohonan diajukan sekarang', 'mengapa hal itu baru dimohonkan penetapannya sekarang', [VO]),
    _pokok('pp-pu-akibat', 'Akibat bila tidak ditetapkan', 'akibat bagi pemohon bila permohonan tidak ditetapkan pengadilan', [VO]),
    _pokok('pp-pu-tujuan', 'Tujuan penggunaan penetapan', 'untuk keperluan apa dan di instansi mana penetapan dipakai', [VO]),
    _pokok('pp-pu-upaya-sebelum', 'Upaya sebelum ke pengadilan', 'pemohon lebih dahulu mengurus ke instansi lain dan jawaban yang diterimanya', [VO]),
    _pokok('pp-pu-dua-pemohon', 'Hubungan dan kesepakatan dua pemohon', 'hubungan antara dua pemohon dan kesepakatan mereka atas isi permohonan', [VO], {'jumlahPemohon': 'dua'}),
    _pokok('pp-pu-diwakili', 'Pemohon diwakili kuasa', 'alasan pemohon tidak hadir sendiri dan diwakili kuasa', [VO], {'kehadiranPemohon': 'diwakili'}),
    _pokok('pp-pu-pengumuman', 'Pengumuman permohonan', 'cara pengumuman permohonan dan tanggapan masyarakat', [VO], {'pengumuman': 'ada'}),
    _pokok('pp-pu-status', 'Status atau kedudukan hukum yang dimohonkan', 'status hukum yang dimohonkan ditetapkan dan perlakuan masyarakat terhadapnya', [VO], {'jenisPermohonan': 'status-hukum'}),
    _pokok('pp-pu-mati-peristiwa', 'Peristiwa kematian', 'tanggal, tempat, sebab meninggal, dan pemakaman', [SP, AK], KM),
    _pokok('pp-pu-mati-bukti', 'Surat keterangan kematian', 'surat keterangan kematian dari desa atau kelurahan dan penerbitnya', [AO, AK], KM),
    _pokok('pp-pu-mati-lambat', 'Alasan kematian baru dimohonkan sekarang', 'mengapa kematian tidak dilaporkan pada waktunya', [AK], KM),
    _pokok('pp-pu-mati-ahli-waris', 'Ahli waris yang ditinggalkan', 'ahli waris orang yang meninggal dan sikap mereka terhadap permohonan', [VO], KM),
    _pokok('pp-pu-mati-keperluan', 'Keperluan penetapan kematian dan pencatatannya', 'kematian belum tercatat dan penetapan dipakai untuk mencatatkannya', [AK], KM),
]

SPEC = []
MR = {}


def S(**kw):
    kw.setdefault('prefix', 'q-pu-')
    kw.setdefault('bentuk', ('pu',))
    kw.setdefault('fam', 'paham')
    kw.setdefault('kelompok', 'pokok')
    kw.setdefault('tingkat', 'pilihan')
    mr = kw.pop('mr', None)
    SPEC.append(kw)
    if mr:
        MR['q-pu-%s-pu' % kw['id']] = (kw['m'], mr[0], mr[1])


NK = {'bukan:jenisPermohonan': 'kematian'}

# ---- pemohon ------------------------------------------------------------------------------------------------------------
S(id='identitas', pokok='pp-pu-identitas', urut_abs=22, keadaan={'jumlahPemohon': 'satu'},
  teks='Berapa umur {PEM}, apa pekerjaannya, dan di mana alamatnya sekarang?',
  varian=['Apakah saksi mengetahui umur, pekerjaan, dan tempat tinggal {PEM}?'],
  hal='umur, pekerjaan, dan alamat pemohon', m='umur, pekerjaan, dan alamat {PEM}',
  K=(['{PEM} berumur #0099# dan bekerja sebagai #0100# serta bertempat tinggal di #0101#', '{PEM} sekarang berumur #0099# dengan pekerjaan #0100# dan beralamat di #0101#'],
     ['umur {PEM} adalah #0099# pekerjaannya #0100# dan ia tinggal di #0101#', '{PEM} berusia #0099# bekerja sebagai #0100# serta menetap di #0101#']),
  P=(['{PEM} bekerja sebagai #0100#', 'pekerjaan {PEM} adalah #0100#'],
     ['{PEM} mencari nafkah sebagai #0100#', '{PEM} sehari-hari bekerja sebagai #0100#']),
  A=['{PEM} bertempat tinggal di #0101# sampai sekarang', '{PEM} masih menetap di #0101# hingga kini'],
  B=['{PEM} sudah pindah dari alamat yang tertulis dalam permohonan', 'sekarang {PEM} sudah tinggal di tempat lain dari alamat dalam permohonan'],
  beda_pada='tempat', beda_maksud='versi A: masih tinggal di alamat dalam permohonan; versi B: sudah pindah - berselisih pada TEMPAT')

S(id='domisili', pokok='pp-pu-domisili', urut_abs=24, tingkat='jarang',
  teks='Apakah {PEM} masih bertempat tinggal di wilayah hukum pengadilan ini dan sudah berapa lama menetap di sana?',
  varian=['Sudah berapa lama {PEM} menetap, dan apakah tempat tinggalnya masih dalam wilayah hukum pengadilan ini?'],
  hal='tempat tinggal pemohon di wilayah hukum pengadilan', m='tempat tinggal {PEM} di wilayah hukum pengadilan',
  K=(['{PEM} menetap di #0101# yang termasuk wilayah hukum pengadilan ini', '{PEM} tinggal di #0101# dalam wilayah hukum pengadilan ini sudah cukup lama'],
     ['tempat tinggal {PEM} di #0101# berada dalam wilayah hukum pengadilan ini', '{PEM} berdomisili di #0101# yang masih dalam wilayah hukum pengadilan ini']),
  P=(['{PEM} tinggal di sekitar tempat tinggal saya', '{PEM} bertempat tinggal berdekatan dengan rumah saya'],
     ['{PEM} menetap di lingkungan yang sama dengan saya', 'rumah {PEM} berada di lingkungan tempat saya tinggal']),
  A=['{PEM} sudah menetap di #0101# sejak lama', 'sejak lama {PEM} tinggal di #0101#'],
  B=['{PEM} baru menetap di #0101# dalam waktu singkat', '{PEM} baru beberapa waktu tinggal di #0101#'],
  beda_pada='lama', beda_maksud='versi A: sudah menetap sejak lama; versi B: baru menetap dalam waktu singkat - berselisih pada LAMA')

S(id='kepentingan-hukum', pokok='pp-pu-kepentingan', urut_abs=32,
  teks='Apa kepentingan hukum {PEM} sehingga hal itu perlu ditetapkan oleh pengadilan?',
  varian=['Mengapa {PEM} memerlukan penetapan pengadilan atas hal yang dimohonkan?'],
  hal='kepentingan hukum pemohon atas hal yang dimohonkan', m='kepentingan hukum {PEM} atas hal yang dimohonkan',
  K=(['{PEM} berkepentingan agar #4930# ditetapkan oleh pengadilan demi kepastian hukum', '{PEM} memerlukan penetapan pengadilan atas #4930# supaya mempunyai kepastian hukum'],
     ['kepentingan hukum {PEM} adalah memperoleh penetapan pengadilan atas #4930#', 'agar mempunyai kekuatan hukum {PEM} memohon pengadilan menetapkan #4930#']),
  P=(['{PEM} ingin hal itu ditetapkan oleh pengadilan', '{PEM} memerlukan penetapan pengadilan'],
     ['{PEM} menginginkan kepastian hukum dari pengadilan', '{PEM} meminta pengadilan menetapkan hal itu']),
  A=['{PEM} berkepentingan langsung atas hal yang dimohonkan', 'hal yang dimohonkan menyangkut kepentingan {PEM} secara langsung'],
  B=['{PEM} mengajukan permohonan ini demi kepentingan orang lain', 'permohonan ini diajukan {PEM} untuk kepentingan pihak lain'],
  beda_pada='pelaku', beda_maksud='versi A: berkepentingan langsung; versi B: untuk kepentingan orang lain - berselisih pada PELAKU')

S(id='kedudukan-objek', pokok='pp-pu-kedudukan', urut_abs=34,
  teks='Apa hubungan {PEM} dengan orang, benda, atau peristiwa yang menjadi pokok permohonan ini?',
  varian=['Bagaimana kaitan {PEM} dengan pokok permohonan ini sehingga berhak mengajukannya?'],
  hal='hubungan pemohon dengan pokok permohonan', m='hubungan {PEM} dengan pokok permohonan',
  K=(['{PEM} berhubungan langsung dengan #4930# dan karena itu berhak mengajukan permohonan ini', '{PEM} adalah pihak yang bersangkutan dengan #4930# sehingga berhak memohon penetapan ini'],
     ['kedudukan {PEM} terhadap #4930# adalah pihak yang berhubungan langsung dan berhak mengajukan permohonan', '{PEM} adalah orang yang berkaitan langsung dengan #4930# dan berhak memohon penetapan']),
  P=(['{PEM} berhubungan dengan hal yang dimohonkan', '{PEM} ada kaitannya dengan pokok permohonan ini'],
     ['{PEM} bersangkutan dengan pokok permohonan ini', '{PEM} termasuk pihak yang terkait dengan permohonan ini']),
  A=['{PEM} berhubungan langsung dengan hal yang dimohonkan', 'hal yang dimohonkan bersangkut paut langsung dengan {PEM}'],
  B=['{PEM} hanya membantu mengurus hal yang dimohonkan untuk orang lain', '{PEM} sekadar mewakili orang lain dalam mengurus hal yang dimohonkan'],
  beda_pada='pelaku', beda_maksud='versi A: berhubungan langsung dengan pokok permohonan; versi B: hanya membantu orang lain - berselisih pada PELAKU')

# ---- status hukum -------------------------------------------------------------------------------------------------------------
S(id='status-dimohon', pokok='pp-pu-status', urut_abs=35, keadaan={'jenisPermohonan': 'status-hukum'},
  teks='Status atau kedudukan hukum apa yang dimohonkan {PEM} untuk ditetapkan?',
  varian=['Apa yang diminta {PEM} kepada pengadilan mengenai status atau kedudukan hukumnya?'],
  hal='status atau kedudukan hukum yang dimohonkan ditetapkan', m='status atau kedudukan hukum yang dimohonkan {PEM}',
  K=(['status atau kedudukan hukum yang dimohonkan {PEM} untuk ditetapkan adalah #4930#', '{PEM} memohon pengadilan menetapkan #4930# sebagai status atau kedudukan hukumnya'],
     ['yang dimohonkan {PEM} berupa penetapan status hukum yaitu #4930#', 'pokok permohonan {PEM} mengenai status hukum adalah #4930#']),
  P=(['{PEM} memohon penetapan status hukum', '{PEM} meminta pengadilan menetapkan kedudukan hukumnya'],
     ['permohonan {PEM} menyangkut status hukum', '{PEM} ingin kedudukan hukumnya ditetapkan']),
  A=['{PEM} memohon penetapan status hukum yang sesuai dengan keadaannya sehari-hari', '{PEM} meminta kedudukan hukumnya ditetapkan sesuai keadaan sehari-hari'],
  B=['{PEM} memohon penetapan status hukum yang berbeda dari keadaannya sehari-hari', '{PEM} meminta kedudukan hukumnya ditetapkan lain dari keadaan sehari-hari'],
  beda_pada='peristiwa', beda_maksud='versi A: status sesuai keadaan sehari-hari; versi B: berbeda dari keadaan sehari-hari - berselisih pada PERISTIWA')

S(id='status-dikenal', pokok='pp-pu-status', urut_abs=37, keadaan={'jenisPermohonan': 'status-hukum'},
  teks='Bagaimana status {PEM} itu selama ini diperlakukan oleh masyarakat dan instansi?',
  varian=['Selama ini, bagaimana masyarakat dan instansi memperlakukan status {PEM} yang dimohonkan?'],
  hal='perlakuan masyarakat dan instansi terhadap status pemohon', m='perlakuan masyarakat dan instansi terhadap status {PEM}',
  K=(['selama ini masyarakat mengenal {PEM} dengan status yang dimohonkan tetapi catatan resmi instansi belum sesuai', 'dalam pergaulan sehari-hari {PEM} dikenal dengan status yang dimohonkan namun catatan instansi belum menyesuaikan'],
     ['warga mengenal {PEM} dengan status itu sedangkan catatan resmi belum mencerminkannya', 'masyarakat sudah menerima status {PEM} yang dimohonkan padahal catatan resmi belum sesuai']),
  P=(['masyarakat mengenal {PEM} dengan status yang dimohonkan', 'warga mengenal {PEM} dengan status itu'],
     ['dalam pergaulan {PEM} dikenal dengan status itu', '{PEM} diterima masyarakat dengan status yang dimohonkan']),
  A=['masyarakat mengenal {PEM} dengan status yang dimohonkan sejak lama', 'sejak lama warga mengenal {PEM} dengan status yang dimohonkan'],
  B=['masyarakat baru mengenal {PEM} dengan status yang dimohonkan belakangan ini', 'warga baru mengenal {PEM} dengan status itu belakangan'],
  beda_pada='waktu', beda_maksud='versi A: dikenal dengan status itu sejak lama; versi B: baru belakangan - berselisih pada WAKTU')

# ---- dua pemohon ---------------------------------------------------------------------------------------------------------------
S(id='dua-hubungan', pokok='pp-pu-dua-pemohon', urut_abs=36, keadaan={'jumlahPemohon': 'dua'},
  teks='Apa hubungan antara {PEM} dan mengapa mereka mengajukan permohonan ini bersama-sama?',
  varian=['Mengapa {PEM} mengajukan permohonan ini bersama-sama dan apa hubungan di antara mereka?'],
  hal='hubungan para pemohon dan alasan mengajukan permohonan bersama', m='hubungan {PEM} dan alasan mereka mengajukan permohonan bersama',
  K=(['{PEM} mempunyai hubungan keluarga dan kepentingan yang sama sehingga mengajukan permohonan ini bersama-sama', 'karena kepentingan dan hubungan keluarganya sama {PEM} mengajukan permohonan ini bersama'],
     ['{PEM} bertalian keluarga dan sama-sama berkepentingan sehingga memohon bersama', 'kedekatan keluarga dan kepentingan yang sama membuat {PEM} mengajukan permohonan ini bersama-sama']),
  P=(['{PEM} masih berhubungan keluarga', '{PEM} bertalian keluarga satu sama lain'],
     ['{PEM} termasuk satu keluarga', '{PEM} adalah keluarga dekat']),
  A=['{PEM} adalah suami istri yang sama-sama berkepentingan', '{PEM} merupakan pasangan suami istri yang sama-sama berkepentingan'],
  B=['{PEM} adalah saudara kandung yang sama-sama berkepentingan', '{PEM} merupakan kakak beradik yang sama-sama berkepentingan'],
  beda_pada='pelaku', beda_maksud='versi A: suami istri; versi B: saudara kandung - berselisih pada PELAKU (hubungan)')

S(id='dua-sepakat', pokok='pp-pu-dua-pemohon', urut_abs=38, keadaan={'jumlahPemohon': 'dua'},
  teks='Apakah {PEM} sepakat atas isi permohonan ini dan sama-sama menghendakinya?',
  varian=['Apakah {PEM} satu pendapat mengenai isi permohonan ini?'],
  hal='kesepakatan para pemohon atas isi permohonan', m='kesepakatan {PEM} atas isi permohonan',
  K=(['{PEM} sepakat atas isi permohonan ini dan sama-sama menghendakinya', '{PEM} sama-sama setuju dengan isi permohonan ini'],
     ['isi permohonan ini disepakati oleh {PEM} dan dikehendaki bersama', '{PEM} satu suara mengenai isi permohonan ini']),
  P=(['{PEM} sepakat mengajukan permohonan ini', '{PEM} sama-sama mengajukan permohonan ini'],
     ['{PEM} bersama-sama datang mengajukan permohonan ini', '{PEM} satu tujuan dalam permohonan ini']),
  A=['{PEM} sepakat atas seluruh isi permohonan ini', '{PEM} setuju pada seluruh isi permohonan ini'],
  B=['{PEM} sepakat hanya pada sebagian isi permohonan ini', '{PEM} setuju hanya pada sebagian isi permohonan'],
  beda_pada='jumlah', beda_maksud='versi A: sepakat pada seluruh isi; versi B: hanya pada sebagian - berselisih pada JUMLAH',
  mr=(['saya mendengar sendiri {PEM} menyatakan sepakat atas isi permohonan ini',
       'saya mendengar langsung {PEM} mengatakan sama-sama menghendaki permohonan ini',
       'saat itu saya berada di dekat mereka dan mendengar {PEM} berkata setuju atas isi permohonan ini',
       'kesepakatan {PEM} atas isi permohonan ini saya dengar sendiri'],
      ['ucapan sepakat dari {PEM} atas isi permohonan ini terdengar oleh saya',
       'di hadapan saya {PEM} berkata sama-sama menghendaki permohonan ini',
       'saya mendengar {PEM} mengatakan setuju atas isi permohonan ini',
       'perkataan {PEM} yang menyatakan sepakat atas permohonan ini terdengar di hadapan saya']))

# ---- kronologi -----------------------------------------------------------------------------------------------------------------
S(id='waktu-tempat', pokok='pp-pu-waktu-tempat', urut_abs=42, fam='hadir', keadaan=NK,
  teks='Kapan dan di mana peristiwa yang menjadi dasar permohonan ini terjadi?',
  varian=['Pada waktu dan di tempat mana peristiwa yang menjadi dasar permohonan ini berlangsung?'],
  hal='waktu dan tempat peristiwa yang menjadi dasar permohonan', m='waktu dan tempat peristiwa yang menjadi dasar permohonan',
  K=(['peristiwa yang menjadi dasar permohonan ini terjadi #4931#', 'dasar permohonan ini berasal dari peristiwa yang terjadi #4931#'],
     ['waktu dan tempat peristiwa yang menjadi dasar permohonan ini adalah #4931#', 'peristiwa itu berlangsung #4931#']),
  P=(['peristiwa itu terjadi beberapa tahun yang lalu', 'peristiwa itu sudah lama terjadi'],
     ['peristiwa itu terjadi cukup lama yang lalu', 'peristiwa itu terjadi sudah beberapa waktu lalu']),
  A=['peristiwa itu terjadi #4931#', 'peristiwa tersebut berlangsung #4931#'],
  B=['peristiwa itu terjadi pada waktu yang berbeda dari yang tertulis dalam permohonan', 'peristiwa itu berlangsung di tempat lain dari yang tertulis dalam permohonan'],
  beda_pada='waktu', beda_maksud='versi A: sesuai waktu dan tempat dalam permohonan; versi B: berbeda dari permohonan - berselisih pada WAKTU')

S(id='yang-hadir', pokok='pp-pu-yang-hadir', urut_abs=44, fam='hadir',
  teks='Siapa saja yang terlibat atau hadir pada peristiwa itu dan apakah {PEM} termasuk di dalamnya?',
  varian=['Apakah {PEM} ikut hadir pada peristiwa itu, dan siapa lagi yang hadir?'],
  hal='orang yang terlibat atau hadir pada peristiwa', m='orang yang terlibat atau hadir pada peristiwa, termasuk {PEM}',
  K=(['{PEM} hadir pada peristiwa itu bersama keluarga dan tetangga termasuk ... yang saya kenal', 'pada peristiwa itu {PEM} berada bersama keluarga dan tetangga termasuk ... yang saya kenal'],
     ['{PEM} termasuk yang hadir pada peristiwa itu bersama keluarga dan tetangga di antaranya ... yang saya kenal', 'yang hadir pada peristiwa itu adalah {PEM} bersama keluarga dan tetangga termasuk ... yang saya kenal']),
  P=(['{PEM} hadir pada peristiwa itu', '{PEM} ikut hadir ketika peristiwa itu terjadi'],
     ['{PEM} berada di tempat peristiwa itu', '{PEM} termasuk yang hadir saat peristiwa itu']),
  A=['{PEM} hadir sendiri pada peristiwa itu', '{PEM} ikut hadir secara langsung pada peristiwa itu'],
  B=['{PEM} sedang berada di tempat lain ketika peristiwa itu terjadi', '{PEM} berada di luar daerah pada saat peristiwa itu terjadi'],
  beda_pada='tempat', beda_maksud='versi A: pemohon hadir pada peristiwa; versi B: pemohon berada di tempat lain - berselisih pada TEMPAT')

# ---- bukti surat ---------------------------------------------------------------------------------------------------------------
S(id='bukti-surat', pokok='pp-pu-bukti-surat', urut_abs=52, keadaan=NK,
  teks='Surat apa saja yang dimiliki {PEM} untuk mendukung permohonannya, seperti akta, surat keterangan, KTP, atau Kartu Keluarga?',
  varian=['Dokumen apa yang disimpan {PEM} untuk menguatkan permohonannya, misalnya akta, surat keterangan, KTP, atau Kartu Keluarga?'],
  hal='surat yang dimiliki pemohon untuk mendukung permohonan', m='surat yang dimiliki {PEM} untuk mendukung permohonan',
  K=(['surat yang dimiliki {PEM} untuk mendukung permohonannya adalah #4932#', '{PEM} memegang surat berupa #4932# sebagai pendukung permohonannya'],
     ['bukti tertulis milik {PEM} yang mendukung permohonannya yaitu #4932#', 'dokumen yang disimpan {PEM} untuk menguatkan permohonannya berupa #4932#']),
  P=(['{PEM} memiliki surat yang mendukung permohonannya', '{PEM} menyimpan dokumen untuk permohonannya'],
     ['{PEM} mempunyai bukti tertulis untuk permohonannya', '{PEM} memegang dokumen yang berkaitan dengan permohonannya']),
  A=['{PEM} memiliki surat yang diperlukan untuk permohonannya', '{PEM} sudah mempunyai surat-surat yang dibutuhkan untuk permohonannya'],
  B=['{PEM} baru memiliki sebagian dari surat yang dibutuhkan', '{PEM} baru mempunyai sebagian surat yang dibutuhkan'],
  beda_pada='jumlah', beda_maksud='versi A: surat yang dibutuhkan lengkap; versi B: baru sebagian - berselisih pada JUMLAH')

S(id='keaslian-surat', pokok='pp-pu-keaslian', urut_abs=54, tingkat='tambahan',
  teks='Apakah surat-surat milik {PEM} itu asli dan diterbitkan oleh pejabat atau instansi yang berwenang?',
  varian=['Apakah surat yang dipegang {PEM} asli dan dikeluarkan oleh instansi yang berwenang?'],
  hal='keaslian surat dan kewenangan penerbitnya', m='keaslian surat milik {PEM} dan kewenangan penerbitnya',
  K=(['surat-surat milik {PEM} yaitu #4932# adalah asli dan diterbitkan oleh pejabat yang berwenang', '#4932# yang dimiliki {PEM} asli dan dikeluarkan oleh instansi yang berwenang'],
     ['surat berupa #4932# milik {PEM} diterbitkan oleh pejabat yang berwenang dan merupakan surat yang asli', 'dokumen #4932# milik {PEM} dikeluarkan oleh instansi berwenang dan keasliannya terjamin']),
  P=(['surat-surat milik {PEM} tampak asli', 'surat yang dipegang {PEM} kelihatan asli'],
     ['dokumen milik {PEM} terlihat asli', 'surat {PEM} sepintas asli']),
  A=['surat-surat milik {PEM} asli dan diterbitkan oleh instansi yang berwenang', 'surat milik {PEM} dikeluarkan oleh instansi yang berwenang dan asli'],
  B=['surat milik {PEM} berupa salinan dan aslinya disimpan oleh instansi penerbit', 'dokumen {PEM} hanya fotokopi sedangkan aslinya ada pada instansi penerbit'],
  beda_pada='peristiwa', beda_maksud='versi A: surat asli; versi B: hanya salinan atau fotokopi - berselisih pada PERISTIWA')

S(id='identitas-sesuai', pokok='pp-pu-keaslian', urut_abs=56, tingkat='tambahan',
  teks='Apakah nama dan data {PEM} pada KTP dan Kartu Keluarga sudah sama dengan yang tertulis dalam permohonan?',
  varian=['Apakah identitas {PEM} dalam KTP dan Kartu Keluarga cocok dengan yang tertulis dalam permohonan?'],
  hal='kesesuaian nama dan data pemohon pada KTP dan Kartu Keluarga', m='kesesuaian nama dan data {PEM} pada KTP dan Kartu Keluarga',
  K=(['nama dan data {PEM} pada KTP dan Kartu Keluarga sama dengan yang tertulis dalam permohonan', 'data diri {PEM} pada KTP serta Kartu Keluarga sesuai dengan permohonan'],
     ['isi KTP dan Kartu Keluarga {PEM} memuat nama dan data yang sama dengan permohonan', 'identitas {PEM} dalam KTP dan Kartu Keluarga cocok dengan yang tertulis dalam permohonan']),
  P=(['nama {PEM} pada KTP sama dengan yang tertulis dalam permohonan', 'nama {PEM} pada Kartu Keluarga sesuai dengan permohonan'],
     ['nama {PEM} dalam KTP cocok dengan permohonan', 'nama {PEM} dalam Kartu Keluarga sama dengan permohonan']),
  A=['nama dan data {PEM} pada KTP dan Kartu Keluarga sama', 'data diri {PEM} pada KTP dan Kartu Keluarga sesuai'],
  B=['ada perbedaan penulisan nama {PEM} pada KTP dan Kartu Keluarga', 'penulisan nama {PEM} pada KTP berbeda dari Kartu Keluarga'],
  beda_pada='peristiwa', beda_maksud='versi A: nama dan data sama; versi B: ada perbedaan penulisan - berselisih pada PERISTIWA')

# ---- sengketa, pihak lain, alasan, akibat, tujuan ------------------------------------------------------------------------------
S(id='sengketa', pokok='pp-pu-sengketa', urut_abs=62,
  teks='Apakah ada sengketa atau perselisihan antara {PEM} dan pihak lain mengenai hal yang dimohonkan ini, dan siapa pihak lawannya?',
  varian=['Adakah orang yang bersengketa dengan {PEM} mengenai hal yang dimohonkan, atau pihak lawan dalam perkara ini?'],
  hal='sengketa atau pihak lawan atas hal yang dimohonkan', m='ada atau tidaknya sengketa dan pihak lawan atas hal yang dimohonkan {PEM}',
  K=(['hal yang dimohonkan {PEM} bebas dari sengketa dan tanpa pihak lawan', '{PEM} tidak sedang bersengketa dengan siapa pun atas hal yang dimohonkan'],
     ['atas hal yang dimohonkan {PEM} tidak ada perselisihan dengan pihak mana pun', 'perkara ini bersifat sepihak sehingga tidak ada yang bersengketa dengan {PEM}']),
  P=(['{PEM} tidak bersengketa dengan keluarganya mengenai hal itu', '{PEM} tidak berselisih dengan tetangganya mengenai hal itu'],
     ['{PEM} tidak berselisih dengan pihak keluarga mengenai hal itu', '{PEM} tidak bersengketa dengan orang di lingkungannya soal hal itu']),
  A=['tidak ada sengketa mengenai hal yang dimohonkan {PEM}', 'hal yang dimohonkan {PEM} tidak disengketakan oleh siapa pun'],
  B=['ada pihak yang mempersoalkan hal yang dimohonkan {PEM}', 'seseorang pernah mempersoalkan hal yang dimohonkan {PEM}'],
  beda_pada='peristiwa', beda_maksud='versi A: tidak ada sengketa; versi B: ada yang mempersoalkan - berselisih pada PERISTIWA')

S(id='pihak-lain', pokok='pp-pu-pihak-lain', urut_abs=64,
  teks='Siapa pihak lain yang berkepentingan atas hal ini dan apakah mereka sudah mengetahui permohonan {PEM}?',
  varian=['Apakah keluarga dan pihak lain yang berkepentingan sudah tahu bahwa {PEM} mengajukan permohonan ini?'],
  hal='pihak lain yang berkepentingan dan pengetahuan mereka atas permohonan', m='pihak lain yang berkepentingan dan pengetahuan mereka atas permohonan {PEM}',
  K=(['keluarga dan pihak lain yang berkepentingan sudah mengetahui permohonan {PEM}', 'pihak-pihak lain yang berkaitan dengan hal ini telah mengetahui permohonan {PEM}'],
     ['orang-orang yang berkepentingan atas hal ini sudah tahu tentang permohonan {PEM}', 'keluarga serta pihak yang bersangkutan paham bahwa {PEM} mengajukan permohonan ini']),
  P=(['keluarga {PEM} sudah mengetahui permohonan ini', 'keluarga dekat {PEM} tahu tentang permohonan ini'],
     ['sebagian keluarga {PEM} mengetahui permohonan ini', 'keluarga {PEM} yang saya kenal sudah tahu permohonan ini']),
  A=['semua pihak yang berkepentingan sudah mengetahui permohonan {PEM}', 'seluruh pihak yang bersangkutan telah mengetahui permohonan {PEM}'],
  B=['hanya sebagian pihak yang berkepentingan mengetahui permohonan {PEM}', 'baru sebagian pihak yang bersangkutan yang tahu tentang permohonan {PEM}'],
  beda_pada='jumlah', beda_maksud='versi A: semua pihak berkepentingan sudah tahu; versi B: baru sebagian - berselisih pada JUMLAH')

S(id='persetujuan', pokok='pp-pu-pihak-lain', urut_abs=66,
  teks='Apakah pihak yang berkepentingan itu menyetujui permohonan {PEM} dan adakah yang keberatan?',
  varian=['Bagaimana sikap pihak yang berkepentingan terhadap permohonan {PEM}, setuju atau berkeberatan?'],
  hal='persetujuan atau keberatan pihak yang berkepentingan', m='persetujuan atau keberatan pihak yang berkepentingan atas permohonan {PEM}',
  K=(['pihak yang berkepentingan menyetujui permohonan {PEM} dan tidak ada yang berkeberatan', 'semua pihak yang bersangkutan setuju dengan permohonan {PEM} dan tidak ada yang menolak'],
     ['permohonan {PEM} disetujui oleh pihak yang berkepentingan dan tidak ada yang menyatakan keberatan', 'pihak yang bersangkutan mendukung permohonan {PEM} dan tidak seorang pun menolaknya']),
  P=(['sebagian pihak yang berkepentingan menyetujui permohonan {PEM}', 'keluarga {PEM} yang saya kenal setuju dengan permohonan ini'],
     ['sebagian pihak yang bersangkutan mendukung permohonan {PEM}', 'keluarga {PEM} yang saya temui setuju dengan permohonan ini']),
  A=['pihak yang berkepentingan tidak ada yang berkeberatan atas permohonan {PEM}', 'tidak ada pihak berkepentingan yang menolak permohonan {PEM}'],
  B=['ada pihak berkepentingan yang berkeberatan atas permohonan {PEM}', 'seorang pihak berkepentingan menolak permohonan {PEM}'],
  beda_pada='pelaku', beda_maksud='versi A: tidak ada yang berkeberatan; versi B: ada yang berkeberatan - berselisih pada PELAKU',
  mr=(['saya mendengar sendiri pihak yang berkepentingan menyatakan setuju dengan permohonan {PEM}',
       'saya mendengar langsung pihak yang bersangkutan mengatakan mendukung permohonan {PEM}',
       'saat itu saya berada di dekat mereka dan mendengar pihak berkepentingan berkata setuju atas permohonan {PEM}',
       'persetujuan pihak yang berkepentingan atas permohonan {PEM} saya dengar sendiri'],
      ['ucapan setuju dari pihak yang berkepentingan atas permohonan {PEM} terdengar oleh saya',
       'di hadapan saya pihak yang bersangkutan berkata mendukung permohonan {PEM}',
       'saya mendengar pihak berkepentingan mengatakan menyetujui permohonan {PEM}',
       'perkataan setuju pihak yang berkepentingan atas permohonan {PEM} terdengar di hadapan saya']))

S(id='alasan-baru', pokok='pp-pu-waktu-mohon', urut_abs=72, keadaan=NK, kelompok='akibat',
  teks='Mengapa hal ini baru dimohonkan penetapannya sekarang dan tidak sejak dahulu?',
  varian=['Apa sebabnya permohonan ini baru diajukan pada saat ini dan tidak dari dahulu?'],
  hal='alasan permohonan baru diajukan sekarang', m='alasan permohonan baru diajukan sekarang',
  K=(['permohonan baru diajukan sekarang karena penetapan atas #4930# baru diperlukan untuk #4933#', 'permohonan ini baru diajukan sekarang sebab penetapan atas #4930# baru dibutuhkan untuk #4933#'],
     ['hal itu baru dimohonkan sekarang karena kebutuhan akan #4933# baru muncul terkait #4930#', 'alasan permohonan ini diajukan sekarang adalah penetapan atas #4930# baru diperlukan untuk #4933#']),
  P=(['permohonan ini baru diajukan setelah penetapan itu dibutuhkan', 'penetapan itu baru diperlukan belakangan ini'],
     ['permohonan ini diajukan setelah ada keperluan yang mendesak', 'keperluan atas penetapan itu baru muncul belakangan']),
  A=['permohonan ini baru diajukan karena keperluan baru muncul belakangan ini', 'keperluan atas penetapan baru muncul belakangan sehingga permohonan baru diajukan'],
  B=['permohonan ini sebenarnya sudah lama direncanakan tetapi baru sempat diajukan', 'pemohon sudah lama berniat memohon tetapi baru sekarang sempat mengajukan'],
  beda_pada='penyebab', beda_maksud='versi A: keperluan baru muncul belakangan; versi B: sudah lama direncanakan tetapi baru sempat - berselisih pada PENYEBAB')

S(id='akibat', pokok='pp-pu-akibat', urut_abs=82, kelompok='akibat',
  teks='Apa akibatnya bagi {PEM} apabila permohonan ini tidak ditetapkan oleh pengadilan?',
  varian=['Apa yang akan dialami {PEM} bila pengadilan tidak menetapkan permohonan ini?'],
  hal='akibat bagi pemohon bila permohonan tidak ditetapkan', m='akibat bagi {PEM} bila permohonan tidak ditetapkan',
  K=(['tanpa penetapan pengadilan {PEM} terhambat mengurus #4933# dan kepastian hukumnya tetap terkatung-katung', 'jika permohonan ini tidak ditetapkan {PEM} terhambat mengurus #4933#'],
     ['akibat tidak adanya penetapan {PEM} terhalang mengurus #4933#', 'tanpa penetapan itu urusan {PEM} mengenai #4933# terhenti']),
  P=(['tanpa penetapan itu urusan {PEM} akan terhambat', 'urusan {PEM} terhambat tanpa penetapan pengadilan'],
     ['{PEM} akan sulit mengurus keperluannya tanpa penetapan itu', 'tanpa penetapan pengadilan {PEM} sulit mengurus keperluannya']),
  A=['tanpa penetapan pengadilan {PEM} terhambat mengurus keperluannya', 'jika tidak ditetapkan {PEM} terhambat mengurus keperluannya'],
  B=['{PEM} masih bisa mengurus keperluannya dengan cara lain', '{PEM} masih dapat menempuh jalan lain untuk mengurus keperluannya'],
  beda_pada='peristiwa', beda_maksud='versi A: urusan pemohon terhambat tanpa penetapan; versi B: masih bisa lewat cara lain - berselisih pada PERISTIWA')

S(id='tujuan-instansi', pokok='pp-pu-tujuan', urut_abs=84, kelompok='akibat', keadaan=NK,
  teks='Untuk keperluan apa dan di instansi mana penetapan ini akan dipakai oleh {PEM}?',
  varian=['Penetapan ini hendak dipakai {PEM} untuk apa dan diserahkan kepada instansi mana?'],
  hal='keperluan dan instansi tujuan penggunaan penetapan', m='keperluan dan instansi tujuan penggunaan penetapan oleh {PEM}',
  K=(['penetapan ini akan dipakai {PEM} untuk #4933#', '{PEM} akan menggunakan penetapan ini guna #4933#'],
     ['keperluan {PEM} atas penetapan ini adalah #4933#', 'penetapan yang dimohonkan {PEM} diperlukan untuk #4933#']),
  P=(['{PEM} akan memakai penetapan ini untuk mengurus keperluannya ke suatu instansi', 'penetapan ini akan {PEM} bawa ke instansi untuk keperluannya'],
     ['{PEM} hendak mengurus keperluannya ke instansi dengan penetapan ini', 'penetapan ini {PEM} perlukan untuk urusan pada suatu instansi']),
  A=['penetapan ini akan dipakai {PEM} untuk mengurus keperluannya pada instansi pemerintah', '{PEM} memerlukan penetapan ini di instansi pemerintah'],
  B=['penetapan ini akan dipakai {PEM} di lembaga swasta', '{PEM} membutuhkan penetapan ini pada lembaga swasta'],
  beda_pada='tempat', beda_maksud='versi A: dipakai di instansi pemerintah; versi B: di lembaga swasta - berselisih pada TEMPAT')

S(id='upaya-sebelum', pokok='pp-pu-upaya-sebelum', urut_abs=86, kelompok='upaya', tingkat='tambahan',
  teks='Apakah {PEM} sudah lebih dahulu mengurus hal ini ke instansi lain dan apa jawaban yang diterimanya?',
  varian=['Sebelum ke pengadilan, apakah {PEM} sudah mengurus hal ini ke instansi yang berwenang, dan bagaimana tanggapannya?'],
  hal='upaya pemohon mengurus hal ini ke instansi sebelum ke pengadilan', m='upaya {PEM} mengurus hal ini ke instansi sebelum ke pengadilan',
  K=(['sebelum ke pengadilan {PEM} sudah mengurusnya ke instansi yang berwenang tetapi diminta menempuh penetapan pengadilan', '{PEM} telah lebih dahulu mengurus hal ini ke instansi yang berwenang lalu diarahkan memohon penetapan pengadilan'],
     ['{PEM} sudah datang ke instansi yang berwenang dan diminta membawa penetapan pengadilan', 'pengurusan awal {PEM} di instansi yang berwenang berakhir dengan arahan untuk memohon penetapan pengadilan']),
  P=(['{PEM} sudah mengurus hal ini ke instansi yang berwenang', '{PEM} pernah datang ke instansi untuk mengurusnya'],
     ['{PEM} lebih dahulu mengurus hal ini di instansi', '{PEM} sudah menanyakan hal ini kepada instansi yang berwenang']),
  A=['{PEM} diminta menempuh penetapan pengadilan oleh instansi yang didatanginya', 'instansi yang didatangi {PEM} meminta penetapan pengadilan'],
  B=['{PEM} diminta melengkapi surat tertentu oleh instansi yang didatanginya', 'instansi yang didatangi {PEM} meminta tambahan surat'],
  beda_pada='peristiwa', beda_maksud='versi A: diminta menempuh penetapan pengadilan; versi B: diminta melengkapi surat - berselisih pada PERISTIWA')

# ---- diwakili, pengumuman ------------------------------------------------------------------------------------------------------
S(id='diwakili-kuasa', pokok='pp-pu-diwakili', urut_abs=92, keadaan={'kehadiranPemohon': 'diwakili'}, tingkat='tambahan',
  teks='Apakah saksi mengetahui mengapa {PEM} tidak hadir sendiri dan mengurus permohonan ini melalui kuasanya?',
  varian=['Apa sebabnya {PEM} diwakili oleh kuasa dalam mengurus permohonan ini?'],
  hal='sebab pemohon diwakili kuasa pada pengurusan permohonan', m='sebab {PEM} diwakili kuasa',
  K=(['{PEM} berhalangan hadir sendiri sehingga mengurus permohonan ini melalui kuasanya', '{PEM} berhalangan hadir sendiri lalu menunjuk kuasa untuk mengurus permohonan ini'],
     ['karena berhalangan {PEM} menguasakan pengurusan permohonan ini kepada orang lain', 'pengurusan permohonan ini diserahkan {PEM} kepada kuasanya karena ia berhalangan hadir']),
  P=(['{PEM} berhalangan hadir sendiri', '{PEM} menunjuk kuasa untuk mengurus permohonan ini'],
     ['{PEM} diwakili orang lain dalam permohonan ini', '{PEM} menguasakan permohonan ini kepada orang lain']),
  A=['{PEM} berhalangan hadir karena sakit', 'karena sakit {PEM} berhalangan hadir sendiri'],
  B=['{PEM} berhalangan hadir karena berada di luar daerah', '{PEM} berada di perantauan sehingga berhalangan hadir'],
  beda_pada='penyebab', beda_maksud='versi A: berhalangan karena sakit; versi B: berada di luar daerah - berselisih pada PENYEBAB')

S(id='pengumuman', pokok='pp-pu-pengumuman', urut_abs=94, keadaan={'pengumuman': 'ada'}, kelompok='upaya', tingkat='tambahan',
  teks='Bagaimana permohonan ini diumumkan kepada masyarakat dan apakah ada tanggapan setelahnya?',
  varian=['Dengan cara apa permohonan ini diumumkan, dan adakah tanggapan dari masyarakat sesudahnya?'],
  hal='pengumuman permohonan kepada masyarakat dan tanggapannya', m='pengumuman permohonan kepada masyarakat dan tanggapannya',
  K=(['permohonan ini sudah diumumkan di tempat umum dan sampai sekarang tidak ada tanggapan dari masyarakat', 'pengumuman permohonan ini telah dipasang di tempat umum dan tidak ada yang menanggapi'],
     ['pengumuman permohonan ini sudah disampaikan kepada masyarakat di tempat umum dan tidak ada tanggapan masuk', 'permohonan ini diumumkan secara terbuka kepada masyarakat dan tidak seorang pun menanggapinya']),
  P=(['permohonan ini sudah diumumkan di tempat umum', 'pengumuman permohonan ini sudah dipasang'],
     ['permohonan ini telah diumumkan kepada masyarakat', 'pengumuman permohonan ini sudah ditempel di tempat umum']),
  A=['tidak ada tanggapan masyarakat setelah permohonan diumumkan', 'setelah pengumuman tidak ada yang menanggapi permohonan ini'],
  B=['ada tanggapan dari masyarakat setelah permohonan diumumkan', 'setelah pengumuman ada yang menanggapi permohonan ini'],
  beda_pada='peristiwa', beda_maksud='versi A: tidak ada tanggapan masyarakat; versi B: ada tanggapan - berselisih pada PERISTIWA')

# ---- penetapan kematian (jenisPermohonan = kematian) -----------------------------------------------------------------------------
S(id='mati-tanggal-tempat', pokok='pp-pu-mati-peristiwa', urut_abs=110, fam='hadir', keadaan=KM, tingkat='inti',
  teks='Kapan dan di mana orang yang dimohonkan penetapan kematiannya meninggal dunia?',
  varian=['Pada tanggal berapa dan di mana orang yang dimohonkan itu meninggal dunia?'],
  hal='tanggal dan tempat meninggalnya orang yang dimohonkan', m='tanggal dan tempat meninggalnya orang yang dimohonkan',
  K=(['orang yang dimohonkan penetapan kematiannya meninggal dunia #4931#', 'kematian orang yang dimohonkan terjadi #4931#'],
     ['peristiwa meninggalnya orang yang dimohonkan itu terjadi #4931#', 'orang yang dimohonkan itu wafat #4931#']),
  P=(['orang yang dimohonkan itu sudah meninggal dunia', 'kematian orang yang dimohonkan sudah lama terjadi'],
     ['orang yang dimohonkan itu telah wafat', 'orang yang dimohonkan itu sudah lama meninggal']),
  A=['orang yang dimohonkan meninggal dunia #4931#', 'kematian orang yang dimohonkan terjadi #4931#'],
  B=['orang yang dimohonkan meninggal dunia pada waktu yang berbeda dari yang tertulis dalam permohonan', 'kematian orang yang dimohonkan terjadi di tempat yang berbeda dari yang tertulis dalam permohonan'],
  beda_pada='waktu', beda_maksud='versi A: sesuai tanggal dan tempat dalam permohonan; versi B: berbeda dari permohonan - berselisih pada WAKTU')

S(id='mati-sebab-makam', pokok='pp-pu-mati-peristiwa', urut_abs=112, keadaan=KM,
  teks='Apa sebab meninggalnya orang yang dimohonkan itu dan di mana jenazahnya dimakamkan?',
  varian=['Karena apa orang yang dimohonkan itu meninggal, dan di mana ia dimakamkan?'],
  hal='sebab meninggal dan tempat dimakamkan', m='sebab meninggal dan tempat dimakamkan orang yang dimohonkan',
  K=(['sebab meninggal orang yang dimohonkan dan pemakamannya adalah #4934#', 'orang yang dimohonkan itu meninggal dan dimakamkan sebagaimana #4934#'],
     ['keadaan meninggal serta pemakaman orang yang dimohonkan yaitu #4934#', 'sebab kematian dan lokasi pemakaman orang yang dimohonkan ialah #4934#']),
  P=(['orang yang dimohonkan sudah dimakamkan secara layak', 'jenazah orang yang dimohonkan sudah dimakamkan'],
     ['orang yang dimohonkan telah dikebumikan', 'pemakaman orang yang dimohonkan sudah dilaksanakan']),
  A=['orang yang dimohonkan meninggal karena sakit dan dimakamkan di tempat yang disebut dalam permohonan', 'sebab meninggal orang yang dimohonkan adalah sakit dan jenazahnya dimakamkan di tempat yang disebut dalam permohonan'],
  B=['orang yang dimohonkan meninggal karena kecelakaan', 'sebab meninggal orang yang dimohonkan adalah kecelakaan'],
  beda_pada='penyebab', beda_maksud='versi A: meninggal karena sakit; versi B: meninggal karena kecelakaan - berselisih pada PENYEBAB')

S(id='mati-surat', pokok='pp-pu-mati-bukti', urut_abs=114, keadaan=KM,
  teks='Apakah ada surat keterangan kematian dari desa atau kelurahan dan siapa yang menerbitkannya?',
  varian=['Adakah surat keterangan kematian untuk orang yang dimohonkan itu, dan siapa penerbitnya?'],
  hal='surat keterangan kematian dan penerbitnya', m='surat keterangan kematian dan penerbitnya',
  K=(['ada surat keterangan kematian orang yang dimohonkan yang diterbitkan oleh kepala desa atau lurah yaitu #4932#', 'kematian orang yang dimohonkan dibuktikan dengan surat keterangan dari kepala desa atau lurah berupa #4932#'],
     ['surat keterangan kematian dari pemerintah desa atau kelurahan tersedia dan berupa #4932#', 'pemerintah desa atau kelurahan telah menerbitkan keterangan kematian yang tercantum dalam #4932#']),
  P=(['ada surat keterangan kematian dari pemerintah desa', 'kematian itu sudah diketahui kepala desa atau lurah'],
     ['surat keterangan kematian pernah dibuat oleh aparat desa', 'aparat desa sudah mengetahui kematian itu']),
  A=['surat keterangan kematian itu diterbitkan oleh kepala desa atau lurah setempat', 'kepala desa atau lurah setempat menerbitkan surat keterangan kematian itu'],
  B=['surat keterangan kematian itu diterbitkan oleh rumah sakit', 'rumah sakit menerbitkan keterangan kematian itu'],
  beda_pada='pelaku', beda_maksud='versi A: diterbitkan kepala desa atau lurah; versi B: diterbitkan rumah sakit - berselisih pada PELAKU (penerbit)')

S(id='mati-saksi-hadir', pokok='pp-pu-mati-peristiwa', urut_abs=116, fam='hadir', keadaan=KM,
  teks='Bagaimana saksi mengetahui kematian itu, apakah ikut melayat atau menghadiri pemakamannya?',
  varian=['Dari mana saksi mengetahui kematian itu, apakah saksi melayat atau menghadiri pemakamannya?'],
  hal='cara saksi mengetahui kematian', m='cara saksi mengetahui kematian orang yang dimohonkan',
  K=(['banyak warga melayat dan menghadiri pemakaman orang yang dimohonkan', 'keluarga dan tetangga hadir melayat sampai pemakaman orang yang dimohonkan'],
     ['orang yang dimohonkan dilayat warga dan dimakamkan dengan dihadiri keluarga', 'warga sekitar ikut melayat dan mengantar jenazah orang yang dimohonkan']),
  P=(['warga sekitar mengetahui kematian orang yang dimohonkan', 'kematian orang yang dimohonkan diketahui warga sekitar'],
     ['orang yang dimohonkan dikenal warga sekitar', 'tetangga mengetahui kematian orang yang dimohonkan']),
  A=['banyak warga hadir pada pemakaman orang yang dimohonkan', 'pemakaman orang yang dimohonkan dihadiri banyak warga'],
  B=['hanya keluarga dekat yang hadir pada pemakaman orang yang dimohonkan', 'pemakaman orang yang dimohonkan dihadiri keluarga dekat saja'],
  beda_pada='jumlah', beda_maksud='versi A: dihadiri banyak warga; versi B: hanya keluarga dekat - berselisih pada JUMLAH')

S(id='mati-alasan-baru', pokok='pp-pu-mati-lambat', urut_abs=118, keadaan=KM, kelompok='akibat',
  teks='Mengapa kematian itu baru dimohonkan penetapannya sekarang dan tidak dilaporkan pada waktunya?',
  varian=['Apa sebabnya kematian itu terlambat dilaporkan sehingga penetapannya baru dimohonkan sekarang?'],
  hal='alasan kematian baru dimohonkan penetapannya', m='alasan kematian baru dimohonkan penetapannya',
  K=(['kematian itu belum dilaporkan pada waktunya karena ... sehingga baru sekarang dimohonkan penetapannya', 'sebab kematian itu baru dimohonkan sekarang adalah ... sehingga keluarga belum mengurus pelaporannya'],
     ['keluarga belum melaporkan kematian itu tepat waktu karena ... dan baru sekarang memohon penetapan', 'pelaporan kematian itu belum dilakukan tepat waktu karena ... sehingga penetapannya baru dimohonkan sekarang']),
  P=(['kematian itu belum dilaporkan kepada instansi yang berwenang', 'keluarga belum melaporkan kematian itu'],
     ['kematian itu belum tercatat', 'pelaporan kematian itu belum dilakukan']),
  A=['kematian itu belum dilaporkan karena keluarga kurang memahami kewajiban melapor', 'keluarga kurang memahami kewajiban melapor sehingga kematian itu belum dilaporkan'],
  B=['kematian itu belum dilaporkan karena jarak ke kantor pencatatan sangat jauh', 'jauhnya jarak ke kantor pencatatan membuat kematian itu belum dilaporkan'],
  beda_pada='penyebab', beda_maksud='versi A: keluarga kurang memahami kewajiban melapor; versi B: kantor pencatatan jauh - berselisih pada PENYEBAB')

S(id='mati-ahli-waris', pokok='pp-pu-mati-ahli-waris', urut_abs=120, keadaan=KM, tingkat='tambahan',
  teks='Siapa ahli waris yang ditinggalkan orang yang meninggal itu dan apakah mereka mengetahui permohonan ini?',
  varian=['Apakah ahli waris yang ditinggalkan sudah tahu dan setuju dengan permohonan penetapan kematian ini?'],
  hal='ahli waris yang ditinggalkan dan pengetahuan mereka tentang permohonan', m='ahli waris yang ditinggalkan dan sikap mereka terhadap permohonan',
  K=(['orang yang meninggal itu meninggalkan ahli waris yang mengetahui dan menyetujui permohonan ini', 'ahli waris yang ditinggalkan orang yang meninggal itu mengetahui permohonan ini dan menyetujuinya'],
     ['para ahli waris dari orang yang meninggal itu sudah tahu dan setuju atas permohonan ini', 'permohonan ini diketahui dan disetujui oleh ahli waris yang ditinggalkan orang yang meninggal itu']),
  P=(['ahli waris orang yang meninggal itu mengetahui permohonan ini', 'orang yang meninggal itu meninggalkan ahli waris yang tahu tentang permohonan ini'],
     ['sebagian ahli waris orang yang meninggal itu mengetahui permohonan ini', 'ahli waris yang saya kenal tahu tentang permohonan ini']),
  A=['semua ahli waris orang yang meninggal itu menyetujui permohonan ini', 'seluruh ahli waris orang yang meninggal itu setuju dengan permohonan ini'],
  B=['sebagian ahli waris orang yang meninggal itu belum menyetujui permohonan ini', 'ada ahli waris orang yang meninggal itu yang belum setuju dengan permohonan ini'],
  beda_pada='jumlah', beda_maksud='versi A: semua ahli waris menyetujui; versi B: sebagian belum setuju - berselisih pada JUMLAH')

S(id='mati-keperluan', pokok='pp-pu-mati-keperluan', urut_abs=122, keadaan=KM, kelompok='akibat', tingkat='inti',
  teks='Untuk keperluan apa penetapan kematian itu dimohonkan dan apakah kematian itu sudah tercatat di Dinas Kependudukan dan Pencatatan Sipil?',
  varian=['Apakah kematian itu sudah dicatat oleh Dinas Kependudukan dan Pencatatan Sipil, dan untuk apa penetapan ini dimohonkan?'],
  hal='keperluan penetapan kematian dan pencatatannya', m='keperluan penetapan kematian dan pencatatannya',
  K=(['kematian itu belum tercatat pada Dinas Kependudukan dan Pencatatan Sipil sehingga penetapan ini dimohonkan untuk #4933#', 'penetapan kematian ini dimohonkan karena kematian itu belum dicatat oleh Dinas Kependudukan dan Pencatatan Sipil padahal diperlukan untuk #4933#'],
     ['sebelum kematian itu dicatat oleh Dinas Kependudukan dan Pencatatan Sipil #4933# belum dapat diurus sehingga penetapan ini dimohonkan', 'karena kematian itu belum tercatat pada Dinas Kependudukan dan Pencatatan Sipil penetapan ini dimohonkan guna #4933#']),
  P=(['kematian itu belum tercatat pada Dinas Kependudukan dan Pencatatan Sipil', 'kematian itu belum dicatat oleh Dinas Kependudukan dan Pencatatan Sipil'],
     ['kematian itu belum diurus pencatatannya', 'pencatatan kematian itu belum dilakukan']),
  A=['kematian itu belum pernah dicatat oleh Dinas Kependudukan dan Pencatatan Sipil', 'belum pernah ada pencatatan kematian itu pada Dinas Kependudukan dan Pencatatan Sipil'],
  B=['kematian itu sudah tercatat namun datanya perlu diperbaiki', 'pencatatan kematian itu sudah ada namun datanya perlu diperbaiki'],
  beda_pada='peristiwa', beda_maksud='versi A: belum pernah dicatat; versi B: sudah tercatat tetapi datanya perlu diperbaiki - berselisih pada PERISTIWA')

CATATAN = [
    'Pilih "Jenis permohonan" pada keadaan perkara. Pilihan "Penetapan kematian untuk pencatatan sipil" memunculkan pertanyaan tanggal dan tempat meninggal, sebab dan makam, surat keterangan kematian, alasan baru dimohonkan, ahli waris, serta keperluan pencatatan; pilihan itu hanya menentukan pertanyaan, bukan putusan.',
    'Pilihan "Jumlah pemohon", "Kehadiran pemohon", dan "Pengumuman permohonan" memunculkan butir yang sesuai; kewenangan pengadilan dan syarat penetapan kematian ada pada penilaian majelis dan rujukannya masih perlu diverifikasi.',
    'Pertanyaan dan jawaban hanyalah kerangka dari isian perkara; titik-titik (...) pada keterangan saksi wajib diganti dengan keterangan saksi yang sesungguhnya.',
]

VARBARU = ['4930', '4931', '4932', '4933', '4934']


def KELUARAN_TAMBAHAN(k):
    """Menyisipkan jawaban 'mendengar' tulis tangan dan menghitung ulang variabelAbt/variabelBaru."""
    ada = set()
    for q in k['pertanyaan']:
        if q['id'] in MR:
            maksud, s1, s2 = MR[q['id']]
            tpl = lambda t: t.replace('{PEM}', '#7036#')  # noqa: E731
            q['jawaban']['mendengar'] = {
                'maksud': 'saksi menerangkan %s sebagai hal yang didengarnya sendiri dari pihak atau peristiwa itu' % tpl(maksud),
                'saksi1': [tpl(x) for x in s1], 'saksi2': [tpl(x) for x in s2]}
            teks = [q['teks']] + q.get('teksVarian', [])
            for j in q['jawaban'].values():
                for x in (j if isinstance(j, list) else [j]):
                    teks += x['saksi1'] + x['saksi2']
            q['variabelAbt'] = sorted(set(sum((re.findall(r'#(\d{4})#', t) for t in teks), [])))
            d = M.diagnosa(q)
            assert not d, d[:3]
        ada |= set(q['variabelAbt'])
    vb = set(k.get('variabelBaru', [])) | set(VARBARU)
    k['variabelBaru'] = sorted(v for v in vb if v in ada)
    if not k['variabelBaru']:
        del k['variabelBaru']
