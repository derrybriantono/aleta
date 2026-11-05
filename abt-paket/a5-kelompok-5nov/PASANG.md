# Paket ABT `abt-a5-kelompok-5nov` - 45 kelompok teks merah sisa daftar A5 (keputusan Derry, 5 Nov 2026)

**Status: dibangun dan diuji di LAPTOP atas salinan uji. Server: BELUM dipasang.** Hanya blangko pengguna **derry_briantono** (22 berkas, 1.022 potongan) dan 30 variabel baru (12150-12179) untuk blangko itu.
Tanpa fungsi, menu, tabel, atau data perkara; tanpa kata nama aplikasi. Dibangun dengan `sumber/bangun_kelompok.py`.

**Urutan pasang: sesudah `a5-merah-5nov`.** Pulih paket ini lebih dulu bila a5-merah hendak dipulihkan. Nomor kelompok = `D:/aleta-dev/kerja/audit-abt-4nov/A5/kelompok-540.html`.

## Isi
| golongan | kelompok | baris daftar | perlakuan |
|---|---|---|---|
| tetap | 1, 8, 9, 10, 11, 26, 34, 35 | 85 | merah dihapus, kata sama. Kutipan Arab di atas 34 dan 35 ikut hitam |
| isian ketik | 16, 17, 20, 27, 28, 30, 31, 32, 33, 41, 43, 44, 45 | 27 | teks jadi isian; lihat tabel |
| isian otomatis | 13, 18, 25, 29 | 18 | bagian kuasa Tergugat tercetak hanya bila SIPP mencatat kuasa aktif |
| kalimat pilihan | 2, 3, 4, 5, 6, 7, 12, 14, 15, 19, 40 | 397 | isian pakai / tidak dipakai, bawaan tidak dipakai |
| dibuang | 38, 39 | 2 | paragraf petunjuk "MULAI DARI SINI" |
| tetap merah | 21, 22, 23, 24, 36, 37, 42 | 11 | lihat "Tidak diterapkan" |

Salah ketik: `#0046##` jadi `#0046#` (kelompok 15), "bahwa dalam `#0047#` dalam persidangan" jadi "bahwa `#0047#` dalam persidangan" (kelompok 25). Rincian per baris: `hasil/daftar-tambalan.csv`.
8 tanda `...` kutipan Arab yang batal di a5-merah ikut hitam, karena berada di dalam blok kelompok 15; katanya tidak berubah.

## Cara kerja kalimat pilihan (diukur, `hasil/ukur-alinea.txt`)
Paragraf atau potongan dibungkus `{#K#...}`. `#K#` adalah `data_sql`: kosong bila dipakai, bernilai kata kendali `\nonshppict` bila tidak dipakai, sehingga pembaca RTF melewati seluruh grup.
Diukur di Word atas butir "d) Bahwa keluarga ..." CG [02]:
| bentuk | hasil |
|---|---|
| isian kosong di alinea sendiri | `d)` tertinggal |
| teks tersembunyi `\v1` | kalimat tetap tercetak |
| grup `\nonshppict` (dipakai) | kalimat hilang, tanpa alinea kosong, format dan huruf Arab di dalam grup utuh |

Bawaan tidak dipakai karena `#K#` hanya kosong bila isian persis `pakai`. Isian belum diisi, `tidak dipakai`, atau dua baris bawaan yang tidak dihapus: tidak tercetak (diuji).
Nama isian memuat "(otomatis ...)" sehingga panel Blangko Derry tidak menghitungnya "perlu diisi" (dijaga uji).

