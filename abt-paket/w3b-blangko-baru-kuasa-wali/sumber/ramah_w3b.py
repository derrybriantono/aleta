# -*- coding: utf-8 -*-
"""Label pengguna (RAMAH), pilihan huruf, penanda "diisi manual" dan "opsional" untuk isian milik paket W3b, diturunkan dari NAMA variabel
(awalan "JENIS:" dibuang, akhiran "- ISIAN ..." / "- PILIH HURUF ..." dipotong), dengan penimpaan tangan di META.
Dibaca bangkitkan_ts.py -> manajemen_surat/src/app/api/aleta-ecourt/blangko-derry/ramah-w3b.ts"""
import re

import variabel_def as V

# penimpaan tangan: no -> dict(nm=, pil=[...], saran=, manual="alasan", opsional="label")
META = {}

HURUF = re.compile(r'(?:PILIH HURUF|ISIAN HURUF|HURUF)\s*:?\s*(.*)$', re.S)


def label_dari_nama(nama):
    t = re.sub(r'^[A-Z][A-Z0-9 /().,&-]*?:\s+', '', nama, count=1)
    t = re.split(r'\s+-\s+(?:ISIAN|PILIH|HURUF|OTOMATIS)', t)[0]
    t = re.split(r'\s+\(', t)[0] if len(t) > 80 else t
    t = re.sub(r'\s+\([^)]*\)\s*$', '', t)
    t = t.replace('#0046#', '').replace('#0047#', '').replace('#0053#', 'gugatan/permohonan').strip(' -:;,')
    letters = [c for c in t if c.isalpha()]
    if letters and sum(1 for c in letters if c.isupper()) / len(letters) > 0.7:
        t = t[:1] + t[1:].lower()
    return t.replace('', '{P}').replace('', '{T}')


def pilihan_dari_nama(nama):
    """["A · uraian", ...] bila nama memuat daftar huruf TUNGGAL; None bila boleh lebih dari satu huruf atau tidak ada daftar."""
    if re.search(r'boleh|bisa lebih|lebih dari satu|keduanya|beberapa', nama, re.I):
        return None
    m = HURUF.search(nama)
    if not m:
        return None
    sisa = re.split(r'\s+\(|;\s+kosong|\s+-\s+', m.group(1))[0]
    butir = re.findall(r'(?:^|,\s*)([A-H])\s+([^,]+?)(?=,\s*[A-H]\s|$)', sisa.strip())
    if len(butir) < 2:
        return None
    return ['%s · %s' % (h, u.strip().rstrip(',;').replace('#0046#', '{P}').replace('#0047#', '{T}')) for h, u in butir]


def bangun():
    ramah, manual, opsional = {}, {}, {}
    for x in V.VAR:
        if x['tipe'] not in ('data_teks', 'data_tanggal'):
            continue
        k = '%04d' % x['no']
        meta = META.get(x['no'], {})
        entri = {'nm': meta.get('nm') or label_dari_nama(x['nama'])}
        pil = meta.get('pil') or pilihan_dari_nama(x['nama'])
        if pil:
            entri['pil'] = pil
        if meta.get('saran'):
            entri['saran'] = meta['saran']
        ramah[k] = entri
        if re.search(r'ISIAN OPSIONAL|OPSIONAL', x['nama']) or meta.get('opsional'):
            opsional[k] = meta.get('opsional') or entri['nm']
        if meta.get('manual'):
            manual[k] = meta['manual']
    return ramah, manual, opsional


if __name__ == '__main__':
    import sys
    sys.stdout.reconfigure(encoding='utf-8')
    r, m, o = bangun()
    for k, e in r.items():
        print(k, '|', e['nm'], '|', e.get('pil', ''), '| OPS' if k in o else '')
