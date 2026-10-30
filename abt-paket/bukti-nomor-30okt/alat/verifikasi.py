# -*- coding: utf-8 -*-
"""Periksa paket bukti-nomor: terapkan rtf-tambal ke pohon dasar (di memori), lalu tiap berkas: teks yang hilang hanya
paragraf "[n.] #isian#", teks yang bertambah hanya "#variabel baru#", kurung seimbang, tanpa kata nama aplikasi, dan di
SELURUH pohon tidak ada lagi isian bukti yang tercetak langsung (di luar baris daftar isian tersembunyi).
pakai: python verifikasi.py <akar dasar derry_briantono> <folder paket-satker>"""
import base64, difflib, hashlib, os, re, sys
SINI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(SINI, '..', 'sumber'))
sys.path.insert(0, os.path.join(SINI, '..', '..', 'bas-tanya-jawab-29okt', 'sumber'))
from rtf2txt import rtf_ke_teks  # noqa: E402
from rtfsatuan import seimbang, satuan  # noqa: E402
from bangun_bukti import PETA, POLA, tersembunyi, panjang  # noqa: E402

akar, pk = sys.argv[1], sys.argv[2]
tb = {}
for l in open(os.path.join(pk, 'rtf-tambal.tsv'), encoding='utf-8'):
    if l.strip():
        r, i, j, a, b = l.rstrip('\n').split('\t')
        tb.setdefault(base64.b64decode(r).decode('utf-8'), []).append((int(j), base64.b64decode(a).decode('latin1'), base64.b64decode(b).decode('latin1')))
baru_pola = re.compile(r'^#(%s)#$' % '|'.join(PETA.values()))
salah = 0
n = 0
for l in open(os.path.join(pk, 'rtf-daftar-tambal.tsv'), encoding='utf-8'):
    kode, r, m0, m1, _ = l.rstrip('\n').split('\t')
    d = open(panjang(os.path.join(akar, r)), 'rb').read().decode('latin1')
    if hashlib.md5(d.encode('latin1')).hexdigest() != m0:
        print('MD5 DASAR BEDA', r)
        salah += 1
        continue
    o = d
    for j, a, b in tb[r]:
        assert o.count(a) == j
        o = o.replace(a, b)
    if hashlib.md5(o.encode('latin1')).hexdigest() != m1:
        print('MD5 HASIL BEDA', r)
        salah += 1
    tl = [re.sub(r'\s+', ' ', x).strip() for x in rtf_ke_teks(d).split('\n') if x.strip()]
    tn = [re.sub(r'\s+', ' ', x).strip() for x in rtf_ke_teks(o).split('\n') if x.strip()]
    for op, a1, a2, b1, b2 in difflib.SequenceMatcher(None, tl, tn, autojunk=False).get_opcodes():
        if op == 'equal':
            continue
        for x in tl[a1:a2]:
            if not POLA.match(x):
                print('HILANG LAIN', r, x[:100])
                salah += 1
        for x in tn[b1:b2]:
            if not baru_pola.match(x):
                print('TAMBAH LAIN', r, x[:100])
                salah += 1
    if seimbang(o) != seimbang(d) or re.search('aleta', o, re.I):
        print('KURUNG/APLIKASI', r)
        salah += 1
    n += 1
print('berkas diperiksa', n, 'salah', salah)
# seluruh pohon sesudah paket: isian bukti tidak tercetak langsung
sisa = 0
A = panjang(akar)
for dp, dn, fn in os.walk(A):
    rel = os.path.relpath(dp, A).replace(chr(92), '/')
    if rel != '.' and rel.split('/')[0].startswith(('ALUR', '- BAS', 'terhapus', 'BAS ')):
        continue
    for f in fn:
        if not f.lower().endswith('.rtf'):
            continue
        r = f if rel == '.' else rel + '/' + f
        d = open(os.path.join(dp, f), 'rb').read().decode('latin1')
        if r in tb:
            for j, a, b in tb[r]:
                d = d.replace(a, b)
        for s, e, _, _ in satuan(d):
            raw = d[s:e]
            t = rtf_ke_teks(raw).replace('\n', ' ').strip()
            if any('#%s#' % k in t for k in PETA) and not tersembunyi(raw, t):
                sisa += 1
                print('SISA TERCETAK', r, t[:100])
print('isian bukti masih tercetak langsung:', sisa)
