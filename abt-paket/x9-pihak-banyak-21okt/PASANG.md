# Paket ABT `abt-x9-pihak-banyak-21okt` - identitas pihak banyak (Pemohon/Penggugat, Termohon/Tergugat, Turut Tergugat, pihak intervensi) tercetak lengkap sampai pihak terakhir (agen W39, 21 Okt 2026)

**Status: teruji di ABT LAPTOP (PRASYARAT, pasang, PERIKSA, pasang ulang, pulih, pasang lagi), dibandingkan sebelum/sesudah atas perkara nyata, dirender dengan renderer php56 ABT asli, dan dikonfirmasi BACA SAJA terhadap data server (MariaDB 5.5). Server: BELUM dipasang - dipasang sesi utama.**
Dasar: catatan paket x1 ("7047/7097 tidak mencetak Pemohon V ke atas (18 perkara), 7048/7098 tidak mencetak Tergugat VI ke atas (12 perkara) - perlu rancangan generik"). Server sekarang berisi x1-x7 (`abt_variabel` 2.480 baris pada saat pengukuran).

## Sebab

Kueri ABT yang menyusun identitas pihak berupa `CASE WHEN p1.urutan = 1 ... = 2 ... ELSE ''`: cabang per jumlah pihak ditulis tangan sampai batas tertentu, sisanya DIAM-DIAM KOSONG.

| variabel | isi | batas lama | perkara nyata di server (21 Okt) |
|---|---|---|---|
| `7047` | identitas lengkap Pemohon/Penggugat + kalimat kuasa | 4 | sampai 32 Pemohon (perkara 9571); 18 perkara >= 5 |
| `7097` | nama Pemohon/Penggugat (BAS, relaas) | 5 | idem |
| `7048` | identitas lengkap Termohon/Tergugat + kalimat kuasa | 5 | sampai 25 (urutan); 12 perkara >= 6 |
| `7098` | nama Termohon/Tergugat | 5 | idem |
| `8710` | identitas Turut Tergugat/Termohon | 10 (`MAX(CASE ...)` x10) | sampai urutan 26; 3 perkara > 10 |
| `7054` | identitas pihak intervensi (x1) | 5 | belum pernah ada (0 baris `perkara_pihak3`) |

Variabel hanya bisa menggabung banyak baris lewat `GROUP_CONCAT` (batas 1.024 huruf di server) atau dengan menulis satu cabang per jumlah pihak; perkara dengan 32 pihak ~ 10 KB teks. Maka penyusunan dipindah ke **fungsi tersimpan dengan kursor** (pola x6: `aps_badilag.isian_rtf_*`, tanpa kata merek), dan kueri lama DIBIARKAN persis untuk jumlah pihak <= batas lamanya.

## Isi

**Enam fungsi baru** (`paket-satker/abt-x9-pihak-banyak-21okt-FUNGSI.sql`, komentar fungsi berawalan `X9:`; membaca `SIPP.perkara_pihak1/2/3/4`, `pihak`, `agama`, `tingkat_pendidikan`, tidak menulis apa pun; di laptop `SIPP.` diganti nama basis uji):

| fungsi | isi |
|---|---|
| `isian_rtf_romawi(n)` | angka romawi 1-3999 |
| `isian_rtf_tanggal(d)` | tanggal gaya ABT (`01 Oktober 1970`); kosong bila NULL/sebelum 1900 |
| `isian_rtf_pihak_utama(perkara, sisi, dari, sebutan, kediaman)` | identitas lengkap SEMUA pihak sisi 1 (Pemohon/Penggugat) atau 2 (Termohon/Tergugat) mulai urutan `dari`, satu pihak satu baris dipisah `<br>`, bentuk persis baris 7047/7048 (`<strong>nama</strong>, NIK ..., tempat dan tanggal lahir ..., agama ..., pekerjaan ..., pendidikan ..., tempat kediaman di ..., sebagai <strong>Pemohon V</strong>;`) |
| `isian_rtf_pihak_nama(perkara, sisi, dari, sebutan)` | `nama, sebagai <strong>Pemohon VI</strong>;` per pihak (bentuk 7097/7098) |
| `isian_rtf_pihak_urutan(perkara, sisi, sebutan)` | `Pemohon I, Pemohon II, ... dan Pemohon N` (untuk kalimat "Dalam hal ini ... memberikan kuasa ..."; satu pihak = `Pemohon I`) |
| `isian_rtf_pihak_tambahan(perkara, tabel)` | Turut Tergugat/Termohon (tabel 4, bentuk persis 8710) atau pihak intervensi (tabel 3, bentuk 7054), SEMUA urutan |

