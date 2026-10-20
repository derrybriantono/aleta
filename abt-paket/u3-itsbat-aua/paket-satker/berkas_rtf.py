# -*- coding: utf-8 -*-
# Berkas RTF paket "abt-pengumuman-itsbat" (14 Okt 2026, agen S2; salinan berkas_rtf.py paket abt-blangko-derry-rapi). Python 2.7 (server) dan Python 3 (laptop).
#   python berkas_rtf.py pasang  <akar _blangko_abt> <folder rtf paket> <folder cadangan>
#   python berkas_rtf.py periksa <akar _blangko_abt> <folder cadangan>
#   python berkas_rtf.py pulih   <akar _blangko_abt> <folder cadangan>
# daftar-rtf.tsv    : folder<TAB>berkas<TAB>md5<TAB>asal  -> berkas BARU (tidak pernah menimpa berkas lain).
# daftar-singkir.tsv: folder<TAB>berkas<TAB>md5          -> berkas yang DIPINDAH ke <cadangan>/singkir/<folder>/ (bukan dihapus).
# Folder relatif terhadap _blangko_abt. Pemilik/izin berkas baru mengikuti folder induknya (mis. apache:apache).
# Keluar 1 bila ada GAGAL; baris terakhir periksa = "BERKAS COCOK" bila semuanya sesuai.
import hashlib, io, os, shutil, sys

SINI = os.path.dirname(os.path.abspath(__file__))


def md5(p):
    with open(p, 'rb') as f:
        return hashlib.md5(f.read()).hexdigest()


def baca(nama):
    hasil = []
    for baris in io.open(os.path.join(SINI, nama), encoding='utf-8'):
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
        os.chmod(p, 0o755 if os.path.isdir(p) else 0o644)
    except Exception:
        pass


def main():
    aksi, akar = sys.argv[1], sys.argv[2]
    baru = baca('daftar-rtf.tsv')
    singkir = baca('daftar-singkir.tsv')
    n = {}

    def hitung(k, pesan):
        n[k] = n.get(k, 0) + 1
        if k in ('GAGAL', 'HILANG', 'BIARKAN'):
            print('%s: %s' % (k, pesan))

    if aksi == 'pasang':
        sumber, cad = sys.argv[3], sys.argv[4]
        # periksa SEMUA lebih dulu - tidak ada yang dipindah/disalin bila satu saja tidak sesuai
        for folder, berkas, h, _ in baru:
            src = os.path.join(sumber, folder, berkas)
            dst = os.path.join(akar, folder, berkas)
            if not os.path.isfile(src) or md5(src) != h:
                hitung('GAGAL', 'isi paket rusak %s/%s' % (folder, berkas))
            elif os.path.exists(dst) and md5(dst) != h:
                hitung('GAGAL', 'berkas lain bernama sama sudah ada %s/%s' % (folder, berkas))
            elif not os.path.isdir(os.path.join(akar, folder)):
                hitung('GAGAL', 'folder tidak ada %s' % folder)
        for folder, berkas, h in singkir:
            asal = os.path.join(akar, folder, berkas)
            simpan = os.path.join(cad, 'singkir', folder, berkas)
            if os.path.exists(asal) and md5(asal) != h:
                hitung('GAGAL', 'berkas yang akan disingkirkan sudah berubah %s/%s' % (folder, berkas))
            elif not os.path.exists(asal) and not (os.path.exists(simpan) and md5(simpan) == h):
                hitung('GAGAL', 'berkas yang akan disingkirkan tidak ada %s/%s' % (folder, berkas))
        if n.get('GAGAL'):
            print('PASANG BERKAS DIBATALKAN - tidak ada yang diubah')
            sys.exit(1)
        for folder, berkas, h in singkir:
            asal = os.path.join(akar, folder, berkas)
            simpan = os.path.join(cad, 'singkir', folder, berkas)
            if not os.path.exists(asal):
                hitung('SUDAH', '')
                continue
            if not os.path.isdir(os.path.dirname(simpan)):
                os.makedirs(os.path.dirname(simpan))
            shutil.copy2(asal, simpan)
            if md5(simpan) != h:
                hitung('GAGAL', 'salinan cadangan rusak %s/%s' % (folder, berkas))
                continue
            os.remove(asal)
            hitung('SINGKIR', '')
        for folder, berkas, h, _ in baru:
            dst = os.path.join(akar, folder, berkas)
            if os.path.exists(dst):
                hitung('SUDAH', '')
                continue
            shutil.copyfile(os.path.join(sumber, folder, berkas), dst)
            ikut_induk(dst, os.path.join(akar, folder))
            hitung('PASANG', '')
    elif aksi == 'periksa':
        cad = sys.argv[3]
        for folder, berkas, h, _ in baru:
            dst = os.path.join(akar, folder, berkas)
            if os.path.exists(dst) and md5(dst) == h:
                hitung('COCOK', '')
            else:
                hitung('HILANG', 'berkas baru %s/%s' % (folder, berkas))
        for folder, berkas, h in singkir:
            asal = os.path.join(akar, folder, berkas)
            simpan = os.path.join(cad, 'singkir', folder, berkas)
            if not os.path.exists(asal) and os.path.exists(simpan) and md5(simpan) == h:
                hitung('TERSINGKIR', '')
            else:
                hitung('HILANG', 'singkiran %s/%s (masih di folder atau cadangan tidak ada)' % (folder, berkas))
    elif aksi == 'pulih':
        cad = sys.argv[3]
        for folder, berkas, h, _ in baru:
            dst = os.path.join(akar, folder, berkas)
            if not os.path.exists(dst):
                continue
            if md5(dst) == h:
                os.remove(dst)
                hitung('PULIH', '')
            else:
                hitung('BIARKAN', 'sudah disunting sesudah dipasang, tidak dihapus: %s/%s' % (folder, berkas))
        for folder, berkas, h in singkir:
            asal = os.path.join(akar, folder, berkas)
            simpan = os.path.join(cad, 'singkir', folder, berkas)
            if os.path.exists(asal):
                hitung('ADA', '')
            elif os.path.exists(simpan) and md5(simpan) == h:
                shutil.copy2(simpan, asal)
                ikut_induk(asal, os.path.join(akar, folder))
                hitung('KEMBALI', '')
            else:
                hitung('GAGAL', 'cadangan singkiran tidak ada %s/%s' % (folder, berkas))
    else:
        print('aksi tidak dikenal: %s' % aksi)
        sys.exit(2)
    print(' '.join('%s=%d' % kv for kv in sorted(n.items())))
    if aksi == 'periksa':
        print('BERKAS COCOK' if not n.get('HILANG') else 'BERKAS TIDAK COCOK')
    sys.exit(1 if n.get('GAGAL') or (aksi == 'periksa' and n.get('HILANG')) else 0)


if __name__ == '__main__':
    main()
