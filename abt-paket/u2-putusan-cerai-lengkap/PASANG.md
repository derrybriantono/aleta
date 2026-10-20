# Paket ABT "u2-putusan-cerai-lengkap" (agen U2, 20 Okt 2026)

Melengkapi blangko putusan **cerai gugat, cerai talak, kumulasi dan ikrar** Derry terhadap susunan putusan baku. HANYA blangko dan variabel
Derry; tanpa kata aplikasi di ABT. **Laptop: teruji (DB uji salinan sendiri). Satker: BELUM dipasang** (dipasang sesi utama).

## Yang ditambahkan

| bagian putusan | variabel baru | di blangko mana |
|---|---|---|
| SEMA 1/2022 (perselisihan terus-menerus dikabulkan bila terbukti berselisih / pisah rumah minimal 6 bulan), hanya alasan huruf F; lama pisah dinilai dari isian lama pisah | 4118 | putusan kabul yang punya `#8530#`/`#8522#` (sebelum pertimbangan perceraian) |
| izin ikrar + tenggang 6 bulan sejak ditetapkan hari sidang ikrar (Pasal 70 ayat (6) UU 7/1989), hanya cerai talak | 4117 | putusan kabul cerai talak (sebelum paragraf biaya perkara) |
| pertimbangan hak asuh (belum mumayyiz atau mumayyiz, anak didengar), nafkah anak (+ kenaikan SEMA 3/2015), nafkah iddah, mut'ah, nafkah madliyah, harta bersama, waktu pembayaran (sebelum ikrar / akta cerai) | 4110-4116, gabungan **4119** | putusan kabul yang belum punya pertimbangan/amar akibat sendiri (sebelum paragraf biaya perkara) |
| amar akibat perceraian: hak asuh + akses, nafkah anak, "Menghukum ... membayar kepada ...: -nafkah madliyah -nafkah iddah -mut'ah" (+ waktu pembayaran), harta bersama, "Menolak selain dan selebihnya" | 4130-4134, gabungan **4138** | sama; disisipkan tepat sebelum butir amar biaya perkara (`#8505#`) dan di BAS putusan verstek |
| amar mut'ah + nafkah iddah ex officio untuk varian "Mut'ah Iddah" (amar lama TIDAK memuatnya) | **4139** | 8 varian Mut'ah Iddah CT ([01] dan [01c]) |
| rincian kewajiban yang dibayar saat sidang ikrar (titik-titik bawaan diganti angka dari putusan; tanpa isian = titik-titik bawaan) | **4150** | BAS Ikrar Talak "P & T Hadir, Ada Beban" |
| keputusan majelis per tuntutan (pilihan: dikabulkan seluruhnya / sebagian / ditolak / tidak dapat diterima / ex officio) | isian **4100-4105**, 4106 keadaan anak, 4107 dasar kemampuan, 4108 pendapat anak mumayyiz, 4109 waktu pembayaran | muncul di popup Blangko Derry |
| pembaca petitum (menyalakan isian di layar) | 4140-4146 | `ya` bila petitum / gugatan rekonvensi / kumulasi menuntut |

