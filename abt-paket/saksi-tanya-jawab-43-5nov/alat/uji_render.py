# -*- coding: utf-8 -*-
"""Uji render ABT asli paket saksi-tanya-jawab-43-5nov: semua berkas paket sebelum/sesudah atas perkara sejenis; beberapa berkas juga atas perkara yang punya data keterangan saksi.
Teks tampak harus sama persis, sisa #NNNN# 0, kurung hasil seimbang. RTF hasil (data perkara) di luar repo; ringkasan tanpa data pihak.
pakai: python -B alat/uji_render.py <akar sebelum> <akar sesudah> <paket-satker> <keluar> <hasil.txt> [pekerja]"""
import concurrent.futures as cf
import importlib.util
import os
import re
import sys

SINI = os.path.dirname(os.path.abspath(__file__))
A5 = os.path.join(SINI, '..', '..', 'a5-merah-5nov')
sys.path.insert(0, os.path.join(A5, 'sumber'))
import rtfmini  # noqa: E402

spec = importlib.util.spec_from_file_location('render_abt', os.path.join(A5, 'alat', 'render_abt.py'))
ra = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ra)
spec = importlib.util.spec_from_file_location('uji_a5', os.path.join(A5, 'alat', 'uji_render.py'))
ua = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ua)
TAMBAH = [('3 ', 10261), ('8 ', 10090), ('10 ', 8781)]
BERDATA = 10200  # perkara cerai gugat di salinan yang punya baris abt_keterangan_saksi


def perkara(rel):
    for a, p in TAMBAH:
        if rel.startswith(a):
            return p
    return ua.perkara(rel)


def seimbang(h):
    d = 0
    i = 0
    while i < len(h):
        if h[i] == 92:
            i += 2
            continue
        d += (h[i] == 123) - (h[i] == 125)
        if d < 0:
            return False
        i += 1
    return d == 0


def kerja(a):
    kode, sumber, pid, keluar, tahap = a
    o = os.path.join(keluar, '%s-%s-%d.rtf' % (kode, tahap, pid))
    if not os.path.exists(o):
        ra.render(sumber, pid, o, '%s%s%d' % (kode, tahap[:3], pid))
    return o


def main():
    sebelum, sesudah, paket, keluar, hasil = sys.argv[1:6]
    n = int(sys.argv[6]) if len(sys.argv) > 6 else 3
    os.makedirs(keluar, exist_ok=True)
    tugas = []
    for l in open(os.path.join(paket, 'daftar-tambal.tsv'), encoding='utf-8'):
        if l.startswith('#') or not l.strip():
            continue
        kode, rel = l.split('\t')[:2]
        rr = rel[len('derry_briantono/'):]
        pp = [perkara(rr)]
        if rr.startswith('1 Perceraian CG/[02] [Kabul] CG - F') or rr.startswith('2 Itsbat Nikah/[01] [Kabul] IN.rtf') or rr.startswith('3 Dispensasi Kawin/[01] [Kabul] DK - (Anak P Cewek)'):
            pp.append(BERDATA)
        tugas.append((kode, rr, pp))
    jobs = []
    for kode, rr, pp in tugas:
        for pid in pp:
            jobs.append((kode, os.path.join(sebelum, 'derry_briantono', rr), pid, keluar, 'sebelum'))
            jobs.append((kode, os.path.join(sesudah, 'derry_briantono', rr), pid, keluar, 'sesudah'))
    with cf.ThreadPoolExecutor(n) as ex:
        list(ex.map(kerja, jobs))
    baris = ['Render ABT asli sebelum dan sesudah paket. Grup isianasal tidak tercetak; teks tampak harus sama. Tanpa data pihak.', 'kode\tperkara\tteks sama\tsisa #NNNN# sesudah\tkurung seimbang\tbita sesudah - sebelum\tberkas']
    gagal = 0
    for kode, rr, pp in tugas:
        for pid in pp:
            b0 = open(os.path.join(keluar, '%s-sebelum-%d.rtf' % (kode, pid)), 'rb').read()
            b1 = open(os.path.join(keluar, '%s-sesudah-%d.rtf' % (kode, pid)), 'rb').read()
            u0, u1 = rtfmini.urai(b0), rtfmini.urai(b1)
            sama = u0['paragraf'] == u1['paragraf'] and u0['merah'] == u1['merah']
            sisa = len(re.findall(rb'#\d{3,5}#', b1))
            ok = seimbang(b1)
            if not sama or sisa or not ok:
                gagal += 1
            baris.append('%s\t%d\t%s\t%d\t%s\t%d\t%s' % (kode, pid, 'ya' if sama else 'TIDAK', sisa, 'ya' if ok else 'TIDAK', len(b1) - len(b0), rr))
    baris.append('GAGAL\t%d' % gagal)
    open(hasil, 'w', encoding='utf-8', newline='\n').write('\n'.join(baris) + '\n')
    print('GAGAL', gagal, 'dirender', len(jobs))


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    main()
