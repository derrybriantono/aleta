# -*- coding: utf-8 -*-
"""Isi katalog saksi PENCEGAHAN PERKAWINAN (jenis 342) - tambahan agen W2b-B, 21 Okt 2026. Hanya MENAMBAH; butir/pokok/dasar/keadaan lama utuh.

Pihak: #0046# = Pemohon pencegahan; #1029# = nama calon suami (variabel lama katalog ini). Permohonan tanpa lawan (tanpaLawan).
Butir disusun dari isi_pencegahan_a..c (S(...) di tiap berkas); modul ini menyatukan header (FORM, dasar hukum, keadaan, pokok).
"""
import io
import json
import os

KATALOG = 'pencegahan-perkawinan.json'
FORM = {'pc': dict(sfx='', keadaan={}, PAS='kedua calon mempelai', PRIA='calon suami', WAN='calon istri', PEM='#0046#', LAWAN='', URUT=0)}
BENTUK = ('pc',)
VARBARU = []

_REPO = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..'))


def _salin_dasar(berkas, ids):
    """Dasar hukum TERVERIFIKASI yang sudah ada di katalog lain disalin apa adanya (sumber naskah ikut), id diberi awalan pc-."""
    d = json.load(io.open(os.path.join(_REPO, 'ekstensi-sipp', 'saksi-katalog', berkas), encoding='utf-8'))
    peta = {h['id']: h for h in d['dasarHukum']}
    return [dict(peta[i], id='pc-' + i) for i in ids]


def _baru(id_, rujukan, uraian, sumber):
    return dict(id=id_, rujukan=rujukan, uraian=uraian, status='perlu-verifikasi', sumber=sumber)


DASAR_BARU = (
    _salin_dasar('dispensasi-kawin.json', ['dh-uu1-74-poligami', 'dh-uu16-2019-7-2-3', 'dh-khi-39-44'])
    + _salin_dasar('izin-poligami.json', ['dh-poligami-izin'])
    + _salin_dasar('wali-adhal.json', ['dh-khi-19-20', 'dh-khi-21', 'dh-khi-61', 'dh-khi-153'])
    + [
        _baru('dh-pc-pencatat', 'Pasal 17 ayat (2), Pasal 20 dan Pasal 21 UU 1/1974',
              'Pegawai Pencatat Perkawinan memberitahukan permohonan pencegahan kepada calon mempelai; Pegawai Pencatat tidak boleh melangsungkan atau membantu '
              'melangsungkan perkawinan yang diketahuinya melanggar syarat perkawinan, dan penolakannya diberitahukan kepada yang bersangkutan beserta alasannya',
              'pengetahuan hukum penyusun (UU 1/1974), belum dicocokkan dengan naskah resmi; Pasal 17 ayat (1) sudah terverifikasi pada dh-pc-kewenangan'),
    ]
)

KEADAAN_BARU = {
    'kedudukanSaksi': dict(sumber='borang', nilai=['biasa', 'keluarga-pemohon', 'keluarga-calon-mempelai'], bawaan='biasa', perSaksi=True,
                           label='Kedudukan saksi terhadap pemohon dan calon mempelai',
                           labelNilai={'biasa': 'Saksi biasa (tetangga, kenalan atau tokoh setempat)',
                                       'keluarga-pemohon': 'Keluarga atau kerabat pemohon pencegahan',
                                       'keluarga-calon-mempelai': 'Keluarga atau kerabat salah seorang calon mempelai'}),
    'terikatPada': dict(sumber='borang', nilai=['calon-suami', 'calon-istri'], bawaan='calon-suami',
                        label='Calon mempelai yang masih terikat perkawinan lain (alasan A)',
                        labelNilai={'calon-suami': 'Calon suami masih terikat perkawinan (masih beristri)',
                                    'calon-istri': 'Calon istri masih terikat perkawinan (masih bersuami)'}),
    'jenisLarangan': dict(sumber='borang', nilai=['nasab', 'semenda', 'sesusuan'], bawaan='nasab',
                          label='Jenis larangan kawin yang didalilkan (alasan C)',
                          labelNilai={'nasab': 'Hubungan darah (nasab)', 'semenda': 'Hubungan semenda (karena perkawinan)', 'sesusuan': 'Hubungan sesusuan'}),
    'sebabPutus': dict(sumber='borang', nilai=['cerai', 'meninggal'], bawaan='cerai',
                       label='Sebab berakhirnya perkawinan terdahulu calon istri (alasan D)',
                       labelNilai={'cerai': 'Putus karena perceraian', 'meninggal': 'Putus karena suami meninggal dunia'}),
}

