import { sesuaikanZcross, type HasilZcross, type OpsiZcross } from "./index";
import { mesinBot } from "./mesin-bot";
import { mesinSoffice, mesinWord, type BentukMasuk, type Mesin } from "./mesin";

/**
 * PENYAMBUNG Z CROSS KE ALUR CETAK / UNDUH / UNGGAH di portal. Otomatis, tanpa tombol:
 *   - unggah BAS Word -> PDF e-Doc : bas-word-pdf.ts (wordKePdfBas) memanggilnya sebelum Word diubah ke PDF;
 *   - cetak PDF dari RTF ABT        : api/aleta-bot/abt/pdf (RTF yang memuat bentuk "SC Z" disesuaikan sebelum diubah ke PDF);
 *   - unduh / cetak RTF, DOCX, DOC  : api/aleta-ecourt/bas/z-cross (ekstensi memanggilnya sebelum menyimpan berkas; lihat dokumen hasil).
 *
 * Mesin: di server = soffice milik bot (lewat gerbang); di laptop ZCROSS_MESIN=word|soffice memakai mesin lokal. Mati: ALETA_ZCROSS=0.
 * Hanya naskah yang MEMUAT bentuk "SC Z" (tanda Z dari blangko) yang disesuaikan otomatis - paragraf "...berikut:" biasa tidak disentuh.
 */
export function zcrossAktif(): boolean {
  const v = String(process.env.ALETA_ZCROSS ?? "").trim().toLowerCase();
  return !(v === "0" || v === "mati" || v === "off" || v === "false");
}

export function pilihMesinPortal(): Mesin {
  const m = String(process.env.ZCROSS_MESIN ?? "").trim().toLowerCase();
  if (m === "word") return mesinWord();
  if (m === "soffice") return mesinSoffice();
  return mesinBot();
}

export type OpsiPakai = Omit<OpsiZcross, "mesin"> & { mesin?: Mesin };

/** Penyesuaian otomatis: tidak pernah melempar galat; naskah tanpa bentuk "SC Z" dikembalikan apa adanya. */
export async function sesuaikanZcrossOtomatis(bita: Uint8Array, bentuk: BentukMasuk, opsi: OpsiPakai = {}): Promise<HasilZcross> {
  const mesin = opsi.mesin ?? pilihMesinPortal();
  if (!zcrossAktif()) {
    return { bita, bentuk: opsi.keluar ?? bentuk, laporan: { diubah: false, alasan: "Z otomatis dimatikan.", mesin: mesin.nama, bentukAsal: bentuk, temuan: [] } };
  }
  return sesuaikanZcross(bita, bentuk, { ...opsi, mesin, hanyaBentuk: true });
}

/** Ringkas laporan menjadi kalimat peringatan untuk pengguna (tanpa istilah teknis). */
export function peringatanZcross(l: HasilZcross["laporan"]): string[] {
  if (!l.diubah) return [];
  const hasil: string[] = [];
  if (l.jumlahHalamanBuktiBawaan) {
    // 3 Nov: Z jawab-menjawab / mediasi menutup LAMPIRAN, bukan bukti
    const kata = l.daftar && l.daftar.length && l.daftar[l.daftar.length - 1].jenis === "lampiran" ? "lampiran" : "bukti";
    hasil.push(
      `Garis Z dan tanggal dipasang otomatis. Jumlah halaman ${kata} memakai bawaan 1 halaman per ${kata} (${l.jumlahHalamanBukti ?? 0} halaman, menempati halaman ${l.halamanBuktiDari ?? "-"}-${l.halamanBuktiSampai ?? "-"}): halaman berikutnya bernomor ${l.nomorBagianBerikut ?? "-"}. Isi jumlah halaman ${kata} bila berbeda.`
    );
  }
  for (const t of l.temuan) if (t.tingkat === "peringatan") hasil.push(t.pesan);
  return hasil;
}

/** Bukti dari masukan formulir/JSON: jumlahBukti (angka) dan halamanBukti ("2,1,3" atau larik) -> opsi Z. Nilai tidak sah diabaikan (dihitung dari naskah). */
export function bacaOpsiBukti(jumlah: unknown, halaman: unknown): { jumlahBukti?: number; halamanBukti?: Array<number | null> } {
  const hasil: { jumlahBukti?: number; halamanBukti?: Array<number | null> } = {};
  const n = Number(jumlah);
  if (jumlah !== undefined && jumlah !== null && jumlah !== "" && Number.isInteger(n) && n >= 0 && n <= 500) hasil.jumlahBukti = n;
  let daftar: unknown[] = [];
  if (Array.isArray(halaman)) daftar = halaman;
  else if (typeof halaman === "string" && halaman.trim()) daftar = halaman.trim().replace(/^\[|\]$/g, "").split(/[,;\s]+/);
  const h = daftar.slice(0, 500).map((x) => {
    const v = Number(x);
    return Number.isInteger(v) && v >= 1 && v <= 5000 ? v : null;
  });
  if (h.length) hasil.halamanBukti = h;
  return hasil;
}
