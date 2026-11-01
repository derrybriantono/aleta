# -*- coding: utf-8 -*-
"""Ubahan blangko RTF paket teks-pihak-1nov. Setiap fungsi mengembalikan daftar suntingan [(awal, akhir, teks baru)] atas teks latin1 satu berkas
(awal == akhir berarti penyisipan murni). Tidak ada penulisan di sini; pemanggil menyusun potongan dan md5.

  1. kesimpulan_putusan   : #9255# / #9256# (frasa kesimpulan dalam kalimat) -> #12100# / #12101# (naskah utuh bila ada) pada putusan kontradiktoir
                            perkara gugatan; isian asal 12027/12028/8436/8437 didaftarkan di grup tersembunyi bila belum ada.
  2. huruf_kecil          : #9355# / #9491# / #9681# / #9164# (teks pihak dirangkai di tengah kalimat) -> turunan berhuruf pertama kecil.
  3. aua_bukti            : putusan Asal Usul Anak tanpa sub-bab bukti: kalimat statis "menyerahkan alat bukti surat berupa:" dan "bukti suratnya" bersyarat.
  4. bas_bukti            : BAS pembuktian: "telah cukup dengan bukti suratnya" bersyarat (surat / elektronik / keduanya) menurut pihak yang membuktikan.
"""
import re

RE_GRUP = re.compile(r'\{\\\*\\isianasal([^{}]*)\}')


class Lewat(Exception):
    pass


def spans_grup(raw):
    return [(m.start(), m.end()) for m in RE_GRUP.finditer(raw)]


def di_dalam(pos, spans):
    return any(a <= pos < b for a, b in spans)


def titik_sisip_grup(raw):
    """Posisi penyisipan grup tersembunyi baru: tepat sebelum grup isianasal TERAKHIR; tanpa grup: sebelum kurung tutup akhir dokumen."""
    sp = spans_grup(raw)
    if sp:
        return sp[-1][0]
    k = raw.rstrip().rfind('}')
    if k < 0:
        raise Lewat('tidak ada kurung tutup akhir')
    return k


def sisip_grup(raw, nomor, edits):
    """Tambahkan grup tersembunyi untuk nomor yang BELUM ada di grup isianasal mana pun (kemunculan terlihat diganti paket ini, jadi tidak dihitung)."""
    sp = spans_grup(raw)
    perlu = [n for n in nomor if not any(('#%s#' % n) in raw[a:b] for a, b in sp)]
    if not perlu:
        return
    p = titik_sisip_grup(raw)
    edits.append((p, p, '{\\*\\isianasal %s}' % ' '.join('#%s#' % n for n in perlu)))


def ganti_token(raw, lama, baru, edits, tepat=None):
    """Ganti token terlihat (di luar grup isianasal) #lama# -> #baru#."""
    sp = spans_grup(raw)
    n = 0
    for m in re.finditer('#%s#' % lama, raw):
        if di_dalam(m.start(), sp):
            continue
        edits.append((m.start(), m.end(), '#%s#' % baru))
        n += 1
    if tepat is not None and n != tepat:
        raise Lewat('token #%s# terlihat %d kali (harus %d)' % (lama, n, tepat))
    return n


def kesimpulan_putusan(raw):
    edits = []
    a = ganti_token(raw, '9255', '12100', edits)
    b = ganti_token(raw, '9256', '12101', edits)
    if a != 1 or b != 1:
        raise Lewat('#9255# %d kali, #9256# %d kali (harus 1 dan 1)' % (a, b))
    sisip_grup(raw, ['8436', '8437', '12027', '12028'], edits)
    return edits


KECIL = {'9355': '12102', '9491': '12103', '9681': '12104', '9164': '12105'}


def huruf_kecil(raw):
    edits = []
    ada = []
    for lama, baru in KECIL.items():
        n = ganti_token(raw, lama, baru, edits)
        if n:
            ada.append(lama)
    if not ada:
        raise Lewat('tidak ada token sasaran')
    if sum(1 for e in edits) != len(ada):
        raise Lewat('token sasaran muncul lebih dari sekali: %r' % ada)
    # isian asal tetap tampil di tabel isian ABT blangko itu
    sisip_grup(raw, ada, edits)
    return edits


def aua_bukti(raw):
    edits = []
    for lama, baru in (
        ('telah menyerahkan alat bukti surat berupa:', 'telah #12106#'),
        ('{#12064#}', '{#12107#}'),
        ('bukti suratnya', '#12108#'),
    ):
        if raw.count(lama) != 1:
            raise Lewat('%r muncul %d kali (harus 1)' % (lama, raw.count(lama)))
        i = raw.index(lama)
        edits.append((i, i + len(lama), baru))
    if '#12040#' not in raw:
        raise Lewat('daftar bukti pisah #12040# tidak ada')
    return edits


# sebutan di kalimat -> pihak yang membuktikan
SEBUT = {'#0046#': 'P', '#7085#': 'P', '#7036#': 'P', '#0047#': 'T', '#7086#': 'T', '#7037#': 'T'}
RE_CUKUP = re.compile(r'(menyatakan telah cukup dengan )(bukti suratnya)')


def bas_bukti(raw, catat):
    """Kembalikan suntingan; kejadian yang tidak pasti dilewati dan dicatat (tidak ada kejadian pasti = Lewat)."""
    edits = []
    for m in RE_CUKUP.finditer(raw):
        pre = raw[:m.start()]
        dp = max((pre.rfind('#12040#'), 'P'), (pre.rfind('#12045#'), 'T'))
        if dp[0] < 0:
            catat.append('dilewati: tanpa daftar bukti pisah di atasnya')
            continue
        pihak_daftar = dp[1]
        kal = re.sub(r'\\[a-zA-Z]+-?\d* ?', '', pre[-140:])
        kal = re.sub(r'[{}]', '', kal)
        toks = re.findall(r'#\d{4}#', kal[-60:])
        sebut = toks[-1] if toks else ''
        if SEBUT.get(sebut) != pihak_daftar:
            catat.append('dilewati: sebutan %s tidak sejalan dengan daftar bukti %s' % (sebut or '?', pihak_daftar))
            continue
        kunci = '#12108#' if pihak_daftar == 'P' else '#12109#'
        edits.append((m.start(2), m.end(2), kunci))
    if not edits:
        raise Lewat('tidak ada kejadian yang pasti')
    return edits


def terapkan(raw, edits):
    hasil, pos = [], 0
    for s, e, g in sorted(edits, key=lambda x: (x[0], x[1])):
        assert s >= pos, (s, pos)
        hasil.append(raw[pos:s])
        hasil.append(g)
        pos = e
    hasil.append(raw[pos:])
    return ''.join(hasil)
