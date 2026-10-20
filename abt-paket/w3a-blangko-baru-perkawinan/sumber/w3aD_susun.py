# -*- coding: utf-8 -*-
"""Penyusun RTF jenis HAK BEKAS ISTRI (agen W3a-D): 15 putusan dari folder dasar "6c Nafkah Anak" + BAS (salinan ALUR 04-09 dan 9 khusus).

Tiap putusan = berkas dasar yang paragrafnya diganti menurut aturan (regex pada teks paragraf tanpa label daftar), lalu penggantian global
(variabel sita 9755/9756 -> 3778/3779, alasan ditolak 9750 -> 3755, kata jenis). Teks statis yang ditambahkan TIDAK memuat frasa "nafkah anak"
(frasa itu diganti ke kata jenis di akhir)."""
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import w3a_lib as L  # noqa: E402

DASAR = '6c Nafkah Anak'
DASAR_BAS = '6c Nafkah Anak - BAS'
KATA = L.JENIS['hak-bekas-istri']['kata']
SINGKAT = L.JENIS['hak-bekas-istri']['singkat']

# Token isian yang tidak tampak di naskah tetapi dibaca kueri otomatis: dicantumkan di paragraf tersembunyi awal berkas agar muncul di popup.
TOKEN_ISIAN = ['3740', '3741', '3742', '3743', '3744', '3745', '3746', '3747', '3748', '3749', '3750', '3751', '3752', '3753', '3754', '3755', '3756',
               '9711', '9712', '9713', '9714', '9740', '9741', '9746', '9747', '9749', '9303']

# ---------------------------------------------------------------------------------------------------------------------
# TEKS PENGGANTI
# ---------------------------------------------------------------------------------------------------------------------
KEWENANGAN = ('Menimbang, bahwa #0053# #0046# pada pokoknya mengenai penentuan kewajiban bekas suami dan hak bekas istri setelah perkawinan #0046# dan #0047# yang dilangsungkan '
              'menurut hukum Islam putus karena perceraian, yaitu tuntutan agar #0047# dihukum memenuhi #3764# bagi #0046#; oleh karena perkara ini menyangkut penentuan kewajiban '
              'memberi biaya penghidupan oleh suami kepada bekas istri atau penentuan suatu kewajiban bagi bekas istri sebagai akibat putusnya perkawinan, maka berdasarkan '
              'Penjelasan Pasal 49 huruf a angka 13 Undang-Undang Nomor 7 Tahun 1989 tentang Peradilan Agama sebagaimana telah diubah dengan Undang-Undang Nomor 3 Tahun 2006 '
              'dan perubahan kedua dengan Undang-Undang Nomor 50 Tahun 2009 jo. Pasal 63 ayat (1) huruf a dan Pasal 41 huruf c Undang-Undang Nomor 1 Tahun 1974 tentang Perkawinan, '
              'perkara a quo termasuk kewenangan absolut Pengadilan Agama;')
KEDUDUKAN = ('Menimbang, bahwa berdasarkan surat #0053# dan keterangan para pihak, #0046# adalah bekas istri dari #0047# yang perkawinannya telah putus karena perceraian sebagaimana #3740#, '
             'dan #0047# adalah bekas suami #0046#, sehingga berdasarkan Pasal 41 huruf c Undang-Undang Nomor 1 Tahun 1974 tentang Perkawinan #0046# mempunyai kepentingan hukum '
             '(persona standi in judicio) untuk menuntut hak-haknya sebagai bekas istri terhadap #0047# selaku bekas suami;')
