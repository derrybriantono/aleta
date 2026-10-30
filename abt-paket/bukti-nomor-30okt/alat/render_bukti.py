# -*- coding: utf-8 -*-
"""Render php56 ABT asli SEBELUM/SESUDAH paket bukti-nomor untuk blangko + perkara contoh, lalu cetak daftar bukti surat.
Sebelum = pohon dasar (sesudah bas-tanya-jawab); sesudah = dasar + rtf-tambal paket ini (diterapkan di memori).
Basis render: salinan aps_badilag_bas29 (variabel 11170-11177 + fungsi terpasang dengan nama basis salinan).
pakai: python render_bukti.py <akar dasar> <folder paket-satker> <tugas.tsv: perkara_id TAB jalur TAB label> <keluar.json>"""
import base64, json, os, re, sys
SINI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(SINI, '..', '..', 'bas-tanya-jawab-29okt', 'sumber'))
sys.path.insert(0, os.path.join(SINI, '..', '..', 'bas-tanya-jawab-29okt', 'alat'))
import render_uji as R  # noqa: E402
from rtf2txt import rtf_ke_teks  # noqa: E402

akar, pk, tugas, kel = sys.argv[1:5]
tb = {}
for l in open(os.path.join(pk, 'rtf-tambal.tsv'), encoding='utf-8'):
    if l.strip():
        r, i, j, a, b = l.rstrip('\n').split('\t')
        tb.setdefault(base64.b64decode(r).decode('utf-8'), []).append((base64.b64decode(a), base64.b64decode(b)))
hasil = []
for l in open(tugas, encoding='utf-8'):
    if not l.strip() or l.startswith('#'):
        continue
    pid, rel, label = l.rstrip('\n').split('\t')[:3]
    lama = open(R.panjang(os.path.join(akar, rel)), 'rb').read()
    baru = lama
    for a, b in tb.get(rel, []):
        baru = baru.replace(a, b)
    rec = dict(perkara_id=pid, blangko=rel, label=label)
    for tahap, raw in (('sebelum', lama), ('sesudah', baru)):
        out = R.render(raw, pid, '')
        bs = [re.sub(r'\s+', ' ', x).strip() for x in rtf_ke_teks(out.decode('latin1')).split('\n') if x.strip()]
        open(os.path.join(R.OUT, 'bukti_%s_%s_%s.txt' % (pid, re.sub(r'[^A-Za-z0-9]+', '_', rel)[-50:], tahap)), 'w', encoding='utf-8').write('\n'.join(bs))
        fot = [x for x in bs if re.search(r'(Fotokopi|Fotocopy|Asli Surat|Kutipan)', x)][:8]
        rec[tahap] = dict(penanda_sisa=sorted(set(re.findall(r'#\d{4,5}#', '\n'.join(bs)))), bukti=[re.sub(r'NIK \d+', 'NIK [..]', re.sub(r'atas nama [^,]+', 'atas nama [..]', x))[:70] for x in fot],
                          nomor_ganda=sum(1 for x in fot if re.match(r'^\d+\.\s*\d+[.)]', x)), tanpa_nomor=sum(1 for x in fot if not re.match(r'^\d+\.', x)))
    hasil.append(rec)
    print(pid, label, json.dumps({k: {kk: vv for kk, vv in rec[k].items() if kk != 'bukti'} for k in ('sebelum', 'sesudah')}, ensure_ascii=False))
    for k in ('sebelum', 'sesudah'):
        for x in rec[k]['bukti'][:4]:
            print('   ', k, '|', x)
json.dump(hasil, open(kel, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
