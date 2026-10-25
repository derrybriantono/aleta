/**
 * Singgahan singkat di memori portal untuk bacaan bot yang berat dan sering
 * diulang (performa muat 19 Okt 2026; K2 25 Okt 2026).
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
 * 3. TULISAN MEMBATALKAN SEKETIKA, HANYA YANG TERKENA (K2, 25 Okt 2026).
 *    Setiap tulisan lewat bot (tunda, putus, kehadiran, panggilan, ...)
 *    memanggil tandaiTulisan(terkena): singgahan di ruang yang terkena
 *    dibuang (dan, bila tanggalnya diketahui, hanya kunci yang rentangnya
 *    memuat tanggal itu), dan bacaan yang SEDANG berjalan di sana tidak
 *    disimpan - jawabannya bisa jadi dibaca sebelum tulisan masuk. Petugas
 *    yang baru menyimpan tidak pernah melihat data sebelum simpanannya.
 *    Tanpa keterangan `terkena`, SEMUANYA dibuang seperti dulu: tidak tahu
 *    = buang, bukan simpan.
 *
 * Tiap pemanggil menerima salinan sendiri: rute yang mengubah jawaban di
 * tempat tidak boleh mencemari jawaban rute lain. Jawaban diserialisasi SEKALI
 * (teks JSON) saat disimpan; pemanggil berikutnya mem-parse teks itu, bukan
 * structuredClone objek sampai 1 MB pada setiap panggilan.
 *
 * Hanya di memori satu proses portal - tidak ada yang ditulis ke mana pun.
 */

/** Rentang tanggal (YYYY-MM-DD, inklusif) yang dicakup satu kunci, bila diketahui. */
export type Cakupan = { dari: string; sampai: string };

/**
 * Yang terkena sebuah tulisan.
 *  - `ruang` kosong ([]): tulisan tidak menyentuh data yang disinggahkan.
 *  - `ruang` terisi: hanya ruang itu yang dibuang.
 *  - `tanggal` terisi: di ruang bercakupan tanggal, hanya kunci yang
 *    rentangnya memuat salah satu tanggal itu; kunci tanpa cakupan yang
 *    diketahui tetap dibuang (tidak tahu = buang).
 */
export type Terkena = { ruang: string[]; tanggal?: string[] };

type Entri = {
  /** Jawaban sebagai teks JSON (bentuk utama). */
  teks?: string;
  /** Cadangan bila jawaban tak dapat di-JSON-kan; disalin saat dibaca. */
  nilai?: unknown;
  kedaluwarsa: number;
  ruang: string;
  cakupan?: Cakupan;
};
type Hasil = { nilai: unknown; teks?: string };
type Berjalan = { janji: Promise<Hasil>; ruang: string; cakupan?: Cakupan; batal: boolean };

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

/** Teks JSON jawaban, atau undefined bila tidak dapat dibuat. Dibuat SEKALI. */
function keTeks(nilai: unknown): string | undefined {
  if (nilai === null || typeof nilai !== "object") return undefined;
  try {
    const teks = JSON.stringify(nilai);
    return typeof teks === "string" ? teks : undefined;
  } catch {
    return undefined;
  }
}

function dariEntri<T>(entri: Entri): T {
  if (entri.teks !== undefined) return JSON.parse(entri.teks) as T;
  return salin(entri.nilai as T);
}

function dariHasil<T>(hasil: Hasil): T {
  if (hasil.teks !== undefined) return JSON.parse(hasil.teks) as T;
  return salin(hasil.nilai as T);
}