ISU = [
    'Apakah perkawinan #0046# dan #0047# telah putus karena perceraian dan hak-hak bekas istri yang dituntut belum pernah diputus dalam perkara perceraian tersebut?',
    'Apakah #0046# berhak atas #3764# yang dituntutnya, termasuk apakah #0046# tidak terbukti nusyuz, dan apakah #0047# telah melalaikan kewajibannya sebagai bekas suami?',
    'Berapa besar #3764# yang patut dibebankan kepada #0047# dengan mempertimbangkan kebutuhan dasar hidup #0046# dan kemampuan #0047#?',
]
FAKTA = [
    'Bahwa #0046# dan #0047# dahulu adalah suami istri yang menikah menurut hukum Islam, dan perkawinan tersebut telah putus karena #3741# sebagaimana #3740#;',
    'Bahwa #3745#;',
    'Bahwa #3772#;',
    'Bahwa #3746#;',
    'Bahwa #3747#;',
    'Bahwa #0047# bekerja sebagai #0104# #5271#;',
    'Bahwa #3749#;',
]
BEBAN_EKOR = ('khusus dalam perkara hak bekas istri dan kewajiban bekas suami, #8554# tetap menggali fakta kemampuan ekonomi #0047# dan fakta kebutuhan dasar hidup #0046# '
              'sebagaimana Rumusan Hukum Kamar Agama Surat Edaran Mahkamah Agung Nomor 3 Tahun 2018 (Hukum Keluarga huruf b), sehingga besarnya hak yang dibebankan tidak diputus '
              'hanya berdasarkan sikap diam atau pengakuan para pihak tanpa didukung alat bukti lain;')
PERTIMBANGAN_UTAMA = '#3765##3775##3766##3767##3768##3769##3770##3771##3776#'
PERTIMBANGAN_TOLAK = '#3765##3775#'
AMAR_MENGHUKUM = 'Menghukum #0047# untuk membayar kepada #0046# selaku bekas istri hak-hak sebagai berikut:#3773##3774##3777#'
KEWENANGAN_PERDAMAIAN = ('Menimbang, bahwa #0053# #0046# pada pokoknya mengenai penentuan kewajiban bekas suami dan hak bekas istri setelah putusnya perkawinan #0046# dan #0047# yang '
                         'dilangsungkan menurut hukum Islam, maka berdasarkan Penjelasan Pasal 49 huruf a angka 13 Undang-Undang Nomor 7 Tahun 1989 tentang Peradilan Agama sebagaimana '
                         'telah diubah dengan Undang-Undang Nomor 3 Tahun 2006 dan perubahan kedua dengan Undang-Undang Nomor 50 Tahun 2009, perkara a quo termasuk kewenangan absolut Pengadilan Agama;')


def _ganti_ketergantungan(t, lama, baru):
    return t.replace(lama, baru)


# ---------------------------------------------------------------------------------------------------------------------
# Mesin penggantian paragraf
# ---------------------------------------------------------------------------------------------------------------------
def _listtext(p):
    return '{\\listtext' in p


def _awalan(t):
    """Awalan nomor literal "1.<tab>" pada teks paragraf (berkas dasar memakai nomor literal, bukan daftar otomatis)."""
    m = re.match(r'^(\d+\.	)', t)
    return m.group(1) if m else ''


def terapkan(raw, aturan, daftar_fakta=True):
    """aturan: daftar (regex, ganti) - ganti = str atau fungsi(teks)->str; dicocokkan pada teks TANPA nomor literal dan nomornya dipertahankan.
    Pertama yang cocok menang. Butir bernomor 'Bahwa ...' (fakta hukum) diganti FAKTA, butir 'Apakah ...' (pokok sengketa) diganti ISU."""
    d = L.dok_dari_raw(raw)
    keluar = []
    i = 0
    n = len(d.par)
    dipakai = [0] * len(aturan)

    def blok(i, awal):
        j = i
        while j < n and _awalan(d.isi(j)) and d.isi(j)[len(_awalan(d.isi(j))):].startswith(awal):
            j += 1
        return j

    while i < n:
        p = d.par[i]
        t = d.isi(i)
        aw = _awalan(t)
        body = t[len(aw):]
        if aw and body.startswith('Bahwa ') and daftar_fakta:
            j = blok(i, 'Bahwa ')
            if j - i >= 3:
                for k, teks in enumerate(FAKTA, 1):
                    keluar.append(d.ganti_teks(i, '%d.	%s' % (k, teks)))
                i = j
                continue
        if aw and body.startswith('Apakah '):
            j = blok(i, ('Apakah ', 'Berapa '))
            for k, teks in enumerate(ISU, 1):
                keluar.append(d.ganti_teks(i, '%d.	%s' % (k, teks)))
            i = j
            continue
        hasil = None
        for ai, (rx, ganti) in enumerate(aturan):
            if re.search(rx, body, re.S):
                hasil = ganti(body) if callable(ganti) else ganti
                dipakai[ai] += 1
                break
        keluar.append(d.ganti_teks(i, aw + hasil) if hasil is not None else p)
        i += 1
    return d.rakit(keluar), dipakai


