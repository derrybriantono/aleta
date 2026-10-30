# -*- coding: utf-8 -*-
"""Bangun paket ABT hir-rbg-30okt (G6, 30 Okt 2026) secara DETERMINISTIK dari keadaan SESUDAH semua paket 29-30 Okt.

pakai: python bangun_paket.py <akar _blangko_abt sesudah semua paket> <basis ABT sesudah semua paket> [<keluar paket-satker>]
  (laptop: D:/Aplikasi/aleta/tmp/g6/blangko  aps_badilag_g6)

Isi paket:
  6.1  variabel BARU #11850# (hukum acara satker), #11851# (singkatan RBg/HIR), #11852#.. (nomor pasal / ayat padanan PASTI);
       rujukan "Pasal ... RBg" di blangko Derry AKTIF dan di kueri variabel diganti variabel padanan HANYA bila semua pasal/ayatnya
       pasti (sumber/padanan.py). Untuk satker RBg keluaran identik (variabel menghasilkan teks yang sama persis).
  6.2  titik koma salah tanda baca di teks RTF sumber (sumber/titik_koma.py) - hanya golongan "salah tanda baca"; ditulis sebagai
       PAKET TERPISAH ../titik-koma-teks-30okt (dipasang sesudah paket ini; md5_lama = keadaan sesudah paket ini).
  6.3  perbaikan variabel rusak (sumber/variabel_rusak.py) bila ada.
Semua berkas yang diganti: md5_lama = keadaan sesudah semua paket lain (urutan pasang: PALING AKHIR).
"""
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys

SINI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, SINI)
import ganti_pasal as G  # noqa: E402
from padanan import PASAL  # noqa: E402

MYSQL = r'D:\Satker Asal\Website PA Bungku\xampp\mysql\bin\mysql.exe'
N = 'abt-hir-rbg-30okt'
TANGGAL = '2026-10-30 00:00:00'
UU_ACARA = {'RBg': 'RBg', 'HIR': 'HIR'}


def panjang(p):
    p = os.path.abspath(p)
    a = chr(92) * 2 + '?' + chr(92)
    return p if p.startswith(a) else a + p


def md5b(b):
    return hashlib.md5(b).hexdigest()


def aktif(rel):
    bag = rel.split('/')
    atas = bag[0]
    return not ('terhapus' in rel.lower() or re.match(r'(ALUR|- BAS .* -$)', atas))


def baca_variabel(db):
    q = ("SELECT no_var, HEX(nama), data_type, HEX(IFNULL(sql_query, '')), IFNULL(sql_query, '') IS NULL, IFNULL(modifier, ''), "
         "MD5(IFNULL(sql_query, '')), MD5(nama) FROM abt_variabel ORDER BY no_var")
    r = subprocess.run([MYSQL, '-h127.0.0.1', '-uroot', '-N', '--default-character-set=latin1', db, '-e', q], capture_output=True, check=True)
    v = {}
    for l in r.stdout.decode('latin1').splitlines():
        no, nm, jt, sq, _, mod, m5, m5n = l.split('\t')
        v[int(no)] = dict(nama=bytes.fromhex(nm).decode('latin1'), jenis=jt, sql=bytes.fromhex(sq).decode('latin1'), pemilik=mod, md5sql=m5, md5nama=m5n)
    return v


def daftar_rtf(akar_derry):
    hasil = []
    for d, _, fs in os.walk(panjang(akar_derry)):
        for f in fs:
            if f.lower().endswith('.rtf'):
                p = os.path.join(d, f)
                rel = os.path.relpath(p, panjang(akar_derry)).replace(os.sep, '/')
                hasil.append(rel)
    return sorted(hasil)


