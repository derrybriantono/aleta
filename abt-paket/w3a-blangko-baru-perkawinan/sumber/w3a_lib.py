# -*- coding: utf-8 -*-
"""Pustaka bersama paket ABT "abt-w3a-blangko-baru-perkawinan" (agen W3a, 21 Okt 2026).

Menyusun blangko Derry BARU untuk enam jenis perkara SIPP yang belum punya blangko:
  343 Penolakan Perkawinan | 345 Kelalaian atas Kewajiban Suami/Istri | 351 Hak-hak Bekas Istri/Kewajiban Bekas Suami
  352 Pengesahan Anak | 359 Perkawinan Campuran | 361 Izin Kawin

Dasar susunan: berkas Derry TERBARU di server (salinan: W3A_ASLI, bawaan D:/aleta-dev/kerja/w3a/asli/derry_briantono).
Tidak ada berkas lama yang diubah: semua keluaran berkas BARU di rtf/derry_briantono/<folder>/.

Pakai:
    import sys; sys.path.insert(0, '<...>/sumber'); import w3a_lib as L
    L.JENIS['penolakan-perkawinan']          # metadata jenis (folder, menu, nomor ALUR, jatah nomor variabel)
    d = L.dok('7 Wali Adhal/[01] [Kabul] Wali Adhal - Wali Tidak Hadir.rtf')   # Dok (paragraf mentah)
    L.simpan_putusan(j, '[01] [Kabul] ... .rtf', isi_rtf)                       # tulis ke folder putusan jenis
    L.simpan_bas(j, 'BAS ALUR 60 ... .rtf', isi_rtf)                            # tulis ke folder BAS jenis
    L.buat_umum_permohonan(j) / L.buat_bas_permohonan(j) / L.buat_umum_gugatan(j) / L.buat_salinan_gugatan(j) / L.buat_bas_khusus_gugatan(j)
"""
import os
import re
import sys

AKAR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))          # abt-paket/w3a-blangko-baru-perkawinan
sys.path.insert(0, os.path.join(AKAR, 'alat'))
from bangun import Dok, esc, simpan, periksa_token  # noqa: E402,F401

ASLI = os.environ.get('W3A_ASLI', 'D:/aleta-dev/kerja/w3a/asli') + '/derry_briantono'
OUT = os.path.join(AKAR, 'rtf', 'derry_briantono')
NAMA_PAKET = 'abt-w3a-blangko-baru-perkawinan'

