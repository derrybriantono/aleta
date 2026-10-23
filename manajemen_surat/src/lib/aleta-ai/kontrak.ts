/**
 * Kontrak antara layar ALETA Ai dan rute /api/aleta-ai/* (20 Okt 2026).
 * Layar hanya memakai bentuk di bawah; rute dibangun terpisah di sisi server.
 * Pengguna biasa tidak pernah melihat nama model - hanya label mode.
 */

export type ModeAi = "cepat" | "teliti" | "mendalam";

export const LABEL_MODE: Record<ModeAi, string> = {
  cepat: "Cepat",
  teliti: "Teliti",
  mendalam: "Mendalam",
};

export type Pemicu = { kode: string; label: string; kelompok: string; perkiraanRp?: number };

export type RingkasAi = {
  aktif: boolean;
  alasanNonaktif?: string;
  saldoRp: number;
  /** Tahap 4: saldo di bawah ambang Super Admin. */
  saldoMenipis?: boolean;
  ambangSaldoMenipisRp?: number;
  superAdmin: boolean;
  pemicu: Pemicu[];
  proyekVersi?: string | number;
};

export type RingkasPercakapan = { id: string; judul: string; diperbarui: string; perkara?: string };

export type PesanAi = {
  id: string;
  peran: "pengguna" | "ai";
  isi: string;
  mode?: string;
  label?: string;
  biayaRp?: number;
  waktu: string;
  /** Hanya di sisi layar: jawaban dihentikan atau gagal sebelum selesai. */
  terputus?: boolean;
};

export type RincianPercakapan = { id: string; judul: string; pesan: PesanAi[] };

export type PeristiwaAlir =
  | { jenis: "perkiraan"; mode: string; label?: string; perkiraanRp: number }
  | { jenis: "teks"; delta: string }
  | { jenis: "selesai"; pesanId: string; mode: string; label?: string; biayaRp: number; saldoRp: number }
  | { jenis: "gagal"; pesan: string };

export type MutasiSaldo = {
  id?: string;
  waktu: string;
  jenis?: string;
  keterangan?: string;
  jumlahRp: number;
  saldoSesudahRp?: number;
};

export type TarifModel = { model: string; masuk: number; keluar: number; cacheTulis: number; cacheBaca: number };
export type RuteModel = { kelompok: string; model: string; effort: string; label: string; peran: string[] };

/** Margin dan penyangga kurs dalam PERSEN (30 = 30%). */
export type PengaturanAi = {
  margin: number;
  penyanggaKurs: number;
  minimumRp: number;
  pembulatanRp: number;
  batasHarianRp: number;
  aktif: boolean;
  tarif: TarifModel[];
  rute: RuteModel[];
  /** Tahap 4: MDR QRIS (persen), batas satker per bulan (Rp biaya API), ambang saldo menipis (Rp). */
  mdrPersen?: number;
  batasSatkerBulananRp?: number;
  ambangSaldoMenipisRp?: number;
};

const NAMA_MODEL = /(opus|sonnet|haiku|claude|fable|gpt|gemini)/i;

/** Label yang aman ditampilkan: bukan nama model, hanya Cepat/Teliti/Mendalam. */
export function labelAman(mode?: string, label?: string): string {
  const baku = (mode ?? "").toLowerCase();
  if (baku === "cepat" || baku === "teliti" || baku === "mendalam") return LABEL_MODE[baku as ModeAi];
  const kandidat = (label ?? "").trim();
  const huruf = kandidat.toLowerCase();
  if (huruf === "cepat" || huruf === "teliti" || huruf === "mendalam") return LABEL_MODE[huruf as ModeAi];
  if (kandidat && !NAMA_MODEL.test(kandidat) && kandidat.length <= 20) return kandidat;
  return "Teliti";
}

const rupiah = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 });

export function formatRupiah(nilai: number | undefined | null): string {
  const angka = Number.isFinite(nilai as number) ? Math.round(nilai as number) : 0;
  return `Rp${rupiah.format(angka)}`;
}

export function judulDariTeks(teks: string): string {
  const bersih = teks.replace(/\s+/g, " ").trim();
  if (!bersih) return "Percakapan baru";
  return bersih.length > 60 ? `${bersih.slice(0, 57).trimEnd()}...` : bersih;
}

export type KelompokWaktu = "Hari ini" | "Kemarin" | "7 hari terakhir" | "Lebih lama";
export const URUTAN_KELOMPOK: KelompokWaktu[] = ["Hari ini", "Kemarin", "7 hari terakhir", "Lebih lama"];

export function kelompokWaktu(iso: string, sekarang: Date = new Date()): KelompokWaktu {
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return "Lebih lama";
  const awal = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const selisihHari = Math.round((awal(sekarang) - awal(t)) / 86_400_000);
  if (selisihHari <= 0) return "Hari ini";
  if (selisihHari === 1) return "Kemarin";
  if (selisihHari <= 7) return "7 hari terakhir";
  return "Lebih lama";
}

export function kelompokkanRiwayat(daftar: RingkasPercakapan[], sekarang: Date = new Date()) {
  const urut = [...daftar].sort((a, b) => (b.diperbarui || "").localeCompare(a.diperbarui || ""));
  return URUTAN_KELOMPOK.map((nama) => ({
    nama,
    isi: urut.filter((p) => kelompokWaktu(p.diperbarui, sekarang) === nama),
  })).filter((k) => k.isi.length > 0);
}
