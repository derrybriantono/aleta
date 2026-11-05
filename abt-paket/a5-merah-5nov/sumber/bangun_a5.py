# -*- coding: utf-8 -*-
"""Bangun paket abt-a5-merah-5nov (keputusan Derry, 5 Nov 2026) atas daftar teks merah A5 + kalimat [98] Cabut.
pakai: python -B sumber/bangun_a5.py <akar pohon dasar berisi derry_briantono/> <daftar-teks-merah.csv> <paket-satker> <hasil>
Pohon dasar = keadaan server sesudah keputusan-a-rekonvensi-4nov. Baris daftar dipetakan ke token RTF lewat urutan (dicocokkan huruf per huruf).
Golongan: hitamkan (warna merah dihapus, kata sama) | isian (teks diganti penanda isian, warna merah dihapus) | buang (catatan kerja dibuang)
| cabut (#8555# -> #8554#). Baris 'hitamkan atau isian' (540) TIDAK disentuh. BERHENTI bila ada pemeriksaan gagal."""
import base64
import collections
import csv
import hashlib
import os
import re
import sys

SINI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, SINI)
import merahpos as mp  # noqa: E402

N = 'abt-a5-merah-5nov'
TANGGAL = '2026-11-05 00:00:00'
PAR = bytes([92]) + b'par'
CF0 = b'{' + bytes([92]) + b'cf0 '

VARIABEL = [
    dict(no=9284, nama='RELAAS: PEJABAT DESA/KELURAHAN YANG TIDAK MAU TANDA TANGAN - PILIH: Lurah / Kepala Desa', bawaan='Lurah\nKepala Desa'),
    dict(no=9285, nama='ITSBAT NO TERIKAT NIKAH: #0046# YANG MASIH TERIKAT PERKAWINAN LAIN - PILIH: I / II', bawaan='I\nII'),
    dict(no=9286, nama='ITSBAT NO TERIKAT NIKAH: #0046# PASANGANNYA DALAM PERNIKAHAN INI - PILIH: II / I', bawaan='II\nI'),
    dict(no=9287, nama='ITSBAT NO TERIKAT NIKAH: PASANGAN LAIN YANG MASIH TERIKAT - PILIH: laki-laki / perempuan', bawaan='laki-laki\nperempuan'),
    dict(no=9288, nama='ITSBAT NO TERIKAT NIKAH: PASANGAN TERDAHULU - PILIH: suami / istri', bawaan='suami\nistri'),
    dict(no=9289, nama='CERAI: DALIL LAIN YANG DIBANTAH #0047# - ISIAN (lanjutan kalimat "Dalil mengenai ...", tanpa titik koma akhir)', bawaan=None),
    dict(no=9294, nama='ITSBAT TOLAK WALI: KEADAAN KELUARGA WALI SAAT PERNIKAHAN - PILIH: tidak hadir / berada di tempat lain', bawaan='tidak hadir acara pernikahan para #0046#\nberada di _'),
    dict(no=9295, nama='PERWALIAN: TANGGAL LAHIR DAN UMUR ANAK PERTAMA - ISIAN (contoh: 5 Maret 2015 (10 tahun))', bawaan='_ (_ tahun)'),
    dict(no=9296, nama='PERWALIAN: TANGGAL LAHIR DAN UMUR ANAK KEDUA - ISIAN (contoh: 5 Maret 2015 (10 tahun))', bawaan='_ (_ tahun)'),
]
DIPAKAI_ADA = (9683, 46)  # variabel lama yang dirujuk tambalan

ISIAN_NO = {  # nomor baris daftar -> teks baru token (isian khusus per baris)
    '817': '#0046# #9285#', '818': '#9287#', '819': '#0046# #9286#', '820': '#0046# #9285#', '821': '#9288# ',
    '822': '#9683#', '839': '#0046# #9285#', '840': '#9287# ',
    '897': '#9295#', '900': '#9296#',
}
CABUT = ['2 Itsbat Nikah/[98] [Cabut] IN.rtf',
         '5b Pencegahan Perkawinan/[98] [Cabut] Pencegahan Perkawinan - Permohonan Ditarik Kembali.rtf',
         '6 Perwalian/[98] [Cabut] Perwalian.rtf',
         '9 Penetapan Ahli Waris/[98] [Cabut] PAW.rtf',
         '9a Lain-Lain (Pengangkatan Anak)/[98] [Cabut] Pengangkatan Anak.rtf',
         '9b Permohonan Umum/[98] [Cabut] Permohonan.rtf']
