# -*- coding: utf-8 -*-
"""Bangun paket abt-keputusan-a-mekanis-4nov (keputusan Derry 182/184, 4 Nov 2026): ubahan teks blangko saja.
pakai: python -B bangun_mekanis.py <akar _blangko_abt dasar (derry_briantono/ sesudah ijab + audit-mekanis + audit-ejaan)> <paket-satker> <hasil>
Aturan:
  A6  (K10) #8555# yang berarti PEMUTUS (membebani, berpendapat, menilai, berkesimpulan, mempertimbangkan, menjatuhkan, ...) -> #8554#
            di 4 putusan CG/CT; tindakan memimpin sidang (menasihati, memerintahkan, memeriksa identitas, ...) tetap #8555#.
            Penetapan [98] Cabut ("dikabulkan #8555# maka perkara ... selesai") TIDAK diubah (menunggu keputusan Derry).
  A11 (V03) #0690# -> #8554#, #4004# -> #8555# di 106 putusan/penetapan non-BAS (daftar-v03.txt); BAS dibiarkan.
  A3  (K03) catatan kerja "(apabila tau gunakan baris selanjutnya tinggal copy sesuai #0053#)" dibuang; kalimat sesudahnya menjadi paragraf sendiri (pilihan).
  E2        "adalah untuk mendapatkan Buku Nikah" -> "adalah untuk #8171#" (fakta tujuan itsbat, 6 blangko [01] IN).
  A13       "isteri" -> "istri" HANYA di kalimat buatan blangko (kutipan UU/KHI/PERMA/kitab/lafal ikrar dibiarkan; daftar di isteri-konteks.txt);
            "c/q Majelis #8554#" -> "c/q #8554#". "fijtelijkeground" TIDAK diubah.
Pemeriksaan per berkas (BERHENTI bila gagal): teks tampak hasil = teks lama + ubahan yang dimaksud PERSIS; kurung seimbang; tanpa nama aplikasi."""
import collections
import os
import re
import sys

SINI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, SINI)
from abtlib import md5b, peta, ubah, ubah_mentah, periksa, tulis_paket  # noqa: E402

# ---- A6 -----------------------------------------------------------------------------------------------------------------
K10_BERKAS = [
    '1 Perceraian CG/[01a] [Kabul Verstek] Cerai - Alasan E (Qabla Ad Dukhul).rtf',
    '1 Perceraian CG/[01ab] [Tolak Verstek] Cerai - Tidak ada bukti.rtf',
    '1 Perceraian CG/[01ab] [Tolak Verstek] Cerai - Unus Testis Nullus Testis.rtf',
    '1a Perceraian CT/[01ab] [Tolak Verstek] Cerai - Tidak ada bukti.rtf',
]
SESUDAH = re.compile(r'^(?:tetap |juga |tidak |sudah |telah dapat |perlu |akan |dapat )?(?:membebani|membebankan|berpendapat|menilai|memberi pertimbangan|mengemukakan|mempertimbangkan|berkesimpulan|menjatuhkan|menolak|mengabulkan|menetapkan|memutuskan|menyatakan|sampai pada|telah menolak|telah mempertimbangkan|dapat mempertimbangkan)|^dalam pertimbangan putusan ini perlu')
SEBELUM = re.compile(r'(?:pendapat|menurut|agar|dipertimbangkan oleh|diambil alih sebagai pendapat) $')

# ---- A13 ----------------------------------------------------------------------------------------------------------------
# indeks konteks "isteri" (isteri-konteks.txt) yang DIBIARKAN: kutipan Al-Muwatha', penjelasan UU 1/1974 & PP 9/1975, kaidah putusan MA,
# lafal ikrar talak, KHI Pasal 149/152, terjemah kitab, PP 10/1983, hadis, PERMA 5/2019, UU 1/1974 & KHI (harta bawaan).
ISTERI_BIARKAN = {2, 3, 4, 5, 6, 7, 19, 20, 22, 23, 27, 28, 29, 34, 35, 36, 37, 39, 40, 41, 47, 48, 49, 50, 51, 52}
ISTERI = re.compile(r'[Ii]steri\w*')


def kunci(t, m):
    return t[max(0, m.start() - 100):m.end() + 60].replace('\n', ' / ')


