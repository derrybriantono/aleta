import type { Cermin } from "@/lib/tipe-keluaran/kontrak";

/**
 * ============================================================================
 * CERMIN BAWAAN KETERANGAN SAKSI (K10) - disalin PERSIS dari bot
 * ============================================================================
 *
 * Sumber: aleta_bot/services/ragamBasBawaan.js (data murni, tanpa require)
 *   PEMBUKA (4, profil manusia)      -> bas.saksi.pembuka
 *   RAGAM_KATA (34 pasangan)         -> bas.saksi.ragam-kata
 *   JAWABAN_MODUS (20 bank, 80)      -> bas.saksi.jawaban-modus
 *   BENTUK (ditambang dari korpus)   -> bas.saksi.bentuk
 *   PROFIL (per kelompok pertanyaan) -> bas.saksi.profil
 *
 * Pemiliknya t2-ragam-bas-bot. Uji tipe-keluaran-cermin-bas.test.ts
 * me-require ragamBasBawaan.js dan menuntut cermin ini deep-equal, lalu
 * MENJALANKAN jawabMenurutModus bot untuk tiap kunci dan menyusun berita acara
 * dengan tipeKeluaran = cermin (harus sama persis dengan tanpa tipeKeluaran).
 * Alat tulisnya D:/aleta-dev/kerja/enam-butir/t2-ragam-bas-bot/tulis-cermin.cjs.
 *
 * BENTUK YANG DIPILIH, dan sebabnya:
 *
 *   pembuka     kunci '', nilai = pembuka, data {bobot} = persen pemakaiannya
 *               oleh saksi manusia ('Ya,' 8,1; 'Setahu saya,' 0,9;
 *               'Sepengetahuan saya,' 0,4; 'Yang saya ketahui,' 0,2). Delapan
 *               pembuka lama (termasuk 'Iya,') dibuang: 0 kali dipakai manusia,
 *               dan 'Iya,' dirusak replace_ket_saksi ABT di putusan.
 *
 *   ragam-kata  kunci '', nilai = kata polos, data {ganti, abaikanBesarKecil?}.
 *               Pola selalu \b<kata>\b - regex TIDAK PERNAH diterima (K2).
 *               Hanya cadangan bila jawaban tidak cocok dengan satu BENTUK.
 *
 *   jawaban-modus kunci 'kelompok|modus', nilai = templat dengan penanda
 *               {sumber}/{daftar}/{isi}. Satu kunci = satu bank = satu cabang
 *               kode; modus yang dilayani tiap cabang di CABANG_JAWABAN_MODUS.
 *
 *   bentuk      kunci = nama kelompok bentuk (huruf kecil), nilai = bentuk
 *               berpenanda #0046#/#0047# dan {slot} (isi dipindah menurut
 *               urutan), data {asalKorpus:{kemunculan, perkara}} - bukti >= 3
 *               kemunculan di >= 3 perkara. Bentuk sekunci SETARA maknanya.
 *
 *   profil      kunci = kelompok pertanyaan (kelompokTanya di pemilih-ragam),
 *               data {peluangRagam, rumusan}. Pokok 1; rumusan = 1 - persen
 *               identik dua saksi manusia; kelompok lain 1 sejak 26
 *               September 2026 (permintaan pengguna 9: dua saksi berbeda
 *               susunan, sama fakta). Kunci 'lain' untuk pertanyaan tanpa
 *               kelompok.
 */
