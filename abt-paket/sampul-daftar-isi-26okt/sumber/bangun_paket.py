#!/usr/bin/env python3
# Membangun paket-satker/ paket ABT "abt-sampul-daftar-isi-26okt" (pola paket w3a): variabel baru (blok 5700-5779 dan 5800-5899), satu fungsi tersimpan,
# satu baris abt_menu (folder "98b Berkas Perkara - BAS" untuk Panitera Sidang), enam berkas RTF (sampul: folder 99 PTSP yang sudah ada;
# daftar isi: folder baru). Hanya pengguna Derry (derry_briantono). Hanya MEMBACA SIPP. Tidak menyentuh blangko, variabel, atau menu lain.
# Jalankan:  python -I sumber/bangun_paket.py   (dari folder paket)
import hashlib, io, os, shutil, sys

SINI = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(SINI, 'alat'))
import bangun_variabel as bv   # noqa: E402
import bangun_rtf as br        # noqa: E402

N = 'abt-sampul-daftar-isi-26okt'
TUJ = os.path.join(SINI, 'paket-satker')
FOLDER_SAMPUL = 'derry_briantono/99 PTSP'
FOLDER_DAFTAR = 'derry_briantono/98b Berkas Perkara - BAS'
MENU = dict(nama='Daftar Isi Berkas Perkara', nama_alias='Daftar Isi Berkas - BAS', direktori='98b Berkas Perkara - BAS', parent_direktori='derry_briantono',
            proses_id_min=20, proses_id_max=1000, perkara_id_min=15, perkara_id_max=17, perkara_id_referensi='alur_perkara_id', user_cek=3,
            user_grup_id='1|30|500|430|1000|1010|1020', user_top_id='1|30', user_validator='10|20')
FUNGSI = 'isian_rtf_daftar_isi'
KOLOM_MENU = ['nama', 'nama_alias', 'direktori', 'parent_direktori', 'proses_id_min', 'proses_id_max', 'perkara_id_min', 'perkara_id_max', 'perkara_id_referensi',
              'user_cek', 'user_grup_id', 'user_top_id', 'user_validator']


def md5s(t):
    return hashlib.md5(t.encode('latin1')).hexdigest()


def q(s):
    return "'" + s.replace('\\', '\\\\').replace("'", "''") + "'"


def md5_var(nama, tipe, kueri):
    # sama dengan MD5(CONCAT_WS('|', nama, data_type, IFNULL(sql_query,''), locked)) di SQL
    return md5s('|'.join([nama, tipe, kueri or '', '1' if tipe == 'data_sql' else '0']))


def md5_menu():
    m = MENU
    return md5s('|'.join([m['nama'], m['nama_alias'], m['direktori'], m['parent_direktori'], str(m['proses_id_min']), str(m['proses_id_max']), str(m['perkara_id_min']),
                          str(m['perkara_id_max']), m['perkara_id_referensi'], str(m['user_cek']), m['user_grup_id'], m['user_top_id'], '']))


SQL_MD5_VAR = "MD5(CONCAT_WS('|', v.nama, v.data_type, IFNULL(v.sql_query, ''), v.locked))"
SQL_MD5_MENU = "MD5(CONCAT_WS('|', nama, nama_alias, direktori, parent_direktori, proses_id_min, proses_id_max, perkara_id_min, perkara_id_max, perkara_id_referensi, user_cek, user_grup_id, user_top_id, IFNULL(user_validator,'')))"
KET = "-- Paket ABT \"%s\" (26 Okt 2026): sampul berkas perkara dan daftar isi berkas (blangko Derry). %d variabel baru (5700-5779, 5800-5899), fungsi %s, satu baris abt_menu (%s), enam blangko RTF.\n" % (N, len(bv.V), FUNGSI, MENU['direktori'])


def tulis(nama, isi, mode='w'):
    p = os.path.join(TUJ, nama)
    d = os.path.dirname(p)
    if not os.path.isdir(d): os.makedirs(d)
    with io.open(p, 'w', encoding='latin1', newline='\n') as f:
        f.write(isi)
    return p


