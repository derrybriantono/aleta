/**
 * ============================================================================
 * TANGGAL KTP PIHAK - BAHASA LAYAR (12 Okt 2026, butir 8 dan 11)
 * ============================================================================
 *
 * Satu sumber untuk kalimat dan pencocokan yang dipakai Status Perkara (bagian
 * Para pihak) dan layar Integrasi e-Court (histori): kode sebab -> kalimat,
 * keyakinan -> kalimat, dan pencocokan baris KTP ke nama pihak di daftar Status.
 *
 * MURNI. NIK tidak pernah ada di sini - rute ktp-pihak tidak mengirimkannya.
 */

export type KtpPihakBaris = {
  cabang: number;
  urutan: number;
  peran: string;
  /** Nama pada KTP (hasil baca). */
  nama: string;
  /** Nama pihak di SIPP - ada pada bot baru; kosong pada bot lama. */
  namaSipp?: string;
  tanggalKtp: string;
  tanggalKtpIso: string;
  kota: string;
  yakin: "pasti" | "cukup" | "ragu" | "";
  cocok: string;
  sebab: string;
  sumberBaca: string;
  fileId: string;
};

export type KtpPihakStatusData = {
  ada: boolean;
  nomorPerkara?: string;
  pihak: KtpPihakBaris[];
  dokumenKtp?: number;
  belumDibaca?: number;
  tidakTerbaca?: number;
  takBertuan?: number;
  sedangDibaca?: boolean;
  catatan?: string[];
  sebab?: string;
};

export type PihakDaftarStatus = { nama: string; pihakKe: number | null; jenis: string };

const SEBAB_KTP: Record<string, string> = {
  ocr_belum_tersedia: "mesin OCR belum terpasang di server",
  ocr_gagal: "OCR gagal membaca berkas",
  ocr_habis_waktu: "OCR kehabisan waktu",
  tidak_ada_label_ktp: "tidak ditemukan label KTP pada berkas",
  pdf_rusak: "PDF rusak",
  pdf_tanpa_kanvas: "PDF tidak dapat digambar untuk OCR",
  berkas_terlalu_besar: "berkas terlalu besar",
  berkas_tidak_terambil: "berkas tidak terambil dari arsip bot",
  galat_baca: "gagal saat membaca",
  bukan_berkas_ktp: "berkas bukan KTP",
  tidak_terbaca: "tidak terbaca",
  tanggal_ktp_tidak_terbaca: "tanggal KTP tidak terbaca",
  pihak_ambigu: "cocok dengan lebih dari satu pihak",
  tidak_cocok_pihak: "tidak cocok dengan pihak mana pun di SIPP",
  hanya_nama_cocok: "hanya nama yang cocok",
  nik_tidak_sah: "NIK tidak sah",
  tanggal_terlalu_lama: "tanggal terlalu lama",
  tanggal_di_masa_depan: "tanggal di masa depan",
  sesudah_perkara_didaftarkan: "tanggal sesudah perkara didaftarkan",
  sebelum_umur_14: "tanggal sebelum pihak berumur 14 tahun",
  tanggal_kosong: "tanggal kosong",
};

/** Kode sebab -> kalimat. Kode yang tidak dikenal ditampilkan apa adanya (bukan disembunyikan). */
export function teksSebabKtp(sebab: string): string {
  const s = String(sebab || "").trim();
  if (!s) return "";
  const ulang = /^bacaan_ulang_gagal:\s*(.+)$/.exec(s);
  if (ulang) return `bacaan ulang gagal (${teksSebabKtp(ulang[1])}); tanggal lama dipertahankan`;
  return SEBAB_KTP[s] ?? s.replace(/_/g, " ");
}

export function teksYakinKtp(yakin: string): string {
  if (yakin === "pasti") return "pasti";
  if (yakin === "cukup") return "cukup yakin";
  if (yakin === "ragu") return "ragu - periksa";
  return "";
}

const TEKS_COCOK: Record<string, string> = {
  nik: "NIK sama dengan data SIPP",
  nama_lahir: "nama dan tanggal lahir sama",
  nama_nik: "nama sama, NIK nyaris sama",
  nama: "hanya nama yang sama",
};
export function teksCocokKtp(cocok: string): string {
  return TEKS_COCOK[cocok] ?? "";
}

const TEKS_SUMBER: Record<string, string> = { "teks-pdf": "teks PDF", ocr: "OCR foto", "ocr-pdf": "OCR pindaian" };
export function teksSumberBacaKtp(sumber: string): string {
  return TEKS_SUMBER[sumber] ?? "";
}

export const TEKS_PEMICU_KTP: Record<string, string> = {
  latar: "penyapu latar",
  panel: "panel ABT",
  manual: "tombol Admin",
  salinan: "salinan berkas sama",
};

