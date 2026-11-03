# Paket ABT `abt-saksi-rapi-3nov` - keterangan saksi di putusan rapi, sejajar identitas saksi, dan tidak menggantung (3 Nov 2026)

**Status: dibangun dan diuji di LAPTOP (blangko = server 3 Nov 13.55, md5 sama persis dengan cadangan 2 Nov 18.50; fungsi = versi
`titik-koma-30okt` yang terpasang di server). Server: BELUM dipasang - dipasang sesi utama.** Hanya pengguna **derry_briantono**
(301 blangko) dan 3 fungsi tersimpan. Tanpa variabel, menu, migrasi, atau data BAS yang diubah. Tanpa kata nama aplikasi.

## Masalah (laporan Derry, putusan 534/Pdt.G/2026/PA.Dgl, blangko `1 Perceraian CG/[03] [Tolak] ...`)
1. Butir keterangan saksi `-<tab>Bahwa ...` mulai di margin kiri, baris lanjutan kembali ke margin, sedangkan identitas saksi
   menjorok. Sebab: ABT mengisi #9259#-#9265# dengan `-   Bahwa ...<br>...`, `cleanHtmlTagSpecial` menjadikannya `-\tab Bahwa ... \par`,
   sehingga SEMUA butir mewarisi sifat paragraf blangko tempat penanda itu. Di 480 dari 850 paragraf itu `\li0 \fi0` (tab bawaan 720),
   di paragraf lain inden tidak sama dengan identitas (mis. `\li450 \fi-450` di bawah identitas `\li425`), dan 104 paragraf membawa
   `\cufi/\culi` (satuan aksara; Word/WPS mendahulukannya dari `\li`).
2. **Ditemukan saat bukti render**: 18 varian `(3 Saksi)/(4 Saksi)/(5 Saksi)` cerai gugat/talak memuat identitas saksi ke-3..5 yang
   rusak (`\pard ... \f2 3.\tab {\*\isianasal ...}}` - kurung kurawal kelebihan satu per saksi). Word menutup dokumen di situ:
   **putusan berhenti di "3."** (render Word: 3 halaman, seharusnya 6) - sisa putusan (pertimbangan, amar) hilang.
3. Jawaban saksi "Saya tidak tahu;" / "Saya tidak mengetahuinya;" / "Saya tidak pernah melihatnya;" tercetak di putusan
   "Bahwa saksi tidak tahu;" tanpa menyebut APA yang tidak diketahui.