KALIMAT_CABUT = 'dikabulkan #8555# maka perkara tersebut dinyatakan telah selesai'


def md5b(b):
    return hashlib.md5(b).hexdigest()


def b64(b):
    return base64.b64encode(b).decode('ascii')


def hexs(s):
    return '0x' + s.encode('latin1').hex()


def hapus_cf(b, cf):
    """(offset, lama, baru) menghapus kendali \\cfN tanpa merusak kendali sebelumnya."""
    o, z = cf
    sebelum = b[o - 1:o]
    if sebelum in (b' ', b'{', b'}', b'\r', b'\n'):
        return (o, b[o:z], b'')
    # kendali sebelumnya tanpa pembatas: spasi pembatas \cf dipertahankan
    z2 = z - 1 if b[z - 1:z] == b' ' else z
    return (o, b[o:z2], b'')


def bersih_warna(b, p, t, sasaran, ops, sudah):
    """Warna merah token t dihapus. Bila kendali \\cf hanya dipakai token sasaran: kendalinya dihapus. Bila dipakai teks lain: token dibungkus {\\cf0 ...}."""
    cf = t['cf_pos']
    if cf is None:
        raise SystemExit('token merah tanpa kendali warna: %r' % t['teks'][:40])
    lain = [x for x in p['toks'] if x['cf_pos'] == cf and x['teks'].strip() and x['o0'] not in sasaran]
    if not lain and not p['pakai_cf'].get(cf):
        if cf not in sudah:
            ops.append(hapus_cf(b, cf))
            sudah.add(cf)
        return 'kendali'
    ops.append((t['o0'], b'', CF0))
    ops.append((t['o1'], b'', b'}'))
    return 'bungkus'


def buang(b, p, t, ops):
    """Catatan kerja dibuang: seluruh grup token itu; bila paragraf hanya berisi catatan, penutup paragrafnya ikut dibuang."""
    g = t['grup']
    a, z = p['grup_awal'][g], p['grup_akhir'][g]
    if [x for x in p['toks'] if x['grup'] == g and x is not t]:
        raise SystemExit('grup catatan memuat teks lain: %r' % t['teks'][:40])
    raw = b[a:z + 1]
    if PAR in raw:
        raise SystemExit('grup catatan memuat par: %r' % t['teks'][:40])
    isi = [x for x in p['toks'] if x['para'] == t['para'] and x['teks'].strip() and x is not t]
    ujung = z + 1
    if not isi:
        m = re.compile(rb'\s*\{[^{}]*' + re.escape(PAR) + rb' ?\}').match(b, ujung)
        if not m:
            raise SystemExit('penutup paragraf catatan tidak dikenal: %r' % b[ujung:ujung + 80])
        ujung = m.end()
    ops.append((a, b[a:ujung], b''))
    return 'paragraf' if not isi else 'grup'


def terapkan(b, ops):
    urut = sorted(ops, key=lambda x: (x[0], len(x[1])))
    for x, y in zip(urut, urut[1:]):
        if x[0] + len(x[1]) > y[0]:
            raise SystemExit('potongan tumpang tindih %r %r' % (x[:2], y[:2]))
    h = b
    for off, l0, l1 in sorted(urut, key=lambda x: (-x[0], -len(x[1]))):
        assert h[off:off + len(l0)] == l0
        h = h[:off] + l1 + h[off + len(l0):]
    return h, urut


