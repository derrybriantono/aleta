# -*- coding: utf-8 -*-
"""Pembangun katalog saksi PENUNJUKAN WALI OLEH PENGADILAN (jenis SIPP 356) -> ekstensi-sipp/saksi-katalog/penunjukan-wali.json (skema saksi-katalog/1).
Jalankan: python katalog_356.py   (menulis berkas JSON; lalu: node ../alat/periksa_katalog.cjs penunjukan-wali.json)

Sumber pokok pembuktian: syarat calon wali (PP 29/2019 Pasal 3-7), tata cara (Pasal 9, 11-12), sebab anak membutuhkan wali (UU 23/2002 jo. UU 35/2014 Pasal 26 ayat (2), 33;
Pasal 50-51, 53 ayat (2) UU 1/1974; Pasal 107 KHI). Penanda: #7036# pemohon, #4406# nama anak, #4407# anak / anak-anak (U4) dan isian 3860-3868 (variabel_356.py).
"""
import json
import os
import re

SINI = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(SINI, '..', '..', '..'))
TUJUAN = os.path.join(REPO, 'ekstensi-sipp', 'saksi-katalog', 'penunjukan-wali.json')
UMUM = os.path.join(REPO, 'ekstensi-sipp', 'saksi-katalog', 'perwalian.json')   # sumber dasar hukum umum (HIR / RBg) yang sudah terverifikasi

# ------------------------------------------------------------------------------------------------------------------------------------------
# dasar hukum
# ------------------------------------------------------------------------------------------------------------------------------------------
NASKAH = 'D:/aleta-dev/kerja/referensi/_unduhan/'
_asal = json.load(open(UMUM, encoding='utf-8'))
_umum = {x['id']: x for x in _asal['dasarHukum']}
DASAR = [_umum[i] for i in ('dh-hir-171', 'dh-hir-169', 'dh-hir-172', 'dh-saksi-materiil', 'dh-saksi-formil')]
DASAR += [
    {'id': 'dh-uu1-74-50-51', 'rujukan': 'Pasal 50 ayat (1) dan (2) serta Pasal 51 ayat (2) dan (3) UU 1/1974 tentang Perkawinan',
     'uraian': 'anak yang belum berumur 18 tahun atau belum pernah kawin dan tidak berada di bawah kekuasaan orang tua berada di bawah kekuasaan wali yang meliputi pribadi dan harta anak; wali sedapat-dapatnya dari keluarga anak atau orang lain yang dewasa, berpikiran sehat, adil, jujur dan berkelakuan baik',
     'status': 'terverifikasi', 'sumber': 'naskah BPK (uu1-1974/uu1-1974-bpk.txt), dibaca 21 Okt 2026'},
    {'id': 'dh-uu1-74-53', 'rujukan': 'Pasal 53 ayat (2) UU 1/1974 tentang Perkawinan',
     'uraian': 'dalam hal kekuasaan seorang wali dicabut, oleh Pengadilan ditunjuk orang lain sebagai wali',
     'status': 'terverifikasi', 'sumber': 'naskah BPK (uu1-1974/uu1-1974-bpk.txt), dibaca 21 Okt 2026'},
    {'id': 'dh-khi-107', 'rujukan': 'Pasal 107 ayat (1) sampai dengan (4) Kompilasi Hukum Islam',
     'uraian': 'perwalian hanya terhadap anak yang belum berumur 21 tahun dan atau belum kawin serta meliputi diri dan harta; bila wali tidak mampu berbuat atau lalai Pengadilan Agama dapat menunjuk kerabat sebagai wali; wali dari keluarga anak atau orang lain yang dewasa, berpikiran sehat, adil, jujur dan berkelakuan baik, atau badan hukum',
     'status': 'terverifikasi', 'sumber': 'khi/khi-pasalid.json kunci 107, dibaca 21 Okt 2026'},
    {'id': 'dh-uu35-2014-26-33', 'rujukan': 'Pasal 26 ayat (2) dan Pasal 33 ayat (1) sampai dengan (4) UU 23/2002 sebagaimana diubah UU 35/2014',
     'uraian': 'bila orang tua tidak ada, tidak diketahui keberadaannya, atau tidak dapat melaksanakan kewajibannya kewajiban beralih kepada keluarga; bila orang tua dan keluarga tidak dapat, seseorang atau badan hukum yang memenuhi persyaratan ditunjuk sebagai wali melalui penetapan pengadilan, seagama dengan anak, mengelola harta anak',
     'status': 'terverifikasi', 'sumber': 'ekstra/uu35-2014.txt (Pasal 26 dan 33 berbunyi sebagaimana diubah), dibaca 21 Okt 2026'},
    {'id': 'dh-pp29-2019-3-9', 'rujukan': 'Pasal 3 ayat (1) sampai dengan (4) dan Pasal 9 ayat (1) dan (4) PP 29/2019 tentang Syarat dan Tata Cara Penunjukan Wali',
     'uraian': 'calon wali dari Keluarga Anak, Saudara, orang lain, atau badan hukum dengan urutan keutamaan; permohonan disampaikan calon wali kepada Pengadilan dan wali dinyatakan setelah ada penetapan Pengadilan',
     'status': 'terverifikasi', 'sumber': 'ekstra/pp29-2019.txt, dibaca 21 Okt 2026'},
    {'id': 'dh-pp29-2019-4-7', 'rujukan': 'Pasal 4, 5, 6 dan 7 PP 29/2019 tentang Syarat dan Tata Cara Penunjukan Wali',
     'uraian': 'syarat calon wali: warga negara Indonesia berdomisili tetap, umur paling rendah 30 tahun (Keluarga Anak dan orang lain) atau 21 tahun (Saudara), sehat fisik dan mental, berkelakuan baik, mampu secara ekonomi, seagama dengan anak, persetujuan suami atau istri, surat pernyataan kesediaan dan tidak melakukan kekerasan, persetujuan Orang Tua, dan persetujuan Anak bagi Saudara dan orang lain',
     'status': 'terverifikasi', 'sumber': 'ekstra/pp29-2019.txt, dibaca 21 Okt 2026'},
    {'id': 'dh-pp29-2019-11-12', 'rujukan': 'Pasal 11 dan Pasal 12 PP 29/2019 tentang Syarat dan Tata Cara Penunjukan Wali',
     'uraian': 'calon wali melampirkan rekomendasi dinas sosial kabupaten/kota setempat yang menjadi bahan pertimbangan dan dibuat berdasarkan asesmen pekerja sosial profesional',
     'status': 'terverifikasi', 'sumber': 'ekstra/pp29-2019.txt, dibaca 21 Okt 2026'},
    {'id': 'dh-pp29-2019-2-14', 'rujukan': 'Pasal 2, Pasal 14 dan Pasal 19 PP 29/2019 tentang Syarat dan Tata Cara Penunjukan Wali',
     'uraian': 'penunjukan wali bertujuan melindungi hak dan memenuhi kebutuhan dasar anak serta mengelola harta anak; kewajiban wali mengasuh, memelihara, mendidik, melindungi, mengelola harta, dan mewakili anak; pada berakhirnya wali seseorang atau badan hukum dapat ditunjuk sebagai wali pengganti',
     'status': 'terverifikasi', 'sumber': 'ekstra/pp29-2019.txt, dibaca 21 Okt 2026'},
]
ID_DASAR = {x['id'] for x in DASAR}

# ------------------------------------------------------------------------------------------------------------------------------------------
# keadaan
# ------------------------------------------------------------------------------------------------------------------------------------------
KEADAAN = {
    'kategoriWali': {'sumber': 'borang', 'nilai': ['keluarga-anak', 'saudara', 'orang-lain', 'badan-hukum'], 'bawaan': 'keluarga-anak',
                     'label': 'Kedudukan calon wali menurut PP 29/2019',
                     'labelNilai': {'keluarga-anak': 'Keluarga Anak (keluarga sedarah garis lurus ke atas, mis. kakek, nenek)', 'saudara': 'Saudara (kerabat menyamping, mis. kakak, paman, bibi)',
                                    'orang-lain': 'Orang lain', 'badan-hukum': 'Badan hukum (yayasan atau lembaga pengasuhan)'}},
    'sebabWali': {'sumber': 'borang', 'nilai': ['orang-tua-meninggal', 'orang-tua-tidak-diketahui', 'orang-tua-tidak-mampu', 'wali-dicabut', 'wali-berakhir'], 'jamak': True, 'bawaan': ['orang-tua-meninggal'],
                  'label': 'Sebab anak membutuhkan wali',
                  'labelNilai': {'orang-tua-meninggal': 'Kedua orang tua meninggal dunia', 'orang-tua-tidak-diketahui': 'Keberadaan orang tua tidak diketahui',
                                 'orang-tua-tidak-mampu': 'Orang tua tidak dapat melaksanakan kewajibannya', 'wali-dicabut': 'Kekuasaan wali sebelumnya dicabut',
                                 'wali-berakhir': 'Wali sebelumnya meninggal, tidak mampu, atau lalai'}},
    'statusCalonWali': {'sumber': 'borang', 'nilai': ['menikah', 'belum-menikah'], 'bawaan': 'menikah', 'label': 'Status perkawinan calon wali',
                        'labelNilai': {'menikah': 'Calon wali sudah menikah (perlu persetujuan suami atau istri)', 'belum-menikah': 'Calon wali belum menikah atau tidak bersuami atau beristri'}},
    'hartaAnak': {'sumber': 'borang', 'nilai': ['tidak-ada', 'ada'], 'bawaan': 'tidak-ada', 'label': 'Anak mempunyai harta atau hak yang perlu dikelola wali'},
    'rekomendasiDinas': {'sumber': 'borang', 'nilai': ['belum', 'ada'], 'bawaan': 'belum', 'label': 'Ada rekomendasi atau penilaian dinas sosial',
                         'labelNilai': {'belum': 'Belum ada rekomendasi dinas sosial', 'ada': 'Ada rekomendasi dinas sosial'}},
}

