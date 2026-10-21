# -*- coding: utf-8 -*-
"""Bandingkan SQL LAMA vs BARU (paket x10) atas semua (atau subset) perkara di sipp_donggala lokal, tanpa renderer (baris pertama hasil pernyataan mentah).
pakai: python banding_sql10.py <label> <var,var,...> [subset-sql]   -> out/banding_<label>.json {var: {pid: [lama, baru]}}  (None = tak ada baris; '' = baris kosong)"""
import json, re, subprocess, sys, time

sys.path.insert(0, r'D:\aleta-dev\wt\w40\abt-paket\x10-audit-ringan-21okt\sumber')
import variabel_def as V

MY = r'D:\Satker Asal\Website PA Bungku\xampp\mysql\bin\mysql.exe'
HEX = r'D:\Aplikasi\aleta\tmp\x10\lab\var_server_hex.tsv'
dasar = {}
for b in open(HEX, encoding='latin1', newline='').read().split('\n')[1:]:
    if b.strip():
        k = b.split('\t')
        dasar[int(k[0])] = dict(no_var=int(k[0]), data_type=None if k[2] == 'NULL' else k[2],
                                sql_query=None if k[7] == 'NULL' else bytes.fromhex(k[7]), default_data=None if k[8] == 'NULL' else bytes.fromhex(k[8]))
label = sys.argv[1]
VAR = [int(x) for x in sys.argv[2].split(',')]
subset = sys.argv[3] if len(sys.argv) > 3 else 'select perkara_id from perkara order by 1'
pids = [int(x) for x in subprocess.run([MY, '-uroot', '-N', 'sipp_donggala', '-e', subset], capture_output=True).stdout.decode().split()]
print('perkara', len(pids), flush=True)
TMP = r'D:\Aplikasi\aleta\tmp\x10\sql_banding_%s.sql' % label
hasil = {}
for no in VAR:
    lama = dasar[no]['sql_query']
    baru = V.UBAH[no]['fungsi'](dasar[no])['sql_query'] if no in V.UBAH else lama
    with open(TMP, 'wb') as f:
        for ver, sql in (('lama', lama), ('baru', baru)):
            s = sql.decode('latin1').rstrip().rstrip(';')
            for pid in pids:
                f.write(("SELECT 'MARK|%s|%d';\n" % (ver, pid)).encode())
                f.write((s.replace('#perkara_id#', str(pid)) + ';\n').encode('latin1'))
    t0 = time.time()
    r = subprocess.run([MY, '-uroot', '--default-character-set=latin1', '-N', '-B', '--force', 'sipp_donggala'], stdin=open(TMP, 'rb'), capture_output=True)
    err = r.stderr.decode('latin1')
    out = r.stdout.decode('latin1').replace('\r\n', '\n').split('\n')
    cur = None
    res, sudah = {}, set()
    for j, l in enumerate(out):
        if l.startswith('MARK|'):
            _, ver, pid = l.split('|')
            cur = (ver, int(pid))
            res[cur] = None
        elif cur is not None and cur not in sudah:
            sudah.add(cur)
            if j == len(out) - 1 and l == '':
                continue
            v = l.split('\t')[0]
            res[cur] = '' if v == 'NULL' else v
    hasil[no] = {pid: [res.get(('lama', pid)), res.get(('baru', pid))] for pid in pids}
    ng = len(re.findall(r'ERROR', err))
    print(no, 'selesai', round(time.time() - t0), 'dtk; galat mysql:', ng, err[:200].replace('\n', ' ') if ng else '', flush=True)
json.dump({str(k): {str(p): v for p, v in d.items()} for k, d in hasil.items()}, open(r'D:\Aplikasi\aleta\tmp\x10\out\banding_%s.json' % label, 'w', encoding='utf-8'), ensure_ascii=False)
