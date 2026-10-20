# -*- coding: utf-8 -*-
"""Uji kecil jenis 350 (nafkah anak oleh ibu karena ayah tidak mampu). Jalankan dari mana saja:  python uji_350.py [--tanpa-server]
(a) membangun berkas (bangun_semua.py 350) dan memeriksa jumlahnya;
(b) semua penanda #nnnn# pada RTF dan teks variabel ada di server (w3b-var-server.pkl) atau milik jenis ini (3920-3939);
(c) SQL variabel jenis ini JALAN di server (baca saja, lewat ssh) dan memberi hasil yang benar: angka murni, selisih ibu-ayah, terbilang rupiah
    (dibandingkan dengan pembanding Python), kalimat pertimbangan/amar dengan bagian ayah terisi dan tidak, isian tidak sah -> titik-titik;
(d) tidak ada sisa kata jenis lama (penanda 9302/9304/9759/974x/975x, 'hak asuh', 'penguasaan anak', 'nafkah' di luar label dan kutipan KHI) dan tidak ada kata 'aleta'."""
import glob
import os
import pickle
import re
import subprocess
import sys

AKAR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SUMBER = os.path.join(AKAR, 'sumber')
sys.path.insert(0, SUMBER)
sys.path.insert(0, os.path.join(AKAR, 'alat'))
sys.stdout.reconfigure(encoding='utf-8')

import variabel_def as V  # noqa: E402
from pustaka import Berkas, KELUAR  # noqa: E402

GAGAL = []


def cek(nama, kondisi, ket=''):
    print(('OK    ' if kondisi else 'GAGAL ') + nama + ((' | ' + str(ket)[:300]) if ket and not kondisi else ''))
    if not kondisi:
        GAGAL.append(nama)


