# -*- coding: utf-8 -*-
"""Uji kesamaan isian_rtf_terbilang (SQL) dengan TemplateHelper::Terbilang ABT (PHP 5.6 asli, disalin dari renderer ABT).
Angka: 0..200.000 semua, 200.000..2.000.000 tiap 7, 30.000 acak s.d. 999.999.999, plus batas. Hasil PHP dirapikan seperti
cleanHtmlTagSpecial (spasi ganda -> satu, trim). pakai: python uji_terbilang.py <basis berfungsi> (mis. pp29_uji)"""
import os, random, subprocess, sys
MYSQL = r'D:\Satker Asal\Website PA Bungku\xampp\mysql\bin\mysql.exe'
PHP = r'D:\sipp-server\php56\php.exe'
TMP = r'D:\Aplikasi\aleta\tmp\pp29'
DB = sys.argv[1] if len(sys.argv) > 1 else 'pp29_uji'
os.makedirs(TMP, exist_ok=True)
random.seed(29)
angka = list(range(0, 200001)) + list(range(200001, 2000001, 7)) + [random.randint(1, 999999999) for _ in range(30000)]
angka += [999999999, 1000000000, 1000000, 1001000, 1000001, 2000000, 100000000, 101101101, 111111111, 12000012]
angka = sorted(set(angka))
open(os.path.join(TMP, 'angka.txt'), 'w').write('\n'.join(map(str, angka)))
php = r'''<?php
function Terbilang($x){
    if ($x==''){ $x=0;}
    if ($x==0){ return '';}
    $abil = array("", "satu", "dua", "tiga", "empat", "lima", "enam", "tujuh", "delapan", "sembilan", "sepuluh", "sebelas");
    if ($x < 12) return " " . $abil[$x];
    elseif ($x < 20) return Terbilang($x - 10) . " belas";
    elseif ($x < 100) return Terbilang($x / 10) . " puluh" . Terbilang($x % 10);
    elseif ($x < 200) return " seratus" . Terbilang($x - 100);
    elseif ($x < 1000) return Terbilang($x / 100) . " ratus" . Terbilang($x % 100);
    elseif ($x < 2000) return " seribu" . Terbilang($x - 1000);
    elseif ($x < 1000000) return Terbilang($x / 1000) . " ribu" . Terbilang($x % 1000);
    elseif ($x < 1000000000) return Terbilang($x / 1000000) . " juta" . Terbilang($x % 1000000);
}
$f = fopen($argv[1], 'r'); $o = fopen($argv[2], 'w');
while (($l = fgets($f)) !== false) { $n = trim($l); $t = Terbilang($n . '.00'); $t = trim(str_replace('  ', ' ', (string)$t)); fwrite($o, $n . "\t" . $t . "\n"); }
'''
open(os.path.join(TMP, 'terbilang.php'), 'w').write(php)
subprocess.run([PHP, os.path.join(TMP, 'terbilang.php'), os.path.join(TMP, 'angka.txt'), os.path.join(TMP, 'php.tsv')], check=True)
sql = ("DROP TABLE IF EXISTS %s.pp29_angka; CREATE TABLE %s.pp29_angka (n BIGINT PRIMARY KEY) ENGINE=MyISAM;\n" % (DB, DB))
sql += "LOAD DATA LOCAL INFILE '%s' INTO TABLE %s.pp29_angka (n);\n" % (os.path.join(TMP, 'angka.txt').replace('\\', '/'), DB)
sql += "SELECT n, %s.isian_rtf_terbilang(CONCAT(n, '.00')) FROM %s.pp29_angka ORDER BY n;\n" % (DB, DB)
r = subprocess.run([MYSQL, '-h127.0.0.1', '-uroot', '--local-infile=1', '-N', '--raw'], input=sql.encode(), capture_output=True)
if r.returncode:
    sys.exit(r.stderr.decode())
s = dict(l.rstrip('\r').split('\t', 1) for l in r.stdout.decode('latin1').split('\n') if l.strip())
p = dict(l.split('\t', 1) for l in open(os.path.join(TMP, 'php.tsv'), encoding='latin1').read().split('\n') if l)
beda = [n for n in p if p[n] != s.get(n)]
print('angka diuji %d, beda %d' % (len(p), len(beda)))
for n in beda[:10]:
    print(n, repr(p[n]), repr(s.get(n)))
subprocess.run([MYSQL, '-h127.0.0.1', '-uroot', '-e', 'DROP TABLE IF EXISTS %s.pp29_angka' % DB])
sys.exit(1 if beda else 0)
