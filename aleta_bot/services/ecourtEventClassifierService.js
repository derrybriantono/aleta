"use strict";

/**
 * Menerjemahkan dokumen e-Court menjadi keputusan: perlu diberitahukan atau
 * tidak, kepada siapa, dan dengan kalimat apa.
 *
 * Mengikuti pola sidangAgendaService.js: kelas dengan pola pencocokan, dapat
 * ditimpa dari portal, dan mengembalikan DAFTAR kelas yang cocok agar judul
 * gabungan tetap tertangani.
 *
 * --- Tiga aturan yang menentukan bentuk berkas ini ---
 *
 * 1. HANYA YANG SUDAH DIVERIFIKASI. Pada e-Court, verifikasi bisa DIBATALKAN
 *    (ada tombol "Batal Verifikasi" di sebelah statusnya). Dokumen yang baru
 *    diunggah masih bisa dinyatakan tidak valid oleh majelis. Memberitahu
 *    pihak lawan sebelum majelis memutuskan berarti menyampaikan sesuatu yang
 *    mungkin dibatalkan - dan pesan pengadilan yang kemudian tidak berlaku
 *    jauh lebih merugikan daripada pesan yang terlambat.
 *
 * 2. JANGAN BERITAHU PENGUNGGAHNYA SENDIRI. Memberi tahu orang tentang berkas
 *    yang baru saja ia unggah sendiri tidak menambah apa pun. Yang bernilai
 *    justru dokumen dari pihak LAWAN, karena itulah yang mengubah apa yang
 *    perlu dilakukan penerima selanjutnya.
 *
 * 3. JANGAN BERSINGGUNGAN DENGAN JALUR PUTUSAN. caseDocumentService.js sudah
 *    punya jalurnya sendiri untuk mengirim berkas putusan dari SIPP, lengkap
 *    dengan kunci anti-kembar harian. Dokumen putusan yang muncul di e-Court
 *    harus DILEWATI di sini, bukan ikut dikirim. Pihak yang menerima dua pesan
 *    berbeda untuk peristiwa yang sama adalah kesalahan, bukan fitur.
 */

const { readRuntimeConfig } = require("../config/runtime-config");
const { cleanText } = require("./ecourtTextService");

/** Alasan baku saat sebuah dokumen sengaja tidak diberitahukan. */
const SKIP_REASONS = {
  BERKAS_PENDAFTARAN: "berkas_pendaftaran_milik_pengunggah",
  DITANGANI_JALUR_LAIN: "ditangani_jalur_putusan_sipp",
  BELUM_DIVERIFIKASI: "belum_diverifikasi_majelis",
  TIDAK_DIKENALI: "jenis_dokumen_belum_dikenali",
};

/**
 * Kelas dokumen e-Court.
 *
 * `notify` menentukan apakah kelas ini memicu pesan.
 * `audience` menentukan siapa yang menerima:
 *    "lawan"  - pihak selain pengunggah (yang perlu menindaklanjuti)
 *    "semua"  - seluruh pihak pada perkara
 * `tindakan` adalah kalimat yang memberi tahu penerima apa langkah berikutnya.
 */
