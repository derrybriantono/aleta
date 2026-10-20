# -*- coding: utf-8 -*-
"""Uji kecil jenis 356 (penunjukan orang lain sebagai wali oleh pengadilan).
Jalankan dari mana saja: python uji_356.py [--tanpa-sql]
  (a) membangun berkas (bangun_semua 356): 3 penetapan + 10 BAS
  (b) semua penanda #nnnn# di RTF ada di server (w3b-var-server.pkl) atau milik jenis ini (3860-3883)
  (c) SQL variabel turunan jalan atas perkara nyata SIPP (BACA SAJA lewat ssh aleta) dengan isian simulasi, hasil dibandingkan dengan harapan
  (d) tidak ada sisa kata jenis lain (hibah, nafkah, mafqud, hadhanah, penguasaan anak, kata Aleta)
  (e) katalog saksi penunjukan-wali.json lolos pemeriksa (galat 0)
"""
import os
import pickle
import re
import subprocess
import sys

SINI = os.path.dirname(os.path.abspath(__file__))
AKAR = os.path.dirname(SINI)
sys.path.insert(0, os.path.join(AKAR, 'sumber'))
sys.path.insert(0, os.path.join(AKAR, 'alat'))
sys.stdout.reconfigure(encoding='utf-8')

import bangun_semua  # noqa: E402
import variabel_def as V  # noqa: E402
from pustaka import Berkas, KELUAR  # noqa: E402
from uji_sql import jalankan  # noqa: E402

GAGAL = []
PERKARA = os.environ.get('UJI_PERKARA', '10096')   # perkara 354 nyata (anak ada di perkara_anak_pihak bila diisi petugas)


def cek(nama, ok, info=''):
    print(('LOLOS  ' if ok else 'GAGAL  ') + nama + (' - ' + str(info) if info and not ok else ''))
    if not ok:
        GAGAL.append(nama)


# (a) bangun -----------------------------------------------------------------------------------------------------------
S = bangun_semua.bangun('356')
folder_p = os.path.join(KELUAR, S['folder'])
folder_b = folder_p + ' - BAS'
putusan = sorted(f for f in os.listdir(folder_p) if f.endswith('.rtf'))
bas = sorted(f for f in os.listdir(folder_b) if f.endswith('.rtf'))
cek('(a) 3 penetapan [01p] [03p] [99p]', len(putusan) == 3 and [f[:5] for f in putusan] == ['[01p]', '[03p]', '[99p]'], putusan)
cek('(a) 10 BAS permohonan', len(bas) == 10, len(bas))

# (b) penanda ----------------------------------------------------------------------------------------------------------
server = pickle.load(open('D:/aleta-dev/kerja/w3b-var-server.pkl', 'rb'))
milik = {'%04d' % x['no'] for x in V.VAR if 3860 <= x['no'] <= 3889}
tanda_semua = {}
teks_semua = {}
for folder, daftar in ((folder_p, putusan), (folder_b, bas)):
    for f in daftar:
        b = Berkas(os.path.join(folder, f))
        isi = '\n'.join(b.t)
        teks_semua[f] = isi
        for n in set(re.findall(r'#(\d{4})#', isi)):
            tanda_semua.setdefault(n, []).append(f)
asing = {n: fs[:2] for n, fs in tanda_semua.items() if n not in server and n not in milik}
cek('(b) semua penanda dikenal (server atau 3860-3889)', not asing, asing)
# penanda milik jenis ini yang dipakai tetapi belum didefinisikan
cek('(b) penanda 38xx yang dipakai terdefinisi', all(n in milik for n in tanda_semua if 3860 <= int(n) <= 3999), [n for n in tanda_semua if 3860 <= int(n) <= 3999 and n not in milik])
# kueri turunan menyebut penanda: yang bukan milik harus ada di server
for x in V.VAR:
    if 3860 <= x['no'] <= 3889 and x['sql']:
        for n in set(re.findall(r'#(\d{4})#', x['sql'])):
            if n != '' and n not in server and n not in milik:
                cek('(b) penanda %s dalam kueri %d' % (n, x['no']), False)
# tiap isian data_teks milik jenis ini dipakai (RTF atau kueri turunan)
semua_kueri = ' '.join((x['sql'] or '') for x in V.VAR)
for x in V.VAR:
    if 3860 <= x['no'] <= 3889 and x['tipe'] == 'data_teks':
        n = '%04d' % x['no']
        dipakai = n in tanda_semua or ('no_var = %d' % x['no']) in semua_kueri
        cek('(b) isian %s dipakai' % n, dipakai)

# (d) sisa kata jenis lain ---------------------------------------------------------------------------------------------
POLA = re.compile(r'hibah|nafkah|mafqud|hadhanah|hadhonah|penguasaan anak|hak asuh|wakaf|wasiat|aleta', re.I)
sisa = {}
for f, isi in teks_semua.items():
    m = POLA.findall(isi)
    if m:
        sisa[f] = sorted(set(m))
