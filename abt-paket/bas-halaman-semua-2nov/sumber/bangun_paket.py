# -*- coding: utf-8 -*-
"""
Paket ABT bas-halaman-semua-2nov (keputusan pengguna 113, 2 Nov 2026: "seharusnya ada semua nomor halaman"): SEMUA blangko BAS Derry bernomor halaman.

Paket ke-27 (bas-halaman-1nov, keputusan 71) memberi field PAGE di kaki halaman blangko BAS folder "<jenis> - BAS", tetapi MELEWATI berkas yang
"sudah bernomor halaman" bila SATU kaki mana pun sudah memuat PAGE, dan hanya menyentuh folder berakhiran " - BAS". Audit atas keadaan sesudah 30 paket
(ukuran per BAGIAN, bukan per berkas) menemukan sisa yang halamannya tidak bernomor:
  - 144 berkas "sebagian": mis. BAS Mediasi (4 bagian): bagian pertama TANPA kaki halaman sama sekali, bagian lain sudah ber-PAGE (halaman BAS sidang
    mediasi/replik di bagian pertama tidak bernomor);
  - 36 berkas "tanpa": folder BAS lama di luar pola " - BAS" (ALUR 03/04/05/06/08 dan "- BAS CONTRA PERCERAIAN -"): kaki ada tetapi kosong / kotak teks kosong,
    atau tanpa kaki sama sekali (berkas satu bagian tanpa pemisah bagian).
Kelompok BAS = yang dikenali ekstensi (jenisKelompok: /^bas\\b|^alur\\s*\\d|\\bbas\\b/i), kecuali "98b Berkas Perkara - BAS" (daftar isi) dan "98c Court Calendar - BAS" (bukan BAS).

Aturan per BERKAS (bentuk SAMA dengan paket ke-27 dan 510 BAS yang sudah bernomor: rata KANAN bawah, 12 pt, huruf judul "BERITA ACARA"):
  1. tiap kaki yang DITETAPKAN di bagian itu (\\footer, \\footerl/r/f) dan belum memuat PAGE: field disisipkan tepat sebelum \\par terakhir kaki itu, didahului \\qr;
  2. bagian yang tidak menetapkan kaki "biasa" sendiri (di RTF kaki diwarisi dari bagian sebelumnya, tetapi seluruh 1.036 BAS yang sudah bernomor menetapkan kaki di TIAP bagian,
     jadi tidak ada yang mengandalkan pewarisan; bagian pertama tanpa kaki = tanpa nomor): satu grup
     {\\footer ...} baru disisipkan tepat sebelum \\pard badan pertama bagian itu.
  Bagian yang menetapkan kaki ber-PAGE tidak disentuh. Berkas yang tiap bagiannya sudah bernomor tidak disentuh.
Nomor AWAL tiap BAS dan lompatan sesudah bukti/lampiran diatur portal saat cetak (halaman runut; manajemen_surat/src/server/modules/aleta-ecourt/bas-halaman/).

pakai: python bangun_paket.py <akar _blangko_abt sesudah 31 paket> <folder paket-satker> <folder hasil>
"""
import base64
import bisect
import hashlib
import io
import os
import re
import sys

SINI = os.path.dirname(os.path.abspath(__file__))

BS = chr(92)
FOLDER_BUKAN_BAS = ('98b Berkas Perkara - BAS', '98c Court Calendar - BAS')
RE_FOLDER_BAS = re.compile(r'^bas\b|^alur\s*\d|\bbas\b', re.I)
RE_KAKI = re.compile(r'\{\\footer([lrf]?)(?=[\s\\{])')
RE_SECTD = re.compile(r'\\sectd(?![a-z])')
RE_PAR = re.compile(r'\\par(?![a-z])')
RE_PARD = re.compile(r'\\pard(?![a-z])')
RE_TITLEPG = re.compile(r'\\titlepg(?![a-z])')
RE_PAGE = re.compile(r'[ {]PAGE[ }\\]')


class Lewat(Exception):
    pass


def md5b(b):
    return hashlib.md5(b).hexdigest()


def grup(raw, i):
    """Akhir (eksklusif) grup seimbang yang dibuka di raw[i] == '{'."""
    d = 0
    k = i
    n = len(raw)
    while k < n:
        c = raw[k]
        if c == BS:
            k += 2
            continue
        if c == '{':
            d += 1
        elif c == '}':
            d -= 1
            if d == 0:
                return k + 1
        k += 1
    raise Lewat('grup tidak tertutup')