# ------------------------------------------------------------------------------------------------------------------------------------------
# pokok pembuktian
# ------------------------------------------------------------------------------------------------------------------------------------------
def pokok(i, judul, uraian, dasar, wajib):
    assert all(d in ID_DASAR for d in dasar), (i, dasar)
    return {'id': i, 'judul': judul, 'uraian': uraian, 'dasarHukum': dasar, 'wajib': wajib}


SAKSI = ['dh-hir-171', 'dh-hir-169', 'dh-saksi-materiil', 'dh-saksi-formil']
POKOK = [
    pokok('pp-wb-hubungan-saksi', 'Hubungan saksi dengan pemohon dan anak serta maksud perkara', 'saksi menerangkan hubungannya dengan calon wali dan anak serta mengetahui maksud permohonan', SAKSI, True),
    pokok('pp-wb-anak', 'Anak belum dewasa dan belum pernah menikah', 'anak yang dimohonkan perwaliannya masih di bawah batas umur dan belum pernah kawin', ['dh-uu1-74-50-51', 'dh-khi-107'], True),
    pokok('pp-wb-sebab', 'Sebab anak tidak berada di bawah kekuasaan orang tua dan membutuhkan wali', 'orang tua meninggal, tidak diketahui keberadaannya, tidak dapat melaksanakan kewajiban, atau wali sebelumnya dicabut atau berakhir',
          ['dh-uu35-2014-26-33', 'dh-pp29-2019-3-9', 'dh-uu1-74-53', 'dh-khi-107', 'dh-pp29-2019-2-14'], True),
    pokok('pp-wb-pengasuhan', 'Pengasuhan nyata anak', 'siapa yang mengasuh anak saat ini dan bagaimana kebutuhan, pendidikan, serta kesehatannya terpenuhi', ['dh-pp29-2019-2-14', 'dh-uu35-2014-26-33'], True),
    pokok('pp-wb-kedudukan', 'Kedudukan calon wali terhadap anak dan urutan keutamaan', 'calon wali termasuk Keluarga Anak, Saudara, orang lain, atau badan hukum, dan tidak ada keluarga yang lebih utama', ['dh-pp29-2019-3-9', 'dh-pp29-2019-4-7'], True),
    pokok('pp-wb-kepatutan', 'Kelayakan pribadi calon wali', 'umur, kesehatan, kelakuan, dan tidak pernah melakukan kekerasan atau penelantaran terhadap anak', ['dh-pp29-2019-4-7', 'dh-khi-107', 'dh-uu1-74-50-51'], True),
    pokok('pp-wb-ekonomi', 'Kemampuan ekonomi calon wali', 'calon wali mampu secara ekonomi untuk memenuhi kebutuhan anak', ['dh-pp29-2019-4-7'], True),
    pokok('pp-wb-agama', 'Kesamaan agama calon wali dengan anak', 'calon wali dan anak beragama Islam', ['dh-uu35-2014-26-33', 'dh-pp29-2019-4-7'], True),
    pokok('pp-wb-persetujuan', 'Kesediaan dan persetujuan', 'kesediaan calon wali serta persetujuan suami atau istri, Orang Tua yang masih ada, dan Anak', ['dh-pp29-2019-4-7'], True),
    pokok('pp-wb-keberatan', 'Tidak ada keberatan dari keluarga', 'keluarga dan pihak lain tidak keberatan calon wali ditunjuk', ['dh-pp29-2019-3-9'], False),
    pokok('pp-wb-harta', 'Harta atau hak anak yang perlu dikelola', 'harta atau hak anak yang akan dikelola wali untuk kepentingan anak', ['dh-uu35-2014-26-33', 'dh-pp29-2019-2-14'], False),
    pokok('pp-wb-dinas', 'Penilaian dinas sosial', 'rekomendasi dinas sosial berdasarkan asesmen pekerja sosial profesional', ['dh-pp29-2019-11-12'], False),
    pokok('pp-wb-kepentingan', 'Tujuan dan kepentingan terbaik anak', 'tujuan penunjukan wali untuk melindungi hak dan memenuhi kebutuhan anak', ['dh-pp29-2019-2-14', 'dh-uu35-2014-26-33'], True),
    pokok('pp-wb-penutup', 'Penutup keterangan saksi', 'saksi menyatakan keterangannya sudah cukup', [], False),
]
ID_POKOK = {p['id'] for p in POKOK}

# ------------------------------------------------------------------------------------------------------------------------------------------
# jawaban umum baku (jenis keterangan selain melihat dan berbeda)
# ------------------------------------------------------------------------------------------------------------------------------------------
JAWABAN_UMUM = json.load(open('D:/aleta-dev/kerja/saksi/jawaban-umum-baku.json', encoding='utf-8'))

# ------------------------------------------------------------------------------------------------------------------------------------------
# bingkai kalimat "melihat" (isi inti disusun per butir; empat inti berbeda x empat bingkai berbeda untuk tiap saksi)
# ------------------------------------------------------------------------------------------------------------------------------------------
F1 = ['yang saya ketahui sendiri adalah bahwa {c}', '{c} dan hal itu saya lihat sendiri', 'berdasarkan yang saya lihat dan alami sendiri {c}', 'saya mengetahui secara langsung bahwa {c}']
F2 = ['saya menyaksikan sendiri bahwa {c}', 'sepengetahuan saya sendiri {c}', '{c} sebagaimana yang saya saksikan dengan mata kepala sendiri', 'yang saya alami langsung ialah bahwa {c}']


def bingkai(inti, f1=F1, f2=F2):
    assert len(inti) == 4, inti
    s1 = [f1[i].format(c=inti[i]) for i in range(4)]
    s2 = [f2[i].format(c=inti[(i + 2) % 4]) for i in range(4)]
    return s1, s2


def melihat(inti, maksud):
    s1, s2 = bingkai(inti)
    return {'maksud': maksud, 'saksi1': s1, 'saksi2': s2}


def berbeda(inti_a, inti_b, versi_a, versi_b, beda):
    s1, _ = bingkai(inti_a)
    _, s2 = bingkai(inti_b)
    return {'maksud': 'versi A: %s; versi B: %s - berselisih pada %s' % (versi_a, versi_b, beda.upper()), 'bedaPada': beda, 'saksi1': s1, 'saksi2': s2}


def langsung(s1, s2, maksud):
    assert len(s1) >= 4 and len(s2) >= 4
    return {'maksud': maksud, 'saksi1': s1, 'saksi2': s2}


LANGSUNG_SAJA = ['mendengar', 'de-auditu', 'sebagian', 'tidak-tahu', 'ragu', 'berbeda']
Q = []


def butir(id_, pokok_, urutan, tingkat, kelompok, keadaan, teks, varian, hal, jawab, tidak=None):
    assert pokok_ in ID_POKOK, pokok_
    b = {'id': id_, 'pokok': pokok_, 'urutan': urutan, 'tingkat': tingkat, 'kelompok': kelompok, 'pihakSaksi': ['*'], 'keadaan': keadaan, 'teks': teks,
         'teksVarian': varian, 'hal': hal, 'tidakBerlaku': tidak if tidak is not None else ([] if 'berbeda' in jawab else ['berbeda']), 'jawaban': jawab}
    kode = sorted(set(re.findall(r'#(\d{4})#', json.dumps([teks, varian, jawab], ensure_ascii=False))))
    b['variabelAbt'] = kode
    Q.append(b)


BERSAMA = {}   # keadaan kosong = selalu aktif
SEBAB = lambda *n: {'sebabWali': list(n)}   # noqa: E731
ORANG = {'kategoriWali': ['keluarga-anak', 'saudara', 'orang-lain']}

