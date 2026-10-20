# -*- coding: utf-8 -*-
"""Membangun PAKET ABT "abt-w3b-blangko-baru-kuasa-wali" di abt-paket/w3b-blangko-baru-kuasa-wali/paket-satker/ (siap di-scp ke server).

Isi paket (semua BARU; tidak ada berkas atau baris lama yang diubah):
  abt-w3b-PRASYARAT.sql / PASANG.sql / PERIKSA.sql / PULIH.sql   variabel baru 3800-3999 (hex cp1252, berpenjaga md5), menu abt_menu baru (putusan + BAS per jenis)
  rtf/<folder>/<berkas>                                          blangko BARU (tidak pernah menimpa berkas lain)
  berkas_rtf.py, pasang-satker.sh, pulih-satker.sh, daftar-*.tsv, folder-*.txt, uji-kueri.tsv, MD5SUMS.txt
Pakai: python bangun_semua.py   (menyusun rtf/ dari spek)  lalu  python bangun_paket.py
"""
import hashlib
import importlib
import os
import re
import shutil
import sys

AKAR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(AKAR, 'alat'))
import variabel_def as V  # noqa: E402
import jenis as J  # noqa: E402
from bangun import lp  # noqa: E402

NAMA = 'abt-w3b-blangko-baru-kuasa-wali'
PAKET = os.path.join(AKAR, 'paket-satker')
SUMBER_RTF = os.path.join(AKAR, 'rtf')
TANGGAL = '2026-10-21 00:00:00'
KUERI_PERKARA = ("SELECT perkara_id FROM perkara WHERE nomor_perkara IN ('61/Pdt.P/2026/PA.Dgl','85/Pdt.P/2026/PA.Dgl','27/Pdt.P/2025/PA.Dgl',"
                 "'26/Pdt.G/2022/PA.Dgl','715/Pdt.G/2025/PA.Dgl','265/Pdt.G/2024/PA.Dgl')")


def md5s(t):
    return hashlib.md5(t.encode('cp1252')).hexdigest()


def md5f(p):
    with open(lp(p), 'rb') as f:
        return hashlib.md5(f.read()).hexdigest()


def hexs(t):
    return '0x' + t.encode('cp1252').hex()


def satu_baris(sql):
    return re.sub(r'\s+', ' ', sql).strip().rstrip(';').strip()


def kondisi_var(x):
    s = "no_var=%d AND MD5(nama)='%s' AND data_type='%s'" % (x['no'], md5s(x['nama']), x['tipe'])
    s += (" AND MD5(sql_query)='%s'" % md5s(x['sql'])) if x['sql'] else " AND sql_query IS NULL"
    s += (" AND MD5(default_data)='%s'" % md5s(x['default'])) if x['default'] else " AND default_data IS NULL"
    s += (" AND referensi=%d" % x['referensi']) if x['referensi'] else " AND referensi IS NULL"
    return s


def lit(t):
    return 'NULL' if t is None else hexs(t)


def kondisi_menu(m):
    """Kondisi <=> (aman terhadap NULL) untuk satu baris abt_menu."""
    kol = ['nama', 'nama_alias', 'direktori', 'parent_direktori', 'perkara_id_referensi', 'user_grup_id', 'user_top_id', 'user_validator']
    angka = ['proses_id_min', 'proses_id_max', 'perkara_id_min', 'perkara_id_max', 'user_cek']
    s = ['id<=>%d' % m['id']]
    for k in kol:
        s.append('%s<=>%s' % (k, lit(m[k])))
    for k in angka:
        s.append('%s<=>%d' % (k, m[k]))
    return ' AND '.join(s)


def tulis(path, isi):
    with open(path, 'w', encoding='utf-8', newline='\n') as f:
        f.write(isi)


def token_rtf_semua():
    """{jalur relatif: set penanda 4 angka} dari semua RTF baru (termasuk teks tersembunyi)."""
    hasil = {}
    for d, _, fs in os.walk(lp(SUMBER_RTF)):
        for f in fs:
            if f.lower().endswith('.rtf'):
                p = os.path.join(d, f)
                raw = open(p, 'rb').read().decode('latin1')
                hasil[os.path.relpath(p, lp(SUMBER_RTF))] = set(re.findall(r'#(\d{4})#', raw))
    return hasil


