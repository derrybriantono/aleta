# -*- coding: utf-8 -*-
"""Membangun blangko BARU itsbat nikah dari [01] [Kabul] IN.rtf (agen U3, 20 Okt 2026):
  [01d] [Kabul] IN - Format Lengkap Rukun dan Syarat per Unsur (dua Pemohon)
  [01e] [Kabul] IN - Satu Pemohon (Pasangan Meninggal, Voluntair)
Berkas lama tidak disentuh. Keluaran: ../paket-satker/rtf/derry_briantono/2 Itsbat Nikah/<berkas>."""
import hashlib, os, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from rtflib import Berkas, buat_dari, polos, ubah_teks  # noqa: E402

AKAR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASLI = os.environ.get('ASLI_DERRY', r'D:\Aplikasi\aleta\tmp\u3\asli')
FOLDER = '2 Itsbat Nikah'
SUMBER = '[01] [Kabul] IN.rtf'
KELUAR = os.path.join(AKAR, 'paket-satker', 'rtf', 'derry_briantono', FOLDER)
D = '[01d] [Kabul] IN - Format Lengkap Rukun dan Syarat per Unsur.rtf'
E = '[01e] [Kabul] IN - Satu Pemohon (Pasangan Meninggal, Voluntair).rtf'
TAB = chr(9)

UNSUR = [
    'Menimbang, bahwa untuk memastikan terpenuhinya rukun perkawinan sebagaimana dimaksud Pasal 14 Kompilasi Hukum Islam, yaitu calon suami, calon istri, wali nikah, '
    'dua orang saksi, serta ijab dan kabul, #8554# mempertimbangkan masing-masing unsur berdasarkan fakta yang terbukti di persidangan sebagai berikut:',
    'Menimbang, bahwa mengenai calon suami dan calon istri, berdasarkan fakta bahwa pada saat menikah @PRIA@ berstatus #1002# dan @WAN@ berstatus #1003#, serta keduanya '
    'beragama Islam dan tetap beragama Islam sampai sekarang, maka keduanya telah memenuhi kedudukan sebagai calon suami dan calon istri yang dapat melangsungkan '
    'perkawinan menurut hukum Islam;',
    '#4307#',
    '#4308#',
    'Menimbang, bahwa mengenai dua orang saksi nikah sebagaimana dimaksud Pasal 24 dan Pasal 25 Kompilasi Hukum Islam, berdasarkan keterangan saksi-saksi di persidangan '
    'terbukti yang menjadi saksi nikah pada saat ijab kabul adalah #0650# dan #0651#, dan keduanya hadir serta menyaksikan langsung ijab kabul tersebut sebagaimana '
    'dimaksud Pasal 26 Kompilasi Hukum Islam, sedangkan di persidangan tidak ditemukan fakta yang menunjukkan salah seorang dari keduanya tidak memenuhi syarat sebagai '
    'saksi nikah (laki-laki muslim, adil, dewasa, serta sehat pendengaran dan ingatannya), sehingga rukun dua orang saksi telah terpenuhi;',
    'Menimbang, bahwa mengenai ijab dan kabul sebagaimana dimaksud Pasal 27 Kompilasi Hukum Islam, berdasarkan fakta bahwa Wali Nikah @WAN@ mengucapkan ijab dan @PRIA@ '
    'mengucapkan kabul sesaat setelah ijab diucapkan tanpa jeda waktu yang terlalu lama, maka ijab dan kabul telah diucapkan secara jelas, beruntun, dan tidak berselang '
    'waktu, sehingga rukun ijab dan kabul telah terpenuhi;',
    'Menimbang, bahwa mengenai mahar sebagaimana dimaksud Pasal 30 Kompilasi Hukum Islam, berdasarkan fakta bahwa mahar yang diberikan @PRIA@ kepada '
    '@WAN@ adalah #1001#, maka kewajiban calon mempelai pria memberikan mahar kepada calon mempelai wanita telah dipenuhi;',
    'Menimbang, bahwa berdasarkan pertimbangan masing-masing unsur di atas, seluruh rukun perkawinan sebagaimana dimaksud Pasal 14 Kompilasi Hukum Islam telah terpenuhi '
    'dalam perkawinan @PEM@, sehingga perkawinan tersebut sah menurut hukum Islam sebagaimana ketentuan Pasal 2 ayat (1) Undang-Undang Nomor 1 Tahun 1974 jo. Pasal 4 '
    'Kompilasi Hukum Islam;',
]


