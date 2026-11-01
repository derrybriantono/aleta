# -*- coding: utf-8 -*-
"""
Paket ABT bas-halaman-1nov (keputusan pengguna 71, 1 Nov 2026): nomor halaman di KAKI halaman BAS Derry.

Blangko BAS (folder "<jenis> - BAS", kecuali 98b Berkas Perkara & 98c Court Calendar yang bukan BAS) yang kaki halamannya belum memuat
field PAGE diberi field PAGE rata kanan bawah, huruf 12 pt dengan huruf judul "BERITA ACARA" - SAMA dengan 422 BAS Derry yang sudah
bernomor (contoh: BAS ALUR 02 [1a]). Isi lain tidak disentuh:
  - kaki halaman ada (paragraf kosong / kotak teks kosong): field disisipkan tepat sebelum \\par TERAKHIR kaki itu, didahului \\qr
    (perataan paragraf kaki itu menjadi kanan); semua kaki di semua bagian (\\footer, \\footerl/r/f) diberi;
  - tanpa kaki halaman sama sekali (hanya blangko tanpa pemisah bagian): satu grup {\\footer ...} disisipkan tepat sebelum \\pard
    pertama sesudah \\sectd pertama (tempat pengaturan bagian).
Nomor AWAL tiap BAS tidak diatur di blangko: diatur portal saat cetak/unduh/unggah (halaman runut, lihat
manajemen_surat/src/server/modules/aleta-ecourt/bas-halaman/).

pakai: python bangun_paket.py <akar _blangko_abt sesudah 26 paket> <folder paket-satker> <folder hasil>
"""
import base64
import hashlib
import io
import os
import re
import sys

BS = chr(92)
FOLDER_BUKAN_BAS = ('98b Berkas Perkara - BAS', '98c Court Calendar - BAS')
RE_KAKI = re.compile(r'\{\\footer[lrf]?(?=[\s\\{])')
RE_PAR = re.compile(r'\\par(?![a-z])')


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
    raise ValueError('grup tidak tertutup')


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
    return 'fldinst' in g and re.search(r'[ {]PAGE[ }\\]', g) is not None


def huruf_judul(raw):
    """Indeks huruf run judul "BERITA ACARA" (\\loch\\fN / \\fN terakhir sebelum judul); '' bila tidak terbaca."""
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


class Lewat(Exception):
    pass


def rancang(raw):
    """-> [(offset, lama, baru)] atas berkas lama, atau Lewat."""
    kaki = []
    for m in RE_KAKI.finditer(raw):
        a = m.start()
        # kaki di dalam kaki/kotak teks tidak ada di blangko; lewati yang tumpang tindih
        if kaki and a < kaki[-1][1]:
            continue
        kaki.append((a, grup(raw, a)))
    if any(ada_page(raw[a:b]) for a, b in kaki):
        raise Lewat('sudah bernomor halaman')
    f = huruf_judul(raw)
    sisip = []
    if kaki:
        for a, b in kaki:
            g = raw[a:b]
            pars = list(RE_PAR.finditer(g))
            if pars:
                p = a + pars[-1].start()
                sisip.append((p, BS + 'par', BS + 'qr ' + field_page(f) + BS + 'par'))
            else:
                p = b - 1
                sisip.append((p, '}', BS + 'pard' + BS + 'plain' + BS + 'qr ' + field_page(f) + BS + 'par}'))
        return sisip
    if re.search(r'\\sect(?![a-z])', raw):
        raise Lewat('tanpa kaki halaman tetapi berbagian - tidak disentuh')
    m = re.search(r'\\sectd(?![a-z])', raw)
    if not m:
        raise Lewat('tanpa \\sectd')
    p = re.compile(r'\\pard(?![a-z])').search(raw, m.end())
    if not p:
        raise Lewat('tanpa \\pard sesudah \\sectd')
    # \pard itu harus di tingkat badan (tidak di dalam grup yang dibuka sesudah \sectd)
    d = 0
    k = m.end()
    while k < p.start():
        c = raw[k]
        if c == BS:
            k += 2
            continue
        if c == '{':
            d += 1
        elif c == '}':
            d -= 1
        k += 1
    if d != 0:
        raise Lewat('\\pard pertama tidak di tingkat badan')
    kaki_baru = '{' + BS + 'footer ' + BS + 'pard' + BS + 'plain ' + BS + 'qr' + BS + 'li0' + BS + 'ri0' + BS + 'sa0' + BS + 'sl240' + BS + 'slmult1 ' + field_page(f) + BS + 'par}'
    return [(p.start(), BS + 'pard', kaki_baru + BS + 'pard')]


