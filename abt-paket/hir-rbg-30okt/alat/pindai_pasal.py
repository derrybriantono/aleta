# -*- coding: utf-8 -*-
"""Pindai SEMUA rujukan pasal hukum acara (RBg, HIR, Rv, Stbl) di blangko RTF dan variabel ABT.

pakai: python pindai_pasal.py <akar pohon (berisi derry_briantono/)> <variabel.tsv> <keluar-dir>
  variabel.tsv: no_var TAB HEX(nama) TAB HEX(sql_query) TAB HEX(default_data)   (dari mysql -N, basis sesudah semua paket)
Keluar: rujukan.tsv (satu baris per kemunculan), ringkas.txt (per pasal: jumlah, berkas/variabel, konteks contoh).
Arsip (folder 'terhapus', 'ALUR*', '- BAS * -') dicatat terpisah (kolom aktif=0) dan TIDAK dihitung di ringkasan utama.
"""
import collections
import os
import re
import sys

SINI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(SINI, '..', '..', 'bas-tanya-jawab-29okt', 'sumber'))
from rtf2txt import rtf_ke_teks  # noqa: E402

KODE = r'(?:R\.\s?Bg\.?|RBg|RBG|Rbg|H\.\s?I\.\s?R\.?|HIR|Rv\.?|RV|R\.v\.|Reglement op de Burgerlijke Rechtsvordering|Rechtsreglement Buitengewesten|Herzien Inlandsch Reglement)'
RE_KODE = re.compile(r'(?<![A-Za-z])' + KODE + r'(?![A-Za-z])')
RE_PASAL = re.compile(r'(?i)\bpasal\b')
NORMAL = {'r.bg': 'RBg', 'rbg': 'RBg', 'h.i.r': 'HIR', 'hir': 'HIR', 'rv': 'Rv', 'r.v': 'Rv'}


def normal_kode(k):
    s = re.sub(r'[\s.]', '', k).lower()
    if 'rechtsvordering' in s or s in ('rv',):
        return 'Rv'
    if 'buitengewesten' in s or s == 'rbg':
        return 'RBg'
    if 'herzien' in s or s == 'hir':
        return 'HIR'
    return k


def rujukan_dalam(teks):
    """Hasil: (kode, potongan 'Pasal ... KODE', konteks)."""
    out = []
    for m in RE_KODE.finditer(teks):
        kode = normal_kode(m.group(0))
        kiri = teks[max(0, m.start() - 220):m.start()]
        # 'Pasal' terdekat ke kiri yang tidak terputus titik akhir kalimat / titik koma / baris baru
        ps = list(RE_PASAL.finditer(kiri))
        span = None
        for p in reversed(ps):
            seg = kiri[p.start():]
            if re.search(r'[\n;]|\.\s+[A-Z]|Menimbang|Mengingat', seg):
                continue
            span = seg + m.group(0)
            break
        konteks = teks[max(0, m.start() - 110):m.end() + 60].replace('\n', ' ')
        out.append((kode, re.sub(r'\s+', ' ', span).strip() if span else '', re.sub(r'\s+', ' ', konteks)))
    return out


def pasal_dari(span):
    """'Pasal 145 dan 146 ayat (1) RBg' -> ['145', '146']. Angka di dalam kurung (ayat) dan sesudah 'ayat'/'huruf' dibuang."""
    s = re.sub(r'\(\s*\d+\s*\)', ' ', span)
    s = re.sub(r'(?i)\b(ayat|huruf|angka|butir|ke)\s+[0-9a-z]+', ' ', s)
    s = re.sub(r'(?i)(staatsblad|stbl\.?|stb\.?|nomor|no\.?|tahun)\s*\d+', ' ', s)
    return re.findall(r'(?<![\d#])(\d{1,3}[a-z]?)(?![\d#])', s)


def aktif(rel):
    bag = rel.split('/')
    atas = bag[1] if bag[0] == 'derry_briantono' and len(bag) > 2 else bag[0]
    return not ('terhapus' in rel.lower() or re.match(r'(ALUR|- BAS .* -$)', atas))


def main():
    akar, vtsv, kel = sys.argv[1:4]
    os.makedirs(kel, exist_ok=True)
    baris = []
    for d, _, fs in os.walk(akar):
        for f in fs:
            if not f.lower().endswith('.rtf'):
                continue
            p = os.path.join(d, f)
            rel = os.path.relpath(p, akar).replace(os.sep, '/')
            raw = open('\\\\?\\' + os.path.abspath(p), 'rb').read().decode('latin1')
            teks = rtf_ke_teks(raw)
            for kode, span, ktx in rujukan_dalam(teks):
                baris.append(('rtf', rel, '1' if aktif(rel) else '0', kode, span, ','.join(pasal_dari(span)), ktx))
    for l in open(vtsv, encoding='latin1'):
        c = l.rstrip('\r\n').split('\t')
        if len(c) < 4:
            continue
        no = c[0]
        for kol, hx in (('nama', c[1]), ('sql_query', c[2]), ('default_data', c[3])):
            if not hx or hx == 'NULL':
                continue
            t = bytes.fromhex(hx).decode('latin1')
            for kode, span, ktx in rujukan_dalam(t):
                baris.append(('var', '#%s# %s' % (no, kol), '1', kode, span, ','.join(pasal_dari(span)), ktx))
    with open(os.path.join(kel, 'rujukan.tsv'), 'w', encoding='utf-8') as o:
        o.write('sumber\ttempat\taktif\tkode\trujukan\tpasal\tkonteks\n')
        for b in baris:
            o.write('\t'.join(x.replace('\t', ' ') for x in b) + '\n')
    # ringkas per (kode, pasal)
    per = collections.defaultdict(lambda: {'n': 0, 'rtf': set(), 'var': set(), 'contoh': collections.Counter()})
    tanpa = collections.Counter()
    for sb, tp, ak, kode, span, ps, ktx in baris:
        if ak != '1':
            continue
        if not ps:
            tanpa[(kode, ktx[60:200])] += 1
            continue
        for p in ps.split(','):
            e = per[(kode, p)]
            e['n'] += 1
            (e['rtf'] if sb == 'rtf' else e['var']).add(tp)
            e['contoh'][span] += 1

    def kunci(x):
        k, p = x
        return (k, int(re.match(r'\d+', p).group(0)), p)

    with open(os.path.join(kel, 'ringkas.txt'), 'w', encoding='utf-8') as o:
        o.write('Rujukan pasal hukum acara di blangko AKTIF + variabel (arsip dilewati). kode|pasal|kemunculan|berkas RTF|variabel|bentuk tersering\n')
        for k in sorted(per, key=kunci):
            e = per[k]
            o.write('%s\t%s\t%d\t%d\t%d\t%s\n' % (k[0], k[1], e['n'], len(e['rtf']), len(e['var']),
                                                  ' || '.join('%s (%d)' % (s, n) for s, n in e['contoh'].most_common(4))))
        o.write('\nTANPA NOMOR PASAL TERBACA (kode berdiri sendiri, mis. "menurut RBg"):\n')
        for (k, t), n in tanpa.most_common(60):
            o.write('%s\t%d\t%s\n' % (k, n, t))
    print('kemunculan', len(baris), 'aktif', sum(1 for b in baris if b[2] == '1'), 'pasal unik', len(per))


if __name__ == '__main__':
    main()