def sisip_unsur(b, dua):
    i_halangan = b.cari('terdapat larangan-larangan kawin sebagaimana ditegaskan')
    contoh = b.par[i_halangan]
    pria, wan, pem = ('#0046# I', '#0046# II', 'para #0046#') if dua else ('mempelai laki-laki', 'mempelai perempuan', '#0046# dengan #2026# #1025#')
    baru = [buat_dari(contoh, t.replace('@PRIA@', pria).replace('@WAN@', wan).replace('@PEM@', pem)) for t in UNSUR]
    b.par[i_halangan:i_halangan] = baru
    return b


def pasal_7_tiga(b):
    """Tiga paragraf dasar Pasal 7 ayat (3) KHI -> satu paragraf #4303#."""
    i1 = b.cari('Menimbang, bahwa menurut penjelasan Pasal 49 huruf a angka 22')
    i2 = b.cari('Menimbang, bahwa dalam Kompilasi Hukum Islam, untuk mengabulkan', i1)
    i3 = b.cari('memenuhi unsur yang terkandung dalam Pasal 7 ayat (3) huruf e', i2)
    assert i2 == i1 + 1 and i3 == i2 + 1, (i1, i2, i3)
    b.par[i1:i3 + 1] = [buat_dari(b.par[i1], '#4303#')]
    return b


def standing(b):
    i = b.cari('memiliki legal standing (kepentingan hukum) untuk mengajukan')
    b.par[i] = buat_dari(b.par[i], '#4306#')
    return b


def token_tersembunyi(b, tambah):
    i = b.cari('#0364#')
    p = b.par[i]
    assert '#0007#}' in p
    b.par[i] = p.replace('#0007#}', '#0007# ' + tambah + '}', 1)
    return b


def bangun_d(dua=True):
    b = Berkas(os.path.join(ASLI, FOLDER, SUMBER))
    standing(b)
    sisip_unsur(b, dua)
    pasal_7_tiga(b)
    token_tersembunyi(b, '#4300# #4305#')
    return b


