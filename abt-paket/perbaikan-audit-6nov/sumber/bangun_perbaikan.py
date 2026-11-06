# -*- coding: utf-8 -*-
"""Membangun paket ABT `abt-perbaikan-audit-6nov` (keputusan Derry, 6 Nov 2026) atas keadaan blangko SESUDAH empat paket sebelumnya
(a5-merah-5nov, a5-kelompok-5nov, saksi-tanya-jawab-43-5nov; prodeo-8507-5nov hanya mengubah rumus). Hanya blangko pengguna derry_briantono.

pakai:  python -B bangun_perbaikan.py <folder derry_briantono keadaan gabungan> <folder paket (abt-paket/perbaikan-audit-6nov)>

Tiap perbaikan disusun sebagai potongan (mulai, akhir, baru) atas huruf teks polos (rtfpatch.py), jadi hanya kata yang dituju berubah; kata kendali,
warna, dan format di sekitarnya tetap. Keluaran: paket-satker/tambal.tsv, daftar-tambal.tsv, daftar-baru.tsv, rtf-baru/, hasil/daftar-tambalan.csv, hasil/ringkas.txt.
"""
import base64
import collections
import hashlib
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from rtfpatch import Dok, terapkan  # noqa: E402

DASAR = sys.argv[1].replace('\\', '/').rstrip('/') + '/'
PAKET = sys.argv[2].replace('\\', '/').rstrip('/') + '/'
SATKER = PAKET + 'paket-satker/'
HASIL = PAKET + 'hasil/'
AWAL = 'derry_briantono/'

RAPOSTROF = '’'
F_CT = '1a Perceraian CT'
F_1C = '1c Perceraian Kumulasi Itsbat Nikah'
F_DK = '3 Dispensasi Kawin'
F_IN = '2 Itsbat Nikah'
F_B10 = 'ALUR 10 Cerai Talak Sidang Ikrar Talak'
F_B1A = '1a Perceraian CT - BAS'
BAS10_3 = 'BAS ALUR 10 [3] BAS Ikrar Talak - P Tidak Hadir & T Hadir, Tunda Tenggang Waktu 6 Bulan.rtf'
BAS10_4 = 'BAS ALUR 10 [4] BAS Ikrar Talak - P & T Tidak Hadir, Tunda Tenggang Waktu 6 Bulan.rtf'
B10_3 = '[3] BAS Ikrar Talak - P Tidak Hadir & T Hadir, Tunda Tenggang Waktu 6 Bulan.rtf'
B10_4 = '[4] BAS Ikrar Talak - P & T Tidak Hadir, Tunda Tenggang Waktu 6 Bulan.rtf'

HARAPAN = collections.OrderedDict([
    ('S-13', 1), ('CT-01', 11), ('CT-02a', 9), ('CT-02b', 8), ('CT-03', 1), ('CG-07', 16), ('KW-01', 7), ('KW-02', 2), ('KW-07', 5), ('KW-08', 14),
    ('BK-01', 2), ('BK-06', 2), ('AN-01', 64),
])


def md5(b):
    return hashlib.md5(b).hexdigest()


def baca(rel):
    with open(DASAR + rel, 'rb') as f:
        return f.read()


def semua_berkas():
    hasil = []
    for fol in sorted(os.listdir(DASAR)):
        if not os.path.isdir(DASAR + fol):
            continue
        for nama in sorted(os.listdir(DASAR + fol)):
            if nama.lower().endswith('.rtf'):
                hasil.append((fol, nama))
    return hasil


per_berkas = collections.OrderedDict()  # rel -> [(temuan, [potongan])]
terkena = collections.OrderedDict((k, []) for k in HARAPAN)


def catat(temuan, rel, potongan):
    per_berkas.setdefault(rel, []).append((temuan, potongan))
    if rel not in terkena[temuan]:
        terkena[temuan].append(rel)


def ada(D, teks):
    return teks in D.T


