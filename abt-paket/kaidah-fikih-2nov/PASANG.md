# Paket ABT `abt-kaidah-fikih-2nov` - kaidah fikih di blangko putusan/penetapan akhir + syarat adil Izin Poligami [01b] (keputusan 104, 110, 120; 2 Nov 2026)

**Status: dibangun dan diuji di LAPTOP (server mati). Server: BELUM dipasang - dipasang sesi utama. URUTAN: KE-32, PALING AKHIR - sesudah
`identitas-pihak-1nov`** (lihat `../URUTAN-PASANG-1nov.md`). Hanya blangko **derry_briantono**; HANYA berkas RTF - tanpa variabel, menu, fungsi, atau tabel baru
(klaim variabel 12120-12139 TIDAK dipakai). md5 dasar = keadaan sesudah ke-31 paket. Revisi paket 31 di cabang `umur-bas-halaman` (b16c216f, tanpa umur)
hanya mengubah fungsi SQL - RTF paket 31 tidak berubah, jadi md5 dasar paket ini tetap sama (diuji: rantai 32 paket memakai paket 31 versi b16c216f).
Dibangun deterministik: `python sumber/bangun_paket.py <akar _blangko_abt sesudah 31 paket>` (dua kali membangun = MD5SUMS sama).

## Isi
Keputusan 110 (Derry): "kaidah fiqih seharusnya sudah ada di blangko, kalau tidak ada dicari lalu dibuatkan ke blangko; Pasal 119 ayat (2) KHI dipakai".

1. **Audit** 545 blangko putusan/penetapan akhir (di luar BAS, relaas, PTSP, sela): `hasil/audit.tsv` (kaidah/dalil yang SUDAH ada, dalil lewat variabel, jumlah
   "Pasal 119 ayat (2)", yang ditambah, alasan). 270 prosedural (NO/cabut/gugur/coret/ikrar) dan 10 bukan putusan akhir pokok perkara - tidak diisi.
   265 blangko pokok perkara: **114 sudah memuat kaidah/dalil yang sesuai** (termasuk Izin Poligami [01b]), **151 belum** (termasuk blangko kabul yang hanya
   memuat kaidah pembuktian bayyinah).
2. **Ditambah ke 84 blangko** - hanya kaidah yang kelazimannya terbukti di blangko Derry lain, putusan SIPP PA Donggala (`perkara_pertimbangan_hukum`
   sipp_2810), atau blangko ABT PA Donggala/PA Bungku; teks diambil PERSIS dari sumber itu (`hasil/kaidah.tsv`):

