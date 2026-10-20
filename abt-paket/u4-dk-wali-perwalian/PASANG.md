# Paket ABT "abt-u4-dk-wali-perwalian" - dispensasi kawin, wali adhal, perwalian (agen U4, 20 Okt 2026)

**Status: teruji di ABT LAPTOP (pasang, pasang ulang, pulih, penjaga md5). Satker: BELUM dipasang - dipasang sesi utama.**
Hanya blangko dan variabel Derry (folder `derry_briantono/3 Dispensasi Kawin`, `6 Perwalian`, `7 Wali Adhal`). Tanpa kata "Aleta"/"ALETA" di ABT.

## Isi (`paket-satker/`)

| berkas | isi |
|---|---|
| `abt-u4-dk-wali-perwalian-PRASYARAT.sql` | baca saja: `A\|B\|C\|D\|E` = benar `0\|0\|130\|0\|0` (pertama) atau `0\|24\|130\|0\|0` (pasang ulang); C = 130 variabel lama yang dirujuk blangko HARUS ada |
| `...-PASANG.sql` | 24 variabel baru 4400-4442 (hex cp1252, satu transaksi, `WHERE NOT EXISTS`) |
| `...-PERIKSA.sql` | md5 nama + tipe + kueri tiap variabel; baris akhir `SEMUA COCOK` |
| `...-PULIH.sql` | menghapus variabel baru HANYA bila isinya masih persis paket; akhir `PULIH COCOK` |
| `rtf/` | 3 blangko BARU (tidak pernah menimpa berkas lain) |
| `timpa/` | 12 blangko LAMA versi baru, ditimpa HANYA bila md5 di server persis `daftar-timpa.tsv` (md5 lama = pohon server 20 Okt 2026); cadangan utuh dibuat paket |
| `berkas_rtf.py`, `pasang-satker.sh`, `pulih-satker.sh` | urutan: md5 -> prasyarat -> cadangan -> pasang SQL -> periksa -> uji kueri atas perkara nyata -> berkas -> periksa berkas; gagal = pulih otomatis |

## Pasang (Git Bash, server hidup)

```bash
cd /d/Download\ File/server\ aleta\ baru/.../abt-paket/u4-dk-wali-perwalian   # folder repo
ssh aleta 'mkdir -p /root/abt-u4-20261020'
scp -r paket-satker/* aleta:/root/abt-u4-20261020/
ssh aleta 'cd /root/abt-u4-20261020 && md5sum -c MD5SUMS.txt | grep -v OK'      # harus kosong
ssh aleta 'bash /root/abt-u4-20261020/pasang-satker.sh'
```
Keluaran benar: `PRASYARAT COCOK (0|0|130|0|0)`, `BERKAS SIAP` (`SIAP_TIMPA=12`), `SEMUA COCOK`, baris `uji perkara NNNN: 44xx ...`, `BUAT=3 TIMPA=12`, `BERKAS COCOK`, `SELESAI`.
Bila `GAGAL: berkas ... sudah berubah (md5 ...)`: berkas disunting sesudah 20 Okt - TIDAK ada yang diubah; jalankan ulang `sumber/susun_timpa.py` dengan `U4_ASLI=<salinan folder derry_briantono terbaru>` lalu `sumber/bangun_paket.py`.
Pulih: `ssh aleta 'bash /root/abt-u4-20261020/pulih-satker.sh'` (akhir `PULIH COCOK` dan `BERKAS PULIH`).

Laptop: `ABT_LOKAL=1 ABT_DB=aps_badilag_u4 ABT_BLANGKO=<akar _blangko_abt uji> SIPP_DB=sipp_donggala PY=python bash pasang-satker.sh` (hasil uji laptop 20 Okt: pasang -> pasang ulang -> pulih; 25 berkas lama kembali persis; berkas yang diubah satu bita membatalkan pasang tanpa menyentuh apa pun).

## Variabel baru (jatah 4400-4499; dipakai 24)

| no | jenis | isi |
|---|---|---|
| 4400 | isian | hubungan Pemohon dengan anak (bibi/paman/kakak/nenek...) - terisi otomatis dari posita + jenis kelamin Pemohon (SIPP) |
| 4401-4404 | isian / tanggal | nama ayah, nama ibu, tanggal ayah dan ibu meninggal - otomatis dari kalimat baku posita |
| 4405, 4409 | SQL | uraian orang tua anak (nama) dan kematiannya (nama + tanggal) dari 4401-4404 |
| 4406, 4407 | SQL | nama anak (SIPP anak; kosong = isian 5110) dan "anak/anak-anak" - menggantikan #5115#/#5114# yang tercetak "belum dikaruniai anak" karena SIPP anak kosong pada 23 dari 23 perkara perwalian 2025-2026 |
| 4410-4412 | isian + SQL | tindakan hukum yang dimohonkan izinnya (isian, opsional), pertimbangan dan tambahan amar (muncul hanya bila 4410 terisi) |
| 4420-4423 | SQL | alasan mendesak otomatis: hamil (isian 0999) atau berpacaran erat (1666) - satu blangko untuk keduanya |
| 4424, 4425 | SQL | sebutan bukti surat asli dan pertimbangan surat keterangan hamil (hanya bila hamil) |
| 4426 | SQL | pertimbangan perbedaan usia dari tanggal lahir SIPP (`perkara_mempelai_dk`) |
| 4427, 4428 | isian + SQL | rekomendasi psikolog/dokter/pekerja sosial/P2TP2A/KPAD (Pasal 16 huruf h PERMA 5/2019), opsional |
| 4440-4442 | SQL | wali adhal: umur Pemohon, pertimbangan persetujuan calon + umur >= 19, pertimbangan masa tunggu (hanya bila status janda) |

