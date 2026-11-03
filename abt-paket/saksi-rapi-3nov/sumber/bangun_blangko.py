# -*- coding: utf-8 -*-
"""Bangun tambalan blangko paket saksi-rapi-3nov (Python 3, laptop).

Paragraf keterangan saksi (#9259#-#9265#: daftar "-<tab>Bahwa ...", tiap <br> menjadi \\par sehingga semua butir
mewarisi sifat paragraf ini) dibuat SEJAJAR dengan paragraf identitas saksinya:
  L = tepi kiri teks identitas (\\li bila inden gantung, \\li+\\fi bila inden baris pertama);
  tanda "-" di L, teks sesudah tab di L+400, baris lanjutan menggantung di L+400:
  \\fi-400 \\li(L+400) \\lin(L+400) \\tx(L+400); \\cufi/\\culi dibuang (satuan aksara mengalahkan \\li di Word/WPS).
Paragraf identitas saksi ke-3..5 di 18 varian "(3/4/5 Saksi)" rusak (kurung kurawal tidak seimbang, tanpa inden): dibentuk
seperti identitas saksi ke-2 di berkas yang sama (\\ls daftar yang sama, {\\listtext N.\\tab}), {\\*\\isianasal ...} tetap.

pakai: python bangun_blangko.py <akar _blangko_abt> <folder paket-satker> <folder hasil>
keluaran: paket-satker/daftar-tambal.tsv, paket-satker/tambal.tsv, hasil/laporan-blangko.tsv, hasil/ringkas-blangko.txt
"""
import base64
import collections
import hashlib
import os
import re
import sys

PENANDA = re.compile(r'#(9259|926[0-5])#')
H = 400
RUSAK = re.compile(r'\\pard \\plain \\fs20 \\rtlch \\ltrch \\dbch \\af5 \\hich \\af5 \\loch \\af5 \\f2 (\d)\.\\tab (\{\\\*\\isianasal [^{}]*\})?\}')
PAR = re.compile(r'\\par(?![a-z])')
KENDALI_INDEN = re.compile(r'\\(?:fi|cufi|li|culi|lin)-?\d+ ?|\\tq[lrc] ?|\\tqdec ?|\\tx\d+ ?')


def pard_aktif(d, pos):
    """letak \\pard yang berlaku di pos (lewati \\pard di dalam {\\listtext ...})."""
    k = pos
    while True:
        k = d.rfind('\\pard', 0, k)
        if k < 0:
            return -1
        if 'listtext' not in d[max(0, k - 12):k]:
            return k


def sifat(run):
    def ambil(kata, bawaan=0):
        m = re.findall(r'\\%s(-?\d+)(?![0-9])' % kata, run)
        return int(m[-1]) if m else bawaan
    return ambil('li'), ambil('fi')


def awal_paragraf(d, pos):
    s = 0
    for m in PAR.finditer(d, 0, pos):
        s = m.end()
    return s


def teks_polos(t):
    return re.sub(r'\{\\\*[^{}]*\}|\\[a-z]+-?\d* ?|[{}]', '', t)


