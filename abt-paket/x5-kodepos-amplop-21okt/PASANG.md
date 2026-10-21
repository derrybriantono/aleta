# Paket ABT `abt-x5-kodepos-amplop-21okt` - kode pos di ujung alamat penerima pada amplop relaas (21 Okt 2026)

**Status: teruji di ABT LAPTOP (PRASYARAT, pasang, PERIKSA, pasang ulang, pulih, PRASYARAT, pasang lagi; sidik jari tabel `abt_variabel` DAN md5 semua blangko kembali SAMA dengan server sesudah pulih); empat kueri baru + 8172 dijalankan BACA SAJA di SIPP server (MariaDB 5.5): 0 galat. Server: BELUM dipasang - dipasang sesi utama.**

Permintaan hakim Derry: "Tambahkan di amplop relaas di ujung identitas itu kode posnya".

## Cara ALETA mencetak amplop (mengapa paketnya ABT)

ALETA tidak menyusun amplop sendiri: tombol Cetak relaas (portal) dan panel Juru Sita (ekstensi) menyuruh ABT merender blangko RTF Derry (`derry_briantono/98 Relaas`). Alamat penerima di amplop = variabel ABT `#0101#` (alamat Penggugat/Pemohon) dan `#0105#` (alamat Tergugat/Termohon) = kolom `alamat` perkara_pihak1/2, yang TIDAK memuat kode pos. Blangko SIPP sendiri (`c_template_relaas_amplop`) tidak diubah.

| blangko (98 Relaas) | sebelum | sesudah |
|---|---|---|
| `[JS] 8.1.1` / `8.2.1` / `8.3.1` (amplop panggilan sidang / pemberitahuan putusan / panggilan ikrar - P) | `#0101#` | `#9292#` |
| `[JS] 8.1.2` / `8.2.2` / `8.3.2` (T) | `#0105#` | `#9293#` |
| `[JS] --AMPLOP PANGGILAN SURAT TERCATAT--` (e-Court) | `#0105#, #8172#.` (sudah punya tempat kode pos) | RTF TIDAK diubah; variabel `8172` diperbaiki |

## Isi paket

| butir | isi |
|---|---|
| BARU `9290` / `9291` | kode pos Penggugat/Pemohon / Tergugat/Termohon (pihak urutan 1): "94351" bila PASTI, selain itu TIDAK ADA BARIS (blangko mencetak "..."). `9291` melewati pihak `ghaib` dan alamat "tidak diketahui"/"Dahulu beralamat". |
| BARU `9292` / `9293` | alamat + `, Kode Pos NNNNN` (pengganti `#0101#`/`#0105#` di amplop). Tanpa kode pos pasti = alamat apa adanya. Bagian surel / "Domisili elektronik : ..." tetap di belakang (`... Sulawesi Tengah, Kode Pos 94356. Domisili elektronik : a@gmail.com`). Koma/titik/spasi di ujung alamat SIPP dibuang dulu. |
| UBAH `8172` | "Nomor Kode Pos" amplop surat tercatat. Lama: `post_code` dari baris `kode_pos` yang `area` = KATA KEDUA alamat (salah untuk desa dua kata, nama desa kembar antar kabupaten, banyak baris -> yang pertama). Baru: isi `#9291#` bila lima angka, selain itu tidak ada baris ("..."). Hanya dipakai blangko tersebut (dicek di semua `_blangko_abt` dan semua `abt_variabel`). |
| SUNTING 6 RTF | satu penanda tiap berkas, `berkas_rtf.py` (md5 lama dijaga; jumlah penanda dijaga; hasil harus persis md5 baru; berkas asli dicadangkan SEKALI; pemilik/izin `apache:apache 750` dipertahankan). |

Nomor `9290`-`9293` bebas di server (21 Okt, 2.441 baris), di luar x1 (3121-3131, 5078-5118, 8013 dst.), x2, x3 (3400), x4 (10121-10126), w3a (3600-3799), dan paket lain di `D:/aleta-dev/wt/*/abt-paket`. Hanya `abt_variabel` + 6 berkas RTF yang disentuh; `modifier` = `admin`; ASCII; tanpa kata nama aplikasi.

## Aturan kode pos (sama dengan `aleta_bot/services/kodePosWilayahService.js`)

`pihak.kelurahan` (kode wilayah, mis. `72.10.01.2009`) -> nama provinsi/kabupaten/kecamatan/desa (`ref_*_new`) -> baris `kode_pos` (nama dinormalkan: huruf besar-kecil, spasi, tanda hubung, titik, teks dalam kurung, awalan Kabupaten/Kota diabaikan).
1. desa cocok dan TEPAT SATU kode pos -> dipakai; 2. desa cocok dengan beberapa kode pos -> kosong; 3. desa tidak cocok tetapi kecamatan hanya punya SATU kode pos -> dipakai; 4. selain itu kosong. Tidak pernah menebak.
Catatan teknis: `kode_pos` berkolasi `utf8mb4_unicode_ci`, `ref_*_new` `utf8mb4_general_ci` -> sisi `kode_pos` diberi `COLLATE utf8mb4_general_ci` (tanpa itu error 1267 di MariaDB 5.5 maupun 10.x); prasaring dua huruf pertama kecamatan membuat kueri ±5x lebih cepat (0,3-0,6 dtk di server termasuk ssh).

