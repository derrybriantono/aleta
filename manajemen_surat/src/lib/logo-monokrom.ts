/**
 * ============================================================================
 * LOGO KOP MONOKROM YANG TAJAM (30 Okt 2026) - MURNI
 * ============================================================================
 *
 * Permintaan pengguna: logo asli satker berwarna (hijau-emas), di sampul/daftar isi/lampiran/ceklist dicetak MONOKROM yang jelas, tidak kabur.
 * Skala abu-abu biasa membuat hijau dan emas menjadi abu-abu sedang yang pudar di printer laser. Cara yang dipilih (dibandingkan dengan ambang
 * Otsu dan difusi galat - lihat laporan agen sampul-rapi 30 Okt) adalah gaya CAP/STEMPEL: unsur bergaris (cincin, tulisan, matahari, pita,
 * untaian, perisai) menjadi hitam pekat, bidang hijau menjadi putih. Hasil satu bit (hitam/putih murni), diperkecil dari sumber resolusi
 * tertinggi dengan Lanczos sebelum diambang, sehingga tepi rata tanpa abu-abu.
 *
 * Penggolongan per piksel (bidang logo pengadilan: hijau polos dengan merah dan biru hampir nol):
 *   emas/kuning, merah, gelap (hitam/cokelat), dan hijau LAIN (pohon beringin: hijau bercampur biru) -> hitam; selebihnya putih.
 * Logo yang bukan bergaya bidang hijau (bidang hijau polos < 15% piksel tampak) memakai ambang Otsu atas kecerahan: gelap -> hitam.
 * Latar transparan selalu putih.
 */

export type GambarRgba = { data: Uint8Array; lebar: number; tinggi: number };

const kecerahan = (r: number, g: number, b: number) => 0.299 * r + 0.587 * g + 0.114 * b;

/** Ambang Otsu atas nilai 0..255. */
export function ambangOtsu(nilai: ArrayLike<number>): number {
  const hist = new Array<number>(256).fill(0);
  for (let i = 0; i < nilai.length; i += 1) hist[Math.max(0, Math.min(255, Math.round(nilai[i])))] += 1;
  const n = nilai.length;
  let total = 0;
  for (let i = 0; i < 256; i += 1) total += i * hist[i];
  let sB = 0;
  let wB = 0;
  let terbaik = -1;
  let ambang = 128;
  for (let i = 0; i < 256; i += 1) {
    wB += hist[i];
    if (!wB) continue;
    const wF = n - wB;
    if (!wF) break;
    sB += i * hist[i];
    const beda = wB * wF * (sB / wB - (total - sB) / wF) ** 2;
    if (beda > terbaik) {
      terbaik = beda;
      ambang = i;
    }
  }
  return ambang;
}

/** Bidang hijau polos (latar logo pengadilan). */
export function hijauPolos(r: number, g: number, b: number): boolean {
  return g > 60 && r < 40 && b < 40;
}

/** Unsur bergaris logo bergaya bidang hijau: true = cetak hitam. */
export function unsurGaris(r: number, g: number, b: number): boolean {
  if (Math.min(r, g, b) > 200) return false; // putih (perisai)
  const emas = r > 120 && g > 100 && b < 0.6 * Math.min(r, g) && r > 0.65 * g;
  const merah = r > 150 && g < 110 && b < 110;
  const gelap = Math.max(r, g, b) < 70;
  const hijauLain = g > 90 && r > 18 && b > 35 && r < 140 && b < 160 && g > r + 40;
  return emas || merah || gelap || hijauLain;
}

/** RGBA -> satu kanal hitam (0) / putih (255). */
export function monokromTajam(g: GambarRgba): { data: Uint8Array; cara: "garis" | "otsu" } {
  const n = g.lebar * g.tinggi;
  const keluar = new Uint8Array(n).fill(255);
  let tampak = 0;
  let hijau = 0;
  for (let i = 0; i < n; i += 1) {
    if (g.data[i * 4 + 3] < 128) continue;
    tampak += 1;
    if (hijauPolos(g.data[i * 4], g.data[i * 4 + 1], g.data[i * 4 + 2])) hijau += 1;
  }
  if (tampak > 0 && hijau / tampak >= 0.15) {
    for (let i = 0; i < n; i += 1) {
      if (g.data[i * 4 + 3] < 128) continue;
      if (unsurGaris(g.data[i * 4], g.data[i * 4 + 1], g.data[i * 4 + 2])) keluar[i] = 0;
    }
    return { data: keluar, cara: "garis" };
  }
  const abu = new Float32Array(n);
  for (let i = 0; i < n; i += 1) {
    const a = g.data[i * 4 + 3] / 255;
    abu[i] = 255 * (1 - a) + a * kecerahan(g.data[i * 4], g.data[i * 4 + 1], g.data[i * 4 + 2]);
  }
  const t = ambangOtsu(abu);
  for (let i = 0; i < n; i += 1) if (Math.round(abu[i]) <= t) keluar[i] = 0;
  return { data: keluar, cara: "otsu" };
}
