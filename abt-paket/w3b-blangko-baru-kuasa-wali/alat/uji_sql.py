# -*- coding: utf-8 -*-
"""Uji kueri variabel data_sql (BACA SAJA) atas SIPP server lewat `ssh aleta bash /root/lihat-jejak.sh`.
Pakai: python uji_sql.py <no_var> <perkara_id> [KODE=nilai ...]   (nilai penanda #KODE# yang diganti sebelum dijalankan)
Atau sebagai pustaka: jalankan(sql, perkara_id, penanda) -> teks hasil."""
import os
import re
import subprocess
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'sumber'))


def jalankan(sql, perkara_id, penanda=None, lokal=False):
    s = sql.replace('#perkara_id#', str(perkara_id))
    for k, nilai in (penanda or {}).items():
        s = s.replace('#%s#' % k, nilai)
    s = re.sub(r'#(\d{4})#', '', s)  # penanda yang tidak diberi nilai = kosong (isian belum diisi)
    r = subprocess.run(['ssh', '-o', 'ConnectTimeout=25', 'aleta', 'bash /root/lihat-jejak.sh "$(cat)"'], input=s.encode('utf-8'), capture_output=True, timeout=120)
    return (r.stdout.decode('utf-8', 'replace') + r.stderr.decode('utf-8', 'replace')).strip()


if __name__ == '__main__':
    import variabel_def as V
    no = int(sys.argv[1])
    d = [x for x in V.VAR if x['no'] == no][0]
    pen = dict(a.split('=', 1) for a in sys.argv[3:])
    print(jalankan(d['sql'], sys.argv[2], pen))