# 1. hubungan saksi ------------------------------------------------------------------------------------------------------------------------
butir('q-wb-kenal', 'pp-wb-hubungan-saksi', 101, 'inti', 'hubungan', BERSAMA, 'Apakah Saudara kenal dengan #7036#? Apa hubungan Saudara dengan #7036#?',
      ['Apakah Saudara mengenal #7036# dan apa hubungan Saudara dengan #7036#?'], 'hubungan saksi dengan pemohon',
      {'melihat': langsung(
          ['saya kenal dengan #7036# karena saya adalah {hubungan}', 'saya mengenal #7036# dengan baik dan hubungan saya dengan dia adalah {hubungan}',
           'sudah lama saya mengenal #7036# sebab saya adalah {hubungan}', 'hubungan saya dengan #7036# adalah sebagai {hubungan} sehingga saya mengenalnya'],
          ['saya kenal baik dengan #7036# sebab hubungan saya dengan dia adalah {hubungan}', 'saya mengetahui siapa #7036# karena saya adalah {hubungan}',
           'antara saya dengan #7036# ada hubungan sebagai {hubungan} sehingga saya mengenalnya', '#7036# saya kenal baik sebab saya adalah {hubungan}'],
          'saksi menerangkan hubungannya dengan pemohon sebagai hal yang dialaminya sendiri')},
      ['mendengar', 'de-auditu', 'sebagian', 'tidak-tahu', 'ragu', 'berbeda'])
butir('q-wb-kenal-anak', 'pp-wb-hubungan-saksi', 111, 'inti', 'hubungan', BERSAMA, 'Apakah Saudara kenal dengan #4407# yang dimohonkan perwaliannya? Apa hubungan Saudara dengan #4407# tersebut?',
      ['Apakah Saudara mengenal #4407# yang dimohonkan perwaliannya dan apa hubungan Saudara dengan #4407# tersebut?'], 'hubungan saksi dengan anak',
      {'melihat': langsung(
          ['saya kenal dengan #4406# karena saya adalah {hubungan} dan sering bertemu dengan anak itu', 'saya mengenal #4406# dengan baik sebab saya adalah {hubungan}',
           'hubungan saya dengan #4406# adalah {hubungan} sehingga saya mengenal anak itu', 'sudah lama saya mengenal #4406# karena saya adalah {hubungan}'],
          ['saya kenal baik dengan #4406# sebab hubungan saya dengan anak itu adalah {hubungan}', 'saya mengetahui siapa #4406# karena saya adalah {hubungan}',
           'antara saya dan #4406# ada hubungan sebagai {hubungan} sehingga saya mengenal anak itu', '#4406# saya kenal dekat sebab saya adalah {hubungan}'],
          'saksi menerangkan hubungannya dengan anak sebagai hal yang dialaminya sendiri')},
      ['mendengar', 'de-auditu', 'sebagian', 'tidak-tahu', 'ragu', 'berbeda'])
MAK_A = ['#7036# menghadap di persidangan ini untuk memohon agar ditunjuk sebagai wali bagi #4407# bernama #4406#',
         'maksud #7036# datang ke pengadilan ini adalah meminta penetapan sebagai wali bagi #4407# bernama #4406#',
         'tujuan #7036# hadir di persidangan ini ialah supaya pengadilan menunjuknya menjadi wali bagi #4407# bernama #4406#',
         '#7036# mengajukan permohonan ke pengadilan ini agar ditetapkan sebagai wali dari #4407# bernama #4406#']
MAK_B = ['#7036# menghadap di persidangan ini bukan untuk menjadi wali bagi #4407# bernama #4406# melainkan untuk keperluan lain',
         'maksud #7036# datang ke pengadilan ini bukan meminta penetapan sebagai wali bagi #4407# bernama #4406# tetapi untuk urusan yang berbeda',
         'tujuan #7036# hadir di persidangan ini bukan supaya menjadi wali bagi #4407# bernama #4406# melainkan hanya untuk mengurus suatu keperluan',
         '#7036# tidak mengajukan permohonan ini untuk ditetapkan sebagai wali dari #4407# bernama #4406# tetapi untuk maksud yang lain']
butir('q-wb-maksud', 'pp-wb-hubungan-saksi', 121, 'inti', 'pokok', BERSAMA, 'Apakah Saudara mengetahui maksud #7036# menghadap di persidangan ini?',
      ['Apa Saudara tahu untuk apa #7036# datang ke persidangan ini?'], 'maksud pemohon menghadap di persidangan ini',
      {'melihat': melihat(MAK_A, 'saksi menerangkan maksud permohonan penunjukan wali sebagai hal yang dilihat atau dialaminya sendiri'),
       'berbeda': berbeda(MAK_A, MAK_B, 'pemohon memohon ditunjuk sebagai wali', 'pemohon datang untuk keperluan lain', 'peristiwa')})

# 2. anak -------------------------------------------------------------------------------------------------------------------------------------
AN_A = ['#4406# belum dewasa karena masih di bawah umur dan belum pernah menikah', '#4406# belum dewasa dan sampai sekarang belum pernah menikah',
        '#4406# masih kecil dan belum cukup umur serta belum pernah melangsungkan perkawinan', '#4406# masih berstatus anak-anak yang belum dewasa dan belum pernah kawin']
AN_B = ['#4406# sudah dewasa dan sudah pernah menikah', '#4406# telah cukup umur dan pernah melangsungkan perkawinan',
        '#4406# telah menikah sehingga sudah dianggap dewasa', '#4406# sudah berumah tangga dan dianggap dewasa']
butir('q-wb-anak-umur', 'pp-wb-anak', 201, 'inti', 'pokok', BERSAMA, 'Siapa nama anak yang dimohonkan perwaliannya, bagaimana umurnya, dan apakah anak itu pernah menikah?',
      ['Anak siapa yang dimohonkan perwaliannya? Apakah ia sudah dewasa atau pernah menikah?'], 'umur dan status perkawinan anak yang dimohonkan perwaliannya',
      {'melihat': melihat(AN_A, 'saksi menerangkan anak belum dewasa dan belum pernah menikah sebagai hal yang dilihat atau dialaminya sendiri'),
       'berbeda': berbeda(AN_A, AN_B, 'anak belum dewasa dan belum pernah menikah', 'anak sudah dewasa atau pernah menikah', 'peristiwa')})

# 3. sebab ------------------------------------------------------------------------------------------------------------------------------------
SM_A = ['kedua orang tua kandung #4406# telah meninggal dunia, yaitu #3863#', 'ayah dan ibu kandung #4406# sudah wafat, yaitu #3863#',
        'orang tua kandung #4406# keduanya telah meninggal dunia, yaitu #3863#', '#4406# telah kehilangan ayah dan ibu karena keduanya telah meninggal dunia, yaitu #3863#']
SM_B = ['hanya salah seorang dari orang tua kandung #4406# yang telah meninggal dunia, sedangkan seorang lagi masih hidup',
        'salah satu orang tua kandung #4406# masih hidup sampai sekarang dan hanya yang seorang lagi yang meninggal dunia',
        'ibu atau ayah kandung #4406# masih ada dan hanya salah satunya yang sudah meninggal dunia',
        'orang tua kandung #4406# masih ada seorang yang hidup, yang seorang lagi telah meninggal dunia']
butir('q-wb-sebab-meninggal', 'pp-wb-sebab', 301, 'inti', 'pokok', SEBAB('orang-tua-meninggal'), 'Siapa ayah dan ibu kandung #4407# itu? Apakah keduanya sudah meninggal dunia dan sejak kapan?',
      ['Apakah orang tua kandung #4407# itu masih ada atau sudah meninggal dunia?'], 'meninggalnya kedua orang tua anak itu',
      {'melihat': melihat(SM_A, 'saksi menerangkan kedua orang tua anak telah meninggal dunia sebagai hal yang dilihat atau dialaminya sendiri'),
       'berbeda': berbeda(SM_A, SM_B, 'kedua orang tua anak telah meninggal dunia', 'hanya salah seorang orang tua yang meninggal dunia', 'jumlah')})
TD_A = ['keberadaan orang tua #4406# tidak diketahui, yaitu #3863#, dan keluarga sudah berusaha mencari tetapi tidak berhasil menemukan',
        'tempat tinggal orang tua #4406# tidak diketahui, yaitu #3863#, padahal keluarga sudah berusaha mencari tetapi tidak berhasil',
        'orang tua #4406# tidak ada kabarnya dan keberadaannya tidak diketahui, yaitu #3863#, dan upaya keluarga mencari pun gagal',
        'tidak seorang pun yang mengetahui keberadaan orang tua #4406# dan tidak ada kabar, yaitu #3863#, sedangkan pencarian keluarga gagal']
TD_B = ['keberadaan orang tua #4406# sebenarnya diketahui oleh keluarga karena masih sering berkomunikasi', 'orang tua #4406# masih bisa dihubungi oleh keluarga dan diketahui tempat tinggalnya',
        'tempat tinggal orang tua #4406# diketahui oleh keluarga yang masih berhubungan dengan orang tua itu', 'keluarga mengetahui di mana orang tua #4406# tinggal dan masih sering berkabar']
