# -*- coding: utf-8 -*-
"""Bangun paket ABT teks-pihak-1nov (1 Nov 2026) - keputusan 55: teks para pihak disalin APA ADANYA, kesimpulan UTUH di putusan.

pakai: python bangun_paket.py <akar _blangko_abt/derry_briantono sesudah 25 paket> <basis ABT sesudah 25 paket (TIDAK diubah)> <basis ABT kerja (diubah: fungsi paket dipasang)>

Isi paket:
  fungsi BARU   isian_awal_kecil, isian_rtf_kalimat_kecil
  fungsi DIGANTI isian_rtf_penanda (penanda butir "1 ." / "1 )" dengan spasi sebelum titik dikenali; tanpa itu baris "1 .Bahwa" menempel ke baris di atasnya)
  variabel DIGANTI  9255 / 9256 (kesimpulan dalam kalimat: huruf pertama diturunkan SAAT CETAK), 11313 (eksepsi kewenangan: cabang 9681 diturunkan)
  variabel BARU 12100-12119 (di luar blok 12040-12099 milik bukti-pisah)
  blangko RTF   ubah_blangko.py
"""
import base64
import collections
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
import pilih_berkas as P  # noqa: E402
import ubah_blangko as U  # noqa: E402
from rtfsatuan import seimbang  # noqa: E402

TINJAU = os.path.join(SINI, '..', '..', 'tinjau-31okt', 'paket-satker')
MYSQL = r'D:\Satker Asal\Website PA Bungku\xampp\mysql\bin\mysql.exe'
N = 'abt-teks-pihak-1nov'
TANGGAL = '2026-11-01 00:00:00'
BLOK = (12100, 12119)
SIDIK = "MD5(CONCAT_WS('|', v.nama, v.data_type, IFNULL(v.sql_query, ''), IFNULL(v.referensi, ''), IFNULL(v.multi_sidang, ''), v.locked, IFNULL(v.modifier, '')))"
FUNGSI_BARU = ('isian_awal_kecil', 'isian_rtf_kalimat_kecil')
FUNGSI_GANTI = 'isian_rtf_penanda'
FUNGSI_PERLU = ('isian_rtf_kalimat', 'isian_rtf_blok', 'isian_bukti_baris', 'isian_bukti_sumber')
UBAH_LAMA = (9255, 9256, 11313)


def md5b(b):
    return hashlib.md5(b).hexdigest()


def hexs(s):
    return '0x' + s.encode('latin1').hex() if s else "''"


def jalan(db, q, masuk=None):
    r = subprocess.run([MYSQL, '-h127.0.0.1', '-uroot', '-N', '-r', '--default-character-set=latin1', db] + ([] if masuk is not None else ['-e', q]),
                       input=masuk, capture_output=True)
    if r.returncode:
        raise SystemExit('SQL gagal: ' + r.stderr.decode('latin1')[-600:])
    return r.stdout.decode('latin1').replace('\r\n', '\n')


# ───────────────────────── variabel ─────────────────────────
def S(no):
    return "(SELECT t.data FROM aps_badilag.abt_data_teks t WHERE t.no_var = %d AND t.perkara_id = '#perkara_id#' LIMIT 1)" % no


def ADA(pihak, j):
    return "CHAR_LENGTH(aps_badilag.isian_bukti_baris(aps_badilag.isian_bukti_sumber('#perkara_id#', '%s'), %d)) > 0" % (pihak, j)


def sql_kesimpulan(naskah, pokok):
    return ("SELECT IF(CHAR_LENGTH(TRIM(REPLACE(REPLACE(IFNULL(%s, ''), CHAR(13), ''), CHAR(10), ''))) > 0, "
            "CONCAT('sebagai berikut:', REPLACE('|par ', '|', CHAR(92)), aps_badilag.isian_rtf_blok(%s, 'teks', 426)), "
            "aps_badilag.isian_rtf_kalimat_kecil(%s, 426)) AS data" % (S(naskah), S(naskah), S(pokok)))


