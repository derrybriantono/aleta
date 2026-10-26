# Paket ABT `abt-sampul-daftar-isi-26okt` - Sampul Berkas Perkara dan Daftar Isi Berkas (26 Okt 2026)

**Status: teruji di ABT LAPTOP (MariaDB 10.4; PRASYARAT, pasang, PERIKSA, uji kueri 155 variabel data_sql x 14 perkara, pasang ulang idempoten, pulih = keadaan awal persis) dan dirender dengan renderer php56 ABT ASLI (sampul cetak awal 12 varian x 6 perkara contoh, termasuk pihak banyak, dibuka di Microsoft Word: semua 1 lembar; ukuran kertas 210x297 / 215x330 / 216x356 mm). Server: BELUM dipasang - dipasang sesi utama.**

> **Sampul (keputusan Derry 26 Okt, versi 4 s.d. 7):** blangko BAWAAN = **Sampul Berkas Perkara** = sampul cetak awal (`artifact-sampul-cetak-awal.html`): riwayat sidang 15 baris di A4 (18 F4, 20 Legal) KE | TANGGAL | AGENDA | HADIR (kotak P/T) | HASIL / DITUNDA KE - ALASAN; ciri berikon (ghaib dan mafqud berbingkai ganda); ciri susulan berkotak centang; pita mediasi (hanya perkara berlawanan); sampul BERHENTI di putusan (tanggal putus, amar satu baris, sifat putusan, konseptor nama). **Sampul Berkas Perkara (Lengkap)** = versi lengkap (riwayat dominan) tetap tersimpan sebagai blangko pilihan kedua, BUKAN bawaan. Varian tata letak dipilih panel menurut perkara (tidak tampil di daftar blangko): `(Permohonan)`, `(Pihak Banyak)`, `(Permohonan Pihak Banyak)`. Lampiran (pihak, objek sengketa, anak, riwayat lanjutan) disusun portal bila perlu; kotak centang "[ ]"/"[X]" dan tanda "..." variabel kosong dirapikan portal (renderer ABT merusak karakter di atas 255).

Hanya pengguna **derry_briantono**. Hanya MEMBACA SIPP. Tidak ada kata nama aplikasi di blangko, nama variabel, fungsi, maupun menu.

## Isi paket (dibangun `python -I sumber/bangun_paket.py`; sumber definisi di `alat/bangun_variabel.py`, `alat/bangun_rtf.py`, `sumber/fungsi.sql`)

| Jenis | Isi |
|---|---|
| Variabel baru (168) | blok 5800-5899: ciri (5801 gabungan; 5802-5827 satu per ciri, **tanpa 5804** = NON e-COURT dihapus), sampul per jenis perkara (5800 jenis+kumulasi, 5841 sebutan pihak I, 5842 band fokus, 5843 pokok perkara; cadangan isian tangan 5845/5846), 5829 baris ikrar, 5836/5837 mediator/hasil mediasi, 5839 konseptor, 5840 PBT, daftar isi 5851-5854 (Bundel A) dan 5856-5859 (Bundel B). Blok 5700-5779: riwayat sidang 20 baris x 4 kolom (tanggal, hadir, agenda/hasil, alasan/keterangan). **Sampul cetak awal:** 5861 ciri berlaku (tanpa ghaib/mafqud/verstek/rekonvensi/mediasi/sita), 5862 ciri susulan (kotak), 5863 amar, 5864 sifat putusan, 5865 konseptor (isian tangan 5839 atau pengguna tahapan putusan SIPP), 5866 hasil mediasi, 5867/5868 jenis dan baris kumulasi, 5869 majelis satu hakim per baris, 5870-5889 kotak hadir per baris sidang, 5890-5893 kolom nama pihak banyak, 5894/5895 sebutan + jumlah pihak, 5896 keterangan kuasa, 5897 turut tergugat, 5898/5899 nama pihak I dan II, 5830/5831 pekerjaan dan alamat pihak I dan II, 5832 anak, 5833 kaki rujukan lampiran |
| Fungsi (1) | `isian_rtf_daftar_isi(pid, bundel, kol)` (kursor; baris dokumen yang ADA menurut SIPP: pendaftaran, penetapan, relaas / e-Summons, bukti surat tercatat (hanya bila ada berkas resi atau nomor resi), mediator, BAS, putusan, pasca putusan) |
| `abt_menu` (1 baris baru) | folder `98b Berkas Perkara - BAS` (id = MAX+1 saat pasang) untuk Panitera Sidang (dikenali panel sebagai folder BAS) |
| RTF (18) | `Sampul Berkas Perkara` (cetak awal, bawaan), `... (Permohonan)`, `... (Pihak Banyak)`, `... (Permohonan Pihak Banyak)`, `... (Lengkap)`, dan `Daftar Isi Berkas`; masing-masing + `(F4)` + `(Legal)`. Sampul ke folder **sudah ada** `derry_briantono/99 PTSP` (menu id 991); daftar isi ke folder baru `derry_briantono/98b Berkas Perkara - BAS` |

Tidak mengubah variabel, blangko, atau menu lain. Nomor 5700-5779 dan 5800-5899 kosong di server per 26 Okt (PRASYARAT G memeriksa lagi saat pasang).

## PRASYARAT yang diharapkan

