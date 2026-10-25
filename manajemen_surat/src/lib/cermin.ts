/**
 * ============================================================================
 * CERMIN PERKARA - ATURAN MURNI (C0, 25 Okt 2026)
 * ============================================================================
 *
 * Tanpa basis data dan tanpa fetch: dipakai pemindai di server dan layar
 * Pemantau Cermin Perkara sekaligus, sehingga batas angka, jendela jam, dan
 * bentuk keadaan pemindai satu sumber. Konsepnya: docs/rancangan/
 * upgrade-otomatisasi-24okt/README.md bagian C0.
 *
 * SEMUA SAKLAR MATI BAWAAN. Cermin hanya untuk DIBACA; SIPP tetap sumber
 * kebenaran, dan layar yang saklarnya mati (atau cerminnya tertinggal) membaca
 * SIPP persis seperti sebelum ada cermin.
 */

/** Layar yang dapat membaca cermin; saklarnya per layar (dinyalakan satu per satu). */
import { waktuPengadilan } from "@/lib/waktu-pengadilan";

export const LAYAR_CERMIN = ["mediasi", "status", "jadwal", "ekstensi"] as const;
export type LayarCermin = (typeof LAYAR_CERMIN)[number];

export const LABEL_LAYAR_CERMIN: Record<LayarCermin, string> = {
  mediasi: "Jadwal Mediasi",
  status: "Status Perkara",
  jadwal: "Jadwal Sidang, layar publik, dan antrean",
  ekstensi: "Panel ekstensi di SIPP/ABT",
};

export const UKURAN_KELOMPOK = { min: 50, maks: 500, bawaan: 300 } as const;
export const JEDA_KELOMPOK_DETIK = { min: 2, maks: 600, bawaan: 15 } as const;

/** Bentuk yang disimpan (aleta_ekstensi_setelan) dan dikirim ke layar. */
export type PengaturanCermin = {
  /** Pemindai awal (dan pembaruannya) boleh berjalan. MATI bawaan. */
  pemindaiAktif: boolean;
  /** Layar yang membaca cermin. Semua MATI bawaan. */
  layar: Record<LayarCermin, boolean>;
  /** Perkara per kelompok pemindai awal. */
  ukuranKelompok: number;
  /** Jeda antar kelompok, detik. */
  jedaDetik: number;
  /** Jendela jam pemindaian awal (WITA, HH:MM); melewati tengah malam diperbolehkan. */
  jendelaMulai: string;
  jendelaSelesai: string;
  diubahOleh?: string;
  diubahPada?: string;
};

export const PENGATURAN_CERMIN_BAWAAN: PengaturanCermin = {
  pemindaiAktif: false,
  layar: { mediasi: false, status: false, jadwal: false, ekstensi: false },
  ukuranKelompok: UKURAN_KELOMPOK.bawaan,
  jedaDetik: JEDA_KELOMPOK_DETIK.bawaan,
  jendelaMulai: "18:00",
  jendelaSelesai: "06:30",
};

const JAM = /^([01]\d|2[0-3]):([0-5]\d)$/;

function jepit(nilai: unknown, min: number, maks: number, bawaan: number) {
  const n = Number(nilai);
  if (!Number.isFinite(n)) return bawaan;
  return Math.max(min, Math.min(maks, Math.round(n)));
}

/** Pengaturan mentah (dari basis data/permintaan) -> bentuk sah; null bila bukan objek. */
export function bersihkanPengaturanCermin(mentah: unknown): PengaturanCermin | null {
  if (!mentah || typeof mentah !== "object" || Array.isArray(mentah)) return null;
  const x = mentah as Record<string, unknown>;
  const layarMentah = x.layar && typeof x.layar === "object" ? (x.layar as Record<string, unknown>) : {};
  const layar = { ...PENGATURAN_CERMIN_BAWAAN.layar };
  for (const k of LAYAR_CERMIN) layar[k] = layarMentah[k] === true;
  const mulai = typeof x.jendelaMulai === "string" && JAM.test(x.jendelaMulai) ? x.jendelaMulai : PENGATURAN_CERMIN_BAWAAN.jendelaMulai;
  const selesai =
    typeof x.jendelaSelesai === "string" && JAM.test(x.jendelaSelesai) ? x.jendelaSelesai : PENGATURAN_CERMIN_BAWAAN.jendelaSelesai;
  return {
    pemindaiAktif: x.pemindaiAktif === true,
    layar,
    ukuranKelompok: jepit(x.ukuranKelompok, UKURAN_KELOMPOK.min, UKURAN_KELOMPOK.maks, UKURAN_KELOMPOK.bawaan),
    jedaDetik: jepit(x.jedaDetik, JEDA_KELOMPOK_DETIK.min, JEDA_KELOMPOK_DETIK.maks, JEDA_KELOMPOK_DETIK.bawaan),
    jendelaMulai: mulai,
    jendelaSelesai: selesai,
    ...(typeof x.diubahOleh === "string" ? { diubahOleh: x.diubahOleh } : {}),
    ...(typeof x.diubahPada === "string" ? { diubahPada: x.diubahPada } : {}),
  };
}

