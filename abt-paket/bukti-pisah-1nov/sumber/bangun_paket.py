# -*- coding: utf-8 -*-
"""Bangun paket ABT bukti-pisah-1nov (1 Nov 2026) - bukti surat dan bukti elektronik dicetak TERPISAH di BAS pembuktian dan putusan.

pakai: python bangun_paket.py <akar _blangko_abt sesudah 23 paket (urutan ../../URUTAN-PASANG-31okt.md)> <basis ABT sesudah 23 paket> [<basis ABT yang SUDAH memuat tiga fungsi baru, untuk sidik uji>]

Dasar: commit d1ace5ec (blok 12040-12049, sasaran awan-T11-blangko-sasaran.tsv = 397 blangko yang memuat #11170#-#11177#).
Variabel BARU (semua data_sql, TURUNAN dari isian bukti yang sudah ada - tanpa isian baru, tanpa ubahan ekstensi):
  12040/12045 daftar bukti SURAT saja (P / T)      12041/12046 daftar bukti ELEKTRONIK saja
  12042/12047 klausa BAS "menyerahkan bukti surat berupa:" (varian paling umum)   12043/12048 pengantar BAS bukti elektronik
  12044/12049 judul sub-bab putusan "A. Bukti Surat:"
  12050 dst.    varian lain (frasa alat bukti, klausa/pengantar menurut sebutan pihak di blangko, judul sub-bab, huruf Saksi)
Fungsi BARU (sumber/fungsi_baru.sql): isian_bukti_baris, isian_bukti_sumber, isian_bukti_rtf.
Blangko RTF: ubah_bukti.py. Keluaran: ../paket-satker dan ../hasil.
"""
import base64
import collections
import difflib
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys

SINI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, SINI)
sys.path.insert(0, os.path.join(SINI, '..', '..', 'bas-tanya-jawab-29okt', 'sumber'))
import ubah_bukti as U  # noqa: E402
from rtfsatuan import seimbang  # noqa: E402

TINJAU = os.path.join(SINI, '..', '..', 'tinjau-31okt', 'paket-satker')
MYSQL = r'D:\Satker Asal\Website PA Bungku\xampp\mysql\bin\mysql.exe'
N = 'abt-bukti-pisah-1nov'
TANGGAL = '2026-11-01 00:00:00'
BS = chr(92)
SASARAN = os.path.join(SINI, '..', '..', '..', 'docs', 'arahan', 'awan-T11-blangko-sasaran.tsv')
BLOK = (12040, 12099)
NAMA_FUNGSI = ('isian_bukti_baris', 'isian_bukti_sumber', 'isian_bukti_rtf')

PIHAK = {'P': 'PENGGUGAT/PEMOHON', 'T': 'TERGUGAT/TERMOHON'}

# nomor tetap (selaras KODE_BUKTI_PISAH di ekstensi-sipp/blangko-derry-isian.js): kunci -> nomor
TETAP = {
    ('DS', 'P'): 12040, ('DE', 'P'): 12041, ('SL', 'P', '. Selanjutnya #7085# menyerahkan bukti surat berupa :'): 12042,
    ('EI', 'P', '#7085#'): 12043, ('HA', 'P', 'Bukti Surat:'): 12044,
    ('DS', 'T'): 12045, ('DE', 'T'): 12046, ('SL', 'T', '. Selanjutnya #7086# menyerahkan bukti surat berupa:'): 12047,
    ('EI', 'T', '#7086#'): 12048, ('HA', 'T', 'Bukti Surat:'): 12049,
}
URUT_JENIS = ['DS', 'DE', 'A', 'SL', 'EI', 'HA', 'HE', 'LT']


def panjang(p):
    p = os.path.abspath(p)
    a = BS * 2 + '?' + BS
    return p if p.startswith(a) else a + p


def md5b(b):
    return hashlib.md5(b).hexdigest()


def hexs(s):
    return '0x' + s.encode('latin1').hex() if s else "''"


# ───────────────────────── SQL variabel ─────────────────────────
def SUM(p):
    return "aps_badilag.isian_bukti_sumber('#perkara_id#', '%s')" % p


def ADA(p, j):
    return "CHAR_LENGTH(aps_badilag.isian_bukti_baris(%s, %d)) > 0" % (SUM(p), j)