def paragraf_token_tersembunyi():
    """Paragraf awal tersembunyi (daftar token isian untuk popup) - bentuk sama dengan berkas Wali Adhal."""
    d = L.dok('7 Wali Adhal/[01] [Kabul] Wali Adhal - Wali Tidak Hadir.rtf')
    p = d.par[0]
    lama = '#9201# #9203# #9206#'
    assert lama in p, 'paragraf tersembunyi Wali Adhal berubah'
    return p.replace(lama, ' '.join('#%s#' % k for k in TOKEN_ISIAN))


def _global(raw):
    raw = raw.replace('#9755#', '#3778#').replace('#9756#', '#3779#').replace('#9750#', '#3755#')
    return L.ganti(raw, L.variasi('nafkah anak', KATA))


def _nama_tujuan(berkas):
    return berkas.replace('Nafkah Anak', SINGKAT)


# aturan umum substantif (semua varian bertubuh pertimbangan)
def aturan_substantif(jenis):
    """jenis: 'kabul' | 'sebagian' | 'tolak' | 'no'."""
    A = [
        (r'^Menimbang, bahwa #0053# #0046# pada pokoknya mengenai nafkah', KEWENANGAN),
        (r'^Menimbang, bahwa berdasarkan surat #0053# dan keterangan para pihak, #0046# adalah', KEDUDUKAN),
        (r'^Menimbang, bahwa esensi dari kewajiban pembuktian',
         lambda t: t[:t.index('khusus dalam perkara')] + BEBAN_EKOR),
        (r'menyangkut kepentingan anak',
         lambda t: t.replace('perkara a quo menyangkut kepentingan anak', 'perkara a quo menyangkut akibat hukum putusnya perkawinan yang harus dipastikan kebenarannya')),
        (r'^(Mengenai|Pertimbangan) Nafkah Anak$', lambda t: t.replace('Nafkah Anak', 'Hak Bekas Istri dan Kewajiban Bekas Suami')),
    ]
    if jenis in ('kabul', 'sebagian'):
        A += [
            (r'^Menimbang, bahwa berdasarkan Pasal 41 huruf b Undang-Undang Nomor 1 Tahun 1974 tentang Perkawinan, bapak bertanggung jawab', PERTIMBANGAN_UTAMA),
            (r'^Menimbang, bahwa berdasarkan pertimbangan-pertimbangan tersebut di atas, #0053# #0046# mengenai nafkah',
             lambda t: t.replace('mengenai nafkah #9302# tersebut', 'mengenai #3763#')),
            (r'^Menghukum #0047# untuk melaksanakan kewajibannya', AMAR_MENGHUKUM),
        ]
    elif jenis == 'tolak':
        A += [(r'^Menimbang, bahwa berdasarkan Pasal 41 huruf b Undang-Undang Nomor 1 Tahun 1974 tentang Perkawinan, bapak bertanggung jawab', PERTIMBANGAN_TOLAK)]
    return A


