# -*- coding: utf-8 -*-
import json, sys, collections
sys.stdout.reconfigure(encoding='utf-8')
d = json.load(open(r'D:\Aplikasi\aleta\tmp\x2\out\banding_sql.json', encoding='utf-8'))


def kls(x):
    return 'tak-ada-baris(...)' if x is None else ('kosong' if x == '' else 'isi')


ring = {}
tabel = {}
for var in ['15', '18', '6031', '6032', '5101', '1241', '1242', '1251', '1252', '6149', '1197', '1203', '6100', '6106', '6132', '8544', '8545', '74']:
    v = d[var]
    tot = len(v)
    c = collections.Counter()
    beda = []
    for p, (a, b) in v.items():
        if a == b:
            c['sama'] += 1
        else:
            c['%s -> %s' % (kls(a), kls(b)) + (' (isi lain)' if a not in (None, '') and b not in (None, '') else '')] += 1
            beda.append((p, a, b))
    ring[var] = beda
    tabel[var] = dict(total=tot, sama=c['sama'], berbeda=len(beda), rincian={k: n for k, n in c.items() if k != 'sama'})
    print('%s: perkara %d | sama %d | berbeda %d | %s' % (var, tot, c['sama'], len(beda), dict((k, n) for k, n in c.items() if k != 'sama')))
json.dump(dict(beda=ring, tabel=tabel), open(r'D:\Aplikasi\aleta\tmp\x2\out\beda_sql.json', 'w', encoding='utf-8'), ensure_ascii=False)
