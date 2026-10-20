# Paket W2b-C: keluarga LAIN-LAIN (pengangkatan anak, mafqud, permohonan umum)

Agen W2b-C, 21 Okt 2026. Diperlukan rakitan agen induk (`python sumber/bangun_paket.py` dari folder ini membuat `paket-satker/`; JANGAN di-commit). Tidak ada yang dipasang ke server oleh agen ini.

## Variabel ABT baru (jatah 4910-4939, 26 variabel)
| No | Jenis | Isi |
|---|---|---|
| 4910-4915 | data_teks | pengangkatan anak: sejak kapan diasuh, alasan penyerahan, riwayat perkawinan-anak kandung, izin instansi sosial, penghasilan, tujuan |
| 4916 | data_sql | hubungan Pemohon dengan anak (dari 8623; kosong -> tanda PERIKSA) |
| 4917 | data_sql | pertimbangan syarat calon anak angkat (Pasal 12 PP 54/2007) |
| 4918 | data_sql | pertimbangan syarat calon orang tua angkat (Pasal 13 PP 54/2007; umur di luar 30-55 -> PERIKSA) |
| 4919 | data_sql | pertimbangan akibat hukum (nasab, wasiat wajibah, wali nikah, pemberitahuan asal-usul) |
| 4920-4923 | data_teks | mafqud: umur-pekerjaan-alamat, keluarga ditinggalkan, harta ditinggalkan, sebab kepergian |
| 4924, 4925 | data_sql | mafqud: kalimat bersyarat (kosong bila 4920-4923 kosong) |
| 4930-4934 | data_teks | permohonan umum: hal dimohonkan, waktu-tempat, bukti surat, keperluan, sebab meninggal-makam |
| 4935-4939 | data_teks | permohonan umum: dasar kewenangan, kedudukan-kepentingan hukum, fakta terbukti, amar pokok, alasan penolakan (isian hakim) |

Nomor 4926-4929 dan 4940-4949 tidak terpakai oleh keluarga ini.

## Blangko (hanya folder Derry)
- **BARU** `9b Permohonan Umum/[01] [Kabul] Permohonan Umum - Permohonan Dikabulkan.rtf` dan `[03] [Tolak] Permohonan Umum - Dalil Permohonan Tidak Terbukti.rtf` (sebelumnya folder hanya punya Cabut/Coret/Gugur/NO-tidak-hadir). Berbasis struktur 9c Mafqud (saksi dari BAS: 9259/9260), diubah universal; hal yang berbeda tiap jenis permohonan menjadi isian hakim.
- **DIPERBARUI** (timpa, penjaga md5 server 20 Okt 22.50): `9a Lain-Lain (Pengangkatan Anak)/[01] [Kabul] Pengangkatan Anak.rtf` (md5 lama bbe999e8d25574827fca833ff048c8fa): disisipkan 4917, 4918, 4919 dan kalimat hubungan keluarga memakai 4916; tidak ada yang dihapus.
- **DIPERBARUI** `9c Penetapan Mafqud/[01] [Kabul] ...rtf` (md5 lama 3568b0132ff21b096ceda6cb03cf5e7f): kalimat bersyarat 4924 dan 4925 (kosong bila isiannya kosong).
- Daftar: `daftar-timpa-lain.tsv`, sumber penyusun: `sumber/susun_lain.py` (env `W2B_ASLI` = salinan derry_briantono terbaru; ULANGI bila md5 server berubah), `susun_lain_umum.py`, `susun_lain_mafqud.py`.

## Yang diuji
- `python sumber/bangun_paket.py`: variabel 26, rtf baru 2, timpa 2, variabel lama dirujuk 83 (semua ada di server).
- PRASYARAT/PASANG (dua kali)/PERIKSA/PULIH atas MariaDB lokal (salinan abt_variabel + 19 variabel lama yang belum ada di ABT lokal): `0|0|83|0|0` -> `0|26|83|0|0` -> **SEMUA COCOK** -> **PULIH COCOK**.
- Kueri data_sql 4916-4919, 4924, 4925 dijalankan di SIPP server baca-saja (alat/uji_sql.py) dengan nilai isian contoh dan dengan isian kosong; `sumber/uji-perkara-lain.txt` berisi 7 nomor perkara nyata untuk uji kueri oleh pasang-satker.sh.
- Render penuh dengan php56: lihat bagian "Render" di bawah.

## Katalog saksi (ekstensi-sipp/saksi-katalog, versi 2)
pengangkatan-anak 24 -> 66 butir (+42, 24 pokok baru, 3 keadaan baru); mafqud 14 -> 42 (+28); permohonan-umum 11 -> 40 (+29). Cadangan v1 di `cadangan-katalog/`. Data ekstensi (`saksi-katalog-data.js`) sudah dibangun ulang pada commit ini; agen induk membangun ulang lagi saat menggabung.

## Sambungan yang harus disatukan agen induk
1. `aleta_bot/services/isiOtomatisJenisS6.js`: SATU baris di `usulanDariKonteks` sesudah pembacaan akad ekonomi syariah: `tambah(require("./isiOtomatisW2b/lain").usulanLain(k, butir));`
2. `manajemen_surat/src/app/api/aleta-ecourt/blangko-derry/isian-metadata.ts`: blok baru di akhir `ISIAN_MANUAL` (4930, 4932, 4935-4939) dan `ISIAN_OPSIONAL` (4910-4915, 4920-4923, 4931, 4933, 4934).
3. `untuk-sesi-utama/lain-peta-fakta.json` -> `aleta_bot/config/peta-fakta-variabel.json`; `untuk-sesi-utama/lain-gerbang.json` -> `gerbang-isian.json` (SEMUA berstatus saran; jangan dinaikkan).

## Yang belum / batas jujur
- Tidak ada perkara mafqud nyata; hanya 6 pengangkatan anak dan 1 penetapan kematian. Ukuran = kecocokan dengan pelabelan manual (bukan isian petugas; kode baru belum pernah diisi).
- 4918 menandai [PERIKSA] bila umur Pemohon I menurut SIPP di luar 30-55; ketentuan pengecualian PP 54/2007 belum diperiksa. Untuk dua Pemohon hanya umur Pemohon I yang tersedia (variabel 0099).
- Pasal 209 KHI, Pasal 19-23 KHI, Pasal 40 UU 35/2014, kewenangan PA atas penetapan kematian: perlu-verifikasi (lihat `docs/gelombang2/PERIKSA-PASAL-W2b-lain.md`).
- Blangko Tolak/NO pengangkatan anak (9a [03], [99]) dan BAS tidak diubah; mafqud [03] dan [99] tidak diubah.
- Hak asuh yang terdaftar sebagai 369 memakai katalog hak-asuh milik W2b-B (tidak disentuh).
