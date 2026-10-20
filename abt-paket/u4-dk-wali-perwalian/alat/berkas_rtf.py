# -*- coding: utf-8 -*-
# Berkas RTF paket ABT agen I17 (paket I17) (17 Okt 2026; dasar alat F21 + SUNTING). Python 2.7 (server) dan Python 3 (laptop).
#   python berkas_rtf.py cek     <akar _blangko_abt>                       (baca saja: semua tujuan sesuai?)
#   python berkas_rtf.py pasang  <akar _blangko_abt> <folder paket> <folder cadangan>
#   python berkas_rtf.py periksa <akar _blangko_abt> <folder cadangan>
#   python berkas_rtf.py pulih   <akar _blangko_abt> <folder cadangan>
# daftar-rtf.tsv    : folder<TAB>berkas<TAB>md5<TAB>asal -> berkas BARU dari <folder paket>/rtf/ (tidak pernah menimpa berkas lain).
# daftar-sunting.tsv: folder<TAB>berkas<TAB>id<TAB>md5_lama<TAB>md5_baru<TAB>ket -> di berkas LAMA, potongan RTF <folder paket>/sunting/<id>.lama
#                     (harus TEPAT sekali) diganti sunting/<id>.baru, urut id. Sebelum disunting, berkas utuh disalin SEKALI ke
#                     <cadangan>/sunting-asal/<folder>/<berkas> (tidak pernah ditimpa). SUDAH = potongan baru tepat sekali ada.
#                     Pulih = penggantian balik (baru -> lama) urut terbalik, sehingga perubahan paket lain (mis. agen I6) di bagian
#                     berkas yang lain tetap utuh. Bagian yang sudah disunting orang (potongan baru tidak ada lagi) dibiarkan & dilaporkan.
# Pemilik/izin berkas mengikuti folder induknya. Keluar 1 bila ada GAGAL; baris akhir cek = "BERKAS SIAP", periksa = "BERKAS COCOK".
import hashlib, io, os, shutil, sys

SINI = os.path.dirname(os.path.abspath(__file__))


def md5b(b):
    return hashlib.md5(b).hexdigest()


def md5(p):
    with open(p, 'rb') as f:
        return md5b(f.read())


def baca_berkas(p):
    with open(p, 'rb') as f:
        return f.read()


def tulis_atomik(p, isi, induk):
    sementara = p + '.i17baru'
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


def potongan(i):
    return (baca_berkas(os.path.join(SINI, 'sunting', i + '.lama')), baca_berkas(os.path.join(SINI, 'sunting', i + '.baru')))