POKOK_BARU = [
    dict(id='pp-pc-kedudukan-rinci', judul='Dasar kedudukan pemohon sebagai pihak yang berhak mencegah',
         uraian='hubungan darah, perwalian atau ikatan perkawinan pemohon dengan salah seorang calon mempelai, atau kepentingan langsungnya',
         dasarHukum=['dh-pc-pihak'], wajib=False),
    dict(id='pp-pc-rencana-rinci', judul='Rencana perkawinan yang belum dilangsungkan',
         uraian='waktu, tempat dan persiapan akad nikah serta keadaan bahwa perkawinan itu sampai sekarang masih sebatas rencana',
         dasarHukum=['dh-pc-kewenangan', 'dh-pc-umum'], wajib=False),
    dict(id='pp-pc-dasar-keberatan', judul='Dasar keberatan pemohon',
         uraian='keberatan pemohon berpangkal pada syarat atau larangan perkawinan menurut hukum, bukan sekadar perbedaan kedudukan atau harta',
         dasarHukum=['dh-pc-umum', 'pc-dh-khi-61'], wajib=False),
    dict(id='pp-pc-pemberitahuan-kua', judul='Pemberitahuan kepada Pegawai Pencatat Nikah',
         uraian='kehendak menikah yang sudah diberitahukan kepada Kantor Urusan Agama dan keberatan pemohon yang sudah disampaikan kepada petugas',
         dasarHukum=['dh-pc-kewenangan', 'dh-pc-pencatat'], wajib=False),
    dict(id='pp-pc-alasan-a', judul='Calon mempelai masih terikat perkawinan lain', uraian='status perkawinan yang masih berlaku, izin poligami dan sikap istri sah',
         dasarHukum=['dh-pc-a', 'pc-dh-uu1-74-poligami', 'pc-dh-poligami-izin'], wajib=False, keadaan={'alasan': 'A'}),
    dict(id='pp-pc-alasan-b', judul='Calon mempelai belum cukup umur', uraian='umur calon mempelai, sumber pengetahuan atas umur itu, ada tidaknya dispensasi kawin dan kesiapannya',
         dasarHukum=['dh-pc-b', 'pc-dh-uu16-2019-7-2-3'], wajib=False, keadaan={'alasan': 'B'}),
    dict(id='pp-pc-alasan-c', judul='Larangan kawin karena nasab, semenda atau sesusuan', uraian='bentuk hubungan yang melarang kedua calon mempelai menikah dan sumber pengetahuan saksi',
         dasarHukum=['dh-pc-c', 'pc-dh-khi-39-44'], wajib=False, keadaan={'alasan': 'C'}),
    dict(id='pp-pc-alasan-d', judul='Calon istri masih dalam masa iddah', uraian='sebab dan waktu berakhirnya perkawinan terdahulu serta jarak waktunya dengan rencana perkawinan baru',
         dasarHukum=['dh-pc-d', 'pc-dh-khi-153'], wajib=False, keadaan={'alasan': 'D'}),
    dict(id='pp-pc-alasan-e', judul='Perbedaan agama calon mempelai', uraian='agama yang dianut masing-masing calon mempelai dan sumber pengetahuan saksi',
         dasarHukum=['dh-pc-e', 'pc-dh-khi-61'], wajib=False, keadaan={'alasan': 'E'}),
    dict(id='pp-pc-alasan-f', judul='Calon istri bekas istri yang ditalak tiga', uraian='talak tiga yang pernah dijatuhkan dan ada tidaknya perkawinan calon istri dengan laki-laki lain sesudahnya',
         dasarHukum=['dh-pc-f'], wajib=False, keadaan={'alasan': 'F'}),
    dict(id='pp-pc-alasan-g', judul='Persetujuan calon mempelai, izin orang tua dan wali nikah', uraian='kerelaan calon mempelai, izin orang tua bagi yang belum dewasa dan sikap wali nikah',
         dasarHukum=['dh-pc-g', 'pc-dh-khi-19-20', 'pc-dh-khi-21'], wajib=False, keadaan={'alasan': 'G'}),
    dict(id='pp-pc-alasan-h', judul='Calon mempelai berada di bawah pengampuan', uraian='keadaan pengampuan dan kesengsaraan yang akan dialami calon mempelai yang lain',
         dasarHukum=['dh-pc-h'], wajib=False, keadaan={'alasan': 'H'}),
    dict(id='pp-pc-upaya-damai', judul='Musyawarah dan upaya damai sebelum ke pengadilan',
         uraian='pertemuan keluarga, penyampaian keberatan kepada calon mempelai, tanggapan mereka dan peran tokoh setempat',
         dasarHukum=['dh-pc-umum'], wajib=False),
    dict(id='pp-pc-kemudaratan', judul='Kemudaratan bila perkawinan dilangsungkan', uraian='kerugian yang nyata bagi keluarga dan calon mempelai bila perkawinan itu tetap terlaksana',
         dasarHukum=['dh-pc-umum', 'dh-pc-akibat'], wajib=False),
    dict(id='pp-pc-calon-hadir', judul='Pengetahuan calon mempelai atas perkara', uraian='calon mempelai yang menghadap sudah mengetahui keberatan pemohon sebelum perkara diajukan',
         dasarHukum=['dh-saksi-syarat'], wajib=False, keadaan={'calonMempelai': 'hadir'}),
]

CATATAN = [
    'Pilihan "Calon mempelai yang terikat perkawinan" (alasan A), "Jenis larangan kawin" (alasan C) dan "Sebab berakhirnya perkawinan terdahulu" (alasan D) hanya menentukan rumusan pertanyaan; fakta tetap diterangkan saksi.',
    'Kedudukan saksi (saksi biasa, keluarga pemohon atau keluarga calon mempelai) dipilih per saksi; pilihan itu menentukan jawaban pada pertanyaan hubungan, persiapan perkawinan dan musyawarah keluarga.',
    'Rujukan Pasal 17 ayat (2) serta Pasal 20 dan 21 UU 1/1974 pada katalog ini dikutip dari pengetahuan hukum dan belum dicocokkan dengan naskah resmi; hanya tampil di panel, tidak tercetak.',
]

SPEC = []


def S(**kw):
    kw.setdefault('prefix', 'q-pc-')
    SPEC.append(kw)


# Butir disusun di berkas terpisah agar mudah dirawat; tiap berkas memanggil S dari modul ini.
import isi_pencegahan_a  # noqa: E402,F401
import isi_pencegahan_b  # noqa: E402,F401
import isi_pencegahan_c  # noqa: E402,F401
