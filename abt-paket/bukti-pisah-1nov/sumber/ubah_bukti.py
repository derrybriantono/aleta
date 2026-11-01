# -*- coding: utf-8 -*-
"""Ubah blangko RTF (BAS pembuktian dan putusan) supaya bukti surat dan bukti elektronik dicetak TERPISAH.

Cara kerja (tanpa mengubah format paragraf blangko):
  - paragraf daftar bukti lama (`#1117x#` + penanda tersembunyi `{\\*\\isianbukti #NNNN#}`) menjadi PEMBAWA: kendali paragraf & huruf blangko
    dipertahankan persis, TANPA penutup `\\par` sendiri; nilai variabel baru yang menutup paragraf dengan `\\par` (kosong bila tidak ada
    bukti jenis itu), sehingga bagian kosong tidak meninggalkan paragraf kosong;
  - pembawa kedua (salinan format yang sama) untuk daftar bukti elektronik;
  - BAS: kalimat pengantar yang sudah ada tetap (kata demi kata), hanya bagian "alat bukti surat" dan klausa "menyerahkan bukti surat berupa:"
    menjadi variabel bersyarat; pengantar bukti elektronik = paragraf pembawa baru berformat sama dengan kalimat pengantar;
  - putusan: judul sub-bab (A. Bukti Surat: / B. Bukti Elektronik: / Saksi) menjadi variabel bersyarat berhuruf berurut menurut yang ada.
Pemanggil memberi `daftar` (registri variabel) dan menerima kunci sementara `<<<...>>>` yang kemudian diberi nomor.
"""
import re

from rtf2txt import rtf_ke_teks
from rtfsatuan import satuan, seimbang

BS = '\\'
RE_VAR = re.compile(r'#(1117[0-7])#')
RE_TUTUP = re.compile(r'\{[^{}]*\\par ?\}\s*$')


class Lewat(Exception):
    """Berkas/paragraf tidak sesuai pola yang dikenal: TIDAK diubah (dicatat)."""


def teks(x):
    return re.sub(r'\s+', ' ', rtf_ke_teks(x)).strip()


def kendali_run(raw):
    """Kendali run (gaya huruf) teks pertama paragraf `raw` yang bukan daftar-butir/tersembunyi."""
    m = re.compile(r'\{((?:\\[a-zA-Z]+-?\d* ?)+)')
    k = raw.find('\\pard')
    k = 0 if k < 0 else k
    for x in m.finditer(raw, k):
        g = x.group(1)
        if g.startswith('\\listtext') or g.startswith('\\*') or g.startswith('\\trowd') or '\\cell' in g:
            continue
        g = re.split(r'\\u-?\d', g)[0]
        g = re.sub(r'\\uc\d+\s?', '', g)
        g = re.sub(r'\\(cell|row|par|line|tab)\b\s?', '', g)
        if not g.strip():
            continue
        return g if g.endswith(' ') else g + ' '
    return ''


def pembawa(raw, isi):
    """Paragraf pembawa bergaya `raw` (kendali \\pard satuan itu + kendali run teksnya), memuat `isi`, TANPA penutup \\par.
    Daftar-butir Word ({\\listtext}, \\lsN, \\ilvlN) dibuang dari kendali paragraf: hurufnya diketik oleh variabel."""
    r = re.sub(r'\{\\listtext[^{}]*\}', '', raw)
    k = r.find('\\pard')
    if k < 0:
        pre = ''
    else:
        b = r.find('{', k)
        pre = r[k:b] if b >= 0 else r[k:]
    pre = re.sub(r'\\(intbl|ls\d+|ilvl\d+)\s?', '', pre)
    pre = re.sub(r'\\itap\d+', r'\\itap0', pre)
    if pre and not pre.endswith(' '):
        pre += ' '
    p = pre + '{' + kendali_run(raw) + isi + '}'
    if seimbang(p) != (0, 0):
        raise Lewat('pembawa tidak seimbang')
    return p


def paragraf_tutup(raw, isi):
    """Seperti pembawa tetapi dengan penutup \\par (paragraf utuh yang selalu tercetak)."""
    p = pembawa(raw, isi)
    ctl = kendali_run(raw)
    q = p + '{' + ctl + '\\par }'
    if seimbang(q) != (0, 0):
        raise Lewat('paragraf tidak seimbang')
    return q


def pembawa_daftar(unit, nomor_lama, nomor_baru, dengan_penanda):
    """Paragraf daftar bukti lama -> pembawa daftar (variabel baru; penutup \\par dibuang)."""
    t = teks(unit)
    if t != '#%s#' % nomor_lama:
        raise Lewat('paragraf daftar bukti berisi lain: %r' % t[:60])
    m = RE_TUTUP.search(unit)
    if not m:
        raise Lewat('penutup \\par paragraf daftar tidak terbaca')
    hasil = unit[:m.start()]
    penanda = re.search(r'\{\\\*\\isianbukti #\d{4}#\}', hasil)
    if not penanda:
        raise Lewat('penanda isianbukti tidak ada')
    if dengan_penanda:
        hasil = hasil.replace('#%s#' % nomor_lama, nomor_baru, 1)
    else:
        hasil = hasil.replace('#%s#%s' % (nomor_lama, penanda.group(0)), nomor_baru, 1)
        if nomor_baru not in hasil:
            raise Lewat('penggantian daftar elektronik gagal')
    if seimbang(hasil)[0] != seimbang(unit)[0]:
        raise Lewat('neraca daftar berubah')
    return hasil