`0|0|31|0|1|0|0` = A variabel bernomor paket yang isinya LAIN (0) | B yang sudah persis paket (0 pertama; 168 pasang ulang) | C variabel lama yang dirujuk RTF/kueri ada (31) | D baris menu folder baru (0; 1 pasang ulang) | E menu id 991 ada (1) | F fungsi sudah ada (0; 1 pasang ulang) | G nomor lain di dua blok yang dipakai bukan paket (0). Pasang ulang: `0|168|31|1|1|1|0`. Selain itu paket berhenti, tidak ada yang diubah.

## Pasang (Git Bash, server hidup)

```bash
cd /d/aleta-dev/wt/w83/abt-paket/sampul-daftar-isi-26okt     # atau folder repo hasil gabung
ssh aleta 'mkdir -p /root/abt-sampul-20261026'
scp -r paket-satker/* aleta:/root/abt-sampul-20261026/
ssh aleta 'cd /root/abt-sampul-20261026 && md5sum -c MD5SUMS.txt | grep -v OK'     # harus kosong
ssh aleta 'bash /root/abt-sampul-20261026/pasang-satker.sh'
```
Keluaran benar: `PRASYARAT COCOK (0|0|31|0|1|0|0)`, `BERKAS SIAP`, `CADANGAN: ...`, `SEMUA COCOK`, `UJI kueri: 155 variabel x perkara contoh: JALAN`, `FOLDER BARU derry_briantono/98b Berkas Perkara - BAS`, `COCOK=18`, `BERKAS COCOK`, `SELESAI`. Gagal sesudah fungsi/variabel dipasang = pulih otomatis (berkas, folder, baris, fungsi).

Pulih: `ssh aleta 'bash /root/abt-sampul-20261026/pulih-satker.sh'` (baris terakhir `PULIH COCOK`). Pulih menyalin dulu isian ABT bernomor paket ke cadangan, menghapus berkas HANYA bila md5-nya masih isi paket (yang sudah disunting orang dibiarkan dan dilaporkan, lalu `PULIH SEBAGIAN`), folder baru hanya bila kosong, baris variabel dan menu hanya bila masih isi paket, lalu fungsi.

## Temuan dari renderer php56 ABT asli (26 Okt)

- Entitas numerik > 255 (mis. `&#9632;`) diubah ABT menjadi **byte UTF-8 mentah** di RTF (tampil rusak di Word). Karena itu tanda ciri di keluaran ABT berupa **ASCII**: `[+ PRODEO]` (pendaftaran dan biaya), `[* GHAIB T]` (pihak), `[> VERSTEK]` (proses). Panel ALETA mengisi sendiri bentuk kotak/bulat/segitiga (`\u`) saat cetak. Entitas < 256 (mis. `&#233;`) menjadi satu byte latin1 dan aman.
- Tag `<b>` dan `<i>` DIBUANG (tidak ada cetak tebal dari variabel); `<br>` menjadi baris baru (`\par`), dipakai oleh kolom daftar isi dan blok fokus/pokok perkara.
- Sebutan `\u` dan `\b` pada keluaran variabel tidak lolos sebagai kontrol RTF (backslash dimakan): tabel/baris tidak dapat diterbitkan variabel. Daftar isi memakai satu tabel statis berkolom empat; tiap kolom adalah satu variabel bergaris banyak, sehingga baris selalu sejajar.

## Hasil uji (26 Okt 2026)

- Laptop `aps_badilag_s1` (= `abt_variabel` server 26 Okt dari `aps_badilag_ag0`; `sumber/siapkan_lab.sh`) dan SIPP lab `sipp_donggala`: PRASYARAT `0|0|31|0|1|0|0`; pasang -> `SEMUA COCOK`; pasang ulang (PRASYARAT `0|168|31|1|1|1|0`, SUDAH_BARU=18, idempoten); pulih -> `PULIH COCOK`, jumlah variabel kembali 2.493, menu maksimum kembali 995, folder baru hilang, berkas sampul tidak tersisa. Pengaman: sisa berkas lama yang berbeda isi membuat pasang berhenti (`GAGAL: berkas lain bernama sama`), tidak menimpa.
- Mesin 5.5.68 server hanya BELUM diuji (laptop 10.4); fungsi dan kueri ditulis tanpa fitur 10.x. Sebagian kolom SIPP diukur nilainya baca-saja di server (`putusan_verstek` Y/T, `ikrar_talak` Y/T, `sidang_keliling` Y/T, `difabel` Y/T, `mediasi_berhasil`/`mediasi_gagal` bertipe tanggal, `warga_negara_id` 98 = WNI).
- Render php56 ABT asli atas empat perkara contoh (cerai gugat, dispensasi kawin, itsbat nikah, cerai talak) x enam RTF = 24 hasil: semua 1 lembar di Microsoft Word, ukuran kertas terbaca 210x297, 215x330, 216x356 mm. `alat/render_paket.py` menyimpan keluarannya.
- Yang BELUM ada di fungsi ABT (dikerjakan panel saat cetak): dokumen khas jenis perkara, jawaban/replik/duplik/kesimpulan, bukti, saksi, sita, upaya hukum, halaman otomatis (kolom Halaman = titik-titik bila dicetak langsung dari ABT).