def sql_kecil(no):
    return "SELECT IFNULL(aps_badilag.isian_awal_kecil(%s), 'DATA_TIDAK_ADA') AS data" % S(no)


def variabel_baru():
    v = []
    v.append((12100, 'KESIMPULAN #0046# DALAM KALIMAT PUTUSAN (OTOMATIS: naskah kesimpulan tertulis isian 12027 UTUH bila ada, selain itu frasa isian 8436 berhuruf pertama kecil; RTF)',
              sql_kesimpulan(12027, 8436)))
    v.append((12101, 'KESIMPULAN #0047# DALAM KALIMAT PUTUSAN (OTOMATIS: naskah kesimpulan tertulis isian 12028 UTUH bila ada, selain itu frasa isian 8437 berhuruf pertama kecil; RTF)',
              sql_kesimpulan(12028, 8437)))
    v.append((12102, 'EKONOMI SYARIAH: POKOK JAWABAN #0047# DALAM KALIMAT (OTOMATIS dari isian 9355; huruf pertama diturunkan saat cetak, selebihnya apa adanya)', sql_kecil(9355)))
    v.append((12103, 'EKONOMI SYARIAH (NO ARBITRASE): POKOK EKSEPSI #0047# DALAM KALIMAT (OTOMATIS dari isian 9491; huruf pertama diturunkan saat cetak)', sql_kecil(9491)))
    v.append((12104, 'EKSEPSI KEWENANGAN: ISI EKSEPSI #0047# DALAM KALIMAT (OTOMATIS dari isian 9681; huruf pertama diturunkan saat cetak)', sql_kecil(9681)))
    v.append((12105, 'SITA: TANGGAPAN #0047# ATAS PERMOHONAN SITA DALAM KALIMAT (OTOMATIS dari isian 9164; huruf pertama diturunkan saat cetak)', sql_kecil(9164)))
    v.append((12106, 'ASAL USUL ANAK PUTUSAN: KLAUSA "menyerahkan alat bukti surat/elektronik berupa:" PEMOHON (OTOMATIS menurut isian bukti: surat, elektronik saja, atau kosong = surat)',
              "SELECT IF(%s, 'menyerahkan alat bukti surat berupa:', IF(%s, 'menyerahkan alat bukti elektronik berupa:', 'menyerahkan alat bukti surat berupa:')) AS data" % (ADA('P', 0), ADA('P', 1))))
    v.append((12107, 'ASAL USUL ANAK PUTUSAN: PENGANTAR BUKTI ELEKTRONIK PEMOHON oleh #7036# (hanya bila ada bukti surat DAN elektronik; elektronik saja sudah disebut di kalimat atas)',
              "SELECT IF(%s AND %s, CONCAT('Selanjutnya #7036# menyerahkan bukti elektronik berupa:', CHAR(92 USING latin1), 'par'), '') AS data" % (ADA('P', 0), ADA('P', 1))))
    for no, pihak, nama in ((12108, 'P', 'PENGGUGAT/PEMOHON'), (12109, 'T', 'TERGUGAT/TERMOHON')):
        v.append((no, 'BAS/PUTUSAN: "telah cukup dengan ..." %s (OTOMATIS: bukti suratnya / bukti elektroniknya / bukti surat dan bukti elektroniknya; kosong = bukti suratnya)' % nama,
                  "SELECT IF(%s, IF(%s, 'bukti surat dan bukti elektroniknya', 'bukti suratnya'), IF(%s, 'bukti elektroniknya', 'bukti suratnya')) AS data" % (ADA(pihak, 0), ADA(pihak, 1), ADA(pihak, 1))))
    return [dict(no=a, nama=b[:200], jenis='data_sql', sql=c) for a, b, c in v]


def sidik_py(nama, jenis, sql, ref='', multi='', locked='0', modifier='admin'):
    return md5b('|'.join([nama, jenis, sql or '', ref or '', multi or '', str(locked), modifier or '']).encode('latin1'))


