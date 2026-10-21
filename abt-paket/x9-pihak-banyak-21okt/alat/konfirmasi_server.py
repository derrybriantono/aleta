# -*- coding: utf-8 -*-
"""Konfirmasi BACA SAJA di server (SELECT lewat /root/lihat-jejak.sh): fungsi paket x9 tidak bisa dibuat di server (tulis), jadi:
 (1) baris data yang dibaca fungsi (pihak1/pihak2/pihak4 + pihak + agama + pendidikan) diambil dari SERVER dengan kueri yang sama dengan kursor fungsi,
 (2) diformat ulang oleh terjemahan Python atas fungsi (isian_rtf_pihak_utama/nama/urutan/tambahan),
 (3) dibandingkan dengan keluaran fungsi SUNGGUHAN di basis lab laptop (aps_badilag_x9) untuk perkara_id yang sama, dan
 (4) keluaran Turut Tergugat dibandingkan dengan kueri 8710 LAMA yang dijalankan di server.
pakai: python konfirmasi_server.py [nomor_perkara,...]  (bawaan: paket-satker/perkara-uji.txt)"""
import os, re, subprocess, sys
sys.path.insert(0, r'D:\Aplikasi\aleta\tmp\x1')
from srv_sql import srv

AL = os.path.dirname(os.path.abspath(__file__))
PK = os.path.join(AL, '..', 'paket-satker')
MYSQL = r'D:\Satker Asal\Website PA Bungku\xampp\mysql\bin\mysql.exe'
BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']


def romawi(n):
    if n is None or n < 1 or n > 3999:
        return ''
    r = ''
    for v, s in ((1000, 'M'), (900, 'CM'), (500, 'D'), (400, 'CD'), (100, 'C'), (90, 'XC'), (50, 'L'), (40, 'XL'), (10, 'X'), (9, 'IX'), (5, 'V'), (4, 'IV'), (1, 'I')):
        while n >= v:
            r += s
            n -= v
    return r


def tgl(d):
    if not d or d == 'NULL' or d < '1900-01-01':
        return ''
    y, m, dd = d.split('-')
    return '%02d %s %s' % (int(dd), BULAN[int(m) - 1], int(y))


def hx(v):
    return None if v in ('NULL', None) else bytes.fromhex(v).decode('latin1')


def s0(v):
    return '' if v is None else v


def baris_utama(sisi, pid):
    t = 'perkara_pihak%d' % sisi
    o, e = srv("SELECT a.urutan, HEX(a.nama), HEX(b.nomor_indentitas), HEX(b.tempat_lahir), b.tanggal_lahir, HEX(g.nama), HEX(b.pekerjaan), HEX(d.kode), HEX(a.alamat) "
               "FROM %s a LEFT JOIN pihak b ON b.id = a.pihak_id LEFT JOIN agama g ON g.id = b.agama_id LEFT JOIN tingkat_pendidikan d ON d.id = b.pendidikan_id "
               "WHERE a.perkara_id = %s ORDER BY a.urutan" % (t, pid))
    out = []
    for l in o.splitlines()[1:]:
        k = l.split('\t')
        out.append((int(k[0]), hx(k[1]), hx(k[2]), hx(k[3]), None if k[4] == 'NULL' else k[4], hx(k[5]), hx(k[6]), hx(k[7]), hx(k[8])))
    return out


def f_utama(rows, dari, sebutan, kediaman):
    out = []
    for (u, nama, nik, tempat, t, agama, pek, pend, alamat) in rows:
        if u < dari:
            continue
        out.append('<strong>%s</strong>, NIK %s, tempat dan tanggal lahir %s, %s, agama %s, pekerjaan %s, pendidikan %s, %s %s, sebagai <strong>%s %s</strong>;' % (
            s0(nama), s0(nik), s0(tempat), tgl(t), s0(agama), s0(pek), s0(pend), kediaman, s0(alamat), sebutan, romawi(u)))
    return '<br>'.join(out)


def f_nama(rows, dari, sebutan):
    return '<br>'.join('%s, sebagai <strong>%s %s</strong>;' % (s0(r[1]), sebutan, romawi(r[0])) for r in rows if r[0] >= dari)


def f_urutan(rows, sebutan):
    mx = max([r[0] for r in rows], default=0)
    mx = min(mx, 400)
    h = ''
    for i in range(1, mx + 1):
        h += ('' if i == 1 else (' dan ' if i == mx else ', ')) + sebutan + ' ' + romawi(i)
    return h


def f_turut(pid):
    o, e = srv("SELECT t.urutan, HEX(t.nama), HEX(t.alamat), HEX(ph.nomor_indentitas), HEX(ph.tempat_lahir), ph.tanggal_lahir, ph.agama_id, HEX(ph.pekerjaan) "
               "FROM perkara_pihak4 t LEFT JOIN pihak ph ON ph.id = t.pihak_id WHERE t.perkara_id = %s ORDER BY t.urutan" % pid)
    rows = [l.split('\t') for l in o.splitlines()[1:]]
    if not rows:
        return ''
    o2, e2 = srv("SELECT IF(alur_perkara_id = 16 OR jenis_perkara_id IN (346, 341), 'Termohon', 'Tergugat') FROM perkara WHERE perkara_id = %s" % pid)
    s2 = o2.split()[-1]
    n = len(rows)
    hasil = ''
    for rn, k in enumerate(rows, 1):
        nama, alamat, nik, tempat, t, ag, pek = hx(k[1]), hx(k[2]), hx(k[3]), hx(k[4]), (None if k[5] == 'NULL' else k[5]), (None if k[6] == 'NULL' else int(k[6])), hx(k[7])
        nikt = s0(nik).strip()
        hasil += '<br><strong>%s</strong>' % s0(nama).strip()
        hasil += '' if nikt == '' or re.fullmatch(r'[0 -]+', nikt) else ', NIK ' + nikt
        hasil += '' if s0(tempat).strip() == '' or t is None or t < '1900-01-01' else ', tempat dan tanggal lahir %s, %s' % (s0(tempat).strip(), tgl(t))
        hasil += (', agama ' + ['Islam', 'Protestan', 'Katolik', 'Budha', 'Hindu', 'Lainnya', 'Kong Hu Cu'][ag - 1]) if ag and 1 <= ag <= 7 else ''
        hasil += '' if s0(pek).strip() == '' else ', pekerjaan ' + s0(pek).strip()
        hasil += ', beralamat di %s, sebagai <strong>Turut %s%s</strong>;' % (s0(alamat).strip(), s2, (' ' + romawi(rn)) if n > 1 else '')
    return hasil


