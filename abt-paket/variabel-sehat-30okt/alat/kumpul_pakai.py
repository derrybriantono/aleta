# -*- coding: utf-8 -*-
"""Kumpulkan penanda #NNNN# yang dipakai blangko Derry AKTIF (folder arsip ALUR*, - BAS * -, terhapus dilewati), termasuk
penanda yang hanya muncul lewat variabel lain (sql_query data_sql memuat #NNNN#), lalu golongkan per jenis & pemilik.
pakai: python kumpul_pakai.py <akar derry_briantono> <basis ABT> <keluar.json>"""
import collections, json, os, re, subprocess, sys
MYSQL = r'D:\satker asal\website pa bungku\xampp\mysql\bin\mysql.exe'
akar, db, kel = sys.argv[1:4]
pakai = collections.defaultdict(set)
for d, _, fs in os.walk(akar):
    for f in fs:
        if not f.lower().endswith('.rtf'):
            continue
        p = os.path.join(d, f)
        rel = os.path.relpath(p, akar).replace(os.sep, '/')
        atas = rel.split('/')[0]
        if 'terhapus' in rel.lower() or re.match(r'(ALUR|- BAS .* -$)', atas):
            continue
        raw = open(chr(92) * 2 + '?' + chr(92) + os.path.abspath(p), 'rb').read().decode('latin1')
        for k in set(re.findall(r'#(\d{4,5})#', raw)):
            pakai[k].add(rel)
q = "SELECT no_var, IFNULL(data_type,''), IFNULL(modifier,''), HEX(IFNULL(sql_query,'')), HEX(IFNULL(nama,'')) FROM abt_variabel"
r = subprocess.run([MYSQL, '-u', 'root', '-h', '127.0.0.1', '-N', '--default-character-set=latin1', db, '-e', q], capture_output=True)
var = {}
for l in r.stdout.decode('latin1').splitlines():
    no, jt, mod, sq, nm = l.split('\t')
    var[no] = dict(jenis=jt, pemilik=mod, sql=bytes.fromhex(sq).decode('latin1'), nama=bytes.fromhex(nm).decode('latin1'))
# penanda bersarang: variabel data_sql yang dipakai memuat penanda lain -> ikut dipakai (blangko yang sama)
ubah = True
while ubah:
    ubah = False
    for k in list(pakai):
        v = var.get(k)
        if not v or v['jenis'] != 'data_sql':
            continue
        for n in set(re.findall(r'#(\d{4,5})#', v['sql'])):
            if not pakai[n] >= pakai[k]:
                pakai[n] |= pakai[k]
                ubah = True
hasil = {k: dict(blangko=len(b), contoh=sorted(b)[:3], folder=sorted(set(x.split('/')[0] for x in b)), **{x: var[k][x] for x in ('jenis', 'pemilik', 'nama', 'sql')} if k in var else dict(jenis='TIDAK ADA', pemilik='', nama='', sql=''))
         for k, b in pakai.items()}
json.dump(hasil, open(kel, 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
c = collections.Counter((v['jenis'], v['pemilik'] or '-') for v in hasil.values())
for k, n in c.most_common():
    print(n, k)
print('jumlah penanda', len(hasil))
