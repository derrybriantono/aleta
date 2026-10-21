# -*- coding: utf-8 -*-
"""Ulang pola x4 di MariaDB 5.5 SERVER (baca saja, lihat-jejak.sh): jumlah perkara yang menyala per pola (lama/baru) atas petitum
seluruh perkara selain itsbat/DK/P3HP, lalu bandingkan dengan Python re (alat/ukur_pola.py) atas salinan TSV yang sama.
Sama = pola berperilaku sama di server (Henry Spencer) dan di alat ukur. Keluaran ringkas -> hasil/ukur-pola-server.json."""
import json, os, re, sys

AKAR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AKAR)
sys.path.insert(0, os.path.join(AKAR, '..', 'sumber'))
import pola_x4 as P  # noqa: E402
import srv_sql  # noqa: E402
import ukur_pola as U  # noqa: E402

PET = ("LOWER(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(CONCAT(IFNULL(p.petitum,''), ' ', IFNULL((SELECT GROUP_CONCAT(r.isi_petitum SEPARATOR ' ') "
       "FROM perkara_rekonvensi r WHERE r.perkara_id = p.perkara_id),'')),'<strong>',''),'</strong>',''),'<em>',''),'</em>',''),'&nbsp;',' '),CHAR(10),' '),CHAR(13),' '))")
kol = []
for k, d in P.UKUR.items():
    jn = ','.join(str(x) for x in sorted(d['jenis']))
    kol.append("SUM(p.jenis_perkara_id IN (%s) AND w.pet REGEXP '%s') AS `%s_baru`" % (jn, d['baru'], k))
    if d.get('lama'):
        kol.append("SUM(p.jenis_perkara_id IN (%s) AND w.pet REGEXP '%s') AS `%s_lama`" % (jn, d['lama'], k))
sql = ("SELECT %s FROM perkara p JOIN (SELECT p.perkara_id, %s AS pet FROM perkara p WHERE p.jenis_perkara_id NOT IN (360,362,371)) w "
       "ON w.perkara_id = p.perkara_id WHERE CHAR_LENGTH(TRIM(w.pet)) >= 30;") % (', '.join(kol), PET)
o, e = srv_sql.srv(sql)
L = [l for l in o.split('\n') if l.strip()]
server = dict(zip(L[0].split('\t'), [int(x) for x in L[1].split('\t')]))
rows = [r for r in U.baca() if r['sumber'] == 'donggala' and len(r['pet'].strip()) >= 30]
py = {}
for k, d in P.UKUR.items():
    py[k + '_baru'] = sum(1 for r in rows if r['jn'] in d['jenis'] and re.search(d['baru'], r['pet']))
    if d.get('lama'):
        py[k + '_lama'] = sum(1 for r in rows if r['jn'] in d['jenis'] and re.search(d['lama'], r['pet']))
beda = {k: (server.get(k), py[k]) for k in py if server.get(k) != py[k]}
json.dump(dict(server=server, python=py, beda=beda), open(os.path.join(AKAR, '..', 'hasil', 'ukur-pola-server.json'), 'w'), indent=1)
print('pola', len(py), 'beda', beda, e.strip()[-300:])
