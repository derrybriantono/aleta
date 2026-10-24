/**
 * ============================================================================
 * ALETA Ai - TARIF, KURS, DAN HARGA (murni, tanpa basis data)
 * ============================================================================
 *
 * Rumus yang dipakai SELURUH ALETA Ai (perkiraan sebelum jalan maupun biaya
 * aktual sesudahnya) ada di satu berkas ini supaya keduanya tidak bisa
 * berselisih:
 *
 *   biaya_usd = token x tarif model (masuk, keluar, tulis cache, baca cache)
 *   kurs      = kurs hari itu x (1 + penyangga kurs)
 *   pokok     = biaya_usd x kurs x (1 + margin)
 *   MDR       = pokok x persen MDR QRIS (bawaan 1%, keputusan pengguna 24 Okt)
 *   harga_rp  = pokok + MDR, dibulatkan KE ATAS kelipatan pembulatan
 *               (bawaan Rp500), minimum Rp1.000 per giliran
 *
 * Rumus ini keputusan pengguna (19 Okt 2026); jangan diubah tanpa izinnya.
 *
 * Super Admin gratis: yang ditagih Rp0, tetapi biaya asli tetap dihitung dan
 * dicatat oleh pemanggil.
 *
 * Tarif bawaan (per 1 juta token, dari rujukan resmi API Claude, 20 Okt 2026)
 * hanyalah NILAI AWAL tabel aleta_ai_harga; Super Admin dapat mengubahnya
 * tanpa rilis.
 */

export type Tarif = {
  model: string;
  masukPerJuta: number;
  keluarPerJuta: number;
  cacheTulisPerJuta: number;
  cacheBacaPerJuta: number;
  /** 0 = satu kartu tarif. >0 = prompt di ATAS ambang memakai tarif "atas". */
  ambangToken: number;
  masukAtas: number;
  keluarAtas: number;
  cacheTulisAtas: number;
  cacheBacaAtas: number;
  /** Model mendukung fallbacks "default" (Opus/Sonnet 5.5; Haiku 5.5 tidak). */
  fallback: boolean;
};

export const MODEL_OPUS = "claude-opus-5-5";
export const MODEL_SONNET = "claude-sonnet-5-5";
export const MODEL_HAIKU = "claude-haiku-5-5";

/**
 * Cache tulis 5 menit = 1,25 x tarif masuk; cache baca: Opus/Sonnet $0,20,
 * Haiku 0,1 x tarif masuk (rujukan prompt-caching.md dan model-migration.md).
 * Haiku 5.5: dua kartu tarif menurut panjang prompt (<= 100K token: $0,10/$0,50;
 * di atasnya $0,50/$2,50).
 */
export const TARIF_BAWAAN: readonly Tarif[] = [
  {
    model: MODEL_OPUS,
    masukPerJuta: 4,
    keluarPerJuta: 20,
    cacheTulisPerJuta: 5,
    cacheBacaPerJuta: 0.2,
    ambangToken: 0,
    masukAtas: 0,
    keluarAtas: 0,
    cacheTulisAtas: 0,
    cacheBacaAtas: 0,
    fallback: true,
  },
  {
    model: MODEL_SONNET,
    masukPerJuta: 2,
    keluarPerJuta: 10,
    cacheTulisPerJuta: 2.5,
    cacheBacaPerJuta: 0.2,
    ambangToken: 0,
    masukAtas: 0,
    keluarAtas: 0,
    cacheTulisAtas: 0,
    cacheBacaAtas: 0,
    fallback: true,
  },
  {
    model: MODEL_HAIKU,
    masukPerJuta: 0.1,
    keluarPerJuta: 0.5,
    cacheTulisPerJuta: 0.125,
    cacheBacaPerJuta: 0.01,
    ambangToken: 100_000,
    masukAtas: 0.5,
    keluarAtas: 2.5,
    cacheTulisAtas: 0.625,
    cacheBacaAtas: 0.05,
    fallback: false,
  },
];

export type PenggunaanToken = {
  masuk: number;
  keluar: number;
  cacheTulis: number;
  cacheBaca: number;
};

export const PENGGUNAAN_NOL: PenggunaanToken = { masuk: 0, keluar: 0, cacheTulis: 0, cacheBaca: 0 };

export function jumlahkanPenggunaan(a: PenggunaanToken, b: PenggunaanToken): PenggunaanToken {
  return {
    masuk: a.masuk + b.masuk,
    keluar: a.keluar + b.keluar,
    cacheTulis: a.cacheTulis + b.cacheTulis,
    cacheBaca: a.cacheBaca + b.cacheBaca,
  };
}

export function totalToken(p: PenggunaanToken): number {
  return p.masuk + p.keluar + p.cacheTulis + p.cacheBaca;
}

