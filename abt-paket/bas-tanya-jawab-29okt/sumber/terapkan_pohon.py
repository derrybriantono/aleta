"""Terapkan ubah.ubah ke seluruh pohon derry_briantono (folder aktif) dan tulis hasil ke folder keluaran.

Pakai: python terapkan_pohon.py <akar derry_briantono> <keluar> [jalur-relatif ...]
Keluaran: <keluar>/rtf/<jalur> (berkas BARU), <keluar>/laporan.json (per berkas: md5 lama/baru, blok), <keluar>/gagal.txt
Folder arsip (ALUR*, - BAS * -, terhapus, BAS *) tidak disentuh (tidak ada di menu derry_briantono).
"""
import hashlib, json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from ubah import ubah, GagalUbah

LEWATI = ('ALUR', '- BAS', 'terhapus', 'BAS ')


def panjang(p):
    p = os.path.abspath(p)
    a = chr(92) * 2 + '?' + chr(92)
    return p if (os.name != 'nt' or p.startswith(a)) else a + p.replace('/', chr(92))


def md5(b):
    return hashlib.md5(b).hexdigest()


def main():
    akar, kel = sys.argv[1], sys.argv[2]
    hanya = set(sys.argv[3:])
    lap, gagal = [], []
    A = panjang(akar)
    for dp, dn, fn in os.walk(A):
        dn.sort()
        rel = os.path.relpath(dp, A).replace(chr(92), '/')
        if rel != '.' and rel.split('/')[0].startswith(LEWATI):
            continue
        for f in sorted(fn):
            if not f.lower().endswith('.rtf'):
                continue
            r = f if rel == '.' else rel + '/' + f
            if hanya and r not in hanya:
                continue
            raw = open(os.path.join(dp, f), 'rb').read()
            d = raw.decode('latin1')
            bas = rel.endswith('- BAS')
            try:
                out, cat, n = ubah(d, bas)
            except GagalUbah as e:
                gagal.append('%s\t%s' % (r, e))
                continue
            if n == 0:
                continue
            ob = out.encode('latin1')
            p = panjang(os.path.join(kel, 'rtf', r))
            os.makedirs(os.path.dirname(p), exist_ok=True)
            open(p, 'wb').write(ob)
            lap.append(dict(jalur=r, jenis='BAS' if bas else 'PUT', md5_lama=md5(raw), md5_baru=md5(ob),
                            bait_lama=len(raw), bait_baru=len(ob), edit=n, blok=cat))
    json.dump(lap, open(os.path.join(kel, 'laporan.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    open(os.path.join(kel, 'gagal.txt'), 'w', encoding='utf-8').write('\n'.join(gagal) + ('\n' if gagal else ''))
    print('diubah', len(lap), 'gagal', len(gagal))
    for g in gagal:
        print('GAGAL', g)


if __name__ == '__main__':
    main()
