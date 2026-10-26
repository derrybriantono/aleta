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

export const LAYAR_CERMIN = ["mediasi", "status", "jadwal", "ekstensi", "kabar"] as const;
export type LayarCermin = (typeof LAYAR_CERMIN)[number];

export const LABEL_LAYAR_CERMIN: Record<LayarCermin, string> = {
  mediasi: "Jadwal Mediasi",
  status: "Status Perkara",
  jadwal: "Jadwal Sidang, layar publik, dan antrean",
  ekstensi: "Panel ekstensi di SIPP/ABT",
  kabar: "Kabar perubahan data SIPP di panel ekstensi",
};

export const UKURAN_KELOMPOK = { min: 50, maks: 500, bawaan: 300 } as const;
export const JEDA_KELOMPOK_DETIK = { min: 2, maks: 600, bawaan: 15 } as const;
/** Pembaruan berkala (sesudah pemindaian awal selesai): selang antar putaran. */
export const SELANG_PEMBARUAN_DETIK = { min: 30, maks: 3600, bawaan: 60 } as const;
/**
 * Jendela PANAS: sidang pada [hari ini - lalu, hari ini + depan] dihitung ulang
 * tiap `menit` menit, sebab sebagian bahannya (relaas, kehadiran, saksi,
 * berkas e-Court) berubah tanpa menyentuh kolom waktu tabel jadwal.
 */
export const JENDELA_PANAS = {
  hariLalu: { min: 0, maks: 7, bawaan: 1 },
  hariDepan: { min: 0, maks: 30, bawaan: 7 },
  menit: { min: 1, maks: 60, bawaan: 3 },
} as const;
/**
 * Jadwal Mediasi (A5): pertemuan pada [hari ini - lalu, hari ini + depan]
 * dihitung ulang tiap `menit` menit (lebih jarang dari sidang: tiap baris
 * mediasi memerlukan pembacaan lama mediasi dari view SIPP).
 */
export const JENDELA_MEDIASI = {
  hariLalu: { min: 0, maks: 31, bawaan: 3 },
  hariDepan: { min: 0, maks: 90, bawaan: 21 },
  menit: { min: 1, maks: 120, bawaan: 10 },
} as const;
/** Penanda Status Perkara (A5): selang antar siklus penghitungan seluruh tag, menit. */
export const SELANG_TAG_MENIT = { min: 2, maks: 240, bawaan: 10 } as const;

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
  /** Selang pembaruan berkala dari kolom waktu SIPP, detik. */
  selangPembaruanDetik: number;
  /** Jendela panas (lihat JENDELA_PANAS). */
  panasHariLalu: number;
  panasHariDepan: number;
  panasMenit: number;
  /** Jendela Jadwal Mediasi (lihat JENDELA_MEDIASI). */
  mediasiHariLalu: number;
  mediasiHariDepan: number;
  mediasiMenit: number;
  /** Selang siklus penanda Status Perkara, menit. */
  selangTagMenit: number;
  /** Jendela jam pemindaian awal (WITA, HH:MM); melewati tengah malam diperbolehkan. */
  jendelaMulai: string;
  jendelaSelesai: string;
  diubahOleh?: string;
  diubahPada?: string;
};