def sql_var(v):
    j, p = v['jenis'], v['pihak']
    if j == 'DS':
        return "SELECT aps_badilag.isian_bukti_rtf(%s, 0) AS data" % SUM(p)
    if j == 'DE':
        return "SELECT aps_badilag.isian_bukti_rtf(%s, 1) AS data" % SUM(p)
    if j == 'A':
        b = v['bentuk']
        if b == 'a':
            s, e, k = 'alat bukti surat dan saksi-saksi', 'alat bukti elektronik dan saksi-saksi', 'saksi-saksi'
        elif b == 'b':
            s, e, k = 'alat bukti surat', 'alat bukti elektronik', 'saksi-saksi'
        else:
            ek = ' untuk menguatkan dalil-dalil permohonannya'
            s, e, k = 'alat bukti berupa surat dan saksi-saksi' + ek, 'alat bukti berupa elektronik dan saksi-saksi' + ek, 'saksi-saksi' + ek
        return "SELECT IF(%s, '%s', IF(%s, '%s', '%s')) AS data" % (ADA(p, 0), s, ADA(p, 1), e, k)
    if j == 'SL':
        return "SELECT IF(%s, '%s', '.') AS data" % (ADA(p, 0), v['hadir'])
    if j == 'EI':
        return ("SELECT IF(%s, CONCAT('Selanjutnya %s menyerahkan bukti elektronik berupa:', CHAR(92 USING latin1), 'par'), '') AS data"
                % (ADA(p, 1), v['sebut']))
    if j == 'HA':
        return ("SELECT IF(%s, CONCAT('A.', CHAR(92 USING latin1), 'tab %s', CHAR(92 USING latin1), 'par'), '') AS data"
                % (ADA(p, 0), v['judul']))
    if j == 'HE':
        return ("SELECT IF(%s, CONCAT(IF(%s, 'B.', 'A.'), CHAR(92 USING latin1), 'tab Bukti Elektronik%s', CHAR(92 USING latin1), 'par'), '') AS data"
                % (ADA(p, 1), ADA(p, 0), v['gaya']))
    if j == 'LT':
        return "SELECT CONCAT(CHAR(65 + IF(%s, 1, 0) + IF(%s, 1, 0)), '.') AS data" % (ADA(p, 0), ADA(p, 1))
    raise SystemExit('jenis tak dikenal ' + j)


def nama_var(v):
    j, p = v['jenis'], PIHAK[v['pihak']]
    if j == 'DS':
        return 'BUKTI PISAH: DAFTAR BUKTI SURAT SAJA %s bernomor (OTOMATIS dari isian bukti yang tersimpan; bukti elektronik tidak ikut; kosong = tidak tercetak)' % p
    if j == 'DE':
        return 'BUKTI PISAH: DAFTAR BUKTI ELEKTRONIK SAJA %s bernomor (OTOMATIS dari isian bukti yang tersimpan; kosong = tidak tercetak)' % p
    if j == 'A':
        return 'BUKTI PISAH BAS: FRASA ALAT BUKTI %s bentuk %s (surat / elektronik / hanya saksi-saksi; OTOMATIS)' % (p, v['bentuk'])
    if j == 'SL':
        return 'BUKTI PISAH BAS: KLAUSA MENYERAHKAN BUKTI SURAT %s: "%s" (kosong bila tidak ada bukti surat: titik)' % (p, v['hadir'].strip(' .,'))
    if j == 'EI':
        return 'BUKTI PISAH BAS/PUTUSAN: PENGANTAR BUKTI ELEKTRONIK %s oleh %s (tidak tercetak bila tidak ada bukti elektronik)' % (p, v['sebut'])
    if j == 'HA':
        return 'BUKTI PISAH PUTUSAN: JUDUL SUB-BAB BUKTI SURAT %s "A. %s" (tidak tercetak bila tidak ada bukti surat)' % (p, v['judul'])
    if j == 'HE':
        return 'BUKTI PISAH PUTUSAN: JUDUL SUB-BAB BUKTI ELEKTRONIK %s gaya titik dua "%s" (huruf berurut; tidak tercetak bila tidak ada)' % (p, v['gaya'])
    if j == 'LT':
        return 'BUKTI PISAH PUTUSAN: HURUF SUB-BAB SAKSI %s (A / B / C menurut sub-bab bukti yang ada)' % p
    raise SystemExit(j)


def beri_nomor(reg):
    """Kunci -> nomor ABT. Nomor tetap dulu (selaras ekstensi), sisanya mulai 12050 menurut jenis lalu kunci."""
    nomor = {}
    for k, n in TETAP.items():
        if k in reg.idx:
            nomor[k] = n
    sisa = sorted((k for k in reg.idx if k not in nomor), key=lambda k: (URUT_JENIS.index(k[0]), [str(x) for x in k]))
    n = 12050
    for k in sisa:
        nomor[k] = n
        n += 1
    assert max(nomor.values()) <= BLOK[1], nomor
    return nomor


