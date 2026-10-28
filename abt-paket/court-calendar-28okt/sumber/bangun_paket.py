# -*- coding: utf-8 -*-
"""Bangun isi paket-satker/ paket abt-court-calendar-28okt: RTF (bangun_rtf.py), daftar-rtf.tsv, SQL (PRASYARAT, PASANG, PERIKSA, PULIH), MD5SUMS.
pakai: python sumber/bangun_paket.py   (dari folder paket; sumber BAS: ABT lokal, lihat bangun_rtf.py)"""
import hashlib
import os
import re
import shutil
import subprocess
import sys

AL = os.path.dirname(os.path.abspath(__file__))
PAKET = os.path.dirname(AL)
PS = os.path.join(PAKET, 'paket-satker')
N = 'abt-court-calendar-28okt'
FOLDER = '98c Court Calendar - BAS'
INDUK = 'derry_briantono'
ALUR04 = 'ALUR 04 Cerai Kontra Tertulis (Mediasi s.d. Putusan)'

# Hak menu = SAMA dengan menu id 963 (BAS Alur 04 - Cerai Kontradiktoir Tertulis): tempat BAS 2 dan BAS 3 yang memuat court calendar.
HAK = dict(proses_id_min=80, proses_id_max=297, perkara_id_min=15, perkara_id_max=15, perkara_id_referensi='alur_perkara_id', user_cek=3,
           user_grup_id='1|30|500|430|1000|1010|1020', user_top_id='1|30', user_validator='10|20')
MENU = dict(nama='BAS Court Calendar (Jadwal Persidangan)', nama_alias='BAS Court Calendar', direktori=FOLDER, parent_direktori=INDUK, **HAK)
KOLOM = ['nama', 'nama_alias', 'direktori', 'parent_direktori', 'proses_id_min', 'proses_id_max', 'perkara_id_min', 'perkara_id_max',
         'perkara_id_referensi', 'user_cek', 'user_grup_id', 'user_top_id', 'user_validator']
HARAP_VARIABEL = 37


def md5b(b):
    return hashlib.md5(b).hexdigest()


def tulis(nama, isi):
    with open(os.path.join(PS, nama), 'wb') as f:
        f.write(isi.encode('utf-8'))


def q(s):
    return "'" + s.replace("'", "''") + "'"


def md5_menu_sql(alias=''):
    a = alias + '.' if alias else ''
    return 'MD5(CONCAT_WS(\'|\', ' + ', '.join(('IFNULL(%suser_validator,\'\')' % a) if k == 'user_validator' else a + k for k in KOLOM) + '))'


def md5_menu_nilai():
    return md5b('|'.join(str(MENU[k]) for k in KOLOM).encode('latin1'))


