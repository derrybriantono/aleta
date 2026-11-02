# -*- coding: utf-8 -*-
"""Pembangun paket ABT identitas-pihak-1nov (keputusan pengguna 101 dan 102, 1 Nov 2026), KE-31, sesudah perbaikan-1nov (ke-30).

pakai: python bangun_paket.py <akar _blangko_abt sesudah 30 paket> <berkas TSV variabel dasar: no_var, HEX(nama), data_type, HEX(sql_query)> <folder paket-satker> <folder hasil>
  VAR_DASAR dibuat dari basis ABT keadaan sesudah 30 paket:
    mysql -N -e "SELECT no_var, HEX(nama), data_type, IFNULL(HEX(sql_query),'NULL') FROM abt_variabel WHERE no_var IN (7047,7048)" > var_dasar_hex.tsv
Memakai: variabel_baru.py (kueri 7047/7048), fungsi_baru.py (dua fungsi), rtf_identitas.py (blangko RTF)."""
import base64
import hashlib
import io
import json
import os
import re
import sys

SINI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, SINI)
import fungsi_baru as FB  # noqa: E402
import rtf_identitas as R  # noqa: E402
from variabel_baru import KUERI  # noqa: E402

N = 'abt-identitas-pihak-1nov'
PAKET = os.path.join(SINI, '..', '..')
BS = chr(92)
NO_UBAH = [7047, 7048]
FN_UBAH = ['isian_rtf_pihak_identitas', 'isian_rtf_pihak_tambahan']
MODIFIED = '2026-11-01 23:00:00'
# fungsi pendukung yang HARUS ada di server (dipanggil fungsi/variabel baru)
FN_PENDUKUNG = ['isian_rtf_pihak_jumlah', 'isian_rtf_romawi', 'isian_rtf_tanggal', 'isian_rtf_alamat_putusan', 'isian_rtf_alamat', 'isian_rtf_identitas_kosong']
# md5 definisi LAMA yang diharapkan di server (keadaan sesudah alamat-putusan-28okt dan pihak-urut-ecourt-27okt; dicek juga terhadap sumbernya)
MD5_LAMA = {'isian_rtf_pihak_identitas': '4c758ce53cd541a39a32cf3cb0ba9898', 'isian_rtf_pihak_tambahan': '9cf2a80618cfee32d3b096c4b1c83dc8'}


def md5b(b):
    return hashlib.md5(b).hexdigest()


def hx(b):
    return '0x' + b.hex()


def seimbang(raw):
    d = 0
    k = 0
    while k < len(raw):
        c = raw[k]
        if c == BS:
            k += 2
            continue
        if c == '{':
            d += 1
        elif c == '}':
            d -= 1
            if d < 0:
                return False
        k += 1
    return d == 0


def blok(nama, teks):
    m = re.search(r'(DROP FUNCTION IF EXISTS %s\$\$\nCREATE FUNCTION %s\(.*?\nBEGIN\n(.*?)\nEND)\$\$' % (nama, nama), teks, re.S)
    assert m, nama
    return m.group(1), 'BEGIN\n' + m.group(2) + '\nEND'


def badan(teks):
    m = re.search(r'\nBEGIN\n(.*)\nEND$', teks, re.S)
    assert m
    return 'BEGIN\n' + m.group(1) + '\nEND'


def baca_latin(p):
    return open(p, 'rb').read().decode('latin1').replace('\r\n', '\n')


