# -*- coding: utf-8 -*-
"""Uji isian baru terisi: nilai rekaan disimpan sementara di aps_badilag_vs.abt_data_teks, render ABT asli, lalu baris uji dihapus. Hasil: potongan kalimat di sekitar nilai rekaan, warna hitam.
pakai: python -B alat/uji_isian.py <akar sesudah> <keluar rtf> <hasil txt>"""
import os
import re
import subprocess
import sys

SINI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, SINI)
sys.path.insert(0, os.path.join(SINI, '..', 'sumber'))
import merahpos as mp  # noqa: E402
from render_abt import render  # noqa: E402

MY = os.path.join(os.environ.get('MYSQL_BIN', r'D:\satker asal\website pa bungku\xampp\mysql\bin'), 'mysql.exe')
UJI = [
    (10177, '1 Perceraian CG - BAS/BAS ALUR 09 [2] BAS Putus P Hadir & T Tidak Hadir - NO (Alamat T Salah).rtf', {9284: 'REKAAN-Kepala-Desa'}),
    (10276, '2 Itsbat Nikah/[99] [NO] IN - Masih Terikat Nikah Sebelumnya (Belum Cerai).rtf', {9285: 'REKAAN-I', 9286: 'REKAAN-II', 9287: 'REKAAN-perempuan', 9288: 'REKAAN-suami', 9683: 'REKAAN-keterangan-terikat'}),
    (10276, '2 Itsbat Nikah/[03] [Tolak] IN - Rukun Tidak Terpenuhi (Wali Tidak Sah).rtf', {9294: 'REKAAN-berada-di-luar-kota'}),
    (10139, '1a Perceraian CT/[02] [Kabul] CT - F.rtf', {9289: 'REKAAN-dalil-lain'}),
    (10096, '6 Perwalian/Perwalian Anak oleh ortu kandung Tolak Primer Kabul Subsider.rtf', {9295: 'REKAAN-tanggal-satu', 9296: 'REKAAN-tanggal-dua'}),
]


def q(sql):
    r = subprocess.run([MY, '-h', '127.0.0.1', '-u', 'root', '--default-character-set=latin1', '-N', '-B', 'aps_badilag_vs'], input=sql.encode('latin1'), capture_output=True)
    if r.returncode:
        raise SystemExit(r.stderr.decode('latin1')[:300])
    return r.stdout.decode('latin1').replace('\r', '').strip()


def main():
    akar, keluar, hasil = sys.argv[1:4]
    os.makedirs(keluar, exist_ok=True)
    out = ['Isian baru diisi nilai rekaan (dihapus lagi sesudah uji), render ABT asli. Potongan kalimat; [M] = token nilai ini masih merah.']
    gagal = 0
    for no, (pid, rel, nilai) in enumerate(UJI):
        for v in nilai:
            if q('SELECT COUNT(*) FROM abt_data_teks WHERE no_var=%d AND perkara_id=%d' % (v, pid)) != '0':
                raise SystemExit('perkara uji sudah berisi %d' % v)
        q('INSERT INTO abt_data_teks (no_var, perkara_id, data, modifier) VALUES ' + ','.join("(%d,%d,'%s','uji')" % (v, pid, x) for v, x in nilai.items()))
        try:
            o = os.path.join(keluar, 'terisi-%d.rtf' % no)
            render(os.path.join(akar, 'derry_briantono', rel), pid, o, 'i%d' % no)
        finally:
            q("DELETE FROM abt_data_teks WHERE perkara_id=%d AND modifier='uji' AND data LIKE 'REKAAN-%%'" % pid)
        d = mp.peta(open(o, 'rb').read())
        out.append(rel)
        for v, x in nilai.items():
            hit = 0
            for t in d['toks']:
                if x in t['teks']:
                    hit += 1
                    para = d['para'][t['para']]
                    i = para.find(x)
                    pot = re.sub(r'\s+', ' ', para[max(0, i - 45):i + len(x) + 35])
                    pot = re.sub(r'[A-Z][a-z]+ (bin|binti) [A-Z][a-z]+', 'NAMA', pot)
                    out.append('  #%d%s: ...%s...' % (v, ' [M]' if t['merah'] else '', pot))
                    if t['merah']:
                        gagal += 1
            if not hit:
                gagal += 1
                out.append('  #%d TIDAK TERCETAK' % v)
    out.append('GAGAL\t%d' % gagal)
    out.append('Sisa baris uji: ' + q("SELECT COUNT(*) FROM abt_data_teks WHERE modifier='uji' AND data LIKE 'REKAAN-%'"))
    open(hasil, 'w', encoding='utf-8', newline='\n').write('\n'.join(out) + '\n')
    print('\n'.join(out))


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    main()