butir('q-wb-sebab-tidak-diketahui', 'pp-wb-sebab', 311, 'inti', 'pokok', SEBAB('orang-tua-tidak-diketahui'),
      'Di mana orang tua #4407# itu sekarang? Sejak kapan keberadaannya tidak diketahui dan apakah keluarga sudah berusaha mencarinya?',
      ['Apakah Saudara tahu keberadaan orang tua #4407# itu dan apa upaya keluarga mencarinya?'], 'keberadaan orang tua anak itu',
      {'melihat': melihat(TD_A, 'saksi menerangkan keberadaan orang tua anak tidak diketahui sebagai hal yang dilihat atau dialaminya sendiri'),
       'berbeda': berbeda(TD_A, TD_B, 'keberadaan orang tua tidak diketahui', 'keberadaan orang tua sebenarnya diketahui keluarga', 'peristiwa')})
TM_A = ['orang tua #4406# tidak dapat mengurus dan memenuhi kebutuhan anak itu, yaitu #3863#', 'orang tua #4406# tidak mampu menjalankan kewajiban mengasuh anak itu, yaitu #3863#',
        'kenyataannya orang tua #4406# tidak sanggup merawat dan membiayai anak itu, yaitu #3863#', 'orang tua #4406# tidak lagi dapat mengasuh anak itu sehari-hari, yaitu #3863#']
butir('q-wb-sebab-tidak-mampu', 'pp-wb-sebab', 321, 'inti', 'pokok', SEBAB('orang-tua-tidak-mampu'), 'Apa yang menyebabkan orang tua #4407# itu tidak dapat mengurus dan membiayai anaknya?',
      ['Mengapa orang tua #4407# itu tidak dapat melaksanakan kewajibannya terhadap anak itu?'], 'keadaan orang tua anak itu yang tidak dapat mengurus anaknya',
      {'melihat': melihat(TM_A, 'saksi menerangkan sebab orang tua tidak dapat melaksanakan kewajibannya sebagai hal yang dilihat atau dialaminya sendiri')})
WD_A = ['wali #4406# sebelumnya telah dicabut kekuasaannya oleh pengadilan, yaitu #3863#', 'kekuasaan wali yang sebelumnya mengurus #4406# sudah dicabut oleh pengadilan, yaitu #3863#',
        'pengadilan telah mencabut kekuasaan wali #4406# yang terdahulu, yaitu #3863#', 'perwalian atas #4406# yang terdahulu telah dicabut dengan putusan atau penetapan pengadilan, yaitu #3863#']
WD_B = ['kekuasaan wali #4406# yang terdahulu belum pernah dicabut oleh pengadilan', 'wali #4406# yang terdahulu masih menjalankan perwalian dan belum dicabut kekuasaannya',
        'sepengetahuan saya sendiri wali #4406# yang terdahulu tidak pernah dicabut kekuasaannya', 'tidak pernah ada pencabutan kekuasaan terhadap wali #4406# yang terdahulu']
butir('q-wb-sebab-wali-dicabut', 'pp-wb-sebab', 331, 'inti', 'pokok', SEBAB('wali-dicabut'), 'Siapa wali #4407# itu sebelumnya? Apakah kekuasaannya sudah dicabut oleh pengadilan dan sejak kapan?',
      ['Apakah wali yang dulu mengurus #4407# itu sudah dicabut kekuasaannya oleh pengadilan?'], 'pencabutan kekuasaan wali anak itu sebelumnya',
      {'melihat': melihat(WD_A, 'saksi menerangkan kekuasaan wali sebelumnya telah dicabut sebagai hal yang dilihat atau dialaminya sendiri'),
       'berbeda': berbeda(WD_A, WD_B, 'kekuasaan wali sebelumnya telah dicabut', 'kekuasaan wali sebelumnya belum dicabut', 'peristiwa')})
WB_A = ['wali #4406# yang terdahulu sudah tidak mengurus anak itu lagi, yaitu #3863#', 'wali #4406# yang sebelumnya tidak lagi menjalankan perwalian, yaitu #3863#',
        'perwalian #4406# yang lama tidak berlanjut lagi, yaitu #3863#', 'orang yang sebelumnya menjadi wali #4406# tidak lagi mampu menjalankan tugas perwalian, yaitu #3863#']
butir('q-wb-sebab-wali-berakhir', 'pp-wb-sebab', 341, 'inti', 'pokok', SEBAB('wali-berakhir'),
      'Apa sebab wali #4407# itu sebelumnya tidak lagi mengurus anak itu: apakah meninggal dunia, tidak mampu, atau lalai menjalankan tugasnya?',
      ['Mengapa wali yang dulu mengurus #4407# itu tidak lagi menjalankan perwalian?'], 'berakhirnya perwalian anak itu sebelumnya',
      {'melihat': melihat(WB_A, 'saksi menerangkan sebab wali sebelumnya tidak lagi menjalankan perwalian sebagai hal yang dilihat atau dialaminya sendiri')})
OP_A = ['orang tua #4406# masih ada dan menyatakan setuju #7036# menjadi wali', 'orang tua #4406# yang masih hidup merelakan dan menyetujui #7036# ditunjuk sebagai wali',
        'orang tua #4406# mengetahui permohonan ini dan telah merestui #7036# menjadi wali bagi anak itu', 'orang tua #4406# sudah memberikan persetujuan agar #7036# ditetapkan sebagai wali']
OP_B = ['orang tua #4406# keberatan #7036# menjadi wali', 'orang tua #4406# menyatakan keberatan #7036# ditunjuk sebagai wali',
        'orang tua #4406# menolak #7036# ditetapkan sebagai wali bagi anak itu', 'orang tua #4406# enggan #7036# diangkat sebagai wali']
butir('q-wb-ortu-persetujuan', 'pp-wb-persetujuan', 351, 'pilihan', 'pokok', SEBAB('orang-tua-tidak-mampu', 'wali-dicabut', 'wali-berakhir'),
      'Apakah orang tua #4407# itu masih ada dan diketahui keberadaannya? Bila masih ada, apakah ia menyetujui #7036# menjadi wali?',
      ['Apakah orang tua #4407# itu yang masih ada menyetujui #7036# menjadi wali?'], 'persetujuan orang tua anak itu',
      {'melihat': melihat(OP_A, 'saksi menerangkan orang tua anak yang masih ada menyetujui calon wali sebagai hal yang dilihat atau dialaminya sendiri'),
       'berbeda': berbeda(OP_A, OP_B, 'orang tua anak menyetujui calon wali', 'orang tua anak keberatan', 'peristiwa')})

# 4. pengasuhan ---------------------------------------------------------------------------------------------------------------------------------
PG_A = ['#4406# sekarang berada dalam asuhan #7036#, yaitu #3864#', 'pengasuhan #4406# dilakukan oleh #7036# sampai sekarang, yaitu #3864#',
        'yang mengurus kebutuhan sehari-hari #4406# saat ini adalah #7036#, yaitu #3864#', '#7036# yang memelihara #4406# selama ini, yaitu #3864#']
PG_B = ['#4406# bukan diasuh oleh #7036# melainkan oleh keluarga yang lain', 'yang mengasuh #4406# sehari-hari bukan #7036# melainkan orang lain',
        '#4406# tinggal bersama orang lain dan bukan bersama #7036#', 'pengasuhan #4406# dipegang oleh pihak lain dan bukan oleh #7036#']
butir('q-wb-pengasuhan', 'pp-wb-pengasuhan', 401, 'inti', 'pokok', BERSAMA, 'Siapa yang mengasuh #4407# itu sekarang dan sejak kapan? Di mana ia tinggal dan bagaimana keadaannya?',
      ['Sekarang #4407# itu tinggal bersama siapa dan sudah berapa lama diasuh oleh orang tersebut?'], 'pengasuhan anak itu sehari-hari',
      {'melihat': melihat(PG_A, 'saksi menerangkan pengasuhan nyata anak oleh calon wali sebagai hal yang dilihat atau dialaminya sendiri'),
       'berbeda': berbeda(PG_A, PG_B, 'anak diasuh oleh calon wali', 'anak diasuh oleh pihak lain', 'pelaku')})
PD_A = ['kebutuhan makan, pakaian, sekolah, dan kesehatan #4406# tercukupi selama diasuh oleh #7036#', 'selama dalam asuhan #7036# kebutuhan sehari-hari, pendidikan, dan kesehatan #4406# terpenuhi dengan baik',
        '#7036# memenuhi kebutuhan hidup, menyekolahkan, dan merawat kesehatan #4406# dengan baik', '#4406# terawat baik dan mendapat pendidikan serta pelayanan kesehatan selama dipelihara #7036#']