# ---------------------------------------------------------------------------------------------------------------------
# Putusan
# ---------------------------------------------------------------------------------------------------------------------
SUBSTANTIF = [
    ('[01] [Kabul] Nafkah Anak - Kontradiktoir.rtf', 'kabul'),
    ('[01a] [Kabul] Nafkah Anak - T Tidak Hadir Setelah Mediasi.rtf', 'kabul'),
    ('[01b] [Kabul Verstek] Nafkah Anak.rtf', 'kabul'),
    ('[02] [Kabul Sebagian] Nafkah Anak - Kontradiktoir - Petitum Selebihnya Ditolak.rtf', 'sebagian'),
    ('[02b] [Kabul Sebagian Verstek] Nafkah Anak - T Tidak Hadir - Petitum Selebihnya Ditolak.rtf', 'sebagian'),
    ('[03] [Tolak] Nafkah Anak - Kontradiktoir - Dalil Tidak Terbukti.rtf', 'tolak'),
    ('[03b] [Tolak Verstek] Nafkah Anak - T Tidak Hadir - Dalil Tidak Terbukti.rtf', 'tolak'),
    ('[99a] [NO] Nafkah Anak - Kurang Pihak (Plurium Litis Consortium).rtf', 'no'),
    ('[99b] [NO] Nafkah Anak - Gugatan Kabur (Obscuur Libel).rtf', 'no'),
]
UMUM = [b for b, _ in L.UMUM_GUGATAN]


def susun_substantif(berkas, jenis):
    raw = L.baca_raw('%s/%s' % (DASAR, berkas))
    A = aturan_substantif(jenis)
    if jenis == 'tolak':
        # penutup: "Menolak ..." sudah memuat #9756#; kalimat alasan memakai #9750#
        pass
    raw, dipakai = terapkan(raw, A)
    raw = _global(raw)
    d = L.dok_dari_raw(raw)
    hasil = d.kepala + paragraf_token_tersembunyi() + ''.join(d.par) + d.ekor
    return hasil, dipakai


def susun_umum(berkas):
    raw = L.baca_raw('%s/%s' % (DASAR, berkas))
    if berkas.startswith('[97]'):
        raw, _ = terapkan(raw, [(r'^Menimbang, bahwa #0053# #0046# pada pokoknya mengenai nafkah anak setelah putusnya perkawinan', KEWENANGAN_PERDAMAIAN)], daftar_fakta=False)
    return _global(raw)


def bangun_putusan():
    hasil = []
    for berkas, jenis in SUBSTANTIF:
        raw, _ = susun_substantif(berkas, jenis)
        hasil.append(L.simpan_putusan(L.JENIS['hak-bekas-istri'], _nama_tujuan(berkas), raw))
    for berkas in UMUM:
        hasil.append(L.simpan_putusan(L.JENIS['hak-bekas-istri'], _nama_tujuan(berkas), susun_umum(berkas)))
    return hasil


# ---------------------------------------------------------------------------------------------------------------------
# BAS
# ---------------------------------------------------------------------------------------------------------------------
def bas_khusus(j):
    """9 BAS khusus (ALUR 65). Salinan dari w3a_lib.buat_bas_khusus_gugatan, tetapi butir "3. Menghukum ..." pada V2/V2S berlabel literal
    (bukan daftar) sehingga regex pustaka tidak cocok; label "3.<tab>" dipertahankan di sini."""
    hasil = []
    for kode, akhir in L.KHUSUS_GUGATAN:
        raw = L.baca_raw('%s/BAS ALUR 46 Nafkah Anak - %s.rtf' % (DASAR_BAS, akhir))
        raw = L.ganti(raw, L.variasi('nafkah anak', j['kata']))
        if kode in ('V2', 'V2S'):
            raw = L.ganti_paragraf(raw, r'^(?:\d+\.	)?Menghukum #0047# untuk melaksanakan kewajibannya',
                                   lambda t: (re.match(r'^(?:\d+\.	)?', t).group(0)) + AMAR_MENGHUKUM)
        hasil.append(L.simpan_bas(j, '%s - %s.rtf' % (j['awalan_bas'], akhir), raw))
    return hasil


def bangun_bas():
    j = L.JENIS['hak-bekas-istri']
    hasil = []
    hasil += L.buat_salinan_gugatan(j, '3757', '3758')
    hasil += bas_khusus(j)
    return hasil


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    p = bangun_putusan()
    b = bangun_bas()
    print('putusan', len(p), 'BAS', len(b))