const DEFAULT_DOCUMENT_CLASSES = [
  {
    key: "jawaban",
    label: "Jawaban",
    patterns: ["jawaban"],
    notify: true,
    audience: "lawan",
    ringkasan: "Pihak lawan telah menyerahkan Jawaban dan sudah diverifikasi majelis hakim.",
    tindakan: "Bila Anda hendak menanggapi, siapkan Replik untuk disampaikan pada sidang berikutnya.",
  },
  {
    key: "replik",
    label: "Replik",
    patterns: ["replik"],
    notify: true,
    audience: "lawan",
    ringkasan: "Pihak lawan telah menyerahkan Replik dan sudah diverifikasi majelis hakim.",
    tindakan: "Bila Anda hendak menanggapi, siapkan Duplik untuk disampaikan pada sidang berikutnya.",
  },
  {
    key: "duplik",
    label: "Duplik",
    patterns: ["duplik"],
    notify: true,
    audience: "lawan",
    ringkasan: "Pihak lawan telah menyerahkan Duplik dan sudah diverifikasi majelis hakim.",
    tindakan: "Tahap jawab-menjawab biasanya dilanjutkan dengan pembuktian. Siapkan bukti surat dan saksi Anda.",
  },
  {
    key: "kesimpulan",
    label: "Kesimpulan",
    patterns: ["kesimpulan"],
    notify: true,
    audience: "lawan",
    ringkasan: "Pihak lawan telah menyerahkan Kesimpulan dan sudah diverifikasi majelis hakim.",
    tindakan: "Perkara biasanya dilanjutkan ke tahap putusan setelah kesimpulan kedua pihak diterima.",
  },
  {
    key: "bukti",
    label: "Bukti Surat",
    patterns: ["bukti surat", "bukti tertulis", "daftar bukti", "alat bukti"],
    notify: true,
    audience: "lawan",
    ringkasan: "Pihak lawan telah menyerahkan bukti surat dan sudah diverifikasi majelis hakim.",
    tindakan: "Anda berhak menanggapi bukti tersebut pada persidangan.",
    // BUKTI TIDAK MENGIKUTI TENGGAT UNGGAH.
    //
    // Tenggat di halaman e-Court adalah batas mengunggah berkas untuk agenda
    // berikutnya. Untuk Jawaban atau Replik, melewatinya berarti kehilangan
    // kesempatan menanggapi - maka tenggat itu wajib disampaikan.
    //
    // Bukti berbeda: tanggapan atas bukti disampaikan LISAN di persidangan,
    // dan aslinya harus diperlihatkan di depan majelis. Menempelkan tenggat
    // unggah pada pemberitahuan bukti membuat pihak mengira mereka harus
    // mengunggah sesuatu sebelum tanggal itu - lalu panik, atau lebih buruk,
    // mengira haknya hangus padahal tidak.
    tenggatBerlaku: false,
    catatan:
      "Bukti surat asli tetap harus diperlihatkan di persidangan. Salinan yang " +
      "diunggah belum menggantikan kewajiban itu.",
  },
  {
    // Berkas yang diunggah pihak saat mendaftarkan perkaranya sendiri.
    key: "pendaftaran",
    label: "Berkas Pendaftaran",
    patterns: [
      "surat kuasa",
      "gugatan",
      "permohonan",
      "perubahan gugatan",
      "surat gugatan",
      "petitum",
      "posita",
    ],
    notify: false,
    skipReason: SKIP_REASONS.BERKAS_PENDAFTARAN,
  },
  {
    // Sudah ditangani caseDocumentService.js lewat SIPP.
    key: "putusan",
    label: "Putusan",
    patterns: ["putusan", "penetapan", "amar"],
    notify: false,
    skipReason: SKIP_REASONS.DITANGANI_JALUR_LAIN,
  },
];

/** Kelas cadangan untuk judul dokumen yang belum pernah terlihat. */
const FALLBACK_CLASS = {
  key: "lainnya",
  label: "Dokumen",
  patterns: [],
  // Sengaja TIDAK memberitahukan. Judul yang belum dikenali berarti kita tidak
  // tahu apa artinya bagi penerima, dan menebak-nebak kalimat pemberitahuan
  // pengadilan lebih berbahaya daripada diam. Dokumen tetap tercatat sehingga
  // kelasnya bisa ditambahkan setelah bentuk nyatanya terlihat.
  notify: false,
  skipReason: SKIP_REASONS.TIDAK_DIKENALI,
};

function normalize(value) {
  return cleanText(value).toLowerCase();
}

function normalizeLines(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => cleanText(item)).filter(Boolean);
}

