"use strict";

/**
 * ============================================================================
 * DATA RAGAM KETERANGAN SAKSI (BAS) - DATA MURNI, TANPA require
 * ============================================================================
 *
 * Seluruh bunyi yang dipakai abtUsulanService untuk menyusun keterangan saksi
 * "sama dengan gugatan" tinggal di sini, terpisah dari kodenya. Sebabnya dua:
 *
 *   1. Portal mencerminkannya (manajemen_surat/src/lib/tipe-keluaran/bawaan/
 *      bawaan-bas-saksi.ts) dan mengujinya dengan me-require berkas INI.
 *      Berkas tanpa require dapat dimuat di mana saja tanpa kolam MySQL.
 *   2. Pengaturan tipe keluaran (K2 nomor 1-5) menumpuk tambahan di atas
 *      bawaan ini. Bawaan dibaca dari sini; tambahan datang dari portal.
 *
 * Tidak ada regex di berkas ini. RAGAM_KATA memuat kata polos; pola \b..\b
 * dibangun oleh kode pemakainya.
 *
 * Asal angka di berkas ini: korpus jawaban saksi MANUSIA aps_badilag PA
 * Donggala (65.852 jawaban, tanpa baris yang diinput ALETA sejak 11 September
 * 2026). Skrip ukurnya di D:/aleta-dev/kerja/enam-butir/t2-ragam-bas-bot/.
 */

/**
 * Pembuka jawaban - HANYA yang dipakai manusia, dengan bobot = persen
 * pemakaiannya di korpus: 'Ya,' 8,1%, 'Setahu saya,' 0,9%, 'Sepengetahuan
 * saya,' 0,4%, 'Yang saya ketahui,' 0,2%. Selebihnya (sekitar 90%) tanpa
 * pembuka.
 *
 * Delapan pembuka lama DIBUANG karena 0 kali dipakai manusia (0 dari 65.858):
 * 'Benar,', 'Betul,', 'Sepanjang saya tahu,', 'Yang saya alami,', 'Seingat
 * saya,', 'Sejauh yang saya tahu,', 'Menurut yang saya lihat,', dan 'Iya,'.
 * 'Iya,' paling berbahaya: ABT menyalin jawaban ke putusan lewat
 * replace_ket_saksi yang membuang 'ya, ', sehingga 'Iya, penyebabnya...'
 * tercetak 'Bahwa ipenyebabnya...' (34 kali pada ukuran 25 September 2026).
 */
const PEMBUKA = [
  { nilai: "Ya, ", bobot: 8.1 },
  { nilai: "Setahu saya, ", bobot: 0.9 },
  { nilai: "Sepengetahuan saya, ", bobot: 0.4 },
  { nilai: "Yang saya ketahui, ", bobot: 0.2 },
];

/**
 * Kata pertama jawaban yang boleh dikecilkan ketika pembuka dipasang di
 * depannya. Kata lain (nama orang, sebutan pihak, singkatan) tidak pernah
 * dikecilkan - jawaban itu tidak diberi pembuka sama sekali. Daftarnya kata
 * pertama jawaban templat ABT (aps_badilag.abt_tanyajawab_template) yang
 * bukan sebutan, nama, maupun variabel.
 */
const AWAL_BOLEH_DIKECILKAN = [
  "saya", "yang", "anak", "sudah", "setelah", "antara", "sebelum", "para", "selama", "mahar",
  "calon", "pada", "dari", "keluarga", "perselisihan", "pertengkaran", "penyebab", "penyebabnya",
  "puncak", "maksud", "perubahan", "sejak", "telah", "karena", "kalau", "kehidupan", "semasa",
  "hubungan", "pihak", "mereka", "keduanya", "awalnya", "hal", "beberapa",
];

/**
 * Pasangan kata yang boleh saling mengganti tanpa mengubah makna hukumnya.
 *
 * Dipakai hanya sebagai CADANGAN: bila jawaban tidak cocok dengan satu pun
 * kelompok BENTUK, bentuk-bentuknya dibangun dengan mengganti kata di sini.
 *
 * Sepuluh pasangan lama DIBUANG karena menabrak kata di sekitarnya atau
 * mengubah isi kesaksian (terukur atas 27 templat ABT):
 *   pertengkaran>perselisihan  'perselisihan dan perselisihan' (21 kali)
 *   berselisih>bertengkar      'bertengkar dan bertengkar'
 *   rumah tangga>kehidupan ... 'kehidupan kehidupan rumah tangga'
 *   keluarga>pihak keluarga    'pihak pihak keluarga' (8 kali)
 *   meninggalkan>pergi ...     'pergi pergi meninggalkan'
 *   tetangga>warga sekitar     mengubah HUBUNGAN saksi, yang tidak boleh disentuh
 *   tidak pernah>tak pernah    'telah tak pernah'; negasi harus tetap
 *   kurang lebih>sekitar       'sekitar beberapa kali'
 *   sejak>terhitung sejak      'terhitung terhitung sejak' bila berulang
 *   terakhir kali>penghabisan  tidak dipakai manusia
 */
