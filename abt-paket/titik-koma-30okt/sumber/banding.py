# -*- coding: utf-8 -*-
"""Rinci beda keluaran LAMA vs BARU (beda.tsv dari uji_lokal.sh: jenis TAB perkara TAB hex lama TAB hex baru).
Penjaga: urutan HURUF dan ANGKA harus sama persis (paket hanya mengubah tanda baca dan spasi). Tiap beda digolongkan.
pakai: python banding.py <beda.tsv> [<keluar ringkas>]"""
import collections, difflib, re, sys

ALNUM = re.compile(r'[0-9A-Za-zÀ-ÿ]')
TAG = re.compile(r'(?i)<br\s*/?>|&nbsp;')  # tanda ganti baris HTML bukan huruf isi
gol = collections.Counter()
per_jenis = collections.Counter()
contoh = {}
huruf_beda = []
semi_tengah = collections.Counter()


def tengah(t):
    """jumlah ';' di tengah butir (diikuti huruf/angka sebelum <br> berikutnya / ujung)."""
    n = 0
    for bt in t.split('<br>'):
        for m in re.finditer(';', bt):
            if re.search(r'&[A-Za-z#0-9]{2,8}$', bt[:m.start()]):
                continue
            if ALNUM.search(bt[m.end():]):
                n += 1
    return n


for baris in open(sys.argv[1], encoding='latin1'):
    j, pid, a, b = baris.rstrip('\n').split('\t')
    lama, baru = bytes.fromhex(a).decode('latin1'), bytes.fromhex(b).decode('latin1')
    jenis = 'saksi' if j == 'S' else 'bukti'
    per_jenis[jenis] += 1
    semi_tengah[jenis + ' ; di tengah LAMA'] += tengah(lama)
    semi_tengah[jenis + ' ; di tengah BARU'] += tengah(baru)
    if ''.join(ALNUM.findall(TAG.sub('', lama))) != ''.join(ALNUM.findall(TAG.sub('', baru))):
        huruf_beda.append((pid, lama[:160], baru[:160]))
    sm = difflib.SequenceMatcher(None, lama, baru, autojunk=False)
    for op, a1, a2, b1, b2 in sm.get_opcodes():
        if op == 'equal':
            continue
        h, s = lama[a1:a2], baru[b1:b2]
        ki = lama[max(0, a1 - 1):a1]
        if h == ';' and s == ',':
            k = '";" di tengah -> ","'
        elif h.strip() == '' and s == '' and lama[a2:a2 + 1] in ';,.:':
            k = 'spasi sebelum tanda baca dibuang'
        elif h == '' and s == ' ':
            k = 'spasi sesudah tanda baca ditambah'
        elif h.strip() == '' and s == ' ' or (h.strip() == '' and s == ''):
            k = 'spasi ganda / ganti baris / tab dirapikan'
        elif h == '' and s == ';' and (b2 == len(baru) or baru[b2:b2 + 4] == '<br>'):
            k = 'ujung butir diberi ";"'
        elif h == '.' and s == ';':
            k = 'titik ujung butir -> ";"'
        elif re.fullmatch(r'[;,.: ]+', h or 'x') and re.fullmatch(r'[;,.: ]*', s):
            k = 'tanda baca ganda dirapikan'
        elif re.fullmatch(r'\s*-\s*', h) and s.strip() == '':
            k = 'tanda butir "-" sesudah ":"/";" dibuang'
        elif '<br' in h.lower() or '\r' in h or '\n' in h or '\t' in h:
            k = 'ganti baris / <br> / tab di dalam butir -> spasi'
        else:
            k = 'LAIN'
        gol[(jenis, k)] += 1
        contoh.setdefault((jenis, k), (lama[max(0, a1 - 30):a2 + 30], baru[max(0, b1 - 30):b2 + 30]))
out = []
out.append('kelompok berbeda: ' + ', '.join('%s %d' % kv for kv in per_jenis.items()))
out.append('PENJAGA huruf/angka berubah: %d' % len(huruf_beda))
for x in huruf_beda[:5]:
    out.append('   ' + repr(x))
for k, v in sorted(semi_tengah.items()):
    out.append('%s: %d' % (k, v))
for (jenis, k), v in sorted(gol.items(), key=lambda kv: (kv[0][0], -kv[1])):
    l, b = contoh[(jenis, k)]
    out.append('%s | %d | %s | contoh: %r -> %r' % (jenis, v, k, l, b))
teks = '\n'.join(out)
print(teks)
if len(sys.argv) > 2:
    open(sys.argv[2], 'w', encoding='utf-8').write(teks + '\n')