export const PENGATURAN_CERMIN_BAWAAN: PengaturanCermin = {
  pemindaiAktif: false,
  layar: { mediasi: false, status: false, jadwal: false, ekstensi: false, kabar: false },
  ukuranKelompok: UKURAN_KELOMPOK.bawaan,
  jedaDetik: JEDA_KELOMPOK_DETIK.bawaan,
  selangPembaruanDetik: SELANG_PEMBARUAN_DETIK.bawaan,
  panasHariLalu: JENDELA_PANAS.hariLalu.bawaan,
  panasHariDepan: JENDELA_PANAS.hariDepan.bawaan,
  panasMenit: JENDELA_PANAS.menit.bawaan,
  mediasiHariLalu: JENDELA_MEDIASI.hariLalu.bawaan,
  mediasiHariDepan: JENDELA_MEDIASI.hariDepan.bawaan,
  mediasiMenit: JENDELA_MEDIASI.menit.bawaan,
  selangTagMenit: SELANG_TAG_MENIT.bawaan,
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
    selangPembaruanDetik: jepit(x.selangPembaruanDetik, SELANG_PEMBARUAN_DETIK.min, SELANG_PEMBARUAN_DETIK.maks, SELANG_PEMBARUAN_DETIK.bawaan),
    panasHariLalu: jepit(x.panasHariLalu, JENDELA_PANAS.hariLalu.min, JENDELA_PANAS.hariLalu.maks, JENDELA_PANAS.hariLalu.bawaan),
    panasHariDepan: jepit(x.panasHariDepan, JENDELA_PANAS.hariDepan.min, JENDELA_PANAS.hariDepan.maks, JENDELA_PANAS.hariDepan.bawaan),
    panasMenit: jepit(x.panasMenit, JENDELA_PANAS.menit.min, JENDELA_PANAS.menit.maks, JENDELA_PANAS.menit.bawaan),
    mediasiHariLalu: jepit(x.mediasiHariLalu, JENDELA_MEDIASI.hariLalu.min, JENDELA_MEDIASI.hariLalu.maks, JENDELA_MEDIASI.hariLalu.bawaan),
    mediasiHariDepan: jepit(x.mediasiHariDepan, JENDELA_MEDIASI.hariDepan.min, JENDELA_MEDIASI.hariDepan.maks, JENDELA_MEDIASI.hariDepan.bawaan),
    mediasiMenit: jepit(x.mediasiMenit, JENDELA_MEDIASI.menit.min, JENDELA_MEDIASI.menit.maks, JENDELA_MEDIASI.menit.bawaan),
    selangTagMenit: jepit(x.selangTagMenit, SELANG_TAG_MENIT.min, SELANG_TAG_MENIT.maks, SELANG_TAG_MENIT.bawaan),
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

// ---------------------------------------------------------------------------
// Pembaruan berkala (kunci jejak "pembaruan") dan pencocokan mingguan ("pencocokan")
// ---------------------------------------------------------------------------

export type KeadaanPembaruan = {
  /** Waktu SIPP terakhir yang termuat ('YYYY-MM-DD HH:MM:SS'); kosong = belum dimulai. */
  tanda: string;
  putaranTerakhir: string;
  panasTerakhir: string;
  /** Tanggal sidang yang menunggu dihitung ulang (diproses beberapa per putaran). */
  antrianTanggal: string[];
  terakhir: { perkara: number; tanggal: number; ditulis: number; ms: number; pada: string } | null;
  galat: { terakhir: string; pada: string; beruntun: number };
  tidakTerbaca: string[];
};

export function keadaanPembaruanAwal(): KeadaanPembaruan {
  return {
    tanda: "",
    putaranTerakhir: "",
    panasTerakhir: "",
    antrianTanggal: [],
    terakhir: null,
    galat: { terakhir: "", pada: "", beruntun: 0 },
    tidakTerbaca: [],
  };
}

const TANGGAL_ISO = /^\d{4}-\d{2}-\d{2}$/;

export function bersihkanKeadaanPembaruan(mentah: unknown): KeadaanPembaruan {
  const dasar = keadaanPembaruanAwal();
  if (!mentah || typeof mentah !== "object") return dasar;
  const x = mentah as Record<string, any>;
  const teks = (n: unknown) => (typeof n === "string" ? n : "");
  const angka = (n: unknown) => (Number.isFinite(Number(n)) && Number(n) >= 0 ? Math.floor(Number(n)) : 0);
  const g = x.galat && typeof x.galat === "object" ? x.galat : {};
  const t = x.terakhir && typeof x.terakhir === "object" ? x.terakhir : null;
  return {
    tanda: teks(x.tanda),
    putaranTerakhir: teks(x.putaranTerakhir),
    panasTerakhir: teks(x.panasTerakhir),
    antrianTanggal: Array.isArray(x.antrianTanggal)
      ? x.antrianTanggal.filter((d: unknown) => typeof d === "string" && TANGGAL_ISO.test(d)).slice(0, 400)
      : [],
    terakhir: t
      ? { perkara: angka(t.perkara), tanggal: angka(t.tanggal), ditulis: angka(t.ditulis), ms: angka(t.ms), pada: teks(t.pada) }
      : null,
    galat: { terakhir: teks(g.terakhir), pada: teks(g.pada), beruntun: angka(g.beruntun) },
    tidakTerbaca: Array.isArray(x.tidakTerbaca) ? x.tidakTerbaca.filter((d: unknown) => typeof d === "string").slice(0, 20) : [],
  };
}

export type HasilPencocokan = {
  pada: string;
  ms: number;
  perkaraDihapus: number;
  perkaraDitambah: number;
  perkaraDiperbaiki: number;
  sidangDihapus: number;
  sidangDitambah: number;
  sidangDiperbaiki: number;
  tanggalDisegarkan: number;
  pemicu: "mingguan" | "tombol";
  catatan: string;
};

export type KeadaanPencocokan = { terakhir: HasilPencocokan | null; riwayat: HasilPencocokan[] };

export function bersihkanKeadaanPencocokan(mentah: unknown): KeadaanPencocokan {
  if (!mentah || typeof mentah !== "object") return { terakhir: null, riwayat: [] };
  const x = mentah as Record<string, any>;
  const angka = (n: unknown) => (Number.isFinite(Number(n)) && Number(n) >= 0 ? Math.floor(Number(n)) : 0);
  const satu = (h: any): HasilPencocokan | null =>
    h && typeof h === "object" && typeof h.pada === "string"
      ? {
          pada: h.pada,
          ms: angka(h.ms),
          perkaraDihapus: angka(h.perkaraDihapus),
          perkaraDitambah: angka(h.perkaraDitambah),
          perkaraDiperbaiki: angka(h.perkaraDiperbaiki),
          sidangDihapus: angka(h.sidangDihapus),
          sidangDitambah: angka(h.sidangDitambah),
          sidangDiperbaiki: angka(h.sidangDiperbaiki),
          tanggalDisegarkan: angka(h.tanggalDisegarkan),
          pemicu: h.pemicu === "tombol" ? "tombol" : "mingguan",
          catatan: typeof h.catatan === "string" ? h.catatan : "",
        }
      : null;
  const riwayat = (Array.isArray(x.riwayat) ? x.riwayat : [])
    .map(satu)
    .filter((h: HasilPencocokan | null): h is HasilPencocokan => h !== null)
    .slice(-8);
  return { terakhir: satu(x.terakhir), riwayat };
}

/** Bersih = pencocokan tidak menemukan apa pun yang perlu diperbaiki. */
export function pencocokanBersih(h: HasilPencocokan | null): boolean {
  return (
    h !== null &&
    h.perkaraDihapus + h.perkaraDitambah + h.perkaraDiperbaiki + h.sidangDihapus + h.sidangDitambah + h.sidangDiperbaiki === 0
  );
}

/** Hari dalam pekan (0 = Minggu) dari tanggal ISO. */
export function hariPekan(tanggal: string): number {
  const [t, b, h] = tanggal.split("-").map(Number);
  return new Date(Date.UTC(t, (b || 1) - 1, h || 1)).getUTCDay();
}

/** Pencocokan mingguan: Minggu pukul 02.00 WITA. */
export const PENCOCOKAN = { hari: 0, jam: "02:00" } as const;

/**
 * Apakah pencocokan mingguan sudah waktunya? Hari Minggu pukul >= 02.00 WITA
 * dan belum ada pencocokan pada tanggal itu (terakhirPada = ISO UTC atau '').
 */
export function pencocokanJatuhTempo(sekarang: Date, terakhirPada: string): boolean {
  const { tanggal, jam } = waktuPengadilan(sekarang);
  if (hariPekan(tanggal) !== PENCOCOKAN.hari) return false;
  if (jam.slice(0, 5) < PENCOCOKAN.jam) return false;
  if (!terakhirPada) return true;
  const t = Date.parse(terakhirPada);
  if (!Number.isFinite(t)) return true;
  return waktuPengadilan(new Date(t)).tanggal !== tanggal;
}

// ---------------------------------------------------------------------------
// Waktu SIPP ('YYYY-MM-DD HH:MM:SS', jam dinding WITA tanpa zona)
// ---------------------------------------------------------------------------

const WAKTU_SIPP = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/;

function utcDariWaktuSipp(w: string): number | null {
  const m = WAKTU_SIPP.exec(w);
  if (!m) return null;
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]), Number(m[6]));
}