class Reg(object):
    """Registri variabel sementara: kunci (tuple) -> penanda `<<<n>>>` (diberi nomor ABT sesudah semua berkas dibaca)."""

    def __init__(self):
        self.idx = {}
        self.isi = []

    def minta(self, kunci, **kw):
        if kunci not in self.idx:
            self.idx[kunci] = len(self.isi)
            kw['kunci'] = kunci
            self.isi.append(kw)
        return '<<<%d>>>' % self.idx[kunci]


def minta(daftar, kunci, **kw):
    return daftar.minta(kunci, **kw)


# ───────────────────────── BAS ─────────────────────────
# Kalimat pengantar yang dikenal (semuanya berada di run teks TERAKHIR paragraf pengantar, sebelum penutup \par):
#   a: "... mengajukan alat bukti surat dan saksi-saksi. Selanjutnya X menyerahkan bukti surat berupa:"   (juga ", lalu X ...")
#   b: "... mengajukan alat bukti surat, lalu X menyerahkan bukti surat berupa:"
#   c: "... mengajukan alat bukti berupa surat dan saksi-saksi untuk menguatkan dalil-dalil permohonannya, selanjutnya X ... berupa :"
R_A = re.compile(r"(alat bukti )(surat dan )(saksi-saksi)((?:\.| ?,)\s*(?:[Ss]elanjutnya|lalu)\s[^{}\\]*?\smenyerahkan bukti surat berupa ?:)( *)(?=\})")
R_B = re.compile(r"(alat bukti )(surat)((?:\.| ?,)\s*(?:[Ss]elanjutnya|lalu)\s[^{}\\]*?\smenyerahkan bukti surat berupa ?:)( *)(?=\})")
R_C = re.compile(r"(alat bukti berupa )(surat dan )(saksi-saksi untuk menguatkan dalil-dalil permohonannya)((?:\.| ?,)\s*(?:[Ss]elanjutnya|lalu)\s[^{}\\]*?\smenyerahkan bukti surat berupa ?:)( *)(?=\})")
R_X = re.compile(r"(?:[Ss]elanjutnya|lalu)\s([^{}\\]*?)\smenyerahkan bukti surat berupa")


def ubah_pengantar(p1, pihak, daftar):
    """Paragraf pengantar BAS -> (paragraf baru, X = sebutan pihak di klausa 'menyerahkan', bentuk)."""
    for bentuk, rx in (('a', R_A), ('c', R_C), ('b', R_B)):
        ms = list(rx.finditer(p1))
        if len(ms) != 1:
            continue
        m = ms[0]
        if bentuk == 'b':
            tail, spasi = m.group(3), m.group(4)
            ganti = minta(daftar, ('A', 'b', pihak), jenis='A', bentuk='b', pihak=pihak)
        elif bentuk == 'a':
            tail, spasi = m.group(4), m.group(5)
            ganti = minta(daftar, ('A', 'a', pihak), jenis='A', bentuk='a', pihak=pihak)
        else:
            tail, spasi = m.group(4), m.group(5)
            ganti = minta(daftar, ('A', 'c', pihak), jenis='A', bentuk='c', pihak=pihak)
        # seluruh frasa "alat bukti ... saksi-saksi" diganti variabel (spasi di ujung nilai dipangkas ABT, jadi tidak ada spasi tepi)
        baru = p1[:m.start()] + ganti + minta(daftar, ('SL', pihak, tail), jenis='SL', pihak=pihak, hadir=tail) + spasi + p1[m.end():]
        x = R_X.search(tail)
        if not x:
            raise Lewat('sebutan pihak di klausa menyerahkan tidak terbaca')
        return baru, x.group(1).strip(), bentuk
    raise Lewat('kalimat pengantar BAS tidak dikenal: %s' % teks(p1)[:140])


def ubah_bas(raw, daftar, catat, rel):
    u = satuan(raw)
    ubah = []
    n = 0
    for i, (s, e, _, _) in enumerate(u):
        unit = raw[s:e]
        m = RE_VAR.search(unit)
        if not m:
            continue
        if i == 0:
            raise Lewat('daftar bukti di paragraf pertama')
        v = m.group(1)
        pihak = 'T' if v == '11171' else 'P'
        ps, pe = u[i - 1][0], u[i - 1][1]
        p1 = raw[ps:pe]
        baru_p1, x, bentuk = ubah_pengantar(p1, pihak, daftar)
        surat = pembawa_daftar(unit, v, daftar.minta(('DS', pihak), jenis='DS', pihak=pihak), True)
        elek = pembawa_daftar(unit, v, daftar.minta(('DE', pihak), jenis='DE', pihak=pihak), False)
        intro = pembawa(p1, minta(daftar, ('EI', pihak, x), jenis='EI', pihak=pihak, sebut=x))
        ubah.append((ps, pe, baru_p1))
        ubah.append((s, e, surat + intro + elek))
        catat.append((rel, 'BAS %s%s' % (pihak, bentuk), 'pengantar + daftar surat + pengantar elektronik (%s) + daftar elektronik' % x))
        n += 1
    if not n:
        raise Lewat('tidak ada daftar bukti')
    return terapkan(raw, ubah), n, ubah


