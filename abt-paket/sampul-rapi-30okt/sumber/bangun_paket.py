# -*- coding: utf-8 -*-
"""Bangun paket ABT abt-sampul-rapi-30okt (Python 3, laptop). Deterministik dari:
  - basis ABT keadaan server (bawaan aps_badilag_2810 = dump server 28 Okt 15.44): 60 variabel lama yang diubah (md5 dasar) dan bukti blok
    11300-11317 kosong serta kelima fungsi paket belum ada;
  - pohon RTF derry_briantono keadaan server PERKIRAAN (bawaan D:/Aplikasi/aleta/tmp/bas29/dasar2/derry_briantono = salinan server w82 + paket
    alamat-ganda, sampul-daftar-isi (+ peningkatan 27 Okt), pihak-urut, court-calendar, ikrar-92): md5 lama 21 blangko berkas perkara;
  - RTF baru dari alat/bangun_rtf.py (folder ../rtf/derry_briantono).
Keluaran: ../paket-satker/ (SQL, nomor-*.txt, daftar-timpa.tsv, timpa.tgz, uji-kueri.tsv, berkas_rtf.py, skrip, MD5SUMS.txt) dan ../hasil/isi-paket.json.
pakai: python -I sumber/bangun_paket.py [basis ABT] [akar RTF dasar derry_briantono]"""
import gzip
import hashlib
import io
import json
import os
import re
import shutil
import subprocess
import sys
import tarfile

SINI = os.path.dirname(os.path.abspath(__file__))
AKAR = os.path.dirname(SINI)
sys.path.insert(0, SINI)
import variabel as V  # noqa: E402

PAKET = os.path.join(AKAR, 'paket-satker')
HASIL = os.path.join(AKAR, 'hasil')
N = 'abt-sampul-rapi-30okt'
MYSQL = r'D:\Satker Asal\Website PA Bungku\xampp\mysql\bin\mysql.exe'
BASIS = sys.argv[1] if len(sys.argv) > 1 else 'aps_badilag_2810'
DASAR = sys.argv[2] if len(sys.argv) > 2 else r'D:\Aplikasi\aleta\tmp\bas29\dasar2\derry_briantono'
BARU = os.path.join(AKAR, 'rtf', 'derry_briantono')
BLOK = (11300, 11319)
KEPALA = ('-- Paket ABT "%s" (30 Okt 2026): sampul, lampiran, daftar isi, ceklist berkas perkara Derry penuh satu halaman dan rapi; tabel dokumen '
          'dan lampiran langsung dari ABT; logo kop monokrom.\n' % N)
MD5_VAR = "MD5(CONCAT_WS('|', v.nama, v.data_type, IFNULL(v.sql_query, ''), v.locked))"


def sql(q):
    r = subprocess.run([MYSQL, '-h127.0.0.1', '-uroot', '-N', '--raw', '--default-character-set=latin1', BASIS, '-e', q], capture_output=True, check=True)
    return r.stdout.decode('latin1')


def hx(s):
    return '0x' + s.encode('latin1').hex()


def md5(b):
    return hashlib.md5(b).hexdigest()


def tanda(nama, q):
    return md5(('%s|data_sql|%s|0' % (nama, q)).encode('latin1'))


def tulis(nama, isi):
    with open(os.path.join(PAKET, nama), 'w', encoding='latin1', newline='\n') as o:
        o.write(isi)


