# Paket ABT `abt-w3a-blangko-baru-perkawinan` - blangko Derry BARU untuk enam jenis perkawinan/keluarga (agen W3a, 21 Okt 2026)

**Status: teruji di ABT LAPTOP (pasang, pasang ulang, pulih, penjaga prasyarat) dan PRASYARAT + 603 kueri variabel dijalankan BACA SAJA di server (MariaDB 5.5). Server: BELUM dipasang - dipasang sesi utama.**
Hanya blangko, variabel, dan menu Derry; tidak ada berkas atau baris lama yang diubah. Tanpa kata "Aleta"/"ALETA" di ABT.

## Isi (`paket-satker/`)

| berkas | isi |
|---|---|
| `abt-w3a-blangko-baru-perkawinan-PRASYARAT.sql` | baca saja: `A\|B\|C\|D\|E` harus `0\|0\|313\|0\|0` (pertama; sudah dicek di server 21 Okt 2026) atau `0\|154\|313\|0\|12` (pasang ulang). C = 313 variabel lama yang dirujuk blangko/kueri HARUS ada |
| `...-PASANG.sql` | 154 variabel baru (nomor 3600-3779 dan 3790-3791, hex cp1252) + 12 baris `abt_menu` (id 168-179), satu transaksi, `WHERE NOT EXISTS` |
| `...-PERIKSA.sql` | md5 nama + tipe + kueri + bawaan tiap variabel dan md5 semua kolom tiap menu; baris akhir `SEMUA COCOK` |
| `...-PULIH.sql` | menghapus variabel/menu baru HANYA bila isinya masih persis paket; akhir `PULIH COCOK` |
| `rtf/` | 199 blangko BARU (197 di 12 folder baru + 2 relaas di `98 Relaas`); tidak pernah menimpa berkas lain |
| `berkas_rtf.py`, `pasang-satker.sh`, `pulih-satker.sh`, `folder-baru.txt`, `folder-ada.txt`, `daftar-rtf.tsv`, `uji-kueri.tsv`, `MD5SUMS.txt` | urutan: md5 -> prasyarat -> cadangan -> pasang SQL -> periksa -> uji kueri atas perkara nyata -> folder baru -> berkas -> periksa berkas; gagal = pulih otomatis |

## Pasang (Git Bash, server hidup)

```bash
cd /d/.../abt-paket/w3a-blangko-baru-perkawinan            # folder repo
ssh aleta 'mkdir -p /root/abt-w3a-20261021'
scp -r paket-satker/* aleta:/root/abt-w3a-20261021/
ssh aleta 'cd /root/abt-w3a-20261021 && md5sum -c MD5SUMS.txt | grep -v OK'     # harus kosong
ssh aleta 'bash /root/abt-w3a-20261021/pasang-satker.sh'
```
Keluaran benar: `PRASYARAT COCOK (0|0|313|0|0)`, `BERKAS SIAP`, `SEMUA COCOK`, baris `uji perkara NNNN: 36xx ...`, 12 baris `FOLDER BARU`, `BUAT=199`, `COCOK=199`, `BERKAS COCOK`, `SELESAI`.
Pulih: `ssh aleta 'bash /root/abt-w3a-20261021/pulih-satker.sh'` (akhir `PULIH COCOK`, `BERKAS PULIH`, 12 `FOLDER DIHAPUS`).

Laptop (diuji): `ABT_LOKAL=1 ABT_DB=aps_badilag_w3a ABT_BLANGKO=<akar uji pendek, mis. D:/b> SIPP_DB=sipp_donggala PY=python bash pasang-satker.sh` dengan folder paket disalin ke jalur pendek (jalur Windows > 260 karakter menggagalkan Python tanpa awalan jalur panjang). Hasil 21 Okt: pasang -> pasang ulang (`SUDAH_BARU=199`) -> pulih (variabel 1898 dan menu 109 kembali persis, 12 folder dihapus); prasyarat yang dilanggar (nomor 3601 berisi lain) -> `GAGAL ... TIDAK ada yang diubah`.

## Menu (hak): satu pasang per jenis, pola menu 101-185

`abt_menu` id 168-179 (celah kosong antara 166 dan 180): "<Jenis> - Putusan" (grup `1|10|20`, top `1`, tanpa validator) dan "<Jenis> - BAS" (grup `1|30|500|430|1000|1010|1020`, top `1|30`, validator `10|20`), `proses_id` 80-297, `perkara_id_referensi=jenis_perkara_id` dengan rentang tepat satu jenis, `user_cek=3`. Induk `derry_briantono` (grup menu 99).

