# -*- coding: utf-8 -*-
"""Tulis hasil/kueri-lama-baru.tsv (no, kueri lama, kueri baru; '\\n' = baris baru) untuk alat/banding.js.
pakai: python tulis_tsv.py <basis ABT sesudah 29 paket>"""
import io
import os
import subprocess
import sys

SINI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, SINI)
import kueri_pembuktian as Q  # noqa: E402

MYSQL = r'D:\satker asal\website pa bungku\xampp\mysql\bin\mysql.exe'
VAR = (('2111', 'bukti-p'), ('7119', 'bukti-p'), ('2112', 'bukti-t'), ('7121', 'bukti-t'))


def lama(db, no):
    r = subprocess.run([MYSQL, '-u', 'root', '-h', '127.0.0.1', '-N', '--default-character-set=latin1', db, '-e',
                        "SELECT HEX(REPLACE(sql_query, CONCAT(DATABASE(), '.'), 'aps_badilag.')) FROM abt_variabel WHERE no_var=%s" % no],
                       capture_output=True, check=True)
    return bytes.fromhex(r.stdout.decode().strip()).decode('latin1')


if __name__ == '__main__':
    db = sys.argv[1]
    with io.open(os.path.join(SINI, '..', 'hasil', 'kueri-lama-baru.tsv'), 'w', encoding='utf-8', newline='\n') as f:
        for no, jenis in VAR:
            t = lama(db, no)
            n = Q.ubah(t, jenis)
            f.write('%s\t%s\t%s\n' % (no, t.replace('\n', '\\n').replace('\t', ' '), n.replace('\n', '\\n').replace('\t', ' ')))
