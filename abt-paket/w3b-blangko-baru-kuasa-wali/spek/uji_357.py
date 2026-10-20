# -*- coding: utf-8 -*-
"""Uji kecil jenis 357 GANTI RUGI TERHADAP WALI.
  python uji_357.py            -> (a) bangun berkas, (b) semua penanda #nnnn# dikenal, (c) SQL variabel jalan (server BACA SAJA + MariaDB lokal dengan isian contoh),
                                  (d) tanpa sisa kata jenis lain, (e) katalog saksi lolos periksa_katalog.cjs
  python uji_357.py --tanpa-server   -> lewati kueri ke server
Kode keluar 0 = semua lolos."""
import os
import pickle
import re
import subprocess
import sys

SINI = os.path.dirname(os.path.abspath(__file__))
PK = os.path.dirname(SINI)
sys.path.insert(0, os.path.join(PK, 'sumber'))
sys.path.insert(0, os.path.join(PK, 'alat'))
sys.stdout.reconfigure(encoding='utf-8')

import variabel_def as V  # noqa: E402
import bangun_semua  # noqa: E402
from bangun import Dok, lp  # noqa: E402
from pustaka import KELUAR  # noqa: E402

MYSQL = r'D:\satker asal\website pa bungku\xampp\mysql\bin\mysql.exe'
DB = 'w3b357'
SERVER_PKL = 'D:/aleta-dev/kerja/w3b-var-server.pkl'
MINE = {x['no']: x for x in V.VAR if 3890 <= x['no'] <= 3919}
GALAT = []


def ok(cond, msg):
    print(('  ok   ' if cond else '  GALAT ') + msg)
    if not cond:
        GALAT.append(msg)


# ---------------------------------------------------------------- (a) bangun
def uji_bangun():
    print('(a) bangun')
    S = bangun_semua.bangun('357')
    ok(S is not None, 'spek_357 terbaca')
    kut = os.path.join(KELUAR, S['folder'])
    kutb = os.path.join(KELUAR, S['folder'] + ' - BAS')
    p = [f for f in os.listdir(lp(kut)) if f.endswith('.rtf')]
    b = [f for f in os.listdir(lp(kutb)) if f.endswith('.rtf')]
    ok(len(p) == 13, 'putusan gugatan = 13 berkas (ada %d)' % len(p))
    ok(any(f.startswith('[97]') for f in p), 'berkas [97] Perdamaian ada (perdamaian=True)')
    ok(len(b) == 37, 'BAS = 37 berkas (ada %d)' % len(b))
    ok(any('Akta Perdamaian' in f for f in b), 'BAS AP ada')
    ok(not any(f.startswith('[01p]') or f.startswith('[99p]') for f in p), 'tanpa berkas permohonan')
    return S, kut, kutb


# ---------------------------------------------------------------- (b) penanda dan (d) sisa kata
SISA = re.compile(r'nafkah|hadhanah|hak asuh|penguasaan anak|\bhibah|wasiat|aleta|orang tua kandung|ibu kandung|ayah kandung|perwalian anak|#9300#|#9301#|#9302#|#9304#|#9759#|#97\d\d#', re.I)


def uji_teks(kut, kutb):
    print('(b)(d) penanda dan sisa kata')
    srv = pickle.load(open(SERVER_PKL, 'rb'))
    asing, sisa, jumlah = set(), [], 0
    for folder in (kut, kutb):
        for f in sorted(os.listdir(lp(folder))):
            if not f.endswith('.rtf'):
                continue
            jumlah += 1
            d = Dok(os.path.join(folder, f))
            for i in range(len(d.par)):
                t = d.isi(i)
                for tok in re.findall(r'#(\d{4})#', t):
                    if tok not in srv and int(tok) not in MINE:
                        asing.add((f[:50], tok))
                m = SISA.search(t)
                if m:
                    sisa.append((f[:50], m.group(0), t[max(0, m.start() - 40):m.end() + 40]))
    ok(not asing, 'semua penanda #nnnn# ada di server atau milik jenis ini (%d berkas; asing: %s)' % (jumlah, sorted(asing)[:5]))
    ok(not sisa, 'tanpa sisa kata jenis lain / Aleta (%s)' % sisa[:3])


