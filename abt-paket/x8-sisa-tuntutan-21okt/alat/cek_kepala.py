"""Baris kepala penanda (>=5 penanda berurutan) di semua RTF Derry: keadaan tampil efektif di posisinya (\\v tersembunyi, \\fsN ukuran).
pakai: python cek_kepala.py [akar]"""
import os, re, sys, collections, json
AKAR = sys.argv[1] if len(sys.argv) > 1 else r'D:\Aplikasi\aleta\tmp\w38\rtf-server\derry_briantono'
PJ = '\\\\?\\'
pola = re.compile(r'(#\d{4}#[ \t]+){4,}#\d{4}#')
kw = re.compile(r'\\([a-z]+)(-?\d+)? ?|\\.|[{}]')


def keadaan_di(s, posisi):
    """Keadaan (v, fs) pada tiap posisi yang diminta (urut)."""
    out = {}
    st = [[0, 24, 0]]
    pos = sorted(posisi)
    k = 0
    for m in kw.finditer(s):
        while k < len(pos) and pos[k] < m.start():
            out[pos[k]] = tuple(st[-1]); k += 1
        t = m.group(0)
        if t == '{':
            st.append(list(st[-1]))
        elif t == '}':
            if len(st) > 1:
                st.pop()
        elif t == '\\*':
            st[-1][2] = 1  # tujuan diabaikan pembaca RTF ({\*\isianasal ...}): tidak pernah tampil
        elif m.group(1):
            w, a = m.group(1), m.group(2)
            if w == 'v':
                st[-1][0] = 0 if a == '0' else 1
            elif w == 'fs' and a:
                st[-1][1] = int(a)
            elif w == 'plain':
                st[-1] = [0, 24, st[-1][2]]
    while k < len(pos):
        out[pos[k]] = tuple(st[-1]); k += 1
    return out


hasil = collections.Counter()
daftar = []
for d, _, fs in os.walk(PJ + AKAR):
    for f in fs:
        if not f.lower().endswith('.rtf'):
            continue
        p = os.path.join(d, f)
        s = open(p, 'rb').read().decode('latin1')
        rel = os.path.relpath(p, PJ + AKAR).replace('\\', '/')
        ms = list(pola.finditer(s))
        if not ms:
            continue
        kd = keadaan_di(s, [m.start() for m in ms])
        for m in ms:
            v, fsz, skip = kd[m.start()]
            k = 'diabaikan (\*isianasal)' if skip else 'tersembunyi' if v else ('teks kecil fs%d' % fsz if fsz <= 4 else 'TAMPIL')
            hasil[(k, rel.split('/')[0])] += 1
            if k == 'TAMPIL':
                daftar.append((rel, m.start(), s[m.start():m.start() + 50]))
for k, v in sorted(hasil.items()):
    print(k, v)
json.dump(daftar, open(r'D:\Aplikasi\aleta\tmp\w26\kepala-tampil.json', 'w'), ensure_ascii=False)
print('TAMPIL total', len(daftar))