## Variabel
| kode isian / penanda | untuk | jenis |
|---|---|---|
| `12150` / `#12151#` | kelompok 2, saksi Penggugat hanya mengetahui akibat | pakai / tidak |
| `12152` / `#12153#` | kelompok 7, saksi Tergugat | pakai / tidak |
| `12154` / `#12155#` | kelompok 3, 4, 5, bukti elektronik T.3 (tiga butir berurutan, satu pilihan) | pakai / tidak |
| `12156` / `#12157#` | kelompok 12, saksi kedua pihak | pakai / tidak |
| `12158` / `#12159#` | kelompok 15, kutipan Arab, 14: suami tidak bekerja (satu blok) | pakai / tidak |
| `12160` / `#12161#` | kelompok 6, keluarga sudah merukunkan | pakai / tidak |
| `12162` / `#12163#` | kelompok 19, peletakan sita; titik koma tetap di luar blok | pakai / tidak |
| `12164` / `#12165#` | kelompok 40 + kata " karena" di depannya | pakai / tidak |
| `#12166#` | kelompok 13, 18, 25, 29 | otomatis: `perkara_pengacara` `pihak_ke = 2`, `aktif = 'Y'` (sumber yang sama dengan `#7152#`, `#9231#`) |
| `#12167#` `#12168#` `#12169#` | kelompok 20, 28, 27 nomor posita dan kode bukti | ketik, berbawaan |
| `#12170#` `#12171#` | kelompok 30, dua tempat | ketik |
| `#12172#` | kelompok 41 kelas | ketik |
| `#12173#` `#12174#` `#12175#` `#12176#` | kelompok 32, 33, 45, 44 nama dan sebutan anak | ketik |
| `#12177#` | kalimat anak kedua | otomatis: tercetak bila `#12174#` terisi |
| `#12178#` `#12179#` | isi kelompok 40: belum bercerai/bercerai, tanggal | ketik |
| `#9289#` `#9285#` `#9287#` `#9288#` (a5-merah) | kelompok 16, 17; 31, 40; 43; 40 | isian yang sudah ada |

Nomor 12150-12179: kosong di salinan server 3 Nov dan tidak dipakai di cabang kerja; PRASYARAT berhenti bila bentrok. 12140-12159 pernah diklaim paket `bas-halaman-semua-2nov`, yang mencatat klaim itu tidak dipakai.

## Tidak diterapkan
- **Kelompok 42** tetap merah: [01a] Alasan E. Bunyi: "... (qabla dukhul) disebabkan `#0047#` mengidap penyakit yang menghalangi terjadi hubungan suami istri, hal ini merupakan bukti yang kuat bahwa antara `#0046#` dan `#0047#` tidak akan dapat melakukan hubungan layaknya suami istri, sehingga ...". Ini inti alasan blangko itu; bila dibuang kalimatnya patah.
- **Kelompok 21-24, 36, 37** tetap merah sesuai keputusan. Usul: 22, 23, 24 ("ISI ...") lebih tepat menjadi isian ketik, karena petugas memang harus mengetiknya.
- **Kelompok 6 tidak memakai `#1268#`:** isian itu tidak dipakai CG/CT [02], bunyinya berbeda, dan tercetak `...` bila belum diisi. Bawaannya `#8498#` memotong teks posita, bukan data yang terbukti tepat.
- **Kelompok 32, 33, 44, 45 tidak otomatis:** `perkara_anak_pihak` 0 baris pada 91 perkara Perwalian di salinan.

## Sisa merah
11 baris daftar di atas. Kalimat belang akibat a5-merah: **0**. Paragraf campur merah dan hitam sisa 4 (`hasil/pindai-sesudah.txt`): kelompok 42; `_` satu huruf di IN [99] ("pada tahun `_`"); `2` satu huruf di dua blangko Perwalian ("pada angka `2`"). Tiga huruf itu tidak masuk daftar A5, jadi tidak diubah.
Di luar paket: 4 blangko `(3 Saksi T)`/`(4 Saksi T)` dan 196 berkas lain yang tidak ada di daftar A5.