export const CERMIN_BAS_SAKSI = {
  "bas.saksi.pembuka": [
    { kunci: "", nilai: "Ya, ", data: { bobot: 8.1 }, urutan: 0 },
    { kunci: "", nilai: "Setahu saya, ", data: { bobot: 0.9 }, urutan: 1 },
    { kunci: "", nilai: "Sepengetahuan saya, ", data: { bobot: 0.4 }, urutan: 2 },
    { kunci: "", nilai: "Yang saya ketahui, ", data: { bobot: 0.2 }, urutan: 3 },
  ],
  "bas.saksi.ragam-kata": [
    { kunci: "", nilai: "karena", data: { ganti: "sebab" }, urutan: 0 },
    { kunci: "", nilai: "sudah", data: { ganti: "telah" }, urutan: 1 },
    { kunci: "", nilai: "sering", data: { ganti: "kerap" }, urutan: 2 },
    { kunci: "", nilai: "saya mengetahui", data: { ganti: "saya tahu", abaikanBesarKecil: true }, urutan: 3 },
    { kunci: "", nilai: "saya melihat", data: { ganti: "saya menyaksikan", abaikanBesarKecil: true }, urutan: 4 },
    { kunci: "", nilai: "bertempat tinggal", data: { ganti: "berdiam" }, urutan: 5 },
    { kunci: "", nilai: "saat ini", data: { ganti: "sekarang ini" }, urutan: 6 },
    { kunci: "", nilai: "sampai sekarang", data: { ganti: "hingga kini" }, urutan: 7 },
    { kunci: "", nilai: "kemudian", data: { ganti: "lalu" }, urutan: 8 },
    { kunci: "", nilai: "namun", data: { ganti: "tetapi" }, urutan: 9 },
    { kunci: "", nilai: "sehingga", data: { ganti: "hingga" }, urutan: 10 },
    { kunci: "", nilai: "pisah rumah", data: { ganti: "tinggal terpisah" }, urutan: 11 },
    { kunci: "", nilai: "mendamaikan", data: { ganti: "merukunkan" }, urutan: 12 },
    { kunci: "", nilai: "benar", data: { ganti: "betul", abaikanBesarKecil: true }, urutan: 13 },
    { kunci: "", nilai: "saya mengenal", data: { ganti: "saya kenal dengan", abaikanBesarKecil: true }, urutan: 14 },
    { kunci: "", nilai: "saya kenal dengan", data: { ganti: "saya mengenal", abaikanBesarKecil: true }, urutan: 15 },
    { kunci: "", nilai: "telah", data: { ganti: "sudah" }, urutan: 16 },
    { kunci: "", nilai: "sudah cukup", data: { ganti: "cukup sekian", abaikanBesarKecil: true }, urutan: 17 },
    { kunci: "", nilai: "saya tidak sanggup lagi", data: { ganti: "saya sudah tidak sanggup lagi", abaikanBesarKecil: true }, urutan: 18 },
    { kunci: "", nilai: "perselisihan dan pertengkaran", data: { ganti: "pertengkaran dan perselisihan", abaikanBesarKecil: true }, urutan: 19 },
    { kunci: "", nilai: "menghadap di persidangan ini", data: { ganti: "hadir di persidangan ini" }, urutan: 20 },
    { kunci: "", nilai: "berselisih dan bertengkar", data: { ganti: "bertengkar dan berselisih" }, urutan: 21 },
    { kunci: "", nilai: "yang saya tahu yaitu", data: { ganti: "yang saya ketahui adalah" }, urutan: 22 },
    { kunci: "", nilai: "tidak ada hubungan darah", data: { ganti: "tidak memiliki hubungan darah" }, urutan: 23 },
    { kunci: "", nilai: "sebelum menikah", data: { ganti: "sebelum pernikahan", abaikanBesarKecil: true }, urutan: 24 },
    { kunci: "", nilai: "tetap rukun dan bahagia", data: { ganti: "masih rukun dan bahagia" }, urutan: 25 },
    { kunci: "", nilai: "saya tahu kalau", data: { ganti: "saya mengetahui bahwa", abaikanBesarKecil: true }, urutan: 26 },
    { kunci: "", nilai: "pernah juga", data: { ganti: "juga pernah" }, urutan: 27 },
    { kunci: "", nilai: "ada pihak lain", data: { ganti: "adanya pihak lain" }, urutan: 28 },
    { kunci: "", nilai: "yang bertindak sebagai", data: { ganti: "yang menjadi", abaikanBesarKecil: true }, urutan: 29 },
    { kunci: "", nilai: "berupa", data: { ganti: "yaitu" }, urutan: 30 },
    { kunci: "", nilai: "sewaktu", data: { ganti: "pada saat" }, urutan: 31 },
    { kunci: "", nilai: "sedangkan", data: { ganti: "dan" }, urutan: 32 },
    { kunci: "", nilai: "menikah di", data: { ganti: "melangsungkan pernikahan di" }, urutan: 33 },
  ],
  "bas.saksi.jawaban-modus": [
    { kunci: "cara-tahu|dari-cerita", nilai: "saya mengetahui karena diceritakan oleh {sumber}", urutan: 0 },
    { kunci: "cara-tahu|dari-cerita", nilai: "saya mengetahuinya karena {sumber} bercerita kepada saya", urutan: 1 },
    { kunci: "cara-tahu|dari-cerita", nilai: "{sumber} sendiri yang menceritakan hal itu kepada saya", urutan: 2 },
    { kunci: "cara-tahu|dari-cerita", nilai: "saya tahu dari penuturan {sumber} langsung", urutan: 3 },
    { kunci: "cara-tahu|tidak-melihat", nilai: "saya mengetahui dari cerita keluarga dan tetangga", urutan: 4 },
    { kunci: "cara-tahu|tidak-melihat", nilai: "saya mengetahuinya dari cerita orang-orang di sekitar mereka", urutan: 5 },
    { kunci: "cara-tahu|tidak-melihat", nilai: "hal itu saya dengar dari pembicaraan keluarga mereka", urutan: 6 },
    { kunci: "cara-tahu|tidak-melihat", nilai: "saya tahu dari orang-orang yang tinggal berdekatan dengan mereka", urutan: 7 },
    { kunci: "cara-tahu|sama", nilai: "saya mengetahui karena saya melihat sendiri", urutan: 8 },
    { kunci: "cara-tahu|sama", nilai: "saya mengetahuinya karena melihat dan mendengar sendiri", urutan: 9 },
    { kunci: "cara-tahu|sama", nilai: "saya menyaksikannya sendiri di rumah mereka", urutan: 10 },
    { kunci: "cara-tahu|sama", nilai: "saya mengetahuinya karena saya sendiri yang menyaksikan", urutan: 11 },
    { kunci: "penyebab|tahu-pisah", nilai: "saya tidak pernah mengetahui mereka bertengkar, yang saya tahu keduanya sekarang sudah berpisah rumah", urutan: 12 },
    { kunci: "penyebab|tahu-pisah", nilai: "saya tidak mengetahui adanya pertengkaran di antara mereka, yang saya ketahui hanya mereka sudah tidak tinggal serumah", urutan: 13 },
    { kunci: "penyebab|tahu-pisah", nilai: "perselisihan mereka tidak saya ketahui, yang saya tahu hanya keduanya kini tinggal terpisah", urutan: 14 },
    { kunci: "penyebab|tahu-pisah", nilai: "tentang pertengkaran mereka saya tidak tahu apa-apa, yang saya ketahui keduanya sudah tidak serumah", urutan: 15 },
    { kunci: "menyaksikan|tahu-pisah", nilai: "saya belum pernah menyaksikan atau mendengar pertengkaran mereka", urutan: 16 },
    { kunci: "menyaksikan|tahu-pisah", nilai: "saya tidak pernah melihat maupun mendengar mereka bertengkar", urutan: 17 },
    { kunci: "menyaksikan|tahu-pisah", nilai: "tidak pernah sekalipun saya melihat atau mendengar mereka bertengkar", urutan: 18 },
    { kunci: "menyaksikan|tahu-pisah", nilai: "saya sama sekali tidak pernah melihat ataupun mendengar mereka bertengkar", urutan: 19 },
    { kunci: "rukun|tahu-pisah", nilai: "saya tidak mengetahui pokok persoalannya, sehingga saya tidak sanggup mendamaikan", urutan: 20 },
    { kunci: "rukun|tahu-pisah", nilai: "karena saya tidak mengetahui persoalannya, saya tidak dapat mendamaikan mereka", urutan: 21 },
    { kunci: "rukun|tahu-pisah", nilai: "saya tidak sanggup mendamaikan sebab persoalan mereka tidak saya ketahui", urutan: 22 },
    { kunci: "rukun|tahu-pisah", nilai: "persoalan mereka tidak saya ketahui, maka saya tidak sanggup merukunkan keduanya", urutan: 23 },
    { kunci: "penyebab|tidak-tahu", nilai: "saya tidak tahu persis penyebabnya, saya hanya mengetahui mereka sering berselisih dan kini sudah pisah rumah", urutan: 24 },
    { kunci: "penyebab|tidak-tahu", nilai: "saya tidak mengetahui apa penyebabnya, yang saya tahu mereka sudah tidak rukun dan sudah berpisah", urutan: 25 },
    { kunci: "penyebab|tidak-tahu", nilai: "penyebabnya tidak saya ketahui, yang saya lihat mereka memang sering berselisih dan sekarang sudah berpisah", urutan: 26 },
    { kunci: "penyebab|tidak-tahu", nilai: "apa yang menjadi penyebab perselisihan mereka tidak saya ketahui, saya hanya tahu mereka sering bertengkar dan kini sudah berpisah", urutan: 27 },
    { kunci: "penyebab|dari-cerita", nilai: "yang saya ketahui dari cerita {sumber}, penyebabnya yaitu {isi}", urutan: 28 },
    { kunci: "penyebab|dari-cerita", nilai: "menurut cerita {sumber} kepada saya, penyebabnya adalah {isi}", urutan: 29 },
    { kunci: "penyebab|dari-cerita", nilai: "{sumber} menceritakan kepada saya bahwa penyebabnya {isi}", urutan: 30 },
    { kunci: "penyebab|dari-cerita", nilai: "saya mendengar dari {sumber} sendiri bahwa yang menjadi penyebab adalah {isi}", urutan: 31 },
    { kunci: "penyebab|sebagian", nilai: "sepengetahuan saya penyebabnya adalah {daftar}, penyebab lainnya saya tidak mengetahui", urutan: 32 },
    { kunci: "penyebab|sebagian", nilai: "yang saya ketahui sendiri hanya {daftar}, selebihnya saya tidak tahu", urutan: 33 },
    { kunci: "penyebab|sebagian", nilai: "sebatas yang saya ketahui penyebabnya {daftar}, selain itu saya tidak dapat menerangkan", urutan: 34 },
    { kunci: "penyebab|sebagian", nilai: "setahu saya yang menjadi penyebab adalah {daftar}, penyebab lain saya tidak tahu", urutan: 35 },
    { kunci: "penyebab|sama", nilai: "penyebab perselisihan dan pertengkaran mereka yang saya ketahui yaitu {daftar}", urutan: 36 },
    { kunci: "penyebab|sama", nilai: "penyebabnya sepengetahuan saya adalah {daftar}", urutan: 37 },
    { kunci: "penyebab|sama", nilai: "sepanjang yang saya ketahui, mereka berselisih karena {daftar}", urutan: 38 },
    { kunci: "penyebab|sama", nilai: "yang menjadi penyebab perselisihan mereka sepengetahuan saya adalah {daftar}", urutan: 39 },
    { kunci: "menyaksikan|tidak-melihat", nilai: "saya tidak pernah menyaksikan langsung pertengkaran mereka", urutan: 40 },
    { kunci: "menyaksikan|tidak-melihat", nilai: "saya tidak pernah melihat sendiri mereka bertengkar, saya mengetahuinya dari cerita", urutan: 41 },
    { kunci: "menyaksikan|tidak-melihat", nilai: "pertengkaran itu tidak pernah saya saksikan sendiri, hanya saya dengar dari cerita", urutan: 42 },
    { kunci: "menyaksikan|tidak-melihat", nilai: "saya tidak pernah melihat sendiri mereka bertengkar, saya hanya mendengar dari cerita orang", urutan: 43 },
    { kunci: "menyaksikan|tidak-tahu", nilai: "saya pernah melihat mereka bertengkar beberapa kali, namun tidak tahu sebabnya", urutan: 44 },
    { kunci: "menyaksikan|tidak-tahu", nilai: "saya pernah mendengar mereka bertengkar, tetapi tidak tahu apa yang dipersoalkan", urutan: 45 },
    { kunci: "menyaksikan|tidak-tahu", nilai: "beberapa kali saya melihat mereka bertengkar, tetapi persoalannya tidak saya ketahui", urutan: 46 },
    { kunci: "menyaksikan|tidak-tahu", nilai: "saya beberapa kali menyaksikan mereka bertengkar, hanya saja apa yang diributkan tidak saya ketahui", urutan: 47 },
    { kunci: "waktu|tidak-melihat", nilai: "saya tidak menyaksikannya sendiri, tetapi dari cerita yang saya dengar {jawab}", urutan: 48 },
    { kunci: "waktu|tidak-melihat", nilai: "saya tidak pernah melihat sendiri pertengkaran mereka, namun dari cerita orang-orang di sekitar mereka {jawab}", urutan: 49 },
    { kunci: "waktu|tidak-melihat", nilai: "hal itu tidak saya saksikan sendiri, yang saya dengar dari keluarga mereka {jawab}", urutan: 50 },
    { kunci: "waktu|tidak-melihat", nilai: "saya hanya mendengar dari cerita orang lain bahwa {jawab}", urutan: 51 },
    { kunci: "waktu|dari-cerita", nilai: "menurut cerita {sumber} kepada saya, {jawab}", urutan: 52 },
    { kunci: "waktu|dari-cerita", nilai: "{sumber} menceritakan kepada saya bahwa {jawab}", urutan: 53 },
    { kunci: "waktu|dari-cerita", nilai: "yang saya ketahui dari cerita {sumber}, {jawab}", urutan: 54 },
    { kunci: "waktu|dari-cerita", nilai: "sebagaimana diceritakan {sumber} kepada saya, {jawab}", urutan: 55 },
    { kunci: "waktu|tahu-pisah", nilai: "saya tidak mengetahui kapan mereka mulai berselisih, yang saya tahu keduanya sekarang sudah berpisah tempat tinggal", urutan: 56 },
    { kunci: "waktu|tahu-pisah", nilai: "saya tidak pernah mengetahui adanya pertengkaran di antara mereka, sehingga kapan mulainya tidak saya ketahui", urutan: 57 },
    { kunci: "waktu|tahu-pisah", nilai: "kapan perselisihan itu terjadi tidak saya ketahui, yang saya ketahui hanya mereka kini tinggal terpisah", urutan: 58 },
    { kunci: "waktu|tahu-pisah", nilai: "saya tidak tahu sejak kapan mereka berselisih, yang saya lihat keduanya sudah tidak tinggal serumah lagi", urutan: 59 },
    { kunci: "kehidupan|tidak-melihat", nilai: "dari cerita yang saya dengar, {jawab}", urutan: 60 },
    { kunci: "kehidupan|tidak-melihat", nilai: "saya tidak melihatnya sendiri, tetapi dari cerita orang-orang di sekitar mereka {jawab}", urutan: 61 },
    { kunci: "kehidupan|tidak-melihat", nilai: "yang saya dengar dari keluarga dan tetangga mereka, {jawab}", urutan: 62 },
    { kunci: "kehidupan|tidak-melihat", nilai: "sepanjang yang saya dengar dari cerita orang lain, {jawab}", urutan: 63 },
    { kunci: "kehidupan|dari-cerita", nilai: "menurut cerita {sumber} kepada saya, {jawab}", urutan: 64 },
    { kunci: "kehidupan|dari-cerita", nilai: "{sumber} bercerita kepada saya bahwa {jawab}", urutan: 65 },
    { kunci: "kehidupan|dari-cerita", nilai: "dari penuturan {sumber} kepada saya, {jawab}", urutan: 66 },
    { kunci: "kehidupan|dari-cerita", nilai: "yang saya ketahui dari cerita {sumber}, {jawab}", urutan: 67 },
    { kunci: "kehidupan|tahu-pisah", nilai: "yang saya ketahui sekarang mereka sudah tidak tinggal serumah lagi, sedangkan pertengkaran di antara mereka tidak saya ketahui", urutan: 68 },
    { kunci: "kehidupan|tahu-pisah", nilai: "saya hanya mengetahui keduanya kini sudah berpisah tempat tinggal, tentang perselisihan mereka saya tidak tahu", urutan: 69 },
    { kunci: "kehidupan|tahu-pisah", nilai: "rumah tangga mereka sekarang tidak lagi utuh karena keduanya tinggal terpisah, namun saya tidak mengetahui adanya pertengkaran", urutan: 70 },
    { kunci: "kehidupan|tahu-pisah", nilai: "sepengetahuan saya mereka sudah tidak tinggal bersama lagi, selebihnya tentang keadaan rumah tangga mereka saya tidak mengetahui", urutan: 71 },
    { kunci: "cara-tahu|tidak-tahu", nilai: "soal penyebab itu saya tidak tahu, yang saya ketahui hanya pertengkaran mereka karena saya pernah melihat dan mendengarnya", urutan: 72 },
    { kunci: "cara-tahu|tidak-tahu", nilai: "saya tidak mengetahui apa penyebab pertengkaran mereka, saya hanya tahu mereka bertengkar karena pernah mendengar sendiri", urutan: 73 },
    { kunci: "cara-tahu|tidak-tahu", nilai: "penyebab perselisihan itu tidak saya ketahui, yang saya ketahui sebatas pertengkaran yang pernah saya saksikan", urutan: 74 },
    { kunci: "cara-tahu|tidak-tahu", nilai: "saya tidak dapat menerangkan apa penyebab perselisihan mereka, saya hanya pernah melihat mereka bertengkar", urutan: 75 },
    { kunci: "cara-tahu|tahu-pisah", nilai: "saya tidak mengetahui adanya perselisihan di antara mereka, yang saya ketahui hanya keduanya sudah tidak lagi tinggal serumah", urutan: 76 },
    { kunci: "cara-tahu|tahu-pisah", nilai: "saya tidak tahu tentang perselisihan mereka, yang saya ketahui hanya keduanya kini sudah tinggal terpisah", urutan: 77 },
    { kunci: "cara-tahu|tahu-pisah", nilai: "perselisihan mereka tidak pernah saya ketahui, saya hanya tahu bahwa mereka sudah tidak serumah lagi", urutan: 78 },
    { kunci: "cara-tahu|tahu-pisah", nilai: "saya tidak mengetahui penyebab maupun pertengkaran mereka, yang saya tahu sebatas keduanya sudah berpisah tempat tinggal", urutan: 79 },
  ],
  "bas.saksi.bentuk": [
    { kunci: "kenal hubungan", nilai: "saya kenal dengan {slot} karena saya adalah {slot}", data: { asalKorpus: { kemunculan: 2775, perkara: 1407 } }, urutan: 0 },
    { kunci: "kenal hubungan", nilai: "saya mengenal {slot} karena saya adalah {slot}", data: { asalKorpus: { kemunculan: 246, perkara: 130 } }, urutan: 1 },
    { kunci: "kenal hubungan", nilai: "saya kenal {slot} karena saya adalah {slot}", data: { asalKorpus: { kemunculan: 5, perkara: 4 } }, urutan: 2 },
    { kunci: "kenal hubungan", nilai: "saya kenal dengan {slot}, karena saya adalah {slot}", data: { asalKorpus: { kemunculan: 7, perkara: 6 } }, urutan: 3 },
    { kunci: "kenal hubungan", nilai: "saya kenal dengan {slot} karena saya {slot}", data: { asalKorpus: { kemunculan: 214, perkara: 146 } }, urutan: 4 },
    { kunci: "kenal hubungan", nilai: "saya mengenal {slot} karena saya {slot}", data: { asalKorpus: { kemunculan: 33, perkara: 22 } }, urutan: 5 },
    { kunci: "kenal hubungan", nilai: "saya kenal dengan {slot}, saya adalah {slot}", data: { asalKorpus: { kemunculan: 4, perkara: 4 } }, urutan: 6 },
    { kunci: "kenal sebagai", nilai: "saya kenal dengan #0047# sebagai {slot}", data: { asalKorpus: { kemunculan: 2594, perkara: 1356 } }, urutan: 7 },
    { kunci: "kenal sebagai", nilai: "saya kenal #0047# sebagai {slot}", data: { asalKorpus: { kemunculan: 26, perkara: 24 } }, urutan: 8 },
    { kunci: "kenal sebagai", nilai: "saya mengenal #0047# sebagai {slot}", data: { asalKorpus: { kemunculan: 6, perkara: 5 } }, urutan: 9 },
    { kunci: "tinggal setelah menikah", nilai: "setelah menikah #0046# dan #0047# membina rumah tangga di {slot}", data: { asalKorpus: { kemunculan: 229, perkara: 114 } }, urutan: 10 },
    { kunci: "tinggal setelah menikah", nilai: "setelah menikah #0046# dan #0047# tinggal bersama di {slot}", data: { asalKorpus: { kemunculan: 2312, perkara: 1231 } }, urutan: 11 },
    { kunci: "tinggal setelah menikah", nilai: "setelah menikah #0046# dan #0047# bertempat tinggal di {slot}", data: { asalKorpus: { kemunculan: 74, perkara: 39 } }, urutan: 12 },
    { kunci: "tinggal setelah menikah", nilai: "setelah menikah, #0046# dan #0047# tinggal bersama di {slot}", data: { asalKorpus: { kemunculan: 270, perkara: 136 } }, urutan: 13 },
    { kunci: "tinggal setelah menikah", nilai: "#0046# dan #0047# setelah menikah tinggal bersama di {slot}", data: { asalKorpus: { kemunculan: 8, perkara: 7 } }, urutan: 14 },
    { kunci: "tinggal setelah menikah", nilai: "setelah menikah #0046# dan #0047# tinggal di {slot}", data: { asalKorpus: { kemunculan: 97, perkara: 71 } }, urutan: 15 },
    { kunci: "rumah tangga tidak harmonis", nilai: "pada awalnya kehidupan rumah tangga #0046# dan #0047# rukun dan harmonis, namun sekarang ini rumah tangga mereka tidak harmonis lagi karena sering terjadi perselisihan dan pertengkaran yang terus menerus", data: { asalKorpus: { kemunculan: 360, perkara: 208 } }, urutan: 16 },
    { kunci: "rumah tangga tidak harmonis", nilai: "pada awalnya kehidupan rumah tangga #0046# dan #0047# rukun dan harmonis, namun sekarang ini rumah tangga mereka tidak harmonis lagi karena sering terjadi pertengkaran yang terus menerus", data: { asalKorpus: { kemunculan: 14, perkara: 14 } }, urutan: 17 },
    { kunci: "pernah melihat langsung", nilai: "saya pernah melihat dan mendengar langsung #0046# dan #0047# bertengkar, sebanyak {slot} kali, di {slot}", data: { asalKorpus: { kemunculan: 139, perkara: 104 } }, urutan: 18 },
    { kunci: "pernah melihat langsung", nilai: "saya pernah melihat dan mendengar langsung #0046# dan #0047# bertengkar sebanyak {slot} kali di {slot}", data: { asalKorpus: { kemunculan: 5, perkara: 4 } }, urutan: 19 },
    { kunci: "pisah sejak", nilai: "#0046# dan #0047# sudah pisah tempat tinggal sejak {slot}", data: { asalKorpus: { kemunculan: 2733, perkara: 1390 } }, urutan: 20 },
    { kunci: "pisah sejak", nilai: "#0046# dan #0047# sudah berpisah tempat tinggal sejak {slot}", data: { asalKorpus: { kemunculan: 115, perkara: 61 } }, urutan: 21 },
    { kunci: "pisah sejak", nilai: "#0046# dan #0047# sudah pisah rumah sejak {slot}", data: { asalKorpus: { kemunculan: 3, perkara: 3 } }, urutan: 22 },
    { kunci: "pisah sejak", nilai: "#0046# dan #0047# sudah pisah tempat tinggal sejak {slot} hingga sekarang", data: { asalKorpus: { kemunculan: 6, perkara: 4 } }, urutan: 23 },
    { kunci: "pisah sejak", nilai: "#0046# dan #0047# sudah pisah tempat tinggal sejak {slot} sampai sekarang", data: { asalKorpus: { kemunculan: 5, perkara: 4 } }, urutan: 24 },
    { kunci: "lama pisah", nilai: "#0046# dan #0047# berpisah tempat tinggal sudah kurang lebih {slot}", data: { asalKorpus: { kemunculan: 325, perkara: 181 } }, urutan: 25 },
    { kunci: "lama pisah", nilai: "#0046# dan #0047# sudah pisah tempat tinggal kurang lebih {slot}", data: { asalKorpus: { kemunculan: 17, perkara: 14 } }, urutan: 26 },
    { kunci: "lama pisah", nilai: "#0046# dan #0047# sudah pisah tempat tinggal selama kurang lebih {slot}", data: { asalKorpus: { kemunculan: 3, perkara: 3 } }, urutan: 27 },
    { kunci: "lama pisah", nilai: "#0046# dan #0047# berpisah tempat tinggal sudah kurang lebih {slot} lamanya", data: { asalKorpus: { kemunculan: 46, perkara: 27 } }, urutan: 28 },
    { kunci: "lama pisah", nilai: "#0046# dan #0047# sudah pisah tempat tinggal kurang lebih {slot} lamanya", data: { asalKorpus: { kemunculan: 4, perkara: 4 } }, urutan: 29 },
    { kunci: "diupayakan rukun oleh", nilai: "#0046# dan #0047# sudah pernah diupayakan untuk dirukunkan oleh {slot}, namun tidak berhasil", data: { asalKorpus: { kemunculan: 1757, perkara: 955 } }, urutan: 30 },
    { kunci: "diupayakan rukun oleh", nilai: "#0046# dan #0047# sudah pernah diupayakan untuk dirukunkan oleh {slot} namun tidak berhasil", data: { asalKorpus: { kemunculan: 392, perkara: 230 } }, urutan: 31 },
    { kunci: "keluarga mendamaikan gagal", nilai: "pihak keluarga telah berusaha untuk mendamaikan #0046# dan #0047#, namun tidak berhasil", data: { asalKorpus: { kemunculan: 19, perkara: 9 } }, urutan: 32 },
    { kunci: "keluarga mendamaikan gagal", nilai: "pihak keluarga sudah berupaya untuk merukunkan #0046# dan #0047#, namun tidak berhasil", data: { asalKorpus: { kemunculan: 51, perkara: 27 } }, urutan: 33 },
    { kunci: "diupayakan rukun kembali", nilai: "#0046# dan #0047# pernah diupayakan untuk rukun kembali, namun tidak berhasil", data: { asalKorpus: { kemunculan: 58, perkara: 32 } }, urutan: 34 },
    { kunci: "diupayakan rukun kembali", nilai: "#0046# dan #0047# sudah pernah diupayakan untuk rukun kembali, namun tidak berhasil", data: { asalKorpus: { kemunculan: 7, perkara: 4 } }, urutan: 35 },
    { kunci: "diupayakan rukun kembali", nilai: "#0046# dan #0047# sudah pernah diupayakan untuk dirukunkan, namun tidak berhasil", data: { asalKorpus: { kemunculan: 18, perkara: 13 } }, urutan: 36 },
    { kunci: "diupayakan rukun kembali", nilai: "#0046# dan #0047# sudah pernah diupayakan untuk dirukunkan namun tidak berhasil", data: { asalKorpus: { kemunculan: 63, perkara: 50 } }, urutan: 37 },
    { kunci: "tahu hubungan suami istri", nilai: "antara #0046# dan #0047# adalah suami istri yang sah", data: { asalKorpus: { kemunculan: 426, perkara: 199 } }, urutan: 38 },
    { kunci: "tahu hubungan suami istri", nilai: "#0046# dan #0047# adalah suami istri yang sah", data: { asalKorpus: { kemunculan: 6, perkara: 4 } }, urutan: 39 },
    { kunci: "tahu hubungan suami istri", nilai: "saya tahu antara #0046# dan #0047# adalah pasangan suami isteri yang sah", data: { asalKorpus: { kemunculan: 3, perkara: 3 } }, urutan: 40 },
    { kunci: "anak dikaruniai", nilai: "#0046# dan #0047# sudah dikaruniai {slot}", data: { asalKorpus: { kemunculan: 2246, perkara: 1110 } }, urutan: 41 },
    { kunci: "anak dikaruniai", nilai: "#0046# dan #0047# telah dikaruniai {slot}", data: { asalKorpus: { kemunculan: 531, perkara: 259 } }, urutan: 42 },
    { kunci: "siapa pergi", nilai: "yang meninggalkan tempat tinggal bersama adalah {slot}", data: { asalKorpus: { kemunculan: 2020, perkara: 1091 } }, urutan: 43 },
    { kunci: "siapa pergi", nilai: "yang meninggalkan kediaman bersama adalah {slot}", data: { asalKorpus: { kemunculan: 392, perkara: 192 } }, urutan: 44 },
    { kunci: "siapa pergi", nilai: "yang pergi meninggalkan tempat tinggal bersama adalah {slot}", data: { asalKorpus: { kemunculan: 43, perkara: 24 } }, urutan: 45 },
    { kunci: "siapa pergi", nilai: "{slot} yang pergi meninggalkan tempat tinggal bersama", data: { asalKorpus: { kemunculan: 40, perkara: 39 } }, urutan: 46 },
    { kunci: "tidak ada komunikasi", nilai: "selama pisah antara #0046# dan #0047# sudah tidak ada komunikasi", data: { asalKorpus: { kemunculan: 2491, perkara: 1242 } }, urutan: 47 },
    { kunci: "tidak ada komunikasi", nilai: "selama pisah #0046# dan #0047# tidak ada komunikasi lagi", data: { asalKorpus: { kemunculan: 295, perkara: 135 } }, urutan: 48 },
    { kunci: "tidak ada komunikasi", nilai: "setelah berpisah antara #0046# dan #0047# tidak ada lagi hubungan komunikasi", data: { asalKorpus: { kemunculan: 75, perkara: 38 } }, urutan: 49 },
    { kunci: "tidak ada komunikasi", nilai: "#0046# dan #0047# sudah tidak ada lagi hubungan komunikasi sampai sekarang", data: { asalKorpus: { kemunculan: 10, perkara: 6 } }, urutan: 50 },
    { kunci: "nafkah tidak diberikan", nilai: "#0047# sudah tidak pernah memberikan nafkah kepada #0046#", data: { asalKorpus: { kemunculan: 1943, perkara: 993 } }, urutan: 51 },
    { kunci: "nafkah tidak diberikan", nilai: "#0047# tidak pernah memberikan nafkah kepada #0046#", data: { asalKorpus: { kemunculan: 5, perkara: 4 } }, urutan: 52 },
    { kunci: "puncak terjadi pada", nilai: "puncak perselisihan dan pertengkaran antara #0046# dan #0047# terjadi pada {slot}", data: { asalKorpus: { kemunculan: 1598, perkara: 843 } }, urutan: 53 },
    { kunci: "puncak terjadi pada", nilai: "puncak perselisihan dan pertengkaran #0046# dan #0047# terjadi pada {slot}", data: { asalKorpus: { kemunculan: 22, perkara: 11 } }, urutan: 54 },
  ],
  "bas.saksi.profil": [
    { kunci: "kenal", nilai: "", data: { peluangRagam: 1, rumusan: false }, urutan: 0 },
    { kunci: "tempat tinggal", nilai: "", data: { peluangRagam: 1, rumusan: false }, urutan: 1 },
    { kunci: "kehidupan", nilai: "", data: { peluangRagam: 1, rumusan: false }, urutan: 2 },
    { kunci: "penyebab", nilai: "", data: { peluangRagam: 1, rumusan: false }, urutan: 3 },
    { kunci: "cara tahu", nilai: "", data: { peluangRagam: 1, rumusan: false }, urutan: 4 },
    { kunci: "menyaksikan", nilai: "", data: { peluangRagam: 1, rumusan: false }, urutan: 5 },
    { kunci: "pisah", nilai: "", data: { peluangRagam: 1, rumusan: false }, urutan: 6 },
    { kunci: "upaya damai", nilai: "", data: { peluangRagam: 1, rumusan: false }, urutan: 7 },
    { kunci: "penutup", nilai: "", data: { peluangRagam: 1, rumusan: true }, urutan: 8 },
    { kunci: "keberatan", nilai: "", data: { peluangRagam: 1, rumusan: true }, urutan: 9 },
    { kunci: "komunikasi", nilai: "", data: { peluangRagam: 1, rumusan: true }, urutan: 10 },
    { kunci: "nafkah", nilai: "", data: { peluangRagam: 1, rumusan: true }, urutan: 11 },
    { kunci: "kenapa cerai", nilai: "", data: { peluangRagam: 1, rumusan: true }, urutan: 12 },
    { kunci: "maksud", nilai: "", data: { peluangRagam: 1, rumusan: true }, urutan: 13 },
    { kunci: "sanggup", nilai: "", data: { peluangRagam: 1, rumusan: false }, urutan: 14 },
    { kunci: "hubungan pihak", nilai: "", data: { peluangRagam: 1, rumusan: false }, urutan: 15 },
    { kunci: "siapa pergi", nilai: "", data: { peluangRagam: 1, rumusan: false }, urutan: 16 },
    { kunci: "anak", nilai: "", data: { peluangRagam: 1, rumusan: false }, urutan: 17 },
    { kunci: "awal perselisihan", nilai: "", data: { peluangRagam: 1, rumusan: false }, urutan: 18 },
    { kunci: "lain", nilai: "", data: { peluangRagam: 1, rumusan: false }, urutan: 19 },
  ],
} satisfies Cermin;

