/**
 * Kamus variabel isi pesan ALETA Bot.
 *
 * Saat mengedit isi pesan, admin sebelumnya hanya melihat nama variabel mentah
 * seperti `{{ringkasan}}` tanpa penjelasan apa pun: tidak jelas apa isinya, dari
 * mana datanya, dan seperti apa hasilnya di layar penerima. Akibatnya variabel
 * mudah dipasang di tempat yang salah dan pesan yang terkirim jadi rancu.
 *
 * Berkas ini menjadi satu sumber penjelasan untuk seluruh portal: label yang
 * enak dibaca, keterangan singkat untuk daftar pilihan, keterangan panjang saat
 * variabel dibuka, asal datanya, dan contoh hasil aslinya.
 */

export type AletaBotVariableCategory = "identitas" | "perkara" | "jadwal" | "biaya" | "surat" | "sistem";

export type AletaBotVariableDoc = {
  /** Nama variabel tanpa kurung kurawal, mis. "nomor_perkara". */
  key: string;
  /** Label untuk manusia, mis. "Nomor Perkara". */
  label: string;
  /** Satu kalimat pendek untuk ditampilkan di daftar pilihan variabel. */
  shortDescription: string;
  /** Penjelasan lengkap yang muncul saat variabel diklik. */
  description: string;
  /** Dari mana nilainya diambil. */
  source: string;
  /** Contoh nilai nyata seperti yang akan dibaca penerima. */
  example: string;
  category: AletaBotVariableCategory;
  /** Untuk siapa variabel ini biasanya dipakai. */
  audience: "pihak" | "pegawai" | "umum";
};

