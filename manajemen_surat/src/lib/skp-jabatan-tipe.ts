/**
 * ============================================================================
 * SKP JABATAN PERKARA - KONTRAK BEKU ANTARA BOT, DOMAIN, SERVER, DAN LAYAR
 * ============================================================================
 *
 * Rancangan disetujui pengguna 17 Oktober 2026: SKP bulanan/triwulan/tahunan
 * untuk Ketua, Wakil Ketua, Panitera, Panmud, PP, Jurusita, Petugas Meja,
 * Kasir, dan Operator dibaca dari SIPP (format Permen PANRB 6/2022: RHK +
 * indikator Kuantitas/Kualitas/Waktu), lalu dilengkapi isian manual bila SIPP
 * tidak mencatatnya. Empat agen bekerja paralel berpegang pada berkas ini:
 *
 *   A Bot       mengisi FaktaSkpJabatan (rute /sipp/skp-jabatan), hanya SELECT
 *   B Domain    lib/skp-jabatan-katalog.ts: RHK, aturan hitung, Lembar SKP
 *   C Server    pemetaan akun-pegawai-jabatan, bolehLihatSkp, isian, target
 *   D Layar     halaman /skp dan menu unduhan
 *
 * BERKAS INI HANYA TIPE (dan daftar konstanta kunci). Jangan diubah tanpa
 * kesepakatan keempat agen: bentuk di sini adalah perjanjian, bukan saran.
 *
 * ATURAN DATA (sama dengan eviden-skp-tipe.ts):
 *   - Tanggal ISO "YYYY-MM-DD" (tanggal SIPP apa adanya, tanpa zona).
 *   - Kosong/tidak terbaca = null, BUKAN "" atau 0. Penyebut nol ditampilkan
 *     "—", nilai tak terbaca (null) TIDAK PERNAH menjadi 0.
 *   - Bot hanya mengirim FAKTA per kejadian; aturan hitung (lulus/tidak,
 *     selisih hari, persen) tinggal di portal supaya hanya ada satu versi
 *     angka.
 */

import type { KunciPeriodeSkp, PeriodeSkp } from "@/lib/eviden-skp-tipe";

// ─── Jabatan dan jenis SKP ──────────────────────────────────────────────────

/**
 * Kunci jabatan SKP. Dua yang terakhir bersifat opsional (kerangka sama, grup
 * SIPP 650 dan 802); 900/901 (kepegawaian) sengaja dikecualikan.
 */
export const JABATAN_SKP = [
  "ketua",
  "wakil-ketua",
  "panitera",
  "panmud-hukum",
  "panmud-gugatan",
  "panmud-permohonan",
  "pp",
  "jurusita",
  "jurusita-pengganti",
  "petugas-meja",
  "kasir",
  "operator",
  "koordinator-delegasi",
  "informasi",
  // 20 Okt 2026 (eviden SKP semua peran): mediator, Sekretaris, Kasubag, Analis.
  "mediator",
  "sekretaris",
  "kasubag",
  "analis-perkara",
] as const;

export type JabatanSkp = (typeof JABATAN_SKP)[number];

export const LABEL_JABATAN_SKP: Record<JabatanSkp, string> = {
  ketua: "Ketua",
  "wakil-ketua": "Wakil Ketua",
  panitera: "Panitera",
  "panmud-hukum": "Panitera Muda Hukum",
  "panmud-gugatan": "Panitera Muda Gugatan",
  "panmud-permohonan": "Panitera Muda Permohonan",
  pp: "Panitera Pengganti",
  jurusita: "Jurusita",
  "jurusita-pengganti": "Jurusita Pengganti",
  "petugas-meja": "Petugas Meja",
  kasir: "Kasir",
  operator: "Operator",
  "koordinator-delegasi": "Koordinator Delegasi",
  informasi: "Petugas Informasi",
  mediator: "Mediator",
  sekretaris: "Sekretaris",
  kasubag: "Kepala Subbagian",
  "analis-perkara": "Analis Perkara Peradilan",
};

/**
 * Grup SIPP (sys_groups.groupid) -> jabatan. Dasar tebakan bot; pemetaan
 * akhir tetap dikonfirmasi di layar Pemetaan. Jurusita vs Jurusita Pengganti
 * dibedakan jurusita.jabatan (1 / 2), bukan grup (keduanya 600). Petugas
 * Meja dan Operator TIDAK punya grup: dipetakan manual.
 */
