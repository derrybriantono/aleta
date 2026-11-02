import { createHash } from "node:crypto";

/**
 * ============================================================================
 * P2 (1 Nov 2026) - MATRIKS DALIL SATU SUMBER: BENTUK DATA & SIDIK BERKAS
 * ============================================================================
 *
 * Bentuk dalil yang disusun bot (aleta_bot/services/matriksDalilService.js) dan disimpan portal per perkara
 * (aleta_matriks_dalil, migrasi 0126). Dipakai panel "Peta dalil" (ekstensi), rincian alasan 5227, keterangan saksi,
 * ALETA Ai, dan agen A1 (draf putusan) / A2 (penilai pembuktian).
 *
 * `sidikBerkas` menentukan kapan matriks dihitung ulang: daftar berkas e-Court perkara (kunci, jenis, pengunggah, waktu unggah,
 * ada PDF/Word). Berkas baru masuk = sidik berubah = dihitung ulang sendiri saat dibaca berikutnya (tanpa tombol).
 */

export type SumberDalil = "gugatan" | "jawaban" | "replik" | "duplik" | "kesimpulan" | "rekonvensi";
export type JenisDalil = "posita-fakta" | "alasan-hukum" | "petitum";
export type StatusTanggapan = "diakui" | "dibantah" | "diakui-sebagian" | "tidak-jelas" | "tidak-ditanggapi" | "belum-dijawab";

export type RincianTanggapan = {
  dari: string;
  sumber: SumberDalil;
  nomor: string;
  status: StatusTanggapan;
  cara: "rujukan" | "rujukan-induk" | "kemiripan" | "umum" | "umum-petitum";
  kutipan: string;
  diunggah?: string;
  skor?: number;
};

export type Dalil = {
  id: string;
  sumber: SumberDalil;
  pihak: "0046" | "0047";
  sebutan: string;
  bagian: "pokok" | "eksepsi" | "provisi" | "konvensi" | "rekonvensi";
  nomor: string;
  urut: number;
  induk: string | null;
  lanjutan: string | null;
  nomorDariUrutan?: boolean;
  pembuka?: boolean;
  teks: string;
  ringkas: string;
  jenis: JenisDalil;
  huruf: string[];
  tanggapan: { status: StatusTanggapan; ragu: boolean; cara?: string; catatan?: string; rincian: RincianTanggapan[] } | null;
  /** Status pembuktian (agen A2): disimpan terpisah di kolom `pembuktian`, digabung saat dibaca. */
  pembuktian: PembuktianDalil | null;
  asal: "ecourt" | "sipp";
  dokumen: string;
  diunggah: string;
  ocr: boolean;
  berkas: number;
};

export type PembuktianDalil = {
  status: "terbukti" | "belum-terbukti" | "bertentangan" | "tidak-perlu-dibuktikan" | "";
  catatan?: string;
  oleh?: string;
  pada?: string;
  /** A2: kekuatan pembuktian (sempurna/cukup/lemah) dan dasar (saksi mana, bukti mana) - diisi penilai aturan. */
  kekuatan?: "sempurna" | "cukup" | "lemah" | "";
  dasar?: { saksi: string[]; bukti: string[] };
  /** A2: sidik bahan (saksi + bukti) saat status aturan dihitung. */
  sidik?: string;
  /** Keputusan 116 (2 Nov): tanda syarat yang belum terpenuhi ("belum memenuhi 12 bulan" - SEMA 1/2022), catatan saja. */
  tanda?: string[];
};

export type MatriksDalil = {
  versi: number;
  sumberGugatan: "ecourt" | "sipp" | "";
  dalil: Dalil[];
  dokumen: Array<{ indeks: number; judul: string; sumber: string; pihak: string; diunggah: string; baca: "teks" | "ocr"; jumlah: number; ragu: boolean }>;
  ringkas: {
    jumlah: number;
    perSumber: Record<string, number>;
    perJenis: Record<string, number>;
    tanggapan: Record<string, number>;
    ragu: number;
    huruf: string[];
  };
  catatan: string[];
  ms: number;
};

type BerkasSidik = { documentKey: string; jenisDokumen?: string; peranPengunggah?: string; diunggahPada?: string | null; adaPdf: boolean; adaWord: boolean };

/** Sidik daftar berkas e-Court (urutan tidak berpengaruh). "" bila tidak ada berkas. */
export function sidikBerkas(dokumen: BerkasSidik[]): string {
  const baris = (Array.isArray(dokumen) ? dokumen : [])
    .filter((d) => d && d.documentKey && (d.adaPdf || d.adaWord))
    .map((d) => [d.documentKey, d.jenisDokumen || "", d.peranPengunggah || "", String(d.diunggahPada || ""), d.adaPdf ? "p" : "", d.adaWord ? "w" : ""].join("|"))
    .sort();
  if (!baris.length) return "";
  return createHash("sha1").update(baris.join("\n")).digest("hex");
}

/** Matriks dari jawaban bot yang bentuknya sah, selain itu null (bot lama tanpa matriks). */
export function matriksSah(x: unknown): MatriksDalil | null {
  if (!x || typeof x !== "object") return null;
  const m = x as Partial<MatriksDalil>;
  if (!Array.isArray(m.dalil) || typeof m.versi !== "number") return null;
  return {
    versi: m.versi,
    sumberGugatan: m.sumberGugatan === "ecourt" || m.sumberGugatan === "sipp" ? m.sumberGugatan : "",
    dalil: m.dalil as Dalil[],
    dokumen: Array.isArray(m.dokumen) ? (m.dokumen as MatriksDalil["dokumen"]) : [],
    ringkas: (m.ringkas as MatriksDalil["ringkas"]) || { jumlah: m.dalil.length, perSumber: {}, perJenis: {}, tanggapan: {}, ragu: 0, huruf: [] },
    catatan: Array.isArray(m.catatan) ? m.catatan.map(String) : [],
    ms: Number(m.ms) || 0,
  };
}

/** Pembuktian tersimpan (peta id -> status) digabung ke dalil; id yang tidak ada lagi dibiarkan di peta (tidak hilang bila teks kembali). */
export function gabungPembuktian(m: MatriksDalil, pembuktian: Record<string, PembuktianDalil>): MatriksDalil {
  return { ...m, dalil: m.dalil.map((d) => ({ ...d, pembuktian: pembuktian[d.id] || null })) };
}

/**
 * Dalil yang dipakai agen A2 (penilai pembuktian): posita fakta pihak yang harus membuktikan dan belum diakui lawan.
 * Dalil yang diakui tegas (tidak ragu) tidak perlu dibuktikan lagi; yang dibantah, tidak jelas, atau tidak ditanggapi tetap.
 */
export function dalilPerluBukti(m: MatriksDalil, sumber: SumberDalil[] = ["gugatan", "rekonvensi"]): Dalil[] {
  return m.dalil.filter((d) => d.jenis === "posita-fakta" && sumber.includes(d.sumber) && !(d.tanggapan && d.tanggapan.status === "diakui" && !d.tanggapan.ragu));
}