def seimbang(raw):
    d = 0
    k = 0
    while k < len(raw):
        c = raw[k]
        if c == BS:
            k += 2
            continue
        if c == '{':
            d += 1
        elif c == '}':
            d -= 1
            if d < 0:
                return False
        k += 1
    return d == 0


def ada_page(g):
    return 'fldinst' in g and RE_PAGE.search(g) is not None


def huruf_judul(raw):
    """Indeks huruf run judul "BERITA ACARA" (\\fN terakhir sebelum judul); '' bila tidak terbaca (sama dengan paket ke-27)."""
    j = raw.find('BERITA ACARA')
    if j < 0:
        return ''
    depan = raw[max(0, j - 600):j]
    m = None
    for m in re.finditer(r'\\f(\d+)(?=[ \\{}])', depan):
        pass
    return m.group(1) if m else ''


def field_page(f):
    huruf = (BS + 'f' + f + ' ') if f else ''
    return '{' + BS + 'fs24 ' + huruf + '{' + BS + 'field{' + BS + '*' + BS + 'fldinst { PAGE ' + BS + BS + '* Arabic }}{' + BS + 'fldrslt {1}}}}'


def kaki_semua(raw):
    """[(jenis 'b'|'l'|'r'|'f', awal, akhir)] kaki tingkat atas (kaki di dalam kaki dilewati)."""
    hasil = []
    for m in RE_KAKI.finditer(raw):
        a = m.start()
        if hasil and a < hasil[-1][2]:
            continue
        hasil.append((m.group(1) or 'b', a, grup(raw, a)))
    return hasil


def bagian_dari(raw):
    sectd = [m.start() for m in RE_SECTD.finditer(raw)]
    if not sectd:
        raise Lewat('tanpa \\sectd')
    return sectd


def titik_sisip_kaki_baru(raw, mulai, batas):
    """Posisi \\pard badan pertama (tingkat grup 0) sesudah pengaturan bagian di raw[mulai:batas]."""
    d = 0
    k = mulai
    while k < batas:
        c = raw[k]
        if c == BS:
            if d == 0:
                if RE_PARD.match(raw, k):
                    return k
                if RE_PAR.match(raw, k):
                    raise Lewat('\\par sebelum \\pard badan')
            k += 2
            continue
        if c == '{':
            d += 1
        elif c == '}':
            d -= 1
            if d < 0:
                raise Lewat('kurung tutup berlebih sebelum badan bagian')
        k += 1
    raise Lewat('bagian tanpa \\pard badan')


def sisip_di_kaki(raw, a, b, f):
    """Potongan (offset, lama, baru) yang memberi field PAGE di kaki raw[a:b]. -> (potongan, bentuk) bentuk: 'par' | 'tutup'."""
    g = raw[a:b]
    pars = list(RE_PAR.finditer(g))
    if pars:
        p = a + pars[-1].start()
        # sama dengan paket ke-27: field disisipkan tepat sebelum \par terakhir kaki (di mana pun letaknya), jadi tidak ada paragraf tambahan
        return (p, BS + 'par', BS + 'qr ' + field_page(f) + BS + 'par'), 'par'
    return (b - 1, '}', BS + 'pard' + BS + 'plain' + BS + 'qr ' + field_page(f) + BS + 'par}'), 'tutup'


def kaki_baru_teks(f):
    return '{' + BS + 'footer ' + BS + 'pard' + BS + 'plain ' + BS + 'qr' + BS + 'li0' + BS + 'ri0' + BS + 'sa0' + BS + 'sl240' + BS + 'slmult1 ' + field_page(f) + BS + 'par}'


def cakupan(raw):
    """Per bagian: (ada nomor di kaki biasa efektif, ada nomor di kaki halaman pertama bila \\titlepg). Kaki yang tidak ditetapkan diwarisi dari bagian sebelumnya."""
    sectd = bagian_dari(raw)
    n = len(sectd)
    punya = [dict() for _ in range(n)]
    for jenis, a, b in kaki_semua(raw):
        k = max(bisect.bisect_right(sectd, a) - 1, 0)
        punya[k][jenis] = ada_page(raw[a:b])
    efektif = {}
    hasil = []
    for i in range(n):
        efektif.update(punya[i])
        akhir = sectd[i + 1] if i + 1 < n else len(raw)
        p = RE_PARD.search(raw, sectd[i])
        tp = bool(RE_TITLEPG.search(raw[sectd[i]:(p.start() if p and p.start() < akhir else akhir)]))
        hasil.append((bool(efektif.get('b')), (not tp) or bool(efektif.get('f'))))
    return hasil