function baku(nama: string) {
  return String(nama || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Baris KTP milik satu orang pada daftar Status Perkara. Hanya pihak (bukan kuasa/saksi)
 * pada cabang 1-4.
 *
 * Urutan pencocokan, yang lebih pasti menang:
 *   1. nama pihak SIPP yang dikirim bot (namaSipp) sama dengan nama di daftar;
 *   2. (bot lama) nama pada KTP sama dengan nama di daftar;
 *   3. satu-satunya pihak pada cabangnya dan satu-satunya KTP pada cabang itu;
 *   4. dua-duanya tidak pasti -> null (lebih baik "belum ada" daripada tanggal milik orang lain).
 */
export function cariKtpUntukPihak(
  orang: PihakDaftarStatus,
  semuaPihak: PihakDaftarStatus[],
  ktp: KtpPihakBaris[]
): KtpPihakBaris | null {
  if (orang.jenis === "kuasa") return null;
  const cabang = orang.pihakKe;
  if (cabang == null || cabang < 1 || cabang > 4) return null;
  const calon = ktp.filter((k) => k.cabang === cabang);
  if (calon.length === 0) return null;
  const nama = baku(orang.nama);
  const dariSipp = calon.find((k) => k.namaSipp && baku(k.namaSipp) === nama);
  if (dariSipp) return dariSipp;
  // Bot baru mengirim namaSipp: tak ada yang sama berarti memang bukan orang ini.
  if (calon.every((k) => k.namaSipp)) return null;
  const dariKtp = calon.find((k) => !k.namaSipp && baku(k.nama) === nama);
  if (dariKtp) return dariKtp;
  const sepihak = semuaPihak.filter((p) => p.jenis !== "kuasa" && p.pihakKe === cabang);
  if (sepihak.length === 1 && calon.length === 1) return calon[0];
  return null;
}

/** Kalimat keadaan perkara bila tak satu pun pihak punya tanggal KTP (dipakai Status Perkara dan rute ktp-pihak). */
export function catatanKtpPerkara(d: Pick<KtpPihakStatusData, "ada" | "dokumenKtp" | "belumDibaca" | "tidakTerbaca" | "takBertuan">, sedangDibaca: boolean): string[] {
  const catatan: string[] = [];
  if ((d.dokumenKtp ?? 0) === 0) catatan.push("Tidak ada dokumen KTP di arsip e-Court perkara ini.");
  else if (!d.ada) {
    const belum = d.belumDibaca ?? 0;
    if (belum > 0) {
      catatan.push(
        sedangDibaca
          ? `${belum} berkas KTP e-Court sedang/akan dibaca ALETA di latar - buka lagi sebentar lagi.`
          : `${belum} berkas KTP e-Court belum terbaca.`
      );
    } else if ((d.tidakTerbaca ?? 0) > 0) catatan.push(`${d.tidakTerbaca} berkas KTP e-Court tidak terbaca (OCR/berkas) - tanggal diketik petugas.`);
    else if ((d.takBertuan ?? 0) > 0) catatan.push("KTP terbaca, tetapi NIK/namanya tidak cocok dengan pihak mana pun di SIPP - periksa.");
    else catatan.push("Berkas KTP e-Court perkara ini belum diunduh ALETA (atau tidak disediakan e-Court).");
  }
  return catatan;
}

/** Keterangan singkat untuk SATU pihak yang tanggalnya belum ada. */
export function keteranganTanpaKtp(d: KtpPihakStatusData): string {
  if ((d.dokumenKtp ?? 0) === 0) return "tidak ada berkas KTP di arsip e-Court";
  if (d.ada) return "KTP pihak ini belum terbaca atau belum cocok dengan pihak ini";
  if ((d.belumDibaca ?? 0) > 0) return d.sedangDibaca ? "berkas KTP sedang dibaca" : "berkas KTP belum dibaca";
  if ((d.tidakTerbaca ?? 0) > 0) return "berkas KTP tidak terbaca - tanggal diketik petugas";
  if ((d.takBertuan ?? 0) > 0) return "KTP terbaca tetapi tidak cocok dengan pihak mana pun";
  return "berkas KTP belum diunduh";
}

// ---------------------------------------------------------------------------
// Bentuk jawaban histori (bot -> portal -> layar Integrasi e-Court)
// ---------------------------------------------------------------------------

export type HasilPihakRiwayat = {
  peran: string;
  cabang: number | null;
  urutan: number | null;
  tanggalKtp: string;
  yakin: string;
  cocok: string;
  sebab: string;
};

export type RingkasanKtpPihak = {
  perkara: number;
  berkas: number;
  terbaca: number;
  tidakTerbaca: number;
  bukanKtp: number;
  belumDibaca: number;
  pihakBertanggal: number;
  terakhirDibaca: string;
  percobaanTercatat: number;
};

export type PerkaraKtpRingkas = {
  nomorPerkara: string;
  perkaraId: number | null;
  berkas: number;
  terbaca: number;
  gagal: number;
  pihakBertanggal: number;
  terakhirDibaca: string;
};

export type BerkasKtpRiwayat = {
  fileId: string;
  judul: string;
  format: string;
  status: string;
  sebab: string;
  percobaan: number;
  sumberBaca: string;
  versi: number;
  dibacaPada: string;
  pihak: HasilPihakRiwayat[];
};

export type PercobaanKtpRiwayat = {
  waktu: string;
  fileId: string;
  pemicu: string;
  status: string;
  sebab: string;
  percobaan: number;
  sumberBaca: string;
  jumlahKtp: number;
  hasil: HasilPihakRiwayat[];
};

export type RiwayatPerkaraKtp = {
  ok: boolean;
  nomorPerkara: string;
  dokumenKtp: number;
  berkas: BerkasKtpRiwayat[];
  belumDibaca: Array<{ fileId: string; judul: string; format: string }>;
  percobaan: PercobaanKtpRiwayat[];
};
