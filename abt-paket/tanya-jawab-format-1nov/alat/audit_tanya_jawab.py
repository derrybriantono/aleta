# -*- coding: utf-8 -*-
"""Audit tahap 1: golongkan SEMUA blangko Derry yang memuat tanya jawab (tanpa folder terhapus).
pakai: python audit_tanya_jawab.py <akar _blangko_abt sesudah 28 paket> <keluar audit.md>
Golongan: BENAR = tanya jawab hanya dari variabel ABT (tanyajawab 5058,5059,5060,6120,6121,6122,6124,8921,8931,8941,6112-6114);
SALAH BENTUK = ada tabel tertulis tangan (Q/A) - dirinci cacatnya; CAMPURAN = keduanya."""
import collections
import os
import re
import sys

SINI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(SINI, '..', 'sumber'))
import tjformat as T  # noqa: E402

BS = chr(92)
TJ = ['5058', '5059', '5060', '6124', '8931', '6120', '6121', '6122', '8921', '8941', '6112', '6113', '6114']
POLA_TJ = re.compile('#(' + '|'.join(TJ) + ')#')
ARSIP = ('ALUR', '- BAS', 'BAS ')


def main():
    akar = os.path.join(sys.argv[1], 'derry_briantono')
    c = collections.Counter()
    cacat = collections.Counter()
    folder = collections.Counter()
    for dp, dn, fn in os.walk(akar):
        dn.sort()
        for f in sorted(fn):
            if not f.lower().endswith('.rtf'):
                continue
            rel = os.path.relpath(os.path.join(dp, f), akar).replace(BS, '/')
            if rel.startswith('terhapus/'):
                continue
            kel = 'arsip' if rel.startswith(ARSIP) else 'aktif'
            raw = open(os.path.join(dp, f), 'rb').read().decode('latin1')
            ada_var = bool(POLA_TJ.search(raw))
            regs = T.region_qa(raw) if BS + 'trowd' in raw else []
            if not ada_var and not regs:
                continue
            golongan = 'CAMPURAN (variabel + tabel tangan)' if (ada_var and regs) else ('BENAR (variabel ABT)' if ada_var else 'SALAH (tabel tangan saja)')
            c[(kel, golongan)] += 1
            if regs:
                folder[(kel, rel.split('/')[0])] += 1
            for rows, bentuk in regs:
                teks = raw[rows[0]['start']:rows[-1]['end']]
                cacat[(kel, 'tabel tertulis tangan')] += 1
                cacat[(kel, 'jawaban TANPA "- "')] += 1
                lebar = set(tuple(b['lebar']) for b in rows)
                if lebar != {(4250, 8500)}:
                    cacat[(kel, 'lebar kolom bukan 4250/8500 (tak seragam: %s)' % ', '.join('%d/%d' % x for x in sorted(lebar)[:3])) if False else (kel, 'lebar kolom tak seragam / bukan 4250-8500')] += 1
                if len(lebar) > 1:
                    cacat[(kel, 'lebar kolom BERBEDA antar baris dalam satu tabel')] += 1
                if re.search(r'\\(?:trbrdr[tblrhv]|clbrdr[tblr])\s*\\brdr(?!none)', teks):
                    cacat[(kel, 'tabel BERGARIS')] += 1
                if re.search(r'\\(?:li|lin|ri|rin)-\d+', teks):
                    cacat[(kel, 'sel berindentasi negatif (teks menjorok keluar kolom)')] += 1
                if bentuk.count('B'):
                    cacat[(kel, 'pertanyaan dan jawaban dalam SATU baris (kolom bersebelahan)')] += 1
                kosong = False
                for bar in rows:
                    for sel in bar['cells']:
                        bagian = [x for x in re.split(r'(?=\\pard(?![a-zA-Z]))', sel) if x.strip()]
                        isi = [T.teks(x) for x in bagian]
                        if len(bagian) > 1 and any(t == '' for t in isi[:-1]):
                            kosong = True
                if kosong:
                    cacat[(kel, 'paragraf kosong (baris kosong) di dalam sel')] += 1
    out = ['# Audit tanya jawab blangko Derry (tahap 1) - keadaan sesudah 28 paket\n',
           '| golongan | aktif | arsip |', '|---|---|---|']
    for g in ['BENAR (variabel ABT)', 'SALAH (tabel tangan saja)', 'CAMPURAN (variabel + tabel tangan)']:
        out.append('| %s | %d | %d |' % (g, c[('aktif', g)], c[('arsip', g)]))
    out.append('| JUMLAH | %d | %d |' % (sum(v for (k, g), v in c.items() if k == 'aktif'), sum(v for (k, g), v in c.items() if k == 'arsip')))
    out.append('\n## Cacat tabel tertulis tangan (jumlah TABEL)\n| cacat | aktif | arsip |\n|---|---|---|')
    for k in sorted({x[1] for x in cacat}):
        out.append('| %s | %d | %d |' % (k, cacat[('aktif', k)], cacat[('arsip', k)]))
    out.append('\n## Berkas bertabel tangan per folder (aktif)\n| folder | berkas |\n|---|---|')
    for (kel, fol), n in sorted(folder.items(), key=lambda kv: -kv[1]):
        if kel == 'aktif':
            out.append('| %s | %d |' % (fol, n))
    open(sys.argv[2], 'w', encoding='utf-8', newline='\n').write('\n'.join(out) + '\n')
    print('\n'.join(out[:14]))


if __name__ == '__main__':
    main()
