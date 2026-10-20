# -*- coding: utf-8 -*-
"""Butir BARU katalog saksi MAFQUD (agen W2b-C sub-agen mafqud/umum, 21 Okt 2026).

Hanya menambah (butir, pokok, keadaan); butir/pokok/dasar hukum/keadaan lama tidak diubah. Prefiks butir q-mf-, prefiks pokok pp-mf-.

Dasar hukum BARU: tidak ada. Seluruh pokok baru memakai dasar hukum yang sudah ada di katalog lama:
  dh-sebab-pengetahuan, dh-khi-96, dh-khi-171b, dh-kuhper-tak-hadir (perlu-verifikasi, sudah ada), dh-beban-bukti.
  (Daftar periksa pasal untuk agen induk: tidak ada pasal baru dari modul ini.)
Tenggat angka tahun TIDAK disebut sebagai syarat hukum di butir mana pun; lamanya tidak ada kabar hanya ditanyakan sebagai fakta (#9864#).

Keadaan baru (sumber borang): statusNikahHilang, kedudukanPemohon, kepentinganLain, hartaDitinggal, anakDitinggal.
Variabel isian baru: 4920 (umur-pekerjaan-alamat terakhir), 4921 (keluarga ditinggalkan), 4922 (harta ditinggalkan & penguasanya),
  4923 (sebab & tujuan kepergian). Variabel mafqud yang sudah ada di server tetapi belum ada di kamus lokal didaftarkan ke
  variabelBaru: 9862, 9868, 9869, 9873.
Jawaban 'mendengar' untuk butir tertentu ditulis tangan (MR) dan disisipkan lewat KELUARAN_TAMBAHAN karena pembungkus 'mendengar'
bawaan mesin menyebut "para pihak" (tidak cocok untuk satu pemohon dan orang yang tidak hadir).
"""
import re

import katalog_mesin as M

KUNCI = 'mafqud'
DASAR_BARU = []

# keluarga pembungkus 'melihat' tambahan (hanya MENAMBAH kunci; tidak mengubah yang ada)
M.W_MELIHAT.setdefault('kenal', (
    ['saya mengetahui sendiri bahwa {F}', 'saya tahu betul bahwa {F}', '{F}, dan hal itu saya ketahui sendiri',
     'sebagai orang yang mengenal keluarga itu saya mengetahui bahwa {F}'],
    ['yang saya ketahui secara langsung adalah bahwa {F}', '{F}, begitulah yang saya ketahui dari pergaulan sehari-hari',
     'karena sering berada di lingkungan itu saya paham bahwa {F}', 'saya paham dengan baik bahwa {F}']))

KEADAAN_BARU = {
    'statusNikahHilang': dict(sumber='borang', nilai=['menikah', 'belum-menikah'], bawaan='menikah',
                              label='Status perkawinan orang yang hilang ketika pergi',
                              labelNilai={'menikah': 'Sudah menikah', 'belum-menikah': 'Belum menikah'}),
    'kedudukanPemohon': dict(sumber='borang', nilai=['pasangan', 'anak', 'saudara', 'ahli-waris-lain'], bawaan='pasangan',
                             label='Kedudukan pemohon terhadap orang yang hilang',
                             labelNilai={'pasangan': 'Suami atau istri', 'anak': 'Anak', 'saudara': 'Saudara',
                                         'ahli-waris-lain': 'Ahli waris atau kerabat lain'}),
    'kepentinganLain': dict(sumber='borang', nilai=['urusan-lain', 'kawin-kembali'], bawaan='urusan-lain',
                            label='Jenis kepentingan lain (bila kepentingan pemohon C)',
                            labelNilai={'urusan-lain': 'Urusan lain', 'kawin-kembali': 'Pemohon hendak menikah kembali'}),
    'hartaDitinggal': dict(sumber='borang', nilai=['ada', 'tidak-ada'], bawaan='ada',
                           label='Harta yang ditinggalkan orang yang hilang',
                           labelNilai={'ada': 'Ada harta yang ditinggalkan', 'tidak-ada': 'Tidak ada harta yang ditinggalkan'}),
    'anakDitinggal': dict(sumber='borang', nilai=['ada', 'tidak-ada'], bawaan='ada',
                          label='Anak yang ditinggalkan orang yang hilang',
                          labelNilai={'ada': 'Ada anak yang ditinggalkan', 'tidak-ada': 'Tidak ada anak yang ditinggalkan'}),
}


def _pokok(id_, judul, uraian, dasar, keadaan=None):
    d = dict(id=id_, judul=judul, uraian=uraian, dasarHukum=dasar, wajib=False)
    if keadaan:
        d['keadaan'] = keadaan
    return d


SP, KH, K96, K171, KUH = 'dh-sebab-pengetahuan', 'dh-khi-96', 'dh-khi-171b', 'dh-kuhper-tak-hadir', 'dh-beban-bukti'

POKOK_BARU = [
    _pokok('pp-mf-cara-tahu', 'Cara saksi mengetahui kepergian', 'sejak kapan saksi mengenal orang yang hilang dan dari mana saksi mengetahui kepergiannya', [SP]),
    _pokok('pp-mf-identitas', 'Identitas orang yang hilang', 'umur, pekerjaan, dan alamat terakhir orang yang hilang', [SP]),
    _pokok('pp-mf-kedudukan', 'Kedudukan pemohon terhadap orang yang hilang', 'hubungan pemohon (pasangan, anak, saudara, atau ahli waris) dengan orang yang hilang dan alasan pemohon mengajukan permohonan', [K96, K171]),
    _pokok('pp-mf-status-nikah', 'Status perkawinan orang yang hilang', 'orang yang hilang sudah atau belum menikah ketika pergi dan siapa keluarga yang ditinggalkan', [K96, SP]),
    _pokok('pp-mf-anak', 'Anak yang ditinggalkan', 'anak orang yang hilang dan siapa yang mengasuh serta menafkahinya', [SP], {'anakDitinggal': 'ada'}),
    _pokok('pp-mf-sebab-pergi', 'Sebab dan tujuan kepergian', 'alasan dan tujuan orang yang hilang meninggalkan tempat tinggalnya', [SP]),
    _pokok('pp-mf-pamit', 'Pamit dan bekal ketika pergi', 'orang yang hilang berpamitan kepada keluarganya dan bekal yang dibawanya', [SP]),
    _pokok('pp-mf-lokasi-terakhir', 'Tempat dan waktu terakhir diketahui', 'di mana dan kapan orang yang hilang terakhir diketahui berada', [SP]),
    _pokok('pp-mf-kontak-putus', 'Terputusnya hubungan dan kiriman kabar', 'sejak kapan orang yang hilang tidak lagi berkirim kabar atau nafkah', [SP, KUH]),
    _pokok('pp-mf-pernah-pulang', 'Kepulangan selama pergi', 'apakah orang yang hilang pernah pulang meskipun sebentar', [SP]),
    _pokok('pp-mf-cari-keluarga', 'Pencarian oleh pemohon dan keluarga', 'pencarian ke rumah kerabat dan tempat yang biasa dikunjungi orang yang hilang', [SP]),
    _pokok('pp-mf-lapor-desa', 'Laporan kepada aparat desa atau kelurahan', 'laporan kepergian orang yang hilang kepada kepala desa atau lurah', [SP]),
    _pokok('pp-mf-lapor-polisi', 'Laporan kehilangan kepada kepolisian', 'laporan kehilangan kepada kepolisian dan tanda bukti laporannya', [SP]),
    _pokok('pp-mf-cari-luas', 'Pencarian melalui tempat kerja, perantauan, dan media', 'pencarian yang lebih luas di luar lingkungan keluarga', [SP]),
    _pokok('pp-mf-tak-ada-yang-tahu', 'Tidak ada pihak yang mengetahui keberadaannya', 'tidak ada keluarga, kerabat, atau teman yang mengetahui keberadaan orang yang hilang', [SP, KUH]),
    _pokok('pp-mf-harta', 'Harta yang ditinggalkan dan penguasanya', 'harta orang yang hilang dan siapa yang menguasai serta memeliharanya', [K96, KUH], {'hartaDitinggal': 'ada'}),
    _pokok('pp-mf-harta-alih', 'Pengalihan harta sejak pergi', 'apakah harta orang yang hilang pernah dijual atau dipindahtangankan', [KUH], {'hartaDitinggal': 'ada'}),
    _pokok('pp-mf-hak-tertahan', 'Hak keluarga yang tertahan', 'hak nafkah, bagian harta, dan pewarisan keluarga yang tertahan karena belum jelas hidup atau matinya', [K96, K171]),
    _pokok('pp-mf-ahli-waris-lain', 'Ahli waris lain dan sikapnya', 'ahli waris lain orang yang hilang mengetahui dan menyetujui permohonan', [K171], {'kepentingan': 'B'}),
    _pokok('pp-mf-kawin-kembali', 'Kepentingan menikah kembali', 'pemohon memerlukan kepastian hukum karena hendak menikah kembali', [K96], {'kepentingan': 'C', 'kepentinganLain': 'kawin-kembali'}),
    _pokok('pp-mf-keberatan', 'Keberatan keluarga', 'ada atau tidaknya keluarga yang keberatan atas permohonan', [KUH]),
    _pokok('pp-mf-kesanggupan', 'Kesanggupan pemohon menjaga hak orang yang hilang', 'pemohon sanggup menjaga dan mengembalikan hak orang yang hilang bila ia kembali', [KUH]),
    _pokok('pp-mf-bukti-surat', 'Bukti surat tentang hilangnya', 'surat yang diajukan pemohon untuk membuktikan hilangnya orang itu', [KUH]),
    _pokok('pp-mf-pengumuman-cara', 'Cara pengumuman perkara', 'cara dan jangka waktu pengumuman permohonan', [KUH]),
    _pokok('pp-mf-pengumuman-hasil', 'Hasil pengumuman perkara', 'ada atau tidaknya orang yang memberi kabar atau menyatakan keberatan sejak pengumuman', [KUH]),
]