def rancang(raw):
    """-> (potongan [(offset, lama, baru)], info) atau raise Lewat. Potongan kosong = tiap bagian sudah bernomor."""
    sectd = bagian_dari(raw)
    n = len(sectd)
    f = huruf_judul(raw)
    kaki = kaki_semua(raw)
    milik = [[] for _ in range(n)]
    for jenis, a, b in kaki:
        milik[max(bisect.bisect_right(sectd, a) - 1, 0)].append((jenis, a, b))
    pot = []
    info = {'kaki_diisi': 0, 'kaki_baru': 0, 'kaki_baru_waris': 0, 'kaki_paragraf_baru': 0, 'bagian': n, 'bagian_tanpa_nomor': 0}
    efektif = False  # kaki 'biasa' yang berlaku di bagian ini (ditetapkan sendiri atau diwarisi) sudah bernomor
    for i in range(n):
        punya_b = False
        for jenis, a, b in milik[i]:
            ada = ada_page(raw[a:b])
            if jenis == 'b':
                punya_b = True
                efektif = ada
            if not ada:
                if jenis == 'b':
                    info['bagian_tanpa_nomor'] += 1
                    efektif = True
                p, bentuk = sisip_di_kaki(raw, a, b, f)
                pot.append(p)
                info['kaki_diisi'] += 1
                if bentuk == 'tutup':
                    info['kaki_paragraf_baru'] += 1
        if not punya_b:
            # Semua BAS yang sudah bernomor memuat kaki di TIAP bagiannya (tidak ada yang mengandalkan pewarisan antarbagian) - bagian ini disamakan
            akhir = sectd[i + 1] if i + 1 < n else len(raw)
            t = titik_sisip_kaki_baru(raw, sectd[i], akhir)
            pot.append((t, BS + 'pard', kaki_baru_teks(f) + BS + 'pard'))
            info['kaki_baru'] += 1
            if efektif:
                info['kaki_baru_waris'] += 1
            else:
                info['bagian_tanpa_nomor'] += 1
            efektif = True
    pot.sort(key=lambda x: x[0])
    for (o1, l1, _), (o2, _l2, _b2) in zip(pot, pot[1:]):
        if o1 + len(l1) > o2:
            raise Lewat('potongan bertumpuk')
    return pot, info


def tampak(s):
    """Teks tampak kasar: tanpa kata kendali dan kurung (memastikan hanya field nomor halaman yang bertambah)."""
    t = re.sub(r"\\'[0-9a-fA-F]{2}", '?', s)
    t = re.sub(r'\\[a-zA-Z]+-?\d* ?', '', t)
    return re.sub(r'[{}\s]+', '', t)


def terapkan(raw, potong):
    for off, lama, baru in sorted(potong, key=lambda x: -x[0]):
        assert raw[off:off + len(lama)] == lama, (off, lama)
        raw = raw[:off] + baru + raw[off + len(lama):]
    return raw


def sasaran(akar):
    dasar = os.path.join(akar, 'derry_briantono')
    for d in sorted(os.listdir(dasar)):
        if d == 'terhapus' or d in FOLDER_BUKAN_BAS or not RE_FOLDER_BAS.search(d):
            continue
        if not os.path.isdir(os.path.join(dasar, d)):
            continue
        for fn in sorted(os.listdir(os.path.join(dasar, d))):
            if fn.lower().endswith('.rtf'):
                yield 'derry_briantono/%s/%s' % (d, fn)