def terapkan(raw, potong):
    for off, lama, baru in sorted(potong, key=lambda x: -x[0]):
        assert raw[off:off + len(lama)] == lama, (off, lama)
        raw = raw[:off] + baru + raw[off + len(lama):]
    return raw


def sasaran(akar):
    dasar = os.path.join(akar, 'derry_briantono')
    for d in sorted(os.listdir(dasar)):
        if not d.endswith(' - BAS') or d in FOLDER_BUKAN_BAS:
            continue
        for f in sorted(os.listdir(os.path.join(dasar, d))):
            if f.lower().endswith('.rtf'):
                yield 'derry_briantono/%s/%s' % (d, f)


def main():
    akar, keluar, hasil = sys.argv[1], sys.argv[2], sys.argv[3]
    for x in (keluar, hasil):
        if not os.path.isdir(x):
            os.makedirs(x)
    daftar = []
    lewat = []
    jenis = {'kaki-ada': 0, 'kaki-baru': 0}
    for rel in sasaran(akar):
        b = open(os.path.join(akar, rel), 'rb').read()
        raw = b.decode('latin1')
        try:
            pot = rancang(raw)
        except Lewat as e:
            lewat.append((rel, str(e)))
            continue
        baru = terapkan(raw, pot)
        if not seimbang(baru) or seimbang(raw) != seimbang(baru):
            raise SystemExit('neraca kurung berubah: ' + rel)
        if len(re.findall(r'[ {]PAGE[ }\\]', baru)) != len(re.findall(r'[ {]PAGE[ }\\]', raw)) + len(pot):
            raise SystemExit('jumlah field PAGE tidak bertambah tepat: ' + rel)
        # teks tampak badan tidak berubah: yang berubah hanya di dalam kaki (atau kaki baru)
        jenis['kaki-baru' if pot[0][1] == BS + 'pard' else 'kaki-ada'] += 1
        daftar.append((rel, b, baru.encode('latin1'), pot))
    with io.open(os.path.join(keluar, 'daftar-tambal.tsv'), 'w', encoding='utf-8', newline='\n') as d, \
            io.open(os.path.join(keluar, 'tambal.tsv'), 'w', encoding='utf-8', newline='\n') as t:
        d.write(u'# kode\tberkas\tmd5_lama\tmd5_baru\tjumlah potongan - berkas diubah HANYA bila md5 persis md5_lama (keadaan sesudah 26 paket ../URUTAN-PASANG-1nov.md)\n')
        t.write(u'# kode\toffset\tb64(teks lama)\tb64(teks baru)\n')
        for i, (rel, lama, baru, pot) in enumerate(daftar, 1):
            kode = 'H%04d' % i
            d.write(u'%s\t%s\t%s\t%s\t%d\n' % (kode, rel, md5b(lama), md5b(baru), len(pot)))
            for off, a, z in pot:
                t.write(u'%s\t%d\t%s\t%s\n' % (kode, off, base64.b64encode(a.encode('latin1')).decode('ascii'), base64.b64encode(z.encode('latin1')).decode('ascii')))
    with io.open(os.path.join(hasil, 'lewat.tsv'), 'w', encoding='utf-8', newline='\n') as o:
        o.write(u'# berkas BAS yang TIDAK diubah\talasan\n')
        for rel, alasan in lewat:
            o.write(u'%s\t%s\n' % (rel, alasan))
    ringkas = 'BERKAS DIUBAH=%d (kaki ada=%d, kaki baru=%d) | DILEWATI=%d (%s)' % (
        len(daftar), jenis['kaki-ada'], jenis['kaki-baru'], len(lewat),
        ', '.join('%s %d' % (k, sum(1 for _, a in lewat if a == k)) for k in sorted(set(a for _, a in lewat))))
    with io.open(os.path.join(hasil, 'ringkas.txt'), 'w', encoding='utf-8', newline='\n') as o:
        o.write(ringkas + u'\n')
    print(ringkas)


if __name__ == '__main__':
    main()
