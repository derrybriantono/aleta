# Paket ABT `abt-ket-saksi-baris-30okt` - jawaban saksi bergaris-baru tidak lagi tergabung di tabel BAS (30 Okt 2026)

**Status: diuji di basis salinan laptop (`aps_badilag_bas29` = dump server 28 Okt 15.44). Server: BELUM dipasang - dipasang sesi utama. Urutan bebas terhadap paket lain.**

**PERHATIAN - paket ini MENGUBAH DATA TERSIMPAN** `abt_keterangan_saksi` (hanya ganti baris -> satu spasi; huruf lain tidak berubah, diperiksa; bisa dipulihkan persis). Dahulu (paket x6, 21 Okt) pengguna memutuskan isian tersimpan tidak diubah untuk kalimat penutup; paket ini dibuat atas arahan koordinator 30 Okt pagi (temuan simulasi). Bila pengguna tidak setuju data diubah, JANGAN pasang.

## Masalah
Tabel tanya-jawab BAS dicetak PHP ABT (`kolom_kode_A4`) dengan teks pertanyaan/jawaban APA ADANYA. RTF mengabaikan karakter ganti baris, sehingga jawaban yang diketik/ditempel dengan Enter tercetak bergabung: "tidak ada\nhubungan" -> "tidak **adahubungan**", "untuk\nmemperoleh" -> "**untukmemperoleh**" (render php56 ABT asli 208/Pdt.P/2026 BAS ALUR 11 [1]: 2 kata; 190/Pdt.P/2026 BAS ALUR 12 [1]: 1 kata). Putusan (`isian_rtf_ket_saksi`) sudah mengganti ganti baris dengan spasi, jadi BAS dan putusan berbeda bunyi. Diukur di dump server: **9.131 baris** tanya-jawab (8.594 jawaban, 4.060 pertanyaan; 1.281 perkara) memuat ganti baris. Semua diinput lewat penyunting ABT.

## Isi
- Fungsi `isian_rtf_satu_baris(t)`: tiap rangkaian ganti baris (CR/LF) beserta spasi/tab di sekitarnya -> satu spasi; di awal/ujung dibuang. Teks tanpa ganti baris dikembalikan persis.
- Pemicu `abt_keterangan_saksi_satu_baris_bi` (BEFORE INSERT) dan `_bu` (BEFORE UPDATE): data yang disimpan penyunting tanya-jawab ABT/ekstensi sesudah ini langsung rapi. (ABT dump server: tidak ada pemicu lain pada tabel itu; PRASYARAT C memeriksa.)
- Data lama dirapikan satu kali (satu transaksi), cadangan semua baris yang disentuh ke `cadangan/baris-sebelum.sql` dulu.

## PRASYARAT
`A|B|C|D` = fungsi ada | pemicu paket | pemicu lain pada tabel | baris bergaris-baru. Pasang bila `0|0|0|N` (dump server: `0|0|0|9131`); pasang ulang `1|2|0|0`; selain itu berhenti tanpa mengubah apa pun.

## Pasang (Git Bash, server hidup)
```bash
cd /d/.../abt-paket/ket-saksi-baris-30okt
ssh aleta 'mkdir -p /root/abt-ket-saksi-baris-20261030'
scp -r paket-satker/* aleta:/root/abt-ket-saksi-baris-20261030/
ssh aleta 'cd /root/abt-ket-saksi-baris-20261030 && md5sum -c MD5SUMS.txt | grep -v OK'     # harus kosong
ssh aleta 'bash /root/abt-ket-saksi-baris-20261030/pasang-satker.sh'
```
Keluaran benar: `PRASYARAT COCOK (0|0|0|N)`, `CADANGAN: ... (N baris)`, `PERIKSA DATA ...: N|0|0|0`, `PERIKSA: SEMUA COCOK`, `PRASYARAT SESUDAH: 1|2|0|0`, `SELESAI`.
Pulih: `ssh aleta 'bash /root/abt-ket-saksi-baris-20261030/pulih-satker.sh'` - pemicu dihapus dulu, baris dikembalikan HANYA bila isinya masih persis hasil paket (yang disimpan ulang petugas dibiarkan dan dihitung), fungsi dihapus; akhir `PULIH COCOK`.

## Hasil uji laptop (`aps_badilag_bas29`)
- Pasang: `0|0|0|9131` -> cadangan 9.131 baris -> PERIKSA DATA `9131|0|0|0` (tidak ada baris hilang; huruf selain spasi/tab/ganti baris sama persis) -> `SEMUA COCOK` -> `1|2|0|0`. 29 detik.
- Pemicu (dalam transaksi lalu ROLLBACK): INSERT "tanya\ndua"/"telah\nmenikah" tersimpan "tanya dua"/"telah menikah"; UPDATE "x\ny" -> "x y".
- Pulih: 9.131/9.131 masih hasil paket -> dikembalikan; sidik seluruh tabel (md5 id+pertanyaan+jawaban, 70.045 baris) SAMA dengan sebelum pasang (`faa81cdd...`). Pasang lagi: cocok.
- Banding keterangan saksi putusan (`isian_rtf_ket_saksi`) sebelum/sesudah data dirapikan atas 1.931 kelompok saksi: 1.813 sama; 86 beda hanya spasi (spasi ganda di sekitar ganti baris jadi satu); **32 beda lain = jawaban yang DIAWALI ganti baris**: dulu "Bahwa         Puncak pertengkaran ..." (spasi panjang dan huruf besar karena awal teks bukan huruf), kini "Bahwa puncak pertengkaran ...". Tidak ada kata yang hilang/berubah.
- Render php56 ABT asli sesudah data dirapikan: 208/Pdt.P/2026 BAS ALUR 11 [1] dan 190/Pdt.P/2026 BAS ALUR 12 [1]: 0 kata tergabung (sebelum 2 dan 1).
