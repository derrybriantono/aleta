# -*- coding: utf-8 -*-
import sys, re, os
sys.path.insert(0, 'D:/Aplikasi/aleta/tmp/w206/alat')
from teks import teks
sys.stdout.reconfigure(encoding='utf-8')
D = 'D:/Aplikasi/aleta/tmp/w206/dasar/'
BS = chr(92)


def semua(akar=D):
    for d, _, fs in os.walk(akar + 'derry_briantono'):
        for f in sorted(fs):
            if f.lower().endswith('.rtf'):
                yield os.path.relpath(os.path.join(d, f), akar).replace(BS, '/')


if __name__ == '__main__':
    rx = re.compile(sys.argv[1])
    w = int(sys.argv[2]) if len(sys.argv) > 2 else 200
    sar = sys.argv[3] if len(sys.argv) > 3 else ''
    n = 0
    for rel in semua():
        if sar and sar not in rel:
            continue
        b, t, pos = teks(D + rel)
        for m in rx.finditer(t):
            print('==', rel.replace('derry_briantono/', ''), '|', t[max(0, m.start() - w):m.end() + w].replace('\n', ' / '))
            n += 1
    print('TOTAL', n)