SPEC = []
MR = {}  # id butir jadi -> (maksud, saksi1[4], saksi2[4]) jawaban 'mendengar' tulis tangan


def S(**kw):
    kw.setdefault('prefix', 'q-mf-')
    kw.setdefault('bentuk', ('mf',))
    kw.setdefault('fam', 'kenal')
    kw.setdefault('kelompok', 'pokok')
    kw.setdefault('tingkat', 'pilihan')
    mr = kw.pop('mr', None)
    if 'P' not in kw:  # butir yang hanya punya jawaban 'melihat' (sisanya dikecualikan)
        kw['P'], kw['A'], kw['B'] = kw['K'], kw['K'][0], kw['K'][1]
        kw['beda_pada'], kw['beda_maksud'] = 'peristiwa', 'tidak dipakai'
    SPEC.append(kw)
    if mr:
        MR['q-mf-%s-mf' % kw['id']] = (kw['m'], mr[0], mr[1])


SEMUA_KECUALI_MELIHAT = ['mendengar', 'de-auditu', 'sebagian', 'tidak-tahu', 'ragu', 'berbeda']

# ---- hubungan dan identitas ------------------------------------------------------------------------------------------
S(id='cara-tahu', pokok='pp-mf-cara-tahu', urut_abs=15, kelompok='hubungan', tidakBerlaku=SEMUA_KECUALI_MELIHAT,
  teks='Sejak kapan saksi mengenal {HILANG} dan dengan cara apa saksi mengetahui peristiwa kepergiannya?',
  varian=['Dalam hubungan apa saksi mengenal {HILANG} dan bagaimana saksi mengetahui bahwa ia pergi dan tidak kembali?'],
  hal='cara saksi mengetahui kepergian orang yang hilang', m='cara saksi mengenal {HILANG} dan mengetahui kepergiannya',
  K=(['saya mengenal {HILANG} sejak sebelum ia pergi dan mengetahui kepergiannya dari pergaulan saya dengan keluarganya',
      'saya sudah lama mengenal {HILANG} dan mengetahui kepergiannya karena sering bertemu dengan keluarganya'],
     ['saya mengenal {HILANG} sebelum ia pergi dan peristiwa kepergiannya saya ketahui dari hubungan saya dengan keluarganya',
      'perkenalan saya dengan {HILANG} sudah lama dan kepergiannya saya ketahui melalui pergaulan dengan keluarganya']))

S(id='identitas', pokok='pp-mf-identitas', urut_abs=22,
  teks='Berapa umur {HILANG} ketika ia pergi, apa pekerjaannya, dan di mana alamat terakhirnya?',
  varian=['Bagaimana identitas {HILANG} yang saksi ketahui, mulai dari umur, pekerjaan, sampai alamat terakhirnya sebelum pergi?'],
  hal='umur, pekerjaan, dan alamat terakhir orang yang hilang', m='identitas {HILANG} yaitu umur, pekerjaan, dan alamat terakhirnya',
  K=(['identitas {HILANG} adalah #4920#', 'keadaan {HILANG} sebelum pergi adalah #4920#'],
     ['data diri {HILANG} ialah #4920#', '{HILANG} semasa di rumah dikenal dengan keadaan #4920#']),
  P=(['{HILANG} sudah dewasa dan bekerja untuk keluarganya', '{HILANG} sudah bekerja sebelum pergi'],
     ['{HILANG} sudah berumur dewasa dan bekerja', '{HILANG} sudah bekerja untuk menghidupi keluarganya']),
  A=['identitas {HILANG} sesuai dengan yang disebut dalam permohonan yaitu #4920#', 'data diri {HILANG} yang saya ketahui sama dengan yang tertulis dalam permohonan yaitu #4920#'],
  B=['alamat terakhir {HILANG} yang saya ketahui berbeda dengan yang tertulis dalam permohonan', 'tempat tinggal terakhir {HILANG} yang saya ketahui lain dari yang tertulis dalam permohonan'],
  beda_pada='tempat', beda_maksud='versi A: identitas sama dengan isian permohonan; versi B: alamat terakhir berbeda - berselisih pada TEMPAT')

# ---- kedudukan pemohon (satu butir per kedudukan) --------------------------------------------------------------------
S(id='kedudukan-pasangan', pokok='pp-mf-kedudukan', urut_abs=31, keadaan={'kedudukanPemohon': 'pasangan'},
  teks='Apakah perkawinan {PEM} dengan {HILANG} masih berlangsung dan tidak pernah putus sampai sekarang?',
  varian=['Apakah {PEM} dan {HILANG} pernah bercerai atau masih berstatus suami istri sampai sekarang?'],
  hal='status perkawinan pemohon dengan orang yang hilang', m='status perkawinan {PEM} dengan {HILANG}',
  K=(['perkawinan {PEM} dengan {HILANG} tidak pernah putus dan masih berlangsung sampai sekarang',
      'antara {PEM} dan {HILANG} belum pernah terjadi perceraian sehingga mereka masih suami istri'],
     ['{PEM} dan {HILANG} masih terikat perkawinan sampai sekarang dan tidak pernah bercerai',
      'ikatan perkawinan {PEM} dengan {HILANG} tetap berlaku dan belum pernah diputus']),
  P=(['{PEM} dan {HILANG} masih terikat perkawinan', 'perkawinan {PEM} dengan {HILANG} masih berlangsung'],
     ['{PEM} dan {HILANG} masih suami istri', '{PEM} masih berstatus pasangan {HILANG}']),
  A=['{PEM} dan {HILANG} tidak pernah bercerai dan masih berstatus suami istri', 'antara {PEM} dan {HILANG} belum pernah ada perceraian'],
  B=['{PEM} dan {HILANG} sudah bercerai sebelum ia pergi', 'perkawinan {PEM} dengan {HILANG} sudah berakhir sebelum ia pergi'],
  beda_pada='peristiwa', beda_maksud='versi A: perkawinan belum pernah putus; versi B: sudah bercerai sebelum pergi - berselisih pada PERISTIWA')

