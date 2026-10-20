# -*- coding: utf-8 -*-
"""Mengambil posita + petitum perkara Lain-Lain (jenis 369) dari SIPP lokal (sipp_donggala, BACA SAJA) ke data-uji/lain-posita.json.
NIK (16 angka) disamarkan menjadi nol agar berkas uji tidak memuat nomor identitas.

  python ambil_posita_lain.py
"""
import binascii
import json
import os
import re
import subprocess

AKAR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MYSQL = r'D:\satker asal\website pa bungku\xampp\mysql\bin\mysql.exe'
SQL = ('SELECT perkara_id, nomor_perkara, alur_perkara_id, HEX(IFNULL(posita, "")), HEX(IFNULL(petitum, "")) '
       'FROM sipp_donggala.perkara WHERE jenis_perkara_id = 369 ORDER BY perkara_id')


def main():
    r = subprocess.run([MYSQL, '-h127.0.0.1', '-uroot', '-N', '-B', '-e', SQL], capture_output=True, timeout=120)
    hasil = []
    for baris in r.stdout.decode('utf-8', 'replace').splitlines():
        a = baris.split('\t')
        if len(a) < 5:
            continue
        posita = binascii.unhexlify(a[3]).decode('utf-8', 'replace')
        petitum = binascii.unhexlify(a[4]).decode('utf-8', 'replace')
        samar = lambda t: re.sub(r'\b\d{16}\b', '0000000000000000', t)  # noqa: E731
        hasil.append(dict(perkaraId=int(a[0]), nomor=a[1], alur=a[2], posita=samar(posita), petitum=samar(petitum)))
    tujuan = os.path.join(AKAR, 'data-uji', 'lain-posita.json')
    os.makedirs(os.path.dirname(tujuan), exist_ok=True)
    with open(tujuan, 'w', encoding='utf-8', newline='\n') as f:
        json.dump(hasil, f, ensure_ascii=False, indent=1)
    print(len(hasil), 'perkara ->', tujuan)


if __name__ == '__main__':
    main()