export type PilihanSinggah<T> = {
  /** Hanya jawaban yang memenuhi ini yang disimpan (mis. GatewayResult ok). */
  simpanBila?: (nilai: T) => boolean;
  /** Jam untuk uji. */
  sekarang?: () => number;
  /** Rentang tanggal yang dicakup kunci ini; dipakai tulisan bertanggal. */
  cakupan?: Cakupan;
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
  if (ada && ada.kedaluwarsa > jam()) return dariEntri<T>(ada);
  if (ada) simpanan.delete(k);

  const sedang = berjalan.get(k);
  if (sedang) return dariHasil<T>(await sedang.janji);

  const catatan: Berjalan = {
    janji: undefined as unknown as Promise<Hasil>,
    ruang,
    cakupan: pilihan.cakupan,
    batal: false,
  };
  catatan.janji = (async (): Promise<Hasil> => {
    const nilai = await kerja();
    // Tulisan terkena terjadi selama bacaan ini berjalan: jawabannya mungkin
    // dibaca sebelum tulisan masuk, jadi TIDAK disimpan.
    if (!catatan.batal && (!pilihan.simpanBila || pilihan.simpanBila(nilai))) {
      if (simpanan.size >= BATAS_KUNCI) {
        const tertua = simpanan.keys().next().value;
        if (tertua !== undefined) simpanan.delete(tertua);
      }
      const teks = keTeks(nilai);
      simpanan.set(
        k,
        teks !== undefined
          ? { teks, kedaluwarsa: jam() + ttlMs, ruang, cakupan: pilihan.cakupan }
          : { nilai: salin(nilai), kedaluwarsa: jam() + ttlMs, ruang, cakupan: pilihan.cakupan }
      );
      return { nilai, teks };
    }
    return { nilai };
  })();
  berjalan.set(k, catatan);
  try {
    // Pemrakarsa menerima jawabannya sendiri tanpa salinan bila yang disimpan
    // adalah teks terpisah (perubahannya tidak mencemari singgahan maupun
    // penunggu, yang mem-parse teks itu). Tanpa teks, penunggu menyalin objek
    // yang sama, jadi pemrakarsa pun menerima salinan.
    const hasil = await catatan.janji;
    return (hasil.teks !== undefined ? hasil.nilai : salin(hasil.nilai)) as T;
  } finally {
    if (berjalan.get(k) === catatan) berjalan.delete(k);
  }
}

/**
 * Melihat singgahan TANPA menjalankan apa pun: salinan jawaban yang masih
 * berlaku, atau undefined. Dipakai untuk meminjam jawaban kunci yang lebih
 * lengkap (mis. layar publik memakai jawaban layar Jadwal).
 */
export function intipSinggah<T>(ruang: string, kunci: string, jam: () => number = Date.now): T | undefined {
  const ada = simpanan.get(kunciPenuh(ruang, kunci));
  if (!ada || ada.kedaluwarsa <= jam()) return undefined;
  return dariEntri<T>(ada);
}

function mencakup(cakupan: Cakupan | undefined, tanggal: string[] | undefined) {
  if (!tanggal || tanggal.length === 0 || !cakupan) return true;
  return tanggal.some((t) => t >= cakupan.dari && t <= cakupan.sampai);
}

/**
 * Sesuatu ditulis: singgahan yang terkena dibuang dan bacaan yang sedang
 * berjalan di sana tidak akan disimpan. Murah - boleh dipanggil pada setiap
 * tulisan. Tanpa `terkena`, SEMUANYA dibuang (perilaku lama).
 */
export function tandaiTulisan(terkena?: Terkena) {
  if (!terkena) {
    generasi += 1;
    simpanan.clear();
    for (const b of berjalan.values()) b.batal = true;
    berjalan.clear();
    return;
  }
  if (terkena.ruang.length === 0) return;
  generasi += 1;
  const ruang = new Set(terkena.ruang);
  for (const [k, e] of [...simpanan]) {
    if (ruang.has(e.ruang) && mencakup(e.cakupan, terkena.tanggal)) simpanan.delete(k);
  }
  for (const [k, b] of [...berjalan]) {
    if (ruang.has(b.ruang) && mencakup(b.cakupan, terkena.tanggal)) {
      b.batal = true;
      berjalan.delete(k);
    }
  }
}

/** Membuang singgahan satu ruang saja (atau semuanya bila tanpa ruang). */
export function bersihkanSinggah(ruang?: string) {
  if (!ruang) {
    tandaiTulisan();
    return;
  }
  tandaiTulisan({ ruang: [ruang] });
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
