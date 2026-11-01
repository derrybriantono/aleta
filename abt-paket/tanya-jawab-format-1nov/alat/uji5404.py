# -*- coding: utf-8 -*-
import subprocess, sys
sys.path.insert(0, 'D:/aleta-dev/wt/w164/abt-paket/tanya-jawab-format-1nov/sumber')
import importlib, kueri_5404
importlib.reload(kueri_5404)
MYSQL = r'D:\Satker Asal\Website PA Bungku\xampp\mysql\bin\mysql.exe'


def jalan(sql, db='sipp_w164'):
    r = subprocess.run([MYSQL, '-h127.0.0.1', '-uroot', '-N', '--raw', '--default-character-set=utf8', db], input=sql.encode('latin1'), capture_output=True)
    return r.stdout.decode('latin1'), r.stderr.decode('latin1')


def kueri_untuk(pid, tgl, prev):
    q = kueri_5404.kueri()
    return q.replace('#perkara_id#', str(pid)).replace('#0033#', tgl).replace('#6091#', prev or '').replace('#6034#', 'Panitera Pengganti')


if __name__ == '__main__':
    pid, tgl, prev = sys.argv[1], sys.argv[2], (sys.argv[3] if len(sys.argv) > 3 else '')
    o, e = jalan(kueri_untuk(pid, tgl, prev))
    print(o or '(kosong)')
    print(e[:1500])
