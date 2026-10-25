import { BAGIAN_FITUR_EKSTENSI } from "@/lib/daftar-fitur-ekstensi";
import { KODE_FITUR_HURUF_BELAJAR } from "@/lib/huruf-alasan-belajar";
import { KODE_FITUR_ISIAN_SEKALI } from "@/lib/isian-sekali";
import { KODE_FITUR_ISIAN_SIDANG } from "@/lib/isian-sidang";
import { KODE_FITUR_JEJAK_ISIAN } from "@/lib/jejak-isian";
import { KODE_FITUR_KETEPATAN_ISIAN } from "@/lib/ketepatan-isian";
import { KODE_FITUR_WAJIB_CETAK } from "@/lib/wajib-cetak";

/**
 * ============================================================================
 * SAKLAR FITUR PER SATKER - ATURAN MURNI (banyak satker, Tahap 0)
 * ============================================================================
 *
 * ALETA akan dipakai banyak satker. Tiap fitur punya STATUS di satker itu:
 *
 *   stabil     menyala; rilis resmi
 *   uji-coba   menyala, ditandai "Uji coba"; HANYA bila satker berada di saluran
 *              pembaruan "uji-coba" (lib/kanal-pembaruan.ts). Di saluran stabil,
 *              fitur berstatus uji coba diperlakukan MATI.
 *   mati       tidak tersedia di satker ini
 *
 * Dibaca tiga pihak dari SATU sumber (server/modules/satker/fitur.ts):
 * portal (pastikanFiturMenyala), bot (aleta_bot/services/fiturSatkerService.js,
 * diisi portal saat disimpan) dan ekstensi (ruas fiturSatker pada rute "siapa").
 *
 * ============================================================================
 * BAWAAN: SEMUA YANG ADA SEKARANG MENYALA
 * ============================================================================
 *
 * Fitur yang sudah berjalan di Donggala berstatus bawaan "stabil". Pengaturan
 * yang belum pernah disimpan, tidak terbaca, atau rusak = semua menyala (gagal
 * ke sisi menyala): fitur lama tidak boleh berkurang karena sebuah galat baca.
 *
 * ============================================================================
 * PLAFON DARI PUSAT
 * ============================================================================
 *
 * Pusat (kelak) dapat membatasi satker: izin Pusat adalah PLAFON - pilihan
 * satker tidak dapat melampauinya (mati < uji-coba < stabil). Satker yang tidak
 * terhubung ke Pusat (izin kosong/null, seperti Donggala sekarang) tidak
 * dibatasi apa pun.
 */

export type StatusFitur = "stabil" | "uji-coba" | "mati";
export type SaluranSatker = "stabil" | "uji-coba";
export type BagianKatalog = "portal" | "bot" | "ekstensi";

export const STATUS_FITUR: readonly StatusFitur[] = ["stabil", "uji-coba", "mati"];
export const SALURAN_SATKER: readonly SaluranSatker[] = ["stabil", "uji-coba"];

export const LABEL_STATUS_FITUR: Readonly<Record<StatusFitur, string>> = {
  stabil: "Stabil",
  "uji-coba": "Uji coba",
  mati: "Mati",
};

export const LABEL_BAGIAN_KATALOG: Readonly<Record<BagianKatalog, string>> = {
  portal: "Portal",
  bot: "Bot",
  ekstensi: "Ekstensi",
};

export type FiturKatalog = {
  kode: string;
  nama: string;
  bagian: BagianKatalog;
  keterangan: string;
  /** Status tanpa pengaturan. Semua fitur yang sudah ada = "stabil". */
  bawaan: StatusFitur;
};

/** Saklar tahap awal Blangko Saya (18 Okt 2026): mati = hanya Super Admin; menyala = semua peran yang berhak. */
export const FITUR_BLANGKO_SAYA_SEMUA_PERAN = "blangko-saya-semua-peran";

