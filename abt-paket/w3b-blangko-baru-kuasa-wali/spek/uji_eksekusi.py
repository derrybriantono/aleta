# -*- coding: utf-8 -*-
"""Uji kecil jenis EKSEKUSI (agen W3b). Jalankan dari mana saja: python uji_eksekusi.py [--tanpa-server]

(a) berkas dibangun (8 penetapan + 8 BAS) dan RTF seimbang (kurung kurawal) serta teksnya terbaca;
(b) semua penanda #nnnn# ada di server (w3b-var-server.pkl) atau milik jenis ini (3940-3969), dan SEMUA 30 variabel milik jenis ini dirujuk;
(c) kueri data_sql variabel eksekusi jalan atas perkara nyata 6326, 6952, 7900 (BACA SAJA lewat alat/uji_sql.py) tanpa galat;
(d) tidak ada sisa kata jenis lain / kata ALETA; nomor Pasal yang dicetak ada di naskah RBg yang dibaca.
"""
import os
import pickle
import re
import sys

AKAR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(AKAR, 'sumber'))
sys.path.insert(0, os.path.join(AKAR, 'alat'))
sys.stdout.reconfigure(encoding='utf-8')

import variabel_def as V  # noqa: E402
import spek_eksekusi as SE  # noqa: E402
from bangun import Dok, lp  # noqa: E402
from pustaka import KELUAR  # noqa: E402

SERVER = pickle.load(open('D:/aleta-dev/kerja/w3b-var-server.pkl', 'rb'))
RBG_TXT = 'D:/aleta-dev/kerja/referensi/_unduhan/hir-rbg-bw/rbg-unnes.txt'
MILIK = set(range(3940, 3970))
galat = []


def periksa(ok, pesan):
    if not ok:
        galat.append(pesan)
        print('GALAT:', pesan)


def semua_rtf():
    hasil = []
    for f in (SE.SPEK['folder'], SE.SPEK['folder'] + ' - BAS'):
        d = os.path.join(KELUAR, f)
        for n in sorted(os.listdir(lp(d))):
            if n.lower().endswith('.rtf'):
                hasil.append(os.path.join(d, n))
    return hasil


def main():
    # (a) membangun
    S = dict(SE.SPEK)
    S['alur'] = 65
    S['nama_pendek'] = 'Eksekusi'
    jumlah = SE.bangun(S)
    print('(a) dibangun: %d berkas' % jumlah)
    periksa(jumlah == 16, 'jumlah berkas %d (harus 16: 8 penetapan + 8 BAS)' % jumlah)
    berkas = semua_rtf()
    periksa(len(berkas) == 16, 'berkas di folder keluaran %d' % len(berkas))
    nama_var = [x for x in V.VAR if 3940 <= x['no'] <= 3969]
    periksa(len(nama_var) == 30 and not V.PANJANG, 'variabel eksekusi %d (harus 30), nama > 200 huruf: %s' % (len(nama_var), V.PANJANG))
    periksa(all(3940 <= x['no'] <= 3969 for x in V.VAR if x['no'] >= 3940 and x['no'] < 3970), 'nomor di luar jatah')

    # (b) penanda
    pakai = set()
    teks_semua = {}
    for p in berkas:
        raw = open(lp(p), 'rb').read().decode('latin1')
        periksa(raw.count('{') - raw.count('\\{') == raw.count('}') - raw.count('\\}'), 'kurung kurawal tidak seimbang: ' + os.path.basename(p))
        d = Dok(p)
        teks = '\n'.join(d.isi(i) for i in range(len(d.par)))
        teks_semua[p] = teks
        tok = set(int(t) for t in re.findall(r'#(\d{4})#', raw))
        pakai |= tok
        for t in sorted(tok):
            periksa((str(t).zfill(4) in SERVER) or t in MILIK, 'penanda #%04d# tidak ada di server dan bukan milik jenis (%s)' % (t, os.path.basename(p)))
        # token yang tampak utuh di teks tetapi terpecah di RTF mentah
        utuh = set(int(t) for t in re.findall(r'#(\d{4})#', teks))
        periksa(utuh <= tok, 'penanda terpecah di RTF mentah: %s' % os.path.basename(p))
    # variabel milik yang dirujuk RTF atau kueri variabel lain
    rujuk = set(pakai)
    for x in nama_var:
        rujuk |= set(int(n) for n in re.findall(r'no_var = (\d{4})', x['sql'] or ''))
        rujuk |= set(int(n) for n in re.findall(r'#(\d{4})#', x['sql'] or ''))
    nganggur = sorted(MILIK - rujuk)
    periksa(not nganggur, 'variabel milik jenis tidak dirujuk: %s' % nganggur)
    periksa(all(('%04d' % n) in SERVER for n in (1, 8000, 8004, 8008, 8011)), 'variabel lama yang dipakai tidak ada di server')
    print('(b) penanda dipakai: %d, milik jenis: %d' % (len(pakai), len(pakai & MILIK)))

    # (d) sisa kata, Pasal
    larangan = re.compile(r'nafkah|hibah|perwalian|mafqud|hadhanah|hak asuh|penguasaan anak|mediator|mediasi|\bwali\b|aleta|verstek|gugat cerai|talak', re.I)
    naskah = open(RBG_TXT, encoding='utf-8', errors='replace').read()
    pasal_ok = {int(m) for m in re.findall(r'^\s*Pasal\s+(\d{3})\s*\.?\s*$', naskah, re.M)}
    for p, teks in teks_semua.items():
        m = larangan.search(teks)
        periksa(m is None, 'sisa kata terlarang "%s" di %s' % (m.group(0) if m else '', os.path.basename(p)))
        for n in set(re.findall(r'Pasal (\d+)(?: ayat| RBg|,|\s|\.|;|\))', teks)):
            n = int(n)
            periksa(n == 54 or n in pasal_ok, 'Pasal %d tidak ada di naskah RBg / bukan Pasal 54 UU 7/1989 (%s)' % (n, os.path.basename(p)))
    for x in nama_var:
        periksa('aleta' not in (x['nama'] + (x['sql'] or '') + (x['default'] or '')).lower(), 'kata aleta di variabel %d' % x['no'])
    print('(d) pasal terverifikasi di naskah RBg: %d pasal dikenali' % len(pasal_ok))

    # (c) SQL atas perkara nyata
    if '--tanpa-server' not in sys.argv:
        import uji_sql
        pen = {'8008': 'PENGADILAN AGAMA DONGGALA'}
        ok = 0
        for x in nama_var:
            if x['tipe'] != 'data_sql':
                continue
            for perkara in ('6326', '6952', '7900'):
                hasil = uji_sql.jalankan(x['sql'], perkara, pen)
                baris = hasil.split('\n')
                periksa(not hasil.startswith('ERROR') and 'ERROR' not in hasil and len(baris) >= 2 and baris[1].strip() != '',
                        'kueri %d perkara %s galat/kosong: %s' % (x['no'], perkara, hasil[:200]))
                ok += 1
        print('(c) kueri dijalankan: %d (3 perkara x variabel data_sql)' % ok)
    print('HASIL:', 'SEMUA LULUS' if not galat else '%d GALAT' % len(galat))
    return 1 if galat else 0


if __name__ == '__main__':
    sys.exit(main())
