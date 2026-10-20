# Paket keluarga ANAK (hak asuh, penguasaan anak, nafkah anak) - bagian dari `abt-w2b-keluarga-lain`

Sumber: `sumber/variabel_anak.py` (variabel 4880-4909), `sumber/susun_anak.py` (menyusun semua RTF dari salinan `derry_briantono` server 20 Okt 2026), `daftar-timpa-anak.tsv`,
`timpa/derry_briantono/...` (blangko LAMA versi baru), `rtf/derry_briantono/...` (blangko BARU), `sumber/uji-perkara-anak.txt`. Dirakit agen induk lewat `python sumber/bangun_paket.py`
(PASANG / PERIKSA / PULIH, penjaga md5, cadangan). **Tidak dipasang ke server oleh agen ini.** Susun ulang bila md5 server berubah:
`W2B_ASLI=<folder salinan derry_briantono terbaru> python sumber/susun_anak.py`.

## Temuan audit singkat (apa yang belum ada sebelum paket ini)

| Bagian putusan baku | Keadaan sebelumnya | Sesudah paket |
|---|---|---|
| Umur anak, batas mumayyiz 12 tahun (Pasal 105 KHI), batas dewasa 21 tahun (Pasal 156 huruf d KHI) | hanya kalimat "belum berumur 12 tahun"; tidak dihitung dari tanggal lahir; blangko yang dipilih tidak dicocokkan dengan data | 4880 dan 4909 menghitung umur dari tab Anak SIPP; 4881/4882/4883 memberi `[PERIKSA]` bila blangko tidak cocok dengan tanggal lahir (menahan unggah) |
| Kelayakan pengasuh (jasmani, rohani, waktu, tempat tinggal, ekonomi, akhlak, agama) | tidak ada pertimbangan khusus; hanya "tidak terbukti tidak layak" | isian 4884 (pilihan majelis) + 4885 |
| Pendapat ahli atau laporan lembaga (psikolog, pekerja sosial) | tidak ada | isian 4886 + 4887 |
| Akses bertemu (SEMA 1/2017) | kewajiban umum saja, tanpa rincian | isian 4888 + 4889 (rincian waktu dan cara di pertimbangan dan amar) |
| Penyerahan anak pada putusan hak asuh | hanya di Penguasaan Anak (isian 9720); hak asuh tidak punya | saklar 4890 + 4891/4892/4893/4908, nomor amar biaya 4894/4895 |
| Hak asuh dikabulkan sebagian | hanya ada di Penguasaan Anak dan Nafkah Anak | blangko BARU [01e] (kontradiktoir) dan [01f] (verstek), alasan 4896/4897 |
| Anak sebagian mumayyiz sebagian belum | tidak ada blangko; satu blangko hanya bisa menyatakan salah satu | blangko BARU [01g], penetapan per anak 4905/4906/4907 |
| Anak mumayyiz memilih Tergugat (Penggugat ditolak) | hanya mumayyiz memilih Penggugat (Kabul) | blangko BARU [03c] |
| Kewenangan relatif menurut tempat tinggal anak senyatanya (SEMA 2/2024) | ada di Penguasaan Anak, belum di Hak Asuh | 4898 pada semua putusan Hak Asuh |
| Tuntutan nafkah anak terbaca di petitum tetapi blangko hanya memutus hak asuh | tidak ada peringatan | 4904 `[PERIKSA]` |
| Jumlah nafkah anak yang dimohon dibandingkan dengan yang ditetapkan | tidak ada | isian 4899 + 4900 (sama / lebih rendah / lebih tinggi = `[PERIKSA]`) |
| Ayah hanya mampu sebagian, ibu ikut memikul sisa (Pasal 41 huruf b UU 1/1974) | tidak ada | isian 4901/4902 + 4903 pada Kabul Sebagian nafkah anak |
| Penguasaan Anak: cabut sesudah jawaban, coret panjar habis, NO kurang pihak, NO gugatan kabur | hanya ada di Hak Asuh dan Nafkah Anak | 4 blangko BARU di 6b |
| BAS sidang putusan verstek | amar tanpa rincian akses/penyerahan | amar BAS verstek disamakan dengan putusan |

## Variabel baru (30; tanpa kata aplikasi; kueri hanya SELECT, MariaDB 5.5)

