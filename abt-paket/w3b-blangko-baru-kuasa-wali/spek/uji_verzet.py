# -*- coding: utf-8 -*-
"""Uji kecil VERZET (perlawanan atas putusan verstek; variabel 3970-3999; folder "96a Verzet" dan "96a Verzet - BAS").
  python uji_verzet.py            -> (a) bangun 8 putusan/penetapan + 15 BAS, (b) semua penanda #nnnn# dikenal, (c) SQL variabel jalan atas perkara 9321 (server BACA SAJA, isian disimulasikan),
                                      (d) tanpa sisa kata jenis lain / Aleta / sebutan Penggugat-Tergugat, (e) pertukaran data pihak pada BAS pembuktian, (f) kaki dan biaya memakai variabel verzet
  python uji_verzet.py --tanpa-sql   -> lewati kueri ke server
Kode keluar 0 = semua lolos."""
import os
import pickle
import re
import sys

SINI = os.path.dirname(os.path.abspath(__file__))
PK = os.path.dirname(SINI)
sys.path.insert(0, os.path.join(PK, 'sumber'))
sys.path.insert(0, os.path.join(PK, 'alat'))
sys.stdout.reconfigure(encoding='utf-8')

import bangun_semua  # noqa: E402
import variabel_def as V  # noqa: E402
from pustaka import Berkas, KELUAR  # noqa: E402
from uji_sql import jalankan  # noqa: E402

GAGAL = []
PERKARA = os.environ.get('UJI_PERKARA', '9321')   # 715/Pdt.G/2025/PA.Dgl: verstek 24 Des 2025, verzet 13 Jan 2026, gugur 10 Feb 2026
MINE = {x['no']: x for x in V.VAR if 3970 <= x['no'] <= 3999}


def cek(nama, ok, info=''):
    print(('LOLOS  ' if ok else 'GAGAL  ') + nama + (' - ' + str(info) if info and not ok else ''))
    if not ok:
        GAGAL.append(nama)


# (a) bangun -----------------------------------------------------------------------------------------------------------
S = bangun_semua.bangun('verzet')
folder_p = os.path.join(KELUAR, S['folder'])
folder_b = folder_p + ' - BAS'
putusan = sorted(f for f in os.listdir(folder_p) if f.endswith('.rtf'))
bas = sorted(f for f in os.listdir(folder_b) if f.endswith('.rtf'))
kode_p = [re.match(r'^(\[[0-9a-z]+\])', f).group(1) for f in putusan]
cek('(a) 8 putusan/penetapan [01] [02] [98] [98a] [98b] [99] [99a] [99b]', kode_p == ['[01]', '[02]', '[98]', '[98a]', '[98b]', '[99]', '[99a]', '[99b]'], kode_p)
cek('(a) 15 BAS ALUR 76', len(bas) == 15 and all(f.startswith('BAS ALUR 76 Verzet - [') for f in bas), len(bas))
cek('(a) variabel verzet 30 butir tanpa nama > 200 huruf', len(MINE) == 30 and not V.PANJANG, V.PANJANG)

# (b) penanda ----------------------------------------------------------------------------------------------------------
server = pickle.load(open('D:/aleta-dev/kerja/w3b-var-server.pkl', 'rb'))
tanda_semua, teks_semua = {}, {}
for folder, daftar in ((folder_p, putusan), (folder_b, bas)):
    for f in daftar:
        b = Berkas(os.path.join(folder, f))
        isi = '\n'.join(b.t)
        teks_semua[f] = isi
        for n in set(re.findall(r'#(\d{4})#', isi)):
            tanda_semua.setdefault(n, []).append(f)
milik = {'%04d' % n for n in MINE}
asing = {n: fs[:2] for n, fs in tanda_semua.items() if n not in server and n not in milik}
cek('(b) semua penanda dikenal (server 21 Okt atau 3970-3999)', not asing, asing)
for x in MINE.values():
    if x['sql']:
        for n in set(re.findall(r'#(\d{4})#', x['sql'])):
            if n not in server and n not in milik:
                cek('(b) penanda %s dalam kueri %d dikenal' % (n, x['no']), False)
