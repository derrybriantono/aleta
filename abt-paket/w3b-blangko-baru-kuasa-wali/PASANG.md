# Paket ABT `abt-w3b-blangko-baru-kuasa-wali` - blangko Derry BARU: kuasa asuh/wali, penunjukan wali, ganti rugi wali, nafkah anak oleh ibu, eksekusi, verzet (agen W3b, 21 Okt 2026)

**Status: teruji di ABT LAPTOP (PRASYARAT, pasang, pasang ulang, periksa, pulih) dan di renderer php56 asli (19 blangko contoh); PRASYARAT dan kueri variabel dijalankan BACA SAJA di server (MariaDB 5.5). Server: BELUM dipasang - dipasang sesi utama.**
Hanya blangko, variabel, dan menu Derry; tidak ada berkas, folder, variabel, atau baris lama yang diubah. Tanpa kata "Aleta"/"ALETA" di ABT.

## Isi

| yang | jumlah | nomor / nama |
|---|---|---|
| Jenis | 7 | 353 pencabutan kekuasaan orang tua, 355 pencabutan kekuasaan wali, 356 penunjukan orang lain sebagai wali oleh pengadilan, 357 ganti rugi terhadap wali, 350 nafkah anak oleh ibu karena ayah tidak mampu, EKSEKUSI, VERZET |
| Folder baru | 14 | `6d Pencabutan Kekuasaan Orang Tua`, `6e Pencabutan Kekuasaan Wali`, `6f Penunjukan Wali oleh Pengadilan`, `6g Ganti Rugi terhadap Wali`, `6h Nafkah Anak oleh Ibu`, `96 Eksekusi`, `96a Verzet` - masing-masing + ` - BAS` |
| Blangko RTF baru | 274 | 6d 61 (15 putusan + 46 BAS), 6e 61, 6f 13, 6g 50, 6h 50, 96 16, 96a 23 |
| Variabel baru | 181 | 3800-3999 (353: 3800-3819, 355: 3830-3859, 356: 3860-3889, 357: 3890-3919, 350: 3920-3939, eksekusi: 3940-3969, verzet: 3970-3999) |
| Menu baru | 14 | `abt_menu` id 240-253: pasangan "<Jenis> - Putusan" (grup `1\|10\|20`, top `1`) dan "<Jenis> - BAS" (grup `1\|30\|500\|430\|1000\|1010\|1020`, top `1\|30`, validator `10\|20`) |
| ALUR BAS portal | 7 | 70 (353), 71 (355), 72 (356), 73 (357), 74 (350), 75 (eksekusi), 76 (verzet) |
| Katalog saksi | 4 | `pencabutan-kuasa-asuh`, `pencabutan-kuasa-wali`, `penunjukan-wali`, `ganti-rugi-wali` (350 memakai `nafkah-anak` W2b; eksekusi dan verzet tanpa saksi) |

Berkas di `paket-satker/`: `...-PRASYARAT.sql`, `...-PASANG.sql`, `...-PERIKSA.sql`, `...-PULIH.sql`, `rtf/`, `berkas_rtf.py`, `pasang-satker.sh`, `pulih-satker.sh`, `folder-baru.txt`, `folder-ada.txt`, `daftar-rtf.tsv`, `uji-kueri.tsv`, `MD5SUMS.txt`. Dibangun ulang dengan `python sumber/bangun_semua.py` lalu `python sumber/bangun_paket.py` (`rtf/` di akar paket = keluaran penyusun, di-.gitignore; `paket-satker/rtf/` = salinan yang DIPASANG dan ikut git, 274 berkas, md5 di `daftar-rtf.tsv`/`MD5SUMS.txt`). Penyusun bergantung pada salinan blangko Derry server di `D:/aleta-dev/kerja/w3b-asli-server` (di luar repo); untuk memasang cukup `paket-satker/`, tidak perlu membangun ulang.

## Pasang (Git Bash, server hidup)

```bash
cd /d/aleta-dev/wt/w3b-blangko-baru-kuasa-wali/abt-paket/w3b-blangko-baru-kuasa-wali     # atau folder repo hasil gabung
ssh aleta 'mkdir -p /root/abt-w3b-20261021'
scp -r paket-satker/* aleta:/root/abt-w3b-20261021/
ssh aleta 'cd /root/abt-w3b-20261021 && md5sum -c MD5SUMS.txt | grep -v OK'     # harus kosong
ssh aleta 'bash /root/abt-w3b-20261021/pasang-satker.sh'
```
Keluaran benar: `PRASYARAT COCOK (0|0|275|0|0)`, `BERKAS SIAP`, `SEMUA COCOK`, baris `uji perkara NNNN: 38xx ...`, 14 baris `FOLDER BARU`, `BUAT=274`, `COCOK=274`, `BERKAS COCOK`, `SELESAI`.
Pulih: `ssh aleta 'bash /root/abt-w3b-20261021/pulih-satker.sh'` (akhir `PULIH COCOK`, `BERKAS PULIH`, 14 `FOLDER DIHAPUS`).
Sesudah pasang di server: tanam ekstensi dan portal (lihat "Sambungan portal" di bawah) dan jalankan `ssh aleta 'ls "/var/www/html/aps_badilag/_blangko_abt/derry_briantono" | grep -E "^(6[d-h]|96)"'`.

