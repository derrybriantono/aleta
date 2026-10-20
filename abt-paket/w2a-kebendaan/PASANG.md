# Paket ABT "w2a-kebendaan" - harta bersama, kewarisan, wasiat, hibah, wakaf, ekonomi syariah (agen W2a, 21 Okt 2026)

Menambah **70 variabel ABT baru (4780-4849)** dan menambal **22 blangko putusan Derry** (folder `4a Harta Bersama`, `4b Kewarisan`, `4c Wasiat`, `4d Hibah`, `4e Wakaf`, `10 Ekonomi Syariah`, `10a Ekonomi Syariah Biasa`).
HANYA blangko dan variabel Derry; tanpa kata aplikasi di ABT. **Diuji di MariaDB lokal dan ABT lokal (PHP 5.6 asli); BELUM dipasang di server** - dipasang sesi utama.
Isi dan alasan tiap perubahan: `docs/gelombang2/AUDIT-PUTUSAN-W2a.md`. Rujukan hukum baru: `docs/gelombang2/PERIKSA-PASAL-W2a.md`. Angka ukur: `docs/gelombang2/UKURAN-W2a.json`.

## Prasyarat

- Paket gelombang 1 sudah terpasang (U6 4600-4629 dst.); paket ini membaca variabel lama 46, 47, 53, 218, 1025, 1246, 1509, 2026, 7037, 8554 dan menyalin kueri 9768/9769/9770 (ahli waris) ke dalam 4820-4822 (`salinan-server-21okt/`).
- Jatah **4780-4849 kosong** di `aps_badilag.abt_variabel` (PASANG menolak sendiri bila ada yang terpakai). Jatah 4750-4779 dipakai katalog saksi (K1/K2) bila membutuhkan variabel isian.
- Blangko Derry di server tidak berubah sejak diukur 21 Okt 2026: skrip pasang membandingkan md5 SEMUA 22 berkas lebih dulu dan **tidak mengubah apa pun** bila ada satu yang berbeda.
- Server tidak sedang dipakai mencetak/menyunting blangko kebendaan.

## Isi

| berkas | isi |
|---|---|
| `paket-satker/abt-w2a-PASANG.sql` | prasyarat (jatah kosong, rujukan lama ada; gagal keras bila tidak) + 70 INSERT dalam satu transaksi. Tidak ada UPDATE/DELETE: variabel lama tidak disentuh. |
| `paket-satker/abt-w2a-PERIKSA.sql` | panjang + MD5 (kueri dan nama) tiap baris; baris terakhir `SEMUA COCOK` |
| `paket-satker/abt-w2a-PULIH-HAPUS-BARU.sql` | `DELETE ... BETWEEN 4780 AND 4849` |
| `paket-satker/rtf/NN.rtf` + `DAFTAR-BLANGKO.tsv` | 22 blangko hasil tambal; `DAFTAR-BLANGKO.tsv` = NN, folder, berkas, md5 sebelum (diukur 21 Okt), md5 sesudah |
| `paket-satker/pasang-satker.sh`, `pulih-satker.sh`, `MD5SUMS.txt` | jalankan DI SERVER dari folder paket (cek berkas -> cek md5 blangko -> cek jatah -> cadang -> pasang -> periksa -> ganti RTF -> cek md5; gagal = pulih sendiri) |
| `asli-server-21okt/` | 99 RTF putusan asli server yang diukur 21 Okt (acuan tambal dan uji) |
| `salinan-server-21okt/` | kueri 9768, 9769, 9770 (dan 9705, 9706) dari server, bawaan beberapa isian |
| `alat/` | pembangun dan penguji: `variabel*.py`, `sqlkit.py`, `buktikit.py`, `rtfkit.py`, `tambal_hb/waris/lain.py`, `bangun_paket.py`, `klon_db.cjs`, `render_w2a.py` (cetak lewat ABT asli), `uji_paket_lokal.cjs`, `uji_semantik.cjs`, `periksa_selisih.py` |
| `contoh/` | keluaran render ABT asli atas perkara nyata (sebelum/sesudah/selisih) |

## Variabel baru (ringkas)

