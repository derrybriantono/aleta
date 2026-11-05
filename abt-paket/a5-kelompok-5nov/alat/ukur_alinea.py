# -*- coding: utf-8 -*-
"""Ukur cara menghilangkan kalimat pilihan tanpa alinea kosong, di Word, atas blangko CG [02] butir "d) Bahwa keluarga ...".
Bentuk: pakai (kalimat tercetak) | kosong (penanda isian kosong di alinea sendiri) | v1 (teks tersembunyi \\v1) | lewat (grup \\nonshppict).
Diukur dari baris kosong sesudah butir c) pada PDF Word (pdftotext -layout). Keluaran: hasil/ukur-alinea.txt.
pakai: python -B alat/ukur_alinea.py <berkas sesudah paket> <folder kerja di luar repo> <hasil.txt>"""
import os
import re
import subprocess
import sys

SINI = os.path.dirname(os.path.abspath(__file__))
BS = chr(92)
K = '#12161#'


def main():
    sumber, kerja, hasil = sys.argv[1:4]
    os.makedirs(kerja, exist_ok=True)
    b = open(sumber, 'rb').read().decode('latin1')
    if K not in b:
        raise SystemExit('penanda tidak ada')
    i = b.index('{' + K)
    pol = 'Bahwa keluarga sudah merukunkan'
    j = b.index(pol, i)
    z = b.index(BS + 'par', j)
    akhir = b.rfind('}{', j, z)
    v = {
        'pakai': b.replace(K, ''),
        'kosong': (b[:j] + b[akhir:]).replace(K, ''),
        'v1': b.replace(K, BS + 'v1'),
        'lewat': b.replace(K, BS + 'nonshppict'),
    }
    daftar = []
    for n, s in v.items():
        s = re.sub(r'#\d{3,5}#', 'ISI', s)
        p = os.path.join(kerja, 'alinea-%s.rtf' % n).replace('/', BS)
        open(p, 'wb').write(s.encode('latin1'))
        daftar.append(p)
    d = os.path.join(kerja, 'daftar.txt')
    open(d, 'w', encoding='utf-8-sig', newline='\r\n').write('\n'.join(daftar) + '\n')
    ps = os.path.join(SINI, '..', '..', 'keputusan-a-mekanis-4nov', 'alat', 'rtf_pdf_daftar.ps1')
    r = subprocess.run(['powershell', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', ps, '-Daftar', d], capture_output=True)
    hal = dict((l.split('\t')[2].strip(), l.split('\t')[1]) for l in r.stdout.decode('cp1252', 'replace').splitlines() if l.startswith('PDF'))
    out = ['Bentuk\thalaman Word\tkata merukunkan (3 = butir d merah tidak tercetak, 4 = tercetak)\tsesudah akhir butir c) pada PDF Word (pdftotext -layout)']
    for p in daftar:
        pdf = p[:-4] + '.pdf'
        tx = subprocess.run(['pdftotext', '-layout', pdf, '-'], capture_output=True).stdout.decode('utf-8', 'replace')
        ada = 'merukunkan' in tx
        bar = tx.replace('\f', '\n').split('\n')
        # butir merah = kemunculan terakhir; tiga kemunculan lain adalah teks hitam yang tidak disentuh
        i = [n for n, x in enumerate(bar) if 'c)' in x and 'Bahwa selama berpisah' in x][-1]
        while 'lagi;' not in bar[i]:
            i += 1
        j = i + 1
        while not bar[j].strip():
            j += 1
        seb = bar[j].strip()[:24]
        out.append('%s\t%s\t%s\tbaris kosong %d, baris berikutnya: %s' % (os.path.basename(p)[7:-4], hal.get(pdf, '?'), tx.count('merukunkan'), j - i - 1, seb))
    open(hasil, 'w', encoding='utf-8', newline='\n').write('\n'.join(out) + '\n')
    print('\n'.join(out))


if __name__ == '__main__':
    main()
