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
