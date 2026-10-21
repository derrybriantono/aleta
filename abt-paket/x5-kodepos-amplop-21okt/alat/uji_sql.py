# -*- coding: utf-8 -*-
"""Jalankan SQL variabel 9290/9291/9292/9293/8172 atas SIPP LAPTOP (sipp_donggala) untuk perkara 2026.
Menyulih #perkara_id# dan rujukan variabel (#9290#/#9291#) seperti ABT. Keluaran: JSON baris per perkara (tanpa nama/NIK).
pakai: python uji_sql.py <jumlah perkara> [db]"""
import json
import os
import subprocess
import sys
import time

AKAR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(AKAR, '..', 'sumber'))
import variabel_def as V  # noqa: E402

MYSQL = r'D:\Satker Asal\Website PA Bungku\xampp\mysql\bin\mysql.exe'
DB = sys.argv[2] if len(sys.argv) > 2 else 'sipp_donggala'


def sql(q, db=DB):
    r = subprocess.run([MYSQL, '-h127.0.0.1', '-uroot', '--default-character-set=utf8', '-N', '-B', db], input=q.encode('utf-8'), capture_output=True)
    if r.returncode:
        raise SystemExit('SQL gagal: ' + r.stderr.decode('utf-8', 'replace')[:400])
    return r.stdout.decode('utf-8', 'replace').replace('\r', '').rstrip('\n')


def jalan(isi, pid, rujukan=None):
    q = isi.replace('#perkara_id#', str(pid))
    for k, v in (rujukan or {}).items():
        q = q.replace('#%s#' % k, v)
    return sql(q)


def main():
    n = int(sys.argv[1]) if len(sys.argv) > 1 else 10
    ids = sql("SELECT perkara_id FROM perkara WHERE YEAR(tanggal_pendaftaran)=2026 AND jenis_perkara_id IN (343,345,346,347,358,359,361) ORDER BY perkara_id DESC LIMIT %d" % n).split('\n')
    sql_var = {d['no']: d['sql'] for d in V.BARU}
    for pid in ids:
        t0 = time.time()
        k1 = jalan(sql_var[9290], pid)
        k2 = jalan(sql_var[9291], pid)
        a1 = jalan(sql_var[9292], pid, {'9290': k1 or '...'})
        a2 = jalan(sql_var[9293], pid, {'9291': k2 or '...'})
        s8172 = jalan(V.SQL_8172, pid, {'9291': k2 or '...'})
        print(json.dumps({'perkara_id': pid, '9290': k1, '9291': k2, '9292': a1[-70:], '9293': a2[-70:], '8172': s8172, 'detik': round(time.time() - t0, 2)}, ensure_ascii=False))


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    main()
