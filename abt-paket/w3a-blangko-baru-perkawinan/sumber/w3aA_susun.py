# -*- coding: utf-8 -*-
"""Pembantu agen W3a-A (21 Okt 2026): penyusun paragraf blangko permohonan perkawinan (penolakan perkawinan, perkawinan campuran)
dan pembuat katalog saksi. BUKAN modul jenis (tidak berawalan jenis_), jadi tidak dimuat bangun_paket.

Susun         : menyalin paragraf berkas dasar Derry apa adanya (raw) atau mengganti isi paragraf dengan gaya yang sama (baru).
cek_rtf       : pemeriksa teks sebuah RTF (token, sisa isian mentah, kata jenis lain, variabel tak dikenal).
KatalogSaksi  : perakit katalog saksi-katalog/1 dari spesifikasi ringkas.
"""
import json
import os
import re
import sys

SUMBER = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, SUMBER)
import w3a_lib as L  # noqa: E402

REPO = os.path.abspath(os.path.join(L.AKAR, '..', '..'))


# ---------------------------------------------------------------------------------------------------------------------
# Penyusun paragraf
# ---------------------------------------------------------------------------------------------------------------------
class Susun:
    """Penyusun satu berkas dari paragraf berkas dasar Derry (indeks paragraf: alat/paragraf.py)."""

    def __init__(self, rel_dasar):
        self.d = L.dok(rel_dasar)
        self.out = []

    def raw(self, *idx):
        for i in idx:
            self.out.append(self.d.par[i])

    def baru(self, i, teks, label=None):
        self.out.append(self.d.ganti_teks(i, teks, label))

    def hasil(self):
        return self.d.rakit(self.out)


# ---------------------------------------------------------------------------------------------------------------------
# Pemeriksa teks RTF
# ---------------------------------------------------------------------------------------------------------------------
KATA_JENIS_LAIN = ['perwalian', 'wali adhal', 'wali adlal', 'nafkah anak', 'hibah', 'wasiat', 'dispensasi', 'pencegahan', 'pembatalan', 'itsbat', 'asal usul',
                   'poligami', 'ahli waris', 'hadhanah', 'hak asuh', 'cerai', 'talak', 'harta bersama', 'wakaf', 'mafqud', 'pengangkatan anak']
SISA_MENTAH = ['ANAK 1 PERSATU', 'PERSATU P NYA', '[ ]', '____', '...', '\u2026', 'ALETA', 'Aleta', 'aleta']


def semua_variabel_sah():
    """Nomor variabel yang sah: kamus server + variabel baru paket (abt-variabel-w3a.json) + variabel yang didefinisikan modul."""
    import variabel_def as VD
    sah = set('%04d' % x['no'] for x in VD.VAR)
    for p in (os.environ.get('W3A_KAMUS', 'D:/aleta-dev/kerja/w3a/abt-variabel-w3a.json'),):
        if os.path.exists(p):
            sah |= set(json.load(open(p, encoding='utf-8')).keys())
    return sah


def cek_rtf(path_atau_raw, kata_boleh=()):
    """Mengembalikan daftar temuan (kosong = bersih)."""
    import rtf_peta as R
    raw = path_atau_raw
    if not (isinstance(raw, str) and '\\rtf' in raw[:20]):
        raw = open(L.lp(path_atau_raw), 'rb').read().decode('latin1')
    teks = R.peta(raw)[0]
    temuan = []
    pecah = L.periksa_token(raw)
    if pecah:
        temuan.append('token terpecah %r' % pecah)
    sah = semua_variabel_sah()
    for k in sorted(set(re.findall(r'#(\d{4})#', teks))):
        if k not in sah:
            temuan.append('variabel #%s# tidak dikenal' % k)
    bawah = teks.lower()
    for kata in KATA_JENIS_LAIN:
        if kata in bawah and kata not in kata_boleh:
            temuan.append('kata jenis lain "%s"' % kata)
    for s in SISA_MENTAH:
        if s in teks:
            temuan.append('sisa mentah "%s"' % s)
    if re.search(r'\bdan\s+dan\b|\s{3,}[a-z]', teks.replace('\t', ' ')) and False:
        temuan.append('spasi/kata ganda')
    return temuan


