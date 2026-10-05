/**
 * ============================================================================
 * KONTRAK TIPE KELUARAN - REGISTRI DAFTAR (K2), BENTUK ENTRI (K3), CERMIN (K10)
 * ============================================================================
 *
 * Kalimat dan pilihan keluaran PUTUSAN dan BAS dulu tertanam di tiga tempat
 * yang berjalan sendiri-sendiri - ekstensi, pustaka portal, dan bot - dan
 * sudah terukur berselisih: panel ekstensi menawarkan 9 alasan, bot mengenal
 * 13, dan dua alasan hilang dari kalimat tanpa satu pun galat.
 *
 * Berkas ini satu-satunya tempat yang menyebut DAFTAR apa saja yang ada. Daftar
 * yang tidak tercantum di sini DITOLAK dengan galat (400) - tidak pernah
 * dijawab kosong. Jawaban kosong untuk nama yang salah ketik adalah cara
 * paling sunyi untuk mematikan satu keluaran; pelajaran yang sama sudah tiga
 * kali dibayar pada daftar tabel SIPP.
 *
 * Berkas ini MURNI: tidak mengimpor apa pun dari peladen, sehingga dapat
 * dipakai rute, modul peladen, maupun komponen klien portal.
 */

export const GOLONGAN_TIPE = ["bas", "putusan", "bersama"] as const;
export type GolonganTipe = (typeof GOLONGAN_TIPE)[number];

/** 'tulis' = kalimat/pilihan yang DITULIS; 'deteksi' = pola yang MENGENALI. */
export type JenisDaftar = "tulis" | "deteksi";
export type PemakaiDaftar = "bot" | "portal" | "ekstensi";

/** Pemilik berkas cermin bawaan (K10) - lihat bawaan/. */
export type PemilikCermin =
  | "CERMIN_EKSTENSI"
  | "CERMIN_PORTAL"
  | "CERMIN_BAS_SAKSI"
  | "CERMIN_PUTUSAN_MEDAN"
  | "CERMIN_ALASAN";

/** Gerbang ukur bagi daftar berjenis 'deteksi' (K13). */
export type JenisUkur = "ciri" | "sebutan" | "padanan";

export type KetentuanDaftar = {
  /** Nomor urut di kontrak K2 - memudahkan merujuk ke dokumen rencana. */
  nomor: number;
  golongan: GolonganTipe;
  jenis: JenisDaftar;
  /** Runtime yang MEMAKAI daftar ini. */
  pemakai: readonly PemakaiDaftar[];
  judul: string;
  bentukKunci: string;
  bentukNilai: string;
  pemilikCermin: PemilikCermin;
  /** Rancangannya menerima tambahan tangan. */
  dapatDitambah: boolean;
  /**
   * atas_perintah WAJIB menunjuk pengguna berperan ketua/wakil-ketua/hakim
   * (PERAN_PENGACC). Berlaku untuk golongan bas/bersama dan kalimat putusan
   * (daftar 8 dan 9) - K13.
   */
  perintahHakim: boolean;
  /** Penanda yang sah di dalam nilai. Penanda lain ditolak. */
  penanda: readonly string[];
  /** Hanya untuk jenis 'deteksi': gerbang ukur yang harus lulus sebelum sah. */
  ukur: JenisUkur | null;
};

/**
 * Registri daftar (K2). URUTANNYA mengikuti kontrak dan tidak bermakna lain.
 *
 * Yang SENGAJA tidak ada di sini (K13): regex, PENANDA_MEDAN, HARAPAN_STATUS,
 * POLA_AMAR_BAKU, MODUS_SAKSI, lafal sumpah, dan PENUNJUK_SIMPAN_PUTUSAN. Semua
 * itu logika atau kalimat hukum yang tidak dibuka untuk entri tangan.
 */
