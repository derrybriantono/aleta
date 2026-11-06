# -*- coding: utf-8 -*-
import os

S = 'D:/Aplikasi/aleta/tmp/w223/sesudah/derry_briantono'
G = 'D:/Aplikasi/aleta/tmp/w223/gabung/derry_briantono'
ses, seb = [], []
for f in sorted(os.listdir(S)):
    for b in sorted(os.listdir(S + '/' + f)):
        ses.append((S + '/' + f + '/' + b).replace('/', '\\'))
        if os.path.exists(G + '/' + f + '/' + b):
            seb.append((G + '/' + f + '/' + b).replace('/', '\\'))
open('D:/Aplikasi/aleta/tmp/w223/daftar-sesudah.txt', 'w', encoding='utf8').write('\n'.join(ses))
open('D:/Aplikasi/aleta/tmp/w223/daftar-sebelum.txt', 'w', encoding='utf8').write('\n'.join(seb))
print(len(ses), len(seb))
