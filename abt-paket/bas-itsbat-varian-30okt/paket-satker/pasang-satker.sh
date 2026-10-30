#!/bin/bash
# PASANG paket ABT "abt-bas-itsbat-varian-30okt" (30 Okt 2026) DI SERVER sebagai root, dari folder paket.
# Keputusan pengguna 30 Okt (2 = YA): varian BAS itsbat "BAS ALUR 11 [1b]" dan "[1c] ... Tanya Jawab dari Katalog Saksi"
# DISINGKIRKAN dari menu ABT dengan DIPINDAH (bukan dihapus) ke derry_briantono/terhapus/2 Itsbat Nikah - BAS/ - sesudah
# paket bas-tanya-jawab-29okt isi [1]/[1a] sama dengan [1b]/[1c]. Tidak ada basis data/menu yang diubah: menu
# "Itsbat Nikah - BAS" membaca isi foldernya, folder "terhapus" tidak punya menu.
# Penjaga: SEMUA berkas asal harus ada dengan md5 yang dikenal (sesudah paket u3; atau sesudah paket prodeo) dan tujuan
# belum ada - bila satu saja tidak, BERHENTI tanpa memindah apa pun. Pasang ulang (semua sudah di tujuan) = tidak berbuat apa-apa.
# Laptop: ABT_BLANGKO=<salinan derry_briantono> bash pasang-satker.sh
set -u
cd "$(dirname "$0")" || exit 1
B="${ABT_BLANGKO:-/var/www/html/aps_badilag/_blangko_abt/derry_briantono}"
gagal() { echo "GAGAL: $*"; exit 1; }
md5sum -c MD5SUMS.txt >/dev/null 2>&1 || gagal "isi paket rusak (md5sum -c MD5SUMS.txt)"
[ -d "$B" ] || gagal "folder blangko $B tidak ada"
md5() { md5sum "$1" | cut -d' ' -f1; }
belum=0; sudah=0; n=0
while IFS=$'\t' read -r asal tujuan md5ok; do
  [ -n "$asal" ] || continue
  n=$((n+1))
  if [ -f "$B/$asal" ] && [ ! -e "$B/$tujuan" ]; then
    m=$(md5 "$B/$asal")
    case ",$md5ok," in *",$m,"*) belum=$((belum+1)) ;; *) gagal "md5 $asal = $m bukan yang dikenal ($md5ok) - TIDAK ada yang dipindah" ;; esac
  elif [ ! -e "$B/$asal" ] && [ -f "$B/$tujuan" ]; then
    m=$(md5 "$B/$tujuan")
    case ",$md5ok," in *",$m,"*) sudah=$((sudah+1)) ;; *) gagal "di tujuan ada $tujuan bermd5 lain ($m) - TIDAK ada yang dipindah" ;; esac
  else
    gagal "keadaan $asal tidak dikenal (asal ada: $([ -e "$B/$asal" ] && echo ya || echo tidak), tujuan ada: $([ -e "$B/$tujuan" ] && echo ya || echo tidak)) - TIDAK ada yang dipindah"
  fi
done < pindah.tsv
echo "PRAPERIKSA: $n berkas | belum $belum | sudah $sudah"
if [ "$sudah" = "$n" ]; then echo "PASANG ULANG: semua sudah di folder terhapus"; echo SELESAI; exit 0; fi
[ "$belum" = "$n" ] || gagal "sebagian sudah dipindah, sebagian belum - periksa dengan tangan (tidak ada yang dipindah)"
dipindah=()
while IFS=$'\t' read -r asal tujuan md5ok; do
  [ -n "$asal" ] || continue
  mkdir -p "$B/$(dirname "$tujuan")" || break
  if mv -n "$B/$asal" "$B/$tujuan" && [ -f "$B/$tujuan" ] && [ ! -e "$B/$asal" ]; then
    dipindah+=("$asal	$tujuan"); echo "DIPINDAH: $asal -> $tujuan"
  else
    echo "gagal memindah $asal - mengembalikan"
    for x in "${dipindah[@]}"; do a=${x%%	*}; t=${x#*	}; mv -n "$B/$t" "$B/$a"; done
    gagal "pemindahan dibatalkan dan dikembalikan"
  fi
done < pindah.tsv
# pemilik/hak berkas mengikuti folder asal (ABT dibaca web server)
chown --reference="$B/2 Itsbat Nikah - BAS" -R "$B/terhapus/2 Itsbat Nikah - BAS" 2>/dev/null || true
echo "SELESAI (${#dipindah[@]} berkas dipindah ke folder terhapus; pulih: pulih-satker.sh)"