semua_kueri = ' '.join((x['sql'] or '') for x in MINE.values())
tak_dipakai = []
for x in MINE.values():
    n = '%04d' % x['no']
    if x['tipe'] == 'data_teks' and n not in tanda_semua and ('no_var = %d' % x['no']) not in semua_kueri:
        tak_dipakai.append(n)
    if x['tipe'] in ('data_sql', 'terbilang') and n not in tanda_semua and ('#%s#' % n) not in semua_kueri:
        tak_dipakai.append(n)
cek('(b) tiap variabel verzet dipakai (RTF atau kueri)', not tak_dipakai, tak_dipakai)
# kelompok isian-asal berkas yang memuat isian verzet memuat nomornya
kurang = []
from pustaka import RX_ASAL  # noqa: E402
for folder, daftar in ((folder_p, putusan), (folder_b, bas)):
    for f in daftar:
        mentah = open(os.path.join(folder, f), 'rb').read().decode('latin1')
        m = RX_ASAL.search(mentah)
        pakai = {int(t) for t in re.findall(r'#(\d{4})#', teks_semua[f]) if 3970 <= int(t) <= 3999 and MINE.get(int(t), {}).get('tipe') == 'data_teks'}
        if pakai and not m and folder == folder_p:
            kurang.append((f[:20], 'tanpa kelompok isian-asal'))
        elif m and pakai:
            ada = {int(t) for t in re.findall(r'#(\d{4})#', m.group(1))}
            if not pakai <= ada:
                kurang.append((f[:20], sorted(pakai - ada)))
cek('(b) kelompok isian-asal memuat isian verzet yang dipakai teks', not kurang, kurang)

# (d) sisa kata ---------------------------------------------------------------------------------------------------------
POLA = re.compile(r'hibah|nafkah|mafqud|hadhanah|hadhonah|penguasaan anak|hak asuh|wakaf|wasiat|aleta|Penggugat|Tergugat|Pemohon|Termohon', re.I)
sisa = {}
for f, isi in teks_semua.items():
    # huruf kecil "tergugat/penggugat" hanya boleh sebagai uraian bunyi pasal RBg; kapital berarti sebutan pihak yang lupa diganti
    teks = re.sub(r'\b(tergugat|penggugat)\b', '', isi)
    m = POLA.findall(teks)
    if m:
        sisa[f[:50]] = sorted(set(m))
cek('(d) tanpa sisa kata jenis lain / Aleta / sebutan Penggugat-Tergugat', not sisa, sisa)
cek('(d) nama berkas memuat Verzet', all('Verzet' in f for f in putusan + bas))
rtf_sisa = [f for f, isi in teks_semua.items() if re.search(r'@@|#8500#|#8501#|#8502#|#0143#|#0155#|#9955#|#9911#|#9250#|#9251#|#8507#|#8509#|#8523#', isi)]
cek('(d) tanpa penanda perkara asal yang menyesatkan (8500-8502, 0143, 0155, 9955, 9911, 9250, 9251, 8507, 8509, 8523)', not rtf_sisa, rtf_sisa)

# (e) pertukaran data pihak pada BAS pembuktian ---------------------------------------------------------------------------
def teks_bas(kode):
    f = [x for x in bas if x.startswith('BAS ALUR 76 Verzet - [%s] ' % kode)][0]
    return teks_semua[f]


for kode in ('3', '3a'):
    t = teks_bas(kode)
    cek('(e) BAS [%s] Pelawan: saksi sisi T (#6100# #5058#->#6120#), bukti #3983#, tanpa #1197# #5058# #9955#' % kode,
        '#6100#' in t and '#6120#' in t and '#3983#' in t and '#1197#' not in t and '#5058#' not in t and '#9955#' not in t)