const RAGAM_KATA = [
  { kata: "karena", ganti: "sebab" },
  { kata: "sudah", ganti: "telah" },
  { kata: "sering", ganti: "kerap" },
  { kata: "saya mengetahui", ganti: "saya tahu", abaikanBesarKecil: true },
  { kata: "saya melihat", ganti: "saya menyaksikan", abaikanBesarKecil: true },
  { kata: "bertempat tinggal", ganti: "berdiam" },
  { kata: "saat ini", ganti: "sekarang ini" },
  { kata: "sampai sekarang", ganti: "hingga kini" },
  { kata: "kemudian", ganti: "lalu" },
  { kata: "namun", ganti: "tetapi" },
  { kata: "sehingga", ganti: "hingga" },
  { kata: "pisah rumah", ganti: "tinggal terpisah" },
  { kata: "mendamaikan", ganti: "merukunkan" },
  { kata: "benar", ganti: "betul", abaikanBesarKecil: true },
  // Tiga pasangan baru 25 September 2026 - keduanya dipakai manusia (kenal
  // dengan / mengenal: 2.775 dan 246 jawaban "karena saya adalah"; sudah /
  // telah: 2.246 dan 531 jawaban "dikaruniai"). Tanpa ini jawaban "Ya, saya
  // mengenal Pemohon sejak kecil" tidak punya bentuk kedua sama sekali.
  { kata: "saya mengenal", ganti: "saya kenal dengan", abaikanBesarKecil: true },
  { kata: "saya kenal dengan", ganti: "saya mengenal", abaikanBesarKecil: true },
  { kata: "telah", ganti: "sudah" },
  // Butir 27 (5 Oktober 2026, permintaan pengguna): dua saksi bermodus sama
  // tidak boleh berbunyi kata demi kata sama. Jawaban berikut tidak punya
  // bentuk kedua di korpus manusia (Sudah cukup 4.140 dari 4.155; Saya tidak
  // sanggup lagi 424 dari 435) - pasangan ini menjadi bentuk keduanya, tanpa
  // mengubah kata modal/negasi (periksaInvarian).
  { kata: "sudah cukup", ganti: "cukup sekian", abaikanBesarKecil: true },
  { kata: "saya tidak sanggup lagi", ganti: "saya sudah tidak sanggup lagi", abaikanBesarKecil: true },
  { kata: "perselisihan dan pertengkaran", ganti: "pertengkaran dan perselisihan", abaikanBesarKecil: true },
  { kata: "menghadap di persidangan ini", ganti: "hadir di persidangan ini" },
  // Templat A2/A3 (rumusan nikah dan keadaan rumah tangga) yang tidak punya
  // bentuk kedua sama sekali. Kata modal/negasi, sebutan, dan angka tidak
  // disentuh; yang berubah hanya cara mengatakannya.
  { kata: "berselisih dan bertengkar", ganti: "bertengkar dan berselisih" },
  { kata: "yang saya tahu yaitu", ganti: "yang saya ketahui adalah" },
  { kata: "tidak ada hubungan darah", ganti: "tidak memiliki hubungan darah" },
  { kata: "sebelum menikah", ganti: "sebelum pernikahan", abaikanBesarKecil: true },
  { kata: "tetap rukun dan bahagia", ganti: "masih rukun dan bahagia" },
  { kata: "saya tahu kalau", ganti: "saya mengetahui bahwa", abaikanBesarKecil: true },
  { kata: "pernah juga", ganti: "juga pernah" },
  { kata: "ada pihak lain", ganti: "adanya pihak lain" },
  { kata: "yang bertindak sebagai", ganti: "yang menjadi", abaikanBesarKecil: true },
  { kata: "berupa", ganti: "yaitu" },
  { kata: "sewaktu", ganti: "pada saat" },
  { kata: "sedangkan", ganti: "dan" },
  { kata: "menikah di", ganti: "melangsungkan pernikahan di" },
];

/**
 * Kalimat jawaban per modus saksi, berkunci 'kelompok|modus'.
 *
 * Penanda: {sumber} = siapa yang bercerita, {daftar} = alasan yang diketahui
 * saksi, {isi} = alasan atau "perselisihan yang terus-menerus" bila kosong.
 * Satu kunci = satu cabang kode di jawabMenurutModus.
 */