export const DAFTAR_TIPE = {
  "bas.saksi.pembuka": {
    nomor: 1,
    golongan: "bas",
    jenis: "tulis",
    pemakai: ["bot"],
    judul: "Pembuka jawaban saksi",
    bentukKunci: "kosong ('')",
    bentukNilai: "pembuka 3-40 huruf yang diakhiri ', ' (mis. 'Ya, '); data {bobot, saksi?}",
    pemilikCermin: "CERMIN_BAS_SAKSI",
    dapatDitambah: true,
    perintahHakim: true,
    penanda: [],
    ukur: null,
  },
  "bas.saksi.ragam-kata": {
    nomor: 2,
    golongan: "bas",
    jenis: "tulis",
    pemakai: ["bot"],
    judul: "Ganti kata pada jawaban saksi",
    bentukKunci: "kosong ('')",
    bentukNilai: "kata polos <=30 huruf; data {ganti} polos; regex tidak pernah diterima",
    pemilikCermin: "CERMIN_BAS_SAKSI",
    dapatDitambah: true,
    perintahHakim: true,
    penanda: [],
    ukur: null,
  },
  "bas.saksi.jawaban-modus": {
    nomor: 3,
    golongan: "bas",
    jenis: "tulis",
    pemakai: ["bot"],
    judul: "Kalimat jawaban menurut modus saksi",
    bentukKunci: "'kelompok|modus' - hanya kombinasi yang punya cabang kode",
    bentukNilai: "templat 20-240 huruf dengan penanda {sumber}/{daftar}/{isi}/{jawab}",
    pemilikCermin: "CERMIN_BAS_SAKSI",
    dapatDitambah: true,
    perintahHakim: true,
    penanda: ["{sumber}", "{daftar}", "{isi}", "{jawab}"],
    ukur: null,
  },
  "bas.saksi.bentuk": {
    nomor: 4,
    golongan: "bas",
    jenis: "tulis",
    pemakai: ["bot", "portal"],
    judul: "Bentuk jawaban per pertanyaan",
    bentukKunci: "kunciTanya",
    bentukNilai:
      "varian berpenanda #0046#/#0047# dan {slot}; data {syarat:{jenisPerkaraId?, alur?}, asalKorpus:{kemunculan, perkara}}",
    pemilikCermin: "CERMIN_BAS_SAKSI",
    dapatDitambah: true,
    perintahHakim: true,
    penanda: ["#dddd#", "{slot}"],
    ukur: null,
  },
  "bas.saksi.profil": {
    nomor: 5,
    golongan: "bas",
    jenis: "tulis",
    pemakai: ["bot", "portal"],
    judul: "Profil ragam per pertanyaan",
    bentukKunci: "kunciTanya",
    bentukNilai: "nilai kosong (''); data {peluangRagam 0..1, rumusan}",
    pemilikCermin: "CERMIN_BAS_SAKSI",
    dapatDitambah: true,
    perintahHakim: true,
    penanda: [],
    ukur: null,
  },
  "bas.saksi.alasan-pilihan": {
    nomor: 6,
    golongan: "bas",
    jenis: "tulis",
    pemakai: ["ekstensi"],
    judul: "Pilihan alasan di panel keterangan saksi",
    bentukKunci: "kunci ciri alasan",
    bentukNilai: "label pilihan",
    pemilikCermin: "CERMIN_EKSTENSI",
    dapatDitambah: true,
    perintahHakim: true,
    penanda: [],
    ukur: null,
  },
  "bas.kehadiran.bunyi": {
    nomor: 7,
    golongan: "bas",
    jenis: "tulis",
    pemakai: ["portal"],
    judul: "Bunyi kehadiran pihak",
    bentukKunci: "kosong ('')",
    bentukNilai: "kalimat",
    pemilikCermin: "CERMIN_PORTAL",
    dapatDitambah: true,
    perintahHakim: true,
    penanda: [],
    ukur: null,
  },
  "bersama.alasan.frasa": {
    nomor: 8,
    golongan: "bersama",
    jenis: "tulis",
    pemakai: ["bot"],
    judul: "Frasa alasan perceraian",
    bentukKunci: "kunci ciri alasan",
    bentukNilai: "frasa berpenanda {pelaku}/{lawan}; data {urutan, akibat?, setara?[]}",
    pemilikCermin: "CERMIN_ALASAN",
    dapatDitambah: true,
    perintahHakim: true,
    penanda: ["{pelaku}", "{lawan}"],
    ukur: null,
  },
  "putusan.upaya-damai.bunyi": {
    nomor: 9,
    golongan: "putusan",
    jenis: "tulis",
    pemakai: ["bot"],
    judul: "Bunyi upaya damai",
    bentukKunci: "'gagal' | 'berhasil' | 'belum-ada'",
    bentukNilai: "kalimat berpenanda {pelaku}/{lawan}",
    pemilikCermin: "CERMIN_ALASAN",
    dapatDitambah: true,
    perintahHakim: true,
    penanda: ["{pelaku}", "{lawan}"],
    ukur: null,
  },
  "putusan.alasan.ciri": {
    nomor: 10,
    golongan: "putusan",
    jenis: "deteksi",
    pemakai: ["bot"],
    judul: "Ciri alasan perceraian (kata pemicu)",
    bentukKunci: "kunci ciri alasan",
    bentukNilai: "kata digabung ' + '; data {kata[]}",
    pemilikCermin: "CERMIN_ALASAN",
    dapatDitambah: true,
    perintahHakim: false,
    penanda: [],
    ukur: "ciri",
  },
  "putusan.sumber-hukum.sebutan": {
    nomor: 11,
    golongan: "putusan",
    jenis: "deteksi",
    pemakai: ["portal"],
    judul: "Sebutan sumber hukum",
    bentukKunci: "kunci sumber hukum",
    bentukNilai: "frasa sebutan",
    pemilikCermin: "CERMIN_PUTUSAN_MEDAN",
    dapatDitambah: true,
    perintahHakim: false,
    penanda: [],
    ukur: "sebutan",
  },
  "putusan.medan-borang": {
    nomor: 12,
    golongan: "putusan",
    jenis: "tulis",
    pemakai: ["ekstensi"],
    judul: "Medan blangko Putusan Akhir SIPP",
    bentukKunci: "'putusan-akhir'",
    bentukNilai:
      "label medan; data {penunjuk <=300 huruf berbentuk [name=...] atau #id, banyak?, pintu?}; penunjuk simpan/submit ditolak",
    pemilikCermin: "CERMIN_EKSTENSI",
    dapatDitambah: true,
    perintahHakim: false,
    penanda: [],
    ukur: null,
  },
  "putusan.bawaan-medan": {
    nomor: 13,
    golongan: "putusan",
    jenis: "tulis",
    pemakai: ["portal"],
    judul: "Nilai bawaan medan putusan",
    bentukKunci: "label medan",
    bentukNilai: "nilai bawaan; data {jenisPerkara: 'gugat'|'talak'|...}",
    pemilikCermin: "CERMIN_PUTUSAN_MEDAN",
    dapatDitambah: true,
    perintahHakim: false,
    penanda: [],
    ukur: null,
  },
  "putusan.peta-blangko": {
    nomor: 14,
    golongan: "putusan",
    jenis: "tulis",
    pemakai: ["ekstensi"],
    judul: "Peta jenis perkara ke blangko putusan ABT",
    bentukKunci: "kunci jenis baku (huruf kecil)",
    bentukNilai: "nama berkas blangko; data {jenisAsli, blangko?, blangkoLain?, catatan?}",
    pemilikCermin: "CERMIN_EKSTENSI",
    dapatDitambah: true,
    perintahHakim: false,
    penanda: [],
    ukur: null,
  },
  "putusan.padanan-jenis": {
    nomor: 15,
    golongan: "putusan",
    jenis: "deteksi",
    pemakai: ["ekstensi"],
    judul: "Padanan nama jenis perkara",
    bentukKunci: "kunci jenis baku",
    bentukNilai: "nama lain yang BENAR-BENAR ada di SIPP",
    pemilikCermin: "CERMIN_EKSTENSI",
    dapatDitambah: true,
    perintahHakim: false,
    penanda: [],
    ukur: "padanan",
  },
} as const satisfies Record<string, KetentuanDaftar>;