S(id='kedudukan-anak', pokok='pp-mf-kedudukan', urut_abs=32, keadaan={'kedudukanPemohon': 'anak'},
  teks='Apakah {PEM} anak kandung {HILANG} dan termasuk keluarga yang ditinggalkannya?',
  varian=['Apa hubungan {PEM} dengan {HILANG} dan apakah ia anak kandungnya yang ditinggalkan?'],
  hal='kedudukan pemohon sebagai anak orang yang hilang', m='kedudukan {PEM} sebagai anak {HILANG}',
  K=(['kedudukan {PEM} terhadap {HILANG} adalah #9861# dan {PEM} termasuk keluarga yang ditinggalkannya',
      '{PEM} adalah #9861# dari {HILANG} dan termasuk keluarga yang ia tinggalkan'],
     ['hubungan {PEM} dengan {HILANG} ialah #9861# sehingga {PEM} termasuk keluarga yang ditinggalkan',
      'dalam hubungan keluarga {PEM} adalah #9861# dari {HILANG} yang ditinggalkan olehnya']),
  P=(['{PEM} adalah anak dari {HILANG}', '{PEM} termasuk anak {HILANG}'],
     ['{PEM} anak dari {HILANG}', '{HILANG} adalah orang tua {PEM}']),
  A=['{PEM} adalah anak kandung {HILANG} yang ditinggalkan ketika ia pergi', '{PEM} merupakan anak kandung {HILANG} yang ditinggal pergi'],
  B=['{PEM} adalah anak angkat {HILANG}', '{PEM} merupakan anak asuh {HILANG}'],
  beda_pada='peristiwa', beda_maksud='versi A: anak kandung; versi B: anak angkat atau anak asuh - berselisih pada PERISTIWA (hubungan)')

S(id='kedudukan-saudara', pokok='pp-mf-kedudukan', urut_abs=33, keadaan={'kedudukanPemohon': ['saudara', 'ahli-waris-lain']},
  teks='Apa hubungan {PEM} dengan {HILANG} dan mengapa {PEM} yang mengajukan permohonan ini mewakili kepentingan keluarganya?',
  varian=['Mengapa {PEM} yang mengurus permohonan ini dan apa hubungan {PEM} dengan {HILANG}?'],
  hal='kedudukan pemohon sebagai wakil kepentingan keluarga orang yang hilang', m='kedudukan {PEM} terhadap {HILANG} dan alasannya mengajukan permohonan',
  K=(['kedudukan {PEM} terhadap {HILANG} adalah #9861# dan {PEM} mengajukan permohonan ini demi kepentingan keluarganya',
      '{PEM} adalah #9861# dari {HILANG} sehingga {PEM} yang mengurus kepentingan keluarganya'],
     ['hubungan {PEM} dengan {HILANG} adalah #9861# dan itu sebabnya {PEM} yang mengajukan permohonan ini',
      'karena {PEM} adalah #9861# dari {HILANG} maka {PEM} mengurus kepentingan keluarganya']),
  P=(['{PEM} masih berhubungan keluarga dengan {HILANG}', '{PEM} adalah kerabat {HILANG}'],
     ['{PEM} termasuk keluarga {HILANG}', '{PEM} dan {HILANG} bertalian keluarga']),
  A=['{PEM} mengajukan permohonan ini atas kesepakatan keluarga {HILANG}', 'permohonan ini diajukan {PEM} atas persetujuan keluarga {HILANG}'],
  B=['{PEM} mengajukan permohonan ini atas kemauannya sendiri', 'permohonan ini diajukan {PEM} atas inisiatifnya sendiri'],
  beda_pada='pelaku', beda_maksud='versi A: diajukan atas kesepakatan keluarga; versi B: atas kemauan pemohon sendiri - berselisih pada PELAKU')

# ---- keadaan sebelum pergi -----------------------------------------------------------------------------------------------
S(id='sebab-pergi', pokok='pp-mf-sebab-pergi', urut_abs=42,
  teks='Apa sebab dan tujuan {HILANG} pergi meninggalkan tempat tinggalnya?',
  varian=['Mengapa dan ke mana {HILANG} pergi, dan apakah ia menjelaskan maksud kepergiannya?'],
  hal='sebab dan tujuan kepergian orang yang hilang', m='sebab dan tujuan kepergian {HILANG}',
  K=(['sebab dan tujuan kepergian {HILANG} adalah #4923#', '{HILANG} pergi dengan sebab dan tujuan sebagaimana #4923#'],
     ['alasan {HILANG} meninggalkan rumah dan tujuannya yaitu #4923#', 'kepergian {HILANG} dilatarbelakangi hal berikut yaitu #4923#']),
  P=(['{HILANG} pergi untuk suatu keperluan', '{HILANG} meninggalkan rumah untuk keperluan tertentu'],
     ['{HILANG} pergi karena ada keperluan di luar rumah', '{HILANG} berangkat dengan suatu tujuan']),
  A=['{HILANG} pergi untuk mencari nafkah di tempat lain', '{HILANG} berangkat merantau untuk bekerja'],
  B=['{HILANG} pergi karena berselisih dengan keluarganya', '{HILANG} meninggalkan rumah sesudah bertengkar dengan keluarganya'],
  beda_pada='penyebab', beda_maksud='versi A: pergi untuk mencari nafkah; versi B: pergi karena berselisih dengan keluarga - berselisih pada PENYEBAB',
  mr=(['saya mendengar sendiri {HILANG} menyampaikan maksud dan tujuan kepergiannya sebelum berangkat',
       'saya mendengar langsung {HILANG} mengatakan ke mana ia akan pergi dan untuk apa',
       'saat itu saya berada di dekat {HILANG} dan mendengarnya menyebutkan tujuan kepergiannya',
       'tujuan kepergiannya saya dengar sendiri dari ucapan {HILANG} pada waktu itu'],
      ['ucapan {HILANG} tentang maksud dan tujuan kepergiannya terdengar oleh saya waktu itu',
       'di depan saya {HILANG} berkata bahwa ia pergi untuk suatu keperluan',
       'saya mendengar {HILANG} mengatakan ke mana ia hendak pergi dan apa maksudnya',
       'perkataan {HILANG} mengenai tujuan kepergiannya terdengar di hadapan saya']))

S(id='pamit-bekal', pokok='pp-mf-pamit', urut_abs=45, fam='hadir',
  teks='Apakah {HILANG} berpamitan kepada keluarganya sebelum pergi dan apa yang ia bawa?',
  varian=['Sebelum berangkat, apakah {HILANG} pamit kepada keluarganya dan membawa bekal apa saja?'],
  hal='pamitnya orang yang hilang dan bekal yang dibawanya', m='pamit dan bekal {HILANG} ketika pergi',
  K=(['{HILANG} berpamitan kepada keluarganya sebelum berangkat dan membawa ... sebagai bekal',
      '{HILANG} pamit kepada keluarganya pada hari keberangkatan dengan bekal berupa ... untuk perjalanannya'],
     ['sebelum berangkat {HILANG} berpamitan kepada keluarganya sambil membawa ... sebagai bekal',
      'pada hari ia pergi {HILANG} pamit kepada keluarganya dan membawa bekal berupa ... untuk perjalanannya']),
  P=(['{HILANG} berpamitan kepada keluarganya sebelum berangkat', '{HILANG} pamit kepada keluarganya ketika akan pergi'],
     ['{HILANG} sempat berpamitan kepada keluarganya', 'sebelum berangkat {HILANG} pamit kepada keluarganya']),
  A=['{HILANG} berpamitan kepada keluarganya sebelum berangkat', '{HILANG} pamit kepada keluarganya pada hari keberangkatan'],
  B=['{HILANG} pergi tanpa berpamitan kepada keluarganya', '{HILANG} berangkat tanpa pamit kepada siapa pun'],
  beda_pada='peristiwa', beda_maksud='versi A: berpamitan sebelum berangkat; versi B: pergi tanpa pamit - berselisih pada PERISTIWA',
  mr=(['saya mendengar sendiri {HILANG} berpamitan kepada keluarganya sebelum berangkat',
       'saya mendengar langsung {HILANG} pamit kepada keluarganya pada hari keberangkatan',
       'saat itu saya berada dekat dan mendengar {HILANG} berpamitan kepada keluarganya',
       'pamit {HILANG} kepada keluarganya saya dengar sendiri pada waktu itu'],
      ['ucapan pamit {HILANG} kepada keluarganya terdengar oleh saya sebelum ia berangkat',
       'di depan saya {HILANG} berkata kepada keluarganya bahwa ia hendak berangkat',
       'saya mendengar {HILANG} mengatakan kepada keluarganya bahwa ia akan pergi',
       'perkataan {HILANG} saat berpamitan kepada keluarganya terdengar di hadapan saya']))

