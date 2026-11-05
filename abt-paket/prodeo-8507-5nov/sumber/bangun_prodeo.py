# -*- coding: utf-8 -*-
"""Bangun paket abt-prodeo-8507-5nov: rumus variabel 8507 (DUDUK PERKARA PRODEO) supaya nilai berakhir "\\par " yang aman ditempeli teks blangko.
pakai: python -B sumber/bangun_prodeo.py <basis ABT sumber rumus> <paket-satker>   (rumus lama dibaca apa adanya dari basis salinan server, baca saja)
Sebab: nilai prodeo berakhir <br>. cleanHtmlTagSpecial ABT mengubahnya menjadi "\\par " lalu trim() membuang spasinya; 154 blangko menulis #8507#Bahwa
sehingga hasilnya \\parBahwa (kata kendali tak dikenal, kata "Bahwa" hilang, paragraf tidak terpisah). Spasi akhir pada rumus ikut terbuang oleh trim(), jadi nilai
diakhiri kata kendali netral \\uc1: "\\par \\uc1Bahwa" (\\uc1 = nilai bawaan RTF, tanpa huruf tercetak; "\\uc1 Bahwa" dan "\\uc1}" juga benar).
Garis miring ditulis CONVERT(CHAR(92) USING utf8), tanpa escape di dalam string; kolom sql_query ditulis lewat heks."""
import hashlib
import os
import subprocess
import sys

N = 'abt-prodeo-8507-5nov'
BIN = os.environ.get('MYSQL_BIN', r'D:\satker asal\website pa bungku\xampp\mysql\bin')
MY = os.path.join(BIN, 'mysql.exe')
LAMA_UJUNG = 'cuma-cuma;<br>")'
BARU_UJUNG = 'cuma-cuma;<br>", CONVERT(CHAR(92) USING utf8), "uc1")'


def baca(db):
    r = subprocess.run([MY, '-h', '127.0.0.1', '-u', 'root', '--default-character-set=latin1', '-N', '-B', '-r', db, '-e',
                        'SELECT HEX(sql_query) FROM abt_variabel WHERE no_var=8507'], capture_output=True)
    return bytes.fromhex(r.stdout.decode('ascii').strip()).decode('latin1')


def main():
    db, keluar = sys.argv[1:3]
    lama = baca(db)
    if lama.count(LAMA_UJUNG) != 1:
        raise SystemExit('rumus lama tidak dikenal')
    baru = lama.replace(LAMA_UJUNG, BARU_UJUNG)
    if 'aleta' in baru.lower():
        raise SystemExit('kata terlarang')
    h0 = hashlib.md5(lama.encode('latin1')).hexdigest()
    h1 = hashlib.md5(baru.encode('latin1')).hexdigest()
    hx = lambda s: '0x' + s.encode('latin1').hex()  # noqa: E731
    kepala = '-- Paket ABT "%s" (5 Nov 2026): variabel 8507 DUDUK PERKARA PRODEO, nilai prodeo diakhiri kata kendali netral. Nilai non-prodeo tetap kosong.\n' % N
    os.makedirs(keluar, exist_ok=True)

    def tulis(n, isi):
        open(os.path.join(keluar, n), 'w', encoding='latin1', newline='\n').write(isi)

    tulis('%s-PRASYARAT.sql' % N, kepala + '-- PRASYARAT "A|B": A = rumus 8507 persis rumus lama (1) | B = rumus 8507 persis rumus paket (1). Pasang pertama 1|0, pasang ulang 0|1; selain itu rumus server berbeda: BERHENTI.\n'
          "SELECT CONCAT_WS('|', (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 8507 AND MD5(sql_query) = '%s'), (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 8507 AND MD5(sql_query) = '%s')) AS p;\n" % (h0, h1))
    tulis('%s-PASANG.sql' % N, kepala + 'START TRANSACTION;\n'
          "UPDATE abt_variabel SET sql_query = CONVERT(%s USING latin1), modified = modified WHERE no_var = 8507 AND MD5(sql_query) = '%s';\nCOMMIT;\n" % (hx(baru), h0))
    tulis('%s-PERIKSA.sql' % N, kepala + "SELECT IF((SELECT COUNT(*) FROM abt_variabel WHERE no_var = 8507 AND MD5(sql_query) = '%s') = 1, 'SEMUA COCOK', 'ADA BEDA') AS periksa;\n" % h1)
    tulis('%s-PULIH.sql' % N, kepala + 'START TRANSACTION;\n'
          "UPDATE abt_variabel SET sql_query = CONVERT(%s USING latin1), modified = modified WHERE no_var = 8507 AND MD5(sql_query) = '%s';\nCOMMIT;\n" % (hx(lama), h1))
    open(os.path.join(keluar, 'harap.txt'), 'w', newline='\n').write('1|0\n0|1\n')
    print('md5 lama', h0, 'baru', h1, 'panjang', len(lama), len(baru))


if __name__ == '__main__':
    main()
