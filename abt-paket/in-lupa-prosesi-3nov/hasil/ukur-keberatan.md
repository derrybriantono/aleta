# Ukur pola keberatan pihak lain - `rekomendasi-putusan.ts` (3 Nov 2026, keputusan pengguna 14.45)

Pola lama `RE_KEBERATAN_ADA` = `\b(?:ada|pernah)\b(?:\S+\s+){0,4}\b(?:keberatan...)` tidak punya `\s+` sesudah "ada|pernah", sehingga
**tidak pernah cocok** pada kalimat berspasi (0 dari 2.652 kalimat). Akibatnya unsur "Tidak ada keberatan pihak lain" selalu "terbukti",
juga bila saksi berkata "Ada keluarga yang keberatan". `RE_KEBERATAN_TIDAK` cacat serupa. Pengganti: `keberatanDiterangkan(jawaban)` -
per anak kalimat; kata keberatan (keberatan, berkeberatan, mempermasalahkan, mempersoalkan, menggugat, menentang, menolak, melarang)
= ADA kecuali dinegasikan (tidak/tak/belum/bukan/tanpa/tiada sebelumnya, atau "keberatan ... tidak ada" sesudahnya); anak kalimat yang
hanya menyebut pokok ("ada tidaknya ...", "mengenai/tentang ...") atau tidak yakin ("tidak saya ketahui", "ragu", "mungkin") netral;
jawaban pendek "Ada, yaitu ..." / "Pernah, ..." = ADA, "Tidak ada" = TIDAK.

Kalimat yang diukur (unik, 2.652): semua jawaban katalog saksi 49 jenis pada butir bertanya keberatan + kalimat katalog lain yang memuat
kata keberatan, jawaban umum katalog (tidak tahu/ragu/sebagian/mendengar/de auditu) pada butir keberatan, string uji `src/test/*.ts`
yang memuat kata keberatan, dan 22 kalimat rekaan.

| sumber | kalimat | lama ADA | baru ADA | catatan |
|---|---|---|---|---|
| katalog itsbat + kumulasi, butir `q-in-keberatan-*` | 72 | 0 | 12 | 12 = versi "berbeda" saksi 2 ("pernah ada kerabat yang mempersoalkan ...") - BENAR; 60 lainnya (melihat, de auditu, mendengar, ragu, sebagian, tidak tahu) tetap TIDAK |
| katalog jenis lain (poligami, pencegahan, hibah, pengangkatan anak, ...) | 1.185 | 0 | 377 | kalimat yang memang menerangkan keberatan ("Pemohon keberatan dimadu ...") - tidak dibaca rekomendasi itsbat |
| jawaban umum katalog | 1.320 | 0 | 50 | sisa: de auditu "dasar/alasan keberatan Pemohon hanya saya ketahui dari penuturan ..." pada jenis yang keberatannya pokok perkara (poligami, pencegahan) |
| string uji | 68 | 0 | 47 | judul uji, nama blangko, kalimat posita - bukan jawaban saksi itsbat |
| rekaan (permintaan pengguna) | 22 | 0 | 8 | lihat uji `in-lupa-prosesi-3nov.test.ts`: 9 ADA, 15 TIDAK, semuanya sesuai |

Rekomendasi yang sudah diuji tidak berubah: `rekomendasi-putusan-2nov` 30/30, `panel-derry-lipat-2nov` 17/17, `panel-ringkas-2nov` 12/12,
`rekomendasi-blangko-q3` 15/15 (jawaban saksi itsbat di uji = "Saya tidak pernah mendengar ada pihak lain yang keberatan" -> tetap TIDAK).
Yang berubah hanya yang memang salah: saksi yang menerangkan ada keberatan kini membuat unsur keberatan "tidak terbukti" + ragu.
Batas: "Tidak ada yang keberatan, namun awalnya ibu Pemohon II sempat keberatan" = ADA (anak kalimat sesudah "namun" tidak dinegasikan) -
sengaja: hakim yang menilai.
