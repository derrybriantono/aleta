# -*- coding: utf-8 -*-
"""Uji kecil jenis 355 (pencabutan kekuasaan wali).
Jalankan dari mana saja: python uji_355.py [--tanpa-sql]
  (a) membangun berkas (bangun_semua 355): 12 putusan gugatan + 3 penetapan permohonan + BAS
  (b) semua penanda #nnnn# di RTF dan di kueri ada di server (w3b-var-server.pkl) atau milik jenis ini (3830-3859); tiap isian milik jenis dipakai
  (c) SQL variabel turunan jalan di MariaDB server (BACA SAJA lewat ssh aleta) atas perkara nyata SIPP dengan isian simulasi; hasil dibandingkan dengan harapan
  (d) tidak ada sisa kata jenis lain (nafkah, hibah, hak asuh, ..., kata Aleta) dan tidak ada penanda ayah/ibu kandung 9300/9301
  (e) katalog saksi pencabutan-kuasa-wali.json lolos pemeriksa (galat 0)
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
PERKARA = os.environ.get('UJI_PERKARA', '10096')   # perkara perwalian (354) nyata: belum ada perkara 355 di SIPP; kueri tidak bergantung jenis perkara
RENTANG = (3830, 3859)


def cek(nama, ok, info=''):
    print(('LOLOS  ' if ok else 'GAGAL  ') + nama + (' - ' + str(info) if info and not ok else ''))
    if not ok:
        GAGAL.append(nama)


# (a) bangun -----------------------------------------------------------------------------------------------------------
S = bangun_semua.bangun('355')
folder_p = os.path.join(KELUAR, S['folder'])
folder_b = folder_p + ' - BAS'
putusan = sorted(f for f in os.listdir(folder_p) if f.endswith('.rtf'))
bas = sorted(f for f in os.listdir(folder_b) if f.endswith('.rtf'))
gug = [f for f in putusan if not f.startswith(('[01p]', '[03p]', '[99p]'))]
per = [f for f in putusan if f.startswith(('[01p]', '[03p]', '[99p]'))]
cek('(a) 12 putusan gugatan (tanpa [97] karena perdamaian=False)', len(gug) == 12 and not any(f.startswith('[97]') for f in gug), gug)
cek('(a) 3 penetapan permohonan [01p] [03p] [99p]', len(per) == 3, per)
cek('(a) BAS gugatan 7 (ALUR 71) + 29 salinan ALUR 04-09 + 10 BAS permohonan = 46', len(bas) == 46, len(bas))

# (b) penanda ----------------------------------------------------------------------------------------------------------
server = pickle.load(open('D:/aleta-dev/kerja/w3b-var-server.pkl', 'rb'))
milik = {'%04d' % x['no'] for x in V.VAR if RENTANG[0] <= x['no'] <= RENTANG[1]}
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
cek('(b) semua penanda RTF dikenal (server atau 3830-3859)', not asing, asing)
cek('(b) penanda 38xx yang dipakai terdefinisi', all(n in milik for n in tanda_semua if 3800 <= int(n) <= 3999), [n for n in tanda_semua if 3800 <= int(n) <= 3999 and n not in milik])
nama_buruk = [x['no'] for x in V.VAR if RENTANG[0] <= x['no'] <= RENTANG[1] and len(x['nama']) > 200]
cek('(b) nama variabel <= 200 huruf dan tanpa kata ALETA', not nama_buruk and not V.PANJANG, V.PANJANG)
for x in V.VAR:
    if RENTANG[0] <= x['no'] <= RENTANG[1] and x['sql']:
        for n in set(re.findall(r'#(\d{4})#', x['sql'])):
            if n not in server and n not in milik:
                cek('(b) penanda %s dalam kueri %d dikenal' % (n, x['no']), False)
semua_kueri = ' '.join((x['sql'] or '') for x in V.VAR)
for x in V.VAR:
    if RENTANG[0] <= x['no'] <= RENTANG[1] and x['tipe'] == 'data_teks':
        n = '%04d' % x['no']
        cek('(b) isian %s dipakai' % n, n in tanda_semua or ('no_var = %d' % x['no']) in semua_kueri)
isian_semua = {int(n) for n in tanda_semua if n in milik}
cek('(b) penanda sql 3831-3857 yang dipakai tiap RTF jenis ada dalam V.VAR', all(any(y['no'] == int(n) for y in V.VAR) for n in isian_semua))

# (d) sisa kata jenis lain ---------------------------------------------------------------------------------------------
POLA = re.compile(r'hibah|nafkah|mafqud|hadhanah|hadhonah|penguasaan anak|hak asuh|wakaf|wasiat|aleta|pencabutan kekuasaan orang tua|#9300#|#9301#|ayah kandung|ibu kandung', re.I)
sisa = {}
for f, isi in teks_semua.items():
    m = POLA.findall(isi)
    if m:
        sisa[f] = sorted(set(x.lower() for x in m))
cek('(d) tanpa sisa kata jenis lain / Aleta / penanda 9300 9301', not sisa, dict(list(sisa.items())[:3]))
cek('(d) nama berkas memuat nama jenis', all(('Pencabutan Kekuasaan Wali' in f) or ('Pencabutan Perwalian' in f) or f.startswith('BAS ALUR 0') for f in putusan + bas), None)

# (c) SQL -------------------------------------------------------------------------------------------------------------
if '--tanpa-sql' not in sys.argv:
    def literal(teks):
        return "'" + teks.replace('\\', '/').replace('"', '&quot;').replace("'", '&#39;') + "'"

    def sim(sql, isian):
        s = sql
        for n in range(RENTANG[0], RENTANG[1] + 1):
            s = s.replace(V.isi(n), literal(isian.get(n, '')))
        return s

    def polos(t):
        return re.sub(r'#\d{4}#', '', t)   # jalankan() menghapus penanda #nnnn# yang tidak diberi nilai

    UU_A = 'Pasal 53 ayat (1) jo. Pasal 49 ayat (1) huruf a Undang-Undang Nomor 1 Tahun 1974 tentang Perkawinan'
    PP_AKHIR = ' Peraturan Pemerintah Nomor 29 Tahun 2019 tentang Syarat dan Tata Cara Penunjukan Wali'
    KASUS = {
        'A-orang-tua': {3830: 'ibu kandung', 3832: 'Penetapan Pengadilan Agama Donggala Nomor 12/Pdt.P/2020/PA.Dgl tanggal 3 Maret 2020', 3834: 'A', 3839: 'sampai anak berumur 18 (delapan belas) tahun',
                        3842: 'Fulanah binti Fulan (ibu kandung)', 3847: 'Surat Rekomendasi Dinas Sosial Nomor 12 tanggal 3 Maret 2026', 3849: 'uang santunan dan sebidang tanah'},
        'BD-pengganti': {3830: 'paman kandung', 3834: 'B, D', 3841: 'Fulan bin Fulan (kakek dari pihak ibu)', 3849: 'tabungan anak', 3852: 'Siti binti Ali (bibi anak)'},
        'C-sifat': {3834: 'C', 3857: 'penjudi dan pemabuk'},
        'C-tanpa-sifat': {3834: 'C'},
        'A-B-gabung': {3834: 'A, B'},
        'AD-rapat': {3834: 'AD'},
        'ADEFG': {3834: 'A, D, E, F, G', 3852: 'Fulan bin Fulan (paman kandung anak)'},
        'E': {3834: 'E'},
        'F': {3834: 'F'},
        'kosong': {},
        'kata-utuh': {3834: 'Salah Urus'},
    }
    HARAP = {
        'A-orang-tua': {
            3831: 'ibu kandung',
            3833: ', yang menjadi wali berdasarkan Penetapan Pengadilan Agama Donggala Nomor 12/Pdt.P/2020/PA.Dgl tanggal 3 Maret 2020',
            3835: UU_A + ', Pasal 109 Kompilasi Hukum Islam dan Pasal 17 ayat (2) huruf a' + PP_AKHIR,
            3837: 'wali tersebut melalaikan kewajibannya sebagai wali',
            3840: ' untuk waktu sampai anak berumur 18 (delapan belas) tahun',
            3843: '', 3845: '',
            3846: polos(';<br>    - mengembalikan kuasa asuh atas #4407# tersebut kepada Fulanah binti Fulan (ibu kandung)'),
            3851: polos(';<br>    - mewajibkan #0047# untuk menyerahkan harta #4407# tersebut berupa uang santunan dan sebidang tanah beserta pertanggungjawaban pengelolaannya berupa pembukuan kepada Fulanah binti Fulan (ibu kandung)'),
            3853: ''},
        'BD-pengganti': {
            3831: 'paman kandung',
            3833: '',
            3835: 'Pasal 53 ayat (1) jo. Pasal 49 ayat (1) huruf b Undang-Undang Nomor 1 Tahun 1974 tentang Perkawinan, Pasal 109 Kompilasi Hukum Islam dan Pasal 17 ayat (2) huruf c' + PP_AKHIR,
            3837: 'wali tersebut berkelakuan buruk sekali dan menyalahgunakan hak dan wewenangnya sebagai wali',
            3840: '', 3846: '',
            3845: polos(';<br>    - menunjuk Fulan bin Fulan (kakek dari pihak ibu) sebagai wali pengganti bagi #4407# tersebut yang berkewajiban mengurus diri dan harta #4407# tersebut dengan sebaik-baiknya sesuai peraturan perundang-undangan'),
            3851: polos(';<br>    - mewajibkan Siti binti Ali (bibi anak) untuk menyerahkan harta #4407# tersebut berupa tabungan anak beserta pertanggungjawaban pengelolaannya berupa pembukuan kepada Fulan bin Fulan (kakek dari pihak ibu) selaku wali pengganti'),
            3853: 'Siti binti Ali (bibi anak)'},
        'C-sifat': {
            3835: 'Pasal 109 Kompilasi Hukum Islam',
            3836: 'Pengadilan Agama dapat mencabut hak perwalian seseorang atau badan hukum dan memindahkannya kepada pihak lain atas permohonan kerabat bila wali tersebut pemabuk, penjudi, pemboros, atau gila',
            3837: 'wali tersebut bersifat penjudi dan pemabuk'},
        'C-tanpa-sifat': {3837: 'wali tersebut bersifat ........'},
        'A-B-gabung': {
            3835: 'Pasal 53 ayat (1) jo. Pasal 49 ayat (1) huruf a dan huruf b Undang-Undang Nomor 1 Tahun 1974 tentang Perkawinan, Pasal 109 Kompilasi Hukum Islam dan Pasal 17 ayat (2) huruf a' + PP_AKHIR,
            3837: 'wali tersebut melalaikan kewajibannya sebagai wali dan berkelakuan buruk sekali'},
        'AD-rapat': {3837: 'wali tersebut melalaikan kewajibannya sebagai wali dan menyalahgunakan hak dan wewenangnya sebagai wali'},
        'ADEFG': {
            3835: UU_A + ', Pasal 109 Kompilasi Hukum Islam dan Pasal 17 ayat (2) huruf a, b, c, d dan e serta Pasal 18 ayat (1) dan ayat (2)' + PP_AKHIR,
            3837: 'wali tersebut melalaikan kewajibannya sebagai wali, menyalahgunakan hak dan wewenangnya sebagai wali, melakukan tindak kekerasan terhadap anak yang berada dalam pengasuhannya dan tidak cakap melakukan perbuatan hukum serta orang tua anak tersebut telah dianggap mampu melaksanakan kewajibannya',
            3853: 'Fulan bin Fulan (paman kandung anak)'},
        'E': {3835: 'Pasal 17 ayat (2) huruf d' + PP_AKHIR,
              3836: 'wali dapat berakhir karena kekuasaannya dicabut berdasarkan penetapan atau putusan Pengadilan dikarenakan wali melakukan tindak kekerasan terhadap anak yang ada dalam pengasuhannya',
              3837: 'wali tersebut melakukan tindak kekerasan terhadap anak yang berada dalam pengasuhannya'},
        'F': {3837: 'orang tua anak tersebut telah dianggap mampu melaksanakan kewajibannya', 3835: 'Pasal 17 ayat (2) huruf e dan Pasal 18 ayat (1) dan ayat (2)'.replace(' dan Pasal 18', ' serta Pasal 18') + PP_AKHIR},
        'kosong': {3831: '........', 3833: '', 3835: '........', 3836: '........', 3837: '........', 3840: '', 3843: '', 3844: '', 3845: '', 3846: '', 3848: '', 3850: '', 3851: '', 3853: ''},
        'kata-utuh': {3835: '........', 3836: '........', 3837: '........'},
    }
    NOMOR = [x['no'] for x in V.VAR if RENTANG[0] <= x['no'] <= RENTANG[1] and x['sql']]
    ISI_KASUS = {}
    for nama, isian in KASUS.items():
        bagian = []
        for n in NOMOR:
            x = [y for y in V.VAR if y['no'] == n][0]
            q = sim(x['sql'], isian).replace('#perkara_id#', PERKARA).rstrip().rstrip(';')
            bagian.append("SELECT '%d' AS k, (SELECT z.data FROM (%s) z) AS v" % (n, q))
        out = jalankan(' UNION ALL '.join(bagian), PERKARA)
        hasil = {}
        for b in out.split('\n'):
            m = re.match(r'^(\d{4})(?:\t(.*))?$', b)   # baris terakhir bernilai kosong kehilangan tab karena jalankan() men-strip
            if m:
                val = m.group(2) or ''
                hasil[int(m.group(1))] = '' if val == 'NULL' else val
        if len(hasil) != len(NOMOR):
            cek('(c) %s: SQL turunan jalan (%d/%d hasil)' % (nama, len(hasil), len(NOMOR)), False, out[:600])
            continue
        cek('(c) %s: %d kueri turunan jalan' % (nama, len(NOMOR)), True)
        ISI_KASUS[nama] = hasil
        for n, harap in HARAP.get(nama, {}).items():
            cek('(c) %s: %d sesuai harapan' % (nama, n), hasil.get(n, '') == harap, 'nyata=%r harap=%r' % (hasil.get(n), harap))
    h = ISI_KASUS.get('A-orang-tua')
    if h:
        cek('(c) A-orang-tua: pertimbangan pengembalian kuasa asuh (Pasal 19 ayat (3)) diawali <br>', h[3844].startswith('<br>Menimbang, bahwa Pasal 19 ayat (3)') and 'Fulanah binti Fulan (ibu kandung)' in h[3844], h[3844][:160])
        cek('(c) A-orang-tua: rekomendasi dinas sosial (Pasal 12 ayat (1) dan Pasal 18) tercetak', h[3848].startswith('<br>Menimbang, bahwa Pasal 12 ayat (1) dan Pasal 18') and 'Nomor 12 tanggal 3 Maret 2026' in h[3848], h[3848][:160])
        cek('(c) A-orang-tua: pertimbangan harta anak (Pasal 51 ayat (5) UU 1/1974 dan Pasal 110 KHI)', 'Pasal 51 ayat (5)' in h[3850] and 'Pasal 110 ayat (3) dan ayat (4)' in h[3850] and 'uang santunan dan sebidang tanah' in h[3850], h[3850][:160])
        cek('(c) A-orang-tua: norma memuat tiga sumber dipisah titik koma', h[3836].count('; ') == 2 and h[3836].endswith('dikarenakan wali melalaikan kewajiban sebagai wali'), h[3836][:300])
    h = ISI_KASUS.get('BD-pengganti')
    if h:
        cek('(c) BD-pengganti: pertimbangan wali pengganti memuat Pasal 53 ayat (2), penjelasan angka 17, Pasal 19 ayat (3)-(4), Pasal 33 UU 35/2014',
            all(k in h[3843] for k in ('Pasal 53 ayat (2)', 'angka 17', 'Pasal 19 ayat (3) dan ayat (4)', 'Pasal 33 ayat (1) dan ayat (2)', 'Pasal 3 sampai dengan Pasal 7')), h[3843][:200])
    h = ISI_KASUS.get('ADEFG')
    if h:
        cek('(c) ADEFG: norma PP memuat Pasal 18 (rekomendasi dinas sosial)', 'rekomendasi dinas yang menyelenggarakan urusan pemerintahan di bidang sosial' in h[3836], h[3836][-200:])
    for nama, hh in ISI_KASUS.items():
        buruk = [n for n, val in hh.items() if '"' in val or '\\' in val or "'" in val]
        cek('(c) %s: keluaran tanpa tanda kutip / garis miring terbalik' % nama, not buruk, buruk)

# (e) katalog saksi ----------------------------------------------------------------------------------------------------
kat = os.path.join(AKAR, '..', '..', 'ekstensi-sipp', 'saksi-katalog', 'pencabutan-kuasa-wali.json')
if os.path.exists(kat):
    r = subprocess.run(['node', os.path.join(AKAR, 'alat', 'periksa_katalog.cjs'), 'pencabutan-kuasa-wali.json'], capture_output=True)
    keluar = (r.stdout.decode('utf-8', 'replace') + r.stderr.decode('utf-8', 'replace')).strip()
    print(keluar.split('\n')[0])
    cek('(e) katalog pencabutan-kuasa-wali.json galat 0', r.returncode == 0, keluar[:800])
else:
    cek('(e) katalog pencabutan-kuasa-wali.json ada', False)

print('\nRINGKASAN: %s' % ('SEMUA LOLOS' if not GAGAL else 'GAGAL %d: %s' % (len(GAGAL), '; '.join(GAGAL))))
sys.exit(1 if GAGAL else 0)