export type KunciDaftar = keyof typeof DAFTAR_TIPE;

export const KUNCI_DAFTAR = Object.keys(DAFTAR_TIPE) as KunciDaftar[];

/** Empat daftar yang dibaca ekstensi (K5), dalam urutan jawabannya. */
export const DAFTAR_EKSTENSI = [
  "putusan.medan-borang",
  "putusan.peta-blangko",
  "putusan.padanan-jenis",
  "bas.saksi.alasan-pilihan",
] as const satisfies readonly KunciDaftar[];

/** Daftar yang ditumpangkan portal ke bot (K6): semua yang dipakai bot. */
export const DAFTAR_BOT = KUNCI_DAFTAR.filter((k) =>
  (DAFTAR_TIPE[k].pemakai as readonly PemakaiDaftar[]).includes("bot")
);

export function adalahKunciDaftar(nilai: unknown): nilai is KunciDaftar {
  return typeof nilai === "string" && Object.prototype.hasOwnProperty.call(DAFTAR_TIPE, nilai);
}

export function ketentuanDaftar(daftar: KunciDaftar): KetentuanDaftar {
  return DAFTAR_TIPE[daftar];
}

/**
 * ============================================================================
 * ENTRI (K3) DAN CERMIN (K10)
 * ============================================================================
 *
 * 'cermin' dipakai HANYA ketika tabel tak terbaca dan keluaran jatuh ke cermin
 * kode - supaya pemakai dapat membedakan "bawaan dari basis data" dari "basis
 * data tidak terjangkau".
 */