/**
 * Membaca kelas tambahan/pengganti dari portal.
 *
 * Entri dengan `key` yang sama MENGGANTI bawaan, supaya panitera dapat
 * memperbaiki kalimat yang keliru - bukan sekadar menumpuk kalimat baru.
 */
function loadClasses(runtimeConfig) {
  const extra = runtimeConfig && runtimeConfig.ecourtDocumentGuide;
  const merged = DEFAULT_DOCUMENT_CLASSES.map((item) => ({ ...item }));
  if (!Array.isArray(extra)) return merged;

  for (const raw of extra) {
    if (!raw || typeof raw !== "object") continue;
    const key = cleanText(raw.key);
    if (!key) continue;

    const index = merged.findIndex((item) => item.key === key);
    const base = index >= 0 ? merged[index] : { key, label: key, patterns: [], notify: false };
    const patterns = normalizeLines(raw.patterns).map(normalize).filter(Boolean);

    const entry = {
      key,
      label: cleanText(raw.label) || base.label || key,
      patterns: patterns.length > 0 ? patterns : base.patterns,
      // Nilai bukan-boolean diabaikan agar salah ketik di portal tidak
      // diam-diam menyalakan pemberitahuan yang tidak diinginkan.
      notify: typeof raw.notify === "boolean" ? raw.notify : base.notify,
      audience: cleanText(raw.audience) || base.audience || "lawan",
      ringkasan: cleanText(raw.ringkasan) || base.ringkasan || "",
      tindakan: cleanText(raw.tindakan) || base.tindakan || "",
      skipReason: cleanText(raw.skipReason) || base.skipReason || "",
    };

    if (index >= 0) merged[index] = entry;
    else merged.push(entry);
  }
  return merged;
}

/**
 * Kelas-kelas yang cocok dengan judul sebuah dokumen.
 *
 * Mengembalikan DAFTAR, bukan satu kelas. Judul gabungan seperti "Jawaban dan
 * Bukti Surat Tergugat" nyata ada; memilih salah satu saja akan membuang
 * setengah maknanya.
 */
function classifyDocument(judulDokumen, runtimeConfig = readRuntimeConfig()) {
  const haystack = normalize(judulDokumen);
  if (!haystack) return [{ ...FALLBACK_CLASS }];

  const matched = [];
  for (const item of loadClasses(runtimeConfig)) {
    const patterns = Array.isArray(item.patterns) ? item.patterns : [];
    const cocok = patterns.some((pattern) => {
      const needle = normalize(pattern);
      return needle && haystack.includes(needle);
    });
    if (cocok) matched.push({ ...item });
  }

  return matched.length > 0 ? matched : [{ ...FALLBACK_CLASS }];
}

/**
 * Peran pihak yang berlawanan dengan pengunggah.
 *
 * Dipakai menentukan siapa yang perlu diberi tahu. Peran yang tidak dikenali
 * mengembalikan null, dan pemanggil harus memperlakukannya sebagai "tidak tahu
 * harus dikirim ke siapa" - bukan mengirim ke semua orang. Salah kirim pada
 * perkara pengadilan lebih buruk daripada tidak kirim.
 */
function opposingRole(peranPengunggah) {
  const peran = normalize(peranPengunggah);
  if (!peran) return null;

  // Peran sampingan harus ditolak LEBIH DULU, sebelum pencocokan umum.
  // "Turut Tergugat" memuat kata "tergugat" dan akan tertangkap pola di
  // bawahnya, padahal perannya berbeda: turut tergugat ikut ditarik ke dalam
  // perkara tanpa harus membantah, dan pihak intervensi masuk atas
  // kehendaknya sendiri. Untuk keduanya, "siapa lawannya" tidak punya jawaban
  // tunggal - dan menebaknya berarti pesan pengadilan bisa nyasar ke pihak
  // yang salah.
  if (/turut|intervensi|penggugat intervensi|pihak ketiga/.test(peran)) return null;

  if (/penggugat|pemohon/.test(peran)) return "tergugat";
  if (/tergugat|termohon/.test(peran)) return "penggugat";
  return null;
}

