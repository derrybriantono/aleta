# -*- coding: utf-8 -*-
"""
Paket ABT bas-lanjutan-1nov (keputusan pengguna 82, 1 Nov 2026): kalimat "Sidang ini merupakan lanjutan dari sidang tanggal ...;
pada sidang tersebut ... hadir ...; kemudian sidang ditunda sampai dengan hari ini untuk ...;" DIBUANG dari BAS sidang lanjutan Derry,
tinggal paragraf "Susunan majelis yang bersidang sama dengan sidang yang lalu;".

Sumber kalimat: variabel ABT 8562 ("SIDANG SEBELUMNYA untuk BAS LANJUTAN"), dipakai di blangko BAS sebagai "#5404# #8562#" atau
"#5404# #8562# #8563#" dalam SATU paragraf. VARIABEL 8562 TIDAK DIUBAH (tidak ada variabel/menu/data yang diubah) - hanya pemakaiannya di
blangko BAS yang dihapus: teks " #8562#" dibuang dari paragraf itu.

Paragraf itu juga diberi format paragraf biasa seperti paragraf BAS lain: sebagian besar memakai inden gantung (\\fi-2127 \\li2127 \\lin2127)
atau tanpa inden baris pertama; inden baris pertamanya disamakan dengan paragraf sesudahnya ("Setelah sidang dibuka ...") dan inden kiri 0.
Teks, huruf, dan isian lain TIDAK disentuh.

Berkas dalam folder "terhapus" tidak diubah (bukan blangko yang dipakai).

pakai: python bangun_paket.py <akar _blangko_abt sesudah 27 paket> <folder paket-satker> <folder hasil>
"""
import base64
import hashlib
import io
import os
import re
import sys

BS = chr(92)
PENANDA = '#8562#'
RE_FI = re.compile(r'\\fi(-?\d+)(?![0-9])')
RE_LI0 = re.compile(r'\\li0(?![0-9a-z])')
RE_GANTUNG = re.compile(r'\\fi-(\d+) \\li(\d+)(?![0-9])')


def md5b(b):
    return hashlib.md5(b).hexdigest()


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


class Lewat(Exception):
    pass


def kepala(raw, a):
    """Teks pengaturan paragraf mulai raw[a] (\\pard) sampai '{' pertama."""
    return raw[a:raw.index('{', a)]


def rancang(raw):
    """-> [(offset, lama, baru)] atas berkas lama, atau Lewat."""
    n = raw.count(PENANDA)
    if n != 1:
        raise Lewat('penanda %s muncul %d kali (bukan 1)' % (PENANDA, n))
    i = raw.index(PENANDA)
    a = raw.rfind(BS + 'pard', 0, i)
    b = raw.index(BS + 'par ', i)
    if a < 0:
        raise Lewat('tanpa \\pard sebelum penanda')
    # paragraf itu harus tepat "#5404# #8562#" atau "#5404# #8562# #8563#" dalam SATU run (tanpa isi lain)
    run_a = raw.rfind('{', a, i)
    isi = raw[run_a:raw.index('}', i) + 1]
    tepat = re.search(r'#5404# #8562#( #8563#)?\}$', isi)
    if not tepat:
        raise Lewat('paragraf bukan "#5404# #8562#[ #8563#]"')
    if isi.count('{') != 1:
        raise Lewat('run penanda bersarang')
    potong = []
    # 1. buang " #8562#" (spasi di depannya ikut) - sisa "#5404#" atau "#5404# #8563#"
    pos = i - 1
    if raw[pos] != ' ':
        raise Lewat('tidak ada spasi sebelum penanda')
    potong.append((pos, ' ' + PENANDA, ''))
    # 2. format paragraf biasa: inden baris pertama = paragraf sesudahnya; inden kiri 0
    hd = kepala(raw, a)
    a2 = raw.find(BS + 'pard', b)
    if a2 < 0:
        raise Lewat('tanpa paragraf sesudahnya')
    hd2 = kepala(raw, a2)
    m2 = RE_FI.search(hd2)
    if not m2 or int(m2.group(1)) <= 0:
        raise Lewat('paragraf sesudahnya tanpa inden baris pertama')
    n_fi = m2.group(1)
    m_fi = RE_FI.search(hd)
    if m_fi and int(m_fi.group(1)) == int(n_fi) and RE_LI0.search(hd) and (BS + 'lin0') in hd:
        return potong, 'sudah-biasa'
    if m_fi and int(m_fi.group(1)) < 0:
        g = RE_GANTUNG.search(hd)
        if not g or g.group(1) != g.group(2):
            raise Lewat('inden gantung tak dikenal: ' + hd[:120])
        hd_baru = hd.replace(BS + 'fi-' + g.group(1) + ' ' + BS + 'li' + g.group(2), BS + 'fi' + n_fi + ' ' + BS + 'li0', 1)
        hd_baru = re.sub(r'\\lin' + g.group(2) + r'(?![0-9])', lambda m: BS + 'lin0', hd_baru, count=1)
        jenis = 'gantung'
    elif not m_fi:
        if len(RE_LI0.findall(hd)) != 1:
            raise Lewat('\\li0 tidak tunggal: ' + hd[:120])
        hd_baru = RE_LI0.sub(lambda m: BS + 'fi' + n_fi + ' ' + BS + 'li0', hd, count=1)
        jenis = 'tanpa-inden'
    else:
        raise Lewat('inden baris pertama lain: ' + hd[:120])
    if hd_baru == hd:
        raise Lewat('format tidak berubah')
    potong.append((a, hd, hd_baru))
    return potong, jenis