**Prasyarat server (sudah dicek 21 Okt 2026 baca saja):** `PRASYARAT` = `0|0|275|0|0`: jatah 3800-3999 kosong, 275 variabel lama yang dirujuk blangko ADA, menu 240-253 dan 14 folder tidak dipakai. Paket gelombang 1 (U4: variabel 4406/4407; 9250-9260) harus sudah terpasang - sudah.

## Tidak bentrok dengan paket gelombang lain (diperiksa 21 Okt)

| paket | menu | ALUR BAS | variabel | folder |
|---|---|---|---|---|
| W3a (perkawinan) | 168-179 | 60-65 | 3600-3791 | 1e, 1f, 3a, 5c, 5d, 8a |
| W2a (kebendaan) | tanpa | tanpa | 4750-4849 | menyunting 4a-4e |
| W2b | tanpa | tanpa | 4850-4949 | 9a-9c |
| **W3b (ini)** | **240-253** | **70-76** | **3800-3999** | **6d-6h, 96, 96a** |

**ALUR BAS paket ini sengaja 70-76**, bukan 60-66: W3a sudah memakai 60-65 untuk id/nomor ALUR di portal (`alur-60` ... `alur-65`); dua paket dengan id sama akan saling menimpa di `ALUR_BAS_BARU`. Bila sesi utama memutuskan lain, ubah angka `alur=` di `sumber/jenis.py` (satu tempat), jalankan ulang `bangun_semua.py`, `bangun_paket.py`, `bangkitkan_ts.py`, `node alat/cermin_peta.mjs`, `alat/buat_fixture_uji.py`, dan ganti `alur-7x` di `manajemen_surat/src/lib/alur-bas-baru.ts` (peta `ID_KELUARGA`/`gugatanKeluarga`) serta katalog saksi `ekstensi-sipp/saksi-katalog/*.json` (nama berkas BAS memuat nomor ALUR).

## Hasil uji (21 Okt 2026)

- **ABT laptop** (MariaDB 10.4, DB `aps_badilag_w3b` = 1898 variabel stub + 109 menu server): `PRASYARAT COCOK (0|0|275|0|0)` -> pasang -> `SEMUA COCOK`, `BUAT=274 COCOK=274`, pasang ulang `(0|181|275|0|14)` `SUDAH_BARU=274`, pulih `PULIH COCOK` (keadaan kembali persis: 1898 variabel, 109 menu, 14 folder dihapus). `alat/siapkan_db_uji.py` menyiapkan DB, `D:/aleta-dev/kerja/w3b-uji-lokal.sh` menjalankan.
- **Server baca saja:** `PRASYARAT` = `0|0|275|0|0`; kueri `data_sql` tiap jenis dijalankan atas perkara nyata (`spek/uji_umum.py`, `spek/uji_<jenis>.py`): 353 lolos 0 kegagalan; 357 perkara 10096 dan delapan skenario isian; eksekusi 63 kueri (perkara 6326, 6952, 7900); verzet 67 pemeriksaan (perkara 9321).
- **Renderer php56 ABT asli** (`alat/render_w3b.py`, `alat/render_contoh.py`; salinan aplikasi ABT + basis `aps_badilag_w3brender` berisi 527 definisi variabel dari server): 19 blangko contoh (2-3 per jenis; eksekusi atas perkara eksekusi nyata 6326/6952/7900, verzet atas perkara 9321, lainnya atas perkara Pdt.G 7900 dan Pdt.P 9592 sebagai bahan tiruan) - **semua `OK`, 0 token `#nnnn#` tersisa, 0 `DATA_TIDAK_ADA`, 0 `ERROR`**. Cara: `python alat/render_w3b.py siapkan` (sekali), `python alat/render_contoh.py <keluar>`.
- **Portal:** `npx tsc --noEmit` bersih. Uji sasaran (vitest satu pekerja): `w3b-blangko-baru-21okt.test.ts` (baru, 23 butir), `salinan-bas-jenis`, `tipe-keluaran-cermin-ekstensi`, `alur-bas-baru`, `pemetaan-*` (f21, f22, i8, i17, i19, i23, q3, blangko-2okt), `ekstensi-peta-blangko-status-cerai`, `paket-abt-u4-dk-wali-perwalian-20okt`, `pandu-saksi` hijau; uji penuh TIDAK dijalankan (atas aturan).

## Sambungan portal dan ekstensi (sudah di cabang `fitur/w3b-blangko-baru-kuasa-wali`)

