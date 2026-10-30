# -*- coding: utf-8 -*-
"""Bangun paket ABT abt-sela-ps-30okt (putusan sela semua jenis + BAS pemeriksaan setempat) - deterministik.

Pakai: python bangun_paket.py [akar pohon derry_briantono]
  akar = pohon blangko server perkiraan SESUDAH paket prodeo (bawaan D:/Aplikasi/aleta/tmp/bas29/dasar3/derry_briantono); dipakai untuk
  (a) paragraf contoh gaya Derry (97 Sita [01], 4a HB [99c], 4a HB - BAS Sidang PS) dan (b) md5 lama dua berkas yang DITIMPA
  (BAS Sidang PS HB dan Waris; md5 sama di dasar2/dasar3 - tidak disentuh paket prodeo/bas-tanya-jawab/relaas/sampul).
Keluaran: ../paket-satker/ (rtf/, timpa/, SQL, daftar, MD5SUMS.txt) dan ../hasil/isi-paket.json."""
import hashlib
import io
import json
import os
import re
import sys

SINI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, SINI)
import rtfbuat as R  # noqa: E402
import isi  # noqa: E402
import variabel as VB  # noqa: E402
import isi_31  # noqa: E402
import mediasi_el  # noqa: E402
import isi_32  # noqa: E402

AKAR = sys.argv[1] if len(sys.argv) > 1 else 'D:/Aplikasi/aleta/tmp/bas29/dasar3/derry_briantono'
PAKET = os.path.abspath(os.path.join(SINI, '..', 'paket-satker'))
N = 'abt-sela-ps-30okt'
TGL = '2026-10-30 00:00:00'
T_SELA = '97 Sita/[01] [Kabul] Putusan Sela - Sita Dikabulkan.rtf'
T_AKHIR = '4a Harta Bersama/[99c] [NO] HB - Eksepsi Kewenangan Absolut Dikabulkan.rtf'
T_BAS = '4a Harta Bersama - BAS/BAS ALUR 30 HB - Sidang PS - Pemeriksaan Setempat di Lokasi Objek (antara ALUR 04 [7] dan [8]).rtf'
MENU = [
    dict(id=151, nama='Putusan Sela (Eksepsi, Provisi, Intervensi, Sumpah, Pemeriksaan Setempat, Mediasi, Rekonvensi, Penggabungan)', alias='Putusan Sela - Putusan', dir='97a Putusan Sela',
         pmin=80, pmax=297, kmin=15, kmax=17, ref='alur_perkara_id', cek=3, grup='1|10|20', top='1', val=None),
    dict(id=152, nama='Putusan Sela - BAS', alias='Putusan Sela - BAS', dir='97a Putusan Sela - BAS',
         pmin=80, pmax=297, kmin=15, kmax=17, ref='alur_perkara_id', cek=3, grup='1|30|500|430|1000|1010|1020', top='1|30', val='10|20'),
]


def md5b(b):
    return hashlib.md5(b).hexdigest()


def md5s(s):
    return md5b(s.encode('latin1'))


def contoh(rel):
    raw = R.baca(os.path.join(AKAR, rel))
    return R.pecah(raw), md5s(raw)


def tanpa_b(par):
    """Run pertama tanpa tebal (baris identitas BAS: nama ditebalkan lewat markah)."""
    i = par.index('{')
    j = par.find('\\b1 ', i)
    assert 0 < j < i + 300
    return par[:j] + par[j + 4:]