def var_penanda():
    """Definisi #11850# dan #11851#."""
    prov = "LOWER('#9276#')"
    syarat = ' OR '.join("%s LIKE '%%%s%%'" % (prov, k) for k in ('jawa', 'jakarta', 'yogyakarta', 'banten', 'madura'))
    v11850 = dict(no=G.NO_PENANDA,
                  nama='SATKER: HUKUM ACARA PERDATA (OTOMATIS dari provinsi satker #9276#: Jawa, DKI Jakarta, DI Yogyakarta, Banten = HIR; '
                       'selain itu RBg; Super Admin dapat menetapkan di Identitas satker)',
                  sql=("SELECT CASE (SELECT TRIM(value) FROM sys_config WHERE name = 'KodePN' LIMIT 1) WHEN '' THEN 'RBg' "
                       "ELSE IF(%s, 'HIR', 'RBg') END AS data" % syarat))
    v11851 = dict(no=G.NO_KODE, nama='ACARA: SINGKATAN HUKUM ACARA DI RUJUKAN PASAL (OTOMATIS #11850#: RBg / HIR)',
                  sql="SELECT IF('#11850#' = 'HIR', 'HIR', 'RBg') AS data")
    v11852 = dict(no=G.NO_WILAYAH, nama='ACARA: WILAYAH BERLAKUNYA HUKUM ACARA ("di luar Jawa dan Madura" = RBg / "di Jawa dan Madura" = HIR; OTOMATIS #11850#)',
                  sql="SELECT IF('#11850#' = 'HIR', 'di Jawa dan Madura', 'di luar Jawa dan Madura') AS data")
    return [v11850, v11851, v11852]


def var_padanan(alokasi):
    keluar = []
    for rbg, no in alokasi.pasal.items():
        e = PASAL[rbg]
        nama = 'ACARA: NOMOR PASAL %s (Pasal %s RBg = Pasal %s HIR; OTOMATIS #11850#)' % (e['pokok'].upper(), rbg, e['hir'])
        keluar.append(dict(no=no, nama=nama[:200], sql="SELECT IF('#11850#' = 'HIR', '%s', '%s') AS data" % (e['hir'], rbg)))
    for (rbg, ayat), no in alokasi.ayat.items():
        e = PASAL[rbg]
        hir_a = e['ayat'][ayat]
        nama = 'ACARA: NOMOR AYAT %s (Pasal %s ayat (%s) RBg = Pasal %s ayat (%s) HIR; OTOMATIS #11850#)' % (e['pokok'].upper(), rbg, ayat, e['hir'], hir_a)
        keluar.append(dict(no=no, nama=nama[:200], sql="SELECT IF('#11850#' = 'HIR', '%s', '%s') AS data" % (hir_a, ayat)))
    return sorted(keluar, key=lambda x: x['no'])


def alokasi_urut(rujukan_pasti):
    """Nomor variabel menurut urutan pasal (bukan urutan temuan) - stabil walau urutan berkas berubah."""
    pasal = sorted({p for p, _ in rujukan_pasti if _ is None}, key=lambda x: (int(re.match(r'\d+', x).group()), x))
    ayat = sorted({(p, a) for p, a in rujukan_pasti if a is not None}, key=lambda x: (int(re.match(r'\d+', x[0]).group()), int(x[1])))
    A = G.Alokasi()
    for p in pasal:
        A.no_pasal(p)
    for p, a in ayat:
        A.no_ayat(p, a)
    return A


class Pengumpul:
    """Alokasi pura-pura untuk lintasan pertama: mencatat pasal & ayat-beda yang dipakai."""

    def __init__(self):
        self.pakai = set()

    def no_pasal(self, p):
        self.pakai.add((p, None))
        return 0

    def no_ayat(self, p, a):
        self.pakai.add((p, a))
        return 0


