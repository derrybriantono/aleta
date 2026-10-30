# Paket ABT `abt-ket-saksi-kata-30okt` - keterangan saksi putusan tidak lagi memotong kata (30 Okt 2026)

**Status: diuji di basis salinan laptop (`aps_badilag_bas29` = dump server 28 Okt 15.44). Server: BELUM dipasang - dipasang sesi utama. Pasangan paket `bas-tanya-jawab-29okt` (urutan bebas; sebaiknya bersama).**

Hanya **fungsi tersimpan** di `aps_badilag`: fungsi baru `isian_rtf_ganti_kata` dan `isian_rtf_ket_saksi` diganti (nama dan tanda tangan sama). Tidak ada variabel, blangko, menu, isian, atau SIPP yang diubah. Tanpa kata nama aplikasi.

## Masalah (ditemukan saat simulasi render paket bas-tanya-jawab)

`isian_rtf_ket_saksi` (paket I3, penyaring penutup x6) dipakai variabel 9259-9265 = keterangan saksi di SEMUA putusan Derry (patokan Format Lengkap dan 59 putusan yang dialihkan paket bas-tanya-jawab). Fungsi meniru `replace_ket_saksi` PHP ABT (`str_ireplace`): `saya` -> `saksi` dan `ya, ` -> `` diganti di mana saja, termasuk di TENGAH kata. Contoh nyata hasil render php56 ABT:
- 270/Pdt.G/2025 (cerai talak): BAS "Saya tidak mengetahuinya, yang saya tahu tiba-tiba Termohon pergi ..." -> putusan "Bahwa saksi tidak **mengetahuinyang** saksi tahu ...".
- 252/Pdt.G/2024 (izin poligami): BAS "Iya, saya mengenal Pemohon ..." -> putusan "Bahwa **isaksi** mengenal Pemohon ...".
Diukur atas dump server (`abt_keterangan_saksi`, 70.045 jawaban): **1.468 jawaban di 631 perkara** memuat "...ya, " di ujung kata (anaknya, , mengetahuinya, , Iya, ...) dan 83 memuat "saya" di dalam kata (kesayangan ...).

Perbaikan: `saya` dan `ya, ` hanya diganti bila KATA UTUH (huruf sebelum - dan untuk `saya` huruf sesudah - bukan a-z); "Iya, " di awal jawaban dibuang seperti "Ya, ". Baris lain definisi sama persis (dibangun mekanis `sumber/bangun_paket.py` dari definisi terpasang).

Catatan: blangko non-Derry yang memakai variabel bawaan ABT 2021/2022 (dicetak PHP `list_keterangan`) masih mengalami potongan kata yang sama - itu kode PHP ABT, tidak disentuh.

## PRASYARAT
`1|0|1|0` = fungsi ada | `isian_rtf_ganti_kata` belum ada | definisi `isian_rtf_ket_saksi` = versi x6 terpasang (md5 `19408aadfcfb1fe1b3463d46a9bfdc8b`, diukur di dump server 28 Okt) | belum versi paket. Pasang ulang: `1|1|0|1`. Selain itu berhenti tanpa mengubah apa pun.

## Pasang (Git Bash, server hidup)
```bash
cd /d/.../abt-paket/ket-saksi-kata-30okt
ssh aleta 'mkdir -p /root/abt-ket-saksi-kata-20261030'
scp -r paket-satker/* aleta:/root/abt-ket-saksi-kata-20261030/
ssh aleta 'cd /root/abt-ket-saksi-kata-20261030 && md5sum -c MD5SUMS.txt | grep -v OK'     # harus kosong
ssh aleta 'bash /root/abt-ket-saksi-kata-20261030/pasang-satker.sh'
```
Keluaran benar: `PRASYARAT COCOK (1|0|1|0)`, `CADANGAN: ...`, `PERIKSA: SEMUA COCOK`, `PRASYARAT SESUDAH: 1|1|0|1`, `SELESAI`. Pulih: `ssh aleta 'bash /root/abt-ket-saksi-kata-20261030/pulih-satker.sh'` (akhir `PULIH COCOK`). Tidak perlu memulai ulang apa pun.

## Hasil uji laptop (`sumber/uji_lokal.sh`, keluaran `hasil/uji-lokal.txt`, ringkas beda `hasil/beda-ringkas.txt`)
- PRASYARAT `1|0|1|0` -> pasang -> `1|1|0|1` -> pulih -> `1|0|1|0` -> pasang lagi `1|1|0|1`; uji fungsi kata utuh 5/5.
- Keluaran `isian_rtf_ket_saksi` lama vs baru: **946 kelompok saksi tanpa pola: 946 sama, 0 beda**; 985 kelompok berpola ("...ya, " / "saya" di dalam kata / "Iya, " di awal): 445 sama (pola hanya di kalimat penutup yang memang dibuang, atau "ya, " sesudah spasi yang tetap dibuang), 540 berubah. Seluruh 540 beda (panjang penuh, `sumber/beda_kata.py`): 519 "ya, " di ujung kata dikembalikan (mis. "hidupnalmarhum" -> "hidupnya, almarhum"), 83 "saya" di dalam kata dikembalikan ("Sayang"/"juga saya" salah ketik), 17 "Iya, " di awal dibuang ("iPenggugat" -> "Penggugat"); 18 lain = salah ketik data ("sSaya" tetap tercetak "sSaya", dulu "ssaksi").
- Sesudah pulih: 1.931 dari 1.931 kelompok = keluaran lama persis.
- Skrip paket dijalankan utuh di laptop (`ABT_LOKAL=1 ABT_DB=aps_badilag_bas29`, salinan paket di `D:/k30`): pasang ulang `1|1|0|1` SELESAI; pulih PULIH COCOK; pasang `1|0|1|0` -> CADANGAN -> PERIKSA SEMUA COCOK -> SELESAI.
- Render php56 ABT asli: 270/Pdt.G/2025 putusan cerai talak [02]: sinkron BAS->putusan 22/24 menjadi **24/24**; 252/Pdt.G/2024 izin poligami: "isaksi mengenal" -> "saksi mengenal".
