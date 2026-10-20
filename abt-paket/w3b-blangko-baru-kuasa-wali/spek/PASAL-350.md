# Rujukan hukum jenis 350 - Nafkah Anak oleh Ibu karena Ayah Tidak Mampu (agen W3b-350)

Naskah: `D:/aleta-dev/kerja/referensi/_unduhan/` (BPK = uu1-1974/uu1-1974-bpk.txt; KHI = khi/khi-pasalid.json dan khi/khi.txt; ekstra/uu23-2002.txt, ekstra/uu35-2014.txt; sema/k.txt; query.js bot).
"Tercetak" = muncul di RTF putusan; "panel" = hanya di nama/keterangan variabel.

| Rujukan | Kutipan inti | Status | Tercetak / panel |
| :--- | :--- | :--- | :--- |
| Pasal 41 huruf b UU 1/1974 | "bilamana bapak dalam kenyataan tidak dapat memenuhi kewajiban tersebut" ... "ibu ikut memikul biaya tersebut" | terverifikasi (naskah BPK, dibaca utuh) | tercetak: kewenangan, kedudukan hukum, hukum inti, pertimbangan, pembagian |
| Pasal 45 ayat (1)-(2) UU 1/1974 | "Kedua orang tua wajib memelihara dan mendidik anak-anak mereka sebaik-baiknya" | terverifikasi (BPK) | tercetak: hukum inti; pertimbangan/amar tidak menghilangkan kewajiban ayah |
| Pasal 105 huruf c KHI | "biaya pemeliharaan ditanggung oleh ayahnya" | terverifikasi (khi-pasalid.json) | tercetak: hukum inti |
| Pasal 156 huruf d KHI | "menjadi tanggungan ayah menurut kemampuannya" ... "(21 tahun)" | terverifikasi (khi.txt hasil OCR dibaca ulang; bunyi sama dengan blangko 6c) | tercetak: hukum inti, pertimbangan bagian ayah |
| Pasal 156 huruf e dan f KHI | "mengingat kemampuan ayahnya menetapkan jumlah biaya" ... "anak-anak yang tidak turut padanya" | terverifikasi (OCR dibaca ulang; sama dengan 6c) | tercetak: hukum inti, kedudukan hukum (huruf d dan f) |
| Pasal 98 ayat (3) KHI | "menunjuk salah seorang kerabat terdekat yang mampu" ... "kedua orang tuanya tidak mampu" | terverifikasi (khi-pasalid.json) | tercetak: hukum inti (dibedakan: baru berlaku bila kedua orang tua tidak mampu) |
| Pasal 26 ayat (1) huruf a dan ayat (2) UU 23/2002 jo. UU 35/2014 | "mengasuh, memelihara, mendidik, dan melindungi anak"; "beralih kepada keluarga" | terverifikasi (uu35-2014.txt, bentuk Pasal 26 sesudah perubahan) | tercetak: hukum inti, pertimbangan kepentingan terbaik anak |
| Pasal 49 huruf a + Penjelasan angka 12 UU 7/1989 jo. UU 3/2006 jo. UU 50/2009 | "ibu dapat memikul biaya pemeliharaan dan pendidikan anak" | terverifikasi (query.js baris 175-215; angka 12, bukan 11 seperti blangko 6c lama) | tercetak: kewenangan absolut (lengkap dan ringkas) |
| SEMA 3/2018 (Rumusan Kamar Agama, Hukum Keluarga huruf b) | "menggali fakta kemampuan ekonomi suami dan fakta kebutuhan dasar hidup isteri dan/atau anak" | terverifikasi (sema/k.txt); sama dengan yang sudah dicetak blangko 6c (variabel 9751/9757) | tercetak: variabel 3934 |
| SEMA 3/2015 (Rumusan Kamar Agama angka 14) | "penambahan 10% sampai dengan 20% per tahun dari jumlah yang ditetapkan" | terverifikasi (sema/k.txt). Kutipan asli berlanjut "di luar biaya pendidikan dan kesehatan"; blangko ini TIDAK mengutip bagian itu karena kebutuhan yang ditetapkan sudah mencakup pendidikan | tercetak: variabel 3934, hanya bila isian 3931 terisi dan bagian ayah > 0 |
| Buku II Tahun 2026 ("standar biaya hidup minimal setempat") | kalimat penghubung dasar kebutuhan | PERLU-VERIFIKASI: diambil dari teks blangko 6c (variabel 9753), belum dibandingkan dengan naskah Buku II | tercetak: variabel 3934, hanya bila isian 3932 terisi |
| Pasal 283 RBg (beban bukti); Pasal 149 ayat (1) RBg (verstek) | - | terverifikasi (panduan W3b; rbg-unnes.txt) | tercetak: inti tolak |
| Pasal 154 RBg, PERMA 1/2016 (perdamaian) | - | tidak baru: teks tetap blangko 6c [97] | tercetak (berkas [97]) |

Tidak ada nomor pasal atau putusan yang dikarang. Satu-satunya rujukan "perlu-verifikasi": Buku II Tahun 2026 (di atas).

## Keputusan rancangan (untuk tinjauan hakim)
1. Hakim yang memutuskan: huruf alasan ayah tidak mampu (3920), kebutuhan biaya per bulan (3923), bagian ayah (3924), kenaikan (3931). Bagian ibu = kebutuhan dikurangi bagian ayah (selisih, dihitung mesin; tidak ditebak). Isian yang bukan angka murni dianggap kosong dan tercetak titik-titik.
2. Terbilang tidak memakai variabel bertipe `terbilang`: penanda `#nnnn#` di dalam teks kueri diganti ABT dengan nilai mentah (angka) sebelum kueri jalan, sehingga terbilang di dalam kalimat bersyarat akan tercetak sebagai angka. Terbilang dihitung di dalam kueri (0 s.d. 999.999.999), diuji 30 bilangan terhadap pembanding Python.
3. Bagian ayah boleh nol: amar tetap memuat ketetapan ayah tidak mampu dan ibu memikul seluruh biaya, dengan penegasan kewajiban ayah tidak hilang (Pasal 45 ayat (2) UU 1/1974).
4. Tanpa sita jaminan (sita=False): dalil pokok jenis ini ialah ayah dalam kenyataan tidak mampu; bila ada harta yang perlu disita, perkaranya jenis 743 (nafkah anak pasca perceraian).
5. Tidak memuat nafkah lampau (madliyah), pemotongan penghasilan, maupun biaya pendidikan/kesehatan terpisah: tidak termasuk pokok jenis ini; kebutuhan anak ditetapkan sekaligus (pemeliharaan dan pendidikan).
