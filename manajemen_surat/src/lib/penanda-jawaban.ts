/**
 * ============================================================================
 * PENANDA "eksepsi" / "rekonvensi" DI KOLOM AGENDA JADWAL SIDANG (butir 4, 6 Okt 2026)
 * ============================================================================
 *
 * Dibaca dari jawaban dan duplik Tergugat/Termohon di arsip e-Court (lihat
 * lib/deteksi-eksepsi-rekonvensi.ts dan aleta_bot penandaJawabanService).
 * Bot mengirim per perkara:
 *
 *   penandaJawaban: {
 *     eksepsi, rekonvensi: null                 tidak satu pun berkas terbaca
 *                        | { keadaan: "ada" | "tidak" | "", dokumen,
 *                            jenisDokumen, diunggah, kalimat, sumber }
 *     dokumen, berkas, dibaca, belumDibaca, tidakTerbaca
 *   } | null                                    perkara tanpa jawaban/duplik
 *   penandaJawabanTerbaca: false                kuerinya gagal
 *
 * Penanda HANYA untuk keadaan "ada". "tidak" (disangkal tegas), "" (tidak
 * disebut), null (tidak terbaca), dan kueri gagal semuanya DIAM - tidak
 * terbaca tidak boleh tampil sebagai "tidak ada eksepsi".
 */

export type TemuanJawaban = {
  keadaan: "ada" | "tidak" | "";
  dokumen: string;
  jenisDokumen: string;
  diunggah: string;
  kalimat: string;
  sumber: "teks" | "ocr";
};

export type PenandaJawabanPerkara = {
  eksepsi: TemuanJawaban | null;
  rekonvensi: TemuanJawaban | null;
  dokumen: number;
  berkas: number;
  dibaca: number;
  belumDibaca: number;
  tidakTerbaca: number;
};

export type BarisPenandaJawaban = {
  nomorPerkara: string;
  penandaJawaban?: PenandaJawabanPerkara | null;
  penandaJawabanTerbaca?: boolean;
};

export type PenandaJawaban = { kunci: "eksepsi" | "rekonvensi"; label: string; kelas: string; keterangan: string };

/**
 * Dua warna yang tidak dipakai penanda lain di kolom Agenda (biru muda =
 * Mediasi, fuchsia = mediator, hijau/merah/abu = hasil mediasi): eksepsi
 * jingga berbingkai, rekonvensi biru tua pekat. Bentuknya pun berbeda
 * (berbingkai vs pekat), supaya tetap terbeda tanpa melihat warna.
 */
export const KELAS_PENANDA_JAWABAN = {
  eksepsi: "bg-orange-100 text-orange-900 ring-1 ring-orange-500 dark:bg-orange-950/70 dark:text-orange-100 dark:ring-orange-500",
  rekonvensi: "bg-blue-800 text-white dark:bg-blue-600",
} as const;

const NAMA = { eksepsi: "Eksepsi", rekonvensi: "Rekonvensi (gugatan balik)" } as const;

function keterangan(jenis: "eksepsi" | "rekonvensi", t: TemuanJawaban): string {
  const asal = `${t.jenisDokumen ? `${t.jenisDokumen} Tergugat` : "Dokumen Tergugat"} "${t.dokumen}"${
    t.diunggah ? ` (diunggah ${t.diunggah})` : ""
  }${t.sumber === "ocr" ? ", dibaca dari pindaian (OCR) - periksa naskahnya" : ""}`;
  return `${NAMA[jenis]} diajukan - terbaca dari ${asal}.\nKalimat: "${t.kalimat}"\nDitekan = membuka Status Perkara.`;
}

/** Penanda yang dinyalakan untuk satu baris jadwal; [] bila tidak ada atau tidak terbaca. */
export function penandaJawabanBaris(baris: BarisPenandaJawaban): PenandaJawaban[] {
  if (baris.penandaJawabanTerbaca === false) return [];
  const p = baris.penandaJawaban;
  if (!p) return [];
  const hasil: PenandaJawaban[] = [];
  for (const jenis of ["eksepsi", "rekonvensi"] as const) {
    const t = p[jenis];
    if (!t || t.keadaan !== "ada") continue;
    hasil.push({ kunci: jenis, label: jenis, kelas: KELAS_PENANDA_JAWABAN[jenis], keterangan: keterangan(jenis, t) });
  }
  return hasil;
}
