# -*- coding: utf-8 -*-
"""Memeriksa hasil render mesin variabel atas RTF sebelum dan sesudah paket (render_semua.cjs). Tanpa data pihak di keluaran: hanya hitungan lulus/gagal.
pakai: python -B analisa_render.py <folder kerja berisi ring-*.json dan render-*> <hasil/daftar-tambalan.csv> <folder sumber (rtfpatch.py)>"""
import csv
import json
import os
import re
import sys

KERJA = sys.argv[1].replace('\\', '/').rstrip('/') + '/'
CSV = sys.argv[2]
sys.path.insert(0, sys.argv[3])
from rtfpatch import Dok  # noqa: E402

RAPOSTROF = '’'


def muat(label):
    ring = json.load(open(KERJA + 'ring-%s.json' % label, encoding='utf8'))
    hasil = {}
    for r in ring:
        if 'keluar' in r:
            hasil[r['berkas']] = (r, Dok(open(KERJA + 'render-%s/%s' % (label, r['keluar']), 'rb').read()).T)
        else:
            hasil[r['berkas']] = (r, None)
    return hasil


ses = muat('sesudah')
seb = muat('sebelum')
tm = {}
for baris in csv.DictReader(open(CSV, encoding='utf8')):
    b = baris['berkas']
    b = b[len('derry_briantono/'):] if b.startswith('derry_briantono/') else b
    tm.setdefault(baris['temuan'], [])
    if b not in tm[baris['temuan']]:
        tm[baris['temuan']].append(b)

# --- umum ---------------------------------------------------------------------------------------------------------
print('RENDER sesudah: %d berkas, takada %d, galat %d, galat proses %d, marker tersisa %d' % (
    len(ses), sum(1 for r, t in ses.values() if r.get('takada')), sum(1 for r, t in ses.values() if r.get('galat') or r.get('mesinGalat')),
    sum(1 for r, t in ses.values() if r.get('galatProses')), sum(1 for r, t in ses.values() if t and re.search(r'#\d{3,5}#', t))))
print('RENDER sebelum: %d berkas, takada %d, galat %d, galat proses %d' % (
    len(seb), sum(1 for r, t in seb.values() if r.get('takada')), sum(1 for r, t in seb.values() if r.get('galat') or r.get('mesinGalat')), sum(1 for r, t in seb.values() if r.get('galatProses'))))


def paras(t):
    return t.split('\n')


def cek(nama, berkas, fn):
    lulus = 0
    gagal = []
    for b in berkas:
        s = ses.get(b)
        a = seb.get(b)
        if not s or s[1] is None:
            gagal.append(b + ' (tidak dirender)')
            continue
        try:
            ok = fn(s[1], a[1] if a and a[1] is not None else '', b)
        except Exception as e:  # noqa: BLE001
            ok = False
            gagal.append(b + ' (galat %s)' % e)
            continue
        if ok:
            lulus += 1
        else:
            gagal.append(b)
    print('%-8s %d/%d lulus%s' % (nama, lulus, len(berkas), ('  GAGAL: ' + '; '.join(g[:90] for g in gagal[:5])) if gagal else ''))


def ada(t, x):
    return x in t


def jmlpar(t, pola):
    return sum(1 for p in paras(t) if re.search(pola, p))


cek('CT-01', tm.get('CT-01', []), lambda t, a, b: bool(re.search(r'[Mm]emberi izin kepada .{3,200}? untuk menjatuhkan talak satu raj' + RAPOSTROF + r'i terhadap .{3,200}? di depan sidang', t)))
cek('CT-01b', tm.get('CT-01', []), lambda t, a, b: not re.search(r'(?:agar|2\.\t)\s*[Mm]enjatuhkan talak satu ba.in shughra', t))
cek('CT-02a', tm.get('CT-02a', []), lambda t, a, b: 'merupakan istri sah' in t and 'merupakan suami sah' not in t and 'merupakan suami sah' in a)
cek('CT-02b', tm.get('CT-02b', []), lambda t, a, b: ('raj' + RAPOSTROF + 'i terhadap') in t and ('raj' + RAPOSTROF + 'i kepada') not in t and ('raj' + RAPOSTROF + 'i kepada') in a)
cek('CT-03', tm.get('CT-03', []), lambda t, a, b: 'Wanita mana saja' not in t and 'Dikuatkan lagi' not in t and 'Wanita mana saja' in a and 'Dikuatkan lagi' in a)


def cg07(t, a, b):
    def pihak(x, tanda):
        m = re.search(r'bukti %s\.1 dan %s\.2 yang diajukan (.+?) telah diberi meterai' % (tanda, tanda), x)
        return m.group(1).strip() if m else None
    pp, pt = pihak(t, 'P'), pihak(t, 'T')
    ap, at = pihak(a, 'P'), pihak(a, 'T')
    return bool(pp and pt and pp != pt and ap and at and ap == at)


cek('CG-07', tm.get('CG-07', []), cg07)
cek('KW-01', tm.get('KW-01', []), lambda t, a, b: 'sebagaimana dimaksud pada ayat (1), orang tua pihak pria dan/atau orang tua pihak wanita dapat meminta dispensasi kepada Pengadilan dengan alasan sangat mendesak disertai bukti-bukti pendukung yang cukup' in t and 'saksi-saksi pendukung yang cukup' not in t)
cek('KW-02', tm.get('KW-02', []), lambda t, a, b: 'kanker mulut rahim' not in t and 'kanker mulut rahim' in a and 'kesehatan reproduksi anak, maupun kondisi psikis anak' in t)


def kw07(t, a, b):
    ident = [p for p in paras(t) if 'memeriksa identitas' in p]
    ident_a = [p for p in paras(a) if 'memeriksa identitas' in p]
    # tidak ada kalimat identitas yang tercetak dua kali, dan tidak lebih banyak daripada sebelum paket
    unik = len(set(ident)) == len(ident)
    return unik and len(ident) <= len(ident_a) and 'telah hadir in person' in t


cek('KW-07', tm.get('KW-07', []), kw07)
cek('KW-08', tm.get('KW-08', []), lambda t, a, b: 'diumumkan pada tanggal' not in t and bool(re.search(r'diumumkan pada hari (?:Minggu|Senin|Selasa|Rabu|Kamis|Jumat|Sabtu) tanggal \d+ \w+ \d{4} oleh|diumumkan pada hari \.{10,} tanggal \.{10,} oleh', t)))


def bk01(t, a, b):
    def penerima(x):
        m = re.search(r'sesuai Putusan Nomor .+? Tanggal .+? kepada (.+?);', x)
        return m.group(1).strip() if m else None
    return penerima(t) is not None and penerima(a) is not None and penerima(t) != penerima(a)


cek('BK-01', [x for x in tm.get('BK-01', [])], bk01)
cek('BK-06', [x for x in tm.get('BK-06', []) if x in ses], lambda t, a, b: '6 (enam) bulan' in t and 'Pasal 70 ayat (6)' in t)
cek('AN-01', tm.get('AN-01', []), lambda t, a, b: 'Pasal 308 dan Pasal 309' in t and 'Pasal 307 dan Pasal 308' in a and 'Pasal 307 dan Pasal 308' not in t)


def s13(t, a, b):
    i = t.find('Bahwa pada hari dan tanggal persidangan')
    return i > 0 and (t[i - 1] in ' \n\xa0\t')


cek('S-13', tm.get('S-13', []), s13)
