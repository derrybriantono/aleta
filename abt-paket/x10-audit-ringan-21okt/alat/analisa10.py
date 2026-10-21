# -*- coding: utf-8 -*-
import collections, json, sys
sys.stdout.reconfigure(encoding='utf-8')


def kls(x):
    return 'tak-ada-baris' if x is None else ('kosong' if x == '' else 'isi')


ring = {}
for lab in sys.argv[1:]:
    d = json.load(open(r'D:\Aplikasi\aleta\tmp\x10\out\banding_%s.json' % lab, encoding='utf-8'))
    for var, v in d.items():
        c = collections.Counter()
        beda = []
        for p, (a, b) in v.items():
            if a == b:
                c['sama'] += 1
            else:
                c['%s -> %s' % (kls(a), kls(b)) + (' (isi lain)' if a not in (None, '') and b not in (None, '') else '')] += 1
                beda.append((p, a, b))
        print('%s [%s]: perkara %d | sama %d | berbeda %d | %s' % (var, lab, len(v), c['sama'], len(beda), {k: n for k, n in c.items() if k != 'sama'}))
        for p, a, b in beda[:6]:
            print('     ', p, '|', (a or '')[:50].replace('\n', ' '), '->', (b or '')[:50].replace('\n', ' '))
        ring[var] = dict(label=lab, total=len(v), sama=c['sama'], berbeda=len(beda), rincian={k: n for k, n in c.items() if k != 'sama'})
json.dump(ring, open(r'D:\Aplikasi\aleta\tmp\x10\out\ringkas_sql_%s.json' % '_'.join(sys.argv[1:]), 'w', encoding='utf-8'), ensure_ascii=False)