## Ukur (SIPP laptop = salinan server, pihak urutan 1 semua perkara terdaftar 2026: 1.546 pihak)

Lihat `hasil/ukur-kodepos.json`: **1.472 pihak (95,2%) kode posnya terisi pasti** (1.372 tingkat desa + 100 tingkat kecamatan); kosong: 39 kecamatan belum ada di `kode_pos` (kecamatan hasil pemekaran, mis. Kinovaro/Sigi), 2 desa tidak cocok di kecamatan berkode pos banyak, 33 pihak ghaib / alamat tidak diketahui / tanpa kode wilayah (sengaja tanpa kode pos), 0 yang ditebak. Aturan JS dan kueri SQL paket memberi jawaban SAMA pada 105 kode kelurahan (45 kasus tepi + 60 acak): 0 beda.

Variabel `8172` (amplop surat tercatat) lama vs baru, Tergugat/Termohon 651 perkara 2026 (`hasil/banding-8172.json`): sama 183; lama kosong ("...") tetapi baru terisi 283; lama mencetak kode pos lain/salah 131 (97 di antaranya desa kembar yang punya banyak kode); baru kosong padahal lama terisi 14; alamat "tidak diketahui" tanpa keduanya 32; kosong keduanya 8. Artinya kode pos lama benar hanya pada 28% pihak.

## Render amplop dengan renderer php56 ABT asli (perkara 650/Pdt.G/2026/PA.Dgl, `hasil/render-amplop.json` + tangkapan di `D:/Aplikasi/aleta/tmp/w28-layar/`)

8.1.1 (P), 8.1.2 (T) dan 8.3.2 (T): sebelum = alamat tanpa kode pos; sesudah = `..., Provinsi Sulawesi Tengah, Kode Pos 94352`, tanpa penanda `#NNNN#` tersisa, jumlah halaman sama. Amplop surat tercatat: `..., Provinsi Sulawesi Tengah, 94352.` (variabel 8172 baru). Alamat berakhir surel/"Domisili elektronik": kode pos tersisip sebelum surel (diuji di SQL dan di `kodepos-amplop-21okt.test.ts`).

## PRASYARAT yang diharapkan (server, baca saja)

`0|0|1|0|0|0` = A nomor baru berisi lain (0) | B nomor baru yang sudah persis paket (0) | C dari 1 baris yang diubah, yang masih isi LAMA (1) | D yang sudah isi BARU (0) | E variabel lama yang dirujuk dan ada (0 - paket tidak merujuk variabel lama) | F baris diubah yang bukan lama bukan baru (0). Pasang ulang: `0|4|0|1|0|0`. Angka lain = berhenti, tidak ada yang diubah. Skrip juga memeriksa 6 RTF: `SIAP_SUNTING=6 / BERKAS SIAP`.

## Pasang (Git Bash, server hidup)

```bash
cd /d/aleta-dev/wt/w28/abt-paket/x5-kodepos-amplop-21okt     # atau folder repo hasil gabung
ssh aleta 'mkdir -p /root/abt-x5-20261021'
scp -r paket-satker/* aleta:/root/abt-x5-20261021/
ssh aleta 'cd /root/abt-x5-20261021 && md5sum -c MD5SUMS.txt | grep -v OK'     # harus kosong
ssh aleta 'bash /root/abt-x5-20261021/pasang-satker.sh'
```
Keluaran benar: `PRASYARAT COCOK (0|0|1|0|0|0)`, `SIAP_SUNTING=6`, `BERKAS SIAP`, `CADANGAN: ... (1 baris lama)`, `SEMUA COCOK`, delapan baris `uji perkara NNNN: 8 kueri jalan`, `SUNTING=6`, `COCOK=6`, `BERKAS COCOK`, `SELESAI`. (Python 2.7 server dipakai `berkas_rtf.py`; `PY=python3` bila perlu.)
Pulih: `ssh aleta 'bash /root/abt-x5-20261021/pulih-satker.sh'` (baris terakhir `PULIH COCOK`; berkas dikembalikan lebih dulu, lalu SQL). Gagal sesudah PASANG = pulih otomatis. Tidak perlu memulai ulang apa pun (ABT membaca `abt_variabel` dan RTF setiap cetak). Urutan dengan paket lain: bebas.

## Cara uji ulang di laptop

`bash sumber/uji_lokal.sh semua` (UJI_JUMLAH=2 mempercepat; DB `aps_badilag_x5` = salinan persis `abt_variabel` server, folder blangko uji = salinan persis 7 RTF amplop). `python alat/render_amplop.py <perkara_id>` merender amplop dengan renderer php56 ABT asli (hasil lengkap memuat data pribadi: hanya di `D:/Aplikasi/aleta/tmp/w28-layar`, bukan repo). Dibangun ulang dengan `python sumber/bangun_paket.py` (butuh salinan HEX `abt_variabel` dan 7 RTF server di luar repo; untuk memasang cukup `paket-satker/`).
