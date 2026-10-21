# -*- coding: utf-8 -*-
"""Uji #3450# di server (baca saja) seperti ABT menjalankannya: tiap #NNNN# di kueri diganti NILAI variabel itu untuk perkara yang sama
(pemicu dievaluasi dulu dari salinan katalog server), lalu kueri dijalankan. Keluaran: baris "<pemicu>|<status>" (kutipan dipotong 60 huruf).
pakai: python uji_kutipan_server.py <perkara_id> ..."""
import os, re, sys

AKAR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AKAR)
sys.path.insert(0, os.path.join(AKAR, '..', 'sumber'))
import srv_sql  # noqa: E402
import var  # noqa: E402
import definisi_x8 as D  # noqa: E402

V = var.muat(os.environ.get('VAR_SERVER_HEX', r'D:\Aplikasi\aleta\tmp\w38\var_server_hex.tsv'))
sql = [b for b in D.BARU if b['no'] == 3450][0]['sql']
for pid in sys.argv[1:]:
    nilai = {}
    for p in D.PEMICU:
        q = V[int(p)]['sql'].replace('#perkara_id#', pid)
        assert not re.search(r'#\d{4}#', q), p
        o, e = srv_sql.srv(q)
        baris = [l for l in o.split('\n')[1:] if l.strip()]
        nilai[p] = baris[0].strip() if baris else ''
    q = sql
    for p, v in nilai.items():
        q = q.replace('#%s#' % p, v)
    o, e = srv_sql.srv(q.replace('#perkara_id#', pid))
    data = o.split('\n', 1)[1].replace('\\n', '\n') if '\n' in o else ''
    ya = [p for p, v in nilai.items() if v == 'ya']
    print('perkara %s: pemicu ya %s; galat %s' % (pid, ya, e.strip()[:200]))
    for l in data.split('\n'):
        k = l.split('|', 2)
        if len(k) >= 2 and k[1] in ('ya', 'ragu'):
            print('   %s|%s|%s' % (k[0], k[1], (k[2] if len(k) > 2 else '')[:70]))
    nb = len([l for l in data.split('\n') if re.match(r'^\d{4}\|', l)])
    print('   baris', nb, 'dari', len(D.PEMICU), '; status ya di 3450 = pemicu ya:', sorted(l.split('|')[0] for l in data.split('\n') if '|ya|' in l) == sorted(ya))