| nomor | isi |
|---|---|
| 4780-4787 | isian harta bersama: keputusan penetapan, objek tidak terbukti, bagian, sita, uang paksa, serta merta, utang bersama, sikap Tergugat per objek |
| 4788-4791 | pemicu dari petitum SIPP: sita, bagian bukan seperdua, uang paksa, serta merta |
| 4792-4814 | harta bersama: pertimbangan (objek tidak terbukti, sita, bagian, utang, Turut Tergugat, uang paksa, serta merta, gabungan), amar bernomor verstek/kontradiktoir/konvensi, nomor butir biaya, jawab-menjawab dan beban pembuktian per objek, analisis bukti P/T |
| 4815-4819 | isian kewarisan: keputusan, objek tidak terbukti, penguasa, harta bersama pewaris, utang/wasiat |
| 4820-4832 | kewarisan: ahli waris terstruktur (9768/9770), bagian KHI (9769), pertimbangan harta bersama pewaris/utang/tuntutan lain/penghukuman, amar bernomor, analisis bukti, fakta objek tidak terbukti |
| 4833-4841 | wasiat, hibah, wakaf, ekonomi syariah: analisis bukti P/T, pertimbangan tuntutan lain, butir pembuka/tambahan amar dan nomor butir biaya (kontradiktoir dan verstek) |
| 4842-4847 | ekonomi syariah: keputusan denda/ganti rugi, jaminan, pembatalan akad, dan tiga pemicu dari petitum |
| 4848-4849 | kutipan keterangan saksi dari BAS (kueri U6 4617/4618 disalin): harta bersama (4848), kewarisan (4849) |

## Cara pasang di server (Git Bash di laptop)

```bash
cd /d/aleta-dev/wt/w2a-kebendaan/abt-paket/w2a-kebendaan        # atau cabang yang sudah digabung
ssh aleta 'mkdir -p /root/abt-w2a-20261021/rtf'
scp paket-satker/abt-w2a-*.sql paket-satker/*.sh paket-satker/*.tsv paket-satker/MD5SUMS.txt aleta:/root/abt-w2a-20261021/
scp paket-satker/rtf/*.rtf aleta:/root/abt-w2a-20261021/rtf/
ssh aleta 'cd /root/abt-w2a-20261021 && md5sum -c MD5SUMS.txt | grep -v ": OK$"'    # keluaran harus kosong
ssh aleta 'bash /root/abt-w2a-20261021/pasang-satker.sh'
```
Keluaran benar: `CADANGAN: ...`, tabel PERIKSA `cocok = 1` di 71 baris, `SEMUA COCOK`, `SELESAI - paket w2a-kebendaan terpasang (22 blangko, 70 variabel)`.
Bila skrip menolak karena md5 blangko satker sudah berbeda dari yang diukur (ada paket lain menyentuh folder ini): ambil RTF terbaru, ganti `asli-server-21okt/`, jalankan `python alat/bangun_paket.py` (tambalan berjangkar: bila jangkar tak ditemukan tepat sekali, pembangun berhenti dan tidak menulis apa pun), lalu pasang ulang.
Pulih: `ssh aleta 'bash /root/abt-w2a-20261021/pulih-satker.sh'` (hapus 4780-4849 + kembalikan 22 RTF dari `cadangan/`, md5 diperiksa).

## Yang harus disusul sesudah pasang

1. Pasang portal dan bot: `blangko-derry/susun.ts` + `isian-metadata.ts` (nama dan pilihan isian, pemicu), `aleta_bot/services/isiOtomatisW2a.js` + sambungan di `abtUsulanService.js`.
2. Tanam ulang ekstensi (`saksi-katalog-data.js` berubah) dan muat ulang di chrome://extensions.
3. Uji mata satu putusan nyata: Blangko Derry -> HB 506/Pdt.G/2026 (sita + bagian 3/4 + Turut Tergugat): isian "Keputusan bagian", "Keputusan sita" muncul; belum dipilih = kalimat `[PERIKSA ...]`.

## Hasil uji

Lihat laporan akhir dan `manajemen_surat/src/test/w2a-kebendaan.test.ts` (A: paket utuh; B: MariaDB lokal; C: rakitan kalimat atas perkara nyata; D: pengisi). Render ABT asli (PHP 5.6) atas perkara nyata: `contoh/`.
