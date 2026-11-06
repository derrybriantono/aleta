# -*- coding: utf-8 -*-
D = 'D:/Aplikasi/aleta/tmp/w223/'
PEMISAH = 'derry_briantono' + chr(92)


def baca(n):
    return [l.rstrip('\r').split('\t') for l in open(D + n, encoding='utf-8-sig', errors='replace').read().split('\n') if l.strip()]


a = baca('buka-word-sesudah.txt')
b = baca('buka-word-sebelum.txt')
print('sesudah BUKA', sum(1 for x in a if x[0] == 'BUKA'), 'GALAT', sum(1 for x in a if x[0] == 'GALAT'))
print('sebelum BUKA', sum(1 for x in b if x[0] == 'BUKA'), 'GALAT', sum(1 for x in b if x[0] == 'GALAT'))
for x in a + b:
    if x[0] == 'GALAT':
        print(x[:2])
hs = {x[2].split(PEMISAH)[1]: int(x[1]) for x in a if x[0] == 'BUKA'}
hb = {x[2].split(PEMISAH)[1]: int(x[1]) for x in b if x[0] == 'BUKA'}
beda = [(k, hb[k], hs[k]) for k in hs if k in hb and hb[k] != hs[k]]
print('halaman beda', len(beda))
for k, x, y in beda:
    print(k[:110], x, '->', y)
