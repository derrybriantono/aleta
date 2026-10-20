#!/usr/bin/perl
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
