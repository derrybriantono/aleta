# -*- coding: utf-8 -*-
"""Uji render ABT asli (salinan vs30/abt, sipp_vs + aps_badilag_vs) untuk rumus 8507: rumus lama, percobaan spasi akhir, rumus paket; perkara prodeo dan non-prodeo.
Tiga pola penanda: #8507#Bahwa, "#8507# Bahwa", #8507#}. RTF hasil (data perkara) di luar repo; ringkasan tanpa data pihak.
pakai: python -B alat/uji_render.py <akar pohon> <keluar rtf> <paket-satker> <hasil txt>"""
import concurrent.futures as cf
import hashlib
import importlib.util
import os
import re
import subprocess
import sys

SINI = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location('render_abt', os.path.join(SINI, '..', '..', 'a5-merah-5nov', 'alat', 'render_abt.py'))
ra = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ra)
sys.path.insert(0, os.path.join(SINI, '..', '..', 'a5-merah-5nov', 'sumber'))
import rtfmini  # noqa: E402

BIN = os.environ.get('MYSQL_BIN', r'D:\satker asal\website pa bungku\xampp\mysql\bin')
MY = os.path.join(BIN, 'mysql.exe')
N = 'abt-prodeo-8507-5nov'
PERKARA = {'CG': (10246, 10126), 'CT': (8739, 10139), 'IN': (9554, 10276), 'ANAK': (10246, 10126), 'WARIS': (10246, 10126), 'IN2': (9554, 10276)}
# prodeo di salinan hanya cerai, DK, itsbat: blangko jenis lain dirender atas perkara cerai sebagai pengganti (bentuk penandanya yang diuji)
FOLDER = {'CG': '1 Perceraian CG', 'CT': '1a Perceraian CT', 'IN': '2 Itsbat Nikah', 'ANAK': '6a Hak Asuh Anak (Hadhanah)', 'WARIS': '4b Kewarisan', 'IN2': '2a Itsbat Nikah Kontensius'}
POLA = [('Bahwa', b'#8507#Bahwa'), ('spasi', b'#8507# '), ('kurung', b'#8507#}')]
SESUAI = re.compile(r'cuma-cuma;')


def q(sql=None, berkas=None):
    data = open(berkas, 'rb').read() if berkas else sql.encode('latin1')
    r = subprocess.run([MY, '-h', '127.0.0.1', '-u', 'root', '--default-character-set=latin1', '-N', '-B', '-r', 'aps_badilag_vs'], input=data, capture_output=True)
    if r.returncode:
        raise SystemExit('GALAT SQL: ' + r.stderr.decode('latin1')[:400])
    return r.stdout.decode('latin1').replace('\r', '').strip()


def pilih(akar):
    t = []
    for j, fol in FOLDER.items():
        d = os.path.join(akar, 'derry_briantono', fol)
        ada = {k: [] for k, _ in POLA}
        for f in sorted(os.listdir(d)):
            if not f.endswith('.rtf'):
                continue
            b = open(os.path.join(d, f), 'rb').read()
            for k, pol in POLA:
                if pol in b:
                    ada[k].append(f)
        for k in ada:
            for f in ada[k][:2]:
                t.append((j, k, fol + '/' + f))
    return t


def jalan(a):
    tahap, no, j, k, rel, akar, keluar, jenis, pid = a
    o = os.path.join(keluar, '%s-%03d-%s.rtf' % (tahap, no, jenis))
    if not os.path.exists(o):
        ra.render(os.path.join(akar, 'derry_briantono', rel), pid, o, '%s%03d%s' % (tahap, no, jenis))
    return o


def semua(tahap, tugas, akar, keluar):
    kerja = []
    for no, (j, k, rel) in enumerate(tugas):
        for jenis, pid in zip(('prodeo', 'non'), PERKARA[j]):
            kerja.append((tahap, no, j, k, rel, akar, keluar, jenis, pid))
    with cf.ThreadPoolExecutor(3) as ex:
        list(ex.map(jalan, kerja))
    print('selesai', tahap, len(kerja), flush=True)


def potong(p):
    b = open(p, 'rb').read()
    pr = rtfmini.urai(b)['paragraf']
    i = [n for n, x in enumerate(pr) if 'cuma-cuma;' in x and 'prodeo' in x]
    if not i:
        return b, pr, None, None
    return b, pr, pr[i[0]], pr[i[0] + 1] if i[0] + 1 < len(pr) else ''


def akhir(s):
    return s[-50:] if s else ''


