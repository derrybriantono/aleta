# -*- coding: utf-8 -*-
# Berkas RTF paket ABT "sela-ps-30okt" (30 Okt 2026; pola court-calendar-28okt). Python 2.7 (server) dan Python 3 (laptop).
# PULIH TIDAK MENGHAPUS PERMANEN: berkas BARU paket ini dipindah ke <cadangan>/pulih-arsip/<folder>/<berkas> (bila nama itu sudah ada di arsip,
# diberi akhiran waktu); berkas yang DITIMPA dikembalikan dari salinan asal dan isi paketnya disimpan juga ke pulih-arsip.
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
# daftar-lama.tsv : folder<TAB>berkas<TAB>md5_lama -> PENINGKATAN: berkas paket SEBELUMNYA (yang sudah terpasang) diganti isi barunya dari <folder paket>/rtf/, HANYA bila md5 di server
#                   persis md5_lama. Sebelum diganti berkas lama disalin SEKALI ke <cadangan>/timpa-asal/<folder>/<berkas>. Pulih = salinan itu dikembalikan (HANYA bila isi sekarang
#                   masih persis isi paket ini). Berkas yang DIBUAT paket ini dicatat di <cadangan>/berkas-dibuat.txt; pulih hanya menghapus yang tercatat di sana (berkas lama yang
#                   sudah ada sebelum paket ini tidak pernah dihapus).
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
    sementara = p + '.selabaru'
    with open(sementara, 'wb') as f:
        f.write(isi)
    if os.name == 'nt' and os.path.exists(p):
        os.remove(p)
    os.rename(sementara, p)
    ikut_induk(p, induk)


def tujuan_arsip(cad, folder, berkas):
    d = os.path.join(cad, 'pulih-arsip', folder)
    if not os.path.isdir(d):
        os.makedirs(d)
    t = os.path.join(d, berkas)
    if os.path.exists(t):
        import time
        t = os.path.join(d, '%s.%s' % (berkas, time.strftime('%Y%m%d%H%M%S')))
    return t


def arsipkan(cad, folder, berkas, dst):
    """Pindahkan (bukan hapus) berkas baru paket ke arsip pulih."""
    shutil.move(dst, tujuan_arsip(cad, folder, berkas))


def salin_arsip(cad, folder, berkas, dst):
    shutil.copy2(dst, tujuan_arsip(cad, folder, berkas))


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
    lama = dict(((x[0], x[1]), x[2]) for x in baca('daftar-lama.tsv'))   # (folder, berkas) -> md5 paket sebelumnya
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
            elif os.path.exists(dst) and md5(dst) == h:
                hitung('SUDAH_BARU')
            elif os.path.exists(dst) and (folder, berkas) in lama and md5(dst) == lama[(folder, berkas)]:
                hitung('SIAP_PENINGKATAN')
            elif os.path.exists(dst):
                hitung('GAGAL', 'berkas %s/%s bukan isi paket ini maupun paket sebelumnya (md5 %s) - disunting orang lain atau berkas lain bernama sama' % (folder, berkas, md5(dst)))
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
        catatan = os.path.join(cad, 'berkas-dibuat.txt')
        if not os.path.exists(catatan):
            io.open(catatan, 'w', encoding='utf-8').close()
        for folder, berkas, h, _ in baru:
            dst = jalur(folder, berkas)
            if os.path.exists(dst) and md5(dst) == h:
                hitung('SUDAH')
                continue
            if os.path.exists(dst):
                # peningkatan: berkas paket sebelumnya (md5 sudah dicek di atas) diganti; salinan asal disimpan SEKALI
                simpan = os.path.join(cad, 'timpa-asal', folder, berkas)
                if not os.path.isdir(os.path.dirname(simpan)):
                    os.makedirs(os.path.dirname(simpan))
                if not os.path.exists(simpan):
                    shutil.copy2(dst, simpan)
                with open(os.path.join(sumber, 'rtf', folder, berkas), 'rb') as f:
                    isi = f.read()
                tulis_atomik(dst, isi, os.path.join(akar, folder))
                hitung('GANTI')
                continue
            shutil.copyfile(os.path.join(sumber, 'rtf', folder, berkas), dst)
            ikut_induk(dst, os.path.join(akar, folder))
            with io.open(catatan, 'a', encoding='utf-8') as f:
                f.write(u'%s\t%s\n' % (folder, berkas))
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
                salin_arsip(cad, folder, berkas, dst)
                tulis_atomik(dst, isi, os.path.join(akar, folder))
                hitung('KEMBALI')
            else:
                hitung('BIARKAN', 'berkas %s/%s sudah disunting orang sesudah dipasang (atau salinan asal tidak ada), tidak dikembalikan' % (folder, berkas))
        catatan = os.path.join(cad, 'berkas-dibuat.txt')
        dibuat = None
        if os.path.exists(catatan):
            dibuat = set(tuple(x.split('\t')[:2]) for x in io.open(catatan, encoding='utf-8').read().split('\n') if x.strip())
        for folder, berkas, h, _ in baru:
            dst = jalur(folder, berkas)
            if not os.path.exists(dst):
                continue
            simpan = os.path.join(cad, 'timpa-asal', folder, berkas)
            if (folder, berkas) in lama and os.path.exists(simpan) and md5(simpan) == lama[(folder, berkas)]:
                # peningkatan: kembalikan isi paket sebelumnya
                if md5(dst) == h:
                    with open(simpan, 'rb') as f:
                        isi = f.read()
                    tulis_atomik(dst, isi, os.path.join(akar, folder))
                    hitung('KEMBALI')
                elif md5(dst) == lama[(folder, berkas)]:
                    hitung('SUDAH_LAMA')
                else:
                    hitung('BIARKAN', 'sudah disunting sesudah dipasang, tidak dikembalikan: %s/%s' % (folder, berkas))
                continue
            if dibuat is not None and (folder, berkas) not in dibuat:
                hitung('TETAP')   # sudah ada sebelum paket ini dan tidak diganti
                continue
            if md5(dst) == h:
                arsipkan(cad, folder, berkas, dst)
                hitung('ARSIP')
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
