# -*- coding: utf-8 -*-
"""Jalankan kueri 9290/9291/9292/9293/8172 BACA SAJA di SIPP server (lewat lihat-jejak.sh, hanya SELECT) untuk beberapa perkara terbaru; ukur waktu."""
import sys, time
sys.path.insert(0, '.'); sys.path.insert(0, '../sumber')
from srv_sql import srv
import variabel_def as V
n = int(sys.argv[1]) if len(sys.argv) > 1 else 3
o, e = srv("SELECT perkara_id FROM perkara WHERE YEAR(tanggal_pendaftaran)=YEAR(CURDATE()) ORDER BY perkara_id DESC LIMIT %d" % n)
ids = [x for x in o.split('\n')[1:] if x.strip()]
sqlv = {d['no']: d['sql'] for d in V.BARU}
def jalan(q, pid, rujuk=None):
    q = q.replace('#perkara_id#', pid)
    for k, v in (rujuk or {}).items():
        q = q.replace('#%s#' % k, v)
    t = time.time()
    o, e = srv(q)
    lines = [x for x in o.split('\n')[1:] if x.strip()]
    return (lines[0] if lines else ''), e.strip()[:200], round(time.time() - t, 1)
for pid in ids:
    k1 = jalan(sqlv[9290], pid); k2 = jalan(sqlv[9291], pid)
    a1 = jalan(sqlv[9292], pid, {'9290': k1[0] or '...'}); a2 = jalan(sqlv[9293], pid, {'9291': k2[0] or '...'})
    s = jalan(V.SQL_8172, pid, {'9291': k2[0] or '...'})
    print(pid, '9290', k1, '9291', k2, '| 9292 ...', a1[0][-60:], a1[2], '| 9293 ...', a2[0][-60:], a2[2], '| 8172', s)