/**
 * Cabang kode di balik tiap kunci jawaban-modus: kelompok pertanyaannya dan
 * SEMUA modus yang jatuh ke bank itu (diurutkan menurut urutan pemeriksaannya
 * di jawabMenurutModus). Hanya kunci yang tercantum di sini yang boleh diberi
 * tambahan - kombinasi tanpa cabang kode tidak pernah dibaca bot.
 *
 * Butir 27 (5 Oktober 2026): 'tahu-pisah' dan 'tidak-tahu' kini punya bank
 * cara-tahu sendiri; 'waktu|...' (kapan mulai / puncak perselisihan) dan
 * 'kehidupan|...' (keadaan rumah tangga) melayani modus yang TIDAK
 * menyaksikan. Penanda {jawab} = jawaban templat yang sudah diisi dari gugatan.
 */
export const CABANG_JAWABAN_MODUS = {
  "cara-tahu|dari-cerita": { kelompok: "cara-tahu", modus: ["dari-cerita"] },
  "cara-tahu|tidak-melihat": { kelompok: "cara-tahu", modus: ["tidak-melihat"] },
  "cara-tahu|sama": { kelompok: "cara-tahu", modus: ["sama", "sebagian"] },
  "cara-tahu|tidak-tahu": { kelompok: "cara-tahu", modus: ["tidak-tahu"] },
  "cara-tahu|tahu-pisah": { kelompok: "cara-tahu", modus: ["tahu-pisah"] },
  "waktu|tidak-melihat": { kelompok: "waktu", modus: ["tidak-melihat"] },
  "waktu|dari-cerita": { kelompok: "waktu", modus: ["dari-cerita"] },
  "waktu|tahu-pisah": { kelompok: "waktu", modus: ["tahu-pisah"] },
  "kehidupan|tidak-melihat": { kelompok: "kehidupan", modus: ["tidak-melihat"] },
  "kehidupan|dari-cerita": { kelompok: "kehidupan", modus: ["dari-cerita"] },
  "kehidupan|tahu-pisah": { kelompok: "kehidupan", modus: ["tahu-pisah"] },
  "penyebab|tahu-pisah": { kelompok: "penyebab", modus: ["tahu-pisah"] },
  "menyaksikan|tahu-pisah": { kelompok: "menyaksikan", modus: ["tahu-pisah"] },
  "rukun|tahu-pisah": { kelompok: "rukun", modus: ["tahu-pisah"] },
  "penyebab|tidak-tahu": { kelompok: "penyebab", modus: ["tidak-tahu", "tidak-melihat"] },
  "penyebab|dari-cerita": { kelompok: "penyebab", modus: ["dari-cerita"] },
  "penyebab|sebagian": { kelompok: "penyebab", modus: ["sebagian"] },
  "penyebab|sama": { kelompok: "penyebab", modus: ["sama"] },
  "menyaksikan|tidak-melihat": { kelompok: "menyaksikan", modus: ["tidak-melihat", "dari-cerita"] },
  "menyaksikan|tidak-tahu": { kelompok: "menyaksikan", modus: ["tidak-tahu"] },
} as const satisfies Record<string, { kelompok: string; modus: readonly string[] }>;