def baca_lama(db):
    q = ("SELECT no_var, HEX(nama), data_type, HEX(IFNULL(sql_query, '')), IFNULL(referensi, ''), IFNULL(multi_sidang, ''), locked, IFNULL(modifier, '') "
         "FROM abt_variabel WHERE no_var IN (%s) ORDER BY no_var" % ','.join(str(x) for x in UBAH_LAMA))
    hasil = {}
    for l in jalan(db, q).splitlines():
        no, nm, jt, sq, ref, multi, lk, mod = l.split('\t')
        hasil[int(no)] = dict(no=int(no), nama=bytes.fromhex(nm).decode('latin1'), jenis=jt, sql=bytes.fromhex(sq).decode('latin1'), ref=ref, multi=multi, locked=lk, modifier=mod)
    assert set(hasil) == set(UBAH_LAMA), hasil.keys()
    return hasil


def ubah_lama(lama):
    baru = {}
    # 9255 / 9256: isian_rtf_kalimat -> isian_rtf_kalimat_kecil (huruf pertama frasa diturunkan saat cetak)
    for no in (9255, 9256):
        x = lama[no]
        assert x['sql'].count('aps_badilag.isian_rtf_kalimat(') == 1, no
        sq = x['sql'].replace('aps_badilag.isian_rtf_kalimat(', 'aps_badilag.isian_rtf_kalimat_kecil(')
        nama = x['nama'].rstrip(')') + '; 1 Nov: huruf pertama frasa diturunkan saat cetak)'
        baru[no] = dict(x, nama=nama[:200], sql=sq)
    # 11313: cabang isian 9681 (diisi mesin, kini apa adanya) -> huruf pertama diturunkan; cabang isian 9685 (ketikan petugas) tetap
    x = lama[11313]
    sq = x['sql']
    kunci = "NULLIF(NULLIF(NULLIF(TRIM(IFNULL((SELECT TRIM(REPLACE(REPLACE(REPLACE(CONVERT(t.data USING utf8), '\\\\', '/'), '\"', '&quot;'), '''', '&#39;')) FROM aps_badilag.abt_data_teks t WHERE t.no_var = 9681"
    i = sq.index(kunci)
    ekor = ", \"...\") AS data"
    assert sq.endswith(ekor), sq[-40:]
    cabang = sq[i:len(sq) - len(ekor)]
    assert sq.count(kunci) == 1 and cabang.count('9681') == 1
    sq2 = sq[:i] + 'aps_badilag.isian_awal_kecil(' + cabang + ')' + ekor
    nama = x['nama'].rstrip(')') + '; 1 Nov: isian 9681 berhuruf pertama kecil)'
    baru[11313] = dict(x, nama=nama[:200], sql=sq2)
    return baru


# ───────────────────────── fungsi ─────────────────────────
PENANDA_LAMA = """    IF j >= n THEN RETURN NULL; END IF;
    IF kurung = 1 THEN
      IF NOT (BINARY SUBSTRING(t, j + 1, 1) = ')') THEN RETURN NULL; END IF;
      SET gaya = '(d)';"""
PENANDA_BARU = """    IF kurung = 0 AND tingkat = 1 AND j < n AND BINARY SUBSTRING(t, j + 1, 1) = ' ' THEN
      SET m = j + 1;
      WHILE m < n AND m - j < 3 AND BINARY SUBSTRING(t, m + 1, 1) = ' ' DO
        SET m = m + 1;
      END WHILE;
      IF m < n AND BINARY SUBSTRING(t, m + 1, 1) IN ('.', ')') THEN
        SET j = m;
      END IF;
    END IF;
    IF j >= n THEN RETURN NULL; END IF;
    IF kurung = 1 THEN
      IF NOT (BINARY SUBSTRING(t, j + 1, 1) = ')') THEN RETURN NULL; END IF;
      SET gaya = '(d)';"""
KOMENTAR_LAMA = None