cek('(d) tanpa sisa kata jenis lain / Aleta', not sisa, sisa)
cek('(d) nama berkas memuat nama jenis', all('Penunjukan Wali' in f for f in putusan + bas), None)

# (c) SQL -------------------------------------------------------------------------------------------------------------
if '--tanpa-sql' not in sys.argv:
    def literal(teks):
        return "'" + teks.replace('\\', '/').replace('"', '&quot;').replace("'", '&#39;') + "'"

    def sim(sql, isian):
        s = sql
        for n in range(3860, 3872):
            s = s.replace(V.isi(n), literal(isian.get(n, '')))
        return s

    KASUS = {
        'A-meninggal': {3860: 'A', 3861: 'nenek kandung dari pihak ibu', 3862: 'A', 3863: 'almarhum Fulan bin Fulan (ayah kandung) dan almarhumah Fulanah binti Fulan (ibu kandung)',
                        3864: 'sejak orang tuanya meninggal dunia, anak tersebut tinggal serumah dan diasuh oleh Pemohon dengan baik', 3865: 'telah berumur 52 tahun, sehat jasmani dan rohani',
                        3866: 'telah ada persetujuan tertulis dari suami Pemohon', 3867: 'Surat Rekomendasi Dinas Sosial Nomor 12 tanggal 3 Maret 2026', 3868: 'pencairan santunan kematian atas nama anak'},
        'B-dicabut': {3860: 'B', 3861: 'paman', 3862: 'A, D', 3863: 'Penetapan Nomor 3/Pdt.P/2026/PA.Dgl'},
        'D-badan': {3860: 'D', 3862: 'B'},
        'C-multi': {3860: 'C', 3862: 'B, C, E'},
        'kosong': {},
        'kata-utuh': {3860: 'Saudara', 3862: 'Meninggal'},   # kata utuh bukan huruf: tidak boleh cocok sembarang
    }
    HARAP = {
        'A-meninggal': {3872: 'Keluarga Anak', 3873: 'Pasal 4 ayat (1) Peraturan Pemerintah Nomor 29 Tahun 2019', 3875: 'nenek kandung dari pihak ibu',
                        3881: 'telah berumur 52 tahun, sehat jasmani dan rohani', 3882: 'telah ada persetujuan tertulis dari suami Pemohon',
                        3876: 'kedua orang tua #4407# tersebut telah meninggal dunia, yaitu almarhum Fulan bin Fulan (ayah kandung) dan almarhumah Fulanah binti Fulan (ibu kandung)',
                        3883: 'sejak orang tuanya meninggal dunia, anak tersebut tinggal serumah dan diasuh oleh Pemohon dengan baik'},
        'B-dicabut': {3872: 'Saudara', 3873: 'Pasal 5 ayat (1) Peraturan Pemerintah Nomor 29 Tahun 2019', 3875: 'paman', 3881: '........', 3882: '........', 3878: '', 3879: '', 3880: '',
                      3876: 'kedua orang tua #4407# tersebut telah meninggal dunia dan kekuasaan wali sebelumnya atas #4407# tersebut telah dicabut, yaitu Penetapan Nomor 3/Pdt.P/2026/PA.Dgl'},
        'D-badan': {3872: 'badan hukum', 3873: 'Pasal 7 ayat (2) dan ayat (3) Peraturan Pemerintah Nomor 29 Tahun 2019', 3875: '........', 3876: 'keberadaan orang tua #4407# tersebut tidak diketahui'},
        'C-multi': {3872: 'orang lain', 3873: 'Pasal 6 ayat (1) Peraturan Pemerintah Nomor 29 Tahun 2019'},
        'kosong': {3872: '........', 3873: '........', 3875: '........', 3876: '........', 3881: '........', 3882: '........', 3883: '........', 3878: '', 3879: '', 3880: ''},
        'kata-utuh': {3872: '........', 3873: '........', 3876: '........'},
    }
    NOMOR = [x['no'] for x in V.VAR if 3872 <= x['no'] <= 3889 and x['sql']]
    ISI_TEKS_KASUS = {}
    for nama, isian in KASUS.items():
        bagian = []
        for n in NOMOR:
            x = [y for y in V.VAR if y['no'] == n][0]
            q = sim(x['sql'], isian).replace('#perkara_id#', PERKARA)
            q = q.rstrip().rstrip(';')
            bagian.append("SELECT '%d' AS k, (SELECT z.data FROM (%s) z) AS v" % (n, q))
        sql = ' UNION ALL '.join(bagian)
        out = jalankan(sql, PERKARA)
        baris = out.split('\n')
        hasil = {}
        galat = None
        for b in baris[1:] if baris and baris[0].startswith('k') else baris:
            if '\t' in b and re.match(r'^\d{4}\t', b):
                k, _, val = b.partition('\t')
                hasil[int(k)] = val
            elif b.strip() and not re.match(r'^\d{4}\t', b) and hasil:
                # lanjutan baris? teks tidak memuat ganti baris sungguhan (hanya <br>), jadi ini galat
                galat = galat or b
        if len(hasil) != len(NOMOR):
            cek('(c) %s: SQL turunan jalan (%d/%d hasil)' % (nama, len(hasil), len(NOMOR)), False, out[:600])
            continue
        cek('(c) %s: %d kueri turunan jalan' % (nama, len(NOMOR)), True)
        ISI_TEKS_KASUS[nama] = hasil
        for n, harap in HARAP.get(nama, {}).items():
            nyata = hasil.get(n, '')
            nyata = '' if nyata == 'NULL' else nyata
            harap = re.sub(r'#\d{4}#', '', harap)   # jalankan() menghapus penanda #nnnn# yang tidak diberi nilai
            cek('(c) %s: %d sesuai harapan' % (nama, n), nyata == harap, 'nyata=%r harap=%r' % (nyata, harap))
    # sifat khusus
    if 'A-meninggal' in ISI_TEKS_KASUS:
        h = ISI_TEKS_KASUS['A-meninggal']
        cek('(c) A-meninggal: pertimbangan sebab memuat Pasal 26 ayat (2) dan penjelasan angka 17', 'Pasal 26 ayat (2)' in h[3877] and 'angka 17' in h[3877], h[3877][:200])
        cek('(c) A-meninggal: rekomendasi dinas sosial tercetak diawali <br>', h[3878].startswith('<br>Menimbang') and 'Surat Rekomendasi Dinas Sosial Nomor 12' in h[3878], h[3878][:120])
        cek('(c) A-meninggal: amar harta diawali <br>', h[3880].startswith('<br>    - memberi wewenang') and 'pencairan santunan' in h[3880], h[3880])
        cek('(c) A-meninggal: pertimbangan syarat Keluarga Anak (30 tahun, derajat terdekat)', '30 (tiga puluh) tahun' in h[3874] and 'derajat terdekat' in h[3874], h[3874][:100])
    if 'B-dicabut' in ISI_TEKS_KASUS:
        h = ISI_TEKS_KASUS['B-dicabut']
        cek('(c) B-dicabut: dua paragraf sebab dipisah <br> (A dan D)', h[3877].count('<br>') == 1 and 'Pasal 53 ayat (2)' in h[3877], h[3877][:80])
        cek('(c) B-dicabut: syarat Saudara (21 tahun, persetujuan Anak)', '21 (dua puluh satu) tahun' in h[3874] and 'persetujuan dari Anak' in h[3874])
    if 'C-multi' in ISI_TEKS_KASUS:
        h = ISI_TEKS_KASUS['C-multi']
        cek('(c) C-multi: sebab B, C, E digabung', h[3877].count('<br>') == 2 and 'Pasal 107 ayat (3)' in h[3877])
    if 'D-badan' in ISI_TEKS_KASUS:
        cek('(c) D-badan: syarat badan hukum (Pasal 7)', 'lembaga kesejahteraan sosial Anak' in ISI_TEKS_KASUS['D-badan'][3874])
    # tidak ada tanda kutip / garis miring terbalik di keluaran (aman bagi penggantian penanda)
    for nama, h in ISI_TEKS_KASUS.items():
        buruk = [n for n, val in h.items() if '"' in val or '\\' in val or "'" in val]
        cek('(c) %s: keluaran tanpa tanda kutip / garis miring terbalik' % nama, not buruk, buruk)

# (e) katalog saksi ----------------------------------------------------------------------------------------------------
kat = os.path.join(AKAR, '..', '..', 'ekstensi-sipp', 'saksi-katalog', 'penunjukan-wali.json')
if os.path.exists(kat):
    r = subprocess.run(['node', os.path.join(AKAR, 'alat', 'periksa_katalog.cjs'), 'penunjukan-wali.json'], capture_output=True)
    keluar = (r.stdout.decode('utf-8', 'replace') + r.stderr.decode('utf-8', 'replace')).strip()
    print(keluar.split('\n')[0])
    cek('(e) katalog penunjukan-wali.json galat 0', r.returncode == 0, keluar[:800])
else:
    cek('(e) katalog penunjukan-wali.json ada', False)

print('\nRINGKASAN: %s' % ('SEMUA LOLOS' if not GAGAL else 'GAGAL %d: %s' % (len(GAGAL), '; '.join(GAGAL))))
sys.exit(1 if GAGAL else 0)
