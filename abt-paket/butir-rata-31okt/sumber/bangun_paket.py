# -*- coding: utf-8 -*-
"""Bangun paket ABT butir-rata-31okt (31 Okt 2026) - jawaban pengguna atas pertanyaan jawab-replik (1).

pakai: python bangun_paket.py <basis ABT sesudah 22 paket (fungsi isian_rtf_butir apa adanya)>

Keputusan pengguna 31 Okt: paragraf TANPA nomor sesudah butir bernomor ("Berdasarkan alasan-alasan ... mohon:", "Atau apabila ...")
dicetak RATA KIRI dengan inden baris pertama seperti posita gugatan - tidak lagi menjorok sejajar isi butir. Butir bernomor dan
butir "-" tetap.

Satu-satunya ubahan: cabang "ELSEIF man <> ''" fungsi isian_rtf_butir (penomoran tangan aktif, paragraf tanpa penanda), bila
penomoran tangannya di tingkat dasar (man_dasar = 0, bukan di dalam daftar HTML <ol>/<ul>) DAN berawal penanda bernomor/berhuruf
(bukan "-") DAN paragraf itu kalimat baru (huruf kapital, paragraf sebelumnya berakhir tanda baca penutup . ; : ! ? ) - potongan
kalimat yang terpecah baris di posita SIPP tetap lanjutan butir): paragraf dicetak \\li0\\fi720 (dulu \\li<tingkat>\\fi0). Keadaan penomoran (man) diperlakukan persis seperti dulu, jadi
nomor butir sesudahnya tidak berubah. Tanpa variabel, tanpa blangko RTF.
"""
import hashlib
import os
import shutil
import subprocess
import sys

SINI = os.path.dirname(os.path.abspath(__file__))
MYSQL = r'D:\Satker Asal\Website PA Bungku\xampp\mysql\bin\mysql.exe'
N = 'abt-butir-rata-31okt'

LAMA = """          ELSEIF man <> '' THEN
            SET tkk = man_dasar + 1;
            SET hasil = CONCAT(hasil, isian_rtf_par(tkk, '', isi, gantung, 1));
            SET man = SUBSTRING_INDEX(man, ',', 1);"""
BARU = """          ELSEIF man <> '' AND man_dasar = 0 AND NOT (BINARY LEFT(man, 1) = '-') AND ASCII(inti) BETWEEN 65 AND 90
                 AND CHAR_LENGTH(hasil) > 5 AND BINARY RIGHT(TRIM(TRAILING ' ' FROM LEFT(hasil, CHAR_LENGTH(hasil) - 5)), 1) IN ('.', ';', ':', '!', '?', ')') THEN
            SET hasil = CONCAT(hasil, bs, 'pard', bs, 'qj', bs, 'sl360', bs, 'slmult1', bs, 'widctlpar', bs, 'li0', bs, 'fi720 ', isi, bs, 'par ');
            SET man = SUBSTRING_INDEX(man, ',', 1);
          ELSEIF man <> '' THEN
            SET tkk = man_dasar + 1;
            SET hasil = CONCAT(hasil, isian_rtf_par(tkk, '', isi, gantung, 1));
            SET man = SUBSTRING_INDEX(man, ',', 1);"""


def md5b(b):
    return hashlib.md5(b).hexdigest()


def jalan(db, q):
    r = subprocess.run([MYSQL, '-h127.0.0.1', '-uroot', '-N', '-r', '--default-character-set=latin1', db, '-e', q], capture_output=True, check=True)
    return r.stdout.decode('latin1')


def fungsi_sql(daftar, judul):
    isi = ['-- %s' % judul, 'DELIMITER $$']
    for nama, kepala, badan in daftar:
        isi += ['DROP FUNCTION IF EXISTS %s$$' % nama, 'CREATE %s' % kepala, '%s$$' % badan]
    isi.append('DELIMITER ;')
    return '\n'.join(isi) + '\n'


# Fungsi yang diganti: (nama, [(teks lama, teks baru)], (komentar lama, komentar baru))
JUDUL_LAMA = "'LEBIH SUBSIDAIR', 'DALAM KONVENSI', 'DALAM REKONVENSI',"
JUDUL_BARU = "'LEBIH SUBSIDAIR', 'DALAM KONVENSI', 'DALAM REKONVENSI', 'DALAM KONVENSI DAN REKONVENSI', 'KONVENSI DAN REKONVENSI',"
FUNGSI = [
    ('isian_rtf_butir', [(LAMA, BARU)],
     ("COMMENT 'I3 16 Okt 2026: posita/petitum/teks isian -> paragraf RTF bernomor berinden gantung'",
      "COMMENT 'I3 16 Okt 2026 + 31 Okt: posita/petitum/teks isian -> paragraf RTF bernomor berinden gantung; paragraf tanpa nomor sesudah butir bernomor rata kiri berinden baris pertama'")),
    # "Dalam Konvensi dan Rekonvensi" (petitum / naskah jawab-menjawab) dikenali sebagai sub-judul seperti "Dalam Rekonvensi" - tanpa ini
    # baris itu ikut tercetak berinden baris pertama sebagai paragraf biasa.
    ('isian_rtf_judul', [(JUDUL_LAMA, JUDUL_BARU)],
     ("COMMENT 'I3: paragraf judul (PRIMER, SUBSIDER, DALAM REKONVENSI, huruf besar pendek)?'",
      "COMMENT 'I3 + 31 Okt: paragraf judul (PRIMER, SUBSIDER, DALAM REKONVENSI, DALAM KONVENSI DAN REKONVENSI, huruf besar pendek)?'")),
]


