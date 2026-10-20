# Ukuran paket U2 (putusan cerai gugat / cerai talak / kumulasi / ikrar), 20 Okt 2026

Semua ukuran atas data NYATA (SIPP server PA Donggala lewat `lihat-jejak.sh`, baca saja; ABT laptop salinan sendiri `aps_badilag_u2`). Berkas mentah di
`abt-paket/u2-putusan-cerai-lengkap/ukuran/`. Alat: `alat/audit_putusan.py`, `ukur_server.py`, `ukur_anak.py`, `uji_server.py`, `render_u2.py`.

## 1. Audit blangko (sebelum)

64 blangko putusan kabul/tolak perceraian (folder 1, 1a, 1c, 1d; keadaan server 17 Okt + paket sampai 19 Okt), kata kunci dikembangkan lewat kueri variabel (`AUDIT.md`).
Bagian wajib yang hilang: **SEMA 1/2022 pada 37 dari 37 putusan kabul**, **tenggang ikrar (Pasal 70 ayat (6)) pada 22 dari 22 putusan kabul cerai talak**,
amar mut'ah/nafkah iddah **tidak ada** pada 4 varian Mut'ah Iddah CT [01] dan 4 varian [01c] (pertimbangannya ada, amarnya tidak);
hanya 10 dari 51 blangko kabul yang dapat memuat hak asuh dan 7 nafkah anak (lainnya tidak punya tempat bila petitum menuntutnya). Bagian lain yang dicek
(kewenangan, legal standing, mediasi, verstek 149 RBg, beban pembuktian, bukti surat, saksi formil dan materiil, fakta hukum, unsur broken marriage, huruf alasan A-H termasuk
C penjara dan H murtad lewat 8531/8532) ADA pada semua putusan kabul; kekurangan kecil pada blangko Tolak "Tidak ada bukti" dan 1c [03b] tercatat di `AUDIT.md`.

## 2. Pembacaan petitum (tuntutan akibat perceraian) atas putusan nyata

Putusan cerai kabul 2023+: 1.619 cerai gugat, 345 cerai talak. Kebenaran dasar = amar hakim (`ukuran/petitum-vs-amar.json`).

| tuntutan | CG petitum+amar | CG petitum saja | CG amar saja | CT petitum+amar | CT petitum saja | CT amar saja |
|---|---:|---:|---:|---:|---:|---:|
| hak asuh | 30 | 10 | 49 | 5 | 2 | 35 |
| nafkah anak | 11 | 3 | 10 | 0 | 0 | 43 |
| nafkah iddah | 4 | 1 | 2 | 3 | 1 | 44 |
| mut'ah | 2 | 1 | 1 | 1 | 1 | 34 |
| nafkah madliyah | 3 | 2 | 0 | 0 | 0 | 24 |
| harta bersama | 0 | 0 | 2 | 0 | 0 | 3 |

