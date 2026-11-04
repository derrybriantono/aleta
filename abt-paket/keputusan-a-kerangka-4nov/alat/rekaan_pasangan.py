# -*- coding: utf-8 -*-
"""RTF REKAAN (nama rekaan) sebelum/sesudah paket keputusan-a-kerangka-4nov. Penanda diganti nilai rekaan (meniru ABT).
pakai: python rekaan_pasangan.py <akar sebelum> <akar sesudah> <bukti> <daftar.txt>
daftar.txt: satu baris `label|rel sebelum|rel sesudah` (rel relatif akar, tanpa derry_briantono/).
Keluaran: <bukti>/rtf/<label>-sebelum-<keadaan>.rtf dan -sesudah-; <bukti>/rtf-daftar.txt (untuk rtf_pdf_daftar.ps1) dan render.json (untuk render.py banding)."""
import json
import os
import re
import sys

SINI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(SINI, '..', '..', 'keputusan-a-mekanis-4nov', 'alat'))
import rekaan as R  # noqa: E402

TAMBAH = {
    '6138': 'SAKSI KETIGA REKAAN', '6139': '41', '6140': 'Islam', '6141': 'SMA', '6142': 'Nelayan', '6143': 'DESA-SAKSI-TIGA', '8922': 'SAUDARA-SAKSI-TIGA',
    '8934': 'SAKSI KEEMPAT REKAAN', '8935': '38', '8936': 'Islam', '8937': 'SMA', '8938': 'Petani', '8939': 'DESA-SAKSI-EMPAT', '8940': 'TETANGGA-SAKSI-EMPAT',
    '6100': 'SAKSI SATU TERGUGAT REKAAN', '6101': '44', '6102': 'Islam', '6103': 'SMA', '6104': 'Wiraswasta', '6105': 'DESA-T-SATU', '1251': 'TEMAN-T-SATU',
    '6106': 'SAKSI DUA TERGUGAT REKAAN', '6107': '47', '6108': 'Islam', '6109': 'SMP', '6110': 'Petani', '6111': 'DESA-T-DUA', '1252': 'SAUDARA-T-DUA',
    '9264': 'Bahwa saksi tergugat satu menerangkan para pihak sudah berpisah tempat tinggal sejak 2025;',
    '9265': 'Bahwa saksi tergugat dua menerangkan para pihak tidak pernah rukun lagi;',
    '9266': 'Bahwa saksi tergugat tiga menerangkan Tergugat masih mau rukun;',
    '9267': 'Bahwa saksi tergugat empat menerangkan Tergugat tidak pernah melakukan kekerasan;',
    '9268': 'Rp600.000,00 (enam ratus ribu rupiah)', '9269': 'Rp20.000,00 (dua puluh ribu rupiah)', '6054': 'sejumlah Rp1.800.000,00 (satu juta delapan ratus ribu rupiah)',
    '5058': 'Apakah saksi kenal dengan para Pemohon?\\par - Ya, saya kenal karena saya paman Pemohon I;\\par Apakah saksi tahu maksud Pemohon menghadap?\\par - Ya, untuk mengesahkan pernikahan;',
    '5059': 'Apakah saksi kenal dengan para Pemohon?\\par - Ya, saya kenal karena saya tetangga Pemohon II;\\par Apakah saksi hadir saat pernikahan?\\par - Ya, saya hadir;',
    '8171': 'pengurusan akta kelahiran anak dan keperluan lainnya', '0378': 'P.1 Fotokopi KTP; P.2 Fotokopi Kutipan Akta Nikah', '12040': 'P.1 Fotokopi KTP;',
}


def isi(d, v):
    d = re.sub(r'\{\\\*\\isian[a-z]*[^{}]*\}', '', d)
    return re.sub(r'#(\d{4,5})#', lambda m: v.get(m.group(1), '...'), d)


def main():
    a, b, bukti, daftar = sys.argv[1:5]
    rtf = os.path.join(bukti, 'rtf')
    os.makedirs(rtf, exist_ok=True)
    keluar = []
    for l in open(daftar, encoding='utf-8'):
        if '|' not in l:
            continue
        label, rs, rb = [x.strip() for x in l.split('|', 2)]
        for kead in ('majelis', 'tunggal'):
            v = R.nilai(kead, rs)
            v.update(TAMBAH)
            sb = open(os.path.join(a, 'derry_briantono', rs), 'rb').read().decode('latin1')
            sa = open(os.path.join(b, 'derry_briantono', rb), 'rb').read().decode('latin1')
            ps = os.path.join(rtf, '%s-sebelum-%s.rtf' % (label, kead))
            pa = os.path.join(rtf, '%s-sesudah-%s.rtf' % (label, kead))
            open(ps, 'wb').write(isi(sb, v).encode('latin1'))
            open(pa, 'wb').write(isi(sa, v).encode('latin1'))
            keluar.append({'no': label, 'rel': rb, 'keadaan': kead, 'sebelum': ps, 'sesudah': pa})
    json.dump(keluar, open(os.path.join(bukti, 'render.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    with open(os.path.join(bukti, 'rtf-daftar.txt'), 'w', encoding='utf-8') as f:
        for d in keluar:
            f.write(d['sebelum'] + '\n' + d['sesudah'] + '\n')
    print(len(keluar), 'pasangan')


if __name__ == '__main__':
    main()
