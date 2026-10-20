# -*- coding: utf-8 -*-
"""Membangun PAKET ABT "abt-w2b-keluarga-lain" di abt-paket/w2b-keluarga-lain/paket-satker/ (siap di-scp ke server).

Masukan (disusun tiap keluarga; lihat PASANG.md):
  sumber/variabel_poligami.py | variabel_anak.py | variabel_lain.py   -> variabel 4850-4949 (lewat variabel_def.v)
  rtf/<folder>/<berkas>.rtf                                           -> blangko BARU (folder berawalan derry_briantono/)
  timpa/derry_briantono/<folder>/<berkas>.rtf + daftar-timpa-*.tsv    -> blangko LAMA versi baru (hanya bila md5 server persis md5 lama)
  folder-baru-*.txt                                                    -> folder baru (relatif _blangko_abt), bila ada
  sumber/uji-perkara-*.txt                                             -> nomor perkara SIPP untuk uji kueri di server (satu per baris)
Keluaran: PRASYARAT/PASANG/PERIKSA/PULIH.sql, rtf/, timpa/, daftar-*.tsv, uji-kueri.tsv, skrip, MD5SUMS.txt
Pakai: python bangun_paket.py
"""
import glob
import hashlib
import os
import re
import shutil
import sys

AKAR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(AKAR, 'alat'))
import variabel_def as V  # noqa: E402
import token_rtf  # noqa: E402

NAMA = 'abt-w2b-keluarga-lain'
PAKET = os.path.join(AKAR, 'paket-satker')
TANGGAL = '2026-10-21 04:00:00'


def md5s(t):
    return hashlib.md5(t.encode('cp1252')).hexdigest()


def md5f(p):
    return hashlib.md5(open(p, 'rb').read()).hexdigest()


def hexs(t):
    return '0x' + t.encode('cp1252').hex()


def satu_baris(sql):
    return re.sub(r'\s+', ' ', sql).strip().rstrip(';').strip()


def kondisi_md5(x):
    sql = x['sql']
    s = "no_var=%d AND MD5(nama)='%s' AND data_type='%s'" % (x['no'], md5s(x['nama']), x['tipe'])
    s += (" AND MD5(sql_query)='%s'" % md5s(sql)) if sql else " AND sql_query IS NULL"
    s += " AND default_data IS NULL AND referensi IS NULL"
    return s


def tulis(path, isi):
    with open(path, 'w', encoding='utf-8', newline='\n') as f:
        f.write(isi)


def baca_daftar(pola):
    baris = []
    for p in sorted(glob.glob(os.path.join(AKAR, pola))):
        for b in open(p, encoding='utf-8').read().split('\n'):
            if b and not b.startswith('#'):
                baris.append(b)
    return baris