# ───────────────────────── berkas RTF ─────────────────────────
def aktif(rel):
    atas = rel.split('/')[0]
    return not ('terhapus' in rel.lower() or re.match(r'(ALUR|- BAS .* -$)', atas))


def baca_sasaran():
    keluar = []
    for l in open(SASARAN, encoding='utf-8'):
        if l.startswith('#') or l.startswith('kategori'):
            continue
        f = l.rstrip('\n').split('\t')
        if len(f) >= 3 and f[0].endswith('.rtf'):
            keluar.append((f[0], f[1]))
    return keluar


def baca_variabel(db):
    q = "SELECT no_var, HEX(nama), data_type, HEX(IFNULL(sql_query, '')) FROM abt_variabel ORDER BY no_var"
    r = subprocess.run([MYSQL, '-h127.0.0.1', '-uroot', '-N', '--default-character-set=latin1', db, '-e', q], capture_output=True, check=True)
    v = {}
    for l in r.stdout.decode('latin1').splitlines():
        no, nm, jt, sq = l.split('\t')
        v[int(no)] = dict(nama=bytes.fromhex(nm).decode('latin1'), jenis=jt, sql=bytes.fromhex(sq).decode('latin1'))
    return v


def jalan(db, q):
    r = subprocess.run([MYSQL, '-h127.0.0.1', '-uroot', '-N', '-r', '--default-character-set=latin1', db, '-e', q], capture_output=True, check=True)
    return r.stdout.decode('latin1').replace('\r\n', '\n')


def potongan(lama, baru):
    """Selisih dua teks -> [(offset lama, teks lama, teks baru)] (difflib atas potongan per \\pard)."""
    def pecah(s):
        return [x for x in re.split(r'(?=\\pard\b)', s)]
    a, b = pecah(lama), pecah(baru)
    off = [0]
    for x in a:
        off.append(off[-1] + len(x))
    pot = []
    for op, i1, i2, j1, j2 in difflib.SequenceMatcher(None, a, b, autojunk=False).get_opcodes():
        if op != 'equal':
            pot.append((off[i1], ''.join(a[i1:i2]), ''.join(b[j1:j2])))
    return pot


