/**
 * Penolak tanda ALETA pada isian bebas yang tersimpan di SIPP - padanan
 * portal dari aleta_bot/services/tandaAletaService.js (harus sama persis;
 * penjaga tanpa-tanda-aleta-di-sipp-17okt menguji keduanya dengan contoh yang
 * sama). Keputusan 2 Okt & 17 Okt 2026 butir 45: tidak ada tanda ALETA di
 * database SIPP dalam bentuk apa pun - huruf besar/kecil, direnggangkan
 * ("A L E T A", "A.L.E.T.A"), huruf lebar/beraksen, aksara tak tampak.
 * Kalimat wajar seperti "kepala letak" tidak ikut tertolak.
 */

const TAK_TAMPAK = /[­͏؜ᅟᅠ឴឵᠎​-‏‪-‮⁠-⁤⁪-⁯﻿]/g;
const PEMISAH = "[\\s._\\-*·•/\\\\|,:;'\"`~+]*";
const RENGGANG = new RegExp(`(?<![a-z0-9])a${PEMISAH}l${PEMISAH}e${PEMISAH}t${PEMISAH}a(?![a-z0-9])`, "i");

/** Bentuk baku untuk diperiksa: NFKC, tanpa aksen, tanpa aksara tak tampak, huruf kecil. */
export function bakukanTeksAleta(teks: unknown): string {
  return String(teks ?? "")
    .normalize("NFKC")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(TAK_TAMPAK, "")
    .toLowerCase();
}

/** true bila teks menyebut ALETA dalam bentuk apa pun. */
export function menyebutAleta(teks: unknown): boolean {
  const t = bakukanTeksAleta(teks);
  if (!t) return false;
  return t.includes("aleta") || RENGGANG.test(t);
}

/**
 * Kalimat awam yang SAMA dengan penjaga bot (aleta_bot/services/penjagaTandaSipp.js
 * pesanIsian): menunjuk isiannya dan apa yang harus dilakukan.
 */
export function pesanTandaAletaSipp(kolom: string): string {
  const k = String(kolom || "").trim() || "ini";
  return `Isian "${k}" memuat kata 'ALETA'; hapus dulu sebelum disimpan ke SIPP.`;
}

/** Sebutan isian (kunci -> label) yang nilainya memuat kata itu; nilai kosong/non-teks dilewati. */
export function isianMemuatAleta(isian: Record<string, unknown>, label: (kunci: string) => string = (k) => k): string[] {
  const hasil: string[] = [];
  for (const [kunci, nilai] of Object.entries(isian)) {
    if (typeof nilai === "string" && menyebutAleta(nilai)) hasil.push(label(kunci));
  }
  return hasil;
}

/**
 * Peringatan untuk admin saat menyimpan isian yang memuat kata itu: penyimpanan
 * di ALETA tetap boleh, tetapi isian itu TIDAK akan bisa dikirim ke SIPP/ABT.
 * "" bila tidak ada.
 */
export function peringatanTandaAleta(daftarIsian: string[]): string {
  if (daftarIsian.length === 0) return "";
  const sebut = daftarIsian.map((x) => `"${x}"`).join(", ");
  return (
    `Isian ${sebut} memuat kata 'ALETA'. Boleh tersimpan di ALETA, tetapi TIDAK akan bisa dikirim ke SIPP/ABT ` +
    "(kata itu tidak boleh ada di server SIPP) - hapus dulu sebelum diterapkan."
  );
}