export const GRUP_SIPP_JABATAN: Readonly<Record<number, JabatanSkp>> = {
  10: "ketua", // dibedakan Ketua/Wakil lewat peran ALETA
  30: "panitera",
  430: "panmud-hukum",
  1000: "panmud-gugatan",
  1010: "panmud-permohonan",
  500: "pp",
  600: "jurusita",
  702: "kasir",
  650: "koordinator-delegasi",
  802: "informasi",
};

/**
 * Jenis SKP yang dapat diunduh/dilihat. "hakim" = SKP Hakim lama (rute lama
 * tidak berubah); "pimpinan" = SKP Hakim + RHK pimpinan (Ketua/Wakil);
 * selebihnya SKP jabatan perkara.
 */
export type JenisSkp = "hakim" | "pimpinan" | JabatanSkp;

/** Hanya Ketua/Wakil yang memilih antara "hakim" dan "pimpinan". */
export type JenisSkpPilihan = Extract<JenisSkp, "hakim" | "pimpinan">;

// ─── Periode ────────────────────────────────────────────────────────────────

/** Bulan: b01 = Januari ... b12 = Desember. */
export type KunciBulanSkp =
  | "b01" | "b02" | "b03" | "b04" | "b05" | "b06"
  | "b07" | "b08" | "b09" | "b10" | "b11" | "b12";

/**
 * KunciPeriodeSkp lama (tw1..tw4|tahun) DIPERLUAS bulan. eviden-skp-tipe.ts
 * tidak diubah di tahap 0 (perilaku lama utuh); agen Domain boleh melebarkan
 * tipe asalnya ke gabungan ini, dan tipe ini tetap sah.
 */
export type KunciPeriodeSkpJabatan = KunciPeriodeSkp | KunciBulanSkp;

/** Periode dengan kunci diperluas. `bulan` = 1 (bulanan), 3, atau 12. */
export type PeriodeSkpJabatan = Omit<PeriodeSkp, "kunci"> & {
  kunci: KunciPeriodeSkpJabatan;
};

// ─── Fakta bot -> portal (GET /sipp/skp-jabatan) ────────────────────────────

/**
 * Satu kejadian yang dihitung sebuah indikator: satu perkara/transaksi/relaas.
 * Bot mengisi apa yang terbaca; ruang yang tidak relevan = null.
 */
export type KejadianSkp = {
  /** ID perkara SIPP bila kejadian terkait perkara; null untuk yang tidak. */
  perkaraId: string | null;
  nomorPerkara: string | null;
  /** Tanggal kejadian (mis. tanggal penetapan, relaas, putusan). */
  tanggal: string | null;
  /**
   * Tanggal pembanding untuk aspek Waktu (mis. tanggal pendaftaran, sidang,
   * BHT); portal menghitung selisih. null = tidak terbaca.
   */
  tanggalAcuan: string | null;
  /** Besaran bila kejadiannya bernilai (rupiah, jumlah); null bila tidak. */
  nilai: number | null;
  /** Keterangan pendek untuk baris bukti ("Pemberitahuan putusan", dsb.). */
  keterangan: string | null;
};

/** Fakta satu indikator untuk satu akun pada satu periode. */
export type FaktaIndikatorSkp = {
  /** Kunci indikator; sama dengan kunci di katalog domain (diuji selaras). */
  kunci: string;
  /** false = bagian SIPP yang melandasinya tidak terbaca; kejadian kosong bukan 0. */
  terbaca: boolean;
  kejadian: KejadianSkp[];
  /** Frasa untuk pembaca bila tidak terbaca; galat MySQL mentah tidak masuk. */
  galat: string | null;
};

/**
 * Nama "akun" tiruan yang memuat fakta dari catatan sistem (e-Court, surat,
 * aplikasi pengadilan) yang dibaca portal, berdampingan dengan akun SIPP asli.
 * Bukan username SIPP: tidak pernah dikirim ke bot dan tidak dipotong menurut
 * jendela berlaku akun.
 */
export const USERNAME_SISTEM = "__sistem__";