def kepala_dan_badan(db, nama):
    badan = jalan(db, "SELECT routine_definition FROM information_schema.routines WHERE routine_schema = DATABASE() AND routine_name = '%s'" % nama)
    badan = badan[:-1] if badan.endswith('\n') else badan
    m_db = jalan(db, "SELECT MD5(routine_definition) FROM information_schema.routines WHERE routine_schema = DATABASE() AND routine_name = '%s'" % nama).strip()
    assert md5b(badan.encode('latin1')) == m_db, nama
    buat = jalan(db, "SHOW CREATE FUNCTION %s" % nama).split('\t')[2].replace('\\n', '\n')
    kepala = buat[buat.index('FUNCTION `%s`' % nama):buat.index('\nBEGIN')]
    return kepala, badan, m_db


def fungsi_sql(daftar, judul):
    isi = ['-- %s' % judul, 'DELIMITER $$']
    for nama, kepala, badan in daftar:
        isi += ['DROP FUNCTION IF EXISTS %s$$' % nama, 'CREATE %s' % kepala, '%s$$' % badan]
    isi.append('DELIMITER ;')
    return '\n'.join(isi) + '\n'


# ───────────────────────── utama ─────────────────────────
def main():
    akar, dasar, kerja = sys.argv[1:4]
    keluar = os.path.join(SINI, '..', 'paket-satker')
    hasil_dir = os.path.join(SINI, '..', 'hasil')
    os.makedirs(hasil_dir, exist_ok=True)
    if os.path.isdir(keluar):
        shutil.rmtree(keluar)
    os.makedirs(keluar)

    # --- fungsi ---
    kep_p, bad_p, m_p_lama = kepala_dan_badan(dasar, FUNGSI_GANTI)
    assert bad_p.count(PENANDA_LAMA) == 1
    bad_p_baru = bad_p.replace(PENANDA_LAMA, PENANDA_BARU)
    kep_p_baru = kep_p
    fungsi_baru_sql = open(os.path.join(SINI, 'fungsi_baru.sql'), encoding='latin1', newline='').read().replace('\r\n', '\n')
    ganti = fungsi_sql([(FUNGSI_GANTI, kep_p_baru, bad_p_baru)], 'isian_rtf_penanda BARU')
    # satu berkas FUNGSI.sql: fungsi baru + penanda baru
    gabung = fungsi_baru_sql.rstrip('\n')
    assert gabung.endswith('DELIMITER ;')
    gabung = gabung[:-len('DELIMITER ;')] + 'DROP FUNCTION IF EXISTS %s$$\nCREATE %s\n%s$$\nDELIMITER ;\n' % (FUNGSI_GANTI, kep_p_baru, bad_p_baru)
    open(os.path.join(keluar, '%s-FUNGSI.sql' % N), 'w', encoding='latin1', newline='\n').write(gabung)
    pulih_f = ['-- Pulih fungsi paket %s: fungsi baru dihapus, isian_rtf_penanda dikembalikan ke isi LAMA (sesudah 25 paket)' % N, 'DROP FUNCTION IF EXISTS isian_rtf_kalimat_kecil;', 'DROP FUNCTION IF EXISTS isian_awal_kecil;']
    open(os.path.join(keluar, '%s-FUNGSI-PULIH.sql' % N), 'w', encoding='latin1', newline='\n').write('\n'.join(pulih_f) + '\n' + fungsi_sql([(FUNGSI_GANTI, kep_p, bad_p)], 'isian_rtf_penanda LAMA'))
    # pasang ke basis kerja untuk md5
    jalan(kerja, '', gabung.encode('latin1'))
    md5_baru = {f: jalan(kerja, "SELECT MD5(routine_definition) FROM information_schema.routines WHERE routine_schema = DATABASE() AND routine_name = '%s'" % f).strip()
                for f in FUNGSI_BARU + (FUNGSI_GANTI,)}
    assert md5_baru[FUNGSI_GANTI] != m_p_lama
    assert md5b(bad_p_baru.encode('latin1')) == md5_baru[FUNGSI_GANTI], 'badan penanda di basis kerja tidak sama dengan yang dibangun'

    # --- variabel ---
    lama = baca_lama(dasar)
    baru_ubah = ubah_lama(lama)
    baru = variabel_baru()
    for x in baru:
        assert BLOK[0] <= x['no'] <= BLOK[1]
        assert x['sql'].count("'") % 2 == 0 and not re.search(r'aleta', x['nama'] + x['sql'], re.I), x['no']
        assert '\\' not in x['sql'], x['no']
    for x in baru_ubah.values():
        assert not re.search(r'aleta', x['nama'] + x['sql'], re.I)
    nomor_baru = [x['no'] for x in baru]
    sid_lama = {no: sidik_py(x['nama'], x['jenis'], x['sql'], x['ref'], x['multi'], x['locked'], x['modifier']) for no, x in lama.items()}
    sid_ubah = {no: sidik_py(x['nama'], x['jenis'], x['sql'], x['ref'], x['multi'], x['locked'], x['modifier']) for no, x in baru_ubah.items()}
    sid_baru = {x['no']: sidik_py(x['nama'], x['jenis'], x['sql']) for x in baru}

    def daftar_h(d):
        return ' UNION ALL '.join("SELECT %d AS n, '%s' AS h" % (n, h) for n, h in sorted(d.items()))

    nl_baru = daftar_h(sid_baru)
    cek_lama = ' OR '.join("(v.no_var = %d AND %s = '%s')" % (n, SIDIK, h) for n, h in sorted(sid_lama.items()))
    cek_ubah = ' OR '.join("(v.no_var = %d AND %s = '%s')" % (n, SIDIK, h) for n, h in sorted(sid_ubah.items()))
    fb = ' OR '.join("(routine_name = '%s' AND MD5(routine_definition) = '%s')" % (f, md5_baru[f]) for f in FUNGSI_BARU)
    kepala = '-- Paket ABT "%s" (1 Nov 2026): teks para pihak disalin apa adanya, kesimpulan utuh di putusan. Hanya derry_briantono.\n' % N
    pras = kepala + ('-- PRASYARAT "A|B|C|D|E|F|G|H|I": A = variabel 9255/9256/11313 persis LAMA (3 pasang pertama) | B = persis BARU (3 pasang ulang) | C = variabel baru persis (0 / %d) | '
                     'D = nomor %d-%d berisi lain dari paket (0) | E = isian_rtf_penanda persis LAMA (1 / 0) | F = isian_rtf_penanda persis BARU (0 / 1) | G = fungsi baru persis (0 / 2) | '
                     'H = fungsi bernama sama tetapi isi lain (0) | I = fungsi yang dipakai ada: %s (%d)\n' % (len(baru), BLOK[0], BLOK[1], ', '.join(FUNGSI_PERLU), len(FUNGSI_PERLU)))
    pras += ("SELECT CONCAT_WS('|',\n (SELECT COUNT(*) FROM abt_variabel v WHERE %s),\n (SELECT COUNT(*) FROM abt_variabel v WHERE %s),\n"
             " (SELECT COUNT(*) FROM abt_variabel v JOIN (%s) p ON p.n = v.no_var AND p.h = %s),\n"
             " (SELECT COUNT(*) FROM abt_variabel v WHERE v.no_var BETWEEN %d AND %d AND NOT EXISTS (SELECT 1 FROM (%s) p WHERE p.n = v.no_var AND p.h = %s)),\n"
             " (SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema = DATABASE() AND routine_name = '%s' AND MD5(routine_definition) = '%s'),\n"
             " (SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema = DATABASE() AND routine_name = '%s' AND MD5(routine_definition) = '%s'),\n"
             " (SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema = DATABASE() AND (%s)),\n"
             " (SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema = DATABASE() AND routine_name IN (%s) AND NOT (%s)),\n"
             " (SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema = DATABASE() AND routine_name IN (%s))) AS p;\n"
             % (cek_lama, cek_ubah, nl_baru, SIDIK, BLOK[0], BLOK[1], nl_baru, SIDIK, FUNGSI_GANTI, m_p_lama, FUNGSI_GANTI, md5_baru[FUNGSI_GANTI], fb,
                ', '.join("'%s'" % f for f in FUNGSI_BARU), fb, ', '.join("'%s'" % f for f in FUNGSI_PERLU)))
    open(os.path.join(keluar, '%s-PRASYARAT.sql' % N), 'w', encoding='latin1', newline='\n').write(pras)
    open(os.path.join(keluar, 'harap.txt'), 'w', newline='\n').write('3|0|0|0|1|0|0|0|%d\n0|3|%d|0|0|1|2|0|%d\n' % (len(FUNGSI_PERLU), len(baru), len(FUNGSI_PERLU)))
    open(os.path.join(keluar, 'nomor-variabel.txt'), 'w', newline='\n').write('# variabel BARU (variabel LAMA yang diganti: %s)\n' % ', '.join(str(n) for n in UBAH_LAMA) + ''.join('%d\n' % n for n in nomor_baru))

    # PASANG: ganti variabel lama (dijaga sidik LAMA), tambah variabel baru
    p = [kepala, 'START TRANSACTION;\n']
    for no in UBAH_LAMA:
        x = baru_ubah[no]
        p.append("UPDATE abt_variabel v SET v.nama = %s, v.sql_query = %s WHERE v.no_var = %d AND %s = '%s';\n" % (hexs(x['nama']), hexs(x['sql']), no, SIDIK, sid_lama[no]))
    for x in baru:
        p.append("INSERT INTO abt_variabel (no_var, nama, data_type, data_tabel, data_kolom, urutan_data, referensi, sql_query, default_data, multi_sidang, locked, modifier, modified) "
                 "SELECT %d, %s, '%s', NULL, NULL, NULL, NULL, %s, NULL, NULL, 0, 'admin', '%s' FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM abt_variabel WHERE no_var = %d);\n"
                 % (x['no'], hexs(x['nama']), x['jenis'], hexs(x['sql']), TANGGAL, x['no']))
    p.append('COMMIT;\n')
    open(os.path.join(keluar, '%s-PASANG.sql' % N), 'w', encoding='latin1', newline='\n').write(''.join(p))
    # PULIH variabel (dijaga sidik BARU)
    r = [kepala, 'START TRANSACTION;\n']
    for no in UBAH_LAMA:
        x = lama[no]
        r.append("UPDATE abt_variabel v SET v.nama = %s, v.sql_query = %s WHERE v.no_var = %d AND %s = '%s';\n" % (hexs(x['nama']), hexs(x['sql']), no, SIDIK, sid_ubah[no]))
    for x in baru:
        r.append("DELETE FROM abt_variabel WHERE no_var = %d AND %s = '%s';\n" % (x['no'], SIDIK.replace('v.', ''), sid_baru[x['no']]))
    r.append('COMMIT;\n')
    open(os.path.join(keluar, '%s-PULIH.sql' % N), 'w', encoding='latin1', newline='\n').write(''.join(r))
    # PERIKSA
    bag = ["SELECT 'var %d' AS label, (SELECT COUNT(*) FROM abt_variabel v WHERE v.no_var = %d AND %s = '%s') AS ok" % (no, no, SIDIK, h) for no, h in sorted(sid_ubah.items())]
    bag += ["SELECT 'var %d' AS label, (SELECT COUNT(*) FROM abt_variabel v WHERE v.no_var = %d AND %s = '%s') AS ok" % (no, no, SIDIK, h) for no, h in sorted(sid_baru.items())]
    bag += ["SELECT 'fungsi %s' AS label, (SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema = DATABASE() AND routine_name = '%s' AND MD5(routine_definition) = '%s') AS ok"
            % (f, f, md5_baru[f]) for f in FUNGSI_BARU + (FUNGSI_GANTI,)]
    q = kepala + 'SELECT label, ok FROM (\n' + '\nUNION ALL '.join(bag) + '\n) x WHERE ok <> 1\nUNION ALL SELECT IF((SELECT COUNT(*) FROM (' + \
        '\nUNION ALL '.join(bag) + ") y WHERE y.ok <> 1) = 0, 'SEMUA COCOK', 'ADA BEDA'), '';\n"
    open(os.path.join(keluar, '%s-PERIKSA.sql' % N), 'w', encoding='latin1', newline='\n').write(q)

    # uji fungsi (masukan tetap -> md5 keluaran di laptop) dan uji kueri
    contoh = [
        ('isian_awal_kecil(@T@)', ['Bahwa Tergugat menolak seluruh dalil', 'Tergugat menolak', 'TERGUGAT MENOLAK', 'Penggugat Rekonvensi tetap', 'tetap pada gugatan', 'A', '  \r\nPara Pemohon mohon',
                                   'Kesimpulan 1 yang tidak rapi.', 'PNS', 'Ibu kandung']),
        ('isian_rtf_kalimat_kecil(@T@, 426)', ['Bahwa Tergugat menolak seluruh dalil.', 'Tergugat tetap pada jawaban,', 'Menolak gugatan', '1.Bahwa A;\n2.Bahwa B;', 'x']),
        ('isian_rtf_penanda(@T@)', ['1.Bahwa A', '1 . Bahwa A', '1 .Bahwa A', '1  )  Bahwa', '10 . x', 'a. x', '1 x', '1.1 x', '(1) x', 'Bahwa 1 . x', '1    . x']),
        ("isian_rtf_butir(@T@, 'teks', 426)", ['DALAM POKOK PERKARA\n1 .Bahwa C tiga.\n2 . Bahwa D empat.\n3.Bahwa E;\nParagraf tanpa nomor.', '1.Bahwa A;\n2.Bahwa B;\nPenutup.',
                                               'Bahwa satu.\nBahwa dua;']),
    ]
    with open(os.path.join(keluar, 'uji-fungsi.tsv'), 'w', encoding='utf-8', newline='\n') as o:
        for expr, teksk in contoh:
            for t in teksk:
                hx = t.encode('latin1').hex()
                ekspr = expr.replace('@T@', "CONVERT(UNHEX('%s') USING latin1)" % hx)
                h = jalan(kerja, "SELECT MD5(%s)" % ekspr).strip()
                o.write('%s\t%s\t%s\n' % (hx, expr, h))
    with open(os.path.join(keluar, 'uji-kueri.tsv'), 'w', encoding='utf-8', newline='\n') as o:
        for no in UBAH_LAMA:
            o.write('%d\t%s\n' % (no, base64.b64encode(baru_ubah[no]['sql'].encode('latin1')).decode('ascii')))
        for x in baru:
            o.write('%d\t%s\n' % (x['no'], base64.b64encode(x['sql'].encode('latin1')).decode('ascii')))

    # --- berkas RTF ---
    hasil, lewat = P.rancang(akar)
    gabung_edit = collections.OrderedDict()
    catat = []
    for kel in ('kesimpulan', 'kecil', 'aua', 'bas'):
        for rel, raw, edits, ctt in hasil[kel]:
            d = gabung_edit.setdefault(rel, [raw, [], []])
            d[1].extend(edits)
            d[2].append(kel)
            for c in ctt:
                catat.append((rel, 'BAS dilewati', c))
    berkas = {}
    for rel, (raw, edits, kels) in gabung_edit.items():
        awal_sisip = [e[0] for e in edits if e[0] == e[1]]
        assert len(awal_sisip) == len(set(awal_sisip)), 'dua penyisipan di posisi sama: ' + rel
        baru_raw = U.terapkan(raw, edits)
        if seimbang(baru_raw) != seimbang(raw):
            raise SystemExit('neraca kurung berubah: ' + rel)
        berkas[rel] = (raw, baru_raw, edits, kels)
    with open(os.path.join(keluar, 'daftar-tambal.tsv'), 'w', encoding='utf-8', newline='\n') as d, \
            open(os.path.join(keluar, 'tambal.tsv'), 'w', encoding='utf-8', newline='\n') as t, \
            open(os.path.join(hasil_dir, 'ubahan.tsv'), 'w', encoding='utf-8', newline='\n') as u:
        d.write('# kode\tberkas\tmd5_lama\tmd5_baru\tjumlah potongan - berkas diubah HANYA bila md5 persis md5_lama (keadaan sesudah 25 paket rantai)\n')
        t.write('# kode\toffset\tb64(teks lama)\tb64(teks baru)\n')
        u.write('berkas\tkelompok\tsuntingan\n')
        for i, rel in enumerate(sorted(berkas), 1):
            raw, baru_raw, edits, kels = berkas[rel]
            kode = 'B%04d' % i
            h = raw
            for s_, e_, g_ in sorted(edits, key=lambda x: (-x[0], -x[1])):
                h = h[:s_] + g_ + h[e_:]
            assert h == baru_raw, rel
            d.write('%s\tderry_briantono/%s\t%s\t%s\t%d\n' % (kode, rel, md5b(raw.encode('latin1')), md5b(baru_raw.encode('latin1')), len(edits)))
            for s_, e_, g_ in sorted(edits):
                t.write('%s\t%d\t%s\t%s\n' % (kode, s_, base64.b64encode(raw[s_:e_].encode('latin1')).decode('ascii'), base64.b64encode(g_.encode('latin1')).decode('ascii')))
            u.write('%s\t%s\t%s\n' % (rel, '+'.join(kels), '; '.join('%s->%s' % (raw[s_:e_][:50] or '(sisip)', g_[:60]) for s_, e_, g_ in sorted(edits))[:400]))
        for rel, k, a in catat:
            u.write('%s\t%s\t%s\n' % (rel, k, a))
        for k, rel, a in lewat:
            u.write('%s\tLEWAT %s\t%s\n' % (rel, k, a))

    # --- berkas paket lain ---
    shutil.copy(os.path.join(TINJAU, 'tambal_rtf.py'), os.path.join(keluar, 'tambal_rtf.py'))
    for f in ('pasang-satker.sh', 'pulih-satker.sh'):
        shutil.copy(os.path.join(SINI, f), os.path.join(keluar, f))
    semua = []
    for d_, _, fs in os.walk(keluar):
        for f in fs:
            if f != 'MD5SUMS.txt':
                p_ = os.path.join(d_, f)
                semua.append((os.path.relpath(p_, keluar).replace(os.sep, '/'), md5b(open(p_, 'rb').read())))
    with open(os.path.join(keluar, 'MD5SUMS.txt'), 'w', newline='\n') as o:
        for rel, m in sorted(semua):
            o.write('%s  %s\n' % (m, rel))
    json.dump(dict(baru=[dict(no=x['no'], nama=x['nama'], sql=x['sql']) for x in baru],
                   diganti=[dict(no=n, nama_lama=lama[n]['nama'], nama_baru=baru_ubah[n]['nama'], sql_lama=lama[n]['sql'], sql_baru=baru_ubah[n]['sql']) for n in UBAH_LAMA],
                   md5_fungsi=md5_baru, md5_penanda_lama=m_p_lama),
              open(os.path.join(hasil_dir, 'variabel.json'), 'w', encoding='utf-8', newline='\n'), ensure_ascii=False, indent=1)
    hit = collections.Counter('+'.join(v[3]) for v in berkas.values())
    print('berkas RTF diubah', len(berkas), dict(hit), '| variabel baru', len(baru), '| diganti', len(baru_ubah), '| LEWAT', len(lewat), '| dilewati', len(catat))


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    main()
