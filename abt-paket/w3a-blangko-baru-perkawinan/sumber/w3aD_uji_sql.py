# -*- coding: utf-8 -*-
"""Uji kueri variabel data_sql jenis hak-bekas-istri (agen W3a-D): fragmen isian diganti literal uji, dijalankan di MariaDB lokal (sipp_donggala)
dan, untuk sintaks MariaDB 5.5, di server (BACA SAJA)."""
import os, re, subprocess, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import jenis_hak_bekas_istri as H
from variabel_def import VAR

MYSQL = r'D:\satker asal\website pa bungku\xampp\mysql\bin\mysql.exe'
NONKONSTAN = True
DUMMY = {'8554': 'Majelis Hakim', '0046': 'Penggugat', '0047': 'Tergugat', '9302': 'anak', '9304': 'Fulan bin Fulan', '9759': 'ibu kandung',
         '0104': 'wiraswasta', '5271': 'berpenghasilan Rp2.000.000,00 sebulan', '7037': 'Tergugat'}


def lit(s):
    return "'" + s.replace(chr(92), chr(92) * 2).replace("'", "''") + "'"


def siapkan(sql, isian=None, petitum='', pid='1', dummy=None):
    s = sql
    isian = isian or {}
    for n in sorted(set(int(x) for x in re.findall(r'no_var = (\d+)', s))):
        nilai = isian.get(n, '')
        # sanitasi sama dengan fragmen: tanda petik dan garis miring
        nilai = nilai.replace(chr(92), '/').replace('"', '&quot;').replace("'", '&#39;').strip().rstrip(';').strip()
        s = s.replace(H.I(n), '(SELECT CONVERT(v USING utf8) FROM (SELECT %s AS v) tt LIMIT 1)' % lit(nilai) if NONKONSTAN else lit(nilai))
    s = s.replace(H.PET, lit(petitum.lower()))
    s = s.replace('#perkara_id#', pid)
    d = dict(DUMMY)
    d.update(dummy or {})
    s = re.sub(r'#(\d{4})#', lambda m: d.get(m.group(1), '{%s}' % m.group(1)), s)
    return s


def jalan_lokal(sql, db='sipp_donggala'):
    r = subprocess.run([MYSQL, '-h', '127.0.0.1', '-u', 'root', '--default-character-set=utf8', '-N', '-B', db], input=sql.encode('utf-8'), capture_output=True)
    return r.returncode, r.stdout.decode('utf-8', 'replace').strip(), r.stderr.decode('utf-8', 'replace').strip()


def jalan_server(sql):
    r = subprocess.run(['ssh', '-o', 'ConnectTimeout=25', 'aleta', 'bash /root/lihat-jejak.sh "$(cat)"'], input=sql.encode('utf-8'), capture_output=True, timeout=180)
    return (r.stdout.decode('utf-8', 'replace') + r.stderr.decode('utf-8', 'replace')).strip()


def var(no):
    return [v for v in VAR if v['no'] == no][0]


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    no = int(sys.argv[1])
    isian = {}
    for a in sys.argv[2:]:
        if a.startswith('pet='):
            continue
        k, v = a.split('=', 1)
        isian[int(k)] = v
    pet = [a[4:] for a in sys.argv[2:] if a.startswith('pet=')]
    q = siapkan(var(no)['sql'], isian, pet[0] if pet else '')
    print(jalan_lokal(q))