| No | Jenis | Fungsi |
|---|---|---|
| 4880 | SQL | umur setiap anak dari SIPP dan "belum / telah 12 tahun" (pertimbangan mumayyiz) |
| 4881 / 4882 | SQL | `[PERIKSA]` bila tanggal lahir menunjukkan ada anak 12 tahun ke atas (blangko belum mumayyiz) / ada anak di bawah 12 tahun (blangko mumayyiz memilih) |
| 4883 | SQL | `[PERIKSA]` bila ada anak berumur 21 tahun atau lebih |
| 4884 / 4885 | isian / SQL | kelayakan calon pemegang hadhanah |
| 4886 / 4887 | isian / SQL | pendapat ahli atau laporan lembaga |
| 4888 / 4889 | isian / SQL | rincian akses bertemu (", dengan ketentuan ...") |
| 4890 | isian | saklar penyerahan anak: 1 = dimohonkan, 2 = ditetapkan hakim, kosong = tidak ada |
| 4891 / 4908 | SQL | amar penyerahan anak, butir 3 (kontradiktoir) / butir 4 (verstek) |
| 4892 / 4893 | SQL | pertimbangan penyerahan / kalimat penyerahan di pertimbangan akhir |
| 4894 / 4895 | SQL | nomor amar biaya perkara (3 atau 4 / 4 atau 5) menyesuaikan ada tidaknya butir penyerahan |
| 4896 / 4897 | isian / SQL | alasan petitum selebihnya ditolak (kabul sebagian hak asuh); kosong = kalimat bawaan |
| 4898 | SQL | pertimbangan kewenangan relatif menurut tempat tinggal anak senyatanya (isian lama 9592) |
| 4899 / 4900 | isian / SQL | jumlah nafkah yang dimohon dan perbandingan dengan isian 9740 |
| 4901 / 4902 / 4903 | isian / isian / SQL | ayah hanya mampu sebagian, bagian yang dipikul ibu, pertimbangannya |
| 4904 | SQL | `[PERIKSA]` bila petitum memuat nafkah anak padahal blangko hanya memutus hak asuh / penguasaan anak |
| 4905 / 4906 / 4907 | isian / SQL / SQL | penetapan per anak (satu anak satu baris), amar dan pertimbangannya |
| 4909 | SQL | umur anak terhadap batas dewasa 21 tahun (pertimbangan nafkah) |

Isian (data_teks): 4884, 4886, 4888, 4890, 4896, 4899, 4901, 4902, 4905. Semua kosong = bagian itu tidak tercetak dan blangko lama tampil seperti sebelumnya
(kecuali kalimat umur anak dan kewenangan relatif yang selalu tampil bila datanya ada). **Keputusan hakim tetap pilihan hakim**: tidak ada isian yang diisi mesin dari paket ini.

## Blangko LAMA yang ditambal (28; md5 lama dan baru di `daftar-timpa-anak.tsv`)

- 6a Hak Asuh: [01] [01a] [01b] [01c] [01d] (umur, peringatan, kelayakan, ahli, relatif, akses rinci, penyerahan, nomor biaya), [02] [02a] [02b] (hak asuh + nafkah: tanpa penyerahan), [03] [03a] [03b] (tolak: umur, kelayakan, ahli, relatif, akses di [03a]).
- 6b Penguasaan Anak: [01] [01a] [01b] [01c] [01d] [02] [02b] [03] [03a] (umur, kelayakan, ahli, akses rinci; penyerahan tetap memakai saklar 9720 yang sudah ada).
- 6c Nafkah Anak: [01] [01a] [01b] [02] [02b] (umur anak 21 tahun, perbandingan jumlah, ibu ikut memikul pada Kabul Sebagian).
- BAS sidang putusan verstek: 6a ALUR 38 (1 berkas), 6b ALUR 44 (2 berkas).
- Tidak diubah: 1d Putusan Cerai Gugat Kumulasi Hak Asuh Anak (gelombang 1), blangko perdamaian/cabut/gugur/coret/NO yang sudah ada.

## Blangko BARU (8; hanya `derry_briantono`)

- 6a: `[01e] [Kabul Sebagian] Hak Asuh - Kontradiktoir - Petitum Selebihnya Ditolak`, `[01f] [Kabul Sebagian Verstek] Hak Asuh - T Tidak Hadir - Petitum Selebihnya Ditolak`,
  `[01g] [Kabul] Hak Asuh - Kontradiktoir - Anak Sebagian Mumayyiz (Penetapan per Anak)`, `[03c] [Tolak] Hak Asuh - Kontradiktoir - Anak Mumayyiz Memilih Tergugat`.