const angka = (nilai: unknown): number => {
  const n = Number(nilai);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

/** Penggunaan dari objek usage API (nama kolom resmi); nilai yang tak ada = 0. */
export function penggunaanDariUsage(usage: unknown): PenggunaanToken {
  const u = (usage ?? {}) as Record<string, unknown>;
  return {
    masuk: angka(u.input_tokens),
    keluar: angka(u.output_tokens),
    cacheTulis: angka(u.cache_creation_input_tokens),
    cacheBaca: angka(u.cache_read_input_tokens),
  };
}

/** Biaya USD satu panggilan menurut tarif modelnya (kartu tarif dipilih menurut panjang prompt). */
export function biayaUsd(tarif: Tarif, p: PenggunaanToken): number {
  const panjangPrompt = p.masuk + p.cacheTulis + p.cacheBaca;
  const atas = tarif.ambangToken > 0 && panjangPrompt > tarif.ambangToken;
  const masuk = atas ? tarif.masukAtas : tarif.masukPerJuta;
  const keluar = atas ? tarif.keluarAtas : tarif.keluarPerJuta;
  const tulis = atas ? tarif.cacheTulisAtas : tarif.cacheTulisPerJuta;
  const baca = atas ? tarif.cacheBacaAtas : tarif.cacheBacaPerJuta;
  return (p.masuk * masuk + p.keluar * keluar + p.cacheTulis * tulis + p.cacheBaca * baca) / 1_000_000;
}

export type IterasiPenggunaan = PenggunaanToken & { model: string };

/**
 * Biaya bila satu giliran melibatkan beberapa model (fallback server-side:
 * `usage.iterations`). Tiap iterasi memakai tarif modelnya sendiri; model yang
 * tarifnya tak dikenal memakai tarif model yang diminta.
 */
export function biayaUsdBanyak(tarifPerModel: ReadonlyMap<string, Tarif>, modelDiminta: string, iterasi: readonly IterasiPenggunaan[]): number {
  let jumlah = 0;
  for (const it of iterasi) {
    const tarif = tarifPerModel.get(it.model) ?? tarifPerModel.get(modelDiminta);
    if (tarif) jumlah += biayaUsd(tarif, it);
  }
  return jumlah;
}

export type ParameterHarga = {
  /** Keuntungan pengelola, persen (bawaan 30). */
  marginPersen: number;
  /** Penyangga kurs, persen (bawaan 3): kurs hari itu dinaikkan sedikit. */
  penyanggaKursPersen: number;
  /** Harga minimum per giliran (bawaan Rp1.000). */
  minimumRp: number;
  /** Kelipatan pembulatan KE ATAS (bawaan Rp500). */
  pembulatanRp: number;
  /** Biaya MDR QRIS, persen dari pokok harga (bawaan 1). Tidak diisi = 0. */
  mdrPersen?: number;
};

export const PARAMETER_HARGA_BAWAAN: ParameterHarga = {
  marginPersen: 30,
  penyanggaKursPersen: 3,
  minimumRp: 1000,
  pembulatanRp: 500,
  mdrPersen: 1,
};

/** Bulatkan ke atas ke kelipatan; galat kecil pecahan biner tidak menaikkan satu kelipatan penuh. */
export function bulatkanKeAtas(nilai: number, kelipatan: number): number {
  const k = kelipatan > 0 ? kelipatan : 1;
  if (!(nilai > 0)) return 0;
  const bagi = Number((nilai / k).toFixed(6));
  return Math.ceil(bagi) * k;
}

/** Kurs yang dipakai menagih = kurs hari itu x (1 + penyangga). */
export function kursEfektif(kursDasar: number, penyanggaKursPersen: number): number {
  return kursDasar * (1 + Math.max(0, penyanggaKursPersen) / 100);
}

export type HasilHarga = {
  kursDasar: number;
  kurs: number;
  /** Biaya API dalam rupiah pada kurs dasar (tanpa penyangga dan margin) - untuk laporan laba. */
  biayaApiRp: number;
  /** Bagian MDR QRIS dalam harga (pokok x persen MDR; 0 bila gratis) - untuk laporan laba. */
  biayaMdrRp: number;
  /** Harga menurut rumus sebelum pengecualian gratis. */
  hargaRp: number;
  /** Yang benar-benar ditagih (0 untuk Super Admin atau bila tak ada token terpakai). */
  tagihRp: number;
};

export function hitungHarga(biayaUsdNilai: number, kursDasar: number, param: ParameterHarga, opsi: { gratis?: boolean } = {}): HasilHarga {
  const kurs = kursEfektif(kursDasar, param.penyanggaKursPersen);
  const biayaApiRp = biayaUsdNilai * kursDasar;
  const pokok = biayaUsdNilai * kurs * (1 + Math.max(0, param.marginPersen) / 100);
  const mdr = pokok * (Math.max(0, param.mdrPersen ?? 0) / 100);
  const hargaRp = biayaUsdNilai > 0 ? Math.max(param.minimumRp, bulatkanKeAtas(pokok + mdr, param.pembulatanRp)) : 0;
  const tagihRp = opsi.gratis ? 0 : hargaRp;
  return { kursDasar, kurs, biayaApiRp, biayaMdrRp: tagihRp > 0 ? mdr : 0, hargaRp, tagihRp };
}

/** Perkiraan kasar token = karakter/4 (bila count_tokens tak tersedia, mis. tanpa kunci); dana yang ditahan memakai penyangga 1,5x. */
export function perkirakanTokenDariKarakter(karakter: number): number {
  return Math.ceil(Math.max(0, karakter) / 4);
}
