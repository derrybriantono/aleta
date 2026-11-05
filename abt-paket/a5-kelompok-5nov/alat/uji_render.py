# -*- coding: utf-8 -*-
"""Uji render ABT asli paket a5-kelompok-5nov: semua berkas paket, keadaan TIDAK (isian belum diisi, bawaan tidak dipakai) dan PAKAI (semua pilihan pakai + nilai rekaan), dibanding keadaan a5-merah.
Harta Bersama juga dirender atas perkara dengan dan tanpa kuasa Tergugat; isian panjang 12180-12182 diuji kosong (tercetak "...") dan berisi beberapa paragraf. Keluaran RTF (data perkara) di luar repo; ringkasan tanpa data pihak.
Baris uji di abt_data_teks diberi modifier 'uji' dan dihapus sesudahnya.
pakai: python -B alat/uji_render.py <akar a5> <akar sesudah> <paket-satker> <keluar> <hasil.txt> [pekerja]"""
import concurrent.futures as cf
import difflib
import importlib.util
import os
import re
import subprocess
import sys

SINI = os.path.dirname(os.path.abspath(__file__))
A5 = os.path.join(SINI, '..', '..', 'a5-merah-5nov')
sys.path.insert(0, os.path.join(A5, 'sumber'))
import rtfmini  # noqa: E402

spec = importlib.util.spec_from_file_location('render_abt', os.path.join(A5, 'alat', 'render_abt.py'))
ra = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ra)
spec = importlib.util.spec_from_file_location('uji_a5', os.path.join(A5, 'alat', 'uji_render.py'))
ua = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ua)
MY = os.path.join(os.environ.get('MYSQL_BIN', r'D:\satker asal\website pa bungku\xampp\mysql\bin'), 'mysql.exe')

PILIH = [12150, 12152, 12154, 12156, 12158, 12160, 12162, 12164]
NILAI = {12167: 'REKAAN-angka-empat', 12168: 'REKAAN-angka-satu', 12169: 'REKAAN-kode-bukti', 12170: 'REKAAN-lama-satu', 12171: 'REKAAN-lama-dua', 12172: 'REKAAN-kelas',
         12173: 'REKAAN-anak-satu', 12174: 'REKAAN-anak-dua', 12175: 'REKAAN-sebutan-satu', 12176: 'REKAAN-sebutan-dua', 12178: 'REKAAN-keadaan', 12179: 'REKAAN-tanggal-cerai',
         9285: 'REKAAN-romawi', 9287: 'REKAAN-pasangan', 9288: 'REKAAN-suami', 9289: 'REKAAN-dalil',
         # isian panjang Harta Bersama (6 Nov): beberapa paragraf, dipisah baris baru
         12180: 'REKAAN-saksi paragraf satu\nREKAAN-saksi paragraf dua', 12181: 'REKAAN-bukti satu paragraf',
         12182: 'REKAAN-objek paragraf satu\nREKAAN-objek paragraf dua\nREKAAN-objek paragraf tiga'}
TANPA_KUASA, ADA_KUASA = 9789, 10025


def q(sql):
    r = subprocess.run([MY, '-h', '127.0.0.1', '-u', 'root', '--default-character-set=latin1', '-N', '-B', 'aps_badilag_vs'], input=sql.encode('latin1'), capture_output=True)
    if r.returncode:
        raise SystemExit(r.stderr.decode('latin1')[:300])
    return r.stdout.decode('latin1').replace('\r', '').strip()


def isi(perkara):
    baris = []
    for pid in perkara:
        ada = set(q('SELECT no_var FROM abt_data_teks WHERE perkara_id = %d' % pid).split())
        for v in PILIH:
            if str(v) not in ada and '%04d' % v not in ada:
                baris.append("(%d,%d,'pakai','uji')" % (v, pid))
        for v, x in NILAI.items():
            if str(v) not in ada and '%04d' % v not in ada:
                baris.append("(%d,%d,'%s','uji')" % (v, pid, x))
    q('INSERT INTO abt_data_teks (no_var, perkara_id, data, modifier) VALUES ' + ','.join(baris))


def hapus():
    q("DELETE FROM abt_data_teks WHERE modifier = 'uji' AND (data = 'pakai' OR data LIKE 'REKAAN-%')")


def teks(p):
    b = open(p, 'rb').read()
    u = rtfmini.urai(b)
    return b, u['paragraf'], [m for m in u['merah'] if len(m.strip()) >= 2]


