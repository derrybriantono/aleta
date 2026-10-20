# -*- coding: utf-8 -*-
"""Susun paket susulan U2b: tambalan RTF atas pohon blangko Derry TERBARU dari server (setelah paket u2 terpasang).

Pakai: python bangun_u2b.py <pohon-server> <paket-satker> [<data>] [<pohon-hasil>]
  <pohon-server>  folder berisi <folder derry>/<berkas>.rtf (salinan scp terbaru dari server)
  <paket-satker>  ditulis: rtf-daftar-tambal.tsv, rtf-tambal.tsv
  <data>          ditulis: tidak-ditambal.tsv (31 berkas yang dilewati paket u2 + alasan), pohon-asli-md5.tsv
  <pohon-hasil>   bila diberikan, RTF hasil tambal ditulis ke sini (uji laptop; TIDAK masuk repo)

Aturan tambal SAMA dengan paket u2 (bangun_rtf.aturan): hanya berkas yang BELUM memuat penanda 4117/4118/4119/4138/4139 dan yang
jangkarnya (penanda yang sudah ada) ditemukan tepat sebanyak yang diharapkan. Berkas yang tidak memenuhi dilewati (tidak ditambal).
"""
import base64, hashlib, os, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bangun_rtf as u2

BS = chr(92)
PENANDA = ('#4117#', '#4118#', '#4119#', '#4138#', '#4139#', '#4150#')
DAFTAR_U2 = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'u2-putusan-cerai-lengkap', 'paket-satker', 'rtf-daftar-tambal.tsv')


def semua(pohon):
    for r, ds, fs in os.walk(pohon):
        ds.sort()
        for f in sorted(fs):
            if f.lower().endswith('.rtf'):
                p = os.path.join(r, f)
                yield os.path.relpath(p, pohon).replace(BS, '/'), p


def md5b(b):
    return hashlib.md5(b).hexdigest()


def pengganti(rel, pohon):
    """Berkas pengganti sebuah jalur lama yang sudah tidak ada: pindah ke folder '<jenis> - BAS' (menu berpasangan 15 Okt)."""
    folder, nama = rel.split('/', 1)
    cand = []
    if '/' not in nama:
        if nama.startswith('BAS ALUR'):
            cand.append(folder + ' - BAS/' + nama)
        cand.append(folder + ' - BAS/' + nama)
    return [c for c in cand if os.path.exists(os.path.join(pohon, c))]