def main():
    if os.path.isdir(PAKET):
        shutil.rmtree(PAKET)
    os.makedirs(PAKET)
    var = sorted(V.VAR, key=lambda x: x['no'])
    nomor = [x['no'] for x in var]
    daftar_no = ','.join(str(n) for n in nomor) or '0'
    rtf = token_rtf.semua()
    milik = set('%04d' % n for n in nomor)
    pakai = set()
    for v in rtf.values():
        pakai |= v
    pakai |= token_rtf.dari_sql()
    lama = sorted(pakai - milik)
    daftar_lama = ','.join("'%s'" % k for k in lama)
    perkara = []
    for p in sorted(glob.glob(os.path.join(AKAR, 'sumber', 'uji-perkara-*.txt'))):
        perkara += [b.strip() for b in open(p, encoding='utf-8').read().split('\n') if b.strip() and not b.startswith('#')]
    uji_perkara = "SELECT perkara_id FROM perkara WHERE nomor_perkara IN (%s)" % ','.join("'%s'" % n for n in perkara) if perkara else 'SELECT 0'
    kop = ('-- Paket ABT "%s" (agen W2b, 20-21 Okt 2026): keluarga dan lain-lain - izin poligami, pencegahan dan pembatalan perkawinan, hak asuh, penguasaan anak, '
           'nafkah anak, pengangkatan anak, mafqud, permohonan umum. %d variabel baru dalam jatah 4850-4949; blangko baru dan blangko lama diperbarui dengan penjaga md5.\n') % (NAMA, len(var))

    sama = ' OR '.join('(%s)' % kondisi_md5(x) for x in var) or '1=0'
    prasyarat = (kop + '-- PRASYARAT (baca saja) "A|B|C|D|E": A = nomor milik paket yang berisi LAIN (harus 0) | B = yang sudah berisi persis paket (0 pertama, %d ulang) '
                 '| C = variabel lama yang dirujuk blangko ADA (harus %d) | D, E = 0.\n'
                 '-- Benar: "0|0|%d|0|0" (pertama) atau "0|%d|%d|0|0" (pasang ulang).\n' % (len(var), len(lama), len(lama), len(var), len(lama)))
    prasyarat += ("SELECT CONCAT((SELECT COUNT(*) FROM abt_variabel WHERE no_var IN (%s) AND NOT (%s)),'|',(SELECT COUNT(*) FROM abt_variabel WHERE %s),'|',"
                  "(SELECT COUNT(*) FROM abt_variabel WHERE no_var IN (%s)),'|',0,'|',0) AS prasyarat;\n") % (daftar_no, sama, sama, daftar_lama or "''")
    tulis(os.path.join(PAKET, NAMA + '-PRASYARAT.sql'), prasyarat)

    pasang = kop + '-- PASANG: satu transaksi; variabel yang sudah berisi paket tidak berubah (pasang ulang aman).\nSET NAMES latin1;\nSTART TRANSACTION;\n'
    for x in var:
        sql = hexs(x['sql']) if x['sql'] else 'NULL'
        pasang += ("INSERT INTO abt_variabel (no_var, nama, data_type, data_tabel, data_kolom, urutan_data, referensi, sql_query, default_data, multi_sidang, locked, modifier, modified) "
                   "SELECT %d, %s, '%s', NULL, NULL, NULL, NULL, %s, NULL, NULL, 0, 'admin', '%s' FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM abt_variabel WHERE no_var=%d);\n") % (
            x['no'], hexs(x['nama']), x['tipe'], sql, TANGGAL, x['no'])
    pasang += 'COMMIT;\n'
    tulis(os.path.join(PAKET, NAMA + '-PASANG.sql'), pasang)

    periksa = kop + '-- PERIKSA: tiap variabel baru persis isi paket (nama, tipe, kueri) dan variabel lama ada; baris terakhir "SEMUA COCOK".\n'
    for x in var:
        periksa += "SELECT 'var %d' AS butir, (SELECT COUNT(*) FROM abt_variabel WHERE %s) AS cocok;\n" % (x['no'], kondisi_md5(x))
    periksa += ("SELECT IF((SELECT COUNT(*) FROM abt_variabel WHERE no_var IN (%s))=%d AND (SELECT COUNT(*) FROM abt_variabel WHERE %s)=%d, 'SEMUA COCOK', 'TIDAK COCOK') AS hasil;\n"
                % (daftar_lama or "''", len(lama), sama, len(var)))
    tulis(os.path.join(PAKET, NAMA + '-PERIKSA.sql'), periksa)

    pulih = kop + '-- PULIH (deterministik): variabel baru dihapus HANYA bila isinya masih persis paket.\nSTART TRANSACTION;\n'
    for x in var:
        pulih += "DELETE FROM abt_variabel WHERE %s;\n" % kondisi_md5(x)
    pulih += 'COMMIT;\n'
    pulih += ("SELECT IF((SELECT COUNT(*) FROM abt_variabel WHERE no_var IN (%s))=0, 'PULIH COCOK', CONCAT('PULIH TIDAK LENGKAP - variabel baru yang masih ada ', (SELECT COUNT(*) FROM abt_variabel WHERE no_var IN (%s)), "
              "' (diubah orang sesudah dipasang? dibiarkan)')) AS hasil;\n") % (daftar_no, daftar_no)
    tulis(os.path.join(PAKET, NAMA + '-PULIH.sql'), pulih)

    # --- RTF baru --------------------------------------------------------------------------------------------------------------
    baris_rtf = []
    for d, _, fs in os.walk(os.path.join(AKAR, 'rtf')):
        for f in sorted(fs):
            if not f.lower().endswith('.rtf'):
                continue
            src = os.path.join(d, f)
            rel = os.path.relpath(src, os.path.join(AKAR, 'rtf')).replace('\\', '/')
            folder = os.path.dirname(rel)
            dst = os.path.join(PAKET, 'rtf', rel)
            os.makedirs(os.path.dirname(dst), exist_ok=True)
            shutil.copyfile(src, dst)
            baris_rtf.append('\t'.join([folder, f, md5f(dst), 'disusun dari berkas Derry pohon server 20 Okt 2026 (alat sumber/susun_*.py)']))
    tulis(os.path.join(PAKET, 'daftar-rtf.tsv'), '# folder<TAB>berkas<TAB>md5<TAB>asal - berkas BARU\n' + '\n'.join(sorted(baris_rtf)) + '\n')

    # --- RTF timpa -------------------------------------------------------------------------------------------------------------
    baris_timpa = baca_daftar('daftar-timpa-*.tsv')
    seen = set()
    for b in baris_timpa:
        folder, berkas = b.split('\t')[:2]
        assert (folder, berkas) not in seen, 'timpa ganda: ' + berkas
        seen.add((folder, berkas))
        dst = os.path.join(PAKET, 'timpa', folder, berkas)
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        shutil.copyfile(os.path.join(AKAR, 'timpa', folder, berkas), dst)
        assert md5f(dst) == b.split('\t')[3], 'md5 timpa tidak cocok: ' + berkas
    tulis(os.path.join(PAKET, 'daftar-timpa.tsv'), '# folder<TAB>berkas<TAB>md5_lama<TAB>md5_baru<TAB>ket\n' + '\n'.join(sorted(baris_timpa)) + '\n')
    folder_baru = baca_daftar('folder-baru-*.txt')
    folder_ada = sorted(set([b.split('\t')[0] for b in baris_rtf] + [b.split('\t')[0] for b in baris_timpa]) - set(folder_baru))
    tulis(os.path.join(PAKET, 'folder-ada.txt'), '# folder (relatif _blangko_abt) yang harus SUDAH ada\n' + '\n'.join(folder_ada) + '\n')
    tulis(os.path.join(PAKET, 'folder-baru.txt'), '# folder BARU (relatif _blangko_abt) yang dibuat paket ini\n' + '\n'.join(folder_baru) + ('\n' if folder_baru else ''))
    for kosong in ('daftar-dasar.tsv', 'daftar-pindah.tsv', 'daftar-sunting.tsv'):
        tulis(os.path.join(PAKET, kosong), '# tidak dipakai paket ini\n')

    uji = '# no_var<TAB>kueri (#perkara_id# diganti pasang-satker.sh; hanya SELECT; penanda isian #nnnn# dibiarkan sebagai teks)\n'
    for x in var:
        if x['tipe'] == 'data_sql' and x['sql']:
            uji += '%d\t%s\n' % (x['no'], satu_baris(x['sql']))
    tulis(os.path.join(PAKET, 'uji-kueri.tsv'), uji)

    alat = os.path.join(AKAR, 'alat')
    shutil.copyfile(os.path.join(alat, 'berkas_rtf.py'), os.path.join(PAKET, 'berkas_rtf.py'))
    ps = open(os.path.join(alat, 'pasang-satker.sh'), encoding='utf-8').read()
    ps = re.sub(r'# PASANG paket ABT "[^"]*" \([^)]*\)\. Dijalankan', '# PASANG paket ABT "%s" (20-21 Okt 2026, agen W2b). Dijalankan' % NAMA, ps, count=1)
    ps = re.sub(r'# Isi:.*\n', '# Isi: %d variabel baru dalam jatah 4850-4949; blangko BARU dan blangko lama diperbarui (penjaga md5, cadangan utuh).\n' % len(var), ps, count=1)
    ps = re.sub(r'# Paket yang harus terpasang lebih dulu:.*\n', '# Paket yang harus terpasang lebih dulu: paket gelombang 1 (u2..u6) dan paket DK/Wali Adhal/Perwalian terbaru bila dipasang; md5 berkas lama dicek per berkas (beda = GAGAL tanpa mengubah apa pun).\n', ps, count=1)
    ps = re.sub(r"N=abt-[a-z0-9-]+", 'N=' + NAMA, ps, count=1)
    ps = re.sub(r"HARAP='[^']*'", "HARAP='0|0|%d|0|0'" % len(lama), ps, count=1)
    ps = re.sub(r"ULANG='[^']*'", "ULANG='0|%d|%d|0|0'" % (len(var), len(lama)), ps, count=1)
    ps = ps.replace('no_var IN (9654)', 'no_var IN (%s)' % daftar_no)
    ps = ps.replace('SELECT 0" 2>/dev/null', uji_perkara.replace('"', '\\"') + '" 2>/dev/null')
    ps = ps.replace("ABT_DB=aps_badilag_i17", "ABT_DB=aps_badilag_w2b")
    tulis(os.path.join(PAKET, 'pasang-satker.sh'), ps)
    pl = open(os.path.join(alat, 'pulih-satker.sh'), encoding='utf-8').read()
    pl = re.sub(r'# PULIH paket ABT "[^"]*" \([^)]*\)', '# PULIH paket ABT "%s" (20-21 Okt 2026, agen W2b)' % NAMA, pl, count=1)
    pl = re.sub(r"N=abt-[a-z0-9-]+", 'N=' + NAMA, pl, count=1)
    pl = pl.replace('no_var IN (9654)', 'no_var IN (%s)' % daftar_no)
    pl = pl.replace('ABT_DB=aps_badilag_i17', 'ABT_DB=aps_badilag_w2b')
    tulis(os.path.join(PAKET, 'pulih-satker.sh'), pl)

    sums = []
    for d, _, fs in os.walk(PAKET):
        for f in fs:
            if f == 'MD5SUMS.txt':
                continue
            p = os.path.join(d, f)
            sums.append('%s  %s' % (md5f(p), os.path.relpath(p, PAKET).replace('\\', '/')))
    tulis(os.path.join(PAKET, 'MD5SUMS.txt'), '\n'.join(sorted(sums, key=lambda t: t.split('  ', 1)[1])) + '\n')
    print('paket:', PAKET, '| variabel', len(var), '| rtf baru', len(baris_rtf), '| timpa', len(baris_timpa), '| variabel lama dirujuk', len(lama))


if __name__ == '__main__':
    main()
