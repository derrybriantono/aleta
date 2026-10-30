"""Susun perkiraan pohon blangko derry_briantono SERVER (sesudah paket 28 Okt) dari salinan laptop.

Dasar: salinan server 20 Okt 22.33 (D:/aleta-dev/kerja/w3a/asli/derry_briantono; md5 339 berkas perceraian = data/pohon-asli-md5.tsv u2b).
Lalu paket yang terpasang sesudahnya, urut pemasangan, dengan PENJAGA md5 yang sama dengan paketnya:
  timpa/berkas baru  : u3 u4 u5 w2a w2b w3a w3b sampul court-calendar blangko-ikrar-92
  tambal (jangkar)   : u2b x4 x8 alamat-ganda pihak-urut-ecourt
Keluaran: <keluar>/derry_briantono/... + <keluar>/riwayat.tsv (jalur, sumber, md5) + ringkasan.
Hanya membaca paket lain; berkas dibaca/ditulis biner.
Pakai: python susun_dasar.py <akar abt-paket> <salinan w3a derry_briantono> <keluar>
"""
import base64, hashlib, os, shutil, sys

AKAR, ASAL, KEL = sys.argv[1], sys.argv[2], sys.argv[3]
D = os.path.join(KEL, 'derry_briantono')
# SEMUA=1: ikut folder arsip (ALUR*, - BAS * -, terhapus) - perlu bila pohon dipakai pembangun paket lain (prodeo)
LEWATI = () if os.environ.get('SEMUA') == '1' else ('ALUR', '- BAS', 'terhapus', 'BAS ')
LABEL = os.environ.get('LABEL_ASAL', 'server-20okt')


def md5(b):
    return hashlib.md5(b).hexdigest()


def panjang(p):
    """Jalur panjang Windows (>260) lewat awalan //?/ (ditulis dengan garis miring terbalik)."""
    p = os.path.abspath(p)
    awal = chr(92) * 2 + '?' + chr(92)
    if os.name == 'nt' and not p.startswith(awal):
        p = awal + p.replace('/', chr(92))
    return p


def baca(p):
    with open(panjang(p), 'rb') as f:
        return f.read()


def tulis(p, b):
    os.makedirs(os.path.dirname(panjang(p)), exist_ok=True)
    with open(panjang(p), 'wb') as f:
        f.write(b)


riwayat = {}
catatan = []

# 1. salinan server 20 Okt
if os.path.isdir(D):
    shutil.rmtree(panjang(D))
for dp, dn, fn in os.walk(ASAL):
    rel = os.path.relpath(dp, ASAL).replace('\\', '/')
    if LEWATI and rel != '.' and rel.split('/')[0].startswith(LEWATI):
        continue
    for f in fn:
        if f.lower().endswith('.rtf'):
            r = (f if rel == '.' else rel + '/' + f)
            tulis(os.path.join(D, r), baca(os.path.join(dp, f)))
            riwayat[r] = LABEL


def timpa(paket, r, isi, md5_lama=None):
    p = os.path.join(D, r)
    if md5_lama and os.path.exists(panjang(p)):
        m = md5(baca(p))
        if m != md5_lama and m != md5(isi):
            catatan.append('%s TIMPA-BEDA %s (ada %s, harap %s)' % (paket, r, m, md5_lama))
    elif os.path.exists(panjang(p)) and md5(baca(p)) != md5(isi):
        catatan.append('%s ADA-BEDA %s (berkas di pohon asal lain dari isi paket - disunting sesudah dipasang?)' % (paket, r))
    tulis(p, isi)
    riwayat[r] = paket


def dari_folder_rtf(paket, sub='rtf'):
    base = os.path.join(AKAR, paket, 'paket-satker', sub, 'derry_briantono')
    n = 0
    for dp, dn, fn in os.walk(panjang(base)):
        for f in fn:
            if f.lower().endswith('.rtf'):
                r = os.path.relpath(os.path.join(dp, f), panjang(base)).replace('\\', '/')
                timpa(paket, r, baca(os.path.join(dp, f)))
                n += 1
    return n


def daftar_timpa(paket):
    p = os.path.join(AKAR, paket, 'paket-satker', 'daftar-timpa.tsv')
    out = {}
    if os.path.exists(panjang(p)):
        for l in open(p, encoding='utf-8'):
            if l.startswith('#') or not l.strip():
                continue
            c = l.rstrip('\n').split('\t')
            out[c[0].split('/', 1)[1] + '/' + c[1]] = (c[2], c[3])
    return out