PD_B = ['kebutuhan sehari-hari, pendidikan, dan kesehatan #4406# kurang terpenuhi selama diasuh oleh #7036#', 'selama dalam asuhan #7036# pendidikan dan kesehatan #4406# sering terabaikan',
        '#7036# kurang memperhatikan kebutuhan hidup, sekolah, dan kesehatan #4406#', '#4406# kerap kekurangan dan terabaikan selama dipelihara #7036#']
butir('q-wb-pendidikan-kesehatan', 'pp-wb-pengasuhan', 411, 'inti', 'pokok', BERSAMA, 'Bagaimana kebutuhan sehari-hari, pendidikan, dan kesehatan #4407# itu selama diasuh oleh #7036#?',
      ['Apakah kebutuhan hidup, sekolah, dan kesehatan #4407# itu terpenuhi selama diasuh oleh #7036#?'], 'pemenuhan kebutuhan, pendidikan, dan kesehatan anak itu',
      {'melihat': melihat(PD_A, 'saksi menerangkan kebutuhan, pendidikan, dan kesehatan anak terpenuhi sebagai hal yang dilihat atau dialaminya sendiri'),
       'berbeda': berbeda(PD_A, PD_B, 'kebutuhan anak terpenuhi dengan baik', 'kebutuhan anak kurang terpenuhi', 'peristiwa')})
AS_A = ['#4406# menerima dan menyetujui #7036# ditunjuk sebagai walinya', '#4406# mau diasuh dan diwakili oleh #7036# sebagai walinya',
        '#4406# sudah menyatakan senang dan setuju #7036# menjadi walinya', '#4406# lapang menerima #7036# sebagai wali baginya']
AS_B = ['#4406# belum mau menerima #7036# sebagai walinya', '#4406# belum menyatakan setuju #7036# ditunjuk sebagai walinya',
        '#4406# masih belum rela diwakili oleh #7036# sebagai walinya', '#4406# belum merasa cocok jika #7036# menjadi walinya']
_ANAK_SETUJU = dict(
    teks='Apakah #4407# itu mau dan menerima #7036# sebagai walinya? Apakah ia pernah menyatakan keberatan?',
    varian=['Bagaimana sikap #4407# itu terhadap #7036# yang akan menjadi walinya?'], hal='penerimaan anak itu terhadap calon wali',
    jawab={'melihat': melihat(AS_A, 'saksi menerangkan anak menerima calon wali sebagai hal yang dilihat atau dialaminya sendiri'),
           'berbeda': berbeda(AS_A, AS_B, 'anak menerima calon wali', 'anak belum mau menerima calon wali', 'peristiwa')})
butir('q-wb-anak-setuju', 'pp-wb-persetujuan', 421, 'inti', 'pokok', {'kategoriWali': ['saudara', 'orang-lain']}, _ANAK_SETUJU['teks'], _ANAK_SETUJU['varian'], _ANAK_SETUJU['hal'], _ANAK_SETUJU['jawab'])
butir('q-wb-anak-menerima', 'pp-wb-persetujuan', 422, 'pilihan', 'pokok', {'kategoriWali': ['keluarga-anak', 'badan-hukum']}, _ANAK_SETUJU['teks'], _ANAK_SETUJU['varian'], _ANAK_SETUJU['hal'], _ANAK_SETUJU['jawab'])

# 5. kedudukan calon wali -----------------------------------------------------------------------------------------------------------------------
HK_B = ['#7036# sebenarnya bukan #3861# dari #4406# melainkan hanya kenalan biasa', 'hubungan #7036# dengan #4406# bukan #3861# melainkan hanya kenalan',
        '#7036# bukan #3861# dari #4406# melainkan orang luar yang mengenal anak itu', 'antara #7036# dan #4406# bukan hubungan #3861# melainkan sekadar pergaulan biasa']
butir('q-wb-hubungan-keluarga', 'pp-wb-kedudukan', 501, 'inti', 'hubungan', {'kategoriWali': ['keluarga-anak', 'saudara']},
      'Apa hubungan #7036# dengan #4407# itu? Termasuk keluarga garis apa dan apakah masih satu keturunan?',
      ['Bagaimana hubungan kekeluargaan antara #7036# dengan #4407# itu?'], 'hubungan kekeluargaan pemohon dengan anak itu',
      {'melihat': langsung(
          ['hubungan #7036# dengan #4406# adalah #3861# sehingga mereka masih satu keluarga', '#7036# adalah #3861# dari #4406# dan masih termasuk keluarganya',
           'saya tahu betul bahwa #7036# merupakan #3861# dari #4406# yang masih satu keluarga dengan anak itu', 'secara kekeluargaan #7036# adalah #3861# dari #4406# dan saya mengetahuinya sendiri'],
          ['antara #7036# dan #4406# ada hubungan kekerabatan sebagai #3861# yang saya ketahui sendiri', '#7036# merupakan #3861# dari #4406# dan masih satu keturunan atau satu keluarga dengan anak itu',
           'yang saya alami sendiri adalah bahwa #7036# berkedudukan sebagai #3861# dari #4406# dalam keluarga mereka', 'setahu saya sendiri #7036# adalah #3861# dari #4406# yang masih bersaudara atau berkerabat dengan anak itu'],
          'saksi menerangkan hubungan kekeluargaan pemohon dengan anak sebagai hal yang dilihat atau dialaminya sendiri'),
       'berbeda': langsung(
          ['#7036# adalah #3861# dari #4406# dan saya mengetahuinya sendiri', 'hubungan #7036# dengan #4406# adalah #3861# sebagaimana yang saya alami sendiri',
           'saya melihat sendiri bahwa #7036# berkedudukan sebagai #3861# dari #4406#', 'yang saya ketahui langsung ialah #7036# adalah #3861# dari #4406#'],
          HK_B, 'versi A: pemohon adalah keluarga anak; versi B: pemohon bukan keluarga anak - berselisih pada PELAKU')})
Q[-1]['jawaban']['berbeda']['bedaPada'] = 'pelaku'
HO_A = ['#7036# bukan keluarga #4406# tetapi mengenal anak itu karena #3861#', 'tidak ada hubungan kekeluargaan antara #7036# dengan #4406# dan kedekatan mereka karena #3861#',
        '#7036# bukan berasal dari keluarga #4406# dan hubungan mereka terjalin karena #3861#', 'yang saya ketahui #7036# bukan kerabat #4406# melainkan dekat dengan anak itu karena #3861#']
butir('q-wb-hubungan-orang-lain', 'pp-wb-kedudukan', 511, 'inti', 'hubungan', {'kategoriWali': ['orang-lain']},
      'Apa hubungan #7036# dengan #4407# itu? Bagaimana #7036# mengenal anak itu dan sejak kapan, serta mengapa bukan keluarga yang mengurusnya?',
      ['Bagaimana awalnya #7036# mengenal #4407# itu padahal bukan keluarganya dan apa hubungan #7036# dengan anak itu?'], 'hubungan pemohon dengan anak itu',
      {'melihat': melihat(HO_A, 'saksi menerangkan #7036# bukan keluarga anak dan bagaimana hubungannya sebagai hal yang dilihat atau dialaminya sendiri')})
LM_A = ['#7036# adalah #3861# yang berbadan hukum yayasan dan terakreditasi, yang mengasuh #4406# di lembaganya', '#7036# merupakan #3861# berbentuk yayasan yang terakreditasi dan menampung serta mengasuh #4406#',
        'lembaga #7036# adalah #3861# yang berbadan hukum yayasan dan terakreditasi serta telah mengasuh #4406#', '#4406# diasuh oleh #7036# yang merupakan #3861# berbadan hukum yayasan dan terakreditasi']
butir('q-wb-lembaga', 'pp-wb-kedudukan', 521, 'inti', 'hubungan', {'kategoriWali': ['badan-hukum']},
      'Apakah #7036# berbentuk yayasan yang berbadan hukum dan terakreditasi? Sejak kapan lembaga itu mengasuh #4407# tersebut?',
      ['Bagaimana status lembaga #7036# dan sejak kapan lembaga itu mengasuh #4407# tersebut?'], 'keadaan dan kedudukan lembaga pemohon',
      {'melihat': melihat(LM_A, 'saksi menerangkan status badan hukum lembaga dan pengasuhannya sebagai hal yang dilihat atau dialaminya sendiri')})
UR_A = ['keluarga #4406# dalam garis lurus ke atas sudah tidak ada atau tidak bersedia menjadi wali sehingga yang mengajukan permohonan adalah #7036#',
        'kakek dan nenek serta keluarga sedarah #4406# ke atas sudah tidak ada atau tidak bersedia, karena itu #7036# yang memohon menjadi wali',
        'keluarga #4406# dalam garis lurus ke atas sudah tidak ada atau tidak bersedia menjadi wali, sehingga #7036# mengajukan diri',
        'keluarga sedarah #4406# ke atas sudah tidak ada atau tidak sanggup, maka #7036# yang mengajukan permohonan sebagai calon wali']
