/**
 * ============================================================================
 * PENYAMARAN ISI PERKARA SEBELUM KELUAR KE PENYEDIA AI
 * ============================================================================
 *
 * Tahap 1b rencana agen. Yang dijawab di sini satu pertanyaan: apa yang boleh
 * keluar dari peladen pengadilan ketika ALETA meminta bantuan model bahasa?
 *
 * ============================================================================
 * KENAPA KAMUS, BUKAN PENGENAL ENTITAS
 * ============================================================================
 *
 * Cara lazim menyamarkan nama adalah menebaknya dengan pengenal entitas (NER):
 * membaca kalimat, menduga mana yang nama orang. Untuk pengadilan itu cara
 * yang salah, dan salahnya ke arah yang paling berbahaya - yang tidak
 * terdeteksi LOLOS, diam-diam, tanpa ada yang tahu.
 *
 * ALETA tidak perlu menebak. Nama para pihak SUDAH DIKETAHUI: ia ada di SIPP,
 * di tabel pihak perkara, lengkap dengan alias dan bin/bintinya. Jadi
 * penyamarannya DETERMINISTIK - daftar nama yang diketahui, diganti dengan
 * sebutan perannya. Yang tidak ada di daftar bukan urusan kamus ini; itu
 * urusan periksaSisa(), yang MELAPORKAN, bukan menebak.
 *
 * Hasil sampingannya justru lebih baik untuk mutu jawaban: model yang membaca
 * "[PENGGUGAT] menikah dengan [TERGUGAT]" tidak dapat tergelincir tertukar
 * nama, dan jawabannya dapat dipakai ulang untuk perkara lain.
 *
 * ============================================================================
 * DUA LAPIS, DAN LAPIS KEDUA TIDAK MENGGANTI APA PUN
 * ============================================================================
 *
 *   Lapis 1  KAMUS      nama pihak, kuasa, saksi -> [PENGGUGAT], [SAKSI-1], ...
 *   Lapis 2  POLA       NIK, NIP, telepon, rekening, surel -> ditutup
 *   Lapis 3  PERIKSA    apa yang MASIH terlihat seperti data pribadi
 *
 * Lapis 3 tidak mengubah teks. Ia menghitung dan melaporkan, dan laporan itu
 * yang menentukan boleh-tidaknya muatan ini berangkat (lihat jalur "perkara"
 * di aiProviderAdapter). Menyamarkan lalu berkata "beres" tanpa memeriksa
 * sisanya adalah bentuk paling halus dari kebocoran: semua tampak aman.
 */
"use strict";

/** Kata yang bukan nama walau berdiri di antara nama. */
const KATA_BUKAN_NAMA = new Set([
  "bin",
  "binti",
  "alias",
  "als",
  "dan",
  "atau",
  "dkk",
  "cs",
  "nama",
  "tuan",
  "nyonya",
  "saudara",
  "saudari",
  "bapak",
  "ibu",
  "sdr",
  "sdri",
  "tn",
  "ny",
  "hj",
  "haji",
  "hajjah",
  "drs",
  "dra",
  "spd",
  "shi",
  "mh",
  "sh",
]);

/**
 * Potongan nama terpendek yang boleh berdiri sendiri sebagai kata kunci.
 *
 * Tiga huruf terlalu pendek: "Ali" akan mencabik kata "alias", "kualifikasi",
 * dan nama tempat. Empat huruf pun masih berisiko, tetapi dengan batas kata
 * (\b) dan daftar kata-bukan-nama di atas, salah tangkapnya jarang - dan
 * arah salahnya aman: yang tersamar berlebihan hanya membuat kalimat lebih
 * hambar, yang lolos membuat data pribadi keluar.
 */
const PANJANG_MIN_POTONGAN = 4;

