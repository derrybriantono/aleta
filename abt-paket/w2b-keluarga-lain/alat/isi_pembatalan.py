# -*- coding: utf-8 -*-
"""Isi katalog saksi PEMBATALAN PERKAWINAN (jenis 344) - tambahan agen W2b-C, 21 Okt 2026. Hanya MENAMBAH; butir/pokok/dasar/keadaan lama utuh.

Pihak: #0046# = Penggugat, #0047# = Tergugat (suami atau istri dalam perkawinan yang dimohonkan pembatalannya).
Alasan (keadaan 'alasan'): A poligami tanpa izin, B istri masih terikat perkawinan lain atau dalam iddah, C umur di bawah batas,
D wali tidak sah / tanpa dua saksi, E paksaan, F penipuan atau salah sangka (termasuk identitas palsu), G hubungan terlarang.
Butir disusun dari isi_pembatalan_a dan isi_pembatalan_b (S(...) di tiap berkas); modul ini menyatukan header.
"""
import io
import json
import os

KATALOG = 'pembatalan-perkawinan.json'
FORM = {'bt': dict(sfx='', keadaan={}, PAS='#0046# dan #0047#', PRIA='#0046#', WAN='#0047#', PEM='#0046#', LAWAN='#0047#', URUT=0)}
BENTUK = ('bt',)
VARBARU = []

_REPO = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..'))
_CAD = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'cadangan-katalog')


def _salin_dasar(berkas, ids):
    """Dasar hukum TERVERIFIKASI yang sudah ada di katalog lain disalin apa adanya (sumber naskah ikut).
    Dibaca dari cadangan katalog asli bila ada (tidak terpengaruh penulisan agen lain), jika tidak dari katalog hidup."""
    jalur = os.path.join(_CAD, berkas)
    if not os.path.exists(jalur):
        jalur = os.path.join(_REPO, 'ekstensi-sipp', 'saksi-katalog', berkas)
    d = json.load(io.open(jalur, encoding='utf-8'))
    peta = {h['id']: h for h in d['dasarHukum']}
    for i in ids:
        assert peta[i]['status'] == 'terverifikasi', i
    return [dict(peta[i], id='bt-' + i) for i in ids]


def _baru(id_, rujukan, uraian, sumber):
    return dict(id=id_, rujukan=rujukan, uraian=uraian, status='perlu-verifikasi', sumber=sumber)


DASAR_BARU = (
    _salin_dasar('wali-adhal.json', ['dh-khi-19-20', 'dh-khi-21', 'dh-khi-23', 'dh-halangan-kawin', 'dh-khi-153'])
    + _salin_dasar('cerai-kumulasi-itsbat.json', ['dh-khi-14', 'dh-khi-24-26', 'dh-uu1-74-poligami'])
    + _salin_dasar('cerai-kumulasi.json', ['dh-uup-35'])
    + _salin_dasar('dispensasi-kawin.json', ['dh-uu16-2019-7-2-3'])
    + _salin_dasar('izin-poligami.json', ['dh-poligami-izin', 'dh-poligami-persetujuan'])
    + [
        _baru('dh-bt-uup-2-pencatatan', 'Pasal 2 ayat (2) UU 1/1974 jo. Pasal 5 dan Pasal 6 Kompilasi Hukum Islam',
              'setiap perkawinan dicatat menurut peraturan perundang-undangan; pencatatan dilakukan Pegawai Pencatat Nikah dan perkawinan yang dilakukan di luar pengawasan Pegawai Pencatat Nikah tidak mempunyai kekuatan hukum',
              'pengetahuan hukum penyusun (UU 1/1974 dan KHI lampiran Inpres 1/1991), belum dicocokkan dengan naskah resmi'),
        _baru('dh-bt-pp9-38', 'Pasal 38 ayat (2) dan ayat (3) PP 9/1975',
              'tata cara pengajuan dan pemeriksaan pembatalan perkawinan mengikuti tata cara gugatan perceraian, termasuk usaha hakim mendamaikan kedua pihak',
              'pengetahuan hukum penyusun (PP 9/1975), belum dicocokkan dengan naskah resmi'),
    ]
)