/**
 * Keputusan lengkap untuk satu dokumen.
 *
 * @returns {{
 *   notify: boolean,
 *   reason: string,
 *   classes: string[],
 *   label: string,
 *   audience: string|null,
 *   targetRole: string|null,
 *   ringkasan: string,
 *   tindakan: string
 * }}
 */
function decide(dokumen = {}, runtimeConfig = readRuntimeConfig()) {
  const classes = classifyDocument(dokumen.judulDokumen || dokumen.judul_dokumen, runtimeConfig);
  const label = classes.map((item) => item.label).join(" dan ");
  const kunci = classes.map((item) => item.key);

  // Kelas yang MELARANG selalu menang atas kelas yang mengizinkan. Judul
  // "Jawaban atas Gugatan" cocok dengan kelas jawaban DAN pendaftaran; yang
  // benar adalah tidak mengirim, karena kita tidak yakin dokumen apa itu.
  const penolak = classes.find((item) => item.notify === false);
  if (penolak) {
    return {
      notify: false,
      reason: penolak.skipReason || SKIP_REASONS.TIDAK_DIKENALI,
      classes: kunci,
      label,
      audience: null,
      targetRole: null,
      ringkasan: "",
      tindakan: "",
    };
  }

  const status = normalize(dokumen.statusVerifikasi || dokumen.status_verifikasi);
  if (status !== "valid") {
    return {
      notify: false,
      reason: SKIP_REASONS.BELUM_DIVERIFIKASI,
      classes: kunci,
      label,
      audience: null,
      targetRole: null,
      ringkasan: "",
      tindakan: "",
    };
  }

  const utama = classes[0];
  const audience = utama.audience || "lawan";
  const targetRole = audience === "lawan"
    ? opposingRole(dokumen.peranPengunggah || dokumen.peran_pengunggah)
    : null;

  if (audience === "lawan" && !targetRole) {
    return {
      notify: false,
      reason: "peran_pengunggah_tidak_dikenali",
      classes: kunci,
      label,
      audience,
      targetRole: null,
      ringkasan: "",
      tindakan: "",
    };
  }

  return {
    notify: true,
    reason: "",
    classes: kunci,
    label,
    audience,
    targetRole,
    ringkasan: classes.map((item) => item.ringkasan).filter(Boolean).join(" "),
    tindakan: classes.map((item) => item.tindakan).filter(Boolean).join(" "),
    // Cukup SATU kelas menyatakan tenggat tidak berlaku untuk membuatnya tidak
    // ditampilkan. Dokumen yang cocok dengan beberapa kelas sekaligus berarti
    // jenisnya tidak pasti, dan menampilkan tenggat yang mungkin keliru lebih
    // berbahaya daripada tidak menampilkannya sama sekali.
    tenggatBerlaku: classes.every((item) => item.tenggatBerlaku !== false),
    catatan: classes.map((item) => item.catatan).filter(Boolean).join(" "),
  };
}

/**
 * Menyusun isi pesan untuk pihak penerima.
 *
 * Sengaja TIDAK menyebut nama pengunggah maupun nama hakim yang memverifikasi.
 * Larangan menyebut nama pegawai ke pihak berlaku sama di sini: yang
 * disampaikan adalah STATUS ("sudah diverifikasi majelis hakim"), bukan siapa
 * yang memverifikasi.
 */
