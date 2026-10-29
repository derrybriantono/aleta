"""Pemeriksaan menyeluruh pohon SESUDAH paket (dasar + berkas baru): tiap saksi yang identitasnya tercetak harus
diikuti keterangan dari tanya-jawab ABT. Juga menghitung blangko yang masih memuat variabel kalimat saksi jadi.

Pakai: python cek_semua.py <akar dasar derry_briantono> <folder rtf baru> <keluar.tsv>
"""
import os, re, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'sumber'))
from rtf2txt import rtf_ke_teks
from saksi_blok import TJ_SEMUA

LEWATI = ('ALUR', '- BAS', 'terhapus', 'BAS ')
PI = re.compile(r'#(1197|1203|6132|6144|8924|6100|6106|6138|8934)#\s*,?\s*(\(.{0,40}\)\s*,?\s*)?umur')
PQ = re.compile(r'(pertanyaan|bertanya)\b.*\bsaksi\b.*sebagai berikut\s*[:;]?\s*$', re.I)
NARATIF = {'8511', '8512', '2555', '2556', '2557', '2558', '8486', '8487'}


def panjang(p):
    p = os.path.abspath(p)
    a = chr(92) * 2 + '?' + chr(92)
    return p if (os.name != 'nt' or p.startswith(a)) else a + p.replace('/', chr(92))


def main():
    dasar, baru, kel = sys.argv[1], sys.argv[2], sys.argv[3]
    A = panjang(dasar)
    out = []
    n = nb = 0
    for dp, dn, fn in os.walk(A):
        rel = os.path.relpath(dp, A).replace(chr(92), '/')
        if rel != '.' and rel.split('/')[0].startswith(LEWATI):
            continue
        for f in sorted(fn):
            if not f.lower().endswith('.rtf'):
                continue
            r = f if rel == '.' else rel + '/' + f
            pb = panjang(os.path.join(baru, r))
            sumber = 'baru' if os.path.exists(pb) else 'dasar'
            raw = open(pb if sumber == 'baru' else os.path.join(dp, f), 'rb').read().decode('latin1')
            tb = [re.sub(r'\s+', ' ', x).strip() for x in rtf_ke_teks(raw).split('\n') if x.strip()]
            bas = rel.endswith('- BAS')
            n += 1
            masalah = []
            for i, t in enumerate(tb):
                m = PI.search(t)
                if not m:
                    continue
                if set(re.findall(r'#(\d{4})#', t[m.end():])) & TJ_SEMUA:
                    continue
                j = i + 1
                if bas:
                    while j < len(tb) and j < i + 7 and not PQ.search(tb[j]):
                        j += 1
                    j += 1
                nx = tb[j] if j < len(tb) else ''
                if not (set(re.findall(r'#(\d{4})#', nx)) & TJ_SEMUA):
                    masalah.append('%s->%s' % (m.group(1), nx[:50]))
            nar = sorted(set(re.findall(r'#(\d{4})#', ' '.join(tb))) & NARATIF)
            if masalah or nar:
                nb += 1
                out.append('\t'.join([r, sumber, '; '.join(masalah), ','.join(nar)]))
    open(kel, 'w', encoding='utf-8').write('\n'.join(out) + '\n')
    print('berkas', n, 'bermasalah', nb)
    for o in out:
        print(o[:300])


if __name__ == '__main__':
    main()