/** Urutan peran -> sebutan. Sebutan dipakai apa adanya oleh model. */
const SEBUTAN_PERAN = {
  penggugat: "PENGGUGAT",
  pemohon: "PEMOHON",
  tergugat: "TERGUGAT",
  termohon: "TERMOHON",
  turut_tergugat: "TURUT TERGUGAT",
  kuasa: "KUASA HUKUM",
  saksi: "SAKSI",
  anak: "ANAK",
  lain: "PIHAK",
};

function bakukan(teks) {
  return String(teks || "")
    .replace(/\s+/g, " ")
    .trim();
}

function tanpaGelar(nama) {
  return bakukan(nama)
    .split(" ")
    .filter((kata) => !KATA_BUKAN_NAMA.has(kata.toLowerCase().replace(/[.,]/g, "")))
    .join(" ");
}

/** Escape untuk dipakai di dalam RegExp. */
function lolosRegex(teks) {
  return String(teks).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Menyusun kamus penyamaran dari daftar pihak yang DIKETAHUI SIPP.
 *
 * pihak: [{ nama, peran, alias }]
 * Pulang: [{ pola: RegExp, ganti: "[PENGGUGAT]", asal: "Zakina binti Lukman" }]
 * diurutkan dari yang PALING PANJANG - supaya nama penuh diganti lebih dulu
 * daripada potongannya, dan hasilnya tidak menjadi "[PENGGUGAT] binti Lukman".
 */
function susunKamus(pihak = []) {
  const nomorPer = new Map();
  const masukan = [];

  for (const satu of Array.isArray(pihak) ? pihak : []) {
    const nama = bakukan(satu && satu.nama);
    if (!nama) continue;
    const peranKunci = String((satu && satu.peran) || "lain")
      .toLowerCase()
      .replace(/\s+/g, "_");
    const sebutanDasar = SEBUTAN_PERAN[peranKunci] || SEBUTAN_PERAN.lain;

    // Saksi dan anak lazim lebih dari satu, jadi diberi nomor. Penggugat
    // tunggal tidak perlu "PENGGUGAT-1" - itu hanya menambah derau.
    const perluNomor = peranKunci === "saksi" || peranKunci === "anak" || peranKunci === "turut_tergugat";
    const urut = (nomorPer.get(sebutanDasar) || 0) + 1;
    nomorPer.set(sebutanDasar, urut);
    const sebutan = perluNomor ? `[${sebutanDasar}-${urut}]` : `[${sebutanDasar}]`;

    const varian = new Set();
    varian.add(nama);
    const inti = tanpaGelar(nama);
    if (inti && inti !== nama) varian.add(inti);
    for (const alias of Array.isArray(satu.alias) ? satu.alias : []) {
      const a = bakukan(alias);
      if (a) varian.add(a);
    }
    // Tiap potongan nama yang cukup panjang - orang menyebut "Zakina" saja.
    for (const potongan of inti.split(" ")) {
      if (potongan.length >= PANJANG_MIN_POTONGAN && !KATA_BUKAN_NAMA.has(potongan.toLowerCase())) {
        varian.add(potongan);
      }
    }
    for (const v of varian) masukan.push({ asal: v, ganti: sebutan });
  }

  // Paling panjang dahulu; yang sama panjang diurutkan supaya hasilnya ajek.
  masukan.sort((a, b) => b.asal.length - a.asal.length || a.asal.localeCompare(b.asal, "id"));

  const sudah = new Set();
  const kamus = [];
  for (const { asal, ganti } of masukan) {
    const kunci = asal.toLowerCase();
    if (sudah.has(kunci)) continue;
    sudah.add(kunci);
    kamus.push({
      asal,
      ganti,
      // Batas kata di kedua sisi, huruf besar-kecil diabaikan. Nama di posita
      // kerap ditulis KAPITAL SELURUHNYA, kadang Kapital Awal saja.
      pola: new RegExp(`\\b${lolosRegex(asal).replace(/\s+/g, "\\s+")}\\b`, "gi"),
    });
  }
  return kamus;
}

/** Pola data pribadi yang tidak bergantung pada daftar nama. */
const POLA_UMUM = [
  { nama: "NIK", pola: /\b\d{16}\b/g, ganti: "[NIK]" },
  { nama: "NIP", pola: /\b\d{18}\b/g, ganti: "[NIP]" },
  { nama: "telepon", pola: /\b(?:\+?62|0)\d{8,13}\b/g, ganti: "[TELEPON]" },
  { nama: "surel", pola: /\b[\w.%+-]+@[\w.-]+\.[A-Za-z]{2,}\b/g, ganti: "[SUREL]" },
  { nama: "rekening", pola: /\b\d{10,15}\b/g, ganti: "[NOMOR]" },
];

/**
 * Menyamarkan satu teks.
 * Pulang { teks, jumlah, perKategori } - jumlah penggantian, bukan dugaan.
 */
function samarkan(teks, kamus = []) {
  let hasil = String(teks || "");
  const perKategori = {};
  let jumlah = 0;

  for (const { pola, ganti } of kamus) {
    hasil = hasil.replace(pola, () => {
      jumlah += 1;
      perKategori[ganti] = (perKategori[ganti] || 0) + 1;
      return ganti;
    });
  }
  for (const { nama, pola, ganti } of POLA_UMUM) {
    hasil = hasil.replace(pola, () => {
      jumlah += 1;
      perKategori[nama] = (perKategori[nama] || 0) + 1;
      return ganti;
    });
  }
  return { teks: hasil, jumlah, perKategori };
}

/**
 * Lapis ketiga: apa yang MASIH terlihat seperti data pribadi sesudah disamarkan.
 *
 * Tidak mengubah apa pun. Yang dicari bentuk-bentuk yang kamus tidak dapat
 * ketahui: angka panjang yang lolos, dan deretan kata BERHURUF KAPITAL yang
 * menyerupai nama - posita SIPP menulis nama dengan kapital seluruhnya, dan
 * itulah petunjuk terkuat yang tersedia tanpa menebak.
 *
 * Kapital yang memang bukan nama - "PUTUSAN", "PENGADILAN AGAMA" - disaring
 * dengan daftar kata hukum yang lazim. Sisanya DILAPORKAN, dan yang membaca
 * laporan itu yang memutuskan.
 */
const KATA_HUKUM_KAPITAL = new Set([
  "PUTUSAN",
  "PENETAPAN",
  "PENGADILAN",
  "AGAMA",
  "NEGERI",
  "TINGGI",
  "MAHKAMAH",
  "AGUNG",
  "REPUBLIK",
  "INDONESIA",
  "DEMI",
  "KEADILAN",
  "BERDASARKAN",
  "KETUHANAN",
  "YANG",
  "MAHA",
  "ESA",
  "MENGADILI",
  "MENIMBANG",
  "MENGINGAT",
  "PENGGUGAT",
  "TERGUGAT",
  "PEMOHON",
  "TERMOHON",
  "SAKSI",
  "KUASA",
  "HUKUM",
  "PIHAK",
  "ANAK",
  "NIK",
  "NIP",
  "TELEPON",
  "SUREL",
  "NOMOR",
  "KUA",
  "KECAMATAN",
  "KABUPATEN",
  "PROVINSI",
  "DESA",
  "KELURAHAN",
  // Nama satker sendiri. Ia berdiri di kepala hampir tiap naskah, dan
  // melaporkannya sebagai "nama diduga" pada tiap berkas membuat laporan ini
  // penuh derau - dan laporan yang penuh derau berhenti dibaca, yang justru
  // membuat kebocoran sungguhan ikut terlewat.
  "DONGGALA",
  // Lembaga yang lazim disebut dalam posita perceraian dan waris.
  "POLDA",
  "POLRES",
  "POLSEK",
  "KEPOLISIAN",
  "RUMAH",
  "SAKIT",
  "PUSKESMAS",
  "SEKOLAH",
  "BANK",
]);

/**
 * @param {string} teks
 * @param {string[]} [kataDikenal] kata BERKAPITAL yang diketahui BUKAN nama
 *   orang - nama tempat setempat, nama lembaga, nama kantor. Disediakan
 *   sebagai parameter, bukan ditambahkan terus-menerus ke daftar di atas:
 *   daftar yang terus tumbuh pada akhirnya akan memuat nama seseorang, dan
 *   sejak saat itu nama itu lolos diam-diam pada SETIAP perkara.
 */
function periksaSisa(teks, kataDikenal = []) {
  const dikenal = new Set([...KATA_HUKUM_KAPITAL, ...kataDikenal.map((k) => String(k || "").toUpperCase())]);
  // Penanda hasil penyamaran sendiri - "[TURUT TERGUGAT-1]", "[SAKSI-2]" -
  // dibuang dahulu. Tanpa ini pemindai membaca penandanya sebagai "dua kata
  // kapital berturut-turut" dan melaporkan penyamaran sebagai kebocoran:
  // laporan yang menuduh pekerjaannya sendiri, dan yang membacanya akan
  // berhenti mempercayai laporan itu.
  const isi = String(teks || "").replace(/\[[A-Z][A-Z \-0-9]*\]/g, " ");
  const temuan = [];

  for (const { nama, pola } of POLA_UMUM) {
    const cocok = isi.match(new RegExp(pola.source, "g"));
    if (cocok && cocok.length > 0) temuan.push({ jenis: nama, jumlah: cocok.length, contoh: cocok[0] });
  }

  // Dua kata kapital berturut-turut atau lebih, di luar kosakata hukum.
  const kapital = isi.match(/\b[A-Z][A-Z'`.-]{2,}(?:\s+[A-Z][A-Z'`.-]{2,})+\b/g) || [];
  const namaDiduga = [];
  for (const frasa of kapital) {
    const kata = frasa.split(/\s+/).map((k) => k.replace(/[.'`-]/g, ""));
    if (kata.every((k) => dikenal.has(k))) continue;
    namaDiduga.push(frasa);
  }
  if (namaDiduga.length > 0) {
    temuan.push({
      jenis: "nama diduga (kapital)",
      jumlah: namaDiduga.length,
      contoh: namaDiduga[0],
      daftar: [...new Set(namaDiduga)].slice(0, 20),
    });
  }
  return temuan;
}

