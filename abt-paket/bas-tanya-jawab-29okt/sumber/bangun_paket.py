"""Bangun paket ABT abt-bas-tanya-jawab-29okt dari pohon blangko derry_briantono.

Pakai: python bangun_paket.py <akar pohon derry_briantono> [folder paket-satker]
  - akar pohon = salinan blangko SERVER (folder derry_briantono). Laptop 29 Okt: D:/Aplikasi/aleta/tmp/bas29/dasar/derry_briantono
    (disusun alat/susun_dasar.py dari salinan server 20 Okt + paket terpasang s.d. 28 Okt). Di server/sesi utama: salinan
    terbaru /var/www/html/aps_badilag/_blangko_abt/derry_briantono (tar lewat ssh) - lalu bangun ulang bila PRASYARAT RTF LEWAT.
Keluaran (deterministik): rtf-daftar-tambal.tsv, rtf-tambal.tsv (jangkar unik per blok saksi, base64), nomor-dirujuk.txt,
  daftar-berkas.tsv (ringkas, untuk dibaca), dan ../hasil/isi-paket.json. Pola tambal = tambal-rtf.pl paket u2b/alamat-ganda/
  pihak-urut-ecourt (md5 lama wajib persis; hasil wajib md5 baru).
"""
import base64, hashlib, json, os, re, sys
SINI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, SINI)
from ubah import ubah_rinci, GagalUbah
from rtf2txt import rtf_ke_teks

LEWATI = ('ALUR', '- BAS', 'terhapus', 'BAS ')


def panjang(p):
    p = os.path.abspath(p)
    a = chr(92) * 2 + '?' + chr(92)
    return p if (os.name != 'nt' or p.startswith(a)) else a + p.replace('/', chr(92))


def md5(s):
    return hashlib.md5(s.encode('latin1')).hexdigest()


def jangkar(d, edit, buang):
    """Ubah daftar sunting (awal, akhir, pengganti) menjadi jangkar unik berurutan (diterapkan berurutan seperti tambal-rtf.pl)."""
    data = d
    out = []
    for s, e, r in sorted(edit, reverse=True):
        k = 0
        while True:
            a = data[s - k:e]
            if a and data.count(a) == 1:
                break
            if s - k <= 0:
                raise GagalUbah('jangkar tidak unik')
            k = min(s, k + 64)
        out.append((a, data[s - k:s] + r, 1))
        data = data[:s - k] + data[s - k:s] + r + data[e:]
    for v in buang:
        for tok in ('#%s# ' % v, '#%s#' % v):
            c = data.count(tok)
            if c:
                out.append((tok, '', c))
                data = data.replace(tok, '')
    return out, data


def terapkan(d, jk):
    for a, b, j in jk:
        if d.count(a) != j:
            return None
        d = d.replace(a, b)
    return d


def main():
    akar = sys.argv[1]
    kel = os.path.abspath(sys.argv[2] if len(sys.argv) > 2 else os.path.join(SINI, '..', 'paket-satker'))
    A = panjang(akar)
    daftar, tambal, ringkas, isi = [], [], [], []
    dirujuk = set()
    no = 0
    for dp, dn, fn in os.walk(A):
        dn.sort()
        rel = os.path.relpath(dp, A).replace(chr(92), '/')
        if rel != '.' and rel.split('/')[0].startswith(LEWATI):
            continue
        for f in sorted(fn):
            if not f.lower().endswith('.rtf'):
                continue
            r = f if rel == '.' else rel + '/' + f
            d = open(os.path.join(dp, f), 'rb').read().decode('latin1')
            bas = rel.endswith('- BAS')
            out, cat, edit, buang = ubah_rinci(d, bas)
            if not edit:
                continue
            jk, hasil = jangkar(d, edit, buang)
            if hasil != out or terapkan(d, jk) != out:
                raise SystemExit('GAGAL jangkar tidak setara hasil: ' + r)
            no += 1
            kode = 'B%03d' % no
            daftar.append('\t'.join([kode, r, md5(d), md5(out), str(len(jk))]))
            for i, (a, b, j) in enumerate(jk, 1):
                tambal.append('\t'.join([base64.b64encode(r.encode('utf-8')).decode(), str(i), str(j),
                                         base64.b64encode(a.encode('latin1')).decode(), base64.b64encode(b.encode('latin1')).decode()]))
            vb = set(re.findall(r'#(\d{4})#', rtf_ke_teks(out))) - set(re.findall(r'#(\d{4})#', rtf_ke_teks(d)))
            dirujuk |= vb
            blk = [x for x in cat if x['keadaan'] not in ('SUDAH',)]
            ringkas.append('\t'.join([kode, 'BAS' if bas else 'putusan', r, md5(d), md5(out),
                                      ' '.join('%s>%s' % (x['saksi'], x['variabel']) for x in blk if x['keadaan'] != 'DAFTAR-ISIAN'),
                                      ','.join(sorted({v for x in blk for v in x.get('var_dibuang', [])}))]))
            isi.append(dict(kode=kode, jalur=r, jenis='BAS' if bas else 'putusan', md5_lama=md5(d), md5_baru=md5(out),
                            jangkar=len(jk), blok=[{k: v for k, v in x.items() if k != 'teks_dibuang'} for x in blk]))
    os.makedirs(kel, exist_ok=True)

    def tulis(nama, baris):
        with open(os.path.join(kel, nama), 'w', encoding='utf-8', newline='\n') as o:
            o.write('\n'.join(baris) + '\n')
    tulis('rtf-daftar-tambal.tsv', daftar)
    tulis('rtf-tambal.tsv', tambal)
    tulis('nomor-dirujuk.txt', [','.join(sorted(dirujuk))])
    tulis('daftar-berkas.tsv', ['# kode\tjenis\tjalur\tmd5_lama\tmd5_baru\tsaksi>variabel\tvariabel kalimat jadi yang dibuang'] + ringkas)
    hdir = os.path.join(SINI, '..', 'hasil')
    os.makedirs(hdir, exist_ok=True)
    json.dump(isi, open(os.path.join(hdir, 'isi-paket.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('berkas', len(daftar), 'jangkar', len(tambal), 'variabel dirujuk baru', ','.join(sorted(dirujuk)))


if __name__ == '__main__':
    main()
