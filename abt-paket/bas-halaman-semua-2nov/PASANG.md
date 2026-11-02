# Paket ABT `abt-bas-halaman-semua-2nov` - SEMUA blangko BAS bernomor halaman (keputusan pengguna 113; 2 Nov 2026)

**Status: dibangun dan diuji di LAPTOP. Server: BELUM dipasang. URUTAN: KE-33, PALING AKHIR - sesudah `identitas-pihak-1nov` (ke-31) dan `kaidah-fikih-2nov` (ke-32)**
(lihat `../URUTAN-PASANG-1nov.md`). Hanya blangko **derry_briantono**; tidak ada variabel/menu/data yang diubah (tanpa nomor variabel baru; klaim 12140-12159 tidak dipakai).
Dibangun deterministik: `python sumber/bangun_paket.py <_blangko_abt sesudah 31 paket> paket-satker hasil`. md5 dasar = keadaan SESUDAH 31 paket; paket ke-32 (kaidah fikih) hanya menyentuh blangko putusan,
jadi md5 BAS sama sebelum/sesudah ke-32 (bila ke-32 ternyata menyentuh berkas yang sama, PRASYARAT paket ini GAGAL tanpa mengubah apa pun dan daftar md5 dibangun ulang).

## Latar
Keputusan 71 (BAS bernomor halaman RUNUT sampai putus) dikerjakan paket ke-27 `bas-halaman-1nov` (field PAGE di kaki halaman) dan portal (`manajemen_surat/src/server/modules/aleta-ecourt/bas-halaman/`:
halaman awal tiap BAS = halaman terakhir BAS sebelumnya + 1, lompatan sesudah bukti/lampiran). Keputusan 59 (sementara) dulu TIDAK menambah isian nomor halaman; Derry menjawab (keputusan 113):
"seharusnya ada semua nomor halaman". Paket ke-27 ternyata belum menjangkau semuanya, karena ia (a) MELEWATI berkas yang kakinya "sudah bernomor" bila SATU kaki mana pun sudah memuat PAGE, tanpa melihat
tiap bagian, dan (b) hanya memeriksa folder berakhiran ` - BAS`.

## Audit (keadaan sesudah 30 paket; ukuran per BAGIAN, bukan per berkas) - `hasil/rincian.tsv`, `hasil/ringkas.txt`
Kelompok BAS = yang dikenali ekstensi sebagai BAS (`jenisKelompok`: nama folder `^bas\b|^alur\s*\d|\bbas\b`), kecuali `98b Berkas Perkara - BAS` (daftar isi) dan `98c Court Calendar - BAS` (bukan BAS): **1.216 blangko**.

| keadaan | berkas | tindakan |
|---|---|---|
| tiap bagian sudah menetapkan kaki ber-PAGE | 1.036 | dibiarkan |
| bagian PERTAMA tanpa kaki sama sekali, bagian lain ber-PAGE (BAS Mediasi dst., 4 bagian; BAS Replik 2 bagian): halaman BAS di bagian pertama tidak bernomor | 144 | kaki baru di bagian tanpa kaki (bagian yang tadinya mewarisi kaki bernomor ikut diberi kaki sendiri) |
| folder BAS lama di luar pola ` - BAS` (`ALUR 03/04/05/06/08`, `- BAS CONTRA PERCERAIAN -`): kaki kosong / kotak teks kosong, atau tanpa kaki | 36 | field PAGE di kaki yang ada (sama dengan paket ke-27), atau kaki baru |

**180 berkas diubah** (63 kaki lama diisi, 280 kaki baru dibuat, 127 di antaranya di bagian yang tadinya hanya mewarisi kaki bernomor dari bagian sebelumnya - seluruh 1.036 BAS yang sudah bernomor menetapkan kaki di TIAP bagian,
tidak ada yang mengandalkan pewarisan, jadi bagian ini disamakan supaya Word dan LibreOffice sama-sama aman). Setelah ditambal, audit per bagian: **1.216 dari 1.216 BAS bernomor di semua bagian**.

