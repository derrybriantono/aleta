# Paket ABT `abt-alasan-belum-dipilih-30okt` - bunyi "huruf alasan belum dipilih" (30 Okt 2026)

**Status: diuji di basis salinan laptop (`aps_badilag_bas29`). Server: BELUM dipasang - dipasang sesi utama. Urutan bebas.**

**Keputusan pengguna 30 Okt: DISETUJUI** - cabang terakhir (ELSE) 10 variabel alasan perceraian A-H yang berbunyi
"TIDAK BENAR QUERY NYA" saat isian huruf alasan (8503) kosong atau bukan A-H diganti menjadi
**"[HURUF ALASAN PERCERAIAN BELUM DIPILIH]"** (tetap berstabilo `<mark>`). Bersamaan: ekstensi mengenali bunyi BARU dan LAMA.

## Isi
- 10 variabel modifier=admin (paket Derry): 4020, 8511, 8512, 8521, 8522, 8528, 8529, 8530, 8531, 8532. Per variabel TEPAT SATU
  cabang ELSE diganti (diperiksa saat bangun: `"<mark>TIDAK BENAR QUERY NYA</mark>"` atau
  `"<mark>TIDAK BENAR QUERY NYA / BELUM ISI ALASAN DI KOLOM ABT</mark>"`). Cabang lain - termasuk
  "TIDAK BENAR QUERY NYA / ALASAN H: AGAMA PIHAK YANG MURTAD BELUM DIUBAH DI SIPP" (8521, 8522, 8528, 8531) - TIDAK disentuh.
- Keluaran variabel berubah HANYA pada perkara yang jatuh ke cabang itu (huruf alasan kosong/tidak dikenali); perkara dengan huruf
  sah tidak berubah (teks kueri selain literal cabang itu sama persis).
- PRASYARAT: md5 kueri 10 variabel (nama basis dinormalkan) = sebelum paket `10|0`; pasang ulang `0|10`. PULIH: frasa lama
  dikembalikan per variabel, diperiksa md5 sama persis dengan sebelum paket.

## Pasang / pulih (server, root, dari `paket-satker`)
```
bash pasang-satker.sh   # md5 -> PRASYARAT 10|0 -> cadangan 10 baris abt_variabel (mysqldump) -> PASANG (1 transaksi) -> PERIKSA
bash pulih-satker.sh    # -> PRASYARAT 10|0 = "PULIH COCOK"
```

## Ekstensi (commit yang sama)
- `abt-panel-blangko.js`: `FRASA_GALAT` dan penyorot naskah mengenali bunyi baru di samping bunyi lama.
- `blangko-derry-isian.js`: peringatan di bawah kotak huruf alasan menyebut bunyi baru (dan bunyi lama untuk ABT yang belum diperbarui).
- Pemeriksa sebelum cetak (`deteksi-sisa-blangko.js`) sudah menandai bunyi baru sebagai "kurung siku yang belum diganti" (tanpa ubahan).
- Uji: `manajemen_surat/src/test/alasan-belum-dipilih-30okt.test.ts`.
- BELUM diubah (teks penjelasan, bukan pengenal): kalimat-kalimat di `abt-panel-blangko.js` yang MENYEBUT bunyi lama dalam pesan
  kepada petugas (mis. "... berbunyi \"TIDAK BENAR QUERY NYA\" dan kalimat itu ikut tercetak") - masih benar untuk server lama,
  perlu diperbarui menyebut bunyi baru sesudah paket terpasang di server.

## Hasil (`hasil/`)
- `uji-lokal.txt`: pasang -> PERIKSA -> pulih (md5 10 variabel = sebelum, sama persis) -> pasang lagi.
- Render php56 ABT asli 9730 (274/Pdt.G/2026, cerai talak, isian huruf alasan kosong) dengan blangko
  `1a Perceraian CT/[01] [Kabul Verstek] Cerai (Format Lengkap).rtf`: "[HURUF ALASAN PERCERAIAN BELUM DIPILIH]" 7 kali,
  "TIDAK BENAR" 0 kali; penanda tersisa 0.
