/**
 * ============================================================================
 * PITA RUANG SIDANG - SATU BARIS (JADWAL-3 butir 3, 19 Okt 2026)
 * ============================================================================
 *
 * Menyatukan dua baris lama Jadwal Sidang - "Ruang sidang yang digunakan"
 * (kartu berwarna per ruang) dan "RUANG SIDANG · ..." (yang sedang disidang)
 * - menjadi satu pil per ruang. Rancangan dan alasannya:
 * docs/rancangan/ruang-sidang-ringkas.html (pilihan A).
 *
 * Yang sedang berjalan dicocokkan ke kartu lewat ruang SIPP perkaranya, bukan
 * lewat sebutan mesin antrian ("Ruang 1") - keduanya dapat berbeda tulisan.
 * Ruang berjalan yang tidak punya kartu (tidak terjadwal di SIPP hari itu)
 * tetap mendapat pil sendiri, supaya tidak ada sidang berjalan yang hilang.
 */
import { PALET_KARTU_RUANG, type KartuRuang, type WarnaKartuRuang } from "@/lib/kartu-ruang-sidang";
import type { SidangBerjalan } from "@/lib/jadwal-sidang-2okt";

export type PilRuang = {
  nama: string;
  warna: WarnaKartuRuang;
  /** Sidang pada rentang itu; null bila ruangnya tidak terjadwal di SIPP. */
  jumlah: number | null;
  perlu: number;
  berjalan: (SidangBerjalan & { nomorPerkara: string }) | null;
};

function bersih(teks: unknown): string {
  return String(teks ?? "").replace(/\s+/g, " ").trim();
}

export function susunPitaRuang(bahan: {
  kartu: ReadonlyArray<KartuRuang>;
  perRuang: Readonly<Record<string, SidangBerjalan>>;
  /** Ruang SIPP per kunciWaktu. */
  ruangSipp: Readonly<Record<string, string>>;
  /** Nomor perkara per kunciWaktu. */
  nomorPerkara: Readonly<Record<string, string>>;
}): PilRuang[] {
  const pil: PilRuang[] = bahan.kartu.map((k) => ({
    nama: k.nama,
    warna: k.warna,
    jumlah: k.jumlah,
    perlu: k.perlu,
    berjalan: null,
  }));
  const cari = (nama: string) => {
    const n = bersih(nama).toLowerCase();
    return n ? pil.find((p) => bersih(p.nama).toLowerCase() === n) : undefined;
  };
  const daftar = Object.entries(bahan.perRuang).sort(([a], [b]) => a.localeCompare(b, "id", { numeric: true }));
  for (const [namaMesin, b] of daftar) {
    const berjalan = { ...b, nomorPerkara: bahan.nomorPerkara[b.kunci] ?? "" };
    const sasaran = cari(bahan.ruangSipp[b.kunci] ?? "") ?? cari(namaMesin);
    if (sasaran && !sasaran.berjalan) {
      sasaran.berjalan = berjalan;
      continue;
    }
    pil.push({
      nama: bersih(namaMesin) || "Ruang sidang",
      warna: PALET_KARTU_RUANG[pil.length % PALET_KARTU_RUANG.length],
      jumlah: null,
      perlu: 0,
      berjalan,
    });
  }
  return pil;
}

/** Ringkasan di kepala pita. */
export function ringkasPita(pil: ReadonlyArray<PilRuang>): { ruang: number; perkara: number; perlu: number } {
  return {
    ruang: pil.filter((p) => p.jumlah !== null).length,
    perkara: pil.reduce((n, p) => n + (p.jumlah ?? 0), 0),
    perlu: pil.reduce((n, p) => n + p.perlu, 0),
  };
}

/**
 * Lama berjalan dalam menit - dari saat mulai ("YYYY-MM-DD HH:MM[:SS]" atau
 * "HH:MM" pada hari yang sama) sampai sekarang. null bila tidak terbaca.
 */
export function menitBerjalan(sejak: string | null | undefined, sekarangMs: number): number | null {
  const teks = bersih(sejak);
  let ms: number | null = null;
  const penuh = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/.exec(teks);
  if (penuh) {
    const [, th, bl, hr, jm, mn, dt] = penuh;
    ms = new Date(Number(th), Number(bl) - 1, Number(hr), Number(jm), Number(mn), Number(dt ?? 0)).getTime();
  } else {
    const jam = /^(\d{1,2}):(\d{2})/.exec(teks);
    if (jam) {
      const d = new Date(sekarangMs);
      d.setHours(Number(jam[1]), Number(jam[2]), 0, 0);
      ms = d.getTime();
    }
  }
  if (ms === null || !Number.isFinite(ms)) return null;
  const menit = Math.floor((sekarangMs - ms) / 60_000);
  return menit >= 0 && menit < 24 * 60 ? menit : null;
}

export function sebutLama(menit: number | null): string {
  if (menit === null) return "";
  if (menit < 60) return `${menit} mnt`;
  return `${Math.floor(menit / 60)} j ${menit % 60} mnt`;
}