Bentuk SAMA dengan paket ke-27 dan BAS yang sudah bernomor (BAS ALUR 02 [1a]): field `PAGE` rata KANAN bawah (`\qr`), 12 pt, huruf judul "BERITA ACARA":
- kaki ada, belum ber-PAGE: field disisipkan tepat sebelum `\par` terakhir kaki itu;
- bagian tanpa kaki: satu grup `{\footer ...}` disisipkan tepat sebelum `\pard` badan pertama bagian itu (kelompok `{\header ...}` di bagian itu dilewati; kedalaman grup dihitung).
Teks lain, isian `#kode#`, pemisah bagian, dan nomor tetap `\pgnstarts` di blangko TIDAK diubah (nomor awal tiap BAS diatur portal saat cetak/unduh/unggah, termasuk lompatan bukti dan lampiran).
Tidak ada BAS yang dilewati: `hasil/lewat.tsv` kosong.

## Portal dan ekstensi
Tidak perlu diubah: portal memasang halaman awal dan kesinambungan pada SETIAP BAS blangko (`jenis === "bas"` di ekstensi = kelompok yang sama dengan audit ini: folder `ALUR n`, `- BAS ... -`, `<jenis> - BAS`),
tanpa melihat nama blangko; yang dibutuhkannya hanya kaki ber-PAGE di blangko, yang dipenuhi paket ini. BAS Word unggahan manual mengikuti kaki berkas itu sendiri (di luar blangko).

## Pasang / pulih (server, root)
```bash
ssh aleta 'mkdir -p /root/abt-bas-halaman-semua-20261102'; scp -r paket-satker/* aleta:/root/abt-bas-halaman-semua-20261102/
ssh aleta 'bash /root/abt-bas-halaman-semua-20261102/pasang-satker.sh'   # PRASYARAT COCOK (SIAP=180) -> TAMBAL=180 -> BERKAS COCOK -> SELESAI
ssh aleta 'bash /root/abt-bas-halaman-semua-20261102/pulih-satker.sh'    # BERKAS PULIH -> PULIH COCOK (SIAP=180)
```
- PRASYARAT: tiap berkas md5-nya persis keadaan sesudah 31 paket (atau sudah terpasang). Satu saja berbeda -> GAGAL, TIDAK ada yang diubah.
- PASANG: berkas lama disalin ke `cadangan/rtf-lama/<kode>.rtf` (md5 diperiksa) sebelum ditimpa; satu gagal = semua dikembalikan.
- PERIKSA: semua berkas md5 = md5 baru ("BERKAS COCOK"); tidak cocok = PULIH otomatis.
- PULIH: berkas dikembalikan HANYA bila isinya masih persis isi paket (yang sudah disunting orang dibiarkan dan dilaporkan). Tanpa hapus permanen. Pulihkan paket ini SEBELUM paket sebelumnya.

## Uji (laptop)
- `hasil/uji-lokal.txt` (`sumber/uji_lokal.sh` atas salinan pohon sesudah 31 paket): pasang, pasang ulang (tidak mengubah apa pun), pulih (= pohon dasar persis), pasang lagi (= pasang pertama), penjaga (berkas disunting -> pulih membiarkan; berkas dasar disunting -> pasang menolak tanpa mengubah apa pun).
- Audit per bagian sebelum/sesudah: `alat/audit_bagian.py` (hasil/audit-sebelum.tsv: OK 1.036, sebagian 144, tanpa 36; hasil/audit-sesudah.tsv: OK 1.216).
- Render sungguhan (Word -> PDF) semua 180 berkas diubah + 15 pembanding: `hasil/render.md` (nomor tampak di kaki tiap halaman).
- Penjaga isi paket + pembangun atas pohon sintetis: `manajemen_surat/src/test/paket-bas-halaman-semua-2nov.test.ts`.
- Uji rantai 1-30, 31 (611 berkas), 32 (`kaidah-fikih-2nov` dari cabang kaidah-fikih 074ddeba, 85 blangko putusan, tanpa berkas yang sama dengan paket ini - PRASYARAT SIAP=180 sesudahnya), 33: `RANTAI-KELUAR 0`, `../uji-rantai-31okt/hasil-rantai-33.txt`. Sidik pohon: sesudah 31 = `beb5eb9269b80822ef8e775065702b15`, sesudah 33 tanpa 32 = `5f2e7abf6e6409bb83669f710d69e6a5`, sesudah 31+32+33 = `cf5b9accdecf834e60e87aa75abbaa67`.
- Uji rantai lama 33 paket: `../uji-rantai-31okt/rantai.sh` (daftar urutan menyebut `bas-halaman-semua-2nov` paling akhir).