# ---------------------------------------------------------------------------------------------------------------------
# METADATA JENIS. Nomor menu 168-179 (celah antara 166 Nafkah Anak - BAS dan 180 Putusan Hibah, kosong di abt_menu server 21 Okt 2026),
# ALUR BAS 60-65 (nomor 45 dan >=50 belum dipakai di alur-bas-baru-data.ts), variabel 3600-3799 (kosong di abt_variabel server).
# ---------------------------------------------------------------------------------------------------------------------
JENIS = {
    'penolakan-perkawinan': dict(
        sipp=343, nama='Penolakan Perkawinan', singkat='Penolakan Perkawinan', tipe='permohonan', nomor='Pdt.P',
        folder='5c Penolakan Perkawinan', menu_putusan=168, menu_bas=169, alur=60, alur_nama='Penolakan Perkawinan',
        var=(3600, 3619), kata='penolakan perkawinan', katalog='penolakan-perkawinan', deteksi='penolakanPerkawinan'),
    'perkawinan-campuran': dict(
        sipp=359, nama='Perkawinan Campuran', singkat='Perkawinan Campuran', tipe='permohonan', nomor='Pdt.P',
        folder='5d Perkawinan Campuran', menu_putusan=170, menu_bas=171, alur=61, alur_nama='Perkawinan Campuran',
        var=(3620, 3639), kata='perkawinan campuran', katalog='perkawinan-campuran', deteksi='perkawinanCampuran'),
    'izin-kawin': dict(
        sipp=361, nama='Izin Kawin', singkat='Izin Kawin', tipe='permohonan', nomor='Pdt.P',
        folder='3a Izin Kawin', menu_putusan=172, menu_bas=173, alur=62, alur_nama='Izin Kawin',
        var=(3640, 3659), kata='izin kawin', katalog='izin-kawin', deteksi='izinKawin'),
    'pengesahan-anak': dict(
        sipp=352, nama='Pengesahan Anak', singkat='Pengesahan Anak', tipe='permohonan', nomor='Pdt.P',
        folder='8a Pengesahan Anak', menu_putusan=174, menu_bas=175, alur=63, alur_nama='Pengesahan Anak',
        var=(3660, 3689), kata='pengesahan anak', katalog='pengesahan-anak', deteksi='pengesahanAnak'),
    'kelalaian-kewajiban': dict(
        sipp=345, nama='Kelalaian atas Kewajiban Suami/Istri', singkat='Kelalaian Kewajiban Suami Istri', tipe='gugatan', nomor='Pdt.G',
        folder='1e Kelalaian Kewajiban Suami Istri', menu_putusan=176, menu_bas=177, alur=64, alur_nama='Kelalaian Kewajiban',
        var=(3690, 3739), kata='kelalaian kewajiban suami atau istri', katalog='kelalaian-kewajiban', deteksi='kelalaianKewajiban'),
    'hak-bekas-istri': dict(
        sipp=351, nama='Hak-hak Bekas Istri/Kewajiban Bekas Suami', singkat='Hak Bekas Istri', tipe='gugatan', nomor='Pdt.G',
        folder='1f Hak Bekas Istri', menu_putusan=178, menu_bas=179, alur=65, alur_nama='Hak Bekas Istri',
        var=(3740, 3789), kata='hak bekas istri dan kewajiban bekas suami', katalog='hak-bekas-istri', deteksi='hakBekasIstri'),
}
CERMIN = {   # kunci jenis (huruf kecil) yang dipakai peta putusan bawaan/ekstensi + nama SIPP lain yang dipadankan ke kunci itu
    'penolakan-perkawinan': ('penolakan perkawinan', []),
    'perkawinan-campuran': ('perkawinan campuran', []),
    'izin-kawin': ('izin kawin', []),
    'pengesahan-anak': ('pengesahan anak', []),
    'kelalaian-kewajiban': ('kelalaian kewajiban suami istri', ['kelalaian atas kewajiban suami / istri', 'kelalaian atas kewajiban suami/istri']),
    'hak-bekas-istri': ('hak bekas istri', ['hak - hak bekas istri/kewajiban bekas suami', 'hak-hak bekas istri/kewajiban bekas suami']),
}
for _k, _j in JENIS.items():
    _j['kunci'] = _k
    _j['kunci_cermin'], _j['padanan_sipp'] = CERMIN[_k]
    _j['folder_bas'] = _j['folder'] + ' - BAS'
    _j['nama_menu_putusan'] = 'Putusan ' + _j['singkat']
    _j['alias_putusan'] = _j['singkat'] + ' - Putusan'
    _j['nama_menu_bas'] = _j['singkat'] + ' - BAS'
    _j['alias_bas'] = _j['singkat'] + ' - BAS'
    _j['awalan_bas'] = 'BAS ALUR %d %s' % (_j['alur'], _j['alur_nama'])

VAR_UMUM = (3790, 3799)      # jatah variabel lintas jenis


def lp(p):
    """Jalur panjang Windows - nama berkas BAS Derry panjang; LongPathsEnabled=0 di laptop ini."""
    p = os.path.abspath(p)
    awalan = chr(92) * 2 + '?' + chr(92)
    if os.name == 'nt' and not p.startswith(awalan):
        p = awalan + p
    return p


def asli(rel):
    return os.path.join(ASLI, rel)


def dok(rel):
    """Dok dari berkas Derry asli server (rel = 'folder/berkas.rtf' di bawah derry_briantono)."""
    return Dok(asli(rel))


def baca_raw(rel):
    return open(lp(asli(rel)), 'rb').read().decode('latin1')


def _folder_out(folder):
    p = os.path.join(OUT, folder)
    os.makedirs(lp(p), exist_ok=True)
    return p