/** Geser waktu SIPP sebanyak `detik` (boleh negatif); tidak sah -> teks kosong. */
export function geserWaktuSipp(w: string, detik: number): string {
  const ms = utcDariWaktuSipp(w);
  if (ms === null) return "";
  return new Date(ms + detik * 1000).toISOString().slice(0, 19).replace("T", " ");
}

/** Waktu SIPP (jam dinding WITA) dari saat ISO UTC. */
export function waktuSippDari(saat: Date): string {
  const { tanggal, jam } = waktuPengadilan(saat);
  return `${tanggal} ${jam}`;
}

/** Waktu SIPP yang lebih baru dari yang lain; kosong dikalahkan. */
export function waktuSippTerbaru(a: string, b: string): string {
  if (!a) return b;
  if (!b) return a;
  return a >= b ? a : b;
}

// ---------------------------------------------------------------------------
// Jadwal Mediasi (kunci jejak "mediasi") dan penanda Status Perkara (kunci "tag")
// ---------------------------------------------------------------------------

export type KeadaanMediasi = {
  /** ISO UTC: kapan jendela mediasi terakhir selesai dihitung ulang dengan baik; kosong = belum pernah. */
  terakhir: string;
  dari: string;
  sampai: string;
  baris: number;
  ditulis: number;
  dihapus: number;
  ms: number;
  galat: { terakhir: string; pada: string; beruntun: number };
  peringatan: string[];
};

