# Audit blangko putusan kebendaan terhadap susunan putusan baku (agen W2a, 21 Okt 2026)

Lingkup: blangko Derry (satker PA Donggala, folder `4a Harta Bersama`, `4b Kewarisan`, `4c Wasiat`, `4d Hibah`, `4e Wakaf`, `10 Ekonomi Syariah` (gugatan sederhana), `10a Ekonomi Syariah Biasa`, `97 Sita`).
Dasar audit: RTF **terbaru dari server** diambil 20 Okt 2026 22.4x (99 berkas putusan; salinan di `abt-paket/w2a-kebendaan/asli-server-21okt/`, md5 tiap berkas ada di `paket-satker/DAFTAR-BLANGKO.tsv`).
Variabel ABT baru: 4780-4849 (70 buah; jatah W2a 4750-4849, 4750-4779 untuk variabel katalog saksi). Paket: `abt-paket/w2a-kebendaan/` (cara pasang: `PASANG.md`).

Susunan baku yang dipakai sebagai tolok ukur: kepala dan identitas; duduk perkara (posita ringkas, petitum, upaya damai/mediasi, jawaban/replik/duplik, bukti surat, saksi dari BAS, kesimpulan); pertimbangan (kewenangan absolut/relatif, legal standing, mediasi, pokok sengketa, beban dan analisis bukti, fakta hukum, pertimbangan per butir petitum, biaya); amar per butir petitum.

Keputusan majelis TIDAK diputus mesin: tiap tuntutan terbaca dari petitum SIPP lalu keputusannya adalah isian PILIH hakim; tuntutan terbaca tanpa keputusan = kalimat `[PERIKSA: ...]` (terdeteksi sebagai sisa blangko, menahan unggah). Tanpa tuntutan dan tanpa pilihan, bagian yang ditambahkan kosong atau sama dengan bunyi lama.

## 1. Harta bersama (4a)

| bagian susunan baku | keadaan blangko lama | tambahan |
|---|---|---|
| kewenangan, legal standing, mediasi, kuasa | ada ([01]/[01a] lengkap; [01b]/[02a] ringkas) | tidak diubah |
| jawab-menjawab per objek (diakui murni / berklausul / dibantah) | [01]/[01a]: keterangan merah + 3 butir contoh bertanda `_` untuk diisi tangan; [01b]/[02a]: tidak ada | **4787** isian per objek (`objek \| posita \| sikap \| alasan`), **4805** kalimat per objek (Pasal 311 dan 313 RBg jo. 1925 dan 1924 BW, bunyi lama blangko) |
| beban pembuktian per objek | [01]/[01a]: satu butir contoh `_` | **4806** (hanya objek yang dibantah atau diakui berklausul) |
| analisis alat bukti surat | [01]/[01a]: keterangan merah "ISI URAIAN ..."; [01b]/[02a]: satu paragraf umum | **4807/4808** analisis per jenis surat (KTP, KK, akta nikah, akta cerai/putusan, hak atas tanah, kendaraan, keuangan, foto/elektronik) dari daftar bukti P/T |
| fakta objek yang tidak terbukti | satu butir contoh `_` | **4781** isian + **4792/4809/4812** pertimbangan dan butir fakta; amar "untuk sebagian" dan "Menolak selain dan selebihnya" mengikuti **4780/4781** |
| bagian pembagian | tetap seperdua | **4782** (kosong = seperdua; bagian lain + alasan setelah titik dua), **4789** pemicu dari petitum (pecahan selain 1/2, persen); **4794/4813** pertimbangan; amar bagian |
| sita jaminan/marital | hanya [01]/[01a] (diandaikan ada); [01b]/[02a]: tidak ada | **4783** keputusan (sah dan berharga / ditolak), **4788** pemicu (petitum atau putusan sela sita), **4793/4814** pertimbangan, butir amar |
| Turut Tergugat | tidak ada (kecuali akta perdamaian, 8709) | **4796** pertimbangan dan butir amar "tunduk dan patuh" otomatis bila petitum/SIPP mencatat Turut Tergugat |
| utang bersama | tidak ada | **4786** isian, **4795** (Pasal 93 ayat (2) KHI), butir amar |
| uang paksa, putusan serta merta | [01]/[01a]: bagian "HAPUS ... BILA TIDAK DITUNTUT" manual; lainnya: tidak ada | **4784/4785** keputusan, **4790/4791** pemicu, **4797/4798/4810/4811** (judul + isi hanya bila dituntut) |
| amar bernomor per petitum | angka diketik dalam RTF; rujukan "diktum nomor N" diketik | **4800/4801** (verstek), **4802/4803** (kontradiktoir), **4804** (dalam konvensi); nomor dan rujukan dihitung dari butir yang aktif; nomor butir biaya dari 4801/4803 |
| rekonvensi | [01]/[01a] ada; keterangan merah per objek rekonvensi | tidak diubah (penilaian per objek rekonvensi tetap tangan; batasan di bagian 7) |

Berkas diubah: `[01]`, `[01a]`, `[01b]`, `[02a]` (kabul) dan `[03]`, `[03b]` (tolak: hanya analisis bukti surat dan kutipan saksi BAS). `[97]`, `[98*]`, `[99*]` tidak memerlukan tambahan (tanpa pokok perkara yang dipertimbangkan).

