# -*- coding: utf-8 -*-
"""Banding render ABT asli sebelum/sesudah paket tinjau-31okt: perbedaan yang BOLEH terlihat untuk Donggala hanya
(22) bentuk baku RBg, (21) ayat (2) tenggang verzet, (23) butir "-" (baris baru). Selain itu = SALAH.
pakai: python banding_t45.py <folder sebelum> <folder sesudah> <keluar.json>"""
import difflib
import json
import os
import re
import sys


def kata(t):
    t = t.replace(' ', ' ')
    return re.findall(r'\S+', t)


BOLEH = [
    (['R.Bg.'], ['RBg.']), (['R.Bg.'], ['RBg']), (['R.Bg.,'], ['RBg,']), (['R.Bg.;'], ['RBg;']), (['Rbg'], ['RBg']), (['Rbg,'], ['RBg,']),
    (['Rbg;'], ['RBg;']), (['Rbg.'], ['RBg.']),
    (['(1)'], ['(2)']),
    ([], ['-']), (['bahwa'], ['-', 'Bahwa']), (['bahwa'], ['Bahwa']),
]


def golong(a, b):
    if (a, b) in [(x, y) for x, y in BOLEH]:
        return 'boleh'
    s, t = ' '.join(a), ' '.join(b)
    if re.sub(r'Reglemen Acara Hukum untuk Daerah Luar Jawa dan Madura \(RBg\)', 'RBg', s) == t:
        return 'boleh'
    return 'SALAH'


def main():
    a_dir, b_dir, kel = sys.argv[1:4]
    hasil = []
    for f in sorted(os.listdir(a_dir)):
        if not f.endswith('.txt'):
            continue
        a = kata(open(os.path.join(a_dir, f), encoding='utf-8').read())
        pb = os.path.join(b_dir, f)
        if not os.path.exists(pb):
            hasil.append(dict(berkas=f, salah=['tidak ada sesudah']))
            continue
        b = kata(open(pb, encoding='utf-8').read())
        salah, boleh = [], 0
        for op, i1, i2, j1, j2 in difflib.SequenceMatcher(None, a, b, autojunk=False).get_opcodes():
            if op == 'equal':
                continue
            if golong(a[i1:i2], b[j1:j2]) == 'boleh':
                boleh += 1
            else:
                salah.append(' '.join(a[max(0, i1 - 6):i2 + 3]) + '  =>  ' + ' '.join(b[max(0, j1 - 6):j2 + 3]))
        baris_a = open(os.path.join(a_dir, f), encoding='utf-8').read().count('\n')
        baris_b = open(pb, encoding='utf-8').read().count('\n')
        hasil.append(dict(berkas=f, boleh=boleh, salah=salah[:8], baris_tambah=baris_b - baris_a))
    json.dump(hasil, open(kel, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('dibandingkan', len(hasil), '| sama persis', sum(1 for h in hasil if not h.get('boleh') and not h['salah']),
          '| hanya ubahan yang dimaksud', sum(1 for h in hasil if h.get('boleh') and not h['salah']), '| ADA BEDA LAIN', sum(1 for h in hasil if h['salah']),
          '| butir "-" (baris baru)', sum(max(0, h.get('baris_tambah', 0)) for h in hasil))


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    main()
