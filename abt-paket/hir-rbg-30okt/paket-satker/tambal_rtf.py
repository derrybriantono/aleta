# -*- coding: utf-8 -*-
# Tambal blangko RTF dengan PENJAGA md5 (paket G6 30 Okt 2026: hir-rbg-30okt, titik-koma-teks-30okt). Python 2.7 (server) dan Python 3 (laptop).
# Ubahan disimpan sebagai potongan (offset, teks lama, teks baru) atas berkas yang md5-nya PERSIS md5_lama - bukan salinan utuh blangko.
#   python tambal_rtf.py cek     <akar _blangko_abt>
#   python tambal_rtf.py pasang  <akar _blangko_abt> <folder cadangan>
#   python tambal_rtf.py periksa <akar _blangko_abt>
#   python tambal_rtf.py pulih   <akar _blangko_abt> <folder cadangan>
# daftar-tambal.tsv: kode<TAB>berkas (relatif _blangko_abt)<TAB>md5_lama<TAB>md5_baru<TAB>jumlah potongan
# tambal.tsv       : kode<TAB>offset<TAB>b64(teks lama)<TAB>b64(teks baru)   (offset atas berkas LAMA; diterapkan dari belakang)
# cek    : SIAP (md5 = lama, tiap potongan tepat, hasil = md5_baru) / SUDAH (md5 = baru) / GAGAL (lain). Baris akhir "BERKAS SIAP" bila tanpa GAGAL.
# pasang : HANYA berkas SIAP: berkas utuh disalin SEKALI ke <cadangan>/rtf-lama/<kode>.rtf (md5 diperiksa), ditulis atomik, dibaca ulang.
#          Satu saja gagal = semua yang sudah ditulis dikembalikan, keluar 1. Pemilik/izin mengikuti folder induk.
# periksa: semua berkas md5 = md5_baru -> "BERKAS COCOK".
# pulih  : berkas yang ditambal paket ini dikembalikan dari cadangan HANYA bila md5 sekarang masih md5_baru (yang sudah disunting
#          orang dibiarkan, dilaporkan). Tidak ada hapus permanen. Baris akhir "BERKAS PULIH" / "BERKAS PULIH SEBAGIAN".
import base64
import hashlib
import os
import shutil
import sys

SINI = os.path.dirname(os.path.abspath(__file__))


def md5b(b):
    return hashlib.md5(b).hexdigest()


def baca_tsv(nama):
    keluar = []
    with open(os.path.join(SINI, nama), 'rb') as f:
        for l in f.read().decode('utf-8').split('\n'):
            l = l.rstrip('\r')
            if l and not l.startswith('#'):
                keluar.append(l.split('\t'))
    return keluar


def baca(p):
    try:
        with open(p, 'rb') as f:
            return f.read()
    except (IOError, OSError):
        return None


def ikut_induk(p):
    try:
        st = os.stat(os.path.dirname(p))
        if hasattr(os, 'chown'):
            os.chown(p, st.st_uid, st.st_gid)
        os.chmod(p, 0o644)
    except Exception:
        pass


def tulis_atomik(p, isi):
    s = p + '.tambalbaru'
    with open(s, 'wb') as f:
        f.write(isi)
    if os.name == 'nt' and os.path.exists(p):
        os.remove(p)
    os.rename(s, p)
    ikut_induk(p)


def tambalan():
    per = {}
    for kode, off, lama, baru in baca_tsv('tambal.tsv'):
        per.setdefault(kode, []).append((int(off), base64.b64decode(lama), base64.b64decode(baru)))
    return per


def terapkan(isi, potong):
    for off, lama, baru in sorted(potong, key=lambda x: -x[0]):
        if isi[off:off + len(lama)] != lama:
            return None
        isi = isi[:off] + baru + isi[off + len(lama):]
    return isi


def nilai(akar, d, per):
    kode, rel, m0, m1, _ = d
    isi = baca(os.path.join(akar, rel))
    if isi is None:
        return 'GAGAL', 'tidak ada', None
    m = md5b(isi)
    if m == m1:
        return 'SUDAH', '', None
    if m != m0:
        return 'GAGAL', 'md5 %s bukan dasar %s (disunting orang/paket lain belum terpasang)' % (m, m0), None
    h = terapkan(isi, per.get(kode, []))
    if h is None or md5b(h) != m1:
        return 'GAGAL', 'potongan tidak tepat', None
    return 'SIAP', '', h