def kumpul_menu():
    baris = []
    for kunci, info in J.JENIS.items():
        try:
            m = importlib.import_module(info['modul'])
        except ModuleNotFoundError as e:
            if e.name != info['modul']:
                raise
            continue
        a, b = J.menu_baris(kunci, m.SPEK['folder'])
        baris += [a, b]
    return baris


def main():
    if os.path.isdir(PAKET):
        shutil.rmtree(PAKET)
    os.makedirs(PAKET)
    assert not V.PANJANG, 'nama variabel > 200 huruf: %s' % V.PANJANG
    var = sorted(V.VAR, key=lambda x: x['no'])
    nomor = [x['no'] for x in var]
    assert len(set(nomor)) == len(nomor), 'nomor variabel kembar'
    daftar_no = ','.join(str(n) for n in nomor)
    menu = kumpul_menu()
    ids = ','.join(str(m['id']) for m in menu)
    dirs = ','.join("0x%s" % m['direktori'].encode('cp1252').hex() for m in menu)

    rtf = token_rtf_semua()
    milik = set('%04d' % n for n in nomor)
    pakai = set()
    for v in rtf.values():
        pakai |= v
    for x in var:
        pakai |= set(re.findall(r'#(\d{4})#', (x['sql'] or '') + x['nama'] + (x['default'] or '')))
        pakai |= set('%04d' % int(n) for n in re.findall(r'no_var = (\d{4})', x['sql'] or ''))
    lama = sorted(pakai - milik)
    daftar_lama = ','.join("'%s'" % k for k in lama)
    kop = ('-- Paket ABT "%s" (agen W3b, 21 Okt 2026): blangko Derry BARU untuk pencabutan kekuasaan orang tua (353), pencabutan kekuasaan wali (355), penunjukan wali (356), '
           'ganti rugi terhadap wali (357), nafkah anak oleh ibu (350), eksekusi dan verzet. %d variabel baru (3800-3999), %d menu baru, %d blangko RTF baru.\n') % (
        NAMA, len(var), len(menu), sum(1 for _ in rtf))

    sama_var = ' OR '.join('(%s)' % kondisi_var(x) for x in var)
    sama_menu = ' OR '.join('(%s)' % kondisi_menu(m) for m in menu)
    nm = len(menu)

    # --- PRASYARAT ---
    d_menu = ("(SELECT COUNT(*) FROM abt_menu WHERE id IN (%s) AND NOT (%s)) + (SELECT COUNT(*) FROM abt_menu WHERE id NOT IN (%s) AND parent_direktori=%s AND direktori IN (%s))"
              % (ids, sama_menu, ids, hexs('derry_briantono'), dirs))
    e_menu = "(SELECT COUNT(*) FROM abt_menu WHERE %s)" % sama_menu
    pras = kop + ('-- PRASYARAT (baca saja) "A|B|C|D|E": A = nomor 3800-3999 milik paket yang berisi LAIN (harus 0) | B = yang sudah berisi persis paket (0 pertama, %d ulang) '
                  '| C = variabel lama yang dirujuk ADA (harus %d) | D = id menu paket yang berisi lain, atau menu lain yang memakai folder paket (harus 0) | E = menu paket yang sudah terpasang (0 pertama, %d ulang).\n'
                  '-- Benar: "0|0|%d|0|0" (pertama) atau "0|%d|%d|0|%d" (pasang ulang).\n' % (len(var), len(lama), nm, len(lama), len(var), len(lama), nm))
    pras += ("SELECT CONCAT((SELECT COUNT(*) FROM abt_variabel WHERE no_var IN (%s) AND NOT (%s)),'|',(SELECT COUNT(*) FROM abt_variabel WHERE %s),'|',"
             "(SELECT COUNT(*) FROM abt_variabel WHERE no_var IN (%s)),'|',(%s),'|',(%s)) AS prasyarat;\n") % (daftar_no, sama_var, sama_var, daftar_lama, d_menu, e_menu)
    tulis(os.path.join(PAKET, NAMA + '-PRASYARAT.sql'), pras)

    # --- PASANG ---
    pasang = kop + '-- PASANG: satu transaksi; baris yang sudah berisi paket tidak berubah (pasang ulang aman); baris lama tidak disentuh.\nSET NAMES latin1;\nSTART TRANSACTION;\n'
    for x in var:
        pasang += ("INSERT INTO abt_variabel (no_var, nama, data_type, data_tabel, data_kolom, urutan_data, referensi, sql_query, default_data, multi_sidang, locked, modifier, modified) "
                   "SELECT %d, %s, '%s', NULL, NULL, NULL, %s, %s, %s, NULL, 0, 'admin', '%s' FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM abt_variabel WHERE no_var=%d);\n") % (
            x['no'], hexs(x['nama']), x['tipe'], x['referensi'] if x['referensi'] else 'NULL', lit(x['sql']), lit(x['default']), TANGGAL, x['no'])
    for m in menu:
        pasang += ("INSERT INTO abt_menu (id, nama, nama_alias, direktori, parent_direktori, proses_id_min, proses_id_max, perkara_id_min, perkara_id_max, perkara_id_referensi, "
                   "user_cek, user_grup_id, user_top_id, user_validator, modified) SELECT %d, %s, %s, %s, %s, %d, %d, %d, %d, %s, %d, %s, %s, %s, '%s' FROM DUAL "
                   "WHERE NOT EXISTS (SELECT 1 FROM abt_menu WHERE id=%d);\n") % (
            m['id'], lit(m['nama']), lit(m['nama_alias']), lit(m['direktori']), lit(m['parent_direktori']), m['proses_id_min'], m['proses_id_max'], m['perkara_id_min'],
            m['perkara_id_max'], lit(m['perkara_id_referensi']), m['user_cek'], lit(m['user_grup_id']), lit(m['user_top_id']), lit(m['user_validator']), m['modified'], m['id'])
    pasang += 'COMMIT;\n'
    tulis(os.path.join(PAKET, NAMA + '-PASANG.sql'), pasang)

    # --- PERIKSA ---
    per = kop + '-- PERIKSA: tiap variabel dan menu baru persis isi paket; baris terakhir "SEMUA COCOK".\n'
    for x in var:
        per += "SELECT 'var %d' AS butir, (SELECT COUNT(*) FROM abt_variabel WHERE %s) AS cocok;\n" % (x['no'], kondisi_var(x))
    for m in menu:
        per += "SELECT 'menu %d' AS butir, (SELECT COUNT(*) FROM abt_menu WHERE %s) AS cocok;\n" % (m['id'], kondisi_menu(m))
    per += ("SELECT IF((SELECT COUNT(*) FROM abt_variabel WHERE no_var IN (%s))=%d AND (SELECT COUNT(*) FROM abt_variabel WHERE %s)=%d AND %s=%d, 'SEMUA COCOK', 'TIDAK COCOK') AS hasil;\n"
            % (daftar_lama, len(lama), sama_var, len(var), e_menu, nm))
    tulis(os.path.join(PAKET, NAMA + '-PERIKSA.sql'), per)

    # --- PULIH ---
    pul = kop + '-- PULIH (deterministik): variabel dan menu baru dihapus HANYA bila isinya masih persis paket.\nSTART TRANSACTION;\n'
    for x in var:
        pul += "DELETE FROM abt_variabel WHERE %s;\n" % kondisi_var(x)
    for m in menu:
        pul += "DELETE FROM abt_menu WHERE %s;\n" % kondisi_menu(m)
    pul += 'COMMIT;\n'
    pul += ("SELECT IF((SELECT COUNT(*) FROM abt_variabel WHERE no_var IN (%s)) + (SELECT COUNT(*) FROM abt_menu WHERE id IN (%s))=0, 'PULIH COCOK', "
            "CONCAT('PULIH TIDAK LENGKAP - masih ada ', (SELECT COUNT(*) FROM abt_variabel WHERE no_var IN (%s)) + (SELECT COUNT(*) FROM abt_menu WHERE id IN (%s)), ' baris (diubah orang sesudah dipasang? dibiarkan)')) AS hasil;\n"
            % (daftar_no, ids, daftar_no, ids))
    tulis(os.path.join(PAKET, NAMA + '-PULIH.sql'), pul)

    # --- RTF baru ---
    baris_rtf, folder_baru = [], set()
    for d, _, fs in os.walk(lp(SUMBER_RTF)):
        for f in sorted(fs):
            if not f.lower().endswith('.rtf'):
                continue
            src = os.path.join(d, f)
            rel = os.path.relpath(src, lp(SUMBER_RTF)).replace('\\', '/')
            folder = os.path.dirname(rel)
            folder_baru.add(folder)
            dst = os.path.join(PAKET, 'rtf', rel)
            os.makedirs(lp(os.path.dirname(os.path.abspath(dst))), exist_ok=True)
            shutil.copyfile(src, lp(dst))
            baris_rtf.append('\t'.join([folder, f, md5f(dst), 'disusun dari berkas Derry pohon server 20 Okt 2026 (sumber/gugatan.py, permohonan.py, bas.py)']))
    tulis(os.path.join(PAKET, 'daftar-rtf.tsv'), '# folder<TAB>berkas<TAB>md5<TAB>asal - berkas BARU\n' + '\n'.join(sorted(baris_rtf)) + '\n')
    tulis(os.path.join(PAKET, 'folder-ada.txt'), '# folder (relatif _blangko_abt) yang harus SUDAH ada\nderry_briantono\n')
    tulis(os.path.join(PAKET, 'folder-baru.txt'), '# folder BARU (relatif _blangko_abt) yang dibuat paket ini\n' + '\n'.join(sorted(folder_baru)) + '\n')
    for kosong in ('daftar-dasar.tsv', 'daftar-pindah.tsv', 'daftar-sunting.tsv', 'daftar-timpa.tsv'):
        tulis(os.path.join(PAKET, kosong), '# tidak dipakai paket ini (paket hanya menambah)\n')

    # --- uji kueri baru atas perkara nyata ---
    uji = '# no_var<TAB>kueri (#perkara_id# diganti pasang-satker.sh; hanya SELECT; penanda isian #nnnn# dibiarkan sebagai teks)\n'
    for x in var:
        if x['tipe'] == 'data_sql' and x['sql']:
            uji += '%d\t%s\n' % (x['no'], satu_baris(x['sql']))
    tulis(os.path.join(PAKET, 'uji-kueri.tsv'), uji)

    # --- skrip ---
    alat = os.path.join(AKAR, 'alat')
    shutil.copyfile(os.path.join(alat, 'berkas_rtf.py'), os.path.join(PAKET, 'berkas_rtf.py'))
    uji_perkara = KUERI_PERKARA.replace('"', '\\"')
    for nama in ('pasang-satker.sh', 'pulih-satker.sh'):
        s = open(os.path.join(alat, nama), encoding='utf-8').read()
        s = s.replace('@@NAMA@@', NAMA).replace('@@NO_VAR@@', daftar_no).replace('@@IDS_MENU@@', ids).replace('@@UJI_PERKARA@@', uji_perkara)
        s = s.replace('@@HARAP@@', '0|0|%d|0|0' % len(lama)).replace('@@ULANG@@', '0|%d|%d|0|%d' % (len(var), len(lama), nm))
        s = s.replace('@@RINGKAS@@', '%d variabel baru, %d menu baru, %d blangko RTF baru' % (len(var), nm, len(baris_rtf)))
        tulis(os.path.join(PAKET, nama), s)

    # --- MD5SUMS ---
    sums = []
    for d, _, fs in os.walk(lp(PAKET)):
        for f in fs:
            if f == 'MD5SUMS.txt':
                continue
            p = os.path.join(d, f)
            sums.append('%s  %s' % (md5f(p), os.path.relpath(p, lp(PAKET)).replace('\\', '/')))
    tulis(os.path.join(PAKET, 'MD5SUMS.txt'), '\n'.join(sorted(sums, key=lambda t: t.split('  ', 1)[1])) + '\n')
    print('paket:', PAKET, '| variabel', len(var), '| menu', nm, '| rtf baru', len(baris_rtf), '| variabel lama dirujuk', len(lama))
    print('lama:', ' '.join(lama))
    nganggur = sorted(milik - pakai)
    if nganggur:
        print('PERINGATAN milik paket tidak dirujuk RTF/kueri mana pun:', ' '.join(nganggur))


if __name__ == '__main__':
    main()