def main():
    subprocess.run([sys.executable, os.path.join(AL, 'bangun_rtf.py')] + sys.argv[1:], check=True)
    shutil.copyfile(os.path.join(AL, 'berkas_rtf.py'), os.path.join(PS, 'berkas_rtf.py'))
    # variabel yang dirujuk kedua blangko (kode #nnnn#), ditulis dengan akhir baris LF agar md5 sama sesudah checkout git
    kode = set()
    for berkas in os.listdir(os.path.join(PS, 'rtf', INDUK, FOLDER)):
        kode |= set(re.findall(r'#(\d{1,5})#', open(os.path.join(PS, 'rtf', INDUK, FOLDER, berkas), 'rb').read().decode('latin1')))
    nomor = ','.join(sorted(kode, key=int))
    with open(os.path.join(PS, 'nomor-variabel.txt'), 'wb') as fh:
        fh.write((nomor + '\n').encode('ascii'))
    assert len(nomor.split(',')) == HARAP_VARIABEL, len(nomor.split(','))
    # daftar berkas
    baris = ['# folder<TAB>berkas<TAB>md5<TAB>asal - berkas BARU dari <paket>/rtf/ (tidak pernah menimpa berkas lain)']
    akar = os.path.join(PS, 'rtf', INDUK, FOLDER)
    for f in sorted(os.listdir(akar)):
        baris.append('%s/%s\t%s\t%s\tdibangun sumber/bangun_rtf.py dari bagian court calendar BAS 2 dan BAS 3 (28 Okt 2026)' % (INDUK, FOLDER, f, md5b(open(os.path.join(akar, f), 'rb').read())))
    # urutan kolom tsv: folder, berkas, md5, asal
    baris = [baris[0]] + ['\t'.join([x.split('\t')[0], x.split('\t')[1], x.split('\t')[2], x.split('\t')[3]]) for x in baris[1:]]
    tulis('daftar-rtf.tsv', '\n'.join(baris) + '\n')
    tulis('folder-ada.txt', '# folder (relatif _blangko_abt) yang harus SUDAH ada\n%s\n%s/%s\n' % (INDUK, INDUK, ALUR04))
    tulis('folder-baru.txt', '# folder BARU (relatif _blangko_abt) yang dibuat paket ini; dihapus pulih-satker.sh bila kosong\n%s/%s\n' % (INDUK, FOLDER))

    kepala = ('-- Paket ABT "%s" (28 Okt 2026): blangko Court Calendar (penetapan jadwal persidangan dan perubahan jadwal karena gugatan rekonvensi), '
              'folder baru "%s", satu baris abt_menu, dua blangko RTF. Tanpa variabel/fungsi baru.\n' % (N, FOLDER))
    # PRASYARAT
    hak_963 = ' AND '.join('m.%s = %s' % (k, q(str(v)) if isinstance(v, str) else v) for k, v in HAK.items())
    tulis('%s-PRASYARAT.sql' % N, kepala +
          '-- PRASYARAT (baca saja) "A|B|C": A = variabel yang dirujuk kedua blangko ADA di abt_variabel (harus %d) | B = baris abt_menu folder baru (0 pertama, 1 sudah terpasang) | '
          'C = menu id 963 (folder %s) ada dengan hak persis seperti yang disalin ke menu baru (harus 1).\n' % (HARAP_VARIABEL, ALUR04) +
          '-- Benar: "%d|0|1" (pasang pertama) atau "%d|1|1" (pasang ulang).\n' % (HARAP_VARIABEL, HARAP_VARIABEL) +
          "SELECT CONCAT_WS('|',\n"
          "  (SELECT COUNT(*) FROM abt_variabel WHERE no_var IN (%s)),\n" % nomor +
          "  (SELECT COUNT(*) FROM abt_menu WHERE direktori = %s AND parent_direktori = %s),\n" % (q(FOLDER), q(INDUK)) +
          "  (SELECT COUNT(*) FROM abt_menu m WHERE m.id = 963 AND m.direktori = %s AND m.parent_direktori = %s AND %s)\n" % (q(ALUR04), q(INDUK), hak_963) +
          ") AS prasyarat;\n")
    # PASANG
    kol = ', '.join(KOLOM)
    nilai = ', '.join(q(MENU[k]) if isinstance(MENU[k], str) else str(MENU[k]) for k in KOLOM)
    tulis('%s-PASANG.sql' % N, kepala +
          '-- PASANG: satu transaksi; id = MAX+1 saat pasang; WHERE NOT EXISTS (pasang ulang tidak menggandakan).\nSTART TRANSACTION;\n'
          'INSERT INTO abt_menu (id, %s) SELECT (SELECT n FROM (SELECT IFNULL(MAX(id), 0) + 1 AS n FROM abt_menu) mm), %s FROM DUAL '
          'WHERE NOT EXISTS (SELECT 1 FROM abt_menu WHERE direktori = %s AND parent_direktori = %s);\nCOMMIT;\n' % (kol, nilai, q(FOLDER), q(INDUK)))
    # PERIKSA
    m5 = md5_menu_nilai()
    tulis('%s-PERIKSA.sql' % N, kepala +
          '-- PERIKSA (baca saja): baris menu persis isi paket. Baris terakhir harus: SEMUA COCOK\n'
          "SELECT label, ok FROM (\nSELECT 'menu %s' AS label, (SELECT COUNT(*) FROM abt_menu WHERE direktori = %s AND parent_direktori = %s AND %s = '%s') AS ok\n"
          ") c WHERE ok <> 1\nUNION ALL\nSELECT IF(COUNT(*) = 1, 'SEMUA COCOK', CONCAT(1 - COUNT(*), ' TIDAK COCOK')), COUNT(*) FROM (\n"
          "SELECT (SELECT COUNT(*) FROM abt_menu WHERE direktori = %s AND parent_direktori = %s AND %s = '%s') AS ok\n) d WHERE ok = 1;\n"
          % (FOLDER, q(FOLDER), q(INDUK), md5_menu_sql(), m5, q(FOLDER), q(INDUK), md5_menu_sql(), m5))
    # PULIH
    tulis('%s-PULIH.sql' % N, kepala +
          '-- PULIH (deterministik): baris baru dihapus HANYA bila isinya masih persis paket (yang sudah disunting orang dibiarkan dan dilaporkan oleh pulih-satker.sh).\n'
          "START TRANSACTION;\nDELETE FROM abt_menu WHERE direktori = %s AND parent_direktori = %s AND %s = '%s';\nCOMMIT;\nSELECT 'PULIH SQL SELESAI';\n"
          % (q(FOLDER), q(INDUK), md5_menu_sql(), m5))
    # MD5SUMS (semua berkas paket kecuali dirinya, cadangan, dan cermin sementara)
    daftar = []
    for dp, dn, fn in os.walk(PS):
        dn[:] = [d for d in dn if d not in ('cadangan', '__pycache__')]
        for f in fn:
            if f == 'MD5SUMS.txt' or f.endswith('.pyc'):
                continue
            daftar.append(os.path.relpath(os.path.join(dp, f), PS).replace('\\', '/'))
    daftar.sort()
    tulis('MD5SUMS.txt', ''.join('%s  %s\n' % (md5b(open(os.path.join(PS, f), 'rb').read()), f) for f in daftar))
    print('MENU md5', m5, '| berkas di MD5SUMS:', len(daftar))


if __name__ == '__main__':
    main()