def main():
    akar, daftar_csv, keluar, hasil = sys.argv[1:5]
    rows = list(csv.DictReader(open(daftar_csv, encoding='utf-8-sig')))
    per = collections.OrderedDict()
    for r in rows:
        per.setdefault(r['berkas'], []).append(r)
    catat = []  # baris hasil/daftar-tambalan.csv
    daftar = []
    tambal = []
    hit = collections.Counter()
    berkas_gol = collections.defaultdict(set)
    merah_laporan = []
    kode_n = 0
    semua = list(per.keys()) + [c for c in CABUT if c not in per]
    for rel in semua:
        p_rel = 'derry_briantono/' + rel
        b = open(os.path.join(akar, p_rel.replace('/', os.sep)), 'rb').read()
        p = mp.peta(b)
        ur = mp.urai(b)
        if [p['para'][k] for k in sorted(p['para'])][:len(ur['paragraf'])] != ur['paragraf'][:len(p['para'])]:
            raise SystemExit('peta paragraf beda dengan rtfmini: %s' % rel)
        rr = per.get(rel, [])
        bc = mp.baris_csv(p['toks'])
        if len(bc) != len(rr) and rr:
            raise SystemExit('jumlah token != baris: %s %d %d' % (rel, len(bc), len(rr)))
        tugas = []  # (baris daftar, token, golongan, teks baru)
        for r, t in zip(rr, bc):
            if t['teks'].strip().replace('\n', ' / ').replace('\t', ' ')[:400] != r['potongan teks merah']:
                raise SystemExit('teks beda %s no %s' % (rel, r['no']))
            u = r['usulan']
            if u == 'hitamkan':
                tugas.append((r, t, 'hitamkan', None))
            elif u == 'buang/hitamkan':
                if not re.fullmatch(r'\((?:PERTIMBANGAN APABILA SAKSI HANYA MENGETAHUI PISAH TAPI TIDAK MELIHAT LANGSUNG APA MASALAHNYA|APABILA SUAMI TIDAK BEKERJA/MALAS|ANAK 1 PERSATU P NYA)\)[;]? ?', t['teks']):
                    raise SystemExit('catatan tak dikenal: %r' % t['teks'])
                tugas.append((r, t, 'buang', None))
            elif u == 'isian':
                s = t['teks'].strip()
                if r['no'] in ISIAN_NO:
                    tugas.append((r, t, 'isian', ISIAN_NO[r['no']]))
                elif s == 'Lurah/Kepala Desa':
                    tugas.append((r, t, 'isian', '#9284#'))
                elif s == '_;':
                    tugas.append((r, t, 'isian', ' #9289#;'))
                elif r['no'] == '814':
                    bag = 'tidak hadir acara pernikahan para #0046#/berada di _'
                    if t['teks'].count(bag) != 1:
                        raise SystemExit('814 berubah')
                    tugas.append((r, t, 'isian', t['teks'].replace(bag, '#9294#')))
                elif s == '...':
                    # sesudah huruf Arab kutipan kitab: tanda potongan kutipan, bukan bagian kosong -> dibiarkan merah, dilaporkan
                    sblm = b[max(0, t['o0'] - 120):t['o0']]
                    if not re.search(rb'u1[56]\d\d \?\}\}\{[^{}]*$', sblm):
                        raise SystemExit('"..." bukan sesudah huruf Arab: %s no %s' % (rel, r['no']))
                    catat.append((r['no'], rel, s, 'batal', 'isian-kosong', 'tetap merah: tanda potongan kutipan kitab Arab, bukan bagian kosong'))
                    hit['batal isian (kutipan Arab)'] += 1
                else:
                    raise SystemExit('isian tanpa aturan: %s no %s %r' % (rel, r['no'], s))
        sasaran = set(t['o0'] for _, t, g, _x in tugas if g in ('hitamkan', 'isian'))
        ops = []
        sudah = set()
        harap = {k: v for k, v in p['para'].items()}
        ubah_para = collections.defaultdict(list)
        hapus_para = set()
        for r, t, g, baru in tugas:
            if g == 'buang':
                cara = buang(b, p, t, ops)
                ubah_para[t['para']].append((t['p0'], t['p0'] + len(t['teks']), ''))
                if cara == 'paragraf':
                    hapus_para.add(t['para'])
                catat.append((r['no'], rel, r['potongan teks merah'], 'buang', cara, ''))
                hit['buang'] += 1
                berkas_gol['buang'].add(rel)
                continue
            cara = bersih_warna(b, p, t, sasaran, ops, sudah)
            hit['cara warna ' + cara] += 1
            if g == 'hitamkan':
                catat.append((r['no'], rel, r['potongan teks merah'], 'hitamkan', cara, ''))
                hit['hitamkan'] += 1
                berkas_gol['hitamkan'].add(rel)
            else:
                ops.append((t['o0'], b[t['o0']:t['o1']], baru.encode('ascii')))
                ubah_para[t['para']].append((t['p0'], t['p0'] + len(t['teks']), baru))
                catat.append((r['no'], rel, r['potongan teks merah'], 'isian', baru.strip(), ''))
                hit['isian'] += 1
                berkas_gol['isian'].add(rel)
        if rel in CABUT:
            ada = 0
            for k, v in p['para'].items():
                if KALIMAT_CABUT in v:
                    ada += 1
                    pos = v.index(KALIMAT_CABUT) + len('dikabulkan ')
                    tk = [x for x in p['toks'] if x['para'] == k and x['p0'] <= pos < x['p0'] + len(x['teks'])]
                    assert len(tk) == 1 and '#8555#' in tk[0]['teks']
                    t = tk[0]
                    off = t['o0'] + (pos - t['p0'])
                    assert b[off:off + 6] == b'#8555#'
                    ops.append((off, b'#8555#', b'#8554#'))
                    ubah_para[k].append((pos, pos + 6, '#8554#'))
                    catat.append(('', rel, v.strip(), 'cabut', '#8555# -> #8554#', ''))
                    hit['cabut'] += 1
                    berkas_gol['cabut'].add(rel)
            if ada != 1:
                raise SystemExit('kalimat cabut bukan satu: %s %d' % (rel, ada))
        if not ops:
            hit['berkas tanpa ubahan'] += 1
            merah_laporan.append((rel, len(rr), 0, len(bc), len(bc)))
            continue
        # pecah sisipan/potongan menjadi potongan paket: tiap potongan harus punya bita lama; gabung sisipan dengan bita sesudah/sebelumnya
        h, urut = terapkan(b, ops)
        # --- pemeriksaan: paragraf = harapan
        for k, ed in ubah_para.items():
            s = harap[k]
            for a, z, baru in sorted(ed, reverse=True):
                s = s[:a] + baru + s[z:]
            harap[k] = s
        par_harap = [harap[k] for k in sorted(harap) if k not in hapus_para]
        ph = mp.peta(h)
        par_hasil = [ph['para'][k] for k in sorted(ph['para'])]
        if par_harap != par_hasil:
            for i, (x, y) in enumerate(zip(par_harap, par_hasil)):
                if x != y:
                    raise SystemExit('paragraf hasil beda %s #%d\n%r\n%r' % (rel, i, x[:200], y[:200]))
            raise SystemExit('jumlah paragraf beda %s %d %d' % (rel, len(par_harap), len(par_hasil)))
        # --- pemeriksaan: merah sesudah = merah sebelum minus token yang dikerjakan (urutan sama)
        dikerja = set(t['o0'] for _, t, g, _x in tugas)
        merah0 = [t['teks'] for t in p['toks'] if t['merah'] and t['o0'] not in dikerja]
        merah1 = [t['teks'] for t in ph['toks'] if t['merah']]
        if merah0 != merah1:
            raise SystemExit('merah sesudah beda: %s %d %d' % (rel, len(merah0), len(merah1)))
        d = 0
        i = 0
        while i < len(h):
            c = h[i]
            if c == 92:
                i += 2
                continue
            d += (c == 123) - (c == 125)
            i += 1
        if d != 0:
            raise SystemExit('kurung tidak seimbang: %s' % rel)
        if re.search(rb'aleta', b''.join(x[2] for x in urut), re.I):
            raise SystemExit('kata terlarang di potongan')
        kode_n += 1
        kode = 'A%04d' % kode_n
        pot = []
        for off, l0, l1 in urut:
            if not l0:  # sisipan murni: ikat ke satu bita sesudahnya agar penjaga potongan tetap memeriksa isi lama
                l0 = b[off:off + 1]
                l1 = l1 + l0
            pot.append((off, l0, l1))
        # sisipan yang menempel pada potongan lain: gabungkan bila berimpit
        gab = []
        for off, l0, l1 in pot:
            if gab and gab[-1][0] + len(gab[-1][1]) > off:
                po, p0, p1 = gab[-1]
                sela = off - po
                if p0[sela:sela + len(l0)] != l0[:len(p0) - sela]:
                    raise SystemExit('gabung potongan gagal')
                raise SystemExit('potongan berimpit %s %d' % (rel, off))
            gab.append((off, l0, l1))
        # bukti potongan -> hasil sama
        h2 = b
        for off, l0, l1 in sorted(gab, key=lambda x: -x[0]):
            assert h2[off:off + len(l0)] == l0
            h2 = h2[:off] + l1 + h2[off + len(l0):]
        if h2 != h:
            raise SystemExit('potongan paket tidak menghasilkan berkas yang sama: %s' % rel)
        daftar.append((kode, p_rel, md5b(b), md5b(h), len(gab)))
        for off, l0, l1 in gab:
            tambal.append((kode, off, b64(l0), b64(l1)))
        merah_laporan.append((rel, len(rr), len(dikerja), len(bc), len(mp.baris_csv(ph['toks']))))
    # --- tulis paket
    os.makedirs(keluar, exist_ok=True)
    os.makedirs(hasil, exist_ok=True)
    with open(os.path.join(keluar, 'daftar-tambal.tsv'), 'w', encoding='utf-8', newline='\n') as f:
        f.write('# kode\tberkas\tmd5_lama (sesudah keputusan-a-rekonvensi-4nov)\tmd5_baru\tpotongan\n')
        for d in daftar:
            f.write('%s\t%s\t%s\t%s\t%d\n' % d)
    with open(os.path.join(keluar, 'tambal.tsv'), 'w', encoding='ascii', newline='\n') as f:
        f.write('# kode\toffset\tb64(teks lama)\tb64(teks baru)\n')
        for x in tambal:
            f.write('%s\t%d\t%s\t%s\n' % x)
    tulis_sql(keluar)
    with open(os.path.join(hasil, 'daftar-tambalan.csv'), 'w', encoding='utf-8-sig', newline='') as f:
        w = csv.writer(f)
        w.writerow(['no daftar', 'berkas', 'potongan', 'golongan', 'ubahan/cara', 'catatan'])
        for c in sorted(catat, key=lambda x: (int(x[0] or 99999), x[1])):
            w.writerow(c)
    with open(os.path.join(hasil, 'merah-per-berkas.tsv'), 'w', encoding='utf-8', newline='\n') as f:
        f.write('berkas\tbaris daftar\tdikerjakan\tmerah sebelum (>=2 huruf)\tmerah sesudah (>=2 huruf)\n')
        for x in merah_laporan:
            f.write('%s\t%d\t%d\t%d\t%d\n' % x)
    with open(os.path.join(hasil, 'ringkas.txt'), 'w', encoding='utf-8', newline='\n') as f:
        for k in sorted(hit):
            f.write('%s\t%d\n' % (k, hit[k]))
        for k in sorted(berkas_gol):
            f.write('berkas %s\t%d\n' % (k, len(berkas_gol[k])))
        f.write('berkas paket\t%d\npotongan\t%d\n' % (len(daftar), len(tambal)))
    print(open(os.path.join(hasil, 'ringkas.txt'), encoding='utf-8').read())