# --------------------------------------------------------------------------------------------------------------------
def ct01(rel, fol, nama, D):
    if fol != F_CT:
        return
    prim = "2.\tMenjatuhkan talak satu ba'in shughra #0047# (#0102#) terhadap #0046# (#0098#);"
    pert = "agar menjatuhkan talak satu ba'in shughra #0047# (#0102#) terhadap #0046# (#0098#), "
    p = []
    if ada(D, prim):
        p += D.ganti('Menjatuhkan talak satu ', 'Memberi izin kepada #0046# (#0098#) untuk menjatuhkan talak satu ', sebelum='2.\t', sesudah="ba'in shughra #0047# (#0102#) terhadap #0046# (#0098#);")
        p += D.ganti("ba'in shughra", 'raj' + RAPOSTROF + 'i ', sebelum='2.\tMenjatuhkan talak satu ', sesudah=' #0047# (#0102#) terhadap #0046# (#0098#);')
        p += D.ganti(' #0047# (#0102#) terhadap #0046# (#0098#)', 'terhadap #0047# (#0102#) di depan sidang #8008#', sebelum="ba'in shughra", sesudah=';')
    if ada(D, pert):
        p += D.ganti('', 'memberi izin kepada #0046# (#0098#) untuk ', sebelum='bermohon kepada #8008# agar ', sesudah="menjatuhkan talak satu ba'in shughra #0047# (#0102#)")
        p += D.ganti("ba'in shughra", 'raj' + RAPOSTROF + 'i ', sebelum='agar menjatuhkan talak satu ', sesudah=' #0047# (#0102#) terhadap #0046# (#0098#), ')
        p += D.ganti(' #0047# (#0102#) terhadap #0046# (#0098#)', 'terhadap #0047# (#0102#) di depan sidang #8008#', sebelum="ba'in shughra", sesudah=', ')
    if p:
        catat('CT-01', rel, p)


def ct02(rel, fol, nama, D):
    if not (fol == F_CT or (fol == F_1C and 'Putusan CT Kumulasi' in nama)):
        return
    a = 'merupakan suami sah #0046#, maka'
    if ada(D, a):
        catat('CT-02a', rel, D.ganti('suami', 'istri', sebelum='merupakan ', sesudah=' sah #0046#, maka'))
    b = 'talak satu raj' + RAPOSTROF + 'i kepada #0046# di depan sidang #8008#'
    if ada(D, b):
        p = D.ganti('kepada', 'terhadap', sebelum='talak satu raj' + RAPOSTROF + 'i ', sesudah=' #0046# di depan sidang #8008#')
        p += D.ganti('#0046#', '#0047#', sebelum='talak satu raj' + RAPOSTROF + 'i kepada ', sesudah=' di depan sidang #8008#')
        catat('CT-02b', rel, p)


def ct03(rel, fol, nama, D):
    if not (fol == F_CT and nama.startswith('[01ab] [Tolak Verstek] Cerai - Kurang 6 Bulan')):
        return
    kalimat = 'Dikuatkan lagi bahwa #0047# tidak melaksanakan kewajiban nafkah lahir semenjak #0222# atau belum mencapai batas minimal 12 (dua belas) bulan. '
    p = D.ganti(kalimat, '', sebelum='belum mencapai batas minimal 6 (enam) bulan. ', sesudah='Oleh karenanya #8554# berpendapat', lintas=True)
    p += D.hapus_paragraf('Menimbang, #8554# juga perlu mengemukakan Hadits Rasulullah Muhammad shallallahu alaihi wasallam sebagai berikut :', 'Ibnu Majah Nomor 2055)')
    catat('CT-03', rel, p)


def cg07(rel, fol, nama, D):
    sig = 'terhadap bukti surat yang diajukan #0046# akan dipertimbangkan sebagai berikut:\n-\tBahwa bukti T.1 dan T.2 yang diajukan #0046# telah'
    if b'T.1' not in D.data or not ada(D, sig):
        return
    p = D.ganti('#0046#', '#0047#', sebelum='terhadap bukti surat yang diajukan ', sesudah=' akan dipertimbangkan sebagai berikut:\n-\tBahwa bukti T.1 dan T.2')
    p += D.ganti('#0046#', '#0047#', sebelum='Bahwa bukti T.1 dan T.2 yang diajukan ', sesudah=' telah diberi meterai cukup')
    catat('CG-07', rel, p)


def kw01(rel, fol, nama, D):
    if fol != F_DK or not ada(D, 'dan disertai saksi-saksi pendukung yang cukup'):
        return
    p = D.ganti('', ',', sebelum='sebagaimana dimaksud pada ayat (1)', sesudah=' orang tua pihak pria dan/orang tua wanita dapat minta dispensasi')
    # "dan/orang tua wanita" -> "dan/atau orang tua pihak wanita": dua sisipan kecil
    p += D.ganti('', 'atau ', sebelum='orang tua pihak pria dan/', sesudah='orang tua wanita dapat minta dispensasi')
    p += D.ganti('', 'pihak ', sebelum='dan/orang tua ', sesudah='wanita dapat minta dispensasi')
    p += D.ganti('minta', 'meminta', sebelum='wanita dapat ', sesudah=' dispensasi kepada Pengadilan')
    p += D.ganti('dan disertai saksi-saksi', 'disertai bukti-bukti', sebelum='alasan sangat mendesak ', sesudah=' pendukung yang cukup')
    catat('KW-01', rel, p)


