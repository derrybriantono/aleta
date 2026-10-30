# Paket ABT `abt-sela-ps-30okt` - putusan sela semua jenis + BAS pemeriksaan setempat (30 Okt 2026)

**Status: dibangun dan diuji di LAPTOP (server mati). Server: BELUM dipasang - dipasang sesi utama. URUTAN PASANG: PALING AKHIR**
(sesudah `prodeo-panggilan-29okt` -> `bas-tanya-jawab-29okt` -> `ket-saksi-kata-30okt` -> `relaas-penetapan-30okt` -> `sampul-rapi-30okt`).

Permintaan Derry 30 Okt ±09.35: BAS pemeriksaan setempat, dan putusan sela di bab baru terpisah dari putusan, untuk semua jenis putusan sela dan
semua statusnya. Hanya pengguna **derry_briantono**. Tanpa kata nama aplikasi, tanpa nama satker tertulis mati (identitas dari variabel satker).

## Isi

| bagian | isi |
|---|---|
| menu 151 `Putusan Sela (Eksepsi, Provisi, Intervensi, Sumpah, Pemeriksaan Setempat)` (alias `Putusan Sela - Putusan`), folder BARU `97a Putusan Sela` | 15 blangko (matriks di bawah). Hak = menu 150 `97 Sita`: proses 80-297, alur 15-17, cek 3, grup `1\|10\|20`, top `1` |
| menu 152 `Putusan Sela - BAS` (alias sama), folder BARU `97a Putusan Sela - BAS` | 3 BAS: sidang insidentil (eksepsi/provisi/intervensi), pembacaan putusan sela (amar dari SIPP #9160#), pengucapan sumpah pelengkap. Hak = menu BAS: grup `1\|30\|500\|430\|1000\|1010\|1020`, top `1\|30`, validator `10\|20`, alur 15-17 |
| BAS pemeriksaan setempat | `4a Harta Bersama - BAS` dan `4b Kewarisan - BAS`: berkas `BAS ALUR 30/32 ... Sidang PS ...` DITIMPA (md5 lama `2a660b99...` = pohon server perkiraan; tidak disentuh paket 29-30 Okt lain). BARU: `4c Wasiat - BAS` (ALUR 42), `4d Hibah - BAS` (47), `4e Wakaf - BAS` (48), `10a Ekonomi Syariah Biasa - BAS` (43). Isi sama untuk keenamnya |
| 70 variabel baru 11300-11369 | blok 11300-11499 diklaim paket ini (kosong di `aps_badilag_2810` dan di semua paket w12*/w13*). ACARA 11300-11309 = SATU-SATUNYA tempat rujukan pasal RBg (padanan HIR dicatat di nama variabel, belum dipakai) |

Sita (jaminan/marital/revindikasi) TETAP di `97 Sita` [01]/[02] (menu 150) - tidak diduplikasi (lihat pertanyaan 1).

### Matriks putusan sela jenis x status (folder `97a Putusan Sela`)

| jenis | dikabulkan | ditolak / lainnya |
|---|---|---|
| eksepsi kewenangan absolut | [02] PUTUSAN akhir: tidak berwenang, biaya putusan akhir (#11319# pertimbangan per jenis + prodeo DIPA, amar #11122# prodeo, rincian #11130#..) | [01] PUTUSAN SELA: berwenang, pemeriksaan dilanjutkan, biaya ditangguhkan |
| eksepsi kewenangan relatif | [04] PUTUSAN akhir: tidak berwenang (+ pengadilan yang berwenang, isian 11317) | [03] PUTUSAN SELA: dasar menurut jenis (CG Ps 73 (1), CT Ps 66 (2) UU 7/1989, lainnya #11303#) |
| tuntutan provisi | [05] amar tindakan sementara isian 11324 | [06] |
| intervensi voeging | [07] kedudukan #11335# (bergabung ke P/T: isian 11333 atau SIPP) | [08] |
| intervensi tussenkomst | [09] Penggugat Intervensi vs Tergugat Intervensi I/II | [10] |
| intervensi vrijwaring | [11] kedudukan #11337# (bawaan Tergugat Intervensi - usulan) | [12] |
| sumpah pelengkap (suppletoir) | [13] gugatan: putusan sela; [14] permohonan: PENETAPAN SELA / MENETAPKAN | (satu status: diperintahkan) |
| pemeriksaan setempat | [15] perintah PS: lokasi #9165#, waktu = sidang berikutnya SIPP | (satu status) |
| sita jaminan/marital/revindikasi | `97 Sita` [01] (tidak diubah) | `97 Sita` [02] |

Semua putusan sela yang pemeriksaannya berlanjut: "Menangguhkan biaya perkara sampai dengan putusan (penetapan) akhir" + pertimbangan Pasal 89 ayat (2)
UU 7/1989; kaki #11311# (majelis/tunggal, kehadiran pada SIDANG YANG DICETAK, e-Court = dikirim elektronik); TTD #8500#; identitas #7047# / #7048##8710##7054#
(pihak banyak, turut tergugat, intervensi). Isian yang dipakai tidak langsung (lewat variabel OTOMATIS) dimasukkan ke kelompok tersembunyi `{\*\isianasal ...}`
agar tampil di borang ABT.

## Pasang (Git Bash, server hidup) - SESUDAH semua paket 29-30 Okt lain

```bash
cd /d/.../abt-paket/sela-ps-30okt                   # folder repo hasil gabung
rm -rf paket-satker/cadangan                        # cadangan uji laptop (bila ada) jangan ikut tersalin
ssh aleta 'mkdir -p /root/abt-sela-ps-20261030'
scp -r paket-satker/* aleta:/root/abt-sela-ps-20261030/
ssh aleta 'cd /root/abt-sela-ps-20261030 && md5sum -c MD5SUMS.txt | grep -v OK'     # harus kosong
ssh aleta 'bash /root/abt-sela-ps-20261030/pasang-satker.sh'
```

Keluaran benar: `PRASYARAT COCOK (0|0|79|0|0|2)`, `SIAP_TIMPA=2`, `BERKAS SIAP`, `CADANGAN ...`, `SEMUA COCOK`, `uji perkara ...: 46 kueri COCOK` (x6, perkara dipilih dari SIPP server sendiri),
`FOLDER BARU ...` (x2), `BUAT=22 TIMPA=2`, `COCOK=24`, `BERKAS COCOK`, `TANPA KATA NAMA APLIKASI`, `SELESAI`. Pasang ulang: `PRASYARAT COCOK (0|70|79|0|2|2)`, `SUDAH=24`.

PRASYARAT `A|B|C|D|E|F` = nomor 11300-11499 berisi lain (0) | variabel paket persis (0/70) | variabel lama dirujuk ADA (79, termasuk 11122/11123/11130-11140 paket
prodeo - **tanpa prodeo terpasang C < 79, paket berhenti**) | menu 151/152 berisi lain / folder paket dipakai menu lain (0) | menu paket persis (0/2) | fungsi
`isian_rtf_tanggal` + `isian_rtf_alamat` (2). RTF: dua berkas yang ditimpa harus md5 persis `md5_lama`; folder baru tidak boleh sudah ada.

Pulih: `ssh aleta 'bash /root/abt-sela-ps-20261030/pulih-satker.sh'` -> akhir `PULIH COCOK`. **Tidak ada hapus permanen:** 22 berkas baru dipindah ke
`cadangan/pulih-arsip/`, 2 berkas yang ditimpa dikembalikan dari `cadangan/timpa-asal/` (isi paket juga disalin ke arsip), folder baru dilepas bila kosong,
isian perkara (abt_data_teks) nomor paket dicadangkan ke `cadangan/abt_data_teks-pulih-<waktu>.sql` SEBELUM variabel dihapus (FK cascade).

Bangun ulang (deterministik): `python sumber/bangun_paket.py <pohon derry_briantono sesudah prodeo>` (bawaan `D:/Aplikasi/aleta/tmp/bas29/dasar3/derry_briantono`).

## Hasil uji

- **Pasang/pulih laptop** (`sumber/uji_lokal.sh semua`; basis sendiri `aps_badilag_sela30` = dump server 28 Okt + paket prodeo-panggilan-29okt terbaru w125;
  pohon uji `D:/Aplikasi/aleta/tmp/sela30/blangko`): PRASYARAT `0|0|79|0|0|2` -> `SEMUA COCOK`, uji kueri 6 perkara x semua kueri baru COCOK, `BUAT=22 TIMPA=2`,
  `COCOK=24`; pasang ulang tanpa perubahan apa pun; pulih -> `ARSIP=22 KEMBALI=2`, `PULIH COCOK`, keadaan awal PERSIS (sidik menu, variabel, pohon) dan
  24 berkas di `cadangan/pulih-arsip` (tidak ada hapus permanen); pasang lagi = sidik pasang pertama; penjaga: menu 151 dipakai lain -> `0|0|79|1|0|2`
  BERHENTI tanpa perubahan; berkas yang akan ditimpa disunting -> `BERKAS TIDAK SIAP` BERHENTI tanpa perubahan. Pelajaran yang diperbaiki saat uji:
  `abt_variabel.nama` maksimal 200 huruf (dijaga pembangun) dan `referensi` bertipe angka (tanya-jawab).
- **Render renderer php56 ABT asli** (`alat/render.py`, salinan ABT CLI `D:/Aplikasi/aleta/tmp/sela30/abt`, SIPP salinan sendiri `sipp_sela30` dari dump
  `sipp_2810`): 0 galat render, 0 sisa `#nnnn#`; dibaca baris demi baris (`alat/periksa.py`). Isian dicoba seperti petugas (`alat/isian_simulasi.sql`, hanya basis salinan):
  - eksepsi absolut [01]/[02]: 546/Pdt.G/2024 (kewarisan 2 P x 1 T, berkuasa, e-Court; perkara nyata dengan eksepsi absolut) - [02] amar biaya "Membebankan kepada
    para Penggugat ... Rp169.500,00 (...)", pertimbangan Pasal 192 ayat (1) RBg (bukan bidang perkawinan), rincian prodeo-aware;
  - eksepsi relatif [03] 419/Pdt.G/2026 (cerai gugat kontradiktoir: Pasal 73 ayat (1)); [04] 517/Pdt.G/2026 (cerai talak: Pasal 66 ayat (2), "yang berwenang adalah
    Pengadilan Agama Palu", Pasal 89 ayat (1) dibebankan kepada Pemohon); [04] 675/Pdt.G/2026 prodeo -> dibebankan kepada DIPA ... Tahun 2026;
  - provisi [05] cerai gugat (Pasal 78 UU 7/1989 + PP 9/1975 + KHI), [06] harta bersama 308/Pdt.G/2026 (SEMA 3/2000 + #11308#);
  - intervensi [07]/[08] 308/Pdt.G/2026 (HB + Turut Tergugat), [09]/[10] 620/Pdt.G/2025 (kewarisan), [11]/[12] 687/Pdt.G/2025 (wasiat, 1 P x 7 T) -
    SIPP tidak punya satu pun pihak intervensi (perkara_pihak3 kosong), identitas dari isian 11326;
  - sumpah [13] 167/Pdt.G/2026 (cerai gugat verstek, putusan sela sumpah nyata 21 Apr 2026): "Telah mendengar keterangan Penggugat", "dengan dihadiri oleh
    Penggugat di luar hadirnya Tergugat"; [14] 42/Pdt.P/2026 (itsbat 2 Pemohon, hakim tunggal, sela sumpah nyata): PENETAPAN SELA, MENETAPKAN, "Demikian ditetapkan Hakim ...";
  - pemeriksaan setempat [15] 106/Pdt.G/2023 (kewarisan 9 P x 4 T, putusan sela PS nyata 30 Mei 2023): waktu PS = sidang berikutnya SIPP (12 Juni 2023 09.40);
  - BAS sela [1] insidentil / [2] pembacaan (amar putusan sela SIPP 308/Pdt.G/2026 tercetak) / [3] sumpah (167/Pdt.G/2026, 42/Pdt.P/2026);
  - BAS PS: 620/Pdt.G/2025 sidang 11 (PS nyata; tanya-jawab Penggugat dan Tergugat, aparat desa, petugas pertanahan, kesimpulan "sebagian sesuai ... yaitu luas objek 1
    sekitar 2.400 m2"), 637/Pdt.G/2025 (HB, PS nyata), 286/Pdt.G/2023 (HB, PS nyata), 687/Pdt.G/2025 (wasiat), 491/Pdt.G/2022 (pengganti hibah - tidak ada
    perkara hibah/wakaf/ES acara biasa yang di-PS; isi BAS sama untuk keenam folder);
  - `97 Sita [02]` (tidak diubah) 308/Pdt.G/2026 dibaca sebagai bagian matriks.
  - Ditemukan dan diperbaiki saat membaca: kaki halaman penetapan sela tertulis "Putusan Sela Nomor" -> "Penetapan Sela Nomor"; BAS sela permohonan mencetak
    "melawan ..., sebagai ..." -> identitas BAS #11368# (permohonan tanpa melawan, pihak banyak bernomor); agenda tunda dari alasan tunda yang salah ketik di SIPP
    ("untuk pembacaan putusan sela" pada sidang pembacaan itu sendiri) -> diutamakan AGENDA sidang berikutnya.
- **Repo**: `npx vitest run src/test/sela-ps-30okt.test.ts` 17/17; `alur-bas-baru.test.ts`, `rekomendasi-blangko-q3.test.ts`, `rekomendasi-status-keterangan-27okt.test.ts`,
  `sidang-keadaan-rekomendasi-q3.test.ts` hijau; `tsc --noEmit` bersih.
- **Saran blangko (portal; Blangko ABT by Derry memakai saran portal)**: `lib/rekomendasi-blangko.ts` - agenda/keterangan sidang "sumpah (pelengkap|tambahan|suppletoir)" ->
  [13]/[14] + BAS SELA [3]; "provisi" -> [05]/[06]; "intervensi/voeging/tussenkomst/vrijwaring" -> [07]-[12]; "putusan sela ... eksepsi/kompetensi (relatif)" ->
  [01]/[03] (+ dikabulkan [02]/[04] + blangko lama jenisnya [98e]/[98f] sebagai alternatif); "putusan sela ... setempat" -> [15]; penanda eksepsi bot pada jenis tanpa
  blangko sela sendiri -> bab 97a; BAS "pembacaan putusan sela" (bukan sita, bukan HB/waris) -> BAS SELA [2], "insidentil" (bukan sita) -> BAS SELA [1].
  `lib/alur-bas-baru.ts` + data: agenda "setempat" pada wasiat/ES acara biasa/hibah/wakaf -> langkah PS (HB/waris sudah). Ekstensi tidak diubah (tidak perlu rilis).

## Pertanyaan hukum untuk pengguna

1. **Sita**: tetap di `97 Sita` (menu 150) seperti sekarang, atau dipindah ke bab 97a supaya semua putusan sela satu bab? Usulan: tetap (sudah tersambung PHS sita dan BAS insidentil HB/waris).
2. **Blangko sela lama per jenis** `[98e]/[98f]` (CG, CT, HB, waris): memuat "Rincian Biaya Perkara" pada putusan sela, kepala "telah menjatuhkan putusan dalam perkara ...",
   dan `[98f] CG` memakai #0047# (bukan #7037#). Usulan: dipindah ke `terhapus` sesudah bab 97a dipakai (paket ini TIDAK menyentuhnya; saran portal mendahulukan 97a).
3. **Eksepsi kewenangan dikabulkan** dibuat sebagai PUTUSAN akhir (kode `[NO]`, status SIPP Tidak Dapat Diterima): "Mengabulkan eksepsi ...; Menyatakan PA ... tidak berwenang ...; biaya".
   Perlu butir "Menyatakan gugatan ... tidak dapat diterima"? Usulan: tidak (mengikuti [99c]/[99d] lama).
4. **Pasal putusan sela** (padanan RBg untuk Pasal 185 HIR: 196 atau 190?) sengaja TIDAK dikutip karena belum pasti. Bila dikehendaki, sebutkan pasalnya - cukup satu variabel ACARA baru.
5. **Provisi**: dasar cerai talak = PP 9/1975 Pasal 24 ayat (2) + KHI Pasal 136 ayat (2) (Pasal 78 UU 7/1989 hanya untuk cerai gugat); jenis lain = Pasal 191 ayat (1) RBg + SEMA 3/2000
   (variabel 11308/11323 bertanda USULAN). Benar? Provisi yang diputus bersama putusan akhir ("Dalam Provisi") tidak dibuat di sini.
6. **Intervensi**: kedudukan bawaan voeging = Penggugat/Tergugat Intervensi menurut pihak yang digabungi, tussenkomst = Penggugat Intervensi lawan Tergugat Intervensi I/II, vrijwaring =
   Tergugat Intervensi (isian 11332 menimpa). Benar? Bila ditolak, biaya ditangguhkan (bawaan) atau dibebankan kepada Pemohon Intervensi? Pemohon intervensi baru ikut di kaki putusan bila dicatat di SIPP.
7. **Sumpah pelengkap**: lafal bawaan "Demi Allah, saya bersumpah bahwa apa yang saya dalilkan dalam surat gugatan/permohonan saya adalah benar, tidak lain dari yang sebenarnya" (agama lain
   "Saya bersumpah ..."); permohonan = PENETAPAN SELA / MENETAPKAN. Benar? Sumpah sering diucapkan lalu diputus hari itu juga - perlu varian BAS "sumpah lalu putusan" (BAS [3] sekarang menunda)?
8. **Mediasi tidak beriktikad baik** (PA Donggala pernah sebagai putusan sela, 687/Pdt.G/2025): PERMA 1/2016 Pasal 23 menyebut penetapan. TIDAK dibuat - bentuk mana yang dikehendaki?
9. **Tidak dibuat** (dianggap tidak lazim atau diputus bersama pokok, Pasal 162 RBg): eksepsi lain (kabur, kurang pihak, error in persona), rekonvensi, sumpah penaksir/pemutus, penggabungan/pemisahan perkara. Ada yang perlu?
10. **Biaya putusan akhir eksepsi dikabulkan**: jenis 341-363 dan 743 = bidang perkawinan (Pasal 89 ayat (1)); Lain-Lain 369 (hak asuh, pengangkatan anak) diperlakukan Pasal 192 ayat (1) RBg. Benar?
11. **BAS PS**: kesimpulan pencocokan (sesuai / tidak / sebagian) dicatat di BAS - setuju? Perlu baris "gambar situasi terlampir"? Perlu BAS PS juga di folder cerai (kumulasi harta bersama)?
12. **Putusan sela PS**: perlu butir "memerintahkan ... menambah panjar biaya pemeriksaan setempat"? (sekarang tidak ada).
13. BAS PS HB dan waris yang lama DITIMPA isi baru (nama berkas sama) - setuju? (pulih mengembalikan yang lama).