Cara kerja satu kalimat: kueri membaca petitum (+ rekonvensi + kumulasi) SIPP untuk MENGENALI tuntutan; **keputusan tetap pilihan hakim** pada isian 4100-4105.
Tuntutan terbaca tetapi belum diputus = kalimat `[PERIKSA: petitum menuntut ...]` (terdeteksi sebagai sisa blangko, menahan unggah), bukan putusan otomatis.
Tanpa tuntutan dan tanpa pilihan, semua variabel keluar KOSONG: blangko tampil persis seperti sebelumnya (diuji render, lihat `contoh/`).
Besaran memakai isian lama (CT: 6054 iddah, 6055 mut'ah, 7120 madliyah; CG: 9712, 9713, 9711; nafkah anak 9740/6071/6072, kenaikan 9741/9050) - jadi
pengisi otomatis yang sudah ada (jumlah yang DITUNTUT, "ragu") tetap bekerja; majelis menyesuaikan dengan yang dikabulkan.

Berkas yang SUDAH punya akibat perceraian sendiri (kata "Menghukum", penanda 9716/9717/975x, folder 1d, Rekonvensi) TIDAK diberi 4119/4138 (hindari ganda).
Tidak ada pengisi baru yang menulis keputusan hakim. Pengisi baru (bot): 4106 (cukup) dan 2004 (saran), lihat `UKURAN.md`.

## Isi paket

- `paket-satker/abt-u2-PASANG.sql` 35 variabel baru 4100-4150 dalam satu transaksi; prasyarat: jatah 4100-4299 kosong dan variabel rujukan lama ada (gagal keras, tidak menulis apa pun).
- `paket-satker/abt-u2-PERIKSA.sql` panjang + MD5 tiap baris; baris terakhir `SEMUA COCOK`.
- `paket-satker/abt-u2-PULIH.sql` menghapus 4100-4299 (menghapus variabel ikut menghapus isian petugasnya 4100-4109).
- `paket-satker/tambal-rtf.pl` + `rtf-tambal.tsv` + `rtf-daftar-tambal.tsv`: tambalan blangko RTF **per jangkar** (penanda yang sudah ada, harus tepat sekali); jangkar tak cocok = berkas DILEWATI (tidak ditimpa); skrip idempoten (SUDAH).
  102 berkas pada pohon terbaru: 30 SEMA, 39 pertimbangan (ikrar/akibat), 41 amar putusan, 56 amar BAS verstek, 3 beban ikrar (berkas yang tidak ada di satker dilaporkan LEWAT).
- `paket-satker/pasang-satker.sh`, `pulih-satker.sh`, `MD5SUMS.txt`.
- `sumber/susun_variabel.py` (pembangun katalog), `alat/` (bangun_rtf.py, bangun_paket.py, audit_putusan.py, uji_cepat.py, render_u2.py, uji_server.py, ukur_*.py), `data/variabel.json`.
- `integrasi-u6/`: entri peta fakta + entri gerbang terukur untuk digabung ke cabang U6 (belum digabung di cabang ini).
- `ukuran/` hasil ukur mentah, `contoh/` keluaran render nyata (teks).

## Pasang di satker (Git Bash, server hidup)

```bash
cd /d/aleta-dev/wt/u2-putusan-cerai/abt-paket/u2-putusan-cerai-lengkap
ssh aleta 'mkdir -p /root/abt-u2-20261020'
scp paket-satker/* aleta:/root/abt-u2-20261020/
ssh aleta 'cd /root/abt-u2-20261020 && md5sum -c MD5SUMS.txt'
ssh aleta 'bash /root/abt-u2-20261020/pasang-satker.sh'
```

Keluaran benar: `RINGKAS COCOK=...` (praperiksa), `PRASYARAT COCOK - memasang`, tabel PERIKSA semua `cocok = 1`, `SEMUA COCOK`,
`RINGKAS DITAMBAL=N SUDAH=0 LEWAT=M`, `RINGKAS COCOK=0 SUDAH=N`, `SELESAI`. Berkas LEWAT = blangko yang berbeda dari perkiraan (jangkar tak ada):
laporkan, jangan dipaksa. Pulih: `ssh aleta 'bash /root/abt-u2-20261020/pulih-satker.sh'`.

Setelah dipasang: pohon blangko Derry perlu dimuat ulang ekstensi (popup memuat isian baru 4100-4109). Portal/ekstensi: label, pilihan, tanda "diisi manual",
dan pemicu isian ada di kode portal (`susun.ts`, `isian-metadata.ts`) - ikut rilis berikutnya (ekstensi TIDAK berubah, tanam ulang tidak perlu).

## Uji tangan di satker

1. Putusan cerai gugat dengan petitum nafkah anak/hak asuh (mis. 561/Pdt.G/2025, 597/Pdt.G/2025): popup menampilkan keputusan; belum dipilih = `[PERIKSA ...]` di pertimbangan; pilih dikabulkan + isi jumlah -> pertimbangan dan butir amar terisi.
2. Cerai talak kabul tanpa tuntutan: tambahan hanya paragraf izin ikrar dan tenggang 6 bulan; selain itu sama dengan sebelumnya.
3. Varian Mut'ah Iddah: butir amar "Menghukum Pemohon ... sesaat sebelum ... ikrar talak" kini ada.
4. Alasan F: paragraf SEMA 1/2022; isi lama pisah < 6 bulan memunculkan `[PERIKSA ...]`.

Dasar hukum seluruhnya dari yang sudah dipakai blangko Derry (UU 1/1974 jo. 16/2019, UU 7/1989 jo. 3/2006 jo. 50/2009, KHI Pasal 80, 105, 149, 152, 156, 160, 97, PP 9/1975, SEMA 1/2017, 3/2015, 3/2018, 1/2022, PERMA 3/2017, UU 23/2002 jo. 35/2014); tidak ada pasal baru.
