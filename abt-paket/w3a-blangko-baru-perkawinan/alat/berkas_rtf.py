# -*- coding: utf-8 -*-
# Berkas RTF paket ABT "u4-dk-wali-perwalian" (agen U4, 20 Okt 2026). Python 2.7 (server) dan Python 3 (laptop).
#   python berkas_rtf.py cek     <akar _blangko_abt>
#   python berkas_rtf.py pasang  <akar _blangko_abt> <folder paket> <folder cadangan>
#   python berkas_rtf.py periksa <akar _blangko_abt> <folder cadangan>
#   python berkas_rtf.py pulih   <akar _blangko_abt> <folder cadangan>
# daftar-rtf.tsv  : folder<TAB>berkas<TAB>md5<TAB>asal -> berkas BARU dari <folder paket>/rtf/ (tidak pernah menimpa berkas lain).
# daftar-timpa.tsv: folder<TAB>berkas<TAB>md5_lama<TAB>md5_baru<TAB>ket -> berkas LAMA diganti isi barunya dari <folder paket>/timpa/,
#                   HANYA bila md5 berkas di server persis md5_lama (SUDAH bila persis md5_baru; selain itu GAGAL dan tidak ada yang diubah:
#                   berkas disunting orang lain - susun ulang paket dari berkas terbaru). Sebelum ditimpa berkas utuh disalin SEKALI ke
#                   <cadangan>/timpa-asal/<folder>/<berkas> (tidak pernah ditimpa). Pulih = salinan itu dikembalikan, HANYA bila isi sekarang
#                   masih persis md5_baru (kalau sudah disunting sesudah dipasang: dibiarkan dan dilaporkan).
# Pemilik/izin berkas mengikuti folder induknya. Keluar 1 bila ada GAGAL; baris akhir cek = "BERKAS SIAP", periksa = "BERKAS COCOK".
import hashlib
import io
import os
import shutil
import sys

SINI = os.path.dirname(os.path.abspath(__file__))


def md5b(b):
    return hashlib.md5(b).hexdigest()


def md5(p):
    with open(p, 'rb') as f:
        return md5b(f.read())


def tulis_atomik(p, isi, induk):
    sementara = p + '.u4baru'
    with open(sementara, 'wb') as f:
        f.write(isi)
    if os.name == 'nt' and os.path.exists(p):
        os.remove(p)
    os.rename(sementara, p)
    ikut_induk(p, induk)


def baca(nama):
    hasil = []
    p = os.path.join(SINI, nama)
    if not os.path.exists(p):
        return hasil
    for baris in io.open(p, encoding='utf-8'):
        baris = baris.rstrip('\r\n')
        if not baris or baris.startswith('#'):
            continue
        hasil.append(baris.split('\t'))
    return hasil


def ikut_induk(p, induk):
    try:
        st = os.stat(induk)
        if hasattr(os, 'chown'):
            os.chown(p, st.st_uid, st.st_gid)
        os.chmod(p, 0o644)
    except Exception:
        pass


