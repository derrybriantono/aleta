"use strict";

/**
 * Menerjemahkan agenda sidang menjadi dua hal yang dibutuhkan pihak:
 *
 *   1. APA YANG HARUS DISIAPKAN  (Usulan 07)
 *   2. PERLU DIINGATKAN ATAU TIDAK  (Usulan 13)
 *
 * Keduanya berangkat dari satu sumber yang sama, yaitu kolom `agenda` pada
 * perkara_jadwal_sidang, sehingga tidak mungkin terjadi keadaan janggal di mana
 * pihak diingatkan untuk sesuatu yang penjelasannya berbeda.
 *
 * --- Mengapa dari agenda, bukan dari "kelengkapan berkas" ---
 *
 * Rencana semula menyebut daftar "berkas pihak yang kurang". SIPP tidak
 * menyimpan hal itu. Yang dicatat SIPP adalah dokumen milik PENGADILAN (edoc
 * petitum, relaas, BAS), bukan dokumen milik pihak. Membuat daftar kekurangan
 * dari data itu akan menghasilkan daftar yang salah - lebih buruk daripada
 * tidak memberi daftar sama sekali, karena pihak akan mempercayainya.
 *
 * Agenda sidang berikutnya adalah dasar yang jujur: ia benar-benar menyatakan
 * apa yang akan terjadi di persidangan, dan dari situ apa yang perlu dibawa
 * dapat diturunkan tanpa mengarang.
 *
 * --- Mengapa daftar ini bisa disunting dari portal ---
 *
 * Kalimat "bawa dua orang saksi dewasa" bukan pernyataan teknis, melainkan
 * pernyataan pengadilan tentang hukum acara. Yang berhak memastikannya benar
 * adalah panitera, bukan penulis kode. Karena itu seluruh daftar di bawah dapat
 * ditimpa lewat runtimeConfig.sidangAgendaGuide tanpa mengubah kode, persis
 * seperti kamus istilah hukum.
 */

const { readRuntimeConfig } = require("../config/runtime-config");

/** Judul yang dipakai saat menempelkan daftar persiapan ke sebuah pesan. */
const PREPARATION_HEADING = "Yang perlu Anda siapkan:";

/**
 * Nasihat yang berlaku untuk agenda apa pun.
 *
 * Sengaja hanya satu baris. Setiap baris tambahan yang berlaku umum akan
 * muncul di SETIAP pesan jadwal sidang, dan pesan yang selalu sama persis
 * adalah pesan yang berhenti dibaca orang.
 */
const UNIVERSAL_ADVICE = "Datang paling lambat 30 menit sebelum sidang untuk mendaftar di meja antrian.";

/**
 * Padanan agenda.
 *
 * `patterns` dicocokkan sebagai potongan kata pada agenda yang sudah dikecilkan
 * hurufnya. Satu agenda boleh cocok dengan beberapa kelas sekaligus - agenda
 * "Pembuktian dan Pemeriksaan Saksi" benar-benar ada di lapangan - dan itu
 * ditangani dengan menggabungkan, bukan memilih salah satu.
 *
 * `h3`/`h1` menyatakan pada jarak berapa hari pihak perlu diingatkan:
 *   h3 = tiga hari sebelum sidang, untuk agenda yang perlu PERSIAPAN
 *        (mencari saksi, melegalisir surat, mengatur cuti kerja)
 *   h1 = sehari sebelum sidang, untuk agenda yang cukup perlu DIINGAT
 */