- Kolom "petitum+amar" = tuntutan yang dikabulkan hakim dan terbaca di petitum (CG 50, CT 9 tuntutan): semuanya memicu isian keputusan.
- "Petitum saja" (terbaca menuntut tetapi amar tidak memuat) = 21 tuntutan (CG 17, CT 4): dulu diam-diam tidak ditangani blangko biasa; kini muncul `[PERIKSA ...]` yang menahan unggah sampai majelis memilih (ditolak / tidak dapat diterima / dikabulkan).
- "Amar saja" besar pada cerai talak (iddah 44 = 12,8% dari 345; mut'ah 34; nafkah anak 43; madliyah 24): diberikan hakim secara ex officio atau lewat rekonvensi/mediasi, bukan dari petitum.
  Itu sebabnya isian keputusan nafkah iddah dan mut'ah selalu tersedia (opsional) dan ada pilihan "ex officio", serta amar varian Mut'ah Iddah dibuat.
- Perkara yang akan menampilkan isian keputusan / `[PERIKSA]` karena petitum atau rekonvensi atau kumulasi menuntutnya: CG 50 dari 1.619 (3,1%), CT 12 dari 345 (3,5%).

## 3. SEMA 1/2022 (lama pisah rumah minimal 6 bulan) atas isian petugas

`ukuran/sema-lama-pisah.json`: 365 putusan kabul 2023+ yang punya isian alasan di ABT server; 306 berhuruf F; **294 (96,1%) lama pisah memenuhi**, 8 kosong, 4 di bawah 6 bulan
(3 benar-benar kurang: 5 bulan, 2 bulan, 4 bulan; 1 salah ketik "tahuh", kini dikenali). Paragraf muncul pada semua F; `[PERIKSA]` pada 11 (3,6%) yang lama pisahnya kosong atau kurang.

## 4. Pengisi otomatis baru (bot) dan gerbang

Hanya data terstruktur tab Anak SIPP yang ditulis sendiri; keputusan hakim TIDAK pernah diisi mesin.

| isian | sumber | diukur atas | cocok | tingkat |
|---|---|---|---|---|
| 4106 keadaan anak (belum / sudah mumayyiz) | tanggal lahir semua anak di tab Anak, umur penuh | 21 putusan yang amarnya menyebut umur / mumayyiz | **20 (95,2%)**; 1 salah = anak tepat 12 tahun saat putusan, hakim menulis umur saat gugatan | cukup |
| 2004 kini anak diasuh oleh | `diasuh_oleh` tab Anak (1 = P, 2 = T) | 40 putusan yang amarnya menyebut pemegang asuhan | **31 (77,5%)** | **saran saja (ragu)** - di bawah 90% |

Jangkauan: dari 1.124 putusan cerai kabul 2023+ yang punya anak di tab Anak, hanya 300 yang semua anaknya bertanggal lahir (4106 mengisi 251 = 22%); 2004 seragam pada 976.
Entri gerbang (format U6) dan peta fakta siap digabung: `integrasi-u6/gerbang-u2.json`, `peta-fakta-u2.json` (tidak digabung di cabang ini sesuai arahan).

## 5. Render nyata (jalur cetak ABT asli, PHP 5.6) sebelum / sesudah tambal

- Regresi tanpa tuntutan dan tanpa isian: CT [01] Format Lengkap (perkara 10078) berbeda dari sebelumnya HANYA oleh satu paragraf tambahan (izin ikrar + Pasal 70 ayat (6)); CG [01] (10064) **identik byte demi byte** (165.211 = 165.211). Tidak ada "..." atau penanda sisa baru.
- Skenario berisi isian (jalur cetak ABT asli): CG 9089 sebelum majelis memilih = empat baris `[PERIKSA ...]`; sesudah memilih = pertimbangan hak/nafkah lengkap + butir amar (nafkah anak berkenaikan, "Menghukum ... sebelum Tergugat mengambil akta cerai:" dengan rincian berbaris, "Menolak ... selain dan selebihnya"). CT 10078 varian Mut'ah Iddah: amar lama berhenti di butir 3, kini ada butir "Menghukum Pemohon ... sesaat sebelum Pemohon mengucapkan ikrar talak: nafkah iddah, mut'ah". BAS Ikrar "Ada Beban": titik-titik bawaan diganti angka dari putusan.
- Ditemukan dan diperbaiki saat render: nilai variabel yang berakhir pemisah paragraf kehilangan kata pertama paragraf berikutnya (ABT memangkas spasi sesudah perintah RTF paragraf); keluaran kini berakhir grup RTF kosong `{}` (diuji `putusan-cerai-u2-20okt.test.ts`).
- Skenario berisi keputusan: lihat `contoh/` (CG 9089 sebelum dan sesudah majelis memilih; CT 10078 varian Mut'ah Iddah sebelum dan sesudah, amar kini memuat mut'ah dan nafkah iddah).

## 6. Kompatibilitas server

Semua 20 kueri variabel bersambung SQL (pemicu, pertimbangan, amar, rincian ikrar) dijalankan di MariaDB 5.5.68 server (baca saja) atas 3 perkara nyata (60 pemanggilan) tanpa satu galat (`alat/uji_server.py`).