# ---------------------------------------------------------------- (c) SQL
TERB_SATUAN = ['', 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan', 'sepuluh', 'sebelas']


def terbilang(n):
    n = int(n)
    if n < 12:
        return TERB_SATUAN[n] if n else 'nol'
    if n < 20:
        return terbilang(n - 10) + ' belas'
    if n < 100:
        return terbilang(n // 10) + ' puluh' + (' ' + terbilang(n % 10) if n % 10 else '')
    if n < 200:
        return 'seratus' + (' ' + terbilang(n - 100) if n > 100 else '')
    if n < 1000:
        return terbilang(n // 100) + ' ratus' + (' ' + terbilang(n % 100) if n % 100 else '')
    if n < 2000:
        return 'seribu' + (' ' + terbilang(n - 1000) if n > 1000 else '')
    if n < 10 ** 6:
        return terbilang(n // 1000) + ' ribu' + (' ' + terbilang(n % 1000) if n % 1000 else '')
    if n < 10 ** 9:
        return terbilang(n // 10 ** 6) + ' juta' + (' ' + terbilang(n % 10 ** 6) if n % 10 ** 6 else '')
    return terbilang(n // 10 ** 9) + ' miliar' + (' ' + terbilang(n % 10 ** 9) if n % 10 ** 9 else '')


STUB = {'0046': 'Penggugat', '0047': 'Tergugat', '8554': 'Majelis Hakim', '4407': 'anak', '4406': 'Fulan bin Fulan', '0053': 'gugatan', '0098': 'Budi', '0102': 'Andi'}


def mysql(sql, db=DB):
    r = subprocess.run([MYSQL, '-h', '127.0.0.1', '-u', 'root', '--default-character-set=utf8', '-N', '-B', db, '-e', sql], capture_output=True)
    return r.returncode, r.stdout.decode('utf-8', 'replace').replace('\r', '').rstrip('\n'), r.stderr.decode('utf-8', 'replace').strip()


def siapkan_db():
    mysql('DROP DATABASE IF EXISTS %s' % DB, db='mysql')
    mysql('CREATE DATABASE %s CHARACTER SET utf8' % DB, db='mysql')
    mysql('CREATE TABLE abt_data_teks (no_var INT, perkara_id VARCHAR(20), data TEXT) CHARACTER SET utf8')


def isi_db(isian, pid='1'):
    mysql('DELETE FROM abt_data_teks')
    for no, val in isian.items():
        lit = "'" + val.replace('\\', '\\\\').replace("'", "''") + "'"
        rc, _, err = mysql("INSERT INTO abt_data_teks VALUES (%d, '%s', %s)" % (no, pid, lit))
        assert rc == 0, err


def render(no, isian, galat, pid='1'):
    """Nilai variabel `no` seperti renderer ABT (sederhana): data_teks dari isian; data_sql dijalankan di MariaDB lokal; terbilang dari referensi."""
    x = MINE.get(no)
    if x is None:
        return STUB.get('%04d' % no, '[%04d]' % no)
    if x['tipe'] == 'data_teks':
        return isian.get(no, x['default'] or '')
    if x['tipe'] == 'terbilang':
        a = render(x['referensi'], isian, galat, pid)
        return terbilang(a) if a.isdigit() else ''
    sql = x['sql'].replace('#perkara_id#', pid).replace('aps_badilag.abt_data_teks', 'abt_data_teks')
    sql = re.sub(r'#(\d{4})#', lambda m: render(int(m.group(1)), isian, galat, pid), sql)
    rc, out, err = mysql(sql)
    if rc != 0:
        galat.append('GALAT SQL %d: %s' % (no, err[:200]))
        return ''
    return out


def hasil(isian, nomor):
    g = []
    isi_db(isian)
    r = {n: render(n, isian, g) for n in nomor}
    return r, g


def uji_sql_lokal():
    print('(c) SQL variabel di MariaDB lokal dengan isian contoh')
    siapkan_db()
    sql_vars = sorted(n for n, x in MINE.items() if x['tipe'] == 'data_sql')
    # 1. semua kosong
    r, g = hasil({}, sql_vars)
    ok(not g, 'tanpa galat SQL (isian kosong): %s' % g)
    ok(r[3891] == '........', '3891 kosong = titik-titik')
    ok(r[3893] == 'Fulan bin Fulan', '3893 kosong = nama anak SIPP (#4406#)')
    ok(r[3899] == '' and r[3901] == '........', '3899/3901 kosong tanpa angka')
    ok(r[3906] == '........', '3906 kosong = titik-titik')
    ok(r[3914] == '' and r[3918] == '', '3914/3918 kosong tidak tercetak')
    ok(r[3919] == 'kepada Penggugat', '3919 kosong = kepada Penggugat')
    # 2. uang saja, dengan tuntutan
    uang = {3890: 'anak yang bersangkutan yang kini telah dewasa', 3892: 'Siti binti Umar', 3898: 'Rp 150.000.000,00', 3912: 'bukti harga jual dan taksiran harga pasar', 3915: '175.000.000'}
    r, g = hasil(uang, sql_vars)
    ok(not g, 'tanpa galat SQL (uang)')
    ok(r[3891] == uang[3890], '3891 mengikuti isian')
    ok(r[3893] == 'Siti binti Umar', '3893 mengikuti isian nama anak')
    ok(r[3899] == '150000000', '3899 angka murni dari "Rp 150.000.000,00" = %s' % r[3899])
    ok(r[3901] == '150.000.000', '3901 bertitik = %s' % r[3901])
    ok(r[3916] == '175.000.000', '3916 tuntutan bertitik = %s' % r[3916])
    ok(r[3906] == 'dengan membayar ganti rugi sebesar Rp150.000.000,00 (seratus lima puluh juta rupiah) kepada Penggugat', '3906 uang saja: %s' % r[3906])
    ok('menuntut ganti rugi sebesar Rp175.000.000,00' in r[3904] and 'sebesar Rp150.000.000,00 (seratus lima puluh juta rupiah)' in r[3904] and 'bukti harga jual' in r[3904] and 'menyerahkan kembali' not in r[3904],
       '3904 uang saja memuat tuntutan, dasar penilaian, besaran dan tanpa pengembalian')
    ok(r[3904].startswith('<br>Menimbang, bahwa mengenai besarnya kerugian'), '3904 diawali satu baris baru')
    ok("'" not in r[3904] and 'taksiran harga pasar, Majelis Hakim menilai' in r[3904] and 'rupiah), sehingga patut dan layak' in r[3904], '3904 tanpa apostrof nyasar dan tanda baca benar')
    # 3. pengembalian saja, penerima untuk kepentingan anak
    bar = {3902: 'b', 3903: 'sebidang tanah SHM Nomor 12 luas 400 m2', 3905: 'B'}
    r, g = hasil(bar, sql_vars)
    ok(not g, 'tanpa galat SQL (pengembalian)')
    ok(r[3906] == 'dengan menyerahkan kembali sebidang tanah SHM Nomor 12 luas 400 m2 kepada Penggugat untuk dikelola dan dipergunakan bagi kepentingan anak tersebut', '3906 pengembalian saja: %s' % r[3906])
    ok('Rp' not in r[3904] and 'Pasal 33 ayat (4)' in r[3904], '3904 pengembalian saja tanpa uang')
    # 4. keduanya (huruf "A, B" dan tanpa huruf)
    dua = {3902: 'A, B', 3898: '2.500.000.000', 3903: 'sebidang tanah', 3912: 'taksiran'}
    r, g = hasil(dua, sql_vars)
    ok(not g and r[3906] == 'dengan membayar ganti rugi sebesar Rp2.500.000.000,00 (dua miliar lima ratus juta rupiah) dan menyerahkan kembali sebidang tanah, masing-masing kepada Penggugat', '3906 keduanya: %s' % r[3906])
    tanpa = {3898: '1000000', 3903: 'kendaraan roda empat'}
    r, g = hasil(tanpa, sql_vars)
    ok(not g and 'membayar ganti rugi sebesar Rp1.000.000,00 (satu juta rupiah)' in r[3906] and 'menyerahkan kembali kendaraan roda empat' in r[3906], '3906 tanpa huruf mengikuti isian yang terisi: %s' % r[3906])
    # 5. tanda kutip dan garis miring tidak merusak kueri
    nakal = {3890: 'anak "yang" bernama O\'Brian \\ x', 3895: 'tanah', 3913: 'ditegur oleh kepala desa "H" pada 2024', 3917: 'tidak ada pembukuan', 3898: '1.5'}
    r, g = hasil(nakal, sql_vars)
    ok(not g, 'tanda kutip, apostrof dan garis miring tidak merusak SQL (%s)' % g)
    ok('ditegur oleh kepala desa' in r[3914] and r[3914].startswith('<br>Menimbang'), '3914 tercetak bila 3913 terisi')
    ok('Pasal 110 ayat (4) Kompilasi Hukum Islam' in r[3918] and 'tidak ada pembukuan' in r[3918], '3918 tercetak bila 3917 terisi')
    ok(r[3899] == '15', 'pola sama dengan variabel 9342: titik dibuang ("1.5" -> 15): 3899=%r' % r[3899])
    r, g = hasil({3898: 'sekitar seratus juta'}, sql_vars)
    ok(not g and r[3899] == '' and r[3901] == '........' and r[3906] == '........', 'isian bukan angka -> titik-titik, bukan tebakan')


def uji_sql_server():
    print('(c) SQL variabel di server (BACA SAJA) atas perkara nyata')
    import uji_sql
    rc = subprocess.run(['ssh', '-o', 'ConnectTimeout=20', 'aleta', 'true'], capture_output=True).returncode
    if rc != 0:
        print('  (server tidak terjangkau, dilewati)')
        return
    pid = None
    sql = "SELECT perkara_id FROM perkara WHERE jenis_perkara_id IN (357,354,355,356) ORDER BY perkara_id DESC LIMIT 1"
    out = uji_sql.jalankan(sql, '0')
    m = re.search(r'\d+', out.split('\n')[-1]) if out else None
    pid = m.group(0) if m else '1'
    print('  perkara uji:', pid)
    for no in sorted(n for n, x in MINE.items() if x['tipe'] == 'data_sql'):
        x = MINE[no]
        out = uji_sql.jalankan(x['sql'], pid)
        ok('ERROR' not in out, 'server: SQL %d jalan%s' % (no, '' if 'ERROR' not in out else ' -> ' + out[:150]))


def render_server(no, isian, galat):
    """Sama dengan render(), tetapi SQL dijalankan di server (BACA SAJA): subkueri isian abt_data_teks diganti nilai literal dari `isian`,
    sehingga yang diuji adalah sintaks MariaDB 5.5 server dengan isian terisi, tanpa menulis apa pun."""
    import uji_sql
    x = MINE.get(no)
    if x is None:
        return STUB.get('%04d' % no, '[%04d]' % no)
    if x['tipe'] == 'data_teks':
        return isian.get(no, x['default'] or '')
    if x['tipe'] == 'terbilang':
        a = render_server(x['referensi'], isian, galat)
        return terbilang(a) if a.isdigit() else ''

    def lit(m):
        v = isian.get(int(m.group(1)))
        return "'" + v.replace(chr(92), chr(92) * 2).replace("'", "''") + "'" if v is not None else 'NULL'

    sql = re.sub(r"\(SELECT data FROM aps_badilag\.abt_data_teks WHERE no_var = (\d+) AND perkara_id = '#perkara_id#' LIMIT 1\)", lit, x['sql'])
    sql = re.sub(r'#(\d{4})#', lambda m: render_server(int(m.group(1)), isian, galat), sql)
    out = uji_sql.jalankan(sql, '1')
    if 'ERROR' in out:
        galat.append('GALAT SQL server %d: %s' % (no, out[:200]))
        return ''
    baris = out.split('\n')
    return '\n'.join(baris[1:]).strip() if baris and baris[0].strip() == 'data' else out


def uji_sql_server_terisi():
    print('(c) SQL variabel di server (BACA SAJA) dengan isian contoh sebagai literal')
    rc = subprocess.run(['ssh', '-o', 'ConnectTimeout=20', 'aleta', 'true'], capture_output=True).returncode
    if rc != 0:
        print('  (server tidak terjangkau, dilewati)')
        return
    dua = {3890: 'paman kandung dari anak tersebut', 3898: 'Rp 2.500.000.000,00', 3902: 'A, B', 3903: 'sebidang tanah SHM Nomor 12', 3905: 'B', 3912: 'taksiran harga pasar',
           3915: '3000000000', 3913: 'Kepala Desa menegur Tergugat', 3917: 'tidak ada pembukuan'}
    g = []
    r = {n: render_server(n, dua, g) for n in (3891, 3899, 3901, 3916, 3919, 3906, 3904, 3914, 3918)}
    ok(not g, 'tanpa galat SQL di server dengan isian terisi: %s' % g)
    ok(r[3899] == '2500000000' and r[3901] == '2.500.000.000' and r[3916] == '3.000.000.000', 'angka murni dan bertitik di server: %s %s %s' % (r[3899], r[3901], r[3916]))
    ok(r[3906] == 'dengan membayar ganti rugi sebesar Rp2.500.000.000,00 (dua miliar lima ratus juta rupiah) dan menyerahkan kembali sebidang tanah SHM Nomor 12, masing-masing kepada Penggugat untuk dikelola dan dipergunakan bagi kepentingan anak tersebut',
       '3906 di server: %s' % r[3906])
    ok('menuntut ganti rugi sebesar Rp3.000.000.000,00' in r[3904] and 'menyerahkan kembali sebidang tanah SHM Nomor 12' in r[3904], '3904 di server memuat tuntutan dan pengembalian')
    ok(r[3914].startswith('<br>Menimbang') and r[3918].startswith('<br>Menimbang'), '3914 dan 3918 di server tercetak')


# ---------------------------------------------------------------- (e) katalog
def uji_katalog():
    print('(e) katalog saksi')
    kat = os.path.join(PK, '..', '..', 'ekstensi-sipp', 'saksi-katalog', 'ganti-rugi-wali.json')
    ok(os.path.exists(kat), 'ganti-rugi-wali.json ada')
    if not os.path.exists(kat):
        return
    r = subprocess.run(['node', os.path.join(PK, 'alat', 'periksa_katalog.cjs'), 'ganti-rugi-wali.json'], capture_output=True)
    out = r.stdout.decode('utf-8', 'replace')
    print('  ' + out.strip().replace('\n', '\n  ')[:1500])
    ok(r.returncode == 0, 'periksa_katalog galat 0')


if __name__ == '__main__':
    S, kut, kutb = uji_bangun()
    uji_teks(kut, kutb)
    uji_sql_lokal()
    if '--tanpa-server' not in sys.argv:
        uji_sql_server()
        uji_sql_server_terisi()
    uji_katalog()
    print('\nGALAT: %d' % len(GALAT))
    for g in GALAT:
        print(' -', g)
    sys.exit(1 if GALAT else 0)