## Blangko

BARU (3):
- `6 Perwalian/[01b] [Kabul] Perwalian - Anak Yatim Piatu oleh Kerabat (Bukan Orang Tua).rtf` - 8 dari 23 perkara perwalian 2025-2026 diajukan bibi/paman/kakak/nenek/tante; blangko Derry hanya untuk orang tua kandung. Susunan: syarat wali (Pasal 50, 51 UU 1/1974; Pasal 107, 109, 110 KHI; Pasal 3 PP 29/2019; Pasal 33 UU 23/2002 jo. UU 35/2014), kewajiban wali (daftar harta, larangan memindahtangankan), izin tindakan hukum bila dimohonkan. Untuk kedua orang tua anak meninggal.
- `3 Dispensasi Kawin/[01c] [Kabul] DK - (Anak P Cewek) Alasan Mendesak Otomatis (Hamil atau Pacaran Erat).rtf` - 11 dari 23 penetapan DK dikabulkan 2025-2026 bukan karena hamil, sedangkan blangko Derry hanya [01]/[02] (hamil / sudah berhubungan badan).
- `3 Dispensasi Kawin/[01d] [Kabul] DK - Kedua Calon Mempelai di Bawah Umur (Dua Keluarga Pemohon, Hamil atau Pacaran Erat).rtf` - 8 dari 26 perkara DK 2025-2026 calon pasangannya juga belum 19 tahun (4 Pemohon; identitas lewat #7047#).

DIPERBARUI (12, ditimpa dengan penjaga md5, cadangan utuh): DK [01] x2, [02] x2, [03], [03a], [03b], [03c] (+ paragraf Hakim Tunggal, Pasal 15 PERMA 5/2019 pemeriksaan anak, beban pembuktian Pasal 283 RBg jo. 1865 KUH Perdata, perbedaan usia, rekomendasi);
Wali Adhal [01], [01a] (+ Pasal 21 KHI urutan wali, persetujuan calon + umur, Pasal 61 KHI kesepadanan, masa tunggu), [03] (+ Pasal 21 KHI);
Perwalian orang tua kandung Kabul (sisa isian mentah "ANAK 1 PERSATU P NYA" dan "lahir tanggal _ (_ tahun)" dibuang; "ketiga/kedua anak" dan #0047# yang keliru diganti; nama/jumlah anak otomatis; izin tindakan hukum).

## Rujukan hukum
Terverifikasi di katalog saksi (naskah resmi/arsip): Pasal 6, 12, 13, 15, 16 PERMA 5/2019; Pasal 7 UU 1/1974 jo. UU 16/2019; Pasal 21, 23, 61 KHI; Pasal 107 KHI; Pasal 47, 50 UU 1/1974; Pasal 33 UU 35/2014; Pasal 3 PP 29/2019; Pasal 285, 308, 309 RBg.
Dikutip dari pengetahuan hukum dan **belum dicocokkan dengan naskah di arsip - mohon diperiksa hakim**: Pasal 50 ayat (2), 51 ayat (2)-(5), 52 (jo. 48), 53 UU 1/1974; Pasal 109, 110 ayat (1) dan (3) KHI; Pasal 283 RBg jo. 1865 KUH Perdata; kalimat Hakim Tunggal tanpa nomor pasal PERMA (nomor pasal "hakim tunggal" belum ada di arsip).
Tidak dikutip karena nomornya belum terverifikasi: PMA wali hakim.

## Belum dikerjakan
- Perwalian oleh kerabat versi TOLAK; DK "alasan mendesak otomatis" untuk anak laki-laki; DK [03] Tolak untuk dua keluarga; wali adhal tolak dengan pertimbangan sah/tidaknya alasan per jenis alasan.
- Uji render PHP: ABT laptop (1.412 variabel) lebih tua dari server (1.767) sehingga blangko baru tidak dapat dirender utuh di laptop; yang diuji: SQL variabel atas SIPP server (baca saja), penanda RTF, pasang/pulih paket.
- Alat penyusun: `sumber/susun_perwalian.py`, `susun_dk.py`, `susun_timpa.py`, `variabel_*.py`, `katalog_u4.py`, `bangun_paket.py` (menyusun ulang semuanya dari berkas dasar dalam `U4_ASLI`).
