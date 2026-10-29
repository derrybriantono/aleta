"""Kenali blok keterangan saksi dalam satu blangko RTF (satuan dari rtfsatuan).

Untuk tiap satuan IDENTITAS saksi (#1197# Nama Saksi 1 P, #1203#, #6132#, #6144#, #8924#, #6100#, #6106#, #6138#, #8934#)
dicari blok keterangan sesudahnya:
  BAS     : satuan pengantar "... pertanyaan kepada saksi ... sebagai berikut:" lalu baris TABEL tanya-jawab tertulis mati
  putusan : satuan identitas "... sebagai berikut:" lalu BUTIR "- Bahwa ..." tertulis mati
Blok yang sudah memakai variabel tanya-jawab (TJ / keterangan / 9259-9265) ditandai SUDAH.
"""
import re
from rtfsatuan import satuan
from rtf2txt import rtf_ke_teks

# nama saksi -> (variabel tanya-jawab BAS, variabel keterangan putusan, label)
SAKSI = {
    '1197': ('5058', '9259', 'saksi 1 P'),
    '1203': ('5059', '9260', 'saksi 2 P'),
    '6132': ('5060', '9261', 'saksi 3 P'),
    '6144': ('6124', '9262', 'saksi 4 P'),
    '8924': ('8931', '9263', 'saksi 5 P'),
    '6100': ('6120', '9264', 'saksi 1 T'),
    '6106': ('6121', '9265', 'saksi 2 T'),
    '6138': ('8921', '2032', 'saksi 3 T'),
    '8934': ('8941', '8942', 'saksi 4 T'),
}
TJ_SEMUA = {'5058', '5059', '5060', '6124', '8931', '6120', '6121', '6122', '8921', '8941',
            '2021', '2022', '2031', '8920', '8932', '2023', '2024', '2032', '8942'} | {str(n) for n in range(9259, 9266)}
BUTIR = ('-', '•', '–', '−', '—')
POLA_TANYA = re.compile(r'(pertanyaan|bertanya)\b.*\bsaksi\b.*sebagai berikut\s*[:;]?\s*$', re.I)
POLA_IDENT = re.compile(r'#(1197|1203|6132|6144|8924|6100|6106|6138|8934)#\s*,?\s*(\(.{0,40}\)\s*,?\s*)?umur', re.I)


def teks_satuan(d, s, e):
    return rtf_ke_teks(d[s:e]).replace('\n', ' ').replace('\t', ' ').strip()


def tabel(d, s, e):
    u = d[s:e]
    return ('\\intbl' in u) or ('\\row' in u) or ('\\cell' in u)


def var(t):
    return set(re.findall(r'#(\d{4,5})#', t))