for kode in ('4', '4a'):
    t = teks_bas(kode)
    cek('(e) BAS [%s] Terlawan: saksi sisi P (#1197# #5058#), bukti #3984#, tanpa #6100# #6120# #9911#' % kode,
        '#1197#' in t and '#5058#' in t and '#3984#' in t and '#6100#' not in t and '#6120#' not in t and '#9911#' not in t)
cek('(e) BAS [4a] saksi ketiga Terlawan (#6132# dan #5060#), bukan Pelawan',
    '#6132#' in teks_bas('4a') and '#5060#' in teks_bas('4a') and 'saksi ketiga Terlawan' in teks_bas('4a') and 'saksi kedua Terlawan' in teks_bas('4a'))
cek('(e) BAS [3a] saksi ketiga Pelawan (#6138# dan #8921#)', '#6138#' in teks_bas('3a') and '#8921#' in teks_bas('3a') and 'saksi ketiga Pelawan' in teks_bas('3a'))
for kode in ('1', '2', '3', '4', '5', '6', '7', '8', '9'):
    t = teks_bas(kode)
    cek('(e) BAS [%s] pihak: #0102# Pelawan lalu #0098# Terlawan' % kode,
        re.search(r'#0102#, sebagai Pelawan \(semula #0047#\)', t) is not None and re.search(r'#0098#, sebagai Terlawan \(semula #0046#\)', t) is not None)

# (f) kaki dan biaya ----------------------------------------------------------------------------------------------------
for f in putusan:
    t = teks_semua[f]
    cek('(f) %s: kaki #3995#/#3996# atau "ditetapkan", tanda tangan #3997#, biaya #3993# #3994#' % f[:6],
        ('#3995#' in t or 'Demikian ditetapkan dalam rapat musyawarah' in t) and '#3996#' in t and '#3997#' in t and '#3993#' in t and '#3994#' in t)
cek('(f) [01] amar: Pelawan yang benar, membatalkan, mengadili kembali #3990#, biaya dibebankan kepada Terlawan',
    all(x in teks_semua[putusan[0]] for x in ('Menyatakan Pelawan adalah Pelawan yang benar', 'Membatalkan putusan verstek', '#3990#', 'Membebankan kepada Terlawan')))
cek('(f) [02] amar: menolak, menguatkan, biaya dibebankan kepada Pelawan',
    all(x in teks_semua[putusan[1]] for x in ('Menolak perlawanan Pelawan', 'Menguatkan putusan verstek', 'Membebankan kepada Pelawan')))
cek('(f) [98] dan [98b] berupa PENETAPAN (MENETAPKAN), [98a] [99] putusan (MENGADILI)',
    all(teks_semua[f].startswith('PENETAPAN') and 'MENETAPKAN' in teks_semua[f] for f in putusan if f.startswith(('[98]', '[98b]'))) and
    all(teks_semua[f].startswith('PUTUSAN') and 'MENGADILI' in teks_semua[f] for f in putusan if f.startswith(('[01]', '[02]', '[98a]', '[99'))))
cek('(f) [99] [99a] [99b] amar tidak dapat diterima + putusan verstek tetap dijalankan',
    all('tidak dapat diterima' in teks_semua[f] and 'tetap dijalankan' in teks_semua[f] for f in putusan if f.startswith('[99')))

