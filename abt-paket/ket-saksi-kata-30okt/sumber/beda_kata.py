# -*- coding: utf-8 -*-
"""Ringkas beda keluaran lama vs baru (k30-beda.txt dari uji_lokal.sh): tiap beda harus berupa pemulihan kata
(potongan 'ya, ' / 'saya' di dalam kata, atau 'Iya, ' di awal) - tidak boleh ada beda lain.
pakai: python beda_kata.py <k30-beda.txt>"""
import collections, difflib, re, sys

jenis = collections.Counter()
contoh = {}
aneh = []
for baris in open(sys.argv[1], encoding='latin1'):
    if '\t||\t' not in baris:
        continue
    lama, baru = baris.rstrip('\n').split('\t||\t', 1)
    sm = difflib.SequenceMatcher(None, lama, baru, autojunk=False)
    for op, a1, a2, b1, b2 in sm.get_opcodes():
        if op == 'equal':
            continue
        sisip = baru[b1:b2]
        hapus = lama[a1:a2]
        konteks = lama[max(0, a1 - 12):a2 + 12]
        if op == 'insert' and sisip.lower() in ('ya, ', 'ya,', 'a, ', 'y', 'ya', 'iya, ') :
            k = 'kembalikan "ya, " di ujung kata'
        elif {hapus.lower(), sisip.lower()} <= {'saksi', 'saya', 'ksi', 'ya', 'k', 'y', 'si', 'a'} or re.fullmatch(r'(sa)?(ksi|ya)', hapus.lower() + '|' + sisip.lower()) or (hapus.lower().endswith('ksi') and sisip.lower().endswith('ya')):
            k = 'kembalikan "saya" di dalam kata'
        elif op in ('delete', 'replace') and hapus.lower().startswith(('i', 'ksi')):
            k = 'buang "Iya, " di awal / saksi'
        else:
            k = 'LAIN'
            aneh.append((hapus, sisip, konteks))
        jenis[k] += 1
        contoh.setdefault(k, (hapus, sisip, konteks, baru[max(0, b1 - 12):b2 + 12]))
for k, v in jenis.most_common():
    print(v, k, '| contoh lama:', repr(contoh[k][2]), '-> baru:', repr(contoh[k][3]))
print('LAIN:', len(aneh))
for a in aneh[:10]:
    print('  ', repr(a))