def tulis_raw(folder, berkas, raw):
    """Tulis RTF (str latin1) ke rtf/derry_briantono/<folder>/<berkas>. Tidak pernah menimpa berkas ASLI server (hanya keluaran paket)."""
    if not berkas.lower().endswith('.rtf'):
        berkas += '.rtf'
    p = os.path.join(_folder_out(folder), berkas)
    with open(lp(p), 'wb') as f:
        f.write(raw.encode('latin1'))
    return p


def simpan_putusan(j, berkas, raw):
    pecah = periksa_token(raw)
    if pecah:
        raise SystemExit('token terpecah di %s: %r' % (berkas, pecah))
    return tulis_raw(j['folder'], berkas, raw)


def simpan_bas(j, berkas, raw):
    pecah = periksa_token(raw)
    if pecah:
        raise SystemExit('token terpecah di %s: %r' % (berkas, pecah))
    return tulis_raw(j['folder_bas'], berkas, raw)


# ---------------------------------------------------------------------------------------------------------------------
# Ganti teks di RTF mentah
# ---------------------------------------------------------------------------------------------------------------------
def variasi(lama, baru):
    """Pasangan (lama, baru) dalam huruf kecil, Kapital-Tiap-Kata, Kapital-Awal, dan HURUF BESAR."""
    def tit(s):
        return ' '.join(w[:1].upper() + w[1:] for w in s.split(' '))
    def awal(s):
        return s[:1].upper() + s[1:]
    daftar = [(lama, baru), (tit(lama), tit(baru)), (awal(lama), awal(baru)), (lama.upper(), baru.upper())]
    hasil, lihat = [], set()
    for a, b in daftar:
        if a not in lihat:
            lihat.add(a)
            hasil.append((a, b))
    return hasil


def ganti(raw, pasangan, wajib=False, nama=''):
    """Ganti berurutan tiap (lama, baru) pada RTF mentah. wajib=True: setiap lama harus ada (kecuali ditandai opsional dengan None sebagai tiga-serangkai)."""
    for p in pasangan:
        lama, baru = p[0], p[1]
        opsional = len(p) > 2 and p[2] == 'opsional'
        n = raw.count(lama)
        if n == 0 and wajib and not opsional:
            raise SystemExit('ganti: "%s" tidak ada di %s' % (lama, nama))
        raw = raw.replace(lama, esc(baru))
    return raw


def rtf_ke_teks(raw):
    import rtf_peta as R
    return R.peta(raw)[0]


def klon(rel_sumber, folder_tujuan, berkas_tujuan, pasangan=(), nama_sumber=None, periksa_wajib=False):
    """Salin berkas Derry asli ke folder keluaran dengan nama baru dan pengganti teks (lihat ganti)."""
    raw = baca_raw(rel_sumber)
    raw = ganti(raw, list(pasangan), wajib=periksa_wajib, nama=rel_sumber)
    pecah = periksa_token(raw)
    if pecah:
        raise SystemExit('token terpecah setelah mengganti di %s: %r' % (berkas_tujuan, pecah))
    return tulis_raw(folder_tujuan, berkas_tujuan, raw)


# ---------------------------------------------------------------------------------------------------------------------
# PERMOHONAN (Pdt.P): empat putusan umum (cabut, gugur, coret, NO SEMA 1/2022) dari Wali Adhal
# ---------------------------------------------------------------------------------------------------------------------
UMUM_PERMOHONAN = [
    ('7 Wali Adhal/[98] [Cabut] Wali Adhal.rtf', '[98] [Cabut] %(S)s.rtf'),
    ('7 Wali Adhal/[98a] [Gugur] Wali Adhal - Pemohon Tidak Pernah Hadir.rtf', '[98a] [Gugur] %(S)s - Pemohon Tidak Pernah Hadir.rtf'),
    ('7 Wali Adhal/[98c] [Coret] Wali Adhal - Dibatalkan dari Pendaftaran - Panjar Habis.rtf', '[98c] [Coret] %(S)s - Dibatalkan dari Pendaftaran - Panjar Habis.rtf'),
    ('7 Wali Adhal/[99] [NO] Wali Adhal - Pemohon Tidak Hadir Lagi (SEMA 1 2022).rtf', '[99] [NO] %(S)s - Pemohon Tidak Hadir Lagi (SEMA 1 2022).rtf'),
]