const JAWABAN_MODUS = {
  "cara-tahu|dari-cerita": [
    "saya mengetahui karena diceritakan oleh {sumber}",
    "saya mengetahuinya karena {sumber} bercerita kepada saya",
    "{sumber} sendiri yang menceritakan hal itu kepada saya",
    "saya tahu dari penuturan {sumber} langsung",
  ],
  "cara-tahu|tidak-melihat": [
    "saya mengetahui dari cerita keluarga dan tetangga",
    "saya mengetahuinya dari cerita orang-orang di sekitar mereka",
    "hal itu saya dengar dari pembicaraan keluarga mereka",
    "saya tahu dari orang-orang yang tinggal berdekatan dengan mereka",
  ],
  "cara-tahu|sama": [
    "saya mengetahui karena saya melihat sendiri",
    "saya mengetahuinya karena melihat dan mendengar sendiri",
    "saya menyaksikannya sendiri di rumah mereka",
    "saya mengetahuinya karena saya sendiri yang menyaksikan",
  ],
  "penyebab|tahu-pisah": [
    "saya tidak pernah mengetahui mereka bertengkar, yang saya tahu keduanya sekarang sudah berpisah rumah",
    "saya tidak mengetahui adanya pertengkaran di antara mereka, yang saya ketahui hanya mereka sudah tidak tinggal serumah",
    "perselisihan mereka tidak saya ketahui, yang saya tahu hanya keduanya kini tinggal terpisah",
    "tentang pertengkaran mereka saya tidak tahu apa-apa, yang saya ketahui keduanya sudah tidak serumah",
  ],
  "menyaksikan|tahu-pisah": [
    "saya belum pernah menyaksikan atau mendengar pertengkaran mereka",
    "saya tidak pernah melihat maupun mendengar mereka bertengkar",
    "tidak pernah sekalipun saya melihat atau mendengar mereka bertengkar",
    "saya sama sekali tidak pernah melihat ataupun mendengar mereka bertengkar",
  ],
  "rukun|tahu-pisah": [
    "saya tidak mengetahui pokok persoalannya, sehingga saya tidak sanggup mendamaikan",
    "karena saya tidak mengetahui persoalannya, saya tidak dapat mendamaikan mereka",
    "saya tidak sanggup mendamaikan sebab persoalan mereka tidak saya ketahui",
    "persoalan mereka tidak saya ketahui, maka saya tidak sanggup merukunkan keduanya",
  ],
  "penyebab|tidak-tahu": [
    "saya tidak tahu persis penyebabnya, saya hanya mengetahui mereka sering berselisih dan kini sudah pisah rumah",
    "saya tidak mengetahui apa penyebabnya, yang saya tahu mereka sudah tidak rukun dan sudah berpisah",
    "penyebabnya tidak saya ketahui, yang saya lihat mereka memang sering berselisih dan sekarang sudah berpisah",
    "apa yang menjadi penyebab perselisihan mereka tidak saya ketahui, saya hanya tahu mereka sering bertengkar dan kini sudah berpisah",
  ],
  "penyebab|dari-cerita": [
    "yang saya ketahui dari cerita {sumber}, penyebabnya yaitu {isi}",
    "menurut cerita {sumber} kepada saya, penyebabnya adalah {isi}",
    "{sumber} menceritakan kepada saya bahwa penyebabnya {isi}",
    "saya mendengar dari {sumber} sendiri bahwa yang menjadi penyebab adalah {isi}",
  ],
  "penyebab|sebagian": [
    "sepengetahuan saya penyebabnya adalah {daftar}, penyebab lainnya saya tidak mengetahui",
    "yang saya ketahui sendiri hanya {daftar}, selebihnya saya tidak tahu",
    "sebatas yang saya ketahui penyebabnya {daftar}, selain itu saya tidak dapat menerangkan",
    "setahu saya yang menjadi penyebab adalah {daftar}, penyebab lain saya tidak tahu",
  ],
  "penyebab|sama": [
    "penyebab perselisihan dan pertengkaran mereka yang saya ketahui yaitu {daftar}",
    "penyebabnya sepengetahuan saya adalah {daftar}",
    "sepanjang yang saya ketahui, mereka berselisih karena {daftar}",
    "yang menjadi penyebab perselisihan mereka sepengetahuan saya adalah {daftar}",
  ],
  "menyaksikan|tidak-melihat": [
    "saya tidak pernah menyaksikan langsung pertengkaran mereka",
    "saya tidak pernah melihat sendiri mereka bertengkar, saya mengetahuinya dari cerita",
    "pertengkaran itu tidak pernah saya saksikan sendiri, hanya saya dengar dari cerita",
    "saya tidak pernah melihat sendiri mereka bertengkar, saya hanya mendengar dari cerita orang",
  ],
  "menyaksikan|tidak-tahu": [
    "saya pernah melihat mereka bertengkar beberapa kali, namun tidak tahu sebabnya",
    "saya pernah mendengar mereka bertengkar, tetapi tidak tahu apa yang dipersoalkan",
    "beberapa kali saya melihat mereka bertengkar, tetapi persoalannya tidak saya ketahui",
    "saya beberapa kali menyaksikan mereka bertengkar, hanya saja apa yang diributkan tidak saya ketahui",
  ],

  /* ==========================================================================
   * BUTIR 27 (5 Oktober 2026) - TIAP MODUS MENJAWAB TIAP PERTANYAAN POKOK
   * ==========================================================================
   *
   * Sampai butir 27 modus hanya menjawab penyebab, cara tahu, dan berapa kali
   * menyaksikan. Pertanyaan lain jatuh ke templat, yang ditulis untuk saksi
   * yang MELIHAT sendiri - sehingga saksi "tidak tahu pertengkarannya, hanya
   * tahu sudah pisah" menjawab "perselisihan ... terjadi sejak ...", "sering
   * terjadi perselisihan", dan "saya mengetahui karena saya melihat sendiri"
   * (10,9% jawabannya bertentangan dengan modusnya sendiri).
   *
   *   waktu      "Kapan mulai terjadi perselisihan ..." dan "puncak ..."
   *   kehidupan  "Bagaimana kehidupan/keadaan rumah tangga ..."
   *
   * {jawab} = jawaban templat yang SUDAH diisi dari gugatan (tanggal dan
   * fakta lain tetap datang dari posita, tidak dikarang di sini); bila
   * faktanya tidak ada, ia tetap bertitik-titik dan ditandai perlu diisi.
   * Tiap bank berisi >= 4 bentuk supaya empat saksi bermodus sama tetap
   * berbeda kalimatnya. Tidak ada kalimat yang berakhiran "nya," - ABT
   * membuang "ya, " (replace_ket_saksi).
   */
  "waktu|tidak-melihat": [
    "saya tidak menyaksikannya sendiri, tetapi dari cerita yang saya dengar {jawab}",
    "saya tidak pernah melihat sendiri pertengkaran mereka, namun dari cerita orang-orang di sekitar mereka {jawab}",
    "hal itu tidak saya saksikan sendiri, yang saya dengar dari keluarga mereka {jawab}",
    "saya hanya mendengar dari cerita orang lain bahwa {jawab}",
  ],
  "waktu|dari-cerita": [
    "menurut cerita {sumber} kepada saya, {jawab}",
    "{sumber} menceritakan kepada saya bahwa {jawab}",
    "yang saya ketahui dari cerita {sumber}, {jawab}",
    "sebagaimana diceritakan {sumber} kepada saya, {jawab}",
  ],
  "waktu|tahu-pisah": [
    "saya tidak mengetahui kapan mereka mulai berselisih, yang saya tahu keduanya sekarang sudah berpisah tempat tinggal",
    "saya tidak pernah mengetahui adanya pertengkaran di antara mereka, sehingga kapan mulainya tidak saya ketahui",
    "kapan perselisihan itu terjadi tidak saya ketahui, yang saya ketahui hanya mereka kini tinggal terpisah",
    "saya tidak tahu sejak kapan mereka berselisih, yang saya lihat keduanya sudah tidak tinggal serumah lagi",
  ],
  "kehidupan|tidak-melihat": [
    "dari cerita yang saya dengar, {jawab}",
    "saya tidak melihatnya sendiri, tetapi dari cerita orang-orang di sekitar mereka {jawab}",
    "yang saya dengar dari keluarga dan tetangga mereka, {jawab}",
    "sepanjang yang saya dengar dari cerita orang lain, {jawab}",
  ],
  "kehidupan|dari-cerita": [
    "menurut cerita {sumber} kepada saya, {jawab}",
    "{sumber} bercerita kepada saya bahwa {jawab}",
    "dari penuturan {sumber} kepada saya, {jawab}",
    "yang saya ketahui dari cerita {sumber}, {jawab}",
  ],
  "kehidupan|tahu-pisah": [
    "yang saya ketahui sekarang mereka sudah tidak tinggal serumah lagi, sedangkan pertengkaran di antara mereka tidak saya ketahui",
    "saya hanya mengetahui keduanya kini sudah berpisah tempat tinggal, tentang perselisihan mereka saya tidak tahu",
    "rumah tangga mereka sekarang tidak lagi utuh karena keduanya tinggal terpisah, namun saya tidak mengetahui adanya pertengkaran",
    "sepengetahuan saya mereka sudah tidak tinggal bersama lagi, selebihnya tentang keadaan rumah tangga mereka saya tidak mengetahui",
  ],
  "cara-tahu|tidak-tahu": [
    "soal penyebab itu saya tidak tahu, yang saya ketahui hanya pertengkaran mereka karena saya pernah melihat dan mendengarnya",
    "saya tidak mengetahui apa penyebab pertengkaran mereka, saya hanya tahu mereka bertengkar karena pernah mendengar sendiri",
    "penyebab perselisihan itu tidak saya ketahui, yang saya ketahui sebatas pertengkaran yang pernah saya saksikan",
    "saya tidak dapat menerangkan apa penyebab perselisihan mereka, saya hanya pernah melihat mereka bertengkar",
  ],
  "cara-tahu|tahu-pisah": [
    "saya tidak mengetahui adanya perselisihan di antara mereka, yang saya ketahui hanya keduanya sudah tidak lagi tinggal serumah",
    "saya tidak tahu tentang perselisihan mereka, yang saya ketahui hanya keduanya kini sudah tinggal terpisah",
    "perselisihan mereka tidak pernah saya ketahui, saya hanya tahu bahwa mereka sudah tidak serumah lagi",
    "saya tidak mengetahui penyebab maupun pertengkaran mereka, yang saya tahu sebatas keduanya sudah berpisah tempat tinggal",
  ],
};

