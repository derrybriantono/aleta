# -*- coding: utf-8 -*-
# Sunting potongan teks pada blangko RTF Derry, paket ABT "x5-kodepos-amplop-21okt" (21 Okt 2026). Python 2.7 (server) dan Python 3 (laptop).
#   python berkas_rtf.py cek     <akar _blangko_abt>
#   python berkas_rtf.py pasang  <akar _blangko_abt> <folder cadangan>
#   python berkas_rtf.py periksa <akar _blangko_abt> <folder cadangan>
#   python berkas_rtf.py pulih   <akar _blangko_abt> <folder cadangan>
# daftar-sunting.tsv: folder<TAB>berkas<TAB>md5_lama<TAB>md5_baru<TAB>dari<TAB>ke<TAB>jumlah
#   Berkas disunting HANYA bila md5-nya persis md5_lama (SUDAH bila persis md5_baru; selain itu GAGAL dan tidak ada yang diubah: berkas
#   disunting orang lain - susun ulang paket dari berkas terbaru). Teks "dari" harus ada tepat <jumlah> kali dan diganti "ke"; hasilnya
#   harus persis md5_baru, kalau tidak berkas tidak ditulis. Sebelum disunting berkas utuh disalin SEKALI ke <cadangan>/sunting-asal/<folder>/<berkas>
#   (tidak pernah ditimpa). Pemilik, kelompok, dan izin berkas ASLI dipertahankan. Pulih = salinan itu dikembalikan, HANYA bila isi sekarang
#   masih persis md5_baru (disunting orang sesudah dipasang: dibiarkan dan dilaporkan).
# Keluar 1 bila ada GAGAL; baris akhir cek = "BERKAS SIAP", periksa = "BERKAS COCOK", pulih = "BERKAS PULIH".
import hashlib
import io
import os
import shutil
import sys

SINI = os.path.dirname(os.path.abspath(__file__))


def md5b(b):
    return hashlib.md5(b).hexdigest()


def baca_berkas(p):
    with open(p, 'rb') as f:
        return f.read()


def md5(p):
    return md5b(baca_berkas(p))


def daftar():
    hasil = []
    p = os.path.join(SINI, 'daftar-sunting.tsv')
    for baris in io.open(p, encoding='utf-8'):
        baris = baris.rstrip('\r\n')
        if not baris or baris.startswith('#'):
            continue
        hasil.append(baris.split('\t'))
    return hasil


def tulis_atomik(p, isi, mode_dari):
    st = os.stat(mode_dari)
    sementara = p + '.x5baru'
    with open(sementara, 'wb') as f:
        f.write(isi)
    try:
        if hasattr(os, 'chown'):
            os.chown(sementara, st.st_uid, st.st_gid)
        os.chmod(sementara, st.st_mode & 0o7777)
    except Exception:
        pass
    if os.name == 'nt' and os.path.exists(p):
        os.remove(p)
    os.rename(sementara, p)


def main():
    aksi, akar = sys.argv[1], sys.argv[2]
    cad = sys.argv[3] if len(sys.argv) > 3 else None
    n = {}

    def hitung(k, pesan=''):
        n[k] = n.get(k, 0) + 1
        if k in ('GAGAL', 'HILANG', 'BIARKAN'):
            print('%s: %s' % (k, pesan))

    for folder, berkas, ml, mb, dari, ke, jumlah in daftar():
        dst = os.path.join(akar, folder, berkas)
        simpan = os.path.join(cad, 'sunting-asal', folder, berkas) if cad else None
        dari_b, ke_b, jumlah = dari.encode('latin1'), ke.encode('latin1'), int(jumlah)
        if aksi in ('cek', 'pasang'):
            if not os.path.isfile(dst):
                hitung('GAGAL', 'berkas tidak ada %s/%s' % (folder, berkas))
                continue
            h = md5(dst)
            if h == mb:
                hitung('SUDAH_BARU')
                continue
            if h != ml:
                hitung('GAGAL', 'berkas %s/%s sudah berubah (md5 %s, harap %s) - disunting orang lain; susun ulang paket dari berkas terbaru' % (folder, berkas, h, ml))
                continue
            isi = baca_berkas(dst)
            if isi.count(dari_b) != jumlah:
                hitung('GAGAL', '%s/%s memuat "%s" %d kali (harus %d)' % (folder, berkas, dari, isi.count(dari_b), jumlah))
                continue
            baru = isi.replace(dari_b, ke_b)
            if md5b(baru) != mb:
                hitung('GAGAL', 'hasil sunting %s/%s tidak persis isi paket (md5 %s, harap %s)' % (folder, berkas, md5b(baru), mb))
                continue
            if aksi == 'cek':
                hitung('SIAP_SUNTING')
                continue
            if not os.path.isdir(os.path.dirname(simpan)):
                os.makedirs(os.path.dirname(simpan))
            if not os.path.exists(simpan):
                shutil.copy2(dst, simpan)
            tulis_atomik(dst, baru, dst)
            hitung('SUNTING')
        elif aksi == 'periksa':
            if os.path.isfile(dst) and md5(dst) == mb and os.path.isfile(simpan) and md5(simpan) == ml:
                hitung('COCOK')
            else:
                hitung('HILANG', '%s/%s (isi baru atau salinan asal tidak sesuai)' % (folder, berkas))
        elif aksi == 'pulih':
            if not os.path.isfile(dst):
                hitung('BIARKAN', 'berkas tidak ada lagi: %s/%s' % (folder, berkas))
            elif md5(dst) == ml:
                hitung('SUDAH_LAMA')
            elif md5(dst) == mb and os.path.isfile(simpan) and md5(simpan) == ml:
                tulis_atomik(dst, baca_berkas(simpan), dst)
                hitung('KEMBALI')
            else:
                hitung('BIARKAN', '%s/%s disunting orang sesudah dipasang (atau salinan asal tidak ada), tidak dikembalikan' % (folder, berkas))
        else:
            print('aksi tidak dikenal: %s' % aksi)
            sys.exit(2)
    print(' '.join('%s=%d' % kv for kv in sorted(n.items())))
    if aksi == 'cek':
        print('BERKAS SIAP' if not n.get('GAGAL') else 'BERKAS TIDAK SIAP')
    if aksi == 'periksa':
        print('BERKAS COCOK' if not n.get('HILANG') and not n.get('GAGAL') else 'BERKAS TIDAK COCOK')
    if aksi == 'pulih':
        print('BERKAS PULIH' if not n.get('GAGAL') and not n.get('BIARKAN') else 'BERKAS PULIH SEBAGIAN')
    sys.exit(1 if n.get('GAGAL') or (aksi == 'periksa' and n.get('HILANG')) else 0)


if __name__ == '__main__':
    main()