def bangun():
    bv.cek()
    if os.path.isdir(TUJ): shutil.rmtree(TUJ)
    os.makedirs(TUJ)
    kodes = [v[0] for v in bv.V]
    daftar_md5 = [(k, md5_var(n, t, c)) for k, n, t, c in bv.V]
    tabel_md5 = ' UNION ALL '.join("SELECT %d AS n, '%s' AS h" % (k, h) for k, h in daftar_md5)

    # --- PRASYARAT: A|B|C|D|E|F|G
    pras = KET + (
        "-- PRASYARAT (baca saja) \"A|B|C|D|E|F|G\": A = variabel nomor paket yang sudah ada tetapi isinya LAIN (harus 0) | B = yang sudah persis paket (0 pertama, %d pasang ulang) | "
        "C = variabel lama yang dirujuk RTF/kueri ADA (harus %d) | D = baris abt_menu folder baru (0 pertama, 1 pasang ulang) | E = abt_menu id 991 (folder 99 PTSP) ada (1) | "
        "F = fungsi %s sudah ada (0 pertama, 1 pasang ulang) | G = nomor lain di blok 5700-5779 dan 5800-5899 yang dipakai bukan oleh paket (harus 0).\n" % (len(bv.V), len(bv.RUJUKAN), FUNGSI) +
        "-- Benar: \"0|0|%d|0|1|0|0\" (pertama) atau \"0|%d|%d|1|1|1|0\" (pasang ulang).\n" % (len(bv.RUJUKAN), len(bv.V), len(bv.RUJUKAN)) +
        "SELECT CONCAT_WS('|',\n"
        "  (SELECT COUNT(*) FROM abt_variabel v JOIN (%s) p ON p.n = v.no_var WHERE %s <> p.h),\n" % (tabel_md5, SQL_MD5_VAR) +
        "  (SELECT COUNT(*) FROM abt_variabel v JOIN (%s) p ON p.n = v.no_var WHERE %s = p.h),\n" % (tabel_md5, SQL_MD5_VAR) +
        "  (SELECT COUNT(*) FROM abt_variabel WHERE no_var IN (%s)),\n" % ','.join(str(x) for x in bv.RUJUKAN) +
        "  (SELECT COUNT(*) FROM abt_menu WHERE direktori = %s AND parent_direktori = %s),\n" % (q(MENU['direktori']), q(MENU['parent_direktori'])) +
        "  (SELECT COUNT(*) FROM abt_menu WHERE id = 991),\n"
        "  (SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema = DATABASE() AND routine_name = '%s'),\n" % FUNGSI +
        "  (SELECT COUNT(*) FROM abt_variabel WHERE ((no_var BETWEEN 5700 AND 5779) OR (no_var BETWEEN 5800 AND 5899)) AND no_var NOT IN (%s))\n" % ','.join(str(k) for k in kodes) +
        ");\n")
    tulis('%s-PRASYARAT.sql' % N, pras)

    # --- PASANG
    p = [KET, "-- PASANG: satu transaksi. Hanya INSERT ... WHERE NOT EXISTS (aman diulang). Fungsi dipasang lebih dulu oleh pasang-satker.sh.\n", "START TRANSACTION;\n"]
    for k, n, t, c in bv.V:
        locked = 1 if t == 'data_sql' else 0
        p.append("INSERT INTO abt_variabel (no_var, nama, data_type, sql_query, locked) SELECT %d, %s, %s, %s, %d FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM abt_variabel WHERE no_var = %d);\n"
                 % (k, q(n), q(t), q(c) if c else 'NULL', locked, k))
    m = MENU
    nilai = ', '.join(q(m[c]) if isinstance(m[c], str) else str(m[c]) for c in KOLOM_MENU[:-1])
    p.append("INSERT INTO abt_menu (id, %s) SELECT (SELECT n FROM (SELECT IFNULL(MAX(id), 0) + 1 AS n FROM abt_menu) mm), %s, NULL FROM DUAL "
             "WHERE NOT EXISTS (SELECT 1 FROM abt_menu WHERE direktori = %s AND parent_direktori = %s);\n" % (', '.join(KOLOM_MENU), nilai, q(m['direktori']), q(m['parent_direktori'])))
    p.append("COMMIT;\n")
    tulis('%s-PASANG.sql' % N, ''.join(p))

    # --- PERIKSA: baris yang TIDAK cocok, lalu satu baris akhir "SEMUA COCOK"
    per = [KET, "-- PERIKSA (baca saja): tiap variabel, baris menu, dan fungsi persis isi paket. Baris terakhir harus: SEMUA COCOK\n",
           "SELECT label, ok FROM (\n"]
    cek = []
    for k, h in daftar_md5:
        cek.append("SELECT 'variabel %d' AS label, (SELECT COUNT(*) FROM abt_variabel v WHERE v.no_var = %d AND %s = '%s') AS ok" % (k, k, SQL_MD5_VAR, h))
    cek.append("SELECT 'menu %s', (SELECT COUNT(*) FROM abt_menu WHERE direktori = %s AND parent_direktori = %s AND %s = '%s')" % (MENU['direktori'], q(MENU['direktori']), q(MENU['parent_direktori']), SQL_MD5_MENU, md5_menu()))
    cek.append("SELECT 'fungsi %s', (SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema = DATABASE() AND routine_name = '%s')" % (FUNGSI, FUNGSI))
    per.append('\nUNION ALL '.join(cek))
    per.append("\n) c WHERE ok <> 1\nUNION ALL\nSELECT IF(COUNT(*) = %d, 'SEMUA COCOK', CONCAT(%d - COUNT(*), ' TIDAK COCOK')), COUNT(*) FROM (\n" % (len(cek), len(cek)))
    per.append('\nUNION ALL '.join(cek).replace("SELECT 'variabel", "SELECT 'variabel"))
    per.append("\n) d WHERE ok = 1;\n")
    tulis('%s-PERIKSA.sql' % N, ''.join(per))

    # --- PULIH (deterministik): baris baru dihapus HANYA bila isinya masih persis paket
    pu = [KET, "-- PULIH (deterministik): baris baru dihapus HANYA bila isinya masih persis paket (yang sudah disunting orang dibiarkan dan dilaporkan oleh pulih-satker.sh).\n", "START TRANSACTION;\n"]
    for k, h in daftar_md5:
        pu.append("DELETE FROM abt_variabel WHERE no_var = %d AND MD5(CONCAT_WS('|', nama, data_type, IFNULL(sql_query, ''), locked)) = '%s';\n" % (k, h))
    pu.append("DELETE FROM abt_menu WHERE direktori = %s AND parent_direktori = %s AND %s = '%s';\n" % (q(MENU['direktori']), q(MENU['parent_direktori']), SQL_MD5_MENU, md5_menu()))
    pu.append("COMMIT;\nDROP FUNCTION IF EXISTS %s;\n" % FUNGSI)
    pu.append("SELECT 'PULIH SQL SELESAI';\n")
    tulis('%s-PULIH.sql' % N, ''.join(pu))

    # --- fungsi
    tulis('%s-FUNGSI.sql' % N, io.open(os.path.join(SINI, 'sumber', 'fungsi.sql'), encoding='utf-8').read())

    # --- RTF + daftar
    baris = []
    for nama, isi in br.semua().items():
        folder = FOLDER_SAMPUL if nama.startswith('Sampul') else FOLDER_DAFTAR
        sub = os.path.join(TUJ, 'rtf', folder.replace('/', os.sep))
        os.makedirs(sub, exist_ok=True)
        data = isi.encode('ascii')
        with open(os.path.join(sub, nama), 'wb') as f:
            f.write(data)
        baris.append('%s\t%s\t%s\tdibangun alat/bangun_rtf.py (26 Okt 2026)' % (folder, nama, hashlib.md5(data).hexdigest()))
    tulis('daftar-rtf.tsv', "# folder<TAB>berkas<TAB>md5<TAB>asal - berkas BARU dari <paket>/rtf/ (tidak pernah menimpa berkas lain)\n" + '\n'.join(sorted(baris)) + '\n')
    tulis('folder-ada.txt', "# folder (relatif _blangko_abt) yang harus SUDAH ada\nderry_briantono\n%s\n" % FOLDER_SAMPUL)
    tulis('folder-baru.txt', "# folder BARU (relatif _blangko_abt) yang dibuat paket ini; dihapus pulih-satker.sh bila kosong\n%s\n" % FOLDER_DAFTAR)
    # daftar variabel (untuk cadangan/pulih)
    tulis('nomor-variabel.txt', ','.join(str(k) for k in kodes) + '\n')

    # --- uji kueri (baca saja): penanda #dddd# dikosongkan; hanya SELECT
    import re
    uji = ["# no_var<TAB>kueri (#perkara_id# diganti pasang-satker.sh; hanya SELECT; penanda isian #nnnn# dikosongkan)\n"]
    for k, n, t, c in bv.V:
        if t != 'data_sql': continue
        uji.append('%d\t%s\n' % (k, re.sub(r'#\d{4}#', '', c)))
    tulis('uji-kueri.tsv', ''.join(uji))

    # --- skrip, berkas_rtf.py
    shutil.copyfile(os.path.join(SINI, 'sumber', 'berkas_rtf.py'), os.path.join(TUJ, 'berkas_rtf.py'))
    for nm in ('pasang-satker.sh', 'pulih-satker.sh'):
        t = io.open(os.path.join(SINI, 'sumber', nm), encoding='utf-8').read()
        t = t.replace('@@N@@', N).replace('@@FUNGSI@@', FUNGSI).replace('@@HARAP@@', '0|0|%d|0|1|0|0' % len(bv.RUJUKAN)).replace('@@ULANG@@', '0|%d|%d|1|1|1|0' % (len(bv.V), len(bv.RUJUKAN)))
        t = t.replace('@@NOMOR@@', ','.join(str(k) for k in kodes)).replace('@@JUMLAH@@', str(len(bv.V)))
        tulis(nm, t)
    # --- MD5SUMS
    rows = []
    for akar, _, berkas in os.walk(TUJ):
        for b in berkas:
            if b == 'MD5SUMS.txt': continue
            pth = os.path.join(akar, b)
            rel = os.path.relpath(pth, TUJ).replace(os.sep, '/')
            rows.append('%s  %s' % (hashlib.md5(open(pth, 'rb').read()).hexdigest(), rel))
    with open(os.path.join(TUJ, 'MD5SUMS.txt'), 'w', newline='\n') as f:
        f.write('\n'.join(sorted(rows, key=lambda x: x.split('  ', 1)[1])) + '\n')
    print('paket-satker dibangun:', len(rows), 'berkas;', len(bv.V), 'variabel; RUJUKAN', len(bv.RUJUKAN))


if __name__ == '__main__':
    bangun()
