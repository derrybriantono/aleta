# -*- coding: utf-8 -*-
import difflib, json, os, re, sys
sys.stdout.reconfigure(encoding='utf-8')
O = r'D:\Aplikasi\aleta\tmp\x2\out\\'
a0 = json.load(open(O + r'sebelum\rtf\ringkasan.json'))
a1 = json.load(open(O + r'sesudah\rtf\ringkasan.json'))
jml = dict(sama=0, beda=0, galat0=0, galat1=0)
rinci = []
for k in sorted(a1):
    f0 = O + r'sebelum\rtf\%s.txt' % k
    f1 = O + r'sesudah\rtf\%s.txt' % k
    t0 = open(f0, encoding='utf-8').read()
    t1 = open(f1, encoding='utf-8').read()
    if a0[k]['galat']:
        jml['galat0'] += 1
    if a1[k]['galat']:
        jml['galat1'] += 1
    if t0 == t1:
        jml['sama'] += 1
        continue
    jml['beda'] += 1
    L0, L1 = t0.split('\n'), t1.split('\n')
    sm = difflib.SequenceMatcher(None, L0, L1, autojunk=False)
    diffs = []
    for tag, i1, i2, j1, j2 in sm.get_opcodes():
        if tag != 'equal':
            diffs.append((' | '.join(x.strip() for x in L0[i1:i2])[:140], ' | '.join(x.strip() for x in L1[j1:j2])[:140]))
    rinci.append((k, a0[k]['titik3'], a1[k]['titik3'], a0[k]['galat'], a1[k]['galat'], diffs))
print(jml, '| berkas', len(a1))
for k, t0, t1, g0, g1, diffs in rinci:
    print('\n##', k, '"..." %d -> %d' % (t0, t1), 'galat' if g0 or g1 else '', '| baris berbeda', len(diffs))
    for a, b in diffs[:8]:
        print('   -', a)
        print('   +', b)
json.dump(rinci, open(O + 'banding_rtf.json', 'w', encoding='utf-8'), ensure_ascii=False)