def kw02(rel, fol, nama, D):
    if fol != F_DK or not (nama.startswith('[03a]') or nama.startswith('[03c]')):
        return
    catat('KW-02', rel, D.ganti(' karena rentan terkena kanker mulut rahim (serviks)', '', sebelum='kesehatan reproduksi anak', sesudah=', maupun kondisi psikis anak', lintas=True))


def kw07(rel, fol, nama, D):
    if fol != F_IN or 'secara elektronik melalui aplikasi\xa0e-Court;' not in D.T:
        return
    m = re.search(r'Bahwa, (?:para )?#0046# mengajukan #0053#\xa0a quo\xa0secara elektronik melalui aplikasi\xa0e-Court;', D.T)
    awal = m.group(0)
    p = D.hapus_paragraf(awal, 'secara\xa0e-Litigasi;')
    para = 'para ' if 'Bahwa, para #0046#' in awal else ''
    ident = 'Bahwa, #8554# telah memeriksa identitas %s#0046# yang ternyata sesuai dengan yang tertera dalam surat #0053# sebagai keterangan para pihak;' % para
    p += D.hapus_paragraf(ident)
    p += D.ganti('', ' #8509#', sebelum='dan terhadap panggilan tersebut %s#0046# telah hadir in person;' % para)
    catat('KW-07', rel, p)


def kw08(rel, fol, nama, D):
    if fol != F_IN or not ada(D, 'diumumkan pada tanggal #0306# oleh'):
        return
    p = D.ganti('tanggal', 'hari', sebelum='telah diumumkan pada ', sesudah=' #0306# oleh')
    p += D.ganti('#0306#', '#9100#', sebelum='telah diumumkan pada tanggal ', sesudah=' oleh')
    catat('KW-08', rel, p)


def bk01(rel, fol, nama, D):
    if not ((fol == F_B1A and nama.startswith('BAS ALUR 10 [2a]')) or (fol == F_B10 and nama.startswith('[2a]'))):
        return
    catat('BK-01', rel, D.ganti('#0046#', '#0047#', sebelum='sesuai Putusan Nomor #0001# Tanggal #1069# kepada ', sesudah=';\nAtas pertanyaan Ketua Majelis, Termohon'))


def an01(rel, fol, nama, D):
    if b'#11888#' not in D.data or not ada(D, 'Pasal #11888# dan Pasal #11889#'):
        return
    p = D.ganti('#11889#', '#11890#', sebelum='Pasal #11888# dan Pasal ')
    p += D.ganti('#11888#', '#11889#', sebelum='Pasal ', sesudah=' dan Pasal #11889#')
    catat('AN-01', rel, p)


def s13(rel, fol, nama, D):
    if fol != F_DK or b'#9251#Bahwa pada hari dan tanggal persidangan' not in D.data:
        return
    catat('S-13', rel, D.ganti('', ' ', sebelum='#9251#', sesudah='Bahwa pada hari dan tanggal persidangan'))


ATURAN = [
    (ct01, lambda fol, nama, d: fol == F_CT), (ct02, lambda fol, nama, d: fol in (F_CT, F_1C)), (ct03, lambda fol, nama, d: fol == F_CT),
    (cg07, lambda fol, nama, d: b'T.1' in d), (kw01, lambda fol, nama, d: fol == F_DK), (kw02, lambda fol, nama, d: fol == F_DK),
    (kw07, lambda fol, nama, d: fol == F_IN), (kw08, lambda fol, nama, d: fol == F_IN), (bk01, lambda fol, nama, d: fol in (F_B1A, F_B10)),
    (an01, lambda fol, nama, d: b'#11888#' in d), (s13, lambda fol, nama, d: fol == F_DK),
]