const VARIABLE_DOCS: AletaBotVariableDoc[] = [
  {
    key: "nama_pihak",
    label: "Nama Pihak",
    shortDescription: "Nama pihak berperkara yang menerima pesan.",
    description:
      "Nama lengkap pihak berperkara (penggugat, tergugat, pemohon, atau termohon) sesuai data perkara di SIPP. Dipakai untuk menyapa penerima di awal pesan agar jelas pesan ini ditujukan kepada siapa.",
    source: "Kolom nama_pihak atau nama pada sumber data; bila kosong dipakai nama penerima hasil pencocokan nomor WhatsApp.",
    example: "Risna binti Irsan",
    category: "identitas",
    audience: "pihak",
  },
  {
    key: "nama_pegawai",
    label: "Nama Pegawai",
    shortDescription: "Nama pegawai penerima pesan internal.",
    description:
      "Nama pegawai pengadilan yang menerima notifikasi internal. Diambil dari data pengguna portal yang nomor WhatsApp-nya terdaftar, bukan dari data perkara.",
    source: "Daftar penerima pegawai di portal (nama pengguna ALETA).",
    example: "Ahmad Fauzi, S.H.",
    category: "identitas",
    audience: "pegawai",
  },
  {
    key: "jabatan",
    label: "Jabatan",
    shortDescription: "Jabatan pegawai penerima, mis. Hakim atau Panitera.",
    description:
      "Jabatan pegawai penerima pesan, ditulis rapi dengan huruf kapital di awal kata. Dipakai bersama nama pegawai di awal pesan internal supaya penerima langsung tahu pesan ini menyangkut perannya. Bila jabatan tidak diketahui, otomatis terisi \"Pegawai\" sehingga pesan tidak pernah gagal terkirim.",
    source: "Jabatan atau peran pengguna di portal ALETA.",
    example: "Hakim",
    category: "identitas",
    audience: "pegawai",
  },
  {
    key: "nomor_perkara",
    label: "Nomor Perkara",
    shortDescription: "Nomor perkara lengkap sesuai SIPP.",
    description:
      "Nomor perkara lengkap beserta jenis, tahun, dan kode satker. Selalu sertakan pada pesan yang menyangkut satu perkara tertentu agar penerima dapat mencocokkan dengan berkasnya.",
    source: "Kolom nomor_perkara pada sumber data SIPP.",
    example: "531/Pdt.G/2026/PA.Dgl",
    category: "perkara",
    audience: "pihak",
  },
  {
    key: "ringkasan",
    label: "Ringkasan Data",
    shortDescription: "Isi utama pesan: rincian data hasil sumber data.",
    description:
      "Bagian inti pesan. Bila sumber data menyediakan kolom ringkasan/keterangan, isinya dipakai apa adanya. Bila tidak, ALETA menyusunnya otomatis dari baris data dengan label berbahasa Indonesia (misalnya \"Tanggal Sidang: 8 September 2026\") — nama kolom mentah tidak pernah ditampilkan ke penerima. Nama dan nomor perkara sengaja tidak diulang di sini karena biasanya sudah dicetak di bagian atas pesan.",
    source: "Kolom ringkasan, keterangan, detail, atau informasi pada sumber data; bila tidak ada, disusun otomatis dari seluruh kolom baris tersebut.",
    example: "Tanggal Sidang: 8 September 2026\nAgenda: Sidang Pertama\nRuang Sidang: Ruang Sidang 1",
    category: "perkara",
    audience: "umum",
  },
  {
    key: "judul_notifikasi",
    label: "Judul Notifikasi",
    shortDescription: "Nama notifikasi yang sedang dikirim.",
    description:
      "Nama notifikasi seperti yang tertulis di daftar notifikasi portal. Berguna sebagai judul singkat di dalam pesan internal supaya pegawai tahu jenis pengingat yang diterimanya.",
    source: "Nama notifikasi pada pengaturan notifikasi portal.",
    example: "Pengingat Kasir Harian",
    category: "sistem",
    audience: "pegawai",
  },
  {
    key: "tanggal_sidang",
    label: "Tanggal Sidang",
    shortDescription: "Tanggal sidang, ditulis dalam format Indonesia.",
    description:
      "Tanggal pelaksanaan sidang. Nilai tanggal otomatis dirapikan menjadi bentuk yang wajar dibaca (\"8 September 2026\"), bukan format mesin seperti 2026-09-08.",
    source: "Kolom tanggal_sidang pada sumber data SIPP.",
    example: "8 September 2026",
    category: "jadwal",
    audience: "pihak",
  },
  {
    key: "hari_sidang",
    label: "Hari Sidang",
    shortDescription: "Nama hari pelaksanaan sidang.",
    description: "Nama hari sidang, biasanya dipasangkan dengan tanggal sidang agar penerima lebih mudah mengingat jadwalnya.",
    source: "Kolom hari_sidang pada sumber data SIPP.",
    example: "Selasa",
    category: "jadwal",
    audience: "pihak",
  },
  {
    key: "agenda",
    label: "Agenda Sidang",
    shortDescription: "Agenda yang akan dijalankan pada sidang tersebut.",
    description: "Agenda persidangan, misalnya sidang pertama, pembuktian, atau pembacaan putusan.",
    source: "Kolom agenda pada sumber data SIPP.",
    example: "Sidang Pertama",
    category: "jadwal",
    audience: "pihak",
  },
  {
    key: "persiapan_sidang",
    label: "Persiapan Sidang",
    shortDescription: "Daftar hal yang harus dibawa pihak, sesuai agenda sidangnya.",
    description:
      "Terjemahan agenda sidang menjadi daftar persiapan yang dapat dipahami orang awam. Agenda \"Pemeriksaan Saksi\" di SIPP tidak berarti apa-apa bagi pihak; variabel ini mengubahnya menjadi perintah yang jelas seperti membawa dua orang saksi beserta KTP mereka. Isinya menyesuaikan agenda secara otomatis, dan bila agendanya belum dikenali tetap muncul nasihat dasar sehingga isi pesan tidak pernah kosong. Kalimat-kalimatnya dapat diperbaiki panitera melalui pengaturan sidangAgendaGuide tanpa mengubah aplikasi.",
    source: "Diturunkan dari kolom agenda pada sumber data SIPP, memakai padanan agenda pada services/sidangAgendaService.js.",
    example:
      "Yang perlu Anda siapkan:\n- Bawa minimal 2 orang saksi dewasa yang mengetahui langsung keadaan rumah tangga Anda.\n- Saksi tidak boleh anak kandung Anda sendiri.\n- Bawa KTP asli masing-masing saksi.\n- Datang paling lambat 30 menit sebelum sidang untuk mendaftar di meja antrian.",
    category: "jadwal",
    audience: "pihak",
  },
  {
    key: "ruangan",
    label: "Ruang Sidang",
    shortDescription: "Ruang tempat sidang dilaksanakan.",
    description: "Nama atau nomor ruang sidang. Sertakan bila pihak perlu hadir secara langsung di gedung pengadilan.",
    source: "Kolom ruangan pada sumber data SIPP.",
    example: "Ruang Sidang 1 Dalam Gedung",
    category: "jadwal",
    audience: "pihak",
  },
  {
    key: "sisa_panjar",
    label: "Sisa Panjar",
    shortDescription: "Sisa atau kekurangan biaya panjar perkara.",
    description:
      "Nilai sisa panjar atau kekurangan biaya perkara. Karena menyangkut uang, pastikan isi pesan mengarahkan pihak membayar hanya melalui kasir atau PTSP resmi pengadilan.",
    source: "Kolom sisa_panjar pada sumber data keuangan perkara SIPP.",
    example: "Rp250.000",
    category: "biaya",
    audience: "pihak",
  },
  {
    key: "perihal",
    label: "Perihal Surat",
    shortDescription: "Perihal atau pokok isi surat.",
    description: "Perihal surat pada modul manajemen surat, dipakai pada notifikasi surat masuk dan pengingat disposisi.",
    source: "Kolom perihal pada data surat portal ALETA.",
    example: "Permohonan Data Kepegawaian",
    category: "surat",
    audience: "pegawai",
  },
  {
    key: "deadline",
    label: "Batas Waktu",
    shortDescription: "Batas waktu tindak lanjut disposisi.",
    description: "Tanggal batas tindak lanjut sebuah disposisi. Dipakai pada pengingat H-1 agar pegawai sempat menyelesaikannya.",
    source: "Kolom deadline_at pada data disposisi portal ALETA.",
    example: "23 Agustus 2026",
    category: "surat",
    audience: "pegawai",
  },
  {
    key: "instruksi",
    label: "Instruksi Disposisi",
    shortDescription: "Instruksi yang ditulis pemberi disposisi.",
    description: "Isi instruksi dari pimpinan pada sebuah disposisi surat.",
    source: "Kolom instruksi pada data disposisi portal ALETA.",
    example: "Mohon ditindaklanjuti dan dilaporkan hasilnya.",
    category: "surat",
    audience: "pegawai",
  },
  {
    key: "nomor_surat",
    label: "Nomor Surat",
    shortDescription: "Nomor surat pada modul manajemen surat.",
    description: "Nomor resmi surat masuk atau surat keluar di portal ALETA.",
    source: "Kolom nomor_surat pada data surat portal ALETA.",
    example: "W19-A12/123/HK.05/VIII/2026",
    category: "surat",
    audience: "pegawai",
  },
  {
    key: "recipient_name",
    label: "Nama Penerima",
    shortDescription: "Nama penerima pesan secara umum.",
    description:
      "Nama penerima pesan tanpa membedakan pihak atau pegawai. Dipakai pada isi pesan modul manajemen surat. Untuk notifikasi perkara, lebih tepat memakai Nama Pihak atau Nama Pegawai.",
    source: "Data penerima pada notifikasi yang bersangkutan.",
    example: "Ahmad Fauzi, S.H.",
    category: "identitas",
    audience: "umum",
  },
  {
    key: "waktu",
    label: "Waktu Kirim",
    shortDescription: "Tanggal dan jam saat pesan disusun.",
    description:
      "Waktu ketika pesan disusun oleh sistem, lengkap dengan tanggal dan jam. Berguna pada laporan berkala agar penerima tahu data ini per kapan.",
    source: "Jam sistem server ALETA saat pesan dibuat.",
    example: "22/08/2026, 08.15.00",
    category: "sistem",
    audience: "umum",
  },
  {
    key: "mode",
    label: "Mode Pengiriman",
    shortDescription: "Menandai pesan uji coba atau pengiriman sungguhan.",
    description:
      "Menunjukkan apakah pesan berasal dari mode simulasi (dry-run) atau pengiriman sungguhan. Sebaiknya hanya dipakai pada isi pesan uji coba, jangan pada pesan untuk pihak berperkara.",
    source: "Status mode simulasi pada pengaturan ALETA Bot.",
    example: "live",
    category: "sistem",
    audience: "umum",
  },
];

