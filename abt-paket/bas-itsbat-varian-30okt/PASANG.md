# Paket ABT `abt-bas-itsbat-varian-30okt` - varian BAS itsbat ganda disingkirkan dari menu (30 Okt 2026)

**Status: diuji di laptop (salinan folder). Server: BELUM dipasang - dipasang sesi utama SESUDAH `bas-tanya-jawab-29okt`.**

Keputusan pengguna 30 Okt (butir 2 = YA): sesudah paket `bas-tanya-jawab-29okt`, isi `BAS ALUR 11 [1]` = `[1b] ... Tanya Jawab dari Katalog Saksi` dan `[1a]` = `[1c]`. Varian `[1b]`/`[1c]` DIPINDAH (tidak dihapus) ke `derry_briantono/terhapus/2 Itsbat Nikah - BAS/` (folder arsip yang sudah dipakai, tanpa menu). Tidak ada basis data, `abt_menu`, hak menu, atau urutan menu yang diubah: menu "Itsbat Nikah - BAS" (folder `2 Itsbat Nikah - BAS`, proses 80-297, jenis 360) membaca isi foldernya sendiri - sesudah paket 13 berkas (dulu 15), urutan nama tetap. Tidak ada kode ALETA/ekstensi/katalog saksi yang menyebut kedua nama berkas itu (dicari di ekstensi-sipp, manajemen_surat/src, aleta_bot/services).

Penjaga: kedua berkas harus ada dengan md5 yang dikenal - sesudah paket u3 (`01e2cb7a...`, `fbfae435...`) ATAU sesudah paket prodeo bangun-ulang (`63373923...`, `ebd97298...`) - dan tujuan belum ada; satu saja tidak cocok = berhenti tanpa memindah apa pun.

## Pasang / pulih (Git Bash, server hidup)
```bash
cd /d/.../abt-paket/bas-itsbat-varian-30okt
ssh aleta 'mkdir -p /root/abt-bas-itsbat-varian-20261030'
scp -r paket-satker/* aleta:/root/abt-bas-itsbat-varian-20261030/
ssh aleta 'cd /root/abt-bas-itsbat-varian-20261030 && md5sum -c MD5SUMS.txt | grep -v OK'     # harus kosong
ssh aleta 'bash /root/abt-bas-itsbat-varian-20261030/pasang-satker.sh'      # PRAPERIKSA 2|2|0, DIPINDAH x2, SELESAI
ssh aleta 'bash /root/abt-bas-itsbat-varian-20261030/pulih-satker.sh'       # bila perlu: PULIH COCOK
```

## Uji laptop (salinan 15 berkas `2 Itsbat Nikah - BAS` dari pohon perkiraan sesudah prodeo)
Pasang: 2 dipindah, folder 15 -> 13 berkas; pasang ulang: "semua sudah di folder terhapus"; pulih: `PULIH COCOK`, sidik seluruh salinan kembali persis (`de18bec043`); berkas disunting (md5 lain): `GAGAL ... TIDAK ada yang dipindah`.
