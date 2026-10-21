# -*- coding: utf-8 -*-
"""Bandingkan variabel 8172 LAMA (post_code dari baris kode_pos yang area-nya = kata kedua alamat, via #0210#) dengan aturan BARU (kode pos dari kode wilayah),
untuk Tergugat/Termohon (pihak2 urutan 1) perkara 2026 di SIPP laptop. Keluaran: hasil/banding-8172.json (angka saja, tanpa nama/alamat)."""
import collections
import json
import os
import subprocess
import sys

AKAR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AKAR)
MYSQL = r'D:\Satker Asal\Website PA Bungku\xampp\mysql\bin\mysql.exe'
BS = chr(92)


def sql(q):
    r = subprocess.run([MYSQL, '-h127.0.0.1', '-uroot', '--default-character-set=utf8', '-N', '-B', 'sipp_donggala'], input=q.encode('utf-8'), capture_output=True)
    if r.returncode:
        raise SystemExit(r.stderr.decode('utf-8', 'replace')[:400])
    return r.stdout.decode('utf-8', 'replace').replace('\r', '').rstrip('\n')


masuk = json.load(open(r'D:\Aplikasi\aleta\tmp\w28-layar\ukur-masuk.json', encoding='utf-8'))
sys.path.insert(0, os.path.join(AKAR, '..', '..', '..'))
# aturan baru = pilihKodePos lewat node (hasil per kode kelurahan sudah dihitung ukur_js.js)
baru = json.loads(subprocess.run(['node', os.path.join(AKAR, 'ukur_js.js'), r'D:\Aplikasi\aleta\tmp\w28-layar\ukur-masuk.json'], capture_output=True).stdout.decode('utf-8'))

# kata kedua alamat persis seperti #0210#: TRIM(REPLACE(SUBSTRING_INDEX(SUBSTRING_INDEX(alamat, ' ', 2), ' ', -1), ',', ''))
baris = sql("""SELECT TRIM(b.kelurahan), TRIM(REPLACE(SUBSTRING_INDEX(SUBSTRING_INDEX(x.alamat, ' ', 2), ' ', -1), ',', '')),
    IF(x.alamat LIKE '%%tidak diketahui%%' OR x.alamat LIKE 'Dahulu%%' OR x.ghaib = 1, 1, 0)
  FROM perkara_pihak2 x JOIN perkara pr ON pr.perkara_id = x.perkara_id AND YEAR(pr.tanggal_pendaftaran) = 2026 JOIN pihak b ON b.id = x.pihak_id WHERE x.urutan = 1""").split('\n')
kata = sorted(set(b.split('\t')[1] for b in baris if b.split('\t')[1]))
lama = {}
for i in range(0, len(kata), 200):
    bag = kata[i:i + 200]
    q = "SELECT area, GROUP_CONCAT(DISTINCT post_code ORDER BY post_code) FROM kode_pos WHERE area IN (%s) GROUP BY area" % ','.join("'%s'" % k.replace("'", "''") for k in bag)
    for r in sql(q).split('\n'):
        if r:
            a, _, k = r.partition('\t')
            lama[a.lower()] = k
hit = collections.Counter()
for b in baris:
    kel, k2, tak = b.split('\t')
    nb = (baru.get(kel) or {}).get('kodePos') if tak != '1' else None
    kl = lama.get(k2.lower(), '')
    ol = kl.split(',')[0] if kl else ''   # ABT memakai baris pertama
    if tak == '1':
        hit['lama: tetap mencetak kode pos untuk alamat tidak diketahui' if ol else 'tanpa keduanya (alamat tidak diketahui)'] += 1
    elif nb and ol == nb:
        hit['sama'] += 1
    elif nb and not ol:
        hit['lama kosong ("..."), baru terisi'] += 1
    elif nb and ol and ol != nb:
        hit['lama SALAH/beda (lama %s, baru %s)' % ('banyak' if ',' in kl else 'satu', 'pasti')] += 1
    elif not nb and ol:
        hit['baru kosong, lama terisi (lama bisa salah)'] += 1
    else:
        hit['kosong keduanya'] += 1
json.dump(dict(total=len(baris), hasil=dict(hit.most_common())), open(os.path.join(AKAR, '..', 'hasil', 'banding-8172.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(json.dumps(dict(total=len(baris), hasil=dict(hit.most_common())), ensure_ascii=False, indent=1))