const portal = (kode: string, nama: string, keterangan: string): FiturKatalog => ({ kode, nama, bagian: "portal", keterangan, bawaan: "stabil" });
const bot = (kode: string, nama: string, keterangan: string): FiturKatalog => ({ kode, nama, bagian: "bot", keterangan, bawaan: "stabil" });

/** Satu butir untuk tiap bagian ekstensi (sipp/abt/portal/popup) - sama dengan daftar-fitur-ekstensi. */
const FITUR_EKSTENSI: FiturKatalog[] = (Object.entries(BAGIAN_FITUR_EKSTENSI) as Array<[string, string]>).map(([kunci, judul]) => ({
  kode: `ekstensi-${kunci}`,
  nama: `Ekstensi: ${judul}`,
  bagian: "ekstensi" as const,
  keterangan: `Seluruh fitur ekstensi pada bagian "${judul}".`,
  bawaan: "stabil" as const,
}));

/**
 * Katalog fitur. Kode = kebab-case, stabil selamanya (disimpan di pengaturan
 * dan dikirim ke bot/ekstensi/Pusat). Fitur baru ditambah di sini dengan
 * bawaan "uji-coba" atau "mati" bila belum boleh menyala di semua satker.
 */
export const KATALOG_FITUR_SATKER: readonly FiturKatalog[] = [
  portal("surat-disposisi", "Surat masuk/keluar dan disposisi", "Registrasi surat, disposisi, arsip, dan pencarian."),
  portal("e-kepegawaian", "e-Kepegawaian", "Cuti, presensi, dan pengajuan kepegawaian."),
  portal("e-status", "e-Status", "Rekaman, kiriman, dan insiden status."),
  portal("judicia-legal-form", "Judicia Legal Form", "Formulir hukum, basis pengetahuan, dan AI Judicia."),
  portal("pengawasan-berjenjang", "Pengawasan berjenjang", "Penilaian dan audit berjenjang."),
  portal("antrian-sidang", "Antrian sidang dan layar", "Antrian ruang sidang, layar publik, dan pengumuman."),
  portal("jadwal-sidang", "Jadwal sidang", "Jadwal, penundaan, dan hasil sidang."),
  portal("ecourt-integrasi", "Integrasi e-Court", "Penarikan, arsip, dan aksi e-Court."),
  portal("sipp-jembatan", "Jembatan SIPP", "Kamus SIPP, registry, penilaian, dan tautan akun."),
  portal("blangko-bas", "Blangko dan BAS", "Blangko Derry, BAS, relaas, dan penetapan."),
  portal("pengaturan-sipp-abt", "Pengaturan SIPP dan ABT", "Hak menu, saklar kebijakan, variabel, dan identitas satker untuk ABT."),
  {
    kode: FITUR_BLANGKO_SAYA_SEMUA_PERAN,
    nama: "Blangko Saya untuk semua peran",
    bagian: "portal",
    keterangan: "Mati: Blangko Saya (buat blangko sendiri) hanya untuk Super Admin. Nyalakan agar hakim, panitera, dan konseptor juga dapat memakainya.",
    bawaan: "mati",
  },
  {
    kode: KODE_FITUR_JEJAK_ISIAN,
    nama: "Jejak isian dan butir saksi",
    bagian: "portal",
    keterangan:
      "Mati: tidak ada yang dicatat. Nyalakan agar susun saksi dan Blangko Derry mencatat usulan versus hasil akhir (dasar ukuran ketepatan), isian dibaca ulang dari ABT sesudah disimpan, dan Urungkan dapat dijalankan dari PC mana pun. Disimpan 2 tahun di server kantor.",
    bawaan: "mati",
  },
  {
    kode: KODE_FITUR_KETEPATAN_ISIAN,
    nama: "Ketepatan isian",
    bagian: "portal",
    keterangan:
      "Mati: gerbang isian bot memakai berkas bawaan saja. Nyalakan agar layar Ketepatan isian menghitung ketepatan dari lapangan dan mengusulkan isian yang layak terisi sendiri (atau harus turun). Usulan tidak pernah berlaku sebelum Super Admin menyetujuinya. Butuh saklar Jejak isian menyala agar ada datanya.",
    bawaan: "mati",
  },
  {
    kode: KODE_FITUR_ISIAN_SEKALI,
    nama: "Isian sekali per perkara",
    bagian: "portal",
    keterangan:
      "Mati: isian manual Blangko Derry tidak diingat per perkara. Nyalakan agar isian yang belum punya sumber otomatis (mis. nomor penetapan prodeo) cukup diketik sekali: blangko lain perkara itu menampilkannya sebagai saran. Petugas tetap yang memasukkannya ke ABT.",
    bawaan: "mati",
  },
  {
    kode: KODE_FITUR_WAJIB_CETAK,
    nama: "Daftar wajib sebelum cetak",
    bagian: "portal",
    keterangan:
      "Mati: pengingat cetak seperti biasa. Nyalakan agar ALETA mencatat kelengkapan semua jenis blangko, mengingatkan isian yang biasanya sudah terisi saat blangko itu dicetak, dan mengusulkan isian bukan-identitas dari perkara serupa yang sudah putus. Hanya saran; tidak pernah menahan cetak dan tidak pernah menulis ke ABT sendiri.",
    bawaan: "mati",
  },
  {
    kode: KODE_FITUR_HURUF_BELAJAR,
    nama: "Huruf alasan yang belajar dari hakim",
    bagian: "portal",
    keterangan:
      "Mati: huruf alasan perceraian (8503) persis seperti biasa. Nyalakan agar Blangko Derry menambahkan pertimbangan dari kebiasaan hakim dan majelis (jejak isian) serta saran dasar hukum per huruf dari pustaka pertimbangan (yang belum terverifikasi bertanda [PERLU VERIFIKASI]). Hanya usulan; huruf tetap keputusan hakim dan tidak pernah diisi sendiri.",
    bawaan: "mati",
  },
  {
    kode: KODE_FITUR_ISIAN_SIDANG,
    nama: "Isian BAS per sidang",
    bagian: "portal",
    keterangan:
      "Mati: isian ketikan BAS satu per perkara seperti biasa (BAS sidang berikutnya menimpa yang sebelumnya di ABT). Nyalakan agar ALETA menyimpan isian BAS per sidang; saat BAS sidang tertentu dicetak, isian sidang itu dipakai sementara lalu ABT dipulihkan seperti semula.",
    bawaan: "mati",
  },
  portal("putusan-advance", "Putusan Advance", "Draf putusan lengkap oleh konseptor dan hakim."),
  portal("konseptor-putusan", "Konseptor putusan", "Langkah konseptor, usulan pertimbangan, dan amar."),
  portal("kasir-otomatis", "Kasir otomatis", "Usulan jurnal, rekap, dan biaya perkara."),
  portal("skp-jabatan", "SKP per jabatan", "Sasaran kinerja, eviden, dan penetapan per jabatan."),
  portal("peta-perkara", "Peta perkara", "Peta sebaran perkara dan wilayah."),
  portal("asisten-ai", "Asisten AI", "Asisten hakim, lapisan AI, dan pagu penggunaan."),
  portal("tampilan-ekstensi", "Tampilan ekstensi", "Penerapan tampilan dan profil saklar ekstensi per peran."),
  bot("bot-whatsapp", "Bot WhatsApp", "Gateway WhatsApp, antrian pesan, dan notifikasi."),
  bot("bot-abt-pengaturan", "Bot: pengaturan ABT", "Jalur tulis pengaturan ABT dan paket logo kop."),
  bot("bot-ai", "Bot: layanan AI", "Konfigurasi dan pemanggilan penyedia AI dari bot."),
  ...FITUR_EKSTENSI,
];