/** Fakta satu akun SIPP. */
export type FaktaAkunSkp = {
  /** sys_users.username */
  username: string;
  /** sys_users.userid sebagai teks. */
  userIdSipp: string;
  nama: string;
  /** groupid dari sys_user_group. */
  grup: number[];
  /** Tebakan jabatan dari grup; null bila tak dikenali. */
  jabatanDugaan: JabatanSkp | null;
  /** Akun masih aktif di SIPP. false = tak aktif (mis. akun lama). */
  aktif: boolean;
  fakta: FaktaIndikatorSkp[];
};

/** Jawaban rute bot /sipp/skp-jabatan. */
export type DataSkpJabatan = {
  ok: true;
  periode: PeriodeSkpJabatan;
  /** Jabatan yang diminta (menyaring akun); null = semua. */
  jabatan: JabatanSkp | null;
  akun: FaktaAkunSkp[];
  /** Untuk PEMBACA dokumen (tercetak). */
  catatan: string[];
  /** Untuk PETUGAS saja (konfigurasi SIPP yang perlu dibetulkan); tidak tercetak. */
  catatanOperator?: string[];
  /** Bagian SIPP yang tidak terbaca, sebagai frasa untuk pembaca. */
  galat: string[];
  dihitungPada: string;
};

// ─── RHK dan indikator (hasil hitung domain) ────────────────────────────────

export type AspekSkp = "Kuantitas" | "Kualitas" | "Waktu";

/**
 * Asal angka: "sipp" (dari SIPP), "sistem" (catatan e-Court dan aplikasi
 * pengadilan, bukan SIPP), "isian" (manual), "gabungan" (SIPP/sistem + isian).
 */
export type SumberSkp = "sipp" | "sistem" | "isian" | "gabungan";

/** Usulan = konstanta kode ALETA (SKP_JABATAN_2026); disahkan = salinan e-Kinerja. */
export type StatusTargetSkp = "usulan" | "disahkan";

export type IndikatorSkp = {
  /** Kunci indikator (sama dengan FaktaIndikatorSkp.kunci). */
  kunci: string;
  aspek: AspekSkp;
  /** Bunyi indikator kinerja individu. */
  teks: string;
  /** "Perkara", "%", "Hari", "Bulan", "Rp" ... */
  satuan: string;
  /** Target numerik; null = belum ada target. */
  target: number | null;
  /** "100%" / "≤ 7 hari" - bentuk tampil target. */
  targetTeks: string;
  /** Realisasi numerik; null = tidak terhitung (tampil "—"). */
  realisasi: number | null;
  realisasiTeks: string;
  /** Pembilang dan penyebut; penyebut 0 atau null -> realisasi null. */
  pembilang: number | null;
  penyebut: number | null;
  sumber: SumberSkp;
  /** Dasar hitung dalam kalimat ("107 dari 263 putusan diberitahukan <= 7 hari"). */
  dasar: string;
  /** Catatan tampil ("dari SIPP" / "isian" dijelaskan di sini bila perlu). */
  catatan: string[];
  statusTarget: StatusTargetSkp;
};

export type RhkSkp = {
  kunci: string;
  /** Bunyi Rencana Hasil Kerja. */
  teks: string;
  /** RHK tambahan (tugas PP bagi yang rangkap) dapat dimatikan. */
  tambahan: boolean;
  indikator: IndikatorSkp[];
};

/** Satu Lembar SKP per orang, jabatan, dan periode. */
export type LembarSkp = {
  jenis: JenisSkp;
  periode: PeriodeSkpJabatan;
  pegawai: PegawaiSkp;
  /** Pejabat penilai (tanda tangan kanan). */
  pejabatPenilai: { nama: string; nip: string | null; jabatan: string } | null;
  rhk: RhkSkp[];
  /** Perilaku kerja (Permen PANRB 6/2022). */
  perilakuKerja: string[];
  /** Blok tugas PP bagi yang rangkap; dapat dimatikan pengguna. */
  blokTambahan: RhkSkp[];
  catatan: string[];
  galat: string[];
  dihitungPada: string;
};

// ─── Pegawai, pemetaan akun, dan hak ────────────────────────────────────────

export type PegawaiSkp = {
  /** ID pengguna ALETA. */
  userId: string;
  nama: string;
  nip: string | null;
  /** Dari employee_profiles.rank_grade. */
  pangkatGolongan: string | null;
  jabatanUtama: JabatanSkp | null;
  jabatanTambahan: JabatanSkp[];
};