def beda(a, b):
    w0, w1 = ' '.join(a).split(), ' '.join(b).split()
    keluar = []
    for tag, i1, i2, j1, j2 in difflib.SequenceMatcher(None, w0, w1, autojunk=False).get_opcodes():
        if tag != 'equal':
            keluar.append((' '.join(w0[i1:i2]), ' '.join(w1[j1:j2])))
    return keluar


def kerja(a):
    kode, rel, pid, sumber, keluar, keadaan = a
    o = os.path.join(keluar, '%s-%s-%d.rtf' % (kode, keadaan, pid))
    if not os.path.exists(o):
        ra.render(sumber, pid, o, '%s%s%d' % (kode, keadaan, pid))
    return o


def main():
    akar_a5, sesudah, paket, keluar, hasil = sys.argv[1:6]
    n = int(sys.argv[6]) if len(sys.argv) > 6 else 3
    os.makedirs(keluar, exist_ok=True)
    tugas = []
    for l in open(os.path.join(paket, 'daftar-tambal.tsv'), encoding='utf-8'):
        if l.startswith('#') or not l.strip():
            continue
        kode, rel = l.split('\t')[:2]
        rr = rel[len('derry_briantono/'):]
        pp = [ua.perkara(rr)] if not rr.startswith('3 ') else [10261]
        if rr.startswith('4a Harta Bersama/'):
            pp = [ADA_KUASA, TANPA_KUASA]
        if rr.startswith('2 Itsbat Nikah/[99aa]'):
            pp = [10276]
        tugas.append((kode, rr, pp))
    perkara = sorted({p for _, _, pp in tugas for p in pp})
    hapus()
    jobs = []
    for kode, rr, pp in tugas:
        for pid in pp:
            jobs.append((kode, rr, pid, os.path.join(sesudah, 'derry_briantono', rr), keluar, 'tidak'))
            jobs.append((kode, rr, pid, os.path.join(akar_a5, 'derry_briantono', rr), keluar, 'a5'))
    with cf.ThreadPoolExecutor(n) as ex:
        list(ex.map(kerja, jobs))
    print('tahap tidak selesai', flush=True)
    isi(perkara)
    try:
        jobs = [(kode, rr, pid, os.path.join(sesudah, 'derry_briantono', rr), keluar, 'pakai') for kode, rr, pp in tugas for pid in pp]
        with cf.ThreadPoolExecutor(n) as ex:
            list(ex.map(kerja, jobs))
    finally:
        hapus()
    print('tahap pakai selesai', flush=True)
    baris = ['Render ABT asli: keadaan a5 (sebelum paket), tidak (isian belum diisi), pakai (semua pilihan pakai + nilai rekaan). Tanpa data pihak.',
             'kode\tperkara\tsisa#NNNN# tidak/pakai\tpar a5/tidak/pakai\tpar kosong a5/tidak/pakai\tmerah>=2 a5/tidak/pakai\tberkas']
    rinci = []
    gagal = 0
    for kode, rr, pp in tugas:
        for pid in pp:
            f = lambda k: os.path.join(keluar, '%s-%s-%d.rtf' % (kode, k, pid))  # noqa: E731,B023
            b0, p0, m0 = teks(f('a5'))
            b1, p1, m1 = teks(f('tidak'))
            b2, p2, m2 = teks(f('pakai'))
            sisa1 = len(re.findall(rb'#\d{3,5}#', b1))
            sisa2 = len(re.findall(rb'#\d{3,5}#', b2))
            ks = lambda p: sum(1 for x in p if not x.strip())  # noqa: E731
            if sisa1 or sisa2 or ks(p1) > ks(p0) or ks(p2) > ks(p0):
                gagal += 1
            baris.append('%s\t%d\t%d/%d\t%d/%d/%d\t%d/%d/%d\t%d/%d/%d\t%s' % (kode, pid, sisa1, sisa2, len(p0), len(p1), len(p2), ks(p0), ks(p1), ks(p2), len(m0), len(m1), len(m2), rr))
            rinci.append('%s %s perkara %d' % (kode, rr, pid))
            rinci.append(' a5 => pakai:')
            for x, y in beda(p0, p2):
                rinci.append('   %s  =>  %s' % (x[:110], y[:110]))
            rinci.append(' pakai => tidak (yang hilang saat tidak dipakai, ringkas):')
            for x, y in beda(p2, p1):
                rinci.append('   %s ... %s  =>  %s' % (x[:60], x[-40:], y[:70]))
    baris.append('GAGAL\t%d' % gagal)
    open(hasil, 'w', encoding='utf-8', newline='\n').write('\n'.join(baris + [''] + rinci) + '\n')
    print('GAGAL', gagal)


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    main()
