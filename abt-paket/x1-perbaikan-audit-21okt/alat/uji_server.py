# uji kueri variabel baru atas perkara nyata di SERVER (baca saja, SELECT saja); ringkas: variabel yang berisi tiap perkara + hash isi
import sys, re, hashlib, json
sys.path.insert(0, 'D:/Aplikasi/aleta/tmp/x1')
from srv_sql import srv
PK = 'D:/aleta-dev/wt/integrasi21/abt-paket/x1-perbaikan-audit-21okt/paket-satker/'
nomor = [x.strip() for x in open(PK + 'perkara-uji.txt') if x.strip()]
o, e = srv("SELECT perkara_id, nomor_perkara FROM perkara WHERE nomor_perkara IN (%s)" % ','.join("'%s'" % n for n in nomor))
pid = {}
for l in o.strip().splitlines()[1:]:
    a = l.split('\t'); pid[a[1]] = a[0]
print('perkara ketemu di server:', len(pid), 'dari', len(nomor))
kueri = [l.rstrip('\n').split('\t') for l in open(PK + 'uji-kueri.tsv', encoding='ascii') if l.strip() and not l.startswith('#')]
hasil = {}
for n in nomor:
    if n not in pid: print('TIDAK ADA di server:', n); continue
    st = []
    for no, sql in kueri:
        st.append('SELECT "%s" AS var, LEFT(REPLACE(IFNULL((SELECT x.data FROM (%s) x LIMIT 1), "(kosong)"), CHAR(10), " "), 120) AS data;' % (no, sql.replace('#perkara_id#', pid[n])))
    o, e = srv('\n'.join(st))
    if e.strip(): print('GALAT', n, e[:300]); continue
    baris = [l for l in o.splitlines() if l.strip() and not l.startswith('var\t')]
    d = {}
    for l in baris:
        a = l.split('\t', 1); d[a[0]] = a[1] if len(a) > 1 else ''
    hasil[n] = d
    isi = [k for k, v in d.items() if v not in ('(kosong)', '')]
    print('%s (id %s): %d kueri jalan; berisi: %s' % (n, pid[n], len(d), ' '.join(isi)))
json.dump(hasil, open('D:/Aplikasi/aleta/tmp/x1/uji_server.json', 'w'), ensure_ascii=False)