const VARIABLE_DOC_MAP = new Map(VARIABLE_DOCS.map((item) => [item.key, item]));

export const ALETA_BOT_VARIABLE_CATEGORY_LABELS: Record<AletaBotVariableCategory, string> = {
  identitas: "Identitas Penerima",
  perkara: "Data Perkara",
  jadwal: "Jadwal Sidang",
  biaya: "Biaya Perkara",
  surat: "Surat & Disposisi",
  sistem: "Sistem",
};

/** Mengubah nama kolom apa pun menjadi label yang enak dibaca. */
export function humanizeVariableKey(key: string) {
  const raw = String(key || "").trim();
  if (!raw) return "";
  return raw
    .replace(/[_-]+/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .trim()
    .split(/\s+/)
    .map((word) => (word.length <= 2 ? word.toUpperCase() : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()))
    .join(" ");
}

/**
 * Penjelasan untuk satu variabel.
 *
 * Variabel yang tidak ada di kamus tetap mendapat penjelasan yang masuk akal —
 * biasanya itu kolom bebas dari sumber data buatan admin sendiri — sehingga
 * daftar pilihan tidak pernah menampilkan variabel tanpa keterangan.
 */
export function describeAletaBotVariable(key: string): AletaBotVariableDoc {
  const normalized = String(key || "").trim();
  const known = VARIABLE_DOC_MAP.get(normalized);
  if (known) return known;

  const label = humanizeVariableKey(normalized);
  return {
    key: normalized,
    label,
    shortDescription: `Kolom "${normalized}" dari sumber data.`,
    description:
      `Variabel ini bukan variabel bawaan ALETA, melainkan kolom bernama "${normalized}" yang dihasilkan sumber data notifikasi. ` +
      "Isinya mengikuti apa pun yang dikeluarkan kolom tersebut. Pastikan sumber data yang dipasangkan pada notifikasi benar-benar memuat kolom ini, karena bila tidak dipasok, pesan akan gagal disusun dan notifikasi dilewati.",
    source: `Kolom keluaran "${normalized}" pada sumber data yang dipasangkan ke notifikasi.`,
    example: `(mengikuti isi kolom ${normalized})`,
    category: "perkara",
    audience: "umum",
  };
}

/** Seluruh variabel bawaan, untuk daftar pilihan di editor isi pesan. */
export function listAletaBotVariableDocs(): AletaBotVariableDoc[] {
  return [...VARIABLE_DOCS];
}

/** Apakah variabel ini punya penjelasan resmi (bukan kolom bebas)? */
export function isKnownAletaBotVariable(key: string) {
  return VARIABLE_DOC_MAP.has(String(key || "").trim());
}
