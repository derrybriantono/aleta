# -*- coding: utf-8 -*-
import json, re, sys
D = 'D:/Aplikasi/aleta/tmp/w177/render-mini/'
a = json.load(open(D + 'mini-sebelum.json', encoding='utf-8'))
b = json.load(open(D + 'mini-sesudah.json', encoding='utf-8'))


def pecah(teks):
    return teks


def norm(t):
    t = t.replace('**', '')
    t = re.sub(r'\s+', ' ', t)
    t = re.sub(r'\s+([,;])', r'\1', t)
    t = t.replace('(umur) ', '')
    t = re.sub(r' \(\d+ tahun\)', '', t)
    # tukar pekerjaan/pendidikan -> urutan baku: agama X, pendidikan A, pekerjaan B
    t = re.sub(r', pekerjaan ([^,]*?), pendidikan ([^,]*?),', r', pendidikan \2, pekerjaan \1,', t)
    t = t.replace(', yang telah didaftarkan', ' yang telah didaftarkan')
    t = t.replace('Kuasa Khusus, yang', 'Kuasa Khusus yang')
    t = t.replace('; ;', ';')
    return t.strip()

sama = beda = 0
for k in b:
    if k not in a:
        print('tidak ada di sebelum', k)
        continue
    pa = [t for kode, t in a[k]]
    pb = [t for kode, t in b[k]]
    na = ' | '.join(norm(x) for x in pa)
    nb = ' | '.join(norm(x) for x in pb)
    if na == nb:
        sama += 1
    else:
        beda += 1
        print('=== BEDA', k)
        # tampilkan titik beda pertama
        i = 0
        while i < min(len(na), len(nb)) and na[i] == nb[i]:
            i += 1
        print('  sebelum:', na[max(0, i - 80):i + 160])
        print('  sesudah:', nb[max(0, i - 80):i + 160])
print('sama (setelah normalisasi)', sama, 'beda', beda)