function buildMessage(dokumen = {}, keputusan, { namaPihak = "" } = {}) {
  const nomorPerkara = cleanText(dokumen.nomorPerkara || dokumen.nomor_perkara);
  const sapaan = cleanText(namaPihak) ? `Sdr/Sdri *${cleanText(namaPihak)}*` : "Sdr/Sdri";

  const baris = [
    "Assalamualaikum Warahmatullahi Wabarakatuh,",
    "",
    `${sapaan}, ada berkas baru pada perkara *${nomorPerkara}*.`,
    "",
    `Jenis berkas: ${keputusan.label}`,
    keputusan.ringkasan,
  ];

  if (keputusan.tindakan) {
    baris.push("", `Yang perlu Anda ketahui:`, `- ${keputusan.tindakan}`);
  }

  // BATAS WAKTU - keterangan paling menentukan di seluruh pesan.
  //
  // Pihak yang melewati tenggat ini kehilangan kesempatan menanggapi. Tanpa
  // barisnya, pesan ALETA hanya menyampaikan setengah kabar: "ada dokumen
  // masuk", tanpa "dan tenggatnya kapan".
  const batasTeks = cleanText(dokumen.batasUnggahTeks || dokumen.batas_unggah_teks);
  const batasWaktu = dokumen.batasUnggah || dokumen.batas_unggah;
  const tenggatBerlaku = keputusan.tenggatBerlaku !== false;
  if (tenggatBerlaku && (batasTeks || batasWaktu)) {
    const tampil = batasTeks || formatTanggalIndonesia(batasWaktu);
    baris.push("", `*Batas waktu menanggapi: ${tampil}*`);

    const sisaHari = hitungSisaHari(batasWaktu);
    if (sisaHari !== null && sisaHari >= 0 && sisaHari <= 3) {
      baris.push(
        sisaHari === 0
          ? "Tenggatnya HARI INI. Mohon segera ditindaklanjuti."
          : `Tersisa ${sisaHari} hari lagi.`
      );
    }
  }

  if (cleanText(keputusan.catatan)) {
    baris.push("", cleanText(keputusan.catatan));
  }

  baris.push(
    "",
    "Berkasnya dilampirkan pada pesan ini bila tersedia. Salinan resmi tetap dapat diminta di meja PTSP pengadilan.",
    "",
    // KEDUDUKAN HUKUM.
    //
    // Pesan WhatsApp BUKAN relaas panggilan. Bila ada yang memperlakukannya
    // sebagai pemberitahuan resmi yang sah, suatu saat ada pihak yang
    // mempersoalkan proses persidangannya - dan mereka benar. Kalimat ini
    // menutup kemungkinan itu sejak pesan pertama, bukan setelah dipersoalkan.
    "_Pesan ini pemberitahuan yang mempermudah, bukan pengganti panggilan resmi_",
    "_pengadilan. Pemberitahuan yang sah tetap yang disampaikan jurusita._",
    "",
    "Ini pemberitahuan, Anda tidak perlu membalasnya.",
    "Info lebih lanjut hubungi *0822-7111-5021*."
  );

  return baris.join("\n");
}

/** Tanggal Indonesia singkat untuk ditampilkan di pesan. */
function formatTanggalIndonesia(nilai) {
  if (!nilai) return "";
  const tanggal = nilai instanceof Date ? nilai : new Date(nilai);
  if (Number.isNaN(tanggal.getTime())) return "";
  return tanggal.toLocaleString("id-ID", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Sisa hari menuju tenggat. null bila tanggalnya tidak diketahui. */
function hitungSisaHari(nilai) {
  if (!nilai) return null;
  const tanggal = nilai instanceof Date ? nilai : new Date(nilai);
  if (Number.isNaN(tanggal.getTime())) return null;
  return Math.ceil((tanggal.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
}

/** Daftar kelas yang sedang berlaku - dipakai portal dan skrip pemeriksaan. */
function listClasses(runtimeConfig = readRuntimeConfig()) {
  return loadClasses(runtimeConfig).map((item) => ({ ...item }));
}

module.exports = {
  DEFAULT_DOCUMENT_CLASSES,
  FALLBACK_CLASS,
  SKIP_REASONS,
  buildMessage,
  formatTanggalIndonesia,
  hitungSisaHari,
  classifyDocument,
  decide,
  listClasses,
  opposingRole,
};