def olah(d):
    """-> (daftar edit [(awal, akhir, baru)], laporan [..])"""
    edit = []
    lap = []
    # 1. identitas saksi 3-5 yang rusak
    ganti_id = {}  # letak \pard rusak -> (li, fi) sesudah dibetulkan
    for m in RUSAK.finditer(d):
        if 'listtext' in d[max(0, m.start() - 12):m.start()]:
            continue  # isi {\listtext ...} yang sah
        # contoh: paragraf identitas saksi 2 = paragraf ber-{\listtext ... 2.\tab}
        k2 = d.rfind('\\f2 2.\\tab }', 0, m.start())
        if k2 < 0:
            lap.append(('IDENTITAS-RUSAK-TANPA-CONTOH', m.group(1), '', ''))
            continue
        lt = d.rfind('{\\listtext ', 0, k2)
        p2 = pard_aktif(d, lt)
        props = d[p2:lt]
        listtext = d[lt:k2] + '\\f2 %s.\\tab }' % m.group(1)
        baru = props + listtext + (m.group(2) or '')
        edit.append((m.start(), m.end(), baru))
        ganti_id[m.start()] = sifat(props)
        lap.append(('IDENTITAS-DIBETULKAN', m.group(1), props.strip()[:60], ''))
    # 2. paragraf keterangan saksi
    for m in PENANDA.finditer(d):
        pos = m.start()
        s = awal_paragraf(d, pos)
        isi_par = teks_polos(d[s:d.find('\\par', pos)]).strip()
        if isi_par != m.group(0):
            lap.append(('LEWATI-SEPARAGRAF-DENGAN-TEKS', m.group(0), isi_par[:60], ''))
            continue
        pk = pard_aktif(d, pos)
        if pk < s - 200 or pk < 0:
            # paragraf tanpa \pard sendiri (Asal Usul Anak: "...berikut:\par  {#9259#}{\par }2.\tab ..."): sifat paragraf
            # sisipkan \pard (tanpa \plain - huruf tidak disentuh) sebelum keterangan, kembalikan sifat lama sesudahnya.
            run = d[pk:d.find('{', pk)]
            ip = run.find('\\itap0')
            tutup = d.find('}{\\par }', pos)
            if pk < 0 or ip < 0 or d[s:pos].strip() != '{' or tutup != pos + len(m.group(0)):
                lap.append(('LEWATI-TANPA-PARD-SENDIRI', m.group(0), '', ''))
                continue
            par_lama = re.sub(r'\\plain ?', '', run[:ip + len('\\itap0')]) + ' '
            li_id, fi_id = sifat(par_lama)
            L = li_id if fi_id < 0 else li_id + fi_id
            par_ket = KENDALI_INDEN.sub('', par_lama)
            par_ket = '\\pard \\fi-%d \\li%d \\lin%d \\tql \\tx%d ' % (H, L + H, L + H, L + H) + par_ket[len('\\pard '):]
            sisip_at = s + (len(d[s:pos]) - len(d[s:pos].lstrip()))
            edit.append((sisip_at, sisip_at, par_ket))
            akhir = tutup + len('}{\\par }')
            edit.append((akhir, akhir, par_lama))
            lap.append(('UBAH-SISIP-PARD', m.group(0), 'li=%d fi=%d' % (li_id, fi_id), 'L=%d -> li=%d fi=-%d' % (L, L + H, H)))
            continue
        # identitas = paragraf sebelumnya
        akhir_id = d.rfind('\\par', 0, s)
        while akhir_id > 0 and d[akhir_id:akhir_id + 5] == '\\pard':
            akhir_id = d.rfind('\\par', 0, akhir_id)
        s_id = awal_paragraf(d, akhir_id)
        teks_id = teks_polos(d[s_id:akhir_id]).strip()
        if not re.search(r'(berikut|sebagai berikut)\s*:$', teks_id):
            lap.append(('LEWATI-BUKAN-IDENTITAS', m.group(0), teks_id[-50:], ''))
            continue
        pi = pard_aktif(d, akhir_id)
        if pi in ganti_id:
            li_id, fi_id = ganti_id[pi]
        else:
            run_id = d[pi:d.find('{', pi)] if d.find('{', pi) > 0 else d[pi:akhir_id]
            li_id, fi_id = sifat(run_id)
        L = li_id if fi_id < 0 else li_id + fi_id
        ujung = d.find('{', pk)
        if ujung < 0 or ujung > pos:
            ujung = pos
        run = d[pk:ujung]
        li, fi = sifat(run)
        tx = re.findall(r'\\tx(\d+)', run)
        sudah = (li == L + H and fi == -H and tx == [str(L + H)] and '\\cu' not in run)
        if sudah:
            lap.append(('SUDAH', m.group(0), 'li=%d fi=%d' % (li, fi), 'L=%d' % L))
            continue
        bersih = KENDALI_INDEN.sub('', run)
        sisip = '\\fi-%d \\li%d \\lin%d \\tql \\tx%d ' % (H, L + H, L + H, L + H)
        kepala = re.match(r'\\pard ?(?:\\plain ?)?', bersih)
        if kepala:
            k = kepala.group(0)
            baru = k + ('' if k.endswith(' ') else ' ') + sisip + bersih[len(k):]
        else:
            lap.append(('LEWATI-PARD-ANEH', m.group(0), run[:40], ''))
            continue
        edit.append((pk, ujung, baru))
        lap.append(('UBAH', m.group(0), 'li=%d fi=%d tx=%s cu=%s' % (li, fi, ','.join(tx[:2]), '\\cu' in run), 'L=%d -> li=%d fi=-%d' % (L, L + H, H)))
    # edit tidak boleh bertumpuk; satu \pard bisa dipakai dua penanda? (tidak: tiap penanda paragraf sendiri)
    edit = sorted(set(edit))
    for a, b in zip(edit, edit[1:]):
        if a[1] > b[0]:
            raise SystemExit('edit bertumpuk')
    return edit, lap


