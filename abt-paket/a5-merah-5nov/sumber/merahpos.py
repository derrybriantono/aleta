# -*- coding: utf-8 -*-
"""Peta token teks RTF -> offset + warna + grup, memakai tokenisasi yang sama dengan rtfmini.urai (pembuat daftar A5), sehingga baris ke-n
daftar-teks-merah.csv sebuah berkas = token merah ke-n (panjang strip >= 2) berkas itu. Dibandingkan ulang dengan rtfmini saat membangun."""
import rtfmini
from rtfmini import TOK, LEWAT, warna_tabel, merah as adalah_merah


def peta(b):
    """-> dict(toks, para (no -> teks), warna, grup_akhir, pakai_cf). Token: o0,o1 (bita teks), teks, merah, cf, cf_pos ((o,z) kendali \\cf yang
    berlaku atau None), para, p0 (posisi huruf di paragraf), grup (id), hex."""
    warna = warna_tabel(b)
    tumpuk = []
    st = {'lewat': False, 'cf': 0, 'cf_pos': None, 'uc': 1, 'grup': 0}
    no_para = 0
    toks = []
    para = {}
    cur = []
    panjang = 0
    lewat_u = 0
    awal = False
    grup_awal = {0: 0}
    grup_akhir = {}
    n_grup = 0
    pakai_cf = {}  # cf_pos -> jumlah pemakaian \u (huruf Arab dsb.) yang bukan token

    def tambah(s):
        nonlocal panjang
        cur.append(s)
        panjang += len(s)

    for m in TOK.finditer(b):
        kata, angka, hexa, sim, kur, teks = m.groups()
        if kur == b'{':
            tumpuk.append(dict(st))
            n_grup += 1
            st['grup'] = n_grup
            grup_awal[n_grup] = m.start()
            awal = True
            continue
        if kur == b'}':
            grup_akhir[st['grup']] = m.start()
            if tumpuk:
                st = tumpuk.pop()
            awal = False
            continue
        if sim is not None:
            if sim == b'*' and awal:
                st['lewat'] = True
            elif not st['lewat']:
                if sim == b'~':
                    tambah(' ')
                elif sim in (b'\\', b'{', b'}'):
                    tambah(sim.decode())
                elif sim == b'_':
                    tambah('-')
            awal = False
            continue
        if kata is not None:
            k = kata
            if awal and k in LEWAT:
                st['lewat'] = True
            awal = False
            if st['lewat']:
                continue
            if k in (b'par', b'sect', b'row'):
                para[no_para] = ''.join(cur)
                no_para += 1
                cur = []
                panjang = 0
            elif k == b'tab':
                tambah('\t')
            elif k == b'line':
                tambah('\n')
            elif k == b'cell':
                tambah(' | ')
            elif k == b'cf':
                st['cf'] = int(angka or 0)
                st['cf_pos'] = (m.start(), m.end())
            elif k in (b'highlight', b'chcbpat'):
                pass
            elif k == b'plain':
                st['cf'] = 0
                st['cf_pos'] = None
            elif k == b'uc':
                st['uc'] = int(angka or 1)
            elif k == b'u':
                v = int(angka or 0)
                if v < 0:
                    v += 65536
                try:
                    tambah(chr(v))
                except ValueError:
                    pass
                lewat_u = st['uc']
                if st['cf_pos']:
                    pakai_cf[st['cf_pos']] = pakai_cf.get(st['cf_pos'], 0) + 1
            elif k in (b'emdash', b'endash'):
                tambah('-')
            elif k in (b'lquote', b'rquote'):
                tambah("'")
            elif k in (b'ldblquote', b'rdblquote'):
                tambah('"')
            elif k == b'bullet':
                tambah('*')
            continue
        awal = False
        if st['lewat']:
            continue
        o0, o1 = m.start(), m.end()
        hx = False
        if hexa is not None:
            if lewat_u > 0:
                lewat_u -= 1
                continue
            s = bytes([int(hexa, 16)]).decode('cp1252', 'replace')
            hx = True
        elif teks is not None:
            s = teks.decode('cp1252', 'replace')
            if lewat_u > 0:
                o0 += min(lewat_u, len(teks))
                s = s[lewat_u:]
                lewat_u = 0
        else:
            continue
        idx = st['cf']
        c = warna[idx] if 0 <= idx < len(warna) else None
        toks.append({'o0': o0, 'o1': o1, 'teks': s, 'merah': bool(s.strip()) and adalah_merah(c), 'cf': idx, 'cf_pos': st['cf_pos'],
                     'para': no_para, 'p0': panjang, 'grup': st['grup'], 'hex': hx})
        tambah(s)
    para[no_para] = ''.join(cur)
    return {'toks': toks, 'para': para, 'warna': warna, 'grup_awal': grup_awal, 'grup_akhir': grup_akhir, 'pakai_cf': pakai_cf}


def baris_csv(toks):
    return [t for t in toks if t['merah'] and len(t['teks'].strip()) >= 2]


def urai(b):
    return rtfmini.urai(b)
