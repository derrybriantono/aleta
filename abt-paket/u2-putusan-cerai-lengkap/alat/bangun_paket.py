# -*- coding: utf-8 -*-
"""Bangun berkas paket-satker: PASANG.sql, PERIKSA.sql, PULIH.sql, skrip pasang/pulih, tambal-rtf.pl, MD5SUMS.txt.
Pakai: python bangun_paket.py   (membaca data/variabel.json; rtf-tambal.tsv dan rtf-daftar-tambal.tsv dari bangun_rtf.py)"""
import hashlib, json, os

AKAR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
P = os.path.join(AKAR, 'paket-satker')
os.makedirs(P, exist_ok=True)
V = json.load(open(os.path.join(AKAR, 'data', 'variabel.json'), encoding='utf-8'))
NOMOR = [v['no'] for v in V]
PRA = (8505, 8527, 4001, 8530, 8554, 8602, 5114)  # variabel lama yang dipakai tambalan dan teks; harus ada


def hx(s):
    return 'NULL' if s is None else '0x' + s.encode('latin1').hex()


def md5(s):
    return hashlib.md5(s.encode('latin1')).hexdigest()


def tulis(nama, isi, mode='w'):
    with open(os.path.join(P, nama), mode, encoding='utf-8', newline='\n') as f:
        f.write(isi)


def pasang_sql():
    baris = ['-- Paket U2: pertimbangan dan amar akibat perceraian, SEMA 1/2022, tenggang ikrar - variabel ABT baru 4100-4150.',
             '-- Dijalankan: mysql --default-character-set=latin1 aps_badilag < abt-u2-PASANG.sql',
             '-- Isi teks berupa literal heksadesimal (bita cp1252 apa adanya). JANGAN disunting di editor.', '',
             '-- PRASYARAT: berhenti dengan galat "Subquery returns more than 1 row" bila nomor baru sudah terpakai atau variabel lama yang dirujuk tidak ada.',
             '-- Tidak ada yang ditulis bila prasyarat gagal.',
             "SELECT IF((SELECT COUNT(*) FROM abt_variabel WHERE no_var BETWEEN 4100 AND 4299) = 0 AND (SELECT COUNT(*) FROM abt_variabel WHERE no_var IN (%s)) = %d,"
             " 'PRASYARAT COCOK - memasang', (SELECT 'PRASYARAT GAGAL' UNION SELECT 'BERHENTI')) AS prasyarat;" % (', '.join(map(str, PRA)), len(PRA)), '',
             'START TRANSACTION;']
    for v in V:
        baris.append('-- %d %s (%d bita)' % (v['no'], v['tipe'], len(v['sql'] or '')))
        baris.append("INSERT INTO abt_variabel (no_var, nama, data_type, data_tabel, data_kolom, urutan_data, referensi, sql_query, default_data, multi_sidang, locked, modifier) "
                     "VALUES (%d, %s, %s, NULL, NULL, NULL, NULL, %s, %s, NULL, 0, 'admin');" % (v['no'], hx(v['nama']), hx(v['tipe']), hx(v['sql']), hx(v['default'])))
    baris += ['COMMIT;', '', "SELECT 'SELESAI - jalankan abt-u2-PERIKSA.sql' AS keadaan;", '']
    tulis('abt-u2-PASANG.sql', '\n'.join(baris))


def periksa_sql():
    bag = []
    for v in V:
        bag.append("SELECT %d AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = %d) AS panjang, %s AS panjang_harap, "
                   "(SELECT COUNT(*) FROM abt_variabel WHERE no_var = %d AND %s AND MD5(nama) = '%s' AND data_type = '%s') AS cocok" % (
                       v['no'], v['no'], len(v['sql']) if v['sql'] else 'NULL', v['no'],
                       ("MD5(sql_query) = '%s'" % md5(v['sql'])) if v['sql'] else 'sql_query IS NULL', md5(v['nama']), v['tipe']))
    gabung = (chr(10) + 'UNION ALL' + chr(10)).join(bag)
    isi = ['-- Periksa hasil pemasangan paket U2: tabel rinci (tiap baris cocok = 1), lalu baris terakhir "SEMUA COCOK".',
           'SELECT t.no_var, t.panjang, t.panjang_harap, t.cocok FROM (', gabung, ') t ORDER BY t.no_var;', '',
           "SELECT IF(SUM(t.cocok) = COUNT(*) AND COUNT(*) = %d, 'SEMUA COCOK', 'ADA YANG TIDAK COCOK') AS hasil FROM (" % len(V), gabung, ') t;', '']
    tulis('abt-u2-PERIKSA.sql', chr(10).join(isi))