export function keadaanMediasiAwal(): KeadaanMediasi {
  return { terakhir: "", dari: "", sampai: "", baris: 0, ditulis: 0, dihapus: 0, ms: 0, galat: { terakhir: "", pada: "", beruntun: 0 }, peringatan: [] };
}

export function bersihkanKeadaanMediasi(mentah: unknown): KeadaanMediasi {
  const dasar = keadaanMediasiAwal();
  if (!mentah || typeof mentah !== "object") return dasar;
  const x = mentah as Record<string, any>;
  const teks = (n: unknown) => (typeof n === "string" ? n : "");
  const angka = (n: unknown) => (Number.isFinite(Number(n)) && Number(n) >= 0 ? Math.floor(Number(n)) : 0);
  const g = x.galat && typeof x.galat === "object" ? x.galat : {};
  return {
    terakhir: teks(x.terakhir),
    dari: teks(x.dari),
    sampai: teks(x.sampai),
    baris: angka(x.baris),
    ditulis: angka(x.ditulis),
    dihapus: angka(x.dihapus),
    ms: angka(x.ms),
    galat: { terakhir: teks(g.terakhir), pada: teks(g.pada), beruntun: angka(g.beruntun) },
    peringatan: Array.isArray(x.peringatan) ? x.peringatan.filter((d: unknown) => typeof d === "string").slice(-10) : [],
  };
}

export type KeadaanTag = {
  /** ISO UTC: awal siklus yang sedang/terakhir berjalan. */
  siklusMulai: string;
  /** ISO UTC: kapan SEMUA tag siklus terakhir selesai; kosong = belum ada siklus lengkap. */
  siklusSelesai: string;
  /** ISO UTC: awal siklus yang SELESAI itu (patokan baca-tulisan-sendiri). */
  siklusSelesaiMulai: string;
  /** Kunci tag yang menunggu dihitung pada siklus ini. */
  antrian: string[];
  /** Jumlah tag pada siklus ini. */
  total: number;
  /** Tag yang daftar id-nya terpotong pagu bot (hitungan cermin untuk tag ini TIDAK boleh dipercaya). */
  tidakLengkap: string[];
  /** Tag yang gagal dihitung pada siklus ini. */
  gagal: string[];
  /** Ada tulisan lewat ALETA sejak siklus terakhir dimulai (ISO UTC), kosong = tidak. */
  kotorSejak: string;
  galat: { terakhir: string; pada: string; beruntun: number };
};

export function keadaanTagAwal(): KeadaanTag {
  return { siklusMulai: "", siklusSelesai: "", siklusSelesaiMulai: "", antrian: [], total: 0, tidakLengkap: [], gagal: [], kotorSejak: "", galat: { terakhir: "", pada: "", beruntun: 0 } };
}

export function bersihkanKeadaanTag(mentah: unknown): KeadaanTag {
  const dasar = keadaanTagAwal();
  if (!mentah || typeof mentah !== "object") return dasar;
  const x = mentah as Record<string, any>;
  const teks = (n: unknown) => (typeof n === "string" ? n : "");
  const angka = (n: unknown) => (Number.isFinite(Number(n)) && Number(n) >= 0 ? Math.floor(Number(n)) : 0);
  const daftar = (n: unknown) => (Array.isArray(n) ? n.filter((d: unknown) => typeof d === "string").slice(0, 400) : []);
  const g = x.galat && typeof x.galat === "object" ? x.galat : {};
  return {
    siklusMulai: teks(x.siklusMulai),
    siklusSelesai: teks(x.siklusSelesai),
    siklusSelesaiMulai: teks(x.siklusSelesaiMulai),
    antrian: daftar(x.antrian),
    total: angka(x.total),
    tidakLengkap: daftar(x.tidakLengkap),
    gagal: daftar(x.gagal),
    kotorSejak: teks(x.kotorSejak),
    galat: { terakhir: teks(g.terakhir), pada: teks(g.pada), beruntun: angka(g.beruntun) },
  };
}