KEADAAN_BARU = {
    'kedudukanSaksi': dict(sumber='borang', nilai=['hadir-biasa', 'keluarga-pengaju', 'keluarga-lawan'], bawaan='hadir-biasa', perSaksi=True,
                           label='Kedudukan saksi terhadap para pihak',
                           labelNilai={'hadir-biasa': 'Saksi biasa (tetangga, kenalan atau rekan)',
                                       'keluarga-pengaju': 'Keluarga atau kerabat Penggugat',
                                       'keluarga-lawan': 'Keluarga atau kerabat Tergugat'}),
    'sikapSetelahTahu': dict(sumber='borang', nilai=['berpisah-setelah-tahu', 'tetap-bersama-setelah-tahu'], bawaan='berpisah-setelah-tahu',
                             label='Sikap Penggugat setelah mengetahui keadaan yang menjadi alasan pembatalan',
                             labelNilai={'berpisah-setelah-tahu': 'Segera berpisah dan mengajukan perkara',
                                         'tetap-bersama-setelah-tahu': 'Masih hidup bersama sebagai suami istri sesudah mengetahui'}),
    'pencatatan': dict(sumber='borang', nilai=['tercatat', 'tidak-tercatat'], bawaan='tercatat',
                       label='Pencatatan perkawinan yang dimohonkan pembatalannya',
                       labelNilai={'tercatat': 'Dicatat oleh Pegawai Pencatat Nikah', 'tidak-tercatat': 'Tidak dicatat'}),
    'jenisLarangan': dict(sumber='borang', nilai=['nasab', 'semenda', 'sesusuan'], bawaan='nasab',
                          label='Jenis hubungan yang melarang perkawinan (alasan huruf G)',
                          labelNilai={'nasab': 'Hubungan darah (nasab)', 'semenda': 'Hubungan semenda', 'sesusuan': 'Hubungan sesusuan'}),
}