# ---- tempat/waktu terakhir, hubungan terputus ------------------------------------------------------------------------
S(id='lokasi-terakhir', pokok='pp-mf-lokasi-terakhir', urut_abs=52,
  teks='Di mana dan kapan {HILANG} terakhir diketahui berada, dan siapa yang terakhir bertemu dengannya?',
  varian=['Siapa orang terakhir yang melihat {HILANG}, dan di mana serta kapan pertemuan itu terjadi?'],
  hal='tempat dan waktu terakhir orang yang hilang diketahui berada', m='tempat dan waktu terakhir {HILANG} diketahui berada',
  K=(['tempat dan waktu terakhir {HILANG} diketahui berada adalah #9862#', 'keberadaan terakhir {HILANG} yang diketahui yaitu #9862#'],
     ['terakhir kali {HILANG} diketahui berada pada #9862#', 'sampai saat ini keberadaan terakhir {HILANG} yang diketahui adalah #9862#']),
  P=(['{HILANG} terakhir terlihat di sekitar tempat tinggalnya', 'terakhir kali {HILANG} diketahui masih berada di tempat tinggalnya'],
     ['{HILANG} terakhir kali terlihat di sekitar rumahnya', '{HILANG} masih berada di tempat tinggalnya sebelum ia pergi']),
  A=['{HILANG} terakhir diketahui berada sesuai yang disebut dalam permohonan yaitu #9862#', 'tempat dan waktu terakhir {HILANG} diketahui sama dengan yang disebut dalam permohonan yaitu #9862#'],
  B=['{HILANG} terakhir diketahui berada di tempat dan waktu yang berbeda dari permohonan', '{HILANG} terakhir terlihat pada waktu lain yang berbeda dari permohonan'],
  beda_pada='waktu', beda_maksud='versi A: tempat dan waktu terakhir sesuai permohonan; versi B: berbeda dari permohonan - berselisih pada WAKTU')

S(id='kontak-putus', pokok='pp-mf-kontak-putus', urut_abs=62,
  teks='Sejak kapan hubungan keluarga dengan {HILANG} terputus, dan apakah ia pernah mengirim surat, telepon, atau nafkah?',
  varian=['Selama ia pergi, apakah {HILANG} pernah menghubungi keluarganya lewat surat atau telepon atau mengirim nafkah, dan sampai kapan?'],
  hal='terputusnya hubungan dan kiriman kabar atau nafkah dari orang yang hilang', m='terputusnya hubungan {HILANG} dengan keluarganya',
  K=(['lama {HILANG} tidak berkirim kabar atau nafkah kepada keluarganya adalah #9864#',
      '{HILANG} tidak menghubungi keluarganya lewat surat atau telepon maupun mengirim nafkah selama #9864#'],
     ['selama #9864# keluarga {HILANG} tidak menerima kabar maupun nafkah darinya',
      '{HILANG} sama sekali tidak menghubungi keluarganya atau mengirim nafkah selama #9864#']),
  P=(['{HILANG} tidak lagi berkirim kabar kepada keluarganya', '{HILANG} tidak menghubungi keluarganya lagi'],
     ['keluarga {HILANG} tidak lagi menerima kabar darinya', '{HILANG} tidak pernah lagi memberi kabar']),
  A=['{HILANG} tidak pernah menghubungi keluarganya sejak pergi', 'sejak pergi {HILANG} tidak menghubungi keluarganya sama sekali'],
  B=['{HILANG} masih sempat mengirim kabar kepada keluarganya beberapa waktu setelah pergi', 'beberapa waktu setelah pergi {HILANG} masih menghubungi keluarganya'],
  beda_pada='waktu', beda_maksud='versi A: sama sekali tidak menghubungi sejak pergi; versi B: masih sempat memberi kabar beberapa waktu - berselisih pada WAKTU')

S(id='pernah-pulang', pokok='pp-mf-pernah-pulang', urut_abs=65, tingkat='jarang',
  teks='Selama pergi, apakah {HILANG} pernah pulang meskipun sebentar, misalnya pada hari raya?',
  varian=['Apakah sejak berangkat {HILANG} pernah kembali ke rumahnya walau hanya sebentar?'],
  hal='kepulangan orang yang hilang selama ia pergi', m='kepulangan {HILANG} selama ia pergi',
  K=(['sejak pergi {HILANG} tidak pernah pulang ke rumahnya meskipun sebentar', '{HILANG} tidak pernah kembali ke tempat tinggalnya sejak ia berangkat'],
     ['selama pergi {HILANG} tidak sekali pun pulang termasuk pada hari raya', 'sejak berangkat {HILANG} tidak pulang ke rumah walau hanya sebentar']),
  P=(['{HILANG} tidak pernah pulang ke rumahnya', '{HILANG} tidak kembali ke rumah sejak berangkat'],
     ['{HILANG} tidak pulang ke rumahnya setelah berangkat', '{HILANG} tidak terlihat kembali di rumahnya']),
  A=['{HILANG} tidak pernah pulang sejak berangkat', 'sejak berangkat {HILANG} tidak pernah kembali ke rumahnya'],
  B=['{HILANG} sempat pulang sekali pada hari raya kemudian pergi lagi', 'pada suatu hari raya {HILANG} pulang sebentar lalu pergi lagi'],
  beda_pada='peristiwa', beda_maksud='versi A: tidak pernah pulang; versi B: pernah pulang sekali lalu pergi lagi - berselisih pada PERISTIWA')

# ---- upaya pencarian -------------------------------------------------------------------------------------------------------
S(id='cari-keluarga', pokok='pp-mf-cari-keluarga', urut_abs=72, kelompok='upaya',
  teks='Bagaimana {PEM} dan keluarga mencari {HILANG}, ke mana saja mereka mencari, dan apa hasilnya?',
  varian=['Ke mana saja {PEM} dan keluarga mencari {HILANG}, dan apakah pencarian itu membuahkan hasil?'],
  hal='pencarian orang yang hilang oleh pemohon dan keluarganya', m='pencarian {HILANG} oleh {PEM} dan keluarganya',
  K=(['{PEM} dan keluarga sudah mencari {HILANG} ke rumah kerabat dan ke tempat yang biasa dikunjunginya tetapi tidak menemukannya',
      '{PEM} bersama keluarga mendatangi kerabat dan tempat yang sering didatangi {HILANG} namun tidak berhasil menemukannya'],
     ['pencarian {HILANG} oleh {PEM} dan keluarga dilakukan ke rumah kerabat serta tempat langganannya dan hasilnya tidak ada',
      '{PEM} dan keluarga menelusuri rumah kerabat dan tempat yang biasa didatangi {HILANG} tanpa hasil']),
  P=(['{PEM} dan keluarga sudah mencari {HILANG} ke rumah kerabat', '{PEM} bersama keluarga pernah mencari {HILANG} ke tempat kerabatnya'],
     ['{PEM} dan keluarga ikut mencari {HILANG}', 'keluarga bersama {PEM} berusaha mencari {HILANG}']),
  A=['{PEM} dan keluarga mencari {HILANG} sejak ia diketahui pergi', 'sejak {HILANG} diketahui pergi {PEM} dan keluarga langsung mencarinya'],
  B=['{PEM} dan keluarga baru mencari {HILANG} setelah beberapa lama ia pergi', 'keluarga baru mulai mencari {HILANG} cukup lama sesudah ia pergi'],
  beda_pada='waktu', beda_maksud='versi A: pencarian dimulai sejak diketahui pergi; versi B: baru dimulai setelah beberapa lama - berselisih pada WAKTU')

S(id='lapor-desa', pokok='pp-mf-lapor-desa', urut_abs=74, kelompok='upaya',
  teks='Apakah kepergian {HILANG} sudah dilaporkan kepada kepala desa atau lurah, dan bagaimana tanggapan aparat?',
  varian=['Apakah kepala desa atau lurah sudah mengetahui kepergian {HILANG} dan membantu mencarinya?'],
  hal='laporan kepada aparat desa atau kelurahan tentang orang yang hilang', m='laporan kepergian {HILANG} kepada aparat desa atau kelurahan',
  K=(['kepergian {HILANG} sudah dilaporkan kepada kepala desa atau lurah dan aparat membantu mencarinya',
      '{HILANG} yang pergi itu sudah dilaporkan ke pemerintah desa atau kelurahan yang kemudian ikut mencarinya'],
     ['laporan tentang {HILANG} sudah disampaikan kepada kepala desa atau lurah dan aparat turut membantu pencarian',
      'kepala desa atau lurah telah menerima laporan kepergian {HILANG} dan membantu upaya pencariannya']),
  P=(['kepergian {HILANG} sudah dilaporkan kepada kepala desa atau lurah', '{HILANG} sudah dilaporkan ke pemerintah desa'],
     ['laporan kepergian {HILANG} sudah sampai ke kepala desa', 'pemerintah desa sudah menerima laporan tentang {HILANG}']),
  A=['kepergian {HILANG} dilaporkan kepada kepala desa tidak lama setelah ia pergi', '{HILANG} dilaporkan hilang ke kepala desa tidak lama sesudah berangkat'],
  B=['kepergian {HILANG} baru dilaporkan kepada kepala desa setelah beberapa tahun', '{HILANG} baru dilaporkan ke kepala desa jauh sesudah ia pergi'],
  beda_pada='waktu', beda_maksud='versi A: segera dilaporkan kepada kepala desa; versi B: baru dilaporkan setelah beberapa tahun - berselisih pada WAKTU')