def buat_umum_permohonan(j):
    """Cabut/Gugur/Coret/NO-SEMA-1-2022 jenis permohonan: isi umum (memakai #0048# jenis perkara), nama berkas mengikuti jenis."""
    hasil = []
    for sumber, tujuan in UMUM_PERMOHONAN:
        hasil.append(klon(sumber, j['folder'], tujuan % {'S': j['singkat']}))
    return hasil


# ---------------------------------------------------------------------------------------------------------------------
# BAS permohonan: 12 BAS dari "6 Perwalian - BAS" (ALUR 16)
# ---------------------------------------------------------------------------------------------------------------------
BAS_PERMOHONAN = [
    '[1] Sidang 1 - Pemeriksaan, Bukti Surat dan 2 Saksi, Penetapan Dibacakan (1x Sidang)',
    '[1a] Sidang 1 - Pemeriksaan, Bukti Surat dan 2 Saksi, Tunda Pembacaan Penetapan',
    '[1b] Sidang 1 - Pembacaan Permohonan dan Bukti Surat, Tunda Pemeriksaan Saksi',
    '[1c] Sidang 1 - Petunjuk Perbaikan Permohonan, Tunda Perbaikan',
    '[2] Sidang Lanjutan - Pemeriksaan 2 Saksi, Tunda Pembacaan Penetapan',
    '[2a] Sidang Lanjutan - Perbaikan Permohonan, Bukti Surat dan 2 Saksi, Tunda Pembacaan Penetapan',
    '[2b] Sidang Lanjutan - Pemeriksaan 2 Saksi, Penetapan Dibacakan',
    '[3] Sidang Terakhir - Pembacaan Penetapan',
    '[C] Pemohon Hadir Mencabut Permohonan',
    '[G] Pemohon Tidak Pernah Hadir - Permohonan Gugur',
    '[N] Pemohon Tidak Hadir Lagi - Tidak Dapat Diterima (SEMA 1 2022)',
    '[T] Pemohon Tidak Hadir - Tunda Panggil Pemohon',
]


def buat_bas_permohonan(j, nasihat=None, bukti_var=None):
    """12 BAS permohonan jenis `j`.

    nasihat: kalimat pengganti PARAGRAF nasihat jenis-spesifik di [1], [1a], [1b], [2a] ("... menjelaskan kepada Pemohon tentang hal-hal yang berkaitan dengan perwalian anak ...");
             berbentuk teks polos dengan penanda #nnnn#; None = sisakan kalimat umum (tanpa kata perwalian).
    bukti_var: nomor variabel (str '3601') alat bukti surat jenis ini menggantikan #8131# (Alat Bukti Perwalian Anak).
    """
    hasil = []
    for langkah in BAS_PERMOHONAN:
        sumber = '6 Perwalian - BAS/BAS ALUR 16 Perwalian - %s.rtf' % langkah
        tujuan = '%s - %s.rtf' % (j['awalan_bas'], langkah)
        raw = baca_raw(sumber)
        if bukti_var:
            raw = raw.replace('#8131#', '#%s#' % bukti_var)
        # Kalimat nasihat perwalian (paragraf tunggal; teks contiguous di RTF)
        lama = ('tentang hal-hal yang berkaitan dengan perwalian anak, antara lain kewajiban wali untuk memelihara dan mengurus anak yang berada di bawah perwaliannya '
                'beserta harta bendanya dengan sebaik-baiknya, dan atas penjelasan tersebut')
        if lama in raw:
            baru = nasihat or 'tentang hal-hal yang berkaitan dengan %s yang dimohonkan, dan atas penjelasan tersebut' % j['kata']
            raw = raw.replace(lama, esc(baru))
        elif 'perwalian' in rtf_ke_teks(raw).lower() and langkah.split(']')[0] in ('[1', '[1a', '[1b', '[2a'):
            # teks nasihat terpecah oleh format RTF: diganti lewat Dok pada paragraf yang memuat kata "perwalian"
            d = Dok.__new__(Dok)
            d.raw = raw
            d.kepala, d.par, d.ekor = __import__('paragraf').pecah(raw)
            potongan = []
            for i, p in enumerate(d.par):
                t = d.isi(i)
                if 'perwalian anak' in t:
                    t = re.sub(r'tentang hal-hal yang berkaitan dengan perwalian anak.*?dan atas penjelasan tersebut',
                               'tentang hal-hal yang berkaitan dengan %s yang dimohonkan, dan atas penjelasan tersebut' % j['kata'], t, flags=re.S)
                    potongan.append(d.ganti_teks(i, nasihat or t))
                else:
                    potongan.append(p)
            raw = d.rakit(potongan)
        hasil.append(simpan_bas(j, tujuan, raw))
    return hasil