def main():
    berkas = semua_berkas()
    for fol, nama in berkas:
        rel = AWAL + fol + '/' + nama
        data = baca(fol + '/' + nama)
        D = None
        for fn, syarat in ATURAN:
            if not syarat(fol, nama, data):
                continue
            if D is None:
                D = Dok(data)
            fn(rel, fol, nama, D)

    # --- BK-06: salin versi folder 1a ke ALUR 10 [3] dan tambahkan [4] --------------------------------------------------
    sumber3 = baca(F_B1A + '/' + BAS10_3)
    sumber4 = baca(F_B1A + '/' + BAS10_4)
    rel3 = AWAL + F_B10 + '/' + B10_3
    lama3 = baca(F_B10 + '/' + B10_3)
    per_berkas.setdefault(rel3, []).append(('BK-06', [(0, len(lama3), sumber3)]))
    terkena['BK-06'].append(rel3)
    rel4 = AWAL + F_B10 + '/' + B10_4
    if os.path.exists(DASAR + F_B10 + '/' + B10_4):
        raise SystemExit('ALUR 10 [4] sudah ada di dasar')
    terkena['BK-06'].append(rel4)

    # --- periksa jumlah berkas per temuan -----------------------------------------------------------------------------
    gagal = []
    for k, n in HARAPAN.items():
        if len(terkena[k]) != n:
            gagal.append('%s: %d berkas, diharapkan %d' % (k, len(terkena[k]), n))
    if gagal:
        raise SystemExit('JUMLAH BERKAS TIDAK SESUAI\n' + '\n'.join(gagal))

    # --- tulis ---------------------------------------------------------------------------------------------------------
    os.makedirs(SATKER, exist_ok=True)
    os.makedirs(HASIL, exist_ok=True)
    os.makedirs(SATKER + 'rtf-baru', exist_ok=True)
    tambal, daftar, csv = [], [], ['temuan,berkas,mulai,teks_lama,teks_baru']
    for i, (rel, daftar_tm) in enumerate(per_berkas.items(), 1):
        lama = baca(rel[len(AWAL):])
        semua = [x for _, ps in daftar_tm for x in ps]
        baru = terapkan(lama, semua)
        kode = 'P%04d' % i
        for a, b, n in sorted(semua):
            tambal.append('\t'.join([kode, str(a), base64.b64encode(lama[a:b]).decode(), base64.b64encode(n).decode()]))
        for tm, ps in daftar_tm:
            for a, b, n in sorted(ps):
                if tm == 'BK-06':
                    csv.append('%s,"%s",0,"[seluruh berkas diganti dengan versi folder 1a Perceraian CT - BAS]","[%d byte]"' % (tm, rel, len(n)))
                else:
                    csv.append('%s,"%s",%d,"%s","%s"' % (tm, rel, a, lama[a:b].decode('latin1').replace('"', '""')[:160], n.decode('latin1').replace('"', '""')[:160]))
        daftar.append('\t'.join([kode, rel, md5(lama), md5(baru), str(len(semua))]))
    # berkas baru
    with open(SATKER + 'rtf-baru/N0001.rtf', 'wb') as f:
        f.write(sumber4)
    baru_daftar = ['\t'.join(['N0001', rel4, md5(sumber4)])]

    def tulis(nama, baris, kepala):
        with open(SATKER + nama, 'wb') as f:
            f.write((kepala + '\n' + '\n'.join(baris) + '\n').encode('utf-8'))

    tulis('tambal.tsv', tambal, '# kode\toffset\tb64(teks lama)\tb64(teks baru)   (offset atas berkas LAMA = keadaan sesudah saksi-tanya-jawab-43-5nov)')
    tulis('daftar-tambal.tsv', daftar, '# kode\tberkas\tmd5_lama (sesudah saksi-tanya-jawab-43-5nov)\tmd5_baru\tpotongan')
    tulis('daftar-baru.tsv', baru_daftar, '# kode\tberkas (BARU, tidak boleh sudah ada)\tmd5   (isi dari rtf-baru/<kode>.rtf)')
    with open(HASIL + 'daftar-tambalan.csv', 'wb') as f:
        f.write(('\n'.join(csv) + '\n').encode('utf-8'))
    ring = ['%s\t%d berkas' % (k, len(v)) for k, v in terkena.items()]
    ring.append('CT-02 gabungan\t%d berkas' % len(set(terkena['CT-02a']) | set(terkena['CT-02b'])))
    ring.append('BERKAS DIUBAH\t%d' % len(per_berkas))
    ring.append('BERKAS BARU\t1')
    ring.append('POTONGAN\t%d' % len(tambal))
    with open(HASIL + 'ringkas.txt', 'wb') as f:
        f.write(('\n'.join(ring) + '\n').encode('utf-8'))
    print('\n'.join(ring))


main()
