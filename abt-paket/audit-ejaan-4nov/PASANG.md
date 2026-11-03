# Paket ABT `abt-audit-ejaan-4nov` - ejaan baku hasil audit A3 K07 (4 Nov 2026, disetujui Derry)

**Status: dibangun dan diuji di LAPTOP. Server: BELUM dipasang.** Hanya blangko pengguna **derry_briantono** (581 berkas,
938 potongan). Tanpa variabel, menu, fungsi, tabel, atau data yang diubah; tanpa kata nama aplikasi. Hanya huruf teks yang berubah
(kode RTF di dalam potongan sama persis, dijaga uji). Dibangun dengan `../audit-mekanis-4nov/sumber/bangun_paket.py` (aturan K07 saja).

**Urutan pasang: `ijab-yang-menikahkan-3nov` -> `audit-mekanis-4nov` -> paket ini.** Paket ini dipisah dari audit-mekanis supaya satu
blangko yang berubah di server tidak menahan perbaikan cetak & salah ketik; bila paket ini berhenti, audit-mekanis tetap berlaku.

## Isi
| ubahan | kali | berkas |
|---|---|---|
| `diatas`/`Diatas` -> `di atas`/`Di atas` | 819 | 501 |
| `dipersidangan` -> `di persidangan` | 78 | 76 |
| `dibawah` -> `di bawah` | 24 | 11 |
| `Undang Undang` -> `Undang-Undang` | 17 | 11 |
| jumlah | 938 | 581 |

Rincian: `D:/aleta-dev/kerja/audit-abt-4nov/C1/daftar-tambalan-ejaan.csv`; ringkas: `hasil/ringkas.txt`.
TIDAK disentuh: `isteri` (346; banyak di kutipan UU 1/1974 & KHI yang ejaan aslinya "isteri") - menunggu keputusan Derry.

## Dasar md5 (PRASYARAT)
Keadaan server SESUDAH `audit-mekanis-4nov`: 150 dari 581 berkas juga ditambal paket itu (md5 dasar = md5_baru paket itu); sisanya
= keadaan sesudah ijab-yang-menikahkan-3nov. Bila audit-mekanis belum terpasang -> `cek`: `GAGAL=150` -> `BERKAS TIDAK SIAP` -> BERHENTI
tanpa mengubah apa pun (diuji, butir 6). Satu saja dari 581 berkas berbeda -> BERHENTI.

## Pasang (Git Bash, server hidup; SESUDAH audit-mekanis-4nov `SELESAI`)
```bash
cd /d/.../abt-paket/audit-ejaan-4nov && rm -rf paket-satker/cadangan
ssh aleta 'mkdir -p /root/abt-audit-ejaan-20261104'
scp -r paket-satker/* aleta:/root/abt-audit-ejaan-20261104/
ssh aleta 'cd /root/abt-audit-ejaan-20261104 && md5sum -c MD5SUMS.txt | grep -v OK'     # harus kosong
ssh aleta 'bash /root/abt-audit-ejaan-20261104/pasang-satker.sh'
```
Keluaran benar: `SIAP=581`, `BERKAS SIAP`, `PRASYARAT COCOK`, `TAMBAL=581`, `BERKAS COCOK`, `SELESAI`. Pasang ulang: `SUDAH=581 ... SELESAI`.
Bila `GAGAL ... bukan dasar ...`: audit-mekanis belum terpasang atau blangko server berubah - jangan dipaksa; bangun ulang atas blangko
server terbaru (`python -B ../audit-mekanis-4nov/sumber/bangun_paket.py <_blangko_abt> paket-satker hasil K07 E`, lalu MD5SUMS dan uji).
Pulih: `ssh aleta 'bash /root/abt-audit-ejaan-20261104/pulih-satker.sh'` -> `PULIH=581`, `BERKAS PULIH`, `PULIH COCOK` (kembali ke
keadaan sesudah audit-mekanis; berkas yang disunting sesudah dipasang dibiarkan dan dilaporkan).

## Uji (laptop)
- `hasil/uji-lokal.txt` (`U=<salinan> SEBELUM_MEKANIS=<pohon sebelum audit-mekanis> bash sumber/uji_lokal.sh <pohon sesudah audit-mekanis>`):
  pasang, pasang ulang (sidik tetap), pulih (sidik = awal), pasang lagi, md5 berbeda -> berhenti tanpa ubahan, audit-mekanis belum
  terpasang -> berhenti tanpa ubahan, disunting lalu pulih -> dibiarkan.
- `hasil/pindai-sesudah.txt`: pindai ulang pohon sesudah audit-mekanis + paket ini - semua 43 pola = 0. md5 akhir 720 berkas kedua paket
  = md5 paket gabungan yang dirender (bukti render di `../audit-mekanis-4nov/PASANG.md`).
- Penjaga repo: `manajemen_surat/src/test/audit-ejaan-4nov.test.ts`.
