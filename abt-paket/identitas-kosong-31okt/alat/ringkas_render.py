# -*- coding: utf-8 -*-
"""Ringkas render ABT asli sebelum/sesudah paket identitas-kosong TANPA data pribadi: potongan mulai label "NIK"/"umur" (nama pihak
dibuang), dan penilaian apakah tiap baris yang berbeda = baris lama yang dirapikan fungsi paket (urutan REPLACE dari sumber/fungsi.sql).
pakai: python ringkas_render.py <tugas.tsv> <dir sebelum> <dir sesudah> <keluar.json>"""
import json, os, re, sys

SINI = os.path.dirname(os.path.abspath(__file__))
src = open(os.path.join(SINI, '..', 'sumber', 'fungsi.sql'), encoding='utf-8').read()
LANGKAH = [(a.replace("''", "'"), b.replace("''", "'")) for a, b in re.findall(r"SET s = REPLACE\(s, '((?:[^']|'')*)', '((?:[^']|'')*)'\);", src)]
POLA = re.compile(r'NIK ,|00 0000|agama ,|pekerjaan ,|pendidikan ,|, , |umur tahun')


def rapi(t):
    for a, b in LANGKAH:
        t = t.replace(a, b)
    return t


tugas = [l.rstrip('\n').split('\t') for l in open(sys.argv[1], encoding='utf-8') if l.strip()]
A, B = sys.argv[2], sys.argv[3]
out = []
for pid, rtf, label in tugas:
    f = '%s_%s.txt' % (pid, label)
    s = open(os.path.join(A, f), encoding='utf-8').read().split('\n')
    d = open(os.path.join(B, f), encoding='utf-8').read().split('\n')
    sama_baris = len(s) == len(d)
    beda = [(x, y) for x, y in zip(s, d) if x != y] if sama_baris else []
    # baris ABT: spasi sudah diringkas render.py, jadi bandingkan dengan rapi() atas spasi yang diringkas juga
    cocok = sama_baris and all(re.sub(r' +', ' ', rapi(x)) == y or rapi(re.sub(r' +', ' ', x)) == y for x, y in beda)
    contoh = next((x for x in s if POLA.search(x)), '')
    contoh2 = d[s.index(contoh)] if contoh and sama_baris else ''
    potong = lambda t: (t[t.find('NIK'):] if 'NIK' in t else t[t.find('umur'):] if 'umur' in t else '').split('tempat kediaman')[0][:170]   # alamat tidak ikut
    out.append(dict(perkara=pid, blangko=label, berkas=os.path.basename(rtf), baris_beda=len(beda), sama_selain=cocok,
                    sebelum=potong(contoh), sesudah=potong(contoh2), cacat_sebelum=sum(1 for x in s if POLA.search(x)),
                    cacat_sesudah=sum(1 for x in d if POLA.search(x))))
    print(pid, label, 'baris beda', len(beda), 'hanya dirapikan', cocok, out[-1]['cacat_sebelum'], '->', out[-1]['cacat_sesudah'])
json.dump(out, open(sys.argv[4], 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
