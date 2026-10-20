# -*- coding: utf-8 -*-
"""Isi katalog saksi IZIN POLIGAMI (jenis 341) - tambahan agen W2b-A, 21 Okt 2026. Hanya MENAMBAH; butir/pokok/dasar/keadaan lama utuh.

Pihak: #0046# = Pemohon (suami), #0047# = Termohon (istri pertama), #8723# = nama calon istri kedua.
Butir disusun dari isi_poligami_a..d (S(...) di tiap berkas); modul ini menyatukan header (FORM, dasar hukum, keadaan, pokok).
"""
import io
import json
import os

KATALOG = 'izin-poligami.json'
FORM = {'pg': dict(sfx='', keadaan={}, PAS='#0046# dan #0047#', PRIA='#0046#', WAN='#0047#', PEM='#0046#', LAWAN='#0047#', URUT=0)}
BENTUK = ('pg',)
VARBARU = ['4851', '4852']

_REPO = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..'))


def _salin_dasar(berkas, ids):
    """Dasar hukum TERVERIFIKASI yang sudah ada di katalog lain disalin apa adanya (sumber naskah ikut)."""
    d = json.load(io.open(os.path.join(_REPO, 'ekstensi-sipp', 'saksi-katalog', berkas), encoding='utf-8'))
    peta = {h['id']: h for h in d['dasarHukum']}
    return [dict(peta[i], id='pg-' + i) for i in ids]


def _baru(id_, rujukan, uraian, sumber):
    return dict(id=id_, rujukan=rujukan, uraian=uraian, status='perlu-verifikasi', sumber=sumber)


DASAR_BARU = (
    _salin_dasar('cerai-kumulasi-itsbat.json', ['dh-uu1-74-poligami', 'dh-khi-39-44'])
    + _salin_dasar('cerai-kumulasi.json', ['dh-uup-35', 'dh-khi-97'])
    + _salin_dasar('wali-adhal.json', ['dh-halangan-kawin'])
    + [
        _baru('dh-pg-khi-56', 'Pasal 56 Kompilasi Hukum Islam',
              'suami yang hendak beristri lebih dari satu orang harus mendapat izin dari Pengadilan Agama dan perkawinan dengan istri kedua, ketiga atau keempat tanpa izin Pengadilan Agama tidak mempunyai kekuatan hukum',
              'pengetahuan hukum penyusun (KHI lampiran Inpres 1/1991); isinya sejalan dengan uraian sekunder hukumonline.com/klinik/a/dasar-hukum-poligami-di-indonesia-dan-prosedurnya-lt5136cbfaaeef9 (diperiksa 21 Okt 2026) tetapi BELUM dicocokkan dengan naskah resmi; lihat PERIKSA-PASAL-W2b-poligami.md'),
        _baru('dh-pg-khi-59', 'Pasal 59 Kompilasi Hukum Islam',
              'bila istri tidak mau memberikan persetujuan dan permohonan didasarkan pada salah satu alasan Pasal 55 ayat (2) dan Pasal 57, Pengadilan Agama dapat menetapkan pemberian izin setelah memeriksa dan mendengar istri di persidangan; atas penetapan itu istri atau suami dapat mengajukan banding atau kasasi',
              'pengetahuan hukum penyusun (KHI lampiran Inpres 1/1991); isinya sejalan dengan uraian sekunder hukumonline.com/klinik/a/dasar-hukum-poligami-di-indonesia-dan-prosedurnya-lt5136cbfaaeef9 (diperiksa 21 Okt 2026) tetapi BELUM dicocokkan dengan naskah resmi; lihat PERIKSA-PASAL-W2b-poligami.md'),
        _baru('dh-pg-pp9-40-43', 'Pasal 40, Pasal 42 dan Pasal 43 PP 9/1975',
              'permohonan izin beristri lebih dari seorang diajukan tertulis kepada Pengadilan; Pengadilan wajib memanggil dan mendengar istri yang bersangkutan; bila cukup alasan Pengadilan memberi putusan berupa izin',
              'pengetahuan hukum penyusun (PP 9/1975), belum dicocokkan dengan naskah resmi; Pasal 41 PP 9/1975 sudah terverifikasi pada dh-poligami-pp41'),
        _baru('dh-pg-uup-65', 'Pasal 65 ayat (1) UU 1/1974',
              'suami yang beristri lebih dari seorang wajib memberikan jaminan hidup yang sama kepada semua istri dan anaknya; istri kedua dan seterusnya tidak berhak atas harta bersama yang telah ada sebelum perkawinannya; semua istri berhak atas harta bersama yang terjadi sejak perkawinan masing-masing',
              'pengetahuan hukum penyusun (UU 1/1974, ketentuan peralihan), belum dicocokkan dengan naskah resmi'),
        _baru('dh-pg-khi-55-2', 'Pasal 55 ayat (2) dan Pasal 55 ayat (3) Kompilasi Hukum Islam',
              'syarat utama beristri lebih dari satu orang ialah suami harus mampu berlaku adil terhadap istri-istri dan anak-anaknya; bila syarat itu tidak mungkin terpenuhi suami dilarang beristri lebih dari satu orang',
              'Pasal 55 ayat (2) sudah terverifikasi pada dh-poligami-adil; ayat (3) dari pengetahuan hukum penyusun, belum dicocokkan'),
    ]
)