def main():
    pohon = os.path.abspath(sys.argv[1])
    keluar = os.path.abspath(sys.argv[2])
    data = os.path.abspath(sys.argv[3]) if len(sys.argv) > 3 else None
    hasil_pohon = os.path.abspath(sys.argv[4]) if len(sys.argv) > 4 else None
    os.makedirs(keluar, exist_ok=True)
    daftar, tsv, lewati, asli = [], [], [], []
    kode = 0
    for rel, p in semua(pohon):
        mentah = open(p, 'rb').read()
        raw = mentah.decode('latin1')
        asli.append('%s\t%s' % (md5b(mentah), rel))
        op = u2.aturan(rel, raw)
        if not op:
            continue
        if any(m in raw for m in PENANDA):
            continue  # sudah ditambal paket u2 (atau punya sendiri)
        baru = raw
        ok = True
        for nm, lama, bar, j in op:
            if raw.count(lama) != j or j < 1:
                ok = False
                lewati.append((rel, nm, raw.count(lama)))
                break
            baru = baru.replace(lama, bar)
        if not ok:
            continue
        kode += 1
        k = 'S%03d' % kode
        for i, (nm, lama, bar, j) in enumerate(op, 1):
            tsv.append('\t'.join([u2.b64(rel), str(i), str(j), u2.b64(lama), u2.b64(bar)]))
        daftar.append('\t'.join([k, rel, md5b(mentah), md5b(baru.encode('latin1')), str(len(op))]))
        if hasil_pohon:
            t = os.path.join(hasil_pohon, rel)
            os.makedirs(os.path.dirname(t), exist_ok=True)
            open(t, 'wb').write(baru.encode('latin1'))
    open(os.path.join(keluar, 'rtf-tambal.tsv'), 'w', encoding='ascii', newline=chr(10)).write('\n'.join(tsv) + '\n')
    open(os.path.join(keluar, 'rtf-daftar-tambal.tsv'), 'w', encoding='utf-8', newline=chr(10)).write('\n'.join(daftar) + '\n')
    print('berkas ditambal', len(daftar), 'jangkar tak cocok', lewati)

    if data:
        os.makedirs(data, exist_ok=True)
        open(os.path.join(data, 'pohon-asli-md5.tsv'), 'w', encoding='utf-8', newline=chr(10)).write('\n'.join(asli) + '\n')
        # 31 berkas yang dilewati paket u2 (baris LEWAT di cadangan/tambal-hasil.txt) -> status & alasan
        sudah_u2 = {}
        for l in open(DAFTAR_U2, encoding='utf-8'):
            c = l.rstrip('\n').split('\t')
            if len(c) >= 5:
                sudah_u2[c[1]] = c[0]
        ditambal_kini = {l.split('\t')[1] for l in daftar}
        out = []
        for l in open(DAFTAR_U2, encoding='utf-8'):
            c = l.rstrip('\n').split('\t')
            if len(c) < 5:
                continue
            kd, rel = c[0], c[1]
            p = os.path.join(pohon, rel)
            if os.path.exists(p):
                raw = open(p, 'rb').read().decode('latin1')
                if any(m in raw for m in PENANDA):
                    continue  # ditambal oleh u2
                if 'Ikrar Talak - P & T Hadir, Ada Beban' in rel:
                    out.append((kd, 'TIDAK DITAMBAL', rel, '', 'blangko sudah ditulis ulang: blok titik-titik beban diganti #6054# (nafkah iddah), #6055# (mut' + chr(39) + 'ah), #6071# (nafkah anak); jangkar blok lama 0 kali (diharapkan 2). Memasang #4150# akan mengganti angka terisi dengan titik-titik bila keputusan 4100-4105 belum dipilih.'))
                else:
                    out.append((kd, 'TIDAK DITAMBAL', rel, '', 'jangkar tidak ditemukan'))
                continue
            # berkas jalur lama tidak ada lagi
            if 'Ikrar Talak - P & T Hadir, Ada Beban' in rel:
                out.append((kd, 'TIDAK ADA', rel, '1a Perceraian CT - BAS/ dan ALUR 10 .../', 'jalur lama sudah tidak ada; isinya = [2a] Ikrar (lihat baris T089/T102): tidak ditambal'))
                continue
            ganti = pengganti(rel, pohon)
            if ganti:
                g = ganti[0]
                rg = open(os.path.join(pohon, g), 'rb').read().decode('latin1')
                st = 'sudah memuat #4138# (ditambal paket u2)' if any(m in rg for m in PENANDA) else 'BELUM'
                out.append((kd, 'DIPINDAH', rel, g, 'jalur lama sudah tidak ada (menu berpasangan "<jenis> - BAS"); pengganti: ' + st))
            else:
                # [01aa] ... IN + CG - B & F / - F : tidak ada di server; penggantinya dua berkas "Format Lengkap"
                if rel.startswith('1c Perceraian Kumulasi Itsbat Nikah/[01aa]'):
                    pg = '1c Perceraian Kumulasi Itsbat Nikah/[01aa] [Kabul Verstek] Putusan C%s Kumulasi Itsbat Nikah - Format Lengkap.rtf'
                    out.append((kd, 'DIGANTI', rel, (pg % 'G') + ' ; ' + (pg % 'T'), 'berkas tidak ada di server (md5 lama tidak cocok dengan berkas mana pun); blangko kumulasi kini dua berkas "Format Lengkap" yang sudah ditambal paket u2 (3 jangkar)'))
                else:
                    out.append((kd, 'TIDAK ADA', rel, '', 'jalur lama tidak ada'))
        open(os.path.join(data, 'tidak-ditambal.tsv'), 'w', encoding='utf-8', newline=chr(10)).write('\n'.join('\t'.join(x) for x in out) + '\n')
        print('baris u2 yang dilewati/dialihkan', len(out))


if __name__ == '__main__':
    main()