const KODE_KATALOG = new Set(KATALOG_FITUR_SATKER.map((f) => f.kode));
const URUTAN_STATUS: Record<StatusFitur, number> = { mati: 0, "uji-coba": 1, stabil: 2 };

export const BATAS_BUTIR_FITUR = 200;

export class GalatFiturSatker extends Error {}

export function kodeFiturSah(kode: unknown): boolean {
  return typeof kode === "string" && KODE_KATALOG.has(kode);
}
export function statusFiturSah(x: unknown): x is StatusFitur {
  return typeof x === "string" && (STATUS_FITUR as readonly string[]).includes(x);
}
export function saluranSah(x: unknown): x is SaluranSatker {
  return typeof x === "string" && (SALURAN_SATKER as readonly string[]).includes(x);
}

export type PengaturanFiturSatker = {
  /** Hanya fitur yang DIUBAH dari bawaannya; yang tidak tercantum = bawaan katalog. */
  fitur: Record<string, StatusFitur>;
  diubahOleh: string;
  diubahPada: string;
};

const teks = (x: unknown) => String(x ?? "").trim();

/** Bentuk tersimpan yang sah, atau null. Kode dan status yang tidak dikenal dibuang. */
export function bersihkanPengaturanFitur(x: unknown): PengaturanFiturSatker | null {
  if (!x || typeof x !== "object" || Array.isArray(x)) return null;
  const o = x as Record<string, unknown>;
  if (!o.fitur || typeof o.fitur !== "object" || Array.isArray(o.fitur)) return null;
  const fitur: Record<string, StatusFitur> = {};
  for (const [kode, status] of Object.entries(o.fitur as Record<string, unknown>).slice(0, BATAS_BUTIR_FITUR)) {
    if (kodeFiturSah(kode) && statusFiturSah(status)) fitur[kode] = status;
  }
  return { fitur, diubahOleh: teks(o.diubahOleh).slice(0, 200), diubahPada: teks(o.diubahPada).slice(0, 40) };
}