S(id='lapor-polisi', pokok='pp-mf-lapor-polisi', urut_abs=76, kelompok='upaya', tingkat='tambahan',
  teks='Apakah hilangnya {HILANG} pernah dilaporkan oleh {PEM} kepada kepolisian dan adakah tanda bukti laporannya?',
  varian=['Adakah laporan kehilangan {HILANG} di kepolisian, dan apakah {PEM} memegang surat tanda bukti laporannya?'],
  hal='laporan kehilangan orang yang hilang kepada kepolisian', m='laporan kehilangan {HILANG} kepada kepolisian',
  K=(['hilangnya {HILANG} sudah dilaporkan kepada kepolisian dan {PEM} memegang surat tanda bukti laporannya',
      '{PEM} telah melaporkan {HILANG} yang hilang kepada kepolisian dan menerima surat tanda bukti laporan'],
     ['laporan kehilangan {HILANG} sudah disampaikan kepada kepolisian dan surat tanda bukti laporannya ada pada {PEM}',
      'kepolisian telah menerima laporan {HILANG} yang hilang dan {PEM} diberi surat tanda bukti laporan']),
  P=(['hilangnya {HILANG} sudah dilaporkan kepada kepolisian', '{HILANG} yang hilang sudah dilaporkan ke polisi'],
     ['laporan kehilangan {HILANG} sudah masuk ke kepolisian', 'kepolisian sudah menerima laporan tentang {HILANG}']),
  A=['laporan kehilangan {HILANG} dibuat di kepolisian setempat', '{HILANG} dilaporkan hilang di kantor polisi setempat'],
  B=['laporan kehilangan {HILANG} dibuat di kepolisian tempat ia terakhir diketahui berada', '{HILANG} dilaporkan hilang di kantor polisi tempat tujuannya'],
  beda_pada='tempat', beda_maksud='versi A: dilaporkan di kepolisian setempat; versi B: di kepolisian tempat terakhir diketahui - berselisih pada TEMPAT')

S(id='cari-luas', pokok='pp-mf-cari-luas', urut_abs=78, kelompok='upaya', tingkat='jarang',
  teks='Apakah {HILANG} juga dicari melalui tempat kerja, teman di perantauan, atau media sosial, dan apa hasilnya?',
  varian=['Selain ke keluarga, apakah pencarian {HILANG} sampai ke tempat kerjanya, kenalannya di perantauan, atau media sosial?'],
  hal='pencarian orang yang hilang melalui tempat kerja, perantauan, dan media', m='pencarian {HILANG} melalui tempat kerja, perantauan, dan media',
  K=(['pencarian {HILANG} juga dilakukan lewat tempat kerja lamanya dan kenalan di perantauan tetapi tidak ada yang tahu keberadaannya',
      '{PEM} menghubungi tempat kerja {HILANG} dan kenalannya di perantauan namun tidak ada petunjuk tentang keberadaannya'],
     ['keluarga mencari {HILANG} melalui tempat kerja dan teman-temannya di perantauan serta media sosial dan hasilnya tidak ada',
      'pencarian {HILANG} lewat tempat kerja dan kenalan di perantauan tidak membuahkan petunjuk']),
  P=(['{HILANG} juga dicari melalui tempat kerjanya', 'pencarian {HILANG} sampai ke tempat kerjanya'],
     ['{HILANG} dicari lewat teman-temannya', 'keluarga juga bertanya kepada teman {HILANG}']),
  A=['pencarian {HILANG} dilakukan sampai ke tempat kerja lamanya', 'keluarga mencari {HILANG} hingga ke tempat kerja lamanya'],
  B=['pencarian {HILANG} dilakukan sampai ke daerah perantauan', 'keluarga mencari {HILANG} hingga ke daerah perantauannya'],
  beda_pada='tempat', beda_maksud='versi A: pencarian sampai ke tempat kerja lama; versi B: sampai ke daerah perantauan - berselisih pada TEMPAT')

S(id='tak-ada-pihak-tahu', pokok='pp-mf-tak-ada-yang-tahu', urut_abs=82, tingkat='inti',
  teks='Adakah orang yang mengetahui keberadaan {HILANG} sekarang, baik keluarga, kerabat, maupun teman?',
  varian=['Apakah ada seseorang, baik keluarga, kerabat, maupun teman, yang tahu di mana {HILANG} berada saat ini?'],
  hal='adanya orang yang mengetahui keberadaan orang yang hilang', m='ada atau tidaknya orang yang mengetahui keberadaan {HILANG}',
  K=(['tidak ada seorang pun yang mengetahui keberadaan {HILANG} sampai sekarang', 'sampai saat ini tidak ada keluarga kerabat maupun teman yang mengetahui keberadaan {HILANG}'],
     ['keberadaan {HILANG} saat ini tidak diketahui oleh siapa pun', '{HILANG} tidak diketahui tempatnya oleh keluarga kerabat maupun temannya']),
  P=(['keluarga tidak mengetahui keberadaan {HILANG}', '{HILANG} tidak diketahui keberadaannya oleh keluarganya'],
     ['{HILANG} tidak diketahui keberadaannya oleh keluarga yang saya kenal', 'tidak ada keluarga yang saya kenal tahu di mana {HILANG} berada']),
  A=['tidak ada yang mengetahui keberadaan {HILANG} sejak ia pergi', 'sejak {HILANG} pergi tidak ada seorang pun yang tahu di mana ia berada'],
  B=['ada yang pernah melihat {HILANG} di tempat lain setelah ia pergi', 'seseorang pernah melihat {HILANG} di tempat lain sesudah ia pergi'],
  beda_pada='peristiwa', beda_maksud='versi A: tidak ada yang tahu keberadaannya; versi B: ada yang pernah melihatnya di tempat lain - berselisih pada PERISTIWA')

# ---- keluarga, anak, harta, hak ----------------------------------------------------------------------------------------------
S(id='status-menikah', pokok='pp-mf-status-nikah', urut_abs=92, keadaan={'statusNikahHilang': 'menikah'},
  teks='Apakah {HILANG} sudah menikah ketika ia pergi dan siapa keluarga yang ditinggalkannya?',
  varian=['Bagaimana status perkawinan {HILANG} pada saat ia pergi, dan siapa saja yang ia tinggalkan?'],
  hal='status perkawinan orang yang hilang dan keluarga yang ditinggalkannya', m='status perkawinan {HILANG} dan keluarga yang ditinggalkannya',
  K=(['{HILANG} sudah menikah ketika pergi dan keluarga yang ditinggalkannya adalah #4921#', 'pada saat pergi {HILANG} masih terikat perkawinan dan yang ia tinggalkan adalah #4921#'],
     ['ketika meninggalkan rumah {HILANG} berstatus menikah dan keluarga yang ditinggalkannya yaitu #4921#', '{HILANG} masih berstatus menikah saat pergi dan yang ia tinggalkan ialah #4921#']),
  P=(['{HILANG} sudah menikah ketika pergi', '{HILANG} berstatus menikah saat meninggalkan rumah'],
     ['{HILANG} sudah berumah tangga ketika pergi', 'pada saat pergi {HILANG} sudah berkeluarga']),
  A=['{HILANG} sudah menikah ketika pergi dan perkawinannya belum pernah putus', 'saat pergi {HILANG} masih terikat perkawinan yang belum pernah putus'],
  B=['{HILANG} sebenarnya sudah bercerai sebelum pergi', 'perkawinan {HILANG} sudah berakhir sebelum ia pergi'],
  beda_pada='peristiwa', beda_maksud='versi A: masih terikat perkawinan saat pergi; versi B: sudah bercerai sebelum pergi - berselisih pada PERISTIWA')

