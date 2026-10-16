"use strict";

/**
 * Penolak tanda ALETA pada isian bebas yang tersimpan di SIPP - SATU aturan
 * untuk semua jalur tulis (tunda sidang, Court Calendar, penetapan kembali
 * "Lainnya"). Keputusan 2 Okt & 17 Okt 2026 butir 45: tidak boleh ada tanda
 * ALETA di database SIPP dalam bentuk apa pun.
 *
 * Dikenali:
 *   - "ALETA", "aleta", "Aleta" - huruf besar/kecil apa pun, juga di dalam kata
 *     ("viaALETA", "ALETA-bot");
 *   - huruf yang direnggangkan: "A L E T A", "A.L.E.T.A", "a-l-e-t-a",
 *     "ALE TA" - asal berdiri sebagai kata sendiri, supaya kalimat wajar
 *     seperti "kepala letak" tidak ikut tertolak;
 *   - huruf lebar/berhias (NFKC: "ＡＬＥＴＡ"), huruf beraksen ("Alétà"), dan
 *     aksara tak tampak (zero-width) yang diselipkan di antaranya.
 *
 * Padanan portal: manajemen_surat/src/lib/tanda-aleta.ts (harus sama persis).
 */

const TAK_TAMPAK = /[­͏؜ᅟᅠ឴឵᠎​-‏‪-‮⁠-⁤⁪-⁯﻿]/g;
const PEMISAH = "[\\s._\\-*·•/\\\\|,:;'\"`~+]*";
const RENGGANG = new RegExp(`(?<![a-z0-9])a${PEMISAH}l${PEMISAH}e${PEMISAH}t${PEMISAH}a(?![a-z0-9])`, "i");

/** Bentuk baku untuk diperiksa: NFKC, tanpa aksen, tanpa aksara tak tampak, huruf kecil. */
function bakukan(teks) {
  return String(teks == null ? "" : teks)
    .normalize("NFKC")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(TAK_TAMPAK, "")
    .toLowerCase();
}

/** true bila teks menyebut ALETA dalam bentuk apa pun (lihat atas). */
function menyebutAleta(teks) {
  const t = bakukan(teks);
  if (!t) return false;
  return t.includes("aleta") || RENGGANG.test(t);
}

module.exports = { menyebutAleta, bakukan };
