import type { Cermin } from "@/lib/tipe-keluaran/kontrak";

/**
 * ============================================================================
 * CERMIN BAWAAN KETERANGAN SAKSI (K10) - disalin PERSIS dari bot
 * ============================================================================
 *
 * Sumber: aleta_bot/services/ragamBasBawaan.js (data murni, tanpa require)
 *   PEMBUKA (4, profil manusia)      -> bas.saksi.pembuka
 *   RAGAM_KATA (17 pasangan)         -> bas.saksi.ragam-kata
 *   JAWABAN_MODUS (12 bank, 39)      -> bas.saksi.jawaban-modus
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
    { kunci: "menyaksikan|tahu-pisah", nilai: "saya belum pernah menyaksikan atau mendengar pertengkaran mereka", urutan: 15 },
    { kunci: "menyaksikan|tahu-pisah", nilai: "saya tidak pernah melihat maupun mendengar mereka bertengkar", urutan: 16 },
    { kunci: "menyaksikan|tahu-pisah", nilai: "tidak pernah sekalipun saya melihat atau mendengar mereka bertengkar", urutan: 17 },
    { kunci: "rukun|tahu-pisah", nilai: "saya tidak mengetahui pokok persoalannya, sehingga saya tidak sanggup mendamaikan", urutan: 18 },
    { kunci: "rukun|tahu-pisah", nilai: "karena saya tidak mengetahui persoalannya, saya tidak dapat mendamaikan mereka", urutan: 19 },
    { kunci: "rukun|tahu-pisah", nilai: "saya tidak sanggup mendamaikan sebab persoalan mereka tidak saya ketahui", urutan: 20 },
    { kunci: "penyebab|tidak-tahu", nilai: "saya tidak tahu persis penyebabnya, saya hanya mengetahui mereka sering berselisih dan kini sudah pisah rumah", urutan: 21 },
    { kunci: "penyebab|tidak-tahu", nilai: "saya tidak mengetahui apa penyebabnya, yang saya tahu mereka sudah tidak rukun dan sudah berpisah", urutan: 22 },
    { kunci: "penyebab|tidak-tahu", nilai: "penyebabnya tidak saya ketahui, yang saya lihat mereka memang sering berselisih dan sekarang sudah berpisah", urutan: 23 },
    { kunci: "penyebab|dari-cerita", nilai: "yang saya ketahui dari cerita {sumber}, penyebabnya yaitu {isi}", urutan: 24 },
    { kunci: "penyebab|dari-cerita", nilai: "menurut cerita {sumber} kepada saya, penyebabnya adalah {isi}", urutan: 25 },
    { kunci: "penyebab|dari-cerita", nilai: "{sumber} menceritakan kepada saya bahwa penyebabnya {isi}", urutan: 26 },
    { kunci: "penyebab|sebagian", nilai: "sepengetahuan saya penyebabnya adalah {daftar}, penyebab lainnya saya tidak mengetahui", urutan: 27 },
    { kunci: "penyebab|sebagian", nilai: "yang saya ketahui sendiri hanya {daftar}, selebihnya saya tidak tahu", urutan: 28 },
    { kunci: "penyebab|sebagian", nilai: "sebatas yang saya ketahui penyebabnya {daftar}, selain itu saya tidak dapat menerangkan", urutan: 29 },
    { kunci: "penyebab|sama", nilai: "penyebab perselisihan dan pertengkaran mereka yang saya ketahui yaitu {daftar}", urutan: 30 },
    { kunci: "penyebab|sama", nilai: "penyebabnya sepengetahuan saya adalah {daftar}", urutan: 31 },
    { kunci: "penyebab|sama", nilai: "sepanjang yang saya ketahui, mereka berselisih karena {daftar}", urutan: 32 },
    { kunci: "menyaksikan|tidak-melihat", nilai: "saya tidak pernah menyaksikan langsung pertengkaran mereka", urutan: 33 },
    { kunci: "menyaksikan|tidak-melihat", nilai: "saya tidak pernah melihat sendiri mereka bertengkar, saya mengetahuinya dari cerita", urutan: 34 },
    { kunci: "menyaksikan|tidak-melihat", nilai: "pertengkaran itu tidak pernah saya saksikan sendiri, hanya saya dengar dari cerita", urutan: 35 },
    { kunci: "menyaksikan|tidak-tahu", nilai: "saya pernah melihat mereka bertengkar beberapa kali, namun tidak tahu sebabnya", urutan: 36 },
    { kunci: "menyaksikan|tidak-tahu", nilai: "saya pernah mendengar mereka bertengkar, tetapi tidak tahu apa yang dipersoalkan", urutan: 37 },
    { kunci: "menyaksikan|tidak-tahu", nilai: "beberapa kali saya melihat mereka bertengkar, tetapi persoalannya tidak saya ketahui", urutan: 38 },
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
    { kunci: "penutup", nilai: "", data: { peluangRagam: 0, rumusan: true }, urutan: 8 },
    { kunci: "keberatan", nilai: "", data: { peluangRagam: 0.05, rumusan: true }, urutan: 9 },
    { kunci: "komunikasi", nilai: "", data: { peluangRagam: 0.07, rumusan: true }, urutan: 10 },
    { kunci: "nafkah", nilai: "", data: { peluangRagam: 0.08, rumusan: true }, urutan: 11 },
    { kunci: "kenapa cerai", nilai: "", data: { peluangRagam: 0.09, rumusan: true }, urutan: 12 },
    { kunci: "maksud", nilai: "", data: { peluangRagam: 0.12, rumusan: true }, urutan: 13 },
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
 * Catatan cabang 'cara-tahu|sama': modus 'tahu-pisah' pun jatuh ke sini, sebab
 * pertanyaan "bagaimana mengetahui" diperiksa SEBELUM cabang tahu-pisah.
 */
export const CABANG_JAWABAN_MODUS = {
  "cara-tahu|dari-cerita": { kelompok: "cara-tahu", modus: ["dari-cerita"] },
  "cara-tahu|tidak-melihat": { kelompok: "cara-tahu", modus: ["tidak-melihat"] },
  "cara-tahu|sama": { kelompok: "cara-tahu", modus: ["sama", "sebagian", "tahu-pisah"] },
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
