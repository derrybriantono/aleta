# -*- coding: utf-8 -*-
"""SQL dan daftar berkas paket u3-itsbat-aua (agen U3, 20 Okt 2026): PRASYARAT / PASANG / PERIKSA / PULIH, uji-kueri.tsv,
daftar-rtf.tsv, daftar-singkir.tsv, MD5SUMS.txt. Teks dikirim sebagai heksadesimal cp1252 supaya tanda kutip, persen, dan
karakter non-ASCII tidak berubah di jalan (pola paket abt-pengumuman-itsbat).
Jalankan SESUDAH bangun_in.py, bangun_aua.py, bangun_bas.py (RTF) :  python bangun_sql.py"""
import glob, hashlib, io, json, os, re, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from variabel import VAR  # noqa: E402

AKAR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PAKET = os.path.join(AKAR, 'paket-satker')
N = 'abt-u3-itsbat-aua'
KAMUS = os.environ.get('KAMUS_ABT', r'D:\Aplikasi\aleta\tmp\u3\server-abt-variabel.json')
RENTANG = (4300, 4399)
BS = chr(92)


def hx(t):
    return '0x' + t.encode('cp1252').hex()


def md5(t):
    return hashlib.md5(t.encode('cp1252')).hexdigest()


def md5_berkas(p):
    return hashlib.md5(open(p, 'rb').read()).hexdigest()


def tulis(nama, isi):
    io.open(os.path.join(PAKET, nama), 'w', encoding='utf-8', newline='\n').write(isi)


def token_di(teks):
    return set(re.findall(r'#(\d{4,5})#', teks))