UR_B = ['masih ada keluarga #4406# dalam garis lurus ke atas yang bersedia dan mampu menjadi wali', 'kakek atau nenek #4406# masih hidup dan bersedia serta mampu menjadi wali',
        'keluarga sedarah #4406# ke atas masih ada dan sanggup menjadi wali bagi anak itu', 'ada keluarga #4406# dalam garis lurus ke atas yang lebih dekat dan siap menjadi wali']
butir('q-wb-urutan', 'pp-wb-kedudukan', 531, 'inti', 'pokok', {'kategoriWali': ['saudara', 'orang-lain', 'badan-hukum']},
      'Apakah masih ada keluarga #4407# itu dalam garis lurus ke atas, misalnya kakek atau nenek, yang bersedia menjadi wali? Mengapa bukan mereka yang menjadi wali?',
      ['Apakah ada keluarga yang lebih dekat dengan #4407# itu yang sanggup menjadi wali?'], 'keluarga anak itu yang lebih dekat dan bersedia menjadi wali',
      {'melihat': melihat(UR_A, 'saksi menerangkan keluarga yang lebih utama tidak ada atau tidak bersedia sebagai hal yang dilihat atau dialaminya sendiri'),
       'berbeda': berbeda(UR_A, UR_B, 'keluarga yang lebih utama tidak ada atau tidak bersedia', 'masih ada keluarga yang lebih utama dan bersedia', 'peristiwa')})

# 6. kelayakan pribadi ---------------------------------------------------------------------------------------------------------------------------
UM_A = ['#7036# sudah dewasa dan cukup umur untuk menjadi wali bagi #4406#', '#7036# telah dewasa serta layak dari segi umur menjadi wali bagi #4406#',
        'dari segi umur #7036# sudah matang dan pantas menjadi wali bagi #4406#', 'umur #7036# sudah cukup dewasa untuk mengasuh dan mewakili #4406#']
UM_B = ['#7036# masih tergolong muda dan belum cukup umur untuk menjadi wali bagi #4406#', '#7036# belum cukup dewasa untuk mengasuh dan mewakili #4406#',
        'dari segi umur #7036# masih terlalu muda dan belum pantas menjadi wali bagi #4406#', 'umur #7036# belum matang untuk menjadi wali bagi #4406#']
butir('q-wb-umur-calon', 'pp-wb-kepatutan', 601, 'inti', 'pokok', {'kategoriWali': ['keluarga-anak', 'saudara', 'orang-lain']},
      'Apakah #7036# sudah dewasa dan cukup umur untuk menjadi wali? Perkirakan umurnya dan apakah ia warga negara Indonesia yang tinggal tetap di sini?',
      ['Apakah umur #7036# sudah cukup untuk menjadi wali?'], 'kedewasaan pemohon',
      {'melihat': melihat(UM_A, 'saksi menerangkan calon wali sudah dewasa dan cukup umur sebagai hal yang dilihat atau dialaminya sendiri'),
       'berbeda': berbeda(UM_A, UM_B, 'calon wali sudah dewasa dan cukup umur', 'calon wali belum cukup umur', 'peristiwa')})
SH_A = ['#7036# sehat jasmani dan rohani sehingga mampu mengurus #4406#', 'kesehatan jasmani dan rohani #7036# baik dan lancar dalam mengurus #4406#',
        '#7036# sehat badan dan sehat pikiran sehingga sanggup merawat #4406#', 'secara fisik dan mental #7036# sehat serta mampu menjaga #4406#']
SH_B = ['#7036# sering sakit-sakitan sehingga sulit mengurus #4406# sehari-hari', 'kesehatan #7036# sering terganggu dan menyulitkan dalam mengurus #4406#',
        '#7036# kerap sakit sehingga kurang sanggup merawat #4406#', 'secara fisik #7036# lemah dan sering menderita sakit dalam menjaga #4406#']
butir('q-wb-sehat', 'pp-wb-kepatutan', 611, 'inti', 'pokok', {'kategoriWali': ['keluarga-anak', 'saudara', 'orang-lain']}, 'Bagaimana kesehatan jasmani dan rohani #7036#?',
      ['Apakah #7036# sehat jasmani dan rohani sehingga mampu mengurus anak itu?'], 'kesehatan jasmani dan rohani pemohon',
      {'melihat': melihat(SH_A, 'saksi menerangkan calon wali sehat jasmani dan rohani sebagai hal yang dilihat atau dialaminya sendiri'),
       'berbeda': berbeda(SH_A, SH_B, 'calon wali sehat jasmani dan rohani', 'calon wali sering sakit', 'peristiwa')})
PR_A = ['#7036# berkelakuan baik, jujur dan adil, bukan pemabuk, penjudi, atau pemboros, serta tidak pernah dihukum karena perbuatan pidana',
        'sehari-hari #7036# dikenal baik, jujur, dan adil, serta bukan pemabuk, penjudi, atau pemboros dan tidak pernah dihukum',
        'perilaku #7036# terpuji di lingkungan, jujur dan adil, tidak pernah berjudi atau mabuk dan tidak pernah dihukum karena kejahatan',
        'di lingkungan tempat tinggalnya #7036# dihormati karena jujur dan berkelakuan baik, bukan pemabuk atau penjudi, dan tidak pernah dihukum']
PR_B = ['#7036# dikenal suka berjudi dan mabuk sehingga kelakuannya kurang baik di lingkungan', 'di lingkungan tempat tinggalnya #7036# dikenal suka minum minuman keras dan berjudi',
        '#7036# pernah dihukum karena suatu perbuatan pidana dan kelakuannya kurang terpuji', 'sehari-hari #7036# dikenal boros, suka berjudi, dan kurang jujur']
butir('q-wb-perilaku', 'pp-wb-kepatutan', 621, 'inti', 'pokok', {'kategoriWali': ['keluarga-anak', 'saudara', 'orang-lain']},
      'Bagaimana kelakuan #7036# sehari-hari di masyarakat? Apakah jujur dan adil, serta bukan pemabuk, penjudi, atau pemboros, dan apakah pernah dihukum?',
      ['Apakah #7036# berkelakuan baik dan pernah dihukum karena suatu tindak pidana?'], 'kelakuan pemohon sehari-hari',
      {'melihat': melihat(PR_A, 'saksi menerangkan calon wali berkelakuan baik dan tidak pernah dihukum sebagai hal yang dilihat atau dialaminya sendiri'),
       'berbeda': berbeda(PR_A, PR_B, 'calon wali berkelakuan baik', 'calon wali berkelakuan kurang baik', 'peristiwa')})
KK_A = ['#7036# tidak pernah melakukan kekerasan, penelantaran, atau hukuman fisik terhadap #4406#', 'selama mengurus #4406# #7036# tidak pernah memukul, menelantarkan, atau memperlakukan anak itu dengan kasar',
        'tidak pernah ada kekerasan atau penelantaran yang dilakukan #7036# terhadap #4406#', '#7036# memperlakukan #4406# dengan baik dan tidak pernah menghukumnya secara fisik']
KK_B = ['#7036# pernah memukul atau menelantarkan #4406#', 'selama mengurus #4406# #7036# pernah memperlakukan anak itu dengan kasar',
        'ada kekerasan yang pernah dilakukan #7036# terhadap #4406#', '#7036# pernah menghukum #4406# secara fisik']
butir('q-wb-kekerasan', 'pp-wb-kepatutan', 631, 'inti', 'pokok', {'kategoriWali': ['keluarga-anak', 'saudara', 'orang-lain', 'badan-hukum']},
      'Apakah #7036# pernah melakukan kekerasan, penelantaran, perlakuan salah, atau hukuman fisik terhadap #4407# itu?',
      ['Bagaimana perlakuan #7036# terhadap #4407# itu selama ini?'], 'perlakuan pemohon terhadap anak itu',
      {'melihat': melihat(KK_A, 'saksi menerangkan calon wali tidak pernah melakukan kekerasan atau penelantaran sebagai hal yang dilihat atau dialaminya sendiri'),
       'berbeda': berbeda(KK_A, KK_B, 'calon wali tidak pernah melakukan kekerasan', 'calon wali pernah melakukan kekerasan', 'peristiwa')})
EK_A = ['#7036# bekerja dan penghasilannya cukup untuk membiayai kehidupan keluarganya serta kebutuhan #4406#', 'dari pekerjaannya #7036# mempunyai penghasilan yang memadai untuk mencukupi kebutuhan #4406#',
        'secara ekonomi #7036# mampu dan sanggup membiayai hidup #4406#', 'penghasilan #7036# setiap bulan cukup untuk memenuhi kebutuhan hidup #4406# sehari-hari']
