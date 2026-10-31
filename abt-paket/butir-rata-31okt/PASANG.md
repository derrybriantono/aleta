# Paket ABT `abt-butir-rata-31okt` - paragraf tanpa nomor sesudah butir bernomor rata kiri (31 Okt 2026)

**Status: dibangun dan diuji di LAPTOP (server mati). Server: BELUM dipasang. URUTAN PASANG: KE-23, PALING AKHIR** (sesudah
`jawab-replik-31okt`; md5 dasar = fungsi `isian_rtf_butir` keadaan sesudah 22 paket `../URUTAN-PASANG-31okt.md` - fungsi itu tidak
disentuh paket 29-31 Okt mana pun, md5 sama dengan dump server 28 Okt; begitu pula `isian_rtf_judul`).

Keputusan pengguna 31 Okt (pertanyaan jawab-replik nomor 1): paragraf TANPA nomor sesudah butir bernomor ("Berdasarkan alasan-alasan
... mohon:", "Atau apabila Majelis Hakim berpendapat lain ...") dicetak RATA KIRI dengan inden baris pertama seperti posita gugatan,
tidak lagi menjorok sejajar isi butir. Butir bernomor dan butir "-" tetap.

## Isi
Dua fungsi diganti. Pertama `isian_rtf_butir` (dipakai 9250 posita, 9251 petitum, 9252-9258 jawab-menjawab/kesimpulan, 12030-12036 naskah
jawab-menjawab). Cabang "penomoran tangan aktif + paragraf tanpa penanda" mencetak `\li0\fi720` (dulu `\li<tingkat>\fi0` = lanjutan
butir) bila SEMUA terpenuhi:
- penomoran tangan di tingkat dasar (bukan di dalam daftar HTML `<ol>/<ul>`), berawal nomor/huruf (bukan butir "-");
- paragraf itu kalimat baru: huruf pertama kapital DAN paragraf sebelumnya berakhir `.` `;` `:` `!` `?` `)`.
Potongan kalimat posita SIPP yang terpecah baris (paragraf sebelumnya belum selesai, atau diawali huruf kecil) tetap lanjutan butir.
Keadaan penomoran tidak berubah, jadi nomor butir sesudahnya sama persis. Tanpa variabel, tanpa blangko RTF.

Fungsi kedua: `isian_rtf_judul` (hanya dipanggil `isian_rtf_butir`) mengenali juga "Dalam Konvensi dan Rekonvensi" / "Konvensi dan
Rekonvensi" sebagai sub-judul (rata kiri tanpa inden, sama dengan "Dalam Rekonvensi") - tanpa itu baris tersebut ikut berinden baris pertama.

## Banding (seluruh masukan nyata fungsi itu, `alat/banding.py`, hasil `hasil/banding.txt`)
Posita dan petitum SIPP seluruh perkara (sipp_2810), keterangan jawab-menjawab lisan ABT, isian teks 8436/8437/12020-12028: setiap
paragraf yang berubah = paragraf tanpa penanda yang pindah dari lanjutan butir ke rata kiri berinden baris pertama dengan teks sama
persis; jumlah paragraf sama; "BEDA LAIN" 0. Angka lengkap di `hasil/banding.txt`.

## Pasang (Git Bash, server hidup) - PALING AKHIR
```bash
cd /d/.../abt-paket/butir-rata-31okt
rm -rf paket-satker/cadangan
ssh aleta 'mkdir -p /root/abt-butir-rata-20261031'
scp -r paket-satker/* aleta:/root/abt-butir-rata-20261031/
ssh aleta 'cd /root/abt-butir-rata-20261031 && md5sum -c MD5SUMS.txt | grep -v OK'     # harus kosong
ssh aleta 'bash /root/abt-butir-rata-20261031/pasang-satker.sh'
```
Keluaran benar: `PRASYARAT COCOK (2|0)`, `CADANGAN: ...`, `PERIKSA: SEMUA COCOK`, `UJI: <n> contoh sama dengan laptop`, `SELESAI ...`.
Pasang ulang aman (`0|2` = sudah terpasang). Lain = berhenti tanpa mengubah apa pun.
Pulih: `ssh aleta 'bash /root/abt-butir-rata-20261031/pulih-satker.sh'` -> `PULIH COCOK (2|0)`.
