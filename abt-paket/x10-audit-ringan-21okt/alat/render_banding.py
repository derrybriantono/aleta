# -*- coding: utf-8 -*-
"""Render variabel yang diubah paket x10 memakai renderer php56 ABT asli atas banyak perkara nyata.
pakai: python render_banding.py <label> <A|B|C> [pid,pid,...|semua]   -> out/<label>/<jenis>.json  {pid: {var: nilai}|{'_galat': teks}}"""
import json, os, re, sys, time
from concurrent.futures import ThreadPoolExecutor

sys.path.insert(0, r'D:\Aplikasi\aleta\tmp\x10')
import rend

label, jenis = sys.argv[1], sys.argv[2]
S = json.load(open(r'D:\Aplikasi\aleta\tmp\x10\sampel.json'))
if len(sys.argv) > 3 and sys.argv[3] != 'semua':
    pids = [int(x) for x in sys.argv[3].split(',')]
elif jenis == 'D':
    pids = S['contoh'][:5]
elif jenis == 'C':
    pids = []
    for l in (S['khusus']['tanpa_jadwal'], S['contoh'], S['acak'][:30]):
        for x in l:
            if x not in pids:
                pids.append(x)
else:
    pids = []
    for l in [S['contoh'], S['acak'][:70]] + [v[:14] for v in S['khusus'].values()]:
        for x in l:
            if x and x not in pids:
                pids.append(x)

S5 = [309, 662, 1281, 8018, 704, 705, 706, 707, 1031, 1032, 1037, 1038, 1039, 1040, 1042, 1043, 1044, 1045, 1048, 1162, 1163, 1236, 1245, 1249, 1250, 1356,
      2011, 2040, 5004, 5111, 5113, 5140, 5208, 5209, 5210, 6058, 6065, 6118, 6119, 6125, 6128, 6129, 6130, 6131, 8020, 8134, 8426, 8427, 8428, 8429, 8430, 8431]
VARS = {
    'A': [143, 15, 18, 6031, 212, 213, 357, 1076, 1077, 317, 328, 6032, 5101, 6144, 6145, 6146, 6147, 6148, 6151, 6150, 8146, 8147, 7713, 7123, 7124,
          8544, 8545, 1241, 1242, 1251, 1252, 6149, 8129, 8155],
    'B': [9003],
    'C': [7105, 7106],
    'D': [6271],
}[jenis]
tpl = ''.join('%%%%%d%%%%#%04d#' % (n, n) if n < 10000 else '%%%%%d%%%%#%d#' % (n, n) for n in VARS) + '%%end%%'
KELUAR = r'D:\Aplikasi\aleta\tmp\x10\out\%s' % label
os.makedirs(KELUAR, exist_ok=True)


def kerja(a):
    i, pid = a
    t0 = time.time()
    t = rend.render(tpl, pid, '', w='_w%d' % (i % 4))
    if '%%end%%' not in t:
        return pid, {'_galat': re.sub(r'\s+', ' ', t)[:400]}, time.time() - t0
    out = {}
    for m in re.finditer(r'%%(\d+)%%(.*?)(?=%%\d+%%|%%end%%)', t, re.S):
        out[m.group(1)] = m.group(2)
    return pid, out, time.time() - t0


hasil = {}
t0 = time.time()
with ThreadPoolExecutor(max_workers=4) as ex:
    for k, (pid, out, dt) in enumerate(ex.map(kerja, list(enumerate(pids)))):
        hasil[pid] = out
        if k % 25 == 0:
            print(k, len(pids), round(time.time() - t0), 'dtk', flush=True)
json.dump(hasil, open(os.path.join(KELUAR, jenis + '.json'), 'w', encoding='utf-8'), ensure_ascii=False)
print(label, jenis, 'selesai', len(hasil), 'perkara', round(time.time() - t0), 'dtk;', sum(1 for v in hasil.values() if '_galat' in v), 'galat')
