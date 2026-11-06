# -*- coding: utf-8 -*-
# Tambal blangko RTF dengan PENJAGA md5 (dasar: paket G6 30 Okt 2026, dipakai a5-merah-5nov, a5-kelompok-5nov, saksi-tanya-jawab-43-5nov).
# Python 2.7 (server) dan Python 3 (laptop). Dua macam ubahan:
#   1. TAMBAL : berkas lama disunting per potongan (offset, teks lama, teks baru) atas berkas yang md5-nya PERSIS md5_lama.
#   2. BARU   : berkas yang BELUM ada ditulis dari rtf-baru/<kode>.rtf (tidak pernah menimpa berkas lain).
#   python tambal_rtf.py cek     <akar _blangko_abt>
#   python tambal_rtf.py pasang  <akar _blangko_abt> <folder cadangan>
#   python tambal_rtf.py periksa <akar _blangko_abt>
#   python tambal_rtf.py pulih   <akar _blangko_abt> <folder cadangan>
# daftar-tambal.tsv: kode<TAB>berkas (relatif _blangko_abt)<TAB>md5_lama<TAB>md5_baru<TAB>jumlah potongan
# tambal.tsv       : kode<TAB>offset<TAB>b64(teks lama)<TAB>b64(teks baru)   (offset atas berkas LAMA; diterapkan dari belakang)
# daftar-baru.tsv  : kode<TAB>berkas (relatif _blangko_abt)<TAB>md5   (isi dari rtf-baru/<kode>.rtf)
# cek    : TAMBAL: SIAP (md5 = lama, tiap potongan tepat, hasil = md5_baru) / SUDAH (md5 = baru) / GAGAL (lain).
#          BARU  : SIAP (belum ada, folder induk ada) / SUDAH (ada, md5 sama) / GAGAL (ada berkas lain atau folder induk tidak ada).
#          Baris akhir "BERKAS SIAP" bila tanpa GAGAL.
# pasang : HANYA bila semua SIAP/SUDAH: berkas lama disalin SEKALI ke <cadangan>/rtf-lama/<kode>.rtf (md5 diperiksa), ditulis atomik, dibaca ulang;
#          berkas baru ditulis atomik dan dibaca ulang. Satu saja gagal = semua yang sudah ditulis dikembalikan, keluar 1.
# periksa: semua berkas md5 = md5_baru -> "BERKAS COCOK".
# pulih  : berkas yang ditambal dikembalikan dari cadangan HANYA bila md5 sekarang masih md5_baru; berkas baru DIPINDAH (bukan dihapus) ke
#          <cadangan>/rtf-baru-dipulihkan/ HANYA bila md5 sekarang masih md5 paket. Yang sudah disunting orang dibiarkan dan dilaporkan.
#          Tidak ada hapus permanen. Baris akhir "BERKAS PULIH" / "BERKAS PULIH SEBAGIAN".
import base64
import hashlib
import os
import shutil
import sys
import time

SINI = os.path.dirname(os.path.abspath(__file__))


def md5b(b):
    return hashlib.md5(b).hexdigest()


def baca_tsv(nama, wajib=True):
    keluar = []
    p = os.path.join(SINI, nama)
    if not os.path.exists(p):
        if wajib:
            raise IOError(p)
        return keluar
    with open(p, 'rb') as f:
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


def isi_paket(kode):
    return baca(os.path.join(SINI, 'rtf-baru', kode + '.rtf'))


def nilai_baru(akar, d):
    kode, rel, m = d
    asal = isi_paket(kode)
    if asal is None or md5b(asal) != m:
        return 'GAGAL', 'rtf-baru/%s.rtf tidak utuh' % kode
    p = os.path.join(akar, rel)
    if os.path.exists(p):
        isi = baca(p)
        if isi is not None and md5b(isi) == m:
            return 'SUDAH', ''
        return 'GAGAL', 'sudah ada berkas lain dengan nama sama'
    if not os.path.isdir(os.path.dirname(p)):
        return 'GAGAL', 'folder tujuan tidak ada'
    return 'SIAP', ''