- Portal: `tugas-blangko.ts` (JENIS_FOLDER), `pohon-blangko.ts` (SET_BLANGKO), `rekomendasi-blangko.ts` (FOLDER_MENU_W3B), `pemetaan-blangko.ts` (kunci baku putusan + BAS, JENIS_BAS_BAKU), `keadaan-putusan.ts` (permohonan vs gugatan), `alur-bas-baru.ts` + `alur-bas-w3b-data.ts` (ALUR 70-76), `salinan-bas-jenis-data.ts`, `pandu-saksi.ts` (jenis 350/353/355/356/357), `w3b-jenis-data.ts`, `ramah-w3b.ts` + `susun.ts` (label isian awam), `tipe-keluaran/validasi.ts` (batas kunci peta 80 -> 120 huruf: kunci jenis panjang mencapai 94), `bawaan-ekstensi.ts` (cermin +84 entri).
- Ekstensi: `panel-alat.js` (peta bawaan blok W3b), `abt.js`, `saksi-katalog-data.js` (+4 katalog), `aleta_bot/services/pertanyaanSaksiService.js`. Sudah ditanam ke `ekstensi-berkas.ts` (`ALETA_TANAM_PAKSA=1 node scripts/rilis-ekstensi.mjs --tanpa-uji`, versi TIDAK dinaikkan, `catatan-ekstensi.ts`/`patch-notes.ts` tidak disentuh). **Sesi utama:** naikkan versi ekstensi dan tulis catatan bila rilis.
- Fixture uji bersama `manajemen_surat/src/test/fixtures/blangko-derry-server-17okt.json` ditambah 274 berkas + 14 menu paket ini (`alat/buat_fixture_uji.py`, idempoten); beberapa uji berhitungan tetap disesuaikan (lihat commit).
- Gabung dengan cabang lain: titik rawan konflik = `bawaan-ekstensi.ts`, `panel-alat.js`, `alur-bas-baru.ts`, `pemetaan-blangko.ts`, `salinan-bas-jenis-data.ts`, tes berhitungan tetap (`salinan-bas-jenis`, `alur-bas-baru`, `pemetaan-*`, `tipe-keluaran-cermin-ekstensi`), dan fixture. Bangkitkan ulang dari sumber (`bangkitkan_ts.py`, `cermin_peta.mjs`) lebih aman daripada menyelesaikan konflik tangan.

## Keterbatasan (jujur)

- **Belum pernah dipakai.** SIPP tidak punya perkara jenis 353/355/356/357/350; verzet 1 perkara (9321), eksekusi 3 perkara. Gugatan/permohonan kuasa asuh/wali diuji dengan masukan buatan; hasil pada perkara sungguhan belum terlihat. Rujukan hukum: `docs/gelombang3/PERIKSA-PASAL-W3b.md` (pasal dianggap benar tanpa menunggu, tetapi butir "perlu-verifikasi" mohon dibaca hakim).
- **Eksekusi dan verzet bukan jenis perkara SIPP:** menu ABT memilih berdasar tahapan proses (eksekusi 600-645, verzet 240-280, `alur_perkara_id`); portal TIDAK menyarankan blangko ini otomatis (hanya menu, folder, tugas Blangko Derry, dan 7 ALUR BAS). Nama menu putusan eksekusi "Putusan Eksekusi" berisi penetapan Ketua.
- **Verzet:** penetapan majelis dan hari sidang verzet (P1) tidak dibuat (jatah variabel habis); saksi Pelawan memakai variabel sisi T dan saksi Terlawan sisi P perkara asal; majelis lama tidak terbaca (putusan verzet memakai 3995-3997); mediasi PERMA 1/2016 tidak dicetak. Rincian lain: laporan agen verzet dan `spek/PASAL-verzet.md`.
- **Eksekusi:** alamat para pihak dicetak apa adanya dari SIPP (duplikasi wilayah bisa terjadi) dan hanya bila pihak tiga atau kurang (batas GROUP_CONCAT 1024); bila satu perkara punya beberapa eksekusi, yang tercetak adalah yang terakhir diinput.
- **Variabel penolong tidak terpakai blangko:** 3916, 3925, 3926, 3927 (angka bertitik/murni turunan) disediakan untuk hakim yang ingin menyisipkan sendiri; tidak ada blangko yang merujuknya (peringatan `bangun_paket.py`).
- **Server memakai perl tanpa `Digest::MD5` dan python 2.7:** `pasang-satker.sh` dan `berkas_rtf.py` mengikuti kebiasaan paket-satker terdahulu; belum dijalankan DI server (hanya laptop dan baca-saja).
- Uji `penetapan-ttd-cap-6okt.test.ts` (regex `tetapkanLewatAleta` di `konten.js`) merah SEJAK sebelum paket ini (cabang dasar menambah `!opsi.tanpaEdocOtomatis`), bukan akibat paket ini.