KEADAAN_BARU = {
    'statusCalon': dict(sumber='borang', nilai=['gadis', 'janda-cerai', 'janda-meninggal'], bawaan='gadis',
                        label='Status calon istri kedua sebelum menikah lagi',
                        labelNilai={'gadis': 'Perawan atau belum pernah menikah', 'janda-cerai': 'Janda karena cerai',
                                    'janda-meninggal': 'Janda karena suami meninggal'}),
    'rumahTanggaKini': dict(sumber='borang', nilai=['serumah', 'pisah-rumah'], bawaan='serumah',
                            label='Keadaan tempat tinggal Pemohon dan Termohon sekarang',
                            labelNilai={'serumah': 'Masih tinggal serumah', 'pisah-rumah': 'Sudah tinggal berpisah'}),
    'kedudukanSaksi': dict(sumber='borang', nilai=['hadir-biasa', 'keluarga-calon-istri', 'anak-pemohon'], bawaan='hadir-biasa', perSaksi=True,
                           label='Kedudukan saksi terhadap para pihak',
                           labelNilai={'hadir-biasa': 'Saksi biasa (keluarga, tetangga atau kenalan)',
                                       'keluarga-calon-istri': 'Keluarga atau wali calon istri kedua',
                                       'anak-pemohon': 'Anak Pemohon dan Termohon'}),
}

