# -*- coding: utf-8 -*-
"""Atur isian uji di DB uji aps_badilag_u2 (abt_data_teks). Pakai sebagai modul: atur(pid, {no: teks}); bersihkan(pid, [no])."""
import subprocess
MYSQL = r'D:\Satker Asal\Website PA Bungku\xampp\mysql\bin\mysql.exe'
DB = 'aps_badilag_u2'


def _jalan(sql):
    r = subprocess.run([MYSQL, '-uroot', '--default-character-set=latin1', DB], input=sql.encode('latin1'), capture_output=True)
    if r.returncode:
        raise SystemExit(r.stderr.decode('utf-8', 'replace')[:500])
    return r.stdout.decode('utf-8', 'replace')


def atur(pid, isian):
    st = []
    for no, teks in isian.items():
        st.append("REPLACE INTO abt_data_teks (no_var, perkara_id, data, modifier) VALUES (%d, %d, 0x%s, 'uji');" % (int(no), int(pid), teks.encode('latin1').hex()))
    _jalan('\n'.join(st))


def bersihkan(pid, nomor):
    _jalan("DELETE FROM abt_data_teks WHERE perkara_id=%d AND no_var IN (%s);" % (int(pid), ','.join(str(int(n)) for n in nomor)))