EK_B = ['penghasilan #7036# pas-pasan dan kurang untuk membiayai kebutuhan #4406#', 'dari pekerjaannya #7036# hanya memperoleh penghasilan yang kurang mencukupi kebutuhan #4406#',
        'secara ekonomi #7036# kurang mampu membiayai hidup #4406#', 'penghasilan #7036# setiap bulan kurang untuk memenuhi kebutuhan hidup #4406# sehari-hari']
butir('q-wb-ekonomi', 'pp-wb-ekonomi', 701, 'inti', 'pokok', {'kategoriWali': ['keluarga-anak', 'saudara', 'orang-lain', 'badan-hukum']},
      'Apa pekerjaan atau sumber penghasilan #7036# dan apakah cukup untuk membiayai kebutuhan #4407# itu?',
      ['Apakah #7036# mampu secara ekonomi untuk membiayai #4407# itu?'], 'pekerjaan dan penghasilan pemohon',
      {'melihat': melihat(EK_A, 'saksi menerangkan calon wali mampu secara ekonomi sebagai hal yang dilihat atau dialaminya sendiri'),
       'berbeda': berbeda(EK_A, EK_B, 'calon wali mampu secara ekonomi', 'calon wali kurang mampu secara ekonomi', 'peristiwa')})
AG_A = ['#7036# dan #4406# sama-sama beragama Islam dan menjalankan ibadah', 'agama #7036# dan agama #4406# sama, yaitu Islam',
        'baik #7036# maupun #4406# beragama Islam dan menjalankan ajaran agamanya', '#7036# dan #4406# adalah pemeluk agama Islam']
AG_B = ['agama #7036# berbeda dengan agama #4406#', '#7036# dan #4406# menganut agama yang berlainan', 'agama yang dianut #7036# lain dari agama #4406#', '#7036# dan #4406# berlainan agama']
butir('q-wb-agama', 'pp-wb-agama', 801, 'inti', 'pokok', BERSAMA, 'Apakah #7036# dan #4407# itu beragama Islam?',
      ['Apa agama #7036# dan apa agama #4407# itu?'], 'agama pemohon dan anak itu',
      {'melihat': melihat(AG_A, 'saksi menerangkan calon wali dan anak seagama sebagai hal yang dilihat atau dialaminya sendiri'),
       'berbeda': berbeda(AG_A, AG_B, 'calon wali dan anak seagama', 'calon wali dan anak tidak seagama', 'peristiwa')})

# 7. persetujuan dan kesediaan ---------------------------------------------------------------------------------------------------------------------
PS_MENIKAH = ['#7036# sudah menikah dan suami atau istrinya menyetujui penunjukan itu untuk menjadi wali bagi #4406#', 'pasangan #7036# mengetahui dan menyetujui rencana menjadi wali bagi #4406#',
              'suami atau istri #7036# merestui penunjukan sebagai wali bagi #4406#', '#7036# sudah mendapat persetujuan dari suami atau istrinya untuk menjadi wali bagi #4406#']
PS_LAJANG = ['#7036# belum menikah sehingga tidak ada suami atau istri yang perlu dimintai persetujuan untuk menjadi wali bagi #4406#', '#7036# tidak bersuami atau beristri sehingga tidak diperlukan persetujuan pasangan untuk menjadi wali bagi #4406#',
             'karena #7036# belum berumah tangga maka tidak ada pasangan yang harus menyetujui penunjukan sebagai wali bagi #4406#', '#7036# belum berpasangan sehingga tidak ada persetujuan suami atau istri yang dibutuhkan untuk menjadi wali bagi #4406#']
s1m, s2m = bingkai(PS_MENIKAH)
s1l, s2l = bingkai(PS_LAJANG)
butir('q-wb-pasangan', 'pp-wb-persetujuan', 901, 'inti', 'pokok', {'kategoriWali': ['keluarga-anak', 'saudara', 'orang-lain']},
      'Apakah #7036# sudah menikah? Bila sudah, apakah suami atau istrinya menyetujui #7036# menjadi wali #4407# itu?',
      ['Apakah suami atau istri #7036#, kalau ada, menyetujui #7036# menjadi wali #4407# itu?'], 'persetujuan suami atau istri pemohon',
      {'melihat': [
          {'keadaan': {'statusCalonWali': 'menikah'}, 'maksud': 'saksi menerangkan suami atau istri calon wali menyetujui sebagai hal yang dilihat atau dialaminya sendiri', 'saksi1': s1m, 'saksi2': s2m},
          {'keadaan': {'statusCalonWali': 'belum-menikah'}, 'maksud': 'saksi menerangkan calon wali belum menikah sehingga tidak ada persetujuan pasangan yang dibutuhkan', 'saksi1': s1l, 'saksi2': s2l}]})
KS_A = ['#7036# bersedia dan sanggup mengurus diri dan harta #4406# dengan sebaik-baiknya', 'kesediaan #7036# untuk mengurus dan mengelola harta #4406# dinyatakan dengan sungguh-sungguh dan ia sanggup melaksanakan kewajiban itu',
        '#7036# sanggup merawat, mendidik, dan mengelola harta #4406# untuk kepentingan anak itu', '#7036# menyatakan siap menjadi wali dan mengurus segala keperluan #4406#']
butir('q-wb-kesediaan', 'pp-wb-persetujuan', 911, 'inti', 'pokok', BERSAMA,
      'Apakah #7036# bersedia dan sanggup mengurus diri dan harta #4407# itu dengan sebaik-baiknya serta tidak akan menelantarkannya?',
      ['Apakah #7036# sanggup menjadi wali dan mengurus keperluan #4407# itu?'], 'kesediaan dan kesanggupan pemohon menjadi wali',
      {'melihat': melihat(KS_A, 'saksi menerangkan kesediaan dan kesanggupan calon wali sebagai hal yang dilihat atau dialaminya sendiri')})
KB_A = ['tidak ada keluarga atau pihak lain yang keberatan #7036# ditunjuk sebagai wali bagi #4406#', 'seluruh keluarga setuju dan tidak ada yang menolak #7036# menjadi wali bagi #4406#',
        'tak seorang pun dari keluarga yang berkeberatan #7036# menjadi wali bagi #4406#', 'keluarga maupun orang lain tidak mempermasalahkan #7036# ditunjuk sebagai wali bagi #4406#']
KB_B = ['ada keluarga yang keberatan #7036# ditunjuk sebagai wali bagi #4406#', 'sebagian keluarga menolak #7036# menjadi wali bagi #4406#',
        'kerabat tertentu menyatakan keberatan #7036# diangkat sebagai wali bagi #4406#', 'ada pihak yang mempermasalahkan #7036# menjadi wali bagi #4406#']
butir('q-wb-keberatan', 'pp-wb-keberatan', 921, 'inti', 'akibat', BERSAMA, 'Apakah ada keluarga atau pihak lain yang keberatan jika #7036# ditunjuk menjadi wali #4407# itu?',
      ['Adakah keluarga yang menolak #7036# menjadi wali #4407# itu?'], 'keberatan dari keluarga atau pihak lain',
      {'melihat': melihat(KB_A, 'saksi menerangkan tidak ada keberatan terhadap calon wali sebagai hal yang dilihat atau dialaminya sendiri'),
       'berbeda': berbeda(KB_A, KB_B, 'tidak ada keberatan terhadap calon wali', 'ada keluarga yang keberatan', 'peristiwa')})

# 8. harta, dinas, tujuan --------------------------------------------------------------------------------------------------------------------------
HA_A = ['#4406# mempunyai kepentingan harta atau hak yang perlu dikelola wali, yaitu #3868#, dan #7036# sanggup mengelolanya untuk kepentingan anak itu',
        'ada harta atau hak milik #4406# yang harus diurus, yaitu #3868#, dan #7036# sanggup mengurusnya untuk kepentingan anak itu',
        'terkait harta atau hak #4406# yaitu #3868#, #7036# sanggup mengelolanya sebaik-baiknya demi anak itu',
        'yang perlu dikelola untuk #4406# adalah #3868# dan #7036# bersedia menjadi pengelolanya demi kepentingan anak itu']
HA_B = ['pengelolaan harta atau hak milik #4406# sebaiknya dipegang orang lain dan bukan #7036#', 'yang mengurus harta atau hak #4406# seharusnya pihak lain dan bukan #7036#',
        'harta atau hak #4406# lebih tepat dikelola keluarga yang lain dan bukan #7036#', 'sepengetahuan saya harta atau hak #4406# lebih tepat diurus pihak lain dan bukan #7036#']