def paket_timpa(paket):
    dt = daftar_timpa(paket)
    n = dari_folder_rtf(paket, 'rtf')
    base = os.path.join(AKAR, paket, 'paket-satker', 'timpa', 'derry_briantono')
    for dp, dn, fn in os.walk(panjang(base)):
        for f in fn:
            r = os.path.relpath(os.path.join(dp, f), panjang(base)).replace('\\', '/')
            isi = baca(os.path.join(dp, f))
            lama, baru = dt.get(r, (None, None))
            if baru and md5(isi) != baru:
                catatan.append('%s timpa md5 isi paket beda daftar %s' % (paket, r))
            timpa(paket, r, isi, lama)
            n += 1
    catatan.append('%s: %d berkas' % (paket, n))


def paket_w2a():
    paket = 'w2a-kebendaan'
    n = 0
    for l in open(os.path.join(AKAR, paket, 'paket-satker', 'DAFTAR-BLANGKO.tsv'), encoding='utf-8'):
        c = l.rstrip('\n').split('\t')
        if len(c) < 5:
            continue
        isi = baca(os.path.join(AKAR, paket, 'paket-satker', 'rtf', c[0] + '.rtf'))
        r = c[1] + '/' + c[2]
        if md5(isi) not in (c[3], c[4]):
            catatan.append('w2a isi %s md5 %s tidak di daftar' % (c[0], md5(isi)))
        timpa(paket, r, isi)
        n += 1
    catatan.append('%s: %d berkas' % (paket, n))


def paket_tambal(paket):
    ps = os.path.join(AKAR, paket, 'paket-satker')
    daftar = []
    for l in open(os.path.join(ps, 'rtf-daftar-tambal.tsv'), encoding='utf-8'):
        if l.strip():
            daftar.append(l.rstrip('\n').split('\t'))
    tb = {}
    for l in open(os.path.join(ps, 'rtf-tambal.tsv'), encoding='utf-8'):
        if not l.strip():
            continue
        r, i, j, a, b = l.rstrip('\n').split('\t')
        tb.setdefault(base64.b64decode(r).decode('utf-8'), []).append(
            (int(i), int(j), base64.b64decode(a), base64.b64decode(b)))
    hit = {'COCOK': 0, 'SUDAH': 0, 'LEWAT': 0, 'ARSIP': 0}
    for kode, r, m0, m1, n in daftar:
        if LEWATI and r.split('/')[0].startswith(LEWATI):
            hit['ARSIP'] += 1
            continue
        p = os.path.join(D, r)
        if not os.path.exists(panjang(p)):
            hit['LEWAT'] += 1
            catatan.append('%s LEWAT tidak ada %s' % (paket, r))
            continue
        d = baca(p)
        m = md5(d)
        if m == m1:
            hit['SUDAH'] += 1
            continue
        if m != m0:
            hit['LEWAT'] += 1
            catatan.append('%s LEWAT md5 %s bukan %s : %s' % (paket, m, m0, r))
            continue
        for i, j, a, b in tb.get(r.encode('utf-8').decode('utf-8'), []):
            if d.count(a) != j:
                d = None
                break
            d = d.replace(a, b)
        if d is None or md5(d) != m1:
            hit['LEWAT'] += 1
            catatan.append('%s LEWAT jangkar/hasil %s' % (paket, r))
            continue
        tulis(p, d)
        riwayat[r] = paket
        hit['COCOK'] += 1
    catatan.append('%s tambal: %s' % (paket, hit))


# urutan pemasangan (20 Okt malam s.d. 28 Okt)
for pk in ['u3-itsbat-aua', 'u4-dk-wali-perwalian', 'u5-ahli-waris']:
    paket_timpa(pk)
paket_tambal('u2b-cerai-susulan')
paket_w2a()
for pk in ['w2b-keluarga-lain', 'w3a-blangko-baru-perkawinan', 'w3b-blangko-baru-kuasa-wali']:
    paket_timpa(pk)
for pk in ['x4-tuntutan-perluasan-21okt', 'x8-sisa-tuntutan-21okt', 'alamat-ganda-26okt']:
    paket_tambal(pk)
paket_timpa('sampul-daftar-isi-26okt')
paket_tambal('pihak-urut-ecourt-27okt')
for pk in ['court-calendar-28okt', 'blangko-ikrar-92-28okt']:
    paket_timpa(pk)

with open(os.path.join(KEL, 'riwayat.tsv'), 'w', encoding='utf-8') as o:
    for r in sorted(riwayat):
        o.write('%s\t%s\t%s\n' % (r, riwayat[r], md5(baca(os.path.join(D, r)))))
with open(os.path.join(KEL, 'catatan.txt'), 'w', encoding='utf-8') as o:
    o.write('\n'.join(catatan) + '\n')
print(len(riwayat), 'berkas')
for c in catatan:
    if 'LEWAT' not in c or 'tambal' in c:
        print(c)
print('LEWAT:', sum(1 for c in catatan if ' LEWAT ' in c), 'TIMPA-BEDA:', sum(1 for c in catatan if 'TIMPA-BEDA' in c), 'ADA-BEDA:', sum(1 for c in catatan if 'ADA-BEDA' in c))