S(id='status-belum-menikah', pokok='pp-mf-status-nikah', urut_abs=93, keadaan={'statusNikahHilang': 'belum-menikah'},
  teks='Apakah {HILANG} belum menikah ketika ia pergi dan siapa keluarga terdekat yang ditinggalkannya?',
  varian=['Bagaimana status {HILANG} ketika ia pergi, apakah masih lajang, dan siapa keluarga terdekat yang ia tinggalkan?'],
  hal='status perkawinan dan keluarga terdekat orang yang hilang', m='status perkawinan {HILANG} dan keluarga terdekat yang ditinggalkannya',
  K=(['{HILANG} belum menikah ketika pergi dan keluarga terdekat yang ditinggalkannya adalah #4921#', 'saat pergi {HILANG} belum berumah tangga dan yang ia tinggalkan adalah #4921#'],
     ['{HILANG} belum pernah menikah ketika meninggalkan rumah dan keluarga terdekatnya yaitu #4921#', 'pada waktu pergi {HILANG} belum beristri atau bersuami dan yang ditinggalkannya ialah #4921#']),
  P=(['{HILANG} belum menikah ketika pergi', '{HILANG} belum berumah tangga saat pergi'],
     ['{HILANG} belum pernah menikah sampai ia pergi', 'sampai pergi {HILANG} belum berkeluarga']),
  A=['{HILANG} belum menikah ketika pergi dan tinggal bersama keluarganya', 'saat pergi {HILANG} belum berumah tangga dan masih tinggal bersama keluarganya'],
  B=['{HILANG} sudah pernah menikah sebelum ia pergi', 'sebelum pergi {HILANG} sudah berumah tangga'],
  beda_pada='peristiwa', beda_maksud='versi A: belum menikah saat pergi; versi B: sudah pernah menikah - berselisih pada PERISTIWA')

S(id='anak-ditinggal', pokok='pp-mf-anak', urut_abs=94, keadaan={'anakDitinggal': 'ada'},
  teks='Apakah {HILANG} meninggalkan anak, dan siapa yang mengasuh serta menafkahi anak itu selama ia tidak ada?',
  varian=['Siapa yang merawat dan memenuhi kebutuhan anak {HILANG} sejak ia pergi?'],
  hal='anak yang ditinggalkan orang yang hilang dan pengasuhnya', m='anak yang ditinggalkan {HILANG} dan pengasuhnya',
  K=(['{HILANG} meninggalkan anak yang sejak itu diasuh dan dinafkahi oleh keluarganya yaitu #4921#', 'sepeninggal {HILANG} anaknya dirawat dan dinafkahi oleh keluarga yang ditinggalkan yaitu #4921#'],
     ['anak {HILANG} ditinggalkan dan sampai sekarang diasuh serta dinafkahi oleh keluarganya yaitu #4921#', 'sejak {HILANG} pergi anaknya hidup dalam asuhan dan nafkah keluarga yaitu #4921#']),
  P=(['{HILANG} meninggalkan anak yang diasuh oleh keluarganya', 'sepeninggal {HILANG} anaknya dirawat keluarga'],
     ['anak {HILANG} masih berada dalam asuhan keluarga', 'anak yang ditinggalkan {HILANG} dirawat oleh keluarga']),
  A=['anak {HILANG} diasuh dan dinafkahi oleh keluarganya sejak ia pergi', 'sejak {HILANG} pergi anaknya dirawat dan dinafkahi keluarganya'],
  B=['anak {HILANG} sebenarnya dirawat oleh neneknya sejak ia pergi', 'sejak {HILANG} pergi anaknya tinggal bersama kakek dan neneknya'],
  beda_pada='pelaku', beda_maksud='versi A: diasuh keluarga yang ditinggalkan; versi B: dirawat nenek dan kakek - berselisih pada PELAKU')

S(id='harta-ditinggal', pokok='pp-mf-harta', urut_abs=102, keadaan={'hartaDitinggal': 'ada'},
  teks='Harta apa yang ditinggalkan {HILANG} dan siapa yang menguasai serta memeliharanya sekarang?',
  varian=['Apa saja harta {HILANG} yang masih ada, dan siapa yang sekarang menguasainya?'],
  hal='harta yang ditinggalkan orang yang hilang dan penguasanya', m='harta yang ditinggalkan {HILANG} dan penguasanya',
  K=(['harta yang ditinggalkan {HILANG} beserta yang menguasai dan memeliharanya sekarang adalah #4922#', '{HILANG} meninggalkan harta dan penguasaannya sekarang ialah #4922#'],
     ['harta milik {HILANG} yang ditinggalkan dan masih ada sampai sekarang yaitu #4922#', 'keadaan harta {HILANG} dan siapa yang memeliharanya sekarang adalah #4922#']),
  P=(['{HILANG} meninggalkan harta yang sekarang dipelihara keluarganya', 'harta {HILANG} sekarang dipelihara oleh keluarganya'],
     ['harta milik {HILANG} masih dipelihara oleh keluarga', 'keluarga {HILANG} memelihara harta yang ditinggalkannya']),
  A=['harta {HILANG} dikuasai dan dipelihara oleh keluarga yang ditinggalkannya', 'keluarga yang ditinggalkan {HILANG} yang menguasai dan memelihara hartanya'],
  B=['harta {HILANG} dikuasai oleh orang lain di luar keluarga intinya', 'sebagian harta {HILANG} dikuasai pihak lain di luar keluarganya'],
  beda_pada='pelaku', beda_maksud='versi A: dikuasai keluarga yang ditinggalkan; versi B: dikuasai pihak lain - berselisih pada PELAKU')

S(id='harta-dialihkan', pokok='pp-mf-harta-alih', urut_abs=104, keadaan={'hartaDitinggal': 'ada'}, tingkat='jarang',
  teks='Apakah ada harta {HILANG} yang sudah dijual atau dipindahtangankan sejak ia pergi?',
  varian=['Sejak {HILANG} pergi, apakah hartanya pernah dijual atau dialihkan kepada orang lain?'],
  hal='pengalihan harta orang yang hilang sejak ia pergi', m='pengalihan harta {HILANG} sejak ia pergi',
  K=(['harta {HILANG} tidak pernah dijual atau dialihkan kepada orang lain sejak ia pergi', 'sejak {HILANG} pergi hartanya tidak dipindahtangankan kepada siapa pun'],
     ['harta {HILANG} tetap utuh dan tidak pernah dialihkan sejak ia pergi', 'selama {HILANG} pergi tidak ada hartanya yang dijual atau dipindahtangankan']),
  P=(['harta {HILANG} tidak dijual oleh keluarganya', 'harta {HILANG} tidak dialihkan'],
     ['sebagian harta {HILANG} tidak dijual', 'harta {HILANG} tidak berpindah tangan']),
  A=['harta {HILANG} tidak ada yang dijual sejak ia pergi', 'sejak {HILANG} pergi tidak ada hartanya yang dijual'],
  B=['sebagian harta {HILANG} dijual untuk kebutuhan keluarganya', 'keluarga menjual sebagian harta {HILANG} untuk kebutuhan hidup'],
  beda_pada='peristiwa', beda_maksud='versi A: tidak ada harta yang dijual; versi B: sebagian dijual untuk kebutuhan keluarga - berselisih pada PERISTIWA')

S(id='hak-tertahan', pokok='pp-mf-hak-tertahan', urut_abs=106, kelompok='akibat', tingkat='tambahan',
  teks='Hak apa saja dari istri, anak, atau ahli waris {HILANG} yang tertahan karena belum jelas hidup atau matinya?',
  varian=['Apa saja hak keluarga {HILANG}, seperti nafkah atau bagian harta, yang terhambat sejak ia pergi?'],
  hal='hak keluarga orang yang hilang yang tertahan', m='hak keluarga {HILANG} yang tertahan',
  K=(['karena keadaan {HILANG} belum jelas hak keluarganya seperti nafkah dan bagian harta tertahan', 'sejak {HILANG} pergi hak keluarganya atas nafkah dan harta terhambat karena belum jelas hidup atau matinya'],
     ['hak keluarga {HILANG} atas nafkah serta pembagian harta tertahan karena kepastiannya belum ada', 'selama {HILANG} tidak diketahui nasibnya hak keluarganya yang menyangkut harta dan nafkah terhambat']),
  P=(['hak keluarga {HILANG} atas harta dan nafkah terhambat', 'sejak {HILANG} pergi urusan harta keluarganya terhambat'],
     ['hak keluarga {HILANG} atas nafkah tertahan', 'pembagian harta {HILANG} tertahan']),
  A=['hak keluarga {HILANG} atas bagian harta tertahan sejak ia pergi', 'sejak {HILANG} pergi bagian harta keluarganya tertahan'],
  B=['hak keluarga {HILANG} atas nafkah yang tertahan sejak ia pergi', 'sejak {HILANG} pergi nafkah keluarganya yang terhambat'],
  beda_pada='peristiwa', beda_maksud='versi A: yang tertahan bagian harta; versi B: yang tertahan nafkah - berselisih pada PERISTIWA')