const DEFAULT_AGENDA_CLASSES = [
  {
    key: "mediasi",
    label: "Mediasi",
    patterns: ["mediasi"],
    h3: true,
    h1: true,
    persiapan: [
      "Kedua pihak wajib hadir sendiri. Mediasi tidak dapat diwakilkan, termasuk oleh kuasa hukum.",
      "Bawa KTP asli.",
      "Siapkan hal-hal yang ingin Anda sepakati secara damai.",
    ],
  },
  {
    key: "saksi",
    label: "Pemeriksaan Saksi",
    patterns: ["saksi"],
    h3: true,
    h1: true,
    persiapan: [
      "Bawa minimal 2 orang saksi dewasa yang mengetahui langsung keadaan rumah tangga Anda.",
      "Saksi tidak boleh anak kandung Anda sendiri.",
      "Bawa KTP asli masing-masing saksi.",
      "Beri tahu saksi Anda tanggal dan jam sidangnya jauh hari, karena mereka perlu mengatur waktu.",
    ],
  },
  {
    key: "bukti",
    label: "Pembuktian Surat",
    patterns: ["bukti"],
    h3: true,
    h1: true,
    persiapan: [
      "Bawa surat bukti ASLI beserta fotokopinya.",
      "Fotokopi harus bermeterai dan sudah dilegalisir (nazegelen) di kantor pos.",
      "Legalisir di kantor pos perlu waktu, jangan menunda sampai hari sidang.",
    ],
  },
  {
    key: "pemeriksaan_setempat",
    label: "Pemeriksaan Setempat",
    patterns: ["pemeriksaan setempat", "descente", "sidang lapangan"],
    h3: true,
    h1: true,
    persiapan: [
      "Sidang dilaksanakan di lokasi objek sengketa, bukan di gedung pengadilan.",
      "Siapkan surat tanah atau bukti kepemilikan yang berkaitan dengan objek.",
      "Pastikan batas-batas objek dapat ditunjukkan pada hari itu.",
    ],
  },
  {
    key: "ikrar_talak",
    label: "Sidang Ikrar Talak",
    patterns: ["ikrar"],
    h3: true,
    h1: true,
    persiapan: [
      "Kehadiran Anda wajib. Ikrar talak tidak dapat diwakilkan.",
      "Bawa KTP asli dan buku nikah.",
      "Penetapan ikrar talak gugur bila tidak dilaksanakan dalam 6 bulan sejak penetapan berkekuatan hukum tetap.",
    ],
  },
  {
    key: "sidang_pertama",
    label: "Sidang Pertama",
    patterns: ["sidang pertama", "upaya damai", "pembacaan gugatan", "pembacaan permohonan"],
    h3: true,
    h1: true,
    persiapan: [
      "Bawa KTP asli dan salinan surat gugatan/permohonan Anda.",
      "Kedua pihak dianjurkan hadir sendiri, karena hakim akan mengupayakan perdamaian lebih dulu.",
    ],
  },
  {
    key: "putusan",
    label: "Pembacaan Putusan",
    patterns: ["putusan", "penetapan"],
    h3: true,
    h1: true,
    persiapan: [
      "Anda sangat dianjurkan hadir.",
      "Kehadiran Anda menentukan cara penghitungan tenggang waktu banding: bila hadir, 14 hari dihitung sejak hari putusan dibacakan.",
      "Bawa KTP asli.",
    ],
  },
  {
    key: "jawab_menjawab",
    label: "Jawab-Menjawab",
    // Jawaban, replik, duplik, dan kesimpulan tidak menuntut persiapan berhari-hari.
    // Karena itu kelas ini sengaja TIDAK diingatkan pada H-3 - lihat catatan di
    // reminderPlan().
    patterns: ["jawaban", "replik", "duplik", "tanggapan", "kesimpulan"],
    h3: false,
    h1: true,
    persiapan: [
      "Siapkan tanggapan Anda secara tertulis. Bila tidak sempat menulis, tanggapan boleh disampaikan lisan di persidangan.",
      "Bawa KTP asli.",
    ],
  },
];

/**
 * Kelas cadangan untuk agenda yang tidak dikenali.
 *
 * Nilainya dipilih untuk MEMPERTAHANKAN keadaan sekarang, bukan menebak:
 * h3 tetap dikirim (itu yang sudah berjalan hari ini) dan h1 tidak dikirim
 * (agar agenda yang belum dikenali tidak diam-diam menambah jumlah pesan).
 * Dengan begitu, agenda baru yang muncul di SIPP tidak pernah membuat pihak
 * kehilangan pengingat, dan tidak pernah membuat lalu lintas pesan melonjak.
 */
const FALLBACK_CLASS = {
  key: "lainnya",
  label: "Sidang",
  patterns: [],
  h3: true,
  h1: false,
  persiapan: ["Bawa KTP asli.", "Bawa salinan berkas perkara yang Anda miliki."],
};

