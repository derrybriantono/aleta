# Paket ABT `abt-jawab-replik-31okt` - naskah utuh jawab-menjawab di BAS dan duduk perkara (31 Okt 2026)

**Status: dibangun dan diuji di LAPTOP (server mati). Server: BELUM dipasang - dipasang sesi utama. URUTAN PASANG: KE-22, PALING AKHIR**
(sesudah 21 paket `../URUTAN-PASANG-31okt.md`; md5 dasar = keadaan sesudah ke-21 paket itu, diuji rantai `../uji-rantai-31okt`).

Permintaan pengguna 31 Okt: isian Blangko ABT by Derry Briantono untuk **jawaban (serta gugatan rekonvensi), replik (serta jawaban
rekonvensi), duplik (serta replik rekonvensi), duplik rekonvensi, kesimpulan Penggugat/Pemohon dan kesimpulan Tergugat/Termohon** -
terisi otomatis, dapat disunting, bentuknya benar (Enter = paragraf, penomoran, sub-judul). Arahan susulan: yang diambil HANYA dalil
dan petitum; variabelnya WAJIB ada di semua putusan kontradiktoir perkara gugatan (verstek dan Pdt.P tidak disisipi) dan di BAS
sidang jawab-menjawab. Hanya blangko dan variabel milik **derry_briantono**.

## Isi

| variabel | jenis | isi |
|---|---|---|
| 12020 / 12021 | data_teks | uraian jawaban #0047# (konvensi) / gugatan rekonvensi |
| 12022 / 12023 | data_teks | uraian replik #0046# / jawaban rekonvensi |
| 12024 / 12025 | data_teks | uraian duplik #0047# / replik rekonvensi |
| 12026 | data_teks | uraian duplik rekonvensi #0046# |
| 12027 / 12028 | data_teks | uraian kesimpulan #0046# / #0047# |
| 12030 / 12031 / 12032 | data_sql | BAS: jawaban+gugatan rekonvensi / replik+jawaban rekonvensi / duplik+replik rekonvensi (kosong = titik-titik) |
| 12033 | data_sql | duplik rekonvensi (BAS dan duduk perkara; kosong = titik-titik) |
| 12034 | data_sql | BAS: "Kesimpulan #0046#:" + naskah, "Kesimpulan #0047#:" + naskah (kosong = isian 8436/8437) |
| 12035 | data_sql | putusan yang hanya memuat POKOK jawaban: naskah tertulis menyusul (KOSONG bila belum ada naskah - cetakan lama tetap) |
| 12036 | data_sql | idem untuk kesimpulan |
| 9252 / 9253 / 9254 | diubah | jawaban/replik/duplik duduk perkara: naskah tertulis (+ rekonvensinya) bila ada, selain itu tanya jawab lisan PERSIS seperti dulu |
| 9257 / 9258 | diubah | kesimpulan paragraf: naskah tertulis bila ada, selain itu isian 8436/8437 seperti dulu |
| 0206 | diubah | "dilangsungkan#0206# di": spasi tak terpecah RTF di depan "secara elektronik" (ABT memangkas spasi tepi nilai; dulu tercetak "dilangsungkansecara") |

Isian 12020-12028 = teks POLOS satu paragraf per baris (diisi ekstensi dari dokumen e-Court, lihat `aleta_bot/services/naskahJawabMenjawabService.js`);
dicetak lewat fungsi `isian_rtf_blok`/`isian_rtf_butir` yang sudah ada (inden gantung menurut penanda butir 1. a. 1) -, sub-judul
"Dalam Eksepsi"/"Dalam Rekonvensi"/... di paragraf sendiri). Tidak ada fungsi baru, tidak ada tabel baru.

Blangko RTF (273 berkas, `paket-satker/daftar-tambal.tsv`, rincian `hasil/ubahan.tsv`), folder aktif saja (aturan sama dengan tinjau-31okt):
- 108 BAS ALUR jawaban/replik/duplik/duplik rekonvensi/kesimpulan (semua jenis gugatan): penampil 12030-12034 sesudah kalimat `#7083#`
  "... meneruskan ... ke dalam SIP sebagai berikut;" (dulu kosong - petugas menempel sendiri);
- 129 putusan kontradiktoir yang memuat jawab-menjawab: petunjuk merah/tebal "COPY FILE JAWABAN/REPLIK/DUPLIK/DUPLIK REKONVENSI/
  KESIMPULAN APABILA TERTULIS ..." diganti penampil 9252/9253/9254/12033/9257/9258 (264) atau dihapus bila penampilnya sudah tepat di
  atasnya (72); CT rekonvensi: #12033# sesudah kalimat "mengajukan duplik rekonvensi secara ..." yang dulu tanpa isi;
- 41 putusan kontradiktoir yang hanya memuat POKOK jawaban (ES sederhana, izin poligami, itsbat kontensius, cabut sesudah jawaban,
  li'an, putusan sela eksepsi/intervensi): #12035# sesudah kalimat jawaban (dan #12036# sesudah kalimat kesimpulan bila ada);
- keputusan sesi utama 31 Okt: BAS replik dan duplik rekonvensi "diunggah #7036#" (42), BAS kesimpulan "diunggah #7036# dan #7037#" (22),
  24 putusan "kemudian #0046# mengajukan dupliknya" -> #0047#;
- di samping tiap penampil: kelompok tersembunyi `{\*\isianasal #12020# ...}` - isian tampil di tabel ABT blangko itu.
TIDAK disentuh: blangko verstek / T tidak hadir setelah mediasi / gugur / coret / cabut sebelum jawaban / perdamaian / Pdt.P.

## Pasang (Git Bash, server hidup) - PALING AKHIR

```bash
cd /d/.../abt-paket/jawab-replik-31okt
rm -rf paket-satker/cadangan
ssh aleta 'mkdir -p /root/abt-jawab-replik-20261031'
scp -r paket-satker/* aleta:/root/abt-jawab-replik-20261031/
ssh aleta 'cd /root/abt-jawab-replik-20261031 && md5sum -c MD5SUMS.txt | grep -v OK'     # harus kosong
ssh aleta 'bash /root/abt-jawab-replik-20261031/pasang-satker.sh'
```

Keluaran benar:
```
PRASYARAT COCOK (0|0|6|0|4)
SIAP=273
BERKAS SIAP
CADANGAN: ... (baris variabel: 6)
SEMUA COCOK
UJI: 13 kueri berjalan (perkara <id>)
TAMBAL=273
BERKAS COCOK
SELESAI - paket abt-jawab-replik-31okt terpasang. ...
```
Pasang ulang aman (`0|16|0|6|4`, `SUDAH=273`). PRASYARAT lain = berhenti TANPA mengubah apa pun (mis. `0|0|4|0|4` = salah satu dari
9252/9253/9254/9257/9258 sudah disunting orang). Pulih: `ssh aleta 'bash /root/abt-jawab-replik-20261031/pulih-satker.sh'` -> `PULIH COCOK`.
