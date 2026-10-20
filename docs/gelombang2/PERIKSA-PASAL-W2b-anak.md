# Daftar periksa rujukan hukum - W2b keluarga ANAK (hak asuh, penguasaan anak, nafkah anak)

Agen W2b-B, 21 Okt 2026. Cabang `fitur/w2b-keluarga-lain-b`. Pengguna: rujukan dianggap benar tanpa menunggu; daftar ini tetap dibuat agar sumbernya bisa dicocokkan kemudian.
Rujukan untuk blangko putusan (RTF dan variabel ABT) ada di berkas pendamping `PERIKSA-PASAL-W2b-anak-putusan.md` (sub-agen audit putusan).

Aturan yang dijaga mesin katalog (`periksaKatalog`, diuji di `w2b-anak-katalog-21okt.test.ts`): rujukan berstatus `perlu-verifikasi` hanya menjadi metadata panel dan pertimbangan; **tidak pernah tercetak** di pertanyaan, jawaban saksi atau catatan petugas. Jawaban saksi tidak menyebut nomor pasal sama sekali.

## 1. Rujukan baru di katalog saksi

| id katalog | rujukan | isi singkat | status | sumber | dipakai di | tercetak |
| --- | --- | --- | --- | --- | --- | --- |
| `dh-khi-77-3` | Pasal 77 ayat (3) Kompilasi Hukum Islam | suami istri wajib mengasuh dan memelihara anak-anak mereka (pertumbuhan jasmani, rohani, kecerdasan dan pendidikan agama) | perlu-verifikasi | pengetahuan hukum; cocokkan dengan naskah KHI (Inpres 1/1991) | hak-asuh, penguasaan-anak, nafkah-anak (pokok pembuktian kondisi anak, pendidikan, kebutuhan) | panel saja |
| `dh-khi-98` | Pasal 98 ayat (1) KHI | batas usia anak mampu berdiri sendiri atau dewasa 21 tahun, selama tidak bercacat fisik atau mental atau belum pernah menikah | perlu-verifikasi | pengetahuan hukum; cocokkan dengan naskah KHI | hak-asuh (kecuali nama), nafkah-anak (pokok batas waktu nafkah) | panel saja |
| `dh-khi-149-d` | Pasal 149 huruf d KHI | bekas suami wajib memberi biaya hadhanah bagi anak yang belum 21 tahun | perlu-verifikasi | pengetahuan hukum; cocokkan dengan naskah KHI | nafkah-anak (pokok batas waktu nafkah) | panel saja |
| `dh-uupa-26` | Pasal 26 ayat (1) UU 23/2002 sebagaimana diubah UU 35/2014 tentang Perlindungan Anak | orang tua berkewajiban dan bertanggung jawab mengasuh, memelihara, mendidik dan melindungi anak | perlu-verifikasi | pengetahuan hukum; cocokkan dengan naskah UU 35/2014 | hak-asuh, penguasaan-anak, nafkah-anak (pokok pendidikan, kesehatan) | panel saja |
| `dh-ha-mumayyiz-didengar` | Pasal 105 huruf b dan Pasal 156 huruf b KHI (lanjutan) | anak mumayyiz berhak memilih ayah atau ibu; pilihan didengar hakim langsung, keterangan saksi hanya pelengkap | terverifikasi | rumusan sama dengan `dh-khi-105` dan `dh-khi-156` yang sudah terverifikasi di katalog hak-asuh | hak-asuh (pokok alasan dan kemandirian pilihan anak) | panel saja |

## 2. Rujukan lama yang dipakai pokok pembuktian baru (tidak berubah, sudah terverifikasi di katalog lama)