# (c) SQL -------------------------------------------------------------------------------------------------------------
if '--tanpa-sql' not in sys.argv:
    def literal(teks):
        return "'" + teks.replace('\\', '/').replace('"', '&quot;').replace("'", '&#39;') + "'"

    def hasil_data(out):
        baris = out.split('\n', 1)
        return baris[1] if len(baris) > 1 and baris[0] == 'data' else ('' if out == 'data' else out)

    def sim(no, isian=None, penanda=None):
        s = MINE[no]['sql']
        for n in range(3970, 4000):
            s = s.replace(V.isi(n), literal((isian or {}).get(n, '')))
        return hasil_data(jalankan(s, PERKARA, penanda))

    PEN = {'7048': '<strong>Aslam bin Ahlan</strong>, NIK 7271, tempat kediaman di Jl. Mawar, sebagai <strong>Tergugat;</strong>', '0047': 'Tergugat',
           '7047': '<strong>Sri Mulyani</strong>, NIK 7272, sebagai <strong>Penggugat</strong>;', '0046': 'Penggugat', '8710': '', '0053': 'gugatan',
           '8008': 'Pengadilan Agama Donggala', '8501': 'LAMA', '8502': 'LAMA', '8500': 'LAMA', '8553': 'PP LAMA', '8004': 'Panitera PA'}
    h = {n: sim(n, None, PEN) for n in (3970, 3971, 3972, 3973, 3974, 3975, 3976, 3990, 3992, 3993, 3995, 3996, 3997, 3998)}
    cek('(c) 3970 Pelawan: sebutan akhir "Pelawan semula Tergugat"', 'sebagai <strong>Pelawan semula Tergugat;</strong>' in h[3970] and 'Aslam bin Ahlan' in h[3970], h[3970])
    cek('(c) 3971 Terlawan: sebutan akhir "Terlawan semula Penggugat"', 'sebagai <strong>Terlawan semula Penggugat</strong>' in h[3971], h[3971])
    cek('(c) 3972 putusan verstek perkara 9321', h[3972] == 'Nomor 715/Pdt.G/2025/PA.Dgl tanggal 24 Desember 2025', h[3972])
    cek('(c) 3973/3974 tanggal surat dan pendaftaran 13 Januari 2026', h[3973] == '13 Januari 2026' and h[3974] == '13 Januari 2026', (h[3973], h[3974]))
    cek('(c) 3975 pemberitahuan putusan verstek 30 Desember 2025', h[3975] == '30 Desember 2025', h[3975])
    cek('(c) 3976 kosong: kalimat netral dengan titik-titik', h[3976].startswith('Menimbang, bahwa putusan verstek tersebut diberitahukan kepada Pelawan pada tanggal 30 Desember 2025, sedangkan perlawanan didaftarkan pada tanggal 13 Januari 2026')
        and h[3976].endswith('........;'), h[3976])
    cek('(c) 3990 belum dipilih: titik-titik', h[3990] == '........;', h[3990])
    cek('(c) 3992 kosong: kosong; 3993 titik-titik', h[3992] in ('', 'NULL') and h[3993] == '........', (h[3992], h[3993]))
    cek('(c) 3995 kaki: majelis verzet tahapan 16', h[3995] == 'Demikian diputuskan dalam rapat musyawarah Majelis Hakim Pengadilan Agama Donggala', h[3995])
    cek('(c) 3996 kaki: Akbar Ali (Ketua), Idris, Derry Briantono, PP Sri Susilowati, kehadiran sidang verzet terakhir = tidak ada (kode 4)',
        'oleh <strong>Akbar Ali, S.H.I.</strong> sebagai Hakim Ketua, <strong>Idris, S.H.I., M.H.</strong> dan <strong>Derry Briantono, S.H.</strong>' in h[3996]
        and '<strong>Sri Susilowati, S.H.</strong> sebagai Panitera Sidang' in h[3996] and 'tanpa kehadiran Pelawan dan Terlawan' in h[3996], h[3996])
    cek('(c) 3997 blok tanda tangan memuat ketiga hakim dan panitera verzet', all(x in h[3997] for x in ('Akbar Ali', 'Idris', 'Derry Briantono', 'Sri Susilowati')) and 'LAMA' not in h[3997])
    cek('(c) 3998 amar verzet dari SIPP (gugur)', 'perlawanan Pelawan' in h[3998] and 'gugur' in h[3998], h[3998][:120])

    KASUS = [
        ('A', {3977: 'A'}, 'diajukan dalam tenggang waktu yang ditentukan undang-undang', 'yaitu 14 hari setelah pemberitahuan tersebut'),
        ('B dalam', {3977: 'B', 3978: '05-01-2026'}, 'batas akhir pengajuan perlawanan adalah tanggal 13 Januari 2026', 'diajukan dalam tenggang waktu yang ditentukan undang-undang'),
        ('B lewat', {3977: 'b', 3978: '01/01/2026'}, 'batas akhir pengajuan perlawanan adalah tanggal 09 Januari 2026', 'diajukan setelah lewat tenggang waktu'),
        ('B tanggal salah', {3977: 'B', 3978: 'kemarin'}, 'tanggal ........,', 'sehingga perlawanan ........;'),
        ('C dalam', {3977: 'C', 3979: '20-01-2026'}, 'diperpanjang sampai dengan tanggal 20 Januari 2026', 'diajukan dalam tenggang waktu yang diperpanjang tersebut'),
        ('C lewat', {3977: 'C', 3979: '10-01-2026'}, 'diperpanjang sampai dengan tanggal 10 Januari 2026', 'diajukan setelah lewat tenggang waktu yang diperpanjang tersebut'),
    ]
    for nama, isian, a, b in KASUS:
        out = sim(3976, isian, PEN)
        cek('(c) 3976 %s' % nama, a in out and b in out and out.startswith('Menimbang, bahwa menurut Pasal 153 ayat ('), out)
    out = sim(3976, {3977: 'Saudara Cacat'}, PEN)
    cek('(c) 3976 kata utuh (bukan huruf) tidak dianggap pilihan: kalimat netral', out.startswith('Menimbang, bahwa putusan verstek tersebut diberitahukan') and out.endswith('........;'), out)
    out = sim(3976, {3977: 'A, C', 3979: '20-01-2026'}, PEN)
    cek('(c) 3976 "A, C": huruf C (diperpanjang) didahulukan', 'diperpanjang sampai dengan tanggal 20 Januari 2026' in out, out)
    cek('(c) 3990 kata utuh "Ditolak" bukan pilihan: titik-titik', sim(3990, {3987: 'Ditolak'}, PEN) == '........;')
    for nama, isian, harap in (('A', {3987: 'A'}, 'Menolak gugatan Terlawan;'), ('B huruf kecil', {3987: 'b'}, 'Menyatakan gugatan Terlawan tidak dapat diterima (niet ontvankelijk verklaard);'),
                               ('C', {3987: 'C', 3989: 'Menjatuhkan talak satu bain sughra;<br>Membebankan biaya'}, 'Menjatuhkan talak satu bain sughra;<br>Membebankan biaya'),
                               ('C tanpa huruf', {3989: 'Menolak gugatan sebagian;'}, 'Menolak gugatan sebagian;')):
        cek('(c) 3990 %s' % nama, sim(3990, isian, PEN) == harap, sim(3990, isian, PEN))
    for ketik, harap in (('Rp140.000,00', '140000'), ('140.000', '140000'), ('140000', '140000'), ('seratus', '')):
        nyata = sim(3992, {3991: ketik}, PEN)
        cek('(c) 3992 isian %r -> angka murni %r' % (ketik, harap), (nyata if nyata != 'NULL' else '') == harap, nyata)
    s93 = MINE[3993]['sql'].replace('"#3992#"', '"140000"')
    cek('(c) 3993 140000 -> 140.000', hasil_data(jalankan(s93, PERKARA)) == '140.000')
    # keluaran otomatis bebas tanda kutip dan garis miring terbalik (aman bagi penggantian penanda), kecuali blok RTF 3997 dan amar HTML SIPP 3998
    buruk = [n for n, val in h.items() if n not in (3997, 3998, 3970, 3971) and ('"' in val or '\\' in val or "'" in val)]
    cek('(c) keluaran otomatis tanpa tanda kutip / garis miring terbalik', not buruk, buruk)

print('\nRINGKASAN: %s' % ('SEMUA LOLOS' if not GAGAL else 'GAGAL %d: %s' % (len(GAGAL), '; '.join(GAGAL))))
sys.exit(1 if GAGAL else 0)
