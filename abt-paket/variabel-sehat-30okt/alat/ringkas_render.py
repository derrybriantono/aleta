# -*- coding: utf-8 -*-
"""Ringkas render ABT asli sebelum/sesudah paket (alat/render.py blangko) TANPA data pribadi: hanya potongan kalimat di sekitar bagian
yang diperbaiki (alamat dipotong mulai "Provinsi", email disamarkan), dan penilaian apakah SELURUH beda naskah hanya di bagian itu.
pakai: python ringkas_render.py <tugas.tsv> <dir sebelum> <dir sesudah> <keluar.json>"""
import difflib, json, os, re, sys

tugas = [l.rstrip('\n').split('\t') for l in open(sys.argv[1], encoding='utf-8') if l.strip()]
A, B, kel = sys.argv[2], sys.argv[3], sys.argv[4]
EMAIL = re.compile(r'[\w.+-]+@[\w-]+(\.[\w-]+)+')
# beda yang DIMAKSUD paket: isian Tgl Nikah (awalan "pada ", tanda baca ujung) dan letak kode pos terhadap domisili elektronik
BOLEH = [
    lambda a, b: b == '' and re.fullmatch(r'\s*(\t ?)?pada\s*|[;,.]\s*', a) is not None,
    lambda a, b: a == '' and re.fullmatch(r',? ?Kode Pos \d{5}\.? ?', b) is not None,
    lambda a, b: b == '' and re.fullmatch(r',? ?Kode Pos \d{5}\.? ?', a) is not None,
    lambda a, b: {a.strip(' ,.'), b.strip(' ,.')} <= {'', 'Domisili'},
    lambda a, b: a.strip() == '' and b.strip() == '',
]
NL = chr(10)
out = []
for pid, rtf, label in tugas[:]:
    f = '%s_%s.txt' % (pid, label)
    s = open(os.path.join(A, f), encoding='utf-8').read()
    d = open(os.path.join(B, f), encoding='utf-8').read()
    beda = []
    ls, ld = s.split(NL), d.split(NL)
    for op, i1, i2, j1, j2 in difflib.SequenceMatcher(None, ls, ld, autojunk=False).get_opcodes():   # baris dulu, lalu huruf
        if op == 'equal':
            continue
        x, y = NL.join(ls[i1:i2]), NL.join(ld[j1:j2])
        sm = difflib.SequenceMatcher(None, x, y, autojunk=False)
        beda += [(x[a1:a2], y[b1:b2]) for o, a1, a2, b1, b2 in sm.get_opcodes() if o != 'equal']
    sama_selain = all(any(ok(x, y) for ok in BOLEH) for x, y in beda)

    def potong(t):
        if label.startswith('IN'):
            m = re.search(r'(dilaksanakan|terjadi) [^.]{0,40}? pada [^.]{0,60}?\.( Jika)?', t) or re.search(r'terjadi pada .{0,60}', t)
            return m.group(0) if m else ''
        m = re.search(r'Provinsi[^\n]*Kode Pos[^\n]*', t) or re.search(r'Provinsi[^\n]*', t)
        return EMAIL.sub('<email>', m.group(0)) if m else ''
    item = dict(perkara=pid, blangko=label, berkas=os.path.basename(rtf), beda=len(beda), sama_selain=sama_selain,
                sebelum=potong(s), sesudah=potong(d), beda_contoh=[[EMAIL.sub('<email>', x)[:40], EMAIL.sub('<email>', y)[:40]] for x, y in beda[:4]])
    # 4303: kalimat yang memuat cacat sebelum paket
    if label.startswith('IN'):
        cacat = re.search(r'(terjadi|dilaksanakan) pada (pada |[^.]{0,30}; \.)[^.]{0,40}', s)
        item['sebelum'] = cacat.group(0) if cacat else item['sebelum']
        bersih = re.search(r'(terjadi|dilaksanakan) pada [^.]{0,60}\. Jika', d)
        item['sesudah'] = bersih.group(0) if bersih else item['sesudah']
    out.append(item)
    print(pid, label, 'beda', len(beda), 'hanya bagian dimaksud', sama_selain)
json.dump(out, open(kel, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
