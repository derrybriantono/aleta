"use strict";

/**
 * ============================================================================
 * KALIMAT PENUTUP KETERANGAN SAKSI - BENTUK LENTUR (16 Okt 2026, F1.3)
 * ============================================================================
 *
 * Cermin dari adalahKalimatPenutupSaksi di ekstensi-sipp/abt.js: keduanya
 * dijaga satu tabel contoh oleh uji (penutup-saksi-lentur.test.ts) supaya tidak
 * berpisah jalan. Ekstensi tidak dapat memuat berkas ini (berjalan di
 * peramban), jadi isinya ditulis dua kali dan dijaga uji.
 *
 * Yang dibuang hanya baris yang SELURUHNYA kalimat penutup: subjek saya/saksi,
 * kata sudah/telah, satu atau beberapa inti penutup, dan "terima kasih".
 * Satu kata di luar itu membuat baris tersebut BUKAN penutup ("Sekian lama ia
 * pergi", "sudah cukup lama berpisah", "tidak sanggup lagi merukunkan
 * keduanya"). "Tidak sanggup" tanpa kata "lagi" juga tidak dibuang: itu bisa
 * jawaban atas "sanggupkah saksi mendamaikan?".
 */

const PENUTUP_SUBJEK = "(?:(?:saya|saksi|aku)\\s+)?";
const PENUTUP_WAKTU = "(?:(?:sudah|telah|memang|sekarang)\\s+)*";
const PENUTUP_KERJA = "(?:untuk\\s+)?(?:menjawab|memberi(?:kan)?\\s+keterangan|menerangkan|menjelaskan|melanjutkan|berbicara|bicara)";
const PENUTUP_INTI = [
  "cukup(?:\\s+sekian)?(?:\\s+(?:saja|dulu|sampai\\s+di\\s+sini))?",
  "sekian(?:\\s+(?:saja|dulu))?(?:\\s+(?:keterangan|jawaban)\\s+(?:saya|saksi))?",
  "sampai\\s+di\\s+sini(?:\\s+saja)?",
  // 17 Okt: "tidak kuat/mampu lagi" tanpa kata kerja menjawab/menerangkan = keterangan perkara.
  "(?:tidak|belum)\\s+sanggup\\s+lagi(?:\\s+" + PENUTUP_KERJA + ")?",
  "(?:tidak|belum)\\s+(?:kuat|mampu)\\s+lagi\\s+" + PENUTUP_KERJA,
  "(?:tidak|belum)\\s+lagi\\s+sanggup(?:\\s+" + PENUTUP_KERJA + ")?",
  "(?:tidak|belum)\\s+lagi\\s+(?:kuat|mampu)\\s+" + PENUTUP_KERJA,
  "(?:tidak|belum)\\s+(?:sanggup|kuat|mampu)\\s+" + PENUTUP_KERJA + "(?:\\s+lagi)?",
  "(?:sudah\\s+)?tidak\\s+ada\\s+(?:lagi\\s+)?(?:yang\\s+)?(?:(?:ingin|akan|hendak|mau|perlu|dapat|bisa)\\s+)?(?:(?:saya|saksi)\\s+)?(?:sampaikan|disampaikan|terangkan|diterangkan|tambahkan|ditambahkan|jelaskan|dijelaskan|katakan|dikatakan|ketahui|diketahui)(?:\\s+lagi)?",
  "(?:sudah\\s+)?tidak\\s+ada\\s+(?:lagi\\s+)?(?:keterangan|jawaban|hal|tambahan)(?:\\s+(?:lain|tambahan|lagi))*(?:\\s+(?:dari|yang)\\s+(?:saya|saksi)(?:\\s+(?:sampaikan|terangkan|ketahui))?)?",
  "(?:hanya\\s+itu|itu\\s+saja|hanya\\s+demikian)(?:\\s+saja)?(?:\\s+yang)?\\s+(?:saya|saksi)\\s+(?:ketahui|terangkan|sampaikan|ketahui\\s+dan\\s+sampaikan)",
  "demikian(?:\\s+saja)?\\s+(?:keterangan|jawaban)\\s+(?:saya|saksi)",
];
const PENUTUP_SATU = PENUTUP_SUBJEK + PENUTUP_WAKTU + "(?:" + PENUTUP_INTI.join("|") + ")";
const POLA_PENUTUP_LENTUR = new RegExp(
  "^(?:(?:tidak\\s+ada|tidak|ya|iya|baik)\\s*,\\s*)?" +
    PENUTUP_SATU +
    "(?:\\s*(?:,|dan|serta)\\s*" +
    PENUTUP_SATU +
    ")*(?:\\s*(?:,|dan)?\\s*terima\\s+kasih)?$",
  "i"
);

/** Baris seluruhnya kalimat penutup? Awalan "Bahwa", tanda butir, dan tanda baca ujung tidak dihitung. */
function adalahKalimatPenutupSaksi(baris) {
  const inti = String(baris || "")
    .replace(/^[\s\-–•*]+/, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^bahwa[\s,]*/i, "")
    .replace(/[\s;.,!:]+$/, "")
    .trim();
  // 17 Okt (keputusan pengguna): "tidak ada yang (saya) ketahui" tanpa "lagi"/"lain" bisa jawaban
  // atas pertanyaan perkara ("tahukah saksi sebabnya?") - tinggal. Dengan "lagi"/"lain" = penutup.
  if (/\btidak\s+ada\b/i.test(inti) && /\b(?:ketahui|diketahui)\b/i.test(inti) && !/\b(?:lagi|lain)\b/i.test(inti)) return false;
  return inti !== "" && POLA_PENUTUP_LENTUR.test(inti);
}

module.exports = { adalahKalimatPenutupSaksi, POLA_PENUTUP_LENTUR };