def terapkan(raw, potong):
    for off, lama, baru in sorted(potong, key=lambda x: -x[0]):
        assert raw[off:off + len(lama)] == lama, (off, lama)
        raw = raw[:off] + baru + raw[off + len(lama):]
    return raw


def sasaran(akar):
    dasar = os.path.join(akar, 'derry_briantono')
    for dp, dn, fn in os.walk(dasar):
        dn.sort()
        rel_d = os.path.relpath(dp, dasar).replace(os.sep, '/')
        if rel_d == 'terhapus' or rel_d.startswith('terhapus/'):
            continue
        for f in sorted(fn):
            if f.lower().endswith('.rtf'):
                yield ('derry_briantono/' + rel_d + '/' + f) if rel_d != '.' else ('derry_briantono/' + f)


def main():
    akar, keluar, hasil = sys.argv[1], sys.argv[2], sys.argv[3]
    for x in (keluar, hasil):
        if not os.path.isdir(x):
            os.makedirs(x)
    daftar = []
    lewat = []
    jenis_n = {}
    for rel in sorted(sasaran(akar)):
        b = open(os.path.join(akar, rel), 'rb').read()
        raw = b.decode('latin1')
        if PENANDA not in raw:
            continue
        try:
            pot, jenis = rancang(raw)
        except Lewat as e:
            lewat.append((rel, str(e)))
            continue
        baru = terapkan(raw, pot)
        if not seimbang(baru) or not seimbang(raw):
            raise SystemExit('neraca kurung berubah: ' + rel)
        if PENANDA in baru or baru.count('#5404#') != raw.count('#5404#'):
            raise SystemExit('penanda/5404 tidak sesuai: ' + rel)
        jenis_n[jenis] = jenis_n.get(jenis, 0) + 1
        daftar.append((rel, b, baru.encode('latin1'), pot, jenis))
    with io.open(os.path.join(keluar, 'daftar-tambal.tsv'), 'w', encoding='utf-8', newline='\n') as d, \
            io.open(os.path.join(keluar, 'tambal.tsv'), 'w', encoding='utf-8', newline='\n') as t:
        d.write(u'# kode\tberkas\tmd5_lama\tmd5_baru\tjumlah potongan - berkas diubah HANYA bila md5 persis md5_lama (keadaan sesudah 27 paket ../URUTAN-PASANG-1nov.md)\n')
        t.write(u'# kode\toffset\tb64(teks lama)\tb64(teks baru)\n')
        for i, (rel, lama, baru, pot, jenis) in enumerate(daftar, 1):
            kode = 'L%04d' % i
            d.write(u'%s\t%s\t%s\t%s\t%d\n' % (kode, rel, md5b(lama), md5b(baru), len(pot)))
            for off, a, z in pot:
                t.write(u'%s\t%d\t%s\t%s\n' % (kode, off, base64.b64encode(a.encode('latin1')).decode('ascii'), base64.b64encode(z.encode('latin1')).decode('ascii')))
    with io.open(os.path.join(hasil, 'jenis.tsv'), 'w', encoding='utf-8', newline='\n') as o:
        o.write(u'# kode\tberkas\tjenis paragraf lama\n')
        for i, (rel, lama, baru, pot, jenis) in enumerate(daftar, 1):
            o.write(u'L%04d\t%s\t%s\n' % (i, rel, jenis))
    with io.open(os.path.join(hasil, 'lewat.tsv'), 'w', encoding='utf-8', newline='\n') as o:
        o.write(u'# berkas yang memuat %s tetapi TIDAK diubah\talasan\n' % PENANDA)
        for rel, alasan in lewat:
            o.write(u'%s\t%s\n' % (rel, alasan))
    ringkas = 'BERKAS DIUBAH=%d (%s) | DILEWATI=%d' % (len(daftar), ', '.join('%s %d' % kv for kv in sorted(jenis_n.items())), len(lewat))
    with io.open(os.path.join(hasil, 'ringkas.txt'), 'w', encoding='utf-8', newline='\n') as o:
        o.write(ringkas + u'\n')
    print(ringkas)


if __name__ == '__main__':
    main()