def lab(sql):
    r = subprocess.run([MYSQL, '-uroot', 'sipp_donggala', '-N', '-r', '--default-character-set=utf8'], input=sql.encode('utf-8'), capture_output=True)
    if r.returncode:
        raise SystemExit(r.stderr.decode()[:400])
    t = r.stdout.decode('utf-8')
    return t[:-2] if t.endswith('\r\n') else (t[:-1] if t.endswith('\n') else t)


def main():
    nomor = sys.argv[1].split(',') if len(sys.argv) > 1 else [x.strip() for x in open(os.path.join(PK, 'perkara-uji.txt')) if x.strip()]
    o, e = srv("SELECT perkara_id, nomor_perkara FROM perkara WHERE nomor_perkara IN (%s)" % ','.join("'%s'" % n for n in nomor))
    pid = {l.split('\t')[1]: l.split('\t')[0] for l in o.strip().splitlines()[1:]}
    cocok = beda = 0
    for n in nomor:
        if n not in pid:
            print('TIDAK ADA di server:', n)
            continue
        p = pid[n]
        if lab('SELECT COUNT(*) FROM perkara WHERE perkara_id = %s' % p).strip() == '0':
            print(n, '(id %s): perkara lebih baru dari salinan SIPP lokal - dilewati (tidak ada di lab)' % p)
            continue
        r1, r2 = baris_utama(1, p), baris_utama(2, p)
        cek = [
            ('utama1 dari5', f_utama(r1, 5, 'Pemohon', 'tempat kediaman di'), "SELECT aps_badilag_x9.isian_rtf_pihak_utama(%s, 1, 5, 'Pemohon', 'tempat kediaman di')" % p),
            ('utama2 dari6', f_utama(r2, 6, 'Tergugat', 'tempat kediaman di '), "SELECT aps_badilag_x9.isian_rtf_pihak_utama(%s, 2, 6, 'Tergugat', 'tempat kediaman di ')" % p),
            ('utama1 dari1', f_utama(r1, 1, 'Pemohon', 'tempat kediaman di'), "SELECT aps_badilag_x9.isian_rtf_pihak_utama(%s, 1, 1, 'Pemohon', 'tempat kediaman di')" % p),
            ('nama1 dari6', f_nama(r1, 6, 'Pemohon'), "SELECT aps_badilag_x9.isian_rtf_pihak_nama(%s, 1, 6, 'Pemohon')" % p),
            ('nama2 dari1', f_nama(r2, 1, 'Tergugat'), "SELECT aps_badilag_x9.isian_rtf_pihak_nama(%s, 2, 1, 'Tergugat')" % p),
            ('urutan1', f_urutan(r1, 'Pemohon'), "SELECT aps_badilag_x9.isian_rtf_pihak_urutan(%s, 1, 'Pemohon')" % p),
            ('urutan2', f_urutan(r2, 'Tergugat'), "SELECT aps_badilag_x9.isian_rtf_pihak_urutan(%s, 2, 'Tergugat')" % p),
            ('turut (fungsi vs terjemahan)', f_turut(p), "SELECT aps_badilag_x9.isian_rtf_pihak_tambahan(%s, 4)" % p),
        ]
        # kueri 8710 LAMA di server (baca saja) = bukti kesetaraan dengan fungsi untuk pihak <= 10
        lama = open(os.path.join(AL, '..', 'hasil', 'kueri-8710-lama.sql'), encoding='latin1').read().replace('#perkara_id#', p) if os.path.exists(os.path.join(AL, '..', 'hasil', 'kueri-8710-lama.sql')) else None
        baris = []
        for nama, py, sql in cek:
            fn = lab(sql)
            ok = py == fn
            cocok += ok
            beda += (not ok)
            baris.append('%s=%s(%d)' % (nama.split()[0], 'OK' if ok else 'BEDA', len(py)))
        if lama:
            o8, e8 = srv(lama)
            v8 = o8.split('\n', 1)[1].rstrip('\n') if '\n' in o8 else ''
            v8 = v8.replace('\\n', '\n')
            py_t = f_turut(p)
            n_turut = len(re.findall(r'sebagai <strong>Turut', py_t))
            ok = (v8 == py_t) if n_turut <= 10 else (py_t.startswith(v8) or v8 == py_t[:len(v8)])
            baris.append('8710lama-vs-terjemahan=%s(%d pihak, lama %d huruf)' % ('OK' if ok else 'BEDA', n_turut, len(v8)))
            cocok += ok
            beda += (not ok)
        print(n, '(id %s):' % p, ' '.join(baris))
    print('RINGKAS: cocok %d, beda %d' % (cocok, beda))


if __name__ == '__main__':
    main()
