# -*- coding: utf-8 -*-
"""Bangun paket abt-audit-mekanis-4nov dari pohon blangko keadaan server (sesudah saksi-rapi + in-lupa-prosesi + ijab).
pakai: python -B bangun_paket.py <akar _blangko_abt (memuat derry_briantono/)> <paket-satker> <hasil>
- aturan.py: aturan K01/K06/K07/K09/K13 (regex atas teks tampak); S01 di bawah (penanda saksi ke-1 di identitas saksi ke-2).
- Tiap ubahan huruf dipetakan ke bita RTF (rtfpeta.py); hanya huruf harfiah yang disentuh; kode RTF di antaranya tetap.
- Pemeriksaan per berkas (BERHENTI bila gagal): teks tampak baru = teks lama dengan ubahan yang dimaksud PERSIS; kurung seimbang;
  jumlah penanda #NNNN# sama (S01: #1241#/#1202# berkurang sebanyak #1242#/#1208# bertambah); tidak ada kata nama aplikasi."""
import base64
import csv
import difflib
import hashlib
import os
import re
import sys

SINI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, SINI)
from rtfpeta import peta, kurung_seimbang  # noqa: E402
from aturan import DIKOMPILASI, pengganti  # noqa: E402

PENANDA = re.compile(r'#\d{4,5}#')
NAMA_SAKSI = re.compile(r'#(1197|1203)#')
# S01: identitas/hubungan saksi ke-2 (nama #1203#) yang memakai variabel saksi ke-1 -> variabel saksi ke-2 (katalog server 3 Nov:
# 1241/1242 = Hbgn. Saksi1/Saksi2 P dg. Pihak; 1202/1208 = Alamat Saksi 1/2 P). Padanan: 242 + 10 + 580 tempat saksi ke-2 di blangko lain.
S01 = re.compile(r'(?:saksi mengaku sebagai|karena saya adalah) #1241#|bertempat tinggal di #1202#')
S01_GANTI = {'#1241#': '#1242#', '#1202#': '#1208#'}


def md5b(b):
    return hashlib.md5(b).hexdigest()


def cari(teks, pilih):
    """-> [(awal, akhir, kode, jenis, lama, baru)] urut, tanpa tumpang"""
    hasil = []
    for k, j, rx, g, t in DIKOMPILASI:
        if k not in pilih:
            continue
        for m in rx.finditer(teks):
            hasil.append((m.start(), m.end(), k, j, m.group(0), pengganti(m.group(0), g, t)))
    for m in (S01.finditer(teks) if 'S01' in pilih else []):
        nama = [x for x in NAMA_SAKSI.finditer(teks, 0, m.start())]
        if nama and nama[-1].group(1) == '1203':
            lama = m.group(0)
            v = lama[-6:]
            hasil.append((m.start(), m.end(), 'S01', 'saksi2-' + v.strip('#'), lama, lama[:-6] + S01_GANTI[v]))
    hasil.sort()
    for a, b in zip(hasil, hasil[1:]):
        if b[0] < a[1]:
            raise SystemExit('TUMPANG %r %r' % (a, b))
    return hasil


def potong(b, pos, a, z, lama, baru):
    """ubahan huruf lama->baru pada teks[a:z] -> (offset, bita lama, bita baru)"""
    o0 = pos[a][0]
    o1 = pos[z - 1][0] + pos[z - 1][1]
    seg = bytearray(b[o0:o1])
    ops = []  # (offset relatif, panjang hapus, sisip)
    for tag, i1, i2, j1, j2 in difflib.SequenceMatcher(None, lama, baru, autojunk=False).get_opcodes():
        if tag == 'equal':
            continue
        s = baru[j1:j2].encode('ascii')
        if tag == 'insert':
            assert i1 > 0, 'sisip di awal'
            p = pos[a + i1 - 1]
            assert p[2], 'bukan harfiah'
            ops.append((p[0] + 1 - o0, 0, s))
            continue
        for n, i in enumerate(range(i1, i2)):
            p = pos[a + i]
            assert p[2] and p[1] == 1 and b[p[0]:p[0] + 1] == lama[i].encode('ascii'), 'bukan harfiah'
            ops.append((p[0] - o0, 1, s if n == 0 else b''))
    for off, n, s in sorted(ops, key=lambda x: -x[0]):
        seg[off:off + n] = s
    return o0, bytes(b[o0:o1]), bytes(seg)