def main():
    aksi, akar = sys.argv[1], sys.argv[2]
    baru = baca('daftar-rtf.tsv')
    folder_baru = set(x[0] for x in baca('folder-baru.txt'))   # W3a: folder yang dibuat paket sendiri (belum ada saat 'cek')
    timpa = baca('daftar-timpa.tsv')
    n = {}

    def hitung(k, pesan=''):
        n[k] = n.get(k, 0) + 1
        if k in ('GAGAL', 'HILANG', 'BIARKAN'):
            print('%s: %s' % (k, pesan))

    def jalur(folder, berkas):
        return os.path.join(akar, folder, berkas)

    if aksi in ('cek', 'pasang'):
        sumber = sys.argv[3] if aksi == 'pasang' else None
        for folder, berkas, h, _ in baru:
            dst = jalur(folder, berkas)
            src = os.path.join(sumber, 'rtf', folder, berkas) if sumber else None
            if src and (not os.path.isfile(src) or md5(src) != h):
                hitung('GAGAL', 'isi paket rusak %s/%s' % (folder, berkas))
            elif os.path.exists(dst) and md5(dst) != h:
                hitung('GAGAL', 'berkas lain bernama sama sudah ada %s/%s' % (folder, berkas))
            elif os.path.exists(dst):
                hitung('SUDAH_BARU')
            elif not os.path.isdir(os.path.join(akar, folder)) and not (aksi == 'cek' and folder in folder_baru):
                hitung('GAGAL', 'folder tidak ada %s' % folder)
        for folder, berkas, ml, mb, _k in timpa:
            dst = jalur(folder, berkas)
            src = os.path.join(sumber, 'timpa', folder, berkas) if sumber else None
            if src and (not os.path.isfile(src) or md5(src) != mb):
                hitung('GAGAL', 'isi paket rusak timpa %s/%s' % (folder, berkas))
            elif not os.path.exists(dst):
                hitung('GAGAL', 'berkas yang akan ditimpa tidak ada %s/%s' % (folder, berkas))
            else:
                h = md5(dst)
                if h == mb:
                    hitung('SUDAH_TIMPA')
                elif h == ml:
                    hitung('SIAP_TIMPA')
                else:
                    hitung('GAGAL', 'berkas %s/%s sudah berubah (md5 %s, harap %s) - disunting orang lain; susun ulang paket dari berkas terbaru' % (folder, berkas, h, ml))
        if aksi == 'cek':
            print(' '.join('%s=%d' % kv for kv in sorted(n.items())))
            print('BERKAS SIAP' if not n.get('GAGAL') else 'BERKAS TIDAK SIAP')
            sys.exit(1 if n.get('GAGAL') else 0)
        if n.get('GAGAL'):
            print('PASANG BERKAS DIBATALKAN - tidak ada yang diubah')
            sys.exit(1)
        n.clear()
        cad = sys.argv[4]
        for folder, berkas, ml, mb, _k in timpa:
            dst = jalur(folder, berkas)
            if md5(dst) == mb:
                hitung('SUDAH')
                continue
            simpan = os.path.join(cad, 'timpa-asal', folder, berkas)
            if not os.path.isdir(os.path.dirname(simpan)):
                os.makedirs(os.path.dirname(simpan))
            if not os.path.exists(simpan):
                shutil.copy2(dst, simpan)
            with open(os.path.join(sumber, 'timpa', folder, berkas), 'rb') as f:
                isi = f.read()
            tulis_atomik(dst, isi, os.path.join(akar, folder))
            hitung('TIMPA')
        for folder, berkas, h, _ in baru:
            dst = jalur(folder, berkas)
            if os.path.exists(dst):
                hitung('SUDAH')
                continue
            shutil.copyfile(os.path.join(sumber, 'rtf', folder, berkas), dst)
            ikut_induk(dst, os.path.join(akar, folder))
            hitung('BUAT')
    elif aksi == 'periksa':
        cad = sys.argv[3]
        for folder, berkas, h, _ in baru:
            dst = jalur(folder, berkas)
            hitung('COCOK') if os.path.exists(dst) and md5(dst) == h else hitung('HILANG', 'berkas baru %s/%s' % (folder, berkas))
        for folder, berkas, ml, mb, _k in timpa:
            dst = jalur(folder, berkas)
            simpan = os.path.join(cad, 'timpa-asal', folder, berkas)
            if os.path.exists(dst) and md5(dst) == mb and os.path.exists(simpan) and md5(simpan) == ml:
                hitung('COCOK')
            else:
                hitung('HILANG', 'timpa %s/%s (isi baru atau salinan asal tidak sesuai)' % (folder, berkas))
    elif aksi == 'pulih':
        cad = sys.argv[3]
        for folder, berkas, ml, mb, _k in timpa:
            dst = jalur(folder, berkas)
            simpan = os.path.join(cad, 'timpa-asal', folder, berkas)
            if not os.path.exists(dst):
                hitung('BIARKAN', 'berkas tidak ada lagi: %s/%s' % (folder, berkas))
            elif md5(dst) == ml:
                hitung('SUDAH_LAMA')
            elif md5(dst) == mb and os.path.exists(simpan) and md5(simpan) == ml:
                with open(simpan, 'rb') as f:
                    isi = f.read()
                tulis_atomik(dst, isi, os.path.join(akar, folder))
                hitung('KEMBALI')
            else:
                hitung('BIARKAN', 'berkas %s/%s sudah disunting orang sesudah dipasang (atau salinan asal tidak ada), tidak dikembalikan' % (folder, berkas))
        for folder, berkas, h, _ in baru:
            dst = jalur(folder, berkas)
            if not os.path.exists(dst):
                continue
            if md5(dst) == h:
                os.remove(dst)
                hitung('HAPUS')
            else:
                hitung('BIARKAN', 'sudah disunting sesudah dipasang, tidak dihapus: %s/%s' % (folder, berkas))
    else:
        print('aksi tidak dikenal: %s' % aksi)
        sys.exit(2)
    print(' '.join('%s=%d' % kv for kv in sorted(n.items())))
    if aksi == 'periksa':
        print('BERKAS COCOK' if not n.get('HILANG') and not n.get('GAGAL') else 'BERKAS TIDAK COCOK')
    if aksi == 'pulih':
        print('BERKAS PULIH' if not n.get('GAGAL') and not n.get('BIARKAN') else 'BERKAS PULIH SEBAGIAN')
    sys.exit(1 if n.get('GAGAL') or (aksi == 'periksa' and n.get('HILANG')) else 0)


if __name__ == '__main__':
    main()