def main():
    kamus = json.load(open(KAMUS, encoding='utf-8'))
    baru = {'%04d' % v['no'] for v in VAR}
    # --- token yang dipakai paket (RTF + kueri + pilihan) ---
    pakai = set()
    for f in glob.glob(os.path.join(PAKET, 'rtf', '**', '*.rtf'), recursive=True):
        pakai |= token_di(open(f, 'rb').read().decode('latin1'))
    for v in VAR:
        pakai |= token_di((v['sql'] or '').replace('#perkara_id#', '') + ' ' + (v['default'] or ''))
    lama = sorted(t for t in pakai if t not in baru)
    hilang = [t for t in lama if t not in kamus]
    assert not hilang, 'token tidak ada di kamus ABT server: %s' % hilang
    # --- variabel isian yang dibaca kueri baru lewat abt_data_teks (jenis harus tetap data_teks) ---
    sumber = set()
    for v in VAR:
        sumber |= {'%04d' % int(m) for m in re.findall(r'no_var=(\d+)', v['sql'] or '')}
    sumber = sorted(s for s in sumber if s not in baru)
    for s in sumber:
        assert kamus[s]['data_type'] == 'data_teks', (s, kamus[s]['data_type'])
    for v in VAR:
        assert len(v['nama']) <= 200, v['no']
        assert 'aleta' not in (v['nama'] + (v['sql'] or '') + (v['default'] or '')).lower(), v['no']
    nomor = ','.join(str(v['no']) for v in VAR)
    kodelama = ','.join("'%s'" % t for t in lama)
    sumbersql = ' OR '.join("(no_var=%d AND data_type='data_teks')" % int(s) for s in sumber)
    lo, hi = RENTANG
    prasyarat = ("-- %s: harus menjawab 0|%d|%d (nomor %d-%d kosong | variabel lama yang dipakai blangko/kueri ada | variabel isian sumber berjenis data_teks). Hanya SELECT.\n"
                 "SELECT CONCAT((SELECT COUNT(*) FROM abt_variabel WHERE no_var BETWEEN %d AND %d),'|',\n"
                 "  (SELECT COUNT(*) FROM abt_variabel WHERE no_var IN (%s)),'|',\n"
                 "  (SELECT COUNT(*) FROM abt_variabel WHERE %s)) AS prasyarat;\n" % (N, len(lama), len(sumber), lo, hi, lo, hi, kodelama, sumbersql))
    tulis(N + '-PRASYARAT.sql', prasyarat)
    pasang = ['-- %s (agen U3, 20 Okt 2026): %d variabel BARU %s untuk blangko itsbat nikah dan asal usul anak (data_sql hanya SELECT; data_teks = isian/pilihan majelis).' % (N, len(VAR), nomor),
              '-- Prasyarat dijaga pasang-satker.sh (PRASYARAT.sql); baris lama tidak disentuh.',
              'START TRANSACTION;']
    periksa = ['-- %s: tiap variabel baru persis isi paket (md5 nama, kueri, pilihan); baris terakhir "SEMUA COCOK".' % N]
    pulih = ['-- %s: hapus HANYA variabel baru yang isinya masih persis paket (md5), lalu laporkan sisa.' % N]
    uji = []
    cocok = []
    for v in VAR:
        no, nama, tipe, q, d = v['no'], v['nama'], v['tipe'], v['sql'], v['default']
        d = d.replace('\r\n', '\n').replace('\n', '\r\n') if d else None
        pasang.append('INSERT INTO abt_variabel (no_var, nama, data_type, data_tabel, data_kolom, urutan_data, referensi, sql_query, default_data, multi_sidang, locked, modifier) '
                      "VALUES (%d, %s, '%s', NULL, NULL, NULL, NULL, %s, %s, NULL, 0, 'admin');" % (no, hx(nama), tipe, hx(q) if q else 'NULL', hx(d) if d else 'NULL'))
        kq = "MD5(sql_query)='%s'" % md5(q) if q else 'sql_query IS NULL'
        kd = "MD5(default_data)='%s'" % md5(d) if d else 'default_data IS NULL'
        periksa.append("SELECT 'var %d' AS butir, (SELECT COUNT(*) FROM abt_variabel WHERE no_var=%d AND MD5(nama)='%s' AND data_type='%s' AND %s AND %s AND referensi IS NULL) AS cocok;"
                       % (no, no, md5(nama), tipe, kq, kd))
        pulih.append("DELETE FROM abt_variabel WHERE no_var=%d AND MD5(nama)='%s' AND %s AND %s;" % (no, md5(nama), kq, kd))
        cocok.append("(SELECT COUNT(*) FROM abt_variabel WHERE no_var=%d AND MD5(nama)='%s' AND %s AND %s)=1" % (no, md5(nama), kq, kd))
        if tipe == 'data_sql':
            uji.append('%d\t%s' % (no, q))
    pasang.append('COMMIT;')
    periksa.append("SELECT IF((SELECT COUNT(*) FROM abt_variabel WHERE no_var BETWEEN %d AND %d)=%d AND %s, 'SEMUA COCOK', 'TIDAK COCOK') AS hasil;" % (lo, hi, len(VAR), ' AND '.join(cocok)))
    pulih.append("SELECT IF((SELECT COUNT(*) FROM abt_variabel WHERE no_var BETWEEN %d AND %d)=0, 'PULIH COCOK', CONCAT('PULIH TIDAK COCOK - masih ada ', "
                 "(SELECT COUNT(*) FROM abt_variabel WHERE no_var BETWEEN %d AND %d), ' baris %d-%d (sudah disunting sesudah dipasang? periksa dengan tangan)')) AS hasil;" % (lo, hi, lo, hi, lo, hi))
    tulis(N + '-PASANG.sql', '\n'.join(pasang) + '\n')
    tulis(N + '-PERIKSA.sql', '\n'.join(periksa) + '\n')
    tulis(N + '-PULIH.sql', '\n'.join(pulih) + '\n')
    tulis('uji-kueri.tsv', '# no_var<TAB>kueri (#perkara_id# diganti pasang-satker.sh; hanya SELECT)\n' + '\n'.join(uji) + '\n')
    # --- daftar berkas RTF baru ---
    baris = ['# folder<TAB>berkas<TAB>md5<TAB>asal - berkas BARU di _blangko_abt (paket %s; tidak menimpa berkas lama)' % N]
    for f in sorted(glob.glob(os.path.join(PAKET, 'rtf', 'derry_briantono', '*', '*.rtf'))):
        rel = os.path.relpath(f, os.path.join(PAKET, 'rtf')).replace(BS, '/')
        folder, berkas = rel.rsplit('/', 1)
        baris.append('%s\t%s\t%s\tvarian baru dari berkas Derry yang ada (lihat PASANG.md)' % (folder, berkas, md5_berkas(f)))
    tulis('daftar-rtf.tsv', '\n'.join(baris) + '\n')
    tulis('daftar-singkir.tsv', '# folder<TAB>berkas<TAB>md5 - tidak ada berkas yang disingkirkan oleh paket ini\n')
    # --- MD5SUMS ---
    sums = []
    for rel in sorted(os.listdir(PAKET)):
        if rel in ('MD5SUMS.txt', 'cadangan'):
            continue
        p = os.path.join(PAKET, rel)
        if os.path.isfile(p):
            sums.append((rel, md5_berkas(p)))
    for f in sorted(glob.glob(os.path.join(PAKET, 'rtf', '**', '*.rtf'), recursive=True)):
        sums.append((os.path.relpath(f, PAKET).replace(BS, '/'), md5_berkas(f)))
    tulis('MD5SUMS.txt', ''.join('%s *%s\n' % (h, r) for r, h in sums))
    print('SQL ditulis: %d variabel %s; prasyarat 0|%d|%d; %d berkas RTF' % (len(VAR), nomor, len(lama), len(sumber), len(baris) - 1))
    print('variabel lama dipakai:', ','.join(lama))
    print('variabel isian sumber:', ','.join(sumber))


if __name__ == '__main__':
    main()