- 6b: `[98b] [Cabut] Gugatan - Sesudah Jawaban dengan Persetujuan T`, `[98c] [Coret] Gugatan - Dibatalkan dari Pendaftaran - Panjar Habis`,
  `[99a] [NO] Gugatan - Kurang Pihak (Plurium Litis Consortium)`, `[99b] [NO] Gugatan - Gugatan Kabur (Obscuur Libel)` (sama dengan 6a, hanya sebutan perkara).

## Yang diuji

- SQL: seluruh variabel data_sql dijalankan di SIPP server (MariaDB 5.5.68, baca saja) atas perkara cerai yang punya tab Anak bertanggal lahir (10135, 9963, 10090, 9306) dan perkara tanpa anak: tanpa galat;
  cabang isian (4885-4909) diuji di MariaDB lokal (`sipp_donggala`, isian uji ditulis lalu dihapus), termasuk perbandingan nafkah (sama, lebih rendah, lebih tinggi, angka tak terbaca). Alat: `alat/anak_ujisql.py`.
- Render nyata (php56, aplikasi ABT salinan, basis sementara dengan definisi variabel dari server, perkara 10135): 28 blangko ditambal + 8 blangko baru = 36 berkas, semua `OK`, tanpa penanda tersisa;
  `[PERIKSA]` hanya muncul pada kasus yang memang tidak cocok (anak di bawah 12 tahun pada blangko mumayyiz memilih; isian 4905 kosong pada [01g]). Perbandingan keadaan isian kosong:
  blangko asli dan blangko ditambal berbeda hanya oleh kalimat umur anak dan kewenangan relatif (hak asuh). Tanpa perubahan lain pada teks asli (diperiksa per paragraf: buang penanda baru = teks asli).
  Alat: `alat/anak_render.py`. Batas: variabel yang memakai fungsi basis server (posita/petitum rapi, keterangan saksi) diganti teks pengganti di rig lokal.
- Paket: `python sumber/bangun_paket.py` membangun (30 variabel, 8 baru, 28 timpa, 165 variabel lama dirujuk, semuanya ada di server); PRASYARAT `0|0|165|0|0`, PASANG, PERIKSA `SEMUA COCOK`, PASANG ulang `0|30|165|0|0`,
  PULIH `PULIH COCOK` diuji di MariaDB lokal. `alat/anak_periksa_paket.py` memeriksa nama <= 200, hanya SELECT, tanpa kata aplikasi, penanda tidak terpecah, md5 daftar timpa.
- `alat/anak_cekmd5.py`: md5 LAMA 28 berkas di daftar-timpa-anak.tsv sama dengan md5 berkas di server pada 21 Okt 2026 pukul 00.50 (BACA SAJA).

## Batas data (jujur)

Di SIPP server dan lokal perkara jenis 349 / 350 / 351 / 743 berjumlah 0 (hak asuh memakai 369 Lain-Lain tanpa jenis mandiri), sehingga ukuran memakai perkara cerai gugat/talak yang memuat
hak asuh atau nafkah anak. Tanggal lahir anak terisi pada sekitar seperempat baris tab Anak di server; bila kosong, 4880/4909/4881-4883 diam (tidak ada kalimat).
Belum ada putusan hak asuh/nafkah anak hasil blangko ini yang sudah dibandingkan dengan putusan hakim; semua uji di atas atas data nyata tetapi bukan perbandingan atas amar.

## Belum dikerjakan

- Bagian "Dalam Eksepsi" pada seluruh putusan kontradiktoir Derry (tidak ada blangko yang memuatnya; berlaku lintas jenis perkara).
- Hak asuh yang diajukan kerabat (nenek, bibi: Pasal 156 huruf a KHI angka 1-6) - peran para pihak dan susunan BAS berbeda, perlu blangko tersendiri.
- Blangko "Nafkah Anak Oleh Ibu karena Ayah tidak mampu" (jenis 350) sebagai perkara mandiri: arah tuntutan (siapa Penggugat) perlu dipastikan dari praktik sebelum ditulis; sementara tercakup sebagian oleh 4901-4903.
- Penyerahan anak pada putusan Hak Asuh dan Nafkah Anak ([02]), Kabul Sebagian verstek ([01f]) dan campuran ([01g]) - butir amar sudah bernomor tetap.
- BAS Hak Asuh/Penguasaan Anak/Nafkah Anak lain (bukan sidang putusan verstek) tidak berubah.
