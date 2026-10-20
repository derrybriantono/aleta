# -*- coding: utf-8 -*-
"""Menjalankan kueri variabel baru (BACA SAJA) di SIPP lokal (sipp_donggala; MariaDB lokal) atas perkara nyata.
  python uji_kueri.py [perkara_id ...]   -> hasil tiap variabel per perkara (+ ringkasan jumlah galat)
Penanda #NNNN# pada hasil dikembangkan sederhana dari isian abt_data_teks agar mudah dibaca (bukan renderer ABT)."""
import os, re, subprocess, sys, io

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from variabel import VAR  # noqa: E402

MYSQL = r'D:\satker asal\website pa bungku\xampp\mysql\bin\mysql.exe'
DB = os.environ.get('SIPP_UJI', 'sipp_donggala')
PERKARA = [int(x) for x in sys.argv[1:]] or [10167, 10041, 9774, 10090, 9760, 9712, 10089]


def jalan(sql, db=DB):
    r = subprocess.run([MYSQL, '-h', '127.0.0.1', '-u', 'root', '--default-character-set=latin1', '-N', '-B', db, '-e', sql], capture_output=True)
    return r.returncode, r.stdout.decode('cp1252', 'replace').strip(), r.stderr.decode('cp1252', 'replace').strip()


def isian_nilai(no, pid):
    rc, out, _ = jalan("SELECT data FROM aps_badilag.abt_data_teks WHERE no_var=%d AND perkara_id=%d LIMIT 1" % (no, pid))
    return out if rc == 0 else ''


def kembang(teks, pid):
    def ganti(m):
        v = isian_nilai(int(m.group(1)), pid)
        return v if v else '<%s>' % m.group(1)
    return re.sub(r'#(\d{4})#', ganti, teks)


def main():
    galat = 0
    sys.stdout.reconfigure(encoding='utf-8')
    for pid in PERKARA:
        print('=== perkara', pid)
        for v in VAR:
            if not v['sql']:
                continue
            q = v['sql'].replace('#perkara_id#', str(pid))
            rc, out, err = jalan(q)
            if rc != 0:
                galat += 1
                print('  [%d] GALAT %s' % (v['no'], err[:300]))
                continue
            print('  [%d] %s' % (v['no'], kembang(out, pid).replace('<br>', '\n        ')[:1500]))
    print('GALAT=%d' % galat)
    sys.exit(1 if galat else 0)


if __name__ == '__main__':
    main()