## Isi
| bagian | jumlah | tindakan |
|---|---|---|
| paragraf keterangan saksi (#9259#-#9265#) | 848 paragraf di 301 berkas (840 berpard sendiri + 8 Asal Usul Anak tanpa pard sendiri) | `L` = tepi kiri teks identitas saksi (paragraf tepat sebelumnya: `\li` bila gantung, `\li+\fi` bila inden baris pertama). Paragraf keterangan: `\fi-400 \li(L+400) \lin(L+400) \tql \tx(L+400)`, `\cufi/\culi` dan tab lama dibuang; huruf/teks/penanda tidak disentuh. Asal Usul Anak: `\pard` (tanpa `\plain`) disisipkan sebelum keterangan dan sifat lama dikembalikan sesudahnya |
| identitas saksi ke-3..5 rusak | 36 paragraf di 18 berkas | dibentuk seperti identitas saksi ke-2 di berkas yang sama (`\fi-394 \li794 ... \ls4` + `{\listtext ... N.\tab }`), `{\*\isianasal ...}` tetap; kurung seimbang |
| fungsi `isian_rtf_objek_tanya` (baru) | 1 | objek pertanyaan: `Apakah saksi tahu/mengetahui/melihat X?` -> `X` (`bahwa/kalau X` -> `apakah X`, `melihat dan mendengar X` -> `X`); `Apakah X?` -> `apakah X`; `Pernahkah/Sudahkah/Masihkah/Adakah X?` -> `apakah pernah/sudah/... X`; `Berapa/Siapa/Kapan/Sejak kapan/Bagaimana/Mengapa/Di mana/Apa yang X?` -> sama; "yang saudara ketahui" di ujung dibuang; `saudara/anda` -> `saksi`. Pertanyaan ganda (`..., dan kapan ...`, `... dan apakah ...`) dan kata kerja tanya yang berbeda dari jawaban (tanya "melihat", jawab "tidak tahu") = tidak dapat ditentukan -> jawaban dibiarkan |
| fungsi `isian_rtf_tahu_lengkap` (baru) | 1 | jawaban yang (kepalanya) hanya `[Tidak,] [saya] tidak/kurang/belum [pernah] tahu/mengetahui(nya)/melihat(nya)/mendengar(nya)/kenal/mengenal(nya)` dilengkapi objek: "Saya tidak tahu;" + tanya "Apakah saksi tahu proses akad jual beli?" -> "Saya tidak tahu proses akad jual beli". Kepala sebelum `karena/tetapi/tapi/namun/akan tetapi/sebab/, saya hanya/, yang saya/, dan saya` ikut dilengkapi, ekornya tetap |
| fungsi `isian_rtf_ket_saksi` (diganti) | 1 baris | `SET t = isian_rtf_tahu_lengkap(t, tq);` sesudah `isian_rtf_saring_penutup`, sebelum `saya` -> `saksi`. Sisa definisi persis versi `titik-koma-30okt` (dijaga uji) |

Data BAS (`abt_keterangan_saksi`) TIDAK diubah: BAS tetap mencatat jawaban apa adanya; hanya bunyi di putusan yang lengkap.
BAS memakai tabel tanya-jawab (`kolom_kode_A4`), bukan daftar "- Bahwa" - tidak terkena masalah inden ini.
Panel Blangko Derry dan panel ABT lama sama-sama membaca blangko server + fungsi yang sama, jadi hasilnya sama.

## Ukuran atas data server 3 Nov (dibaca saja, 70.223 jawaban <= 400 huruf)
- **181 jawaban di 84 perkara** dilengkapi (perkara 534: 2 jawaban). Pemindai menggantung (`sumber/gantung.py`) sesudah paket: 27 sisa:
  15 kalimat majemuk yang sudah melanjutkan sendiri ("tidak tahu, yang saya tahu ..."), 7 pertanyaan ganda / kata kerja tanya berbeda
  ("Apakah pekerjaan Pemohon dan berapa penghasilannya?", tanya "pernah melihat ..." jawab "tidak tahu"), 5 objek sesudah koma
  ("Saya tidak tahu, Tergugat masih memberi nafkah ..."). Yang 7 perlu dibetulkan petugas di BAS (pertanyaannya ganda).
- Kelompok saksi tanpa jawaban menggantung: keluaran `isian_rtf_ket_saksi` sama persis (fungsi baru mengembalikan teks apa adanya bila aturan tidak berlaku).

## PRASYARAT
SQL `A|B|C` = ket_saksi versi titik-koma-30okt | 2 fungsi baru ada | ket_saksi versi paket. Pasang bila `1|0|0`, pasang ulang `0|2|1`.
Berkas: `tambal_rtf.py cek` - tiap berkas md5 persis keadaan server 3 Nov (`daftar-tambal.tsv`); satu saja beda -> BERHENTI, tidak ada yang diubah.
Paket lain yang belum terpasang dan menyentuh blangko yang sama akan membuat cek ini gagal - pasang paket ini SESUDAH paket blangko yang
sudah terpasang 2 Nov, dan sebelum paket blangko baru (atau bangun ulang: `python sumber/bangun_blangko.py <_blangko_abt>/derry_briantono paket-satker hasil`).

## Pasang (Git Bash, server hidup)
```bash
cd /d/.../abt-paket/saksi-rapi-3nov
ssh aleta 'mkdir -p /root/abt-saksi-rapi-20261103'
scp -r paket-satker/* aleta:/root/abt-saksi-rapi-20261103/
ssh aleta 'cd /root/abt-saksi-rapi-20261103 && md5sum -c MD5SUMS.txt | grep -v OK'     # harus kosong
ssh aleta 'bash /root/abt-saksi-rapi-20261103/pasang-satker.sh'
```
Keluaran benar: `PRASYARAT COCOK (1|0|0)`, `SIAP=301`, `BERKAS SIAP`, `CADANGAN: ...`, `PERIKSA: SEMUA COCOK`, `PRASYARAT SESUDAH: 0|2|1`,
`TAMBAL=301`, `BERKAS COCOK`, `SELESAI`. Tidak perlu memulai ulang apa pun.
Pulih: `ssh aleta 'bash /root/abt-saksi-rapi-20261103/pulih-satker.sh'` -> `PULIH=301`, `BERKAS PULIH`, `PULIH COCOK (1|0|0)`
(berkas yang sudah disunting orang sesudah pasang dibiarkan dan dilaporkan).

## Uji laptop
- `sumber/uji_lokal.sh` (basis `aps_badilag_w195` = `abt_keterangan_saksi` + fungsi dari `aps_badilag_w189d`): PRASYARAT `0|2|1`, PERIKSA 15 kasus `SEMUA COCOK`.
- Skrip paket utuh (`ABT_LOKAL=1 ABT_DB=aps_badilag_w195 ABT_BLANGKO=<salinan>`): pasang `1|0|0` -> SEMUA COCOK -> TAMBAL=301 -> BERKAS COCOK -> SELESAI;
  pasang ulang SUDAH=301; pulih PULIH=301, PULIH COCOK, 1.880 berkas md5 = server persis; pasang lagi TAMBAL=301 SELESAI.
- Render Word (RTF rekaan, nama rekaan; `alat/rekaan.py` + `alat/rtf_pdf.ps1`): PNG di `D:/aleta-dev/kerja/saksi-rapi-3nov/bukti/`
  (`cg03-*` = blangko perkara 534, `cg01c3-*` = varian 3 saksi: sebelum 3 halaman terpotong, sesudah 6 halaman, `ik-*` = Izin Kawin).
- Penjaga: `manajemen_surat/src/test/saksi-rapi-3nov.test.ts`.

## Belum tercakup
- `8 Asal Usul Anak/[01b] ...`: dua penanda keterangan berada DI DALAM paragraf panjang bersama teks lain (satu paragraf berganti baris) - tidak
  disentuh; perlu blangkonya dipecah per paragraf (keputusan Derry).
