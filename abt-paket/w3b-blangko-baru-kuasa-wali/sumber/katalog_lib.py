# -*- coding: utf-8 -*-
"""Pustaka penyusun katalog saksi (skema saksi-katalog/1) paket W3b.

Satu pertanyaan = teks + hal + empat kalimat inti untuk saksi 1 dan empat untuk saksi 2 (ISI, parafrase dengan penanda yang SAMA);
jawaban jenis melihat / mendengar / de-auditu / sebagian dibangkitkan dari kalimat inti itu lewat bingkai tetap, supaya maksud tiap tingkat
pengetahuan saksi sama dan kalimatnya berbeda untuk saksi 1 dan saksi 2. Tidak-tahu dan ragu dari jawabanUmum (disalin dari katalog yang sudah ada).
Aturan penjaga (ekstensi-sipp/saksi-katalog.js periksaKatalog) diperiksa lewat alat/periksa_katalog.cjs: tanpa "ya, ", tanpa awalan huruf besar,
tanpa tanda baca akhir, jumlah kata negasi sama pada semua varian satu jawaban, penanda dan angka sama, saksi1 x saksi2 tidak nyaris kembar.
"""
import copy
import json
import os
import re

AKAR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REPO = os.path.dirname(os.path.dirname(AKAR))
KATALOG = os.path.join(REPO, 'ekstensi-sipp', 'saksi-katalog')

BINGKAI = {
    'melihat': (
        ['saya mengetahui sendiri bahwa {k}', 'saya melihat sendiri bahwa {k}', 'saya sendiri mengalami dan mengetahui bahwa {k}', 'saya menyaksikan sendiri bahwa {k}'],
        ['setahu saya secara langsung {k}', 'saya tahu betul bahwa {k}', 'menurut pengetahuan saya sendiri {k}', 'saya mengetahui secara langsung bahwa {k}'],
    ),
    'mendengar': (
        ['saya mendengar sendiri bahwa {k}', 'saya mendengar langsung pembicaraan bahwa {k}', 'dengan telinga saya sendiri saya mendengar bahwa {k}', 'saya mendengar secara langsung ucapan bahwa {k}'],
        ['saya sendiri yang mendengar bahwa {k}', 'saya pernah mendengar langsung bahwa {k}', 'ucapan itu saya dengar sendiri bahwa {k}', 'saya mendengar dengan jelas bahwa {k}'],
    ),
    'de-auditu': (
        ['{{sumber}} bercerita kepada saya bahwa {k}', 'saya diberi tahu oleh {{sumber}} bahwa {k}', 'menurut cerita {{sumber}} kepada saya {k}', 'saya mengetahui dari cerita {{sumber}} bahwa {k}'],
        ['saya hanya mendapat cerita dari {{sumber}} bahwa {k}', 'saya dikabari oleh {{sumber}} bahwa {k}', 'kabar dari {{sumber}} yang sampai kepada saya menyatakan {k}', 'berdasarkan penuturan {{sumber}} {k}'],
    ),
    'sebagian': (
        ['yang saya ketahui hanya sebagian saja yaitu bahwa {k}, sedangkan selebihnya kurang saya ketahui', 'saya hanya tahu sebagian yaitu bahwa {k}, dan selebihnya kurang saya ketahui',
         'pengetahuan saya sebatas bahwa {k}, selebihnya saya kurang tahu', 'hanya sebagian yang saya ketahui yakni {k}, sisanya kurang jelas bagi saya'],
        ['sepanjang yang saya ketahui sebagian saja yaitu {k}, selebihnya saya kurang mengetahuinya', 'saya cuma mengetahui sebagian yaitu bahwa {k}, selebihnya kurang saya pahami',
         'yang sampai pada pengetahuan saya sebatas {k}, selainnya kurang saya ketahui', 'sebagian saja yang saya tahu yaitu {k}, sedangkan sisanya luput dari pengetahuan saya'],
    ),
}


def akhiri(k):
    """Kalimat inti tidak boleh berakhir titik/koma (aturan penjaga): titik-titik penanda isian di ujung diberi penutup kata."""
    k = k.strip()
    if k.endswith('...'):
        k += ' yang lalu' if re.search(r'(sejak|pada|selama|semenjak|dari|mulai|hingga|sampai)\s+\.\.\.$', k) else ' dan lain-lain'
    return k


def jawab(jenis, k1, k2, maksud):
    """k1, k2 = 4 kalimat inti (saksi 1 / saksi 2). Kembalikan objek jawaban satu jenis."""
    b1, b2 = BINGKAI[jenis]
    k1, k2 = [akhiri(x) for x in k1], [akhiri(x) for x in k2]
    s1 = [b1[i].format(k=k1[i]).replace('{{', '{').replace('}}', '}') for i in range(4)]
    s2 = [b2[i].format(k=k2[i]).replace('{{', '{').replace('}}', '}') for i in range(4)]
    return {'maksud': maksud, 'saksi1': s1, 'saksi2': s2}


def Q(id, pokok, urutan, tingkat, kelompok, teks, hal, k1, k2, variabel, teks_varian=None, keadaan=None, ks1=None, ks2=None, pihak=None, maksud=None, jenis=None):
    """ks1/ks2 = kalimat inti LEBIH PENDEK untuk jenis sebagian (bila tidak ada, memakai k1/k2)."""
    tetap = kelompok in ('identitas', 'hubungan', 'penutup')
    maksud = maksud or hal
    jw = {'melihat': jawab('melihat', k1, k2, 'saksi mengetahui sendiri: ' + maksud)}
    if not tetap:
        jw['mendengar'] = jawab('mendengar', k1, k2, 'saksi mendengar sendiri ucapan para pihak mengenai: ' + maksud)
        jw['de-auditu'] = jawab('de-auditu', k1, k2, 'saksi mengetahui dari cerita orang lain mengenai: ' + maksud)
        jw['sebagian'] = jawab('sebagian', ks1 or k1, ks2 or k2, 'saksi hanya mengetahui sebagian mengenai: ' + maksud)
    q = {
        'id': id, 'pokok': pokok, 'urutan': urutan, 'tingkat': tingkat, 'kelompok': kelompok, 'pihakSaksi': pihak or ['*'], 'keadaan': keadaan or {},
        'teks': teks, 'hal': hal, 'tidakBerlaku': [] if tetap else ['berbeda'], 'jawaban': jw, 'variabelAbt': sorted(set(variabel)),
    }
    if teks_varian:
        q['teksVarian'] = teks_varian
    return q


def jawaban_umum_dari(nama_katalog='wasiat.json'):
    d = json.load(open(os.path.join(KATALOG, nama_katalog), encoding='utf-8'))
    return copy.deepcopy(d['jawabanUmum'])


def dasar_dari(nama_katalog, ids):
    """Salin entri dasarHukum (id tertentu) dari katalog yang sudah ada."""
    d = json.load(open(os.path.join(KATALOG, nama_katalog), encoding='utf-8'))
    peta = {x['id']: x for x in d['dasarHukum']}
    return [copy.deepcopy(peta[i]) for i in ids]


def tulis_katalog(kat, nama):
    p = os.path.join(KATALOG, nama)
    with open(p, 'w', encoding='utf-8', newline='\n') as f:
        json.dump(kat, f, ensure_ascii=False, indent=2)
        f.write('\n')
    return p