# ---------------------------------------------------------------------------------------------------------------------
# Paragraf: dok dari RTF mentah, ganti paragraf menurut ciri teks
# ---------------------------------------------------------------------------------------------------------------------
def dok_dari_raw(raw):
    import paragraf
    d = Dok.__new__(Dok)
    d.raw = raw
    d.kepala, d.par, d.ekor = paragraf.pecah(raw)
    return d


def ganti_paragraf(raw, cocok, teks_baru, semua=False, wajib=True, label=None):
    """Ganti paragraf yang teks tampaknya (tanpa label daftar) cocok regex `cocok` dengan `teks_baru` (gaya paragraf dipertahankan).
    teks_baru boleh fungsi (teks_lama) -> teks. Mengembalikan RTF mentah baru."""
    d = dok_dari_raw(raw)
    rx = re.compile(cocok, re.S)
    potongan, n = [], 0
    for i, p in enumerate(d.par):
        t = d.isi(i)
        if rx.search(t) and (semua or n == 0):
            baru = teks_baru(t) if callable(teks_baru) else teks_baru
            potongan.append(d.ganti_teks(i, baru, label))
            n += 1
        else:
            potongan.append(p)
    if n == 0 and wajib:
        raise SystemExit('ganti_paragraf: tidak ada paragraf cocok /%s/' % cocok)
    return d.rakit(potongan)


def hapus_paragraf(raw, cocok, semua=True):
    d = dok_dari_raw(raw)
    rx = re.compile(cocok, re.S)
    return d.rakit([p for i, p in enumerate(d.par) if not (rx.search(d.isi(i)) and (semua or True))])


def daftar_paragraf(raw):
    d = dok_dari_raw(raw)
    return [(i, d.isi(i)) for i in range(len(d.par))]


# ---------------------------------------------------------------------------------------------------------------------
# GUGATAN (Pdt.G): salinan ALUR 04-09 + BAS khusus dari "6c Nafkah Anak - BAS" (ALUR 46)
# ---------------------------------------------------------------------------------------------------------------------
def _daftar_asli(folder):
    return sorted(os.listdir(lp(os.path.join(ASLI, folder))))


def buat_salinan_gugatan(j, bukti_var, bukti_tergugat_var=None):
    """29 salinan BAS ALUR 04-09 (nama sama dengan folder lain) di folder BAS jenis gugatan. 'nafkah anak' pada kepala BAS diganti kata jenis;
    #9955# (bukti surat P) diganti `bukti_var`; #9911# (bukti surat T) diganti `bukti_tergugat_var` bila diberikan."""
    hasil = []
    for f in _daftar_asli('6c Nafkah Anak - BAS'):
        if not re.match(r'BAS ALUR 0[4-9] ', f):
            continue
        raw = baca_raw('6c Nafkah Anak - BAS/' + f)
        raw = ganti(raw, variasi('nafkah anak', j['kata']))
        raw = raw.replace('#9955#', '#%s#' % bukti_var)
        if bukti_tergugat_var:
            raw = raw.replace('#9911#', '#%s#' % bukti_tergugat_var)
        hasil.append(simpan_bas(j, f, raw))
    return hasil