def muat_konteks():
    peta_k = {}
    with open(os.path.join(SINI, 'isteri-konteks.txt'), encoding='utf-8') as f:
        f.readline()
        for l in f:
            l = l.rstrip('\n')
            if l:
                i, _, _, k = l.split('\t', 3)
                peta_k[k] = int(i)
    return peta_k


# ---- A3 K03 -------------------------------------------------------------------------------------------------------------
K03_BERKAS = '1 Perceraian CG/[01ab] [Tolak Verstek] Cerai - Unus Testis Nullus Testis.rtf'
K03_RX = re.compile(
    rb'\{\\fs24 [^{}]*?\\cf8  \}\{\\fs24 [^{}]*?/\}\{\\b1 [^{}]*?  \}\{\\b1 [^{}]*?\(apabila tau gunakan baris selanjutnya tinggal copy sesuai #0053#\}'
    rb'(\{\\fs24 [^{}]*?\\cf3 )\) sejak')
K03_LAMA = ' / (apabila tau gunakan baris selanjutnya tinggal copy sesuai #0053#) sejak'
K03_BARU = '\nsejak'

# ---- E2 -----------------------------------------------------------------------------------------------------------------
E2_LAMA = 'mengajukan itsbat nikah adalah untuk mendapatkan Buku Nikah;'
E2_BARU = 'mengajukan itsbat nikah adalah untuk #8171#;'