/** Baris aleta_skp_akun_pegawai: satu akun SIPP ditautkan ke satu pegawai bertanggal. */
export type PemetaanAkunPegawaiSkp = {
  id: string;
  usernameSipp: string;
  userIdSipp: string;
  /** Pengguna ALETA. */
  userId: string;
  jabatanUtama: JabatanSkp | null;
  jabatanTambahan: JabatanSkp[];
  /** ISO "YYYY-MM-DD"; berlakuSampai null = masih berlaku. */
  berlakuDari: string;
  berlakuSampai: string | null;
  dikonfirmasiOlehId: string | null;
  dikonfirmasiPada: string | null;
};

/** Peran ALETA yang menentukan hak lihat SKP. */
export type PeranAktorSkp =
  | "super-admin"
  | "admin"
  | "ketua"
  | "wakil-ketua"
  | "panitera"
  | "lainnya";

export type AktorSkp = {
  userId: string;
  peran: PeranAktorSkp;
};

/** Mengapa seseorang boleh (atau tidak) melihat SKP seorang pegawai. */
export type AlasanHakSkp =
  | "sendiri"
  | "atasan-langsung"
  | "ketua"
  | "wakil-ketua"
  | "panitera"
  | "super-admin"
  | "admin"
  | "ditolak";

/**
 * Hasil bolehLihatSkp(aktor, pegawai). Urutan pemeriksaan: sendiri (lewat
 * tautan akun) -> atasan langsung (employee_profiles.supervisor_employee_id)
 * -> Ketua/Wakil/Panitera semua -> Super Admin/Admin semua. Wakil Ketua LIHAT
 * SAJA; Ketua dan Panitera lihat semua tanpa hak ubah isian orang lain
 * (bolehUbahIsian hanya pemilik; target diubah Panitera dan Ketua).
 */
export type HasilBolehLihatSkp = {
  boleh: boolean;
  alasan: AlasanHakSkp;
  /** Mengisi/mengajukan isian manual pegawai itu (hanya dirinya sendiri). */
  bolehUbahIsian: boolean;
  /** Mengubah target dan memetakan akun (Panitera, Ketua, Super Admin, Admin). */
  bolehUbahTarget: boolean;
};

// ─── Target, isian manual, penetapan (baris penyimpanan) ────────────────────

/** Baris aleta_skp_target. */
export type TargetSkpJabatan = {
  id: string;
  jabatan: JabatanSkp;
  tahun: number;
  kunciRhk: string;
  kunciIndikator: string;
  targetNilai: number | null;
  targetTeks: string;
  satuan: string;
  status: StatusTargetSkp;
  diubahOlehId: string;
  diubahPada: string;
};

export type StatusIsianSkp = "draf" | "diajukan" | "disetujui";

export type BuktiIsianSkp = {
  /** Nama berkas atau judul bukti. */
  judul: string;
  /** Tautan/tanda pengenal berkas bila diunggah; null bila hanya keterangan. */
  rujukan: string | null;
  tanggal: string | null;
};

/** Baris aleta_skp_isian: indikator yang tidak terbaca dari SIPP. */
export type IsianManualSkp = {
  id: string;
  userId: string;
  periode: KunciPeriodeSkpJabatan;
  tahun: number;
  kunciRhk: string;
  kunciIndikator: string;
  nilai: number | null;
  nilaiTeks: string;
  catatan: string;
  bukti: BuktiIsianSkp[];
  status: StatusIsianSkp;
  diisiOlehId: string;
  diajukanPada: string | null;
  ditinjauOlehId: string | null;
  ditinjauPada: string | null;
  catatanTinjauan: string;
  dibuatPada: string;
  diperbaruiPada: string;
};

export type StatusPenetapanSkp = "draf" | "terkunci";

/** Baris aleta_skp_penetapan: tangkapan LembarSkp yang dikunci (tidak berubah lagi). */
export type PenetapanSkp = {
  id: string;
  userId: string;
  jenis: JenisSkp;
  periode: KunciPeriodeSkpJabatan;
  tahun: number;
  tangkapan: LembarSkp;
  dihitungPada: string;
  pejabatPenilaiId: string;
  pejabatPenilaiNama: string;
  status: StatusPenetapanSkp;
  dikunciOlehId: string | null;
  dikunciPada: string | null;
  dibuatPada: string;
};