SIDIK_SQL = "MD5(CONCAT_WS('|', v.nama, v.data_type, IFNULL(v.sql_query, ''), IFNULL(v.referensi, ''), IFNULL(v.multi_sidang, ''), IFNULL(v.default_data, ''), v.locked, IFNULL(v.modifier, '')))"


def sidik_py(x):
    return md5b('|'.join([x['nama'], 'data_teks', '', '', '', x['bawaan'] or '', '0', 'admin']).encode('latin1'))


def tulis_sql(keluar):
    kepala = '-- Paket ABT "%s" (5 Nov 2026): teks merah A5 dan [98] Cabut (keputusan Derry). Hanya blangko derry_briantono dan isian blangkonya.\n' % N
    nb = [x['no'] for x in VARIABEL]
    daftar_no = ','.join(str(n) for n in nb)
    with open(os.path.join(keluar, 'nomor-variabel.txt'), 'w', newline='\n') as f:
        f.write('# variabel BARU (kosong di salinan server 3 Nov; diperiksa PRASYARAT)\n' + ''.join('%d\n' % n for n in nb))
    nl = ' UNION ALL '.join("SELECT %d AS n, '%s' AS h" % (x['no'], sidik_py(x)) for x in VARIABEL)
    pras = kepala + ('-- PRASYARAT "A|B|C": A = nomor paket berisi lain dari paket (0) | B = variabel paket persis (0 pasang pertama / %d pasang ulang) | C = variabel lama yang dirujuk ada: %s (%d)\n'
                     % (len(nb), ', '.join(str(n) for n in DIPAKAI_ADA), len(DIPAKAI_ADA)))
    pras += ("SELECT CONCAT_WS('|',\n (SELECT COUNT(*) FROM abt_variabel v WHERE v.no_var IN (%s) AND NOT EXISTS (SELECT 1 FROM (%s) p WHERE p.n = v.no_var AND p.h = %s)),\n"
             " (SELECT COUNT(*) FROM abt_variabel v JOIN (%s) p ON p.n = v.no_var AND p.h = %s),\n"
             " (SELECT COUNT(*) FROM abt_variabel WHERE no_var IN (%s))) AS p;\n" % (daftar_no, nl, SIDIK_SQL, nl, SIDIK_SQL, ','.join(str(n) for n in DIPAKAI_ADA)))
    open(os.path.join(keluar, '%s-PRASYARAT.sql' % N), 'w', encoding='latin1', newline='\n').write(pras)
    open(os.path.join(keluar, 'harap.txt'), 'w', newline='\n').write('0|0|%d\n0|%d|%d\n' % (len(DIPAKAI_ADA), len(nb), len(DIPAKAI_ADA)))
    ps = [kepala, 'START TRANSACTION;\n']
    for x in VARIABEL:
        baw = 'CONVERT(%s USING latin1)' % hexs(x['bawaan']) if x['bawaan'] else 'NULL'
        ps.append("INSERT INTO abt_variabel (no_var, nama, data_type, data_tabel, data_kolom, urutan_data, referensi, sql_query, default_data, multi_sidang, locked, modifier, modified) "
                  "SELECT %d, CONVERT(%s USING latin1), 'data_teks', NULL, NULL, NULL, NULL, NULL, %s, NULL, 0, 'admin', '%s' FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM abt_variabel WHERE no_var = %d);\n"
                  % (x['no'], hexs(x['nama']), baw, TANGGAL, x['no']))
    ps.append('COMMIT;\n')
    open(os.path.join(keluar, '%s-PASANG.sql' % N), 'w', encoding='latin1', newline='\n').write(''.join(ps))
    bag = ["SELECT 'var %d' AS label, (SELECT COUNT(*) FROM abt_variabel v WHERE v.no_var = %d AND %s = '%s') AS ok" % (x['no'], x['no'], SIDIK_SQL, sidik_py(x)) for x in VARIABEL]
    q = kepala + 'SELECT IF((SELECT COUNT(*) FROM (\n' + '\nUNION ALL '.join(bag) + "\n) y WHERE y.ok <> 1) = 0, 'SEMUA COCOK', 'ADA BEDA') AS periksa;\n"
    open(os.path.join(keluar, '%s-PERIKSA.sql' % N), 'w', encoding='latin1', newline='\n').write(q)
    r = [kepala, 'START TRANSACTION;\n']
    r += ["DELETE v FROM abt_variabel v WHERE v.no_var = %d AND %s = '%s';\n" % (x['no'], SIDIK_SQL, sidik_py(x)) for x in VARIABEL]
    r.append('COMMIT;\n')
    open(os.path.join(keluar, '%s-PULIH.sql' % N), 'w', encoding='latin1', newline='\n').write(''.join(r))


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    main()
