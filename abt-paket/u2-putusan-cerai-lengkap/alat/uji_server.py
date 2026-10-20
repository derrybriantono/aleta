# -*- coding: utf-8 -*-
"""Jalankan kueri variabel paket di SIPP server (BACA SAJA lewat lihat-jejak.sh; MariaDB 5.5) dengan penanda sistem dipetakan statis.
Pakai: python uji_server.py <nomor,nomor,...> <perkara_id,...>   -> cetak hasil ringkas atau galat SQL."""
import json, os, re, subprocess, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from uji_cepat import muat, peta_token
AKAR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def jalankan_sql(q):
    r = subprocess.run(['ssh', '-o', 'ConnectTimeout=25', 'aleta', 'cat > /tmp/u2q.$$.sql; bash /root/lihat-jejak.sh "$(cat /tmp/u2q.$$.sql)"; rm -f /tmp/u2q.$$.sql'],
                       input=q.encode('utf-8'), capture_output=True, timeout=300)
    return r.stdout.decode('utf-8', 'replace'), r.stderr.decode('utf-8', 'replace')


def kueri(no, pid, jn):
    q = muat()[no]['sql'].replace('#perkara_id#', str(pid))
    pt = peta_token(jn)
    return re.sub(r'#(\d{4})#', lambda m: pt.get(m.group(1), 'X' + m.group(1)), q)


def jenis(pid):
    o, _ = jalankan_sql('SELECT jenis_perkara_id FROM perkara WHERE perkara_id=%d' % pid)
    return int(o.split()[-1])


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    nomor = [int(x) for x in sys.argv[1].split(',')]
    for pid in [int(x) for x in sys.argv[2].split(',')]:
        jn = jenis(pid)
        for no in nomor:
            o, e = jalankan_sql(kueri(no, pid, jn))
            ok = 'GALAT' if (o.startswith('ERROR') or e.strip()) else 'ok'
            print(pid, no, ok, (o + e).strip().replace('\n', ' | ')[:160])
