# -*- coding: utf-8 -*-
"""Ukur kueri variabel data_sql paket W3a atas SIPP lokal (sipp_donggala, s.d. ±9 Okt 2026; BACA SAJA).

Perkara nyata keenam jenis hampir nol (343: 1 perkara; 345, 351, 352, 359, 361: 0), jadi kueri diukur atas perkara SERUMPUN yang dipakai bersama
(cerai gugat/talak, itsbat nikah, dispensasi kawin, asal usul anak, wali adhal, perwalian) dan atas fixture: yang diukur adalah (1) kueri berjalan tanpa galat,
(2) berapa persen perkara menghasilkan nilai tak kosong, (3) contoh keluaran. Penanda isian #nnnn# dikosongkan (isian petugas belum diisi).
Pakai: python ukur_w3a.py [--tulis docs/gelombang3/UKUR-W3a.md]"""
import glob
import importlib
import os
import re
import subprocess
import sys

SUMBER = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, SUMBER)
import variabel_def as VD  # noqa: E402
import w3a_lib as L  # noqa: E402

MYSQL = r'D:\satker asal\website pa bungku\xampp\mysql\bin\mysql.exe'
JENIS_UKUR = {343: 3, 347: 40, 346: 40, 360: 25, 362: 25, 358: 10, 363: 8, 354: 10}


def sql(db, kueri):
    r = subprocess.run([MYSQL, '-h', '127.0.0.1', '-u', 'root', '--default-character-set=latin1', '-N', '-B', db, '-e', kueri], capture_output=True)
    return r.returncode, r.stdout.decode('latin1', 'replace'), r.stderr.decode('latin1', 'replace')


def main():
    for f in sorted(glob.glob(os.path.join(SUMBER, 'jenis_*.py'))):
        importlib.import_module(os.path.basename(f)[:-3])
    import relaas_w3a  # noqa: F401
    sampel = {}
    for jid, n in JENIS_UKUR.items():
        rc, out, err = sql('sipp_donggala', 'SELECT perkara_id FROM perkara WHERE jenis_perkara_id=%d ORDER BY perkara_id DESC LIMIT %d' % (jid, n))
        sampel[jid] = [x for x in out.split('\n') if x.strip()]
    semua = [p for v in sampel.values() for p in v]
    baris = []
    galat_total = 0
    for x in sorted(VD.VAR, key=lambda v: v['no']):
        if x['tipe'] != 'data_sql':
            continue
        kueri = re.sub(r'#(\d{4})#', '', x['sql']).strip().rstrip(';')
        terisi, galat, contoh = 0, 0, ''
        for pid in semua:
            rc, out, err = sql('sipp_donggala', 'SELECT x.data FROM (%s) x LIMIT 1' % kueri.replace('#perkara_id#', pid))
            if rc != 0:
                galat += 1
                contoh = contoh or err.strip()[:120]
                continue
            nilai = out.strip()
            if nilai and nilai != 'NULL':
                terisi += 1
                if not contoh:
                    contoh = nilai.replace('\n', ' ')[:110]
        galat_total += galat
        baris.append((x['no'], len(semua), terisi, galat, contoh))
        print('%d: perkara %d, terisi %d, galat %d | %s' % (x['no'], len(semua), terisi, galat, contoh))
    print('TOTAL variabel data_sql: %d, galat: %d' % (len(baris), galat_total))
    if '--tulis' in sys.argv:
        tujuan = sys.argv[sys.argv.index('--tulis') + 1]
        with open(L.lp(tujuan), 'w', encoding='utf-8') as f:
            f.write('# Ukur kueri variabel paket W3a atas SIPP lokal (sipp_donggala)\n\nSampel serumpun (%d perkara): %s. Perkara nyata keenam jenis hampir nol, jadi hanya kueri yang diukur: berjalan, dan terisi berapa.\n\n'
                    % (len(semua), ', '.join('%s=%d' % (k, len(v)) for k, v in sampel.items())))
            f.write('| variabel | perkara | terisi | galat | contoh |\n|---|---|---|---|---|\n')
            for b in baris:
                f.write('| %d | %d | %d | %d | %s |\n' % (b[0], b[1], b[2], b[3], b[4].replace('|', '/')))
            f.write('\nTotal %d variabel data_sql, galat %d.\n' % (len(baris), galat_total))
    return 1 if galat_total else 0


if __name__ == '__main__':
    sys.exit(main())