def pulih_sql():
    tulis('abt-u2-PULIH.sql',
          '-- PEMULIHAN paket U2: hapus variabel baru 4100-4150. Variabel lama tidak diubah oleh paket ini.\n'
          '-- CATATAN: menghapus variabel ikut menghapus isian petugasnya di abt_data_teks (FK ON DELETE CASCADE): isian 4100-4109.\n'
          'DELETE FROM abt_variabel WHERE no_var BETWEEN 4100 AND 4299;\n'
          'SELECT COUNT(*) AS sisa_baris_baru FROM abt_variabel WHERE no_var BETWEEN 4100 AND 4299;\n')


PASANG_SH = r'''#!/bin/bash
# =============================================================================
# PASANG paket ABT "u2-putusan-cerai-lengkap" di SATKER (dijalankan DI SERVER, sebagai root, dari folder paket ini).
# Urutan: periksa berkas -> prasyarat SQL -> PASANG variabel -> PERIKSA -> tambal blangko RTF (per jangkar, dengan cadangan) -> periksa.
# Bila PERIKSA SQL gagal: PULIH otomatis. Blangko yang jangkarnya tidak cocok DILEWATI (tidak ditimpa) dan dilaporkan.
# =============================================================================
set -u
cd "$(dirname "$0")" || exit 1
SINI=$(pwd)
B=/var/www/html/aps_badilag/_blangko_abt/derry_briantono
CAD="$SINI/cadangan"
gagal() { echo "GAGAL: $*"; exit 1; }
md5() { md5sum "$1" | cut -d' ' -f1; }
md5sum -c MD5SUMS.txt >/dev/null 2>&1 || gagal "berkas paket rusak (md5sum -c MD5SUMS.txt) - salin ulang dengan scp, bukan editor"
MYSQL_PWD="$(docker exec aleta-bot printenv ALETA_BOT_DB_SIPP_PASSWORD)" || gagal "sandi DB tidak terbaca dari aleta-bot"
export MYSQL_PWD
MY="mysql -h 127.0.0.1 -u root --default-character-set=latin1 aps_badilag"
[ -e "$CAD/pasang.selesai" ] && gagal "paket ini sudah pernah dipasang ($CAD) - jalankan pulih-satker.sh dulu bila ingin mengulang"
mkdir -p "$CAD" || gagal "tidak bisa membuat $CAD"

echo "== 0. praperiksa tambalan RTF (tidak menulis apa pun)"
perl tambal-rtf.pl periksa "$B" "$CAD" | tail -n 5

echo "== 1. PASANG variabel 4100-4150 (prasyarat di dalam SQL; gagal = tidak ada yang ditulis)"
$MY < abt-u2-PASANG.sql || gagal "abt-u2-PASANG.sql berhenti (lihat galat di atas) - transaksi tidak di-COMMIT"

echo "== 2. PERIKSA panjang + MD5 tiap variabel"
$MY < abt-u2-PERIKSA.sql | tee "$CAD/periksa-sesudah.txt"
if [ "$(tail -1 "$CAD/periksa-sesudah.txt")" != "SEMUA COCOK" ]; then
  echo "PERIKSA tidak cocok - memulihkan"
  $MY < abt-u2-PULIH.sql
  gagal "pemasangan variabel dibatalkan dan dipulihkan; blangko RTF belum disentuh"
fi

echo "== 3. tambal blangko RTF"
perl tambal-rtf.pl pasang "$B" "$CAD" | tee "$CAD/tambal-hasil.txt" | tail -n 8
echo "== 4. periksa ulang (semua yang ditambal harus SUDAH)"
perl tambal-rtf.pl periksa "$B" "$CAD" | tail -n 3
touch "$CAD/pasang.selesai"
echo "SELESAI - paket u2-putusan-cerai-lengkap terpasang. Cadangan untuk pulih: $CAD"
'''