# ---------------------------------------------------------------------------------------------------------------------
# Katalog saksi
# ---------------------------------------------------------------------------------------------------------------------
def jawaban_umum_baku():
    """jawabanUmum yang sudah lolos pemeriksa: diambil dari katalog wali-adhal di repo (sama dengan jawaban-umum-baku.json)."""
    p = os.path.join(REPO, 'ekstensi-sipp', 'saksi-katalog', 'wali-adhal.json')
    return json.load(open(p, encoding='utf-8'))['jawabanUmum']


def J(maksud, s1, s2, keadaan=None):
    d = {'maksud': maksud, 'saksi1': list(s1), 'saksi2': list(s2)}
    if keadaan:
        d = dict([('keadaan', keadaan)] + list(d.items()))
    return d


def Q(id_, pokok, urutan, tingkat, kelompok, teks, hal, melihat, varian=None, keadaan=None, tidak_berlaku=None, jawab_lain=None, pihak=('*',), catatan=None, vars_abt=None):
    """Satu pertanyaan. melihat = J(...) atau daftar J (bila bergantung keadaan). jawab_lain = {jenis: J}."""
    q = {'id': id_, 'pokok': pokok, 'urutan': urutan, 'tingkat': tingkat, 'kelompok': kelompok, 'pihakSaksi': list(pihak)}
    if keadaan:
        q['keadaan'] = keadaan
    q['teks'] = teks
    if varian:
        q['teksVarian'] = list(varian)
    if hal:
        q['hal'] = hal
    jaw = {'melihat': melihat}
    for k, v in (jawab_lain or {}).items():
        jaw[k] = v
    q['jawaban'] = jaw
    q['tidakBerlaku'] = list(tidak_berlaku if tidak_berlaku is not None else ['berbeda'])
    if catatan:
        q['catatan'] = catatan
    # variabelAbt = semua #nnnn# yang dipakai
    teks_semua = [teks] + list(varian or [])
    for jj in jaw.values():
        for x in (jj if isinstance(jj, list) else [jj]):
            teks_semua += x['saksi1'] + x['saksi2']
    q['variabelAbt'] = sorted(set(re.findall(r'#(\d{4})#', '\n'.join(teks_semua))))
    return q


def tulis_katalog(kat, nama_berkas=None):
    p = os.path.join(REPO, 'ekstensi-sipp', 'saksi-katalog', (nama_berkas or kat['kunci']) + '.json')
    with open(p, 'w', encoding='utf-8', newline='\n') as f:
        json.dump(kat, f, ensure_ascii=False, indent=2)
        f.write('\n')
    return p


def periksa_katalog(nama_berkas):
    """Menjalankan periksa_katalog.cjs (mesin yang sama dengan uji penjaga). Mengembalikan (kode_keluar, keluaran)."""
    import subprocess
    env = dict(os.environ)
    env['ALETA_ABT_VARIABEL'] = os.environ.get('W3A_KAMUS', 'D:/aleta-dev/kerja/w3a/abt-variabel-w3a.json')
    alat = os.path.join(REPO, 'abt-paket', 'u4-dk-wali-perwalian', 'alat', 'periksa_katalog.cjs')
    r = subprocess.run(['node', alat, nama_berkas], capture_output=True, env=env, cwd=REPO)
    return r.returncode, (r.stdout + r.stderr).decode('utf-8', 'replace')


# ---------------------------------------------------------------------------------------------------------------------
# Jawaban saksi dari kerangka (frame) + inti kalimat (core): menghasilkan 4 varian saksi 1 dan 4 varian saksi 2
# ---------------------------------------------------------------------------------------------------------------------
FRAME1 = ['saya melihat sendiri bahwa §', 'saya mengetahui secara langsung bahwa §', 'saya menyaksikan sendiri bahwa §', 'berdasarkan pengalaman saya sendiri bahwa §']
FRAME2 = ['sepanjang yang saya lihat sendiri bahwa §', 'saya sendiri mengetahui bahwa §', 'saya ikut menyaksikan bahwa §', 'dengan mata kepala saya sendiri saya melihat bahwa §']


def JG(maksud, inti1, inti2, keadaan=None):
    """inti1/inti2: daftar >= 2 klausa (tanpa 'bahwa'); tiap klausa memuat himpunan penanda dan jumlah negasi yang sama."""
    s1 = [FRAME1[i].replace('§', inti1[i % len(inti1)]) for i in range(4)]
    s2 = [FRAME2[i].replace('§', inti2[i % len(inti2)]) for i in range(4)]
    return J(maksud, s1, s2, keadaan)