def main():
    akar, hexfile, keluar, hasil = sys.argv[1:5]
    for x in (keluar, hasil):
        if not os.path.isdir(x):
            os.makedirs(x)
    # ---- variabel dasar
    var = {}
    for baris in open(hexfile, encoding='latin1', newline='').read().replace('\r', '').split('\n'):
        if baris.strip():
            k = baris.split('\t')
            var[int(k[0])] = dict(nama=bytes.fromhex(k[1]), tipe=k[2], sql=None if k[3] == 'NULL' else bytes.fromhex(k[3]))
    assert sorted(var) == NO_UBAH, sorted(var)
    ubah = {}
    for no in NO_UBAH:
        v = var[no]
        assert v['tipe'] == 'data_sql' and v['sql'] is not None
        q = KUERI[no]
        assert all(ord(ch) < 128 for ch in q)
        # penanda angka yang boleh tersisa di kueri baru
        sisa = sorted(set(re.findall(r'#(\d{3,5})#', q)))
        assert sisa == (['0046', '8540'] if no == 7047 else ['0047', '8541']), sisa
        nb = q.encode('latin1')
        ubah[no] = dict(lama_md5=md5b(v['sql']), baru_md5=md5b(nb), baru_b=nb, nama_md5=md5b(v['nama']), tipe=v['tipe'])
        assert ubah[no]['lama_md5'] != ubah[no]['baru_md5']

    # ---- fungsi: lama dari sumbernya (dicek md5 terhadap server), baru dari fungsi_baru.py
    src_ap = baca_latin(os.path.join(PAKET, 'alamat-putusan-28okt', 'paket-satker', 'abt-alamat-putusan-28okt-FUNGSI.sql'))
    src_pu = baca_latin(os.path.join(PAKET, 'pihak-urut-ecourt-27okt', 'paket-satker', 'abt-pihak-urut-ecourt-27okt-FUNGSI.sql'))
    fn = {}
    for f, src, ubahfn in (('isian_rtf_pihak_identitas', src_ap, FB.baru), ('isian_rtf_pihak_tambahan', src_pu, FB.baru_tambahan)):
        teks, bd = blok(f, src)
        assert md5b(bd.encode('latin1')) == MD5_LAMA[f], ('sumber fungsi tak cocok dengan md5 server', f, md5b(bd.encode('latin1')))
        teks2 = ubahfn(teks)
        fn[f] = dict(lama=teks, baru=teks2, md5_lama=MD5_LAMA[f], md5_baru=md5b(badan(teks2).encode('latin1')))
        assert fn[f]['md5_lama'] != fn[f]['md5_baru']

    RT = "information_schema.routines WHERE routine_schema=DATABASE() AND routine_type='FUNCTION'"

    def kond(no, keadaan, a=''):
        p = a + '.' if a else ''
        u = ubah[no]
        m = u['lama_md5'] if keadaan == 'lama' else u['baru_md5']
        return "(%sno_var=%d AND MD5(%snama)='%s' AND %sdata_type='%s' AND MD5(%ssql_query)='%s')" % (p, no, p, u['nama_md5'], p, u['tipe'], p, m)

    def atau(lst):
        return '(' + ' OR '.join(lst) + ')' if lst else '(1=0)'

    def kond_fn(keadaan):
        return atau(["(routine_name='%s' AND MD5(routine_definition)='%s')" % (f, fn[f]['md5_lama'] if keadaan == 'lama' else fn[f]['md5_baru']) for f in FN_UBAH])

    KUL = [kond(n, 'lama') for n in NO_UBAH]
    KUB = [kond(n, 'baru') for n in NO_UBAH]
    daftar = ','.join(str(n) for n in NO_UBAH)
    fl = ','.join("'%s'" % f for f in FN_UBAH)
    fp = ','.join("'%s'" % f for f in FN_PENDUKUNG)
    HARAP = '2|0|2|0|0|%d' % len(FN_PENDUKUNG)
    ULANG = '0|2|0|2|0|%d' % len(FN_PENDUKUNG)
    KEPALA = ("-- Paket ABT \"%s\" (1 Nov 2026, agen V; keputusan pengguna 101 dan 102): format identitas pihak putusan/penetapan = blangko acuan \"[01] [Kabul Verstek] Cerai (Format Lengkap)\".\n"
              "-- Variabel %s dan fungsi %s diubah; blangko RTF lewat daftar-tambal.tsv/tambal.tsv. Hanya pengguna derry_briantono. Prasyarat: paket ke-30 (perbaikan-1nov) terpasang.\n") % (
        N, ', '.join(map(str, NO_UBAH)), ', '.join(FN_UBAH))

    pra = KEPALA + ("-- PRASYARAT (baca saja) \"A|B|C|D|E|F\": A = fungsi identitas/tambahan yang isinya persis keadaan server (2 pertama, 0 ulang) | B = yang sudah isi BARU paket ini (0 pertama, 2 ulang) | "
                    "C = dari 2 variabel (%s) yang masih isi LAMA (2 pertama, 0 ulang) | D = yang sudah isi BARU (0 pertama, 2 ulang) | "
                    "E = baris variabel diubah yang bukan lama bukan baru, ditambah fungsi identitas/tambahan yang bukan lama bukan baru (harus 0) | F = fungsi pendukung yang harus ada (%d).\n"
                    "-- Benar: \"%s\" (pertama) atau \"%s\" (pasang ulang).\n") % (daftar, len(FN_PENDUKUNG), HARAP, ULANG)
    pra += ("SELECT CONCAT((SELECT COUNT(*) FROM %s AND %s), '|', (SELECT COUNT(*) FROM %s AND %s), '|', (SELECT COUNT(*) FROM abt_variabel WHERE %s), '|', (SELECT COUNT(*) FROM abt_variabel WHERE %s), '|', "
            "((SELECT COUNT(*) FROM abt_variabel WHERE no_var IN (%s) AND NOT (%s OR %s)) + (SELECT COUNT(*) FROM %s AND routine_name IN (%s) AND NOT (%s OR %s))), '|', "
            "(SELECT COUNT(DISTINCT routine_name) FROM %s AND routine_name IN (%s))) AS prasyarat;\n") % (
        RT, kond_fn('lama'), RT, kond_fn('baru'), atau(KUL), atau(KUB), daftar, atau(KUL), atau(KUB), RT, fl, kond_fn('lama'), kond_fn('baru'), RT, fp)

    ps = KEPALA + ("-- PASANG variabel (fungsi dipasang lebih dulu oleh pasang-satker.sh dari -FUNGSI.sql): satu transaksi; baris diubah hanya bila isinya masih persis isi LAMA (pasang ulang aman).\n"
                   "SET NAMES latin1;\nSTART TRANSACTION;\n")
    for n in NO_UBAH:
        ps += "UPDATE abt_variabel SET sql_query=%s, modified='%s' WHERE %s;\n" % (hx(ubah[n]['baru_b']), MODIFIED, kond(n, 'lama'))
    ps += "COMMIT;\n"

    pk = KEPALA + "-- PERIKSA: tiap variabel persis isi paket; dua fungsi persis isi paket; variabel kalimat kuasa (8540 8541) dan relaas (9230 9231) tidak tersentuh; baris terakhir \"SEMUA COCOK\".\n"
    for n in NO_UBAH:
        pk += "SELECT 'var %d diubah' AS butir, (SELECT COUNT(*) FROM abt_variabel WHERE %s) AS cocok;\n" % (n, kond(n, 'baru'))
    pk += "SELECT 'fungsi identitas dan tambahan baru' AS butir, IF((SELECT COUNT(*) FROM %s AND %s) = 2, 1, 0) AS cocok;\n" % (RT, kond_fn('baru'))
    pk += ("SELECT 'variabel 7047 7048 hanya memanggil fungsi identitas' AS butir, IF((SELECT COUNT(*) FROM abt_variabel WHERE no_var IN (7047, 7048) AND sql_query LIKE '%%isian_rtf_pihak_identitas(%%' "
           "AND sql_query NOT LIKE '%%#0098#%%' AND sql_query NOT LIKE '%%#0335#%%') = 2, 1, 0) AS cocok;\n")
    pk += ("SELECT IF((SELECT COUNT(*) FROM abt_variabel WHERE %s) = 2 AND (SELECT COUNT(*) FROM %s AND %s) = 2, 'SEMUA COCOK', 'TIDAK COCOK') AS hasil;\n") % (atau(KUB), RT, kond_fn('baru'))

    cek_fn = "SELECT (SELECT COUNT(*) FROM %s AND %s) AS fungsi_baru;\n" % (RT, kond_fn('baru'))

    pl = KEPALA + ("-- PULIH (deterministik): variabel dikembalikan dari tabel sementara pu_lama (dibuat pulih-satker.sh dari cadangan/abt_variabel-sebelum.sql) HANYA bila isinya masih isi BARU paket dan baris cadangan masih isi LAMA yang diharapkan.\n"
                   "-- Dua fungsi dikembalikan oleh pulih-satker.sh (-FUNGSI-LAMA.sql) SESUDAH ini.\n")
    pl += "START TRANSACTION;\n"
    for n in NO_UBAH:
        pl += ("UPDATE abt_variabel a JOIN pu_lama l ON l.no_var=a.no_var SET a.nama=l.nama, a.data_type=l.data_type, a.data_tabel=l.data_tabel, a.data_kolom=l.data_kolom, "
               "a.urutan_data=l.urutan_data, a.referensi=l.referensi, a.sql_query=l.sql_query, a.default_data=l.default_data, a.multi_sidang=l.multi_sidang, a.locked=l.locked, "
               "a.modifier=l.modifier, a.modified=l.modified WHERE %s AND %s;\n") % (kond(n, 'baru', 'a'), kond(n, 'lama', 'l'))
    pl += "COMMIT;\n"
    pl += ("SELECT IF((SELECT COUNT(*) FROM abt_variabel WHERE %s) = %d, 'VARIABEL KEMBALI', CONCAT('PULIH TIDAK LENGKAP - baris diubah yang sudah kembali ', (SELECT COUNT(*) FROM abt_variabel WHERE %s), ' dari %d (diubah orang sesudah dipasang? dibiarkan)')) AS hasil;\n") % (
        atau(KUL), len(NO_UBAH), atau(KUL), len(NO_UBAH))

    uv = KEPALA + "-- UJIVAR: kueri baru tiap variabel diubah dijalankan pasang-satker.sh atas beberapa perkara contoh (@pid diisi skrip; rujukan #NNNN# = 0). Hanya memeriksa kueri berjalan tanpa galat.\n"
    for n in NO_UBAH:
        q = ubah[n]['baru_b'].decode('latin1')
        q = re.sub(r"'#perkara_id#'|#perkara_id#", '@pid', q)
        q = re.sub(r'#\d{1,5}#', '0', q)
        q = q.replace('\r\n', '\n').rstrip().rstrip(';')
        uv += "SELECT %d AS no_var, COUNT(*) AS baris FROM (%s) AS uji_%d;\n" % (n, q, n)

    # ---- berkas fungsi
    kep_fn = ("-- Paket %s: dua fungsi diganti (md5 definisi lama = keadaan server sesudah paket alamat-putusan-28okt dan pihak-urut-ecourt-27okt; md5 baru di hasil/isi-paket.json).\n"
              "-- isian_rtf_pihak_identitas: TANPA umur (keputusan 112), urutan agama-pendidikan-pekerjaan, kalimat kuasa \"... yang telah didaftarkan\" tanpa koma.\n"
              "-- isian_rtf_pihak_tambahan (Turut Tergugat, intervensi): pendidikan ikut bila ada, tanpa umur. Tanpa komentar -- di badan fungsi (md5 definisi dihitung tanpa komentar).\n") % N
    fungsi_sql = kep_fn + 'DELIMITER $$\n\n' + ''.join(fn[f]['baru'] + '$$\n\n' for f in FN_UBAH) + 'DELIMITER ;\n'
    lama_sql = "-- Definisi LAMA (persis keadaan server) dua fungsi yang diganti; dipakai pulih-satker.sh.\nDELIMITER $$\n\n" + ''.join(fn[f]['lama'] + '$$\n\n' for f in FN_UBAH) + 'DELIMITER ;\n'
    for f in FN_UBAH:
        assert '\n--' not in badan(fn[f]['baru']), f

    # ---- berkas RTF
    dasar = os.path.join(akar, 'derry_briantono')
    daftar_b, lewat = [], []
    tot = {'A': 0, 'B': 0, 'C': 0, 'hapus': 0}
    for dp, dn, fns in os.walk(dasar):
        dn.sort()
        rel_d = os.path.relpath(dp, dasar).replace(os.sep, '/')
        if rel_d == 'terhapus' or rel_d.startswith('terhapus/'):
            continue
        dn[:] = [d for d in dn if d.lower() != 'terhapus']
        for f in sorted(fns):
            if not f.lower().endswith('.rtf'):
                continue
            rel = 'derry_briantono/' + (rel_d + '/' if rel_d != '.' else '') + f
            b = open(os.path.join(dp, f), 'rb').read()
            raw = b.decode('latin1')
            if '#7047#' not in raw and '#7048#' not in raw and 'NIK #03' not in raw:
                continue
            try:
                pot, info = R.rancang(raw)
            except R.Lewat as e:
                lewat.append((rel, str(e)))
                continue
            if not pot:
                continue
            pot.sort(key=lambda x: x[0])
            for (o1, l1, _), (o2, _l2, _b2) in zip(pot, pot[1:]):
                assert o1 + len(l1) <= o2, ('potongan bertumpuk', rel)
            baru = R.terapkan(raw, pot)
            assert seimbang(raw) and seimbang(baru), ('neraca kurung', rel)
            daftar_b.append((rel, b, baru.encode('latin1'), pot, info))
            for k in tot:
                tot[k] += info[k]
    with io.open(os.path.join(keluar, 'daftar-tambal.tsv'), 'w', encoding='utf-8', newline='\n') as d, \
            io.open(os.path.join(keluar, 'tambal.tsv'), 'w', encoding='utf-8', newline='\n') as t:
        d.write(u'# kode\tberkas\tmd5_lama\tmd5_baru\tjumlah potongan - berkas diubah HANYA bila md5 persis md5_lama (keadaan sesudah 30 paket ../URUTAN-PASANG-1nov.md)\n')
        t.write(u'# kode\toffset\tb64(teks lama)\tb64(teks baru)\n')
        for i, (rel, lama, baru, pot, info) in enumerate(daftar_b, 1):
            kode = 'I%04d' % i
            d.write(u'%s\t%s\t%s\t%s\t%d\n' % (kode, rel, md5b(lama), md5b(baru), len(pot)))
            for off, a, z in pot:
                t.write(u'%s\t%d\t%s\t%s\n' % (kode, off, base64.b64encode(a.encode('latin1')).decode('ascii'), base64.b64encode(z.encode('latin1')).decode('ascii')))
    with io.open(os.path.join(hasil, 'rincian.tsv'), 'w', encoding='utf-8', newline='\n') as o:
        o.write(u'# kode\tberkas\tA menjorok disamakan\tB tertulis tangan -> variabel\tC lanjutan DK\tPemohon II dibuang\n')
        for i, (rel, lama, baru, pot, info) in enumerate(daftar_b, 1):
            o.write(u'I%04d\t%s\t%d\t%d\t%d\t%d\n' % (i, rel, info['A'], info['B'], info['C'], info['hapus']))
    with io.open(os.path.join(hasil, 'lewat.tsv'), 'w', encoding='utf-8', newline='\n') as o:
        o.write(u'# berkas yang TIDAK diubah\talasan\n')
        for rel, alasan in lewat:
            o.write(u'%s\t%s\n' % (rel, alasan))
    ringkas = 'BERKAS DIUBAH=%d | A menjorok=%d | B tertulis tangan->variabel=%d (paragraf Pemohon II dibuang %d) | C lanjutan DK=%d | DILEWATI=%d' % (
        len(daftar_b), tot['A'], tot['B'], tot['hapus'], tot['C'], len(lewat))
    open(os.path.join(hasil, 'ringkas.txt'), 'w', newline='\n').write(ringkas + '\n')

    # ---- tulis berkas paket
    for nama, isi in (('PRASYARAT', pra), ('PASANG', ps), ('PERIKSA', pk), ('PULIH', pl), ('UJIVAR', uv), ('FUNGSI-CEK', KEPALA + cek_fn)):
        open(os.path.join(keluar, '%s-%s.sql' % (N, nama)), 'w', newline='\n', encoding='ascii').write(isi)
    open(os.path.join(keluar, '%s-FUNGSI.sql' % N), 'wb').write(fungsi_sql.encode('latin1'))
    open(os.path.join(keluar, '%s-FUNGSI-LAMA.sql' % N), 'wb').write(lama_sql.encode('latin1'))
    open(os.path.join(keluar, 'nomor-diubah.txt'), 'w', newline='\n').write(daftar + '\n')
    open(os.path.join(keluar, 'harap.txt'), 'w', newline='\n').write(HARAP + '\n' + ULANG + '\n')
    for sk in ('pasang-satker.sh', 'pulih-satker.sh', 'perkara-uji.txt'):
        open(os.path.join(keluar, sk), 'wb').write(open(os.path.join(SINI, sk), 'rb').read().replace(b'\r\n', b'\n'))
    tr = os.path.join(PAKET, 'tanya-jawab-format-1nov', 'paket-satker', 'tambal_rtf.py')
    open(os.path.join(keluar, 'tambal_rtf.py'), 'wb').write(open(tr, 'rb').read().replace(b'\r\n', b'\n'))
    ring = dict(variabel=[dict(no=n, lama_md5=ubah[n]['lama_md5'], baru_md5=ubah[n]['baru_md5']) for n in NO_UBAH],
                fungsi={f: dict(lama_md5=fn[f]['md5_lama'], baru_md5=fn[f]['md5_baru']) for f in FN_UBAH}, harap=HARAP, ulang=ULANG, ringkas=ringkas)
    json.dump(ring, open(os.path.join(hasil, 'isi-paket.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    berkas = sorted(x for x in os.listdir(keluar) if os.path.isfile(os.path.join(keluar, x)) and x != 'MD5SUMS.txt')
    with open(os.path.join(keluar, 'MD5SUMS.txt'), 'w', newline='\n') as f:
        for x in berkas:
            f.write('%s  %s\n' % (md5b(open(os.path.join(keluar, x), 'rb').read()), x))
    print(ringkas)
    print({f: fn[f]['md5_baru'] for f in FN_UBAH}, 'HARAP', HARAP, 'ULANG', ULANG, 'berkas', len(berkas))


if __name__ == '__main__':
    main()
