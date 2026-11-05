# Paket ABT `abt-prodeo-8507-5nov` - kata "Bahwa" hilang sesudah kalimat prodeo (5 Nov 2026)

**Status: dibangun dan diuji di LAPTOP atas salinan uji. Server: BELUM dipasang.** Hanya rumus variabel `#8507#` DUDUK PERKARA PRODEO, yang dipakai blangko **derry_briantono**. Tanpa berkas blangko, fungsi, menu, tabel, atau data perkara; tanpa kata nama aplikasi. Kolom `modified` tidak berubah.

Tidak bergantung pada paket blangko lain; hanya butuh rumus 8507 persis rumus lama (`modified` 12 Okt 2026).

## Masalah
Nilai prodeo berakhir `<br>`. ABT mengubahnya menjadi `\par ` lalu `trim()` di `cleanHtmlTagSpecial` membuang spasinya, sehingga `#8507#Bahwa` tercetak `\parBahwa`: pembaca RTF membuang kata itu dan paragraf tidak terpisah ("...cuma-cuma; , demi kepentingan ...").

Sebaran penanda di seluruh pohon (243 berkas, 243 kali):
| sesudah `#8507#` | berkas | akibat lama | sesudah paket |
|---|---|---|---|
| `Bahwa` | 154 | kata hilang, paragraf menyatu | benar |
| spasi lalu `Bahwa` | 23 | benar | sama |
| `}` | 66 | benar | sama |
| huruf lain | 0 | - | - |

## Perbaikan
Ujung rumus, satu tempat: `cuma-cuma;<br>")` -> `cuma-cuma;<br>", CONVERT(CHAR(92) USING utf8), "uc1")`. Hasil cetak: `cuma-cuma; \par 솺hwa`.

**Bukan spasi akhir seperti rancangan semula.** Rumus `<br>` + spasi dicoba: tetap `\parBahwa`, karena `trim()` membuang spasi itu (`hasil/render-banding.txt`, bagian percobaan). Nilai harus diakhiri sesuatu yang bukan spasi. `\uc1` dipilih karena: `\par` tetap diikuti satu spasi, `\uc1` adalah nilai bawaan RTF dan tidak mencetak huruf, `솺hwa` terbaca sebagai `\uc1` + `Bahwa`, `\uc1 Bahwa` tidak menambah spasi pada 23 berkas, dan `\uc1}` benar pada 66 berkas. `{}` ditolak karena jalur mesin ALETA rilis ini meloloskan kurung kurawal nilai menjadi teks tercetak; `</strong>` ditolak karena mematikan huruf tebal.
Garis miring ditulis `CONVERT(CHAR(92) USING utf8)`: tanpa escape baru di dalam string (`mariadb55-escape-fungsi`), jenis karakter hasil tetap utf8. Rumus berjalan saat dipakai, bukan badan fungsi; sidik memakai MD5 kolom, ditulis lewat heks.

Mesin ALETA (`aleta_bot/services/abtMesinVariabel.js`): rumus lolos `pagarBaca`, hasilnya `\par 솺hwa`, teks polos tanpa `\uc1` (`manajemen_surat/src/test/prodeo-8507-5nov.test.ts`). Jalur ini sudah memberi pembatas sendiri, jadi perbaikan ini hanya mengubah keluaran ABT.

## Dasar (PRASYARAT)
`A|B`: A = rumus persis rumus lama (md5 `0a3a264a0310d50d6d71bc6b5fc66c80`), B = rumus persis rumus paket (md5 `95a6487094847e1861016883387b7498`). Pasang pertama `1|0`, pasang ulang `0|1`. Rumus lama dibaca dari salinan server 3 Nov `aps_badilag_w206`, sama dengan `aps_badilag_vs`. Selain itu -> BERHENTI tanpa mengubah apa pun (diuji).

## Pasang (Git Bash, server hidup)
```bash
cd /d/.../abt-paket/prodeo-8507-5nov && rm -rf paket-satker/cadangan
ssh aleta 'mkdir -p /root/abt-prodeo-8507-20261105'
scp -r paket-satker/* aleta:/root/abt-prodeo-8507-20261105/
ssh aleta 'cd /root/abt-prodeo-8507-20261105 && md5sum -c MD5SUMS.txt | grep -v OK'     # harus kosong
ssh aleta 'bash /root/abt-prodeo-8507-20261105/pasang-satker.sh'
```
Keluaran benar: `PRASYARAT COCOK (1|0)`, `PERIKSA: SEMUA COCOK`, `SELESAI`. Pasang ulang: `PRASYARAT COCOK (0|1)`.
Pulih: `ssh aleta 'bash /root/abt-prodeo-8507-20261105/pulih-satker.sh'` -> `PULIH COCOK (1|0)`, rumus lama persis; rumus yang sudah diubah orang dibiarkan dan dilaporkan. Tidak perlu memulai ulang apa pun.

## Uji (laptop)
- `hasil/uji-lokal.txt`: pasang, ulang, pulih (seluruh tabel variabel termasuk `modified` = awal), pasang lagi, rumus berbeda -> berhenti, diubah lalu pulih -> dibiarkan.
- `hasil/render-banding.txt` (`alat/uji_render.py`, render ABT asli php56, salinan `vs30/abt` + `sipp_vs` + `aps_badilag_vs`, 124 perkara prodeo tersedia di salinan, tidak ada tulisan ke `sipp_donggala`): 18 blangko (cerai CG/CT tiga bentuk penanda, Hak Asuh, Kewarisan, Itsbat Kontensius) x prodeo dan non-prodeo, rumus lama dan baru. Prodeo `#8507#Bahwa`: "Bahwa, demi kepentingan ..." kembali sebagai paragraf baru, jumlah paragraf +1, teks lain sama. Dua bentuk lain: teks sama. Non-prodeo: 18 dari 18 sama persis per bita. Sisa `#NNNN#` 0.
- Blangko Hak Asuh dan Kewarisan dirender atas perkara cerai prodeo sebagai pengganti, karena di salinan tidak ada perkara prodeo jenis itu.
- Belum terbukti: MariaDB 5.5 sungguhan (salinan uji memakai MariaDB 10.4; yang dipakai hanya `CONVERT`, `CHAR`, `CONCAT` baku); tampilan di Word pada blangko selain yang dirender.
- Penjaga repo: `manajemen_surat/src/test/prodeo-8507-5nov.test.ts`.