def kurung(d):
    dep = 0
    nol = None
    i = 0
    n = len(d)
    while i < n:
        c = d[i]
        if c == '\\':
            i += 2
            continue
        if c == '{':
            dep += 1
        elif c == '}':
            dep -= 1
            if dep == 0 and nol is None and i < n - 5:
                nol = i
        i += 1
    return dep, nol


def main():
    akar, paket, hasil = sys.argv[1:4]
    os.makedirs(hasil, exist_ok=True)
    daftar = ['# kode\tberkas\tmd5_lama\tmd5_baru\tjumlah potongan - berkas diubah HANYA bila md5 persis md5_lama (blangko server 3 Nov 2026 = cadangan 2 Nov 18.50)']
    tambal = ['# kode\toffset\tb64(teks lama)\tb64(teks baru)']
    laporan = ['berkas\tjenis\tpenanda\tsebelum\tsesudah']
    rek = collections.Counter()
    no = 0
    for dp, dn, fn in sorted(os.walk(akar)):
        dn.sort()
        if 'terhapus' in dp.lower():
            continue
        for f in sorted(fn):
            if not f.lower().endswith('.rtf'):
                continue
            p = os.path.join(dp, f)
            raw = open(p, 'rb').read()
            d = raw.decode('latin1')
            if not PENANDA.search(d):
                continue
            edit, lap = olah(d)
            rel = os.path.relpath(p, os.path.dirname(akar.rstrip('/\\'))).replace('\\', '/')
            for x in lap:
                rek[x[0]] += 1
                laporan.append('\t'.join((rel,) + tuple(x)))
            if not edit:
                continue
            baru = d
            for a, b, t in sorted(edit, key=lambda e: -e[0]):
                baru = baru[:a] + t + baru[b:]
            dep, nol = kurung(baru)
            if dep != 0 or nol is not None:
                raise SystemExit('kurung tidak seimbang sesudah tambal: %s (%s, %s)' % (rel, dep, nol))
            no += 1
            kode = 'S%04d' % no
            nb = baru.encode('latin1')
            daftar.append('\t'.join((kode, rel, hashlib.md5(raw).hexdigest(), hashlib.md5(nb).hexdigest(), str(len(edit)))))
            for a, b, t in edit:
                tambal.append('\t'.join((kode, str(a), base64.b64encode(d[a:b].encode('latin1')).decode(), base64.b64encode(t.encode('latin1')).decode())))
            rek['BERKAS'] += 1
    open(os.path.join(paket, 'daftar-tambal.tsv'), 'w', encoding='utf-8', newline='\n').write('\n'.join(daftar) + '\n')
    open(os.path.join(paket, 'tambal.tsv'), 'w', encoding='utf-8', newline='\n').write('\n'.join(tambal) + '\n')
    open(os.path.join(hasil, 'laporan-blangko.tsv'), 'w', encoding='utf-8', newline='\n').write('\n'.join(laporan) + '\n')
    r = '\n'.join('%s\t%d' % kv for kv in sorted(rek.items()))
    open(os.path.join(hasil, 'ringkas-blangko.txt'), 'w', encoding='utf-8', newline='\n').write(r + '\n')
    print(r)


if __name__ == '__main__':
    main()