export type AsalEntri = "bawaan" | "tambahan" | "cermin";

export type DataEntri = Record<string, unknown>;

export type EntriTipe = {
  kunci: string;
  nilai: string;
  data: DataEntri;
  urutan: number;
  asal: AsalEntri;
  sidik: string;
};

/** Satu entri cermin bawaan, disalin PERSIS dari sumbernya. */
export type EntriCermin = {
  kunci: string;
  nilai: string;
  data?: DataEntri;
  urutan: number;
};

/**
 * Cermin sebuah pemilik: hanya daftar miliknya. Partial - tiap berkas cermin
 * hanya memuat daftar yang ia miliki (K10).
 */
export type Cermin = Partial<Record<KunciDaftar, EntriCermin[]>>;

/**
 * ============================================================================
 * HASIL UKUR (K13) - GERBANG DAFTAR 'deteksi'
 * ============================================================================
 *
 * Aturan deteksi hasil tebakan sudah tiga kali salah di repo ini. Karena itu
 * daftar berjenis 'deteksi' baru dapat disahkan sesudah diukur, dan ambangnya
 * ditulis di sini - satu tempat bagi peladen (penjagaan) dan layar (tanda
 * "butuh ukur").
 */
export type HasilUkur =
  | {
      jenis: "ciri";
      /** Banyak contoh kalimat yang tertangkap dan diperiksa pengesah. */
      contoh: number;
      /** Contoh yang DITANDAI SALAH oleh pengesah. */
      salah: number;
      diukurPada?: string;
    }
  | {
      jenis: "sebutan";
      sampel: number;
      /** Sama persis dengan sumber hukum sungguhan, sebelum dan sesudah calon. */
      samaSebelum: number;
      samaSesudah: number;
      /** Salah yang BARU muncul karena calon. */
      salahTambahan: number;
      diukurPada?: string;
    }
  | {
      jenis: "padanan";
      /** Nama lain itu terbaca di perkara.jenis_perkara_nama SIPP. */
      adaDiSipp: boolean;
      jumlahPerkara?: number;
      diukurPada?: string;
    };

export const AMBANG_UKUR = {
  ciri: { minimumContoh: 20, maksimumSalah: 0.1 },
  sebutan: { minimumSampel: 300, maksimumSalahTambahan: 0.02 },
  padanan: {},
} as const;

/** Batas yang disaring bot (K6); portal menolaknya lebih dulu. */
export const BATAS_DAFTAR = {
  entriPerDaftar: 200,
  hurufNilai: 400,
} as const;