def main():
    akar, db = sys.argv[1:3]
    keluar = sys.argv[3] if len(sys.argv) > 3 else os.path.join(SINI, '..', 'paket-satker')
    hasil_dir = os.path.join(SINI, '..', 'hasil')
    akar_derry = os.path.join(akar, 'derry_briantono')
    var = baca_variabel(db)
    rtf = [r for r in daftar_rtf(akar_derry) if aktif(r)]
    isi = {r: open(panjang(os.path.join(akar_derry, r)), 'rb').read().decode('latin1') for r in rtf}

    import titik_koma as TK  # noqa: E402
    import variabel_rusak as VR  # noqa: E402
    TK.BARIS_BARU = {no for no, v in var.items() if v['jenis'] == 'data_sql' and TK.mulai_baris_baru(v['sql'])}

    # --- lintasan 1: pasal/ayat yang dipakai ---
    kum = Pengumpul()
    for r in rtf:
        G.ganti_rtf(isi[r], kum, [])
    for no, v in var.items():
        if v['jenis'] == 'data_sql' and v['sql'] and no not in range(11850, 11900):
            G.ganti_teks(v['sql'], kum, [])
    A = alokasi_urut(kum.pakai)

    # --- lintasan 2: ganti ---
    rujukan = []  # (tempat, asal, hasil, sebab)
    baru_rtf = {}
    tk_rtf = {}  # 6.2: rel -> (isi sesudah paket hir-rbg, isi sesudah perbaikan titik koma) - paket TERPISAH titik-koma-teks-30okt
    tk_catat = []
    nilai_rbg = {G.NO_KODE: 'RBg', G.NO_WILAYAH: 'di luar Jawa dan Madura'}
    nilai_rbg.update({no: p for p, no in A.pasal.items()})
    nilai_rbg.update({no: a for (p, a), no in A.ayat.items()})

    def sebagai_rbg(t):
        return re.sub(r'#(118[5-9]\d)#', lambda m: nilai_rbg[int(m.group(1))], t)

    def tanpa_baris(t):
        return t.replace('\r', '').replace('\n', '')

    for r in rtf:
        c = []
        u = G.rencana_rtf(isi[r], A, c)
        t = G.terapkan(isi[r], u)
        # BUKTI IDENTIK (semua perkara): padanan diisi nilai RBg = RTF lama persis (selain putus baris berkas yang tak bermakna di RTF)
        assert tanpa_baris(sebagai_rbg(t)) == tanpa_baris(isi[r]), r
        rujukan += [('rtf', r, a, h, s) for a, h, s in c]
        if t != isi[r]:
            baru_rtf[r] = (isi[r], t, u)
        u2 = TK.rencana(r, t, tk_catat)
        if u2:
            tk_rtf[r] = (t, G.terapkan(t, u2), u2)
    ubah_var = {}
    for no, v in sorted(var.items()):
        if v['jenis'] != 'data_sql' or not v['sql'] or 11850 <= no <= 11899:
            continue
        c = []
        s = G.ganti_teks(v['sql'], A, c)
        assert sebagai_rbg(s) == v['sql'], no  # kueri dengan padanan RBg = kueri lama persis
        rujukan += [('var', '#%d#' % no, a, h, sb) for a, h, sb in c]
        nama = v['nama']
        if s != v['sql'] and ' - belum dipakai' in nama:
            nama = nama.replace(' - belum dipakai', ' - otomatis lewat #11850#')[:200]
        if s != v['sql']:
            ubah_var[no] = dict(sql=s, nama=nama, lama=v)
    for no, perbaikan in VR.PERBAIKAN.items():
        v = var[no]
        sql_baru = perbaikan(v['sql'])
        u = ubah_var.get(no, dict(sql=v['sql'], nama=v['nama'], lama=v))
        u['sql'] = perbaikan(u['sql'])
        assert u['sql'] != v['sql'] or sql_baru == v['sql']
        ubah_var[no] = u
    var_baru = var_penanda() + var_padanan(A)
    for x in var_baru:
        assert 11850 <= x['no'] <= 11899 and len(x['nama']) <= 200 and 'aleta' not in (x['nama'] + x['sql']).lower()
        assert x['no'] not in var, 'nomor %d sudah dipakai di basis' % x['no']
    for no, u in ubah_var.items():
        assert 'aleta' not in (u['nama'] + u['sql']).lower()

    tulis_paket(keluar, var_baru, ubah_var, baru_rtf, isi)
    keluar_tk = sys.argv[4] if len(sys.argv) > 4 else os.path.join(SINI, '..', '..', 'titik-koma-teks-30okt', 'paket-satker')
    tulis_paket_berkas(keluar_tk, tk_rtf)
    os.makedirs(hasil_dir, exist_ok=True)
    json.dump([dict(no=x['no'], nama=x['nama'], sql=x['sql']) for x in var_baru], open(os.path.join(hasil_dir, 'variabel.json'), 'w', encoding='utf-8', newline='\n'),
              ensure_ascii=False, indent=1)
    with open(os.path.join(hasil_dir, 'rujukan-diganti.tsv'), 'w', encoding='utf-8', newline='\n') as o:
        o.write('jenis\ttempat\trujukan asal\tpengganti\tsebab tidak diganti\n')
        for b in rujukan:
            o.write('\t'.join(x or '' for x in b) + '\n')
    with open(os.path.join(hasil_dir, 'titik-koma-diperbaiki.tsv'), 'w', encoding='utf-8', newline='\n') as o:
        o.write('berkas\tsebelum\tsesudah\n')
        for b in tk_catat:
            o.write('\t'.join(b) + '\n')
    ganti = sum(1 for b in rujukan if b[3])
    print('variabel baru', len(var_baru), '(%d-%d)' % (var_baru[0]['no'], var_baru[-1]['no']), '| variabel diubah', len(ubah_var),
          '| berkas RTF diubah', len(baru_rtf), '| rujukan diganti', ganti, 'dari', len(rujukan), '| titik koma diperbaiki', len(tk_catat))


