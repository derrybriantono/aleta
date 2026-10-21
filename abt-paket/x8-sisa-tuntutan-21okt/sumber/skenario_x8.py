# -*- coding: utf-8 -*-
"""Skenario render php56 paket x8 (alat/render_x8.py): CT [02] Rekonvensi - harta bersama dalam gugatan rekonvensi.
Petitum sintetis (tanpa data pribadi) ditulis ke salinan sipp_x4 hanya selama render; perkara uji berbeda per skenario."""

REK = "1a Perceraian CT/[02] [Kabul] [Rekonvensi] CT - F (Mutah iddah nafkah anak).rtf"
KAB = 'dikabulkan seluruhnya'


def pet(*butir):
    return ''.join('<p>%d. %s</p>' % (i, b) for i, b in enumerate(butir, 1))


POKOK = ['Mengabulkan permohonan Pemohon;', 'Memberi izin kepada Pemohon untuk menjatuhkan talak satu raj&#39;i terhadap Termohon di depan sidang;',
         'Membebankan biaya perkara menurut hukum;']
REKONVENSI = ['Menghukum Tergugat Rekonvensi membayar mut&#39;ah dan nafkah iddah;', 'Menetapkan anak berada di bawah hadhanah Penggugat Rekonvensi;']
HB = 'Menetapkan sebidang tanah dan rumah di Desa Labuan sebagai harta bersama dan membaginya seperdua masing-masing;'
URUT = r'(?m)^5\. Menetapkan harta bersama'

SKENARIO = [
    dict(kode='x8-rek-tanpa-harta', label='CT [02] Rekonvensi, gugatan rekonvensi tanpa harta bersama', rtf=REK, perkara=10066,
         petitum=pet(*(POKOK + REKONVENSI)), harus_sama=True),
    dict(kode='x8-rek-harta-belum', label='CT [02] Rekonvensi, harta bersama dituntut - keputusan belum dipilih', rtf=REK, perkara=10004,
         petitum=pet(*(POKOK + REKONVENSI + [HB])),
         harap_ada={'periksa harta bersama': r'PERIKSA: petitum menuntut harta bersama'}, harap_tidak={'amar harta': r'Menetapkan harta bersama'}),
    dict(kode='x8-rek-harta-kabul', label='CT [02] Rekonvensi, harta bersama dikabulkan', rtf=REK, perkara=10083,
         petitum=pet(*(POKOK + REKONVENSI + [HB])),
         isian={'4105': KAB, '8730': 'sebidang tanah dan rumah di Desa Labuan seluas 300 m2'},
         harap_ada={'pertimbangan rekonvensi': r'dalam gugatan rekonvensinya dituntut pula penetapan harta bersama Tergugat Rekonvensi dan Penggugat Rekonvensi',
                    'dasar pasal 66': r'Pasal 66 ayat \(5\)', 'amar butir 5': URUT, 'sebelum Dalam Konvensi dan Rekonvensi': r'seperdua \(1/2\) dari harta bersama tersebut;\s*\n\s*Dalam Konvensi dan Rekonvensi'},
         harap_tidak={'periksa': r'PERIKSA: petitum menuntut harta bersama'}),
]
