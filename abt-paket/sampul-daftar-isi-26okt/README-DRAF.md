# DRAF paket ABT: Sampul Berkas Perkara + Daftar Isi Berkas (26 Okt 2026)

**Status: DRAF. TIDAK DIUJI di ABT. BELUM dipasang ke server, ABT, maupun SIPP.** Rancangan dan alasan: `docs/rancangan/sampul-daftar-isi-26okt/RANCANGAN.md`; pratinjau tampilan: berkas HTML di folder yang sama.

| Berkas | Isi | Cara dibuat |
|---|---|---|
| `rtf/Sampul Berkas Perkara.rtf` | blangko sampul (A4 tegak), memakai penanda `#NNNN#` | `python -I alat/bangun_rtf.py` |
| `rtf/Daftar Isi Berkas.rtf` | blangko daftar isi, tabel 4 kolom, dua bundel | idem |
| `draf/VARIABEL-DRAF.sql`, `draf/variabel-draf.json` | 77 definisi variabel blok 5800-5899 (`INSERT ... WHERE NOT EXISTS`) | `python -I alat/bangun_variabel.py` |
| `draf/FUNGSI-DRAF.sql` | fungsi `isian_rtf_daftar_isi(pid, bundel, kol)` (kursor, MariaDB 5.5) | ditulis tangan; penanda `__SIPP__` = nama basis SIPP |

Yang sudah diuji: kedua RTF dibuka di Microsoft Word (COM) setelah penanda diganti data rekaan: masing-masing 1 halaman, tabel utuh, teks terpetakan. Tampilan visual dibandingkan dengan pratinjau HTML belum dilakukan (tanpa pengubah PDF ke gambar di laptop ini).

Yang BELUM ada / belum terbukti (jangan dipasang sebelum dikerjakan):

1. Uji di lab php56 ABT: `<b>`/`<br>` lolos ke sel tabel, entitas `&#9632;` jadi simbol, tinggi baris sejajar antar kolom daftar isi.
2. Kueri belum dijalankan: nama kolom diambil dari `information_schema` SIPP produksi (baca saja) tetapi nilai/sandi `Y/T/1` beberapa kolom belum diukur (`putusan_verstek`, `mediasi_berhasil`, `mediasi_gagal`, `ikrar_talak`, `difabel`).
3. `PRASYARAT`, `HITUNG`, `PERIKSA`, `pasang-satker.sh`, `pulih-satker.sh`, `MD5SUMS.txt` (pola x6/x9) belum dibuat; urutan pasang dalam RANCANGAN.md bagian 6.
4. Ciri hasil analisa (GHAIB, pekerjaan, MAFQUD, REKONVENSI) memakai isian `data_teks` yang harus ditulis ALETA/panel; sumbernya menunggu keputusan Derry (RANCANGAN.md bagian 7).
5. Bagian daftar isi yang belum ada di fungsi: pengumuman ghaib, salinan putusan, sita, jawaban/replik/duplik/kesimpulan, daftar bukti, saksi, upaya hukum, eksekusi, bagian ikrar talak.
6. Sampul untuk permohonan satu pihak (Pdt.P) masih menampilkan kolom Termohon/Tergugat kosong (label tetap): perlu varian.

Menu: tidak diubah. Dua RTF ini cukup ditaruh di `derry_briantono/99 PTSP/` (menu id 991 sudah ada, jenis 15-17).
