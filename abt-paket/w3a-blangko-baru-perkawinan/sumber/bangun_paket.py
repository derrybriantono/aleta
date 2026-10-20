# -*- coding: utf-8 -*-
"""Membangun PAKET ABT "abt-w3a-blangko-baru-perkawinan" di abt-paket/w3a-blangko-baru-perkawinan/paket-satker/ (siap di-scp ke server).

Isi paket (semua BARU; tidak satu pun berkas/baris lama diubah):
  abt-w3a-blangko-baru-perkawinan-PRASYARAT.sql / PASANG.sql / PERIKSA.sql / PULIH.sql
        variabel baru 3600-3799 (hex cp1252, satu transaksi, WHERE NOT EXISTS) + 12 baris abt_menu (id 168-179: "<Jenis> - Putusan" dan "<Jenis> - BAS")
  rtf/<folder>/<berkas>.rtf   blangko baru (12 folder baru + 2 relaas di "98 Relaas")
  berkas_rtf.py, pasang-satker.sh, pulih-satker.sh, daftar-rtf.tsv, folder-baru.txt, folder-ada.txt, uji-kueri.tsv, MD5SUMS.txt
Pakai: python bangun_paket.py  (membangkitkan ulang SEMUA RTF dari modul jenis_*.py lebih dulu)
"""
import glob
import hashlib
import importlib
import os
import re
import shutil
import sys

SUMBER = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, SUMBER)
import w3a_lib as L  # noqa: E402
import variabel_def as VD  # noqa: E402

AKAR = L.AKAR
NAMA = L.NAMA_PAKET
PAKET = os.path.join(AKAR, 'paket-satker')
TANGGAL = '2026-10-21 05:00:00'
SIPP_UJI = ("SELECT perkara_id FROM perkara WHERE jenis_perkara_id IN (343,345,351,352,359,361,347,346,362,363,360,358) ORDER BY perkara_id DESC LIMIT 14")


def md5s(t):
    return hashlib.md5(t.encode('cp1252')).hexdigest()


def md5f(p):
    return hashlib.md5(open(L.lp(p), 'rb').read()).hexdigest()


def hexs(t):
    return '0x' + t.encode('cp1252').hex()


def satu_baris(sql):
    return re.sub(r'\s+', ' ', sql).strip().rstrip(';').strip()


def tulis(path, isi):
    with open(L.lp(path), 'w', encoding='utf-8', newline='\n') as f:
        f.write(isi)


# ---------------------------------------------------------------------------------------------------------------------
# variabel & menu
# ---------------------------------------------------------------------------------------------------------------------
def kond_var(x):
    s = "no_var=%d AND MD5(nama)='%s' AND data_type='%s'" % (x['no'], md5s(x['nama']), x['tipe'])
    s += (" AND MD5(sql_query)='%s'" % md5s(x['sql'])) if x['sql'] else " AND sql_query IS NULL"
    s += (" AND MD5(default_data)='%s'" % md5s(x['default'])) if x['default'] else " AND default_data IS NULL"
    return s + " AND referensi IS NULL"


MENU_KOLOM = ['nama', 'nama_alias', 'direktori', 'parent_direktori', 'proses_id_min', 'proses_id_max', 'perkara_id_min', 'perkara_id_max',
              'perkara_id_referensi', 'user_cek', 'user_grup_id', 'user_top_id', 'user_validator']


def daftar_menu():
    hasil = []
    for k, j in L.JENIS.items():
        hasil.append(dict(id=j['menu_putusan'], nama=j['nama_menu_putusan'], nama_alias=j['alias_putusan'], direktori=j['folder'], parent_direktori='derry_briantono',
                          proses_id_min=80, proses_id_max=297, perkara_id_min=j['sipp'], perkara_id_max=j['sipp'], perkara_id_referensi='jenis_perkara_id',
                          user_cek=3, user_grup_id='1|10|20', user_top_id='1', user_validator=None))
        hasil.append(dict(id=j['menu_bas'], nama=j['nama_menu_bas'], nama_alias=j['alias_bas'], direktori=j['folder_bas'], parent_direktori='derry_briantono',
                          proses_id_min=80, proses_id_max=297, perkara_id_min=j['sipp'], perkara_id_max=j['sipp'], perkara_id_referensi='jenis_perkara_id',
                          user_cek=3, user_grup_id='1|30|500|430|1000|1010|1020', user_top_id='1|30', user_validator='10|20'))
    return sorted(hasil, key=lambda m: m['id'])