S(id='ahli-waris-lain', pokok='pp-mf-ahli-waris-lain', urut_abs=112, keadaan={'kepentingan': 'B'}, tingkat='tambahan',
  teks='Siapa saja ahli waris lain dari {HILANG} dan apakah mereka mengetahui serta menyetujui permohonan ini?',
  varian=['Apakah ahli waris {HILANG} yang lain sudah tahu dan setuju dengan permohonan ini?'],
  hal='ahli waris lain orang yang hilang dan sikap mereka terhadap permohonan', m='ahli waris lain {HILANG} dan sikap mereka terhadap permohonan',
  K=(['ahli waris lain dari {HILANG} sudah mengetahui permohonan ini dan tidak ada yang berkeberatan', 'semua ahli waris lain {HILANG} mengetahui permohonan ini dan tidak seorang pun menolak'],
     ['ahli waris {HILANG} yang lain mengetahui permohonan ini dan tidak ada yang menyatakan keberatan', 'seluruh ahli waris lain {HILANG} paham maksud permohonan ini dan tidak ada yang menolaknya']),
  P=(['ahli waris lain {HILANG} mengetahui permohonan ini', 'ahli waris lain {HILANG} sudah mengetahui maksud permohonan ini'],
     ['sebagian ahli waris lain {HILANG} mengetahui permohonan ini', 'ahli waris {HILANG} yang lain sudah mengetahui adanya permohonan ini']),
  A=['ahli waris lain {HILANG} menyetujui permohonan ini', 'semua ahli waris lain {HILANG} setuju atas permohonan ini'],
  B=['ada ahli waris lain {HILANG} yang belum setuju atas permohonan ini', 'sebagian ahli waris lain {HILANG} belum menyetujui permohonan ini'],
  beda_pada='pelaku', beda_maksud='versi A: semua ahli waris lain menyetujui; versi B: sebagian belum setuju - berselisih pada PELAKU')

S(id='bukti-surat', pokok='pp-mf-bukti-surat', urut_abs=116,
  teks='Surat apa saja yang diajukan {PEM} untuk membuktikan hilangnya {HILANG} dan apakah isinya sesuai dengan yang saksi ketahui?',
  varian=['Apa saja bukti tertulis yang diajukan {PEM} tentang {HILANG}, dan cocokkah isinya dengan yang saksi ketahui?'],
  hal='bukti surat tentang hilangnya orang yang hilang', m='bukti surat yang diajukan {PEM} tentang hilangnya {HILANG}',
  K=(['bukti surat yang diajukan {PEM} untuk membuktikan hilangnya {HILANG} adalah #9873# dan isinya sesuai dengan yang saya ketahui',
      'surat-surat yang diajukan {PEM} tentang {HILANG} yaitu #9873# isinya cocok dengan keadaan yang saya ketahui'],
     ['alat bukti surat {PEM} mengenai hilangnya {HILANG} berupa #9873# dan keterangan di dalamnya sesuai dengan yang saya ketahui',
      'bukti tertulis tentang {HILANG} yang diajukan {PEM} yaitu #9873# dan isinya sama dengan yang saya ketahui']),
  P=(['{PEM} mengajukan bukti surat tentang hilangnya {HILANG}', '{PEM} memegang surat yang berkaitan dengan hilangnya {HILANG}'],
     ['{PEM} mempunyai surat mengenai hilangnya {HILANG}', 'ada surat tentang {HILANG} yang diajukan {PEM}']),
  A=['isi surat yang diajukan {PEM} sesuai dengan keadaan {HILANG} yang saya ketahui', 'surat bukti {PEM} cocok dengan keadaan {HILANG} yang saya ketahui'],
  B=['isi surat yang diajukan {PEM} berbeda dengan keadaan {HILANG} yang saya ketahui', 'ada isi surat bukti {PEM} yang lain dari keadaan {HILANG} yang saya ketahui'],
  beda_pada='peristiwa', beda_maksud='versi A: isi surat sesuai keadaan yang diketahui saksi; versi B: berbeda - berselisih pada PERISTIWA')

# ---- pengumuman, keberatan, kepentingan, kesanggupan ----------------------------------------------------------------------
S(id='pengumuman-cara', pokok='pp-mf-pengumuman-cara', urut_abs=122, kelompok='upaya',
  teks='Dengan cara apa dan berapa lama permohonan ini diumumkan kepada masyarakat?',
  varian=['Bagaimana dan selama berapa lama permohonan ini diumumkan kepada masyarakat?'],
  hal='cara dan jangka waktu pengumuman permohonan', m='cara dan jangka waktu pengumuman permohonan',
  K=(['permohonan ini diumumkan dengan cara dan jangka waktu sebagai berikut yaitu #9868#', 'pengumuman permohonan ini dilakukan dengan cara #9868#'],
     ['cara dan lama pengumuman permohonan ini adalah #9868#', 'masyarakat mendapat pengumuman tentang permohonan ini melalui #9868#']),
  P=(['permohonan ini sudah diumumkan kepada masyarakat', 'permohonan ini telah diumumkan di tempat umum'],
     ['masyarakat sudah mendapat pengumuman permohonan ini', 'pengumuman permohonan ini sudah dipasang']),
  A=['pengumuman permohonan ini dipasang di tempat umum dalam jangka waktu yang cukup', 'permohonan ini diumumkan di tempat umum selama jangka waktu yang cukup'],
  B=['permohonan ini diumumkan hanya sebentar di tempat umum', 'pengumuman permohonan ini dipasang hanya dalam waktu singkat'],
  beda_pada='lama', beda_maksud='versi A: diumumkan dalam jangka waktu yang cukup; versi B: hanya sebentar - berselisih pada LAMA')

S(id='pengumuman-hasil', pokok='pp-mf-pengumuman-hasil', urut_abs=124, kelompok='upaya',
  teks='Setelah permohonan ini diumumkan, apakah ada orang yang memberi kabar tentang {HILANG} atau menyatakan keberatan?',
  varian=['Sejak pengumuman, adakah orang yang melapor tentang {HILANG} atau menyampaikan keberatan?'],
  hal='hasil pengumuman permohonan', m='hasil pengumuman permohonan mengenai {HILANG}',
  K=(['hasil pengumuman permohonan ini mengenai {HILANG} adalah #9869#', 'sejak pengumuman dilakukan keadaan yang terjadi tentang {HILANG} adalah #9869#'],
     ['setelah permohonan ini diumumkan hasilnya mengenai {HILANG} yaitu #9869#', 'pengumuman permohonan ini menghasilkan keadaan sebagai berikut tentang {HILANG} yaitu #9869#']),
  P=(['sejak pengumuman belum ada orang yang memberi kabar tentang {HILANG}', 'setelah pengumuman belum ada yang melapor tentang {HILANG}'],
     ['sampai sekarang belum ada petunjuk tentang {HILANG} setelah pengumuman', 'belum ada orang yang menyampaikan kabar mengenai {HILANG} sejak pengumuman']),
  A=['setelah pengumuman tidak ada orang yang memberi kabar tentang {HILANG}', 'sejak pengumuman tidak seorang pun melapor tentang {HILANG}'],
  B=['setelah pengumuman ada orang yang menyampaikan kabar tentang {HILANG}', 'sejak pengumuman seseorang melapor tentang {HILANG}'],
  beda_pada='peristiwa', beda_maksud='versi A: tidak ada yang memberi kabar sejak pengumuman; versi B: ada yang memberi kabar - berselisih pada PERISTIWA')

