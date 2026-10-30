# -*- coding: utf-8 -*-
"""6.3 - golongkan variabel data_sql Derry yang KOSONG di semua sampel yang sudah dirender (keluaran pindai_kosong.py di folder render).

pakai: python analisa_kosong.py <pakai.json> <sampel.tsv> <folder render (k_<perkara>_<sidang>.txt)> <basis ABT> <keluar.txt>
Golongan (dari nama + kueri; diberi tanda "keputusan sementara" bila hanya dari pola):
  bersyarat-keadaan   variabel yang memang hanya terisi bila keadaannya ada (kuasa, pihak ke-n, penggantian/cuti, sidang lanjutan, eksepsi,
                      rekonvensi, banding, verzet, ikrar, mediasi, sita, pemeriksaan setempat, intervensi, e-Court, prodeo, ...)
  isian-petugas       kueri membaca isian ABT (abt_data_teks) yang belum diisi di sampel - terisi setelah petugas mengisi
  jenis-lain          variabel hanya dipakai folder blangko yang jenis perkaranya tidak ada di sampel
  perlu-ditinjau      selain itu - dibaca manual (lihat keluar.txt)
"""
import collections
import json
import os
import re
import subprocess
import sys

MYSQL = r'D:\Satker Asal\Website PA Bungku\xampp\mysql\bin\mysql.exe'
SYARAT = re.compile(r'KE-?\s?[2-9]|DST|KUASA|PENGGANTI|CUTI|SEBELUMNYA|LANJUTAN|EKSEPSI|REKONVENSI|BANDING|VERZET|PERLAWANAN|IKRAR|MEDIASI|SITA|SETEMPAT|'
                    r'INTERVENSI|E-?COURT|ELEKTRONIK|PRODEO|GHAIB|DELEGASI|SUMPAH|PROVISI|PENCABUTAN|CABUT|GUGUR|CORET|KUMULASI|POLIGAMI|PNS|PPPK|TNI|POLRI|'
                    r'BUMN|ANAK KE|SAKSI KE|SAKSI [3-9]|BUKTI KE|TAMBAHAN|APABILA|BILA|JIKA|KOSONG|\b(II|III|IV|V|VI|VII|VIII|IX|X)\b', re.I)


def jenis_folder(f):
    pola = [(r'^1 Perceraian CG|^1[c-f] ', 'Cerai Gugat'), (r'^1a ', 'Cerai Talak'), (r'^2', 'Istbat'), (r'^3 ', 'Dispensasi'), (r'^4a', 'Harta Bersama'),
            (r'^4b', 'Kewarisan'), (r'^4c', 'Wasiat'), (r'^6', 'Perwalian'), (r'^7', 'Wali Adhol'), (r'^8', 'Asal Usul'), (r'^9 ', 'P3HP'), (r'^10', 'Ekonomi Syariah'),
            (r'^5|^3a', 'Poligami')]
    for p, j in pola:
        if re.match(p, f):
            return j
    return None


def main():
    pakai = json.load(open(sys.argv[1], encoding='utf-8'))
    sampel = [l.rstrip('\n').split('\t') for l in open(sys.argv[2], encoding='utf-8') if l.strip()]
    folder, db, kel = sys.argv[3:6]
    q = "SELECT no_var, HEX(IFNULL(sql_query, '')), IFNULL(modifier, '') FROM abt_variabel WHERE data_type = 'data_sql'"
    r = subprocess.run([MYSQL, '-h127.0.0.1', '-uroot', '-N', db, '-e', q], capture_output=True, check=True)
    sql = {}
    for l in r.stdout.decode('latin1').splitlines():
        no, h, mod = l.split('\t')
        sql[no.zfill(4)] = (bytes.fromhex(h).decode('latin1'), mod)
    kode = sorted((k for k, v in pakai.items() if v['jenis'] == 'data_sql'), key=int)
    terisi = collections.Counter()
    dirender = []
    for pid, sd, label in sampel:
        p = os.path.join(folder, 'k_%s_%s.txt' % (pid, sd or '0'))
        if not os.path.exists(p):
            continue
        dirender.append(label)
        teks = open(p, encoding='utf-8').read()
        bag = re.split(r'@@(\d{4,5}|AKHIR)@@', teks)
        nilai = {bag[i]: bag[i + 1] for i in range(1, len(bag) - 1, 2)}
        for k in kode:
            v = re.sub(r'\s+', ' ', nilai.get(k, '')).strip()
            if v not in ('', '...'):
                terisi[k] += 1
    jenis_sampel = ' '.join(dirender)
    gol = collections.defaultdict(list)
    for k in kode:
        if terisi[k]:
            continue
        v = pakai[k]
        s, mod = sql.get(k, ('', ''))
        if mod != 'admin':
            continue  # hanya variabel Derry (modifier admin)
        js = {jenis_folder(f) for f in v.get('folder', [])}
        if js and None not in js and not any(j and j.split()[0] in jenis_sampel for j in js):
            g = 'jenis-lain'
        elif SYARAT.search(v['nama']):
            g = 'bersyarat-keadaan'
        elif 'abt_data_teks' in s or 'abt_keterangan' in s:
            g = 'isian-petugas'
        else:
            g = 'perlu-ditinjau'
        gol[g].append((k, v['blangko'], v['nama'][:110], ', '.join(v.get('folder', [])[:3])))
    with open(kel, 'w', encoding='utf-8', newline='\n') as o:
        o.write('6.3 variabel data_sql Derry yang KOSONG di semua %d sampel yang dirender (%s)\n' % (len(dirender), '; '.join(dirender)))
        o.write('Golongan dari nama + kueri = KEPUTUSAN SEMENTARA (tidak ada variabel yang dihapus atau diubah).\n\n')
        for g in ('perlu-ditinjau', 'isian-petugas', 'bersyarat-keadaan', 'jenis-lain'):
            o.write('== %s: %d\n' % (g, len(gol[g])))
            for k, n, nm, f in sorted(gol[g], key=lambda x: -x[1]):
                o.write('%s | %d blangko | %s | %s\n' % (k, n, nm, f))
            o.write('\n')
    print('sampel', len(dirender), ' '.join('%s=%d' % (g, len(x)) for g, x in gol.items()), 'total', sum(len(x) for x in gol.values()))


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    main()