/** Plafon dari Pusat (kode -> status), atau null bila tidak ada. */
export type IzinPusat = { fitur: Record<string, StatusFitur>; diterimaPada: string } | null;

export function bersihkanIzinPusat(x: unknown): IzinPusat {
  const p = bersihkanPengaturanFitur(x);
  if (!p) return null;
  const o = x as Record<string, unknown>;
  return { fitur: p.fitur, diterimaPada: teks(o.diterimaPada).slice(0, 40) };
}

export type KeadaanFitur = {
  kode: string;
  status: StatusFitur;
  menyala: boolean;
  /** Kalimat awam mengapa tidak menyala / dibatasi; "" bila tidak ada. */
  sebab: string;
  /** Status pilihan satker (bawaan bila belum diubah) sebelum saluran dan plafon Pusat. */
  pilihan: StatusFitur;
  diubah: boolean;
};

export type KonteksFitur = {
  pengaturan?: PengaturanFiturSatker | null;
  saluran?: SaluranSatker;
  izinPusat?: IzinPusat;
};

/** Keadaan satu fitur. Kode di luar katalog dianggap menyala (tidak ada yang bisa dimatikan tanpa terdaftar). */
export function keadaanFitur(kode: string, konteks: KonteksFitur = {}): KeadaanFitur {
  const butir = KATALOG_FITUR_SATKER.find((f) => f.kode === kode);
  if (!butir) return { kode, status: "stabil", menyala: true, sebab: "", pilihan: "stabil", diubah: false };

  const dipilih = konteks.pengaturan?.fitur[kode];
  const pilihan: StatusFitur = dipilih ?? butir.bawaan;
  let status = pilihan;
  let sebab = "";

  const plafon = konteks.izinPusat?.fitur[kode];
  if (plafon && URUTAN_STATUS[plafon] < URUTAN_STATUS[status]) {
    status = plafon;
    sebab = plafon === "mati" ? "Dinonaktifkan oleh ALETA Pusat untuk satker ini." : "Dibatasi ALETA Pusat menjadi uji coba untuk satker ini.";
  }

  if (status === "uji-coba" && (konteks.saluran ?? "stabil") !== "uji-coba") {
    status = "mati";
    sebab = "Fitur uji coba hanya tersedia bagi satker di saluran uji coba.";
  }

  if (status === "mati" && !sebab) sebab = pilihan === "mati" ? "Dimatikan oleh Super Admin satker." : "";
  return { kode, status, menyala: status !== "mati", sebab, pilihan, diubah: dipilih !== undefined && dipilih !== butir.bawaan };
}

