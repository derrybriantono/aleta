# -*- coding: utf-8 -*-
"""Susun tambalan RTF blangko Derry (U2): penanda baru disisipkan PER JANGKAR pada RTF yang sudah ada.

Pakai: python bangun_rtf.py <pohon-rtf> <keluar-paket> [<pohon-tambalan-keluar>]
  <pohon-rtf>     folder berisi <folder derry>/<berkas>.rtf (salinan server terbaru)
  <keluar-paket>  folder paket-satker (ditulis: rtf-tambal.tsv, rtf-daftar-tambal.tsv, rtf-aturan.json)
  <pohon-tambalan-keluar>  bila diberikan, RTF hasil tambal ditulis ke sini (untuk uji render laptop; TIDAK masuk repo)

Aturan (jangkar = penanda variabel yang sudah ada di RTF, harus tepat satu kali):
  PUTUSAN [Kabul*]  : #8530# -> #4118##8530#  (pertimbangan SEMA 1/2022; bila tidak ada #8530#, #8522#)
                      #8527# -> [#4117#] [#4119#] #8527#  (tenggang ikrar hanya cerai talak; akibat perceraian bila blangko belum memuatnya)
                      #8505# -> #4138# (atau #4139# untuk varian Mut'ah Iddah) + #8505#  (amar akibat perceraian, mulai baris baru)
  BAS putusan verstek : #8505# -> #4138##8505#
  BAS ikrar [2a]      : dua blok titik-titik beban -> #4150#
Berkas yang sudah memuat pertimbangan/amar akibat sendiri (kata Menghukum, penanda 9716/9717/975x, Rekonvensi, folder 1d) TIDAK diberi #4119#/#4138#.
"""
import base64, collections, hashlib, json, os, re, sys

LP = chr(92) * 2 + '?' + chr(92)


def baca(p):
    return open(p if p.startswith(LP) else LP + os.path.abspath(p), 'rb').read().decode('latin1')


def md5(s):
    return hashlib.md5(s.encode('latin1')).hexdigest()


def b64(s):
    return base64.b64encode(s.encode('latin1')).decode('ascii')


BLOK_BEBAN = ('-\\tab Nafkah Iddah sebesar Rp.................. (... rupiah) perbulan secara keseluruhan selama ... bulan, sejumlah Rp.................. (... rupiah);\\par - \\tab Mutah berupa uang sejumlah Rp.................. (... rupiah);\\par -\\tab Nafkah anak sebesar Rp.................. (... rupiah) perbulan secara keseluruhan selama ... bulan, sejumlah Rp.................. (... rupiah).')


def aturan(rel, raw):
    """-> list[(nama, lama, baru, jumlah)] atau [] bila berkas tidak ikut."""
    folder = rel.split('/')[0]
    nama = rel.split('/')[-1]
    adalah_bas = ' - BAS' in folder or folder.startswith(('- BAS', 'ALUR', 'BAS ')) or nama.startswith(('BAS ',)) or '] BAS' in nama or ') BAS' in nama
    ct = folder.startswith('1a') or ' CT ' in nama or 'CT -' in nama or 'Cerai Talak' in nama
    op = []
    if adalah_bas:
        if 'Ikrar Talak - P & T Hadir, Ada Beban' in nama and BLOK_BEBAN in raw:
            return [('beban-ikrar', BLOK_BEBAN, '#4150#', raw.count(BLOK_BEBAN))]
        if 'Putusan' in nama and raw.count('#8505#') == 1 and raw.count('#4001#') == 1 and not folder.startswith('1d') and 'Hak Asuh' not in nama:
            return [('amar-bas', '#8505#', '#4138##8505#', 1)]
        return []
    if not re.search(r'\[Kabul', nama) or folder.startswith('1d') or 'Rekonvensi' in nama:
        return []
    ada_sendiri = ('Menghukum' in raw) or re.search(r'#9716#|#9717#|#97[2-5]\d#', raw)
    mutah = "Mut'ah Iddah" in nama
    if raw.count('#8530#') == 1:
        op.append(('sema', '#8530#', '#4118##8530#', 1))
    elif raw.count('#8522#') == 1:
        op.append(('sema', '#8522#', '#4118##8522#', 1))
    if raw.count('#8527#') == 1:
        baru = ('#4117#' if ct else '') + ('' if (ada_sendiri or mutah) else '#4119#') + '#8527#'
        if baru != '#8527#':
            op.append(('pertimbangan', '#8527#', baru, 1))
    if raw.count('#8505#') == 1:
        if mutah:
            op.append(('amar', '#8505#', '#4139##8505#', 1))
        elif not ada_sendiri:
            op.append(('amar', '#8505#', '#4138##8505#', 1))
    return op


def main():
    pohon, keluar = sys.argv[1], sys.argv[2]
    hasil_pohon = sys.argv[3] if len(sys.argv) > 3 else None
    os.makedirs(keluar, exist_ok=True)
    daftar, tsv, ringkas, lewat = [], [], collections.Counter(), []
    kode = 0
    for r, ds, fs in os.walk(LP + os.path.abspath(pohon)):
        ds.sort()
        for f in sorted(fs):
            if not f.lower().endswith('.rtf'):
                continue
            p = os.path.join(r, f)
            rel = os.path.relpath(p, LP + os.path.abspath(pohon)).replace(chr(92), '/')
            raw = baca(p)
            op = aturan(rel, raw)
            if not op:
                continue
            if any(n != j for (_, _, _, n), j in ((o, o[3]) for o in op)):
                pass
            baru = raw
            ok = True
            for i, (nm, lama, bar, j) in enumerate(op, 1):
                if raw.count(lama) != j or j < 1:
                    ok = False
                    lewat.append((rel, nm, raw.count(lama)))
                    break
                baru = baru.replace(lama, bar)
                tsv.append('\t'.join([b64(rel), str(i), str(j), b64(lama), b64(bar)]))
            if not ok:
                tsv = [t for t in tsv if not t.startswith(b64(rel) + '\t')]
                continue
            kode += 1
            daftar.append('\t'.join(['T%03d' % kode, rel, md5(raw), md5(baru), str(len(op))]))
            for nm, *_ in op:
                ringkas[nm] += 1
            if hasil_pohon:
                tujuan = os.path.normpath(os.path.join(os.path.abspath(hasil_pohon), rel))
                os.makedirs(os.path.dirname(LP + tujuan), exist_ok=True)
                open(LP + tujuan, 'wb').write(baru.encode('latin1'))
    open(os.path.join(keluar, 'rtf-tambal.tsv'), 'w', encoding='ascii', newline=chr(10)).write('\n'.join(tsv) + '\n')
    open(os.path.join(keluar, 'rtf-daftar-tambal.tsv'), 'w', encoding='utf-8', newline=chr(10)).write('\n'.join(daftar) + '\n')
    json.dump({'berkas': len(daftar), 'jenis': dict(ringkas), 'lewat': lewat}, open(os.path.join(keluar, 'rtf-ringkas.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('berkas ditambal', len(daftar), dict(ringkas), 'lewat', len(lewat))
    for x in lewat[:10]:
        print('  LEWAT', x)


if __name__ == '__main__':
    main()