POKOK_BARU = [
    dict(id='pp-bt-cara-kenal', judul='Lama dan cara saksi mengenal para pihak', uraian='sejak kapan, dari mana dan seberapa sering saksi bergaul dengan para pihak, serta kedudukan saksi (keluarga Penggugat, keluarga Tergugat atau tetangga dan kenalan)',
         dasarHukum=['dh-sebab-pengetahuan', 'dh-saksi-syarat'], wajib=False),
    dict(id='pp-bt-hak-keluarga', judul='Penggugat sebagai keluarga garis keturunan lurus ke atas', uraian='hubungan darah dalam garis lurus ke atas antara Penggugat dan salah seorang suami atau istri',
         dasarHukum=['dh-bt-pihak'], wajib=False, keadaan={'kedudukanPengaju': 'keluarga'}),
    dict(id='pp-bt-hak-pasangan', judul='Penggugat sebagai suami atau istri yang berhak', uraian='status Penggugat sebagai suami atau istri yang sah dan masih terikat dalam perkawinan',
         dasarHukum=['dh-bt-pihak'], wajib=False, keadaan={'kedudukanPengaju': 'suami-istri'}),
    dict(id='pp-bt-kepentingan', judul='Kepentingan Penggugat sebagai orang yang berkepentingan', uraian='kepentingan langsung dan kerugian Penggugat bila perkawinan itu tetap berlangsung',
         dasarHukum=['dh-bt-pihak'], wajib=False, keadaan={'kedudukanPengaju': 'berkepentingan'}),
    dict(id='pp-bt-akad', judul='Pelaksanaan akad nikah yang dibatalkan', uraian='siapa yang menikahkan, siapa yang hadir dan bagaimana ijab kabul diucapkan',
         dasarHukum=['dh-bt-umum', 'bt-dh-khi-14'], wajib=False),
    dict(id='pp-bt-pencatatan', judul='Pencatatan perkawinan dan buku nikah', uraian='perkawinan dicatat atau tidak, buku nikah atau kutipan akta nikah dan sebab perkawinan tidak dicatat',
         dasarHukum=['dh-bt-uup-2-pencatatan', 'dh-bt-umum'], wajib=False),
    dict(id='pp-bt-poligami', judul='Perkawinan kedua tanpa izin dan tanpa persetujuan istri pertama', uraian='istri pertama tidak dimintai persetujuan, tidak ada izin Pengadilan Agama dan suami masih terikat perkawinan dengan istri pertama',
         dasarHukum=['dh-bt-a', 'bt-dh-uu1-74-poligami', 'bt-dh-poligami-izin', 'bt-dh-poligami-persetujuan'], wajib=False, keadaan={'alasan': 'A'}),
    dict(id='pp-bt-terikat', judul='Istri masih terikat perkawinan lain atau dalam masa iddah', uraian='status perkawinan istri yang terdahulu dan masa iddahnya pada saat akad nikah',
         dasarHukum=['dh-bt-b', 'bt-dh-khi-153'], wajib=False, keadaan={'alasan': 'B'}),
    dict(id='pp-bt-umur', judul='Umur di bawah batas dan dispensasi kawin', uraian='umur para pihak menurut akta kelahiran atau kartu identitas dan ada tidaknya dispensasi kawin',
         dasarHukum=['dh-bt-c', 'bt-dh-uu16-2019-7-2-3'], wajib=False, keadaan={'alasan': 'C'}),
    dict(id='pp-bt-wali', judul='Wali nikah yang berhak dan wali yang bertindak', uraian='wali nasab yang berhak menurut urutan kekerabatan, siapa yang sebenarnya menikahkan dan sikap wali nasab',
         dasarHukum=['dh-bt-d', 'bt-dh-khi-19-20', 'bt-dh-khi-21', 'bt-dh-khi-23'], wajib=False, keadaan={'alasan': 'D'}),
    dict(id='pp-bt-saksi-nikah', judul='Saksi nikah dan syaratnya', uraian='jumlah saksi nikah, kehadirannya pada ijab kabul dan syarat saksi',
         dasarHukum=['dh-bt-d', 'bt-dh-khi-24-26'], wajib=False, keadaan={'alasan': 'D'}),
    dict(id='pp-bt-paksaan', judul='Paksaan atau ancaman', uraian='bentuk paksaan atau ancaman, orang yang memaksa dan keadaan korban ketika akad nikah',
         dasarHukum=['dh-bt-e'], wajib=False, keadaan={'alasan': 'E'}),
    dict(id='pp-bt-salah-sangka', judul='Penipuan atau salah sangka mengenai diri suami atau istri', uraian='keadaan diri yang disembunyikan atau diakui secara keliru dan kenyataan yang sebenarnya',
         dasarHukum=['dh-bt-f'], wajib=False, keadaan={'alasan': 'F'}),
    dict(id='pp-bt-identitas', judul='Pemalsuan identitas', uraian='identitas yang dipakai untuk mengurus dan melangsungkan perkawinan tidak sesuai kenyataan',
         dasarHukum=['dh-bt-f'], wajib=False, keadaan={'alasan': 'F'}),
    dict(id='pp-bt-larangan', judul='Hubungan yang melarang perkawinan', uraian='jenis hubungan nasab, semenda atau sesusuan antara para pihak dan pengetahuan keluarga atasnya',
         dasarHukum=['dh-bt-g', 'bt-dh-halangan-kawin'], wajib=False, keadaan={'alasan': 'G'}),
    dict(id='pp-bt-tenggang', judul='Tenggang enam bulan dan sikap setelah mengetahui', uraian='jarak waktu sejak Penggugat mengetahui keadaan sampai perkara diajukan dan kelanjutan hidup bersama',
         dasarHukum=['dh-bt-enam-bulan'], wajib=False, keadaan={'alasan': ['E', 'F']}),
    dict(id='pp-bt-harta', judul='Harta bersama dan pihak ketiga', uraian='harta yang diperoleh selama perkawinan serta hubungan pihak ketiga yang beritikad baik dengan para pihak',
         dasarHukum=['dh-bt-akibat', 'bt-dh-uup-35'], wajib=False),
    dict(id='pp-bt-damai', judul='Upaya penyelesaian di luar pengadilan', uraian='musyawarah keluarga atau upaya damai sebelum perkara diajukan dan hasilnya',
         dasarHukum=['dh-bt-pp9-38'], wajib=False),
]

CATATAN = [
    'Pilihan "Jenis hubungan yang melarang perkawinan" (nasab, semenda atau sesusuan) hanya menentukan susunan kalimat saksi pada alasan huruf G; penilaian halangan perkawinan tetap oleh majelis.',
    'Pilihan "Sikap Penggugat setelah mengetahui" menentukan pertanyaan tenggang enam bulan (alasan huruf E dan F): bila masih hidup bersama sebagai suami istri sesudah mengetahui, perhatikan hak gugur.',
    'Pilihan "Pencatatan perkawinan" memisahkan pertanyaan buku nikah (tercatat) dari pertanyaan sebab perkawinan tidak dicatat (tidak tercatat). Kedudukan saksi diisi per saksi.',
    'Rujukan hukum tentang pencatatan perkawinan dan tata cara pemeriksaan pembatalan pada katalog ini dikutip dari pengetahuan hukum dan belum dicocokkan dengan naskah resmi; hanya tampil di panel, tidak tercetak.',
]

SPEC = []


def S(**kw):
    kw.setdefault('prefix', 'q-bt-')
    SPEC.append(kw)


# Butir disusun di berkas terpisah agar mudah dirawat; tiap berkas memanggil S dari modul ini.
import isi_pembatalan_a  # noqa: E402,F401
import isi_pembatalan_b  # noqa: E402,F401