/**
 * ============================================================================
 * BENTUK JAWABAN PER KELOMPOK - DITAMBANG DARI KORPUS, BUKAN DIKARANG
 * ============================================================================
 *
 * Satu kunci = satu kelompok bentuk yang SETARA maknanya. Jawaban templat
 * yang cocok dengan salah satu bentuk (sesudah sebutan diganti #0046#/#0047#)
 * dapat diucapkan dengan bentuk lain sekunci; {slot} membawa isinya apa
 * adanya (hubungan saksi, tempat, tanggal, lama), menurut urutannya.
 *
 * Setiap bentuk punya bukti: dipakai manusia >= 3 kali di >= 3 perkara
 * (asalKorpus). Kemunculan dihitung pada jawaban utuh atau klausa pembuka
 * jawaban, dan satu jawaban hanya dihitung untuk bentuk PALING KHUSUS yang
 * cocok dengannya. Calon yang gugur bukti atau MENGUBAH kata modal/negasi
 * dari bentuk dasarnya (mis. menyisipkan 'pernah') tidak dimasukkan.
 *
 * Hanya lima tata ragam: pindah keterangan waktu, jawaban-gema, sisip/buang
 * unsur opsional, sinonim terukur, singkat/luas objek. Kelas makna
 * sejak/sekitar, sering/pernah, melihat/mendengar/cerita TIDAK dipakai.
 * Tidak ada bentuk bergender, jadi tidak ada data.syarat.
 *
 * Skrip: t2-ragam-bas-bot/tambang-bentuk.cjs atas calon-bentuk.json.
 */