// ---------------------------------------------------------------------------
// Lingkup Status Perkara: dasar tanggal -> kolom aleta_cermin_perkara, dan rentang periode
// ---------------------------------------------------------------------------

/**
 * Dasar tanggal lingkup (kunci SAMA dengan DASAR_TANGGAL di tagPerkaraService.js)
 * -> kolom aleta_cermin_perkara. TERTUTUP: kunci asing jatuh ke "daftar", seperti
 * jalur lama (nama kolom tidak pernah datang dari luar).
 */
export const KOLOM_DASAR_TANGGAL: Record<string, string> = {
  daftar: "tanggal_pendaftaran",
  putus: "tanggal_putusan",
  bht: "tanggal_bht",
  minutasi: "tanggal_minutasi",
  sidang: "tanggal_sidang_maks",
  akta: "tanggal_akta",
  relaas: "tanggal_relaas",
  ikrar: "tanggal_ikrar",
};

export function kolomDasarTanggal(dasar: string): string {
  return Object.prototype.hasOwnProperty.call(KOLOM_DASAR_TANGGAL, dasar) ? KOLOM_DASAR_TANGGAL[dasar] : KOLOM_DASAR_TANGGAL.daftar;
}

const dua = (n: number) => String(n).padStart(2, "0");
const isoUtc = (d: Date) => `${d.getUTCFullYear()}-${dua(d.getUTCMonth() + 1)}-${dua(d.getUTCDate())}`;

/**
 * Rentang tanggal lingkup menurut periode - SAMA dengan rentang() di
 * tagPerkaraService.js + rentangPeriode() di petaPerkaraService.js, dengan
 * "hari ini" = tanggal WITA yang diberikan pemanggil. total -> kosong (tanpa saringan).
 */
export function rentangLingkupTag(periode: string, acuan: string, dari: string, sampai: string, hariIni: string): { dari: string; sampai: string } {
  const p = String(periode || "total");
  if (p === "total") return { dari: "", sampai: "" };
  const acuanSah = TANGGAL_ISO.test(String(acuan || ""));
  const tgl = acuanSah ? acuan : hariIni;
  const [ty, tb, th] = tgl.split("-").map(Number);
  const d = new Date(Date.UTC(ty, tb - 1, th));
  if (p === "hari" || p === "kemarin") {
    if (p === "kemarin") d.setUTCDate(d.getUTCDate() - 1);
    return { dari: isoUtc(d), sampai: isoUtc(d) };
  }
  if (p === "rentang") return { dari: String(dari || ""), sampai: String(sampai || "") };
  const tahun = d.getUTCFullYear();
  if (p === "tahun") return { dari: `${tahun}-01-01`, sampai: `${tahun}-12-31` };
  if (p === "semester") {
    const awal = d.getUTCMonth() < 6 ? 1 : 7;
    return { dari: `${tahun}-${dua(awal)}-01`, sampai: awal === 1 ? `${tahun}-06-30` : `${tahun}-12-31` };
  }
  if (p === "triwulan") {
    const awal = Math.floor(d.getUTCMonth() / 3) * 3 + 1;
    return { dari: `${tahun}-${dua(awal)}-01`, sampai: isoUtc(new Date(Date.UTC(tahun, awal + 2, 0))) };
  }
  if (p === "bulan") {
    const bulan = d.getUTCMonth() + 1;
    return { dari: `${tahun}-${dua(bulan)}-01`, sampai: isoUtc(new Date(Date.UTC(tahun, bulan, 0))) };
  }
  // Pekan (Senin-Minggu) - bawaan jalur lama untuk periode lain.
  const hari = d.getUTCDay() === 0 ? 7 : d.getUTCDay();
  const senin = new Date(d);
  senin.setUTCDate(d.getUTCDate() - (hari - 1));
  const minggu = new Date(senin);
  minggu.setUTCDate(senin.getUTCDate() + 6);
  return { dari: isoUtc(senin), sampai: isoUtc(minggu) };
}