| kode | kaidah | dipakai untuk | blangko |
|---|---|---|---|
| BUKTI | Al Muhadzdzab Juz II hlm 320 - "Apabila Penggugat tidak mempunyai cukup bukti, maka gugatannya ditolak" (Arab + terjemahan persis blangko tolak cerai Derry) | penolakan karena dalil tidak terbukti | 28 |
| SHULHU | QS An-Nisa 128 "Dan perdamaian itu lebih baik" + HR at-Tirmidzi 1352 "ash-shulhu ja'iz" (persis CG [02b] Derry) | akta perdamaian | 14 |
| HADHANAH | hadits Abdullah bin Amr "kamu lebih berhak terhadap anak tersebut selama tidak menikah" (al-Majmu' Juz 20 hlm 223; Tuhfatul Habib Juz 4 hlm 475-476; blangko lama Derry di ABT PA Bungku, teks Arab tidak dibawa) | sesudah kalimat Pasal 105 huruf a KHI (anak belum mumayyiz) | 8 |
| NISA7 | QS An-Nisa 7 (terjemahan putusan SIPP P3HP 6/Pdt.P dan 31/Pdt.P) | kewarisan kabul, PAW [01b] [01c] | 6 |
| NISA19 | QS An-Nisa 19 mu'asyarah bil ma'ruf (rumusan variabel alasan D/8530 Derry) | kelalaian kewajiban suami istri kabul | 5 |
| NAFKAH_ANAK | al Hawi al Kabir juz 11 hlm 477 (Arab + terjemahan persis CT [02] Derry) | nafkah anak kabul | 5 |
| NISA32 | QS An-Nisa 32 (terjemahan putusan SIPP Harta Bersama 637/Pdt.G) | harta bersama kabul | 4 |
| FIRASY | hadits al-walad lil firasy, HR al-Bukhari dan Muslim (terjemahan putusan SIPP P3HP 186/Pdt.P; AUA 155/Pdt.P) | asal usul anak [01] [01a] [01b], pengesahan anak [01] | 4 |
| IANAT | I'anatuth Thalibin juz IV hlm 253-254 (Arab + terjemahan persis Itsbat Kontensius [01] Derry) | itsbat ditolak (CG/CT kumulasi itsbat [03b], IN kontensius [03b]) | 3 |
| NISA3 | QS an-Nisa (4) ayat 3 (kalimat persis Izin Poligami kabul Derry) | izin poligami ditolak | 3 |
| TASHARRUF | kaidah tasharruful imam 'alar ra'iyyah manuthun bil mashlahah (Arab + terjemahan persis 15 blangko itsbat Derry; putusan SIPP Perwalian 151/Pdt.P) | perwalian kabul, penunjukan wali [01p] | 3 |
| AHZAB5 | QS al-Ahzab 5 (terjemahan blangko ABT PA Donggala "Pengangkatan Anak") | pengangkatan anak kabul | 1 |

   Letak: sebelum kalimat simpulan (kabul/tolak), atau sesudah paragraf yang didukung (Pasal 105 huruf a KHI; nasab anak angkat; simpulan poligami), atau
   sebelum pertimbangan biaya/penguatan akta perdamaian. Format paragraf & huruf = paragraf jangkar di berkas itu sendiri; Arab rata kanan seperti blangko
   Derry; "Artinya :" menjorok gantung. Variabel majelis (#8554#/#8555#) dan pihak (#0046#/#7036#) mengikuti berkas.
3. **Izin Poligami [01b] (keputusan 120)**: kalimat simpulan dari "Pasal 5 ayat (1) huruf b dan huruf c UU 1/1974 jo. Pasal 55 ayat (2), Pasal 57, Pasal 58 ayat (1)
   huruf b dan Pasal 59 KHI" menjadi "Pasal 5 ayat (1) huruf b UU 1/1974 jo. Pasal 55 ayat (2), Pasal 57, Pasal 58 ayat (1) huruf b **Kompilasi Hukum Islam jo. Pasal 5
   ayat (1) huruf c Undang-Undang Nomor 1 Tahun 1974** dan Pasal 59 KHI" (bunyi Pasal 5 ayat (1) huruf c: "adanya jaminan bahwa suami akan berlaku adil terhadap
   isteri-isteri dan anak-anak mereka"; KHI Pasal 58 ayat (1) hanya huruf a dan b). Blangko poligami lain: [01] [01a] [03] [03a] [03b] mengutip "Pasal 5 ayat (1)
   UU 1/1974 jo. ... Pasal 58 ayat (1) dan (2) KHI" dan [01] [01a] [01b] mengutip syarat adil dengan "Pasal 5 ayat (1) huruf c UU 1/1974" - tidak keliru; tidak ada
   blangko lain (termasuk BAS) yang mengutip "Pasal 58 ayat (1) huruf c".
4. **Pasal 119 ayat (2) KHI** tidak disentuh: satu-satunya teks lama yang dibuang paket ini adalah " dan huruf c" di Izin Poligami [01b]; jumlah kemunculan
   "Pasal 119 ayat (2)" diperiksa sama sebelum/sesudah di tiap berkas (pembangun berhenti bila berubah).
5. **Tidak diisi - perlu Derry (67 blangko)**: jenis tanpa kaidah lazim berbukti setempat, atau kaidah harus mengikuti petitum/alasan (`hasil/audit.tsv` kolom
   keterangan "PERLU DERRY ..."; ringkasan dan usulan di `D:/aleta-dev/kerja/kaidah-fikih-2nov.md`).

Total **85 blangko, 86 potongan** (`paket-satker/daftar-tambal.tsv`, `tambal.tsv`; `hasil/rincian.tsv`). Sisipan ASCII murni (huruf non-ASCII sebagai `\uN`).
Satu berkas simpanan Word (Pengangkatan Anak [01]) memuat beberapa paragraf dalam satu grup run - sisipan di sana berada di dalam grup itu dan format
paragraf jangkar diulang sesudahnya (diuji render).

## Pasang / pulih (server, root; SESUDAH identitas-pihak-1nov)
```bash
cd /d/.../abt-paket/kaidah-fikih-2nov && rm -rf paket-satker/cadangan
ssh aleta 'mkdir -p /root/abt-kaidah-fikih-20261102'; scp -r paket-satker/* aleta:/root/abt-kaidah-fikih-20261102/
ssh aleta 'cd /root/abt-kaidah-fikih-20261102 && md5sum -c MD5SUMS.txt | grep -v OK'      # harus kosong
ssh aleta 'bash /root/abt-kaidah-fikih-20261102/pasang-satker.sh'
ssh aleta 'bash /root/abt-kaidah-fikih-20261102/pulih-satker.sh'                            # PULIH COCOK
```
Keluaran benar:
```
SIAP=85
BERKAS SIAP
TAMBAL=85
BERKAS COCOK
SELESAI - paket abt-kaidah-fikih-2nov terpasang (85 blangko). ...
```
- PRASYARAT: 85 berkas persis md5 dasar (atau sudah terpasang: `SUDAH=85`). Satu saja berbeda -> berhenti TANPA mengubah apa pun.
- PASANG: berkas lama disalin ke `cadangan/rtf-lama/<kode>.rtf` (md5 diperiksa) sebelum ditimpa atomik; PERIKSA md5 baru; gagal = semua dikembalikan.
- PULIH: berkas dikembalikan HANYA bila isinya masih persis isi paket (yang sudah disunting orang dibiarkan dan dilaporkan); tanpa hapus permanen.
  Pulihkan paket ini SEBELUM paket sebelumnya.

## Uji (laptop)
- `hasil/uji-lokal.txt` (`sumber/uji_lokal.sh`, salinan pohon sesudah 31 paket): pasang, pasang ulang (tidak mengubah apa pun), pulih (= pohon dasar persis),
  pasang lagi (= pasang pertama), penjaga 1 (berkas disunting sesudah dipasang -> pulih membiarkannya), penjaga 2 (dasar disunting -> pasang menolak tanpa mengubah apa pun).
- Uji rantai 32 paket: `sumber/rantai180.sh` -> `../uji-rantai-31okt/hasil-rantai-32.txt`: 32 paket SELESAI (paket 31 = revisi umur-bas-halaman 9645d496, TAMBAL=610), paket ini `SIAP=85 ... TAMBAL=85 BERKAS COCOK SELESAI`, `RANTAI-KELUAR 0`; pohon rantai berbeda dari uji lokal HANYA pada 2 berkas BAS LAINNYA milik paket 31 revisi.
- Render sungguhan (renderer ABT php56, `alat/render180.py` + `alat/jalan180.py`): `hasil/render.md`; RTF/PNG di `D:/Aplikasi/aleta/tmp/w180/render/`
  (memuat nama pihak sungguhan: TIDAK masuk repo, TIDAK dikirim keluar).
- Penjaga isi paket: `manajemen_surat/src/test/paket-kaidah-fikih-2nov.test.ts`.