PULIH_SH = r'''#!/bin/bash
# PULIH paket u2-putusan-cerai-lengkap di SATKER: kembalikan blangko RTF dari cadangan lalu hapus variabel 4100-4150.
set -u
cd "$(dirname "$0")" || exit 1
CAD="$(pwd)/cadangan"
B=/var/www/html/aps_badilag/_blangko_abt/derry_briantono
MYSQL_PWD="$(docker exec aleta-bot printenv ALETA_BOT_DB_SIPP_PASSWORD)"; export MYSQL_PWD
MY="mysql -h 127.0.0.1 -u root --default-character-set=latin1 aps_badilag"
perl tambal-rtf.pl pulih "$B" "$CAD" | tail -n 3
$MY < abt-u2-PULIH.sql || { echo "GAGAL menghapus variabel baru"; exit 1; }
rm -f "$CAD/pasang.selesai"
echo "SELESAI - dipulihkan"
'''

TAMBAL_PL = r'''#!/usr/bin/perl
# Tambal blangko RTF derry_briantono PER JANGKAR (paket u2-putusan-cerai-lengkap, 20 Okt 2026).
# Pakai: perl tambal-rtf.pl periksa|pasang|pulih <folder derry_briantono> <folder cadangan>
#   periksa : tiap berkas -> COCOK (semua jangkar ditemukan dengan jumlah tepat), SUDAH (penanda baru sudah ada), atau LEWAT (alasan)
#   pasang  : berkas COCOK dicadangkan ke <cadangan>/rtf-lama/<kode>.rtf lalu ditambal; berkas LEWAT tidak disentuh.
#   pulih   : kembalikan berkas dari <cadangan>/rtf-lama menurut rtf-ditambal.txt (hanya bila md5 masih = hasil tambalan).
# Tambalan dibaca dari rtf-tambal.tsv: b64(relpath) urutan jumlah b64(lama) b64(baru); daftar dari rtf-daftar-tambal.tsv.
use strict; use warnings;
use MIME::Base64; use File::Basename; use File::Copy;
# Digest::MD5 tidak terpasang di perl server satker (CentOS 7 minimal) - md5 lewat perintah md5sum.
sub md5_hex { my ($d) = @_; my $f = "/tmp/tambal-rtf-md5-$$"; open(my $o, '>:raw', $f) or die "md5: $!"; print $o $d; close $o;
  my $r = `md5sum '$f'`; unlink $f; my ($h) = split /\s+/, $r; return $h; }
my ($mode, $B, $C) = @ARGV;
die "pakai: perl tambal-rtf.pl periksa|pasang|pulih <derry_briantono> <cadangan>\n" unless $mode && $B && $C;
my $sini = dirname(__FILE__);
my (%daftar, @urut, %tambal);
open(my $fd, '<', "$sini/rtf-daftar-tambal.tsv") or die "rtf-daftar-tambal.tsv: $!";
while (<$fd>) { chomp; next unless length; my ($kode, $rel, $m0, $m1, $n) = split /\t/; $daftar{$rel} = [$kode, $m0, $m1, $n]; push @urut, $rel; }
close $fd;
open(my $ft, '<', "$sini/rtf-tambal.tsv") or die "rtf-tambal.tsv: $!";
while (<$ft>) { chomp; next unless length; my ($r, $i, $j, $l, $b) = split /\t/; push @{$tambal{decode_base64($r)}}, [$i, $j, decode_base64($l), decode_base64($b)]; }
close $ft;
sub baca { my $p = shift; open(my $h, '<:raw', $p) or return undef; local $/; my $d = <$h>; close $h; return $d; }
sub tulis { my ($p, $d) = @_; open(my $h, '>:raw', $p) or die "tulis $p: $!"; print $h $d; close $h; }
sub hitung { my ($d, $s) = @_; my $n = 0; my $pos = 0; while (($pos = index($d, $s, $pos)) >= 0) { $n++; $pos += length($s); } return $n; }
# SUDAH: setiap tambalan sudah ada (teks baru ditemukan) - mencegah penyisipan ganda bila skrip diulang.
sub sudah { my ($d, $rel) = @_; for my $t (@{$tambal{$rel}}) { return 0 if index($d, $t->[3]) < 0; } return 1; }
sub terapkan {
  my ($d, $rel) = @_;
  for my $t (@{$tambal{$rel}}) {
    my ($i, $j, $l, $b) = @$t;
    my $n = hitung($d, $l);
    return (undef, "jangkar $i ditemukan $n kali, diharapkan $j") if $n != $j;
    my $pos = 0; my $out = '';
    while ((my $k = index($d, $l, $pos)) >= 0) { $out .= substr($d, $pos, $k - $pos) . $b; $pos = $k + length($l); }
    $d = $out . substr($d, $pos);
  }
  return ($d, '');
}
my ($cocok, $sudah, $lewat, $beda) = (0, 0, 0, 0);
if ($mode eq 'periksa' || $mode eq 'pasang') {
  if ($mode eq 'pasang') { mkdir $C; mkdir "$C/rtf-lama"; die "cadangan lama ada di $C/rtf-ditambal.txt - jangan timpa\n" if -s "$C/rtf-ditambal.txt"; }
  my $log;
  if ($mode eq 'pasang') { open($log, '>', "$C/rtf-ditambal.txt") or die $!; }
  for my $rel (@urut) {
    my ($kode, $m0, $m1, $n) = @{$daftar{$rel}};
    my $p = "$B/$rel";
    my $d = baca($p);
    if (!defined $d) { print "LEWAT\t$kode\ttidak ada\t$rel\n"; $lewat++; next; }
    my $m = md5_hex($d);
    if ($m eq $m1 || sudah($d, $rel)) { print "SUDAH\t$kode\t$rel\n"; $sudah++; next; }
    my ($h, $alasan) = terapkan($d, $rel);
    if (!defined $h) { print "LEWAT\t$kode\t$alasan\t$rel\n"; $lewat++; next; }
    my $mh = md5_hex($h);
    my $ket = ($m eq $m0 && $mh eq $m1) ? 'md5 = laptop' : "md5 beda laptop (jangkar cocok) $mh";
    $beda++ if $mh ne $m1;
    if ($mode eq 'pasang') {
      copy($p, "$C/rtf-lama/$kode.rtf") or die "cadang $rel: $!";
      tulis($p, $h);
      print $log "$kode\t$mh\t$rel\n";
    }
    print(($mode eq 'pasang' ? 'DITAMBAL' : 'COCOK') . "\t$kode\t$ket\t$rel\n"); $cocok++;
  }
  close $log if $log;
  print "RINGKAS " . ($mode eq 'pasang' ? 'DITAMBAL' : 'COCOK') . "=$cocok SUDAH=$sudah LEWAT=$lewat BEDA_MD5=$beda\n";
} elsif ($mode eq 'pulih') {
  open(my $l, '<', "$C/rtf-ditambal.txt") or die "tidak ada $C/rtf-ditambal.txt\n";
  my ($ok, $skip) = (0, 0);
  while (<$l>) { chomp; my ($kode, $mh, $rel) = split /\t/; my $p = "$B/$rel"; my $d = baca($p);
    if (defined $d && md5_hex($d) eq $mh) { copy("$C/rtf-lama/$kode.rtf", $p) or die $!; print "DIPULIHKAN\t$rel\n"; $ok++; }
    else { print "DILEWATI (berubah sesudah ditambal)\t$rel\n"; $skip++; } }
  close $l; rename "$C/rtf-ditambal.txt", "$C/rtf-ditambal.dipulihkan." . time();
  print "RINGKAS PULIH=$ok DILEWATI=$skip\n";
} else { die "mode tidak dikenal\n"; }
'''


def md5sums():
    baris = []
    for f in sorted(os.listdir(P)):
        if f in ('MD5SUMS.txt',) or os.path.isdir(os.path.join(P, f)):
            continue
        baris.append('%s  %s' % (hashlib.md5(open(os.path.join(P, f), 'rb').read()).hexdigest(), f))
    tulis('MD5SUMS.txt', '\n'.join(baris) + '\n')


def main():
    pasang_sql()
    periksa_sql()
    pulih_sql()
    tulis('pasang-satker.sh', PASANG_SH)
    tulis('pulih-satker.sh', PULIH_SH)
    tulis('tambal-rtf.pl', TAMBAL_PL)
    md5sums()
    print('paket-satker:', sorted(os.listdir(P)))


if __name__ == '__main__':
    main()
