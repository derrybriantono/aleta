import sys, re
sys.path.insert(0, '.')
from variabel import VARIABEL
import bukti
V = VARIABEL + [bukti.bangun()]
for v in sorted(V, key=lambda x: x['no']):
    teks = (v['sql'] or '') + v['nama'] + (v['default'] or '')
    assert all(ord(c) < 128 for c in teks), (v['no'], [c for c in teks if ord(c) >= 128][:5])
    assert 'aleta' not in teks.lower(), v['no']
    if len(v["nama"]) > 200: print("PANJANG", v["no"], len(v["nama"]))
    assert not v['sql'] or len(v['sql']) < 60000, (v['no'], len(v['sql']))
    print(v['no'], v['tipe'], len(v['sql'] or ''), len(v['nama']))
