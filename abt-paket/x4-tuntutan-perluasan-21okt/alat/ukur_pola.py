# -*- coding: utf-8 -*-
"""Ukur pola pembaca petitum LAMA vs BARU atas perkara sungguhan (paket x4, 21 Okt 2026).

Masukan (di luar repo, memuat data perkara): TSV hasil kueri baca-saja
  perkara_id, jenis_perkara_id, pet (petitum + petitum rekonvensi), amar, kh, kbh, sela
dari server PA Donggala (pet-server.tsv) dan SIPP lokal PA Bungku (pet-bungku.tsv).

Untuk tiap tuntutan: D = pola menyala atas petitum, A = amar memuat tuntutan itu.
Keluaran ringkas TANPA data pribadi -> hasil/ukur-pola.json; contoh per kasus (nomor perkara saja) -> layar.
Pola diuji di Python (re); pola terpilih diulang di MariaDB 5.5 server oleh alat/ukur_pola_server.sql.
pakai: python ukur_pola.py [berkas.tsv ...]"""
import collections, json, os, re, sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'sumber'))
import pola_x4 as P  # noqa: E402

BERKAS = [a for a in sys.argv[1:] if a.endswith('.tsv')] or [r'D:\Aplikasi\aleta\tmp\w26\pet-server.tsv', r'D:\Aplikasi\aleta\tmp\w26\pet-bungku.tsv']


def norm_pet(t):
    t = t.replace('\\n', ' ').replace('\\t', ' ')
    t = t.lower()
    for a in ('<strong>', '</strong>', '<em>', '</em>'):
        t = t.replace(a, '')
    return t.replace('&nbsp;', ' ')


def polos(t):
    t = re.sub(r'<[^>]+>', ' ', t)
    t = t.replace('&nbsp;', ' ').replace('&#39;', "'").replace('&rsquo;', "'")
    return re.sub(r'\s+', ' ', t).lower()


def baca():
    for f in BERKAS:
        sumber = 'donggala' if 'server' in f else 'bungku'
        L = open(f, encoding='latin1').read().split('\n')
        for l in L[1:]:
            if not l.strip():
                continue
            k = l.split('\t')
            if len(k) < 7:
                continue
            yield dict(sumber=sumber, id=k[0], jn=int(k[1]), pet=norm_pet(k[2]), amar=polos(k[3]), kh=int(k[4] or 0), kbh=int(k[5] or 0), sela=int(k[6] or 0))


def nyala(pola, r):
    return bool(re.search(pola, r['pet']))


def main():
    rows = list(baca())
    hasil = {}
    contoh = collections.defaultdict(list)
    for kode, d in P.UKUR.items():
        jenis = d['jenis']
        m = collections.Counter()
        for r in rows:
            if jenis and r['jn'] not in jenis:
                continue
            if len(r['pet'].strip()) < 30:
                m['petitum kosong'] += 1
                continue
            lama = nyala(d['lama'], r) if d.get('lama') else None
            baru = nyala(d['baru'], r) or bool(d.get('tambah') and d['tambah'](r))
            if d.get('lama') and d.get('tambah_lama'):
                lama = lama or bool(d['tambah_lama'](r))
            a = bool(re.search(d['amar'], r['amar'])) if d.get('amar') and r['amar'].strip() else None
            key = 'D%s%s' % ('1' if baru else '0', '' if a is None else ('A1' if a else 'A0'))
            m['baru ' + key] += 1
            if lama is not None:
                m['lama ' + ('D1' if lama else 'D0') + ('' if a is None else ('A1' if a else 'A0'))] += 1
                if lama != baru:
                    m['beda lama->baru: %s->%s' % (int(lama), int(baru))] += 1
                    contoh[(kode, 'beda %d->%d' % (lama, baru))].append('%s:%s' % (r['sumber'], r['id']))
            if baru and a is False:
                contoh[(kode, 'D1A0')].append('%s:%s' % (r['sumber'], r['id']))
            if (not baru) and a:
                contoh[(kode, 'D0A1')].append('%s:%s' % (r['sumber'], r['id']))
        hasil[kode] = dict(label=d['label'], jenis=sorted(jenis) if jenis else 'semua', hitung=dict(sorted(m.items())))
    keluar = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'hasil', 'ukur-pola.json')
    json.dump(hasil, open(keluar, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    for k, v in hasil.items():
        print(k, v['label'], v['hitung'])
    json.dump({'%s|%s' % k: v for k, v in contoh.items()}, open(r'D:\Aplikasi\aleta\tmp\w26\ukur-contoh.json', 'w'), indent=0)


if __name__ == '__main__':
    main()
