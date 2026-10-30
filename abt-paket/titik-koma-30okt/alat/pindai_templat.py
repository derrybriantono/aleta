# -*- coding: utf-8 -*-
"""Pindai teks blangko Derry (RTF -> teks) untuk titik koma DI TENGAH kalimat yang berasal dari TEKS BLANGKO sendiri atau dari
sambungan penanda (#NNNN#;) - untuk mengetahui sumber ";" di tengah sebelum memperbaiki perangkai.
pakai: python pindai_templat.py <akar pohon> <keluar.tsv>
Kolom keluar: jenis TAB berkas TAB potongan."""
import collections, os, re, sys
SINI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(SINI, '..', '..', 'bas-tanya-jawab-29okt', 'sumber'))
from rtf2txt import rtf_ke_teks  # noqa: E402

akar, kel = sys.argv[1:3]
hit = collections.Counter()
berkas_kena = collections.defaultdict(set)
baris = []
for d, _, fs in os.walk(akar):
    for f in fs:
        if not f.lower().endswith('.rtf'):
            continue
        p = os.path.join(d, f)
        rel = os.path.relpath(p, akar).replace(os.sep, '/')
        atas = rel.split('/')[1] if rel.startswith('derry_briantono/') and rel.count('/') > 1 else rel.split('/')[0]
        if 'terhapus' in rel.lower() or re.match(r'(ALUR|- BAS .* -$)', atas):
            continue
        raw = open('\\\\?\\' + os.path.abspath(p), 'rb').read().decode('latin1')
        teks = rtf_ke_teks(raw)
        for par in teks.split('\n'):
            par = re.sub(r'\s+', ' ', par).strip()
            if ';' not in par:
                continue
            for m in re.finditer(r';', par):
                sesudah = par[m.end():]
                sebelum = par[:m.start()]
                if not re.search(r'[A-Za-z0-9#]', sesudah):
                    continue  # titik koma di ujung paragraf
                if re.search(r'&[A-Za-z#0-9]{2,8}$', sebelum):
                    continue
                kiri = sebelum[-1:] if sebelum else ''
                if re.search(r'#\d{4,5}#$', sebelum):
                    j = 'penanda lalu ; di tengah'
                elif kiri in ';,.: ':
                    j = 'tanda baca ganda / spasi sebelum ;'
                else:
                    j = 'teks blangko: ; di tengah'
                hit[j] += 1
                berkas_kena[j].add(rel)
                baris.append((j, rel, (sebelum[-50:] + ' [;] ' + sesudah[:40])))
with open(kel, 'w', encoding='utf-8') as o:
    for b in baris:
        o.write('\t'.join(b) + '\n')
for j, n in hit.most_common():
    print(n, j, 'berkas', len(berkas_kena[j]))
