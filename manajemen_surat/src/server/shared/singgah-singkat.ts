/**
 * Singgahan singkat di memori portal untuk bacaan bot yang berat dan sering
 * diulang (performa muat 19 Okt 2026).
 *
 * ============================================================================
 * TIGA HAL YANG DIJAMIN
 * ============================================================================
 *
 * 1. PERMINTAAN SERENTAK DISATUKAN. Dua tab, widget ekstensi, dan layar
 *    publik yang menanyakan jadwal yang sama pada detik yang sama menunggu
 *    SATU kueri SIPP, bukan masing-masing satu.
 *
 * 2. UMURNYA PENDEK DAN BERBATAS. Jawaban berlaku `ttlMs` milidetik saja
 *    (jadwal sidang: 4 detik - lebih pendek dari putaran muat ulang layar).
 *    Isian yang diubah langsung di SIPP, di luar ALETA, tampil paling lambat
 *    selama itu.
 *
 * 3. TULISAN MEMBATALKAN SEKETIKA. Setiap tulisan lewat bot (tunda, putus,
 *    kehadiran, panggilan, ...) memanggil tandaiTulisan(): seluruh singgahan
 *    dibuang, dan bacaan yang SEDANG berjalan saat tulisan itu terjadi tidak
 *    disimpan - jawabannya bisa jadi dibaca sebelum tulisan masuk. Petugas
 *    yang baru menyimpan tidak pernah melihat data sebelum simpanannya.
 *
 * Tiap pemanggil menerima SALINAN (structuredClone): rute yang mengubah
 * jawaban di tempat tidak boleh mencemari jawaban rute lain.
 *
 * Hanya di memori satu proses portal - tidak ada yang ditulis ke mana pun.
 */

type Entri = { nilai: unknown; kedaluwarsa: number };
type Berjalan = { janji: Promise<unknown>; generasi: number };

const simpanan = new Map<string, Entri>();
const berjalan = new Map<string, Berjalan>();
let generasi = 0;

/** Batas banyaknya kunci yang diingat, supaya rentang acak tidak menumpuk. */
const BATAS_KUNCI = 200;

function salin<T>(nilai: T): T {
  if (nilai === null || typeof nilai !== "object") return nilai;
  try {
    return structuredClone(nilai);
  } catch {
    return nilai;
  }
}

function kunciPenuh(ruang: string, kunci: string) {
  return `${ruang}\u0000${kunci}`;
}

export type PilihanSinggah<T> = {
  /** Hanya jawaban yang memenuhi ini yang disimpan (mis. GatewayResult ok). */
  simpanBila?: (nilai: T) => boolean;
  /** Jam untuk uji. */
  sekarang?: () => number;
};

/**
 * Menjalankan `kerja` paling banyak sekali per `ttlMs` untuk kunci yang sama,
 * dan menyatukan pemanggil serentak. ttlMs <= 0 = tanpa singgahan sama sekali.
 */
export async function singgahSingkat<T>(
  ruang: string,
  kunci: string,
  ttlMs: number,
  kerja: () => Promise<T>,
  pilihan: PilihanSinggah<T> = {}
): Promise<T> {
  if (!(ttlMs > 0)) return kerja();
  const jam = pilihan.sekarang ?? Date.now;
  const k = kunciPenuh(ruang, kunci);

  const ada = simpanan.get(k);
  if (ada && ada.kedaluwarsa > jam()) return salin(ada.nilai as T);
  if (ada) simpanan.delete(k);

  const sedang = berjalan.get(k);
  if (sedang && sedang.generasi === generasi) return salin((await sedang.janji) as T);

  const generasiMulai = generasi;
  const janji = (async () => {
    const nilai = await kerja();
    // Tulisan terjadi selama bacaan ini berjalan: jawabannya mungkin dibaca
    // sebelum tulisan masuk, jadi TIDAK disimpan.
    if (generasi === generasiMulai && (!pilihan.simpanBila || pilihan.simpanBila(nilai))) {
      if (simpanan.size >= BATAS_KUNCI) {
        const tertua = simpanan.keys().next().value;
        if (tertua !== undefined) simpanan.delete(tertua);
      }
      simpanan.set(k, { nilai, kedaluwarsa: jam() + ttlMs });
    }
    return nilai;
  })();
  berjalan.set(k, { janji, generasi: generasiMulai });
  try {
    return salin(await janji);
  } finally {
    const kini = berjalan.get(k);
    if (kini && kini.janji === janji) berjalan.delete(k);
  }
}

/**
 * Sesuatu ditulis: seluruh singgahan dibuang dan bacaan yang sedang berjalan
 * tidak akan disimpan. Murah - boleh dipanggil pada setiap tulisan.
 */
export function tandaiTulisan() {
  generasi += 1;
  simpanan.clear();
  berjalan.clear();
}

/** Membuang singgahan satu ruang saja (atau semuanya bila tanpa ruang). */
export function bersihkanSinggah(ruang?: string) {
  if (!ruang) {
    tandaiTulisan();
    return;
  }
  const awalan = `${ruang}\u0000`;
  for (const k of [...simpanan.keys()]) if (k.startsWith(awalan)) simpanan.delete(k);
  for (const k of [...berjalan.keys()]) if (k.startsWith(awalan)) berjalan.delete(k);
}

/** Lama singgahan (ms) dari env, dengan bawaan; "0" mematikan. */
export function ttlDariEnv(nama: string, bawaan: number) {
  const mentah = process.env[nama];
  if (mentah === undefined || mentah === "") return bawaan;
  const angka = Number(mentah);
  return Number.isFinite(angka) && angka >= 0 ? angka : bawaan;
}

/** Untuk uji: keadaan dalam. */
export function keadaanSinggah() {
  return { kunci: simpanan.size, berjalan: berjalan.size, generasi };
}