def main():
    akar, keluar, hasil = sys.argv[1], sys.argv[2], sys.argv[3]
    for x in (keluar, hasil):
        if not os.path.isdir(x):
            os.makedirs(x)
    daftar, lewat = [], []
    tot = {'kaki_diisi': 0, 'kaki_baru': 0, 'kaki_baru_waris': 0, 'kaki_paragraf_baru': 0}
    sudah = 0
    jumlah = 0
    for rel in sasaran(akar):
        jumlah += 1
        b = open(os.path.join(akar, rel), 'rb').read()
        raw = b.decode('latin1')
        try:
            pot, info = rancang(raw)
        except Lewat as e:
            lewat.append((rel, str(e)))
            continue
        if not pot:
            sudah += 1
            continue
        baru = terapkan(raw, pot)
        if not seimbang(baru) or seimbang(raw) != seimbang(baru):
            raise SystemExit('neraca kurung berubah: ' + rel)
        if len(RE_PAGE.findall(baru)) != len(RE_PAGE.findall(raw)) + len(pot):
            raise SystemExit('jumlah field PAGE tidak bertambah tepat: ' + rel)
        c = cakupan(baru)
        if not all(a and o for a, o in c):
            raise SystemExit('masih ada bagian tanpa nomor sesudah ditambal: %s %s' % (rel, c))
        if tampak(baru.replace(field_page(huruf_judul(raw)), '')) != tampak(raw.replace(field_page(huruf_judul(raw)), '')):
            raise SystemExit('teks tampak berubah: ' + rel)
        daftar.append((rel, b, baru.encode('latin1'), pot, info))
        for k in tot:
            tot[k] += info[k]
    with io.open(os.path.join(keluar, 'daftar-tambal.tsv'), 'w', encoding='utf-8', newline='\n') as d, \
            io.open(os.path.join(keluar, 'tambal.tsv'), 'w', encoding='utf-8', newline='\n') as t:
        d.write(u'# kode\tberkas\tmd5_lama\tmd5_baru\tjumlah potongan - berkas diubah HANYA bila md5 persis md5_lama (keadaan sesudah 31 paket ../URUTAN-PASANG-1nov.md)\n')
        t.write(u'# kode\toffset\tb64(teks lama)\tb64(teks baru)\n')
        for i, (rel, lama, baru, pot, info) in enumerate(daftar, 1):
            kode = 'N%04d' % i
            d.write(u'%s\t%s\t%s\t%s\t%d\n' % (kode, rel, md5b(lama), md5b(baru), len(pot)))
            for off, a, z in pot:
                t.write(u'%s\t%d\t%s\t%s\n' % (kode, off, base64.b64encode(a.encode('latin1')).decode('ascii'), base64.b64encode(z.encode('latin1')).decode('ascii')))
    with io.open(os.path.join(hasil, 'rincian.tsv'), 'w', encoding='utf-8', newline='\n') as o:
        o.write(u'# kode\tberkas\tbagian\tbagian tanpa nomor\tkaki lama diisi\tkaki baru dibuat\tkaki diisi dengan paragraf baru\n')
        for i, (rel, lama, baru, pot, info) in enumerate(daftar, 1):
            o.write(u'N%04d\t%s\t%d\t%d\t%d\t%d\t%d\n' % (i, rel, info['bagian'], info['bagian_tanpa_nomor'], info['kaki_diisi'], info['kaki_baru'], info['kaki_paragraf_baru']))
    with io.open(os.path.join(hasil, 'lewat.tsv'), 'w', encoding='utf-8', newline='\n') as o:
        o.write(u'# berkas BAS yang TIDAK dapat ditambal\talasan\n')
        for rel, alasan in lewat:
            o.write(u'%s\t%s\n' % (rel, alasan))
    # skrip paket (LF) + pembantu tambal bersama + MD5SUMS
    for sk in ('pasang-satker.sh', 'pulih-satker.sh'):
        with open(os.path.join(keluar, sk), 'wb') as o:
            o.write(open(os.path.join(SINI, sk), 'rb').read().replace(b'\r\n', b'\n'))
    tr = os.path.join(SINI, '..', '..', 'bas-halaman-1nov', 'paket-satker', 'tambal_rtf.py')
    with open(os.path.join(keluar, 'tambal_rtf.py'), 'wb') as o:
        o.write(open(tr, 'rb').read().replace(b'\r\n', b'\n'))
    berkas = sorted(x for x in os.listdir(keluar) if os.path.isfile(os.path.join(keluar, x)) and x != 'MD5SUMS.txt')
    with open(os.path.join(keluar, 'MD5SUMS.txt'), 'w', newline='\n') as o:
        for x in berkas:
            o.write('%s  %s\n' % (md5b(open(os.path.join(keluar, x), 'rb').read()), x))
    ringkas = 'BAS DIPERIKSA=%d | SUDAH BERNOMOR SEMUA BAGIAN=%d | BERKAS DIUBAH=%d (kaki lama diisi=%d [paragraf baru %d], kaki baru=%d [bagian yang tadinya mewarisi kaki bernomor %d]) | DILEWATI=%d' % (
        jumlah, sudah, len(daftar), tot['kaki_diisi'], tot['kaki_paragraf_baru'], tot['kaki_baru'], tot['kaki_baru_waris'], len(lewat))
    with io.open(os.path.join(hasil, 'ringkas.txt'), 'w', encoding='utf-8', newline='\n') as o:
        o.write(ringkas + u'\n')
    print(ringkas)


if __name__ == '__main__':
    main()