/**
 * Menyiapkan satu muatan isi perkara untuk dikirim.
 *
 * Pulang { teks, bukti } - dan `bukti` inilah yang dituntut jalur "perkara"
 * di aiProviderAdapter. Tanpa bukti, muatan tidak berangkat. Itu disengaja:
 * lebih baik satu permintaan ditolak daripada satu posita keluar utuh.
 */
function siapkanMuatan({ teks, pihak = [], nomorPerkara = "", kataDikenal = [] } = {}) {
  const kamus = susunKamus(pihak);
  const hasil = samarkan(teks, kamus);
  // Nomor perkara bukan data pribadi, tetapi ia menautkan seluruh isinya ke
  // satu berkas yang dapat dicari siapa pun. Diganti penanda; yang meminta
  // sudah tahu perkara mana yang sedang dikerjakannya.
  const tanpaNomor = nomorPerkara
    ? hasil.teks.replace(new RegExp(lolosRegex(bakukan(nomorPerkara)), "gi"), "[NOMOR PERKARA]")
    : hasil.teks;
  const sisa = periksaSisa(tanpaNomor, kataDikenal);
  return {
    teks: tanpaNomor,
    bukti: {
      diterapkan: true,
      jumlahPenggantian: hasil.jumlah,
      perKategori: hasil.perKategori,
      jumlahKamus: kamus.length,
      sisa,
      bersih: sisa.length === 0,
      padaIso: new Date().toISOString(),
    },
  };
}

module.exports = {
  SEBUTAN_PERAN,
  PANJANG_MIN_POTONGAN,
  bakukan,
  tanpaGelar,
  susunKamus,
  samarkan,
  periksaSisa,
  siapkanMuatan,
};