def main():
    akar, keluar, hasil_dir = sys.argv[1], sys.argv[2], sys.argv[3]
    dasar = os.path.join(akar, 'derry_briantono')
    v03 = [l.strip() for l in open(os.path.join(SINI, 'daftar-v03.txt'), encoding='utf-8') if l.strip() and not l.startswith('#')]
    v03 = set(v03)
    konteks = muat_konteks()
    berkas = []
    for d, _, fs in os.walk(dasar):
        for f in fs:
            if f.lower().endswith('.rtf'):
                berkas.append(os.path.relpath(os.path.join(d, f), dasar).replace(chr(92), '/'))
    berkas.sort()
    daftar, tambal, csvb = [], [], []
    ringkas = collections.OrderedDict()
    sisa_v03 = set(v03)
    sisa_k10 = set(K10_BERKAS)
    no = 0
    taksir_isteri = collections.Counter()
    for rel in berkas:
        b = open(os.path.join(dasar, rel), 'rb').read()
        teks, pos = peta(b)
        ops = []  # (awal, akhir, baru, kode, jenis)
        # A6
        if rel in K10_BERKAS:
            sisa_k10.discard(rel)
            for m in re.finditer('#8555#', teks):
                s = teks[m.end() + 1:m.end() + 60]
                p = teks[max(0, m.start() - 40):m.start()]
                if SESUDAH.match(s) or SEBELUM.search(p):
                    ops.append((m.start(), m.end(), '#8554#', 'A6', 'pemutus-8555-ke-8554'))
        # A11
        if rel in v03:
            sisa_v03.discard(rel)
            for m in re.finditer(r'#(0690|4004)#', teks):
                ops.append((m.start(), m.end(), '#8554#' if m.group(1) == '0690' else '#8555#', 'A11', m.group(0) + '-ke-' + ('8554' if m.group(1) == '0690' else '8555')))
        # E2
        for m in re.finditer(re.escape(E2_LAMA), teks):
            ops.append((m.start(), m.end(), E2_BARU, 'E2', 'tujuan-itsbat-8171'))
        # A13
        for m in re.finditer(r'c/q Majelis #8554#', teks):
            ops.append((m.start(), m.end(), 'c/q #8554#', 'A13', 'cq-majelis-8554'))
        for m in ISTERI.finditer(teks):
            k = kunci(teks, m)
            if k not in konteks:
                raise SystemExit('KONTEKS isteri BARU (jalankan ulang alat/isteri.py): %r' % k)
            if konteks[k] in ISTERI_BIARKAN:
                taksir_isteri['biarkan'] += 1
                continue
            para = teks[teks.rfind('\n', 0, m.start()) + 1:m.start()]
            if para.count('“') > para.count('”') or para.count('"') % 2 == 1:
                raise SystemExit('isteri DI DALAM TANDA KUTIP (tinjau): %s: %r' % (rel, k))
            baru = m.group(0).replace('isteri', 'istri').replace('Isteri', 'Istri')
            ops.append((m.start(), m.end(), baru, 'A13', 'isteri-istri'))
            taksir_isteri['ubah'] += 1
        mentah = []
        if rel == K03_BERKAS:
            ms = list(K03_RX.finditer(b))
            if len(ms) != 1:
                raise SystemExit('K03: pola bita tidak tepat satu (%d)' % len(ms))
            m = ms[0]
            mentah.append((m.group(0), b'\\par ' + m.group(1) + b'sejak'))
            if teks.count(K03_LAMA) != 1:
                raise SystemExit('K03: teks tampak tidak tepat satu')
        if not ops and not mentah:
            continue
        no += 1
        kode = 'N%04d' % no
        harap = teks
        for a, z, baru, k, j in sorted(ops, reverse=True):
            harap = harap[:a] + baru + harap[z:]
        pot_total = []
        h = b
        if ops:
            h, pot, _ = ubah(b, [(a, z, baru) for a, z, baru, _, _ in ops], teks, pos)
            pot_total += pot
        if mentah:
            # ubahan mentah dihitung atas berkas ASLI; harus tidak bersinggungan dengan potongan teks
            h2, pot2 = ubah_mentah(b, mentah)
            for off, l0, l1 in pot2:
                for o2, m0, m1 in pot_total:
                    if not (off + len(l0) <= o2 or o2 + len(m0) <= off):
                        raise SystemExit('K03 bersinggungan dengan potongan lain')
            pot_total += pot2
            pot_total.sort()
            h = b
            for off, l0, l1 in sorted(pot_total, key=lambda x: -x[0]):
                assert h[off:off + len(l0)] == l0
                h = h[:off] + l1 + h[off + len(l0):]
            harap = harap.replace(K03_LAMA, K03_BARU, 1)
        periksa(b, h, harap)
        daftar.append((kode, 'derry_briantono/' + rel, md5b(b), md5b(h), len(pot_total)))
        for off, l0, l1 in pot_total:
            tambal.append((kode, off, l0, l1))
        for a, z, baru, k, j in ops:
            csvb.append((rel, k, j, teks[a:z], baru, teks[max(0, a - 50):z + 50].replace('\n', ' / ')))
            r = ringkas.setdefault((k, j), [0, set()])
            r[0] += 1
            r[1].add(rel)
        if mentah:
            csvb.append((rel, 'A3', 'catatan-kerja-dibuang', K03_LAMA, K03_BARU, ''))
            r = ringkas.setdefault(('A3', 'catatan-kerja-dibuang'), [0, set()])
            r[0] += 1
            r[1].add(rel)
    if sisa_v03 or sisa_k10:
        raise SystemExit('berkas daftar tidak ada di pohon: %r %r' % (sorted(sisa_v03)[:3], sorted(sisa_k10)))
    tulis_paket(keluar, daftar, tambal, 'sesudah ijab-yang-menikahkan-3nov + audit-mekanis-4nov + audit-ejaan-4nov')
    if not os.path.isdir(hasil_dir):
        os.makedirs(hasil_dir)
    import csv
    with open(os.path.join(hasil_dir, 'daftar-tambalan.csv'), 'w', encoding='utf-8-sig', newline='') as f:
        w = csv.writer(f)
        w.writerow(['berkas', 'keputusan', 'jenis', 'sebelum', 'sesudah', 'konteks sebelum'])
        w.writerows(csvb)
    with open(os.path.join(hasil_dir, 'ringkas.txt'), 'w', encoding='utf-8', newline='\n') as f:
        for (k, j), (n, s) in sorted(ringkas.items()):
            f.write('%s\t%s\t%d kali\t%d berkas\n' % (k, j, n, len(s)))
        f.write('ISTERI diubah %d, dibiarkan %d (kutipan)\n' % (taksir_isteri['ubah'], taksir_isteri['biarkan']))
        f.write('BERKAS %d POTONGAN %d\n' % (len(daftar), len(tambal)))
    print('BERKAS %d POTONGAN %d' % (len(daftar), len(tambal)))


if __name__ == '__main__':
    main()
