#!/usr/bin/perl
# Tambal blangko RTF derry_briantono (paket bukti-nomor-30okt; salinan persis tambal-rtf.pl paket bas-tanya-jawab-29okt/pihak-urut-ecourt-27okt) - dengan PENJAGA md5.
# Pakai: perl tambal-rtf.pl periksa|pasang|pulih <folder derry_briantono> <folder cadangan>
#   periksa : tiap berkas -> COCOK (md5 persis yang diperiksa dan semua jangkar tepat -> hasil tambal = md5 yang diharapkan),
#             SUDAH (md5 persis hasil tambal), atau LEWAT (tidak ada / md5 beda dari yang diperiksa / jangkar tak cocok). TIDAK menulis apa pun.
#   pasang  : HANYA berkas COCOK: cadangan utuh ke <cadangan>/rtf-lama/<kode>.rtf (md5 cadangan diperiksa), tulis, baca ulang & cocokkan md5 hasil
#             (tak cocok = kembalikan dari cadangan dan berhenti). LEWAT tidak disentuh. Tidak pernah menimpa cadangan lama.
#   pulih   : kembalikan dari <cadangan>/rtf-lama HANYA bila md5 berkas sekarang masih persis hasil paket (yang sudah disunting dibiarkan).
# Berkas daftar: rtf-daftar-tambal.tsv  kode<TAB>jalur<TAB>md5_lama<TAB>md5_baru<TAB>jumlah_tambalan
#                rtf-tambal.tsv         b64(jalur)<TAB>urutan<TAB>jumlah<TAB>b64(jangkar)<TAB>b64(pengganti)
# Digest::MD5 tidak terpasang di perl server satker - dipakai bila ada, kalau tidak lewat perintah md5sum.
use strict; use warnings;
use MIME::Base64; use File::Basename; use File::Copy;
my $punya_digest = eval { require Digest::MD5; 1 } ? 1 : 0;
sub md5_hex {
  my ($d) = @_;
  return Digest::MD5::md5_hex($d) if $punya_digest;
  my $dir = $ENV{TMPDIR} || $ENV{TMP} || '/tmp';
  my $f = "$dir/tambal-rtf-md5-$$";
  open(my $o, '>:raw', $f) or die "md5: $!"; print $o $d; close $o;
  my $r = `md5sum '$f'`; unlink $f; my ($h) = split /\s+/, $r; return $h;
}
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
# Nilai: [status, kode, keterangan, rel, hasil, md5hasil]
sub nilai {
  my ($rel) = @_;
  my ($kode, $m0, $m1, $n) = @{$daftar{$rel}};
  my $d = baca("$B/$rel");
  return ['LEWAT', $kode, 'tidak ada', $rel] unless defined $d;
  my $m = md5_hex($d);
  return ['SUDAH', $kode, '', $rel] if $m eq $m1;
  return ['LEWAT', $kode, "md5 server $m beda dari yang diperiksa $m0 (tidak diubah)", $rel] if $m ne $m0;
  my ($h, $alasan) = terapkan($d, $rel);
  return ['LEWAT', $kode, $alasan, $rel] unless defined $h;
  my $mh = md5_hex($h);
  return ['LEWAT', $kode, "hasil tambal md5 $mh bukan $m1 (tidak diubah)", $rel] if $mh ne $m1;
  return ['COCOK', $kode, 'md5 persis, hasil = md5 paket', $rel, $h, $mh];
}
my ($cocok, $sudah, $lewat) = (0, 0, 0);
if ($mode eq 'periksa' || $mode eq 'pasang') {
  my $log;
  if ($mode eq 'pasang') {
    mkdir $C; mkdir "$C/rtf-lama";
    die "cadangan lama ada di $C/rtf-ditambal.txt - jalankan pulih dulu, jangan timpa\n" if -s "$C/rtf-ditambal.txt";
    open($log, '>', "$C/rtf-ditambal.txt") or die $!;
    select((select($log), $| = 1)[0]);
  }
  for my $rel (@urut) {
    my $v = nilai($rel);
    my ($st, $kode, $ket) = @$v;
    if ($st eq 'SUDAH') { print "SUDAH\t$kode\t$rel\n"; $sudah++; next; }
    if ($st eq 'LEWAT') { print "LEWAT\t$kode\t$ket\t$rel\n"; $lewat++; next; }
    if ($mode eq 'pasang') {
      my ($h, $mh) = ($v->[4], $v->[5]);
      my $p = "$B/$rel";
      copy($p, "$C/rtf-lama/$kode.rtf") or die "cadang $rel: $!";
      my $dc = baca("$C/rtf-lama/$kode.rtf");
      die "cadangan $kode rusak (md5 beda dari berkas asli) - berhenti sebelum menulis\n" unless defined $dc && md5_hex($dc) eq $daftar{$rel}[1];
      print $log "$kode\t$mh\t$rel\n";
      tulis($p, $h);
      my $cek = baca($p);
      if (!defined $cek || md5_hex($cek) ne $mh) { copy("$C/rtf-lama/$kode.rtf", $p); die "tulis $rel: md5 sesudah tulis tidak cocok - dikembalikan dari cadangan, berhenti\n"; }
      print "DITAMBAL\t$kode\t$ket\t$rel\n";
    } else { print "COCOK\t$kode\t$ket\t$rel\n"; }
    $cocok++;
  }
  close $log if $log;
  print "RINGKAS " . ($mode eq 'pasang' ? 'DITAMBAL' : 'COCOK') . "=$cocok SUDAH=$sudah LEWAT=$lewat\n";
} elsif ($mode eq 'pulih') {
  open(my $l, '<', "$C/rtf-ditambal.txt") or die "tidak ada $C/rtf-ditambal.txt\n";
  my ($ok, $skip) = (0, 0);
  while (<$l>) {
    chomp; my ($kode, $mh, $rel) = split /\t/; my $p = "$B/$rel"; my $d = baca($p);
    if (defined $d && md5_hex($d) eq $daftar{$rel}[1]) { print "SUDAH SEMULA\t$rel\n"; $ok++; }
    elsif (defined $d && md5_hex($d) eq $mh) {
      my $lama = baca("$C/rtf-lama/$kode.rtf");
      if (defined $lama && md5_hex($lama) eq $daftar{$rel}[1]) { tulis($p, $lama); print "DIPULIHKAN\t$rel\n"; $ok++; }
      else { print "DILEWATI (cadangan $kode tidak utuh)\t$rel\n"; $skip++; }
    }
    else { print "DILEWATI (berubah sesudah ditambal)\t$rel\n"; $skip++; }
  }
  close $l; rename "$C/rtf-ditambal.txt", "$C/rtf-ditambal.dipulihkan." . time();
  print "RINGKAS PULIH=$ok DILEWATI=$skip\n";
} else { die "mode tidak dikenal\n"; }