def hexs(s):
    return '0x' + s.encode('latin1').hex() if s else "''"


def tulis_md5sums(keluar):
    semua = []
    for d, _, fs in os.walk(panjang(keluar)):
        for f in fs:
            if f == 'MD5SUMS.txt':
                continue
            p_ = os.path.join(d, f)
            rel = os.path.relpath(p_, panjang(keluar)).replace(os.sep, '/')
            semua.append((rel, md5b(open(p_, 'rb').read())))
    with open(os.path.join(keluar, 'MD5SUMS.txt'), 'w', encoding='utf-8', newline='\n') as o:
        for rel, m in sorted(semua):
            o.write('%s  %s\n' % (m, rel))


def tulis_tambal(keluar, berkas, awalan):
    """berkas: rel -> (isi_lama, isi_baru, ubahan[(awal, akhir, pengganti)]). Menulis daftar-tambal.tsv + tambal.tsv (potongan, bukan
    salinan utuh); diperiksa: menerapkan potongan atas isi lama = isi baru persis."""
    import base64
    with open(os.path.join(keluar, 'daftar-tambal.tsv'), 'w', encoding='utf-8', newline='\n') as d, \
            open(os.path.join(keluar, 'tambal.tsv'), 'w', encoding='utf-8', newline='\n') as t:
        d.write('# kode\tberkas\tmd5_lama\tmd5_baru\tjumlah potongan - berkas diubah HANYA bila md5 persis md5_lama\n')
        t.write('# kode\toffset\tb64(teks lama)\tb64(teks baru) - offset atas berkas lama, diterapkan dari belakang\n')
        for i, r in enumerate(sorted(berkas), 1):
            lama, baru, ubah = berkas[r]
            kode = '%s%04d' % (awalan, i)
            hasil = lama
            for s_, e_, ganti in sorted(ubah, key=lambda x: -x[0]):
                hasil = hasil[:s_] + ganti + hasil[e_:]
            assert hasil == baru, r
            d.write('%s\tderry_briantono/%s\t%s\t%s\t%d\n' % (kode, r, md5b(lama.encode('latin1')), md5b(baru.encode('latin1')), len(ubah)))
            for s_, e_, ganti in ubah:
                t.write('%s\t%d\t%s\t%s\n' % (kode, s_, base64.b64encode(lama[s_:e_].encode('latin1')).decode('ascii'),
                                                 base64.b64encode(ganti.encode('latin1')).decode('ascii')))


def tulis_paket_berkas(keluar, tk_rtf):
    """Paket titik-koma-teks-30okt (6.2): hanya berkas RTF; md5_lama = keadaan SESUDAH paket hir-rbg-30okt."""
    if os.path.isdir(keluar):
        shutil.rmtree(panjang(keluar))
    os.makedirs(keluar)
    shutil.copy(os.path.join(SINI, 'tambal_rtf.py'), os.path.join(keluar, 'tambal_rtf.py'))
    for f in ('pasang-berkas.sh', 'pulih-berkas.sh'):
        shutil.copy(os.path.join(SINI, f), os.path.join(keluar, f.replace('-berkas', '-satker')))
    tulis_tambal(keluar, tk_rtf, 'T')
    tulis_md5sums(keluar)