KHUSUS_GUGATAN = [
    # kode, sumber (ALUR 46), akhiran nama tujuan
    ('V1', 'Sidang 1 - P Hadir & T Tidak Hadir - Tunda Panggil T'),
    ('V2', 'Sidang 2 - T Tetap Tidak Hadir - Pembuktian dan Putusan Verstek'),
    ('V2S', 'Sidang 2 - T Tetap Tidak Hadir - Pembuktian dan Putusan Verstek Kabul Sebagian'),
    ('AP', 'Sidang 2 - Mediasi Berhasil - Akta Perdamaian'),
    ('GD', 'Sidang 2 - Mediasi Berhasil - Gugatan Dicabut'),
    ('CS', 'Cabut sesudah Jawaban - Tergugat Setuju'),
    ('CM', 'Cabut sesudah Jawaban - Tergugat Menolak'),
    ('N', 'Sidang Lanjutan - P 2x Tidak Hadir - Putusan NO (SEMA 1 2022)'),
    ('T', 'Sidang Lanjutan - P Tidak Hadir - Tunda Panggil P'),
]


def buat_bas_khusus_gugatan(j, amar_verstek, amar_sebagian, nasihat=None):
    """9 BAS khusus jenis gugatan (ALUR `alur`): V1, V2, V2S, AP, GD, CS, CM, N, T.

    amar_verstek / amar_sebagian: teks paragraf amar butir "Menghukum ..." / "Menyatakan ... " pada V2 dan V2S (teks polos + #nnnn#),
    pengganti paragraf "Menghukum #0047# untuk melaksanakan kewajibannya ..." milik nafkah anak. nasihat: kalimat nasihat kekeluargaan (default umum)."""
    hasil = []
    for kode, akhir in KHUSUS_GUGATAN:
        raw = baca_raw('6c Nafkah Anak - BAS/BAS ALUR 46 Nafkah Anak - %s.rtf' % akhir)
        raw = ganti(raw, variasi('nafkah anak', j['kata']))
        if kode in ('V2', 'V2S'):
            raw = ganti_paragraf(raw, r'^(?:\d+\.\s*)?Menghukum #0047# untuk melaksanakan kewajibannya', amar_verstek if kode == 'V2' else amar_sebagian)
        hasil.append(simpan_bas(j, '%s - %s.rtf' % (j['awalan_bas'], akhir), raw))
    return hasil


# ---------------------------------------------------------------------------------------------------------------------
# GUGATAN: putusan umum (perdamaian, cabut, gugur, coret, NO SEMA 1/2022) dari "6c Nafkah Anak"
# ---------------------------------------------------------------------------------------------------------------------
UMUM_GUGATAN = [
    ('[97] [Perdamaian] Nafkah Anak - Akta Perdamaian.rtf', '[97] [Perdamaian] %(S)s - Akta Perdamaian.rtf'),
    ('[98] [Cabut] Nafkah Anak - P & T Hadir Sebelum Jawaban.rtf', '[98] [Cabut] %(S)s - P & T Hadir Sebelum Jawaban.rtf'),
    ('[98b] [Cabut] Nafkah Anak - Sesudah Jawaban dengan Persetujuan T.rtf', '[98b] [Cabut] %(S)s - Sesudah Jawaban dengan Persetujuan T.rtf'),
    ('[98a] [Gugur] Nafkah Anak - P Tidak Hadir Sidang Pertama.rtf', '[98a] [Gugur] %(S)s - P Tidak Hadir Sidang Pertama.rtf'),
    ('[98c] [Coret] Nafkah Anak - Dibatalkan dari Pendaftaran - Panjar Habis.rtf', '[98c] [Coret] %(S)s - Dibatalkan dari Pendaftaran - Panjar Habis.rtf'),
    ('[99] [NO] Nafkah Anak - P Hadir Lalu 2x Tidak Hadir (SEMA 1 2022).rtf', '[99] [NO] %(S)s - P Hadir Lalu 2x Tidak Hadir (SEMA 1 2022).rtf'),
]


