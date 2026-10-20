# -*- coding: utf-8 -*-
"""Render contoh blangko paket W3b lewat renderer php56 ABT asli (render_w3b.py) atas perkara SIPP lokal.
Persiapan: python render_w3b.py siapkan (sekali). Pakai: python render_contoh.py <keluar_dir>
Keluar: <kode>-<perkara>.rtf/.txt dan ringkasan.json (token tersisa, jumlah '...' , [PERIKSA)."""
import os
import sys

SINI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, SINI)
import render_w3b as R  # noqa: E402

PK = os.path.abspath(os.path.join(SINI, '..', 'rtf', 'derry_briantono'))
# (folder, awalan berkas, perkara_id[:urutan sidang] ...) - perkara lokal: 7900 Pdt.G (3 sidang), 9592 Pdt.P (2 sidang), 6326/6952/7900 eksekusi, 9321 verzet
KASUS = [
    ('6d Pencabutan Kekuasaan Orang Tua', '[01] [Kabul]', [7900]),
    ('6d Pencabutan Kekuasaan Orang Tua', '[01b]', [7900]),
    ('6d Pencabutan Kekuasaan Orang Tua', '[01p]', [9592]),
    ('6d Pencabutan Kekuasaan Orang Tua - BAS', 'BAS ALUR 70 Pencabutan Kuasa Asuh - Sidang 2 - T Tetap Tidak Hadir - Pembuktian dan Putusan Verstek', ['7900:2']),
    ('6e Pencabutan Kekuasaan Wali', '[01] [Kabul]', [7900]),
    ('6e Pencabutan Kekuasaan Wali', '[01p]', [9592]),
    ('6f Penunjukan Wali oleh Pengadilan', '[01p]', [9592]),
    ('6f Penunjukan Wali oleh Pengadilan - BAS', 'BAS ALUR 72 Penunjukan Wali - [2]', ['9592:2']),
    ('6g Ganti Rugi terhadap Wali', '[01] [Kabul]', [7900]),
    ('6g Ganti Rugi terhadap Wali', '[01b]', [7900]),
    ('6h Nafkah Anak oleh Ibu', '[01] [Kabul]', [7900]),
    ('6h Nafkah Anak oleh Ibu', '[01b]', [7900]),
    ('96 Eksekusi', '[01]', [6326, 6952]),
    ('96 Eksekusi', '[02]', [6952]),
    ('96 Eksekusi', '[03]', [7900]),
    ('96 Eksekusi - BAS', '[2]', ['6326:5']),
    ('96a Verzet', '[01]', [9321]),
    ('96a Verzet', '[02]', [9321]),
    ('96a Verzet - BAS', '[3]', ['9321:3']),
]


def lp(p):
    p = os.path.abspath(p)
    awalan = chr(92) * 2 + '?' + chr(92)
    return p if p.startswith(awalan) else awalan + p


def cari(folder, awalan, nomor):
    d = os.path.join(PK, folder)
    daftar = sorted(os.listdir(lp(d)))
    pilih = [f for f in daftar if f.startswith(awalan)] or [f for f in daftar if awalan in f]
    if not pilih:
        raise SystemExit('tidak ada: %s / %s' % (folder, awalan))
    kecil = os.path.join(R.TMP, 'w3b-render', 'in')
    os.makedirs(kecil, exist_ok=True)
    tujuan = os.path.join(kecil, 'k%02d.rtf' % nomor)
    with open(lp(os.path.join(d, pilih[0])), 'rb') as f, open(tujuan, 'wb') as g:
        g.write(f.read())
    print('k%02d' % nomor, pilih[0][:100])
    return tujuan


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    keluar = sys.argv[1]
    args = []
    for i, (folder, awalan, perkara) in enumerate(KASUS):
        rtf = cari(folder, awalan, i)
        args.append('k%02d=%s@%s' % (i, rtf, ','.join(str(p) for p in perkara)))
    R.render(keluar, args)