def main():
    aksi, akar = sys.argv[1], sys.argv[2]
    baru = baca('daftar-rtf.tsv')
    sunting = baca('daftar-sunting.tsv')
    pindah = baca('daftar-pindah.tsv')
    n = {}

    def hitung(k, pesan=''):
        n[k] = n.get(k, 0) + 1
        if k in ('GAGAL', 'HILANG', 'BIARKAN'):
            print('%s: %s' % (k, pesan))

    def jalur(folder, berkas):
        return os.path.join(akar, folder, berkas)

    # keutuhan potongan sunting di paket
    for folder, berkas, i, ml, mb, _k in sunting:
        try:
            la, ba = potongan(i)
        except IOError:
            la, ba = b'', b''
        if md5b(la) != ml or md5b(ba) != mb:
            hitung('GAGAL', 'isi paket rusak sunting/%s (%s/%s)' % (i, folder, berkas))

    # berkas DASAR (soft): md5 di pohon proyeksi (server + paket I6..I14 + F22); beda = PERINGATAN saja (susunan baru bisa kehilangan sunting paket lain)
    if aksi == 'cek':
        for folder, berkas, h in baca('daftar-dasar.tsv'):
            dst = jalur(folder, berkas)
            if not os.path.exists(dst):
                print('PERINGATAN: berkas dasar tidak ada: %s/%s' % (folder, berkas))
                n['DASAR_HILANG'] = n.get('DASAR_HILANG', 0) + 1
            elif md5(dst) != h:
                print('PERINGATAN: berkas dasar berbeda dari pohon proyeksi (paket I6..I14/F22 belum/sudah lain?): %s/%s' % (folder, berkas))
                n['DASAR_BEDA'] = n.get('DASAR_BEDA', 0) + 1
            else:
                n['DASAR_SAMA'] = n.get('DASAR_SAMA', 0) + 1
    if aksi in ('cek', 'pasang'):
        sumber = sys.argv[3] if aksi == 'pasang' else None
        cad = sys.argv[4] if aksi == 'pasang' else None
        for folder, berkas, h, _ in baru:
            dst = jalur(folder, berkas)
            src = os.path.join(sumber, 'rtf', folder, berkas) if sumber else None
            if src and (not os.path.isfile(src) or md5(src) != h):
                hitung('GAGAL', 'isi paket rusak %s/%s' % (folder, berkas))
            elif os.path.exists(dst) and md5(dst) != h:
                hitung('GAGAL', 'berkas lain bernama sama sudah ada %s/%s' % (folder, berkas))
            elif os.path.exists(dst):
                hitung('SUDAH_BARU')
        for folder, berkas, i, ml, mb, _k in sunting:
            dst = jalur(folder, berkas)
            if not os.path.exists(dst):
                hitung('GAGAL', 'berkas yang akan disunting tidak ada %s/%s' % (folder, berkas))
                continue
            isi = baca_berkas(dst)
            la, ba = potongan(i)
            if isi.count(ba) == 1:
                hitung('SUDAH_SUNTING')
            elif isi.count(ba) == 0 and isi.count(la) == 1:
                hitung('SIAP_SUNTING')
            else:
                hitung('GAGAL', 'potongan %s tidak tepat sekali (lama %d, baru %d) di %s/%s' % (i, isi.count(la), isi.count(ba), folder, berkas))
        for asal, berkas, tujuan in pindah:
            s, d = jalur(asal, berkas), jalur(tujuan, berkas)
            if os.path.exists(s) and not os.path.exists(d):
                hitung('SIAP_PINDAH')
            elif not os.path.exists(s) and os.path.exists(d):
                hitung('SUDAH_PINDAH')
            else:
                hitung('GAGAL', 'pindah tidak bisa (asal ada=%s, tujuan ada=%s) %s/%s' % (os.path.exists(s), os.path.exists(d), asal, berkas))
        if aksi == 'cek':
            print(' '.join('%s=%d' % kv for kv in sorted(n.items())))
            print('BERKAS SIAP' if not n.get('GAGAL') else 'BERKAS TIDAK SIAP')
            sys.exit(1 if n.get('GAGAL') else 0)
        if n.get('GAGAL'):
            print('PASANG BERKAS DIBATALKAN - tidak ada yang diubah')
            sys.exit(1)
        n.clear()
        # sunting: per berkas, salin utuh ke cadangan sekali, terapkan potongan urut, tulis atomik
        per = {}
        for folder, berkas, i, ml, mb, _k in sunting:
            per.setdefault((folder, berkas), []).append(i)
        for (folder, berkas), ids in sorted(per.items()):
            dst = jalur(folder, berkas)
            isi = baca_berkas(dst)
            simpan = os.path.join(cad, 'sunting-asal', folder, berkas)
            if not os.path.isdir(os.path.dirname(simpan)):
                os.makedirs(os.path.dirname(simpan))
            if not os.path.exists(simpan):
                shutil.copy2(dst, simpan)
            ubah = isi
            for i in sorted(ids):
                la, ba = potongan(i)
                if ubah.count(ba) == 1:
                    hitung('SUDAH')
                    continue
                ubah = ubah.replace(la, ba)
                hitung('SUNTING')
            if ubah != isi:
                tulis_atomik(dst, ubah, os.path.join(akar, folder))
        # pindah ke folder "terhapus": folder tujuan dibuat bila belum ada (dicatat di cadangan/pindah-folder.txt), salinan ke cadangan
        catat = os.path.join(cad, 'pindah-folder.txt')
        dibuat = [x.strip() for x in io.open(catat, encoding='utf-8')] if os.path.exists(catat) else []
        for asal, berkas, tujuan in pindah:
            s, d = jalur(asal, berkas), jalur(tujuan, berkas)
            if not os.path.exists(s) and os.path.exists(d):
                hitung('SUDAH')
                continue
            bagian = tujuan.split('/')
            for j in range(1, len(bagian) + 1):
                f = '/'.join(bagian[:j])
                if not os.path.isdir(os.path.join(akar, f)):
                    os.mkdir(os.path.join(akar, f))
                    ikut_induk(os.path.join(akar, f), os.path.join(akar, *bagian[:j - 1]) if j > 1 else akar)
                    try:
                        os.chmod(os.path.join(akar, f), 0o755)
                    except Exception:
                        pass
                    if f not in dibuat:
                        dibuat.append(f)
                        io.open(catat, 'w', encoding='utf-8').write(u''.join(x + u'\n' for x in dibuat))
            simpan = os.path.join(cad, 'pindah-asal', asal, berkas)
            if not os.path.isdir(os.path.dirname(simpan)):
                os.makedirs(os.path.dirname(simpan))
            if not os.path.exists(simpan):
                shutil.copy2(s, simpan)
            shutil.move(s, d)
            hitung('PINDAH')
        for folder, berkas, h, _ in baru:
            dst = jalur(folder, berkas)
            if os.path.exists(dst):
                hitung('SUDAH')
                continue
            if not os.path.isdir(os.path.join(akar, folder)):
                hitung('GAGAL', 'folder tidak ada %s' % folder)
                continue
            shutil.copyfile(os.path.join(sumber, 'rtf', folder, berkas), dst)
            ikut_induk(dst, os.path.join(akar, folder))
            hitung('BUAT')
    elif aksi == 'periksa':
        for folder, berkas, h, _ in baru:
            dst = jalur(folder, berkas)
            hitung('COCOK') if os.path.exists(dst) and md5(dst) == h else hitung('HILANG', 'berkas baru %s/%s' % (folder, berkas))
        for folder, berkas, i, ml, mb, _k in sunting:
            dst = jalur(folder, berkas)
            la, ba = potongan(i)
            simpan = os.path.join(sys.argv[3], 'sunting-asal', folder, berkas)
            if os.path.exists(dst) and baca_berkas(dst).count(ba) == 1 and os.path.exists(simpan):
                hitung('COCOK')
            else:
                hitung('HILANG', 'sunting %s %s/%s (potongan baru atau salinan asal tidak ada)' % (i, folder, berkas))
        for asal, berkas, tujuan in pindah:
            if not os.path.exists(jalur(asal, berkas)) and os.path.exists(jalur(tujuan, berkas)):
                hitung('COCOK')
            else:
                hitung('HILANG', 'pindah %s/%s -> %s belum terjadi' % (asal, berkas, tujuan))
    elif aksi == 'pulih':
        cad = sys.argv[3]
        for asal, berkas, tujuan in pindah:
            s, d = jalur(asal, berkas), jalur(tujuan, berkas)
            if os.path.exists(d) and not os.path.exists(s):
                shutil.move(d, s)
                hitung('PINDAH_BALIK')
            elif os.path.exists(s) and not os.path.exists(d):
                hitung('SUDAH_DI_ASAL')
            else:
                hitung('BIARKAN', 'pindah balik tidak bisa (asal ada=%s, tujuan ada=%s) %s/%s' % (os.path.exists(s), os.path.exists(d), asal, berkas))
        catat = os.path.join(cad, 'pindah-folder.txt')
        if os.path.exists(catat):
            for f in reversed([x.strip() for x in io.open(catat, encoding='utf-8') if x.strip()]):
                try:
                    os.rmdir(os.path.join(akar, f))
                    hitung('FOLDER_DIHAPUS')
                except OSError:
                    if os.path.isdir(os.path.join(akar, f)):
                        hitung('BIARKAN', 'folder %s tidak kosong, dibiarkan' % f)
        for folder, berkas, h, _ in baru:
            dst = jalur(folder, berkas)
            if not os.path.exists(dst):
                continue
            if md5(dst) == h:
                os.remove(dst)
                hitung('HAPUS')
            else:
                hitung('BIARKAN', 'sudah disunting sesudah dipasang, tidak dihapus: %s/%s' % (folder, berkas))
        per = {}
        for folder, berkas, i, ml, mb, _k in sunting:
            per.setdefault((folder, berkas), []).append(i)
        for (folder, berkas), ids in sorted(per.items()):
            dst = jalur(folder, berkas)
            if not os.path.exists(dst):
                hitung('BIARKAN', 'berkas tidak ada lagi: %s/%s' % (folder, berkas))
                continue
            isi = baca_berkas(dst)
            ubah = isi
            for i in sorted(ids, reverse=True):
                la, ba = potongan(i)
                if ubah.count(ba) == 1:
                    ubah = ubah.replace(ba, la)
                    hitung('KEMBALI')
                elif ubah.count(ba) == 0 and ubah.count(la) == 1:
                    hitung('SUDAH_LAMA')
                else:
                    hitung('BIARKAN', 'potongan %s tidak dikenali lagi (disunting orang?) %s/%s' % (i, folder, berkas))
            if ubah != isi:
                tulis_atomik(dst, ubah, os.path.join(akar, folder))
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