def teks_menu(m):
    return '|'.join('' if m[c] is None else str(m[c]) for c in MENU_KOLOM)


def kond_menu(m):
    ekspr = ("MD5(CONCAT_WS('|', nama, nama_alias, direktori, parent_direktori, proses_id_min, proses_id_max, perkara_id_min, perkara_id_max, "
             "perkara_id_referensi, user_cek, user_grup_id, user_top_id, IFNULL(user_validator,'')))")
    return "id=%d AND %s='%s'" % (m['id'], ekspr, md5s(teks_menu(m)))


def sisip_menu(m):
    nilai = [str(m['id'])] + [('NULL' if m[c] is None else (hexs(m[c]) if isinstance(m[c], str) else str(m[c]))) for c in MENU_KOLOM]
    kol = ['id'] + MENU_KOLOM
    return ("INSERT INTO abt_menu (%s) SELECT %s FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM abt_menu WHERE id=%d OR (direktori=%s AND parent_direktori=%s));\n"
            % (', '.join(kol), ', '.join(nilai), m['id'], hexs(m['direktori']), hexs(m['parent_direktori'])))


# ---------------------------------------------------------------------------------------------------------------------
def muat_modul():
    mods = []
    for f in sorted(glob.glob(os.path.join(SUMBER, 'jenis_*.py'))):
        mods.append(importlib.import_module(os.path.basename(f)[:-3]))
    return mods


def token_rtf():
    pakai = {}
    for d, _, fs in os.walk(L.lp(os.path.join(AKAR, 'rtf'))):
        for f in fs:
            if f.lower().endswith('.rtf'):
                raw = open(os.path.join(d, f), 'rb').read().decode('latin1')
                pakai[os.path.join(d, f)] = set(re.findall(r'#(\d{4})#', raw))
    return pakai