Pasal 41 huruf a, b, c dan Pasal 45 UU 1/1974 (`dh-uu1-41-45`, `dh-uu1-41-45-nafkah`); Penjelasan Pasal 49 huruf a angka 11 dan 12 UU 7/1989 jo. UU 3/2006 (`dh-penjelasan-49-11`, `dh-penjelasan-49-12`); Pasal 1 huruf g, Pasal 80 ayat (4), Pasal 105 dan Pasal 156 KHI (`dh-khi-1g`, `dh-khi-80-4`, `dh-khi-105`, `dh-khi-156`, `dh-khi-105-156`); SEMA 1/2017 angka 4 (akses), SEMA 2/2024 (tempat tinggal anak), SEMA 1/2025 angka 1 (penyerahan), SEMA 3/2015 angka 14 dan angka 11, SEMA 3/2018 huruf b, SEMA 2/2019 huruf a, SEMA 5/2021 (`dh-sema-*`); Pasal 2 dan Pasal 14 ayat (1) UU 23/2002 jo. UU 35/2014 (`dh-uupa-terbaik`); Buku II 2026 (`dh-buku2-2026-28`, `dh-buku2-2026-25-27`, status perlu-verifikasi sejak katalog lama). Sumber naskah masing-masing tertulis di berkas katalog (`dasarHukum[].sumber`).

## 3. Pokok pembuktian baru dan dasar hukumnya

- Hak asuh (18 pokok baru): identitas anak, perpisahan, kesehatan jasmani, rohani dan agama, pendidikan, akhlak pengasuh, waktu, tempat tinggal, ekonomi, keadaan pihak yang dipersoalkan, keselamatan jasmani rohani (Pasal 156 huruf c KHI), ikatan batin, pilihan anak mumayyiz, pelaksanaan akses (SEMA 1/2017), keutuhan saudara, kerabat pengaju (Pasal 156 huruf a KHI), perubahan keadaan, kesepakatan keluarga.
- Penguasaan anak (17 pokok baru): cara anak sampai dikuasai (dibawa pergi, tidak dikembalikan, dititipkan lalu ditahan, diambil paksa), lamanya dan keberadaan anak, permintaan dan penolakan penyerahan (SEMA 1/2025 angka 1, SEMA 3/2018), penghalangan bertemu, keadaan anak selama dikuasai, kecakapan penguasa dan kesiapan penuntut, ikatan batin, pilihan anak, keadaan yang membahayakan, saudara kandung, kesepakatan keluarga.
- Nafkah anak (21 pokok baru): kebutuhan pokok, sekolah, kesehatan, penghasilan ayah menurut jenisnya (pegawai tetap, usaha sendiri, buruh harian, tidak diketahui), gaya hidup dan harta, tanggungan lain, kemampuan ibu ikut menanggung (Pasal 41 huruf b UU 1/1974), kepedulian ayah, pengabaian nafkah, permintaan dan tanggapan ayah, penetapan atau kesepakatan sebelumnya, jumlah yang dituntut dan perbandingannya (SEMA 3/2018 huruf b, SEMA 3/2015 angka 14), batas waktu sampai dewasa atau mandiri (Pasal 98 dan 149 huruf d KHI), rincian nafkah lampau (SEMA 2/2019 huruf a), kebutuhan meningkat, upaya kekeluargaan.

## 4. Catatan jenis perkara

- Hak asuh tidak punya jenis perkara mandiri di SIPP: di PA Donggala didaftar `369 Lain-Lain` (katalog memakai pola nama dan alur).
- Penguasaan anak = jenis `349`.
- Nafkah anak = jenis `350` ("Nafkah Anak Oleh Ibu karena Ayah tidak mampu") dan `743` ("Nafkah Anak Pasca Perceraian"); angka 743 yang disebut tugas adalah **id jenis perkara**, bukan alur atau kode lain. Hak-hak bekas istri dan kewajiban bekas suami (`351`) tidak dicakup katalog nafkah anak.
- SIPP lokal dan server: jenis 349, 350, 351 dan 743 berjumlah **0** perkara; pengujian memakai petitum hak asuh dan nafkah anak di perkara cerai.
