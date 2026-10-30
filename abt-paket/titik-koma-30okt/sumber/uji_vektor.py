# -*- coding: utf-8 -*-
"""Uji isian_rtf_butir_rapi atas vektor-rapi.json di basis salinan (fungsi harus sudah dibuat di basis itu).
Vektor yang sama dipakai uji ekstensi (rapiButir di blangko-derry-isian.js) - panel dan cetak ABT satu aturan.
pakai: python uji_vektor.py <basis>"""
import json, os, subprocess, sys
SINI = os.path.dirname(os.path.abspath(__file__))
MYSQL = r'D:\satker asal\website pa bungku\xampp\mysql\bin\mysql.exe'
db = sys.argv[1]
vek = json.load(open(os.path.join(SINI, 'vektor-rapi.json'), encoding='utf-8'))
hx = lambda s: "CONVERT(X'%s' USING latin1)" % s.encode('latin1').hex() if s else "CONVERT('' USING latin1)"
q = ';\n'.join("SELECT HEX(isian_rtf_butir_rapi(%s, '%s'))" % (hx(v['masuk']), v['ujung']) for v in vek) + ';\n'
r = subprocess.run([MYSQL, '-u', 'root', '-h', '127.0.0.1', '-N', '--default-character-set=latin1', db], input=q.encode('latin1'), capture_output=True)
if r.returncode:
    sys.exit(r.stderr.decode('latin1'))
keluar = [bytes.fromhex(x.strip()).decode('latin1') for x in r.stdout.decode('latin1').splitlines()]
gagal = 0
for v, k in zip(vek, keluar):
    if k != v['harap']:
        gagal += 1
        print('BEDA', repr(v['masuk']), '->', repr(k), 'harap', repr(v['harap']))
print('vektor', len(vek), 'keluar', len(keluar), 'gagal', gagal)
sys.exit(1 if gagal or len(keluar) != len(vek) else 0)