def main():
    akar, keluar, paket, hasil = sys.argv[1:5]
    os.makedirs(keluar, exist_ok=True)
    tugas = pilih(akar)
    print(len(tugas), 'berkas', flush=True)
    awal = q("SELECT MD5(sql_query) FROM abt_variabel WHERE no_var = 8507")
    if awal != '0a3a264a0310d50d6d71bc6b5fc66c80':
        raise SystemExit('rumus awal basis uji tidak dikenal: ' + awal)
    semua('lama', tugas, akar, keluar)
    # percobaan: spasi akhir saja (usulan awal)
    q("UPDATE abt_variabel SET sql_query = REPLACE(sql_query, 'cuma-cuma;<br>\")', 'cuma-cuma;<br> \")'), modified = modified WHERE no_var = 8507")
    semua('spasi', tugas[:2], akar, keluar)
    q("UPDATE abt_variabel SET sql_query = REPLACE(sql_query, 'cuma-cuma;<br> \")', 'cuma-cuma;<br>\")'), modified = modified WHERE no_var = 8507")
    if q("SELECT MD5(sql_query) FROM abt_variabel WHERE no_var = 8507") != awal:
        raise SystemExit('rumus percobaan tidak kembali')
    q(berkas=os.path.join(paket, N + '-PASANG.sql'))
    semua('baru', tugas, akar, keluar)
    q(berkas=os.path.join(paket, N + '-PULIH.sql'))
    if q("SELECT MD5(sql_query) FROM abt_variabel WHERE no_var = 8507") != awal:
        raise SystemExit('rumus tidak kembali')
    baris = ['Render ABT asli. Lama = rumus lama, baru = rumus paket. "lanjutan" = paragraf sesudah kalimat prodeo. Ringkasan tanpa data pihak.',
             'pola\tjenis\tperkara\tberkas\tsisa #NNNN#\tkalimat prodeo lama berakhir\tlanjutan lama\tkalimat prodeo baru berakhir\tlanjutan baru\tparagraf lama->baru\tteks lain beda\tnon-prodeo sama persis (bita)']
    gagal = 0
    for no, (j, k, rel) in enumerate(tugas):
        f = lambda t, je: os.path.join(keluar, '%s-%03d-%s.rtf' % (t, no, je))  # noqa: E731,B023
        b0, p0, k0, l0 = potong(f('lama', 'prodeo'))
        b1, p1, k1, l1 = potong(f('baru', 'prodeo'))
        n0 = open(f('lama', 'non'), 'rb').read()
        n1 = open(f('baru', 'non'), 'rb').read()
        sama = n0 == n1
        sisa = len(re.findall(r'#\d{3,5}#', ' '.join(p1)))
        # prodeo: selain kalimat prodeo + lanjutannya, teks lain harus sama
        lain = [x for x in p0 if x not in (k0,)] != [x for x in p1 if x not in (k1, l1)] and k == 'Bahwa'
        if k != 'Bahwa':
            lain = p0 != p1
        ok = sama and sisa == 0 and not lain and k1 is not None
        if k == 'Bahwa':
            ok = ok and l1.startswith('Bahwa') and not re.search(r'cuma-cuma;\s*,', k1)
        gagal += 0 if ok else 1
        pot = lambda s: re.sub(r'\s+', ' ', (s or '')[:32])  # noqa: E731
        baris.append('\t'.join([k, j, str(PERKARA[j][0]) + '/' + str(PERKARA[j][1]), rel, str(sisa), akhir(k0).replace('\t', ' '), pot(l0), akhir(k1).replace('\t', ' '), pot(l1), '%d->%d' % (len(p0), len(p1)), 'ya' if lain else 'tidak', 'ya' if sama else 'TIDAK']))
    baris.append('GAGAL\t%d' % gagal)
    baris.append('')
    baris.append('Percobaan spasi akhir pada rumus (<br> + spasi), dua berkas pertama, perkara prodeo: trim() ABT membuang spasinya.')
    for no, (j, k, rel) in enumerate(tugas[:2]):
        b, p, ks, ls = potong(os.path.join(keluar, 'spasi-%03d-prodeo.rtf' % no))
        baris.append('%s\t%s\t\\parBahwa ada: %s\tkalimat berakhir: %s' % (k, rel, b'\\parBahwa' in b, akhir(ks).replace('\t', ' ')))
    open(hasil, 'w', encoding='utf-8', newline='\n').write('\n'.join(baris) + '\n')
    print('GAGAL', gagal)


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    main()