def susun(spesifikasi, jenis, T):
    (kep, p, ekor), _ = T
    out = []
    if jenis in ('sela', 'akhir'):
        if jenis == 'sela':
            peta = dict(judul=p[0], nomor=p[1], tengah=p[3], pembuka=p[6], ident=p[7], melawan=p[8], biasa=p[10], sub=p[13], duduk=p[14],
                        butir=p[30], sub2=p[20], bagian=p[10], timbang=p[21], mengadili=p[29], amar=p[30], kaki=p[36])
            tetap = dict(kosong=p[2], kosong2=p[5], ttd=p[37], akhir=p[38])
        else:
            peta = dict(judul=p[0], nomor=p[1], tengah=p[3], pembuka=p[6], ident=p[7], melawan=p[8], biasa=p[10], sub=p[12], duduk=p[13],
                        butir=p[16], sub2=p[30], bagian=p[32], timbang=p[31], mengadili=p[50], amar=p[51])
            ekor_akhir = ''.join(p[54:71])
            ekor_akhir = re.sub(r'\{\\\*\\isianasal [^{}]*\}', '', ekor_akhir)
            assert '#8501#' in ekor_akhir and '#8500#' in ekor_akhir and '#11123#' in ekor_akhir and 'isianasal' not in ekor_akhir
            tetap = dict(kosong=p[2], kosong2=p[5], ekor_akhir=ekor_akhir)
        for g, t in spesifikasi:
            if g in tetap:
                out.append(tetap[g])
            elif g == 'bagian' and jenis == 'sela':
                out.append(R.par(peta['biasa'], '<b>%s</b>' % t))
            else:
                out.append(R.par(peta[g], t))
    else:
        peta = dict(b_judul=p[0], b_nomor=p[1], b_lanjutan=p[2], b_badan=p[4], b_ident=tanpa_b(p[5]), b_melawan=p[6], b_tj=p[8], b_amarjudul=p[0])
        tetap = dict(b_kosong=p[3], b_majelis=p[8], b_ttd=''.join(p[20:33]))
        for g, t in spesifikasi:
            out.append(tetap[g] if g in tetap else R.par(peta[g], t))
    return kep, out, ekor


def nomor(teks):
    return sorted(set(int(x) for x in re.findall(r'#(\d{4,5})#', teks)))