## 2. Kewarisan (4b)

| bagian | keadaan lama | tambahan |
|---|---|---|
| ahli waris | isian teks bebas 8717 | **4820/4821** memakai susunan terstruktur (9701-9704, 9718, 9762-9767: bagian dari paket penetapan ahli waris) bila terisi, selain itu 8717 apa adanya |
| pertimbangan bagian menurut KHI | satu kalimat umum + isian teks 8719 | **4822** = pertimbangan bagian KHI Pasal 176 s.d. 182, 185, 192, 193 (variabel 9769 yang sudah dipasang) bila susunan terstruktur terisi; usulan isian 8719 dari hitungan faraid (pengisi `isiOtomatisW2a.js`, "ragu") |
| harta bersama pewaris dengan pasangan | tidak ada | **4818** isian, **4823** pertimbangan (Pasal 96 ayat (1) KHI), butir amar |
| utang, wasiat, biaya jenazah | tidak ada | **4819** isian, **4823** pertimbangan (Pasal 171 huruf e dan 175 KHI), butir amar |
| penguasa harta peninggalan | selalu Tergugat | **4817** isian (kosong = Tergugat; "tidak ada" = penghukuman menyerahkan ditolak), **4832** pertimbangan |
| tirkah tidak terbukti | tidak ada | **4816** isian, **4824/4831** |
| sita, uang paksa, serta merta, Turut Tergugat | tidak ada | memakai ulang 4783-4785, 4788/4790/4791 dari paket yang sama (membaca petitum, tidak bergantung jenis) |
| bukti surat | satu paragraf umum | **4829/4830** (akta kematian, KK, silsilah, akta nikah, kelahiran, hak atas tanah, keuangan/jaminan sosial) |
| amar | "untuk sebagian" dan "Menolak selebihnya" selalu, butir diketik | **4825/4826** (verstek), **4827/4828** (kontradiktoir); seluruhnya bila **4815** = dikabulkan seluruhnya |

Berkas diubah: `[01]`, `[01a]`, `[01b]`, `[01c]` (kabul) dan `[03]`, `[03b]` (tolak: analisis bukti dan kutipan saksi).

## 3. Wasiat (4c), Hibah (4d), Wakaf (4e)

Mesin "pokok tuntutan" (huruf A-G; dasar hukum, norma dan amar pokok otomatis: 9475-9487, 9791-9803, 9820-9833) SUDAH ada dan dipertahankan; bagian yang ditambahkan:

| bagian | tambahan |
|---|---|
| analisis bukti surat (akta wasiat/hibah/ikrar wakaf, hak atas tanah, KTP/KK, kematian, nikah, keuangan, foto) | **4833/4834** (satu pasang untuk keempat jenis; sumber daftar bukti menurut jenis: 9488/9489, 9804/9805, 9834/9835, 9492/9493, 9955/9911 untuk gugatan sederhana) |
| tuntutan lain: Turut Tergugat, sita, uang paksa, serta merta | **4835** pertimbangan; butir amar tambahan **4837/4840**; nomor butir biaya **4838/4841** |
| pembuka amar "Mengabulkan" (seluruhnya atau sebagian) | **4836/4839** menurut **4815** (kosong: wasiat/hibah/wakaf seluruhnya seperti bunyi lama) |

Berkas diubah: `[01]`, `[01a]`, `[01b]` ketiga folder. Permohonan penetapan (`[01p]`, `[03p]`, `[99p]` hibah dan wakaf) tidak diubah: tanpa lawan, tanpa jawab-menjawab; analisis bukti permohonan dapat menyusul bila diminta.

## 4. Ekonomi syariah (10 gugatan sederhana, 10a acara biasa)

Wanprestasi dan sisa kewajiban (KHES Pasal 21, 36, 38, 1338 BW) SUDAH ada. Ditambahkan: analisis bukti (akad/perjanjian pembiayaan, teguran, bukti pembayaran) 4833/4834; keputusan atas denda/ganti rugi/ta'widh (**4842**), penyelesaian jaminan atau agunan (**4843**), pembatalan akad (**4844**) dengan pemicu **4845-4847** dari petitum; rumusan amar dikabulkan ditulis hakim setelah titik dua (mesin tidak merumuskan amar jaminan atau pembatalan); Turut Tergugat, sita, uang paksa, serta merta; "Menolak selain dan selebihnya" tetap bawaan (ekonomi syariah bawaan sebagian).
Berkas diubah: `[01]`, `[01b]` (10) dan `[01]`, `[01a]`, `[01b]` (10a).

## 5. Sita (97) dan lain-lain

`97 Sita [01]/[02]` (putusan sela sita dikabulkan/ditolak) lengkap sebagai putusan sela; tidak diubah. Sita pada putusan akhir ditangani lewat 4783/4788/4793.

## 6. Yang tidak diubah dan alasannya

- Jawab-menjawab per objek rekonvensi, pertimbangan perbandingan bukti per objek, penilaian saksi per dalil: butuh penilaian majelis atas isi jawaban dan saksi; mesin tidak mengarang. Keterangan merah tetap di [01]/[01a].
- Kamus katalog saksi (tanya jawab): lihat laporan agen K1/K2 dan `docs/gelombang2/PERIKSA-PASAL-W2a.md`.
- BAS: tidak diubah oleh paket ini.