S(id='keberatan-keluarga', pokok='pp-mf-keberatan', urut_abs=126,
  teks='Apakah ada anggota keluarga {HILANG} yang keberatan atau menentang permohonan ini?',
  varian=['Adakah keluarga {HILANG} yang tidak setuju atau mempersoalkan permohonan ini?'],
  hal='keberatan keluarga orang yang hilang terhadap permohonan', m='ada atau tidaknya keberatan keluarga {HILANG} terhadap permohonan',
  K=(['tidak ada anggota keluarga {HILANG} yang berkeberatan atas permohonan ini', 'keluarga {HILANG} tidak ada yang menentang permohonan ini'],
     ['semua keluarga {HILANG} tidak mempersoalkan permohonan ini', 'tidak seorang pun dari keluarga {HILANG} menyatakan keberatan atas permohonan ini']),
  P=(['sebagian keluarga {HILANG} tidak berkeberatan atas permohonan ini', 'keluarga {HILANG} yang saya kenal tidak menentang permohonan ini'],
     ['keluarga {HILANG} yang saya temui tidak mempersoalkan permohonan ini', 'anggota keluarga {HILANG} yang saya kenal tidak keberatan']),
  A=['keluarga {HILANG} tidak ada yang berkeberatan atas permohonan ini', 'tidak ada keluarga {HILANG} yang menentang permohonan ini'],
  B=['ada keluarga {HILANG} yang berkeberatan atas permohonan ini', 'seorang keluarga {HILANG} menentang permohonan ini'],
  beda_pada='pelaku', beda_maksud='versi A: tidak ada keluarga yang keberatan; versi B: ada keluarga yang keberatan - berselisih pada PELAKU',
  mr=(['saya mendengar sendiri keluarga {HILANG} menyatakan tidak berkeberatan atas permohonan ini',
       'saya mendengar langsung keluarga {HILANG} mengatakan tidak menentang permohonan ini',
       'saat itu saya berada di dekat mereka dan mendengar keluarga {HILANG} berkata tidak mempersoalkan permohonan ini',
       'pernyataan tidak berkeberatan dari keluarga {HILANG} saya dengar sendiri waktu itu'],
      ['ucapan keluarga {HILANG} yang tidak menentang permohonan ini terdengar oleh saya',
       'di hadapan saya keluarga {HILANG} berkata tidak keberatan atas permohonan ini',
       'saya mendengar keluarga {HILANG} mengatakan tidak mempersoalkan permohonan ini',
       'perkataan keluarga {HILANG} bahwa mereka tidak menentang permohonan ini terdengar di hadapan saya']))

S(id='kawin-kembali', pokok='pp-mf-kawin-kembali', urut_abs=132, kelompok='akibat', tingkat='tambahan',
  keadaan={'kepentingan': 'C', 'kepentinganLain': 'kawin-kembali'},
  teks='Apakah {PEM} memerlukan kepastian hukum tentang keadaan {HILANG} karena hendak menikah kembali?',
  varian=['Apakah {PEM} berencana menikah kembali sehingga memerlukan kejelasan status {HILANG}?'],
  hal='kebutuhan pemohon atas kepastian hukum untuk menikah kembali', m='kebutuhan {PEM} atas kepastian hukum untuk menikah kembali',
  K=(['{PEM} memerlukan kepastian hukum tentang {HILANG} karena hendak menikah kembali', '{PEM} perlu kejelasan status {HILANG} agar dapat melangsungkan perkawinan baru'],
     ['keinginan {PEM} menikah kembali bergantung pada kejelasan status {HILANG}', '{PEM} hendak melangsungkan perkawinan baru sehingga membutuhkan kepastian tentang {HILANG}']),
  P=(['{PEM} hendak menikah kembali', '{PEM} berencana melangsungkan perkawinan baru'],
     ['{PEM} ingin menikah lagi', '{PEM} bermaksud kawin lagi']),
  A=['ada rencana {PEM} menikah kembali dalam waktu dekat', 'dalam waktu dekat {PEM} berencana menikah lagi'],
  B=['{PEM} belum berencana menikah kembali dan hanya menginginkan kepastian status', '{PEM} belum mempunyai rencana menikah lagi dan sekadar ingin kepastian status'],
  beda_pada='peristiwa', beda_maksud='versi A: ada rencana menikah kembali; versi B: belum ada rencana, hanya ingin kepastian - berselisih pada PERISTIWA')

S(id='kesanggupan', pokok='pp-mf-kesanggupan', urut_abs=134, kelompok='akibat', tingkat='tambahan',
  teks='Apakah {PEM} menyatakan sanggup menjaga hak {HILANG} apabila ia kembali dan dapat dihubungi?',
  varian=['Apakah {PEM} bersedia mengembalikan hak {HILANG} jika suatu hari ia kembali?'],
  hal='kesanggupan pemohon menjaga hak orang yang hilang bila ia kembali', m='kesanggupan {PEM} menjaga hak {HILANG} bila ia kembali',
  K=(['{PEM} menyatakan sanggup menjaga hak {HILANG} dan mengembalikannya apabila ia kembali', '{PEM} bersedia memelihara hak {HILANG} serta menyerahkannya bila ia kembali'],
     ['{PEM} berjanji menjaga hak milik {HILANG} dan akan mengembalikannya jika ia muncul kembali', 'apabila {HILANG} kembali {PEM} sanggup menyerahkan haknya yang dijaga selama ia pergi']),
  P=(['{PEM} bersedia menjaga hak {HILANG}', '{PEM} sanggup memelihara hak milik {HILANG}'],
     ['{PEM} berjanji menjaga hak {HILANG}', '{PEM} siap menjaga hak {HILANG}']),
  A=['{PEM} sanggup menjaga hak {HILANG} sampai ia kembali', '{PEM} bersedia menjaga hak {HILANG} hingga ia pulang'],
  B=['{PEM} hanya bersedia menjaga hak {HILANG} untuk sementara waktu', '{PEM} sanggup menjaga hak {HILANG} hanya untuk jangka waktu tertentu'],
  beda_pada='lama', beda_maksud='versi A: sanggup menjaga sampai ia kembali; versi B: hanya untuk sementara - berselisih pada LAMA',
  mr=(['saya mendengar sendiri {PEM} menyatakan sanggup menjaga hak {HILANG}',
       'saya mendengar langsung {PEM} mengatakan bersedia mengembalikan hak {HILANG} bila ia kembali',
       'saat itu saya berada dekat dan mendengar {PEM} berjanji menjaga hak {HILANG}',
       'janji {PEM} untuk menjaga hak {HILANG} saya dengar sendiri'],
      ['ucapan {PEM} tentang kesanggupannya menjaga hak {HILANG} terdengar oleh saya',
       'di hadapan saya {PEM} berkata bersedia mengembalikan hak {HILANG} bila ia kembali',
       'saya mendengar {PEM} mengatakan sanggup menyerahkan hak {HILANG} jika ia kembali',
       'perkataan {PEM} bahwa ia akan menjaga hak {HILANG} terdengar di hadapan saya']))

CATATAN = [
    'Pilih keadaan perkara (status perkawinan orang yang hilang, kedudukan pemohon, jenis kepentingan lain, serta ada tidaknya harta dan anak yang ditinggalkan) agar pertanyaan yang tampil sesuai; pilihan itu hanya menentukan pertanyaan, bukan putusan.',
    'Lamanya tidak ada kabar ditanyakan sebagai fakta (isian lama tidak ada kabar); katalog ini tidak menetapkan tenggat tahun sebagai syarat, dan keberlakuan ketentuan tentang ketidakhadiran bagi perkara mafqud masih perlu diperiksa oleh majelis.',
    'Pertanyaan dan jawaban hanyalah kerangka dari isian perkara; titik-titik (...) pada keterangan saksi wajib diganti dengan keterangan saksi yang sesungguhnya.',
]

VARBARU = ['4920', '4921', '4922', '4923', '9862', '9868', '9869', '9873']


def KELUARAN_TAMBAHAN(k):
    """Menyisipkan jawaban 'mendengar' tulis tangan dan menghitung ulang variabelAbt/variabelBaru."""
    ada = set()
    for q in k['pertanyaan']:
        if q['id'] in MR:
            maksud, s1, s2 = MR[q['id']]
            tpl = lambda t: t.replace('{HILANG}', '#9860#').replace('{PEM}', '#0046#')  # noqa: E731
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