# ───────────────────────── putusan ─────────────────────────
RE_HA = re.compile(r'^[A-Z]\.\s*((?:Bukti )?Surat)(\s?:?)$')
RE_HB = re.compile(r'^([A-Z])\.\s*(Saksi)(\s?:?)$')
RE_HE_ADA = re.compile(r'^[A-Z]\.\s*Bukti Elektronik')


def ubah_putusan(raw, daftar, catat, rel):
    u = satuan(raw)
    ubah = []
    n = 0
    for i, (s, e, _, _) in enumerate(u):
        unit = raw[s:e]
        m = RE_VAR.search(unit)
        if not m:
            continue
        if i == 0:
            raise Lewat('daftar bukti di paragraf pertama')
        v = m.group(1)
        pihak = 'T' if v == '11171' else 'P'
        sebelum = teks(raw[u[i - 1][0]:u[i - 1][1]])
        sesudah = teks(raw[u[i + 1][0]:u[i + 1][1]]) if i + 1 < len(u) else ''
        if RE_HE_ADA.match(sesudah):
            # blangko sudah punya sub-bab "B. Bukti Elektronik:" sendiri (isian 9951): dibiarkan apa adanya
            catat.append((rel, 'PUTUSAN %s' % pihak, 'DIBIARKAN: sudah ada sub-bab Bukti Elektronik sendiri'))
            continue
        surat = pembawa_daftar(unit, v, daftar.minta(('DS', pihak), jenis='DS', pihak=pihak), True)
        elek = pembawa_daftar(unit, v, daftar.minta(('DE', pihak), jenis='DE', pihak=pihak), False)
        mha = RE_HA.match(sebelum)
        # sub-bab Saksi: dalam 3 paragraf sesudah daftar (boleh ada tanggapan / penampung isian di antaranya)
        hb = None
        for j in range(i + 1, min(len(u), i + 4)):
            t = teks(raw[u[j][0]:u[j][1]])
            mm = RE_HB.match(t)
            if mm:
                hb = (j, mm)
                break
            if re.match(r'^[A-Z]\.\s', t):
                break
        if mha:
            ha_s, ha_e = u[i - 1][0], u[i - 1][1]
            gaya = mha.group(2)
            judul = mha.group(1) + gaya
            ha = pembawa(raw[ha_s:ha_e], minta(daftar, ('HA', pihak, judul), jenis='HA', pihak=pihak, judul=judul))
            he = pembawa(raw[ha_s:ha_e], minta(daftar, ('HE', pihak, gaya), jenis='HE', pihak=pihak, gaya=gaya))
            ubah.append((ha_s, ha_e, ha))
            ubah.append((s, e, surat + he + elek))
            ket = 'sub-bab %s' % judul
        else:
            # tanpa judul sub-bab (kalimat pengantar sendiri): daftar elektronik didahului kalimat pengantar berformat kalimat itu
            kal_s, kal_e = u[i - 1][0], u[i - 1][1]
            kal = raw[kal_s:kal_e]
            mx = re.search(r'(?:^|,\s)([^,]*?)\s(?:telah )?menyerahkan\s(?:alat )?bukti surat berupa ?:\s*$', sebelum)
            if not mx:
                raise Lewat('kalimat pengantar putusan tanpa sub-bab tidak dikenal: %s' % sebelum[:120])
            x = mx.group(1).strip()
            intro = pembawa(kal, minta(daftar, ('EI', pihak, x), jenis='EI', pihak=pihak, sebut=x))
            ubah.append((s, e, surat + intro + elek))
            ket = 'tanpa sub-bab (%s)' % x
        if hb:
            j, mm = hb
            hs, he_ = u[j][0], u[j][1]
            isi = '%s%stab %s%s' % (daftar.minta(('LT', pihak), jenis='LT', pihak=pihak), BS, mm.group(2), mm.group(3))
            ubah.append((hs, he_, paragraf_tutup(raw[hs:he_], isi)))
            ket += ' + huruf sub-bab Saksi'
        else:
            ket += ' (tanpa sub-bab Saksi di dekatnya)'
        catat.append((rel, 'PUTUSAN %s' % pihak, ket))
        n += 1
    return terapkan(raw, ubah), n, ubah


def terapkan(raw, ubah):
    ubah = sorted(ubah)
    hasil, pos = [], 0
    for s, e, g in ubah:
        assert s >= pos, (s, pos)
        hasil.append(raw[pos:s])
        hasil.append(g)
        pos = e
    hasil.append(raw[pos:])
    return ''.join(hasil)