def main():
    akar, db = sys.argv[1:3]
    keluar = os.path.join(SINI, '..', 'paket-satker')
    hasil = os.path.join(SINI, '..', 'hasil')
    os.makedirs(hasil, exist_ok=True)
    var = baca_variabel(db)
    for n in range(BLOK[0], BLOK[1] + 1):
        assert n not in var, 'nomor sudah dipakai: %d' % n
    akar_d = os.path.join(akar, 'derry_briantono')
    reg = U.Reg()
    catat, gagal = [], []
    berkas = {}
    sasaran = baca_sasaran()
    ada = set()
    for d, _, fs in os.walk(panjang(akar_d)):
        for f in fs:
            if f.lower().endswith('.rtf'):
                rel = os.path.relpath(os.path.join(d, f), panjang(akar_d)).replace(os.sep, '/')
                if aktif(rel) and re.search(r'#1117[0-7]#', open(panjang(os.path.join(akar_d, rel)), 'rb').read().decode('latin1')):
                    ada.add(rel)
    assert ada == set(r for r, _ in sasaran), 'daftar sasaran awan-T11 berbeda dari berkas bermuatan #1117x#: %d vs %d' % (len(ada), len(sasaran))
    for rel, kat in sasaran:
        raw0 = open(panjang(os.path.join(akar_d, rel)), 'rb').read().decode('latin1')
        try:
            if kat == 'BAS':
                r, n, edits = U.ubah_bas(raw0, reg, catat, rel)
            else:
                r, n, edits = U.ubah_putusan(raw0, reg, catat, rel)
        except U.Lewat as e:
            gagal.append((rel, str(e)))
            catat.append((rel, 'LEWAT', str(e)[:200]))
            continue
        if seimbang(r) != seimbang(raw0):
            raise SystemExit('neraca kurung berubah: ' + rel)
        if r != raw0:
            berkas[rel] = (raw0, r, edits)
    assert not gagal, gagal[:3]
    nomor = beri_nomor(reg)
    peta = {'<<<%d>>>' % i: '#%d#' % nomor[v['kunci']] for i, v in enumerate(reg.isi)}
    rx = re.compile('|'.join(re.escape(k) for k in sorted(peta, key=len, reverse=True)))
    for rel in list(berkas):
        lama, r, edits = berkas[rel]
        r = rx.sub(lambda m: peta[m.group(0)], r)
        assert '<<<' not in r, rel
        pot = []
        for s_, e_, g_ in sorted(edits):
            g_ = rx.sub(lambda m: peta[m.group(0)], g_)
            a_ = lama[s_:e_]
            k_ = 0
            while k_ < min(len(a_), len(g_)) and a_[k_] == g_[k_]:
                k_ += 1
            z_ = 0
            while z_ < min(len(a_), len(g_)) - k_ and a_[len(a_) - 1 - z_] == g_[len(g_) - 1 - z_]:
                z_ += 1
            while k_ > 0 and a_[k_ - 1] not in ' {}\\':
                k_ -= 1
            while z_ > 0 and a_[len(a_) - z_] not in ' {}\\':
                z_ -= 1
            pot.append((s_ + k_, a_[k_:len(a_) - z_], g_[k_:len(g_) - z_]))
        berkas[rel] = (lama, r, pot)
    baru = []
    for v in sorted(reg.isi, key=lambda x: nomor[x['kunci']]):
        baru.append(dict(no=nomor[v['kunci']], nama=nama_var(v)[:200], jenis='data_sql', sql=sql_var(v), kunci=[str(x) for x in v['kunci']]))
    for x in baru:
        assert x['sql'].count("'") % 2 == 0, x['no']
        assert not re.search(r'aleta', x['nama'] + x['sql'], re.I)
    tulis(keluar, berkas, baru, sys.argv[3] if len(sys.argv) > 3 else db)
    with open(os.path.join(hasil, 'ubahan.tsv'), 'w', encoding='utf-8', newline='\n') as o:
        o.write('berkas\tbagian\tubahan\n')
        for b in catat:
            o.write('\t'.join(str(x).replace('\t', ' ').replace('\n', ' ')[:300] for x in b) + '\n')
    json.dump(baru, open(os.path.join(hasil, 'variabel.json'), 'w', encoding='utf-8', newline='\n'), ensure_ascii=False, indent=1)
    hit = collections.Counter(b[1].split(' ')[0] + ' ' + ('dibiarkan' if 'DIBIARKAN' in b[2] else 'diubah') for b in catat)
    print('berkas RTF diubah', len(berkas), '| variabel baru', len(baru), '| rentang', baru[0]['no'], '-', baru[-1]['no'])
    for k, v in sorted(hit.items()):
        print('  %4d  %s' % (v, k))


# ───────────────────────── keluaran paket ─────────────────────────
CONTOH = [
    "1. Fotokopi KTP atas nama A, bukti surat tersebut telah diberi meterai;\r\n2. Fotokopi Akta Nikah, bukti surat tersebut telah diberi meterai;\r\n3. Tangkapan layar WA, bukti elektronik tersebut telah dicocokkan;",
    "Fotokopi KTP, bukti surat tersebut diberi tanda P.1;\nFotokopi Buku Nikah, bukti surat tersebut diberi tanda P.2;\nRekaman suara, bukti elektronik tersebut diberi tanda P.3;\nsurel, bukti elektronik tersebut diberi tanda P.4;",
    "1. Tangkapan layar, bukti elektronik tersebut diberi tanda P.1;\n   2. Surel, bukti elektronik tersebut\nlanjutan baris elektronik;",
    "1. Fotokopi KTP;\n\n2. Fotokopi Akta;\n",
    "x",
]
SIDIK = "MD5(CONCAT_WS('|', nama, data_type, IFNULL(sql_query, ''), IFNULL(referensi, ''), IFNULL(multi_sidang, ''), locked, IFNULL(modifier, '')))"


def sidik_py(x):
    return md5b('|'.join([x['nama'], x['jenis'], x['sql'], '', '', '0', 'admin']).encode('latin1'))


def md5_fungsi(db):
    out = {}
    for f in NAMA_FUNGSI:
        t = jalan(db, "SELECT routine_definition FROM information_schema.routines WHERE routine_schema = DATABASE() AND routine_name = '%s'" % f)
        t = t[:-1] if t.endswith('\n') else t
        m_db = jalan(db, "SELECT MD5(routine_definition) FROM information_schema.routines WHERE routine_schema = DATABASE() AND routine_name = '%s'" % f).strip()
        out[f] = m_db
    return out