def badan_db(db, nama):
    t = jalan(db, "SELECT routine_definition FROM information_schema.routines WHERE routine_schema = DATABASE() AND routine_name = '%s'" % nama)
    # klien mysql Windows menulis ganti baris sebagai CRLF; badan di basis data ber-LF (diperiksa md5)
    t = t.replace('\r\n', '\n')
    t = t[:-1] if t.endswith('\n') else t
    m_db = jalan(db, "SELECT MD5(routine_definition) FROM information_schema.routines WHERE routine_schema = DATABASE() AND routine_name = '%s'" % nama).strip()
    assert md5b(t.encode('latin1')) == m_db, nama
    return t


def main():
    db = sys.argv[1]
    lama, baru, sidik = [], [], []
    for nama, ganti, (k_lama, k_baru) in FUNGSI:
        badan = badan_db(db, nama)
        b2 = badan
        for x, y in ganti:
            assert b2.count(x) == 1, (nama, x[:40])
            b2 = b2.replace(x, y)
        buat = jalan(db, "SHOW CREATE FUNCTION %s" % nama).split('\t')[2].replace('\\n', '\n')
        kepala = buat[buat.index('FUNCTION `%s`' % nama):buat.index('\nBEGIN')]
        assert kepala.count(k_lama) == 1, nama
        lama.append((nama, kepala, badan))
        baru.append((nama, kepala.replace(k_lama, k_baru), b2))
        sidik.append((nama, md5b(badan.encode('latin1')), md5b(b2.encode('latin1'))))
    keluar = os.path.join(SINI, '..', 'paket-satker')
    if os.path.isdir(keluar):
        shutil.rmtree(keluar)
    os.makedirs(keluar)
    open(os.path.join(keluar, '%s-FUNGSI.sql' % N), 'w', encoding='latin1', newline='\n').write(fungsi_sql(baru, 'isian_rtf_butir + isian_rtf_judul BARU (31 Okt)'))
    open(os.path.join(keluar, '%s-FUNGSI-LAMA.sql' % N), 'w', encoding='latin1', newline='\n').write(fungsi_sql(lama, 'isian_rtf_butir + isian_rtf_judul LAMA (keadaan sesudah 22 paket) - pulih'))
    cek = lambda i: ' OR '.join("(routine_name = '%s' AND MD5(routine_definition) = '%s')" % (n, x[i]) for n, *x in sidik)
    pras = ("-- Paket ABT \"%s\": PRASYARAT \"A|B\": A = fungsi isian_rtf_butir dan isian_rtf_judul yang persis LAMA (2 pasang pertama) | B = persis BARU (2 pasang ulang).\n"
            "SELECT CONCAT((SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema = DATABASE() AND (%s)), '|',"
            " (SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema = DATABASE() AND (%s))) AS p;\n" % (N, cek(0), cek(1)))
    open(os.path.join(keluar, '%s-PRASYARAT.sql' % N), 'w', encoding='latin1', newline='\n').write(pras)
    open(os.path.join(keluar, 'harap.txt'), 'w', newline='\n').write('2|0\n0|2\n')
    for f in ('pasang-satker.sh', 'pulih-satker.sh'):
        shutil.copy(os.path.join(SINI, f), os.path.join(keluar, f))
    print('sidik', sidik)
    return keluar


def md5sums(keluar):
    semua = []
    for d_, _, fs in os.walk(keluar):
        for f in fs:
            if f != 'MD5SUMS.txt':
                p_ = os.path.join(d_, f)
                semua.append((os.path.relpath(p_, keluar).replace(os.sep, '/'), md5b(open(p_, 'rb').read())))
    with open(os.path.join(keluar, 'MD5SUMS.txt'), 'w', newline='\n') as o:
        for rel, m in sorted(semua):
            o.write('%s  %s\n' % (m, rel))


if __name__ == '__main__':
    k = main()
    if len(sys.argv) > 2 and os.path.isfile(sys.argv[2]):
        shutil.copy(sys.argv[2], os.path.join(k, 'uji.tsv'))
    md5sums(k)
