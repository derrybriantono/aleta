# -*- coding: utf-8 -*-
"""Bangun paket ABT abt-bukti-nomor-30okt: daftar bukti surat di blangko Derry bernomor dari fungsi isian_rtf_bukti.

Masalah: isian bukti surat (data_teks 9955, 9911, 1214, 9958, 9956, 8131, 8132, 0378) dicetak apa adanya ke paragraf
blangko yang penomorannya berbeda-beda: (a) daftar bernomor Word -> nomor yang DIKETIK petugas/alat ikut tercetak ("1. 1.
Fotokopi ...", "2. 2. ..."); (b) "1.<tab>#isian#" diketik di paragraf biasa -> butir ke-2 dst. TANPA nomor; (c) paragraf
biasa tanpa nomor -> bernomor hanya bila petugas mengetiknya. Perbaikan: variabel data_sql baru per isian
(11170-11177, OTOMATIS: isian_rtf_bukti atas isian tersimpan / bawaannya) yang SELALU menulis "1.<tab>", "2.<tab>", ...
dan membuang nomor ketikan; paragraf blangko diganti satu paragraf bergaya sama TANPA penomoran daftar dan tanpa
"1.<tab>" ketikan, memuat variabel baru + penanda isian lama di tujuan RTF yang diabaikan pengolah kata
({\\*\\isianbukti #isian#}) agar penyunting ABT dan panel tetap menawarkan isiannya.

Pakai: python bangun_paket.py <akar pohon derry_briantono SESUDAH paket bas-tanya-jawab-29okt> [folder paket-satker]
"""
import base64, hashlib, json, os, re, sys
SINI = os.path.dirname(os.path.abspath(__file__))
BTJ = os.path.join(SINI, '..', '..', 'bas-tanya-jawab-29okt', 'sumber')
sys.path.insert(0, BTJ)
from rtfsatuan import satuan, seimbang  # noqa: E402
from rtf2txt import rtf_ke_teks  # noqa: E402
from ubah import bangun_paragraf, GagalUbah  # noqa: E402
from bangun_paket import jangkar, terapkan, panjang  # noqa: E402

PETA = {'9955': '11170', '9911': '11171', '1214': '11172', '9958': '11173', '9956': '11174', '8131': '11175',
        '8132': '11176', '0378': '11177'}
LEWATI = ('ALUR', '- BAS', 'terhapus', 'BAS ')
POLA = re.compile(r'^\s*(?:\(?\d{1,2}\s*[.)]\s*)?#(%s)#\s*[;.]?\s*$' % '|'.join(PETA))


def md5(s):
    return hashlib.md5(s.encode('latin1')).hexdigest()


def tersembunyi(raw, t):
    """Baris daftar isian berhuruf 2 half-point (cara Derry menaruh isian di penyunting tanpa tercetak)."""
    return bool(re.search(r'\\fs2(?!\d)', raw)) or len(re.findall(r'#\d{4,5}#', t)) > 3


def ubah_bukti(d):
    u = satuan(d)
    edit, cat, lewat = [], [], []
    for s, e, _, _ in u:
        raw = d[s:e]
        if not any('#%s#' % k in raw for k in PETA):
            continue
        t = rtf_ke_teks(raw).replace('\n', ' ').replace('\t', ' ').strip()
        if tersembunyi(raw, t):
            continue
        m = POLA.match(t)
        if not m:
            if any('#%s#' % k in t for k in PETA):
                lewat.append(t[:120])
            continue
        sk = m.group(1)
        net, mn = seimbang(raw)
        if mn > 0 or net - mn < 0 or -mn > 2 or net - mn > 2:
            raise GagalUbah('profil kurung janggal %r' % ((net, mn),))
        isi = '#%s#{\\*\\isianbukti #%s#}' % (PETA[sk], sk)
        baru = '}' * (-mn) + bangun_paragraf(raw, isi) + '{' * (net - mn)
        if seimbang(baru) != (net, mn):
            raise GagalUbah('profil pengganti beda')
        edit.append((s, e, baru))
        cat.append(dict(isian=sk, variabel=PETA[sk], daftar=bool(re.search(r'\\ls\d+', raw) or '\\listtext' in raw),
                        nomor_ketik=bool(re.match(r'^\s*\(?\d', t)), teks_lama=t[:60]))
    out = d
    for s, e, r in sorted(edit, reverse=True):
        out = out[:s] + r + out[e:]
    if seimbang(out) != seimbang(d):
        raise GagalUbah('neraca dokumen berubah')
    return out, edit, cat, lewat


def main():
    akar = sys.argv[1]
    kel = os.path.abspath(sys.argv[2] if len(sys.argv) > 2 else os.path.join(SINI, '..', 'paket-satker'))
    A = panjang(akar)
    daftar, tambal, ringkas, isi, lewat_semua = [], [], [], [], []
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
            if not any('#%s#' % k in d for k in PETA):
                continue
            try:
                out, edit, cat, lewat = ubah_bukti(d)
            except GagalUbah as e:
                lewat_semua.append('%s\tGAGAL %s' % (r, e))
                continue
            for x in lewat:
                lewat_semua.append('%s\tLEWAT %s' % (r, x))
            if not edit:
                continue
            jk, hasil = jangkar(d, edit, [])
            if hasil != out or terapkan(d, jk) != out:
                raise SystemExit('GAGAL jangkar tidak setara hasil: ' + r)
            no += 1
            kode = 'N%03d' % no
            daftar.append('\t'.join([kode, r, md5(d), md5(out), str(len(jk))]))
            for i, (a, b, j) in enumerate(jk, 1):
                tambal.append('\t'.join([base64.b64encode(r.encode('utf-8')).decode(), str(i), str(j),
                                         base64.b64encode(a.encode('latin1')).decode(), base64.b64encode(b.encode('latin1')).decode()]))
            ringkas.append('\t'.join([kode, r, md5(d), md5(out), ' '.join('%s>%s%s' % (c['isian'], c['variabel'], '(daftar)' if c['daftar'] else '(nomor-ketik)' if c['nomor_ketik'] else '(biasa)') for c in cat)]))
            isi.append(dict(kode=kode, jalur=r, md5_lama=md5(d), md5_baru=md5(out), blok=cat))
    os.makedirs(kel, exist_ok=True)

    def tulis(nama, baris):
        with open(os.path.join(kel, nama), 'w', encoding='utf-8', newline='\n') as o:
            o.write('\n'.join(baris) + '\n')
    tulis('rtf-daftar-tambal.tsv', daftar)
    tulis('rtf-tambal.tsv', tambal)
    tulis('daftar-berkas.tsv', ['# kode\tjalur\tmd5_lama\tmd5_baru\tisian>variabel(bentuk paragraf lama)'] + ringkas)
    h = os.path.join(SINI, '..', 'hasil')
    os.makedirs(h, exist_ok=True)
    json.dump(isi, open(os.path.join(h, 'isi-paket.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    open(os.path.join(h, 'dilewati.txt'), 'w', encoding='utf-8').write('\n'.join(lewat_semua) + '\n')
    print('berkas', len(daftar), 'jangkar', len(tambal), 'dilewati', len(lewat_semua))


if __name__ == '__main__':
    main()
