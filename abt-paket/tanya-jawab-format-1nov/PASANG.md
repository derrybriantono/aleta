# Paket ABT `abt-tanya-jawab-format-1nov` - SEMUA tanya jawab di blangko Derry berformat dua kolom bersilang ala ABT (keputusan pengguna 85, 86, 89-B1; 1 Nov 2026)

**Status: dibangun dan diuji di LAPTOP. Server: BELUM dipasang. URUTAN: KE-29, PALING AKHIR - sesudah `bas-lanjutan-1nov`**
(lihat `../URUTAN-PASANG-1nov.md`). Hanya blangko RTF dan satu variabel (#5404#) pengguna **derry_briantono**; tanpa variabel/menu/data baru.
Dibangun deterministik: `python sumber/bangun_paket.py <_blangko_abt sesudah 28 paket> paket-satker hasil` lalu `python sumber/bangun_sql.py paket-satker <basis ABT dasar>`.

## Patokan (keputusan 85)
Format yang benar = keluaran ABT untuk tanya jawab (`Abt_model::kolom_kode_A4`, jenis kertas A4 - dipakai variabel `#5058#` dst.): **pertanyaan di sel KIRI**
(rata kanan-kiri), baris di bawahnya **jawaban di sel KANAN diawali "- "** (tanda "- " rata kanan di sel kiri), lalu pertanyaan berikutnya di kiri, dan
seterusnya; lebar sel 4250/8500 twips; tanpa garis tabel; tanpa baris kosong. Bentuk "1. Tanya: ... / Jawab: ..." satu kolom TIDAK dihasilkan blangko/variabel/fungsi mana pun
(diperiksa; lihat "Audit" di bawah).

## Audit (tahap 1) - semua blangko Derry yang memuat tanya jawab
Renderer ABT asli (php56) + pemeriksaan seluruh 1.880 berkas RTF (tanpa folder `terhapus`): `hasil/audit.md`.
| golongan | berkas aktif | berkas arsip (ALUR*, `- BAS *`) |
|---|---|---|
| BENAR (tanya jawab dari variabel ABT `#5058#`...`#8941#`, `#6112#`-`#6114#`) | lihat `hasil/audit.md` | |
| SALAH BENTUK: tabel tertulis tangan (tanpa "- ", lebar 4111-4503 tak seragam, sel berindentasi/bergaris, baris kosong dalam sel) | 386 berkas / 1.241 tabel | 57 berkas / 183 tabel |
| fungsi isian RTF / variabel yang menghasilkan bentuk salah | 0 (`isian_rtf_ket_saksi` = daftar "- Bahwa ..." untuk putusan, bukan tanya jawab) | |
| jalur portal/ekstensi | 0 (bot membentuk tabel persis `kolom_kode_A4`, ekstensi menulis ke ABT; teks `- Tanya : ...` di `keterangan-abt.ts`/`bas-lembar.ts` hanya penanda "sudah terisi", tidak pernah masuk naskah) | |

## Isi (tahap 2)
| butir | jumlah | tindakan |
|---|---|---|
| tabel tanya jawab tertulis tangan (majelis/pihak bertanya kepada pihak/saksi: "Kepada ...", "Apakah ...", jawaban) | 1.475 tabel (4.577 baris) di 586 berkas | kode tabel diganti kode ABT persis (pertanyaan `\irow0`, jawaban `\irow1\lastrow` diawali "- "); teks, huruf, penanda #nnnn# TIDAK diubah; baris kosong dalam sel dibuang |
| kalimat "Susunan majelis yang bersidang sama dengan sidang yang lalu;" sebagai teks biasa (keputusan 86) | 98 BAS (+1 di folder `terhapus`, tidak disentuh) | diganti `#5404#`; paragraf berinden gantung disamakan dengan paket 28 (inden baris pertama = paragraf sesudahnya) |
| bagian Tergugat BAS ALUR 05 [3a] menyebut #0046# (keputusan 89-B1) | 3 berkas (CG, CT, arsip ALUR 05) x 6 penanda | bukti surat/saksi milik #0047#; kesempatan memeriksa bukti surat kepada #0046# atas bukti yang diajukan #0047# |
| variabel #5404# | 1 | kueri baru (di bawah) |

### Variabel #5404# (keputusan 86)
Kueri lama membandingkan "tanggal penetapan = tanggal sidang" dan "tahun surat = tahun berjalan (CURDATE())": hanya 63 dari 1.085 sidang lanjutan yang majelis/PP-nya
berganti terdeteksi. Kueri baru: susunan yang BERLAKU pada tanggal sidang (gelombang penetapan terbesar <= tanggal sidang) dibandingkan dengan sidang SEBELUMNYA (#6091#):
orang (hakim_id/nama), jabatan (Ketua/Anggota/Tunggal), panitera pengganti. Sama (juga penetapan diterbitkan ulang untuk orang yang sama) -> kalimat lama.
Beda -> "Susunan majelis sidang sebelumnya mengalami perubahan karena Hakim bernama X yang sebelumnya bertugas [sedang/(alasan)] digantikan oleh Y [dan #6034# bernama P ... digantikan oleh Q],
berdasarkan Penetapan Majelis Hakim (PMH)/Hakim Tunggal (PHT) [dan Penunjukan Panitera Pengganti (PPP)] pengganti [Nomor N] tanggal T, sehingga susunan majelis bersidang menjadi sebagai berikut:" + susunan baru
bernomor (Ketua, Anggota, atau "-" untuk hakim tunggal) "; dan dibantu" panitera. Alasan kosong atau berupa kode ruang/jenis sidang tidak dicetak ("sedang ," hilang);
`<br>`-`<li>` campur diseragamkan; "; dan dibantu" ada spasi. Ukuran atas SIPP lokal: `hasil/ukur-5404.md`.

**KINERJA (arahan Derry 1 Nov)**: ABT memecahkan SETIAP kemunculan penanda `#nnnn#` di kueri (bukan per nomor): tiap kemunculan = pembacaan data + `call perkara_jadwal_sidang_reorder`
untuk penanda sidang, dan penanda yang tertanam di teks keluaran dievaluasi lebih dulu (eager). Kueri lama memuat 8x #0033#, 6x #6034#, #5403#, #5405#, #5406#, #5407#, #0012#..#0015#, #4004# dst.
Kueri baru memuat penanda angka tepat tiga, masing-masing SEKALI (#0033#, #6091#, #6034#; `#perkara_id#` bukan penanda ABT dan boleh berulang), dan bagian berat (nama, alasan, nomor)
hanya dihitung bila id hakim/panitera berbeda (`IF(e.chg=1, ...)`). Waktu render `#5404#` di ABT php56 (30 sidang campuran, `hasil/ukur-5404.md`): lama ~8,0-8,5 dtk, baru ~1,2-1,4 dtk.

## Pasang / pulih (server, root)
```bash
ssh aleta 'mkdir -p /root/abt-tanya-jawab-format-20261101'; scp -r paket-satker/* aleta:/root/abt-tanya-jawab-format-20261101/
ssh aleta 'bash /root/abt-tanya-jawab-format-20261101/pasang-satker.sh'   # PRASYARAT COCOK (1|0|3) -> SEMUA COCOK -> UJI -> TAMBAL=586 -> BERKAS COCOK -> SELESAI
ssh aleta 'bash /root/abt-tanya-jawab-format-20261101/pulih-satker.sh'    # PULIH=586 -> BERKAS PULIH -> PULIH COCOK
```
- PRASYARAT: #5404# persis dasar dan tiap berkas persis keadaan sesudah 28 paket. Satu saja berbeda -> GAGAL, TIDAK ada yang diubah.
- PASANG: cadangan (`cadangan/abt_variabel-sebelum.sql`, berkas lama di `cadangan/rtf-lama`) -> SQL satu transaksi -> PERIKSA -> UJI kueri atas SIPP server (contoh sidang ke-2 dan contoh pergantian hakim) -> berkas -> PERIKSA; gagal = PULIH otomatis.
- PULIH: hanya yang masih persis isi paket dikembalikan; yang sudah disunting orang dibiarkan dan dilaporkan. Pulihkan paket ini SEBELUM paket sebelumnya.

## Uji (laptop)
- `hasil/uji-lokal.txt` (`sumber/uji_lokal.sh`): pasang, pasang ulang (tidak mengubah apa pun), pulih (= pohon dan variabel dasar persis), pasang lagi, dua penjaga.
- Uji rantai 29 paket: `../uji-rantai-31okt/hasil-rantai-29.txt`.
- Render sungguhan (renderer ABT php56) sebelum/sesudah: `alat/render164.py`, `hasil/render.md`; PNG di `D:/Aplikasi/aleta/tmp/w164/render/`.
- Penjaga isi paket: `manajemen_surat/src/test/paket-tanya-jawab-format-1nov.test.ts`.