def main():
    if os.path.isdir(PAKET):
        for x in os.listdir(PAKET):
            if x != 'cadangan':
                p = os.path.join(PAKET, x)
                shutil.rmtree(p) if os.path.isdir(p) else os.remove(p)
    os.makedirs(PAKET, exist_ok=True)
    os.makedirs(HASIL, exist_ok=True)
    # --- basis ABT -------------------------------------------------------------------------------------------------------------
    assert sql('SELECT COUNT(*) FROM abt_variabel WHERE no_var BETWEEN %d AND %d' % BLOK).strip() == '0', 'blok %s sudah terpakai di %s' % (BLOK, BASIS)
    asal = {}
    for n in V.UBAH:
        h = sql('SELECT HEX(sql_query) FROM abt_variabel WHERE no_var = %d' % n).strip()
        asal[n] = bytes.fromhex(h).decode('latin1')
        meta = sql('SELECT data_type FROM abt_variabel WHERE no_var = %d' % n).strip()
        assert meta == 'data_sql', (n, meta)
    ub = V.ubah(asal)
    vb = V.baru()
    nomor = sorted(vb)
    assert all(BLOK[0] <= n <= BLOK[1] for n in nomor) and len(nomor) == 20
    fungsi = open(os.path.join(SINI, 'fungsi.sql'), encoding='latin1').read()
    for f in V.FUNGSI:
        assert 'CREATE FUNCTION aps_badilag.%s(' % f in fungsi, f
    assert 'aleta' not in fungsi.lower()
    # --- RTF -------------------------------------------------------------------------------------------------------------------
    timpa = []
    for folder in ('99 PTSP', '98b Berkas Perkara - BAS'):
        for b in sorted(os.listdir(os.path.join(BARU, folder))):
            isi = open(os.path.join(BARU, folder, b), 'rb').read()
            lama = open(os.path.join(DASAR, folder, b), 'rb').read()
            assert b'aleta' not in isi.lower()
            timpa.append((folder, b, md5(lama), md5(isi), isi))
    assert len(timpa) == 21, len(timpa)
    # --- variabel dirujuk RTF dan kueri ----------------------------------------------------------------------------------------
    rujuk = set()
    for _f, _b, _m0, _m1, isi in timpa:
        rujuk |= set(int(x) for x in re.findall(r'#(\d{3,5})#', isi.decode('latin1')))
    for q in list(ub.values()) + [q for _n, q in vb.values()]:
        rujuk |= set(int(x) for x in re.findall(r'#(\d{3,5})#', q))
    rujuk -= set(nomor)
    rujuk = sorted(rujuk)
    # --- SQL -------------------------------------------------------------------------------------------------------------------
    hb = {n: tanda(*vb[n]) for n in nomor}
    ha = {n: md5(asal[n].encode('latin1')) for n in V.UBAH}
    hu = {n: md5(ub[n].encode('latin1')) for n in V.UBAH}
    db = ' UNION ALL '.join("SELECT %d AS n, '%s' AS h" % (n, hb[n]) for n in nomor)
    da = ' UNION ALL '.join("SELECT %d AS n, '%s' AS h" % (n, ha[n]) for n in V.UBAH)
    du = ' UNION ALL '.join("SELECT %d AS n, '%s' AS h" % (n, hu[n]) for n in V.UBAH)
    nf = ', '.join("'%s'" % f for f in V.FUNGSI)
    K = len(V.UBAH)
    pr = [KEPALA,
          '-- PRASYARAT (baca saja) "A|B|C|D|E|F": A = nomor %d-%d yang ada tetapi isinya bukan isi paket (harus 0) | B = nomor baru yang sudah persis '
          'paket | C = variabel lama yang diubah paket yang isinya persis DASAR | D = ... persis isi paket (C + D harus %d) | E = variabel yang dirujuk '
          'blangko/kueri yang ADA (harus %d) | F = fungsi bernama sama yang BUKAN milik paket (harus 0).\n' % (BLOK[0], BLOK[1], K, len(rujuk)),
          '-- Benar: "0|0|%d|0|%d|0" (pasang pertama) atau "0|%d|0|%d|%d|0" (pasang ulang). Selain itu berhenti, tidak ada yang diubah.\n' % (K, len(rujuk), len(nomor), K, len(rujuk)),
          "SELECT CONCAT_WS('|',\n",
          '  (SELECT COUNT(*) FROM aps_badilag.abt_variabel v WHERE v.no_var BETWEEN %d AND %d AND NOT EXISTS (SELECT 1 FROM (%s) x WHERE x.n = v.no_var AND x.h = %s)),\n'
          % (BLOK[0], BLOK[1], db, MD5_VAR),
          '  (SELECT COUNT(*) FROM aps_badilag.abt_variabel v JOIN (%s) x ON x.n = v.no_var AND x.h = %s),\n' % (db, MD5_VAR),
          '  (SELECT COUNT(*) FROM aps_badilag.abt_variabel v JOIN (%s) x ON x.n = v.no_var AND x.h = MD5(v.sql_query)),\n' % da,
          '  (SELECT COUNT(*) FROM aps_badilag.abt_variabel v JOIN (%s) x ON x.n = v.no_var AND x.h = MD5(v.sql_query)),\n' % du,
          '  (SELECT COUNT(*) FROM aps_badilag.abt_variabel v WHERE v.no_var IN (%s)),\n' % ', '.join(str(n) for n in rujuk),
          "  (SELECT COUNT(*) FROM information_schema.ROUTINES r WHERE r.ROUTINE_SCHEMA = 'aps_badilag' AND r.ROUTINE_NAME IN (%s) AND r.ROUTINE_COMMENT NOT IN (%s))\n"
          % (nf, ', '.join(hx(c) for c in komentar_fungsi(fungsi))),
          ') AS prasyarat;\n']
    ps = [KEPALA, '-- PASANG: satu transaksi. Baris baru INSERT ... WHERE NOT EXISTS; baris lama diubah HANYA bila isinya persis dasar paket (aman diulang).\n',
          'START TRANSACTION;\n']
    for n in nomor:
        nama, q = vb[n]
        ps.append("INSERT INTO aps_badilag.abt_variabel (no_var, nama, data_type, sql_query, locked) SELECT %d, %s, 'data_sql', %s, 0 FROM DUAL "
                  'WHERE NOT EXISTS (SELECT 1 FROM aps_badilag.abt_variabel WHERE no_var = %d);\n' % (n, hx(nama), hx(q), n))
    for n in V.UBAH:
        ps.append("UPDATE aps_badilag.abt_variabel SET sql_query = %s WHERE no_var = %d AND MD5(sql_query) = '%s';\n" % (hx(ub[n]), n, ha[n]))
    ps.append('COMMIT;\n')
    pe = [KEPALA, '-- PERIKSA (baca saja): tiap baris persis isi paket. Baris terakhir harus: SEMUA COCOK\n', 'SELECT label, ok FROM (\n']
    baris = ["SELECT 'variabel %d' AS label, (SELECT COUNT(*) FROM aps_badilag.abt_variabel v WHERE v.no_var = %d AND %s = '%s') AS ok" % (n, n, MD5_VAR, hb[n]) for n in nomor]
    baris += ["SELECT 'variabel %d diubah' AS label, (SELECT COUNT(*) FROM aps_badilag.abt_variabel v WHERE v.no_var = %d AND MD5(v.sql_query) = '%s') AS ok" % (n, n, hu[n]) for n in V.UBAH]
    baris += ["SELECT 'fungsi %s' AS label, (SELECT COUNT(*) FROM information_schema.ROUTINES r WHERE r.ROUTINE_SCHEMA = 'aps_badilag' AND r.ROUTINE_NAME = '%s') AS ok" % (f, f) for f in V.FUNGSI]
    pe.append('\nUNION ALL '.join(baris) + '\n) t\nUNION ALL SELECT IF((SELECT COUNT(*) FROM aps_badilag.abt_variabel v JOIN (%s) x ON x.n = v.no_var AND x.h = %s) = %d '
              'AND (SELECT COUNT(*) FROM aps_badilag.abt_variabel v JOIN (%s) x ON x.n = v.no_var AND x.h = MD5(v.sql_query)) = %d '
              "AND (SELECT COUNT(*) FROM information_schema.ROUTINES r WHERE r.ROUTINE_SCHEMA = 'aps_badilag' AND r.ROUTINE_NAME IN (%s)) = %d, 'SEMUA COCOK', 'TIDAK COCOK'), 1;\n"
              % (db, MD5_VAR, len(nomor), du, K, nf, len(V.FUNGSI)))
    pu = [KEPALA, '-- PULIH: baris baru dihapus HANYA bila isinya masih persis isi paket; baris lama dikembalikan HANYA bila isinya masih persis isi paket.\n',
          'START TRANSACTION;\n']
    for n in nomor:
        pu.append("DELETE FROM aps_badilag.abt_variabel WHERE no_var = %d AND MD5(CONCAT_WS('|', nama, data_type, IFNULL(sql_query, ''), locked)) = '%s';\n" % (n, hb[n]))
    for n in V.UBAH:
        pu.append("UPDATE aps_badilag.abt_variabel SET sql_query = %s WHERE no_var = %d AND MD5(sql_query) = '%s';\n" % (hx(asal[n]), n, hu[n]))
    pu.append('COMMIT;\n')
    fp = [KEPALA, '-- PULIH fungsi paket (hanya fungsi milik paket ini; PRASYARAT memastikan tidak ada fungsi lain bernama sama)\n']
    fp += ['DROP FUNCTION IF EXISTS aps_badilag.%s;\n' % f for f in V.FUNGSI]
    tulis('%s-PRASYARAT.sql' % N, ''.join(pr))
    tulis('%s-PASANG.sql' % N, ''.join(ps))
    tulis('%s-PERIKSA.sql' % N, ''.join(pe))
    tulis('%s-PULIH.sql' % N, ''.join(pu))
    tulis('%s-FUNGSI.sql' % N, fungsi)
    tulis('%s-FUNGSI-PULIH.sql' % N, ''.join(fp))
    tulis('nomor-baru.txt', '# nomor variabel baru paket (satu per baris)\n' + ''.join('%d\n' % n for n in nomor))
    tulis('nomor-ubah.txt', '# nomor variabel lama yang diubah paket (satu per baris)\n' + ''.join('%d\n' % n for n in V.UBAH))
    tulis('nomor-dirujuk.txt', '# variabel lama yang dirujuk blangko/kueri paket (harus ada di server)\n' + ''.join('%04d\n' % n for n in rujuk))
    uk = ['# nomor<TAB>kueri satu baris (#perkara_id# diganti; penanda #NNNN# lain diganti 0): diuji bahwa kueri JALAN di MariaDB server\n']
    for n in nomor:
        uk.append('%d\t%s\n' % (n, ' '.join(vb[n][1].split())))
    for n in V.UBAH:
        q = ub[n]
        assert '--' not in q and '/*' not in q and '\t' not in q
        uk.append('%d\t%s\n' % (n, ' '.join(q.split())))
    tulis('uji-kueri.tsv', ''.join(uk))
    # --- berkas timpa (deterministik) --------------------------------------------------------------------------------------------
    dt = ['# folder<TAB>berkas<TAB>md5_lama<TAB>md5_baru<TAB>ket - ditimpa HANYA bila md5 server persis md5_lama (lihat berkas_rtf.py)\n']
    buf = io.BytesIO()
    with gzip.GzipFile(fileobj=buf, mode='wb', mtime=0) as gz:
        with tarfile.open(fileobj=gz, mode='w', format=tarfile.USTAR_FORMAT) as tar:
            for f, b, m0, m1, isi in timpa:
                dt.append('derry_briantono/%s\t%s\t%s\t%s\t%s\n' % (f, b, m0, m1, 'sampul-rapi'))
                ti = tarfile.TarInfo('timpa/derry_briantono/%s/%s' % (f, b))
                ti.size, ti.mtime, ti.mode, ti.uid, ti.gid, ti.uname, ti.gname = len(isi), 0, 0o644, 0, 0, 'root', 'root'
                tar.addfile(ti, io.BytesIO(isi))
    open(os.path.join(PAKET, 'timpa.tgz'), 'wb').write(buf.getvalue())
    tulis('daftar-timpa.tsv', ''.join(dt))
    for x in ('berkas_rtf.py', 'pasang-satker.sh', 'pulih-satker.sh'):
        shutil.copyfile(os.path.join(SINI, x), os.path.join(PAKET, x))
    with open(os.path.join(PAKET, 'harap.txt'), 'w', newline='\n') as o:
        o.write("HARAP='0|0|%d|0|%d|0'\nULANG='0|%d|0|%d|%d|0'\n" % (K, len(rujuk), len(nomor), K, len(rujuk)))
    nama_berkas = sorted(x for x in os.listdir(PAKET) if os.path.isfile(os.path.join(PAKET, x)) and x != 'MD5SUMS.txt')
    tulis('MD5SUMS.txt', ''.join('%s  %s\n' % (md5(open(os.path.join(PAKET, x), 'rb').read()), x) for x in nama_berkas))
    json.dump({'paket': N, 'basis': BASIS, 'dasar_rtf': DASAR, 'variabel_baru': {str(n): {'nama': vb[n][0], 'md5': hb[n]} for n in nomor},
               'variabel_ubah': {str(n): {'md5_lama': ha[n], 'md5_baru': hu[n]} for n in V.UBAH}, 'fungsi': V.FUNGSI, 'dirujuk': rujuk,
               'timpa': [{'folder': f, 'berkas': b, 'md5_lama': m0, 'md5_baru': m1} for f, b, m0, m1, _ in timpa]},
              open(os.path.join(HASIL, 'isi-paket.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('variabel baru %d, diubah %d, fungsi %d, dirujuk %d, blangko ditimpa %d' % (len(nomor), K, len(V.FUNGSI), len(rujuk), len(timpa)))


def komentar_fungsi(teks):
    return re.findall(r"COMMENT '([^']*)'", teks)


if __name__ == '__main__':
    main()