/** Pengaturan yang berlaku: tersimpan bila ada, selain itu bawaan (semua mati). */
export function pengaturanCerminEfektif(tersimpan: PengaturanCermin | null): PengaturanCermin {
  return tersimpan ?? { ...PENGATURAN_CERMIN_BAWAAN, layar: { ...PENGATURAN_CERMIN_BAWAAN.layar } };
}

// ---------------------------------------------------------------------------
// Jendela jam pemindaian
// ---------------------------------------------------------------------------

const menitDari = (hhmm: string) => {
  const [j, m] = hhmm.split(":").map(Number);
  return (j || 0) * 60 + (m || 0);
};

/**
 * Apakah `jam` (HH:MM, WITA) ada dalam jendela [mulai, selesai)? Jendela yang
 * melewati tengah malam (18:00-06:30) berarti >= 18:00 ATAU < 06:30. Mulai =
 * selesai berarti sepanjang hari.
 */
export function dalamJendelaJam(jam: string, mulai: string, selesai: string): boolean {
  if (!JAM.test(jam) || !JAM.test(mulai) || !JAM.test(selesai)) return false;
  const t = menitDari(jam);
  const a = menitDari(mulai);
  const b = menitDari(selesai);
  if (a === b) return true;
  return a < b ? t >= a && t < b : t >= a || t < b;
}

// ---------------------------------------------------------------------------
// Keadaan pemindai awal (disimpan di aleta_cermin_jejak, kunci "pemindai")
// ---------------------------------------------------------------------------

export type StatusPemindai = "belum" | "berjalan" | "jeda" | "selesai" | "galat";
export type TahapPemindai = "perkara" | "sidang" | "selesai";

export type KeadaanPemindai = {
  status: StatusPemindai;
  tahap: TahapPemindai;
  perkara: {
    /** perkara_id terakhir yang sudah dicermin; pemindaian lanjut dari sini. */
    kursor: number;
    total: number;
    diproses: number;
    terbesar: number;
  };
  sidang: {
    /** Tanggal awal jendela berikutnya (YYYY-MM-DD). */
    kursor: string;
    awal: string;
    akhir: string;
    total: number;
    diproses: number;
    /** Lebar jendela sekarang (hari); mengecil bila jendela terpotong batas baris. */
    lebarHari: number;
  };
  mulaiPada: string;
  selesaiPada: string;
  putaranTerakhir: string;
  /** Milidetik kerja aktif yang terkumpul (dasar perkiraan selesai, tanpa jam tidur). */
  aktifMs: number;
  galat: { terakhir: string; pada: string; beruntun: number };
  peringatan: string[];
};

export const LEBAR_JENDELA_BAWAAN = 7;
export const GALAT_BERUNTUN_MAKS = 5;

export function keadaanPemindaiAwal(): KeadaanPemindai {
  return {
    status: "belum",
    tahap: "perkara",
    perkara: { kursor: 0, total: 0, diproses: 0, terbesar: 0 },
    sidang: { kursor: "", awal: "", akhir: "", total: 0, diproses: 0, lebarHari: LEBAR_JENDELA_BAWAAN },
    mulaiPada: "",
    selesaiPada: "",
    putaranTerakhir: "",
    aktifMs: 0,
    galat: { terakhir: "", pada: "", beruntun: 0 },
    peringatan: [],
  };
}

