# -*- coding: utf-8 -*-
import sys, os
sys.path.insert(0, 'D:/aleta-dev/wt/w206/abt-paket/audit-mekanis-4nov/sumber')
from rtfpeta import peta
def teks(path):
    b = open(path, 'rb').read()
    t, pos = peta(b)
    return b, t, pos
if __name__ == '__main__':
    p = sys.argv[1]
    b, t, pos = teks(p)
    sys.stdout.reconfigure(encoding='utf-8')
    print(t)