**Sepuluh variabel baru** (jatah 3500-3549; 3502-3506 sudah dipakai ABT lama, jadi dipakai 3507-3516):

| no | isi |
|---|---|
| `3507` | identitas Pemohon/Penggugat ke-5 dst (`isian_rtf_pihak_utama(..., 1, 5, "#0046#", "tempat kediaman di")`) |
| `3508` | `Pemohon I, ... dan Pemohon N` (kalimat kuasa) |
| `3509` | identitas Termohon/Tergugat ke-6 dst (kediaman memakai `#0124#`, sama dengan 7048) |
| `3510` | `Tergugat I, ... dan Tergugat N` |
| `3511` / `3512` | nama Pemohon / Termohon ke-6 dst |
| `3513` / `3514` | identitas SEMUA Pemohon / Termohon dari I (tanpa batas, tanpa kalimat kuasa) - untuk blangko baru yang ingin menyusun sendiri |
| `3515` / `3516` | nama SEMUA Pemohon / Termohon dari I |

**Enam baris `abt_variabel` diubah** (isi lama dijaga md5 dan dicadangkan; PULIH mengembalikan):

- `7047`: SATU cabang disisipkan sebelum `ELSE ""`: `WHEN p1.urutan >= 5` = persis teks cabang 4 (tanpa kuasa) + `<br>` + `#3507#` + (bila `#8540#` terisi) `<br>Dalam hal ini #3508# #8540#, selanjutnya disebut sebagai #0046#;`. Cabang 1-4 tidak disentuh.
- `7048`: `WHEN COALESCE(p1.urutan, 0) >= 6` = teks cabang 5 + `#3509#` + kalimat kuasa `#3510# #8541#`.
- `7097`: `WHEN p1.urutan >= 6` = teks cabang 5 + `#3511#`. `7098`: idem + `#3512#`.
- `8710`: seluruh kueri diganti `SELECT aps_badilag.isian_rtf_pihak_tambahan(#perkara_id#, 4) AS data` (bentuk teks sama; semua urutan, bukan 10).
- `7054`: `... isian_rtf_pihak_tambahan(#perkara_id#, 3) ...` (kueri x1 5-pihak diganti fungsi, bentuk sama).
`7055` (alias `#8710#`, x1) otomatis ikut.

Pembangun memeriksa bahwa kueri baru 7047/7048/7097/7098 = kueri lama + SATU sisipan (awalan dan akhiran lama utuh), sehingga keluaran untuk pihak <= batas lama TIDAK BISA berubah; uji sebelum/sesudah di bawah mengukurnya juga.

Berkas `paket-satker/`: `...-PRASYARAT.sql`, `...-FUNGSI.sql`, `...-PASANG.sql`, `...-PERIKSA.sql`, `...-PULIH.sql`, `pasang-satker.sh`, `pulih-satker.sh`, `nomor-baru.txt`, `nomor-ubah.txt`, `nama-fungsi.txt`, `perkara-uji.txt`, `uji-kueri.tsv`, `MD5SUMS.txt`. Dibangun ulang dengan `python sumber/bangun_paket.py` (butuh salinan HEX `abt_variabel` server di `VAR_SERVER_HEX`, di luar repo; untuk memasang cukup `paket-satker/`). `sumber/variabel_def.py` dan `sumber/templat-fungsi.sql` = definisi terbaca; `hasil/isi-paket.json` = ringkasan.

## PRASYARAT yang diharapkan (server, baca saja, 21 Okt 2026)

`0|0|6|0|0|79|0` = A nomor baru (10) berisi lain (0) | B nomor baru yang sudah persis paket (0) | C dari 6 baris yang akan diubah, yang masih isi LAMA (6) | D yang sudah isi BARU (0) | E fungsi baru yang sudah ada (0) | F dari 79 variabel lama yang dirujuk, yang ada (79) | G baris diubah yang isinya bukan lama bukan baru (0).
Pasang ulang: `0|10|0|6|6|79|0`. Angka lain = berhenti, tidak ada yang diubah.
**SUDAH dijalankan baca saja di server: `0|0|6|0|0|79|0`** (isi lama = keadaan sesudah x1, md5 7047 `a7955dd3...`, 7048 `922bffb3...`, 7097 `8066a1f0...`, 7098 `0c721e52...`, 8710 `cefcc67d...`, 7054 `64c80116...`).
Bila sesi lain mengubah salah satu dari enam baris itu sebelum x9 dipasang, PRASYARAT berhenti (C/G) dan paket harus dibangun ulang (`bangun_paket.py` dengan HEX server terbaru).