/** Keadaan mentah (JSON tersimpan) -> bentuk sah; yang rusak jatuh ke keadaan awal. */
export function bersihkanKeadaanPemindai(mentah: unknown): KeadaanPemindai {
  const dasar = keadaanPemindaiAwal();
  if (!mentah || typeof mentah !== "object") return dasar;
  const x = mentah as Record<string, any>;
  const angka = (n: unknown, bawaan = 0) => (Number.isFinite(Number(n)) && Number(n) >= 0 ? Math.floor(Number(n)) : bawaan);
  const teks = (n: unknown) => (typeof n === "string" ? n : "");
  const status: StatusPemindai = ["belum", "berjalan", "jeda", "selesai", "galat"].includes(x.status) ? x.status : dasar.status;
  const tahap: TahapPemindai = ["perkara", "sidang", "selesai"].includes(x.tahap) ? x.tahap : dasar.tahap;
  const p = x.perkara && typeof x.perkara === "object" ? x.perkara : {};
  const s = x.sidang && typeof x.sidang === "object" ? x.sidang : {};
  const g = x.galat && typeof x.galat === "object" ? x.galat : {};
  return {
    status,
    tahap,
    perkara: { kursor: angka(p.kursor), total: angka(p.total), diproses: angka(p.diproses), terbesar: angka(p.terbesar) },
    sidang: {
      kursor: teks(s.kursor),
      awal: teks(s.awal),
      akhir: teks(s.akhir),
      total: angka(s.total),
      diproses: angka(s.diproses),
      lebarHari: Math.max(1, Math.min(31, angka(s.lebarHari, LEBAR_JENDELA_BAWAAN))),
    },
    mulaiPada: teks(x.mulaiPada),
    selesaiPada: teks(x.selesaiPada),
    putaranTerakhir: teks(x.putaranTerakhir),
    aktifMs: angka(x.aktifMs),
    galat: { terakhir: teks(g.terakhir), pada: teks(g.pada), beruntun: angka(g.beruntun) },
    peringatan: Array.isArray(x.peringatan) ? x.peringatan.filter((t: unknown) => typeof t === "string").slice(-20) : [],
  };
}

/** Tambah `hari` ke tanggal ISO (UTC, tanpa pergeseran zona). */
export function tambahHari(tanggal: string, hari: number): string {
  const [t, b, h] = tanggal.split("-").map(Number);
  const d = new Date(Date.UTC(t, (b || 1) - 1, h || 1));
  d.setUTCDate(d.getUTCDate() + hari);
  return d.toISOString().slice(0, 10);
}

/** Selisih hari (b - a) antara dua tanggal ISO. */
export function selisihHariIso(a: string, b: string): number {
  const ms = (s: string) => {
    const [t, m, h] = s.split("-").map(Number);
    return Date.UTC(t, (m || 1) - 1, h || 1);
  };
  return Math.round((ms(b) - ms(a)) / 86_400_000);
}

/**
 * Kemajuan keseluruhan 0-100. Perkara dan sidang dibobot menurut jumlah baris
 * sumbernya; tahap yang belum diketahui totalnya dihitung 0.
 */
export function persenKemajuan(k: KeadaanPemindai): number {
  if (k.status === "selesai" || k.tahap === "selesai") return 100;
  const totalP = k.perkara.total;
  const totalS = k.sidang.total;
  const doneP = k.tahap === "perkara" ? k.perkara.diproses : totalP;
  const doneS = k.tahap === "sidang" ? k.sidang.diproses : 0;
  const total = totalP + totalS;
  if (total <= 0) return 0;
  return Math.max(0, Math.min(99, Math.floor(((Math.min(doneP, totalP) + Math.min(doneS, totalS)) / total) * 100)));
}

/**
 * Perkiraan jam selesai (ISO UTC) dari laju kerja aktif. Sisa kerja (ms aktif)
 * disimulasikan melintasi jendela malam: dipakai selama dalam jendela, lalu
 * melompat ke awal jendela berikutnya. Null bila belum cukup data atau sudah
 * selesai.
 */
export function perkiraanSelesai(
  k: KeadaanPemindai,
  sekarang: Date,
  jendela: { mulai: string; selesai: string }
): string | null {
  if (k.status === "selesai" || k.tahap === "selesai") return null;
  const selesaiBaris = k.perkara.diproses + k.sidang.diproses;
  const totalBaris = k.perkara.total + k.sidang.total;
  if (k.aktifMs < 5_000 || selesaiBaris <= 0 || totalBaris <= selesaiBaris) return null;
  let sisa = ((totalBaris - selesaiBaris) * k.aktifMs) / selesaiBaris;
  const a = menitDari(jendela.mulai);
  const b = menitDari(jendela.selesai);
  let t = sekarang.getTime();
  for (let i = 0; i < 4000 && sisa > 0; i++) {
    const jam = waktuPengadilan(new Date(t)).jam.slice(0, 5);
    const menit = menitDari(jam);
    if (dalamJendelaJam(jam, jendela.mulai, jendela.selesai)) {
      const menitSisaJendela = a === b ? 1440 : ((b - menit + 1440) % 1440) || 1440;
      const pakai = Math.min(sisa, menitSisaJendela * 60_000);
      t += pakai;
      sisa -= pakai;
      if (sisa > 0) t += 60_000;
    } else {
      const menitKeMulai = ((a - menit + 1440) % 1440) || 1440;
      t += menitKeMulai * 60_000;
    }
  }
  return sisa > 0 ? null : new Date(t).toISOString();
}