# ---------------------------------------------------------------------------------------------------------------------
# [01e] satu Pemohon: penggantian frasa (yang khusus dahulu, peran I/II terakhir), per teks polos paragraf
# ---------------------------------------------------------------------------------------------------------------------
MATI = '#2026# #1025#'
GANTI_E = [
    ('#0046# I (#0098#) dengan #0046# II (#1033#)', '#0046# (#0098#) dengan ' + MATI),
    ('Bahwa #0046# I tidak pernah berpoligami dari #0046# II', 'Bahwa pada saat menikah tidak ada ikatan perkawinan lain pada diri #0046# maupun ' + MATI),
    ('Bahwa #0046# I tidak pernah berpoligami, #0046# I dengan #0046# II belum pernah bercerai, dan keduanya hidup rukun bersama sampai sekarang',
     'Bahwa pada saat menikah tidak ada ikatan perkawinan lain pada diri #0046# maupun ' + MATI + ', keduanya belum pernah bercerai dan hidup rukun bersama sampai '
     + MATI + ' meninggal dunia pada tanggal #1246# di #1509# karena #1247#'),
    ('Bahwa para #0046# tidak pernah bercerai, bahkan keduanya hidup rukun juga tetap beragama Islam sampai sekarang dan #0007#',
     'Bahwa #0046# dan ' + MATI + ' tidak pernah bercerai, hidup rukun, dan tetap beragama Islam sampai ' + MATI + ' meninggal dunia, serta #0007#'),
    ('Bahwa #0046# I berumur #7211# tahun dan #0046# II berumur #7212# tahun', 'Bahwa mempelai laki-laki berumur #7211# tahun dan mempelai perempuan berumur #7212# tahun'),
    ('perkawinan #0046# I dan #0046# II', 'perkawinan #0046# dengan ' + MATI),
    ('pernikahan #0046# I dan #0046# II', 'pernikahan #0046# dengan ' + MATI),
    ('pernikahan para #0046#', 'pernikahan #0046# dengan ' + MATI),
    ('perkawinan para #0046#', 'perkawinan #0046# dengan ' + MATI),
    ('menikah dengan #0046# II', 'menikah dengan ' + MATI),
    ('yang menikahkan para #0046#', 'yang menikahkan #0046# dengan ' + MATI),
    ('Mengabulkan permohonan #0046# I dan #0046# II', 'Mengabulkan permohonan #0046#'),
    ('Memerintahkan kepada #0046# I dan #0046# II', 'Memerintahkan kepada #0046#'),
    ('maksud #0046# I dan #0046# II menghadap', 'maksud #0046# menghadap'),
    ('#0046# I dan #0046# II', '#0046# dan ' + MATI),
    ('#0046# I dengan #0046# II', '#0046# dengan ' + MATI),
    ('para #0046#', '#0046#'),
    ('Para #0046#', '#0046#'),
    ('Wali Nikah #0046# II', 'Wali Nikah mempelai perempuan'),
    ('Wali Nikah #0046#', 'Wali Nikah mempelai perempuan'),
    ('#0046# II', 'mempelai perempuan'),
    ('#0046# I', 'mempelai laki-laki'),
    ('pernikahan mereka', 'pernikahan tersebut'),
]
MATI_FAKTA = 'Bahwa ' + MATI + ' telah meninggal dunia pada tanggal #1246# di #1509# karena #1247#;'
VOLUNTAIR = ('Menimbang, bahwa oleh karena ' + MATI + ' telah meninggal dunia, permohonan ini diajukan oleh #0046# seorang diri selaku pasangan yang masih hidup '
             'sebagaimana dimaksud Pasal 7 ayat (4) Kompilasi Hukum Islam; bahwa selama pengumuman dan sampai sidang dilaksanakan tidak ada pihak yang menyatakan keberatan, '
             'termasuk dari kerabat ' + MATI + ', sehingga tidak terdapat sengketa dan permohonan ini dapat diperiksa dan diputus secara voluntair;')
DUDUK_MATI = 'Bahwa ' + MATI + ' telah meninggal dunia pada tanggal #1246# di #1509# karena #1247#, sehingga permohonan ini diajukan oleh #0046# seorang diri sebagai pasangan yang masih hidup;'


def _frasa_e(t):
    for lama, baru in GANTI_E:
        t = t.replace(lama, baru)
    return t


def bangun_e():
    b = bangun_d(dua=False)
    for i, p in enumerate(b.par):
        if '#0364#' in polos(p):
            continue  # paragraf token tersembunyi
        b.par[i] = ubah_teks(p, _frasa_e)
    # fakta kematian pada kedua saksi: sesudah butir "tidak pernah bercerai ... meninggal dunia"
    idx = [i for i, p in enumerate(b.par) if 'tidak pernah bercerai, hidup rukun, dan tetap beragama Islam sampai' in polos(p)]
    assert len(idx) == 2, idx
    for i in reversed(idx):
        b.par[i + 1:i + 1] = [ubah_teks(b.par[i], lambda t: MATI_FAKTA)]
    j = b.cari('telah diumumkan selama 14 (empat belas) hari sesuai dengan Keputusan Ketua Mahkamah Agung')
    b.par[j + 1:j + 1] = [buat_dari(b.par[j], VOLUNTAIR)]
    k = b.cari('Bahwa perkara ini telah diumumkan pada tanggal')
    b.par[k + 1:k + 1] = [buat_dari(b.par[k], DUDUK_MATI)]
    return b


def tulis(b, nama):
    os.makedirs(KELUAR, exist_ok=True)
    data = b.simpan(os.path.join(KELUAR, nama))
    return nama, len(data), hashlib.md5(data).hexdigest()


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    print(tulis(bangun_d(), D))
    print(tulis(bangun_e(), E))