## Pasang (Git Bash, server hidup)

```bash
cd /d/aleta-dev/wt/w39/abt-paket/x9-pihak-banyak-21okt     # atau folder repo hasil gabung
ssh aleta 'mkdir -p /root/abt-x9-20261021'
scp -r paket-satker/* aleta:/root/abt-x9-20261021/
ssh aleta 'cd /root/abt-x9-20261021 && md5sum -c MD5SUMS.txt | grep -v OK'     # harus kosong
ssh aleta 'bash /root/abt-x9-20261021/pasang-satker.sh'
```
Keluaran benar: `PRASYARAT COCOK (0|0|6|0|0|79|0)`, `CADANGAN: ... (6 baris lama)`, `FUNGSI: 6 dibuat`, `SEMUA COCOK`, 13 baris `uji perkara NNNN: 12 kueri jalan; pihak tercetak (var=jumlah): ...`, `SELESAI`.
Pulih: `ssh aleta 'bash /root/abt-x9-20261021/pulih-satker.sh'` (baris terakhir `PULIH COCOK`; enam baris dikembalikan dari cadangan, nomor 3507-3516 dihapus, keenam fungsi dihapus bila tak dipanggil variabel lain). Gagal sesudah FUNGSI/PASANG/PERIKSA/UJI = pulih otomatis. Tidak perlu memulai ulang apa pun (ABT membaca `abt_variabel` dan fungsi setiap cetak); tidak ada berkas blangko yang berubah. Urutan dengan paket lain: bebas selama x1-x7 sudah terpasang (x9 mengubah baris 7047/7048/7054/7097/7098 dari keadaan x1 dan 8710 dari keadaan awal).

## Hasil uji (21 Okt 2026)

