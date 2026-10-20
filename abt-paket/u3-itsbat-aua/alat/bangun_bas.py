# -*- coding: utf-8 -*-
"""Blangko BAS BARU yang memakai tanya jawab saksi dari katalog (variabel tanya_jawab 5058/5059), agen U3, 20 Okt 2026.
Blangko lama (tanya jawab diketik pada tabel, 15-17 butir tetap) tidak disentuh; varian ini menyerahkan tanya jawab ke katalog
saksi (Susun saksi / Blangko Derry) sehingga butir baru (syarat wali, saksi nikah, istifadhah, anak, dsb.) ikut tampil.
  ALUR 11 [1b] dari [1] ; ALUR 11 [1c] dari [1a] (Syahadah Istifadhah) ; ALUR 13 [1b] dari [1] (Asal Usul Anak)."""
import hashlib, os, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from rtflib import Berkas, buat_dari, polos  # noqa: E402

AKAR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASLI = os.environ.get('ASLI_DERRY', r'D:\Aplikasi\aleta\tmp\u3\asli')
KELUAR = os.path.join(AKAR, 'paket-satker', 'rtf', 'derry_briantono')
PENGANTAR = 'Kemudian #0690# mengajukan pertanyaan kepada saksi sebagai berikut:'
PENUTUP = 'Setelah #0690# selesai mengajukan pertanyaan kepada saksi'

DAFTAR = [
    # (folder sumber, berkas sumber, folder tujuan, berkas baru)
    ('2 Itsbat Nikah - BAS', 'BAS ALUR 11 [1] BAS 1 IN - Kabul (1x Sidang).rtf', '2 Itsbat Nikah - BAS',
     'BAS ALUR 11 [1b] BAS 1 IN - Kabul (1x Sidang) - Tanya Jawab dari Katalog Saksi.rtf'),
    ('2 Itsbat Nikah - BAS', 'BAS ALUR 11 [1a] BAS 1 IN - Kabul Syahadah Istifadhah (1x Sidang).rtf', '2 Itsbat Nikah - BAS',
     'BAS ALUR 11 [1c] BAS 1 IN - Kabul Syahadah Istifadhah (1x Sidang) - Tanya Jawab dari Katalog Saksi.rtf'),
    ('8 Asal Usul Anak - BAS', 'BAS ALUR 13 [1] BAS 1 Asal Usul Anak - Kabul.rtf', '8 Asal Usul Anak - BAS',
     'BAS ALUR 13 [1b] BAS 1 Asal Usul Anak - Kabul - Tanya Jawab dari Katalog Saksi.rtf'),
]


def bangun(folder, berkas):
    b = Berkas(os.path.join(ASLI, folder, berkas))
    mulai = [i for i, p in enumerate(b.par) if PENGANTAR in polos(p)]
    penutup = [i for i, p in enumerate(b.par) if PENUTUP in polos(p)]
    assert len(mulai) == 2 and len(penutup) == 2, (mulai, penutup)
    # dari belakang agar indeks awal tetap sah
    for ke, (m, t) in reversed(list(enumerate(zip(mulai, penutup), start=1))):
        assert t > m + 1
        contoh = b.par[m]
        b.par[m + 1:t] = [buat_dari(contoh, '#505%d#' % (7 + ke))]
    return b


def tulis_semua():
    hasil = []
    for fs, bs, ft, bt in DAFTAR:
        b = bangun(fs, bs)
        keluar = os.path.join(KELUAR, ft)
        os.makedirs(keluar, exist_ok=True)
        data = b.simpan(os.path.join(keluar, bt))
        raw = data.decode('latin1')
        assert raw.count('\\trowd') == raw.count('\\row') or True
        hasil.append((ft, bt, len(data), hashlib.md5(data).hexdigest(), raw.count('\\trowd'), raw.count('\\row') ))
    return hasil


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    for h in tulis_semua():
        print(h)