const BENTUK = [
  // kenal hubungan (kenal)
  { kunci: "kenal hubungan", nilai: "saya kenal dengan {slot} karena saya adalah {slot}", data: { asalKorpus: { kemunculan: 2775, perkara: 1407 } } }, // dasar templat
  { kunci: "kenal hubungan", nilai: "saya mengenal {slot} karena saya adalah {slot}", data: { asalKorpus: { kemunculan: 246, perkara: 130 } } }, // sinonim terukur kenal/mengenal
  { kunci: "kenal hubungan", nilai: "saya kenal {slot} karena saya adalah {slot}", data: { asalKorpus: { kemunculan: 5, perkara: 4 } } }, // buang unsur opsional 'dengan'
  { kunci: "kenal hubungan", nilai: "saya kenal dengan {slot}, karena saya adalah {slot}", data: { asalKorpus: { kemunculan: 7, perkara: 6 } } }, // tanda baca
  { kunci: "kenal hubungan", nilai: "saya kenal dengan {slot} karena saya {slot}", data: { asalKorpus: { kemunculan: 214, perkara: 146 } } }, // buang unsur opsional 'adalah'
  { kunci: "kenal hubungan", nilai: "saya mengenal {slot} karena saya {slot}", data: { asalKorpus: { kemunculan: 33, perkara: 22 } } }, // sinonim + buang 'adalah'
  { kunci: "kenal hubungan", nilai: "saya kenal dengan {slot}, saya adalah {slot}", data: { asalKorpus: { kemunculan: 4, perkara: 4 } } }, // buang penghubung
  // kenal sebagai (kenal)
  { kunci: "kenal sebagai", nilai: "saya kenal dengan #0047# sebagai {slot}", data: { asalKorpus: { kemunculan: 2594, perkara: 1356 } } }, // dasar templat
  { kunci: "kenal sebagai", nilai: "saya kenal #0047# sebagai {slot}", data: { asalKorpus: { kemunculan: 26, perkara: 24 } } }, // buang unsur opsional 'dengan'
  { kunci: "kenal sebagai", nilai: "saya mengenal #0047# sebagai {slot}", data: { asalKorpus: { kemunculan: 6, perkara: 5 } } }, // sinonim terukur kenal/mengenal
  // tinggal setelah menikah (tempat tinggal)
  { kunci: "tinggal setelah menikah", nilai: "setelah menikah #0046# dan #0047# membina rumah tangga di {slot}", data: { asalKorpus: { kemunculan: 229, perkara: 114 } } }, // dasar templat
  { kunci: "tinggal setelah menikah", nilai: "setelah menikah #0046# dan #0047# tinggal bersama di {slot}", data: { asalKorpus: { kemunculan: 2312, perkara: 1231 } } }, // sinonim terukur
  { kunci: "tinggal setelah menikah", nilai: "setelah menikah #0046# dan #0047# bertempat tinggal di {slot}", data: { asalKorpus: { kemunculan: 74, perkara: 39 } } }, // sinonim terukur
  { kunci: "tinggal setelah menikah", nilai: "setelah menikah, #0046# dan #0047# tinggal bersama di {slot}", data: { asalKorpus: { kemunculan: 270, perkara: 136 } } }, // tanda baca
  { kunci: "tinggal setelah menikah", nilai: "#0046# dan #0047# setelah menikah tinggal bersama di {slot}", data: { asalKorpus: { kemunculan: 8, perkara: 7 } } }, // pindah keterangan waktu
  { kunci: "tinggal setelah menikah", nilai: "setelah menikah #0046# dan #0047# tinggal di {slot}", data: { asalKorpus: { kemunculan: 97, perkara: 71 } } }, // buang unsur opsional 'bersama'
  // rumah tangga tidak harmonis (kehidupan)
  { kunci: "rumah tangga tidak harmonis", nilai: "pada awalnya kehidupan rumah tangga #0046# dan #0047# rukun dan harmonis, namun sekarang ini rumah tangga mereka tidak harmonis lagi karena sering terjadi perselisihan dan pertengkaran yang terus menerus", data: { asalKorpus: { kemunculan: 360, perkara: 208 } } }, // dasar templat
  { kunci: "rumah tangga tidak harmonis", nilai: "pada awalnya kehidupan rumah tangga #0046# dan #0047# rukun dan harmonis, namun sekarang ini rumah tangga mereka tidak harmonis lagi karena sering terjadi pertengkaran yang terus menerus", data: { asalKorpus: { kemunculan: 14, perkara: 14 } } }, // singkat objek
  // pernah melihat langsung (menyaksikan)
  { kunci: "pernah melihat langsung", nilai: "saya pernah melihat dan mendengar langsung #0046# dan #0047# bertengkar, sebanyak {slot} kali, di {slot}", data: { asalKorpus: { kemunculan: 139, perkara: 104 } } }, // dasar templat
  { kunci: "pernah melihat langsung", nilai: "saya pernah melihat dan mendengar langsung #0046# dan #0047# bertengkar sebanyak {slot} kali di {slot}", data: { asalKorpus: { kemunculan: 5, perkara: 4 } } }, // tanda baca
  // pisah sejak (pisah)
  { kunci: "pisah sejak", nilai: "#0046# dan #0047# sudah pisah tempat tinggal sejak {slot}", data: { asalKorpus: { kemunculan: 2733, perkara: 1390 } } }, // dasar templat
  { kunci: "pisah sejak", nilai: "#0046# dan #0047# sudah berpisah tempat tinggal sejak {slot}", data: { asalKorpus: { kemunculan: 115, perkara: 61 } } }, // sinonim pisah/berpisah
  { kunci: "pisah sejak", nilai: "#0046# dan #0047# sudah pisah rumah sejak {slot}", data: { asalKorpus: { kemunculan: 3, perkara: 3 } } }, // sinonim tempat tinggal/rumah
  { kunci: "pisah sejak", nilai: "#0046# dan #0047# sudah pisah tempat tinggal sejak {slot} hingga sekarang", data: { asalKorpus: { kemunculan: 6, perkara: 4 } } }, // sisip unsur opsional
  { kunci: "pisah sejak", nilai: "#0046# dan #0047# sudah pisah tempat tinggal sejak {slot} sampai sekarang", data: { asalKorpus: { kemunculan: 5, perkara: 4 } } }, // sisip unsur opsional
  // lama pisah (pisah)
  { kunci: "lama pisah", nilai: "#0046# dan #0047# berpisah tempat tinggal sudah kurang lebih {slot}", data: { asalKorpus: { kemunculan: 325, perkara: 181 } } }, // dasar templat
  { kunci: "lama pisah", nilai: "#0046# dan #0047# sudah pisah tempat tinggal kurang lebih {slot}", data: { asalKorpus: { kemunculan: 17, perkara: 14 } } }, // sinonim pisah/berpisah
  { kunci: "lama pisah", nilai: "#0046# dan #0047# sudah pisah tempat tinggal selama kurang lebih {slot}", data: { asalKorpus: { kemunculan: 3, perkara: 3 } } }, // sisip 'selama'
  { kunci: "lama pisah", nilai: "#0046# dan #0047# berpisah tempat tinggal sudah kurang lebih {slot} lamanya", data: { asalKorpus: { kemunculan: 46, perkara: 27 } } }, // sisip lamanya
  { kunci: "lama pisah", nilai: "#0046# dan #0047# sudah pisah tempat tinggal kurang lebih {slot} lamanya", data: { asalKorpus: { kemunculan: 4, perkara: 4 } } }, // sinonim + sisip lamanya
  // diupayakan rukun oleh (upaya damai)
  { kunci: "diupayakan rukun oleh", nilai: "#0046# dan #0047# sudah pernah diupayakan untuk dirukunkan oleh {slot}, namun tidak berhasil", data: { asalKorpus: { kemunculan: 1757, perkara: 955 } } }, // dasar templat
  { kunci: "diupayakan rukun oleh", nilai: "#0046# dan #0047# sudah pernah diupayakan untuk dirukunkan oleh {slot} namun tidak berhasil", data: { asalKorpus: { kemunculan: 392, perkara: 230 } } }, // tanda baca
  // keluarga mendamaikan gagal (upaya damai)
  { kunci: "keluarga mendamaikan gagal", nilai: "pihak keluarga telah berusaha untuk mendamaikan #0046# dan #0047#, namun tidak berhasil", data: { asalKorpus: { kemunculan: 19, perkara: 9 } } }, // dasar bunyi 1268
  { kunci: "keluarga mendamaikan gagal", nilai: "pihak keluarga sudah berupaya untuk merukunkan #0046# dan #0047#, namun tidak berhasil", data: { asalKorpus: { kemunculan: 51, perkara: 27 } } }, // sinonim berusaha/berupaya
  // diupayakan rukun kembali (upaya damai)
  { kunci: "diupayakan rukun kembali", nilai: "#0046# dan #0047# pernah diupayakan untuk rukun kembali, namun tidak berhasil", data: { asalKorpus: { kemunculan: 58, perkara: 32 } } }, // dasar templat
  { kunci: "diupayakan rukun kembali", nilai: "#0046# dan #0047# sudah pernah diupayakan untuk rukun kembali, namun tidak berhasil", data: { asalKorpus: { kemunculan: 7, perkara: 4 } } }, // sisip 'sudah'
  { kunci: "diupayakan rukun kembali", nilai: "#0046# dan #0047# sudah pernah diupayakan untuk dirukunkan, namun tidak berhasil", data: { asalKorpus: { kemunculan: 18, perkara: 13 } } }, // sinonim
  { kunci: "diupayakan rukun kembali", nilai: "#0046# dan #0047# sudah pernah diupayakan untuk dirukunkan namun tidak berhasil", data: { asalKorpus: { kemunculan: 63, perkara: 50 } } }, // tanda baca
  // tahu hubungan suami istri (hubungan pihak)
  { kunci: "tahu hubungan suami istri", nilai: "antara #0046# dan #0047# adalah suami istri yang sah", data: { asalKorpus: { kemunculan: 426, perkara: 199 } } }, // dasar templat
  { kunci: "tahu hubungan suami istri", nilai: "#0046# dan #0047# adalah suami istri yang sah", data: { asalKorpus: { kemunculan: 6, perkara: 4 } } }, // buang 'antara'
  { kunci: "tahu hubungan suami istri", nilai: "saya tahu antara #0046# dan #0047# adalah pasangan suami isteri yang sah", data: { asalKorpus: { kemunculan: 3, perkara: 3 } } }, // jawaban-gema, sisip pasangan
  // anak dikaruniai (anak)
  { kunci: "anak dikaruniai", nilai: "#0046# dan #0047# sudah dikaruniai {slot}", data: { asalKorpus: { kemunculan: 2246, perkara: 1110 } } }, // dasar
  { kunci: "anak dikaruniai", nilai: "#0046# dan #0047# telah dikaruniai {slot}", data: { asalKorpus: { kemunculan: 531, perkara: 259 } } }, // sinonim sudah/telah
  // Butir 27 (5 Oktober 2026): kelompok yang sampai kini identik antar saksi.
  // Ditambang dengan pola utuh atas korpus yang sama (skrip
  // D:/aleta-dev/kerja/butir24/cari27.js); sebutan pada slot dijumlahkan.
  // siapa pergi (siapa pergi)
  { kunci: "siapa pergi", nilai: "yang meninggalkan tempat tinggal bersama adalah {slot}", data: { asalKorpus: { kemunculan: 2020, perkara: 1091 } } }, // dasar templat A1/A3
  { kunci: "siapa pergi", nilai: "yang meninggalkan kediaman bersama adalah {slot}", data: { asalKorpus: { kemunculan: 392, perkara: 192 } } }, // dasar templat 04
  { kunci: "siapa pergi", nilai: "yang pergi meninggalkan tempat tinggal bersama adalah {slot}", data: { asalKorpus: { kemunculan: 43, perkara: 24 } } }, // sisip 'pergi'
  { kunci: "siapa pergi", nilai: "{slot} yang pergi meninggalkan tempat tinggal bersama", data: { asalKorpus: { kemunculan: 40, perkara: 39 } } }, // jawaban-gema
  // tidak ada komunikasi (komunikasi)
  { kunci: "tidak ada komunikasi", nilai: "selama pisah antara #0046# dan #0047# sudah tidak ada komunikasi", data: { asalKorpus: { kemunculan: 2491, perkara: 1242 } } }, // dasar templat A1/A3
  { kunci: "tidak ada komunikasi", nilai: "selama pisah #0046# dan #0047# tidak ada komunikasi lagi", data: { asalKorpus: { kemunculan: 295, perkara: 135 } } }, // dasar templat 04
  { kunci: "tidak ada komunikasi", nilai: "setelah berpisah antara #0046# dan #0047# tidak ada lagi hubungan komunikasi", data: { asalKorpus: { kemunculan: 75, perkara: 38 } } }, // sinonim terukur
  { kunci: "tidak ada komunikasi", nilai: "#0046# dan #0047# sudah tidak ada lagi hubungan komunikasi sampai sekarang", data: { asalKorpus: { kemunculan: 10, perkara: 6 } } }, // pindah keterangan waktu
  // nafkah tidak diberikan (nafkah)
  { kunci: "nafkah tidak diberikan", nilai: "#0047# sudah tidak pernah memberikan nafkah kepada #0046#", data: { asalKorpus: { kemunculan: 1943, perkara: 993 } } }, // dasar templat
  { kunci: "nafkah tidak diberikan", nilai: "#0047# tidak pernah memberikan nafkah kepada #0046#", data: { asalKorpus: { kemunculan: 5, perkara: 4 } } }, // buang 'sudah'
  // puncak terjadi pada (awal perselisihan)
  { kunci: "puncak terjadi pada", nilai: "puncak perselisihan dan pertengkaran antara #0046# dan #0047# terjadi pada {slot}", data: { asalKorpus: { kemunculan: 1598, perkara: 843 } } }, // dasar templat
  { kunci: "puncak terjadi pada", nilai: "puncak perselisihan dan pertengkaran #0046# dan #0047# terjadi pada {slot}", data: { asalKorpus: { kemunculan: 22, perkara: 11 } } }, // buang 'antara'
];