def tulis_paket(keluar, var_baru, ubah_var, baru_rtf, isi):
    if os.path.isdir(keluar):
        shutil.rmtree(panjang(keluar))
    os.makedirs(keluar)
    shutil.copy(os.path.join(SINI, 'tambal_rtf.py'), os.path.join(keluar, 'tambal_rtf.py'))
    for f in ('pasang-satker.sh', 'pulih-satker.sh'):
        shutil.copy(os.path.join(SINI, f), os.path.join(keluar, f))
    tulis_tambal(keluar, baru_rtf, 'H')
    nomor_baru = [x['no'] for x in var_baru]
    open(os.path.join(keluar, 'nomor-variabel.txt'), 'w', encoding='utf-8', newline='\n').write('# variabel BARU paket ini\n' + ''.join('%d\n' % n for n in nomor_baru))
    open(os.path.join(keluar, 'nomor-diubah.txt'), 'w', encoding='utf-8', newline='\n').write('# variabel LAMA yang kuerinya diubah\n' + ''.join('%d\n' % n for n in sorted(ubah_var)))
    sidik = "MD5(CONCAT_WS('|', nama, data_type, IFNULL(sql_query, ''), IFNULL(referensi, ''), IFNULL(multi_sidang, ''), locked, IFNULL(modifier, '')))"

    def sidik_py(x):
        return md5b('|'.join([x['nama'], 'data_sql', x['sql'], '', '', '0', 'admin']).encode('latin1'))

    kepala = ('-- Paket ABT "%s" (30 Okt 2026, G6): hukum acara satker RBg/HIR (#11850#) + variabel padanan pasal %d-%d, rujukan pasal pasti di '
              'blangko Derry dan kueri variabel diganti padanan (yang belum pasti tetap RBg). Hanya pengguna derry_briantono.\n'
              % (N, nomor_baru[0], nomor_baru[-1]))
    uv = sorted(ubah_var.items())
    # PRASYARAT A|B|C|D|E
    nl = ' UNION ALL '.join("SELECT %d AS n, '%s' AS h" % (x['no'], sidik_py(x)) for x in var_baru)
    lama_c = ' OR '.join("(no_var = %d AND MD5(IFNULL(sql_query, '')) = '%s' AND MD5(nama) = '%s')" % (no, u['lama']['md5sql'], u['lama']['md5nama']) for no, u in uv)
    baru_d = ' OR '.join("(no_var = %d AND MD5(IFNULL(sql_query, '')) = '%s' AND MD5(nama) = '%s')" % (no, md5b(u['sql'].encode('latin1')), md5b(u['nama'].encode('latin1'))) for no, u in uv)
    pras = kepala + (
        '-- PRASYARAT (baca saja) "A|B|C|D|E": A = nomor 11850-11899 yang ada tetapi BUKAN isi paket (harus 0) | B = variabel baru paket yang sudah persis (0 pertama, %d ulang) | '
        'C = variabel lama yang akan diubah dan masih PERSIS keadaan dasar (%d pertama, 0 ulang) | D = variabel lama yang sudah persis isi baru (0 pertama, %d ulang) | '
        'E = variabel #9276# provinsi satker ada (1).\n' % (len(var_baru), len(uv), len(uv)))
    pras += ("SELECT CONCAT_WS('|',\n  (SELECT COUNT(*) FROM abt_variabel v WHERE v.no_var BETWEEN 11850 AND 11899 AND NOT EXISTS (SELECT 1 FROM (%s) p WHERE p.n = v.no_var AND p.h = %s)),\n"
             "  (SELECT COUNT(*) FROM abt_variabel v JOIN (%s) p ON p.n = v.no_var AND p.h = %s),\n"
             "  (SELECT COUNT(*) FROM abt_variabel WHERE %s),\n  (SELECT COUNT(*) FROM abt_variabel WHERE %s),\n"
             "  (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 9276)) AS p;\n"
             % (nl, sidik.replace('nama', 'v.nama').replace('data_type', 'v.data_type').replace('sql_query', 'v.sql_query').replace('referensi', 'v.referensi')
                .replace('multi_sidang', 'v.multi_sidang').replace('locked', 'v.locked').replace('modifier', 'v.modifier'), nl,
                sidik.replace('nama', 'v.nama').replace('data_type', 'v.data_type').replace('sql_query', 'v.sql_query').replace('referensi', 'v.referensi')
                .replace('multi_sidang', 'v.multi_sidang').replace('locked', 'v.locked').replace('modifier', 'v.modifier'), lama_c or '0', baru_d or '0'))
    open(os.path.join(keluar, '%s-PRASYARAT.sql' % N), 'w', encoding='latin1', newline='\n').write(pras)
    open(os.path.join(keluar, 'harap.txt'), 'w', encoding='utf-8', newline='\n').write('0|0|%d|0|1\n0|%d|0|%d|1\n' % (len(uv), len(var_baru), len(uv)))
    # PASANG
    p = [kepala, '-- PASANG: satu transaksi; baris baru INSERT ... WHERE NOT EXISTS; variabel lama diubah HANYA bila kuerinya persis dasar (md5).\n', 'START TRANSACTION;\n']
    for x in var_baru:
        p.append("INSERT INTO abt_variabel (no_var, nama, data_type, data_tabel, data_kolom, urutan_data, referensi, sql_query, default_data, multi_sidang, locked, modifier, modified) "
                 "SELECT %d, %s, 'data_sql', NULL, NULL, NULL, NULL, %s, NULL, NULL, 0, 'admin', '%s' FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM abt_variabel WHERE no_var = %d);\n"
                 % (x['no'], hexs(x['nama']), hexs(x['sql']), TANGGAL, x['no']))
    for no, u in uv:
        p.append("UPDATE abt_variabel SET sql_query = %s, nama = %s WHERE no_var = %d AND MD5(IFNULL(sql_query, '')) = '%s' AND MD5(nama) = '%s';\n"
                 % (hexs(u['sql']), hexs(u['nama']), no, u['lama']['md5sql'], u['lama']['md5nama']))
    p.append('COMMIT;\n')
    open(os.path.join(keluar, '%s-PASANG.sql' % N), 'w', encoding='latin1', newline='\n').write(''.join(p))
    # PERIKSA
    q = [kepala, '-- PERIKSA (baca saja): baris terakhir harus SEMUA COCOK\nSELECT label, ok FROM (\n']
    bag = []
    for x in var_baru:
        bag.append("SELECT 'var %d' AS label, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = %d AND %s = '%s') AS ok" % (x['no'], x['no'], sidik, sidik_py(x)))
    for no, u in uv:
        bag.append("SELECT 'ubah %d' AS label, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = %d AND MD5(IFNULL(sql_query, '')) = '%s' AND MD5(nama) = '%s') AS ok"
                   % (no, no, md5b(u['sql'].encode('latin1')), md5b(u['nama'].encode('latin1'))))
    q.append('\nUNION ALL '.join(bag))
    q.append('\n) x WHERE ok <> 1\nUNION ALL SELECT IF((SELECT COUNT(*) FROM (%s) y WHERE y.ok <> 1) = 0, \'SEMUA COCOK\', \'ADA BEDA\'), \'\';\n' % '\nUNION ALL '.join(bag))
    open(os.path.join(keluar, '%s-PERIKSA.sql' % N), 'w', encoding='latin1', newline='\n').write(''.join(q))
    # PULIH: baris baru dihapus bila masih persis paket; variabel lama dikembalikan bila masih persis isi paket
    r = [kepala, '-- PULIH (deterministik): yang sudah disunting orang sesudah dipasang DIBIARKAN (dilaporkan pulih-satker.sh).\n', 'START TRANSACTION;\n']
    for x in var_baru:
        r.append("DELETE FROM abt_variabel WHERE no_var = %d AND %s = '%s';\n" % (x['no'], sidik, sidik_py(x)))
    for no, u in uv:
        r.append("UPDATE abt_variabel SET sql_query = %s, nama = %s WHERE no_var = %d AND MD5(IFNULL(sql_query, '')) = '%s' AND MD5(nama) = '%s';\n"
                 % (hexs(u['lama']['sql']), hexs(u['lama']['nama']), no, md5b(u['sql'].encode('latin1')), md5b(u['nama'].encode('latin1'))))
    r.append('COMMIT;\n')
    open(os.path.join(keluar, '%s-PULIH.sql' % N), 'w', encoding='latin1', newline='\n').write(''.join(r))
    tulis_md5sums(keluar)


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    main()