function normalizeText(value) {
  return String(value == null ? "" : value)
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeLines(value) {
  if (!Array.isArray(value)) return [];
  const lines = [];
  for (const item of value) {
    const text = String(item == null ? "" : item).trim();
    if (text) lines.push(text);
  }
  return lines;
}

/**
 * Membaca padanan tambahan/pengganti dari portal.
 *
 * Entri dengan `key` yang sama dengan bawaan akan MENGGANTI bawaan itu -
 * bukan menambah - supaya panitera dapat memperbaiki kalimat yang keliru,
 * bukan sekadar menumpuk kalimat baru di atas kalimat lama.
 */
function loadClasses(runtimeConfig) {
  const extra = runtimeConfig && runtimeConfig.sidangAgendaGuide;
  const merged = DEFAULT_AGENDA_CLASSES.map((item) => ({ ...item }));
  if (!Array.isArray(extra)) return merged;

  for (const raw of extra) {
    if (!raw || typeof raw !== "object") continue;
    const key = String(raw.key || "").trim();
    if (!key) continue;

    const patterns = normalizeLines(raw.patterns).map(normalizeText).filter(Boolean);
    const persiapan = normalizeLines(raw.persiapan);
    const index = merged.findIndex((item) => item.key === key);
    const base = index >= 0 ? merged[index] : { key, label: key, patterns: [], h3: true, h1: false, persiapan: [] };

    const entry = {
      key,
      label: String(raw.label || base.label || key).trim() || key,
      patterns: patterns.length > 0 ? patterns : base.patterns,
      // Nilai bukan-boolean diabaikan supaya salah ketik di portal tidak
      // diam-diam mematikan sebuah pengingat.
      h3: typeof raw.h3 === "boolean" ? raw.h3 : base.h3,
      h1: typeof raw.h1 === "boolean" ? raw.h1 : base.h1,
      persiapan: persiapan.length > 0 ? persiapan : base.persiapan,
    };

    if (index >= 0) merged[index] = entry;
    else merged.push(entry);
  }
  return merged;
}

/**
 * Menentukan kelas-kelas yang cocok dengan sebuah agenda.
 *
 * Mengembalikan DAFTAR, bukan satu kelas. Agenda gabungan seperti "Pembuktian
 * Surat dan Pemeriksaan Saksi Penggugat" nyata ada di SIPP; memilih salah satu
 * saja akan menghilangkan setengah persiapan yang dibutuhkan pihak.
 *
 * @returns {Array<object>} kelas yang cocok, atau [FALLBACK_CLASS] bila tidak ada
 */
function classifyAgenda(agenda, runtimeConfig = readRuntimeConfig()) {
  const haystack = normalizeText(agenda);
  if (!haystack) return [{ ...FALLBACK_CLASS }];

  const matched = [];
  for (const item of loadClasses(runtimeConfig)) {
    const patterns = Array.isArray(item.patterns) ? item.patterns : [];
    const cocok = patterns.some((pattern) => {
      const needle = normalizeText(pattern);
      return needle && haystack.includes(needle);
    });
    if (cocok) matched.push({ ...item });
  }

  return matched.length > 0 ? matched : [{ ...FALLBACK_CLASS }];
}

/**
 * Menyusun daftar persiapan untuk sebuah agenda. (Usulan 07)
 *
 * @returns {{ classes: string[], label: string, lines: string[] }}
 */
function describePreparation(agenda, runtimeConfig = readRuntimeConfig()) {
  const classes = classifyAgenda(agenda, runtimeConfig);
  const lines = [];
  const terlihat = new Set();

  for (const item of classes) {
    for (const line of normalizeLines(item.persiapan)) {
      // Agenda gabungan sering menghasilkan nasihat kembar, misalnya "Bawa KTP
      // asli" dari dua kelas sekaligus.
      const sidik = normalizeText(line);
      if (terlihat.has(sidik)) continue;
      terlihat.add(sidik);
      lines.push(line);
    }
  }

  if (!terlihat.has(normalizeText(UNIVERSAL_ADVICE))) {
    lines.push(UNIVERSAL_ADVICE);
  }

  return {
    classes: classes.map((item) => item.key),
    label: classes.map((item) => item.label).join(" dan "),
    lines,
  };
}

/**
 * Bentuk siap-kirim dari daftar persiapan.
 *
 * @returns {string} blok teks, atau "" bila tidak ada yang perlu disampaikan
 */
function formatPreparation(agenda, runtimeConfig = readRuntimeConfig()) {
  const { lines } = describePreparation(agenda, runtimeConfig);
  if (lines.length === 0) return "";
  return `${PREPARATION_HEADING}\n${lines.map((line) => `- ${line}`).join("\n")}`;
}

/**
 * Menempelkan daftar persiapan ke sebuah pesan.
 *
 * Aman dipanggil berkali-kali: pesan yang sudah memuat judul persiapan
 * dikembalikan apa adanya. Penjagaan ini perlu karena isi pesan boleh disunting
 * admin - bila admin sudah menaruh {{persiapan_sidang}} sendiri di dalam isi
 * pesan, penempelan otomatis tidak boleh mengulanginya di bawah.
 */
function appendPreparation(message, agenda, runtimeConfig = readRuntimeConfig()) {
  const body = String(message == null ? "" : message);
  if (!body.trim()) return body;
  if (body.includes(PREPARATION_HEADING)) return body;

  const blok = formatPreparation(agenda, runtimeConfig);
  if (!blok) return body;
  return `${body.trimEnd()}\n\n${blok}`;
}

/**
 * Menentukan apakah pihak perlu diingatkan pada H-3 dan/atau H-1. (Usulan 13)
 *
 * --- Mengapa jawab-menjawab hanya H-1 ---
 *
 * Menambahkan H-1 untuk semua agenda berarti setiap pihak menerima dua pesan
 * untuk satu sidang, dan itu melawan pengaman anti-pemblokiran yang baru saja
 * dipasang. Jalan keluarnya bukan menolak H-1, melainkan menempatkannya
 * berdasarkan kebutuhan nyata:
 *
 *   Agenda yang menuntut persiapan (saksi, bukti, mediasi) -> H-3 DAN H-1.
 *   Pihak perlu waktu mencari saksi, lalu perlu diingatkan lagi menjelang hari.
 *
 *   Agenda jawab-menjawab -> H-1 SAJA.
 *   Tidak ada yang perlu dicari atau diurus berhari-hari sebelumnya, sehingga
 *   H-3 hanya menjadi pesan yang dibaca lalu dilupakan. Untuk kelompok ini
 *   jumlah pesan justru BERKURANG dari dua menjadi satu.
 *
 * Gabungan keduanya membuat kenaikan jumlah pesan jauh di bawah dua kali lipat,
 * sambil menaruh pengingat pada saat pihak benar-benar dapat menindaklanjutinya.
 *
 * Bila sebuah agenda cocok dengan beberapa kelas, keputusan digabung dengan
 * "salah satu cukup" - agenda "Pembuktian dan Jawaban" tetap diingatkan pada
 * H-3, karena pembuktiannya memang perlu disiapkan.
 *
 * @returns {{ h3: boolean, h1: boolean, classes: string[], label: string }}
 */
function reminderPlan(agenda, runtimeConfig = readRuntimeConfig()) {
  const classes = classifyAgenda(agenda, runtimeConfig);
  return {
    h3: classes.some((item) => item.h3 === true),
    h1: classes.some((item) => item.h1 === true),
    classes: classes.map((item) => item.key),
    label: classes.map((item) => item.label).join(" dan "),
  };
}

/**
 * Jawaban langsung untuk penjadwal: boleh kirim pada tahap ini atau tidak.
 *
 * Tahap yang tidak dikenali menghasilkan `true` - gagal-terbuka. Penjadwal yang
 * salah konfigurasi harus tetap mengirim pemberitahuan pengadilan, bukan
 * mendiamkannya.
 *
 * @param {string} agenda isi kolom agenda dari SIPP
 * @param {string} stage "h3" atau "h1"
 */
function shouldRemind(agenda, stage, runtimeConfig = readRuntimeConfig()) {
  const tahap = normalizeText(stage);
  if (tahap !== "h3" && tahap !== "h1") return true;
  const plan = reminderPlan(agenda, runtimeConfig);
  return tahap === "h3" ? plan.h3 : plan.h1;
}

/** Daftar padanan yang sedang berlaku - dipakai portal dan skrip pemeriksaan. */
function listClasses(runtimeConfig = readRuntimeConfig()) {
  return loadClasses(runtimeConfig).map((item) => ({ ...item }));
}

module.exports = {
  DEFAULT_AGENDA_CLASSES,
  FALLBACK_CLASS,
  PREPARATION_HEADING,
  UNIVERSAL_ADVICE,
  appendPreparation,
  classifyAgenda,
  describePreparation,
  formatPreparation,
  listClasses,
  reminderPlan,
  shouldRemind,
};