def kenali(d, bas):
    """Kembalikan (daftar satuan, daftar blok). Blok: dict(saksi, ident, mulai, akhir, jenis, keadaan, contoh)."""
    u = satuan(d)
    T = [teks_satuan(d, x[0], x[1]) for x in u]
    blok = []
    for k, t in enumerate(T):
        m = POLA_IDENT.search(t)
        if not m:
            continue
        sk = m.group(1)
        sendiri = var(t[m.end():]) & TJ_SEMUA
        if sendiri:
            blok.append(dict(saksi=sk, ident=k, mulai=k, akhir=k + 1, jenis='BAS' if bas else 'PUT', keadaan='SUDAH',
                             isi=sorted(sendiri)))
            continue
        if bas:
            # cari pengantar pertanyaan dalam 5 satuan berikut (sesudah sumpah)
            q = None
            for j in range(k + 1, min(k + 7, len(T))):
                if POLA_IDENT.search(T[j]):
                    break
                if POLA_TANYA.search(T[j]):
                    q = j
                    break
            if q is None:
                blok.append(dict(saksi=sk, ident=k, mulai=None, akhir=None, jenis='BAS', keadaan='TANPA-PENGANTAR'))
                continue
            j = q + 1
            # satuan kosong sebelum isi
            while j < len(T) and T[j] == '' and not tabel(d, u[j][0], u[j][1]):
                j += 1
            if j < len(T) and var(T[j]) & TJ_SEMUA:
                blok.append(dict(saksi=sk, ident=k, mulai=q + 1, akhir=j + 1, jenis='BAS', keadaan='SUDAH',
                                 isi=sorted(var(T[j]) & TJ_SEMUA)))
                continue
            a = j
            while j < len(T) and (tabel(d, u[j][0], u[j][1]) or T[j] == ''):
                j += 1
            # buang satuan kosong di ujung (biarkan sebagai pemisah)
            b = j
            while b > a and T[b - 1] == '' and not tabel(d, u[b - 1][0], u[b - 1][1]):
                b -= 1
            blok.append(dict(saksi=sk, ident=k, pengantar=q, mulai=a, akhir=b, jenis='BAS',
                             keadaan='TABEL-KERAS' if b > a else 'KOSONG',
                             sesudah=T[j][:80] if j < len(T) else ''))
        else:
            j = k + 1
            while j < len(T) and T[j] == '':
                j += 1
            if j < len(T) and var(T[j]) & TJ_SEMUA:
                blok.append(dict(saksi=sk, ident=k, mulai=j, akhir=j + 1, jenis='PUT', keadaan='SUDAH',
                                 isi=sorted(var(T[j]) & TJ_SEMUA)))
                continue
            a = j
            s0 = sig(d[u[a][0]:u[a][1]]) if a < len(T) else ()
            while j < len(T) and not POLA_IDENT.search(T[j]) and (
                    T[j][:1] in BUTIR
                    # butir daftar bernomor RTF (\ls) yang tanda butirnya dibuat Word: gaya paragraf sama dengan butir pertama
                    or (j > a and T[a][:1] in BUTIR and s0 and sig(d[u[j][0]:u[j][1]]) == s0 and T[j].startswith('Bahwa'))):
                j += 1
            if j == a:
                # paragraf ber-\line (satu paragraf memuat semua butir): ditangani ubah.butir_line
                garis = butir_line(d, u[k], sk)
                if garis:
                    blok.append(dict(saksi=sk, ident=k, mulai=k, akhir=k + 1, jenis='PUT', keadaan='BUTIR-LINE',
                                     garis=garis, sesudah=''))
                    # saksi berikutnya dalam paragraf ber-\line yang sama
                    for m2 in POLA_IDENT.finditer(t, m.end()):
                        sk2 = m2.group(1)
                        g2 = butir_line(d, u[k], sk2)
                        blok.append(dict(saksi=sk2, ident=k, mulai=k, akhir=k + 1, jenis='PUT',
                                         keadaan='BUTIR-LINE' if g2 else 'TANPA-BUTIR', garis=g2, sesudah=''))
                    continue
            blok.append(dict(saksi=sk, ident=k, mulai=a, akhir=j, jenis='PUT',
                             keadaan='BUTIR-KERAS' if j > a else 'TANPA-BUTIR',
                             sesudah=T[j][:80] if j < len(T) else ''))
    return u, T, blok


def sig(raw):
    """Tanda gaya paragraf: nilai \\li \\fi \\ls \\ilvl pada kendali \\pard satuan."""
    k = raw.find('\\pard')
    if k < 0:
        return ()
    b = raw.find('{', k)
    return tuple(re.findall(r'\\(li|fi|ls|ilvl)(-?\d+)', raw[k:b] if b > 0 else raw[k:]))


GARIS_BUTIR = re.compile(r'\\line\s?-\\tab\s?')


def butir_line(d, un, sk):
    """Butir '-\\tab Bahwa' yang dipisah \\line di dalam SATU paragraf sesudah identitas saksi `sk`.
    Kembalikan (awal, akhir) bait mutlak potongan butir (mulai di '\\line' pertama), atau None."""
    s, e = un[0], un[1]
    raw = d[s:e]
    i = raw.find('#%s#' % sk)
    if i < 0:
        return None
    m = GARIS_BUTIR.search(raw, i)
    if not m:
        return None
    nx = raw.find('\\line', i)
    if nx != m.start():
        return None
    awal = m.start()
    pos = awal
    while True:
        m2 = GARIS_BUTIR.match(raw, pos)
        if not m2:
            break
        n2 = re.compile(r'\\line\b|\\par\b').search(raw, m2.end())
        pos = n2.start() if n2 else len(raw)
        if not n2:
            break
    seg = raw[awal:pos]
    if '{' in seg or '}' in seg:
        return None
    return (s + awal, s + pos)
