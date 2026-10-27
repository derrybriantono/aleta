/**
 * ============================================================================
 * LOGO KOP DI RTF BLANGKO DERRY (27 Okt 2026) - MURNI
 * ============================================================================
 *
 * RTF paket ABT memuat penanda tak terlihat (grup huruf 1 pt berwarna putih) "@@LOGO@@" di sel kiri kop. Portal menggantinya dengan gambar PNG monokrom
 * logo satker aktif (identitas satker; bukan logo tertanam di blangko, jadi blangko tetap universal per satker). Tanpa panel (dibuka langsung di ABT)
 * atau tanpa logo, penanda dibuang atau dibiarkan tak terlihat: kop tetap benar tanpa logo.
 */

export const PENANDA_LOGO = "@@LOGO@@";
const POLA_PENANDA = /\{\\fs2\\cf5 @@LOGO@@\}/g;

/** Grup gambar RTF dari PNG: ukuran tampil `tinggiTwip` (lebar menurut perbandingan); heksadesimal berbaris panjang. */
export function grupGambarPngRtf(png: Uint8Array, lebarPx: number, tinggiPx: number, tinggiTwip: number): string {
  if (!(lebarPx > 0) || !(tinggiPx > 0) || png.length < 8) return "";
  const lebarTwip = Math.max(1, Math.round((tinggiTwip * lebarPx) / tinggiPx));
  const hex = Buffer.from(png).toString("hex");
  const baris = hex.match(/.{1,120}/g) ?? [];
  return `{\\pict\\pngblip\\picw${lebarPx}\\pich${tinggiPx}\\picwgoal${lebarTwip}\\pichgoal${tinggiTwip}\n${baris.join("\n")}}`;
}

/** Mengganti penanda logo dengan grup gambar (atau membuangnya bila logo kosong). */
export function sisipLogoRtf(rtf: string, grupGambar: string): string {
  return rtf.replace(POLA_PENANDA, () => grupGambar);
}