def terbilang(n):
    sat = ['', 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan']

    def tiga(g):
        h, d = divmod(g, 100)
        k = []
        if h == 1:
            k.append('seratus')
        elif h > 1:
            k.append(sat[h] + ' ratus')
        if d == 0:
            pass
        elif d < 10:
            k.append(sat[d])
        elif d == 10:
            k.append('sepuluh')
        elif d == 11:
            k.append('sebelas')
        elif d < 20:
            k.append(sat[d - 10] + ' belas')
        else:
            k.append(sat[d // 10] + ' puluh' + ((' ' + sat[d % 10]) if d % 10 else ''))
        return ' '.join(k)
    j, r, u = n // 1000000, (n % 1000000) // 1000, n % 1000
    out = []
    if j:
        out.append(tiga(j) + ' juta')
    if r == 1:
        out.append('seribu')
    elif r > 1:
        out.append(tiga(r) + ' ribu')
    if u:
        out.append(tiga(u))
    return ' '.join(out)


def sql_var(no):
    return [x for x in V.VAR if x['no'] == no][0]['sql']


def jalankan(sql):
    """Menjalankan SQL (baca saja) di server; penanda #nnnn# dibuang."""
    sql = re.sub(r'#(\d{4})#', '', sql)
    r = subprocess.run(['ssh', '-o', 'ConnectTimeout=25', 'aleta', 'bash /root/lihat-jejak.sh "$(cat)"'], input=sql.encode('utf-8'), capture_output=True, timeout=180)
    return (r.stdout.decode('utf-8', 'replace') + r.stderr.decode('utf-8', 'replace')).strip()


def isi_literal(sql, nilai):
    """Mengganti pembacaan isian abt_data_teks (isi(n)) dengan literal nilai[n] agar kueri dapat diuji tanpa menulis ke ABT."""
    for n, t in nilai.items():
        sql = sql.replace(V.isi(n), "'" + t.replace("'", "''") + "'")
    return sql


def hasil_data(teks):
    baris = teks.split('\n')
    return '\n'.join(baris[1:]).strip() if len(baris) > 1 else ''


def main():
    tanpa_server = '--tanpa-server' in sys.argv
    # (a) bangun
    r = subprocess.run([sys.executable, os.path.join(SUMBER, 'bangun_semua.py'), '350'], capture_output=True, cwd=SUMBER)
    print(r.stdout.decode('utf-8', 'replace').strip())
    putusan = sorted(glob.glob(os.path.join(KELUAR, '6h Nafkah Anak oleh Ibu', '*.rtf')))
    bas = sorted(glob.glob(os.path.join(KELUAR, '6h Nafkah Anak oleh Ibu - BAS', '*.rtf')))
    cek('(a) 13 putusan', len(putusan) == 13, len(putusan))
    cek('(a) 37 BAS', len(bas) == 37, len(bas))

    # (b) penanda
    pkl = pickle.load(open('D:/aleta-dev/kerja/w3b-var-server.pkl', 'rb'))
    punyaku = [x for x in V.VAR if 3920 <= x['no'] <= 3939]
    milik = set('%04d' % x['no'] for x in punyaku)
    semua_teks = {}
    for f in putusan + bas:
        semua_teks[f] = '\n'.join(Berkas(f).t)
    pakai = set()
    for t in semua_teks.values():
        pakai |= set(re.findall(r'#(\d{4})#', t))
    for x in punyaku:
        pakai |= set(re.findall(r'#(\d{4})#', (x['sql'] or '') + x['nama'] + (x['default'] or '')))
        pakai |= set('%04d' % int(n) for n in re.findall(r'no_var = (\d{4})', x['sql'] or ''))
    hilang = sorted(n for n in pakai if n not in pkl and n not in milik)
    cek('(b) semua penanda dikenal (server atau milik jenis ini)', not hilang, hilang)
    cek('(b) nomor variabel hanya di jatah 3920-3939 dan nama <= 200 huruf', not V.PANJANG, V.PANJANG)
    cek('(b) tidak ada nomor jatahku yang sudah terpakai di server', not [n for n in milik if n in pkl], [n for n in milik if n in pkl])
    cek('(b) tanpa kata aleta pada variabel', not any('aleta' in (x['nama'] + (x['sql'] or '') + (x['default'] or '')).lower() for x in punyaku))
    isian = {'%04d' % x['no'] for x in punyaku if x['tipe'] == 'data_teks'}
    cek('(b) setiap isian jenis ini dipakai RTF atau kueri variabel lain', isian <= pakai, sorted(isian - pakai))

    # (d) sisa kata jenis lama
    sisa = []
    for f, t in semua_teks.items():
        for i, p in enumerate(t.split('\n')):
            if re.search(r'#(9302|9304|9759|974\d|975[0-8])#|hak asuh|penguasaan anak|aleta', p, re.I):
                sisa.append((os.path.basename(f)[:40], i, p[:80]))
            elif re.search(r'nafkah', p, re.I):
                q = p.replace('nafkah anak oleh ibu karena ayah tidak mampu', '').replace('hadhanah dan nafkah anak', '').replace('Nafkah Anak oleh Ibu', '')
                q = q.replace('pembebanan nafkah anak hendaknya', '')
                if re.search(r'nafkah', q, re.I):
                    sisa.append((os.path.basename(f)[:40], i, p[:80]))
    cek('(d) tanpa sisa kata jenis lama dan tanpa kata aleta', not sisa, sisa[:5])
    cek('(d) nama berkas BAS memakai ALUR 64 (selain salinan umum ALUR 04-09)', all(('ALUR 64' in os.path.basename(f)) or re.match(r'BAS ALUR 0[4-9] ', os.path.basename(f)) for f in bas))

    if tanpa_server:
        print('\nHASIL (tanpa server): %s' % ('LULUS' if not GAGAL else 'GAGAL: %s' % GAGAL))
        return 1 if GAGAL else 0
    # (c) SQL di server
    N = {3923: 'Rp3.000.000,00', 3924: '1.000.000', 3931: '10% (sepuluh persen)', 3932: 'makan, sekolah dan kesehatan'}
    for no, harap in ((3925, '3000000'), (3926, '1000000'), (3927, '2000000')):
        h = hasil_data(jalankan(isi_literal(sql_var(no), N)))
        cek('(c) %d angka murni' % no, h == harap, h)
    h = hasil_data(jalankan(isi_literal(sql_var(3927), {3923: '3.000.000', 3924: '', 3931: '', 3932: ''})))
    cek('(c) 3927 ayah kosong -> ibu = kebutuhan', h == '3000000', h)
    h = hasil_data(jalankan(isi_literal(sql_var(3927), {3923: '3.000.000', 3924: '3.000.000', 3931: '', 3932: ''})))
    cek('(c) 3927 ayah >= kebutuhan -> kosong', h == '', h)
    h = hasil_data(jalankan(isi_literal(sql_var(3925), {3923: 'sekitar tiga juta', 3924: '', 3931: '', 3932: ''})))
    cek('(c) 3925 isian bukan angka -> kosong', h == '', h)
    h = hasil_data(jalankan(isi_literal(sql_var(3926), {3923: '3000000', 3924: '1.500.000,00', 3931: '', 3932: ''})))
    cek('(c) 3926 ,00 dibuang', h == '1500000', h)
    # terbilang: kolom wa pada tabel dasar (L5)
    import variabel_350 as W
    uji = [1, 7, 10, 11, 12, 19, 20, 21, 45, 99, 100, 101, 111, 125, 200, 999, 1000, 1001, 1500, 2000, 2018, 12345, 100000, 750000, 1000000, 1250000, 2500000, 21000000, 100000000, 999999999]
    for k in range(0, len(uji), 6):
        potong = uji[k:k + 6]
        bagian = []
        for n in potong:
            dasar = isi_literal(W._L5, {3923: str(n), 3924: '', 3931: '', 3932: ''})
            bagian.append("SELECT CONCAT('%d|', IF(wa IS NULL, 'NULL', wa)) AS data FROM (%s) z" % (n, dasar))
        keluar = jalankan(' UNION ALL '.join(bagian))
        peta = dict(l.split('|', 1) for l in keluar.split('\n') if '|' in l)
        for n in potong:
            cek('(c) terbilang %d' % n, peta.get(str(n)) == terbilang(n), (peta.get(str(n)), terbilang(n), keluar[:200]))
    # kalimat
    N1 = {3923: 'Rp3.000.000,00', 3924: '1.000.000', 3931: '10% (sepuluh persen)', 3932: 'makan, sekolah dan kesehatan'}
    p = hasil_data(jalankan(isi_literal(sql_var(3934), N1)))
    for kata in ('Rp3.000.000,00 (tiga juta rupiah)', 'Rp2.000.000,00 (dua juta rupiah)', 'Rp1.000.000,00 (satu juta rupiah)', '10% (sepuluh persen)', 'makan, sekolah dan kesehatan', 'Pasal 156 huruf d', 'angka 14'):
        cek('(c) 3934 memuat "%s"' % kata, kata in p, p[:200])
    a = hasil_data(jalankan(isi_literal(sql_var(3935), N1)))
    for kata in ('Rp3.000.000,00 (tiga juta rupiah)', 'Rp2.000.000,00 (dua juta rupiah)', 'Rp1.000.000,00 (satu juta rupiah)', 'dengan kenaikan sebesar 10% (sepuluh persen) setiap tahun', 'dan menghukum'):
        cek('(c) 3935 memuat "%s"' % kata, kata in a, a[:200])
    N2 = {3923: '2500000', 3924: '', 3931: '10%', 3932: ''}
    p2 = hasil_data(jalankan(isi_literal(sql_var(3934), N2)))
    a2 = hasil_data(jalankan(isi_literal(sql_var(3935), N2)))
    cek('(c) 3934 tanpa bagian ayah: seluruh biaya dipikul ibu', 'Rp2.500.000,00 (dua juta lima ratus ribu rupiah)' in p2 and 'sisanya' not in p2 and 'bertambah' not in p2, p2[:300])
    cek('(c) 3935 tanpa bagian ayah: tidak dibebani, tanpa menghukum', 'tidak dibebani' in a2 and 'menghukum' not in a2, a2[:300])
    p3 = hasil_data(jalankan(isi_literal(sql_var(3934), {3923: '', 3924: '', 3931: '', 3932: ''})))
    cek('(c) 3934 angka kosong -> titik-titik', 'Rp........,00 (........ rupiah)' in p3, p3[:300])
    a3 = hasil_data(jalankan(isi_literal(sql_var(3935), {3923: '', 3924: '', 3931: '', 3932: ''})))
    cek('(c) 3935 angka kosong -> titik-titik', 'Rp........,00 (........ rupiah)' in a3, a3[:300])
    k = hasil_data(jalankan(isi_literal(sql_var(3939), {3920: 'A, D'})))
    cek('(c) 3939 huruf A, D', k == 'sakit atau cacat atau telah lanjut usia sehingga tidak dapat bekerja, sedang menjalani pidana penjara', k)
    k = hasil_data(jalankan(isi_literal(sql_var(3939), {3920: ''})))
    cek('(c) 3939 kosong -> titik-titik', k == '........', k)
    k = hasil_data(jalankan(isi_literal(sql_var(3929), {3928: 'nenek kandung'})))
    cek('(c) 3929 isian nenek kandung', k == 'nenek kandung', k)
    # kueri apa adanya atas perkara nyata (isian belum ada): tidak galat, memberi baris data
    for no in (3925, 3926, 3927, 3929, 3934, 3935, 3939):
        h = jalankan(sql_var(no).replace('#perkara_id#', '9321'))
        cek('(c) %d jalan atas perkara nyata 9321 (isian belum ada)' % no, h.startswith('data') and 'ERROR' not in h, h[:200])
    print('\nHASIL: %s' % ('SEMUA LULUS' if not GAGAL else 'GAGAL: %s' % GAGAL))
    return 1 if GAGAL else 0


if __name__ == '__main__':
    sys.exit(main())