def main():
    T = {'sela': contoh(T_SELA), 'akhir': contoh(T_AKHIR), 'bas': contoh(T_BAS)}
    hasil = []
    berkas = {}   # (folder, berkas) -> bytes
    timpa = []
    dirujuk = set()
    for folder, nama, jenis, fn, asal, mat in isi.SEMUA + isi_31.TAMBAHAN + isi_32.TAMBAHAN:
        kep, par, ekor = susun(fn(), jenis, T[jenis])
        for tanda, kaki_baru in (('[Penetapan]', 'Penetapan Nomor'), ('[Sisipan]', 'Putusan Nomor')):
            if tanda in nama:
                assert kep.count('Putusan Sela Nomor') == 1, nama
                kep = kep.replace('Putusan Sela Nomor', kaki_baru)
        if 'Penetapan Sela' in nama:
            # kaki halaman contoh berbunyi "Putusan Sela Nomor ..." - produk permohonan adalah penetapan sela
            assert kep.count('Putusan Sela Nomor') == 1, nama
            kep = kep.replace('Putusan Sela Nomor', 'Penetapan Sela Nomor')
        raw = R.rakit(kep, par, ekor, asal)
        berkas[(folder, nama)] = raw
        hasil.append(dict(folder=folder, berkas=nama, jenis=jenis, matriks=mat, isian_tidak_langsung=asal))
    for folder, nama, ditimpa, obj in isi.PS_JENIS + isi_31.PS_CERAI:
        kep, par, ekor = susun(isi.bas_ps(), 'bas', T['bas'])
        asal = [obj] + [x for x in isi.PS_ISIAN if x != obj]
        raw = R.rakit(kep, par, ekor, asal)
        berkas[(folder, nama)] = raw
        if ditimpa:
            lama = R.baca(os.path.join(AKAR, folder.split('/', 1)[1], nama))
            timpa.append((folder, nama, md5s(lama), md5s(raw)))
        hasil.append(dict(folder=folder, berkas=nama, jenis='bas-ps', timpa=ditimpa, isian_tidak_langsung=asal))
    # mediasi elektronik (PERMA 3/2022) dari blangko mediasi biasa yang ada; berkas lama tidak diubah
    mediasi_lewat = []
    for d in sorted(os.listdir(AKAR)):
        if not os.path.isdir(os.path.join(AKAR, d)):
            continue
        for n_asal in sorted(os.listdir(os.path.join(AKAR, d))):
            n_baru = mediasi_el.nama_elektronik(n_asal)
            if not n_baru:
                continue
            raw = mediasi_el.bas(R.baca(os.path.join(AKAR, d, n_asal)))
            if raw is None:
                mediasi_lewat.append(d + '/' + n_asal)
                continue
            folder = 'derry_briantono/' + d
            assert not os.path.exists(os.path.join(AKAR, d, n_baru)), n_baru
            berkas[(folder, n_baru)] = raw
            hasil.append(dict(folder=folder, berkas=n_baru, jenis='bas-mediasi-elektronik', asal=n_asal))
    assert not mediasi_lewat, mediasi_lewat
    f_ptsp, n_ptsp = mediasi_el.ASAL_PTSP
    assert not os.path.exists(os.path.join(AKAR, f_ptsp.split('/', 1)[1], isi_31.MEDIASI_EL_PTSP))
    berkas[(f_ptsp, isi_31.MEDIASI_EL_PTSP)] = mediasi_el.ptsp(R.baca(os.path.join(AKAR, f_ptsp.split('/', 1)[1], n_ptsp)))
    hasil.append(dict(folder=f_ptsp, berkas=isi_31.MEDIASI_EL_PTSP, jenis='penetapan-mediasi-elektronik', asal=n_ptsp))
    # pemeriksaan isi
    for (folder, nama), raw in berkas.items():
        assert R.seimbang(raw), nama
        assert all(ord(c) < 256 for c in raw)
        assert 'aleta' not in raw.lower(), nama
        assert not re.search(r'bungku|morowali|donggala', raw, re.I), nama
        dirujuk |= set(nomor(raw))
    for v in VB.V:
        dirujuk |= set(nomor((v['sql'] or '') + v['nama']))
        if v['referensi']:
            dirujuk.add(int(v['referensi']))
    baru = set(VB.NOMOR)
    lama_dirujuk = sorted(x for x in dirujuk if x not in baru)
    belum = sorted(x for x in dirujuk if 11300 <= x <= 11499 and x not in baru)
    assert not belum, 'nomor paket dirujuk tetapi tidak dibuat: %s' % belum
    # --- tulis berkas -------------------------------------------------------------------------------------------------
    os.makedirs(PAKET, exist_ok=True)
    for sub in ('rtf', 'timpa'):
        d = os.path.join(PAKET, sub)
        if os.path.isdir(d):
            for akar, _dn, fn in os.walk(d, topdown=False):
                for f in fn:
                    os.remove(os.path.join(akar, f))
                for x in _dn:
                    os.rmdir(os.path.join(akar, x))
    drtf, dtim = [], []
    ditimpa = set((f, n) for f, n, _a, _b in timpa)
    for (folder, nama), raw in sorted(berkas.items()):
        sub = 'timpa' if (folder, nama) in ditimpa else 'rtf'
        d = os.path.join(PAKET, sub, folder)
        os.makedirs(d, exist_ok=True)
        with open(os.path.join(d, nama), 'wb') as f:
            f.write(raw.encode('latin1'))
        if sub == 'rtf':
            drtf.append('\t'.join([folder, nama, md5s(raw), 'dibangun sumber/bangun_paket.py (sela-ps 30 Okt 2026)']))
    for folder, nama, ml, mb in timpa:
        dtim.append('\t'.join([folder, nama, ml, mb, 'BAS pemeriksaan setempat diganti isi baru (tanya-jawab para pihak, objek per baris, kesimpulan pencocokan)']))

    def tulis(nama, baris):
        with io.open(os.path.join(PAKET, nama), 'w', encoding='utf-8', newline='\n') as f:
            f.write('\n'.join(baris) + '\n')
    tulis('daftar-rtf.tsv', ['# folder\tberkas\tmd5\tasal - berkas BARU (tidak pernah menimpa berkas lain)'] + drtf)
    tulis('daftar-timpa.tsv', ['# folder\tberkas\tmd5_lama\tmd5_baru\tket - berkas LAMA diganti HANYA bila md5 persis md5_lama'] + dtim)
    tulis('folder-baru.txt', ['# folder BARU (relatif _blangko_abt) yang dibuat paket ini; dipindah ke arsip pulih bila kosong', isi.F_SELA, isi.F_SELA_BAS])
    tulis('folder-ada.txt', ['# folder (relatif _blangko_abt) yang harus SUDAH ada', 'derry_briantono'] +
          sorted(set(f for f, _n in berkas if f not in (isi.F_SELA, isi.F_SELA_BAS))))
    tulis('nomor-variabel.txt', ['# nomor variabel BARU paket (satu per baris; blok 11300-11499 diklaim paket ini)'] + [str(x) for x in VB.NOMOR])
    tulis('nomor-dirujuk.txt', ['# variabel LAMA yang dirujuk blangko/variabel paket (harus ADA di server; termasuk 11122-11140 paket prodeo)', ','.join('%04d' % x for x in lama_dirujuk)])
    tulis_sql(lama_dirujuk)
    tulis_uji()
    tulis('harap.txt', ['0|0|%d|0|0|2' % len(lama_dirujuk), '0|%d|%d|0|2|2' % (len(VB.V), len(lama_dirujuk))])
    for nm in ('berkas_rtf.py', 'pasang-satker.sh', 'pulih-satker.sh'):
        with open(os.path.join(SINI, nm), 'rb') as f:
            isi_b = f.read().replace(b'\r\n', b'\n')
        with open(os.path.join(PAKET, nm), 'wb') as f:
            f.write(isi_b)
    md5sums()
    json.dump(dict(contoh={k: v[1] for k, v in T.items()}, berkas=hasil, variabel=[dict(no=v['no'], nama=v['nama'], tipe=v['tipe']) for v in VB.V],
                   dirujuk=lama_dirujuk, menu=MENU),
              open(os.path.join(SINI, '..', 'hasil', 'isi-paket.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('blangko baru', len(drtf), 'timpa', len(dtim), 'variabel', len(VB.V), 'dirujuk lama', len(lama_dirujuk))


# ---------------------------------------------------------------------------------------------------------------------------
def hx(s):
    return 'NULL' if s is None else '0x' + s.encode('latin1').hex()


def sidik_var(v):
    return md5s('|'.join([v['nama'], v['tipe'], v['sql'] or '', ('%04d' % int(v['referensi'])) if v['referensi'] else '', v['multi'] or '', '0', 'admin']))


SIDIK_VAR_SQL = "MD5(CONCAT_WS('|', nama, data_type, IFNULL(sql_query, ''), IFNULL(referensi, ''), IFNULL(multi_sidang, ''), locked, IFNULL(modifier, '')))"
SV = "MD5(CONCAT_WS('|', v.nama, v.data_type, IFNULL(v.sql_query, ''), IFNULL(v.referensi, ''), IFNULL(v.multi_sidang, ''), v.locked, IFNULL(v.modifier, '')))"
SIDIK_MENU_SQL = ("MD5(CONCAT_WS('|', nama, nama_alias, direktori, parent_direktori, proses_id_min, proses_id_max, perkara_id_min, perkara_id_max, "
                  "perkara_id_referensi, user_cek, user_grup_id, user_top_id, IFNULL(user_validator, '')))")


def sidik_menu(m):
    return md5s('|'.join(str(x) for x in [m['nama'], m['alias'], m['dir'], 'derry_briantono', m['pmin'], m['pmax'], m['kmin'], m['kmax'], m['ref'], m['cek'],
                                          m['grup'], m['top'], m['val'] or '']))


def tulis_sql(lama):
    kop = ('-- Paket ABT "%s" (30 Okt 2026): putusan sela semua jenis (folder baru 97a Putusan Sela, menu 151) dan BAS sela (97a Putusan Sela - BAS, menu 152), '
           'BAS pemeriksaan setempat di folder BAS jenis kebendaan. %d variabel baru %d-%d. Hanya pengguna derry_briantono.' % (N, len(VB.V), VB.NOMOR[0], VB.NOMOR[-1]))
    nomor = ','.join(str(x) for x in VB.NOMOR)
    pasangan = ' UNION ALL '.join("SELECT %d AS n, '%s' AS h" % (v['no'], sidik_var(v)) for v in VB.V)
    menu_ps = ' UNION ALL '.join("SELECT %d AS i, '%s' AS h" % (m['id'], sidik_menu(m)) for m in MENU)
    dirs = ','.join("'%s'" % m['dir'] for m in MENU)
    # PRASYARAT
    pr = [kop,
          '-- PRASYARAT (baca saja) "A|B|C|D|E|F": A = nomor 11300-11499 yang ada tetapi BUKAN isi paket (harus 0) | B = nomor paket yang sudah persis isi paket '
          '(0 pertama, %d ulang) | C = variabel lama yang dirujuk ADA (harus %d; termasuk variabel paket prodeo 11122-11140) | D = menu 151/152 berisi lain atau menu lain '
          'memakai folder paket (harus 0) | E = menu paket terpasang persis (0 pertama, 2 ulang) | F = fungsi isian_rtf_tanggal dan isian_rtf_alamat ada (harus 2).' % (len(VB.V), len(lama)),
          '-- Benar: "0|0|%d|0|0|2" (pasang pertama) atau "0|%d|%d|0|2|2" (pasang ulang).' % (len(lama), len(VB.V), len(lama)),
          'SELECT CONCAT_WS(\'|\',',
          '  (SELECT COUNT(*) FROM abt_variabel v WHERE v.no_var BETWEEN 11300 AND 11499 AND NOT EXISTS (SELECT 1 FROM (%s) x WHERE x.n = v.no_var AND x.h = %s)),' % (pasangan, SV),
          '  (SELECT COUNT(*) FROM abt_variabel v JOIN (%s) x ON x.n = v.no_var WHERE x.h = %s),' % (pasangan, SV),
          '  (SELECT COUNT(*) FROM abt_variabel WHERE no_var IN (%s)),' % ','.join(str(x) for x in lama),
          '  (SELECT COUNT(*) FROM abt_menu m WHERE (m.id IN (151, 152) AND NOT EXISTS (SELECT 1 FROM (%s) y WHERE y.i = m.id AND y.h = MD5(CONCAT_WS(\'|\', m.nama, m.nama_alias, m.direktori, m.parent_direktori, m.proses_id_min, m.proses_id_max, m.perkara_id_min, m.perkara_id_max, m.perkara_id_referensi, m.user_cek, m.user_grup_id, m.user_top_id, IFNULL(m.user_validator, \'\'))))) OR (m.id NOT IN (151, 152) AND m.direktori IN (%s) AND m.parent_direktori = \'derry_briantono\')),' % (menu_ps, dirs),
          '  (SELECT COUNT(*) FROM abt_menu m JOIN (%s) y ON y.i = m.id WHERE y.h = MD5(CONCAT_WS(\'|\', m.nama, m.nama_alias, m.direktori, m.parent_direktori, m.proses_id_min, m.proses_id_max, m.perkara_id_min, m.perkara_id_max, m.perkara_id_referensi, m.user_cek, m.user_grup_id, m.user_top_id, IFNULL(m.user_validator, \'\')))),' % menu_ps,
          '  (SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema = DATABASE() AND routine_name IN (\'isian_rtf_tanggal\', \'isian_rtf_alamat\'))',
          ') AS prasyarat;']
    tulisf('%s-PRASYARAT.sql' % N, pr)
    # PASANG
    ps = [kop, '-- PASANG: satu transaksi; baris baru INSERT ... WHERE NOT EXISTS (pasang ulang tidak menggandakan). Tidak ada baris lama yang diubah.', 'START TRANSACTION;']
    for v in VB.V:
        ps.append('INSERT INTO abt_variabel (no_var, nama, data_type, data_tabel, data_kolom, urutan_data, referensi, sql_query, default_data, multi_sidang, locked, modifier, modified) '
                  "SELECT %d, %s, '%s', NULL, NULL, NULL, %s, %s, NULL, %s, 0, 'admin', '%s' FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM abt_variabel WHERE no_var = %d);"
                  % (v['no'], hx(v['nama']), v['tipe'], str(int(v['referensi'])) if v['referensi'] else 'NULL', hx(v['sql']), hx(v['multi']), TGL, v['no']))
    for m in MENU:
        ps.append('INSERT INTO abt_menu (id, nama, nama_alias, direktori, parent_direktori, proses_id_min, proses_id_max, perkara_id_min, perkara_id_max, perkara_id_referensi, '
                  "user_cek, user_grup_id, user_top_id, user_validator, modified) SELECT %d, %s, %s, %s, 'derry_briantono', %d, %d, %d, %d, '%s', %d, '%s', '%s', %s, '%s' "
                  'FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM abt_menu WHERE id = %d);'
                  % (m['id'], hx(m['nama']), hx(m['alias']), hx(m['dir']), m['pmin'], m['pmax'], m['kmin'], m['kmax'], m['ref'], m['cek'], m['grup'], m['top'],
                     "'%s'" % m['val'] if m['val'] else 'NULL', TGL, m['id']))
    ps.append('COMMIT;')
    tulisf('%s-PASANG.sql' % N, ps)
    # PERIKSA
    pe = [kop, '-- PERIKSA (baca saja): tiap baris paket persis isi paket; baris terakhir harus: SEMUA COCOK', 'SELECT label, ok FROM (']
    bar = []
    for v in VB.V:
        bar.append("SELECT 'var %d' AS label, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = %d AND %s = '%s') AS ok" % (v['no'], v['no'], SIDIK_VAR_SQL, sidik_var(v)))
    for m in MENU:
        bar.append("SELECT 'menu %d' AS label, (SELECT COUNT(*) FROM abt_menu WHERE id = %d AND %s = '%s') AS ok" % (m['id'], m['id'], SIDIK_MENU_SQL, sidik_menu(m)))
    jml = len(bar)
    pe.append('\nUNION ALL '.join(bar))
    pe.append(') c WHERE ok <> 1')
    pe.append('UNION ALL')
    pe.append("SELECT IF(SUM(ok) = %d, 'SEMUA COCOK', CONCAT(%d - SUM(ok), ' TIDAK COCOK')), SUM(ok) FROM (%s) d;" % (jml, jml, '\nUNION ALL '.join(bar)))
    tulisf('%s-PERIKSA.sql' % N, pe)
    # PULIH
    pu = [kop, '-- PULIH (deterministik): baris baru dihapus HANYA bila isinya masih persis paket (yang sudah disunting orang dibiarkan dan dilaporkan pulih-satker.sh).',
          '-- Isian perkara (abt_data_teks) nomor paket dicadangkan pulih-satker.sh SEBELUM file ini dijalankan (hapus variabel ikut menghapus isiannya).', 'START TRANSACTION;']
    for v in VB.V:
        pu.append("DELETE FROM abt_variabel WHERE no_var = %d AND %s = '%s';" % (v['no'], SIDIK_VAR_SQL, sidik_var(v)))
    for m in MENU:
        pu.append("DELETE FROM abt_menu WHERE id = %d AND %s = '%s';" % (m['id'], SIDIK_MENU_SQL, sidik_menu(m)))
    pu += ['COMMIT;', "SELECT CONCAT('PULIH SQL SELESAI; sisa variabel paket: ', (SELECT COUNT(*) FROM abt_variabel WHERE no_var IN (%s)), ', sisa menu paket: ', "
                      "(SELECT COUNT(*) FROM abt_menu WHERE id IN (151, 152) AND parent_direktori = 'derry_briantono' AND direktori IN (%s)));" % (nomor, dirs)]
    tulisf('%s-PULIH.sql' % N, pu)


def md5sums():
    """MD5SUMS.txt untuk semua berkas paket-satker (kecuali cadangan uji dan dirinya), format md5sum (dua spasi)."""
    out = []
    for akar, dn, fn in os.walk(PAKET):
        dn[:] = sorted(d for d in dn if d != 'cadangan')
        for f in sorted(fn):
            rel = os.path.relpath(os.path.join(akar, f), PAKET).replace(os.sep, '/')
            if rel == 'MD5SUMS.txt':
                continue
            out.append('%s  %s' % (md5b(open(os.path.join(akar, f), 'rb').read()), rel))
    with io.open(os.path.join(PAKET, 'MD5SUMS.txt'), 'w', encoding='utf-8', newline='\n') as f:
        f.write('\n'.join(sorted(out, key=lambda x: x[34:])) + '\n')


def tulisf(nama, baris):
    with io.open(os.path.join(PAKET, nama), 'w', encoding='utf-8', newline='\n') as f:
        f.write('\n'.join(baris) + '\n')


def tulis_uji():
    """uji-kueri.tsv: no<TAB>kueri (#perkara_id# diganti saat uji; penanda lain dibiarkan apa adanya - tetap kueri sah)."""
    b = ['# no\tkueri data_sql paket (dijalankan pasang-satker.sh atas perkara nyata, baca saja)']
    for v in VB.V:
        if v['tipe'] == 'data_sql':
            assert '\t' not in v['sql'] and '\n' not in v['sql']
            b.append('%d\t%s' % (v['no'], v['sql']))
    tulisf('uji-kueri.tsv', b)


if __name__ == '__main__':
    main()