def main():
    akar, keluar, hasil_dir = sys.argv[1], sys.argv[2], sys.argv[3]
    # paket audit-mekanis-4nov: K01,K06,K09,K13,S01 awalan M; paket audit-ejaan-4nov: K07 awalan E (atas pohon SESUDAH audit-mekanis)
    pilih = set((sys.argv[4] if len(sys.argv) > 4 else 'K01,K06,K09,K13,S01').split(','))
    awalan = sys.argv[5] if len(sys.argv) > 5 else 'M'
    dasar = os.path.join(akar, 'derry_briantono')
    berkas = []
    for d, _, fs in os.walk(dasar):
        for f in fs:
            if f.lower().endswith('.rtf'):
                berkas.append(os.path.relpath(os.path.join(d, f), akar).replace('\\', '/'))
    berkas.sort()
    daftar, tambal, csvb, ringkas = [], [], [], {}
    no = 0
    for rel in berkas:
        b = open(os.path.join(akar, rel), 'rb').read()
        teks, pos = peta(b)
        temu = cari(teks, pilih)
        if not temu:
            continue
        no += 1
        kode = '%s%04d' % (awalan, no)
        pot = []
        harap = teks
        for a, z, k, j, lama, baru in reversed(temu):
            pot.append(potong(b, pos, a, z, lama, baru))
            harap = harap[:a] + baru + harap[z:]
        pot.sort()
        h = b
        for off, l0, l1 in sorted(pot, key=lambda x: -x[0]):
            assert h[off:off + len(l0)] == l0
            h = h[:off] + l1 + h[off + len(l0):]
        # --- pemeriksaan
        t2, _ = peta(h)
        if t2 != harap:
            raise SystemExit('TEKS BEDA %s' % rel)
        if not kurung_seimbang(h) or kurung_seimbang(b) != kurung_seimbang(h):
            raise SystemExit('KURUNG %s' % rel)
        p0 = sorted(PENANDA.findall(teks))
        p1 = sorted(PENANDA.findall(t2))
        harap_p = list(p0)
        for x in temu:
            if x[2] == 'S01':
                harap_p.remove(x[4][-6:])
                harap_p.append(x[5][-6:])
        if sorted(harap_p) != p1:
            raise SystemExit('PENANDA %s' % rel)
        if PENANDA.findall(b.decode('latin1')).__len__() != PENANDA.findall(h.decode('latin1')).__len__():
            raise SystemExit('PENANDA MENTAH %s' % rel)
        if re.search(rb'(?i)aleta', h) and not re.search(rb'(?i)aleta', b):
            raise SystemExit('NAMA APLIKASI %s' % rel)
        daftar.append((kode, rel, md5b(b), md5b(h), len(pot)))
        for off, l0, l1 in pot:
            tambal.append((kode, off, base64.b64encode(l0).decode(), base64.b64encode(l1).decode()))
        for a, z, k, j, lama, baru in temu:
            kon0 = teks[max(0, a - 50):z + 50].replace('\n', ' / ').replace('\t', ' ')
            csvb.append((rel[len('derry_briantono/'):], k, j, lama, baru, kon0))
            r = ringkas.setdefault((k, j), [0, set()])
            r[0] += 1
            r[1].add(rel)
    if not os.path.isdir(keluar):
        os.makedirs(keluar)
    with open(os.path.join(keluar, 'daftar-tambal.tsv'), 'w', encoding='utf-8', newline='\n') as f:
        dasar_ket = 'sesudah paket audit-mekanis-4nov' if awalan == 'E' else 'server 3 Nov sesudah saksi-rapi + in-lupa-prosesi + ijab-yang-menikahkan'
        f.write('# kode\tberkas\tmd5_lama (%s)\tmd5_baru\tpotongan\n' % dasar_ket)
        for d in daftar:
            f.write('%s\t%s\t%s\t%s\t%d\n' % d)
    with open(os.path.join(keluar, 'tambal.tsv'), 'w', encoding='utf-8', newline='\n') as f:
        f.write('# kode\toffset\tb64(teks lama)\tb64(teks baru)\n')
        for t in tambal:
            f.write('%s\t%d\t%s\t%s\n' % t)
    if not os.path.isdir(hasil_dir):
        os.makedirs(hasil_dir)
    with open(os.path.join(hasil_dir, 'daftar-tambalan.csv'), 'w', encoding='utf-8-sig', newline='') as f:
        w = csv.writer(f)
        w.writerow(['berkas', 'temuan', 'tambalan', 'sebelum', 'sesudah', 'konteks sebelum'])
        w.writerows(csvb)
    with open(os.path.join(hasil_dir, 'ringkas.txt'), 'w', encoding='utf-8', newline='\n') as f:
        for (k, j), (n, s) in sorted(ringkas.items()):
            f.write('%s\t%s\t%d kali\t%d berkas\n' % (k, j, n, len(s)))
        f.write('BERKAS %d POTONGAN %d\n' % (len(daftar), len(tambal)))
    print('BERKAS %d POTONGAN %d' % (len(daftar), len(tambal)))


if __name__ == '__main__':
    main()