def main():
    aksi, akar = sys.argv[1], sys.argv[2]
    daftar = baca_tsv('daftar-tambal.tsv')
    baru = baca_tsv('daftar-baru.tsv', False)
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
        for d in baru:
            st, ket = nilai_baru(akar, d)
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
        catatan_baru = os.path.join(cad, 'berkas-baru.txt')
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
        rencana_baru = []
        for d in baru:
            st, ket = nilai_baru(akar, d)
            if st == 'GAGAL':
                print('GAGAL\t%s\t%s' % (d[1], ket))
                print('PASANG BERKAS DIBATALKAN - tidak ada yang diubah')
                return 1
            if st == 'SIAP':
                rencana_baru.append(d)
            else:
                hit('SUDAH')
        ditulis = []
        ditulis_baru = []
        galat = False
        with open(catatan, 'ab') as log:
            for d, h in rencana:
                kode, rel, m0, m1, _ = d
                p = os.path.join(akar, rel)
                c = os.path.join(lama_dir, kode + '.rtf')
                if not os.path.exists(c):
                    shutil.copyfile(p, c)
                if md5b(baca(c) or b'') != m0:
                    print('GAGAL\t%s\tcadangan tidak utuh' % rel)
                    galat = True
                    break
                tulis_atomik(p, h)
                if md5b(baca(p) or b'') != m1:
                    tulis_atomik(p, baca(c))
                    print('GAGAL\t%s\tmd5 sesudah tulis tidak cocok' % rel)
                    galat = True
                    break
                log.write(('%s\t%s\n' % (kode, rel)).encode('utf-8'))
                ditulis.append((d, c))
                hit('TAMBAL')
        if not galat:
            with open(catatan_baru, 'ab') as log:
                for d in rencana_baru:
                    kode, rel, m = d
                    p = os.path.join(akar, rel)
                    tulis_atomik(p, isi_paket(kode))
                    ditulis_baru.append(p)
                    if md5b(baca(p) or b'') != m:
                        print('GAGAL\t%s\tmd5 sesudah tulis tidak cocok' % rel)
                        galat = True
                        break
                    log.write(('%s\t%s\n' % (kode, rel)).encode('utf-8'))
                    hit('BARU')
        if not galat:
            print(' '.join('%s=%d' % kv for kv in sorted(n.items())))
            return 0
        for d, c in ditulis:
            tulis_atomik(os.path.join(akar, d[1]), baca(c))
        for p in ditulis_baru:
            # berkas baru yang gagal dibaca ulang dipindah ke cadangan, bukan dihapus
            dst = os.path.join(cad, 'rtf-baru-gagal')
            if not os.path.isdir(dst):
                os.makedirs(dst)
            shutil.move(p, os.path.join(dst, os.path.basename(p)))
        print('PASANG BERKAS GAGAL - %d berkas dikembalikan' % (len(ditulis) + len(ditulis_baru)))
        return 1
    if aksi == 'periksa':
        for d in daftar:
            isi = baca(os.path.join(akar, d[1]))
            if isi is not None and md5b(isi) == d[3]:
                hit('COCOK')
            else:
                hit('BEDA')
                print('BEDA\t%s' % d[1])
        for d in baru:
            isi = baca(os.path.join(akar, d[1]))
            if isi is not None and md5b(isi) == d[2]:
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
        menurut_baru = dict((d[0], d) for d in baru)
        catatan = os.path.join(cad, 'berkas-ditambal.txt')
        catatan_baru = os.path.join(cad, 'berkas-baru.txt')
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
        kode_baru = []
        if os.path.exists(catatan_baru):
            for l in open(catatan_baru, 'rb').read().decode('utf-8').split('\n'):
                if l.strip():
                    kode_baru.append(l.split('\t')[0])
        for kode in sorted(set(kode_baru)):
            d = menurut_baru[kode]
            p = os.path.join(akar, d[1])
            isi = baca(p)
            if isi is None:
                hit('SUDAH')
            elif md5b(isi) == d[2]:
                dst = os.path.join(cad, 'rtf-baru-dipulihkan')
                if not os.path.isdir(dst):
                    os.makedirs(dst)
                shutil.move(p, os.path.join(dst, kode + '.rtf'))
                hit('PULIH')
            else:
                hit('BIARKAN')
                print('BIARKAN\t%s\t(sudah disunting sesudah dipasang)' % d[1])
        print(' '.join('%s=%d' % kv for kv in sorted(n.items())))
        print('BERKAS PULIH' if not n.get('BIARKAN') else 'BERKAS PULIH SEBAGIAN')
        for c in (catatan, catatan_baru):
            if os.path.exists(c):
                os.rename(c, c + '.dipulihkan.' + str(int(time.time())))
        return 0
    print('aksi tidak dikenal: %s' % aksi)
    return 2


if __name__ == '__main__':
    sys.exit(main())
