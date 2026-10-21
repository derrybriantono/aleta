# -*- coding: utf-8 -*-
"""Bandingkan SQL LAMA vs BARU variabel S1/S2/S4/S6 (+ nama pembanding) atas SEMUA perkara di sipp_donggala lokal, tanpa renderer:
baris pertama hasil pernyataan mentah (seperti ABT: $exec_data->row()). Lama = keadaan dasar (server+x1); baru = hasil variabel_def.
pakai: python banding_sql.py  -> out/banding_sql.json {var: {pid: [lama, baru]}}"""
import json, os, re, subprocess, sys, time

sys.path.insert(0, r'D:\aleta-dev\wt\integrasi21\abt-paket\x2-perbaikan-audit-sedang-21okt\sumber')
import variabel_def as V

MY = r'D:\Satker Asal\Website PA Bungku\xampp\mysql\bin\mysql.exe'
HEX = r'D:\Aplikasi\aleta\tmp\x2\lab\var_base_hex.tsv'
dasar = {}
for b in open(HEX, encoding='latin1', newline='').read().split('\n')[1:]:
    if b.strip():
        k = b.split('\t')
        dasar[int(k[0])] = dict(no_var=int(k[0]), data_type=None if k[2] == 'NULL' else k[2],
                                sql_query=None if k[7] == 'NULL' else bytes.fromhex(k[7]), default_data=None if k[8] == 'NULL' else bytes.fromhex(k[8]))

VAR = [15, 18, 6031, 6032, 5101, 1241, 1242, 1251, 1252, 6149, 1197, 1203, 6100, 6106, 6132, 8544, 8545, 74]
pasang = {}
for no in VAR:
    if no in V.UBAH:
        d = V.UBAH[no]['fungsi'](dasar[no])
        pasang[no] = d['sql_query']
    elif no in dasar:
        pasang[no] = dasar[no]['sql_query']          # pembanding: tidak berubah
baru_sql = {d['no']: d['sql'].encode('ascii') for d in V.BARU if d['no'] == 74}
pasang[74] = baru_sql[74]

pids = [int(x) for x in subprocess.run([MY, '-uroot', '-N', 'sipp_donggala', '-e', 'select perkara_id from perkara order by 1'], capture_output=True).stdout.decode().split()]
print('perkara', len(pids))
TMP = r'D:\Aplikasi\aleta\tmp\x2\sql_banding.sql'
hasil = {}
for no in VAR:
    versi = []
    if no in dasar and dasar[no]['sql_query']:
        versi.append(('lama', dasar[no]['sql_query']))
    versi.append(('baru', pasang[no]))
    with open(TMP, 'wb') as f:
        for ver, sql in versi:
            s = sql.decode('latin1').rstrip().rstrip(';')
            for pid in pids:
                f.write(("SELECT 'MARK|%s|%d';\n" % (ver, pid)).encode())
                f.write((s.replace('#perkara_id#', str(pid)) + ';\n').encode('latin1'))
    t0 = time.time()
    r = subprocess.run([MY, '-uroot', '--default-character-set=latin1', '-N', '-B', '--force', 'sipp_donggala'], stdin=open(TMP, 'rb'), capture_output=True)
    err = r.stderr.decode('latin1')
    out = r.stdout.decode('latin1').replace('\r\n', '\n').split('\n')
    cur = None
    res = {}
    sudah = set()
    for j, l in enumerate(out):
        if l.startswith('MARK|'):
            _, ver, pid = l.split('|')
            cur = (ver, int(pid))
            res[cur] = None          # None = tidak ada baris (ABT mencetak "...")
        elif cur is not None and cur not in sudah:
            sudah.add(cur)
            if j == len(out) - 1 and l == '':
                continue
            v = l.split('\t')[0]
            res[cur] = '' if v == 'NULL' else v   # ada baris: kosong/NULL = dicetak kosong
    # nilai None = tidak ada baris; '' kosong tak bisa dibedakan -> tandai
    d = {}
    for pid in pids:
        d[pid] = [res.get(('lama', pid)), res.get(('baru', pid))] if any(v == 'lama' for v, _ in versi) else [None, res.get(('baru', pid))]
    hasil[no] = d
    ng = len(re.findall(r'ERROR', err))
    print(no, 'selesai', round(time.time() - t0), 'dtk; galat mysql:', ng, err[:200].replace('\n', ' ') if ng else '', flush=True)
json.dump({str(k): {str(p): v for p, v in d.items()} for k, d in hasil.items()}, open(r'D:\Aplikasi\aleta\tmp\x2\out\banding_sql.json', 'w', encoding='utf-8'), ensure_ascii=False)
