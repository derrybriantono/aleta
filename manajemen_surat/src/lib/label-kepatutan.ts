/**
 * Sebutan panggilan yang tidak patut menurut jalur yang DITEMPUH.
 *
 * Hakim membedakan "tidak patut (jurusita)" dari "tidak patut (pos)": tindak
 * lanjutnya berbeda - panggilan jurusita diulang oleh jurusita, surat tercatat
 * ditelusuri atau dikirim ulang lewat pos (keputusan pengguna 19 Oktober 2026).
 */
export function sebutanJalurTidakPatut(jalur: string | null | undefined): string {
  const j = String(jalur || "").toLowerCase();
  if (j === "surat_tercatat" || j === "pos") return "pos";
  if (j === "elektronik") return "elektronik";
  if (j === "pengumuman") return "pengumuman";
  if (j === "biasa" || j === "langsung") return "jurusita";
  return "";
}

export function labelTidakPatut(jalur: string | null | undefined): string {
  const s = sebutanJalurTidakPatut(jalur);
  return s ? `tidak patut (${s})` : "tidak patut";
}