def buat_umum_gugatan(j):
    """[97] perdamaian, [98]/[98b] cabut, [98a] gugur, [98c] coret, [99] NO SEMA 1/2022 untuk gugatan: isi umum; 'nafkah anak' diganti kata jenis.
    [97] mungkin memuat uraian khusus nafkah (diperiksa uji paket: tak boleh tersisa kata nafkah)."""
    hasil = []
    for sumber, tujuan in UMUM_GUGATAN:
        hasil.append(klon('6c Nafkah Anak/' + sumber, j['folder'], tujuan % {'S': j['singkat']}, pasangan=variasi('nafkah anak', j['kata'])))
    return hasil


# ---------------------------------------------------------------------------------------------------------------------
# METADATA BLANGKO PUTUSAN (dipakai untuk pemetaan jenis -> blangko di portal/ekstensi dan uji paket)
# ---------------------------------------------------------------------------------------------------------------------
STATUS_DARI_LABEL = {
    'Kabul': 'Dikabulkan', 'Kabul Verstek': 'Dikabulkan', 'Kabul Sebagian': 'Dikabulkan Sebagian', 'Kabul Sebagian Verstek': 'Dikabulkan Sebagian',
    'Tolak': 'Ditolak', 'Tolak Verstek': 'Ditolak', 'NO': 'Tidak Dapat Diterima', 'Cabut': 'Dicabut', 'Gugur': 'Digugurkan',
    'Coret': 'Dicoret dari Register', 'Perdamaian': 'Perdamaian',
}


def meta(j, berkas, keadaan='', catatan=''):
    """Satu blangko PUTUSAN/PENETAPAN jenis j: nama berkas persis "[kode] [Label] ...rtf"; status diambil dari Label; keadaan = kode keadaan
    ('' = bawaan/kontradiktoir; 'verstek', 't-tidak-hadir-setelah-mediasi', 'sesudah-jawaban', 'sema-1-2022', 'kurang-pihak', 'cacat-formil', atau kode khusus jenis)."""
    m = re.match(r'^\[(\w+)\]\s+\[([^\]]+)\]\s+', berkas)
    if not m:
        raise SystemExit('nama berkas putusan tidak berpola "[kode] [Label] ...": %s' % berkas)
    label = m.group(2)
    if label not in STATUS_DARI_LABEL:
        raise SystemExit('label "%s" tak dikenal (%s)' % (label, berkas))
    return dict(jenis=j['kunci'], folder=j['folder'], berkas=berkas if berkas.endswith('.rtf') else berkas + '.rtf', kode=m.group(1), label=label,
                status=STATUS_DARI_LABEL[label], keadaan=keadaan, catatan=catatan)


def meta_umum_permohonan(j):
    S = j['singkat']
    return [
        meta(j, '[98] [Cabut] %s.rtf' % S),
        meta(j, '[98a] [Gugur] %s - Pemohon Tidak Pernah Hadir.rtf' % S),
        meta(j, '[98c] [Coret] %s - Dibatalkan dari Pendaftaran - Panjar Habis.rtf' % S),
        meta(j, '[99] [NO] %s - Pemohon Tidak Hadir Lagi (SEMA 1 2022).rtf' % S, 'sema-1-2022'),
    ]


def meta_umum_gugatan(j):
    S = j['singkat']
    return [
        meta(j, '[97] [Perdamaian] %s - Akta Perdamaian.rtf' % S),
        meta(j, '[98] [Cabut] %s - P & T Hadir Sebelum Jawaban.rtf' % S),
        meta(j, '[98b] [Cabut] %s - Sesudah Jawaban dengan Persetujuan T.rtf' % S, 'sesudah-jawaban'),
        meta(j, '[98a] [Gugur] %s - P Tidak Hadir Sidang Pertama.rtf' % S),
        meta(j, '[98c] [Coret] %s - Dibatalkan dari Pendaftaran - Panjar Habis.rtf' % S),
        meta(j, '[99] [NO] %s - P Hadir Lalu 2x Tidak Hadir (SEMA 1 2022).rtf' % S, 'sema-1-2022'),
    ]
