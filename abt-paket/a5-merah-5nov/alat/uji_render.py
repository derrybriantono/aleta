# -*- coding: utf-8 -*-
"""Uji render ABT asli: semua berkas paket, sebelum (pohon dasar) dan sesudah (salinan terpasang), atas perkara sipp_vs yang sejenis.
Keluaran RTF (data perkara) ke folder di luar repo; ringkasan tanpa data pihak ke hasil/render-banding.txt.
pakai: python -B alat/uji_render.py <akar dasar> <akar sesudah> <paket-satker> <keluar rtf> <hasil txt> [pekerja]"""
import concurrent.futures as cf
import difflib
import os
import re
import sys

SINI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, SINI)
sys.path.insert(0, os.path.join(SINI, '..', 'sumber'))
import merahpos as mp  # noqa: E402
from render_abt import render  # noqa: E402

PETA = [  # awalan folder -> perkara sipp_vs sejenis (BAS/ jenis tanpa perkara di salinan memakai perkara cerai verstek, dicatat "pengganti")
    ('1 Perceraian CG - BAS', 10177), ('1 Perceraian CG', 10126), ('1a Perceraian CT - BAS', 10137), ('1a Perceraian CT', 10139),
    ('1c Perceraian Kumulasi Itsbat Nikah/[02] [Kabul] Putusan CT', 10139), ('1c Perceraian Kumulasi Itsbat Nikah/[98b] [Cabut] Putusan CT', 10139),
    ('1c Perceraian Kumulasi Itsbat Nikah/[99b] [NO] Putusan CT', 10139), ('1c', 10126), ('1d', 10126), ('1e', 10177), ('1f', 10177),
    ('2a', 10276), ('2 Itsbat', 10276), ('4a Harta Bersama', 10025), ('4b', 10225), ('4c', 9291), ('4d', 10177), ('4e', 10177), ('5 Izin', 8785),
    ('5a', 2306), ('5b', 5061), ('6 Perwalian', 10096), ('6', 10177), ('9 Penetapan', 10178), ('9a', 9024), ('9b', 9024), ('10a', 8781), ('ALUR 09', 10177),
]
RE_VAR = re.compile(r'#\d{3,5}#')
KATA = re.compile(r'\S+')


def perkara(rel):
    for a, p in PETA:
        if rel.startswith(a):
            return p
    raise SystemExit('tanpa perkara: ' + rel)


def teks(p):
    d = mp.peta(open(p, 'rb').read())
    return '\n'.join(d['para'][k] for k in sorted(d['para'])), sum(1 for t in d['toks'] if t['merah'])


def kerja(a):
    kode, rel, dasar, sesudah, keluar = a
    pid = perkara(rel)
    o0 = os.path.join(keluar, kode + '-sebelum.rtf')
    o1 = os.path.join(keluar, kode + '-sesudah.rtf')
    i0, d0 = ('sudah', 0) if os.path.exists(o0) else render(dasar, pid, o0, kode + 'a')
    i1, d1 = ('sudah', 0) if os.path.exists(o1) else render(sesudah, pid, o1, kode + 'b')
    if not (os.path.exists(o0) and os.path.exists(o1)):
        return kode, rel, pid, 'GAGAL %s %s' % (i0, i1), [], 0, 0, 0, 0, 0, 0, d0 + d1
    t0, m0 = teks(o0)
    t1, m1 = teks(o1)
    w0, w1 = KATA.findall(t0), KATA.findall(t1)
    beda = []
    for tag, a1, a2, b1, b2 in difflib.SequenceMatcher(None, w0, w1, autojunk=False).get_opcodes():
        if tag != 'equal':
            beda.append((' '.join(w0[a1:a2]), ' '.join(w1[b1:b2])))
    return (kode, rel, pid, 'OK', beda, len(RE_VAR.findall(t0)), len(RE_VAR.findall(t1)), t0.count('...'), t1.count('...'), m0, m1, d0 + d1)


def main():
    dasar, sesudah, paket, keluar, hasil = sys.argv[1:6]
    n = int(sys.argv[6]) if len(sys.argv) > 6 else 3
    os.makedirs(keluar, exist_ok=True)
    tugas = []
    for l in open(os.path.join(paket, 'daftar-tambal.tsv'), encoding='utf-8'):
        if l.startswith('#') or not l.strip():
            continue
        kode, rel = l.split('\t')[:2]
        rr = rel[len('derry_briantono/'):]
        tugas.append((kode, rr, os.path.join(dasar, rel), os.path.join(sesudah, rel), keluar))
    hs = []
    with cf.ThreadPoolExecutor(n) as ex:
        for r in ex.map(kerja, tugas):
            hs.append(r)
            print(r[0], r[3][:60], r[11], flush=True)
    with open(hasil, 'w', encoding='utf-8', newline='\n') as f:
        f.write('Render ABT asli (salinan vs30/abt, sipp_vs + aps_badilag_vs yang disamakan variabel/fungsinya) sebelum/sesudah. Isian baru belum diisi = "..." bawaan ABT.\n')
        f.write('kode\tperkara\tsisa#NNNN# sebelum\tsisa#NNNN# sesudah\t"..." sebelum\t"..." sesudah\tmerah sebelum\tmerah sesudah\tbeda kata\tberkas\n')
        for r in hs:
            kode, rel, pid, st, beda, v0, v1, t0, t1, m0, m1, _ = r
            f.write('%s\t%d\t%d\t%d\t%d\t%d\t%d\t%d\t%d\t%s%s\n' % (kode, pid, v0, v1, t0, t1, m0, m1, len(beda), rel, '' if st == 'OK' else ' ' + st))
        f.write('\nRincian beda kata (sebelum => sesudah), per berkas:\n')
        for r in hs:
            if r[4]:
                f.write('%s %s\n' % (r[0], r[1]))
                for x, y in r[4]:
                    f.write('   %s  =>  %s\n' % (x[:160], y[:160]))
    print('selesai', len(hs))


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    main()