## Dasar md5 (PRASYARAT)
md5 19 berkas = `md5_baru` a5-merah-5nov; 3 berkas ([99aa] x2, DK [03]) tidak disentuh a5-merah, md5-nya keadaan sesudah keputusan-a-rekonvensi-4nov. Variabel a5-merah (`9285`, `9287`, `9288`, `9289`) wajib ada. Satu berkas beda atau nomor berisi lain -> `GAGAL` -> BERHENTI tanpa mengubah apa pun (diuji).

## Pasang (Git Bash, server hidup; SESUDAH `a5-merah-5nov`)
```bash
cd /d/.../abt-paket/a5-kelompok-5nov && rm -rf paket-satker/cadangan
ssh aleta 'mkdir -p /root/abt-a5-kelompok-20261105'
scp -r paket-satker/* aleta:/root/abt-a5-kelompok-20261105/
ssh aleta 'cd /root/abt-a5-kelompok-20261105 && md5sum -c MD5SUMS.txt | grep -v OK'     # harus kosong
ssh aleta 'bash /root/abt-a5-kelompok-20261105/pasang-satker.sh'
```
Keluaran benar: `PRASYARAT COCOK (0|0|6)`, `SIAP=22`, `BERKAS SIAP`, `PERIKSA: SEMUA COCOK`, `TAMBAL=22`, `BERKAS COCOK`, `SELESAI`. Pasang ulang: `PRASYARAT COCOK (0|30|6)`, `SUDAH=22`.
Pulih: `ssh aleta 'bash /root/abt-a5-kelompok-20261105/pulih-satker.sh'` -> `PULIH=22`, `BERKAS PULIH`, `PULIH COCOK (0|0|6)`. **Perhatian:** isian yang sudah disimpan untuk variabel baru ikut terhapus saat pulih (`abt_data_teks` ON DELETE CASCADE).

**Sesudah pasang, sebelum dipakai:** cetak satu putusan CG [02] lewat jalur PDF server dengan pilihan tidak dipakai, lalu pastikan kalimatnya hilang. Jalur itu memakai LibreOffice, yang belum dapat diuji di laptop.

## Uji (laptop)
- `hasil/uji-lokal.txt`: pasang, ulang, pulih (md5 + tabel variabel = awal), pasang lagi, berkas disunting -> berhenti, a5-merah belum terpasang -> berhenti, nomor bentrok -> berhenti, disunting lalu pulih -> dibiarkan.
- `hasil/pindai-sesudah.txt` (`sumber/pindai_sesudah.py`, lepas dari pembangun): merah sesudah = baris tetap merah, GAGAL 0. Pembangun juga memeriksa teks paragraf pada keadaan dipakai dan tidak dipakai, termasuk spasi di sekitar potongan.
- `hasil/render-banding.txt` (`alat/uji_render.py`, render ABT asli, salinan `vs30/abt` + `aps_badilag_vs` + `sipp_vs`): 22 berkas, keadaan a5, tidak dipakai, pakai + nilai rekaan; Harta Bersama atas perkara dengan dan tanpa kuasa Tergugat. Sisa `#NNNN#` 0 termasuk di dalam grup yang dilewati; alinea kosong tidak bertambah; beda kata hanya yang dimaksud. Semua pilihan diuji serempak per berkas, bukan satu per satu.
- Word 16 membuka 22 berkas dan 48 hasil render, 0 galat. PDF Word 6 hasil render: `#NNNN#` dan `nonshppict` tidak tercetak, kalimat muncul/hilang sesuai pilihan.
- `aps_badilag_vs` disamakan dengan salinan server selama uji lewat `../a5-merah-5nov/alat/siap_vs.py`, lalu dikembalikan.
- Belum terbukti: LibreOffice/PDF server; MariaDB 5.5 sungguhan; mesin ALETA seluruh jalur (hanya `pagarBaca` dan `keRtf`); tampilan panel selain status wajib; Harta Bersama, Perwalian, DK pada perkara yang sesuai isi kalimatnya.
- Penjaga repo: `manajemen_surat/src/test/a5-kelompok-5nov.test.ts`.
