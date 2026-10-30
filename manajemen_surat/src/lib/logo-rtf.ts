/**
 * ============================================================================
 * LOGO KOP DI RTF BLANGKO DERRY (27 Okt 2026; 30 Okt: logo tertanam) - MURNI
 * ============================================================================
 *
 * Sel kiri kop memuat penanda tak terlihat (grup huruf 1 pt berwarna putih) "@@LOGO@@". Sejak paket sampul-rapi-30okt penanda itu
 * DIIKUTI gambar logo monokrom satker yang tertanam di blangko (cetak langsung dari ABT pun berlogo). Portal mengganti penanda + gambar
 * tertanam dengan logo dari Identitas satker (monokrom tajam) bila ada; bila tidak ada, penanda dibuang dan gambar tertanam dibiarkan.
 * Blangko lama (penanda tanpa gambar) tetap dilayani: penanda diganti logo atau dibuang.
 */

export const PENANDA_LOGO = "@@LOGO@@";
/** Tinggi tampil logo kop (twip): 1,9 cm; lebar menurut perbandingan gambar. */
export const LOGO_KOP_TINGGI_TWIP = 1080;
const POLA_PENANDA = /\{\\fs2\\cf5 @@LOGO@@\}(\{\\pict[^{}]*\})?/g;

/** Grup gambar RTF dari PNG: ukuran tampil `tinggiTwip` (lebar menurut perbandingan); heksadesimal berbaris panjang. */
export function grupGambarPngRtf(png: Uint8Array, lebarPx: number, tinggiPx: number, tinggiTwip: number): string {
  if (!(lebarPx > 0) || !(tinggiPx > 0) || png.length < 8) return "";
  const lebarTwip = Math.max(1, Math.round((tinggiTwip * lebarPx) / tinggiPx));
  const hex = Buffer.from(png).toString("hex");
  const baris = hex.match(/.{1,120}/g) ?? [];
  return `{\\pict\\pngblip\\picw${lebarPx}\\pich${tinggiPx}\\picwgoal${lebarTwip}\\pichgoal${tinggiTwip}\n${baris.join("\n")}}`;
}

/**
 * Mengganti penanda logo (dan gambar tertanam sesudahnya) dengan grup gambar. `grupGambar` kosong = penanda dibuang, gambar tertanam
 * (bila ada) dibiarkan.
 */
export function sisipLogoRtf(rtf: string, grupGambar: string): string {
  return rtf.replace(POLA_PENANDA, (_m, tertanam?: string) => (grupGambar ? grupGambar : tertanam ?? ""));
}