def tulis(keluar, berkas, baru, db):
    if os.path.isdir(keluar):
        shutil.rmtree(panjang(keluar))
    os.makedirs(keluar)
    shutil.copy(os.path.join(TINJAU, 'tambal_rtf.py'), os.path.join(keluar, 'tambal_rtf.py'))
    for f in ('pasang-satker.sh', 'pulih-satker.sh'):
        shutil.copy(os.path.join(SINI, f), os.path.join(keluar, f))
    shutil.copy(os.path.join(SINI, 'fungsi_baru.sql'), os.path.join(keluar, '%s-FUNGSI.sql' % N))
    with open(os.path.join(keluar, 'daftar-tambal.tsv'), 'w', encoding='utf-8', newline='\n') as d, \
            open(os.path.join(keluar, 'tambal.tsv'), 'w', encoding='utf-8', newline='\n') as t:
        d.write('# kode\tberkas\tmd5_lama\tmd5_baru\tjumlah potongan - berkas diubah HANYA bila md5 persis md5_lama (keadaan sesudah 23 paket rantai)\n')
        t.write('# kode\toffset\tb64(teks lama)\tb64(teks baru)\n')
        for i, rel in enumerate(sorted(berkas), 1):
            lama, baru_, pot = berkas[rel]
            kode = 'B%04d' % i
            h = lama
            for o_, l_, n_ in sorted(pot, key=lambda x: -x[0]):
                assert h[o_:o_ + len(l_)] == l_
                h = h[:o_] + n_ + h[o_ + len(l_):]
            assert h == baru_, rel
            d.write('%s\tderry_briantono/%s\t%s\t%s\t%d\n' % (kode, rel, md5b(lama.encode('latin1')), md5b(baru_.encode('latin1')), len(pot)))
            for o_, l_, n_ in pot:
                t.write('%s\t%d\t%s\t%s\n' % (kode, o_, base64.b64encode(l_.encode('latin1')).decode('ascii'), base64.b64encode(n_.encode('latin1')).decode('ascii')))
    nb = [x['no'] for x in baru]
    kepala = '-- Paket ABT "%s" (1 Nov 2026): bukti surat dan bukti elektronik dicetak terpisah (BAS pembuktian dan putusan). Hanya derry_briantono.\n' % N
    open(os.path.join(keluar, 'nomor-variabel.txt'), 'w', newline='\n').write('# variabel BARU\n' + ''.join('%d\n' % n for n in nb))
    nl = ' UNION ALL '.join("SELECT %d AS n, '%s' AS h" % (x['no'], sidik_py(x)) for x in baru)
    sv = SIDIK.replace("nama", "v.nama").replace("data_type", "v.data_type").replace("sql_query", "v.sql_query").replace("referensi", "v.referensi") \
        .replace("multi_sidang", "v.multi_sidang").replace("locked", "v.locked").replace("modifier", "v.modifier")
    mf = md5_fungsi(db)
    cf = ' OR '.join("(routine_name = '%s' AND MD5(routine_definition) = '%s')" % (f, mf[f]) for f in NAMA_FUNGSI)
    nf = ', '.join("'%s'" % f for f in NAMA_FUNGSI)
    pras = kepala + ('-- PRASYARAT "A|B|C|D|E": A = nomor %d-%d berisi lain dari paket (0) | B = variabel paket persis (0 pasang pertama / %d pasang ulang) | '
                     'C = fungsi paket persis (0 / 3) | D = fungsi yang dipakai ada: isian_rtf_bukti, isian_rtf_bukti_nomor, isian_rtf_butir_rapi (3) | '
                     'E = fungsi bernama sama tetapi isi lain (0)\n' % (BLOK[0], BLOK[1], len(nb)))
    pras += ("SELECT CONCAT_WS('|',\n (SELECT COUNT(*) FROM abt_variabel v WHERE v.no_var BETWEEN %d AND %d AND NOT EXISTS (SELECT 1 FROM (%s) p WHERE p.n = v.no_var AND p.h = %s)),\n"
             " (SELECT COUNT(*) FROM abt_variabel v JOIN (%s) p ON p.n = v.no_var AND p.h = %s),\n"
             " (SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema = DATABASE() AND (%s)),\n"
             " (SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema = DATABASE() AND routine_name IN ('isian_rtf_bukti', 'isian_rtf_bukti_nomor', 'isian_rtf_butir_rapi')),\n"
             " (SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema = DATABASE() AND routine_name IN (%s) AND NOT (%s))) AS p;\n"
             % (BLOK[0], BLOK[1], nl, sv, nl, sv, cf, nf, cf))
    open(os.path.join(keluar, '%s-PRASYARAT.sql' % N), 'w', encoding='latin1', newline='\n').write(pras)
    open(os.path.join(keluar, 'harap.txt'), 'w', newline='\n').write('0|0|0|3|0\n0|%d|3|3|0\n' % len(nb))
    p = [kepala, 'START TRANSACTION;\n']
    for x in baru:
        p.append("INSERT INTO abt_variabel (no_var, nama, data_type, data_tabel, data_kolom, urutan_data, referensi, sql_query, default_data, multi_sidang, locked, modifier, modified) "
                 "SELECT %d, %s, '%s', NULL, NULL, NULL, NULL, %s, NULL, NULL, 0, 'admin', '%s' FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM abt_variabel WHERE no_var = %d);\n"
                 % (x['no'], hexs(x['nama']), x['jenis'], hexs(x['sql']), TANGGAL, x['no']))
    p.append('COMMIT;\n')
    open(os.path.join(keluar, '%s-PASANG.sql' % N), 'w', encoding='latin1', newline='\n').write(''.join(p))
    bag = ["SELECT 'var %d' AS label, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = %d AND %s = '%s') AS ok" % (x['no'], x['no'], SIDIK, sidik_py(x)) for x in baru]
    bag += ["SELECT 'fungsi %s' AS label, (SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema = DATABASE() AND routine_name = '%s' AND MD5(routine_definition) = '%s') AS ok"
            % (f, f, mf[f]) for f in NAMA_FUNGSI]
    q = kepala + 'SELECT label, ok FROM (\n' + '\nUNION ALL '.join(bag) + '\n) x WHERE ok <> 1\nUNION ALL SELECT IF((SELECT COUNT(*) FROM (' + \
        '\nUNION ALL '.join(bag) + ") y WHERE y.ok <> 1) = 0, 'SEMUA COCOK', 'ADA BEDA'), '';\n"
    open(os.path.join(keluar, '%s-PERIKSA.sql' % N), 'w', encoding='latin1', newline='\n').write(q)
    r = [kepala, 'START TRANSACTION;\n']
    r += ["DELETE FROM abt_variabel WHERE no_var = %d AND %s = '%s';\n" % (x['no'], SIDIK, sidik_py(x)) for x in baru]
    r.append('COMMIT;\n')
    open(os.path.join(keluar, '%s-PULIH.sql' % N), 'w', encoding='latin1', newline='\n').write(''.join(r))
    # fungsi dihapus HANYA bila isinya persis isi paket (diperiksa pulih-satker.sh lewat PRASYARAT kolom C)
    with open(os.path.join(keluar, '%s-FUNGSI-PULIH.sql' % N), 'w', encoding='latin1', newline='\n') as o:
        o.write(kepala)
        for f in reversed(NAMA_FUNGSI):
            o.write('DROP FUNCTION IF EXISTS %s;\n' % f)
    with open(os.path.join(keluar, 'uji-fungsi.tsv'), 'w', encoding='utf-8', newline='\n') as o:
        for teks_ in CONTOH:
            hx = teks_.encode('latin1').hex()
            for fn, jenis in (('isian_bukti_baris', 0), ('isian_bukti_baris', 1), ('isian_bukti_rtf', 0), ('isian_bukti_rtf', 1)):
                h = jalan(db, "SELECT MD5(%s(CONVERT(UNHEX('%s') USING latin1), %d))" % (fn, hx, jenis)).strip()
                o.write('%s\t%d\t%s\t%s\n' % (hx, jenis, fn, h))
    with open(os.path.join(keluar, 'uji-kueri.tsv'), 'w', encoding='utf-8', newline='\n') as o:
        for x in baru:
            o.write('%d\t%s\n' % (x['no'], base64.b64encode(x['sql'].encode('latin1')).decode('ascii')))
    semua = []
    for d_, _, fs in os.walk(panjang(keluar)):
        for f in fs:
            if f != 'MD5SUMS.txt':
                p_ = os.path.join(d_, f)
                semua.append((os.path.relpath(p_, panjang(keluar)).replace(os.sep, '/'), md5b(open(p_, 'rb').read())))
    with open(os.path.join(keluar, 'MD5SUMS.txt'), 'w', newline='\n') as o:
        for rel, m in sorted(semua):
            o.write('%s  %s\n' % (m, rel))


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    main()