export function petaKeadaanFitur(konteks: KonteksFitur = {}): Record<string, KeadaanFitur> {
  const hasil: Record<string, KeadaanFitur> = {};
  for (const f of KATALOG_FITUR_SATKER) hasil[f.kode] = keadaanFitur(f.kode, konteks);
  return hasil;
}

/**
 * Menyusun pengaturan baru dari isian layar admin. Hanya butir yang BERBEDA dari
 * bawaan yang disimpan. Ditolak (bukan dibersihkan diam-diam): kode di luar
 * katalog, status tidak sah, dan status "uji-coba" di saluran stabil.
 */
export function susunPengaturanFitur(
  masuk: unknown,
  saluran: SaluranSatker
): Record<string, StatusFitur> {
  if (!masuk || typeof masuk !== "object" || Array.isArray(masuk)) throw new GalatFiturSatker("Daftar fitur harus berupa pasangan kode dan status.");
  const entri = Object.entries(masuk as Record<string, unknown>);
  if (entri.length > BATAS_BUTIR_FITUR) throw new GalatFiturSatker(`Paling banyak ${BATAS_BUTIR_FITUR} butir fitur.`);
  const hasil: Record<string, StatusFitur> = {};
  for (const [kode, status] of entri) {
    if (!kodeFiturSah(kode)) throw new GalatFiturSatker(`Fitur "${kode.slice(0, 60)}" tidak dikenal - muat ulang halaman lalu coba lagi.`);
    if (!statusFiturSah(status)) throw new GalatFiturSatker(`Status fitur "${kode}" harus stabil, uji-coba, atau mati.`);
    const butir = KATALOG_FITUR_SATKER.find((f) => f.kode === kode)!;
    if (status === "uji-coba" && saluran !== "uji-coba") {
      throw new GalatFiturSatker(`Status uji coba untuk "${butir.nama}" hanya dapat dipilih bila satker berada di saluran uji coba.`);
    }
    if (status !== butir.bawaan) hasil[kode] = status;
  }
  return hasil;
}

/** Ringkasan untuk bot dan ekstensi: hanya kode -> status efektif, plus sidik agar mudah dibandingkan. */
export type RingkasanFiturKlien = {
  saluran: SaluranSatker;
  fitur: Record<string, StatusFitur>;
};

export function ringkasUntukKlien(konteks: KonteksFitur = {}): RingkasanFiturKlien {
  const peta = petaKeadaanFitur(konteks);
  const fitur: Record<string, StatusFitur> = {};
  for (const [kode, k] of Object.entries(peta)) fitur[kode] = k.status;
  return { saluran: konteks.saluran ?? "stabil", fitur };
}

/** Bagian ekstensi (sipp/abt/portal/popup) yang menyala menurut ringkasan - untuk ekstensi. */
export function bagianEkstensiMenyala(ringkasan: RingkasanFiturKlien): Record<string, boolean> {
  const hasil: Record<string, boolean> = {};
  for (const kunci of Object.keys(BAGIAN_FITUR_EKSTENSI)) hasil[kunci] = (ringkasan.fitur[`ekstensi-${kunci}`] ?? "stabil") !== "mati";
  return hasil;
}

export const PESAN_FITUR_MATI = "Fitur ini tidak tersedia di satker Anda - hubungi Super Admin.";
