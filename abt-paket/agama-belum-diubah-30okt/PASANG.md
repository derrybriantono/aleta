# Paket ABT `abt-agama-belum-diubah-30okt` - bunyi "agama pihak belum diubah di SIPP" (30 Okt 2026, G1)

**Status: diuji di basis salinan laptop (`aps_badilag_g1` = salinan `aps_badilag_bas29`, sudah memuat paket alasan-belum-dipilih-30okt).
Server: BELUM dipasang - dipasang sesi utama. URUTAN: SESUDAH `alasan-belum-dipilih-30okt`.**

Rencana gelombang 1 "Blangko ABT by Derry Briantono" (disetujui pengguna) butir 1.3: cabang "alasan H (murtad) dipilih tetapi agama
pihak di SIPP belum diubah" pada 4 variabel alasan perceraian berbunyi

    TIDAK BENAR QUERY NYA / ALASAN H: AGAMA PIHAK YANG MURTAD BELUM DIUBAH DI SIPP - ubah agama pihak itu di SIPP, lalu muat ulang ABT

dan kalimat itu ikut tercetak di putusan. Diganti menjadi **`[AGAMA PIHAK YANG MURTAD BELUM DIUBAH DI SIPP]`** (tetap berstabilo
`<mark>`). Petunjuk perbaikannya ("ubah agama pihak itu di SIPP, lalu muat ulang") pindah ke ekstensi: butir di "Periksa sebelum cetak"
Blangko Derry. Bentuk kurung siku sama dengan paket alasan-belum-dipilih-30okt, sehingga pemeriksa sisa blangko sebelum cetak
(`deteksi-sisa-blangko.js`) menandainya tanpa ubahan.

## Isi
- 4 variabel modifier=admin (paket Derry): 8521, 8522, 8528, 8531. Per variabel TEPAT SATU kemunculan frasa lama (diperiksa saat bangun)
  diganti; cabang lain (termasuk "[HURUF ALASAN PERCERAIAN BELUM DIPILIH]") tidak disentuh.
- Keluaran berubah HANYA pada perkara yang jatuh ke cabang itu (8503 memuat H dan agama pihak di SIPP belum berubah).
- PRASYARAT: md5 kueri 4 variabel (nama basis dinormalkan) = sesudah paket alasan-belum-dipilih-30okt `4|0`; pasang ulang `0|4`.
  Basis tanpa paket alasan-belum-dipilih menjawab `0|0` -> berhenti tanpa mengubah apa pun (diuji atas `aps_badilag_2810`).
- PULIH: frasa lama dikembalikan, md5 sama persis dengan sebelum paket. Bila paket alasan-belum-dipilih-30okt juga dipulihkan:
  pulihkan paket INI lebih dulu (prasyarat paket itu memeriksa md5 yang sama).

## Pasang / pulih (server, root, dari `paket-satker`)
```
bash pasang-satker.sh   # md5 -> PRASYARAT 4|0 -> cadangan 4 baris abt_variabel (mysqldump) -> PASANG (1 transaksi) -> PERIKSA
bash pulih-satker.sh    # -> PRASYARAT 4|0 = "PULIH COCOK"
```
Laptop: `ABT_LOKAL=1 ABT_DB=<basis salinan> bash pasang-satker.sh`.

## Ekstensi (cabang g1-cegah-salah)
- `abt-panel-blangko.js`: `FRASA_GALAT` dan penyorot pratinjau mengenali bunyi baru di samping bunyi lama.
- `blangko-derry-periksa.js` (Periksa sebelum cetak): bunyi baru dan lama -> butir "agama pihak di SIPP belum diubah".
- Uji: `manajemen_surat/src/test/g1-cegah-salah-30okt.test.ts` bagian 1.3.

## Hasil (`hasil/`)
- `uji-lokal.txt`: pasang -> PERIKSA -> variabel lain (2.681) tak berubah -> pulih (md5 4 variabel = sebelum) -> pasang lagi -> pasang ulang
  (0|4) -> jalur gagal (basis tanpa paket alasan: `0|0`).
- `render-ringkasan.json`: render php56 ABT asli (lihat di bawah).

## Bangun ulang
`python sumber/bangun_paket.py <basis salinan sesudah alasan-belum-dipilih-30okt>`; deterministik.