/**
 * ============================================================================
 * PROFIL RAGAM PER KELOMPOK PERTANYAAN
 * ============================================================================
 *
 * peluangRagam = peluang pertanyaan itu diberi bentuk berbeda antar saksi.
 *
 *   pokok    1 (keputusan pengguna 1): kenal, tempat tinggal, kehidupan
 *            rumah tangga, penyebab, cara tahu, menyaksikan, pisah, upaya
 *            damai - SELALU berbeda selama bentuknya cukup.
 *   rumusan  1 - persen identik dua saksi MANUSIA pada kelompok itu
 *            (29.338 pasangan jawaban; skrip ukur-profil.cjs). Tidak pernah
 *            diberi pembuka.
 *   lain     sama dengan rumusan, tetapi boleh diberi pembuka.
 *
 * Kunci 'lain' dipakai untuk pertanyaan tanpa kelompok (72,2% identik).
 */
const PROFIL = [
  { kunci: "kenal", data: { peluangRagam: 1, rumusan: false } },
  { kunci: "tempat tinggal", data: { peluangRagam: 1, rumusan: false } },
  { kunci: "kehidupan", data: { peluangRagam: 1, rumusan: false } },
  { kunci: "penyebab", data: { peluangRagam: 1, rumusan: false } },
  { kunci: "cara tahu", data: { peluangRagam: 1, rumusan: false } },
  { kunci: "menyaksikan", data: { peluangRagam: 1, rumusan: false } },
  { kunci: "pisah", data: { peluangRagam: 1, rumusan: false } },
  { kunci: "upaya damai", data: { peluangRagam: 1, rumusan: false } },
  // Butir 27 (5 Oktober 2026, permintaan pengguna): dua saksi bermodus sama
  // tidak boleh berbunyi kata demi kata sama, termasuk pada rumusan. Peluang
  // rumusan dinaikkan ke 1; rumusan:true tetap (tidak pernah diberi pembuka).
  // Angka di komentar = persen identik dua saksi MANUSIA, sebagai catatan.
  { kunci: "penutup", data: { peluangRagam: 1, rumusan: true } }, // 99,9% identik, n=1.928
  { kunci: "keberatan", data: { peluangRagam: 1, rumusan: true } }, // 95,1%, n=226
  { kunci: "komunikasi", data: { peluangRagam: 1, rumusan: true } }, // 92,8%, n=1.592
  { kunci: "nafkah", data: { peluangRagam: 1, rumusan: true } }, // 92,3%, n=1.011
  { kunci: "kenapa cerai", data: { peluangRagam: 1, rumusan: true } }, // 91,2%, n=910
  { kunci: "maksud", data: { peluangRagam: 1, rumusan: true } }, // 87,9%, n=1.387
  // Enam kelompok "lain" di bawah dinaikkan ke 1 pada 26 September 2026
  // (permintaan pengguna 9): keterangan dua saksi harus BERBEDA susunannya
  // tetapi sama fakta hukumnya. Peluang lamanya meniru saksi manusia yang
  // kerap disalin petugas (angka di komentar = persen identik manusia);
  // pengguna memilih keduanya berbeda selama bank bentuknya cukup.
  // periksaInvarian menjaga angka, sebutan, dan penyangkal - bentuk yang
  // mengubahnya dilepas penyusun; derajat bunyi alasan dijaga setara satu
  // derajat di abtKalimatBaku.frasaCiri. (Angka "fakta sama 67.030/67.030"
  // di folder kerja pembangun sebenarnya KUNCI sama - kuncinya diturunkan
  // dari kosakata frasa yang sama - bukan bukti fakta sama; pemeriksa 26
  // September 2026.) Kelompok rumusan tidak diubah.
  { kunci: "sanggup", data: { peluangRagam: 1, rumusan: false } }, // manusia 99,5% identik, n=196
  { kunci: "hubungan pihak", data: { peluangRagam: 1, rumusan: false } }, // 84,8%, n=277
  { kunci: "siapa pergi", data: { peluangRagam: 1, rumusan: false } }, // 79,4%, n=1.417
  { kunci: "anak", data: { peluangRagam: 1, rumusan: false } }, // 56,0%, n=2.633
  { kunci: "awal perselisihan", data: { peluangRagam: 1, rumusan: false } }, // 54,5%, n=983
  { kunci: "lain", data: { peluangRagam: 1, rumusan: false } }, // 72,2%, n=3.463
];

module.exports = { PEMBUKA, AWAL_BOLEH_DIKECILKAN, RAGAM_KATA, JAWABAN_MODUS, BENTUK, PROFIL };