| jenis SIPP | folder putusan / BAS | berkas putusan / BAS | variabel | ALUR BAS |
|---|---|---|---|---|
| 343 Penolakan Perkawinan | `5c Penolakan Perkawinan` / `... - BAS` (menu 168/169) | 9 / 12 | 3600-3618 (19: 12 isian, 7 kueri) | 60 |
| 359 Perkawinan Campuran | `5d Perkawinan Campuran` (170/171) | 10 / 12 | 3620-3639 (20) | 61 |
| 361 Izin Kawin | `3a Izin Kawin` (172/173) | 13 / 12 | 3640-3659 (20) | 62 |
| 352 Pengesahan Anak | `8a Pengesahan Anak` (174/175) | 11 / 12 | 3660-3676 (17) | 63 |
| 345 Kelalaian atas Kewajiban Suami/Istri | `1e Kelalaian Kewajiban Suami Istri` (176/177) | 15 / 38 | 3690-3733 (37) | 64 |
| 351 Hak-hak Bekas Istri/Kewajiban Bekas Suami | `1f Hak Bekas Istri` (178/179) | 15 / 38 | 3740-3779 (39) | 65 |
| relaas (bersama) | `98 Relaas`: `[JS] 12.1` (Pegawai Pencatat Nikah), `[JS] 13.1` (orang tua/wali) | 2 | 3790-3791 | - |

Permohonan (343, 359, 361, 352): penetapan [01] kabul (+ varian lazim jenis itu), [03] tolak, [99x] NO, [98] cabut, [98a] gugur, [98c] coret, [99] NO SEMA 1/2022; BAS 12 berkas (sidang 1 x 4 varian, lanjutan x 3, pembacaan penetapan, cabut, gugur, NO, tunda panggil). Gugatan (345, 351): 15 putusan ([01], [01a], [01b], [02], [02b], [03], [03b], [97], [98], [98a], [98b], [98c], [99], [99a], [99b]) dan BAS 29 salinan ALUR 04-09 + 9 khusus (V1, V2, V2S, AP, GD, N, T, CS, CM). PTSP: tidak ada berkas baru - penetapan PMH/PPP/PJS/PHS/mediator di `99 PTSP` berlaku untuk semua jenis (memakai `#0048#` jenis perkara).

## Yang dipasang di ALETA (repo, bukan server ABT)
Pohon blangko, pemetaan jenis -> folder/menu, rekomendasi blangko (mesin saran semua jenis), keadaan putusan (gugatan 345/351 mengenal verstek, mediasi, kabul sebagian), ALUR BAS 60-65, salinan BAS, cermin ekstensi (`panel-alat.js` + `bawaan-ekstensi.ts`, dibangkitkan `sumber/integrasi_w3a.py` dari `peta-w3a.json`), peta nama jenis -> id (bot, ekstensi, portal), label awam isian (`susun.ts`) dan penanda manual/opsional (`isian-metadata.ts`), 7 katalog saksi, 6 modul deteksi posita. Ekstensi berubah: perlu rilis/tanam (sesi utama).

## Membangun ulang
`python sumber/bangun_paket.py` (menjalankan semua `sumber/jenis_*.py` dan `relaas_w3a.py`, memeriksa isi RTF lewat `periksa_isi.py`, membangun `paket-satker/` dan `peta-w3a.json`), lalu `python sumber/integrasi_w3a.py` (menyuntikkan peta ke kode ALETA; idempoten), dan dari `manajemen_surat/`: `node scripts/susun-saksi-katalog.mjs`. Berkas dasar: pohon `derry_briantono` server 21 Okt 2026 (`W3A_ASLI`, salinan di `D:/aleta-dev/kerja/w3a/asli`).

## Belum / batas (jujur)
- Perkara nyata keenam jenis di SIPP PA Donggala hampir NOL (343: 1 perkara yang ternyata itsbat salah jenis; lainnya 0): semua uji perilaku memakai fixture; kueri variabel diukur atas perkara serumpun (lihat `docs/gelombang3/UKUR-W3a.md`). Tingkat "pasti/cukup" deteksi belum diukur atas perkara nyata, jadi di gerbang isian tetap tampil sebagai saran "ragu - periksa" sampai ada ukuran.
- Rujukan hukum: `docs/gelombang3/PERIKSA-PASAL-W3a.md` (ringkasan butir perlu-verifikasi) dan satu berkas per jenis.
- `docs/isi-sipp-abt/DAFTAR-CEK` (daftar cek isian 982 blangko) TIDAK diregenerasi untuk 199 blangko baru; penjaganya membaca fixture server 17 Okt yang tidak memuat folder baru.
- Relaas panggilan pejabat pencatat/orang tua/wali ([JS] 12.1, 13.1) hanya tersedia di menu ABT; pemilihan otomatis dari portal (relaas massal) belum disambungkan (pihak bukan pihak SIPP, seperti [JS] 11.2/11.3 pencegahan).
- Pengisi itsbat (S5) belum disambungkan ke jenis 352 (fakta nikah `#5197#`, `#5105#`, `#1046#`, `#1217#` pengesahan anak diisi petugas).
- Render php56 lokal: lihat `docs/gelombang3/HASIL-RENDER-W3a.md`.
