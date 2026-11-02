# -*- coding: utf-8 -*-
"""audit_bagian.py <akar _blangko_abt> [keluar.tsv] : audit nomor halaman SEMUA blangko BAS derry_briantono per BAGIAN.
Kategori per berkas: OK (tiap bagian menetapkan kaki ber-PAGE) | SEBAGIAN (ada PAGE, sebagian bagian/kaki belum) | TANPA (tidak ada PAGE sama sekali).
Memakai pembangun paket (sumber/bangun_paket.py): kelompok BAS yang sama dengan ekstensi, bagian = \\sectd, kaki diwarisi antarbagian bila tidak ditetapkan."""
import bisect
import collections
import os
import sys

SINI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(SINI, '..', 'sumber'))
import bangun_paket as P  # noqa: E402


def main():
    akar = sys.argv[1]
    keluar = sys.argv[2] if len(sys.argv) > 2 else None
    cnt = collections.Counter()
    baris = []
    for rel in P.sasaran(akar):
        raw = open(os.path.join(akar, rel), 'rb').read().decode('latin1')
        sectd = P.bagian_dari(raw)
        n = len(sectd)
        sendiri = [False] * n  # bagian menetapkan kaki biasa ber-PAGE sendiri
        ada_page = P.RE_PAGE.search(raw) is not None
        for jenis, a, b in P.kaki_semua(raw):
            if jenis == 'b' and P.ada_page(raw[a:b]):
                sendiri[max(bisect.bisect_right(sectd, a) - 1, 0)] = True
        cakupan = P.cakupan(raw)
        ok_efektif = all(x and y for x, y in cakupan)
        kat = 'OK' if all(sendiri) else ('SEBAGIAN' if ada_page else 'TANPA')
        cnt[kat] += 1
        baris.append((kat, rel, n, ''.join('1' if s else '0' for s in sendiri), 'ya' if ok_efektif else 'tidak'))
    print(dict(cnt), 'total', sum(cnt.values()))
    if keluar:
        with open(keluar, 'w', encoding='utf-8', newline='\n') as o:
            o.write('kategori\tberkas\tbagian\tbagian ber-PAGE sendiri\tnomor efektif semua bagian (termasuk warisan)\n')
            for r in baris:
                o.write('\t'.join(map(str, r)) + '\n')


if __name__ == '__main__':
    main()