butir('q-wb-harta-ada', 'pp-wb-harta', 1001, 'pilihan', 'akibat', {'hartaAnak': 'ada'},
      'Apakah #4407# itu mempunyai harta atau hak yang perlu dikelola wali, dan apakah #7036# sanggup mengelolanya untuk kepentingan anak itu?',
      ['Harta atau hak apa saja milik #4407# itu yang perlu diurus dan apakah #7036# sanggup mengurusnya?'], 'harta atau hak anak itu yang perlu dikelola',
      {'melihat': melihat(HA_A, 'saksi menerangkan harta atau hak anak yang perlu dikelola dan kesanggupan calon wali sebagai hal yang dilihat atau dialaminya sendiri'),
       'berbeda': berbeda(HA_A, HA_B, 'calon wali sanggup mengelola harta anak', 'harta anak lebih tepat dikelola pihak lain', 'pelaku')})
HT_A = ['#4406# tidak mempunyai harta yang perlu dikelola wali', 'belum ada harta milik #4406# yang harus diurus wali',
        '#4406# tidak memiliki harta atau hak yang harus diurus wali', 'tidak ada harta atau hak milik #4406# yang perlu dikelola wali']
butir('q-wb-harta-tidak', 'pp-wb-harta', 1051, 'pilihan', 'akibat', {'hartaAnak': 'tidak-ada'}, 'Apakah #4407# itu mempunyai harta atau hak yang perlu dikelola wali?',
      ['Apakah ada harta milik #4407# itu yang harus diurus?'], 'harta anak itu',
      {'melihat': melihat(HT_A, 'saksi menerangkan anak tidak mempunyai harta yang perlu dikelola sebagai hal yang dilihat atau dialaminya sendiri')})
DN_A = ['petugas dinas sosial pernah datang menemui #7036# dan #4406# untuk menilai keadaan mereka', 'pekerja sosial dari dinas sosial pernah berkunjung dan memeriksa keadaan #7036# serta #4406#',
        'dinas sosial telah mengirim petugas untuk mengunjungi dan menilai kelayakan #7036# sebagai calon wali bagi #4406#', 'petugas dinas sosial pernah mendatangi rumah #7036# untuk menilai kelayakan sebagai calon wali bagi #4406#']
butir('q-wb-dinas', 'pp-wb-dinas', 1101, 'pilihan', 'akibat', {'rekomendasiDinas': 'ada'},
      'Apakah Saudara mengetahui bahwa petugas dinas sosial pernah datang untuk menilai keadaan #7036# dan #4407# itu?',
      ['Apakah pernah ada petugas dinas sosial yang menilai keadaan #7036# dan #4407# itu?'], 'penilaian oleh petugas dinas sosial',
      {'melihat': melihat(DN_A, 'saksi menerangkan petugas dinas sosial pernah menilai calon wali sebagai hal yang dilihat atau dialaminya sendiri')})
TJ_A = ['#7036# memohon ditunjuk sebagai wali agar dapat mengasuh, mendidik, dan mewakili #4406# demi kepentingan terbaik anak itu', 'tujuan #7036# menjadi wali adalah untuk mengurus diri dan harta #4406# serta mewakilinya dalam perbuatan hukum',
        '#7036# ingin menjadi wali supaya #4406# terlindungi hak dan kebutuhannya serta perbuatan hukumnya dapat diurus', 'agar #4406# ada yang mengasuh dan mewakili secara hukum, #7036# mengajukan diri sebagai walinya']
TJ_B = ['tujuan utama #7036# ditunjuk sebagai wali adalah untuk menguasai harta milik #4406#', '#7036# ingin menjadi wali terutama supaya dapat menguasai harta milik #4406#',
        'yang diincar #7036# dengan menjadi wali adalah harta milik #4406# semata', 'maksud utama #7036# menjadi wali #4406# ialah untuk memperoleh harta anak itu']
butir('q-wb-tujuan', 'pp-wb-kepentingan', 1201, 'inti', 'akibat', BERSAMA, 'Untuk apa dan untuk kepentingan siapa #7036# memohon ditunjuk sebagai wali #4407# itu?',
      ['Apa tujuan #7036# memohon menjadi wali #4407# itu?'], 'tujuan pemohon memohon penunjukan sebagai wali',
      {'melihat': melihat(TJ_A, 'saksi menerangkan tujuan calon wali untuk kepentingan anak sebagai hal yang dilihat atau dialaminya sendiri'),
       'berbeda': berbeda(TJ_A, TJ_B, 'tujuan penunjukan demi kepentingan anak', 'tujuan penunjukan untuk menguasai harta anak', 'peristiwa')})

# 9. penutup -----------------------------------------------------------------------------------------------------------------------------------------
butir('q-wb-penutup', 'pp-wb-penutup', 2001, 'inti', 'penutup', BERSAMA, 'Apakah masih ada keterangan yang ingin Saudara sampaikan?',
      ['Apakah masih ada yang ingin Saudara tambahkan?'], 'keterangan tambahan saksi',
      {'melihat': langsung(['sudah cukup', 'cukup', 'saya sudah cukup', 'saya cukup'], ['bahwa sudah cukup', 'bahwa cukup', 'bahwa saya sudah cukup', 'saksi sudah cukup'],
                           'saksi menyatakan keterangannya sudah cukup')},
      ['mendengar', 'de-auditu', 'sebagian', 'tidak-tahu', 'ragu', 'berbeda'])

# ------------------------------------------------------------------------------------------------------------------------------------------
# blangko BAS
# ------------------------------------------------------------------------------------------------------------------------------------------
FOLDER_BAS = '6f Penunjukan Wali oleh Pengadilan - BAS'
BAS = [
    '[1] Sidang 1 - Pemeriksaan, Bukti Surat dan 2 Saksi, Penetapan Dibacakan (1x Sidang)',
    '[1a] Sidang 1 - Pemeriksaan, Bukti Surat dan 2 Saksi, Tunda Pembacaan Penetapan',
    '[2] Sidang Lanjutan - Pemeriksaan 2 Saksi, Tunda Pembacaan Penetapan',
    '[2a] Sidang Lanjutan - Perbaikan Permohonan, Bukti Surat dan 2 Saksi, Tunda Pembacaan Penetapan',
    '[2b] Sidang Lanjutan - Pemeriksaan 2 Saksi, Penetapan Dibacakan',
]


def susun():
    ada = set()
    for b in Q:
        ada |= set(b['variabelAbt'])
    try:
        kamus = set(json.load(open('D:/Aplikasi/aleta/tmp/abt-variabel.json', encoding='utf-8')).keys())
    except OSError:
        kamus = set()
    baru = sorted(n for n in ada if n not in kamus)
    return {
        'skema': 'saksi-katalog/1', 'kunci': 'penunjukan-wali', 'judul': 'Penunjukan wali oleh pengadilan', 'versi': 1, 'penulis': 'W3b-356', 'tahap': 2, 'contoh': False,
        'syarat': {'jenisPerkaraId': ['356']}, 'pihak': {'pengaju': '#0046#', 'lawan': '#0047#'}, 'tanpaLawan': True,
        'blangkoBas': [{'folder': FOLDER_BAS, 'berkas': 'BAS ALUR 72 Penunjukan Wali - ' + b, 'variabelSaksi': ['5058', '5059'], 'catatan': 'dua saksi Pemohon'} for b in BAS],
        'dasarHukum': DASAR, 'keadaan': KEADAAN, 'pokokPembuktian': POKOK, 'pertanyaan': Q, 'jawabanUmum': JAWABAN_UMUM,
        'variabelBaru': baru,
        'catatanPetugas': [
            'Keterangan seorang saksi saja tidak cukup; diperlukan sedikitnya dua saksi yang memenuhi syarat.',
            'Keterangan saksi harus menyebut bagaimana saksi mengetahuinya; pendapat atau dugaan bukan kesaksian.',
            'Calon wali dari Keluarga Anak dan orang lain harus berumur paling rendah 30 tahun, sedangkan Saudara paling rendah 21 tahun (Pasal 4, 5 dan 6 PP 29/2019); pastikan keterangan saksi menjangkau syarat umur, kesehatan, kelakuan, kemampuan ekonomi, dan kesamaan agama.',
            'Bagi Saudara dan orang lain diperlukan persetujuan Anak; bila Anak belum mampu menyatakan sendiri, pernyataannya difasilitasi oleh ahli atau lembaga yang ditunjuk (Pasal 5 ayat (2) dan Pasal 6 ayat (2) PP 29/2019).',
            'Rekomendasi dinas sosial kabupaten/kota setempat dilampirkan oleh calon wali dan menjadi bahan pertimbangan (Pasal 11 dan 12 PP 29/2019); tandai keadaan rekomendasi bila ada.',
            'Jawaban bertanda berselisih hanya kerangka: sesuaikan dengan keterangan saksi yang sesungguhnya.',
        ],
    }


if __name__ == '__main__':
    kat = susun()
    with open(TUJUAN, 'w', encoding='utf-8') as f:
        json.dump(kat, f, ensure_ascii=False, indent=1)
        f.write('\n')
    print('ditulis', TUJUAN, len(Q), 'pertanyaan,', len(POKOK), 'pokok,', len(DASAR), 'dasar hukum; variabelBaru', kat['variabelBaru'])
