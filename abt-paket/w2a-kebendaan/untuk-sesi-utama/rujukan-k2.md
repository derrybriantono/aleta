# Rujukan hukum BARU agen W2a-K2 (katalog saksi versi 2: wasiat, hibah, wakaf, ekonomi syariah)

Untuk disalin sesi utama ke `docs/gelombang2/PERIKSA-PASAL-W2a.md`. Semua rujukan di bawah dipakai sebagai `dasarHukum` katalog di
`ekstensi-sipp/saksi-katalog/{wasiat,hibah,wakaf,ekonomi-syariah}.json`. Nomor pasal TIDAK pernah ditulis dalam teks pertanyaan atau
jawaban saksi; rujukan hanya tampil di panel "Susun saksi" (bagian dasar hukum) bila berstatus `terverifikasi`. Yang berstatus
`perlu-verifikasi` tidak tampil dan tidak tercetak (dijaga uji `saksi-katalog-penjaga.test.ts` dan `w2a-k2-wasiat-hibah-wakaf-es.test.ts`).

| Katalog | id dasar | Rujukan | Isi ringkas | Status | Sumber | Tercetak/panel |
| :-- | :-- | :-- | :-- | :-- | :-- | :-- |
| wasiat | dh-khi-175 | Pasal 175 KHI | kewajiban ahli waris: mengurus jenazah, menyelesaikan hutang dan wasiat, membagi warisan; tanggung jawab hutang terbatas pada nilai harta peninggalan | terverifikasi | referensi/KHI-pasal-terverifikasi.md (dicocokkan pasal.id dan naskah Depag, 18 Okt 2026); bunyi sama dengan butir U5 | panel (tidak di teks saksi) |
| wasiat | dh-khi-171h | Pasal 171 huruf e, f, h KHI | harta warisan; wasiat; anak angkat | terverifikasi | sama dengan di atas | panel |
| wasiat | dh-khi-198 | Pasal 198 KHI | wasiat berupa hasil atau pemanfaatan benda harus diberi jangka waktu tertentu | perlu-verifikasi | naskah KHI Depag hasil pindai (referensi/_unduhan/khi/khi.txt), dibaca 20 Okt 2026; belum dicocokkan dengan pasal.id | tidak tampil, tidak tercetak |
| wasiat | dh-khi-199 | Pasal 199 KHI | pencabutan wasiat selama penerima belum menyatakan persetujuan; cara pencabutan menurut bentuk wasiat (lisan, tertulis, akta Notaris) | perlu-verifikasi | idem | tidak tampil, tidak tercetak |
| wasiat | dh-khi-207-208 | Pasal 207 dan 208 KHI | wasiat tidak diperbolehkan kepada orang yang merawat atau memberi tuntunan kerohanian pewasiat sewaktu sakit kecuali dengan penegasan membalas jasa; wasiat tidak berlaku bagi Notaris dan saksi pembuat akta | perlu-verifikasi | idem | tidak tampil, tidak tercetak |
| hibah | dh-khi-171g | Pasal 171 huruf g KHI | hibah adalah pemberian suatu benda secara sukarela tanpa imbalan dari seseorang kepada orang lain yang masih hidup untuk dimiliki | terverifikasi | referensi/KHI-pasal-terverifikasi.md (Pasal 171 huruf a-i) | panel |
| wakaf | dh-khi-218-223 | Pasal 218 ayat (1) dan Pasal 223 ayat (1), (3), (4) KHI | ikrar kepada nadzir di hadapan PPAIW dengan sekurang-kurangnya dua saksi; akta ikrar sah bila disaksikan dua saksi; wakif menyerahkan bukti pemilikan dan, untuk benda tidak bergerak, surat keterangan kepala desa yang diperkuat camat | perlu-verifikasi | KHI Buku III (khi.txt, hasil pindai), dibaca 21 Okt 2026 | tidak tampil, tidak tercetak |
| wakaf | dh-khi-219-221 | Pasal 219 sampai 221 KHI | syarat nadzir perorangan; didaftar pada KUA Kecamatan dan bersumpah; kewajiban mengurus dan melapor; pemberhentian nadzir | perlu-verifikasi | idem | tidak tampil, tidak tercetak |
| wakaf | dh-khi-224-225 | Pasal 224 dan 225 KHI | pendaftaran perwakafan kepada Camat; benda wakaf tidak dapat diubah kecuali dengan persetujuan tertulis Kepala KUA Kecamatan | perlu-verifikasi | idem | tidak tampil, tidak tercetak |
| ekonomi-syariah | dh-khes-20-akad | Pasal 20 angka 1, 3, 4, 6, 9, 14, 37 dan 38 KHES (PERMA 2/2008) | pengertian akad, syirkah, mudharabah, murabahah, ijarah, rahn, qard dan ta'widh | terverifikasi | PERMA-2-2008-KHES.pdf (naskah resmi dari pengguna), teks halaman 4 dan 5, dibaca 21 Okt 2026 | panel |
| ekonomi-syariah | dh-perma-gs | PERMA 2/2015 jo PERMA 4/2019 (gugatan sederhana) | syarat gugatan sederhana: cidera janji dengan nilai gugatan paling banyak lima ratus juta rupiah, bukan pengadilan khusus, bukan sengketa hak atas tanah, domisili sama, hakim tunggal | perlu-verifikasi | teks blangko Derry 10 Ekonomi Syariah [01] (server aps_badilag, 21 Okt 2026); naskah PERMA belum ada pada berkas pengguna | tidak tampil, tidak tercetak |
| ekonomi-syariah | dh-perma-14-es | PERMA 14/2016 | tata cara penyelesaian perkara ekonomi syariah | perlu-verifikasi | teks blangko Derry 10a (server); naskah ada di referensi/_unduhan/ekstra/perma_perma-no-14-tahun-2016.html tetapi belum dicocokkan pasal demi pasal | tidak tampil, tidak tercetak |
| 4 katalog tambahan Tergugat | dh-rbg-283 | Pasal 283 RBg jo Pasal 1865 KUH Perdata | beban pembuktian | terverifikasi | salinan dasar yang sudah ada pada kewarisan-tergugat.json | panel |

Catatan:
- Dasar hukum v1 (KHI 194-197, 201, 209-213; UU 41/2004; PP 42/2006; KHES 21, 22, 36-41; Pasal 49 UU 7/1989) TIDAK diubah.
- Pasal yang dibaca dari pindaian (OCR) tidak boleh dinaikkan menjadi `terverifikasi` sebelum dicocokkan dengan digitalisasi pasal.id atau naskah resmi.
- Tidak ada nomor putusan atau yurisprudensi yang ditulis. Yurisprudensi yang disebut dalam gugatan nyata (mis. putusan MA pada perkara wasiat) sengaja tidak dijadikan dasar.
- Butir saksi tidak menyebut nomor pasal; penilaian hukum (sah tidaknya wasiat, hibah dan wakaf, batas sepertiga, penarikan hibah, wanprestasi) tetap milik hakim.