def main():
    aksi, akar = sys.argv[1], sys.argv[2]
    daftar = baca_tsv('daftar-tambal.tsv')
    per = tambalan()
    n = {}

    def hit(k):
        n[k] = n.get(k, 0) + 1

    if aksi == 'cek':
        for d in daftar:
            st, ket, _ = nilai(akar, d, per)
            hit(st)
            if st == 'GAGAL':
                print('GAGAL\t%s\t%s' % (d[1], ket))
        print(' '.join('%s=%d' % kv for kv in sorted(n.items())))
        print('BERKAS SIAP' if not n.get('GAGAL') else 'BERKAS TIDAK SIAP')
        return 0
    if aksi == 'pasang':
        cad = sys.argv[3]
        lama_dir = os.path.join(cad, 'rtf-lama')
        if not os.path.isdir(lama_dir):
            os.makedirs(lama_dir)
        catatan = os.path.join(cad, 'berkas-ditambal.txt')
        rencana = []
        for d in daftar:
            st, ket, h = nilai(akar, d, per)
            if st == 'GAGAL':
                print('GAGAL\t%s\t%s' % (d[1], ket))
                print('PASANG BERKAS DIBATALKAN - tidak ada yang diubah')
                return 1
            if st == 'SIAP':
                rencana.append((d, h))
            else:
                hit('SUDAH')
        ditulis = []
        with open(catatan, 'ab') as log:
            for d, h in rencana:
                kode, rel, m0, m1, _ = d
                p = os.path.join(akar, rel)
                c = os.path.join(lama_dir, kode + '.rtf')
                if not os.path.exists(c):
                    shutil.copyfile(p, c)
                if md5b(baca(c) or b'') != m0:
                    print('GAGAL\t%s\tcadangan tidak utuh' % rel)
                    break
                tulis_atomik(p, h)
                if md5b(baca(p) or b'') != m1:
                    tulis_atomik(p, baca(c))
                    print('GAGAL\t%s\tmd5 sesudah tulis tidak cocok' % rel)
                    break
                log.write(('%s\t%s\n' % (kode, rel)).encode('utf-8'))
                ditulis.append((d, c))
                hit('TAMBAL')
            else:
                print(' '.join('%s=%d' % kv for kv in sorted(n.items())))
                return 0
        for d, c in ditulis:
            tulis_atomik(os.path.join(akar, d[1]), baca(c))
        print('PASANG BERKAS GAGAL - %d berkas dikembalikan' % len(ditulis))
        return 1
    if aksi == 'periksa':
        for d in daftar:
            isi = baca(os.path.join(akar, d[1]))
            if isi is not None and md5b(isi) == d[3]:
                hit('COCOK')
            else:
                hit('BEDA')
                print('BEDA\t%s' % d[1])
        print(' '.join('%s=%d' % kv for kv in sorted(n.items())))
        print('BERKAS COCOK' if not n.get('BEDA') else 'BERKAS TIDAK COCOK')
        return 0
    if aksi == 'pulih':
        cad = sys.argv[3]
        menurut = dict((d[0], d) for d in daftar)
        catatan = os.path.join(cad, 'berkas-ditambal.txt')
        kode_ditambal = []
        if os.path.exists(catatan):
            for l in open(catatan, 'rb').read().decode('utf-8').split('\n'):
                if l.strip():
                    kode_ditambal.append(l.split('\t')[0])
        for kode in sorted(set(kode_ditambal)):
            d = menurut[kode]
            p = os.path.join(akar, d[1])
            isi = baca(p)
            c = baca(os.path.join(cad, 'rtf-lama', kode + '.rtf'))
            if isi is not None and md5b(isi) == d[2]:
                hit('SUDAH')
            elif isi is not None and md5b(isi) == d[3] and c is not None and md5b(c) == d[2]:
                tulis_atomik(p, c)
                hit('PULIH')
            else:
                hit('BIARKAN')
                print('BIARKAN\t%s\t(sudah disunting sesudah dipasang)' % d[1])
        print(' '.join('%s=%d' % kv for kv in sorted(n.items())))
        print('BERKAS PULIH' if not n.get('BIARKAN') else 'BERKAS PULIH SEBAGIAN')
        if os.path.exists(catatan):
            os.rename(catatan, catatan + '.dipulihkan')
        return 0
    print('aksi tidak dikenal: %s' % aksi)
    return 2


if __name__ == '__main__':
    sys.exit(main())
