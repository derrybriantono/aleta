# Paket ABT `abt-titik-koma-30okt` - titik koma hanya di akhir butir (30 Okt 2026)

**Status: diuji di basis salinan laptop (`aps_badilag_bas29` = dump server 28 Okt 15.44 + ket-saksi-kata + ket-saksi-baris + bukti-nomor). Server: BELUM dipasang - dipasang sesi utama.**

**URUTAN: SESUDAH `../ket-saksi-kata-30okt` dan `../bukti-nomor-30okt`** (PRASYARAT A/B memeriksa definisi kedua fungsi yang
ditinggalkan dua paket itu; belum terpasang = berhenti tanpa mengubah apa pun).

## Keputusan pengguna 30 Okt
"jangan sampai ada di blangko ABT by Derry Briantono di tengahnya ada ; (contoh di keterangan saksi di tengahnya ada ; , seharusnya
ini di belakang)". Aturan: ";" hanya di AKHIR butir; ";" di tengah jadi ","; tanpa ";;", ",;", ";.", spasi sebelum tanda baca.

## Isi (hanya PERANGKAI; tidak ada variabel, blangko RTF, atau data tersimpan yang diubah)
- Fungsi baru `isian_rtf_butir_rapi(t, ujung)`: satu butir dirapikan - ganti baris/tab/`<br>` jadi spasi, spasi ganda, spasi sebelum
  `; , : .` dibuang, tanda baca ganda (`;;` `,;` `;,` `;.` `,.`, "polisi.,") jadi satu, **";" yang masih diikuti huruf/angka jadi ","**,
  tanda butir "- " sesudah titik dua/titik koma dibuang ("karena :- A;- B;" -> "karena: A, B;"), spasi sesudah tanda baca
  ("tahu,karena" -> "tahu, karena"; angka 2,5 / 10:30 / Rp 100.000,- tetap), entitas `&quot;` tidak disentuh. `ujung = ';'`: butir
  diakhiri satu ";" (titik akhir kata -> ";"; singkatan S.H./dll. tetap; tanda tanya tetap).
- `isian_rtf_ket_saksi` (keterangan saksi putusan, variabel 9259-9265): tiap jawaban `isian_rtf_butir_rapi(t, ';')` sesudah penggantian
  kata; jawaban yang habis (mis. hanya ";") tidak dicetak. Selain itu sama persis dengan versi ket-saksi-kata.
- `isian_rtf_bukti` (daftar bukti, variabel 11170-11177): tiap butir `isian_rtf_butir_rapi(butir, '')` (ujung dibiarkan). Selain itu sama
  persis dengan versi bukti-nomor.
- Sidik definisi (PRASYARAT) tahan beda klien/versi: tanpa komentar (dibuang klien mysql), tanpa garis miring terbalik (escape literal
  diolah server), tanpa spasi/ganti baris. Diuji di salinan: A/B cocok untuk definisi yang dipasang dua paket dasar.

## Pasang / pulih (server, root, dari folder `paket-satker`)
```
bash pasang-satker.sh     # md5 paket -> PRASYARAT 1|1|0|0|0 -> cadangan SHOW CREATE kedua fungsi -> FUNGSI -> PERIKSA (34 vektor + pemanggil)
bash pulih-satker.sh      # definisi lama persis (sidik), fungsi baru dihapus -> PRASYARAT 1|1|0|0|0 = "PULIH COCOK"
```
Pasang ulang aman (`0|0|1|1|1` = hanya PERIKSA). Laptop: `ABT_LOKAL=1 ABT_DB=<salinan> bash pasang-satker.sh`.

## Panel (ekstensi) - aturan kembar
`rapiButir` di `ekstensi-sipp/blangko-derry-saksi.js` = kembaran persis fungsi ini; vektor uji SATU berkas (`sumber/vektor-rapi.json`)
dipakai PERIKSA paket dan uji ekstensi (`blangko-derry-isian-rapi-30okt.test.ts`). Banding kembar atas data nyata: 99.029 nilai
(seluruh jawaban saksi + isian teks 2026) JS = SQL (lihat hasil/).

## Banding (lihat `hasil/`)
- `hasil/uji-lokal.txt`: pasang -> banding seluruh kelompok saksi dan seluruh isian bukti -> pulih (sama persis dengan lama) -> pasang lagi.
- `hasil/banding-ringkas.txt`: golongan beda; PENJAGA = urutan huruf dan angka sama persis (paket hanya mengubah tanda baca/spasi).
- `hasil/render-*.json`: render php56 ABT asli sebelum/sesudah untuk perkara contoh.

## Yang TIDAK diubah paket ini (perlu keputusan terpisah)
- **Tabel tanya jawab BAS** dicetak PHP ABT apa adanya dari `abt_keterangan_saksi` - ";" di tengah jawaban tersimpan (513 jawaban,
  237 perkara di dump 28 Okt) tetap tercetak di BAS sampai DATA-nya dirapikan. Panel kini menyimpan jawaban baru sudah rapi; merapikan
  data lama = ubahan data (seperti ket-saksi-baris) dan belum disetujui.
- **Isian teks (data_teks) ABT** dicetak apa adanya (nl2br). Panel kini menyimpannya rapi; data lama tidak diubah.
- **Teks blangko RTF sendiri**: `hasil/pindai-templat-ringkas.txt` - 1.823 ";" diikuti teks dalam satu paragraf di 703 berkas aktif
  (mis. "telah hadir in person; #8509#", kutipan Pasal 7 ayat (3) KHI "(b) ...; (c) ..."), 234 sesudah penanda. Sebagian besar disusul
  variabel kalimat/paragraf atau kutipan peraturan; tidak dapat diganti mekanis tanpa menilai tiap kalimat.