- **Siklus ABT laptop** (`sumber/uji_lokal.sh semua`; DB `aps_badilag_x9` = salinan PERSIS `abt_variabel` server, 2.480 baris, dibaca dari HEX baca-saja; sidik jari seluruh tabel + jumlah fungsi): PRASYARAT `0|0|6|0|0|79|0` -> pasang (2.490 baris, 6 fungsi) -> PERIKSA `SEMUA COCOK` -> pasang ulang (`0|10|0|6|6|79|0`, sidik jari sama) -> **pulih `PULIH COCOK`: sidik jari kembali SAMA dengan server (2.480 baris, 0 fungsi)** -> PRASYARAT `0|0|6|0|0|79|0` lagi -> pasang lagi `SEMUA COCOK`.
- **Sebelum/sesudah atas SEMUA perkara nyata** (`alat/bandingkan.js`: meniru penyulihan `#NNNN#` ABT atas `sipp_donggala` lokal; 10.216 perkara yang punya pihak, 0 galat): kueri 7047, 7048, 7097, 7098, 8710, 7054, 7055 dievaluasi dengan basis ABT keadaan server (`aps_badilag_x9b`) dan dengan paket. **Keluaran IDENTIK pada semua perkara dengan pihak <= batas lama**; yang berubah HANYA perkara di atas batas lama, dan SEMUA perkara di atas batas itu berubah: 7047 16 perkara (>= 5 Pemohon), 7097 11 (>= 6), 7048 11 (>= 6 Tergugat urutan), 7098 11; 8710, 7054, 7055: 0 beda dari 10.216 (tak ada perkara lokal di atas 10 Turut Tergugat / 5 intervensi). Ringkasan: `hasil/bandingkan-ringkasan.json`.
- **Renderer php56 ABT asli** (`alat/render_uji.py`, basis `aps_badilag_x9render`; 46 cetakan sebelum dan sesudah, perkara 5-32 Pemohon, 6-10 Tergugat, 6-7 Turut Tergugat, kuasa advokat ada pada 5979/6759/9571/9729): 29 cetakan berubah = perkara di atas batas lama (Pemohon 5-32 dan Tergugat 6-10 tercetak lengkap berangka romawi, kalimat "Dalam hal ini Penggugat I, ..., Penggugat VIII memberikan kuasa kepada ..." memuat SEMUA pihak, nama BAS sampai XXXII, Turut Tergugat I-VII, komposit 7062/7107 lengkap); 17 cetakan persis sama (perkara <= batas, termasuk `#8710#`, dan dua blangko Derry asli dari server - Hibah [01] Kabul dan Itsbat [01a] - pada perkara <= batas). Dua blangko Derry asli atas perkara di atas batas bertambah pihaknya (Hibah perkara 9729: 7 -> 33 sebutan pihak; Itsbat perkara 9571: 0 -> 33), "..." tidak bertambah, 0 token `#nnnn#` tersisa. Ringkasan: `hasil/render-ringkasan.json` (teks cetak memuat data perkara dan TIDAK disimpan di repo).
- Renderer menemukan satu cacat yang tidak tampak di emulator: nama variabel ikut disulih ABT, dan nama 3507/3509/3511/3512 semula memuat `#7047#` dst (variabel pemanggilnya) -> rekursi tak berujung (cetak macet). Nama kini tanpa rujukan variabel lain (kecuali `#0046#`/`#0047#`); pembangun dan uji vitest menjaganya.
- **Konfirmasi BACA SAJA di server** (fungsi tidak dibuat di server; `alat/konfirmasi_server.py`): data yang dibaca fungsi diambil dari SERVER (kueri sama dengan kursor fungsi), diformat ulang oleh terjemahan Python atas fungsi, dan dibandingkan dengan keluaran fungsi SUNGGUHAN di lab untuk 12 perkara (5-32 Pemohon, 3-10 Tergugat, 1-7 Turut Tergugat; perkara 10225 lebih baru daripada salinan SIPP lokal, dilewati): **108 perbandingan, 0 beda**; dan keluaran Turut Tergugat dibandingkan dengan **kueri 8710 LAMA yang dijalankan di server** untuk 12 perkara: sama persis. PRASYARAT dijalankan baca-saja di server: `0|0|6|0|0|79|0`.
- Portal/ekstensi tidak berubah. `npx tsc --noEmit` bersih (keluar 0). Vitest sasaran `pihak-banyak-x9-21okt.test.ts` 10 butir hijau (integritas MD5SUMS, FUNGSI.sql = templat, ASCII dan tanpa kata merek termasuk isi heksadesimal, HARAP/ULANG konsisten, nomor di jatah 3500-3549 dan bukan 3502-3506, jumlah argumen panggilan fungsi, cabang sisipan sebelum ELSE terakhir dan hanya satu, nama tanpa rujukan variabel), bersama `tuntutan-sinkron-21okt`, `w2b-keluarga-lain-paket-21okt`, `penutup-saksi-x6-21okt`, `kodepos-amplop-21okt` (74 butir hijau). Uji penuh tidak dijalankan (atas aturan).

## Catatan jujur

- Batas lama `8710` (10) dihitung menurut JUMLAH baris `perkara_pihak4` (bukan nomor urutan): di server tidak ada perkara dengan > 10 Turut Tergugat (maksimum 7), jadi perubahan 8710 tidak mengubah cetakan hari ini - ia menghapus batas untuk perkara kelak. Yang berubah hari ini hanya 7047/7097 (18 perkara >= 5 Pemohon) dan 7048/7098 (12 perkara >= 6 Tergugat).
- Nomor urutan SIPP yang berlubang (mis. Tergugat urutan 1-5 lalu 14-19 pada perkara 273/Pdt.G/2026) dicetak menurut nomor urutannya (Tergugat XIV dst), sama dengan aturan kueri lama; fungsi tidak menomori ulang.
- Kuasa: kalimat "Dalam hal ini ... memberikan kuasa ..." untuk pihak di atas batas memakai daftar `I, II, ..., dan N` bertanda koma yang benar (kueri lama untuk 4 pihak menulis "Penggugat I Penggugat II, ..." tanpa koma pertama; cabang lama itu tidak diubah).
- Cabang lama 7097 untuk 3 Pemohon dengan kuasa hanya mencetak I dan II (kekeliruan lama, bukan bagian paket ini; tidak diubah supaya keluaran <= batas lama tetap persis).
- Kata merek: tidak ada pada nama fungsi, variabel, komentar, maupun modifier (`admin`).
