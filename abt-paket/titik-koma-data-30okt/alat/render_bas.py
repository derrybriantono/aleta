# -*- coding: utf-8 -*-
"""(Salinan render_titik.py titik-koma-30okt + kolom ke-4 = urutan sidang untuk BAS.) Render php56 ABT asli blangko Derry untuk perkara contoh, lalu hitung titik koma DI TENGAH butir pada keterangan saksi dan
daftar bukti. Dijalankan dua kali: sesudah PULIH paket (sebelum) dan sesudah PASANG (sesudah) di basis salinan aps_badilag_bas29.
Pohon blangko = dasar4 (sesudah prodeo + bas-tanya-jawab) + rtf-tambal bukti-nomor-30okt (diterapkan di memori).
pakai: python render_titik.py <akar dasar> <tugas.tsv: perkara_id TAB jalur TAB label> <tahap> <keluar.json>"""
import base64, json, os, re, sys
SINI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(SINI, '..', '..', 'bas-tanya-jawab-29okt', 'sumber'))
sys.path.insert(0, os.path.join(SINI, '..', '..', 'bas-tanya-jawab-29okt', 'alat'))
import render_uji as R  # noqa: E402
from rtf2txt import rtf_ke_teks  # noqa: E402

akar, tugas, tahap, kel = sys.argv[1:5]
tb = {}
for l in open(os.path.join(SINI, '..', '..', 'bukti-nomor-30okt', 'paket-satker', 'rtf-tambal.tsv'), encoding='utf-8'):
    if l.strip():
        r, i, j, a, b = l.rstrip('\n').split('\t')
        tb.setdefault(base64.b64decode(r).decode('utf-8'), []).append((base64.b64decode(a), base64.b64decode(b)))
ALNUM = re.compile(r'[0-9A-Za-zÀ-ÿ]')


def tengah(par):
    n = 0
    for m in re.finditer(';', par):
        if re.search(r'&[A-Za-z#0-9]{2,8}$', par[:m.start()]):
            continue
        if ALNUM.search(par[m.end():]):
            n += 1
    return n


hasil = []
for l in open(tugas, encoding='utf-8'):
    if not l.strip() or l.startswith('#'):
        continue
    kol = l.rstrip('\n').split('\t')
    pid, rel, label = kol[:3]
    sid = kol[3] if len(kol) > 3 else ''
    raw = open(R.panjang(os.path.join(akar, rel)), 'rb').read()
    for a, b in tb.get(rel, []):
        raw = raw.replace(a, b)
    out = R.render(raw, pid, sid)
    bs = [re.sub(r'\s+', ' ', x).strip() for x in rtf_ke_teks(out.decode('latin1')).split('\n') if x.strip()]
    open(os.path.join(R.OUT, 'titik_%s_%s_%s.txt' % (pid, re.sub(r'[^A-Za-z0-9]+', '_', rel)[-40:], tahap)), 'w', encoding='utf-8').write('\n'.join(bs))
    saksi = [x for x in bs if x.startswith('- Bahwa') or x.startswith('-   Bahwa')]
    bukti = [x for x in bs if re.match(r'^\d+\.\s*(Fotokopi|Fotocopy|Asli|Kutipan|Print|Surat|Foto)', x)]
    rec = dict(perkara_id=pid, blangko=rel, label=label, tahap=tahap,
               semua_titik_koma_tengah=sum(tengah(x) for x in bs), saksi_butir=len(saksi), saksi_titik_koma_tengah=sum(tengah(x) for x in saksi),
               bukti_butir=len(bukti), bukti_titik_koma_tengah=sum(tengah(x) for x in bukti),
               penanda_sisa=sorted(set(re.findall(r'#\d{4,5}#', '\n'.join(bs)))),
               contoh=[x[:220] for x in saksi + bukti if tengah(x)][:3] if tahap == 'sebelum' else [])
    hasil.append(rec)
    print(json.dumps({k: v for k, v in rec.items() if k != 'contoh'}, ensure_ascii=False))
json.dump(hasil, open(kel, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
