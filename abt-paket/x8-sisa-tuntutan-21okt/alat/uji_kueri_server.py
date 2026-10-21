# -*- coding: utf-8 -*-
"""Jalankan SEMUA kueri baru/diubah paket x4 (paket-satker/uji-kueri.tsv; rujukan #NNNN# diganti X) BACA SAJA di server atas perkara
nyata (perkara_id). Hasil: jumlah kueri jalan, galat, dan nomor variabel yang berisi. pakai: python uji_kueri_server.py 7326 8706 ..."""
import os, sys

AKAR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AKAR)
import srv_sql  # noqa: E402

uji = [l.rstrip('\n').split('\t', 1) for l in open(os.path.join(AKAR, '..', 'paket-satker', 'uji-kueri.tsv'), encoding='latin1') if l[:1].isdigit()]
for pid in sys.argv[1:]:
    jalan, galat, isi = 0, [], []
    i = 0
    while i < len(uji):
        bag, ukuran = [], 0
        while i < len(uji) and ukuran < 90000:
            no, q = uji[i]
            q = q.replace('#perkara_id#', pid)
            bag.append("SELECT %s AS var, LEFT(REPLACE(IFNULL((SELECT x.data FROM (%s) x LIMIT 1), '(kosong)'), CHAR(10), ' '), 60) AS data;" % (no, q))
            ukuran += len(bag[-1])
            i += 1
        o, e = srv_sql.srv('\n'.join(bag))
        for l in o.split('\n'):
            k = l.split('\t')
            if len(k) == 2 and k[0].isdigit():
                jalan += 1
                if k[1] not in ('(kosong)', ''):
                    isi.append(k[0])
        if e.strip():
            galat.append(e.strip()[:300])
    print('perkara %s: %d/%d kueri jalan, galat %d %s; berisi: %s' % (pid, jalan, len(uji), len(galat), galat[:1], ' '.join(sorted(set(isi)))))