def main():
    import relaas_w3a  # noqa: F401  (mendaftarkan variabel bersama 3790-3791)
    mods = muat_modul()
    ru = os.path.join(AKAR, 'rtf')
    if os.path.isdir(L.lp(ru)):
        shutil.rmtree(L.lp(ru))
    for m in mods:
        m.bangun()
    relaas_w3a.bangun()
    import periksa_isi
    jumlah, galat = periksa_isi.periksa()
    print('periksa isi RTF: %d berkas, %d galat' % (jumlah, len(galat)))
    if galat:
        for g in galat[:80]:
            print('  GALAT', g)
        if '--abaikan-galat' not in sys.argv:
            raise SystemExit('bangun_paket berhenti: isi RTF tidak lolos periksa_isi')
    # PETA putusan semua jenis -> peta-w3a.json (dipakai integrasi_w3a.py dan uji)
    import json
    peta = []
    for m in mods:
        peta.extend(getattr(m, 'PETA', []))
    semua = list(mods) + [relaas_w3a]
    with open(L.lp(os.path.join(AKAR, 'peta-w3a.json')), 'w', encoding='utf-8') as f:
        json.dump(dict(jenis={k: {c: v for c, v in j.items()} for k, j in L.JENIS.items()}, peta=peta,
                       isian={k: v for m in semua for k, v in getattr(m, 'ISIAN', {}).items()},
                       ramah={k: v for m in semua for k, v in getattr(m, 'RAMAH', {}).items()}), f, ensure_ascii=False, indent=1)
    if os.path.isdir(L.lp(PAKET)):
        shutil.rmtree(L.lp(PAKET))
    os.makedirs(L.lp(PAKET))

    var = sorted(VD.VAR, key=lambda x: x['no'])
    nomor = [x['no'] for x in var]
    daftar_no = ','.join(str(n) for n in nomor)
    menu = daftar_menu()
    ids_menu = ','.join(str(m['id']) for m in menu)
    pasangan_dir = ' OR '.join("(direktori=%s AND parent_direktori='derry_briantono')" % hexs(m['direktori']) for m in menu)

    # variabel lama yang dirujuk RTF/kueri
    milik = set('%04d' % n for n in nomor)
    pakai = set()
    for v in token_rtf().values():
        pakai |= v
    for x in var:
        pakai |= set(re.findall(r'#(\d{4})#', (x['sql'] or '') + ' ' + x['nama'] + ' ' + (x['default'] or '')))
    lama = sorted(pakai - milik)
    daftar_lama = ','.join("'%s'" % k for k in lama)
    kop = ('-- Paket ABT "%s" (agen W3a, 21 Okt 2026): blangko Derry BARU untuk Penolakan Perkawinan (343), Perkawinan Campuran (359), Izin Kawin (361), Pengesahan Anak (352), '
           'Kelalaian atas Kewajiban Suami/Istri (345) dan Hak-hak Bekas Istri/Kewajiban Bekas Suami (351): %d variabel baru (3600-3799), %d baris abt_menu (id %s), '
           '%d folder baru, relaas di 98 Relaas.\n') % (NAMA, len(var), len(menu), '168-179', len(menu))

    sama_var = ' OR '.join('(%s)' % kond_var(x) for x in var)
    sama_menu = ' OR '.join('(%s)' % kond_menu(m) for m in menu)

    # --- PRASYARAT ---------------------------------------------------------------------------------------------------------
    pr = (kop + '-- PRASYARAT (baca saja) "A|B|C|D|E": A = nomor 3600-3799 yang sudah terpakai tetapi isinya LAIN dari paket (harus 0) | B = variabel yang sudah persis paket '
          '(0 pertama, %d pasang ulang) | C = variabel lama yang dirujuk blangko/kueri ADA (harus %d) | D = baris abt_menu id %s atau direktori sama yang isinya LAIN (harus 0) '
          '| E = baris abt_menu yang sudah persis paket (0 pertama, %d ulang).\n-- Benar: "0|0|%d|0|0" (pertama) atau "0|%d|%d|0|%d" (pasang ulang).\n'
          % (len(var), len(lama), ids_menu, len(menu), len(lama), len(var), len(lama), len(menu)))
    pr += ("SELECT CONCAT((SELECT COUNT(*) FROM abt_variabel WHERE no_var BETWEEN 3600 AND 3799 AND NOT (%s)),'|',(SELECT COUNT(*) FROM abt_variabel WHERE %s),'|',"
           "(SELECT COUNT(*) FROM abt_variabel WHERE no_var IN (%s)),'|',"
           "(SELECT COUNT(*) FROM abt_menu WHERE (id IN (%s) OR %s) AND NOT (%s)),'|',(SELECT COUNT(*) FROM abt_menu WHERE %s)) AS prasyarat;\n"
           % (sama_var or '1=0', sama_var or '1=0', daftar_lama, ids_menu, pasangan_dir, sama_menu, sama_menu))
    tulis(os.path.join(PAKET, NAMA + '-PRASYARAT.sql'), pr)

    # --- PASANG ------------------------------------------------------------------------------------------------------------
    ps = kop + '-- PASANG: satu transaksi; baris yang sudah berisi paket tidak berubah (pasang ulang aman); berhenti keras bila nomor/direktori dipakai isi lain (lihat PRASYARAT).\nSET NAMES latin1;\nSTART TRANSACTION;\n'
    for x in var:
        ps += ("INSERT INTO abt_variabel (no_var, nama, data_type, data_tabel, data_kolom, urutan_data, referensi, sql_query, default_data, multi_sidang, locked, modifier, modified) "
               "SELECT %d, %s, '%s', NULL, NULL, NULL, NULL, %s, %s, NULL, 0, 'admin', '%s' FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM abt_variabel WHERE no_var=%d);\n") % (
            x['no'], hexs(x['nama']), x['tipe'], hexs(x['sql']) if x['sql'] else 'NULL', hexs(x['default']) if x['default'] else 'NULL', TANGGAL, x['no'])
    for m in menu:
        ps += sisip_menu(m)
    ps += 'COMMIT;\n'
    tulis(os.path.join(PAKET, NAMA + '-PASANG.sql'), ps)

    # --- PERIKSA -----------------------------------------------------------------------------------------------------------
    pk = kop + '-- PERIKSA: tiap variabel baru dan baris menu persis isi paket; variabel lama ada; baris terakhir "SEMUA COCOK".\n'
    for x in var:
        pk += "SELECT 'var %d' AS butir, (SELECT COUNT(*) FROM abt_variabel WHERE %s) AS cocok;\n" % (x['no'], kond_var(x))
    for m in menu:
        pk += "SELECT 'menu %d' AS butir, (SELECT COUNT(*) FROM abt_menu WHERE %s) AS cocok;\n" % (m['id'], kond_menu(m))
    pk += ("SELECT IF((SELECT COUNT(*) FROM abt_variabel WHERE no_var IN (%s))=%d AND (SELECT COUNT(*) FROM abt_variabel WHERE %s)=%d AND (SELECT COUNT(*) FROM abt_menu WHERE %s)=%d, 'SEMUA COCOK', 'TIDAK COCOK') AS hasil;\n"
           % (daftar_lama, len(lama), sama_var or '1=0', len(var), sama_menu, len(menu)))
    tulis(os.path.join(PAKET, NAMA + '-PERIKSA.sql'), pk)

    # --- PULIH -------------------------------------------------------------------------------------------------------------
    pl = kop + '-- PULIH (deterministik): baris baru dihapus HANYA bila isinya masih persis paket; sisanya dilaporkan.\nSTART TRANSACTION;\n'
    for m in menu:
        pl += "DELETE FROM abt_menu WHERE %s;\n" % kond_menu(m)
    for x in var:
        pl += "DELETE FROM abt_variabel WHERE %s;\n" % kond_var(x)
    pl += 'COMMIT;\n'
    pl += ("SELECT IF((SELECT COUNT(*) FROM abt_variabel WHERE no_var IN (%s))=0 AND (SELECT COUNT(*) FROM abt_menu WHERE id IN (%s))=0, 'PULIH COCOK', "
           "CONCAT('PULIH TIDAK LENGKAP - variabel baru yang masih ada ', (SELECT COUNT(*) FROM abt_variabel WHERE no_var IN (%s)), ', menu baru yang masih ada ', (SELECT COUNT(*) FROM abt_menu WHERE id IN (%s)), "
           "' (diubah orang sesudah dipasang? dibiarkan)')) AS hasil;\n") % (daftar_no, ids_menu, daftar_no, ids_menu)
    tulis(os.path.join(PAKET, NAMA + '-PULIH.sql'), pl)

    # --- RTF -----------------------------------------------------------------------------------------------------------------
    baris, folder_baru, folder_ada = [], set(), set()
    for d, _, fs in os.walk(L.lp(ru)):
        for f in sorted(fs):
            if not f.lower().endswith('.rtf'):
                continue
            src = os.path.join(d, f)
            rel = os.path.relpath(src, L.lp(ru)).replace('\\', '/')
            folder = os.path.dirname(rel)
            dst = os.path.join(PAKET, 'rtf', rel)
            os.makedirs(L.lp(os.path.dirname(dst)), exist_ok=True)
            shutil.copyfile(src, L.lp(dst))
            kode_folder = 'derry_briantono/' + folder.split('/', 1)[1]
            baris.append('	'.join([kode_folder, f, md5f(dst), 'disusun dari berkas Derry pohon server 21 Okt 2026 (sumber/jenis_*.py, relaas_w3a.py)']))
            (folder_ada if kode_folder.endswith('/98 Relaas') else folder_baru).add(kode_folder)
    tulis(os.path.join(PAKET, 'daftar-rtf.tsv'), '# folder<TAB>berkas<TAB>md5<TAB>asal - berkas BARU dari <paket>/rtf/ (tidak pernah menimpa berkas lain)\n' + '\n'.join(sorted(baris)) + '\n')
    tulis(os.path.join(PAKET, 'folder-ada.txt'), '# folder (relatif _blangko_abt) yang harus SUDAH ada\nderry_briantono\n' + '\n'.join(sorted(folder_ada)) + '\n')
    tulis(os.path.join(PAKET, 'folder-baru.txt'), '# folder BARU (relatif _blangko_abt) yang dibuat paket ini; dihapus pulih-satker.sh bila kosong\n' + '\n'.join(sorted(folder_baru)) + '\n')
    for kosong in ('daftar-timpa.tsv', 'daftar-dasar.tsv', 'daftar-pindah.tsv', 'daftar-sunting.tsv'):
        tulis(os.path.join(PAKET, kosong), '# tidak dipakai paket ini (hanya berkas BARU)\n')

    # --- uji kueri ----------------------------------------------------------------------------------------------------------
    uji = '# no_var<TAB>kueri (#perkara_id# diganti pasang-satker.sh; hanya SELECT; penanda isian #nnnn# dikosongkan oleh uji)\n'
    for x in var:
        if x['tipe'] == 'data_sql' and x['sql']:
            uji += '%d\t%s\n' % (x['no'], re.sub(r'#(\d{4})#', '', satu_baris(x['sql'])))
    tulis(os.path.join(PAKET, 'uji-kueri.tsv'), uji)

    # --- skrip ----------------------------------------------------------------------------------------------------------------
    alat = os.path.join(AKAR, 'alat')
    shutil.copyfile(os.path.join(alat, 'berkas_rtf.py'), os.path.join(PAKET, 'berkas_rtf.py'))
    p = open(os.path.join(alat, 'pasang-satker.sh'), encoding='utf-8').read()
    p = re.sub(r'# PASANG paket ABT "[^"]*" \([^)]*\)\. Dijalankan', '# PASANG paket ABT "%s" (21 Okt 2026, agen W3a). Dijalankan' % NAMA, p, count=1)
    p = re.sub(r'# Isi:.*\n', '# Isi: %d variabel baru (3600-3799), 12 baris abt_menu (id 168-179), 12 folder baru dan %d blangko RTF BARU (enam jenis perkawinan/keluarga + 2 relaas di 98 Relaas). Tidak ada berkas lama yang diubah.\n' % (len(var), len(baris)), p, count=1)
    p = re.sub(r'# Paket yang harus terpasang lebih dulu:.*\n', '# Paket yang harus terpasang lebih dulu: tidak ada (hanya butuh variabel lama yang dirujuk dan folder derry_briantono + 98 Relaas; dicek PRASYARAT).\n', p, count=1)
    p = re.sub(r"N=abt-[a-z0-9-]+", 'N=' + NAMA, p, count=1)
    p = re.sub(r"HARAP='[^']*'", "HARAP='0|0|%d|0|0'" % len(lama), p, count=1)
    p = re.sub(r"ULANG='[^']*'", "ULANG='0|%d|%d|0|%d'" % (len(var), len(lama), len(menu)), p, count=1)
    p = p.replace('if [ "$T" = abt_menu ]; then W="id IN (0)"; else W="no_var IN (9654)"; fi', 'if [ "$T" = abt_menu ]; then W="id IN (%s)"; else W="no_var IN (%s)"; fi' % (ids_menu, daftar_no))
    p = p.replace('no_var IN (9654)', 'no_var IN (%s)' % daftar_no)
    p = p.replace('SELECT 0" 2>/dev/null', SIPP_UJI + '" 2>/dev/null')
    p = p.replace('ABT_DB=aps_badilag_i17', 'ABT_DB=aps_badilag_w3a')
    p = p.replace('chmod 755 "$B/$f"', 'chmod "$(stat -c %a "$(dirname "$B/$f")" 2>/dev/null || echo 755)" "$B/$f" 2>/dev/null')
    tulis(os.path.join(PAKET, 'pasang-satker.sh'), p)
    q = open(os.path.join(alat, 'pulih-satker.sh'), encoding='utf-8').read()
    q = re.sub(r'# PULIH paket ABT "[^"]*" \([^)]*\)', '# PULIH paket ABT "%s" (21 Okt 2026, agen W3a)' % NAMA, q, count=1)
    q = re.sub(r"N=abt-[a-z0-9-]+", 'N=' + NAMA, q, count=1)
    q = q.replace('no_var IN (9654)', 'no_var IN (%s)' % daftar_no)
    q = q.replace('ABT_DB=aps_badilag_i17', 'ABT_DB=aps_badilag_w3a')
    tulis(os.path.join(PAKET, 'pulih-satker.sh'), q)

    # --- MD5SUMS ---------------------------------------------------------------------------------------------------------------
    sums = []
    for d, _, fs in os.walk(L.lp(PAKET)):
        for f in fs:
            if f == 'MD5SUMS.txt':
                continue
            pth = os.path.join(d, f)
            sums.append('%s  %s' % (md5f(pth), os.path.relpath(pth, L.lp(PAKET)).replace('\\', '/')))
    tulis(os.path.join(PAKET, 'MD5SUMS.txt'), '\n'.join(sorted(sums, key=lambda t: t.split('  ', 1)[1])) + '\n')
    print('paket:', PAKET, '| variabel', len(var), '| menu', len(menu), '| rtf', len(baris), '| folder baru', len(folder_baru), '| variabel lama dirujuk', len(lama))


if __name__ == '__main__':
    main()