POKOK_BARU = [
    dict(id='pp-pg-riwayat', judul='Riwayat pernikahan dan rumah tangga', uraian='waktu dan lamanya pernikahan, pencatatan, anak, tempat tinggal dan keadaan rumah tangga sekarang',
         dasarHukum=['dh-poligami-izin'], wajib=False),
    dict(id='pp-pg-alasan-a', judul='Istri tidak dapat menjalankan kewajibannya', uraian='bentuk kewajiban istri yang tidak dapat dijalankan, sejak kapan dan sebabnya',
         dasarHukum=['dh-poligami-alasan'], wajib=False, keadaan={'alasanPoligami': 'a'}),
    dict(id='pp-pg-alasan-b', judul='Istri cacat badan atau sakit yang tidak dapat disembuhkan', uraian='jenis cacat atau penyakit, pemeriksaan dokter dan upaya pengobatan',
         dasarHukum=['dh-poligami-alasan'], wajib=False, keadaan={'alasanPoligami': 'b'}),
    dict(id='pp-pg-alasan-c', judul='Istri tidak dapat melahirkan keturunan', uraian='pemeriksaan medis, lamanya pernikahan tanpa keturunan dan upaya yang telah ditempuh',
         dasarHukum=['dh-poligami-alasan'], wajib=False, keadaan={'alasanPoligami': 'c'}),
    dict(id='pp-pg-keberatan', judul='Istri keberatan atas rencana poligami', uraian='sikap keberatan istri, alasannya dan upaya musyawarah; Pengadilan memeriksa dan mendengar istri',
         dasarHukum=['dh-pg-khi-59', 'dh-poligami-persetujuan'], wajib=False, keadaan={'sikapIstri': 'keberatan'}),
    dict(id='pp-pg-tidak-mungkin', judul='Istri tidak mungkin dimintai persetujuan', uraian='keadaan yang membuat istri tidak mungkin dimintai persetujuan atau tidak ada kabar sekurang-kurangnya dua tahun',
         dasarHukum=['dh-poligami-persetujuan-cara'], wajib=False, keadaan={'sikapIstri': 'tidak-mungkin'}),
    dict(id='pp-pg-tanggungan', judul='Tanggungan dan beban nafkah suami', uraian='tanggungan suami, pengeluaran, sumber penghasilan dan bukti penghasilan',
         dasarHukum=['dh-poligami-kemampuan', 'dh-poligami-pp41'], wajib=False),
    dict(id='pp-pg-adil-rinci', judul='Pelaksanaan jaminan berlaku adil', uraian='pembagian giliran, tempat tinggal, nafkah dan perhatian kepada istri-istri dan anak-anak',
         dasarHukum=['dh-poligami-adil', 'dh-pg-khi-55-2'], wajib=False),
    dict(id='pp-pg-calon-iddah', judul='Status janda calon istri dan masa iddah', uraian='calon istri kedua berstatus janda: sebab berakhirnya perkawinan terdahulu dan telah lewatnya masa iddah',
         dasarHukum=['pg-dh-khi-39-44'], wajib=False, keadaan={'statusCalon': ['janda-cerai', 'janda-meninggal']}),
    dict(id='pp-pg-tanpa-izin', judul='Belum ada perkawinan tanpa izin Pengadilan', uraian='pemohon dan calon istri belum melangsungkan perkawinan di luar izin Pengadilan Agama',
         dasarHukum=['dh-pg-khi-56', 'pg-dh-uu1-74-poligami'], wajib=False),
    dict(id='pp-pg-harta-rinci', judul='Rincian harta bersama', uraian='objek, asal perolehan, atas nama siapa dan penguasaan harta bersama suami istri',
         dasarHukum=['pg-dh-uup-35', 'pg-dh-khi-97'], wajib=False, keadaan={'kumulasi': 'harta-bersama'}),
    dict(id='pp-pg-keluarga', judul='Sikap keluarga dan anak', uraian='pengetahuan dan sikap anak-anak serta keluarga kedua belah pihak atas rencana poligami',
         dasarHukum=['dh-poligami-izin'], wajib=False),
]

CATATAN = [
    'Pilihan "Alasan poligami" (huruf a, b atau c) hanya menentukan pertanyaan yang diajukan; penilaian alasan Pasal 4 ayat (2) UU 1/1974 tetap oleh majelis.',
    'Pilihan "Sikap istri" menentukan pokok yang diperiksa: setuju, keberatan (Pasal 59 KHI: istri didengar di persidangan) atau tidak mungkin dimintai persetujuan.',
    'Rujukan Pasal 56 dan Pasal 59 KHI, Pasal 40 sampai 43 PP 9/1975 dan Pasal 65 UU 1/1974 pada katalog ini dikutip dari pengetahuan hukum dan belum dicocokkan dengan naskah resmi; hanya tampil di panel, tidak tercetak.',
]

SPEC = []


def S(**kw):
    kw.setdefault('prefix', 'q-pg-')
    SPEC.append(kw)


# Butir disusun di berkas terpisah agar mudah dirawat; tiap berkas memanggil S dari modul ini.
import isi_poligami_a  # noqa: E402,F401
import isi_poligami_b  # noqa: E402,F401
import isi_poligami_c  # noqa: E402,F401
import isi_poligami_d  # noqa: E402,F401
