# -*- coding: utf-8 -*-
"""Menambahkan berkas dan menu paket ini ke fixture bersama uji portal (manajemen_surat/src/test/fixtures/blangko-derry-server-17okt.json),
seperti paket-paket sebelumnya (fixture memuat juga paket yang BELUM terpasang). Idempoten: entri paket ini dibuang dulu lalu ditambahkan lagi.
Pakai: python buat_fixture_uji.py"""
import importlib
import json
import os
import sys

SINI = os.path.dirname(os.path.abspath(__file__))
AKAR = os.path.dirname(SINI)
sys.path.insert(0, os.path.join(AKAR, 'sumber'))
sys.path.insert(0, SINI)
sys.stdout.reconfigure(encoding='utf-8')
import jenis as J  # noqa: E402

FIXTURE = os.path.abspath(os.path.join(AKAR, '..', '..', 'manajemen_surat', 'src', 'test', 'fixtures', 'blangko-derry-server-17okt.json'))
CATATAN = ('W3b 21 Okt (abt-w3b-blangko-baru-kuasa-wali, BELUM terpasang): folder BARU 6d Pencabutan Kekuasaan Orang Tua, 6e Pencabutan Kekuasaan Wali, 6f Penunjukan Wali oleh Pengadilan, '
           '6g Ganti Rugi terhadap Wali, 6h Nafkah Anak oleh Ibu, 96 Eksekusi, 96a Verzet (masing-masing + BAS; gugatan 353/355/357/350 menerima 29 salinan BAS ALUR 04-09), '
           'menu 240-253 INSERT paket (acuan jenis 353/355/356/357/350; eksekusi dan verzet menurut alur_perkara_id/proses); dibangkitkan alat/buat_fixture_uji.py.')


def main():
    d = json.load(open(FIXTURE, encoding='utf-8'))
    berkas_paket = []
    for baris in open(os.path.join(AKAR, 'paket-satker', 'daftar-rtf.tsv'), encoding='utf-8'):
        if baris.startswith('#') or not baris.strip():
            continue
        f, b = baris.split('\t')[:2]
        berkas_paket.append(f + '/' + b)
    menu_paket = []
    for kunci, x in J.JENIS.items():
        try:
            S = importlib.import_module(x['modul']).SPEK
        except ModuleNotFoundError:
            continue
        for m in J.menu_baris(kunci, S['folder']):
            menu_paket.append({k: m[k] for k in ('id', 'nama', 'nama_alias', 'direktori', 'parent_direktori', 'proses_id_min', 'proses_id_max', 'user_cek', 'user_grup_id', 'user_top_id')})
    ids = {m['id'] for m in menu_paket}
    d['berkas'] = [b for b in d['berkas'] if b not in set(berkas_paket)] + berkas_paket
    d['menu'] = [m for m in d['menu'] if m['id'] not in ids] + menu_paket
    if CATATAN not in d['sumber']:
        d['sumber'] = d['sumber'] + ' | ' + CATATAN
    json.dump(d, open(FIXTURE, 'w', encoding='utf-8', newline='\n'), ensure_ascii=False, indent=1)
    print('fixture bersama: +%d berkas, +%d menu -> %s' % (len(berkas_paket), len(menu_paket), FIXTURE))


if __name__ == '__main__':
    main()
